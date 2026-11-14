// The Office — who is working where. One card for each checkout of each
// repository the agents are in: the branch on a strip of tape, who is there,
// what has changed. Above the cards, the places where two agents are in each
// other's way — the same thing the red threads on the floor point at.
// The office only reads git; nothing on this panel can change a repository.
import { h, replace, shortPath, since } from './dom.js';

const css = `
#ui .rp { flex: 1 1 auto; min-width: 0; padding: 16px 18px 24px; }
#ui .rp h3 { margin: 22px 0 8px; font: 400 14px/1 var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
#ui .rp h3:first-child { margin-top: 0; }
#ui .rp .clash { display: flex; gap: 12px; align-items: flex-start; margin: 0 0 8px; padding: 10px 12px 11px; background: var(--paper); color: var(--paper-ink); border: 2px solid var(--edge); border-left: 8px solid var(--no); box-shadow: 3px 3px 0 rgba(0, 0, 0, .35); }
#ui .rp .clash.medium { border-left-color: var(--blocked); } #ui .rp .clash.low { border-left-color: var(--paper-3); }
#ui .rp .clash p { margin: 0; font: 13px/1.45 var(--sans); }
#ui .rp .clash code { font: 12.5px/1.4 var(--mono); background: #fffaf0; padding: 0 4px; overflow-wrap: anywhere; }
#ui .rp .clash small { display: block; margin-top: 3px; font: 11px/1.3 var(--mono); color: var(--paper-dim); }
#ui .rp .clash .who { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
#ui .rp .clash .who a { padding: 1px 7px 2px; background: var(--tape); color: #f4f0e6; font: 400 13px/1.4 var(--display); cursor: pointer; }
#ui .rp .clash .who a:hover { background: var(--brass); color: var(--accent-ink); }
#ui .rp .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
#ui .rp .co { display: grid; gap: 9px; align-content: start; padding: 12px 14px 13px; border: 2px solid var(--edge); background: var(--board-2); min-width: 0; }
#ui .rp .co header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#ui .rp .branch { max-width: 100%; padding: 2px 8px 3px; background: var(--tape); color: #f4f0e6; font: 400 15px/1.3 var(--display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ui .rp .mark { font: 600 10px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--accent); border: 2px solid var(--brass-lo); padding: 2px 6px 3px; }
#ui .rp .at { font: 11.5px/1.35 var(--mono); color: var(--faint); overflow-wrap: anywhere; }
#ui .rp .who { display: flex; gap: 6px; flex-wrap: wrap; }
#ui .rp .who .chip { cursor: pointer; } #ui .rp .who .chip:hover { color: var(--ink); background: rgba(216, 236, 222, .16); }
#ui .rp .files { margin: 0; padding: 0; list-style: none; font: 12px/1.5 var(--mono); color: var(--dim); }
#ui .rp .files li { display: flex; gap: 8px; min-width: 0; }
#ui .rp .files i { flex: none; width: 1ch; font-style: normal; font-weight: 600; color: var(--accent); }
#ui .rp .files span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
#ui .rp .files li.hot, #ui .rp .files li.hot i { color: var(--danger); }
#ui .rp .files li.more { color: var(--faint); }
#ui .rp .claim { display: flex; gap: 10px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 12.5px; }
#ui .rp .claim code { font: 12.5px/1.4 var(--mono); color: var(--ink); }
#ui .rp .claim .dim { margin-left: auto; white-space: nowrap; font: 11.5px/1.4 var(--mono); }
#ui .rp .how { display: grid; gap: 6px; font-size: 12.5px; color: var(--dim); max-width: 74ch; }
#ui .rp .how code { font: 12px/1.4 var(--mono); color: var(--ink); background: rgba(255, 255, 255, .06); padding: 1px 5px; }
`;

const STATE = { M: 'changed', A: 'added', D: 'deleted', R: 'renamed', U: 'in conflict', '?': 'new, untracked' };
const until = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 90 ? `${m} min` : `${Math.round(m / 60)} h`; };

export function open({ office, ui, content }) {
  if (!document.getElementById('rp-css')) document.head.append(h('style', { id: 'rp-css' }, css));
  const net = office.net;
  const root = h('div.rp.scroll');
  content.append(root);
  const nameOf = (id) => net.state.agents.get(id)?.name || null;
  const chip = (id, name) => h('span.chip', { title: 'Go to their desk', onclick: () => ui.select(id) }, name || nameOf(id) || 'someone who has left');

  function clash(o, now) {
    // the sentence is the office's own; the file gets set apart so a long path can wrap
    const [before, after] = o.path && o.text?.includes(o.path) ? o.text.split(o.path) : [o.text || '', ''];
    return h(`div.clash.${o.severity || 'low'}`,
      h('div.grow', h('p', before, o.path && o.text?.includes(o.path) ? h('code', o.path) : null, after),
        h('small', `noticed ${since(o.since, now)} · both have been told`),
        h('div.who', (o.agents || []).map((a) => h('a', { title: 'Go to their desk', onclick: () => ui.select(a.id) }, a.name)))));
  }

  function checkout(c, hot) {
    const here = (c.agents || []).filter((id) => net.state.agents.has(id));
    const files = c.files || [];
    const shown = files.slice(0, 10);
    return h('div.co',
      h('header', h('span.branch', { title: c.branch || c.head || '' }, c.branch || (c.detached ? `detached at ${String(c.head || '').slice(0, 9)}` : 'no branch yet')),
        c.linked ? h('span.mark', { title: 'A second checkout of the same repository (git worktree)' }, 'worktree') : null,
        c.ahead || c.behind ? h('span.dim.mono', { title: c.upstream ? `compared with ${c.upstream}` : '' }, [c.ahead ? `${c.ahead} ahead` : '', c.behind ? `${c.behind} behind` : ''].filter(Boolean).join(' · ')) : null),
      h('div.at', shortPath(c.root)),
      here.length ? h('div.who', here.map((id) => chip(id))) : h('div.dim', 'Nobody is here right now.'),
      files.length ? h('ul.files', shown.map((f) => h('li' + (hot.has(f.path) ? '.hot' : ''), { title: `${f.path} — ${STATE[f.state] || f.state}${hot.has(f.path) ? ' — two agents are in this file' : ''}` }, h('i', f.state), h('span', f.path))),
        files.length > shown.length || c.truncated ? h('li.more', `and ${Math.max(c.dirty || files.length, files.length) - shown.length} more`) : null)
        : h('div.dim', 'Nothing changed since the last commit.'));
  }

  function render() {
    const ws = net.state.workspace, now = net.now();
    if (!ws) { replace(root, h('div.empty', 'The office has not said who is where yet.')); return; }
    const overlaps = (ws.overlaps || []).slice().sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.severity] ?? 3));
    const hotByRepo = new Map();
    for (const o of overlaps) { if (!hotByRepo.has(o.repo)) hotByRepo.set(o.repo, new Set()); if (o.path) hotByRepo.get(o.repo).add(o.path); }
    const repos = (ws.repos || []).filter((r) => (r.checkouts || []).length);
    const claims = ws.claims || [];
    replace(root,
      overlaps.length ? [h('h3', overlaps.length === 1 ? 'In each other’s way' : `In each other’s way · ${overlaps.length}`), overlaps.map((o) => clash(o, now))] : null,
      repos.map((r) => [
        h('h3', r.name),
        h('div.grid', r.checkouts.map((c) => checkout(c, hotByRepo.get(r.id) || new Set()))),
        (r.idle || []).length ? h('div.at', { style: { marginTop: '8px' } }, `Also checked out, with nobody in it: ${r.idle.map((w) => w.branch || 'detached').join(', ')}`) : null,
      ]),
      repos.length ? null : h('div.empty', ws.git === false ? 'The office is not reading git here (git is missing, or OFFICE_GIT=0).' : 'Nobody is working in a git repository right now.'),
      claims.length ? [h('h3', 'Spoken for'), claims.map((c) => h('div.claim', h('code', c.pattern), h('span', c.agentName || nameOf(c.agentId) || ''), c.note ? h('span.dim', `“${c.note}”`) : null,
        h('span.dim', c.until ? `for another ${until(c.until - now)}` : '')))] : null,
      h('h3', 'What agents can do about it'),
      h('div.how',
        h('div', h('code', 'office touching <path>'), ' — is anyone else in this file? Claude Code can ask by itself before every edit: ', h('code', 'npm run install-guard'), '.'),
        h('div', h('code', 'office claim <path> --note "…"'), ' — this is mine for now. ', h('code', 'office worktree <name>'), ' — my own checkout of the same repository, on a branch of its own.')));
  }
  const off = net.on('workspace', render);
  const tick = setInterval(render, 30000);
  render();
  return { close() { off(); clearInterval(tick); } };
}
