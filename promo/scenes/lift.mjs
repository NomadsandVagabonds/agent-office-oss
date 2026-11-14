#!/usr/bin/env node
// A quiet half-minute of the office for the lift shots (after the 'noclip' discovery, so the plate has its unmarked button).
import { studio, record } from '../rig/direct.mjs';
const port = Number(process.argv[2] || 4410);
const o = studio(port);
await record(port, async ({ at }) => { await at(30); }, { file: new URL('../tapes/08-lift.json', import.meta.url).pathname });
process.exit(0);
