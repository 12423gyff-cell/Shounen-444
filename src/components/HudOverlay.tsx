import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine';
import { AbilityId, HudSnapshot } from '../game/types';
import { AbilityIcon, WeaponIcon } from './Icons';

interface HudOverlayProps {
  snap: HudSnapshot;
  engineRef: React.RefObject<GameEngine | null>;
}

const ABILITY_META: { id: AbilityId; key: string; label: string }[] = [
  { id: 'emp', key: 'Q', label: 'EMP' },
  { id: 'chrono', key: 'T', label: 'CHRONO' },
  { id: 'grenade', key: 'G', label: 'FRAG' },
  { id: 'stim', key: 'H', label: 'STIM' },
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({ snap, engineRef }) => {
  const ecgRef = useRef<HTMLCanvasElement | null>(null);
  const miniRef = useRef<HTMLCanvasElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const lookKnobRef = useRef<HTMLDivElement | null>(null);
  const stickIdRef = useRef<number | null>(null);
  const stickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookIdRef = useRef<number | null>(null);
  const lookOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.ecgCanvas = ecgRef.current;
    eng.minimapCanvas = miniRef.current;
    return () => {
      if (engineRef.current) {
        engineRef.current.ecgCanvas = null;
        engineRef.current.minimapCanvas = null;
      }
    };
  }, [engineRef]);

  const condText = snap.hp < 35 ? 'DANGER' : snap.hp < 70 ? 'CAUTION' : 'FINE';
  const condColor =
    snap.hp < 35 ? 'text-[#ff4b4e]' : snap.hp < 70 ? 'text-[#e0ae56]' : 'text-[#78e6a8]';

  return (
    <>
      {/* Reactive Full-Screen Vignettes (no backdrop-blur!) */}
      <div
        className="fixed inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,0.62) 100%)',
        }}
      />
      {snap.hurtAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-10 pointer-events-none"
          style={{
            opacity: snap.hurtAlpha,
            background:
              'radial-gradient(ellipse at center, transparent 28%, rgba(195,14,18,0.75) 100%)',
          }}
        />
      )}
      {snap.lowHpAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-10 pointer-events-none danger-pulse"
          style={{
            boxShadow: 'inset 0 0 130px 28px rgba(170,0,0,0.82)',
          }}
        />
      )}
      {snap.chronoActive && (
        <div
          className="fixed inset-0 z-10 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 130px 24px rgba(70,210,235,0.42)',
            background: 'radial-gradient(circle, transparent 58%, rgba(30,135,165,0.16) 100%)',
          }}
        />
      )}

      {/* Camcorder Viewfinder Frame (Pure Corner L-Brackets + Non-Overlapping Telemetry Strip) */}
      {snap.camcorderOn && (
        <div className="fixed inset-0 z-15 pointer-events-none p-2 sm:p-3 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-6 h-6 border-t-2 border-l-2 border-[#e3eae5]/70" />
            <div className="px-3 py-1 bg-[#060d10]/88 border border-[#e3eae5]/35 flex items-center gap-2.5 text-[10px] font-bold tracking-[0.16em] text-[#e3eae5] whitespace-nowrap">
              <span className="text-[#ff4b4e]">● REC</span>
              <span className="tabular-nums">{formatTime(snap.time)}</span>
              <span className="text-[#5cbab5]">{snap.camcorderNv ? 'UV-NV ON' : 'OPTICAL'}</span>
              <span className="text-[#9cb2b0] tabular-nums">
                {snap.camcorderZoom.toFixed(1)}x · BAT {snap.camcorderBat}%
              </span>
              <span className="text-[#e0ae56] tabular-nums">
                UV {snap.uvDigitsFound.length}/4
              </span>
            </div>
            <div className="w-6 h-6 border-t-2 border-r-2 border-[#e3eae5]/70" />
          </div>
          <div className="flex justify-between items-end">
            <div className="w-6 h-6 border-b-2 border-l-2 border-[#e3eae5]/70" />
            <div className="w-6 h-6 border-b-2 border-r-2 border-[#e3eae5]/70" />
          </div>
        </div>
      )}

      {/* Centered Top Banner / Boss Bar / Escape Timer (Clear of Corners & Camcorder Strip) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-22 pointer-events-none flex flex-col items-center gap-1.5 ${
          snap.camcorderOn ? 'top-10' : 'top-2.5'
        } ${snap.touchMode ? 'max-w-[280px]' : 'max-w-[420px]'} w-max`}
      >
        {snap.escapeTimer !== null && (
          <div className="bg-[#4b0e12]/92 border border-[#ff4b4e] px-4 py-1 text-center shadow-[0_6px_22px_rgba(0,0,0,0.75)]">
            <div className="text-[8px] sm:text-[9px] tracking-[0.22em] text-[#ffd4d4] uppercase whitespace-nowrap">
              MELTDOWN ESCAPE TO NORTH AIRLOCK
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-[#ff4b4e] leading-tight">
              {snap.escapeTimer.toFixed(1)}s
            </div>
          </div>
        )}

        {snap.boss && (
          <div className="w-[260px] sm:w-[340px] bg-[#091216]/90 border border-[#ff4b4e]/55 px-3 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.65)]">
            <div className="flex justify-between items-center text-[10px] font-bold tracking-[0.18em]">
              <span className="text-[#ff6a6c] truncate">{snap.boss.name}</span>
              <span className="tabular-nums text-[#e3eae5] shrink-0 ml-2">
                {snap.boss.hp} / {snap.boss.maxHp}
              </span>
            </div>
            <div className="relative h-2 bg-black/80 mt-1 border border-[#9c262a]/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8f1822] to-[#ff4b4e]"
                style={{ width: `${Math.max(0, (snap.boss.hp / snap.boss.maxHp) * 100)}%` }}
              />
              <div className="absolute inset-0 pointer-events-none flex justify-evenly">
                <span className="w-px h-full bg-black/55" />
                <span className="w-px h-full bg-black/55" />
                <span className="w-px h-full bg-black/55" />
              </div>
            </div>
          </div>
        )}

        {snap.banner && (
          <div className="bg-[#081216]/92 border border-[#e0ae56]/55 px-3.5 sm:px-5 py-1.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
            <div className="text-[10px] sm:text-xs font-bold tracking-[0.18em] text-[#e0ae56] uppercase whitespace-nowrap">
              {snap.banner.icon} {snap.banner.title}
            </div>
            <div className="text-[9px] sm:text-[10px] tracking-[0.12em] text-[#c7d5d1] mt-0.5 line-clamp-1">
              {snap.banner.sub}
            </div>
          </div>
        )}

        {snap.toastText && !snap.banner && (
          <div className="bg-[#071014]/90 border border-[#5cbab5]/40 px-3 py-1 text-[9px] sm:text-[10px] font-bold tracking-[0.16em] text-[#e3eae5] uppercase whitespace-nowrap">
            {snap.toastText}
          </div>
        )}
      </div>

      {/* Main HUD Wrapper (pointer-events: none; interactive buttons only pointer-events: auto) */}
      <div className="fixed inset-0 z-20 pointer-events-none p-2.5 sm:p-4 flex flex-col justify-between">
        {/* Top Row: Top-Left Vitals+Abilities | Top-Right Score+Obj+Utility */}
        <div className="flex items-start justify-between gap-2">
          {/* TOP LEFT CLUSTER */}
          <div
            className={`${
              snap.touchMode ? 'w-[216px]' : 'w-[244px] sm:w-[270px]'
            } flex flex-col gap-1.5 pointer-events-auto`}
          >
            {/* Vitals Block */}
            <div className="bg-[#091216]/88 border border-[#94bab6]/25 px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between text-[9px] font-bold tracking-[0.2em]">
                <span className="text-[#e0ae56] truncate">VITALS · {snap.roomLabel}</span>
                <span className={`${condColor} shrink-0 ml-1`}>{condText}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <canvas
                  ref={ecgRef}
                  width={52}
                  height={20}
                  className="bg-black/55 border border-[#5cbab5]/25 shrink-0"
                />
                <div className="relative flex-1 h-3 bg-black/80 border border-[#9c262a]/70 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8f1822] via-[#cc2230] to-[#ff6668]"
                    style={{ width: `${Math.max(0, Math.min(100, (snap.hp / snap.maxHp) * 100))}%` }}
                  />
                  <div className="absolute inset-0 pointer-events-none flex justify-evenly">
                    <span className="w-px h-full bg-black/55" />
                    <span className="w-px h-full bg-black/55" />
                    <span className="w-px h-full bg-black/55" />
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums text-[#ffe0da] min-w-[28px] text-right">
                  {snap.hp}
                </span>
              </div>

              {/* Stamina & Battery Compact Dual Strip */}
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <div>
                  <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#9cb2b0]">
                    <span>STAMINA</span>
                    <span className="tabular-nums text-[#66d2e4]">{snap.stam}</span>
                  </div>
                  <div className="h-1 bg-black/75 mt-0.5 overflow-hidden">
                    <div
                      className="h-full bg-[#66d2e4]"
                      style={{ width: `${snap.stam}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[8px] tracking-[0.14em] text-[#9cb2b0]">
                    <span>TORCH</span>
                    <span className="tabular-nums text-[#e0ae56]">
                      {snap.bat}%{snap.flashOn ? '' : ' OFF'}
                    </span>
                  </div>
                  <div className="h-1 bg-black/75 mt-0.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        snap.bat < 20 && snap.flashOn ? 'bg-[#ff4b4e]' : 'bg-[#e0ae56]'
                      }`}
                      style={{ width: `${snap.bat}%` }}
                    />
                  </div>
                </div>
              </div>
              {snap.blackoutSector && (
                <div className="mt-1.5 px-2 py-0.5 bg-[#3b0b0f]/90 border border-[#ff4b4e]/60 text-[8.5px] font-bold tracking-[0.14em] text-[#ffb6b8] uppercase truncate">
                  ⚡ POWER TRIPPED · {snap.blackoutSector}
                </div>
              )}
            </div>

            {/* 4 Ability Cooldown Slots */}
            <div className="flex items-center gap-1.5">
              {ABILITY_META.map((ab) => {
                const st = snap.abilities[ab.id];
                const ready = st.cd <= 0.05;
                const pct = st.maxCd > 0 ? Math.max(0, Math.min(1, 1 - st.cd / st.maxCd)) : 1;
                const dash = 113;
                const offset = dash * (1 - pct);
                return (
                  <button
                    key={ab.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      engineRef.current?.useAbility(ab.id);
                    }}
                    title={`${ab.label} [${ab.key}]`}
                    className={`relative ${
                      snap.touchMode ? 'w-10 h-10' : 'w-11 h-11'
                    } bg-[#081014]/90 border flex flex-col items-center justify-center transition-colors ${
                      ready
                        ? 'border-[#5cbab5]/65 text-[#e3eae5] hover:border-[#e0ae56]'
                        : 'border-[#4a5b5f]/40 text-[#7d9190]'
                    }`}
                  >
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                      <circle
                        cx="20"
                        cy="20"
                        r="18"
                        fill="none"
                        stroke={ready ? '#5cbab5' : '#e0ae56'}
                        strokeWidth="2"
                        strokeDasharray={dash}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <AbilityIcon id={ab.id} className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-bold tracking-wider tabular-nums leading-none mt-0.5">
                      {ready ? ab.key : st.cd.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOP RIGHT CLUSTER: Score + Objective + Minimap + Utility Buttons */}
          <div className="flex items-start gap-2 pointer-events-auto">
            {!snap.touchMode && (
              <div className="hidden sm:flex flex-col items-end gap-1.5">
                <div className="bg-[#091216]/88 border border-[#94bab6]/25 px-3 py-1.5 text-right min-w-[168px]">
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-[9px] tracking-[0.2em] text-[#889c9a]">SCORE</span>
                    <span className="text-xl font-extrabold tabular-nums text-[#eef4ef]">
                      {snap.score.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2.5 text-[10px] tabular-nums mt-0.5 whitespace-nowrap">
                    <span className="text-[#e0ae56] font-bold">x{snap.multiplier}</span>
                    <span className="text-[#5cbab5]">⚙ {snap.salvage}</span>
                    <span className="text-[#9cb2b0]">{formatTime(snap.time)}</span>
                  </div>
                  {snap.combo > 0 && (
                    <div className="h-0.5 bg-black/80 mt-1 overflow-hidden">
                      <div className="h-full bg-[#e0ae56]" style={{ width: `${snap.comboProgress}%` }} />
                    </div>
                  )}
                </div>

                <div className="bg-[#091216]/85 border border-[#94bab6]/20 px-3 py-1.5 text-right max-w-[264px]">
                  <div className="text-[9px] font-bold tracking-[0.16em] text-[#e0ae56] uppercase truncate">
                    {snap.actTitle}
                  </div>
                  <div className="text-[10px] text-[#dbe5e1] leading-snug mt-0.5 break-words">
                    {snap.objectiveText}
                  </div>
                </div>
              </div>
            )}

            {/* Minimap & Compact Square Action Buttons */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-start gap-1.5">
                {snap.touchMode && (
                  <div className="bg-[#091216]/88 border border-[#94bab6]/25 px-2 py-1 text-right min-w-[104px]">
                    <div className="text-[8px] tracking-[0.18em] text-[#889c9a]">SCORE</div>
                    <div className="text-sm font-extrabold tabular-nums text-[#eef4ef] leading-tight">
                      {snap.score.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[9px] tabular-nums mt-0.5 whitespace-nowrap">
                      <span className="text-[#e0ae56] font-bold">x{snap.multiplier}</span>
                      <span className="text-[#5cbab5]">⚙{snap.salvage}</span>
                      <span className="text-[#9cb2b0]">{formatTime(snap.time)}</span>
                    </div>
                  </div>
                )}
                <div
                  className={`relative ${
                    snap.touchMode ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'
                  } rounded-full border border-[#5cbab5]/45 bg-[#030809] overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.7)] shrink-0`}
                >
                  <canvas ref={miniRef} width={220} height={220} className="w-full h-full block" />
                </div>
              </div>

              <div className="flex items-center gap-1 whitespace-nowrap">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.openOverlay('briefcase');
                  }}
                  title="Briefcase & Crafting [I]"
                  className="px-1.5 sm:px-2 py-1 bg-[#091318]/92 hover:bg-[#13262e] border border-[#94bab6]/30 text-[10px] font-bold tracking-wider text-[#e0ae56] whitespace-nowrap shrink-0"
                >
                  {snap.touchMode ? 'BAG' : 'BAG [I]'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.openOverlay('journal');
                  }}
                  title="Journal & Bestiary [J]"
                  className="px-1.5 sm:px-2 py-1 bg-[#091318]/92 hover:bg-[#13262e] border border-[#94bab6]/30 text-[10px] font-bold tracking-wider text-[#5cbab5] whitespace-nowrap shrink-0"
                >
                  {snap.touchMode ? 'LOG' : 'LOG [J]'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.openOverlay('map');
                  }}
                  title="Facility Map [B]"
                  className="px-1.5 sm:px-2 py-1 bg-[#091318]/92 hover:bg-[#13262e] border border-[#94bab6]/30 text-[10px] font-bold tracking-wider text-[#c4d5d2] whitespace-nowrap shrink-0"
                >
                  MAP
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.toggleMute();
                  }}
                  title="Mute / Unmute [M]"
                  className="w-7 h-7 bg-[#091318]/92 hover:bg-[#13262e] border border-[#94bab6]/30 text-[10px] font-bold text-[#c4d5d2] shrink-0"
                >
                  {snap.muted ? '🔇' : '🔊'}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.pause();
                  }}
                  title="Pause [Esc / P]"
                  className="w-7 h-7 bg-[#091318]/92 hover:bg-[#13262e] border border-[#94bab6]/30 text-[10px] font-bold text-[#e3eae5] shrink-0"
                >
                  ❚❚
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Collected Document Note */}
        {snap.docCard && (
          <div className="max-w-[340px] bg-[#0a1317]/95 border border-[#e0ae56]/50 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.8)]">
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#e0ae56] uppercase">
              ▤ {snap.docCard.title}
            </div>
            <div className="text-[11px] text-[#dce6e2] mt-1 leading-relaxed">
              {snap.docCard.body}
            </div>
          </div>
        )}

        {/* Bottom Row (Desktop Only): Forensic Tools | Context Prompt | Active Weapon */}
        {!snap.touchMode && (
          <div className="flex items-end justify-between gap-3">
            {/* Desktop Forensic Tool Readout */}
            <div className="hidden sm:flex flex-col items-start gap-1 pointer-events-auto">
              {snap.camcorderOn && (
                <div className="text-[9px] tracking-[0.16em] text-[#9cb2b0] bg-[#081014]/85 border border-[#e3eae5]/25 px-2 py-0.5">
                  [Z] ZOOM · [X] SNAPSHOT · [C] STOW
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-[#94aba8]">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.toggleCamcorder();
                  }}
                  className={`px-2 py-1 border ${
                    snap.camcorderOn
                      ? 'bg-[#173238] border-[#5cbab5] text-[#e3eae5]'
                      : 'bg-[#081014]/85 border-[#94bab6]/25 hover:border-[#5cbab5]/60'
                  }`}
                >
                  [C] CAM
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.toggleNightVision();
                  }}
                  className={`px-2 py-1 border ${
                    snap.camcorderNv
                      ? 'bg-[#123821] border-[#6fe892] text-[#b4ffca]'
                      : 'bg-[#081014]/85 border-[#94bab6]/25 hover:border-[#6fe892]/60'
                  }`}
                >
                  [N] UV-NV
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.startScentScan();
                  }}
                  className="px-2 py-1 bg-[#081014]/85 border border-[#94bab6]/25 hover:border-[#e0ae56]/60"
                >
                  [V] SCAN
                </button>
              </div>
            </div>

            {/* Bottom-Center Context Interact Button + Flat Hint */}
            <div className="flex flex-col items-center gap-1.5 mx-auto">
              {snap.contextLabel && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    engineRef.current?.interact();
                  }}
                  className="pointer-events-auto px-4 py-1.5 bg-[#0d1c22]/94 border border-[#e0ae56] text-xs font-bold tracking-[0.16em] text-[#eef4ef] uppercase shadow-[0_6px_20px_rgba(0,0,0,0.75)] whitespace-nowrap"
                >
                  <span className="text-[#e0ae56] mr-2">[E]</span>{' '}
                  {snap.contextLabel}
                </button>
              )}
              {snap.hintText && (
                <div className="text-[10px] tracking-[0.18em] text-[#b6c9c5] uppercase hud-text-shadow">
                  {snap.hintText}
                </div>
              )}
            </div>

            {/* Bottom-Right Active Weapon & Ammo Box */}
            <div className="bg-[#091216]/90 border border-[#94bab6]/25 px-3.5 py-2 flex items-center gap-3 pointer-events-auto min-w-[205px]">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.openWheel();
                }}
                title="Open Weapon Wheel [Tab]"
                className="text-[#e0ae56] hover:text-[#fff] transition-colors"
              >
                <WeaponIcon id={snap.weapon} className="w-11 h-7" />
              </button>
              <div className="flex-1 text-right">
                <div className="text-[9px] tracking-[0.18em] text-[#9cb2b0] uppercase">
                  {snap.weaponName} · [TAB]
                </div>
                <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
                  <span
                    className={`text-2xl font-extrabold leading-none ${
                      snap.ammoEmpty
                        ? 'text-[#ff4b4e]'
                        : snap.ammoLow
                          ? 'text-[#e0ae56]'
                          : 'text-[#eef4ef]'
                    }`}
                  >
                    {snap.ammoCur}
                  </span>
                  <span className="text-xs text-[#889c9a]">{snap.ammoRes}</span>
                </div>
                {snap.isReloading && (
                  <div className="h-1 bg-black/80 mt-1 overflow-hidden">
                    <div
                      className="h-full bg-[#e0ae56]"
                      style={{ width: `${snap.reloadPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE LANDSCAPE TOUCH CONTROLS (Active when touchMode === true and playing) */}
      {snap.touchMode && snap.screen === 'playing' && (
        <>
          <div className="fixed inset-0 z-25 pointer-events-none flex items-end justify-between p-3 sm:p-4">
            {/* Left Virtual Move Stick */}
            <div
              className="pointer-events-auto w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-[#94bab6]/30 bg-[#071014]/45 relative flex items-center justify-center touch-none"
              onPointerDown={(e) => {
                if (stickIdRef.current !== null) return;
                stickIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                stickOriginRef.current = { x: e.clientX, y: e.clientY };
                if (engineRef.current) engineRef.current.stick.active = true;
              }}
              onPointerMove={(e) => {
                if (stickIdRef.current !== e.pointerId || !engineRef.current) return;
                const R = 42;
                let dx = e.clientX - stickOriginRef.current.x;
                let dy = e.clientY - stickOriginRef.current.y;
                const l = Math.hypot(dx, dy);
                if (l > R) {
                  dx = (dx / l) * R;
                  dy = (dy / l) * R;
                }
                if (stickKnobRef.current) {
                  stickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
                }
                engineRef.current.stick.x = dx / R;
                engineRef.current.stick.y = dy / R;
              }}
              onPointerUp={(e) => {
                if (stickIdRef.current !== e.pointerId) return;
                stickIdRef.current = null;
                if (stickKnobRef.current) stickKnobRef.current.style.transform = '';
                if (engineRef.current) {
                  engineRef.current.stick.active = false;
                  engineRef.current.stick.x = 0;
                  engineRef.current.stick.y = 0;
                }
              }}
              onPointerCancel={() => {
                stickIdRef.current = null;
                if (stickKnobRef.current) stickKnobRef.current.style.transform = '';
                if (engineRef.current) {
                  engineRef.current.stick.active = false;
                  engineRef.current.stick.x = 0;
                  engineRef.current.stick.y = 0;
                }
              }}
            >
              <div
                ref={stickKnobRef}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#5cbab5] bg-[#142a30]/80"
              />
            </div>

            {/* Right Touch Cluster: Context/Weapon Strip + Action Grid + Fire Pad */}
            <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3">
              <div className="flex flex-col items-end gap-1.5">
                {snap.contextLabel && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.interact()}
                    className="px-2.5 py-1 bg-[#0d1c22]/94 border border-[#e0ae56] text-[9px] font-bold tracking-[0.14em] text-[#e0ae56] uppercase whitespace-nowrap shadow-md"
                  >
                    {snap.contextLabel}
                  </button>
                )}
                <div className="px-2 py-0.5 bg-[#091216]/90 border border-[#94bab6]/25 flex items-center gap-2 text-[9px] font-bold tracking-wider whitespace-nowrap">
                  <span className="text-[#9cb2b0] uppercase">{snap.weaponName}</span>
                  <span className={snap.ammoEmpty ? 'text-[#ff4b4e]' : 'text-[#eef4ef]'}>
                    {snap.ammoCur} {snap.ammoRes}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.toggleCamcorder()}
                    className={`px-2 py-1 border text-[9px] font-bold ${
                      snap.camcorderOn
                        ? 'bg-[#173238] border-[#5cbab5] text-[#eef4ef]'
                        : 'bg-[#091216]/88 border-[#94bab6]/30 text-[#9cb2b0]'
                    }`}
                  >
                    CAM
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.toggleNightVision()}
                    className={`px-2 py-1 border text-[9px] font-bold ${
                      snap.camcorderNv
                        ? 'bg-[#123821] border-[#6fe892] text-[#b4ffca]'
                        : 'bg-[#091216]/88 border-[#94bab6]/30 text-[#9cb2b0]'
                    }`}
                  >
                    UV
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.startScentScan()}
                    className="px-2 py-1 bg-[#091216]/88 border border-[#94bab6]/30 text-[9px] font-bold text-[#e0ae56]"
                  >
                    SCAN
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.openWheel()}
                    className="px-3 py-2 bg-[#0b161b]/88 border border-[#e0ae56]/55 text-[10px] font-bold text-[#e0ae56]"
                  >
                    WPN
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.startReload()}
                    className="px-3 py-2 bg-[#0b161b]/88 border border-[#94bab6]/40 text-[10px] font-bold"
                  >
                    RELOAD
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.dash()}
                    className="px-3 py-2 bg-[#0b161b]/88 border border-[#5cbab5]/55 text-[10px] font-bold text-[#5cbab5]"
                  >
                    DASH
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onPointerDown={() => engineRef.current?.interact()}
                    className={`px-3 py-2 border text-[10px] font-bold ${
                      snap.contextLabel
                        ? 'bg-[#e0ae56] border-[#fff] text-[#050a0c]'
                        : 'bg-[#0b161b]/88 border-[#94bab6]/30 text-[#7d9190]'
                    }`}
                  >
                    {snap.contextShort}
                  </button>
                </div>
              </div>

              {/* Dual-Purpose Look & Auto-Fire Pad */}
              <div
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-[#ff4b4e]/55 bg-[#1b080b]/45 relative flex items-center justify-center touch-none"
                onPointerDown={(e) => {
                  if (lookIdRef.current !== null) return;
                  lookIdRef.current = e.pointerId;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  lookOriginRef.current = { x: e.clientX, y: e.clientY };
                  if (engineRef.current) {
                    engineRef.current.look.active = true;
                    engineRef.current.setTouchFire(true);
                  }
                }}
                onPointerMove={(e) => {
                  if (lookIdRef.current !== e.pointerId || !engineRef.current) return;
                  const R = 42;
                  let dx = e.clientX - lookOriginRef.current.x;
                  let dy = e.clientY - lookOriginRef.current.y;
                  const l = Math.hypot(dx, dy);
                  if (l > R) {
                    dx = (dx / l) * R;
                    dy = (dy / l) * R;
                  }
                  if (lookKnobRef.current) {
                    lookKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
                  }
                  if (l > 10) {
                    engineRef.current.look.ang = Math.atan2(dy, dx);
                    engineRef.current.look.firing = true;
                  }
                }}
                onPointerUp={(e) => {
                  if (lookIdRef.current !== e.pointerId) return;
                  lookIdRef.current = null;
                  if (lookKnobRef.current) lookKnobRef.current.style.transform = '';
                  if (engineRef.current) {
                    engineRef.current.look.active = false;
                    engineRef.current.look.firing = false;
                    engineRef.current.setTouchFire(false);
                  }
                }}
                onPointerCancel={() => {
                  lookIdRef.current = null;
                  if (lookKnobRef.current) lookKnobRef.current.style.transform = '';
                  if (engineRef.current) {
                    engineRef.current.look.active = false;
                    engineRef.current.look.firing = false;
                    engineRef.current.setTouchFire(false);
                  }
                }}
              >
                <div
                  ref={lookKnobRef}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-[#ff4b4e] bg-[#4a1116]/80 flex items-center justify-center text-[10px] font-bold text-[#ffd4d4]"
                >
                  FIRE
                </div>
              </div>
            </div>
          </div>

          {/* Portrait Rotate Prompt on Mobile Phones */}
          <div className="portrait-rotate-gate hidden fixed inset-0 z-50 bg-[#020506] flex-col items-center justify-center p-6 text-center pointer-events-auto">
            <div className="text-lg font-bold tracking-[0.22em] text-[#e0ae56] uppercase">
              ROTATE TO LANDSCAPE
            </div>
            <p className="text-xs text-[#9cb2b0] mt-2 max-w-xs">
              St. Jude tactical controls require horizontal orientation for dual-stick movement and aiming.
            </p>
          </div>
        </>
      )}
    </>
  );
};
