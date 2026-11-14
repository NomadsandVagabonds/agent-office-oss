// A · After Hours — a level that is a GAME. The office at night with the build
// broken: emergency lighting, a red lamp turning, every monitor showing an
// error. The bugs from the BUG SQUASH cabinet have got out of the cabinet —
// the same little green beetles, now with a third dimension — and they are
// making for production. You have a rubber debugging mallet.
//
// Seen through your own eyes. Click, Space or E to swing; one hit each. Fix
// the whole wave before five of them reach the server racks and the wall
// screen goes green, the lights come back and the lift rings for you. If
// production goes down it rolls back, and you can try again at the racks.
// The score goes on the same board BUG SQUASH uses.
//
// What the night shift left behind (core/game.mjs): the keycard is on the
// back of the last bug of the wave; two coins are inside gold bugs, which
// come whether or not you are lucky while there is one still to find; and
// the third comes out of the printer, if you hit it enough.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { FLOORS, WALLS, canvasTexture } from '../scene/textures.js';
import { CRT_SCREEN, DESK_H } from '../props/office.js';
import { ARCADE_SCREEN } from '../props/fun.js';
import { Vox, M, glow, tone, VOXEL } from '../vox/vox.js';
import { meshVox } from '../vox/mesher.js';
import { voxelMaterial } from '../vox/material.js';
import { keycard } from '../props/loot.js';

const ROOM = { x0: -9, z0: -6.5, x1: 9, z1: 6.5, h: 2.7 };
const WAVE = 16, LIVES = 5, REACH = 1.55, ARC = 0.75, DIM = 0.8;
const RACK = { x: 0, z: ROOM.z0 + 0.9 }, RACKS = [-2.6, 2.6];      // production: a rack either side of the wall screen
const PRINTER = { x: -8.3, z: 3.6 }, KNOCKS = 3, FORCED_GOLD = [4, 10];
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const TAU = Math.PI * 2;
const turnTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// The bug BUG SQUASH has always drawn (ui/arcade.js), seen from above: two frames of legs.
const BUG = [['.#.#.#.', '#######', '.#####.', '#######', '.#.#.#.'], ['#.#.#.#', '.#####.', '#######', '.#####.', '#.#.#.#']];
/** That sprite, given a back: a domed shell, the same legs, two lit eyes. Faces +z. 7 × 4 × 5 (drawn three times life size). */
function bug(frame, gold) {
  const v = new Vox(), body = M(gold ? '#ffd75a' : '#6fe08a', 0), dark = tone(body, -0.38);
  BUG[frame].forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') v.set(i - 3, 0, j - 2, j === 0 || j === 4 || i === 0 || i === 6 ? dark : body); });
  v.box(-2, 1, -1, 3, 2, 2, body); v.box(-1, 2, -1, 2, 3, 1, glow(body));                // the shell, lit like the screen it came off
  v.box(-2, 1, 1, 3, 2, 2, dark);
  v.set(-1, 1, 2, glow('#d8ffe0')); v.set(1, 1, 2, glow('#d8ffe0'));                      // eyes
  return v;
}
/** A rubber mallet for percussive debugging. The handle runs along +y; the head is at the top. 10 × 30 × 6. */
function mallet() {
  const v = new Vox(), wood = M('#b98d57', 2), rubber = M('#d8493f', 1);
  v.box(-1, 0, -1, 1, 22, 1, wood); v.paint(-1, 0, -1, 1, 5, 1, M('#2b2b30', 0));          // a taped grip
  v.rbox(-5, 20, -3, 5, 28, 3, 2, rubber, 'yz'); v.paint(-5, 23, -3, 5, 25, 3, M('#f1ead8', 0));
  v.paint(-5, 20, -3, -4, 28, 3, tone(rubber, -0.25)); v.paint(4, 20, -3, 5, 28, 3, tone(rubber, -0.25));
  return v;
}
const ceilingTex = () => canvasTexture(96, 96, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x * 3 + y * 5) % 7 === 0 ? '#16161c' : '#4a4a52'; g.fillRect(x * 24, y * 24, 24, 24);      // a tile is down here and there
  }
  g.fillStyle = '#2f2f36'; for (let i = 0; i < 4; i++) { g.fillRect(i * 24, 0, 1, 96); g.fillRect(0, i * 24, 96, 1); }
});

export async function enter(office) {
  const net = office.net;
  const w = createWorld(office, {
    id: 'afterhours', background: '#07070b', shadows: 11,
    camera: { first: true, fov: 62, yaw: 0, pitch: 0.06, minPitch: -0.7, maxPitch: 0.8, height: 1.08 },
    grade: { tilt: 0, bloom: 0.45, glow: 1.5 },
  });
  const { scene, camera } = w;
  const R = Math.random;
  w.room({ ...ROOM, wall: WALLS.office('#4a5868'), floor: FLOORS.carpet('#473f4d'), lift: { side: 'S', at: 0 }, shaft: WALLS.steel() });
  const tiles = w.own(ceilingTex());
  tiles.repeat.set((ROOM.x1 - ROOM.x0) / 2.4, (ROOM.z1 - ROOM.z0) / 2.4);
  const ceiling = new THREE.Mesh(w.own(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0)), w.own(new THREE.MeshLambertMaterial({ map: tiles })));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h;
  scene.add(ceiling);
  for (const [x, z, a] of [[-4.6, 1.2, 0.3], [3.1, -0.4, -0.5], [6.2, 3.3, 1.1]]) {          // and where those tiles ended up
    const t = w.box(x - 0.3, 0.02, z - 0.3, x + 0.3, 0.05, z + 0.3, '#5a5a62', { cast: false }); t.rotation.y = a;
  }

  /* ---- the office, as it was left ---------------------------------------------------------------- */
  const DESKS = [[-5.4, -1.6], [-1.8, -1.6], [1.8, -1.6], [5.4, -1.6], [-5.4, 2.0], [-1.8, 2.0], [1.8, 2.0], [5.4, 2.0]];
  const crtGeo = w.own(new THREE.PlaneGeometry(CRT_SCREEN.w, CRT_SCREEN.h));
  const desks = DESKS.map(([x, z], i) => {
    w.prop('desk', x, z, 'N');
    const crt = w.prop('crt', x + 3 * VOXEL, z - 5 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
    w.prop('keyboard', x + 3 * VOXEL, z + 10 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
    const chair = w.prop('chair', x + (i % 3 - 1) * 0.5, z + 0.75 + (i % 2) * 0.3, 'N', { o: { color: '#4d5a78' }, solid: i % 3 !== 0, footprint: [0.5, 0.5] });
    if (i % 3 === 0) { chair.rotation.z = Math.PI / 2; chair.rotation.y = i; chair.position.y = 0.24; }         // knocked over
    const picture = new THREE.Mesh(crtGeo, office.screens.material(i % 2 ? 'alert' : 'blocked'));
    picture.position.set(CRT_SCREEN.x, CRT_SCREEN.y, CRT_SCREEN.z);
    crt.children[0].add(picture);
    return { x, z, picture, bad: true };
  });
  RACKS.forEach((x, i) => w.prop('rack', x, RACK.z - 0.35, 'S', { id: `after:rack${i}` }));
  w.prop('planttall', -8.4, -5.9, 'S'); w.prop('cooler', 8.4, -3.5, 'W'); w.prop('boxes', 8.2, 5.7, 'S');
  const printer = w.prop('printer', PRINTER.x, PRINTER.z, 'E');
  // the cabinet they came out of: still playable, if you would rather do this in two dimensions
  const cabinet = w.prop('arcade', 7.6, 5.0, 'W', { id: 'after:cabinet' });
  const attract = new THREE.Mesh(w.own(new THREE.PlaneGeometry(ARCADE_SCREEN.w, ARCADE_SCREEN.h)), office.screens.material('arcade'));
  attract.position.set(ARCADE_SCREEN.x, ARCADE_SCREEN.y, ARCADE_SCREEN.z);
  cabinet.children[0].add(attract);
  w.thing({ x: 6.9, z: 5.0, label: 'BUG SQUASH', object: cabinet, reach: 1.2,
    use() { import('../ui/arcade.js').then((m) => m.playBugSquash({ office, ui: { ...(office.ui || {}), root: w.root } })).catch(() => null); } });
  // vents in the floor: where they come up
  const VENTS = [[-7.6, 5.2], [7.4, 1.0], [-7.8, -0.6], [6.6, 4.4]];
  for (const [x, z] of VENTS) { w.box(x - 0.35, 0.004, z - 0.25, x + 0.35, 0.02, z + 0.25, '#0c0c10', { cast: false }); w.box(x - 0.4, 0, z - 0.3, x + 0.4, 0.012, z + 0.3, '#5a626e', { cast: false }); }

  /* ---- light: what is left of it ------------------------------------------------------------------- */
  const NIGHT = { sky: '#7080b8', ground: '#2a2430', hemi: DIM, sun: '#8090c0', power: 0.3, dir: [0.2, 1, 0.3] };
  const MORNING = { sky: '#fff0dc', ground: '#8a7560', hemi: 1.75, sun: '#fff3df', power: 1.5 };            // what a passing build looks like
  w.light(NIGHT);
  const beacon = w.lamp(RACK.x, 2.3, RACK.z + 0.6, '#ff3a2a', 9, 12);
  const exit = w.lamp(0, 2.3, ROOM.z1 - 0.4, '#3fd68a', 1.2, 4);
  for (const x of [-5.5, 5.5]) w.lamp(x, 2.3, 0.2, '#8fa8ff', 2.2, 9);                                        // two emergency fittings that still work
  const spark = w.lamp(-3.2, 2.4, 0.4, '#bfe0ff', 0, 7);
  const lampHead = w.box(RACK.x - 0.12, 2.42, ROOM.z0 + 0.02, RACK.x + 0.12, 2.6, ROOM.z0 + 0.26, w.own(new THREE.MeshBasicMaterial({ color: '#ff3a2a', toneMapped: false })), { cast: false });
  w.box(-3.22, 1.5, 0.38, -3.18, ROOM.h, 0.42, '#1c1c22', { cast: false });                                    // a cable hanging out of the ceiling

  /* ---- the screen on the wall: the only words in here ------------------------------------------------ */
  const game = { state: 'ready', fixed: 0, lost: 0, spawned: 0, t: 0, next: 2.5, score: 0, rank: null, board: net.state.world?.arcade || [], started: 0 };
  const status = w.screen(3.4, 1.05, (g, cw, ch) => {
    const green = game.state === 'won', red = game.state === 'lost';
    g.fillStyle = '#07090e'; g.fillRect(0, 0, cw, ch);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = green ? '#5fe08a' : red ? '#ff6a5a' : '#ffb44a'; g.font = `700 ${Math.round(ch * 0.2)}px ${MONO}`;
    g.fillText(green ? 'BUILD PASSING' : red ? 'ROLLBACK' : 'BUILD FAILING', cw * 0.04, ch * 0.2);
    g.fillStyle = '#dfe6f0'; g.font = `600 ${Math.round(ch * 0.15)}px ${MONO}`;
    g.fillText(`BUGS FIXED  ${String(game.fixed).padStart(2, '0')} / ${WAVE}`, cw * 0.04, ch * 0.5);
    g.fillStyle = '#7f8aa0'; g.font = `${Math.round(ch * 0.11)}px ${MONO}`; g.fillText('PRODUCTION', cw * 0.04, ch * 0.78);
    for (let i = 0; i < LIVES; i++) { g.fillStyle = i < LIVES - game.lost ? (green ? '#5fe08a' : '#6fb6e8') : '#3a1c1c'; g.fillRect(cw * 0.3 + i * cw * 0.062, ch * 0.7, cw * 0.05, ch * 0.16); }
    // the board, down the right: the same one the cabinet posts to
    g.textAlign = 'right'; g.fillStyle = '#f0b860'; g.font = `600 ${Math.round(ch * 0.1)}px ${MONO}`; g.fillText('HIGH SCORES', cw * 0.97, ch * 0.13);
    (game.board || []).slice(0, 5).forEach((e, i) => {
      g.fillStyle = game.rank === i + 1 ? '#5fe08a' : '#aab4c6'; g.font = `${Math.round(ch * 0.095)}px ${MONO}`;
      g.fillText(`${String(e.name).slice(0, 14)}  ${String(e.score).padStart(5, ' ')}`, cw * 0.97, ch * (0.29 + i * 0.13));
    });
    if (green || red) { g.textAlign = 'left'; g.fillStyle = '#7f8aa0'; g.font = `${Math.round(ch * 0.09)}px ${MONO}`; g.fillText(green ? `score ${game.score}${game.rank ? ` · rank #${game.rank}` : ''}` : 'production was restored from backup', cw * 0.04, ch * 0.93); }
  }, { ppm: 220, gain: 1.15 });
  w.add(status.mesh, RACK.x, ROOM.z0 + 0.03, 'S', 1.78);
  w.thing({ x: RACK.x, z: RACK.z + 0.3, label: 'the build', reach: 1.4, hidden: () => game.state === 'playing' || game.state === 'ready', use: () => start() });

  /* ---- the mallet, in your hand ------------------------------------------------------------------------ */
  const flesh = voxelMaterial();
  const hand = new THREE.Group(), tool = new THREE.Mesh(w.own(meshVox(mallet(), { origin: [0, 4, 0] }).solid), flesh);
  tool.scale.setScalar(VOXEL * 0.62);
  hand.add(tool); hand.position.set(0.3, -0.36, -0.62);
  camera.add(hand);
  let swing = 0, struck = false;
  function swingNow() { if (swing <= 0 && game.state !== 'won') { swing = 1; struck = false; } }
  w.onClick(swingNow);
  w.onKey((k) => { if (k === ' ' || k === 'e' || k === 'Enter' || k === 'f') swingNow(); });

  /* ---- what is hidden here: it falls out of whatever was carrying it, and lies there until you walk into it -- */
  const still = () => office.game?.left('afterhours') || { card: false, coins: [] };
  const lying = new Set(), falls = [];                        // coins out on the floor · things on their way down to it
  let cardOut = false;
  const owedCoin = () => still().coins.find((n) => n <= 2 && !lying.has(n)) || 0;      // the next one a gold bug has in it
  /** A place beside (x, z) that somebody can stand on: toward you, if the thing died on a desk. */
  function footing(x, z) {
    for (let k = 0; k <= 1; k += 0.1) { const px = x + (w.me.x - x) * k, pz = z + (w.me.z - z) * k; if (w.free(px, pz)) return [px, pz]; }
    return [w.me.x, w.me.z];
  }
  /** Let go of a coin or the card at `from` [x, y, z]; it lands at `to` [x, z] after `wait` seconds. */
  function drop(item, n, from, to, wait = 0) {
    const f = { from, to, t: 0, wait, handle: null };
    f.handle = w.loot({ item, n, x: from[0], z: from[2], y: from[1], light: true, reach: 0.85, hidden: () => f.wait > 0,
      onTake: () => { if (item === 'coin') lying.delete(n); else cardOut = false; } });
    if (!f.handle) return null;
    if (item === 'coin') lying.add(n); else cardOut = true;
    falls.push(f);
    return f.handle;
  }
  // percussive maintenance: the printer has had one in it for years
  let knocks = 0, rattle = 0, jammed = -9, printed = false;
  function knock() {
    knocks++; rattle = 0.4;
    if (knocks >= KNOCKS && !printed) {
      printed = true;
      if (drop('coin', 3, [PRINTER.x + 0.1, 0.5, PRINTER.z], footing(PRINTER.x + 1.05, PRINTER.z + 0.3), 0.7)) { w.sfx('printer', { volume: 0.7 }); return; }
    }
    if (w.time - jammed > 2.6) { jammed = w.time; w.sfx('printer-jam', { volume: 0.6 }); }
  }

  /* ---- the bugs ------------------------------------------------------------------------------------------ */
  const geo = [[0, false], [1, false], [0, true], [1, true]].map(([f, gold]) => w.own(meshVox(bug(f, gold)).solid));
  const cardGeo = w.own(meshVox(keycard()).solid);
  const bugs = [], bits = [], tags = [];
  const bitGeo = w.own(new THREE.BoxGeometry(0.05, 0.05, 0.05));
  const bitMat = [w.own(new THREE.MeshBasicMaterial({ color: '#6fe08a', toneMapped: false })), w.own(new THREE.MeshBasicMaterial({ color: '#ffd75a', toneMapped: false }))];
  const fixedTex = w.own(canvasTexture(64, 24, (g) => { g.fillStyle = '#0c2014'; g.fillRect(0, 0, 64, 24); g.fillStyle = '#6fe08a'; g.fillRect(0, 0, 64, 2); g.font = `700 15px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FIXED', 32, 13); }, { clamp: true }));
  const tagMat = w.own(new THREE.SpriteMaterial({ map: fixedTex, toneMapped: false }));
  function spawn() {
    const from = R() < 0.25 ? [7.0, 5.0] : VENTS[Math.floor(R() * VENTS.length)];
    // the last one out has somebody's keycard; a gold one is luck, unless there is a coin still to find
    const courier = game.spawned === WAVE - 1 && still().card && !cardOut;
    const gold = !courier && (R() < 0.1 || (FORCED_GOLD.includes(game.spawned) && !!owedCoin()));
    const mesh = new THREE.Mesh(geo[gold ? 2 : 0], flesh);
    mesh.scale.setScalar(VOXEL * 3); mesh.castShadow = true;
    scene.add(mesh);
    let cargo = null;
    if (courier) {                                               // strapped to its back like a sail
      cargo = new THREE.Group();
      const card = new THREE.Mesh(cardGeo, flesh);
      card.scale.setScalar(VOXEL * 1.15); card.rotation.x = -0.9; card.position.set(0, 0.25, 0.14);
      const shine = new THREE.PointLight('#9fd0ff', 1.3, 2.6, 1.6); shine.position.set(0, 0.6, 0);
      cargo.add(card, shine);
      scene.add(cargo);
    }
    const desk = R() < 0.6 ? desks[Math.floor(R() * desks.length)] : null;
    bugs.push({ mesh, gold, cargo, x: from[0], z: from[1], y: -0.12, heading: 0, speed: 1.15 + R() * 0.6 + game.spawned * 0.03, desk, rack: RACKS[Math.floor(R() * RACKS.length)], state: 'up', t: 0.45, wob: R() * 6, frame: 0 });
    game.spawned++;
  }
  function pop(b, fixed) {
    scene.remove(b.mesh); bugs.splice(bugs.indexOf(b), 1);
    if (b.cargo) scene.remove(b.cargo);
    for (let i = 0; i < (fixed ? 12 : 5); i++) {
      const m = new THREE.Mesh(bitGeo, bitMat[b.gold ? 1 : 0]);
      m.position.set(b.x, b.y + 0.1, b.z); scene.add(m);
      bits.push({ m, vx: (R() - 0.5) * 3, vy: 1.6 + R() * 2.2, vz: (R() - 0.5) * 3, life: 0.8 });
    }
    if (!fixed) return;
    const tag = new THREE.Sprite(tagMat); tag.scale.set(0.42, 0.16, 1); tag.position.set(b.x, b.y + 0.3, b.z);
    scene.add(tag); tags.push({ s: tag, t: 0 });
    game.fixed++; game.score += (b.gold ? 250 : 100) + Math.max(0, 60 - Math.round((w.time - game.started) / 2));
    const coin = b.gold ? owedCoin() : 0, up = Math.max(0, b.y);
    if (coin) drop('coin', coin, [b.x, up, b.z], footing(b.x, b.z));
    if (b.cargo) drop('card', 0, [b.x, up, b.z], footing(b.x, b.z));
    w.sfx(b.gold && !coin ? 'coin' : 'squash');                 // a real coin makes its own sound when you pick it up
    status.redraw();
  }
  function start() {
    for (const b of [...bugs]) pop(b, false);
    Object.assign(game, { state: 'playing', fixed: 0, lost: 0, spawned: 0, next: w.time + 1.2, score: 0, rank: null, started: w.time });
    for (const d of desks) { d.bad = true; d.picture.material = office.screens.material('alert'); }
    w.light(NIGHT); beacon.intensity = 9;
    status.redraw();
  }
  async function finish(won) {
    game.state = won ? 'won' : 'lost';
    if (!won) { for (const b of [...bugs]) pop(b, false); w.sfx('noclip'); status.redraw(); return; }
    game.score += (LIVES - game.lost) * 150;
    for (const d of desks) { d.bad = false; d.picture.material = office.screens.material('done'); }
    w.light(MORNING); beacon.intensity = 0;                                                      // the lights come back
    w.sfx('lift-ding'); w.liftDoor?.setFloor('A', 0, '#5fe08a');
    status.redraw();
    const name = office.walk?.me?.name || 'Lead';
    try {
      const r = await net.api('/api/world/arcade', { method: 'POST', body: { score: game.score, name } });
      game.rank = r.rank; game.board = r.board || game.board;
      if (net.state.world) net.state.world.arcade = game.board;
    } catch { /* the board is a nicety */ }
    net.api('/api/world/discover', { method: 'POST', body: { secret: 'green-build', name } }).catch(() => null);
    status.redraw();
  }

  w.onFrame((dt, t) => {
    const me = w.me, yaw = w.cam.yaw;
    if (game.state === 'ready' && t > 2.2) start();
    if (game.state === 'playing') {
      if (game.spawned < WAVE && t > game.next && bugs.length < 6) { spawn(); game.next = t + Math.max(1.1, 2.4 - game.spawned * 0.08); }
      if (game.lost >= LIVES) finish(false);
      else if (game.spawned >= WAVE && !bugs.length) finish(true);
    }
    // the swing: down and back in a third of a second; it lands a tenth of a second in
    if (swing > 0) {
      swing = Math.max(0, swing - dt / 0.34);
      const k = Math.sin((1 - swing) * Math.PI);
      hand.rotation.set(-0.25 - k * 1.25, 0.25, -0.35 + k * 0.25);
      if (!struck && swing < 0.62) {
        struck = true;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        for (const b of [...bugs]) {
          const dx = b.x - me.x, dz = b.z - me.z, d = Math.hypot(dx, dz);
          if (b.state !== 'up' && d < REACH && (d < 0.5 || (dx * fx + dz * fz) / d > ARC)) pop(b, true);
        }
        const px = PRINTER.x - me.x, pz = PRINTER.z - me.z, pd = Math.hypot(px, pz);
        if (pd < REACH && (px * fx + pz * fz) / pd > ARC) knock();
      }
    } else hand.rotation.set(-0.25 + Math.sin(t * 1.7) * 0.02, 0.25, -0.35);
    for (const b of [...bugs]) {
      b.t -= dt; b.wob += dt * 9;
      let tx = b.rack, tz = RACK.z + 0.45, go = b.speed;
      if (b.state === 'up') { b.y = Math.min(0, b.y + dt * 0.4); go = 0; if (b.t <= 0) b.state = b.desk ? 'desk' : 'rack'; } else if (b.state === 'desk') {
        tx = b.desk.x; tz = b.desk.z + 0.9;
        if (Math.hypot(tx - b.x, tz - b.z) < 0.3) { b.state = 'hop'; b.t = 0.45; b.from = [b.x, b.z]; }
      } else if (b.state === 'hop') {                               // up onto the desk
        const k = 1 - Math.max(0, b.t) / 0.45; go = 0;
        b.x = b.from[0] + (b.desk.x - b.from[0]) * k; b.z = b.from[1] + (b.desk.z + 0.1 - b.from[1]) * k;
        b.y = DESK_H * VOXEL * k + Math.sin(k * Math.PI) * 0.3;
        if (b.t <= 0) { b.state = 'sit'; b.t = 2.6 + R() * 1.5; b.desk.bad = true; b.desk.picture.material = office.screens.material('alert'); spark.intensity = 14; w.sfx('typing'); }
      } else if (b.state === 'sit') { go = 0; b.heading += dt * 2.4; if (b.t <= 0) { b.state = 'rack'; b.y = 0; b.z += 1.0; } } else if (Math.hypot(tx - b.x, tz - b.z) < 0.35) {
        game.lost++; pop(b, false); w.sfx('printer-jam'); status.redraw();          // one got into production
        continue;
      }
      if (go > 0) {
        b.heading += turnTo(b.heading, Math.atan2(tx - b.x, tz - b.z) + Math.sin(b.wob * 0.35) * 0.5) * Math.min(1, dt * 6);
        const nx = b.x + Math.sin(b.heading) * go * dt, nz = b.z + Math.cos(b.heading) * go * dt;
        if (w.free(nx, nz) || Math.hypot(tx - nx, tz - nz) < 1.2) { b.x = nx; b.z = nz; } else b.heading += 1.4;      // round the furniture
      }
      const f = Math.floor(b.wob) & 1;
      if (f !== b.frame && go > 0) { b.frame = f; b.mesh.geometry = geo[(b.gold ? 2 : 0) + f]; }
      b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.y = b.heading;
      if (b.cargo) { b.cargo.position.set(b.x, b.y, b.z); b.cargo.rotation.y = b.heading; }
    }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i];
      if (f.wait > 0) { f.wait -= dt; continue; }
      f.t = Math.min(1, f.t + dt / 0.5);
      f.handle.moveTo(f.from[0] + (f.to[0] - f.from[0]) * f.t, f.from[2] + (f.to[1] - f.from[2]) * f.t, f.from[1] * (1 - f.t) + Math.sin(f.t * Math.PI) * 0.3);
      if (f.t >= 1) falls.splice(i, 1);
    }
    if (rattle > 0) { rattle = Math.max(0, rattle - dt); printer.rotation.z = Math.sin(t * 70) * 0.05 * (rattle / 0.4); printer.position.y = Math.abs(Math.sin(t * 55)) * 0.02 * (rattle / 0.4); }
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i]; p.life -= dt; p.vy -= 9 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y = Math.max(0.03, p.m.position.y + p.vy * dt); p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(Math.max(0.01, p.life / 0.8));
      if (p.life <= 0) { scene.remove(p.m); bits.splice(i, 1); }
    }
    for (let i = tags.length - 1; i >= 0; i--) {
      const g = tags[i]; g.t += dt;
      g.s.position.y += dt * 0.5; g.s.material.opacity = 1;
      g.s.scale.set(0.42 * Math.max(0, 1 - g.t / 1.1), 0.16 * Math.max(0, 1 - g.t / 1.1), 1);
      if (g.t > 1.1) { scene.remove(g.s); tags.splice(i, 1); }
    }
    // a broken build has a red lamp going round; a cable spits now and then
    const failing = game.state !== 'won';
    beacon.intensity = failing ? 5 + 5 * Math.max(0, Math.sin(t * 3.4)) : 0;
    lampHead.material.color.set('#ff3a2a').multiplyScalar(failing ? 0.5 + 1.2 * Math.max(0, Math.sin(t * 3.4)) : 0.15);
    spark.intensity = Math.max(0, spark.intensity - dt * 60);
    if (failing && R() < dt * 0.35) spark.intensity = 10 + R() * 8;
    exit.intensity = 1.2;
  });

  w.game = game; w.bugs = bugs; w.printer = { get knocks() { return knocks; } };     // for the console, and for the curious
  return w.run();
}
