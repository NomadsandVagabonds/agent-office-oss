// Private storage service. Players still use Vercel's /api/book; only that
// function has this key. No browser credentials, raw addresses or cookies
// need to cross from Vercel to this Worker.
import { createD1Store } from './book-d1.mjs';
import { cleanEntry } from '../../../core/book.mjs';

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const hash = value => typeof value === 'string' && /^[\w-]{22}$/.test(value);
function authenticated(request, key) {
  const given = request.headers.get('authorization') || '', expected = `Bearer ${key}`;
  let mismatch = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) mismatch |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
async function readBody(request) {
  if (!request.body) return null;
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); throw new RangeError('body'); }
    chunks.push(value);
  }
  const joined = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(joined));
}

export function createWorker(makeStore = createD1Store) {
  return {
    async fetch(request, env) {
      if (new URL(request.url).pathname !== '/book') return json(404, { ok: false });
      if (request.method !== 'POST') return json(405, { ok: false });
      const key = String(env.BOOK_STORE_KEY || '');
      if (key.length < 32 || !env.DB) return json(503, { ok: false });
      if (!authenticated(request, key)) return json(401, { ok: false });
      if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json(415, { ok: false });
      let body;
      try { body = await readBody(request); }
      catch (err) { return json(err instanceof RangeError ? 413 : 400, { ok: false }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false });
      const store = makeStore(env.DB);
      try {
        let result;
        switch (body.action) {
          case 'read': result = await store.read(); break;
          case 'count':
            if (!['hit', 'in'].includes(body.kind) || !hash(body.visitor)) return json(400, { ok: false });
            result = await store.count(body.kind, body.visitor); break;
          case 'sign': {
            const entry = cleanEntry(body.entry);
            if (!entry || !hash(body.visitor) || !hash(body.duplicate)) return json(400, { ok: false });
            result = await store.sign(entry, body.visitor, body.duplicate); break;
          }
          case 'strike':
            if (typeof body.id !== 'string' || !/^[a-z0-9]{6,40}$/.test(body.id)) return json(400, { ok: false });
            result = await store.strike(body.id); break;
          default: return json(400, { ok: false });
        }
        return json(200, { ok: true, result });
      } catch {
        // Database failures must never put bindings, query text or entry data in responses/logs.
        return json(502, { ok: false });
      }
    },
  };
}
export default createWorker();
