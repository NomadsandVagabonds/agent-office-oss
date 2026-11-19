// BlockRooms — the page round the level, on a site of its own. There is no
// office here: nobody upstairs, no lift, no basement, no jar. This stands in
// for all of it with as little as the level needs — an invented team to borrow
// names and faces from, a count of whether the keycard has been brought out,
// and a building nobody has had before. One a visit: when it is over there is
// the card, and after the card the front page, or (Go back in) another building
// nobody has had.
//
// One thing a site can do that the office cannot: a building somebody got out
// of can be handed on. Its tape is an address (…/?tape=<seed>). Whoever opens
// one walks that building; while the card for a kept tape is on the wall the
// address bar says where it is; and choosing the tape's number on the card
// walks it again.
//
// Play needs no account. Visits and character changes save locally first;
// people who sign in can also sync their private archive through Supabase.
// Two things are told to the site's book, if
// it keeps one (/api/book; core/book.mjs): that somebody went in, and — when
// somebody gets out, and has not unticked the box on the front page — what
// the visit came to, under the made-up name they were given there.
import { DEFAULT_DIFFICULTY, cleanDifficulty, scoreEligible } from './core/difficulty.mjs';
import { cleanMessage, cleanName, rollName } from './core/book.mjs';
import { resolveLook, sanitizeLookPatch } from './core/look.mjs';
import { cleanPerk } from './core/perks.mjs';
import { archive, startAccounts } from './archive-client.js';
startAccounts().catch(() => {});

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
 * Who this visitor signed in as (or, if they did not, a made-up name), their message, look and perk: all set on the
 * front page. It is who they are in the building too (the card, and the rooms that know a
 * visitor's name): a building is the same whoever walks it, so a tape handed on is still the same tape.
 */
function me() {
  let was = {};
  try { was = JSON.parse(localStorage.getItem(ME) || '{}') || {}; } catch { /* nobody yet */ }
  const spare = cleanName(was.spare) || rollName();
  const patch = sanitizeLookPatch(was.look).look;
  const customLook = !!was.customLook && Object.keys(patch).length > 0;
  const now = {
    name: cleanName(was.name) || spare,
    spare,
    message: cleanMessage(was.message) || '',
    customLook,
    look: customLook ? patch : {},
    perk: cleanPerk(was.perk),
  };
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
/**
 * The line the card gets for a visit that got out: the guestbook, which is asked on the front page, after the fact
 * (home.js `#sign`). Nobody signs before they have been in, and nobody's name goes in the book without their asking:
 * the report waits in this browser until they sign or say no.
 */
const UNSIGNED = 'blockrooms:unsigned';
let visitTicket = Promise.resolve(null);              // (the ticket the book gave this visit as it went in)
async function sign(card, report) {
  if (card.replay || card.reason !== 'exit' || !scoreEligible(report)) return null;
  const player = office.walk?.me;
  const name = player?.name || me().name, ticket = await visitTicket.catch(() => null);
  if (!ticket) return null;                           // (a visit the book never heard begin cannot be signed for)
  try { localStorage.setItem(UNSIGNED, JSON.stringify({ name, look: player?.look, run: report, ticket, score: Number(card.score ?? report?.score) || 0, at: Date.now() })); } catch { return null; }
  return { icon: 'fresh', label: 'Guestbook', value: 'Sign it', href: './#sign' };
}

async function run() {
  // (asked for while the level is being fetched, so that nobody waits for it)
  const asked = fetch('./api/where', { headers: { accept: 'application/json' }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => (d && typeof d.city === 'string' ? d.city : '')).catch(() => '');
  try {
    const [{ openStage }, { pageRendererChoice }, { enterBackrooms }, { ARCHETYPES }] = await Promise.all([
      import('./world/engine/stage.js'), import('./world/engine/gpu.js'), import('./world/backrooms/index.js'), import('./world/backrooms/gen.js')]);
    // (the renderer: WebGL, as always, unless ?gpu=webgpu or a shell's stored choice asks for WebGPU: engine/gpu.js)
    office.stage = await openStage(document.getElementById('stage'), { renderer: pageRendererChoice(), fx: false, shadows: false, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) });
    office.stage.start();
    // the tape this address names, if it names one, is the building walked; with none, one nobody has had. When it
    // is over the card comes up, and after the card the front page — unless the card for a kept tape is put down by
    // its number, which is asking for that building again, or the card is put down by Go back in, which is asking
    // for one nobody has had
    const q = new URLSearchParams(location.search);
    let next = asSeed(q.get('tape')) || null;
    // (for whoever is checking the site and not playing it: ?debug hands a script the level's own handle, and lets it ask
    // for a shorter building, a part to begin on, a quiet one, particular kinds of floor)
    const whole = (k) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Math.floor(Number(q.get(k))) : undefined);
    const dev = q.has('debug') ? { debug: true, depths: whole('depths'), depth: whole('depth'), mute: q.has('mute') ? true : undefined, pursuer: q.has('pursuer') ? q.get('pursuer') !== '0' : undefined,
      themes: q.get('themes') ? q.get('themes').split(',').filter(Boolean) : undefined,
      // (Codex's furniture that can be dragged, and put in a creature's way, is on for everybody; whoever is checking can have a building without it)
      barricades: q.get('barricades') === '0' ? false : undefined,
      // (Codex's fluorescent banks that fail, and rooms with a dark side: a prototype, off for everybody, on for whoever asks here)
      // (and whoever is looking, or filming, may name who is down there: `cast=mother,intern` puts exactly those on every part)
      dev: (() => { const d = {}; if (['1', 'dim', 'failing', 'travel', 'emergency', 'islands'].includes(q.get('lighting'))) d.lighting = q.get('lighting');
        const cast = (q.get('cast') || '').split(',').filter(Boolean); if (cast.length) d.cast = cast;
        // (`beside=toner` puts the visitor next to that one; `wake=1` has the mascot awake: docs/BACKROOMS.md, the cast section)
        if (q.get('beside')) d.beside = q.get('beside'); if (q.get('wake') === '1') d.wake = true; return Object.keys(d).length ? d : undefined; })() } : {};
    // (and, under ?debug only, the dev page's measuring tape: &perf=1 a read-out, &bench=1 a fixed tour of the floor you
    // land on, &stress=<n>|auto the scene drawn more than once a frame — world/dev/perf.js. Fetched only when asked for, so
    // without them nothing of it is loaded or run. A bench run is the tape's building on the default difficulty and the full
    // camcorder (unless &vhs= says otherwise), quiet and with nothing following, and is never a kept tape played back: one
    // address is then the same walk on any machine)
    const bench = !!dev.debug && q.get('bench') === '1';
    const perf = dev.debug && (bench || q.get('perf') === '1') ? (await import('./world/dev/perf.js')).createPerf(office.stage, { bench, params: q }) : null;
    if (perf) dev.onReady = (handle) => perf.attach(handle);
    if (bench) Object.assign(dev, { mute: true, pursuer: dev.pursuer ?? false, difficulty: DEFAULT_DIFFICULTY, vhs: ['0', '1', '2'].includes(q.get('vhs')) ? Number(q.get('vhs')) : 2 });
    // ?room=<a room of the deck> is a building with that room where you land (for looking at one room; nothing on
    // the front page leads here. A room nobody has built yet is no room, and the door is an ordinary door)
    let room = !next && q.get('room') && Object.hasOwn(ARCHETYPES, q.get('room')) ? q.get('room') : null;
    // where the visitor appears to be, as the site's host tells the site (api/where): the second line of a banner in the
    // building. Asked once, not waited for long, not kept; with no answer the banner says what such banners say
    const where = await Promise.race([asked, pause(1500).then(() => '')]);
    for (;;) {
      const seed = next || fresh();
      // a tape this browser has kept is a tape played back (it says PLAY, hides nothing, and is paid nothing: core/runs.mjs);
      // one that came from somebody else is a building like any other, walked for the first time
      const visitOwner = archive.owner(), visitId = crypto.randomUUID(), visitor = archive.profile(visitOwner);
      // Who the visitor is. Signed in: the account's own name and character, on every device (the owner's rule: the cloud
      // wins). Not signed in: what this browser's studio keeps, as it always was. The department kit and the difficulty
      // are this browser's either way: the archive does not hold them.
      const who = me(), account = String(visitOwner).startsWith('user:'), theirs = account ? archive.document(visitOwner).character?.value : null;
      const playerName = account ? visitor.name : (who.name || visitor.name || 'Employee');
      const playerLook = theirs ? resolveLook(`visitor:${seed}`, theirs) : who.customLook ? resolveLook(`visitor:${seed}`, who.look) : resolveLook(`visitor:${seed}`);
      office.walk = { me: { id: visitOwner, name: playerName, look: playerLook } };
      office.game.report = (_place, report) => archive.report(report, visitId, visitOwner, playerName);
      const mine = next && !bench ? archive.record(visitOwner).tapes.find((t) => t.seed === seed) : null;
      next = null;
      // (he keeps count of who goes in, and gives the visit a ticket for its building: it is handed back to sign the book.
      // A tape played back, or a visit for checking the site, is nobody going anywhere)
      visitTicket = !mine && !dev.debug ? tell({ do: 'in', seed }).then((a) => (a && typeof a.ticket === 'string' ? a.ticket : null)) : Promise.resolve(null);
      // a building that was asked to be other than its seed has it (?debug, ?room=) is for looking at, and getting out of
      // one is not a score: the book is not signed for it (it was, by anybody checking the site who walked out)
      const doctored = !!dev.debug || !!room;
      const result = await enterBackrooms(office, {
        name: playerName, seed, onArchive: () => window.open(new URL('./archive', location.href), '_blank', 'noopener'),
        archive: { href: './archive' }, brand: { over: 'OUT OF OFFICE', title: 'BlockRooms', jar: false }, share: address, also: doctored ? undefined : sign,
        onFloorVisited: doctored ? undefined : theme => archive.visitFloor(theme, visitOwner).catch(console.error),
        onFloorCleared: doctored ? undefined : theme => archive.clearFloor(theme, visitOwner).catch(console.error),
        look: playerLook, perk: who.perk,
        difficulty: mine ? cleanDifficulty(mine.difficulty, 'training-wheels') : undefined,
        home: { label: 'Return to homepage' }, anew: { label: 'Go back in' }, where, ...dev,
        ...(room ? { only: [room] } : {}),
        ...(mine ? { replay: true, pursuer: typeof mine.mascot === 'boolean' ? mine.mascot : undefined } : {}),
      });
      room = null;
      perf?.detach();
      // A card put down by its tape's number asks for that building again; put down by Go back in, it asks for a
      // building nobody has had. Its return button takes the visitor to the front page, where the door and high
      // scores are. Esc opens the menu; Give Up ends the recording, then the score stays until the visitor chooses
      // what to do. Never straight into another building without being asked.
      next = result?.card?.again ? asSeed(result.card.again) || null : null;
      if (!next && !result?.card?.anew) { location.assign(HOME); return; }
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
