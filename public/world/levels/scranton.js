// S · Scranton Paper Co. — an affectionate paper-company sitcom detour.
// All play is local to this visit. No task moves, messages, or real agent work.
// The same level kit, voxel material, rig and lift as the rest of the building.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { FLOORS, WALLS, canvasTexture } from '../scene/textures.js';
import { Avatar } from '../avatar/rig.js';
import { resolveLook } from '/core/look.mjs';
import { createGame, act, advance, objective, remaining, chillRemaining, inventory } from '/core/scranton-game.mjs';
import { receptionDesk, salesDesk, managerDesk, stapler, gelatinKit, copier, paperStack, trophy, ceilingLight } from './scranton-props.js';

const ROOM = { x0: -10, z0: -7, x1: 10, z1: 7, h: 2.85 };
const SPOTS = Object.freeze({
  memo: { x: -5.3, z: 4.65 }, challenge: { x: -4.1, z: 4.65 },
  stapler: { x: 3.45, z: 0.65 }, mix: { x: 7.4, z: 5.4 }, fridge: { x: 8.35, z: 3.35 },
});
const INK = '#233747', PAPER = '#f0ead7', GREEN = '#396952', RED = '#a14332';
const BEST_KEY = 'office:scranton:challenge-best:v1';

function wrap(g, text, x, y, maxW, lineH) {
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = word; y += lineH; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lineH;
}
function paper(g, width, height, title, subtitle) {
  g.fillStyle = PAPER; g.fillRect(0, 0, width, height);
  g.strokeStyle = '#c3baa3'; g.lineWidth = 2; g.strokeRect(8, 8, width - 16, height - 16);
  g.fillStyle = INK; g.font = `bold ${Math.round(width * 0.045)}px Georgia, serif`;
  g.fillText(title, width * 0.065, height * 0.12);
  g.font = `${Math.round(width * 0.025)}px sans-serif`;
  g.fillStyle = '#6d716b'; g.fillText(subtitle, width * 0.065, height * 0.185);
  g.strokeStyle = INK; g.beginPath(); g.moveTo(width * 0.065, height * 0.22); g.lineTo(width * 0.935, height * 0.22); g.stroke();
}

export async function enter(office) {
  const w = createWorld(office, {
    id: 'scranton', background: '#c2c3b5', shadows: 14,
    camera: { first: true, yaw: -0.55, pitch: 0.02, fov: 66, height: 1.2, minPitch: -1.15, maxPitch: 1.3 },
    grade: { tilt: 0, bloom: 0.12, glow: 0.7 },
  });
  const { scene } = w;
  let game = createGame(), playTime = 0, feedback = 'Please help yourself to a visitor badge. It is mostly adhesive.';
  let best = null, applauseUntil = 0, copies = 0, salesCalls = 0, conferenceSlide = 0, talkingUntil = 0;
  try { const saved = Number(localStorage.getItem(BEST_KEY)); if (saved > 0 && Number.isFinite(saved)) best = saved; } catch { /* a private browser can still play */ }
  const people = [], statusScreens = [], stations = new Map();
  w.light({ sky: '#f2f2df', ground: '#b4a48c', hemi: 1.75, sun: '#fff4d9', power: 1.25, dir: [-0.6, 1, -0.4] });
  w.room({ ...ROOM, wall: WALLS.office('#d7d4bd'), floor: FLOORS.carpet('#7f867a'),
    lift: { side: 'S', at: -7.8 }, shaft: WALLS.steel(), outside: '#b7b4a3' });
  w.bed('office-bed', { volume: 0.16 });

  // Acoustic ceiling: visible from below, disappears for a dollhouse photograph.
  const ceilingTex = w.own(canvasTexture(80, 80, (g) => {
    g.fillStyle = '#d9d8c9'; g.fillRect(0, 0, 80, 80);
    g.fillStyle = '#b8bbad'; for (let k = 0; k < 80; k += 40) { g.fillRect(k, 0, 1, 80); g.fillRect(0, k, 80, 1); }
    g.fillStyle = '#cacabd'; for (let k = 0; k < 80; k++) g.fillRect((k * 29) % 79, (k * 47) % 79, 1, 1);
  }));
  ceilingTex.repeat.set(10, 7);
  const ceiling = new THREE.Mesh(w.own(new THREE.PlaneGeometry(20, 14)), w.own(new THREE.MeshLambertMaterial({ map: ceilingTex })));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h; scene.add(ceiling);
  for (const [x, z] of [[-7, -4.5], [7.5, -4.5], [-2.7, -2], [2.5, -2], [-2.7, 2.8], [2.5, 2.8], [-6, 4.6], [7.5, 4.5]]) {
    w.vox(ceilingLight, x, z, 'S', { y: 2.7, cast: false });
  }

  // Glass offices, blinds, doors: actual collisions follow the same gaps.
  const partitions = [];
  const glass = w.own(new THREE.MeshLambertMaterial({ color: '#b9d0ca', transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide }));
  function partition(ax, az, bx, bz, blinds = true) {
    const length = Math.hypot(bx - ax, bz - az), horizontal = Math.abs(bx - ax) > 0.1;
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
    partitions.push({ axis: horizontal ? 'z' : 'x', at: horizontal ? az : ax,
      from: (horizontal ? x0 : z0) - 0.065, to: (horizontal ? x1 : z1) + 0.065 });
    w.block(x0 - 0.065, z0 - 0.065, x1 + 0.065, z1 + 0.065);
    w.box(x0 - 0.055, 0, z0 - 0.055, x1 + 0.055, 0.72, z1 + 0.055, '#b8b9a7');
    w.box(x0 - 0.07, 0.7, z0 - 0.07, x1 + 0.07, 0.77, z1 + 0.07, '#77664c');
    w.wall(ax, az, bx, bz, '#b9d0ca', { y: 0.77, h: 1.85, material: glass });
    w.box(x0 - 0.06, 2.62, z0 - 0.06, x1 + 0.06, 2.72, z1 + 0.06, '#777b72');
    for (let i = 0; i <= Math.ceil(length / 1.25); i++) {
      const f = i / Math.ceil(length / 1.25), x = ax + (bx - ax) * f, z = az + (bz - az) * f;
      w.box(x - 0.025, 0.73, z - 0.025, x + 0.025, 2.65, z + 0.025, '#777b72');
    }
    if (blinds) for (let y = 1.7; y < 2.55; y += 0.13) {
      w.box(x0 - (horizontal ? 0 : 0.045), y, z0 - (horizontal ? 0.045 : 0), x1 + (horizontal ? 0 : 0.045), y + 0.025, z1 + (horizontal ? 0.045 : 0), '#dfddca', { cast: false });
    }
  }
  partition(-5, -7, -5, -2.6); partition(-10, -2.6, -8.2, -2.6); partition(-6.65, -2.6, -5, -2.6);
  partition(5.3, -7, 5.3, -2.6); partition(5.3, -2.6, 6.45, -2.6); partition(8, -2.6, 10, -2.6);
  // Kitchen is open to the main aisle on its west side.
  partition(5.3, 2.25, 10, 2.25, false); partition(5.3, 2.25, 5.3, 3.2, false); partition(5.3, 5.05, 5.3, 7, false);
  w.floor(5.32, 2.3, 9.98, 6.98, FLOORS.tile('#d9d6bd', '#c0c2aa'), { y: 0.012 });

  function plaque(text, x, y, z, { face = 'S', height = 0.18, bg = '#263c50', fg = '#f4ead5' } = {}) {
    return w.add(w.sign(text, { height, bg, fg }), x, z, face, y);
  }
  function picture(x, y, z, width, height, draw, face = 'S', ppm = 240) {
    const s = w.screen(width, height, draw, { ppm, gain: 0.86 });
    w.add(s.mesh, x, z, face, y); return s;
  }
  function windowAt(x, width) {
    const s = picture(x, 1.67, -6.975, width, 1.55, (g, W, H) => {
      g.fillStyle = '#c6d9dc'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#abb9b0'; g.fillRect(0, H * 0.53, W, H * 0.47);
      g.fillStyle = '#8e998f'; for (let i = 0; i < 8; i++) g.fillRect(i * W / 7, H * 0.35 + (i % 3) * 8, W / 10, H * 0.3);
      g.fillStyle = '#727d79'; g.fillRect(0, H * 0.78, W, H * 0.22);
      g.fillStyle = '#dddaca'; for (let i = 0; i < 9; i++) g.fillRect(0, i * H / 9, W, 4);
      g.fillStyle = '#eee6cb'; g.fillRect(W / 2 - 3, 0, 6, H);
    });
    return s.mesh;
  }
  windowAt(-7.5, 3.6); windowAt(0, 5.4); windowAt(7.5, 3.6);
  plaque('CONFERENCE ROOM', -7.4, 2.47, -2.52, { height: 0.17 });
  plaque('REGIONAL MANAGER', 7.25, 2.47, -2.52, { height: 0.17 });
  plaque('BREAK ROOM', 5.19, 2.05, 4.1, { face: 'W', height: 0.18 });

  // Reception: an intentionally overconfident blue corporate identity.
  w.vox(receptionDesk, -5.3, 3.7, 'S', { solid: true });
  w.box(-6.95, 0, 2.48, -3.65, 2.1, 2.6, '#d2d0b8', { solid: true });
  picture(-5.3, 1.48, 2.615, 2.7, 0.9, (g, W, H) => {
    g.fillStyle = '#203d59'; g.fillRect(0, 0, W, H); g.fillStyle = '#f2efdf';
    g.font = `900 ${W * 0.105}px Arial, sans-serif`; g.fillText('BLUNDER', W * 0.055, H * 0.39);
    g.fillText('MIFFLIN', W * 0.055, H * 0.78);
    g.font = `${W * 0.03}px sans-serif`; g.fillText('PAPER COMPANY', W * 0.59, H * 0.72);
    g.fillStyle = '#bcc7ce'; g.fillText('SCRANTON BRANCH', W * 0.59, H * 0.88);
  });
  plaque('Somehow, paper.', -5.3, 0.62, 4.33, { height: 0.17, bg: '#866544' });
  w.prop('planttall', -3.1, 3.3); w.prop('sofa', -8.8, 3.1, 'E', { footprint: [1.6, 0.8] });
  w.prop('doormat', -7.8, 5.7, 'N', { solid: false });
  plaque('WELCOME. YOU ARE PROBABLY EXPECTED.', -8.8, 1.7, 6.9, { face: 'N', height: 0.15 });

  // Sales islands: cream computers, mismatched chairs, far too much paper.
  const desks = [
    [-2.8, -1.75, 'N'], [0, -1.75, 'N'], [2.8, -1.75, 'N'],
    [-2.8, 0.05, 'S'], [0, 0.05, 'S'], [2.8, 0.05, 'S'],
  ];
  let targetDesk;
  for (let i = 0; i < desks.length; i++) {
    const [x, z, face] = desks[i];
    const desk = w.vox(() => salesDesk({ variant: i }), x, z, face, { solid: true });
    if (i === 5) targetDesk = desk;
    w.prop('chair', x, z + (face === 'N' ? -0.9 : 0.9), face === 'N' ? 'S' : 'N', { solid: false, o: { color: i % 2 ? '#606d61' : '#535f6d' } });
  }
  plaque('ASSISTANT TO THE REGIONAL MANAGER', 2.8, 0.72, 0.58, { height: 0.095, bg: '#594b32' });
  plaque('SALES · PLEASE HOLD', -2.8, 0.72, 0.58, { height: 0.11, bg: '#594b32' });
  const bareStapler = w.vox(stapler, 3.32, 0.35, 'S', { y: 0.69 });
  const deskJelly = w.vox(() => stapler({ gelatin: true }), 3.32, 0.35, 'S', { y: 0.69 }); deskJelly.visible = false;
  const carriedJelly = w.vox(() => stapler({ gelatin: true }), 0, 0, 'S');
  w.camera.add(carriedJelly); carriedJelly.position.set(0.34, -0.32, -0.75); carriedJelly.scale.setScalar(0.65); carriedJelly.visible = false;
  const carriedStapler = w.vox(stapler, 0, 0, 'S');
  w.camera.add(carriedStapler); carriedStapler.position.set(0.34, -0.3, -0.65); carriedStapler.rotation.set(-0.3, -0.25, 0.2); carriedStapler.visible = false;

  // The manager has more office than everybody else has desk.
  w.vox(managerDesk, 7.5, -4.6, 'S', { solid: true });
  w.prop('chair', 7.5, -5.6, 'S', { solid: false, o: { color: '#514c45' } });
  w.prop('chair', 6.55, -3.5, 'N', { o: { color: '#647266' } });
  w.prop('bookshelf', 9.45, -5.35, 'W');
  w.prop('plant', 5.9, -6.2);
  const award = w.vox(trophy, 8.2, -4.25, 'S', { y: 0.7 });
  plaque("WORLD'S OKAYEST BOSS", 7.5, 0.73, -3.95, { height: 0.11, bg: '#675139' });
  picture(6.35, 1.85, -6.96, 1.1, 0.75, (g, W, H) => {
    paper(g, W, H, 'CERTIFICATE', 'SELF-AWARDED · NO EXPIRY');
    g.font = `bold ${W * 0.06}px Georgia`; g.fillStyle = INK; g.fillText('Outstanding', W * 0.15, H * 0.48); g.fillText('Management', W * 0.15, H * 0.64);
  });

  // Conference room: a meeting that could have been a sticky note.
  w.prop('hottable', -7.5, -4.7, 'S', { scale: 1.1, footprint: [2.8, 1.1] });
  for (const x of [-8.4, -7.5, -6.6]) {
    w.prop('chair', x, -5.65, 'S', { solid: false }); w.prop('chair', x, -3.75, 'N', { solid: false });
  }
  const training = picture(-5.12, 1.65, -4.9, 1.9, 1.15, (g, W, H) => {
    paper(g, W, H, 'MANDATORY FUN', 'THIS MEETING HAS BEEN EXTENDED');
    const slides = [ ['Agenda', '1. Discuss the agenda.', '2. Form an agenda committee.', '3. Reconvene.'], ['Productivity', 'The bar is low.', 'Please do not trip over it.'], ['Team building', 'Trust falls postponed.', 'Trust is on back order.'] ];
    const slide = slides[conferenceSlide % slides.length];
    g.fillStyle = INK; g.font = `bold ${W * 0.06}px Georgia`; g.fillText(slide[0], W * 0.065, H * 0.37);
    g.font = `${W * 0.04}px sans-serif`; slide.slice(1).forEach((line, i) => g.fillText(line, W * 0.065, H * (0.53 + i * 0.14)));
  }, 'W');
  plaque('IT IS YOUR WORKDAY.', -7.5, 2.48, -6.94, { height: 0.24, bg: '#d1c8b5', fg: '#544f44' });

  // Annex: the copier responds to increasingly unreasonable expectations.
  const copyMachine = w.vox(copier, -8.8, -0.7, 'E', { solid: true });
  for (const [x, z, a] of [[-9.3, -1.8, 0], [-8.7, -1.8, 0.15], [-9.4, 0.6, 0], [4.3, -5.8, 0.1]]) w.vox(paperStack, x, z, a, { solid: true });
  w.prop('cabinet', -9.5, 1.5, 'E'); w.prop('cabinet', -8.7, 1.5, 'E');
  const copySlip = picture(-8.2, 1.3, -0.7, 0.9, 0.45, (g, W, H) => {
    g.fillStyle = '#cad3ac'; g.fillRect(0, 0, W, H); g.fillStyle = '#2e4639'; g.font = `bold ${W * 0.085}px monospace`;
    ['READY', 'PC LOAD LETTER', 'PLEASE DEFINE LETTER', 'NOW LOAD PC', 'ONE COPY. MANY FEELINGS.'][copies % 5].split(' ').reduce((lines, word) => {
      const line = lines[lines.length - 1]; if ((line + word).length > 17) lines.push(word + ' '); else lines[lines.length - 1] += word + ' '; return lines;
    }, ['']).forEach((line, i) => g.fillText(line, W * 0.06, H * (0.32 + 0.24 * i)));
  }, 'E');

  // Kitchen: every stage is physically visible, including the fridge clock.
  w.prop('counter', 7.4, 6.35, 'N');
  const mixing = w.vox(gelatinKit, 7.4, 6.25, 'N', { y: 0.77 });
  const fridge = w.prop('fridge', 9.35, 3.35, 'W');
  w.prop('cooler', 5.95, 6.35, 'N');
  w.prop('bin', 9.45, 5.1, 'W');
  const fridgeNote = picture(8.91, 1.17, 3.35, 0.6, 0.7, (g, W, H) => {
    paper(g, W, H, 'STAFF FRIDGE', 'LABEL YOUR EXPERIMENTS');
    g.fillStyle = INK; g.font = `bold ${W * 0.1}px monospace`;
    let text = 'COLD.';
    if (game.stage === 'chilling') text = `${Math.ceil(chillRemaining(game, playTime))} SEC`;
    if (game.stage === 'set') text = 'IT WOBBLES.';
    g.fillText(text, W * 0.065, H * 0.44);
    g.font = `${W * 0.065}px sans-serif`;
    wrap(g, game.stage === 'set' ? 'Collect your suspicious dessert.' : 'No fish. No evidence.', W * 0.065, H * 0.63, W * 0.86, H * 0.1);
  }, 'W');
  statusScreens.push(fridgeNote);
  const recipe = picture(7.4, 1.65, 6.94, 1.5, 0.8, (g, W, H) => {
    paper(g, W, H, 'OFFICE RECIPE', 'SERVES ONE ASSISTANT MANAGER');
    g.fillStyle = INK; g.font = `${W * 0.045}px sans-serif`;
    ['1. Borrow one stapler.', '2. Mix at the counter. [E]', '3. Chill 8 seconds in staff fridge.', '4. Return the evidence to its desk.'].forEach((s, i) => g.fillText(s, W * 0.065, H * (0.37 + i * 0.16)));
  }, 'N');

  // Fictional staff are actors, never pretend live agent sessions.
  function staff(id, x, z, heading, look, pose = 'type') {
    const a = w.own(new Avatar(resolveLook('scranton:' + id, { species: 'human', facial: 'none', accessory: 'none', skin: '#e6b184', ...look }), { seed: 'scranton:' + id, provider: 'custom' }));
    a.root.position.set(x, 0, z); a.root.rotation.y = heading; a.setPose(pose); scene.add(a.root);
    people.push({ a, pose, heading, id }); return a;
  }
  staff('reception', -5.3, 2.97, 0, { hair: 'long', hairColor: '#9b5939', outfit: 'cardigan', outfitColor: '#b88d9d' }, 'sit');
  staff('sales', -2.8, 0.94, Math.PI, { hair: 'side', hairColor: '#4a2f1a', outfit: 'suit', outfitColor: '#6e7b91' });
  const assistant = staff('assistant-to', 2.8, 0.94, Math.PI, { hair: 'side', hairColor: '#74542d', outfit: 'vest', outfitColor: '#b7a35b', accessory: 'glasses' });
  staff('accounts', 0, -2.67, 0, { hair: 'short', hairColor: '#241608', outfit: 'cardigan', outfitColor: '#744844' });
  staff('regional-manager', 7.5, -5.5, 0, { hair: 'side', hairColor: '#241608', outfit: 'suit', outfitColor: '#434956' }, 'think');

  // Reception memo is the UI: nothing floats over the office except the kit's E prompt.
  const memo = picture(-5.42, 1.65, 4.18, 1.05, 0.76, (g, W, H) => {
    paper(g, W, H, 'OPERATION GELATIN', 'INTERNAL MEMO · PLEASE DO NOT CIRCULATE');
    g.fillStyle = INK; g.font = `bold ${W * 0.039}px sans-serif`;
    let y = wrap(g, objective(game), W * 0.065, H * 0.34, W * 0.87, H * 0.09);
    g.font = `${W * 0.032}px sans-serif`; g.fillStyle = '#646551';
    y = wrap(g, feedback, W * 0.065, y + H * 0.04, W * 0.87, H * 0.075);
    g.fillStyle = game.stage === 'won' ? GREEN : RED;
    g.font = `bold ${W * 0.034}px monospace`;
    const sec = remaining(game, playTime);
    const footer = game.stage === 'won' ? 'PRANK COMPLETE. HR HAS QUESTIONS.' : game.stage === 'lost' ? 'MEETING OVER. EVIDENCE RECOVERED.'
      : sec === null ? 'UNHURRIED MISCHIEF · NO TIMER' : `MEETING ENDS IN ${Math.ceil(sec)}s`;
    g.fillText(footer, W * 0.065, H * 0.86);
    g.font = `${W * 0.025}px sans-serif`; g.fillStyle = '#646551';
    g.fillText('Q: memo  ·  E: put it down  ·  clock pauses while reading', W * 0.065, H * 0.945);
  }, 'S', 640);
  memo.mesh.rotation.x = -0.2;
  w.box(-5.75, 1.22, 4.08, -5.1, 1.28, 4.26, '#786d52');
  statusScreens.push(memo);
  // A sibling clock is a deliberate opt-in to a timed game.
  const timeClock = picture(-4.1, 1.55, 4.16, 0.65, 0.6, (g, W, H) => {
    g.fillStyle = '#304b44'; g.fillRect(0, 0, W, H); g.strokeStyle = '#adc0a5'; g.lineWidth = 5; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = '#f1ecd5'; g.textAlign = 'center'; g.font = `bold ${W * 0.09}px sans-serif`; g.fillText('THE BOSS IS', W / 2, H * 0.22); g.fillText('IN A MEETING', W / 2, H * 0.35);
    g.font = `bold ${W * 0.2}px monospace`; const sec = remaining(game, playTime), whole = Math.ceil(sec ?? 120); g.fillText(`${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`, W / 2, H * 0.62);
    g.font = `${W * 0.075}px sans-serif`; g.fillText('E: TIMED CHALLENGE', W / 2, H * 0.79);
    g.font = `${W * 0.06}px sans-serif`; g.fillText(best ? `BEST ${best.toFixed(1)}s` : 'OPTIONAL · 120 SECONDS', W / 2, H * 0.91); g.textAlign = 'left';
  }, 'S', 400);
  w.box(-4.43, 1.22, 4.08, -3.77, 1.86, 4.14, '#304b44');
  statusScreens.push(timeClock);
  plaque('E: START / RETRY', -5.42, 0.96, 4.39, { height: 0.12, bg: GREEN });
  plaque('Q: MEMO · WASD: WALK · DRAG: LOOK · E: USE · ESC: LOBBY', -6.9, 1.7, 6.91, { face: 'N', height: 0.13 });

  function readMemo() { w.focus([-5.42, 1.85, 5.8], [-5.42, 1.65, 4.18], { fov: 42, alone: true }); }
  function redraw() { for (const s of statusScreens) s.redraw(); }
  function sync() {
    bareStapler.visible = ['ready', 'searching', 'lost'].includes(game.stage);
    deskJelly.visible = game.stage === 'won';
    carriedJelly.visible = ['mixed', 'carrying'].includes(game.stage);
    carriedStapler.visible = game.stage === 'borrowed';
    assistant.setPose(game.stage === 'won' ? 'facepalm' : 'type');
    redraw();
  }
  function action(type) {
    const result = act(game, type, playTime);
    game = result.state; feedback = result.message;
    if (result.event === 'win') {
      applauseUntil = w.time + 6;
      const elapsed = game.finishedAt - game.startedAt;
      if (game.mode === 'challenge' && (!best || elapsed < best)) {
        best = elapsed; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* scores are optional */ }
      }
    }
    w.sfx(result.event === 'denied' || result.event === 'timeout' ? 'sticky' : result.event === 'win' ? 'confetti' : 'coin', { volume: 0.35 });
    sync();
    return result;
  }
  // Clicks and E share the same reach check; no stealing a stapler through a wall.
  function clearPath(point) {
    return partitions.every(({ axis, at, from, to }) => {
      const delta = point[axis] - w.me[axis];
      if (Math.abs(delta) < 0.0001) return true;
      const f = (at - w.me[axis]) / delta, other = axis === 'x' ? 'z' : 'x';
      const crossing = w.me[other] + f * (point[other] - w.me[other]);
      return f <= 0 || f >= 1 || crossing < from || crossing > to;
    });
  }
  function station(id, point, label, object, use, reach = 1.5, available = () => true) {
    const entry = w.thing({ ...point, label, object, reach,
      hidden: () => !available() || !clearPath(point),
      use() { if (entry.hidden() || Math.hypot(w.me.x - point.x, w.me.z - point.z) > reach) return; use(); } });
    stations.set(id, entry); return entry;
  }
  station('memo', SPOTS.memo, 'read / start the prank memo', memo.mesh, () => {
    if (['ready', 'won', 'lost'].includes(game.stage)) action({ type: 'start', mode: 'relaxed' });
    readMemo();
  }, 1.35);
  station('challenge', SPOTS.challenge, 'start / restart the 2-minute challenge', timeClock.mesh, () => {
    if (!['ready', 'won', 'lost'].includes(game.stage)) action('reset');
    action({ type: 'start', mode: 'challenge' }); readMemo();
  }, 1.2);
  station('stapler', SPOTS.stapler, 'borrow / return the stapler', targetDesk, () => {
    action(game.stage === 'carrying' ? 'return' : 'borrow');
  }, 1.5, () => game.stage !== 'won');
  // The jelly remains clickable after its owner notices it.
  station('jelly', SPOTS.stapler, 'inspect the evidence', deskJelly, () => {
    if (game.stage === 'won') { assistant.setPose('facepalm'); w.focus([4.4, 1.6, 1.8], [3.3, 0.84, 0.35], { fov: 42, alone: true }); }
  }, 1.5, () => game.stage === 'won');
  station('mix', SPOTS.mix, 'mix the gelatin', mixing, () => { action('mix'); });
  station('fridge', SPOTS.fridge, 'chill / collect the dessert', fridge, () => {
    if (game.stage === 'mixed') action('chill');
    else action('retrieve');
  });
  station('recipe', { x: 6.15, z: 5.45 }, 'read the recipe', recipe.mesh, () => w.focus([7.4, 1.7, 5.2], [7.4, 1.65, 6.94], { fov: 48, alone: true }), 1.1);
  station('copier', { x: -7.9, z: -0.7 }, 'negotiate with the copier', copyMachine, () => { copies++; copySlip.redraw(); w.sfx('printer', { volume: 0.3 }); });
  station('training', { x: -6.15, z: -4.9 }, 'advance the mandatory training', training.mesh, () => { conferenceSlide++; training.redraw(); w.sfx('sticky', { volume: 0.3 }); });
  station('award', { x: 8.2, z: -3.5 }, 'accept an extremely local award', award, () => { applauseUntil = w.time + 5; w.sfx('confetti', { volume: 0.3 }); });
  const phoneNote = picture(-2.28, 1.1, 0.45, 0.5, 0.35, (g, W, H) => {
    g.fillStyle = '#e7d18b'; g.fillRect(0, 0, W, H); g.fillStyle = '#493b24'; g.font = `${W * 0.085}px sans-serif`;
    wrap(g, ['PAPER. STILL A THING.', 'Your call is important to our quarterly figures.', 'Have you tried turning the paper over?', 'We also sell the other side.'][salesCalls % 4], W * 0.06, H * 0.2, W * 0.88, H * 0.2);
  });
  station('phone', { x: -2.8, z: 1.05 }, 'make a sales call', phoneNote.mesh, () => { salesCalls++; talkingUntil = w.time + 3; phoneNote.redraw(); w.sfx('bell', { volume: 0.18 }); });

  // A physical floor plan gives you the whole set, like the documentary's establishing shot.
  const floorMap = picture(-9.96, 1.6, 5, 1.1, 0.8, (g, W, H) => {
    paper(g, W, H, 'YOU ARE HERE', 'SCRANTON · UNCHANGED SINCE 1998');
    g.fillStyle = '#828f7e'; g.fillRect(W * 0.08, H * 0.31, W * 0.84, H * 0.57);
    g.strokeStyle = '#f2edda'; g.lineWidth = 3;
    g.strokeRect(W * 0.08, H * 0.31, W * 0.24, H * 0.2); g.strokeRect(W * 0.66, H * 0.31, W * 0.26, H * 0.2);
    g.strokeRect(W * 0.66, H * 0.62, W * 0.26, H * 0.26);
    for (const x of [0.4, 0.5, 0.6]) for (const y of [0.47, 0.6]) g.fillRect(W * x, H * y, W * 0.055, H * 0.07);
    g.fillStyle = '#bb523c'; g.beginPath(); g.arc(W * 0.18, H * 0.8, 4, 0, Math.PI * 2); g.fill();
  }, 'E');
  station('map', { x: -9.1, z: 5.15 }, 'look at the whole branch', floorMap.mesh, () => w.focus([14, 18, 21], [0, 0, 0], { fov: 45, alone: true }), 1.3);

  w.onKey((key) => { if (key === 'q') { if (w.focused) w.unfocus(); else readMemo(); } });
  let lastSecond = -1, lastStage = game.stage;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  w.onFrame((dt, t) => {
    // Reading the memo, changing tabs, and answering the real office are never punished.
    const paused = document.hidden || w.focused || !!w.root.querySelector('.liftpanel, [data-modal]');
    if (!paused) playTime += dt;
    carriedJelly.visible = !w.focused && ['mixed', 'carrying'].includes(game.stage);
    carriedStapler.visible = !w.focused && game.stage === 'borrowed';
    game = advance(game, playTime);
    if (game.stage !== lastStage) {
      if (game.stage === 'set') { feedback = 'The dessert has set. The fridge would like to be excluded from the investigation.'; w.sfx('bell', { volume: 0.25 }); }
      if (game.stage === 'lost') feedback = 'The meeting ended. The stapler has been quietly returned. Retry at reception.';
      lastStage = game.stage; sync();
    }
    if (Math.floor(playTime) !== lastSecond) { lastSecond = Math.floor(playTime); redraw(); }
    if (deskJelly.visible && !reducedMotion) { deskJelly.scale.x = 1 + Math.sin(t * 4) * 0.025; deskJelly.scale.z = 1 - Math.sin(t * 4) * 0.025; }
    for (const person of people) {
      const pose = person.id === 'assistant-to' && game.stage === 'won' ? 'facepalm'
        : t < applauseUntil ? 'cheer' : person.id === 'sales' && t < talkingUntil ? 'shrug' : person.pose;
      if (person.a.poseName !== pose) person.a.setPose(pose);
      person.a.update(dt);
    }
  });
  // A compact inspectable record also makes browser playtests use the real interactables.
  w.scranton = {
    get state() { return { ...game }; }, get clock() { return playTime; },
    get inventory() { return inventory(game); },
    spots: SPOTS, stations, readMemo,
  };
  sync();
  return w.run();
}
