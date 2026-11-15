import React from 'react';
import { AbilityId, WeaponId } from '../game/types';

export const WeaponIcon: React.FC<{ id: WeaponId; className?: string }> = ({
  id,
  className = 'w-10 h-6',
}) => {
  switch (id) {
    case 'pistol':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path d="M5 7H38V15H25L22 18H18L15 29H8L11 15H5Z" stroke="#060c0e" strokeWidth="1.4" />
        </svg>
      );
    case 'shotgun':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path
            d="M2 11H36L40 9H46V15H40L37 18H27L24 25H18L20 18H13L11 15H2Z"
            stroke="#060c0e"
            strokeWidth="1.4"
          />
          <rect x="21" y="13" width="10" height="3" fill="#060c0e" opacity="0.55" />
        </svg>
      );
    case 'smg':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path
            d="M4 10H37V16H30L28 28H23L24 16H17L14 25H9L11 16H4Z"
            stroke="#060c0e"
            strokeWidth="1.4"
          />
          <rect x="37" y="11" width="7" height="3" />
        </svg>
      );
    case 'bat':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path d="M6 26L34 8Q38 6 40 9Q42 12 38 14L10 31Q6 32 5 29Z" stroke="#060c0e" strokeWidth="1.3" />
          <path d="M31 10L39 14" stroke="#62e8ff" strokeWidth="2.2" />
        </svg>
      );
    case 'cryo':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path
            d="M3 10H33L39 8H45V16H39L34 19H22L19 27H13L15 19H8L6 16H3Z"
            stroke="#060c0e"
            strokeWidth="1.4"
          />
          <path d="M16 13H38" stroke="#62e8ff" strokeWidth="2.5" />
        </svg>
      );
    case 'flare':
      return (
        <svg viewBox="0 0 48 32" className={className} fill="currentColor" aria-hidden="true">
          <path d="M10 28L7 25L21 11L24 14Z" stroke="#060c0e" strokeWidth="1.2" />
          <circle cx="30" cy="10" r="4.5" fill="#ff9a3a" />
          <path d="M35 5L39 2M38 11H44M30 4V0" stroke="#ffd27a" strokeWidth="2" />
        </svg>
      );
  }
};

export const AbilityIcon: React.FC<{ id: AbilityId; className?: string }> = ({
  id,
  className = 'w-4 h-4',
}) => {
  switch (id) {
    case 'emp':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" fill="currentColor" opacity="0.25" />
          <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" />
        </svg>
      );
    case 'chrono':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 3h6" />
        </svg>
      );
    case 'grenade':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="14" r="6" />
          <path d="M10 8V5h4v3M14 5l3-2" />
        </svg>
      );
    case 'stim':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" strokeWidth="2.8" />
        </svg>
      );
  }
};

export type MaterialKind = 'scrap' | 'biogel' | 'cells' | 'fuel' | 'medkits' | 'grenades' | 'keycards';

export const MaterialIcon: React.FC<{ kind: MaterialKind; className?: string }> = ({
  kind,
  className = 'w-5 h-5',
}) => {
  switch (kind) {
    case 'scrap':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.2 2.2M16.8 16.8L19 19M19 5l-2.2 2.2M7.2 16.8L5 19" />
        </svg>
      );
    case 'biogel':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 3h6M10 3v5l-4 7a3 3 0 002.6 4.5h6.8A3 3 0 0018 15l-4-7V3" />
          <path d="M7.5 14.5h9" stroke="#78e6a8" />
        </svg>
      );
    case 'cells':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="6" y="5" width="12" height="16" rx="1.5" />
          <path d="M9 3h6M13 8l-3 5h4l-2 5" stroke="#62e8ff" />
        </svg>
      );
    case 'fuel':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 7h8l3 3v10H6V7z" />
          <path d="M9 4h4v3M10 12v4M14 14h2.5" stroke="#ff9a3a" />
        </svg>
      );
    case 'medkits':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="6" width="18" height="14" rx="1.5" />
          <path d="M9 6V4h6v2" />
          <path d="M12 9.5v7M8.5 13h7" stroke="#ff4b4e" strokeWidth="2.4" />
        </svg>
      );
    case 'grenades':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="14" r="6.5" />
          <path d="M10 7.5V4.5h4v3M14 5l3-2M7.5 14h9M12 9.5v9" />
        </svg>
      );
    case 'keycards':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
          <path d="M3 10h18M7 14h4M15 14h2" stroke="#e0ae56" />
        </svg>
      );
  }
};

export const TitleEmblem: React.FC = () => (
  <div dir="ltr" className="w-full max-w-[560px]">
    <svg
      viewBox="0 0 600 136"
      className="w-full h-auto"
      style={{ direction: 'ltr' }}
      aria-label="SHIFT REPORT: PROTOCOL 98"
    >
      <defs>
        <linearGradient id="ambBar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e0ae56" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#5cbab5" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#9c262a" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* St. Jude Medical Cross Seal */}
      <g transform="translate(8, 16)">
        <polygon points="18,0 58,0 76,18 76,58 58,76 18,76 0,58 0,18" fill="#0d171b" stroke="#5cbab5" strokeOpacity="0.45" strokeWidth="1.5" />
        <rect x="31" y="16" width="14" height="44" fill="#9c262a" />
        <rect x="16" y="31" width="44" height="14" fill="#9c262a" />
        <rect x="33" y="18" width="10" height="40" fill="#ff4b4e" opacity="0.65" />
        <rect x="18" y="33" width="40" height="10" fill="#ff4b4e" opacity="0.65" />
      </g>
      <text x="104" y="32" textAnchor="start" fill="#e0ae56" fontSize="10.5" fontWeight="700" letterSpacing="3">
        ST. JUDE MEMORIAL HOSPITAL · LOCKDOWN BUILD
      </text>
      <text x="102" y="76" textAnchor="start" fill="#eef4ef" fontSize="42" fontWeight="800" letterSpacing="2">
        SHIFT REPORT
      </text>
      <rect x="104" y="88" width="460" height="2.5" fill="url(#ambBar)" />
      <text x="104" y="114" textAnchor="start" fill="#5cbab5" fontSize="16" fontWeight="700" letterSpacing="5.5">
        PROTOCOL 98 — DIRECTOR&apos;S CUT
      </text>
    </svg>
  </div>
);
