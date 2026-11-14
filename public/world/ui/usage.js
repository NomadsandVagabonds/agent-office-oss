// The Office — how much is left. The panel behind the fuel chip in the top
// bar and the glass tanks beside the big board: one card per provider, a bar
// per window, when it resets, where the reading came from and how old it is.
// An old reading looks old; nothing here is ever dressed up as current.
import { h, replace } from './dom.js';

const css = `
#ui .fuel { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--line); cursor: pointer; font: 600 10px/1 var(--mono); letter-spacing: .06em; color: var(--dim); }
#ui .fuel:hover { border-color: var(--line-2); color: var(--ink); }
#ui .fuel .cell { display: inline-flex; align-items: center; gap: 3px; }
#ui .fuel .bar { width: 18px; height: 6px; border-radius: 2px; background: rgba(255, 255, 255, .1); overflow: hidden; }
#ui .fuel .bar i { display: block; height: 100%; background: var(--working); }
#ui .fuel .low .bar i { background: var(--blocked); } #ui .fuel .critical .bar i, #ui .fuel .out .bar i { background: var(--danger); }
#ui .fuel .stale .bar i { background: var(--idle); }
#ui .fuel .critical, #ui .fuel .out { color: var(--danger); }
#ui .use { flex: 1 1 auto; min-width: 0; padding: 16px 18px 24px; }
#ui .use .advice { margin: 0 0 14px; padding: 10px 12px; border-radius: 9px; background: rgba(240, 184, 96, .08); border: 1px solid rgba(240, 184, 96, .3); }
#ui .use .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
#ui .use .meter-card { display: grid; gap: 10px; align-content: start; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line-2); min-width: 0; }
#ui .use .meter-card.stale { opacity: .72; }
#ui .use .meter-card header { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
#ui .use .meter-card header b { font-weight: 600; font-size: 14px; }
#ui .use .plan { font: 600 10px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--accent); border: 1px solid rgba(240, 184, 96, .4); padding: 3px 6px; border-radius: 5px; }
#ui .use .win { display: grid; grid-template-columns: minmax(5.2em, max-content) 1fr; gap: 4px 10px; align-items: center; font-size: 12.5px; }
#ui .use .win .lab { color: var(--dim); }
#ui .use .win .track { height: 9px; border-radius: 3px; background: rgba(255, 255, 255, .08); overflow: hidden; }
#ui .use .win .track i { display: block; height: 100%; background: var(--working); }
#ui .use .win.low .track i { background: var(--blocked); } #ui .use .win.critical .track i { background: var(--danger); }
#ui .use .win.old .track i { background: var(--idle); }
#ui .use .win .say { grid-column: 2; color: var(--dim); font: 11.5px/1.3 var(--mono); font-variant-numeric: tabular-nums; }
#ui .use .from { color: var(--faint); font: 11px/1.4 var(--mono); }
#ui .use .who { display: flex; gap: 6px; flex-wrap: wrap; }
#ui .use h3 { font: 600 10px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); margin: 22px 0 8px; }
#ui .use .how { display: grid; gap: 6px; font-size: 12.5px; color: var(--dim); max-width: 70ch; }
#ui .use .how code { font: 12px/1.4 var(--mono); color: var(--ink); background: rgba(255, 255, 255, .06); padding: 1px 5px; border-radius: 4px; }
`;
function style() { if (!document.getElementById('use-css')) document.head.append(h('style', { id: 'use-css' }, css)); }

const SHORT = { claude: 'C', codex: 'O', gemini: 'G', openrouter: 'R' };
const age = (ms) => { const s = Math.round(ms / 1000); return s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : s < 129600 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`; };
const until = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 90 ? `${m} min` : m < 2160 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const levelOf = (left) => (left <= 12 ? 'critical' : left <= 35 ? 'low' : 'ok');

/** The chip for the top bar: one small bar per provider. Hidden until something has reported. */
export function createFuelChip(office, ui) {
  style();
  const el = h('span.fuel.hidden', { title: 'How much each provider has left (U)', onclick: () => ui.toggleSheet('usage') });
  function render(usage) {
    const meters = (usage?.meters || []).filter((m) => m.left !== null).slice(0, 5);
    el.classList.toggle('hidden', !meters.length);
    replace(el, meters.map((m) => h(`span.cell.${m.stale ? 'stale' : m.level}`, { title: `${m.label}: ${Math.round(m.left)}% left${m.stale ? ' (old reading)' : ''}` },
      SHORT[m.provider] || m.provider[0].toUpperCase(), h('span.bar', h('i', { style: { width: `${Math.max(4, m.left)}%` } })))));
    el.title = usage?.text || 'How much each provider has left (U)';
  }
  office.net.on('usage', render);
  render(office.net.state.usage);
  return el;
}

export function open({ office, ui, content, header }) {
  style();
  const net = office.net;
  const root = h('div.use.scroll');
  content.append(root);
  const refresh = h('button.btn.ghost.small', { title: 'Ask again where the office can ask', onclick: async () => { try { await net.api('/api/usage/refresh', { method: 'POST', body: {} }); } catch { /* the bus will say */ } } }, 'Refresh');
  header.append(refresh);

  function card(m, now) {
    const agents = (m.agents || []).map((id) => net.state.agents.get(id)).filter(Boolean);
    return h('div.meter-card' + (m.stale ? '.stale' : ''),
      h('header', h('b', m.label), m.plan ? h('span.plan', m.plan) : null),
      m.windows.length ? m.windows.map((w) => h(`div.win.${w.stale ? 'old' : levelOf(w.left)}`,
        h('span.lab', w.label), h('div.track', h('i', { style: { width: `${Math.max(1.5, w.left)}%` } })),
        h('span.say', [w.detail || `${Math.round(w.left)}% left`,
          w.lapsed ? 'reset since this reading' : w.resetsAt ? `resets in ${until(w.resetsAt - now)}` : null,
          w.stale ? 'old reading' : null].filter(Boolean).join(' · '))))
        : h('div.dim', m.note || 'No figures yet.'),
      m.windows.length && m.note ? h('div.dim', m.note) : null,
      agents.length ? h('div.who', agents.map((a) => h('span.chip', { title: 'Go to their desk', onclick: () => ui.select(a.id) }, a.name))) : null,
      h('div.from', `from ${m.sourceName} · ${age(now - m.checkedAt)} ago`));
  }

  function render() {
    const usage = net.state.usage, now = net.now();
    refresh.classList.toggle('hidden', !usage?.sources?.openrouter);
    const meters = (usage?.meters || []).slice().sort((a, b) => (a.left ?? 101) - (b.left ?? 101));
    replace(root,
      usage?.advice?.text ? h('p.advice', usage.advice.text) : null,
      meters.length ? h('div.grid', meters.map((m) => card(m, now)))
        : h('div.empty', 'Nothing has told the office how much is left on any provider yet.'),
      h('h3', 'How the office knows'),
      h('div.how',
        h('div', 'Claude subscriptions: ', h('code', 'node install-statusline.mjs'), ' — Claude Code then passes its five-hour and weekly figures along with its status line.'),
        h('div', 'Codex: nothing to set up. Its session files carry the plan’s limits, and the office reads them while it watches Codex.'),
        h('div', 'OpenRouter: start the office with ', h('code', 'OFFICE_USAGE_OPENROUTER=1'), ' and your key in ', h('code', 'OPENROUTER_API_KEY'), '. The office asks only then, and keeps no copy.'),
        h('div', 'Anything else: ', h('code', 'POST /api/usage/report'), ' with a provider and its windows. Agents read the same picture with ', h('code', 'office usage'), '.')));
  }
  const off = net.on('usage', render);
  const tick = setInterval(render, 30000);
  render();
  return { close() { off(); clearInterval(tick); } };
}
