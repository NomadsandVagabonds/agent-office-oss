// The Backrooms — what it sounds like down here. Nothing is loaded: every
// sound is a few oscillators and a second of noise. A mains hum with the buzz
// of a tired ballast, carpet under your feet, and the small noises of whatever
// room you are in. It is quiet on purpose, it starts only after you have
// touched something, and M turns it off.
export function createSound(level, opt = {}) {
  let ctx = null, master = null, humGain = null, noiseBuf = null, muted = !!opt.mute, humTarget = 1;
  const running = [];                        // things to stop at the end
  const loops = new Map();                   // name → { gain, stop }
  const now = () => ctx.currentTime;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // the hum: mains, the ballast an octave up, and a breath of air
    humGain = ctx.createGain(); humGain.gain.value = 0; humGain.connect(master);
    humGain.gain.linearRampToValueAtTime(0.05, now() + 2.5);
    const f = level.hum || 50;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(humGain);
    for (const [mult, amp, type, detune] of [[1, 0.5, 'sine', 0], [2, 0.34, 'sawtooth', 3], [2, 0.3, 'sawtooth', -4], [4, 0.1, 'triangle', 6], [7, 0.03, 'sine', 0]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f * mult; o.detune.value = detune; g.gain.value = amp;
      o.connect(g); g.connect(lp); o.start(); running.push(o);
    }
    const air = ctx.createBufferSource(), airF = ctx.createBiquadFilter(), airG = ctx.createGain();
    air.buffer = noiseBuf; air.loop = true; airF.type = 'bandpass'; airF.frequency.value = 900; airF.Q.value = 0.4; airG.gain.value = 0.045;
    air.connect(airF); airF.connect(airG); airG.connect(humGain); air.start(); running.push(air);
  }

  /** A burst of filtered noise. */
  function burst({ vol = 0.2, pan = 0, dur = 0.08, freq = 800, q = 0.8, type = 'lowpass', attack = 0.004, when = 0 }) {
    if (!ctx || muted) return;
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
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = now() + when;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); out(g, pan); o.start(t); o.stop(t + dur + 0.05);
  }
  function out(node, pan) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(master); }
    else node.connect(master);
  }

  // the small vocabulary of the place; each takes { vol 0..1, pan -1..1 } from how far and which side
  const voice = {
    step: (o = {}) => burst({ vol: 0.07 * (o.vol ?? 1), dur: 0.09, freq: 300 + Math.random() * 120, q: 0.5 }),
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
    whir: (o = {}) => { tone({ vol: 0.035 * (o.vol ?? 1), pan: o.pan, dur: 0.5, freq: 520, to: 610, type: 'sawtooth', attack: 0.08 }); burst({ vol: 0.04 * (o.vol ?? 1), pan: o.pan, dur: 0.5, freq: 2600, q: 1, type: 'bandpass', attack: 0.1 }); },
    // an old telephone: two tones beaten together, twice
    ring: (o = {}) => { for (const w of [0, 0.5]) for (const f of [440, 480]) { tone({ vol: 0.07 * (o.vol ?? 1), pan: o.pan, dur: 0.4, freq: f, type: 'triangle', when: w }); tone({ vol: 0.02 * (o.vol ?? 1), pan: o.pan, dur: 0.4, freq: f * 4.02, when: w }); } },
    static: (o = {}) => burst({ vol: 0.12 * (o.vol ?? 1), dur: o.dur || 0.9, freq: 4200, q: 0.4, type: 'highpass', attack: 0.05 }),
  };

  return {
    start,
    get on() { return !!ctx && !muted; },
    get muted() { return muted; },
    setMute(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, now(), 0.05); },
    /** Play one of the small sounds by name. */
    play(name, o) { if (ctx && !muted && voice[name]) { try { voice[name](o); } catch { /* a sound is never worth an error */ } } },
    /** The hum follows the light: louder under a full ceiling, nearly gone in the dark. */
    setHum(k) { humTarget = k; if (humGain) humGain.gain.setTargetAtTime(0.012 + 0.05 * Math.max(0, Math.min(1.4, k)), now(), 0.6); },
    /** The lights stutter: so does the hum. */
    dip(k) { if (humGain && !muted) { humGain.gain.cancelScheduledValues(now()); humGain.gain.setTargetAtTime((0.012 + 0.05 * humTarget) * k, now(), 0.02); } },
    stop() {
      for (const n of running) { try { n.stop(); } catch { /* already stopped */ } }
      running.length = 0; loops.clear();
      if (ctx) { const c = ctx; ctx = null; c.close().catch(() => {}); }
    },
  };
}
