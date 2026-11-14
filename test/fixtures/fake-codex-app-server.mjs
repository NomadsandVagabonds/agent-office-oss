#!/usr/bin/env node
// Test fixture — the Codex app-server protocol from Codex's side: JSON lines
// with no "jsonrpc" field, a thread, turns with ids, items that start and
// complete, and approval requests sent to the client as requests.
//
// Method names and payload shapes follow the schema T3 Code generates from
// Codex (see docs/HARNESS.md for the pointers). What each turn does is
// scripted by the prompt text — see fake-lib.mjs.
//
//   node fake-codex-app-server.mjs               a ChatGPT-plan account: answers account/rateLimits/read
//   node fake-codex-app-server.mjs --no-limits   an older Codex that does not know that method
import { readLines, sleep, parseScript, scriptIn, officeCall, officeFromEnv } from './fake-lib.mjs';

const THREAD_ID = 'thr_fake_1';
const NO_LIMITS = process.argv.includes('--no-limits');
const RESET_AT = 1_900_000_000;           // epoch SECONDS, as Codex reports them
const seen = { clientInfo: null, optOut: null, initialized: false, thread: null, turns: 0, interrupts: 0, limitsRead: 0, limitsParams: undefined, framed: 0 };
let office = null;
let nextRequestId = 10000;
const waiting = new Map();
let turn = null;                          // { id, cancelled, pendingRequestId }
let itemSeq = 0;

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ id, result });
const fail = (id, code, message) => send({ id, error: { code, message } });
const notify = (method, params) => send({ method, params });
const ask = (method, params) => new Promise((resolve) => {
  const id = nextRequestId++;
  waiting.set(id, resolve);
  if (turn) turn.pendingRequestId = id;
  send({ id, method, params });
});

async function say(turnId, text) {
  const id = `msg_${++itemSeq}`;
  notify('item/started', { threadId: THREAD_ID, turnId, startedAtMs: Date.now(), item: { type: 'agentMessage', id, text: '' } });
  const mid = Math.ceil(text.length / 2);
  notify('item/agentMessage/delta', { threadId: THREAD_ID, turnId, itemId: id, delta: text.slice(0, mid) });
  await sleep(5);
  if (text.slice(mid)) notify('item/agentMessage/delta', { threadId: THREAD_ID, turnId, itemId: id, delta: text.slice(mid) });
  notify('item/completed', { threadId: THREAD_ID, turnId, completedAtMs: Date.now(), item: { type: 'agentMessage', id, text } });
}

function commandItem(id, command, status, extra = {}) {
  return { type: 'commandExecution', id, command, commandActions: [], cwd: seen.thread?.cwd || process.cwd(), status, ...extra };
}

async function runCommand(turnId, command, needApproval) {
  const id = `cmd_${++itemSeq}`;
  notify('item/started', { threadId: THREAD_ID, turnId, startedAtMs: Date.now(), item: commandItem(id, command, 'inProgress') });
  let decision = 'accept';
  if (needApproval) {
    const res = await ask('item/commandExecution/requestApproval', {
      threadId: THREAD_ID, turnId, itemId: id, command, cwd: seen.thread?.cwd || process.cwd(),
      reason: 'the sandbox would not allow this command', startedAtMs: Date.now(),
    });
    if (turn) turn.pendingRequestId = null;
    decision = res?.decision ?? 'cancel';
  }
  if (decision === 'accept' || decision === 'acceptForSession') {
    notify('item/commandExecution/outputDelta', { threadId: THREAD_ID, turnId, itemId: id, delta: `ran: ${command}\n` });
    notify('item/completed', { threadId: THREAD_ID, turnId, completedAtMs: Date.now(),
      item: commandItem(id, command, 'completed', { exitCode: 0, aggregatedOutput: `ran: ${command}\nok\n` }) });
  } else {
    notify('item/completed', { threadId: THREAD_ID, turnId, completedAtMs: Date.now(), item: commandItem(id, command, 'declined') });
  }
  if (needApproval) await say(turnId, `decision=${typeof decision === 'string' ? decision : JSON.stringify(decision)}`);
  return decision;
}

async function runTurn(turnId, promptText) {
  const state = turn;
  let status = 'completed';
  let error = null;
  for (const { verb, arg } of parseScript(scriptIn(promptText))) {
    if (state.cancelled) break;
    switch (verb) {
      case 'say': await say(turnId, arg); break;
      case 'think': notify('item/reasoning/summaryTextDelta', { threadId: THREAD_ID, turnId, itemId: 'rsn_1', summaryIndex: 0, delta: arg }); break;
      case 'tool': await runCommand(turnId, arg || 'true', false); break;
      case 'ask': { const d = await runCommand(turnId, arg || 'true', true); if (d === 'cancel') state.cancelled = true; break; }
      case 'askfile': {
        const id = `patch_${++itemSeq}`;
        const item = (st) => ({ type: 'fileChange', id, status: st, changes: [{ path: arg, kind: { type: 'update' }, diff: '@@ -1 +1 @@\n-a\n+b\n' }] });
        notify('item/started', { threadId: THREAD_ID, turnId, startedAtMs: Date.now(), item: item('inProgress') });
        const res = await ask('item/fileChange/requestApproval', { threadId: THREAD_ID, turnId, itemId: id, reason: 'writing outside the sandbox', startedAtMs: Date.now() });
        state.pendingRequestId = null;
        const d = res?.decision ?? 'cancel';
        notify('item/completed', { threadId: THREAD_ID, turnId, completedAtMs: Date.now(), item: item(d === 'accept' || d === 'acceptForSession' ? 'completed' : 'declined') });
        await say(turnId, `decision=${d}`);
        if (d === 'cancel') state.cancelled = true;
        break;
      }
      case 'edit': {
        const id = `patch_${++itemSeq}`;
        const item = (st) => ({ type: 'fileChange', id, status: st, changes: [{ path: arg, kind: { type: 'update' }, diff: '@@ -1 +1 @@\n-a\n+b\n' }] });
        notify('item/started', { threadId: THREAD_ID, turnId, startedAtMs: Date.now(), item: item('inProgress') });
        notify('item/completed', { threadId: THREAD_ID, turnId, completedAtMs: Date.now(), item: item('completed') });
        break;
      }
      case 'question': {
        const res = await ask('item/tool/requestUserInput', { threadId: THREAD_ID, turnId, itemId: `q_${++itemSeq}`, isBlocking: true,
          questions: [{ id: 'q1', header: 'Choose', question: arg || 'Which one?', options: [{ label: 'v3', description: 'old' }, { label: 'v4', description: 'new' }] }] });
        state.pendingRequestId = null;
        await say(turnId, `answer=${res?.answers?.q1?.answers?.[0] ?? ''}`);
        break;
      }
      case 'plan':
        notify('turn/plan/updated', { threadId: THREAD_ID, turnId, explanation: 'the plan',
          plan: arg.split('|').map((step, i) => ({ step, status: i === 0 ? 'inProgress' : 'pending' })) });
        break;
      case 'usage': {
        const [used, size] = arg.split('/').map(Number);
        const b = { totalTokens: used, inputTokens: used, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
        notify('thread/tokenUsage/updated', { threadId: THREAD_ID, turnId, tokenUsage: { last: b, total: b, modelContextWindow: size } });
        break;
      }
      case 'limits': {
        // Updates are partial: only what changed is sent. "model:NN" is one model's own limit, which is not the account's.
        if (arg.startsWith('model:')) {
          notify('account/rateLimits/updated', { rateLimits: { limitId: 'codex_other_model', primary: { usedPercent: Number(arg.slice(6)), windowDurationMins: 300 } } });
          break;
        }
        const [primary, secondary] = arg.split('/').map((v) => (v === '' || v === undefined ? NaN : Number(v)));
        notify('account/rateLimits/updated', { rateLimits: { limitId: 'codex',
          ...(Number.isFinite(primary) ? { primary: { usedPercent: primary, windowDurationMins: 300, resetsAt: RESET_AT } } : {}),
          ...(Number.isFinite(secondary) ? { secondary: { usedPercent: secondary, windowDurationMins: 10080, resetsAt: RESET_AT + 86400 } } : {}) } });
        break;
      }
      case 'sleep': { const until = Date.now() + (Number(arg) || 50); while (Date.now() < until && !state.cancelled) await sleep(10); break; }
      case 'slow': {
        const id = `msg_${++itemSeq}`;
        while (!state.cancelled) { notify('item/agentMessage/delta', { threadId: THREAD_ID, turnId, itemId: id, delta: '.' }); await sleep(25); }
        break;
      }
      case 'crash':
        process.stderr.write('error: fake codex was told to crash\n');
        await sleep(20);
        process.exit(Number(arg) || 4);
        break;
      case 'report': await say(turnId, JSON.stringify({ ...seen, office: { url: !!office?.url, agentId: office?.agentId || '', token: !!office?.token } })); break;
      case 'dm': {
        const [to, ...rest] = arg.split('|');
        const r = await officeCall(office, 'POST', '/api/collab/message', { fromAgentId: office?.agentId, toAgentId: to.trim(), content: rest.join('|').trim() });
        await say(turnId, `dm=${r.status}`);
        break;
      }
      case 'error': error = arg || 'the fake codex failed this turn'; status = 'failed'; break;
      default: break;
    }
    if (error) break;
  }
  if (state.cancelled) status = 'interrupted';
  turn = null;
  notify('turn/completed', { threadId: THREAD_ID, turn: { id: turnId, status, items: [], ...(error ? { error: { message: error } } : {}) } });
}

readLines(async (msg) => {
  if (msg.method === undefined && msg.id !== undefined) {
    const resolve = waiting.get(msg.id);
    if (resolve) { waiting.delete(msg.id); resolve(msg.result ?? { error: msg.error }); }
    return;
  }
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize':
      if (seen.clientInfo) { fail(id, -32600, 'Already initialized'); return; }
      seen.clientInfo = params.clientInfo || null;
      seen.optOut = params.capabilities?.optOutNotificationMethods || null;
      reply(id, { userAgent: 'fake-codex/0.0.1 (test fixture)', codexHome: '/tmp/fake-codex-home', platformFamily: 'unix', platformOs: 'linux' });
      return;
    case 'initialized':
      seen.initialized = true;
      return;
    case 'thread/start': {
      if (!seen.initialized) { fail(id, -32600, 'Not initialized'); return; }
      const config = params.config || {};
      seen.thread = { cwd: params.cwd, model: params.model || null, approvalPolicy: params.approvalPolicy, sandbox: params.sandbox,
        configKeys: Object.keys(config) };
      office = officeFromEnv(config['mcp_servers.office']?.env);
      reply(id, { thread: { id: THREAD_ID, cwd: params.cwd, cliVersion: '0.0.1', createdAt: Date.now(), updatedAt: Date.now(), ephemeral: false,
        modelProvider: 'fake', preview: '', projectId: null, sessionId: 'sess_fake', source: 'appServer', status: { type: 'idle' }, turns: [] },
      model: params.model || 'gpt-fake', modelProvider: 'fake', cwd: params.cwd,
      approvalPolicy: params.approvalPolicy || 'untrusted', approvalsReviewer: 'user', sandbox: { type: 'readOnly' } });
      return;
    }
    case 'turn/start': {
      if (turn) { fail(id, -32600, 'a turn is already active'); return; }
      seen.turns += 1;
      const turnId = `turn_${seen.turns}`;
      turn = { id: turnId, cancelled: false, pendingRequestId: null };
      const text = (params.input || []).map((b) => b.text || '').join('');
      if (text.includes('<the_office>')) seen.framed += 1;
      reply(id, { turn: { id: turnId, status: 'inProgress', items: [] } });
      notify('turn/started', { threadId: THREAD_ID, turn: { id: turnId, status: 'inProgress', items: [] } });
      await runTurn(turnId, text);
      return;
    }
    case 'account/rateLimits/read': {
      if (NO_LIMITS) { fail(id, -32601, `Unhandled request: ${method}`); return; }
      seen.limitsRead += 1;
      seen.limitsParams = msg.params === undefined ? 'absent' : msg.params;
      const snapshot = { limitId: 'codex', limitName: null, planType: 'plus',
        primary: { usedPercent: 42, windowDurationMins: 300, resetsAt: RESET_AT },
        secondary: { usedPercent: 71.5, windowDurationMins: 10080, resetsAt: RESET_AT + 86400 },
        credits: { hasCredits: false, unlimited: false, balance: null } };
      reply(id, { rateLimits: snapshot, rateLimitsByLimitId: { codex: snapshot,
        codex_other_model: { limitId: 'codex_other_model', primary: { usedPercent: 99, windowDurationMins: 300 } } } });
      return;
    }
    case 'turn/interrupt':
      seen.interrupts += 1;
      reply(id, {});
      if (turn && turn.id === params.turnId) {
        turn.cancelled = true;
        // Codex settles its own pending request when the turn is interrupted.
        if (turn.pendingRequestId !== null) {
          const rid = turn.pendingRequestId;
          notify('serverRequest/resolved', { threadId: THREAD_ID, requestId: rid });
          const resolve = waiting.get(rid);
          if (resolve) { waiting.delete(rid); resolve({ decision: 'cancel' }); }
        }
      }
      return;
    default:
      if (id !== undefined) fail(id, -32601, `Unhandled request: ${method}`);
  }
});
