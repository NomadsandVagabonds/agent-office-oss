// Synchronous local reads keep Play independent of auth/network. Writes use a
// cross-tab lock; namespaces/claims keep another account's cache out of a save.
import { CLEARANCE_FLOORS, importArchive, cleanArchive, mergeArchive, archiveRecord, archiveRun, editArchive } from './core/archive.mjs';
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
  // Stamps travel with the cloud document. Locally they have their own ledger so a
  // game tab opened before the pass existed can still write the old save shape.
  const doc = id => {
    id = resolve(id || owner());
    const record = read(PREFIX + 'save:' + id);
    return cleanArchive({ ...record, activity: read(PREFIX + 'activity:' + id) ?? record?.activity,
      clearances: read(PREFIX + 'stamps:' + id) ?? record?.clearances });
  };
  const put = (id, value) => {
    id = resolve(id);
    const { clearances, activity, ...record } = cleanArchive(value);
    write(PREFIX + 'activity:' + id, activity);
    if (clearances.length) write(PREFIX + 'stamps:' + id, clearances);
    write(PREFIX + 'save:' + id, record);
    changed();
    return value;
  };
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
      return { name, look: a.character?.value || resolveLook('visitor:' + name) };
    },
    edit(patch, id = owner()) { return atomic(() => put(id, editArchive(doc(id), patch, device, now()))); },
    restoreFloors({visited,clearances}, id = owner()) { return atomic(() => {
      const before = doc(id);
      if (visited.every(f => before.activity.floors.includes(f)) && clearances.every(f => before.clearances.includes(f))) return before;
      return put(id, {...before, clearances:[...before.clearances,...clearances],
        activity:{...before.activity, floors:[...before.activity.floors,...visited]}});
    }); },
    visitFloor(theme, id = owner()) { return atomic(() => {
      const before = doc(id);
      if (!Object.hasOwn(CLEARANCE_FLOORS,theme) || before.activity.floors.includes(theme)) return before;
      return put(id, { ...before, activity:{...before.activity, floors:[...before.activity.floors,theme]} });
    }); },
    // Old scorecards retain run numbers and lifetime room totals even when no tape was kept.
    priorCards(id = owner()) {
      id = resolve(id);
      const owners = [id];
      const claimPrefix = PREFIX + 'claim:';
      for (let i = 0; storage && i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(claimPrefix) && read(k) === id) owners.push(k.slice(claimPrefix.length));
      }
      return owners.flatMap(o => Object.values(read(PREFIX + 'receipts:' + o) || {}));
    },
    clearFloor(theme, id = owner()) { return atomic(() => {
      const before = doc(id);
      if (!Object.hasOwn(CLEARANCE_FLOORS, theme) || before.clearances.includes(theme)) return before;
      return put(id, { ...before, clearances: [...before.clearances, theme] });
    }); },
    merge(value, id = owner()) { return atomic(() => {
      const before = doc(id), after = mergeArchive(before, value);
      return JSON.stringify(before) === JSON.stringify(after) ? before : put(id, after);
    }); },
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
