// office chat — the office as a plain terminal conversation.
//
//   office chat                    the session that was busy last, or none yet
//   office chat <session|name|n>   that one
//   office chat new <agent> [folder]   start an agent in this folder and talk to it
//
// The same console as the one in the browser (/console/): both are drawn from
// core/console.mjs, so they say the same things and take the same commands
// (/help lists them). Type to give the agent a turn; Esc stops the turn in
// flight; when it asks for something, y allows once, a allows for the session,
// n refuses. Ctrl-C twice (or /quit) leaves — the agents keep working.
//
// On a terminal the bottom of the screen is live: the reply as it arrives,
// tools while they run, the request that is waiting, the line you are typing
// and a status line. Everything above it has been written down for good and
// scrolls like any other output. Piped (`echo "run the tests" | office chat ada`)
// it is plain lines: it sends what it was given, prints what comes back, and
// leaves when the agent has finished.
import readline from 'node:readline';
import os from 'node:os';
import { api, BASE, OfficeError } from './office-lib.mjs';
import { createConsole, choicesOf, complete, parseInput, wrap, width, wordsAction } from './core/console.mjs';

const ANSI = { dim: '2', bold: '1', user: '1', say: '38;5;215', tool: '1', ok: '32', err: '31', warn: '33', ask: '1;33', code: '36', head: '1;4', add: '32', del: '31', key: '1;36' };
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const KEPT_ROWS = 400;                         // written rows remembered, to draw again when the window changes size

/** Rows of spans → text, coloured when `color`. */
function paint(rows, color) {
  return rows.map((row) => row.map(([text, style]) => (color && ANSI[style] ? `\x1b[${ANSI[style]}m${text}\x1b[0m` : text)).join(''));
}

/** Everything the daemon says, over its WebSocket where this Node has one, and by asking again and again where not. */
function wire({ onHarness, onPrompts, onUsage, onEntry, onStatus }) {
  let watching = null, ws = null, closed = false, retry = 0, timer = null, seq = 0;
  const refresh = async () => {
    const [h, p, u] = await Promise.all([api('/api/harness'), api('/api/prompts').catch(() => []), api('/api/usage').catch(() => null)]);
    onHarness(h); onPrompts(Array.isArray(p) ? p : []); if (u) onUsage(u);
  };
  function connect() {
    if (closed || typeof WebSocket !== 'function') return;
    ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/');
    ws.addEventListener('open', () => { retry = 0; onStatus(true); if (watching) ws.send(JSON.stringify({ type: 'transcript:watch', sessionId: watching })); refresh().catch(() => {}); });
    ws.addEventListener('message', (m) => {
      let e; try { e = JSON.parse(m.data); } catch { return; }
      if (e.type === 'harness') onHarness(e);
      else if (e.type === 'prompts') onPrompts(e.prompts || []);
      else if (e.type === 'usage') onUsage(e.usage);
      else if (e.type === 'transcript') { seq = Math.max(seq, e.entry?.seq || 0); onEntry(e.sessionId, e.entry); }
    });
    ws.addEventListener('close', () => { if (closed) return; onStatus(false); const t = setTimeout(connect, Math.min(5000, 400 * ++retry)); t.unref?.(); });
    ws.addEventListener('error', () => { try { ws.close(); } catch { /* already closing */ } });
  }
  // no WebSocket in this Node (before 22): the same picture, a little later
  async function poll() {
    if (closed) return;
    try {
      await refresh();
      if (watching) {
        const page = await api(`/api/harness/sessions/${encodeURIComponent(watching)}/transcript?after=${seq}&limit=200`);
        for (const e of page.entries || []) { seq = Math.max(seq, e.seq || 0); onEntry(watching, e); }
      }
      onStatus(true);
    } catch { onStatus(false); }
    timer = setTimeout(poll, 700); timer.unref?.();
  }
  return {
    start: async () => { await refresh(); if (typeof WebSocket === 'function') connect(); else poll(); },
    watch(id) { watching = id; seq = 0; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'transcript:watch', sessionId: id || '*' })); },
    seen(n) { seq = Math.max(seq, n || 0); },
    close() { closed = true; clearTimeout(timer); try { ws?.close(); } catch { /* gone */ } },
  };
}

/**
 * @param {{words?:string[], flags?:object, input?:NodeJS.ReadStream, output?:NodeJS.WriteStream}} [opt]
 *        input/output: the terminal (the process's own, unless a test brings one)
 * @returns {Promise<number>}  the exit code, once the person has left
 */
export async function chat({ words = [], flags = {}, input = process.stdin, output = process.stdout } = {}) {
  const tty = !!(input.isTTY && output.isTTY) && !flags.plain;
  const color = !flags.plain && !process.env.NO_COLOR && (output.isTTY || process.env.FORCE_COLOR);
  const cols = () => (output.isTTY ? Math.max(20, output.columns || 100) : 10_000);   // a pipe gets whole lines: folding them is its reader's business

  /* ---- the screen: rows written for good, and a live part under them --------------------------- */
  const kept = [];                         // rows already written (strings), for a resize
  let liveRows = 0;                        // how many rows of the live part are above the cursor right now
  let dirty = false, scheduled = false, done = false, wrote = false;
  const live = new Map();                  // block key → block still changing
  const written = new Map();               // block key → how many of its lines have been written down
  const partial = new Map();               // block key → { index, length }: a line written down before it was finished
  const pendingStatic = [];                // rows waiting to be written above the live part

  let line = '', caret = 0, history = [], histAt = -1, draft = '', lastCtrlC = 0, connected = true, since = 0, spin = 0, pasting = false;

  const emitRows = (lines, indent = 2) => { for (const l of lines) for (const row of wrap(l, cols(), indent)) pendingStatic.push(row); wrote = true; };
  const blank = () => { pendingStatic.push([]); wrote = true; };
  function schedule() { dirty = true; if (scheduled || done) return; scheduled = true; setImmediate(() => { scheduled = false; if (dirty) render(); }); }

  function inputRows() {
    // hard-wrapped by column, so the caret can be found exactly
    const w = cols() - 2, rows = [];
    let text = '', col = 0, offset = 0, caretRow = 0, caretCol = 2;
    const flush = () => { rows.push([[rows.length ? '  ' : '> ', 'user'], [text, '']]); text = ''; col = 0; };
    const mark = () => { caretRow = rows.length; caretCol = 2 + col; };
    if (caret === 0) mark();
    for (const ch of line) {
      if (ch === '\n') flush();
      else { const cw = width(ch); if (col + cw > w) flush(); text += ch; col += cw; }
      offset += ch.length;
      if (offset === caret) mark();
    }
    flush();
    return { rows, caretRow, caretCol };
  }

  function liveLines() {
    const out = [];
    for (const b of live.values()) {
      const n = written.get(b.key) || 0;
      const rest = b.lines.slice(n);
      if (rest.length) out.push(...rest);
    }
    const s = con.session();
    if (s && (s.state === 'running' || s.state === 'starting')) {
      const secs = since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0;
      out.push([[`${SPIN[spin % SPIN.length]} `, 'say'], [s.state === 'starting' ? 'starting…' : 'working…', 'dim'], [secs ? `  ${secs}s` : '', 'dim'], ['  esc to stop', 'dim']]);
    }
    return out;
  }

  function statusRow() {
    const [left, right] = con.status();
    const l = connected ? left : [['office not reachable — trying again', 'err']];
    const lw = l.reduce((n, [t]) => n + width(t), 0), rw = right.reduce((n, [t]) => n + width(t), 0);
    const gap = cols() - lw - rw - 1;
    return gap >= 2 ? [...l, [' '.repeat(gap), ''], ...right] : wrap(l, cols() - 1)[0];
  }

  function render() {
    dirty = false;
    if (done) return;
    if (!tty) {                                                    // plain: whatever has settled, as lines
      const rows = paint(pendingStatic.splice(0), color);
      if (rows.length) output.write(rows.join('\n') + '\n');
      return;
    }
    let s = '';
    if (liveRows) s += `\x1b[${liveRows}A`;
    s += '\r\x1b[J';
    // every row ends with a carriage return of its own: a terminal in raw mode need not add one
    const fresh = paint(pendingStatic.splice(0), color);
    for (const r of fresh) { s += r + '\r\n'; kept.push(r); }
    if (kept.length > KEPT_ROWS) kept.splice(0, kept.length - KEPT_ROWS);
    const { rows: inRows, caretRow, caretCol } = inputRows();
    // the live part must fit on the screen: what cannot be reached by the cursor cannot be drawn over again
    const room = Math.max(3, (output.rows || 24) - inRows.length - 3);
    const liveText = paint(liveLines().flatMap((l) => wrap(l, cols(), 2)), color).slice(-room);
    const inText = paint(inRows, color), status = paint([statusRow()], color)[0];
    const all = [...liveText, ...(liveText.length ? [''] : []), ...inText, status];
    s += all.join('\r\n');
    // leave the cursor where the next character will go
    const caretAt = liveText.length + (liveText.length ? 1 : 0) + caretRow;
    const up = all.length - 1 - caretAt;
    if (up > 0) s += `\x1b[${up}A`;
    s += `\r\x1b[${caretCol}C`;
    liveRows = caretAt;
    output.write(s);
  }

  function redrawAll() {
    if (!tty) return;
    output.write('\x1b[2J\x1b[H' + (kept.length ? kept.slice(-Math.max(10, (output.rows || 40) * 3)).join('\r\n') + '\r\n' : ''));
    liveRows = 0;
    render();
  }

  /* ---- the console ------------------------------------------------------------------------------ */
  const net = wire({
    onHarness: (h) => con.harness(h), onPrompts: (p) => con.prompts(p), onUsage: (u) => con.usage(u),
    onEntry: (id, e) => con.entry(id, e), onStatus: (ok) => { if (ok !== connected) { connected = ok; schedule(); } },
  });
  const con = createConsole({
    api: (path, opt = {}) => api(path, { ...opt, timeoutMs: 20_000 }),
    watch: (id) => net.watch(id),
    cwd: process.cwd(), home: os.homedir(),
    ...(tty ? {} : { choices: false }),                            // keys nobody can press are not offered
    clear: () => { kept.length = 0; if (tty) { output.write('\x1b[2J\x1b[3J\x1b[H'); liveRows = 0; } schedule(); },
    office: () => { emitRows([[['The office is at ', 'dim'], [BASE + '/', 'key']]]); schedule(); },
    project: async () => { const s = con.session(); if (!s) return null; const a = await api(`/api/agents/${encodeURIComponent(s.id)}`).catch(() => null); return (a?.agent || a)?.department || null; },
    quit: () => leave(0),
  });

  con.on('say', (lines) => { emitRows(lines, 4); schedule(); });
  con.on('reset', (s, again) => {
    live.clear(); written.clear(); partial.clear();
    if (!again) { blank(); emitRows([[['── ', 'dim'], [s.name || s.label || 'session', 'bold'], [' ──', 'dim']]]); }
    schedule();
  });
  const textOf = (l) => l.map(([t]) => t).join('');
  const streams = (b) => b.entry.kind === 'message' || b.entry.kind === 'thought';
  const airy = (b) => b.gap || ['message', 'tool', 'permission', 'question'].includes(b.entry.kind);
  /** Write down lines [had, upto) of a block. A line that was written while still growing gets its new end on a row of its own. */
  function commit(b, upto) {
    const had = written.get(b.key) || 0;
    const cut = partial.get(b.key);
    if (cut && b.lines[cut.index] && textOf(b.lines[cut.index]).length > cut.length) {
      emitRows([[['  ', ''], [textOf(b.lines[cut.index]).slice(cut.length), '']]]);
      partial.delete(b.key);
    }
    if (upto <= had) return;
    if (had === 0 && airy(b) && wrote) blank();
    emitRows(b.lines.slice(had, upto));
    written.set(b.key, upto);
  }
  con.on('block', (b) => {
    net.seen(b.entry?.seq);
    if (!b.live || !streams(b)) {
      // something later is about to be written: what a reply above it has said so far goes down first, as it stands
      for (const other of live.values()) {
        if (other.key === b.key || !streams(other) || (written.get(other.key) || 0) >= other.lines.length) continue;
        const last = other.lines.length - 1;
        commit(other, other.lines.length);
        partial.set(other.key, { index: last, length: textOf(other.lines[last]).length });
      }
    }
    // text only ever grows: every line of a reply but the one still being written can be written down now
    if (b.live) { if (streams(b)) commit(b, Math.max(written.get(b.key) || 0, b.lines.length - 1)); live.set(b.key, b); }
    else { commit(b, b.lines.length); live.delete(b.key); partial.delete(b.key); }
    schedule();
  });
  con.on('state', () => {
    const s = con.session();
    if (s?.state === 'running' || s?.state === 'starting') { if (!since) since = s.turn?.startedAt || Date.now(); } else since = 0;
    schedule();
  });

  /* ---- leaving ------------------------------------------------------------------------------------ */
  let ticker = null, resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  function leave(code = 0) {
    if (done) return;
    clearInterval(ticker);
    // whatever was still changing is written down as it stands: a reply half said, a request not yet answered
    for (const b of live.values()) commit(b, b.lines.length);
    live.clear();
    if (tty) {
      // …in place of the live part, and then the terminal is given back
      let s = (liveRows ? `\x1b[${liveRows}A` : '') + '\r\x1b[J';
      for (const r of paint(pendingStatic.splice(0), color)) s += r + '\r\n';
      output.write(s + '\x1b[?2004l');
      try { input.setRawMode(false); } catch { /* not ours to set */ }
    } else render();
    done = true;
    net.close();
    input.pause();
    resolveDone(code);
  }

  /* ---- start ---------------------------------------------------------------------------------------- */
  try { await net.start(); }
  catch (err) { throw err instanceof OfficeError ? err : new OfficeError(String(err?.message || err), 0); }

  const first = (words[0] || '').toLowerCase();
  if (first === 'new') await con.submit(`/new ${words.slice(1).join(' ')}${typeof flags.mode === 'string' ? ` --mode ${flags.mode}` : ''}${typeof flags.model === 'string' ? ` --model ${flags.model}` : ''}${typeof flags.name === 'string' ? ` --name ${flags.name}` : ''}`);
  else if (words.length) { if (!(await con.open(words.join(' ')))) { /* said so */ } }
  else {
    const s = [...con.state.sessions].filter((x) => x.live !== false).sort((a, b) => (b.turn?.startedAt || b.startedAt || 0) - (a.turn?.startedAt || a.startedAt || 0))[0];
    if (s) await con.open(s, { limit: 80 }); else await con.submit('/sessions');
  }

  if (!tty) {
    // piped: send what we were given, print what comes back, leave when the agent has finished
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    for await (const text of rl) { if (text.trim()) await con.submit(text); render(); }
    // the office announces a change of state a moment after it happens, so ask it rather than trust what we last heard
    const busy = async () => {
      const s = con.session();
      if (!s) return false;
      const fresh = (await api(`/api/harness/sessions/${encodeURIComponent(s.id)}`).catch(() => null))?.session;
      if (fresh) con.harness({ sessions: con.state.sessions.map((x) => (x.id === fresh.id ? fresh : x)) });
      const now = fresh || s;
      return now.state === 'running' || now.state === 'starting' || !!now.queued;
    };
    const limit = Date.now() + (Number(flags.wait) > 0 ? Number(flags.wait) * 1000 : 30 * 60 * 1000);
    while (Date.now() < limit && await busy()) { await new Promise((r) => setTimeout(r, 200)); render(); }
    await new Promise((r) => setTimeout(r, 350));                 // the last entries of the turn are still on their way
    render();
    const waiting = con.pending();
    if (waiting) {
      for (const b of live.values()) commit(b, b.lines.length);    // the request itself, before saying that it waits
      live.clear();
      emitRows([[['It is waiting for an answer, which a pipe cannot give: ', 'warn'], ['office chat', 'key'], [' in a terminal, or the office itself.', 'warn']]]);
    }
    leave(waiting ? 3 : 0);
    return finished;
  }

  /* ---- keys ----------------------------------------------------------------------------------------- */
  input.on('data', (chunk) => { const t = String(chunk); pasting = t.length > 3 && /[\r\n]/.test(t.slice(0, -1)); if (pasting) setImmediate(() => { pasting = false; }); });
  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  output.write('\x1b[?2004h');
  output.on('resize', redrawAll);
  ticker = setInterval(() => { const s = con.session(); if (s && (s.state === 'running' || s.state === 'starting')) { spin++; schedule(); } }, 120);
  ticker.unref?.();

  const insert = (text) => { line = line.slice(0, caret) + text + line.slice(caret); caret += text.length; };
  const setLine = (text) => { line = text; caret = text.length; };
  async function send() {
    const text = line;
    setLine('');
    if (text.trim()) { history.unshift(text); if (history.length > 200) history.pop(); }
    histAt = -1;
    // a turn comes back as part of the record; a command of ours does not, so it is noted here
    if (parseInput(text).kind === 'command') emitRows([[['> ', 'dim'], [text.trim(), 'dim']]]);
    schedule();
    await con.submit(text);
    schedule();
  }

  input.on('keypress', (str, key = {}) => {
    if (done) return;
    const name = key.name || '';
    if (key.ctrl && name === 'c') {
      if (line) { setLine(''); schedule(); return; }
      const now = Date.now();
      if (now - lastCtrlC < 2000) return leave(0);
      lastCtrlC = now;
      con.stop().then((stopped) => { if (!stopped) { emitRows([[['Ctrl-C again to leave (the agents keep working).', 'dim']]]); schedule(); } });
      return;
    }
    if (key.ctrl && name === 'd') { if (!line) leave(0); return; }
    if (key.ctrl && name === 'l') return redrawAll();
    if (name === 'escape') { if (line) setLine(''); else con.stop(); schedule(); return; }
    if (name === 'return' || name === 'enter') {
      if (pasting || key.meta || key.shift) insert('\n');
      else if (line.endsWith('\\') && caret === line.length) { line = line.slice(0, -1) + '\n'; caret = line.length; }
      else { send(); return; }
      schedule(); return;
    }
    if (name === 'backspace') { if (caret > 0) { const before = [...line.slice(0, caret)]; before.pop(); const head = before.join(''); line = head + line.slice(caret); caret = head.length; } schedule(); return; }
    if (name === 'delete') { if (caret < line.length) { const after = [...line.slice(caret)]; after.shift(); line = line.slice(0, caret) + after.join(''); } schedule(); return; }
    if (name === 'left') { if (caret > 0) caret -= [...line.slice(0, caret)].pop().length; schedule(); return; }
    if (name === 'right') { if (caret < line.length) caret += [...line.slice(caret)][0].length; schedule(); return; }
    if (name === 'home' || (key.ctrl && name === 'a')) { caret = line.lastIndexOf('\n', caret - 1) + 1; schedule(); return; }
    if (name === 'end' || (key.ctrl && name === 'e')) { const n = line.indexOf('\n', caret); caret = n === -1 ? line.length : n; schedule(); return; }
    if (key.ctrl && name === 'u') { line = line.slice(caret); caret = 0; schedule(); return; }
    if (key.ctrl && name === 'k') { line = line.slice(0, caret); schedule(); return; }
    if (key.ctrl && name === 'w') { const head = line.slice(0, caret).replace(/\S+\s*$/, ''); line = head + line.slice(caret); caret = head.length; schedule(); return; }
    if (name === 'up' || name === 'down') {
      if (line.includes('\n')) return;
      if (histAt === -1) draft = line;
      histAt = Math.max(-1, Math.min(history.length - 1, histAt + (name === 'up' ? 1 : -1)));
      setLine(histAt === -1 ? draft : history[histAt]);
      schedule(); return;
    }
    if (name === 'tab') {
      const options = complete(line);
      if (options.length === 1) setLine(`/${options[0]} `);
      else if (options.length > 1) emitRows([[[options.map((o) => '/' + o).join('  '), 'dim']]]);
      schedule(); return;
    }
    if (!str || key.ctrl || (key.meta && name !== 'return')) return;
    // on an empty line, one key answers whatever is waiting for an answer
    if (!line && str.length === 1) {
      const p = con.pending();
      if (p && (choicesOf(p).some((c) => c.key === str) || (wordsAction(p) && /^[1-9]$/.test(str) && p.ask?.questions?.length === 1 && (p.ask.questions[0].options || [])[Number(str) - 1]))) {
        con.key(str).then(schedule);
        return;
      }
    }
    // eslint-disable-next-line no-control-regex
    insert(pasting ? str.replace(/\r\n?/g, '\n') : str.replace(/[\u0000-\u001f\u007f]/g, ''));
    schedule();
  });

  schedule();
  return finished;
}
