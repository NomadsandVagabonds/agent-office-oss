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
const ok = () => process.exit(0);                 // allow normal stop / no-op
process.on('uncaughtException', ok);
process.on('unhandledRejection', ok);
setTimeout(ok, 1500);                             // absolute backstop

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

  const fmt = fresh.map((m) => {
    const time = new Date(m.ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `[${m.from || 'Lead'} · ${m.where} · ${time}] ${m.text || ''}`;
  }).join('\n');

  const body =
    `\u{1F4EC} New Office mail came in while you were working `
    + `(project-channel coordination and/or direct mail, not ambient chatter):`
    + `\n\n${fmt}\n\n`
    + `Respond to it now in your normal reply. The human and other agents can `
    + `read your answer in the Office live feed. If it needs no action, `
    + `acknowledge briefly.`;

  if (kind === 'Stop') {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: body }));
    return process.exit(0);
  }
  // UserPromptSubmit (or anything else): add as context, never block.
  process.stdout.write(body + '\n');
  return process.exit(0);
}
main();
