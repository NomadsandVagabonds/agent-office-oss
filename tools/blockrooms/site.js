// BlockRooms — the page round the level, on a site of its own. There is no
// office here: nobody upstairs, no lift, no basement, no jar. This stands in
// for all of it with as little as the level needs — an invented team to borrow
// names and faces from, a count of whether the keycard has been brought out,
// and a building nobody has had before. One a visit: when it is over there is
// the card, and after the card the front page.
//
// One thing a site can do that the office cannot: a building somebody got out
// of can be handed on. Its tape is an address (…/?tape=<seed>). Whoever opens
// one walks that building; while the card for a kept tape is on the wall the
// address bar says where it is; and choosing the tape's number on the card
// walks it again.
//
// Nothing is asked of anybody: what is kept (the keycard, the record of visits
// and tapes, the two settings) is kept in this browser's own storage, and
// every file comes from this site. Two things are told to the site's book, if
// it keeps one (/api/book; core/book.mjs): that somebody went in, and — when
// somebody gets out, and has not unticked the box on the front page — what
// the visit came to, under the made-up name they were given there.
import { cleanMessage, cleanName, rollName } from './core/book.mjs';

const fault = document.getElementById('fault');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Somebody has to work upstairs.
const look = (species, outfitColor, accessory, extra) => ({ species, outfitColor, accessory, ...extra });
const team = [
  ['Ivory Marten', look('goblin', '#8a5a8f', 'none', { skin: '#5f8a6a', hair: 'short', outfit: 'cardigan', facial: 'mustache' })],
  ['Amber Vireo', look('human', '#3f7f9a', 'monocle', { skin: '#cd8d5e', hair: 'side', hairColor: '#9aa0ac', outfit: 'suit' })],
  ['Ember Numbat', look('robot', '#b5483f', 'none')], ['Olive Heron', look('cat', '#6f8a4a', 'glasses')],
  ['Slate Okapi', look('human', '#5a6fa8', 'headphones', { hair: 'bun', outfit: 'hoodie' })], ['Coral Tapir', look('dog', '#c9893f', 'partyhat')],
  ['Dusty Ibis', null], ['Mossy Quoll', null],
];
const office = {
  stage: null, creations: {},
  net: { state: {
    world: { plan: { rooms: ['Webstore', 'Mobile App', 'Api Gateway', 'Data Pipeline', 'Ml Research', 'Infra'].map((name, slot) => ({ slot, deptId: name.toLowerCase().replace(/ /g, '-'), name })) } },
    agents: new Map(team.map(([name, character], i) => [`a${i}`, { id: `a${i}`, name, persona: `p:${name}`, profile: { character } }])),
    tasks: new Map([['webstore', [{ title: 'Cache the product catalogue' }, { title: 'Trim the Docker image' }, { title: 'Fix the flaky checkout test' }]]]),
  } },
};

// The keycard: once it has been brought out it is not down there again — until the page forgets, which it does as soon
// as it has been, so that there is always something down there to find.
const KEPT = 'blockrooms:kept';
let kept = { card: false };
try { const was = JSON.parse(localStorage.getItem(KEPT) || 'null'); if (was) kept = { card: !!was.card }; } catch { /* nothing remembered: it is still down there */ }
const remember = () => { try { localStorage.setItem(KEPT, JSON.stringify(kept)); } catch { /* until the page closes, then */ } };
office.game = {
  left(place) {
    if (place !== 'backrooms') return { card: false, coins: [] };
    if (kept.card) { kept = { card: false }; remember(); }
    return { card: !kept.card, coins: [] };
  },
  async take(place, item) {
    if (place !== 'backrooms') return null;
    if (item === 'card') kept.card = true;
    remember();
    return { taken: true };
  },
};

/* ---- tapes --------------------------------------------------------------------------------------- */

/** A seed nobody has had: ten letters and digits, short enough to read out. */
function fresh() {
  const a = new Uint32Array(3);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 4294967296); }
  return [...a].map((n) => n.toString(36).padStart(7, '0')).join('').slice(-10);
}
/** A seed as an address may give it: what the record would keep of it (core/runs.mjs), or nothing. */
const asSeed = (v) => String(v ?? '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 80);
const here = () => location.origin + location.pathname;
/** Say in the address bar where a tape is (or, with none, stop saying). Whoever copies the address has the building. */
function address(seed) {
  const url = seed ? `${here()}?tape=${encodeURIComponent(seed)}` : here();
  try { history.replaceState(null, '', url); } catch { /* an address that cannot be changed is still an address */ }
  return url;
}

/* ---- the book ------------------------------------------------------------------------------------ */

/** The front page: where a visit begins, and where it ends. */
const HOME = './';
const ME = 'blockrooms:me';
/**
 * Who this visitor signed in as (or, if they did not, a made-up name), their message, and whether they sign the book: all
 * set on the front page. It is who they are in the building too (the card, and the rooms that know a visitor's name):
 * a building is the same whoever walks it, so a tape handed on is still the same tape.
 */
function me() {
  let was = {};
  try { was = JSON.parse(localStorage.getItem(ME) || '{}') || {}; } catch { /* nobody yet */ }
  const spare = cleanName(was.spare) || rollName();
  const now = { name: cleanName(was.name) || spare, spare, message: cleanMessage(was.message) || '', sign: was.sign !== false };
  try { localStorage.setItem(ME, JSON.stringify(now)); } catch { /* until the page closes, then */ }
  return now;
}
/** Tell the book something. → what it answered, or null (no book, no network, no matter). */
async function tell(body) {
  try {
    const res = await fetch('./api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    return await res.json();
  } catch { return null; }
}
/** The line the card gets once the book has answered: that this visit is in it, and where. */
async function sign(card, report) {
  if (card.replay || card.reason !== 'exit') return null;
  const who = me();
  if (!who.sign) return null;
  const answer = await tell({ do: 'sign', name: who.name, message: who.message, run: report });
  if (answer?.ok) return { icon: 'fresh', label: `High scores: ${who.name}`, value: answer.place ? `№ ${answer.place}` : 'signed', href: './#book' };
  return answer?.why === 'signed' ? { icon: 'fresh', label: 'High scores', value: 'signed', href: './#book' } : null;
}

async function run() {
  try {
    const [{ createStage }, { enterBackrooms }, { keptTapes }, { ARCHETYPES }] = await Promise.all([
      import('./world/engine/stage.js'), import('./world/backrooms/index.js'), import('./world/backrooms/scorecard.js'), import('./world/backrooms/gen.js')]);
    office.stage = createStage(document.getElementById('stage'), { fx: false, shadows: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) });
    office.stage.start();
    // the tape this address names, if it names one, is the building walked; with none, one nobody has had. When it
    // is over the card comes up, and after the card the front page — unless the card for a kept tape is put down by
    // its number, which is asking for that building again
    const q = new URLSearchParams(location.search);
    let next = asSeed(q.get('tape')) || null;
    // (for whoever is checking the site and not playing it: ?debug hands a script the level's own handle, and lets it ask
    // for a shorter building, a part to begin on, a quiet one)
    const whole = (k) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Math.floor(Number(q.get(k))) : undefined);
    const dev = q.has('debug') ? { debug: true, depths: whole('depths'), depth: whole('depth'), mute: q.has('mute') ? true : undefined, pursuer: q.has('pursuer') ? q.get('pursuer') !== '0' : undefined } : {};
    // ?room=<a room of the deck> is a building with that room where you land (for looking at one room; nothing on
    // the front page leads here. A room nobody has built yet is no room, and the door is an ordinary door)
    let room = !next && q.get('room') && Object.hasOwn(ARCHETYPES, q.get('room')) ? q.get('room') : null;
    for (;;) {
      const seed = next || fresh();
      // a tape this browser has kept is a tape played back (it says PLAY, hides nothing, and is paid nothing: core/runs.mjs);
      // one that came from somebody else is a building like any other, walked for the first time
      const mine = next ? keptTapes().find((t) => t.seed === seed) : null;
      next = null;
      if (!mine) tell({ do: 'in' });                      // (he keeps count of who goes in. A tape played back is nobody going anywhere)
      const result = await enterBackrooms(office, {
        name: me().name, seed, brand: { over: 'OUT OF OFFICE', title: 'BlockRooms', jar: false }, share: address, also: sign,
        home: { label: 'Return to homepage' }, ...dev,
        ...(room ? { only: [room] } : {}),
        ...(mine ? { replay: true, pursuer: typeof mine.mascot === 'boolean' ? mine.mascot : undefined } : {}),
      });
      room = null;
      // A card put down by its tape's number asks for that building again. Its return button takes the visitor to
      // the front page, where the door and high scores are. Esc opens the menu; Give Up ends the recording, then
      // the score stays until the visitor chooses what to do. Never straight into another building.
      next = result?.card?.again ? asSeed(result.card.again) || null : null;
      if (!next) { location.assign(HOME); return; }
      address(next);
      office.stage.setView(null);
      await pause(1100);
    }
  } catch (err) {
    console.error(err);
    fault.textContent = 'NO SIGNAL — ' + String((err && err.message) || err).slice(0, 160);
    fault.hidden = false;
  }
}
run();
