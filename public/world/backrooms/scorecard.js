// The Backrooms — the card at the end. However a visit ends, somebody is
// handed a form: what they did down there, what it scored, what was new to
// this office, what the jar gained, and whether the tape was kept. It is the
// one piece of paper the place ever gives anybody, so it looks like one: the
// office's letterhead, a line for everything, a picture beside each line and
// a rubber stamp for how it went.
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

const INK = { k: '#2a2620', w: '#fbf7ea', g: '#8d8676', y: '#d9a93a', o: '#b9742a', r: '#b5281c', p: '#e07a6c', n: '#2e7d4f', l: '#7fb98f', b: '#3f6f9a', s: '#9fb6c9', d: '#4a443a' };
const ICONS = {
  room: ['.kkkkkkk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwydk.', '.kwwwwdk.', '.kwwwwdk.', '.kwwwwdk.', 'kkkkkkkkk'],
  kind: ['....y....', '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '.yyy.yyy.', '.yy...yy.', 'y.......y'],
  part: ['kkk......', 'kgk......', 'kgkkk....', 'kgggk....', 'kgggkkk..', 'kgggggk..', 'kgggggkkk', 'kgggggggk', 'kkkkkkkkk'],
  survived: ['..kkkkk..', '.kkkkkkk.', 'kkkwkwkkk', '.kkkkkkk.', '.nlnnnln.', '.nkwnwkn.', '.nnnnnnn.', '..nkkkn..', '...nnn...'],
  out: ['.kkkkkk..', '.kllllk..', '.kllllk.n', '.kllllknn', '.klllnnnn', '.kllllknn', '.kllllk.n', '.kllllk..', '.kkkkkk..'],
  pace: ['...kkk...', '....k....', '..kkkkk..', '.kwwkwwk.', 'kwwwkwwwk', 'kwwwkkkwk', 'kwwwwwwwk', '.kwwwwwk.', '..kkkkk..'],
  card: ['....k....', '...k.k...', '....k....', 'kkkkkkkkk', 'kbbbbbbbk', 'kwwwwwwwk', 'kwkkwgggk', 'kwkkwgggk', 'kkkkkkkkk'],
  battery: ['...kkk...', '..kkkkk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..knnnk..', '..kkkkk..'],
  heart: ['.........', '.rr...rr.', 'rprr.rrrr', 'rprrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....'],
  coin: ['..kkkkk..', '.kyyyyyk.', 'kyyoooyyk', 'kyoyyyyyk', 'kyoyyyyyk', 'kyoyyyyyk', 'kyyoooyyk', '.kyyyyyk.', '..kkkkk..'],
  tape: ['.........', 'kkkkkkkkk', 'kdddddddk', 'kdwwdwwdk', 'kdwkdkwdk', 'kdwwdwwdk', 'kdddddddk', 'kkgggggkk', 'kkkkkkkkk'],
  fresh: ['....y....', '.y..y..y.', '..y.y.y..', '...yyy...', 'yyyywyyyy', '...yyy...', '..y.y.y..', '.y..y..y.', '....y....'],
};

/** One of the pictures, as an <svg> that stays sharp at any size. */
function icon(id, title) {
  const rows = ICONS[id] || ICONS.fresh, n = rows.length, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`); svg.setAttribute('class', 'brc-ic'); svg.setAttribute('shape-rendering', 'crispEdges');
  if (title) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title); } else svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = INK[row[x]]; if (!c) continue; const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1.02); r.setAttribute('height', 1.02); r.setAttribute('fill', c); svg.append(r); } });
  return svg;
}

/* ---- what the form says ---------------------------------------------------------------------- */

const FORMS = {
  exit: { form: 'TIMESHEET', stamp: 'OUT', ink: 'out' },
  caught: { form: 'INCIDENT REPORT', stamp: 'CAUGHT', ink: 'bad' },
  battery: { form: 'EQUIPMENT FAULT', stamp: 'FLAT', ink: 'flat' },
  quit: { form: 'UNAUTHORISED ABSENCE', stamp: 'ABSENT', ink: 'gone' },
};
const LINES = {
  room: 'ROOMS WALKED INTO', kind: 'ROOMS WORTH MENTIONING', part: 'PARTS OF THE BUILDING', survived: 'GOT AWAY FROM',
  out: 'LEFT BY THE WAY OUT', pace: 'TIME ON THE TAPE', card: 'KEYCARD BROUGHT BACK', battery: 'SPARE BATTERIES', heart: 'STILL IN ONE PIECE',
};
const num = (n) => Number(n || 0).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const CSS = `
.brc-veil { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; overflow: auto; padding: 16px; box-sizing: border-box;
  background: #060605 repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px); color: #2a2620;
  font: 600 13px/1.35 ui-monospace, Menlo, Consolas, monospace; -webkit-font-smoothing: none; }
.brc-form { position: relative; width: min(100%, 33em); box-sizing: border-box; padding: 1.5em 1.6em 1.2em; background: #efe9d8;
  background-image: linear-gradient(rgba(42,38,32,.05) 1px, transparent 1px); background-size: 100% 1.9em;
  box-shadow: 0 1px 0 #fff8 inset, 0 18px 50px #000c; transform: rotate(-.5deg); animation: brc-in .28s ease-out both; outline: none; }
.brc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1em; border-bottom: 2px solid #2a2620; padding-bottom: .45em; }
.brc-head b { font-size: 1.25em; letter-spacing: .22em; }
.brc-foot { margin-top: .9em; font-size: .78em; letter-spacing: .1em; opacity: .55; }
.brc-sub { display: flex; gap: .8em; margin: .5em 0 1.1em; letter-spacing: .12em; padding-right: 7.5em; flex-wrap: wrap; }
.brc-sub i { font-style: normal; opacity: .7; }
.brc-rows { display: grid; grid-template-columns: 1.7em 1fr auto auto; column-gap: .7em; row-gap: .28em; align-items: center; }
.brc-rows .n { text-align: right; opacity: .75; min-width: 3.2em; }
.brc-rows .p { text-align: right; min-width: 3.6em; }
.brc-rows .zero { opacity: .38; }
.brc-ic { width: 1.6em; height: 1.6em; display: block; }
.brc-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: .7em; padding-top: .5em; border-top: 2px solid #2a2620; font-size: 1.3em; letter-spacing: .12em; }
.brc-best { text-align: right; font-size: .85em; letter-spacing: .08em; opacity: .7; margin-top: .15em; }
.brc-best.new { opacity: 1; color: #2e7d4f; }
.brc-box { margin-top: .9em; padding-top: .65em; border-top: 1px dashed #2a262088; display: grid; grid-template-columns: 1.7em 1fr auto; column-gap: .7em; row-gap: .3em; align-items: center; }
.brc-box .v { text-align: right; white-space: nowrap; display: flex; align-items: center; gap: .35em; justify-content: flex-end; }
.brc-box .v .brc-ic { width: 1.25em; height: 1.25em; }
.brc-box small { grid-column: 2 / -1; font-size: .82em; opacity: .65; letter-spacing: .04em; margin-top: -.2em; }
.brc-seed { font-weight: 400; opacity: .75; overflow: hidden; text-overflow: ellipsis; max-width: 12em; }
.brc-stamp { position: absolute; right: .75em; top: 1.5em; padding: .12em .5em; border: .2em solid currentColor; border-radius: .25em; font-size: 1.7em; letter-spacing: .14em;
  transform: rotate(9deg); opacity: .82; mix-blend-mode: multiply; animation: brc-stamp .22s .38s cubic-bezier(.2,1.6,.4,1) both; pointer-events: none; }
.brc-stamp.out { color: #2e7d4f; } .brc-stamp.bad { color: #b5281c; } .brc-stamp.flat { color: #a8771c; } .brc-stamp.gone { color: #5d574c; }
.brc-go { position: absolute; right: .9em; bottom: .6em; opacity: 0; animation: brc-blink 1.1s 1.2s steps(1) infinite; }
@keyframes brc-in { from { opacity: 0; transform: translateY(14px) rotate(-1.6deg); } }
@keyframes brc-stamp { from { opacity: 0; transform: rotate(9deg) scale(1.9); } }
@keyframes brc-blink { 0% { opacity: .75; } 50% { opacity: 0; } }
@media (max-width: 30em) { .brc-veil { font-size: 11.5px; padding: 10px; } .brc-form { padding: 1.2em 1.1em 1em; } .brc-stamp { font-size: 1.4em; top: 1.7em; } .brc-sub { padding-right: 6em; } }
@media (prefers-reduced-motion: reduce) { .brc-form, .brc-stamp { animation: none; } .brc-go { animation: none; opacity: .75; } }
`;

const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };

/** The card as a form on the page. → the element (not yet shown). */
function draw(card, who) {
  const f = FORMS[card.reason] || FORMS.quit, out = card.reason === 'exit';
  const rows = el('div', 'brc-rows');
  for (const l of card.lines) {
    const zero = !l.points ? ' zero' : '';
    rows.append(icon(l.id), el('span', zero.trim(), LINES[l.id] || l.id.toUpperCase()),
      el('span', `n${zero}`, l.id === 'pace' ? clock(l.count) : l.id === 'out' ? '' : `× ${num(l.count)}`), el('span', `p${zero}`, num(l.points)));
  }
  const box = el('div', 'brc-box');
  // what the jar gained: only for more than the office has been paid for before
  if (out) {
    const c = card.coins || { carried: 0, worth: 0, paid: 0, best: 0 };
    box.append(icon('coin'), el('span', '', 'PAID INTO THE JAR'), el('span', 'v', icon('battery', 'spare batteries'), `× ${num(c.carried)}`, '→', icon('coin', 'coins'), `+ ${num(c.paid)}`));
    if (c.worth > 0 && !c.paid) box.append(el('small', '', `the jar has been paid for ${num(c.best)} before: bring out more than that`));
  }
  // what was new to this office
  const fresh = card.fresh || { rooms: [], cast: [] }, seen = card.seen || { rooms: 0, cast: 0 };
  box.append(icon('fresh'), el('span', '', 'NEW TO THIS OFFICE'), el('span', 'v', icon('room', 'kinds of room'), `+ ${num(fresh.rooms.length)}`, icon('survived', 'residents'), `+ ${num(fresh.cast.length)}`));
  box.append(el('small', '', `on record: ${num(seen.rooms)} kind${seen.rooms === 1 ? '' : 's'} of room, ${num(seen.cast)} resident${seen.cast === 1 ? '' : 's'}`));
  // the tape
  box.append(icon('tape'), el('span', '', card.tape?.kept ? 'TAPE FILED' : 'TAPE NOT RECOVERED'), el('span', 'v brc-seed', card.tape?.kept ? `№ ${card.tape.seed}` : '—'));
  if (!card.tape?.kept) box.append(el('small', '', 'that building is gone'));

  const form = el('div', 'brc-form',
    el('div', 'brc-head', el('b', '', 'AGENT OFFICE')),
    el('div', 'brc-sub', el('span', '', f.form), el('i', '', `· ${String(who || '').toUpperCase().slice(0, 24)}`)),
    rows,
    el('div', 'brc-total', el('span', '', 'POINTS'), el('span', '', num(card.score))),
    el('div', `brc-best${card.best?.beaten ? ' new' : ''}`, card.best?.beaten ? (card.best.was ? `THE BEST YET · WAS ${num(card.best.was)}` : 'THE BEST YET') : `BEST ${num(card.best?.score)}`),
    box,
    el('div', 'brc-foot', 'FORM 13/B · FILE WITH THE CARETAKER'),
    el('div', `brc-stamp ${f.ink}`, f.stamp),
    el('div', 'brc-go', '▸'));
  form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true'); form.setAttribute('aria-label', `${f.form}: ${num(card.score)} points`); form.tabIndex = -1;
  return el('div', 'brc-veil', form);
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
  const style = el('style', '', CSS), veil = draw(card, who), form = veil.firstChild;
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
