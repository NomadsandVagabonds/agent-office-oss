// BlockRooms — the visitors' book (GET and POST /api/book). This file is only
// where the host looks for it; what it does is tools/blockrooms/book-api.mjs,
// what may be written is core/book.mjs, and docs/BLOCKROOMS.md says what the
// host has to be given for there to be a book at all.
import { handle } from '../tools/blockrooms/book-api.mjs';
import { createStore, storeTrouble } from '../tools/blockrooms/book-store.mjs';
import { ticketKey } from '../tools/blockrooms/visit-ticket.mjs';

// (said once as this starts, in the host's own log and nowhere else: which setting is wrong, never what it is set to)
const trouble = storeTrouble();
if (trouble) console.warn(`[book] no store: ${trouble.says}`);

const ctx = {
  store: createStore(),
  settings: trouble ? trouble.settings : '',
  salt: process.env.BOOK_SALT || process.env.BOOK_STORE_KEY || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || 'blockrooms',
  // words no name in the book may have in it, and the key that strikes a line out: whoever hosts the site says what they are
  blocklist: String(process.env.BOOK_BLOCKLIST || '').split(',').map((w) => w.trim()).filter(Boolean),
  adminKey: process.env.BOOK_ADMIN_KEY || '',
  // the code that opens the dev mode (?debug) on the live site: ours to know (at least 12 characters; none set: no dev mode)
  devCode: process.env.BLOCKROOMS_DEV_CODE || '',
  checks: true,          // a signing needs its visit's ticket, and its route is checked (visit-ticket.mjs, visit-check.mjs)
};
// the key that signs a visit's ticket as it goes in (visit-ticket.mjs): the host's own if it set one, else made from the
// book's own secret above. Never sent anywhere; a ticket only carries what it signs
ctx.ticketKey = ticketKey({ key: process.env.BOOK_TICKET_KEY || '', salt: ctx.salt });

export const GET = (request) => handle(request, ctx);
export const POST = (request) => handle(request, ctx);
