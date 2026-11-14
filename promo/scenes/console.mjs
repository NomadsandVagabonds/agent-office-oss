#!/usr/bin/env node
// Scene 7 — the console: the same office as text. A driven agent (a stand-in: see rig/stand-in.mjs) is asked to fix a
// flaky test and does; two colleagues are waiting on the human; cards move on the Webstore board.
//   node scenes/console.mjs [port]      (the console's studio: rig/studio <checkout> 4411, on a copy of the 3D takes' data)
import fs from 'node:fs';
import { studio, record, sleep } from '../rig/direct.mjs';

const port = Number(process.argv[2] || 4411);
const o = studio(port);
const file = new URL('../tapes/07-console.json', import.meta.url).pathname;
const REQUEST = 'The checkout test is flaky. Find out why and fix it.';

// a clean slate: no driven sessions left over from an earlier take, and the Ada who walked in by the lift has gone home
for (const s of (await o.api('/api/harness/sessions?all=1'))?.sessions || []) await o.api(`/api/harness/sessions/${s.id}`, { method: 'DELETE' });
await o.api('/api/agents/promo-ada/leave', { body: {} });
await sleep(800);
// Codex has to have run here once for the console to know which models it offers
const warm = await o.api('/api/harness/sessions', { body: { adapter: 'codex', cwd: '/tmp/demo/webstore', name: 'Warm-up' } });
if (warm?.session?.id) { await sleep(1500); await o.api(`/api/harness/sessions/${warm.session.id}`, { method: 'DELETE' }); }
const made = await o.api('/api/harness/sessions', { body: { adapter: 'gemini', cwd: '/tmp/demo/webstore', name: 'Ada', mode: 'ask' } });
const id = made?.session?.id;
if (!id) { console.error('no session:', JSON.stringify(made)); process.exit(1); }
await o.me(id, { look: { species: 'cat', skin: '#9a9aa6', hair: 'long', hairColor: '#9aa0ac', outfit: 'suit', outfitColor: '#b5483f', accessory: 'tophat', facial: 'mustache' },
  desk: { items: ['bonsai', 'mug', 'duck', 'lavalamp', 'c_ada_first_deploy'] } });

// the floor: most people at work, two with a question for the human
const ROSTER = { 'demo-webstore-1': 'webstore', 'demo-webstore-2': 'webstore', 'demo-mobile-1': 'mobile-app', 'demo-mobile-2': 'mobile-app', 'demo-api-1': 'api-gateway', 'demo-api-2': 'api-gateway',
  'demo-data-1': 'data-pipeline', 'demo-ml-1': 'ml-research', 'demo-ml-2': 'ml-research', 'demo-infra-1': 'infra', 'demo-docs-1': 'docs-site', 'demo-growth-1': 'growth' };
for (const [aid, dept] of Object.entries(ROSTER)) o.cast.set(aid, { id: aid, cwd: `/tmp/demo/${dept}`, ctx: 20 + (aid.length * 7) % 40 });
const busy = ['demo-webstore-2', 'demo-mobile-1', 'demo-ml-1', 'demo-infra-1', 'demo-api-1'];
for (const aid of Object.keys(ROSTER)) await o.stop(aid);
for (const aid of busy) { await o.prompt(aid); await o.tool(aid, 'Edit'); }
await o.ask('demo-api-2', 'Which dataset — v3 or v4?');
await o.ask('demo-data-1', 'OK to delete the old migration files?');
const cards = (await o.api('/api/tasks?deptId=webstore'))?.tasks || [];
const todo = cards.find((t) => t.status === 'todo'), doing = cards.find((t) => t.status === 'doing');
await sleep(1500);

const tape = await record(port, async ({ at }) => {
  const TOOLS = ['Read', 'Edit', 'Bash', 'Grep', 'Write'];
  let n = 0;
  const flicker = async (t) => { await at(t); const aid = busy[n % busy.length]; await o.toolDone(aid, 'Edit'); await o.tool(aid, TOOLS[n++ % TOOLS.length]); };
  await flicker(1.2); await flicker(2.4);
  await at(3.2); await o.api(`/api/harness/sessions/${id}/turn`, { body: { text: REQUEST } });
  for (const t of [4.6, 6.1, 7.7, 9.0, 10.4, 12.2, 13.9, 15.6, 17.2]) await flicker(t);
  await at(19.4); if (todo) await o.move('demo-webstore-2', todo.id, 'doing', { assignee: 'demo-webstore-2' });
  await at(20.8); if (doing) await o.move('demo-webstore-1', doing.id, 'review');
  await at(22.2); await o.card('demo-webstore-1', 'webstore', 'Add a regression test for the cart fixture', 'todo');
  await at(24.5);
}, { watch: '*', http: ['/api/harness', '/api/tasks', '/api/prompts', '/api/usage', '/api/agents', `/api/harness/sessions/${id}/transcript`] });
tape.meta = { session: id, request: REQUEST };
fs.writeFileSync(file, JSON.stringify(tape));
const kinds = {}; for (const m of tape.live) { const k = JSON.parse(m.d).type; kinds[k] = (kinds[k] || 0) + 1; }
console.log(`[tape] ${file}: session ${id}, ${tape.live.length} live`, kinds);
process.exit(0);
