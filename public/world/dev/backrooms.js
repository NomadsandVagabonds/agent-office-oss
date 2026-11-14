// The Backrooms, without the office: a stage, a made-up office to borrow names
// from, and straight into the level.
//   /world/dev/backrooms.html?seed=7            a whole visit
//   &room=party        start inside one archetype (any id from the deck; also: exit, start, plain, or a room number)
//   &x=0&z=2&yaw=0.6&pitch=-0.1   where to stand in that room's own frame (z = depth/2 is the door you came in by; yaw 0 looks in)
//   &only=a,b          deal these archetypes into the visit      &count=6    how many oddities
//   &vhs=0|1|2         clean · steady · full camcorder           &mute=1
//   &pursuer=1|0       force the thing that follows you in or out; &wake=1 has it already awake, in the room with you
//   &name=Robin        who you are                               &live=1     borrow names from the running office (GET only)
//   &list=1            print the deck with links                 &map=1      show the floor plan
//   &study=quiet       optional repeated-maze study (no oddities, pursuer or loot); leaves the normal generator alone
//   &loot=1            something to find: the keycard (in the mascot's hand) and coins 1–4; &loot=card,1,3 for some of it. There is no
//                      office here to keep count, so a stand-in does, in this page's memory, and says so on the console: what you leave
//                      by the door with is gone the next visit (any key), everything else is down there again. Without it: no loot.
// window.__backrooms is the live handle: goto(room, x, z, yaw, pitch), where(), level, world, player, env (env.pursuer.at()),
// loot (loot.report(): where the coins are, what is carried). window.__loot is what the stand-in still has down there.
// Nothing on screen says how to play, on purpose: WASD/arrows, mouse, Shift (hurry), Space (hop), C (crouch, held), E, V (picture), M (sound), Esc.
import { createStage } from '../engine/stage.js';
import { enterBackrooms } from '../backrooms/index.js';
import { DECK } from '../backrooms/gen.js';

const q = new URLSearchParams(location.search);
const studyId = q.get('study');
let studyDev;
if (studyId === 'quiet') {
  const { generateQuietStudy } = await import('../backrooms/quiet-study.js');
  const { buildQuietRoom } = await import('../backrooms/quiet-room.js');
  studyDev = { generate: generateQuietStudy, builders: { plain: buildQuietRoom } };
} else if (['underfloor', 'flood-mark', 'window-court'].includes(studyId)) {
  const { generateFeatureStudy } = await import('../backrooms/feature-study.js');
  const builders = {
    underfloor: () => import('../backrooms/underfloor.js').then(m => m.buildUnderfloor),
    'flood-mark': () => import('../backrooms/flood-mark.js').then(m => m.buildFloodMark),
    'window-court': () => import('../backrooms/window-court.js').then(m => m.buildWindowCourt),
  };
  studyDev = { generate: (seed, opt) => generateFeatureStudy(studyId, seed, opt), builders: { [studyId]: await builders[studyId]() } };
}
const num = (k, d) => (q.has(k) && q.get(k) !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const stage = createStage(document.getElementById('stage'), { fx: q.get('fx') === '1', shadows: false, preserve: true, pixelRatio: num('dpr', 1) });
stage.start();
window.__stage = stage;              // renderer.info, for checking that a visit leaves nothing behind

const look = (species, outfitColor, accessory, extra) => ({ species, outfitColor, accessory, ...extra });
const agents = [
  ['Ivory Marten', look('goblin', '#8a5a8f', 'none', { skin: '#5f8a6a', hair: 'short', outfit: 'cardigan', facial: 'mustache' })],
  ['Amber Vireo', look('human', '#3f7f9a', 'monocle', { skin: '#cd8d5e', hair: 'side', hairColor: '#9aa0ac', outfit: 'suit' })],
  ['Ember Numbat', look('robot', '#b5483f', 'none')], ['Olive Heron', look('cat', '#6f8a4a', 'glasses')],
  ['Slate Okapi', look('human', '#5a6fa8', 'headphones', { hair: 'bun', outfit: 'hoodie' })], ['Coral Tapir', look('dog', '#c9893f', 'partyhat')],
  ['Dusty Ibis', null], ['Mossy Quoll', null],
];
const office = {
  stage, creations: {},
  net: { state: {
    world: { plan: { rooms: ['Webstore', 'Mobile App', 'Api Gateway', 'Data Pipeline', 'Ml Research', 'Infra'].map((name, slot) => ({ slot, deptId: name.toLowerCase().replace(/ /g, '-'), name })) } },
    agents: new Map(agents.map(([name, character], i) => [`a${i}`, { id: `a${i}`, name, persona: `p:${name}`, profile: { character } }])),
    tasks: new Map([['webstore', [{ title: 'Cache the product catalogue' }, { title: 'Trim the Docker image' }, { title: 'Fix the flaky checkout test' }]]]),
  } },
};
if (q.has('loot')) {
  // a stand-in for office.game (public/world/game.js): the same two questions, answered from memory
  const all = /^(|1|all|true)$/.test(q.get('loot')), asked = q.get('loot').split(',');
  const left = { card: all || asked.includes('card'), coins: all ? [1, 2, 3, 4] : [1, 2, 3, 4].filter((n) => asked.includes(String(n))) };
  office.game = {
    left: (hideout) => (hideout === 'backrooms' ? { card: left.card, coins: left.coins.slice() } : { card: false, coins: [] }),
    async take(hideout, item, n) {
      const had = hideout === 'backrooms' && (item === 'card' ? left.card : left.coins.includes(n));
      if (had && item === 'card') left.card = false; else if (had) left.coins = left.coins.filter((k) => k !== n);
      console.log(`[loot] ${had ? 'kept' : 'not there to keep'}: ${item === 'card' ? 'the keycard' : `coin ${n}`} — still down there: ${JSON.stringify(left)}`);
      return { ok: true, taken: had, item, n };
    },
  };
  window.__loot = left;
  console.log(`[loot] down there: ${JSON.stringify(left)}`);
}
if (q.get('live')) {
  try {
    const [world, list] = await Promise.all([fetch('/api/world').then((r) => r.json()), fetch('/api/agents').then((r) => r.json())]);
    office.net.state.world = world;
    office.net.state.agents = new Map((Array.isArray(list) ? list : list.agents || []).map((a) => [a.id, a]));
  } catch (err) { console.warn('no live office to borrow from', err); }
}

const dev = document.getElementById('dev'), over = document.getElementById('over');
if (q.get('list')) dev.innerHTML = DECK.map((a) => `<a href="?seed=${num('seed', 7)}&room=${a.id}">${a.id}</a>  ${a.name}`).join('\n');

let seed = q.get('seed') ?? 7;
const room = q.get('room');
const only = (q.get('only') || '').split(',').filter(Boolean);
if (room && DECK.some((a) => a.id === room) && !only.includes(room)) only.unshift(room);

async function go() {
  over.style.display = 'none';
  const result = await enterBackrooms(office, {
    name: q.get('name') || 'Robin', seed, only: only.length ? only : undefined, count: q.has('count') ? num('count', 7) : undefined,
    pursuer: q.has('pursuer') ? q.get('pursuer') !== '0' : undefined, vhs: q.has('vhs') ? num('vhs', 2) : undefined, mute: q.has('mute') ? q.get('mute') !== '0' : undefined,
    debug: true,
    dev: studyDev,
    onReady(handle) {
      if (room) handle.goto(/^\d+$/.test(room) ? Number(room) : room, q.has('x') ? num('x', 0) : undefined, q.has('z') ? num('z', 0) : undefined, num('yaw', 0), num('pitch', 0));
      else if (q.has('yaw')) { handle.player.me.yaw = num('yaw', 0); handle.player.me.pitch = num('pitch', 0); }
      if (q.get('wake')) handle.env.pursuer?.wake?.(true);
      if (q.get('map')) dev.textContent = handle.sketch();
      console.log(handle.sketch());
      document.title = 'ready';
    },
  });
  stage.setView(null);
  document.title = `over: ${result.reason}`;
  over.style.display = 'grid';
  over.innerHTML = `<div>the level is over: <b>${result.reason}</b><br>press any key for another visit</div>`;
  window.addEventListener('keydown', () => { if (!q.has('seed')) seed = Date.now(); else seed = `${seed}+`; go(); }, { once: true });
}
go();
