// The Office — the skeleton. Takes the sculpted parts of a character and
// joints them into something that can sit, type, walk, wave and sulk.
//
// Poses are just target angles for each joint; the rig eases toward whatever
// pose it is asked for and layers small cyclic motion on top (breathing,
// typing fingers, a walk cycle), so changing state never snaps.
import * as THREE from 'three';
import { VOXEL } from '../vox/vox.js';
import { meshVox } from '../vox/mesher.js';
import { voxelMaterial, voxelGlassMaterial } from '../vox/material.js';
import { JOINT, buildCharacter, buildMug, facePixels, hatTop } from './build.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function partMesh(vox, origin) {
  const group = new THREE.Group();
  if (!vox || !vox.size) return group;
  const meshed = meshVox(vox, { origin });
  if (meshed.solid) {
    const m = new THREE.Mesh(meshed.solid, voxelMaterial());
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  if (meshed.glass) { const m = new THREE.Mesh(meshed.glass, voxelGlassMaterial()); m.renderOrder = 2; group.add(m); }
  return group;
}

const faceColor = new THREE.Color();
/** Flat quads laid on the front surface of the head: eyes, mouth, blush. */
function faceGeometry(headVox, pixels, origin) {
  const pos = [], nor = [], col = [], tex = [], emi = [], idx = [];
  const b = headVox.bounds();
  for (const p of pixels) {
    let z = null;
    for (let k = b.z1 - 1; k >= 0; k--) if (headVox.has(p.x, p.y, k)) { z = k + 1; break; }
    if (z === null) continue;
    const zz = z + 0.04 - origin[2];
    const x0 = p.x - origin[0], y0 = p.y - origin[1];
    faceColor.set(p.c);                       // hex → linear working space
    const start = pos.length / 3;
    for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(x0 + dx, y0 + dy, zz);
      nor.push(0, 0, 1);
      col.push(faceColor.r, faceColor.g, faceColor.b);
      tex.push(0); emi.push(p.glow ? 1 : 0);
    }
    idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aTex', new THREE.Float32BufferAttribute(tex, 1));
  geo.setAttribute('aEmis', new THREE.Float32BufferAttribute(emi, 1));
  geo.setIndex(idx);
  return geo;
}

const EXPRESSIONS = ['neutral', 'blink', 'happy', 'worried', 'focus', 'sleep', 'talk', 'dizzy'];

/* ---- poses ---------------------------------------------------------------- */
// Angles in radians. For a limb hanging down: x < 0 swings it forward,
// z > 0 lifts a RIGHT arm out to the side (z < 0 lifts a left one).
const Z = Object.freeze({ x: 0, y: 0, z: 0 });
const pose = (o) => ({
  lift: 0, lean: 0, tilt: 0, twist: 0, head: Z, shoulderL: Z, shoulderR: Z, elbowL: Z, elbowR: Z,
  hipL: Z, hipR: Z, kneeL: Z, kneeR: Z, ...o,
});
export const POSES = {
  stand: pose({ shoulderL: { x: 0, y: 0, z: -0.07 }, shoulderR: { x: 0, y: 0, z: 0.07 } }),
  sit: pose({
    lean: 0.06,
    hipL: { x: -1.5, y: 0, z: 0 }, hipR: { x: -1.5, y: 0, z: 0 }, kneeL: { x: 1.45, y: 0, z: 0 }, kneeR: { x: 1.45, y: 0, z: 0 },
    shoulderL: { x: -0.35, y: 0, z: -0.06 }, shoulderR: { x: -0.35, y: 0, z: 0.06 },
    elbowL: { x: -0.85, y: 0, z: 0 }, elbowR: { x: -0.85, y: 0, z: 0 },
  }),
  type: pose({
    lean: 0.1, head: { x: 0.1, y: 0, z: 0 },
    hipL: { x: -1.5, y: 0, z: 0 }, hipR: { x: -1.5, y: 0, z: 0 }, kneeL: { x: 1.45, y: 0, z: 0 }, kneeR: { x: 1.45, y: 0, z: 0 },
    shoulderL: { x: -0.62, y: 0, z: -0.1 }, shoulderR: { x: -0.62, y: 0, z: 0.1 },
    elbowL: { x: -1.05, y: 0, z: 0.12 }, elbowR: { x: -1.05, y: 0, z: -0.12 },
  }),
  think: pose({
    lean: -0.1, head: { x: -0.12, y: 0.22, z: 0.1 },
    hipL: { x: -1.5, y: 0, z: 0 }, hipR: { x: -1.5, y: 0, z: 0 }, kneeL: { x: 1.3, y: 0, z: 0 }, kneeR: { x: 1.6, y: 0, z: 0 },
    shoulderL: { x: -0.3, y: 0, z: -0.06 }, elbowL: { x: -0.9, y: 0, z: 0 },
    shoulderR: { x: -0.95, y: 0, z: -0.25 }, elbowR: { x: -2.2, y: 0, z: 0 },
  }),
  // seated, one hand up: "I need you"
  ask: pose({
    lean: -0.04, head: { x: -0.16, y: 0, z: 0 },
    hipL: { x: -1.5, y: 0, z: 0 }, hipR: { x: -1.5, y: 0, z: 0 }, kneeL: { x: 1.45, y: 0, z: 0 }, kneeR: { x: 1.45, y: 0, z: 0 },
    shoulderL: { x: -0.35, y: 0, z: -0.06 }, elbowL: { x: -0.85, y: 0, z: 0 },
    shoulderR: { x: 0, y: 0, z: 2.75 }, elbowR: { x: 0, y: 0, z: 0.15 },
  }),
  lounge: pose({
    lean: -0.22, head: { x: 0.08, y: 0, z: 0 },
    hipL: { x: -1.35, y: 0, z: 0.1 }, hipR: { x: -1.35, y: 0, z: -0.1 }, kneeL: { x: 1.15, y: 0, z: 0 }, kneeR: { x: 1.15, y: 0, z: 0 },
    shoulderL: { x: -0.15, y: 0, z: -0.35 }, shoulderR: { x: -0.15, y: 0, z: 0.35 }, elbowL: { x: -0.5, y: 0, z: 0 }, elbowR: { x: -0.5, y: 0, z: 0 },
  }),
  wave: pose({
    head: { x: -0.08, y: 0, z: -0.06 },
    shoulderR: { x: 0, y: 0, z: 2.55 }, elbowR: { x: 0, y: 0, z: 0.35 },
    shoulderL: { x: 0.1, y: 0, z: -0.3 }, elbowL: { x: -0.5, y: 0, z: 0 },
  }),
  cheer: pose({
    head: { x: -0.2, y: 0, z: 0 },
    shoulderL: { x: 0, y: 0, z: -2.7 }, shoulderR: { x: 0, y: 0, z: 2.7 }, elbowL: { x: 0, y: 0, z: -0.2 }, elbowR: { x: 0, y: 0, z: 0.2 },
  }),
  sip: pose({
    head: { x: -0.1, y: 0, z: 0 },
    shoulderR: { x: -0.75, y: 0, z: 0.1 }, elbowR: { x: -1.85, y: 0, z: 0 },
    shoulderL: { x: 0.05, y: 0, z: -0.1 },
  }),
  bow: pose({ lean: 0.95, head: { x: 0.3, y: 0, z: 0 }, shoulderL: { x: -0.3, y: 0, z: -0.1 }, shoulderR: { x: -0.3, y: 0, z: 0.1 } }),
  shrug: pose({ head: { x: 0, y: 0, z: 0.12 }, shoulderL: { x: 0, y: 0, z: -0.75 }, shoulderR: { x: 0, y: 0, z: 0.75 }, elbowL: { x: -1.6, y: 0, z: 0 }, elbowR: { x: -1.6, y: 0, z: 0 } }),
  facepalm: pose({ lean: 0.12, head: { x: 0.32, y: 0, z: 0 }, shoulderR: { x: -1.25, y: 0, z: -0.45 }, elbowR: { x: -2.15, y: 0, z: 0 } }),
  salute: pose({ shoulderR: { x: -0.4, y: 0, z: 1.5 }, elbowR: { x: 0, y: 0, z: 1.9 } }),
  stretch: pose({ lean: -0.15, head: { x: -0.3, y: 0, z: 0 }, shoulderL: { x: 0, y: 0, z: -2.9 }, shoulderR: { x: 0, y: 0, z: 2.9 } }),
  sleep: pose({
    lean: 0.34, head: { x: 0.45, y: 0, z: 0.15 },
    hipL: { x: -1.5, y: 0, z: 0 }, hipR: { x: -1.5, y: 0, z: 0 }, kneeL: { x: 1.45, y: 0, z: 0 }, kneeR: { x: 1.45, y: 0, z: 0 },
    shoulderL: { x: -0.8, y: 0, z: 0 }, shoulderR: { x: -0.8, y: 0, z: 0 }, elbowL: { x: -0.9, y: 0, z: 0.5 }, elbowR: { x: -0.9, y: 0, z: -0.5 },
  }),
};
const JOINTS = ['head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR'];
const SEATED = new Set(['sit', 'type', 'think', 'ask', 'lounge', 'sleep']);
const LEGS = new Set(['hipL', 'hipR', 'kneeL', 'kneeR']);

export class Avatar {
  /**
   * @param {object} look  resolved look (core/look.mjs)
   * @param {{seed?:string, provider?:string}} [opt]
   */
  constructor(look, opt = {}) {
    this.look = look;
    this.parts = buildCharacter(look, opt);
    this.root = new THREE.Group();                       // metres; put this in the world
    this.figure = new THREE.Group();                     // voxel units
    this.figure.scale.setScalar(VOXEL);
    this.root.add(this.figure);
    this.body = new THREE.Group();                       // everything that lifts when it jumps or sits
    this.figure.add(this.body);

    const P = this.parts;
    const node = (at, parentAt, parent) => {
      const g = new THREE.Group();
      g.position.set(...sub(at, parentAt));
      parent.add(g);
      return g;
    };
    this.hips = node(JOINT.hips, [0, 0, 0], this.body);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    this.torso.add(partMesh(P.torso, JOINT.hips));
    this.head = node(JOINT.head, JOINT.hips, this.torso);
    this.head.add(partMesh(P.head, JOINT.head));
    if (P.accessory) this.head.add(partMesh(P.accessory, JOINT.head));
    const topY = hatTop(look);
    if (P.spin) {
      this.spinner = partMesh(P.spin, [0, 0, 0]);
      this.spinner.position.set(0, topY + 6 - JOINT.head[1], 0);
      this.head.add(this.spinner);
    }
    this.hat = new THREE.Group();                        // custom creation hats attach here
    this.hat.position.set(0, topY - JOINT.head[1], 0);
    this.head.add(this.hat);

    this.faces = {};
    for (const name of EXPRESSIONS) {
      const mesh = new THREE.Mesh(faceGeometry(P.head, facePixels(look, name), JOINT.head), voxelMaterial());
      mesh.visible = name === 'neutral';
      this.head.add(mesh);
      this.faces[name] = mesh;
    }
    this.expression = 'neutral';

    this.shoulderL = node(JOINT.shoulderL, JOINT.hips, this.torso);
    this.shoulderL.add(partMesh(P.armUpperL, JOINT.shoulderL));
    this.elbowL = node(JOINT.elbowL, JOINT.shoulderL, this.shoulderL);
    this.elbowL.add(partMesh(P.armLowerL, JOINT.elbowL));
    this.shoulderR = node(JOINT.shoulderR, JOINT.hips, this.torso);
    this.shoulderR.add(partMesh(P.armUpperR, JOINT.shoulderR));
    this.elbowR = node(JOINT.elbowR, JOINT.shoulderR, this.shoulderR);
    this.elbowR.add(partMesh(P.armLowerR, JOINT.elbowR));
    this.hand = node(JOINT.handR, JOINT.elbowR, this.elbowR);          // held things go here

    this.hipL = node(JOINT.hipL, JOINT.hips, this.hips);
    this.hipL.add(partMesh(P.legUpperL, JOINT.hipL));
    this.kneeL = node(JOINT.kneeL, JOINT.hipL, this.hipL);
    this.kneeL.add(partMesh(P.legLowerL, JOINT.kneeL));
    this.hipR = node(JOINT.hipR, JOINT.hips, this.hips);
    this.hipR.add(partMesh(P.legUpperR, JOINT.hipR));
    this.kneeR = node(JOINT.kneeR, JOINT.hipR, this.hipR);
    this.kneeR.add(partMesh(P.legLowerR, JOINT.kneeR));

    this.poseName = 'stand';
    this.cur = pose({});
    for (const j of JOINTS) this.cur[j] = { x: 0, y: 0, z: 0 };
    this.walking = 0;            // 0..1 blend of the walk cycle
    this.speed = 1;
    this.phase = Math.random() * 10;
    this.t = Math.random() * 100;
    this.blinkAt = 1 + Math.random() * 4;
    this.seatHeight = 18;        // voxels: where the hips rest when seated
    this.bounce = 0;             // 0..1: hopping (blocked / cheering)
    this.mug = null;
    this.keepSeat = false;
    this.snap('stand');
  }

  setExpression(name) {
    if (!this.faces[name] || name === this.expression) return;
    this.faces[this.expression].visible = false;
    this.faces[name].visible = true;
    this.expression = name;
  }

  /** Give (or take away) a mug in the right hand. */
  hold(thing) {
    if (this.mug) { this.hand.remove(this.mug); this.mug = null; }
    if (thing === 'mug') {
      this.mug = partMesh(buildMug(), [0, 0, 0]);
      this.mug.position.set(0, -1, 2);
      this.hand.add(this.mug);
    }
  }

  /**
   * @param {string} name
   * @param {{seated?:boolean}} [opt]  seated: keep the legs sitting while the
   *        arms and head do the pose (waving from a chair, a seated shrug)
   */
  setPose(name, opt = {}) {
    if (!POSES[name]) return;
    this.poseName = name;
    this.keepSeat = !!opt.seated && !SEATED.has(name);
  }

  /** Jump straight to a pose (no easing) — for the first frame and for stills. */
  snap(name) {
    this.setPose(name);
    this.update(0, true);
  }

  /**
   * @param {number} dt  seconds since last frame
   * @param {boolean} [instant]
   */
  update(dt, instant = false) {
    this.t += dt;
    const target = POSES[this.poseName];
    const k = instant ? 1 : 1 - Math.exp(-10 * dt);
    const c = this.cur;
    for (const j of JOINTS) {
      const a = c[j], b = this.keepSeat && LEGS.has(j) ? POSES.sit[j] : target[j];
      a.x += (b.x - a.x) * k; a.y += (b.y - a.y) * k; a.z += (b.z - a.z) * k;
    }
    c.lean += (target.lean - c.lean) * k;
    c.tilt += (target.tilt - c.tilt) * k;
    const seated = SEATED.has(this.poseName) || this.keepSeat;
    c.lift += ((seated ? this.seatHeight - 18 : 0) - c.lift) * k;

    const t = this.t;
    const breathe = Math.sin(t * 1.7) * 0.012;
    // start from the eased pose…
    this.torso.rotation.set(c.lean + breathe, 0, c.tilt);
    this.head.rotation.set(c.head.x - breathe * 0.6, c.head.y, c.head.z);
    for (const j of ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR']) {
      this[j].rotation.set(c[j].x, c[j].y, c[j].z);
    }
    let lift = c.lift;

    // …then add what is alive about the current state
    if (this.poseName === 'type') {
      this.elbowL.rotation.x += Math.sin(t * 19) * 0.07;
      this.elbowR.rotation.x += Math.sin(t * 19 + 1.9) * 0.07;
      this.head.rotation.y += Math.sin(t * 0.7) * 0.05;
    } else if (this.poseName === 'wave' || this.poseName === 'ask') {
      const k = this.poseName === 'ask' ? 0.55 : 1;
      this.elbowR.rotation.z += Math.sin(t * 11 * k) * 0.45 * k;
      this.shoulderR.rotation.z += Math.sin(t * 11 * k) * 0.08;
    } else if (this.poseName === 'sip') {
      const s = (Math.sin(t * 0.9) + 1) / 2;                 // raise, hold, lower
      this.elbowR.rotation.x += (1 - s) * 0.9;
      this.head.rotation.x -= s * 0.1;
    } else if (this.poseName === 'think') {
      this.head.rotation.z += Math.sin(t * 0.8) * 0.04;
    } else if (this.poseName === 'sleep') {
      this.torso.rotation.x += Math.sin(t * 1.1) * 0.02;
    } else if (this.poseName === 'stand') {
      this.shoulderL.rotation.x += Math.sin(t * 1.3) * 0.03;
      this.shoulderR.rotation.x -= Math.sin(t * 1.3) * 0.03;
      this.head.rotation.y += Math.sin(t * 0.45) * 0.06;
    }
    if (this.bounce > 0.001) {
      const hop = Math.abs(Math.sin(t * 6.2));
      lift += hop * 7 * this.bounce;
      this.kneeL.rotation.x += (1 - hop) * 0.5 * this.bounce;
      this.kneeR.rotation.x += (1 - hop) * 0.5 * this.bounce;
      this.hipL.rotation.x -= (1 - hop) * 0.25 * this.bounce;
      this.hipR.rotation.x -= (1 - hop) * 0.25 * this.bounce;
    }
    if (this.walking > 0.001) {
      this.phase += dt * 9.5 * this.speed;
      const w = this.walking, s = Math.sin(this.phase), co = Math.cos(this.phase);
      const stride = 0.62 * Math.min(1.25, this.speed);
      this.hipL.rotation.x = c.hipL.x * (1 - w) + (-s * stride) * w;
      this.hipR.rotation.x = c.hipR.x * (1 - w) + (s * stride) * w;
      this.kneeL.rotation.x = c.kneeL.x * (1 - w) + Math.max(0, co) * 0.95 * w;
      this.kneeR.rotation.x = c.kneeR.x * (1 - w) + Math.max(0, -co) * 0.95 * w;
      this.shoulderL.rotation.x += s * 0.55 * w; this.shoulderR.rotation.x -= s * 0.55 * w;
      this.elbowL.rotation.x += -0.35 * w; this.elbowR.rotation.x += -0.35 * w;
      this.torso.rotation.y = s * 0.09 * w;
      this.torso.rotation.x += 0.06 * w * this.speed;
      lift += Math.abs(co) * 0.9 * w;
    }
    this.body.position.y = lift;
    if (this.spinner) this.spinner.rotation.y += dt * 14;

    // blinking, unless the face is busy saying something else
    if (!instant && (this.expression === 'neutral' || this.expression === 'blink')) {
      this.blinkAt -= dt;
      if (this.blinkAt < 0) {
        if (this.expression === 'neutral') { this.setExpression('blink'); this.blinkAt = 0.11; }
        else { this.setExpression('neutral'); this.blinkAt = 1.6 + Math.random() * 4.5; }
      }
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
