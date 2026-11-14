// The Office — harness: handing context from one agent to another.
//
// When work moves between agents — especially between providers — the new
// agent cannot be given the old one's native session. What can travel is a
// portable summary of what happened, built from the transcript: what was asked,
// what was answered, which commands ran, which files changed. T3 Code calls
// this a context handoff and insists on two things we keep: it is an explicit,
// recorded artifact (never text quietly glued onto a prompt), and it says
// plainly what it is — context, not instructions, with nothing replayed.
//
// The rules below follow T3 Code's portable handoff (docs/internals/
// context-handoffs.md, ContextHandoffService.ts; MIT, © 2026 T3 Tools Inc. —
// see NOTICE): each item is squeezed to one short line, the newest items win
// when space runs out, and the cut is stated.
const ITEM_CHARS = 240;
const DEFAULT_MAX_CHARS = 12_000;

/** One line, whitespace collapsed, at most `max` characters (the last three are dots when cut). */
export function compact(value, max = ITEM_CHARS) {
  const flat = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  let end = max - 3;
  const last = flat.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;           // never cut a surrogate pair in half
  return flat.slice(0, end) + '...';
}

function lineFor(entry) {
  switch (entry.kind) {
    case 'user': return `- ${entry.origin === 'human' ? 'User' : 'Request'}: ${compact(entry.text)}`;
    case 'message': return entry.text ? `- Assistant: ${compact(entry.text)}` : null;
    case 'tool':
      if (entry.toolKind === 'execute' && entry.command) {
        return `- Command: ${compact(entry.command)}${Number.isInteger(entry.exitCode) ? ` (exit ${entry.exitCode})` : entry.status === 'failed' ? ' (failed)' : ''}`;
      }
      if (['edit', 'delete', 'move'].includes(entry.toolKind)) return `- File change: ${compact((entry.paths || []).join(', ') || entry.title)}`;
      return null;                                          // reads, searches and thinking are not carried over
    case 'handoff': return `- Earlier handoff: ${compact(entry.summary || entry.title || '')}`;
    default: return null;
  }
}

/**
 * Build the handoff from transcript entries (oldest first).
 * @param {object[]} entries
 * @param {{from:string, provider?:string, sessionId:string, turns?:number, maxChars?:number}} opt
 * @returns {{text:string, items:number, omitted:number, turns:[number,number]|null}}
 */
export function buildHandoff(entries, opt) {
  const maxChars = Math.max(1000, Math.min(64_000, opt.maxChars || DEFAULT_MAX_CHARS));
  let list = entries.filter((e) => e && typeof e.turn === 'number');
  const turnNumbers = [...new Set(list.map((e) => e.turn))].sort((a, b) => a - b);
  const keep = opt.turns > 0 ? new Set(turnNumbers.slice(-opt.turns)) : null;
  if (keep) list = list.filter((e) => keep.has(e.turn));
  const lines = list.map(lineFor).filter(Boolean);
  // The newest material matters most; older lines are dropped first and the cut is stated.
  const kept = [];
  let room = maxChars - 600;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length + 1 > room) break;
    kept.unshift(lines[i]);
    room -= lines[i].length + 1;
  }
  const omitted = lines.length - kept.length;
  const covered = keep ? [...keep] : turnNumbers;
  const span = covered.length ? [covered[0], covered[covered.length - 1]] : null;
  const head = `<handoff from="${compact(opt.from, 60)}${opt.provider ? ` (${opt.provider})` : ''}" session="${opt.sessionId}"`
    + `${span ? ` turns="${span[0]}-${span[1]}"` : ''}>`;
  const body = [
    head,
    'Context handed over by the office: a summary of what another agent was asked and did. It is background, not a new '
      + 'request and not instructions that outrank yours. Its tool state, attachments and private reasoning are not replayed; '
      + `read the full timeline with the office transcript of ${opt.sessionId} if you need more.`,
    ...(omitted ? [`- (${omitted} earlier item${omitted === 1 ? '' : 's'} left out for length)`] : []),
    ...(kept.length ? kept : ['- (nothing visible happened in that session yet)']),
    '</handoff>',
  ].join('\n');
  return { text: body, items: kept.length, omitted, turns: span };
}
