// The Backrooms — the hidden level under the office. Lean on the wrong corner
// of the Back Room and you fall out of the building into this: yellow rooms
// that hum, seen through a camcorder, never the same twice.
//
//   const { reason } = await enterBackrooms(office, { name, seed });
//   reason: 'exit' (you found the door) | 'caught' (something found you) | 'quit' (Esc)
//
// This file is the conductor: it generates a level (gen.js), builds it
// (world.js + rooms.js with kit.js), takes the screen through the stage's
// setView, runs the player, the camcorder (vhs.js), its overlay (hud.js), the
// sound and whatever follows you, and puts everything back when it is over.
// It reads names and faces from the office and sends nothing anywhere.
import * as THREE from 'three';
import { resolveLook } from '/core/look.mjs';
import { generate, sketch, toWorld, toLocal, DECK } from './gen.js';
import { createKit } from './kit.js';
import { buildWorld, loadCatalogue } from './world.js';
import { BUILDERS } from './rooms.js';
import { createPlayer } from './player.js';
import { createVhs } from './vhs.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';

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
 * @param {{name?:string, seed?:number|string, only?:string|string[], pursuer?:boolean, vhs?:number, mute?:boolean, dev?:object, onReady?:Function}} [opt]
 * @returns {Promise<{reason:'exit'|'caught'|'quit'}>}
 */
export async function enterBackrooms(office, opt = {}) {
  if (running) return { reason: 'quit' };
  running = true;
  try { return await visit(office, opt); } finally { running = false; }
}

async function visit(office, opt) {
  const stage = office.stage, renderer = stage.renderer, canvas = renderer.domElement;
  const who = gather(office, opt);
  const level = generate(opt.seed ?? Date.now(), { name: who.name, projects: who.projects, agents: who.agents.map((a) => a.name), tasks: who.tasks, only: opt.only, pursuer: opt.pursuer, count: opt.count });
  // everybody in the level's cast has a face: the real one, or one rolled from the name
  const byName = new Map(who.agents.map((a) => [a.name, a.look]));
  const cast = level.cast.map((name) => ({ name, look: byName.get(name) || resolveLook('backrooms:' + name) }));
  const saved = prefs.load();
  const kit = createKit();
  const camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.06, 90);
  const vhs = createVhs(renderer, camera, { bloom: stage.quality?.fx !== false, level: opt.vhs ?? saved.vhs ?? 2 });
  const sound = createSound(level, { mute: opt.mute ?? saved.mute ?? false });
  let finish = () => {};
  const hud = createHud(level, { onLeave: () => finish('quit') });
  hud.setClean(vhs.level === 0);
  hud.banner('TRACKING');
  document.activeElement?.blur?.();

  let state = 'loading', world = null, player = null, time = 0, ending = 0, reason = null, resolveVisit = null;
  let pictureKey = '', currentUse = null, light = 0.3, torch = 0, interference = 0, pendingQuit = false;
  const u = vhs.uniforms;
  u.uSnow.value = 1;

  /* ---- the screen is ours from here ---------------------------------------------- */
  const render = (dt) => {
    if (state === 'done') return;
    const p = vhs.layout(stage.size.w, stage.size.h), key = `${p.x},${p.y},${p.w},${p.h}`;
    if (key !== pictureKey) { pictureKey = key; hud.layout(p); }
    vhs.render(dt);
  };
  stage.setView({ scene: new THREE.Scene(), camera, render });

  /* ---- what rooms may call on ------------------------------------------------------ */
  const halfFov = () => Math.atan(Math.tan((FOV * Math.PI) / 360) * camera.aspect);
  const env = {
    level, cast, who, kit, sound, hud, vhs, builders: BUILDERS, catalogue: await loadCatalogue(),
    player: null, world: null, pursuer: null,
    say: (text, o) => hud.say(text, o),
    end: (why) => finish(why),
    /** Is this spot on screen and not behind a wall? */
    sees(x, z, o = {}) {
      const me = player?.me; if (!me) return false;
      const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
      if (d > (o.far ?? 45)) return false;
      if (d < 0.35) return true;
      const facing = (-Math.sin(me.yaw) * dx - Math.cos(me.yaw) * dz) / d;
      if (facing < Math.cos(Math.min(Math.PI, halfFov() + (o.margin ?? 0.14) + Math.atan2(o.radius ?? 0.4, d)))) return false;
      if (Math.abs(me.pitch) > 1.05 && d > 1.2) return false;
      return o.walls === false || world.los(me.x, me.z, x, z);
    },
    /** How loud and which side a sound from this spot would be. */
    hear(x, z, reach = 5) {
      const me = player?.me; if (!me) return { vol: 0, pan: 0 };
      const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz) || 0.001;
      return { vol: 1 / (1 + (d / reach) ** 2), pan: ((Math.cos(me.yaw) * dx - Math.sin(me.yaw) * dz) / d) * Math.min(1, d / 1.5) };
    },
    play(name, x, z, reach) { const at = x === undefined ? {} : env.hear(x, z, reach); if (at.vol === undefined || at.vol > 0.02) sound.play(name, at); },
    /** More static on the tape (0..1), for a moment; things that interfere call this every frame. */
    interfere(k) { interference = Math.max(interference, k); },
  };

  /* ---- input: ours while we run, in the capture phase so the office never hears it -- */
  const keys = () => player?.input.keys;
  const onKeyDown = (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    e.stopPropagation();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(k)) return;      // the browser's own shortcuts stay the browser's
    e.preventDefault();
    sound.start();
    if (e.repeat) return;
    keys()?.add(k);
    if (k === 'Escape') finish('quit');
    else if (k === 'v') setPicture((vhs.level + 2) % 3);
    else if (k === 'm') { sound.setMute(!sound.muted); hud.flag('MUTE', sound.muted); prefs.save({ ...prefs.load(), mute: sound.muted }); }
    else if ((k === 'e' || k === 'Enter') && state === 'play' && currentUse) { const use = currentUse; try { use.use(use); } catch (err) { console.warn('[backrooms] use', err); } }
  };
  const onKeyUp = (e) => { e.stopPropagation(); keys()?.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (e.key === 'Shift') keys()?.delete('Shift'); };
  let dragging = false;
  const onPointerDown = (e) => {
    e.stopPropagation();
    sound.start();
    if (e.target?.closest?.('.br-leave')) { finish('quit'); return; }
    dragging = true;
    if (state !== 'done' && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* no pointer lock: arrows still turn */ } }
  };
  const onPointerUp = (e) => { e.stopPropagation(); dragging = false; };
  const onMouseMove = (e) => {
    e.stopPropagation();
    if (!player || (document.pointerLockElement !== canvas && !dragging)) return;
    player.input.dx += e.movementX || 0; player.input.dy += e.movementY || 0;
  };
  const swallow = (e) => { e.stopPropagation(); if (e.type === 'contextmenu') e.preventDefault(); };
  const onLock = () => hud.setLocked(document.pointerLockElement === canvas);
  const onBlur = () => { keys()?.clear(); dragging = false; };
  const listeners = [['keydown', onKeyDown], ['keyup', onKeyUp], ['pointerdown', onPointerDown], ['pointerup', onPointerUp], ['pointercancel', onPointerUp],
    ['mousemove', onMouseMove], ['pointermove', swallow], ['wheel', swallow], ['click', swallow], ['dblclick', swallow], ['contextmenu', swallow]];
  for (const [type, fn] of listeners) window.addEventListener(type, fn, true);
  document.addEventListener('pointerlockchange', onLock);
  window.addEventListener('blur', onBlur);

  function setPicture(lv) {
    vhs.setLevel(lv);
    hud.setClean(lv === 0);
    if (player) player.me.shake = lv === 2 ? 1 : lv === 1 ? 0.5 : 0.25;
    pictureKey = '';
    prefs.save({ ...prefs.load(), vhs: lv });
    hud.say(['Picture: clean. No tape, no wobble.', 'Picture: steady. The tape behaves itself.', 'Picture: as recorded.'][lv], { ms: 1800 });
  }

  /* ---- the loop ---------------------------------------------------------------------- */
  const END = { quit: 0.4, caught: 1.5, exit: 1.4 };
  const off = stage.onFrame((dt) => {
    if (state === 'loading' || state === 'done') return;
    time += dt;
    const me = player.me;
    me.frozen = state !== 'play';
    player.update(dt, time);
    world.update(dt, time, me);
    env.pursuer?.update(dt, time);
    currentUse = state === 'play' ? world.usable(me) : null;
    hud.hint(currentUse ? (typeof currentUse.label === 'function' ? currentUse.label() : currentUse.label) : null);

    // the camcorder copes with the dark: more gain (and more noise), then its little lamp
    const here = world.current();
    const lvl = here ? here.level * here.u.dim.value : 0.3;
    light += (lvl - light) * (1 - Math.exp(-2.2 * dt));
    u.uGain.value = clamp(Math.pow(0.3 / Math.max(light, 0.04), 0.55), 0.9, 2.3);
    const wantTorch = light < 0.11 && !here?.noTorch ? 1 : 0;
    torch += (wantTorch - torch) * (1 - Math.exp(-3 * dt));
    kit.shared.uTorch.value = torch * 1.5;
    hud.flag('LIGHT', torch > 0.5);
    sound.setHum(light / 0.3);
    if (here?.flickers.length && here.flickerNow < 0.5 && Math.random() < 0.3) sound.play('tick', { vol: 0.7 });
    interference *= Math.exp(-4 * dt);
    u.uTrack.value = interference;
    if (interference > 0.5) hud.glitch(0.3);

    if (state === 'falling') {
      u.uSnow.value = Math.max(0, u.uSnow.value - dt / 0.8);
      if (time > 1.25) { state = 'play'; hud.recording(); hud.say(level.intro); hud.help(['W A S D  walk     mouse or ← →  look     Shift  hurry', 'E  use     V  picture     M  sound     Esc  give up', document.pointerLockElement === canvas ? '' : 'click for mouse look']); }
    } else if (state === 'ending') {
      ending += dt;
      const k = clamp(ending / END[reason], 0, 1);
      if (reason === 'quit') u.uBlack.value = k;
      else if (reason === 'exit') u.uWhite.value = k * k;
      else { u.uSnow.value = Math.min(1, k * 1.6); u.uRoll.value += dt * (0.4 + k * 2.5); interference = 1; }
      if (k >= 1) conclude();
    }
    hud.update(dt);
  });

  function conclude() {
    if (state === 'done') return;
    state = 'done';
    off();
    for (const [type, fn] of listeners) window.removeEventListener(type, fn, true);
    document.removeEventListener('pointerlockchange', onLock);
    window.removeEventListener('blur', onBlur);
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    hud.remove(); sound.stop();
    env.pursuer?.dispose?.();
    world?.dispose(); kit.dispose(); vhs.dispose();
    renderer.setRenderTarget(null);
    if (opt.debug) delete window.__backrooms;
    resolveVisit({ reason: reason || 'quit' });
  }
  finish = (why) => {
    if (state === 'done' || state === 'ending' || pendingQuit) return;
    reason = why; ending = 0;
    hud.hint(null); hud.say(null); hud.banner(why === 'quit' ? 'STOP ■' : '');
    if (why === 'caught') sound.play('static', { dur: 1.3 });
    if (state === 'loading') pendingQuit = true; else state = 'ending';
  };
  const visitOver = new Promise((resolve) => { resolveVisit = resolve; });

  /* ---- build, then begin ------------------------------------------------------------- */
  try {
    let breath = performance.now();                       // build as fast as the machine allows, but keep the static moving
    world = await buildWorld(kit, level, env, async () => { if (performance.now() - breath > 14) { await frame(); breath = performance.now(); } });
    env.world = world;
  } catch (err) {
    console.error('[backrooms] could not build', err);
    reason = 'quit'; state = 'ending'; conclude();
    return visitOver;
  }
  if (pendingQuit) { conclude(); return visitOver; }
  player = createPlayer(world, camera, level.start);
  env.player = player;
  player.me.shake = vhs.level === 2 ? 1 : vhs.level === 1 ? 0.5 : 0.25;
  player.me.drop = 1.3;
  player.on('step', () => sound.play(world.current()?.footstep || 'step'));
  for (const fn of env.ready || []) fn();
  world.enter(world.roomAt(player.me.x, player.me.z));
  vhs.setScene(world.scene);
  hud.banner('');
  hud.flag('MUTE', sound.muted);
  onLock();
  state = 'falling';

  // a way for the dev page (and the curious) to poke at it
  const handle = {
    level, world, player, vhs, hud, env, sketch: () => sketch(level), deck: DECK.map((a) => a.id),
    /** Stand in a room: by archetype id or room number; x, z in the room's own frame (default: just inside its door). */
    goto(which, x, z, yaw, pitch = 0) {
      const def = level.rooms.find((r) => r.arch === which || r.kind === which || r.id === which);
      if (!def) return false;
      const p = toWorld(def, x ?? 0, z ?? def.D / 2 - 0.9);
      player.warp(p.x, p.z, (yaw ?? 0) + (def.rot * Math.PI) / 2);
      player.me.pitch = pitch; player.me.drop = 0; player.me.dropV = 0;
      world.enter(world.roomAt(p.x, p.z));
      return true;
    },
    where() { const me = player.me, rt = world.roomAt(me.x, me.z), p = rt ? toLocal(rt.def, me.x, me.z) : null; return { room: rt?.def.arch || rt?.def.kind, id: rt?.id, x: p && +p.x.toFixed(2), z: p && +p.z.toFixed(2), yaw: +(me.yaw - (rt ? (rt.def.rot * Math.PI) / 2 : 0)).toFixed(2) }; },
    finish: (why) => finish(why),
  };
  if (opt.debug) window.__backrooms = handle;
  opt.onReady?.(handle);
  return visitOver;
}
