// The Office — the passport. Everything anyone has discovered here, and
// oblique hints toward what nobody has found yet. The same list fills the
// trophy case in the foyer.
import { h, ago, replace } from './dom.js';

const css = `
#ui .pp { flex: 1 1 auto; min-width: 0; padding: 16px 18px 24px; }
#ui .pp .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
#ui .pp .stamp { display: flex; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1px dashed var(--line-2); min-height: 74px; }
#ui .pp .stamp .ic { font-size: 26px; line-height: 1; width: 34px; text-align: center; flex: none; filter: grayscale(1) opacity(.35); }
#ui .pp .stamp.found { border-style: solid; border-color: rgba(240, 184, 96, .45); background: rgba(240, 184, 96, .07); }
#ui .pp .stamp.found .ic { filter: none; }
#ui .pp .stamp b { display: block; font-weight: 600; margin-bottom: 2px; }
#ui .pp .stamp small { color: var(--dim); font-size: 12px; line-height: 1.35; display: block; }
#ui .pp .stamp .by { color: var(--faint); font: 11px/1.3 var(--mono); margin-top: 4px; }
#ui .pp h3 { font: 600 10px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); margin: 22px 0 8px; }
#ui .pp .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
#ui .pp .line { display: flex; gap: 8px; padding: 3px 0; font-size: 12.5px; } #ui .pp .line span:first-child { flex: 1 1 auto; min-width: 0; }
`;
const STAT = { tools: 'tool calls', tasksDone: 'tasks finished', coffees: 'coffees poured', snacks: 'snacks vended', waters: 'cups of water', prints: 'pages printed', bells: 'bell rings',
  pets: 'cat pets', planes: 'paper planes', watered: 'times the tree was watered', visits: 'visits' };

export function open({ office, content, header }) {
  if (!document.getElementById('pp-css')) document.head.append(h('style', { id: 'pp-css' }, css));
  const net = office.net;
  const root = h('div.pp.scroll');
  const count = h('span.dim', { style: { marginLeft: '8px' } });
  header.append(count);
  content.append(root);

  function render() {
    const w = net.state.world;
    if (!w) { replace(root, h('div.empty', 'Waiting for the office…')); return; }
    const secrets = w.secrets || [];
    const found = secrets.filter((s) => s.found);
    count.textContent = `${found.length} of ${secrets.length} found`;
    const stats = Object.entries(w.stats || {}).filter(([, v]) => v > 0);
    replace(root,
      h('div.grid', secrets.map((s) => (s.found
        ? h('div.stamp.found', h('div.ic', s.icon || '★'), h('div', h('b', s.name), h('small', s.blurb), h('div.by', `${s.by || 'someone'} · ${ago(s.at, net.now())} ago`.replace('just now ago', 'just now'))))
        : h('div.stamp', h('div.ic', '❔'), h('div', h('b.dim', '???'), h('small', s.hint)))))),
      h('div.cols',
        stats.length ? h('div', h('h3', 'This office, so far'), stats.map(([k, v]) => h('div.line', h('span.dim', STAT[k] || k), h('span.mono', String(v))))) : null,
        (w.arcade || []).length ? h('div', h('h3', 'Bug Squash — high scores'), w.arcade.map((r, i) => h('div.line', h('span', `${i + 1}. ${r.name}`), h('span.mono', String(r.score))))) : null,
        (w.guestbook || []).length ? h('div', h('h3', 'Guestbook'), w.guestbook.slice().reverse().map((g) => h('div.line', h('span', `“${g.text}”`), h('span.faint', g.name)))) : null));
  }

  const off = [net.on('world', render), net.on('discovery', () => setTimeout(render, 300))];
  render();
  return { close: () => off.forEach((f) => f()) };
}
