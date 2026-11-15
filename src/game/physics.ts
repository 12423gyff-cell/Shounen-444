import { InventoryCounts, Obstacle, Rect } from './types';

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function angdiff(target: number, current: number): number {
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function distRect(x: number, y: number, r: Rect): number {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  return Math.hypot(x - cx, y - cy);
}

export function pointInObs(x: number, y: number, obs: readonly Obstacle[]): boolean {
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true;
  }
  return false;
}

export function collideEntity(
  entity: { x: number; y: number },
  r: number,
  obs: readonly Obstacle[],
  worldW: number,
  worldH: number,
): { hit: boolean; nx: number; ny: number } {
  let hit = false;
  let lastNx = 0;
  let lastNy = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const cx = clamp(entity.x, o.x, o.x + o.w);
      const cy = clamp(entity.y, o.y, o.y + o.h);
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        entity.x += nx * (r - d);
        entity.y += ny * (r - d);
        lastNx = nx;
        lastNy = ny;
      } else {
        const l = entity.x - o.x;
        const ri = o.x + o.w - entity.x;
        const t = entity.y - o.y;
        const b = o.y + o.h - entity.y;
        const m = Math.min(l, ri, t, b);
        if (m === l) {
          entity.x = o.x - r;
          lastNx = -1;
          lastNy = 0;
        } else if (m === ri) {
          entity.x = o.x + o.w + r;
          lastNx = 1;
          lastNy = 0;
        } else if (m === t) {
          entity.y = o.y - r;
          lastNx = 0;
          lastNy = -1;
        } else {
          entity.y = o.y + o.h + r;
          lastNx = 0;
          lastNy = 1;
        }
      }
    }
  }
  entity.x = clamp(entity.x, r + 4, worldW - r - 4);
  entity.y = clamp(entity.y, r + 4, worldH - r - 4);
  return { hit, nx: lastNx, ny: lastNy };
}

export function freeSpot(
  x: number,
  y: number,
  r: number,
  obs: readonly Obstacle[],
  worldW: number,
  worldH: number,
): boolean {
  if (x < r + 4 || x > worldW - r - 4 || y < r + 4 || y > worldH - r - 4) return false;
  for (let i = 0; i < obs.length; i++) {
    if (distRect(x, y, obs[i]) < r) return false;
  }
  return true;
}

export function segCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = 0;
  if (l2 > 1e-6) {
    t = clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1);
  }
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
}

export function rayHit(
  x: number,
  y: number,
  ang: number,
  maxD: number,
  obs: readonly Obstacle[],
): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let best = maxD;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    let t0 = 0;
    let t1 = best;
    if (Math.abs(dx) < 1e-6) {
      if (x < o.x || x > o.x + o.w) continue;
    } else {
      let ta = (o.x - x) / dx;
      let tb = (o.x + o.w - x) / dx;
      if (ta > tb) {
        const tmp = ta;
        ta = tb;
        tb = tmp;
      }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
    }
    if (Math.abs(dy) < 1e-6) {
      if (y < o.y || y > o.y + o.h) continue;
    } else {
      let ta = (o.y - y) / dy;
      let tb = (o.y + o.h - y) / dy;
      if (ta > tb) {
        const tmp = ta;
        ta = tb;
        tb = tmp;
      }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
    }
    if (t1 >= t0 && t0 > 0 && t0 < best) {
      best = t0;
    }
  }
  return best;
}

export function lightPoly(
  x: number,
  y: number,
  ang: number,
  half: number,
  range: number,
  rays: number,
  obs: readonly Obstacle[],
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= rays; i++) {
    const a = ang - half + (half * 2 * i) / rays;
    const d = rayHit(x, y, a, range, obs);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
}

export function lineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obs: readonly Obstacle[],
): boolean {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d < 1) return true;
  const hit = rayHit(x1, y1, Math.atan2(y2 - y1, x2 - x1), d, obs);
  return hit >= d - 2;
}

export function computeComboMultiplier(combo: number): number {
  if (combo <= 0) return 1;
  return Math.min(8, 1 + Math.floor(combo / 3));
}

export function computeKillScore(baseScore: number, comboAfterKill: number, melee: boolean): number {
  const mult = computeComboMultiplier(comboAfterKill);
  return (baseScore + (melee ? 50 : 0)) * mult;
}

// 4x4 Circuit Conduit puzzle evaluator (Directions: 0=N, 1=E, 2=S, 3=W)
export type CircuitTileKind = 'straight' | 'corner' | 'tee' | 'cross' | 'source' | 'sink';

export interface CircuitTile {
  kind: CircuitTileKind;
  rot: number; // 0..3 clockwise 90deg steps
  powered?: boolean;
}

const BASE_PORTS: Record<CircuitTileKind, number[]> = {
  straight: [0, 2], // N-S
  corner: [0, 1], // N-E
  tee: [0, 1, 3], // W-N-E
  cross: [0, 1, 2, 3],
  source: [1], // East out from (0,0)
  sink: [3], // West in to (3,3)
};

export function tileOpenDirs(tile: CircuitTile): number[] {
  const r = ((tile.rot % 4) + 4) % 4;
  return BASE_PORTS[tile.kind].map((d) => (d + r) % 4);
}

export function createNurseCircuitGrid(): CircuitTile[] {
  // Guaranteed solvable 4x4 grid scrambled slightly for quick tactile play
  const layout: { kind: CircuitTileKind; rot: number }[] = [
    { kind: 'source', rot: 0 }, { kind: 'straight', rot: 0 }, { kind: 'corner', rot: 1 }, { kind: 'tee', rot: 2 },
    { kind: 'corner', rot: 0 }, { kind: 'tee', rot: 0 }, { kind: 'straight', rot: 1 }, { kind: 'corner', rot: 3 },
    { kind: 'straight', rot: 1 }, { kind: 'corner', rot: 3 }, { kind: 'tee', rot: 1 }, { kind: 'straight', rot: 0 },
    { kind: 'corner', rot: 2 }, { kind: 'straight', rot: 0 }, { kind: 'tee', rot: 3 }, { kind: 'sink', rot: 0 },
  ];
  return layout.map((t) => ({ ...t, powered: false }));
}

export function evaluateCircuit(grid: CircuitTile[]): {
  solved: boolean;
  poweredIndices: number[];
} {
  if (grid.length !== 16) return { solved: false, poweredIndices: [] };
  const dirs = [
    { dc: 0, dr: -1, opp: 2 }, // 0 North
    { dc: 1, dr: 0, opp: 3 },  // 1 East
    { dc: 0, dr: 1, opp: 0 },  // 2 South
    { dc: -1, dr: 0, opp: 1 }, // 3 West
  ];
  const visited = new Set<number>([0]);
  const queue = [0];
  let solved = false;
  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (idx === 15) solved = true;
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const open = tileOpenDirs(grid[idx]);
    for (const d of open) {
      const nc = col + dirs[d].dc;
      const nr = row + dirs[d].dr;
      if (nc < 0 || nc >= 4 || nr < 0 || nr >= 4) continue;
      const nIdx = nr * 4 + nc;
      if (visited.has(nIdx)) continue;
      const nOpen = tileOpenDirs(grid[nIdx]);
      if (nOpen.includes(dirs[d].opp)) {
        visited.add(nIdx);
        queue.push(nIdx);
      }
    }
  }
  const poweredIndices = Array.from(visited);
  for (let i = 0; i < grid.length; i++) {
    grid[i].powered = visited.has(i);
  }
  return { solved, poweredIndices };
}

export function evaluateOscilloscopeMatch(
  user: { freq: number; amp: number; phase: number },
  target: { freq: number; amp: number; phase: number },
): number {
  const df = Math.abs(user.freq - target.freq) / 5;
  const da = Math.abs(user.amp - target.amp) / 1.5;
  const dp = Math.abs(user.phase - target.phase) / Math.PI;
  const err = (df * 0.45 + da * 0.3 + dp * 0.25);
  return clamp(Math.round((1 - err) * 100), 0, 100);
}

export function canAffordCost(inv: InventoryCounts, cost: Partial<InventoryCounts>): boolean {
  for (const k of Object.keys(cost) as (keyof InventoryCounts)[]) {
    const need = cost[k] || 0;
    if ((inv[k] || 0) < need) return false;
  }
  return true;
}

export function deductCost(inv: InventoryCounts, cost: Partial<InventoryCounts>): boolean {
  if (!canAffordCost(inv, cost)) return false;
  for (const k of Object.keys(cost) as (keyof InventoryCounts)[]) {
    const need = cost[k] || 0;
    inv[k] = (inv[k] || 0) - need;
  }
  return true;
}

export function applyAimAssist(
  rawAngle: number,
  px: number,
  py: number,
  targets: readonly { x: number; y: number; dead?: boolean }[],
  assistStrength: number, // 0..100
  maxRange = 460,
): number {
  if (assistStrength <= 0) return rawAngle;
  const maxCone = (assistStrength / 100) * 0.34;
  let bestAng = rawAngle;
  let bestDiff = maxCone;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.dead) continue;
    const dx = t.x - px;
    const dy = t.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRange || dist < 12) continue;
    const a = Math.atan2(dy, dx);
    const diff = Math.abs(angdiff(a, rawAngle));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAng = rawAngle + angdiff(a, rawAngle) * (assistStrength / 100) * 0.72;
    }
  }
  return bestAng;
}
