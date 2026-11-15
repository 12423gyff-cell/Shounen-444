import { SoundEngine } from './audio';
import {
  angdiff,
  applyAimAssist,
  clamp,
  collideEntity,
  computeKillScore,
  computeComboMultiplier,
  createNurseCircuitGrid,
  deductCost,
  distRect,
  evaluateCircuit,
  evaluateOscilloscopeMatch,
  freeSpot,
  lerp,
  lightPoly,
  lineOfSight,
  pointInObs,
  rayHit,
  segCircle,
  TAU,
  CircuitTile,
} from './physics';
import {
  clearRunSave,
  loadConfig,
  loadProfile,
  loadRunSave,
  loadScores,
  RunCheckpoint,
  saveConfig,
  saveProfile,
  saveRunCheckpoint,
  saveScore,
} from './storage';
import {
  AbilityId,
  CLUES,
  ClueId,
  ClueState,
  CutsceneLine,
  ECOL,
  EnemyType,
  ETYPE,
  GameConfig,
  GameMode,
  GameScreenState,
  HospitalDoor,
  HudSnapshot,
  InventoryCounts,
  PuzzleKind,
  RECIPES,
  SEC_ORDER,
  SECTORS,
  SectorId,
  SLOTS,
  STORY_ACTS,
  UPGRADES,
  WeaponId,
  WH,
  WPN,
  WW,
} from './types';
import {
  buildHospitalWorld,
  Canister,
  createRenderAssets,
  DocPickup,
  Extinguisher,
  RenderAssets,
  roomAt,
  sectorAt,
  WorldData,
} from './world';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
const pad2 = (n: number) => String(Math.floor(Math.max(0, n))).padStart(2, '0');

interface EnemyEntity {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  spd: number;
  dmg: number;
  ang: number;
  kx: number;
  ky: number;
  stun: number;
  slowT: number;
  flash: number;
  bar: number;
  atk: number;
  appear: number;
  t: number;
  sq: number;
  st: 'walk' | 'wind' | 'charge' | 'stun' | 'spitWind' | 'novaWind';
  stT: number;
  cd: number;
  cdx: number;
  cdy: number;
  wander: number;
  wang: number;
  stuck: number;
  hesit: number;
  scanT: number;
  pauseT: number;
  calm: number;
  gait: number;
  sndT: number;
  cloak: number;
  dead: boolean;
  koT: number;
  bossAct?: number;
}

interface Bullet {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  dmg: number;
  kb: number;
  life: number;
  grp: number;
  cryo?: boolean;
  acid?: boolean;
  fromEnemy?: boolean;
  r?: number;
}

interface Grenade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
}

interface Flare {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  landed: boolean;
  t: number;
}

interface AcidPool {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

interface ArcBolt {
  pts: [number, number][];
  life: number;
  max: number;
  col: string;
}

interface DropItem {
  x: number;
  y: number;
  t: 'hp' | 'ammo' | 'bat' | 'salvage' | 'scrap' | 'biogel' | 'cells' | 'fuel' | 'morgueKey';
  life: number;
  vx: number;
  vy: number;
  bob: number;
}

interface Particle {
  active: boolean;
  k: 'b' | 's' | 'sh' | 'd' | 'r' | 'm' | 'st' | 'rip';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  sz: number;
  r1: number;
  r2: number;
  drag: number;
  rot: number;
  col: string;
}

interface FloatText {
  x: number;
  y: number;
  s: string;
  col: string;
  size: number;
  vy: number;
  life: number;
  max: number;
}

interface FlashLight {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  col: 'amber' | 'cyan' | 'red';
}

const BLOODC = ['#8a0f14', '#a8161c', '#6a0a10', '#c2202a'];

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  darkCanvas: HTMLCanvasElement;
  darkCtx: CanvasRenderingContext2D;
  minimapCanvas: HTMLCanvasElement | null = null;
  ecgCanvas: HTMLCanvasElement | null = null;
  facilityCanvas: HTMLCanvasElement | null = null;

  cfg: GameConfig;
  profile = loadProfile();
  scores = loadScores();
  snd = new SoundEngine();

  world: WorldData;
  assets: RenderAssets;

  screen: GameScreenState = 'title';
  mode: GameMode = 'story';
  private rafId = 0;
  private lastTs = 0;
  private W = 1280;
  private H = 720;
  private DPR = 1;
  private DS = 0.5;
  private zoom = 1;
  private hudAcc = 0;
  private onSnapshot: (snap: HudSnapshot) => void;
  private resizeObs: ResizeObserver | null = null;

  // Input state
  private K: Record<string, boolean> = {};
  private justPressed = new Set<string>();
  private mouse = { x: 640, y: 360, down: false };
  private fireBuf = 0;
  private btnFire = false;
  stick = { active: false, x: 0, y: 0 };
  look = { active: false, firing: false, ang: 0 };
  touchRun = false;
  touchMode = false;

  // Pooled particles (zero GC inside RAF)
  private partPool: Particle[] = [];
  private partCursor = 0;
  private capParts = 650;
  private lightRays = 28;
  private perfAcc = 0;
  private perfN = 0;
  private perfBad = 0;
  private perfGood = 0;
  private perfFrames = 0;
  private perfLevel = 2;

  // Simulation Entities
  private cam = { x: 1000, y: 690 };
  private enemies: EnemyEntity[] = [];
  private bullets: Bullet[] = [];
  private grenades: Grenade[] = [];
  private flares: Flare[] = [];
  private acidPools: AcidPool[] = [];
  private arcBolts: ArcBolt[] = [];
  private items: DropItem[] = [];
  private texts: FloatText[] = [];
  private lights: FlashLight[] = [];
  private trails: { x: number; y: number; f: number; life: number }[] = [];
  private nextEnemyId = 1;
  private bulletGroupId = 1;

  // Player & Run State
  private P = {
    x: 1000,
    y: 690,
    vx: 0,
    vy: 0,
    r: 14,
    hp: 100,
    maxHp: 100,
    stam: 100,
    stamDelay: 0,
    bat: 100,
    flashOn: true,
    aim: -Math.PI / 2,
    face: -Math.PI / 2,
    wpn: 'pistol' as WeaponId,
    cd: 0,
    reloadT: 0,
    reloadMax: 1,
    swing: 0,
    swingDir: 1,
    dashT: 0,
    dashCd: 0,
    dvx: 0,
    dvy: 0,
    iT: 0,
    recoil: 0,
    flash: 0,
    step: 0,
    emptyT: 0,
    trailT: 0,
    flick: 0,
    sprinting: false,
    stepSoundT: 0,
    stimSpeedT: 0,
  };

  private G = {
    act: 1,
    escapeTimer: null as number | null,
    time: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    wave: 0,
    waveTotal: 0,
    waveSpawned: 0,
    waveKilled: 0,
    spawnT: 0,
    breakT: 0,
    waveActive: false,
    brutesLeft: 0,
    trauma: 0,
    freeze: 0,
    slow: 0,
    ts: 1,
    zk: 0,
    hitMark: 0,
    hurt: 0,
    dead: false,
    deadT: 0,
    victory: false,
    victoryT: 0,
    glitch: 0,
    menuT: 0,
    beatT: 0,
    lastSector: null as SectorId | null,
    beats: {} as Record<string, boolean>,
    unlocked: {
      pistol: true,
      shotgun: false,
      smg: false,
      bat: true,
      cryo: false,
      flare: false,
    } as Record<WeaponId, boolean>,
    ammo: {
      pistol: { mag: 12, res: 48 },
      shotgun: { mag: 0, res: 0 },
      smg: { mag: 0, res: 0 },
      bat: { mag: 0, res: 0 },
      cryo: { mag: 0, res: 0 },
      flare: { mag: 0, res: 0 },
    } as Record<WeaponId, { mag: number; res: number }>,
    inventory: {
      salvage: 60,
      scrap: 2,
      biogel: 1,
      cells: 1,
      fuel: 1,
      medkits: 1,
      grenades: 2,
      icuKeycard: 0,
      morgueKeycard: 0,
      reactorOverride: 0,
    } as InventoryCounts,
    upgrades: { dmg: 0, hp: 0, bat: 0, cd: 0 } as Record<'dmg' | 'hp' | 'bat' | 'cd', number>,
    abilities: {
      emp: { cd: 0, maxCd: 11, active: 0 },
      chrono: { cd: 0, maxCd: 15, active: 0 },
      grenade: { cd: 0, maxCd: 1.5, active: 0 },
      stim: { cd: 0, maxCd: 14, active: 0 },
    } as Record<AbilityId, { cd: number; maxCd: number; active: number }>,
    docsFound: 0,
    docsTotal: 8,
    collectedDocs: [] as { title: string; body: string; sector: string }[],
    uvDigitsFound: [] as string[],
    toastText: null as string | null,
    toastT: 0,
    banner: null as { title: string; sub: string; icon: string } | null,
    bannerT: 0,
    docCard: null as { title: string; body: string } | null,
    docT: 0,
    hintText: null as string | null,
    hintT: 0,
    ctx: null as {
      kind: 'door' | 'medstation' | 'locker' | 'doc' | 'breaker' | 'terminal';
      id: string;
      label: string;
      short: string;
      ref: unknown;
    } | null,
    puzzle: null as HudSnapshot['puzzle'],
    cutscene: null as HudSnapshot['cutscene'],
    gameOver: null as HudSnapshot['gameOver'],
    wheelSelected: 'pistol' as WeaponId,
    wheelHover: null as WeaponId | null,
  };

  // Subsystems
  private powerGrid: Record<SectorId, { mode: 'on' | 'out' | 'restore'; t: number; flick: number; next: number }> = {
    RECEPTION: { mode: 'on', t: 0, flick: 0, next: 90 },
    WARDB: { mode: 'on', t: 0, flick: 0, next: 90 },
    ICU: { mode: 'on', t: 0, flick: 0, next: 90 },
    RADIOLOGY: { mode: 'on', t: 0, flick: 0, next: 90 },
    MORGUE: { mode: 'on', t: 0, flick: 0, next: 90 },
    REACTOR: { mode: 'on', t: 0, flick: 0, next: 90 },
  };

  private hd = {
    state: 'CALM' as 'CALM' | 'UNEASE' | 'PRESENCE' | 'ESCAPE' | 'COOLDOWN',
    t: 0,
    evT: 9,
    intensity: 0.1,
    noiseLvl: 0,
    figure: null as { x: number; y: number; life: number; t: number } | null,
  };

  private camc = {
    on: false,
    nv: false,
    zoom: 0,
    bat: 100,
    sig: 1,
    capT: 0,
    zoomLv: [1, 1.5, 2],
  };

  private scent = {
    scanning: 0,
    mark: null as { clue: ClueId; x: number; y: number; t: number } | null,
  };

  private ecgPhase = 0;
  private ecgSamples = new Array(48).fill(0);
  private tintRender = { c: [168, 196, 188], a: 0 };
  private oscTarget = { freq: 2.8, amp: 0.9, phase: 1.2 };
  private circuitGrid: CircuitTile[] = createNurseCircuitGrid();
  private wheelOpenTs = 0;
  private wheelSticky = false;
  private returnScreen: GameScreenState = 'playing';
  private cachedHasSave = false;
  private cachedSaveSummary: HudSnapshot['saveSummary'] = null;
  private staticDirty = true;
  private lastRenderedScreen: GameScreenState | null = null;
  private lastHudHash = '';
  private ventAcc = 0;

  constructor(canvas: HTMLCanvasElement, onSnapshot: (snap: HudSnapshot) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.darkCanvas = document.createElement('canvas');
    this.darkCtx = this.darkCanvas.getContext('2d')!;
    this.onSnapshot = onSnapshot;
    this.cfg = loadConfig();
    this.touchMode = this.resolveTouchMode();

    for (let i = 0; i < 650; i++) {
      this.partPool.push({
        active: false,
        k: 'b',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        sz: 2,
        r1: 2,
        r2: 10,
        drag: 0,
        rot: 0,
        col: '#fff',
      });
    }

    this.world = buildHospitalWorld();
    this.assets = createRenderAssets(this.world);
    this.refreshSaveCache();
    this.applyQualityPerf();
    this.bindEvents();
    this.syncBodyState();
    this.emitSnapshot();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private refreshSaveCache(): void {
    const cp = loadRunSave();
    this.cachedHasSave = !!cp;
    this.cachedSaveSummary = cp
      ? { mode: cp.mode, act: cp.act, wave: cp.wave, score: cp.score, time: cp.time }
      : null;
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
    document.body.classList.remove('nocursor');
  }

  private bindEvents(): void {
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.canvas);
    } else {
      window.addEventListener('resize', () => this.resize());
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('pointerdown', (e) => {
      this.snd.init(this.cfg);
      if (e.pointerType === 'touch') return;
      if (this.cfg.controlMode === 'auto' && this.touchMode) {
        this.touchMode = false;
        this.stick.active = false;
        this.look.active = false;
        this.look.firing = false;
        this.syncBodyState();
        this.emitSnapshot();
      }
      if (this.screen !== 'playing' || this.G.dead) return;
      const pos = this.clientToCanvas(e.clientX, e.clientY);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      if (e.button === 2) {
        this.dash();
        return;
      }
      if (e.button === 0) {
        this.mouse.down = true;
        this.fireBuf = 0.14;
      }
    });

    window.addEventListener(
      'touchstart',
      () => {
        if (this.cfg.controlMode === 'auto' && !this.touchMode) {
          this.touchMode = true;
          this.resize();
          this.syncBodyState();
          this.emitSnapshot();
        }
      },
      { passive: true },
    );
  }

  private clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: clientX - r.left,
      y: clientY - r.top,
    };
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(320, Math.round(r.width || window.innerWidth));
    this.H = Math.max(240, Math.round(r.height || window.innerHeight));
    const dprCap = this.touchMode ? [1, 1.25, 1.5][this.perfLevel] : [1, 1.5, 2][this.perfLevel];
    this.DPR = Math.min(window.devicePixelRatio || 1, dprCap);
    this.canvas.width = Math.round(this.W * this.DPR);
    this.canvas.height = Math.round(this.H * this.DPR);
    const dsAdj = [0.09, 0, -0.07][this.perfLevel];
    this.DS = clamp((this.touchMode ? 0.36 : 0.48) + dsAdj, 0.28, 0.6);
    this.darkCanvas.width = Math.max(120, Math.round(this.canvas.width * this.DS));
    this.darkCanvas.height = Math.max(90, Math.round(this.canvas.height * this.DS));
    this.zoom = clamp(Math.min(this.W / 1060, this.H / 680), 0.72, 1.42);
    this.staticDirty = true;
  }

  private applyQualityPerf(): void {
    if (this.cfg.quality === 'low') this.perfLevel = 0;
    else if (this.cfg.quality === 'med') this.perfLevel = 1;
    else if (this.cfg.quality === 'high') this.perfLevel = 2;
    this.capParts = [260, 420, 650][this.perfLevel];
    this.lightRays = [14, 22, 28][this.perfLevel];
    this.resize();
  }

  private resolveTouchMode(): boolean {
    if (this.cfg.controlMode === 'touch') return true;
    if (this.cfg.controlMode === 'desktop') return false;
    return matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  }

  updateConfig(partial: Partial<GameConfig>): void {
    this.cfg = { ...this.cfg, ...partial };
    saveConfig(this.cfg);
    this.snd.applyCfg(this.cfg);
    const nextTouch = this.resolveTouchMode();
    if (nextTouch !== this.touchMode) {
      this.touchMode = nextTouch;
      this.stick.active = false;
      this.look.active = false;
      this.look.firing = false;
      this.syncBodyState();
    }
    this.applyQualityPerf();
    this.emitSnapshot();
  }

  toggleMute(): void {
    this.snd.init(this.cfg);
    this.snd.setMuted(!this.snd.muted);
    this.cfg.muted = this.snd.muted;
    saveConfig(this.cfg);
    this.emitSnapshot();
  }

  setTouchFire(down: boolean): void {
    this.snd.init(this.cfg);
    this.btnFire = down;
    if (down) this.fireBuf = 0.14;
  }

  private clearInputs(): void {
    this.K = {};
    this.justPressed.clear();
    this.mouse.down = false;
    this.btnFire = false;
    this.look.firing = false;
    this.fireBuf = 0;
  }

  private onBlur = (): void => {
    this.clearInputs();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden && this.screen === 'playing') {
      this.clearInputs();
      this.pause();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      if (this.touchMode) {
        this.touchMode = false;
        this.stick.active = false;
        this.look.active = false;
        this.look.firing = false;
        this.syncBodyState();
        this.emitSnapshot();
      }
      const pos = this.clientToCanvas(e.clientX, e.clientY);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' && e.button === 0) this.mouse.down = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.screen !== 'playing' || this.G.dead) return;
    const un = SLOTS.filter((s) => this.G.unlocked[s]);
    if (un.length < 2) return;
    let i = un.indexOf(this.P.wpn);
    i = (i + (e.deltaY > 0 ? 1 : -1) + un.length) % un.length;
    this.switchWeapon(un[i]);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.snd.init(this.cfg);
    if (this.cfg.controlMode === 'auto' && this.touchMode && !e.ctrlKey && !e.metaKey) {
      this.touchMode = false;
      this.syncBodyState();
    }
    const c = e.code;
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) {
      e.preventDefault();
    }
    if (c === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if (this.screen === 'title') {
      if ((c === 'Enter' || c === 'Space') && !e.repeat) {
        this.startNewRun('story');
      }
      return;
    }

    if (this.screen === 'cutscene') {
      if ((c === 'Space' || c === 'Enter' || c === 'Escape') && !e.repeat) {
        this.advanceCutscene();
      }
      return;
    }

    if (this.screen === 'puzzle') {
      if (c === 'Escape' && !e.repeat) this.closeOverlay();
      return;
    }

    if (this.screen === 'briefcase' || this.screen === 'journal' || this.screen === 'map') {
      if (
        (c === 'Escape' ||
          (c === 'KeyI' && this.screen === 'briefcase') ||
          (c === 'KeyJ' && this.screen === 'journal') ||
          (c === 'KeyB' && this.screen === 'map')) &&
        !e.repeat
      ) {
        this.closeOverlay();
      }
      return;
    }

    if (this.screen === 'paused') {
      if ((c === 'Escape' || c === 'KeyP') && !e.repeat) this.resume();
      else if (c === 'KeyR' && !e.repeat) this.startNewRun(this.mode);
      return;
    }

    if (this.screen === 'gameover') {
      if ((c === 'Enter' || c === 'Space' || c === 'KeyR') && !e.repeat) {
        this.startNewRun(this.mode);
      }
      return;
    }

    if (this.screen === 'wheel') {
      if (c === 'Escape') this.closeWheel(false);
      else if (c === 'Tab' && !e.repeat) this.closeWheel(true);
      else if (c.startsWith('Digit')) {
        const n = Number(c.slice(5));
        if (n >= 1 && n <= SLOTS.length) {
          const slot = SLOTS[n - 1];
          if (this.G.unlocked[slot]) {
            this.G.wheelSelected = slot;
            this.closeWheel(true);
          } else {
            this.snd.play('deny');
          }
        }
      } else if (c === 'Enter') {
        this.closeWheel(true);
      }
      return;
    }

    if (this.screen !== 'playing') return;
    this.K[c] = true;
    if (e.repeat) return;
    this.justPressed.add(c);

    switch (c) {
      case 'Tab':
        this.openWheel();
        break;
      case 'Escape':
      case 'KeyP':
        this.pause();
        break;
      case 'KeyR':
        this.startReload();
        break;
      case 'KeyE':
        this.interact();
        break;
      case 'KeyF':
        this.toggleTorch();
        break;
      case 'Space':
        this.dash();
        break;
      case 'KeyQ':
        this.useAbility('emp');
        break;
      case 'KeyT':
        this.useAbility('chrono');
        break;
      case 'KeyG':
        this.useAbility('grenade');
        break;
      case 'KeyH':
        this.useAbility('stim');
        break;
      case 'KeyC':
        this.toggleCamcorder();
        break;
      case 'KeyN':
        this.toggleNightVision();
        break;
      case 'KeyZ':
        this.cycleCamZoom();
        break;
      case 'KeyX':
        this.captureCamPhoto();
        break;
      case 'KeyV':
        this.startScentScan();
        break;
      case 'KeyI':
        this.openOverlay('briefcase');
        break;
      case 'KeyJ':
        this.openOverlay('journal');
        break;
      case 'KeyB':
        this.openOverlay('map');
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
      case 'Digit6': {
        const idx = Number(c.slice(5)) - 1;
        if (SLOTS[idx]) this.switchWeapon(SLOTS[idx]);
        break;
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.K[e.code] = false;
    if (e.code === 'Tab' && this.screen === 'wheel') {
      if (performance.now() - this.wheelOpenTs < 240) this.wheelSticky = true;
      else if (!this.wheelSticky) this.closeWheel(true);
    }
  };

  private syncBodyState(): void {
    let mapped: 'title' | 'playing' | 'paused' | 'gameover' = 'playing';
    if (this.screen === 'title') mapped = 'title';
    else if (this.screen === 'gameover') mapped = 'gameover';
    else if (this.screen === 'playing' || this.screen === 'cutscene') mapped = 'playing';
    else mapped = 'paused';
    document.body.dataset.state = mapped;
    document.body.classList.toggle('nocursor', this.screen === 'playing' && !this.touchMode && !this.G.dead);
    this.staticDirty = true;
  }

  /* ───────────── PUBLIC GAME FLOW CONTROLS ───────────── */
  startNewRun(mode: GameMode, sectorOverride?: SectorId): void {
    this.snd.init(this.cfg);
    this.clearInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.mode = mode;
    this.world = buildHospitalWorld();
    this.assets = createRenderAssets(this.world);
    this.enemies = [];
    this.bullets = [];
    this.grenades = [];
    this.flares = [];
    this.acidPools = [];
    this.arcBolts = [];
    this.items = [];
    this.texts = [];
    this.lights = [];
    this.trails = [];
    for (const p of this.partPool) p.active = false;

    const startSec = sectorOverride || this.cfg.startSector || 'RECEPTION';
    const spawnCoords: Record<SectorId, [number, number]> = {
      RECEPTION: [1000, 700],
      WARDB: [460, 480],
      ICU: [1520, 480],
      RADIOLOGY: [460, 1260],
      MORGUE: [1520, 1300],
      REACTOR: [2140, 890],
    };
    const [sx, sy] = spawnCoords[startSec];

    this.P = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      r: 14,
      hp: 100,
      maxHp: 100,
      stam: 100,
      stamDelay: 0,
      bat: 100,
      flashOn: true,
      aim: -0.35,
      face: -0.35,
      wpn: 'pistol',
      cd: 0,
      reloadT: 0,
      reloadMax: 1,
      swing: 0,
      swingDir: 1,
      dashT: 0,
      dashCd: 0,
      dvx: 0,
      dvy: 0,
      iT: 0,
      recoil: 0,
      flash: 0,
      step: 0,
      emptyT: 0,
      trailT: 0,
      flick: 0,
      sprinting: false,
      stepSoundT: 0,
      stimSpeedT: 0,
    };

    this.G = {
      act: 1,
      escapeTimer: null,
      time: 0,
      score: 0,
      kills: 0,
      combo: 0,
      comboT: 0,
      maxCombo: 0,
      wave: 0,
      waveTotal: 0,
      waveSpawned: 0,
      waveKilled: 0,
      spawnT: 0,
      breakT: 0,
      waveActive: false,
      brutesLeft: 0,
      trauma: 0,
      freeze: 0,
      slow: 0,
      ts: 1,
      zk: 0,
      hitMark: 0,
      hurt: 0,
      dead: false,
      deadT: 0,
      victory: false,
      victoryT: 0,
      glitch: 0,
      menuT: 0,
      beatT: 0,
      lastSector: null,
      beats: {},
      unlocked: {
        pistol: true,
        shotgun: mode === 'endless' && startSec !== 'RECEPTION',
        smg: false,
        bat: true,
        cryo: false,
        flare: true,
      },
      ammo: {
        pistol: { mag: 12, res: 48 },
        shotgun: { mag: mode === 'endless' && startSec !== 'RECEPTION' ? 6 : 0, res: 12 },
        smg: { mag: 0, res: 0 },
        bat: { mag: 0, res: 0 },
        cryo: { mag: 0, res: 0 },
        flare: { mag: 0, res: 3 },
      },
      inventory: {
        salvage: 60,
        scrap: 2,
        biogel: 1,
        cells: 1,
        fuel: 1,
        medkits: 1,
        grenades: 2,
        icuKeycard: 0,
        morgueKeycard: 0,
        reactorOverride: 0,
      },
      upgrades: { dmg: 0, hp: 0, bat: 0, cd: 0 },
      abilities: {
        emp: { cd: 0, maxCd: 11, active: 0 },
        chrono: { cd: 0, maxCd: 15, active: 0 },
        grenade: { cd: 0, maxCd: 1.5, active: 0 },
        stim: { cd: 0, maxCd: 14, active: 0 },
      },
      docsFound: 0,
      docsTotal: this.world.docs.length,
      collectedDocs: [],
      uvDigitsFound: [],
      toastText: null,
      toastT: 0,
      banner: null,
      bannerT: 0,
      docCard: null,
      docT: 0,
      hintText: null,
      hintT: 0,
      ctx: null,
      puzzle: null,
      cutscene: null,
      gameOver: null,
      wheelSelected: 'pistol',
      wheelHover: null,
    };

    for (const k of SEC_ORDER) {
      this.powerGrid[k] = { mode: 'on', t: 0, flick: 0, next: rnd(60, 120) };
    }
    this.hd = { state: 'CALM', t: 0, evT: 8, intensity: 0.14, noiseLvl: 0, figure: null };
    this.camc.on = false;
    this.camc.nv = false;
    this.camc.zoom = 0;
    this.camc.bat = 100;
    this.scent.scanning = 0;
    this.scent.mark = null;
    this.cam.x = this.P.x;
    this.cam.y = this.P.y;

    this.profile.shifts++;
    saveProfile(this.profile);

    if (mode === 'story') {
      this.screen = 'playing';
      this.spawnStoryActEncounter(1);
      this.showBanner('ACT I · SILENT SHIFT', 'CHECK RECEPTION TERMINAL OR SCAN UV MARKS', '✦');
      this.showHint(
        this.touchMode
          ? 'USE LEFT STICK TO MOVE · RIGHT PAD TO AIM & FIRE'
          : 'WASD MOVE · CLICK FIRE · SPACE DASH · E INTERACT · Q/T/G/H POWERS',
        6,
      );
    } else {
      this.screen = 'playing';
      this.startWave(1);
      this.showBanner('ENDLESS NIGHTMARE', 'SURVIVE ST. JUDE LOCKDOWN', '☠');
      this.showHint('OPEN SUPPLY LOCKERS [E] · SHOOT RED O2 & CRYO EXTINGUISHERS', 5);
    }

    this.syncBodyState();
    this.saveCheckpoint();
    this.emitSnapshot();
  }

  continueSavedRun(): void {
    const cp = loadRunSave();
    if (!cp) {
      this.startNewRun('story');
      return;
    }
    this.startNewRun(cp.mode, cp.sector);
    this.G.act = cp.act;
    this.G.wave = cp.wave;
    this.G.score = cp.score;
    this.G.kills = cp.kills;
    this.G.time = cp.time;
    this.P.maxHp = cp.maxHp;
    this.P.hp = Math.max(25, cp.hp);
    this.P.bat = cp.bat;
    this.P.x = cp.px;
    this.P.y = cp.py;
    this.cam.x = cp.px;
    this.cam.y = cp.py;
    Object.assign(this.G.unlocked, cp.unlocked);
    Object.assign(this.G.ammo, cp.ammo);
    Object.assign(this.G.inventory, cp.inventory);
    Object.assign(this.G.upgrades, cp.upgrades);
    this.G.docsFound = cp.docsFound;
    for (const id of cp.openedDoors) {
      const door = this.world.doors.find((d) => d.id === id);
      if (door) this.setDoorOpen(door, true, false);
    }
    this.showBanner('SHIFT RESUMED', `ACT ${this.G.act} · ${SECTORS[sectorAt(this.P.x, this.P.y)].label}`, '▶');
    this.emitSnapshot();
  }

  saveCheckpoint(): void {
    if (this.G.dead || this.G.victory) return;
    const ammoCopy: Record<WeaponId, { mag: number; res: number }> = {
      pistol: { ...this.G.ammo.pistol },
      shotgun: { ...this.G.ammo.shotgun },
      smg: { ...this.G.ammo.smg },
      bat: { ...this.G.ammo.bat },
      cryo: { ...this.G.ammo.cryo },
      flare: { ...this.G.ammo.flare },
    };
    const cp: RunCheckpoint = {
      mode: this.mode,
      act: this.G.act,
      wave: this.G.wave,
      score: Math.round(this.G.score),
      kills: this.G.kills,
      time: Math.floor(this.G.time),
      hp: Math.round(this.P.hp),
      maxHp: Math.round(this.P.maxHp),
      bat: Math.round(this.P.bat),
      px: Math.round(this.P.x),
      py: Math.round(this.P.y),
      sector: sectorAt(this.P.x, this.P.y),
      unlocked: { ...this.G.unlocked },
      ammo: ammoCopy,
      inventory: { ...this.G.inventory },
      upgrades: { ...this.G.upgrades },
      docsFound: this.G.docsFound,
      openedDoors: this.world.doors.filter((d) => d.open).map((d) => d.id),
    };
    saveRunCheckpoint(cp);
    this.refreshSaveCache();
  }

  pause(): void {
    if (this.screen !== 'playing' || this.G.dead) return;
    this.clearInputs();
    this.saveCheckpoint();
    this.screen = 'paused';
    this.snd.duck(true);
    this.syncBodyState();
    this.emitSnapshot();
  }

  resume(): void {
    if (this.screen === 'title' || this.screen === 'gameover') return;
    this.clearInputs();
    this.screen = 'playing';
    this.snd.duck(false);
    this.syncBodyState();
    this.emitSnapshot();
  }

  toTitle(): void {
    this.clearInputs();
    this.camc.on = false;
    this.camc.nv = false;
    this.screen = 'title';
    this.snd.duck(false);
    this.syncBodyState();
    this.emitSnapshot();
  }

  openOverlay(target: 'briefcase' | 'journal' | 'map'): void {
    if (this.screen !== 'playing' && this.screen !== 'paused') return;
    this.clearInputs();
    this.returnScreen = this.screen;
    this.screen = target;
    this.snd.play('click');
    this.snd.duck(true);
    this.syncBodyState();
    this.emitSnapshot();
  }

  closeOverlay(): void {
    if (
      this.screen !== 'briefcase' &&
      this.screen !== 'journal' &&
      this.screen !== 'map' &&
      this.screen !== 'puzzle'
    ) {
      return;
    }
    this.G.puzzle = null;
    this.screen = this.returnScreen === 'paused' ? 'paused' : 'playing';
    this.snd.play('click');
    this.snd.duck(this.screen !== 'playing');
    this.syncBodyState();
    this.emitSnapshot();
  }

  openWheel(): void {
    if (this.screen !== 'playing' || this.G.dead) return;
    this.clearInputs();
    this.screen = 'wheel';
    this.wheelOpenTs = performance.now();
    this.wheelSticky = false;
    this.G.wheelSelected = this.P.wpn;
    this.G.wheelHover = this.P.wpn;
    this.snd.play('tick');
    this.syncBodyState();
    this.emitSnapshot();
  }

  hoverWheel(slot: WeaponId | null): void {
    if (this.G.wheelHover !== slot) {
      this.G.wheelHover = slot;
      if (slot) {
        this.G.wheelSelected = slot;
        this.snd.play('tick');
      }
      this.emitSnapshot();
    }
  }

  closeWheel(commit: boolean, slotOverride?: WeaponId): void {
    if (this.screen !== 'wheel') return;
    const chosen = slotOverride || this.G.wheelSelected;
    this.screen = 'playing';
    if (commit && chosen) {
      this.switchWeapon(chosen);
    }
    this.syncBodyState();
    this.emitSnapshot();
  }

  switchWeapon(id: WeaponId): void {
    if (!this.G.unlocked[id]) {
      this.snd.play('deny');
      this.toast(`${WPN[id].name} LOCKED — SEARCH HOSPITAL LOCKERS`);
      return;
    }
    if (this.P.wpn === id) return;
    this.P.wpn = id;
    this.P.reloadT = 0;
    this.P.cd = 0.12;
    this.snd.play('click2');
    this.emitSnapshot();
  }

  /* ───────────── PUZZLES & CUTSCENES ───────────── */
  private openPuzzle(kind: PuzzleKind, doorId: string): void {
    this.clearInputs();
    this.returnScreen = 'playing';
    this.screen = 'puzzle';
    if (kind === 'keypad') {
      this.G.puzzle = {
        kind: 'keypad',
        doorId,
        title: 'WARD B SECURITY KEYPAD',
        subtitle: 'Enter 4-digit override PIN. Reveal wall digits using Camcorder Night Vision [C -> N].',
      };
    } else if (kind === 'circuit') {
      this.circuitGrid = createNurseCircuitGrid();
      evaluateCircuit(this.circuitGrid);
      this.G.puzzle = {
        kind: 'circuit',
        doorId,
        title: 'NURSE STATION CONDUIT RELAY',
        subtitle: 'Rotate conduit tiles to route power from TOP-LEFT INLET to BOTTOM-RIGHT RELAY.',
        circuitGrid: this.circuitGrid.map((t) => ({ ...t })),
      };
    } else {
      this.oscTarget = { freq: 3.1, amp: 1.05, phase: 1.6 };
      this.G.puzzle = {
        kind: 'oscilloscope',
        doorId,
        title: 'BIO-FREQUENCY OSCILLOSCOPE',
        subtitle: 'Align Frequency, Amplitude, and Phase sliders to match Protocol 98 resonance (>= 92%).',
        oscTarget: { ...this.oscTarget },
      };
    }
    this.syncBodyState();
    this.emitSnapshot();
  }

  submitKeypadPin(pin: string): boolean {
    if (!this.G.puzzle || this.G.puzzle.kind !== 'keypad') return false;
    if (pin === '4827') {
      this.snd.play('unlock');
      const door = this.world.doors.find((d) => d.id === this.G.puzzle?.doorId);
      if (door) {
        door.lockedKind = undefined;
        this.setDoorOpen(door, true, true);
      }
      this.G.score += 400;
      this.G.inventory.salvage += 45;
      this.G.unlocked.smg = true;
      this.G.ammo.smg.mag = 32;
      this.G.ammo.smg.res = 64;
      this.showBanner('WARD B SECURITY BYPASSED', 'MP-98 TACTICAL SMG AUTHORIZED · +400', '🔓');
      this.advanceStoryAct(2);
      this.closeOverlay();
      return true;
    }
    this.snd.play('deny');
    this.toast('INVALID PIN — CHECK NIGHT VISION UV MARKS (4827)');
    return false;
  }

  rotateCircuitTile(index: number): void {
    if (!this.G.puzzle || this.G.puzzle.kind !== 'circuit') return;
    if (index <= 0 || index >= 15) return; // source & sink fixed orientation or rotatable? Let's allow sink rotation too if needed, keep 0 fixed.
    this.circuitGrid[index].rot = (this.circuitGrid[index].rot + 1) % 4;
    const { solved } = evaluateCircuit(this.circuitGrid);
    this.snd.play('click');
    this.G.puzzle = {
      ...this.G.puzzle,
      circuitGrid: this.circuitGrid.map((t) => ({ ...t })),
    };
    if (solved) {
      this.snd.play('unlock');
      const door = this.world.doors.find((d) => d.id === this.G.puzzle?.doorId);
      if (door) {
        door.lockedKind = undefined;
        this.setDoorOpen(door, true, true);
      }
      const term = this.world.terminals.find((t) => t.puzzle === 'circuit');
      if (term) term.used = true;
      this.G.score += 450;
      this.G.inventory.salvage += 60;
      this.G.inventory.icuKeycard = 1;
      this.showBanner('CONDUIT ONLINE', 'ICU ACCESS UNLOCKED · +450', '⚡');
      this.closeOverlay();
    } else {
      this.emitSnapshot();
    }
  }

  submitOscilloscope(freq: number, amp: number, phase: number): boolean {
    if (!this.G.puzzle || this.G.puzzle.kind !== 'oscilloscope') return false;
    const match = evaluateOscilloscopeMatch({ freq, amp, phase }, this.oscTarget);
    if (match >= 92) {
      this.snd.play('unlock');
      for (const d of this.world.doors) {
        if (d.lockedKind === 'oscilloscope') {
          d.lockedKind = undefined;
          this.setDoorOpen(d, true, true);
        }
      }
      const term = this.world.terminals.find((t) => t.puzzle === 'oscilloscope');
      if (term) term.used = true;
      this.G.score += 650;
      this.G.inventory.reactorOverride = 1;
      this.G.unlocked.cryo = true;
      this.G.ammo.cryo.mag = 18;
      this.G.ammo.cryo.res = 36;
      this.showBanner('HARMONIC LOCK CALIBRATED', 'CRYO-ARC CARBINE ONLINE · REACTOR OPEN', '⚛');
      this.advanceStoryAct(5);
      this.closeOverlay();
      return true;
    }
    this.snd.play('deny');
    this.toast(`RESONANCE ${match}% — TARGET REQUIRES >= 92%`);
    return false;
  }

  private playCutscene(title: string, lines: CutsceneLine[]): void {
    this.clearInputs();
    this.screen = 'cutscene';
    this.G.cutscene = { title, lines, index: 0 };
    this.snd.duck(true);
    this.syncBodyState();
    this.emitSnapshot();
  }

  advanceCutscene(): void {
    if (this.screen !== 'cutscene' || !this.G.cutscene) return;
    this.snd.play('click');
    if (this.G.cutscene.index + 1 < this.G.cutscene.lines.length) {
      this.G.cutscene = { ...this.G.cutscene, index: this.G.cutscene.index + 1 };
      this.emitSnapshot();
    } else {
      this.G.cutscene = null;
      this.screen = 'playing';
      this.snd.duck(false);
      this.syncBodyState();
      this.emitSnapshot();
    }
  }

  skipCutscene(): void {
    if (this.screen !== 'cutscene') return;
    this.G.cutscene = null;
    this.screen = 'playing';
    this.snd.duck(false);
    this.syncBodyState();
    this.emitSnapshot();
  }

  /* ───────────── CRAFTING & UPGRADES ───────────── */
  craftRecipe(recipeId: string): boolean {
    const rec = RECIPES.find((r) => r.id === recipeId);
    if (!rec) return false;
    if (!deductCost(this.G.inventory, rec.cost)) {
      this.snd.play('deny');
      this.toast('INSUFFICIENT MATERIALS');
      return false;
    }
    this.snd.play('loot');
    if (recipeId === 'craft_pistol') {
      this.G.ammo.pistol.res += 24;
      this.G.ammo.smg.res += 32;
    } else if (recipeId === 'craft_shells') {
      this.G.ammo.shotgun.res += 8;
      this.G.ammo.cryo.res += 18;
    } else if (recipeId === 'craft_medkit') {
      this.G.inventory.medkits += 1;
    } else if (recipeId === 'craft_ordnance') {
      this.G.inventory.grenades += 1;
      this.G.ammo.flare.res += 2;
    }
    this.toast(`CRAFTED: ${rec.name}`);
    this.emitSnapshot();
    return true;
  }

  useMedkitFromBriefcase(): void {
    if (this.G.inventory.medkits <= 0) {
      this.snd.play('deny');
      return;
    }
    if (this.P.hp >= this.P.maxHp) {
      this.toast('VITALS ALREADY FULL');
      return;
    }
    this.G.inventory.medkits--;
    this.P.hp = Math.min(this.P.maxHp, this.P.hp + 45);
    this.snd.play('stim');
    this.ftext(this.P.x, this.P.y - 24, '+45 HP', '#78e6a8', 15);
    this.emitSnapshot();
  }

  buyUpgrade(id: 'dmg' | 'hp' | 'bat' | 'cd'): boolean {
    const spec = UPGRADES.find((u) => u.id === id);
    if (!spec) return false;
    const lv = this.G.upgrades[id];
    if (lv >= spec.maxLv) {
      this.snd.play('deny');
      return false;
    }
    const cost = spec.baseCost + lv * 65;
    if (this.G.inventory.salvage < cost) {
      this.snd.play('deny');
      this.toast(`NEED ${cost} SALVAGE`);
      return false;
    }
    this.G.inventory.salvage -= cost;
    this.G.upgrades[id] = lv + 1;
    if (id === 'hp') {
      this.P.maxHp += 25;
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + 30);
    } else if (id === 'cd') {
      const mult = 1 - this.G.upgrades.cd * 0.15;
      this.G.abilities.emp.maxCd = 11 * mult;
      this.G.abilities.chrono.maxCd = 15 * mult;
      this.G.abilities.stim.maxCd = 14 * mult;
    }
    this.snd.play('unlock');
    this.toast(`UPGRADED ${spec.name} TIER ${this.G.upgrades[id]}`);
    this.emitSnapshot();
    return true;
  }

  /* ───────────── STORY & WAVE PROGRESSION ───────────── */
  private advanceStoryAct(nextAct: number): void {
    if (this.mode !== 'story' || this.G.act >= nextAct) return;
    this.G.act = nextAct;
    this.spawnStoryActEncounter(nextAct);
    this.saveCheckpoint();

    if (nextAct === 2) {
      this.playCutscene('ACT II · CONTAINMENT BREACH', [
        {
          speaker: 'OPERATIVE VANCE',
          role: 'NIGHT SECURITY',
          portrait: 'guard',
          text: 'Ward B blast shutters are open. Heavy footsteps shaking the ICU corridor.',
        },
        {
          speaker: 'DISPATCH AUDIO',
          role: 'AUTOMATED CHANNEL 04',
          portrait: 'dispatch',
          text: 'Warning: Orderly Lockdown Enforcer "The Warden" loose in ICU/Ward junction.',
        },
      ]);
    } else if (nextAct === 3) {
      this.playCutscene('ACT III · COLD STORAGE', [
        {
          speaker: 'DR. HENDRICKS [ARCHIVE]',
          role: 'MORGUE CHIEF',
          portrait: 'doctor',
          text: 'We tried to freeze Protocol 98 in Sub-Zero Cabinets. It melted the locks from inside.',
        },
      ]);
    } else if (nextAct === 4) {
      this.showBanner('ACT IV · REACTOR CALIBRATION', 'ALIGN BIO-FREQUENCY CONSOLE AT EAST BARRIER', '⚛');
    } else if (nextAct === 5) {
      this.playCutscene('ACT V · SUBJECT OMEGA', [
        {
          speaker: 'SUBJECT OMEGA',
          role: 'CONTAINMENT ORIGIN',
          portrait: 'omega',
          text: 'Do not turn on the resonance harmonic... the shift never ends.',
        },
        {
          speaker: 'OPERATIVE VANCE',
          role: 'NIGHT SECURITY',
          portrait: 'guard',
          text: 'Cryo-Arc is hot. Ending Protocol 98 right now.',
        },
      ]);
    } else if (nextAct === 6) {
      this.G.escapeTimer = 48;
      // Blow open main doors for thrilling escape dash
      for (const d of this.world.doors) {
        if (d.id === 'AIRLOCK-EX') d.lockedKind = undefined;
        else this.setDoorOpen(d, true, false);
      }
      this.showBanner('MELTDOWN IMMINENT · 48s', 'SPRINT TO NORTH EXIT AIRLOCK!', '🚨');
    }
  }

  private spawnStoryActEncounter(act: number): void {
    if (act === 1) {
      // Immediate first-10-seconds encounter visible in Reception East corridor + North hall
      this.spawnEnemy('walker', 1245, 650);
      this.spawnEnemy('crawler', 1070, 445);
      this.spawnEnemy('walker', 600, 480);
      this.spawnEnemy('crawler', 470, 620);
    } else if (act === 2) {
      this.spawnEnemy('warden', 1320, 460, 2);
      this.spawnEnemy('walker', 1200, 320);
      this.spawnEnemy('spitter', 1520, 540);
    } else if (act === 3) {
      this.spawnEnemy('chirurgeon', 1560, 1460, 3);
      this.spawnEnemy('spitter', 1360, 1340);
      this.spawnEnemy('stalker', 1760, 1380);
    } else if (act === 4) {
      this.spawnEnemy('riot', 1780, 880);
      this.spawnEnemy('spitter', 1700, 740);
      this.spawnEnemy('stalker', 1700, 1020);
    } else if (act === 5) {
      this.spawnEnemy('omega', 2340, 900, 5);
      this.spawnEnemy('riot', 2160, 660);
      this.spawnEnemy('crawler', 2180, 1140);
    } else if (act === 6) {
      for (let i = 0; i < 6; i++) {
        this.spawnEnemy(pick(['runner', 'crawler', 'stalker']), 920 + rnd(-260, 260), 280 + rnd(-120, 280));
      }
    }
  }

  private startWave(n: number): void {
    this.G.wave = n;
    this.G.waveTotal = Math.round(7 + n * 4);
    this.G.waveSpawned = 0;
    this.G.waveKilled = 0;
    this.G.spawnT = 0.6;
    this.G.waveActive = true;
    this.G.brutesLeft = n >= 3 && n % 2 === 1 ? 1 : 0;
    if (n === 2) {
      this.G.unlocked.smg = true;
      this.G.ammo.smg = { mag: 32, res: 64 };
      this.showBanner('WAVE 02 · MP-98 UNLOCKED', 'HOLD TAB FOR WEAPON WHEEL', '✦');
    } else if (n === 4) {
      this.G.unlocked.cryo = true;
      this.G.ammo.cryo = { mag: 18, res: 36 };
      this.showBanner('WAVE 04 · CRYO-ARC CARBINE', 'CHAIN LIGHTNING ARMED', '⚡');
    } else {
      this.showBanner(`WAVE ${pad2(n)}`, `${this.G.waveTotal} HOSTILES INBOUND`, '☠');
    }
  }

  private waveClear(): void {
    this.G.waveActive = false;
    this.G.breakT = 6;
    const bonus = 250 * this.G.wave;
    this.G.score += bonus;
    this.G.inventory.salvage += 35 + this.G.wave * 10;
    this.P.hp = Math.min(this.P.maxHp, this.P.hp + 15);
    this.showBanner(`WAVE ${pad2(this.G.wave)} CLEARED`, `+${bonus} PTS · +SALVAGE`, '✓');
    this.saveCheckpoint();
  }

  private spawnEnemy(type: EnemyType, x: number, y: number, bossAct?: number): void {
    if (!freeSpot(x, y, ETYPE[type].r, this.world.obs, WW, WH)) {
      // Find nearby clear spot
      for (let k = 0; k < 10; k++) {
        const ax = x + rnd(-90, 90);
        const ay = y + rnd(-90, 90);
        if (freeSpot(ax, ay, ETYPE[type].r, this.world.obs, WW, WH)) {
          x = ax;
          y = ay;
          break;
        }
      }
    }
    const spec = ETYPE[type];
    const scale = this.mode === 'endless' ? 1 + (this.G.wave - 1) * 0.1 : 1;
    this.enemies.push({
      id: this.nextEnemyId++,
      type,
      x,
      y,
      r: spec.r,
      hp: Math.round(spec.hp * scale),
      maxHp: Math.round(spec.hp * scale),
      spd: spec.spd * (1 + Math.random() * 0.08),
      dmg: spec.dmg,
      ang: Math.atan2(this.P.y - y, this.P.x - x),
      kx: 0,
      ky: 0,
      stun: 0,
      slowT: 0,
      flash: 0,
      bar: spec.isBoss ? 999 : 0,
      atk: 0.4,
      appear: 0,
      t: Math.random() * 6,
      sq: 0,
      st: 'walk',
      stT: 0,
      cd: 2.2,
      cdx: 1,
      cdy: 0,
      wander: 0,
      wang: 0,
      stuck: 0,
      hesit: 0,
      scanT: rnd(4, 10),
      pauseT: 0,
      calm: this.G.time < 6 ? 1.6 : 0.45,
      gait: Math.random() * TAU,
      sndT: rnd(0.5, 1.5),
      cloak: type === 'stalker' ? 0.16 : 1,
      dead: false,
      koT: 0,
      bossAct,
    });
  }

  private pickSpawnPos(): { x: number; y: number } {
    for (let i = 0; i < 18; i++) {
      const a = rnd(0, TAU);
      const d = rnd(390, 620);
      const x = clamp(this.P.x + Math.cos(a) * d, 90, WW - 90);
      const y = clamp(this.P.y + Math.sin(a) * d, 90, WH - 90);
      if (freeSpot(x, y, 22, this.world.obs, WW, WH)) return { x, y };
    }
    return { x: 1000, y: 360 };
  }

  /* ───────────── COMBAT & ABILITIES ───────────── */
  startReload(): void {
    const w = WPN[this.P.wpn];
    const a = this.G.ammo[this.P.wpn];
    if (!w.mag || this.P.reloadT > 0 || a.mag >= w.mag || a.res <= 0) return;
    this.P.reloadMax = w.reload || 1;
    this.P.reloadT = this.P.reloadMax;
    this.snd.play('reload');
  }

  dash(): void {
    if (this.G.dead || this.P.dashCd > 0 || this.P.stam < 22 || this.P.dashT > 0) return;
    let ix = 0;
    let iy = 0;
    if (this.stick.active) {
      ix = this.stick.x;
      iy = this.stick.y;
    } else {
      ix = (this.K.KeyD || this.K.ArrowRight ? 1 : 0) - (this.K.KeyA || this.K.ArrowLeft ? 1 : 0);
      iy = (this.K.KeyS || this.K.ArrowDown ? 1 : 0) - (this.K.KeyW || this.K.ArrowUp ? 1 : 0);
    }
    const l = Math.hypot(ix, iy);
    if (l < 0.1) {
      ix = -Math.cos(this.P.aim);
      iy = -Math.sin(this.P.aim);
    } else {
      ix /= l;
      iy /= l;
    }
    this.P.dvx = ix * 650;
    this.P.dvy = iy * 650;
    this.P.dashT = 0.17;
    this.P.dashCd = 0.45;
    this.P.stam -= 26;
    this.P.stamDelay = 0.6;
    this.P.iT = Math.max(this.P.iT, 0.3);
    this.snd.play('dash');
    this.dust(this.P.x, this.P.y, 8, 90);
    this.ring(this.P.x, this.P.y, 10, 62, 0.25, 'rgba(105,189,247,.8)');
    this.trauma(0.08);
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - this.P.x, e.y - this.P.y) < 260) {
        e.hesit = Math.max(e.hesit, 0.3);
      }
    }
  }

  toggleTorch(): void {
    if (this.P.flashOn) {
      this.P.flashOn = false;
    } else if (this.P.bat > 4) {
      this.P.flashOn = true;
    } else {
      this.toast('TORCH BATTERY EMPTY');
    }
    this.snd.play('click2');
    this.emitSnapshot();
  }

  useAbility(id: AbilityId): void {
    if (this.screen !== 'playing' || this.G.dead) return;
    const ab = this.G.abilities[id];
    if (ab.cd > 0) {
      this.snd.play('deny');
      return;
    }

    if (id === 'emp') {
      ab.cd = ab.maxCd;
      this.snd.play('emp');
      this.ring(this.P.x, this.P.y, 14, 240, 0.42, '#6fe5ff');
      this.lights.push({ x: this.P.x, y: this.P.y, r: 290, life: 0.45, max: 0.45, col: 'cyan' });
      this.trauma(0.32);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - this.P.x, e.y - this.P.y);
        if (d < 240) {
          e.stun = Math.max(e.stun, e.type === 'omega' ? 1.0 : 2.6);
          e.cloak = 1;
          this.hitEnemy(e, 34 * this.dmgMult(), Math.atan2(e.y - this.P.y, e.x - this.P.x), 340, false, 0);
        }
      }
      this.toast('EMP SURGE DISCHARGED');
    } else if (id === 'chrono') {
      ab.cd = ab.maxCd;
      ab.active = 4.2;
      this.snd.play('chrono');
      this.ring(this.P.x, this.P.y, 18, 180, 0.4, '#66d2e4');
      this.toast('CHRONO-STASIS ENGAGED');
    } else if (id === 'grenade') {
      if (this.G.inventory.grenades <= 0) {
        this.snd.play('deny');
        this.toast('NO FRAG GRENADES — CRAFT IN BRIEFCASE [I]');
        return;
      }
      this.G.inventory.grenades--;
      ab.cd = ab.maxCd;
      const c = Math.cos(this.P.aim);
      const s = Math.sin(this.P.aim);
      this.grenades.push({
        x: this.P.x + c * 18,
        y: this.P.y + s * 18,
        vx: c * 520,
        vy: s * 520,
        fuse: 1.05,
      });
      this.snd.play('flare');
    } else if (id === 'stim') {
      ab.cd = ab.maxCd;
      ab.active = 5.0;
      this.P.stimSpeedT = 5.0;
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + 35);
      this.P.stam = 100;
      this.snd.play('stim');
      this.ftext(this.P.x, this.P.y - 24, '+35 HP · ADRENALINE', '#78e6a8', 14);
      this.ring(this.P.x, this.P.y, 12, 85, 0.35, '#78e6a8');
    }
    this.emitSnapshot();
  }

  private dmgMult(): number {
    return 1 + this.G.upgrades.dmg * 0.15;
  }

  private shoot(): void {
    const w = WPN[this.P.wpn];
    const a = this.G.ammo[this.P.wpn];
    if (w.mag && a.mag <= 0) {
      if (a.res > 0) this.startReload();
      else if (this.P.emptyT <= 0) {
        this.P.emptyT = 0.25;
        this.snd.play('empty');
        this.toast('OUT OF AMMO — CRAFT AT [I] OR USE BATON [4]');
      }
      return;
    }

    this.fireBuf = 0;
    if (w.mag) a.mag--;
    this.P.cd = w.rate;
    this.P.reloadT = 0;
    this.P.flash = 0.06;
    this.P.recoil = Math.min(1, this.P.recoil + (this.P.wpn === 'shotgun' ? 0.72 : this.P.wpn === 'smg' ? 0.22 : 0.36));
    this.hd.noiseLvl = Math.min(1, this.hd.noiseLvl + 0.32);

    const aim = this.touchMode
      ? applyAimAssist(this.P.aim, this.P.x, this.P.y, this.enemies, this.cfg.aimAssist)
      : this.P.aim;
    const c = Math.cos(aim);
    const s = Math.sin(aim);
    const mx = this.P.x + c * 28;
    const my = this.P.y + s * 28;
    const pellets = w.pellets || 1;
    const grp = this.bulletGroupId++;
    const mult = this.dmgMult();

    for (let i = 0; i < pellets; i++) {
      const ang = aim + rnd(-(w.spread || 0.03), w.spread || 0.03);
      const spd = (w.speed || 960) * rnd(0.95, 1.05);
      this.bullets.push({
        x: mx,
        y: my,
        px: mx,
        py: my,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        dmg: w.dmg * mult,
        kb: this.P.wpn === 'shotgun' ? 210 : this.P.wpn === 'cryo' ? 140 : 120,
        life: 0.72,
        grp,
        cryo: w.cryo,
      });
    }

    // Muzzle light & shell casing particle
    this.lights.push({
      x: mx,
      y: my,
      r: w.cryo ? 180 : 145,
      life: 0.075,
      max: 0.075,
      col: w.cryo ? 'cyan' : 'amber',
    });
    if (!w.cryo) {
      const shAng = aim + Math.PI * 0.55 + rnd(-0.25, 0.25);
      this.spawnParticle({
        k: 'sh',
        x: this.P.x + c * 14,
        y: this.P.y + s * 14,
        vx: Math.cos(shAng) * rnd(90, 150),
        vy: Math.sin(shAng) * rnd(90, 150),
        life: 0.45,
        sz: 2,
        drag: 5,
        rot: rnd(0, TAU),
        col: '#d9a83a',
      });
    }

    this.snd.play(this.P.wpn);
    this.trauma(this.P.wpn === 'shotgun' ? 0.24 : this.P.wpn === 'smg' ? 0.05 : 0.09);
  }

  private swingBat(): void {
    this.fireBuf = 0;
    this.P.cd = WPN.bat.rate;
    this.P.swing = 0.2;
    this.P.swingDir *= -1;
    this.snd.play('bat');
    const ang = this.P.aim;
    this.P.vx += Math.cos(ang) * 190;
    this.P.vy += Math.sin(ang) * 190;

    let hit = 0;
    const dmg = WPN.bat.dmg * this.dmgMult();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - this.P.x;
      const dy = e.y - this.P.y;
      const d = Math.hypot(dx, dy);
      if (d > 84 + e.r) continue;
      const a = Math.atan2(dy, dx);
      if (Math.abs(angdiff(a, ang)) > 1.1) continue;
      this.hitEnemy(e, dmg * (e.stun > 0 ? 1.4 : 1), a, 520, true, 0);
      e.stun = Math.max(e.stun, 0.65);
      hit++;
    }
    for (const can of this.world.canisters) {
      if (can.exploded) continue;
      if (Math.hypot(can.x - this.P.x, can.y - this.P.y) < 76) {
        this.detonateCanister(can);
      }
    }
    for (const ext of this.world.extinguishers) {
      if (ext.triggered) continue;
      if (Math.hypot(ext.x - this.P.x, ext.y - this.P.y) < 76) {
        this.triggerExtinguisher(ext);
      }
    }
    if (hit > 0) {
      this.trauma(0.28);
      this.G.freeze = Math.max(this.G.freeze, 0.05);
      this.G.zk += 0.032;
      this.sparks(this.P.x + Math.cos(ang) * 58, this.P.y + Math.sin(ang) * 58, ang, 7, '#7ceeff');
    }
  }

  private throwFlare(): void {
    const a = this.G.ammo.flare;
    this.fireBuf = 0;
    if (a.res <= 0) {
      this.snd.play('empty');
      this.toast('NO FLARES LEFT');
      this.P.cd = 0.25;
      return;
    }
    a.res--;
    this.P.cd = WPN.flare.rate;
    const c = Math.cos(this.P.aim);
    const s = Math.sin(this.P.aim);
    this.flares.push({
      x: this.P.x + c * 20,
      y: this.P.y + s * 20,
      vx: c * 520,
      vy: s * 520,
      life: 14,
      landed: false,
      t: 0,
    });
    this.snd.play('flare');
    this.trauma(0.05);
  }

  private triggerCryoChain(sourceEnemy: EnemyEntity, dmg: number): void {
    let jumps = 0;
    let prevX = sourceEnemy.x;
    let prevY = sourceEnemy.y;
    const visited = new Set<number>([sourceEnemy.id]);
    for (let step = 0; step < 3; step++) {
      let best: EnemyEntity | null = null;
      let bd = 195;
      for (const e of this.enemies) {
        if (e.dead || visited.has(e.id)) continue;
        const d = Math.hypot(e.x - prevX, e.y - prevY);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      visited.add(best.id);
      this.arcBolts.push({
        pts: [
          [prevX, prevY],
          [(prevX + best.x) / 2 + rnd(-16, 16), (prevY + best.y) / 2 + rnd(-16, 16)],
          [best.x, best.y],
        ],
        life: 0.18,
        max: 0.18,
        col: '#7df4ff',
      });
      best.slowT = Math.max(best.slowT, 2.4);
      this.hitEnemy(best, dmg * 0.65, Math.atan2(best.y - prevY, best.x - prevX), 110, false, 0);
      prevX = best.x;
      prevY = best.y;
      jumps++;
    }
    if (jumps > 0) this.sparks(sourceEnemy.x, sourceEnemy.y, 0, 5, '#7df4ff');
  }

  private detonateCanister(can: Canister): void {
    if (can.exploded) return;
    can.exploded = true;
    this.explodeAt(can.x, can.y, 175, 165);
  }

  private triggerExtinguisher(ext: Extinguisher): void {
    if (ext.triggered) return;
    ext.triggered = true;
    const radius = 165;
    this.snd.play('cryo');
    this.snd.play('vent', 0.9);
    this.trauma(0.28);
    this.ring(ext.x, ext.y, 8, radius, 0.42, '#7df4ff');
    this.lights.push({ x: ext.x, y: ext.y, r: radius * 1.35, life: 0.36, max: 0.36, col: 'cyan' });
    this.sparks(ext.x, ext.y, 0, 16, '#c4fbff', 280);
    for (let i = 0; i < 14; i++) {
      const a = rnd(0, TAU);
      const sp = rnd(35, 165);
      this.spawnParticle({
        k: 'd',
        x: ext.x,
        y: ext.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.45, 0.9),
        sz: rnd(7, 14),
        col: '#c4f6ff',
        drag: 3.5,
      });
    }
    const dc = this.assets.decalCtx;
    dc.strokeStyle = 'rgba(130,235,255,.32)';
    dc.lineWidth = 4;
    dc.beginPath();
    dc.arc(ext.x / 2, ext.y / 2, radius * 0.25, 0, TAU);
    dc.stroke();

    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - ext.x, e.y - ext.y);
      if (d < radius + e.r) {
        e.slowT = Math.max(e.slowT, 5.2);
        e.stun = Math.max(e.stun, ETYPE[e.type].isBoss ? 0.5 : 1.15);
        this.hitEnemy(e, 28, Math.atan2(e.y - ext.y, e.x - ext.x), 180, false, 0);
      }
    }
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const ap = this.acidPools[i];
      if (Math.hypot(ap.x - ext.x, ap.y - ext.y) < radius + ap.r) {
        this.acidPools.splice(i, 1);
      }
    }
    this.ftext(ext.x, ext.y - 16, 'CO2 CRYO BURST', '#7df4ff', 13);
  }

  private explodeAt(x: number, y: number, radius: number, maxDmg: number): void {
    this.snd.play('explode');
    this.trauma(0.75);
    this.G.freeze = Math.max(this.G.freeze, 0.055);
    this.ring(x, y, 12, radius, 0.36, '#ff9a3a');
    this.lights.push({ x, y, r: radius * 1.6, life: 0.28, max: 0.28, col: 'amber' });
    this.sparks(x, y, 0, 22, '#ffd27a', 380);

    // Burn crater on floor decals
    const dc = this.assets.decalCtx;
    dc.fillStyle = 'rgba(12,10,10,.62)';
    dc.beginPath();
    dc.arc(x / 2, y / 2, radius * 0.25, 0, TAU);
    dc.fill();

    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.r) {
        const falloff = clamp(1 - d / (radius + e.r), 0.25, 1);
        const ang = Math.atan2(e.y - y, e.x - x);
        this.hitEnemy(e, maxDmg * falloff, ang, 460 * falloff, false, 0);
      }
    }

    // Chain-detonate nearby O2 canisters
    for (const other of this.world.canisters) {
      if (!other.exploded && Math.hypot(other.x - x, other.y - y) < radius * 0.9) {
        this.detonateCanister(other);
      }
    }

    // Splash player gently if super close
    const pd = Math.hypot(this.P.x - x, this.P.y - y);
    if (pd < radius * 0.65) {
      this.damagePlayer(18, Math.atan2(this.P.y - y, this.P.x - x), 240);
    }
  }

  private hitEnemy(
    e: EnemyEntity,
    dmg: number,
    ang: number,
    kb: number,
    melee: boolean,
    _grp: number,
  ): void {
    if (e.dead) return;
    // Armored Riot shield reduces frontal non-cryo hits
    let actualDmg = dmg;
    if (e.type === 'riot' && !melee) {
      const hitFromFront = Math.abs(angdiff(ang + Math.PI, e.ang)) < 0.95;
      if (hitFromFront && e.stun <= 0) {
        actualDmg *= 0.28;
        this.sparks(e.x + Math.cos(e.ang) * e.r, e.y + Math.sin(e.ang) * e.r, ang + Math.PI, 4, '#ffd27a');
      }
    }

    e.hp -= actualDmg;
    e.flash = 0.07;
    e.sq = Math.min(0.55, e.sq + 0.28);
    e.bar = ETYPE[e.type].isBoss ? 999 : 2.2;
    e.cloak = 1;

    const kbMul = ETYPE[e.type].isBoss ? 0.18 : e.type === 'riot' ? 0.35 : 1;
    e.kx += Math.cos(ang) * kb * kbMul;
    e.ky += Math.sin(ang) * kb * kbMul;
    if (!ETYPE[e.type].isBoss && e.type !== 'riot') {
      e.stun = Math.max(e.stun, melee ? 0.32 : 0.07);
    }

    this.blood(e.x, e.y, ang, melee ? 9 : 4 + ((actualDmg / 14) | 0));
    this.ftext(
      e.x + rnd(-8, 8),
      e.y - e.r - 4,
      String(Math.round(actualDmg)),
      melee ? '#ffd27a' : actualDmg < dmg * 0.5 ? '#88a0a8' : '#ffffff',
      melee ? 17 : 13,
    );
    this.snd.play(melee ? 'bathit' : 'hit');
    this.G.hitMark = 0.14;

    if (e.hp <= 0) this.killEnemy(e, ang, melee);
  }

  private killEnemy(e: EnemyEntity, ang: number, melee: boolean): void {
    if (e.dead) return;
    e.dead = true;
    e.koT = 0.35; // KO topple dissolve animation
    const spec = ETYPE[e.type];
    this.G.combo++;
    this.G.comboT = 3.2;
    this.G.maxCombo = Math.max(this.G.maxCombo, this.G.combo);

    const pts = computeKillScore(spec.score, this.G.combo, melee);
    const mult = computeComboMultiplier(this.G.combo);
    this.G.score += pts;
    this.G.kills++;
    this.G.waveKilled++;
    const salvGain = spec.isBoss ? 95 : Math.round(spec.score * 0.08);
    this.G.inventory.salvage += salvGain;

    this.profile.kills++;
    this.profile.bestiary[e.type] = (this.profile.bestiary[e.type] || 0) + 1;
    this.profile.xp += spec.isBoss ? 80 : 6;
    saveProfile(this.profile);

    this.ftext(e.x, e.y - e.r - 26, `+${pts}`, mult > 1 ? '#e0ae56' : '#e3eae5', 15 + mult);
    this.blood(e.x, e.y, ang, spec.isBoss ? 36 : 16, 260);
    const dc = this.assets.decalCtx;
    dc.fillStyle = e.type === 'spitter' ? 'rgba(60,120,30,.5)' : 'rgba(80,8,10,.52)';
    dc.beginPath();
    dc.ellipse(e.x / 2, e.y / 2, e.r * 0.85, e.r * 0.62, ang, 0, TAU);
    dc.fill();
    this.ring(e.x, e.y, e.r, e.r * 3.1, 0.3, 'rgba(255,255,255,.65)');
    this.snd.play('kill');
    this.trauma(spec.isBoss ? 0.78 : 0.22);
    this.G.freeze = Math.max(this.G.freeze, spec.isBoss ? 0.08 : 0.032);
    this.G.zk += spec.isBoss ? 0.06 : 0.015;

    // Resource drops
    if (spec.isBoss) {
      this.dropItem(e.x - 16, e.y, 'hp');
      this.dropItem(e.x + 16, e.y, 'ammo');
      this.dropItem(e.x, e.y + 16, 'cells');
      this.dropItem(e.x, e.y - 16, 'biogel');
      if (e.type === 'warden') {
        this.G.inventory.morgueKeycard = 1;
        this.showBanner('THE WARDEN NEUTRALIZED', 'MORGUE KEYCARD ACQUIRED', '✦');
        if (this.mode === 'story' && this.G.act < 3) this.advanceStoryAct(3);
      } else if (e.type === 'chirurgeon') {
        this.showBanner('THE CHIRURGEON FALLEN', 'PROCEED TO REACTOR BIO-FREQUENCY CONSOLE', '✦');
        if (this.mode === 'story' && this.G.act < 4) this.advanceStoryAct(4);
      } else if (e.type === 'omega') {
        this.showBanner('SUBJECT OMEGA CONTAINED', 'REACTOR SELF-DESTRUCT INITIATED!', '🚨');
        if (this.mode === 'story' && this.G.act < 6) this.advanceStoryAct(6);
      }
    } else {
      const r = Math.random();
      if (r < 0.14 + (this.P.hp < 50 ? 0.08 : 0)) this.dropItem(e.x, e.y, 'hp');
      else if (r < 0.34) this.dropItem(e.x, e.y, 'ammo');
      else if (r < 0.48) this.dropItem(e.x, e.y, pick(['scrap', 'biogel', 'cells', 'fuel']));
      else if (r < 0.54) this.dropItem(e.x, e.y, 'bat');
    }
  }

  private dropItem(x: number, y: number, t: DropItem['t']): void {
    const a = rnd(0, TAU);
    this.items.push({ x, y, t, life: 24, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, bob: rnd(0, 6) });
  }

  private damagePlayer(d: number, ang: number, kb = 240): void {
    if (this.P.iT > 0 || this.P.dashT > 0 || this.G.dead || this.G.victory) return;
    this.P.hp -= d;
    this.P.iT = 0.55;
    this.G.hurt = 1;
    this.G.combo = 0;
    this.G.comboT = 0;
    this.P.vx += Math.cos(ang) * kb;
    this.P.vy += Math.sin(ang) * kb;
    this.trauma(0.55);
    this.snd.play('hurt');
    this.blood(this.P.x, this.P.y, ang, 12);
    this.P.flick = 0.45;
    if (this.P.hp <= 0) {
      this.P.hp = 0;
      this.triggerDeath();
    }
  }

  private triggerDeath(): void {
    this.G.dead = true;
    this.G.deadT = 0.7;
    this.G.slow = 1.6;
    this.trauma(1);
    this.snd.play('over');
    this.blood(this.P.x, this.P.y, rnd(0, TAU), 35, 300);
    this.ring(this.P.x, this.P.y, 10, 260, 0.7, '#ff4b4e');
  }

  private triggerVictory(): void {
    this.G.victory = true;
    this.G.victoryT = 0.65;
    this.G.score += 2000;
    this.profile.storyCleared = true;
    this.profile.xp += 250;
    saveProfile(this.profile);
    this.snd.play('victory');
    this.showBanner('ESCAPE AIRLOCK SEALED', 'SHIFT COMPLETE · +2000', '✓');
  }

  private finishRun(victory: boolean): void {
    this.clearInputs();
    this.camc.on = false;
    this.camc.nv = false;
    this.screen = 'gameover';

    const prevBest = this.scores.length ? this.scores[0].score : 0;
    const entry = {
      score: Math.round(this.G.score),
      mode: this.mode,
      act: this.G.act,
      wave: this.G.wave,
      kills: this.G.kills,
      time: Math.floor(this.G.time),
      date: Date.now(),
    };
    const { rank, list } = saveScore(entry);
    this.scores = list;

    let activeBoss = this.enemies.find((e) => !e.dead && ETYPE[e.type].isBoss);
    const bossRemainingPct = activeBoss ? Math.round((activeBoss.hp / activeBoss.maxHp) * 100) : null;

    this.G.gameOver = {
      victory,
      score: Math.round(this.G.score),
      newBest: this.G.score > prevBest && this.G.score > 0,
      rank,
      act: this.G.act,
      wave: this.G.wave,
      kills: this.G.kills,
      maxCombo: this.G.maxCombo,
      time: Math.floor(this.G.time),
      docsFound: this.G.docsFound,
      bossRemainingPct,
      scores: list,
    };

    clearRunSave();
    this.refreshSaveCache();
    this.syncBodyState();
    this.emitSnapshot();
  }

  /* ───────────── INTERACTION & WORLD TOOLS ───────────── */
  private setDoorOpen(door: HospitalDoor, open: boolean, sound = true): void {
    door.open = open;
    const idx = this.world.obs.indexOf(door.obs);
    if (open && idx >= 0) this.world.obs.splice(idx, 1);
    else if (!open && idx < 0) this.world.obs.push(door.obs);
    if (sound) {
      this.snd.play('door');
      this.ring(door.x + door.w / 2, door.y + door.h / 2, 6, 46, 0.25, '#86d2dc');
    }
  }

  private findContext(): typeof this.G.ctx {
    let best: typeof this.G.ctx = null;
    let bd = 1e9;

    for (const term of this.world.terminals) {
      const dd = Math.hypot(this.P.x - term.x, this.P.y - term.y);
      if (dd < 58 && dd < bd && (!term.used || term.puzzle)) {
        bd = dd;
        best = {
          kind: 'terminal',
          id: term.id,
          label: `ACCESS ${term.label}`,
          short: 'USE',
          ref: term,
        };
      }
    }

    for (const door of this.world.doors) {
      const dd = distRect(this.P.x, this.P.y, door);
      if (dd < 68 && dd < bd) {
        bd = dd;
        const lockText = door.lockedKind ? ` [${door.unlockHint}]` : '';
        best = {
          kind: 'door',
          id: door.id,
          label: `${door.open ? 'CLOSE ' : door.lockedKind ? 'UNLOCK ' : 'OPEN '}${door.name}${lockText}`,
          short: door.open ? 'CLOSE' : door.lockedKind ? 'LOCK' : 'OPEN',
          ref: door,
        };
      }
    }

    for (const m of this.world.medStations) {
      if (m.used) continue;
      const dd = Math.hypot(this.P.x - m.x, this.P.y - m.y);
      if (dd < 58 && dd < bd) {
        bd = dd;
        best = { kind: 'medstation', id: m.id, label: `USE ${m.label}`, short: 'HEAL', ref: m };
      }
    }

    for (let i = 0; i < this.world.locks.length; i++) {
      const o = this.world.locks[i];
      if (o.used) continue;
      const dd = distRect(this.P.x, this.P.y, o);
      if (dd < 52 && dd < bd) {
        bd = dd;
        best = { kind: 'locker', id: `lock-${i}`, label: 'OPEN SUPPLY LOCKER', short: 'LOOT', ref: o };
      }
    }

    for (const d of this.world.docs) {
      const dd = Math.hypot(this.P.x - d.x, this.P.y - d.y);
      if (dd < 46 && dd < bd) {
        bd = dd;
        best = { kind: 'doc', id: d.id, label: `READ ${d.title}`, short: 'READ', ref: d };
      }
    }

    for (const b of this.world.breakers) {
      if (this.powerGrid[b.sector]?.mode !== 'out') continue;
      const dd = Math.hypot(this.P.x - b.x, this.P.y - b.y);
      if (dd < 56 && dd < bd) {
        bd = dd;
        best = {
          kind: 'breaker',
          id: b.id,
          label: `RESET BREAKER — ${SECTORS[b.sector].label}`,
          short: 'RESET',
          ref: b,
        };
      }
    }

    return best;
  }

  interact(): void {
    const c = this.G.ctx;
    if (!c || this.G.dead) return;

    if (c.kind === 'terminal') {
      const term = c.ref as (typeof this.world.terminals)[number];
      if (term.puzzle) {
        const doorId =
          term.puzzle === 'keypad' ? 'WARD-04' : term.puzzle === 'circuit' ? 'NURSE-01' : 'REACTOR-C';
        this.openPuzzle(term.puzzle, doorId);
        return;
      }
      term.used = true;
      this.snd.play('unlock');
      if (term.id === 'term-1') {
        this.G.score += 300;
        this.G.inventory.salvage += 40;
        this.G.unlocked.smg = true;
        this.G.ammo.smg = { mag: 32, res: 64 };
        this.showBanner('SHIFT TERMINAL DECRYPTED', 'MP-98 SMG DISPENSED · USE UV NIGHT VISION FOR WARD B', '▤');
        this.advanceStoryAct(2);
      } else if (term.id === 'term-5') {
        if (this.G.act >= 6) {
          this.triggerVictory();
        } else {
          this.toast('AIRLOCK LOCKED — CONTAIN SUBJECT OMEGA IN REACTOR LABS');
          term.used = false;
        }
      }
    } else if (c.kind === 'door') {
      const d = c.ref as HospitalDoor;
      if (d.lockedKind) {
        if (d.lockedKind === 'keypad' || d.lockedKind === 'circuit' || d.lockedKind === 'oscilloscope') {
          this.openPuzzle(d.lockedKind, d.id);
          return;
        }
        if (d.lockedKind === 'keycard') {
          if (this.G.inventory.morgueKeycard > 0) {
            d.lockedKind = undefined;
            this.setDoorOpen(d, true, true);
            this.snd.play('unlock');
            this.showBanner('MORGUE UNLOCKED', 'KEYCARD ACCEPTED', '🔓');
          } else {
            this.snd.play('deny');
            this.toast('LOCKED — DEFEAT THE WARDEN FOR MORGUE KEYCARD');
          }
          return;
        }
        if (d.lockedKind === 'escape') {
          if (this.G.act >= 6) {
            d.lockedKind = undefined;
            this.setDoorOpen(d, true, true);
            this.triggerVictory();
          } else {
            this.snd.play('deny');
            this.toast('EXIT AIRLOCK SEALED UNTIL PROTOCOL 98 TERMINATED');
          }
          return;
        }
      }
      if (d.id === 'AIRLOCK-EX' && this.G.act >= 6) {
        this.triggerVictory();
        return;
      }
      this.setDoorOpen(d, !d.open, true);
    } else if (c.kind === 'medstation') {
      const m = c.ref as (typeof this.world.medStations)[number];
      if (this.P.hp >= this.P.maxHp && this.P.bat >= 95) {
        this.toast('MEDICAL STATION NOT NEEDED');
        return;
      }
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + 45);
      this.P.bat = Math.min(100, this.P.bat + 35);
      m.used = true;
      this.ftext(m.x, m.y - 24, 'AID +45', '#78e6a8', 15);
      this.ring(m.x, m.y, 8, 95, 0.45, '#5cbab5');
      this.snd.play('loot');
    } else if (c.kind === 'breaker') {
      const b = c.ref as (typeof this.world.breakers)[number];
      this.powerGrid[b.sector] = { mode: 'restore', t: 1.6, flick: 0, next: 95 };
      this.snd.play('breaker');
      this.G.score += 300;
      this.confirmEvidence('metallic');
      this.showBanner('CIRCUIT RESTORED', `+300 · ${SECTORS[b.sector].label}`, '⚡');
    } else if (c.kind === 'locker') {
      const o = c.ref as (typeof this.world.locks)[number];
      o.used = true;
      const firstShotgun = !this.G.unlocked.shotgun;
      this.G.ammo.pistol.res += 20;
      this.G.unlocked.shotgun = true;
      this.G.ammo.shotgun.res += firstShotgun ? 14 : 8;
      if (firstShotgun) this.G.ammo.shotgun.mag = 6;
      this.G.ammo.flare.res += 2;
      this.G.inventory.salvage += 45;
      this.G.inventory.scrap += 2;
      this.G.inventory.cells += 1;
      this.G.inventory.biogel += 1;
      this.G.inventory.fuel += 1;
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + 25);
      this.P.bat = 100;
      this.snd.play('loot');
      this.ring(o.x + o.w / 2, o.y + o.h / 2, 8, 120, 0.5, '#7fe0a0');
      this.confirmEvidence('metallic');
      this.showBanner(
        firstShotgun ? 'SHOTGUN & SUPPLIES ACQUIRED' : 'LOCKER LOOTED',
        'PRESS [TAB] FOR WEAPON WHEEL · [I] TO CRAFT',
        '✚',
      );
    } else if (c.kind === 'doc') {
      const d = c.ref as DocPickup;
      const idx = this.world.docs.indexOf(d);
      if (idx >= 0) this.world.docs.splice(idx, 1);
      this.G.docsFound++;
      this.G.score += 250;
      this.G.inventory.salvage += 25;
      this.G.collectedDocs.push({
        title: d.title,
        body: d.body,
        sector: SECTORS[sectorAt(d.x, d.y)].label,
      });
      this.G.docCard = { title: d.title, body: d.body };
      this.G.docT = 6.5;
      this.snd.play('paper');
      this.snd.play('pickup');
      const sec = sectorAt(d.x, d.y);
      if (sec === 'RECEPTION') this.confirmEvidence('dust');
      else if (sec === 'WARDB') this.confirmEvidence('linen');
      else if (sec === 'ICU' || sec === 'MORGUE') this.confirmEvidence('aldehydes');
      this.ftext(d.x, d.y - 14, '+250', '#fff', 16);
    }

    this.G.ctx = null;
    this.emitSnapshot();
  }

  toggleCamcorder(): void {
    if (this.screen !== 'playing' || this.G.dead) return;
    if (!this.camc.on && this.camc.bat <= 2) {
      this.toast('CAMCORDER BATTERY DEPLETED');
      this.snd.play('deny');
      return;
    }
    this.camc.on = !this.camc.on;
    this.snd.play(this.camc.on ? 'camon' : 'camoff');
    this.emitSnapshot();
  }

  toggleNightVision(): void {
    if (!this.camc.on) {
      this.camc.on = true;
    }
    this.camc.nv = !this.camc.nv;
    this.snd.play('click2');
    if (this.camc.nv) {
      this.toast('UV NIGHT VISION ACTIVE — SCAN WALLS FOR CLUES');
    }
    this.emitSnapshot();
  }

  cycleCamZoom(): void {
    if (!this.camc.on) return;
    this.camc.zoom = (this.camc.zoom + 1) % 3;
    this.snd.play('zoomIn');
    this.emitSnapshot();
  }

  captureCamPhoto(): void {
    if (!this.camc.on || this.G.dead || this.camc.capT > 0) return;
    this.camc.capT = 0.75;
    this.snd.play('shutter');
    this.profile.photos++;
    this.profile.xp += 12;
    saveProfile(this.profile);
    this.G.score += 150;
    this.ftext(this.P.x, this.P.y - 26, '+150 TAPE ARCHIVED', '#9fd8cf', 13);
    this.emitSnapshot();
  }

  startScentScan(): void {
    if (this.screen !== 'playing' || this.G.dead || this.scent.scanning > 0) return;
    this.scent.scanning = 1.1;
    this.snd.play('sweep');
    this.emitSnapshot();
  }

  private finishScentScan(): void {
    const sec = sectorAt(this.P.x, this.P.y);
    const pool = SECTORS[sec].scents.filter((c) => this.profile.evidence[c] !== 'confirmed');
    const hit = pool.length ? pick(pool) : pick(SECTORS[sec].scents);
    if (hit) {
      const cur = this.profile.evidence[hit];
      if (!cur || cur === 'none') {
        this.profile.evidence[hit] = 'detected';
        this.G.score += 200;
        this.toast(`SCENT TRACE: ${CLUES[hit].name} +200`);
      } else {
        this.confirmEvidence(hit);
      }
      this.scent.mark = { clue: hit, x: this.P.x, y: this.P.y, t: 1.8 };
      saveProfile(this.profile);
    } else {
      this.toast('AIR SAMPLE CLEAN');
    }
    this.emitSnapshot();
  }

  private confirmEvidence(clue: ClueId): void {
    if (this.profile.evidence[clue] === 'confirmed') return;
    this.profile.evidence[clue] = 'confirmed';
    this.G.score += 350;
    saveProfile(this.profile);
    this.toast(`EVIDENCE CONFIRMED: ${CLUES[clue].name} +350`);
  }

  /* ───────────── HELPERS & PARTICLES ───────────── */
  private trauma(v: number): void {
    const sc = this.cfg.shake / 100;
    this.G.trauma = Math.min(1, this.G.trauma + v * sc);
  }

  private toast(msg: string): void {
    this.G.toastText = msg;
    this.G.toastT = 3.1;
  }

  private showBanner(title: string, sub: string, icon: string): void {
    this.G.banner = { title, sub, icon };
    this.G.bannerT = 3.2;
  }

  private showHint(txt: string, dur = 5): void {
    this.G.hintText = txt;
    this.G.hintT = dur;
  }

  private spawnParticle(opts: Partial<Particle> & { k: Particle['k']; x: number; y: number }): void {
    const p = this.partPool[this.partCursor];
    this.partCursor = (this.partCursor + 1) % this.capParts;
    p.active = true;
    p.k = opts.k;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.life = opts.life ?? 0.4;
    p.max = opts.max ?? p.life;
    p.sz = opts.sz ?? 2.5;
    p.r1 = opts.r1 ?? 4;
    p.r2 = opts.r2 ?? 40;
    p.drag = opts.drag ?? 0;
    p.rot = opts.rot ?? 0;
    p.col = opts.col ?? '#fff';
  }

  private sparks(x: number, y: number, ang: number, n: number, col: string, spdMax = 260): void {
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-1.4, 1.4);
      const sp = rnd(70, spdMax);
      this.spawnParticle({
        k: 's',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.14, 0.34),
        col,
        drag: 4,
      });
    }
  }

  private blood(x: number, y: number, ang: number, n: number, spdMax = 210): void {
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-0.85, 0.85);
      const sp = rnd(40, spdMax);
      this.spawnParticle({
        k: 'b',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.22, 0.55),
        sz: rnd(1.8, 3.8),
        col: pick(BLOODC),
        drag: 5,
      });
    }
  }

  private dust(x: number, y: number, n: number, spdMax = 75): void {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      const sp = rnd(15, spdMax);
      this.spawnParticle({
        k: 'd',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.3, 0.65),
        sz: rnd(4, 9),
        col: '#9aa8a4',
        drag: 3,
      });
    }
  }

  private ring(x: number, y: number, r1: number, r2: number, dur: number, col: string): void {
    this.spawnParticle({ k: 'r', x, y, r1, r2, life: dur, max: dur, col });
  }

  private ftext(x: number, y: number, s: string, col: string, size = 14): void {
    this.texts.push({ x, y, s, col, size, vy: -38, life: 0.75, max: 0.75 });
  }

  private effZoom(): number {
    return this.zoom * (1 + this.G.zk) * (this.camc.on ? 1 + (this.camc.zoomLv[this.camc.zoom] - 1) * 0.42 : 1);
  }

  /* ───────────── MAIN SIMULATION LOOP ───────────── */
  private frame = (ts: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const rdt = (this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0.016) || 0.016;
    this.lastTs = ts;
    this.tickPerf(rdt);

    if (this.screen === 'playing') {
      this.step(rdt);
    } else if (this.screen === 'title') {
      this.G.menuT += rdt;
      const tour: [number, number][] = [
        [1000, 690],
        [1520, 230],
        [450, 1400],
        [1540, 1340],
        [2280, 900],
      ];
      const segLen = 7.5;
      const total = this.G.menuT / segLen;
      const i0 = Math.floor(total) % tour.length;
      const i1 = (i0 + 1) % tour.length;
      const u = total - Math.floor(total);
      const ease = u * u * (3 - 2 * u);
      this.cam.x = lerp(tour[i0][0], tour[i1][0], ease) + Math.cos(this.G.menuT * 0.4) * 38;
      this.cam.y = lerp(tour[i0][1], tour[i1][1], ease) + Math.sin(this.G.menuT * 0.35) * 28;
      this.P.x = this.cam.x;
      this.P.y = this.cam.y;
      this.P.aim = this.G.menuT * 0.45;
      this.P.face = this.P.aim;
      this.G.trauma = 0;
      this.G.zk = 0;
      this.P.flash = 0;
      this.G.dead = false;
    } else {
      this.decay(rdt * 0.25);
    }

    const liveCanvas = this.screen === 'playing' || this.screen === 'title' || this.screen === 'wheel';
    if (liveCanvas || this.staticDirty || this.lastRenderedScreen !== this.screen) {
      this.render(rdt);
      this.lastRenderedScreen = this.screen;
      this.staticDirty = false;
    }
    this.justPressed.clear();

    if (this.screen === 'playing' || this.screen === 'wheel') {
      this.hudAcc += rdt;
      const nextHash = this.computeHudHash();
      const urgentChange = nextHash !== this.lastHudHash;
      if (urgentChange || this.hudAcc >= 0.16) {
        this.hudAcc = 0;
        this.lastHudHash = nextHash;
        this.emitSnapshot();
      }
    }
  };

  private tickPerf(rdt: number): void {
    this.perfAcc += rdt;
    this.perfN++;
    this.perfFrames++;
    if (this.perfAcc >= 0.5) {
      const ft = (this.perfAcc / this.perfN) * 1000;
      this.perfAcc = 0;
      this.perfN = 0;
      if (this.cfg.quality === 'auto' && this.screen === 'playing') {
        if (ft > 26) {
          this.perfBad++;
          this.perfGood = 0;
        } else {
          this.perfBad = 0;
        }
        if (ft < 15) {
          this.perfGood++;
        } else {
          this.perfGood = 0;
        }
        if (this.perfBad >= 4 && this.perfLevel > 0) {
          this.perfLevel--;
          this.applyQualityPerf();
          this.perfBad = 0;
        } else if (this.perfGood > 40 && this.perfLevel < 2) {
          this.perfLevel++;
          this.applyQualityPerf();
          this.perfGood = 0;
        }
      }
    }
  }

  private decay(rdt: number): void {
    this.G.trauma = Math.max(0, this.G.trauma - rdt * 1.6);
    this.G.zk *= Math.exp(-rdt * 9);
    this.G.hurt = Math.max(0, this.G.hurt - rdt * 2.2);
    this.G.hitMark = Math.max(0, this.G.hitMark - rdt);
    this.G.glitch = Math.max(0, this.G.glitch - rdt * 0.9);
    if (this.camc.capT > 0) this.camc.capT -= rdt;
  }

  private step(rdt: number): void {
    this.decay(rdt);
    if (this.G.freeze > 0) {
      this.G.freeze -= rdt;
      return;
    }

    // Time dilation for Chrono-Stasis or KO beat
    const chronoOn = this.G.abilities.chrono.active > 0;
    const targetScale = chronoOn ? 0.36 : this.G.slow > 0 ? 0.35 : 1;
    if (this.G.slow > 0) this.G.slow -= rdt;
    this.G.ts += (targetScale - this.G.ts) * Math.min(1, rdt * 12);
    const dt = rdt * this.G.ts;

    if (this.G.victory) {
      this.G.victoryT -= rdt;
      if (this.G.victoryT <= 0) {
        this.finishRun(true);
        return;
      }
    }

    if (this.G.dead) {
      this.G.deadT -= rdt;
      this.P.vx *= 0.9;
      this.P.vy *= 0.9;
      if (this.G.deadT <= 0) {
        this.finishRun(false);
        return;
      }
    } else if (!this.G.victory) {
      this.G.time += rdt;
      // Player runs crisp even when Chrono-Stasis slows monsters!
      this.updPlayer(chronoOn ? rdt * 0.92 : dt, rdt);
    }

    // Ability timers (real-time cooldowns)
    for (const k of ['emp', 'chrono', 'grenade', 'stim'] as AbilityId[]) {
      const ab = this.G.abilities[k];
      if (ab.cd > 0) ab.cd = Math.max(0, ab.cd - rdt);
      if (ab.active > 0) ab.active = Math.max(0, ab.active - rdt);
    }
    if (this.P.stimSpeedT > 0) this.P.stimSpeedT -= rdt;

    // Escape countdown in Story Act VI
    if (this.mode === 'story' && this.G.act === 6 && this.G.escapeTimer !== null && !this.G.dead && !this.G.victory) {
      this.G.escapeTimer -= rdt;
      if (Math.random() < rdt * 1.5) this.trauma(0.1);
      if (Math.hypot(this.P.x - 1000, this.P.y - 95) < 70) {
        this.triggerVictory();
      } else if (this.G.escapeTimer <= 0) {
        this.G.escapeTimer = 0;
        this.triggerDeath();
      }
    }

    if (this.G.comboT > 0) {
      this.G.comboT -= rdt;
      if (this.G.comboT <= 0) this.G.combo = 0;
    }

    // Spawner logic
    if (this.mode === 'endless') {
      if (this.G.waveActive && !this.G.dead) {
        this.G.spawnT -= dt;
        const cap = Math.min(28, 8 + this.G.wave * 2);
        if (this.G.waveSpawned < this.G.waveTotal && this.enemies.length < cap && this.G.spawnT <= 0) {
          const p = this.pickSpawnPos();
          let type: EnemyType = 'walker';
          if (this.G.brutesLeft > 0 && this.G.waveSpawned >= 2) {
            type = 'warden';
            this.G.brutesLeft--;
          } else {
            const roll = Math.random();
            if (this.G.wave >= 4 && roll < 0.14) type = 'riot';
            else if (this.G.wave >= 3 && roll < 0.3) type = 'stalker';
            else if (this.G.wave >= 2 && roll < 0.48) type = 'spitter';
            else if (roll < 0.7) type = pick(['runner', 'crawler']);
          }
          this.spawnEnemy(type, p.x, p.y);
          this.G.waveSpawned++;
          this.G.spawnT = Math.max(0.38, 1.35 - this.G.wave * 0.08) * rnd(0.7, 1.2);
        }
        if (this.G.waveSpawned >= this.G.waveTotal && this.enemies.every((e) => e.dead)) {
          this.waveClear();
        }
      } else if (!this.G.waveActive && !this.G.dead) {
        this.G.breakT -= rdt;
        if (this.G.breakT <= 0) this.startWave(this.G.wave + 1);
      }
    } else if (!this.G.dead && !this.G.victory) {
      // Story ambient reinforcement pacing (caps cleanly so player is never soft-locked or bored)
      const cap = 5 + this.G.act * 2;
      this.G.spawnT -= dt;
      if (this.enemies.length < cap && this.G.spawnT <= 0) {
        this.G.spawnT = Math.max(3.2, 8.5 - this.G.act * 0.9);
        const p = this.pickSpawnPos();
        const pool: EnemyType[] =
          this.G.act <= 1
            ? ['walker', 'crawler']
            : this.G.act === 2
              ? ['walker', 'runner', 'spitter']
              : this.G.act === 3
                ? ['runner', 'spitter', 'stalker']
                : ['walker', 'spitter', 'stalker', 'riot', 'crawler'];
        this.spawnEnemy(pick(pool), p.x, p.y);
      }
    }

    this.updEnemies(dt);
    this.updBullets(dt);
    this.updGrenades(dt);
    this.updFlares(dt);
    this.updAcidPools(dt);
    this.updItems(dt);
    this.updFx(rdt);
    for (const d of this.world.docs) d.t += rdt;

    if (!this.G.dead) {
      this.updDirector(rdt);
      this.updPower(rdt);
      this.updCamcorder(rdt);
      this.updUVMarks();

      // Atmospheric steam vents puffing along ducts
      this.ventAcc -= rdt;
      if (this.ventAcc <= 0) {
        this.ventAcc = 0.7;
        for (const [vx, vy] of this.world.vents) {
          if (Math.hypot(vx - this.P.x, vy - this.P.y) < 760) {
            this.spawnParticle({
              k: 'd',
              x: vx,
              y: vy,
              vx: rnd(-18, 18),
              vy: rnd(12, 34),
              life: rnd(0.8, 1.4),
              sz: rnd(7, 13),
              col: 'rgba(200,225,232,0.5)',
              drag: 1.5,
            });
          }
        }
      }

      if (this.scent.scanning > 0) {
        this.scent.scanning -= rdt;
        if (this.scent.scanning <= 0) this.finishScentScan();
      }
      if (this.scent.mark) {
        this.scent.mark.t -= rdt;
        if (this.scent.mark.t <= 0) this.scent.mark = null;
      }

      const sec = sectorAt(this.P.x, this.P.y);
      if (sec !== this.G.lastSector) {
        this.G.lastSector = sec;
        if (!this.G.beats[sec]) {
          this.G.beats[sec] = true;
          if (sec === 'MORGUE') {
            this.toast('COLD STORAGE MORGUE — WATCH ACID VENTS');
          } else if (sec === 'ICU') {
            this.snd.play('flatline');
            this.toast('ICU WING — HEART MONITORS ACTIVE');
          } else if (sec === 'REACTOR') {
            this.toast('PROTOCOL 98 REACTOR LABS');
          }
        }
      }

      for (const niche of this.world.secrets) {
        if (!niche.discovered && Math.hypot(this.P.x - niche.x, this.P.y - niche.y) < 78) {
          niche.discovered = true;
          this.G.inventory.salvage += 35;
          this.toast(`SERVICE NICHE DISCOVERED · ${niche.name}`);
          this.snd.play('pickup');
          if (!this.profile.secrets.includes(niche.id)) {
            this.profile.secrets.push(niche.id);
            this.profile.xp += 40;
            saveProfile(this.profile);
          }
        }
      }
    }

    if (this.G.toastT > 0) {
      this.G.toastT -= rdt;
      if (this.G.toastT <= 0) this.G.toastText = null;
    }
    if (this.G.bannerT > 0) {
      this.G.bannerT -= rdt;
      if (this.G.bannerT <= 0) this.G.banner = null;
    }
    if (this.G.docT > 0) {
      this.G.docT -= rdt;
      if (this.G.docT <= 0) this.G.docCard = null;
    }
    if (this.G.hintT > 0) {
      this.G.hintT -= rdt;
      if (this.G.hintT <= 0) this.G.hintText = null;
    }

    this.updCam(rdt);
    this.updECG(rdt);
  }

  private updPlayer(dt: number, rdt: number): void {
    const z = this.effZoom();
    if (!this.touchMode) {
      const psx = this.W / 2 + (this.P.x - this.cam.x) * z;
      const psy = this.H / 2 + (this.P.y - this.cam.y) * z;
      this.P.aim = Math.atan2(this.mouse.y - psy, this.mouse.x - psx);
    } else if (this.look.active && this.look.firing) {
      this.P.aim = this.look.ang;
    }
    this.P.face += angdiff(this.P.aim, this.P.face) * Math.min(1, dt * 28);

    let ix = 0;
    let iy = 0;
    if (this.stick.active) {
      ix = this.stick.x;
      iy = this.stick.y;
    } else {
      ix = (this.K.KeyD || this.K.ArrowRight ? 1 : 0) - (this.K.KeyA || this.K.ArrowLeft ? 1 : 0);
      iy = (this.K.KeyS || this.K.ArrowDown ? 1 : 0) - (this.K.KeyW || this.K.ArrowUp ? 1 : 0);
      const l = Math.hypot(ix, iy);
      if (l > 1) {
        ix /= l;
        iy /= l;
      }
    }

    const mag = Math.min(1, Math.hypot(ix, iy));
    this.P.sprinting = (this.K.ShiftLeft || this.K.ShiftRight || this.touchRun) && mag > 0.1 && this.P.stam > 2 && this.P.dashT <= 0;
    const stimMul = this.P.stimSpeedT > 0 ? 1.24 : 1;
    const spd = 195 * stimMul * (this.P.sprinting ? 1.52 : 1) * (this.P.reloadT > 0 ? 0.93 : 1);

    if (this.P.dashT > 0) {
      this.P.dashT -= dt;
      const k = 0.4 + (0.6 * Math.max(0, this.P.dashT)) / 0.17;
      this.P.vx = this.P.dvx * k;
      this.P.vy = this.P.dvy * k;
      this.P.trailT -= dt;
      if (this.P.trailT <= 0) {
        this.P.trailT = 0.028;
        this.trails.push({ x: this.P.x, y: this.P.y, f: this.P.face, life: 0.22 });
      }
    } else {
      const k = 1 - Math.exp(-dt * (mag > 0 ? 16 : 12));
      this.P.vx += (ix * spd - this.P.vx) * k;
      this.P.vy += (iy * spd - this.P.vy) * k;
    }

    this.P.x += this.P.vx * dt;
    this.P.y += this.P.vy * dt;
    collideEntity(this.P, this.P.r, this.world.obs, WW, WH);

    const sp = Math.hypot(this.P.vx, this.P.vy);
    this.P.stepSoundT -= dt;
    if (sp > 65) {
      this.P.step += sp * dt;
      if (this.P.stepSoundT <= 0) {
        const surf = SECTORS[sectorAt(this.P.x, this.P.y)].surface;
        this.snd.play(surf === 'concrete' ? 'stepConc' : 'stepTile', this.P.sprinting ? 0.85 : 0.55);
        this.P.stepSoundT = this.P.sprinting ? 0.23 : 0.36;
      }
      if (this.P.step > 38) {
        this.P.step = 0;
        if (this.P.sprinting) this.dust(this.P.x - this.P.vx * 0.05, this.P.y - this.P.vy * 0.05, 2, 24);
      }
    }

    if (this.P.sprinting) {
      this.P.stam -= 24 * dt;
      this.P.stamDelay = 0.7;
      this.hd.noiseLvl = Math.min(1, this.hd.noiseLvl + dt * 0.22);
    } else if (this.P.stamDelay > 0) {
      this.P.stamDelay -= dt;
    } else {
      this.P.stam = Math.min(100, this.P.stam + 32 * dt);
    }
    this.P.stam = Math.max(0, this.P.stam);

    const batDrainMul = Math.pow(0.8, this.G.upgrades.bat);
    if (this.P.flashOn) {
      this.P.bat -= 1.25 * batDrainMul * dt;
      if (this.P.bat <= 0) {
        this.P.bat = 0;
        this.P.flashOn = false;
        this.toast('TORCH BATTERY EMPTY');
      }
    } else {
      this.P.bat = Math.min(100, this.P.bat + (3.8 + this.G.upgrades.bat * 1.1) * dt);
    }

    this.P.cd -= dt;
    this.P.iT -= dt;
    this.P.dashCd -= dt;
    this.P.swing -= dt;
    this.P.flash -= dt;
    this.P.emptyT -= dt;
    this.P.flick -= dt;
    this.P.recoil = Math.max(0, this.P.recoil - dt * 7);

    if (this.P.reloadT > 0) {
      this.P.reloadT -= dt;
      if (this.P.reloadT <= 0) {
        const w = WPN[this.P.wpn];
        const a = this.G.ammo[this.P.wpn];
        if (w.mag) {
          const take = Math.min(w.mag - a.mag, a.res);
          a.mag += take;
          a.res -= take;
          this.snd.play('click2');
        }
      }
    }

    this.fireBuf -= rdt;
    const w = WPN[this.P.wpn];
    const a = this.G.ammo[this.P.wpn];
    if (w.mag && a.mag <= 0 && a.res > 0 && this.P.reloadT <= 0 && this.P.cd <= 0) {
      this.startReload();
    }

    const held = this.mouse.down || this.look.firing || this.btnFire;
    if (this.P.cd <= 0 && !this.G.dead) {
      if (w.flare) {
        if (this.fireBuf > 0) this.throwFlare();
      } else if (held || this.fireBuf > 0) {
        if (w.melee) this.swingBat();
        else this.shoot();
      }
    }

    if (this.P.hp < 35 && !this.G.dead) {
      this.G.beatT -= dt;
      if (this.G.beatT <= 0) {
        this.G.beatT = 0.58 + this.P.hp / 100;
        this.snd.play('beat');
      }
    }

    this.G.ctx = this.findContext();
  }

  private updEnemies(dt: number): void {
    let attackTokens = 0; // Crowd attack limiter (max 4 simultaneous close attackers)
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) {
        e.koT -= dt;
        continue;
      }

      e.t += dt;
      e.stun = Math.max(0, e.stun - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.bar = Math.max(0, e.bar - dt);
      e.atk -= dt;
      e.appear = Math.min(1, e.appear + dt * 3);
      e.sq += (0 - e.sq) * Math.min(1, dt * 14);
      const kd = Math.exp(-dt * 9);
      e.kx *= kd;
      e.ky *= kd;

      let tx = this.P.x;
      let ty = this.P.y;
      let targetingPlayer = true;
      const pd = Math.hypot(this.P.x - e.x, this.P.y - e.y);

      for (const f of this.flares) {
        if (!f.landed) continue;
        const fd = Math.hypot(f.x - e.x, f.y - e.y);
        if (fd < 340 && fd < pd + 140) {
          tx = f.x;
          ty = f.y;
          targetingPlayer = false;
          break;
        }
      }

      let dx = tx - e.x;
      let dy = ty - e.y;
      let d = Math.hypot(dx, dy) || 1;
      let vx = 0;
      let vy = 0;
      const slowMul = e.slowT > 0 ? 0.48 : 1;

      // Stalker invisibility fade when far from torch/NV
      if (e.type === 'stalker') {
        const lit = (this.camc.on && this.camc.nv) || (this.P.flashOn && pd < 290 && Math.abs(angdiff(Math.atan2(e.y - this.P.y, e.x - this.P.x), this.P.face)) < 0.55);
        const targetCloak = lit || pd < 110 ? 0.92 : 0.14;
        e.cloak += (targetCloak - e.cloak) * Math.min(1, dt * 5);
      }

      // Boss & Special Archetype AI state machines
      if (e.type === 'warden' || e.type === 'omega') {
        e.stT -= dt;
        e.cd -= dt;
        if (e.st === 'walk' && e.cd <= 0 && pd < 410 && targetingPlayer && lineOfSight(e.x, e.y, this.P.x, this.P.y, this.world.obs)) {
          e.st = e.type === 'omega' && Math.random() < 0.45 ? 'novaWind' : 'wind';
          e.stT = 0.65;
          e.cdx = dx / d;
          e.cdy = dy / d;
          this.snd.play('roar');
          this.trauma(0.16);
        } else if (e.st === 'wind') {
          e.ang += angdiff(Math.atan2(dy, dx), e.ang) * Math.min(1, dt * 7);
          e.cdx = Math.cos(e.ang);
          e.cdy = Math.sin(e.ang);
          if (e.stT <= 0) {
            e.st = 'charge';
            e.stT = 0.72;
          }
        } else if (e.st === 'novaWind') {
          if (e.stT <= 0) {
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * TAU + e.t;
              this.bullets.push({
                x: e.x + Math.cos(a) * e.r,
                y: e.y + Math.sin(a) * e.r,
                px: e.x,
                py: e.y,
                vx: Math.cos(a) * 320,
                vy: Math.sin(a) * 320,
                dmg: 16,
                kb: 180,
                life: 1.6,
                grp: 0,
                acid: true,
                fromEnemy: true,
                r: 6,
              });
            }
            this.snd.play('spit');
            e.st = 'walk';
            e.cd = 2.8;
          }
        } else if (e.st === 'charge') {
          vx = e.cdx * 430 * slowMul;
          vy = e.cdy * 430 * slowMul;
          if (e.stT <= 0) {
            e.st = 'stun';
            e.stT = 0.65;
            e.cd = 3.2;
          }
        } else if (e.st === 'stun') {
          if (e.stT <= 0) e.st = 'walk';
        }
      } else if (e.type === 'spitter' || e.type === 'chirurgeon') {
        e.stT -= dt;
        e.cd -= dt;
        if (e.st === 'walk' && e.cd <= 0 && pd < 440 && pd > 95 && lineOfSight(e.x, e.y, this.P.x, this.P.y, this.world.obs)) {
          e.st = 'spitWind';
          e.stT = 0.48;
          this.snd.at('spit', e.x, e.y, this.P.x, this.P.y, this.world.obs);
        } else if (e.st === 'spitWind') {
          e.ang += angdiff(Math.atan2(dy, dx), e.ang) * Math.min(1, dt * 10);
          if (e.stT <= 0) {
            const count = e.type === 'chirurgeon' ? 3 : 1;
            for (let k = 0; k < count; k++) {
              const offset = count === 1 ? 0 : (k - 1) * 0.24;
              const a = e.ang + offset;
              this.bullets.push({
                x: e.x + Math.cos(a) * e.r,
                y: e.y + Math.sin(a) * e.r,
                px: e.x,
                py: e.y,
                vx: Math.cos(a) * 350,
                vy: Math.sin(a) * 350,
                dmg: e.dmg,
                kb: 140,
                life: 1.5,
                grp: 0,
                acid: true,
                fromEnemy: true,
                r: 6,
              });
            }
            if (e.type === 'chirurgeon' && this.enemies.length < 10 && Math.random() < 0.45) {
              this.spawnEnemy('crawler', e.x + rnd(-50, 50), e.y + rnd(-50, 50));
            }
            e.st = 'walk';
            e.cd = e.type === 'chirurgeon' ? 2.4 : 3.2;
          }
        }
      }

      if (e.stun <= 0 && e.st === 'walk') {
        if (e.wander > 0) {
          e.wander -= dt;
          dx = Math.cos(e.wang);
          dy = Math.sin(e.wang);
          d = 1;
        }
        let want = Math.atan2(dy, dx);
        // Spitter tries to kite if player is close
        if (e.type === 'spitter' && pd < 190 && e.wander <= 0) {
          want += Math.PI * 0.85;
        } else if (e.type === 'runner' && pd < 220 && pd > 70) {
          want += (e.id & 1 ? 0.35 : -0.35);
        }

        e.ang += angdiff(want, e.ang) * Math.min(1, dt * (e.type === 'runner' || e.type === 'crawler' ? 10 : 6));
        if (e.hesit > 0) e.hesit -= dt;
        e.scanT -= dt;
        if (e.scanT <= 0 && e.pauseT <= 0 && pd > 380) {
          e.pauseT = rnd(0.35, 0.7);
          e.scanT = rnd(5, 11);
        }
        if (e.pauseT > 0) {
          e.pauseT -= dt;
        } else {
          if (e.calm > 0) e.calm -= dt;
          const lurch =
            (0.84 + 0.2 * Math.sin(e.t * (e.type === 'runner' ? 10 : 4) + e.gait)) *
            (e.hesit > 0 ? 0.35 : 1) *
            (e.calm > 0 ? 0.5 : 1);
          vx = Math.cos(e.ang) * e.spd * lurch * slowMul;
          vy = Math.sin(e.ang) * e.spd * lurch * slowMul;
        }
      } else if (e.st === 'charge') {
        e.ang = Math.atan2(vy, vx);
      }

      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const colRes = collideEntity(e, e.r, this.world.obs, WW, WH);
      if (colRes.hit) {
        e.stuck += dt;
        if (e.st === 'charge') {
          e.st = 'stun';
          e.stT = 1.1;
          e.cd = 3.2;
          this.trauma(0.55);
          this.dust(e.x, e.y, 12, 110);
          this.sparks(e.x, e.y, Math.atan2(colRes.ny, colRes.nx), 8, '#cfd8d4');
        } else if (e.stuck > 0.55) {
          e.wang = Math.atan2(colRes.ny, colRes.nx) + rnd(-1.2, 1.2) + (Math.random() < 0.5 ? 1.4 : -1.4);
          e.wander = 0.65;
          e.stuck = 0;
        }
      } else {
        e.stuck = Math.max(0, e.stuck - dt);
      }

      // Soft separation between enemies
      for (let j = i + 1; j < this.enemies.length; j++) {
        const o = this.enemies[j];
        if (o.dead) continue;
        const ox = o.x - e.x;
        const oy = o.y - e.y;
        const md = (e.r + o.r) * 0.9;
        if (Math.abs(ox) > md || Math.abs(oy) > md) continue;
        const od = Math.hypot(ox, oy) || 0.01;
        if (od >= md) continue;
        const p = ((md - od) * 0.5) / od;
        e.x -= ox * p;
        e.y -= oy * p;
        o.x += ox * p;
        o.y += oy * p;
      }

      const mdp = (e.r + this.P.r) * 0.86;
      if (pd < mdp && pd > 0.01) {
        e.x = this.P.x - ((this.P.x - e.x) / pd) * mdp;
        e.y = this.P.y - ((this.P.y - e.y) / pd) * mdp;
      }

      e.sndT -= dt;
      if (e.sndT <= 0 && (vx || vy) && pd < 640) {
        e.sndT = rnd(0.75, 1.35);
        this.snd.at(ETYPE[e.type].isBoss ? 'estomp' : 'eshuffle', e.x, e.y, this.P.x, this.P.y, this.world.obs, {
          maxD: 640,
          vol: ETYPE[e.type].isBoss ? 0.95 : 0.7,
        });
      }

      if (!this.G.dead && pd < e.r + this.P.r + 8 && e.stun <= 0) {
        if (e.st === 'charge') {
          this.damagePlayer(e.dmg * 1.15, Math.atan2(this.P.y - e.y, this.P.x - e.x), 460);
        } else if (e.atk <= 0 && e.st === 'walk' && attackTokens < 4) {
          attackTokens++;
          e.atk = e.type === 'runner' || e.type === 'crawler' ? 0.72 : 0.95;
          e.sq = 0.3;
          this.damagePlayer(e.dmg, Math.atan2(this.P.y - e.y, this.P.x - e.x), ETYPE[e.type].isBoss ? 360 : 220);
        }
      }

      // Flare burn damage
      for (const f of this.flares) {
        if (f.landed && Math.hypot(f.x - e.x, f.y - e.y) < 58) {
          e.hp -= 12 * dt;
          if (e.hp <= 0) {
            this.killEnemy(e, -1.57, false);
            break;
          }
        }
      }
    }

    // Compact dead enemies after KO dissolve finishes
    let w = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].dead || this.enemies[i].koT > 0) {
        this.enemies[w++] = this.enemies[i];
      }
    }
    this.enemies.length = w;
  }

  private updBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      let dead = b.life <= 0;
      if (!dead && pointInObs(b.x, b.y, this.world.obs)) {
        dead = true;
        if (b.acid) {
          this.acidPools.push({ x: b.px, y: b.py, r: 28, life: 4.5, max: 4.5 });
        } else {
          this.sparks(b.px, b.py, Math.atan2(-b.vy, -b.vx), 4, b.cryo ? '#7df4ff' : '#ffe6a0', 220);
        }
      }

      if (!dead && b.fromEnemy) {
        if (segCircle(b.px, b.py, b.x, b.y, this.P.x, this.P.y, this.P.r + (b.r || 4))) {
          this.damagePlayer(b.dmg, Math.atan2(b.vy, b.vx), b.kb);
          if (b.acid) this.acidPools.push({ x: b.x, y: b.y, r: 28, life: 4.5, max: 4.5 });
          dead = true;
        }
      } else if (!dead) {
        // Check explosive O2 canisters & cryo CO2 fire extinguishers
        for (const can of this.world.canisters) {
          if (can.exploded) continue;
          if (segCircle(b.px, b.py, b.x, b.y, can.x, can.y, can.r + 3)) {
            this.detonateCanister(can);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const ext of this.world.extinguishers) {
            if (ext.triggered) continue;
            if (segCircle(b.px, b.py, b.x, b.y, ext.x, ext.y, ext.r + 3)) {
              this.triggerExtinguisher(ext);
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (segCircle(b.px, b.py, b.x, b.y, e.x, e.y, e.r + 3)) {
              if (b.cryo) {
                e.slowT = Math.max(e.slowT, 2.5);
                this.triggerCryoChain(e, b.dmg);
              }
              this.hitEnemy(e, b.dmg, Math.atan2(b.vy, b.vx), b.kb, false, b.grp);
              dead = true;
              break;
            }
          }
        }
      }

      if (dead) {
        this.bullets[i] = this.bullets[this.bullets.length - 1];
        this.bullets.pop();
      }
    }
  }

  private updGrenades(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      const k = Math.exp(-dt * 3.5);
      g.vx *= k;
      g.vy *= k;
      const col = collideEntity(g, 5, this.world.obs, WW, WH);
      if (col.hit) {
        g.vx *= -0.45;
        g.vy *= -0.45;
      }
      if (g.fuse <= 0) {
        this.explodeAt(g.x, g.y, 170, 175);
        this.grenades.splice(i, 1);
      }
    }
  }

  private updFlares(dt: number): void {
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.t += dt;
      f.life -= dt;
      if (!f.landed) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        const k = Math.exp(-dt * 3.2);
        f.vx *= k;
        f.vy *= k;
        if (collideEntity(f, 4, this.world.obs, WW, WH).hit) {
          f.vx = 0;
          f.vy = 0;
        }
        if (Math.hypot(f.vx, f.vy) < 25) {
          f.landed = true;
          this.ring(f.x, f.y, 4, 68, 0.35, '#ff9a3a');
        }
      }
      if (Math.random() < dt * 36) {
        this.spawnParticle({
          k: 's',
          x: f.x,
          y: f.y,
          vx: rnd(-35, 35),
          vy: rnd(-95, -20),
          life: rnd(0.2, 0.45),
          col: pick(['#ff9a3a', '#ffd27a', '#ff6a2a']),
          drag: 2,
        });
      }
      if (f.life <= 0) this.flares.splice(i, 1);
    }
  }

  private updAcidPools(dt: number): void {
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const a = this.acidPools[i];
      a.life -= dt;
      if (!this.G.dead && Math.hypot(this.P.x - a.x, this.P.y - a.y) < a.r + 6) {
        if (this.P.iT <= 0) {
          this.damagePlayer(7, rnd(0, TAU), 60);
        }
      }
      if (a.life <= 0) this.acidPools.splice(i, 1);
    }
  }

  private updItems(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      it.bob += dt * 4;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      const k = Math.exp(-dt * 5);
      it.vx *= k;
      it.vy *= k;
      const dx = this.P.x - it.x;
      const dy = this.P.y - it.y;
      const d = Math.hypot(dx, dy);
      if (d < 115 && !this.G.dead && d > 0.1) {
        const s = (1 - d / 115) * 480 + 110;
        it.x += (dx / d) * s * dt;
        it.y += (dy / d) * s * dt;
      }
      if (d < 24 && !this.G.dead) {
        if (it.t === 'hp') {
          if (this.P.hp >= this.P.maxHp) {
            it.life = Math.max(it.life, 1);
            continue;
          }
          this.P.hp = Math.min(this.P.maxHp, this.P.hp + 25);
          this.ftext(this.P.x, this.P.y - 20, '+25 HP', '#78e6a8', 14);
        } else if (it.t === 'ammo') {
          if (this.G.unlocked.cryo && Math.random() < 0.25) {
            this.G.ammo.cryo.res += 8;
            this.ftext(this.P.x, this.P.y - 20, '+8 CRYO', '#7df4ff', 14);
          } else if (this.G.unlocked.shotgun && Math.random() < 0.45) {
            this.G.ammo.shotgun.res += 4;
            this.ftext(this.P.x, this.P.y - 20, '+4 SHELLS', '#ffd27a', 14);
          } else {
            this.G.ammo.pistol.res += 14;
            this.G.ammo.smg.res += 16;
            this.ftext(this.P.x, this.P.y - 20, '+AMMO', '#ffd27a', 14);
          }
        } else if (it.t === 'bat') {
          this.P.bat = Math.min(100, this.P.bat + 45);
          this.ftext(this.P.x, this.P.y - 20, '+BATTERY', '#d4d07a', 14);
        } else if (it.t === 'scrap' || it.t === 'biogel' || it.t === 'cells' || it.t === 'fuel') {
          this.G.inventory[it.t] += 1;
          this.G.inventory.salvage += 15;
          this.ftext(this.P.x, this.P.y - 20, `+1 ${it.t.toUpperCase()}`, '#e0ae56', 13);
        }
        this.snd.play('pickup');
        this.ring(this.P.x, this.P.y, 6, 42, 0.28, '#fff');
        this.items.splice(i, 1);
        continue;
      }
      if (it.life <= 0) this.items.splice(i, 1);
    }
  }

  private updFx(dt: number): void {
    const dc = this.assets.decalCtx;
    for (let i = 0; i < this.capParts; i++) {
      const p = this.partPool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        if (p.k === 'b' && p.sz > 2.3) {
          dc.fillStyle = p.col;
          dc.globalAlpha = 0.5;
          dc.beginPath();
          dc.arc(p.x / 2, p.y / 2, p.sz * 0.52, 0, TAU);
          dc.fill();
          dc.globalAlpha = 1;
        }
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= k;
      p.vy *= k;
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      this.lights[i].life -= dt;
      if (this.lights[i].life <= 0) this.lights.splice(i, 1);
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].life -= dt;
      if (this.trails[i].life <= 0) this.trails.splice(i, 1);
    }
    for (let i = this.arcBolts.length - 1; i >= 0; i--) {
      this.arcBolts[i].life -= dt;
      if (this.arcBolts[i].life <= 0) this.arcBolts.splice(i, 1);
    }
  }

  private updPower(dt: number): void {
    const curSec = sectorAt(this.P.x, this.P.y);
    for (const k of SEC_ORDER) {
      const c = this.powerGrid[k];
      if (c.flick > 0) {
        c.flick -= dt;
        if (c.flick <= 0 && c.mode !== 'out') c.mode = 'on';
      }
      if (c.mode === 'out') {
        c.t -= dt;
        if (c.t <= 0) {
          c.mode = 'restore';
          c.t = 1.6;
        }
      } else if (c.mode === 'restore') {
        c.t -= dt;
        if (c.t <= 0) {
          c.mode = 'on';
          c.next = rnd(85, 145);
        }
      } else {
        c.next -= dt;
        if (c.next <= 0) {
          c.next = rnd(75, 140);
          // 45% chance a power surge trips the sector breaker into emergency blackout (with breaker reset)
          if (k !== 'WARDB' && Math.random() < 0.45 && this.G.time > 35) {
            c.mode = 'out';
            c.t = 24;
            c.flick = this.cfg.reduceFlash ? 0 : 0.8;
            if (k === curSec) {
              this.snd.play('deny');
              this.toast(`⚡ CIRCUIT TRIPPED IN ${SECTORS[k].label} — RESET BREAKER`);
            }
          } else if (!this.cfg.reduceFlash) {
            c.flick = rnd(0.8, 1.8);
          }
        }
      }
    }
  }

  private updDirector(dt: number): void {
    let nd = 1e9;
    let cnt = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      cnt++;
      const d = Math.hypot(e.x - this.P.x, e.y - this.P.y);
      if (d < nd) nd = d;
    }
    const threat = cnt ? clamp(1.15 - nd / 640, 0, 1) : 0;
    this.hd.noiseLvl = Math.max(0, this.hd.noiseLvl - dt * 0.2);
    const targetInt = threat > 0.7 ? 0.85 : threat > 0.4 ? 0.52 : Math.max(0.1, threat * 0.45);
    this.hd.intensity += (targetInt - this.hd.intensity) * Math.min(1, dt * 0.5);
    this.snd.setDrone(this.hd.intensity);

    // Horror Director peripheral shadow apparition in low-threat halls
    if (this.hd.figure) {
      this.hd.figure.t += dt;
      this.hd.figure.life -= dt;
      const dist = Math.hypot(this.hd.figure.x - this.P.x, this.hd.figure.y - this.P.y);
      const angTo = Math.atan2(this.hd.figure.y - this.P.y, this.hd.figure.x - this.P.x);
      const inBeam = this.P.flashOn && Math.abs(angdiff(angTo, this.P.face)) < 0.35 && dist < 340;
      if (inBeam || dist < 110 || this.hd.figure.life <= 0) {
        if (inBeam) this.dust(this.hd.figure.x, this.hd.figure.y, 6, 65);
        this.hd.figure = null;
      }
    } else {
      this.hd.evT -= dt;
      if (this.hd.evT <= 0) {
        this.hd.evT = rnd(18, 30);
        if (threat < 0.45) {
          const ang = this.P.face + (Math.random() < 0.5 ? 1 : -1) * rnd(0.9, 2.2);
          const fx = this.P.x + Math.cos(ang) * rnd(240, 340);
          const fy = this.P.y + Math.sin(ang) * rnd(240, 340);
          if (freeSpot(fx, fy, 16, this.world.obs, WW, WH)) {
            this.hd.figure = { x: fx, y: fy, life: 4.0, t: 0 };
          }
        }
      }
    }

    const sec = SECTORS[sectorAt(this.P.x, this.P.y)];
    this.snd.updateAmbience(sec.hum * 0.045, sec.vent * 0.055);
  }

  private updCamcorder(dt: number): void {
    if (!this.camc.on) {
      this.camc.bat = Math.min(100, this.camc.bat + dt * 0.9);
      return;
    }
    const batDrainMul = Math.pow(0.8, this.G.upgrades.bat);
    this.camc.bat = Math.max(0, this.camc.bat - dt * (this.camc.nv ? 1.5 : 0.7) * batDrainMul);
    if (this.camc.bat <= 0) {
      this.camc.on = false;
      this.camc.nv = false;
      this.toast('CAMCORDER BATTERY DEAD');
    }
    let nd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.P.x, e.y - this.P.y);
      if (d < nd) nd = d;
    }
    const target = nd > 700 ? 1 : clamp(1 - (700 - nd) / 520, 0.08, 1);
    this.camc.sig += (target - this.camc.sig) * Math.min(1, dt * 3);
  }

  private updUVMarks(): void {
    if (!this.camc.on || !this.camc.nv) return;
    for (const uv of this.world.uvMarks) {
      if (!uv.revealed && Math.hypot(this.P.x - uv.x, this.P.y - uv.y) < 250) {
        uv.revealed = true;
        if (!this.G.uvDigitsFound.includes(uv.digit)) {
          this.G.uvDigitsFound.push(uv.digit);
          this.G.score += 120;
          this.snd.play('pickup');
          this.toast(`UV CODE CLUE [#${uv.order}]: DIGIT "${uv.digit}"`);
        }
      }
    }
  }

  private updCam(dt: number): void {
    const z = this.effZoom();
    let ox = 0;
    let oy = 0;
    if (!this.touchMode) {
      ox = clamp(((this.mouse.x - this.W / 2) / z) * 0.18, -145, 145);
      oy = clamp(((this.mouse.y - this.H / 2) / z) * 0.18, -145, 145);
    } else if (this.look.active && this.look.firing) {
      ox = Math.cos(this.look.ang) * 70;
      oy = Math.sin(this.look.ang) * 70;
    }
    const k = 1 - Math.exp(-dt * 8.5);
    this.cam.x += (this.P.x + ox - this.cam.x) * k;
    this.cam.y += (this.P.y + oy - this.cam.y) * k;
    const hw = this.W / 2 / z;
    const hh = this.H / 2 / z;
    this.cam.x = hw * 2 >= WW ? WW / 2 : clamp(this.cam.x, hw, WW - hw);
    this.cam.y = hh * 2 >= WH ? WH / 2 : clamp(this.cam.y, hh, WH - hh);
  }

  private updECG(rdt: number): void {
    const bpmRate = this.P.hp < 35 ? 2.4 : this.P.sprinting ? 1.7 : 1.15;
    this.ecgPhase = (this.ecgPhase + rdt * bpmRate) % 1;
    let y = 0;
    if (this.ecgPhase > 0.12 && this.ecgPhase < 0.18) y = -0.3;
    else if (this.ecgPhase >= 0.22 && this.ecgPhase < 0.26) y = 0.25;
    else if (this.ecgPhase >= 0.26 && this.ecgPhase < 0.31) y = -1.0;
    else if (this.ecgPhase >= 0.31 && this.ecgPhase < 0.36) y = 0.55;
    else if (this.ecgPhase >= 0.44 && this.ecgPhase < 0.54) y = -0.22;
    this.ecgSamples.shift();
    this.ecgSamples.push(this.G.dead ? 0 : y);

    if (this.ecgCanvas) {
      const g = this.ecgCanvas.getContext('2d');
      if (g) {
        const w = this.ecgCanvas.width;
        const h = this.ecgCanvas.height;
        g.clearRect(0, 0, w, h);
        g.strokeStyle = this.P.hp < 35 ? '#ff4b4e' : this.P.hp < 65 ? '#e0ae56' : '#6de8a2';
        g.lineWidth = 1.6;
        g.beginPath();
        for (let i = 0; i < this.ecgSamples.length; i++) {
          const sx = (i / (this.ecgSamples.length - 1)) * w;
          const sy = h * 0.56 + this.ecgSamples[i] * (h * 0.36);
          if (i === 0) g.moveTo(sx, sy);
          else g.lineTo(sx, sy);
        }
        g.stroke();
      }
    }
  }

  /* ───────────── CANVAS 2D RENDERER ───────────── */
  private render(rdt: number): void {
    const ctx = this.ctx;
    const z = this.effZoom();
    let sx = 0;
    let sy = 0;
    if (this.G.trauma > 0) {
      const m = this.G.trauma * this.G.trauma * 16;
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }

    const s = this.DPR * z;
    const tx = (this.W / 2 - this.cam.x * z + sx) * this.DPR;
    const ty = (this.H / 2 - this.cam.y * z + sy) * this.DPR;
    const vx0 = this.cam.x - this.W / 2 / z - 90;
    const vx1 = this.cam.x + this.W / 2 / z + 90;
    const vy0 = this.cam.y - this.H / 2 / z - 90;
    const vy1 = this.cam.y + this.H / 2 / z + 90;
    const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04080a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(s, 0, 0, s, tx, ty);
    const sx0 = Math.max(0, Math.floor(vx0));
    const sy0 = Math.max(0, Math.floor(vy0));
    const sx1 = Math.min(WW, Math.ceil(vx1));
    const sy1 = Math.min(WH, Math.ceil(vy1));
    for (let i = 0; i < this.assets.floorTiles.length; i++) {
      const tile = this.assets.floorTiles[i];
      const ix0 = Math.max(sx0, tile.x);
      const iy0 = Math.max(sy0, tile.y);
      const ix1 = Math.min(sx1, tile.x + tile.w);
      const iy1 = Math.min(sy1, tile.y + tile.h);
      if (ix1 > ix0 && iy1 > iy0) {
        ctx.drawImage(
          tile.canvas,
          ix0 - tile.x,
          iy0 - tile.y,
          ix1 - ix0,
          iy1 - iy0,
          ix0,
          iy0,
          ix1 - ix0,
          iy1 - iy0,
        );
      }
    }
    const sw = Math.max(1, sx1 - sx0);
    const sh = Math.max(1, sy1 - sy0);
    ctx.drawImage(this.assets.decalC, sx0 * 0.5, sy0 * 0.5, sw * 0.5, sh * 0.5, sx0, sy0, sw, sh);

    const wTime = this.screen === 'title' ? this.G.menuT : this.G.time;

    // Animated water puddle ripples on floor leaks
    for (const lk of this.world.leaks) {
      if (!vis(lk.x, lk.y)) continue;
      ctx.save();
      ctx.translate(lk.x, lk.y);
      ctx.fillStyle = 'rgba(26,64,74,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 22, 0.25, 0, TAU);
      ctx.fill();
      const rp = (wTime * 0.85) % 1;
      ctx.strokeStyle = `rgba(135,220,235,${((1 - rp) * 0.45).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 + rp * 25, 4 + rp * 17, 0.25, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Acid pools
    for (const a of this.acidPools) {
      if (!vis(a.x, a.y)) continue;
      ctx.globalAlpha = clamp(a.life / a.max, 0, 1) * 0.65;
      ctx.fillStyle = '#6fe844';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#b4ff78';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Doors
    for (const d of this.world.doors) {
      ctx.save();
      ctx.fillStyle = '#1b292e';
      ctx.fillRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6);
      if (!d.open) {
        ctx.fillStyle = d.lockedKind ? '#54262b' : '#4a5d62';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = d.lockedKind ? '#ff5b5b' : '#d2b26a';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        ctx.fillStyle = d.lockedKind ? '#ff5b5b' : '#78e6a8';
        ctx.fillRect(d.x + d.w / 2 - 4, d.y + d.h / 2 - 2, 8, 4);
      } else {
        ctx.fillStyle = 'rgba(105,210,180,.22)';
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }
      ctx.restore();
    }

    // UV hidden clues (drawn faintly normally, bright neon violet/cyan under Camcorder NV)
    for (const uv of this.world.uvMarks) {
      if (!vis(uv.x, uv.y)) continue;
      const nvOn = this.camc.on && this.camc.nv;
      if (nvOn || uv.revealed) {
        ctx.save();
        ctx.fillStyle = nvOn ? '#6ef7ff' : 'rgba(110,247,255,0.28)';
        ctx.font = 'bold 20px Consolas,monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`UV#${uv.order}:${uv.digit}`, uv.x, uv.y);
        ctx.restore();
      }
    }

    // Live pulsing monitors & cryopods + sweeping CCTV cameras
    for (const prop of this.world.props) {
      if (!vis(prop.x, prop.y)) continue;
      if (prop.kind === 'monitor') {
        const pulse = 0.55 + 0.45 * Math.sin(wTime * 4.5 + prop.x);
        ctx.fillStyle = `rgba(92,235,215,${(0.35 * pulse).toFixed(2)})`;
        ctx.fillRect(prop.x - prop.w / 2 + 6, prop.y - prop.h / 2 + 5, prop.w - 12, prop.h * 0.46);
      } else if (prop.kind === 'cryopod') {
        const pulse = 0.5 + 0.5 * Math.sin(wTime * 2.4 + prop.y);
        ctx.save();
        ctx.translate(prop.x, prop.y);
        ctx.fillStyle = `rgba(80,225,245,${(0.18 + 0.16 * pulse).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(0, 0, prop.w * 0.25, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(15,35,44,0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 11, 0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (prop.kind === 'camera') {
        const sweep = (prop.rot || 0.7) + Math.sin(wTime * 0.9 + prop.x) * 0.55;
        ctx.save();
        ctx.translate(prop.x, prop.y);
        ctx.fillStyle = 'rgba(255,75,78,0.06)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 125, sweep - 0.32, sweep + 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#243238';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fill();
        if (((wTime * 2) | 0) % 2 === 0) {
          ctx.fillStyle = '#ff4b4e';
          ctx.fillRect(Math.cos(sweep) * 5 - 1.5, Math.sin(sweep) * 5 - 1.5, 3, 3);
        }
        ctx.restore();
      }
    }

    // Red Explosive O2 Canisters
    for (const c of this.world.canisters) {
      if (c.exploded || !vis(c.x, c.y)) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath();
      ctx.arc(2, 3, c.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b92626';
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff9878';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd27a';
      ctx.font = 'bold 9px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.fillText('O2', 0, 3);
      ctx.restore();
    }

    // Shootable CO2 Cryo Fire Extinguishers
    for (const ext of this.world.extinguishers) {
      if (!vis(ext.x, ext.y)) continue;
      ctx.save();
      ctx.translate(ext.x, ext.y);
      if (ext.triggered) {
        ctx.fillStyle = 'rgba(65,95,105,0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, ext.r * 0.7, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.beginPath();
        ctx.arc(2, 3, ext.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#d12c2c';
        ctx.beginPath();
        ctx.arc(0, 0, ext.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8ef0ff';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = '#dce6e8';
        ctx.fillRect(-3, -ext.r - 2, 6, 4);
        ctx.fillStyle = '#e8fbff';
        ctx.font = 'bold 8px Consolas,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CO2', 0, 3);
      }
      ctx.restore();
    }

    // Industrial Floor & Wall Vents
    for (const [vx, vy] of this.world.vents) {
      if (!vis(vx, vy)) continue;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.fillStyle = '#182429';
      ctx.fillRect(-16, -12, 32, 24);
      ctx.strokeStyle = '#485d64';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-16, -12, 32, 24);
      ctx.fillStyle = '#0c1417';
      for (let slat = -7; slat <= 7; slat += 5) {
        ctx.fillRect(-12, slat - 1, 24, 2.5);
      }
      ctx.restore();
    }

    // Circuit Breaker Panels
    for (const b of this.world.breakers) {
      if (!vis(b.x, b.y)) continue;
      const out = this.powerGrid[b.sector]?.mode === 'out';
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = '#253136';
      ctx.fillRect(-11, -13, 22, 26);
      ctx.strokeStyle = out ? '#ff4b4e' : '#5cbab5';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-11, -13, 22, 26);
      ctx.fillStyle = out ? (((wTime * 5) | 0) % 2 === 0 ? '#ff4b4e' : '#631418') : '#78e6a8';
      ctx.beginPath();
      ctx.arc(0, -5, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e0ae56';
      ctx.fillRect(-6, 2, 12, 6);
      ctx.restore();
    }

    // Terminals, Med stations & Lockers
    for (const t of this.world.terminals) {
      if (!vis(t.x, t.y)) continue;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-13, -8, 30, 22);
      ctx.fillStyle = '#182b33';
      ctx.fillRect(-15, -11, 30, 22);
      ctx.strokeStyle = t.used ? '#446868' : '#7fe6de';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-15, -11, 30, 22);
      ctx.fillStyle = t.used ? '#2e4a4a' : '#409e99';
      ctx.fillRect(-11, -7, 22, 13);
      if (!t.used) {
        ctx.fillStyle = '#aef7ef';
        ctx.fillRect(-8, -4, 10 + Math.sin(wTime * 4) * 4, 2);
        ctx.fillRect(-8, 0, 14, 2);
      }
      ctx.restore();
    }
    for (const m of this.world.medStations) {
      if (!vis(m.x, m.y)) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-11, -11, 26, 26);
      ctx.fillStyle = m.used ? '#293538' : '#183b42';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = m.used ? '#4b5a5c' : '#78e6a8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.fillStyle = m.used ? '#556565' : '#e4f1e7';
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
      ctx.restore();
    }
    for (const o of this.world.locks) {
      ctx.fillStyle = o.used ? '#6e2326' : '#52e098';
      ctx.fillRect(o.x + o.w / 2 - 4, o.y + o.h / 2 - 4, 8, 8);
      if (!o.used) {
        ctx.strokeStyle = '#a4ffd0';
        ctx.lineWidth = 1;
        ctx.strokeRect(o.x + o.w / 2 - 6, o.y + o.h / 2 - 6, 12, 12);
      }
    }

    // Docs & detailed Drops
    for (const d of this.world.docs) {
      if (!vis(d.x, d.y)) continue;
      ctx.save();
      ctx.translate(d.x, d.y + Math.sin(d.t * 3) * 1.5);
      ctx.rotate(0.25);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-7, -9, 18, 22);
      ctx.fillStyle = '#e8e4d2';
      ctx.fillRect(-9, -11, 18, 22);
      ctx.fillStyle = '#9c262a';
      ctx.fillRect(-9, -11, 18, 4);
      ctx.fillStyle = '#555';
      for (let i = 0; i < 3; i++) ctx.fillRect(-6, -4 + i * 5, 12, 1.5);
      ctx.restore();
    }

    for (const it of this.items) {
      if (!vis(it.x, it.y)) continue;
      const y = it.y + Math.sin(it.bob) * 2.5;
      ctx.save();
      ctx.translate(it.x, y);
      if (it.t === 'hp') {
        ctx.fillStyle = '#eef2ee';
        ctx.fillRect(-9, -8, 18, 16);
        ctx.strokeStyle = '#243034';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-9, -8, 18, 16);
        ctx.fillStyle = '#d22';
        ctx.fillRect(-2.5, -5.5, 5, 11);
        ctx.fillRect(-5.5, -2.5, 11, 5);
      } else if (it.t === 'ammo') {
        ctx.fillStyle = '#5f4f1d';
        ctx.fillRect(-9, -6, 18, 12);
        ctx.strokeStyle = '#e8c15a';
        ctx.lineWidth = 1;
        ctx.strokeRect(-9, -6, 18, 12);
        ctx.fillStyle = '#e8c15a';
        ctx.fillRect(-6, -4, 3, 8);
        ctx.fillRect(-1, -4, 3, 8);
        ctx.fillRect(4, -4, 3, 8);
      } else if (it.t === 'bat') {
        ctx.fillStyle = '#1b262a';
        ctx.fillRect(-6, -8, 12, 16);
        ctx.fillStyle = '#e8c84b';
        ctx.fillRect(-6, -4, 12, 6);
      } else if (it.t === 'biogel') {
        ctx.fillStyle = '#173b24';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#78e6a8';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, TAU);
        ctx.fill();
      } else if (it.t === 'cells') {
        ctx.fillStyle = '#14323b';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#62e8ff';
        ctx.fillRect(-4, -4, 8, 8);
      } else if (it.t === 'fuel') {
        ctx.fillStyle = '#7d1c1c';
        ctx.fillRect(-7, -8, 14, 16);
        ctx.fillStyle = '#ff9a3a';
        ctx.fillRect(-4, -4, 8, 8);
      } else {
        ctx.fillStyle = '#25353c';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#e0ae56';
        ctx.fillRect(-4, -4, 8, 8);
      }
      ctx.restore();
    }

    for (const f of this.flares) {
      ctx.fillStyle = '#ff4b4e';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4.5, 0, TAU);
      ctx.fill();
    }
    for (const g of this.grenades) {
      ctx.fillStyle = '#62a866';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 5.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffdf6b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Dash trails
    for (const t of this.trails) {
      ctx.globalAlpha = (t.life / 0.22) * 0.35;
      ctx.fillStyle = '#69bdf7';
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 15, 12, t.f, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Enemies
    for (const e of this.enemies) {
      if (vis(e.x, e.y)) this.drawEnemy(ctx, e);
    }

    // Horror Director Peripheral Shadow Apparition
    if (this.hd.figure && this.screen === 'playing' && vis(this.hd.figure.x, this.hd.figure.y)) {
      const fg = this.hd.figure;
      ctx.save();
      ctx.translate(fg.x, fg.y);
      ctx.globalAlpha = clamp(fg.life / 1.5, 0, 0.52);
      ctx.fillStyle = '#080e12';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 16, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff4b4e';
      ctx.fillRect(3, -4, 2.2, 2.2);
      ctx.fillRect(3, 2, 2.2, 2.2);
      ctx.restore();
    }

    // Rayhit-clamped tactical laser sight for ranged guns when playing
    if (this.screen === 'playing' && !this.G.dead && this.P.wpn !== 'bat' && this.P.wpn !== 'flare') {
      const startX = this.P.x + Math.cos(this.P.face) * 26;
      const startY = this.P.y + Math.sin(this.P.face) * 26;
      const beamDist = rayHit(this.P.x, this.P.y, this.P.aim, 340, this.world.obs);
      const endX = this.P.x + Math.cos(this.P.aim) * beamDist;
      const endY = this.P.y + Math.sin(this.P.aim) * beamDist;
      ctx.save();
      ctx.strokeStyle = this.P.wpn === 'cryo' ? 'rgba(98,232,255,0.28)' : 'rgba(255,75,78,0.24)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.P.wpn === 'cryo' ? '#62e8ff' : '#ff4b4e';
      ctx.beginPath();
      ctx.arc(endX, endY, 2.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.screen !== 'title') {
      this.drawPlayer(ctx);
    }

    // Overhead spinning ceiling fans
    for (const prop of this.world.props) {
      if (prop.kind !== 'ceiling_fan' || !vis(prop.x, prop.y)) continue;
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(wTime * 3.4);
      ctx.fillStyle = 'rgba(8,14,17,0.34)';
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(5, -4, prop.w * 0.42, 8);
      }
      ctx.fillStyle = 'rgba(60,78,84,0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    ctx.lineCap = 'round';
    for (const b of this.bullets) {
      ctx.strokeStyle = b.acid ? '#9cf542' : b.cryo ? '#7df4ff' : 'rgba(255,230,160,.94)';
      ctx.lineWidth = b.acid ? 4 : 2.3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.028, b.y - b.vy * 0.028);
      ctx.stroke();
    }

    // Arc lightning bolts
    for (const bolt of this.arcBolts) {
      ctx.strokeStyle = bolt.col;
      ctx.globalAlpha = bolt.life / bolt.max;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      bolt.pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Smoke before darkness
    for (let i = 0; i < this.capParts; i++) {
      const p = this.partPool[i];
      if (!p.active || p.k !== 'd') continue;
      const a = p.life / p.max;
      ctx.fillStyle = `rgba(170,192,196,${a * 0.28})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sz * (1 + (1 - a) * 2.1), 0, TAU);
      ctx.fill();
    }

    /* ── Raycast-Occluded Darkness Layer with Architectural Room Lights ── */
    const dctx = this.darkCtx;
    const ds = this.DS * this.DPR * z;
    const dtx = (this.W / 2 - this.cam.x * z + sx) * this.DPR * this.DS;
    const dty = (this.H / 2 - this.cam.y * z + sy) * this.DPR * this.DS;
    const psec = sectorAt(this.P.x, this.P.y);
    const pc = this.powerGrid[psec] || { mode: 'on', flick: 0 };
    let baseA =
      0.66 -
      ((this.cfg.brightness - 50) / 100) * 0.24 +
      (this.screen === 'title' ? -0.18 : 0);
    if (pc.mode === 'out') baseA = 0.84;
    if (pc.flick > 0 && !this.cfg.reduceFlash) baseA += Math.random() < 0.5 ? rnd(-0.05, 0.05) : 0;
    baseA = clamp(baseA, 0.40, 0.90);

    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = `rgba(3,7,10,${baseA.toFixed(3)})`;
    dctx.fillRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);

    dctx.globalCompositeOperation = 'destination-out';
    dctx.setTransform(ds, 0, 0, ds, dtx, dty);
    const cut = (x: number, y: number, r: number, a: number) => {
      dctx.globalAlpha = a;
      dctx.drawImage(this.assets.cutGlow, x - r, y - r, r * 2, r * 2);
    };

    // Powered Architectural Ceiling Lights across St. Jude Hospital
    for (const cl of this.world.ceilingLights) {
      if (!vis(cl.x, cl.y)) continue;
      const secState = this.powerGrid[cl.sector];
      let strength = this.screen === 'title' ? 0.92 : 0.72;
      if (secState?.mode === 'out') {
        strength = 0.14;
      } else if (cl.flicker && !this.cfg.reduceFlash) {
        const flWave = Math.sin(wTime * 9 + cl.x) * Math.cos(wTime * 17);
        if (flWave < -0.55) strength *= 0.35;
      }
      cut(cl.x, cl.y, cl.r, strength);
    }

    cut(this.P.x, this.P.y, this.screen === 'title' ? 360 : 215, 0.95);
    dctx.globalAlpha = 1;

    if (this.P.flashOn && this.screen !== 'title') {
      const range = 340 + 150 * clamp(this.P.bat / 25, 0, 1);
      for (const [half, al] of [
        [0.64, 0.56],
        [0.36, 0.96],
      ] as [number, number][]) {
        const pts = lightPoly(
          this.P.x,
          this.P.y,
          this.P.face,
          half,
          range,
          Math.max(10, half < 0.5 ? (this.lightRays * 0.7) | 0 : this.lightRays),
          this.world.obs,
        );
        const g = dctx.createRadialGradient(this.P.x, this.P.y, 10, this.P.x, this.P.y, range);
        g.addColorStop(0, `rgba(0,0,0,${al})`);
        g.addColorStop(0.7, `rgba(0,0,0,${al * 0.8})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.beginPath();
        dctx.moveTo(this.P.x, this.P.y);
        for (const p of pts) dctx.lineTo(p[0], p[1]);
        dctx.closePath();
        dctx.fill();
      }
    }

    if (this.camc.on && this.camc.nv) {
      const pts = lightPoly(this.P.x, this.P.y, 0, Math.PI, 280, this.lightRays, this.world.obs);
      const g = dctx.createRadialGradient(this.P.x, this.P.y, 12, this.P.x, this.P.y, 280);
      g.addColorStop(0, 'rgba(0,0,0,.78)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.moveTo(this.P.x, this.P.y);
      for (const p of pts) dctx.lineTo(p[0], p[1]);
      dctx.closePath();
      dctx.fill();
    }

    for (const f of this.flares) cut(f.x, f.y, f.landed ? 290 + Math.sin(f.t * 28) * 14 : 120, 0.95);
    for (const l of this.lights) cut(l.x, l.y, l.r, l.life / l.max);
    for (const t of this.world.terminals) if (vis(t.x, t.y)) cut(t.x, t.y, 82, 0.65);
    for (const m of this.world.medStations) if (!m.used && vis(m.x, m.y)) cut(m.x, m.y, 64, 0.55);
    for (const c of this.world.canisters) if (!c.exploded && vis(c.x, c.y)) cut(c.x, c.y, 58, 0.52);
    for (const d of this.world.docs) if (vis(d.x, d.y)) cut(d.x, d.y, 68, 0.72);
    dctx.globalAlpha = 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.darkCanvas, 0, 0, this.canvas.width, this.canvas.height);

    /* ── Post-Darkness Emissive Glows, Waypoints, Scent Radar & Particles ── */
    ctx.setTransform(s, 0, 0, s, tx, ty);
    ctx.globalCompositeOperation = 'lighter';
    for (const cl of this.world.ceilingLights) {
      if (!vis(cl.x, cl.y)) continue;
      const out = this.powerGrid[cl.sector]?.mode === 'out';
      if (out) {
        const pulse = 0.25 + 0.25 * Math.sin(wTime * 5 + cl.x);
        ctx.globalAlpha = pulse;
        ctx.drawImage(this.assets.redGlow, cl.x - 105, cl.y - 105, 210, 210);
      } else {
        ctx.globalAlpha = this.screen === 'title' ? 0.16 : 0.11;
        const spr = cl.color === 'cyan' || cl.color === 'teal' || cl.color === 'cold' ? this.assets.cyanGlow : this.assets.glowSprite;
        ctx.drawImage(spr, cl.x - cl.r * 0.65, cl.y - cl.r * 0.65, cl.r * 1.3, cl.r * 1.3);
      }
    }
    for (const prop of this.world.props) {
      if (!vis(prop.x, prop.y)) continue;
      if (prop.kind === 'bio_tank' || prop.kind === 'cryopod' || prop.kind === 'xray_box') {
        ctx.globalAlpha = 0.22 + 0.08 * Math.sin(wTime * 2.6 + prop.x);
        ctx.drawImage(this.assets.cyanGlow, prop.x - 56, prop.y - 56, 112, 112);
      } else if (prop.kind === 'desk_lamp') {
        ctx.globalAlpha = 0.28;
        ctx.drawImage(this.assets.glowSprite, prop.x - 55, prop.y - 55, 110, 110);
      }
    }
    for (const f of this.flares) {
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(f.t * 28);
      ctx.drawImage(this.assets.glowSprite, f.x - 70, f.y - 70, 140, 140);
    }
    for (const l of this.lights) {
      ctx.globalAlpha = (l.life / l.max) * 0.85;
      const r = l.r * 0.45;
      const sprite = l.col === 'cyan' ? this.assets.cyanGlow : l.col === 'red' ? this.assets.redGlow : this.assets.glowSprite;
      ctx.drawImage(sprite, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    // Glowing enemy eyes in the dark
    for (const e of this.enemies) {
      if (e.dead || !vis(e.x, e.y) || e.appear < 0.6 || (e.type === 'stalker' && e.cloak < 0.4)) continue;
      ctx.fillStyle = ECOL[e.type].eye;
      const c = Math.cos(e.ang);
      const sn = Math.sin(e.ang);
      const sz = ETYPE[e.type].isBoss ? 4.2 : 2.6;
      for (const sd of [-1, 1]) {
        ctx.fillRect(
          e.x + c * e.r * 0.7 - sn * sd * e.r * 0.24 - sz / 2,
          e.y + sn * e.r * 0.7 + c * sd * e.r * 0.24 - sz / 2,
          sz,
          sz,
        );
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Scent Scan Sonar Waves & Chemical Trace Glyph Marker
    if (this.scent.scanning > 0) {
      const p = 1 - this.scent.scanning / 1.1;
      for (let ring = 0; ring < 2; ring++) {
        const rp = (p + ring * 0.45) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - rp) * 0.75;
        ctx.strokeStyle = '#5cbab5';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(this.P.x, this.P.y, 18 + rp * 190, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.scent.mark) {
      const m = this.scent.mark;
      const cSpec = CLUES[m.clue];
      ctx.save();
      ctx.globalAlpha = clamp(m.t / 0.6, 0, 1);
      ctx.strokeStyle = cSpec.col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 34 + (1.8 - m.t) * 14, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = cSpec.col;
      ctx.font = 'bold 14px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${cSpec.glyph} ${cSpec.name}`, m.x, m.y - 36);
      ctx.restore();
    }

    // Story Objective Directional Waypoint Ring around player
    const wp = this.getActiveWaypoint();
    if (wp && this.screen === 'playing') {
      const dist = Math.hypot(wp.x - this.P.x, wp.y - this.P.y);
      if (dist > 140) {
        const ang = Math.atan2(wp.y - this.P.y, wp.x - this.P.x);
        const rx = this.P.x + Math.cos(ang) * 56;
        const ry = this.P.y + Math.sin(ang) * 56;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(224,174,86,.88)';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Render Pooled Particles (blood, sparks, shells, rings)
    for (let i = 0; i < this.capParts; i++) {
      const p = this.partPool[i];
      if (!p.active || p.k === 'd') continue;
      const a = p.life / p.max;
      if (p.k === 'b') {
        ctx.globalAlpha = Math.min(1, p.life / 0.15);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.sz, 0, TAU);
        ctx.fill();
      } else if (p.k === 's') {
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.k === 'sh') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + (1 - a) * 12);
        ctx.fillStyle = p.col;
        ctx.fillRect(-2.5, -1.2, 5, 2.4);
        ctx.restore();
      } else if (p.k === 'r') {
        const rr = lerp(p.r1, p.r2, 1 - a);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 2.6 * a + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Floating combat numbers
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const age = t.max - t.life;
      const sc = 1 + Math.max(0, 0.55 * (1 - age * 7));
      ctx.globalAlpha = Math.min(1, t.life / 0.25);
      ctx.font = `700 ${Math.round(t.size * sc)}px Consolas,monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.col;
      ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    /* ── Screen-Space Grade, Night Vision & Crosshair ── */
    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    const sectorSpec = SECTORS[psec];
    const targetTintA = sectorSpec.tintA * (this.cfg.colorStrength / 75) * 0.45;
    this.tintRender.a += (targetTintA - this.tintRender.a) * 0.05;
    for (let i = 0; i < 3; i++) {
      this.tintRender.c[i] += (sectorSpec.tint[i] - this.tintRender.c[i]) * 0.05;
    }
    if (this.tintRender.a > 0.005) {
      ctx.fillStyle = `rgba(${this.tintRender.c[0] | 0},${this.tintRender.c[1] | 0},${this.tintRender.c[2] | 0},${this.tintRender.a.toFixed(3)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    if (this.camc.on && this.camc.nv) {
      ctx.fillStyle = 'rgba(40,185,85,.14)';
      ctx.fillRect(0, 0, this.W, this.H);
    }

    if (this.cfg.grain !== 'off' && this.assets.grainTiles.length > 0 && !this.cfg.reduceMotion) {
      const tile = this.assets.grainTiles[((wTime * 18) | 0) % this.assets.grainTiles.length];
      ctx.save();
      ctx.globalAlpha = this.cfg.grain === 'high' ? 0.08 : 0.035;
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      ctx.restore();
    }

    if ((this.screen === 'playing' || this.screen === 'wheel') && !this.G.dead) {
      this.drawReticle(ctx, z);
    }

    if (this.perfFrames % 3 === 0) {
      this.drawMiniMap();
    }
    if (this.screen === 'map' && this.facilityCanvas && this.perfFrames % 3 === 0) {
      this.drawFacilityMap(this.facilityCanvas);
    }
    void rdt;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.P.x, this.P.y);
    ctx.fillStyle = 'rgba(0,0,0,.44)';
    ctx.beginPath();
    ctx.ellipse(2, 4, this.P.r * 1.15, this.P.r * 1.02, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(this.P.face);
    if (this.P.iT > 0 && ((this.P.iT * 20) | 0) % 2 && this.P.dashT <= 0) ctx.globalAlpha = 0.45;
    if (this.P.dashT > 0) ctx.scale(1.22, 0.86);
    const speedRatio = Math.min(1, Math.hypot(this.P.vx, this.P.vy) / 180);
    const bob = Math.sin(this.P.step * 0.18) * speedRatio * 2.2;
    const stride = Math.sin(this.P.step * 0.24) * speedRatio * 5.2;
    const rec = this.P.recoil * 4;

    // Animated striding boots
    ctx.fillStyle = '#0e161a';
    ctx.fillRect(-3 + stride, -9, 7, 5);
    ctx.fillRect(-3 - stride, 4, 7, 5);

    // Sleeves & foregrip arms
    ctx.strokeStyle = '#203642';
    ctx.lineWidth = 5.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(15 - rec, -2 + bob * 0.3);
    ctx.moveTo(0, 11);
    ctx.lineTo(15 - rec, 3 - bob * 0.3);
    ctx.stroke();

    // Active Weapon Model
    const w = this.P.wpn;
    if (w === 'pistol') {
      ctx.fillStyle = '#1b1f22';
      ctx.fillRect(12 - rec, -3, 17, 6);
      ctx.fillStyle = '#536068';
      ctx.fillRect(13 - rec, -2.5, 14, 2.2);
    } else if (w === 'shotgun' || w === 'smg') {
      ctx.fillStyle = w === 'smg' ? '#1e272c' : '#3a281c';
      ctx.fillRect(8 - rec, -3.5, 28, 6.5);
      ctx.fillStyle = w === 'smg' ? '#e0ae56' : '#6b787e';
      ctx.fillRect(18 - rec, -2, 15, 2.5);
      if (w === 'smg') {
        ctx.fillStyle = '#141a1d';
        ctx.fillRect(19 - rec, 2, 4, 6);
      }
    } else if (w === 'cryo') {
      ctx.fillStyle = '#182b34';
      ctx.fillRect(8 - rec, -4.5, 30, 9);
      ctx.fillStyle = '#62e8ff';
      ctx.fillRect(14 - rec, -2, 22, 3.2);
      ctx.fillStyle = '#204a58';
      ctx.fillRect(10 - rec, -6, 9, 3);
    } else if (w === 'bat') {
      const t = this.P.swing > 0 ? 1 - this.P.swing / 0.2 : 0;
      ctx.save();
      const base = this.P.swing > 0 ? (this.P.swingDir > 0 ? -1.4 + t * 2.8 : 1.4 - t * 2.8) : -0.5;
      ctx.translate(10, 4);
      ctx.rotate(base);
      ctx.fillStyle = '#7b8a92';
      ctx.fillRect(0, -2.5, 42, 5);
      ctx.fillStyle = '#62e8ff';
      ctx.fillRect(28, -3.2, 14, 6.4);
      ctx.restore();
    } else {
      ctx.fillStyle = '#d33';
      ctx.fillRect(14, -2.5, 13, 5);
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(25, -2.5, 3, 5);
    }

    // Security Officer Jacket, Armored Pauldrons & Radio LED
    ctx.fillStyle = '#233b47';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.8, 15.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1c2f38';
    ctx.fillRect(-5, -15, 10, 6);
    ctx.fillRect(-5, 9, 10, 6);
    ctx.fillStyle = '#335769';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 5.8, 12.2, 0, 0, TAU);
    ctx.fill();
    // Vest utility stripe, radio antenna & utility pack
    ctx.fillStyle = '#15232a';
    ctx.fillRect(-8, -9, 4, 18);
    ctx.fillStyle = '#5cbab5';
    ctx.fillRect(-3, -13, 3, 5);
    ctx.fillStyle = '#e0ae56';
    ctx.fillRect(-7, 6, 3, 3);

    // Head, Security Cap & Visor Trim
    ctx.fillStyle = '#d9b99b';
    ctx.beginPath();
    ctx.arc(2.5, 0, 7.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#141c20';
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = '#263842';
    ctx.fillRect(2, -5.5, 5, 11);
    ctx.fillStyle = '#e0ae56';
    ctx.fillRect(4.5, -2, 2, 4);
    if (this.P.flashOn) {
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(11, 8, 5, 3.2);
    }
    if (this.P.flash > 0 && w !== 'bat' && w !== 'flare') {
      const tx = w === 'shotgun' || w === 'cryo' ? 42 : 31;
      ctx.fillStyle = w === 'cryo' ? '#7df4ff' : '#fff2b0';
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx + 13, -5.5);
      ctx.lineTo(tx + 21, 0);
      ctx.lineTo(tx + 13, 5.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyEntity): void {
    const r = e.r;
    const C = ECOL[e.type];
    const fl = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.dead) {
      const fade = clamp(e.koT / 0.35, 0, 1);
      ctx.globalAlpha = fade;
      ctx.scale(1.18 - fade * 0.18, 0.85);
    } else if (e.appear < 1) {
      ctx.globalAlpha = e.appear;
    } else if (e.type === 'stalker') {
      ctx.globalAlpha = e.cloak;
    }

    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath();
    ctx.ellipse(2, 4, r * 1.08, r * 0.94, 0, 0, TAU);
    ctx.fill();
    ctx.rotate(e.ang);
    ctx.scale(1 + e.sq * 0.35, 1 - e.sq * 0.25);

    const sw = Math.sin(e.t * (e.type === 'runner' || e.type === 'crawler' ? 14 : 7));
    const reach = e.st === 'wind' ? 1.85 : 1.45;

    // Crawler 6 chitinous legs
    if (e.type === 'crawler' && !fl) {
      ctx.strokeStyle = C.skin;
      ctx.lineWidth = 2.6;
      for (const sgn of [-1, 1]) {
        for (let k = -1; k <= 1; k++) {
          const w = Math.sin(e.t * 15 + k * 2 + sgn) * 4;
          ctx.beginPath();
          ctx.moveTo(k * r * 0.35, sgn * r * 0.6);
          ctx.lineTo(k * r * 0.55 + w, sgn * r * 1.35);
          ctx.stroke();
        }
      }
    }

    // Omega writhing tentacles
    if (e.type === 'omega' && !fl) {
      ctx.strokeStyle = '#a81c2c';
      ctx.lineWidth = 5;
      for (let k = -1; k <= 1; k++) {
        const wag = Math.sin(e.t * 5 + k * 1.7) * 9;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, k * r * 0.45);
        ctx.quadraticCurveTo(-r * 1.1, k * r * 0.7 + wag, -r * 1.55, k * r * 0.5 - wag);
        ctx.stroke();
      }
    }

    // Reaching arms / Chirurgeon scalpels / Warden iron maul
    ctx.strokeStyle = fl ? '#fff' : C.skin;
    ctx.lineWidth = r * 0.36;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.8);
    ctx.lineTo(r * reach, -r * 0.5 + sw * r * 0.25);
    ctx.moveTo(r * 0.1, r * 0.8);
    ctx.lineTo(r * reach, r * 0.5 - sw * r * 0.25);
    ctx.stroke();

    if (!fl && e.type === 'chirurgeon') {
      ctx.fillStyle = '#cfe4ea';
      ctx.fillRect(r * reach - 2, -r * 0.62 + sw * r * 0.25, 14, 3);
      ctx.fillRect(r * reach - 2, r * 0.44 - sw * r * 0.25, 14, 3);
    } else if (!fl && e.type === 'warden') {
      ctx.fillStyle = '#73828a';
      ctx.fillRect(r * 1.25, r * 0.25, 16, 12);
      ctx.fillStyle = '#e0ae56';
      ctx.fillRect(r * 1.25, r * 0.25, 4, 12);
    }

    // Torso silhouette
    ctx.fillStyle = fl ? '#fff' : C.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.84, r, 0, 0, TAU);
    ctx.fill();

    if (!fl) {
      ctx.fillStyle = C.stain;
      ctx.beginPath();
      ctx.arc(-r * 0.2, r * 0.25, r * 0.34, 0, TAU);
      ctx.fill();

      if (e.type === 'spitter' || e.type === 'chirurgeon') {
        const pulse = e.st === 'spitWind' ? 1.25 : 0.95 + Math.sin(e.t * 6) * 0.12;
        ctx.fillStyle = '#6fe844';
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.42, r * 0.28 * pulse, 0, TAU);
        ctx.arc(-r * 0.35, r * 0.42, r * 0.28 * pulse, 0, TAU);
        ctx.fill();
      } else if (e.type === 'riot') {
        ctx.fillStyle = '#33444b';
        ctx.fillRect(r * 0.34, -r * 0.92, r * 0.36, r * 1.84);
        ctx.fillStyle = '#9aa8ae';
        ctx.fillRect(r * 0.4, -r * 0.82, r * 0.16, r * 1.64);
        ctx.fillStyle = '#62e8ff';
        ctx.fillRect(r * 0.42, -r * 0.28, r * 0.12, r * 0.56);
      } else if (e.type === 'warden') {
        ctx.fillStyle = '#e0ae56';
        ctx.fillRect(-r * 0.45, -r * 0.95, r * 0.35, r * 1.9);
        ctx.fillStyle = '#242e33';
        ctx.fillRect(-r * 0.15, -r * 0.8, r * 0.32, r * 1.6);
      } else if (e.type === 'omega') {
        ctx.fillStyle = '#ff4b4e';
        ctx.beginPath();
        ctx.arc(-r * 0.1, 0, r * 0.42, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2, 0, TAU);
        ctx.fill();
      }
    }

    // Head
    ctx.fillStyle = fl ? '#fff' : C.skin;
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, r * 0.54, 0, TAU);
    ctx.fill();
    if (e.slowT > 0) {
      ctx.strokeStyle = 'rgba(110,235,255,.82)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    ctx.restore();

    if (!e.dead && (e.st === 'wind' || e.st === 'spitWind' || e.st === 'novaWind')) {
      ctx.strokeStyle = e.st === 'spitWind' ? '#9cf542' : '#ff4040';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 9, 0, TAU);
      ctx.stroke();
      if (e.st === 'wind') {
        ctx.strokeStyle = 'rgba(255,60,40,.28)';
        ctx.lineWidth = r * 1.4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + e.cdx * 290, e.y + e.cdy * 290);
        ctx.stroke();
      }
    }

    if (!e.dead && e.bar > 0 && !ETYPE[e.type].isBoss) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(e.x - r, e.y - r - 9, w, 3.5);
      ctx.fillStyle = '#ff4b4e';
      ctx.fillRect(e.x - r, e.y - r - 9, w * clamp(e.hp / e.maxHp, 0, 1), 3.5);
    }
  }

  private drawReticle(ctx: CanvasRenderingContext2D, z: number): void {
    const psx = this.W / 2 + (this.P.x - this.cam.x) * z;
    const psy = this.H / 2 + (this.P.y - this.cam.y) * z;
    const cx = this.touchMode ? psx + Math.cos(this.P.aim) * 120 : this.mouse.x;
    const cy = this.touchMode ? psy + Math.sin(this.P.aim) * 120 : this.mouse.y;

    let over = false;
    if (!this.touchMode) {
      const wx = this.cam.x + (this.mouse.x - this.W / 2) / z;
      const wy = this.cam.y + (this.mouse.y - this.H / 2) / z;
      for (const e of this.enemies) {
        if (!e.dead && Math.hypot(e.x - wx, e.y - wy) < e.r + 8) {
          over = true;
          break;
        }
      }
    }

    const col = over ? '#ff4b4e' : this.P.wpn === 'cryo' ? '#6beeff' : '#e0ae56';
    const gap = 7 + this.P.recoil * 9 + (this.P.sprinting ? 4 : 0) + (this.P.wpn === 'shotgun' ? 8 : 0);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    if (this.P.wpn === 'bat') {
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, TAU);
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        ctx.moveTo(cx + dx * gap, cy + dy * gap);
        ctx.lineTo(cx + dx * (gap + 7), cy + dy * (gap + 7));
      }
      ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

    if (this.G.hitMark > 0) {
      const k = 6 + (1 - this.G.hitMark / 0.14) * 6;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - k, cy - k);
      ctx.lineTo(cx - k * 0.4, cy - k * 0.4);
      ctx.moveTo(cx + k, cy - k);
      ctx.lineTo(cx + k * 0.4, cy - k * 0.4);
      ctx.moveTo(cx - k, cy + k);
      ctx.lineTo(cx - k * 0.4, cy + k * 0.4);
      ctx.moveTo(cx + k, cy + k);
      ctx.lineTo(cx + k * 0.4, cy + k * 0.4);
      ctx.stroke();
    }
  }

  private drawMiniMap(): void {
    const mc = this.minimapCanvas;
    if (!mc) return;
    const g = mc.getContext('2d');
    if (!g) return;
    const w = mc.width;
    const R = w / 2;
    const sc = R / 620;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#030809';
    g.beginPath();
    g.arc(R, R, R, 0, TAU);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(R, R, R - 2, 0, TAU);
    g.clip();
    g.translate(R, R);
    g.scale(sc, sc);
    g.translate(-this.P.x, -this.P.y);
    g.drawImage(this.assets.mmBase, 0, 0, WW, WH);

    for (const o of this.world.locks) {
      g.fillStyle = o.used ? '#7a3333' : '#5fe0a0';
      g.fillRect(o.x - 6, o.y - 6, o.w + 12, o.h + 12);
    }
    for (const d of this.world.docs) {
      g.fillStyle = '#fff';
      g.fillRect(d.x - 14, d.y - 14, 28, 28);
    }
    for (const c of this.world.canisters) {
      if (!c.exploded) {
        g.fillStyle = '#ff6b4a';
        g.fillRect(c.x - 10, c.y - 10, 20, 20);
      }
    }
    for (const e of this.enemies) {
      if (e.dead || (e.type === 'stalker' && e.cloak < 0.4)) continue;
      g.fillStyle = ETYPE[e.type].isBoss ? '#ff2a2a' : '#ff6854';
      const sz = ETYPE[e.type].isBoss ? 38 : 22;
      g.fillRect(e.x - sz / 2, e.y - sz / 2, sz, sz);
    }
    g.restore();

    g.save();
    g.translate(R, R);
    g.rotate(this.P.aim);
    g.fillStyle = 'rgba(224,174,86,.2)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R - 4, -0.4, 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#e0ae56';
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(-5, -5);
    g.lineTo(-2, 0);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }

  private drawFacilityMap(c: HTMLCanvasElement): void {
    const g = c.getContext('2d');
    if (!g) return;
    const cw = c.width;
    const ch = c.height;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#050b0e';
    g.fillRect(0, 0, cw, ch);

    const pad = 36;
    const sc = Math.min((cw - pad * 2) / WW, (ch - pad * 2) / WH);
    const ox = (cw - WW * sc) / 2;
    const oy = (ch - WH * sc) / 2;

    g.save();
    g.translate(ox, oy);
    g.scale(sc, sc);

    for (const r of this.world.rooms) {
      g.fillStyle = r.tint;
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = 'rgba(105,179,197,.75)';
      g.lineWidth = 4;
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#c1d9d8';
      g.font = 'bold 26px Consolas,monospace';
      g.fillText(r.name, r.x + 18, r.y + 38);
    }

    g.fillStyle = 'rgba(155,185,186,.65)';
    for (const o of this.world.obs) {
      g.fillRect(o.x, o.y, o.w, o.h);
    }

    for (const d of this.world.doors) {
      g.fillStyle = d.open ? '#5cbab5' : d.lockedKind ? '#ff4b4e' : '#e0ae56';
      g.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
    }

    const wp = this.getActiveWaypoint();
    if (wp) {
      g.strokeStyle = '#e0ae56';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(wp.x, wp.y, 44, 0, TAU);
      g.stroke();
      g.fillStyle = '#e0ae56';
      g.font = 'bold 28px Consolas,monospace';
      g.fillText('★ OBJECTIVE', wp.x + 28, wp.y - 16);
    }

    g.save();
    g.translate(this.P.x, this.P.y);
    g.rotate(this.P.aim);
    g.fillStyle = '#e0ae56';
    g.beginPath();
    g.moveTo(28, 0);
    g.lineTo(-16, -15);
    g.lineTo(-9, 0);
    g.lineTo(-16, 15);
    g.closePath();
    g.fill();
    g.restore();

    g.restore();
  }

  private getActiveWaypoint(): { x: number; y: number } | null {
    if (this.mode === 'endless') {
      const nextLock = this.world.locks.find((l) => !l.used);
      return nextLock ? { x: nextLock.x + nextLock.w / 2, y: nextLock.y + nextLock.h / 2 } : null;
    }
    if (this.G.act === 1) return { x: 1010, y: 515 };
    if (this.G.act === 2) {
      const boss = this.enemies.find((e) => !e.dead && e.type === 'warden');
      return boss ? { x: boss.x, y: boss.y } : { x: 750, y: 445 };
    }
    if (this.G.act === 3) {
      const boss = this.enemies.find((e) => !e.dead && e.type === 'chirurgeon');
      return boss ? { x: boss.x, y: boss.y } : { x: 1560, y: 1200 };
    }
    if (this.G.act === 4) return { x: 1945, y: 885 };
    if (this.G.act === 5) {
      const boss = this.enemies.find((e) => !e.dead && e.type === 'omega');
      return boss ? { x: boss.x, y: boss.y } : { x: 2340, y: 900 };
    }
    return { x: 1000, y: 100 };
  }

  /* ───────────── SNAPSHOT EMISSION TO REACT HUD ───────────── */
  getSnapshot(): HudSnapshot {
    const w = WPN[this.P.wpn];
    const a = this.G.ammo[this.P.wpn];
    let ammoCur = '∞';
    let ammoRes = '/ MELEE';
    let ammoLow = false;
    let ammoEmpty = false;
    if (w.flare) {
      ammoCur = pad2(a.res);
      ammoRes = '/ FLARES';
      ammoEmpty = a.res <= 0;
    } else if (w.mag) {
      ammoCur = pad2(a.mag);
      ammoRes = `/ ${String(a.res).padStart(3, '0')}`;
      ammoLow = a.mag <= w.mag * 0.3;
      ammoEmpty = a.mag <= 0 && a.res <= 0;
    }

    const activeBoss = this.enemies.find((e) => !e.dead && ETYPE[e.type].isBoss);
    const actSpec = STORY_ACTS[clamp(this.G.act - 1, 0, STORY_ACTS.length - 1)];
    const secId = sectorAt(this.P.x, this.P.y);
    const activeRoom = roomAt(this.P.x, this.P.y, this.world.rooms);

    let det = 0;
    let con = 0;
    const evidenceMap = {} as Record<ClueId, ClueState>;
    for (const k of Object.keys(CLUES) as ClueId[]) {
      const st = (this.profile.evidence[k] as ClueState) || 'none';
      evidenceMap[k] = st;
      if (st === 'detected') det++;
      else if (st === 'confirmed') con++;
    }

    const ammoAll: Record<WeaponId, { mag: number; res: number }> = {
      pistol: { ...this.G.ammo.pistol },
      shotgun: { ...this.G.ammo.shotgun },
      smg: { ...this.G.ammo.smg },
      bat: { ...this.G.ammo.bat },
      cryo: { ...this.G.ammo.cryo },
      flare: { ...this.G.ammo.flare },
    };
    const abilities: Record<AbilityId, { cd: number; maxCd: number; active: number }> = {
      emp: { ...this.G.abilities.emp },
      chrono: { ...this.G.abilities.chrono },
      grenade: { ...this.G.abilities.grenade },
      stim: { ...this.G.abilities.stim },
    };

    return {
      screen: this.screen,
      mode: this.mode,
      act: this.G.act,
      actTitle: this.mode === 'story' ? actSpec.title : `WAVE ${pad2(this.G.wave)} · ENDLESS NIGHTMARE`,
      objectiveText:
        this.mode === 'story'
          ? actSpec.objective
          : this.G.waveActive
            ? `Eliminate infected (${this.G.waveKilled}/${this.G.waveTotal})`
            : `Next wave in ${Math.ceil(Math.max(0, this.G.breakT))}s`,
      subObjectiveText:
        this.mode === 'story'
          ? actSpec.sub
          : `Reports ${this.G.docsFound}/${this.G.docsTotal} · Press [I] to Craft`,
      escapeTimer: this.G.escapeTimer,
      score: Math.round(this.G.score),
      bestScore: this.scores.length ? this.scores[0].score : 0,
      combo: this.G.combo,
      comboProgress: this.G.combo > 0 ? clamp((this.G.comboT / 3.2) * 100, 0, 100) : 0,
      multiplier: computeComboMultiplier(this.G.combo),
      kills: this.G.kills,
      time: Math.floor(this.G.time),
      wave: this.G.wave,
      waveActive: this.G.waveActive,
      waveKilled: this.G.waveKilled,
      waveTotal: this.G.waveTotal,
      waveBreak: this.G.breakT,
      hp: Math.ceil(this.P.hp),
      maxHp: Math.round(this.P.maxHp),
      stam: Math.round(this.P.stam),
      bat: Math.round(this.P.bat),
      flashOn: this.P.flashOn,
      weapon: this.P.wpn,
      weaponName: w.name,
      ammoCur,
      ammoRes,
      ammoLow,
      ammoEmpty,
      reloadPct: this.P.reloadT > 0 ? Math.round((1 - this.P.reloadT / this.P.reloadMax) * 100) : 0,
      isReloading: this.P.reloadT > 0,
      salvage: this.G.inventory.salvage,
      sectorLabel: SECTORS[secId].label,
      roomLabel: activeRoom ? activeRoom.short : SECTORS[secId].label,
      docsFound: this.G.docsFound,
      docsTotal: this.G.docsTotal,
      unlocked: { ...this.G.unlocked },
      ammoAll,
      abilities,
      chronoActive: this.G.abilities.chrono.active > 0,
      camcorderOn: this.camc.on,
      camcorderNv: this.camc.nv,
      camcorderZoom: this.camc.zoomLv[this.camc.zoom],
      camcorderBat: Math.round(this.camc.bat),
      camcorderSig: this.camc.sig,
      scentScanning: this.scent.scanning,
      evidenceSummary: con + det > 0 ? `${con} confirmed · ${det} traced` : 'None yet · [V] to scan',
      evidenceMap,
      uvDigitsFound: [...this.G.uvDigitsFound],
      boss: activeBoss
        ? {
            name: ETYPE[activeBoss.type].label,
            hp: Math.ceil(activeBoss.hp),
            maxHp: activeBoss.maxHp,
            phase: activeBoss.hp < activeBoss.maxHp * 0.5 ? 2 : 1,
          }
        : null,
      contextLabel: this.G.ctx?.label || null,
      contextShort: this.G.ctx?.short || 'ACT',
      contextKind: this.G.ctx?.kind || null,
      toastText: this.G.toastText,
      banner: this.G.banner,
      docCard: this.G.docCard,
      hintText: this.G.hintText,
      hurtAlpha: this.G.hurt,
      lowHpAlpha: this.P.hp < 35 && !this.G.dead ? 1 : 0,
      glitchIntensity: this.G.glitch,
      inventory: { ...this.G.inventory },
      upgrades: { ...this.G.upgrades },
      collectedDocs: [...this.G.collectedDocs],
      puzzle: this.G.puzzle,
      cutscene: this.G.cutscene,
      gameOver: this.G.gameOver,
      touchMode: this.touchMode,
      controlMode: this.cfg.controlMode,
      lang: this.cfg.lang,
      blackoutSector: this.powerGrid[secId]?.mode === 'out' ? SECTORS[secId].label : null,
      muted: this.snd.muted,
      hasSave: this.cachedHasSave,
      saveSummary: this.cachedSaveSummary,
      profile: { ...this.profile },
      scores: [...this.scores],
      wheelSelected: this.G.wheelSelected,
      wheelHover: this.G.wheelHover,
    };
  }

  private computeHudHash(): string {
    const a = this.G.ammo[this.P.wpn];
    const psec = sectorAt(this.P.x, this.P.y);
    return [
      this.screen,
      Math.ceil(this.P.hp),
      this.P.wpn,
      a.mag,
      a.res,
      Math.round(this.G.score),
      this.G.kills,
      this.G.combo,
      this.G.ctx?.id || '',
      this.G.toastText || '',
      this.G.banner?.title || '',
      this.G.docCard?.title || '',
      this.camc.on ? 1 : 0,
      this.camc.nv ? 1 : 0,
      this.scent.scanning > 0 ? 1 : 0,
      this.powerGrid[psec]?.mode || 'on',
      this.touchMode ? 1 : 0,
      this.cfg.lang,
      this.P.reloadT > 0 ? 1 : 0,
    ].join('|');
  }

  private emitSnapshot(): void {
    this.lastHudHash = this.computeHudHash();
    this.onSnapshot(this.getSnapshot());
  }

  // Test & Debug QA hooks
  getQAHandle() {
    return {
      tp: (x: number, y: number) => {
        if (freeSpot(x, y, 16, this.world.obs, WW, WH)) {
          this.P.x = x;
          this.P.y = y;
          this.cam.x = x;
          this.cam.y = y;
        }
        return { x: Math.round(this.P.x), y: Math.round(this.P.y) };
      },
      unlockAll: () => {
        for (const s of SLOTS) this.G.unlocked[s] = true;
        this.G.ammo.shotgun = { mag: 6, res: 24 };
        this.G.ammo.smg = { mag: 32, res: 96 };
        this.G.ammo.cryo = { mag: 18, res: 54 };
        this.G.ammo.flare = { mag: 0, res: 5 };
        this.emitSnapshot();
      },
      forceGameOver: () => {
        this.P.hp = 0;
        this.triggerDeath();
      },
      triggerPuzzle: (kind: PuzzleKind) => {
        const doorId = kind === 'keypad' ? 'WARD-04' : kind === 'circuit' ? 'NURSE-01' : 'REACTOR-C';
        this.openPuzzle(kind, doorId);
      },
    };
  }
}
