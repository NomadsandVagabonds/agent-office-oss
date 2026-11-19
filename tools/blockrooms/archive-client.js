import { createArchiveStorage } from './archive-storage.js';
import { syncArchive, supabaseRemote } from './archive-cloud.js';
import { archiveRequest, workerRemote } from './archive-worker.js';
const marker = 'blockrooms:cf-session';
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
  try { if (!force && !browserStorage?.getItem('blockrooms:auth') && !browserStorage?.getItem(marker)) return Promise.resolve(null); } catch { return Promise.resolve(null); }
  if (starting) return starting;
  starting = (async () => {
    const res = await fetch('./account-config.json', { cache: 'no-store' });
    if (!res.ok) throw Error('Cloud saves are unavailable. Your local archive still works.');
    const config = await res.json();
    if (config.provider === 'cloudflare') {
      publicConfig = config;
      await refreshWorkerSession();
      state.ready = true; emit(); return config;
    }
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
let refreshOrder = 0;
async function refreshWorkerSession() {
  const order = ++refreshOrder;
  const { user, providers } = await archiveRequest('session');
  if (order !== refreshOrder) return;
  state.providers = providers;
  state.configured = !!user || providers.google || providers.email;
  try {
    if (user) browserStorage?.setItem(marker, user.id);
    else browserStorage?.removeItem(marker);
  } catch { /* Storage can be disabled. The current tab still works. */ }
  await acceptSession(!user && archive.owner().startsWith('user:') ? 'SIGNED_OUT' : 'INITIAL_SESSION', user ? { user } : null);
}
let accepting = Promise.resolve();
function acceptSession(event, next) {
  accepting = accepting.catch(() => {}).then(async () => {
    session = next; state.user = next?.user ? { id: next.user.id, email: next.user.email } : null;
    if (next) {
      if (archive.owner() !== 'user:' + next.user.id) await archive.claim(next.user.id);
      schedule();
    } else if (event === 'SIGNED_OUT') { clearTimeout(timer); await archive.signOut(); status('local', 'Signed out. New visits save on this device.'); }
    else if (archive.owner().startsWith('user:')) status('local', 'Saved on this device. Sign in again to sync.');
    emit();
  });
  return accepting;
}
export async function sync() {
  clearTimeout(timer);
  if (!session || (!client && publicConfig?.provider !== 'cloudflare')) return;
  if (busy) { again = true; return; }
  busy = true; again = false;
  const id = session.user.id, owner = 'user:' + id;
  status('syncing', 'Syncing your archive…');
  try {
    // Pin the token: a cross-tab account switch must not upload A's save as B.
    let fixed;
    if (publicConfig.provider === 'cloudflare') fixed = workerRemote(id);
    else {
      const token = session.access_token;
      const pinned = globalThis.supabase.createClient(publicConfig.url, publicConfig.key, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false } });
      fixed = supabaseRemote(pinned);
    }
    const done = await syncArchive({ read: () => archive.document(owner), merge: d => archive.merge(d, owner), remote: fixed, allowed: () => session?.user.id === id });
    if (done) status('synced', 'Archive synced');
    // Local changes made during a save are picked up by the next scheduled pass.
  } catch (error) {
    if (publicConfig.provider === 'cloudflare' && error.status === 401) {
      await refreshWorkerSession().catch(() => status('error', 'Saved on this device. Sign in again to sync.'));
    } else if (session?.user.id === id) status('error', 'Saved on this device. Cloud sync failed. Retry when connected.');
  }
  finally { busy = false; if (again) schedule(); }
}
export async function signInGoogle({ returnTo = 'archive' } = {}) {
  const c = await startAccounts({ force: true }); if (!c) throw Error('Cloud saves are not configured yet.');
  if (publicConfig.provider === 'cloudflare') {
    const { url } = await archiveRequest('google', { returnTo });
    location.assign(url); return;
  }
  const redirectTo = new URL(returnTo === 'home' ? './' : './archive', location.href).href;
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  if (error) throw error;
}
export async function emailCode(email) {
  const c = await startAccounts({ force: true }); if (!c) throw Error('Cloud saves are not configured yet.');
  if (publicConfig.provider === 'cloudflare') return archiveRequest('email', { email });
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw error;
}
export async function verifyCode(email, token) {
  if (publicConfig?.provider === 'cloudflare') {
    await archiveRequest('verify', { email, code: token });
    await refreshWorkerSession(); return;
  }
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' }); if (error) throw error;
}
export async function signOut() {
  if (publicConfig?.provider === 'cloudflare') {
    await archiveRequest('logout', {});
    await refreshWorkerSession(); return;
  }
  if (client) { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw error; }
  session = null; state.user = null; clearTimeout(timer); await archive.signOut(); status('local', 'Signed out. New visits save on this device.');
}
window.addEventListener('online', schedule);
window.addEventListener('storage', e => {
  if (e.key === marker) {
    if (publicConfig?.provider === 'cloudflare') refreshWorkerSession().catch(() => {});
    else if (e.newValue) startAccounts().catch(() => {});
  }
  if (e.key === 'blockrooms:auth' && e.newValue && !client) startAccounts().catch(() => {});
  if (e.key?.startsWith('blockrooms:archive:')) { emit(); schedule(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
