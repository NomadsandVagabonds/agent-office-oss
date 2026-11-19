// The browser uses same-origin HttpOnly cookies. Only the archive cookies
// and the rate-limit address travel to this game's private Worker.
import { SESSION, FLOW, LINK, cookie, json } from '../tools/blockrooms/profiles/protocol.mjs';
export async function proxy(request, env = process.env, transport = fetch) {
  const { BLOCKROOMS_PROFILE_WORKER: endpoint, BLOCKROOMS_PROFILE_KEY: secret } = env;
  if (!endpoint || !secret) return json({ error: 'Cloud saves are offline.' }, 503);
  const url = new URL(request.url);
  if (request.method === 'POST' && request.headers.get('origin') !== url.origin) return json({ error: 'Open the archive on this site.' }, 403);
  const target = new URL('/api/archive', endpoint);
  if (target.protocol !== 'https:' || target.username || target.password) return json({ error: 'Cloud saves are offline.' }, 503);
  target.search = url.search;
  const headers = new Headers({ authorization: 'Bearer ' + secret });
  headers.set('cookie', [SESSION, FLOW, LINK].map(k => [k,cookie(request,k)]).filter(([,v]) => /^[\w-]{43}$/.test(v)).map(([k,v]) => k+'='+v).join('; '));
  headers.set('x-archive-client-ip', request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown');
  if (request.headers.has('content-type')) headers.set('content-type', request.headers.get('content-type'));
  try {
    const res = await transport(target, { method: request.method, headers, body: request.body, duplex: 'half', redirect: 'manual', cache: 'no-store' });
    const forward = new Headers({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
    for (const k of ['content-type','location']) if (res.headers.has(k)) forward.set(k, res.headers.get(k));
    for (const line of res.headers.getSetCookie()) forward.append('set-cookie', line);
    return new Response(res.body, { status: res.status, headers: forward });
  } catch { return json({ error: 'Cloud saves are offline.' }, 503); }
}
export const GET = request => proxy(request);
export const POST = request => proxy(request);
