// Test fixture — what the fake agents share: a line reader for their stdin, a
// tiny scripting language for "what should this turn do", and a way to call
// the office over HTTP the way a real agent's office tools would.
//
// A turn's prompt is the script. Steps are separated by ";", each `verb:arg`:
//   say:hello          stream a reply            think:hmm        show reasoning
//   tool:ls -la        run a command             edit:src/a.js    change a file
//   ask:rm -rf build   ask permission, then run  plan:a|b|c       publish a plan
//   usage:1200/200000  report context use        sleep:200        wait (ms)
//   slow               stream until stopped      ignore-cancel    never honour a stop
//   crash:3            die with that exit code   garbage / noise  break / pollute stdout
//   report             say what the agent was told at start-up
//   dm:Name|text       send office mail          post:text        post in #all
//   delegate:adapter|task|{"extra":"fields"}     give another agent a task ("-" = let the office choose)
//   http:GET /api/...  call the office ($DG is the id of the last task delegated)
//   mcp:office_who {}  start the MCP server the office injected and call one of its tools
//   limits:80/40       (Codex) report the account's allowance: primary/secondary percent used
//   stop:max_tokens    end with that stop reason error:msg        fail the turn
//   mode:plan          (ACP) switch to one of its own modes, unasked
// Anything that is not a step is said back as plain text, so a real-looking
// prompt ("please fix the tests") produces a real-looking turn.

import { spawn } from 'node:child_process';

export function readLines(onLine) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      onLine(msg);
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VERBS = new Set(['say', 'think', 'tool', 'edit', 'ask', 'askfile', 'question', 'plan', 'usage', 'sleep', 'slow', 'ignore-cancel',
  'crash', 'garbage', 'noise', 'report', 'dm', 'delegate', 'post', 'stop', 'error', 'http', 'read', 'limits', 'mcp', 'leak', 'mode']);

/** "say:hi; tool:ls" → [{verb:'say',arg:'hi'},{verb:'tool',arg:'ls'}] */
export function parseScript(prompt) {
  const steps = [];
  for (const raw of String(prompt).split(';')) {
    const part = raw.trim();
    if (!part) continue;
    const colon = part.indexOf(':');
    const verb = (colon === -1 ? part : part.slice(0, colon)).trim().toLowerCase();
    if (VERBS.has(verb)) steps.push({ verb, arg: colon === -1 ? '' : part.slice(colon + 1).trim() });
    else steps.push({ verb: 'say', arg: part });
  }
  return steps;
}

/**
 * A script may arrive wrapped by the office: fenced in the first-turn framing
 * (<request>), inside a delegated task (<delegated_task>), or quoted in a mail
 * delivery (where [[script]]…[[/script]] marks it). Find the script inside.
 */
export function scriptIn(prompt) {
  let body = String(prompt);
  const marked = /\[\[script\]\]([\s\S]*?)\[\[\/script\]\]/.exec(body);
  if (marked) return marked[1];
  const framed = /<request>\n([\s\S]*)\n<\/request>/.exec(body);
  if (framed) body = framed[1];
  body = body.replace(/^<handoff [\s\S]*?<\/handoff>\s*/, '');      // context handed over is background, not the request
  const task = /<delegated_task [^>]*>\n([\s\S]*?)\n<\/delegated_task>/.exec(body);
  if (task) body = task[1];
  return body;
}

/** Call the office as this agent. `office` is { url, agentId, token } read from the injected MCP server's env. */
export async function officeCall(office, method, path, body) {
  if (!office?.url) return { status: 0, data: null };
  const res = await fetch(office.url + path, {
    method,
    headers: { 'content-type': 'application/json', ...(office.token ? { 'x-office-session': office.token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

/** Pull the office coordinates out of an MCP server entry's env (ACP array form or a plain object). */
export function officeFromEnv(env) {
  const map = Array.isArray(env) ? Object.fromEntries(env.map((e) => [e.name, e.value])) : (env || {});
  const url = map.OFFICE_URL || (map.OFFICE_PORT ? `http://127.0.0.1:${map.OFFICE_PORT}` : '');
  return { url, agentId: map.OFFICE_AGENT_ID || '', token: map.OFFICE_SESSION_TOKEN || '' };
}

/** Who wrote the first note in a mail delivery from the office ("[Name · where · time] text"). */
export function mailSender(prompt) {
  const m = /^\[([^·\]\n]+) · /m.exec(String(prompt));
  return m ? m[1].trim() : '';
}

/**
 * Do what a real agent does with an MCP server it was handed: start it with the
 * given command, args and env, shake hands, call one tool, return its text.
 * `entry` is the server exactly as the office passed it in session/new.
 */
export function mcpCall(entry, tool, args = {}) {
  return new Promise((resolve) => {
    if (!entry?.command) { resolve('no MCP server was given'); return; }
    const env = Array.isArray(entry.env) ? Object.fromEntries(entry.env.map((e) => [e.name, e.value])) : (entry.env || {});
    const child = spawn(entry.command, entry.args || [], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    const done = (text) => { try { child.kill(); } catch { /* gone */ } resolve(text); };
    const timer = setTimeout(() => done('the MCP server did not answer'), 20_000);
    const send = (msg) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    child.on('error', (err) => { clearTimeout(timer); done(`could not start the MCP server: ${err.message}`); });
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        let msg = null;
        try { msg = JSON.parse(buf.slice(0, i)); } catch { /* not ours */ }
        buf = buf.slice(i + 1);
        if (!msg) continue;
        if (msg.id === 1) send({ id: 2, method: 'tools/call', params: { name: tool, arguments: args } });
        if (msg.id === 2) { clearTimeout(timer); done(`${msg.result?.isError ? 'ERROR ' : ''}${msg.result?.content?.[0]?.text ?? JSON.stringify(msg.error)}`); }
      }
    });
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fake-agent', version: '1' } } });
  });
}
