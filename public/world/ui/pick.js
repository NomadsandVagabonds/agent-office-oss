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
    if (best) return { kind: 'agent', id: best.id, person: best };
    if (r.intersectPlane(floor, hit)) {
      const layout = office.world?.layout;
      const roomId = layout ? layout.roomAt(hit.x, hit.z) : null;
      return { kind: 'floor', x: hit.x, z: hit.z, room: roomId ? layout.roomById.get(roomId) : null };
    }
    return null;
  }

  return { at };
}
