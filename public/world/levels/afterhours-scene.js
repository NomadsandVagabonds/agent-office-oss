// The authored After Hours route: reception, operations, maintenance, production.
// Visible walls and jumpable furniture use the gameplay map's exact bounds.
import * as THREE from 'three';
import { LEVEL, objective } from '/core/afterhours-game.mjs';
import { FLOORS, canvasTexture } from '../scene/textures.js';
import { supplyCrate, ventGrille, fuseCell, crowbarRack } from './afterhours-props.js';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const AMBER = '#d6ac61', PAPER = '#d1c8ad';

export function buildEnvironment(w, office) {
  const statusScreens = [], medkits = [];
  let current = null, paused = false, controlMode = 'click', lastKey = '';
  const material = (color, extra = {}) => w.own(new THREE.MeshLambertMaterial({ color, ...extra }));
  const paint = material('#a8aaa0'), trim = material('#365960'), edge = material('#667376');
  const dark = material('#18272d'), amber = material(AMBER), steel = material('#566367');
  const paper = material(PAPER), coffee = material('#5b3c29'), ceramic = material('#bf8669');
  const lampMat = w.own(new THREE.MeshBasicMaterial({ color: '#d7e8db', toneMapped: false }));
  const amberMat = w.own(new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false }));
  const box = (x0, y0, z0, x1, y1, z1, mat = paint) => w.box(x0, y0, z0, x1, y1, z1, mat, { cast: false });
  const sign = (text, x, y, z, face = 'S', height = .19, bg = '#223e46', fg = '#e8d9b6') =>
    w.add(w.sign(text, { height, bg, fg, size: 16 }), x, z, face, y);
  const screen = (x, y, z, width, height, draw, face = 'S') => {
    const s = w.screen(width, height, draw, { ppm: 260, gain: .95 });
    w.add(s.mesh, x, z, face, y); return s;
  };
  function floorStyle(style) {
    const tex = w.own(style.tex.clone()); tex.needsUpdate = true;
    return { ...style, tex };
  }
  const carpet = floorStyle(FLOORS.carpet('#5d6662'));
  const lobby = floorStyle(FLOORS.tile('#a09b87', '#7f897f'));
  const stores = floorStyle(FLOORS.tile('#697575', '#4d5b60'));
  const raised = floorStyle(FLOORS.raised('#4b5960'));
  const ceilingTexture = w.own(canvasTexture(120, 120, (g, W, H) => {
    g.fillStyle = '#87908a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if ((x * 3 + y * 7) % 13 === 3) { g.fillStyle = '#263035'; g.fillRect(x * 30 + 1, y * 30 + 1, 28, 28); }
      g.fillStyle = '#606d6c'; g.fillRect(x * 30, y * 30, 30, 1); g.fillRect(x * 30, y * 30, 1, 30);
    }
    g.fillStyle = '#77847e'; for (let i = 0; i < 100; i++) g.fillRect((i * 43) % W, (i * 17) % H, 1, 1);
  }));
  for (const room of LEVEL.rooms) {
    const style = room.id === 'lobby' ? lobby : room.id === 'bullpen' ? carpet : room.id === 'servers' ? raised : stores;
    w.floor(room.x0, room.z0, room.x1, room.z1, style);
    const tex = w.own(ceilingTexture.clone()); tex.repeat.set((room.x1 - room.x0) / 3, (room.z1 - room.z0) / 3); tex.needsUpdate = true;
    const ceiling = new THREE.Mesh(w.own(new THREE.PlaneGeometry(room.x1 - room.x0, room.z1 - room.z0)), w.own(new THREE.MeshLambertMaterial({ map: tex })));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set((room.x0 + room.x1) / 2, 3.1, (room.z0 + room.z1) / 2); w.scene.add(ceiling);
  }
  // Every full-height collision rectangle becomes a thick wall with paint and skirting.
  const gate = new THREE.Group(); w.scene.add(gate);
  for (const wall of LEVEL.walls) {
    const h = wall.h ?? 3.1;
    if (wall.gate) {
      for (let y = 0; y < h; y += .18) {
        const slat = box(wall.x0, y, wall.z0, wall.x1, Math.min(h, y + .17), wall.z1, y % .36 < .18 ? steel : edge);
        gate.attach(slat);
      }
      box(wall.x0 - .08, 2.85, wall.z0 - .08, wall.x1 + .08, 3.1, wall.z1 + .08, dark);
      continue;
    }
    // The lift fills this recess; the boundary collision still seals the shaft.
    const spans = wall.id === 'lobby-south' ? [[wall.x0, -1.25], [1.25, wall.x1]] : [[wall.x0, wall.x1]];
    if (wall.id === 'lobby-south') box(-1.25, 2.95, wall.z0, 1.25, h, wall.z1, paint);
    for (const [x0, x1] of spans) {
      box(x0, 0, wall.z0, x1, h, wall.z1, paint);
      box(x0 - .012, .06, wall.z0 - .012, x1 + .012, .82, wall.z1 + .012, trim);
      box(x0 - .02, .82, wall.z0 - .02, x1 + .02, .87, wall.z1 + .02, edge);
      box(x0 - .02, 0, wall.z0 - .02, x1 + .02, .065, wall.z1 + .02, dark);
    }
  }

  const bounds = new THREE.Box3(), size = new THREE.Vector3();
  function fit(node, x0, z0, x1, z1, h) {
    node.updateWorldMatrix(true, true); bounds.setFromObject(node); bounds.getSize(size);
    const sx = (x1 - x0) / size.x, sz = (z1 - z0) / size.z;
    const sideways = Math.abs(Math.sin(node.rotation.y)) > .7;
    node.scale.multiply(new THREE.Vector3(sideways ? sz : sx, h / size.y, sideways ? sx : sz));
    node.position.y = 0; node.updateWorldMatrix(true, true); bounds.setFromObject(node);
    node.position.x += (x0 + x1) / 2 - (bounds.min.x + bounds.max.x) / 2;
    node.position.z += (z0 + z1) / 2 - (bounds.min.z + bounds.max.z) / 2;
    node.position.y -= bounds.min.y;
    return node;
  }
  for (const obstacle of LEVEL.obstacles) {
    const { x0, x1, z0, z1, h, kind } = obstacle, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    if (kind === 'crate') {
      const n = Math.max(1, Math.round((x1 - x0) / 1.05));
      for (let i = 0; i < n; i++) {
        const ax = x0 + (x1 - x0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n;
        fit(w.vox(supplyCrate, (ax + bx) / 2, z, 'S'), ax, z0, bx, z1, h);
      }
    } else if (kind === 'rack') {
      const alongZ = z1 - z0 > x1 - x0, n = Math.max(1, Math.round(Math.max(x1 - x0, z1 - z0) / .85));
      for (let i = 0; i < n; i++) {
        const ax = alongZ ? x0 : x0 + (x1 - x0) * i / n, bx = alongZ ? x1 : x0 + (x1 - x0) * (i + 1) / n;
        const az = alongZ ? z0 + (z1 - z0) * i / n : z0, bz = alongZ ? z0 + (z1 - z0) * (i + 1) / n : z1;
        fit(w.prop('rack', (ax + bx) / 2, (az + bz) / 2, alongZ ? 'E' : 'S', { solid: false }), ax, az, bx, bz, h);
      }
    } else if (kind === 'desk') {
      fit(w.prop('desk', x, z, 'S', { solid: false }), x0, z0, x1, z1, h);
      const crt = w.prop('crt', x - .2, z - .12, 'S', { y: h, solid: false }); crt.scale.setScalar(1.12);
      w.prop('keyboard', x - .2, z + .25, 'S', { y: h, solid: false });
      const mx = x + (x1 - x0) * .32, mz = z - .15;
      box(mx - .055, h, mz - .055, mx + .055, h + .13, mz + .055, ceramic);
      box(mx - .04, h + .13, mz - .04, mx + .04, h + .132, mz + .04, coffee);
      box(mx + .055, h + .035, mz - .025, mx + .09, h + .1, mz + .025, ceramic);
      // Paper, coffee and a low cubicle divider remain inside the desk's footprint.
      box(x0 + .04, h, z0 + .03, x1 - .04, h + .32, z0 + .08, trim);
      for (let n = 0; n < 3; n++) box(x + .32, h + n * .012, z + .1, x + .55, h + .01 + n * .012, z + .29, paper);
    } else {
      const n = Math.max(1, Math.round((x1 - x0) / .7));
      for (let i = 0; i < n; i++) {
        const ax = x0 + (x1 - x0) * i / n, bx = x0 + (x1 - x0) * (i + 1) / n;
        fit(w.prop('cabinet', (ax + bx) / 2, z, 'S', { solid: false }), ax, z0, bx, z1, h);
      }
    }
  }

  function fluorescent(x, z, warm = false, power = 2.2) {
    box(x - .72, 2.96, z - .14, x + .72, 3.05, z + .14, steel);
    box(x - .65, 2.94, z - .08, x + .65, 2.965, z + .08, warm ? amberMat : lampMat);
    if (power) w.lamp(x, 2.7, z, warm ? '#e4ba79' : '#bad8d4', power, 7);
  }
  fluorescent(-2.7, 11, true, 3.5); fluorescent(2.7, 11, false, 0);
  fluorescent(-5, 5.2, false, 3); fluorescent(.7, 3.6, true, 2.8); fluorescent(-5, -.2, false, 0);
  fluorescent(8.4, 4.3, true, 3.2); fluorescent(8.6, -5.8, false, 3.5);
  fluorescent(-4, -6.4, false, 3.3); fluorescent(1.2, -12.6, true, 3.3); fluorescent(-7.5, -13.5, false, 0);
  // Mechanical service pipes and trays are overhead, never invisible walk blockers.
  for (const x of [6.0, 6.27]) box(x, 2.7, -8.6, x + .11, 2.81, 7.5, steel);
  for (const z of [-4.5, -10.2, -14.9]) box(-9.5, 2.78, z, 4.5, 2.9, z + .22, dark);
  for (const [x, z] of [[-8.9, 6.8], [2.8, .3], [10.7, 6.7], [6.1, -6.8], [-8.7, -3.3], [3.6, -14.8]]) w.vox(ventGrille, x, z, 'S', { y: .01, cast: false });

  w.lift(0, 14, 'N');
  sign('AFTER HOURS · CONTAINMENT', 0, 2.72, 8.18, 'S', .24);
  sign('01 / OPERATIONS', 0, 2.36, 8.16, 'S', .19);
  sign('02 / MAINTENANCE', 4.76, 2.36, 2.6, 'W', .18);
  sign('03 / SERVER CONTROL', 0, 2.7, -1.78, 'S', .22);
  sign('AUTHORIZED PERSONNEL / MOSTLY', -3.1, 1.85, 13.88, 'N', .17);
  sign('DO NOT FEED THE BUGS', -9.8, 1.8, 3.2, 'E', .18);
  sign('PROTECTIVE EQUIPMENT IS A MINDSET', 11.8, 1.9, 3.5, 'W', .16);
  sign('PLEASE KEEP PRODUCTION ALIVE', -5.9, 2.5, -15.82, 'S', .21);
  sign('SPACE · JUMP', 6.75, .29, -.50, 'S', .15);
  sign('A LITTLE PERCUSSIVE MAINTENANCE', 3.5, 1.8, 13.84, 'N', .13);
  w.vox(crowbarRack, 3.5, 13.8, 'N', { y: .5, cast: false });

  function arrow(x, z, angle) {
    const geo = w.own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-.09, .014, .33, .09, .014, .33, .09, .014, -.06, -.09, .014, .33, .09, .014, -.06, -.09, .014, -.06, -.26, .014, -.06, .26, .014, -.06, 0, .014, -.36], 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, amber); mesh.position.set(x, 0, z); mesh.rotation.y = angle; w.scene.add(mesh);
  }
  for (const [x, z, a] of [[0, 10, 0], [0, 8.7, 0], [0, 5.7, 0], [0, 2.65, -Math.PI / 2], [2.2, 2.65, -Math.PI / 2], [4.5, 2.65, -Math.PI / 2], [6.75, 2.65, 0], [6.75, .2, 0], [6.75, -2.2, 0], [7.4, -5.6, -Math.PI / 2]]) arrow(x, z, a);

  const controls = screen(-3.1, 1.6, 8.14, 2.8, 1.4, (g, W, H) => {
    g.fillStyle = '#c5c0a8'; g.fillRect(0, 0, W, H); g.fillStyle = '#22373d';
    g.font = `bold ${W * .065}px ${MONO}`; g.fillText('EMERGENCY PROCEDURE', W * .065, H * .14);
    g.font = `${W * .043}px ${MONO}`;
    ['WASD   MOVE / STRAFE', 'MOUSE  LOOK', 'CLICK / F  CROWBAR', 'SPACE  JUMP     E  USE', 'P  PAUSE       R  RETRY'].forEach((line, i) => g.fillText(line, W * .065, H * (.3 + i * .115)));
    g.font = `${W * .035}px ${MONO}`;
    g.fillText(controlMode === 'mouse' ? 'ESC: RELEASE MOUSE' : controlMode === 'drag' ? 'DRAG TO LOOK / F TO SWING' : 'CLICK TO CAPTURE / DRAG TO LOOK', W * .065, H * .95);
  }); statusScreens.push(controls);
  const briefing = screen(3.1, 1.6, 8.14, 2.8, 1.25, (g, W, H) => {
    g.fillStyle = '#102329'; g.fillRect(0, 0, W, H); g.fillStyle = AMBER;
    g.font = `bold ${W * .06}px ${MONO}`; g.fillText(paused ? 'CONTAINMENT PAUSED' : 'BUILD / CONTAINMENT', W * .06, H * .2);
    g.fillStyle = '#d2dcd2'; g.font = `${W * .037}px ${MONO}`;
    const lines = current ? objective(current).split(/(?<=\.)\s+/) : ['Find the fuse in Maintenance.', 'Restore power in Server Control.'];
    let y = H * .43;
    for (const line of lines) { const words = line.split(' '); let row = ''; for (const word of words) { if ((row + word).length > 37) { g.fillText(row, W * .06, y); y += H * .16; row = ''; } row += word + ' '; } g.fillText(row, W * .06, y); y += H * .16; }
    g.fillStyle = '#729493'; g.font = `${W * .03}px ${MONO}`; g.fillText('If it crouches, it is about to jump.', W * .06, H * .91);
  }); statusScreens.push(briefing);

  const fusePoint = LEVEL.interactables.find((p) => p.kind === 'fuse');
  const fx = fusePoint.x, fz = fusePoint.z;
  // The small supply marker stays below the collision step height.
  box(fx - .38, .005, fz - .3, fx + .38, .035, fz + .3, amber);
  const fuse = w.vox(fuseCell, fx, fz, 'S', { y: .08 });
  const fuseLabel = sign('E · POWER FUSE', fx, .76, fz, 'S', .19);
  sign('SERVER CONTROL ←', fx, 2.36, -8.76, 'S', .18);
  sign('03 / SERVER CONTROL', 5.24, 2.36, -6.5, 'E', .18);
  for (const [x, z, a] of [[8.5, -6.5, Math.PI / 2], [6.6, -6.5, Math.PI / 2], [3.8, -6.5, Math.PI / 2], [-1.2, -6.5, Math.PI / 2], [-5.6, -6.5, 0], [-5.6, -10.3, 0], [-5.6, -12, Math.PI / 2]]) arrow(x, z, a);
  const panelPoint = LEVEL.interactables.find((p) => p.kind === 'panel');
  const px = panelPoint.x, pz = panelPoint.z;
  box(px - .54, .7, pz - .18, px + .54, 1.85, pz + .08, dark);
  box(px - .5, .76, pz + .08, px + .5, .82, pz + .12, amber);
  const panelScreen = screen(px, 1.36, pz + .14, .9, .72, (g, W, H) => {
    const powered = !!current?.power;
    g.fillStyle = '#071617'; g.fillRect(0, 0, W, H); g.fillStyle = powered ? '#9ed9ad' : AMBER;
    g.font = `bold ${W * .09}px ${MONO}`; g.fillText(powered ? 'POWER RESTORED' : 'AUXILIARY POWER', W * .06, H * .18);
    g.font = `${W * .075}px ${MONO}`;
    const remaining = current?.enemies.filter((e) => e.room === 'servers' && e.state !== 'dead').length || 0;
    const lines = powered ? ['CONTAINMENT', 'COMPLETE', 'RETURN TO LIFT'] : !current?.hasFuse ? ['FUSE REQUIRED', 'MAINTENANCE', 'STORES / 02'] : remaining ? ['CLEAR THE ROOM', String(remaining) + ' STILL LOOSE', 'THEN PRESS E'] : ['FUSE READY', 'E: INSTALL /', 'RESTORE POWER'];
    for (const [i, text] of lines.entries()) g.fillText(text, W * .06, H * (.43 + i * .18));
  }); statusScreens.push(panelScreen);
  for (const kit of LEVEL.interactables.filter((p) => p.kind === 'medkit')) {
    const node = w.vox(() => supplyCrate({ medical: true }), kit.x, kit.z, 'S'); node.scale.setScalar(.5);
    const label = sign('E · FIRST AID', kit.x, .68, kit.z, 'S', .13, '#2b5d4d'); medkits.push({ id: kit.id, node, label });
  }
  function update(state, isPaused = false, mode = 'click') {
    current = state; paused = isPaused; controlMode = mode;
    const hasFuse = state.hasFuse, powered = state.power;
    fuse.visible = fuseLabel.visible = !hasFuse;
    gate.position.y = powered ? 3.2 : 0;
    for (const kit of medkits) kit.node.visible = kit.label.visible = !state.usedMedkits.includes(kit.id);
    const key = `${state.stage}:${hasFuse}:${powered}:${state.kills}:${paused}:${mode}`;
    if (key !== lastKey) { lastKey = key; for (const s of statusScreens) s.redraw(); }
  }
  return { gate, fuse, panelScreen, statusScreens, update };
}
