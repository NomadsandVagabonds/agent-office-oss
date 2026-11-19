export const SESSION = '__Host-br_session';
export const LINK = '__Host-br_link';
export const FLOW = '__Host-br_google';
export const MAX_SAVE = 256 * 1024;
export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
export class Problem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function cookie(request, name) {
  const prefix = name + '=';
  return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(prefix))?.slice(prefix.length) || '';
}
export const setCookie = (name, value, seconds) => name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + seconds;
const utf8 = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async value => base64url(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
export async function keyedHash(secret, value) {
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, utf8.encode(value)));
}
export async function readJson(request, limit) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Problem(415, 'Expected JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new Problem(400, 'Request body missing.');
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Problem(413, 'Archive too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Problem(400, 'Invalid request.');
  return body;
}
