// Vercel keeps the public API and its validation. This is its private,
// fetch-only connection to the book's Cloudflare Worker/D1 store.
export function remoteStore(env = process.env, fetchImpl = globalThis.fetch) {
  let url;
  try { url = new URL(env.BOOK_STORE_URL); } catch { return null; }
  const key = String(env.BOOK_STORE_KEY || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || key.length < 32) return null;
  async function call(action, fields = {}) {
    const res = await fetchImpl(url.href, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...fields }), redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`the book store answered ${res.status}`);
    const body = await res.json();
    if (!body || body.ok !== true || !Object.hasOwn(body, 'result')) throw new Error('the book store answered something else');
    return body.result;
  }
  return {
    read: () => call('read'),
    count: (kind, visitor) => call('count', { kind, visitor }),
    sign: (entry, visitor, duplicate) => call('sign', { entry, visitor, duplicate }),
    strike: id => call('strike', { id }),
  };
}
