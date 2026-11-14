// The Office — the ride. A few seconds in the car between two floors: the
// doors close, the shaft slides past, the display over the door counts the
// floors, there is music, then a ding and the doors open somewhere else.
//
// The car is shown the way the office shows everything: as a model with the
// near wall taken away. It stays put on screen; it is the shaft that moves.
import * as THREE from 'three';
import { Avatar } from '../avatar/rig.js';
import { buildProp } from '../props/index.js';
import { FLOORS, WALLS, canvasTexture } from '../scene/textures.js';
import { h } from '../ui/dom.js';
import { resolveLook } from '/core/look.mjs';
import { LEVELS } from '/core/levels.mjs';
import { CAR, ledDisplay, quad } from './car.js';
import { curtain } from './curtain.js';

const STOREY = 3.4;                              // metres between floors, in the shaft
const T = { wait: 0.2, close: 0.75, travel: 2.7, open: 0.7, out: 0.45 };    // seconds; about 4.8 in all
// What the announcer has a recording of (tools/make-audio.mjs). Floors without one arrive on the ding alone.
const VOICE = { lobby: 'lift-lobby', roof: 'lift-roof', thirteen: 'lift-13' };
// The light that comes through the doors when they open on each floor.
const GLOW = { lobby: '#ffdcae', mission: '#5f8fe0', arcade: '#e05fc0', thirteen: '#d8c45a' };

const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * t * (t * (t * 6 - 15) + 10); };
const BY_STOREY = new Map(LEVELS.map((l) => [l.storey, l]));
/** What is painted on the shaft wall at a storey: its button's label, or just the number. */
const labelAt = (storey) => BY_STOREY.get(storey)?.floor ?? (storey > 0 ? String(storey) : `B${-storey}`);

function skyGlow(hour) {
  const h24 = ((hour % 24) + 24) % 24;
  if (h24 < 5.5 || h24 >= 20.5) return '#5a5a9a';
  if (h24 < 7.5 || h24 >= 17.5) return '#ffb07a';
  return '#bfe0ff';
}

function shaftTexture() {
  let seed = 7;
  const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return canvasTexture(64, 64, (g, w, hh) => {
    g.fillStyle = '#20222b'; g.fillRect(0, 0, w, hh);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 2; col++) {
      const k = 44 + Math.floor(r() * 12);
      g.fillStyle = `rgb(${k},${k + 3},${k + 14})`;
      g.fillRect(col * 32 + (row % 2) * 16 + 1, row * 16 + 1, 31, 15);
    }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(Math.floor(r() * w), Math.floor(r() * hh), 1, 1 + Math.floor(r() * 3)); }
  });
}

function stencil(text) {
  return canvasTexture(64, 64, (g, w, hh) => {
    g.clearRect(0, 0, w, hh);
    g.fillStyle = '#e6dcb8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${text.length > 1 ? 36 : 50}px ui-monospace, Menlo, Consolas, monospace`;
    g.fillText(text, w / 2, hh / 2 + 2);
    g.globalCompositeOperation = 'destination-out';            // the bridges of a stencil, and some wear
    g.fillRect(0, hh / 2 - 1, w, 2);
    let seed = text.charCodeAt(0) * 31 + text.length;
    for (let i = 0; i < 90; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; g.fillRect(seed % w, (seed >>> 8) % hh, 2, 1); }
    g.globalCompositeOperation = 'source-over';
  }, { clamp: true });
}

/**
 * Play one ride and resolve when the screen has gone dark at the other end.
 *
 * @param {object} office
 * @param {{from:object, to:object, floors?:object[], until?:Promise, pace?:number, glitch?:boolean}} trip
 *        from/to: levels (core/levels.mjs) · floors: the buttons to show in the car
 *        until: do not open the doors before this settles (the next floor is still loading)
 *        pace: 1 is normal; larger is slower (for looking at it) · glitch: this is not a normal floor
 */
export function playRide(office, trip) {
  const { from, to } = trip;
  const pace = trip.pace || 1, glitch = !!trip.glitch;
  const stage = office.stage;
  const dir = Math.sign(to.storey - from.storey) || 1;
  const trash = [];
  const own = (x) => { trash.push(x); return x; };
  const sfx = (name) => { try { return office.sound?.play?.(name) ?? null; } catch { return null; } };

  /* ---- the scene ------------------------------------------------------------------------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0a10');
  const camera = new THREE.PerspectiveCamera(33, stage.size.w / stage.size.h, 0.3, 80);
  const camAt = new THREE.Vector3(0, 1.78, 6.1), camLook = new THREE.Vector3(0, 1.22, -0.9);
  scene.add(new THREE.HemisphereLight('#aab4d8', '#33313c', 0.62));
  const fill = new THREE.DirectionalLight('#9fb0ff', 0.55);
  fill.position.set(1.5, 3, 5);
  scene.add(fill);
  const lampLight = new THREE.PointLight('#ffe2b8', 7, 8, 1.4);
  lampLight.position.set(0, 1.95, 0.15);
  scene.add(lampLight);

  const W = CAR.w / 2, H = CAR.h, Z0 = -0.9, Z1 = 0.9, half = CAR.door / 2;
  const car = new THREE.Group();
  scene.add(car);
  const put = (mesh) => { own(mesh.geometry); car.add(mesh); return mesh; };
  const steel = WALLS.steel(), tile = FLOORS.tile('#8a8f98', '#7d828b');
  const wallMat = own(new THREE.MeshLambertMaterial({ map: steel.tex }));
  const shellMat = own(new THREE.MeshLambertMaterial({ color: '#4c525e' }));
  const edgeMat = own(new THREE.MeshLambertMaterial({ color: '#8f97a6' }));
  const u = (m) => m / steel.tile, v = H / 2.6;
  const slab = (x0, y0, z0, x1, y1, z1, mat = shellMat) => {
    const m = new THREE.Mesh(own(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    car.add(m);
    return m;
  };
  // floor, two walls and a ceiling, each with its thickness showing where the near wall was cut away
  put(quad(own(new THREE.MeshLambertMaterial({ map: tile.tex })), [-W, 0, Z1], [W, 0, Z1], [W, 0, Z0], [-W, 0, Z0], [0, 0, CAR.w, Z1 - Z0]));
  put(quad(wallMat, [-W, 0, Z1], [-W, 0, Z0], [-W, H, Z0], [-W, H, Z1], [0, 0, u(Z1 - Z0), v]));
  put(quad(wallMat, [W, 0, Z0], [W, 0, Z1], [W, H, Z1], [W, H, Z0], [0, 0, u(Z1 - Z0), v]));
  put(quad(own(new THREE.MeshLambertMaterial({ color: '#c9ccd2' })), [-W, H, Z0], [W, H, Z0], [W, H, Z1], [-W, H, Z1]));
  slab(-W - 0.08, -0.14, Z0 - 0.08, W + 0.08, -0.002, Z1);
  slab(-W - 0.08, 0, Z0 - 0.08, -W - 0.002, H, Z1); slab(W + 0.002, 0, Z0 - 0.08, W + 0.08, H, Z1);
  slab(-W - 0.08, H + 0.002, Z0 - 0.08, W + 0.08, H + 0.12, Z1);
  for (const x of [-W - 0.08, W + 0.002]) slab(x, 0, Z1 - 0.012, x + 0.078, H, Z1 + 0.004, edgeMat);       // the cut edges catch the light
  slab(-W - 0.08, -0.14, Z1 - 0.012, W + 0.08, -0.002, Z1 + 0.004, edgeMat); slab(-W - 0.08, H + 0.002, Z1 - 0.012, W + 0.08, H + 0.12, Z1 + 0.004, edgeMat);
  const lampMat = own(new THREE.MeshBasicMaterial({ color: '#fff1d6', toneMapped: false }));
  const lampPanel = put(quad(lampMat, [-0.8, H - 0.012, Z0 + 0.3], [0.8, H - 0.012, Z0 + 0.3], [0.8, H - 0.012, Z1 - 0.3], [-0.8, H - 0.012, Z1 - 0.3]));
  lampPanel.receiveShadow = false;
  const wood = own(new THREE.MeshLambertMaterial({ color: '#9a6a3c' }));
  for (const s of [-1, 1]) slab(s > 0 ? W - 0.07 : -W + 0.02, 0.8, Z0 + 0.15, s > 0 ? W - 0.02 : -W + 0.07, 0.85, Z1 - 0.15, wood);     // handrails
  // the door wall
  put(quad(wallMat, [-W, 0, Z0], [-half, 0, Z0], [-half, H, Z0], [-W, H, Z0], [0, 0, u(W - half), v]));
  put(quad(wallMat, [half, 0, Z0], [W, 0, Z0], [W, H, Z0], [half, H, Z0], [u(W + half), 0, u(CAR.w), v]));
  put(quad(wallMat, [-half, CAR.doorH, Z0], [half, CAR.doorH, Z0], [half, H, Z0], [-half, H, Z0], [u(W - half), CAR.doorH / 2.6, u(W + half), v]));
  slab(-W - 0.08, 0, Z0 - 0.08, -half, H, Z0 - 0.002); slab(half, 0, Z0 - 0.08, W + 0.08, H, Z0 - 0.002); slab(-half, CAR.doorH, Z0 - 0.08, half, H, Z0 - 0.002);
  const trim = own(new THREE.MeshLambertMaterial({ color: '#5b6270' }));
  slab(-half - 0.05, 0, Z0, -half, CAR.doorH + 0.05, Z0 + 0.03, trim); slab(half, 0, Z0, half + 0.05, CAR.doorH + 0.05, Z0 + 0.03, trim);
  slab(-half, CAR.doorH, Z0, half, CAR.doorH + 0.05, Z0 + 0.03, trim);
  const leaves = [-1, 1].map(() => { const leaf = buildProp('liftleaf', { id: 'liftleaf' }); leaf.position.z = Z0 - 0.07; car.add(leaf); return leaf; });
  const glowMat = own(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  put(quad(glowMat, [-half, 0, Z0 - 0.09], [half, 0, Z0 - 0.09], [half, CAR.doorH, Z0 - 0.09], [-half, CAR.doorH, Z0 - 0.09])).receiveShadow = false;
  const glowOf = (level) => (level.id === 'roof' ? skyGlow(office.lighting?.hour ?? 14) : GLOW[level.id] || '#ffdcae');
  const setGlow = (level, k) => glowMat.color.set(glowOf(level)).multiplyScalar(k);
  // the display over the door, and the buttons beside it
  const display = ledDisplay(72, 40);
  const led = new THREE.Mesh(own(new THREE.PlaneGeometry(0.38, 0.2)), display.material);
  led.position.set(0, (CAR.doorH + H) / 2 + 0.02, Z0 + 0.012);
  car.add(led);
  const floors = (trip.floors && trip.floors.length ? trip.floors : LEVELS.filter((l) => !l.hidden || l.id === to.id));
  const buttons = own(canvasTexture(48, 168, (g, w, hh) => {
    g.fillStyle = '#2a2d36'; g.fillRect(0, 0, w, hh);
    g.fillStyle = '#3a3e4a'; g.fillRect(2, 2, w - 4, hh - 4);
    const step = Math.min(30, (hh - 16) / floors.length);
    floors.forEach((l, i) => {
      const y = 12 + step * (i + 0.5), lit = l.id === to.id;
      g.fillStyle = lit ? '#ffb44a' : '#171920'; g.beginPath(); g.arc(w / 2, y, Math.min(11, step / 2 - 2), 0, 7); g.fill();
      g.fillStyle = lit ? '#2a1c06' : '#c9d0da'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${l.floor.length > 1 ? 9 : 12}px ui-monospace, Menlo, Consolas, monospace`;
      if (!l.unmarked) g.fillText(l.floor, w / 2, y + 1);
    });
  }, { clamp: true }));
  const buttonMat = own(new THREE.MeshBasicMaterial({ map: buttons, toneMapped: false }));
  const column = new THREE.Mesh(own(new THREE.PlaneGeometry(0.2, 0.7)), buttonMat);
  column.position.set(half + 0.3, 1.12, Z0 + 0.012);
  car.add(column);

  /* ---- the shaft: it is what moves ----------------------------------------------------------- */
  const shaft = new THREE.Group();
  scene.add(shaft);
  const lo = Math.min(from.storey, to.storey) - 2, hi = Math.max(from.storey, to.storey) + 2;
  const brick = own(shaftTexture());
  brick.repeat.set(11 / 1.6, ((hi - lo + 1) * STOREY) / 1.6);
  const back = new THREE.Mesh(own(new THREE.PlaneGeometry(11, (hi - lo + 1) * STOREY)), own(new THREE.MeshLambertMaterial({ map: brick })));
  back.position.set(0, ((hi + lo + 1) / 2) * STOREY, Z0 - 0.5);
  shaft.add(back);
  const slabMat = own(new THREE.MeshLambertMaterial({ color: '#4a4d58' })), dark = own(new THREE.MeshBasicMaterial({ color: '#07070b' }));
  const frameMat = own(new THREE.MeshLambertMaterial({ color: '#6d7582' }));
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1)), markGeo = own(new THREE.PlaneGeometry(1.25, 1.25));
  const block = (mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(boxGeo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); shaft.add(m); return m; };
  for (let k = lo; k <= hi; k++) {
    const y = k * STOREY;
    block(slabMat, 0, y - 0.13, Z0 - 0.38, 11, 0.26, 0.24);                                   // the edge of each floor
    block(dark, 0, y + CAR.doorH / 2, Z0 - 0.47, CAR.door, CAR.doorH, 0.04);                  // its landing doorway
    block(frameMat, 0, y + CAR.doorH + 0.05, Z0 - 0.44, CAR.door + 0.2, 0.1, 0.1);
    for (const s of [-1, 1]) {
      block(frameMat, s * (half + 0.05), y + CAR.doorH / 2, Z0 - 0.44, 0.1, CAR.doorH, 0.1);
      for (const dy of [0.6, 2.3]) block(frameMat, s * (W + 0.27), y + dy, Z0 - 0.4, 0.22, 0.08, 0.16);    // rail brackets
      const text = glitch && k > 2 && k < to.storey ? String(k) : labelAt(k);
      const paint = own(new THREE.MeshBasicMaterial({ map: own(stencil(text)), transparent: true, toneMapped: false, depthWrite: false }));
      paint.color.setScalar(glitch && k === to.storey ? 0.9 : 0.5);
      if (glitch && k === to.storey) paint.color.set('#ff5a4a');
      const mark = new THREE.Mesh(markGeo, paint);
      mark.position.set(s * (W + 1.25), y + 1.3, Z0 - 0.48);
      shaft.add(mark);
    }
  }
  // guide rails and cables do not move (they look the same all the way up)
  const railMat = own(new THREE.MeshLambertMaterial({ color: '#7d8694' }));
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(own(new THREE.BoxGeometry(0.07, 30, 0.07)), railMat);
    rail.position.set(s * (W + 0.27), 2, Z0 - 0.3);
    scene.add(rail);
    const cable = new THREE.Mesh(own(new THREE.BoxGeometry(0.03, 14, 0.03)), dark);
    cable.position.set(s * 0.3, H + 7.1, 0);
    scene.add(cable);
  }
  const weight = new THREE.Mesh(own(new THREE.BoxGeometry(0.34, 1.7, 0.2)), own(new THREE.MeshLambertMaterial({ color: '#3a3d47' })));
  const stripe = new THREE.Mesh(own(new THREE.BoxGeometry(0.35, 0.16, 0.21)), own(new THREE.MeshLambertMaterial({ color: '#e0a62a' })));
  weight.add(stripe);
  weight.position.set(-(W + 0.62), 50, Z0 - 0.3);
  scene.add(weight);

  /* ---- you, looking at the numbers like everybody does ----------------------------------------- */
  const who = office.walk?.me || { id: 'guest', look: null };
  const avatar = new Avatar(resolveLook('lead:' + who.id, who.look || { accessory: 'crown' }), { seed: 'lead:' + who.id, provider: 'custom' });
  avatar.root.position.set(0.12, 0, 0.22);
  avatar.root.rotation.y = Math.PI + 0.12;
  scene.add(avatar.root);

  /* ---- what is on screen besides ---------------------------------------------------------------- */
  const ui = document.getElementById('ui') || document.body;
  const root = h('div.level.ride',
    h('div.level-chip.glass', h('b.floor', to.unmarked ? '' : to.floor), h('span.name', to.unmarked ? '' : `${dir > 0 ? 'going up' : 'going down'} · ${to.name}`)),
    h('div.level-help', 'Space to skip the ride'));

  /* ---- time ----------------------------------------------------------------------------------- */
  let phase = 'closing', at = 0, arrived = 0, storey = from.storey, waiting = !!trip.until, finished = false, shown = null, music = null;
  if (trip.until) Promise.resolve(trip.until).catch(() => null).then(() => { waiting = false; });
  const skip = () => { if (phase === 'closing' || phase === 'travel') { at = T.wait + T.close + T.travel; } };
  const key = (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
    e.stopPropagation();
    if (e.type === 'keydown' && [' ', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); skip(); }
  };
  const setDoors = (k) => { leaves[0].position.x = -CAR.leaf / 2 - CAR.leaf * k; leaves[1].position.x = CAR.leaf / 2 + CAR.leaf * k; };

  return new Promise((resolve) => {
    function finish() {
      if (finished) return;
      finished = true;
      off();
      window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', key, true);
      root.remove();
      try { music?.stop?.(0.3); } catch { /* only music */ }
      stage.setView(null);
      avatar.dispose(); display.dispose();
      for (const x of trash) { try { x.dispose?.(); } catch { /* best effort */ } }
      resolve({ skipped: false });
    }

    function frame(dt) {
      at += dt / pace;
      const flick = glitch ? (Math.sin(at * 37) > 0.55 ? 0.35 : 1) * (0.8 + 0.2 * Math.sin(at * 91)) : 1;
      let doors = 0, arrow = dir;
      if (phase === 'closing') {
        doors = 1 - smooth((at - T.wait) / T.close);
        setGlow(from, 1.05);
        if (at >= T.wait + T.close) { phase = 'travel'; sfx(dir > 0 ? 'lift-up' : 'lift-down'); }
      }
      if (phase === 'travel') {
        const k = (at - T.wait - T.close) / T.travel;
        storey = from.storey + (to.storey - from.storey) * smoother(k);
        if (k >= 1 && !waiting) { phase = 'arrive'; arrived = at; sfx('lift-ding'); try { music?.stop?.(0.6); } catch { /* fine */ } setTimeout(() => sfx(VOICE[to.id]), 280); }
      }
      if (phase === 'arrive') {
        const e = at - arrived;
        storey = to.storey; arrow = 0;
        doors = smooth((e - 0.12) / T.open);
        setGlow(to, 1.0 + doors * 0.9);
        if (e > 0.42) { avatar.walking += (1 - avatar.walking) * (1 - Math.exp(-12 * dt)); avatar.root.position.z -= dt / pace * 1.5; avatar.root.position.x += (0 - avatar.root.position.x) * 0.1; }
        if (e > 0.12 + T.open * 0.75 && phase !== 'out') { phase = 'out'; curtain.close(T.out * 1000 * Math.min(pace, 3) * 0.7).then(finish); }
      } else if (phase === 'out') {
        doors = 1; arrow = 0; storey = to.storey;
        avatar.walking += (1 - avatar.walking) * (1 - Math.exp(-12 * dt)); avatar.root.position.z -= dt / pace * 1.5;
      }
      setDoors(doors);
      shaft.position.y = -storey * STOREY;
      // the counterweight passes once, going the other way
      const trip01 = Math.abs(to.storey - from.storey) ? (storey - from.storey) / (to.storey - from.storey) : 1;
      weight.position.y = 1.2 + (0.5 - trip01) * dir * 16;
      // the display: whichever floor is level with the car
      const here = Math.round(storey);
      let text = labelAt(phase === 'travel' || phase === 'closing' ? here : to.storey);
      let color = '#ffb44a';
      if (glitch && here > 2) { color = '#ff5a4a'; if (Math.sin(at * 53) > 0.2 && phase === 'travel') text = '#%?!8E3'[Math.floor((at * 31) % 7)] + (here % 10); }
      if (waiting && phase === 'travel' && at > T.wait + T.close + T.travel && Math.sin(at * 9) < 0) text = '';
      const sig = `${text}|${arrow}|${color}`;
      if (sig !== shown) { shown = sig; display.set(text, arrow, color); }
      // light, and the little shake of a car that is moving
      lampLight.intensity = 7 * flick; lampMat.color.set('#fff1d6').multiplyScalar(1.45 * flick);
      const moving = phase === 'travel' ? Math.sin(Math.min(1, (at - T.wait - T.close) / T.travel) * Math.PI) : 0;
      const shake = (0.004 + (glitch ? 0.012 : 0)) * moving;
      camera.position.set(camAt.x + Math.sin(at * 47) * shake, camAt.y + Math.sin(at * 31) * shake, camAt.z);
      camera.lookAt(camLook);
      avatar.update(dt);
      avatar.head.rotation.x -= 0.34 * (phase === 'out' ? 0 : 1);     // eyes on the numbers
      stage.setTilt(0.18, 0.5, 0.32);
    }

    let offOnce = false;
    const stop = stage.onFrame(frame);
    const off = () => { if (!offOnce) { offOnce = true; stop(); } };
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', key, true);
    root.addEventListener('pointerdown', skip);
    ui.append(root);
    setDoors(1); setGlow(from, 1.05);
    display.set(labelAt(from.storey), dir);
    frame(0);
    stage.setView({ scene, camera });
    curtain.open(240);
    sfx('lift-closing'); sfx('lift-doors');
    try { music = office.sound?.music?.('elevator-muzak', { loop: true, volume: 0.5 }) ?? null; } catch { music = null; }
  });
}
