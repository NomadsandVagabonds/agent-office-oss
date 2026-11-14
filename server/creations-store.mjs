// The Office — the creation legacy on disk (public/creations.json).
// APPEND-ONLY. The file is the contract: the daemon appends through here, the
// office-create CLI appends through here, and either works without the other.
//
// atomic write  → the hot-reading clients never see a torn file
// exclusive lock → two agents signing at once never lose one another's work
import fs from 'node:fs';
import { atomicWriteFile } from './persist.mjs';
import { normalizeCreation, validateCreation } from '../core/creations.mjs';

function sleepMs(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
  catch { const t = Date.now() + ms; while (Date.now() < t) { /* spin */ } }
}

export function readCreations(file) {
  try {
    const store = JSON.parse(fs.readFileSync(file, 'utf8'));
    return store && Array.isArray(store.creations) ? store : null;
  } catch {
    return null;
  }
}

function withLock(file, fn) {
  const lock = file + '.lock';
  const deadline = Date.now() + 5000;
  let fd = null;
  for (;;) {
    try { fd = fs.openSync(lock, 'wx'); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        // A lock older than 10s belongs to a writer that crashed.
        if (Date.now() - fs.statSync(lock).mtimeMs > 10000) { fs.unlinkSync(lock); continue; }
      } catch { /* lock vanished between calls — retry the open */ }
      if (Date.now() > deadline) {
        const err = new Error('another writer holds the legacy lock; nothing written — try again in a moment');
        err.code = 'ELOCKED';
        throw err;
      }
      sleepMs(60);
    }
  }
  try { return fn(); }
  finally {
    try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(lock); } catch {}
  }
}

/**
 * Validate and append one creation. The signature (author/runtime/createdAt)
 * is supplied by the caller from the agent's resolved identity — never taken
 * from the entry itself.
 * @returns {{ok:true, creation:object, notes:string[]} | {ok:false, errors:string[], notes:string[]}}
 */
export function appendCreation(file, entry, signature) {
  const signed = normalizeCreation({
    ...entry,
    author: signature.author,
    runtime: signature.runtime,
    createdAt: Date.now(),
  });
  return withLock(file, () => {
    const store = readCreations(file);
    if (!store) {
      return { ok: false, notes: [], errors: ['creations.json is missing or malformed; refusing to write (it would risk the shared legacy)'] };
    }
    const { errors, notes } = validateCreation(signed, {
      existingIds: new Set(store.creations.map((c) => c.id)),
    });
    if (errors.length) return { ok: false, errors, notes };
    store.creations.push(signed);              // append, never overwrite
    atomicWriteFile(file, JSON.stringify(store, null, 2) + '\n');
    return { ok: true, creation: signed, notes };
  });
}
