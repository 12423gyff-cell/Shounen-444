import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import {
  canAffordCost,
  CircuitTile,
  evaluateOscilloscopeMatch,
} from '../game/physics';
import {
  CLUES,
  ClueId,
  EnemyType,
  ETYPE,
  HudSnapshot,
  RECIPES,
  SEC_ORDER,
  SECTORS,
  SLOTS,
  UPGRADES,
  WeaponId,
  WPN,
} from '../game/types';
import { MaterialIcon, MaterialKind, WeaponIcon } from './Icons';

interface ModalsProps {
  snap: HudSnapshot;
  engineRef: React.RefObject<GameEngine | null>;
  secondaryModal: 'sectors' | 'scores' | 'settings' | 'help' | 'profile' | 'credits' | null;
  onCloseSecondary: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function ringSlicePath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1, y1] = polarToCartesian(cx, cy, rOut, startDeg);
  const [x2, y2] = polarToCartesian(cx, cy, rOut, endDeg);
  const [x3, y3] = polarToCartesian(cx, cy, rIn, endDeg);
  const [x4, y4] = polarToCartesian(cx, cy, rIn, startDeg);
  const large = endDeg - startDeg <= 180 ? '0' : '1';
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/* ───────────── 6-SLICE RADIAL SVG WEAPON WHEEL ───────────── */
const WeaponWheelModal: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const activeSlot = snap.wheelHover || snap.wheelSelected;
  const spec = WPN[activeSlot];
  const ammo = snap.ammoAll[activeSlot];
  const cx = 190;
  const cy = 190;
  const rIn = 66;
  const rOut = 172;
  const gap = 3;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/82 pointer-events-auto p-4">
      <div className="panel-surface p-5 sm:p-6 max-w-[520px] w-full flex flex-col items-center">
        <div className="w-full flex items-center justify-between border-b border-[#94bab6]/20 pb-2.5 mb-3">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-[#e0ae56] uppercase">
              RADIAL ARSENAL · KEYS 1–6 OR SELECT SLICE
            </div>
            <div className="text-base font-bold tracking-[0.14em] text-[#eef4ef]">
              {spec.name}
            </div>
          </div>
          <button
            type="button"
            onClick={() => engine.closeWheel(false)}
            className="px-3 py-1 border border-[#94bab6]/35 text-[11px] tracking-widest text-[#9cb2b0] hover:text-[#fff]"
          >
            CLOSE [ESC]
          </button>
        </div>

        {/* True 6-Slice Circular SVG Radial Wheel */}
        <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] select-none">
          <svg viewBox="0 0 380 380" className="w-full h-full">
            <circle cx={cx} cy={cy} r={rOut + 6} fill="none" stroke="rgba(92,186,181,0.18)" strokeWidth="1.5" />
            {SLOTS.map((s, idx) => {
              const start = idx * 60 - 30 + gap;
              const end = (idx + 1) * 60 - 30 - gap;
              const mid = idx * 60;
              const [lx, ly] = polarToCartesian(cx, cy, (rIn + rOut) / 2, mid);
              const unlocked = snap.unlocked[s];
              const equipped = snap.weapon === s;
              const hovered = activeSlot === s;
              const w = WPN[s];
              const a = snap.ammoAll[s];
              const stock = !unlocked
                ? 'LOCKED'
                : w.melee
                  ? '∞'
                  : w.flare
                    ? `x${a.res}`
                    : `${a.mag}/${a.res}`;

              const fill = !unlocked
                ? '#070c0f'
                : hovered
                  ? '#1a383f'
                  : equipped
                    ? '#12292f'
                    : '#0a1418';
              const stroke = !unlocked
                ? 'rgba(75,95,100,0.28)'
                : hovered
                  ? '#e0ae56'
                  : equipped
                    ? '#5cbab5'
                    : 'rgba(148,186,182,0.34)';

              return (
                <g
                  key={s}
                  onMouseEnter={() => unlocked && engine.hoverWheel(s)}
                  onClick={() => unlocked && engine.closeWheel(true, s)}
                  style={{ cursor: unlocked ? 'pointer' : 'not-allowed' }}
                >
                  <path
                    d={ringSlicePath(cx, cy, rIn, rOut, start, end)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={hovered ? 2.4 : 1.5}
                  />
                  <g
                    transform={`translate(${lx.toFixed(1)}, ${ly.toFixed(1)})`}
                    opacity={unlocked ? 1 : 0.34}
                  >
                    <text
                      x="0"
                      y="-14"
                      textAnchor="middle"
                      fill="#e0ae56"
                      fontSize="10"
                      fontWeight="700"
                    >
                      [{w.key}]
                    </text>
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#eef4ef"
                      fontSize="10.5"
                      fontWeight="700"
                    >
                      {s.toUpperCase()}
                    </text>
                    <text
                      x="0"
                      y="18"
                      textAnchor="middle"
                      fill={unlocked ? '#5cbab5' : '#6b7d7c'}
                      fontSize="9.5"
                      fontWeight="600"
                    >
                      {stock}
                    </text>
                  </g>
                </g>
              );
            })}
            {/* Center Hub Circle */}
            <circle cx={cx} cy={cy} r={rIn - 4} fill="#060d11" stroke="#5cbab5" strokeOpacity="0.65" strokeWidth="2" />
          </svg>

          {/* Central Live Weapon Readout Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center px-16">
            <WeaponIcon id={activeSlot} className="w-11 h-7 text-[#e0ae56]" />
            <div className="text-[10px] font-bold tracking-[0.14em] text-[#eef4ef] mt-1 leading-tight">
              {spec.id.toUpperCase()}
            </div>
            <div className="text-[9px] text-[#5cbab5] tabular-nums mt-0.5">
              DMG {spec.pellets ? `${spec.dmg}x${spec.pellets}` : spec.dmg}
            </div>
          </div>
        </div>

        <div className="w-full mt-2 pt-2.5 border-t border-[#94bab6]/20 flex flex-wrap justify-between text-[11px] text-[#9cb2b0] tabular-nums">
          <span>{spec.shortRole}</span>
          <span className="text-[#e0ae56]">
            {snap.unlocked[activeSlot]
              ? spec.melee
                ? 'READY'
                : `TOTAL STOCK: ${ammo.mag + ammo.res}`
              : 'FIND IN LOCKER / TERMINAL'}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ───────────── BRIEFCASE: INVENTORY, CRAFTING & UPGRADES ───────────── */
const BriefcaseModal: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const inv = snap.inventory;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/82 pointer-events-auto p-4 overflow-y-auto">
      <div className="panel-surface p-5 sm:p-6 max-w-[820px] w-full my-auto">
        <div className="flex items-center justify-between border-b border-[#94bab6]/20 pb-3 mb-4">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-[#e0ae56] uppercase">
              FIELD BRIEFCASE // INVENTORY · CRAFTING · ARMORY
            </div>
            <div className="text-lg font-bold tracking-[0.14em]">
              SALVAGE CREDITS: <span className="text-[#e0ae56] tabular-nums">⚙ {inv.salvage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => engine.closeOverlay()}
            className="px-3 py-1.5 border border-[#94bab6]/35 text-xs tracking-widest text-[#9cb2b0] hover:text-[#fff]"
          >
            CLOSE [I / ESC]
          </button>
        </div>

        {/* Supplies Strip */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-5 text-center">
          {(
            [
              ['scrap', 'SCRAP', inv.scrap, 'text-[#e0ae56]'],
              ['biogel', 'BIO-GEL', inv.biogel, 'text-[#78e6a8]'],
              ['cells', 'CELLS', inv.cells, 'text-[#62e8ff]'],
              ['fuel', 'FUEL', inv.fuel, 'text-[#ff9a3a]'],
              ['medkits', 'MEDKITS', inv.medkits, 'text-[#ff6b6e]'],
              ['grenades', 'GRENADES', inv.grenades, 'text-[#9fd8a6]'],
              ['keycards', 'KEYCARDS', inv.icuKeycard + inv.morgueKeycard, 'text-[#e0ae56]'],
            ] as [MaterialKind, string, number, string][]
          ).map(([kind, label, val, col]) => (
            <div key={label} className="bg-[#070f13] border border-[#94bab6]/25 p-2 flex flex-col items-center">
              <MaterialIcon kind={kind} className={`w-4 h-4 mb-1 ${col}`} />
              <div className="text-[8.5px] tracking-[0.16em] text-[#889c9a]">{label}</div>
              <div className="text-base font-bold tabular-nums text-[#eef4ef] leading-tight">{val}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Crafting Column */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold tracking-[0.2em] text-[#5cbab5] uppercase">
                FIELD CRAFTING
              </h3>
              <button
                type="button"
                disabled={inv.medkits <= 0 || snap.hp >= snap.maxHp}
                onClick={() => engine.useMedkitFromBriefcase()}
                className="px-2.5 py-1 bg-[#122e24] disabled:opacity-40 border border-[#78e6a8]/50 text-[10px] font-bold tracking-wider text-[#78e6a8]"
              >
                USE MEDKIT ({inv.medkits})
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {RECIPES.map((rec) => {
                const ok = canAffordCost(inv, rec.cost);
                const costStr = Object.entries(rec.cost)
                  .map(([k, v]) => `${v} ${k.toUpperCase()}`)
                  .join(' + ');
                return (
                  <div
                    key={rec.id}
                    className="bg-[#081115] border border-[#94bab6]/20 p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#eef4ef]">{rec.name}</div>
                      <div className="text-[10px] text-[#889c9a]">{rec.yieldLabel}</div>
                      <div className="text-[10px] text-[#e0ae56] mt-0.5">COST: {costStr}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!ok}
                      onClick={() => engine.craftRecipe(rec.id)}
                      className="px-3 py-1.5 bg-[#12262b] hover:bg-[#1a373e] disabled:opacity-35 border border-[#5cbab5]/55 text-[10px] font-bold tracking-widest uppercase text-[#eef4ef] whitespace-nowrap"
                    >
                      CRAFT
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Field Upgrades Column */}
          <div>
            <h3 className="text-xs font-bold tracking-[0.2em] text-[#e0ae56] uppercase mb-2">
              OPERATIVE UPGRADES
            </h3>
            <div className="flex flex-col gap-2">
              {UPGRADES.map((up) => {
                const lv = snap.upgrades[up.id];
                const maxed = lv >= up.maxLv;
                const cost = up.baseCost + lv * 65;
                const ok = !maxed && inv.salvage >= cost;
                return (
                  <div
                    key={up.id}
                    className="bg-[#081115] border border-[#94bab6]/20 p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#eef4ef]">
                        {up.name}{' '}
                        <span className="text-[#5cbab5] tabular-nums">
                          TIERS {lv}/{up.maxLv}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#889c9a]">{up.desc}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!ok}
                      onClick={() => engine.buyUpgrade(up.id)}
                      className="px-3 py-1.5 bg-[#20190c] hover:bg-[#332712] disabled:opacity-35 border border-[#e0ae56]/55 text-[10px] font-bold tracking-widest uppercase text-[#e0ae56] tabular-nums whitespace-nowrap"
                    >
                      {maxed ? 'MAXED' : `⚙ ${cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────── JOURNAL, UV CODES & BESTIARY ───────────── */
const JournalModal: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const [tab, setTab] = useState<'clues' | 'reports' | 'bestiary'>('clues');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/82 pointer-events-auto p-4 overflow-y-auto">
      <div className="panel-surface p-5 sm:p-6 max-w-[780px] w-full my-auto">
        <div className="flex items-center justify-between border-b border-[#94bab6]/20 pb-3 mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold tracking-[0.2em] text-[#5cbab5] uppercase">
              INVESTIGATION JOURNAL
            </h2>
            <div className="flex gap-1.5 text-[10px] tracking-widest">
              {(['clues', 'reports', 'bestiary'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-2.5 py-1 border uppercase ${
                    tab === t
                      ? 'bg-[#142c33] border-[#5cbab5] text-[#eef4ef]'
                      : 'border-[#94bab6]/25 text-[#889c9a] hover:text-[#eef4ef]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => engine.closeOverlay()}
            className="px-3 py-1.5 border border-[#94bab6]/35 text-xs tracking-widest text-[#9cb2b0] hover:text-[#fff]"
          >
            CLOSE [J / ESC]
          </button>
        </div>

        {tab === 'clues' && (
          <div className="space-y-4">
            <div className="bg-[#081217] border border-[#5cbab5]/35 p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-[0.2em] text-[#5cbab5]">
                  UV KEYPAD CODE TRACKER (USE CAMCORDER [C] + NIGHT VISION [N])
                </div>
                <div className="text-xs text-[#9cb2b0] mt-0.5">
                  Ward B Security Door override sequence discovered on hospital walls:
                </div>
              </div>
              <div className="text-xl font-extrabold tracking-[0.35em] text-[#6ef7ff] tabular-nums">
                {[0, 1, 2, 3].map((i) => snap.uvDigitsFound[i] || '_').join(' ')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(CLUES) as ClueId[]).map((cid) => {
                const c = CLUES[cid];
                const st = snap.evidenceMap[cid] || 'none';
                return (
                  <div key={cid} className="bg-[#071014] border border-[#94bab6]/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: c.col }}>
                        {c.glyph} {c.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold tracking-widest uppercase ${
                          st === 'confirmed'
                            ? 'text-[#78e6a8]'
                            : st === 'detected'
                              ? 'text-[#e0ae56]'
                              : 'text-[#6a7c7a]'
                        }`}
                      >
                        {st === 'none' ? 'UNDETECTED' : st}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9cb2b0] mt-1">
                      {st === 'none' ? c.confirmHint : c.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {snap.collectedDocs.length === 0 ? (
              <div className="text-xs text-[#889c9a] py-8 text-center">
                No field reports archived yet. Inspect white document files [E] around hospital wings.
              </div>
            ) : (
              snap.collectedDocs.map((d, idx) => (
                <div key={idx} className="bg-[#081115] border border-[#e0ae56]/30 p-3">
                  <div className="flex justify-between text-[10px] tracking-[0.18em] text-[#e0ae56] uppercase">
                    <span>{d.title}</span>
                    <span>{d.sector}</span>
                  </div>
                  <p className="text-xs text-[#dce6e2] mt-1 leading-relaxed">{d.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'bestiary' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {(Object.keys(ETYPE) as EnemyType[]).map((et) => {
              const spec = ETYPE[et];
              const kills = snap.profile.bestiary[et] || 0;
              return (
                <div key={et} className="bg-[#081115] border border-[#94bab6]/20 p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#eef4ef]">{spec.label}</span>
                    <span className="text-[10px] tabular-nums text-[#e0ae56]">
                      KILLS: {kills}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5cbab5] tabular-nums mt-0.5">
                    HP {spec.hp} · DMG {spec.dmg} · {spec.isBoss ? 'APEX BOSS' : 'INFECTED'}
                  </div>
                  <p className="text-[11px] text-[#9cb2b0] mt-1">{spec.desc}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ───────────── 3 INTERACTIVE PUZZLES ───────────── */
const CircuitTileSvg: React.FC<{ tile: CircuitTile }> = ({ tile }) => {
  const stroke = tile.powered ? '#5cbab5' : '#4a5d62';
  const deg = tile.rot * 90;
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full" style={{ transform: `rotate(${deg}deg)` }}>
      {tile.kind === 'straight' && (
        <line x1="30" y1="0" x2="30" y2="60" stroke={stroke} strokeWidth="10" strokeLinecap="butt" />
      )}
      {tile.kind === 'corner' && (
        <path d="M30 0 L30 30 L60 30" fill="none" stroke={stroke} strokeWidth="10" strokeLinejoin="round" />
      )}
      {tile.kind === 'tee' && (
        <path d="M0 30 L60 30 M30 0 L30 30" fill="none" stroke={stroke} strokeWidth="10" />
      )}
      {tile.kind === 'cross' && (
        <path d="M0 30 L60 30 M30 0 L30 60" fill="none" stroke={stroke} strokeWidth="10" />
      )}
      {tile.kind === 'source' && (
        <>
          <circle cx="22" cy="30" r="12" fill="#e0ae56" />
          <line x1="22" y1="30" x2="60" y2="30" stroke="#e0ae56" strokeWidth="10" />
        </>
      )}
      {tile.kind === 'sink' && (
        <>
          <circle cx="38" cy="30" r="12" fill={tile.powered ? '#78e6a8' : '#9c262a'} />
          <line x1="0" y1="30" x2="38" y2="30" stroke={stroke} strokeWidth="10" />
        </>
      )}
    </svg>
  );
};

const PuzzleModal: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const puzzle = snap.puzzle!;
  const [pin, setPin] = useState('');
  const [freq, setFreq] = useState(2.0);
  const [amp, setAmp] = useState(0.8);
  const [phase, setPhase] = useState(0.4);
  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const oscTarget = puzzle.oscTarget || { freq: 3.1, amp: 1.05, phase: 1.6 };
  const matchPct = evaluateOscilloscopeMatch({ freq, amp, phase }, oscTarget);

  useEffect(() => {
    if (puzzle.kind !== 'oscilloscope' || !oscCanvasRef.current) return;
    const c = oscCanvasRef.current;
    const g = c.getContext('2d');
    if (!g) return;
    const w = c.width;
    const h = c.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#040a0d';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(148,186,182,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();

    // Target wave (amber dashed)
    g.strokeStyle = '#e0ae56';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const t = (x / w) * Math.PI * 2;
      const y = h / 2 - Math.sin(t * oscTarget.freq + oscTarget.phase) * oscTarget.amp * (h * 0.32);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);

    // Player wave (teal solid)
    g.strokeStyle = matchPct >= 92 ? '#78e6a8' : '#5cbab5';
    g.lineWidth = 2.5;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const t = (x / w) * Math.PI * 2;
      const y = h / 2 - Math.sin(t * freq + phase) * amp * (h * 0.32);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }, [puzzle.kind, freq, amp, phase, oscTarget, matchPct]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/84 pointer-events-auto p-4">
      <div className="panel-surface p-6 max-w-[480px] w-full">
        <div className="flex items-start justify-between border-b border-[#94bab6]/20 pb-3 mb-4">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-[#e0ae56] uppercase">
              SECURITY OVERRIDE INTERFACE
            </div>
            <h2 className="text-base font-bold tracking-wider text-[#eef4ef] mt-0.5">
              {puzzle.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => engine.closeOverlay()}
            className="px-2.5 py-1 border border-[#94bab6]/35 text-[10px] tracking-widest text-[#9cb2b0]"
          >
            CANCEL
          </button>
        </div>

        <p className="text-xs text-[#9cb2b0] mb-4">{puzzle.subtitle}</p>

        {puzzle.kind === 'keypad' && (
          <div>
            <div className="bg-[#040a0c] border border-[#5cbab5]/40 p-3 text-center text-2xl font-extrabold tracking-[0.5em] tabular-nums text-[#6ef7ff] mb-3">
              {pin.padEnd(4, '_')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'ENT'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'CLR') setPin('');
                    else if (key === 'ENT') engine.submitKeypadPin(pin);
                    else if (pin.length < 4) setPin((p) => p + key);
                  }}
                  className={`py-3 border text-sm font-bold tracking-wider transition-colors ${
                    key === 'ENT'
                      ? 'bg-[#143025] border-[#78e6a8]/60 text-[#78e6a8]'
                      : key === 'CLR'
                        ? 'bg-[#2a1114] border-[#ff4b4e]/45 text-[#ff7676]'
                        : 'bg-[#091418] border-[#94bab6]/30 hover:border-[#5cbab5] text-[#eef4ef]'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {puzzle.kind === 'circuit' && puzzle.circuitGrid && (
          <div className="grid grid-cols-4 gap-1.5 bg-[#04090b] p-2 border border-[#5cbab5]/30">
            {puzzle.circuitGrid.map((tile, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => engine.rotateCircuitTile(idx)}
                className={`aspect-square border transition-colors ${
                  tile.powered
                    ? 'bg-[#0e262b] border-[#5cbab5]'
                    : 'bg-[#081014] border-[#94bab6]/20 hover:border-[#e0ae56]'
                }`}
              >
                <CircuitTileSvg tile={tile} />
              </button>
            ))}
          </div>
        )}

        {puzzle.kind === 'oscilloscope' && (
          <div className="space-y-3">
            <canvas
              ref={oscCanvasRef}
              width={420}
              height={140}
              className="w-full h-36 border border-[#5cbab5]/40 block"
            />
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-[#9cb2b0]">HARMONIC LOCK:</span>
              <span className={matchPct >= 92 ? 'text-[#78e6a8] font-bold' : 'text-[#e0ae56] font-bold'}>
                {matchPct}% (REQ 92%)
              </span>
            </div>
            <div className="space-y-2 text-[11px]">
              <label className="block">
                <div className="flex justify-between text-[#9cb2b0] tabular-nums">
                  <span>FREQUENCY (Hz)</span>
                  <span>{freq.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.1}
                  value={freq}
                  onChange={(e) => setFreq(Number(e.target.value))}
                  className="w-full accent-[#5cbab5]"
                />
              </label>
              <label className="block">
                <div className="flex justify-between text-[#9cb2b0] tabular-nums">
                  <span>AMPLITUDE</span>
                  <span>{amp.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={1.4}
                  step={0.05}
                  value={amp}
                  onChange={(e) => setAmp(Number(e.target.value))}
                  className="w-full accent-[#5cbab5]"
                />
              </label>
              <label className="block">
                <div className="flex justify-between text-[#9cb2b0] tabular-nums">
                  <span>PHASE OFFSET</span>
                  <span>{phase.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3.14}
                  step={0.05}
                  value={phase}
                  onChange={(e) => setPhase(Number(e.target.value))}
                  className="w-full accent-[#5cbab5]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => engine.submitOscilloscope(freq, amp, phase)}
              className="w-full py-2.5 bg-[#122e25] hover:bg-[#194034] border border-[#78e6a8]/65 text-xs font-bold tracking-[0.2em] text-[#78e6a8] uppercase"
            >
              ENGAGE HARMONIC OVERRIDE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ───────────── FACILITY SCHEMATIC MAP ───────────── */
const FacilityMapModal: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    engine.facilityCanvas = mapRef.current;
    return () => {
      engine.facilityCanvas = null;
    };
  }, [engine]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/86 pointer-events-auto p-4">
      <div className="panel-surface p-5 max-w-[920px] w-full">
        <div className="flex items-center justify-between border-b border-[#94bab6]/20 pb-3 mb-3">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-[#e0ae56] uppercase">
              ST. JUDE MEMORIAL BLUEPRINT // {snap.sectorLabel}
            </div>
            <div className="text-sm font-bold text-[#eef4ef]">{snap.objectiveText}</div>
          </div>
          <button
            type="button"
            onClick={() => engine.closeOverlay()}
            className="px-3 py-1.5 border border-[#94bab6]/35 text-xs tracking-widest text-[#9cb2b0] hover:text-[#fff]"
          >
            CLOSE [B / ESC]
          </button>
        </div>
        <canvas
          ref={mapRef}
          width={960}
          height={620}
          className="w-full h-auto max-h-[68vh] border border-[#5cbab5]/30 bg-[#04090c] block"
        />
      </div>
    </div>
  );
};

/* ───────────── CUTSCENE DIALOGUE OVERLAY ───────────── */
const CutsceneOverlay: React.FC<{
  snap: HudSnapshot;
  engine: GameEngine;
}> = ({ snap, engine }) => {
  const cs = snap.cutscene!;
  const line = cs.lines[cs.index];
  const portraitColors = {
    guard: '#5cbab5',
    dispatch: '#e0ae56',
    doctor: '#78e6a8',
    omega: '#ff4b4e',
  };
  const col = portraitColors[line.portrait];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-5 sm:p-8 flex justify-center pointer-events-auto">
      <div className="panel-surface p-5 max-w-[740px] w-full">
        <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-[#e0ae56] uppercase mb-3">
          <span>{cs.title}</span>
          <button
            type="button"
            onClick={() => engine.skipCutscene()}
            className="text-[#889c9a] hover:text-[#eef4ef]"
          >
            SKIP CUTSCENE
          </button>
        </div>
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 shrink-0 border flex items-center justify-center bg-[#060d10]"
            style={{ borderColor: col }}
          >
            <svg viewBox="0 0 48 48" className="w-12 h-12" aria-hidden="true">
              <circle cx="24" cy="18" r="9" fill={col} opacity="0.85" />
              <path d="M9 42 C11 30, 37 30, 39 42" fill={col} opacity="0.6" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: col }}>
              {line.speaker} <span className="text-[#889c9a] font-normal">· {line.role}</span>
            </div>
            <p className="text-sm text-[#e3eae5] mt-1.5 leading-relaxed">{line.text}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => engine.advanceCutscene()}
            className="px-4 py-1.5 bg-[#12262b] hover:bg-[#1a373e] border border-[#5cbab5] text-xs font-bold tracking-[0.18em] uppercase"
          >
            {cs.index + 1 < cs.lines.length ? 'NEXT [SPACE]' : 'CONTINUE SHIFT [SPACE]'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Modals: React.FC<ModalsProps> = ({
  snap,
  engineRef,
  secondaryModal,
  onCloseSecondary,
}) => {
  const engine = engineRef.current;

  return (
    <>
      {engine && snap.screen === 'wheel' && <WeaponWheelModal snap={snap} engine={engine} />}
      {engine && snap.screen === 'briefcase' && <BriefcaseModal snap={snap} engine={engine} />}
      {engine && snap.screen === 'journal' && <JournalModal snap={snap} engine={engine} />}
      {engine && snap.screen === 'puzzle' && snap.puzzle && (
        <PuzzleModal snap={snap} engine={engine} />
      )}
      {engine && snap.screen === 'map' && <FacilityMapModal snap={snap} engine={engine} />}
      {engine && snap.screen === 'cutscene' && snap.cutscene && (
        <CutsceneOverlay snap={snap} engine={engine} />
      )}

      {/* PAUSE MODAL */}
      {engine && snap.screen === 'paused' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/82 pointer-events-auto p-4">
          <div className="panel-surface p-6 max-w-[420px] w-full text-center">
            <div className="text-[10px] tracking-[0.24em] text-[#e0ae56] uppercase">
              SHIFT SUSPENDED // CHECKPOINT SAVED
            </div>
            <h2 className="text-2xl font-extrabold tracking-[0.2em] text-[#eef4ef] mt-1">
              PAUSED
            </h2>
            <div className="grid grid-cols-3 gap-2 my-5 text-center">
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">SCORE</div>
                <div className="text-sm font-bold tabular-nums text-[#e0ae56]">
                  {snap.score.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">KILLS</div>
                <div className="text-sm font-bold tabular-nums">{snap.kills}</div>
              </div>
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">TIME</div>
                <div className="text-sm font-bold tabular-nums">{formatTime(snap.time)}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => engine.resume()}
                className="py-3 bg-[#142d34] hover:bg-[#1c404a] border border-[#5cbab5] text-xs font-bold tracking-[0.2em] uppercase"
              >
                RESUME SHIFT [ESC]
              </button>
              <button
                type="button"
                onClick={() => engine.startNewRun(snap.mode)}
                className="py-2.5 bg-[#0b1519] hover:bg-[#142329] border border-[#94bab6]/35 text-xs font-bold tracking-[0.18em] uppercase text-[#e0ae56]"
              >
                RESTART SHIFT [R]
              </button>
              <button
                type="button"
                onClick={() => engine.toTitle()}
                className="py-2.5 bg-[#080e11] hover:bg-[#181012] border border-[#94bab6]/25 text-xs font-bold tracking-[0.18em] uppercase text-[#9cb2b0]"
              >
                RETURN TO TITLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL */}
      {engine && snap.screen === 'gameover' && snap.gameOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/88 pointer-events-auto p-4 overflow-y-auto">
          <div className="panel-surface p-6 max-w-[540px] w-full my-auto">
            <div className="text-center border-b border-[#94bab6]/20 pb-4">
              <div
                className={`text-[10px] tracking-[0.26em] uppercase font-bold ${
                  snap.gameOver.victory ? 'text-[#78e6a8]' : 'text-[#ff4b4e]'
                }`}
              >
                {snap.gameOver.victory ? 'EXTRACTION SUCCESSFUL' : 'OPERATIVE FLATLINED'}
              </div>
              <h2 className="text-2xl font-extrabold tracking-[0.18em] text-[#eef4ef] mt-1">
                {snap.gameOver.victory ? 'SHIFT SURVIVED' : 'SHIFT TERMINATED'}
              </h2>
              <div className="text-3xl font-black tabular-nums text-[#e0ae56] mt-2">
                {snap.gameOver.score.toLocaleString()} PTS
              </div>
              {snap.gameOver.newBest && (
                <div className="text-[11px] font-bold tracking-[0.22em] text-[#78e6a8] mt-1">
                  ★ NEW FACILITY RECORD ★
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 text-center">
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">
                  {snap.mode === 'story' ? 'ACT REACHED' : 'WAVE'}
                </div>
                <div className="text-base font-bold tabular-nums text-[#eef4ef]">
                  {snap.mode === 'story' ? `ACT ${snap.gameOver.act}` : snap.gameOver.wave}
                </div>
              </div>
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">HOSTILES</div>
                <div className="text-base font-bold tabular-nums text-[#eef4ef]">
                  {snap.gameOver.kills}
                </div>
              </div>
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">MAX STREAK</div>
                <div className="text-base font-bold tabular-nums text-[#e0ae56]">
                  x{snap.gameOver.maxCombo}
                </div>
              </div>
              <div className="bg-[#070f13] border border-[#94bab6]/20 p-2">
                <div className="text-[9px] text-[#889c9a] tracking-widest">SURVIVED</div>
                <div className="text-base font-bold tabular-nums text-[#5cbab5]">
                  {formatTime(snap.gameOver.time)}
                </div>
              </div>
            </div>

            {snap.gameOver.bossRemainingPct !== null && !snap.gameOver.victory && (
              <div className="text-center text-[11px] text-[#ff7676] mb-3 tabular-nums">
                BOSS INTEGRITY REMAINING: {snap.gameOver.bossRemainingPct}%
              </div>
            )}

            {/* Local High Scores */}
            <div className="bg-[#060c0f] border border-[#94bab6]/20 p-3 mb-4">
              <div className="text-[9px] tracking-[0.2em] text-[#889c9a] uppercase mb-2">
                LOCAL RECORD ARCHIVE
              </div>
              <div className="space-y-1 text-[11px] tabular-nums">
                {snap.gameOver.scores.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between ${
                      idx === snap.gameOver?.rank ? 'text-[#e0ae56] font-bold' : 'text-[#b6c9c5]'
                    }`}
                  >
                    <span>
                      #{idx + 1} · {entry.mode.toUpperCase()} {entry.mode === 'story' ? `A${entry.act}` : `W${entry.wave}`}
                    </span>
                    <span>
                      {entry.kills} KILLS · {entry.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={() => engine.startNewRun(snap.mode)}
                className="flex-1 py-3 bg-[#9c262a] hover:bg-[#b82f34] border border-[#ff4b4e]/65 text-xs font-bold tracking-[0.2em] uppercase text-[#fff]"
              >
                DEPLOY AGAIN [ENTER]
              </button>
              <button
                type="button"
                onClick={() => engine.toTitle()}
                className="py-3 px-5 bg-[#0a1418] hover:bg-[#12232a] border border-[#94bab6]/35 text-xs font-bold tracking-[0.18em] uppercase text-[#c4d5d2]"
              >
                TITLE SCREEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TITLE SCREEN SECONDARY MODALS (Sectors, Leaderboard, Settings, Manual, Profile) */}
      {engine && secondaryModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020506]/86 pointer-events-auto p-4 overflow-y-auto">
          <div className="panel-surface p-6 max-w-[580px] w-full my-auto">
            <div className="flex items-center justify-between border-b border-[#94bab6]/20 pb-3 mb-4">
              <h2 className="text-base font-bold tracking-[0.2em] text-[#e0ae56] uppercase">
                {secondaryModal === 'sectors'
                  ? 'SECTOR DEPLOYMENT SELECT'
                  : secondaryModal === 'scores'
                    ? 'FACILITY HIGH SCORES'
                    : secondaryModal === 'settings'
                      ? 'SYSTEM, AUDIO & CONTROL SETTINGS'
                      : secondaryModal === 'profile'
                        ? 'OPERATIVE SERVICE RECORD'
                        : secondaryModal === 'credits'
                          ? 'PRODUCTION CREDITS'
                          : 'TACTICAL FIELD MANUAL'}
              </h2>
              <button
                type="button"
                onClick={onCloseSecondary}
                className="px-3 py-1 border border-[#94bab6]/35 text-xs tracking-widest text-[#9cb2b0] hover:text-[#fff]"
              >
                CLOSE
              </button>
            </div>

            {secondaryModal === 'sectors' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SEC_ORDER.map((secId) => (
                  <button
                    key={secId}
                    type="button"
                    onClick={() => {
                      onCloseSecondary();
                      engine.startNewRun('endless', secId);
                    }}
                    className="p-3.5 text-left bg-[#081115] hover:bg-[#12262e] border border-[#94bab6]/25 hover:border-[#5cbab5] transition-colors"
                  >
                    <div className="text-xs font-bold tracking-[0.18em] text-[#5cbab5]">
                      {SECTORS[secId].label}
                    </div>
                    <div className="text-[10px] text-[#889c9a] mt-1">
                      Deploy Endless Shift directly into {SECTORS[secId].label}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {secondaryModal === 'scores' && (
              <div className="space-y-1.5 text-xs tabular-nums">
                {snap.scores.length === 0 ? (
                  <div className="text-center py-8 text-[#889c9a]">
                    No shifts recorded yet. Complete or survive a shift to set a record.
                  </div>
                ) : (
                  snap.scores.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-[#081115] border border-[#94bab6]/20 px-3 py-2"
                    >
                      <span className="text-[#e0ae56] font-bold">
                        #{idx + 1} · {s.mode.toUpperCase()} ({s.mode === 'story' ? `ACT ${s.act}` : `WAVE ${s.wave}`})
                      </span>
                      <span className="text-[#e3eae5]">
                        {s.kills} KILLS · {formatTime(s.time)} ·{' '}
                        <strong className="text-[#5cbab5]">{s.score.toLocaleString()}</strong>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {secondaryModal === 'profile' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                {[
                  ['CLEARANCE LV', Math.floor((snap.profile.xp || 0) / 100) + 1],
                  ['TOTAL XP', snap.profile.xp],
                  ['SHIFTS LOGGED', snap.profile.shifts],
                  ['CONFIRMED KILLS', snap.profile.kills],
                  ['CAM CAPTURES', snap.profile.photos],
                  ['STORY STATUS', snap.profile.storyCleared ? 'CLEARED' : 'ACTIVE'],
                ].map(([lbl, val]) => (
                  <div key={String(lbl)} className="bg-[#081115] border border-[#94bab6]/20 p-3">
                    <div className="text-[9px] text-[#889c9a] tracking-widest">{lbl}</div>
                    <div className="text-lg font-bold tabular-nums text-[#eef4ef] mt-1">{val}</div>
                  </div>
                ))}
              </div>
            )}

            {secondaryModal === 'settings' && (
              <div className="space-y-3 text-xs max-h-[65vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>MASTER VOLUME</span>
                      <span className="tabular-nums">{engine.cfg.master}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engine.cfg.master}
                      onChange={(e) => engine.updateConfig({ master: Number(e.target.value) })}
                      className="w-full accent-[#5cbab5]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>AMBIENCE BUS</span>
                      <span className="tabular-nums">{engine.cfg.amb}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engine.cfg.amb}
                      onChange={(e) => engine.updateConfig({ amb: Number(e.target.value) })}
                      className="w-full accent-[#5cbab5]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>WEAPONS & FOLEY</span>
                      <span className="tabular-nums">{engine.cfg.foley}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engine.cfg.foley}
                      onChange={(e) => engine.updateConfig({ foley: Number(e.target.value) })}
                      className="w-full accent-[#e0ae56]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>CREATURE AUDIO</span>
                      <span className="tabular-nums">{engine.cfg.cre}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engine.cfg.cre}
                      onChange={(e) => engine.updateConfig({ cre: Number(e.target.value) })}
                      className="w-full accent-[#ff4b4e]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>AMBIENT BRIGHTNESS</span>
                      <span className="tabular-nums">{engine.cfg.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={95}
                      value={engine.cfg.brightness}
                      onChange={(e) => engine.updateConfig({ brightness: Number(e.target.value) })}
                      className="w-full accent-[#5cbab5]"
                    />
                  </label>
                  <label className="block">
                    <div className="flex justify-between text-[#9cb2b0] mb-1">
                      <span>CAMERA SHAKE</span>
                      <span className="tabular-nums">{engine.cfg.shake}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engine.cfg.shake}
                      onChange={(e) => engine.updateConfig({ shake: Number(e.target.value) })}
                      className="w-full accent-[#e0ae56]"
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="flex justify-between text-[#9cb2b0] mb-1">
                    <span>AIM ASSIST STRENGTH</span>
                    <span className="tabular-nums">{engine.cfg.aimAssist}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={engine.cfg.aimAssist}
                    onChange={(e) => engine.updateConfig({ aimAssist: Number(e.target.value) })}
                    className="w-full accent-[#5cbab5]"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <div className="text-[10px] text-[#889c9a] mb-1">GRAPHICS</div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['auto', 'low', 'med', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => engine.updateConfig({ quality: q })}
                          className={`py-1 border text-[10px] uppercase ${
                            engine.cfg.quality === q
                              ? 'bg-[#142c33] border-[#5cbab5] text-[#eef4ef]'
                              : 'border-[#94bab6]/25 text-[#889c9a]'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#889c9a] mb-1">FILM GRAIN</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['off', 'low', 'high'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => engine.updateConfig({ grain: g })}
                          className={`py-1 border text-[10px] uppercase ${
                            engine.cfg.grain === g
                              ? 'bg-[#142c33] border-[#e0ae56] text-[#eef4ef]'
                              : 'border-[#94bab6]/25 text-[#889c9a]'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-[#889c9a] mb-1">INPUT MODE</div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['auto', 'desktop', 'touch'] as const).map((cm) => (
                        <button
                          key={cm}
                          type="button"
                          onClick={() => engine.updateConfig({ controlMode: cm })}
                          className={`py-1 border text-[10px] uppercase ${
                            engine.cfg.controlMode === cm
                              ? 'bg-[#142c33] border-[#5cbab5] text-[#eef4ef]'
                              : 'border-[#94bab6]/25 text-[#889c9a]'
                          }`}
                        >
                          {cm}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#94bab6]/15">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={engine.cfg.reduceFlash}
                      onChange={(e) => engine.updateConfig({ reduceFlash: e.target.checked })}
                      className="accent-[#5cbab5]"
                    />
                    <span>Reduce Strobe</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={engine.cfg.muted}
                      onChange={(e) => engine.updateConfig({ muted: e.target.checked })}
                      className="accent-[#5cbab5]"
                    />
                    <span>Mute Audio</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      engine.updateConfig({ lang: engine.cfg.lang === 'en' ? 'ar' : 'en' })
                    }
                    className="ml-auto px-3 py-1 bg-[#0b161b] border border-[#5cbab5]/55 text-[#5cbab5] font-bold"
                  >
                    LANG: {engine.cfg.lang === 'ar' ? 'العربية' : 'ENGLISH'}
                  </button>
                </div>
              </div>
            )}

            {secondaryModal === 'help' && (
              <div className="space-y-2.5 text-xs text-[#c7d5d1] leading-relaxed">
                <div>
                  <strong className="text-[#e0ae56]">MOVEMENT & COMBAT:</strong> WASD Move · Shift Sprint · Space Dash · Left Click Fire · R Reload · F Torch · E Interact
                </div>
                <div>
                  <strong className="text-[#5cbab5]">SPECIAL POWERS:</strong> [Q] EMP Surge · [T] Chrono-Stasis · [G] Frag Grenade · [H] Adrenaline Stim
                </div>
                <div>
                  <strong className="text-[#6ef7ff]">FORENSIC GEAR:</strong> [C] Camcorder · [N] UV Night Vision (reveals secret door PIN 4-8-2-7 on walls) · [V] Chemical Scent Scan
                </div>
                <div>
                  <strong className="text-[#e0ae56]">TACTICAL SYSTEMS:</strong> [Tab] 6-Slice Radial Wheel · [I] Briefcase Crafting & Upgrades · [J] Journal & Bestiary · [B] Blueprint Map
                </div>
                <div className="border-t border-[#94bab6]/20 pt-2 text-[#9cb2b0]">
                  <strong className="text-[#ff6b6e]">POWER SURGES:</strong> If a hospital wing suffers a breaker trip, emergency red strobes activate. Reset the glowing Breaker Panel [E] for +300 PTS.
                </div>
              </div>
            )}

            {secondaryModal === 'credits' && (
              <div className="space-y-3 text-xs text-[#c7d5d1] leading-relaxed">
                <div className="bg-[#081115] border border-[#94bab6]/20 p-3.5">
                  <div className="text-[10px] tracking-[0.2em] text-[#e0ae56] uppercase">
                    SHIFT REPORT: PROTOCOL 98 — DIRECTOR&apos;S CUT
                  </div>
                  <p className="mt-1.5 text-[#dce6e2]">
                    Top-down tactical survival horror engine running at 60fps with raycasted flashlight occlusion, procedural WebAudio synthesizer, 6 story acts, 3 interactive terminal puzzles, endless wave survival, and dual desktop + mobile landscape controls.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#071014] border border-[#94bab6]/15 p-2.5">
                    <div className="text-[#5cbab5] font-bold">FACILITY SECTORS</div>
                    <div className="text-[#9cb2b0]">Reception, Ward B, ICU, Radiology, Morgue, Reactor 98</div>
                  </div>
                  <div className="bg-[#071014] border border-[#94bab6]/15 p-2.5">
                    <div className="text-[#e0ae56] font-bold">INTERACTIVE PUZZLES</div>
                    <div className="text-[#9cb2b0]">UV Keypad 4-8-2-7, 4x4 Circuit Grid, Bio-Frequency Wave</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
