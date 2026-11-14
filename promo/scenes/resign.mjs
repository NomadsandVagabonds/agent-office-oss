#!/usr/bin/env node
// Scene 9 — somebody resigns. Ada's context is full: she leaves a handoff and a note, her card goes back on the board,
// and she takes the lift. Needs a build of the office that has office life (`office resign`): the studio on 4412.
//   node scenes/resign.mjs [port]        (run scenes/ambient.mjs alongside; this one seats Ada first, which takes half a minute)
import { studio, record, sleep } from '../rig/direct.mjs';

const port = Number(process.argv[2] || 4412);
const o = studio(port);
const ADA = 'promo-ada', IVORY = 'demo-webstore-1', AMBER = 'demo-webstore-2';
o.cast.set(ADA, { id: ADA, cwd: '/tmp/demo/webstore', provider: 'gemini', model: 'gemini-2.5-pro', ctx: 96 });
for (const id of [IVORY, AMBER]) o.cast.set(id, { id, cwd: '/tmp/demo/webstore', ctx: 30 });

const HANDOFF = `# Handoff: the flaky checkout test

## Where it stands
- The cart fixture was shared between workers. Each test builds its own now.
- 40 green runs in a row on fix/checkout-fixture.

## Still to do
- The dashboard query card is back on the board, untouched.
- test/orders uses the same fixture pattern. It will flake next.

## Where things are
- Notes: docs/decisions.md
- Ivory has the context on line 212.`;

await o.api('/api/world/discover', { body: { secret: 'red-book', name: 'Lead' } });
if (!(await o.agents() || []).some((a) => a.id === ADA)) {
  await o.api('/api/agents/join', { body: { id: ADA, provider: 'gemini', model: 'gemini-2.5-pro', cwd: '/tmp/demo/webstore', name: 'Ada' } });
  await o.me(ADA, { look: { species: 'cat', skin: '#9a9aa6', hair: 'long', hairColor: '#9aa0ac', outfit: 'suit', outfitColor: '#b5483f', accessory: 'tophat', facial: 'mustache' },
    desk: { items: ['bonsai', 'mug', 'duck', 'lavalamp'] } });
  await o.card(ADA, 'webstore', 'Profile the slow dashboard query', 'doing').then((r) => r?.task && o.move(ADA, r.task.id, 'doing', { assignee: ADA }));
  await o.prompt(ADA); await o.tool(ADA, 'Edit');
  console.log('Ada is on her way to her desk…'); await sleep(32000);
}

await record(port, async ({ at }) => {
  await at(0.4); await o.tool(ADA, 'Read');
  await at(2.0);
  const res = await o.api('/api/resign', { body: { agent: ADA, note: 'Out of context. Everything I know about the checkout test is in the handoff. Somebody water the bonsai.',
    reason: 'Context window is full.', handoff: { content: HANDOFF, path: 'HANDOFF.md' } } });
  console.log('   resign:', res?.ok ? res.resignation?.id : JSON.stringify(res)?.slice(0, 200));
  await at(3.4); await o.emote(IVORY, 'salute');
  await at(3.9); await o.emote(AMBER, 'wave');
  await at(34);
}, { file: new URL('../tapes/09-resign.json', import.meta.url).pathname });

// In this build the office takes a resigning agent off the floor a second after the farewell, so the walk to the lift
// that every other departure gets is never seen. For the camera the removal is held back until she has reached the
// lift: the walk is the office's own (the placement it sent says `leaving`, with a time of arrival). 09-resign.json is
// the stream as it was; 09-resign-walkout.json is the one the shots play.
const fs = await import('node:fs');
const tape = JSON.parse(fs.readFileSync(new URL('../tapes/09-resign.json', import.meta.url), 'utf8'));
const leaving = tape.live.map((m) => JSON.parse(m.d)).find((j) => j.type === 'world_agent' && j.id === ADA && j.place?.leaving);
const gone = tape.live.find((m) => { const j = JSON.parse(m.d); return j.type === 'remove' && j.id === ADA; });
// (the line the office logs for that removal goes with it: left where it was, it replaces "… resigned — read their note" a second after it appears)
const logged = tape.live.find((m) => { const j = JSON.parse(m.d); return j.type === 'activity' && j.item?.kind === 'leave' && j.item?.agentId === ADA; });
if (leaving && gone) {
  gone.t = leaving.place.eta + 1800;
  if (logged) logged.t = gone.t + 10;
  tape.live.sort((a, b) => a.t - b.t);
  fs.writeFileSync(new URL('../tapes/09-resign-walkout.json', import.meta.url), JSON.stringify(tape));
  console.log(`[tape] 09-resign-walkout.json: removal held until ${((gone.t - tape.t0) / 1000).toFixed(1)}s`);
}
process.exit(0);
