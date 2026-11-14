// A warehouse that was never allowed to stop being an office. The maze is
// made of freight; the two people working here have their own quiet routine.
import { lin } from './kit.js';
import { freightLayout } from './freight-layout.js';
import { installFreightDuo } from './freight-duo.js';
import { addGPU } from './freight-figures.js';
import { createFreightWear } from './freight-crates.js';

const tint = (rgb, k) => rgb.map((v) => v * k);

/** Pallet runners and broad boards, with actual gaps underneath. */
function pallet(c, x, z, w, d, wood) {
  const box = (...a) => c.flat.box(...a);
  for (const sx of [-0.36, 0, 0.36]) box(x + sx * w - 0.06, 0, z - d / 2, x + sx * w + 0.06, 0.105, z + d / 2, tint(wood, 0.56));
  const n = Math.max(4, Math.round(d / 0.23));
  for (let i = 0; i < n; i++) { const zz = z - d / 2 + i * d / n; box(x - w / 2, 0.105, zz, x + w / 2, 0.155, zz + d / n - 0.025, tint(wood, i % 3 === 0 ? 0.91 : 0.74)); }
}

/** The same construction makes ordinary freight, an open packing box, and
 * the hollow crate whose opening is ONLY on the back (-z) face. */
function crate(c, spec, opt = {}) {
  const { x, z, w, d, h } = spec, wood = opt.wear?.wood(spec) || lin(c.params.wood || '#947047'), dark = tint(wood, 0.44), edge = tint(wood, 1.12);
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, thick = opt.portal ? spec.thickness : 0.1;
  const box = (...a) => c.flat.box(...a), base = opt.portal ? 0.06 : 0.155;
  if (!opt.portal) pallet(c, x, z, w + 0.02, d + 0.02, wood);
  else box(x0, 0.015, z0, x1, base, z1, tint(wood, 0.56));
  const bands = spec.stack ? [base, h * 0.5, h] : [base, h];
  for (let k = 0; k < bands.length - 1; k++) {
    const lo = bands[k], hi = bands[k + 1] - 0.025, n = Math.max(4, Math.round(w / 0.28));
    // Solid backing keeps the board seams dark without holes through a crate.
    for (const side of [1, ...(opt.portal ? [] : [-1])]) {
      const zz = side > 0 ? z1 - thick : z0;
      box(x0, lo, zz, x1, hi, zz + thick, dark);
      for (let i = 0; i < n; i++) { const xx = x0 + i * w / n; box(xx + 0.012, lo + 0.025, zz - (side < 0 ? 0.012 : 0), xx + w / n - 0.012, hi - 0.025, zz + thick + (side > 0 ? 0.012 : 0), tint(wood, 0.88 + ((i + (spec.tone || 0)) % 4) * 0.07)); }
      for (const yy of [lo + 0.08, hi - 0.17]) box(x0 - 0.025, yy, zz - 0.035, x1 + 0.025, yy + 0.12, zz + thick + 0.035, edge);
      // Real nail heads remain above the rubbed ink and weathered boards.
      for (const xx of [x0 + 0.16, x1 - 0.16]) for (const yy of [lo + 0.14, hi - 0.11]) box(xx - 0.013, yy - 0.013, zz - 0.04, xx + 0.013, yy + 0.013, zz + thick + 0.04, [0.07, 0.064, 0.052]);
      opt.wear?.face(spec, side > 0 ? '+z' : '-z', lo, hi, n, opt);
    }
    for (const xx of [x0, x1 - thick]) {
      box(xx, lo, z0, xx + thick, hi, z1, tint(wood, 0.78));
      for (let j = 0, m = Math.max(4, Math.round(d / 0.28)); j < m; j++) { const zz = z0 + j * d / m; box(xx - 0.012, lo + 0.025, zz + 0.012, xx + thick + 0.012, hi - 0.025, zz + d / m - 0.012, tint(wood, 0.75 + ((j + 2) % 4) * 0.065)); }
      for (const yy of [lo + 0.08, hi - 0.17]) box(xx - 0.035, yy, z0, xx + thick + 0.035, yy + 0.12, z1, edge);
      opt.wear?.face(spec, xx === x0 ? '-x' : '+x', lo, hi, Math.max(4, Math.round(d / 0.28)), opt);
    }
    if (!opt.openTop) { box(x0, hi - 0.045, z0, x1, hi + 0.025, z1, tint(wood, 0.82)); opt.wear?.lid(spec, hi + 0.026); }
    else box(x0 + thick, lo + 0.015, z0 + thick, x1 - thick, lo + 0.07, z1 - thick, dark);
  }
  if (opt.portal) {
    for (const r of spec.solids) c.solid(r.x0, r.z0, r.x1, r.z1, { tall: true });
    // The ceiling and front wall darken the interior, rather than a magic
    // glowing doorway that advertises what the crate does from the entrance.
    c.shadow(x, z, w - 0.35, d - 0.15, 0.65, 0.065);
  } else c.solid(x0, z0, x1, z1, { tall: h > 1.1 });
}

function destination(c) {
  const occupied = c.env.pursuer?.at()?.room;
  const rooms = c.R.fork('freight-destination').shuffle(c.world.rooms.filter((r) => r.def.kind === 'plain' && !r.def.crawl && r.def.id !== c.room.id && r.id !== c.level.pursuer?.room && r.id !== occupied));
  for (const rt of rooms) {
    const walk = c.world.walkable(rt), reached = walk.flood(rt.def.doors), options = [];
    for (let i = 0; i < reached.length; i++) {
      if (!reached[i]) continue;
      const p = walk.at(i);
      if (Math.abs(p.x) > rt.def.W / 2 - 0.75 || Math.abs(p.z) > rt.def.D / 2 - 0.75 || !walk.free(p.x, p.z) || Math.abs(walk.floor(p.x, p.z)) > 0.01 || walk.head(p.x, p.z) < 1.8) continue;
      // Each target has enough floor for a body and is actually reachable
      // from the destination's ordinary doors, including its built furniture.
      const a = (rt.def.rot * Math.PI) / 2, cs = Math.cos(a), sn = Math.sin(a);
      const x = rt.def.cx + p.x * cs + p.z * sn, z = rt.def.cz - p.x * sn + p.z * cs;
      if (!c.world.free(x, z, 0.32) || c.world.headroom(x, z) < 1.8) continue;
      options.push({ room: rt.id, x, z, local: p, yaw: Math.atan2(x - rt.def.cx, z - rt.def.cz) });
    }
    if (options.length) return c.R.fork('freight-target:' + rt.id).pick(options);
  }
  return null;
}

function freight(c) {
  const plan = freightLayout(c.room), { work, portal } = plan;
  const wear = createFreightWear(c);
  c.shell({ sockets: true });
  for (const k of plan.crates) { crate(c, k, { wear }); c.shadow(k.x, k.z, k.w, k.d, 0.4); }
  // Tall supports retain wallpaper and skirting, even up here among freight.
  for (const p of plan.pillars) {
    c.wall.box(p.x - p.w / 2, 0, p.z - p.w / 2, p.x + p.w / 2, p.h, p.z + p.w / 2, [1, 1, 1]);
    c.flat.box(p.x - 0.25, 0, p.z - 0.25, p.x + 0.25, 0.13, p.z + 0.25, lin(c.look.trim));
  }
  crate(c, portal, { portal: true, wear });

  // Familiar office furniture, repurposed as a packing bench. All large
  // furniture stays behind the pair's reserved floor; the center is clear.
  const desk = c.prop('desk', work.table.x, work.table.z, { rot: Math.PI });
  const top = desk?.top || 0.75;
  c.prop('crt', work.table.x - 0.48, work.table.z - 0.06, { y: top, rot: Math.PI, solid: false, shadow: false });
  c.prop('keyboard', work.table.x - 0.4, work.table.z + 0.24, { y: top + 0.01, rot: Math.PI, solid: false, shadow: false });
  c.prop('desklamp', work.table.x + 0.63, work.table.z - 0.22, { y: top, solid: false, shadow: false });
  addGPU(c, work.table.x + 0.28, top + 0.015, work.table.z + 0.04, { rot: 0.15 });
  addGPU(c, work.table.x + 0.28, top + 0.125, work.table.z + 0.04, { rot: 0.08 });
  crate(c, work.crate, { openTop: true, wear });
  for (const dx of [-0.32, 0.32]) for (const dz of [-0.24, 0.18]) addGPU(c, work.crate.x + dx, 0.48, work.crate.z + dz);
  c.prop('cabinet', -c.W / 2 + 1.45, c.D / 2 - 0.5, { rot: Math.PI });
  c.prop('planttall', -1.8, c.D / 2 - 0.55, { solid: false, shadow: 0.2 });
  c.light(work.table.x, 1.5, work.table.z + 0.08, '#ffe0a0', 0.42, { k: 0.8, far: 5 });
  // Packing debris is texture and silhouette, not a carpet of colliders.
  for (let i = 0; i < 7; i++) c.paper(work.crate.x + c.R.range(-0.8, 0.8), work.crate.z + c.R.range(0.75, 1.0), c.R.range(-0.8, 0.8));

  const state = c.rt.freight = { layout: plan, maze: { crates: plan.crates, cell: plan.cell, open: plan.open }, work, portal: { ...portal, target: null, armed: false, uses: 0 }, validation: null, duo: null };
  state.duo = installFreightDuo(c, work);
  let cooldown = 0;
  const beforeLeave = c.rt.onLeave;
  c.rt.onLeave = () => { beforeLeave?.(); state.portal.armed = false; };
  (c.env.ready ||= []).push(() => {
    const walk = c.world.walkable(c.rt), reached = walk.flood(c.room.doors.slice(0, 1));
    const points = { home: work.home, loading: work.loading, pickup: work.pickup, portalEntry: portal.entry, portalInterior: { x: portal.x, z: portal.z } };
    const unreachable = Object.entries(points).filter(([, p]) => !walk.free(p.x, p.z) || reached[walk.key(p)] !== 1).map(([name]) => name);
    state.validation = { reachable: unreachable.length === 0, unreachable };
    if (unreachable.length) console.warn('[backrooms] freight floor could not be reached', unreachable);
    state.portal.target = destination(c);
    if (!state.portal.target) console.warn('[backrooms] freight crate found no safe destination');
  });
  c.tick((dt, t, me) => {
    cooldown = Math.max(0, cooldown - dt);
    if (!me.inside || me.world.frozen || cooldown > 0 || !state.portal.target) return;
    if (me.x > portal.interior.x0 && me.x < portal.interior.x1 && me.z < portal.outer.z0 - 0.05 && me.z > portal.outer.z0 - 1.35) state.portal.armed = true;
    if (!state.portal.armed || me.x < portal.interior.x0 || me.x > portal.interior.x1 || me.z < portal.interior.z0 || me.z > portal.interior.z1) return;
    // A destination selected when the floor was built must not become a
    // surprise encounter with the roaming mascot while someone walks here.
    if (c.env.pursuer?.at()?.room === state.portal.target.room) state.portal.target = destination(c);
    const to = state.portal.target;
    if (!to) return;
    const player = c.env.player, body = player.me;
    state.portal.armed = false; state.portal.uses++; cooldown = 1.5;
    player.warp(to.x, to.z, to.yaw);
    body.vx = body.vz = body.drop = body.dropV = body.sink = body.sinkTo = body.duck = 0;
    c.world.enter(c.world.rooms[to.room]);
    c.env.interfere(0.12);
  });
}

export const MORE4 = { 'freight': freight };
