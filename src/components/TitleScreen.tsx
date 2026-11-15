import React from 'react';
import { HudSnapshot, SLOTS, WPN } from '../game/types';
import { TitleEmblem, WeaponIcon } from './Icons';

interface TitleScreenProps {
  snap: HudSnapshot;
  onStartStory: () => void;
  onStartEndless: () => void;
  onContinue: () => void;
  onOpenModal: (m: 'sectors' | 'scores' | 'settings' | 'help' | 'profile' | 'credits') => void;
  onToggleLang: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  snap,
  onStartStory,
  onStartEndless,
  onContinue,
  onOpenModal,
  onToggleLang,
}) => {
  const rankLevel = Math.floor((snap.profile.xp || 0) / 100) + 1;
  const ar = snap.lang === 'ar';

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-8 lg:p-12 bg-gradient-to-r from-[#020506]/90 via-[#040a0d]/55 to-[#040a0d]/35 pointer-events-auto"
    >
      {/* Top Bar Telemetry + EN/AR Toggle */}
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] tracking-[0.2em] text-[#9cb2b0] uppercase">
        <span>
          {ar
            ? `أرشيف مستشفى سانت جود ١٩٩٨ // تصريح مستوى ${rankLevel}`
            : `ST. JUDE ARCHIVE 1998 // CLEARANCE LV.${rankLevel}`}
        </span>
        <div className="flex items-center gap-4">
          {snap.bestScore > 0 && (
            <span className="tabular-nums text-[#e0ae56]">
              {ar ? 'أعلى نتيجة ' : 'RECORD '}
              {snap.bestScore.toLocaleString()} PTS
            </span>
          )}
          <button
            type="button"
            onClick={onToggleLang}
            className="px-2.5 py-1 bg-[#081216]/90 hover:bg-[#13262d] border border-[#5cbab5]/45 text-[10px] font-bold tracking-[0.14em] text-[#5cbab5] transition-colors"
          >
            {ar ? 'ENGLISH' : 'العربية'}
          </button>
        </div>
      </div>

      {/* Main 2-Column Showcase Grid */}
      <div className="my-auto flex items-center justify-between gap-8">
        {/* Left Action Stack */}
        <div className="max-w-[560px] w-full flex flex-col gap-4 sm:gap-5">
          <TitleEmblem />

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-1">
            {snap.hasSave && snap.saveSummary && (
              <button
                type="button"
                onClick={onContinue}
                className="px-5 py-3 bg-[#12262b]/95 hover:bg-[#1b3a42] border border-[#5cbab5]/80 text-[#e3eae5] text-xs font-bold tracking-[0.16em] uppercase whitespace-nowrap transition-colors text-left"
              >
                {ar
                  ? `متابعة المناوبة · فصل ${snap.saveSummary.act} (${snap.saveSummary.score.toLocaleString()})`
                  : `CONTINUE SHIFT · ACT ${snap.saveSummary.act} (${snap.saveSummary.score.toLocaleString()})`}
              </button>
            )}

            <button
              type="button"
              data-start="true"
              onClick={onStartStory}
              className="px-6 py-3.5 bg-[#9c262a] hover:bg-[#be3035] border border-[#ff5f62]/75 text-[#fff6f2] text-xs font-bold tracking-[0.2em] uppercase whitespace-nowrap transition-colors shadow-[0_8px_28px_rgba(156,38,42,0.5)]"
            >
              {ar ? 'بدء حملة القصة (٦ فصول)' : 'BEGIN STORY CAMPAIGN'}
            </button>

            <button
              type="button"
              onClick={onStartEndless}
              className="px-5 py-3.5 bg-[#0b1519]/92 hover:bg-[#14252c] border border-[#e0ae56]/65 text-[#e0ae56] text-xs font-bold tracking-[0.18em] uppercase whitespace-nowrap transition-colors"
            >
              {ar ? 'طور البقاء اللانهائي' : 'ENDLESS NIGHTMARE'}
            </button>
          </div>

          {/* Structured Archive Menu Row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] tracking-[0.14em] uppercase">
            {(
              [
                ['sectors', ar ? 'الأجنحة' : 'SECTORS', 'hover:border-[#5cbab5] hover:text-[#5cbab5]'],
                ['profile', ar ? 'الملف' : 'OPERATIVE', 'hover:border-[#5cbab5] hover:text-[#5cbab5]'],
                ['scores', ar ? 'النتائج' : 'HIGH SCORES', 'hover:border-[#e0ae56] hover:text-[#e0ae56]'],
                ['settings', ar ? 'الإعدادات' : 'SETTINGS', 'hover:border-[#e3eae5] hover:text-[#e3eae5]'],
                ['help', ar ? 'الدليل' : 'MANUAL', 'hover:border-[#e3eae5] hover:text-[#e3eae5]'],
                ['credits', ar ? 'الاعتمادات' : 'CREDITS', 'hover:border-[#e0ae56] hover:text-[#e0ae56]'],
              ] as const
            ).map(([key, label, cls]) => (
              <button
                key={key}
                type="button"
                onClick={() => onOpenModal(key)}
                className={`px-2.5 py-1.5 bg-[#071014]/88 border border-[#94bab6]/25 text-[#b5c7c4] transition-colors whitespace-nowrap ${cls}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Incident Briefing Dossier Card (Desktop Showcase) */}
        <div className="hidden lg:flex flex-col gap-3.5 w-[368px] panel-surface p-5 shrink-0">
          <div className="flex items-start justify-between gap-3 border-b border-[#94bab6]/20 pb-2.5">
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.22em] text-[#ff4b4e] font-bold uppercase">
                {ar ? 'تنبيه احتواء نشط' : 'LOCKDOWN INCIDENT BRIEFING'}
              </div>
              <div className="text-sm font-bold tracking-[0.12em] text-[#eef4ef] mt-0.5 truncate">
                {ar ? 'بروتوكول ٩٨ — نسخة المخرج' : 'PROTOCOL 98 · ST. JUDE B2'}
              </div>
            </div>
            <span className="text-[10px] tabular-nums text-[#e0ae56] font-bold shrink-0">23.12.98</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            {[
              [ar ? 'فصول القصة' : 'STORY ACTS', '06'],
              [ar ? 'الترسانة' : 'WEAPONS', '06'],
              [ar ? 'القدرات الخاصة' : 'POWERS', '04'],
              [ar ? 'فئات الأعداء' : 'THREATS', '09'],
            ].map(([lbl, num]) => (
              <div key={lbl} className="bg-[#060d11] border border-[#94bab6]/18 px-2.5 py-2">
                <div className="text-[8.5px] tracking-[0.16em] text-[#889c9a] uppercase">{lbl}</div>
                <div className="text-base font-extrabold tabular-nums text-[#5cbab5]">{num}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-[9px] tracking-[0.18em] text-[#889c9a] uppercase mb-1.5">
              {ar ? 'العتاد المعتمد' : 'ISSUE TACTICAL LOADOUT'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SLOTS.map((s) => (
                <div
                  key={s}
                  title={WPN[s].name}
                  className="bg-[#060c10] border border-[#94bab6]/20 py-1.5 px-2 flex flex-col items-center gap-1"
                >
                  <WeaponIcon id={s} className="w-8 h-5 text-[#e0ae56]" />
                  <span className="text-[8px] tracking-wider text-[#b6c9c5] truncate max-w-full">
                    {WPN[s].id.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#94bab6]/20 pt-2.5 flex items-center justify-between text-[10px] text-[#9cb2b0] tabular-nums">
            <span>
              {ar ? 'عمليات القتل:' : 'KILLS:'}{' '}
              <strong className="text-[#eef4ef]">{snap.profile.kills}</strong>
            </span>
            <span>
              {ar ? 'المناوبات:' : 'SHIFTS:'}{' '}
              <strong className="text-[#e0ae56]">{snap.profile.shifts}</strong>
            </span>
            <span className={snap.profile.storyCleared ? 'text-[#78e6a8] font-bold' : 'text-[#889c9a]'}>
              {snap.profile.storyCleared
                ? ar
                  ? 'مكتمل ✓'
                  : 'CLEARED ✓'
                : ar
                  ? 'نشط'
                  : 'ACTIVE'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Control Hint */}
      <div className="text-[10px] sm:text-[11px] tracking-[0.15em] text-[#9cb2b0] uppercase hud-text-shadow">
        {ar
          ? 'WASD تحرك · الماوس تصويب وإطلاق · Space اندفاع · Tab عجلة الأسلحة · Q/T/G/H قدرات · E تفاعل · I الحقيبة · Esc إيقاف'
          : 'WASD Move · Mouse Aim/Fire · Space Dash · Tab Weapon Wheel · Q/T/G/H Powers · C/N UV Cam · V Scan · E Interact · I Briefcase · Esc Pause'}
      </div>
    </div>
  );
};
