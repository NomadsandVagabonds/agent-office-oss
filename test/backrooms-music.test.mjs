// The level's music: one file of the owner's, beside the level, played low under everything else.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stage } from '../tools/backrooms-sample/stage.mjs';
import { createSound, MUSIC_GAIN } from '../public/world/backrooms/sound.js';

const dir = new URL('../public/world/backrooms/', import.meta.url);

test('music: the file is beside the level, the sound asks for it by its own address, and it is quieter than a small sound', () => {
  const src = fs.readFileSync(new URL('sound.js', dir), 'utf8');
  const m = src.match(/new URL\('(\.\/music\/[\w.-]+\.mp3)', import\.meta\.url\)/);
  assert.ok(m, 'the sound says where its music is, relative to itself (so it is found wherever the level is put)');
  assert.ok(fs.statSync(new URL(m[1], dir)).size > 100000, 'and the file is there');
  const gain = Number(src.match(/export const MUSIC_GAIN = ([\d.]+);/)[1]);
  assert.ok(gain > 0.1 && gain <= 0.5, 'low: it goes under the place, not over it');
  assert.match(src, /music\.pause\(\)/, 'and it stops when the visit does');
  assert.ok(!/https?:\/\//.test(src), 'nothing is asked of any other site');
});

// A small audio graph, rather than a browser or a speaker: its edges show what a dial can silence,
// and its lifecycle shows whether holding the tape still accidentally starts another soundtrack.
function audio(t, options = {}) {
  const previous = { window:globalThis.window, Audio:globalThis.Audio }, contexts = [], tracks = [];
  class Param {
    value = 0;
    events = [];
    setValueAtTime(value, at) { this.events.push(['set', value, at]); this.value = value; }
    linearRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); this.value = value; }
    exponentialRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); this.value = value; }
    setTargetAtTime(value, at, rate) { this.events.push(['target', value, at, rate]); this.value = value; }
    cancelScheduledValues(at) { this.events.push(['cancel', at]); }
  }
  class Node {
    connections = [];
    gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); pan = new Param();
    connect(to) { this.connections.push(to); return to; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }
  class Context {
    state = 'running'; currentTime = 12; sampleRate = 8; destination = new Node();
    nodes = []; oscillators = []; media = []; resumes = 0; suspends = 0;
    constructor() { contexts.push(this); }
    make() { const n = new Node(); this.nodes.push(n); return n; }
    createGain() { return this.make(); }
    createBiquadFilter() { return this.make(); }
    createStereoPanner() { return this.make(); }
    createBufferSource() { return this.make(); }
    createOscillator() { const n = this.make(); this.oscillators.push(n); return n; }
    createMediaElementSource(el) { const n = this.make(); n.element = el; this.media.push(n); return n; }
    createBuffer() { return { getChannelData:() => new Float32Array(8) }; }
    suspend() { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  class Track {
    paused = true; currentTime = 0; plays = 0;
    constructor(src) { this.src = src; tracks.push(this); }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() { this.currentTime = 0; }
  }
  globalThis.window = { AudioContext:Context }; globalThis.Audio = Track;
  const sound = createSound({ hum:50 }, options);
  t.after(() => {
    sound.stop();
    for (const key of ['window', 'Audio']) if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
  });
  return { sound, contexts, tracks };
}

test('music and effects have independent dials, and master mute still silences both', t => {
  const { sound, contexts, tracks } = audio(t, { musicVolume:0.3, sfxVolume:0.8 });
  assert.equal(contexts.length, 0, 'nothing starts before a gesture');
  sound.start();
  const ctx = contexts[0], envelope = ctx.media[0].connections[0], musicBus = envelope.connections[0], master = musicBus.connections[0];
  sound.play('beep');
  const effects = ctx.oscillators.at(-1).connections[0].connections[0];
  assert.notEqual(musicBus, effects);
  assert.equal(effects.connections[0], master);
  assert.equal(master.connections[0], ctx.destination);
  assert.equal(master.gain.value, 0.5);
  assert.equal(musicBus.gain.value, 0.3); assert.equal(effects.gain.value, 0.8);
  assert.deepEqual(envelope.gain.events, [['ramp', MUSIC_GAIN, 18]], 'the music still fades in over six seconds');
  sound.setMusicVolume(0); assert.equal(musicBus.gain.value, 0); assert.equal(effects.gain.value, 0.8);
  sound.setSfxVolume(0); assert.equal(effects.gain.value, 0);
  sound.setMute(true); sound.setMusicVolume(0.7); sound.setSfxVolume(0.4);
  assert.equal(master.gain.value, 0, 'adjusting either dial cannot undo M');
  sound.setMute(false);
  assert.equal(master.gain.value, 0.5); assert.equal(musicBus.gain.value, 0.7); assert.equal(effects.gain.value, 0.4);
  assert.equal(sound.musicVolume, 0.7); assert.equal(sound.sfxVolume, 0.4);
  assert.equal(tracks.length, 1); assert.equal(tracks[0].plays, 1, 'moving a dial never restarts the track');
});

test('menu pause freezes the audio graph and soundtrack, and resumes that same recording', t => {
  const { sound, contexts, tracks } = audio(t);
  sound.start(); const ctx = contexts[0], track = tracks[0]; track.currentTime = 34;
  const nodes = ctx.nodes.length;
  sound.setPaused(true); sound.setPaused(true);
  assert.equal(sound.paused, true); assert.equal(sound.on, false);
  assert.equal(ctx.state, 'suspended'); assert.equal(ctx.suspends, 1); assert.equal(track.paused, true);
  sound.start(); sound.play('ring'); sound.setMusicVolume(0.4);
  assert.equal(ctx.nodes.length, nodes, 'no effects are queued while paused');
  assert.equal(ctx.resumes, 0); assert.equal(track.plays, 1, 'a menu gesture cannot wake the soundtrack');
  sound.setPaused(false);
  assert.equal(sound.on, true); assert.equal(ctx.state, 'running'); assert.equal(track.paused, false);
  assert.equal(track.currentTime, 34); assert.equal(tracks.length, 1); assert.equal(ctx.nodes.length, nodes);
  sound.setPaused(true); sound.setMute(true); sound.setPaused(false);
  assert.equal(sound.muted, true); assert.equal(sound.on, false, 'resuming preserves the visitor’s mute choice');
  sound.stop(); assert.equal(ctx.state, 'closed'); assert.equal(track.paused, true); assert.equal(track.src, '');
  assert.doesNotThrow(() => { sound.setMusicVolume(0.5); sound.setSfxVolume(0.5); sound.setMute(false); sound.setPaused(false); });
});

test('audio dials accept only finite levels, and a menu opened before the first gesture stays silent', t => {
  const { sound, contexts } = audio(t, { musicVolume:NaN, sfxVolume:-2 });
  assert.equal(sound.musicVolume, 1); assert.equal(sound.sfxVolume, 0);
  sound.setMusicVolume(3); sound.setSfxVolume(Infinity);
  assert.equal(sound.musicVolume, 1); assert.equal(sound.sfxVolume, 0);
  sound.setPaused(true); sound.start(); assert.equal(contexts.length, 0);
  sound.setPaused(false); assert.equal(contexts.length, 0, 'closing a menu alone does not create an audio context');
  sound.start(); assert.equal(contexts.length, 1);
});

test('music: wherever the level is staged, the file goes with it', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'br-music-'));
  try {
    const { files } = stage(out, { page: null });
    assert.ok(files.includes('world/backrooms/music/room4.mp3'));
    assert.ok(fs.existsSync(path.join(out, 'world/backrooms/music/room4.mp3')));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
