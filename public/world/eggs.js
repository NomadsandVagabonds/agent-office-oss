// The Office — things worth finding (the client's half; the list lives in
// core/secrets.mjs and the daemon records who found what).
//
// Nothing here is needed to use the office. It is here because a place people
// and agents share all day ought to reward poking at it.
import * as THREE from 'three';
import { Vox, M, glow } from './vox/vox.js';
import { meshVox } from './vox/mesher.js';
import { VOXEL } from './vox/vox.js';
import { buildDeskItem } from './scene/deskitems.js';
import { buildProp, hasProp } from './props/index.js';
import { DESK } from './props/office.js';
import { canvasTexture, FLOORS } from './scene/textures.js';
import { faceAngle } from '/core/layout.mjs';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const TOUR = ['library', 'kitchen', 'plaza', 'foyer', 'closet', 'server'];
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createEggs(office) {
  const { scene } = office.stage;
  const net = office.net;
  const say = (text, opt) => office.walk?.narrate(text, opt);
  const found = (secret) => net.api('/api/world/discover', { method: 'POST', body: { secret, name: office.walk?.me?.name || 'Lead' } }).catch(() => null);
  const once = (key) => { try { if (localStorage.getItem('office.egg.' + key)) return false; localStorage.setItem('office.egg.' + key, '1'); } catch { /* still fine */ } return true; };

  /* ---- up up down down ------------------------------------------------------------- */
  let seq = 0;
  window.addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    seq = k === KONAMI[seq] ? seq + 1 : k === KONAMI[0] ? 1 : 0;
    if (seq === KONAMI.length) {
      seq = 0;
      net.api('/api/world/disco', { method: 'POST', body: { seconds: 26 } }).catch(() => {});
      found('konami');
    }
  });

  /* ---- disco ------------------------------------------------------------------------ */
  const disco = { until: 0, amount: 0, group: new THREE.Group(), spots: [], ball: null, t: 0 };
  scene.add(disco.group);
  disco.group.visible = false;
  // a soft-edged pool of light, as a texture
  const pool = canvasTexture(64, 64, (c) => {
    const grad = c.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
  }, { clamp: true });
  pool.magFilter = THREE.LinearFilter;
  for (let i = 0; i < 6; i++) {
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: pool, color: ['#ff5fa8', '#5fd0ff', '#ffe25f', '#8dff7a', '#c59af0', '#ff8a5f'][i], transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spot.rotation.x = -Math.PI / 2; spot.position.y = 0.03; spot.renderOrder = 5;
    disco.group.add(spot); disco.spots.push(spot);
  }
  function startDisco(until) {
    disco.until = until;
    if (!disco.ball && hasProp('discoball')) {
      disco.ball = buildProp('discoball', { id: 'discoball:plaza' });
      disco.group.add(disco.ball);
    }
    office.ui?.toast('The lights drop. Somewhere, a mirror ball spins up.', { gold: true });
  }
  net.on('fx', (fx) => { if (fx.kind === 'disco') startDisco(fx.until); });

  function updateDisco(dt) {
    const on = net.now() < disco.until;
    disco.amount += ((on ? 1 : 0) - disco.amount) * (1 - Math.exp(-3 * dt));
    office.lighting.setDim?.(disco.amount);
    disco.group.visible = disco.amount > 0.01;
    if (!disco.group.visible) return;
    disco.t += dt;
    const c = office.world?.layout.spots.plaza || { x: 0, z: 3.6 };
    disco.spots.forEach((s, i) => {
      const a = disco.t * (0.7 + i * 0.13) + i * 1.05, r = 2.2 + 2.6 * Math.sin(disco.t * 0.5 + i);
      s.position.x = c.x + Math.cos(a) * r; s.position.z = c.z + Math.sin(a) * r * 0.8;
      s.material.opacity = 0.6 * disco.amount;
    });
    if (disco.ball) {
      disco.ball.position.set(c.x, (1 - disco.amount) * 3.5, c.z + 0.6);       // lowers itself in from above
      disco.ball.rotation.y += dt * 1.4;
    }
    // whoever is idle in the commons cannot help themselves
    if (on && Math.floor(disco.t * 0.5) !== Math.floor((disco.t - dt) * 0.5)) {
      for (const p of office.people?.people.values() || []) {
        if (p.agent.turn === 'idle' && !p.walking && ['plaza', 'kitchen', 'library', 'foyer', 'backroom'].includes(p.place?.room)) office.people.emote(p.id, 'dance');
      }
    }
  }

  /* ---- offices all the way up: zoom out far enough ------------------------------------- */
  const big = { group: null, amount: 0 };
  function buildBigDesk() {
    const g = new THREE.Group();
    const fade = [];
    const mat = (opt) => { const m = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, ...opt }); fade.push(m); return m; };
    const wood = FLOORS.wood('#8a5a34');
    const top = wood.tex.clone(); top.repeat.set(5, 5); top.needsUpdate = true;
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat({ map: top }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.46;
    // a mug the size of a water tower
    const mug = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(17, 15, 34, 28, 1, true), mat({ color: '#cf6b4b', side: THREE.DoubleSide }));
    body.position.y = 17;
    const base = new THREE.Mesh(new THREE.CircleGeometry(15, 28), mat({ color: '#a8543a' })); base.rotation.x = -Math.PI / 2; base.position.y = 0.2;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(16.4, 28), mat({ color: '#3a2416' })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 30;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(9, 2.6, 10, 20, Math.PI), mat({ color: '#cf6b4b' })); handle.rotation.z = -Math.PI / 2; handle.position.set(17, 17, 0);
    mug.add(body, base, coffee, handle); mug.position.set(-92, -0.46, -58);
    // a keyboard like a city block
    const keys = canvasTexture(128, 44, (c, w, hh) => {
      c.fillStyle = '#b3aa94'; c.fillRect(0, 0, w, hh);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 15; x++) { c.fillStyle = (x + y) % 2 ? '#d8d0bb' : '#cfc6b0'; c.fillRect(3 + x * 8.2 + (y % 2) * 2, 3 + y * 8, 6.6, 6.4); }
      c.fillStyle = '#d8d0bb'; c.fillRect(36, 35, 52, 6);
    });
    const kb = new THREE.Mesh(new THREE.BoxGeometry(170, 5, 58), [mat({ color: '#b3aa94' }), mat({ color: '#b3aa94' }), mat({ map: keys }), mat({ color: '#8f8774' }), mat({ color: '#b3aa94' }), mat({ color: '#b3aa94' })]);
    kb.position.set(10, 2.1, 108); kb.rotation.y = 0.06;
    // a sticky note with a familiar message
    const note = canvasTexture(64, 64, (c) => { c.fillStyle = '#f2d45c'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#3a3340'; c.font = '9px monospace'; c.fillText('TODO:', 6, 16); c.fillText('zoom', 6, 30); c.fillText('back in', 6, 42); c.fillText(':)', 44, 58); }, { clamp: true });
    const sticky = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), mat({ map: note })); sticky.rotation.x = -Math.PI / 2; sticky.rotation.z = -0.22; sticky.position.set(112, -0.4, -42);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 120, 6), mat({ color: '#e8b33c' })); pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.5; pencil.position.set(-30, 1.8, -96);
    g.add(desk, mug, kb, sticky, pencil);
    g.userData.fade = fade;
    scene.add(g);
    return g;
  }
  function updateDiorama() {
    const dist = office.rig.cur.dist;
    const want = smooth(dist, 105, 150);
    if (want <= 0 && !big.group) return;
    if (!big.group) big.group = buildBigDesk();
    if (Math.abs(want - big.amount) > 0.002) {
      big.amount = want;
      for (const m of big.group.userData.fade) m.opacity = want;
      big.group.visible = want > 0.004;
      office.lighting.ground.visible = want < 0.98;
      if (scene.fog) { scene.fog.near = 160 + want * 500; scene.fog.far = 420 + want * 900; }
    }
    if (dist > 150 && once('diorama')) { found('diorama'); say('Oh. The office is on a desk. Whose desk?'); }
  }

  /* ---- the night shift ------------------------------------------------------------------ */
  const ghost = { root: null, x: 0, z: 1.5, t: 0, met: false };
  function buildGhost() {
    const v = new Vox();
    const w = M('#eef2ff', 0);
    v.rbox(-6, 2, -5, 6, 22, 5, 5, w);
    for (let x = -6; x < 6; x++) if (((x + 6) >> 1) % 2) v.carve(x, 2, -5, x + 1, 4, 5);          // a ragged hem
    v.set(-3, 15, 5, M('#2b2b33', 0)); v.set(-3, 14, 5, M('#2b2b33', 0)); v.set(2, 15, 5, M('#2b2b33', 0)); v.set(2, 14, 5, M('#2b2b33', 0));
    v.box(-1, 10, 5, 1, 11, 6, M('#2b2b33', 0));
    v.set(-5, 12, 5, glow('#ffb4c8')); v.set(4, 12, 5, glow('#ffb4c8'));
    const meshed = meshVox(v);
    const mesh = new THREE.Mesh(meshed.solid, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, emissive: '#8fa6ff', emissiveIntensity: 0.5 }));
    const g = new THREE.Group(); mesh.scale.setScalar(VOXEL); g.add(mesh);
    scene.add(g);
    return g;
  }
  function updateGhost(dt) {
    const hour = office.lighting.hour;
    const night = hour >= 0 && hour < 5;
    if (!night) { if (ghost.root) ghost.root.visible = false; office.ghost = null; return; }
    if (!ghost.root) ghost.root = buildGhost();
    ghost.root.visible = true;
    ghost.t += dt;
    const lay = office.world?.layout;
    const half = lay ? (lay.eastX - 1.5) : 16;
    // drifts up and down the corridor, pausing to look into rooms
    const u = Math.sin(ghost.t * 0.11);
    ghost.x = u * half; ghost.z = 1.5 + Math.sin(ghost.t * 0.7) * 0.6;
    ghost.root.position.set(ghost.x, 0.35 + Math.sin(ghost.t * 1.9) * 0.12, ghost.z);
    ghost.root.rotation.y = Math.cos(ghost.t * 0.11) > 0 ? Math.PI / 2 : -Math.PI / 2;
    office.ghost = ghost;
  }
  function meetGhost() {
    say(ghost.met ? 'The ghost waves. It has paperwork to get back to.' : 'Boo! …it looks pleased with itself. The night shift, apparently. It seems friendly.');
    if (!ghost.met) { ghost.met = true; found('ghost'); }
  }

  /* ---- a duck, on somebody's desk, once a day --------------------------------------------- */
  let duckNode = null;
  function placeDuck() {
    const w = office.world, deskId = net.state.world?.today?.duckDesk;
    if (duckNode) { duckNode.parent?.remove(duckNode); duckNode = null; office.duck = null; }
    const desk = w && deskId ? w.furniture.desks.get(deskId) : null;
    if (!desk || !desk.holder) return;
    duckNode = buildDeskItem('duck', 'office-duck');
    duckNode.position.set(-27 * VOXEL, DESK.top * VOXEL, -9 * VOXEL);
    duckNode.rotation.y = -faceAngle(desk.desk.face) + 0.4;
    desk.holder.add(duckNode);
    const p = new THREE.Vector3(-27 * VOXEL, 0, -9 * VOXEL);
    desk.holder.updateWorldMatrix(true, false);
    desk.holder.localToWorld(p);
    office.duck = { x: p.x, z: p.z, y: DESK.top * VOXEL + 0.12 };
  }

  /* ---- the tree keeps count ---------------------------------------------------------------- */
  const stageFor = (done) => (done < 1 ? 0 : done < 3 ? 1 : done < 10 ? 2 : done < 30 ? 3 : 4);
  let treeStage = -1;
  function growTree(done) {
    const stage = stageFor(done || 0);
    if (stage === treeStage || !office.world) return;
    const grew = treeStage >= 0 && stage > treeStage;
    treeStage = stage;
    office.world.furniture.setTreeStage?.(stage);
    if (grew) { const t = office.world.layout.objects.find((o) => o.type === 'tree'); if (t) office.fx.confetti(t.x, t.z, 50, 2.2); office.ui?.toast('The office tree just grew.', { gold: true }); }
  }
  net.on('fx', (fx) => { if (fx.kind === 'confetti' && Number.isFinite(fx.tasksDone)) growTree(fx.tasksDone); });

  /* ---- the whole floor, on foot ------------------------------------------------------------- */
  let toured = null;
  function tour() {
    const pos = office.walk?.position;
    const room = pos && office.world?.layout.roomAt(pos.x, pos.z);
    if (!room) return;
    if (!toured) { try { toured = new Set(JSON.parse(localStorage.getItem('office.tour') || '[]')); } catch { toured = new Set(); } }
    if (toured.has(room)) return;
    toured.add(room);
    try { localStorage.setItem('office.tour', JSON.stringify([...toured])); } catch { /* fine */ }
    if (TOUR.every((id) => toured.has(id)) && once('cartographer')) found('cartographer');
  }

  /* ---- something feels slightly off (Friday the 13th) ---------------------------------------- */
  let flickerAt = 20;
  function quirks(dt, t) {
    const q = net.state.world?.today?.quirks || [];
    if (!q.includes('friday-13')) return;
    if (t > flickerAt) { flickerAt = t + 25 + Math.random() * 50; office.lighting.flicker?.(); }
  }

  /* ---- out of bounds ----------------------------------------------------------------------- */
  // The north-west corner of the Speakeasy is not as solid as the rest. Lean on it.
  let falling = false;
  function softSpot() {
    const lay = office.world?.layout;
    const room = lay?.roomById.get('backroom');
    office.softSpot = room && !room.locked ? { x: room.rect.x + 0.3, z: room.rect.z + 0.3 } : null;
  }
  office.onNoclip = async () => {
    if (falling) return;
    falling = true;
    found('noclip');
    document.body.classList.add('noclip');
    let level = null;
    try { level = await import('./backrooms/index.js'); } catch { level = null; }
    if (!level?.enterBackrooms) {
      say('The wall gives a little, like wet cardboard, and then thinks better of it.');
      document.body.classList.remove('noclip'); falling = false;
      return;
    }
    office.walk.exit();
    let result = null;
    try { result = await level.enterBackrooms(office, { name: office.walk.me.name, seed: Date.now() }); }
    catch (err) { console.error('[office] backrooms', err); }
    office.stage.setView(null);
    document.body.classList.remove('noclip');
    falling = false;
    office.rig.flyTo({ x: -4, z: -6.3, dist: 9, yaw: 0, pitch: 0.62 }, { instant: true });      // you come to by the bookshelf
    office.walk.enter();
    if (result?.reason === 'exit') { found('way-out'); say('A door. An ordinary door. You are back by the bookshelf, and the carpet is the right colour again.'); }
    else if (result?.reason === 'caught') say('You wake up by the bookshelf with the distinct feeling of having been filed.');
    else say('You are back by the bookshelf. Nobody saw anything.');
  };

  net.on('world', () => { treeStage = -1; growTree(net.state.world?.stats?.tasksDone || 0); placeDuck(); softSpot(); });

  let tick = 0;
  return {
    meetGhost,
    /** A human used something: the client's share of the consequences. */
    used(target, result) {
      if (target.kind === 'painting' && result?.ok) say(result.text, { actions: [{ label: 'Step into the painting →', href: '/classic/' }] });
    },
    update(dt, t) {
      updateDisco(dt);
      updateDiorama();
      updateGhost(dt);
      quirks(dt, t);
      if ((tick++ & 31) === 0) tour();
    },
  };
}
