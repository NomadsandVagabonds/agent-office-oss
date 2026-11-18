// The Backrooms — legs that walk, for a body whose legs were modelled into one mesh with the rest of it (the office's
// figures, sculpted in `avatar/build.js` and baked whole). Below the hip its own vertices are turned: a thigh about
// the hip, a shin about the knee, left and right half a step apart, by how far it has gone, so its feet do not skate.
// No meshes are added; the body as it was modelled is kept to be turned from, and nothing is moved while it stands.
// Nothing random: how far it has gone, and nothing else.
//
// legsOf(mesh, { hip, knee, keep }) → set(aL, bL, aR, bR): put them in a stance.
// legsFor(mesh, { hip, knee, stride, swing, fold, keep }) → step(x, z, time): call each frame with where the room has
// put it (world or its parent's frame, the same each time) and the clock. Forward is the mesh's +z.
//   hip, knee  heights of the joints in the mesh's own frame (metres)
//   stride     metres walked per full step of both legs
//   swing      radians a thigh goes either way; fold: radians a knee bends as its foot comes through
//   keep(x, y, z)  a vertex below the hip that is not leg (a skirt's front): left as it is

/**
 * The legs of a body, to be set: → set(aL, bL, aR, bR), each thigh's turn about the hip (negative: forward) and each
 * knee's fold (positive: back). The rest pose is (0, 0, 0, 0). Same options as legsFor (hip, knee, keep).
 */
export function legsOf(mesh, { hip, knee, keep = null } = {}) {
  const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal;
  const rest = Float32Array.from(pos.array), restN = Float32Array.from(nor.array, (v) => v / 127);
  const idx = [];
  for (let k = 0; k < rest.length; k += 3) if (rest[k + 1] < hip && !(keep && keep(rest[k], rest[k + 1], rest[k + 2]))) idx.push(k);
  return function set(aL, bL, aR, bR) {
    const arr = pos.array, narr = nor.array;
    for (const k of idx) {
      const left = rest[k] < 0, a = left ? aL : aR, b = left ? bL : bR;
      let y = rest[k + 1] - hip, zz = rest[k + 2], ny = restN[k + 1], nz = restN[k + 2];
      if (rest[k + 1] < knee) {
        // the shin folds back about the knee…
        const ky = y - (knee - hip), cb = Math.cos(b), sb = Math.sin(b);
        y = ky * cb - zz * sb + (knee - hip); zz = ky * sb + zz * cb;
        const n1 = ny * cb - nz * sb; nz = ny * sb + nz * cb; ny = n1;
      }
      // …and the whole leg swings about the hip (a turn of -a about x takes the foot forward)
      const ca = Math.cos(a), sa = Math.sin(a);
      arr[k + 1] = y * ca - zz * sa + hip; arr[k + 2] = y * sa + zz * ca;
      narr[k + 1] = (ny * ca - nz * sa) * 127; narr[k + 2] = (ny * sa + nz * ca) * 127;
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
  };
}

export function legsFor(mesh, { hip, knee, stride = 0.95, swing = 0.55, fold = 0.95, keep = null } = {}) {
  const set = legsOf(mesh, { hip, knee, keep });
  let lastT = null, lastX = 0, lastZ = 0, phase = 0, going = 0, drawn = '';
  return function step(x, z, time) {
    const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, time - lastT));
    const went = lastT === null ? 0 : Math.hypot(x - lastX, z - lastZ);
    lastT = time; lastX = x; lastZ = z;
    const walked = went < 0.5;                                                       // (more than that: it was put there)
    if (walked) phase += (went / stride) * Math.PI * 2;
    going += ((dt > 0 && walked && went / dt > 0.15 ? 1 : 0) - going) * (1 - Math.exp(-dt * 8));
    const key = going < 0.003 ? 'still' : `${going.toFixed(3)}:${phase.toFixed(3)}`;
    if (key === drawn) return going;
    drawn = key;
    const at = (left) => { const p = phase + (left ? 0 : Math.PI); return [-Math.sin(p) * swing * going, Math.max(0, Math.cos(p)) * fold * going]; };
    const [aL, bL] = at(true), [aR, bR] = at(false);
    set(aL, bL, aR, bR);
    return going;
  };
}
