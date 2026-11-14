// The Office — the passport. Everything anyone has discovered here, and
// oblique hints toward what nobody has found yet. The same list fills the
// trophy case in the foyer. Along the top, without a word: the keycards
// (core/game.mjs) — one outline for each there is, filled in when it has been
// found — and what is in the office's jar.
import { h, ago, replace } from './dom.js';
import { HIDEOUTS } from '/core/game.mjs';

const css = `
#ui .pp { flex: 1 1 auto; min-width: 0; padding: 16px 18px 24px; }
#ui .pp .kit { display: flex; align-items: center; gap: 18px; margin: 0 0 12px; padding: 9px 14px 10px; background: var(--tape); border: 2px solid var(--edge); box-shadow: 3px 3px 0 rgba(0, 0, 0, .3); }
#ui .pp .kit .cards { display: flex; gap: 8px; }
#ui .pp .kit .cards i { width: 20px; height: 28px; border: 2px dashed #5d5548; }
#ui .pp .kit .cards i.got { border: 2px solid #080d0b; background: #f3eedd; box-shadow: inset 0 7px 0 #3f8fd0, inset 0 9px 0 #f3eedd, 2px 2px 0 rgba(0, 0, 0, .4); }
#ui .pp .kit .jar { display: flex; align-items: center; gap: 8px; margin-left: auto; font: 600 20px/1 var(--mono); color: #f4f0e6; }
#ui .pp .kit .jar i { width: 18px; height: 18px; background: #f2c64a; border: 3px solid #b98a1e; box-shadow: inset 0 0 0 3px #f2c64a, inset 0 0 0 6px #7a5a12; }
#ui .pp .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
#ui .pp .stamp { display: flex; gap: 10px; padding: 10px 12px; border: 2px dashed var(--line-2); min-height: 76px; }
#ui .pp .stamp .ic { font-size: 26px; line-height: 1; width: 34px; text-align: center; flex: none; filter: grayscale(1) opacity(.35); }
#ui .pp .stamp.found { border-style: solid; border-color: var(--brass); background: rgba(226, 184, 92, .1); }
#ui .pp .stamp.found .ic { filter: none; }
#ui .pp .stamp b { display: block; font: 600 16px/1.15 var(--display); margin-bottom: 3px; }
#ui .pp .stamp small { color: var(--dim); font-size: 12px; line-height: 1.35; display: block; }
#ui .pp .stamp .by { color: var(--faint); font: 11px/1.3 var(--mono); margin-top: 4px; }
#ui .pp h3 { font: 400 14px/1 var(--display); letter-spacing: .14em; text-transform: uppercase; color: var(--faint); margin: 22px 0 8px; }
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
    const game = w.game, cards = (game?.cards || []).map((id) => HIDEOUTS.find((place) => place.id === id)).filter(Boolean);
    replace(root,
      game ? h('div.kit',
        h('div.cards', HIDEOUTS.map((_, i) => h('i' + (cards[i] ? '.got' : ''), { title: cards[i] ? `found in ${cards[i].name}` : '' }))),
        h('div.jar', h('i'), String(game.coins?.have ?? 0))) : null,
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
