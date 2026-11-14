// The Office — the review table. A card in Review, laid out on a sheet of
// paper over the board: which branch and commit were put up (and whether the
// ground has moved since), what was found, who looked and what they would do,
// and two stamps for the one decision that is yours.
//
// Everything on it is read from GET /api/tasks/:id/review; the sheet only
// draws it and sends back what you do.
import { h, since, replace, shortPath } from './dom.js';

const css = `
#ui .kb { position: relative; }
#ui .rvt { position: absolute; inset: 0; z-index: 3; display: grid; place-items: start center; padding: 18px 14px; overflow-y: auto; background: rgba(34, 20, 6, .55); }
#ui .rvt .sheetp { position: relative; width: min(720px, 100%); padding: 20px 24px 22px; background: var(--paper); color: var(--paper-ink); border: 2px solid var(--edge); box-shadow: 6px 6px 0 rgba(20, 12, 4, .5); font: 13px/1.5 var(--sans); }
#ui .rvt .x { position: absolute; right: 10px; top: 10px; width: 28px; height: 28px; border: 2px solid var(--paper-ink); background: transparent; color: var(--paper-ink); font: 600 15px/1 var(--mono); cursor: pointer; }
#ui .rvt .x:hover { background: var(--paper-ink); color: var(--paper); }
#ui .rvt .kicker { font: 600 12px/1 var(--display); letter-spacing: .16em; text-transform: uppercase; color: var(--pen); }
#ui .rvt h3 { margin: 6px 40px 2px 0; font: 600 22px/1.15 var(--display); letter-spacing: 0; text-transform: none; color: var(--paper-ink); }
#ui .rvt .by { font: 12px/1.4 var(--mono); color: var(--paper-dim); }
#ui .rvt .body { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--paper-dim); max-height: 6em; overflow-y: auto; }
#ui .rvt h4 { margin: 18px 0 8px; padding-top: 12px; border-top: 2px dashed var(--paper-line); font: 600 12px/1 var(--display); letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
#ui .rvt .pin { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; font: 12.5px/1.4 var(--mono); }
#ui .rvt .branch { padding: 2px 8px 3px; background: var(--tape); color: #f4f0e6; font: 400 15px/1.3 var(--display); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ui .rvt .oid { font-weight: 600; }
#ui .rvt .facts { margin: 6px 0 0; font: 12px/1.5 var(--mono); color: var(--paper-dim); }
#ui .rvt .warn { margin: 8px 0 0; padding: 6px 9px; border: 2px solid var(--no); color: var(--no); font: 12.5px/1.4 var(--mono); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
#ui .rvt .loose { color: #8a5a00; }
#ui .rvt .files { margin: 8px 0 0; padding: 0; list-style: none; columns: 2; column-gap: 18px; font: 12px/1.55 var(--mono); max-height: 9.5em; overflow-y: auto; }
#ui .rvt .files li { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; break-inside: avoid; }
#ui .rvt .files li.un { color: #8a5a00; }
#ui .rvt .f { display: grid; grid-template-columns: 18px 1fr auto; gap: 2px 8px; align-items: start; padding: 6px 0; border-bottom: 1px solid var(--paper-2); }
#ui .rvt .f .box { width: 14px; height: 14px; margin-top: 3px; border: 2px solid var(--paper-ink); background: transparent; padding: 0; cursor: pointer; font: 600 10px/10px var(--mono); color: var(--paper); }
#ui .rvt .f.done .box { background: var(--paper-dim); border-color: var(--paper-dim); }
#ui .rvt .f.done .t { color: var(--paper-dim); text-decoration: line-through; text-decoration-color: rgba(90, 80, 69, .5); }
#ui .rvt .f .sev { margin-right: 6px; padding: 0 5px 1px; border: 2px solid currentColor; font: 600 10px/1.4 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--no); }
#ui .rvt .f .sev.note { color: var(--paper-dim); }
#ui .rvt .f .at { font: 12px/1.5 var(--mono); color: var(--pen); }
#ui .rvt .f small { grid-column: 2; font: 11px/1.4 var(--mono); color: var(--paper-dim); }
#ui .rvt .f .who { font: 11px/1.9 var(--mono); color: var(--paper-dim); white-space: nowrap; }
#ui .rvt .none { color: var(--paper-dim); font: 12.5px/1.5 var(--mono); }
#ui .rvt .line { display: flex; gap: 8px; align-items: flex-end; margin-top: 10px; flex-wrap: wrap; }
#ui .rvt .line input[type=text] { flex: 1 1 200px; min-width: 0; padding: 4px 2px; background: transparent; border: 0; border-bottom: 2px solid var(--paper-ink); outline: none; font: 13px/1.3 var(--mono); color: var(--paper-ink); }
#ui .rvt .line input.where { flex: 0 1 170px; }
#ui .rvt .line input::placeholder { color: var(--paper-dim); }
#ui .rvt .line label { display: inline-flex; gap: 5px; align-items: center; font: 12px/1 var(--mono); color: var(--paper-dim); cursor: pointer; }
#ui .rvt .pbtn { height: 28px; padding: 0 10px 2px; border: 2px solid var(--paper-ink); background: var(--paper-ink); color: var(--paper); font: 400 14px/1 var(--display); cursor: pointer; }
#ui .rvt .pbtn.quiet { background: transparent; color: var(--paper-ink); }
#ui .rvt .pbtn:hover { background: #000; color: var(--paper); } #ui .rvt .pbtn[disabled] { opacity: .4; cursor: default; }
#ui .rvt select { height: 28px; padding: 0 6px; border: 2px solid var(--paper-ink); background: transparent; color: var(--paper-ink); font: 12.5px/1 var(--mono); }
#ui .rvt .look { padding: 5px 0; font: 12.5px/1.5 var(--sans); }
#ui .rvt .look b { font-weight: 600; } #ui .rvt .look .say { color: var(--ok); font-weight: 600; } #ui .rvt .look .say.changes { color: var(--no); }
#ui .rvt .look p { margin: 2px 0 0; color: var(--paper-dim); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 5.4em; overflow-y: auto; font: 12px/1.5 var(--mono); }
#ui .rvt .look a { color: var(--paper-ink); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
#ui .rvt .call { position: sticky; bottom: -18px; margin: 18px -24px -22px; padding: 0 24px 18px; background: var(--paper); border-top: 2px dashed var(--paper-line); box-shadow: 0 -8px 10px -8px rgba(42, 36, 32, .25); }
#ui .rvt .call h4 { margin-top: 0; border-top: 0; }
#ui .rvt .decide { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
#ui .rvt .decide .inkstamp { height: 40px; padding: 0 16px 2px; font-size: 18px; }
#ui .rvt .ruling { display: inline-block; margin-top: 6px; padding: 4px 12px 6px; border: 4px solid currentColor; font: 600 24px/1 var(--display); letter-spacing: .08em; transform: rotate(-3deg); color: var(--ok); }
#ui .rvt .ruling.changes { color: var(--no); } #ui .rvt .ruling.off { color: var(--paper-dim); font-size: 16px; border-width: 3px; }
#ui .rvt .err { margin-top: 8px; color: var(--no); font: 12px/1.4 var(--mono); min-height: 1em; }
#ui .kb .card .rv { margin-top: 6px; padding-top: 5px; border-top: 1px dashed var(--paper-line); font: 11px/1.4 var(--mono); color: var(--paper-dim); }
#ui .kb .card .rv > div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ui .kb .card .rv .pinline { color: var(--paper-dim); }
#ui .kb .card .rv b { color: var(--paper-ink); font-weight: 600; } #ui .kb .card .rv.hot { color: var(--no); } #ui .kb .card .rv.ok { color: var(--ok); }
`;

/** One line for a card on the board: where its review stands. → an element, or null */
export function reviewLine(rv) {
  if (!document.getElementById('rvt-css')) document.head.append(h('style', { id: 'rvt-css' }, css));
  if (!rv) return null;
  const open = rv.open ? `${rv.open} open${rv.blockers ? ` · ${rv.blockers} blocker${rv.blockers > 1 ? 's' : ''}` : ''}` : '';
  if (rv.state === 'open') {
    const pin = rv.pinned ? [h('b', rv.pinned.branch || 'detached'), ` @ ${rv.pinned.head}${rv.pinned.dirty ? ' +' + rv.pinned.dirty : ''}`] : rv.capturing ? 'reading the version…' : 'version unknown';
    return h('div.rv' + (rv.blockers ? '.hot' : ''),
      h('div', open || (rv.reviewing ? 'being reviewed' : 'waiting for a verdict'), open && rv.reviewing ? ' · being reviewed' : ''),
      h('div.pinline', { title: rv.pinned ? `${rv.pinned.branch || 'detached'} at ${rv.pinned.head}${rv.pinned.dirty ? `, plus ${rv.pinned.dirty} uncommitted file${rv.pinned.dirty > 1 ? 's' : ''}` : ''}` : '' }, pin));
  }
  if (rv.state === 'approved') return h('div.rv.ok', `approved by ${rv.verdict?.by || 'the human'}`);
  if (rv.state === 'changes') return h('div.rv' + (rv.open ? '.hot' : ''), `changes asked${open ? ` · ${open}` : ''}`);
  if (rv.state === 'closed') return h('div.rv', `closed without a verdict by ${rv.closedBy || 'someone'}`);
  return null;
}

export function openReviewTable({ office, ui, host, taskId, onClose }) {
  if (!document.getElementById('rvt-css')) document.head.append(h('style', { id: 'rvt-css' }, css));
  const net = office.net;
  const at = `/api/tasks/${encodeURIComponent(taskId)}/review`;
  const sheet = h('div.sheetp');
  const veil = h('div.rvt', { onclick: (e) => { if (e.target === veil) close(); } }, sheet);
  host.append(veil);
  let table = null, adapters = [], shut = false, busy = false, err = '';
  // what is being typed survives a redraw (the board redraws whenever anything on it changes)
  const draft = { finding: '', where: '', blocker: false, note: '', focus: '', to: 'any' };
  const quiet = (el) => { el.addEventListener('keydown', (e) => e.stopPropagation()); return el; };

  async function send(path, body, method = 'POST') {
    if (busy) return null;
    busy = true; err = '';
    try { const r = await net.api(at + path, { method, body: body || {} }); busy = false; await load(); return r; }
    catch (e) { busy = false; err = e.message; draw(); return null; }
  }

  async function load() {
    try { table = await net.api(at); err = err || ''; }
    catch (e) { if (!table) { replace(sheet, h('button.x', { type: 'button', onclick: close }, '×'), h('p.none', e.status === 409 ? 'This card has not been put up for review.' : `The table could not be read: ${e.message}`)); return; } err = e.message; }
    if (!shut) draw();
  }

  function version(t) {
    const v = t.version;
    if (t.capturing || !v) return h('p.facts', 'The office is reading where the work is…');
    if (!v.known) return h('p.facts', `Which version this is could not be read: ${v.why}.`);
    const commits = v.base ? `${v.commits ?? 'some'} commit${v.commits === 1 ? '' : 's'} on top of ${v.base} · ${v.changedTotal} file${v.changedTotal === 1 ? '' : 's'} changed` : 'on the trunk itself: nothing to compare it with';
    return [
      h('div.pin', h('span.branch', { title: shortPath(v.root) }, v.detached ? 'detached' : v.branch), 'at', h('span.oid', { title: v.head }, String(v.head || '').slice(0, 9)), h('span', { style: { color: 'var(--paper-dim)' } }, `· ${v.repoName}`)),
      h('p.facts', commits, v.dirty ? h('span.loose', ` · plus ${v.dirty} uncommitted file${v.dirty > 1 ? 's' : ''}, pinned to nothing`) : null),
      t.moved ? h('div.warn', t.moved.gone ? 'That folder can no longer be read.' : `The branch has moved since this was put up: it is now at ${String(t.moved.head).slice(0, 9)}.`,
        t.state === 'open' ? h('button.pbtn.quiet', { type: 'button', onclick: () => send('/refresh') }, 'Read it again') : null) : null,
      v.changed.length || v.uncommitted.length ? h('ul.files', v.changed.map((p) => h('li', { title: p }, p)), v.uncommitted.map((f) => h('li.un', { title: `${f.path} — not committed` }, `${f.path} *`)),
        v.changedTotal > v.changed.length ? h('li', `…and ${v.changedTotal - v.changed.length} more`) : null) : null,
    ];
  }

  function finding(f) {
    const done = !!f.resolved;
    return h('div.f' + (done ? '.done' : ''),
      h('button.box', { type: 'button', title: done ? 'Open it again' : 'Mark it dealt with',
        onclick: () => send(`/findings/${encodeURIComponent(f.id)}`, { resolved: !done }, 'PATCH') }, done ? '✓' : ''),
      h('div.t', h('span.sev.' + f.severity, f.severity), f.file ? h('span.at', `${f.file}${f.line ? ':' + f.line : ''} `) : null, f.text),
      h('span.who', f.by?.name || ''),
      done ? h('small', `dealt with by ${f.resolved.by?.name || 'someone'}${f.resolved.note ? `: ${f.resolved.note}` : ''}`) : null);
  }

  function draw() {
    const t = table;
    if (!t) return;
    const live = t.state === 'open' && t.status === 'review';
    const open = t.findings.filter((f) => !f.resolved), done = t.findings.filter((f) => f.resolved);
    const blockers = open.filter((f) => f.severity === 'blocker').length;
    const card = [...net.state.tasks.values()].flat().find((x) => x.id === taskId);

    const text = quiet(h('input', { type: 'text', placeholder: 'what is wrong, and why it matters', value: draft.finding, oninput: (e) => { draft.finding = e.target.value; } }));
    const where = quiet(h('input.where', { type: 'text', placeholder: 'file:line (optional)', value: draft.where, oninput: (e) => { draft.where = e.target.value; } }));
    const blocker = h('input', { type: 'checkbox', checked: draft.blocker, onchange: (e) => { draft.blocker = e.target.checked; } });
    const add = async () => {
      if (!draft.finding.trim()) return;
      const m = /^(.*?)(?::(\d+))?$/.exec(draft.where.trim());
      const ok = await send('/findings', { text: draft.finding.trim(), ...(m?.[1] ? { file: m[1] } : {}), ...(m?.[2] ? { line: Number(m[2]) } : {}), ...(draft.blocker ? { severity: 'blocker' } : {}) });
      if (ok) { draft.finding = ''; draft.where = ''; draft.blocker = false; draw(); }
    };
    for (const el of [text, where]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

    const note = quiet(h('input', { type: 'text', placeholder: 'a word to go with it (optional)', value: draft.note, oninput: (e) => { draft.note = e.target.value; } }));
    const decide = (decision) => send('/verdict', { decision, note: draft.note.trim() });

    const focus = quiet(h('input', { type: 'text', placeholder: 'anything to look at especially (optional)', value: draft.focus, oninput: (e) => { draft.focus = e.target.value; } }));
    const pick = h('select', { onchange: (e) => { draft.to = e.target.value; } }, h('option', { value: 'any', selected: draft.to === 'any' }, 'whoever has room'),
      adapters.map((a) => h('option', { value: a.id, selected: draft.to === a.id }, a.label)));

    const ruling = t.verdict ? h('div', h(`span.ruling${t.verdict.decision === 'changes' ? '.changes' : ''}`, t.verdict.decision === 'approved' ? 'Approved' : 'Changes asked'),
      h('p.facts', `${t.verdict.by?.name || 'Lead'} · ${since(t.verdict.at, net.now())}${t.verdict.head ? ` · at ${String(t.verdict.head).slice(0, 9)}` : ''}${t.verdict.note ? ` · “${t.verdict.note}”` : ''}`))
      : t.closed ? h('div', h('span.ruling.off', t.state === 'closed' ? 'Closed without a verdict' : 'Taken back'), h('p.facts', `${t.closed.by?.name || 'someone'} · ${since(t.closed.at, net.now())}`)) : null;

    replace(sheet,
      h('button.x', { type: 'button', title: 'Close (Esc)', onclick: close }, '×'),
      h('div.kicker', `Review${t.round > 1 ? ` · round ${t.round}` : ''}`),
      h('h3', t.title),
      h('div.by', [t.assigneeName ? `by ${t.assigneeName}` : 'nobody is carrying it', t.openedAt ? `put up ${since(t.openedAt, net.now())}` : ''].filter(Boolean).join(' · ')),
      card?.body ? h('p.body', card.body) : null,
      version(t),

      h('h4', open.length ? `Findings · ${open.length} open` : 'Findings'),
      t.findings.length ? [open.map(finding), done.map(finding)] : h('p.none', 'Nothing has been found yet.'),
      live ? h('div.line', text, where, h('label', blocker, 'blocker'), h('button.pbtn', { type: 'button', onclick: add }, 'Add')) : null,

      t.recommendations.length || t.runs.length || (live && t.canAskAgents) ? h('h4', 'Who looked') : null,
      t.recommendations.map((r) => h('div.look', h('b', r.by.name), ' would ', h(`span.say${r.decision === 'changes' ? '.changes' : ''}`, r.decision === 'approved' ? 'approve' : 'ask for changes'), r.note ? `: ${r.note}` : '')),
      t.runs.map((r) => h('div.look', h('b', r.to?.name || 'An agent'), ' was asked to review — ', { queued: 'waiting to start', running: 'looking now', waiting: 'waiting on you', completed: 'done', failed: 'it failed', cancelled: 'cancelled', interrupted: 'stopped' }[r.status] || r.status,
        r.to?.agentId ? [' · ', h('a', { onclick: () => ui.openSheet('work', { driven: r.to.agentId }) }, 'its record')] : null,
        r.summary ? h('p', r.summary) : r.error ? h('p', r.error) : null)),
      live && t.canAskAgents ? h('div.line', pick, focus, h('button.pbtn.quiet', { type: 'button', title: 'Start an agent and hand it this review. It only reads.', onclick: async () => { const ok = await send('/run', { to: draft.to, focus: draft.focus.trim() }); if (ok) { draft.focus = ''; draw(); } } }, 'Ask an agent to review')) : null,

      h('div.call', h('h4', live ? 'Your call' : 'What was decided'),
        live ? [h('div.line', note),
          h('div.decide', h('button.inkstamp.ok', { type: 'button', title: 'Accept it: the card moves to Done', onclick: () => decide('approved') }, h('span', 'Approve')),
            h('button.inkstamp.no', { type: 'button', title: 'Send it back with the open findings', onclick: () => decide('changes') }, h('span', 'Changes')),
            blockers ? h('span.facts', { style: { margin: 0, color: 'var(--no)' } }, `${blockers} blocker${blockers > 1 ? 's' : ''} still open`) : null)]
          : ruling || h('p.none', 'Nothing was decided.'),
        h('div.err', err)));
  }

  function close() {
    if (shut) return;
    shut = true; off(); window.removeEventListener('keydown', key, true);
    veil.remove();
    onClose?.();
  }
  const key = (e) => { if (e.key === 'Escape' && !shut) { e.stopPropagation(); e.preventDefault(); close(); } };
  window.addEventListener('keydown', key, true);
  // the card's summary rides on the board's own broadcast: when it changes, read the table again
  let last = '';
  const off = net.on('tasks', () => {
    const card = [...net.state.tasks.values()].flat().find((x) => x.id === taskId);
    if (!card) { close(); return; }
    const sig = JSON.stringify(card.review) + card.status;
    if (sig !== last) { last = sig; if (!busy) load(); }
  });

  net.api('/api/harness').then((hz) => { adapters = (hz.adapters || []).filter((a) => a.available); if (table && !shut) draw(); }).catch(() => {});
  load();
  return { close, get open() { return !shut; } };
}
