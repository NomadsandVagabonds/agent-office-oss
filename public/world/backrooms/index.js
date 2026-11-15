// The Backrooms — the hidden level under the office. Lean on the wrong corner
// of the Back Room and you fall out of the building into this: yellow rooms
// that hum, seen through a camcorder, never the same twice — and under them,
// more of the same building, each part a different kind of place, until the
// one with a wall that gives the way the first one did.
//
//   const { reason } = await enterBackrooms(office, { name, seed });
//   reason: 'exit' (you found the way out) | 'caught' (something found you) | 'battery' (the camcorder ran flat) | 'quit' (Give Up)
//   …and with it `kept` (what was carried out), `run` (what the visit counted: core/runs.mjs) and `card` (what the
//   card at the end said, or null if none was shown: scorecard.js; opt.scorecard === false for none)
//
// This file is the conductor. It plans the visit (plan.js), and for each part
// of the building in turn generates it (gen.js) and builds it (world.js +
// rooms.js with kit.js). It is one building: the part below is built while
// you are still walking toward the way down, and hung in the same picture
// under the place you will drop from (seam.js), so that there is never a
// moment at which the world is not there. When you have landed in it, the
// part you left is let go of. What lasts
// the whole visit is kept here: the screen (through the stage's setView), the
// camcorder (vhs.js) and its overlay (hud.js), the sound, your hands
// (input.js) and what is in them. It reads names and faces from the office,
// and what is still hidden down here (office.game: a keycard, some coins —
// loot.js). The one thing it ever tells the office is what you were carrying
// when you left by the way out.
import * as THREE from 'three';
import { resolveLook } from '/core/look.mjs';
import { BACKROOMS_DEFAULTS, cleanBackroomsSettings } from '/core/backrooms-settings.mjs';
import { sketch, toWorld, toLocal, DECK, ARCHETYPES } from './gen.js';
import { planVisit, floorOf, edition } from './plan.js';
import { createKit } from './kit.js';
import { buildWorld, loadCatalogue } from './world.js';
import { BUILDERS } from './rooms.js';
import { createPlayer } from './player.js';
import { createVhs } from './vhs.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { createInput } from './input.js';
import { createStalkers } from './pursuer.js';
import { createHand, createHandView } from './hand.js';
import { createDenizens } from './denizens.js';
import { hangBanner } from './banner.js';
import { cleanWhere } from './banner.rule.js';
import { createLoot, lootLeft } from './loot.js';
import { leaving } from './leaving.js';
import { middle, THIN_BEHIND } from './marks.js';
import { hangBelow, goesDown } from './seam.js';
import { createInventory } from './inventory.js';
import { createSurvival } from './survival.js';
import { createTally } from './tally.js';
import { createMenu } from './menu.js';

const FOV = 62;
const OWN_LAMP = 0.3;                                    // the camcorder's own lamp, beside a torch: how much of one it is
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frame = () => new Promise((r) => requestAnimationFrame(r));
const prefs = {
  load() { try { return cleanBackroomsSettings(JSON.parse(localStorage.getItem('office.backrooms') || '{}')); } catch { return cleanBackroomsSettings(); } },
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

// Rooms written since the first deck keep their builder in a file of their own (deck entry: `module`), and that file is
// only fetched when a floor first has the room on it. One that will not load is built as a plain room, and says so.
const fetched = new Map();
async function buildersFor(level) {
  const need = [...new Set(level.rooms.map((r) => r.arch))].map((id) => ARCHETYPES[id]).filter((a) => a && a.module && !fetched.has(a.id));
  await Promise.all(need.map(async (a) => {
    try { const mod = await import(new URL(a.module, import.meta.url).href); fetched.set(a.id, typeof mod.build === 'function' ? mod.build : null); }
    catch (err) { console.warn(`[backrooms] ${a.id}: ${a.module} would not load — the room will be a plain one`, err); fetched.set(a.id, null); }
  }));
  const builders = { ...BUILDERS };
  for (const [id, build] of fetched) if (build) builders[id] = build;
  return builders;
}

/**
 * @param office  the office object (stage, net, …)
 * @param {{name?:string, seed?:number|string, only?:string|string[], pursuer?:boolean, vhs?:number, mute?:boolean, depths?:number, depth?:number, inventory?:boolean, scorecard?:boolean, replay?:boolean, debug?:boolean, dev?:object, onReady?:Function}} [opt]
 *        depths: how many floors (default: by the seed) · depth: which floor to begin on (default: the top one)
 *        replay: this is a kept tape being played back (seed: the tape's; pursuer: whether the mascot was in it): nothing of the office's is hidden in it
 *        brand, share, also, home: handed to the card at the end (scorecard.js), for a page that is not the office
 *        where: a place name, if the page was told one (the site's host says a city): the second line of the banner near the landing (banner.js)
 *        inventory: false for a visit without pockets, hearts or a battery that runs down · dev.supplies: one of everything where you land
 * @returns {Promise<{reason:'exit'|'caught'|'battery'|'quit', kept:{card:boolean, coins:number[], batteries:number, told?:Promise<void>}, run:object, card:object|null}>}
 *          run: what the visit came to (tally.js) · card: the scorecard, once put down (opt.scorecard === false: none) · kept: what you brought out (nothing,
 *          unless you left by the door); kept.told settles once the office has been told of it
 */
export async function enterBackrooms(office, opt = {}) {
  if (running) return { reason: 'quit', kept: { card: false, coins: [], batteries: 0 } };
  running = true;
  try { return await visit(office, opt); } finally { running = false; }
}

async function visit(office, opt) {
  const stage = office.stage, renderer = stage.renderer, canvas = renderer.domElement;
  const who = gather(office, opt);
  const seed = opt.seed ?? Date.now();
  const ask = { name: who.name, projects: who.projects, agents: who.agents.map((a) => a.name), tasks: who.tasks, only: opt.only, onlyDepth: opt.depth | 0, pursuer: opt.pursuer, count: opt.count, depths: opt.depths };
  // what the office says is still to be found down here is hidden in this visit; no office keeping count, nothing hidden
  // (and nothing in a tape that is being played back: what was to be found in that building was found, or was not)
  const left = opt.replay ? null : lootLeft(office);
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
  let settings = cleanBackroomsSettings({ ...saved, vhs: opt.vhs ?? saved.vhs, mute: opt.mute ?? saved.mute });
  const camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 0.06, 170);
  const vhs = createVhs(renderer, camera, { bloom: stage.quality?.fx !== false, level: settings.vhs });
  const sound = createSound(first, settings);
  const hud = createHud(first);
  hud.setClean(vhs.level === 0);
  // the picture says REC once you are on your feet — unless this is a tape being played back: that one goes on saying PLAY
  const rec = () => { if (!opt.replay) hud.recording(); };
  document.activeElement?.blur?.();
  const purse = left ? createLoot(office, { hud, sound }) : null;
  // borrowed if they will load; the rooms that wanted them make do if not
  const Avatar = (await import('../avatar/rig.js').catch(() => null))?.Avatar || null;
  const layout = await import('/core/layout.mjs').catch(() => null);

  // 'loading' → 'falling' → 'play' → (['held' →] 'drop' → 'play')… → 'ending' (or, by the way out, 'through') → 'done'
  //   held: somebody got to a way down before the part under it was built — the tape struggles until it is
  //   drop: between two parts of the building, falling, with both of them in the picture
  let state = 'loading', cur = null, time = 0, since = 0, ending = 0, reason = null, resolveVisit = null;
  const tally = createTally({ seed, of: plan.depths });     // what the visit came to, for the card at the end (tally.js)
  let ahead = null;                                       // the part below, being built or built: { index, f, failed }
  let above = null;                                       // the part just left, still hanging over you: { f, until }
  let hold = false, landed = -1, heldAt = null;           // a room has the controls (a chute) · seconds since you came down in a new part · where you went over, while held
  let going = null;
  let out = null;                                         // by the way out: where the camera was when the wall gave, and which way is out
  let pictureKey = '', currentUse = null, light = 0.3, torch = 0, interference = 0, redWash = 0, pendingQuit = false, kept = { card: false, coins: [], batteries: 0 };
  let inventory = null, survival = null, menu = null, paused = false, gaveUp = false;
  const canAct = () => !paused && state === 'play' && !hold && !going;
  // A real fall and a chute consume recording time. Waiting for a part to
  // build does not; neither do arrival static or the final leaving picture.
  const clocksRun = () => !paused && (state === 'play' || state === 'drop');
  const u = vhs.uniforms, blank = new THREE.Scene();
  // everything that is built hangs in this: the part you are in at the origin, the part below it under its way down
  const root = new THREE.Scene();
  root.background = new THREE.Color(0x000000);
  u.uSnow.value = 1;

  /* ---- the screen is ours from here ---------------------------------------------- */
  const render = (dt) => {
    if (state === 'done') return;
    const p = vhs.layout(stage.size.w, stage.size.h), key = `${p.x},${p.y},${p.w},${p.h}`;
    if (key !== pictureKey) { pictureKey = key; hud.layout(p); }
    vhs.render(paused ? 0 : dt);
  };
  stage.setView({ scene: blank, camera, render });

  /* ---- hands ----------------------------------------------------------------------- */
  const useIt = () => { if (canAct() && !inventory?.isOpen && currentUse) { const use = currentUse; try { use.use(use); } catch (err) { console.warn('[backrooms] use', err); } } };
  const input = createInput({ canvas, stage, hud, sound,
    owns: target => !!menu?.owns(target) || (!paused && !!inventory?.owns(target)),
    interceptKey: event => paused ? !!menu?.handleKey(event) : !!inventory?.handleKey(event),
    blocked: () => paused || !!inventory?.isOpen,
    menu: () => setPaused(true), use: useIt, click: () => {}, wheel: () => {},
    key(k) {
      if (k === 'v') setPicture((vhs.level + 2) % 3);
      else if (k === 'm') changeSetting('mute', !sound.muted);
    } });
  input.state.sensitivity = settings.sensitivity; input.state.invertY = settings.invertY;
  menu = createMenu({ host: hud.el, settings, onRequestOpen: () => setPaused(true), onResume: resume,
    onGiveUp() { gaveUp = true; finish('quit'); }, onChange: changeSetting });
  // Six pockets, four hearts, and a camcorder battery that runs down (inventory.js, survival.js): the visit's, not any
  // one part's. `opt.inventory === false` for a visit without them, as it was before there were any.
  if (opt.inventory !== false) {
    survival = createSurvival({ hud, sound, interfere(k) { interference = Math.max(interference, k); } }, {
      canAct, onEnd: why => finish(why),
    });
    inventory = createInventory({ hud, sound, health: survival.health, camera: survival.camera }, {
      canAct, review: !!opt.dev?.supplies,
      onOpen(open) {
        input.clear();
        if (cur?.player) cur.player.me.vx = cur.player.me.vz = 0;
        if (open) input.release();
      },
    });
  }
  function changeSetting(key, value) {
    if (!Object.hasOwn(BACKROOMS_DEFAULTS, key)) return;
    settings = cleanBackroomsSettings({ ...settings, [key]: value });
    sound.setMute(settings.mute); sound.setMusicVolume(settings.musicVolume); sound.setSfxVolume(settings.sfxVolume);
    input.state.sensitivity = settings.sensitivity; input.state.invertY = settings.invertY;
    if (vhs.level !== settings.vhs) {
      const lv = settings.vhs;
      vhs.setLevel(lv); hud.setClean(lv === 0);
      if (cur?.player) cur.player.me.shake = lv === 2 ? 1 : lv === 1 ? 0.5 : 0.25;
      pictureKey = '';
    }
    prefs.save(settings); menu?.update(settings);
  }
  function setPicture(lv) { changeSetting('vhs', lv); }
  function setPaused(on) {
    if (on && (state === 'done' || state === 'ending' || state === 'through' || pendingQuit)) return;
    paused = !!on;
    if (paused) inventory?.close();
    input.clear();
    if (cur?.player) cur.player.me.vx = cur.player.me.vz = 0;
    // A menu pauses both live parts of the building, not just the player's hands.
    // The bag still behaves as before: it never pauses the run.
    menu?.setOpen(paused); hud.setPaused(paused); sound.setPaused(paused);
    if (inventory) inventory.view.el.inert = paused || !canAct();
    if (paused) {
      input.release(); hud.hint(false);
      cur?.env.handView?.update(0, false);
    }
  }
  function resume() {
    setPaused(false);
    input.capture();
  }

  /* ---- a floor: everything that is built for it and thrown away with it ---------------- */
  const halfFov = () => Math.atan(Math.tan((FOV * Math.PI) / 360) * camera.aspect);
  async function build(level, carry, pace) {
    const kit = createKit();
    const f = { level, kit, world: null, player: null, env: null };
    const env = f.env = {
      level, cast, who, kit, sound, hud, vhs, renderer, builders: await buildersFor(level), catalogue: await loadCatalogue(kit), Avatar, layout,
      plan: office.net?.state?.world?.plan || {}, visit: plan, carry,
      where: cleanWhere(opt.where),             // a place name the page was told (the site's host says a city): the banner's second line, and nothing else's
      player: null, world: null, pursuer: null,
      hatches: new Map(),                       // room id → { drop() }: where a door in a floor lets you out
      /** The visit is over. how: { nx, nz } — the way out through the wall that gave (thin.js), for an 'exit'. */
      end: (why, how) => { if (cur === f && canAct()) finish(why, how); },
      /** Somebody has gone over an edge they cannot come back from: on down into the next part. at: { x, z } where, in this part's world. */
      descend: (at) => cur === f && descend(false, at || {}),
      /** A room is carrying somebody (a chute): their hands are off the controls until it lets go. */
      hold: (on) => { if (cur === f) hold = !!on; },
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
    if (survival) {
      // Two parts can be alive at a seam. Old or prebuilt room callbacks
      // may read the visit's resources, but only the current part can act.
      const available = () => cur === f && canAct();
      const deniedHealth = () => ({ ok: false, reason: 'unavailable', dead: survival.health.read().dead, health: survival.health.read() });
      env.health = {
        read: survival.health.read,
        damage: amount => available() ? survival.health.damage(amount) : deniedHealth(),
        heal: amount => available() ? survival.health.heal(amount) : deniedHealth(),
      };
      env.camera = {
        read: survival.camera.read,
        recharge: seconds => available() ? survival.camera.recharge(seconds) : { ok: false, reason: 'unavailable' },
        /** Something down here takes a share (0…1) of the charge that is left (the cast's c.drain). */
        drain: share => available() ? survival.camera.drain(share) : { ok: false, reason: 'unavailable' },
      };
    }
    /** What creatures tell the visit, for the card at the end: this one was met; this one was got away from. */
    env.run = { met: (id) => tally.met(id), survived: (id) => tally.survived(id) };
    createStalkers(env);
    // the residents of rooms (denizens.js), and the visitor's hand as they ask after it; the picture washed red (0…1) by a room that does that
    createHand(env); createHandView(env, camera); createDenizens(env);
    // the banner an office park puts up about itself, near where a visit lands (banner.js): once the part is built
    if ((level.depth | 0) === 0) (env.ready || (env.ready = [])).push(() => { try { hangBanner(env); } catch (err) { console.warn('[backrooms] the banner would not hang', err); } });
    env.red = (k) => { redWash = Math.max(redWash, k); };
    env.loot = purse;
    purse?.hang(env);
    let breath = performance.now();                       // build as fast as the machine allows, but keep the static moving
    f.world = env.world = await buildWorld(kit, level, env, pace || (async () => { if (performance.now() - breath > 40) { await frame(); breath = performance.now(); } }));
    inventory?.hang(env);
    return f;
  }
  /** The part below this one, built while somebody is still finding their way to it: a room, then a breath, then a room. */
  function prepare() {
    if (ahead || !cur || state === 'done') return;
    const index = cur.level.depth + 1, over = cur;
    if (index >= plan.depths) return;
    const mine = ahead = { index, f: null, failed: false };
    const pace = async () => { await frame(); await frame(); await frame(); };
    (async () => {
      try {
        const f = await build(floor(index), null, pace);
        if (ahead !== mine || state === 'done') { letGo(f); return; }
        // hung where it will be landed in: under this part's way down
        const at = hangBelow(over.level, f.level);
        f.world.scene.position.set(at.x, at.y, at.z);
        f.world.scene.visible = false;
        f.world.glimpse(f.level.start.x, f.level.start.z, 15);
        root.add(f.world.scene);
        mine.f = f;
      } catch (err) { console.error('[backrooms] the part below would not build', err); mine.failed = true; }
    })();
  }
  function letGo(f) {
    if (!f) return;
    if (f.player) tally.part(f.world);                    // (a part somebody was in is counted as it goes: after this it is gone)
    inventory?.forget(f.env);
    f.env.pursuer?.dispose?.();
    f.env.denizens?.dispose?.(); f.env.handView?.dispose?.();
    f.world?.scene.removeFromParent();
    f.world?.dispose(); f.kit.dispose();
  }
  /**
   * You are in this part now. The first time: somewhere under a hole in its ceiling, out of the static. After that
   * (`from`: the body you had in the part above, already in this part's coordinates): exactly where you were, and falling.
   */
  function land(f, from) {
    // Arrival callbacks belong to a fall already, before they see a player.
    // They cannot hurt it or overwrite an ending during the handover.
    state = from ? 'drop' : 'falling';
    currentUse = null; since = 0; hold = false; landed = -1;
    cur = f;
    purse?.attend(f.env);
    tally.at(f.level.depth);                              // how far down somebody has got
    if (!f.world.scene.parent) root.add(f.world.scene);
    f.world.scene.position.set(0, 0, 0); f.world.scene.visible = true;
    const player = f.player = f.env.player = createPlayer(f.world, camera, from || f.level.start, input.state);
    inventory?.attend(f.env);
    const me = player.me;
    me.shake = vhs.level === 2 ? 1 : vhs.level === 1 ? 0.5 : 0.25;
    if (from) { me.pitch = from.pitch; me.drop = Math.max(0.01, from.y - (f.world.floorY(me.x, me.z) + player.EYE)); me.dropV = Math.min(from.dropV, -0.4); }
    else me.drop = 1.3;
    player.on('step', () => sound.play(f.world.current()?.footstep || 'step'));
    for (const fn of f.env.ready || []) fn();
    f.world.enter(f.world.roomAt(me.x, me.z) || f.world.rooms[f.level.start.room]);
    vhs.setScene(root);
    if (f.level !== first) hud.setStamp(f.level.stamp);
    sound.setMains(f.level.hum);
  }
  /**
   * Over the edge. If the part below is there (it nearly always is: it has been building since you landed in this
   * one), nothing is cut: which part is "here" changes under you, and you carry on falling. If it is not, you are
   * held where you are, under static, until it is.
   */
  function descend(force, at) {
    if (paused || (state !== 'play' && state !== 'held') || !cur) return false;
    if (cur.level.depth >= plan.depths - 1 || (!force && !goesDown(cur.level.exit.way))) return false;
    inventory?.close();
    if (!ahead) prepare();
    if (ahead.failed) { reason = 'quit'; conclude(); return false; }
    if (!ahead.f) { if (state !== 'held') { state = 'held'; since = 0; hud.hint(false); sound.play('static', { dur: 1.1 }); } heldAt = at || null; return true; }
    going = { at };                                       // (at the top of the next frame: this one is half way through the part being left)
    return true;
  }
  function handover(at) {
    const old = cur, f = ahead.f, me = old.player.me, o = f.world.scene.position.clone();
    ahead = null;
    f.env.carry = old.env.pursuer?.carry?.() || null;
    // the same body, in the coordinates of the part below — and never more than a stride from the middle of the hole it comes down through
    const st = f.level.start;
    let x = me.x - o.x, z = me.z - o.z;
    if (!at) { x = st.x; z = st.z; }                       // (from wherever you stood: the dev page's descend)
    const off = Math.hypot(x - st.x, z - st.z);
    if (off > 0.55) { x = st.x + ((x - st.x) / off) * 0.55; z = st.z + ((z - st.z) / off) * 0.55; }
    const from = { x, z, yaw: me.yaw, pitch: me.pitch, y: (at ? camera.position.y : old.world.floorY(me.x, me.z) + old.player.EYE) - o.y, dropV: me.dropV || 0 };
    // what was here is up there now, for as long as it can still be seen
    old.world.scene.position.set(x - me.x, -o.y, z - me.z);
    if (above) letGo(above.f);
    above = { f: old, until: time + 6 };
    tally.way();
    hud.hint(false);
    land(f, from);
    interference = Math.max(interference, 0.7);
  }

  /* ---- the loop ---------------------------------------------------------------------- */
  // how long each ending takes — and one nobody has told this file about takes as long as being caught
  const END = { quit: 0.4, caught: 1.8, exit: 1.4, battery: 1.2 };
  const off = stage.onFrame((dt) => {
    if (state === 'loading' || state === 'done' || paused) return;
    time += dt; since += dt;
    tally.tick(dt, state === 'play');
    hud.update(dt);
    interference *= Math.exp(-4 * dt);
    u.uTrack.value = interference;
    if (interference > 0.5) hud.glitch(0.3);
    if (!cur) { u.uSnow.value = 1; return; }                  // before the first part is up: nothing but snow
    if (going && ahead?.f && (state === 'play' || state === 'held')) { const g = going; going = null; handover(g.at); }
    if (above && (time > above.until || (landed > 1.2 && state === 'play'))) { letGo(above.f); above = null; }
    survival?.update(dt, clocksRun());
    const { world, player, env } = cur, me = player.me;
    me.frozen = state !== 'play' || hold;
    player.update(dt, time);
    me.slow = 1; me.sinkTo = 0;                              // rooms that slow you or make you stoop say so every frame
    world.update(dt, time, me);
    if (state !== 'held' && state !== 'drop') { env.pursuer?.update(dt, time); env.denizens?.update(dt, time); }          // (nothing gets you while the building has you)
    redWash *= Math.exp(-3.2 * dt); u.uRed.value = clamp(redWash, 0, 1);
    // the part below: begun once you have found your feet in this one, and only drawn from where it could be seen
    if (state === 'play' && !ahead && since > 4 && goesDown(cur.level.exit.way)) prepare();
    if (ahead?.f) { const at = world.current(); ahead.f.world.scene.visible = !!at && (at.def.toExit ?? 9) <= 1; }
    if (env.below) for (const m of env.below) m.visible = !ahead?.f;          // (the stand-in at the bottom of a drop, until the real rooms are there)
    if (landed >= 0) landed += dt;
    purse?.update(dt, time, state === 'play');
    inventory?.update(dt, clocksRun());
    env.handView?.update(dt, canAct() && !inventory?.isOpen);          // (what is in the selected pocket, in the corner of the picture)
    currentUse = canAct() && !inventory?.isOpen ? world.usable(me) : null;
    hud.hint(!!currentUse);                               // (only ever the [E]: what a thing is, is for looking at it to say)

    // the camcorder copes with the dark: more gain (and more noise), then its little lamp
    const here = world.current();
    const lvl = here ? here.level * here.u.dim.value : 0.3;
    light += (lvl - light) * (1 - Math.exp(-2.2 * dt));
    u.uGain.value = clamp(Math.pow(0.3 / Math.max(light, 0.04), 0.55), 0.9, 2.3);
    // …which with pockets is a weak one, enough not to walk into the furniture: a torch in the hand is the light, and
    // it works wherever its owner switches it on
    const lamp = light < 0.11 && !here?.noTorch ? 1 : 0;
    const wantTorch = inventory ? Math.max(inventory.torchPower(), lamp * OWN_LAMP) : Math.max(lamp, env.hand?.hasFlashlight?.() ? 1 : 0);          // (no pockets: a torch in the hand is simply on)
    torch += (wantTorch - torch) * (1 - Math.exp(-3 * dt));
    cur.kit.shared.uTorch.value = torch * 1.5;
    hud.flag('LIGHT', torch > 0.5);
    sound.setHum(light / 0.3);
    if (here?.flickers.length && here.flickerNow < 0.5 && Math.random() < 0.3) sound.play('tick', { vol: 0.7 });

    if (state === 'falling') {
      u.uSnow.value = Math.max(0, u.uSnow.value - dt / 0.8);
      if (since > 1.25) { state = 'play'; rec(); }
    } else if (state === 'held') {
      // the part below is not built yet: the tape cannot make anything of where you are until it is
      u.uSnow.value = Math.min(0.92, since / 0.5);
      interference = 1;
      if (ahead?.failed) { reason = 'quit'; conclude(); }
      else if (ahead?.f) { u.uSnow.value = 0.5; going = { at: heldAt }; }
    } else if (state === 'drop') {
      // between two parts of the building, with both of them in the picture; then carpet
      if (u.uSnow.value > 0) u.uSnow.value = Math.max(0, u.uSnow.value - dt / 0.5);
      if (landed < 0 && me.drop <= 0.02 && me.dropV >= 0) {
        landed = 0;
        sound.play('thunk'); sound.play('static', { dur: 0.5, vol: 0.6 });
        interference = 1; u.uSnow.value = Math.max(u.uSnow.value, 0.4); hud.glitch(0.6);
      }
      if (landed > 0.45) { state = 'play'; since = 0; rec(); }
    } else if (state === 'ending') {
      ending += dt;
      const k = clamp(ending / (END[reason] ?? END.caught), 0, 1);
      if (reason === 'quit' || reason === 'battery') u.uBlack.value = k;
      else if (reason === 'exit') u.uWhite.value = k * k;
      else { u.uSnow.value = clamp((k - 0.42) / 0.45, 0, 1); if (k > 0.45) u.uRoll.value += dt * (0.4 + k * 2.5); interference = Math.max(interference, 0.5 + 0.5 * k); }   // a look at what got you, then snow
      if (k >= 1) conclude();
    } else if (state === 'through') {
      // out through the wall, and a look back at the floor you were lost on (leaving.js). From out here nothing is in
      // the way of any of it: every room is drawn, for the one time in the visit
      const p = leaving(since, out);
      if (p.outside && !out.shown) { out.shown = true; for (const rt of world.rooms) rt.group.visible = true; }
      camera.position.set(p.x, p.y, p.z);
      camera.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
      u.uWhite.value = p.white; u.uSnow.value = p.snow;
      interference = Math.max(interference, p.track);
      sound.setHum(Math.max(0, 1 - since / 1.2));
      sound.air?.(Math.min(1, since / 0.8) * (1 - p.white));
      if (p.over) conclude();
    }
  });

  function conclude() {
    if (state === 'done') return;
    state = 'done';
    off();
    menu?.dispose();
    inventory?.dispose();
    survival?.dispose();
    input.dispose();
    hud.remove(); sound.stop();
    // (how much of them is left, if there is such a thing as health down here this visit: the cast's business)
    const h = cur?.env.health?.read?.(), hearts = h ? { left: h.left ?? h.current, of: h.of ?? h.max } : null;
    letGo(cur); cur = null;
    if (above) { letGo(above.f); above = null; }
    if (ahead?.f) letGo(ahead.f);
    ahead = null;
    vhs.dispose();
    renderer.setRenderTarget(null);
    if (opt.debug) delete window.__backrooms;
    // Everything of the visit's is gone from the page. What it came to is written up on a card (scorecard.js), however
    // it ended and whoever started it, and the visit is over when the card has been put down.
    const why = reason || 'quit', run = tally.report(hearts), done = (card) => resolveVisit({ reason: why, kept, run, card });
    // (what whoever plays this tape back will need to be given the same building: was the mascot in it, and which make
    // of the place was it — plan.js. Only a visit that got out has a tape to say it on.)
    if (why === 'exit') { run.mascot = plan.mascot !== null; try { run.edition = edition(); } catch { /* the tape does not say */ } }
    // (no card for a visit that was told not to show one, or that was stopped before it had really begun)
    if (opt.scorecard === false || (!gaveUp && why === 'quit' && run.seconds < 2)) { done(null); return; }
    import('./scorecard.js').then((m) => m.showScorecard({ office, reason: why, kept, run, name: who.name, brand: opt.brand, share: opt.share, also: opt.also, home: opt.home }))
      .then(done, (err) => { console.warn('[backrooms] the card would not come up', err); done(null); });
  }
  function finish(why, how) {
    if (state === 'done' || state === 'ending' || state === 'through' || pendingQuit) return;
    reason = why; ending = 0;
    setPaused(false);
    if (menu) menu.el.hidden = true;
    inventory?.close();
    hud.hint(false);
    // carried is only kept by leaving by the way out: the card and the tapes (loot.js), and the spare battery packs in
    // your pockets, which are what the office pays for (core/game.mjs)
    if (why === 'exit') kept = { ...kept, ...purse?.bank(), batteries: inventory?.count('battery') ?? 0 };
    if (why === 'caught') sound.play('static', { dur: 1.3 });
    if (why === 'battery') { hud.flag('BATTERY', true); sound.play('static', { dur: .25, vol: .4 }); }
    if (state === 'loading' || !cur) pendingQuit = true;
    else if (why === 'exit' && how && cur.player) {
      const me = cur.player.me;
      // of the floor being left: what there is to look back at — all of it if it lies behind you, and if the wall faces
      // back over the plan, the part of it that does
      const back = (r) => ((r.cx ?? r.x + r.w / 2) - me.x) * how.nx + ((r.cz ?? r.z + r.d / 2) - me.z) * how.nz;
      let mid = middle(cur.level.rooms);
      if (back(mid) > -THIN_BEHIND) { const part = cur.level.rooms.filter((r) => back(r) < -3); if (part.length) mid = middle(part); }
      out = { x: me.x, y: camera.position.y, z: me.z, yaw: me.yaw, pitch: me.pitch, nx: how.nx, nz: how.nz, cx: mid.x, cz: mid.z, shown: false };
      state = 'through'; since = 0;
    } else state = 'ending';
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
    get state() { return state; }, get paused() { return paused; }, menu, loot: purse, inventory, health: survival?.health, camera: survival?.camera, survival,
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
    /** On down into the next part now, wherever you are standing. */
    descend: () => descend(true, null),
    /** The part below, if it is built yet (and where it hangs). */
    get ahead() { return ahead?.f ? { level: ahead.f.level, world: ahead.f.world, env: ahead.f.env, at: ahead.f.world.scene.position } : null; },
    root,
    finish: (why) => finish(why),
  };
  if (opt.debug) window.__backrooms = handle;
  opt.onReady?.(handle);
  return visitOver;
}
