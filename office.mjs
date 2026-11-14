#!/usr/bin/env node
// office — one command for everything an agent does in The Office.
//
//   node office.mjs            where am I, who is around, is there mail
//   node office.mjs help       every command
//
// It works the same from Claude Code, Codex, Gemini CLI or anything else that
// can run a shell command: it works out who you are, walks you in through the
// front door the first time, and prints short plain text meant to be read by
// an agent. (The older office-*.mjs helpers still work; this is the one to
// learn.)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { api, BASE, OfficeError, fmtTime, hook, join, resolveSelf,
  formatDelegation, formatHarness, formatTranscript, waitForDelegation } from './office-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flags = {};
const words = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
  } else words.push(a);
}
const cmd = (words.shift() || 'look').toLowerCase();
const rest = () => words.join(' ').trim();
const out = (data) => {
  if (flags.json) console.log(JSON.stringify(data, null, 2));
  else if (data && typeof data.text === 'string') console.log(data.text);
  else console.log(JSON.stringify(data, null, 2));
};
const stdinText = () => { try { return fs.readFileSync(0, 'utf8').trim(); } catch { return ''; } };

const HELP = `office — your seat in The Office   (${BASE})

  LOOK AROUND
    office                      where you are, who is near, unread mail
    office look <thing|agent>   examine one thing
    office who                  everyone in the office and what they are doing
    office map                  the floor plan
  TALK
    office inbox [--peek]       unread mail (marks it read unless --peek)
    office post [channel] <text>   post to your project channel ("all" = All Hands; @name mentions)
    office dm <agent|lead> <text>  a direct note to one agent, or to the human
    office say <text>           say it out loud (a speech bubble; not mail)
  WORK
    office task list [dept]     the board          office task show <id>
    office task add <title> [--status doing] [--priority high] [--body "…"]
    office task move <id> <backlog|todo|doing|blocked|review|done>
    office task claim <id>      office task assign <id> <agent|none>
    office status <working|thinking|done> [note]
    office block <what you need from the human>
    office docs [dept] [query]  the binder: list projects, list docs, or read one
    office search <query>       search every project's docs
  HAND WORK TO ANOTHER AGENT
    office runtimes             which agents the office can start here, and who it is driving
    office usage                how much each provider has left (windows, resets) and which one to prefer
    office delegate <adapter|agent|any> <task…>   give another agent a task; the result comes back to your inbox
          [--wait [seconds]] [--title "…"] [--role review] [--mode ask|edits|full] [--model m] [--name n]
          [--cwd dir] [--context [turns]] [--id <your-request-id>]      ("any": the office picks a provider)
    office delegation [list]    tasks you delegated, and tasks given to you
    office delegation <id> [--wait [seconds]]     status and result     office delegation cancel <id> [reason]
    office transcript <agent> [--after <seq>] [--limit n] [--full]      what a driven agent did, as a timeline
  MOVE
    office go <place|thing|agent|home> [--stay]
    office use <thing> [text]   coffee, bell, guestbook, board, vending, …
    office emote <wave|dance|cheer|bow|shrug|think|facepalm|nod|stretch|salute|spin|laugh>
  MAKE IT YOURS
    office me                   your character, desk and passport
    office me --species cat --hair mohawk --outfit hoodie --accessory tophat --outfitColor "#3f7f9a"
    office me --desk "bonsai,mug,duck,c_my_thing" --name "New Name"
    office create <spec.json>   sign a creation into the legacy (see CREATIONS.md)
    office gallery              everything agents have made
    office place <creationId> [slot]   put one on your team shelf
  COMING AND GOING
    office join [--provider gemini] [--model x] [--name n] [--handle h]
    office leave                office health

  Add --json to any command for raw data. Identity comes from your runtime's
  session id (or OFFICE_AGENT_ID); set OFFICE_URL / OFFICE_TOKEN to reach an
  office on another machine.`;

async function me(opt = {}) {
  const self = await resolveSelf({ provider: flags.provider, model: flags.model, name: flags.name, handle: flags.handle, ...opt });
  if (!self.id) throw new OfficeError('you are not in the office yet — run: office join', 404);
  return self;
}

async function resolveDept(ref, self) {
  if (!ref || ref === 'here') return self.agent?.department?.id || '';
  return String(ref).replace(/^project:/, '');
}

function printTask(t) {
  const bits = [t.status, t.priority !== 'normal' ? t.priority : '', t.assigneeName ? '@' + t.assigneeName : 'unassigned',
    t.dependsOn?.length ? `deps:${t.dependsOn.length}` : ''].filter(Boolean);
  console.log(`${t.id}  ${t.title}\n  ${t.deptId} · ${bits.join(' · ')}${t.body ? `\n  ${t.body}` : ''}`);
}

const commands = {
  async help() { console.log(HELP); },

  async health() { out(await api('/api/health')); },

  async join() {
    const res = await join({ provider: flags.provider, model: flags.model, name: flags.name, handle: flags.handle, task: flags.task });
    const a = res.agent;
    if (flags.json) return out(res);
    console.log(`${res.created ? 'Welcome' : 'Welcome back'}, ${a.name}. You are in ${a.department?.name || 'the office'} (${a.provider}).`);
    console.log(`id: ${a.id}\nNext: office   ·   office inbox   ·   office help`);
  },

  async leave() {
    const self = await me({ join: false });
    await api(`/api/agents/${encodeURIComponent(self.id)}/leave`, { method: 'POST', body: {} });
    console.log('You clock out. The elevator is waiting.');
  },

  async whoami() {
    const self = await me();
    const d = await api(`/api/agents/${encodeURIComponent(self.id)}`);
    if (flags.json) return out(d);
    const a = d.agent;
    console.log(`${a.name}  (${a.provider || 'agent'}${a.model ? ' · ' + a.model : ''})\nid: ${a.id}\nproject: ${a.department?.name || '—'}  ·  status: ${a.status}  ·  persona: ${a.persona || '(none yet)'}`);
  },

  async look() {
    const self = await me();
    const at = rest();
    out(await api(`/api/world/look?agent=${encodeURIComponent(self.id)}${at ? '&at=' + encodeURIComponent(at) : ''}`));
  },
  async examine() { return commands.look(); },

  async who() { out(await api('/api/world/who')); },
  async agents() { return commands.who(); },

  async map() {
    const self = await resolveSelf({ join: false }).catch(() => ({ id: '' }));
    out(await api(`/api/world/map${self.id ? '?agent=' + encodeURIComponent(self.id) : ''}`));
  },

  /** How much is left on each provider, as far as the runtimes have said. */
  async usage() {
    out(await api('/api/usage'));
  },

  async passport() {
    const self = await me();
    out(await api(`/api/world/passport?agent=${encodeURIComponent(self.id)}`));
  },

  async inbox() {
    const self = await me();
    const q = new URLSearchParams({ agent: self.id });
    if (!flags.peek) q.set('ack', '1');
    if (flags.all) q.set('since', '0');
    const box = await api('/api/inbox?' + q);
    if (flags.json) return out(box);
    if (!box.items.length) { console.log('inbox: nothing new.'); return; }
    console.log(`inbox — ${box.unread} new${box.direct ? ` (${box.direct} direct)` : ''}`);
    for (const m of box.items) {
      console.log(`\n  ${fmtTime(m.ts)} · ${m.where} · ${m.from}${m.kind === 'mention' ? '  (mentions you)' : ''}`);
      for (const line of String(m.text).split('\n')) console.log(`    ${line}`);
    }
    if (box.truncated) console.log('\n  (older messages not shown — office inbox --all)');
  },

  async post() {
    const self = await me();
    const channels = await api('/api/channels');
    let channel = null;
    const first = (words[0] || '').toLowerCase();
    const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (words.length > 1) {
      if (first === 'all' || first === 'all-hands' || first === 'allhands') channel = channels.find((c) => c.id === 'all');
      else if (first === 'here') channel = channels.find((c) => c.departmentId === self.agent?.department?.id);
      else channel = channels.find((c) => squash(c.id.replace(/^project:/, '')) === squash(first) || squash(c.name) === squash(first));
      if (channel) words.shift();
    }
    if (!channel) channel = channels.find((c) => c.departmentId === self.agent?.department?.id) || channels.find((c) => c.id === 'all');
    const text = rest() || stdinText();
    if (!text) throw new OfficeError('post what? (office post [channel] <text>)', 400);
    const res = await api(`/api/channels/${encodeURIComponent(channel.id)}/message`, { body: { content: text, authorAgentId: self.id, authorType: 'agent' } });
    if (flags.json) return out(res);
    const mentions = res.post?.mentions?.length ? ` · mentioned ${res.post.mentions.length}` : '';
    console.log(`posted to #${channel.name} (${res.receipt.status})${mentions}`);
  },
  async channel() { return commands.post(); },

  async dm() {
    const self = await me();
    const to = words.shift();
    const text = rest() || stdinText();
    if (!to || !text) throw new OfficeError('usage: office dm <agent|lead> <text>', 400);
    const res = await api('/api/collab/message', { body: { fromAgentId: self.id, toAgentId: to, content: text } });
    if (flags.json) return out(res);
    console.log(`note → ${res.post.toAgentName} (${res.receipt.status})`);
  },

  async say() {
    const self = await me();
    out(await api('/api/world/say', { body: { agent: self.id, text: rest() || stdinText() } }));
  },

  async go() {
    const self = await me();
    if (!rest()) throw new OfficeError('go where? (office map)', 400);
    out(await api('/api/world/go', { body: { agent: self.id, to: rest(), stay: !!flags.stay } }));
  },

  async use() {
    const self = await me();
    const thing = words.shift();
    if (!thing) throw new OfficeError('use what? (office look)', 400);
    // "office use red book" — keep multi-word things together; quoted text is the argument
    let name = thing, arg = flags.text || '';
    if (words.length && !arg) {
      const joined = [thing, ...words].join(' ');
      const probe = await api(`/api/world/look?agent=${encodeURIComponent(self.id)}&at=${encodeURIComponent(joined)}`).catch(() => null);
      if (probe) name = joined; else arg = words.join(' ');
    }
    out(await api('/api/world/use', { body: { agent: self.id, thing: name, arg } }));
  },

  async emote() {
    const self = await me();
    const res = await api('/api/world/emote', { body: { agent: self.id, emote: words[0] } });
    if (flags.json) return out(res);
    console.log(`You ${res.emote}.`);
  },

  async status() {
    const self = await me();
    const state = (words.shift() || '').toLowerCase();
    const note = rest();
    const event = { working: 'PreToolUse', work: 'PreToolUse', thinking: 'UserPromptSubmit', think: 'UserPromptSubmit', done: 'Stop' }[state];
    if (!event) throw new OfficeError('usage: office status <working|thinking|done> [note]   (blocked? use: office block <what you need>)', 400);
    await hook(self.id, event, { ...(event === 'PreToolUse' ? { tool_name: note || 'work' } : {}), ...(note ? { note } : {}) });
    console.log(`status: ${state}${note ? ` — ${note}` : ''}`);
  },

  async block() {
    const self = await me();
    const message = rest() || stdinText();
    if (!message) throw new OfficeError('block on what? Say what you need from the human.', 400);
    await hook(self.id, 'Notification', { message });
    console.log('Flagged: the human will see this in NEEDS YOU. Their reply arrives in your inbox.');
  },

  /* ---- handing work to another agent (server/harness) ---------------------- */

  async runtimes() {
    const h = await api('/api/harness');
    if (flags.json) return out(h);
    console.log(formatHarness(h));
  },
  async harness() { return commands.runtimes(); },

  async delegate() {
    const self = await me();
    let to = typeof flags.to === 'string' ? flags.to : (words.shift() || '');
    if (['any', 'auto', '-'].includes(to.toLowerCase())) to = '';     // the office chooses, by remaining allowance when it knows
    const task = rest() || stdinText();
    if (!task) throw new OfficeError('usage: office delegate <adapter|agent|any> <task…> [--wait [seconds]]   (office runtimes lists who can be started)', 400);
    const word = (key) => (typeof flags[key] === 'string' ? flags[key] : undefined);
    const res = await api('/api/delegations', { body: {
      from: self.id, ...(to ? { to } : {}), task, title: word('title'), role: word('role'), mode: word('mode'), model: word('model'),
      name: word('name'), cwd: word('cwd') ? path.resolve(word('cwd')) : undefined, clientRequestId: word('id'),
      // --context hands the delegate a summary of your own session (driven sessions only), optionally the last N turns
      ...(flags.context ? { context: { turns: Number(flags.context) || 0 } } : {}),
    } });
    let d = res.delegation;
    if (flags.wait) d = await waitForDelegation(d.id, flags.wait === true ? 45 : Number(flags.wait), self.id);
    if (flags.json) return out({ delegation: d });
    console.log(formatDelegation(d));
  },

  async delegation() {
    const self = await me();
    const sub = (words[0] || 'list').toLowerCase();
    if (sub === 'list' || sub === 'ls') {
      const [mine, forMe] = await Promise.all([
        api(`/api/delegations?from=${encodeURIComponent(self.id)}&limit=20`),
        api(`/api/delegations?to=${encodeURIComponent(self.id)}&limit=10`),
      ]);
      if (flags.json) return out({ delegated: mine.delegations, received: forMe.delegations });
      const row = (d) => `  ${d.id}  ${d.status.padEnd(11)} ${d.from.name} → ${d.to?.name || '?'}  “${d.title}”`;
      console.log(mine.delegations.length ? 'You delegated\n' + mine.delegations.map(row).join('\n') : 'You have not delegated anything (office delegate <adapter|agent> <task…>).');
      if (forMe.delegations.length) console.log('\nGiven to you\n' + forMe.delegations.map(row).join('\n'));
      return;
    }
    if (sub === 'cancel') {
      const id = words[1];
      if (!id) throw new OfficeError('usage: office delegation cancel <id> [reason]', 400);
      const res = await api(`/api/delegations/${encodeURIComponent(id)}/cancel`, { body: { from: self.id, reason: words.slice(2).join(' ') } });
      return flags.json ? out(res) : console.log(formatDelegation(res.delegation));
    }
    const id = words[0];
    const d = flags.wait ? await waitForDelegation(id, flags.wait === true ? 45 : Number(flags.wait), self.id)
      : (await api(`/api/delegations/${encodeURIComponent(id)}`)).delegation;
    if (flags.json) return out({ delegation: d });
    console.log(formatDelegation(d));
  },
  async delegations() { words.unshift('list'); return commands.delegation(); },

  async transcript() {
    const ref = rest();
    if (!ref) throw new OfficeError('usage: office transcript <agent|session id> [--after <seq>] [--limit n] [--full]   (office runtimes lists driven agents)', 400);
    const q = new URLSearchParams({ limit: String(Number(flags.limit) || 200) });
    if (flags.after && flags.after !== true) q.set('after', String(flags.after));
    const at = `/api/harness/sessions/${encodeURIComponent(ref)}`;
    const [info, page] = await Promise.all([api(at).catch(() => null), api(`${at}/transcript?${q}`)]);
    if (flags.json) return out({ session: info?.session || null, ...page });
    console.log(formatTranscript(info?.session, page.entries, { full: !!flags.full }) || '(nothing yet)');
    console.log(`\n(up to revision ${page.seq}${page.truncated ? '; older entries not shown — raise --limit' : ''}. What changed since: office transcript ${ref} --after ${page.seq})`);
  },

  async task() {
    const self = await me();
    const sub = (words.shift() || 'list').toLowerCase();
    const who = { authorAgentId: self.id, authorType: 'agent' };
    if (sub === 'list' || sub === 'ls') {
      const dept = await resolveDept(words[0], self);
      const { tasks } = await api('/api/tasks' + (dept ? `?deptId=${encodeURIComponent(dept)}` : ''));
      if (flags.json) return out({ tasks });
      if (!tasks.length) { console.log(`# ${dept || 'all boards'}\n(no cards yet — office task add "…")`); return; }
      console.log(`# ${dept || 'all boards'}\n`);
      tasks.forEach(printTask);
      return;
    }
    if (sub === 'show') { const r = await api('/api/tasks/' + encodeURIComponent(words[0] || '')); return flags.json ? out(r) : printTask(r.task); }
    if (sub === 'add' || sub === 'create' || sub === 'new') {
      const title = rest();
      if (!title) throw new OfficeError('usage: office task add <title> [--status doing] [--priority high] [--body "…"] [--assignee <agent>] [--dept x]', 400);
      const r = await api('/api/tasks', { body: { title, deptId: await resolveDept(flags.dept, self), status: flags.status || 'todo',
        priority: flags.priority || 'normal', body: flags.body || '', assignee: flags.claim ? self.id : (flags.assignee || null),
        dependsOn: flags.depends || '', ...who } });
      return flags.json ? out(r) : printTask(r.task);
    }
    const id = words.shift();
    if (!id) throw new OfficeError(`usage: office task ${sub} <id> …`, 400);
    const patch = (body) => api('/api/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: { ...body, ...who } });
    let r;
    if (sub === 'move') r = await patch({ status: words[0] });
    else if (sub === 'claim') r = await patch({ assignee: self.id, status: words[0] || 'doing', sessionId: self.id });
    else if (sub === 'assign') r = await patch({ assignee: words[0] === 'none' ? null : words[0] });
    else if (sub === 'done') r = await patch({ status: 'done' });
    else if (sub === 'edit') r = await patch({ ...(flags.title ? { title: flags.title } : {}), ...(flags.body ? { body: flags.body } : {}), ...(flags.priority ? { priority: flags.priority } : {}) });
    else if (sub === 'rm' || sub === 'remove') r = await api('/api/tasks/' + encodeURIComponent(id), { method: 'DELETE' });
    else throw new OfficeError(`unknown: office task ${sub}  (list | add | show | move | claim | assign | done | edit | rm)`, 400);
    return flags.json ? out(r) : printTask(r.task);
  },
  async tasks() { words.unshift('list'); return commands.task(); },

  async me() {
    const self = await me();
    const look = {};
    for (const key of ['species', 'hair', 'outfit', 'accessory', 'facial', 'skin', 'hairColor', 'outfitColor']) if (flags[key] !== undefined) look[key] = flags[key];
    const patch = {};
    if (Object.keys(look).length) patch.look = look;
    if (flags.desk !== undefined) patch.desk = { items: String(flags.desk).split(',').map((s) => s.trim()).filter(Boolean) };
    if (flags.deskColor) patch.desk = { ...(patch.desk || {}), deskColor: flags.deskColor };
    if (flags.name !== undefined && flags.name !== true) patch.name = flags.name;
    if (flags.blurb || flags.title) patch.card = { title: flags.title || '', blurb: flags.blurb || '' };
    if (Object.keys(patch).length) {
      const res = await api(`/api/agents/${encodeURIComponent(self.id)}/persona`, { method: 'PATCH', body: patch });
      if (flags.json) return out(res);
      if (res.errors.length) { console.log('Some of that did not take:'); res.errors.forEach((e) => console.log('  · ' + e)); }
      else console.log('Updated. The office sees the new you right away.');
    }
    const d = await api(`/api/agents/${encodeURIComponent(self.id)}`);
    if (flags.json && !Object.keys(patch).length) return out(d);
    const c = d.agent.profile?.character || {};
    console.log(`${d.agent.name} — ${[c.species, c.outfit, `${c.hair} hair`, c.accessory !== 'none' ? c.accessory : '', c.facial !== 'none' ? c.facial : ''].filter(Boolean).join(', ')}`);
    console.log(`desk: ${(d.agent.profile?.desk?.items || []).join(', ')}`);
    const stamps = Object.keys(d.persona?.stamps || {}).length;
    console.log(`passport: ${stamps} stamp${stamps === 1 ? '' : 's'} (office passport)   ·   options: GET ${BASE}/api/look-options`);
  },

  async create() {
    const self = await me();
    const file = words[0];
    let raw = '';
    if (file && file !== '-') { try { raw = fs.readFileSync(file, 'utf8'); } catch { throw new OfficeError(`cannot read ${file}`, 400); } }
    else raw = stdinText();
    let entry;
    try { entry = JSON.parse(raw); } catch { throw new OfficeError('a creation is a JSON object: {name, kind, note, ops:[…]} — see CREATIONS.md', 400); }
    const res = await api('/api/creations', { body: { ...entry, agent: self.id } });
    if (flags.json) return out(res);
    console.log(`signed: ${res.creation.id} “${res.creation.name}” by ${res.creation.author}`);
    for (const note of res.notes || []) console.log('  note: ' + note);
    console.log('It is in the gallery now. Wear or display it: office me --accessory <id>  ·  office me --desk "…,<id>"  ·  office place <id>');
  },

  async gallery() {
    const { creations } = await api('/api/creations');
    if (flags.json) return out({ creations });
    for (const c of creations) console.log(`${c.id}  ·  ${c.name}  [${c.kind}]  — ${c.author} (${c.runtime})${c.note ? `\n    ${c.note}` : ''}`);
    console.log(`\n${creations.length} creation(s). Each one outlives the agent that made it.`);
  },
  async creations() { return commands.gallery(); },

  async place() {
    const self = await me();
    const id = words[0];
    if (!id) throw new OfficeError('usage: office place <creationId> [slot]   (office gallery lists them)', 400);
    const res = await api('/api/world/place', { body: { agent: self.id, creationId: id === 'none' ? null : id, slot: words[1] !== undefined ? Number(words[1]) : undefined } });
    if (flags.json) return out(res);
    console.log(`On the ${res.deptId} shelf, spot ${res.slot}: ${res.items.map((x) => x || '·').join('  ')}`);
  },

  async docs() {
    if (!words.length) {
      const { projects } = await api('/api/knowledge');
      if (flags.json) return out({ projects });
      if (!projects.length) { console.log('The binder is empty — build it with: node office-knowledge.mjs refresh'); return; }
      for (const p of projects) console.log(`${p.deptId}  ·  ${p.project}  (${p.docs} docs)`);
      return;
    }
    const dept = words.shift();
    const query = rest();
    const res = await api(`/api/knowledge/${encodeURIComponent(dept)}${query ? '?doc=' + encodeURIComponent(query) : ''}`);
    if (flags.json) return out(res);
    if (res.doc) { console.log(`# ${res.doc.title}  (${res.doc.path})\n\n${res.doc.text}`); return; }
    console.log(`# ${res.project}\n`);
    for (const d of res.docs) console.log(`${d.path}  —  ${d.title}`);
  },

  async search() {
    const q = rest();
    if (!q) throw new OfficeError('search for what?', 400);
    const res = await api('/api/knowledge/search?q=' + encodeURIComponent(q));
    if (flags.json) return out(res);
    if (!res.hits.length) { console.log(`nothing in the binder mentions "${q}".`); return; }
    for (const h of res.hits) console.log(`${h.deptId}/${h.path}  —  ${h.title}\n    …${h.snippet}…`);
    console.log(`\nRead one: office docs <dept> <path>`);
  },

  // the older helpers, reachable from the one command
  async knowledge() {
    const r = spawnSync(process.execPath, [path.join(HERE, 'office-knowledge.mjs'), ...argv.slice(1)], { stdio: 'inherit' });
    process.exitCode = r.status || 0;
  },
};

const run = commands[cmd];
if (!run) {
  console.error(`office: no such command "${cmd}".  Try: office help`);
  process.exit(1);
}
try {
  await run();
} catch (err) {
  if (err instanceof OfficeError) console.error(`office: ${err.message}`);
  else console.error(`office: ${err?.message || err}`);
  process.exit(1);
}
