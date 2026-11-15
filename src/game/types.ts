export type GameScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'wheel'
  | 'map'
  | 'briefcase'
  | 'journal'
  | 'puzzle'
  | 'cutscene'
  | 'gameover';

export type GameMode = 'story' | 'endless';
export type WeaponId = 'pistol' | 'shotgun' | 'smg' | 'bat' | 'cryo' | 'flare';
export type EnemyType =
  | 'walker'
  | 'runner'
  | 'spitter'
  | 'stalker'
  | 'riot'
  | 'crawler'
  | 'warden'
  | 'chirurgeon'
  | 'omega';

export type AbilityId = 'emp' | 'chrono' | 'grenade' | 'stim';
export type SectorId = 'RECEPTION' | 'WARDB' | 'ICU' | 'RADIOLOGY' | 'MORGUE' | 'REACTOR';
export type ClueId = 'dust' | 'aldehydes' | 'geosmin' | 'metallic' | 'linen';
export type ClueState = 'none' | 'detected' | 'confirmed';
export type PuzzleKind = 'keypad' | 'circuit' | 'oscilloscope';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Obstacle extends Rect {
  t: 'wall' | 'desk' | 'bed' | 'pillar' | 'crate' | 'locker' | 'door' | 'prop';
  propId?: string;
  used?: boolean;
}

export interface HospitalRoom extends Rect {
  id: string;
  code: string;
  name: string;
  short: string;
  sector: SectorId;
  tint: string;
}

export interface HospitalDoor extends Rect {
  id: string;
  name: string;
  orientation: 'h' | 'v';
  obs: Obstacle;
  open: boolean;
  lockedKind?: 'keycard' | 'keypad' | 'circuit' | 'oscilloscope' | 'escape';
  unlockHint?: string;
}

export type GameLang = 'en' | 'ar';
export type ControlMode = 'auto' | 'desktop' | 'touch';

export interface HospitalProp {
  id: string;
  kind:
    | 'bed'
    | 'monitor'
    | 'iv'
    | 'wheelchair'
    | 'trolley'
    | 'console'
    | 'chair'
    | 'scanner'
    | 'labbench'
    | 'autoclave'
    | 'coldcab'
    | 'table'
    | 'medstation'
    | 'bin'
    | 'extinguisher'
    | 'camera'
    | 'cryopod'
    | 'gurney'
    | 'surgical_table'
    | 'xray_box'
    | 'bio_drum'
    | 'sandbag'
    | 'defib'
    | 'glass_shard'
    | 'corpse'
    | 'ceiling_fan'
    | 'generator'
    | 'medshelf'
    | 'crash_cart'
    | 'anesthesia'
    | 'bio_tank'
    | 'cabinet'
    | 'fridge'
    | 'exit_sign'
    | 'desk_lamp';
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  solid?: boolean;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortRole: string;
  key: number;
  mag?: number;
  rate: number;
  reload?: number;
  dmg: number;
  pellets?: number;
  melee?: boolean;
  cryo?: boolean;
  flare?: boolean;
  spread?: number;
  speed?: number;
}

export interface EnemySpec {
  id: EnemyType;
  label: string;
  r: number;
  hp: number;
  spd: number;
  dmg: number;
  score: number;
  isBoss?: boolean;
  desc: string;
}

export interface RecipeSpec {
  id: string;
  name: string;
  desc: string;
  cost: Partial<InventoryCounts>;
  yieldLabel: string;
}

export interface UpgradeSpec {
  id: 'dmg' | 'hp' | 'bat' | 'cd';
  name: string;
  desc: string;
  maxLv: number;
  baseCost: number;
}

export interface InventoryCounts {
  salvage: number;
  scrap: number;
  biogel: number;
  cells: number;
  fuel: number;
  medkits: number;
  grenades: number;
  icuKeycard: number;
  morgueKeycard: number;
  reactorOverride: number;
}

export interface CutsceneLine {
  speaker: string;
  role: string;
  portrait: 'guard' | 'dispatch' | 'doctor' | 'omega';
  text: string;
}

export interface GameConfig {
  master: number;
  amb: number;
  foley: number;
  cre: number;
  ui: number;
  quality: 'auto' | 'low' | 'med' | 'high';
  shake: number;
  grain: 'off' | 'low' | 'high';
  colorStrength: number;
  brightness: number;
  reduceFlash: boolean;
  reduceMotion: boolean;
  startSector: SectorId;
  aimAssist: number;
  touchScale: number;
  touchOpacity: number;
  muted: boolean;
  lang: GameLang;
  controlMode: ControlMode;
}

export interface HighScoreEntry {
  score: number;
  mode: GameMode;
  act: number;
  wave: number;
  kills: number;
  time: number;
  date: number;
}

export interface ProfileData {
  xp: number;
  shifts: number;
  kills: number;
  photos: number;
  storyCleared: boolean;
  secrets: string[];
  bestiary: Record<string, number>;
  evidence: Record<string, ClueState | number>;
}

export interface HudSnapshot {
  screen: GameScreenState;
  mode: GameMode;
  act: number;
  actTitle: string;
  objectiveText: string;
  subObjectiveText: string;
  escapeTimer: number | null;
  score: number;
  bestScore: number;
  combo: number;
  comboProgress: number;
  multiplier: number;
  kills: number;
  time: number;
  wave: number;
  waveActive: boolean;
  waveKilled: number;
  waveTotal: number;
  waveBreak: number;
  hp: number;
  maxHp: number;
  stam: number;
  bat: number;
  flashOn: boolean;
  weapon: WeaponId;
  weaponName: string;
  ammoCur: string;
  ammoRes: string;
  ammoLow: boolean;
  ammoEmpty: boolean;
  reloadPct: number;
  isReloading: boolean;
  salvage: number;
  sectorLabel: string;
  roomLabel: string;
  docsFound: number;
  docsTotal: number;
  unlocked: Record<WeaponId, boolean>;
  ammoAll: Record<WeaponId, { mag: number; res: number }>;
  abilities: Record<AbilityId, { cd: number; maxCd: number; active: number }>;
  chronoActive: boolean;
  camcorderOn: boolean;
  camcorderNv: boolean;
  camcorderZoom: number;
  camcorderBat: number;
  camcorderSig: number;
  scentScanning: number;
  evidenceSummary: string;
  evidenceMap: Record<ClueId, ClueState>;
  uvDigitsFound: string[];
  boss: { name: string; hp: number; maxHp: number; phase: number } | null;
  contextLabel: string | null;
  contextShort: string;
  contextKind: string | null;
  toastText: string | null;
  banner: { title: string; sub: string; icon: string } | null;
  docCard: { title: string; body: string } | null;
  hintText: string | null;
  hurtAlpha: number;
  lowHpAlpha: number;
  glitchIntensity: number;
  inventory: InventoryCounts;
  upgrades: Record<'dmg' | 'hp' | 'bat' | 'cd', number>;
  collectedDocs: { title: string; body: string; sector: string }[];
  puzzle: {
    kind: PuzzleKind;
    doorId: string;
    title: string;
    subtitle: string;
    circuitGrid?: { kind: 'straight' | 'corner' | 'tee' | 'cross' | 'source' | 'sink'; rot: number; powered?: boolean }[];
    oscTarget?: { freq: number; amp: number; phase: number };
  } | null;
  cutscene: {
    title: string;
    lines: CutsceneLine[];
    index: number;
  } | null;
  gameOver: {
    victory: boolean;
    score: number;
    newBest: boolean;
    rank: number;
    act: number;
    wave: number;
    kills: number;
    maxCombo: number;
    time: number;
    docsFound: number;
    bossRemainingPct: number | null;
    scores: HighScoreEntry[];
  } | null;
  touchMode: boolean;
  controlMode: ControlMode;
  lang: GameLang;
  blackoutSector: string | null;
  muted: boolean;
  hasSave: boolean;
  saveSummary: { mode: GameMode; act: number; wave: number; score: number; time: number } | null;
  profile: ProfileData;
  scores: HighScoreEntry[];
  wheelSelected: WeaponId;
  wheelHover: WeaponId | null;
}

export const WW = 2600;
export const WH = 1800;

export const SLOTS: WeaponId[] = ['pistol', 'shotgun', 'smg', 'bat', 'cryo', 'flare'];

export const WPN: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    name: 'SERVICE PISTOL',
    shortRole: '9mm · Reliable Precision',
    key: 1,
    mag: 12,
    rate: 0.2,
    reload: 0.95,
    dmg: 28,
    spread: 0.03,
    speed: 980,
  },
  shotgun: {
    id: 'shotgun',
    name: 'PUMP SHOTGUN',
    shortRole: '12G · 8-Pellet Close Burst',
    key: 2,
    mag: 6,
    rate: 0.72,
    reload: 1.55,
    dmg: 12,
    pellets: 8,
    spread: 0.24,
    speed: 880,
  },
  smg: {
    id: 'smg',
    name: 'MP-98 TACTICAL',
    shortRole: 'SMG · Rapid Crowd Suppression',
    key: 3,
    mag: 32,
    rate: 0.088,
    reload: 1.35,
    dmg: 16,
    spread: 0.085,
    speed: 1020,
  },
  bat: {
    id: 'bat',
    name: 'SHOCK BATON',
    shortRole: 'Melee · Stun Arc Sweep',
    key: 4,
    melee: true,
    rate: 0.38,
    dmg: 48,
  },
  cryo: {
    id: 'cryo',
    name: 'CRYO-ARC CARBINE',
    shortRole: 'Energy · Chain Lightning + Slow',
    key: 5,
    mag: 18,
    rate: 0.28,
    reload: 1.45,
    dmg: 24,
    cryo: true,
    spread: 0.02,
    speed: 1120,
  },
  flare: {
    id: 'flare',
    name: 'ROAD FLARE',
    shortRole: 'Thrown · Light, Lure & Burn DoT',
    key: 6,
    flare: true,
    rate: 0.75,
    dmg: 12,
  },
};

export const ETYPE: Record<EnemyType, EnemySpec> = {
  walker: {
    id: 'walker',
    label: 'PATIENT ZERO-TYPE',
    r: 13,
    hp: 58,
    spd: 68,
    dmg: 11,
    score: 100,
    desc: 'Infected ward patient. Relentless pursuit with erratic lunging gait.',
  },
  runner: {
    id: 'runner',
    label: 'HEMORRHAGIC SPRINTER',
    r: 11,
    hp: 34,
    spd: 138,
    dmg: 9,
    score: 150,
    desc: 'Hyper-aggressive flanker. Circles narrow sightlines at high speed.',
  },
  spitter: {
    id: 'spitter',
    label: 'BILE VECTOR',
    r: 13,
    hp: 48,
    spd: 76,
    dmg: 13,
    score: 190,
    desc: 'Ranged kiter. Telegraphs caustic projectile that leaves an acid hazard pool.',
  },
  stalker: {
    id: 'stalker',
    label: 'PHANTOM STALKER',
    r: 12,
    hp: 64,
    spd: 126,
    dmg: 16,
    score: 240,
    desc: 'Phase-cloaked ambush predator. Exposed by torch beam, damage, or Night Vision.',
  },
  riot: {
    id: 'riot',
    label: 'ARMORED ORDERLY',
    r: 17,
    hp: 150,
    spd: 54,
    dmg: 18,
    score: 280,
    desc: 'Ballistic front plate absorbs 75% frontal damage. Flank, EMP, or Cryo-Arc to break.',
  },
  crawler: {
    id: 'crawler',
    label: 'VENT CRAWLER',
    r: 9,
    hp: 24,
    spd: 150,
    dmg: 7,
    score: 120,
    desc: 'Low-profile swarmer emerging from service ducts in packs.',
  },
  warden: {
    id: 'warden',
    label: 'THE WARDEN',
    r: 28,
    hp: 620,
    spd: 62,
    dmg: 32,
    score: 1200,
    isBoss: true,
    desc: 'Heavy lockdown enforcer. Telegraphs bull-rush charges that stun on wall impact.',
  },
  chirurgeon: {
    id: 'chirurgeon',
    label: 'THE CHIRURGEON',
    r: 26,
    hp: 840,
    spd: 72,
    dmg: 28,
    score: 1800,
    isBoss: true,
    desc: 'Morgue chief mutated by Protocol 98. Launches radial bile volleys & summons crawlers.',
  },
  omega: {
    id: 'omega',
    label: 'SUBJECT OMEGA',
    r: 32,
    hp: 1350,
    spd: 78,
    dmg: 36,
    score: 3500,
    isBoss: true,
    desc: 'Reactor containment breach origin. Alternates dash charges, nova bursts, and shockwaves.',
  },
};

export const ECOL: Record<EnemyType, { skin: string; body: string; stain: string; eye: string }> = {
  walker: { skin: '#7f8c73', body: '#aab6b6', stain: '#7a1d1d', eye: '#ff3a2e' },
  runner: { skin: '#94655e', body: '#7a4a4a', stain: '#3a0e0e', eye: '#ff5244' },
  spitter: { skin: '#7fa858', body: '#415b38', stain: '#9cf542', eye: '#b9ff4a' },
  stalker: { skin: '#586d78', body: '#1f2d34', stain: '#348999', eye: '#70e8ff' },
  riot: { skin: '#647075', body: '#273238', stain: '#b87b28', eye: '#ffae38' },
  crawler: { skin: '#8a5d58', body: '#523434', stain: '#8f1b24', eye: '#ff4b4e' },
  warden: { skin: '#5b4a46', body: '#3d4b3a', stain: '#2a0a0a', eye: '#ff3028' },
  chirurgeon: { skin: '#829c84', body: '#b8c4bc', stain: '#1e7844', eye: '#6dff92' },
  omega: { skin: '#5e3f4c', body: '#261822', stain: '#cf2744', eye: '#ff2e58' },
};

export const RECIPES: RecipeSpec[] = [
  {
    id: 'craft_pistol',
    name: '9mm Tactical Box',
    desc: 'Press +24 Pistol & +32 SMG rounds from salvaged brass.',
    cost: { scrap: 2 },
    yieldLabel: '+24 PISTOL / +32 SMG',
  },
  {
    id: 'craft_shells',
    name: '12G Buckshot & Cryo',
    desc: 'Assemble +8 Shotgun shells and +18 Cryo-Arc charges.',
    cost: { scrap: 2, cells: 1 },
    yieldLabel: '+8 SHELLS / +18 CRYO',
  },
  {
    id: 'craft_medkit',
    name: 'Trauma Field Kit',
    desc: 'Synthesize +1 Emergency Medkit (+45 HP instant restore).',
    cost: { biogel: 2, scrap: 1 },
    yieldLabel: '+1 MEDKIT',
  },
  {
    id: 'craft_ordnance',
    name: 'Frag & Flare Pack',
    desc: 'Pack +1 Frag Grenade (G) and +2 Road Flares.',
    cost: { scrap: 2, fuel: 1 },
    yieldLabel: '+1 GRENADE / +2 FLARES',
  },
];

export const UPGRADES: UpgradeSpec[] = [
  { id: 'dmg', name: 'Ballistic Rifling', desc: '+15% weapon & melee damage per tier', maxLv: 4, baseCost: 120 },
  { id: 'hp', name: 'Kevlar Scrubs', desc: '+25 Max HP & immediate heal', maxLv: 4, baseCost: 110 },
  { id: 'bat', name: 'Lithium Capacitor', desc: '-20% torch & camcorder drain, faster recharge', maxLv: 4, baseCost: 95 },
  { id: 'cd', name: 'Neural Relay', desc: '-15% EMP, Chrono, & Stim cooldowns', maxLv: 4, baseCost: 130 },
];

export const CLUES: Record<
  ClueId,
  { name: string; glyph: string; col: string; desc: string; base: SectorId[]; confirmHint: string }
> = {
  dust: {
    name: 'DUST',
    glyph: '▦',
    col: '#cfc7b0',
    desc: 'Settled particulate — sealed offices, dead vents, archived manifests.',
    base: ['RECEPTION'],
    confirmHint: 'Scan near paperwork, then inspect a shift report.',
  },
  aldehydes: {
    name: 'ALDEHYDES',
    glyph: '✚',
    col: '#9fd8cf',
    desc: 'Sharp clinical embalming & sterilizer vapor.',
    base: ['ICU', 'MORGUE'],
    confirmHint: 'Scan inside ICU or Morgue, then read a report.',
  },
  geosmin: {
    name: 'GEOSMIN',
    glyph: '≈',
    col: '#8fb26a',
    desc: 'Standing cold water & broken drain seals.',
    base: ['MORGUE', 'RADIOLOGY'],
    confirmHint: 'Locate a water leak or scan near one three times.',
  },
  metallic: {
    name: 'METALLIC NOTES',
    glyph: '⚙',
    col: '#d8b46a',
    desc: 'Ozone, iron filings, and forced locker latches.',
    base: ['RADIOLOGY', 'REACTOR'],
    confirmHint: 'Open a supply locker or reset a tripped breaker.',
  },
  linen: {
    name: 'LINEN',
    glyph: '▤',
    col: '#d8d8e2',
    desc: 'Bleached ward sheets stained with black bile.',
    base: ['WARDB'],
    confirmHint: 'Scan Ward B beds, then inspect a Ward B report.',
  },
};

export const DOCS_TXT: [string, string][] = [
  ['PATIENT #1047', '"A man in the elevator," he kept repeating. The elevator shaft was bricked in 1989. Dosage tripled.'],
  ['NIGHT GUARD MEMO', '02:40 — Door B-4 opened from inside. Security Keypad PIN split onto UV wall markers: 4-8-2-7.'],
  ['MISSING MEDS LOG', 'Four cryo-ampoules missing since Dec 20. Partial print matches Nurse Vance, deceased 1996.'],
  ['SURGEON FILE', 'Subject remained lucid under propofol. Claimed he saw "Protocol 98" breathing beneath Floor B2.'],
  ['X-RAY, DATED 23/12', 'Crystalline lattice forming along cervical spine. Emits 1.8 kHz bio-resonance on contact.'],
  ['AUTOPSY 003 — CLASSIFIED', 'All vitals flatlined for 14 hours before subject stood up and dismantled the cold cabinet.'],
  ['SHIFT ENGINEER NOTE', 'Nurse Station conduit relay failed. Rotate grid tiles to reconnect main power to the East Wing.'],
  ['REACTOR CONTAINMENT LOG', 'Harmonic lock requires exact bio-frequency calibration at the Console before Subject Omega escapes.'],
];

export const STORY_ACTS = [
  {
    act: 1,
    title: 'ACT I · SILENT SHIFT',
    objective: 'Investigate Reception & Ward B terminal, or unlock Ward B Security',
    sub: 'Press C + N for Camcorder Night Vision to reveal hidden UV Keypad digits (4-8-2-7)',
  },
  {
    act: 2,
    title: 'ACT II · LOCKDOWN BREACH',
    objective: 'Access Ward B / ICU & defeat The Warden',
    sub: 'Restore Nurse Station Circuit Conduit or breach ICU Keycard Door',
  },
  {
    act: 3,
    title: 'ACT III · COLD STORAGE',
    objective: 'Enter the Morgue & neutralize The Chirurgeon',
    sub: 'Watch for Spitter acid pools — shoot red O2 canisters for chain explosions',
  },
  {
    act: 4,
    title: 'ACT IV · REACTOR CALIBRATION',
    objective: 'Calibrate Reactor Bio-Frequency Console',
    sub: 'Use Radiology & Morgue salvage to upgrade Cryo-Arc Carbine at [I] Briefcase',
  },
  {
    act: 5,
    title: 'ACT V · SUBJECT OMEGA',
    objective: 'Contain Subject Omega inside Reactor Labs',
    sub: 'Use Chrono-Stasis [T] and EMP Surge [Q] to interrupt Omega charges',
  },
  {
    act: 6,
    title: 'ACT VI · PROTOCOL 98 ESCAPE',
    objective: 'Reach Reception Main Airlock before meltdown!',
    sub: 'Follow the gold waypoint arrow north-west — doors are blown open',
  },
];

export const SECTORS: Record<
  SectorId,
  {
    label: string;
    rects: [number, number, number, number][];
    tint: [number, number, number];
    tintA: number;
    surface: 'tile' | 'concrete';
    hum: number;
    vent: number;
    drip: number;
    scents: ClueId[];
    emerg: [number, number][];
    breaker?: [number, number];
  }
> = {
  RECEPTION: {
    label: 'RECEPTION',
    rects: [[780, 440, 1280, 940]],
    tint: [168, 196, 188],
    tintA: 0.11,
    surface: 'tile',
    hum: 0.5,
    vent: 0.35,
    drip: 0,
    scents: ['dust'],
    emerg: [[860, 480], [1160, 900]],
    breaker: [720, 490],
  },
  WARDB: {
    label: 'WARD B',
    rects: [[60, 60, 780, 700], [780, 60, 1080, 440]],
    tint: [128, 138, 96],
    tintA: 0.15,
    surface: 'tile',
    hum: 0.7,
    vent: 0.5,
    drip: 0,
    scents: ['linen', 'dust'],
    emerg: [[200, 200], [640, 620]],
  },
  ICU: {
    label: 'ICU WING',
    rects: [[1080, 60, 1980, 440], [1280, 440, 1980, 700]],
    tint: [88, 158, 170],
    tintA: 0.15,
    surface: 'tile',
    hum: 0.8,
    vent: 0.6,
    drip: 0,
    scents: ['aldehydes'],
    emerg: [[1500, 200], [1740, 620]],
    breaker: [1900, 290],
  },
  RADIOLOGY: {
    label: 'RADIOLOGY',
    rects: [[60, 700, 780, 1740], [780, 940, 1140, 1740]],
    tint: [60, 118, 128],
    tintA: 0.18,
    surface: 'concrete',
    hum: 0.4,
    vent: 0.45,
    drip: 0.5,
    scents: ['metallic', 'geosmin'],
    emerg: [[240, 900], [640, 1520]],
    breaker: [160, 1320],
  },
  MORGUE: {
    label: 'MORGUE',
    rects: [[1140, 940, 1980, 1740]],
    tint: [104, 126, 118],
    tintA: 0.19,
    surface: 'concrete',
    hum: 0.3,
    vent: 0.3,
    drip: 0.8,
    scents: ['aldehydes', 'geosmin'],
    emerg: [[1340, 1080], [1780, 1540]],
    breaker: [1600, 1340],
  },
  REACTOR: {
    label: 'REACTOR LABS',
    rects: [[1980, 60, 2540, 1740]],
    tint: [150, 112, 86],
    tintA: 0.2,
    surface: 'concrete',
    hum: 0.95,
    vent: 0.7,
    drip: 0.25,
    scents: ['metallic', 'aldehydes'],
    emerg: [[2240, 320], [2260, 900], [2260, 1480]],
    breaker: [2040, 880],
  },
};

export const SEC_ORDER: SectorId[] = [
  'RECEPTION',
  'ICU',
  'RADIOLOGY',
  'MORGUE',
  'REACTOR',
  'WARDB',
];
