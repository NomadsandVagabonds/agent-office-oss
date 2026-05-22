#!/usr/bin/env node
import cp from 'node:child_process';
import process from 'node:process';

const PORT = Number(process.env.OFFICE_PORT || 4317);
const HEALTH = `http://127.0.0.1:${PORT}/api/health`;
const spawned = [];
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function officeUp() {
  try {
    const res = await fetch(HEALTH);
    return res.ok;
  } catch {
    return false;
  }
}

function killSpawned() {
  for (const child of spawned) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

function onSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[office demo] received ${signal}, shutting down...`);
  killSpawned();
  setTimeout(() => process.exit(0), 100);
}

function spawnNode(label, file) {
  const child = cp.spawn(process.execPath, [file], {
    stdio: 'inherit',
    env: process.env,
  });
  spawned.push(child);
  child.on('exit', (code, sig) => {
    if (shuttingDown) return;
    console.error(`[office demo] ${label} exited (${sig || code})`);
    shuttingDown = true;
    killSpawned();
    process.exit(typeof code === 'number' ? code : 1);
  });
  return child;
}

async function waitForOffice() {
  for (let i = 0; i < 60; i++) {
    if (await officeUp()) return true;
    await sleep(250);
  }
  return false;
}

process.on('SIGINT', () => onSignal('SIGINT'));
process.on('SIGTERM', () => onSignal('SIGTERM'));

let reusedDaemon = false;
if (await officeUp()) {
  reusedDaemon = true;
  console.log(`[office demo] reusing existing Office at http://localhost:${PORT}`);
} else {
  console.log(`[office demo] starting daemon on http://localhost:${PORT}`);
  spawnNode('daemon', 'daemon.mjs');
  const ready = await waitForOffice();
  if (!ready) {
    console.error('[office demo] daemon did not become healthy in time.');
    killSpawned();
    process.exit(1);
  }
}

console.log('[office demo] starting fictional demo roster');
spawnNode('simulate', 'simulate.mjs');

console.log(`[office demo] ready → http://localhost:${PORT}`);
if (reusedDaemon) {
  console.log('[office demo] note: daemon was already running; Ctrl+C will stop only the demo roster started here.');
}

await new Promise(() => {});
