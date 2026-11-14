// The Office — tiny DOM helpers. No framework: the UI is a few dozen nodes.

/** h('div.card.wide', {onclick, title, dataset:{…}}, child, 'text', [more]) → element */
export function h(spec, props, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, children);
  return el;
}
function add(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function replace(el, ...children) { clear(el); add(el, children); return el; }

export function ago(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
/** "5m ago", or "just now" — for a sentence that says when something happened. */
export function since(ts, now = Date.now()) { const a = ago(ts, now); return a === 'just now' ? a : `${a} ago`; }
export function clock(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
export const shortPath = (p) => String(p || '').replace(/^\/(home|Users)\/[^/]+/, '~');

/* ---- icons: 16×16 pixel glyphs, drawn from strings so they stay crisp ------------ */
const GLYPH = {
  home: '....#####.......|...#######......|..#########.....|.###########....|..#.......#.....|..#..###..#.....|..#..#.#..#.....|..#..#.#..#.....|..#########.....',
  inbox: '.##########.|.#........#.|.#........#.|##...##...##|#.#......#.#|#..######..#|#..........#|############',
  chat: '.##########.|#..........#|#..##.##...#|#..........#|#..####....#|.###.......#|.#.########.|##..........',
  board: '############|#..#...#...#|#..#.#.#.#.#|#..#...#...#|#.##...#.#.#|#..#.#.#...#|#..#...#...#|############',
  book: '.####..####.|#....##....#|#.##.##.##.#|#....##....#|#.##.##.##.#|#....##....#|#.##.##....#|############',
  term: '############|#..........#|#.#........#|#..#.......#|#.#..###...#|#..........#|#..........#|############',
  star: '.....##.....|.....##.....|....####....|############|.##########.|..########..|..###..###..|.##......##.',
  gear: '....##....|.#.####.#.|.########.|###....###|###....###|.########.|.#.####.#.|....##....',
  close: '#......#|.#....#.|..#..#..|...##...|...##...|..#..#..|.#....#.|#......#',
  eye: '...######...|.##......##.|#...####...#|#..######..#|#...####...#|.##......##.|...######...',
  send: '#...........|.###........|..#####.....|...########.|..#####.....|.###........|#...........',
  pin: '....###.....|...#####....|...#####....|...#####....|....###.....|.....#......|.....#......|.....#......',
  search: '..####......|.#....#.....|#......#....|#......#....|.#....#.....|..####.#....|.......##...|........##..',
  plus: '....##....|....##....|....##....|....##....|##########|##########|....##....|....##....|....##....|....##....',
};
const cache = new Map();
export function icon(name, color = 'currentColor') {
  const rows = (GLYPH[name] || GLYPH.star).split('|');
  const w = Math.max(...rows.map((r) => r.length)), hgt = rows.length;
  const key = name;
  if (!cache.has(key)) {
    let d = '';
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') d += `M${x} ${y}h1v1h-1z`; });
    cache.set(key, { d, w, hgt });
  }
  const g = cache.get(key);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${g.w} ${g.hgt}`); svg.setAttribute('class', 'icon'); svg.setAttribute('shape-rendering', 'crispEdges');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', g.d); path.setAttribute('fill', color);
  svg.append(path);
  return svg;
}
