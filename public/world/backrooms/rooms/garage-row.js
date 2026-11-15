// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Lock-ups
// ("the room that is all garage doors"). Roller doors down both sides and
// across the end, a number over each that is nearly a number, an oil stain in
// front of every one. They rattle. With the remote they open, each on the
// same wall, or on a picture of a garage with nothing in it. A remote is on
// the floor here, in case nobody has found one.
import { P } from '../bits.js';
import { garble, lawn, roller, daylight } from '../suburb.js';

export function build(c) {
  const { W, D, H, R, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', clouds: false, width: 0.5, neighbour: 0 });
  const tarmac = c.mapped('lock:tarmac', kit.tex.carpet('#58595c'));
  tarmac.grid([-W / 2 + 0.5, 0.012, -D / 2 + 0.5], [0, 0, 1], [1, 0, 0], [0, D - 1], [0, W - 1], (u, v) => [v / 0.8, u / 0.8]);
  const nums = kit.tex.custom('lock:nums:' + p.nums.join(), 32 * 8, 16, (g) => { p.nums.forEach((n, i) => { P(g, '#1d1c1a', i * 32, 0, 32, 16); garble(g, String(n), i * 32, 0, 32, 16, { color: '#e8d9a0', size: 12, mess: 0.45 }, n + i); }); }, { clamp: true }), numB = c.mapped('lock:nums', nums);
  let k = 0;
  for (const side of ['left', 'back', 'right']) for (const [a, b] of c.spans(side, 0.5, 2.4)) for (let at = a + 1.5; at + 1.5 <= b && k < 8; at += 3.1, k++) {
    roller(c, side, at, { garage: p.empty.includes(k) });
    c.hang(numB, side, at, 2.34, 0.5, 0.25, [[k / 8, 0], [(k + 1) / 8, 0], [(k + 1) / 8, 1], [k / 8, 1]], undefined, 0.07);
    const f = c.wallAt(side, at, 1.4); c.blot(f.x, f.z, 1.2, 0.9, { rgb: [0.02, 0.02, 0.02], a: 0.5 });
  }
  c.leave('opener', R.range(-0.5, 0.5), 0.4, { y: 0 });
  void H;
}
