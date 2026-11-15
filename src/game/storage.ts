import { GameConfig, GameMode, HighScoreEntry, ProfileData, SectorId } from './types';

const CFG_KEY = 'sr98_cfg_v2';
const SCORE_KEY = 'sr98_scores_v2';
const PROFILE_KEY = 'sr98_profile_v2';
const SAVE_KEY = 'sr98_run_v2';

export const DEFAULT_CFG: GameConfig = {
  master: 82,
  amb: 78,
  foley: 85,
  cre: 88,
  ui: 75,
  quality: 'auto',
  shake: 100,
  grain: 'low',
  colorStrength: 75,
  brightness: 64,
  reduceFlash: false,
  reduceMotion: false,
  startSector: 'RECEPTION',
  aimAssist: 65,
  touchScale: 100,
  touchOpacity: 85,
  muted: false,
  lang: 'en',
  controlMode: 'auto',
};

export function loadConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { ...DEFAULT_CFG };
    return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export function saveConfig(cfg: GameConfig): void {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage quota
  }
}

export function loadScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveScore(entry: HighScoreEntry): { rank: number; list: HighScoreEntry[] } {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 8);
  const rank = trimmed.findIndex((x) => x.date === entry.date && x.score === entry.score);
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
  return { rank, list: trimmed };
}

export function loadProfile(): ProfileData {
  const base: ProfileData = {
    xp: 0,
    shifts: 0,
    kills: 0,
    photos: 0,
    storyCleared: false,
    secrets: [],
    bestiary: {},
    evidence: {},
  };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveProfile(p: ProfileData): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export interface RunCheckpoint {
  mode: GameMode;
  act: number;
  wave: number;
  score: number;
  kills: number;
  time: number;
  hp: number;
  maxHp: number;
  bat: number;
  px: number;
  py: number;
  sector: SectorId;
  unlocked: Record<string, boolean>;
  ammo: Record<string, { mag: number; res: number }>;
  inventory: Record<string, number>;
  upgrades: Record<string, number>;
  docsFound: number;
  openedDoors: string[];
}

export function loadRunSave(): RunCheckpoint | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.score !== 'number') return null;
    return data as RunCheckpoint;
  } catch {
    return null;
  }
}

export function saveRunCheckpoint(cp: RunCheckpoint): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(cp));
  } catch {
    // ignore
  }
}

export function clearRunSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
