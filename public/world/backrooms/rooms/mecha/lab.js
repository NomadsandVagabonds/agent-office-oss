// Static conditioning machinery. Everything joins the room's existing flat
// batch: twenty-four occupied rigs still add no meshes, lights or frame work.
import { lin } from '../../kit.js';

const C = {
  iron: lin('#34322a'), edge: lin('#5c5140'), bronze: lin('#716044'),
  hose: lin('#252721'), olive: lin('#676948'), glass: lin('#777b56'),
  reflection: lin('#a3a181'), grime: lin('#302d24'), paper: lin('#a39a75'),
};
const PORTS = {
  crown: [.01618, 1.80303, .24247],
  nape: [.07197, 1.51183, .02685],
  spine: [.016, .89555, -.0682],
};
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, n) => a.map(v => v * n);
const unit = a => scale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Four-sided tubing has a useful chunky silhouette at room distance. Shared
// rings close the bends, and real square end caps avoid degenerate triangles.
function hose(batch, points, radius, color) {
  const path = points.filter((p, i) => !i || Math.hypot(...sub(p, points[i - 1])) > 1e-6);
  if (path.length < 2) return;
  let previousU;
  const rings = path.map((p, i) => {
    const tangent = unit(sub(path[Math.min(i + 1, path.length - 1)], path[Math.max(0, i - 1)]));
    const reference = Math.abs(tangent[1]) < .9 ? [0, 1, 0] : [0, 0, 1];
    let u = unit(cross(tangent, reference));
    if (previousU && u.reduce((sum, v, n) => sum + v * previousU[n], 0) < 0) u = scale(u, -1);
    previousU = u;
    const v = cross(tangent, u);
    return [add(p, scale(u, radius)), add(p, scale(v, radius)), add(p, scale(u, -radius)), add(p, scale(v, -radius))];
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      const next = (j + 1) % 4;
      batch.quad(rings[i][j], rings[i][next], rings[i + 1][next], rings[i + 1][j], color);
    }
  }
  batch.quad(...[...rings[0]].reverse(), color);
  batch.quad(...rings[rings.length - 1], color);
}

function transform(x, z, rot) {
  const co = Math.cos(rot), si = Math.sin(rot);
  return p => [x + p[0] * co + p[2] * si, p[1], z - p[0] * si + p[2] * co];
}

// Exact transformed faces let any chair orientation share c.flat. The supplied
// room box helper is reserved for axis-aligned ceiling infrastructure.
function cuboid(batch, point, x0, y0, z0, x1, y1, z1, color) {
  const p = (x, y, z) => point([x, y, z]);
  batch.quad(p(x0,y0,z1),p(x1,y0,z1),p(x1,y1,z1),p(x0,y1,z1),color);
  batch.quad(p(x1,y0,z0),p(x0,y0,z0),p(x0,y1,z0),p(x1,y1,z0),color);
  batch.quad(p(x1,y0,z1),p(x1,y0,z0),p(x1,y1,z0),p(x1,y1,z1),color);
  batch.quad(p(x0,y0,z0),p(x0,y0,z1),p(x0,y1,z1),p(x0,y1,z0),color);
  batch.quad(p(x0,y1,z1),p(x1,y1,z1),p(x1,y1,z0),p(x0,y1,z0),color);
  batch.quad(p(x0,y0,z0),p(x1,y0,z0),p(x1,y0,z1),p(x0,y0,z1),color);
}

/** x/z are the chair centre; +Z faces the desk. Optional actor attachments are
 * room-space points returned by createWorker. All low parts stay in the cage. */
export function buildConditioningRig(c, { x, z, rot = 0, variant = 0, attachments = null }) {
  const point = transform(x, z, rot), batch = c.flat;
  const b = (...args) => cuboid(batch, point, ...args);
  const pipe = (path, radius, color, port) => {
    const vertices = path.map(point);
    if (port && attachments?.[port]) vertices[vertices.length - 1] = attachments[port];
    hose(batch, vertices, radius, color);
  };
  const side = Math.abs(Math.trunc(variant)) % 2 ? -1 : 1;

  // A worn examination gantry, built around the person rather than the desk.
  for (const sign of [-1, 1]) {
    b(sign * .49 - .045,.08,-.45,sign * .49 + .045,1.98,-.36,C.iron);
    b(sign * .49 - .13,.07,-.56,sign * .49 + .13,.13,-.12,C.edge);
  }
  b(-.57,1.94,-.47,.57,2.035,-.32,C.bronze);
  b(-.53,.37,-.44,.53,.44,-.35,C.iron);

  // The head is still legible: temple pads sit beside it; nothing covers eyes.
  for (const sign of [-1, 1]) {
    b(sign * .30 - .027,1.525,-.39,sign * .30 + .027,1.58,.15,C.bronze);
    b(sign * .30 - .038,1.49,.10,sign * .30 + .038,1.62,.19,C.hose);
    b(sign * .37 - .025,.70,-.12,sign * .37 + .025,1.025,.29,C.edge);
  }
  b(-.395,.955,.235,.395,1.025,.29,C.hose);

  // Clouded reservoir and its pump: opaque dirty glass is baked with the room,
  // so no transparency pass or extra material is needed for every cage.
  const px = side * .64;
  b(px-.12,.10,-.38,px+.12,.53,-.10,C.iron);
  b(px-.105,.51,-.35,px+.105,.88,-.13,C.glass);
  b(px-.13,.49,-.38,px+.13,.55,-.10,C.bronze);
  b(px-.13,.85,-.38,px+.13,.91,-.10,C.bronze);
  b(px-.072,.57,-.128,px-.044,.82,-.119,C.reflection);
  b(px-.075,.24,-.096,px+.075,.42,-.077,C.edge);
  b(px-.045,.29,-.073,px+.045,.37,-.060,C.olive);
  b(px+.07,.64,-.12,px+.14,.70,-.04,C.iron);

  // Counterweights and electrode sockets hang from the same mechanical frame.
  for (const sign of [-1, 1]) {
    b(sign * .43-.014,1.16,-.31,sign * .43+.014,1.94,-.282,C.bronze);
    b(sign * .43-.07,1.15,-.36,sign * .43+.07,1.35,-.24,C.iron);
  }
  b(-.04,1.775,.19,.08,1.827,.29,C.edge);
  b(.025,1.47,-.012,.115,1.55,.07,C.olive);
  b(-.04,.85,-.11,.07,.94,-.04,C.iron);

  // These terminate at actual cranial and back ports, not somewhere nearby.
  pipe([[0,2.58,-.40],[.04,2.22,-.37],[.17,2.13,-.14],[.21,1.99,.14],[.12,1.88,.28],PORTS.crown],.042,C.bronze,'crown');
  pipe([[-.46,1.89,-.40],[-.65,1.62,-.45],[-.69,.78,-.43],[-.48,.55,-.40],[-.13,.64,-.24],PORTS.spine],.060,C.hose,'spine');
  pipe([[px,.86,-.22],[side*.73,1.20,-.24],[side*.57,1.59,-.20],[side*.30,1.69,-.09],[.12,1.61,.02],PORTS.nape],.029,C.olive,'nape');

  // Tiny inventory tag and old leaks repeat like the marks under factory tools.
  b(-.18,1.952,-.311,.08,2.015,-.300,C.paper);
  for (let i = 0; i < 3; i++) {
    const gx = px-.11+i*.09, gz = -.28+i*.14;
    batch.quad(point([gx,.074,gz+.25]),point([gx+.035,.074,gz+.25]),point([gx+.035,.074,gz-.20]),point([gx,.074,gz-.20]),C.grime);
  }
  return { feed: point([0,2.58,-.40]) };
}

/** All cross-aisle runs stay overhead (at least 2.45m). stations are chair
 * positions {x,z,rot}; no collision, interaction, lighting or state is added. */
export function buildLabInfrastructure(c, { stations, computerZ, box }) {
  if (!stations.length) return;
  const batch = c.flat;
  const top = Math.max(2.85, Math.min(c.H - .40, 3.95));
  const front = Math.max(...stations.map(s => s.z)) + .35;
  const rear = computerZ + .35;
  // A narrow central tray with several sagging trunks underneath.
  if (box) {
    box(-.21,top+.06,Math.min(front,rear),.21,top+.14,Math.max(front,rear),C.iron);
    for (let z = rear + 1; z < front; z += 3.2) box(-.025,top+.14,z-.025,.025,c.H-.05,z+.025,C.bronze);
  }
  for (let strand = 0; strand < 3; strand++) {
    const x = (strand - 1) * .13;
    hose(batch,[[x,top,front],[x+.08,top-.22,front+(rear-front)*.3],[x-.04,top-.17,front+(rear-front)*.65],[x,top,rear],[x,3.12,rear-.20]],.036 + strand*.013,strand===1?C.bronze:C.hose);
  }
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i], point = transform(s.x,s.z,s.rot || 0), feed = point([0,2.58,-.40]);
    const spread = ((i % 5) - 2) * .09;
    hose(batch,[feed,[feed[0],2.96,feed[2]],[s.x*.74,top-.12-(i%3)*.06,s.z-.30],[s.x*.25,top-.35,computerZ+1.1+(i%4)*.16],[spread,3.12,computerZ+.16]],.022+(i%3)*.008,i%4===0?C.bronze:C.hose);
    // Black scuffs sit underneath the contained rig, not across an open aisle.
    for (let j=0;j<2;j++) {
      const a=-.53+j*.67, z=-.45+j*.13;
      batch.quad(point([a,.075,z+.58]),point([a+.10,.075,z+.58]),point([a+.10,.075,z-.12]),point([a,.075,z-.12]),C.grime);
    }
  }
}
