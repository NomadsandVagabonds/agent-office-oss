import { archive, onArchive, startAccounts, signInGoogle, emailCode, verifyCode, signOut, sync } from './archive-client.js';
import { cardExporter, drawPersonnelCard } from './archive-card.js';
import { CLEARANCE_FLOORS } from './core/archive.mjs';
import { fileStats, ledgerRows, workbook } from './archive-charts.js';
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const pretty = s => s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const card = $('staff-card');
const prepareExport = cardExporter(card, $('download-card'), $('share-card'), $('export-status'));
const showWorkbook = workbook({ canvas:$('plot'), title:$('plot-title'), caption:$('plot-caption'), legend:$('plot-legend'), empty:$('plot-empty'), details:$('chart-data'), table:$('plot-data'), discoveries:$('chart-sightings'), escapes:$('chart-escapes') });
let photographer, portrait, lookKey, cardKey, currentCard, recordKey;
let typeReady = false;
let sending = false, cooldown = 0, codeEmail = '', currentState;
function printCard() {
  drawPersonnelCard(card,currentCard,portrait);
  card.setAttribute('aria-label', `BlockRooms personnel ID for ${currentCard.name}. ${currentCard.escapes} escapes, ${currentCard.best} best score, ${currentCard.rooms} room types and ${currentCard.entities} entities. Floor clearance: ${currentCard.clearances.length ? currentCard.clearances.map(id => CLEARANCE_FLOORS[id]).join(', ') : 'none'}.`);
  if (typeReady) prepareExport();
}
function photograph(look) {
  portrait = null;
  if (!photographer) return;
  try { portrait = photographer.take(look); }
  catch { photographer.dispose(); photographer = null; }
}
function render(state) {
  currentState = state;
  $('save-status').textContent = state.durable ? state.message : 'Browser storage is unavailable. This archive lasts only until this tab closes.';
  $('save-status').classList.toggle('error', !state.durable || state.phase === 'error');
  $('signed-in').hidden = !state.user; $('sign-in').hidden = !!state.user;
  $('sign-in-hint').hidden = !!state.user;
  $('email-address').textContent = state.user?.email || '';
  $('sync').hidden = !state.user; $('sync').disabled = state.phase === 'syncing';
  $('google').hidden = state.providers?.google === false;
  $('email-form').hidden = state.providers?.email === false;
  $('google').disabled = !state.configured || !state.ready || sending;
  $('send-code').disabled = !state.configured || !state.ready || sending || Date.now() < cooldown;
  if (state.user) $('auth-status').textContent = 'Your archive is private. Public scores and guestbook entries are separate.';
  else if (state.ready && !state.configured) $('auth-status').textContent = 'Cloud saves are offline. This file stays on this device.';
  else if (state.ready && oauthMessage) $('auth-status').textContent = oauthMessage;
  else if (state.ready && !codeEmail && !sending) $('auth-status').textContent = 'Signing in is optional.';
  const r = archive.record(), profile = archive.profile();
  const nextCard = { name:profile.name, look:profile.look, best:r.best, escapes:r.out, rooms:Object.keys(r.rooms).length, entities:Object.keys(r.cast).length, clearances:archive.document().clearances };
  const nextCardKey = JSON.stringify(nextCard);
  if (cardKey !== nextCardKey) {
    currentCard = nextCard; cardKey = nextCardKey;
    const floors = Object.entries(CLEARANCE_FLOORS);
    $('clearance-summary').textContent = `Floor clearance · ${nextCard.clearances.length} of ${floors.length}`;
    $('clearance-floors').replaceChildren(...floors.map(([id,label]) => {
      const earned = nextCard.clearances.includes(id), row = node('li');
      row.append(node('span',label), node('span',earned ? 'Stamped' : 'Uncleared',earned ? 'earned' : ''));
      return row;
    }));
    const nextLookKey = JSON.stringify(profile.look);
    if (lookKey !== nextLookKey) { lookKey = nextLookKey; photograph(profile.look); }
    printCard();
  }
  const nextRecordKey = JSON.stringify(r);
  if (recordKey === nextRecordKey) return;
  recordKey = nextRecordKey;
  const stats = fileStats(r);
  showWorkbook(stats);
  $('ledger-rows').replaceChildren(...ledgerRows(r,stats).map(([label,value]) => {
    const line = node('div'); line.append(node('dt',label),node('dd',value)); return line;
  }));
  $('tape-list').replaceChildren(...(r.tapes.length ? r.tapes.map(t => {
    const li = node('li', undefined, 'tape'), a = node('a', `▶ ${t.seed}`), meta = node('small', `${t.score.toLocaleString()} pts · ${t.at ? new Date(t.at).toLocaleDateString() : 'Imported'}`);
    a.href = './play?tape=' + encodeURIComponent(t.seed); a.setAttribute('aria-label', 'Replay tape ' + t.seed);
    li.append(a, meta); return li;
  }) : [node('li', 'No tapes recovered. Leave through the exit to keep a tape.', 'empty')]));
  for (const [key, label] of [['rooms', 'Rooms'], ['cast', 'Residents']]) {
    const ids = Object.keys(r[key]).sort(); $(key + '-title').textContent = `${label} · ${ids.length}`;
    $(key + '-list').replaceChildren(...(ids.length ? ids.map(id => node('li', pretty(id))) : [node('li', 'Nothing recorded yet.')]));
  }
}
const signInResult = new URL(location.href).searchParams.get('signin');
let oauthMessage = signInResult === 'email' ? 'Please verify this address with an email code.' :
  signInResult === 'failed' ? 'Google sign-in did not finish. Please try again.' : '';
if (oauthMessage) {
  history.replaceState(history.state, '', location.pathname + '#connection-title');
  $('connection-title').scrollIntoView();
}
onArchive(render);
async function action(fn) {
  try { oauthMessage = ''; await fn(); } catch (error) { $('auth-status').textContent = error.message || 'Something went wrong. You can still play.'; $('auth-status').classList.add('error'); }
}
startAccounts({ force: true }).catch(error => { $('auth-status').textContent = error.message; });
$('google').addEventListener('click', () => action(signInGoogle));
$('sync').addEventListener('click', sync);
$('sign-out').addEventListener('click', () => action(signOut));
$('email-form').addEventListener('submit', e => { e.preventDefault(); action(async () => {
  if (sending || Date.now() < cooldown) return;
  sending = true; render(currentState); $('auth-status').classList.remove('error'); $('auth-status').textContent = 'Sending a code…';
  try {
    const address = $('email').value.trim(); await emailCode(address); codeEmail = address; cooldown = Date.now() + 60000;
    $('code-address').textContent = address; $('code-form').hidden = false; $('code').value = ''; $('code').focus();
    $('auth-status').textContent = 'Check your inbox. The code expires in ten minutes.';
  } finally { sending = false; render(currentState); }
}); });
$('code-form').addEventListener('submit', e => { e.preventDefault(); action(async () => {
  const button = $('code-form').querySelector('button'); button.disabled = true;
  try { await verifyCode(codeEmail, $('code').value.trim()); $('code').value = ''; codeEmail = ''; $('code-form').hidden = true; }
  finally { button.disabled = false; }
}); });
$('change-email').addEventListener('click', () => { codeEmail = ''; $('code-form').hidden = true; $('email').focus(); });
setInterval(() => {
  const seconds = Math.max(0, Math.ceil((cooldown - Date.now()) / 1000));
  $('send-code').textContent = seconds ? `Resend ${seconds}s` : codeEmail ? 'Resend code' : 'Send code';
  $('send-code').disabled = sending || seconds > 0 || !currentState?.configured || !currentState?.ready;
}, 1000);
Promise.allSettled([document.fonts.load('600 9px "HR Mono"')])
  .then(() => { typeReady = true; printCard(); });
// A printed pixel portrait is ready immediately, including on machines without WebGL.
import('./archive-preview.js').then(({ characterPreview }) => {
  photographer = characterPreview(); photograph(currentCard.look); printCard();
}).catch(() => {});
window.addEventListener('pagehide', event => { if (!event.persisted) photographer?.dispose(); });
