// M · Mission Control — a level that is a WORK MODULE. One dim room whose
// north wall is live: everyone who is waiting on you and what they asked,
// who is doing what, every project's board, and what just happened. Each
// console in the room is a project; its monitor shows how that team is doing.
//
// Everything on a screen is read from office.net.state — the same store the
// office itself draws from — and redrawn when the daemon says something
// changed. Nothing is polled and nothing is made up. To build a module for
// your own workflow, copy this file: keep createWorld/room/lift, and replace
// the four draw functions with what you want to see.
//
//   E in front of a screen   read it properly; at the middle one, 1–9 then takes you to that agent
//   E at a console           go to that project's room in the office
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { FLOORS, WALLS } from '../scene/textures.js';
import { CRT_SCREEN, DESK_H } from '../props/office.js';
import { VOXEL } from '../vox/vox.js';
import { TASK_STATUS } from '/core/contract.mjs';
import { hashId } from '/core/look.mjs';

const ROOM = { x0: -8, z0: -5, x1: 8, z1: 5, h: 3.5 };
const WALL_Z = ROOM.z0 + 0.006;
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const INK = '#dfe6f0', DIM = '#7f8aa0', FAINT = '#465066', AMBER = '#ffb44a', GREEN = '#5fe08a', BLUE = '#7ab8ff', PANEL = '#0a0f1a', LINE = '#1c2a44';
const TASK_COLOR = { backlog: '#b9c2cf', todo: '#f2d45c', doing: '#6fb6e8', blocked: '#ee6f5e', review: '#c59af0', done: '#7fd08a' };
const DOT = { needs: AMBER, working: GREEN, thinking: BLUE, idle: '#8d86a0' };

/* ---- reading the office ----------------------------------------------------------------------- */
const stateOf = (a) => (a.status === 'blocked' && a.blockKind !== 'idle' ? 'needs' : a.turn === 'idle' || a.status === 'done' || a.status === 'blocked' ? 'idle' : a.status === 'working' ? 'working' : 'thinking');
const doing = (a) => (stateOf(a) === 'needs' ? (a.note || 'waiting on you') : a.status === 'working' ? (a.tool ? `${a.tool}${a.task ? ' · ' + a.task : ''}` : a.task || 'working') : stateOf(a) === 'idle' ? 'turn finished' : a.task || 'thinking');
function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
}
function read(net) {
  const agents = [...net.state.agents.values()];
  const waiting = (net.state.prompts || []).filter((p) => p.status === 'pending' && p.kind !== 'idle').sort((a, b) => a.createdAt - b.createdAt);
  const projects = (net.state.world?.plan?.rooms || []).slice().sort((a, b) => a.slot - b.slot)
    .map((r) => ({ id: r.deptId, name: r.name, color: r.color, agents: agents.filter((a) => a.department?.id === r.deptId), tasks: net.state.tasks.get(r.deptId) || [] }));
  return { agents, waiting, projects, activity: net.state.activity || [], now: net.now(), world: net.state.world };
}

/* ---- drawing ------------------------------------------------------------------------------------ */
function frame(g, w, h, title, right, rightColor = DIM) {
  g.fillStyle = PANEL; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0e1524'; g.fillRect(0, 0, w, 54);
  g.fillStyle = LINE; g.fillRect(0, 54, w, 2);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#f0b860'; g.font = `600 27px ${MONO}`;
  g.fillText(title, 22, 29);
  if (right) { g.textAlign = 'right'; g.fillStyle = rightColor; g.font = `24px ${MONO}`; g.fillText(right, w - 22, 29); }
  g.textAlign = 'left';
}
function clip(g, text, width) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  if (g.measureText(s).width <= width) return s;
  while (s.length > 1 && g.measureText(s + '…').width > width) s = s.slice(0, -1);
  return s + '…';
}
function dot(g, x, y, color, r = 8) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

/** Everyone who is waiting on the human, oldest first, and what they asked. */
function drawWaiting(g, w, h, d) {
  const n = d.waiting.length;
  frame(g, w, h, 'WAITING ON YOU', n ? `${n} ${n === 1 ? 'agent' : 'agents'}` : 'nobody', n ? AMBER : GREEN);
  if (!n) {
    g.textAlign = 'center'; g.fillStyle = GREEN; g.font = `600 44px ${MONO}`; g.fillText('ALL CLEAR', w / 2, h / 2 - 6);
    g.fillStyle = DIM; g.font = `24px ${MONO}`; g.fillText('nobody is waiting on you', w / 2, h / 2 + 40);
    return;
  }
  const rows = Math.min(n, 5), rowH = (h - 62) / Math.max(rows, 4);
  d.waiting.slice(0, rows).forEach((p, i) => {
    const y = 62 + i * rowH;
    if (i) { g.fillStyle = LINE; g.fillRect(22, y, w - 44, 1); }
    g.fillStyle = '#1a1206'; g.fillRect(22, y + 12, 44, rowH - 24);
    g.fillStyle = AMBER; g.textAlign = 'center'; g.font = `700 30px ${MONO}`; g.fillText(String(i + 1), 44, y + rowH / 2 + 1);
    g.textAlign = 'left'; g.font = `600 29px ${MONO}`; g.fillStyle = INK;
    const name = clip(g, p.agentName || 'Someone', 360), nameW = g.measureText(name).width;
    g.fillText(name, 86, y + rowH * 0.32);
    const agent = d.agents.find((a) => a.id === p.agentId);
    g.font = `22px ${MONO}`; g.fillStyle = DIM;
    g.fillText(clip(g, `${agent?.department?.name || ''}  ·  ${p.kind === 'permission' ? 'wants permission' : 'has a question'}`, w - nameW - 230), 86 + nameW + 22, y + rowH * 0.32);
    g.textAlign = 'right'; g.fillStyle = AMBER; g.fillText(ago(d.now - p.createdAt), w - 22, y + rowH * 0.32);
    g.textAlign = 'left'; g.fillStyle = '#c9d2e0'; g.font = `25px ${MONO}`;
    g.fillText(clip(g, p.message || '(no message)', w - 110), 86, y + rowH * 0.7);
  });
  if (n > rows) { g.textAlign = 'right'; g.fillStyle = DIM; g.font = `20px ${MONO}`; g.fillText(`+ ${n - rows} more`, w - 22, h - 14); }
}

/** Who is doing what: one line per agent, grouped by project. */
function drawWho(g, w, h, d) {
  const c = { needs: 0, working: 0, thinking: 0, idle: 0 };
  for (const a of d.agents) c[stateOf(a)]++;
  frame(g, w, h, 'WHO IS ON WHAT', `${d.agents.length} here`);
  const list = d.projects.flatMap((p) => p.agents.map((a) => [p, a])).concat(d.agents.filter((a) => !d.projects.some((p) => p.id === a.department?.id)).map((a) => [null, a]));
  const max = 12, rowH = (h - 104) / max;
  let last = null;
  list.slice(0, max).forEach(([p, a], i) => {
    const y = 64 + i * rowH + rowH / 2, st = stateOf(a);
    if (p !== last) { g.fillStyle = FAINT; g.font = `600 17px ${MONO}`; g.textAlign = 'right'; g.fillText(clip(g, (p?.name || 'no project').toUpperCase(), 200), w - 22, y); g.textAlign = 'left'; last = p; }
    dot(g, 34, y, DOT[st], 7);
    g.fillStyle = st === 'idle' ? DIM : INK; g.font = `600 22px ${MONO}`; g.fillText(clip(g, a.name, 250), 54, y);
    g.fillStyle = st === 'needs' ? AMBER : DIM; g.font = `20px ${MONO}`; g.fillText(clip(g, doing(a), w - 600), 318, y);
    if (a.contextPct) {                                           // how full its context is
      const x = w - 290, full = Math.min(1, a.contextPct / 100);
      g.fillStyle = '#16203a'; g.fillRect(x, y - 5, 56, 10);
      g.fillStyle = full > 0.85 ? '#ff7a66' : full > 0.65 ? AMBER : '#3f8a72'; g.fillRect(x, y - 5, 56 * full, 10);
    }
  });
  if (!list.length) { g.textAlign = 'center'; g.fillStyle = DIM; g.font = `24px ${MONO}`; g.fillText('nobody is in yet', w / 2, h / 2); g.textAlign = 'left'; }
  // the tally along the bottom
  let x = 22;
  g.font = `20px ${MONO}`;
  for (const [key, word] of [['needs', 'need you'], ['working', 'working'], ['thinking', 'thinking'], ['idle', 'idle']]) {
    dot(g, x + 8, h - 22, DOT[key], 7);
    g.fillStyle = key === 'needs' && c[key] ? AMBER : DIM;
    const text = `${c[key]} ${word}`;
    g.fillText(text, x + 24, h - 21);
    x += 44 + g.measureText(text).width;
  }
  if (list.length > max) { g.textAlign = 'right'; g.fillStyle = DIM; g.fillText(`+ ${list.length - max} more`, w - 22, h - 21); g.textAlign = 'left'; }
}

/** Every project's board as one stacked bar. */
function drawBoards(g, w, h, d) {
  const total = d.projects.reduce((n, p) => n + p.tasks.length, 0), done = d.projects.reduce((n, p) => n + p.tasks.filter((t) => t.status === 'done').length, 0);
  frame(g, w, h, 'BOARDS', total ? `${done}/${total} cards done` : 'no cards yet');
  const rows = d.projects.slice(0, 9), rowH = Math.min(52, (h - 112) / Math.max(1, rows.length));
  rows.forEach((p, i) => {
    const y = 66 + i * rowH, x0 = 250, bar = w - x0 - 96, n = Math.max(1, p.tasks.length);
    g.fillStyle = INK; g.font = `600 21px ${MONO}`; g.fillText(clip(g, p.name, 216), 22, y + rowH / 2 - 2);
    g.fillStyle = '#141c2e'; g.fillRect(x0, y + 8, bar, rowH - 18);
    let x = x0;
    for (const status of TASK_STATUS) {
      const k = p.tasks.filter((t) => t.status === status).length;
      if (!k) continue;
      const wide = (k / n) * bar;
      g.fillStyle = TASK_COLOR[status]; g.fillRect(x, y + 8, Math.max(2, wide - 2), rowH - 18);
      if (wide > 30) { g.fillStyle = '#10141c'; g.font = `600 18px ${MONO}`; g.textAlign = 'center'; g.fillText(String(k), x + wide / 2 - 1, y + rowH / 2 - 1); g.textAlign = 'left'; }
      x += wide;
    }
    g.fillStyle = DIM; g.font = `19px ${MONO}`; g.textAlign = 'right'; g.fillText(p.tasks.length ? `${p.tasks.length}` : '—', w - 22, y + rowH / 2 - 2); g.textAlign = 'left';
  });
  if (!rows.length) { g.textAlign = 'center'; g.fillStyle = DIM; g.font = `24px ${MONO}`; g.fillText('boards appear as projects do', w / 2, h / 2); g.textAlign = 'left'; }
  let x = 22;                                                     // the legend
  g.font = `17px ${MONO}`;
  for (const status of TASK_STATUS) {
    g.fillStyle = TASK_COLOR[status]; g.fillRect(x, h - 30, 14, 14);
    g.fillStyle = DIM; g.fillText(status, x + 20, h - 22);
    x += 34 + g.measureText(status).width;
  }
}

/** The strip along the top: the office clock and the counts. */
function drawHeader(g, w, h, d) {
  g.fillStyle = '#070b14'; g.fillRect(0, 0, w, h);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#f0b860'; g.font = `600 ${Math.round(h * 0.5)}px ${MONO}`;
  g.fillText('M I S S I O N   C O N T R O L', 28, h / 2 + 2);
  const tz = d.world?.today?.tzOffsetMin, t = new Date(d.now + (Number.isFinite(tz) ? tz + new Date().getTimezoneOffset() : 0) * 60000);
  g.textAlign = 'center'; g.fillStyle = INK;
  g.fillText(`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()]} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, w / 2, h / 2 + 2);
  g.textAlign = 'right'; g.fillStyle = DIM; g.font = `${Math.round(h * 0.38)}px ${MONO}`;
  const s = d.world?.stats || {};
  g.fillText(`${d.projects.length} projects · ${d.agents.length} agents · ${s.tasksDone || 0} cards finished · ${s.tools || 0} tool calls · ${d.world?.today?.weather || ''}`, w - 28, h / 2 + 2);
}

/** The strip along the bottom: what just happened, newest first. */
function drawTicker(g, w, h, d) {
  g.fillStyle = '#070b14'; g.fillRect(0, 0, w, h);
  g.fillStyle = LINE; g.fillRect(0, 0, w, 2);
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `${Math.round(h * 0.44)}px ${MONO}`;
  let x = 28;
  const items = d.activity.slice(-14).reverse();
  if (!items.length) { g.fillStyle = FAINT; g.fillText('nothing has happened yet', x, h / 2 + 2); return; }
  for (const item of items) {
    const when = `${ago(d.now - item.t)} `, text = String(item.text || '').replace(/\s+/g, ' ');
    g.fillStyle = item.kind === 'needs-you' ? AMBER : item.kind === 'task-done' || item.kind === 'discovery' ? GREEN : FAINT;
    g.fillText(when, x, h / 2 + 2); x += g.measureText(when).width;
    g.fillStyle = item.kind === 'needs-you' ? '#ffd9a0' : '#aab4c6';
    g.fillText(text, x, h / 2 + 2); x += g.measureText(text).width + 56;
    if (x > w) break;
  }
}

export async function enter(office) {
  const net = office.net;
  const w = createWorld(office, {
    id: 'mission', background: '#06080e', shadows: 12,
    camera: { fov: 46, yaw: 0, pitch: 0.1, dist: 7.8, minDist: 3.5, maxDist: 14, minPitch: 0.03, maxPitch: 1.2, height: 1.85, anchor: { x: 0, z: -0.6, pull: 0.9 } },
    look: { tilt: 0, bloom: 0.34, glow: 1.9 },
    hint: 'WASD to walk · drag to look round · E in front of a screen to read it · E at a console to go to that project',
  });
  const { scene } = w;
  w.light({ sky: '#8fa3d8', ground: '#262838', hemi: 0.85, sun: '#c8d4ff', power: 0.7, dir: [0.2, 1, 0.6] });
  w.room({ ...ROOM, wall: WALLS.server(), floor: FLOORS.raised('#3a3f4a'), lift: { side: 'W', at: 2.4 }, shaft: WALLS.steel() });

  /* ---- the wall ----------------------------------------------------------------------------------- */
  let data = read(net);
  const hang = (s, x, y, bezel = 0.07) => {
    w.add(s.mesh, x, WALL_Z + 0.05, 'S', y);
    w.box(x - s.mesh.geometry.parameters.width / 2 - bezel, y - s.mesh.geometry.parameters.height / 2 - bezel, WALL_Z, x + s.mesh.geometry.parameters.width / 2 + bezel, y + s.mesh.geometry.parameters.height / 2 + bezel, WALL_Z + 0.045, '#14171f', { cast: false });
    return s;
  };
  const screens = {
    who: hang(w.screen(4.6, 1.9, (g, cw, ch) => drawWho(g, cw, ch, data), { ppm: 240 }), -5.1, 1.92),
    waiting: hang(w.screen(5.3, 1.9, (g, cw, ch) => drawWaiting(g, cw, ch, data), { ppm: 240 }), 0, 1.92),
    boards: hang(w.screen(4.6, 1.9, (g, cw, ch) => drawBoards(g, cw, ch, data), { ppm: 240 }), 5.1, 1.92),
    header: hang(w.screen(14.8, 0.34, (g, cw, ch) => drawHeader(g, cw, ch, data), { ppm: 200 }), 0, 3.14, 0.04),
    ticker: hang(w.screen(14.8, 0.26, (g, cw, ch) => drawTicker(g, cw, ch, data), { ppm: 200 }), 0, 0.72, 0.04),
  };
  // the light the wall throws into the room: amber while anyone is waiting, calm otherwise
  const spill = [-5.1, 0, 5.1].map((x) => w.lamp(x, 2.1, WALL_Z + 1.5, '#7ab8ff', 5, 9));
  const mood = new THREE.Color();

  /* ---- a console for every project ----------------------------------------------------------------- */
  const SPOTS = [[-1.9, -1.3], [1.9, -1.3], [-5.3, -1.3], [5.3, -1.3], [-1.9, 1.7], [1.9, 1.7], [-5.3, 1.7], [5.3, 1.7]];
  const consoles = [];
  const crtGeo = w.own(new THREE.PlaneGeometry(CRT_SCREEN.w, CRT_SCREEN.h));
  SPOTS.forEach(([x, z], i) => {
    w.prop('desk', x, z, 'N');
    const crt = w.prop('crt', x + 3 * VOXEL, z - 5 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
    w.prop('keyboard', x + 3 * VOXEL, z + 10 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
    w.prop('chair', x, z + 0.62, 'N', { o: { color: ['#4d5a78', '#5a4d6e', '#3f5f66', '#6a5648'][i % 4] }, solid: false });
    const picture = new THREE.Mesh(crtGeo, office.screens.material('off'));
    picture.position.set(CRT_SCREEN.x, CRT_SCREEN.y, CRT_SCREEN.z);
    crt.children[0].add(picture);                               // the prop's own group is in voxel units
    w.box(x - 0.76, DESK_H * VOXEL, z - 0.02, x - 0.72, 1.36, z + 0.02, '#3a3f4a', { cast: false });      // a flag pole for the name
    const entry = { x, z, picture, plate: null, project: null, kind: 'off' };
    entry.thing = w.thing({ x, z: z + 0.7, label: 'an empty console', reach: 1.25, hidden: () => !entry.project,
      use: () => { if (entry.project) w.leave('goto', { room: `dept:${entry.project.id}` }); } });
    consoles.push(entry);
  });
  function seatProjects() {
    consoles.forEach((c, i) => {
      const p = data.projects[i] || null;
      if ((p?.id || null) !== (c.project?.id || null) || (p && p.name !== c.project?.name)) {
        if (c.plate) { scene.remove(c.plate); c.plate = null; }
        if (p) {
          c.plate = w.add(w.sign(p.name.toUpperCase().slice(0, 18), { height: 0.2, bg: '#1a2236', fg: '#dfe6f0', accent: p.color || ['#3f7d74', '#5a6fa8', '#8a5a8f', '#6f8a4a', '#b5683f', '#c9893f', '#3f7f9a', '#8a5a62'][hashId(String(p.id)) % 8] }), c.x - 0.74, c.z + 0.03, 'S', 1.3);
          c.plate.position.x += c.plate.geometry.parameters.width / 2 + 0.03;
          c.thing.label = `${p.name} — go to its room`;
        }
      }
      c.project = p;
      // the monitor says how that team is doing, in the same pictures the office's own monitors use
      const states = (p?.agents || []).map(stateOf);
      const kind = !p ? 'off' : states.includes('needs') ? 'blocked' : states.includes('working') ? office.screens.codeKind(hashId(String(p.id))) : states.includes('thinking') ? 'think' : states.length ? 'idle' : 'off';
      if (kind !== c.kind) { c.kind = kind; c.picture.material = office.screens.material(kind); }
    });
  }

  /* ---- stand in front of a screen to read it properly ----------------------------------------------- */
  w.prop('lectern', 0, -3.1, 'S');
  let reading = null;
  for (const [key, x, wide, label] of [['who', -5.1, 4.6, 'who is on what'], ['waiting', 0, 5.3, 'who is waiting on you'], ['boards', 5.1, 4.6, 'the boards']]) {
    w.thing({ x, z: key === 'waiting' ? -2.55 : -3.3, label: `read: ${label}`, reach: key === 'waiting' ? 1.2 : 1.5,
      use() {
        reading = key;
        w.focus([x, 1.92, WALL_Z + wide * 1.34], [x, 1.92, WALL_Z], { fov: 30, alone: true, onLeave: () => { reading = null; } });
      } });
  }
  w.onKey((k) => {                                               // 1–9 while reading the middle screen: go to whoever is on that line
    if (reading !== 'waiting' || !/^[1-9]$/.test(k)) return;
    const p = data.waiting[Number(k) - 1];
    if (p) w.leave('goto', { agent: p.agentId });
  });

  /* ---- the rest of the room (set dressing) --------------------------------------------------------- */
  w.prop('rack', 7.45, -3.9, 'W'); w.prop('rack', 7.45, -2.95, 'W', { id: 'mission:rack2' }); w.prop('rack', 7.45, -2.0, 'W', { id: 'mission:rack3' });
  w.prop('console', 6.9, 4.3, 'N'); w.prop('acunit', 7.4, 3.2, 'W');
  w.prop('planttall', -7.4, -4.4, 'S'); w.prop('planttall', -7.4, 4.4, 'S', { id: 'mission:pt2' }); w.prop('plant', 7.4, 0.4, 'S');
  w.prop('cooler', -7.5, -0.6, 'E'); w.prop('globe', -7.3, -2.2, 'E'); w.prop('whiteboard', 3.2, 4.72, 'N', { solid: false });
  w.prop('floorlamp', -7.4, 0.9, 'S'); w.lamp(-7.4, 1.6, 0.9, '#ffc98a', 5, 7);
  w.lamp(6.6, 1.3, -3.0, '#8fb8ff', 3, 6);

  /* ---- keeping it true ----------------------------------------------------------------------------- */
  let stale = true, drawnAt = -9, clockAt = 0;
  const touch = () => { stale = true; };
  for (const event of ['snapshot', 'agent', 'remove', 'prompts', 'tasks', 'activity', 'world', 'place']) w.on(event, touch);
  // what happened before this page was opened: ask the daemon once
  net.api('/api/activity?limit=40').then((r) => {
    const have = new Set(net.state.activity.map((i) => `${i.t}|${i.text}`));
    const older = (r?.items || []).filter((i) => !have.has(`${i.t}|${i.text}`));
    if (older.length) { net.state.activity.unshift(...older); net.state.activity.sort((a, b) => a.t - b.t); touch(); }
  }).catch(() => null);
  function redraw() {
    data = read(net);
    for (const s of Object.values(screens)) s.redraw();
    seatProjects();
    mood.set(data.waiting.length ? '#ffb060' : '#6fa8ff');
    spill.forEach((l, i) => { l.color.copy(mood); if (i !== 1) l.color.lerp(new THREE.Color('#6fa8ff'), 0.6); });
  }
  redraw();
  w.onFrame((dt, t) => {
    if ((stale && t - drawnAt > 0.4) || t - clockAt > 15) { stale = false; drawnAt = t; clockAt = t; redraw(); }
    const breathe = data.waiting.length ? 0.85 + 0.15 * Math.sin(t * 2.4) : 1;
    spill[1].intensity = 6.5 * breathe;
  });

  return w.run();
}
