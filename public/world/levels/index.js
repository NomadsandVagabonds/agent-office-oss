// The Office — the lift, and the floors it goes to.
//
// A LEVEL is an ES module that exports
//
//     enter(office, opt) → Promise<{ reason, to? }>
//
// It is handed the whole office (window.office), takes the screen with
// office.stage.setView({ scene, camera }), and resolves when the person leaves:
// { reason: 'esc' } to go home, { reason: 'lift', to: 'roof' } to ride on to
// another floor, or anything of its own. kit.js does nearly all of that for a
// level that wants a place to walk around in; a level may equally be a single
// full-screen game that never touches the kit.
//
// To add one: give it a line in core/levels.mjs (id, the letter on its
// button, a name, a blurb) and a line in MODULES below. That is all the lift
// needs to know.
import { HOME, findLevel, isVisible, levelById, levelContext, visibleLevels } from '/core/levels.mjs';
import { curtain } from './curtain.js';
import { playRide } from './ride.js';

/** Where each floor's module lives; loaded the first time somebody rides there. */
const MODULES = {
  roof: () => import('./roof.js'),
  mission: () => import('./mission.js'),
  pasture: () => import('./pasture.js'),
  arcade: () => import('./arcade.js'),
};
// Two floors are not modules of ours: 'lobby' is the office you are already in,
// and 'thirteen' hands over to whatever office.onNoclip() opens (see eggs.js).

const state = { floor: HOME, riding: false };
/** Which floor the person is on, and whether the car is moving: { floor, riding }. */
export const lift = state;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toast = (office, text) => office.ui?.toast?.(text);          // only for when something did not work; a ride explains itself
const sfx = (office, name) => { try { return office.sound?.play?.(name) ?? null; } catch { return null; } };
const context = (office) => levelContext(office.net?.state?.world);

async function ready(office) {
  for (let i = 0; i < 150 && !(office.ready && office.world); i++) await sleep(100);
  return !!office.world;
}

/** Press the call button on the landing: the doors open, the floor panel comes up, and off you go. */
export async function callLift(office) {
  if (state.riding) return null;
  office.fx?.lift?.(10 * 60 * 1000);                       // the doors stand open while you choose
  sfx(office, 'lift-doors');
  const { openFloorPanel } = await import('../ui/elevator.js');
  const picked = await openFloorPanel(office, { current: HOME });
  if (!picked || picked.id === HOME) { office.fx?.lift?.(500); return null; }
  return ride(office, picked.id);
}

/**
 * Take the lift to a floor, stay until the person leaves it, and bring them
 * home: back on the landing, in walk mode.
 *
 * @param {object} office
 * @param {string} ref  a level's id, or what is written on its button ('roof', 'R')
 * @param {{instant?:boolean, pace?:number}} [opt]  instant: no ride on the way there (deep links, screenshots)
 * @returns {Promise<object|null>}  what the last level said as you left
 */
export async function ride(office, ref, opt = {}) {
  const first = findLevel(ref);
  if (state.riding) return null;
  if (!(await ready(office))) return null;
  if (!first || !isVisible(first, context(office))) { toast(office, `The lift has no button for “${ref}”.`); return null; }
  if (first.id === HOME) return null;

  state.riding = true;
  document.body.classList.add('level');
  office.ui?.closeSheet?.();
  office.ui?.select?.(null);
  office.walk?.exit?.();
  let from = levelById(HOME), next = first, last = { reason: 'exit' }, instant = !!opt.instant;
  try {
    while (next && next.id !== HOME) {
      if (next.id === 'thirteen') return await thirteen(office, from, opt);
      const loading = (MODULES[next.id] ? MODULES[next.id]() : Promise.resolve(null)).catch((err) => { console.error(`[lift] ${next.id} would not load`, err); return null; });
      if (instant) await curtain.close(120);
      else await playRide(office, { from, to: next, floors: visibleLevels(context(office)), until: loading, pace: opt.pace });
      const mod = await loading;
      state.floor = next.id;
      last = await visit(office, mod, next, { from: from.id });
      from = next; instant = false;
      const onward = last.reason === 'lift' ? findLevel(last.to) : null;
      next = onward && isVisible(onward, context(office)) ? onward : levelById(HOME);
    }
    if (last.reason !== 'missing') await playRide(office, { from, to: levelById(HOME), floors: visibleLevels(context(office)), pace: (opt.pace || 1) * (last.reason === 'lift' ? 1 : 0.6) });
  } catch (err) {
    console.error('[lift]', err);
    last = { reason: 'error', error: err };
  }
  return home(office, last);
}

/** One floor: call its enter(), lift the curtain when it has the screen, and take the screen back afterwards. */
async function visit(office, mod, level, opt) {
  if (typeof mod?.enter !== 'function') return { reason: 'missing', level: level.id };
  let watching = true;
  const stop = office.stage.onFrame(() => { if (watching && office.stage.view) { unwatch(); curtain.open(380); } });
  const unwatch = () => { if (watching) { watching = false; stop(); } };
  let result = null;
  try { result = await mod.enter(office, { level, ...opt }); } catch (err) { console.error(`[lift] ${level.id}`, err); result = { reason: 'error', error: err }; }
  unwatch();
  await curtain.close(0);
  office.stage.setView(null);
  return result && typeof result === 'object' ? result : { reason: 'exit' };
}

/** Back in the office: on the landing, in walk mode — or straight to whoever needs you, if that is why you left. */
function home(office, last = {}) {
  office.stage.setView(null);
  document.body.classList.remove('level');
  state.floor = HOME; state.riding = false;
  const spot = office.world?.layout.spots.landing || { x: 0, z: -7.3 };
  // a level may send you somewhere in particular: { reason: 'goto', agent } or { reason: 'goto', room }
  const agent = last.reason === 'goto' && office.net.state.agents.has(last.agent) ? last.agent : null;
  const room = last.reason === 'goto' && office.world?.layout.roomById.has(last.room) ? last.room : null;
  if (office.ui && (last.reason === 'needs' || agent || room)) {
    office.rig.flyTo({ x: spot.x, z: spot.z + 3, dist: 16, yaw: 0, pitch: 0.8 }, { instant: true });
    if (agent) office.ui.focusNeed(agent); else if (room) office.ui.gotoRoom(room); else office.ui.nextNeed();
  } else {
    office.rig.flyTo({ x: spot.x, z: spot.z, dist: 9, yaw: 0, pitch: 0.62 }, { instant: true });
    office.walk?.enter?.();
    if (office.walk?.state) office.walk.state.heading = 0;                // facing the room, the doors behind you
    if (last.reason === 'missing') toast(office, 'That floor is not built yet. The lift has brought you back.');
    else if (last.reason === 'error') toast(office, 'Something on that floor went wrong (the console has the details). The lift has brought you back.');
  }
  office.fx?.lift?.(2400);
  curtain.open(380);
  return last;
}

/** The button that should not be there. The ride is not quite right, and what is behind the doors is not ours to say. */
async function thirteen(office, from, opt) {
  const level = levelById('thirteen');
  const world = office.net.state.world;
  if (world?.today?.quirks?.includes('friday-13')) {
    office.net.api('/api/world/discover', { method: 'POST', body: { secret: 'thirteenth', name: office.walk?.me?.name || 'Lead' } }).catch(() => null);
  }
  await playRide(office, { from, to: level, floors: visibleLevels(context(office)), glitch: true, pace: opt.pace });
  office.stage.setView(null);
  document.body.classList.remove('level');
  state.floor = HOME; state.riding = false;
  curtain.open(200);
  try { await office.onNoclip?.(); } catch (err) { console.error('[lift] 13', err); }
  if (office.walk?.active) return { reason: 'thirteen' };            // the level below took you, and has put you back
  return home(office, { reason: 'thirteen' });                       // nothing was there: the lift simply brings you home
}
