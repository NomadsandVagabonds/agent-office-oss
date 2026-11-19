// The Backrooms — sticky notes stuck on the visitor's own picture, drawn by the hand's view (hand.js) as the held things
// are: flat in front of the lens, over the room. Where each one is comes from hand-notes.rule.js; when one sticks and
// when it goes is the cast's (env.hand.stick / unstick). Two quads a note: the glued top half, and the free bottom half
// on a fold, so it can curl and peel. Nothing random.
import * as THREE from 'three';
import { Batch } from './kit.js';
import { NOTE, stuckPose, offPose, placed } from './hand-notes.rule.js';

const MAX = 8;          // (more than a room has: 4–6; one more is let go of the oldest)

/** → { group, stick, unstick, any, update, dispose }. draw: { mine() is this part's hand the one on the picture, before(renderer), after(renderer) } (hand.js) */
export function createStuckNotes(kit, camera, draw = {}) {
  const group = new THREE.Group(), notes = new Map(), colour = new THREE.Color();
  group.name = 'stuck-notes';
  // one texture for all of them, tinted: paper a touch lighter at the glued edge, a faint shadow under the fold
  // (written on, as the note on the wall is: cast/sticky-notes.model.js, its glue strip and three lines of scribble on an 8 × 8 grid)
  const tex = kit.tex.custom('hand:sticky-note:v2', 32, 32, (g) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 8);
    g.fillStyle = '#2a2f4a';
    for (let line = 0; line < 3; line++) {
      const y = (2 + line * 2) * 4 + 1, end = 8 - 1 - (line % 3);
      for (let x = 1; x < end; x++) if ((x * 7 + line * 3) % 5 !== 0) g.fillRect(x * 4, y, 4, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 31, 32, 1); g.fillRect(31, 0, 1, 32);
  }, { clamp: true });
  const h = NOTE.size / 2;
  const half = (top) => {
    const b = new Batch(), y0 = top ? 0 : -NOTE.size / 2, y1 = top ? NOTE.size / 2 : 0, v0 = top ? 0.5 : 0, v1 = top ? 1 : 0.5;
    // (the bottom half's quad hangs below its own origin, the fold)
    b.quad([-h, y0, 0], [h, y0, 0], [h, y1, 0], [-h, y1, 0], undefined, [[0, v0], [1, v0], [1, v1], [0, v1]]);
    return kit.geometry(b, [], [1, 1, 1]);
  };
  const topGeo = half(true), bottomGeo = half(false);
  const front = (m) => {
    m.renderOrder = 10001;                                   // (over the room, and over what is held: it is on the lens)
    m.onBeforeRender = (renderer) => { if (!draw.mine || draw.mine()) draw.before?.(renderer); };
    m.onAfterRender = (renderer) => draw.after?.(renderer);
  };

  function make(id) {
    const mat = kit.surface({ map: tex, side: THREE.DoubleSide }); mat.transparent = true;
    mat.setHeldInFront?.(draw.sliver ?? 0.002);
    const g = new THREE.Group(), top = new THREE.Mesh(topGeo, mat), fold = new THREE.Group(), bottom = new THREE.Mesh(bottomGeo, mat);
    front(top); front(bottom); fold.add(bottom); g.add(top, fold); group.add(g);
    return { id, g, fold, mat, spot: placed(), colour: '#f4e04d', t: 0, off: null, dir: 0 };
  }
  function drop(n) { n.g.removeFromParent(); n.mat.dispose(); notes.delete(n.id); }

  return {
    group,
    /** One has landed on the lens: { u, v, turn, colour }. The same id again moves it there afresh. */
    stick(id, spot = {}) {
      let n = notes.get(id);
      if (!n) {
        if (notes.size >= MAX) drop(notes.values().next().value);
        n = make(id); notes.set(id, n);
      }
      n.spot = placed(spot); n.colour = spot.colour || spot.color || n.colour; n.t = 0; n.off = null; n.dir = 0;
    },
    /** It is taken off: how 'wiped' | 'swatted' | 'burnt' | 'fell'; dir for a swat (−1 / +1). Not stuck: nothing. */
    unstick(id, how = 'fell', dir) {
      const n = notes.get(id); if (!n || n.off) return;
      n.off = how; n.t = 0; n.dir = dir;
    },
    /** Is any on the lens, or still going? */
    any: () => notes.size > 0,
    /** Every frame the hand is drawn. light: [r, g, b] where the visitor stands. */
    update(dt, light) {
      const P = camera.projectionMatrix.elements, ax = P[0] || 1, ay = P[5] || 1, d = NOTE.depth;
      for (const n of [...notes.values()]) {
        n.t += dt;
        const p = n.off ? offPose(n.off, n.t, n.spot, n.dir) : stuckPose(n.t, n.spot);
        if (!p) { drop(n); continue; }
        n.g.position.set(p.u * d / ax, p.v * d / ay, -d);
        n.g.rotation.set(0, 0, p.turn);
        n.g.scale.setScalar(p.scale);
        n.fold.rotation.x = p.curl * 1.1;                   // (the free half lifts off the lens, toward it)
        n.g.position.z += p.curl * 0.004;
        colour.set(n.colour);
        const L = light || [1, 1, 1], lit = 1 - 0.82 * p.dark;
        n.mat.uniforms.uTint.value.set(
          colour.r * Math.max(0.3, L[0] * 1.3) * lit, colour.g * Math.max(0.3, L[1] * 1.3) * lit * (1 - 0.2 * p.dark), colour.b * Math.max(0.3, L[2] * 1.3) * lit * (1 - 0.4 * p.dark));
      }
    },
    /** The part is gone. */
    dispose() { for (const n of [...notes.values()]) drop(n); group.removeFromParent(); },
  };
}
