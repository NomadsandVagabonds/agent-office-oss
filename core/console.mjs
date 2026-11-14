// The Office — the console: a session read the way a terminal would show it.
//
// The office is a place; sometimes you only want the conversation. This is
// the words half of that, shared by the two consoles — the browser one
// (public/console/) and the terminal one (`office chat`) — so that they say
// the same things and take the same commands:
//
//   renderEntry(entry, opt)   one transcript entry → lines of styled spans
//   COMMANDS / parseInput     what a line typed at the prompt means
//   createConsole(io)         the state of a console and everything it can do;
//                             the wire and the screen are supplied from outside
//
// Pure: no DOM, no Node. A line is a list of [text, style] spans; a style is
// one of STYLES, which the browser turns into a class and the terminal into a
// colour. Nothing here knows which agent is on the other end: what can be done
// to a session is whatever the session says can be done (`session.controls`),
// and a request is answered with whatever the request says answers it
// (`prompt.respond.actions`) — see docs/HARNESS.md, section 14.

export const STYLES = Object.freeze(['', 'dim', 'bold', 'user', 'say', 'tool', 'ok', 'err', 'warn', 'ask', 'code', 'head', 'add', 'del', 'key']);

/* ---- small things ---------------------------------------------------------------------- */

const span = (text, style = '') => [String(text ?? ''), style];
const line = (...spans) => spans.filter((s) => s && s[0] !== '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const secs = (ms) => (ms < 950 ? `${Math.max(1, Math.round(ms / 100)) / 10}s` : ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`);

/** A folder short enough for a line: the last two names of a long path. */
export function shortFolder(p, home = '') {
  let s = String(p || '');
  if (home && (s === home || s.startsWith(home + '/'))) s = '~' + s.slice(home.length);
  const parts = s.split('/').filter(Boolean);
  return parts.length > 3 ? `…/${parts.slice(-2).join('/')}` : s;
}

/** How many columns a string takes: one each, two for the wide East Asian and emoji ranges, none for joiners. */
export function width(text) {
  let n = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c === 0x200d || (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0x300 && c <= 0x36f)) continue;
    n += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff)
      || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff))) ? 2 : 1;
  }
  return n;
}

/**
 * Fold one line to a width: rows of spans, broken at a space where there is one. Rows after the first start with
 * `indent` spaces, so that a wrapped reply stays under its own first word.
 */
export function wrap(spans, cols, indent = 0) {
  const max = Math.max(8, cols | 0);
  const rows = [[]];
  let used = 0;
  const push = (text, style) => { if (text) { rows[rows.length - 1].push([text, style]); used += width(text); } };
  const newRow = () => { rows.push(indent ? [[' '.repeat(indent), '']] : []); used = indent; };
  for (const [text, style] of spans) {
    for (const piece of String(text).split(/(\s+)/)) {
      if (!piece) continue;
      const w = width(piece);
      if (used + w <= max) { push(piece, style); continue; }
      if (/^\s+$/.test(piece)) { newRow(); continue; }                 // the space the row broke at is not carried over
      if (w <= max - indent) { newRow(); push(piece, style); continue; }
      let rest = piece;                                                // one word longer than a row: cut it where it falls
      while (rest) {
        let take = '', tw = 0;
        for (const ch of rest) { const cw = width(ch); if (used + tw + cw > max) break; take += ch; tw += cw; }
        if (!take) { newRow(); continue; }
        push(take, style); rest = rest.slice(take.length);
        if (rest) newRow();
      }
    }
  }
  return rows;
}

/* ---- a reply, as the little Markdown agents write --------------------------------------- */

function inline(text, base = '') {
  const out = [];
  for (const part of String(text).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/)) {
    if (!part) continue;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) out.push([part.slice(1, -1), 'code']);
    else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) out.push([part.slice(2, -2), 'bold']);
    else out.push([part, base]);
  }
  return out;
}

/** Text → lines. Fenced code is left exactly as written; headings, `code` and **bold** are marked; nothing else is touched. */
export function markdown(text, base = '') {
  const out = [];
  let fence = false;
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; out.push([[raw, 'dim']]); continue; }
    if (fence) { out.push([[raw, 'code']]); continue; }
    const head = /^(#{1,6})\s+(.+?)\s*#*$/.exec(raw);
    if (head) { out.push([[head[2], 'head']]); continue; }
    out.push(inline(raw, base));
  }
  return out;
}

/* ---- one entry of a transcript ------------------------------------------------------------ */

const TURN_FROM = { wake: (e) => `woken by mail${e.from ? ` from ${e.from}` : ''}`, delegation: (e) => `a task from ${e.from || e.by || 'a teammate'}`, handoff: () => 'handed over' };
const ANSWERED = { allowed: ['✓', 'ok', 'allowed'], 'allowed-session': ['✓', 'ok', 'allowed'], 'auto-allowed': ['✓', 'ok', 'allowed'], rejected: ['✗', 'err', 'denied'],
  withdrawn: ['·', 'dim', 'withdrawn'], answered: ['✓', 'ok', 'answered'] };
const PLAN_MARK = { completed: '☒', in_progress: '◐', running: '◐' };
const CHANGE_MARK = { added: 'A', deleted: 'D', renamed: 'R', modified: 'M' };

/** Has this entry said its last word? (A reply still streaming, a tool still running, a question still open have not.) */
export function settled(e) {
  switch (e?.kind) {
    case 'message': case 'thought': return !e.streaming;
    case 'tool': return e.status === 'completed' || e.status === 'failed';
    case 'turn': return e.state !== 'running';
    case 'permission': case 'question': return e.state !== 'asked';
    case 'session': return e.state !== 'starting';
    default: return true;
  }
}

/** Which stage of its life an entry is at, for the two kinds that are written down more than once (see createConsole). */
const stage = (e) => (e.kind === 'session' ? (e.state === 'ended' || e.state === 'failed' ? 'end' : 'start') : e.kind === 'turn' ? (e.state === 'running' ? 'start' : 'end') : '');

/** The first line of some marked text, then the rest indented under it. */
function marked(mark, markStyle, lines, indent = 2) {
  if (!lines.length) return [];
  return lines.map((l, i) => (i === 0 ? [[mark, markStyle], ...l] : [[' '.repeat(indent), ''], ...l]));
}

/** At most `keep` lines from the end of some output, saying how many were left out. */
function tailLines(text, keep) {
  const all = String(text || '').replace(/\s+$/, '').split('\n');
  if (!Number.isFinite(keep) || all.length <= keep) return { lines: all, more: 0 };
  return { lines: all.slice(-keep), more: all.length - keep };
}

/**
 * One transcript entry as lines. `opt.full` shows whole tool output and reasoning; `opt.prompt` is the open request
 * behind a permission or a question that is still waiting (so its choices can be listed — `opt.choices: false` leaves
 * that list out, for a screen that draws them as buttons); `opt.home` shortens folders.
 * An entry this console does not know draws nothing: a newer daemon must not break an older client.
 */
export function renderEntry(e, opt = {}) {
  const full = !!opt.full;
  switch (e?.kind) {
    case 'session': {
      if (e.state === 'ended' || e.state === 'failed') return [line(span('■ ', e.state === 'failed' ? 'err' : 'dim'), span(`session ${e.state}${e.reason ? `: ${e.reason}` : ''}`, e.state === 'failed' ? 'err' : 'dim'))];
      const bits = [e.label || e.adapter, e.model, e.modeLabel, shortFolder(e.cwd, opt.home)].filter(Boolean).join(' · ');
      return [line(span('◆ ', 'say'), span(bits, 'dim'), e.state === 'starting' ? span('  starting…', 'dim') : null)];
    }
    case 'turn': {
      if (e.state === 'running') {
        const from = (TURN_FROM[e.origin] || (() => ''))(e);
        return from ? [line(span(`· ${from}`, 'dim'))] : [];
      }
      if (e.state === 'completed') return [line(span(`  ✓ ${e.durationMs ? secs(e.durationMs) : 'done'}${e.tools ? ` · ${plural(e.tools, 'tool')}` : ''}`, 'dim'))];
      if (e.state === 'interrupted') return [line(span(`  ■ stopped${e.stoppedBy ? ` by ${e.stoppedBy}` : ''}`, 'warn'))];
      return [line(span(`  ✗ ${e.state || 'failed'}${e.error ? `: ${e.error}` : ''}`, 'err'))];
    }
    case 'user': {
      // a task or mail arrives inside the office's own wrapper: show what was asked
      const framed = /^<(delegated_task|office_mail)\b[^>]*>\s*([\s\S]*?)\s*<\/\1>/.exec(e.text || '');
      const text = framed ? framed[2] : (e.text || '');
      return marked('> ', 'user', text.split('\n').map((t) => [[t, 'user']]));
    }
    case 'message': return marked('● ', 'say', markdown(e.text || ''));
    case 'thought': {
      const all = String(e.text || '').trim().split('\n');
      const shown = full ? all : all.slice(0, 3);
      const lines = shown.map((t) => [[t, 'dim']]);
      if (!full && all.length > shown.length) lines.push([[`… ${plural(all.length - shown.length, 'more line')}`, 'dim']]);
      return marked('∴ ', 'dim', lines);
    }
    case 'tool': {
      const status = e.status || 'pending';
      const name = e.name || 'Tool';
      // "Edit" then "Edit db/a.sql" says the verb twice: the command, else the files, else the title without it
      const what = e.command || (e.paths || []).join(', ') || (e.title && e.title.toLowerCase().startsWith(name.toLowerCase() + ' ') ? e.title.slice(name.length + 1) : e.title) || '';
      const mark = status === 'completed' ? 'ok' : status === 'failed' ? 'err' : 'warn';
      const tail = status === 'failed' ? `  ✗${Number.isInteger(e.exitCode) ? ` exit ${e.exitCode}` : ' failed'}` : status === 'completed' ? '' : status === 'pending' ? '  waiting' : '  …';
      const out = [line(span('● ', mark), span(name, 'tool'), what ? span(`(${what})`, '') : null, tail ? span(tail, status === 'failed' ? 'err' : 'dim') : null)];
      if (e.output) {
        const { lines, more } = tailLines(e.output, full ? Infinity : 5);
        if (more) out.push(line(span(`  ⎿  … ${plural(more, 'earlier line')}`, 'dim')));
        lines.forEach((t, i) => out.push(line(span(i === 0 && !more ? '  ⎿  ' : '     ', 'dim'), span(t, 'dim'))));
      }
      return out;
    }
    case 'plan': return (e.entries || []).map((p) => line(span(`  ${PLAN_MARK[p.status] || '☐'} `, p.status === 'completed' ? 'dim' : ''), span(p.text || '', p.status === 'completed' ? 'dim' : p.status === 'pending' || !p.status ? '' : 'bold')));
    case 'permission': case 'question': {
      const isQ = e.kind === 'question';
      const what = isQ ? (e.text || '') : (e.command || e.title || (e.paths || []).join(', ') || 'something');
      if (e.state !== 'asked') {
        const [mark, style, word] = ANSWERED[e.state] || ['·', 'dim', e.state || ''];
        const by = e.state === 'auto-allowed' ? (e.reason || 'already allowed')
          : [e.by ? `by ${e.by}` : '', e.state === 'allowed-session' && e.grant ? 'for the rest of the session' : '', e.reason || ''].filter(Boolean).join(' · ');
        return [line(span(`  ${mark} `, style), span(`${word}: `, style), span(what.split('\n')[0], 'dim'), isQ && e.answer ? span(`  → ${e.answer}`, 'user') : null, by ? span(`  (${by})`, 'dim') : null)];
      }
      const p = opt.prompt || null;
      const out = marked(isQ ? '? ' : '⚠ ', 'ask', (isQ ? what : (p?.ask?.summary || `Wants: ${what}`)).split('\n').map((t) => [[t, 'bold']]));
      if (!isQ && p?.ask?.detail) out.push(line(span('  ' + p.ask.detail, 'dim')));
      for (const q of (isQ ? p?.ask?.questions : null) || []) {
        if (q.text && q.text !== what) out.push(line(span('  ' + q.text, '')));
        (q.options || []).forEach((label, i) => out.push(line(span(`    ${i + 1} `, 'key'), span(label, ''))));
      }
      const choices = p && opt.choices !== false ? choicesOf(p) : [];
      if (choices.length) out.push(line(span('  ', ''), ...choices.flatMap((c, i) => [span(c.key, 'key'), span(` ${c.label}`, ''), i < choices.length - 1 ? span('   ', '') : null])));
      return out;
    }
    case 'notice': return [line(span(`  ${e.text || ''}`, e.level === 'error' ? 'err' : e.level === 'warn' ? 'warn' : 'dim'))];
    case 'handoff': return [line(span(e.direction === 'out' ? `  ⇢ context handed to ${e.toName || 'a teammate'}: ${plural(e.items || 0, 'item')}`
      : `  ⇠ context handed over from ${e.fromName || 'a teammate'}: ${plural(e.items || 0, 'item')}${e.omitted ? `, ${e.omitted} older left out` : ''}`, 'dim'))];
    case 'changes': {
      const files = e.files || [];
      if (!files.length) return [];
      const adds = files.reduce((n, f) => n + (f.additions || 0), 0), dels = files.reduce((n, f) => n + (f.deletions || 0), 0);
      const out = [line(span('  ± ', 'tool'), span(`${plural(files.length + (e.more || 0), 'file')} changed`, ''), span(`  +${adds}`, 'add'), span(` −${dels}`, 'del'))];
      for (const f of files.slice(0, full ? files.length : 8)) out.push(line(span(`     ${CHANGE_MARK[f.status] || 'M'} `, 'dim'), span(f.path || '', ''), span(`  +${f.additions || 0}`, 'add'), span(` −${f.deletions || 0}`, 'del')));
      const hidden = (full ? 0 : Math.max(0, files.length - 8)) + (e.more || 0);
      if (hidden) out.push(line(span(`     … ${plural(hidden, 'more file')}`, 'dim')));
      return out;
    }
    default: return [];
  }
}

/** A unified diff as lines: additions and removals marked, headers dimmed. */
export function renderDiff(text) {
  return String(text || '').replace(/\s+$/, '').split('\n').map((t) => [[t, t.startsWith('+++') || t.startsWith('---') || t.startsWith('diff ') || t.startsWith('index ') ? 'dim'
    : t.startsWith('@@') ? 'tool' : t.startsWith('+') ? 'add' : t.startsWith('-') ? 'del' : '']]);
}

/* ---- answering a request -------------------------------------------------------------------- */

const CHOICE_KEY = { 'allow-once': 'y', 'allow-session': 'a', reject: 'n', decline: 'n', dismiss: 'x' };

/**
 * What can be pressed to answer a waiting request: [{ key, kind, label, body, text }]. Only the answers that need no
 * words get a key; an answer that needs words (to a question, to "I am blocked") is whatever is typed next.
 */
export function choicesOf(prompt) {
  const out = [];
  for (const a of prompt?.respond?.actions || []) {
    const key = CHOICE_KEY[a.kind];
    if (!key || a.text === 'required' || out.some((c) => c.key === key)) continue;
    out.push({ key, kind: a.kind, label: a.label || a.kind, body: a.body || {}, text: a.text || '' });
  }
  return out;
}

/** The action of a request that takes words (an answer to a question, a reply to a blocked agent), if it has one. */
export const wordsAction = (prompt) => (prompt?.respond?.actions || []).find((a) => a.text === 'required') || null;

/* ---- what a typed line means ------------------------------------------------------------------ */

export const COMMANDS = Object.freeze([
  { name: 'new', args: '<agent> [folder]', about: 'start an agent here (--model name  --effort level  --mode ask|edits|full  --name name; --context carries this conversation over to it)' },
  { name: 'sessions', alias: ['ls'], about: 'who the office is driving, and what could be started' },
  { name: 'switch', alias: ['s'], args: '<number|name>', about: 'talk to another session' },
  { name: 'stop', about: 'stop the turn in flight (Esc does the same)' },
  { name: 'end', about: 'end this session: its process is stopped' },
  { name: 'model', args: '[name]', about: 'which model it runs on (alone: what it offers)' },
  { name: 'effort', args: '[level]', about: 'how hard it thinks' },
  { name: 'mode', args: '<ask|edits|full | one of its own>', about: 'how freely it may act — or one of the agent\'s own modes, such as plan' },
  { name: 'wake', args: '<off|results|direct>', about: 'what may start a turn by itself' },
  { name: 'yes', alias: ['y'], about: 'allow what is being asked, once' },
  { name: 'always', alias: ['a'], about: 'allow that kind of thing for the rest of the session' },
  { name: 'no', alias: ['n'], args: '[why]', about: 'refuse it, with a reason if you like' },
  { name: 'delegate', args: '<agent|any> <task…>', about: 'hand a task to another agent' },
  { name: 'mail', about: 'deliver mail that is being held for this session' },
  { name: 'diff', args: '[turn]', about: 'what a turn changed (the last one, by default)' },
  { name: 'full', about: 'show whole tool output and reasoning, or go back to the short form' },
  { name: 'usage', about: 'what is left with each provider' },
  { name: 'who', about: 'everyone in the office' },
  { name: 'dm', args: '<agent> <text…>', about: 'a note to any agent' },
  { name: 'task', args: '<title…>', about: 'add a card to this project\'s board' },
  { name: 'post', args: '<text…>', about: 'say it in this project\'s channel' },
  { name: 'clear', about: 'clear the screen' },
  { name: 'office', about: 'the office itself' },
  { name: 'help', alias: ['?'], about: 'this list' },
  { name: 'quit', alias: ['exit', 'q'], about: 'leave; the agents keep working' },
]);
const BY_NAME = new Map(COMMANDS.flatMap((c) => [[c.name, c], ...(c.alias || []).map((a) => [a, c])]));

/**
 * What a line typed at the prompt is: { kind: 'empty' } · { kind: 'turn', text } · { kind: 'command', name, words,
 * flags, rest }. A line that starts with / and is not one of ours belongs to the agent (they have commands of their
 * own) and is sent as it stands; so is anything after a doubled slash.
 */
export function parseInput(text) {
  const raw = String(text ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };
  if (trimmed.startsWith('//')) return { kind: 'turn', text: trimmed.slice(1) };
  const m = /^\/([a-zA-Z?][\w-]*)(?:\s+([\s\S]*))?$/.exec(trimmed);
  const command = m ? BY_NAME.get(m[1].toLowerCase()) : null;
  if (!command) return { kind: 'turn', text: raw.replace(/\s+$/, '') };
  const rest = (m[2] || '').trim();
  const words = [], flags = {};
  const tokens = rest ? rest.split(/\s+/) : [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^--[a-z][\w-]*$/.test(t)) { const next = tokens[i + 1]; if (next !== undefined && !next.startsWith('--')) { flags[t.slice(2)] = next; i++; } else flags[t.slice(2)] = true; } else words.push(t);
  }
  return { kind: 'command', name: command.name, words, flags, rest };
}

/** Command names a half-typed "/wo" could become. */
export function complete(partial) {
  const m = /^\/([\w?-]*)$/.exec(String(partial || ''));
  if (!m) return [];
  return COMMANDS.map((c) => c.name).filter((n) => n.startsWith(m[1].toLowerCase()));
}

/* ---- a choice among what the agent offers ----------------------------------------------------------- */

/** The options of one of a session's controls (model, effort, agentMode, mode…), each with the agent's own name for it. */
export const optionsOf = (control) => (control?.options || []).map((id) => ({ id, label: control.labels?.[id] || id }));

/**
 * Which option somebody meant: its id, the agent's name for it, or the unmistakable start of either. Where the agent
 * takes anything (`free`), what was typed is passed on as it stands. null: none of them.
 */
export function resolveOption(control, typed) {
  const want = String(typed ?? '').trim().toLowerCase();
  if (!want) return null;
  const all = optionsOf(control);
  const exact = all.find((o) => o.id.toLowerCase() === want) || all.find((o) => o.label.toLowerCase() === want);
  if (exact) return exact.id;
  const near = all.filter((o) => o.id.toLowerCase().startsWith(want) || o.label.toLowerCase().startsWith(want));
  if (near.length === 1) return near[0].id;
  return control?.free ? String(typed).trim() : null;
}

/* ---- the console itself --------------------------------------------------------------------------- */

const STATE_WORD = { starting: 'starting', idle: 'idle', running: 'working', waiting: 'waiting on you', ended: 'ended', failed: 'failed' };
const MODES = ['ask', 'edits', 'full'], WAKES = ['off', 'results', 'direct'];

/**
 * A console: which session is on show, its transcript as blocks, and everything that can be typed at it.
 *
 * @param {object} io  what the console needs from outside
 *   io.api(path, { method?, body? }) → Promise<object>   the daemon's HTTP API; rejects with an Error (its message is shown)
 *   io.watch(sessionId | null)                           follow this session's transcript live (entries arrive through `entry`)
 *   io.cwd?    the folder a new agent starts in when none is named      io.home?   shortens folders on screen
 *   io.office?()  swap to the office itself                               io.quit?() leave
 *   io.clear?()   empty the screen
 *   io.project?() → { id, name } | null (or a promise of it): the project on show, for /task and /post
 *   io.choices?   false: requests are drawn without their list of keys (the screen has buttons for them)
 * @returns the console: feed it (`harness`, `prompts`, `usage`, `entry`), drive it (`submit`, `key`, `stop`, `open`),
 *   and listen (`on('block' | 'reset' | 'say' | 'state', fn)`).
 *
 * A **block** is a piece of the screen: { key, entry, lines, live, gap }. A block with a key seen before replaces that
 * block; a new key goes at the end. `live` blocks will change again (text still arriving, a tool running, a request
 * waiting); a terminal keeps those at the bottom and writes them down for good once they settle. A session and a turn
 * are each written down twice — when they start and when they end — as two blocks, so that the end of a turn is at
 * the end of the turn and nothing above it ever has to be rewritten.
 */
export function createConsole(io) {
  const listeners = new Map();
  const on = (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); };
  const emit = (type, ...args) => { for (const fn of listeners.get(type) || []) fn(...args); };

  const state = { sessions: [], adapters: [], prompts: [], usage: null, wake: null, current: null, full: false, loading: false };
  let blocks = new Map();            // key → block, in screen order
  let entries = new Map();           // entry id → latest revision
  let confirm = null;                // { what, until }: a second /end or /mode full within a few seconds goes ahead
  let load = 0;

  /** Something the console itself has to say: each argument is a line — a string (shown dim) or a list of spans. */
  const say = (...lines) => emit('say', lines.map((l) => (typeof l === 'string' ? [[l, 'dim']] : l)));
  const fail = (err) => say([['✗ ', 'err'], [String(err?.message || err), 'err']]);
  const session = () => state.sessions.find((s) => s.id === state.current) || null;
  const live = (s) => !!s && s.live !== false && s.state !== 'ended' && s.state !== 'failed';
  const label = (s) => s?.name || s?.label || s?.adapter || 'session';
  const control = (name) => { const c = session()?.controls?.[name]; return c && c.available !== false ? c : null; };

  /* -- requests waiting on a person -- */
  const openPrompts = (s = session()) => (s?.pending || []).map((x) => state.prompts.find((p) => p.id === x.promptId && p.status === 'pending')).filter(Boolean);
  const promptOf = (entry) => {
    const pend = (session()?.pending || []).find((x) => `perm:${x.id}` === entry.id);
    return pend ? state.prompts.find((p) => p.id === pend.promptId && p.status === 'pending') || null : null;
  };

  /* -- blocks -- */
  function draw(entry) {
    if (!entry || typeof entry.id !== 'string') return;
    if (entry.kind === 'usage') { emit('state'); return; }
    const st = stage(entry);
    const key = st ? `${entry.id}#${st}` : entry.id;
    const prompt = entry.state === 'asked' ? promptOf(entry) : null;
    const lines = renderEntry(entry, { full: state.full, home: io.home, prompt, choices: io.choices });
    if (!lines.length && !blocks.has(key)) return;
    // the line a turn opens with never changes (its end is a block of its own): it is the turn that is running, not the line
    const block = { key, entry, lines, live: entry.kind === 'turn' ? false : !settled(entry), gap: entry.kind === 'user' || (entry.kind === 'session' && st === 'end'), prompt };
    const fresh = !blocks.has(key);
    blocks.set(key, block);
    emit('block', block, fresh);
  }
  function entry(sessionId, e) {
    if (sessionId !== state.current || !e || typeof e.id !== 'string') return;
    const prev = entries.get(e.id);
    if (prev && (prev.seq || 0) >= (e.seq || 0)) return;
    entries.set(e.id, e);
    draw(e);
  }
  /** Draw again whatever depends on something other than its own entry: open requests (their choices), and everything when the short form is switched. */
  function redraw(all) { for (const e of entries.values()) if (all || e.state === 'asked') draw(e); }

  async function open(ref, opt = {}) {
    const s = typeof ref === 'object' ? ref : find(ref);
    if (!s) { if (!opt.quiet) say(`No session matches "${ref}". /sessions lists them.`); return null; }
    const mine = ++load;
    state.current = s.id;
    state.loading = true;
    blocks = new Map(); entries = new Map();
    emit('reset', s);
    emit('state');
    io.watch?.(s.id);
    try {
      const page = await io.api(`${s.controls?.transcript?.url || `/api/harness/sessions/${encodeURIComponent(s.id)}/transcript`}?limit=${opt.limit || 300}`);
      if (mine !== load) return s;
      if (page.truncated) say('… earlier entries are not shown.');
      // what arrived live while the page was being read is newer than the page, and stays
      const arrived = [...entries.values()];
      entries = new Map();
      blocks = new Map();
      emit('reset', s, true);                      // the same session again, from the top: now with its whole page
      drawPage(page.entries || []);
      for (const e of arrived) entry(s.id, e);
    } catch (err) {
      if (mine === load) fail(err);
    } finally {
      if (mine === load) { state.loading = false; emit('state'); }
    }
    return s;
  }

  /**
   * A page of history, in order. What is read back is each entry's last word only, so a turn that has ended (and a
   * session that has) is drawn twice here, as it was written live: where it began, and again after the last thing
   * that happened in it.
   */
  function drawPage(list) {
    const lastOf = new Map(), ends = new Map();
    list.forEach((e, i) => { if (Number.isInteger(e.turn)) lastOf.set(e.turn, i); });
    let sessionEnd = null;
    list.forEach((e, i) => {
      entries.set(e.id, e);
      if (e.kind === 'turn' && e.state !== 'running') { draw({ ...e, state: 'running' }); ends.set(lastOf.has(e.n) ? lastOf.get(e.n) : i, e); }
      else if (e.kind === 'session' && (e.state === 'ended' || e.state === 'failed')) { draw({ ...e, state: 'started' }); sessionEnd = e; }
      else draw(e);
      const done = ends.get(i);
      if (done) { ends.delete(i); draw(done); }
    });
    for (const e of ends.values()) draw(e);
    if (sessionEnd) draw(sessionEnd);
  }

  /** A session by its number in the list (1 is the first), its id, or the start of its name. */
  function find(ref) {
    const text = String(ref ?? '').trim().toLowerCase();
    if (!text) return null;
    if (/^\d+$/.test(text)) return state.sessions[Number(text) - 1] || null;
    return state.sessions.find((s) => s.id.toLowerCase() === text) || state.sessions.find((s) => (s.name || '').toLowerCase() === text || (s.handle || '').toLowerCase() === text)
      || state.sessions.find((s) => (s.name || s.label || '').toLowerCase().startsWith(text)) || state.sessions.find((s) => s.adapter === text) || null;
  }

  /* -- what the daemon tells us -- */
  function harness(h) {
    if (!h) return;
    const before = session();
    if (Array.isArray(h.sessions)) state.sessions = h.sessions;
    if (Array.isArray(h.adapters)) state.adapters = h.adapters;
    if (h.wake) state.wake = h.wake;
    const now = session();
    // the session on show is no longer in the list (it ended and was tidied away): keep reading it, as it was
    if (before && !now) state.sessions = [...state.sessions, { ...before, live: false, state: before.state === 'failed' ? 'failed' : 'ended', controls: { transcript: before.controls?.transcript } }];
    redraw(false);
    emit('state');
  }
  function prompts(list) { state.prompts = Array.isArray(list) ? list : []; redraw(false); emit('state'); }
  function usage(u) { state.usage = u || null; emit('state'); }

  /* -- doing things -- */
  async function call(c, body) { return io.api(c.url, { method: c.method || 'POST', ...(body !== undefined ? { body } : {}) }); }

  async function turn(text) {
    const s = session();
    if (!s) { say('No session. /new <agent> starts one; /sessions lists what there is.'); return; }
    // an agent that asked a question (or said it is blocked) is waiting for words: these are the words
    const waiting = openPrompts(s).map((p) => [p, wordsAction(p)]).find(([, a]) => a);
    if (waiting) { await answer(waiting[0], waiting[1], text); return; }
    const c = control('turn');
    if (!c || !live(s)) { say(live(s) ? 'This session cannot be given a turn from here.' : 'This session has ended. /new starts another.'); return; }
    try {
      const res = await call(c, { text });
      if (res?.queued) say(`queued: it starts when this turn ends (${res.position > 1 ? `${res.position - 1} ahead of it` : 'next'})`);
    } catch (err) { fail(err); }
  }

  async function answer(prompt, action, text = '') {
    const field = prompt.respond?.textField || 'text';
    const body = { ...(action.body || {}), ...(text ? { [field]: text } : {}) };
    try { await io.api(prompt.respond?.url || `/api/prompts/${encodeURIComponent(prompt.id)}/reply`, { method: prompt.respond?.method || 'POST', body }); }
    catch (err) { fail(err); }
  }
  /** Answer the request that is waiting with one of its keyed choices ('y', 'a', 'n', 'x'). → whether there was one to answer. */
  async function choose(key, text = '') {
    const p = openPrompts()[0];
    const c = p ? choicesOf(p).find((x) => x.key === key) : null;
    if (!c) return false;
    await answer(p, c, c.text ? text : '');
    return true;
  }
  /** A key pressed on an empty prompt: a choice of the waiting request, or the number of one of a question's options. */
  async function key(k) {
    const p = openPrompts()[0];
    if (!p) return false;
    if (await choose(k)) return true;
    const options = p.ask?.questions?.length === 1 ? p.ask.questions[0].options || [] : [];
    const words = wordsAction(p);
    if (words && /^[1-9]$/.test(k) && options[Number(k) - 1]) { await answer(p, words, options[Number(k) - 1]); return true; }
    return false;
  }

  async function stop() {
    const c = control('interrupt');
    const s = session();
    if (!c || !s || !(s.state === 'running' || s.state === 'waiting' || s.queued)) return false;
    try { await call(c); } catch (err) { fail(err); }
    return true;
  }

  const twice = (what) => { const now = Date.now(); if (confirm && confirm.what === what && now < confirm.until) { confirm = null; return true; } confirm = { what, until: now + 6000 }; return false; };

  const run = {
    async new({ words, flags }) {
      const adapter = (words[0] || '').toLowerCase();
      const known = state.adapters.find((a) => a.id === adapter);
      if (!adapter || !known) { say(adapter ? `There is no agent called "${adapter}" here.` : 'Which agent?', ...adapterLines()); return; }
      if (!known.available) { say(`${known.label} is not installed on this machine.${known.note ? ' ' + known.note : ''}`); return; }
      const cwd = words[1] || io.cwd || session()?.cwd || undefined;
      try {
        const res = await io.api('/api/harness/sessions', { method: 'POST', body: { adapter, ...(cwd ? { cwd } : {}),
          ...(typeof flags.mode === 'string' ? { mode: flags.mode } : {}), ...(typeof flags.model === 'string' ? { model: flags.model } : {}), ...(typeof flags.name === 'string' ? { name: flags.name } : {}),
          ...(typeof flags.effort === 'string' ? { effort: flags.effort } : {}), ...(typeof flags['agent-mode'] === 'string' ? { agentMode: flags['agent-mode'] } : {}),
          // carrying this conversation on with another agent: the office hands over a summary of it, on the record
          ...(flags.context && session() ? { context: { session: session().id, ...(typeof flags.context === 'string' && Number(flags.context) > 0 ? { turns: Number(flags.context) } : {}) } } : {}) } });
        if (res?.session) { if (!state.sessions.some((s) => s.id === res.session.id)) state.sessions = [...state.sessions, res.session]; await open(res.session); }
      } catch (err) { fail(err); }
    },
    async sessions() {
      if (!state.sessions.length) say('The office is driving nobody.');
      state.sessions.forEach((s, i) => say([[`${String(i + 1).padStart(2)} `, 'key'], [s.id === state.current ? '▸ ' : '  ', 'say'], [label(s), s.id === state.current ? 'bold' : ''],
        [`  ${s.label}${s.model ? ` · ${s.model}` : ''} · `, 'dim'], [STATE_WORD[s.state] || s.state, s.state === 'waiting' ? 'ask' : s.state === 'running' ? 'ok' : s.state === 'failed' ? 'err' : 'dim'],
        [`  ${shortFolder(s.cwd, io.home)}`, 'dim']]));
      say(...adapterLines());
    },
    async switch({ words }) { if (!words[0]) return run.sessions(); await open(words.join(' ')); },
    async stop() { if (!(await stop())) say('Nothing is running.'); },
    async end() {
      const s = session(), c = control('end');
      if (!s || !c || !live(s)) { say('There is no running session to end.'); return; }
      if (!twice('end:' + s.id)) { say([[`End ${label(s)}? Its process is stopped and it cannot be resumed. `, 'warn'], ['/end', 'key'], [' again to go ahead.', 'warn']]); return; }
      try { await call(c); } catch (err) { fail(err); }
    },
    async model({ rest }) { await choice('model', 'model', rest); },
    async effort({ words }) { await choice('effort', 'effort', words[0]); },
    // Two things are called a mode: how freely the office lets it act (ask, edits, full), and the agent's own ways
    // of working (plan, and whatever else it calls them). The three words are the office's; anything else is the
    // agent's — and "own:ask" reaches an agent's own mode that happens to share one of those names.
    async mode({ words, rest }) {
      const s = session(), own = s?.controls?.agentMode, has = optionsOf(own).length > 0;
      if (!s) { say('No session.'); return; }
      if (!rest) { await setting('mode', MODES, undefined, 'It'); if (has) await choice('agentMode', 'its own mode'); return; }
      const mine = /^own:/i.test(rest) ? rest.slice(4).trim() : '';
      if (!mine && MODES.includes(words[0])) { await setting('mode', MODES, words[0], 'It'); return; }
      if (has && resolveOption(own, mine || rest)) { await choice('agentMode', 'its own mode', mine || rest); return; }
      say(`"${rest}" is not one of ${MODES.join(', ')}${has ? ` — nor one of its own (${own.options.join(', ')})` : ''}.`);
    },
    async wake({ words }) { await setting('wake', WAKES, words[0], 'It wakes'); },
    async yes() { if (!(await choose('y'))) say('Nothing is waiting for a yes.'); },
    async always() { if (!(await choose('a'))) say('Nothing here can be allowed for the session.'); },
    async no({ rest }) { if (!(await choose('n', rest))) say('Nothing is waiting for an answer.'); },
    async delegate({ words, rest }) {
      const to = (words[0] || '').toLowerCase(), task = rest.replace(/^\S+\s*/, '').trim();
      if (!to || !task) { say('usage: /delegate <agent|any> <task…>'); return; }
      try {
        const res = await io.api('/api/delegations', { method: 'POST', body: { task, ...(['any', 'auto', '-'].includes(to) ? {} : { to }), ...(session()?.cwd ? { cwd: session().cwd } : {}) } });
        const d = res?.delegation;
        say(d ? `handed to ${d.toName || d.to || 'an agent'} (${d.id}); its result comes back as mail` : 'handed over');
      } catch (err) { fail(err); }
    },
    async mail() { const c = control('deliverMail'); if (!c) { say('No mail is being held for this session.'); return; } try { const r = await call(c); say(r?.delivered ? `delivered ${plural(r.delivered, 'note')}` : 'nothing was waiting'); } catch (err) { fail(err); } },
    async diff({ words }) {
      const s = session(), c = s?.controls?.diff, list = s?.controls?.changes;
      if (!s) { say('No session.'); return; }
      if (!c) { say('This office keeps no record of what a turn changed for this session.'); return; }
      try {
        let n = Number(words[0]);
        if (!Number.isInteger(n) || n < 1) {
          const all = list ? await io.api(list.url) : null;
          n = (all?.turns || []).filter((t) => (t.files || []).length).map((t) => t.turn).pop();
          if (!n) { say('No turn of this session has changed a file.'); return; }
        }
        const res = await io.api(`${c.url}?turn=${n}`);
        if (!res?.diff) { say(`Turn ${n} changed nothing.`); return; }
        say([[`turn ${n}`, 'bold']], ...renderDiff(res.diff), ...(res.truncated ? ['… the rest of the diff is not shown.'] : []));
      } catch (err) { fail(err); }
    },
    async full() { state.full = !state.full; redraw(true); say(state.full ? 'Showing whole tool output and reasoning.' : 'Showing the short form.'); },
    async usage() { say(...String(state.usage?.text || 'No provider has said what is left yet.').split('\n').map((t) => [[t, '']])); },
    async who() { try { const r = await io.api('/api/world/who'); say(...String(r?.text || '').split('\n').map((t) => [[t, '']])); } catch (err) { fail(err); } },
    async dm({ words, rest }) {
      const to = words[0], text = rest.replace(/^\S+\s*/, '').trim();
      if (!to || !text) { say('usage: /dm <agent> <text…>'); return; }
      try { const r = await io.api('/api/comms/direct-message', { method: 'POST', body: { toAgentId: to, content: text } }); say(`note → ${r?.post?.toAgentName || to}${r?.turnDelivered ? ' (it started a turn)' : ''}`); }
      catch (err) { fail(err); }
    },
    async task({ rest }) {
      const where = await io.project?.();
      if (!rest) { say('usage: /task <title…>'); return; }
      if (!where?.id) { say('Which project? Open a project, or a session that belongs to one.'); return; }
      try { const r = await io.api('/api/tasks', { method: 'POST', body: { title: rest, deptId: where.id, status: 'todo' } }); say(`card added to ${where.name || where.id}: ${r?.task?.title || rest}`); }
      catch (err) { fail(err); }
    },
    async post({ rest }) {
      const where = await io.project?.();
      if (!rest) { say('usage: /post <text…>'); return; }
      if (!where?.id) { say('Which project? Open a project, or a session that belongs to one.'); return; }
      try { await io.api(`/api/channels/${encodeURIComponent(where.id)}/message`, { method: 'POST', body: { content: rest } }); say(`posted in ${where.name || where.id}`); }
      catch (err) { fail(err); }
    },
    async clear() { io.clear?.(); },
    async office() { if (io.office) io.office(); else say('The office is at the address this console came from.'); },
    async help() {
      const w = Math.max(...COMMANDS.map((c) => c.name.length + (c.args ? c.args.length + 1 : 0)));
      say(...COMMANDS.map((c) => [[`  /${c.name}`, 'key'], [c.args ? ` ${c.args}` : '', 'dim'], [' '.repeat(w - c.name.length - (c.args ? c.args.length + 1 : 0) + 3), ''], [c.about, '']]),
        'Anything else is said to the agent — also a line starting with / that is not in this list.',
        'While something is waiting for an answer: y allows once, a allows for the session, n refuses.');
    },
    async quit() { if (io.quit) io.quit(); else say('Close the page to leave; the agents keep working.'); },
  };

  function adapterLines() {
    if (!state.adapters.length) return [];
    return [[['Start one with ', 'dim'], ['/new', 'key'], [' and one of: ', 'dim'],
      ...state.adapters.flatMap((a, i) => [[a.id, a.available ? '' : 'dim'], [a.available ? '' : ' (not installed)', 'dim'], [i < state.adapters.length - 1 ? ', ' : '', 'dim']])]];
  }

  /** Show, or change, one of the things the agent itself offers a choice of: its model, how hard it thinks, its own mode. */
  async function choice(name, word, typed) {
    const s = session(), c = s?.controls?.[name];
    if (!s) { say('No session.'); return; }
    const all = optionsOf(c);
    const named = (id) => { const l = c?.labels?.[id]; return l && l !== id ? `${l} (${id})` : id; };
    if (!typed) {
      if (!c || (!all.length && !c.value)) { say(`This agent has not said what ${word} it offers.`); return; }
      say([[`${word}: `, 'dim'], [c.value ? named(c.value) : 'its default', 'bold']],
        ...all.map((o) => [[o.id === c.value ? '  ▸ ' : '    ', 'say'], [o.id, 'key'], [o.label !== o.id ? `  ${o.label}` : '', 'dim']]),
        ...(c.free ? ['    …or any other name the agent knows.'] : []),
        ...(c.available === false ? [c.fixed ? `It is ${c.fixed}.` : 'It cannot be changed for this session.'] : []));
      return;
    }
    if (!c || c.available === false) { say(c?.fixed ? `That is ${c.fixed}.` : `This agent offers no choice of ${word}.`); return; }
    const id = resolveOption(c, typed);
    if (!id) { say(`"${typed}" is not one of ${c.options.join(', ')}.`); return; }
    try {
      await io.api(c.url, { method: c.method || 'PATCH', body: { [c.field || name]: id } });
      say(`${word}: ${named(id)}${c.applies === 'next-turn' && s.state === 'running' ? ' — from the next turn' : ''}`);
    } catch (err) { fail(err); }
  }

  /**
   * What a half-typed line could become: [{ kind, text, label, hint }] — `text` is the whole line as it would then
   * read. A command's name first (kind 'command'; `more` when it cannot be sent without a word after it); after the
   * name, the first word it takes (kind 'word': a model, an effort, a mode, an agent, a session).
   */
  function completions(typed) {
    const text = String(typed || '');
    const names = complete(text);
    if (names.length) return names.map((n) => { const c = BY_NAME.get(n); return { kind: 'command', text: `/${n} `, label: `/${n}`, hint: `${c.args ? c.args + ' — ' : ''}${c.about}`, more: /^</.test(c.args || '') }; });
    const m = /^\/([a-zA-Z?][\w-]*)\s+(.*)$/.exec(text);
    const cmd = m ? BY_NAME.get(m[1].toLowerCase()) : null;
    if (!cmd) return [];
    const s = session(), of = (c) => optionsOf(c).map((o) => ({ id: o.id, hint: o.label !== o.id ? o.label : '' }));
    const options = cmd.name === 'model' ? of(s?.controls?.model)
      : cmd.name === 'effort' ? of(s?.controls?.effort)
        : cmd.name === 'mode' ? [...MODES.map((id) => ({ id, hint: s?.controls?.mode?.labels?.[id] || '' })), ...of(s?.controls?.agentMode).filter((o) => !MODES.includes(o.id))]
          : cmd.name === 'wake' ? WAKES.map((id) => ({ id, hint: '' }))
            : cmd.name === 'new' ? state.adapters.filter((a) => a.available).map((a) => ({ id: a.id, hint: a.label }))
              : cmd.name === 'delegate' ? [{ id: 'any', hint: 'whoever has the most allowance left' }, ...state.adapters.filter((a) => a.available).map((a) => ({ id: a.id, hint: a.label }))]
                : cmd.name === 'switch' ? state.sessions.map((x) => ({ id: label(x), hint: `${x.label}${x.model ? ' · ' + x.model : ''}` }))
                  : [];
    const part = m[2].toLowerCase();
    return options.filter((o) => o.id.toLowerCase().startsWith(part) && o.id.toLowerCase() !== part).map((o) => ({ kind: 'word', text: `/${m[1]} ${o.id}`, label: o.id, hint: o.hint }));
  }

  async function setting(name, allowed, value, verb) {
    const s = session(), c = s?.controls?.[name];
    if (!s || !c) { say('No session.'); return; }
    if (!value) { say(`${verb}: ${c.value}. One of ${(c.options || allowed).join(', ')}.`); return; }
    if (!(c.options || allowed).includes(value)) { say(`"${value}" is not one of ${(c.options || allowed).join(', ')}.`); return; }
    if (c.available === false) { say(c.fixed ? `That cannot be changed here: ${c.fixed}.` : 'That cannot be changed for this session.'); return; }
    if (name === 'mode' && value === 'full' && !twice('full:' + s.id)) { say([['It would act without asking anyone. ', 'warn'], ['/mode full', 'key'], [' again to go ahead.', 'warn']]); return; }
    try { await io.api(c.url, { method: c.method || 'PATCH', body: { [c.field || name]: value } }); say(`${name}: ${value}`); } catch (err) { fail(err); }
  }

  /** A line typed at the prompt. */
  async function submit(text) {
    const input = parseInput(text);
    if (input.kind === 'empty') return;
    if (input.kind === 'turn') return turn(input.text);
    if (input.name !== 'end' && !(input.name === 'mode' && input.words[0] === 'full')) confirm = null;
    return run[input.name](input);
  }

  /** What the line at the bottom says: [left spans, right spans]. `brief` leaves out what a screen shows elsewhere (agent, model, effort, mode). */
  function status({ brief = false } = {}) {
    const s = session();
    const others = state.sessions.filter((x) => x.id !== state.current && x.state === 'waiting');
    const left = [];
    if (!s) left.push(['no session', 'dim'], ['  /new <agent>', 'key']);
    else {
      const u = entries.get('usage') || [...entries.values()].filter((e) => e.kind === 'usage').pop() || (s.usage ? { ...s.usage } : null);
      const pct = u && u.size > 0 ? Math.round((u.used / u.size) * 100) : null;
      // its own mode is worth a word only when it is not the ordinary one
      const own = s.agentMode && !/^default$/i.test(s.agentMode) ? `${s.controls?.agentMode?.labels?.[s.agentMode] || s.agentMode} mode` : '';
      left.push([label(s), 'bold']);
      if (!brief) left.push([`  ${[s.label !== label(s) ? s.label : '', s.model, s.effort, s.mode].filter(Boolean).join(' · ')}`, 'dim'], ...(own ? [[`  ${own}`, 'tool']] : []));
      left.push([`  ${STATE_WORD[s.state] || s.state || ''}`, s.state === 'waiting' ? 'ask' : s.state === 'running' ? 'ok' : s.state === 'failed' ? 'err' : 'dim']);
      if (s.queued) left.push([`  ${s.queued} waiting`, 'dim']);
      if (pct !== null) left.push([`  context ${pct}%`, pct >= 85 ? 'warn' : 'dim']);
      if (s.wakeStats?.held) left.push(['  mail held', 'warn']);
    }
    const right = others.length ? [[`${others.map((x) => `${state.sessions.indexOf(x) + 1} ${label(x)}`).join(', ')} need${others.length === 1 ? 's' : ''} you`, 'ask']] : [];
    return [left, right];
  }

  /** Stop reading a session (the screen is showing something else): nothing more is drawn until one is opened. */
  function leave() {
    if (!state.current) return;
    load++;
    state.current = null; blocks = new Map(); entries = new Map();
    io.watch?.(null);
    emit('state');
  }

  return {
    state, on, session, live: () => live(session()), status, pending: () => openPrompts()[0] || null,
    blocks: () => [...blocks.values()],
    harness, prompts, usage, entry, open, leave, find, submit, key, stop, answer, say, complete: completions,
  };
}
