// The Office — a session the office drives, read as a printout.
//
// The agent's work comes off a fanfold sheet: each turn starts on a tear-off
// line, what it was asked is in pen, what it said is in type, the tools it ran
// are ticked boxes and every permission it asked for is stamped with who
// answered. Under the paper are the few things a person can do to it: give it
// a turn, stop it, end it, and say what may wake it and how freely it may act.
//
// Nothing here knows which agent is on the other end. What can be done is
// whatever the session itself says can be done (`session.controls`), so a
// runtime that cannot be stopped simply has no stop button.
import { h, replace, shortPath } from './dom.js';
import { answerControls } from './answers.js';

const css = `
#ui .dv { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
#ui .dv .feed { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 38px 20px; background-color: var(--paper); color: var(--paper-ink);
  background-image: radial-gradient(circle at 12px 10px, var(--paper-3) 0 3px, transparent 3.6px), radial-gradient(circle at calc(100% - 12px) 10px, var(--paper-3) 0 3px, transparent 3.6px),
    linear-gradient(90deg, transparent 25px, var(--paper-line) 25px 26px, transparent 26px calc(100% - 26px), var(--paper-line) calc(100% - 26px) calc(100% - 25px), transparent calc(100% - 25px));
  background-size: 100% 20px, 100% 20px, 100% 20px; background-attachment: local; }
#ui .dv .e { margin: 6px 0 0; font: 13px/1.5 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
#ui .dv .sys { color: var(--paper-dim); font-size: 11.5px; }
#ui .dv .turn { display: flex; align-items: center; gap: 10px; margin-top: 18px; padding-top: 12px; border-top: 2px dashed var(--paper-line); font: 11.5px/1.2 var(--mono); color: var(--paper-dim); white-space: normal; }
#ui .dv .turn:first-child, #ui .dv .sys + .turn { margin-top: 10px; }
#ui .dv .turn b { flex: none; padding: 3px 7px 4px; background: var(--tape); color: #f4f0e6; font: 400 13px/1 var(--display); letter-spacing: .12em; text-transform: uppercase; }
#ui .dv .turn .st { margin-left: auto; text-align: right; }
#ui .dv .turn.failed .st, #ui .dv .turn.interrupted .st { color: var(--no); }
#ui .dv .user { color: var(--pen); font-family: var(--sans); font-size: 13.5px; padding-left: 14px; text-indent: -14px; }
#ui .dv .user::before { content: "› "; font-weight: 600; }
#ui .dv .thought { color: var(--paper-dim); font-style: italic; }
#ui .dv .sent { margin-top: 2px; font-size: 11.5px; color: var(--paper-dim); } #ui .dv .sent summary { cursor: pointer; width: max-content; }
#ui .dv .sent pre { margin: 4px 0 0; padding: 6px 8px; background: #fffaf0; border: 2px dashed var(--paper-line); font: 12px/1.4 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--paper-ink); }
#ui .dv .live::after { content: "▌"; animation: dvblink 1s steps(2) infinite; }
@keyframes dvblink { 50% { opacity: 0; } }
#ui .dv details.tool > summary { display: flex; gap: 8px; align-items: baseline; list-style: none; cursor: default; }
#ui .dv details.tool > summary::-webkit-details-marker { display: none; }
#ui .dv details.tool.has > summary { cursor: pointer; }
#ui .dv .tool .box { flex: none; width: 13px; height: 13px; border: 2px solid var(--paper-ink); display: inline-grid; place-items: center; font: 600 11px/1 var(--mono); transform: translateY(2px); }
#ui .dv .tool.completed .box { background: var(--ok); border-color: var(--ok); color: var(--paper); }
#ui .dv .tool.failed .box { background: var(--no); border-color: var(--no); color: var(--paper); }
#ui .dv .tool.in_progress .box { animation: dvblink 1s steps(2) infinite; }
#ui .dv .tool .nm { flex: none; font-weight: 600; }
#ui .dv .tool .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ui .dv .tool[open] .t { white-space: pre-wrap; overflow: visible; }
#ui .dv .tool .st { margin-left: auto; flex: none; color: var(--paper-dim); font-size: 11.5px; }
#ui .dv .tool pre { margin: 4px 0 2px 21px; padding: 6px 8px; max-height: 15em; overflow: auto; background: #fffaf0; border: 2px dashed var(--paper-line); font: 12px/1.4 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
#ui .dv .asked { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
#ui .dv .asked .mk { flex: none; padding: 0 5px 1px; border: 2px solid currentColor; font: 600 11px/1.35 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--no); transform: rotate(-1.5deg); }
#ui .dv .asked .mk.ok { color: var(--ok); } #ui .dv .asked .mk.off { color: var(--paper-dim); } #ui .dv .asked .mk.q { color: var(--pen); }
#ui .dv .asked .by { color: var(--paper-dim); font-size: 11.5px; }
#ui .dv .open { padding: 8px 10px 10px; background: #fffaf0; border: 2px solid var(--paper-ink); box-shadow: 3px 3px 0 rgba(42, 36, 32, .22); white-space: normal; }
#ui .dv .open.busy { opacity: .5; pointer-events: none; }
#ui .dv .open .asked { margin: 0; }
#ui .dv .answer { display: flex; gap: 10px 14px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
#ui .dv .answer .stamps { display: flex; gap: 8px; flex-wrap: wrap; }
#ui .dv .answer .inkstamp { height: 28px; padding: 0 9px 2px; font-size: 14px; border-width: 2px; }
#ui .dv .answer .write { flex: 1 1 220px; display: flex; gap: 8px; align-items: flex-end; }
#ui .dv .answer .write input { flex: 1 1 auto; min-width: 0; padding: 3px 2px; background: transparent; border: 0; border-bottom: 2px solid var(--paper-ink); outline: none; font: 13px/1.3 var(--mono); color: var(--paper-ink); }
#ui .dv .answer .write input::placeholder { color: var(--paper-dim); }
#ui .dv .answer .write button { height: 26px; padding: 0 9px 2px; border: 2px solid var(--paper-ink); background: var(--paper-ink); color: var(--paper); font: 400 14px/1 var(--display); cursor: pointer; }
#ui .dv .answer .write button[disabled] { opacity: .4; cursor: default; }
#ui .dv .answer .q { flex: 1 1 100%; } #ui .dv .answer .q p { margin: 0 0 4px; font: 13px/1.4 var(--mono); }
#ui .dv .answer .wave { color: var(--paper-dim); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; font: 12px/1 var(--mono); }
#ui .dv .plan { margin: 6px 0 0; padding: 0; list-style: none; font: 13px/1.5 var(--mono); }
#ui .dv .plan li::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 10px; border: 2px solid var(--paper-dim); }
#ui .dv .plan li.completed::before { background: var(--paper-dim); } #ui .dv .plan li.in_progress::before { border-color: var(--paper-ink); background: linear-gradient(90deg, var(--paper-ink) 50%, transparent 50%); }
#ui .dv .plan li.completed { color: var(--paper-dim); }
#ui .dv .notice { color: var(--paper-dim); font-size: 11.5px; } #ui .dv .notice.warn, #ui .dv .notice.error { color: var(--no); }
#ui .dv .tail { margin-top: 12px; font: 11.5px/1.3 var(--mono); color: var(--paper-dim); min-height: 1.3em; }
#ui .dv .tail.running::after { content: "▌"; color: var(--paper-ink); animation: dvblink 1s steps(2) infinite; }
#ui .dv .tail a { color: var(--paper-ink); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
#ui .dv .none { padding: 40px 18px; text-align: center; color: var(--paper-dim); font: 13px/1.5 var(--sans); }
#ui .dv .bar { flex: none; display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-top: 2px solid var(--edge); background: var(--board); }
#ui .dv .bar textarea { flex: 1 1 0; width: auto; min-width: 0; height: 34px; min-height: 34px; max-height: 120px; resize: none; padding: 6px 8px; font: 13px/1.45 var(--mono); }
#ui .dv .bar .btn { height: 34px; flex: none; }
#ui .dv .opts { flex: none; display: flex; gap: 16px; align-items: center; padding: 0 10px 9px; background: var(--board); flex-wrap: wrap; font: 11px/1 var(--mono); color: var(--faint); }
#ui .dv .opts .held { color: var(--blocked); display: flex; gap: 8px; align-items: center; }
#ui .seg { display: inline-flex; margin-left: 6px; border: 2px solid var(--edge); }
#ui .seg button { height: 22px; padding: 0 8px 1px; border: 0; border-right: 2px solid var(--edge); background: var(--board-2); color: var(--dim); font: 400 13px/1 var(--display); cursor: pointer; }
#ui .seg button:last-child { border-right: 0; }
#ui .seg button:hover:not([disabled]) { background: var(--board-3); color: var(--ink); }
#ui .seg button.on { background: var(--brass); color: var(--accent-ink); box-shadow: inset 0 -2px 0 var(--brass-lo); }
#ui .seg button.sure { background: var(--danger); color: #230a06; }
#ui .seg button[disabled] { cursor: default; opacity: .55; }
#ui .seg button.on[disabled] { opacity: 1; }
#ui .btn.danger.sure { background: var(--danger); color: #230a06; border-color: var(--edge); }
`;

// what a person calls each setting; the daemon's names stay on the wire
const WAKE = { off: ['never', 'Mail waits until it next looks'], results: ['for results', 'Starts a turn by itself when work it handed to someone comes back'],
  direct: ['for mail', 'Also starts a turn for notes sent straight to it'] };
const MODE = { ask: ['asks first', 'Asks before it acts'], edits: ['edits freely', 'Changes files without asking; asks for everything else'], full: ['free hand', 'Acts without asking'] };
const TURN_FROM = { human: (e) => (e.by ? `from ${e.by}` : ''), wake: (e) => `woken by mail${e.from ? ` from ${e.from}` : ''}`, delegation: (e) => `a task from ${e.from || e.by || 'a teammate'}` };
const ASKED = { asked: ['asked', ''], allowed: ['allowed', 'ok'], 'allowed-session': ['allowed', 'ok'], 'auto-allowed': ['allowed', 'ok'], rejected: ['denied', ''],
  withdrawn: ['withdrawn', 'off'], answered: ['answered', 'ok'] };
const STATE = { starting: 'starting', idle: 'idle', running: 'working', waiting: 'waiting on you', ended: 'ended', failed: 'failed' };
export { folder };
export const stateDot = (s) => ({ running: 'working', waiting: 'blocked', starting: 'thinking', idle: 'idle' }[s?.state] || '');
export const stateText = (s) => STATE[s?.state] || s?.state || '';

/** A folder, short enough for a line: the home folder as ~, and only the last two names of a long path. */
const folder = (p) => { const s = shortPath(p); const parts = s.split('/').filter(Boolean); return parts.length > 3 ? `…/${parts.slice(-2).join('/')}` : s; };
const secs = (ms) => (ms < 950 ? `${Math.max(1, Math.round(ms / 100)) / 10}s` : ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`);

/** A button that asks once more before it does something that cannot be taken back. */
function twoStep(button, label, sureLabel, act) {
  let timer = null;
  const reset = () => { clearTimeout(timer); timer = null; button.classList.remove('sure'); button.lastChild.textContent = label; };
  button.addEventListener('click', () => {
    if (button.disabled) return;
    if (timer) { reset(); act(); return; }
    button.classList.add('sure'); button.lastChild.textContent = sureLabel;
    timer = setTimeout(reset, 3200);
  });
  button.addEventListener('blur', () => { if (timer) reset(); });
}

export function createDrivenView({ office, ui, header }) {
  if (!document.getElementById('dv-css')) document.head.append(h('style', { id: 'dv-css' }, css));
  const net = office.net;
  let session = null;             // the public view of the session on show
  let items = new Map();          // entry id → { entry, node }
  let loading = 0;                // which load is current (a newer one makes an older answer stale)
  let buffered = null;            // live entries that arrived while the page was being read
  let shut = false;

  const feed = h('div.feed', { tabIndex: 0 });
  const tail = h('div.tail');
  const input = h('textarea.field', { rows: 1, placeholder: 'Give it a turn…', spellcheck: false, 'aria-label': 'What it should do next' });
  const sendBtn = h('button.btn.primary', { type: 'button' }, 'Send');
  const stopBtn = h('button.btn', { type: 'button', title: 'Stop the turn it is in' }, 'Stop');
  const endBtn = h('button.btn.small.ghost.danger', { type: 'button', title: 'End this session: the agent process is stopped' }, h('span', 'End'));
  const stateChip = h('span.chip');
  const ctxChip = h('span.chip.hidden');
  const wakeSeg = h('span.seg'), modeSeg = h('span.seg');
  const held = h('span.held.hidden');
  const opts = h('div.opts', h('label', 'wakes', wakeSeg), h('label', 'acts', modeSeg), held);
  const el = h('div.dv.hidden', feed, h('div.bar', input, sendBtn, stopBtn), opts);
  const headerBits = [stateChip, ctxChip, endBtn];

  const atBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
  const stick = (was) => { if (was) feed.scrollTop = feed.scrollHeight; };

  /* ---- one entry of the printout ------------------------------------------------ */
  function draw(e) {
    switch (e.kind) {
      case 'session': {
        const bits = [e.label || e.adapter, e.model, e.modeLabel, folder(e.cwd)].filter(Boolean).join(' · ');
        const end = e.state === 'ended' || e.state === 'failed' ? ` — ${e.state}${e.reason ? `: ${e.reason}` : ''}` : e.state === 'starting' ? ' — starting…' : '';
        return h('div.e.sys', bits + end);
      }
      case 'turn': {
        const from = (TURN_FROM[e.origin] || (() => ''))(e);
        const st = e.state === 'running' ? 'running' : e.state === 'completed' ? `done${e.durationMs ? ` in ${secs(e.durationMs)}` : ''}${e.tools ? ` · ${e.tools} tool${e.tools > 1 ? 's' : ''}` : ''}`
          : e.state === 'interrupted' ? `stopped${e.stoppedBy ? ` by ${e.stoppedBy}` : ''}` : e.state === 'failed' ? `failed${e.error ? `: ${e.error}` : ''}` : e.state || '';
        return h(`div.e.turn.${e.state || 'running'}`, h('b', `Turn ${e.n}`), from ? h('span', from) : null, h('span.st', st));
      }
      case 'user': {
        // a task or mail arrives inside the office's own wrapper: show what was asked, keep the wrapper one click away
        const framed = /^<(delegated_task|office_mail)\b[^>]*>\s*([\s\S]*?)\s*<\/\1>/.exec(e.text || '');
        if (!framed) return h('div.e.user', e.text || '');
        return h('div.e', h('div.user', framed[2]), h('details.sent', h('summary', 'as it was sent'), h('pre', e.text)));
      }
      case 'message': return h('div.e.msg' + (e.streaming ? '.live' : ''), e.text || '');
      case 'thought': return h('div.e.thought' + (e.streaming ? '.live' : ''), e.text || '');
      case 'tool': {
        const status = String(e.status || 'pending').replace(/[^a-z_]/g, '');
        const mark = status === 'completed' ? '✓' : status === 'failed' ? '×' : '';
        const name = e.name || 'Tool';
        // "Edit" then "Edit db/a.sql" says the verb twice: the command, else the files, else the title without it
        const what = e.command || (e.paths || []).join(', ') || (e.title && e.title.toLowerCase().startsWith(name.toLowerCase() + ' ') ? e.title.slice(name.length + 1) : e.title) || '';
        const node = h(`details.e.tool.${status}${e.output ? '.has' : ''}`,
          h('summary', h('span.box', mark), h('span.nm', name), h('span.t', { title: e.title || '' }, what),
            h('span.st', status === 'failed' && Number.isInteger(e.exitCode) ? `exit ${e.exitCode}` : status === 'in_progress' ? 'running' : status === 'pending' ? 'waiting' : '')),
          e.output ? h('pre', e.output) : null);
        if (!e.output) node.addEventListener('click', (ev) => ev.preventDefault());
        return node;
      }
      case 'plan': return h('ul.plan', (e.entries || []).map((p) => h(`li.${String(p.status || 'pending').replace(/[^a-z_]/g, '')}`, p.text || '')));
      case 'permission': case 'question': {
        const [word, cls] = ASKED[e.state] || [e.state || 'asked', ''];
        const isQ = e.kind === 'question';
        const what = isQ ? e.text : (e.command || e.title || (e.paths || []).join(', '));
        const by = e.state === 'auto-allowed' ? (e.reason || 'already allowed') : [e.by ? `by ${e.by}` : '', e.state === 'allowed-session' && e.grant ? 'for the rest of the session' : '', e.reason || ''].filter(Boolean).join(' · ');
        const line = h('div.e.asked', h(`span.mk${cls ? '.' + cls : isQ && e.state === 'asked' ? '.q' : ''}`, word), h('span', what || ''),
          isQ && e.answer ? h('span.user', e.answer) : null, by && e.state !== 'asked' ? h('span.by', by) : null);
        if (e.state !== 'asked') return line;
        // still open: answer it here, with whatever answers its runtime takes
        const p = promptFor(e);
        if (!p) return line;
        const controls = answerControls(p, (body) => answer(p, body, node), { compact: true });
        const node = h('div.e.open', line, h('div.answer', controls.nodes,
          controls.wave ? h('a.wave', { onclick: () => answer(p, controls.wave.body, node) }, controls.wave.kind === 'decline' ? 'decline' : 'dismiss') : null));
        return node;
      }
      case 'notice': return h(`div.e.notice.${e.level === 'warn' || e.level === 'error' ? e.level : 'info'}`, e.text || '');
      case 'handoff': return h('div.e.sys', e.direction === 'out' ? `Context handed to ${e.toName || 'a teammate'}: ${e.items || 0} item${e.items === 1 ? '' : 's'}`
        : `Context handed over from ${e.fromName || 'a teammate'}: ${e.items || 0} item${e.items === 1 ? '' : 's'}${e.omitted ? `, ${e.omitted} older left out` : ''}`);
      default: return null;            // usage and anything newer than this client: not part of the page
    }
  }

  /** The waiting request behind an "asked" line, as the in-tray knows it. */
  function promptFor(e) {
    const pend = (session?.pending || []).find((x) => `perm:${x.id}` === e.id);
    return pend ? (net.state.prompts || []).find((p) => p.id === pend.promptId && p.status === 'pending') || null : null;
  }
  async function answer(p, body, node) {
    if (node.classList.contains('busy')) return;
    node.classList.add('busy');
    try { await net.api(p.respond?.url || `/api/prompts/${encodeURIComponent(p.id)}/reply`, { method: p.respond?.method || 'POST', body }); }
    catch (err) { node.classList.remove('busy'); ui.toast(`That did not go through: ${err.message}`); }
  }
  /** Requests that are still open are drawn with their answers; redraw them when what can be answered changes. */
  function redrawOpen() {
    for (const [id, it] of items) {
      if (it.entry.state !== 'asked' || !it.node || it.node.contains(document.activeElement)) continue;
      const node = draw(it.entry);
      if (node) { it.node.replaceWith(node); items.set(id, { entry: it.entry, node }); }
    }
  }

  function apply(e) {
    if (!e || typeof e.id !== 'string') return;
    const prev = items.get(e.id);
    if (prev && (prev.entry.seq || 0) >= (e.seq || 0)) return;
    if (e.kind === 'usage') { showUsage(e); items.set(e.id, { entry: e, node: null }); return; }
    const node = draw(e);
    if (prev?.node && node) { if (prev.node.open) node.open = true; prev.node.replaceWith(node); }
    else if (node) feed.insertBefore(node, tail);
    items.set(e.id, { entry: e, node: node || prev?.node || null });
  }

  function showUsage(u) {
    const pct = u && u.size > 0 ? Math.round((u.used / u.size) * 100) : null;
    ctxChip.classList.toggle('hidden', pct === null);
    if (pct !== null) { ctxChip.textContent = `context ${pct}%`; ctxChip.title = `${u.used.toLocaleString()} of ${u.size.toLocaleString()} tokens`; }
  }

  /* ---- the session's own state: the line under the page, and the controls -------- */
  function seg(box, control, names, onPick) {
    const fixed = control && control.available === false;
    replace(box, (control?.options || []).map((opt) => {
      const [label, tip] = names[opt] || [opt, ''];
      const b = h('button' + (control.value === opt ? '.on' : ''), { type: 'button', title: fixed && control.fixed ? control.fixed : tip, disabled: fixed || control.value === opt }, h('span', label));
      if (opt === 'full' && control.value !== opt) twoStep(b, label, 'sure?', () => onPick(opt));
      else b.addEventListener('click', () => onPick(opt));
      return b;
    }));
  }

  async function patch(control, value) {
    try { await net.api(control.url, { method: control.method, body: { [control.field]: value } }); }
    catch (err) { ui.toast(err.message); }
    refresh();
  }

  // What a control call answers with can be older than what the office has already announced
  // (a stop is confirmed a moment after it is asked for), so the state is read again, not taken from it.
  let refreshTimer = null;
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      const id = session?.id;
      if (!id || shut) return;
      try { const res = await net.api(`/api/harness/sessions/${encodeURIComponent(id)}`); if (res?.session && session?.id === id) update(res.session); }
      catch { /* the office will say so itself when it changes */ }
    }, 350);
  }

  function update(s) {
    if (!s || !session || s.id !== session.id) return;
    session = s;
    const c = s.controls || {};
    const live = s.live !== false && s.state !== 'ended' && s.state !== 'failed';
    stateChip.textContent = stateText(s);
    stateChip.style.color = s.state === 'waiting' ? 'var(--blocked)' : s.state === 'running' ? 'var(--working)' : s.state === 'failed' ? 'var(--danger)' : '';
    if (s.usage) showUsage(s.usage);
    input.disabled = sendBtn.disabled = !live || c.turn?.available === false;
    input.placeholder = !live ? 'This session has ended.' : s.state === 'running' || s.state === 'waiting' ? 'Next turn (it starts when this one ends)…' : 'Give it a turn…';
    stopBtn.classList.toggle('hidden', !c.interrupt || !(s.state === 'running' || s.state === 'waiting'));
    stopBtn.disabled = c.interrupt?.available === false;
    endBtn.classList.toggle('hidden', !live || !c.end || c.end.available === false);
    opts.classList.toggle('hidden', !live);
    if (live) {
      seg(wakeSeg, c.wake, WAKE, (v) => patch(c.wake, v));
      seg(modeSeg, c.mode, MODE, (v) => patch(c.mode, v));
    }
    const why = s.wakeStats?.held;
    held.classList.toggle('hidden', !live || !why);
    if (why) replace(held, `mail is waiting: ${why}`, c.deliverMail?.available === false ? null : h('button.btn.small', { type: 'button', onclick: deliver }, 'Deliver it'));
    // the line under the page: what it is doing this second
    tail.className = 'tail' + (s.state === 'running' ? ' running' : '');
    if (s.state === 'starting') replace(tail, 'starting…');
    else if (!live) replace(tail, s.reason ? `${s.state}: ${s.reason}` : s.state);
    else if (s.queued) replace(tail, `${s.queued} more turn${s.queued > 1 ? 's' : ''} waiting`);
    else replace(tail);
    redrawOpen();
  }

  async function deliver() {
    try {
      const res = await net.api(session.controls.deliverMail.url, { method: 'POST' });
      ui.toast(res.delivered ? 'Its mail is being delivered.' : 'Nothing was waiting.');
    } catch (err) { ui.toast(err.message); }
  }

  async function send() {
    const text = input.value.trim();
    const c = session?.controls?.turn;
    if (!text || !c || sendBtn.disabled) return;
    sendBtn.disabled = true;
    try {
      const res = await net.api(c.url, { method: c.method, body: { text } });
      input.value = ''; fit();
      if (res.queued) ui.toast(`Queued: it starts when this turn ends${res.position > 1 ? ` (${res.position} waiting)` : ''}.`);
      refresh();
      feed.scrollTop = feed.scrollHeight;
    } catch (err) { ui.toast(`That did not reach it: ${err.message}`); }
    sendBtn.disabled = false;
  }
  const fit = () => { input.style.height = '34px'; input.style.height = Math.min(120, Math.max(34, input.scrollHeight + 4)) + 'px'; };
  input.addEventListener('input', fit);
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', async () => {
    const c = session?.controls?.interrupt;
    if (!c) return;
    try { await net.api(c.url, { method: c.method }); }
    catch (err) { ui.toast(err.message); }
    refresh();
  });
  twoStep(endBtn, 'End', 'End it?', async () => {
    const c = session?.controls?.end;
    if (!c) return;
    try { await net.api(c.url, { method: c.method }); }
    catch (err) { ui.toast(err.message); }
    refresh();
  });
  feed.addEventListener('keydown', (e) => e.stopPropagation());

  /* ---- reading the page, then following it live -------------------------------- */
  async function load(s) {
    const mine = ++loading;
    items = new Map();
    replace(feed, tail);
    buffered = [];
    const t = s.controls?.transcript;
    if (t?.watch) net.send(t.watch);                               // ask first, so nothing falls between the read and the feed
    try {
      const page = await net.api(`${t?.url || `/api/harness/sessions/${encodeURIComponent(s.id)}/transcript`}?limit=600`);
      if (mine !== loading || shut) return;
      if (page.truncated) feed.insertBefore(h('div.e.sys', '(the earlier part of this record is not shown)'), tail);
      for (const e of page.entries || []) apply(e);
      for (const e of buffered) apply(e);
      if (!items.size) feed.insertBefore(h('div.none', 'Nothing on the page yet.'), tail);
    } catch (err) {
      if (mine !== loading || shut) return;
      replace(feed, h('div.none', err.status === 403 ? 'A session’s record shows its commands and their output, so it can only be read on the machine the office runs on.' : `This record could not be read: ${err.message}`), tail);
    }
    buffered = null;
    feed.scrollTop = feed.scrollHeight;
  }

  const offEntry = net.on('transcript', (m) => {
    if (!session || m.sessionId !== session.id || !m.entry) return;
    if (buffered) { buffered.push(m.entry); return; }
    const was = atBottom();
    feed.querySelector('.none')?.remove();
    apply(m.entry);
    stick(was);
  });
  const offStatus = net.on('status', (up) => { if (up && session) load(session); });   // a reconnect forgets who was watching
  const offPrompts = net.on('prompts', () => { if (session) { const was = atBottom(); redrawOpen(); stick(was); } });

  return {
    el, headerBits,
    get id() { return session?.id || null; },
    /** Put this session on the page (or take the page away with null). */
    show(s) {
      const same = s && session && s.id === session.id;
      el.classList.toggle('hidden', !s);
      for (const b of headerBits) b.classList.toggle('hidden', !s || (b === ctxChip));
      if (!s) { session = null; loading++; return; }
      if (same) { update(s); return; }
      session = s;
      ctxChip.classList.add('hidden');
      update(s);
      load(s);
    },
    update,
    focus() { if (!input.disabled) input.focus({ preventScroll: true }); },
    close() { shut = true; clearTimeout(refreshTimer); offEntry(); offStatus(); offPrompts(); },
  };
}
