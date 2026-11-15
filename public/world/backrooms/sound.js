// The Backrooms — what it sounds like down here. Every sound but one is a few
// oscillators and a second of noise: a mains hum with the buzz of a tired
// ballast, carpet under your feet, and the small noises of whatever room you
// are in. The one thing loaded is the owner's music (music/room4.mp3, beside
// this file): mostly air, played low and round and round under everything
// else, and done without if it will not load. All of it is quiet on purpose,
// starts only after you have touched something, and M turns it off.
//
// There is one more piece of the owner's (music/mascot.mp3): the mascot's.
// It is played once through, in place of the other, from the moment a part's
// mascot has first really been seen, and the other comes back up when it is
// over. It is not fetched until that moment: most visits never hear it.

/** How loud the music is, against a small sound's 0.1 to 0.2: under them, never over. */
export const MUSIC_GAIN = 0.4;
/** How loud the mascot's music is: it is what is happening, so it is over the place and not under it (and the file is the louder of the two). */
export const MASCOT_GAIN = 0.45;
const MUSIC = new URL('./music/room4.mp3', import.meta.url);
const MASCOT = new URL('./music/mascot.mp3', import.meta.url);
/**
 * Further down, the music is another piece of the owner's (music/deep.mp3: five minutes of glitches, "to change the
 * pace"), from the third part of a visit on, and quieter than the usual one: the owner, "it is so random that it may
 * get annoying so better at a lower volume than our main track".
 */
export const DEEP_FROM = 2, DEEP_GAIN = 0.22;
const DEEP = new URL('./music/deep.mp3', import.meta.url);
const volume = (value, fallback = 1) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
export function createSound(level, opt = {}) {
  let ctx = null, master = null, effects = null, musicBus = null, humGain = null, draught = null, noiseBuf = null, muted = !!opt.mute, paused = false, humTarget = 1, hum = level.hum || 50;
  let musicVolume = volume(opt.musicVolume), sfxVolume = volume(opt.sfxVolume);
  let music = null, musicGain = null;        // the <audio> the music comes out of, once there is one, and its own level
  let deep = (level?.depth ?? 0) >= DEEP_FROM, swap = null;      // which piece is the place's own just now · a change of piece on its way
  const ambient = () => (deep ? DEEP_GAIN : MUSIC_GAIN), piece = () => (deep ? DEEP : MUSIC).href;
  let theme = null, themeGain = null, themeOn = false;      // the mascot's music, once it has been asked for · is it what is playing?
  const running = [], mains = [];            // things to stop at the end · the hum's oscillators, to retune
  const loops = new Map();                   // name → { gain, stop }
  const now = () => ctx.currentTime;

  function start() {
    if (paused) return;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (music?.paused) music.play().catch(() => {});
      // (a phone will not start a piece of music that was not asked for by a touch: the mascot's waits for the next one, which is this)
      if (themeOn && theme?.paused) theme.play().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    // Each dial sits after its sounds' own envelopes: changing it never changes the balance within a room,
    // restarts the music's fade-in, or unmutes something the visitor has turned off with M.
    effects = ctx.createGain(); effects.gain.value = sfxVolume; effects.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVolume; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // the hum: mains, the ballast an octave up, and a breath of air
    humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(effects);
    humGain.gain.linearRampToValueAtTime(0.05, now() + 2.5);
    const f = hum;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(humGain);
    for (const [mult, amp, type, detune] of [[1, 0.5, 'sine', 0], [2, 0.34, 'sawtooth', 3], [2, 0.3, 'sawtooth', -4], [4, 0.1, 'triangle', 6], [7, 0.03, 'sine', 0]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f * mult; o.detune.value = detune; g.gain.value = amp;
      o.connect(g); g.connect(lp); o.start(); running.push(o); mains.push([o, mult]);
    }
    const air = ctx.createBufferSource(), airF = ctx.createBiquadFilter(), airG = ctx.createGain();
    air.buffer = noiseBuf; air.loop = true; airF.type = 'bandpass'; airF.frequency.value = 900; airF.Q.value = 0.4; airG.gain.value = 0.045;
    air.connect(airF); airF.connect(airG); airG.connect(humGain); air.start(); running.push(air);
    // a draught, for where there is one: the same noise through a narrow gap, silent until asked for
    const dr = ctx.createBufferSource(), drF = ctx.createBiquadFilter();
    draught = ctx.createGain(); draught.gain.value = 0;
    dr.buffer = noiseBuf; dr.loop = true; drF.type = 'bandpass'; drF.frequency.value = 1500; drF.Q.value = 2.2;
    dr.connect(drF); drF.connect(draught); draught.connect(effects); dr.start(0, 0.3); running.push(dr);
    startMusic();
  }

  /** The music: one file, streamed and looped, through its own dial and then the master (so M silences it too). */
  function startMusic() {
    if (music || opt.music === false || typeof Audio === 'undefined') return;
    try {
      const el = new Audio(piece());
      el.loop = true; el.preload = 'auto';
      const g = ctx.createGain(); g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(g); g.connect(musicBus);
      g.gain.linearRampToValueAtTime(ambient(), now() + 6);                       // it comes up slowly, after the hum
      music = el; musicGain = g;
      el.play().catch(() => { /* no music, then: the place has its own noises */ });
    } catch { music = null; musicGain = null; }
  }

  /**
   * The mascot's music: once through, through the same dial as the other music (so its volume, M and the menu all
   * apply), and the other gives way to it. → whether it began (false: it is already playing, or there is no sound).
   */
  function playMascot() {
    if (!ctx || themeOn || opt.music === false || typeof Audio === 'undefined') return false;
    try {
      if (!theme) {
        theme = new Audio(MASCOT.href); theme.loop = false; theme.preload = 'auto';
        themeGain = ctx.createGain(); themeGain.gain.value = 0;
        ctx.createMediaElementSource(theme).connect(themeGain); themeGain.connect(musicBus);
        theme.addEventListener?.('ended', () => endMascot());
        theme.addEventListener?.('error', () => endMascot(1));                    // (it would not load: the usual music, then)
      }
      try { theme.currentTime = 0; } catch { /* not loaded yet: it starts at the start anyway */ }
      themeOn = true;
      const t = now();
      themeGain.gain.cancelScheduledValues(t); themeGain.gain.setValueAtTime(0, t); themeGain.gain.linearRampToValueAtTime(MASCOT_GAIN, t + 0.8);
      if (musicGain) { musicGain.gain.cancelScheduledValues(t); musicGain.gain.setTargetAtTime(0, t, 0.5); }
      if (!paused) theme.play().catch(() => { /* a phone wants a touch first: start() tries again at the next one */ });
      return true;
    } catch { themeOn = false; return false; }
  }
  /** The mascot's music is over (it ran out, or was stopped): the usual music comes back up over `rise` seconds. */
  function endMascot(rise = 4) {
    if (!themeOn) return;
    themeOn = false;
    if (!ctx || !musicGain) return;
    const t = now();
    musicGain.gain.cancelScheduledValues(t); musicGain.gain.setValueAtTime(0, t); musicGain.gain.linearRampToValueAtTime(ambient(), t + rise);
  }
  /** Stop the mascot's music before it has run out (there is no mascot any more): it fades, and the usual music comes back. */
  function stopMascot() {
    if (!themeOn || !theme || !ctx) return;
    const el = theme, t = now();
    themeGain.gain.cancelScheduledValues(t); themeGain.gain.setTargetAtTime(0, t, 0.4);
    setTimeout(() => { if (!themeOn) { try { el.pause(); } catch { /* gone anyway */ } } }, 1800);
    endMascot();
  }

  /** A burst of filtered noise. */
  function burst({ vol = 0.2, pan = 0, dur = 0.08, freq = 800, q = 0.8, type = 'lowpass', attack = 0.004, when = 0 }) {
    if (!ctx || muted || paused) return;
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loopStart = Math.random() * 0.5; src.loop = true;
    flt.type = type; flt.frequency.value = freq; flt.Q.value = q;
    const t = now() + when;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(flt); flt.connect(g); out(g, pan);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  /** A decaying tone. */
  function tone({ vol = 0.15, pan = 0, dur = 0.4, freq = 440, type = 'sine', to = null, attack = 0.005, when = 0 }) {
    if (!ctx || muted || paused) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = now() + when;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); out(g, pan); o.start(t); o.stop(t + dur + 0.05);
  }
  function out(node, pan) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(effects); }
    else node.connect(effects);
  }

  // the small vocabulary of the place; each takes { vol 0..1, pan -1..1 } from how far and which side
  const voice = {
    step: (o = {}) => burst({ vol: 0.07 * (o.vol ?? 1), dur: 0.09, freq: 300 + Math.random() * 120, q: 0.5 }),
    stone: (o = {}) => { burst({ vol: 0.09 * (o.vol ?? 1), dur: 0.07, freq: 900 + Math.random() * 300, q: 0.7 }); burst({ vol: 0.03 * (o.vol ?? 1), dur: 0.5, freq: 600, q: 0.5, attack: 0.05, when: 0.04 }); },
    wade: (o = {}) => burst({ vol: 0.08 * (o.vol ?? 1), dur: 0.16, freq: 1400 + Math.random() * 900, q: 1.2, type: 'bandpass' }),
    rustle: (o = {}) => burst({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.12, freq: 3200 + Math.random() * 1500, q: 0.9, type: 'bandpass' }),
    tick: (o = {}) => burst({ vol: 0.05 * (o.vol ?? 1), pan: o.pan, dur: 0.025, freq: 3800, q: 2, type: 'highpass', attack: 0.001 }),
    shuffle: (o = {}) => burst({ vol: 0.12 * (o.vol ?? 1), pan: o.pan, dur: 0.22, freq: 620, q: 1.4, type: 'bandpass', attack: 0.03 }),
    clack: (o = {}) => { burst({ vol: 0.16 * (o.vol ?? 1), dur: 0.05, freq: 1900, q: 3, type: 'bandpass', attack: 0.001 }); tone({ vol: 0.08 * (o.vol ?? 1), dur: 0.09, freq: 150, type: 'triangle' }); },
    seek: (o = {}) => { for (let i = 0; i < 3; i++) burst({ vol: 0.1 * (o.vol ?? 1), pan: o.pan, dur: 0.02, freq: 2400, q: 6, type: 'bandpass', attack: 0.001, when: i * (0.05 + Math.random() * 0.04) }); },
    beep: (o = {}) => tone({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.14, freq: o.freq || 880, type: 'square' }),
    ding: (o = {}) => { tone({ vol: 0.12 * (o.vol ?? 1), pan: o.pan, dur: 1.4, freq: 1318 }); tone({ vol: 0.06 * (o.vol ?? 1), pan: o.pan, dur: 1.1, freq: 2637 }); },
    glug: (o = {}) => { for (let i = 0; i < 3; i++) tone({ vol: 0.12 * (o.vol ?? 1), pan: o.pan, dur: 0.14, freq: 150 + i * 30 + Math.random() * 30, to: 320 + Math.random() * 80, when: i * 0.13 }); },
    thunk: (o = {}) => { tone({ vol: 0.2 * (o.vol ?? 1), pan: o.pan, dur: 0.22, freq: 110, to: 55, type: 'triangle' }); burst({ vol: 0.1 * (o.vol ?? 1), pan: o.pan, dur: 0.08, freq: 500 }); },
    click: (o = {}) => burst({ vol: 0.14 * (o.vol ?? 1), pan: o.pan, dur: 0.03, freq: 1500, q: 2, type: 'bandpass', attack: 0.001 }),
    door: (o = {}) => { tone({ vol: 0.05 * (o.vol ?? 1), dur: 0.7, freq: 240, to: 330, type: 'sawtooth', attack: 0.1 }); burst({ vol: 0.12, dur: 0.1, freq: 400, when: 0.02 }); },
    slide: (o = {}) => burst({ vol: 0.1 * (o.vol ?? 1), pan: o.pan, dur: 1.0, freq: 240, q: 2, type: 'bandpass', attack: 0.25 }),
    furnitureScrape: (o = {}) => { burst({ vol: .13 * (o.vol ?? 1), pan: o.pan, dur: .36, freq: 320, q: 1.1, type: 'bandpass', attack: .04 }); tone({ vol: .018 * (o.vol ?? 1), pan: o.pan, dur: .3, freq: 95, to: 81, type: 'sawtooth', attack: .05 }); },
    furnitureRoll: (o = {}) => burst({ vol: .075 * (o.vol ?? 1), pan: o.pan, dur: .34, freq: 650, q: 1.5, type: 'bandpass', attack: .04 }),
    whir: (o = {}) => { tone({ vol: 0.035 * (o.vol ?? 1), pan: o.pan, dur: 0.5, freq: 520, to: 610, type: 'sawtooth', attack: 0.08 }); burst({ vol: 0.04 * (o.vol ?? 1), pan: o.pan, dur: 0.5, freq: 2600, q: 1, type: 'bandpass', attack: 0.1 }); },
    // an old telephone: two tones beaten together, twice
    ring: (o = {}) => { for (const w of [0, 0.5]) for (const f of [440, 480]) { tone({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.4, freq: f, type: 'triangle', when: w }); tone({ vol: 0.02 * (o.vol ?? 1), pan: o.pan, dur: 0.4, freq: f * 4.02, when: w }); } },
    squeak: (o = {}) => { tone({ vol: 0.09 * (o.vol ?? 1), pan: o.pan, dur: 0.16, freq: 820 + Math.random() * 200, to: 1500, type: 'triangle' }); tone({ vol: 0.05 * (o.vol ?? 1), pan: o.pan, dur: 0.12, freq: 1400, to: 900, type: 'triangle', when: 0.17 }); },
    knock: (o = {}) => { for (const w of [0, 0.16, 0.32]) { tone({ vol: 0.2 * (o.vol ?? 1), pan: o.pan, dur: 0.07, freq: 190, to: 120, type: 'triangle', when: w }); burst({ vol: 0.08 * (o.vol ?? 1), pan: o.pan, dur: 0.03, freq: 900, when: w, attack: 0.001 }); } },
    rattle: (o = {}) => { for (let i = 0; i < 5; i++) burst({ vol: 0.11 * (o.vol ?? 1), pan: o.pan, dur: 0.035, freq: 700 + Math.random() * 500, q: 3, type: 'bandpass', attack: 0.001, when: i * 0.07 }); },
    dialtone: (o = {}) => { for (const f of [350, 440]) tone({ vol: 0.045 * (o.vol ?? 1), pan: o.pan, dur: 2.6, freq: f, attack: 0.02 }); burst({ vol: 0.1 * (o.vol ?? 1), pan: o.pan, dur: 0.03, freq: 1500, q: 2, type: 'bandpass', when: 2.7 }); },
    shutter: (o = {}) => { burst({ vol: 0.2 * (o.vol ?? 1), dur: 0.04, freq: 2600, q: 2, type: 'bandpass', attack: 0.001 }); burst({ vol: 0.14 * (o.vol ?? 1), dur: 0.05, freq: 1200, q: 2, type: 'bandpass', attack: 0.001, when: 0.09 }); tone({ vol: 0.03 * (o.vol ?? 1), dur: 1.1, freq: 2000, to: 5200, when: 0.12 }); },
    creak: (o = {}) => { tone({ vol: 0.05 * (o.vol ?? 1), pan: o.pan, dur: 0.35, freq: 90 + Math.random() * 30, to: 140, type: 'sawtooth', attack: 0.05 }); burst({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.05, freq: 420, q: 2, type: 'bandpass', when: 0.3 }); },
    // a ceiling tile that was never meant to be stood on
    crack: (o = {}) => { burst({ vol: 0.3 * (o.vol ?? 1), dur: 0.12, freq: 1800, q: 0.6, attack: 0.001 }); burst({ vol: 0.2 * (o.vol ?? 1), dur: 0.35, freq: 420, q: 0.8, attack: 0.002, when: 0.03 }); tone({ vol: 0.14 * (o.vol ?? 1), dur: 0.3, freq: 160, to: 60, type: 'triangle', when: 0.02 }); },
    // a cheerful five-note corridor whistle, slightly flat on the turn
    whistle: (o = {}) => {
      const notes = [[784, 880, 0, 0.22], [988, 988, 0.24, 0.18], [880, 784, 0.44, 0.22], [659, 698, 0.68, 0.2], [784, 772, 0.9, 0.34]];
      for (const [f0, f1, w, d] of notes) {
        tone({ vol: 0.065 * (o.vol ?? 1), pan: o.pan, dur: d, freq: f0, to: f1, type: 'sine', attack: 0.03, when: w });
        burst({ vol: 0.014 * (o.vol ?? 1), pan: o.pan, dur: d, freq: f0 * 2, q: 5, type: 'bandpass', attack: 0.03, when: w });
      }
    },
    // cross-cut rollers taking a sheaf of paper
    shred: (o = {}) => {
      tone({ vol: 0.08 * (o.vol ?? 1), pan: o.pan, dur: 1.05, freq: 145, to: 118, type: 'sawtooth', attack: 0.04 });
      burst({ vol: 0.14 * (o.vol ?? 1), pan: o.pan, dur: 0.95, freq: 2400, q: 1.1, type: 'bandpass', attack: 0.03 });
      for (let i = 0; i < 6; i++) burst({ vol: 0.09 * (o.vol ?? 1), pan: o.pan, dur: 0.07, freq: 3400 + i * 180, q: 2.2, type: 'bandpass', when: 0.08 + i * 0.13 });
    },
    // a safety marshall's pea whistle
    peawhistle: (o = {}) => {
      for (let i = 0; i < 4; i++) {
        tone({ vol: 0.11 * (o.vol ?? 1), pan: o.pan, dur: 0.13, freq: 2820, to: 2940, type: 'triangle', attack: 0.008, when: i * 0.09 });
        tone({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.13, freq: 2995, to: 2860, type: 'sine', attack: 0.008, when: i * 0.09 });
      }
      burst({ vol: 0.06 * (o.vol ?? 1), pan: o.pan, dur: 0.42, freq: 3100, q: 3.5, type: 'bandpass', attack: 0.01 });
    },
    // long chrome shears closing on air
    snip: (o = {}) => {
      burst({ vol: 0.15 * (o.vol ?? 1), pan: o.pan, dur: 0.045, freq: 3600, q: 3.2, type: 'bandpass', attack: 0.001 });
      tone({ vol: 0.09 * (o.vol ?? 1), pan: o.pan, dur: 0.11, freq: 1380, to: 720, type: 'triangle', attack: 0.001, when: 0.01 });
    },
    // a tired paper party-horn
    partyhorn: (o = {}) => {
      for (const f of [311, 370, 466]) tone({ vol: 0.042 * (o.vol ?? 1), pan: o.pan, dur: 0.48, freq: f, to: f * 0.96, type: 'sawtooth', attack: 0.04 });
      burst({ vol: 0.04 * (o.vol ?? 1), pan: o.pan, dur: 0.45, freq: 1100, q: 2.5, type: 'bandpass', attack: 0.03 });
    },
    // two brisk clicks of a retractable pen
    penclick: (o = {}) => {
      for (const w of [0, 0.085]) {
        burst({ vol: 0.13 * (o.vol ?? 1), pan: o.pan, dur: 0.018, freq: 4100, q: 3.5, type: 'bandpass', attack: 0.001, when: w });
        tone({ vol: 0.05 * (o.vol ?? 1), pan: o.pan, dur: 0.025, freq: 1900, to: 900, type: 'triangle', attack: 0.001, when: w });
      }
    },
    // live patch cabling waking out of the plenum
    buzz: (o = {}) => {
      tone({ vol: 0.11 * (o.vol ?? 1), pan: o.pan, dur: 0.45, freq: 120, to: 92, type: 'sawtooth', attack: 0.01 });
      burst({ vol: 0.12 * (o.vol ?? 1), pan: o.pan, dur: 0.22, freq: 2900, q: 1.8, type: 'bandpass', attack: 0.003 });
    },
    // blind echolocation click-pair from up in the ceiling tiles
    sonar: (o = {}) => {
      const f0 = 2850 + Math.random() * 550;
      for (const [w, k] of [[0, 1], [0.048, 0.52]]) {
        burst({ vol: 0.15 * k * (o.vol ?? 1), pan: o.pan, dur: 0.016, freq: f0 * (w ? 1.18 : 1), q: 8.5, type: 'bandpass', attack: 0.0008, when: w });
        tone({ vol: 0.065 * k * (o.vol ?? 1), pan: o.pan, dur: 0.03, freq: 1450, to: 460, type: 'triangle', attack: 0.001, when: w });
      }
    },
    // frantic accelerating echolocation lock-on rattle
    sonarrattle: (o = {}) => {
      const times = [0, 0.046, 0.084, 0.116, 0.142];
      times.forEach((w, i) => {
        burst({ vol: (0.12 + i * 0.014) * (o.vol ?? 1), pan: o.pan, dur: 0.015, freq: 2700 + i * 380, q: 9.5, type: 'bandpass', attack: 0.0008, when: w });
        tone({ vol: 0.055 * (o.vol ?? 1), pan: o.pan, dur: 0.024, freq: 1550 + i * 160, to: 520, type: 'triangle', attack: 0.001, when: w });
      });
    },
    // feral waste toner collapsing into a bubbling pool of glitch slime
    dissolve: (o = {}) => {
      tone({ vol: 0.15 * (o.vol ?? 1), pan: o.pan, dur: 0.9, freq: 210, to: 46, type: 'sawtooth', attack: 0.01 });
      burst({ vol: 0.14 * (o.vol ?? 1), pan: o.pan, dur: 0.85, freq: 1650, q: 1.3, type: 'bandpass', attack: 0.02 });
      for (let i = 0; i < 5; i++) {
        tone({ vol: 0.09 * (o.vol ?? 1), pan: o.pan, dur: 0.12, freq: 190 + i * 28, to: 380 + Math.random() * 90, when: 0.06 + i * 0.14 });
      }
    },
    static: (o = {}) => burst({ vol: 0.12 * (o.vol ?? 1), dur: o.dur || 0.9, freq: 4200, q: 0.4, type: 'highpass', attack: 0.05 }),
    // something soft and wet, trodden flat: the heel, the burst of it, and what comes out at the sides
    squish: (o = {}) => {
      const v = o.vol ?? 1;
      tone({ vol: 0.24 * v, pan: o.pan, dur: 0.13, freq: 130, to: 44, type: 'triangle' });
      burst({ vol: 0.22 * v, pan: o.pan, dur: 0.09, freq: 700, q: 0.7 });
      burst({ vol: 0.2 * v, pan: o.pan, dur: 0.16, freq: 1900, q: 2.2, type: 'bandpass', attack: 0.012, when: 0.035 });
      burst({ vol: 0.13 * v, pan: o.pan, dur: 0.22, freq: 3400, q: 3, type: 'bandpass', attack: 0.02, when: 0.07 });
      tone({ vol: 0.13 * v, pan: o.pan, dur: 0.06, freq: 260 + Math.random() * 60, to: 760, when: 0.045 });
      tone({ vol: 0.1 * v, pan: o.pan, dur: 0.07, freq: 420 + Math.random() * 80, to: 150, when: 0.11 });
    },
    // something bringing up what is in it: three heaves from low down, each higher and wetter than the last, and then it comes
    retch: (o = {}) => {
      const v = o.vol ?? 1;
      for (let i = 0; i < 3; i++) {
        const at = i * 0.36;
        tone({ vol: (0.13 + i * 0.03) * v, pan: o.pan, dur: 0.3, freq: 62 + i * 9, to: 96 + i * 22, type: 'sawtooth', attack: 0.04, when: at });
        burst({ vol: (0.08 + i * 0.03) * v, pan: o.pan, dur: 0.26, freq: 330 + i * 90, q: 3.2, type: 'bandpass', attack: 0.05, when: at + 0.02 });
        tone({ vol: 0.09 * v, pan: o.pan, dur: 0.1, freq: 140 + i * 30, to: 330 + i * 60, when: at + 0.2 });
      }
      tone({ vol: 0.2 * v, pan: o.pan, dur: 0.42, freq: 300, to: 58, type: 'sawtooth', attack: 0.015, when: 1.1 });
      burst({ vol: 0.24 * v, pan: o.pan, dur: 0.45, freq: 1100, q: 1.1, type: 'bandpass', attack: 0.02, when: 1.1 });
      burst({ vol: 0.14 * v, pan: o.pan, dur: 0.6, freq: 2800, q: 2.4, type: 'bandpass', attack: 0.04, when: 1.16 });
      for (let i = 0; i < 5; i++) tone({ vol: 0.1 * v, pan: o.pan, dur: 0.08, freq: 180 + Math.random() * 90, to: 420 + Math.random() * 160, when: 1.14 + i * 0.07 });
    },
  };

  return {
    start,
    get on() { return !!ctx && !muted && !paused; },
    get muted() { return muted; },
    get paused() { return paused; },
    get musicVolume() { return musicVolume; },
    get sfxVolume() { return sfxVolume; },
    /**
     * Which part of the visit this is (0 is where you land): from DEEP_FROM on, the place's music is the other piece,
     * quieter. The one fades out, the other comes up; the mascot's music, if it is playing, is left to finish.
     */
    setDepth(n) {
      const want = (n | 0) >= DEEP_FROM;
      if (want === deep) return;
      deep = want;
      if (!music || !musicGain || !ctx) return;                 // (not begun yet: it begins with the right piece)
      const t = now(), el = music, g = musicGain;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.4);
      clearTimeout(swap);
      swap = setTimeout(() => {
        if (music !== el) return;
        try { el.src = piece(); el.load(); el.play().catch(() => {}); } catch { /* the old piece goes on, silent */ }
        if (!themeOn) { const u = now(); g.gain.cancelScheduledValues(u); g.gain.setValueAtTime(0, u); g.gain.linearRampToValueAtTime(ambient(), u + 5); }
      }, 1600);
    },
    /** Which piece is the place's own just now (for the dev page and the tests). */
    get piece() { return deep ? 'deep' : 'room4'; },
    /** Is the music going? (for the dev page and the tests) */
    get music() { return music ? { playing: !music.paused, at: music.currentTime } : null; },
    /** The mascot's music: null until it has been asked for; then whether it is what is playing, and how far in. */
    get mascotMusic() { return theme ? { playing: themeOn && !theme.paused, on: themeOn, at: theme.currentTime } : null; },
    playMascot, stopMascot,
    setMute(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, now(), 0.05); },
    setMusicVolume(value) { musicVolume = volume(value, musicVolume); if (musicBus) musicBus.gain.setTargetAtTime(musicVolume, now(), 0.05); },
    setSfxVolume(value) { sfxVolume = volume(value, sfxVolume); if (effects) effects.gain.setTargetAtTime(sfxVolume, now(), 0.05); },
    /** The menu holds the tape still: resume the same music and oscillators, without creating another set. */
    setPaused(value) {
      const next = !!value;
      if (paused === next) return;
      paused = next;
      if (!ctx) return;
      if (paused) { music?.pause(); theme?.pause(); ctx.suspend().catch(() => {}); }
      else { ctx.resume().catch(() => {}); if (music?.paused) music.play().catch(() => {}); if (themeOn && theme?.paused) theme.play().catch(() => {}); }
    },
    /** Play one of the small sounds by name. */
    play(name, o) { if (ctx && !muted && !paused && voice[name]) { try { voice[name](o); } catch { /* a sound is never worth an error */ } } },
    /**
     * A recording of a room's own, played once through the effects (so the effects slider, M and the menu reach it):
     * `href` as the room has it from a new URL of the file beside it against import.meta.url, which is also how the site's build finds the
     * file. o: { vol: 0…1, pan: -1…1 } as for play(). Recordings are the owner's to ask for; voices are the rule.
     */
    file(href, o = {}) {
      if (!ctx || muted || paused || typeof Audio === 'undefined') return false;
      try {
        const el = new Audio(href), g = ctx.createGain(); g.gain.value = Math.max(0, Math.min(1, o.vol ?? 1));
        const src = ctx.createMediaElementSource(el);
        if (Number.isFinite(o.pan) && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, o.pan)); src.connect(pn); pn.connect(g); } else src.connect(g);
        g.connect(effects || master);
        el.addEventListener?.('ended', () => { try { g.disconnect(); } catch { /* gone */ } });
        el.play().catch(() => {});
        return true;
      } catch { return false; }
    },
    /** The hum follows the light: louder under a full ceiling, nearly gone in the dark. */
    setHum(k) { humTarget = k; if (humGain) humGain.gain.setTargetAtTime(0.012 + 0.05 * Math.max(0, Math.min(1.4, k)), now(), 0.6); },
    /** Air coming through somewhere it should not (0…1): a thin whistle, nearer the louder. */
    air(k) { if (draught && !muted && !paused) draught.gain.setTargetAtTime(0.05 * Math.max(0, Math.min(1, k)) ** 2, now(), 0.25); },
    /** Another floor, another mains: the hum slides to it. */
    setMains(f) { hum = f || hum; if (ctx) for (const [o, mult] of mains) o.frequency.setTargetAtTime(hum * mult, now(), 0.4); },
    /** The lights stutter: so does the hum. */
    dip(k) { if (humGain && !muted && !paused) { humGain.gain.cancelScheduledValues(now()); humGain.gain.setTargetAtTime((0.012 + 0.05 * humTarget) * k, now(), 0.02); } },
    stop() {
      clearTimeout(swap);
      for (const n of running) { try { n.stop(); } catch { /* already stopped */ } }
      running.length = 0; loops.clear();
      if (music) { try { music.pause(); music.removeAttribute('src'); music.load(); } catch { /* gone anyway */ } music = null; }
      if (theme) { try { theme.pause(); theme.removeAttribute('src'); theme.load(); } catch { /* gone anyway */ } theme = null; }
      themeOn = false; musicGain = themeGain = null;
      if (ctx) { const c = ctx; ctx = null; c.close().catch(() => {}); }
      master = effects = musicBus = humGain = draught = noiseBuf = null;
      mains.length = 0;
    },
  };
}
