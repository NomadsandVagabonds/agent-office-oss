#!/usr/bin/env node
// Test fixture — Claude Code's stream-json mode from Claude's side:
//
//   claude --print --input-format stream-json --output-format stream-json …
//
// one JSON object per line each way, control requests and their answers on
// the same stream as the messages of a turn. Written from the type definitions
// Anthropic publishes with @anthropic-ai/claude-agent-sdk 0.3.321 (sdk.d.ts,
// sdk-tools.d.ts), the CLI's own --help (2.1.325) and the frames T3 Code
// recorded from real runs (see docs/HARNESS.md §7.5 for the pointers) — not
// recorded from a real Claude. What each turn does is scripted by the prompt
// text: see fake-lib.mjs, and the steps only this fake knows, below.
//
//   node fake-claude.mjs <claude's own flags>   as the office starts it
//   --fake-old          a Claude too old to know get_usage, to name the message a result answers,
//                       or to say why a turn ended
//   --fake-no-partials  never streams: every block arrives whole (as without --include-partial-messages)
//   --fake-refuse-mcp   cannot start the MCP servers it is handed
//   --fake-root         refuses its bypass mode the way Claude does as root (stderr, exit 1)
//   --fake-bad-config   will not start, and says why in a result frame
//   --fake-sticky       refuses to be put in a more careful permission mode
//   --fake-stubborn     says yes to a change of permission mode and stays where it is
//
// Steps of its own (a step fake-lib does not know arrives as text; these are picked out of that):
//   write:path  run:cmd    a file write / a command that asks or not BY CLAUDE'S OWN MODE, as the real one would
//   sub:cmd                a sub-agent that runs a command        planmode:text   leave plan mode with this plan
//   fetch:url              a web fetch (asks)                     mcptool:name    a call to one of the office's tools (asks)
//   hook:Event             run the office's Claude hook script, as Claude Code runs its hooks
//   wake:text              after this turn, start one of its own (a background task reporting back)
//   withdraw:cmd           ask about a command, then stop waiting for the answer by itself (control_cancel_request)
//   retry  compact  local:text  denied:Tool  authfail  elicit  hookcb  dup      smaller things the stream can say
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLines, sleep, parseScript, scriptIn, officeCall, officeFromEnv, mcpCall } from './fake-lib.mjs';

const argv = process.argv.slice(2);
const fake = (name) => argv.includes(`--fake-${name}`);
const OLD = fake('old'), NO_PARTIALS = fake('no-partials'), REFUSE_MCP = fake('refuse-mcp'), ROOT = fake('root'),
  BAD_CONFIG = fake('bad-config'), STICKY = fake('sticky'), STUBBORN = fake('stubborn');
const claudeArgs = argv.filter((a) => !a.startsWith('--fake-'));
const flag = (name) => claudeArgs.includes(name);
const value = (name) => {
  const at = claudeArgs.indexOf(name);
  if (at !== -1) return claudeArgs[at + 1];
  const joined = claudeArgs.find((a) => a.startsWith(`${name}=`));
  return joined ? joined.slice(name.length + 1) : undefined;
};

const MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const DEFAULT_MODEL = 'claude-fake-sonnet-1';
const ALIASES = { default: DEFAULT_MODEL, 'fake-sonnet': 'claude-fake-sonnet-1', 'fake-opus': 'claude-fake-opus-1' };
const RESET_AT = 1_900_000_000;                 // epoch SECONDS, as the stream reports them
const ROOT_REFUSAL = '--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'office-hook.sh');

const send = (frame) => process.stdout.write(JSON.stringify(frame) + '\n');
const die = (message, code = 1) => { process.stderr.write(message + '\n'); process.exit(code); };

/* ---- starting: the checks the real CLI makes on its own command line ---------- */

const requested = value('--permission-mode') === 'manual' ? 'default' : (value('--permission-mode') || 'default');
if (value('--input-format') === 'stream-json' && value('--output-format') !== 'stream-json') die('Error: --input-format=stream-json requires output-format=stream-json.');
if (value('--input-format') === 'stream-json' && !flag('--print') && !flag('-p')) die('Error: --input-format=stream-json requires --print.');
if (!MODES.includes(requested)) die(`error: option '--permission-mode <mode>' argument '${requested}' is invalid. Allowed choices are acceptEdits, auto, bypassPermissions, manual, dontAsk, plan.`);
if (value('--session-id') !== undefined && !UUID.test(value('--session-id'))) die('Error: Invalid session ID. Must be a valid UUID.');
if (value('--effort') !== undefined && !EFFORTS.includes(value('--effort'))) die(`error: option '--effort <level>' argument '${value('--effort')}' is invalid. Allowed choices are ${EFFORTS.join(', ')}.`);
if (ROOT && (requested === 'bypassPermissions' || flag('--allow-dangerously-skip-permissions') || flag('--dangerously-skip-permissions'))) die(ROOT_REFUSAL);

const state = {
  sessionId: value('--session-id') || crypto.randomUUID(),
  cwd: process.cwd(),
  mode: requested,
  prePlanMode: undefined,
  bypassAvailable: flag('--allow-dangerously-skip-permissions') || flag('--dangerously-skip-permissions') || requested === 'bypassPermissions',
  model: ALIASES[value('--model')] || value('--model') || DEFAULT_MODEL,
  effort: value('--effort') || '',
  asksHost: value('--permission-prompt-tool') === 'stdio',
  partials: flag('--include-partial-messages') && !NO_PARTIALS,
  context: { used: 1000, size: 200_000 },
  cost: 0,
  results: 0,
};
const seen = { args: claudeArgs, initialize: null, mcp: [], turns: 0, framed: 0, handoffs: 0, tasks: 0, interrupts: 0, usageAsked: 0, usageParams: undefined,
  modeRequests: [], modelRequests: [], settingsRequests: [], cancelsFromHost: 0, strayAnswers: 0, firstUser: null, lastAnswer: null };
let office = null;
let officeMcp = null;                    // the office's MCP server entry, exactly as it was handed over
let turn = null;                         // { uuid, cancelled, ignoreCancel, pending, message, lastText, wake }
let requestSeq = 0, messageSeq = 0, toolSeq = 0, lastDelegation = '';
const waiting = new Map();               // our control request id → resolve(response payload | { cancelled })
let lastAssistant = null;

const emit = (frame) => send({ ...frame, session_id: state.sessionId, uuid: crypto.randomUUID() });

if (BAD_CONFIG) {
  // A known start-up failure, as a stream-json run reports it: one zeroed result that names the reason, then the exit.
  emit({ type: 'result', subtype: 'error_during_execution', is_error: true, duration_ms: 0, duration_api_ms: 0, num_turns: 0, stop_reason: null,
    total_cost_usd: 0, usage: {}, modelUsage: {}, permission_denials: [], startup_failure_reason: 'config_file_invalid',
    errors: ['The configuration file ~/.claude.json is not valid JSON. Restore it from its backup, then start again.'] });
  process.exit(1);
}

/* ---- the control channel ------------------------------------------------------- */

const respond = (id, response) => send({ type: 'control_response', response: { subtype: 'success', request_id: id, response } });
const refuse = (id, error) => send({ type: 'control_response', response: { subtype: 'error', request_id: id, error } });

// A request of our own (may I use this tool?), and the wait for its answer.
function ask(request) {
  return new Promise((resolve) => {
    const id = `req_${++requestSeq}`;
    waiting.set(id, resolve);
    if (turn) turn.pending = id;
    send({ type: 'control_request', request_id: id, request });
  });
}

function setMode(next) {
  if (next === 'plan' && state.mode !== 'plan') state.prePlanMode = state.mode;
  if (next !== 'plan') state.prePlanMode = undefined;
  state.mode = next;
  emit({ type: 'system', subtype: 'status', status: null, permissionMode: next });
}

function control(id, request) {
  switch (request.subtype) {
    case 'initialize':
      seen.initialize = request;
      respond(id, {
        commands: [], agents: [], output_style: 'default', available_output_styles: ['default'],
        models: [
          { value: 'default', resolvedModel: DEFAULT_MODEL, displayName: 'Default (recommended)', description: 'The fake default', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high'] },
          { value: 'fake-sonnet', resolvedModel: 'claude-fake-sonnet-1', displayName: 'Fake Sonnet', description: 'Quick', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high'] },
          { value: 'fake-opus', resolvedModel: 'claude-fake-opus-1', displayName: 'Fake Opus', description: 'Thorough', supportsEffort: true, supportedEffortLevels: ['low', 'medium', 'high', 'max'] },
        ],
        // The real answer carries the account's e-mail address too; the office must not keep it.
        account: { email: 'someone@example.com', organization: 'Example Org', subscriptionType: 'max', tokenSource: 'claude.ai', apiProvider: 'firstParty' },
        ...(OLD ? {} : { claude_code_version: '9.9.9-fake' }),
        pending_permission_requests: [],
      });
      return;
    case 'mcp_set_servers': {
      const servers = request.servers || {};
      seen.mcp = Object.keys(servers);
      if (REFUSE_MCP) { respond(id, { added: [], removed: [], errors: Object.fromEntries(seen.mcp.map((name) => [name, `spawn failed for ${JSON.stringify(servers[name])}`])) }); return; }
      officeMcp = servers.office || null;
      office = officeFromEnv(officeMcp?.env);
      respond(id, { added: seen.mcp, removed: [], errors: {} });
      return;
    }
    case 'get_usage':
      if (OLD) { refuse(id, 'Unsupported control request subtype: get_usage'); return; }
      seen.usageAsked += 1;
      seen.usageParams = { skip_behaviors: request.skip_behaviors };
      respond(id, {
        session: { total_cost_usd: 0, total_api_duration_ms: 0, total_duration_ms: 0, total_lines_added: 0, total_lines_removed: 0, model_usage: {} },
        subscription_type: 'max', rate_limits_available: true,
        rate_limits: {
          five_hour: { utilization: 42, resets_at: new Date(RESET_AT * 1000).toISOString() },
          seven_day: { utilization: 71.5, resets_at: new Date((RESET_AT + 86400) * 1000).toISOString() },
          seven_day_opus: { utilization: 99, resets_at: null },
          extra_usage: null,
        },
        behaviors: null,
      });
      return;
    case 'set_permission_mode': {
      seen.modeRequests.push(request.mode);
      const next = request.mode === 'manual' ? 'default' : request.mode;
      const reach = { plan: 0, default: 1, dontAsk: 1, acceptEdits: 2, auto: 3, bypassPermissions: 4 };
      if (!MODES.includes(next)) { refuse(id, `Cannot set permission mode: must be one of ${MODES.join(', ')}`); return; }
      if (next === 'bypassPermissions' && !state.bypassAvailable) {
        refuse(id, 'Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions');
        return;
      }
      if (STICKY && reach[next] < reach[state.mode]) { refuse(id, 'set_permission_mode failed'); return; }
      if (STUBBORN) { respond(id, { mode: state.mode }); return; }
      setMode(next);
      respond(id, { mode: next });
      return;
    }
    case 'set_model': {
      seen.modelRequests.push(request.model);
      if (request.model != null && typeof request.model !== 'string') { refuse(id, 'set_model: model must be a string'); return; }
      if (request.model === 'no-such-model') { refuse(id, 'set_model: the model "no-such-model" is not available to this account'); return; }
      state.model = request.model == null ? DEFAULT_MODEL : (ALIASES[request.model] || request.model);
      respond(id, { model: state.model });
      return;
    }
    case 'apply_flag_settings': {
      seen.settingsRequests.push(request.settings);
      const level = request.settings?.effortLevel;
      if (level !== undefined && level !== null && !EFFORTS.includes(level)) { refuse(id, 'apply_flag_settings: effortLevel is not a level this session knows'); return; }
      if (level !== undefined) state.effort = level || '';
      respond(id, {});
      return;
    }
    case 'interrupt':
      seen.interrupts += 1;
      respond(id, OLD ? {} : { still_queued: [] });
      if (turn && !turn.ignoreCancel) {
        turn.cancelled = true;
        // What it was waiting on is withdrawn: Claude tells the host it no longer wants that answer.
        if (turn.pending && waiting.has(turn.pending)) {
          const pending = turn.pending;
          turn.during = 'tools';
          send({ type: 'control_cancel_request', request_id: pending });
          waiting.get(pending)({ cancelled: true });
          waiting.delete(pending);
        }
      }
      return;
    default:
      refuse(id, `Unsupported control request subtype: ${request.subtype}`);
  }
}

/* ---- one reply, block by block, as the Messages API streams it -------------------- */

const stream = (event) => { if (state.partials) emit({ type: 'stream_event', event, parent_tool_use_id: null }); };

function usageNow(output) {
  return { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: Math.max(0, state.context.used - 10), output_tokens: output };
}

function openMessage() {
  if (turn.message) return turn.message;
  emit({ type: 'system', subtype: 'status', status: 'requesting' });
  const message = turn.message = { id: `msg_fake_${++messageSeq}`, index: 0, output: 0 };
  stream({ type: 'message_start', message: { model: state.model, id: message.id, type: 'message', role: 'assistant', content: [], stop_reason: null, stop_sequence: null,
    usage: usageNow(1) } });
  return message;
}

function snapshot(message, block, extra = {}) {
  lastAssistant = { type: 'assistant', message: { model: state.model, id: message.id, type: 'message', role: 'assistant', content: [block], stop_reason: null, stop_sequence: null,
    usage: usageNow(1) }, parent_tool_use_id: null, session_id: state.sessionId, uuid: crypto.randomUUID(), ...extra };
  send(lastAssistant);
}

function closeMessage(stopReason) {
  const message = turn.message;
  if (!message) return;
  turn.message = null;
  // The closing event repeats the output count and may leave the input counts out.
  stream({ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: message.output } });
  stream({ type: 'message_stop' });
}

async function words(kind, content) {
  const message = openMessage();
  const index = message.index++;
  const field = kind === 'text' ? 'text' : 'thinking';
  stream({ type: 'content_block_start', index, content_block: kind === 'text' ? { type: 'text', text: '' } : { type: 'thinking', thinking: '', signature: '' } });
  const mid = Math.ceil(content.length / 2);
  stream({ type: 'content_block_delta', index, delta: { type: `${field}_delta`, [field]: content.slice(0, mid) } });
  await sleep(5);
  if (content.slice(mid)) stream({ type: 'content_block_delta', index, delta: { type: `${field}_delta`, [field]: content.slice(mid) } });
  // The finished block arrives as a message of its own, before the block is closed in the stream.
  snapshot(message, kind === 'text' ? { type: 'text', text: content } : { type: 'thinking', thinking: content, signature: 'sig' });
  stream({ type: 'content_block_stop', index });
  message.output += content.length;
  if (kind === 'text') turn.lastText = content;
}
const say = (content) => words('text', content);

/** Announce a tool call (its block streams, then arrives whole) and return its id. */
function callTool(name, input, extra = {}) {
  const message = openMessage();
  const index = message.index++;
  const id = `toolu_fake_${++toolSeq}`;
  stream({ type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } } });
  stream({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } });
  snapshot(message, { type: 'tool_use', id, name, input, caller: { type: 'direct' } }, extra);
  stream({ type: 'content_block_stop', index });
  return id;
}

function toolResult(id, content, isError = false, extra = {}) {
  emit({ type: 'user', message: { role: 'user', content: [{ tool_use_id: id, type: 'tool_result', content, is_error: isError }] }, parent_tool_use_id: null,
    timestamp: new Date().toISOString(), ...extra });
  closeMessage('tool_use');
}

// Does Claude's own mode let this through without asking anybody? What the real permission engine decides.
function ownVerdict(kind, inside) {
  switch (state.mode) {
    case 'bypassPermissions': case 'auto': return 'allow';
    case 'acceptEdits': return kind === 'edit' && inside ? 'allow' : 'ask';
    case 'dontAsk': return 'deny';
    default: return 'ask';
  }
}

/** One tool call from announcement to result. `verdict` is 'allow', 'ask' or 'deny'. Returns what was decided. */
async function useTool(name, input, verdict, { request = {}, output = 'ok', failed = false } = {}) {
  const id = callTool(name, input);
  let decision = { behavior: 'allow' };
  if (verdict === 'deny' || (verdict === 'ask' && !state.asksHost)) {
    // Nobody to ask: Claude refuses by itself and says so.
    emit({ type: 'system', subtype: 'permission_denied', tool_name: name, tool_use_id: id, decision_reason_type: 'mode', message: `Permission to use ${name} has been denied.` });
    decision = { behavior: 'deny', message: `Permission to use ${name} has been denied.`, self: true };
  } else if (verdict === 'ask') {
    const answer = await ask({ subtype: 'can_use_tool', tool_name: name, input, tool_use_id: id, display_name: name, ...request });
    if (turn) turn.pending = null;
    seen.lastAnswer = answer;
    decision = answer.cancelled ? { behavior: 'deny', cancelled: true } : answer;
  }
  // Withdrawn, or refused with "and stop": the turn ends here, in the middle of a tool call.
  if (decision.cancelled || decision.interrupt) { if (turn) { turn.cancelled = true; turn.during = 'tools'; } closeMessage('tool_use'); return { ...decision, stopped: true }; }
  if (decision.behavior === 'allow') toolResult(id, output, failed);
  else toolResult(id, decision.message || 'denied', true, { tool_use_result: `Error: ${decision.message || 'denied'}` });
  return decision;
}

const inside = (target) => { const rel = path.relative(state.cwd, path.resolve(state.cwd, target)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/* ---- a turn ---------------------------------------------------------------------- */

const EXTRA = new Set(['write', 'run', 'sub', 'planmode', 'fetch', 'mcptool', 'hook', 'wake', 'withdraw', 'retry', 'compact', 'local', 'denied', 'authfail', 'elicit', 'hookcb', 'dup']);
function steps(promptText) {
  return parseScript(scriptIn(promptText)).map((step) => {
    // A step fake-lib does not know comes back as something to say; pick this fake's own steps out of those.
    const own = step.verb === 'say' ? /^([a-z-]+)(?::([\s\S]*))?$/.exec(step.arg) : null;
    return own && EXTRA.has(own[1]) ? { verb: own[1], arg: (own[2] || '').trim() } : step;
  });
}

function result(fields) {
  state.cost += 0.01;
  const base = { type: 'result', duration_ms: 20, duration_api_ms: 10, num_turns: 1, total_cost_usd: Math.round(state.cost * 100) / 100,
    usage: { input_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 5 },
    // Every model that was called is counted here, the small helper ones too; each with the window it has.
    modelUsage: {
      'claude-fake-helper-1': { inputTokens: 900, outputTokens: 10, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, webSearchRequests: 0, costUSD: 0.001, contextWindow: 50_000, maxOutputTokens: 8000 },
      [state.model]: { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: state.context.used, cacheCreationInputTokens: 0, webSearchRequests: 0, costUSD: state.cost, contextWindow: state.context.size, maxOutputTokens: 32000 },
    },
    permission_denials: [], result_index: state.results++ };
  emit({ ...base, ...fields });
}

async function runTurn(uuid, promptText) {
  const mine = turn = { uuid, cancelled: false, ignoreCancel: false, pending: null, during: '', message: null, lastText: '', wake: '' };
  emit({ type: 'system', subtype: 'init', cwd: state.cwd, tools: ['Agent', 'AskUserQuestion', 'Bash', 'Edit', 'Read', 'Write', 'TodoWrite', 'WebFetch'],
    mcp_servers: seen.mcp.map((name) => ({ name, status: REFUSE_MCP ? 'failed' : 'connected', source: 'dynamic' })), model: state.model, permissionMode: state.mode,
    slash_commands: [], apiKeySource: 'none', claude_code_version: '9.9.9-fake', output_style: 'default', agents: [], skills: [], plugins: [],
    capabilities: OLD ? undefined : ['interrupt_receipt_v1'] });
  let ending = { subtype: 'success', is_error: false, api_error_status: null, stop_reason: 'end_turn', terminal_reason: 'completed' };
  for (const { verb, arg } of steps(promptText)) {
    if (mine.cancelled && !mine.ignoreCancel) break;
    let failed = false;
    switch (verb) {
      case 'say': await say(arg); break;
      case 'think': await words('thinking', arg); break;
      case 'tool': await useTool('Bash', { command: arg || 'true' }, 'allow', { output: `ran: ${arg || 'true'}\nok`, }); break;
      case 'read': await useTool('Read', { file_path: arg }, 'allow', { output: `1\tcontents of ${arg}` }); break;
      case 'edit':
        await useTool('Edit', { file_path: arg, old_string: 'a', new_string: 'b', replace_all: false }, 'allow',
          { output: [{ type: 'text', text: `The file ${arg} has been updated.` }] });
        break;
      case 'plan':
        await useTool('TodoWrite', { todos: arg.split('|').map((content, i) => ({ content, status: i === 0 ? 'in_progress' : 'pending', activeForm: `Doing ${content}` })) },
          'allow', { output: 'Todos have been modified successfully.' });
        break;
      case 'ask': {
        // Asks whatever mode it is in, as a rule in the operator's settings would make it.
        const d = await useTool('Bash', { command: arg || 'true' }, 'ask', { output: `ran: ${arg || 'true'}`,
          request: { decision_reason: '\u001b[33mThis command requires approval\u001b[0m', title: `Claude wants to run ${arg}`, description: arg,
            permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: arg }], behavior: 'allow', destination: 'localSettings' }] } });
        if (!d.stopped) await say(`decision=${d.behavior}${d.updatedPermissions ? '+rules' : ''}${d.behavior === 'allow' && JSON.stringify(d.updatedInput) !== JSON.stringify({ command: arg || 'true' }) ? '+changed' : ''}`);
        break;
      }
      case 'askfile': {
        const target = path.resolve(state.cwd, arg || 'file.txt');
        const d = await useTool('Write', { file_path: arg || 'file.txt', content: 'x' }, 'ask', { output: `File created at ${arg}`,
          request: { ...(inside(arg || 'file.txt') ? {} : { blocked_path: target, decision_reason_type: 'workingDir' }),
            permission_suggestions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }] } });
        if (!d.stopped) await say(`decision=${d.behavior}`);
        break;
      }
      case 'write': {
        const d = await useTool('Write', { file_path: arg, content: 'x' }, ownVerdict('edit', inside(arg)), { output: `File created at ${arg}`,
          request: inside(arg) ? {} : { blocked_path: path.resolve(state.cwd, arg) } });
        if (!d.stopped) await say(`write=${d.behavior}${d.self ? ' (by itself)' : ''} in ${state.mode}`);
        break;
      }
      case 'run': {
        const d = await useTool('Bash', { command: arg, description: 'A command with a description' }, ownVerdict('execute', true), { output: `ran: ${arg}` });
        if (!d.stopped) await say(`run=${d.behavior}${d.self ? ' (by itself)' : ''} in ${state.mode}`);
        break;
      }
      case 'fetch': {
        const d = await useTool('WebFetch', { url: arg, prompt: 'What does it say?' }, 'ask', { output: 'It says hello.' });
        if (!d.stopped) await say(`fetch=${d.behavior}`);
        break;
      }
      case 'mcptool': {
        const d = await useTool(`mcp__office__${arg}`, {}, 'ask', { output: '{"ok":true}', request: { mcp_server: { name: 'office', source: 'dynamic' } } });
        if (!d.stopped) await say(`mcptool=${d.behavior}`);
        break;
      }
      case 'question': {
        const asked = (arg || 'Which one?').split('|').map((question, i) => ({ question, header: i === 0 ? 'Choose' : `Then ${i + 1}`, multiSelect: false,
          options: [{ label: 'v3', description: 'old' }, { label: 'v4', description: 'new' }] }));
        const id = callTool('AskUserQuestion', { questions: asked });
        const answer = await ask({ subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: { questions: asked }, tool_use_id: id, requires_user_interaction: true });
        mine.pending = null;
        seen.lastAnswer = answer;
        if (answer.cancelled || answer.interrupt) { mine.cancelled = true; mine.during = 'tools'; closeMessage('tool_use'); break; }
        const answers = answer.behavior === 'allow' ? asked.map((q) => answer.updatedInput?.answers?.[q.question] ?? '') : [];
        toolResult(id, answer.behavior === 'allow' ? `User has answered: ${answers.join(', ')}` : (answer.message || 'declined'), answer.behavior !== 'allow');
        await say(`answer=${answers.join(',')}`);
        break;
      }
      case 'planmode': {
        const d = await useTool('ExitPlanMode', { plan: arg || 'Do the thing.' }, 'ask', { output: 'User has approved your plan.' });
        if (d.behavior === 'allow' && !d.stopped) setMode(state.prePlanMode || 'default');
        if (!d.stopped) await say(`plan=${d.behavior} now ${state.mode}`);
        break;
      }
      case 'sub': {
        const agent = callTool('Agent', { description: 'Look into it', prompt: `Run ${arg}`, subagent_type: 'general-purpose' });
        emit({ type: 'system', subtype: 'task_started', task_id: 'a1b2c3', tool_use_id: agent, description: 'Look into it', task_type: 'local_agent', subagent_type: 'general-purpose' });
        // The sub-agent's frames name the call that started it. Its words are its own; its tool calls are work in this folder.
        const child = `toolu_fake_${++toolSeq}`;
        emit({ type: 'assistant', parent_tool_use_id: agent, subagent_type: 'general-purpose',
          message: { model: 'claude-fake-helper-1', id: `msg_sub_${toolSeq}`, type: 'message', role: 'assistant', stop_reason: null,
            content: [{ type: 'text', text: 'the sub-agent talking to itself' }, { type: 'tool_use', id: child, name: 'Bash', input: { command: arg }, caller: { type: 'direct' } }] } });
        emit({ type: 'user', parent_tool_use_id: agent, subagent_type: 'general-purpose',
          message: { role: 'user', content: [{ tool_use_id: child, type: 'tool_result', content: `sub ran: ${arg}`, is_error: false }] } });
        emit({ type: 'system', subtype: 'task_notification', task_id: 'a1b2c3', tool_use_id: agent, status: 'completed', output_file: '/tmp/x', summary: 'done' });
        toolResult(agent, [{ type: 'text', text: 'The sub-agent reports: done.' }]);
        break;
      }
      case 'usage': {
        // What the next request carries in, and the window it is measured against (which only a result names).
        const [used, size] = arg.split('/').map(Number);
        closeMessage('end_turn');
        state.context = { used, size: size || state.context.size };
        openMessage();
        break;
      }
      case 'limits': {
        // The plan's allowance as the stream reports it: a fraction used, a reset in epoch seconds.
        const info = { status: 'allowed' };
        if (arg === 'rejected') Object.assign(info, { status: 'rejected', rateLimitType: 'five_hour', utilization: 1, resetsAt: RESET_AT, overageStatus: 'rejected', isUsingOverage: false });
        else if (arg.startsWith('opus:')) Object.assign(info, { rateLimitType: 'seven_day_opus', utilization: Number(arg.slice(5)) / 100, resetsAt: RESET_AT });
        else if (arg.includes('/') && !OLD) {
          const [five, seven] = arg.split('/').map((v) => (v === '' ? NaN : Number(v)));
          info.unifiedWindows = { ...(Number.isFinite(five) ? { five_hour: { utilization: five / 100, resetsAt: RESET_AT } } : {}),
            ...(Number.isFinite(seven) ? { seven_day: { utilization: seven / 100, resetsAt: RESET_AT + 86400 } } : {}) };
        } else Object.assign(info, { status: 'allowed_warning', rateLimitType: 'five_hour', utilization: Number(arg.split('/')[0]) / 100, resetsAt: RESET_AT });
        emit({ type: 'rate_limit_event', rate_limit_info: info });
        break;
      }
      case 'mode': setMode(arg); break;                     // Claude switching its own mode, unasked
      case 'retry': emit({ type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 10, retry_delay_ms: 500, error_status: 529, error: 'overloaded' }); break;
      case 'compact':
        // Between two requests: the conversation is summarised, and the next request carries the summary in.
        closeMessage('end_turn');
        emit({ type: 'system', subtype: 'status', status: 'compacting' });
        emit({ type: 'system', subtype: 'compact_boundary', compact_metadata: { trigger: 'auto', pre_tokens: state.context.used, post_tokens: 1200 } });
        emit({ type: 'system', subtype: 'status', status: null, compact_result: 'success' });
        state.context.used = 1200;
        break;
      case 'local': emit({ type: 'system', subtype: 'local_command_output', content: arg }); break;
      case 'denied': emit({ type: 'system', subtype: 'permission_denied', tool_name: arg || 'Bash', tool_use_id: 'toolu_none', message: 'A deny rule matches this call.' }); break;
      case 'withdraw': {
        // Claude stops waiting by itself — a hook of its own decided first, say — and tells the host so.
        const id = callTool('Bash', { command: arg || 'true' });
        const asking = ask({ subtype: 'can_use_tool', tool_name: 'Bash', input: { command: arg || 'true' }, tool_use_id: id });
        const mineId = mine.pending;
        await sleep(300);
        if (!waiting.has(mineId)) { await asking; mine.pending = null; toolResult(id, 'answered before it could be withdrawn'); break; }
        waiting.delete(mineId);
        mine.pending = null;
        send({ type: 'control_cancel_request', request_id: mineId });
        toolResult(id, 'ran: decided by a hook');
        await say('withdrawn');
        break;
      }
      case 'elicit': {
        const answer = await ask({ subtype: 'elicitation', mcp_server_name: 'some-server', message: 'Your name?', mode: 'form', requested_schema: {} });
        mine.pending = null;
        await say(`elicit=${answer.action}`);
        break;
      }
      case 'hookcb': {
        // Something the host never registered: it has to say no, not leave us waiting.
        const answer = await ask({ subtype: 'hook_callback', callback_id: 'hook_0', input: {} });
        mine.pending = null;
        await say(`unknown=${answer.error || 'answered'}`);
        break;
      }
      case 'dup': if (lastAssistant) send(lastAssistant); break;      // the same frame, delivered twice
      case 'hook': {
        // What Claude Code does with a hook it has installed: run the command, with its own environment, the event on stdin.
        const code = await new Promise((resolve) => {
          const child = spawn('sh', [HOOK], { env: process.env, stdio: ['pipe', 'ignore', 'ignore'] });
          child.on('error', () => resolve('unavailable'));
          child.on('exit', (c) => resolve(c));
          child.stdin.on('error', () => {});
          child.stdin.end(JSON.stringify({ session_id: state.sessionId, cwd: state.cwd, hook_event_name: arg || 'SessionStart' }));
        });
        await sleep(400);                                    // the script posts in the background and does not wait
        await say(`hook=${code}`);
        break;
      }
      case 'sleep': { const until = Date.now() + (Number(arg) || 50); while (Date.now() < until && !(mine.cancelled && !mine.ignoreCancel)) await sleep(10); break; }
      case 'slow': {
        const message = openMessage();
        const index = message.index++;
        stream({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
        while (!mine.cancelled || mine.ignoreCancel) { stream({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: '.' } }); await sleep(25); }
        break;
      }
      case 'ignore-cancel': mine.ignoreCancel = true; break;
      case 'crash':
        process.stderr.write('warming up\nError: the fake claude was told to crash\n    at fake (fake.js:1:1)\n');
        await sleep(20);
        process.exit(Number(arg) || 3);
        break;
      case 'garbage': process.stdout.write('{"type":"assistant","message":{oops\n'); break;
      case 'noise': process.stdout.write('[STARTUP] something a plugin printed to stdout\n'); break;
      case 'report': await say(JSON.stringify({ ...seen, mode: state.mode, model: state.model, effort: state.effort, sessionId: state.sessionId,
        envToken: !!office?.token && process.env.OFFICE_SESSION_TOKEN === office.token, launchedBy: process.env.OFFICE_RUNTIME_SESSION_ID || '', argvHasToken: !!office?.token && argv.join(' ').includes(office.token),
        office: { url: !!office?.url, agentId: office?.agentId || '', token: !!office?.token } })); break;
      case 'leak': await say(`my token is ${office?.token}`); await useTool('Bash', { command: `curl -H "x-office-session: ${office?.token}" localhost` }, 'allow'); break;
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
        const parts = arg.split('|');
        const to = parts.shift().trim();
        const extra = parts.length > 1 && parts[parts.length - 1].trim().startsWith('{') ? JSON.parse(parts.pop()) : {};
        const r = await officeCall(office, 'POST', '/api/delegations', { ...(to && to !== '-' ? { to } : {}), task: parts.join('|').trim(), ...extra });
        lastDelegation = r.data?.delegation?.id || lastDelegation;
        await say(`delegate=${r.status}:${r.data?.delegation?.id || r.data?.error || ''}`);
        break;
      }
      case 'http': {
        const [method, url, ...json] = arg.replaceAll('$DG', lastDelegation).split(' ');
        const r = await officeCall(office, method, url, json.length ? JSON.parse(json.join(' ')) : undefined);
        await say(`http=${r.status}:${JSON.stringify(r.data).slice(0, 600)}`);
        break;
      }
      case 'mcp': {
        // Start the MCP server the office handed over, as Claude would, and call one of its tools.
        const space = arg.indexOf(' ');
        await say(await mcpCall(officeMcp, space === -1 ? arg : arg.slice(0, space), space === -1 ? {} : JSON.parse(arg.slice(space + 1))));
        break;
      }
      case 'wake': mine.wake = arg || 'the background task finished'; break;
      case 'authfail':
        // How a failed login looks: the error as a message from nobody, then a "successful" result that is an error.
        closeMessage('end_turn');
        emit({ type: 'assistant', error: 'authentication_failed', parent_tool_use_id: null, message: { id: crypto.randomUUID(), model: '<synthetic>', role: 'assistant', type: 'message',
          stop_reason: 'stop_sequence', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          content: [{ type: 'text', text: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' }] } });
        ending = { subtype: 'success', is_error: true, api_error_status: 401, stop_reason: 'stop_sequence', terminal_reason: 'completed',
          result: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' };
        failed = true;
        break;
      case 'stop':
        if (arg === 'max_turns') ending = { subtype: 'error_max_turns', is_error: true, stop_reason: null, errors: ['Reached maximum number of turns (1)'], terminal_reason: 'max_turns' };
        else ending = { ...ending, stop_reason: arg || 'end_turn' };
        break;
      case 'error':
        ending = { subtype: 'error_during_execution', is_error: true, stop_reason: null, terminal_reason: 'model_error',
          errors: ['[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null', arg || 'the fake claude failed this turn'] };
        failed = true;
        break;
      default: break;
    }
    if (failed) break;
  }
  if (mine.ignoreCancel) await new Promise(() => {});          // never end: the office has to end us
  const aborted = mine.cancelled;
  closeMessage(aborted ? null : 'end_turn');
  turn = null;
  const echo = OLD ? {} : { user_message_uuid: uuid, user_message_uuids: [uuid] };
  if (aborted) {
    result({ subtype: 'error_during_execution', is_error: true, stop_reason: null, errors: ['[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null', 'Request interrupted by user'],
      ...(OLD ? {} : { terminal_reason: mine.during === 'tools' ? 'aborted_tools' : 'aborted_streaming' }), ...echo });
  } else {
    if (OLD) delete ending.terminal_reason;
    result({ ...(ending.subtype === 'success' ? { result: mine.lastText } : {}), ...ending, ...echo });
  }
  if (mine.wake) {
    // A turn of its own: a background task has reported back, Claude answers it, and nobody asked.
    await sleep(30);
    emit({ type: 'system', subtype: 'init', cwd: state.cwd, tools: [], mcp_servers: [], model: state.model, permissionMode: state.mode, slash_commands: [], apiKeySource: 'none',
      claude_code_version: '9.9.9-fake', output_style: 'default' });
    emit({ type: 'assistant', parent_tool_use_id: null, message: { model: state.model, id: `msg_wake_${++messageSeq}`, type: 'message', role: 'assistant', stop_reason: null,
      content: [{ type: 'text', text: mine.wake }], usage: usageNow(1) } });
    result({ subtype: 'success', is_error: false, api_error_status: null, stop_reason: 'end_turn', terminal_reason: 'completed', result: mine.wake,
      origin: { kind: 'task-notification' } });
  }
}

readLines(async (frame) => {
  switch (frame?.type) {
    case 'control_request':
      if (typeof frame.request_id === 'string' && frame.request && typeof frame.request === 'object') control(frame.request_id, frame.request);
      return;
    case 'control_response': {
      // The answer to one of our own requests.
      const id = frame.response?.request_id;
      const resolve = waiting.get(id);
      if (!resolve) { seen.strayAnswers += 1; return; }
      waiting.delete(id);
      resolve(frame.response.subtype === 'success' ? (frame.response.response || {}) : { error: frame.response.error });
      return;
    }
    case 'control_cancel_request': seen.cancelsFromHost += 1; return;
    case 'user': {
      if (turn) return;                                      // the office gives one turn at a time
      seen.turns += 1;
      const content = frame.message?.content;
      const said = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((b) => b.text || '').join('') : '');
      if (!seen.firstUser) seen.firstUser = { role: frame.message?.role, parent: frame.parent_tool_use_id, uuid: UUID.test(frame.uuid || ''), string: typeof content === 'string' };
      if (said.includes('<the_office>')) seen.framed += 1;
      if (said.includes('<handoff')) seen.handoffs += 1;
      if (said.includes('<delegated_task')) seen.tasks += 1;
      await runTurn(frame.uuid, said);
      return;
    }
    default:
  }
});
