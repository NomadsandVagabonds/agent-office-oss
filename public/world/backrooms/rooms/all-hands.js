// Set Piece 2: Mandatory All-Hands (`all-hands`)
// A cavernous, damp, sunken Backrooms bunker lined in stained yellow wallpaper
// where 70 drab grey folding chairs face the blinding white glare of a 4:3
// overhead projector. Twenty-six motionless colleagues sit in silence in the
// dark rows. When Q&A begins, every seated figure's head snaps 180° backwards
// to watch you walk down the aisle toward the lone standing microphone while the
// towering Keynote Speaker advances during projector shutter blackouts.
import { Batch, lin, drawText, WHITE } from '../kit.js';
import { P, clamp, card } from '../bits.js';
import { roomBody, moveRoomWalker, roomContact, roomReturn } from '../room-physics.js';
import {
  ALL_HANDS, QA_SLIDE, ADJOURNED_SLIDE,
  auditoriumFloorY, createAllHandsState, stepAllHands,
} from './all-hands/rule.js';
import {
  makeKeynoteSpeaker, buildAudienceKit, auditoriumSeatVox, lecternVox, qaMicVox,
} from './all-hands/rig.js';

const PUTTY_DARK = [0.22, 0.21, 0.19];
const CONCRETE_STAGE = [0.28, 0.27, 0.24];
const AISLE_STAIN = [0.20, 0.19, 0.16];
const RAIL_IRON = [0.24, 0.25, 0.24];
const CORD_BLACK = [0.05, 0.05, 0.06];

function drawKeynoteSlide(g, w, h, slide, p, blackout) {
  if (blackout) {
    P(g, '#020203', 0, 0, w, h);
    return;
  }

  // Vignetted dirty overhead-projector burn border
  if (slide === 0) {
    P(g, '#cfd4be', 0, 0, w, h);
    P(g, '#1e201b', 0, 0, w, 20);
    drawText(g, ['ATTENDANCE LOG · SLIDE 01 / 412'], 8, 4, w - 16, 13, { color: '#d8dcc8', size: 8 });
    drawText(g, [p.project, 'REMAIN IN YOUR SEAT', 'DO NOT TURN AROUND'], 16, 36, w - 32, 74, {
      color: '#191a16', size: 13, leading: 1.3,
    });
    drawText(g, [`ROLL CALL: ${p.owner} ... PRESENT`], 12, h - 20, w - 24, 12, { color: '#47493f', size: 8 });
  } else if (slide === 1) {
    P(g, '#c8ccb6', 0, 0, w, h);
    P(g, '#1e201b', 0, 0, w, 20);
    drawText(g, ['HEADCOUNT RECONCILIATION'], 8, 4, w - 16, 13, { color: '#d8dcc8', size: 8 });
    // Monochrome attrition bars + deep crimson Q4 plunge off the bottom of the slide
    P(g, '#22241e', 30, 96, w - 60, 2);
    const bars = [
      ['Q1', 50, 44, '#363932'],
      ['Q2', 98, 30, '#363932'],
      ['Q3', 146, 14, '#363932'],
    ];
    for (const [lbl, bx, bh, col] of bars) {
      P(g, col, bx, 96 - bh, 24, bh);
      drawText(g, [lbl], bx - 2, 101, 28, 10, { color: '#22241e', size: 8 });
    }
    P(g, '#8e1b18', 194, 98, 24, 46); // plunges straight off the bottom edge!
    drawText(g, [`UNACCOUNTED: 01 (${p.visitor})`], 14, 26, w - 28, 16, { color: '#7a1614', size: 10 });
  } else if (slide === 2) {
    P(g, '#c2c7b0', 0, 0, w, h);
    P(g, '#6e1715', 0, 0, w, 20);
    drawText(g, ['OPEN ACTION ITEM'], 8, 4, w - 16, 13, { color: '#f0e8dc', size: 8 });
    drawText(g, [p.blocker, `ASSIGNED TO: ${p.visitor}`, 'STATUS: STANDING BEHIND US'], 14, 38, w - 28, 76, {
      color: '#181915', size: 11, leading: 1.35,
    });
  } else if (slide === QA_SLIDE) {
    P(g, '#120405', 0, 0, w, h);
    P(g, '#8a1616', 0, 0, w, 22);
    P(g, '#8a1616', 0, h - 14, w, 14);
    drawText(g, ['FLOOR MICROPHONE LIVE'], 8, 5, w - 16, 13, { color: '#f2ded8', size: 9 });
    drawText(g, [`WE HEAR YOU, ${p.visitor}.`, '', 'ANY QUESTIONS?'], 12, 32, w - 24, 90, {
      color: '#f0dad4', size: 12, leading: 1.25,
    });
  } else if (slide === ADJOURNED_SLIDE) {
    // Dead VHS snow static after adjournment
    P(g, '#0a0b0c', 0, 0, w, h);
    let s = 31337;
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 4) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const v = 18 + ((s >>> 24) & 75);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, 4, 2);
      }
    }
    drawText(g, ['NO SIGNAL', 'MEETING ADJOURNED'], 16, 48, w - 32, 48, {
      color: '#9aa09a', size: 12, leading: 1.35,
    });
  }

  // Heavy burned scanlines & dirty projector corner falloff
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.strokeStyle = 'rgba(10,10,8,0.55)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, w, h);
}

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  const sideX = W / 2 - 2.25;
  const zTop = D / 2 - 3.2;
  const stageZ = -D / 2 + 5.2;
  const pitZ = stageZ + 1.8;

  // Shell builds stained Backrooms wallpaper & dark ceiling; we sculpt the sunken Backrooms slope
  c.shell({ floor: false, skirting: false });
  c.rt.floorY = (x, z) => auditoriumFloorY(x, z, W, D);
  c.rt.headY = (x, z) => H - auditoriumFloorY(x, z, W, D);

  const floorB = c.floor;
  const addCarpetRect = (x0, z0, x1, z1, y, alb = [0.76, 0.74, 0.66]) => {
    const uv = [[x0 / 1.6, z1 / 1.6], [x1 / 1.6, z1 / 1.6], [x1 / 1.6, z0 / 1.6], [x0 / 1.6, z0 / 1.6]];
    floorB.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], alb, uv);
  };

  // Missing broken ceiling tiles & damp brown leak stains so the ceiling reads unmistakably Backrooms
  for (const [hx, hz] of [[-4.2, -2.5], [3.8, 1.2], [0.0, stageZ - 1.8], [-2.8, zTop + 0.8]]) {
    c.hole(hx, hz, 2);
    c.blot(hx, hz, 2.8, 2.4, { rgb: [0.12, 0.08, 0.03], a: 0.55, y: H - 0.006, down: true });
  }

  // 1. Upper Concourse (`z >= zTop`) & Side Walkways (`|x| >= sideX, z >= -1.2`) at y = 0
  addCarpetRect(-W / 2, zTop, W / 2, D / 2, 0);
  addCarpetRect(-W / 2, -1.2, -sideX, zTop, 0);
  addCarpetRect(sideX, -1.2, W / 2, zTop, 0);

  // Extend genuine yellow Backrooms wallpaper (`c.wall`) all the way down into the sunken pit (-1.25m)!
  c.wall.box(-W / 2 - 0.02, -1.28, -D / 2 - 0.02, W / 2 + 0.02, 0.04, -D / 2 + 0.04, [0.78, 0.75, 0.66], { uv: 0.8, step: 6 });
  c.wall.box(-W / 2 - 0.02, -1.28, -D / 2, -W / 2 + 0.04, 0.04, 0.2, [0.78, 0.75, 0.66], { uv: 0.8, step: 6 });
  c.wall.box(W / 2 - 0.04, -1.28, -D / 2, W / 2 + 0.02, 0.04, 0.2, [0.78, 0.75, 0.66], { uv: 0.8, step: 6 });

  // Stained concrete/putty retaining ledges beneath side walkways + dark iron pipe guardrails
  c.flat.box(-sideX - 0.08, -1.25, -1.2, -sideX + 0.02, 0.02, zTop, PUTTY_DARK, { step: 5 });
  c.flat.box(sideX - 0.02, -1.25, -1.2, sideX + 0.08, 0.02, zTop, PUTTY_DARK, { step: 5 });
  c.flat.box(-W / 2, -1.25, -1.24, -sideX, 0.02, -1.16, PUTTY_DARK, { step: 4 });
  c.flat.box(sideX, -1.25, -1.24, W / 2, 0.02, -1.16, PUTTY_DARK, { step: 4 });

  const addIronRail = (x0, z0, x1, z1) => {
    c.flat.box(x0, 0.82, z0, x1, 0.87, z1, RAIL_IRON, { step: 4 });
    c.flat.box(x0, 0.40, z0, x1, 0.44, z1, RAIL_IRON, { step: 4 });
    c.flat.box(x0, 0, z0, x0 + 0.05, 0.87, z0 + 0.05, RAIL_IRON, { step: 2 });
    c.flat.box(x1 - 0.05, 0, z1 - 0.05, x1, 0.87, z1, RAIL_IRON, { step: 2 });
    c.solid(x0, z0, x1, z1, { keep: true, tall: false });
  };
  addIronRail(-W / 2 + 0.1, -1.22, -sideX + 0.04, -1.14);
  addIronRail(sideX - 0.04, -1.22, W / 2 - 0.1, -1.14);
  addIronRail(-sideX - 0.06, -1.20, -sideX + 0.02, zTop - 1.15);
  addIronRail(sideX - 0.02, -1.20, sideX + 0.06, zTop - 1.15);

  // 2. Five-Tier Sunken Backrooms Slope + 70 Drab Folding Chairs + 26 Seated Uncanny Colleagues!
  const bowlSpan = zTop - pitZ;
  const tierDepth = bowlSpan / 5;
  const seatGeo = kit.model('ah:seat', auditoriumSeatVox);
  const audKit = buildAudienceKit(kit);
  const audBodyB = new Batch(true);
  const audHeadFwdB = new Batch(true);
  const audHeadBackB = new Batch(true);
  let watcherCount = 0;

  for (let t = 1; t <= 5; t++) {
    const tz1 = zTop - (t - 1) * tierDepth;
    const tz0 = zTop - t * tierDepth;
    const ty = -(t * 0.22);
    const prevY = -((t - 1) * 0.22);
    const xMin = t >= 4 ? -W / 2 + 0.05 : -sideX;
    const xMax = t >= 4 ? W / 2 - 0.05 : sideX;

    // Damp, stained Backrooms carpet step & scuffed concrete riser
    addCarpetRect(xMin, tz0, xMax, tz1, ty, [0.68 - t * 0.03, 0.66 - t * 0.03, 0.58 - t * 0.025]);
    c.flat.box(xMin, ty, tz1 - 0.05, xMax, prevY + 0.005, tz1 + 0.02, PUTTY_DARK, { step: 5 });
    // Worn dark runner strip + black power cable snaking down the centre aisle
    c.flat.box(-1.18, ty + 0.003, tz0, 1.18, ty + 0.008, tz1, AISLE_STAIN, { step: 3 });
    c.flat.box(-0.18, ty + 0.009, tz0, -0.14, ty + 0.022, tz1, CORD_BLACK, { step: 3 });

    const seatZ = (tz0 + tz1) / 2 + 0.08;
    for (const side of [-1, 1]) {
      const innerX = 1.62;
      const outerX = sideX - 0.68;
      let count = 0;
      for (let ax = innerX; ax <= outerX + 0.01; ax += 0.84) {
        const sx = side * ax + R.range(-0.03, 0.03);
        const sz = seatZ + R.range(-0.03, 0.03);
        c.place(seatGeo, sx, sz, { y: ty, scale: 2, rot: R.range(-0.05, 0.05), solid: false, shadow: false });

        // Seat ~14 motionless uncanny colleagues across the dark rows (framing the centre aisle!)
        const nearAisle = count <= 2;
        if (watcherCount < 14 && (nearAisle ? (t + count) % 2 === 0 : R.chance(0.20))) {
          const tiltZ = side * (0.14 + (watcherCount % 3) * 0.08);
          audKit.stamp(audBodyB, audHeadFwdB, audHeadBackB, watcherCount, sx, ty, sz, tiltZ);
          watcherCount++;
        }
        count++;
      }
      if (count > 0) {
        const bx0 = side < 0 ? -(innerX + (count - 1) * 0.84 + 0.24) : innerX - 0.24;
        const bx1 = side < 0 ? -(innerX - 0.24) : innerX + (count - 1) * 0.84 + 0.24;
        c.solid(bx0, seatZ - 0.24, bx1, seatZ + 0.24, { tall: false });
      }
    }
  }

  const audBodies = c.dynamic(audBodyB, { vox: true });
  const audHeadsFwd = c.dynamic(audHeadFwdB, { vox: true });
  const audHeadsBack = c.dynamic(audHeadBackB, { vox: true });
  audHeadsBack.visible = false;

  // 3. Sunken Pit (`z ∈ [stageZ, pitZ], y = -1.10`) & Lone Standing Q&A Microphone
  addCarpetRect(-W / 2 + 0.05, stageZ, W / 2 - 0.05, pitZ, -1.10, [0.50, 0.48, 0.42]);
  c.blot(0, stageZ + 1.15, 2.2, 1.8, { rgb: [0.04, 0.03, 0.02], a: 0.55, y: -1.094 });
  const micZ = stageZ + 1.15;
  c.model('ah:qamic', qaMicVox, 0, micZ, { y: -1.10, rot: Math.PI, solid: false, shadow: false });
  // Harsh cold spotlight pool on the carpet around the lone Q&A mic
  c.lay(c.shining('ah:micring', kit.tex.blob(), 0.95, [0.85, 0.88, 0.80], { transparent: true, depthWrite: false }), 0, micZ, 1.45, 1.45, 0, null, WHITE, -1.091);

  // 4. Bare Concrete/Plywood Stage (`z <= stageZ, y = -0.44`), Side Steps, & Crooked Yellow-Wallpaper False Flats
  c.flat.box(-W / 2 + 0.04, -1.25, -D / 2 + 0.04, W / 2 - 0.04, -0.44, stageZ, CONCRETE_STAGE, { step: 6 });
  // Worn black/ochre hazard tape along the raw stage edge
  for (let hx = -W / 2 + 0.4; hx < W / 2 - 0.6; hx += 0.9) {
    c.flat.box(hx, -0.45, stageZ - 0.06, hx + 0.48, -0.436, stageZ + 0.01, [0.58, 0.48, 0.16], { step: 2 });
  }

  // Twin 3-riser concrete steps at |x| ∈ [3.2, 4.8], z ∈ [stageZ, stageZ + 0.9]
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -4.8 : 3.2, x1 = sx < 0 ? -3.2 : 4.8;
    const steps = [[-0.66, stageZ, stageZ + 0.30], [-0.88, stageZ + 0.30, stageZ + 0.60], [-1.10, stageZ + 0.60, stageZ + 0.90]];
    for (const [sy, sz0, sz1] of steps) {
      c.flat.box(x0, -1.20, sz0, x1, sy, sz1, PUTTY_DARK, { step: 2 });
    }
  }

  // Instead of theatre curtains: crooked, towering false Backrooms wallpaper partition flats propped on stage!
  const wingW = 2.2;
  for (const sx of [-1, 1]) {
    const cx0 = sx < 0 ? -W / 2 + 0.12 : W / 2 - 0.12 - wingW;
    const cx1 = sx < 0 ? -W / 2 + 0.12 + wingW : W / 2 - 0.12;
    c.wall.box(cx0, -0.44, stageZ - 0.52, cx1, H - 0.85, stageZ - 0.38, [0.74, 0.71, 0.60], { uv: 0.8, step: 4 });
    c.flat.box(cx0 - 0.02, -0.44, stageZ - 0.54, cx0 + 0.04, H - 0.82, stageZ - 0.36, PUTTY_DARK, { step: 4 });
    c.flat.box(cx1 - 0.04, -0.44, stageZ - 0.54, cx1 + 0.02, H - 0.82, stageZ - 0.36, PUTTY_DARK, { step: 4 });
    c.solid(cx0, stageZ - 0.62, cx1, stageZ - 0.32, { tall: true });
  }

  // Stark metal lectern stage-right
  const lecternX = -1.55, lecternZ = stageZ - 1.15;
  c.model('ah:lectern', lecternVox, lecternX, lecternZ, { y: -0.44, rot: Math.PI, solid: true, shadow: false });

  // 5. Giant Harsh 4:3 Overhead Projection Screen (`6.2m × 4.2m`) Burning Through the Dark
  const screenTex = kit.tex.live(256, 176, (g, w, h) => drawKeynoteSlide(g, w, h, 0, p, false), { clamp: true });
  const screenW = 6.2, screenH = 4.2, screenY = 2.15, screenZ = -D / 2 + 0.18;
  c.flat.box(-screenW / 2 - 0.10, screenY - screenH / 2 - 0.10, screenZ - 0.08, screenW / 2 + 0.10, screenY + screenH / 2 + 0.10, screenZ, [0.12, 0.12, 0.12], { step: 4 });
  c.board(c.shining('ah:screen', screenTex, 1.55), 0, screenY, screenZ + 0.02, screenW, screenH, 0);

  // 6. Wheeled Metal Overhead-Projector Cart at the Top of the Aisle (`(0, zTop + 0.65)`)
  const avZ = zTop + 0.65;
  c.flat.box(-0.55, 0, avZ - 0.38, 0.55, 0.86, avZ + 0.38, [0.18, 0.19, 0.18], { step: 2 });
  // Glowing glass platen of the overhead projector throwing light forward!
  c.flat.box(-0.24, 0.86, avZ - 0.22, 0.24, 0.94, avZ + 0.22, [0.28, 0.29, 0.28], { step: 1 });
  c.shining('ah:platen', kit.tex.white(), 2.2, [0.88, 0.92, 0.82]).quad(
    [-0.18, 0.945, avZ + 0.16], [0.18, 0.945, avZ + 0.16], [0.18, 0.945, avZ - 0.16], [-0.18, 0.945, avZ - 0.16]
  );
  c.flat.box(-0.03, 0.94, avZ - 0.20, 0.03, 1.32, avZ - 0.15, [0.16, 0.16, 0.16], { step: 1 });
  c.flat.box(-0.08, 1.26, avZ - 0.26, 0.08, 1.38, avZ - 0.10, [0.22, 0.22, 0.22], { step: 1 });
  c.solid(-0.58, avZ - 0.40, 0.58, avZ + 0.40, { tall: false });

  // Taped paper sign on the front wall beside the door
  const schedSpot = c.wallSpot(1.2, ['front']);
  if (schedSpot) {
    const poster = card(c, `ah:poster:${p.project}`, [
      'MANDATORY ALL-HANDS',
      'DO NOT WAKE SEATED STAFF',
      'QUESTIONS AT THE MIC',
    ], { w: 144, h: 72, bg: '#dfd7be', fg: '#1c1a16', edge: '#6e1c1a', size: 9, pad: 6 });
    c.hang(c.mapped('ah:poster', poster), schedSpot.side, schedSpot.at, 1.48, 0.88, 0.44);
  }

  for (const dr of c.room.doors) {
    if (dr.side !== 'front') c.exitSign(dr, 'EXIT');
  }

  // 7. Stark, Oppressive Backrooms Projector Glare Lighting (strictly <= 9 lights — deep pitch shadows in the rows!)
  c.light(0, screenY, stageZ - 1.0, '#d8dfd0', 3.4, { far: 17, k: 2.6 }); // harsh screen bounce glare
  c.light(0, -0.1, micZ, '#e8e2cc', 1.35, { far: 6.5, k: 1.8 });          // tight cold cone on the lone aisle mic
  c.light(0, 1.4, avZ, '#dce4d0', 0.95, { far: 5.5, k: 1.6 });            // overhead projector platen glow
  c.light(-sideX - 0.9, 2.5, 0.0, '#d4d89e', 0.65, { far: 7.5 });         // dying side-door fluorescent
  c.light(sideX + 0.9, 2.5, 0.0, '#d4d89e', 0.65, { far: 7.5 });

  // 8. Towering Gaunt Keynote Speaker Rig & Head-Snapping Q&A State Machine
  const speaker = makeKeynoteSpeaker(kit);
  const speakerStartZ = stageZ - 1.05;
  speaker.group.position.set(0.22, -0.44, speakerStartZ);
  speaker.group.rotation.y = 0;
  c.add(speaker.group);
  const walker = { x: .22, z: speakerStartZ, group: speaker.group };
  roomBody(c, walker, { r: .3, tall: 1.8 });
  // The tall speaker steps off this stage's .66m lip during a blackout.
  // Visitors use the side stairs. Keep the normal wall/furniture sweeps and
  // stair limit everywhere else: this permission is only the authored lip
  // between the stage and its pit, not arbitrary holes. On a setback it
  // steps back up this same lip as it returns to its starting place.
  const speakerWorld = Object.create(c.world);
  speakerWorld.passable = (ax, az, bx, bz) => {
    if (c.world.passable(ax, az, bx, bz)) return true;
    const from = c.toLocal(ax, az), to = c.toLocal(bx, bz);
    const high = auditoriumFloorY(from.x, from.z, W, D), low = auditoriumFloorY(to.x, to.z, W, D);
    const descending = from.z <= stageZ && to.z > stageZ && to.z < stageZ + .15
      && Math.abs(high + .44) < .001 && Math.abs(low + 1.10) < .001
      && high - low <= .7;
    const returning = state.phase === 'slides' && from.z > stageZ && from.z < stageZ + .15 && to.z <= stageZ
      && Math.abs(high + 1.10) < .001 && Math.abs(low + .44) < .001 && low - high <= .7;
    return descending || returning;
  };
  const speakerContext = { ...c, world: speakerWorld };

  let state = createAllHandsState();
  let lastBlackout = false;
  let flashWhite = 0;
  const avWorld = c.toWorld(0, avZ);
  const micWorld = c.toWorld(0, micZ);

  const syncCrowd = () => {
    const qa = state.phase === 'qa';
    const gone = state.phase === 'adjourned';
    audBodies.visible = !gone;
    audHeadsFwd.visible = !gone && !qa;
    audHeadsBack.visible = !gone && qa;
    speaker.group.visible = !gone;
  };

  const redrawScreen = () => {
    const g = screenTex.image.getContext('2d');
    drawKeynoteSlide(g, 256, 176, state.slide, p, state.blackout);
    screenTex.needsUpdate = true;
    syncCrowd();
  };

  const forceEnterQa = () => {
    while (state.phase === 'slides') {
      state = stepAllHands(state, { clickedSlide: true }).state;
    }
    redrawScreen();
    c.env.interfere(0.55);
    c.env.play('shutter', avWorld.x, avWorld.z, 20);
    c.env.play('buzz', micWorld.x, micWorld.z, 18);
  };

  c.use({
    x: 0,
    z: avZ,
    r: 1.85,
    label: 'advance transparency',
    when: () => state.phase === 'slides',
    use: () => {
      const res = stepAllHands(state, { clickedSlide: true });
      state = res.state;
      redrawScreen();
      c.env.play('click', avWorld.x, avWorld.z, 10);
      { const sw = c.toWorld(0, screenZ); c.env.play('shutter', sw.x, sw.z, 18); }
      if (res.triggeredQa) {
        c.env.interfere(0.55);
        c.env.play('buzz', micWorld.x, micWorld.z, 18);
      }
    },
  });

  c.use({
    x: 0,
    z: micZ,
    r: 1.75,
    label: 'say "no questions"',
    when: () => state.phase === 'qa',
    use: () => {
      const res = stepAllHands(state, { usedMic: true });
      state = res.state;
      flashWhite = 0.85;
      redrawScreen();
      c.world.setLights(c.rt, 1.15);
      c.env.interfere(0.75);
      c.env.play('shutter', micWorld.x, micWorld.z, 20);
      c.env.play('ding', micWorld.x, micWorld.z, 18);
    },
  });

  c.tick((dt, t, me) => {
    if (flashWhite > 0 && c.env.vhs?.uniforms?.uWhite) {
      flashWhite = Math.max(0, flashWhite - dt * 2.4);
      c.env.vhs.uniforms.uWhite.value = flashWhite * flashWhite;
    }

    // Ambush trigger: if the visitor dares walk halfway down the dark aisle without advancing slides, Q&A snaps on!
    if (me.inside && state.phase === 'slides' && Math.abs(me.x) < 3.6 && me.z < stageZ + 6.4) {
      forceEnterQa();
    }

    const spkX = walker.x, spkZ = walker.z;
    const dist = Math.hypot(me.x - spkX, me.z - spkZ);

    const res = stepAllHands(state, {
      dt,
      insideRoom: me.inside,
      distToSpeaker: dist,
      clearLine: roomContact(c, walker, me),
    });
    state = res.state;

    if (res.changedSlide || state.blackout !== lastBlackout) {
      lastBlackout = state.blackout;
      redrawScreen();
      if (state.phase === 'qa') {
        c.world.setLights(c.rt, state.blackout ? 0.02 : 0.78);
        if (state.blackout) c.env.play('shutter', avWorld.x, avWorld.z, 18);
      } else if (state.phase === 'slides') {
        c.world.setLights(c.rt, 1.0);
      }
    }

    if (res.stepped) {
      const sw = c.toWorld(spkX, spkZ);
      c.env.play('step', sw.x, sw.z, 16);
    }

    if (res.setback && c.env.player) {
      c.env.interfere(0.95);
      const mw = c.toWorld(me.x, me.z);
      c.env.play('static', mw.x, mw.z, 14);
      c.env.play('clack', mw.x, mw.z, 12);
      const backSpot = roomReturn(c, 0, D / 2 - 1.35);
      const stageWorld = c.toWorld(0, stageZ);
      if (backSpot) {
        const faceStageYaw = Math.atan2(backSpot.x - stageWorld.x, backSpot.z - stageWorld.z);
        c.env.player.warp(backSpot.x, backSpot.z, faceStageYaw);
      }
    }

    if (state.phase !== 'adjourned') {
      const goalX = state.phase === 'qa' ? 0 : 0.22;
      const goalZ = clamp(speakerStartZ + state.speakerProgress, speakerStartZ, zTop - 0.6);
      // Each shutter blackout buys one checked step, never a jump to the
      // accumulated script position after a barricade has held it back.
      const travel = state.phase === 'qa' ? (res.stepped ? ALL_HANDS.stepAdvance : 0) : 1.8 * dt;
      moveRoomWalker(speakerContext, walker, goalX, goalZ, travel);
      const curX = walker.x, curZ = walker.z;
      const curY = auditoriumFloorY(curX, curZ, W, D);
      speaker.group.position.set(curX, curY, curZ);
      speaker.group.rotation.y = me.inside ? Math.atan2(me.x - curX, me.z - curZ) * 0.45 : 0;
      speaker.animate(t, state.phase === 'qa', state.blackout);
      const sample = c.sample(curX, curY + 1.5, curZ);
      const boost = state.blackout ? 0.05 : 1.0;
      speaker.setTint(Math.max(0.32, sample[0]) * boost, Math.max(0.32, sample[1]) * boost, Math.max(0.30, sample[2]) * boost);
    }
  });
}
