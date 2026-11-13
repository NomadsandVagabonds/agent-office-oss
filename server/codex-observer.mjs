// The Office — keeps the Codex observer (observe-codex.mjs) running as a
// child of the daemon, unless one is already active or auto-observe is off.
import cp from 'node:child_process';
import path from 'node:path';
import { codexObserverStatus } from '../codex-observer-state.mjs';

const RESTART_MS = 5000;

export function createCodexObserver(cfg, log) {
  let child = null;
  let retry = null;
  let stopping = false;

  function status() {
    const s = codexObserverStatus();
    return {
      ...s,
      enabled: cfg.autoObserveCodex,
      managedByDaemon: !!(child && s.pid && child.pid === s.pid),
    };
  }

  function start() {
    if (!cfg.autoObserveCodex || stopping) return;
    if (codexObserverStatus().running) return;
    if (child && child.exitCode === null) return;
    const spawned = cp.spawn(process.execPath, [path.join(cfg.root, 'observe-codex.mjs')], {
      cwd: cfg.root,
      env: { ...process.env, OFFICE_PORT: String(cfg.port), OFFICE_OBSERVER_OWNER: 'daemon' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = spawned;
    const pipe = (stream, fn) => stream.on('data', (buf) => {
      const line = String(buf || '').trim();
      if (line) fn(`[codex-observer] ${line}`);
    });
    pipe(spawned.stdout, log.info);
    pipe(spawned.stderr, log.warn);
    spawned.on('error', () => { if (child === spawned) child = null; });
    spawned.on('exit', (code, signal) => {
      if (child === spawned) child = null;
      if (stopping) return;
      if (retry) clearTimeout(retry);
      // A clean exit means "nothing to do / another observer owns it" — do
      // not hammer; just look again later.
      if (code !== 0) {
        log.warn('[codex-observer] exited'
          + (code !== null ? ` with code ${code}` : '') + (signal ? ` (${signal})` : '') + '; retrying.');
      }
      retry = setTimeout(() => { retry = null; start(); }, code === 0 ? RESTART_MS * 12 : RESTART_MS);
      if (typeof retry.unref === 'function') retry.unref();
    });
  }

  function stop() {
    stopping = true;
    if (retry) { clearTimeout(retry); retry = null; }
    if (child && child.exitCode === null) {
      try { child.kill('SIGTERM'); } catch {}
    }
  }

  return { status, start, stop };
}
