import { Batch, lin, WHITE, ticks } from './kit.js';
import { underfloorSurfacePlan } from './underfloor-layout.js';

/** The upper office is only glimpsed through damaged inspection grilles. */
export function buildUnderfloorShell(c, plan) {
  const surfaces = underfloorSurfacePlan(plan);
  const { bottom: DECK_BOTTOM, top: DECK_TOP } = surfaces;
  const iron = lin('#454a46'), rust = lin('#655444'), timberTint = lin('#b3a389');
  // Keep a readable silhouette at floor level; ordinary room panels would wash
  // out the low tunnel, while the automatic camera lamp would erase the pools.
  c.rt.amb = [.028, .027, .023];
  c.rt.level = .13;
  c.rt.noTorch = true;
  c.shell({ sockets: false, panels: false, floorAlb: lin('#b2a489'), wallAlb: lin('#a49e87'), ceilAlb: lin('#a0a294') });

  const timber = c.kit.tex.custom('underfloor:timber:v2', 128, 64, g => {
    const r = c.R.fork('underfloor:timber:v2');
    g.fillStyle = '#8b7c60'; g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 230; i++) {
      g.fillStyle = i % 3 ? '#7d7059' : '#9b8b6f';
      g.fillRect(r.int(0, 127), r.int(0, 63), r.int(4, 28), 1);
    }
    // Grain and joins live in one texture, not floating coplanar strips.
    g.fillStyle = '#655b48'; g.fillRect(0, 0, 128, 1); g.fillRect(0, 32, 128, 1);
    for (const x of [5, 119]) for (const y of [7, 25, 39, 57]) {
      g.fillStyle = '#504b3e'; g.fillRect(x, y, 2, 2);
    }
  });
  const concrete = c.kit.tex.custom('underfloor:lime-blocks:v2', 128, 128, g => {
    const r = c.R.fork('underfloor:lime-blocks:v2');
    g.fillStyle = '#979384'; g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 4; row++) {
      const y = row * 32, shift = row % 2 ? 32 : 0;
      g.fillStyle = '#8c897c'; g.fillRect(0, y, 128, 1);
      for (let x = shift; x < 128; x += 64) g.fillRect(x, y, 1, 32);
    }
    for (let i = 0; i < 420; i++) {
      g.fillStyle = ['#929080', '#9d998b', '#a29c8e', '#888777'][i % 4];
      g.fillRect(r.int(0, 127), r.int(0, 127), r.int(1, 5), r.int(1, 3));
    }
    // Broad damp patches have soft pixel edges, without brick-red repetition.
    for (let i = 0; i < 16; i++) {
      g.fillStyle = 'rgba(68,73,59,.09)';
      g.fillRect(r.int(0, 110), r.int(0, 110), r.int(8, 25), r.int(5, 20));
    }
  });
  const boards = c.mapped('underfloor:timber:v2', timber);
  const piers = c.mapped('underfloor:piers:v2', concrete);
  for (const b of plan.solids) {
    // The old piers ended on the plank top and fought with it. The cap now
    // stops below the underside, hidden behind the deck's solid edge.
    piers.box(b.x0, 0, b.z0, b.x1, surfaces.pierTop, b.z1, WHITE, { uv: 1.5, skip: '-y' });
    c.solid(b.x0, b.z0, b.x1, b.z1, { tall: true, keep: true });
  }
  function deck(batch, b, carpet = false) {
    batch.box(b.x0, DECK_BOTTOM, b.z0, b.x1, DECK_TOP, b.z1, timberTint,
      { uv: .62, step: .5, skip: carpet ? '+y' : '' });
    if (carpet) c.floor.grid([b.x0, DECK_TOP, b.z1], [1, 0, 0], [0, 0, -1],
      ticks(b.x1 - b.x0), ticks(b.z1 - b.z0), (x, z) => [(b.x0 + x) / 1.6, (b.z1 - z) / 1.6], lin('#aca08a'));
  }
  for (const b of surfaces.fixed) deck(boards, b, true);
  const pressureBoards = plan.crossings.map((crossing, i) => {
    const wood = new Batch(), grate = new Batch(), a = surfaces.apertures[i];
    for (const b of surfaces.patches[i]) deck(wood, b);
    // Metal occupies only the hole. A torn-out middle pair leaves a genuinely
    // clear .36m slot for the creature's fingers and palm to come through.
    grate.box(a.x0, .99, a.z0, a.x0 + .055, DECK_TOP, a.z1, iron);
    grate.box(a.x1 - .055, .99, a.z0, a.x1, DECK_TOP, a.z1, iron);
    grate.box(a.x0 + .055, .99, a.z0, a.x1 - .055, DECK_TOP, a.z0 + .055, iron);
    grate.box(a.x0 + .055, .99, a.z1 - .055, a.x1 - .055, DECK_TOP, a.z1, iron);
    for (const x of [-.44, -.245, .245, .44]) {
      grate.box(x - .022, 1.025, a.z0 + .055, x + .022, 1.065, a.z1 - .055, iron);
      grate.box(x - .026, 1.025, a.z0 + .075, x + .026, 1.07, a.z0 + .15, rust);
    }
    // Broken ends remain at the frame rather than bridging the hand opening.
    for (const x of [-.1, .1]) {
      grate.box(x - .018, 1.02, a.z0 + .055, x + .018, 1.065, a.z0 + .105, rust);
      grate.box(x - .018, 1.02, a.z1 - .105, x + .018, 1.065, a.z1 - .055, rust);
    }
    const group = c.dynamic(wood, { map: timber });
    group.add(c.dynamic(grate));
    group.userData.aperture = a;
    return group;
  });

  // Beam-backed side pockets are the only places with full-height supports.
  // Their warm lights give the player a quiet visual cue without signs.
  for (const s of plan.shelters) {
    for (const z of [s.z0 + .07, s.z1 - .07]) {
      boards.box(s.x0, .86, z - .07, s.x1, 1.08, z + .07, WHITE, { uv: .62 });
      for (const x of [s.x0 + .08, s.x1 - .08]) {
        boards.box(x - .065, 0, z - .065, x + .065, .86, z + .065, WHITE, { uv: .62 });
        c.flat.box(x - .068, .67, z - .068, x + .068, .73, z + .068, iron);
        c.solid(x - .065, z - .065, x + .065, z + .065, { keep: true });
      }
    }
    c.blot(s.center.x, s.center.z, 1.4, 1.0, { a: .22, rgb: lin('#4c5040') });
    const bulbX = s.center.x + (s.center.x < 0 ? -.65 : .65);
    c.flat.box(bulbX - .035, .71, s.center.z - .035, bulbX + .035, .98, s.center.z + .035, iron);
    c.shining('underfloor:refuge-bulbs', c.kit.tex.white(), 1.1, lin('#c5ad7c'))
      .box(bulbX - .045, .67, s.center.z - .045, bulbX + .045, .735, s.center.z + .045, WHITE);
    c.light(bulbX, .62, s.center.z, '#dbb47c', .44, { far: 3.4, k: 1.5 });
  }

  // The entry reads as an impossible low opening, not a raised stage in a
  // brightly lit office. The matching solid jambs carry real collisions.
  for (const sign of [-1, 1]) {
    const z0 = sign > 0 ? plan.end : -plan.end - .16, z1 = z0 + .16;
    for (const [x0, x1] of [[-c.W / 2, -1.3], [1.3, c.W / 2]]) {
      c.wall.box(x0, 0, z0, x1, c.H, z1, lin('#a79f83'), { uv: 1.2, skip: '-y+y' });
      c.solid(x0, z0, x1, z1, { tall: true, keep: true });
    }
    c.wall.box(-1.3, 1.02, z0, 1.3, c.H, z1, lin('#a79f83'), { uv: 1.2, skip: '+y-y' });
    // The lintel replaces the plaster's bottom strip. It stays within the
    // .16m header depth used by the controller's anticipatory crouch check.
    boards.box(-1.3, .86, z0, 1.3, 1.02, z1, WHITE, { uv: .62, skip: '+y' });
    c.light(0, .48, sign * (plan.end + .30), '#c7b28a', .22, { far: 3.2, k: 1.8 });
  }
  // The torn carpet guides the eye into the slot without creating a floor step.
  c.floor.quad([-1.22, .018, plan.end + .63], [1.22, .018, plan.end + .63],
    [1.22, .19, plan.end + .24], [-1.22, .19, plan.end + .24], WHITE,
    [[0, 0], [1.5, 0], [1.5, .4], [0, .4]]);

  // In the upstairs space, low strips behind the walker outline its impossible
  // shape against a dim ceiling. No decorative geometry crosses an aperture.
  for (const b of plan.crossings) {
    const x = b.id % 2 ? -1.12 : 1.12, y = c.H - .18;
    c.flat.box(x - .14, y, b.z - .55, x + .14, y + .10, b.z + .55, iron);
    c.shining('underfloor:upper-tubes', c.kit.tex.white(), .85, lin('#c0cbbb'))
      .box(x - .08, y - .015, b.z - .48, x + .08, y, b.z + .48, WHITE, { skip: '+y' });
    c.light(x, y - .04, b.z, '#bfcfbb', .9, { far: 3.8, k: 2.0, axis: [0, -1, 0], floor: .22 });
    // A small bounce below the aperture makes the iron edges readable while
    // preserving dark stretches between the three pools.
    c.light(0, .76, b.z, '#95a49b', .12, { far: 1.9, k: .7 });
  }
  if (c.hasProp('chair')) c.prop('chair', 2.3, 5.9, { y: DECK_TOP, rot: .4, solid: false, shadow: false });
  if (c.hasProp('desk')) c.prop('desk', -2.8, -1.7, { y: DECK_TOP, rot: Math.PI / 2, solid: false, shadow: false });

  // A few sagging service lines reinforce the long tunnel, kept outside the
  // player's crawl clearance and away from the moving inspection spans.
  for (const x of [-1.18, 1.18]) for (const b of surfaces.fixed.filter(b => b.x0 < 0 && b.x1 > 0)) {
    c.flat.box(x - .018, .925, b.z0, x + .018, .96, b.z1, iron);
  }
  const dust = [];
  for (let i = 0; i < 18; i++) {
    const batch = new Batch();
    batch.box(-.009, 0, -.009, .009, .02, .009, lin('#b3aa8c'));
    dust.push(c.dynamic(batch));
  }
  return { pressureBoards, dust, surfacePlan: surfaces };
}
