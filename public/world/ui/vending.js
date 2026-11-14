// The Office — the vending machine, from the front. Behind the glass, on
// three shelves: everything the office's coins can buy (core/game.mjs), each
// with the code of its place and what it costs. Beside the glass: what is in
// the jar, a keypad, and the key that makes it drop. What comes out lands in
// the tray with its tag on, and stands on the shelf beside the machine from
// then on (scene/prizes.js). The last place on the bottom row is what the
// machine has always given away.
//
// Click a thing or type its code; Enter, or the wide key, buys it; Esc steps
// back. (It does not say so. Machines like this never do.)
//
//   await openVending({ office });      // resolves when you step away
import { h } from './dom.js';
import { PRIZES } from '/core/game.mjs';
import { PRIZE_MODELS } from '../props/prizes.js';
import { rgbOf, isGlass, isGlow } from '../vox/vox.js';

const FREE = { id: 'snack', slot: 'C3', price: 0, name: 'Whatever is at the bottom' };
const ROWS = ['A', 'B', 'C'], COLS = ['1', '2', '3'];
let open = null;

/** A voxel model seen from the front, one square per voxel: what is nearer covers what is behind, glass tints it. */
export function picture(make, px = 4) {
  const vox = make(), b = vox.bounds(), cells = [];
  vox.each((x, y, z, v) => cells.push([z, x, y, v]));
  cells.sort((p, q) => p[0] - q[0]);
  const c = document.createElement('canvas');
  c.width = Math.max(1, (b.x1 - b.x0) * px); c.height = Math.max(1, (b.y1 - b.y0) * px);
  const g = c.getContext('2d');
  for (const [z, x, y, v] of cells) {
    const rgb = rgbOf(v), k = isGlow(v) ? 1.06 : !vox.has(x, y + 1, z) ? 1.14 : !vox.has(x, y - 1, z) ? 0.8 : 1;       // lit from above
    g.globalAlpha = isGlass(v) ? 0.45 : 1;
    g.fillStyle = `rgb(${Math.min(255, ((rgb >> 16) & 255) * k) | 0}, ${Math.min(255, ((rgb >> 8) & 255) * k) | 0}, ${Math.min(255, (rgb & 255) * k) | 0})`;
    g.fillRect((x - b.x0) * px, (b.y1 - 1 - y) * px, px, px);
  }
  return c;
}

/**
 * @param {{office: object}} o
 * @returns {Promise<void>}  when the person steps away from the machine
 */
export function openVending({ office }) {
  if (open) return open;
  const net = office.net, parent = document.getElementById('ui') || document.body;
  const game = () => net.state.world?.game || {};
  const credit = () => game().coins?.have ?? 0;
  const sold = (s) => s.id !== 'snack' && (game().prizes || []).includes(s.id);
  const slots = [...PRIZES, FREE].sort((p, q) => (p.slot < q.slot ? -1 : 1));
  let pick = null, half = '', busy = false;

  open = new Promise((resolve) => {
    const els = new Map();
    const rows = ROWS.map((r) => h('div.vrow', slots.filter((s) => s.slot[0] === r).map((s) => {
      const el = h('button.vslot' + (sold(s) ? '.sold' : ''), { type: 'button', title: sold(s) ? '' : s.name, onclick: () => select(s.slot) },
        h('span.vcoil'),
        h('span.vitem', PRIZE_MODELS[s.id] && !sold(s) ? picture(PRIZE_MODELS[s.id], s.id === 'snack' ? 5 : 4) : null),
        h('span.vtag', h('b', s.slot), h('span', h('i.coin'), String(s.price))));
      els.set(s.slot, el);
      return el;
    })));
    const purse = h('b'), line = h('span');
    const display = h('div.vdisplay', h('div.jar', h('i.coin'), purse), line);
    const go = h('button.vkey.go', { type: 'button', 'aria-label': 'Buy', onclick: () => vend() }, h('i'));
    const keys = h('div.vkeys', [...ROWS, ...COLS].map((k) => h('button.vkey', { type: 'button', onclick: () => type(k) }, k)), go);
    const tray = h('div.vtray', h('span.flap'));
    const machine = h('div.vend', { role: 'dialog', 'aria-label': 'The vending machine' },
      h('div.vbrand', 'BYTES'),
      h('div.vbody', h('div.vwindow', rows), h('div.vside', display, keys, h('div.vcoin', h('i')))),
      h('div.vstripe'), tray);
    const veil = h('div.liftveil', { onclick: () => finish() });
    parent.append(veil, machine);

    const slotOf = (code) => slots.find((s) => s.slot === code) || null;
    function show() {
      purse.textContent = String(credit());
      const s = pick ? slotOf(pick) : null;
      line.replaceChildren(...(s ? [h('b', s.slot), sold(s) ? h('em', '– –') : h('span.cost' + (s.price > credit() ? '.short' : ''), h('i.coin'), String(s.price))] : half ? [h('b', half + '_')] : []));
      for (const [code, el] of els) el.classList.toggle('on', code === pick);
      go.classList.toggle('armed', !!s && !sold(s) && s.price <= credit() && !busy);
    }
    function select(code) { if (busy || !slotOf(code)) return; pick = code; half = ''; show(); }
    function type(k) {
      if (busy) return;
      if (ROWS.includes(k)) { half = k; pick = null; show(); } else if (half && COLS.includes(k)) select(half + k);
      else if (COLS.includes(k) && pick) select(pick[0] + k);
    }
    function step(dx, dy) {
      const at = pick || 'A1', r = ROWS.indexOf(at[0]), c = COLS.indexOf(at[1]);
      select(ROWS[(r + dy + 3) % 3] + COLS[(c + dx + 3) % 3]);
    }
    const no = (el) => { el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); };

    async function vend() {
      const s = pick ? slotOf(pick) : null;
      if (busy) return;
      if (!s || sold(s) || s.price > credit()) { no(display); return; }
      busy = true; show();
      const el = els.get(s.slot), item = el.querySelector('.vitem');
      el.classList.add('turning');
      try { office.sound?.play?.('vend'); } catch { /* only a sound */ }
      let slip;
      try {
        const name = office.walk?.me?.name || 'Lead';
        if (s.id === 'snack') {
          const r = await net.api('/api/world/lead/use', { method: 'POST', body: { id: office.walk?.me?.id, name, thing: 'vending' } });
          office.onUsed?.({ thing: 'vending', kind: 'vending' }, r);
          slip = h('div.vslip', h('span', r.text || ''));
        } else {
          const r = await net.api('/api/world/game/buy', { method: 'POST', body: { prize: s.id, name } });
          if (net.state.world && r?.open) net.state.world.game = { ...game(), ...r };       // the bus says the same a moment later
          slip = h('div.vslip', h('b', s.name), h('span', s.blurb));
        }
      } catch (err) {
        el.classList.remove('turning'); busy = false; no(display); show();
        console.warn('[vending]', err.message);
        return;
      }
      await wait(520);
      // out of its coil and down behind the glass
      const fall = tray.getBoundingClientRect().top - item.getBoundingClientRect().top;
      item.style.transition = 'transform .5s cubic-bezier(.55, 0, 1, .55)';
      item.style.transform = `translateY(${Math.max(0, fall)}px)`;
      await wait(520);
      el.classList.remove('turning');
      const got = h('div.got', picture(PRIZE_MODELS[s.id], s.id === 'snack' ? 6 : 5), slip);
      tray.replaceChildren(h('span.flap.open'), got);
      if (s.id === 'snack') { item.style.transition = 'none'; item.style.transform = ''; } else { el.classList.add('sold'); el.title = ''; item.replaceChildren(); item.style.transform = ''; }
      office.prizes?.sync();
      busy = false; pick = s.id === 'snack' ? pick : null;
      show();
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    function key(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      e.stopPropagation();                                     // while you stand at the machine, the keyboard is the machine's
      if (e.type !== 'keydown' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (k === 'Escape') finish();
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); vend(); }
      else if (k === 'ArrowLeft') { e.preventDefault(); step(-1, 0); } else if (k === 'ArrowRight') { e.preventDefault(); step(1, 0); }
      else if (k === 'ArrowUp') { e.preventDefault(); step(0, -1); } else if (k === 'ArrowDown') { e.preventDefault(); step(0, 1); }
      else if (k === 'Tab') e.preventDefault();
      else type(k);
    }
    // somebody else at the machine, in another window: what they bought is gone from this one too
    const off = net.on?.('world', () => {
      if (busy) return;
      for (const s of slots) { const el = els.get(s.slot); if (sold(s) && !el.classList.contains('sold')) { el.classList.add('sold'); el.title = ''; el.querySelector('.vitem').replaceChildren(); } }
      show();
    });
    function finish() {
      if (!open) return;
      open = null;
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      if (typeof off === 'function') off();
      veil.remove(); machine.remove();
      office.ui?.needs?.cover(false);
      resolve();
    }
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    office.ui?.needs?.cover(true);                     // the in-tray waits as a tab while you are at the machine
    show();
  });
  return open;
}
