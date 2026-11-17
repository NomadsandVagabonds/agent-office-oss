// The dev page's measuring tape, loaded only with &perf=1 or &bench=1 (backrooms.js): without either flag this file is
// never fetched and the page draws exactly as it did.
//
// &perf=1  a small read-out in the top right corner, redrawn four times a second: the time between frames (the last one,
//          and the mean, 95th percentile and worst of the last five seconds, measured here with performance.now at every
//          frame of the stage's own loop, not the stage's smoothed frameMs), frames a second, what the level's scene pass
//          drew in the last frame, textures and geometries held, the camcorder's internal picture against the canvas and
//          the pixel ratio, and which room you are standing in.
// &bench=1 the same, and a fixed tour of the floor (perf-stats.js `stations`): the handle's goto, and the yaw set directly
//          each frame, so nothing depends on keys, the mouse or Math.random. At the end one line on the console,
//          `[bench] {…}`, the same as window.__bench, a summary in the read-out to screenshot or copy, and the page title
//          `bench done`.
//
// How the draw calls are counted: the level draws through the camcorder's EffectComposer, so the renderer's own info
// only ever holds its last call (a full-screen quad). Here renderer.render is wrapped on this page's renderer only, and
// after each call the numbers that call left in renderer.info are added up: the calls that drew the level's scene
// (`handle.root`) are the scene pass, and every call together is all passes. Nothing about how anything is drawn changes.
//
// &stress=<n> (1…32) the scene pass is drawn n times a frame: n − 1 extra renders of the same scene and camera into the
//          target the real one is about to draw into, which is cleared again before the real one (the camcorder's render
//          pass has autoClear off and clears once itself), so the picture is the one the real render leaves and the scene
//          pass costs about n times as much. The draws line counts the real render; the extras are in *all passes*.
// &stress=auto (with &bench=1) at the first station, before the tour: n stepped up (STRESS_LADDER) until the frame time
//          falls off the unstressed one or n is 32 (perf-stats.js stressStep), then the tour runs unstressed. What it
//          measures and what it does not: perf-stats.js, above STRESS_LADDER.
// The camcorder's internal line count cannot be raised from here: vhs.js fixes it inside layout() and keeps its composer
// to itself, so there is no &lines=.
import { WINDOW_MS, REDRAW_MS, summarize, stations, tourSeconds, yawAt, drawFlags, benchReport, summaryText, stressOf, stressBegin, stressStep } from './perf-stats.js';

export function createPerf(stage, { bench = false, params = new URLSearchParams(location.search) } = {}) {
  const renderer = stage.renderer, info = renderer.info;
  let handle = null, root = null, internal = null;
  const acc = { calls: 0, tris: 0, all: 0 };              // what this frame has drawn so far
  const asked = stressOf(params.get('stress'));          // a number, 'auto', or null
  let stressN = typeof asked === 'number' ? asked : 1;   // how many times the scene is drawn this frame
  const original = renderer.render;
  renderer.render = function (scene, camera) {
    if (stressN > 1 && root && scene === root) {
      for (let k = 1; k < stressN; k++) {
        const c = info.autoReset ? 0 : info.render.calls;
        original.call(this, scene, camera);
        acc.all += info.render.calls - c;
      }
      if (!this.autoClear) this.clear(this.autoClearColor, this.autoClearDepth, this.autoClearStencil);   // (with autoClear on, render clears)
    }
    const c0 = info.autoReset ? 0 : info.render.calls, t0 = info.autoReset ? 0 : info.render.triangles;
    original.call(this, scene, camera);
    const calls = info.render.calls - c0, tris = info.render.triangles - t0;
    acc.all += calls;
    if (root && scene === root) {
      acc.calls += calls; acc.tris += tris;
      const target = renderer.getRenderTarget();
      internal = target ? `${target.width}x${target.height}` : `${renderer.domElement.width}x${renderer.domElement.height}`;
    }
  };

  // one record a frame: the interval that ended at this frame, and what the frame before it drew
  const recent = [];                                     // { t, ms, calls, tris, all } for the last WINDOW_MS
  let last = 0, lastFrame = null;
  let tour = null;                                       // while touring: { list, i, phase, at, frames, began }
  const off = stage.onFrame(() => {
    const now = performance.now();
    if (last) {
      const f = { t: now, ms: now - last, calls: acc.calls, tris: acc.tris, all: acc.all };
      recent.push(f); lastFrame = f;
      while (recent.length && recent[0].t < now - WINDOW_MS) recent.shift();
      if (tour && tour.phase === 'hold') tour.frames.push({ ms: f.ms, calls: f.calls, tris: f.tris, station: tour.i });
    }
    last = now; acc.calls = 0; acc.tris = 0; acc.all = 0;
    if (tour) step(now);
  });

  /* ---- the read-out --------------------------------------------------------------------- */
  const el = document.createElement('div');
  el.id = 'perf';
  Object.assign(el.style, { position: 'fixed', right: '6px', top: '6px', zIndex: '40', background: 'rgba(0,0,0,.62)', color: '#e9e3cf',
    font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace', padding: '5px 7px', whiteSpace: 'pre', pointerEvents: 'none', maxWidth: 'calc(100vw - 12px)', overflow: 'hidden' });
  const live = document.createElement('div'), done = document.createElement('div');
  el.append(live, done);
  document.body.append(el);
  const sizeNow = () => ({
    picture: internal, canvas: `${renderer.domElement.width}x${renderer.domElement.height}`, window: `${innerWidth}x${innerHeight}`,
    dpr: renderer.getPixelRatio(), devicePixelRatio: window.devicePixelRatio, vhs: handle?.vhs?.level,
  });
  const redraw = () => {
    const s = summarize(recent.map((f) => f.ms)), span = recent.length > 1 ? recent[recent.length - 1].t - recent[0].t + recent[0].ms : 0;
    const fps = span > 0 ? (recent.length * 1000) / span : 0, f = lastFrame || { ms: 0, calls: 0, tris: 0, all: 0 }, z = sizeNow();
    const at = handle?.where?.(), mem = info.memory;
    live.textContent = [
      `frame ${f.ms.toFixed(1)}  avg ${s.mean ?? '–'}  p95 ${s.p95 ?? '–'}  worst ${s.worst ?? '–'} ms (5 s)`,
      `fps   ${fps.toFixed(1)}`,
      `draws ${f.calls} scene · ${f.all} all passes · tris ${f.tris}${stressN > 1 || asked ? ` · stress ×${stressN}${asked === 'auto' ? ' (auto)' : ''}` : ''}`,
      `held  ${mem.textures} textures · ${mem.geometries} geometries`,
      `size  picture ${z.picture || '–'} · canvas ${z.canvas} · dpr ${z.dpr} (device ${z.devicePixelRatio})`,
      `room  ${at ? `${at.id} ${at.room} · floor ${at.floor}` : '–'}${tour ? ` · tour ${Math.min(tour.i + 1, tour.list.length)}/${tour.list.length}` : ''}`,
    ].join('\n');
  };
  const timer = setInterval(redraw, REDRAW_MS);

  /* ---- the tour ------------------------------------------------------------------------- */
  const gpuName = () => {
    try {
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch { return null; }
  };
  const roomDef = (id) => handle?.level?.rooms.find((r) => r.id === id);
  function begin(st) {
    handle.goto(st.room, st.x, st.z, st.yaw, 0);
    tour.phase = 'settle'; tour.at = performance.now();
  }
  function step(now) {
    if (tour.phase === 'wait') {                         // until you have landed: the fall in is not part of the tour
      if (handle?.state !== 'play') return;
      tour.depth = handle.level.depth; tour.began = now;
      begin(tour.list[0]);
      return;
    }
    if (handle.state !== 'play' || handle.level?.depth !== tour.depth) return end(`the visit moved on (${handle.state}, floor ${handle.level?.depth})`);
    const st = tour.list[tour.i], def = roomDef(st.room), t = (now - tour.at) / 1000;
    if (tour.phase === 'stress') {                       // &stress=auto, standing at the first station before it is measured
      tour.stress = stressStep(tour.stress, now, lastFrame?.ms);
      stressN = tour.stress.n;
      if (def) { handle.player.me.yaw = yawAt(st, 0) + (def.rot * Math.PI) / 2; handle.player.me.pitch = 0; }
      if (tour.stress.done) {
        console.log(`[bench] stress auto: ${tour.stress.table.map((r) => `×${r.n} ${r.mean} ms`).join(', ')} → headroom ${tour.stress.headroom}× (${tour.stress.why})`);
        tour.phase = 'settle'; tour.at = now;            // and settle again, unstressed, before the station is measured
      }
      return;
    }
    if (tour.phase === 'settle' && t >= st.settle && asked === 'auto' && !tour.stress) { tour.phase = 'stress'; tour.stress = stressBegin(now); return; }
    if (tour.phase === 'settle' && t >= st.settle) { tour.phase = 'hold'; tour.at = now; tour.stood[tour.i] = handle.where()?.id ?? null; }
    const held = tour.phase === 'hold' ? (now - tour.at) / 1000 : 0;
    if (def) { handle.player.me.yaw = yawAt(st, held) + (def.rot * Math.PI) / 2; handle.player.me.pitch = 0; }
    if (tour.phase === 'hold' && held >= st.hold) {
      tour.i += 1;
      if (tour.i >= tour.list.length) end(null);
      else begin(tour.list[tour.i]);
    }
  }
  function end(aborted) {
    const t = tour; tour = null;
    const stress = asked === 'auto' ? { asked, n: 1, table: t.stress?.table ?? [], headroom: t.stress?.headroom ?? null, why: t.stress?.why ?? null }
      : asked ? { asked, n: asked } : null;
    if (asked === 'auto') stressN = 1;
    const report = benchReport({ seed: params.get('seed') ?? params.get('tape') ?? t.seed, flags: drawFlags(params), ua: navigator.userAgent, gpu: gpuName(), sizes: sizeNow(),
      list: t.list, frames: t.frames, stood: t.stood, seconds: t.began ? (performance.now() - t.began) / 1000 : 0, aborted, stress });
    window.__bench = report;
    console.log('[bench] ' + JSON.stringify(report));
    done.style.cssText = 'margin-top:6px;padding-top:5px;border-top:1px solid #e9e3cf55;user-select:text;pointer-events:auto;white-space:pre-wrap;overflow-wrap:anywhere';   // wraps on a phone, so all of it is in a screenshot
    done.textContent = summaryText(report) + '\n';
    const copy = document.createElement('button');
    copy.textContent = 'copy result';
    copy.style.cssText = 'font:inherit;margin-top:4px;pointer-events:auto';
    copy.onclick = () => navigator.clipboard?.writeText('[bench] ' + JSON.stringify(report)).then(() => { copy.textContent = 'copied'; }, () => { copy.textContent = 'copy failed: select the text'; });
    done.append(copy);
    redraw();
    document.title = 'bench done';
  }

  return {
    /** The floor is up (onReady): read the room from it, and with &bench=1 start the tour. */
    attach(next) {
      handle = next; root = next.root;
      if (bench && !tour) {
        const list = stations(next.level);
        tour = { list, i: 0, phase: 'wait', at: 0, frames: [], stood: [], began: 0, seed: next.level.seed, depth: null, stress: null };
        console.log(`[bench] touring ${list.length} stations, about ${Math.round(tourSeconds(list))} s once the floor is reached${asked === 'auto' ? ', after up to 18 s of stress steps at the first' : asked > 1 ? `, the scene drawn ${asked} times a frame` : ''}`);
      }
    },
    /** The visit is over: a tour still running stops and says so. */
    detach() { if (tour) end(tour.phase === 'wait' ? 'the visit ended before the tour began' : 'the visit ended'); handle = null; root = null; },
    stop() { off(); clearInterval(timer); renderer.render = original; el.remove(); },
  };
}
