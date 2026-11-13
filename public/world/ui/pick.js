// The Office — what is under the cursor. People are tested as simple upright
// capsules (fast, and forgiving to click); otherwise it is the floor, and the
// room that floor belongs to.
import * as THREE from 'three';

export function createPicker(office) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function setRay(clientX, clientY) {
    const r = office.stage.renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, office.stage.camera);
    return ray.ray;
  }

  /** Distance along the ray to an upright cylinder at (x, z), or Infinity. */
  function hitPerson(r, x, z, radius, top) {
    const ox = r.origin.x - x, oz = r.origin.z - z, dx = r.direction.x, dz = r.direction.z;
    const a = dx * dx + dz * dz;
    if (a < 1e-9) return Infinity;
    const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return Infinity;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return Infinity;
    const y = r.origin.y + r.direction.y * t;
    return y >= -0.05 && y <= top ? t : Infinity;
  }

  function at(clientX, clientY) {
    const r = setRay(clientX, clientY);
    let best = null, bestT = Infinity;
    // be generous when zoomed out: people are only a few pixels wide
    const radius = 0.34 + Math.min(1.1, office.rig.cur.dist * 0.012);
    for (const person of office.people?.people.values() || []) {
      if (!person.place) continue;
      const t = hitPerson(r, person.pos.x, person.pos.z, radius, 1.7);
      if (t < bestT) { bestT = t; best = person; }
    }
    const cat = office.cat?.pos;
    if (cat) {
      const t = hitPerson(r, cat.x, cat.z, 0.3 + Math.min(0.6, office.rig.cur.dist * 0.01), 0.5);
      if (t < bestT) return { kind: 'cat', x: cat.x, z: cat.z };
    }
    const ghost = office.ghost;
    if (ghost && hitPerson(r, ghost.x, ghost.z, 0.45, 1.2) < bestT) return { kind: 'ghost' };
    if (best) return { kind: 'agent', id: best.id, person: best };
    const duck = office.duck;
    if (duck && hitPerson(r, duck.x, duck.z, 0.16, duck.y + 0.25) < Infinity) return { kind: 'duck', x: duck.x, z: duck.z };
    // a thing you can use: the nearest box the ray enters
    const unlocked = !!office.net.state.world?.plan?.unlocked?.backroom;
    let thing = null, thingT = Infinity;
    for (const b of office.world?.furniture.hitBoxes() || []) {
      if (b.poi.hidden && !unlocked) continue;
      if (!r.intersectBox(b.box, hit)) continue;
      const t = hit.distanceTo(r.origin);
      if (t < thingT) { thingT = t; thing = b; }
    }
    if (thing) return { kind: 'thing', object: thing.object, poi: thing.poi };
    if (r.intersectPlane(floor, hit)) {
      const layout = office.world?.layout;
      const roomId = layout ? layout.roomAt(hit.x, hit.z) : null;
      return { kind: 'floor', x: hit.x, z: hit.z, room: roomId ? layout.roomById.get(roomId) : null };
    }
    return null;
  }

  return { at };
}
