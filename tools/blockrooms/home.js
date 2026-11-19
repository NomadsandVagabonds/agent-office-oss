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
import { DIFFICULTIES, cleanDifficulty, difficultyOf, difficultyPerk } from './core/difficulty.mjs';
import { mountTrailer } from './trailer-player.js';
import { mount, drawLogo, voidTile } from './art.js';
import { rollName, cleanName, cleanMessage, cleanEntry } from './core/book.mjs';
import { GENDER, SPECIES, HAIR, OUTFIT, ACCESSORY, FACIAL, SKIN, HAIR_COLORS, OUTFIT_COLORS, hashId, humanGenderDefaults, resolveLook, sanitizeLookPatch } from './core/look.mjs';
import { DEFAULT_PERK, PERK_LIST, cleanPerk, resolvePerk } from './core/perks.mjs';
import { cleanRecord, emptyRecord } from './core/runs.mjs';
import { paintFlatCharacter } from './world/art/character.js';
import { archive, onArchive, signInGoogle, startAccounts } from './archive-client.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };
const num = (n) => Number(n || 0).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const day = (at) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* until the page closes */ } } };
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PLAY = './play';

// The door is always a plain play link. Guests only contact the accounts service when they ask to sign in.
const provider = $('save-progress').dataset.accounts;
const saveButton = $('save-sign-in'), saveMessage = $('save-message');
const returnUrl = new URL(location.href);
const result = returnUrl.searchParams.get('signin');
const cloudReturn = provider === 'cloudflare' && (result === 'complete' || result === 'failed');
const supabaseReturn = provider === 'supabase' && (returnUrl.searchParams.has('code') || returnUrl.searchParams.has('error'));
let notice = '', opening = false, accountState;
if (cloudReturn) {
  returnUrl.searchParams.delete('signin');
  history.replaceState(history.state, '', returnUrl);
}
const retrySignIn = 'Sign-in didn’t finish. Try again when you’re ready.';
if (cloudReturn && result === 'failed') notice = retrySignIn;
function renderHomeAccount() {
  saveButton.hidden = !provider || !!accountState.user;
  saveButton.disabled = opening;
  let message = notice;
  if (accountState.user) {
    if (accountState.phase === 'error') message = accountState.message;
    else message = accountState.phase === 'synced' ? 'Signed in · Progress synced' : 'Signed in';
  }
  if (saveMessage.textContent !== message) saveMessage.textContent = message;
}
onArchive(state => { accountState = state; renderHomeAccount(); });
const returning = (cloudReturn && result === 'complete') || supabaseReturn;
startAccounts({ force: returning }).then(() => {
  if (returning && !accountState.user) { notice = retrySignIn; renderHomeAccount(); }
  if (supabaseReturn) location.hash = 'enter';
}).catch(() => { notice = 'Cloud saves are offline. You can still play.'; renderHomeAccount(); });
saveButton.addEventListener('click', async () => {
  if (opening) return;
  opening = true; notice = 'Opening sign-in…'; renderHomeAccount();
  try {
    await startAccounts({ force: true });
    if (accountState.user) { opening = false; notice = ''; renderHomeAccount(); return; }
    if (!accountState.configured) throw Error('Cloud saves are offline. You can still play.');
    if (accountState.providers?.google === false) location.assign('./archive#email');
    else await signInGoogle({ returnTo: 'home' });
  } catch {
    opening = false; notice = 'Sign-in is unavailable. Try again or enter as a guest.'; renderHomeAccount();
  }
});
window.addEventListener('pageshow', event => {
  if (event.persisted && opening) { opening = false; notice = ''; renderHomeAccount(); }
});

// Difficulty: a row of buttons under the door, one pressed (a radio group: arrow keys move it, as a select did)
const difficultyRow = $('difficulty'), difficultyButtons = [];
const difficultyField = { value: cleanDifficulty(store.get('office.backrooms')?.difficulty) };
const difficultyNote = () => { $('difficulty-note').textContent = difficultyOf(difficultyField.value).note; };
function chooseDifficulty(id, focus = false) {
  difficultyField.value = cleanDifficulty(id);
  for (const b of difficultyButtons) {
    const on = b.dataset.id === difficultyField.value;
    b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('on', on);
    if (on && focus) b.focus();
  }
  store.set('office.backrooms', { ...store.get('office.backrooms'), difficulty: difficultyField.value });
  difficultyNote();
}
for (const d of DIFFICULTIES) {
  const b = el('button', 'diff', d.label);
  if (d.id === 'easy') b.append(el('small', '', 'recommended'));
  Object.assign(b, { type: 'button' }); b.dataset.id = d.id; b.setAttribute('role', 'radio');
  b.addEventListener('click', () => { chooseDifficulty(d.id); refreshPassSummary(); syncStudioUI(); });
  difficultyButtons.push(b); difficultyRow.append(b);
}
difficultyRow.addEventListener('keydown', (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const at = difficultyButtons.findIndex((b) => b.dataset.id === difficultyField.value);
  chooseDifficulty(difficultyButtons[(at + step + difficultyButtons.length) % difficultyButtons.length].dataset.id, true);
  refreshPassSummary(); syncStudioUI();
});
chooseDifficulty(difficultyField.value);

// a link to a tape from before there was a front page goes straight to the level
if (new URLSearchParams(location.search).has('tape')) location.replace(PLAY + location.search);

/* ---- pictures ------------------------------------------------------------------------------------ */
drawLogo($('logo'));
$('top').style.backgroundImage = `url(${voidTile()})`;
document.querySelector('.plugrow').style.backgroundImage = $('top').style.backgroundImage;

/* ---- signing, employee pass & kit studio --------------------------------------------------------- */
const ME = 'blockrooms:me';
// (a name is typed; until one is, the visitor is down under a made-up one; looks & kits stay optional)
let me = (() => {
  const was = store.get(ME) || {}, typed = cleanName(was.name), spare = cleanName(was.spare) || archive.profile().name;
  const patch = sanitizeLookPatch(was.look).look;
  const customLook = !!was.customLook && Object.keys(patch).length > 0;
  return {
    name: typed || spare,
    typed: !!typed && typed !== spare,
    spare,
    message: cleanMessage(was.message) || '',
    customLook,
    look: customLook ? patch : {},
    perk: cleanPerk(was.perk),
  };
})();
const keep = () => store.set(ME, {
  name: me.name,
  spare: me.spare,
  message: me.message,
  customLook: me.customLook,
  look: me.customLook ? me.look : {},
  perk: me.perk,
});
keep();

const SPECIES_DEFAULT_SKIN = {
  human: '#e6b184',
  robot: '#8a93a8',
  goblin: '#7fa35a',
  dog: '#c99a62',
  cat: '#e0a060',
  alien: '#e0a638',
};
const SKIN_SWATCHES = [...SKIN, '#e3aa84', '#e0a638', '#6d4428', '#7fa35a', '#5f8a6a', '#c99a62', '#e0a060', '#9a9aa6', '#3a3a44', '#8a93a8', '#8fd3ff'];
const HAIR_SWATCHES = [...HAIR_COLORS, '#db7093', '#b53a2a', '#ff5ad6', '#3bd6ff', '#62d94f', '#ff8a1f', '#e8e4f0'];
const OUTFIT_SWATCHES = [...OUTFIT_COLORS, '#dfa22e', '#e88fb0', '#1f4ea8', '#d9483b', '#d9a426', '#24262e'];
const WILD_SKINS = ['#e0a638', '#7fa35a', '#8fd3ff', '#f4a8c0', '#ffd83a', '#b695ff', '#e0a060', '#5fd6a8'];
const WILD_DYES = ['#db7093', '#ff5ad6', '#3bd6ff', '#62d94f', '#ff8a1f', '#ffd83a', '#9c5aff', '#ff3a26', '#ffffff'];
const WILD_OUTFITS = ['#dfa22e', '#e88fb0', '#ff3a26', '#2a52be', '#ffd83a', '#1f9d55', '#9c3bc9', '#ff7a1f', '#1eb8c9', '#d9388a'];

const LABELS = {
  gender: { male: 'Male (Boy)', female: 'Female (Girl)' },
  species: { human: 'Human', alien: 'Alien', robot: 'Robot', goblin: 'Goblin', dog: 'Dog', cat: 'Cat' },
  hair: { short: 'Short', side: 'Side Part', long: 'Long', braids: 'Side Braid', bun: 'Top Bun', mohawk: 'Mohawk', bald: 'Bald', cap: 'Cap', beanie: 'Beanie' },
  facial: { none: 'Clean', lashes: 'Lashes & Hoops', mustache: 'Mustache', beard: 'Beard' },
  outfit: { tee: 'T-Shirt', hoodie: 'Hoodie', suit: 'Suit & Tie', consul: 'Consul Suit', vest: 'Vest', cardigan: 'Cardigan', tunic: 'Choker Tunic' },
  accessory: {
    none: 'None', goggles: 'Goggles', cowboy: 'Cowboy Hat', hoops: 'Hoop Rings', glasses: 'Glasses', shades: 'Shades', monocle: 'Monocle', eyepatch: 'Eyepatch', headphones: 'Phones',
    flower: 'Flower', partyhat: 'Party Hat', propeller: 'Propeller', tophat: 'Top Hat', crown: 'Crown', halo: 'Halo',
  },
};

const PRESETS = [
  { label: 'Yellow Alien', look: { gender: 'male', species: 'alien', skin: '#e0a638', hair: 'bald', hairColor: '#241608', facial: 'none', outfit: 'consul', outfitColor: '#dfa22e', accessory: 'goggles' } },
  { label: 'Pink Cowgirl', look: { gender: 'female', species: 'human', skin: '#e3aa84', hair: 'braids', hairColor: '#db7093', facial: 'lashes', outfit: 'tunic', outfitColor: '#e88fb0', accessory: 'cowboy' } },
  { label: '98 Intern', look: { gender: 'male', species: 'human', skin: '#f3cda8', hair: 'side', hairColor: '#4a2f1a', facial: 'none', outfit: 'vest', outfitColor: '#3f7f9a', accessory: 'glasses' } },
  { label: '98 Archivist', look: { gender: 'female', species: 'human', skin: '#f3cda8', hair: 'long', hairColor: '#7d5836', facial: 'none', outfit: 'cardigan', outfitColor: '#8a5a8f', accessory: 'glasses' } },
  { label: 'Exec Suit', look: { gender: 'male', species: 'human', skin: '#cd8d5e', hair: 'short', hairColor: '#9aa0ac', facial: 'mustache', outfit: 'suit', outfitColor: '#5a5a66', accessory: 'monocle' } },
  { label: 'Goblin Clerk', look: { gender: 'male', species: 'goblin', skin: '#6b9460', hair: 'short', hairColor: '#241608', facial: 'mustache', outfit: 'cardigan', outfitColor: '#8a5a8f', accessory: 'glasses' } },
  { label: 'CRT Bot', look: { gender: 'male', species: 'robot', skin: '#8a93a8', hair: 'short', hairColor: '#15151c', facial: 'none', outfit: 'hoodie', outfitColor: '#b5483f', accessory: 'headphones' } },
  { label: 'Night Cat', look: { gender: 'female', species: 'cat', skin: '#3a3a44', hair: 'beanie', hairColor: '#15151c', facial: 'none', outfit: 'hoodie', outfitColor: '#3f8a72', accessory: 'shades' } },
  { label: 'Party Dog', look: { gender: 'male', species: 'dog', skin: '#e3c79a', hair: 'short', hairColor: '#7d5836', facial: 'none', outfit: 'tee', outfitColor: '#c9893f', accessory: 'partyhat' } },
  { label: 'Propeller IT', look: { gender: 'male', species: 'human', skin: '#dcab8b', hair: 'bald', hairColor: '#4a2f1a', facial: 'beard', outfit: 'tee', outfitColor: '#5a6fa8', accessory: 'propeller' } },
  { label: 'VIP Cat', look: { gender: 'female', species: 'cat', skin: '#f1e6d2', hair: 'bun', hairColor: '#caa05a', facial: 'none', outfit: 'suit', outfitColor: '#8a5a8f', accessory: 'crown' } },
];

const POSES = [
  ['idle', 'Idle'],
  ['walk', 'Walk'],
  ['sip', 'Coffee'],
  ['typing', 'Typing'],
  ['blocked', 'Panic'],
];
const BACKDROPS = [
  ['paper', 'B1 Paper'],
  ['pool', 'B2 Pool'],
  ['carpet', 'B3 Exec'],
  ['void', 'Void'],
];

const activeLook = () => (me.customLook ? resolveLook(`visitor:${me.name}`, me.look) : resolveLook(`visitor:${me.name}`));

function blitPixCrop(ctx, pix, { sx = 0, sy = 0, sw = pix.w, sh = pix.h, dx = 0, dy = 0, scale = 2, back = false } = {}) {
  for (let r = 0; r < sh; r++) {
    const j = sy + r;
    if (j < 0 || j >= pix.h) continue;
    for (let c = 0; c < sw; c++) {
      const srcI = sx + c;
      const i = back ? pix.w - 1 - srcI : srcI;
      if (i < 0 || i >= pix.w) continue;
      const cell = pix.cells[j * pix.w + i];
      if (!cell) continue;
      const col = cell[cell.length - 1];
      ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
      ctx.fillRect(dx + c * scale, dy + r * scale, scale, scale);
    }
  }
}

function paintBackdrop(ctx, w, h, kind) {
  if (kind === 'pool') {
    ctx.fillStyle = '#d4ece8'; ctx.fillRect(0, 0, w, h);
    const floorY = Math.round(h * 0.78);
    ctx.strokeStyle = 'rgba(78, 128, 134, 0.35)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, floorY); ctx.stroke(); }
    for (let y = 0; y < floorY; y += 16) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    ctx.fillStyle = '#5fb3bf'; ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#9ee2ea'; ctx.fillRect(0, floorY, w, 4);
    return;
  }
  if (kind === 'carpet') {
    const railY = Math.round(h * 0.54), floorY = Math.round(h * 0.8);
    ctx.fillStyle = '#efe2c4'; ctx.fillRect(0, 0, w, railY);
    ctx.fillStyle = '#774e29'; ctx.fillRect(0, railY, w, floorY - railY);
    ctx.fillStyle = '#bd8a53'; ctx.fillRect(0, railY, w, 4);
    ctx.fillStyle = '#8d3b3b'; ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#e7c79a'; ctx.fillRect(0, floorY + 4, w, 2);
    return;
  }
  if (kind === 'void') {
    const floorY = Math.round(h * 0.8);
    ctx.fillStyle = '#07070b'; ctx.fillRect(0, 0, w, floorY);
    ctx.fillStyle = 'rgba(255, 232, 160, 0.65)';
    for (let y = 10; y < floorY - 18; y += 26) {
      for (let x = 14; x < w - 18; x += 38) {
        ctx.fillRect(x, y, 14, 4);
      }
    }
    ctx.fillStyle = '#181820'; ctx.fillRect(0, floorY, w, h - floorY);
    ctx.fillStyle = '#2d2d3a'; ctx.fillRect(0, floorY, w, 3);
    return;
  }
  // B1 yellow wallpaper
  const floorY = Math.round(h * 0.8);
  ctx.fillStyle = '#d6c56c'; ctx.fillRect(0, 0, w, floorY);
  ctx.fillStyle = 'rgba(165, 138, 42, 0.24)';
  for (let x = 6; x < w; x += 18) ctx.fillRect(x, 0, 3, floorY);
  ctx.fillStyle = '#fffbe0'; ctx.fillRect(Math.round(w * 0.22), 0, Math.round(w * 0.56), 4);
  ctx.fillStyle = '#5b4127'; ctx.fillRect(0, floorY - 6, w, 6);
  ctx.fillStyle = '#6f6a50'; ctx.fillRect(0, floorY, w, h - floorY);
}

function drawPassMug() {
  const canvas = $('pass-mug');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paintBackdrop(ctx, 56, 56, 'paper');
  const pix = paintFlatCharacter(activeLook(), { pose: 'idle' });
  blitPixCrop(ctx, pix, { sx: 2, sy: 20, sw: 28, sh: 28, dx: 0, dy: 2, scale: 2 });
}

// The pass's picture: the real figure, turning, as the studio shows it (the same rig, its own small renderer), drawn only
// while the pass is on screen. Until it has loaded, or on a machine that cannot, the flat portrait stands in.
const pass3d = { d: null, failed: false, loading: false, raf: 0, key: '', seen: true, last: 0 };
function startPass3D() {
  if (pass3d.d || pass3d.failed || pass3d.loading) return;
  pass3d.loading = true;
  Promise.all([import('three'), import('./world/avatar/rig.js'), import('./world/vox/material.js')]).then(([THREE, { Avatar }, { voxelUniforms }]) => {
    const canvas = $('pass-3d');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth || 64, canvas.clientHeight || 80, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEMES_3D.paper.bg);
    const camera = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 64) / (canvas.clientHeight || 80), 0.1, 20);
    camera.position.set(0, 0.86, 3.1); camera.lookAt(0, 0.78, 0);
    const sun = new THREE.DirectionalLight('#fff3d1', 2.3); sun.position.set(1.8, 3.2, 2.5);
    scene.add(new THREE.HemisphereLight('#fff9e2', '#786b42', 1.6), sun, sun.target);
    const turn = new THREE.Group(); scene.add(turn);
    pass3d.d = { THREE, Avatar, voxelUniforms, renderer, scene, camera, turn, avatar: null };
    canvas.hidden = false; $('pass-mug').hidden = true;
    if (typeof IntersectionObserver === 'function') new IntersectionObserver((seen) => { pass3d.seen = seen.some((x) => x.isIntersecting); if (pass3d.seen) passTick(performance.now()); }).observe(canvas);
    syncPass3D(); passTick(performance.now());
  }).catch(() => { pass3d.failed = true; $('pass-3d').hidden = true; $('pass-mug').hidden = false; });
}
function syncPass3D() {
  const d = pass3d.d; if (!d) return;
  const look = activeLook(), key = JSON.stringify(look);
  if (key === pass3d.key && d.avatar) return;
  if (d.avatar) { d.turn.remove(d.avatar.root); d.avatar.dispose(); }
  d.avatar = new d.Avatar(look, { seed: `visitor:${me.name}` });
  d.avatar.setPose?.('stand');
  d.turn.add(d.avatar.root); pass3d.key = key;
}
function passTick(ms) {
  const d = pass3d.d; pass3d.raf = 0;
  if (!d) return;
  const dt = Math.min(0.1, Math.max(0, (ms - (pass3d.last || ms)) / 1000)); pass3d.last = ms;
  d.voxelUniforms.uTime.value = ms / 1000;
  if (!calm) d.turn.rotation.y += dt * 0.9;
  d.avatar?.update(calm ? 0 : dt, calm);
  d.renderer.render(d.scene, d.camera);
  if (!calm && pass3d.seen && !document.hidden) pass3d.raf = requestAnimationFrame(passTick);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && pass3d.d && !pass3d.raf) pass3d.raf = requestAnimationFrame(passTick); });
// (after the page has drawn, so that nothing on the front page waits for it)
(window.requestIdleCallback || ((f) => setTimeout(f, 600)))(() => startPass3D());

function drawBarcode(seedText) {
  const canvas = $('card-barcode');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let s = hashId(seedText) || 1;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
  ctx.fillStyle = '#111111';
  let x = 6;
  while (x < canvas.width - 6) {
    const w = 1 + (next() % 3);
    if (x + w < canvas.width - 6) ctx.fillRect(x, 2, w, canvas.height - 4);
    x += w + 1 + (next() % 3);
  }
}

function refreshPassSummary() {
  const p = difficultyPerk(resolvePerk(me.perk), difficultyField.value);
  const mode = $('pass-mode');
  mode.textContent = me.customLook ? 'CUSTOM EMPLOYEE PASS' : 'RANDOM VISITOR (DEFAULT)';
  mode.classList.toggle('custom', me.customLook);
  $('pass-kit').textContent = `${p.code} · ${p.name} (${p.cost}/1 PT)`;
  $('pass-stats').textContent = `${p.maxHealth} ♥ · ${p.pockets} POCKETS · ${clock(p.cameraStart)} TAPE`;
  drawPassMug();
  syncPass3D(); if (pass3d.d && calm) passTick(performance.now());
}

const nameBox = $('name'), nameSays = $('name-says'), messageBox = $('message'), messageSays = $('message-says');
const creatorNameBox = $('creator-name');
let syncStudioUI = () => {};

function named(value, fromStudio = false) {
  const typed = cleanName(value), bad = !typed && !!String(value).trim();
  nameBox.classList.toggle('bad', bad); nameSays.classList.toggle('bad', bad);
  nameSays.textContent = bad ? '16 characters at most. Letters and numbers.' : '';
  me = { ...me, name: typed || me.spare, typed: !!typed };
  if (fromStudio) nameBox.value = me.typed ? me.name : '';
  else creatorNameBox.value = me.typed ? me.name : '';
  nameBox.placeholder = me.spare;
  creatorNameBox.placeholder = me.spare;
  keep();
  refreshPassSummary();
  syncStudioUI();
  archive.edit({ name: me.name });
}
function said(value) {
  const text = cleanMessage(value), bad = text === null;
  messageBox.classList.toggle('bad', bad); messageSays.classList.toggle('bad', bad);
  messageSays.textContent = bad ? '60 characters at most. No links.' : '';
  me = { ...me, message: text || '' };
  keep();
}
function rollVisitorName() {
  const spare = rollName();
  me = { ...me, spare, name: spare, typed: false };
  nameBox.value = ''; nameBox.placeholder = spare;
  creatorNameBox.value = ''; creatorNameBox.placeholder = spare;
  named('');
}

nameBox.placeholder = me.spare; nameBox.value = me.typed ? me.name : '';
creatorNameBox.placeholder = me.spare; creatorNameBox.value = me.typed ? me.name : '';
nameBox.addEventListener('input', () => named(nameBox.value, false));
creatorNameBox.addEventListener('input', () => named(creatorNameBox.value, true));
messageBox.value = me.message;
messageBox.addEventListener('input', () => said(messageBox.value));
$('reroll').addEventListener('click', rollVisitorName);
$('creator-reroll').addEventListener('click', rollVisitorName);
$('signin').addEventListener('submit', async (e) => { e.preventDefault(); await archive.edit({ name: me.name }); location.href = PLAY; });

/* ---- the guestbook, once somebody has got out ------------------------------------------------------ */
// Nobody is asked to sign before they have been in. A visit that gets out leaves its report here (site.js, at the
// score card); the next time this page is open it asks, once, with the name they went in under. Signing is what puts
// a name in the high scores, so it stays a choice made after the fact. (No time limit: the book checks the visit
// itself, core/book.mjs.)
const UNSIGNED = 'blockrooms:unsigned';
const signForm = $('sign'), signSays = $('sign-says');
function pendingSign() {
  const p = store.get(UNSIGNED);
  return p && p.run && typeof p.run === 'object' ? p : null;
}
function showSign() {
  const p = pendingSign();
  signForm.hidden = !p;
  if (!p) return;
  const score = Number(p.score) || 0;
  $('sign-what').textContent = `${cleanName(p.name) || me.name}${score ? ` · ${num(score)} points` : ''}`;
}
signForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p = pendingSign(); if (!p) { showSign(); return; }
  const message = cleanMessage(messageBox.value);
  if (message === null) { said(messageBox.value); return; }
  const go = $('sign-it'); go.disabled = true; signSays.textContent = 'Signing…';
  let answer = null;
  try {
    const res = await fetch('./api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'sign', name: cleanName(p.name) || me.name, look: p.look, message: message || '', run: p.run, ticket: p.ticket }) });
    answer = await res.json();
  } catch { answer = null; }
  go.disabled = false;
  if (answer?.ok || answer?.why === 'signed') {
    store.set(UNSIGNED, null);
    signSays.textContent = answer?.place ? `Signed. You are № ${answer.place}.` : 'Signed.';
    setTimeout(() => { signForm.hidden = true; signSays.textContent = ''; }, 2600);
    refreshBook();
  } else if (answer?.text) signSays.textContent = answer.text;
  else if (answer?.why === 'slow') signSays.textContent = 'Too quick. Try again in a minute.';
  else signSays.textContent = 'The book is not answering. Try again later.';
});
$('sign-skip').addEventListener('click', () => { store.set(UNSIGNED, null); signForm.hidden = true; });
showSign();

/* ---- studio workbench (#creator) ------------------------------------------------------------------- */
const THEMES_3D = {
  paper: { bg: '#cfc27c', sky: '#fff9e2', ground: '#786b42', sun: '#fff3d1', rim: '#b8ccff', disc: '#827549', ring: '#bca463' },
  pool: { bg: '#bce3e0', sky: '#ecffff', ground: '#4a8c95', sun: '#ffffff', rim: '#7eeaf5', disc: '#4d9ba7', ring: '#e4f8f8' },
  carpet: { bg: '#dfd0b2', sky: '#fff1d9', ground: '#6d3931', sun: '#ffe6bf', rim: '#bbc6ea', disc: '#843333', ring: '#d4a65e' },
  void: { bg: '#0c0c14', sky: '#9aa4dc', ground: '#221e2e', sun: '#ffeaa8', rim: '#6f8cff', disc: '#1e1e2b', ring: '#dbc36d' },
};

const studio = {
  open: false,
  built: false,
  raf: 0,
  lastMs: 0,
  back: false,
  spinMode: calm ? 'front' : 'auto',
  yaw: calm ? 0.28 : 0.34,
  dragging: false,
  zoom: false,
  pose: 'idle',
  backdrop: 'paper',
  tab: 'look',
  pins: new Set(),
  rollCount: 0,
  thumbs: {},
  swatches: {},
  perkCards: new Map(),
  returnFocus: null,
  d3: null,
  d3Promise: null,
  d3Failed: false,
};

function setCustomLook(patch) {
  const base = activeLook();
  const merged = { ...base, ...patch };
  const clean = sanitizeLookPatch(merged).look;
  me = { ...me, customLook: true, look: clean };
  keep();
  archive.edit({ character: clean });          // (the archive keeps the character too: signed in, it is what every device gets)
  refreshPassSummary();
  syncStudioUI();
}

/** Compute unpinned human default adaptations when switching between Male (Boy) and Female (Girl). */
function genderTransitionPatch(cur, nextGender, pins = studio.pins, forceDefaults = false) {
  const patch = { gender: nextGender };
  if (cur.species !== 'human') return patch;
  const defs = humanGenderDefaults(nextGender);
  if (forceDefaults) {
    if (!pins.has('hair')) patch.hair = defs.hair;
    if (!pins.has('facial')) patch.facial = defs.facial;
    if (!pins.has('outfit')) patch.outfit = defs.outfit;
    if (!pins.has('outfitColor')) patch.outfitColor = defs.outfitColor;
    if (!pins.has('accessory')) patch.accessory = defs.accessory;
    return patch;
  }
  if (nextGender === 'female') {
    if (!pins.has('hair') && ['short', 'side', 'bald', 'mohawk', 'cap'].includes(cur.hair)) patch.hair = defs.hair;
    if (!pins.has('facial') && ['mustache', 'beard'].includes(cur.facial)) patch.facial = 'none';
    if (!pins.has('outfit') && ['tee', 'suit', 'consul', 'vest'].includes(cur.outfit)) patch.outfit = defs.outfit;
    if (!pins.has('outfitColor') && String(cur.outfitColor || '').toLowerCase() === '#3f7f9a') patch.outfitColor = defs.outfitColor;
  } else {
    if (!pins.has('hair') && ['long', 'braids', 'bun'].includes(cur.hair)) patch.hair = defs.hair;
    if (!pins.has('facial') && cur.facial === 'lashes') patch.facial = 'none';
    if (!pins.has('outfit') && ['cardigan', 'tunic'].includes(cur.outfit)) patch.outfit = defs.outfit;
    if (!pins.has('outfitColor') && String(cur.outfitColor || '').toLowerCase() === '#8a5a8f') patch.outfitColor = defs.outfitColor;
    if (!pins.has('accessory') && cur.accessory === 'hoops') patch.accessory = 'none';
  }
  return patch;
}

function rollRandomLook() {
  studio.rollCount += 1;
  const seed = `${Date.now()}:${Math.random()}:${studio.rollCount}`;
  const h = hashId(seed);
  const pickFrom = (arr, shift) => arr[(h >>> shift) % arr.length];
  const wild = $('wild-colors').checked;
  const cur = activeLook();
  const nextGender = studio.pins.has('gender') ? cur.gender : pickFrom(GENDER, 24);
  const nextSpecies = studio.pins.has('species') ? cur.species : pickFrom(SPECIES, 0);
  const speciesSkin = SPECIES_DEFAULT_SKIN[nextSpecies] || SKIN[0];
  const humanGirl = nextSpecies === 'human' && nextGender === 'female';
  const humanBoy = nextSpecies === 'human' && nextGender === 'male';
  const hairChoices = humanGirl
    ? ['long', 'braids', 'bun', 'side', 'short', 'beanie']
    : humanBoy
      ? ['short', 'side', 'cap', 'beanie', 'mohawk', 'bald']
      : (nextSpecies === 'alien' ? ['bald', 'bald', 'cap', 'beanie'] : HAIR);
  const facialChoices = humanGirl
    ? ['none', 'none', 'lashes']
    : humanBoy
      ? ['none', 'none', 'mustache', 'beard']
      : FACIAL;
  const outfitChoices = humanGirl
    ? ['cardigan', 'hoodie', 'tunic', 'vest', 'tee', 'suit']
    : humanBoy
      ? ['tee', 'hoodie', 'suit', 'consul', 'vest', 'cardigan']
      : OUTFIT;
  const accChoices = humanBoy ? ACCESSORY.filter((a) => a !== 'hoops') : ACCESSORY;
  const next = {
    gender: nextGender,
    species: nextSpecies,
    skin: studio.pins.has('skin') ? cur.skin : (wild ? pickFrom(WILD_SKINS, 3) : (nextSpecies === 'human' ? pickFrom(SKIN, 3) : speciesSkin)),
    hair: studio.pins.has('hair') ? cur.hair : pickFrom(hairChoices, 6),
    hairColor: studio.pins.has('hairColor') ? cur.hairColor : pickFrom(wild ? WILD_DYES : HAIR_COLORS, 9),
    facial: studio.pins.has('facial') ? cur.facial : pickFrom(facialChoices, 12),
    outfit: studio.pins.has('outfit') ? cur.outfit : pickFrom(outfitChoices, 15),
    outfitColor: studio.pins.has('outfitColor') ? cur.outfitColor : pickFrom(wild ? WILD_OUTFITS : OUTFIT_COLORS, 18),
    accessory: studio.pins.has('accessory') ? cur.accessory : pickFrom(accChoices, 21),
  };
  setCustomLook(next);
}

$('quick-roll').addEventListener('click', () => rollRandomLook());

function applyAvatarPose3D(avatar, poseName) {
  if (!avatar) return;
  if (poseName === 'walk') {
    avatar.hold(null);
    avatar.bounce = 0;
    avatar.walking = 1;
    avatar.speed = 1;
    avatar.setPose('stand');
    avatar.setExpression('neutral');
  } else if (poseName === 'sip') {
    avatar.walking = 0;
    avatar.bounce = 0;
    avatar.hold('mug');
    avatar.setPose('sip');
    avatar.setExpression('happy');
  } else if (poseName === 'typing') {
    avatar.hold(null);
    avatar.walking = 0;
    avatar.bounce = 0;
    avatar.setPose('type');
    avatar.setExpression('focus');
  } else if (poseName === 'blocked') {
    avatar.hold(null);
    avatar.walking = 0;
    avatar.bounce = 0.65;
    avatar.setPose('wave');
    avatar.setExpression('worried');
  } else {
    avatar.hold(null);
    avatar.walking = 0;
    avatar.bounce = 0;
    avatar.setPose('stand');
    if (avatar.expression !== 'blink') avatar.setExpression('neutral');
  }
}

function applyBackdrop3D() {
  const d3 = studio.d3;
  const th = THEMES_3D[studio.backdrop] || THEMES_3D.paper;
  $('stage-viewport').style.background = th.bg;
  if (!d3) return;
  d3.scene.background.set(th.bg);
  d3.hemi.color.set(th.sky);
  d3.hemi.groundColor.set(th.ground);
  d3.sun.color.set(th.sun);
  d3.rim.color.set(th.rim);
  d3.discMat.color.set(th.disc);
  d3.ringMat.color.set(th.ring);
}

function syncStage3DSize() {
  const d3 = studio.d3;
  if (!d3) return;
  const rect = $('stage-viewport').getBoundingClientRect();
  const w = Math.max(64, Math.round(rect.width || 204));
  const h = Math.max(64, Math.round(rect.height || 224));
  if (d3.w === w && d3.h === h) return;
  d3.w = w;
  d3.h = h;
  d3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  d3.renderer.setSize(w, h, false);
  d3.camera.aspect = w / h;
  d3.camera.updateProjectionMatrix();
}

function syncAvatar3D() {
  const d3 = studio.d3;
  if (!d3) return;
  const look = activeLook();
  const key = JSON.stringify(look);
  if (d3.lookKey !== key) {
    if (d3.avatar) {
      d3.avatarHolder.remove(d3.avatar.root);
      d3.avatar.dispose();
    }
    d3.avatar = new d3.Avatar(look, { seed: `visitor:${me.name}` });
    d3.avatarHolder.add(d3.avatar.root);
    d3.lookKey = key;
    d3.poseKey = '';
  }
  if (d3.poseKey !== studio.pose) {
    applyAvatarPose3D(d3.avatar, studio.pose);
    if (studio.pose === 'idle') d3.avatar.snap('stand');
    d3.poseKey = studio.pose;
  }
}

function ensureStage3D() {
  if (studio.d3 || studio.d3Failed) return studio.d3Promise;
  if (studio.d3Promise) return studio.d3Promise;
  studio.d3Promise = Promise.all([
    import('three'),
    import('./world/avatar/rig.js'),
    import('./world/vox/material.js'),
  ]).then(([THREE, { Avatar }, { voxelUniforms }]) => {
    const canvas = $('char-stage-3d');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(THEMES_3D.paper.bg);
    const camera = new THREE.PerspectiveCamera(34, 204 / 224, 0.1, 20);
    camera.position.set(0, 0.90, 2.72);
    camera.lookAt(0, 0.76, 0);

    const hemi = new THREE.HemisphereLight('#fff9e2', '#786b42', 1.6);
    const sun = new THREE.DirectionalLight('#fff3d1', 2.45);
    sun.position.set(1.8, 3.2, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 9;
    sun.shadow.camera.left = -1.1;
    sun.shadow.camera.right = 1.1;
    sun.shadow.camera.top = 1.9;
    sun.shadow.camera.bottom = -0.3;
    sun.shadow.bias = -0.0008;
    const rim = new THREE.DirectionalLight('#b8ccff', 0.85);
    rim.position.set(-2.0, 1.8, -2.2);
    scene.add(hemi, sun, sun.target, rim);

    const turntable = new THREE.Group();
    const discMat = new THREE.MeshLambertMaterial({ color: THEMES_3D.paper.disc });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.50, 0.06, 36), discMat);
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    const ringMat = new THREE.MeshLambertMaterial({ color: THEMES_3D.paper.ring });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.476, 0.476, 0.016, 36), ringMat);
    ring.position.y = -0.007;
    const avatarHolder = new THREE.Group();
    turntable.add(disc, ring, avatarHolder);
    scene.add(turntable);

    studio.d3 = {
      THREE, Avatar, voxelUniforms, renderer, scene, camera, hemi, sun, rim,
      turntable, discMat, ringMat, avatarHolder,
      avatar: null, lookKey: '', poseKey: '', w: 0, h: 0,
      camY: 0.90, camZ: 2.72, lookY: 0.76,
    };

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => { if (studio.open) { syncStage3DSize(); renderStage(performance.now(), 0); } });
      ro.observe($('stage-viewport'));
    }

    canvas.hidden = false;
    $('char-stage').hidden = true;
    $('stage-hint').textContent = '3D · drag to spin';
    applyBackdrop3D();
    syncStage3DSize();
    syncAvatar3D();
    renderStage(performance.now(), 0.016);
  }).catch(() => {
    studio.d3Failed = true;
    $('char-stage-3d').hidden = true;
    $('char-stage').hidden = false;
    $('stage-hint').textContent = '2D preview';
  });
  return studio.d3Promise;
}

function renderStage2DFallback(ms = 0) {
  const canvas = $('char-stage');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paintBackdrop(ctx, canvas.width, canvas.height, studio.backdrop);

  const t = calm ? 0 : ms / 1000;
  const look = activeLook();
  const blink = !calm && studio.pose === 'idle' && (Math.floor(t * 2.8) % 11 === 0);
  const step = studio.pose === 'walk' ? (calm ? 1 : (Math.floor(t * 5.2) % 2 ? 1 : -1)) : 0;
  const bob = !calm && studio.pose === 'walk' && Math.floor(t * 10.4) % 2 ? -2 : 0;
  const showBack = Math.cos(studio.yaw) < -0.25;
  const pix = paintFlatCharacter(look, {
    back: showBack,
    pose: studio.pose === 'walk' ? 'idle' : studio.pose,
    blocked: studio.pose === 'blocked',
    blink,
    t,
    step,
  });

  if (studio.zoom) {
    blitPixCrop(ctx, pix, { sx: 0, sy: 20, sw: 32, sh: 32, dx: 0, dy: 12 + bob, scale: 6, back: showBack });
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.fillRect(68, 174, 56, 8);
    ctx.fillRect(60, 176, 72, 4);
    blitPixCrop(ctx, pix, { sx: 0, sy: 16, sw: 32, sh: 48, dx: 32, dy: -8 + bob, scale: 4, back: showBack });
  }
}

function renderStage(ms = 0, dtOverride = null) {
  const dt = dtOverride !== null ? dtOverride : (studio.lastMs ? Math.min(0.05, Math.max(0, (ms - studio.lastMs) / 1000)) : 0.016);
  studio.lastMs = ms;
  if (studio.spinMode === 'auto' && !studio.dragging && !calm) {
    studio.yaw = (studio.yaw + dt * 0.58) % (Math.PI * 2);
  }

  const d3 = studio.d3;
  if (!d3) {
    renderStage2DFallback(ms);
    return;
  }
  syncStage3DSize();
  syncAvatar3D();
  d3.voxelUniforms.uTime.value = ms / 1000;
  d3.turntable.rotation.y = studio.yaw;

  const isAlien = activeLook().species === 'alien';
  const goalCamY = studio.zoom ? (isAlien ? 1.28 : 1.18) : (isAlien ? 0.96 : 0.90);
  const goalCamZ = studio.zoom ? (isAlien ? 1.44 : 1.28) : (isAlien ? 2.90 : 2.72);
  const goalLookY = studio.zoom ? (isAlien ? 1.22 : 1.12) : (isAlien ? 0.82 : 0.76);
  const k = dt > 0 ? 1 - Math.exp(-12 * dt) : 1;
  d3.camY += (goalCamY - d3.camY) * k;
  d3.camZ += (goalCamZ - d3.camZ) * k;
  d3.lookY += (goalLookY - d3.lookY) * k;
  d3.camera.position.set(0, d3.camY, d3.camZ);
  d3.camera.lookAt(0, d3.lookY, 0);

  if (d3.avatar) d3.avatar.update(calm ? 0 : dt, calm);
  d3.renderer.render(d3.scene, d3.camera);
}

function stageTick(ms) {
  if (!studio.open) { studio.raf = 0; return; }
  renderStage(ms);
  studio.raf = requestAnimationFrame(stageTick);
}

function refreshThumbnails() {
  if (!studio.built) return;
  const base = activeLook();
  for (const [trait, list] of Object.entries(studio.thumbs)) {
    for (const item of list) {
      const sample = { ...base, [trait]: item.val };
      if (trait === 'gender') {
        if (base.species !== 'human' && base.species !== 'goblin') {
          sample.species = 'human';
          sample.skin = SPECIES_DEFAULT_SKIN.human;
          Object.assign(sample, humanGenderDefaults(item.val));
        } else {
          Object.assign(sample, genderTransitionPatch({ ...base, species: sample.species }, item.val, studio.pins));
        }
      }
      if (trait === 'species' && item.val !== base.species) {
        sample.skin = SPECIES_DEFAULT_SKIN[item.val] || base.skin;
        if (item.val === 'alien') {
          sample.hair = 'bald';
          sample.facial = 'none';
        } else if (item.val === 'human') {
          const defs = humanGenderDefaults(base.gender);
          if (sample.hair === 'bald') sample.hair = defs.hair;
          if (sample.outfit === 'consul') sample.outfit = defs.outfit;
        }
      }
      if (trait === 'hair' && sample.species === 'robot') { sample.species = 'human'; sample.skin = SPECIES_DEFAULT_SKIN.human; }
      if (trait === 'facial' && sample.species === 'robot') { sample.species = 'human'; sample.skin = SPECIES_DEFAULT_SKIN.human; }
      const ctx = item.canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#e6dec2';
      ctx.fillRect(0, 0, 56, 56);
      ctx.fillStyle = '#c9be99';
      ctx.fillRect(0, 46, 56, 10);
      const pix = paintFlatCharacter(sample, { pose: 'idle' });
      const sy = trait === 'outfit' ? 34 : (sample.species === 'alien' ? 16 : 20);
      blitPixCrop(ctx, pix, { sx: 2, sy, sw: 28, sh: 28, dx: 0, dy: 0, scale: 2 });
    }
  }
}

function selectStudioTab(which) {
  studio.tab = which === 'perks' ? 'perks' : 'look';
  const onLook = studio.tab === 'look';
  $('tab-look').classList.toggle('on', onLook);
  $('tab-look').setAttribute('aria-selected', String(onLook));
  $('tab-perks').classList.toggle('on', !onLook);
  $('tab-perks').setAttribute('aria-selected', String(!onLook));
  $('panel-look').hidden = !onLook;
  $('panel-perks').hidden = onLook;
}

function equipPerk(id) {
  me = { ...me, perk: cleanPerk(id) };
  keep();
  refreshPassSummary();
  syncStudioUI();
}

function buildStudioOnce() {
  if (studio.built) return;
  studio.built = true;

  $('pose-bar').replaceChildren(...POSES.map(([id, label]) => {
    const b = el('button', id === studio.pose ? 'on' : '', label);
    b.type = 'button';
    b.dataset.pose = id;
    b.addEventListener('click', () => {
      studio.pose = id;
      for (const n of $('pose-bar').querySelectorAll('button')) n.classList.toggle('on', n.dataset.pose === id);
      renderStage(performance.now(), 0.016);
    });
    return b;
  }));

  $('backdrop-bar').replaceChildren(...BACKDROPS.map(([id, label]) => {
    const b = el('button', id === studio.backdrop ? 'on' : '', label);
    b.type = 'button';
    b.dataset.bg = id;
    b.addEventListener('click', () => {
      studio.backdrop = id;
      for (const n of $('backdrop-bar').querySelectorAll('button')) n.classList.toggle('on', n.dataset.bg === id);
      applyBackdrop3D();
      renderStage(performance.now(), 0);
    });
    return b;
  }));

  $('preset-bar').replaceChildren(...PRESETS.map((pr) => {
    const b = el('button', '', pr.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      const cur = activeLook();
      const next = { ...pr.look };
      for (const pinned of studio.pins) next[pinned] = cur[pinned];
      setCustomLook(next);
    });
    return b;
  }));

  const makeThumbGroup = (hostId, trait, values) => {
    const items = values.map((val) => {
      const canvas = el('canvas', 'thumb-pic');
      canvas.width = 56; canvas.height = 56;
      canvas.setAttribute('aria-hidden', 'true');
      const btn = el('button', 'thumb-btn', canvas, el('span', '', LABELS[trait][val] || val));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const cur = activeLook();
        if (trait === 'gender') {
          const sameGender = me.customLook && cur.gender === val;
          setCustomLook(genderTransitionPatch(cur, val, studio.pins, sameGender));
          return;
        }
        const patch = { [trait]: val };
        if (trait === 'species' && !studio.pins.has('skin')) patch.skin = SPECIES_DEFAULT_SKIN[val] || SKIN[0];
        if (trait === 'species' && val === 'alien' && !studio.pins.has('hair')) patch.hair = 'bald';
        if (trait === 'species' && val === 'human') {
          const defs = humanGenderDefaults(cur.gender);
          if (!studio.pins.has('hair') && cur.hair === 'bald') patch.hair = defs.hair;
          if (!studio.pins.has('outfit') && cur.outfit === 'consul') patch.outfit = defs.outfit;
          if (cur.gender === 'female' && !studio.pins.has('facial') && ['mustache', 'beard'].includes(cur.facial)) patch.facial = 'none';
          if (cur.gender === 'male' && !studio.pins.has('facial') && cur.facial === 'lashes') patch.facial = 'none';
        }
        setCustomLook(patch);
      });
      return { val, btn, canvas };
    });
    studio.thumbs[trait] = items;
    $(hostId).replaceChildren(...items.map((it) => it.btn));
  };

  makeThumbGroup('pick-gender', 'gender', GENDER);
  makeThumbGroup('pick-species', 'species', SPECIES);
  makeThumbGroup('pick-hair', 'hair', HAIR);
  makeThumbGroup('pick-facial', 'facial', FACIAL);
  makeThumbGroup('pick-outfit', 'outfit', OUTFIT);
  makeThumbGroup('pick-accessory', 'accessory', ACCESSORY);

  const makeSwatches = (hostId, inputId, trait, colors) => {
    const btns = colors.map((hex) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.style.background = hex;
      b.title = hex;
      b.setAttribute('aria-label', `${trait} ${hex}`);
      b.addEventListener('click', () => setCustomLook({ [trait]: hex }));
      return { hex: hex.toLowerCase(), btn: b };
    });
    studio.swatches[trait] = btns;
    $(hostId).replaceChildren(...btns.map((x) => x.btn));
    $(inputId).addEventListener('input', (e) => setCustomLook({ [trait]: e.target.value }));
  };

  makeSwatches('pick-skin', 'color-skin', 'skin', SKIN_SWATCHES);
  makeSwatches('pick-hair-color', 'color-hair', 'hairColor', HAIR_SWATCHES);
  makeSwatches('pick-outfit-color', 'color-outfit', 'outfitColor', OUTFIT_SWATCHES);

  for (const pinBtn of $('creator').querySelectorAll('[data-pin]')) {
    pinBtn.addEventListener('click', () => {
      const k = pinBtn.dataset.pin;
      if (studio.pins.has(k)) studio.pins.delete(k); else studio.pins.add(k);
      syncStudioUI();
    });
  }

  $('perk-grid').replaceChildren(...PERK_LIST.map((p) => {
    const icon = el('i');
    icon.dataset.sprite = p.icon;
    icon.dataset.scale = '3';
    const mods = el('ul', 'perk-mods',
      ...(p.upsides.length || p.downsides.length
        ? [
          ...p.upsides.map((u) => el('li', 'up', `+ ${u}`)),
          ...p.downsides.map((d) => el('li', 'down', `- ${d}`)),
        ]
        : [el('li', 'neutral', 'Zero upsides, zero downsides.')]),
    );
    const card = el('button', 'perk-card',
      el('div', 'perk-card-top',
        icon,
        el('div', 'perk-title-wrap',
          el('span', 'perk-title', p.name),
          el('span', 'perk-dept', `${p.code} · ${p.dept}`),
        ),
        el('span', `perk-cost${p.cost === 0 ? ' free' : ''}`, `${p.cost} PT`),
      ),
      el('p', 'perk-desc', p.summary),
      mods,
    );
    card.type = 'button';
    card.addEventListener('click', () => {
      const nextId = me.perk === p.id && p.id !== DEFAULT_PERK ? DEFAULT_PERK : p.id;
      equipPerk(nextId);
    });
    studio.perkCards.set(p.id, card);
    return card;
  }));
  mount($('perk-grid'));
}

syncStudioUI = () => {
  if (!studio.built) return;
  const look = activeLook();
  const perk = difficultyPerk(resolvePerk(me.perk), difficultyField.value);

  $('card-code').textContent = perk.code;
  $('card-vitals').replaceChildren(
    el('span', 'hearts', '♥'.repeat(perk.maxHealth)),
    el('span', '', `${perk.pockets} POCKETS`),
    el('span', '', `${clock(perk.cameraStart)} TAPE`),
    el('span', '', `${perk.fov}° LENS`),
  );
  drawBarcode(`${me.name}|${me.customLook ? JSON.stringify(look) : 'random'}|${perk.id}`);

  const pill = $('look-mode-pill');
  pill.textContent = me.customLook ? 'Saved custom pass' : 'Random each visit';
  pill.classList.toggle('custom', me.customLook);
  $('use-random-look').disabled = !me.customLook;
  $('gender-note').textContent = look.species === 'human'
    ? '(Sets Boy / Girl defaults — all traits stay remixable)'
    : '(Subtle silhouette & face cues; Human switches full Boy / Girl defaults)';
  $('hair-note').textContent = look.species === 'robot' ? '(Robot chassis uses steel dome + antenna)' : '';

  for (const [trait, list] of Object.entries(studio.thumbs)) {
    const robotDim = look.species === 'robot' && (trait === 'hair' || trait === 'facial');
    for (const it of list) {
      it.btn.classList.toggle('on', me.customLook && look[trait] === it.val);
      it.btn.classList.toggle('dim', robotDim);
    }
  }
  for (const [trait, list] of Object.entries(studio.swatches)) {
    const val = String(look[trait] || '').toLowerCase();
    for (const it of list) it.btn.classList.toggle('on', me.customLook && it.hex === val);
  }
  $('color-skin').value = look.skin;
  $('color-hair').value = look.hairColor;
  $('color-outfit').value = look.outfitColor;

  for (const pinBtn of $('creator').querySelectorAll('[data-pin]')) {
    const pinned = studio.pins.has(pinBtn.dataset.pin);
    pinBtn.classList.toggle('on', pinned);
    pinBtn.textContent = pinned ? 'PINNED' : 'PIN';
  }

  $('tab-perks').textContent = `2. DEPARTMENT KIT (${perk.cost}/1 PT)`;
  const meter = $('perk-meter');
  meter.textContent = `${perk.cost} / 1 PERK POINT — ${perk.name.toUpperCase()}`;
  meter.classList.toggle('spent', perk.cost > 0);
  $('perk-clear').disabled = perk.id === DEFAULT_PERK;
  for (const [id, card] of studio.perkCards) {
    const active = id === perk.id;
    card.classList.toggle('on', active);
    card.setAttribute('aria-pressed', String(active));
  }

  refreshThumbnails();
  renderStage(performance.now());
};

function updateTurnButtonLabel() {
  const labels = { auto: 'Spin: Auto', front: 'Turn: Front', back: 'Turn: Back', manual: 'Spin: Drag' };
  $('view-turn').textContent = labels[studio.spinMode] || 'Spin: Auto';
}

// The studio opens in place, under the pass (an accordion, not a window over the page): Customize opens and closes it
function openCreator(open) {
  const win = $('creator'), toggle = $('open-creator');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Done \u25B4' : 'Customize \u25BE';
  if (open) {
    buildStudioOnce();
    studio.open = true;
    studio.lastMs = performance.now();
    win.hidden = false;
    updateTurnButtonLabel();
    applyBackdrop3D();
    syncStudioUI();
    ensureStage3D();
    try { win.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); } catch { /* it is open; that will do */ }
    if (!studio.raf) studio.raf = requestAnimationFrame(stageTick);
  } else {
    studio.open = false;
    studio.dragging = false;
    if (studio.raf) { cancelAnimationFrame(studio.raf); studio.raf = 0; }
    win.hidden = true;
    keep(); refreshPassSummary();
  }
}

$('open-creator').addEventListener('click', () => openCreator(!studio.open));
if (location.hash === '#open-creator') openCreator(true);
$('creator-close').addEventListener('click', () => openCreator(false));
$('creator-done').addEventListener('click', () => openCreator(false));
$('creator-enter').addEventListener('click', () => { keep(); location.href = PLAY; });
$('creator').addEventListener('keydown', (e) => { if (e.key === 'Escape') { openCreator(false); $('open-creator').focus(); } });
$('tab-look').addEventListener('click', () => selectStudioTab('look'));
$('tab-perks').addEventListener('click', () => selectStudioTab('perks'));
{
  const vp = $('stage-viewport');
  let dragId = null, startX = 0, lastX = 0, moved = false;
  vp.addEventListener('pointerdown', (e) => {
    dragId = e.pointerId;
    startX = lastX = e.clientX;
    moved = false;
    vp.classList.add('dragging');
    try { vp.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  vp.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (!moved && Math.abs(e.clientX - startX) > 3) {
      moved = true;
      studio.dragging = true;
      studio.spinMode = 'manual';
      updateTurnButtonLabel();
    }
    if (moved) {
      studio.yaw += dx * 0.018;
      renderStage(performance.now(), 0);
    }
  });
  const endDrag = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    studio.dragging = false;
    vp.classList.remove('dragging');
    if (!moved) {
      studio.spinMode = studio.spinMode === 'auto' ? 'front' : 'auto';
      if (studio.spinMode === 'front') studio.yaw = 0;
      updateTurnButtonLabel();
      renderStage(performance.now(), 0);
    }
  };
  vp.addEventListener('pointerup', endDrag);
  vp.addEventListener('pointercancel', endDrag);
}
$('view-turn').addEventListener('click', () => {
  if (studio.spinMode === 'auto') {
    studio.spinMode = 'front';
    studio.yaw = 0;
  } else if (studio.spinMode === 'front') {
    studio.spinMode = 'back';
    studio.yaw = Math.PI;
  } else {
    studio.spinMode = 'auto';
  }
  updateTurnButtonLabel();
  renderStage(performance.now(), 0);
});
$('view-zoom').addEventListener('click', () => {
  studio.zoom = !studio.zoom;
  $('view-zoom').textContent = studio.zoom ? 'View: Head' : 'View: Full';
  renderStage(performance.now(), 0);
});
$('roll-look').addEventListener('click', () => rollRandomLook());
$('unpin-all').addEventListener('click', () => { studio.pins.clear(); syncStudioUI(); });
$('use-random-look').addEventListener('click', () => {
  me = { ...me, customLook: false, look: {} };
  keep();
  refreshPassSummary();
  syncStudioUI();
});
$('perk-clear').addEventListener('click', () => equipPerk(DEFAULT_PERK));
$('creator-reset').addEventListener('click', () => {
  studio.pins.clear();
  me = { ...me, customLook: false, look: {}, perk: DEFAULT_PERK };
  keep();
  refreshPassSummary();
  syncStudioUI();
});

refreshPassSummary();

/* ---- what this browser remembers ------------------------------------------------------------------- */
let mine = archive.record();
onArchive(() => {
  mine = archive.record();
  // Signed in, the account's name and character are the last word, on every device. Not signed in, this browser's own
  // (what the studio keeps) are, and the archive only follows them.
  const account = String(archive.owner()).startsWith('user:');
  if (account && document.activeElement !== nameBox) { me.name = archive.profile().name; nameBox.value = me.name; keep(); }
  const theirs = account ? archive.document().character?.value : null;
  if (theirs && JSON.stringify(sanitizeLookPatch(theirs).look) !== JSON.stringify(me.customLook ? me.look : null)) {
    me = { ...me, customLook: true, look: sanitizeLookPatch(theirs).look }; keep(); refreshPassSummary(); syncStudioUI();
  }
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
let posterKey;
async function employeePoster(entry, online) {
  $('employee-name').textContent = entry?.name || (online ? 'No scores yet' : 'Scores unavailable');
  $('employee-score').textContent = entry ? `${num(entry.score)} points` : '';
  const canvas = $('employee-photo');
  canvas.hidden = !entry;
  const key = entry && JSON.stringify([entry.id, entry.look]);
  if (key === posterKey) return;
  posterKey = key;
  if (!entry) return;
  const look = resolveLook(`visitor:${entry.seed}`, entry.look);
  canvas.title = entry.look ? 'Visitor photograph' : 'Standard avatar for this tape';
  const ctx = canvas.getContext('2d');
  paintBackdrop(ctx, canvas.width, canvas.height, 'paper');
  blitPixCrop(ctx, paintFlatCharacter(look), { sx: 0, sy: 17, sw: 32, sh: 35, dx: 16, dy: 6, scale: 2 });
  try {
    const { characterPreview } = await import('./archive-preview.js');
    if (key !== posterKey) return;
    const camera = characterPreview();
    try {
      const photo = camera.take(look);
      paintBackdrop(ctx, canvas.width, canvas.height, 'paper');
      ctx.drawImage(photo, 12, 34, 336, 308, 0, 0, canvas.width, canvas.height);
    } finally { camera.dispose(); }
  } catch { /* The printed sprite also works without WebGL. */ }
}
function scores(top, none = 'Nobody yet.') {
  const body = $('scores').tBodies[0];
  if (!top.length) { body.replaceChildren(el('tr', '', Object.assign(el('td', 'empty', none), { colSpan: 7 }))); return; }
  body.replaceChildren(...top.slice(0, 10).map((e, i) => {
    // (no way into somebody else's building from here: the number of a tape is its owner's to give out — the card they came out with has it)
    const td = (cls, text) => el('td', cls, text);
    return el('tr', i ? '' : 'first', td('n', String(i + 1)), td('', e.name), td('', e.difficulty ? difficultyOf(e.difficulty).label : 'Original'), td('n', num(e.score)), td('n', clock(e.seconds)), td('n', String(e.batteries)), td('n', String(e.hearts)));
  }));
}
guests([]);
const scoreDifficulty = $('score-difficulty');
for (const d of DIFFICULTIES.filter(d => d.multiplier)) {
  const option = el('option', '', d.label); option.value = d.id; scoreDifficulty.append(option);
}
let bookRequest = 0, overallRequest = 0;
scoreDifficulty.addEventListener('change', () => book(scoreDifficulty.value));
function refreshBook() {
  book();
  if (scoreDifficulty.value) book(scoreDifficulty.value);
}
async function book(difficulty = '') {
  const request = ++bookRequest;
  if (!difficulty) overallRequest = request;
  let data = null;
  try {
    const bookUrl = './api/book' + (difficulty ? '?difficulty=' + encodeURIComponent(difficulty) : '');
    const res = await fetch(bookUrl, { headers: { accept: 'application/json' } });
    if (res.ok) data = await res.json();
  } catch { /* no book: this browser's own record, then */ }
  const top = (data?.ok && Array.isArray(data.top) ? data.top : []).map(cleanEntry).filter(Boolean);
  if (request === overallRequest) employeePoster(top[0], data?.ok);
  if (request !== bookRequest) return;
  if (!data || !data.ok) { scores([], mine.best ? `Best on this computer: ${num(mine.best)}` : 'Nobody yet.'); return; }
  counter(data.counter);
  scores(top);
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
refreshBook();

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
    $('trailer-film').pause();
    const a = new Audio('./muzak.mp3');
    a.loop = true; a.volume = 0.5; audio = a; tuneAudio();
    a.play().catch(() => { if (audio === a) { audio = null; says(false); } });       // no sound to be had: the switch goes back
  }
  says(!!audio);
}
mountTrailer($('trailer-player'));
$('trailer-film').addEventListener('play', () => { if (audio) music(false); });
$('midi').addEventListener('click', () => music(!audio));
document.addEventListener('visibilitychange', () => { if (document.hidden && audio) music(false); });
