// A familiar Office silhouette stretched into the thing living above the floor.
// Geometry stays on the native voxel grid; the limbs move as real jointed parts.
import * as THREE from 'three';
import { Batch, lamp } from './kit.js';
import { Vox, M } from '../vox/vox.js';
import { buildCharacter, JOINT } from '../avatar/build.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const down = new THREE.Vector3(0, -1, 0);

export function buildUnderfloorCreature(c) {
  const look = { species: 'human', skin: '#303b38', hair: 'short', hairColor: '#171e1c', outfit: 'cardigan', outfitColor: '#202925', accessory: 'none', facial: 'none' };
  const parts = buildCharacter(look, { seed: 'underfloor-shadow', provider: 'unknown' });
  const dark = M('#111a17', 2), skin = M('#35443d', 2), edge = M('#4f5d50', 1), hollow = M('#030806', 0);
  // Keep the cardigan, shoulders, ears and familiar stepped skull. Remove the
  // bright badge and shoe trim, then hollow the face rather than adding a mask.
  parts.torso.paint(-20, 0, -20, 20, 60, 20, (x, y, z, m) => z >= 4 && y < 28 ? dark : m);
  parts.torso.decal('+z', -2, 19, 2, 35, M('#303c34', 2));
  for (const name of ['legUpperL', 'legUpperR', 'legLowerL', 'legLowerR']) parts[name].each((x, y, z) => parts[name].set(x, y, z, M(y < 3 ? '#17211d' : '#26302a', 2)));
  for (const name of ['armLowerL', 'armLowerR']) parts[name].carve(-20, 0, -10, 20, 18, 10);
  const h = parts.head;
  h.paint(-9, 35, 4, 9, 50, 10, skin);
  h.carve(-7, 42, 4, -2, 48, 10); h.carve(2, 41, 4, 7, 46, 10);
  h.box(-7, 42, 3, -2, 48, 4, hollow); h.box(2, 41, 3, 7, 46, 4, hollow);
  h.box(-5, 44, 4, -4, 45, 5, M('#8b9780', 0));
  h.box(4, 42, 4, 5, 43, 5, M('#6f806d', 0));
  h.carve(-3, 36, 5, 2, 41, 10); h.box(-3, 36, 4, 2, 41, 5, hollow);
  h.box(-7, 40, 7, -5, 42, 9, edge); h.box(5, 38, 7, 7, 40, 9, edge);
  h.box(-2, 35, 6, 1, 36, 9, skin);

  const root = new THREE.Group(); root.name = 'underfloor-shadow'; c.add(root);
  const material = c.kit.surface({ vox: true, room: c.rt.u });
  const part = (name, make, origin, scale) => {
    const b = new Batch(true), g = new THREE.Group();
    const matrix = new THREE.Matrix4().makeScale(...scale).multiply(new THREE.Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2]));
    b.addVox(c.kit.model(`underfloor:shadow:${name}:v1`, make).solid, matrix);
    // A restrained edge light keeps the charcoal facets readable under the
    // grate. Room tint is sampled every frame, so this is never a glowing NPC.
    const geometry = c.kit.geometry(b, [lamp(-1, 2, 1, [.32, .39, .34], { k: 6, far: 8, wrap: .6 })], [.42, .46, .42]);
    g.add(new THREE.Mesh(geometry, material)); root.add(g); return g;
  };
  const torso = part('torso', () => parts.torso, JOINT.hips, [.031, .043, .031]);
  const head = part('head', () => h, [0, 43.5, 0], [.033, .035, .031]);
  const arms = [-1, 1].map(s => {
    const suffix = s < 0 ? 'L' : 'R';
    return {
      upper: part(`upper-arm-${s}`, () => parts[`armUpper${suffix}`], [s * 9, 33, 0], [.032, 1 / 8, .032]),
      lower: part(`forearm-${s}`, () => parts[`armLower${suffix}`], [s * 9, 25, 0], [.030, 1 / 7, .030]),
    };
  });
  const legs = [-1, 1].map(s => {
    const suffix = s < 0 ? 'L' : 'R';
    return {
      upper: part(`upper-leg-${s}`, () => parts[`legUpper${suffix}`], [s * 3.5, 18, 0], [.031, 1 / 9, .031]),
      lower: part(`lower-leg-${s}`, () => parts[`legLower${suffix}`], [s * 3.5, 9, 0], [.031, 1 / 9, .031]),
    };
  });
  const hands = [-1, 1].map(s => {
    const palm = part(`palm-${s}`, () => {
      const v = new Vox(); v.rbox(-3, -6, -2, 3, 0, 2, 1, skin, 'xz');
      for (const x of [-2, 0, 2]) v.box(x, -6, 1, x + 1, -1, 2, edge);
      return v;
    }, [0, 0, 0], [.029, .029, .029]);
    const fingers = [];
    for (let i = 0; i < 5; i++) {
      const len = i === 4 ? .17 : [.24, .31, .29, .23][i];
      const makeFinger = () => {
        const v = new Vox(); v.rbox(-1, -5, -1, 1, 0, 1, .6, skin);
        // A worn ridge across each knuckle catches the grate's reflected light.
        // It stays a skin facet rather than an emissive nail or decorative claw.
        v.box(-1, -1, -1, 1, 0, 1, M('#617265', 1)); v.box(-1, -4, 0, 0, -1, 1, edge);
        return v;
      };
      const a = part(`finger-${s}-${i}-a`, makeFinger, [0, 0, 0], [.019, len / 10, .021]);
      const b = part(`finger-${s}-${i}-b`, makeFinger, [0, 0, 0], [.018, len / 10, .02]);
      palm.add(a); a.position.set(i === 4 ? s * .105 : -.065 + i * .043, i === 4 ? -.065 : -.16, .012);
      a.add(b); b.position.y = -len / 2; fingers.push({ a, b, i });
    }
    return { palm, fingers };
  });
  const delta = new THREE.Vector3();
  const segment = (g, a, b) => {
    g.position.set(...a); delta.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = delta.length(); g.quaternion.setFromUnitVectors(down, delta.normalize()); g.scale.y = length;
  };
  let last = null;
  const update = (pose) => {
    const lean = clamp(pose.lean || 0), reach = clamp(pose.reach || 0), yaw = pose.yaw || 0;
    const deck = 1.15 - clamp(pose.deckDrop || 0, 0, .16), stride = Number.isFinite(pose.stride) ? pose.stride : 0;
    root.position.set(pose.x || 0, deck, pose.z || 0); root.rotation.y = yaw;
    const gait = Math.sin(stride) * (1 - lean), hipY = mix(.81, .45, lean), hipZ = mix(-.10, -.65, lean);
    torso.position.set(0, hipY, hipZ); torso.rotation.x = mix(.16, 1.1, lean); torso.rotation.z = gait * .035;
    head.position.set(Math.sin(stride * .37) * .025 * (1 - lean), mix(1.61, .73, lean), mix(.08, .06, lean));
    head.rotation.set(mix(.16, Math.PI / 2, lean), Math.sin(stride * .29) * .08 * (1 - lean), mix(-.055, .12, lean));
    const tx = (pose.target?.x ?? root.position.x) - root.position.x, tz = (pose.target?.z ?? root.position.z) - root.position.z;
    // Transform a locked room-space target into the rig's coordinates. The
    // forearm enters through the missing centre bars; no arm crosses timber.
    const target = [clamp(tx, -.14, .14) * Math.cos(yaw) - clamp(tz, -.46, .46) * Math.sin(yaw), clamp(tx, -.14, .14) * Math.sin(yaw) + clamp(tz, -.46, .46) * Math.cos(yaw)];
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, swing = gait * s;
      const hip = [s * .13, hipY, hipZ], knee = [s * .17, mix(.42, .21, lean), hipZ + .10 + lean * .35 + swing * .12];
      const ankle = [s * .18, Math.max(0, swing) * .055, hipZ + .10 - lean * .12 - swing * .15];
      segment(legs[i].upper, hip, knee); segment(legs[i].lower, knee, ankle);
      const shoulder = [s * .32, mix(1.42, .94, lean), mix(.02, -.25, lean)];
      const grabbing = i === 1;
      const elbow = grabbing ? [mix(.39, .015, lean), mix(.93, mix(.92, .18, reach), lean), mix(.08 - swing * .12, .02, lean)]
        : [-mix(.39, .47, lean), mix(.93, .55, lean), mix(.08 - swing * .12, .30, lean)];
      // The deepest wrist is .63m above the crawl floor even with the boards
      // fully depressed. The longest uncurled finger then ends above .16m.
      const wrist = grabbing ? [mix(.42, target[0] * reach, lean), mix(.53, mix(.70, -.36, reach), lean), mix(.12 - swing * .20, mix(.04, target[1], reach), lean)]
        : [-mix(.42, .49, lean), mix(.53, .43, lean), mix(.12 - swing * .20, .55, lean)];
      segment(arms[i].upper, shoulder, elbow); segment(arms[i].lower, elbow, wrist);
      hands[i].palm.position.set(...wrist); hands[i].palm.rotation.set(grabbing ? -.08 * (1 - reach) : -.30 * lean, 0, s * .06);
      const curl = grabbing ? (pose.caught ? 1.15 : reach > .86 ? (reach - .86) / .14 * .65 : .06) : .23;
      for (const f of hands[i].fingers) {
        f.a.rotation.x = curl * (f.i === 4 ? .6 : .45); f.b.rotation.x = curl;
        // A slightly open fan makes the separated fingers legible from the
        // side refuge; the tips curl inward as the hand closes on its target.
        f.a.rotation.z = f.i === 4 ? -s * .8 : (f.i - 1.5) * .19 * (1 - curl * .4);
      }
    }
    const tint = c.sample(root.position.x, deck + .8, root.position.z);
    material.uniforms.uTint.value.set(Math.max(.35, tint[0]), Math.max(.38, tint[1]), Math.max(.35, tint[2]));
    last = { phase: pose.phase, x: root.position.x, z: root.position.z, lean, reach, deck, handY: deck + hands[1].palm.position.y, headY: deck + head.position.y };
  };
  update({ x: 0, z: 0, lean: 0, reach: 0, stride: 0 });
  return { root, head, torso, arms, hand: hands[1].palm, material, update, read: () => ({ ...last }) };
}
