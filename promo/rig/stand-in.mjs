#!/usr/bin/env node
// A stand-in agent for the camera. It is the office's own test fixture (test/fixtures/fake-acp-agent.mjs or
// fake-codex-app-server.mjs, which speak the real wire formats and spend no tokens) with two things done to the wire:
//
//   - a plainly worded request is given the turn it should produce, at a human pace — the fixture is scripted by its
//     prompt, and nobody types "plan:a|b; tool:npm test" at an agent;
//   - the fixture's model names (Fake Large, GPT Fake) are shown under the names in LABELS.
//
// So what is filmed is the office's real console, harness and transcript, driven by an agent that does not exist. That
// is the same bargain `npm run demo` makes with its simulated roster. PROMO_LABELS=plain leaves the fixture's names alone.
//
//   node stand-in.mjs acp|codex        PROMO_CHECKOUT=<an office checkout, for the fixtures>
import { spawn } from 'node:child_process';
import path from 'node:path';

const kind = process.argv[2] === 'codex' ? 'codex' : 'acp';
const checkout = process.env.PROMO_CHECKOUT || process.cwd();
const fixture = path.join(checkout, 'test', 'fixtures', kind === 'codex' ? 'fake-codex-app-server.mjs' : 'fake-acp-agent.mjs');
const plain = process.env.PROMO_LABELS === 'plain';
// longest first: one name is the start of another
const LABELS = plain ? [] : kind === 'codex'
  ? [['GPT Fake Mini', 'GPT-5 Codex Mini'], ['gpt-fake-mini', 'gpt-5-codex-mini'], ['GPT Fake', 'GPT-5 Codex'], ['gpt-fake', 'gpt-5-codex']]
  : [['Fake Large', 'Gemini 2.5 Pro'], ['fake-large', 'gemini-2.5-pro'], ['Fake Small', 'Gemini 2.5 Flash'], ['fake-small', 'gemini-2.5-flash']];

// what a request turns into (the fixture's own little language: see test/fixtures/fake-lib.mjs)
const TURNS = [
  [/checkout test is flaky/i, ['plan:Reproduce the flaky checkout test|Find the shared state|Fix it and add a regression test', 'sleep:1300',
    'think:The cart fixture looks shared between workers.', 'sleep:1100', 'tool:npm test -- checkout', 'sleep:1500', 'read:test/fixtures/cart.js', 'sleep:1000',
    'edit:test/fixtures/cart.js', 'sleep:900', 'edit:test/checkout.test.js', 'sleep:1100', 'tool:npm test -- checkout --repeat 40', 'sleep:1400', 'usage:41000/200000',
    'say:The cart fixture was shared between workers. Each test now builds its own cart, and the suite has passed 40 times in a row.']],
  [/rate limit/i, ['plan:Read the gateway middleware|Add a token bucket per key|Cover it with tests', 'sleep:1200', 'tool:rg "limiter" src/', 'sleep:1200',
    'edit:src/middleware/limit.js', 'sleep:1000', 'tool:npm test -- limit', 'sleep:1200', 'usage:63000/200000', 'say:Sixty requests a minute per key, with the bucket in Redis so it holds across workers.']],
];
const scriptFor = (text) => { for (const [re, steps] of TURNS) if (re.test(text)) return steps.join('; '); return null; };

const child = spawn(process.execPath, [fixture, ...process.argv.slice(3)], { stdio: ['pipe', 'pipe', 'inherit'], env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));

function lines(stream, onLine) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); onLine(line); } });
  stream.on('end', () => { if (buf) onLine(buf); });
}
/** Give every plainly worded request inside this message the turn it stands for. */
function direct(node) {
  if (typeof node === 'string') { const s = scriptFor(node); return s && !node.includes('[[script]]') ? `${node}\n[[script]]${s}[[/script]]` : node; }
  if (Array.isArray(node)) return node.map(direct);
  if (node && typeof node === 'object') { const out = {}; for (const [k, v] of Object.entries(node)) out[k] = direct(v); return out; }
  return node;
}
// office → agent: the names go back to the fixture's own; a request is given its turn
lines(process.stdin, (line) => {
  let text = line;
  for (const [theirs, ours] of LABELS) text = text.split(ours).join(theirs);
  try { const msg = JSON.parse(text); if (msg && /prompt|turn/i.test(String(msg.method || ''))) text = JSON.stringify(direct(msg)); } catch { /* not ours to read */ }
  child.stdin.write(text + '\n');
});
process.stdin.on('end', () => child.stdin.end());
// agent → office: under the names the camera should see (never inside the script we handed it)
lines(child.stdout, (line) => {
  let text = line;
  for (const [theirs, ours] of LABELS) text = text.split(theirs).join(ours);
  process.stdout.write(text + '\n');
});
