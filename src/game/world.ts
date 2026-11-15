import { TAU } from './physics';
import {
  DOCS_TXT,
  HospitalDoor,
  HospitalProp,
  HospitalRoom,
  Obstacle,
  PuzzleKind,
  SEC_ORDER,
  SECTORS,
  SectorId,
  WH,
  WW,
} from './types';

export interface Canister {
  id: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  exploded: boolean;
}

export interface Extinguisher {
  id: string;
  x: number;
  y: number;
  r: number;
  triggered: boolean;
}

export interface MedStation {
  id: string;
  x: number;
  y: number;
  label: string;
  used: boolean;
}

export interface BreakerPanel {
  id: string;
  x: number;
  y: number;
  sector: SectorId;
}

export interface StoryTerminal {
  id: string;
  x: number;
  y: number;
  act: number;
  label: string;
  used: boolean;
  puzzle?: PuzzleKind;
}

export interface UVMark {
  id: string;
  x: number;
  y: number;
  digit: string;
  order: number;
  revealed: boolean;
}

export interface DocPickup {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
  t: number;
}

export interface SecretNiche {
  id: string;
  x: number;
  y: number;
  name: string;
  discovered: boolean;
}

export interface CeilingLight {
  id: string;
  x: number;
  y: number;
  r: number;
  sector: SectorId;
  color: 'warm' | 'teal' | 'cyan' | 'amber' | 'cold';
  flicker?: boolean;
}

export interface WorldData {
  obs: Obstacle[];
  locks: Obstacle[];
  doors: HospitalDoor[];
  props: HospitalProp[];
  rooms: HospitalRoom[];
  canisters: Canister[];
  extinguishers: Extinguisher[];
  medStations: MedStation[];
  breakers: BreakerPanel[];
  terminals: StoryTerminal[];
  uvMarks: UVMark[];
  docs: DocPickup[];
  leaks: { x: number; y: number; s: SectorId }[];
  vents: [number, number][];
  secrets: SecretNiche[];
  ceilingLights: CeilingLight[];
}

export function sectorAt(x: number, y: number): SectorId {
  for (const k of SEC_ORDER) {
    const s = SECTORS[k];
    for (const r of s.rects) {
      if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return k;
    }
  }
  return 'WARDB';
}

export function roomAt(x: number, y: number, rooms: readonly HospitalRoom[]): HospitalRoom | null {
  for (const r of rooms) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

export function buildHospitalWorld(): WorldData {
  const obs: Obstacle[] = [];
  const locks: Obstacle[] = [];
  const doors: HospitalDoor[] = [];

  const ob = (x: number, y: number, w: number, h: number, t: Obstacle['t']): Obstacle => {
    const o: Obstacle = { x, y, w, h, t };
    obs.push(o);
    return o;
  };

  const addDoor = (
    id: string,
    name: string,
    x: number,
    y: number,
    w: number,
    h: number,
    orientation: 'h' | 'v',
    lockedKind?: HospitalDoor['lockedKind'],
    unlockHint?: string,
  ): HospitalDoor => {
    const o = ob(x, y, w, h, 'door');
    const d: HospitalDoor = { id, name, x, y, w, h, orientation, obs: o, open: false, lockedKind, unlockHint };
    doors.push(d);
    return d;
  };

  // Perimeter outer walls (2600x1800)
  ob(0, 0, WW, 60, 'wall');
  ob(0, WH - 60, WW, 60, 'wall');
  ob(0, 60, 60, WH - 120, 'wall');
  ob(WW - 60, 60, 60, WH - 120, 'wall');

  // Interior sector dividers with door gaps
  const walls: [number, number, number, number][] = [
    [260, 340, 140, 24],
    [490, 340, 230, 24],
    [260, 340, 24, 220],
    [1380, 340, 140, 24],
    [1610, 340, 260, 24],
    [1746, 340, 24, 220],
    [260, 1140, 140, 24],
    [490, 1140, 230, 24],
    [260, 940, 24, 220],
    [1380, 1140, 140, 24],
    [1610, 1140, 260, 24],
    [1746, 940, 24, 220],
    [1980, 60, 28, 340],
    [1980, 490, 28, 350],
    [1980, 930, 28, 370],
    [1980, 1390, 28, 350],
  ];
  for (const [x, y, w, h] of walls) ob(x, y, w, h, 'wall');

  // 9 Interactive Doors
  addDoor('WARD-04', 'WARD B SECURITY DOOR', 400, 340, 90, 24, 'h', 'keypad', 'PIN ON UV WALLS (4827)');
  addDoor('NURSE-01', 'NURSE STATION DOOR', 780, 420, 24, 80, 'v', 'circuit', 'RESTORE CONDUIT RELAY');
  addDoor('ICU-02', 'ICU CONTAINMENT DOOR', 1520, 340, 90, 24, 'h');
  addDoor('XRAY-01', 'RADIOLOGY LAB DOOR', 400, 1140, 90, 24, 'h');
  addDoor('MORGUE-01', 'MORGUE COLD DOOR', 1520, 1140, 90, 24, 'h', 'keycard', 'REQUIRES MORGUE KEYCARD');
  addDoor('REACTOR-N', 'REACTOR NORTH BULKHEAD', 1980, 400, 28, 90, 'v', 'oscilloscope', 'CALIBRATE BIO-FREQUENCY');
  addDoor('REACTOR-S', 'REACTOR SOUTH BULKHEAD', 1980, 1300, 28, 90, 'v');
  addDoor('REACTOR-C', 'OMEGA CHAMBER DOOR', 1980, 840, 28, 90, 'v', 'oscilloscope', 'CALIBRATE BIO-FREQUENCY');
  addDoor('AIRLOCK-EX', 'NORTH EXIT AIRLOCK', 955, 60, 90, 28, 'h', 'escape', 'LOCKDOWN ACTIVE UNTIL ACT VI');

  // Reception desks & pillars (wider center promenade around player spawn 1000,700)
  ob(890, 565, 220, 30, 'desk');
  ob(890, 815, 220, 30, 'desk');
  for (const [x, y] of [
    [820, 460],
    [1160, 460],
    [820, 900],
    [1160, 900],
    [2240, 620],
    [2240, 1180],
  ]) {
    ob(x, y, 44, 44, 'pillar');
  }

  // Ward beds & crates
  for (const [x, y] of [
    [580, 480],
    [580, 610],
    [1340, 480],
    [1340, 610],
    [580, 820],
    [580, 950],
    [1340, 820],
    [1340, 950],
  ]) {
    ob(x, y, 90, 46, 'bed');
  }

  for (const [x, y, w, h] of [
    [180, 190, 62, 62],
    [1760, 1480, 64, 64],
    [160, 1420, 72, 52],
    [1780, 200, 72, 52],
    [960, 280, 84, 42],
    [960, 1120, 84, 42],
    [450, 720, 42, 90],
    [1520, 720, 42, 90],
    [2140, 280, 76, 56],
    [2380, 1460, 72, 58],
  ]) {
    ob(x, y, w, h, 'crate');
  }

  // Supply Lockers (lootable — Reception locker tucked against upper desk leaving wide lobby open)
  for (const [x, y, w, h] of [
    [950, 596, 100, 22],
    [650, 60, 100, 24],
    [1250, 1716, 100, 24],
    [60, 650, 24, 100],
    [1940, 650, 24, 100],
    [2490, 860, 24, 100],
  ]) {
    locks.push(ob(x, y, w, h, 'locker'));
  }

  const rooms: HospitalRoom[] = [
    { id: 'rec-main', code: 'REC-01', name: 'CENTRAL RECEPTION', short: 'RECEPTION', sector: 'RECEPTION', x: 780, y: 450, w: 480, h: 480, tint: 'rgba(65,98,94,0.16)' },
    { id: 'ward-b', code: 'WRD-B', name: 'ISOLATION WARD B', short: 'WARD B', sector: 'WARDB', x: 80, y: 80, w: 660, h: 580, tint: 'rgba(85,96,62,0.14)' },
    { id: 'icu-main', code: 'ICU-01', name: 'INTENSIVE CARE UNIT', short: 'ICU WING', sector: 'ICU', x: 1120, y: 80, w: 820, h: 580, tint: 'rgba(52,110,122,0.14)' },
    { id: 'rad-main', code: 'RAD-04', name: 'DIAGNOSTIC RADIOLOGY', short: 'RADIOLOGY', sector: 'RADIOLOGY', x: 80, y: 980, w: 980, h: 720, tint: 'rgba(42,88,104,0.15)' },
    { id: 'mor-main', code: 'MRG-02', name: 'COLD STORAGE MORGUE', short: 'MORGUE', sector: 'MORGUE', x: 1160, y: 980, w: 780, h: 720, tint: 'rgba(72,94,90,0.16)' },
    { id: 'rx-main', code: 'P98-CORE', name: 'PROTOCOL 98 REACTOR', short: 'REACTOR LABS', sector: 'REACTOR', x: 2020, y: 80, w: 500, h: 1640, tint: 'rgba(128,74,48,0.17)' },
  ];

  // Rich environmental props across every department
  const props: HospitalProp[] = [
    // Reception props & lockdown defenses
    { id: 'p-rec-con', kind: 'console', x: 1010, y: 522, w: 68, h: 30, solid: true },
    { id: 'p-rec-lamp1', kind: 'desk_lamp', x: 912, y: 580, w: 20, h: 20 },
    { id: 'p-rec-lamp2', kind: 'desk_lamp', x: 1085, y: 830, w: 20, h: 20 },
    { id: 'p-rec-cab1', kind: 'cabinet', x: 745, y: 590, w: 30, h: 52, solid: true },
    { id: 'p-rec-crash', kind: 'crash_cart', x: 1210, y: 760, w: 46, h: 30, rot: -0.2, solid: true },
    { id: 'p-rec-exit1', kind: 'exit_sign', x: 1000, y: 102, w: 48, h: 16 },
    { id: 'p-rec-cam', kind: 'camera', x: 830, y: 475, w: 24, h: 24 },
    { id: 'p-rec-fan', kind: 'ceiling_fan', x: 1000, y: 700, w: 88, h: 88 },
    { id: 'p-rec-defib', kind: 'defib', x: 870, y: 790, w: 28, h: 24, solid: true },
    { id: 'p-rec-sand1', kind: 'sandbag', x: 880, y: 215, w: 74, h: 28, rot: -0.15, solid: true },
    { id: 'p-rec-sand2', kind: 'sandbag', x: 1120, y: 215, w: 74, h: 28, rot: 0.15, solid: true },
    { id: 'p-rec-corpse', kind: 'corpse', x: 1128, y: 530, w: 46, h: 32, rot: 0.65 },
    { id: 'p-rec-glass', kind: 'glass_shard', x: 865, y: 530, w: 48, h: 42 },

    // Ward B props
    { id: 'p-ward-mon1', kind: 'monitor', x: 520, y: 470, w: 34, h: 28, solid: true },
    { id: 'p-ward-wc', kind: 'wheelchair', x: 350, y: 240, w: 36, h: 36, rot: 0.4, solid: true },
    { id: 'p-ward-gurney', kind: 'gurney', x: 195, y: 285, w: 78, h: 38, rot: 0.12, solid: true },
    { id: 'p-ward-medshelf', kind: 'medshelf', x: 130, y: 150, w: 78, h: 28, solid: true },
    { id: 'p-ward-crash', kind: 'crash_cart', x: 675, y: 530, w: 46, h: 30, rot: 0.1, solid: true },
    { id: 'p-ward-cab', kind: 'cabinet', x: 108, y: 245, w: 32, h: 56, solid: true },
    { id: 'p-ward-iv', kind: 'iv', x: 548, y: 518, w: 24, h: 24 },
    { id: 'p-ward-glass', kind: 'glass_shard', x: 475, y: 265, w: 54, h: 46 },
    { id: 'p-ward-corpse', kind: 'corpse', x: 642, y: 255, w: 46, h: 32, rot: 2.2 },
    { id: 'p-ward-fan', kind: 'ceiling_fan', x: 430, y: 195, w: 80, h: 80 },

    // ICU Wing props
    { id: 'p-icu-mon1', kind: 'monitor', x: 1280, y: 470, w: 34, h: 28, solid: true },
    { id: 'p-icu-mon2', kind: 'monitor', x: 1470, y: 470, w: 34, h: 28, solid: true },
    { id: 'p-icu-iv', kind: 'iv', x: 1450, y: 520, w: 24, h: 24 },
    { id: 'p-icu-surg', kind: 'surgical_table', x: 1500, y: 190, w: 94, h: 46, solid: true },
    { id: 'p-icu-anesth', kind: 'anesthesia', x: 1432, y: 170, w: 34, h: 34, solid: true },
    { id: 'p-icu-tank', kind: 'bio_tank', x: 1640, y: 195, w: 42, h: 42, solid: true },
    { id: 'p-icu-fridge', kind: 'fridge', x: 1180, y: 125, w: 44, h: 36, solid: true },
    { id: 'p-icu-xray', kind: 'xray_box', x: 1275, y: 112, w: 66, h: 20, solid: true },
    { id: 'p-icu-shelf', kind: 'medshelf', x: 1850, y: 115, w: 84, h: 26, solid: true },
    { id: 'p-icu-defib', kind: 'defib', x: 1790, y: 420, w: 28, h: 24, solid: true },
    { id: 'p-icu-drum', kind: 'bio_drum', x: 1885, y: 585, w: 34, h: 34, solid: true },
    { id: 'p-icu-cam', kind: 'camera', x: 1690, y: 120, w: 24, h: 24, rot: 1.5 },
    { id: 'p-icu-fan', kind: 'ceiling_fan', x: 1520, y: 230, w: 84, h: 84 },

    // Radiology props
    { id: 'p-rad-mri', kind: 'scanner', x: 380, y: 1380, w: 120, h: 86, solid: true },
    { id: 'p-rad-lab', kind: 'labbench', x: 640, y: 1520, w: 120, h: 36, solid: true },
    { id: 'p-rad-xray1', kind: 'xray_box', x: 220, y: 1210, w: 72, h: 20, solid: true },
    { id: 'p-rad-xray2', kind: 'xray_box', x: 560, y: 1210, w: 72, h: 20, solid: true },
    { id: 'p-rad-cab1', kind: 'cabinet', x: 120, y: 1230, w: 34, h: 64, solid: true },
    { id: 'p-rad-cab2', kind: 'cabinet', x: 120, y: 1310, w: 34, h: 64, solid: true },
    { id: 'p-rad-tank', kind: 'bio_tank', x: 860, y: 1360, w: 42, h: 42, solid: true },
    { id: 'p-rad-gen', kind: 'generator', x: 175, y: 1500, w: 82, h: 58, solid: true },
    { id: 'p-rad-drum1', kind: 'bio_drum', x: 775, y: 1585, w: 34, h: 34, solid: true },
    { id: 'p-rad-drum2', kind: 'bio_drum', x: 825, y: 1545, w: 34, h: 34, solid: true },
    { id: 'p-rad-sand', kind: 'sandbag', x: 740, y: 1210, w: 78, h: 28, rot: 0.45, solid: true },
    { id: 'p-rad-glass', kind: 'glass_shard', x: 465, y: 1275, w: 58, h: 48 },
    { id: 'p-rad-fan', kind: 'ceiling_fan', x: 470, y: 1410, w: 84, h: 84 },

    // Morgue props
    { id: 'p-mor-cold1', kind: 'coldcab', x: 1850, y: 1280, w: 52, h: 110, solid: true },
    { id: 'p-mor-cold2', kind: 'coldcab', x: 1850, y: 1440, w: 52, h: 110, solid: true },
    { id: 'p-mor-auto', kind: 'autoclave', x: 1460, y: 1560, w: 54, h: 54, solid: true },
    { id: 'p-mor-surg1', kind: 'surgical_table', x: 1365, y: 1345, w: 94, h: 46, solid: true },
    { id: 'p-mor-fridge', kind: 'fridge', x: 1235, y: 1220, w: 44, h: 36, solid: true },
    { id: 'p-mor-anesth', kind: 'anesthesia', x: 1298, y: 1338, w: 34, h: 34, solid: true },
    { id: 'p-mor-gurney', kind: 'gurney', x: 1645, y: 1560, w: 76, h: 38, rot: -0.25, solid: true },
    { id: 'p-mor-drum', kind: 'bio_drum', x: 1240, y: 1560, w: 34, h: 34, solid: true },
    { id: 'p-mor-corpse', kind: 'corpse', x: 1715, y: 1245, w: 46, h: 32, rot: -0.8 },
    { id: 'p-mor-cam', kind: 'camera', x: 1220, y: 1020, w: 24, h: 24, rot: 0.5 },
    { id: 'p-mor-fan', kind: 'ceiling_fan', x: 1540, y: 1340, w: 84, h: 84 },

    // Reactor Labs props
    { id: 'p-rx-pod1', kind: 'cryopod', x: 2340, y: 460, w: 64, h: 64, solid: true },
    { id: 'p-rx-pod2', kind: 'cryopod', x: 2340, y: 900, w: 72, h: 72, solid: true },
    { id: 'p-rx-pod3', kind: 'cryopod', x: 2340, y: 1340, w: 64, h: 64, solid: true },
    { id: 'p-rx-tank1', kind: 'bio_tank', x: 2445, y: 560, w: 44, h: 44, solid: true },
    { id: 'p-rx-tank2', kind: 'bio_tank', x: 2445, y: 1240, w: 44, h: 44, solid: true },
    { id: 'p-rx-exit', kind: 'exit_sign', x: 2025, y: 885, w: 18, h: 52 },
    { id: 'p-rx-con', kind: 'console', x: 2110, y: 890, w: 46, h: 86, solid: true },
    { id: 'p-rx-gen1', kind: 'generator', x: 2145, y: 425, w: 84, h: 58, solid: true },
    { id: 'p-rx-gen2', kind: 'generator', x: 2145, y: 1360, w: 84, h: 58, solid: true },
    { id: 'p-rx-drum1', kind: 'bio_drum', x: 2445, y: 720, w: 34, h: 34, solid: true },
    { id: 'p-rx-drum2', kind: 'bio_drum', x: 2445, y: 1080, w: 34, h: 34, solid: true },
    { id: 'p-rx-sand1', kind: 'sandbag', x: 2215, y: 760, w: 72, h: 28, rot: 0.5, solid: true },
    { id: 'p-rx-sand2', kind: 'sandbag', x: 2215, y: 1040, w: 72, h: 28, rot: -0.5, solid: true },
    { id: 'p-rx-glass', kind: 'glass_shard', x: 2085, y: 970, w: 54, h: 48 },
    { id: 'p-rx-fan', kind: 'ceiling_fan', x: 2280, y: 900, w: 96, h: 96 },
  ];

  for (const p of props) {
    if (p.solid) {
      obs.push({
        x: p.x - p.w * 0.43,
        y: p.y - p.h * 0.43,
        w: p.w * 0.86,
        h: p.h * 0.86,
        t: 'prop',
        propId: p.id,
      });
    }
  }

  // Red Explosive O2 Canisters placed tactically near chokepoints, opening view, & boss arenas
  const canisters: Canister[] = [
    { id: 'can-0', x: 1165, y: 615, r: 13, hp: 20, exploded: false },
    { id: 'can-1', x: 460, y: 430, r: 13, hp: 20, exploded: false },
    { id: 'can-2', x: 760, y: 690, r: 13, hp: 20, exploded: false },
    { id: 'can-3', x: 1220, y: 690, r: 13, hp: 20, exploded: false },
    { id: 'can-4', x: 1580, y: 460, r: 13, hp: 20, exploded: false },
    { id: 'can-5', x: 520, y: 1260, r: 13, hp: 20, exploded: false },
    { id: 'can-6', x: 1460, y: 1280, r: 13, hp: 20, exploded: false },
    { id: 'can-7', x: 1680, y: 1420, r: 13, hp: 20, exploded: false },
    { id: 'can-8', x: 2180, y: 740, r: 13, hp: 20, exploded: false },
    { id: 'can-9', x: 2180, y: 1060, r: 13, hp: 20, exploded: false },
  ];

  // Shootable CO2 Cryo Fire Extinguishers (freeze burst + clears acid pools)
  const extinguishers: Extinguisher[] = [
    { id: 'ext-1', x: 855, y: 505, r: 11, triggered: false },
    { id: 'ext-2', x: 1150, y: 505, r: 11, triggered: false },
    { id: 'ext-3', x: 315, y: 410, r: 11, triggered: false },
    { id: 'ext-4', x: 1670, y: 390, r: 11, triggered: false },
    { id: 'ext-5', x: 650, y: 1185, r: 11, triggered: false },
    { id: 'ext-6', x: 1690, y: 1185, r: 11, triggered: false },
    { id: 'ext-7', x: 2080, y: 790, r: 11, triggered: false },
  ];

  const medStations: MedStation[] = [
    { id: 'med-rec', x: 840, y: 700, label: 'RECEPTION TRIAGE AID', used: false },
    { id: 'med-ward', x: 110, y: 340, label: 'WARD B WALL AID', used: false },
    { id: 'med-icu', x: 1870, y: 480, label: 'ICU TRAUMA STATION', used: false },
    { id: 'med-rad', x: 120, y: 1580, label: 'RADIOLOGY AID CABINET', used: false },
    { id: 'med-mor', x: 1860, y: 1520, label: 'MORGUE STERILIZER AID', used: false },
    { id: 'med-rx', x: 2470, y: 540, label: 'REACTOR EMERGENCY AID', used: false },
  ];

  const breakers: BreakerPanel[] = [
    { id: 'brk-rec', x: 740, y: 490, sector: 'RECEPTION' },
    { id: 'brk-icu', x: 1900, y: 270, sector: 'ICU' },
    { id: 'brk-rad', x: 140, y: 1320, sector: 'RADIOLOGY' },
    { id: 'brk-mor', x: 1620, y: 1380, sector: 'MORGUE' },
    { id: 'brk-rx', x: 2045, y: 880, sector: 'REACTOR' },
  ];

  const terminals: StoryTerminal[] = [
    { id: 'term-1', x: 1010, y: 515, act: 1, label: 'RECEPTION SHIFT TERMINAL', used: false },
    { id: 'term-2', x: 750, y: 445, act: 2, label: 'NURSE STATION CONDUIT', used: false, puzzle: 'circuit' },
    { id: 'term-3', x: 445, y: 315, act: 1, label: 'WARD B KEYPAD LOCK', used: false, puzzle: 'keypad' },
    { id: 'term-4', x: 1945, y: 885, act: 4, label: 'BIO-FREQUENCY CONSOLE', used: false, puzzle: 'oscilloscope' },
    { id: 'term-5', x: 1000, y: 110, act: 6, label: 'NORTH AIRLOCK OVERRIDE', used: false },
  ];

  const uvMarks: UVMark[] = [
    { id: 'uv-1', x: 895, y: 472, digit: '4', order: 1, revealed: false },
    { id: 'uv-2', x: 675, y: 332, digit: '8', order: 2, revealed: false },
    { id: 'uv-3', x: 310, y: 368, digit: '2', order: 3, revealed: false },
    { id: 'uv-4', x: 1125, y: 715, digit: '7', order: 4, revealed: false },
  ];

  const docSpots: [number, number][] = [
    [985, 580],
    [220, 210],
    [1540, 210],
    [340, 1460],
    [1640, 1520],
    [2220, 320],
    [710, 880],
    [1310, 1180],
  ];
  const docs: DocPickup[] = docSpots.map(([x, y], i) => ({
    id: `doc-${i}`,
    x,
    y,
    title: DOCS_TXT[i][0],
    body: DOCS_TXT[i][1],
    t: Math.random() * 6,
  }));

  const leaks: { x: number; y: number; s: SectorId }[] = [
    { x: 700, y: 1460, s: 'RADIOLOGY' },
    { x: 1500, y: 1260, s: 'MORGUE' },
    { x: 2290, y: 1100, s: 'REACTOR' },
  ];
  const vents: [number, number][] = [
    [300, 94],
    [1700, 94],
    [100, 1100],
    [1900, 560],
    [2140, 1560],
  ];

  const secrets: SecretNiche[] = [
    { id: 'ward-west', x: 145, y: 585, name: 'WARD B LINEN ALCOVE', discovered: false },
    { id: 'rad-bay', x: 175, y: 1580, name: 'RADIOLOGY FILM ARCHIVE', discovered: false },
    { id: 'morgue-vault', x: 1850, y: 1620, name: 'COLD STORAGE VAULT', discovered: false },
    { id: 'reactor-catwalk', x: 2440, y: 220, name: 'REACTOR COOLANT BAY', discovered: false },
  ];

  const ceilingLights: CeilingLight[] = [
    // Reception Atrium & Corridors
    { id: 'cl-rec-1', x: 1000, y: 695, r: 240, sector: 'RECEPTION', color: 'warm' },
    { id: 'cl-rec-2', x: 1000, y: 495, r: 175, sector: 'RECEPTION', color: 'teal' },
    { id: 'cl-rec-3', x: 1245, y: 690, r: 170, sector: 'RECEPTION', color: 'warm', flicker: true },
    { id: 'cl-rec-4', x: 750, y: 690, r: 170, sector: 'RECEPTION', color: 'amber' },
    { id: 'cl-rec-5', x: 1000, y: 200, r: 190, sector: 'RECEPTION', color: 'amber' },
    // Ward B
    { id: 'cl-wrd-1', x: 420, y: 215, r: 210, sector: 'WARDB', color: 'warm' },
    { id: 'cl-wrd-2', x: 615, y: 540, r: 185, sector: 'WARDB', color: 'cold', flicker: true },
    { id: 'cl-wrd-3', x: 215, y: 510, r: 180, sector: 'WARDB', color: 'warm' },
    // ICU Wing
    { id: 'cl-icu-1', x: 1510, y: 215, r: 225, sector: 'ICU', color: 'teal' },
    { id: 'cl-icu-2', x: 1240, y: 180, r: 175, sector: 'ICU', color: 'cyan' },
    { id: 'cl-icu-3', x: 1410, y: 545, r: 190, sector: 'ICU', color: 'teal', flicker: true },
    { id: 'cl-icu-4', x: 1790, y: 500, r: 180, sector: 'ICU', color: 'cold' },
    // Radiology
    { id: 'cl-rad-1', x: 430, y: 1385, r: 230, sector: 'RADIOLOGY', color: 'cyan' },
    { id: 'cl-rad-2', x: 640, y: 1520, r: 180, sector: 'RADIOLOGY', color: 'teal' },
    { id: 'cl-rad-3', x: 610, y: 890, r: 175, sector: 'RADIOLOGY', color: 'warm', flicker: true },
    { id: 'cl-rad-4', x: 220, y: 1250, r: 170, sector: 'RADIOLOGY', color: 'cyan' },
    // Morgue
    { id: 'cl-mor-1', x: 1520, y: 1345, r: 225, sector: 'MORGUE', color: 'cold' },
    { id: 'cl-mor-2', x: 1810, y: 1360, r: 180, sector: 'MORGUE', color: 'cyan' },
    { id: 'cl-mor-3', x: 1390, y: 890, r: 175, sector: 'MORGUE', color: 'cold', flicker: true },
    // Reactor 98
    { id: 'cl-rx-1', x: 2285, y: 900, r: 255, sector: 'REACTOR', color: 'amber' },
    { id: 'cl-rx-2', x: 2330, y: 460, r: 200, sector: 'REACTOR', color: 'cyan' },
    { id: 'cl-rx-3', x: 2330, y: 1340, r: 200, sector: 'REACTOR', color: 'cyan' },
    { id: 'cl-rx-4', x: 2110, y: 890, r: 165, sector: 'REACTOR', color: 'teal' },
  ];

  return {
    obs,
    locks,
    doors,
    props,
    rooms,
    canisters,
    extinguishers,
    medStations,
    breakers,
    terminals,
    uvMarks,
    docs,
    leaks,
    vents,
    secrets,
    ceilingLights,
  };
}

export interface FloorTile {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderAssets {
  floorC: HTMLCanvasElement;
  floorTiles: FloorTile[];
  decalC: HTMLCanvasElement;
  decalCtx: CanvasRenderingContext2D;
  mmBase: HTMLCanvasElement;
  glowSprite: HTMLCanvasElement;
  redGlow: HTMLCanvasElement;
  cyanGlow: HTMLCanvasElement;
  cutGlow: HTMLCanvasElement;
  grainTiles: HTMLCanvasElement[];
}

function drawRadiationSymbol(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(224,174,86,0.12)';
  c.strokeStyle = 'rgba(224,174,86,0.18)';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.stroke();
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3 - Math.PI / 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r * 0.85, a - 0.48, a + 0.48);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#121c20';
  c.beginPath();
  c.arc(0, 0, r * 0.24, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(224,174,86,0.28)';
  c.beginPath();
  c.arc(0, 0, r * 0.14, 0, TAU);
  c.fill();
  c.restore();
}

function drawHospitalProp(c: CanvasRenderingContext2D, p: HospitalProp): void {
  if (p.kind === 'ceiling_fan' || p.kind === 'camera') return; // Drawn animated live in engine.ts
  c.save();
  c.translate(p.x, p.y);
  if (p.rot) c.rotate(p.rot);
  const { w, h } = p;

  if (p.kind !== 'glass_shard' && p.kind !== 'corpse') {
    c.fillStyle = 'rgba(0,0,0,.44)';
    c.fillRect(-w / 2 + 4, -h / 2 + 6, w, h);
  }
  const stroke = '#111b20';
  const steel = '#64777d';
  const dark = '#29383e';

  switch (p.kind) {
    case 'monitor':
      c.fillStyle = dark;
      c.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.72);
      c.fillStyle = '#071b21';
      c.fillRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.46);
      c.strokeStyle = '#59d4bf';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-w / 2 + 8, -h / 2 + h * 0.34);
      c.lineTo(-w / 2 + 13, -h / 2 + h * 0.22);
      c.lineTo(-w / 2 + 18, -h / 2 + h * 0.36);
      c.lineTo(w / 2 - 8, -h / 2 + h * 0.26);
      c.stroke();
      c.fillStyle = '#e0ae56';
      c.fillRect(w / 2 - 9, h / 2 - 6, 4, 3);
      break;
    case 'iv':
      c.strokeStyle = '#8aa0a5';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -h / 2 + 3);
      c.lineTo(0, h / 2 - 4);
      c.moveTo(-7, 0);
      c.lineTo(7, 0);
      c.stroke();
      c.fillStyle = '#a9d5d6';
      c.fillRect(-10, -h / 2 + 4, 8, 12);
      c.fillStyle = '#b43036';
      c.fillRect(2, -h / 2 + 5, 7, 10);
      break;
    case 'wheelchair':
      c.strokeStyle = '#a7b7b8';
      c.lineWidth = 3.5;
      c.beginPath();
      c.arc(-w * 0.24, 0, h * 0.38, 0, TAU);
      c.stroke();
      c.fillStyle = steel;
      c.fillRect(-w * 0.1, -h * 0.26, w * 0.44, h * 0.52);
      c.fillStyle = '#1b262a';
      c.fillRect(-w * 0.04, -h * 0.2, w * 0.32, h * 0.4);
      break;
    case 'gurney':
      c.fillStyle = '#4e5f66';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#cad6d2';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.fillStyle = '#edf2ee';
      c.fillRect(-w / 2 + 6, -h / 2 + 6, 16, h - 12);
      c.fillStyle = '#243238';
      c.fillRect(-4, -h / 2 + 3, 6, h - 6);
      c.fillRect(18, -h / 2 + 3, 6, h - 6);
      c.fillStyle = 'rgba(130,18,22,0.42)';
      c.beginPath();
      c.ellipse(10, 2, 12, 8, 0.3, 0, TAU);
      c.fill();
      break;
    case 'surgical_table':
      c.fillStyle = '#3c4d54';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#8fa4aa';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.fillStyle = '#336264';
      c.fillRect(-w * 0.18, -h / 2 + 6, w * 0.48, h - 12);
      c.fillStyle = 'rgba(140,18,24,0.48)';
      c.beginPath();
      c.ellipse(6, 0, 16, 10, 0, 0, TAU);
      c.fill();
      // Steel instrument tray on side
      c.fillStyle = '#bccad0';
      c.fillRect(-w / 2 + 8, -h / 2 - 8, 26, 10);
      c.fillStyle = '#536268';
      c.fillRect(-w / 2 + 11, -h / 2 - 5, 8, 2);
      c.fillRect(-w / 2 + 22, -h / 2 - 6, 9, 2);
      break;
    case 'xray_box':
      c.fillStyle = '#27343a';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#97e2ea';
      c.fillRect(-w / 2 + 4, -h / 2 + 3, w * 0.44, h - 6);
      c.fillRect(4, -h / 2 + 3, w * 0.42, h - 6);
      c.fillStyle = '#142a30';
      c.fillRect(-w / 2 + 12, -h / 2 + 5, 8, h - 10);
      c.fillRect(14, -h / 2 + 5, 10, h - 10);
      break;
    case 'bio_drum':
      c.fillStyle = '#b98924';
      c.beginPath();
      c.arc(0, 0, w * 0.46, 0, TAU);
      c.fill();
      c.strokeStyle = '#2b200a';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#221a09';
      c.beginPath();
      c.arc(0, 0, w * 0.28, 0, TAU);
      c.fill();
      c.fillStyle = '#e8c456';
      c.beginPath();
      c.arc(-4, -3, 3, 0, TAU);
      c.arc(4, -3, 3, 0, TAU);
      c.arc(0, 4, 3, 0, TAU);
      c.fill();
      break;
    case 'sandbag':
      c.fillStyle = '#5c523e';
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.roundRect(i * (w * 0.3) - 13, -h * 0.42, 26, h * 0.84, 5);
        c.fill();
        c.strokeStyle = '#332c20';
        c.lineWidth = 1.5;
        c.stroke();
      }
      break;
    case 'defib':
      c.fillStyle = '#a82b30';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#eef2ee';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.fillStyle = '#ff3b3f';
      c.fillRect(-3, -6, 6, 12);
      c.fillRect(-6, -3, 12, 6);
      break;
    case 'medshelf':
      c.fillStyle = '#34474e';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#708e96';
      c.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 === 0 ? '#5cbab5' : '#e0ae56';
        c.fillRect(-w / 2 + 8 + i * 11, -h / 2 + 6, 6, h - 12);
      }
      break;
    case 'generator':
      c.fillStyle = '#2d373b';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#4e5d62';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.strokeStyle = '#222b2e';
      c.lineWidth = 2.5;
      for (let x = -w / 2 + 12; x < w / 2 - 18; x += 9) {
        c.beginPath();
        c.moveTo(x, -h / 2 + 8);
        c.lineTo(x, h / 2 - 8);
        c.stroke();
      }
      c.fillStyle = '#e0ae56';
      c.fillRect(w / 2 - 18, -h / 2 + 10, 10, h - 20);
      break;
    case 'glass_shard':
      c.fillStyle = 'rgba(165,225,235,0.28)';
      c.strokeStyle = 'rgba(220,248,255,0.45)';
      c.lineWidth = 1;
      for (const [gx, gy, s] of [[-12, -8, 7], [6, -12, 5], [-4, 6, 8], [14, 7, 6], [-16, 10, 5]]) {
        c.beginPath();
        c.moveTo(gx, gy - s);
        c.lineTo(gx + s, gy + s * 0.4);
        c.lineTo(gx - s * 0.7, gy + s);
        c.closePath();
        c.fill();
        c.stroke();
      }
      break;
    case 'corpse':
      c.fillStyle = 'rgba(110,12,16,0.58)';
      c.beginPath();
      c.ellipse(0, 2, 22, 14, 0.2, 0, TAU);
      c.fill();
      c.fillStyle = '#243642';
      c.beginPath();
      c.ellipse(-2, 0, 14, 9, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#73827a';
      c.beginPath();
      c.arc(13, -1, 6, 0, TAU);
      c.fill();
      c.strokeStyle = '#243642';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-4, -8);
      c.lineTo(8, -14);
      c.moveTo(-4, 8);
      c.lineTo(6, 15);
      c.stroke();
      break;
    case 'console':
      c.fillStyle = '#4c6068';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#142931';
      c.fillRect(-w / 2 + 6, -h / 2 + 5, w * 0.52, h * 0.62);
      c.fillStyle = '#6fd1c9';
      c.fillRect(-w / 2 + 9, -h / 2 + 8, w * 0.45, h * 0.44);
      c.fillStyle = '#e0ae56';
      c.fillRect(w / 2 - 14, -h / 2 + 8, 6, 5);
      break;
    case 'scanner':
      c.fillStyle = '#536b72';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#9aaeb0';
      c.fillRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
      c.fillStyle = '#24353c';
      c.beginPath();
      c.arc(0, -h * 0.08, Math.min(w, h) * 0.3, 0, TAU);
      c.fill();
      c.strokeStyle = '#c2d0ca';
      c.lineWidth = 4;
      c.stroke();
      c.fillStyle = '#5cbab5';
      c.fillRect(-16, h * 0.18, 32, 22);
      break;
    case 'labbench':
      c.fillStyle = '#5a6d70';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#b8c5c0';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.fillStyle = '#d8b36a';
      c.fillRect(w / 2 - 34, -h / 2 + 8, 22, 14);
      c.fillStyle = '#59d4bf';
      c.fillRect(-w / 2 + 16, -h / 2 + 10, 12, 12);
      break;
    case 'autoclave':
      c.fillStyle = '#53666b';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#9aaca9';
      c.fillRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
      c.strokeStyle = '#233238';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, Math.min(w, h) * 0.28, 0, TAU);
      c.stroke();
      break;
    case 'coldcab':
      c.fillStyle = '#495e65';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#8fa1a2';
      c.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
      c.strokeStyle = '#2a3a40';
      c.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(-w / 2 + 4, -h / 2 + (i * h) / 4);
        c.lineTo(w / 2 - 4, -h / 2 + (i * h) / 4);
        c.stroke();
      }
      c.fillStyle = '#d8e6e8';
      for (let i = 0; i < 4; i++) {
        c.fillRect(-4, -h / 2 + (i + 0.5) * (h / 4) - 2, 8, 4);
      }
      break;
    case 'cryopod':
      c.fillStyle = '#2a3c44';
      c.beginPath();
      c.arc(0, 0, w * 0.48, 0, TAU);
      c.fill();
      c.strokeStyle = '#5cbab5';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#0c232a';
      c.beginPath();
      c.arc(0, 0, w * 0.31, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(102,226,238,0.34)';
      c.beginPath();
      c.arc(0, 0, w * 0.2, 0, TAU);
      c.fill();
      break;
    case 'crash_cart':
      c.fillStyle = '#a82328';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#cf373c';
      c.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
      c.fillStyle = '#dde6e4';
      c.fillRect(-w / 2 + 5, -h / 2 + 5, 16, h - 10);
      c.fillStyle = '#202b30';
      c.fillRect(6, -h / 2 + 5, 12, 8);
      c.fillStyle = '#5cbab5';
      c.fillRect(8, -h / 2 + 7, 8, 4);
      break;
    case 'anesthesia':
      c.fillStyle = '#38484f';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#758b91';
      c.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.55);
      c.fillStyle = '#5cbab5';
      c.beginPath();
      c.arc(-5, 6, 4.5, 0, TAU);
      c.fill();
      c.fillStyle = '#78e6a8';
      c.beginPath();
      c.arc(6, 6, 4.5, 0, TAU);
      c.fill();
      break;
    case 'bio_tank':
      c.fillStyle = '#203038';
      c.beginPath();
      c.arc(0, 0, w * 0.48, 0, TAU);
      c.fill();
      c.strokeStyle = '#7be6dc';
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = '#0f3842';
      c.beginPath();
      c.arc(0, 0, w * 0.34, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(120,245,230,0.45)';
      c.beginPath();
      c.arc(-3, -3, w * 0.16, 0, TAU);
      c.fill();
      break;
    case 'cabinet':
      c.fillStyle = '#3d4c52';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = '#1e282c';
      c.lineWidth = 1.5;
      c.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
      c.fillStyle = '#8fa3a8';
      if (h > w) {
        for (let yy = -h / 2 + 12; yy < h / 2 - 8; yy += 16) {
          c.fillRect(-w / 2 + 5, yy, w - 10, 2);
        }
      } else {
        for (let xx = -w / 2 + 12; xx < w / 2 - 8; xx += 16) {
          c.fillRect(xx, -h / 2 + 5, 2, h - 10);
        }
      }
      break;
    case 'fridge':
      c.fillStyle = '#cfd8d6';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#92a3a6';
      c.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
      c.fillStyle = '#9c262a';
      c.fillRect(-6, -6, 12, 12);
      c.fillStyle = '#ff6b6e';
      c.fillRect(-2, -4, 4, 8);
      c.fillRect(-4, -2, 8, 4);
      break;
    case 'exit_sign':
      c.fillStyle = '#0e241b';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = '#78e6a8';
      c.lineWidth = 1.5;
      c.strokeRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#78e6a8';
      c.font = 'bold 9px Consolas,monospace';
      c.textAlign = 'center';
      c.fillText('EXIT', 0, 3);
      break;
    case 'desk_lamp':
      c.fillStyle = '#b98924';
      c.beginPath();
      c.arc(0, 0, 7, 0, TAU);
      c.fill();
      c.fillStyle = '#fff1be';
      c.beginPath();
      c.arc(0, 0, 3.5, 0, TAU);
      c.fill();
      break;
    default:
      c.fillStyle = steel;
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.strokeRect(-w / 2, -h / 2, w, h);
      break;
  }
  c.restore();
}

function drawObstacle(c: CanvasRenderingContext2D, o: Obstacle): void {
  const { x, y, w, h, t } = o;
  c.fillStyle = 'rgba(0,0,0,.52)';
  c.fillRect(x + 6, y + 8, w, h);
  switch (t) {
    case 'wall':
      c.fillStyle = '#2b3438';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#3f4d53';
      c.fillRect(x, y, w, Math.min(4, h));
      c.fillRect(x, y, Math.min(4, w), h);
      c.fillStyle = '#1f262a';
      c.fillRect(x, y + h - Math.min(4, h), w, Math.min(4, h));
      c.strokeStyle = 'rgba(0,0,0,.6)';
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      break;
    case 'desk':
      c.fillStyle = '#4b3b2a';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#604d37';
      c.fillRect(x + 3, y + 3, w - 6, h - 6);
      c.fillStyle = '#1a2428';
      c.fillRect(x + 20, y + 7, 26, 16);
      c.fillStyle = '#3d7a82';
      c.fillRect(x + 22, y + 9, 22, 12);
      c.fillStyle = '#d9d4c4';
      c.fillRect(x + 120, y + 8, 22, 14);
      c.fillStyle = '#8b1e22';
      c.fillRect(x + 165, y + 9, 14, 10);
      break;
    case 'bed':
      c.fillStyle = '#6f8085';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#c4d2d0';
      c.fillRect(x + 4, y + 4, w - 8, h - 8);
      c.fillStyle = '#eef3f0';
      c.fillRect(x + 6, y + 8, 20, h - 16);
      c.fillStyle = '#50646b';
      c.fillRect(x + 30, y + 5, w - 36, h - 10);
      c.fillStyle = 'rgba(120,20,20,.4)';
      c.beginPath();
      c.ellipse(x + 56, y + 22, 12, 8, 0.3, 0, TAU);
      c.fill();
      break;
    case 'pillar':
      c.fillStyle = '#4e5a5f';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#7d8c90';
      c.fillRect(x + 3, y + 3, w - 6, h - 6);
      c.fillStyle = '#3b464a';
      c.fillRect(x + 10, y + 10, w - 20, h - 20);
      break;
    case 'crate':
      c.fillStyle = '#4e3f2a';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#6a5636';
      c.fillRect(x + 3, y + 3, w - 6, h - 6);
      c.strokeStyle = '#3a2d1c';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 3, y + 3);
      c.lineTo(x + w - 3, y + h - 3);
      c.moveTo(x + w - 3, y + 3);
      c.lineTo(x + 3, y + h - 3);
      c.stroke();
      break;
    case 'door':
      c.fillStyle = '#1b292e';
      c.fillRect(x - 3, y - 5, w + 6, h + 10);
      c.strokeStyle = '#c3d0c8';
      c.lineWidth = 2;
      c.strokeRect(x - 3, y - 5, w + 6, h + 10);
      break;
    case 'locker':
      c.fillStyle = '#2f3d44';
      c.fillRect(x, y, w, h);
      c.strokeStyle = '#1a2328';
      c.lineWidth = 1.5;
      if (w > h) {
        for (let i = 1; i < 4; i++) {
          c.beginPath();
          c.moveTo(x + (w * i) / 4, y);
          c.lineTo(x + (w * i) / 4, y + h);
          c.stroke();
        }
      } else {
        for (let i = 1; i < 4; i++) {
          c.beginPath();
          c.moveTo(x, y + (h * i) / 4);
          c.lineTo(x + w, y + (h * i) / 4);
          c.stroke();
        }
      }
      break;
    default:
      break;
  }
}

export function createRenderAssets(world: WorldData): RenderAssets {
  const floorC = document.createElement('canvas');
  floorC.width = WW;
  floorC.height = WH;
  const f = floorC.getContext('2d')!;

  f.fillStyle = '#0c1316';
  f.fillRect(0, 0, WW, WH);

  // Wing-specific floor tiling patterns
  for (let y = 0; y < WH; y += 80) {
    for (let x = 0; x < WW; x += 80) {
      const alt = ((x + y) / 80) & 1 ? 2.2 : 0;
      const noise = (x * 7 + y * 13) % 5;
      const l = 9.5 + noise + alt;
      if (x > 1980) {
        // Reactor heavy industrial dark steel slab
        f.fillStyle = `hsl(24,11%,${l - 1}%)`;
        f.fillRect(x + 1, y + 1, 78, 78);
        f.strokeStyle = 'rgba(255,170,90,0.06)';
        f.lineWidth = 1;
        f.strokeRect(x + 8, y + 8, 64, 64);
      } else if (y > 960 && x > 1140) {
        // Cold Morgue stainless steel floor plates
        f.fillStyle = `hsl(188,12%,${l + 0.5}%)`;
        f.fillRect(x + 1, y + 1, 78, 78);
      } else if (y > 960) {
        // Radiology lead-lined concrete panels
        f.fillStyle = `hsl(198,10%,${l - 0.5}%)`;
        f.fillRect(x + 1, y + 1, 78, 78);
      } else if (x < 780 && y < 700) {
        // Ward B pale clinical olive linoleum
        f.fillStyle = `hsl(82,11%,${l + 0.5}%)`;
        f.fillRect(x + 1, y + 1, 78, 78);
      } else {
        // Reception & ICU ceramic tiles
        f.fillStyle = `hsl(182,10%,${l + 1}%)`;
        f.fillRect(x + 1, y + 1, 78, 78);
      }
    }
  }

  // Reception bordered lobby floor mat & central cross inlay
  f.fillStyle = 'rgba(42,68,72,0.45)';
  f.fillRect(880, 650, 260, 100);
  f.strokeStyle = 'rgba(224,174,86,0.22)';
  f.lineWidth = 2;
  f.strokeRect(886, 656, 248, 88);

  // ICU Medical gas conduits along floor
  f.strokeStyle = 'rgba(92,186,181,0.16)';
  f.lineWidth = 5;
  f.beginPath();
  f.moveTo(1240, 220);
  f.lineTo(1860, 220);
  f.moveTo(1240, 232);
  f.lineTo(1860, 232);
  f.stroke();

  // Radiation floor trefoil in Radiology
  drawRadiationSymbol(f, 470, 1460, 76);

  // Reactor coolant floor pipes & hazard rings around Cryo-Pods
  f.strokeStyle = 'rgba(210,120,60,0.22)';
  f.lineWidth = 8;
  f.beginPath();
  f.moveTo(2110, 890);
  f.lineTo(2340, 460);
  f.moveTo(2110, 890);
  f.lineTo(2340, 900);
  f.moveTo(2110, 890);
  f.lineTo(2340, 1340);
  f.stroke();
  for (const py of [460, 900, 1340]) {
    f.strokeStyle = 'rgba(224,174,86,0.24)';
    f.lineWidth = 4;
    f.setLineDash([12, 8]);
    f.beginPath();
    f.arc(2340, py, 56, 0, TAU);
    f.stroke();
  }
  f.setLineDash([]);

  // Aged stains & structural floor cracks
  for (let i = 0; i < 95; i++) {
    const x = ((i * 397) % (WW - 200)) + 100;
    const y = ((i * 571) % (WH - 200)) + 100;
    const r = 36 + (i % 7) * 14;
    const g = f.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 4 === 0 ? 'rgba(68,16,18,.24)' : 'rgba(34,26,18,.28)');
    g.addColorStop(1, 'rgba(34,26,18,0)');
    f.fillStyle = g;
    f.fillRect(x - r, y - r, r * 2, r * 2);
  }
  f.strokeStyle = 'rgba(0,0,0,0.34)';
  f.lineWidth = 1.5;
  for (let i = 0; i < 42; i++) {
    const cx = ((i * 613) % (WW - 260)) + 130;
    const cy = ((i * 487) % (WH - 260)) + 130;
    f.beginPath();
    f.moveTo(cx, cy);
    f.lineTo(cx + ((i % 3) - 1) * 26, cy + ((i % 2) ? 22 : -18));
    f.lineTo(cx + ((i % 4) - 1.5) * 34, cy + 36);
    f.stroke();
  }

  // Circulation stripes & yellow safety frame
  f.strokeStyle = 'rgba(232,168,56,.18)';
  f.lineWidth = 6;
  f.setLineDash([36, 26]);
  f.strokeRect(140, 140, WW - 280, WH - 280);
  f.setLineDash([]);

  f.strokeStyle = 'rgba(91,145,155,.08)';
  f.lineWidth = 54;
  f.beginPath();
  f.moveTo(1000, 90);
  f.lineTo(1000, 1690);
  f.moveTo(110, 690);
  f.lineTo(2480, 690);
  f.stroke();

  f.strokeStyle = 'rgba(140,190,194,.11)';
  f.lineWidth = 2;
  f.setLineDash([20, 18]);
  f.beginPath();
  f.moveTo(1000, 90);
  f.lineTo(1000, 1690);
  f.moveTo(110, 690);
  f.lineTo(2480, 690);
  f.stroke();
  f.setLineDash([]);

  // Hazard chevron strips at major security bulkheads & exit
  const drawHazardStripe = (x: number, y: number, w: number, h: number) => {
    f.save();
    f.beginPath();
    f.rect(x, y, w, h);
    f.clip();
    f.fillStyle = 'rgba(22,26,28,0.85)';
    f.fillRect(x, y, w, h);
    f.fillStyle = 'rgba(224,174,86,0.34)';
    const step = 16;
    for (let i = -h; i < w + h; i += step) {
      f.beginPath();
      f.moveTo(x + i, y + h);
      f.lineTo(x + i + 8, y + h);
      f.lineTo(x + i + h + 8, y);
      f.lineTo(x + i + h, y);
      f.closePath();
      f.fill();
    }
    f.restore();
  };
  drawHazardStripe(940, 92, 120, 14);
  drawHazardStripe(385, 368, 120, 14);
  drawHazardStripe(1505, 1168, 120, 14);
  drawHazardStripe(1955, 395, 18, 100);
  drawHazardStripe(1955, 835, 18, 100);
  drawHazardStripe(1955, 1295, 18, 100);

  // Metal floor drainage grates in Morgue, ICU, Radiology & Reactor
  for (const [gx, gy] of [[1520, 1420], [1740, 1520], [700, 1460], [2240, 880], [1480, 300]]) {
    f.fillStyle = '#0e1619';
    f.fillRect(gx - 22, gy - 14, 44, 28);
    f.strokeStyle = '#3c4e54';
    f.lineWidth = 2;
    f.strokeRect(gx - 22, gy - 14, 44, 28);
    for (let sx = gx - 16; sx <= gx + 16; sx += 8) {
      f.fillStyle = '#1b282d';
      f.fillRect(sx, gy - 10, 4, 20);
    }
  }

  // Painted Hospital Directional Wayfinding on Floor Corridors
  f.save();
  f.fillStyle = 'rgba(205,222,216,0.22)';
  f.font = 'bold 14px Consolas,monospace';
  f.textAlign = 'center';
  f.fillText('▲ NORTH AIRLOCK', 1000, 395);
  f.fillText('← WARD B', 845, 695);
  f.fillText('ICU WING →', 1210, 695);
  f.fillText('RADIOLOGY ↙', 885, 965);
  f.fillText('MORGUE ↘', 1200, 965);
  f.fillText('REACTOR 98 →', 1900, 885);
  f.restore();

  // Rooms
  for (const r of world.rooms) {
    f.fillStyle = r.tint;
    f.fillRect(r.x, r.y, r.w, r.h);
    f.strokeStyle = 'rgba(115,164,174,.32)';
    f.lineWidth = 3;
    f.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    f.fillStyle = 'rgba(1,7,9,.62)';
    f.fillRect(r.x + 8, r.y + 8, Math.min(r.w - 16, 220), 26);
    f.fillStyle = 'rgba(191,215,208,.62)';
    f.font = 'bold 16px Consolas,monospace';
    f.textAlign = 'left';
    f.fillText(r.code + ' · ' + r.short, r.x + 15, r.y + 26);
  }

  // Wing watermarks
  f.fillStyle = 'rgba(255,255,255,.065)';
  f.font = 'bold 52px Consolas,monospace';
  f.textAlign = 'center';
  for (const [label, x, y] of [
    ['WARD B', 410, 230],
    ['ICU', 1520, 230],
    ['RADIOLOGY', 470, 1280],
    ['MORGUE', 1540, 1280],
    ['RECEPTION', 1005, 505],
    ['REACTOR 98', 2280, 880],
  ] as [string, number, number][]) {
    f.fillText(label, x, y);
  }

  for (const o of world.obs) {
    if (o.t !== 'door' && o.t !== 'prop') drawObstacle(f, o);
  }
  for (const p of world.props) drawHospitalProp(f, p);

  const decalC = document.createElement('canvas');
  decalC.width = WW / 2;
  decalC.height = WH / 2;
  const decalCtx = decalC.getContext('2d')!;

  const mmBase = document.createElement('canvas');
  mmBase.width = WW / 4;
  mmBase.height = WH / 4;
  const m = mmBase.getContext('2d')!;
  m.fillStyle = '#091214';
  m.fillRect(0, 0, mmBase.width, mmBase.height);
  m.fillStyle = '#475b61';
  for (const o of world.obs) {
    m.fillRect(o.x / 4, o.y / 4, Math.max(2, o.w / 4), Math.max(2, o.h / 4));
  }

  const makeGlow = (c0: string, c1: string, c2: string): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, c0);
    g.addColorStop(0.38, c1);
    g.addColorStop(1, c2);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  };

  const grainTiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g2 = c.getContext('2d')!;
    const im = g2.createImageData(160, 160);
    for (let p = 0; p < im.data.length; p += 4) {
      const v = (108 + Math.random() * 92) | 0;
      im.data[p] = im.data[p + 1] = im.data[p + 2] = v;
      im.data[p + 3] = 255;
    }
    g2.putImageData(im, 0, 0);
    grainTiles.push(c);
  }

  const floorTiles: FloorTile[] = [];
  const halfW = WW / 2;
  const halfH = WH / 2;
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const tile = document.createElement('canvas');
      tile.width = halfW;
      tile.height = halfH;
      const tctx = tile.getContext('2d')!;
      tctx.drawImage(floorC, tx * halfW, ty * halfH, halfW, halfH, 0, 0, halfW, halfH);
      floorTiles.push({ canvas: tile, x: tx * halfW, y: ty * halfH, w: halfW, h: halfH });
    }
  }

  return {
    floorC,
    floorTiles,
    decalC,
    decalCtx,
    mmBase,
    glowSprite: makeGlow('rgba(255,190,90,1)', 'rgba(255,130,40,.45)', 'rgba(255,100,20,0)'),
    redGlow: makeGlow('rgba(255,70,50,.95)', 'rgba(200,30,26,.4)', 'rgba(160,20,20,0)'),
    cyanGlow: makeGlow('rgba(95,225,245,.95)', 'rgba(40,165,205,.38)', 'rgba(20,90,120,0)'),
    cutGlow: makeGlow('rgba(0,0,0,1)', 'rgba(0,0,0,.55)', 'rgba(0,0,0,0)'),
    grainTiles,
  };
}
