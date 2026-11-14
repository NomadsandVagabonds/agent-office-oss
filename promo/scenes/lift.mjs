#!/usr/bin/env node
// A quiet half-minute of the office for the lift shots (after the 'noclip' discovery, so the plate has its unmarked button).
import { studio, record } from '../rig/direct.mjs';
const port = Number(process.argv[2] || 4410);
const o = studio(port);
const name = process.argv[3] || '08-lift';          // e.g. `node scenes/lift.mjs 4412 10-quiet` for the newest build's office
await record(port, async ({ at }) => { await at(30); }, { file: new URL(`../tapes/${name}.json`, import.meta.url).pathname });
process.exit(0);
