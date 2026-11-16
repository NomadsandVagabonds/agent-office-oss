import { mount, drawLogo, voidTile } from './art.js';
import { archive, onArchive, startAccounts, signInGoogle, emailCode, verifyCode, signOut, sync } from './archive-client.js';
import { SPECIES, HAIR, OUTFIT, ACCESSORY, FACIAL, resolveLook } from './core/look.mjs';
import { cleanName } from './core/book.mjs';
const $ = id => document.getElementById(id);
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const pretty = s => s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
drawLogo($('archive-logo'));
document.querySelector('.archive-header').style.backgroundImage = `url(${voidTile()})`;
mount();
let preview, lastLook, lastOwner, dirty = false, formLook, sending = false, cooldown = 0, codeEmail = '', currentState;
const fields = {};
for (const [key, values] of Object.entries({ species: SPECIES, hair: HAIR, outfit: OUTFIT, accessory: ACCESSORY, facial: FACIAL, skin: null, hairColor: null, outfitColor: null })) {
  const box = node('div'), label = node('label', pretty(key.replace(/Color$/, ' colour'))); label.htmlFor = 'look-' + key;
  const input = node(values ? 'select' : 'input'); input.id = label.htmlFor;
  if (values) for (const value of values) { const option = node('option', pretty(value)); option.value = value; input.append(option); }
  else input.type = 'color';
  fields[key] = input; input.addEventListener('input', () => { dirty = true; formLook = { ...formLook, [key]: input.value }; preview?.show(formLook); $('look-status').textContent = 'Not saved. Choose Save changes to keep this appearance.'; });
  box.append(label, input); $('look-fields').append(box);
}
$('nickname').addEventListener('input', () => { dirty = true; });
function form(profile) {
  formLook = profile.look; $('nickname').value = profile.name;
  for (const [key, input] of Object.entries(fields)) input.value = formLook[key];
  const signature = JSON.stringify(formLook); if (lastLook !== signature) preview?.show(formLook); lastLook = signature;
}
function render(state) {
  currentState = state;
  $('save-status').textContent = state.durable ? state.message : 'Browser storage is unavailable. This archive lasts only until this tab closes.';
  $('save-status').classList.toggle('error', !state.durable || state.phase === 'error');
  $('signed-in').hidden = !state.user; $('sign-in').hidden = !!state.user;
  $('email-address').textContent = state.user?.email || '';
  $('sync').hidden = !state.user; $('sync').disabled = state.phase === 'syncing';
  $('google').disabled = !state.configured || !state.ready || sending;
  $('send-code').disabled = !state.configured || !state.ready || sending || Date.now() < cooldown;
  if (state.user) $('auth-status').textContent = 'Your archive is private. Public scores and guestbook entries are separate.';
  else if (state.ready && !state.configured) $('auth-status').textContent = 'Cloud saves are not connected in this build. Your local archive and character editor still work.';
  else if (state.ready && !codeEmail && !sending) $('auth-status').textContent = 'Signing in is optional.';
  const owner = archive.owner();
  if (owner !== lastOwner) { dirty = false; lastOwner = owner; }
  if (!dirty) form(archive.profile());
  const r = archive.record();
  $('record-counts').textContent = `${r.runs} visit${r.runs === 1 ? "" : "s"} / ${r.out} escape${r.out === 1 ? "" : "s"} / best ${r.best.toLocaleString()}`;
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
onArchive(render);
async function action(fn) {
  try { await fn(); } catch (error) { $('auth-status').textContent = error.message || 'Something went wrong. You can still play.'; $('auth-status').classList.add('error'); }
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
$('character-form').addEventListener('submit', async e => {
  e.preventDefault(); const name = cleanName($('nickname').value);
  if (!name) { $('look-status').textContent = 'Use a nickname of up to 16 characters: letters, numbers, spaces or punctuation.'; return; }
  await archive.edit({ name, character: formLook }); dirty = false;
  $('look-status').textContent = 'Saved. This appearance applies to your next visit.'; render(currentState);
});
$('random-look').addEventListener('click', () => {
  dirty = true; form({ name: $('nickname').value, look: resolveLook(crypto.randomUUID()) }); $('look-status').textContent = 'Not saved. Choose Save changes to keep this appearance.';
});
import('./archive-preview.js').then(({ characterPreview }) => { preview = characterPreview($('portrait')); preview.show(formLook); })
  .catch(() => { $('portrait').textContent = '3D preview unavailable. You can still edit and save your look.'; });
window.addEventListener('pagehide', () => preview?.dispose());
