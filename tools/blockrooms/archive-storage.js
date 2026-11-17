// Synchronous local reads keep Play independent of auth/network. Writes use a
// cross-tab lock; namespaces/claims keep another account's cache out of a save.
import { importArchive, cleanArchive, mergeArchive, archiveRecord, archiveRun, editArchive } from './core/archive.mjs';
import { rollName } from './core/book.mjs';
import { hashId, resolveLook } from './core/look.mjs';
const PREFIX = 'blockrooms:archive:';
export function createArchiveStorage({ storage, locks, uuid = () => crypto.randomUUID(), now = Date.now, changed = () => {} } = {}) {
  const memory = new Map(); let durable = true;
  const read = k => { if (!durable && memory.has(k)) return memory.get(k); try { return JSON.parse(storage?.getItem(k) || 'null') ?? memory.get(k) ?? null; } catch { return memory.get(k) ?? null; } };
  const write = (k, v) => { memory.set(k, v); try { if (!storage) throw Error(); storage.setItem(k, JSON.stringify(v)); } catch { durable = false; } };
  const device = read(PREFIX + 'device') || uuid(); write(PREFIX + 'device', device);
  let queue = Promise.resolve();
  const atomic = f => { const task = () => locks?.request ? locks.request(PREFIX + 'write', f) : f(); const p = queue.then(task); queue = p.catch(() => {}); return p; };
  const guest = () => { let id = read(PREFIX + 'guest'); if (!id) { id = 'guest:' + uuid(); write(PREFIX + 'guest', id); } return id; };
  const resolve = id => id?.startsWith('guest:') ? read(PREFIX + 'claim:' + id) || id : id;
  const owner = () => read(PREFIX + 'active') || guest();
  const doc = id => cleanArchive(read(PREFIX + 'save:' + resolve(id || owner())));
  const put = (id, value) => { write(PREFIX + 'save:' + resolve(id), cleanArchive(value)); changed(); return value; };
  // Leave the old data intact as a backup; import exactly once into its guest.
  if (!read(PREFIX + 'migrated')) {
    const old = read('office-backrooms:record')?.record, me = read('blockrooms:me');
    put(guest(), mergeArchive(doc(guest()), importArchive(old, { name: me?.name || me?.spare, character: me?.character || me?.look, writer: device })));
    write(PREFIX + 'migrated', true);
  }
  return {
    owner, resolve, document: doc, record: id => archiveRecord(doc(id)), durable: () => durable,
    profile(id = owner()) {
      const a = doc(id); let seed = hashId(resolve(id));
      const name = a.name?.value || rollName(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
      return { name, look: a.character?.value || resolveLook('lead:' + name, { accessory: 'crown' }) };
    },
    edit(patch, id = owner()) { return atomic(() => put(id, editArchive(doc(id), patch, device, now()))); },
    merge(value, id = owner()) { return atomic(() => put(id, mergeArchive(doc(id), value))); },
    claim(userId) { return atomic(() => {
      const id = 'user:' + userId, g = guest();
      put(id, mergeArchive(doc(id), doc(g)));
      write(PREFIX + 'claim:' + g, id); // a visit already in progress still belongs to this account
      write(PREFIX + 'guest', 'guest:' + uuid());
      write(PREFIX + 'active', id); changed(); return id;
    }); },
    signOut() { return atomic(() => { write(PREFIX + 'active', null); changed(); }); },
    report(report, visitId, id = owner(), by = this.profile(id).name) { return atomic(() => {
      id = resolve(id);
      const receiptsKey = PREFIX + 'receipts:' + id, receipts = read(receiptsKey) || {};
      if (receipts[visitId]) return receipts[visitId];
      const result = archiveRun(editArchive(doc(id), { ...(doc(id).name ? {} : { name: by }), ...(doc(id).character ? {} : { character: this.profile(id).look }) }, device, 0), report, { writer: device + ':' + (id.startsWith('guest:') ? id.slice(6) : 'account'), at: now(), by });
      put(id, result.document); receipts[visitId] = result.card;
      write(receiptsKey, Object.fromEntries(Object.entries(receipts).slice(-128)));
      return result.card;
    }); },
  };
}
