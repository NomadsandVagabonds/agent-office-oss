// The world, from the outside: humans on the floor, things you can use,
// and the browser code at least parsing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, sleep, startOffice } from './helpers.mjs';
import { SAFE_KEYS } from '../tmux-manager.mjs';
import { buildLayout } from '../core/layout.mjs';

function openSocket(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const seen = [];
    ws.addEventListener('message', (e) => { try { seen.push(JSON.parse(e.data)); } catch { /* not ours */ } });
    ws.addEventListener('open', () => resolve({ ws, seen, send: (m) => ws.send(JSON.stringify(m)) }));
    ws.addEventListener('error', () => reject(new Error('websocket failed')));
  });
}
const until = async (fn, ms = 2000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(20); } return fn(); };

test('a human can walk the floor, and agents can tell', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const joined = await office.post('/api/agents/join', { provider: 'gemini', name: 'Ada', cwd: '/tmp/proj/atlas' });
  assert.equal(joined.status, 200);
  const agent = joined.data.agent.id;

  const client = await openSocket(office.port);
  t.after(() => client.ws.close());
  await until(() => client.seen.some((m) => m.type === 'world'));
  client.send({ type: 'lead', id: 'tester', name: 'Robin' });
  client.send({ type: 'walk', x: 2.3, z: -6.2, heading: 0, moving: false });

  const who = await until(() => null, 150).then(() => office.get('/api/world/who'));
  assert.match(who.data.text, /Humans on the floor: Robin \(Kitchen\)/);

  const go = await office.post('/api/world/go', { agent, to: 'lead' });
  assert.equal(go.status, 200);
  assert.match(go.data.text, /walk over to Robin/);
  assert.equal(go.data.place.room, 'kitchen');

  const look = await office.get(`/api/world/look?agent=${agent}`);
  assert.match(look.data.text, /Robin \(human\) is here in the room with you/);

  // other viewers hear about it too
  assert.ok(client.seen.some((m) => m.type === 'world_fx' && m.fx.kind === 'lead' && m.fx.name === 'Robin' && m.fx.x === 2.3));

  // positions outside the building, or inside a room nobody has found, are ignored
  client.send({ type: 'walk', x: 500, z: 500 });
  client.send({ type: 'walk', x: -4, z: -10 });                 // the locked back room
  await sleep(120);
  assert.match((await office.get('/api/world/who')).data.text, /Robin \(Kitchen\)/);

  client.send({ type: 'walk', off: true });
  await sleep(120);
  assert.doesNotMatch((await office.get('/api/world/who')).data.text, /Humans on the floor/);
  const gone = await office.post('/api/world/go', { agent, to: 'lead' });
  assert.equal(gone.status, 404);
});

test('a human uses things by the same rules as an agent', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const use = (thing, arg) => office.post('/api/world/lead/use', { id: 'tester', name: 'Robin', thing, arg });

  const coffee = await use('coffee');
  assert.equal(coffee.status, 200);
  assert.match(coffee.data.text, /You brew a cup/);

  await use('bell'); await use('bell');
  const third = await use('bell');
  assert.equal(third.data.found, 'ding');
  const world = (await office.get('/api/world')).data;
  assert.equal(world.secrets.find((s) => s.id === 'ding').by, 'Robin');

  assert.equal((await use('console', 'xyzzy')).data.found, 'magic-word');
  assert.equal((await use('a thing that is not there')).status, 404);
  assert.equal((await office.post('/api/world/lead/use', {})).status, 400);

  // what is behind the bookshelf does not exist until someone finds it
  assert.equal((await use('arcade-1')).status, 404);
  const book = await use('bookshelf');
  assert.equal(book.data.found, 'red-book');
  assert.equal((await office.get('/api/world')).data.plan.unlocked.backroom, true);
  assert.equal((await use('jukebox')).status, 200);
});

test('the world snapshot says where today\'s duck is, on a real desk', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  await office.post('/api/agents/join', { provider: 'custom', name: 'Bo', cwd: '/tmp/proj/atlas' });
  const world = (await office.get('/api/world')).data;
  const layout = buildLayout(world.plan);
  assert.ok(world.today.duckDesk, 'a duck desk is chosen once there is a project room');
  assert.ok(layout.desk(world.today.duckDesk), 'and it is a desk that exists');
  assert.equal(typeof world.today.tzOffsetMin, 'number');
});

test('only harmless named keys can be pressed in a terminal', () => {
  for (const key of ['Enter', 'Escape', 'Up', 'C-c']) assert.ok(SAFE_KEYS.has(key));
  for (const key of ['C-b', 'rm -rf /', '; ls', 'F12', '']) assert.ok(!SAFE_KEYS.has(key));
});

test('every browser module parses', () => {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p); } };
  walk(path.join(ROOT, 'public', 'world'));
  assert.ok(files.length > 20);
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${path.relative(ROOT, file)} does not parse:\n${r.stderr}`);
  }
});
