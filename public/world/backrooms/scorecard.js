// Out of Office — the card at the end. However a visit ends, somebody is told
// how it went: what they did down there, what it scored, what was new to this
// office, what the jar gained, and whether the tape was kept (or, of a kept
// tape played back, that it was one). Nobody hands it to them. It is on the
// wall: printed into the wallpaper in the wallpaper's own ink, the way the
// place prints everything it makes.
//
//   const card = await showScorecard({ office, reason, kept, run, name });
//
// A page that is not the office may give the card its own heading (`brand`),
// say where a kept tape can be found again (`share`: the number on the card
// is then a link to it, and choosing it is asking to walk it again), and add
// a line of its own once it knows what to say (`also`: the site's book). A
// `home` action keeps the card up until its return button or a tape is chosen.
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

// How it ended, for whoever is having the wall read to them. (The wall itself does not say: what is printed on it does.)
const ENDED = { exit: 'back at your desk', caught: 'indefinitely', battery: 'battery flat', quit: 'left early' };
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
.brc-veil { position: fixed; inset: 0; z-index: 400; display: grid; place-items: center; overflow: auto; box-sizing: border-box; padding: 20px 16px 13vh;
  color: #4a3a10; font: 500 clamp(14px, 1.15vw + .4vh, 20px)/1.4 "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif; font-variant-numeric: tabular-nums;
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
a.brc-seed, a.brc-more { color: inherit; text-decoration: underline dotted; text-underline-offset: .22em; cursor: pointer; }
a.brc-seed:focus-visible, a.brc-more:focus-visible { outline: 2px solid currentColor; outline-offset: .15em; }
.brc-foot { margin-top: 1.1em; font-size: .68em; letter-spacing: .3em; font-weight: 700; opacity: .5; }
.brc-actions { display: flex; justify-content: flex-end; margin-top: 1.1em; }
.brc-home { min-height: 44px; padding: .65em 1em; border: 1px solid #4a3a10; border-radius: 0;
  background: #4a3a10; color: #f2e7ab; font: inherit; font-weight: 700; cursor: pointer; }
.brc-home:hover { background: #63501b; }
.brc-home:focus-visible { outline: 2px solid #4a3a10; outline-offset: 4px; }
.brc-home:disabled { opacity: .45; cursor: default; }
.brc-go { position: absolute; right: .2em; bottom: -.1em; opacity: 0; color: #4a3a10; animation: brc-blink 1.1s 1.5s steps(1) infinite; }
@keyframes brc-in { from { opacity: 0; } }
@keyframes brc-blink { 0% { opacity: .8; } 50% { opacity: 0; } }
@media (max-width: 30em) { .brc-veil { font-size: 12.5px; padding: 14px 14px 13vh; } .brc-title { font-size: 2.4em; } }
/* a phone held sideways is wide and very short: everything a little closer together, and the way home beside the last line, so that it is on the screen without a scroll */
@media (max-height: 30em) and (min-aspect-ratio: 4/3) {
  .brc-veil { font-size: 12px; padding: 8px 16px 12vh; place-items: start center; }
  .brc-title { font-size: 2em; margin: .04em 0 .3em; }
  .brc-rows { row-gap: .1em; } .brc-ic { width: 1.4em; height: 1.4em; }
  .brc-total { margin-top: .4em; padding-top: .3em; } .brc-total span:last-child { font-size: 2em; }
  .brc-box { margin-top: .5em; padding-top: .45em; row-gap: .18em; }
  .brc-foot { margin-top: .9em; } .brc-actions { position: relative; z-index: 1; margin-top: -2em; }          /* (above the line it now sits beside, which is faint and so would otherwise be drawn over it) */
}
@media (prefers-reduced-motion: reduce) { .brc-form { animation: none; } .brc-go { animation: none; opacity: .8; } }
`;

const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };

/** What is printed at the head of the card, unless whoever shows it says otherwise — and whether there is a jar to be paid into (jar: false where there is no office, and so nothing to spend a coin on). */
const BRAND = Object.freeze({ over: 'AGENT OFFICE', title: 'Out of Office', jar: true });

/** The card, printed on the wall. → the element (not yet shown). opt: { brand: { over, title, jar }, share: (seed) => href, home: { label } } */
function draw(card, who, opt = {}) {
  const brand = { ...BRAND, ...(opt.brand || {}) };
  const out = card.reason === 'exit', ended = ENDED[card.reason] || ENDED.quit;
  const rows = el('div', 'brc-rows');
  for (const l of card.lines) {
    const zero = !l.points ? ' zero' : '';
    rows.append(icon(l.id), el('span', zero.trim(), LINES[l.id] || l.id),
      el('span', `n${zero}`, l.id === 'pace' ? clock(l.count) : l.id === 'out' ? '' : `× ${num(l.count)}`), el('span', `p${zero}`, num(l.points)));
  }
  const box = el('div', 'brc-box'), replay = !!card.replay;
  // a kept tape played back: it says so where the jar would have been, because nothing is paid for it
  if (replay) {
    box.append(icon('tape'), el('span', '', 'Played back from the shelf'), el('span', 'v', `× ${num(card.tape?.plays || 1)}`));
    box.append(el('small', '', 'Nothing is paid for a building that has been walked before.'));
  }
  // what the jar gained: only for more than the office has been paid for before
  else if (out && brand.jar !== false) {
    const c = card.coins || { carried: 0, worth: 0, paid: 0, best: 0 };
    box.append(icon('coin'), el('span', '', 'Paid into the jar'), el('span', 'v', icon('battery', 'spare batteries'), `× ${num(c.carried)}`, '→', icon('coin', 'coins'), `+ ${num(c.paid)}`));
    if (c.worth > 0 && !c.paid) box.append(el('small', '', `The jar has been paid for ${num(c.best)} before. Bring out more than that.`));
  }
  // what was new to this office
  const fresh = card.fresh || { rooms: [], cast: [] }, seen = card.seen || { rooms: 0, cast: 0 };
  box.append(icon('fresh'), el('span', '', 'New to this office'), el('span', 'v', icon('room', 'kinds of room'), `+ ${num(fresh.rooms.length)}`, icon('survived', 'residents'), `+ ${num(fresh.cast.length)}`));
  box.append(el('small', '', `On record: ${num(seen.rooms)} kind${seen.rooms === 1 ? '' : 's'} of room, ${num(seen.cast)} resident${seen.cast === 1 ? '' : 's'}.`));
  // the tape
  // (where there is somewhere a kept tape can be found again, its number is the way there)
  const href = card.tape?.kept && typeof opt.share === 'function' ? opt.share(card.tape.seed) : null;
  const number = href ? el('a', 'v brc-seed', `№ ${card.tape.seed}`) : el('span', 'v brc-seed', card.tape?.kept ? `№ ${card.tape.seed}` : '—');
  if (href) { number.href = href; number.setAttribute('aria-label', `Tape ${card.tape.seed}: walk this building again`); }
  box.append(icon('tape'), el('span', '', replay ? 'Tape back on the shelf' : card.tape?.kept ? 'Tape kept' : 'Tape not recovered'), number);
  if (!card.tape?.kept) box.append(el('small', '', 'That building is gone.'));
  // (a tape played back is measured against the first time it was walked, not against the office's best: it cannot beat that)
  const best = replay ? `PLAYED BACK · FIRST TIME ${num(card.tape?.first?.score)}`
    : card.best?.beaten ? (card.best.was ? `THE BEST YET · WAS ${num(card.best.was)}` : 'THE BEST YET') : `BEST ${num(card.best?.score)}`;

  const form = el('div', 'brc-form',
    el('div', 'brc-over', brand.over),
    el('div', 'brc-title', brand.title),
    rows,
    el('div', 'brc-total', el('span', '', 'POINTS'), el('span', '', num(card.score))),
    el('div', `brc-best${card.best?.beaten ? ' new' : ''}`, best),
    box,
    el('div', 'brc-foot', `PATTERN 13/B · ${String(who || '').toUpperCase().slice(0, 24)}`));
  form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true'); form.setAttribute('aria-label', `${brand.title}, ${replay ? 'a tape played back, ' : ''}${ended}: ${num(card.score)} points`); form.tabIndex = -1;
  if (opt.home) {
    const home = el('button', 'brc-home', opt.home.label || 'Return to homepage');
    home.type = 'button'; home.disabled = true;
    form.append(el('div', 'brc-actions', home));
  }
  // (the mark that says it can be put down is not printed: it sits outside what is multiplied into the paper)
  return el('div', 'brc-veil', el('div', 'brc-wrap', form, !opt.home && el('div', 'brc-go', '▸')));
}

/* ---- the record, where there is no office to keep it ------------------------------------------ */

const remembered = () => { try { return JSON.parse(localStorage.getItem(KEPT) || 'null'); } catch { return null; /* nothing remembered */ } };

/** The tapes this browser has kept, newest first (core/runs.mjs): for a page with no office to ask which buildings can be walked again. */
export const keptTapes = () => cleanRecord(remembered()?.record || emptyRecord()).tapes;

function local(report, who) {
  const kept = remembered();
  const record = cleanRecord(kept?.record || emptyRecord()), earned = Math.max(0, Math.floor(Number(kept?.earned) || 0));
  const run = cleanRun(report), settled = settleRun(record, run, { at: Date.now(), by: who });
  const worth = run.reason === 'exit' && !settled.card.replay ? payFor({ batteries: run.batteries }) : 0, paid = Math.max(0, worth - earned);
  try { localStorage.setItem(KEPT, JSON.stringify({ record: settled.record, earned: Math.max(earned, worth) })); } catch { /* until the page closes, then */ }
  return { ...settled.card, coins: { carried: run.batteries, worth, paid, best: Math.max(earned, worth) } };
}

/**
 * Show the card for a visit that is over, and resolve when it has been put down.
 * @param {{office?:object, reason:string, kept?:object, run?:object, name?:string, brand?:{over?:string, title?:string, jar?:boolean}, home?:{label?:string}, share?:(seed:string)=>string, also?:(card:object, report:object)=>Promise<{icon?:string,label:string,value?:string,href?:string}|null>}} o
 *        run: { seed, seconds, parts: { reached, of }, rooms: { explored, kinds }, cast: { met, survived }, hearts?, edition? } — what index.js counted
 *        brand: what is printed at the head of the card (default: the office's) · share: where a kept tape can be found again
 *        also: one more line for the card, given the card and what was reported; it may take its time, and may be null
 *        home: show a return button and wait for it (or a tape); without it, the office's card accepts any key or click
 * @returns {Promise<object>} the card as it was shown (core/runs.mjs: settleRun, with `coins`) — and `again`: the tape's
 *          seed, if it was put down by choosing the tape's number (only where there is a `share`)
 */
export async function showScorecard(o = {}) {
  const who = o.name || o.office?.walk?.me?.name || 'Visitor';
  const report = { ...(o.run || {}), reason: o.reason, batteries: o.kept?.batteries || 0, card: !!o.kept?.card };
  let card = null;
  if (o.office?.game?.report) card = await o.office.game.report(HIDEOUT, report);
  if (!card) card = local(report, who);

  // (on the page itself, not in the office's own interface: that steps aside for as long as somebody is out of the
  // building, and takes everything in it out of sight with it)
  const root = document.body;
  const style = el('style', '', CSS), veil = draw(card, who, { brand: o.brand, share: o.share, home: o.home }), form = veil.querySelector('.brc-form');
  const number = veil.querySelector('a.brc-seed'), home = veil.querySelector('button.brc-home');
  document.head.append(style); root.append(veil);
  // a line whoever is showing the card wants on it, which it may have to go and ask somebody about: printed when it is known
  if (typeof o.also === 'function') {
    Promise.resolve().then(() => o.also(card, report)).then((line) => {
      if (!line || !veil.isConnected) return;
      const value = line.href ? Object.assign(el('a', 'v brc-more', line.value || ''), { href: line.href }) : el('span', 'v', line.value || '');
      veil.querySelector('.brc-box').append(icon(ICONS[line.icon] ? line.icon : 'fresh'), el('span', '', String(line.label || '')), value);
    }).catch(() => { /* then the card is the card */ });
  }
  try { form.focus({ preventScroll: true }); } catch { /* it will take a click, then */ }
  let again = false;
  await new Promise((done) => {
    let armed = false;
    const arm = setTimeout(() => { armed = true; if (home) home.disabled = false; }, 900); // nobody puts it down before they have seen it
    const finish = (replay, e) => {
      if (!armed) { e?.preventDefault(); return; }
      again = replay;
      e?.preventDefault(); e?.stopPropagation();
      clearTimeout(arm); window.removeEventListener('keydown', put, true); veil.removeEventListener('pointerup', put);
      veil.remove(); style.remove(); done();
    };
    const put = (e) => {
      if (home) {
        // A key still held from play, Esc, or a click on the score must not
        // erase it. Buttons and links keep their normal keyboard activation.
        if (e.type !== 'keydown') return;
        if (e.key === 'Tab') {
          const choices = [...form.querySelectorAll('a[href], button:not(:disabled)')];
          const at = choices.indexOf(document.activeElement);
          if (choices.length) choices[at < 0 ? (e.shiftKey ? choices.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + choices.length) % choices.length].focus();
          e.preventDefault(); e.stopPropagation();
        } else if (e.repeat || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
        else e.stopPropagation();
        return;
      }
      if (!armed || (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key))) return;
      if (e.type === 'pointerup' && e.button > 0) return;                   // (another button is asking the browser something: for the link's address, say)
      // put down by its tape's number (a click on it, or Enter with it chosen): that is asking for the same building again
      finish(!!number && (e.type === 'keydown' ? e.key === 'Enter' && document.activeElement === number : number.contains(e.target)), e);
    };
    home?.addEventListener('click', (e) => finish(false, e));
    number?.addEventListener('click', (e) => { e.preventDefault(); if (home && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) finish(true, e); });
    window.addEventListener('keydown', put, true); veil.addEventListener('pointerup', put);
  });
  return again ? { ...card, again: card.tape.seed } : card;
}
