import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildLayout, slotInfo, DESKS_PER_ROOM } from '../core/layout.mjs';
import { createNav } from '../core/nav.mjs';
import { resolveLook, resolveDeskItems, sanitizeLookPatch, hashId } from '../core/look.mjs';
import { validateCreation } from '../core/creations.mjs';
import { CAPS, capabilityOf, classifyBlock, normalizeProvider, promptActions } from '../core/contract.mjs';
import { SECRETS, dayQuirks, dayWeather } from '../core/secrets.mjs';
import { appendCreation, readCreations } from '../server/creations-store.mjs';
import { ROOT, tempDir } from './helpers.mjs';

const plan = (n, unlocked = {}) => ({
  rooms: Array.from({ length: n }, (_, i) => ({ slot: i, deptId: 'd' + i, name: 'Dept ' + i })), unlocked,
});

test('layout: rooms fill slots wing by wing and stay put', () => {
  assert.deepEqual(slotInfo(0), { wing: 'W', side: 'N', col: 0 });
  assert.deepEqual(slotInfo(5), { wing: 'E', side: 'N', col: 1 });
  const a = buildLayout(plan(3)), b = buildLayout(plan(3));
  assert.equal(a.cols, 1);
  assert.equal(a.rooms.filter((r) => r.kind === 'project').length, 3);
  assert.equal(a.rooms.filter((r) => r.kind === 'vacant').length, 1);
  assert.deepEqual(a.roomById.get('dept:d1').rect, b.roomById.get('dept:d1').rect, 'deterministic');
  assert.equal(buildLayout(plan(5)).cols, 2, 'grows by a bay when a fifth project arrives');
  assert.deepEqual(buildLayout(plan(5)).roomById.get('dept:d1').rect, a.roomById.get('dept:d1').rect, 'growing never moves a room');
});

test('layout: every project room has its desks, seats on walkable tiles', () => {
  const L = buildLayout(plan(4));
  for (const room of L.rooms.filter((r) => r.kind === 'project')) {
    const desks = L.desks.filter((d) => d.room === room.id);
    assert.equal(desks.length, DESKS_PER_ROOM);
    for (const d of desks) assert.ok(L.walkable(Math.floor(d.seat.x), Math.floor(d.seat.z)), `seat ${d.id} is reachable`);
  }
});

test('nav: any desk can reach the coffee machine, the elevator and any other desk', () => {
  const L = buildLayout(plan(8));
  const nav = createNav(L);
  const from = L.desk('dept:d0#1').seat;
  for (const target of [L.pois.get('coffee').stand, L.spots.elevator, L.desk('dept:d7#6').seat, L.pois.get('console').stand, L.pois.get('hatch').stand]) {
    const p = nav.findPath(from, target);
    assert.ok(p && p.length >= 2, 'a path exists');
    assert.ok(nav.pathLength(p) >= Math.hypot(target.x - from.x, target.z - from.z) - 1e-6, 'no shorter than a straight line');
  }
});

test('nav: paths never cross walls or furniture', () => {
  const L = buildLayout(plan(4));
  const nav = createNav(L);
  const p = nav.findPath(L.desk('dept:d0#0').seat, L.desk('dept:d2#4').seat);   // north room → south room
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (b.x - a.x) * (s / steps), z = a.z + (b.z - a.z) * (s / steps);
      assert.ok(L.walkable(Math.floor(x), Math.floor(z)), `(${x.toFixed(2)}, ${z.toFixed(2)}) is walkable`);
    }
  }
});

test('nav: the back room is unreachable until it is unlocked', () => {
  const locked = buildLayout(plan(2));
  assert.equal(createNav(locked).findPath(locked.spots.plaza, { x: -4.5, z: -10.5 }), null);
  const open = buildLayout(plan(2, { backroom: true }));
  assert.ok(createNav(open).findPath(open.spots.plaza, { x: -4.5, z: -10.5 }));
});

test('look: the same seed always rolls the same character; overrides win; junk is refused', () => {
  assert.deepEqual(resolveLook('p:claude:/x'), resolveLook('p:claude:/x'));
  assert.equal(resolveLook('s', { species: 'cat', accessory: 'c_my_hat' }).species, 'cat');
  assert.equal(resolveLook('s', { species: 'dragon' }).species, resolveLook('s').species, 'unknown species falls back');
  assert.equal(hashId('abc'), 440920331, 'same FNV-1a as the 2D office');
  const { look, errors } = sanitizeLookPatch({ species: 'robot', hair: 'spaghetti', outfitColor: '#ABCDEF', skin: 'red' });
  assert.deepEqual(look, { species: 'robot', outfitColor: '#abcdef' });
  assert.equal(errors.length, 2);
  assert.deepEqual(resolveDeskItems('s', ['duck', 'nope', 'c_thing']), ['duck', 'c_thing']);
  assert.equal(resolveDeskItems('s').length, 4);
});

test('creations: validation is strict and helpful', () => {
  const ok = { id: 'c_ok', kind: 'item', name: 'Ok', ops: [{ o: 'box', x: -4, y: -8, w: 8, h: 8, c: '#aabbcc', d: 6, z: 1 }] };
  assert.deepEqual(validateCreation(ok).errors, []);
  assert.match(validateCreation({ ...ok, id: 'nope' }).errors[0], /id must match/);
  assert.match(validateCreation({ ...ok, kind: 'vehicle' }).errors[0], /kind/);
  assert.match(validateCreation({ ...ok, ops: [{ o: 'rect', x: 400, y: 0, w: 2, h: 2, c: '#000000' }] }).errors[0], /outside x/);
  assert.match(validateCreation({ ...ok, ops: [{ o: 'rect', x: 0, y: 0, w: 2, h: 2, c: 'javascript:alert(1)' }] }).errors[0], /#rrggbb/);
  assert.match(validateCreation({ ...ok, ops: new Array(60).fill(ok.ops[0]) }).errors[0], /max 48/);
  assert.match(validateCreation(ok, { existingIds: new Set(['c_ok']) }).errors[0], /already exists/);
  assert.equal(validateCreation({ ...ok, ops: [{ o: 'teleport', c: '#000000' }] }).notes.length, 1, 'unknown ops are noted, not fatal');
});

test('creations: the legacy is append-only and signed by the store, not the author', () => {
  const file = path.join(tempDir(), 'creations.json');
  fs.copyFileSync(path.join(ROOT, 'public', 'creations.json'), file);
  const before = readCreations(file).creations.length;
  const entry = { id: 'c_test_thing', kind: 'hat', name: 'Test', author: 'FORGED', runtime: 'forged', ops: [{ o: 'rect', x: -3, y: -4, w: 6, h: 3, c: '#112233' }] };
  const made = appendCreation(file, entry, { author: 'Real Author', runtime: 'gemini' });
  assert.equal(made.ok, true);
  assert.equal(made.creation.author, 'Real Author');
  assert.equal(readCreations(file).creations.length, before + 1);
  assert.equal(appendCreation(file, entry, { author: 'x', runtime: 'y' }).ok, false, 'duplicate id refused');
  assert.equal(readCreations(file).creations.length, before + 1);
  assert.ok(!fs.existsSync(file + '.lock'), 'lock released');
});

test('contract: unknown providers are powerless, never shell', () => {
  assert.deepEqual(capabilityOf('mystery'), CAPS.unknown);
  assert.deepEqual(promptActions('shell'), ['once', 'always', 'reject', 'reply']);
  assert.deepEqual(promptActions('claude'), ['reply']);
  assert.deepEqual(promptActions('openrouter'), []);
  assert.equal(normalizeProvider('Claude Code'), 'claude');
  assert.equal(normalizeProvider('gemini-cli'), 'gemini');
  assert.equal(normalizeProvider('something-new'), 'custom');
  assert.equal(classifyBlock('Claude needs your permission to use Bash'), 'permission');
  assert.equal(classifyBlock('Claude is waiting for your input'), 'idle');
  assert.equal(classifyBlock('Which dataset — v3 or v4?'), 'question');
});

test('secrets: the catalogue is well formed and the calendar is stable', () => {
  assert.equal(new Set(SECRETS.map((s) => s.id)).size, SECRETS.length);
  for (const s of SECRETS) assert.ok(s.name && s.blurb && s.hint && s.icon, s.id);
  assert.ok(dayQuirks(new Date(2026, 10, 13)).includes('friday-13'));
  assert.ok(dayQuirks(new Date(2026, 9, 31)).includes('halloween'));
  assert.equal(dayWeather(new Date(2026, 5, 2)), dayWeather(new Date(2026, 5, 2)));
});
