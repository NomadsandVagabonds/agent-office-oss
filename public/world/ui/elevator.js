// The Office — the lift's panel. A plate of buttons, two to a row, as in any
// lift (core/levels.mjs: PLATE), and above them the car's display. Nothing on
// the plate says what anything is. A button you can press is plain; the one
// for the floor the car is on is lit green; a red one wants a keycard, and
// says so only by buzzing; where a button will be one day there is a blanking
// plate. The display shows the number of whichever button you are on, and —
// once it is a floor you could know — its name, and beside the name of a game
// floor a row of pips (one shaped like a card, one for each coin hidden
// there) that fill in as those are found. Under the plate is the reader, with
// a lamp for every keycard there is: lit for the ones that have been found.
//
// Click a button — or the arrows and Enter, or type what is engraved on it;
// Esc steps back. (It does not say so: lifts do not.)
//
//   const level = await openFloorPanel(office, { current: 'office' });   // a level, or null if you stepped back
import { h } from './dom.js';
import { HOME, levelById, levelContext, panelPlate } from '/core/levels.mjs';
import { HIDEOUTS } from '/core/game.mjs';

let open = null;

/**
 * @param {object} office
 * @param {{current?:string, parent?:HTMLElement}} [opt]  current: the floor you are on · parent: where to put the panel
 * @returns {Promise<object|null>}  the level whose button was pressed, or null
 */
export function openFloorPanel(office, opt = {}) {
  if (open) return open;
  const here = levelById(opt.current || HOME) || levelById(HOME);
  const world = office.net?.state?.world, ctx = levelContext(world), game = world?.game || null;
  const fresh = new Set(ctx.fresh || []), loot = game?.loot || {};
  const parent = opt.parent || document.getElementById('ui') || document.body;
  let index = 0, pressed = false, typed = '', typing = null;

  open = new Promise((resolve) => {
    // every button on the plate, in reading order, with where it sits
    const cells = [];
    const plate = h('div.plate', panelPlate(ctx, here.id).map((row, r) => h('div.prow', row.map((cell, c) => {
      if (!cell) return h('span.bare');
      if (cell.state === 'blank') return h('span.blank', h('i'));
      const k = cells.length, odd = !!cell.level?.unmarked, isNew = cell.state === 'open' && fresh.has(cell.level.id);
      const el = h('button.lbtn.' + cell.state + (odd ? '.odd' : '') + (isNew ? '.fresh' : ''), {
        type: 'button', 'aria-label': odd ? 'An unmarked button' : `Floor ${cell.label}${cell.state === 'locked' ? ', locked' : cell.state === 'here' ? ', this floor' : ''}`,
        onclick: () => press(k), onmouseenter: () => select(k),
      }, h('i'), h('b', odd ? '' : cell.label));
      cells.push({ ...cell, r, c, el, odd, isNew });
      return el;
    }))));
    index = Math.max(0, cells.findIndex((k) => k.state === 'here'));

    // the display: the button you are on; its name if that is something you could know; what it still hides
    const number = h('b'), name = h('span'), marks = h('em');
    const led = h('div.led', number, name, marks);
    const pips = (level) => {
      const l = level.card ? loot[level.id] : null;
      return l ? [h('i.card' + (l.card ? '.got' : '')), ...Array.from({ length: l.of }, (_, i) => h('i' + ((l.coins || []).includes(i + 1) ? '.got' : '')))] : [];
    };
    // the reader: a slot, and a lamp for every keycard in the building — lit, for the ones somebody has found
    const found = Array.isArray(game?.cards) ? game.cards.length : 0;
    const reader = game ? h('div.cardreader', h('span.slot'), h('span.lamps', HIDEOUTS.map((_, i) => h('i' + (i < found ? '.got' : ''))))) : null;
    const panel = h('div.liftpanel', { role: 'dialog', 'aria-label': 'The lift' },
      h('i.screw'), h('i.screw'), h('i.screw'), h('i.screw'), led, plate, reader);
    const veil = h('div.liftveil', { onclick: () => finish(null) });
    parent.append(veil, panel);

    const again = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
    function show() {
      const k = cells[index], known = k.level && k.state !== 'locked' && !k.odd && !k.isNew;
      number.textContent = k.odd ? '' : k.label;
      number.className = k.state === 'locked' ? 'no' : k.state === 'here' ? 'here' : '';
      name.textContent = known ? k.level.name : '';
      marks.replaceChildren(...(known ? pips(k.level) : []));
    }
    function select(i) {
      if (pressed) return;
      index = (i + cells.length) % cells.length;
      cells.forEach((k, n) => k.el.classList.toggle('on', n === index));
      show();
    }
    /** The nearest button a row up or down (or the one beside this one). */
    function step(dr, dc) {
      const at = cells[index];
      if (dc) { const k = cells.findIndex((q) => q.r === at.r && q.c !== at.c); if (k >= 0) select(k); return; }
      for (let r = at.r + dr; r >= 0 && r <= cells[cells.length - 1].r; r += dr) {
        const row = cells.map((q, k) => [q, k]).filter(([q]) => q.r === r);
        if (!row.length) continue;
        select((row.find(([q]) => q.c === at.c) || row[0])[1]);
        return;
      }
    }
    function press(i) {
      if (pressed) return;
      select(i);
      const k = cells[index];
      if (k.state === 'here') { again(k.el, 'nudge'); return; }          // the floor you are on: it just blinks at you
      if (k.state === 'locked') {                                        // no card for that one: the reader says so
        again(k.el, 'nudge'); again(reader, 'nudge');
        try { office.sound?.play?.('lift-denied'); } catch { /* only a sound */ }
        return;
      }
      pressed = true;
      k.el.classList.add('lit');
      setTimeout(() => finish(k.level), 360);
    }
    /** Typing what is engraved: 7 goes at once; 1 waits a moment to see whether it is going to be 11. */
    function type(ch) {
      clearTimeout(typing);
      const label = (k) => (k.odd ? '' : k.label.toLowerCase());
      const begins = (text) => cells.some((k) => label(k).startsWith(text));
      typed = begins(typed + ch) ? typed + ch : begins(ch) ? ch : '';
      if (!typed) return;
      const exact = cells.findIndex((k) => label(k) === typed);
      if (exact >= 0) select(exact);
      if (exact >= 0 && !cells.some((k) => label(k) !== typed && label(k).startsWith(typed))) { typed = ''; press(exact); return; }
      typing = setTimeout(() => { const k = cells.findIndex((q) => label(q) === typed); typed = ''; if (k >= 0) press(k); }, 700);
    }
    function key(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      e.stopPropagation();                                     // while the panel is up, the keyboard is the panel's
      if (e.type !== 'keydown' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Escape') finish(null);
      else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); step(-1, 0); }
      else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); step(1, 0); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd') { e.preventDefault(); step(0, 1); }
      else if (k === 'Enter' || k === ' ' || k === 'e') { e.preventDefault(); clearTimeout(typing); typed = ''; press(index); }
      else if (k === 'Tab') e.preventDefault();
      else if (/^[a-z0-9]$/.test(k)) type(k);
    }
    function finish(level) {
      if (!open) return;
      open = null;
      clearTimeout(typing);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      veil.remove(); panel.remove();
      office.ui?.needs?.cover(false);
      resolve(level);
    }
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    office.ui?.needs?.cover(true);                     // the in-tray waits as a tab while you choose a floor
    select(index);
  });
  return open;
}
