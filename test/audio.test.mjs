// The office's sounds: the list that says how each one was made (tools/make-audio.mjs), the files under
// public/audio/, and the names the browser plays all agree — and nothing here needs the files to exist,
// because the office has to work without them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, startOffice } from './helpers.mjs';
import { MANIFEST } from '../tools/make-audio.mjs';
import { MIX, SYNTH, VOLUME, hear } from '../public/world/ui/sound.js';

const AUDIO = path.join(ROOT, 'public', 'audio');
const SAFE = /^[a-z0-9][a-z0-9-]*$/;
const names = new Set(MANIFEST.map((m) => m.name));
const files = fs.existsSync(AUDIO) ? fs.readdirSync(AUDIO).filter((f) => !f.startsWith('.')) : [];

test('importing the generator asks nobody for anything', () => {
  // in a child of its own: no network, no ffmpeg, no files, nothing printed — it only hands over its list
  const script = `
    import cp from 'node:child_process'; import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
    const did = { spawned: 0, fetched: 0, wrote: 0 };
    for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) cp[k] = () => { did.spawned++; return { status: 1, stdout: '', stderr: '', on() {}, unref() {} }; };
    for (const k of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'renameSync', 'unlinkSync', 'copyFileSync']) fs[k] = () => { did.wrote++; };
    syncBuiltinESMExports();
    globalThis.fetch = async () => { did.fetched++; throw new Error('no network in a test'); };
    const m = await import(process.env.GENERATOR);
    await new Promise((r) => setTimeout(r, 50));
    console.error(JSON.stringify({ ...did, exports: Object.keys(m), entries: m.MANIFEST.length }));
  `;
  const before = files.join(',');
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: ROOT,
    env: { ...process.env, GENERATOR: pathToFileURL(path.join(ROOT, 'tools', 'make-audio.mjs')).href, ELEVENLABS_API_KEY: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '', 'it prints nothing');
  assert.deepEqual(JSON.parse(r.stderr.trim().split('\n').pop()), { spawned: 0, fetched: 0, wrote: 0, exports: ['MANIFEST'], entries: MANIFEST.length });
  assert.equal(fs.existsSync(AUDIO) ? fs.readdirSync(AUDIO).filter((f) => !f.startsWith('.')).join(',') : '', before, 'and public/audio is as it was');
});

test('the list is well formed', () => {
  assert.ok(MANIFEST.length >= 30);
  assert.equal(names.size, MANIFEST.length, 'no name twice');
  for (const m of MANIFEST) {
    assert.match(m.name, SAFE, `${m.name}: a name is a file name and a URL, so plain lower-case words and dashes`);
    assert.ok(m.name.length <= 32, `${m.name}: short`);
    assert.ok(['sfx', 'music', 'voice'].includes(m.kind), `${m.name}: sfx, music or voice`);
    assert.ok(typeof m.text === 'string' && m.text.trim().length >= 3, `${m.name} says what to make`);
    assert.doesNotMatch(m.text, /[\\/@]|https?:/i, `${m.name}: a prompt describes a sound; no paths, addresses or links`);
    if (m.kind === 'sfx') assert.ok(m.seconds >= 0.5 && m.seconds <= 30, `${m.name}: the effects API makes 0.5 to 30 seconds`);
    if (m.kind === 'voice') assert.ok(typeof m.who === 'string' && m.who, `${m.name} has a voice`);
    if (m.loop) assert.equal(m.kind, 'sfx', `${m.name}: only an effect is asked to loop`);
    if (m.kind === 'music') {
      assert.ok(m.seconds >= 3 && m.seconds <= 600, `${m.name}: the music API makes 3 seconds to 10 minutes`);
      assert.ok(m.bpm > 30 && m.bpm < 300, `${m.name} says its tempo`);
      assert.ok(Number.isInteger(m.seconds / (240 / m.bpm)), `${m.name}: ${m.seconds} s is not a whole number of bars at ${m.bpm} BPM, so it would not come round on the beat`);
    }
  }
});

test('public/audio holds what the list says, and nothing else', (t) => {
  if (!files.length) { t.skip('public/audio is not there: the office runs on its synth'); return; }
  let total = 0;
  for (const f of files) {
    assert.ok(f.endsWith('.mp3'), `${f}: only .mp3 files live here`);
    assert.ok(names.has(f.slice(0, -4)), `${f} is not in the list in tools/make-audio.mjs: add it there, or delete the file`);
    const full = path.join(AUDIO, f), size = fs.statSync(full).size;
    total += size;
    const head = Buffer.alloc(3);
    const fd = fs.openSync(full, 'r'); fs.readSync(fd, head, 0, 3, 0); fs.closeSync(fd);
    assert.ok(size > 1000 && (head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)), `${f} is an MP3`);
  }
  assert.ok(total < 3 * 1024 * 1024, `public/audio is ${(total / 1024 / 1024).toFixed(2)} MB; it is meant to stay under 3`);
  const absent = [...names].filter((n) => !files.includes(`${n}.mp3`));
  if (absent.length) t.diagnostic(`in the list but not made yet (the synth or silence stands in): ${absent.join(', ')}`);
});

test('every sound the browser plays by name is one that exists', () => {
  // a call on office.sound anywhere; and, outside the Backrooms (which keep a synth and a vocabulary of their own),
  // any play('…'), playAt('…'), music('…'), ambience('…') or the levels' sfx('…')
  const direct = /office\.sound\??\.(?:play|music|ambience)\??\.?\(\s*(['"`])([^'"`$]*)\1/g;
  const loose = /\b(?:play|playAt|music|ambience|sfx)\??\.?\(\s*(?:office\s*,\s*)?(['"`])([^'"`$]*)\1/g;
  const used = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const rel = path.relative(ROOT, full), text = fs.readFileSync(full, 'utf8');
      for (const re of rel.split(path.sep).includes('backrooms') ? [direct] : [direct, loose]) {
        for (const hit of text.matchAll(re)) used.set(hit[2], rel);
      }
    }
  };
  walk(path.join(ROOT, 'public', 'world'));
  assert.ok(used.size >= 10, `the search itself still works (it found ${used.size} sounds played by name)`);
  for (const [name, where] of used) assert.ok(names.has(name), `${where} plays '${name}', which is not in the list in tools/make-audio.mjs`);
});

test('the mix knows every sound for what it is', () => {
  for (const name of [...Object.keys(MIX), ...Object.keys(SYNTH)]) assert.ok(names.has(name), `sound.js mentions '${name}', which is not in the list`);
  for (const m of MANIFEST) {
    const bus = MIX[m.name]?.bus;
    if (m.kind === 'music') assert.equal(bus, 'music', `${m.name} is a song: it belongs on the music bus, under the Music switch`);
    if (m.loop) assert.equal(bus, 'bed', `${m.name} is a bed: it belongs under the Ambience switch`);
    if (m.kind === 'voice') assert.equal(bus, 'voice', `${m.name} is a voice: the music should duck under it`);
  }
  for (const [name, mix] of Object.entries(MIX)) {
    assert.ok(mix.gain > 0 && mix.gain <= 1, `${name}: a gain between 0 and 1`);
    if (mix.with) assert.ok(names.has(mix.with[0]) && mix.with[1] > 0 && mix.with[2] >= mix.with[1], `${name}: what it lets fall, and how often`);
  }
  // quiet by default: the office sits under the room, not on top of it
  assert.ok(VOLUME.normal <= 0.5 && VOLUME.quiet < VOLUME.normal && VOLUME.normal < VOLUME.loud && VOLUME.loud <= 1);
  for (const name of Object.keys(MIX)) if (MIX[name].bus === 'bed') assert.ok(MIX[name].gain <= 0.5, `${name}: a bed stays in the background`);
});

test('a sound with a place is quieter further off, and silent far away', () => {
  const close = { x: 0, z: 0, yaw: 0, dist: 9 }, overview = { ...close, dist: 46 }, table = { ...close, dist: 160 };
  assert.equal(hear({ x: 0, z: 0 }, close).gain, 1, 'in the middle of the view, up close: all of it');
  assert.ok(hear({ x: 2, z: 1 }, close).gain > 0.95);
  const mid = hear({ x: 8, z: 0 }, close).gain;
  assert.ok(mid > 0.2 && mid < 0.9, `some of it at 8 m (${mid})`);
  assert.equal(hear({ x: 25, z: 0 }, close).gain, 0, 'none of it across the building');
  assert.ok(hear({ x: 25, z: 0 }, close, 2).gain > 0, 'unless it carries');
  const far = hear({ x: 0, z: 0 }, overview).gain;
  assert.ok(far > 0.2 && far < 0.6, `the whole office is quieter from the overview (${far})`);
  assert.ok(hear({ x: 20, z: 5 }, overview).gain > 0.1, 'but what is on screen can still be heard');
  assert.equal(hear({ x: 0, z: 0 }, table).gain, 0, 'and a model on a table makes no sound');
  // left and right follow the camera, not the compass
  assert.ok(hear({ x: 4, z: 0 }, close).pan > 0.1 && hear({ x: -4, z: 0 }, close).pan < -0.1);
  assert.ok(hear({ x: 0, z: 4 }, { ...close, yaw: Math.PI / 2 }).pan < -0.1, 'seen from the east, north-south is left-right');
  for (const at of [{ x: 3, z: 9 }, { x: -40, z: 2 }]) { const h = hear(at, overview); assert.ok(h.gain >= 0 && h.gain <= 1 && Math.abs(h.pan) <= 1); }
});

test('the daemon serves a sound as audio, and says so plainly when there is none', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const missing = await fetch(`${office.base}/audio/no-such-sound.mp3`);
  assert.equal(missing.status, 404, 'a missing file is a 404: that is what sends the client to its synth');
  await missing.arrayBuffer();
  if (!files.length) return;
  const res = await fetch(`${office.base}/audio/${files[0]}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.equal((await res.arrayBuffer()).byteLength, fs.statSync(path.join(AUDIO, files[0])).size);
});
