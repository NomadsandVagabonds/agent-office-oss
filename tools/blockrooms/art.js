// BlockRooms — the home page's pictures. A page from 1998 is mostly small
// pictures that move, and this one's are all its own: drawn here, a character
// a pixel, and set moving by the page (nothing is fetched, and nothing was
// taken from anybody else's page).
//
//   <i data-sprite="battery" data-fx="spin" data-scale="4"></i>
//
// mount() turns each of those into a small canvas. `fx` is how it moves:
//   spin    turns about its upright, the way everything on a home page did
//   bob     up and down          sway   leans one way, then the other
//   pulse   bigger, smaller      blink  there, not there
//   shake   as if it were ringing
//   turn    round and round, in steps
// A sprite with more than one frame steps through them as well. Whoever has
// asked their machine for less movement gets the first frame, standing still.

const PAL = {
  k: '#111111', K: '#33363c', g: '#777b80', G: '#b8bcc0', w: '#ffffff',
  y: '#ffd83a', Y: '#b99a2a', l: '#fff6c4', o: '#ff8a1f', r: '#e0241b', R: '#8a1410',
  b: '#2a52be', B: '#14245e', c: '#4fd6e8', v: '#8a5ad6', p: '#f4a8c0', P: '#c04a80',
  n: '#7a4a2a', N: '#4a2a14', t: '#d9b98a', T: '#a57d4c', s: '#f1c9a0',
  e: '#5fae4a', E: '#2a6b2a', m: '#c9c4a6',
};

/** name → { fps?, frames: [[rows…], …] }. '.' is nothing. */
export const SPRITES = {
  battery: { frames: [[
    '...kkk...', '..kGGGk..', '.kkkkkkk.', '.kyyyyyk.', '.kyykyyk.', '.kykkkyk.', '.kyykyyk.', '.kyyyyyk.',
    '.kkkkkkk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kkkkkkk.',
  ]] },
  camcorder: { fps: 1.6, frames: ['r', 'K'].map((lamp) => [
    '..........kkkk..', '.........kGGGGk.', 'kkk..kkkkkkkkkkk', 'kcckkGGGGGGGGGGk', 'kcwckGggggggggGk', `kcwckGgkkkkg${lamp}gGk`,
    'kcckkGgkkkkgggGk', 'kkk..kGggggggGGk', '.....kGGGGGGGGGk', '.....kkkkkkkkkkk',
  ]) },
  tape: { fps: 3, frames: ['w', 'K'].map((hub) => [
    'kkkkkkkkkkkkkkkk', 'kKKKKKKKKKKKKKKk', 'kKwwwwwwwwwwwwKk', 'kKwkkkwwwwkkkwKk', `kKwk${hub}kwwwwk${hub}kwKk`, 'kKwkkkwwwwkkkwKk',
    'kKwwwwwwwwwwwwKk', 'kKKKKKKKKKKKKKKk', 'kKKkkkkkkkkkkKKk', 'kkkkkkkkkkkkkkkk',
  ]) },
  keycard: { frames: [[
    'kkkkkkkkkkkkkk', 'kbbbbbbbbbbbbk', 'kbbbbbbbbbbbbk', 'kwwwwwwwwwwwwk', 'kwkkwwGGGGGGwk', 'kwkkwwwwwwwwwk', 'kwkkwwGGGGwwwk', 'kwwwwwwwwwwwwk', 'kkkkkkkkkkkkkk',
  ]] },
  heart: { frames: [['.rr...rr.', 'rprr.rrrr', 'rprrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....']] },
  pirate: { fps: 0.7, frames: ['w', 'k'].map((eye) => [
    '....kkkkkk....', '...kkkkkkkk...', '..kkkwkwkkkk..', '.kkkkwwwkkkkk.', 'kkkkkkkkkkkkkk', '..eeeeeeeeee..', `e.eekkkeee${eye}ee.e`,
    `eeeekkkeee${eye}keee`, '.eeeeeeeeeeee.', '..eeeEEeeeee..', '..eewwwwwwee..', '..eekwkwkwee..', '...eeeeeeee...', '....eeeeee....',
  ]) },
  standee: { frames: [[
    '...TTTT...', '..TttttT..', '..TttttT..', '..TttttT..', '...TttT...', '.TTTttTTT.', 'TttttttttT', 'TtTttttTtT', 'TtTttttTtT', 'TtTttttTtT',
    '.T.TttT.T.', '...TttT...', '...TttT...', '...TtTtT..', '...Tt.TtT.', '...Tt..Tt.', '..TTt..TtT', '..TTT..TTT',
  ]] },
  cooler: { fps: 1.2, frames: [['.kcwcccK.', '.kccccwK.', '.kcccccK.', '.kcwcccK.'], ['.kcccccK.', '.kcwcccK.', '.kccccwK.', '.kcccccK.']].map((water) => [
    '..kkkkk..', '.kcccccK.', ...water, '..kkkkk..', '.kGGGGGk.', '.kGwGrGk.', '.kGGGGGk.', '.kGGGGGk.', '.kGGGGGk.', '.kGGGGGk.', '.kkkkkkk.', '.k.....k.',
  ]) },
  torch: { frames: [['kkkkkkkkkkk.....', 'kyyyyyyyyKKkk...', 'kyyyyyyyyKKGGk..', 'kyyyyyyyyKKlGk..', 'kyyyyyyyyKKkk...', 'kkkkkkkkkkk.....']] },
  moth: { fps: 7, frames: [[
    '.nn.......nn.', 'nttn..k..nttn', 'nttttnknttttn', '.nttttkttttn.', '..nnttkttnn..', '..nttnkntn...', '..ntn.k.ntn..', '..nn..k..nn..',
  ], [
    '...n..k..n...', '..ntn.k.ntn..', '..nttnknttn..', '..nttnknttn..', '...ntnkntn...', '...ntnkntn...', '....n.k.n....', '......k......',
  ]] },
  digger: { fps: 2, frames: [0, 2].map((lift) => {
    const body = ['....yyyy......', '...yyyyyy.....', '...ssssss.....', '...skssks.....', '...ssssss.....', '....bbbb......', '...bbbbbb.....', '..sbbbbbbs....',
      '..s.bbbb.s....', '..s.bbbb..s...', '....b..b......', '....b..b......', '....b..b......', '...kk..kk.....'];
    const spade = ['g', 'g', 'g', 'g', 'g', 'g', 'g', 'ggg', 'ggg'];
    return body.map((row, y) => { const part = spade[y - (5 - lift)]; return part ? row.slice(0, 11) + (part.length === 3 ? part : `.${part}.`) : row; });
  }) },
  cone: { frames: [[
    '....yy....', '....yy....', '...yyyy...', '...ykky...', '..yykkyy..', '..yykkyy..', '.yyykkyyy.', '.yyyyyyyy.', '.yyykkyyy.', 'yyyyyyyyyy', 'yy......yy', 'yy......yy',
  ]] },
  plant: { frames: [[
    '..e..e..e..', '.eEe.e.eEe.', '..eEeeeEe..', 'e..eEEEe..e', '.ee.eEe.ee.', '..eeeEeee..', '....eEe....', '....nnn....', '....nnn....', '...ooooo...', '...ooooo...', '....ooo....',
  ]] },
  cog: { frames: [[
    '.....kkk.....', '..kk.kGk.kk..', '.kGGkkGkkGGk.', '.kGGGGGGGGGk.', '..kGGkkkGGk..', 'kkkGk...kGkkk', 'kGGGk...kGGGk', 'kkkGk...kGkkk',
    '..kGGkkkGGk..', '.kGGGGGGGGGk.', '.kGGkkGkkGGk.', '..kk.kGk.kk..', '.....kkk.....',
  ]] },
  gpu: { fps: 9, frames: [['kGkGk', 'kkGkk', 'kGkGk'], ['kkGkk', 'kGGGk', 'kkGkk']].map((fan) => [
    'kkkkkkkkkkkkkkkkkk', 'kEEEEEEEEEEEEEEEEk', 'kEkkkkkEEEkkkkkEEk', `kE${fan[0]}EEE${fan[0]}Eyk`, `kE${fan[1]}EEE${fan[1]}Eyk`, `kE${fan[2]}EEE${fan[2]}Eyk`,
    'kEkkkkkEEEkkkkkEEk', 'kEEEEEEEEEEEEEEEEk', 'kkyykyykyykyykkkkk',
  ]) },
  balloon: { frames: [[
    '..rrrr..', '.rrrrrr.', 'rrpprrrr', 'rrprrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '...R....', '...k....', '....k...', '...k....', '..k.....', '...k....',
  ]] },
  phone: { frames: [['.kkkkkkkkkkk.', 'kKKKKKKKKKKKk', 'kKk.......kKk', '.kk.kkkkk.kk.', '...kGGGGGk...', '..kGkGkGkGk..', '..kGGGGGGGk..', '..kGkGkGkGk..', '..kkkkkkkkk..']] },
  envelope: { frames: [[
    'kkkkkkkkkkkkk', 'kwkwwwwwwwkwk', 'kwwkwwwwwkwwk', 'kwwwkwwwkwwwk', 'kwwwwkwkwwwwk', 'kwwwwwkwwwwwk', 'kwwwwwwwwwwwk', 'kwwwwwwwwwwwk', 'kkkkkkkkkkkkk',
  ]] },
  arrow: { frames: [['..rrr..', '..rrr..', '..rrr..', '..rrr..', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']] },
  floppy: { frames: [[
    'kkkkkkkkkkk.', 'kbbGGGGGkbbk', 'kbbGGGkGkbbk', 'kbbGGGkGkbbk', 'kbbGGGGGkbbk', 'kbbbbbbbbbbk', 'kbwwwwwwwwbk', 'kbwkkkkkkwbk', 'kbwwwwwwwwbk', 'kbwkkkkwwwbk', 'kbwwwwwwwwbk', 'kkkkkkkkkkkk',
  ]] },
  chalk: { frames: [['.........kkk', '.......kkwwk', '.....kkwwwGk', '...kkwwwGkk.', '.kkwwwGkk...', 'kwwwGkk.....', 'kGGkk.......', 'kkk.........']] },
  shoe: { frames: [['....nnnn....', '...nNNNNn...', '...nNNNNn...', '..nnNNNNnn..', 'nnnNNNNNNNnn', 'nNNNNNNNNNNn', 'kkkkkkkkkkkk']] },
  tube: { fps: 5, frames: ['l', 'l', 'l', 'Y', 'l', 'm'].map((c) => ['kkkkkkkkkkkkkkkkkk', `k${c.repeat(16)}k`, `k${c.repeat(16)}k`, 'kkkkkkkkkkkkkkkkkk']) },
  door: { frames: [['kkkkkkkkkk', 'kNNNNNNNNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnynNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kkkkkkkkkk']] },
  snack: { frames: [['kkkkkkkkkkkk', 'koooooooooyk', 'koowwowwooyk', 'kooowwwoooyk', 'koowwowwooyk', 'koooooooooyk', 'kkkkkkkkkkkk']] },
  star: { frames: [['....y....', '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '.yyy.yyy.', '.yy...yy.', 'y.......y']] },
};

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Draw one frame of a sprite into a 2D context at (0, 0), one unit a pixel. */
export function paint(g, name, frame = 0) {
  const s = SPRITES[name]; if (!s) return { w: 0, h: 0 };
  const rows = s.frames[frame % s.frames.length];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const c = PAL[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
  return sizeOf(name);
}
export function sizeOf(name) {
  const s = SPRITES[name]; if (!s) return { w: 0, h: 0 };
  return { w: Math.max(...s.frames.flatMap((f) => f.map((r) => r.length))), h: Math.max(...s.frames.map((f) => f.length)) };
}

const live = new Set();
let ticking = false, seen = null;

function draw(it, t) {
  const { g, name, fx, w, h, pad } = it, s = SPRITES[name], frames = s.frames.length;
  const frame = frames > 1 ? Math.floor(t * (s.fps || 2) + it.phase * frames) % frames : 0;
  const k = t * it.speed + it.phase * 6.283;
  const key = fx === 'spin' ? Math.round(Math.cos(k * 2.2) * 8) : fx === 'blink' ? Math.floor(k * 1.3) % 2 : fx === 'pulse' ? Math.round(Math.sin(k * 3) * 3) : fx === 'bob' ? Math.round(Math.sin(k * 2.4) * pad)
    : fx === 'sway' ? Math.round(Math.sin(k * 2) * 6) : fx === 'shake' ? Math.floor(k * 9) % 4 : fx === 'turn' ? Math.floor(k * 2.5) % 16 : 0;
  if (frame === it.frame && key === it.key) return;
  it.frame = frame; it.key = key;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w + pad * 2, h + pad * 2);
  g.translate(pad + w / 2, pad + h / 2);
  if (fx === 'spin') g.scale(key / 8 || 0.06, 1);
  else if (fx === 'pulse') g.scale(1 + key * 0.04, 1 + key * 0.04);
  else if (fx === 'bob') g.translate(0, key);
  else if (fx === 'sway') g.rotate(key * 0.03);
  else if (fx === 'shake') g.translate([0, 1, 0, -1][key], [0, -1, 0, 0][key]);
  else if (fx === 'turn') g.rotate((key / 16) * 6.283);
  else if (fx === 'blink' && key) g.globalAlpha = 0;
  g.translate(-w / 2, -h / 2);
  paint(g, name, frame);
  g.globalAlpha = 1;
}

function tick(ms) {
  const t = ms / 1000;
  for (const it of live) if (it.on) draw(it, t);
  if (live.size) requestAnimationFrame(tick); else ticking = false;
}

/**
 * Turn every [data-sprite] under `root` into its picture. Safe to call again after adding more.
 * data-sprite: which · data-fx: how it moves · data-scale: screen pixels to a pixel (default 3) · data-speed: default 1
 */
export function mount(root = document) {
  const quiet = still();
  if (!seen && typeof IntersectionObserver === 'function') seen = new IntersectionObserver((list) => { for (const e of list) if (e.target.__sprite) e.target.__sprite.on = e.isIntersecting; }, { rootMargin: '120px' });
  for (const el of root.querySelectorAll('[data-sprite]:not([data-mounted])')) {
    const name = el.dataset.sprite; if (!SPRITES[name]) continue;
    el.dataset.mounted = '1';
    const { w, h } = sizeOf(name), scale = Number(el.dataset.scale) || 3, fx = el.dataset.fx || '', pad = fx === 'bob' || fx === 'shake' ? 2 : fx === 'sway' || fx === 'turn' || fx === 'pulse' ? 3 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2; canvas.height = h + pad * 2;
    canvas.style.width = `${(w + pad * 2) * scale}px`; canvas.style.height = `${(h + pad * 2) * scale}px`;
    canvas.className = 'sprite'; canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    el.append(canvas);
    const it = { g, name, fx: quiet ? '' : fx, w, h, pad, frame: -1, key: NaN, on: true, speed: Number(el.dataset.speed) || 1, phase: (el.dataset.phase !== undefined ? Number(el.dataset.phase) : Math.random()) };
    draw(it, 0);
    if (quiet || (!fx && SPRITES[name].frames.length < 2)) continue;
    canvas.__sprite = it; live.add(it); seen?.observe(canvas);
  }
  if (live.size && !ticking) { ticking = true; requestAnimationFrame(tick); }
}

/* ---- the name, in blocks ------------------------------------------------------------------------- */

const FONT = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};

/**
 * BLOCK over ROOMS, each pixel of each letter a block with a top and a side. One block of it is never quite where it
 * should be. → stop()
 */
export function drawLogo(canvas, lines = ['BLOCK', 'ROOMS']) {
  const cell = 14, deep = 6, gap = 1, rowGap = 2;
  const cols = Math.max(...lines.map((l) => l.length * 5 + (l.length - 1) * gap)), rows = lines.length * 7 + (lines.length - 1) * rowGap;
  canvas.width = cols * cell + deep + 4; canvas.height = rows * cell + deep + 4;
  const g = canvas.getContext('2d');
  const cells = [];
  lines.forEach((line, li) => [...line].forEach((ch, ci) => (FONT[ch] || []).forEach((row, y) => [...row].forEach((on, x) => { if (on === '#') cells.push({ x: ci * (5 + gap) + x, y: li * (7 + rowGap) + y, line: li }); }))));
  // (drawn from the back: right to left along a row would hide the sides, so top rows first, left to right)
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  const INK = [['#ffd83a', '#fff6a8', '#b99a2a'], ['#f2e7ab', '#fffbe0', '#9c7f24']];
  const odd = cells[Math.floor(cells.length * 0.71)];
  function block(c, dx = 0, dy = 0, alpha = 1) {
    const x = 2 + c.x * cell + dx, y = 2 + deep + c.y * cell + dy, [front, top, side] = INK[c.line % 2];
    g.globalAlpha = alpha;
    g.fillStyle = '#2a1f06'; g.fillRect(x - 1, y - 1, cell + 2, cell + 2);
    g.fillStyle = top; g.beginPath(); g.moveTo(x, y); g.lineTo(x + deep, y - deep); g.lineTo(x + cell + deep, y - deep); g.lineTo(x + cell, y); g.fill();
    g.fillStyle = side; g.beginPath(); g.moveTo(x + cell, y); g.lineTo(x + cell + deep, y - deep); g.lineTo(x + cell + deep, y + cell - deep); g.lineTo(x + cell, y + cell); g.fill();
    g.fillStyle = front; g.fillRect(x, y, cell, cell);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, cell, 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + cell - 2, cell, 2);
    g.globalAlpha = 1;
  }
  function frame(t) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    const k = Math.floor(t * 2) % 9;                                    // (most of the time it is in its place)
    for (const c of cells) if (c !== odd) block(c);
    if (k < 6) block(odd); else if (k === 6) block(odd, 5, -4, 0.75); else if (k === 7) block(odd, -3, 3, 0.5);
  }
  frame(0);
  if (still()) return () => {};
  let on = true;
  const loop = (ms) => { if (!on) return; frame(ms / 1000); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return () => { on = false; };
}

/** A square of dark with the tubes of somebody else's ceiling a long way under it: the background of the top of the page. → a data: address */
export function voidTile(size = 240, seed = 7) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#050507'; g.fillRect(0, 0, size, size);
  let n = seed >>> 0; const rand = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  for (let y = 6; y < size; y += 24) for (let x = 4; x < size; x += 20) {
    if (rand() < 0.42) continue;
    const k = 0.25 + rand() * 0.75, warm = rand();
    g.fillStyle = `rgba(${255}, ${Math.round(226 + warm * 20)}, ${Math.round(150 + warm * 60)}, ${(k * 0.55).toFixed(2)})`;
    g.fillRect(x, y, 8, 3);
    g.fillStyle = `rgba(255, 236, 170, ${(k * 0.12).toFixed(2)})`; g.fillRect(x - 2, y - 2, 12, 7);
  }
  return c.toDataURL('image/png');
}
