#!/usr/bin/env node
// Test fixture — an agent that speaks the Agent Client Protocol from the other
// side, so the harness can be exercised without spending a single token.
//
//   node fake-acp-agent.mjs            ACP v1 (the stable generation)
//   node fake-acp-agent.mjs --v2       answers in the v2 preview shapes
//   node fake-acp-agent.mjs --auth     refuses session/new until `authenticate`
//
// The wire shapes follow the ACP schema as T3 Code pins it (v1.21 and
// v2.0.0-alpha.3; see docs/HARNESS.md for the file pointers). What each turn
// does is scripted by the prompt text — see fake-lib.mjs.
import { readLines, sleep, parseScript, scriptIn, officeCall, officeFromEnv } from './fake-lib.mjs';

const V2 = process.argv.includes('--v2');
const NEED_AUTH = process.argv.includes('--auth');
const SESSION_ID = 'fake-session-1';

const seen = { protocolVersion: null, clientInfo: null, clientCapabilities: null, mcp: [], mcpTyped: null,
  cwd: '', cancelHadId: null, authenticated: false, prompts: 0 };
let office = null;
let nextId = 9000;                       // ids for requests WE send (permission requests)
const waiting = new Map();               // id → resolve(result|error)
let turn = null;                         // { cancelled, ignoreCancel }
let toolSeq = 0;

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
const reply = (id, result) => send({ id, result });
const fail = (id, code, message) => send({ id, error: { code, message } });
const update = (u) => send({ method: 'session/update', params: { sessionId: SESSION_ID, update: u } });
const request = (method, params) => new Promise((resolve) => { const id = nextId++; waiting.set(id, resolve); send({ id, method, params }); });
const chunk = (text) => update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });

async function say(text) {
  const mid = Math.ceil(text.length / 2);
  chunk(text.slice(0, mid));
  await sleep(5);
  if (text.slice(mid)) chunk(text.slice(mid));
}

async function runTool(command, kind = 'execute', extra = {}) {
  const toolCallId = `tool-${++toolSeq}`;
  update({ sessionUpdate: 'tool_call', toolCallId, title: `Run \`${command}\``, kind, status: 'pending', rawInput: { command }, ...extra });
  await sleep(5);
  update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'in_progress' });
  await sleep(5);
  update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text: `ran: ${command}\nok` } }] });
}

async function askPermission(command, kind = 'execute', extra = {}) {
  const toolCallId = `tool-${++toolSeq}`;
  const title = kind === 'edit' ? `Edit ${command}` : `Run \`${command}\``;
  update({ sessionUpdate: 'tool_call', toolCallId, title, kind, status: 'pending',
    ...(kind === 'edit' ? { locations: [{ path: command }] } : { rawInput: { command } }), ...extra });
  const options = [
    { optionId: 'allow-once', name: 'Allow', kind: 'allow_once' },
    { optionId: 'allow-always', name: 'Always allow', kind: 'allow_always' },
    { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
  ];
  // v1 passes the tool call itself (here by id only, as some agents do); v2 wraps it in a subject.
  const res = await request('session/request_permission', V2
    ? { sessionId: SESSION_ID, title, subject: { type: 'tool_call', toolCall: { toolCallId, title, kind } }, options }
    : { sessionId: SESSION_ID, toolCall: { toolCallId }, options });
  const outcome = res?.outcome || {};
  if (outcome.outcome === 'selected' && String(outcome.optionId).startsWith('allow')) {
    update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: `ran: ${command}` } }] });
  } else {
    update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'failed' });
  }
  await say(`outcome=${outcome.outcome === 'selected' ? outcome.optionId : outcome.outcome || 'none'}`);
  return outcome;
}

async function runTurn(promptText) {
  const state = { cancelled: false, ignoreCancel: false };
  turn = state;
  let stopReason = 'end_turn';
  let error = null;
  for (const { verb, arg } of parseScript(scriptIn(promptText))) {
    if (state.cancelled && !state.ignoreCancel) break;
    switch (verb) {
      case 'say': await say(arg); break;
      case 'think': update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: arg } }); break;
      case 'tool': await runTool(arg || 'true'); break;
      case 'read': await runTool(`cat ${arg}`, 'read', { locations: [{ path: arg }] }); break;
      case 'edit': {
        const toolCallId = `tool-${++toolSeq}`;
        update({ sessionUpdate: 'tool_call', toolCallId, title: `Edit ${arg}`, kind: 'edit', status: 'in_progress', locations: [{ path: arg }] });
        update({ sessionUpdate: 'tool_call_update', toolCallId, status: 'completed',
          content: [{ type: 'diff', path: arg, oldText: 'a', newText: 'b' }] });
        break;
      }
      case 'ask': await askPermission(arg || 'true'); break;
      case 'askfile': await askPermission(arg || 'file.txt', 'edit'); break;
      case 'plan':
        update(V2
          ? { sessionUpdate: 'plan_update', plan: { type: 'items', planId: 'plan-1', entries: arg.split('|').map((content, i) => ({ content, priority: 'medium', status: i === 0 ? 'in_progress' : 'pending' })) } }
          : { sessionUpdate: 'plan', entries: arg.split('|').map((content, i) => ({ content, priority: 'medium', status: i === 0 ? 'in_progress' : 'pending' })) });
        break;
      case 'usage': {
        const [used, size] = arg.split('/').map(Number);
        update({ sessionUpdate: 'usage_update', used, size });
        break;
      }
      case 'sleep': {
        const until = Date.now() + (Number(arg) || 50);
        while (Date.now() < until && !(state.cancelled && !state.ignoreCancel)) await sleep(10);
        break;
      }
      case 'slow':
        while (!state.cancelled || state.ignoreCancel) { chunk('.'); await sleep(25); }
        break;
      case 'ignore-cancel': state.ignoreCancel = true; break;
      case 'crash':
        process.stderr.write('warming up\nError: boom (the fake agent was told to crash)\n    at fake (fake.js:1:1)\n');
        await sleep(20);
        process.exit(Number(arg) || 3);
        break;
      case 'garbage': process.stdout.write('{"jsonrpc":"2.0","method":"session/update","params":{oops\n'); break;
      case 'noise': process.stdout.write('some banner the agent printed to stdout\n'); break;
      case 'report': await say(JSON.stringify({ ...seen, office: { url: !!office?.url, agentId: office?.agentId || '', token: !!office?.token } })); break;
      case 'dm': {
        const [to, ...rest] = arg.split('|');
        const r = await officeCall(office, 'POST', '/api/collab/message', { fromAgentId: office?.agentId, toAgentId: to.trim(), content: rest.join('|').trim() });
        await say(`dm=${r.status}`);
        break;
      }
      case 'post': {
        const r = await officeCall(office, 'POST', '/api/channels/all/message', { authorAgentId: office?.agentId, authorType: 'agent', content: arg });
        await say(`post=${r.status}`);
        break;
      }
      case 'delegate': {
        const [to, ...rest] = arg.split('|');
        const r = await officeCall(office, 'POST', '/api/delegations', { to: to.trim(), task: rest.join('|').trim() });
        await say(`delegate=${r.status}:${r.data?.delegation?.id || r.data?.error || ''}`);
        break;
      }
      case 'http': {
        const [method, path, ...json] = arg.split(' ');
        const r = await officeCall(office, method, path, json.length ? JSON.parse(json.join(' ')) : undefined);
        await say(`http=${r.status}:${JSON.stringify(r.data).slice(0, 300)}`);
        break;
      }
      case 'stop': stopReason = arg || 'end_turn'; break;
      case 'error': error = arg || 'the fake agent failed this turn'; break;
      default: break;
    }
    if (error) break;
  }
  if (state.cancelled && !state.ignoreCancel) stopReason = 'cancelled';
  if (state.ignoreCancel) { await new Promise(() => {}); }           // never end: the office has to end us
  turn = null;
  return { stopReason, error };
}

readLines(async (msg) => {
  // a reply to one of our own requests
  if (msg.method === undefined && msg.id !== undefined) {
    const resolve = waiting.get(msg.id);
    if (resolve) { waiting.delete(msg.id); resolve(msg.result ?? { error: msg.error }); }
    return;
  }
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize':
      seen.protocolVersion = params.protocolVersion;
      seen.clientInfo = params.clientInfo || params.info || null;
      seen.clientCapabilities = params.clientCapabilities || null;
      reply(id, V2
        ? { protocolVersion: 2, info: { name: 'fake-acp', version: '2.0.0' }, capabilities: { session: { prompt: { image: {} }, mcp: { stdio: {} } } },
          ...(NEED_AUTH ? { authMethods: [{ methodId: 'login', type: 'agent', name: 'Log in' }] } : {}) }
        : { protocolVersion: 1, agentInfo: { name: 'fake-acp', title: 'Fake ACP Agent', version: '1.0.0' },
          agentCapabilities: { loadSession: false, promptCapabilities: { image: false }, mcpCapabilities: { http: false, sse: false } },
          ...(NEED_AUTH ? { authMethods: [{ id: 'login', name: 'Log in' }] } : {}) });
      return;
    case 'authenticate':
    case 'auth/login':
      seen.authenticated = params.methodId === 'login';
      reply(id, {});
      return;
    case 'session/new':
      if (NEED_AUTH && !seen.authenticated) { fail(id, -32000, 'Authentication required'); return; }
      seen.cwd = params.cwd;
      seen.mcp = (params.mcpServers || []).map((s) => s.name);
      seen.mcpTyped = (params.mcpServers || []).every((s) => s.type === 'stdio');
      office = officeFromEnv((params.mcpServers || []).find((s) => s.name === 'office')?.env);
      reply(id, V2
        ? { sessionId: SESSION_ID, configOptions: [{ configId: 'model', name: 'Model', category: 'model', type: 'select', currentValue: 'fake-large',
          options: [{ value: 'fake-large', name: 'Fake Large' }, { value: 'fake-small', name: 'Fake Small' }] }] }
        : { sessionId: SESSION_ID,
          modes: { currentModeId: 'default', availableModes: [{ id: 'default', name: 'Default' }, { id: 'yolo', name: 'YOLO' }] },
          models: { currentModelId: 'fake-large', availableModels: [{ modelId: 'fake-large', name: 'Fake Large' }, { modelId: 'fake-small', name: 'Fake Small' }] } });
      return;
    case 'session/set_model':
      if (!['fake-large', 'fake-small'].includes(params.modelId)) { fail(id, -32602, 'unknown model'); return; }
      reply(id, {});
      return;
    case 'session/set_config_option':
      if (!['fake-large', 'fake-small'].includes(params.value)) { fail(id, -32602, 'unknown model'); return; }
      reply(id, { configOptions: [] });
      return;
    case 'session/set_mode':
      reply(id, {});
      update({ sessionUpdate: 'current_mode_update', currentModeId: params.modeId });
      return;
    case 'session/prompt': {
      seen.prompts += 1;
      const text = (params.prompt || []).map((b) => b.text || '').join('');
      if (V2) reply(id, {});
      const { stopReason, error } = await runTurn(text);
      if (V2) {
        update({ sessionUpdate: 'state_update', state: 'idle', ...(error ? { error: { code: -32603, message: error } } : { stopReason }) });
      } else if (error) fail(id, -32603, error);
      else reply(id, { stopReason });
      return;
    }
    case 'session/cancel':
      seen.cancelHadId = id !== undefined;
      if (turn) turn.cancelled = true;
      return;
    default:
      if (id !== undefined) fail(id, -32601, `method not found: ${method}`);
  }
});
