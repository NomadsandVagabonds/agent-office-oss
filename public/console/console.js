// The Office — the console. The office without the office: no 3D, no walking,
// the same agents, projects and requests as text.
//
// On the left, every project with whoever is working in it underneath (a face,
// a name, what they are on). On the right, the one you picked: an agent the
// office drives is a conversation you can type into; an agent the office only
// watches is what is known about it and a line to send it a note; a project is
// its board. Everything about the conversation — what a transcript entry looks
// like, what a typed line means — is core/console.mjs, shared with the terminal
// (`office chat`), so the two never disagree.
//
// Under the prompt, a bar of the choices the agent itself offers — its model
// (and who else the conversation could be carried on with), how hard it thinks,
// its own mode, how freely it may act. Nothing in it is a list of ours: an
// agent that has not said what it offers shows only its name.
//
// Keys: Enter sends (Shift+Enter for a new line), Esc stops the turn in flight,
// y / a / n answer a waiting request, Alt+↑↓ walks the rail, Ctrl+B hides it,
// ` on an empty line swaps to the office itself. /help lists the commands.
import { createNet } from '/world/net.js';
import { h, clear, since, shortPath } from '/world/ui/dom.js';
import { paintFlatCharacter } from '/world/art/character.js';
import { resolveLook } from '/core/look.mjs';
import { choicesOf, createConsole, optionsOf, parseInput, shortFolder } from '/core/console.mjs';

const $ = (id) => document.getElementById(id);
const rail = $('rail'), head = $('head'), feed = $('feed'), liveEl = $('live'), input = $('input'), statusEl = $('status'), bar = $('bar'), foot = $('foot');
const COLUMNS = ['backlog', 'todo', 'doing', 'blocked', 'review', 'done'];
const PROVIDER = { claude: 'claude', codex: 'codex', gemini: 'gemini', opencode: 'opencode', custom: 'agent' };
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('office-console:' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('office-console:' + k, JSON.stringify(v)); } catch { /* remembered until the page closes, then */ } } };

const net = createNet();
let view = { kind: 'none', id: '' };                 // what the right-hand side shows: session | agent | project | none
let adapters = [];
let shut = new Set(store.get('shut', []));           // projects folded away in the rail
let picking = '';                                    // the project whose "+" is open
let boardOpen = '';                                  // the card that is unfolded
let menuAt = 0, typed = store.get('history', []), histAt = -1, draft = '';
let railFollow = false;                              // bring the selected row into view the next time the rail is drawn
const nodes = new Map();                             // block key → its element
const faces = new Map();                             // agent id → { key, canvas }

/* ---- the console (core/console.mjs), with this page as its screen and the bus as its wire -------- */
const con = createConsole({
  api: (path, opt) => net.api(path, opt),
  watch: (id) => net.send({ type: 'transcript:watch', sessionId: id || '*none*' }),
  home: '',
  choices: false,                                    // requests get buttons here, not a list of keys
  clear: () => { clear(feed); nodes.clear(); },
  office: () => { location.href = '/'; },
  quit: () => { location.href = '/'; },
  project: () => projectOfView(),
});

const spans = (line) => line.map(([text, style]) => (style ? h('span.s-' + style, text) : text));
const atBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
const stick = (was) => { if (was) feed.scrollTop = feed.scrollHeight; };

function blockNode(b) {
  const kind = b.entry.kind, asking = b.entry.state === 'asked';
  const airy = ['message', 'tool', 'permission', 'question'].includes(kind);
  const el = h(`div.blk.${kind}${b.live ? '.live' : ''}${b.gap ? '.gap' : airy ? '.air' : ''}${asking ? '.ask' : ''}`, b.lines.map((l) => h('div.ln', spans(l))));
  if (asking && b.prompt) {
    const choices = choicesOf(b.prompt);
    if (choices.length) el.append(h('div.keys', choices.map((c) => h('button', { type: 'button', onclick: () => con.key(c.key) }, h('kbd', c.key), c.label))));
  }
  // what a turn changed opens as its diff (the same as typing /diff n), unless the click was the end of selecting text
  if (kind === 'changes' && Number.isInteger(b.entry.turn)) {
    el.title = `/diff ${b.entry.turn}`;
    el.addEventListener('click', () => { if (!String(getSelection())) con.submit(`/diff ${b.entry.turn}`); });
  }
  return el;
}

con.on('reset', () => { if (view.kind === 'session') { clear(feed); nodes.clear(); } });
con.on('block', (b) => {
  if (view.kind !== 'session') return;
  const was = atBottom(), node = blockNode(b), prev = nodes.get(b.key);
  if (prev) prev.replaceWith(node); else feed.append(node);
  nodes.set(b.key, node);
  stick(was);
});
con.on('say', (lines) => {
  const was = atBottom();
  feed.querySelector('.empty')?.remove();
  feed.append(h('div.blk.sys.air', lines.map((l) => h('div.ln', spans(l)))));
  stick(was || true);
});
con.on('state', () => { drawStatus(); drawHead(); drawBar(); });

/* ---- who is here -------------------------------------------------------------------------------- */
const agents = () => [...net.state.agents.values()];
const sessionOf = (id) => con.state.sessions.find((s) => s.id === id) || null;
const lookOf = (a) => { try { return resolveLook(a.persona || a.id, a.profile?.character); } catch { return {}; } };
function face(a) {
  const key = JSON.stringify(a.profile?.character || a.persona || a.id);
  const had = faces.get(a.id);
  if (had && had.key === key) return copyCanvas(had.canvas);
  // head and not much else: it is drawn at thirty pixels (the sprite is x −16..16, y −62..2, two pixels to the cell)
  const canvas = h('canvas', { width: 44, height: 44 });
  try { const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(paintFlatCharacter(lookOf(a), {}).toCanvas(2), 10, 50, 44, 44, 0, 0, 44, 44); } catch { /* a blank face is fine */ }
  faces.set(a.id, { key, canvas });
  return copyCanvas(canvas);
}
function copyCanvas(src) {
  const c = h('canvas', { width: src.width, height: src.height });
  try { c.getContext('2d').drawImage(src, 0, 0); } catch { /* a blank face is fine */ }
  return c;
}
/** What somebody is on, in a few words: what they said they are doing, else what the office can see. */
function roleOf(a) {
  const s = sessionOf(a.id);
  if (a.status === 'blocked' || s?.state === 'waiting') return a.note || 'waiting on you';
  return a.task || a.profile?.card?.title || a.profile?.card?.blurb || (a.tool ? `using ${a.tool}` : '') || (a.turn === 'idle' ? 'idle' : '') || a.model || s?.label || '';
}
const dotOf = (a) => { const s = sessionOf(a.id); return s?.state === 'waiting' || a.status === 'blocked' ? 'blocked' : a.status === 'working' || s?.state === 'running' ? 'working' : a.status === 'thinking' && a.turn === 'active' ? 'thinking' : ''; };

function projects() {
  const by = new Map();
  for (const a of agents()) {
    const d = a.department || { id: '', name: 'No project' };
    const id = d.id || '';
    if (!by.has(id)) by.set(id, { id, name: d.name || id || 'No project', agents: [], cwd: '' });
    by.get(id).agents.push(a);
  }
  // a project nobody is in right now still has a board
  for (const [id, list] of net.state.tasks) if (id && !by.has(id) && (list || []).length) by.set(id, { id, name: id, agents: [], cwd: '' });
  for (const p of by.values()) {
    p.agents.sort((x, y) => (x.joinedAt || 0) - (y.joinedAt || 0));
    const counts = new Map();
    for (const a of p.agents) if (a.cwd) counts.set(a.cwd, (counts.get(a.cwd) || 0) + 1);
    p.cwd = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] || '';
  }
  return [...by.values()].sort((a, b) => (a.id === '' ? 1 : b.id === '' ? -1 : a.name.localeCompare(b.name)));
}
function projectOfView() {
  if (view.kind === 'project') { const p = projects().find((x) => x.id === view.id); return p ? { id: p.id, name: p.name } : { id: view.id, name: view.id }; }
  const a = net.state.agents.get(view.id);
  return a?.department?.id ? { id: a.department.id, name: a.department.name } : null;
}

/* ---- the rail ------------------------------------------------------------------------------------- */
function drawRail() {
  const list = projects();
  const groups = list.map((p) => {
    const folded = shut.has(p.id);
    const rows = p.agents.map((a) => {
      const driven = !!sessionOf(a.id), dot = dotOf(a);
      return h(`button.row${driven ? '.driven' : ''}${dot === 'blocked' ? '.blocked' : ''}${(view.kind === 'session' || view.kind === 'agent') && view.id === a.id ? '.on' : ''}`,
        { type: 'button', title: `${a.name} · ${a.provider}${a.model ? ' · ' + a.model : ''}${a.cwd ? '\n' + shortPath(a.cwd) : ''}`, dataset: { nav: `a:${a.id}` }, onclick: () => show(driven ? 'session' : 'agent', a.id) },
        face(a), h('span.who', h('b', a.name || a.short || a.id), h('i', PROVIDER[a.provider] || a.provider || '')), h('span.role', roleOf(a)), h(`span.dot${dot ? '.' + dot : ''}`));
    });
    const pick = picking === p.id ? h('div.pick', adapters.length ? adapters.map((ad) => h('button', { type: 'button', disabled: !ad.available, title: ad.available ? `Start ${ad.label} in ${shortPath(p.cwd) || 'the office folder'}` : (ad.note || 'not installed'),
      onclick: () => { picking = ''; start(ad.id, p); } }, ad.id)) : h('span', 'nothing can be started here')) : null;
    return h(`div.group${folded ? '.shut' : ''}`,
      h(`div.ghead${view.kind === 'project' && view.id === p.id ? '.on' : ''}`,
        h('button.fold', { type: 'button', title: folded ? 'Unfold' : 'Fold', onclick: () => { if (folded) shut.delete(p.id); else shut.add(p.id); store.set('shut', [...shut]); drawRail(); } }, '▾'),
        h('button.name', { type: 'button', title: `${p.name}: its board`, dataset: { nav: `p:${p.id}` }, onclick: () => show('project', p.id) }, p.name),
        h('span.n', String(p.agents.length || '')),
        p.id ? h('button.add', { type: 'button', title: 'Start an agent in this project', onclick: () => { picking = picking === p.id ? '' : p.id; drawRail(); } }, '+') : null),
      h('div.rows', rows, pick));
  });
  const usage = net.state.usage?.meters || [];
  const meters = usage.filter((m) => (m.windows || []).length).slice(0, 5).map((m) => {
    const w = [...m.windows].sort((a, b) => (a.left ?? 100) - (b.left ?? 100))[0];
    return h('div', { title: m.text || '' }, h('span', m.label || m.provider), h(`span${m.level === 'out' ? '.out' : m.level === 'low' || m.level === 'critical' ? '.low' : ''}`, w.lapsed ? 'reset' : `${Math.round(w.left ?? 100 - w.usedPercent)}% left`));
  });
  const scroll = rail.querySelector('.groups')?.scrollTop || 0;
  clear(rail).append(...[
    h('div.top', h('b', 'THE OFFICE'), h('button', { type: 'button', title: 'The office itself (` on an empty line)', onclick: () => { location.href = '/'; } }, 'office ↗')),
    h('div.groups', groups.length ? groups : h('div.none', 'Nobody is in. Agents show up here when their sessions report in — or start one: ', h('span.s-key', '/new <agent>'))),
    meters.length ? h('div.meters', meters) : null].filter(Boolean));
  rail.querySelector('.groups').scrollTop = scroll;
  if (railFollow) { railFollow = false; rail.querySelector('.row.on, .ghead.on')?.scrollIntoView({ block: 'nearest' }); }
}

async function start(adapter, project) {
  try {
    const res = await net.api('/api/harness/sessions', { method: 'POST', body: { adapter, ...(project.cwd ? { cwd: project.cwd } : {}) } });
    if (res?.session) { con.harness({ sessions: [...con.state.sessions.filter((s) => s.id !== res.session.id), res.session] }); show('session', res.session.id); }
  } catch (err) { con.say([['✗ ', 'err'], [err.message, 'err']]); }
  drawRail();
}

/* ---- the right-hand side ---------------------------------------------------------------------------- */
function show(kind, id, opt = {}) {
  view = { kind, id };
  boardOpen = '';
  if (!opt.keepHash) { try { window.history.replaceState(null, '', kind === 'none' ? '#' : `#${kind[0]}=${encodeURIComponent(id)}`); } catch { /* a hash is a nicety */ } }
  store.set('view', view);
  clear(feed); nodes.clear();
  if (kind === 'session') { const s = sessionOf(id); if (s) con.open(s); else { view = { kind: 'agent', id }; con.leave(); drawAgent(); } }
  else { con.leave(); if (kind === 'project') drawBoard(); else if (kind === 'agent') drawAgent(); else drawNone(); }
  document.body.classList.remove('rail');
  railFollow = true;
  openPop('');
  drawRail(); drawHead(); drawStatus(); drawBar(); placeholder();
  input.focus();
}

function drawHead() {
  const bits = [h('button.railbtn', { type: 'button', title: 'Projects and agents (Ctrl+B)', onclick: toggleRail }, '☰')];
  if (view.kind === 'session' || view.kind === 'agent') {
    const a = net.state.agents.get(view.id), s = sessionOf(view.id);
    const name = a?.name || s?.name || s?.label || view.id;
    const about = (s ? [shortFolder(shortPath(s.cwd || ''))] : [PROVIDER[a?.provider] || a?.provider, a?.model, 'watched, not driven', shortFolder(shortPath(a?.cwd || ''))]).filter(Boolean).join(' · ');
    bits.push(a ? face(a) : null, h('div.t', h('b', name), h('span', about)));
  } else if (view.kind === 'project') {
    const p = projects().find((x) => x.id === view.id);
    bits.push(h('div.t', h('b', p?.name || view.id), h('span', p?.cwd ? shortFolder(shortPath(p.cwd)) : 'board')));
  } else bits.push(h('div.t', h('b', 'The Office'), h('span', 'console')));
  clear(head).append(...bits.filter(Boolean));
}

function drawNone() {
  clear(feed).append(h('div.empty', 'Pick an agent or a project on the left.', h('br'), 'Or start an agent: ', h('kbd', '/new <agent>'), ' — ', h('kbd', '/help'), ' lists the rest.'));
}

/** An agent the office watches but does not drive: what is known, what it is asking, and what happened lately. */
async function drawAgent() {
  const a = net.state.agents.get(view.id);
  if (view.kind !== 'agent') return;
  if (!a) { clear(feed).append(h('div.empty', 'That agent has left the office.')); return; }
  const was = atBottom();
  const fact = (k, v) => (v ? h('div', h('dt', k), h('dd', v)) : null);
  const asks = (net.state.prompts || []).filter((p) => p.status === 'pending' && (p.agentId === a.id || p.sessionId === a.id));
  const page = h('div',
    h('dl.facts', fact('doing', roleOf(a)), fact('state', `${a.status || 'idle'}${a.tool ? ` · ${a.tool}` : ''}`), fact('model', a.model), fact('context', Number.isFinite(a.contextPct) ? `${a.contextPct}% used` : ''),
      fact('folder', shortPath(a.cwd || '')), fact('last seen', a.lastSeen ? since(a.lastSeen, net.now()) : '')),
    asks.map((p) => {
      const choices = choicesOf(p);
      return h('div.blk.ask', h('div.ln', h('span.s-ask', p.ask?.questions?.length ? '? ' : '⚠ '), h('span.s-bold', p.ask?.summary || p.message || 'It is waiting for you')),
        p.ask?.detail ? h('div.ln', h('span.s-dim', p.ask.detail)) : null,
        choices.length ? h('div.keys', choices.map((c) => h('button', { type: 'button', onclick: () => con.answer(p, c) }, h('kbd', c.key), c.label))) : h('div.ln', h('span.s-dim', 'Type your answer below.')));
    }),
    h('div.blk.sys.air', h('div.ln', h('span.s-dim', 'The office watches this session; it does not drive it. What you type below reaches it as a note.'))));
  clear(feed).append(page);
  try {
    const items = ((await net.api('/api/activity?limit=200'))?.items || []).filter((i) => i.agentId === a.id || i.meta?.agentId === a.id).slice(-30);
    if (view.kind !== 'agent' || view.id !== a.id) return;
    if (items.length) page.append(h('div.blk.gap', items.map((i) => h('div.ln', h('span.s-dim', `${new Date(i.at || i.t || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  `), i.text || ''))));
  } catch { /* what happened lately is a nicety */ }
  stick(was);
}

/** A project: who is in it, and its board. Cards open on a click, move by their arrows or by dragging. */
function drawBoard() {
  if (view.kind !== 'project') return;
  const p = projects().find((x) => x.id === view.id) || { id: view.id, name: view.id, agents: [] };
  const tasks = net.state.tasks.get(view.id) || [];
  const scroll = feed.scrollTop, side = feed.querySelector('.boardwrap')?.scrollLeft || 0;
  const move = async (t, status) => { if (!status || status === t.status) return; try { await net.api(`/api/tasks/${encodeURIComponent(t.id)}`, { method: 'PATCH', body: { status } }); } catch (err) { con.say([['✗ ', 'err'], [err.message, 'err']]); } };
  const columns = COLUMNS.map((status) => {
    const cards = tasks.filter((t) => t.status === status).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const col = h('div.col', { dataset: { status },
      ondragover: (e) => { e.preventDefault(); col.classList.add('over'); }, ondragleave: () => col.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); col.classList.remove('over'); const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain')); if (t) move(t, status); } },
      h('h3', status, h('i', String(cards.length || ''))),
      cards.length ? cards.map((t) => {
        const who = t.assignee ? net.state.agents.get(t.assignee) : null, i = COLUMNS.indexOf(status), open = boardOpen === t.id;
        return h(`div.card${open ? '.open' : ''}`, { draggable: true, ondragstart: (e) => e.dataTransfer.setData('text/plain', t.id), onclick: () => { boardOpen = open ? '' : t.id; drawBoard(); } },
          h('div.ti', t.title),
          h('div.meta', who ? face(who) : null, h('span', t.assigneeName || who?.name || 'nobody'), t.review?.state ? h('span', `· ${t.review.state}`) : null,
            t.priority && t.priority !== 'normal' ? h(`span.pri.${t.priority}`, t.priority) : null),
          open && t.body ? h('div.body', t.body) : null,
          open ? h('div.move', { onclick: (e) => e.stopPropagation() }, i > 0 ? h('button', { type: 'button', onclick: () => move(t, COLUMNS[i - 1]) }, `← ${COLUMNS[i - 1]}`) : null,
            i < COLUMNS.length - 1 ? h('button', { type: 'button', onclick: () => move(t, COLUMNS[i + 1]) }, `${COLUMNS[i + 1]} →`) : null) : null);
      }) : h('div.hole', '—'));
    return col;
  });
  clear(feed).append(...[
    p.agents.length ? h('div.people', p.agents.map((a) => h('button', { type: 'button', title: roleOf(a), onclick: () => show(sessionOf(a.id) ? 'session' : 'agent', a.id) }, face(a), a.name))) : null,
    h('div.boardwrap', h('div.board', columns))].filter(Boolean));
  feed.scrollTop = scroll;
  const board = feed.querySelector('.boardwrap'); if (board) board.scrollLeft = side;
}

/* ---- the bottom of the page ----------------------------------------------------------------------- */
let spin = 0;
/** Everybody who is waiting on the person, other than whoever is on show. */
function waitingOnYou() {
  const ids = new Set();
  for (const s of con.state.sessions) if (s.state === 'waiting') ids.add(s.id);
  for (const p of net.state.prompts || []) if (p.status === 'pending' && (p.agentId || p.sessionId)) ids.add(p.agentId || p.sessionId);
  for (const a of agents()) if (a.status === 'blocked' && a.blockKind !== 'idle') ids.add(a.id);
  ids.delete(view.kind === 'session' || view.kind === 'agent' ? view.id : '');
  return [...ids].map((id) => ({ id, name: net.state.agents.get(id)?.name || sessionOf(id)?.name || sessionOf(id)?.label || id }));
}
function drawStatus() {
  const s = view.kind === 'session' ? con.session() : null;
  const left = view.kind === 'session' ? con.status({ brief: true })[0] : [[view.kind === 'project' ? '/task <title> adds a card · /post <text> says it in the channel' : '', 'dim']];
  clear(statusEl.querySelector('.l')).append(...spans(net.state.connected || !net.state.everConnected ? left : [['the office is not answering — trying again', 'err']]));
  const waiting = waitingOnYou();
  clear(statusEl.querySelector('.r')).append(...(waiting.length ? [...waiting.slice(0, 4).flatMap((w, i) => [i ? ', ' : '', h('button.s-ask', { type: 'button', onclick: () => show(sessionOf(w.id) ? 'session' : 'agent', w.id) }, w.name)]),
    h('span.s-ask', `${waiting.length > 4 ? ` and ${waiting.length - 4} more` : ''} ${waiting.length === 1 ? 'needs' : 'need'} you`)] : []));
  const busy = s && (s.state === 'running' || s.state === 'starting');
  const t0 = s?.turn?.startedAt, secs = busy && t0 ? Math.max(0, Math.round((net.now() - t0) / 1000)) : 0;
  clear(liveEl);
  if (busy) liveEl.append(h('span.spin', SPIN[spin % SPIN.length] + ' '), s.state === 'starting' ? 'starting…' : 'working…', secs ? `  ${secs}s` : '', '  esc to stop');
  document.title = `${waiting.length ? `(${waiting.length}) ` : ''}${s?.name || s?.label || (view.kind === 'project' ? view.id : 'console')} · The Office`;
}
setInterval(() => { const s = view.kind === 'session' ? con.session() : null; if (s && (s.state === 'running' || s.state === 'starting')) { spin++; drawStatus(); } }, 140);

function placeholder() {
  const s = con.session();
  input.placeholder = view.kind === 'session' ? (!con.live() ? 'this session has ended — /new starts another' : con.pending() ? 'y allow · a allow for the session · n refuse — or type' : s?.state === 'running' ? 'next turn (it starts when this one ends)' : '')
    : view.kind === 'agent' ? 'a note to this agent' : view.kind === 'project' ? (canStart() ? `what should ${picked().label} do here?` : '/task <title>') : '/new <agent>';
}
const fit = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, innerHeight * 0.4) + 'px'; };

/* -- the list of commands that opens as you type a slash -- */
let menu = null;
const menuOptions = () => (input.value.startsWith('/') && !input.value.includes('\n') ? con.complete(input.value) : []);
/** Take one of the menu's lines. A word after a command is never taken by Enter alone: only once you have moved onto it. */
const take = (o) => { input.value = o.text; menuAt = 0; fit(); drawMenu(); };
function drawMenu() {
  const options = menuOptions();
  menu?.remove(); menu = null;
  if (!options.length || (options.length === 1 && options[0].text.trim() === input.value.trim() && options[0].kind === 'command')) return;
  menuAt = Math.max(options[0].kind === 'word' ? -1 : 0, Math.min(menuAt, options.length - 1));
  menu = h('div.menu', options.map((o, i) => h(`div${i === menuAt ? '.on' : ''}`, { onmousedown: (e) => { e.preventDefault(); take(o); } }, h('b', o.label), h('span', o.hint || ''))));
  foot.insertBefore(menu, $('entry'));
}

async function send() {
  const text = input.value;
  if (!text.trim()) return;
  typed = [text, ...typed.filter((x) => x !== text)].slice(0, 100); store.set('history', typed); histAt = -1;
  input.value = ''; fit(); drawMenu();
  const what = parseInput(text);
  if (what.kind === 'command') {
    // a command of ours is not part of anybody's record: note it where it was typed
    feed.querySelector('.empty')?.remove();
    feed.append(h('div.blk.sys.gap', h('div.ln', h('span.s-dim', '> ' + text.trim()))));
    feed.scrollTop = feed.scrollHeight;
    await con.submit(text);
  } else if (view.kind === 'session') await con.submit(text);
  else if (view.kind === 'agent') {
    const a = net.state.agents.get(view.id);
    const waiting = (net.state.prompts || []).find((p) => p.status === 'pending' && (p.agentId === view.id || p.sessionId === view.id) && (p.respond?.actions || []).some((x) => x.text === 'required'));
    try {
      if (waiting) await con.answer(waiting, waiting.respond.actions.find((x) => x.text === 'required'), what.text);
      else { const r = await net.api('/api/comms/direct-message', { method: 'POST', body: { toAgentId: view.id, content: what.text } }); con.say([['note → ', 'dim'], [r?.post?.toAgentName || a?.name || 'the agent', '']]); }
    } catch (err) { con.say([['✗ ', 'err'], [err.message, 'err']]); }
  } else if (view.kind === 'project' && canStart()) await startHere(what.text);
  else con.say(view.kind === 'project' ? 'On a board, /task <title> adds a card and /post <text> says something in the channel.' : 'Pick an agent on the left, or /new <agent>.');
  placeholder();
}

/* ---- the bar under the prompt: who it is said to, on which model, how hard, in which mode, how freely ---------- */
const MODE_SHORT = { ask: 'asks first', edits: 'edits freely', full: 'full access' };
const MODE_WORDS = { ask: 'every action is yours to allow', edits: 'asks for everything else', full: 'acts without asking' };
let pick = { adapter: '', model: '', mode: 'ask', ...store.get('pick', {}) };      // who a new agent would be, where nobody is on show
let pop = null;                                      // the menu that is open: { name, el, wide: the agent whose models are unfolded }
let armed = { what: '', until: 0 };                  // full access has to be chosen twice

const shown = () => (view.kind === 'session' && con.live() ? con.session() : null);
const here = () => (view.kind === 'project' ? projects().find((p) => p.id === view.id) || null : null);
const picked = () => adapters.find((a) => a.id === pick.adapter && a.available) || adapters.find((a) => a.available) || null;
const canStart = () => !!here()?.cwd && !!picked();
const nameIn = (control, id) => control?.labels?.[id] || id || '';
const oops = (err) => con.say([['✗ ', 'err'], [err.message, 'err']]);

function drawBar() {
  const s = shown(), chips = [];
  const chip = (name, kids, title, cls = '') => h(`button.chip.${name}${pop?.name === name ? '.open' : ''}${cls}`, { type: 'button', title, dataset: { chip: name },
    onclick: (e) => { e.stopPropagation(); openPop(pop?.name === name ? '' : name, e.detail === 0); } }, kids, h('i', '⌄'));
  if (s) {
    const c = s.controls || {};
    chips.push(chip('agent', [h('b', s.label || s.adapter), s.model ? h('span', nameIn(c.model, s.model)) : null], 'Its model — or carry this conversation on with another agent'));
    if (optionsOf(c.effort).length) chips.push(chip('effort', h('span', nameIn(c.effort, s.effort) || 'effort'), 'How hard it thinks'));
    if (optionsOf(c.agentMode).length) chips.push(chip('own', h('span', nameIn(c.agentMode, s.agentMode) || 'mode'), 'Its own mode'));
    chips.push(chip('mode', h('span', MODE_SHORT[s.mode] || s.mode), c.mode?.fixed ? `How freely it may act — ${c.mode.fixed}` : 'How freely it may act', s.mode === 'full' ? '.full' : ''));
  } else if (canStart()) {
    const a = picked();
    chips.push(chip('agent', [h('b', a.label), pick.model && pick.adapter === a.id ? h('span', (a.offers?.models || []).find((m) => m.id === pick.model)?.name || pick.model) : null], 'Which agent to start here'));
    chips.push(chip('mode', h('span', MODE_SHORT[pick.mode] || pick.mode), 'How freely it may act', pick.mode === 'full' ? '.full' : ''));
  }
  clear(bar).append(...chips);
  if (pop) { if (bar.querySelector(`[data-chip="${pop.name}"]`)) drawPop(); else openPop(''); }
}

function openPop(name, byKey = false) {
  if (!name && !pop) return;
  pop?.el.remove();
  pop = name ? { name, wide: '', el: h('div', { id: 'pop', role: 'menu', onclick: (e) => e.stopPropagation(), onkeydown: (e) => {
    const items = [...pop.el.querySelectorAll('.it:not([disabled])')], at = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); openPop(''); input.focus(); }
  } }) } : null;
  if (pop) foot.append(pop.el);
  drawBar();
  if (pop && byKey) pop.el.querySelector('.it:not([disabled])')?.focus();
}

function drawPop() {
  const chipEl = bar.querySelector(`[data-chip="${pop.name}"]`), scroll = pop.el.scrollTop, had = [...pop.el.querySelectorAll('.it')].indexOf(document.activeElement);
  clear(pop.el).append(...popRows(pop.name).filter(Boolean));
  const box = foot.getBoundingClientRect(), at = chipEl.getBoundingClientRect();
  pop.el.style.bottom = `${Math.round(box.bottom - at.top + 6)}px`;
  pop.el.style.left = `${Math.max(8, Math.min(Math.round(at.left - box.left), Math.round(box.width - pop.el.offsetWidth - 8)))}px`;
  pop.el.scrollTop = scroll;
  if (had >= 0) pop.el.querySelectorAll('.it')[had]?.focus();
}

function popRows(name) {
  const s = shown(), c = s?.controls || {};
  const it = (label, o = {}) => h(`button.it${o.on ? '.on' : ''}${o.sub ? '.sub' : ''}${o.warn ? '.warn' : ''}`, { type: 'button', role: 'menuitem', disabled: !!o.off, title: o.title || '',
    onclick: (e) => { e.stopPropagation(); o.run?.(); } }, h('span.tick', o.on ? '✓' : ''), h('span.l', label), o.hint ? h('span.h', o.hint) : null);
  if (name === 'effort') return optionsOf(c.effort).map((o) => it(o.label, { on: o.id === s.effort, off: c.effort.available === false, run: () => setControl('effort', o.id) }));
  if (name === 'own') return optionsOf(c.agentMode).map((o) => it(o.label, { on: o.id === s.agentMode, off: c.agentMode.available === false, run: () => setControl('agentMode', o.id) }));
  if (name === 'mode') {
    const value = s ? s.mode : pick.mode, off = !!s && c.mode?.available === false;
    return ['ask', 'edits', 'full'].map((id) => {
      const again = armed.what === id && Date.now() < armed.until;
      return it(MODE_SHORT[id], { on: id === value, off, title: off ? c.mode.fixed || '' : '', warn: again, hint: again ? 'again to confirm' : MODE_WORDS[id], run: () => chooseMode(id) });
    });
  }
  // the agent: its own models first; then who else there is — to carry this conversation on with, or, with nobody on show, to start
  const rows = [];
  if (s) {
    const models = optionsOf(c.model);
    if (models.length) rows.push(h('div.cap', s.label), ...models.map((o) => it(o.label, { on: o.id === s.model, off: c.model.available === false, run: () => setControl('model', o.id) })));
    if (c.model?.free && c.model.available !== false) rows.push(it('another model…', { run: () => { openPop(''); input.value = '/model '; input.focus(); fit(); drawMenu(); } }));
    rows.push(h('div.cap', 'carry on with'));
  }
  // what can be started first; what is not installed after it, greyed, so that it is known to exist
  for (const a of [...adapters.filter((x) => x.available), ...adapters.filter((x) => !x.available)]) {
    const models = a.offers?.models || [], open = pop.wide === a.id, chosen = !s && picked()?.id === a.id;
    rows.push(it(a.label, { on: chosen, off: !a.available, title: a.available ? '' : (a.note || 'not installed'), hint: a.available ? (models.length ? (open ? '▾' : '▸') : '') : 'not installed',
      run: () => { if (models.length) { pop.wide = open ? '' : a.id; if (s) drawPop(); else choose(a.id, pick.adapter === a.id ? pick.model : '', true); } else if (s) carryOn(a.id); else choose(a.id, ''); } }));
    if (open) rows.push(it('its own default', { sub: true, on: chosen && !pick.model, run: () => (s ? carryOn(a.id) : choose(a.id, '')) }),
      ...models.map((m) => it(m.name || m.id, { sub: true, on: chosen && pick.model === m.id, run: () => (s ? carryOn(a.id, m.id) : choose(a.id, m.id)) })));
  }
  return rows;
}

/** With nobody on show: who a new agent here would be. */
function choose(adapter, model, stay = false) {
  pick = { ...pick, adapter, model }; store.set('pick', pick);
  if (stay) drawBar(); else openPop('');
  placeholder(); input.focus();
}

async function chooseMode(id) {
  const s = shown();
  if (id === 'full' && (s ? s.mode : pick.mode) !== 'full' && !(armed.what === 'full' && Date.now() < armed.until)) { armed = { what: 'full', until: Date.now() + 6000 }; drawPop(); return; }
  armed = { what: '', until: 0 };
  if (s) await setControl('mode', id); else { pick = { ...pick, mode: id }; store.set('pick', pick); openPop(''); drawBar(); input.focus(); }
}

/** Change one of the things the session on show offers a choice of. What it then runs with is written into its record by the office. */
async function setControl(name, id) {
  const s = shown(), c = s?.controls?.[name];
  openPop('');
  input.focus();
  if (!c || id === c.value) return;
  try {
    const res = await net.api(c.url, { method: c.method || 'PATCH', body: { [c.field || name]: id } });
    if (res?.session) con.harness({ sessions: con.state.sessions.map((x) => (x.id === res.session.id ? res.session : x)) });
  } catch (err) { oops(err); }
}

/** The same conversation, another agent: it starts in the same folder with a summary of this session handed over, on the record of both. */
async function carryOn(adapter, model = '') {
  const s = shown();
  openPop('');
  if (!s) return;
  try {
    // a new agent never starts wider than "edits": full access is something a person turns on, and twice
    const res = await net.api('/api/harness/sessions', { method: 'POST', body: { adapter, cwd: s.cwd, ...(model ? { model } : {}), mode: s.mode === 'full' ? 'edits' : s.mode, context: { session: s.id } } });
    if (res?.session) { con.harness({ sessions: [...con.state.sessions.filter((x) => x.id !== res.session.id), res.session] }); show('session', res.session.id); }
  } catch (err) { oops(err); }
}

/** On a project's page, what is typed starts an agent on it: the one the bar names, with that as its first turn. */
async function startHere(text) {
  const p = here(), a = picked();
  if (!p || !a) return;
  try {
    const res = await net.api('/api/harness/sessions', { method: 'POST', body: { adapter: a.id, cwd: p.cwd, ...(pick.model && pick.adapter === a.id ? { model: pick.model } : {}), mode: pick.mode, text } });
    if (res?.session) { con.harness({ sessions: [...con.state.sessions.filter((x) => x.id !== res.session.id), res.session] }); show('session', res.session.id); }
  } catch (err) { oops(err); }
}
document.addEventListener('click', () => openPop(''));

function toggleRail() {
  if (matchMedia('(max-width: 760px)').matches) document.body.classList.toggle('rail');
  else { document.body.classList.toggle('norail'); store.set('norail', document.body.classList.contains('norail')); }
}
/** Alt+↑↓: the next thing in the rail, projects and agents alike. */
function walk(dir) {
  const items = [...rail.querySelectorAll('[data-nav]')].filter((el) => el.offsetParent !== null).map((el) => el.dataset.nav);
  if (!items.length) return;
  const here = view.kind === 'project' ? `p:${view.id}` : `a:${view.id}`;
  const next = items[(items.indexOf(here) + dir + items.length) % items.length] || items[0];
  const id = next.slice(2);
  if (next.startsWith('p:')) show('project', id); else show(sessionOf(id) ? 'session' : 'agent', id);
}

input.addEventListener('input', () => { menuAt = -1; openPop(''); fit(); drawMenu(); });
input.addEventListener('keydown', (e) => {
  const options = menu ? menuOptions() : [];
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    const o = menu ? options[menuAt] : null;
    if (o && o.text.trim() !== input.value.trim()) { take(o); if (o.more) return; }
    send();
  } else if (e.key === 'Tab' && menu && options.length) { e.preventDefault(); take(options[Math.max(0, menuAt)]); }
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey) { e.preventDefault(); walk(e.key === 'ArrowUp' ? -1 : 1); }
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && menu) { e.preventDefault(); menuAt = (Math.max(e.key === 'ArrowUp' ? 0 : -1, menuAt) + (e.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length; drawMenu(); }
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !input.value.includes('\n') && (histAt !== -1 || !input.value || e.key === 'ArrowUp' && input.selectionStart === 0)) {
    if (!typed.length) return;
    e.preventDefault();
    if (histAt === -1) draft = input.value;
    histAt = Math.max(-1, Math.min(typed.length - 1, histAt + (e.key === 'ArrowUp' ? 1 : -1)));
    input.value = histAt === -1 ? draft : typed[histAt]; fit();
  } else if (e.key === 'Escape') { e.preventDefault(); if (pop) openPop(''); else if (input.value) { input.value = ''; fit(); drawMenu(); } else if (view.kind === 'session') con.stop(); }
  else if (!input.value && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // on an empty line: one key answers what is waiting, and ` swaps to the office
    if (e.key === '`') { e.preventDefault(); location.href = '/'; return; }
    const p = view.kind === 'session' ? con.pending() : null;
    if (p && (choicesOf(p).some((c) => c.key === e.key) || (/^[1-9]$/.test(e.key) && p.ask?.questions?.length === 1 && (p.ask.questions[0].options || [])[Number(e.key) - 1]))) { e.preventDefault(); con.key(e.key); }
  }
});
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleRail(); return; }
  if (e.target === input || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target?.tagName || '')) return;
  if (e.key.length === 1 || e.key === 'Enter') input.focus();          // typing anywhere is typing at the prompt
});
feed.addEventListener('mouseup', () => { if (!String(getSelection())) input.focus(); });

/* ---- the wire ------------------------------------------------------------------------------------ */
let railTimer = null;
const railSoon = () => { clearTimeout(railTimer); railTimer = setTimeout(() => { drawRail(); if (view.kind === 'project') drawBoard(); }, 120); };
net.on('snapshot', railSoon); net.on('agent', (a) => { railSoon(); if (view.id === a.id) { drawHead(); if (view.kind === 'agent') drawAgent(); } }); net.on('remove', railSoon);
net.on('tasks', () => { railSoon(); });
net.on('usage', (u) => { con.usage(u); railSoon(); });
net.on('prompts', (p) => { con.prompts(p); placeholder(); drawStatus(); if (view.kind === 'agent') drawAgent(); });
let offersTimer = null;
const offersSoon = () => { clearTimeout(offersTimer); offersTimer = setTimeout(async () => { try { adapters = (await net.api('/api/harness')).adapters || adapters; drawBar(); placeholder(); } catch { /* as it was, then */ } }, 900); };
net.on('harness', (m) => { con.harness(m); railSoon(); placeholder(); offersSoon(); if (view.kind === 'agent' && sessionOf(view.id)) show('session', view.id); });
net.on('transcript', (m) => con.entry(m.sessionId, m.entry));
net.on('status', async (ok) => {
  drawStatus();
  if (!ok) return;
  if (view.kind === 'session') net.send({ type: 'transcript:watch', sessionId: view.id });
  try { const hz = await net.api('/api/harness'); adapters = hz.adapters || []; con.harness(hz); } catch { /* an office without the harness has nothing to start */ }
  try { const all = await net.api('/api/tasks'); const by = new Map(); for (const t of all.tasks || []) { if (!by.has(t.deptId)) by.set(t.deptId, []); by.get(t.deptId).push(t); } for (const [id, list] of by) net.state.tasks.set(id, list); } catch { /* boards fill in as they change */ }
  try { con.prompts(await net.api('/api/prompts')); } catch { /* they arrive on the bus too */ }
  try { con.usage(await net.api('/api/usage')); net.state.usage = con.state.usage; } catch { /* no meters, then */ }
  drawRail();
  if (!started) { started = true; begin(); }
});
let started = false;

function begin() {
  const m = /^#([sap])=(.+)$/.exec(location.hash || '');
  const wanted = m ? { kind: { s: 'session', a: 'agent', p: 'project' }[m[1]], id: decodeURIComponent(m[2]) } : store.get('view', null);
  if (wanted?.kind === 'project') return show('project', wanted.id, { keepHash: true });
  if (wanted && (wanted.kind === 'session' || wanted.kind === 'agent') && (sessionOf(wanted.id) || net.state.agents.get(wanted.id))) return show(sessionOf(wanted.id) ? 'session' : 'agent', wanted.id, { keepHash: true });
  const busiest = [...con.state.sessions].filter((s) => s.live !== false).sort((a, b) => (b.turn?.startedAt || b.startedAt || 0) - (a.turn?.startedAt || a.startedAt || 0))[0];
  if (busiest) show('session', busiest.id); else show('none', '');
}

if (store.get('norail', false)) document.body.classList.add('norail');
drawRail(); drawHead(); drawNone(); drawStatus(); drawBar(); placeholder();
net.connect();
input.focus();
