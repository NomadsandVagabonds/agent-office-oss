import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCK_FILE = path.join(HERE, 'data', 'observe-codex.lock.json');

export function codexObserverLockFile() {
  return LOCK_FILE;
}

export function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function readCodexObserverLock(file = LOCK_FILE) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || !raw.pid) return null;
    return {
      pid: Number(raw.pid) || null,
      startedAt: Number(raw.startedAt) || 0,
      source: raw.source || 'unknown',
      port: Number(raw.port) || null,
      owner: raw.owner || null,
      alive: isPidAlive(raw.pid),
    };
  } catch {
    return null;
  }
}

export function acquireCodexObserverLock({
  pid = process.pid,
  source = 'observe-codex',
  port = null,
  owner = null,
  file = LOCK_FILE,
} = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const current = readCodexObserverLock(file);
  if (current?.alive && current.pid !== pid) return { ok: false, owner: current };
  const next = {
    pid,
    startedAt: Date.now(),
    source,
    port,
    owner,
  };
  const tmp = `${file}.${pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, file);
  return { ok: true, owner: { ...next, alive: true } };
}

export function releaseCodexObserverLock(pid = process.pid, file = LOCK_FILE) {
  const current = readCodexObserverLock(file);
  if (!current) return false;
  if (Number(current.pid) !== Number(pid)) return false;
  try {
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

export function codexObserverStatus(file = LOCK_FILE) {
  const current = readCodexObserverLock(file);
  if (!current) return {
    running: false,
    pid: null,
    startedAt: 0,
    source: null,
    port: null,
    owner: null,
    lockFile: file,
  };
  return {
    running: !!current.alive,
    pid: current.pid,
    startedAt: current.startedAt,
    source: current.source,
    port: current.port,
    owner: current.owner,
    lockFile: file,
  };
}
