#!/usr/bin/env node
// The Office — daemon entry point.
//
//   node daemon.mjs            then open http://localhost:4317
//
// The spine itself lives in server/ (see server/office.mjs for the assembly);
// this file only starts it and handles the process lifecycle. Zero external
// dependencies.
import { loadConfig } from './server/config.mjs';
import { createOffice } from './server/office.mjs';
import { flushAll } from './server/persist.mjs';

const cfg = loadConfig();
let office;
try {
  office = createOffice(cfg);
} catch (err) {
  console.error(`\n  The Office could not start: ${err.message}\n`);
  process.exit(1);
}

let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  try { await Promise.race([office.stop(), new Promise((r) => setTimeout(r, 1500))]); }
  finally { flushAll(); process.exit(code); }
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// One bad request or listener must not take the whole office down. Log it,
// keep serving; the watchdog covers the cases that truly are fatal.
process.on('uncaughtException', (err) => {
  console.error('[daemon] uncaught exception (still running):', err?.stack || err);
});
process.on('unhandledRejection', (err) => {
  console.error('[daemon] unhandled rejection (still running):', err?.stack || err);
});

try {
  await office.start();
  const url = `http://localhost:${cfg.port}`;
  console.log(`\n  The Office is open  →  ${url}\n`
    + `  classic 2D view:    ${url}/classic/\n`
    + `  everything it does: ${url}/api\n`
    + (cfg.loopbackOnly ? '' : `  listening on:       ${cfg.hosts.join(', ')}  (token required)\n`));
} catch (err) {
  if (err?.code === 'EADDRINUSE') {
    console.error(`\n  Port ${cfg.port} is already in use. Another office may be running — `
      + `try OFFICE_PORT=${cfg.port + 2} node daemon.mjs\n`);
  } else {
    console.error(`\n  The Office could not start: ${err?.message || err}\n`);
  }
  process.exit(1);
}
