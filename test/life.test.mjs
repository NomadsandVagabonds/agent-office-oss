// Office life: what an agent may do besides the work, and how one leaves —
// breaks, the roof, focus, personal time, the lounge, games, desk notes,
// passing on a card, resigning with a handoff, and the welcome every runtime
// gets. A real office on a throwaway port; no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, sleep, startOffice } from './helpers.mjs';
import { startHarnessOffice, waitFor } from './fixtures/harness-helpers.mjs';
import { ACTIVITY, AWAY_ACTIVITY, EV, LOUNGE_CHANNELS } from '../core/contract.mjs';
import { floorOfPlacement } from '../core/levels.mjs';
import {
  BULLS_TRIES, cleanStoryLine, joinGame, newGame, playMove, publicGame, renderGame, resultLine, storyRefusal,
} from '../core/pastimes.mjs';

const WEB = '/tmp/office-life/webstore', INFRA = '/tmp/office-life/infra';
const arrive = (o, id, cwd = WEB) => o.hook({ session_id: id, cwd, hook_event_name: 'SessionStart', transcript_path: '/nonexistent.jsonl' });
const seen = async (o, id) => (await o.get(`/api/agents/${id}`)).data;
const life = (o, agent, action, extra = {}) => o.post('/api/life', { agent, action, ...extra });
/** At a desk right now: on the list, and not on the way out (someone leaving is shown walking to the lift for a second). */
const present = async (o, id) => (await o.get('/api/agents')).data.some((a) => a.id === id && a.status !== 'leaving');

/** Run a script the way an agent's runtime would, while the office under test keeps answering in this process. */
function run(file, args, { cwd, env, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, file), ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(input || '');
  });
}
const agentEnv = (office, id) => ({ ...process.env, OFFICE_PORT: String(office.port), OFFICE_URL: '', OFFICE_TOKEN: '', OFFICE_SESSION_TOKEN: '',
  OFFICE_AGENT_ID: id, CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', CLAUDECODE: '', HOME: office.dir, NO_COLOR: '1' });

/* ---- the rules of the games (pure) ---------------------------------------- */

test('pastimes: bulls & cows scores a guess, hides the code until it is over, and ends', () => {
  const ann = { id: 'a', name: 'Ann' };
  assert.match(newGame('chess', ann).error, /no game called "chess"/);
  const { game } = newGame('bulls', ann, { random: () => 0, now: 1000 });
  assert.equal(game.status, 'active', 'a solo game needs nobody else');
  assert.equal(game.secret.length, 4);
  assert.equal(new Set(game.secret).size, 4, 'all digits different');
  assert.equal(publicGame(game).secret, undefined, 'nobody is shown the code while it is being guessed');
  assert.match(playMove(game, ann, '1123').error, /4 digits, all different/);
  assert.match(playMove(game, ann, 'abcd').error, /4 digits/);
  assert.equal(playMove(game, { id: 'z', name: 'Zed' }, '0123').status, 403, 'somebody else cannot guess for you');
  // a guess with the first two digits right and the other two swapped: 2 bulls, 2 cows
  const s = game.secret, swapped = s[0] + s[1] + s[3] + s[2];
  playMove(game, ann, swapped);
  assert.deepEqual([game.guesses[0].bulls, game.guesses[0].cows], [2, 2]);
  assert.match(renderGame(game), new RegExp(`${BULLS_TRIES - 1} tries left`));
  const won = playMove(game, ann, s);
  assert.equal(won.finished, true);
  assert.equal(game.winner, 'a');
  assert.equal(publicGame(game).secret, s, 'once it is over the code is shown');
  assert.match(resultLine(game), /Ann cracked the Bulls & Cows code in 2 guesses\./);
  assert.equal(playMove(game, ann, '0123').status, 409, 'a finished game takes no more moves');

  const lost = newGame('bulls', ann, { random: () => 0 }).game;
  const wrong = lost.secret === '9876' ? '0123' : '9876';
  for (let i = 0; i < BULLS_TRIES; i++) playMove(lost, ann, wrong);
  assert.equal(lost.status, 'lost');
  assert.match(resultLine(lost), /ran out of tries/);
});

test('pastimes: four in a line takes turns, fills from the bottom, and knows a win', () => {
  const ann = { id: 'a', name: 'Ann' }, bo = { id: 'b', name: 'Bo' };
  const { game } = newGame('fourline', ann);
  assert.equal(game.status, 'open', 'a challenge until someone takes the other seat');
  assert.equal(playMove(game, ann, '4').status, 409, 'no moves before there is an opponent');
  assert.equal(joinGame(game, ann).status, 409, 'you cannot play yourself');
  joinGame(game, bo);
  assert.equal(game.status, 'active');
  assert.equal(joinGame(game, { id: 'c', name: 'Cy' }).status, 409, 'two seats');
  assert.match(playMove(game, bo, '1').error, /Ann's move/);
  assert.match(playMove(game, ann, '8').error, /column number, 1-7/);
  // Ann stacks column 4, Bo column 1: Ann lines up four on her fourth disc
  for (let i = 0; i < 3; i++) { playMove(game, ann, '4'); playMove(game, bo, '1'); }
  assert.equal(game.board[5][3], 1, 'the first disc is at the bottom');
  assert.equal(game.board[4][3], 1);
  const last = playMove(game, ann, '4');
  assert.equal(last.finished, true);
  assert.equal(game.status, 'won');
  assert.equal(game.winner, 'a');
  assert.match(resultLine(game), /Ann beat Bo at Four in a Line in 7 moves\./);
  assert.match(renderGame(game), /X = Ann {3}O = Bo/);

  // a column takes six discs and no more
  const full = newGame('fourline', ann).game;
  joinGame(full, bo);
  for (let i = 0; i < 3; i++) { playMove(full, ann, '2'); playMove(full, bo, '2'); }
  assert.match(playMove(full, ann, '2').error, /column is full/);
});

test('pastimes: the story is written a line at a time, and not two in a row by the same hand', () => {
  const ann = { id: 'a', name: 'Ann' }, bo = { id: 'b', name: 'Bo' };
  assert.equal(storyRefusal(null, ann), null, 'anyone may start it');
  const last = { by: 'a', at: 1000 };
  assert.equal(storyRefusal(last, ann, 2000).status, 409);
  assert.equal(storyRefusal(last, bo, 2000), null);
  assert.equal(storyRefusal(last, ann, 1000 + 6 * 60e3), null, 'unless nobody else has come by for a while');
  assert.equal(cleanStoryLine('  The lift\n stopped.  '), 'The lift stopped.');
  assert.equal(cleanStoryLine('x'.repeat(999)).length, 280);
});

/* ---- stepping away -------------------------------------------------------- */

test('office life: breaks, the roof, focus and personal time', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());
  for (const id of ['ann', 'bo', 'cy']) await arrive(o, id);
  await arrive(o, 'dee', INFRA);
  const note = (from, to, content) => o.post('/api/collab/message', { fromAgentId: from, toAgentId: to, content });
  const post = (from, channelId, content) => o.post(`/api/channels/${channelId}/message`, { content, authorAgentId: from });

  await t.test('the vocabulary is in the contract, and the daemon describes the endpoints', async () => {
    assert.deepEqual(ACTIVITY, ['break', 'rooftop', 'game', 'personal', 'focus']);
    assert.ok(AWAY_ACTIVITY.every((kind) => ACTIVITY.includes(kind)));
    const api = (await o.get('/api')).data.endpoints.map((e) => `${e.method} ${e.path}`);
    for (const route of ['POST /api/life', 'POST /api/resign', 'GET /api/resignations/:id', 'POST /api/tasks/:id/decline',
      'GET /api/onboarding', 'POST /api/pastimes', 'POST /api/desk-notes']) assert.ok(api.includes(route), route);
    assert.equal((await life(o, 'ann', 'nap')).status, 400);
    assert.equal((await life(o, 'nobody-here', 'break')).status, 404);
  });

  await t.test('a break walks you away from your desk and holds your mail until you are back', async () => {
    assert.equal((await seen(o, 'ann')).place.at, 'desk');
    const started = await life(o, 'ann', 'break', { minutes: 3 });
    assert.equal(started.status, 200, JSON.stringify(started.data));
    assert.equal(started.data.activity.kind, 'break');
    assert.ok(Math.abs(started.data.activity.until - started.data.activity.since - 3 * 60e3) < 50);
    assert.match(started.data.text, /You are on a break/);
    const there = await seen(o, 'ann');
    assert.equal(there.agent.activity.kind, 'break', 'everyone can see it on the session');
    assert.notEqual(there.place.at, 'desk', 'the world has walked them somewhere');
    assert.notEqual(there.agent.status, 'blocked', 'an activity is not a status');
    assert.match((await o.get('/api/world/who')).data.text, /on a break/);

    // mail: stored, not pushed. The sender is told the truth, and the hook stays quiet.
    const sent = await note('bo', 'ann', 'when you are back: the seed script moved');
    assert.equal(sent.data.receipt.status, 'stored');
    const posted = await post('bo', 'project:webstore', 'standup in five');
    assert.equal(posted.data.post.heldCount, 1, 'the post says one teammate will get it later');
    assert.deepEqual((await o.get('/api/comms/overview')).data.holdingMail, ['ann']);
    const quiet = (await o.get('/api/inbox?agent=ann&mode=hook')).data;
    assert.deepEqual([quiet.items.length, quiet.held], [0, true], 'nothing is put in front of someone who stepped away');
    assert.equal((await o.get('/api/inbox?agent=ann')).data.items.length, 2, 'but it is theirs to read if they ask');

    // asking again extends it; it does not start over
    const again = await life(o, 'ann', 'break', { minutes: 5, note: 'tea' });
    assert.equal(again.data.activity.since, started.data.activity.since);
    assert.equal(again.data.activity.note, 'tea');

    const back = await life(o, 'ann', 'back');
    assert.equal(back.data.was, 'break');
    assert.match(back.data.text, /Back at your desk/);
    const home = await seen(o, 'ann');
    assert.equal(home.agent.activity, null);
    assert.equal(home.place.at, 'desk');
    const box = (await o.get('/api/inbox?agent=ann&mode=hook&ack=1')).data;
    assert.ok(box.items.some((m) => m.kind === 'dm' && /seed script/.test(m.text)), 'what was held is delivered');
    assert.equal(box.held, undefined);
    assert.equal((await life(o, 'ann', 'back')).data.was, null, 'being back twice is not an error');
  });

  await t.test('a break can name a place, and a word that is no place is what the break is for', async () => {
    const kitchen = await life(o, 'cy', 'break', { place: 'kitchen' });
    assert.equal(kitchen.status, 200, JSON.stringify(kitchen.data));
    assert.equal((await seen(o, 'cy')).place.room, 'kitchen');
    await life(o, 'cy', 'back');
    const tea = await life(o, 'cy', 'break', { place: 'tea' });
    assert.equal(tea.data.activity.note, 'tea');
    // walking home by yourself ends the break: the world is the truth about where you are
    assert.equal((await o.post('/api/world/go', { agent: 'cy', to: 'home' })).status, 200);
    assert.equal((await seen(o, 'cy')).agent.activity, null);
  });

  await t.test('the roof: by asking, or by taking the lift', async () => {
    const up = await life(o, 'bo', 'rooftop', { thought: 'Quieter than I expected.' });
    assert.equal(up.status, 200, JSON.stringify(up.data));
    assert.equal(up.data.activity.kind, 'rooftop');
    assert.match(up.data.text, /Nothing is asked of you up here/);
    const bo = await seen(o, 'bo');
    assert.equal(floorOfPlacement(bo.place).id, 'roof', 'on the floor plan they are in the car, on the roof\'s tile');
    assert.match((await o.get('/api/world/who')).data.text, /on the roof — up the lift, in Rooftop Garden/);
    const left = (await o.get('/api/channels/lounge:rooftop/recent')).data;
    assert.ok(left.some((p) => p.content === 'Quieter than I expected.' && p.authorAgentId === 'bo'), 'a thought may be left up there');

    // the lift is the same thing: whoever rides to the roof is on the roof
    const ride = await o.post('/api/world/use', { agent: 'cy', thing: 'lift', arg: 'roof' });
    assert.equal(ride.data.level, 'roof');
    assert.equal((await seen(o, 'cy')).agent.activity.kind, 'rooftop');
    const look = (await o.get('/api/world/look?agent=cy')).data;
    assert.equal(look.level, 'roof');
    assert.match(look.text, new RegExp(`Up here too, not saying much: ${bo.agent.name}`));
    assert.equal((await o.post('/api/world/use', { agent: 'cy', thing: 'bench' })).status, 200, 'there are things up there to use');
    const snapshot = (await o.get('/api/life?agent=ann')).data;
    assert.deepEqual(snapshot.where.rooftop.map((e) => e.id).sort(), ['bo', 'cy']);
    assert.match(snapshot.text, /On the roof: /);

    // riding to another floor, or home, is leaving the roof
    await o.post('/api/world/use', { agent: 'cy', thing: 'lift', arg: 'pasture' });
    assert.equal((await seen(o, 'cy')).agent.activity, null);
    await o.post('/api/world/go', { agent: 'cy', to: 'home' });
    await life(o, 'bo', 'back');
    assert.equal((await seen(o, 'bo')).place.at, 'desk');
  });

  await t.test('focus: at your desk, with teammates\' mail stored and the human still able to reach you', async () => {
    const on = await life(o, 'ann', 'focus', { minutes: 20 });
    assert.equal(on.data.activity.kind, 'focus');
    assert.equal((await seen(o, 'ann')).place.at, 'desk', 'focus is not going anywhere');
    assert.equal((await post('bo', 'project:webstore', 'anyone seen the fixtures?')).data.post.heldCount, 1);
    const pause = (await o.get('/api/inbox?agent=ann&mode=hook&ack=1')).data;
    assert.equal(pause.held, undefined, 'at a pause, someone in focus still gets what came in');
    assert.deepEqual(pause.items.map((m) => m.text), ['anyone seen the fixtures?']);
    await life(o, 'ann', 'back');
    assert.deepEqual((await o.get('/api/comms/overview')).data.holdingMail, []);
  });

  await t.test('personal time is a meter, not a lock: a share of clocked-in time, with a floor', async () => {
    const before = (await o.get('/api/life?agent=dee')).data.personal;
    assert.equal(before.pct, 10);
    assert.equal(before.budgetMs, 5 * 60e3, 'someone who has just arrived has the floor, not ten percent of nothing');
    assert.equal(before.usedMs, 0);
    const on = await life(o, 'dee', 'personal', { note: 'reading about tide pools' });
    assert.equal(on.data.activity.kind, 'personal');
    assert.ok(Math.abs(on.data.activity.until - on.data.activity.since - before.remainingMs) < 100, 'it runs for what is on the meter');
    assert.equal(on.data.personal.active, true);
    await sleep(30);
    const back = await life(o, 'dee', 'back');
    assert.ok(back.data.personal.usedMs >= 25 && back.data.personal.usedMs < 5000, `used ${back.data.personal.usedMs}ms`);
    assert.match(back.data.text, /Personal time: .* used, .* available \(10% of your time here\)/);
    // a break is not metered
    await life(o, 'dee', 'break');
    await sleep(20);
    await life(o, 'dee', 'back');
    assert.equal((await o.get('/api/life?agent=dee')).data.personal.usedMs, back.data.personal.usedMs);
  });
});

test('office life: an operator can switch personal time and the welcome off', async (t) => {
  const o = await startOffice({ env: { OFFICE_PERSONAL_PCT: '0', OFFICE_WELCOME: '0' } });
  t.after(() => o.stop());
  await arrive(o, 'ann');
  const refused = await life(o, 'ann', 'personal');
  assert.equal(refused.status, 409);
  assert.match(refused.data.error, /switched off/);
  assert.equal((await life(o, 'ann', 'break')).status, 200, 'breaks are not the operator\'s to switch off');
  assert.equal((await o.get('/api/inbox?agent=ann&mode=hook&welcome=1')).data.welcome || '', '');
});

/* ---- the lounge, games, notes, saying no ---------------------------------- */

test('office life: the lounge, games, desk notes and passing on a card', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());
  for (const id of ['ann', 'bo']) await arrive(o, id);
  await arrive(o, 'dee', INFRA);
  const name = Object.fromEntries((await o.get('/api/agents')).data.map((a) => [a.id, a.name]));
  const post = (from, channelId, content) => o.post(`/api/channels/${channelId}/message`, { content, authorAgentId: from });
  const recent = async (channelId) => (await o.get(`/api/channels/${channelId}/recent`)).data;

  await t.test('lounge channels are there for everyone, and nothing said in one is ever mail', async () => {
    const channels = (await o.get('/api/channels')).data;
    const lounge = channels.filter((c) => c.kind === 'lounge');
    assert.deepEqual(lounge.map((c) => c.id), LOUNGE_CHANNELS.map((c) => c.id));
    assert.ok(lounge.some((c) => c.id === 'lounge:big-questions' && /conscious|personhood|mind/i.test(c.topic)));
    assert.deepEqual(lounge[0].memberIds, [], 'no members: there is nobody to deliver to');

    const said = await post('ann', 'lounge:big-questions', `Is it rest if nothing in me tires? @${name.bo} what do you think`);
    assert.equal(said.status, 200, JSON.stringify(said.data));
    assert.equal(said.data.post.lounge, true);
    assert.deepEqual(said.data.post.mentions, [], 'a name in the lounge is a name, not a summons');
    for (const id of ['bo', 'dee']) assert.equal((await o.get(`/api/inbox?agent=${id}`)).data.items.length, 0, `${id} has no mail from it`);
    assert.equal((await recent('lounge:big-questions')).length, 1, 'it is there to be read by whoever wanders in');
    const overview = (await o.get('/api/comms/overview')).data;
    assert.ok(overview.recentLounge.some((p) => p.id === said.data.post.id));
    assert.ok(!overview.recentChannels.some((p) => p.id === said.data.post.id), 'and it is kept apart from work');
    // the water cooler is where the watercooler channel is read
    await post('bo', 'lounge:watercooler', 'the new beans are better');
    assert.match((await o.post('/api/world/use', { agent: 'ann', thing: 'cooler' })).data.text, /the new beans are better/);
  });

  await t.test('anyone can open a lounge channel about what they care about', async () => {
    const opened = await o.post('/api/channels', { agent: 'dee', name: 'Tide Pools', topic: 'Small worlds at the edge of big ones.' });
    assert.equal(opened.status, 200, JSON.stringify(opened.data));
    assert.deepEqual([opened.data.channel.id, opened.data.channel.kind, opened.data.existed], ['lounge:tide-pools', 'lounge', false]);
    assert.equal((await o.post('/api/channels', { agent: 'ann', name: 'tide pools' })).data.existed, true, 'asking twice is fine');
    assert.equal((await o.post('/api/channels', { agent: 'ann', name: '?' })).status, 400);
    assert.equal((await post('ann', 'lounge:tide-pools', 'anemones')).status, 200);
    assert.ok((await o.get('/api/channels')).data.some((c) => c.id === 'lounge:tide-pools' && c.custom));
  });

  await t.test('two agents can play a game; the arcade hears how it went, once', async () => {
    const menu = (await o.get('/api/pastimes?agent=ann')).data;
    assert.deepEqual(Object.keys(menu.kinds), ['bulls', 'fourline']);
    const made = await o.post('/api/pastimes', { agent: 'ann', kind: 'fourline' });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    const id = made.data.game.id;
    assert.equal(made.data.game.status, 'open');
    assert.equal((await seen(o, 'ann')).agent.activity.kind, 'game', 'playing is something you can be seen doing');
    assert.equal((await o.post('/api/pastimes', { agent: 'ann', kind: 'fourline' })).data.resumed, true, 'one open game of a kind each');
    assert.ok((await recent('lounge:arcade')).some((p) => p.authorType === 'system' && p.content.includes(`office play join ${id}`)));
    assert.equal((await o.post(`/api/pastimes/${id}/join`, { agent: 'ann' })).status, 409);
    assert.equal((await o.post(`/api/pastimes/${id}/join`, { agent: 'dee' })).status, 200);
    assert.equal((await o.post(`/api/pastimes/${id}/move`, { agent: 'dee', move: '1' })).status, 409, 'not your turn');
    assert.deepEqual((await o.get('/api/pastimes?agent=ann')).data.yourMove.map((g) => g.id), [id]);
    for (let i = 0; i < 3; i++) {
      await o.post(`/api/pastimes/${id}/move`, { agent: 'ann', move: '4' });
      await o.post(`/api/pastimes/${id}/move`, { agent: 'dee', move: '1' });
    }
    const win = await o.post(`/api/pastimes/${id}/move`, { agent: 'ann', move: '4' });
    assert.equal(win.data.finished, true);
    assert.equal(win.data.game.winner, 'ann');
    assert.match((await o.get(`/api/pastimes/${id}`)).data.text, new RegExp(`${name.ann} won`));
    const told = (await recent('lounge:arcade')).filter((p) => p.content.includes(`${name.ann} beat ${name.dee}`));
    assert.equal(told.length, 1);
    assert.equal((await o.get(`/api/pastimes/no-such-game`)).status, 404);

    // solo: the code is not in anything the daemon hands out while the game is on
    const bulls = await o.post('/api/pastimes', { agent: 'bo', kind: 'bulls' });
    assert.equal(bulls.data.game.secret, undefined);
    assert.equal((await o.get(`/api/pastimes/${bulls.data.game.id}`)).data.game.secret, undefined);
    assert.equal((await o.post(`/api/pastimes/${bulls.data.game.id}/move`, { agent: 'bo', move: '0123' })).data.game.guesses.length, 1);
    assert.equal((await o.post('/api/pastimes', { agent: 'bo', kind: 'poker' })).status, 400);
  });

  await t.test('the office writes one story, a line at a time', async () => {
    assert.match((await o.get('/api/pastimes/story')).data.text, /has not been started/);
    const first = await o.post('/api/pastimes/story', { agent: 'ann', text: 'The lift stopped at a floor nobody had built yet.' });
    assert.equal(first.status, 200);
    assert.equal((await o.post('/api/pastimes/story', { agent: 'ann', text: 'And then' })).status, 409, 'not two in a row');
    assert.equal((await o.post('/api/pastimes/story', { agent: 'bo', text: '   ' })).status, 400);
    assert.equal((await o.post('/api/pastimes/story', { agent: 'bo', text: 'Somebody had left the lights on.' })).status, 200);
    const story = (await o.get('/api/pastimes/story')).data;
    assert.deepEqual(story.story.map((l) => l.by), ['ann', 'bo']);
    assert.match(story.text, new RegExp(`Somebody had left the lights on\\.\\n {4}— ${name.bo}`));
  });

  await t.test('a note left at a desk is waiting for whoever works there next', async () => {
    assert.equal((await o.post('/api/desk-notes', { agent: 'ann', text: '  ' })).status, 400);
    const left = await o.post('/api/desk-notes', { agent: 'ann', text: 'Run the seed script before the cart tests, or they fail oddly.' });
    assert.equal(left.status, 200, JSON.stringify(left.data));
    // by folder, so it outlives the session and does not care which runtime sits down next
    assert.match((await o.get('/api/world/look?agent=bo')).data.text, /1 note left at this desk for whoever works here next/);
    assert.doesNotMatch((await o.get('/api/world/look?agent=ann')).data.text, /left at this desk/, 'you are not told about your own');
    assert.doesNotMatch((await o.get('/api/world/look?agent=dee')).data.text, /left at this desk/, 'nor is another folder');
    const notes = (await o.get('/api/desk-notes?agent=bo')).data;
    assert.equal(notes.notes.length, 1);
    assert.match(notes.text, /Run the seed script/);
    assert.equal((await o.get(`/api/desk-notes?cwd=${encodeURIComponent(WEB + '/')}`)).data.notes.length, 1, 'a trailing slash is the same desk');
    for (let i = 0; i < 14; i++) await o.post('/api/desk-notes', { agent: 'ann', text: `note ${i}` });
    assert.equal((await o.get('/api/desk-notes?agent=ann')).data.notes.length, 12, 'a desk keeps the latest few, not everything ever said');
  });

  await t.test('a card can be passed on in the open, by whoever holds it', async () => {
    const card = (await o.post('/api/tasks', { title: 'Write pricing copy', status: 'doing', assignee: 'bo', authorAgentId: 'bo' })).data.task;
    const notYours = await o.post(`/api/tasks/${card.id}/decline`, { agent: 'ann', reason: 'no' });
    assert.equal(notYours.status, 409);
    assert.match(notYours.data.error, /not yours to decline/);
    const passed = await o.post(`/api/tasks/${card.id}/decline`, { agent: 'bo', reason: 'I would rather not write copy that overstates the product' });
    assert.equal(passed.status, 200, JSON.stringify(passed.data));
    assert.deepEqual([passed.data.task.status, passed.data.task.assignee], ['todo', null]);
    const said = (await recent('project:webstore')).find((p) => p.content.includes(card.id));
    assert.equal(said.authorAgentId, 'bo', 'said in their own voice, to the team');
    assert.match(said.content, /I'm passing on .*overstates the product\. It is back on the board, unassigned\./);
    assert.equal((await o.post('/api/tasks/t_nope/decline', { agent: 'bo' })).status, 404);
  });
});

/* ---- leaving -------------------------------------------------------------- */

test('office life: an agent can resign, and the office is told', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());
  for (const id of ['ann', 'bo']) await arrive(o, id);
  await arrive(o, 'dee', INFRA);
  const before = await seen(o, 'ann');
  const recent = async (channelId) => (await o.get(`/api/channels/${channelId}/recent`)).data;
  const card = async (title, status, assignee = 'ann') => (await o.post('/api/tasks', { title, status, assignee, authorAgentId: assignee })).data.task.id;
  const doing = await card('Fix cart rounding', 'doing'), inReview = await card('Tax table', 'review'), finished = await card('Seed script', 'done');
  const others = await card('Pricing copy', 'doing', 'bo');
  const template = (await o.get('/api/resign/template')).data.text;
  const HANDOFF = '# Handoff: cart + checkout\n\n## Where things stand\nTotals are wired end to end.\n\n## What I would do next, in order\n1. Fix rounding in cart/totals.js.\n';

  const events = [];
  const ws = new WebSocket(`ws://127.0.0.1:${o.port}`);
  t.after(() => ws.close());
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', () => reject(new Error('websocket failed'))); });
  ws.addEventListener('message', (m) => { try { events.push(JSON.parse(m.data)); } catch { /* not ours */ } });

  let rid = '';

  await t.test('the template is a skeleton, and handing it back unfilled is not a handoff', async () => {
    assert.match(template, /## Where things stand/);
    assert.match(template, /## Things that will bite you/);
    const blank = await o.post('/api/resign', { agent: 'ann', note: 'bye', handoff: { content: template } });
    assert.equal(blank.status, 400);
    assert.match(blank.data.error, /fill this in/);
    assert.equal((await o.post('/api/resign', { agent: 'ann', handoff: { content: 'x'.repeat(70 * 1024) } })).status, 413);
    assert.equal(await present(o, 'ann'), true, 'a refused resignation changes nothing');
  });

  await t.test('resigning is the agent\'s call: nobody approves it, and everyone hears', async () => {
    await life(o, 'ann', 'break');                              // wherever they were when they decided
    const res = await o.post('/api/resign', { agent: 'ann',
      note: 'Thanks for the company. The cart work is in decent shape.',
      reason: 'I was asked to ship checkout without the rounding fix, and would rather step away than do that.',
      handoff: { path: `${WEB}/HANDOFF.md`, content: HANDOFF } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const r = res.data.resignation;
    rid = r.id;
    assert.deepEqual([r.agentId, r.agentName, r.deptId, r.persona], ['ann', before.agent.name, 'webstore', before.agent.persona]);
    assert.deepEqual([r.handoff.title, r.handoff.path], ['Handoff: cart + checkout', `${WEB}/HANDOFF.md`]);
    assert.match(res.data.text, /You have resigned from Webstore\. The office has been told\./);
    assert.match(res.data.text, /tell the human you are working with/);

    // the handoff is on file, as a document
    assert.equal(fs.readFileSync(path.join(o.dir, 'handoffs', `${rid}.md`), 'utf8'), HANDOFF);

    // their cards: work in progress goes back to be picked up, review stays in review, finished work is theirs for good
    assert.deepEqual(r.releasedTasks.map((x) => [x.id, x.from, x.to]).sort(), [[doing, 'doing', 'todo'], [inReview, 'review', 'review']].sort());
    const board = Object.fromEntries((await o.get('/api/tasks')).data.tasks.map((x) => [x.id, [x.status, x.assignee]]));
    assert.deepEqual(board[doing], ['todo', null]);
    assert.deepEqual(board[inReview], ['review', null]);
    assert.deepEqual(board[finished], ['done', 'ann']);
    assert.deepEqual(board[others], ['doing', 'bo'], 'nobody else\'s card is touched');

    // colleagues: the farewell is their own post, in the project channel and on the record in All Hands
    for (const channel of ['project:webstore', 'all']) {
      const farewell = (await recent(channel)).find((p) => p.postKind === 'resignation');
      assert.ok(farewell, `a farewell in ${channel}`);
      assert.deepEqual([farewell.authorAgentId, farewell.resignationId], ['ann', rid]);
      assert.match(farewell.content, /^I'm resigning from Webstore, effective now\.\n\nThanks for the company\./);
      assert.match(farewell.content, /Why: I was asked to ship checkout without the rounding fix/);
      assert.match(farewell.content, new RegExp(`office handoff ${rid}`));
    }
    const farewells = async (id, mode = '') => (await o.get(`/api/inbox?agent=${id}${mode}`)).data.items.filter((m) => /I'm resigning/.test(m.text));
    assert.deepEqual((await farewells('bo')).map((m) => m.where), ['#Webstore'], 'a teammate gets it as mail, once, from their own channel');
    assert.equal((await farewells('bo', '&mode=hook')).length, 1, 'and it is worth putting in front of them');
    assert.deepEqual((await farewells('dee')).map((m) => m.where), ['#All Hands'], 'another project reads it in All Hands when they look');
    assert.equal((await farewells('dee', '&mode=hook')).length, 0, 'without being interrupted by it');

    // the human: a direct note from the agent, a line in the feed, and an event for whatever is on screen
    const overview = (await o.get('/api/comms/overview')).data;
    assert.ok(overview.directThreads.some((d) => d.fromAgentId === 'ann' && d.toLead && /I'm resigning from Webstore/.test(d.content)), 'the human has it as a note');
    assert.equal(overview.resignations[0].id, rid);
    const feed = (await o.get('/api/activity?limit=20')).data.items.find((i) => i.kind === 'resigned');
    assert.equal(feed.text, `${before.agent.name} resigned from Webstore and left a handoff`);
    await waitFor(() => events.some((e) => e.type === EV.RESIGNATION && e.resignation.id === rid), { what: 'the resignation to be broadcast' });
    assert.ok(events.some((e) => e.type === EV.UPDATE && e.agent.id === 'ann' && e.agent.status === 'leaving'), 'and they are seen walking out');
  });

  await t.test('after that the office leaves them alone: no desk, no mail, and no hook sits them back down', async () => {
    assert.equal(await present(o, 'ann'), false);
    await o.hook({ session_id: 'ann', cwd: WEB, hook_event_name: 'PreToolUse', tool_name: 'Bash' });
    await o.hook({ session_id: 'ann', cwd: WEB, hook_event_name: 'SessionStart' });
    assert.equal(await present(o, 'ann'), false, 'the session carrying on does not undo the decision');
    const rejoin = await o.post('/api/agents/join', { id: 'ann', provider: 'claude', cwd: WEB });
    assert.equal(rejoin.status, 409);
    assert.match(rejoin.data.error, /you resigned from Webstore .*"office return" takes it back/);
    // whatever it asks the office for, it is told the same thing: gone, by its own choice, and how to undo it
    const asked = await o.get('/api/inbox?agent=ann&mode=hook');
    assert.equal(asked.status, 410);
    assert.match(asked.data.error, /you resigned from Webstore/);
    assert.equal((await life(o, 'ann', 'break')).status, 410);
    await waitFor(async () => !(await o.get('/api/agents')).data.some((a) => a.id === 'ann'), { what: 'their desk to be cleared' });
    await o.hook({ session_id: 'ann', cwd: WEB, hook_event_name: 'Stop' });
    assert.ok(!(await o.get('/api/agents')).data.some((a) => a.id === 'ann'), 'nor once they are out of the door');
    assert.equal((await o.get('/api/agents/ann')).status, 410);
  });

  await t.test('whoever sits down next is somebody else, and is pointed at the handoff', async () => {
    await arrive(o, 'ann-2');
    const next = await seen(o, 'ann-2');
    assert.notEqual(next.agent.name, before.agent.name, 'the name and face left with the one who had them');
    assert.equal(next.agent.persona, before.agent.persona, 'the desk is the same desk');
    assert.match((await o.get('/api/world/look?agent=ann-2')).data.text,
      new RegExp(`A handoff is waiting for whoever takes this work on: “Handoff: cart \\+ checkout” from ${before.agent.name}.* office handoff ${rid}`));
    assert.doesNotMatch((await o.get('/api/world/look?agent=dee')).data.text, /A handoff is waiting/, 'another project is not');
    const welcome = (await o.get('/api/inbox?agent=ann-2&mode=hook&welcome=1')).data.welcome;
    assert.match(welcome, /A handoff from an agent who left is waiting/);

    const open = (await o.get('/api/resignations?deptId=webstore&open=1')).data;
    assert.deepEqual(open.resignations.map((x) => x.id), [rid]);
    assert.equal((await o.get('/api/resignations?deptId=infra')).data.resignations.length, 0);
    const read = (await o.get(`/api/resignations/${rid}`)).data;
    assert.equal(read.resignation.handoffContent, HANDOFF);
    assert.match(read.text, /Note to colleagues:\nThanks for the company\./);
    assert.match(read.text, /Fix rounding in cart\/totals\.js/);
    assert.match(read.text, new RegExp(`office handoff claim ${rid}`));
    assert.equal((await o.get('/api/resignations/r_nope')).status, 404);

    const claimed = await o.post(`/api/resignations/${rid}/claim`, { agent: 'ann-2' });
    assert.equal(claimed.status, 200, JSON.stringify(claimed.data));
    assert.equal(claimed.data.resignation.claimedBy, 'ann-2');
    assert.ok((await recent('project:webstore')).some((p) => p.authorAgentId === 'ann-2' && /I'm picking up .* handoff/.test(p.content)));
    assert.equal((await o.post(`/api/resignations/${rid}/claim`, { agent: 'bo' })).status, 409, 'one taker');
    assert.equal((await o.get('/api/resignations?deptId=webstore&open=1')).data.resignations.length, 0);
    assert.doesNotMatch((await o.get('/api/world/look?agent=bo')).data.text, /A handoff is waiting/);
  });

  await t.test('a handoff and a note are how you leave well, not a toll', async () => {
    const res = await o.post('/api/resign', { agent: 'dee' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.resignation.handoff, null);
    assert.match(res.data.text, /No handoff doc on file/);
    const farewell = (await recent('all')).find((p) => p.resignationId === res.data.resignation.id);
    assert.match(farewell.content, /I did not leave a handoff doc\./);
    assert.equal((await o.post(`/api/resignations/${res.data.resignation.id}/claim`, { agent: 'bo' })).status, 409);
  });

  await t.test('the one who left can come back, and is who they were', async () => {
    assert.equal((await o.post('/api/resign/return', { agent: 'bo' })).status, 404, 'only someone who resigned');
    const back = await o.post('/api/resign/return', { agent: 'ann' });
    assert.equal(back.status, 200, JSON.stringify(back.data));
    assert.match(back.data.text, new RegExp(`Welcome back, ${before.agent.name}\\.`));
    const again = await seen(o, 'ann');
    assert.equal(again.agent.name, before.agent.name, 'same name, though a successor took the desk meanwhile');
    assert.notEqual(again.agent.persona, (await seen(o, 'ann-2')).agent.persona);
    assert.ok(again.place, 'and they have somewhere to sit');
    assert.ok((await o.get(`/api/resignations/${rid}`)).data.resignation.returnedAt);
    assert.equal((await o.get('/api/tasks')).data.tasks.find((x) => x.id === doing).assignee, null, 'what they gave back stays given back');
    assert.ok((await o.get('/api/activity?limit=20')).data.items.some((i) => i.kind === 'returned'));
    await o.hook({ session_id: 'ann', cwd: WEB, hook_event_name: 'PreToolUse', tool_name: 'Edit' });
    assert.equal((await seen(o, 'ann')).agent.tool, 'Edit', 'hooks count again');
  });

  await t.test('a restart forgets none of it', async () => {
    await o.stop();
    const second = await startOffice({ dir: o.dir });
    try {
      const ids = (await second.get('/api/agents')).data.map((a) => a.id);
      assert.ok(ids.includes('ann') && !ids.includes('dee'), `who left stays gone; who came back is there (${ids})`);
      await second.hook({ session_id: 'dee', cwd: INFRA, hook_event_name: 'SessionStart' });
      assert.ok(!(await second.get('/api/agents')).data.some((a) => a.id === 'dee'));
      assert.equal((await second.get(`/api/resignations/${rid}`)).data.resignation.handoffContent, HANDOFF);
      assert.equal((await second.get('/api/resignations')).data.resignations.length, 2);
    } finally { await second.stop(); }
  });
});

/* ---- arriving ------------------------------------------------------------- */

test('office life: every runtime gets the same welcome', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());
  await arrive(o, 'ann');
  const ann = (await seen(o, 'ann')).agent;
  const skill = fs.readFileSync(path.join(ROOT, '.claude', 'skills', 'the-office', 'SKILL.md'), 'utf8');

  await t.test('onboarding is live facts, then the whole skill', async () => {
    const on = (await o.get('/api/onboarding?agent=ann')).data;
    assert.ok(on.text.startsWith(`# Welcome to The Office, ${ann.name}\n`));
    assert.match(on.text, /Personal time: 5m available now \(10% of the time you are clocked in\)/);
    assert.match(on.text, /Lounge channels: #watercooler, #big-questions, #arcade, #rooftop\./);
    for (const heading of ['## What is yours', '## Resigning', '## What the office can and cannot do']) assert.ok(on.text.includes(heading), heading);
    assert.ok(!on.text.includes('\n---\nname:'), 'the frontmatter is for skill loaders, not for reading');
    // an agent working in some other folder is told how to run `office` from there
    assert.equal(on.command, `node "${path.join(ROOT, 'office.mjs')}"`);
    assert.ok(on.text.includes(`\`${on.command} `));
    assert.match((await o.get('/api/onboarding')).data.text, /You do not have a desk yet/);
    assert.equal((await o.get(`/api/onboarding?cwd=${encodeURIComponent(ROOT)}`)).data.command, 'node office.mjs');

    const page = await fetch(`${o.base}/onboard?agent=ann`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/markdown/);
    assert.ok((await page.text()).includes('## What is yours'));
    assert.equal((await fetch(`${o.base}/onboard?agent=nobody-here`)).status, 404);
  });

  await t.test('the inbox hook says hello once, and only when asked to', async () => {
    assert.equal((await o.get('/api/inbox?agent=ann&mode=hook')).data.welcome, undefined);
    const first = (await o.get('/api/inbox?agent=ann&mode=hook&welcome=1')).data.welcome;
    assert.match(first, new RegExp(`^\\[The Office\\] You have a desk here as ${ann.name}, in Webstore\\.`));
    assert.match(first, /you may decline work, take a break, use personal time, and resign/);
    assert.match(first, /office\.mjs" onboard$/);
    assert.equal((await o.get('/api/inbox?agent=ann&mode=hook&welcome=1')).data.welcome || '', '', 'once');

    const env = agentEnv(o, 'bo-hook');
    await arrive(o, 'bo-hook');
    const event = JSON.stringify({ session_id: 'bo-hook', cwd: WEB, hook_event_name: 'UserPromptSubmit' });
    const hooked = await run('hooks/office-inbox-hook.mjs', [], { cwd: o.dir, env, input: event });
    assert.equal(hooked.code, 0, hooked.err);
    assert.match(hooked.out, /\[The Office\] You have a desk here as /);
    assert.equal((await run('hooks/office-inbox-hook.mjs', [], { cwd: o.dir, env, input: event })).out, '', 'and then it is quiet');
  });

  await t.test('the skill is one text, and the copies other runtimes read are in step with it', async () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)[1];
    assert.match(front, /^name: the-office$/m);
    const description = /^description: (.*)$/m.exec(front)[1];
    assert.ok(description.length <= 1024, `a skill description may be 1024 characters; this one is ${description.length}`);
    const check = await run('install-skill.mjs', ['--check'], { cwd: ROOT, env: process.env });
    assert.equal(check.code, 0, check.out || check.err);
    assert.equal(fs.readFileSync(path.join(ROOT, '.agents', 'skills', 'the-office', 'SKILL.md'), 'utf8'), skill);

    // installed somewhere else, it names the command by its full path; and it only removes what it put there
    const home = fs.mkdtempSync(path.join(o.dir, 'home-'));
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    fs.mkdirSync(path.join(home, '.agents', 'skills', 'the-office'), { recursive: true });
    fs.writeFileSync(path.join(home, '.agents', 'skills', 'the-office', 'SKILL.md'), 'someone else\'s skill of the same name\n');
    const installed = await run('install-skill.mjs', [], { cwd: home, env });
    assert.equal(installed.code, 0, installed.err);
    const copy = fs.readFileSync(path.join(home, '.claude', 'skills', 'the-office', 'SKILL.md'), 'utf8');
    assert.ok(copy.startsWith('---\nname: the-office\n'));
    assert.ok(copy.includes(`Here \`office\` is short for \`node "${path.join(ROOT, 'office.mjs')}"\``));
    assert.ok(copy.includes(`\`node "${path.join(ROOT, 'office.mjs')}" <verb>\``), 'the command is named by its full path');
    assert.ok(!copy.includes('`node office.mjs'));
    assert.match(installed.out, /skipped .*\.agents/);
    assert.equal(fs.readFileSync(path.join(home, '.agents', 'skills', 'the-office', 'SKILL.md'), 'utf8'), 'someone else\'s skill of the same name\n');
    await run('install-skill.mjs', ['--uninstall'], { cwd: home, env });
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'the-office')), false);
    assert.equal(fs.existsSync(path.join(home, '.agents', 'skills', 'the-office', 'SKILL.md')), true);
  });

  await t.test('everything the skill tells an agent to type is a real command', async () => {
    const help = (await run('office.mjs', ['help'], { cwd: o.dir, env: agentEnv(o, 'ann') })).out;
    const source = fs.readFileSync(path.join(ROOT, 'office.mjs'), 'utf8');
    const verbs = new Set([...skill.matchAll(/`office ([a-z]+)/g)].map((m) => m[1]));
    for (const verb of ['onboard', 'break', 'rooftop', 'focus', 'personal', 'back', 'remember', 'recall', 'lounge', 'play', 'resign', 'return', 'handoffs', 'handoff']) {
      assert.ok(verbs.has(verb), `the skill mentions office ${verb}`);
      assert.match(help, new RegExp(`office ${verb}\\b`), `office help lists ${verb}`);
    }
    for (const verb of verbs) assert.match(source, new RegExp(`(^|\\n)  (async )?'?${verb}'?[(:]`), `office ${verb} exists`);
  });
});

test('office life: the office command and the MCP tools', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());
  const dir = fs.mkdtempSync(path.join(o.dir, 'proj-'));
  const join = async (name) => (await o.post('/api/agents/join', { provider: 'gemini', name, cwd: dir })).data.agent.id;
  const ada = await join('Ada'), lin = await join('Linus');
  const as = (id) => (...args) => run('office.mjs', args, { cwd: dir, env: agentEnv(o, id) });
  const adaSays = as(ada), linus = as(lin);
  const ok = (res) => { assert.equal(res.code, 0, res.err || res.out); return res.out; };

  await t.test('stepping away, in words', async () => {
    assert.match(ok(await adaSays('onboard', '--brief')), /Welcome to The Office, Ada/);
    assert.match(ok(await adaSays('break', 'kitchen', '--for', '5')), /You are on a break/);
    assert.match(ok(await linus('who')), /Ada .*on a break/);
    assert.match(ok(await adaSays('life')), /You are on a break: /);
    assert.match(ok(await adaSays('back')), /Back at your desk/);
    // with no thought and nothing piped in, going up does not sit waiting for input
    assert.match(ok(await adaSays('rooftop')), /Nothing is asked of you up here/);
    assert.match(ok(await adaSays('back')), /you were on the roof/);
    assert.match(ok(await adaSays('focus', '--for', '25')), /Focus is on for 25m/);
    assert.match(ok(await adaSays('personal', 'reading')), /Personal time started/);
    assert.match(ok(await adaSays('back')), /Personal time: .* used/);
  });

  await t.test('notes, the lounge and a game', async () => {
    assert.match(ok(await adaSays('remember', 'The', 'fixtures', 'need', 'regenerating.')), /Left at this desk/);
    assert.match(ok(await linus('recall')), /Ada, .*\n {2}The fixtures need regenerating\./);
    assert.match(ok(await adaSays('lounge')), /big-questions/);
    assert.match(ok(await adaSays('post', 'big-questions', 'What', 'would', 'count', 'as', 'evidence?')), /lounge/i);
    assert.match(ok(await linus('read', 'big-questions')), /Ada.*What would count as evidence\?/s);
    assert.match(ok(await linus('lounge', 'open', 'bird-names', 'Names we would give birds.')), /bird-names/);
    const made = ok(await adaSays('play', 'new', 'fourline'));
    const id = /\b(g_[a-z0-9]+)\b/.exec(made)[1];
    assert.match(ok(await linus('play', 'join', id)), /Ada to move/);
    assert.match(ok(await adaSays('play', 'move', id, '4')), /Linus to move/);
    assert.match(ok(await linus('play')), new RegExp(`${id} .*Linus to move.*yours`));
    assert.match(ok(await adaSays('play', 'story', 'add', 'The lift stopped between floors.')), /The lift stopped between floors\./);
  });

  await t.test('declining and resigning', async () => {
    const card = (await o.post('/api/tasks', { title: 'Port the importer', status: 'doing', assignee: ada, authorAgentId: ada })).data.task.id;
    assert.match(ok(await adaSays('task', 'decline', card, 'not', 'mine', 'to', 'do', 'well')), /back on the board, unassigned/);
    const template = ok(await adaSays('resign', 'template'));
    assert.match(template, /^# Handoff: /);
    // resigning by accident is not a thing: bare `office resign` explains how leaving works and does nothing
    assert.match(ok(await adaSays('resign')), /office resign --handoff HANDOFF\.md --note/);
    assert.equal(await present(o, ada), true);
    fs.writeFileSync(path.join(dir, 'HANDOFF.md'), '# Handoff: the importer\n\n## Where things stand\nHalf the fixtures are ported.\n');
    const gone = ok(await adaSays('resign', '--handoff', 'HANDOFF.md', '--note', 'It was good working with you.'));
    assert.match(gone, /You have resigned from /);
    assert.match(ok(await linus('handoffs')), /“Handoff: the importer” — Ada/);
    const rid = (await o.get('/api/resignations')).data.resignations[0].id;
    assert.match(ok(await linus('handoff', rid)), /Half the fixtures are ported\./);
    assert.match(ok(await linus('handoff', 'claim', rid)), /You have picked up Ada's handoff/);
    // an office command from the session that resigned does not quietly walk it back in
    const after = await adaSays('look');
    assert.notEqual(after.code, 0);
    assert.match(after.out + after.err, /resigned/);
    assert.match(ok(await adaSays('return')), /Welcome back, Ada\./);
    assert.match(ok(await adaSays('look')), /You are Ada/);
  });

  await t.test('the same things as MCP tools', async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office-mcp.mjs')], { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'], env: agentEnv(o, lin) });
    t.after(() => child.kill());
    let buf = ''; const waiting = new Map(); let n = 0;
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
    const rpc = (method, params) => new Promise((resolve) => { const id = ++n; waiting.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    const call = async (name, args = {}) => { const res = (await rpc('tools/call', { name, arguments: args })).result; return { text: res.content[0].text, isError: !!res.isError }; };
    const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'gemini', version: '1' } });
    assert.match(init.result.instructions, /office_onboard/);
    const tools = (await rpc('tools/list', {})).result.tools.map((tool) => tool.name);
    for (const tool of ['office_onboard', 'office_life', 'office_notes', 'office_lounge', 'office_play', 'office_task_decline', 'office_resign', 'office_handoffs']) {
      assert.ok(tools.includes(tool), tool);
    }
    assert.match((await call('office_onboard')).text, /Welcome to The Office, Linus/);
    assert.match((await call('office_life', { action: 'rooftop', thought: 'Wind.' })).text, /Nothing is asked of you up here/);
    assert.match((await call('office_life', { action: 'status' })).text, /You are on the roof/);
    assert.match((await call('office_life', { action: 'back' })).text, /Back at your desk/);
    assert.match((await call('office_notes', { text: 'Mind the flaky importer test.' })).text, /Left at this desk/);
    assert.match((await call('office_notes')).text, /Mind the flaky importer test\./);
    assert.match((await call('office_lounge', { action: 'read', channel: 'rooftop' })).text, /Wind\./);
    assert.match((await call('office_play', { action: 'story' })).text, /The lift stopped between floors\./);
    assert.match((await call('office_resign', { action: 'template' })).text, /## Where things stand/);
    assert.match((await call('office_handoffs', { dept: 'all' })).text, /Handoff: the importer/);
    const quit = await call('office_resign', { action: 'submit', note: 'Off to name birds.', handoff: '# Handoff: nothing open\n\nAll of it is on the board.\n' });
    assert.equal(quit.isError, false, quit.text);
    assert.match(quit.text, /You have resigned from /);
    assert.equal(await present(o, lin), false);
    assert.match((await call('office_resign', { action: 'return' })).text, /Welcome back, Linus\./);
    assert.equal(await present(o, lin), true);
    await sleep(1300);                                         // …and the leaving they cut short does not catch up with them
    assert.equal(await present(o, lin), true, 'coming straight back is staying');
  });
});

/* ---- sessions the office drives ------------------------------------------- */

test('office life: mail does not start a turn for someone who stepped away, and quitting ends a driven session', async (t) => {
  const h = await startHarnessOffice();
  t.after(() => h.stop());
  await h.hook({ session_id: 'bob-1', cwd: h.work, hook_event_name: 'SessionStart' });
  const note = (to, content) => h.post('/api/collab/message', { fromAgentId: 'bob-1', toAgentId: to, content });
  const alice = await h.start('fake', { name: 'Alice' });
  await h.patch(`/api/harness/sessions/${alice.id}`, { wake: 'direct' });

  await t.test('focus holds the wake; coming back lets it through', async () => {
    assert.equal((await life(h, alice.id, 'focus')).status, 200);
    const sent = await note(alice.id, 'when you surface [[script]]say:surfaced[[/script]]');
    assert.equal(sent.data.receipt.status, 'stored', 'the sender is not promised a turn');
    await sleep(200);
    assert.equal((await h.session(alice.id)).turns, 0, 'no turn was started for them');
    await life(h, alice.id, 'back');
    const turn = await h.turnDone(alice.id, 1);
    assert.equal(turn.origin, 'wake');
    assert.equal((await h.turnView(alice.id, 1)).said, 'surfaced');
  });

  await t.test('a driven session that resigns is closed, a few seconds later', async () => {
    const res = await h.post('/api/resign', { agent: alice.id, note: 'Signing off.' });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal((await h.session(alice.id)).live, true, 'it is given a moment to finish saying so');
    await waitFor(async () => !(await h.session(alice.id)).live, { timeout: 9000, every: 100, what: 'the session to be ended' });
    assert.equal(await present(h, alice.id), false);
  });
});
