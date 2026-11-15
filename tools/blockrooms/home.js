// BlockRooms — the home page's script.
//
//   pictures   art.js draws them; this only says where
//   signing    the name and the short message a visitor signs with, typed by
//              the door and kept in this browser
//   counter    visitors, went in, came out: from the book if the site keeps
//              one (/api/book), from this browser's own record if it does not
//   book       high scores and the guestbook, from the same place. A name and
//              a message are all of it that a stranger wrote (core/book.mjs),
//              and both are put on the page as text, never as markup
//   adverts    each is a link into the level
//   the rest   a figure that moves when it is off screen, a page that gets
//              longer at the bottom, a wall that gives when it is held
import { mount, drawLogo, voidTile } from './art.js';
import { rollName, cleanName, cleanMessage, cleanEntry } from './core/book.mjs';
import { archive, onArchive, startAccounts } from './archive-client.js';
startAccounts().catch(() => {});

const $ = (id) => document.getElementById(id);
const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };
const num = (n) => Number(n || 0).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const day = (at) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* until the page closes */ } } };
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PLAY = './play';

// a link to a tape from before there was a front page goes straight to the level
if (new URLSearchParams(location.search).has('tape')) location.replace(PLAY + location.search);

/* ---- pictures ------------------------------------------------------------------------------------ */
drawLogo($('logo'));
$('top').style.backgroundImage = `url(${voidTile()})`;
document.querySelector('.plugrow').style.backgroundImage = $('top').style.backgroundImage;

/* ---- signing: a name and a message ----------------------------------------------------------------- */
const ME = 'blockrooms:me';
// (a name is typed; until one is, the visitor is down under a made-up one)
let me = (() => {
  const was = store.get(ME) || {}, typed = cleanName(was.name), spare = cleanName(was.spare) || rollName();
  return { name: typed || spare, typed: !!typed && typed !== spare, spare, message: cleanMessage(was.message) || '', sign: was.sign !== false };
})();
const keep = () => store.set(ME, { name: me.name, spare: me.spare, message: me.message, sign: me.sign });
keep();
const nameBox = $('name'), nameSays = $('name-says'), messageBox = $('message'), messageSays = $('message-says');
function named(value) {
  const typed = cleanName(value), bad = !typed && !!String(value).trim();
  nameBox.classList.toggle('bad', bad); nameSays.classList.toggle('bad', bad);
  nameSays.textContent = bad ? '16 characters at most. Letters and numbers.' : '';
  me = { ...me, name: typed || me.spare, typed: !!typed };
  keep();
  archive.edit({ name: me.name });
}
function said(value) {
  const text = cleanMessage(value), bad = text === null;
  messageBox.classList.toggle('bad', bad); messageSays.classList.toggle('bad', bad);
  messageSays.textContent = bad ? '60 characters at most. No links.' : '';
  me = { ...me, message: text || '' };
  keep();
}
nameBox.placeholder = me.spare; nameBox.value = me.typed ? me.name : '';
nameBox.addEventListener('input', () => named(nameBox.value));
messageBox.value = me.message;
messageBox.addEventListener('input', () => said(messageBox.value));
$('reroll').addEventListener('click', () => { const spare = rollName(); me = { ...me, spare, name: spare, typed: false }; nameBox.value = ''; nameBox.placeholder = spare; named(''); });
$('optin').checked = me.sign;
$('optin').addEventListener('change', (e) => { me = { ...me, sign: e.target.checked }; keep(); });
$('signin').addEventListener('submit', async (e) => { e.preventDefault(); await archive.edit({ name: me.name }); location.href = PLAY; });

/* ---- what this browser remembers ------------------------------------------------------------------- */
let mine = archive.record();
onArchive(() => {
  mine = archive.record();
  if (document.activeElement !== nameBox) { me.name = archive.profile().name; nameBox.value = me.name; keep(); }
  $('shelf').replaceChildren(el('li', 'empty', 'None.'));
  if (mine.tapes.length) {
    $('shelf').replaceChildren(...mine.tapes.map((t) => {
      const link = el('a', '', 'play'); link.href = `${PLAY}?tape=${encodeURIComponent(t.seed)}`;
      return el('li', '', el('span', 'label', `${t.at ? day(t.at) : ''}  ${num(t.score)} pts  ${clock(t.seconds)}`), el('span', '', `№ ${t.seed}`), link);
    }));
  }

});

/* ---- the counter, and the book --------------------------------------------------------------------- */
// (the count did not start at nothing)
const BEFORE = { in: 37, out: 2 };
const odo = (id, n) => { $(id).textContent = String(Math.max(0, Math.floor(n))).padStart(7, '0').slice(-7); };
function counter(c) {
  const into = BEFORE.in + (c ? c.in : mine.runs), out = BEFORE.out + (c ? c.out : mine.out), hits = c ? c.hits : into + 1;
  odo('hits', hits); odo('in', into); odo('out', out);
  for (const node of document.querySelectorAll('[data-hits]')) node.textContent = num(hits);
}
// the first entries in the guestbook: they came with the page
const FIRST_ENTRIES = [
  ['Coral Tapir', '14 Apr 96', 'went down for copier paper, still looking for the lift'],
  ['Olive Heron', '02 Nov 97', 'nice pictures! that is my cardigan in #5'],
  ['Amber Vireo', '19 Jan 98', 'cool page'],
  ['Ember Numbat', '29 Aug 98', 'Great site!! Found it on Yahoo.'],
  ['Webmaster', '11 Nov 98', 'testing guestbook'],
];
function guests(latest) {
  const real = latest.map((e) => el('li', '', el('span', 'who', e.name), el('span', 'when', day(e.at)), e.message ? el('span', 'said', e.message) : null, el('span', 'sc', `${num(e.score)} pts`)));
  const first = FIRST_ENTRIES.map(([who, when, text]) => el('li', '', el('span', 'who', who), el('span', 'when', when), el('span', 'said', text)));
  $('guests').replaceChildren(...real, ...first);
}
function scores(top, none = 'Nobody yet.') {
  const body = $('scores').tBodies[0];
  if (!top.length) { body.replaceChildren(el('tr', '', Object.assign(el('td', 'empty', none), { colSpan: 7 }))); return; }
  body.replaceChildren(...top.slice(0, 10).map((e, i) => {
    const link = el('a', '', 'play'); link.href = `${PLAY}?tape=${encodeURIComponent(e.seed)}`;
    const td = (cls, text) => el('td', cls, text);
    return el('tr', i ? '' : 'first', td('n', String(i + 1)), td('', e.name), td('n', num(e.score)), td('n', clock(e.seconds)), td('n', String(e.batteries)), td('n', String(e.hearts)), el('td', '', link));
  }));
}
guests([]);
async function book() {
  let data = null;
  try {
    const res = await fetch('./api/book', { headers: { accept: 'application/json' } });
    if (res.ok) data = await res.json();
  } catch { /* no book: this browser's own record, then */ }
  if (!data || !data.ok) { scores([], mine.best ? `Best on this computer: ${num(mine.best)}` : 'Nobody yet.'); return; }
  counter(data.counter);
  scores((data.top || []).map(cleanEntry).filter(Boolean));
  guests((data.latest || []).map(cleanEntry).filter(Boolean));
  // count this visit once per tab (the book itself does not count the same visitor twice in a while)
  try {
    if (sessionStorage.getItem('blockrooms:hit')) return;
    sessionStorage.setItem('blockrooms:hit', '1');
    const res = await fetch('./api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'hit' }) });
    if (res.ok) { const hit = await res.json(); if (hit.ok) counter(hit.counter); }
  } catch { /* not counted */ }
}

/* ---- the adverts ----------------------------------------------------------------------------------- */
// Pictures, not doors: nothing here starts the game (the owner: an advert that drops you into the level without a
// word is not wanted; they may open windows of their own later). The one that does anything opens the store's window.
// Nothing about them is called "ad" where a browser can see it (class, id, attribute): a blocker hides by name, and
// one of these was being hidden. (MECHA's slogan is MECHA's own, as it is on the wall of its training floor.)
const ADS = [
  { cls: 'plug-free', hr: true, sprite: ['battery', 'spin', 3], cta: 'CLICK HERE', frames: [['CONGRATULATIONS!!!', 'YOU ARE VISITOR NUMBER {hits}'], ['FREE DESK UPGRADE', 'Click here to claim 5A']] },
  { cls: 'plug-mecha', sprite: ['cog', 'turn', 3], cta: 'APPLY', slogan: 'Profiting from the world’s misery so you don’t have to', frames: [['MECHA', 'now hiring']] },
  { cls: 'plug-neo', store: true, sprite: ['pirate', '', 3], cta: 'STORE', frames: [['CAP’N’S NEOCLOUD', 'GRAPHICS CARDS BY THE HOUR']] },
  { cls: 'plug-shred', sprite: ['granny_shred', '', 2], cta: 'CLICK HERE', frames: [['GLADYS DOCUMENT DISPOSAL', 'Pink forms taken daily'], ['SHREDDING WHILE U WAIT', '3rd Basement · Ext. 404']] },
  { cls: 'plug-tetris', sprite: ['tetris_cube', '', 2], cta: 'FREE QUOTE', frames: [['APEX MODULAR CUBICLES', 'Stack up to 5 high'], ['SAVE FLOOR SPACE', 'Ladders sold separately']] },
  { cls: 'plug-water', sprite: ['cooler', '', 3], cta: 'CLICK HERE', frames: [['Hydration Corridor™', 'WATER COOLERS']] },
  // (the owner's line)
  { cls: 'plug-card', sprite: ['standee', '', 3], cta: 'ORDER NOW', frames: [['Cardboard Colleagues', 'Unlike your wife, we will never leave you']] },
  { cls: 'plug-meld', sprite: ['ceiling_carl', '', 2], cta: 'LEARN MORE', frames: [['ACME ACOUSTIC TILES', 'Drop ceilings & partitions'], ['TRADE PRICES', 'Since 1974']] },
  { cls: 'plug-lean', lean: true, frames: [] },
];
/** Hold something down for as long as the wall takes, and it gives. */
const LEAN = 1150;
function leanOn(node, onGive, onProgress = () => {}) {
  let since = 0, raf = 0;
  const step = () => {
    const k = Math.min(1, (performance.now() - since) / LEAN);
    onProgress(k);
    if (k >= 1) { since = 0; node.classList.remove('leaning'); onGive(); return; }
    raf = requestAnimationFrame(step);
  };
  const start = (e) => { if (since || (e.type === 'keydown' && (e.repeat || !['Enter', ' '].includes(e.key)))) return; if (e.type === 'keydown') e.preventDefault(); since = performance.now(); node.classList.add('leaning'); raf = requestAnimationFrame(step); };
  const stop = () => { if (!since) return; since = 0; cancelAnimationFrame(raf); node.classList.remove('leaning'); onProgress(0); };
  node.addEventListener('pointerdown', start); node.addEventListener('keydown', start);
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur']) node.addEventListener(ev, stop);
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}
const through = () => { document.body.style.transition = 'opacity .5s'; document.body.style.opacity = '0'; setTimeout(() => { location.href = PLAY; }, calm ? 0 : 520); };
/** A stretch of wall with painter's tape on it: hold it and you are through. */
function tapedWall(cls, label) {
  const wall = el('div', cls, el('span', 'strip a'), el('span', 'strip b'), el('span', 'strip c'), el('span', 'sink'));
  wall.tabIndex = 0; wall.setAttribute('role', 'button'); wall.setAttribute('aria-label', label);
  const sink = wall.querySelector('.sink');
  leanOn(wall, through, (k) => { sink.style.opacity = String(k * 0.85); wall.style.setProperty('--drop', `${k * 34}px`); });
  return wall;
}
for (const slot of document.querySelectorAll('.plug[data-plug]')) {
  const ad = ADS[Number(slot.dataset.plug) % ADS.length];
  if (ad.lean) { slot.replaceWith(tapedWall('plug wall small', 'A wall with painter’s tape on it. Press and hold.')); continue; }
  const node = el('div', `plug ${ad.cls}`);
  if (ad.store || ad.hr) { node.tabIndex = 0; node.setAttribute('role', 'button'); } else node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `Spoof advert: ${ad.frames.map((f) => f.filter(Boolean).join('. ')).join('. ')}${ad.slogan ? `. ${ad.slogan}` : ''}`);
  const frames = ad.frames.map(([big, small], i) => {
    const pic = el('i'); pic.dataset.sprite = ad.sprite[0]; if (ad.sprite[1]) pic.dataset.fx = ad.sprite[1]; pic.dataset.scale = String(ad.sprite[2] || 3);
    const parts = small.split('{hits}'), line = el('span', '', parts[0]);
    if (parts.length > 1) { const n = el('span', '', '1'); n.dataset.hits = '1'; line.append(n, parts[1]); }
    return el('span', `f${i ? '' : ' on'}`, pic, el('span', '', el('b', '', big), ad.slogan ? el('em', 'slogan', ad.slogan) : el('br'), line));
  });
  node.append(el('span', 'tag', 'ADVERTISEMENT'), ...frames, el('span', 'cta', ad.cta));
  if (frames.length > 1 && !calm) { let at = 0; setInterval(() => { frames[at].classList.remove('on'); at = (at + 1) % frames.length; frames[at].classList.add('on'); }, 2400); }
  if (ad.store) { const open = (e) => { if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return; e.preventDefault(); modal(storeWin, true); }; node.addEventListener('click', open); node.addEventListener('keydown', open); }
  if (ad.hr) { const open = (e) => { if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return; e.preventDefault(); $('hr-says').textContent = '\u00a0'; modal(hrWin, true); }; node.addEventListener('click', open); node.addEventListener('keydown', open); }
  slot.replaceWith(node);
}
counter(null);
book();

// One more award, for wherever the visitor appears to be: "VOTED 6TH BEST OFFICE PARK / of Portland" (the owner's line).
// The site's host tells the site which city a connection comes from with every request (api/where); it is said to that
// visitor and to nobody else, and not kept. No answer, no city: three awards, as there always were.
(async () => {
  try {
    const res = await fetch('./api/where', { headers: { accept: 'application/json' }, cache: 'no-store' });
    const data = res.ok ? await res.json() : null, city = data && typeof data.city === 'string' ? data.city.trim().slice(0, 40) : '';
    if (city) { $('city').textContent = city; $('voted').hidden = false; }
  } catch { /* nobody said */ }
})();

// windows on the front page: the store, and a relocation notice
const storeWin = $('store'), hrWin = $('hr-notice');
let before = null;
function modal(win, open) {
  if (open) { before = document.activeElement; win.hidden = false; mount(win); win.querySelector('.x').focus(); }
  else { win.hidden = true; before?.focus?.(); }
}
for (const win of [storeWin, hrWin]) {
  win.querySelector('.x').addEventListener('click', () => modal(win, false));
  win.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal(win, false); });
}
$('hr-ok').addEventListener('click', () => modal(hrWin, false));
for (const b of storeWin.querySelectorAll('[data-buy]')) b.addEventListener('click', () => { $('store-says').textContent = 'OUT OF STOCK'; });
for (const b of hrWin.querySelectorAll('[data-hr]')) b.addEventListener('click', () => { $('hr-says').textContent = b.dataset.hr; });

/* ---- things that are not where they were ----------------------------------------------------------- */
mount();

// the colleague in the ceiling tile ducks back up when hovered, clicked, or when C is pressed
const carl = $('ceiling-carl');
if (carl) {
  carl.addEventListener('click', () => carl.classList.toggle('ducked'));
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'c' || e.key === 'C') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) carl.classList.add('ducked');
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'c' || e.key === 'C') carl.classList.remove('ducked'); });
}

// the man from the building site is wherever the visitor is not looking
const slots = [...document.querySelectorAll('.slot[data-slot]')], roamer = $('roamer');
if (roamer && slots.length > 1 && typeof IntersectionObserver === 'function') {
  const shown = new Map(slots.map((s) => [s, false]));
  let home = roamer.parentElement, wasSeen = false;
  const watch = new IntersectionObserver((list) => {
    for (const e of list) shown.set(e.target, e.isIntersecting);
    if (shown.get(home)) { wasSeen = true; return; }
    if (!wasSeen) return;
    const elsewhere = slots.filter((s) => s !== home && !shown.get(s));
    if (!elsewhere.length) return;
    home = elsewhere[(slots.indexOf(home) + 1) % elsewhere.length] || elsewhere[0];
    home.append(roamer); wasSeen = false;
  }, { threshold: 0.01 });
  for (const s of slots) watch.observe(s);
}

// the cardboard figure is nearer each time it has been off screen
const standee = $('standee');
if (standee && typeof IntersectionObserver === 'function') {
  let seen = false, size = 4;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { seen = true; return; }
    if (!seen || size >= 9) return;
    seen = false; size += 1;
    standee.replaceChildren(); delete standee.dataset.mounted; standee.dataset.scale = String(size); mount(standee.parentElement);
  }).observe(standee);
}

for (const a of document.querySelectorAll('a[data-gone]')) a.addEventListener('click', (e) => { e.preventDefault(); a.parentElement.textContent = `${a.textContent} — ${a.dataset.gone}`; });

/* ---- the lift ----------------------------------------------------------------------------------- */
const lift = document.querySelector('.lift');
const watchFloor = typeof IntersectionObserver === 'function' ? new IntersectionObserver((list) => {
  for (const e of list) if (e.isIntersecting) for (const a of lift.querySelectorAll('a')) a.classList.toggle('here', a.getAttribute('href') === `#${e.target.id}`);
}, { rootMargin: '-45% 0px -45% 0px' }) : null;
for (const a of lift.querySelectorAll('a')) { const zone = document.querySelector(a.getAttribute('href')); if (zone) watchFloor?.observe(zone); }

/* ---- the bottom of the page, and the lift's music -------------------------------------------------- */
// Each time somebody reaches the bottom there is another floor under it, and under the last a stretch of wall.
let audio = null, subDepth = 0;
const tuneAudio = () => {
  if (!audio) return;
  audio.preservesPitch = false; audio.mozPreservesPitch = false; audio.webkitPreservesPitch = false;
  audio.playbackRate = Math.max(0.68, 1 - subDepth * 0.045);
};
const DEEPER = [
  { name: 'B9', bg: '#c9b8a0' },
  { name: 'B10', bg: '#b8c9a8', sprite: ['cooler', '', 4] },
  { name: 'B11', bg: '#9eb49a' },
  { name: 'B12', bg: '#a8b0c4', sprite: ['moth', 'bob', 3] },
  { name: 'B13', bg: '#8f8968', sprite: ['ceiling_carl', '', 3] },
];
if (typeof IntersectionObserver === 'function') {
  let depth = 0, busy = false;
  const grow = () => {
    if (busy || depth > DEEPER.length) return;
    busy = true;
    setTimeout(() => {
      busy = false;
      const id = `b${9 + depth}`;
      let floor, name;
      if (depth < DEEPER.length) {
        const d = DEEPER[depth]; name = d.name;
        const pic = d.sprite ? (() => { const i = el('i'); i.dataset.sprite = d.sprite[0]; if (d.sprite[1]) i.dataset.fx = d.sprite[1]; i.dataset.scale = String(d.sprite[2]); return el('p', 'center', i); })() : null;
        floor = el('div', 'floor', el('b', '', name), pic);
        floor.style.background = d.bg;
      } else {
        name = '?'; floor = tapedWall('wall', 'A wall with painter’s tape on it. Press and hold.');
      }
      floor.id = id; $('deeper').append(floor); mount(floor);
      const btn = el('a', '', name); btn.href = `#${id}`; lift.append(btn); watchFloor?.observe(floor);
      depth++; subDepth = depth; tuneAudio();
    }, calm ? 0 : 900);
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) grow(); }, { rootMargin: '0px 0px 40px 0px' }).observe($('sentinel'));
  // (a sentinel still in view after the page has grown has to be asked again)
  setInterval(() => { const r = $('sentinel').getBoundingClientRect(); if (r.top < innerHeight + 40 && depth <= DEEPER.length && document.visibilityState === 'visible') grow(); }, 1400);
}

// The lift's music, from the office upstairs (public/audio/elevator-muzak.mp3; the build puts it beside the page as
// muzak.mp3), round and round. Off until asked for, and off again when the page is put away.
const says = (on) => { const btn = $('midi'); btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'MUSIC: ON' : 'MUSIC: OFF'; };
function music(on) {
  if (audio) { audio.pause(); audio = null; }
  if (on) {
    const a = new Audio('./muzak.mp3');
    a.loop = true; a.volume = 0.5; audio = a; tuneAudio();
    a.play().catch(() => { if (audio === a) { audio = null; says(false); } });       // no sound to be had: the switch goes back
  }
  says(!!audio);
}
$('midi').addEventListener('click', () => music(!audio));
document.addEventListener('visibilitychange', () => { if (document.hidden && audio) music(false); });
