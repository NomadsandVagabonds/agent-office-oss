import { toLocal } from '../backrooms/gen.js';
import { verifyBridgePlan } from '../backrooms/bridge-puzzles.js';

export function bridgeStudy(handle) {
  const world = handle.world, rt = world.rooms.find(r => r.bridgeStudy);
  if (!rt) return () => {};
  const { main, bank, stand } = rt.bridgeStudy, el = document.createElement('aside');
  el.dataset.lightingStudy = '';
  Object.assign(el.style, { position: 'fixed', left: '10px', top: '10px', zIndex: 100, background: '#131811e8', color: '#ececd9', padding: '12px', font: '12px monospace', maxWidth: '230px' });
  const title = document.createElement('strong'); title.textContent = 'MOVABLE BRIDGES · STUDY'; el.append(title);
  const note = document.createElement('p'); note.textContent = 'E: hold / release. Walk to drag. R (or tap its prompt): lower / raise. Move the tall panel half a metre toward the ditch first. The short panel cannot span it.'; el.append(note);
  const button = (label, action) => { const b = document.createElement('button'); b.textContent = label; b.style.display = 'block'; b.style.margin = '6px 0'; b.onclick = action; el.append(b); };
  button('Stand behind panel', () => {
    const p = main ? toLocal(rt.def, main.hinge.x, main.hinge.z) : stand;
    handle.goto(rt.id, p.x, p.z + .6, 0, main?.deployed ? -1 : 0);
  });
  button('Far bank', () => handle.goto(rt.id, -.5, -2, Math.PI, -1));
  button('Side view', () => handle.goto(rt.id, -2.7, .2, -Math.PI / 2, -.2));
  button('Restart study', () => location.reload());
  const status = document.createElement('p'); el.append(status); document.body.append(el);
  const verified = rt.bridgePlans?.[0] && verifyBridgePlan(world, rt, rt.bridgePlans[0]);
  const timer = setInterval(() => {
    if (handle.world !== world) { status.textContent = 'Floor changed. Reload to return.'; return; }
    const p = main ? toLocal(rt.def, main.hinge.x, main.hinge.z) : bank;
    const me = handle.where();
    status.textContent = main ? `${main.transition ? 'Lowering / raising' : main.deployed ? 'Walkable bridge' : 'Upright'} · hinge ${p.x.toFixed(2)}, ${p.z.toFixed(2)} · initial drag solution ${verified ? 'verified' : 'unavailable'} · visitor ${me.x}, ${me.z}` : 'Furniture disabled';
  }, 150);
  return () => { clearInterval(timer); el.remove(); };
}
