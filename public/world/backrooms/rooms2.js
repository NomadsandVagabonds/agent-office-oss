// The Backrooms — the rooms, part two: the rest of the deck. Same contract as
// rooms.js: a builder gets the toolbox `c`, its rolled details `c.params`, and
// works in the room's own frame (x across, z deep, entered through +z).
import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { Batch, lin, atlas, drawText, ticks, smooth, WHITE } from './kit.js';
import { TILE } from './gen.js';
import { P, clamp, framed, card, doorLeaf, doorFrame, wetSign } from './bits.js';
import { MORE2 } from './rooms3.js';

/** A pool, full to the brim with stress balls (or packing peanuts, or shredded paper). You can wade in. */
function stressPool(c) {
  const { W, D, R, params: p } = c, kit = c.kit;
  c.shell({ floor: false });
  const x0 = -W / 2 + 1.7, x1 = W / 2 - 1.7, z0 = -D / 2 + 1.6, z1 = D / 2 - 2.0, deep = 0.62;
  const strip = (ax, az, bx, bz) => c.floor.grid([ax, 0, az], [0, 0, 1], [1, 0, 0], ticks(bz - az), ticks(bx - ax), (u, v) => [(ax + v + c.room.cx) / 1.6, (az + u + c.room.cz) / 1.6], WHITE,
    (u, v) => 0.76 + 0.24 * smooth(Math.min(ax + v + W / 2, W / 2 - ax - v, az + u + D / 2, D / 2 - az - u) / 0.45));
  strip(-W / 2, -D / 2, W / 2, z0); strip(-W / 2, z1, W / 2, D / 2); strip(-W / 2, z0, x0, z1); strip(x1, z0, W / 2, z1);
  const tile = kit.tex.custom('pool' + p.tiles, 16, 16, (g) => { P(g, p.tiles, 0, 0, 16, 16); for (const k of [0, 8]) { P(g, '#eef3ee', k, 0, 1, 16); P(g, '#eef3ee', 0, k, 16, 1); } });
  const tb = c.mapped('pooltile', tile), uvt = (u, v) => [u / 0.4, v / 0.4], zz = ticks(z1 - z0, 1, 0), xx = ticks(x1 - x0, 1, 0), dark = () => 0.7;
  tb.grid([x0, -deep, z1], [0, 0, -1], [0, 1, 0], zz, [0, deep], uvt, WHITE, dark); tb.grid([x1, -deep, z0], [0, 0, 1], [0, 1, 0], zz, [0, deep], uvt, WHITE, dark);
  tb.grid([x0, -deep, z0], [1, 0, 0], [0, 1, 0], xx, [0, deep], uvt, WHITE, dark); tb.grid([x1, -deep, z1], [-1, 0, 0], [0, 1, 0], xx, [0, deep], uvt, WHITE, dark);
  tb.grid([x0, -deep, z0], [0, 0, 1], [1, 0, 0], zz, xx, uvt, WHITE, () => 0.5);
  const stone = lin('#d9d4c4');
  for (const [a, b, e, f] of [[x0 - 0.14, z0 - 0.14, x1 + 0.14, z0], [x0 - 0.14, z1, x1 + 0.14, z1 + 0.14], [x0 - 0.14, z0, x0, z1], [x1, z0, x1 + 0.14, z1]]) c.flat.box(a, 0, b, e, 0.025, f, stone, { skip: '-y' });

  // the fill: one instanced mesh, each piece lit for where it lies
  const shreds = p.fill === 'shreds', s = shreds ? 0.085 : 0.132, top = -0.085;
  const nx = Math.floor((x1 - x0 - 0.04) / s), nz = Math.floor((z1 - z0 - 0.04) / s), count = nx * nz;
  const geo = kit.own(shreds ? new THREE.BoxGeometry(0.24, 0.012, 0.024) : new THREE.SphereGeometry(0.07, 8, 6));
  const nrm = geo.attributes.normal, shadeOf = new Float32Array(nrm.count * 3);
  for (let i = 0; i < nrm.count; i++) shadeOf[i * 3] = shadeOf[i * 3 + 1] = shadeOf[i * 3 + 2] = 0.45 + 0.55 * (nrm.getY(i) * 0.5 + 0.5);
  geo.setAttribute('color', new THREE.BufferAttribute(shadeOf, 3));
  const mesh = new THREE.InstancedMesh(geo, kit.own(new THREE.MeshBasicMaterial({ vertexColors: true })), count);
  const home = new Float32Array(count * 3), turn = new Float32Array(count * 3), dummy = new THREE.Object3D(), col = new THREE.Color();
  const squash = p.fill === 'peanuts' ? [1.25, 0.62, 0.8] : [1, 1, 1];
  const set = (k, ox = 0, oy = 0, oz = 0) => { dummy.position.set(home[k * 3] + ox, home[k * 3 + 1] + oy, home[k * 3 + 2] + oz); dummy.rotation.set(turn[k * 3], turn[k * 3 + 1], turn[k * 3 + 2]); dummy.scale.set(squash[0], squash[1], squash[2]); dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix); };
  const under = [0, 0, 0];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    home[k * 3] = x0 + 0.02 + (i + 0.5 + (j % 2 ? 0.22 : -0.22)) * s + R.range(-0.02, 0.02); home[k * 3 + 1] = top + R.range(-0.04, 0.03); home[k * 3 + 2] = z0 + 0.02 + (j + 0.5) * s + R.range(-0.02, 0.02);
    turn[k * 3] = shreds ? R.range(-0.4, 0.4) : R.range(0, 6); turn[k * 3 + 1] = R.range(0, 6); turn[k * 3 + 2] = shreds ? R.range(-0.4, 0.4) : R.range(0, 6);
    set(k);
    if (p.fill === 'balls') col.setHSL(p.hues[(i * 7 + j * 13 + R.int(0, 9)) % p.hues.length] / 360, 0.62, 0.52, THREE.SRGBColorSpace);
    else if (p.fill === 'peanuts') col.setHSL(R.pick([60, 95, 340, 60]) / 360, 0.28, R.range(0.84, 0.92), THREE.SRGBColorSpace);
    else col.setHSL(R.pick([50, 50, 50, 210, 350]) / 360, 0.2, R.range(0.82, 0.93), THREE.SRGBColorSpace);
    const L = c.sample(home[k * 3], 0, home[k * 3 + 2]);
    under[0] += col.r / count; under[1] += col.g / count; under[2] += col.b / count;
    mesh.setColorAt(k, col.setRGB(col.r * L[0], col.g * L[1], col.b * L[2]));
  }
  mesh.instanceColor.needsUpdate = true;
  c.add(mesh);
  c.flat.quad([x0, top - 0.11, z1], [x1, top - 0.11, z1], [x1, top - 0.11, z0], [x0, top - 0.11, z0], under.map((v) => v * 0.4));

  // wading: slower, lower, and the stuff makes room for you
  const moved = new Map();
  c.tick((dt, t, me) => {
    const inPool = me.inside && me.x > x0 + 0.05 && me.x < x1 - 0.05 && me.z > z0 + 0.05 && me.z < z1 - 0.05;
    if (inPool) { me.world.slow = 0.55; me.world.sinkTo = 0.36; }
    if (me.inside) c.rt.footstep = inPool ? 'wade' : 'step';
    if (inPool) {
      const ci = Math.floor((me.x - x0) / s), cj = Math.floor((me.z - z0) / s), reach = Math.ceil(0.5 / s);
      for (let j = Math.max(0, cj - reach); j <= Math.min(nz - 1, cj + reach); j++) for (let i = Math.max(0, ci - reach); i <= Math.min(nx - 1, ci + reach); i++) if (!moved.has(j * nx + i)) moved.set(j * nx + i, [0, 0, 0]);
    }
    if (!moved.size) return;
    const e = 1 - Math.exp(-10 * dt);
    for (const [k, off] of moved) {
      const dx = home[k * 3] - me.x, dz = home[k * 3 + 2] - me.z, d = Math.hypot(dx, dz) || 0.001, push = inPool ? Math.max(0, 0.46 - d) : 0;
      off[0] += ((dx / d) * push * 0.5 - off[0]) * e; off[1] += (-push * 0.4 - off[1]) * e; off[2] += ((dz / d) * push * 0.5 - off[2]) * e;
      set(k, off[0], off[1], off[2]);
      if (!push && Math.abs(off[0]) + Math.abs(off[1]) + Math.abs(off[2]) < 0.003) { set(k); moved.delete(k); }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // handrails at the near end, a sign, and where the lifeguard is not
  const chrome = [0.72, 0.75, 0.8];
  for (const x of [-0.45, 0.45]) { c.flat.box(x - 0.02, 0, z1 + 0.3, x + 0.02, 0.82, z1 + 0.34, chrome); c.flat.box(x - 0.02, 0.78, z1 - 0.35, x + 0.02, 0.82, z1 + 0.34, chrome); c.flat.box(x - 0.02, -0.3, z1 - 0.39, x + 0.02, 0.82, z1 - 0.35, chrome); }
  const spot = c.wallSpot(2.0, ['back', 'left', 'right'], 0.5);
  if (spot) {
    const tex = card(c, 'pool' + p.sign, p.sign.includes(' · ') ? p.sign.split(' · ') : [p.sign], { w: 144, h: 56, bg: '#f4f6f4', fg: '#1d4f8a', edge: '#c0392b', size: 15, pad: 14 });
    framed(c, c.mapped('poolsign', tex), spot.side, spot.at, 1.62, 1.5, 0.58, null, [0.75, 0.75, 0.72]);
  }
  const k = c.corner(0.7);
  if (k) { const lad = c.prop('ladder', k.x, k.z, { rot: Math.atan2(-k.x, -k.z), fallback: [0.5, 1.6, 0.5] }); c.prop('chair', k.x, k.z, { y: lad.top - 0.02, rot: Math.atan2(-k.x, -k.z), solid: false, shadow: false, o: { color: '#b5483f' } }); }
  c.use({ x: 0, z: z1 + 0.5, r: 1.3, label: p.fill === 'balls' ? 'squeeze a stress ball' : p.fill === 'peanuts' ? 'pick up a packing peanut' : 'pick up a shred', use: () => c.env.sound.play(p.fill === 'balls' ? 'squeak' : 'rustle') });
}

/** The floor is a keyboard. The far wall is a screen. You type by walking. */
function keyboardFloor(c) {
  const { W, D, H, R, params: p } = c, kit = c.kit, NAME = c.level.name.toUpperCase();
  c.shell();
  const rows = p.layout === 'azerty' ? ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'] : p.layout === 'scrambled' ? (() => { const all = R.shuffle('QWERTYUIOPASDFGHJKLZXCVBNM'.split('')).join(''); return [all.slice(0, 10), all.slice(10, 19), all.slice(19)]; })() : ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const zTop = -D / 2 + 1.95, PITCH = 0.9, keys = [];
  rows.forEach((row, r) => { const shift = [0, 0.3, 0.75][r]; [...row].forEach((ch, i) => keys.push({ ch, x: (i - 4.5) * PITCH + shift, z: zTop + r * PITCH, w: 0.8 })); });
  keys.push({ ch: '\n', label: 'ENTER', x: Math.min(W / 2 - 0.75, 4.55), z: zTop + PITCH, w: 1.0 });
  keys.push({ ch: '\b', label: '<-', x: 3.3, z: zTop + 2 * PITCH, w: 1.3 });
  keys.push({ ch: ' ', label: '', x: 0, z: zTop + 3 * PITCH, w: 4.4 });
  const scheme = { beige: ['#d8d0bb', '#b3aa94', '#3a3428'], dark: ['#3d3f46', '#26272c', '#e6e2d4'], grey: ['#a9adb3', '#7d8188', '#22242a'] }[p.keys];
  const caps = atlas(kit, 'keys' + c.room.id, 40, 40, keys.length, (g, i, w, h) => {
    P(g, scheme[1], 0, 0, w, h); P(g, scheme[0], 3, 2, w - 6, h - 7); P(g, scheme[1], 3, h - 6, w - 6, 1);
    drawText(g, [keys[i].label ?? keys[i].ch], 3, 2, w - 6, h - 9, { color: scheme[2], size: (keys[i].label ?? '').length > 2 ? 9 : 20, pad: 2 });
  });
  const side = lin(scheme[1]).map((v) => v * 0.8);
  keys.forEach((k, i) => {
    const b = new Batch(), x0 = k.x - k.w / 2, x1 = k.x + k.w / 2, z0 = k.z - 0.4, z1 = k.z + 0.4, uv = caps.uv(i), edge = [uv[0], uv[0], uv[0], uv[0]];
    b.quad([x0, 0.07, z1], [x1, 0.07, z1], [x1, 0.07, z0], [x0, 0.07, z0], WHITE, [uv[0], uv[1], uv[2], uv[3]]);
    b.quad([x0, 0, z1], [x1, 0, z1], [x1, 0.07, z1], [x0, 0.07, z1], side, edge); b.quad([x1, 0, z0], [x0, 0, z0], [x0, 0.07, z0], [x1, 0.07, z0], side, edge);
    b.quad([x1, 0, z1], [x1, 0, z0], [x1, 0.07, z0], [x1, 0.07, z1], side, edge); b.quad([x0, 0, z0], [x0, 0, z1], [x0, 0.07, z1], [x0, 0.07, z0], side, edge);
    k.node = c.dynamic(b, { map: caps.texture }); k.down = 0;
    c.reserve(k.x, k.z, 0.5);
  });
  const keyAt = (x, z, pad) => keys.find((k) => Math.abs(x - k.x) < k.w / 2 - pad && Math.abs(z - k.z) < 0.4 - pad) || null;
  c.rt.floorY = (x, z) => { const k = keyAt(x, z, 0); return k ? 0.07 - k.down * 0.05 : 0; };

  // the screen: one long terminal across the far wall
  const tex = kit.tex.live(384, 128), g = tex.image.getContext('2d');
  const lines = ['OFFICE BASIC V0.2', '64K CARPET FREE', 'READY.'];
  let input = '', blink = 0;
  const draw = () => {
    g.fillStyle = '#060a08'; g.fillRect(0, 0, 384, 128);
    g.font = '700 20px ui-monospace, Menlo, Consolas, monospace'; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = p.phosphor;
    const shown = [...lines.slice(-4), `${p.prompt} ${input}${blink < 0.5 ? '_' : ''}`];
    shown.forEach((t, i) => g.fillText(t.slice(0, 30), 10, 6 + i * 24));
    g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < 128; y += 3) g.fillRect(0, y, 384, 1);
    tex.needsUpdate = true;
  };
  draw();
  const sw = Math.min(W - 2.2, 6.6), sh = sw / 3, sy = 0.42 + sh / 2;
  c.wbox('back', 0, sw + 0.3, sy - sh / 2 - 0.15, sy + sh / 2 + 0.15, 0, 0.09, lin('#cfc6b0'));
  const sb = new Batch(); c.hang(sb, 'back', 0, sy, sw, sh, null, WHITE, 0.095);
  c.add(new THREE.Mesh(kit.plain(sb), kit.glowing(tex, 1.5)));
  c.light(0, sy, -D / 2 + 1.2, p.phosphor, 0.5, { k: 2.2, far: 8, axis: [0, 0, 1], floor: 0.3 });
  const run = (cmd) => {
    if (!cmd) return [];
    if (/^(HELP|\?)$/.test(cmd)) return ['NO.'];
    if (/^(HI|HELLO|HEY|YO)$/.test(cmd)) return [`HELLO ${NAME}.`];
    if (/^(EXIT|QUIT|LOGOUT|BYE|OUT)$/.test(cmd)) { const path = c.world.path(c.room.id, c.level.exit.room) || []; return [`EXIT: ${Math.max(1, path.length - 1)} ROOMS FROM HERE.`, `PAST ${c.level.hint.toUpperCase()}.`]; }
    if (/^(LS|DIR)$/.test(cmd)) return c.level.picked.map((id) => id.toUpperCase().replace(/-/g, '_') + '/').join(' ').match(/.{1,28}(\s|$)/g).map((t) => t.trim());
    if (cmd === 'WHOAMI') return [`${NAME} (LOST)`];
    if (/^(PWD|CD|WHERE)$/.test(cmd)) return ['/OFFICE/BELOW/BELOW/BELOW'];
    if (/^(DATE|TIME)$/.test(cmd)) return ['IT IS STILL TODAY.'];
    if (/^SUDO/.test(cmd)) return ['NICE TRY.'];
    if (/^RM/.test(cmd)) return ['PLEASE DO NOT.'];
    if (cmd === 'PING') return ['PONG', '(pong)'];
    if (cmd === 'LEGACY') { c.env.pursuer?.wake?.(); return ['DO NOT SAY ITS NAME.']; }
    if (/^(VIM?|EMACS)$/.test(cmd)) return ['YOU CANNOT LEAVE THAT EITHER.'];
    if (cmd === NAME) return ['YES. THAT IS YOU.'];
    if (cmd === 'WHY') return ['YOU LEANED ON IT.'];
    if (/^(YES|NO|OK)$/.test(cmd)) return ['NOTED.'];
    return ['BAD COMMAND OR FILE NAME'];
  };
  let cur = null;
  c.tick((dt, t, me) => {
    const was = blink < 0.5; blink = (blink + dt) % 1;
    const k = me.inside ? keyAt(me.x, me.z, 0.06) : null;
    if (k !== cur && (k || !keyAt(me.x, me.z, -0.04))) {
      cur = k;
      if (k) {
        c.env.sound.play('clack');
        if (k.ch === '\n') { const cmd = input.trim().toUpperCase(); lines.push(`${p.prompt} ${input}`, ...run(cmd)); input = ''; }
        else if (k.ch === '\b') input = input.slice(0, -1);
        else if (input.length < 24) input += k.ch;
        draw();
      }
    }
    for (const key of keys) { const want = key === cur ? 1 : 0; if (key.down !== want) { key.down += (want - key.down) * Math.min(1, dt * 22); if (Math.abs(key.down - want) < 0.01) key.down = want; key.node.position.y = -key.down * 0.05; } }
    if (me.inside && was !== (blink < 0.5)) draw();
  });
}

// What comes back when the little door is knocked at: the other side of its plaque.
const TINY_REPLIES = { 'STAFF ONLY': 'SMALLER STAFF ONLY', 'MEETING ROOM 0.3': 'IN A MEETING', 'EXIT (SMALL)': 'NOT YOUR SIZE', MANAGEMENT: 'OUT TO LUNCH', SUPPLIES: 'OUT OF STOCK', 'DO NOT KNOCK': 'WE DID SAY' };
const STOOP_AT = 1.72;                               // the ceiling height at which somebody your size starts to duck, metres

/** A corridor that is really a funnel: it only looks long. The door at the end is the right size for the end. */
function tinyDoor(c) {
  const { W, D, H, params: p } = c, kit = c.kit, s1 = p.taper, zin = D / 2;
  c.shell({ walls: ['front'], floor: false, ceiling: false, panels: false, sockets: false });
  const sc = (z) => 1 - (1 - s1) * ((zin - z) / D);                                   // how big things are at depth z
  const far = (z) => (-D / (1 - s1)) * Math.log(sc(z));                               // how far away it pretends to be
  const depth = (v) => zin - (D * (1 - Math.exp((-v * (1 - s1)) / D))) / (1 - s1);     // …and back
  const n = Math.ceil(D / 0.3), tube = lin(c.look.tube), trim = lin(c.look.trim);
  const cut = [-1, -0.9, -0.4, 0, 0.4, 0.9, 1], up = [0, 0.07, 0.4, 0.75, 0.93, 1];
  for (let i = 0; i < n; i++) {
    const za = zin - (i / n) * D, zb = zin - ((i + 1) / n) * D, sa = sc(za), sb = sc(zb), fa = far(za), fb = far(zb), ha = (W / 2) * sa, hb = (W / 2) * sb;
    for (let k = 0; k < cut.length - 1; k++) {
      const u0 = cut[k], u1 = cut[k + 1], ao = (k === 0 || k === cut.length - 2) ? 0.8 : 1;
      c.floor.quad([u0 * hb, 0, zb], [u0 * ha, 0, za], [u1 * ha, 0, za], [u1 * hb, 0, zb], WHITE, [[u0 * W / 3.2, fb / 1.6], [u0 * W / 3.2, fa / 1.6], [u1 * W / 3.2, fa / 1.6], [u1 * W / 3.2, fb / 1.6]], ao);
      c.ceil.quad([u0 * hb, H * sb, zb], [u1 * hb, H * sb, zb], [u1 * ha, H * sa, za], [u0 * ha, H * sa, za], WHITE, [[u0 * W / 2 / TILE, fb / TILE], [u1 * W / 2 / TILE, fb / TILE], [u1 * W / 2 / TILE, fa / TILE], [u0 * W / 2 / TILE, fa / TILE]], ao);
    }
    for (let k = 0; k < up.length - 1; k++) {
      const v0 = up[k] * H, v1 = up[k + 1] * H, ao = (k === 0 || k === up.length - 2) ? 0.82 : 1;
      const uv = [[fa / 0.8, v0 / 0.8], [fb / 0.8, v0 / 0.8], [fb / 0.8, v1 / 0.8], [fa / 0.8, v1 / 0.8]];
      c.wall.quad([-ha, v0 * sa, za], [-hb, v0 * sb, zb], [-hb, v1 * sb, zb], [-ha, v1 * sa, za], WHITE, uv, ao);
      c.wall.quad([hb, v0 * sb, zb], [ha, v0 * sa, za], [ha, v1 * sa, za], [hb, v1 * sb, zb], WHITE, [uv[1], uv[0], uv[3], uv[2]], ao);
    }
    for (const sx of [-1, 1]) {            // skirting, shrinking with everything else
      const a = [sx * (ha - 0.022 * sa), 0, za], b = [sx * (hb - 0.022 * sb), 0, zb], ta = [a[0], 0.11 * sa, za], tb = [b[0], 0.11 * sb, zb];
      if (sx < 0) c.flat.quad(a, b, tb, ta, trim); else c.flat.quad(b, a, ta, tb, trim);
    }
  }
  // the far wall, wallpapered at the far wall's scale
  const hw = (W / 2) * s1, hh = H * s1, zf = -D / 2;
  c.wall.quad([-hw, 0, zf], [hw, 0, zf], [hw, hh, zf], [-hw, hh, zf], WHITE, [[-W / 1.6, 0], [W / 1.6, 0], [W / 1.6, H / 0.8], [-W / 1.6, H / 0.8]]);
  // ceiling panels at what would be a regular spacing, if the corridor were what it looks like
  const on = c.shining('panel', kit.tex.panel(true), 2.5, tube);
  for (let v = 1.2; v < far(zf) - 1.4; v += 2.4) {
    const za = depth(v - TILE), zb = depth(v + TILE), zm = depth(v), sa = sc(za), sb = sc(zb), sm = sc(zm), e = 0.006;
    on.quad([-TILE / 2 * sb, H * sb - e, zb], [TILE / 2 * sb, H * sb - e, zb], [TILE / 2 * sa, H * sa - e, za], [-TILE / 2 * sa, H * sa - e, za], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    c.light(0, H * sm - 0.14 * sm, zm, tube, 1.05 * Math.pow(sm, 0.8), { axis: [0, -1, 0], floor: 0.24, k: 3.4 * sm * sm, far: 2 + 12 * sm });
  }
  // furniture in pairs, each pair smaller than the last
  const stood = [];
  [1.6, 4.0, 6.4, 8.8, 11.2, 13.6, 16].forEach((v, i) => {
    if (v > far(zf) - 0.8) return;
    const z = depth(v), k = sc(z), sx = i % 2 ? 1 : -1;
    stood.push({ z, sx });
    c.prop(i % 3 === 2 ? 'floorlamp' : 'planttall', sx * (W / 2 - 0.42) * k, z, { scale: k, rot: i, solid: k > 0.8, shadow: 0.35, o: { variant: i % 4 }, fallback: [0.4, 1.5, 0.4] });
  });
  // …and one thing that is the size it says it is: a sign, standing where you first have to duck. Everything else in
  // here is a little smaller than the thing before it, so this is the one honest measure of how small that has become.
  const zs = Math.min(zin - (D * (1 - STOOP_AT / H)) / (1 - s1), D * 0.08 - 0.5);                  // (short of where a coin may hang: gen.js, STASH)
  const beside = stood.reduce((a, b) => (Math.abs(b.z - zs) < Math.abs(a.z - zs) ? b : a), { z: 99, sx: -1 });
  const xs = -beside.sx * Math.min(0.45, (W / 2) * sc(zs) - 0.4);
  wetSign(c, xs, zs, xs > 0 ? -0.22 : 0.22, ['CAUTION', 'LOW', 'CEILING']);
  c.solid(xs - 0.13, zs - 0.13, xs + 0.13, zs + 0.13);
  // the door: properly made, properly hung, a quarter of the size — frame, leaf, plaque and all
  const dw = 0.9 * s1, dh = 2.0 * s1, jamb = 0.07 * s1;
  doorFrame(c, 'back', 0, dw, dh, lin('#e2d8bd'), 0.05 * s1, jamb);
  doorLeaf(c, 'back', 0, dw - 0.02 * s1, dh - 0.01 * s1, lin(p.door), { d0: 0.012 * s1, y0: 0.02 * s1, k: s1 });
  // somebody is in: a line of light under it, and what gets out across the mat
  const lit = lin('#ffd9a0'), gap = 0.02 * s1;
  const glowB = new Batch(); c.hang(glowB, 'back', 0, gap / 2, dw * 0.94, gap, null, WHITE, 0.05 * s1);
  const under = c.add(new THREE.Mesh(kit.plain(glowB), kit.glowing(kit.tex.white(), 1.6, lit)));
  const spill = kit.tex.custom('doorspill', 32, 32, (g) => {
    const k = g.createRadialGradient(16, 0, 0, 16, 0, 30);
    for (const [at, a] of [[0, 1], [0.3, 0.5], [0.65, 0.14], [1, 0]]) k.addColorStop(at, `rgba(255,255,255,${a})`);
    g.fillStyle = k; g.fillRect(0, 0, 32, 32);
  }, { clamp: true });
  spill.magFilter = THREE.LinearFilter;
  const pool = c.add(new THREE.Mesh(kit.own(new THREE.PlaneGeometry(dw * 2.4, dw * 1.7)), kit.own(new THREE.MeshBasicMaterial({ map: spill, color: new THREE.Color().setRGB(0.5, 0.36, 0.16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.012, zf + dw * 0.85 + 0.05 * s1); pool.renderOrder = 2;
  c.light(0, 0.03, zf + 0.12, '#ffd9a0', 0.12, { k: 0.05, far: 1.2 });
  // the plaque over it — and the other side of the plaque, for anyone who knocks
  const pw = dw * 1.25, ph = pw * 0.25, py = dh + jamb + 0.03 * s1 + ph / 2;
  const plate = (words) => card(c, 'tiny' + words, [words], { w: 192, h: 48, bg: '#20242a', fg: '#f0e2b0', size: 22, pad: 14 });
  c.hang(c.mapped('tinysign', plate(p.sign)), 'back', 0, py, pw, ph, null, WHITE, 0.008);
  const reply = TINY_REPLIES[p.sign] || 'NO', turned = new Batch();
  c.hang(turned, 'back', 0, py, pw, ph, null, WHITE, 0.011);
  const answer = c.dynamic(turned, { map: plate(reply) });
  answer.visible = false;
  c.prop('doormat', 0, zf + 0.5 * s1, { scale: s1, solid: false, shadow: false, fallback: [0.3, 0.01, 0.2] });
  // you can only go as far as you fit — and long before that you are bent double: the eye keeps well under the ceiling
  // as it comes down (never along it, which looks like rising), and the last of the way is on hands and knees
  c.rt.clip = (x, z, r) => Math.abs(x) <= (W / 2) * sc(z) - r && H * sc(z) >= 0.74;
  c.tick((dt, t, me) => {
    if (!me.inside) return;
    const head = H * sc(me.z);
    me.world.sinkTo = Math.max(0, 1.1 - head * (1.1 / STOOP_AT));
    me.world.slow = clamp((head - 0.2) / 1.2, 0.6, 1);
  });
  // knock, and whoever is in there puts the light out and turns the plaque round. It comes back when they think you have gone.
  let hush = 0;
  c.use({ x: 0, z: zf + 0.4, r: 2.0, label: 'knock', use: () => { const w = c.toWorld(0, zf); c.env.play('knock', w.x, w.z, 5); hush = 6.5; } });
  c.tick((dt) => {
    if (hush <= 0) return;
    hush -= dt;
    const out = hush > 0 && hush < 5.9;                    // a moment after the knock
    under.visible = pool.visible = !out;
    answer.visible = hush > 0 && hush < 5.5;
  });
}

/** A dark room lit by vending machines. Every slot of every machine holds the same thing. */
function vending(c) {
  const { W, D, R, params: p } = c, kit = c.kit;
  c.shell();
  c.rt.noTorch = true; c.rt.level = Math.max(c.rt.level, 0.13);
  const front = kit.tex.custom('vend' + p.item, 64, 116, (g, w, h) => {
    P(g, '#15171c', 0, 0, w, h); P(g, p.color, 2, 2, w - 4, 20);
    drawText(g, p.item.length > 10 ? p.item.split(/ (?=[^ ]*$)/) : [p.item], 2, 2, w - 4, 20, { color: '#fffbe8', size: 9, pad: 4, leading: 1.05 });
    P(g, '#e9eef0', 4, 26, 40, 62);
    for (let r = 0; r < 5; r++) { P(g, '#9aa3a8', 4, 37 + r * 12, 40, 2); for (let k = 0; k < 4; k++) { P(g, p.color, 7 + k * 10, 28 + r * 12, 6, 9); P(g, '#ffffff', 8 + k * 10, 29 + r * 12, 1, 6); } }
    P(g, '#0a0b0d', 47, 26, 13, 10); drawText(g, [p.price], 47, 26, 13, 10, { color: '#ff5a3c', size: 6, pad: 1 });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) P(g, '#c8ccd0', 48 + k * 4, 40 + r * 4, 3, 3);
    P(g, '#0a0b0d', 50, 60, 7, 2); P(g, '#3a3f4a', 48, 66, 11, 8);
    P(g, '#0a0b0d', 8, 94, 36, 14); P(g, '#2a2d34', 10, 96, 32, 4); drawText(g, ['PUSH'], 8, 101, 36, 7, { color: '#8a9098', size: 5, pad: 1 });
  }, { clamp: true });
  const body = lin('#2b2f38'), glowB = c.shining('vendfront', front, 1.25), MW = 0.96, MH = 1.78, MD = 0.7;
  const sides = p.both ? [-1, 1] : [R.pick([-1, 1])];
  const n = Math.max(2, Math.floor((D - 2.4) / 1.12)), sulk = R.chance(0.5) ? R.int(1, n - 1) : -1;
  const bought = [], itemGeo = kit.own(new THREE.BoxGeometry(0.07, 0.09, 0.07)), itemMat = kit.own(new THREE.MeshBasicMaterial({ color: p.color }));
  itemMat.color.multiplyScalar(0.5);
  let count = 0;
  for (const sx of sides) for (let i = 0; i < n; i++, count++) {
    const z = D / 2 - 1.5 - i * 1.12, xw = sx * W / 2, xf = xw - sx * MD, turned = sx === sides[0] && i === sulk;
    c.flat.box(Math.min(xw, xf), 0, z - MW / 2, Math.max(xw, xf), MH, z + MW / 2, body, { skip: '-y' });
    c.solid(Math.min(xw, xf), z - MW / 2, Math.max(xw, xf), z + MW / 2, { tall: true });
    c.shadow((xw + xf) / 2, z, MD, MW, 0.5);
    if (turned) { for (let v = 0; v < 6; v++) c.flat.box(xf - sx * 0.004 - 0.004, 0.5 + v * 0.07, z - 0.3, xf - sx * 0.004 + 0.004, 0.53 + v * 0.07, z + 0.3, [0.05, 0.05, 0.06]); continue; }
    const x = xf - sx * 0.006, a = sx < 0 ? z + MW / 2 : z - MW / 2, b = sx < 0 ? z - MW / 2 : z + MW / 2;
    glowB.quad([x, 0.02, a], [x, 0.02, b], [x, MH - 0.02, b], [x, MH - 0.02, a]);
    c.light(xf - sx * 0.45, 1.05, z, p.glow, 0.42, { k: 1.1, far: 5.5, wrap: 0.5 });
    c.use({ x: xf - sx * 0.3, z, r: 1.15, label: `buy ${p.item.toLowerCase()}`, use: () => {
      const w = c.toWorld(xf, z); c.env.play('thunk', w.x, w.z, 5);
      if (bought.length >= 24) return;
      const item = new THREE.Mesh(itemGeo, itemMat), k = bought.length;
      item.position.set(xf - sx * (0.16 + (k % 4) * 0.11 + Math.random() * 0.03), 0.045, z + ((k * 7) % 5 - 2) * 0.13);
      item.rotation.y = k * 1.3;
      c.add(item); bought.push(item);
    } });
  }
}

/** Office plants, growing the only way left to them: down through the ceiling. */
function ceilingPlants(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();
  const green = ['#3f7a3a', '#4f8f45', '#2f5f33', '#5f9a4a'];
  const vine = (seed) => () => {
    const v = new Vox(), len = 14 + (seed * 7) % 26, r = (k) => (((seed * 131 + k * 71) % 17) / 17 - 0.5);
    let x = 0, z = 0;
    for (let y = 0; y < len; y += 3) {
      const nx = x + Math.round(r(y) * 3), nz = z + Math.round(r(y + 5) * 3);
      v.tube(x, y, z, nx, y + 3, nz, 0.6, M('#4a6a34', 2)); x = nx; z = nz;
      if (y % 6 === 0) v.ellipsoid(x + (r(y + 1) > 0 ? 2 : -2), y + 1, z + (r(y + 2) > 0 ? 1 : -1), 2.4, 1.2, 1.8, M(green[(seed + y) % 4], 2));
    }
    v.ellipsoid(x, len + 1, z, 2.6, 2, 2.2, M(green[seed % 4], 2));
    return v;
  };
  const spots = [];
  for (let i = 0; i < p.count; i++) {
    const s = c.spot(0.45, { pad: 0.2 }); if (!s) continue;
    const tall = R.chance(0.4);
    if (R.chance(0.6)) c.hole(s.x, s.z);
    c.prop(tall ? 'planttall' : 'plant', s.x, s.z, { flip: true, y: H + 0.12, rot: R.range(0, 6), o: { variant: i % 4 }, solid: false, shadow: false });
    c.blot(s.x, s.z, 0.9, 0.9, { a: 0.28 });
    spots.push(s);
  }
  for (let i = 0; i < p.vines; i++) {
    const x = R.range(-W / 2 + 0.3, W / 2 - 0.3), z = R.range(-D / 2 + 0.3, D / 2 - 0.3);
    if (i % 3 === 0) c.hole(x, z);
    c.model('vine' + (i % 6), vine(i % 6 + 2), x, z, { flip: true, y: H, rot: R.range(0, 6), solid: false, shadow: false });
  }
  // what has fallen: leaves, and soil that came down with them
  for (let i = 0; i < p.leaves; i++) { const s = spots.length ? R.pick(spots) : { x: 0, z: 0 }, x = clamp(s.x + R.range(-0.9, 0.9), -W / 2 + 0.1, W / 2 - 0.1), z = clamp(s.z + R.range(-0.9, 0.9), -D / 2 + 0.1, D / 2 - 0.1); c.lay(c.flat, x, z, 0.09, 0.05, R.range(0, 6), null, lin(R.pick(green)), 0.007); }
  for (const s of spots.slice(0, 4)) { c.blot(s.x + 0.1, s.z, 0.5, 0.4, { rgb: [0.1, 0.06, 0.03], a: 0.7 }); c.flat.ball(s.x + 0.1, 0.01, s.z, 0.1, [0.16, 0.1, 0.05], 0.35, 6); }
  if (p.can) {
    const s = c.spot(0.35);
    if (s) {
      c.model('wateringcan', () => { const v = new Vox(), tin = M('#5f8a8f', 0); v.cyl('y', 0, 0, 0, 9, 4.5, tin); v.carve(-3, 2, -3, 3, 9, 3); v.tube(4, 5, 0, 10, 9, 0, 0.8, tin); v.box(10, 8, -1, 12, 10, 1, tin); v.ring(-5, 5, 0, 3, 0.7, tin, 'z'); return v; }, s.x, s.z, { rot: R.range(0, 6), solid: false });
    }
  }
}

/** A telephone on the floor, ringing. It stops the moment you could answer it. */
function phone(c) {
  const { W, D, R, params: p } = c, kit = c.kit;
  c.shell();
  // it sits under a working light if there is one near
  let px = p.at[0] * W, pz = p.at[1] * D;
  const lit = c.room.panels.filter((q) => q.state === 'on').sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
  if (lit) { px = lit.x; pz = lit.z + 0.2; }
  c.reserve(px, pz, 0.8);
  const body = new Batch(true);
  c.place(kit.model('phone' + p.color, () => {
    const v = new Vox(), col = M(p.color, 0), dark = M('#26262c', 0), key = M('#e8e2d0', 0);
    v.rbox(-7, 0, -6, 7, 3, 6, 1, col, 'xz'); v.box(-7, 3, -6, 7, 4, 2, col); v.box(-7, 4, -6, 7, 5, -1, col); v.box(-7, 5, -6, 7, 6, -3, col);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) v.set(-2 + i * 2, 3, 2 + j, key);
    v.box(-6, 6, -6, -3, 8, -2, dark); v.box(3, 6, -6, 6, 8, -2, dark);                       // the cradle
    v.rbox(-9, 8, -5, 9, 10, -3, 1, col, 'xyz'); v.rbox(-9, 6, -6, -5, 9, -2, 1, col, 'xyz'); v.rbox(5, 6, -6, 9, 9, -2, 1, col, 'xyz');      // the handset
    v.set(5, 3, 4, glow('#ff3a2a'));
    return v;
  }), px, pz, { batch: body, rot: R.range(-0.6, 0.6), scale: 1.35, solid: false, shadow: 0.45 });
  const set = c.dynamic(body, { pivot: [px, 0, pz] });
  // the cord, across the carpet to the nearest wall
  const w = [[-W / 2, pz, 'left'], [W / 2, pz, 'right'], [px, -D / 2, 'back']].sort((a, b) => Math.hypot(a[0] - px, a[1] - pz) - Math.hypot(b[0] - px, b[1] - pz))[0];
  const cord = [0.13, 0.13, 0.14], mid = [px + (w[0] - px) * 0.5 + R.range(-0.4, 0.4), pz + (w[1] - pz) * 0.5 + R.range(-0.4, 0.4)];
  for (const [a, b] of [[[px, pz], mid], [mid, [w[0], w[1]]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (-(b[1] - a[1]) / len) * 0.008, nz = ((b[0] - a[0]) / len) * 0.008;
    c.flat.quad([a[0] - nx, 0.012, a[1] - nz], [a[0] + nx, 0.012, a[1] + nz], [b[0] + nx, 0.012, b[1] + nz], [b[0] - nx, 0.012, b[1] - nz], cord);
    c.flat.quad([a[0] + nx, 0.012, a[1] + nz], [a[0] - nx, 0.012, a[1] - nz], [b[0] - nx, 0.012, b[1] - nz], [b[0] + nx, 0.012, b[1] + nz], cord);
  }
  c.socket(w[2], w[2] === 'back' ? w[0] : w[1], 0.12);
  let armed = true, ring = 0.6, shake = 0, n = 0;
  const here = c.toWorld(px, pz);
  c.tick((dt, t, me) => {
    const d = Math.hypot(me.x - px, me.z - pz);
    if (!armed && (!me.inside || d > 5.5)) armed = true;
    if (armed && d > 2.15) { ring -= dt; if (ring <= 0) { ring = 3.2; shake = 1.0; c.env.play('ring', here.x, here.z, 9); } }
    else { ring = 0.5; shake = 0; }
    if (shake > 0) { shake -= dt; const on = shake > 0.55 || (shake > 0.1 && shake < 0.5); set.rotation.z = on ? Math.sin(t * 70) * 0.05 : 0; set.position.y = on ? Math.abs(Math.sin(t * 35)) * 0.012 : 0; }
    else if (set.rotation.z) { set.rotation.z = 0; set.position.y = 0; }
  });
  c.use({ x: px, z: pz, r: 1.4, label: 'pick up the phone', use: () => { armed = false; c.env.play('dialtone', here.x, here.z, 6); } });
}

/** A great many chairs with one idea between them. */
function chairs(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();
  const chair = (x, z, rot, o = {}) => c.prop('chair', x, z, { rot, o: { color: o.color || p.color }, ...o });
  if (p.variant === 'corner') {
    const cx = p.corner * (W / 2 - 0.5), cz = -D / 2 + 0.5;
    c.reserve(cx, cz, 1.3);
    let placed = 0;
    for (let z = -D / 2 + 1.0; z < D / 2 - 0.7 && placed < p.count + 6; z += 1.22) for (let x = -W / 2 + 0.8; x < W / 2 - 0.6; x += 1.22) {
      const jx = x + R.range(-0.16, 0.16), jz = z + R.range(-0.16, 0.16);
      if (!c.clear(jx, jz, 0.42) || R.chance(0.22)) continue;
      c.reserve(jx, jz, 0.4);
      const odd = p.odd && placed === 3;
      chair(jx, jz, Math.atan2(cx - jx, cz - jz) + R.range(-0.05, 0.05), odd ? { color: p.odd } : {});
      placed++;
    }
    if (p.thing === 'cup') c.model('papercup', () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 4, 1.6, M('#f4f1e6', 0), 2.2); return v; }, cx, cz, { solid: false, shadow: 0.3 });
    else if (p.thing === 'plant') c.prop('plant', cx, cz, { solid: false });
    else if (p.thing === 'crt') { c.prop('crt', cx, cz, { rot: Math.atan2(-cx, -cz), solid: false }); c.light(cx - p.corner * 0.4, 0.3, cz + 0.4, '#8fd6a8', 0.25, { k: 0.5, far: 3 }); }
    else if (p.thing === 'sign') wetSign(c, cx, cz, Math.atan2(-cx, -cz), ['CAUTION', 'CORNER']);
    else if (p.thing === 'phone') c.flat.box(cx - 0.12, 0, cz - 0.1, cx + 0.12, 0.07, cz + 0.1, [0.5, 0.12, 0.1]);
  } else if (p.variant === 'arch') {
    // two leaning towers of chairs that meet at the top; you can walk under
    const cz = -0.3, tier = 0.4;
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
      const lean = k < 3 ? 0 : (k - 2) * 0.3;
      c.prop('chair', sx * (1.25 - lean), cz + R.range(-0.05, 0.05), { y: k * tier, rot: (sx > 0 ? -Math.PI / 2 : Math.PI / 2) + R.range(-0.2, 0.2), tilt: [0, sx * lean * 0.5], solid: k === 0, shadow: k === 0 ? 0.5 : false, o: { color: k === 5 && p.odd ? p.odd : p.color } });
    }
    c.prop('chair', 0, cz, { y: H - 0.02, flip: true, rot: 0, solid: false, shadow: false, o: { color: p.odd || p.color } });
    c.reserve(0, cz, 1.9);
    for (let i = 0; i < Math.min(8, p.count - 13); i++) { const sx = i % 2 ? 1 : -1, z = cz + 1.1 + Math.floor(i / 2) * 0.95; if (z < D / 2 - 0.9 && c.clear(sx * 1.25, z, 0.35)) chair(sx * 1.25, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2); }
  } else if (p.variant === 'audience') {
    const cols = Math.max(3, Math.floor((W - 2.4) / 0.85)), rowsN = Math.min(4, Math.max(2, Math.floor((D - 4.2) / 1.0)));
    for (let r = 0; r < rowsN; r++) for (let i = 0; i < cols; i++) {
      const x = (i - (cols - 1) / 2) * 0.85 + (Math.abs(i - (cols - 1) / 2) < 0.6 && cols % 2 ? 0 : 0), z = -D / 2 + 3.0 + r * 1.0;
      if (Math.abs(x) < 0.5) continue;                                   // an aisle down the middle
      if (c.clear(x, z, 0.3)) chair(x, z, Math.PI + R.range(-0.04, 0.04), p.odd && r === 1 && i === 0 ? { color: p.odd } : {});
    }
    c.prop('lectern', -W / 2 + 1.6, -D / 2 + 1.1, { rot: 0.3, fallback: [0.6, 1.1, 0.5] });
    const tex = card(c, 'slide' + p.slide, p.slide.length > 14 ? p.slide.split(/ (?=[^ ]*$)/) : [p.slide], { w: 160, h: 100, bg: '#f6f6f0', fg: '#23262e', size: 20, pad: 18 });
    c.hang(c.shining('slide', tex, 1.25), 'back', 0.6, 1.5, 2.6, 1.62, null, WHITE, 0.012);
    c.light(0.6, 1.5, -D / 2 + 0.8, '#f4f6ff', 0.35, { k: 1.4, far: 6, axis: [0, 0, 1], floor: 0.3 });
  } else {
    const r = Math.min(W, D) / 2 - 1.5, n = Math.min(p.count, Math.floor((Math.PI * 2 * r) / 0.78));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r - 0.2; if (c.clear(x, z, 0.3)) chair(x, z, a + R.range(-0.03, 0.03), p.odd && i === 2 ? { color: p.odd } : {}); }
    chair(0, -0.2, 0, { color: p.odd || p.color });
    c.reserve(0, -0.2, r + 0.4);
  }
}

/** Wet floor signs. The floor is dry. */
function wetFloor(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();
  const px = p.puddle[0] * W, pz = p.puddle[1] * D, spots = [];
  c.reserve(px, pz, 0.9);
  if (p.pattern === 'spiral') for (let i = 0; i < p.count; i++) { const a = i * 0.62, r = 1.0 + i * 0.085; spots.push([px + Math.sin(a) * r, pz + Math.cos(a) * r, a + Math.PI / 2]); }
  else if (p.pattern === 'grid' || p.pattern === 'rows') { const step = p.pattern === 'grid' ? 1.05 : 0.62; for (let z = -D / 2 + 0.8; z < D / 2 - 0.6; z += p.pattern === 'grid' ? 1.05 : 1.5) for (let x = -W / 2 + 0.7; x < W / 2 - 0.5; x += step) spots.push([x, z, p.pattern === 'grid' ? 0 : Math.PI / 2]); }
  else for (let i = 0; i < p.count * 2; i++) spots.push([R.range(-W / 2 + 0.5, W / 2 - 0.5), R.range(-D / 2 + 0.5, D / 2 - 0.5), R.range(0, 6)]);
  let n = 0;
  for (const [x, z, rot] of spots) {
    if (n >= p.count || !c.clear(x, z, 0.3)) continue;
    c.reserve(x, z, 0.26);
    const fallen = p.pattern === 'rows' && n % 9 === 8;
    wetSign(c, x, z, rot + R.range(-0.08, 0.08), p.texts[n % p.texts.length].split('|'), fallen);
    if (!fallen) c.solid(x - 0.13, z - 0.13, x + 0.13, z + 0.13);
    n++;
  }
  // the one wet patch has no sign
  c.blot(px, pz, 1.5, 1.2, { rgb: [0.02, 0.03, 0.04], a: 0.62 });
  c.blot(px + 0.1, pz, 0.8, 0.6, { rgb: [0.5, 0.55, 0.6], a: 0.16, y: 0.008 });
  c.blot(px, pz, 1.2, 1.0, { rgb: [0.2, 0.13, 0.04], a: 0.5, y: H - 0.004, down: true });
  let drip = 1;
  const here = c.toWorld(px, pz);
  c.tick((dt, t, me) => { drip -= dt; if (drip < 0 && me.inside) { drip = 1.4 + Math.random() * 2; c.env.play('click', here.x, here.z, 3); } });
  const k = c.corner(0.5);
  if (k) { c.flat.box(k.x - 0.14, 0, k.z - 0.14, k.x + 0.14, 0.26, k.z + 0.14, [0.85, 0.7, 0.1]); c.flat.box(k.x - 0.015, 0, k.z + 0.16, k.x + 0.015, 1.3, k.z + 0.19, [0.55, 0.4, 0.22]); c.flat.box(k.x - 0.14, 0, k.z + 0.1, k.x + 0.14, 0.09, k.z + 0.26, [0.8, 0.78, 0.7]); c.solid(k.x - 0.15, k.z - 0.15, k.x + 0.15, k.z + 0.26); }
}

export const MORE = { 'stress-pool': stressPool, 'keyboard-floor': keyboardFloor, 'tiny-door': tinyDoor, vending, 'ceiling-plants': ceilingPlants, phone, chairs, 'wet-floor': wetFloor, ...MORE2 };
