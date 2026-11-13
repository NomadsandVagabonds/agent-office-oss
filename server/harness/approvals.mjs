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
//   edits  file changes are allowed; everything else goes to the human
//   full   everything is allowed
// For ACP agents this is enforced at our end of the wire only: it governs how
// requests are ANSWERED, not whether the agent asks. Codex additionally gets
// the matching native sandbox and approval policy (see codex.mjs).
import { requestCategory, categoryLabel } from './normalize.mjs';

const kindOf = (options, kind) => options.find((o) => o.kind === kind) || null;

/** The actions a human may take on one request, each tied to the option that carries it out. */
export function choicesFor(options, category, { nativeSessionAllow = false } = {}) {
  const allowOnce = kindOf(options, 'allow_once');
  const allowAlways = kindOf(options, 'allow_always');
  const reject = kindOf(options, 'reject_once');
  const allow = allowOnce || allowAlways;
  const choices = [];
  if (allow) {
    choices.push({ action: 'once', label: 'Allow once', optionId: allow.id });
    choices.push({
      action: 'always', scope: 'session', category,
      label: `Allow ${categoryLabel(category)} for this session`,
      // Codex's own "for session" answer covers only this exact command or patch,
      // so it is safe to use; the office's memory is what covers the next one.
      optionId: (nativeSessionAllow && allowAlways ? allowAlways : allow).id,
    });
  }
  choices.push({ action: 'reject', label: 'Reject', optionId: reject ? reject.id : null });
  return choices;
}

/** Does the session's mode, or something the human already granted, answer this without asking? */
export function standingAnswer(mode, category, grants) {
  if (mode === 'full') return 'the session runs in full-access mode';
  if (mode === 'edits' && category === 'file-change') return 'the session accepts edits';
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
