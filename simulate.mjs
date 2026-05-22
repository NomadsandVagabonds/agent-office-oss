#!/usr/bin/env node
// Persistent, STABLE demo driver. Brings a fixed roster online once and
// keeps it alive forever — agents/projects never churn. It only nudges
// statuses (working ↔ thinking, occasional blocked→resolved); it never
// ends a session. Runs its own infinite loop, so a wrapper that re-execs
// `node simulate.mjs` still yields one steady office.
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

(async () => {
  console.log('Stable office: ' + ROSTER.length + ' agents, no churn.');
  for (const a of ROSTER){ await ev(a,'SessionStart'); await sleep(120); }
  // settle everyone into "working"
  for (const a of ROSTER) await ev(a,'PreToolUse',{ tool_name:pick(TOOLS) });
  const blocked = new Set();
  while (true){
    await sleep(3500);
    const a = pick(ROSTER);
    if (blocked.has(a.id)){                       // resolve a block
      await ev(a,'UserPromptSubmit');
      await ev(a,'PreToolUse',{ tool_name:pick(TOOLS) });
      blocked.delete(a.id); continue;
    }
    const r = Math.random();
    if (r < 0.12 && blocked.size < 2){            // occasionally need the user
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
