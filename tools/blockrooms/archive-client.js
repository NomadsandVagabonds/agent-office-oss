import { createArchiveStorage } from './archive-storage.js';
import { syncArchive, supabaseRemote } from './archive-cloud.js';
const listeners = new Set();
let client, publicConfig, session, timer, busy = false, again = false, starting;
let state = { ready: false, configured: false, user: null, phase: 'local', message: 'Saved on this device' };
let browserStorage;
try { browserStorage = localStorage; } catch { /* private storage unavailable: memory only */ }
const emit = () => { for (const f of listeners) f({ ...state, durable: archive.durable() }); };
const schedule = () => { clearTimeout(timer); if (session) timer = setTimeout(sync, 800); };
export const archive = createArchiveStorage({ storage: browserStorage, locks: navigator.locks, changed: () => { queueMicrotask(emit); schedule(); } });
export const onArchive = f => { listeners.add(f); f({ ...state, durable: archive.durable() }); return () => listeners.delete(f); };
function status(phase, message) { state = { ...state, phase, message }; emit(); }
function sdk() {
  if (globalThis.supabase) return Promise.resolve(globalThis.supabase);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = './vendor/supabase-2.119.0.js';
    script.onload = () => resolve(globalThis.supabase); script.onerror = () => { script.remove(); reject(Error('Sign-in could not load. You can still play.')); }; document.head.append(script);
  });
}
export function startAccounts({ force = false } = {}) {
  // Nobody becomes an anonymous Supabase user just by playing.
  try { if (!force && !browserStorage?.getItem('blockrooms:auth')) return Promise.resolve(null); } catch { return Promise.resolve(null); }
  if (starting) return starting;
  starting = (async () => {
    const res = await fetch('./account-config.json', { cache: 'no-store' });
    if (!res.ok) throw Error('Cloud saves are unavailable. Your local archive still works.');
    const config = await res.json();
    if (!config.url || !config.key) { state.ready = true; emit(); return null; }
    state.configured = true; publicConfig = config;
    const { createClient } = await sdk();
    client = createClient(config.url, config.key, { auth: { flowType: 'pkce', storageKey: 'blockrooms:auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    client.auth.onAuthStateChange((event, next) => {
      // Do not await inside the SDK callback (it holds an auth lock).
      setTimeout(() => acceptSession(event, next).catch(() => status('error', 'Unable to switch archives. Your local saves remain intact.')), 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await acceptSession('INITIAL_SESSION', data.session);
    state.ready = true; emit(); return client;
  })().catch(error => { starting = null; state.ready = true; status('error', error.message || 'Unable to sign in. Your saves remain on this device.'); throw error; });
  return starting;
}
let accepting = Promise.resolve();
function acceptSession(event, next) {
  accepting = accepting.catch(() => {}).then(async () => {
    const prior = session?.user.id; session = next; state.user = next?.user ? { id: next.user.id, email: next.user.email } : null;
    if (next) {
      if (prior !== next.user.id || archive.owner() !== 'user:' + next.user.id) await archive.claim(next.user.id);
      schedule();
    } else if (event === 'SIGNED_OUT') { clearTimeout(timer); await archive.signOut(); status('local', 'Signed out. New visits save on this device.'); }
    else if (archive.owner().startsWith('user:')) status('local', 'Saved on this device. Sign in again to sync.');
    emit();
  });
  return accepting;
}
export async function sync() {
  clearTimeout(timer);
  if (!session || !client) return;
  if (busy) { again = true; return; }
  busy = true; again = false;
  const id = session.user.id, owner = 'user:' + id;
  status('syncing', 'Syncing your archive…');
  try {
    // Pin the token: a cross-tab account switch must not upload A's save as B.
    const token = session.access_token;
    const pinned = globalThis.supabase.createClient(publicConfig.url, publicConfig.key, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false } });
    const fixed = supabaseRemote(pinned);
    const done = await syncArchive({ read: () => archive.document(owner), merge: d => archive.merge(d, owner), remote: fixed, allowed: () => session?.user.id === id });
    if (done) status('synced', 'Archive synced');
    // Local changes made during a save are picked up by the next scheduled pass.
  } catch (error) { status('error', 'Saved on this device. Cloud sync failed; retry when connected.'); console.warn('Archive sync:', error.message); }
  finally { busy = false; clearTimeout(timer); if (again) schedule(); }
}
export async function signInGoogle() {
  const c = await startAccounts({ force: true }); if (!c) throw Error('Cloud saves are not configured yet.');
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('./archive', location.href).href } });
  if (error) throw error;
}
export async function emailCode(email) {
  const c = await startAccounts({ force: true }); if (!c) throw Error('Cloud saves are not configured yet.');
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw error;
}
export async function verifyCode(email, token) {
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' }); if (error) throw error;
}
export async function signOut() {
  if (client) { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw error; }
  session = null; state.user = null; clearTimeout(timer); await archive.signOut(); status('local', 'Signed out. New visits save on this device.');
}
window.addEventListener('online', schedule);
window.addEventListener('storage', e => {
  if (e.key === 'blockrooms:auth' && e.newValue && !client) startAccounts().catch(() => {});
  if (e.key?.startsWith('blockrooms:archive:')) { emit(); schedule(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
