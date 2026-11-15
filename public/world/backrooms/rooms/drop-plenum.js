// The Return Plenum ("the step-ladder up into the red drop ceiling"): a wide
// office bay split in two by a cinderblock fire-stop wall whose rolling steel
// shutter has jammed shut. An unfolded yellow Facilities step-ladder climbs
// right through a popped 2x2 acoustic ceiling tile — past a crooked dangling
// louvered troffer, levitating ceiling tiles, and 90°-bent hanger wires — into
// a crimson Backrooms return plenum where another office's carpet, desks,
// chairs, CRTs, and yellow step-ladder hang upside-down overhead, a 2x2 hole
// peers down an infinite shaft of smaller drop-ceilings, a telescopic duct
// folds space across solid walls, and blind Plenum Toners prowl the inverted
// ceiling carpet above.
import * as THREE from 'three';
import { Batch, lin, WHITE } from '../kit.js';
import { headAt } from '../gen.js';
import { clamp, turnTo, card, framed, wetSign, scatter } from '../bits.js';
import { stepWalker } from '../denizens.js';
import {
  PLENUM,
  buildPlenumPlan,
  fragileTileAt,
  isCeilingOpenAt,
  plenumFloorY,
  plenumHeadY,
  createPlenumRoomState,
  pullShutterLever,
  stepPlenumRoom,
  createPlenumTonerState,
  plenumWeaveOffset,
  snipPlenumToner,
  releasePlenumToner,
  stepPlenumToner,
} from './drop-plenum/rule.js';
import {
  makePlenumTextures,
  louverTrofferVox,
  plenumBulkheadVox,
  shutterHoistVox,
  brokenTileShardVox,
  floatingTileVox,
  antiGravMugVox,
  makePlenumTonerRig,
} from './drop-plenum/rig.js';

export function build(c) {
  const { W, D, H, R, params: p } = c;
  const plan = buildPlenumPlan(W, D, H);
  const tex = makePlenumTextures(c, p);

  let roomState = createPlenumRoomState();

  // Heightfield & headroom hooks (preserving any raised outer doorway steps via c.floorAt / headAt)
  c.rt.floorY = (x, z) => Math.max(c.floorAt(x, z), plenumFloorY(plan, roomState.brokenMask, x, z));
  c.rt.headY = (x, z) => {
    const py = plenumFloorY(plan, roomState.brokenMask, x, z);
    const ph = plenumHeadY(plan, roomState.brokenMask, x, z);
    return py > 0.05 ? ph : Math.min(headAt(c.room, x, z), ph);
  };

  c.rt.amb = [0.014, 0.010, 0.010];
  c.shell({ panels: false, ceilTex: tex.slab });

  // Keep stashed tape spots clear
  c.reserve(2.55, 1.00, 0.65);
  c.reserve(1.55, -3.20, 0.65);

  const tileUnderB = c.mapped('plenum:tile-under', tex.tileUnder);
  const tileBackB = c.mapped('plenum:tile-back', tex.tileBack);
  const diffuserB = c.mapped('plenum:diffuser', tex.diffuser);
  const ductB = c.mapped('plenum:duct', tex.duct);
  const cinderB = c.mapped('plenum:cinder', tex.cinder);
  const plankB = c.mapped('plenum:plank', tex.plank);
  const dangerB = c.mapped('plenum:danger', tex.dangerSign);
  const ceilCarpetB = c.mapped('plenum:ceil-carpet', c.kit.tex.floor(c.look));
  const paperB = c.mapped('plenum:paper', c.kit.tex.paper());
  const litPanelB = c.shining('plenum:panel', c.kit.tex.panel(true), 2.1, lin(c.look.tube));
  const portalGlowB = c.shining('plenum:portal-glow', tex.portalGlow, 2.25, WHITE);
  const crtGlowB = c.shining('plenum:crt-glow', card(c, 'plenum:crt-screen', ['DESK -1', 'GRAVITY: OFF', 'READY_'], {
    w: 96, h: 72, bg: '#071c0e', fg: '#68ff96', size: 12, pad: 8,
  }), 1.9, WHITE);

  const TBAR = lin('#b6bcc2');
  const WIRE_STEEL = lin('#212429');
  const SPRINKLER_RED = lin('#b9261d');
  const LADDER_YEL = lin('#dfa518');
  const LADDER_ALU = lin('#9fa6ae');
  const CONCRETE_RIB = lin('#505358');
  const DUCT_DARK = lin('#545a62');
  const HAZARD_YEL = lin('#dfb120');
  const uv01 = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // ---------------------------------------------------------------------------
  // 1. Baked Stratification Lighting: Dim Office Below, Crimson Plenum Above
  // ---------------------------------------------------------------------------
  // Lower office fluorescent & warm task pools (pointing downward so the plenum stays crimson)
  const lowerPanels = [
    [4.4, 4.4, 0.95],
    [-4.8, 4.6, 0.72],
    [-1.8, -5.4, 0.88],
    [4.6, -4.8, 0.72],
  ];
  for (const [lx, lz, pwr] of lowerPanels) {
    if (Math.abs(lx) > W / 2 - 1.1 || Math.abs(lz) > D / 2 - 1.1) continue;
    litPanelB.quad(
      [lx - 0.3, plan.ceilY - 0.012, lz - 0.6],
      [lx + 0.3, plan.ceilY - 0.012, lz - 0.6],
      [lx + 0.3, plan.ceilY - 0.012, lz + 0.6],
      [lx - 0.3, plan.ceilY - 0.012, lz + 0.6],
      WHITE, uv01,
    );
    c.light(lx, plan.ceilY - 0.14, lz, c.look.tube, pwr, { axis: [0, -1, 0], floor: 0.05, far: 8.2, k: 3.0 });
  }
  // Weak flickering light from the crooked dangling fluorescent troffer beside the front ladder hole
  c.light(-1.45, plan.ceilY - 0.28, 2.72, '#dbe4c6', 0.62, { flick: true, axis: [0, -1, 0], floor: 0.08, far: 5.8, k: 2.6 });
  // Small amber work-lamp above the north manual chain-hoist lever
  c.light(plan.shutter.leverX - 0.4, 2.25, plan.shutter.leverZ - 0.2, '#ffc978', 0.68, { axis: [0, -1, 0], floor: 0.1, far: 5.2, k: 2.6 });

  // Upper Return Plenum caged crimson-red emergency bulkhead lamps (`y > ceilY`)
  // Tuned so R stays richly saturated below 1.0 clip while G/B stay dark, giving deep moody crimson shadows!
  const plenumLamps = [
    [-2.15, 3.36, 2.55, '#eb220c', 1.18, 5.6, 4.5],   // spills rich crimson-orange down through front popped tile & crooked troffer!
    [-0.68, 3.84, 0.48, '#e31909', 1.15, 7.2, 5.0],   // illuminates cinderblock DANGER sign & X-creased ducts while leaving breach mouth dark!
    [3.35, 3.82, 1.00, '#df1e0b', 0.98, 5.8, 4.4],    // east HVAC return spur
    [0.45, 3.84, -3.55, '#e01b0a', 1.12, 6.8, 4.8],   // north plenum trunk beyond firewall breach
    [2.80, 3.38, -4.65, '#eb240d', 1.08, 5.4, 4.4],   // spills crimson down through north step-ladder cutout
  ];
  for (const [lx, ly, lz, hex, pwr, far, k] of plenumLamps) {
    c.light(lx, ly, lz, hex, pwr, { wrap: 0.16, far, k });
    c.model('plenum:bulkhead', plenumBulkheadVox, lx, lz, { y: ly + 0.12, rot: Math.PI / 2, scale: 0.95, solid: false, shadow: false });
  }
  // Eerie phosphor-mint glow from the upside-down Upper-Tenant Office CRT & ceiling carpet above the plenum!
  c.light(1.10, H - 0.62, 0.65, '#8ef5a2', 0.62, { wrap: 0.42, far: 6.6, k: 3.2 });
  // Deep crimson-violet abyss lamp inside the enclosed Infinite Drop-Ceiling Well!
  c.light(-1.50, 1.25, -3.30, '#ff3326', 0.96, { wrap: 0.45, far: 3.0, k: 3.6 });

  // Raw mortared cinderblock perimeter fascia lining all 4 outer walls ABOVE the drop ceiling (`y = ceilY .. H`)
  // so the upper return-air plenum never shows office wallpaper!
  cinderB.box(-W / 2, plan.ceilY, -D / 2, -W / 2 + 0.03, H, D / 2, WHITE, { uv: 0.9, step: 0.8 });
  cinderB.box(W / 2 - 0.03, plan.ceilY, -D / 2, W / 2, H, D / 2, WHITE, { uv: 0.9, step: 0.8 });
  cinderB.box(-W / 2, plan.ceilY, -D / 2, W / 2, H, -D / 2 + 0.03, WHITE, { uv: 0.9, step: 0.8 });
  cinderB.box(-W / 2, plan.ceilY, D / 2 - 0.03, W / 2, H, D / 2, WHITE, { uv: 0.9, step: 0.8 });

  // Far exit sign over the onward back doorway
  const backDoor = c.room.doors.find((d) => d.side === 'back');
  if (backDoor) c.exitSign(backDoor, 'EXIT');

  // ---------------------------------------------------------------------------
  // 2. Full-Height Cinderblock Fire-Stop Partition Wall (`z = -1.8`) & Shutter
  // ---------------------------------------------------------------------------
  const wz = plan.wallZ, wt = 0.12;
  const sh = plan.shutter;
  // Ground-to-ceiling cinderblock wall segments across z = -1.8:
  // West of rolling shutter
  cinderB.box(-W / 2, 0, wz - wt, sh.x0, H, wz + wt, WHITE, { uv: 0.9, step: 0.7 });
  c.solid(-W / 2, wz - wt, sh.x0, wz + wt, { tall: true, keep: true });

  // Above rolling shutter (`y = 2.22 .. H`) + galvanized roll-hood housing
  cinderB.box(sh.x0, 2.22, wz - wt, sh.x1, H, wz + wt, WHITE, { uv: 0.9, step: 0.7 });
  ductB.box(sh.x0 - 0.06, 2.16, wz - 0.24, sh.x1 + 0.06, 2.54, wz + 0.24, WHITE, { uv: 0.8, step: 0.6 });
  // Yellow/black safety side-jambs around the rolling shutter
  c.flat.box(sh.x0 - 0.08, 0, wz - 0.15, sh.x0, 2.22, wz + 0.15, HAZARD_YEL, { step: 0.8 });
  c.flat.box(sh.x1, 0, wz - 0.15, sh.x1 + 0.08, 2.22, wz + 0.15, HAZARD_YEL, { step: 0.8 });

  // Dynamic rolling steel shutter curtain (`shutterCol.on` toggled by north chain-hoist lever!)
  const shutterCol = c.solid(sh.x0, wz - wt, sh.x1, wz + wt, { tall: true, keep: true });
  const shutterBatch = new Batch();
  shutterBatch.box(sh.x0 + 0.02, 0.01, wz - 0.045, sh.x1 - 0.02, 2.20, wz + 0.045, WHITE, { uv: 0.9, step: 0.55 });
  const shutterGroup = c.dynamic(shutterBatch, { map: tex.shutter, pivot: [(sh.x0 + sh.x1) / 2, 2.20, wz] });

  // Between rolling shutter and center firewall breach (`x: sh.x1 .. -0.85`)
  cinderB.box(sh.x1, 0, wz - wt, -0.84, H, wz + wt, WHITE, { uv: 0.9, step: 0.7 });
  c.solid(sh.x1, wz - wt, -0.84, wz + wt, { tall: true, keep: true });

  // Center firewall section (`x: -0.84 .. +0.84`):
  // Solid cinderblock below the plenum (`y = 0 .. 2.68`) and above the crawl breach (`y = 2.68 + 0.96 .. H`),
  // leaving a dark rectangular 1.68 m x 0.96 m damper crawl breach at y = 2.68 .. 3.64!
  cinderB.box(-0.84, 0, wz - wt, 0.84, plan.deckY, wz + wt, WHITE, { uv: 0.9, step: 0.6 });
  const breachTopY = plan.deckY + 0.96;
  cinderB.box(-0.84, breachTopY, wz - wt, 0.84, H, wz + wt, WHITE, { uv: 0.9, step: 0.6 });
  // Galvanized steel angle-iron frame lining the crawl breach + unbolted damper grille propped aside!
  ductB.box(-0.86, plan.deckY, wz - 0.22, -0.74, breachTopY + 0.06, wz + 0.22, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(0.74, plan.deckY, wz - 0.22, 0.86, breachTopY + 0.06, wz + 0.22, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(-0.86, breachTopY - 0.04, wz - 0.22, 0.86, breachTopY + 0.08, wz + 0.22, WHITE, { uv: 0.7, step: 0.5 });
  // Propped unbolted louver damper grill leaning against the cinderblock wall beside the breach
  diffuserB.quad(
    [1.02, plan.deckY, wz + 0.22],
    [1.76, plan.deckY, wz + 0.26],
    [1.72, plan.deckY + 0.74, wz + 0.14],
    [0.98, plan.deckY + 0.74, wz + 0.14],
    [0.75, 0.76, 0.78], uv01,
  );

  // East of center firewall breach all the way to east wall (`x: +0.84 .. W/2`)
  cinderB.box(0.84, 0, wz - wt, W / 2, H, wz + wt, WHITE, { uv: 0.9, step: 0.7 });
  c.solid(0.84, wz - wt, W / 2, wz + wt, { tall: true, keep: true });

  // Angled cinderblock / sheet-metal bulkhead cheek on the left of the breach (holds the iconic DANGER / CAUTION placards!)
  cinderB.box(-1.55, plan.ceilY, -1.68, -0.84, H, -0.25, WHITE, { uv: 0.9, step: 0.6 });
  // Prominent OSHA `DANGER — CONFINED SPACE` + `CAUTION — WALK ON DUCTWORK ONLY` sign right on the left cheek facing the walker!
  dangerB.quad(
    [-0.825, plan.deckY + 0.18, -0.42],
    [-0.825, plan.deckY + 0.18, -1.32],
    [-0.825, plan.deckY + 1.28, -1.32],
    [-0.825, plan.deckY + 1.28, -0.42],
    WHITE, uv01,
  );
  // Second copy flat on the south face of the cinderblock firewall beside the breach so it's readable from the East Spur too
  dangerB.quad(
    [1.85, plan.deckY + 0.22, wz + wt + 0.015],
    [1.05, plan.deckY + 0.22, wz + wt + 0.015],
    [1.05, plan.deckY + 1.26, wz + wt + 0.015],
    [1.85, plan.deckY + 1.26, wz + wt + 0.015],
    WHITE, uv01,
  );

  // Manual chain-hoist release box (`[E]`) on the NORTH side of the fire-stop wall (`z = -2.28`)
  c.model('plenum:hoist', shutterHoistVox, sh.leverX, wz - wt - 0.08, { y: 1.22, rot: Math.PI, solid: false, shadow: false });
  const jamSignTex = card(c, 'plenum:jamsign:' + p.zone, [
    'FIRE SHUTTER JAMMED',
    'HOIST RELEASE ON NORTH WALL',
    `PLENUM ACCESS: BAY ${p.zone}`,
  ], { w: 196, h: 72, bg: '#f2e6c8', fg: '#1c1814', edge: '#c43124', size: 10, pad: 8 });
  c.board(c.mapped('plenum:jamsign', jamSignTex), (sh.x0 + sh.x1) / 2, 1.48, wz + wt + 0.02, 1.15, 0.44, 0);

  c.use({
    x: sh.leverX,
    z: sh.leverZ,
    r: 1.75,
    cone: 0.35,
    label: 'crank fire shutter hoist',
    when: () => !roomState.shutterOpen && (c.env.player ? c.env.player.me.y - c.room.y < 1.9 : true),
    use() {
      const res = pullShutterLever(roomState);
      roomState = res.state;
      if (res.openedNow) {
        shutterCol.on = false;
        const w = c.toWorld((sh.x0 + sh.x1) / 2, wz);
        c.env.play('clack', w.x, w.z, 12);
        c.env.play('rattle', w.x, w.z, 14);
        c.env.play('slide', w.x, w.z, 14);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Lower-Office Enclosures Under Elevated HVAC Trunks + Office Dressing
  // ---------------------------------------------------------------------------
  // Because heightfield `floorY` is 2.68 m on the three HVAC ducts, enclose their ground-floor
  // footprints as believable vertical HVAC return chases & cubicle partition banks (`y = 0 .. ceilY`)
  // so ground-floor walkers see solid walls and office furniture rather than an air step!
  const wallPaperB = c.wall;
  // Under `south-cross` (`x: -2.25 .. 4.15, z: 0.35 .. 1.65`)
  wallPaperB.box(-2.25, 0, 0.35, 4.15, plan.ceilY, 1.65, [0.88, 0.86, 0.80], { uv: 0.85, step: 0.8 });
  // Under `center-breach` (`x: -0.88 .. 0.88, z: -3.85 .. 0.35`) — central sheet-metal return air shaft
  ductB.box(-0.88, 0, -3.85, 0.88, plan.ceilY, 0.35, [0.82, 0.84, 0.86], { uv: 0.9, step: 0.75 });
  // Under `north-cross` (`x: 0.88 .. 2.15, z: -3.85 .. -2.55`) — north air-handler mechanical housing
  ductB.box(0.88, 0, -3.85, 2.15, plan.ceilY, -2.55, [0.78, 0.80, 0.83], { uv: 0.9, step: 0.75 });

  // 3b. The Enclosed "Infinite Drop-Ceiling Well" (`plan.infiniteWell`: `x: -2.12 .. -0.88, z: -3.92 .. -2.68`):
  // On the ground floor (`y = 0 .. ceilY`), walkers see a mundane wallpapered structural column.
  // Up in the plenum, looking down through its open 2x2 ceiling cutout reveals NO floor — instead, 5 receding
  // perspective-shrunk tiers of 2x2 drop-ceilings, red sprinkler pipes, crooked troffers, and tiny yellow ladders!
  const iw = plan.infiniteWell;
  const iwT = 0.04;
  wallPaperB.box(iw.x0, 0, iw.z0, iw.x1, plan.ceilY, iw.z0 + iwT, [0.86, 0.84, 0.78], { uv: 0.8, step: 0.7 });
  wallPaperB.box(iw.x0, 0, iw.z1 - iwT, iw.x1, plan.ceilY, iw.z1, [0.86, 0.84, 0.78], { uv: 0.8, step: 0.7 });
  wallPaperB.box(iw.x0, 0, iw.z0, iw.x0 + iwT, plan.ceilY, iw.z1, [0.86, 0.84, 0.78], { uv: 0.8, step: 0.7 });
  c.solid(iw.x0, iw.z0, iw.x1, iw.z1, { tall: true, keep: true });

  // Hollow interior shaft lined with dark raw cinderblock boxes & glowing non-Euclidean abyss at bottom
  const iwCx = (iw.x0 + iw.x1) * 0.5, iwCz = (iw.z0 + iw.z1) * 0.5, iwHalf = (iw.x1 - iw.x0) * 0.5 - iwT;
  cinderB.box(iw.x0 + iwT, 0.02, iw.z0 + iwT, iw.x1 - iwT, plan.ceilY, iw.z0 + iwT + 0.03, [0.32, 0.28, 0.30], { uv: 0.8, step: 0.7 });
  cinderB.box(iw.x0 + iwT, 0.02, iw.z1 - iwT - 0.03, iw.x1 - iwT, plan.ceilY, iw.z1 - iwT, [0.32, 0.28, 0.30], { uv: 0.8, step: 0.7 });
  cinderB.box(iw.x0 + iwT, 0.02, iw.z0 + iwT, iw.x0 + iwT + 0.03, plan.ceilY, iw.z1 - iwT, [0.32, 0.28, 0.30], { uv: 0.8, step: 0.7 });
  cinderB.box(iw.x1 - iwT - 0.03, 0.02, iw.z0 + iwT, iw.x1 - iwT, plan.ceilY, iw.z1 - iwT, [0.32, 0.28, 0.30], { uv: 0.8, step: 0.7 });
  portalGlowB.quad([iwCx - iwHalf, 0.04, iwCz + iwHalf], [iwCx + iwHalf, 0.04, iwCz + iwHalf], [iwCx + iwHalf, 0.04, iwCz - iwHalf], [iwCx - iwHalf, 0.04, iwCz - iwHalf], WHITE, uv01);

  const wellDepths = [2.14, 1.64, 1.16, 0.70, 0.28];
  wellDepths.forEach((wy, k) => {
    const holeR = 0.36 * Math.pow(0.82, k);
    // 4 surrounding miniature ceiling-tile strips leaving a shrinking square hole in the center
    tileBackB.quad([iwCx - iwHalf, wy, iwCz - holeR], [iwCx + iwHalf, wy, iwCz - holeR], [iwCx + iwHalf, wy, iwCz - iwHalf], [iwCx - iwHalf, wy, iwCz - iwHalf], WHITE, uv01);
    tileBackB.quad([iwCx - iwHalf, wy, iwCz + iwHalf], [iwCx + iwHalf, wy, iwCz + iwHalf], [iwCx + iwHalf, wy, iwCz + holeR], [iwCx - iwHalf, wy, iwCz + holeR], WHITE, uv01);
    tileBackB.quad([iwCx - iwHalf, wy, iwCz + holeR], [iwCx - holeR, wy, iwCz + holeR], [iwCx - holeR, wy, iwCz - holeR], [iwCx - iwHalf, wy, iwCz - holeR], WHITE, uv01);
    tileBackB.quad([iwCx + holeR, wy, iwCz + holeR], [iwCx + iwHalf, wy, iwCz + holeR], [iwCx + iwHalf, wy, iwCz - holeR], [iwCx + holeR, wy, iwCz - holeR], WHITE, uv01);
    // Miniature silver T-bar crosshairs & red sprinkler line at each recursive ceiling layer
    c.flat.box(iwCx - iwHalf, wy - 0.01, iwCz - holeR - 0.012, iwCx + iwHalf, wy + 0.012, iwCz - holeR + 0.012, TBAR);
    c.flat.box(iwCx - iwHalf, wy - 0.01, iwCz + holeR - 0.012, iwCx + iwHalf, wy + 0.012, iwCz + holeR + 0.012, TBAR);
    c.flat.box(iwCx - holeR - 0.012, wy - 0.01, iwCz - iwHalf, iwCx - holeR + 0.012, wy + 0.012, iwCz + iwHalf, TBAR);
    c.flat.box(iwCx + holeR - 0.012, wy - 0.01, iwCz - iwHalf, iwCx + holeR + 0.012, wy + 0.012, iwCz + iwHalf, TBAR);
    const pipeOff = (k % 2 ? 1 : -1) * holeR * 0.55;
    c.flat.box(iwCx - iwHalf, wy + 0.06, iwCz + pipeOff - 0.014, iwCx + iwHalf, wy + 0.09, iwCz + pipeOff + 0.014, SPRINKLER_RED);
    // Miniature glowing crooked troffer & miniature yellow step-ladder spiraling around the shaft!
    const ang = k * 1.57;
    const lx = iwCx + Math.cos(ang) * holeR * 0.62, lz = iwCz + Math.sin(ang) * holeR * 0.62;
    const ladW = 0.09 * Math.pow(0.86, k), ladH = 0.44;
    c.flat.box(lx - ladW, wy - ladH, lz - 0.014, lx - ladW + 0.022, wy + 0.08, lz + 0.014, LADDER_YEL);
    c.flat.box(lx + ladW - 0.022, wy - ladH, lz - 0.014, lx + ladW, wy + 0.08, lz + 0.014, LADDER_YEL);
    for (let r = 0; r < 4; r++) {
      const ry = wy - ladH + (r + 1) * (ladH / 4);
      c.flat.box(lx - ladW, ry, lz - 0.018, lx + ladW, ry + 0.014, lz + 0.018, LADDER_ALU);
    }
    const tx = iwCx - Math.cos(ang) * holeR * 0.55, tz = iwCz - Math.sin(ang) * holeR * 0.55, tw = 0.11 * Math.pow(0.88, k);
    litPanelB.quad([tx - tw, wy - 0.03, tz - tw * 1.6], [tx + tw, wy - 0.08, tz - tw * 1.6], [tx + tw, wy - 0.05, tz + tw * 1.6], [tx - tw, wy, tz + tw * 1.6], WHITE, uv01);
  });

  // Return-air intake louver grilles mounted on the lower vertical HVAC shaft
  for (const [gx, gz, grot] of [[0, 1.665, 0], [-0.895, -0.7, -Math.PI / 2], [0.895, -0.7, Math.PI / 2], [0, -3.865, Math.PI]]) {
    c.board(diffuserB, gx, 1.45, gz, 0.85, 0.55, grot, uv01, [0.85, 0.86, 0.88]);
  }

  // Lower-office workstations, filing cabinets, and scattered facilities clutter (strictly in clear y=0 bays)
  for (const [dx, dz, drot] of [[1.35, 2.35, 0], [3.15, 2.35, 0], [-5.2, 3.2, Math.PI / 2], [-2.2, -5.2, Math.PI]]) {
    if (Math.abs(dx) < W / 2 - 1.0 && Math.abs(dz) < D / 2 - 1.2) {
      c.prop('desk', dx, dz, { rot: drot, solid: true, fallback: [1.3, 0.74, 0.72] });
      c.prop('chair', dx + Math.sin(drot) * 0.65, dz + Math.cos(drot) * 0.65, { rot: drot + 0.4, solid: false, fallback: [0.5, 0.8, 0.5] });
    }
  }
  c.prop('cabinet', -1.65, 2.12, { rot: 0, solid: true, fallback: [0.5, 1.3, 0.6] });
  c.prop('boxes', -3.05, 0.98, { rot: 0.25, solid: false, shadow: 0.4, o: { variant: 1 } });
  c.prop('boxes', 2.75, -3.18, { rot: -0.35, solid: false, shadow: 0.4, o: { variant: 2 } });

  // Low maintenance warning cones / wet-signs under the two fragile ceiling tile bays so ground walkers steer around them naturally
  wetSign(c, -1.56, -0.30, 0.35, ['CEILING WORK', 'FALLING TILES']);
  wetSign(c, 1.56, -0.35, -0.4, ['LOOSE TILE', 'KEEP CLEAR']);
  wetSign(c, -3.88, 3.85, 0.25, ['PLENUM ACCESS', 'AUTHORIZED ONLY']);

  // Floor plan framed in the front foyer
  const planSpot = c.wallSpot(1.4, ['front', 'right']);
  if (planSpot) {
    const noticeTex = card(c, 'plenum:memo:' + p.zone, [
      `FACILITIES WORK ORDER #${p.zone}`,
      'FIRE SHUTTER CABLE JAMMED',
      'USE STEP-LADDER TO RETURN PLENUM',
    ], { w: 204, h: 76, bg: '#f4eedb', fg: '#1e1a14', edge: '#d48d1b', size: 10, pad: 8 });
    framed(c, c.mapped('plenum:memo', noticeTex), planSpot.side, planSpot.at, 1.50, 1.26, 0.48);
  }

  // ---------------------------------------------------------------------------
  // 4. Unfolded Yellow Fiberglass A-Frame Step-Ladders (Front Up + North Down)
  // ---------------------------------------------------------------------------
  function buildStepLadder(lad, dirSign) {
    // dirSign = -1 when climbing +z -> -z (frontLadder); +1 when climbing -z -> +z (northLadder)
    const cx = (lad.x0 + lad.x1) / 2;
    const zFoot = lad.zFoot, zTop = lad.zTop;
    const steps = 9;
    const halfW = 0.42;

    // Inclined fiberglass side rails (front climbing side)
    for (const sx of [-1, 1]) {
      const rx = cx + sx * halfW;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const z0 = zFoot + (zTop - zFoot) * t0, z1 = zFoot + (zTop - zFoot) * t1;
        const y0 = plan.deckY * t0, y1 = plan.deckY * t1 + 0.08;
        c.flat.box(rx - 0.032, y0, Math.min(z0, z1) - 0.035, rx + 0.032, y1, Math.max(z0, z1) + 0.035, LADDER_YEL, { step: 0.6 });
      }
      // Rear A-frame prop leg angling down behind `zTop`
      const zPropFoot = zTop + dirSign * 0.72;
      for (let i = 0; i < 6; i++) {
        const t0 = i / 6, t1 = (i + 1) / 6;
        const z0 = zTop + (zPropFoot - zTop) * t0, z1 = zTop + (zPropFoot - zTop) * t1;
        const y0 = plan.deckY * (1 - t1), y1 = plan.deckY * (1 - t0);
        c.flat.box(rx - 0.026, y0, Math.min(z0, z1) - 0.026, rx + 0.026, y1, Math.max(z0, z1) + 0.026, LADDER_YEL, { step: 0.6 });
      }
      // Horizontal silver spreader bar locking A-frame open
      const zSpreaderA = zFoot + (zTop - zFoot) * 0.48;
      const zSpreaderB = zTop + (zPropFoot - zTop) * 0.52;
      c.flat.box(rx - 0.018, 1.26, Math.min(zSpreaderA, zSpreaderB), rx + 0.018, 1.31, Math.max(zSpreaderA, zSpreaderB), LADDER_ALU, { step: 0.6 });
    }

    // Wide ribbed silver aluminum step treads + molded black top cap
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sz = zFoot + (zTop - zFoot) * t;
      const sy = plan.deckY * t;
      const isTop = i === steps;
      c.flat.box(
        cx - halfW + 0.02,
        sy - 0.035,
        sz - (isTop ? 0.14 : 0.09),
        cx + halfW - 0.02,
        sy + 0.004,
        sz + (isTop ? 0.14 : 0.09),
        isTop ? WIRE_STEEL : LADDER_ALU,
        { step: 0.5 },
      );
    }

    // Low side-rail colliders keeping walkers centered on the step-ladder treads
    const zMin = Math.min(zFoot, zTop) + 0.14, zMax = Math.max(zFoot, zTop) - 0.14;
    c.solid(lad.x0 - 0.09, zMin, lad.x0 - 0.01, zMax, { tall: false, keep: true });
    c.solid(lad.x1 + 0.01, zMin, lad.x1 + 0.09, zMax, { tall: false, keep: true });
  }

  buildStepLadder(plan.frontLadder, -1);
  buildStepLadder(plan.northLadder, 1);

  // ---------------------------------------------------------------------------
  // 5. Two-Sided 2x2 Suspended Drop-Ceiling Grid (`y = 2.64 m`) + Crooked Troffer
  // ---------------------------------------------------------------------------
  const TS = 0.60;
  const nxTiles = Math.floor(W / TS), nzTiles = Math.floor(D / TS);
  const xStart = -nxTiles * TS * 0.5, zStart = -nzTiles * TS * 0.5;

  for (let ix = 0; ix < nxTiles; ix++) {
    for (let iz = 0; iz < nzTiles; iz++) {
      const x0 = xStart + ix * TS, x1 = x0 + TS;
      const z0 = zStart + iz * TS, z1 = z0 + TS;
      const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
      // Skip fire-stop cinderblock wall band
      if (cz > wz - 0.16 && cz < wz + 0.16) continue;
      // Skip fragile shortcut bays (rendered as dynamic collapsible meshes below!)
      if (fragileTileAt(plan, 0, cx, cz) >= 0) continue;

      if (isCeilingOpenAt(plan, 0, cx, cz)) {
        // Open popped-tile bay: keep thin T-bar grid runners EXCEPT inside the physical ladder climb slots!
        const inClimbSlot =
          (cx >= plan.frontLadder.x0 - 0.15 && cx <= plan.frontLadder.x1 + 0.15 && cz >= plan.frontLadder.zTop - 0.05 && cz <= plan.frontLadder.zFoot) ||
          (cx >= plan.northLadder.x0 - 0.15 && cx <= plan.northLadder.x1 + 0.15 && cz >= plan.northLadder.zFoot && cz <= plan.northLadder.zTop + 0.05);
        if (!inClimbSlot) {
          c.flat.box(x0 - 0.016, plan.ceilY - 0.015, z0, x0 + 0.016, plan.ceilY + 0.025, z1, TBAR, { step: 0.6 });
          c.flat.box(x0, plan.ceilY - 0.015, z0 - 0.016, x1, plan.ceilY + 0.025, z0 + 0.016, TBAR, { step: 0.6 });
        }
        continue;
      }

      // Intact 2x2 ceiling tile: fissured white face below (`ny = -1`) + stamped mineral-wool back above (`ny = +1`)
      const isDiffuser = ((ix * 7 + iz * 13) % 17) === 0;
      const underBatch = isDiffuser ? diffuserB : tileUnderB;
      underBatch.quad([x1, plan.ceilY, z1], [x0, plan.ceilY, z1], [x0, plan.ceilY, z0], [x1, plan.ceilY, z0], WHITE, uv01);
      tileBackB.quad([x0, plan.ceilY + 0.026, z1], [x1, plan.ceilY + 0.026, z1], [x1, plan.ceilY + 0.026, z0], [x0, plan.ceilY + 0.026, z0], WHITE, uv01);
    }
  }

  // Iconic full-scale crooked dangling 2x4 louvered fluorescent troffer beside the front step-ladder hole!
  c.model('plenum:troffer', louverTrofferVox, -1.52, 2.66, {
    y: plan.ceilY - 0.22,
    rot: 0.22,
    tilt: [0.46, -0.36],
    scale: 1.45,
    solid: false,
    shadow: false,
  });
  // Flush neighboring 2x4 louvered troffer & taut steel wires holding the dangling troffer
  c.model('plenum:troffer', louverTrofferVox, -0.35, 3.60, {
    y: plan.ceilY - 0.02,
    rot: Math.PI / 2,
    scale: 1.40,
    solid: false,
    shadow: false,
  });
  for (const [wx, wz0, wy0] of [[-1.92, 2.28, plan.ceilY - 0.04], [-1.12, 3.04, plan.ceilY - 0.42]]) {
    c.flat.box(wx - 0.008, wy0, wz0 - 0.008, wx + 0.008, H, wz0 + 0.008, WIRE_STEEL, { step: 1.2 });
  }

  // Popped ceiling tiles propped sideways inside the plenum + broken shards on the carpet below
  for (const [px, pz, prot] of [[-3.95, 2.45, 0.3], [-1.05, 1.88, -0.4], [3.75, -4.55, 0.5]]) {
    tileBackB.box(px - 0.28, plan.ceilY + 0.03, pz - 0.28, px + 0.28, plan.ceilY + 0.07, pz + 0.28, WHITE, { uv: 0.6, step: 0.6 });
    c.model('plenum:shard', brokenTileShardVox, px + Math.sin(prot) * 0.5, pz + 0.65, { y: 0, rot: prot, solid: false, shadow: 0.25 });
  }
  scatter(c, -2.5, 4.45, 5, 0.75);

  // ---------------------------------------------------------------------------
  // 6. Upper Return Plenum: Galvanized X-Creased HVAC Trunks, Planks, Pipes & Wires
  // ---------------------------------------------------------------------------
  // Walkable galvanized HVAC trunk decks (`y = 2.64 .. 2.685`) with raised bolted side flange lips
  for (const d of plan.ducts) {
    ductB.box(d.x0, plan.ceilY + 0.02, d.z0, d.x1, plan.deckY, d.z1, WHITE, { uv: 0.65, step: 0.65 });
    // Bolted transverse flange ribs every 1.2 m (purely visual thin seam strips)
    for (let x = d.x0 + 0.6; x < d.x1 - 0.2; x += 1.2) {
      c.flat.box(x - 0.018, plan.deckY, d.z0, x + 0.018, plan.deckY + 0.012, d.z1, DUCT_DARK, { step: 0.7 });
    }
  }
  // Rough timber maintenance catwalk planks laid along the center approach & east stash spur
  plankB.box(-0.42, plan.deckY, -2.45, 0.42, plan.deckY + 0.018, 1.35, WHITE, { uv: 0.9, step: 0.7 });
  plankB.box(0.88, plan.deckY, 0.68, 3.85, plan.deckY + 0.018, 1.32, WHITE, { uv: 0.9, step: 0.7 });

  // Non-walkable bulky side HVAC branch ducts framing the crawlspace (like the right wall of Reference #2!)
  ductB.box(0.92, plan.deckY, -1.78, 2.65, plan.deckY + 1.18, -1.08, WHITE, { uv: 0.85, step: 0.7 });
  ductB.box(-5.8, plan.ceilY + 0.04, -1.45, -3.75, plan.ceilY + 0.96, -0.35, WHITE, { uv: 0.85, step: 0.7 });
  ductB.box(-3.85, plan.ceilY + 0.04, -5.2, -1.25, plan.ceilY + 0.92, -4.58, WHITE, { uv: 0.85, step: 0.7 });

  // Overhead structural concrete slab T-joist beams across `plan.joistZs`
  for (const jz of plan.joistZs) {
    c.flat.box(-W / 2 + 0.1, H - 0.34, jz - 0.16, W / 2 - 0.1, H, jz + 0.16, CONCRETE_RIB, { step: 1.0 });
  }

  // Red wet-pipe fire sprinkler main & branch lines running above the ceiling grid (and across open holes!)
  c.flat.box(-W / 2 + 0.3, plan.ceilY + 0.24, 2.52, W / 2 - 0.3, plan.ceilY + 0.31, 2.59, SPRINKLER_RED, { step: 1.1 });
  c.flat.box(-2.22, plan.ceilY + 0.22, -5.8, -2.15, plan.ceilY + 0.29, 3.6, SPRINKLER_RED, { step: 1.1 });
  c.flat.box(-W / 2 + 0.3, plan.ceilY + 0.25, -4.35, W / 2 - 0.3, plan.ceilY + 0.32, -4.28, SPRINKLER_RED, { step: 1.1 });

  // Forest of taut vertical steel T-bar suspension hanger wires + Escher 90°-bent dogleg wires!
  let wireIdx = 0;
  for (let wx = -W / 2 + 1.2; wx <= W / 2 - 1.2; wx += 1.8) {
    for (let wz2 = -D / 2 + 1.2; wz2 <= D / 2 - 1.2; wz2 += 1.8) {
      if (Math.abs(wz2 - wz) < 0.35) continue;
      if (plenumFloorY(plan, 0, wx, wz2) > 0.02) continue;
      if (isCeilingOpenAt(plan, 0, wx, wz2, -0.1)) continue;
      wireIdx++;
      if (wireIdx % 4 === 0 && wx + 0.65 < W / 2 - 0.5 && plenumFloorY(plan, 0, wx + 0.65, wz2) <= 0.02) {
        // Physics-defying orthogonal Escher hanger wire: drops partway, turns 90° unsupported in mid-air, then drops again!
        const bendY = plan.ceilY + 0.85 + (wireIdx % 3) * 0.28;
        c.flat.box(wx - 0.008, plan.ceilY + 0.02, wz2 - 0.008, wx + 0.008, bendY, wz2 + 0.008, WIRE_STEEL, { step: 1.0 });
        c.flat.box(wx - 0.008, bendY - 0.008, wz2 - 0.008, wx + 0.66, bendY + 0.008, wz2 + 0.008, WIRE_STEEL, { step: 0.8 });
        c.flat.box(wx + 0.65 - 0.008, bendY, wz2 - 0.008, wx + 0.65 + 0.008, H, wz2 + 0.008, WIRE_STEEL, { step: 1.0 });
      } else {
        c.flat.box(wx - 0.007, plan.ceilY + 0.02, wz2 - 0.007, wx + 0.007, H, wz2 + 0.007, WIRE_STEEL, { step: 1.4 });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6b. Surreal Backrooms Anomalies: Inverted Ceiling Office, Floating Tiles,
  //     Self-Swallowing Ouroboros Duct & Non-Euclidean Space-Folding Duct Portal!
  // ---------------------------------------------------------------------------
  // A) Inverted "Upper-Tenant" Office Carpet & Furniture bolted upside-down to `y = H` (`z > wallZ`)!
  const southSpanD = D / 2 - (wz + 0.14) - 0.06;
  const southMidZ = (wz + 0.14 + D / 2) * 0.5;
  c.lay(
    ceilCarpetB,
    0,
    southMidZ,
    W - 0.08,
    southSpanD,
    0,
    [[0, 0], [(W - 0.08) / 1.6, 0], [(W - 0.08) / 1.6, southSpanD / 1.6], [0, southSpanD / 1.6]],
    [0.85, 0.92, 0.84],
    H - 0.014,
    true,
  );
  // Upside-down desks, swivel chairs, glowing green CRT terminal, cabinets & tall ferns hanging from ceiling carpet!
  c.prop('desk', 1.45, 0.10, { flip: true, y: H - 0.02, rot: 0.28, solid: false, shadow: false, fallback: [1.3, 0.74, 0.72] });
  c.prop('chair', 1.55, 0.82, { flip: true, y: H - 0.02, rot: 3.35, solid: false, shadow: false, o: { color: '#b5483f' }, fallback: [0.5, 0.8, 0.5] });
  c.prop('crt', 1.42, 0.05, { flip: true, y: H - 0.76, rot: 0.28, solid: false, shadow: false, fallback: [0.42, 0.38, 0.42] });
  c.board(crtGlowB, 1.36, H - 0.96, 0.26, 0.30, 0.22, Math.PI + 0.28);

  c.prop('chair', -1.22, 1.92, { flip: true, y: H - 0.02, rot: -0.65, solid: false, shadow: false, o: { color: '#3f7f9a' }, fallback: [0.5, 0.8, 0.5] });
  c.prop('desk', -3.65, 2.25, { flip: true, y: H - 0.02, rot: 1.57, solid: false, shadow: false, fallback: [1.3, 0.74, 0.72] });
  c.prop('cabinet', 2.85, 2.28, { flip: true, y: H - 0.02, rot: -0.45, solid: false, shadow: false, fallback: [0.5, 1.3, 0.6] });
  c.prop('planttall', -3.55, 0.95, { flip: true, y: H + 0.06, rot: 1.1, solid: false, shadow: false, fallback: [0.4, 1.1, 0.4] });
  c.prop('plant', 0.35, 2.35, { flip: true, y: H + 0.04, rot: 2.2, solid: false, shadow: false, fallback: [0.35, 0.55, 0.35] });

  // Upside-down unfolded yellow A-frame step-ladder descending UPWARD from the ceiling carpet (`y = H` down to `H - 1.42`)!
  {
    const uCx = 0.65, uFoot = 3.05, uTop = 1.95, uDrop = 1.42, uSteps = 6, uHalfW = 0.36;
    for (const sx of [-1, 1]) {
      const rx = uCx + sx * uHalfW;
      for (let i = 0; i < uSteps; i++) {
        const t0 = i / uSteps, t1 = (i + 1) / uSteps;
        const z0 = uFoot + (uTop - uFoot) * t0, z1 = uFoot + (uTop - uFoot) * t1;
        const y1 = H - uDrop * t0, y0 = H - uDrop * t1 - 0.05;
        c.flat.box(rx - 0.028, y0, Math.min(z0, z1) - 0.03, rx + 0.028, y1, Math.max(z0, z1) + 0.03, LADDER_YEL);
      }
      const zProp = uTop - 0.52;
      for (let i = 0; i < 4; i++) {
        const t0 = i / 4, t1 = (i + 1) / 4;
        const z0 = uTop + (zProp - uTop) * t0, z1 = uTop + (zProp - uTop) * t1;
        const y0 = H - uDrop * (1 - t0), y1 = H - uDrop * (1 - t1);
        c.flat.box(rx - 0.022, Math.min(y0, y1), Math.min(z0, z1) - 0.022, rx + 0.022, Math.max(y0, y1), Math.max(z0, z1) + 0.022, LADDER_YEL);
      }
    }
    for (let i = 1; i <= uSteps; i++) {
      const t = i / uSteps, sz = uFoot + (uTop - uFoot) * t, sy = H - uDrop * t;
      c.flat.box(uCx - uHalfW + 0.02, sy - 0.015, sz - 0.075, uCx + uHalfW - 0.02, sy + 0.018, sz + 0.075, i === uSteps ? WIRE_STEEL : LADDER_ALU);
    }
  }

  // B) Zero-Gravity Constellation of Levitating Ceiling Tiles, Floating Troffer & Upward-Pouring Coffee Mugs!
  const floatBatchA = new Batch(true);
  const floatBatchB = new Batch(true);
  const fTileGeo = c.kit.model('plenum:float-tile', floatingTileVox);
  const fMugGeo = c.kit.model('plenum:antigrav-mug', antiGravMugVox);
  const fTrofGeo = c.kit.model('plenum:troffer-f', louverTrofferVox);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
    const putVox = (batch, geo, x, y, z, rx, ry, rz, s) => {
      e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); sc.set(s, s, s);
      m4.compose(v3.set(x, y, z), q, sc);
      batch.addVox(geo.solid, m4);
    };
    // Group A: hovering above the front ladder bay, over the fragile tiles, and beside the breach (keeping signs clear!)
    putVox(floatBatchA, fTileGeo, -2.55, 3.38, 2.35, 0.34, 0.45, -0.26, 0.038);
    putVox(floatBatchA, fTileGeo, -1.65, 3.62, -0.15, -0.28, 0.85, 0.32, 0.038);
    putVox(floatBatchA, fTileGeo, 0.92, 3.52, -0.45, 0.42, -0.35, -0.22, 0.038);
    putVox(floatBatchA, fTileGeo, -1.62, 3.72, -4.35, -0.32, 0.55, 0.28, 0.038);
    putVox(floatBatchA, fMugGeo, 0.38, 3.42, -0.55, 0.08, 0.6, -0.06, 0.030);
    // Group B: secondary counter-phase levitating tiles + floating louvered troffer in mid-air!
    putVox(floatBatchB, fTileGeo, -1.85, 3.74, 2.75, -0.38, -0.6, 0.25, 0.038);
    putVox(floatBatchB, fTileGeo, 2.25, 3.68, 2.05, 0.29, 1.1, -0.34, 0.038);
    putVox(floatBatchB, fTileGeo, 1.55, 3.64, -4.15, -0.24, -0.75, 0.31, 0.038);
    putVox(floatBatchB, fTrofGeo, -1.95, 3.78, 0.15, 0.35, 0.52, -0.28, 0.036);
    putVox(floatBatchB, fMugGeo, -0.38, 3.48, -2.95, -0.08, -0.8, 0.10, 0.030);
  }
  const floatGroupA = c.dynamic(floatBatchA, { pivot: [0, 3.55, 0] });
  const floatGroupB = c.dynamic(floatBatchB, { pivot: [0, 3.65, 0] });

  // Frozen mid-air drifting memo sheets caught in the plenum updraft
  for (const [px, py, pz, rx, rz] of [[-0.25, 3.32, -0.15, 0.4, -0.3], [0.55, 3.58, 0.65, -0.3, 0.5], [-1.35, 3.12, -3.15, 0.5, 0.2]]) {
    paperB.quad([px - 0.11, py, pz - 0.14], [px + 0.11, py + rx * 0.12, pz - 0.14], [px + 0.11, py + (rx + rz) * 0.12, pz + 0.14], [px - 0.11, py + rz * 0.12, pz + 0.14], WHITE, uv01);
    paperB.quad([px + 0.11, py + rx * 0.12, pz - 0.14], [px - 0.11, py, pz - 0.14], [px - 0.11, py + rz * 0.12, pz + 0.14], [px + 0.11, py + (rx + rz) * 0.12, pz + 0.14], WHITE, uv01);
  }

  // C) Self-Swallowing "Ouroboros" Closed-Loop HVAC Duct (`x = 2.10 .. 3.22, z = -0.82 .. -0.26`)
  ductB.box(2.10, 2.86, -0.80, 3.22, 3.20, -0.30, WHITE, { uv: 0.75, step: 0.6 });   // bottom horizontal leg
  ductB.box(2.10, 3.74, -0.80, 3.22, 4.08, -0.30, WHITE, { uv: 0.75, step: 0.6 });   // top horizontal leg
  ductB.box(2.10, 3.20, -0.80, 2.44, 3.74, -0.30, WHITE, { uv: 0.75, step: 0.6 });   // west vertical leg
  ductB.box(2.88, 3.20, -0.80, 3.22, 3.74, -0.30, WHITE, { uv: 0.75, step: 0.6 });   // east vertical leg (swallowing itself!)
  const loopTagTex = card(c, 'plenum:looptag', ['CLOSED-LOOP DUCT', '100% RECIRCULATED SINCE 1983', 'DO NOT OPEN · AIR IS OLD'], {
    w: 184, h: 58, bg: '#e8c44a', fg: '#181510', edge: '#221e18', size: 9, pad: 6,
  });
  c.board(c.mapped('plenum:looptag', loopTagTex), 2.66, 3.04, -0.285, 0.76, 0.24, 0);

  // D) Non-Euclidean Wraparound Duct Portals (`East Spur x=4.15 <-> North-West Trunk x=-0.88`)
  // Mouth A on East Spur (`facing -x`, entered walking East `+x` into `x >= 3.78`):
  ductB.box(3.80, plan.deckY, 0.44, 4.26, plan.deckY + 1.16, 0.56, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(3.80, plan.deckY, 1.44, 4.26, plan.deckY + 1.16, 1.56, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(3.80, plan.deckY + 1.04, 0.44, 4.26, plan.deckY + 1.18, 1.56, WHITE, { uv: 0.7, step: 0.5 });
  portalGlowB.quad(
    [4.18, plan.deckY + 0.02, 0.56],
    [4.18, plan.deckY + 0.02, 1.44],
    [4.18, plan.deckY + 1.04, 1.44],
    [4.18, plan.deckY + 1.04, 0.56],
    WHITE, uv01,
  );
  const foldATex = card(c, 'plenum:foldA', ['DUCT FOLD A -> NORTH BAY', 'DISTANCE: -0.0 METERS'], {
    w: 176, h: 48, bg: '#1d1522', fg: '#f5b942', edge: '#d4512c', size: 10, pad: 6,
  });
  c.board(c.mapped('plenum:foldA', foldATex), 3.79, plan.deckY + 1.11, 1.00, 0.78, 0.21, -Math.PI / 2);

  // Mouth B emerging from mid-air on the west side of the North Plenum (`x = -0.88, z = -2.40`):
  ductB.box(-1.26, plan.deckY, -2.92, -0.84, plan.deckY + 1.16, -2.80, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(-1.26, plan.deckY, -2.00, -0.84, plan.deckY + 1.16, -1.88, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(-1.26, plan.deckY + 1.04, -2.92, -0.84, plan.deckY + 1.18, -1.88, WHITE, { uv: 0.7, step: 0.5 });
  ductB.box(-1.28, plan.deckY - 0.04, -2.92, -0.84, plan.deckY + 0.02, -1.88, WHITE, { uv: 0.7, step: 0.5 });
  portalGlowB.quad(
    [-1.18, plan.deckY + 0.02, -2.00],
    [-1.18, plan.deckY + 0.02, -2.80],
    [-1.18, plan.deckY + 1.04, -2.80],
    [-1.18, plan.deckY + 1.04, -2.00],
    WHITE, uv01,
  );
  const foldBTex = card(c, 'plenum:foldB', ['DUCT FOLD B <- EAST WALL', 'DISTANCE: -0.0 METERS'], {
    w: 176, h: 48, bg: '#1d1522', fg: '#f5b942', edge: '#d4512c', size: 10, pad: 6,
  });
  c.board(c.mapped('plenum:foldB', foldBTex), -0.83, plan.deckY + 1.11, -2.40, 0.78, 0.21, Math.PI / 2);

  // East Stash Spur Facilities cache: tool crate + guaranteed spare battery pack on the elevated duct!
  c.crate(3.18, 1.42, 0.38, 0.26, 0.32, -0.2, lin('#b5382a'), { y: plan.deckY, solid: false, shadow: false });
  c.leave('battery', 2.88, 0.98, { y: plan.deckY + 0.02 });

  // ---------------------------------------------------------------------------
  // 7. Dynamic Fragile Water-Stained Acoustic Tile Shortcuts (`fragileTiles[0..1]`)
  // ---------------------------------------------------------------------------
  const fragileHolders = [];
  const fallenHolders = [];

  for (const ft of plan.fragileTiles) {
    const fBatch = new Batch();
    const mx = (ft.x0 + ft.x1) * 0.5, mz = (ft.z0 + ft.z1) * 0.5;
    const sagY = plan.deckY - 0.045;
    // Slightly bowed 4-triangle fan on top & bottom so it visibly sags under water damage!
    const c00 = [ft.x0, plan.deckY - 0.01, ft.z0], c10 = [ft.x1, plan.deckY - 0.01, ft.z0];
    const c11 = [ft.x1, plan.deckY - 0.01, ft.z1], c01 = [ft.x0, plan.deckY - 0.01, ft.z1];
    const cm = [mx, sagY, mz];
    fBatch.tri(c01, c11, cm, WHITE);
    fBatch.tri(c11, c10, cm, WHITE);
    fBatch.tri(c10, c00, cm, WHITE);
    fBatch.tri(c00, c01, cm, WHITE);
    // Water-stained underside visible from the office floor below
    const u00 = [ft.x0, plan.ceilY, ft.z0], u10 = [ft.x1, plan.ceilY, ft.z0];
    const u11 = [ft.x1, plan.ceilY, ft.z1], u01 = [ft.x0, plan.ceilY, ft.z1];
    const um = [mx, plan.ceilY - 0.04, mz];
    fBatch.tri(u11, u01, um, [0.76, 0.68, 0.55]);
    fBatch.tri(u10, u11, um, [0.76, 0.68, 0.55]);
    fBatch.tri(u00, u10, um, [0.76, 0.68, 0.55]);
    fBatch.tri(u01, u00, um, [0.76, 0.68, 0.55]);
    const holder = c.dynamic(fBatch, { map: tex.tileFragile, pivot: [mx, plan.deckY, mz] });
    fragileHolders.push(holder);

    // Fallen tile debris revealed on the carpet (`y = 0`) once this fragile tile bursts!
    const dBatch = new Batch(true);
    const shardGeo = c.kit.model('plenum:shard', brokenTileShardVox);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(0.08, 0.08, 0.08);
    for (const [ox, oz, yaw] of [[-0.22, -0.18, 0.4], [0.24, 0.16, 2.1], [-0.08, 0.25, -1.1]]) {
      e.set(0, yaw, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(v3.set(mx + ox, 0.01, mz + oz), q, sc);
      dBatch.addVox(shardGeo.solid, m4);
    }
    const fallen = c.dynamic(dBatch, { pivot: [mx, 0, mz] });
    fallen.visible = false;
    fallenHolders.push(fallen);
  }

  // ---------------------------------------------------------------------------
  // 8. Two Prowling Plenum Toners (Slab Ambush + Erratic Weave + Scissors Snip!)
  // ---------------------------------------------------------------------------
  const tonerSpawns = [
    { key: 'south', lx: 2.25, lz: 1.00, patrolA: [1.25, 1.00], patrolB: [3.05, 1.00] },
    { key: 'north', lx: 0.15, lz: -3.20, patrolA: [-0.35, -3.20], patrolB: [1.95, -3.20] },
  ];

  let crashPulseSec = 0;
  let known = false;

  for (let i = 0; i < tonerSpawns.length; i++) {
    const sp = tonerSpawns[i];
    const startW = c.toWorld(sp.lx, sp.lz);
    const rig = makePlenumTonerRig(c.kit, sp.key);
    let tState = createPlenumTonerState(i);
    let toB = true;

    const denizen = c.env.denizens?.add({
      id: 'plenum-toner',
      x: startW.x,
      z: startW.z,
      y: c.room.y + H - 0.14,
      r: 0.21,
      tall: 0.72,
      heading: 0,
      group: rig.group,
      light: () => {
        const sampleY = Math.max(plan.deckY + 0.35, (denizen.y ?? c.room.y + 3.2) - c.room.y);
        rig.light(c.world.lightAt(denizen.x, denizen.z, sampleY));
      },
      snipTarget: () => (
        tState.phase === 'dropping' || tState.phase === 'chasing'
          ? { id: 'plenum-toner', y: (denizen.y ?? c.room.y + plan.deckY) + 0.24, r: 0.38, priority: 3 }
          : false
      ),
      snip() {
        if (tState.phase !== 'dropping' && tState.phase !== 'chasing') return false;
        tState = snipPlenumToner(tState);
        c.env.play('clack', denizen.x, denizen.z, 9);
        c.env.play('sonarrattle', denizen.x, denizen.z, 10);
        c.env.interfere(0.42);
        c.survived('plenum-toner');
        return { ok: true, target: 'plenum-toner' };
      },
      update(dt, time, me) {
        const inRoom = c.world.current() === c.rt;
        const playerRelY = me.y - c.room.y;
        const onPlenum = inRoom && playerRelY >= plan.deckY - 0.35;
        const quiet = me.sink > 0.30 || !me.moving;
        const audible = onPlenum && me.moving && me.speed > 0.45 && !quiet;
        const dist = Math.hypot(me.x - denizen.x, me.z - denizen.z);
        const loc = c.toLocal(denizen.x, denizen.z);
        const fleeingFire = !!c.fire(loc.x, loc.z);
        const clearLine = onPlenum && Math.abs(loc.z - c.toLocal(me.x, me.z).z) < 3.6;

        if (!known && onPlenum && dist < 7.5 && c.env.sees(denizen.x, denizen.z, { radius: 0.45 })) {
          known = true;
          c.met('plenum-toner');
        }

        const res = stepPlenumToner(tState, {
          dt,
          dist,
          onPlenum,
          audible,
          quiet,
          loudCrash: crashPulseSec > 0,
          clearLine,
          fleeingFire,
        });
        tState = res.state;

        if (res.sonar) c.env.play('sonar', denizen.x, denizen.z, 12);
        if (res.rattle) c.env.play('sonarrattle', denizen.x, denizen.z, 13);
        if (res.droppedNow) {
          c.env.play('thunk', denizen.x, denizen.z, 10);
          if (inRoom) c.env.interfere(0.32);
        }

        // Smoothly interpolate height between galvanized HVAC deck (`deckY`) and concrete slab (`H - 0.14`)
        const slabY = c.room.y + H - 0.14;
        const deckWorldY = c.room.y + plan.deckY;
        denizen.y = deckWorldY + (slabY - deckWorldY) * res.slabK;

        let went = 0;
        let bank = 0;
        if (tState.phase === 'chasing' && res.speed > 0) {
          const dx = me.x - denizen.x, dz = me.z - denizen.z, d = Math.hypot(dx, dz) || 1;
          const perpX = -dz / d, perpZ = dx / d;
          const weave = plenumWeaveOffset(tState.weavePhase, res.speed);
          bank = clamp(weave / PLENUM.weaveAmp, -1, 1);
          const gx = me.x + perpX * weave, gz = me.z + perpZ * weave;

          // Keep Plenum Toners up on the elevated plenum ducts (never walking down the ladders)
          const prevX = denizen.x, prevZ = denizen.z;
          went = stepWalker(c.world, denizen, gx, gz, res.speed * dt);
          const afterLoc = c.toLocal(denizen.x, denizen.z);
          if (plenumFloorY(plan, roomState.brokenMask, afterLoc.x, afterLoc.z) < plan.deckY - 0.05) {
            denizen.x = prevX;
            denizen.z = prevZ;
            went = 0;
          }
          const wantYaw = Math.atan2(gx - denizen.x, gz - denizen.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 10, dt * 10);
          if (dist < 2.5 && onPlenum) c.env.interfere(clamp((2.5 - dist) * 0.22, 0, 0.55));
        } else if (tState.phase === 'perched') {
          // Slow upside-down creep along concrete slab between patrol anchors
          const goalLoc = toB ? sp.patrolB : sp.patrolA;
          const goalW = c.toWorld(goalLoc[0], goalLoc[1]);
          if (Math.hypot(goalW.x - denizen.x, goalW.z - denizen.z) < 0.25) toB = !toB;
          const step = 0.28 * dt;
          const dx = goalW.x - denizen.x, dz = goalW.z - denizen.z, d = Math.hypot(dx, dz) || 1;
          denizen.x += (dx / d) * Math.min(d, step);
          denizen.z += (dz / d) * Math.min(d, step);
          went = Math.min(d, step);
          const wantYaw = Math.atan2(dx, dz);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 3.5, dt * 3.5);
        }

        rig.pose(time, tState.phase, res.slabK, went / Math.max(dt, 1e-3), bank);

        if (res.caught) {
          c.env.play('sonarrattle', denizen.x, denizen.z, 9);
          c.env.play('dissolve', denizen.x, denizen.z, 8);
          c.env.interfere(0.95);
          if (!known) { known = true; c.met('plenum-toner'); }
          const hit = c.hurt(PLENUM.hurt);
          if (!hit.ended) {
            tState = releasePlenumToner(tState);
            if (hit.landed) {
              c.env.hud?.glitch(0.65);
              c.survived('plenum-toner');
            }
          }
        }
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Per-Frame Plenum Tick: Fragile Tiles, Shutter Lift, & Sheet-Metal Steps
  // ---------------------------------------------------------------------------
  let lastStep = null;

  c.tick((dt, time, me) => {
    crashPulseSec = Math.max(0, crashPulseSec - dt);
    const meW = c.toWorld(me.x, me.z);
    const playerRelY = me.world.y - c.room.y;
    const onPlenum = me.inside && playerRelY >= plan.deckY - 0.25 && me.world.drop < 0.25;

    // Resonant sheet-metal footstep clanks when walking upright on galvanized HVAC ducts!
    if (me.inside && lastStep !== me.world.step) {
      lastStep = me.world.step;
      if (onPlenum && fragileTileAt(plan, roomState.brokenMask, me.x, me.z) < 0) {
        if (me.world.sink > 0.30) {
          c.env.play('tick', meW.x, meW.z, 4);
        } else {
          c.env.play('clack', meW.x, meW.z, 10);
        }
      }
    }

    const stepRes = stepPlenumRoom(roomState, plan, { dt, x: me.x, z: me.z, onPlenum });
    roomState = stepRes.state;

    if (stepRes.creakedTile >= 0) {
      c.env.play('creak', meW.x, meW.z, 8);
      c.env.play('rustle', meW.x, meW.z, 7);
    }

    // Visual tremble while standing on a creaking water-stained acoustic tile
    if (roomState.activeTile >= 0 && fragileHolders[roomState.activeTile]) {
      const fh = fragileHolders[roomState.activeTile];
      const ft = plan.fragileTiles[roomState.activeTile];
      fh.position.y = plan.deckY - roomState.dwellSec * 0.14 + Math.sin(time * 48) * 0.008;
      fh.rotation.z = Math.sin(time * 38) * 0.025;
      fh.position.x = (ft.x0 + ft.x1) * 0.5;
    }

    if (stepRes.collapsedTile >= 0) {
      const idx = stepRes.collapsedTile;
      if (fragileHolders[idx]) fragileHolders[idx].visible = false;
      if (fallenHolders[idx]) fallenHolders[idx].visible = true;
      // Drop smoothly under native gravity onto the lower office carpet (`y = 0`) — atmospheric setback, 0 damage!
      me.world.drop = Math.max(me.world.drop, plan.deckY);
      me.world.dropV = -0.35;
      crashPulseSec = 1.2;
      c.env.play('crack', meW.x, meW.z, 13);
      c.env.play('thunk', meW.x, meW.z, 12);
      c.env.interfere(0.52);
    }

    // Non-Euclidean wraparound duct fold: stepping into East Mouth A emerges from North-West Mouth B (and vice versa)!
    if (stepRes.warpedTo && c.env.player) {
      const wExit = c.toWorld(stepRes.warpedTo.x, stepRes.warpedTo.z);
      const wAhead = c.toWorld(stepRes.warpedTo.x + stepRes.warpedTo.dirX, stepRes.warpedTo.z + stepRes.warpedTo.dirZ);
      const exitYaw = Math.atan2(-(wAhead.x - wExit.x), -(wAhead.z - wExit.z));
      c.env.player.warp(wExit.x, wExit.z, exitYaw);
      c.env.play('slide', wExit.x, wExit.z, 8);
      c.env.play('rattle', wExit.x, wExit.z, 6);
      c.env.interfere(0.46);
      c.env.hud?.glitch?.(0.28);
    }

    // Zero-gravity bobbing & gentle tilt of the levitating ceiling tiles, floating troffer, and upward-pouring mugs
    floatGroupA.position.y = 3.55 + Math.sin(time * 1.35) * 0.085;
    floatGroupA.rotation.z = Math.sin(time * 0.82) * 0.028;
    floatGroupA.rotation.x = Math.cos(time * 0.67) * 0.022;
    floatGroupB.position.y = 3.65 + Math.cos(time * 1.18 + 1.1) * 0.095;
    floatGroupB.rotation.z = Math.cos(time * 0.74 + 0.5) * 0.032;

    // Animate the jammed steel fire shutter rolling smoothly upward into its header hood once cranked
    shutterGroup.scale.y = Math.max(0.04, 1 - roomState.shutterLift * 0.92);
  });
}
