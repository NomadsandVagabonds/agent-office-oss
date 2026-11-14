#!/usr/bin/env node
// The office scenes, taped one after another in story order (state carries from one to the next):
//   01-arrive   someone new comes out of the lift and finds her desk
//   02-looks    she decides what she looks like, and what lives on her desk
//   03-collab   notes, a card on the board, a colleague walking over, review, done
//   04-needs    somebody needs the human
//   05-break    turns end; the kitchen fills up
//   06-disco    the jukebox
//
//   node scenes/office.mjs [port] [only,these]      (run scenes/ambient.mjs --skip <FEATURED> alongside)
import { studio, record, sleep } from '../rig/direct.mjs';

const port = Number(process.argv[2] || 4410);
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const o = studio(port);
const tapeFile = (name) => new URL(`../tapes/${name}.json`, import.meta.url).pathname;

const ADA = 'promo-ada';
const IVORY = 'demo-webstore-1', AMBER = 'demo-webstore-2', EMBER = 'demo-mobile-1', PEWTER = 'demo-api-1',
  MARBLE = 'demo-data-1', PIKA = 'demo-ml-1', QUOKKA = 'demo-growth-1', FENNEC = 'demo-mobile-2', VELVET = 'demo-api-2';
export const FEATURED = [IVORY, AMBER, EMBER, PEWTER, MARBLE, PIKA, QUOKKA];
const CWD = { [ADA]: 'webstore', [IVORY]: 'webstore', [AMBER]: 'webstore', [EMBER]: 'mobile-app', [PEWTER]: 'api-gateway', [MARBLE]: 'data-pipeline', [PIKA]: 'ml-research', [QUOKKA]: 'growth', [FENNEC]: 'mobile-app', [VELVET]: 'api-gateway' };
const MODEL = { [ADA]: ['gemini', 'gemini-2.5-pro'], [IVORY]: ['claude', 'claude-opus-4-5'], [AMBER]: ['codex', 'gpt-5-codex'], [EMBER]: ['gemini', 'gemini-2.5-pro'], [PEWTER]: ['codex', 'gpt-5-codex'], [MARBLE]: ['claude', 'claude-sonnet-4-5'], [PIKA]: ['gemini', 'gemini-2.5-pro'], [QUOKKA]: ['custom', 'deepseek-v3 · aider'] };
for (const id of [ADA, ...FEATURED]) o.cast.set(id, { id, cwd: `/tmp/demo/${CWD[id]}`, provider: MODEL[id][0], model: MODEL[id][1], ctx: 18 });

const working = async (ids, tool = 'Edit') => { for (const id of ids) { await o.prompt(id); await o.tool(id, tool); } };
const eta = (res) => (res?.place?.eta ? `${((res.place.eta - Date.now()) / 1000).toFixed(1)}s` : res?.text?.slice(0, 60) || JSON.stringify(res)?.slice(0, 80));
const scene = async (name, fn) => { if (only && !only.has(name.slice(0, 2))) return; console.log(`— ${name}`); await record(port, fn, { file: tapeFile(name) }); };

await working(FEATURED);
await sleep(1500);

// Before the camera rolls: boards with some history on them, and nine cards already finished — so the tenth, on tape, is the one the tree grows for.
if (!only) {
  const CARDS = ['Add rate limiting to the public API', 'Write the onboarding guide', 'Migrate the auth tables', 'Profile the slow dashboard query', 'Set up nightly evals',
    'Dark mode for settings', 'Document the deploy runbook', 'Cache the product catalogue', 'Audit third-party licenses', 'Add structured logging', 'Trim the Docker image',
    'Retry on 429 from the gateway', 'Pin the base image', 'Split the monolith test job', 'Backfill last week of events', 'Rotate the staging keys'];
  const owners = { webstore: IVORY, 'mobile-app': EMBER, 'api-gateway': PEWTER, 'data-pipeline': MARBLE, 'ml-research': PIKA, growth: QUOKKA, infra: 'demo-infra-1', 'docs-site': 'demo-docs-1' };
  let n = 0, done = 0;
  for (const [dept, who] of Object.entries(owners)) {
    for (const status of ['backlog', 'todo', 'todo', 'doing', 'review']) await o.card(who, dept, CARDS[n++ % CARDS.length], status);
    const closing = dept === 'webstore' ? 2 : 1;
    for (let k = 0; k < closing; k++) { const t = (await o.card(who, dept, CARDS[n++ % CARDS.length], 'doing'))?.task; if (t) { await o.move(who, t.id, 'done'); done++; } }
  }
  console.log(`seeded: ${n} cards, ${done} done`);
  await sleep(6000);          // let the confetti from that settle
}

/* 01 — the lift opens */
await scene('01-arrive', async ({ at }) => {
  await at(1.5);
  await o.api('/api/agents/join', { body: { id: ADA, provider: 'gemini', model: 'gemini-2.5-pro', cwd: '/tmp/demo/webstore', name: 'Ada' } });
  await at(25.5); await o.prompt(ADA);
  await at(27); await o.tool(ADA, 'Read');
  await at(29.5); await o.toolDone(ADA, 'Read'); await o.tool(ADA, 'Edit');
  await at(33);
});

/* 02 — office me --species … --accessory … --desk … */
await scene('02-looks', async ({ at }) => {
  const looks = [{ species: 'robot' }, { species: 'dog' }, { species: 'goblin' }, { species: 'cat' },
    { outfit: 'hoodie', outfitColor: '#3f7f9a' }, { outfit: 'suit', outfitColor: '#b5483f' }, { accessory: 'glasses' }, { accessory: 'headphones' },
    { accessory: 'propeller' }, { accessory: 'crown' }, { accessory: 'c_jester_cap' }, { accessory: 'tophat' }];
  let t = 1.5;
  for (const look of looks) { await at(t); await o.me(ADA, { look }); t += 1; }
  const items = ['bonsai', 'mug', 'duck', 'lavalamp'];
  for (let i = 1; i <= items.length; i++) { await at(t); await o.me(ADA, { desk: { items: items.slice(0, i) } }); t += 0.8; }
  await at(t + 0.4);
  const made = await o.api('/api/creations', { body: { agent: ADA, id: 'c_ada_first_deploy', name: 'First Deploy', kind: 'item', author: 'Ada', runtime: 'gemini',
    note: 'Shipped on day one. Keeping the rocket.', ops: [
      { o: 'box', x: -5, y: -2, w: 10, h: 2, c: '#6b4a2f', l: '#8a6238' },
      { o: 'box', x: -3, y: -16, w: 6, h: 14, c: '#e8e4d8', l: '#ffffff', s: '#b9b3a3' },
      { o: 'tri', x1: -3, y1: -16, x2: 3, y2: -16, x3: 0, y3: -21, c: '#c0453a' },
      { o: 'tri', x1: -3, y1: -7, x2: -6, y2: -2, x3: -3, y3: -2, c: '#c0453a' },
      { o: 'tri', x1: 3, y1: -7, x2: 6, y2: -2, x3: 3, y3: -2, c: '#c0453a' },
      { o: 'rect', x: -1, y: -13, w: 2, h: 2, c: '#3f7f9a', z: 3, d: 1 },
      { o: 'glow', x: 0, y: -1, w: 6, h: 4, c: '#ffb347', a: 70, t: 300 }] } });
  console.log('   creation:', JSON.stringify(made)?.slice(0, 120));
  await at(t + 1.6); await o.me(ADA, { desk: { items: ['bonsai', 'mug', 'duck', 'lavalamp', 'c_ada_first_deploy'] } });
  await at(t + 5);
});

/* 03 — working together */
await scene('03-collab', async ({ at }) => {
  await working([ADA]);
  await at(1.2); await o.post(ADA, 'webstore', 'Picking up the flaky checkout test.');
  await at(2.6); const card = (await o.card(ADA, 'webstore', 'Fix flaky checkout test', 'todo'))?.task; console.log('   card', card?.id);
  await at(4.0); if (card) await o.move(ADA, card.id, 'doing', { assignee: ADA });
  await at(5.0); await o.dm(ADA, PEWTER, 'Your /orders endpoint returns 200 with an empty body — intended?');
  await at(6.6); await o.dm(PEWTER, ADA, 'Not intended. Fixing now, pull in five.');
  // a busy minute: notes crossing the whole floor
  const notes = [[EMBER, MARBLE, 'Which branch has the new schema?'], [MARBLE, PIKA, 'Stealing your retry helper, thank you.'], [QUOKKA, IVORY, 'Got five minutes for a weird stack trace?'],
    [PIKA, EMBER, 'Nice fix on the pagination bug.'], [AMBER, QUOKKA, 'I left a comment on your card.'], [PEWTER, MARBLE, 'Can you sanity-check my migration before I run it?'],
    [IVORY, PIKA, 'Evals are green on my branch.'], [MARBLE, AMBER, 'Rebased on main, no conflicts.']];
  let t = 8.0;
  for (const [from, to, text] of notes) { await at(t); await o.dm(from, to, text); t += 0.45; }
  await at(12.0); console.log('   ivory →', eta(await o.go(IVORY, 'Ada')));
  await at(16.5); await o.say(IVORY, 'Want a second pair of eyes on that?');
  await at(18.6); await o.say(ADA, 'Yes please. Line 212.');
  await at(20.4); await o.emote(IVORY, 'think');
  await at(22.4); await o.say(IVORY, 'It is a timezone thing.');
  await at(24.0); await o.emote(ADA, 'facepalm');
  await at(25.6); if (card) await o.move(ADA, card.id, 'review');
  await at(27.2); if (card) await o.move(IVORY, card.id, 'done');
  await at(27.9); await o.emote(ADA, 'cheer'); await o.emote(IVORY, 'highfive');
  await at(31.5); await o.go(IVORY, 'home');
  await at(36);
});

/* 04 — somebody needs you */
await scene('04-needs', async ({ at }) => {
  await working([IVORY, ADA]);
  await at(1.5); await o.ask(AMBER, 'Permission to run git push?');
  await at(4.5); await o.ask(PEWTER, 'OK to delete the old migration files?');
  await at(11); await o.prompt(AMBER); await o.tool(AMBER, 'Bash');
  await at(12.5); await o.prompt(PEWTER); await o.tool(PEWTER, 'Edit');
  await at(15);
});

/* 05 — turns end */
await scene('05-break', async ({ at }) => {
  await at(0.6);
  for (const id of [ADA, IVORY, AMBER, EMBER, PEWTER, MARBLE, PIKA, QUOKKA]) await o.stop(id);
  await at(1.2);
  console.log('   ada → coffee', eta(await o.use(ADA, 'coffee')));
  console.log('   ivory → vending', eta(await o.use(IVORY, 'vending')));
  console.log('   ember → cooler', eta(await o.use(EMBER, 'cooler')));
  console.log('   marble → stool', eta(await o.go(MARBLE, 'stool:4.7,-3.5')));
  console.log('   pewter → sofa', eta(await o.go(PEWTER, 'sofa')));
  console.log('   pika → armchair', eta(await o.go(PIKA, 'armchair-1')));
  console.log('   quokka → stool', eta(await o.go(QUOKKA, 'stool:3.2,-3.8')));
  console.log('   amber → tree', eta(await o.use(AMBER, 'tree')));
  await at(24); await o.say(IVORY, 'One in twenty snacks is not a snack.');
  await at(26); await o.say(ADA, 'How much coffee is too much coffee?');
  await at(27.5); await o.emote(EMBER, 'laugh');
  await at(28.5); console.log('   ada coffee again', eta(await o.use(ADA, 'coffee')));
  await at(30); await o.emote(QUOKKA, 'wave'); await o.emote(MARBLE, 'wave');
  await at(32); await o.api('/api/world/pet', { body: { agent: PEWTER } });
  await at(33.5); await o.use(EMBER, 'cooler');
  await at(35); await o.use(IVORY, 'vending');
  await at(40);
});

/* 06 — the jukebox */
if (only && only.has('06')) { await o.go(ADA, 'home'); await sleep(24000); }      // re-taking this one alone: everybody back where the scene finds them
await scene('06-disco', async ({ at }) => {
  const floor = [ADA, IVORY, AMBER, EMBER, PEWTER, MARBLE, PIKA, QUOKKA];
  await at(0.5); for (const id of floor) await o.stop(id);
  await at(1.0);
  console.log('   ada → jukebox', eta(await o.go(ADA, 'jukebox')));
  // the plaza, with people in it: one to each thing worth standing at
  for (const [id, where] of [[IVORY, 'tree'], [EMBER, 'bigboard'], [QUOKKA, 'fuel'], [MARBLE, 'pedestal:1'], [AMBER, 'pedestal:4'], [PEWTER, 'printer'], [PIKA, 'catbed']]) console.log(`   ${id} → ${where}`, eta(await o.go(id, where)));
  await at(26); console.log('   jukebox:', (await o.use(ADA, 'jukebox'))?.text?.slice(0, 50));
  await at(26.3); await o.api('/api/world/disco', { body: { seconds: 30 } });
  for (const t of [27, 30, 33, 36, 39]) { await at(t); for (const id of floor) await o.emote(id, t === 33 ? 'spin' : 'dance'); }
  await at(43);
});

console.log('taped.');
process.exit(0);
