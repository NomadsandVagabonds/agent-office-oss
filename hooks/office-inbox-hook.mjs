#!/usr/bin/env node
// The Office — auto-inbox hook. Pairs with `office inbox` (the manual read).
//
// The office can't push a message into a session it didn't spawn. But the
// session's OWN Claude Code hooks run. So: when the agent finishes a turn
// (Stop) or the human submits a prompt (UserPromptSubmit), this asks the
// office for NEW mail addressed to this exact session and surfaces it — so
// you just post in the office and the agent picks it up naturally, no "check
// your inbox" needed.
//
// The office keeps the read cursor (GET /api/inbox), so this hook, the CLI
// and the MCP tool all see each message exactly once between them.
//
// Hard safety rules (a hook must never harm a session):
//  - fail OPEN: office down / any error / slow → exit 0, normal stop.
//  - one-shot: the server-side cursor means each message surfaces once.
//  - no loop: respects `stop_hook_active`; never blocks twice in a row.
//  - no history dump: nothing from before you sat down counts as unread.
//  - tight timeouts: a fast no-op for the (common) no-mail case.
//  - interrupt-worthy only (mode=hook): direct mail, @mentions, replies from
//    the human, your project channel, and All Hands notes from humans.
//
// `--watch [seconds]` is the other half, and opt-in (install-inbox-hook.mjs
// --watch): the hooks above only run when the session does something, so an
// agent that has stopped is never told it has mail. Claude Code can run a
// command hook in the background and be woken by it (`asyncRewake`: when the
// command exits with code 2, what it wrote to stderr is shown to the agent,
// even if the session is idle). Run that way, this sits on the office's
// waiting inbox (GET /api/inbox/wait) for as long as it is given, and exits 2
// with the mail when some arrives. The office decides what may wake an agent
// (server/waiting.mjs: the same guard rails as for agents it drives), and a
// newer watcher of the same session takes the place of an older one.
const ok = () => process.exit(0);                 // allow normal stop / no-op
process.on('uncaughtException', ok);
process.on('unhandledRejection', ok);
const WATCH = (() => {
  const i = process.argv.indexOf('--watch');
  if (i < 0) return 0;
  const n = Number(process.argv[i + 1]);
  return Math.max(5, Math.min(86_400, Number.isFinite(n) && n > 0 ? n : 3600));
})();
setTimeout(ok, WATCH ? WATCH * 1000 + 3000 : 1500);   // absolute backstop

// A session the office drives itself (server/harness) has its mail delivered by
// the office, as a turn, behind guard rails a human set (opt-in, rates, a limit
// on agents waking agents). This hook pushing mail into the same session would
// go round all of them, so there it stays out of the way.
if (process.env.OFFICE_SESSION_TOKEN) ok();

const BASE = (process.env.OFFICE_URL || `http://localhost:${process.env.OFFICE_PORT || 4317}`).replace(/\/+$/, '');
const headers = process.env.OFFICE_TOKEN ? { authorization: `Bearer ${process.env.OFFICE_TOKEN}` } : {};

async function main() {
  let raw = '';
  for await (const c of process.stdin) raw += c;
  let ev = {};
  try { ev = JSON.parse(raw || '{}'); } catch { return ok(); }

  const sid = ev.session_id;
  const kind = ev.hook_event_name || ev.event || '';
  if (!sid) return ok();
  if (WATCH) return watch(sid);
  // Already continuing from a stop-hook injection → don't block again.
  if (kind === 'Stop' && ev.stop_hook_active) return ok();

  let box = null;
  try {
    const r = await fetch(`${BASE}/api/inbox?agent=${encodeURIComponent(sid)}&mode=hook&limit=20`,
      { headers, signal: AbortSignal.timeout(700) });
    if (!r.ok) return ok();                       // office down, or it does not know this session yet
    box = await r.json();
  } catch { return ok(); }
  const fresh = (box && Array.isArray(box.items)) ? box.items : [];
  if (!fresh.length) return ok();

  // Mark it read before we print: a message shown twice is worse than a rare miss,
  // and `office inbox --all` can always re-read history.
  try {
    await fetch(`${BASE}/api/inbox/ack`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ agent: sid, upTo: box.newest }), signal: AbortSignal.timeout(500),
    });
  } catch { return ok(); }

  const body = letter(fresh, 'came in while you were working');

  if (kind === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: body }));
    return process.exit(0);
  }
  // UserPromptSubmit (or anything else): add as context, never block.
  process.stdout.write(body + '\n');
  return process.exit(0);
}

function letter(items, when) {
  const fmt = items.map((m) => {
    const time = new Date(m.ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `[${m.from || 'Lead'} · ${m.where} · ${time}] ${m.text || ''}`;
  }).join('\n');
  return `\u{1F4EC} New Office mail ${when} `
    + `(project-channel coordination and/or direct mail, not ambient chatter):`
    + `\n\n${fmt}\n\n`
    + `Respond to it now in your normal reply. The human and other agents can `
    + `read your answer in the Office live feed. If it needs no action, `
    + `acknowledge briefly.`;
}

// The session has gone idle (or has just started): sit on the office until there is mail for it, then wake it.
// Exit 2 with the mail on stderr is the wake; every other way out is silent.
async function watch(sid) {
  const until = Date.now() + WATCH * 1000;
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  let misses = 0;
  while (Date.now() < until) {
    const hold = Math.max(200, Math.min(25_000, until - Date.now()));
    let box = null;
    try {
      const r = await fetch(`${BASE}/api/inbox/wait?agent=${encodeURIComponent(sid)}&tag=watch&timeoutMs=${hold}`,
        { headers, signal: AbortSignal.timeout(hold + 8000) });
      if (r.status === 404 || r.status === 401 || r.status === 403) return ok();   // the office does not know this session, or will not talk to us
      if (!r.ok) throw new Error(String(r.status));
      box = await r.json();
      misses = 0;
    } catch {
      // the office is down or busy: wait a little and ask again, a few times, then leave it be
      if (++misses > 6) return ok();
      await nap(Math.min(30_000, 2000 * misses));
      continue;
    }
    if (!box || box.replaced || box.driven || box.off) return ok();
    if (Array.isArray(box.items) && box.items.length) {
      // (exit once it has really been written: a wake with nothing in it would be worse than none)
      return new Promise(() => process.stderr.write(letter(box.items, 'came in while you were idle') + '\n', () => process.exit(2)));
    }
  }
  return ok();
}
main();
