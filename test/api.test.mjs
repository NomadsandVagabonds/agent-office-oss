// End-to-end: a real office on a throwaway port, driven the way agents,
// hooks and the browser drive it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { ROOT, sleep, startOffice } from './helpers.mjs';

const claude = (id, name, extra = {}) => ({ session_id: id, cwd: '/tmp/t/webstore', hook_event_name: name, transcript_path: '/nonexistent.jsonl', ...extra });

test('the office', async (t) => {
  const o = await startOffice();
  t.after(() => o.stop());

  await t.test('is healthy and describes itself', async () => {
    const h = await o.get('/api/health');
    assert.equal(h.status, 200);
    assert.equal(h.data.status, 'ok');
    const api = await o.get('/api');
    assert.ok(api.data.endpoints.some((e) => e.path === '/api/agents/join'));
    assert.ok(api.data.contract.providers.includes('gemini'));
  });

  await t.test('refuses cross-origin writes, foreign hosts and cross-origin sockets', async () => {
    const evil = { origin: 'https://evil.example', 'content-type': 'text/plain' };
    const spawnTry = await fetch(o.base + '/api/terminal/spawn', { method: 'POST', headers: evil, body: JSON.stringify({ provider: 'shell', command: 'true' }) });
    assert.equal(spawnTry.status, 403);
    assert.equal((await fetch(o.base + '/hook', { method: 'POST', headers: evil, body: '{}' })).status, 403);
    // fetch() will not let us forge Host, so speak HTTP by hand for the DNS-rebinding case
    const rebind = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: o.port, path: '/api/agents', headers: { host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    assert.equal(rebind, 403);
    assert.equal((await fetch(o.base + '/api/agents', { headers: { origin: 'https://evil.example' } })).headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(o.base + '/hook', { method: 'POST', headers: { origin: o.base, 'content-type': 'application/json' }, body: '{}' })).status, 204);
    const upgrade = (origin) => new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port: o.port, path: '/', headers: {
        upgrade: 'websocket', connection: 'Upgrade', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13', ...(origin ? { origin } : {}) } });
      req.on('response', (res) => { res.resume(); resolve(res.statusCode); });
      req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(await upgrade('https://evil.example'), 403);
    assert.equal(await upgrade(o.base), 101);
  });

  await t.test('serves files safely', async () => {
    assert.equal((await fetch(o.base + '/core/contract.mjs')).status, 200);
    assert.equal((await fetch(o.base + '/classic/')).status, 200);
    assert.equal((await fetch(o.base + '/.gitkeep')).status, 404);
    assert.equal((await fetch(o.base + '/%2e%2e/%2e%2e/etc/passwd')).status, 404);
    assert.equal((await fetch(o.base + '/api/nope')).status, 404);
    assert.equal((await fetch(o.base + '/api/health', { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(o.base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' })).status, 400);
  });

  await t.test('hooks become agents with stable identity and honest status', async () => {
    await o.hook(claude('s1', 'SessionStart'));
    const a = (await o.get('/api/agents/s1')).data;
    assert.equal(a.agent.provider, 'claude', 'inferred from the transcript path');
    assert.equal(a.agent.department.id, 'webstore');
    assert.equal(a.agent.persona, 'p:claude:/tmp/t/webstore');
    assert.ok(a.agent.profile.character.species, 'look is resolved server-side');
    assert.equal(a.place.at, 'desk');
    await o.hook(claude('s1', 'UserPromptSubmit'));
    await o.hook(claude('s1', 'PreToolUse', { tool_name: 'Edit' }));
    let s = (await o.get('/api/agents/s1')).data.agent;
    assert.deepEqual([s.status, s.tool, s.turn], ['working', 'Edit', 'active']);
    await o.hook(claude('s1', 'Stop'));
    s = (await o.get('/api/agents/s1')).data.agent;
    assert.deepEqual([s.status, s.turn], ['done', 'idle']);
    await sleep(1600);
    assert.equal((await o.get('/api/agents/s1')).data.agent.status, 'thinking', 'done settles');
    // a second session in the same directory is a different persona slot
    await o.hook(claude('s2', 'SessionStart'));
    const b = (await o.get('/api/agents/s2')).data;
    assert.equal(b.agent.persona, 'p:claude:/tmp/t/webstore#2');
    assert.notEqual(b.place.ref, a.place.ref, 'own desk');
  });

  await t.test('any runtime can join through the front door', async () => {
    const j = await o.post('/api/agents/join', { provider: 'Gemini CLI', model: 'gemini-2.5-pro', cwd: '/tmp/t/mobile', name: 'Gem' });
    assert.equal(j.status, 200);
    assert.equal(j.data.created, true);
    assert.equal(j.data.agent.provider, 'gemini');
    assert.equal(j.data.agent.name, 'Gem');
    assert.deepEqual(j.data.agent.runtime.promptActions, []);
    const again = await o.post('/api/agents/join', { id: j.data.agent.id, provider: 'gemini', cwd: '/tmp/t/mobile' });
    assert.equal(again.data.created, false, 'joining twice is idempotent');
    assert.equal((await o.post('/api/agents/nobody/heartbeat')).status, 404);
  });

  await t.test('a blocked agent opens a NEEDS-YOU request that survives and resolves', async () => {
    await o.hook(claude('s1', 'Notification', { message: 'Claude needs your permission to use Bash' }));
    let pending = (await o.get('/api/prompts?status=pending')).data;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].kind, 'permission');
    assert.deepEqual(pending[0].actions, ['reply']);
    assert.equal((await o.get('/api/agents/s1')).data.agent.blockKind, 'permission');
    // approved in the terminal: the agent just carries on
    await o.hook(claude('s1', 'PostToolUse', { tool_name: 'Bash' }));
    pending = (await o.get('/api/prompts?status=pending')).data;
    assert.equal(pending.length, 0, 'resolved when the agent resumes on its own');
    // answered from the office instead
    await o.hook(claude('s2', 'Notification', { message: 'Which dataset — v3 or v4?' }));
    const p = (await o.get('/api/prompts?status=pending')).data[0];
    const r = await o.post(`/api/prompts/${p.id}/reply`, { text: 'v4.' });
    assert.equal(r.data.prompt.status, 'resolved');
    const box = (await o.get('/api/inbox?agent=s2')).data;
    assert.ok(box.items.some((m) => m.kind === 'reply' && m.text === 'v4.'), 'the answer lands in the agent\'s inbox');
  });

  await t.test('comms: channels, mentions, direct notes, and an inbox that reads once', async () => {
    const gem = (await o.get('/api/agents')).data.find((a) => a.name === 'Gem');
    const post = await o.post('/api/channels/project:webstore/message', { content: 'Shipping the cart. @Gem can you check mobile?', authorAgentId: 's1' });
    assert.equal(post.data.ok, true);
    assert.deepEqual(post.data.post.mentions, [gem.id]);
    assert.equal(post.data.receipt.status, 'stored');
    assert.equal((await o.post('/api/channels/project:nope/message', { content: 'x' })).status, 404);
    await o.post('/api/collab/message', { fromAgentId: 's1', toAgentId: 'Gem', content: 'Ping.' });
    await o.post('/api/comms/direct-message', { toAgentId: gem.id, content: 'Welcome.' });
    const toLead = await o.post('/api/collab/message', { fromAgentId: gem.id, toAgentId: 'lead', content: 'Thanks!' });
    assert.equal(toLead.data.post.toLead, true);
    const box = (await o.get(`/api/inbox?agent=${gem.id}&ack=1`)).data;
    assert.deepEqual(box.items.map((m) => m.kind).sort(), ['dm', 'lead', 'mention']);
    assert.equal((await o.get(`/api/inbox?agent=${gem.id}`)).data.items.length, 0, 'read once');
    assert.equal((await o.get('/api/inbox?agent=s2')).data.items.filter((m) => m.kind === 'channel').length, 1, 'teammates see the channel post');
    assert.equal((await o.get('/api/inbox?agent=s1')).data.items.filter((m) => m.kind === 'channel').length, 0, 'authors do not see their own');
    const overview = (await o.get('/api/comms/overview')).data;
    assert.ok(overview.directThreads.length >= 2);
  });

  await t.test('kanban: create, claim, move, delete', async () => {
    const made = await o.post('/api/tasks', { title: 'Wire checkout', authorAgentId: 's1', status: 'todo' });
    assert.equal(made.data.task.deptId, 'webstore');
    const id = made.data.task.id;
    const claimed = await o.patch(`/api/tasks/${id}`, { assignee: 's1', status: 'doing', authorAgentId: 's1' });
    assert.deepEqual([claimed.data.task.status, claimed.data.task.assignee, claimed.data.task.live], ['doing', 's1', true]);
    assert.equal((await o.patch(`/api/tasks/${id}`, { assignee: 'ghost' })).status, 404);
    assert.equal((await o.patch(`/api/tasks/${id}`, { status: 'done', authorAgentId: 's1' })).data.task.status, 'done');
    assert.equal(o.ctx.world.state().stats.tasksDone, 1);
    assert.equal((await o.get('/api/tasks?deptId=webstore')).data.tasks.length, 1);
    assert.equal((await o.del(`/api/tasks/${id}`)).data.ok, true);
    assert.equal((await o.post('/api/tasks', { title: '' })).status, 400);
  });

  await t.test('the world: look, go, use, discover, customize', async () => {
    const look = (await o.get('/api/world/look?agent=s1')).data;
    assert.match(look.text, /You are .+ \(claude/);
    assert.match(look.text, /task board/);
    assert.equal((await o.post('/api/world/go', { agent: 's1', to: 'backroom' })).status, 404, 'unknown until found');
    const coffee = (await o.post('/api/world/use', { agent: 's1', thing: 'coffee' })).data;
    assert.match(coffee.text, /brew a cup/);
    assert.equal((await o.get('/api/agents/s1')).data.place.at, 'poi:coffee');
    assert.equal((await o.post('/api/world/go', { agent: 's2', to: 'coffee' })).status, 409, 'one at a time');
    const book = (await o.post('/api/world/use', { agent: 's2', thing: 'red book' })).data;
    assert.equal(book.found, 'red-book');
    assert.equal((await o.get('/api/world')).data.plan.unlocked.backroom, true);
    assert.equal((await o.post('/api/world/go', { agent: 's2', to: 'backroom' })).data.ok, true);
    assert.match((await o.get('/api/world/passport?agent=s2')).data.text, /The Red Book/);
    assert.equal((await o.post('/api/world/emote', { agent: 's1', emote: 'moonwalk' })).status, 400);
    const me = await o.patch('/api/agents/s1/persona', { look: { species: 'robot', hair: 'nonsense' }, desk: { items: ['duck', 'mug'] } });
    assert.equal(me.data.agent.profile.character.species, 'robot');
    assert.deepEqual(me.data.agent.profile.desk.items, ['duck', 'mug']);
    assert.equal(me.data.errors.length, 1);
    assert.equal((await o.post('/api/world/go', { agent: 's1', to: 'home' })).data.place.at, 'desk');
  });

  await t.test('creations: validated, signed, announced', async () => {
    const bad = await o.post('/api/creations', { name: 'Bad', ops: [{ o: 'rect', x: 0, y: 0, w: 2, h: 2, c: 'red' }], agent: 's1' });
    assert.equal(bad.status, 400);
    assert.match(bad.data.errors[0], /#rrggbb/);
    const good = await o.post('/api/creations', { name: 'Test Lamp', kind: 'item', note: 'for tests', author: 'FORGED',
      ops: [{ o: 'box', x: -3, y: -8, w: 6, h: 8, c: '#886644' }, { o: 'glow', x: 0, y: -10, w: 8, h: 8, c: '#ffd27a', a: 40, t: 300 }], agent: 's1' });
    assert.equal(good.status, 200);
    assert.notEqual(good.data.creation.author, 'FORGED');
    assert.equal(good.data.creation.runtime, 'claude');
    assert.equal((await o.get('/api/world')).data.gallery.pedestals[0], good.data.creation.id, 'newest goes on the first pedestal');
    assert.equal((await o.post('/api/world/place', { agent: 's1', creationId: good.data.creation.id })).data.slot, 0);
    assert.equal((await o.post('/api/world/place', { agent: 's1', creationId: 'c_missing' })).status, 404);
  });

  await t.test('the bus delivers a snapshot, the world, and live events', async () => {
    const ws = new WebSocket(o.base.replace('http', 'ws') + '/');
    const seen = [];
    ws.onmessage = (e) => seen.push(JSON.parse(e.data));
    await new Promise((r) => { ws.onopen = r; });
    await sleep(120);
    assert.equal(seen[0].type, 'snapshot');
    assert.ok(seen.some((m) => m.type === 'world' && m.world.plan.rooms.length >= 2));
    await o.post('/api/world/emote', { agent: 's1', emote: 'wave' });
    await o.hook(claude('s1', 'PreToolUse', { tool_name: 'Bash' }));
    await sleep(150);
    assert.ok(seen.some((m) => m.type === 'world_fx' && m.fx.kind === 'emote'));
    assert.ok(seen.some((m) => m.type === 'update' && m.agent.id === 's1' && m.agent.tool === 'Bash'));
    ws.close();
  });

  await t.test('the MCP server speaks the protocol and acts as its own agent', async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'office-mcp.mjs')], {
      cwd: o.dir, stdio: ['pipe', 'pipe', 'ignore'],
      env: { ...process.env, OFFICE_PORT: String(o.port), OFFICE_URL: '', OFFICE_AGENT_ID: '', CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', CLAUDECODE: '', HOME: o.dir },
    });
    t.after(() => child.kill());
    let buf = ''; const waiting = new Map(); let n = 0;
    child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
    const rpc = (method, params) => new Promise((resolve) => { const id = ++n; waiting.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'codex', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-03-26');
    assert.ok((await rpc('tools/list', {})).result.tools.length >= 15);
    const look = await rpc('tools/call', { name: 'office_look', arguments: {} });
    assert.match(look.result.content[0].text, /You are .+ \(codex/);
    const bad = await rpc('tools/call', { name: 'office_dm', arguments: { to: 'nobody-at-all', text: 'hi' } });
    assert.equal(bad.result.isError, true);
    assert.equal((await rpc('nope', {})).error.code, -32601);
  });
});

test('a restart loses neither the people nor what they were waiting for', async () => {
  const first = await startOffice();
  await first.hook(claude('r1', 'SessionStart'));
  await first.hook(claude('r1', 'Notification', { message: 'Approve the deploy?' }));
  await first.post('/api/tasks', { title: 'Persisted card', deptId: 'webstore' });
  await first.post('/api/world/discover', { secret: 'konami' });
  await first.stop();

  const second = await startOffice({ dir: first.dir });
  try {
    const agents = (await second.get('/api/agents')).data;
    assert.deepEqual(agents.map((a) => [a.id, a.status]), [['r1', 'blocked']]);
    assert.equal((await second.get('/api/prompts?status=pending')).data.length, 1);
    assert.equal((await second.get('/api/tasks')).data.tasks[0].title, 'Persisted card');
    const world = (await second.get('/api/world')).data;
    assert.ok(world.discoveries.konami);
    assert.equal(world.plan.rooms[0].deptId, 'webstore', 'the project keeps its room');
    assert.equal(world.places.find((p) => p.id === 'r1').at, 'desk');
  } finally {
    await second.stop();
  }
});

test('refuses to listen beyond loopback without a token', async () => {
  await assert.rejects(startOffice({ env: { OFFICE_HOST: '0.0.0.0' } }), /OFFICE_TOKEN/);
});
