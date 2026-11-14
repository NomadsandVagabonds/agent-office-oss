// The level's music: one file of the owner's, beside the level, played low under everything else.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stage } from '../tools/backrooms-sample/stage.mjs';

const dir = new URL('../public/world/backrooms/', import.meta.url);

test('music: the file is beside the level, the sound asks for it by its own address, and it is quieter than a small sound', () => {
  const src = fs.readFileSync(new URL('sound.js', dir), 'utf8');
  const m = src.match(/new URL\('(\.\/music\/[\w.-]+\.mp3)', import\.meta\.url\)/);
  assert.ok(m, 'the sound says where its music is, relative to itself (so it is found wherever the level is put)');
  assert.ok(fs.statSync(new URL(m[1], dir)).size > 100000, 'and the file is there');
  const gain = Number(src.match(/export const MUSIC_GAIN = ([\d.]+);/)[1]);
  assert.ok(gain > 0.1 && gain <= 0.5, 'low: it goes under the place, not over it');
  assert.match(src, /connect\(g\); g\.connect\(master\)/, 'through the same master as everything else, so M silences it');
  assert.match(src, /music\.pause\(\)/, 'and it stops when the visit does');
  assert.ok(!/https?:\/\//.test(src), 'nothing is asked of any other site');
});

test('music: wherever the level is staged, the file goes with it', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'br-music-'));
  try {
    const { files } = stage(out, { page: null });
    assert.ok(files.includes('world/backrooms/music/room4.mp3'));
    assert.ok(fs.existsSync(path.join(out, 'world/backrooms/music/room4.mp3')));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
