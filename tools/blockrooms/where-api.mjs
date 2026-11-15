// BlockRooms — where a visitor appears to be (GET /api/where): the city their
// connection comes from, for the welcome on the front page, which says it to
// them and to nobody else.
//
// The site looks nothing up. Its host works a city out of the address every
// request arrives from and hands it to the function with the request (Vercel:
// the x-vercel-ip-city header, percent-encoded). This passes it back to the
// page that asked and keeps nothing: not the city, not the address, no count.
// The answer is marked private and never to be stored, so that no cache in
// between can give one visitor another's.
const CITY = 'x-vercel-ip-city';
export const CITY_MAX = 40;

/** The city a request says it comes from: a name as a name is written, or ''. Whatever else was in the header is not passed on. */
export function cityOf(headers) {
  let raw = String(headers?.get?.(CITY) || '');
  if (!raw || raw.length > 200) return '';
  try { raw = decodeURIComponent(raw); } catch { return ''; }
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '';                      // a place name has no line ends or tabs in it
  const city = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  // letters, figures, spaces and the few marks a place name has; beginning with a letter or a figure
  if (!city || [...city].length > CITY_MAX || !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()-]*$/u.test(city)) return '';
  return city;
}

const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });

/** @param {Request} request */
export function handle(request) {
  if (request.method !== 'GET') return answer(405, { ok: false, why: 'method' });
  return answer(200, { ok: true, city: cityOf(request.headers) || null });
}
