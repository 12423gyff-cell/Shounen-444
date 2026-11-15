import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angdiff,
  applyAimAssist,
  canAffordCost,
  collideEntity,
  computeComboMultiplier,
  computeKillScore,
  createNurseCircuitGrid,
  deductCost,
  evaluateCircuit,
  evaluateOscilloscopeMatch,
  freeSpot,
  lightPoly,
  lineOfSight,
  rayHit,
  segCircle,
} from './physics.ts';
import type { InventoryCounts, Obstacle } from './types.ts';

test('collideEntity resolves wall penetration without tunneling', () => {
  const obs: Obstacle[] = [{ x: 100, y: 100, w: 80, h: 40, t: 'wall' }];
  const ent = { x: 105, y: 94 };
  const res = collideEntity(ent, 14, obs, 2600, 1800);
  assert.equal(res.hit, true);
  assert.ok(ent.y <= 86.01, `expected entity pushed above wall, got y=${ent.y}`);
});

test('rayHit and lightPoly stop at walls (no bleeding light through walls)', () => {
  const obs: Obstacle[] = [{ x: 200, y: 50, w: 30, h: 200, t: 'wall' }];
  const dist = rayHit(100, 150, 0, 400, obs);
  assert.ok(Math.abs(dist - 100) < 0.01, `expected rayHit at wall distance 100, got ${dist}`);
  const poly = lightPoly(100, 150, 0, 0.4, 400, 8, obs);
  assert.equal(poly.length, 9);
  for (const [px] of poly) {
    assert.ok(px <= 200.5, `light ray pierced wall to x=${px}`);
  }
  assert.equal(lineOfSight(100, 150, 300, 150, obs), false);
  assert.equal(lineOfSight(100, 150, 150, 150, obs), true);
});

test('segCircle accurately detects fast bullet intersection against circle hitbox', () => {
  assert.equal(segCircle(0, 0, 200, 0, 100, 8, 13), true);
  assert.equal(segCircle(0, 0, 200, 0, 100, 30, 13), false);
});

test('freeSpot rejects positions inside obstacles or outside world bounds', () => {
  const obs: Obstacle[] = [{ x: 300, y: 300, w: 60, h: 60, t: 'crate' }];
  assert.equal(freeSpot(330, 330, 14, obs, 2600, 1800), false);
  assert.equal(freeSpot(10, 330, 14, obs, 2600, 1800), false);
  assert.equal(freeSpot(500, 500, 14, obs, 2600, 1800), true);
});

test('4x4 Nurse Station Circuit Conduit puzzle evaluates connectivity to sink', () => {
  const grid = createNurseCircuitGrid();
  const initial = evaluateCircuit(grid);
  assert.equal(initial.solved, false);

  // Build an explicit solved path along top row + right edge to (3,3) sink:
  // (0,0)source(E) -> (1,0)straight(E-W, rot=1) -> (2,0)straight(E-W, rot=1) -> (3,0)corner(W-S, rot=2)
  // -> (3,1)straight(N-S, rot=0) -> (3,2)straight(N-S, rot=0) -> (3,3)sink(in N? sink base is W=3, so rot=1 => N=0)
  const solvedGrid = createNurseCircuitGrid();
  solvedGrid[0] = { kind: 'source', rot: 0 };
  solvedGrid[1] = { kind: 'straight', rot: 1 };
  solvedGrid[2] = { kind: 'straight', rot: 1 };
  solvedGrid[3] = { kind: 'corner', rot: 2 };
  solvedGrid[7] = { kind: 'straight', rot: 0 };
  solvedGrid[11] = { kind: 'straight', rot: 0 };
  solvedGrid[15] = { kind: 'sink', rot: 1 };
  const check = evaluateCircuit(solvedGrid);
  assert.equal(check.solved, true);
  assert.ok(check.poweredIndices.includes(15));
});

test('Bio-Frequency Oscilloscope returns 100% on exact match and scales smoothly down', () => {
  const target = { freq: 3.4, amp: 1.1, phase: 1.5 };
  assert.equal(evaluateOscilloscopeMatch(target, target), 100);
  const near = evaluateOscilloscopeMatch({ freq: 3.5, amp: 1.05, phase: 1.45 }, target);
  assert.ok(near >= 92, `expected near match >= 92%, got ${near}`);
  const far = evaluateOscilloscopeMatch({ freq: 0.5, amp: 0.2, phase: 0 }, target);
  assert.ok(far < 60, `expected mismatched wave < 60%, got ${far}`);
});

test('Crafting & upgrade economy validates and deducts resources atomically', () => {
  const inv: InventoryCounts = {
    salvage: 200,
    scrap: 2,
    biogel: 1,
    cells: 1,
    fuel: 0,
    medkits: 0,
    grenades: 1,
    icuKeycard: 0,
    morgueKeycard: 0,
    reactorOverride: 0,
  };
  assert.equal(canAffordCost(inv, { scrap: 2, cells: 1 }), true);
  assert.equal(canAffordCost(inv, { scrap: 2, fuel: 1 }), false);
  assert.equal(deductCost(inv, { scrap: 2, fuel: 1 }), false);
  assert.equal(inv.scrap, 2); // atomic rollback
  assert.equal(deductCost(inv, { scrap: 2, cells: 1 }), true);
  assert.equal(inv.scrap, 0);
  assert.equal(inv.cells, 0);
});

test('Combo multiplier and kill score scale accurately up to x8 cap', () => {
  assert.equal(computeComboMultiplier(0), 1);
  assert.equal(computeComboMultiplier(3), 2);
  assert.equal(computeComboMultiplier(6), 3);
  assert.equal(computeComboMultiplier(30), 8);
  assert.equal(computeKillScore(100, 6, false), 300);
  assert.equal(computeKillScore(100, 6, true), 450);
});

test('Aim assist nudges toward nearest in-cone enemy without snapping behind player', () => {
  const targets = [
    { x: 200, y: 110, dead: false },
    { x: -100, y: 100, dead: false },
  ];
  const raw = 0; // looking East from (100, 100)
  const assisted = applyAimAssist(raw, 100, 100, targets, 80, 400);
  assert.ok(assisted > 0 && assisted < Math.atan2(10, 100), `expected subtle positive nudge, got ${assisted}`);
  assert.ok(Math.abs(angdiff(Math.PI * 1.9, Math.PI * 0.1)) < 0.7);
});

test('buildHospitalWorld creates non-trapped player spawn, 7 CO2 extinguishers, 10 canisters, and complete 4-8-2-7 UV sequence', async () => {
  const { buildHospitalWorld } = await import('./world.ts');
  const { WW, WH } = await import('./types.ts');
  const w = buildHospitalWorld();

  // Player starts in Reception at (1000, 700) without wall overlap
  assert.equal(freeSpot(1000, 700, 14, w.obs, WW, WH), true);
  assert.equal(w.canisters.length, 10);
  assert.equal(w.extinguishers.length, 7);
  assert.equal(w.doors.length, 9);
  assert.equal(w.docs.length, 8);
  assert.equal(
    w.uvMarks.map((u) => u.digit).join(''),
    '4827',
    'Expected UV clue digits to form 4827',
  );
  for (const ext of w.extinguishers) {
    assert.ok(ext.x > 60 && ext.x < WW - 60 && ext.y > 60 && ext.y < WH - 60);
    assert.equal(ext.triggered, false);
  }
});
