#!/usr/bin/env node
// watchdog.mjs — keeps The Office alive.
//
// The daemon has no supervisor: one uncaught throw and the whole office is
// gone — silently, until a human happens to notice (it just happened: a
// circular-JSON crash in a WS snapshot killed it and posts failed into the
// void for an unknown stretch). This is the missing piece. It is an
// EXTERNAL supervisor — zero daemon.mjs edits, same run-and-leave ethos as
// observe.mjs / simulate.mjs. Run it once and leave it:
//
//   nohup node watchdog.mjs >> /tmp/watchdog.log 2>&1 &
//
// What it does:
//  - health-pings /api/health every POLL ms
//  - after FAIL_N consecutive failures (not one blip) → declares it down,
//    snapshots the crash tail to /tmp/office-crashes.log (so traces aren't
//    lost), kills any zombie, respawns `node daemon.mjs`
//  - crash-loop guard: if it has to restart too many times in a window it
//    stops hammering and logs loudly — a deterministically broken daemon is
//    Patchbay's to fix, not something to restart forever
//  - the watchdog itself must never throw out of its loop (fail-safe)
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const POLL = 5000;            // health cadence
const FAIL_N = 2;             // consecutive misses before we act (~10s)
const DAEMON_LOG = '/tmp/office.log';
const CRASH_LOG = '/tmp/office-crashes.log';
const LOOP_WINDOW = 120000;   // 2 min
const LOOP_MAX = 5;           // > this many restarts in the window = crash-loop
const COOLDOWN = 300000;      // pause restarts for 5 min when crash-looping

const log = (m) => console.log(`[watchdog ${new Date().toISOString()}] ${m}`);
let misses = 0;
let restarts = [];            // timestamps
let cooldownUntil = 0;

async function healthy() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return !j || j.status === 'ok';   // tolerate shape; ok or unparseable-but-200
  } catch { return false; }
}

function snapshotCrash() {
  try {
    const raw = fs.readFileSync(DAEMON_LOG, 'utf8');
    const tail = raw.split('\n').slice(-60).join('\n');
    fs.appendFileSync(CRASH_LOG,
      `\n===== daemon down detected ${new Date().toISOString()} =====\n${tail}\n`);
    log(`crash tail captured → ${CRASH_LOG}`);
  } catch { /* log may not exist yet — fine */ }
}

function restartDaemon() {
  try { execSync('pkill -f "node daemon.mjs"', { stdio: 'ignore' }); } catch { /* none to kill */ }
  // append (never truncate) so forensic history survives across restarts
  const out = fs.openSync(DAEMON_LOG, 'a');
  const child = spawn(process.execPath, ['daemon.mjs'], {
    cwd: HERE, detached: true, stdio: ['ignore', out, out],
  });
  child.unref();
  restarts.push(Date.now());
  log(`respawned daemon.mjs (pid ${child.pid})`);
}

function crashLooping() {
  const now = Date.now();
  restarts = restarts.filter((t) => now - t < LOOP_WINDOW);
  return restarts.length >= LOOP_MAX;
}

async function tick() {
  try {
    if (Date.now() < cooldownUntil) return;        // in crash-loop cooldown
    if (await healthy()) {
      if (misses) log(`recovered (was ${misses} miss${misses > 1 ? 'es' : ''})`);
      misses = 0;
      return;
    }
    misses += 1;
    log(`health miss ${misses}/${FAIL_N}`);
    if (misses < FAIL_N) return;                    // a blip — don't act yet
    if (crashLooping()) {
      cooldownUntil = Date.now() + COOLDOWN;
      log(`CRASH-LOOP: ${restarts.length} restarts in <2m — pausing ${COOLDOWN / 1000}s. `
        + `daemon.mjs is deterministically dying; this is Patchbay's to fix.`);
      misses = 0;
      return;
    }
    snapshotCrash();
    restartDaemon();
    misses = 0;
  } catch (e) {
    log(`tick error (ignored, staying up): ${e && e.message}`);
  }
}

log(`watching ${BASE}/api/health every ${POLL / 1000}s (act after ${FAIL_N} misses)`);
await tick();
setInterval(tick, POLL);
