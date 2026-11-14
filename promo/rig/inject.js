// Runs in the page before anything else. Puts the page on a clock the camera
// operator owns, so a 2 fps software renderer can still be filmed at 30 fps:
//   - Date, performance.now, setTimeout/Interval and requestAnimationFrame all
//     follow one virtual clock that only moves when __vt.frame(ms) is called;
//   - CSS transitions/animations are paused and stepped by the same amount;
//   - with a tape (a recording of the daemon's WebSocket stream), the socket
//     is replaced by a player that delivers each message at its recorded time.
// Nothing here changes what the office draws; it only decides when.
(() => {
  const cfg = window.__PROMO || {};
  const tape = cfg.tape || null;
  const T0 = cfg.t0 || (tape ? tape.t0 : Date.now());
  const RealDate = Date;
  let vnow = 0, held = 0, seq = 1;
  const dateNow = () => T0 + vnow - held;

  class VDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(dateNow()); }
    static now() { return dateNow(); }
  }
  window.Date = VDate;
  try { performance.now = () => vnow; } catch { Object.defineProperty(performance, 'now', { value: () => vnow }); }

  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => { const id = seq++; if (typeof fn === 'function') timers.set(id, { id, at: vnow + Math.max(0, +ms || 0), fn, args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = seq++; const every = Math.max(1, +ms || 0); if (typeof fn === 'function') timers.set(id, { id, at: vnow + every, fn, args, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  let rafs = [];
  window.requestAnimationFrame = (fn) => { const id = seq++; rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter((r) => r.id !== id); };

  /* ---- the tape ---------------------------------------------------------------- */
  const sockets = [];
  if (tape) {
    const startAt = T0 + (cfg.tapeStart || 0) * 1000;
    const isFx = (d) => d.startsWith('{"type":"world_fx"');
    class TapeSocket {
      constructor(url) {
        this.url = url; this.readyState = 0; this.cursor = 0;
        this.onopen = this.onclose = this.onerror = this.onmessage = null;
        sockets.push(this);
        window.setTimeout(() => {
          this.readyState = 1;
          this.onopen?.({ type: 'open' });
          for (const d of tape.init) this.deliver(d);
          // anything that happened before the take starts is state, not spectacle: apply it, skip the momentary effects
          while (this.cursor < tape.live.length && tape.live[this.cursor].t <= startAt) { const m = tape.live[this.cursor++]; if (!isFx(m.d)) this.deliver(m.d); }
        }, 0);
      }
      deliver(d) {
        // the office sets its clock by the snapshot's serverTime; on tape that is when the tape began, not where this take starts
        if (d.startsWith('{"type":"world",')) { try { const m = JSON.parse(d); m.world.serverTime = dateNow(); d = JSON.stringify(m); } catch { /* as it was */ } }
        try { this.onmessage?.({ data: d }); } catch (err) { console.error('[tape]', err); }
      }
      pump() { if (this.readyState !== 1) return; const now = dateNow(); while (this.cursor < tape.live.length && tape.live[this.cursor].t <= now) this.deliver(tape.live[this.cursor++].d); }
      send() {}
      close() { this.readyState = 3; }
      addEventListener(type, fn) { this['on' + type] = fn; }
      removeEventListener() {}
    }
    TapeSocket.CONNECTING = 0; TapeSocket.OPEN = 1; TapeSocket.CLOSING = 2; TapeSocket.CLOSED = 3;
    window.WebSocket = TapeSocket;
    if (cfg.tapeStart) held = -(cfg.tapeStart * 1000);        // the page's clock starts where the take starts
  }

  const tick = () => new Promise((r) => r());
  async function step(ms, hold) {
    const target = vnow + ms;
    if (hold) held += ms;
    for (let guard = 0; guard < 20000; guard++) {
      let best = null;
      for (const t of timers.values()) if (t.at <= target && (!best || t.at < best.at || (t.at === best.at && t.id < best.id))) best = t;
      if (!best) break;
      vnow = Math.max(vnow, best.at);
      if (best.every) best.at = vnow + best.every; else timers.delete(best.id);
      try { best.fn(...best.args); } catch (err) { console.error(err); }
      await tick();
    }
    vnow = target;
    for (const s of sockets) s.pump();
    await tick();
    const batch = rafs; rafs = [];
    for (const r of batch) { try { r.fn(vnow); } catch (err) { console.error(err); } }
    await tick();
  }
  function animations(ms) {
    for (const a of document.getAnimations()) {
      try {
        if (a.playState !== 'paused') a.pause();
        const t = (a.currentTime ?? 0) + ms, end = a.effect?.getComputedTiming?.().endTime;
        if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      } catch { /* an animation that went away mid-step */ }
    }
  }
  window.__vt = {
    /** Move the clock on by `ms` and draw one frame. hold: let everything settle without the calendar (or the tape) moving. */
    async frame(ms, hold = false) { await step(ms, hold); animations(ms); },
    now: () => vnow, date: dateNow, timers: () => timers.size,
  };

  /* ---- helpers for the shot scripts ----------------------------------------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EASE = {
    linear: (k) => k,
    io: (k) => k * k * (3 - 2 * k),
    io2: (k) => k * k * k * (k * (k * 6 - 15) + 10),
    out: (k) => 1 - (1 - k) ** 3,
    in: (k) => k ** 3,
  };
  /** kf(t, [[time, {a, b}, ease?], …]) → the values at t, eased segment by segment (the ease belongs to the segment that ENDS at that key). */
  function kf(t, keys) {
    if (t <= keys[0][0]) return { ...keys[0][1] };
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a] = keys[i - 1], [t1, b, ease] = keys[i];
        const k = (EASE[ease] || EASE.io)(clamp((t - t0) / (t1 - t0), 0, 1));
        const out = {};
        for (const key of Object.keys(b)) out[key] = (a[key] ?? b[key]) + (b[key] - (a[key] ?? b[key])) * k;
        return out;
      }
    }
    return { ...keys[keys.length - 1][1] };
  }
  const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
  window.__k = { kf, clamp, EASE, down: (k) => key('keydown', k), up: (k) => key('keyup', k), press: (k) => { key('keydown', k); key('keyup', k); } };
})();
