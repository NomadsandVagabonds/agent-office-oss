// The Office — the lift's floor panel. A plate of round buttons, one per
// floor in core/levels.mjs (the hidden ones only when their rule says so), a
// display that says where the car is now, and the name of each floor on a
// strip of label tape beside its button. Click one — or arrows and Enter, or
// simply the letter on it; Esc steps back. (It does not say so: lifts do not.)
//
//   const level = await openFloorPanel(office, { current: 'lobby' });   // a level, or null if you stepped back
import { h } from './dom.js';
import { HOME, levelById, levelContext, visibleLevels } from '/core/levels.mjs';

const KIND = { office: 'the office', place: 'a place', game: 'games', work: 'a work module' };
let open = null;

/**
 * @param {object} office
 * @param {{current?:string, parent?:HTMLElement}} [opt]  current: the floor you are on · parent: where to put the panel
 * @returns {Promise<object|null>}  the level whose button was pressed, or null
 */
export function openFloorPanel(office, opt = {}) {
  if (open) return open;
  const here = levelById(opt.current || HOME) || levelById(HOME);
  const levels = visibleLevels(levelContext(office.net?.state?.world));
  const parent = opt.parent || document.getElementById('ui') || document.body;
  let index = Math.max(0, levels.findIndex((l) => l.id === here.id));
  let pressed = false;

  open = new Promise((resolve) => {
    const rows = levels.map((level, i) => {
      const odd = !!level.unmarked;
      const row = h('div.floorrow' + (level.id === here.id ? '.here' : '') + (odd ? '.odd' : ''), {
        role: 'button', title: odd ? '' : `${level.floor} — ${level.name}`,
        onclick: () => press(i), onmouseenter: () => select(i),
      },
      h('span.cap', odd ? '' : level.floor),
      odd ? h('div.plate.blank') : h('div.plate',
        h('b', level.name, level.id === here.id ? h('i.here', 'you are here') : null),
        h('small', level.blurb), h('span.kind', KIND[level.kind] || level.kind)));
      return row;
    });
    const panel = h('div.liftpanel.glass',
      h('div.led', h('b', here.unmarked ? '' : here.floor), h('span', 'this car is at', h('br'), h('strong', here.name))),
      h('div.floors', rows));
    const veil = h('div.liftveil', { onclick: () => finish(null) });
    parent.append(veil, panel);

    function select(i) {
      if (pressed) return;
      index = (i + levels.length) % levels.length;
      rows.forEach((r, k) => r.classList.toggle('on', k === index));
    }
    function press(i) {
      if (pressed) return;
      select(i);
      const level = levels[index];
      if (level.id === here.id) {                            // the button for the floor you are on: it just blinks at you
        rows[index].classList.remove('nudge'); void rows[index].offsetWidth; rows[index].classList.add('nudge');
        return;
      }
      pressed = true;
      rows[index].classList.add('lit');
      setTimeout(() => finish(level), 360);
    }
    function key(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      e.stopPropagation();                                     // while the panel is up, the keyboard is the panel's
      if (e.type !== 'keydown' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Escape') finish(null);
      else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); select(index - 1); }
      else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); select(index + 1); }
      else if (k === 'Enter' || k === ' ' || k === 'e') { e.preventDefault(); press(index); }
      else if (k === 'Tab') e.preventDefault();
      else {
        const i = levels.findIndex((l) => l.floor.toLowerCase().startsWith(k));
        if (i >= 0) press(i);
      }
    }
    function finish(level) {
      if (!open) return;
      open = null;
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
