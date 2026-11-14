// N · Night Shift. A monochrome, side-on office stealth detour.
// The furniture and employee are actual Vox meshes; the rules run in a pure 2D world.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { Vox, M, glow } from '../vox/vox.js';
import { LEVEL, createGame, step, lightBeams, beamPolygon, objective } from '/core/nightshift-game.mjs';
import { silhouetteDesk, filingBank, securityLamp, officeDoor } from './nightshift-props.js';
import { createWorker } from './nightshift-worker.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;

export async function enter(office) {
  const w = createWorld(office, {
    id: 'nightshift', background: '#555555', arrive: false,
    bounds: { x0: -2, x1: 49, z0: -3, z1: 3 }, start: { x: 2, z: 0 },
    camera: { yaw: 0, pitch: 0, dist: 26, height: 2.8 },
    grade: { tilt: 0, bloom: 0.19, glow: 0.8 }, shadows: 10,
  });
  w.root.style.filter = 'grayscale(1)';
  w.scene.fog = new THREE.Fog('#777777', 31, 41);
  w.light({ sky: '#ffffff', ground: '#555555', hemi: 1.6, sun: '#ffffff', power: 0.65, dir: [-0.5, 1, 1] });
  w.sun.castShadow = false;
  w.bed('office-bed', { volume: 0.07 });
  let game = createGame(), paused = false, closing = false, cameraX = 6.5, lastEvent = '', lastReadout = '';
  const held = new Set(), dynamicScreens = [], lightNodes = [];
  const basic = (color, more = {}) => w.own(new THREE.MeshBasicMaterial({ color, ...more }));
  const dark = basic('#0b0b0b'), ink = basic('#181818'), mid = basic('#3d3d3d'), silver = basic('#777777'), white = basic('#dddddd');
  const box = (x, y, z, width, height, depth, material = dark) => w.box(x - width / 2, y, z - depth / 2, x + width / 2, y + height, z + depth / 2, material, { cast: false });
  function screen(x, y, width, height, draw, z = -0.5) {
    const s = w.screen(width, height, draw, { ppm: 180, gain: 0.8 });
    w.add(s.mesh, x, z, 'S', y); return s;
  }
  function lettering(text, x, y, { size = 0.21, z = -0.45, pale = true } = {}) {
    const s = w.sign(text, { height: size, fg: pale ? '#d7d7d7' : '#191919', bg: pale ? '#202020' : '#bdbdbd', size: 18 });
    w.add(s, x, z, 'S', y); return s;
  }

  // Four depth layers: distant towers, office windows, working corridor, foreground pipes.
  box(23, -1.5, -9, 65, 11, 0.2, basic('#777777'));
  for (let i = 0; i < 24; i++) {
    const x = i * 3 - 8, h = 2.5 + ((i * 17) % 9) * 0.3;
    box(x, -0.5, -8, 2.2, h, 0.3, basic(i % 3 ? '#626262' : '#6a6a6a'));
    for (let j = 0; j < 4; j++) box(x + (j % 2 - 0.5) * 0.7, 0.3 + Math.floor(j / 2) * 0.8, -7.8, 0.2, 0.35, 0.03, silver);
  }
  box(23, -0.1, -5.1, 50, 1.8, 0.15, basic('#444444'));
  box(23, 4.2, -5.1, 50, 2, 0.15, basic('#444444'));
  for (let x = -1; x < 49; x += 3.5) {
    box(x, 1.7, -5, 0.1, 2.5, 0.16, mid);
    for (let j = 0; j < 8; j++) box(x + 1.7, 3.05 + j * 0.13, -4.9, 3.35, 0.035, 0.1, mid);
  }
  for (let x = 4; x < 44; x += 5.6) {
    const d = w.vox(silhouetteDesk, x, -3.5, 'S'); d.scale.setScalar(0.85);
    box(x + 1.7, 0, -3.2, 0.16, 4.5, 0.18, mid);
  }
  // Cutaway floor has a stepped underside, like a slice through a voxel building.
  box(23, -0.2, 0, 50, 0.2, 4.8, ink);
  box(23, -0.35, 1.9, 50, 0.15, 0.3, dark);
  for (let x = -2; x < 49; x += 0.3) box(x, -0.42 - ((Math.round(x * 10) % 3) * 0.04), 2.05, 0.3, 0.17, 0.3, dark);
  box(23, 4.9, -0.5, 50, 0.2, 3.6, dark);
  for (let x = -1; x < 48; x += 4.2) {
    box(x, 4.55, 1.3, 0.13, 0.45, 0.13, ink);
    box(x + 1.7, 4.35, -1.8, 3.6, 0.08, 0.35, mid);
  }
  box(23, -1.3, 2.2, 50, 0.07, 0.09, mid);
  box(23, -1.6, 2.2, 50, 0.045, 0.08, mid);
  for (let x = 1; x < 48; x += 7) box(x, -1.9, 2.2, 0.07, 0.8, 0.1, mid);

  // Use the same bounds for visible cover and the gameplay ray occluders.
  for (const c of LEVEL.covers) {
    const desk = w.vox(silhouetteDesk, c.x, 0.4, 'S'); desk.scale.x = c.w / 2.5;
    // The modesty panel is the actual opaque cover: the monitor is decorative.
    box(c.x, 0.06, 0.95, c.w, c.h - 0.06, 0.12, ink);
    box(c.x, c.h - 0.04, 0.97, c.w, 0.035, 0.14, silver);
    lettering('PERSONNEL', c.x, 0.68, { size: 0.085, z: 1.04 });
  }
  for (const o of LEVEL.obstacles) {
    const model = () => {
      const v = new Vox(), half = Math.round(o.w / 0.05), h = Math.round(o.h / 0.025);
      v.box(-half, 0, -12, half, h, 12, M('#303030', 2));
      v.box(-half, h - 2, -12, half, h, 12, M('#777777', 1));
      v.box(-2, 0, 12, 2, h, 13, M('#888888', 1));
      return v;
    };
    w.vox(model, o.x, 0.7, 'S');
    lettering('ARCHIVE', o.x, o.h * 0.58, { size: 0.08, z: 1.03 });
  }
  for (const x of [0.3, 16.2, 28.5, 41]) {
    const cabinet = w.vox(filingBank, x, -1.6, 'S'); cabinet.scale.x = 0.7;
  }
  w.vox(() => officeDoor({ open: true }), 1.3, -1.1, 'S');
  w.vox(() => officeDoor({ open: true }), LEVEL.exitX, -1.1, 'S');
  lettering('N · NIGHT SHIFT', 1.3, 2.9, { size: 0.2 });
  lettering('EXIT', LEVEL.exitX, 2.9, { size: 0.27 });
  lettering('E · CLOCK OUT', LEVEL.exitX, 0.48, { size: 0.16, z: 1.05 });

  // Instructions live on luminous office signage, with reminders at each new verb.
  screen(4.15, 2.65, 3.8, 1.32, (g, W, H) => {
    g.fillStyle = '#a7a7a7'; g.fillRect(0, 0, W, H); g.fillStyle = '#111111';
    g.font = `bold ${W * 0.065}px monospace`; g.fillText('NIGHT SHIFT', W * 0.06, H * 0.23);
    g.font = `${W * 0.039}px monospace`;
    ['You only came back for your badge.', 'A / D  MOVE      S / ↓  CROUCH', 'SPACE  JUMP     E  USE', 'P PAUSE · R RETRY · ESC LOBBY'].forEach((s, i) => g.fillText(s, W * 0.06, H * (0.43 + i * 0.16)));
  });
  lettering('KEEP TO THE SHADOWS', 9.2, 3.3, { size: 0.22 });
  lettering('S / ↓  CROUCH IN DESK SHADOWS', 7, 2.05, { size: 0.15 });
  lettering('WAIT FOR RECALIBRATION · CROSS IN THE DARK', 9.9, 2.5, { size: 0.14 });
  lettering('SPACE · OVER THE PAPERWORK', 13.9, 1.85, { size: 0.15 });
  lettering('NO OVERTIME HAS BEEN APPROVED', 25.6, 3.5, { size: 0.2 });
  lettering('THE LAST ONE OUT GETS THE LIGHTS', 34, 3.6, { size: 0.18 });

  const card = w.vox(() => new Vox().box(-6, 0, -1, 6, 9, 1, glow('#eeeeee')).box(-4, 5, 1, 1, 8, 2, '#333333').box(-4, 2, 1, 4, 3, 2, '#555555'), LEVEL.keycardX, 0, 'S', { y: 1.03 });
  const cardLabel = lettering('E · YOUR ACCESS CARD', LEVEL.keycardX, 1.75, { size: 0.17 });
  box(LEVEL.breakerX, 0.8, -0.25, 0.65, 0.9, 0.25, ink);
  const switchLever = box(LEVEL.breakerX, 1.1, -0.05, 0.08, 0.3, 0.08, white);
  const breakerLabel = lettering('E · SECURITY POWER', LEVEL.breakerX, 1.95, { size: 0.16 });
  const gate = new THREE.Group(); w.scene.add(gate);
  for (let i = 0; i < 19; i++) {
    const slat = box(LEVEL.gateX, i * 0.22, 0, 0.18, 0.2, 2.6, i % 2 ? dark : ink); gate.attach(slat);
  }
  box(LEVEL.gateX, 4.2, 0, 0.45, 0.45, 2.7, dark);

  // Every beam is clipped by the same cover geometry that decides detection.
  const beamMaterial = w.own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { clock: { value: 0 } },
    vertexShader: `attribute vec2 beamUV; varying vec2 vBeam; varying vec2 vPosition;
      void main() { vBeam=beamUV; vPosition=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float clock; varying vec2 vBeam; varying vec2 vPosition;
      void main() {
        float edge=smoothstep(0.,.025,vBeam.x)*smoothstep(0.,.025,1.-vBeam.x);
        float grain=fract(sin(dot(floor(vPosition*100.+clock*.1),vec2(12.9898,78.233)))*43758.5453);
        float alpha=edge*(.095+.035*(1.-vBeam.y))*(.92+grain*.16);
        gl_FragColor=vec4(vec3(.93),alpha);
      }`,
  }));
  for (const light of LEVEL.lights) {
    const lamp = w.vox(securityLamp, light.x, -0.05, 'S', { y: light.y });
    const geo = w.own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 9), 3));
    geo.setAttribute('beamUV', new THREE.BufferAttribute(new Float32Array(64 * 6), 2));
    geo.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geo, beamMaterial); mesh.frustumCulled = false; mesh.renderOrder = 1; w.scene.add(mesh);
    const indicators = [];
    for (let i = 0; i < 6; i++) indicators.push(box(light.x - 0.3 + i * 0.12, light.y + 0.33, 0.4, 0.075, 0.07, 0.02, basic('#444444')));
    const readout = screen(light.x, 3.7, 2.1, 0.42, (g, W, H) => {
      const beam = lightBeams(game).find((b) => b.id === light.id);
      g.fillStyle = beam.resting ? '#cecece' : '#171717'; g.fillRect(0, 0, W, H);
      g.fillStyle = beam.resting ? '#111111' : '#d0d0d0'; g.textAlign = 'center';
      g.font = `bold ${H * 0.28}px monospace`;
      g.fillText(beam.resting ? 'RECALIBRATING' : beam.active ? 'SECURITY SCAN' : 'POWER OFF', W / 2, H * 0.39);
      g.font = `${H * 0.25}px monospace`;
      g.fillText(beam.resting ? `CROSS NOW · ${beam.restRemaining.toFixed(1)}s` : beam.active ? `DARK IN ${beam.scanRemaining.toFixed(1)}s` : 'SERVICE PASSAGE OPEN', W / 2, H * 0.8);
    }, 0.1);
    lightNodes.push({ lamp, mesh, indicators, readout, lastReadout: '' });
  }

  // A tiny employee with a bright ID badge: square limbs and a block-built head.
  const worker = createWorker(w);

  // A moving patch of fog is very faint and never hides the playable silhouette.
  const motesGeo = w.own(new THREE.BufferGeometry()), motePositions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) { motePositions[i * 3] = ((i * 7919) % 4600) / 100; motePositions[i * 3 + 1] = 0.3 + ((i * 47) % 430) / 100; motePositions[i * 3 + 2] = -1.5; }
  motesGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(motesGeo, w.own(new THREE.PointsMaterial({ color: '#aaaaaa', size: 0.025, transparent: true, opacity: 0.3, depthWrite: false }))); w.scene.add(motes);

  const status = screen(LEVEL.exitX - 0.1, 3.8, 4.3, 0.65, (g, W, H) => {
    g.fillStyle = '#b5b5b5'; g.fillRect(0, 0, W, H); g.fillStyle = '#111111'; g.textAlign = 'center';
    g.font = `bold ${W * 0.047}px monospace`;
    g.fillText(game.stage === 'won' ? 'SHIFT COMPLETE. GO HOME.' : 'PLEASE REMEMBER TO CLOCK OUT.', W / 2, H * 0.4);
    g.font = `${W * 0.032}px monospace`;
    g.fillText(game.stage === 'won' ? `${game.deaths} security encounters · E: lobby · R: replay` : 'Access card + security power required', W / 2, H * 0.77);
  }); dynamicScreens.push(status);
  const announcement = screen(24, 4.15, 7, 0.4, (g, W, H) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, W, H); g.fillStyle = '#c3c3c3'; g.textAlign = 'center'; g.font = `${H * 0.52}px monospace`;
    g.fillText(paused ? 'SHIFT PAUSED · P TO RESUME' : game.stage === 'caught' ? 'UNAPPROVED OVERTIME. RETURN TO YOUR STATION.' : objective(game).toUpperCase(), W / 2, H * 0.68);
  }); dynamicScreens.push(announcement);

  const controls = new Set(['a', 'd', 's', 'w', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'e', 'p', 'r']);
  function keyDown(e) {
    if (office.level !== w || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!controls.has(k)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat && k === 'p') { paused = !paused; held.clear(); }
    else if (!e.repeat && k === 'r') { game = createGame(); paused = false; held.clear(); }
    else if (!e.repeat && k === 'e' && game.stage === 'won') { closing = true; w.leave('esc'); }
    else held.add(k);
  }
  function keyUp(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; held.delete(k); }
  function blur() { held.clear(); }
  function pointer(e) { e.stopImmediatePropagation(); }
  // Installed before the kit, so this floor keeps 2D movement while Esc stays standard.
  window.addEventListener('keydown', keyDown, true); window.addEventListener('keyup', keyUp, true); window.addEventListener('blur', blur);
  w.root.addEventListener('pointerdown', pointer, true); w.root.addEventListener('wheel', pointer, true);
  w.own({ dispose() { window.removeEventListener('keydown', keyDown, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', blur); } });

  const camera = new THREE.OrthographicCamera(-7, 7, 4.4, -4.4, 0.1, 80);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const result = w.run();
  office.stage.setView({ scene: w.scene, camera });
  const offFrame = office.stage.onFrame((dt, t) => {
    if (office.level !== w || closing) return;
    if (!paused && !document.hidden && document.hasFocus()) game = step(game, {
      axis: Number(held.has('d') || held.has('ArrowRight')) - Number(held.has('a') || held.has('ArrowLeft')),
      crouch: held.has('s') || held.has('ArrowDown'), jump: held.has(' ') || held.has('w') || held.has('ArrowUp'), interact: held.has('e'),
    }, dt);
    w.me.x = game.x; w.me.z = 0; w.avatar.root.visible = false;
    if (game.event && game.event !== lastEvent) w.sfx(game.stage === 'caught' ? 'sticky' : game.stage === 'won' ? 'bell' : 'coin', { volume: 0.13 });
    lastEvent = game.event;
    card.visible = cardLabel.visible = !game.keycard; breakerLabel.visible = !game.breaker;
    card.rotation.y = reducedMotion ? 0 : Math.sin(t * 1.6) * 0.25;
    switchLever.rotation.z = game.breaker ? Math.PI / 2 : 0;
    gate.position.y = lerp(gate.position.y, game.breaker ? 4.5 : 0, reducedMotion ? 1 : 1 - Math.exp(-dt * 4));
    worker.update(game, dt, reducedMotion);
    beamMaterial.uniforms.clock.value = reducedMotion ? 0 : t;
    const beams = lightBeams(game);
    for (let i = 0; i < lightNodes.length; i++) {
      const beam = beams[i], node = lightNodes[i]; node.mesh.visible = beam.active;
      if (beam.active) {
        const points = beamPolygon(game, beam, 64), a = node.mesh.geometry.attributes.position, uv = node.mesh.geometry.attributes.beamUV;
        let n = 0;
        for (let j = 1; j < points.length - 1; j++) for (const [p, u] of [[points[0], 0.5], [points[j], (j - 1) / 64], [points[j + 1], j / 64]]) {
          a.setXYZ(n, p[0], p[1], 1.02); uv.setXY(n, u, 1 - p[1] / beam.y); n++;
        }
        a.needsUpdate = true; uv.needsUpdate = true; node.mesh.geometry.setDrawRange(0, n);
      }
      node.lamp.rotation.z = beam.active ? Math.atan2((beam.left + beam.right) / 2 - beam.x, beam.y) * 0.25 : 0;
      node.indicators.forEach((p, j) => p.material.color.set(game.exposure > j / 6 ? '#eeeeee' : '#333333'));
      const lampReadout = `${beam.active}:${beam.resting}:${Math.ceil(beam.restRemaining * 10)}:${Math.ceil(beam.scanRemaining * 10)}`;
      if (lampReadout !== node.lastReadout) { node.lastReadout = lampReadout; node.readout.redraw(); }
    }
    const readout = `${game.stage}:${game.keycard}:${game.breaker}:${game.deaths}:${paused}`;
    if (readout !== lastReadout) { lastReadout = readout; for (const s of dynamicScreens) s.redraw(); }
    const aspect = office.stage.size.w / office.stage.size.h, viewHeight = Math.max(7.7, 12 / aspect), halfW = viewHeight * aspect / 2;
    cameraX = lerp(cameraX, clamp(game.x + game.facing * 1.5, halfW - 0.7, 46.7 - halfW), 1 - Math.exp(-dt * 3.2));
    camera.left = -halfW; camera.right = halfW; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
    camera.position.set(cameraX + 0.65, 2.3, 30); camera.lookAt(cameraX, 2.1, 0);
    // The office's overhead announcement follows its own ceiling rail, so it is readable during pause/catch.
    announcement.mesh.position.x = cameraX;
    motes.position.x = reducedMotion ? 0 : Math.sin(t * 0.05) * 0.18;
  });
  w.own({ dispose: offFrame });
  w.nightshift = { get state() { return { ...game }; }, get paused() { return paused; }, map: LEVEL };
  return result;
}
