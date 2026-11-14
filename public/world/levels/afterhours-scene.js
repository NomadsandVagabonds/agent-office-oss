// After Hours is another floor of the same office, after everybody went home.
// Furniture follows the gameplay map; navigation comes from rooms, light and objects.
import * as THREE from 'three';
import { LEVEL } from '/core/afterhours-game.mjs';
import { FLOORS, WALLS, canvasTexture, skylineTexture } from '../scene/textures.js';
import { supplyCrate, ventGrille, fuseCell } from './afterhours-props.js';

export function buildEnvironment(w, office) {
  const medkits = [], indicators = [];
  let lastPower = false, lastIndicatorKey = '';
  const material = (color, extra = {}) => w.own(new THREE.MeshLambertMaterial({ color, ...extra }));
  const plaster = material('#d8cdb8'), wood = material('#9a6a3c'), woodDark = material('#6b4a2f');
  const cream = material('#cfc6b0'), steel = material('#8a8f96'), dark = material('#2b2b30');
  const fabric = material('#777c68'), paper = material('#ded6bf'), coffee = material('#51392a');
  const amber = w.own(new THREE.MeshBasicMaterial({ color: '#d6ac61', toneMapped: false }));
  const green = w.own(new THREE.MeshBasicMaterial({ color: '#96c9a0', toneMapped: false }));
  const lampMat = w.own(new THREE.MeshBasicMaterial({ color: '#ffe6b6', toneMapped: false }));
  const box = (x0, y0, z0, x1, y1, z1, mat = plaster) => w.box(x0, y0, z0, x1, y1, z1, mat, { cast: false });
  const cloneStyle = style => { const tex = w.own(style.tex.clone()); tex.needsUpdate = true; return { ...style, tex }; };
  const carpet = cloneStyle(FLOORS.carpet('#5d5348'));
  const parquet = cloneStyle(FLOORS.wood('#a5764a'));
  const raised = cloneStyle(FLOORS.raised('#454a55'));
  const officeWall = cloneStyle(WALLS.office('#b4b29b'));
  const plainWall = cloneStyle(WALLS.plaster('#d8cdb8'));
  const ceilingTexture = w.own(canvasTexture(120, 120, (g, W, H) => {
    g.fillStyle = '#c0bcae'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = '#9d9a8c'; g.fillRect(x * 30, y * 30, 30, 1); g.fillRect(x * 30, y * 30, 1, 30);
      g.fillStyle = '#d0caba'; g.fillRect(x * 30 + 1, y * 30 + 1, 28, 1);
      if (x === 2 && y === 3) { g.fillStyle = '#37332f'; g.fillRect(x * 30 + 2, y * 30 + 2, 26, 26); }
    }
  }));
  for (const room of LEVEL.rooms) {
    const style = room.id === 'servers' ? raised : room.id === 'bullpen' ? carpet : parquet;
    w.floor(room.x0, room.z0, room.x1, room.z1, style);
    const tex = w.own(ceilingTexture.clone()); tex.repeat.set((room.x1 - room.x0) / 3, (room.z1 - room.z0) / 3); tex.needsUpdate = true;
    const ceiling = new THREE.Mesh(w.own(new THREE.PlaneGeometry(room.x1 - room.x0, room.z1 - room.z0)), w.own(new THREE.MeshLambertMaterial({ map: tex })));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set((room.x0 + room.x1) / 2, 3.1, (room.z0 + room.z1) / 2); w.scene.add(ceiling);
  }
  // A worn rug belongs to the reception seating, rather than marking a route.
  const rug = { size: 2.5, tex: w.own(canvasTexture(100, 100, (g) => {
    g.fillStyle = '#6e4440'; g.fillRect(0, 0, 100, 100);
    for (const [n, c] of [[3, '#b99862'], [7, '#3d5247'], [11, '#ba9564'], [14, '#6e4440']]) { g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(n, n, 100 - n * 2, 100 - n * 2); }
    g.fillStyle = '#b99862'; for (let y = 26; y < 80; y += 22) for (let x = 26; x < 80; x += 22) { g.fillRect(x, y - 3, 2, 8); g.fillRect(x - 3, y, 8, 2); }
  })) };
  w.floor(2.05, 10.2, 4.55, 13.1, rug, { y: .008 });

  function clad(x0, z0, x1, z1, h, style) {
    box(x0, 0, z0, x1, h, z1, plaster);
    w.wall(x1, z1 + .001, x0, z1 + .001, style, { h });
    w.wall(x0, z0 - .001, x1, z0 - .001, style, { h });
    w.wall(x1 + .001, z0, x1 + .001, z1, style, { h });
    w.wall(x0 - .001, z1, x0 - .001, z0, style, { h });
    box(x0 - .012, 0, z0 - .012, x1 + .012, .13, z1 + .012, woodDark);
    box(x0 - .018, 2.99, z0 - .018, x1 + .018, 3.1, z1 + .018, cream);
  }
  const gate = new THREE.Group(); w.scene.add(gate);
  for (const wall of LEVEL.walls) {
    if (wall.gate) {
      for (let y = 0; y < wall.h; y += .18) gate.attach(box(wall.x0, y, wall.z0, wall.x1, Math.min(wall.h, y + .17), wall.z1, steel));
      box(wall.x0 - .08, 2.85, wall.z0 - .08, wall.x1 + .08, 3.1, wall.z1 + .08, woodDark);
      continue;
    }
    const style = wall.id.startsWith('lobby') || wall.id.startsWith('stores') ? plainWall : officeWall;
    const spans = wall.id === 'lobby-south' ? [[wall.x0, -1.25], [1.25, wall.x1]] : [[wall.x0, wall.x1]];
    if (wall.id === 'lobby-south') box(-1.25, 2.95, wall.z0, 1.25, wall.h, wall.z1, plaster);
    for (const [x0, x1] of spans) clad(x0, wall.z0, x1, wall.z1, wall.h, style);
  }

  // Familiar window frames and the same skyline used by the live office.
  function windowBay(x, z, face, width, seed, blinds = false) {
    const group = new THREE.Group(), height = 1.48;
    const sky = w.own(skylineTexture(23, seed).clone()); sky.needsUpdate = true;
    const skyMat = w.own(new THREE.MeshBasicMaterial({ map: sky, toneMapped: false })); skyMat.color.setScalar(.7);
    const pane = new THREE.Mesh(w.own(new THREE.PlaneGeometry(width, height)), skyMat); group.add(pane);
    const part = (x0, y0, z0, x1, y1, z1, mat = woodDark) => {
      const mesh = new THREE.Mesh(w.own(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)), mat);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); group.add(mesh);
    };
    for (const xx of [-width / 2, 0, width / 2]) part(xx - .035, -height / 2, .01, xx + .035, height / 2, .095);
    for (const yy of [-height / 2, height / 2]) part(-width / 2 - .035, yy - .035, .01, width / 2 + .035, yy + .035, .095);
    part(-width / 2 - .08, -height / 2 - .09, 0, width / 2 + .08, -height / 2 - .035, .17, wood);
    if (blinds) for (let i = 0; i < 5; i++) part(-width / 2, height / 2 - i * .12 - .08, .10, width / 2, height / 2 - i * .12 - .035, .14, cream);
    w.add(group, x, z, face, 1.82);
  }
  windowBay(-4.86, 11, 'E', 2.6, 1, true);
  windowBay(-9.86, 5.5, 'E', 2.9, 2);
  windowBay(-9.86, .5, 'E', 2.9, 3, true);
  windowBay(11.86, 4.2, 'W', 3.9, 4, true);
  windowBay(8.6, -8.86, 'S', 3.4, 5);
  windowBay(-6.8, -15.86, 'S', 3.3, 6);

  const bounds = new THREE.Box3(), size = new THREE.Vector3();
  function fit(node, b) {
    node.updateWorldMatrix(true, true); bounds.setFromObject(node); bounds.getSize(size);
    const sx = (b.x1 - b.x0) / size.x, sz = (b.z1 - b.z0) / size.z;
    const sideways = Math.abs(Math.sin(node.rotation.y)) > .7;
    node.scale.multiply(new THREE.Vector3(sideways ? sz : sx, b.h / size.y, sideways ? sx : sz));
    node.position.y = 0; node.updateWorldMatrix(true, true); bounds.setFromObject(node);
    node.position.x += (b.x0 + b.x1) / 2 - (bounds.min.x + bounds.max.x) / 2;
    node.position.z += (b.z0 + b.z1) / 2 - (bounds.min.z + bounds.max.z) / 2;
    node.position.y -= bounds.min.y; node.userData.collider = b.id; return node;
  }
  function catalogue(type, b, face = 'S', options = {}) { return fit(w.prop(type, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, face, { solid: false, ...options }), b); }
  for (const b of LEVEL.obstacles) {
    const { x0, x1, z0, z1, h, kind } = b, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    if (kind === 'panel') continue;
    if (kind === 'rack') {
      const alongZ = z1 - z0 > x1 - x0, n = Math.max(1, Math.round(Math.max(x1 - x0, z1 - z0) / .85));
      for (let i = 0; i < n; i++) catalogue('rack', { ...b, x0: alongZ ? x0 : x0 + (x1 - x0) * i / n, x1: alongZ ? x1 : x0 + (x1 - x0) * (i + 1) / n, z0: alongZ ? z0 + (z1 - z0) * i / n : z0, z1: alongZ ? z0 + (z1 - z0) * (i + 1) / n : z1 }, alongZ ? 'E' : 'S');
    } else if (kind === 'crate' || kind === 'cabinet') {
      const n = Math.max(1, Math.round((x1 - x0) / (kind === 'crate' ? 1.1 : 1.5)));
      for (let i = 0; i < n; i++) catalogue(kind === 'crate' ? 'boxes' : 'bookshelf', { ...b, x0: x0 + (x1 - x0) * i / n, x1: x0 + (x1 - x0) * (i + 1) / n });
    } else if (kind === 'desk') {
      const reception = b.id === 'reception-desk', face = reception ? 'S' : 'N', dz = reception ? -.15 : .15;
      catalogue('desk', b, reception ? 'N' : 'S');
      const crt = w.prop('crt', x - .22, z + dz, face, { y: h, solid: false }); crt.scale.setScalar(1.12);
      const monitor = new THREE.Mesh(w.own(new THREE.PlaneGeometry(.35, .275)), w.own(new THREE.MeshBasicMaterial({ color: '#304f40', toneMapped: false })));
      monitor.position.set(0, .3125, .2021); crt.add(monitor);
      w.prop('keyboard', x - .22, z - dz * 1.65, face, { y: h, solid: false });
      w.prop('mouse', x + .22, z - dz * 1.65, face, { y: h, solid: false });
      w.prop('desklamp', x + .75, z + dz, face, { y: h, solid: false, o: { color: '#49795c' } });
      if (b.id === 'desk-a' || reception) w.lamp(x + .58, h + .65, z + dz, '#ffc98a', 1.4, 4);
      for (let n = 0; n < 3; n++) box(x + .28, h + n * .012, z + .05, x + .5, h + .01 + n * .012, z + .22, paper);
      box(x + .65, h, z - dz, x + .76, h + .13, z - dz + .11, cream);
      box(x + .665, h + .13, z - dz + .015, x + .745, h + .132, z - dz + .095, coffee);
    } else if (kind === 'partition') {
      box(x0, 0, z0, x1, h, z1, fabric);
      box(x0, h - .045, z0, x1, h, z1, woodDark);
      box(x0, 0, z0, x0 + .045, h, z1, woodDark); box(x1 - .045, 0, z0, x1, h, z1, woodDark);
    } else if (kind === 'counter') {
      const counter = w.prop('counter', x, z, 'W', { solid: false });
      const coffeeMachine = w.prop('coffeemachine', 0, 0, 'S', { solid: false, y: .75 });
      counter.add(coffeeMachine); coffeeMachine.position.set(-1.2, .75, 0);
      fit(counter, b);
    } else if (kind === 'chair') catalogue('chair', b, b.id === 'reception-chair' ? 'N' : 'S', { o: { color: '#53634f' } });
    else if (kind === 'sofa') catalogue('sofa', b, 'N');
    else if (kind === 'fridge') catalogue('fridge', b, 'W');
    else if (kind === 'plant') catalogue('planttall', b);
    else if (kind === 'bookshelf' || kind === 'cafetable' || kind === 'stool') catalogue(kind, b);
  }

  // The same personal objects as upstairs, now abandoned mid-evening.
  w.prop('painting', 3.1, 8.14, 'S', { y: 1.25, solid: false, scale: 1.4 });
  w.prop('painting', 11.86, -3.15, 'W', { y: 1.25, solid: false, scale: 1.2 });
  const clock = w.prop('clock', -3.1, 8.15, 'S', { y: 2.35, solid: false });
  const hourHand = box(-.012, 0, 0, .012, .105, .018, dark); clock.add(hourHand); hourHand.position.set(-.0125, .2375, .064); hourHand.rotation.z = .45;
  const minuteHand = box(-.008, 0, 0, .008, .16, .014, dark); clock.add(minuteHand); minuteHand.position.set(-.0125, .2375, .069); minuteHand.rotation.z = -1.7;
  for (const [x, z, warm, power] of [[-2.7,11,true,2.5],[2.7,11,true,0],[-5,5.2,true,2.4],[.7,3.6,true,2.4],[-5,-.2,true,0],[8.4,4.3,true,2.8],[8.6,-5.8,false,2.6],[-4,-6.4,false,2.6],[1.2,-12.6,false,2.6],[-7.5,-13.5,false,0]]) {
    box(x - .67, 2.98, z - .22, x + .67, 3.05, z + .22, cream);
    box(x - .59, 2.965, z - .15, x + .59, 2.985, z + .15, lampMat);
    if (power) w.lamp(x, 2.72, z, warm ? '#ffc98a' : '#c2c9e0', power, 7);
  }
  // Broken grille covers and dark cavities are the only infestation dressing.
  for (const [x, z, angle] of [[-8.9,6.8,.1],[2.8,.3,-.3],[10.5,-6.7,.22],[-8.7,-3.3,.15],[3.6,-14.8,-.2]]) {
    box(x - .45, .001, z - .28, x + .45, .008, z + .28, dark);
    w.vox(ventGrille, x + .18, z + .12, angle, { y: .01, cast: false });
  }
  const lift = w.lift(0, 14, 'N');
  lift.setFloor('');
  lift.group.traverse(node => { const tex = node.material?.map, image = tex?.image; if (image?.width === 28 && image?.height === 32) { const g = image.getContext('2d'); g.fillStyle = '#0b0a0e'; g.fillRect(0, 0, 28, 32); tex.needsUpdate = true; } });

  // A fuse and matching empty socket explain the electrical repair without words.
  const fusePoint = LEVEL.interactables.find(p => p.kind === 'fuse');
  const fuse = w.vox(fuseCell, fusePoint.x, fusePoint.z, 'S', { y: .08 });
  const fuseGlow = w.lamp(fusePoint.x, .55, fusePoint.z, '#efbd69', 1.4, 3.2);
  const panelPoint = LEVEL.interactables.find(p => p.kind === 'panel');
  const px = panelPoint.x, pz = panelPoint.z;
  const panelBounds = LEVEL.obstacles.find(b => b.kind === 'panel') || { x0: px - .5, x1: px + .5, z0: pz - .3, z1: pz - .1, h: 1.75 };
  box(panelBounds.x0, 0, panelBounds.z0, panelBounds.x1, panelBounds.h, panelBounds.z1, cream);
  box(px - .44, .1, panelBounds.z1 + .001, px + .44, 1.65, panelBounds.z1 + .012, steel);
  box(px - .13, .93, panelBounds.z1 + .014, px + .13, 1.47, panelBounds.z1 + .023, dark);
  const socketLamp = box(px - .105, .965, panelBounds.z1 + .025, px + .105, 1.435, panelBounds.z1 + .028, amber);
  const insertedFuse = w.vox(fuseCell, px, panelBounds.z1 + .06, 'S', { y: .99 }); insertedFuse.visible = false;
  for (const y of [.5,.64,.78]) indicators.push(box(px + .25, y, panelBounds.z1 + .014, px + .32, y + .07, panelBounds.z1 + .025, amber));
  const panelGlow = w.lamp(px, 1.3, pz + .15, '#ddb66c', .8, 2.5);
  // Slim electrical conduit joins the room's cabinet and shutter, not the floor route.
  for (const [x0,y0,z0,x1,y1,z1] of [[px+.47,1.5,pz-.15,px+.50,2.88,pz-.12],[px+.47,2.85,pz-.15,.02,2.88,pz-.12],[-.015,2.85,pz-.15,.015,2.88,-2.2]]) box(x0,y0,z0,x1,y1,z1,steel);
  for (const kit of LEVEL.interactables.filter(p => p.kind === 'medkit')) {
    const node = w.vox(() => supplyCrate({ medical: true }), kit.x, kit.z, 'S'); node.scale.setScalar(.5); medkits.push({ id: kit.id, node });
  }
  function update(state) {
    fuse.visible = !state.hasFuse; fuseGlow.visible = !state.hasFuse;
    gate.position.y = state.power ? 3.2 : 0;
    insertedFuse.visible = state.power; socketLamp.visible = !state.power;
    for (const kit of medkits) kit.node.visible = !state.usedMedkits.includes(kit.id);
    const indicatorKey = state.kills + ':' + state.power;
    if (indicatorKey !== lastIndicatorKey) {
      lastIndicatorKey = indicatorKey;
      const servers = state.enemies.filter(enemy => enemy.room === 'servers');
      indicators.forEach((indicator, i) => { indicator.material = state.power || servers[i]?.state === 'dead' ? green : amber; });
    }
    if (state.power !== lastPower) {
      lastPower = state.power;
      panelGlow.color.set(state.power ? '#96c9a0' : '#ddb66c');
    }
  }
  return { gate, fuse, panelScreen: null, statusScreens: [], update };
}
