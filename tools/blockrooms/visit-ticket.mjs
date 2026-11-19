// BlockRooms — the ticket a visit is given as it starts (POST /api/book { do: 'in', seed }), and has to hand back to
// sign the book. It says which building, when it started, and a number of its own, signed with a key only the server
// holds (an HMAC: nobody can write one, or change one, without it). So a visit that never started cannot be signed
// for, a visit cannot claim to have taken less time than the clock says it did, and one visit signs once.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const TICKET = Object.freeze({
  slack: 20,             // seconds a visit's own clock may run ahead of the server's (a slow start, a clock that drifts)
  keep: 14 * 86400,      // how long after it started a visit may still be signed for (it is asked on the front page, after)
});

const b64 = (buf) => Buffer.from(buf).toString('base64url');
/** The key: the host's own (BOOK_TICKET_KEY) if it gave one, or one made from a secret it already keeps for the book. */
export function ticketKey({ key, salt }) {
  return createHash('sha256').update(`blockrooms-ticket|${key || ''}|${salt || ''}`).digest();
}
/** A ticket for a visit to `seed` that starts now. */
export function issueTicket(seed, { key, now = Date.now() }) {
  const body = b64(JSON.stringify({ s: String(seed), t: Math.floor(now), n: randomBytes(12).toString('base64url') }));
  return `${body}.${b64(createHmac('sha256', key).update(body).digest())}`;
}
/**
 * A ticket handed back with a visit. → { ok, nonce } or { ok: false, why } (why is said to the visitor).
 * Checks that the server wrote it, that it is for this building, and that at least as much time has passed since
 * it started as the visit says it took.
 */
export function checkTicket(ticket, run, { key, now = Date.now() }) {
  if (typeof ticket !== 'string' || ticket.length > 400 || !/^[\w-]+\.[\w-]+$/.test(ticket)) return { ok: false, why: 'This visit was not registered when it started, so it cannot be signed for.' };
  const [body, sig] = ticket.split('.');
  const want = createHmac('sha256', key).update(body).digest(), got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, why: 'This visit’s ticket is not one of ours.' };
  let t; try { t = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, why: 'This visit’s ticket is not one of ours.' }; }
  if (!t || typeof t.s !== 'string' || !Number.isFinite(t.t) || typeof t.n !== 'string') return { ok: false, why: 'This visit’s ticket is not one of ours.' };
  if (t.s !== run.seed) return { ok: false, why: 'This ticket is for a different building.' };
  const gone = (now - t.t) / 1000;
  if (gone > TICKET.keep) return { ok: false, why: 'This visit is too old to sign for now.' };
  if (gone + TICKET.slack < run.seconds) return { ok: false, why: 'This visit says it took longer than it has been since it started.' };
  return { ok: true, nonce: t.n, started: t.t };
}
