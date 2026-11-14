// The Office — the sessions the office runs ("work mode"), of two kinds.
//
// Driven: an agent the office started in its structured mode and talks to
// directly. You read what it did as a record (driven.js), answer what it asks
// on the slip, and give it its next turn here.
//
// Terminals: an agent's own screen inside tmux (Claude Code, Codex, Gemini,
// opencode, a shell), shown live, with a keyboard: click the screen and type,
// or use the line below.
//
// Starting, steering and reading either kind only works from this machine —
// the daemon refuses those calls from anywhere else.
import { h, icon, replace, shortPath } from './dom.js';
import { createDrivenView, stateDot, stateText, folder } from './driven.js';

const css = `
#ui .tm { display: flex; flex: 1 1 auto; min-width: 0; }
#ui .tm .nav { width: 250px; flex: none; border-right: 1px solid var(--line); padding: 6px 0; display: flex; flex-direction: column; }
#ui .tm .nav .item small { display: block; color: var(--faint); font: 11px/1.3 var(--mono); }
#ui .tm .launch { padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
#ui .tm .launch h3 { margin: 6px 0 0; font: 400 13px/1 var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
#ui .tm .launch .row { flex-wrap: wrap; }
#ui .tm .launch details { font: 11.5px/1.45 var(--mono); color: var(--faint); }
#ui .tm .launch details summary { cursor: pointer; }
#ui .tm .launch details p { margin: 4px 0 0; }
#ui .tm .launch details b { color: var(--dim); font-weight: 600; }
#ui .tm .nav .item.past { opacity: .6; }
#ui .tm .autos { display: flex; align-items: center; gap: 8px; padding: 0 12px 10px; font: 11px/1 var(--mono); color: var(--faint); }
#ui .tm .autos.paused { color: var(--blocked); }
#ui .tm .keys .btn { font-family: var(--mono); font-size: 12px; }
@media (max-width: 720px) { #ui .tm { flex-direction: column; } #ui .tm .nav { width: auto; max-height: 42%; border-right: 0; border-bottom: 2px solid var(--edge); } }
#ui .tm .main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; background: #0d0b12; }
#ui .tm .screen { flex: 1 1 auto; margin: 0; padding: 10px 12px; overflow: auto; font: 12.5px/1.35 var(--mono); color: #d8d2c4; white-space: pre; outline: none; tab-size: 8; }
#ui .tm .screen:focus { box-shadow: inset 0 0 0 1px var(--accent); }
#ui .tm .bar { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--line); align-items: center; background: var(--panel-solid); flex-wrap: wrap; }
#ui .tm .bar input { flex: 1 1 220px; height: 30px; font-family: var(--mono); }
#ui .tm .keys { display: flex; gap: 4px; }
`;

/* ---- ANSI colour → DOM (text nodes only: nothing from a terminal is ever parsed as HTML) ---- */
const BASE = ['#1c1a22', '#e06c6c', '#7fd08a', '#e5c07b', '#6fa8e8', '#c59af0', '#6fd0d0', '#d8d2c4',
  '#5c5868', '#ff8a80', '#9fe8a8', '#ffd98a', '#8fc0ff', '#dab4ff', '#8fe8e8', '#ffffff'];
function color256(n) {
  if (n < 16) return BASE[n];
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})`; }
  const k = n - 16, r = Math.floor(k / 36), g = Math.floor((k % 36) / 6), b = k % 6, c = (x) => (x ? 55 + x * 40 : 0);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function renderAnsi(text) {
  const frag = document.createDocumentFragment();
  let st = { fg: null, bg: null, bold: false, dim: false, italic: false, under: false, inv: false };
  const flush = (chunk) => {
    if (!chunk) return;
    const plain = !st.fg && !st.bg && !st.bold && !st.dim && !st.italic && !st.under && !st.inv;
    if (plain) { frag.append(chunk); return; }
    const span = document.createElement('span');
    let fg = st.fg, bg = st.bg;
    if (st.inv) { [fg, bg] = [bg || '#0d0b12', fg || '#d8d2c4']; }
    if (fg) span.style.color = fg;
    if (bg) span.style.background = bg;
    if (st.bold) span.style.fontWeight = '700';
    if (st.dim) span.style.opacity = '.6';
    if (st.italic) span.style.fontStyle = 'italic';
    if (st.under) span.style.textDecoration = 'underline';
    span.textContent = chunk;
    frag.append(span);
  };
  // eslint-disable-next-line no-control-regex
  const re = /\x1b\[([0-9;:]*)([A-Za-z])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Za-z0-9]|\x1b[=>78]/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    flush(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[2] !== 'm') continue;                                  // only colour codes mean anything in a snapshot
    const codes = (m[1] || '0').split(/[;:]/).map((x) => Number(x) || 0);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) st = { fg: null, bg: null, bold: false, dim: false, italic: false, under: false, inv: false };
      else if (c === 1) st.bold = true; else if (c === 2) st.dim = true; else if (c === 3) st.italic = true;
      else if (c === 4) st.under = true; else if (c === 7) st.inv = true;
      else if (c === 22) { st.bold = false; st.dim = false; } else if (c === 23) st.italic = false; else if (c === 24) st.under = false; else if (c === 27) st.inv = false;
      else if (c >= 30 && c <= 37) st.fg = BASE[c - 30]; else if (c >= 90 && c <= 97) st.fg = BASE[c - 82];
      else if (c >= 40 && c <= 47) st.bg = BASE[c - 40]; else if (c >= 100 && c <= 107) st.bg = BASE[c - 92];
      else if (c === 39) st.fg = null; else if (c === 49) st.bg = null;
      else if (c === 38 || c === 48) {
        let col = null;
        if (codes[i + 1] === 5) { col = color256(codes[i + 2] || 0); i += 2; }
        else if (codes[i + 1] === 2) { col = `rgb(${codes[i + 2] || 0},${codes[i + 3] || 0},${codes[i + 4] || 0})`; i += 4; }
        if (c === 38) st.fg = col; else st.bg = col;
      }
    }
  }
  flush(text.slice(last));
  return frag;
}

const TASK_DOT = { queued: 'thinking', running: 'working', waiting: 'blocked', completed: 'done' };
const TASK_TEXT = { queued: 'queued', running: 'working on it', waiting: 'waiting on you', completed: 'done', failed: 'failed', cancelled: 'cancelled', interrupted: 'stopped' };

// browser key → tmux key name
const KEYMAP = { Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'BSpace', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'PPage', PageDown: 'NPage' };
const CTRL = { c: 'C-c', d: 'C-d', l: 'C-l', r: 'C-r', u: 'C-u', a: 'C-a', e: 'C-e', z: 'C-z', o: 'C-o' };

export function open({ office, ui, content, header, arg }) {
  if (!document.getElementById('tm-css')) document.head.append(h('style', { id: 'tm-css' }, css));
  const net = office.net;
  let sessions = [], runtimes = [], current = arg?.sessionId || null, lastText = null, timer = null, fast = 0, dead = false, status = null;
  let driven = [], past = [], adapters = [], wake = null, harnessOff = false, harnessNote = '';
  let handed = [];                           // tasks one agent gave another, newest first
  let harnessRead = false;                   // until the list has been read once, a session asked for by id is taken on trust
  let closed = false;
  let drivenId = arg?.driven || null;        // a driven session is on show instead of a terminal
  let picked = !!(current || drivenId);      // until you pick one, the panel shows whichever needs you most
  const nav = h('div.nav');
  const list = h('div.list.scroll.grow');
  const launch = h('div.launch');
  const screen = h('pre.screen', { tabIndex: 0 });
  const input = h('input.field', { placeholder: 'Type a line and press Enter…', spellcheck: false, autocomplete: 'off' });
  const title = h('span.dim.clip', { style: { marginLeft: '8px' } });
  const killBtn = h('button.btn.small.ghost.hidden', { title: 'End this session', onclick: () => kill() }, icon('close'), 'End');
  const view = createDrivenView({ office, ui, header });
  header.append(title, h('span.grow'), ...view.headerBits, killBtn);
  const key = (label, keys, tip) => h('button.btn.small', { title: tip || label, onclick: () => press(keys) }, label);
  nav.append(list, launch);
  const term = h('div.main', screen,
    h('div.bar', input, h('div.keys', key('⏎', ['Enter'], 'Enter'), key('esc', ['Escape']), key('↑', ['Up']), key('↓', ['Down']), key('tab', ['Tab']), key('^C', ['C-c'], 'Interrupt (Ctrl-C)'))));
  content.append(h('div.tm', nav, term, view.el));

  const sessionName = (s) => s.name || s.title || s.id;

  async function loadSessions() {
    try {
      const [sess, st] = await Promise.all([net.api('/api/terminal/sessions'), net.api('/api/terminal/status')]);
      status = st;
      runtimes = (st.runtimes || []).filter((r) => r.kind === 'terminal');
      const managed = sess.managed || [];
      const ids = new Set(managed.map((s) => s.id));
      const live = (sess.live || []).filter((x) => !ids.has(typeof x === 'string' ? x : x.id)).map((x) => (typeof x === 'string' ? { id: x, observedOnly: true } : x));
      sessions = [...managed, ...live];
      if (current && !sessions.some((s) => s.id === current)) current = null;
      dead = false;
    } catch (err) {
      dead = true; sessions = []; runtimes = [];
      status = { error: err.status === 403 ? 'Terminals can only be used from the machine the office runs on.' : `Terminals are unavailable: ${err.message}` };
    }
    settle();
  }

  /** The agents the office drives: what could be started, what is running, what has finished. */
  async function loadHarness() {
    try {
      const [hz, all] = await Promise.all([net.api('/api/harness'), net.api('/api/harness/sessions?all=1')]);
      harnessOff = hz.enabled === false; harnessNote = ''; harnessRead = true;
      adapters = hz.adapters || []; wake = hz.wake || null;
      takeSessions(all.sessions || hz.sessions || []);
      net.api('/api/delegations?limit=12').then((r) => { handed = (r.delegations || []).sort((a, b) => b.createdAt - a.createdAt); renderNav(); }).catch(() => {});
    } catch (err) {
      harnessOff = true; adapters = []; harnessRead = true;
      harnessNote = err.status === 404 ? '' : err.message;
    }
    settle();
  }
  function takeSessions(all) {
    const alive = (s) => s.live !== false && s.state !== 'ended' && s.state !== 'failed';
    driven = all.filter(alive);
    past = all.filter((s) => !alive(s)).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)).slice(0, 6);
  }
  const findDriven = (id) => driven.find((s) => s.id === id) || past.find((s) => s.id === id) || null;

  /** Decide what is on show, then draw. Until you pick, that is whoever is waiting on you. */
  function settle() {
    if (drivenId && harnessRead && !findDriven(drivenId)) drivenId = view.id === drivenId ? drivenId : null;
    if (!picked) {
      const waiting = driven.find((s) => s.state === 'waiting');
      if (waiting) { drivenId = waiting.id; current = null; }
      else if (!drivenId && !current) {
        if (driven.length) drivenId = driven[0].id; else if (sessions.length) current = sessions[0].id;
      }
    }
    if (drivenId) current = null;
    renderNav();
  }

  function pick(kind, id) {
    picked = true;
    if (kind === 'driven') { drivenId = id; current = null; }
    else { current = id; drivenId = null; lastText = null; }
    renderNav();
    if (kind === 'driven') view.focus(); else poll(true);
  }

  function renderNav() {
    // what was handed over lately, or is still being worked on
    const recent = handed.filter((d) => !d.endedAt || net.now() - d.endedAt < 6 * 3600_000).slice(0, 5);
    const drivenItem = (s, cls = '') => h('div.item' + cls + (s.id === drivenId ? '.on' : ''), { onclick: () => pick('driven', s.id) },
      h('i.dot' + (stateDot(s) ? '.' + stateDot(s) : '')),
      h('div.grow', { style: { minWidth: 0 } }, h('div.clip', s.name || s.id), h('small.clip', { title: shortPath(s.cwd) }, [s.label, stateText(s), folder(s.cwd)].filter(Boolean).join(' · '))));
    replace(list,
      driven.length || past.length ? h('h3', 'Driven') : null,
      driven.map((s) => drivenItem(s)), past.map((s) => drivenItem(s, '.past')),
      sessions.length ? h('h3', 'Terminals') : null,
      sessions.map((s) => h('div.item' + (s.id === current ? '.on' : ''), { onclick: () => pick('term', s.id) },
        h('i.dot.' + (s.alive === false ? '' : 'working')),
        h('div.grow', { style: { minWidth: 0 } }, h('div.clip', sessionName(s)), h('small.clip', [s.runtimeLabel || s.provider || (s.observedOnly ? 'tmux' : ''), shortPath(s.cwd)].filter(Boolean).join(' · '))))),
      recent.length ? h('h3', 'Handed over') : null,
      recent.map((d) => h('div.item' + (d.to?.sessionId && d.to.sessionId === drivenId ? '.on' : ''), { title: d.error || d.result || d.task || '', onclick: () => openTask(d) },
        h('i.dot' + (TASK_DOT[d.status] ? '.' + TASK_DOT[d.status] : '')),
        h('div.grow', { style: { minWidth: 0 } }, h('div.clip', d.title || d.task || d.id),
          h('small.clip', `${d.from?.kind === 'human' ? 'you' : d.from?.name || 'someone'} → ${d.to?.name || 'nobody yet'} · ${TASK_TEXT[d.status] || d.status}`)))),
      driven.length || past.length || sessions.length || recent.length ? null : h('div.empty', status?.error || 'Nobody is running here yet.'));

    // the one switch that stops every turn nobody asked for
    const autos = wake && (driven.length || wake.paused) ? h('div.autos' + (wake.paused ? '.paused' : ''),
      h('span.grow', wake.paused ? 'automatic turns are paused' : 'automatic turns'),
      h('button.btn.small', { type: 'button', title: wake.paused ? 'Let mail start turns again' : 'Stop every turn that mail or a finished task would start, for everyone', onclick: () => pauseAll(!wake.paused) }, wake.paused ? 'Resume' : 'Pause')) : null;

    const cwd = h('input.field', { placeholder: 'folder (default: where the daemon runs)', spellcheck: false, value: launch.dataset.cwd || '' });
    cwd.addEventListener('input', () => { launch.dataset.cwd = cwd.value; });
    cwd.addEventListener('keydown', (e) => e.stopPropagation());
    const able = runtimes.filter((r) => r.launchable);
    const ready = adapters.filter((a) => a.available), absent = adapters.filter((a) => !a.available);
    replace(launch, autos, h('h3', 'Start'), cwd,
      ready.length ? h('div.row', ready.map((a) => h('button.btn.small', { type: 'button', title: `Start ${a.label} and talk to it from here${a.note ? ` — ${a.note}` : ''}`, onclick: (e) => drive(a, cwd.value.trim(), e.currentTarget) }, icon('plus'), a.label))) : null,
      able.length ? h('div.row', able.map((r) => h('button.btn.small.ghost', { type: 'button', title: `${r.note || r.label} — in a terminal`, onclick: () => spawn(r, cwd.value.trim()) }, icon('term'), r.shortLabel || r.label))) : null,
      ready.length || able.length ? null : h('div.faint', { style: { fontSize: '12px' } }, status?.error && harnessOff ? status.error : 'Nothing that can be started was found on this machine.'),
      absent.length && !harnessOff ? h('details', h('summary', `${absent.length} more could be driven`), absent.map((a) => h('p', h('b', a.label), a.note ? ` — ${a.note}` : ' — not installed here'))) : null,
      harnessNote ? h('div.faint', { style: { fontSize: '12px' } }, harnessNote) : null);

    const d = drivenId ? findDriven(drivenId) : null;
    const s = d ? null : sessions.find((x) => x.id === current);
    term.classList.toggle('hidden', !!d);
    view.show(d);
    title.textContent = d ? `${d.name || d.id} — ${[d.label, d.model, folder(d.cwd)].filter(Boolean).join(' · ')}`
      : s ? `${sessionName(s)}${s.cwd ? ' — ' + shortPath(s.cwd) : ''}` : '';
    killBtn.classList.toggle('hidden', !s || s.observedOnly);
    input.disabled = !s;
  }

  /** A handed-over task is read where it was done: in the record of whoever did it. */
  async function openTask(d) {
    const id = d.to?.sessionId;
    if (!id) { ui.toast('Nobody has picked that up yet.'); return; }
    if (!findDriven(id)) await loadHarness();
    if (findDriven(id)) pick('driven', id); else ui.toast('That session is no longer on record.');
  }

  async function drive(adapter, cwd, button) {
    if (button) button.disabled = true;
    try {
      const res = await net.api('/api/harness/sessions', { method: 'POST', body: { adapter: adapter.id, cwd: cwd || undefined } });
      if (res.session) { driven = [...driven.filter((s) => s.id !== res.session.id), res.session]; pick('driven', res.session.id); }
      if (res.starting) ui.toast(`${adapter.label} is still starting.`);
    } catch (err) { ui.toast(`Could not start ${adapter.label}: ${err.message}`); }
    if (button) button.disabled = false;
  }

  async function pauseAll(paused) {
    try { await net.api('/api/harness/wake', { method: 'POST', body: { paused } }); if (wake) wake = { ...wake, paused }; renderNav(); }
    catch (err) { ui.toast(err.message); }
  }

  async function spawn(runtime, cwd) {
    try {
      const s = await net.api('/api/terminal/spawn', { method: 'POST', body: { runtimeId: runtime.id, provider: runtime.provider, cwd: cwd || undefined } });
      picked = true; drivenId = null;
      current = s?.id || s?.session?.id || current;
      lastText = null;
      await loadSessions();
      poll(true);
      screen.focus();
    } catch (err) { ui.toast(`Could not launch ${runtime.label}: ${err.message}`); }
  }

  async function kill() {
    if (!current) return;
    try { await net.api(`/api/terminal/${encodeURIComponent(current)}`, { method: 'DELETE' }); } catch (err) { ui.toast(err.message); }
    current = null; lastText = null; replace(screen);
    loadSessions();
  }

  async function poll(now = false) {
    clearTimeout(timer);
    if (closed || !screen.isConnected) return;
    if (now) fast = 8;
    if (dead) { /* terminals cannot be reached from here; the driven list still can */ }
    else if (current) {
      try {
        const snap = await net.api(`/api/terminal/${encodeURIComponent(current)}/snapshot?lines=300&ansi=1`);
        if (snap.text !== lastText) {
          const stick = screen.scrollHeight - screen.scrollTop - screen.clientHeight < 40 || lastText === null;
          lastText = snap.text;
          replace(screen, renderAnsi(snap.text || ''));
          if (stick) screen.scrollTop = screen.scrollHeight;
        }
      } catch (err) {
        if (lastText !== '\u0000') { lastText = '\u0000'; replace(screen, h('span.faint', `(this session is not answering: ${err.message})`)); loadSessions(); }
      }
    } else if (lastText !== '') { lastText = ''; replace(screen, h('span.faint', 'Pick a session on the left, or launch one.')); }
    timer = setTimeout(poll, fast-- > 0 ? 220 : document.hidden ? 4000 : 900);
  }

  async function press(keys) {
    if (!current) return;
    try { await net.api(`/api/terminal/${encodeURIComponent(current)}/input`, { method: 'POST', body: { keys } }); poll(true); }
    catch (err) { ui.toast(err.message); }
  }
  async function type(text, enter = false) {
    if (!current) return;
    try { await net.api(`/api/terminal/${encodeURIComponent(current)}/input`, { method: 'POST', body: { text, enter } }); poll(true); }
    catch (err) { ui.toast(err.message); }
  }

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); type(input.value, true); input.value = ''; }
    else if (e.key === 'Escape' && !input.value) press(['Escape']);
  });
  // click the screen and it is a keyboard: every key goes straight to the pane
  let queue = '', flushTimer = null;
  const flushKeys = () => { const t = queue; queue = ''; if (t) type(t, false); };
  screen.addEventListener('keydown', (e) => {
    if (e.metaKey) return;                                          // leave the browser its shortcuts
    e.stopPropagation();
    let named = null;
    if (e.ctrlKey && CTRL[e.key.toLowerCase()]) named = CTRL[e.key.toLowerCase()];
    else if (!e.ctrlKey && !e.altKey && KEYMAP[e.key]) named = e.shiftKey && e.key === 'Tab' ? 'BTab' : KEYMAP[e.key];
    if (named) { e.preventDefault(); clearTimeout(flushTimer); flushKeys(); press([named]); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      queue += e.key;
      clearTimeout(flushTimer); flushTimer = setTimeout(flushKeys, 45);        // batch fast typing into one call
    }
  });
  screen.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData?.getData('text') || ''; if (t) type(t, false); });

  const offTasks = net.on('delegations', (m) => {
    const d = m.delegation;
    if (!d?.id) return;
    handed = [d, ...handed.filter((x) => x.id !== d.id)].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
    renderNav();
  });
  // the office says so whenever a driven session changes; finished ones are asked for now and then
  const offHarness = net.on('harness', (m) => {
    wake = m.wake || wake;
    const live = m.sessions || [];
    const ids = new Set(live.map((s) => s.id));
    const gone = driven.filter((s) => !ids.has(s.id));
    driven = live.filter((s) => s.live !== false && s.state !== 'ended' && s.state !== 'failed');
    if (gone.length) loadHarness(); else settle();
  });

  Promise.all([loadSessions(), loadHarness()]).then(() => poll(true));
  const refresh = setInterval(loadSessions, 8000);
  return {
    close: () => { clearTimeout(timer); clearInterval(refresh); clearTimeout(flushTimer); dead = true; closed = true; offHarness(); offTasks(); view.close(); net.send({ type: 'transcript:watch', sessionId: '' }); },
    show: (a) => {
      if (a?.driven) pick('driven', a.driven);
      else if (a?.sessionId) pick('term', a.sessionId);
    },
  };
}
