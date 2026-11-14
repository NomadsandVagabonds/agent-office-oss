// The Office — harness: one vocabulary for what a driven agent is doing.
//
// ACP and Codex's app-server describe the same things with different words.
// Each adapter translates its protocol into the events below, and the rest of
// the daemon (the session, the transcript, approvals, the 3D office) only ever
// sees these. Adding a provider means writing one translator, not touching
// every consumer — the lesson T3 Code's adapter boundary teaches.
//
//   turn.started   {}
//   message.delta  { text }                      the agent's reply, streamed
//   message.break  {}                            that reply is complete; later text is a new one
//   thought.delta  { text }                      reasoning the agent chose to show
//   tool           { id, kind, title, status, command?, paths?, output?, exitCode? }
//   plan           { entries:[{ text, status }], note? }
//   usage          { used?, size?, cost? }       context occupancy, when the agent reports it
//   limits         { plan?, windows:[{ id, kind, label?, usedPercent, resetsAt?, windowMins? }] }
//                                                what is left of the operator's allowance with this provider
//   mode           { modeId }
//   info           { title }
//   notice         { level, text }
//   permission     { requestId, kind, title, detail, command?, paths?, toolId?, options:[{id,name,kind}] }
//   permission.gone{ requestId, reason }         the agent stopped waiting for an answer
//   question       { requestId, questions:[{ id, header, text, options:[label] }] }
//   turn.ended     { status:'completed'|'interrupted'|'failed', stopReason?, error? }
//   exit           { code, signal, error, stderr, protocolError? }   the process is gone
//
// The helpers here bound and clean everything that came off the wire: a child
// process's output is untrusted input.
import { redact } from './child.mjs';

export const LIMITS = Object.freeze({
  delta: 64 * 1024,          // one streamed chunk
  title: 240,
  command: 2000,
  detail: 4000,
  output: 2000,              // tool output kept: the tail, since agents resend cumulative output
  paths: 12,
  planEntries: 40,
  options: 8,
});

export const TOOL_STATUS = Object.freeze(['pending', 'running', 'completed', 'failed']);
export const TOOL_KINDS = Object.freeze(['read', 'edit', 'delete', 'move', 'search', 'execute', 'think', 'fetch', 'switch_mode', 'other']);
export const OPTION_KINDS = Object.freeze(['allow_once', 'allow_always', 'reject_once', 'reject_always']);

export const LIMIT_KINDS = Object.freeze(['session', 'weekly', 'monthly', 'credit']);

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A short, single-purpose string: trimmed, control characters removed, capped. */
export function line(value, max = LIMITS.title) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + '…' : cleaned;
}

/** Free text (keeps newlines), with obvious secrets and the home path masked. */
export function text(value, max = LIMITS.detail) {
  if (typeof value !== 'string') return '';
  return redact(value, max);
}

/** Keep the END of long output: the part a reader wants, and what a cumulative resend preserves. */
export function tail(value, max = LIMITS.output) {
  if (typeof value !== 'string' || !value) return '';
  const cleaned = redact(value, Math.max(max * 4, 16000));
  return cleaned.length > max ? '…' + cleaned.slice(cleaned.length - max + 1) : cleaned;
}

export function toolKind(value) {
  return TOOL_KINDS.includes(value) ? value : 'other';
}

/** ACP says in_progress, Codex inProgress; a cancelled tool did not succeed. */
export function toolStatus(value, fallback) {
  switch (value) {
    case 'pending': return 'pending';
    case 'in_progress': case 'inProgress': case 'running': return 'running';
    case 'completed': return 'completed';
    case 'failed': case 'cancelled': case 'declined': return 'failed';
    default: return fallback;
  }
}

export function planStatus(value) {
  switch (value) {
    case 'completed': return 'completed';
    case 'in_progress': case 'inProgress': return 'running';
    case 'cancelled': return 'cancelled';
    default: return 'pending';
  }
}

/** What a content block says, as plain text. Binary content becomes a placeholder, never bytes. */
export function contentText(block) {
  if (!isObject(block)) return '';
  switch (block.type) {
    case 'text': return typeof block.text === 'string' ? block.text.slice(0, LIMITS.delta) : '';
    case 'resource_link': return `[${line(block.title || block.name || 'resource', 120)}]`;
    case 'resource':
      return isObject(block.resource) && typeof block.resource.text === 'string'
        ? block.resource.text.slice(0, LIMITS.delta) : '[attached resource]';
    case 'image': return '[image]';
    case 'audio': return '[audio]';
    default: return '';
  }
}

/** The command a tool call runs, from the shapes agents actually send. */
export function commandOf(rawInput, title, kind) {
  if (isObject(rawInput)) {
    const c = rawInput.command;
    if (typeof c === 'string' && c.trim()) return line(c, LIMITS.command);
    if (Array.isArray(c)) {
      const joined = c.filter((p) => typeof p === 'string').join(' ').trim();
      if (joined) return line(joined, LIMITS.command);
    }
    if (typeof rawInput.executable === 'string' && rawInput.executable.trim()) {
      const args = Array.isArray(rawInput.args) ? rawInput.args.filter((p) => typeof p === 'string').join(' ') : '';
      return line(`${rawInput.executable} ${args}`, LIMITS.command);
    }
  }
  // Only a tool that runs commands may have its title read as one.
  if (kind === 'execute' && typeof title === 'string') {
    const quoted = /`([^`]+)`/.exec(title);
    if (quoted) return line(quoted[1], LIMITS.command);
  }
  return '';
}

/** File paths a tool call touches: its declared locations, diff targets, and the usual input fields. */
export function pathsOf({ locations, content, rawInput }) {
  const seen = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    const p = value.trim();
    if (p && p.length <= 1024 && seen.size < LIMITS.paths) seen.add(redact(p, 1024));
  };
  if (Array.isArray(locations)) for (const loc of locations) if (isObject(loc)) add(loc.path);
  if (Array.isArray(content)) for (const entry of content) if (isObject(entry) && entry.type === 'diff') add(entry.path);
  if (isObject(rawInput)) { add(rawInput.path); add(rawInput.filePath); add(rawInput.file_path); }
  return [...seen];
}

/** Text a tool call reports as its result, from ACP's content entries. */
export function toolOutputOf(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const entry of content.slice(0, 32)) {
    if (!isObject(entry)) continue;
    if (entry.type === 'content') { const t = contentText(entry.content); if (t) parts.push(t); }
    else if (entry.type === 'diff' && typeof entry.path === 'string') parts.push(`(edit ${redact(entry.path, 300)})`);
  }
  return tail(parts.join('\n'));
}

/** The answers an agent offers for a permission request, in its own words and with its own ids. */
export function permissionOptions(options) {
  const out = [];
  for (const option of Array.isArray(options) ? options.slice(0, LIMITS.options) : []) {
    if (!isObject(option) || typeof option.optionId !== 'string' || !option.optionId) continue;
    out.push({
      id: option.optionId.slice(0, 200),
      name: line(option.name, 80) || option.optionId.slice(0, 80),
      kind: OPTION_KINDS.includes(option.kind) ? option.kind : 'other',
    });
  }
  return out;
}

/**
 * Which office-level category a permission request falls in. Approving "for
 * the session" is remembered per category, so the mapping is deliberately
 * coarse and errs toward the narrower reading.
 */
export function requestCategory(kind, name) {
  switch (kind) {
    case 'execute': return 'command';
    case 'edit': case 'delete': case 'move': return 'file-change';
    case 'read': case 'search': return 'file-read';
    case 'fetch': return 'fetch';
    default: return `other:${line(name, 80).toLowerCase() || 'tool'}`;
  }
}

export const CATEGORY_LABEL = Object.freeze({
  command: 'commands', 'file-change': 'file changes', 'file-read': 'file reads', fetch: 'web fetches',
});
export const categoryLabel = (category) => CATEGORY_LABEL[category]
  || (category.startsWith('other:') ? `“${category.slice(6)}”` : 'this kind of request');

/**
 * One allowance window, as the office passes it on (`usage:report`): a percentage
 * used between 0 and 100, when it resets (epoch ms) and how long it is (minutes).
 * Anything that is not a sane number is left out rather than guessed.
 */
export function limitWindow(w) {
  if (!isObject(w) || !Number.isFinite(w.usedPercent)) return null;
  const id = line(typeof w.id === 'string' ? w.id : '', 40);
  if (!id) return null;
  const label = line(typeof w.label === 'string' ? w.label : '', 60);
  return {
    id,
    kind: LIMIT_KINDS.includes(w.kind) ? w.kind : 'session',
    ...(label ? { label } : {}),
    usedPercent: Math.max(0, Math.min(100, Math.round(w.usedPercent * 10) / 10)),
    ...(Number.isFinite(w.resetsAt) && w.resetsAt > 0 ? { resetsAt: Math.round(w.resetsAt) } : {}),
    ...(Number.isFinite(w.windowMins) && w.windowMins > 0 ? { windowMins: Math.round(w.windowMins) } : {}),
  };
}
