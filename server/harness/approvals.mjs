// The Office — harness: what "allow once", "allow for the session" and
// "reject" mean, exactly.
//
// A permission request arrives with the agent's own answers (each with the
// agent's id and label). The office offers the human three actions on top of
// them, and is careful about what each one promises:
//
//   once    the agent's "allow this time" option.
//   always  allowed now, and the OFFICE remembers it for this session: later
//           requests of the same category (commands, file changes, …) are
//           answered "allow once" by the office without asking, and each one is
//           written to the transcript. The memory lives in the office and ends
//           with the session. We do not hand the agent its own "always allow"
//           unless there is no other way to say yes — some agents keep that
//           choice on disk long after the session, and the card would be lying
//           about its scope. (The agent's own option stays reachable by id.)
//   reject  the agent's "reject this time" option; if it offers none, the
//           request is cancelled, which the protocol defines as a refusal.
//
// A session's mode decides what the office answers without asking at all:
//   ask    nothing — every request goes to the human
//   edits  file changes inside the session's folder; everything else goes to the human
//   full   everything is allowed
// For ACP agents this is enforced at our end of the wire only: it governs how
// requests are ANSWERED, not whether the agent asks. Codex additionally gets
// the matching native sandbox and approval policy (see codex.mjs).
//
// Standing permission for files — from the mode or from a session grant —
// stops at the edge of the session's folder. A request about a file outside it
// (or one that does not say which file) is always asked, and is never the
// start of a session-wide grant. T3 Code draws the same line for its
// workspace-write policy (packages/provider-acp/src/server/clientPolicy.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requestCategory, categoryLabel } from './normalize.mjs';

const FILE_CATEGORIES = new Set(['file-change', 'file-read']);

// The real location of a path that may not exist yet: resolve links on the
// deepest part that does exist, then put the rest back.
function canonical(target) {
  let head = target, rest = '';
  for (let i = 0; i < 64; i++) {
    try { return path.join(fs.realpathSync(head), rest); }
    catch {
      const parent = path.dirname(head);
      if (parent === head) return target;
      rest = path.join(path.basename(head), rest);
      head = parent;
    }
  }
  return target;
}

/**
 * Are all of these paths inside `root`, following symlinks? An empty list, or a
 * path that cannot be placed, is "no": standing permission needs to know where.
 * Paths come from the agent and may be relative to the folder; a leading "~" is
 * the home directory (our own redactor writes it that way).
 */
export function insideFolder(root, paths) {
  if (typeof root !== 'string' || !root || !Array.isArray(paths) || !paths.length) return false;
  const base = canonical(path.resolve(root));
  return paths.every((p) => {
    if (typeof p !== 'string' || !p || p.includes('\0')) return false;
    const absolute = p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : path.resolve(base, p);
    const rel = path.relative(base, canonical(absolute));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

const kindOf = (options, kind) => options.find((o) => o.kind === kind) || null;

/**
 * The actions a human may take on one request, each tied to the option that carries it out.
 * `inside` says whether the files concerned are all in the session's folder (see insideFolder);
 * it only matters for file requests.
 */
export function choicesFor(options, category, { nativeSessionAllow = false, inside = true } = {}) {
  const allowOnce = kindOf(options, 'allow_once');
  const allowAlways = kindOf(options, 'allow_always');
  const reject = kindOf(options, 'reject_once');
  const allow = allowOnce || allowAlways;
  const choices = [];
  if (allow) {
    choices.push({ action: 'once', label: 'Allow once', optionId: allow.id });
    // A file outside the folder is a decision about that file, not the start of a standing permission.
    if (!FILE_CATEGORIES.has(category) || inside) {
      choices.push({
        action: 'always', scope: 'session', category,
        label: `Allow ${categoryLabel(category)} for this session`,
        // Codex's own "for session" answer covers only this exact command or patch,
        // so it is safe to use; the office's memory is what covers the next one.
        optionId: (nativeSessionAllow && allowAlways ? allowAlways : allow).id,
      });
    }
  }
  choices.push({ action: 'reject', label: 'Reject', optionId: reject ? reject.id : null });
  return choices;
}

/** Does the session's mode, or something the human already granted, answer this without asking? */
export function standingAnswer(mode, category, grants, { inside = true } = {}) {
  if (mode === 'full') return 'the session runs in full-access mode';
  if (FILE_CATEGORIES.has(category) && !inside) return '';
  if (mode === 'edits' && category === 'file-change') return 'the session accepts edits in its folder';
  if (grants.has(category)) return `you allowed ${categoryLabel(category)} for this session`;
  return '';
}

/** One line a person can decide on: what the agent wants to do. */
export function describeRequest(event) {
  const where = event.paths?.length ? event.paths.slice(0, 3).join(', ') + (event.paths.length > 3 ? ` (+${event.paths.length - 3})` : '') : '';
  let ask;
  if (event.command) ask = `Wants to run: ${event.command}`;
  else if (event.kind === 'edit' || event.kind === 'delete' || event.kind === 'move') ask = `Wants to change: ${where || event.title}`;
  else if (event.kind === 'read' || event.kind === 'search') ask = `Wants to read: ${where || event.title}`;
  else if (event.kind === 'fetch') ask = `Wants to fetch: ${event.title}`;
  else ask = `Wants permission: ${event.title}`;
  return [ask, event.detail].filter(Boolean).join('\n');
}

export const categoryOf = (event) => requestCategory(event.kind, event.name || event.title);
