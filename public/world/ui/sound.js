// The Office — what it sounds like. One small API, on office.sound:
//
//   play('bell', { volume: 1, at: { x, z } })      a one-shot. `at` (world metres) makes it quieter the further it
//                                                 is from what the camera is looking at, and silent when far away
//   music('elevator-muzak', { loop: true, volume: 0.5, fade: 0.8 }) → { stop(fadeSeconds) }
//                                                 one track at a time; starting another cross-fades
//   stopMusic(fadeSeconds)
//   enabled                                       Ctrl-K → Sound. Off until the person turns it on
//
// Beside those: ambience() for the one bed under everything, track (the song that has the floor), and state,
// which says what the engine is doing. Settings: sound (on/off), music, ambience (on/off), volume (quiet/normal/loud).
//
// The sounds are small files under /audio/ (tools/make-audio.mjs made them, once), fetched the first time each is
// wanted. None of them is needed: when a file is missing the built-in synth plays its version if it has one, and
// otherwise nothing happens. A browser only lets a page make noise once the person has touched it, so the audio
// context is made on a click or a key press, never before. Everything is quiet on purpose: the office should sit
// under the room you are in, not on top of it.

const SAFE = /^[a-z0-9][a-z0-9-]*$/;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** The Volume setting, as a gain on everything. */
export const VOLUME = { quiet: 0.2, normal: 0.4, loud: 0.8 };

// How each sound sits in the mix. Anything not listed is a plain effect at gain 0.5.
//   gain   its level against the others            reach  how far it carries, in multiples of the usual
//   gap    least milliseconds between two of it    bus    voice: the music ducks under it · music, bed: these have
//                                                         their own switches (Ctrl-K → Music, Ambience)
//   with   [a one-shot, at least, at most]: something a bed lets fall now and then, seconds apart
//   late   how long after it was asked for it is still worth playing, ms (2000: a bell that arrives late is a lie)
const voice = (gain) => ({ bus: 'voice', gain });
export const MIX = {
  'needs-you': { gain: 1, late: 15000 },
  discovery: { gain: 0.7 },
  bell: { gain: 0.6, reach: 1.5 },
  'lift-ding': { gain: 0.55, reach: 1.3 },
  'lift-doors': { gain: 0.45 },
  coffee: { gain: 0.4 },
  vend: { gain: 0.45 },
  water: { gain: 0.4 },
  printer: { gain: 0.4 },
  'printer-jam': { gain: 0.5 },
  'paper-plane': { gain: 0.4 },
  confetti: { gain: 0.5 },
  sticky: { gain: 0.3, reach: 0.8 },
  purr: { gain: 0.6, reach: 0.6 },
  duck: { gain: 0.45, reach: 0.8 },
  coin: { gain: 0.5 },
  squash: { gain: 0.45, gap: 70 },
  noclip: { gain: 0.7 },
  'goat-1': { gain: 0.5 }, 'goat-2': { gain: 0.5 }, 'goat-3': { gain: 0.5 },
  typing: { bus: 'bed', gain: 0.18, reach: 0.45, gap: 400 },
  'goat-bell': { bus: 'bed', gain: 0.3 },
  'office-bed': { bus: 'bed', gain: 0.5 },
  'backrooms-hum': { bus: 'bed', gain: 0.5 },
  'pasture-bed': { bus: 'bed', gain: 0.5, with: ['goat-bell', 6, 19] },
  'elevator-muzak': { bus: 'music', gain: 1 },
  'rooftop-lofi': { bus: 'music', gain: 1 },
  'jukebox-disco': { bus: 'music', gain: 0.9 },
  'arcade-chiptune': { bus: 'music', gain: 0.8 },
  'lift-lobby': voice(0.8), 'lift-roof': voice(0.8), 'lift-up': voice(0.8), 'lift-down': voice(0.8), 'lift-closing': voice(0.8), 'lift-13': voice(0.8),
  'hollow-fool': { ...voice(0.85), reach: 1.3 }, 'hollow-fine': { ...voice(0.85), reach: 1.3 },
  'pa-meeting': voice(0.75), 'pa-cabinet': voice(0.75), 'pa-exit': voice(0.75),
  'arcade-title': voice(0.7),
};

// What the office sounded like before it had recordings, and still does when a file is missing.
// n(frequency, start, length, wave, level, glide to): one soft note.
export const SYNTH = {
  'needs-you': (n) => { n(660, 0, 0.16, 'triangle', 0.9); n(880, 0.13, 0.3, 'triangle', 0.9); },
  bell: (n) => { n(1568, 0, 0.9, 'sine', 0.8); n(3136, 0, 0.5, 'sine', 0.25); },
  'lift-ding': (n) => { n(988, 0, 0.5, 'sine', 0.5); n(784, 0.32, 0.7, 'sine', 0.5); },
  'paper-plane': (n) => n(900, 0, 0.3, 'sine', 0.22, 300),
  confetti: (n) => { [523, 659, 784, 1047].forEach((f, i) => n(f, i * 0.07, 0.22, 'triangle', 0.6)); },
  discovery: (n) => { [659, 784, 988, 1319, 1568].forEach((f, i) => n(f, i * 0.09, 0.4, 'sine', 0.6)); },
  purr: (n) => { for (let i = 0; i < 9; i++) n(52 + (i % 2) * 6, i * 0.07, 0.07, 'square', 0.25); },
  coin: (n) => { n(988, 0, 0.08, 'square', 0.3); n(1319, 0.08, 0.3, 'square', 0.3); },
  squash: (n) => n(440, 0, 0.09, 'square', 0.3, 110),
  'jukebox-disco': (n) => { [220, 277, 330, 277, 220, 277, 330, 440].forEach((f, i) => n(f, i * 0.16, 0.14, 'square', 0.22)); },
};
const RIFF = 1.28;        // seconds a synth tune lasts before it comes round again

/**
 * How much of a sound at {x, z} reaches someone looking at `cur` (office.rig.cur: x, z, yaw, dist), and from which
 * side: { gain 0…1, pan -1…1 }. Things near the middle of the view are heard in full, things toward the edge of
 * what could be on screen fade out, and the whole office goes quiet as the camera pulls back to the model on a table.
 */
export function hear(at, cur, reach = 1) {
  const dx = at.x - cur.x, dz = at.z - cur.z;
  const far = Math.max(14, cur.dist * 0.9) * reach;
  const near = 1 - smooth(Math.hypot(dx, dz), far * 0.3, far);
  const zoom = clamp(1 - Math.log(Math.max(cur.dist, 10) / 10) / Math.log(14), 0, 1);       // 1 up close · 0.42 at the overview · 0 from 140 m
  const right = dx * Math.cos(cur.yaw || 0) - dz * Math.sin(cur.yaw || 0);
  return { gain: near * zoom, pan: clamp(right / (cur.dist * 0.45 + 2), -1, 1) * 0.6 };
}

/** Where a decoded sound really starts and ends: a decoder that leaves the MP3's padding on would put a hole in every loop. */
function edges(buffer) {
  const data = buffer.getChannelData(0), most = Math.round(buffer.sampleRate * 0.03);
  let a = 0, b = data.length;
  while (a < most && Math.abs(data[a]) < 0.002) a++;
  while (data.length - b < most && Math.abs(data[b - 1]) < 0.002) b--;
  return { from: a / buffer.sampleRate, to: b / buffer.sampleRate };
}

const NOTHING = { stop() {}, volume() {} };       // what you get back when nothing is playing: safe to call

export function createSound(office) {
  const settings = office.settings;
  const setting = (key, fallback) => settings?.get(key) ?? fallback;
  const on = () => setting('sound', 'off') === 'on';
  let ctx = null, out = null, bus = null, touched = false;
  const bank = new Map();          // name → { state: 'loading' | 'ready' | 'missing', buffer, promise, at, from, to }
  const live = new Set();          // one-shots sounding now
  const last = new Map();          // name → when it last played
  const loops = new Set();         // songs and beds that are wanted, sounding or not
  const slots = { music: null, bed: null };
  const log = [];                  // the last things asked for and what became of them (see `state`)
  const note = (name, what) => { log.push({ name, what, t: Math.round(performance.now()) }); if (log.length > 80) log.shift(); return null; };

  /* ---- the context, and who may start it ----------------------------------------------- */
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { ctx = null; return null; }
    const limiter = ctx.createDynamicsCompressor();          // however much happens at once, nothing clips
    limiter.threshold.value = -9; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
    out = ctx.createGain(); out.connect(limiter); limiter.connect(ctx.destination);
    bus = {};
    for (const name of ['sfx', 'music', 'bed']) { bus[name] = ctx.createGain(); bus[name].connect(out); }
    bus.duck = ctx.createGain(); bus.duck.connect(bus.music);         // songs go through here: a voice pulls them down while it speaks
    levels(0);
    ctx.onstatechange = () => { if (ctx.state === 'running') revive(); };
    return ctx;
  }
  function levels(seconds) {
    const glide = (param, v) => { if (seconds) param.setTargetAtTime(v, ctx.currentTime, seconds / 3); else param.value = v; };
    glide(out.gain, on() ? VOLUME[setting('volume', 'normal')] ?? VOLUME.normal : 0);
    glide(bus.music.gain, setting('music', 'on') === 'on' ? 1 : 0);
    glide(bus.bed.gain, setting('ambience', 'on') === 'on' ? 1 : 0);
  }
  /**
   * The audio context, if sound is on and the browser will have one: it is only ever made after a click or a key
   * press. `byHand` says this call is such a moment, so a sound asked for right now may wait for it to start.
   */
  let starting = null, askedAt = -1e9;
  function wake(byHand = false) {
    if (!on()) return null;
    if (byHand) touched = true;
    if (!ctx && (!(touched || navigator.userActivation?.hasBeenActive) || !build())) return null;
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      p.catch(() => {});
      if (byHand) { starting = p; askedAt = performance.now(); }
    }
    return ctx;
  }
  const gesture = () => { touched = true; if (on()) wake(true); };
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, gesture, { capture: true, passive: true });

  settings?.on((key, value) => {
    if (!['sound', 'music', 'ambience', 'volume'].includes(key)) return;
    if (key === 'sound' && value === 'on') wake(true);                        // choosing it in the palette is the click the browser asks for
    if (!ctx) return;
    levels(0.25);
    if (key !== 'sound') return;
    if (on()) revive();
    else {
      for (const it of loops) rest(it, 0.15);
      for (const one of live) one.stop(0.1);
      setTimeout(() => { if (!on() && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 500);
    }
  });

  /* ---- samples ------------------------------------------------------------------------------ */
  /** Fetch and decode /audio/<name>.mp3, once. Resolves to its entry in the bank, with or without a buffer. */
  function load(name) {
    let s = bank.get(name);
    if (s && (s.state !== 'missing' || performance.now() - s.at < 60000)) return s.promise;       // a missing file is looked for again after a minute, not every time
    s = { state: 'loading', buffer: null, at: performance.now(), from: 0, to: 0 };
    s.promise = fetch(`/audio/${name}.mp3`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
      .then((bytes) => new Promise((resolve, reject) => { ctx.decodeAudioData(bytes, resolve, reject)?.catch?.(() => {}); }))
      .then((buffer) => Object.assign(s, { state: 'ready', buffer }, edges(buffer)))
      .catch(() => Object.assign(s, { state: 'missing' }));
    bank.set(name, s);
    return s.promise;
  }

  /** One soft synthesised note into `to`. wave: sine/triangle/square; glide: slide to this frequency. */
  function tone(to, freq, at = 0, len = 0.18, wave = 'sine', level = 1, glide = 0) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = wave; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + len);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level * 0.3, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(amp); amp.connect(to);
    osc.start(t); osc.stop(t + len + 0.03);
  }
  const destination = (name) => bus[MIX[name]?.bus === 'bed' ? 'bed' : MIX[name]?.bus === 'music' ? 'duck' : 'sfx'];

  /* ---- one-shots -------------------------------------------------------------------------------- */
  /**
   * Play a sound once. { volume, at: { x, z } } as above; also rate (playback speed, 1 = as recorded), pan (-1…1,
   * when it has no place), and from / length (seconds: only a piece of it). Returns { stop(fadeSeconds) }, or null
   * when nothing was played: sound is off, it is too far away, or the same sound has only just played.
   */
  function play(name, opt) {
    opt = opt || {};
    if (!on()) return note(name, 'off');
    if (typeof name !== 'string' || !SAFE.test(name)) return note(String(name), 'not a sound');
    const mix = MIX[name] || {}, now = performance.now();
    if (now - (last.get(name) ?? -1e9) < (mix.gap ?? 250)) return note(name, 'again too soon');
    let gain = (opt.volume ?? 1) * (mix.gain ?? 0.5), pan = clamp(opt.pan || 0, -1, 1);
    if (opt.at && office.rig) { const h = hear(opt.at, office.rig.cur, mix.reach); gain *= h.gain; pan = h.pan; }
    if (!(gain > 0.01)) return note(name, 'too far to hear');
    if (live.size >= 16) return note(name, 'too much at once');
    if (!wake() || (ctx.state !== 'running' && now - askedAt > 1500)) return note(name, 'not started yet');
    last.set(name, now);
    const one = { name, stopped: false, src: null, amp: null, stop(fade = 0.05) {
      this.stopped = true; live.delete(this);
      if (!this.amp) return;
      this.amp.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.005, fade / 4));
      try { this.src?.stop(ctx.currentTime + fade + 0.03); } catch { /* it had already ended */ }
    } };
    Promise.all([load(name), ctx.state === 'running' ? null : starting]).then(([s]) => {
      if (one.stopped) return;
      if (!on() || ctx.state !== 'running' || performance.now() - now > (mix.late ?? 2000)) { note(name, 'came too late'); return; }
      const amp = one.amp = ctx.createGain();
      amp.gain.value = gain;
      let end = amp;
      if (pan && ctx.createStereoPanner) { end = ctx.createStereoPanner(); end.pan.value = pan; amp.connect(end); }
      end.connect(destination(name));
      const done = () => { live.delete(one); end.disconnect(); };
      if (!s.buffer) {
        if (!SYNTH[name]) { end.disconnect(); note(name, 'missing'); return; }
        live.add(one);
        SYNTH[name]((...args) => tone(amp, ...args));
        setTimeout(done, 2500);
        note(name, 'synth');
        return;
      }
      const src = one.src = ctx.createBufferSource(), rate = clamp(opt.rate || 1, 0.25, 4);
      src.buffer = s.buffer; src.playbackRate.value = rate;
      src.connect(amp);
      src.onended = done;
      const from = clamp(s.from + (opt.from || 0), 0, Math.max(0, s.to - 0.05)), length = Math.min(opt.length || Infinity, s.to - from);
      if (opt.from || opt.length) {                              // a piece cut out of the middle needs its ends softened
        const t = ctx.currentTime;
        amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(gain, t + 0.012);
        amp.gain.setValueAtTime(gain, t + Math.max(0.02, length / rate - 0.04)); amp.gain.linearRampToValueAtTime(0, t + length / rate);
      }
      live.add(one);
      src.start(0, from, length);
      if (mix.bus === 'voice') duck(length / rate);
      note(name, 'sample');
    }, () => note(name, 'not started yet'));
    return one;
  }
  function duck(seconds) {
    const t = ctx.currentTime;
    bus.duck.gain.setTargetAtTime(0.4, t, 0.05);
    bus.duck.gain.setTargetAtTime(1, t + seconds, 0.25);
  }

  /* ---- things that go on: songs and beds ------------------------------------------------------------ */
  // A loop is remembered for as long as it is wanted, whether or not it can be heard: turn sound off and on again
  // and the music that should be playing is playing.
  function begin(it) {
    if (!it.wanted || it.amp || it.loading || !wake()) return;
    it.loading = true;
    load(it.name).then((s) => {
      it.loading = false;
      if (!it.wanted || it.amp || !on() || ctx.state !== 'running') return;
      const t = ctx.currentTime, amp = it.amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.setTargetAtTime(it.level * (MIX[it.name]?.gain ?? 0.5), t, Math.max(0.005, it.fade / 3));
      amp.connect(destination(it.name));
      if (!s.buffer) {
        if (!SYNTH[it.name]) { note(it.name, 'missing'); return; }
        const riff = () => { if (ctx.state === 'running') SYNTH[it.name]((...args) => tone(amp, ...args)); };
        riff(); it.riff = setInterval(riff, RIFF * 1000);
        if (!it.loop) setTimeout(() => { if (it.amp === amp) it.handle.stop(0.1); }, RIFF * 1000);
        note(it.name, 'synth');
        return;
      }
      const src = it.src = ctx.createBufferSource();
      src.buffer = s.buffer; src.loop = it.loop; src.loopStart = s.from; src.loopEnd = s.to;
      src.connect(amp);
      src.onended = () => { amp.disconnect(); if (it.src === src) { it.src = it.amp = null; if (!it.loop) it.handle.stop(0); } };
      if (it.loop) src.start(0, s.from); else src.start(0, s.from, s.to - s.from);
      const dust = MIX[it.name]?.with;
      if (dust) {                                                 // what this bed lets fall now and then
        const drop = () => { it.dust = setTimeout(() => { play(dust[0], { volume: it.level * (0.5 + Math.random() * 0.5), rate: 0.94 + Math.random() * 0.12, pan: Math.random() * 1.2 - 0.6 }); drop(); }, (dust[1] + Math.random() * (dust[2] - dust[1])) * 1000); };
        drop();
      }
      note(it.name, 'sample');
    });
  }
  /** Stop the sound of a loop; whether it is still wanted is another matter. */
  function rest(it, fade = 0.2) {
    clearInterval(it.riff); clearTimeout(it.dust);
    const { src, amp } = it;
    it.src = it.amp = null;
    if (!amp) return;
    amp.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.005, fade / 4));
    if (src) { try { src.stop(ctx.currentTime + fade + 0.05); } catch { /* it had already ended */ } } else setTimeout(() => amp.disconnect(), fade * 1000 + 1500);
  }
  function revive() { for (const it of loops) begin(it); }

  /** Put `name` in a slot (the one song, the one bed), fading out whatever was there. No name: just empty it. */
  function swap(slot, name, opt) {
    const { loop = true, volume = 0.5, fade = 0.8 } = opt || {};
    const old = slots[slot];
    if (old && old.name === name) { old.handle.volume(volume); return old.handle; }       // already playing: leave it be
    if (old) old.handle.stop(fade);
    if (typeof name !== 'string' || !SAFE.test(name)) return NOTHING;
    const it = { name, loop, fade, level: volume, wanted: true, src: null, amp: null, loading: false, riff: 0, dust: 0 };
    it.handle = {
      stop(seconds) {
        if (!it.wanted) return;
        const over = Number.isFinite(seconds) ? Math.max(0, seconds) : it.fade;
        it.wanted = false; loops.delete(it);
        if (slots[slot] === it) slots[slot] = null;
        if (ctx) rest(it, over); else { clearInterval(it.riff); clearTimeout(it.dust); }
        // a decoded song is big: once nobody wants it, let it go
        if (MIX[name]?.bus !== 'bed') setTimeout(() => { if (![...loops].some((other) => other.name === name)) bank.delete(name); }, over * 1000 + 2000);
      },
      volume(v, seconds = 0.4) {
        if (!Number.isFinite(v)) return;
        it.level = v;
        if (it.amp) it.amp.gain.setTargetAtTime(v * (MIX[name]?.gain ?? 0.5), ctx.currentTime, Math.max(0.005, seconds / 3));
      },
    };
    loops.add(it); slots[slot] = it;
    note(name, on() ? 'wanted' : 'off');
    begin(it);
    return it.handle;
  }

  return {
    play,
    /** Start a song (or any loop). Returns { stop(fadeSeconds), volume(v, seconds) }; always safe to call, sound on or off. */
    music: (name, opt) => swap('music', name, opt),
    stopMusic: (fadeSeconds = 0.8) => { swap('music', null, { fade: fadeSeconds }); },
    /** The room tone: one bed at a time, beside the music. ambience(null) takes it away. */
    ambience: (name, opt) => swap('bed', name, opt),
    get enabled() { return on(); },
    /** The song that has the floor right now (its name), or null. */
    get track() { return slots.music?.name ?? null; },
    /** For the curious and for tests: what the engine is doing. */
    get state() {
      return { enabled: on(), context: ctx ? ctx.state : 'none', touched,
        buffers: Object.fromEntries([...bank].map(([name, s]) => [name, s.state])),
        music: slots.music?.name ?? null, bed: slots.bed?.name ?? null, sounding: live.size, log: log.slice(-30) };
    },
  };
}
