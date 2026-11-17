// The level's music: one file of the owner's, beside the level, played low under everything else.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stage } from '../tools/backrooms-sample/stage.mjs';
import { createSound, MUSIC_GAIN, MASCOT_GAIN } from '../public/world/backrooms/sound.js';
import { ALL_CAST } from '../public/world/backrooms/cast.js';

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
    playbackRate = new Param();
    gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); pan = new Param();
    connect(to) { this.connections.push(to); return to; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }
  class Context {
    decodeAudioData = options.decodeAudioData;
    state = 'running'; currentTime = 12; sampleRate = 8; destination = new Node();
    nodes = []; oscillators = []; media = []; resumes = 0; suspends = 0;
    constructor() { contexts.push(this); }
    make() { const n = new Node(); this.nodes.push(n); return n; }
    createGain() { return this.make(); }
    createWaveShaper() { return this.make(); }
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
    paused = true; currentTime = 0; plays = 0; heard = {};
    constructor(src) { this.src = src; tracks.push(this); }
    addEventListener(type, fn) { (this.heard[type] ||= []).push(fn); }
    /** As the browser would say it: the piece has run out ('ended'), or would not load ('error'). */
    say(type) { if (type === 'ended') this.paused = true; for (const fn of this.heard[type] || []) fn(); }
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

test('music: wherever the level is staged, both files go with it', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'br-music-'));
  try {
    const { files } = stage(out, { page: null });
    for (const name of ['room4.mp3', 'mascot.mp3', 'deep.mp3']) {
      assert.ok(files.includes(`world/backrooms/music/${name}`), name);
      assert.ok(fs.existsSync(path.join(out, `world/backrooms/music/${name}`)), name);
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the mascot\'s music: not fetched until it is wanted, once through in place of the other, and the other comes back', t => {
  const { sound, contexts, tracks } = audio(t, { musicVolume:0.6 });
  assert.equal(sound.playMascot(), false, 'nothing before the first gesture: there is no sound yet');
  sound.start();
  const ctx = contexts[0], usual = ctx.media[0].connections[0], musicBus = usual.connections[0];
  assert.equal(tracks.length, 1, 'only the usual music has been asked for: most visits never hear the other');
  assert.equal(sound.mascotMusic, null);
  ctx.currentTime = 40;
  assert.equal(sound.playMascot(), true);
  const piece = tracks[1], envelope = ctx.media[1].connections[0];
  assert.match(piece.src, /\/music\/mascot\.mp3$/);
  assert.equal(piece.loop, false, 'once through');
  assert.equal(envelope.connections[0], musicBus, 'through the music\'s own dial, so its volume, M and the menu all apply to it');
  assert.deepEqual(envelope.gain.events.at(-1), ['ramp', MASCOT_GAIN, 40.8]);
  assert.deepEqual(usual.gain.events.slice(-2), [['cancel', 40], ['target', 0, 40, 0.5]], 'the usual music gives way');
  assert.deepEqual([piece.plays, sound.mascotMusic.playing], [1, true]);
  // asked for again while it is playing (the next part's mascot, met before this has run out): it is not begun again
  assert.equal(sound.playMascot(), false); assert.equal(piece.plays, 1); assert.equal(tracks.length, 2);
  // the menu holds it still with everything else, and lets it go on from where it was
  piece.currentTime = 61;
  sound.setPaused(true); assert.equal(piece.paused, true);
  sound.start(); assert.equal(piece.plays, 1, 'a touch on the menu does not start it again');
  sound.setPaused(false); assert.deepEqual([piece.paused, piece.plays, piece.currentTime], [false, 2, 61]);
  // it runs out: the usual music comes back up, over a few seconds
  ctx.currentTime = 260; piece.say('ended');
  assert.equal(sound.mascotMusic.playing, false);
  assert.deepEqual(usual.gain.events.slice(-3), [['cancel', 260], ['set', 0, 260], ['ramp', MUSIC_GAIN, 264]]);
  // …and on another part it may be met again, and is played again from the start, on the same player
  ctx.currentTime = 400;
  assert.equal(sound.playMascot(), true);
  assert.deepEqual([tracks.length, piece.plays, piece.currentTime], [2, 3, 0]);
  // the mascot is no more: it fades, and the usual music comes back
  ctx.currentTime = 430; sound.stopMascot();
  assert.equal(sound.mascotMusic.on, false);
  assert.deepEqual(envelope.gain.events.at(-1), ['target', 0, 430, 0.4]);
  assert.deepEqual(usual.gain.events.at(-1), ['ramp', MUSIC_GAIN, 434]);
  sound.stopMascot(); assert.deepEqual(usual.gain.events.at(-1), ['ramp', MUSIC_GAIN, 434], 'stopping what is not playing does nothing');
  sound.stop(); assert.equal(piece.src, ''); assert.equal(sound.mascotMusic, null);
});

test('the mascot\'s music: a phone that will not start it without a touch gets it at the next touch; a file that will not load costs nothing', async t => {
  const { sound, contexts, tracks } = audio(t);
  sound.start();
  const ctx = contexts[0], usual = ctx.media[0].connections[0];
  // (as a phone does: the piece is refused because nobody touched anything to ask for it)
  // (the stand-in player is made anew for every test: there is nothing to put back)
  globalThis.Audio.prototype.play = function play() { if (/mascot/.test(this.src) && !this.allowed) return Promise.reject(new Error('NotAllowedError')); this.paused = false; this.plays++; return Promise.resolve(); };
  assert.equal(sound.playMascot(), true);
  await new Promise((r) => setTimeout(r, 0));
  const piece = tracks[1];
  assert.deepEqual([piece.plays, piece.paused, sound.mascotMusic.on], [0, true, true], 'refused, and still wanted');
  piece.allowed = true; sound.start();                                           // the next touch
  assert.deepEqual([piece.plays, piece.paused], [1, false]);
  // and one that cannot be had at all: the usual music is back, and nothing is thrown
  ctx.currentTime = 90; piece.say('error');
  assert.equal(sound.mascotMusic.on, false);
  assert.deepEqual(usual.gain.events.at(-1), ['ramp', MUSIC_GAIN, 91]);
});

test('the mascot\'s music belongs to the mascot: it begins when a part\'s is first met, and only its own end or the mascot\'s stops it', () => {
  const src = (f) => fs.readFileSync(new URL(f, dir), 'utf8');
  assert.deepEqual(ALL_CAST.filter((m) => m.music).map((m) => [m.id, m.music]), [['pirate', 'mascot']]);
  const pursuer = src('pursuer.js'), pirate = src('cast/pirate.js'), sound = src('sound.js');
  assert.match(pursuer, /met: \(\) => \{ env\.run\?\.met\?\.\(member\.id\); if \(member\.music === 'mascot'\) env\.sound\?\.playMascot\?\.\(\); \},/);
  // "met" is once for each part's mascot (p.known), after it has been in view and near for a moment: not a glimpse, and never twice in a part
  assert.equal(pirate.match(/if \(!p\.known && p\.met > 0\.4\) \{ p\.known = true; c\.met\(\); \}/g).length, 2);
  assert.match(pursuer, /k\.dead = true; if \(k\.member\.music === 'mascot'\) env\.sound\?\.stopMascot\?\.\(\);/, 'a mascot that is no more takes its music with it');
  assert.match(pursuer, /if \(k\.vital\.killed && k\.member\.music === 'mascot'\) env\.sound\?\.stopMascot\?\.\(\);/, 'nor one that a second jab has finished');
  assert.equal((pursuer + pirate + src('index.js')).match(/stopMascot/g).length, 2, 'nothing else stops it: leaving the room, the part, or its sight does not');
  assert.ok(MASCOT_GAIN > MUSIC_GAIN && MASCOT_GAIN <= 0.6, 'over the usual music, and still not loud');
  assert.ok(fs.statSync(new URL('music/mascot.mp3', dir)).size > 1000000);
  assert.match(sound, /theme = new Audio\(MASCOT\.href\)/); assert.ok(sound.indexOf('new Audio(MASCOT.href)') > sound.indexOf('function playMascot'), 'the file is not asked for until the piece is');
});


test('toner sonar and attack rattle create audible spatial effects and respect mute', t => {
  const { sound, contexts } = audio(t, { music: false });
  sound.start();
  const ctx = contexts[0];
  for (const name of ['sonar', 'sonarrattle']) {
    const before = ctx.nodes.length;
    sound.play(name, { vol: 0.8, pan: -0.6 });
    const added = ctx.nodes.slice(before);
    assert.ok(added.some(n => n.started), `${name} starts audio sources`);
    assert.ok(added.some(n => n.gain.events.some(e => e[0] === 'ramp' && e[1] > 0.01)), `${name} has a nonzero envelope`);
    assert.ok(added.some(n => n.pan.value === -0.6), `${name} follows the creature's direction`);
    sound.setMute(true);
    const mutedCount = ctx.nodes.length;
    sound.play(name);
    assert.equal(ctx.nodes.length, mutedCount, `${name} respects master mute`);
    sound.setMute(false);
  }
});


test('toner recordings load, alternate variants, and stop with the sound context', async t => {
  const oldFetch = globalThis.fetch, requested = [];
  globalThis.fetch = async url => { requested.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  t.after(() => { globalThis.fetch = oldFetch; });
  let id = 0;
  const { sound, contexts } = audio(t, { music: false, decodeAudioData: async () => ({ clip: ++id, duration: 0.3 }) });
  sound.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requested.filter((u) => /toner-sonar/.test(String(u))).length, 6);
  assert.equal(requested.filter((u) => /cast\/mother\/(squish|retch)\.ogg/.test(String(u))).length, 2, 'and the two recordings that stand in for a voice (Mother\'s)');
  assert.ok(requested.every(url => url.endsWith('.ogg')));
  const ctx = contexts[0];
  sound.play('sonar', { pan: -0.4 });
  const first = ctx.nodes.findLast(n => n.buffer?.clip);
  assert.ok(first?.started, 'decoded recording plays');
  assert.equal(first.playbackRate.value, 0.7, 'sonar plays 30% slower');
  const dry = first.connections.find(n => !n.curve), grit = first.connections.find(n => n.curve);
  assert.equal(dry.gain.value, 0.82, 'most of the original sound stays dry');
  assert.equal(grit.oversample, '2x');
  assert.ok([...grit.curve].every(v => Number.isFinite(v) && Math.abs(v) <= 1));
  const wet = grit.connections[0];
  assert.equal(wet.gain.events.filter(e => e[0] === 'ramp' && e[1] === 0.01).length, 2, 'two short glitches affect only the grit layer');
  assert.ok(wet.gain.events.every(e => Number.isFinite(e[2])), 'glitches have valid audio times');
  sound.play('sonar');
  const second = ctx.nodes.findLast(n => n.buffer?.clip);
  assert.notEqual(first.buffer, second.buffer, 'no immediate repeated variant');
  sound.play('sonarrattle');
  const warning = ctx.nodes.findLast(n => n.buffer?.clip);
  assert.ok(warning.started);
  assert.equal(warning.playbackRate.value, 0.7, 'warning plays 30% slower');
  sound.stop();
  assert.ok(first.stopped && second.stopped && warning.stopped, 'active clips stop on teardown');
});
