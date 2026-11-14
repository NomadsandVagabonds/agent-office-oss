// The Backrooms — the hidden level under the office. Lean on the wrong corner
// of the Back Room and you fall out of the building into this: yellow rooms
// that hum, seen through a camcorder, never the same twice — and under them,
// more floors, each a different kind of place, until the one with the door.
//
//   const { reason } = await enterBackrooms(office, { name, seed });
//   reason: 'exit' (you found the door) | 'caught' (something found you) | 'quit' (Esc)
//
// This file is the conductor. It plans the visit (plan.js), and for each floor
// in turn generates it (gen.js), builds it (world.js + rooms.js with kit.js)
// and, when you go through the ceiling of the next, lets go of it. What lasts
// the whole visit is kept here: the screen (through the stage's setView), the
// camcorder (vhs.js) and its overlay (hud.js), the sound, your hands
// (input.js) and what is in them. It reads names and faces from the office,
// and what is still hidden down here (office.game: a keycard, some coins —
// loot.js). The one thing it ever tells the office is what you were carrying
// when you left by the door.
import * as THREE from 'three';
import { resolveLook } from '/core/look.mjs';
import { sketch, toWorld, toLocal, DECK } from './gen.js';
import { planVisit, floorOf } from './plan.js';
import { createKit } from './kit.js';
import { buildWorld, loadCatalogue } from './world.js';
import { BUILDERS } from './rooms.js';
import { createPlayer } from './player.js';
import { createVhs } from './vhs.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { createInput } from './input.js';
import { createStalkers } from './pursuer.js';
import { createLoot, lootLeft } from './loot.js';

const FOV = 62;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frame = () => new Promise((r) => requestAnimationFrame(r));
const prefs = {
  load() { try { return JSON.parse(localStorage.getItem('office.backrooms') || '{}') || {}; } catch { return {}; } },
  save(p) { try { localStorage.setItem('office.backrooms', JSON.stringify(p)); } catch { /* private mode: fine */ } },
};

/** Names and faces borrowed from the real office (read-only). */
function gather(office, opt) {
  const st = office.net?.state || {};
  const projects = (st.world?.plan?.rooms || []).map((r) => r && r.name).filter(Boolean);
  const agents = [];
  for (const a of st.agents?.values?.() || []) if (a && a.name) agents.push({ name: String(a.name), look: resolveLook(a.persona || a.id, a.profile?.character) });
  const tasks = [];
  for (const list of st.tasks?.values?.() || []) for (const t of list || []) if (t && t.title) tasks.push(String(t.title));
  const me = office.walk?.me;
  return {
    name: String(opt.name || me?.name || 'Lead'), projects, agents, tasks,
    look: resolveLook('lead:' + (me?.id || opt.name || 'lead'), me?.look || { accessory: 'crown' }),
    creations: office.creations || {},
  };
}

let running = false;

/**
 * @param office  the office object (stage, net, …)
 * @param {{name?:string, seed?:number|string, only?:string|string[], pursuer?:boolean, vhs?:number, mute?:boolean, depths?:number, depth?:number, debug?:boolean, onReady?:Function}} [opt]
 *        depths: how many floors (default: by the seed) · depth: which floor to begin on (default: the top one)
 * @returns {Promise<{reason:'exit'|'caught'|'quit', kept:{card:boolean, coins:number[], told?:Promise<void>}}>}  kept: what you brought out (nothing,
 *          unless you left by the door); kept.told settles once the office has been told of it
 */
export async function enterBackrooms(office, opt = {}) {
  if (running) return { reason: 'quit', kept: { card: false, coins: [] } };
  running = true;
  try { return await visit(office, opt); } finally { running = false; }
}

async function visit(office, opt) {
  const stage = office.stage, renderer = stage.renderer, canvas = renderer.domElement;
  const who = gather(office, opt);
  const seed = opt.seed ?? Date.now();
  const ask = { name: who.name, projects: who.projects, agents: who.agents.map((a) => a.name), tasks: who.tasks, only: opt.only, onlyDepth: opt.depth | 0, pursuer: opt.pursuer, count: opt.count, depths: opt.depths };
  // what the office says is still to be found down here is hidden in this visit; no office keeping count, nothing hidden
  const left = lootLeft(office);
  let plan = planVisit(seed, { ...ask, loot: left || undefined });
  const floor = (i) => {
    try { return floorOf(plan, i); }
    catch (err) { console.warn('[backrooms] nothing could be hidden this time', err); plan = planVisit(seed, ask); return floorOf(plan, i); }
  };
  const first = floor(clamp(opt.depth | 0, 0, plan.depths - 1));
  // everybody in the visit's cast has a face: the real one, or one rolled from the name
  const byName = new Map(who.agents.map((a) => [a.name, a.look]));
  const cast = first.cast.map((name) => ({ name, look: byName.get(name) || resolveLook('backrooms:' + name) }));
  const saved = prefs.load();
  const camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.06, 170);
  const vhs = createVhs(renderer, camera, { bloom: stage.quality?.fx !== false, level: opt.vhs ?? saved.vhs ?? 2 });
  const sound = createSound(first, { mute: opt.mute ?? saved.mute ?? false });
  const hud = createHud(first);
  hud.setClean(vhs.level === 0);
  document.activeElement?.blur?.();
  const purse = left ? createLoot(office, { hud, sound }) : null;
  // borrowed if they will load; the rooms that wanted them make do if not
  const Avatar = (await import('../avatar/rig.js').catch(() => null))?.Avatar || null;
  const layout = await import('/core/layout.mjs').catch(() => null);

  // 'loading' → 'falling' → 'play' → ('cut' → 'falling' → 'play')… → 'ending' → 'done'
  let state = 'loading', cur = null, time = 0, since = 0, ending = 0, reason = null, resolveVisit = null, swapping = false;
  let pictureKey = '', currentUse = null, light = 0.3, torch = 0, interference = 0, pendingQuit = false, kept = { card: false, coins: [] };
  const u = vhs.uniforms, blank = new THREE.Scene();
  u.uSnow.value = 1;

  /* ---- the screen is ours from here ---------------------------------------------- */
  const render = (dt) => {
    if (state === 'done') return;
    const p = vhs.layout(stage.size.w, stage.size.h), key = `${p.x},${p.y},${p.w},${p.h}`;
    if (key !== pictureKey) { pictureKey = key; hud.layout(p); }
    vhs.render(dt);
  };
  stage.setView({ scene: blank, camera, render });

  /* ---- hands ----------------------------------------------------------------------- */
  const useIt = () => { if (state === 'play' && currentUse) { const use = currentUse; try { use.use(use); } catch (err) { console.warn('[backrooms] use', err); } } };
  const input = createInput({ canvas, stage, hud, sound,
    quit: () => finish('quit'), use: useIt, click: () => {}, wheel: () => {},
    key(k) {
      if (k === 'v') setPicture((vhs.level + 2) % 3);
      else if (k === 'm') { sound.setMute(!sound.muted); prefs.save({ ...prefs.load(), mute: sound.muted }); }
    } });
  function setPicture(lv) {
    vhs.setLevel(lv);
    hud.setClean(lv === 0);
    if (cur?.player) cur.player.me.shake = lv === 2 ? 1 : lv === 1 ? 0.5 : 0.25;
    pictureKey = '';
    prefs.save({ ...prefs.load(), vhs: lv });
  }

  /* ---- a floor: everything that is built for it and thrown away with it ---------------- */
  const halfFov = () => Math.atan(Math.tan((FOV * Math.PI) / 360) * camera.aspect);
  async function build(level, carry) {
    const kit = createKit();
    const f = { level, kit, world: null, player: null, env: null };
    const env = f.env = {
      level, cast, who, kit, sound, hud, vhs, renderer, builders: BUILDERS, catalogue: await loadCatalogue(kit), Avatar, layout,
      plan: office.net?.state?.world?.plan || {}, visit: plan, carry,
      player: null, world: null, pursuer: null,
      hatches: new Map(),                       // room id → { drop() }: where a door in a floor lets you out
      end: (why) => finish(why),
      /** The floor has given way: the next one down. */
      descend: () => descend(),
      /** Is this spot on screen and not behind a wall? */
      sees(x, z, o = {}) {
        const me = f.player?.me; if (!me) return false;
        const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
        if (d > (o.far ?? 45)) return false;
        if (d < 0.35) return true;
        const facing = (-Math.sin(me.yaw) * dx - Math.cos(me.yaw) * dz) / d;
        if (facing < Math.cos(Math.min(Math.PI, halfFov() + (o.margin ?? 0.14) + Math.atan2(o.radius ?? 0.4, d)))) return false;
        if (Math.abs(me.pitch) > 1.05 && d > 1.2) return false;
        return o.walls === false || f.world.los(me.x, me.z, x, z);
      },
      /** How loud and which side a sound from this spot would be. */
      hear(x, z, reach = 5) {
        const me = f.player?.me; if (!me) return { vol: 0, pan: 0 };
        const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz) || 0.001;
        return { vol: 1 / (1 + (d / reach) ** 2), pan: ((Math.cos(me.yaw) * dx - Math.sin(me.yaw) * dz) / d) * Math.min(1, d / 1.5) };
      },
      play(name, x, z, reach) { const at = x === undefined ? {} : env.hear(x, z, reach); if (at.vol === undefined || at.vol > 0.02) sound.play(name, at); },
      /** More static on the tape (0..1), for a moment; things that interfere call this every frame. */
      interfere(k) { interference = Math.max(interference, k); },
    };
    createStalkers(env);
    env.loot = purse;
    purse?.hang(env);
    let breath = performance.now();                       // build as fast as the machine allows, but keep the static moving
    f.world = env.world = await buildWorld(kit, level, env, async () => { if (performance.now() - breath > 40) { await frame(); breath = performance.now(); } });
    return f;
  }
  function letGo(f) {
    if (!f) return;
    f.env.pursuer?.dispose?.();
    f.world?.dispose(); f.kit.dispose();
  }
  /** You are on this floor now, somewhere under a hole in its ceiling. */
  function land(f) {
    cur = f;
    const player = f.player = f.env.player = createPlayer(f.world, camera, f.level.start, input.state);
    player.me.shake = vhs.level === 2 ? 1 : vhs.level === 1 ? 0.5 : 0.25;
    player.me.drop = 1.3;
    player.on('step', () => sound.play(f.world.current()?.footstep || 'step'));
    for (const fn of f.env.ready || []) fn();
    f.world.enter(f.world.roomAt(player.me.x, player.me.z));
    vhs.setScene(f.world.scene);
    if (f.level !== first) hud.setStamp(f.level.stamp);
    sound.setMains(f.level.hum);
    currentUse = null; since = 0;
    state = 'falling';
  }
  /** Through the ceiling of the next floor down. The tape cuts; what was above is let go of while the next is built. */
  function descend(force) {
    if (state !== 'play' || swapping || !cur) return false;
    if (cur.level.depth >= plan.depths - 1 || (!force && cur.level.exit.way !== 'stairs')) return false;
    state = 'cut'; since = 0;
    hud.hint(false);
    sound.play('static', { dur: 1.1 });
    return true;
  }
  async function swap() {
    swapping = true;
    const old = cur, carry = old.env.pursuer?.carry?.() || null, next = old.level.depth + 1;
    cur = null; vhs.setScene(blank);
    letGo(old);
    let f = null;
    try { f = await build(floor(next), carry); }
    catch (err) { console.error('[backrooms] the next floor would not build', err); swapping = false; reason = 'quit'; conclude(); return; }
    swapping = false;
    if (state === 'done') { letGo(f); return; }
    if (pendingQuit) { cur = f; conclude(); return; }
    land(f);
  }

  /* ---- the loop ---------------------------------------------------------------------- */
  const END = { quit: 0.4, caught: 1.8, exit: 1.4 };
  const off = stage.onFrame((dt) => {
    if (state === 'loading' || state === 'done') return;
    time += dt; since += dt;
    hud.update(dt);
    interference *= Math.exp(-4 * dt);
    u.uTrack.value = interference;
    if (interference > 0.5) hud.glitch(0.3);
    if (!cur) { u.uSnow.value = 1; return; }                  // between floors: nothing but snow
    const { world, player, env } = cur, me = player.me;
    me.frozen = state !== 'play';
    player.update(dt, time);
    me.slow = 1; me.sinkTo = 0;                              // rooms that slow you or make you stoop say so every frame
    world.update(dt, time, me);
    env.pursuer?.update(dt, time);
    purse?.update(dt, time, state === 'play');
    currentUse = state === 'play' ? world.usable(me) : null;
    hud.hint(!!currentUse);

    // the camcorder copes with the dark: more gain (and more noise), then its little lamp
    const here = world.current();
    const lvl = here ? here.level * here.u.dim.value : 0.3;
    light += (lvl - light) * (1 - Math.exp(-2.2 * dt));
    u.uGain.value = clamp(Math.pow(0.3 / Math.max(light, 0.04), 0.55), 0.9, 2.3);
    const wantTorch = light < 0.11 && !here?.noTorch ? 1 : 0;
    torch += (wantTorch - torch) * (1 - Math.exp(-3 * dt));
    cur.kit.shared.uTorch.value = torch * 1.5;
    hud.flag('LIGHT', torch > 0.5);
    sound.setHum(light / 0.3);
    if (here?.flickers.length && here.flickerNow < 0.5 && Math.random() < 0.3) sound.play('tick', { vol: 0.7 });

    if (state === 'falling') {
      u.uSnow.value = Math.max(0, u.uSnow.value - dt / 0.8);
      if (since > 1.25) { state = 'play'; hud.recording(); }
    } else if (state === 'cut') {
      // the ceiling you were standing on goes, and the picture with it
      u.uSnow.value = Math.min(1, since / 0.28);
      me.drop -= dt * (1.2 + since * 9);
      interference = 1;
      if (since > 0.3) swap();
    } else if (state === 'ending') {
      ending += dt;
      const k = clamp(ending / END[reason], 0, 1);
      if (reason === 'quit') u.uBlack.value = k;
      else if (reason === 'exit') u.uWhite.value = k * k;
      else { u.uSnow.value = clamp((k - 0.42) / 0.45, 0, 1); if (k > 0.45) u.uRoll.value += dt * (0.4 + k * 2.5); interference = Math.max(interference, 0.5 + 0.5 * k); }   // a look at what got you, then snow
      if (k >= 1) conclude();
    }
  });

  function conclude() {
    if (state === 'done') return;
    state = 'done';
    off();
    input.dispose();
    hud.remove(); sound.stop();
    letGo(cur); cur = null;
    vhs.dispose();
    renderer.setRenderTarget(null);
    if (opt.debug) delete window.__backrooms;
    resolveVisit({ reason: reason || 'quit', kept });
  }
  function finish(why) {
    if (state === 'done' || state === 'ending' || pendingQuit) return;
    reason = why; ending = 0;
    hud.hint(false);
    if (why === 'exit' && purse) kept = purse.bank();              // carried is only kept by leaving through the door
    if (why === 'caught') sound.play('static', { dur: 1.3 });
    if (state === 'loading' || !cur) pendingQuit = true; else state = 'ending';
  }
  const visitOver = new Promise((resolve) => { resolveVisit = resolve; });

  /* ---- build the floor you land on, then begin ---------------------------------------- */
  let top = null;
  try { top = await build(first, null); }
  catch (err) {
    console.error('[backrooms] could not build', err);
    reason = 'quit'; conclude();
    return visitOver;
  }
  if (pendingQuit) { cur = top; conclude(); return visitOver; }
  land(top);

  // a way for the dev page (and the curious) to poke at it: always the floor you are on
  const handle = {
    vhs, hud, plan: () => plan, deck: DECK.map((a) => a.id),
    get level() { return cur?.level; }, get world() { return cur?.world; }, get player() { return cur?.player; }, get env() { return cur?.env; },
    get state() { return state; }, loot: purse,
    sketch: () => (cur ? sketch(cur.level) : ''),
    /** Stand in a room: by archetype id or room number; x, z in the room's own frame (default: just inside its door). */
    goto(which, x, z, yaw, pitch = 0) {
      if (!cur) return false;
      const { level, world, player } = cur;
      const def = level.rooms.find((r) => r.arch === which || r.kind === which || r.id === which);
      if (!def) return false;
      const p = toWorld(def, x ?? 0, z ?? def.D / 2 - 0.9);
      player.warp(p.x, p.z, (yaw ?? 0) + (def.rot * Math.PI) / 2);
      player.me.pitch = pitch; player.me.drop = 0; player.me.dropV = 0;
      world.enter(world.roomAt(p.x, p.z));
      return true;
    },
    where() {
      if (!cur) return null;
      const me = cur.player.me, rt = cur.world.roomAt(me.x, me.z), p = rt ? toLocal(rt.def, me.x, me.z) : null;
      return { floor: cur.level.depth, room: rt?.def.arch || rt?.def.kind, id: rt?.id, x: p && +p.x.toFixed(2), z: p && +p.z.toFixed(2), yaw: +(me.yaw - (rt ? (rt.def.rot * Math.PI) / 2 : 0)).toFixed(2) };
    },
    /** Go down a floor now, wherever you are standing. */
    descend: () => descend(true),
    finish: (why) => finish(why),
  };
  if (opt.debug) window.__backrooms = handle;
  opt.onReady?.(handle);
  return visitOver;
}
