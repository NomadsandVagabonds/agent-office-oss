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
//   dm:Name|text       send office mail          delegate:adapter|task
//   stop:max_tokens    end with that stop reason error:msg        fail the turn
// Anything that is not a step is said back as plain text, so a real-looking
// prompt ("please fix the tests") produces a real-looking turn.

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
  'crash', 'garbage', 'noise', 'report', 'dm', 'delegate', 'post', 'stop', 'error', 'http', 'read']);

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

/** A script may be wrapped in office framing (a mail delivery, a delegated task); find the script inside. */
export function scriptIn(prompt) {
  const marked = /\[\[script\]\]([\s\S]*?)\[\[\/script\]\]/.exec(String(prompt));
  return marked ? marked[1] : String(prompt);
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
