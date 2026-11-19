// The Backrooms, without the office: a stage, a made-up office to borrow names
// from, and straight into the level.
//   /world/dev/backrooms.html?seed=7            a whole visit: three to five parts of one building, the way out in the last
//   &depth=2           begin in that part (0 is where you land)    &depths=3   how many parts this visit has
//   &room=party        start inside one archetype (any id from the deck; also: exit, start, plain, or a room number)
//   &x=0&z=2&yaw=0.6&pitch=-0.1   where to stand in that room's own frame (z = depth/2 is the door you came in by; yaw 0 looks in)
//   &only=a,b          deal these archetypes into the visit      &count=6    how many oddities
//   &themes=night,exec what kind of floor each part is, top down (themes.js; the rest are as the seed has them). The only
//                      way onto a kind that is still being built (`dealt: false`), which is in nobody's visit
//   &vhs=0|1|2         clean · steady · full camcorder           &mute=1
//   &graphics=classic|low|medium|high|auto   the Graphics setting (graphics.js), over the saved one
//   &barricades=0      without furniture that can be dragged (it is on unless turned off); &study=1 puts a review set by the landing (seed=7)
//   &lighting=1        fluorescent-bank prototype (off by default); &lighting=dim|failing|travel|emergency|islands forces that treatment in eligible plain rooms
//   &hallstudy=1       rehearsal controls for the last-light room (use &only=last-light)
//   &lightstudy=1      comparison controls and a flashlight for reviewing the prototype
//   &pursuer=1|0       force the thing that follows you in or out; &wake=1 has it already awake, in the room with you
//   &beside=<id>       put you a step and a half from that one of the cast, facing it (docs/BACKROOMS.md: putting a creature next to you)
//   &cast=intern,mother   exactly these of the cast on every part, whatever the seed dealt (cast.js has the ids): for looking at them
//   &name=Robin        who you are                               &live=1     borrow names from the running office (GET only)
//   &where=Portland    the place on the banner near the landing (banner.js); without it, what such banners say
//   &list=1            print the deck with links                 &map=1      show the floor plan
//   &card=0            skip the end-of-visit scorecard for automated checks (normal play shows it, just like the public game)
//   &inventory=0       without pockets, hearts or the camcorder's battery running down (they are on unless turned off)
//   &supplies=1        one of everything that can be carried, on the floor where you land (for looking at them: a visit has only what its seed left lying about)
//   &check=1           once the floor is up, one line on the console that a script can read — `[check] {…}`: for every oddity on it, how
//                      long it took to build, what it put down (meshes, triangles, solids, lights…), and everything the level warned about
//   &perf=1            a read-out in the top right: frame times over the last 5 s, draw calls, triangles, memory, sizes, the room (perf.js)
//   &bench=1           the read-out and a fixed tour of the floor you land on; at the end `[bench] {…}` on the console and the title
//                      `bench done` (tools/backrooms-bench.mjs runs it for three seeds; docs/BACKROOMS-GRAPHICS.md, phase 0)
//   &stress=4          with &perf=1 or &bench=1: the level's scene drawn 4 times a frame (1…32), same picture, to measure a machine
//                      past its display's refresh rate; &stress=auto with &bench=1 steps it up at the first station first (perf.js)
//   &preview=clip      a preview, in the rooms that have one: things half inside the structure in phone, nested and cover
//                      (clipping.js, docs/BLOCKROOMS-PREVIEWS.md). Nothing in the game reads it
//   &preview=corners   doorways in the corners of rooms; &preview=hallways corridors that are not rectangles; comma'd with others
//                      (preview.js). The floor is changed after it is generated: nothing else moves
//   &preview=floorlight   a preview: the tubes let into the floor shining up, the ceiling dark, in party and museum
//                      (floorlight.js, docs/BLOCKROOMS-PREVIEWS.md). Several at once: Both at once: &preview=clip,floorlightpreview=clip,floorlight
//   &loot=1            something to find: the keycard (in the mascot's hand) and coins 1–4; &loot=card,1,3 for some of it. There is no
//                      office here to keep count, so a stand-in does, in this page's memory, and says so on the console: what you leave
//                      by the door with is gone the next visit (any key), everything else is down there again. Without it: no loot.
// window.__backrooms is the live handle, always of the floor you are on: goto(room, x, z, yaw, pitch), where(), level, world,
// player, env (env.pursuer.at()), plan() (the whole visit), descend() (on down into the next part, from wherever you stand),
// ahead (the part below, once it is built: level, world, and where it hangs), root (the one scene everything hangs in),
// loot (loot.report(): where the coins are, what is carried). window.__loot is what the stand-in still has down there.
// Nothing on screen says how to play, on purpose: WASD/arrows, mouse, Shift (hurry), Space (hop), C (crouch, held), E, V (picture), M (sound), Esc.
import { openStage } from '../engine/stage.js';
import { pageRendererChoice } from '../engine/gpu.js';
import { enterBackrooms } from '../backrooms/index.js';
import { LIGHTING_MODES } from '../backrooms/lighting.js';
import { lightingStudy } from './lighting-study.js';
import { lastLightStudy } from './last-light-study.js';
import { bridgeStudy } from './bridge-study.js';
import { tonerStudy } from './toner-study.js';
import { partyStudy } from './party-study.js';
import { roomCost } from '../backrooms/budget.js';
import { waterparkStudy } from './waterpark-study.js';
import { returnPoolStudy } from './return-pool-study.js';
import { bellmouthStudy } from './bellmouth-study.js';
import { changingStudy } from './hanging-changing-study.js';
import { poolFinishStudy } from './pool-finish-study.js';
import { channelStudy } from './channel-study.js';
import { showerStudy } from './shower-study.js';
import { diveStudy } from './dive-study.js';

// &check=1: listen from the start, so that nothing said while the floor was being built is missed
const said = [];
if (new URLSearchParams(location.search).get('check')) {
  const warn = console.warn.bind(console);
  console.warn = (...args) => { said.push(args.map((a) => (a && a.message) || String(a)).join(' ').slice(0, 300)); warn(...args); };
}
/** What a floor's oddities cost and contain, for whoever is checking a room they wrote. */
function check(handle) {
  const { world, level } = handle;
  const rooms = world.rooms.filter((rt) => rt.def.kind === 'special').map((rt) => {
    // (meshes and triangles: its ordinary batches; detailMeshes and detailTriangles: what it marked as detail, which low leaves out)
    const { meshes, triangles, detailMeshes, detailTriangles } = roomCost(rt.group);
    const timing = world.timing.find(([what]) => what === `${rt.def.arch}#${rt.id}`) || [];
    return { arch: rt.def.arch, room: rt.id, size: [rt.def.W, rt.def.D, rt.def.H], buildMs: timing[1], bakeMs: timing[2], meshes, triangles, detailMeshes, detailTriangles,
      solids: rt.colliders.length, lights: rt.lights.length, uses: rt.uses.length, zones: rt.zones.length, ticks: rt.ticks.length,
      ...(rt.shadowStats ? { shadows: rt.shadowStats } : {}), ...(rt.doorStats ? { doors: rt.doorStats } : {}) };
  });
  // (the whole floor: every room's build and bake, and what its light maps hold, at the Graphics setting it was built at)
  const all = world.timing.filter(([what]) => what.includes('#'));
  const floorMs = { build: all.reduce((n, t) => n + t[1], 0), bake: all.reduce((n, t) => n + t[2], 0), worstBake: all.reduce((m, t) => Math.max(m, t[2]), 0),
    mapBytes: world.rooms.reduce((n, rt) => n + (rt.shadowStats?.bytes || 0) + (rt.doorStats?.bytes || 0), 0) };
  return { seed: String(level.seed), floor: level.depth, rooms, floorMs, said };
}
import { DECK } from '../backrooms/gen.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) && q.get(k) !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
const stage = await openStage(document.getElementById('stage'), { renderer: pageRendererChoice(), fx: q.get('fx') === '1', shadows: false, preserve: true, pixelRatio: num('dpr', 1) });
stage.start();
window.__stage = stage;              // renderer.info, for checking that a visit leaves nothing behind
// &perf=1 / &bench=1: the measuring tape, only fetched when asked for
const perf = q.get('perf') === '1' || q.get('bench') === '1' ? (await import('./perf.js')).createPerf(stage, { bench: q.get('bench') === '1', params: q }) : null;

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
  let closeStudy;
  delete window.__backroomsResult;
  over.style.display = 'none';
  const result = await enterBackrooms(office, {
    name: q.get('name') || 'Robin', seed, only: only.length ? only : undefined, count: q.has('count') ? num('count', 7) : undefined,
    depth: q.has('depth') ? num('depth', 0) : undefined, depths: q.has('depths') ? num('depths', 3) : undefined,
    themes: q.get('themes') ? q.get('themes').split(',').filter(Boolean) : undefined,
    pursuer: q.has('pursuer') ? q.get('pursuer') !== '0' : undefined, vhs: q.has('vhs') ? num('vhs', 2) : undefined, mute: q.has('mute') ? q.get('mute') !== '0' : undefined,
    graphics: q.get('graphics') || undefined,
    debug: true, scorecard: q.get('card') !== '0', home: { label: 'Return to homepage' }, where: q.get('where') || undefined,
    inventory: q.get('inventory') !== '0', barricades: q.get('barricades') !== '0',
    dev: { supplies: q.get('supplies') === '1', cast: (q.get('cast') || '').split(',').filter(Boolean), beside: q.get('beside') || null, wake: q.get('wake') === '1', barricadeStudy: q.get('barricades') === '1' && q.get('study') === '1',
      bridgeStudy: q.get('bridgestudy') === '1',
      // &gfx=contact,bounce (each at 1) or &gfx=contact:0.6,bounce:0.5: contact darkening and bounced colour, baked with each room (kit.js gfxOf);
      // &gfx=shadows: the tubes' shadows in each room's light map (shadowmap.js)
      // &gfx=fixtures: each ceiling light the sculpted fitting (ceiling.model.js), its tubes lit as the flat panel's were
      // &gfx=sheen: the tubes caught on floors that shine (sheen.rule.js)
      gfx: q.get('gfx') ? Object.fromEntries(q.get('gfx').split(',').map((s) => s.split(':')).map(([k, v]) => [k, v ? Number(v) : 1])) : null,
      lighting: ['1', ...LIGHTING_MODES].includes(q.get('lighting')) ? q.get('lighting') : false,
      // &preview=clip,corners,hallways: rooms that have a preview built into them use it (docs/BLOCKROOMS-PREVIEWS.md); nothing in the game does
      preview: (q.get('preview') || '').split(',').filter(Boolean),
      owns: target => !!target?.closest?.('[data-lighting-study]') },
    onReady(handle) {
      if (room) handle.goto(/^\d+$/.test(room) ? Number(room) : room, q.has('x') ? num('x', 0) : undefined, q.has('z') ? num('z', 0) : undefined, num('yaw', 0), num('pitch', 0));
      else if (q.has('yaw')) { handle.player.me.yaw = num('yaw', 0); handle.player.me.pitch = num('pitch', 0); }
      if (q.get('wake')) handle.env.pursuer?.wake?.(true);
      if (q.get('map')) dev.textContent = handle.sketch();
      console.log(handle.sketch());
      if (q.get('check')) console.log('[check] ' + JSON.stringify(check(handle)));
      perf?.attach(handle);
      if (q.get('divestudy') === '1') closeStudy = diveStudy(handle);
      else if (q.get('showerstudy') === '1') closeStudy = showerStudy(handle);
      else if (q.get('channelstudy') === '1') closeStudy = channelStudy(handle);
      else if (q.get('finishstudy') === '1') closeStudy = poolFinishStudy(handle);
      else if (q.get('changingstudy') === '1') closeStudy = changingStudy(handle);
      else if (q.get('bellstudy') === '1') closeStudy = bellmouthStudy(handle);
      else if (q.get('waterstudy') === '1') closeStudy = waterparkStudy(handle);
      else if (q.get('poolstudy') === '1') closeStudy = returnPoolStudy(handle);
      else if (q.get('tonerstudy') === '1') closeStudy = tonerStudy(handle);
      else if (q.get('partystudy') === '1') closeStudy = partyStudy(handle);
      else if (q.get('bridgestudy') === '1') closeStudy = bridgeStudy(handle);
      else if (q.get('hallstudy') === '1') closeStudy = lastLightStudy(handle);
      else if (q.get('lightstudy') === '1' && handle.world.hasLighting) closeStudy = lightingStudy(handle);
      document.title = 'ready';
    },
  });
  window.__backroomsResult = result;
  perf?.detach();
  closeStudy?.();
  stage.setView(null);
  document.title = `over: ${result.reason}`;
  if (result.card) { location.assign('/'); return; }
  over.style.display = 'grid';
  over.innerHTML = `<div>the level is over: <b>${result.reason}</b><br>press any key for another visit</div>`;
  window.addEventListener('keydown', () => { if (!q.has('seed')) seed = Date.now(); else seed = `${seed}+`; go(); }, { once: true });
}
go();
