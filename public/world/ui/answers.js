// The Office — how a request gets answered.
//
// Every waiting request says what is asked (`ask`) and which answers its
// runtime can honour (`respond.actions`), so nothing here knows whether a
// terminal, an inbox or a live agent is on the other end. The slip in the
// in-tray and the record of a driven session both build their controls here:
// stamps for a decision, the agent's own choices for a question, and a line to
// write on wherever words can go with the answer.
import { h } from './dom.js';

// what each decision looks like: [label, ink, what it does, the mark it leaves]
export const STAMP = {
  'allow-once': ['Allow', 'ok', 'Allow this once', 'ALLOWED'],
  'allow-session': ['Always', 'ok', 'Allow this kind of thing for the rest of the session', 'ALLOWED'],
  reject: ['Deny', 'no', 'Refuse it', 'DENIED'],
};
const WRITES = ['answer', 'reply'], WAVES_OFF = ['decline', 'dismiss'];
const VERB = { execute: 'wants to run', edit: 'wants to change', delete: 'wants to delete', move: 'wants to move', read: 'wants to read', search: 'wants to search', fetch: 'wants to fetch' };
const GOES = { terminal: 'It is typed into their terminal.', inbox: 'It is left in their inbox: they read it on their next turn.', turn: 'It starts their next turn.', agent: 'It goes straight to the agent, which is waiting for it.' };
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : '');

/** The answers a request can take, in the daemon's own words (an older daemon only said which names). */
export function answersOf(p) {
  if (p.respond?.actions) return p.respond.actions;
  const old = { once: 'allow-once', always: 'allow-session', reject: 'reject' };
  return (p.actions || []).map((a) => (old[a] ? { id: a, kind: old[a], text: 'none', body: { action: a } } : a === 'reply' ? { id: 'reply', kind: 'reply', text: 'required', body: { close: true } } : null)).filter(Boolean)
    .concat([{ id: 'dismiss', kind: 'dismiss', text: 'none', body: { text: '', close: true } }]);
}

/** What is being asked, ready to show: a short verb, the words, the exact command or files, the questions. */
export function describe(p) {
  const ask = p.ask || {}, req = p.request?.pending ? p.request : null;
  const exact = [ask.command || req?.command, ...(ask.files?.length ? ask.files : req?.paths || [])].filter(Boolean);
  const detail = [...exact, ask.detail || req?.detail].filter(Boolean).join('\n');
  const questions = (ask.questions || []).filter((q) => q && q.text);
  let words = ask.summary || p.message || '';
  // "Wants to run: rm -rf build" over a box that says "rm -rf build" says it twice
  if (questions.length || (exact.length && exact.some((x) => words.includes(x)))) words = '';
  const verb = p.kind === 'question' ? 'has a question' : (exact.length && VERB[ask.toolKind]) || 'wants permission';
  return { verb, words, detail, questions };
}

/**
 * The controls that answer one request.
 * `send(body, mark, ink)` posts the answer; it is the caller's (the slip stamps the paper, the record just sends).
 * → { nodes, input, wave } — `wave` is the "not answering" action (decline / dismiss), for the caller to place.
 */
export function answerControls(p, send, opt = {}) {
  const answers = answersOf(p);
  const field = p.respond?.textField || 'text';
  const write = answers.find((a) => WRITES.includes(a.kind)) || null;
  const wave = answers.find((a) => WAVES_OFF.includes(a.kind)) || null;
  const decisions = answers.filter((a) => STAMP[a.kind]);
  const questions = (p.ask?.questions || []).filter((q) => q && q.text);
  const goes = GOES[p.respond?.reaches] || '';
  const withText = (body, text) => ({ ...body, [field]: text });
  const optionsOf = (q) => (q.options || []).map((o) => (typeof o === 'string' ? o : o?.label)).filter(Boolean).slice(0, 6);
  const quiet = (el) => { el.addEventListener('keydown', (e) => e.stopPropagation()); return el; };
  const nodes = [];
  let input = null;

  if (decisions.length) {
    // a decision may carry a few words with it, where the agent's runtime takes them
    const body = (a) => (a.text && a.text !== 'none' && input?.value.trim() ? withText(a.body, input.value.trim()) : a.body);
    nodes.push(h('div.stamps', decisions.map((a) => {
      const [label, ink, what, mark] = STAMP[a.kind];
      return h(`button.inkstamp.${ink}`, { type: 'button', title: a.label || what, onclick: () => send(body(a), mark, ink) }, h('span', label));
    })));
    const lasting = decisions.find((a) => a.kind === 'allow-session');
    if (lasting?.label && !opt.compact) nodes.push(h('p.scope', h('b', 'Always'), ' = ', lowerFirst(lasting.label)));
  }

  if (write && questions.length > 1) {
    // several questions: one line each, sent together in the order they were asked
    const lines = questions.map((q) => quiet(h('input', { type: 'text', placeholder: 'your answer', 'aria-label': q.text })));
    const sendBtn = h('button', { type: 'button', disabled: true }, 'Send');
    const ready = () => lines.every((l) => l.value.trim());
    const sync = () => { sendBtn.disabled = !ready(); };
    const go = () => { if (ready()) send(withText(write.body, lines.map((l) => l.value.trim().replace(/\s*\n\s*/g, ' ')).join('\n')), 'SENT', 'sent'); };
    sendBtn.addEventListener('click', go);
    questions.forEach((q, i) => {
      const line = lines[i];
      line.addEventListener('input', sync);
      line.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (ready()) go(); else lines.find((l) => !l.value.trim())?.focus(); } });
      const picks = optionsOf(q);
      nodes.push(h('div.q', h('p', q.header ? h('b', q.header) : null, q.header ? ' ' : null, q.text),
        picks.length ? h('div.stamps', picks.map((c) => h('button.inkstamp.plain', { type: 'button', onclick: () => { line.value = c; sync(); (lines.find((l) => !l.value.trim()) || sendBtn).focus(); } }, h('span', c)))) : null,
        h('div.write', line)));
    });
    nodes.push(h('div.write', h('span.grow'), sendBtn));
    input = lines[0];
  } else {
    // one question that came with its own choices: one tap answers it
    const picks = write && questions.length === 1 ? optionsOf(questions[0]) : [];
    if (picks.length) nodes.push(h('div.stamps', picks.map((c) => h('button.inkstamp.plain', { type: 'button', onclick: () => send(withText(write.body, c), 'SENT', 'sent') }, h('span', c)))));
    const noteOk = decisions.some((a) => a.text && a.text !== 'none');
    if (write || noteOk) {
      input = quiet(h('input', { type: 'text', title: goes, 'aria-label': `Reply to ${p.agentName || 'the agent'}`,
        placeholder: !write ? 'add a note…' : decisions.length || picks.length ? 'or write back…' : 'write back…' }));
      const go = () => { const text = input.value.trim(); if (text && write) send(withText(write.body, text), 'SENT', 'sent'); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && write) { e.preventDefault(); go(); } });
      nodes.push(h('div.write', input, write ? h('button', { type: 'button', onclick: go }, 'Send') : null));
    }
  }
  return { nodes, input, wave };
}
