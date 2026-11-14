// The Office — the parts of furniture that are alive: the big board's
// picture, the arcade cabinets' attract screens, the ops console, the hands
// of the wall clock, the mirror ball. The props themselves are static
// sculptures (../props); each exports where its live part goes.
import * as THREE from 'three';
import * as FUN from '../props/fun.js';
import * as WORKS from '../props/works.js';
import * as LOUNGE from '../props/lounge.js';
import { FUELSTAND } from '../props/gauges.js';
import { TASK_STATUS } from '/core/contract.mjs';

const COL = { backlog: '#b9c2cf', todo: '#f2d45c', doing: '#6fb6e8', blocked: '#ee6f5e', review: '#c59af0', done: '#7fd08a' };
const DOT = { working: '#5fe08a', thinking: '#7ab8ff', blocked: '#ffb44a', done: '#7fd0c0', idle: '#8d86a0' };

function screenPlane(anchor, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(anchor.w, anchor.h), material);
  mesh.position.set(anchor.x, anchor.y, anchor.z);
  return mesh;
}

export function createDynamics(office) {
  const spinning = [];
  let clock = null, board = null, boardDirty = true, boardAt = 0;

  /* ---- the fuel stand: one tank per provider, filled to what it has left ---------- */
  const LIQUID = { claude: '#e8702e', codex: '#1fb884', gemini: '#3f7ff0', openrouter: '#7a62f0', opencode: '#e0b62a' };
  const ORDER = ['claude', 'codex', 'gemini', 'openrouter', 'opencode'];
  const SHORT = { claude: 'CLAUDE', codex: 'CODEX', gemini: 'GEMINI', openrouter: 'ROUTER', opencode: 'OPENCODE' };
  let fuel = null;
  function plate(anchor, x, scale) {
    const canvas = document.createElement('canvas'); canvas.width = anchor.w * scale; canvas.height = anchor.h * scale;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(anchor.w, anchor.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    mesh.position.set(x, anchor.y, anchor.z);
    return { canvas, g: canvas.getContext('2d'), tex, mesh };
  }
  function write(p, text, color, font) {
    const { g, canvas } = p;
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (text) { g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, canvas.width / 2, canvas.height / 2 + 1, canvas.width - 4); }
    p.tex.needsUpdate = true;
  }
  function makeFuel(prop) {
    const F = FUELSTAND, tanks = [];
    for (const x of F.tanks) {
      const geo = new THREE.CylinderGeometry(F.r, F.r, 1, 18); geo.translate(0, 0.5, 0);       // grows upward from its base
      const liquid = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#888888' }));
      liquid.position.set(x, F.y0, 0); liquid.visible = false;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(F.lamp.r, 10, 8), new THREE.MeshBasicMaterial({ color: '#3a1714', toneMapped: false }));
      lamp.position.set(x, F.lamp.y, 0);
      const name = plate(F.plaque, x, 10), figure = plate(F.readout, x, 10);
      prop.add(liquid, lamp, name.mesh, figure.mesh);
      tanks.push({ liquid, lamp, name, figure, level: 0, target: 0, low: false, shown: '' });
    }
    return { tanks };
  }
  function readFuel() {
    if (!fuel) return;
    const meters = (office.net.state.usage?.meters || []).slice()
      .sort((a, b) => ((ORDER.indexOf(a.provider) + 1) || 99) - ((ORDER.indexOf(b.provider) + 1) || 99) || a.label.localeCompare(b.label));
    fuel.tanks.forEach((tank, i) => {
      const m = meters[i] || null, known = !!m && m.left !== null;
      tank.target = known ? Math.max(0, Math.min(1, m.left / 100)) : 0;
      tank.low = known && !m.stale && m.left <= 12;
      const key = m ? `${m.id}:${known ? Math.round(m.left) : '-'}:${m.stale}` : '';
      if (key === tank.shown) return;
      tank.shown = key;
      const base = new THREE.Color(m ? (LIQUID[m.provider] || '#c9c36a') : '#888888');
      if (m?.stale) base.lerp(new THREE.Color('#8d8d86'), 0.6);                       // an old reading looks like one
      tank.liquid.material.color.copy(base);
      tank.liquid.material.emissive.copy(base).multiplyScalar(m?.stale ? 0.1 : 0.62);      // lit from within, so it reads through the glass
      write(tank.name, m ? (SHORT[m.provider] || m.provider.toUpperCase().slice(0, 8)) : '', '#2a2114', '700 26px ui-monospace, Menlo, monospace');
      write(tank.figure, known ? `${Math.round(m.left)}%` : (m ? '··' : ''), m?.stale ? '#8f8a78' : tank.low ? '#ff6a4a' : '#ffd27a', '700 36px ui-monospace, Menlo, monospace');
    });
  }

  /* ---- the big board: every project at a glance -------------------------------- */
  function makeBoard(anchor) {
    const W = Math.round(anchor.w * 4), H = Math.round(anchor.h * 4);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    material.color.setScalar(1.15);
    return { canvas, g: canvas.getContext('2d'), tex, material, W, H };
  }
  function drawBoard() {
    if (!board) return;
    const { g, W, H } = board;
    const net = office.net;
    g.fillStyle = '#0d1118'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f0b860'; g.font = '600 15px ui-monospace, Menlo, monospace'; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillText('THE BIG BOARD', 14, 10);
    const agents = [...net.state.agents.values()];
    const needs = agents.filter((a) => a.status === 'blocked' && a.blockKind !== 'idle').length;
    g.textAlign = 'right'; g.fillStyle = needs ? '#ffb44a' : '#6f7a8c'; g.font = '13px ui-monospace, Menlo, monospace';
    g.fillText(needs ? `${needs} waiting on a human` : `${agents.length} in the office`, W - 14, 12);
    const rooms = (net.state.world?.plan?.rooms || []).slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
    const rowH = Math.min(30, (H - 44) / Math.max(1, rooms.length));
    rooms.forEach((r, i) => {
      const y = 38 + i * rowH;
      const tasks = net.state.tasks.get(r.deptId) || [];
      const here = agents.filter((a) => a.department?.id === r.deptId);
      g.textAlign = 'left'; g.fillStyle = '#e8e2d0'; g.font = '14px ui-monospace, Menlo, monospace';
      g.fillText(r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name, 14, y + 2);
      here.slice(0, 8).forEach((a, k) => {                       // one dot per agent, coloured by what they are doing
        const key = a.status === 'blocked' && a.blockKind !== 'idle' ? 'blocked' : a.turn === 'idle' ? 'idle' : a.status;
        g.fillStyle = DOT[key] || DOT.idle; g.beginPath(); g.arc(168 + k * 13, y + 10, 4.5, 0, 7); g.fill();
      });
      const x0 = 280, wBar = W - x0 - 16, total = Math.max(1, tasks.length);        // the board, as one stacked bar
      let x = x0;
      g.fillStyle = '#1a2130'; g.fillRect(x0, y + 4, wBar, rowH - 12);
      for (const status of TASK_STATUS) {
        const n = tasks.filter((t) => t.status === status).length;
        if (!n) continue;
        const w = (n / total) * wBar;
        g.fillStyle = COL[status]; g.fillRect(x, y + 4, Math.max(1, w - 1), rowH - 12);
        x += w;
      }
    });
    if (!rooms.length) { g.fillStyle = '#6f7a8c'; g.textAlign = 'center'; g.font = '14px ui-monospace, Menlo, monospace'; g.fillText('no projects yet — the board fills in as agents arrive', W / 2, H / 2); }
    board.tex.needsUpdate = true;
  }

  /** Attach the live parts to freshly built furniture. Call after every world build. */
  function bind() {
    const w = office.world;
    spinning.length = 0; clock = null; fuel = null;
    if (!w) return;
    const screens = office.screens;
    for (const o of w.layout.objects) {
      const holder = w.furniture.nodes.get(o.id);
      const prop = holder?.children[0];                  // the scaled voxel group: children are in voxel units
      if (!prop || prop.userData.standIn) continue;
      if (o.type === 'bigboard' && WORKS.BIGBOARD_SCREEN) {
        board ||= makeBoard(WORKS.BIGBOARD_SCREEN);
        prop.add(screenPlane(WORKS.BIGBOARD_SCREEN, board.material));
        boardDirty = true;
      } else if (o.type === 'arcade' && FUN.ARCADE_SCREEN) {
        prop.add(screenPlane(FUN.ARCADE_SCREEN, screens.material('arcade')));
      } else if (o.type === 'console' && WORKS.CONSOLE_SCREEN) {
        prop.add(screenPlane(WORKS.CONSOLE_SCREEN, screens.material('code0')));
      } else if (o.type === 'clock' && LOUNGE.CLOCK_FACE) {
        const f = LOUNGE.CLOCK_FACE;
        const mat = new THREE.MeshBasicMaterial({ color: '#2b2430' });
        const hand = (len, wide) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wide, len, 0.5), mat); m.geometry.translate(0, len / 2 - 0.4, 0); const p = new THREE.Group(); p.position.set(f.x, f.y, f.z + 0.35); p.add(m); prop.add(p); return p; };
        clock = { hour: hand(f.r * 0.52, 1.2), minute: hand(f.r * 0.82, 0.8) };
      } else if (o.type === 'fuelstand') {
        fuel = makeFuel(prop);
        readFuel();
      } else if (o.type === 'discoball') spinning.push(prop);
    }
  }

  const off = [office.net.on('tasks', () => { boardDirty = true; }), office.net.on('agent', () => { boardDirty = true; }),
    office.net.on('remove', () => { boardDirty = true; }), office.net.on('world', () => { boardDirty = true; }),
    office.net.on('usage', () => readFuel())];

  return {
    bind,
    update(dt, t) {
      for (const s of spinning) s.rotation.y += dt * 0.9;
      if (clock) {
        const h = office.lighting.hour;
        clock.hour.rotation.z = -((h % 12) / 12) * Math.PI * 2;
        clock.minute.rotation.z = -(h % 1) * Math.PI * 2;
      }
      if (board && boardDirty && t - boardAt > 1) { boardDirty = false; boardAt = t; drawBoard(); }
      if (fuel) {
        const span = FUELSTAND.y1 - FUELSTAND.y0;
        fuel.tanks.forEach((tank, i) => {
          tank.level += (tank.target - tank.level) * (1 - Math.exp(-2.2 * dt));              // it pours, it does not jump
          const h = tank.level * span + (tank.level > 0.004 ? Math.sin(t * 1.7 + i * 1.9) * 0.12 : 0);
          tank.liquid.visible = h > 0.15;
          tank.liquid.scale.y = Math.max(0.15, h);
          tank.lamp.material.color.set(tank.low && Math.sin(t * 5 + i) > 0 ? '#ff4a30' : '#3a1714');
        });
      }
    },
    dispose() { off.forEach((f) => f()); },
  };
}
