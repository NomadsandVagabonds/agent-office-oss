// Only public browser configuration goes into the static build. A privileged
// Supabase key must never become a deployed asset (even by mistaken env name).
export function accountConfig(env = process.env, { local = false } = {}) {
  if (env.BLOCKROOMS_ACCOUNTS === 'cloudflare') return { enabled: true, provider: 'cloudflare' };
  const url = env.BLOCKROOMS_SUPABASE_URL || '', key = env.BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY || '';
  if (!url && !key) return { enabled: false };
  if (!url || !key) throw Error('Set both BLOCKROOMS_SUPABASE_URL and BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY.');
  const u = new URL(url);
  if (u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname) ||
    !(u.protocol === 'https:' || (local && u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname)))) throw Error('Supabase URL must be an HTTPS origin (loopback HTTP only in a local review build).');
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && key.split('.').length === 3) {
    try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* rejected below */ }
  }
  if (!publicKey) throw Error('Use a Supabase publishable/anon key. Secret and service-role keys are forbidden in browser builds.');
  return { enabled: true, url: u.origin, key };
}
