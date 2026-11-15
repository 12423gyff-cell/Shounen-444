import { clamp, rayHit } from './physics';
import { GameConfig, Obstacle, WW } from './types';

function createNoiseBuffer(ac: AudioContext, sec = 0.65): AudioBuffer {
  const len = Math.max(1024, Math.floor(ac.sampleRate * sec));
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export class SoundEngine {
  ac: AudioContext | null = null;
  nb: AudioBuffer | null = null;
  buses: Record<'master' | 'amb' | 'foley' | 'cre' | 'ui' | 'mus', GainNode | null> = {
    master: null,
    amb: null,
    foley: null,
    cre: null,
    ui: null,
    mus: null,
  };
  echoIn: DelayNode | null = null;
  droneOn = false;
  droneG: GainNode | null = null;
  droneF: BiquadFilterNode | null = null;
  muted = false;
  cfg: GameConfig | null = null;
  posVoices = 0;
  private curBus: GainNode | null = null;
  private curPan = 0;
  private curSend = 0.08;
  private curLPF = 20000;
  private ambStarted = false;
  private humG: GainNode | null = null;
  private ventG: GainNode | null = null;
  private lastDroneTs = 0;
  private lastAmbTs = 0;

  init(cfg: GameConfig): void {
    this.cfg = cfg;
    this.muted = cfg.muted;
    if (this.ac) {
      if (!this.muted && this.ac.state === 'suspended') {
        this.ac.resume().then(() => {
          this.ensureContinuousNodes();
        }).catch(() => {});
      } else if (this.ac.state === 'running') {
        this.ensureContinuousNodes();
      }
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const a = new AC({ latencyHint: 'interactive' });
      this.ac = a;
      const comp = a.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 14;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      comp.connect(a.destination);

      const m = a.createGain();
      m.connect(comp);
      this.buses.master = m;

      for (const k of ['amb', 'foley', 'cre', 'ui', 'mus'] as const) {
        const g = a.createGain();
        g.connect(m);
        this.buses[k] = g;
      }

      // Lightweight slapback chamber echo (replaces heavy ConvolverNode FFT)
      const delay = a.createDelay(0.4);
      delay.delayTime.value = 0.095;
      const echoLPF = a.createBiquadFilter();
      echoLPF.type = 'lowpass';
      echoLPF.frequency.value = 1450;
      const fb = a.createGain();
      fb.gain.value = 0.22;
      const echoOut = a.createGain();
      echoOut.gain.value = 0.28;
      delay.connect(echoLPF);
      echoLPF.connect(echoOut);
      echoOut.connect(m);
      echoLPF.connect(fb);
      fb.connect(delay);
      this.echoIn = delay;

      this.nb = createNoiseBuffer(a, 0.65);
      this.applyCfg(cfg);

      if (this.muted) {
        a.suspend().catch(() => {});
      } else if (a.state === 'running') {
        this.ensureContinuousNodes();
      } else {
        a.resume().then(() => {
          this.ensureContinuousNodes();
        }).catch(() => {});
      }
    } catch {
      this.ac = null;
    }
  }

  private ensureContinuousNodes(): void {
    if (!this.ac || this.muted || this.ac.state !== 'running') return;
    this.startDrone();
    this.startAmbience();
  }

  applyCfg(cfg: GameConfig): void {
    this.cfg = cfg;
    this.muted = cfg.muted;
    if (!this.ac || !this.buses.master) return;
    const t = this.ac.currentTime;
    const masterGain = this.muted ? 0 : (cfg.master / 100) * 0.6;
    this.buses.master.gain.setTargetAtTime(masterGain, t, 0.04);
    this.buses.amb?.gain.setTargetAtTime(cfg.amb / 100, t, 0.05);
    this.buses.foley?.gain.setTargetAtTime(cfg.foley / 100, t, 0.05);
    this.buses.cre?.gain.setTargetAtTime(cfg.cre / 100, t, 0.05);
    this.buses.ui?.gain.setTargetAtTime(cfg.ui / 100, t, 0.05);
    this.buses.mus?.gain.setTargetAtTime((cfg.amb / 100) * 0.72, t, 0.08);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.cfg) {
      this.cfg.muted = muted;
      this.applyCfg(this.cfg);
    }
    if (this.ac) {
      if (muted && this.ac.state === 'running') {
        this.ac.suspend().catch(() => {});
      } else if (!muted && this.ac.state === 'suspended') {
        this.ac.resume().then(() => this.ensureContinuousNodes()).catch(() => {});
      }
    }
  }

  duck(dimmed: boolean): void {
    if (!this.ac || !this.buses.master || this.ac.state !== 'running') return;
    const t = this.ac.currentTime;
    const base = this.muted || !this.cfg ? 0 : (this.cfg.master / 100) * 0.6;
    this.buses.master.gain.setTargetAtTime(dimmed ? base * 0.35 : base, t, 0.08);
  }

  private route(vol = 1): GainNode | null {
    const a = this.ac;
    if (!a || !this.buses.master || a.state !== 'running') return null;
    const out = a.createGain();
    out.gain.value = vol;
    let tail: AudioNode = out;

    if (this.curLPF < 18000) {
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = this.curLPF;
      out.connect(f);
      tail = f;
    }

    if (a.createStereoPanner && Math.abs(this.curPan) > 0.02) {
      const p = a.createStereoPanner();
      p.pan.value = clamp(this.curPan, -1, 1);
      tail.connect(p);
      tail = p;
    }

    tail.connect(this.curBus || this.buses.master);
    if (this.echoIn && this.curSend > 0.02) {
      const sg = a.createGain();
      sg.gain.value = this.curSend;
      tail.connect(sg);
      sg.connect(this.echoIn);
    }
    return out;
  }

  private osc(
    type: OscillatorType,
    f1: number,
    f2: number,
    dur: number,
    vol: number,
    delay = 0,
  ): void {
    const a = this.ac;
    if (!a || a.state !== 'running') return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    const r = this.route(1);
    if (!r) return;
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f1), t);
    if (f2 > 0 && f2 !== f1) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(r);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    freq: number,
    ftype: BiquadFilterType,
    vol: number,
    q = 1,
    delay = 0,
  ): void {
    const a = this.ac;
    if (!a || !this.nb || a.state !== 'running') return;
    const t = a.currentTime + delay;
    const s = a.createBufferSource();
    s.buffer = this.nb;
    const f = a.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = a.createGain();
    const r = this.route(1);
    if (!r) return;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(r);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private startDrone(): void {
    if (this.droneOn || !this.ac || !this.buses.mus) return;
    this.droneOn = true;
    const a = this.ac;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 210;
    const g = a.createGain();
    g.gain.value = 0.04;
    f.connect(g);
    g.connect(this.buses.mus);
    this.droneF = f;
    this.droneG = g;

    for (const [type, fq, gv] of [
      ['sawtooth', 41.2, 0.25],
      ['triangle', 61.7, 0.2],
      ['sine', 82.4, 0.3],
    ] as [OscillatorType, number, number][]) {
      const o = a.createOscillator();
      const og = a.createGain();
      o.type = type;
      o.frequency.value = fq;
      og.gain.value = gv;
      o.connect(og);
      og.connect(f);
      o.start();
    }
  }

  setDrone(intensity: number): void {
    if (!this.ac || this.ac.state !== 'running' || !this.droneG || !this.droneF) return;
    const now = performance.now();
    if (now - this.lastDroneTs < 200) return;
    this.lastDroneTs = now;
    const t = this.ac.currentTime;
    this.droneG.gain.setTargetAtTime(0.028 + intensity * 0.075, t, 0.45);
    this.droneF.frequency.setTargetAtTime(160 + intensity * 420, t, 0.45);
  }

  private startAmbience(): void {
    if (this.ambStarted || !this.ac || !this.buses.amb || !this.nb) return;
    this.ambStarted = true;
    const a = this.ac;
    const hg = a.createGain();
    hg.gain.value = 0.022;
    hg.connect(this.buses.amb);
    this.humG = hg;

    const o1 = a.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = 118;
    const og = a.createGain();
    og.gain.value = 0.4;
    o1.connect(og);
    og.connect(hg);
    o1.start();

    const vg = a.createGain();
    vg.gain.value = 0.03;
    const vf = a.createBiquadFilter();
    vf.type = 'lowpass';
    vf.frequency.value = 340;
    vg.connect(vf);
    vf.connect(this.buses.amb);
    this.ventG = vg;

    const s = a.createBufferSource();
    s.buffer = this.nb;
    s.loop = true;
    s.playbackRate.value = 0.36;
    s.connect(vg);
    s.start();
  }

  updateAmbience(humTarget: number, ventTarget: number): void {
    if (!this.ac || this.ac.state !== 'running' || !this.humG || !this.ventG) return;
    const now = performance.now();
    if (now - this.lastAmbTs < 200) return;
    this.lastAmbTs = now;
    const t = this.ac.currentTime;
    this.humG.gain.setTargetAtTime(humTarget, t, 0.5);
    this.ventG.gain.setTargetAtTime(ventTarget, t, 0.6);
  }

  at(
    name: string,
    wx: number,
    wy: number,
    px: number,
    py: number,
    obs: readonly Obstacle[],
    opts: { maxD?: number; vol?: number; bus?: 'cre' | 'amb' | 'foley'; dur?: number } = {},
  ): void {
    if (!this.ac || this.muted || this.ac.state !== 'running' || this.posVoices >= 10) return;
    const dx = wx - px;
    const dy = wy - py;
    const d = Math.hypot(dx, dy);
    const maxD = opts.maxD ?? 800;
    if (d > maxD) return;

    let wallHits = 0;
    if (d > 55) {
      const ang = Math.atan2(dy, dx);
      const firstHit = rayHit(px, py, ang, d, obs);
      if (firstHit < d - 16) wallHits++;
    }

    const att = Math.pow(1 - d / maxD, 1.55) * (wallHits > 0 ? 0.48 : 1);
    const vol = (opts.vol ?? 1) * att;
    if (vol < 0.02) return;

    const bus = this.buses[opts.bus ?? 'cre'];
    const pan = clamp(dx / (WW * 0.24), -0.9, 0.9);
    const lpf = wallHits > 0 ? 1150 : 18000;
    const send = clamp(0.06 + (d / maxD) * 0.22, 0.05, 0.3);

    this.posVoices++;
    setTimeout(() => {
      this.posVoices = Math.max(0, this.posVoices - 1);
    }, (opts.dur ?? 0.6) * 1000);

    this.playWithRouting(name, vol, bus, pan, send, lpf);
  }

  play(name: string, vol = 1): void {
    if (!this.ac || this.muted || this.ac.state !== 'running') return;
    const uiSet = new Set(['tick', 'click', 'click2', 'deny', 'unlock', 'paper', 'pickup']);
    const creSet = new Set(['roar', 'estomp', 'eshuffle', 'egrowl', 'spit', 'stalker']);
    const bus = uiSet.has(name)
      ? this.buses.ui
      : creSet.has(name)
        ? this.buses.cre
        : this.buses.foley;
    this.playWithRouting(name, vol, bus, 0, 0.09, 20000);
  }

  private playWithRouting(
    name: string,
    vol: number,
    bus: GainNode | null,
    pan: number,
    send: number,
    lpf: number,
  ): void {
    this.curBus = bus;
    this.curPan = pan;
    this.curSend = send;
    this.curLPF = lpf;
    const j = 1 + (Math.random() - 0.5) * 0.14;

    switch (name) {
      case 'pistol':
        this.noise(0.11, 1450 * j, 'bandpass', 0.42 * vol, 1.2);
        this.osc('triangle', 220 * j, 52, 0.11, 0.34 * vol);
        break;
      case 'shotgun':
        this.noise(0.24, 920 * j, 'lowpass', 0.58 * vol);
        this.osc('sawtooth', 165 * j, 34, 0.22, 0.42 * vol);
        break;
      case 'smg':
        this.noise(0.075, 1950 * j, 'bandpass', 0.32 * vol, 1.4);
        this.osc('triangle', 290 * j, 82, 0.07, 0.25 * vol);
        break;
      case 'cryo':
        this.osc('sawtooth', 980 * j, 310, 0.16, 0.24 * vol);
        this.osc('sine', 1680 * j, 620, 0.14, 0.18 * vol, 0.02);
        this.noise(0.12, 3400, 'highpass', 0.18 * vol);
        break;
      case 'bat':
        this.noise(0.12, 620 * j, 'bandpass', 0.25 * vol, 1.5);
        this.osc('sine', 240 * j, 110, 0.11, 0.14 * vol);
        break;
      case 'bathit':
        this.osc('triangle', 170 * j, 48, 0.14, 0.45 * vol);
        this.osc('sawtooth', 620 * j, 220, 0.08, 0.16 * vol);
        this.noise(0.09, 1200, 'bandpass', 0.28 * vol);
        break;
      case 'hit':
        this.noise(0.06, 1700 * j, 'bandpass', 0.22 * vol, 1.6);
        this.osc('sine', 240 * j, 95, 0.06, 0.18 * vol);
        break;
      case 'kill':
        this.osc('sawtooth', 145 * j, 40, 0.22, 0.28 * vol);
        this.noise(0.16, 850, 'lowpass', 0.28 * vol);
        break;
      case 'reload':
        this.osc('square', 440, 620, 0.05, 0.1 * vol);
        this.osc('square', 680, 920, 0.06, 0.12 * vol, 0.14);
        break;
      case 'empty':
        this.osc('square', 310, 220, 0.04, 0.14 * vol);
        break;
      case 'hurt':
        this.osc('sawtooth', 165, 58, 0.25, 0.36 * vol);
        this.noise(0.19, 520, 'lowpass', 0.34 * vol);
        break;
      case 'dash':
        this.noise(0.14, 1500, 'bandpass', 0.2 * vol, 0.8);
        this.osc('sine', 420, 140, 0.13, 0.15 * vol);
        break;
      case 'emp':
        this.osc('sawtooth', 540, 46, 0.45, 0.36 * vol);
        this.osc('sine', 1200, 180, 0.4, 0.24 * vol);
        this.noise(0.28, 2200, 'bandpass', 0.28 * vol);
        break;
      case 'chrono':
        this.osc('sine', 760, 180, 0.55, 0.26 * vol);
        this.osc('triangle', 380, 90, 0.55, 0.2 * vol);
        break;
      case 'stim':
        this.osc('sine', 420, 940, 0.22, 0.2 * vol);
        this.noise(0.12, 2600, 'highpass', 0.12 * vol);
        break;
      case 'explode':
        this.noise(0.55, 320, 'lowpass', 0.65 * vol);
        this.osc('sawtooth', 110, 26, 0.52, 0.55 * vol);
        break;
      case 'flare':
        this.noise(0.22, 2800, 'highpass', 0.2 * vol);
        this.osc('sine', 640, 340, 0.18, 0.14 * vol);
        break;
      case 'roar':
        this.osc('sawtooth', 110, 44, 0.55, 0.42 * vol);
        this.noise(0.45, 420, 'lowpass', 0.3 * vol);
        break;
      case 'spit':
        this.noise(0.14, 1800, 'bandpass', 0.22 * vol, 2);
        this.osc('sine', 380, 180, 0.14, 0.16 * vol);
        break;
      case 'stalker':
        this.osc('sine', 960, 1420, 0.18, 0.16 * vol);
        this.noise(0.16, 3100, 'highpass', 0.15 * vol);
        break;
      case 'estomp':
        this.osc('sine', 84, 34, 0.2, 0.45 * vol);
        this.noise(0.14, 190, 'lowpass', 0.24 * vol);
        break;
      case 'eshuffle':
        this.noise(0.08, 460 * j, 'bandpass', 0.14 * vol, 1.4);
        break;
      case 'egrowl':
        this.osc('sawtooth', 92 * j, 52, 0.42, 0.22 * vol);
        this.noise(0.35, 360, 'lowpass', 0.18 * vol);
        break;
      case 'stepTile':
        this.noise(0.045, 780 * j, 'bandpass', 0.1 * vol, 1.5);
        this.osc('sine', 120 * j, 75, 0.04, 0.08 * vol);
        break;
      case 'stepConc':
        this.noise(0.05, 480 * j, 'bandpass', 0.11 * vol, 1.2);
        this.osc('triangle', 95 * j, 60, 0.045, 0.09 * vol);
        break;
      case 'door':
        this.noise(0.18, 520, 'lowpass', 0.22 * vol);
        this.osc('triangle', 150, 92, 0.16, 0.18 * vol);
        break;
      case 'breaker':
      case 'powerup':
        this.osc('sine', 210, 620, 0.34, 0.22 * vol);
        this.noise(0.16, 1500, 'bandpass', 0.2 * vol);
        break;
      case 'powerdown':
        this.osc('sawtooth', 320, 48, 0.6, 0.28 * vol);
        break;
      case 'loot':
      case 'pickup':
        this.osc('sine', 520, 780, 0.12, 0.18 * vol);
        this.osc('sine', 780, 1040, 0.14, 0.16 * vol, 0.08);
        break;
      case 'paper':
        this.noise(0.14, 2400, 'bandpass', 0.16 * vol, 1.1);
        break;
      case 'unlock':
        this.osc('sine', 540, 810, 0.12, 0.22 * vol);
        this.osc('sine', 810, 1080, 0.22, 0.22 * vol, 0.1);
        break;
      case 'deny':
        this.osc('square', 175, 130, 0.16, 0.16 * vol);
        break;
      case 'tick':
        this.osc('sine', 920, 820, 0.03, 0.08 * vol);
        break;
      case 'click':
        this.osc('triangle', 640, 440, 0.04, 0.1 * vol);
        break;
      case 'click2':
        this.osc('triangle', 840, 1180, 0.045, 0.1 * vol);
        break;
      case 'camon':
        this.osc('sine', 580, 960, 0.12, 0.15 * vol);
        break;
      case 'camoff':
        this.osc('sine', 740, 320, 0.12, 0.13 * vol);
        break;
      case 'zoomIn':
        this.osc('sine', 420, 720, 0.09, 0.11 * vol);
        break;
      case 'shutter':
        this.noise(0.05, 3200, 'highpass', 0.24 * vol);
        this.osc('square', 980, 480, 0.04, 0.12 * vol);
        break;
      case 'sweep':
        this.osc('sine', 280, 880, 0.55, 0.18 * vol);
        this.noise(0.4, 1600, 'bandpass', 0.12 * vol, 2);
        break;
      case 'drip':
        this.osc('sine', 1200 * j, 1750 * j, 0.06, 0.16 * vol);
        break;
      case 'vent':
        this.noise(1.1, 420, 'bandpass', 0.14 * vol, 0.7);
        break;
      case 'slam':
        this.noise(0.24, 240, 'lowpass', 0.36 * vol);
        this.osc('sine', 92, 32, 0.22, 0.32 * vol);
        break;
      case 'whisper':
        this.noise(0.85, 2200, 'bandpass', 0.16 * vol, 3.5);
        break;
      case 'flatline':
        this.osc('sine', 1046, 1046, 0.8, 0.12 * vol);
        break;
      case 'rattle':
      case 'wheels':
        this.noise(0.32, 920 * j, 'bandpass', 0.14 * vol, 2.2);
        break;
      case 'beat':
        this.osc('sine', 58, 36, 0.12, 0.28 * vol);
        this.osc('sine', 54, 34, 0.1, 0.2 * vol, 0.16);
        break;
      case 'over':
        this.osc('sawtooth', 160, 42, 0.85, 0.34 * vol);
        this.osc('sine', 240, 62, 0.9, 0.28 * vol, 0.12);
        break;
      case 'victory':
        this.osc('triangle', 440, 554, 0.24, 0.2 * vol);
        this.osc('triangle', 554, 659, 0.24, 0.2 * vol, 0.14);
        this.osc('triangle', 659, 880, 0.45, 0.24 * vol, 0.28);
        break;
      default:
        break;
    }
  }
}
