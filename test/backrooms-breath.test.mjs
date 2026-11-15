// Out of Office: breath (player.js WIND). A run is paid for, and nothing on the screen says how much is left.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, WIND } from '../public/world/backrooms/player.js';

const world = () => ({ free: () => true, passable: () => true, floorY: () => 0, headroom: () => 2.6 });
const cam = () => ({ position: { set() {} }, rotation: { set() {} } });
const visitor = (keys) => { const input = { keys: new Set(keys), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false }; return { input, p: createPlayer(world(), cam(), { x: 0, z: 0, yaw: 0 }, input) }; };
const run = (p, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) p.update(1 / 60, t); };

test('a run lasts about WIND.run seconds, and then you are out of breath: slow, and Shift does nothing', () => {
  const { p } = visitor(['w', 'Shift']);
  let told = 0; p.on('winded', () => { told++; });
  run(p, 2); const fast = p.me.speed;
  assert.ok(p.me.sprinting && fast > 3.4, 'running');
  run(p, WIND.run - 2.5); assert.equal(told, 0, 'not yet');
  run(p, 1.2);
  assert.equal(told, 1, 'said once, the moment it is gone');
  assert.ok(p.me.winded > 0 && !p.me.sprinting, 'out of breath with Shift still held');
  assert.ok(p.me.speed < 2.05 * WIND.slow + 0.1, `slower than a walk (${p.me.speed.toFixed(2)} m/s)`);
  run(p, WIND.spent + 0.2);
  assert.ok(!(p.me.winded > 0) && p.me.sprinting, 'and running again when it is back: not for long');
  assert.equal(told, 1);
  run(p, WIND.run * 0.6);
  assert.equal(told, 2, 'the second run is a short one');
});

test('breath comes back, sooner standing than walking; a walk never costs any', () => {
  const walker = visitor(['w']); run(walker.p, 30);
  assert.equal(walker.p.me.wind, 1); assert.ok(!(walker.p.me.winded > 0));
  const a = visitor(['w', 'Shift']), b = visitor(['w', 'Shift']);
  run(a.p, WIND.run * 0.75); run(b.p, WIND.run * 0.75);
  a.input.keys.clear(); b.input.keys.delete('Shift');
  run(a.p, 2); run(b.p, 2);
  assert.ok(a.p.me.wind > b.p.me.wind && b.p.me.wind > 0.25, `standing ${a.p.me.wind.toFixed(2)}, walking ${b.p.me.wind.toFixed(2)}`);
});

test('the recordings the breath and the wall people play are there', () => {
  const at = (rel) => new URL(`../public/world/backrooms/${rel}`, import.meta.url);
  for (const f of ['breath/pant.mp3', 'absorbed/moan1.mp3', 'absorbed/moan2.mp3', 'absorbed/moan3.mp3']) assert.ok(fs.statSync(at(f)).size > 8000, f);
  assert.match(fs.readFileSync(at('index.js'), 'utf8'), /player\.on\('winded', \(\) => sound\.file\(new URL\('\.\/breath\/pant\.mp3', import\.meta\.url\)/);
  assert.match(fs.readFileSync(at('absorbed.js'), 'utf8'), /env\.sound\?\.file\?\.\(MOANS\[/);
});
