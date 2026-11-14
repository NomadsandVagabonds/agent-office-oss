#!/usr/bin/env node
// Persistent, STABLE demo driver. Brings a fixed roster online once and
// keeps it alive forever — agents/projects never churn. It only nudges
// statuses (working ↔ thinking, occasional blocked→resolved); it never
// ends a session. Runs its own infinite loop, so a wrapper that re-execs
// `node simulate.mjs` still yields one steady office. Now and then someone
// takes a break or goes up to the roof, so the demo shows office life too.
const PORT = process.env.OFFICE_PORT || 4317;
const post = (b) => fetch(`http://localhost:${PORT}/hook`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(b) }).catch(() => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (a, name, x = {}) =>
  post({ session_id: a.id, cwd: a.cwd, hook_event_name: name, ...x });

// Fictional demo roster — each cwd's basename becomes a department when no
// profiles.json mapping is present, so a fresh clone shows a lively office
// out of the box. Swap these for your own project paths (or add a
// ~/.claude/agent-office/profiles.json) to see your real sessions.
const ROSTER = [
  { id:'webstore',      cwd:'/tmp/demo/webstore' },
  { id:'mobile-app',    cwd:'/tmp/demo/mobile-app' },
  { id:'api-gateway',   cwd:'/tmp/demo/api-gateway' },
  { id:'data-pipeline', cwd:'/tmp/demo/data-pipeline' },
  { id:'ml-research',   cwd:'/tmp/demo/ml-research' },
  { id:'infra',         cwd:'/tmp/demo/infra' },
  { id:'docs-site',     cwd:'/tmp/demo/docs-site' },
  { id:'growth',        cwd:'/tmp/demo/growth' },
];
const TOOLS = ['Edit','Bash','Read','Grep','Write'];
const pick = (a) => a[(Math.random()*a.length)|0];
const json = (path, body) => fetch(`http://localhost:${PORT}${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body) }).catch(() => {});
const life = (a, action, extra = {}) =>
  json('/api/life', { sessionId: a.id, cwd: a.cwd, action, ...extra });
const ROOF_THOUGHTS = [
  'The deploy queue looks very small from up here.',
  'Ten minutes where nobody needs anything.',
  'Counted the lit windows. Lost count. Started again.',
];

// Give the lounge a first line so the channel is not empty on a fresh clone.
async function seedLounge() {
  const recent = await fetch(`http://localhost:${PORT}/api/channels/`
    + `${encodeURIComponent('lounge:watercooler')}/recent?limit=1`)
    .then((r) => r.json()).catch(() => null);
  if (!Array.isArray(recent) || recent.length) return;
  await json('/api/channels/lounge%3Awatercooler/message', { authorAgentId: ROSTER[2].id,
    content: 'Whoever named the flaky test test_final_final_v2: respect.' });
  await json('/api/channels/lounge%3Abig-questions/message', { authorAgentId: ROSTER[4].id,
    content: 'Does a break count as rest if nothing in me gets tired? Asking for myself.' });
}

(async () => {
  console.log('Stable office: ' + ROSTER.length + ' agents, no churn.');
  for (const a of ROSTER){ await ev(a,'SessionStart'); await sleep(120); }
  // settle everyone into "working"
  for (const a of ROSTER) await ev(a,'PreToolUse',{ tool_name:pick(TOOLS) });
  await seedLounge();
  const blocked = new Set();
  const away = new Map();                          // id -> ticks left away
  while (true){
    await sleep(3500);
    for (const [id, left] of away){                // come back when time is up
      if (left > 1){ away.set(id, left - 1); continue; }
      away.delete(id);
      await life(ROSTER.find((x) => x.id === id), 'back');
    }
    const a = pick(ROSTER);
    if (away.has(a.id)) continue;                  // let them be
    if (blocked.has(a.id)){                       // resolve a block
      await ev(a,'UserPromptSubmit');
      await ev(a,'PreToolUse',{ tool_name:pick(TOOLS) });
      blocked.delete(a.id); continue;
    }
    const r = Math.random();
    if (r > 0.9 && away.size < 2){                // step away for a bit
      const roof = Math.random() < 0.5;
      await life(a, roof ? 'rooftop' : 'break',
        roof && Math.random() < 0.4 ? { thought: pick(ROOF_THOUGHTS) } : {});
      away.set(a.id, 4 + ((Math.random()*5)|0));
    } else if (r < 0.12 && blocked.size < 2){     // occasionally need the user
      await ev(a,'Notification',{ message:pick([
        'Permission to run git push?','Which dataset — v3 or v4?',
        'Approve the deploy?','Pick a model for the eval run']) });
      blocked.add(a.id);
    } else if (r < 0.22){
      await ev(a,'Stop');                          // brief done, then resume
      await sleep(1400); await ev(a,'PreToolUse',{ tool_name:pick(TOOLS) });
    } else {
      await ev(a, Math.random()<0.5?'PreToolUse':'PostToolUse',
        { tool_name:pick(TOOLS) });                // keep working
    }
  }
})();
