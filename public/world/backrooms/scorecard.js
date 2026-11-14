// Out of Office — the card at the end. However a visit ends, somebody is told
// how it went: what they did down there, what it scored, what was new to this
// office, what the jar gained, and whether the tape was kept. Nobody hands it
// to them. It is on the wall: printed into the wallpaper in the wallpaper's
// own ink, the way the place prints everything it makes, with a strip of
// somebody's painter's tape across the corner saying how it ended.
//
//   const card = await showScorecard({ office, reason, kept, run, name });
//
// reason, kept and run are what the visit resolves with (index.js). The rules
// are not here: what a visit scored and what is kept of it is core/runs.mjs,
// and what was carried out is worth what core/game.mjs says. The office keeps
// the record (office.game.report); where there is no office to ask — the
// level's own page — this keeps one of its own in the browser, by the same
// rules, so the card is the same card.
import { cleanRecord, cleanRun, emptyRecord, settleRun } from '/core/runs.mjs';
import { payFor } from '/core/game.mjs';

const HIDEOUT = 'backrooms', KEPT = 'office-backrooms:record';

/* ---- pictures: small enough to draw by hand, one character a pixel -------------------------- */

// (each letter is a colour of the thing itself; on the wall they are printed in three inks: dark, mid and pale)
const INK = { k: 'D', d: 'D', o: 'D', r: 'D', w: 'P', l: 'P', s: 'P', g: 'M', y: 'M', p: 'M', n: 'M', b: 'M' };
const PRINT = { D: '#4a3a10', M: '#9c7f24', P: '#f2e7ab' };
const ICONS = {
  room: ['.kkkkkkk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwydk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwwdk.', 'kkkkkkkkk'],
  kind: ['....o....', '....o....', '...ooo...', 'ooooooooo', '.ooooooo.', '..ooooo..', '.ooo.ooo.', '.oo...oo.', 'o.......o'],
  part: ['kkk......', 'kgk......', 'kgkkk....', 'kgggk....', 'kgggkkk..', 'kgggggk..', 'kgggggkkk', 'kgggggggk', 'kkkkkkkkk'],
  survived: ['..kkkkk..', '.kkkkkkk.', 'kkkwkwkkk', '.kkkkkkk.', '.nlnnnln.', '.nkwnwkn.', '.nnnnnnn.', '..nkkkn..', '...nnn...'],
  out: ['.kkkkkk..', '.kllllk..', '.kllllk.k', '.kllllkkk', '.klllkkkk', '.kllllkkk', '.kllllk.k', '.kllllk..', '.kkkkkk..'],
  pace: ['...kkk...', '....k....', '..kkkkk..', '.kwwkwwk.', 'kwwwkwwwk', 'kwwwkkkwk', 'kwwwwwwwk', '.kwwwwwk.', '..kkkkk..'],
  card: ['....k....', '...k.k...', '....k....', 'kkkkkkkkk', 'kbbbbbbbk', 'kwwwwwwwk', 'kwkkwgggk', 'kwkkwgggk', 'kkkkkkkkk'],
  battery: ['...kkk...', '..kkkkk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..kkkkk..'],
  heart: ['.........', '.rr...rr.', 'rprr.rrrr', 'rprrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....'],
  coin: ['..kkkkk..', '.kyyyyyk.', 'kyyoooyyk', 'kyoyyyyyk', 'kyoyyyyyk', 'kyoyyyyyk', 'kyyoooyyk', '.kyyyyyk.', '..kkkkk..'],
  tape: ['.........', 'kkkkkkkkk', 'kdddddddk', 'kdwwdwwdk', 'kdwkdkwdk', 'kdwwdwwdk', 'kdddddddk', 'kkgggggkk', 'kkkkkkkkk'],
  fresh: ['....o....', '.o..o..o.', '..o.o.o..', '...ooo...', 'oooowoooo', '...ooo...', '..o.o.o..', '.o..o..o.', '....o....'],
};

/** One of the pictures, as an <svg> that stays sharp at any size. */
function icon(id, title) {
  const rows = ICONS[id] || ICONS.fresh, n = rows.length, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`); svg.setAttribute('class', 'brc-ic'); svg.setAttribute('shape-rendering', 'crispEdges');
  if (title) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title); } else svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = PRINT[INK[row[x]]]; if (!c) continue; const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1.02); r.setAttribute('height', 1.02); r.setAttribute('fill', c); svg.append(r); } });
  return svg;
}

/* ---- what the form says ---------------------------------------------------------------------- */

// How it ended, in the words of whoever stuck the tape up.
const ENDED = { exit: 'BACK AT YOUR DESK', caught: 'INDEFINITELY', battery: 'BATTERY FLAT', quit: 'LEFT EARLY' };
const LINES = {
  room: 'Rooms walked into', kind: 'Rooms worth mentioning', part: 'Parts of the building', survived: 'Got away from',
  out: 'Left by the way out', pace: 'Time on the tape', card: 'Keycard brought back', battery: 'Spare batteries', heart: 'Still in one piece',
};
const num = (n) => Number(n || 0).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// The wall: the yellow paper the place is hung with (its stripe and its small diamond, seams a roll's width apart), a tube
// somewhere overhead, the skirting and a strip of carpet under it — seen the way everything down there is seen, on tape.
const DIAMOND = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpath d='M22 15l4 7-4 7-4-7z' fill='none' stroke='%23b99f3c' stroke-opacity='.5' stroke-width='1.3'/%3E%3C/svg%3E\")";
const CSS = `
.brc-veil { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; overflow: auto; box-sizing: border-box; padding: 20px 16px 13vh;
  color: #4a3a10; font: 500 14px/1.4 "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif; font-variant-numeric: tabular-nums;
  background:
    linear-gradient(180deg, transparent calc(100% - 11vh), #5b4127 calc(100% - 11vh), #6d4f31 calc(100% - 10.4vh), #5b4127 calc(100% - 7.6vh), #2f2413 calc(100% - 7.6vh), #2f2413 calc(100% - 7.2vh), #6f6a50 calc(100% - 7.2vh), #5f5a44 100%),
    radial-gradient(120% 70% at 50% -12%, rgba(255,252,224,.55), rgba(255,252,224,0) 62%),
    radial-gradient(140% 120% at 50% 45%, rgba(0,0,0,0) 55%, rgba(40,30,0,.38) 100%),
    repeating-linear-gradient(90deg, rgba(74,58,16,.16) 0 1px, transparent 1px 264px),
    ${DIAMOND},
    repeating-linear-gradient(90deg, rgba(185,159,60,.2) 0 3px, transparent 3px 22px),
    #d6c56c; }
.brc-veil::after { content: ''; position: fixed; inset: 0; pointer-events: none; mix-blend-mode: multiply; opacity: .5;
  background: repeating-linear-gradient(0deg, rgba(40,30,0,.16) 0 1px, transparent 1px 3px); }
.brc-wrap { position: relative; width: min(100%, 34em); }
.brc-form { position: relative; box-sizing: border-box; padding: .4em .2em 0; outline: none; mix-blend-mode: multiply;
  text-shadow: .6px .4px 0 rgba(242,231,171,.55); animation: brc-in .9s ease-out both; }
.brc-over { font-size: .78em; letter-spacing: .34em; font-weight: 700; opacity: .8; }
.brc-title { font-size: 2.9em; line-height: 1; font-weight: 700; letter-spacing: -.02em; margin: .08em 0 .5em; }
.brc-rows { display: grid; grid-template-columns: 1.7em 1fr auto auto; column-gap: .75em; row-gap: .3em; align-items: center; }
.brc-rows .n { text-align: right; opacity: .8; min-width: 3.4em; }
.brc-rows .p { text-align: right; min-width: 3.8em; font-weight: 700; }
.brc-rows .zero { opacity: .42; }
.brc-ic { width: 1.6em; height: 1.6em; display: block; }
.brc-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: .65em; padding-top: .45em; border-top: 2px solid currentColor; }
.brc-total span:first-child { font-size: .85em; letter-spacing: .3em; font-weight: 700; }
.brc-total span:last-child { font-size: 2.3em; font-weight: 700; letter-spacing: -.01em; line-height: 1; }
.brc-best { text-align: right; font-size: .82em; letter-spacing: .14em; font-weight: 700; opacity: .75; margin-top: .25em; }
.brc-best.new { opacity: 1; }
.brc-box { margin-top: .9em; padding-top: .7em; border-top: 1px dashed currentColor; display: grid; grid-template-columns: 1.7em 1fr auto; column-gap: .75em; row-gap: .32em; align-items: center; }
.brc-box .v { text-align: right; white-space: nowrap; display: flex; align-items: center; gap: .38em; justify-content: flex-end; font-weight: 700; }
.brc-box .v .brc-ic { width: 1.25em; height: 1.25em; }
.brc-box small { grid-column: 2 / -1; font-size: .84em; opacity: .7; margin-top: -.22em; }
.brc-seed { font-weight: 500 !important; opacity: .85; overflow: hidden; text-overflow: ellipsis; max-width: 13em; }
.brc-foot { margin-top: 1.1em; font-size: .68em; letter-spacing: .3em; font-weight: 700; opacity: .5; }
.brc-tape { position: absolute; right: -.6em; top: .5em; padding: .32em 1.1em .3em; background: #3f74c4; color: #f6f2df; font-size: .98em; font-weight: 700; letter-spacing: .12em; white-space: nowrap;
  transform: rotate(5deg); filter: drop-shadow(0 2px 2px rgba(40,30,0,.35)); opacity: .97;
  clip-path: polygon(0 12%, 2% 0, 4% 14%, 6% 2%, 100% 0, 98% 22%, 100% 44%, 98% 64%, 100% 100%, 5% 100%, 3% 86%, 1% 100%, 0 80%, 2% 60%, 0 40%);
  animation: brc-tape .28s .7s cubic-bezier(.2,1.5,.4,1) both; }
.brc-go { position: absolute; right: .2em; bottom: -.1em; opacity: 0; color: #4a3a10; animation: brc-blink 1.1s 1.5s steps(1) infinite; }
@keyframes brc-in { from { opacity: 0; } }
@keyframes brc-tape { from { opacity: 0; transform: rotate(5deg) translateY(-10px) scale(1.15); } }
@keyframes brc-blink { 0% { opacity: .8; } 50% { opacity: 0; } }
@media (max-width: 30em) { .brc-veil { font-size: 12.5px; padding: 14px 14px 13vh; } .brc-title { font-size: 2.4em; } .brc-tape { font-size: .88em; right: -.3em; top: .1em; } }
@media (prefers-reduced-motion: reduce) { .brc-form, .brc-tape { animation: none; } .brc-go { animation: none; opacity: .8; } }
`;

const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };

/** The card, printed on the wall. → the element (not yet shown). */
function draw(card, who) {
  const out = card.reason === 'exit', ended = ENDED[card.reason] || ENDED.quit;
  const rows = el('div', 'brc-rows');
  for (const l of card.lines) {
    const zero = !l.points ? ' zero' : '';
    rows.append(icon(l.id), el('span', zero.trim(), LINES[l.id] || l.id),
      el('span', `n${zero}`, l.id === 'pace' ? clock(l.count) : l.id === 'out' ? '' : `× ${num(l.count)}`), el('span', `p${zero}`, num(l.points)));
  }
  const box = el('div', 'brc-box');
  // what the jar gained: only for more than the office has been paid for before
  if (out) {
    const c = card.coins || { carried: 0, worth: 0, paid: 0, best: 0 };
    box.append(icon('coin'), el('span', '', 'Paid into the jar'), el('span', 'v', icon('battery', 'spare batteries'), `× ${num(c.carried)}`, '→', icon('coin', 'coins'), `+ ${num(c.paid)}`));
    if (c.worth > 0 && !c.paid) box.append(el('small', '', `The jar has been paid for ${num(c.best)} before. Bring out more than that.`));
  }
  // what was new to this office
  const fresh = card.fresh || { rooms: [], cast: [] }, seen = card.seen || { rooms: 0, cast: 0 };
  box.append(icon('fresh'), el('span', '', 'New to this office'), el('span', 'v', icon('room', 'kinds of room'), `+ ${num(fresh.rooms.length)}`, icon('survived', 'residents'), `+ ${num(fresh.cast.length)}`));
  box.append(el('small', '', `On record: ${num(seen.rooms)} kind${seen.rooms === 1 ? '' : 's'} of room, ${num(seen.cast)} resident${seen.cast === 1 ? '' : 's'}.`));
  // the tape
  box.append(icon('tape'), el('span', '', card.tape?.kept ? 'Tape kept' : 'Tape not recovered'), el('span', 'v brc-seed', card.tape?.kept ? `№ ${card.tape.seed}` : '—'));
  if (!card.tape?.kept) box.append(el('small', '', 'That building is gone.'));

  const form = el('div', 'brc-form',
    el('div', 'brc-over', 'AGENT OFFICE'),
    el('div', 'brc-title', 'Out of Office'),
    rows,
    el('div', 'brc-total', el('span', '', 'POINTS'), el('span', '', num(card.score))),
    el('div', `brc-best${card.best?.beaten ? ' new' : ''}`, card.best?.beaten ? (card.best.was ? `THE BEST YET · WAS ${num(card.best.was)}` : 'THE BEST YET') : `BEST ${num(card.best?.score)}`),
    box,
    el('div', 'brc-foot', `PATTERN 13/B · ${String(who || '').toUpperCase().slice(0, 24)}`));
  form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true'); form.setAttribute('aria-label', `Out of Office, ${ended.toLowerCase()}: ${num(card.score)} points`); form.tabIndex = -1;
  // (the tape is somebody's, not the wall's: it sits on the paper, and is not printed into it)
  return el('div', 'brc-veil', el('div', 'brc-wrap', form, el('div', 'brc-tape', ended), el('div', 'brc-go', '▸')));
}

/* ---- the record, where there is no office to keep it ------------------------------------------ */

function local(report, who) {
  let kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEPT) || 'null'); } catch { /* nothing remembered */ }
  const record = cleanRecord(kept?.record || emptyRecord()), earned = Math.max(0, Math.floor(Number(kept?.earned) || 0));
  const run = cleanRun(report), settled = settleRun(record, run, { at: Date.now(), by: who });
  const worth = run.reason === 'exit' ? payFor({ batteries: run.batteries }) : 0, paid = Math.max(0, worth - earned);
  try { localStorage.setItem(KEPT, JSON.stringify({ record: settled.record, earned: Math.max(earned, worth) })); } catch { /* until the page closes, then */ }
  return { ...settled.card, coins: { carried: run.batteries, worth, paid, best: Math.max(earned, worth) } };
}

/**
 * Show the card for a visit that is over, and resolve when it has been put down (any key, a click, a tap).
 * @param {{office?:object, reason:string, kept?:object, run?:object, name?:string}} o
 *        run: { seed, seconds, parts: { reached, of }, rooms: { explored, kinds }, cast: { met, survived }, hearts? } — what index.js counted
 * @returns {Promise<object>} the card as it was shown (core/runs.mjs: settleRun, with `coins`)
 */
export async function showScorecard(o = {}) {
  const who = o.name || o.office?.walk?.me?.name || 'Visitor';
  const report = { ...(o.run || {}), reason: o.reason, batteries: o.kept?.batteries || 0, card: !!o.kept?.card };
  let card = null;
  if (o.office?.game?.report) card = await o.office.game.report(HIDEOUT, report);
  if (!card) card = local(report, who);

  const root = document.getElementById('ui') || document.body;
  const style = el('style', '', CSS), veil = draw(card, who), form = veil.querySelector('.brc-form');
  document.head.append(style); root.append(veil);
  try { form.focus({ preventScroll: true }); } catch { /* it will take a click, then */ }
  await new Promise((done) => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 900);                    // nobody puts it down before they have seen it
    const put = (e) => {
      if (!armed || (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key))) return;
      e.preventDefault(); e.stopPropagation();
      clearTimeout(arm); window.removeEventListener('keydown', put, true); veil.removeEventListener('pointerup', put);
      veil.remove(); style.remove(); done();
    };
    window.addEventListener('keydown', put, true); veil.addEventListener('pointerup', put);
  });
  return card;
}
