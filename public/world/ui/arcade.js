// BUG SQUASH — the cabinet in the Back Room, playable. Thirty seconds, bugs
// crawl across a little green screen, you squash them. Scores go on the same
// board agents post to (POST /api/world/arcade). With sound on: a coin, the
// title, a tune while the clock runs, and a squish for every bug.
import { h } from './dom.js';

const W = 160, H = 120, SECONDS = 30;
const css = `
#ui .arcade { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 14px 14px 12px; text-align: center; border-color: rgba(240, 184, 96, .5); }
#ui .arcade canvas { display: block; width: 480px; max-width: calc(100vw - 60px); aspect-ratio: 4 / 3; image-rendering: pixelated; border-radius: 10px; background: #06140c; cursor: crosshair;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, .8), 0 0 0 6px #2b2430, 0 0 0 8px #4a3f55; }
#ui .arcade h2 { margin: 0 0 10px; font: 600 13px/1 var(--mono); letter-spacing: .3em; color: var(--accent); }
#ui .arcade .foot { margin-top: 10px; font: 12px/1.4 var(--mono); color: var(--dim); display: flex; gap: 10px; align-items: center; justify-content: center; }
`;

// a bug, 7×5, two frames of legs
const BUG = [['.#.#.#.', '#######', '.#####.', '#######', '.#.#.#.'], ['#.#.#.#', '.#####.', '#######', '.#####.', '#.#.#.#']];

export function playBugSquash({ office, ui }) {
  if (!document.getElementById('arcade-css')) document.head.append(h('style', { id: 'arcade-css' }, css));
  if (document.querySelector('#ui .arcade')) return;
  const canvas = h('canvas', { width: W, height: H });
  const g = canvas.getContext('2d');
  const foot = h('div.foot', 'click the bugs · Esc to walk away');
  const box = h('div.arcade.glass', h('h2', 'BUG SQUASH'), canvas, foot);
  ui.root.append(box);

  let bugs = [], splats = [], score = 0, combo = 0, t0 = performance.now(), last = t0, over = false, raf = 0, spawnAt = 0;
  const top = office.net.state.world?.arcade?.[0]?.score || 0;
  const sound = office.sound;
  let tune = null;
  function insertCoin() {
    sound?.play('coin');
    setTimeout(() => { if (box.isConnected && !over) sound?.play('arcade-title'); }, 500);
    tune = sound?.music('arcade-chiptune', { volume: 0.35, fade: 0.3 }) || null;
  }

  function spawn(now) {
    const edge = Math.floor(Math.random() * 4);
    const speed = 16 + Math.random() * 22 + (now - t0) / 1400;
    const b = { x: edge === 0 ? -8 : edge === 1 ? W + 8 : Math.random() * W, y: edge === 2 ? -8 : edge === 3 ? H + 8 : 14 + Math.random() * (H - 20), speed, wob: Math.random() * 6,
      gold: Math.random() < 0.07 };
    const tx = 20 + Math.random() * (W - 40), ty = 22 + Math.random() * (H - 34);
    b.a = Math.atan2(ty - b.y, tx - b.x);
    bugs.push(b);
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const left = Math.max(0, SECONDS - (now - t0) / 1000);
    if (!over && left <= 0) finish();
    if (!over && now > spawnAt) { spawn(now); spawnAt = now + Math.max(170, 620 - (now - t0) / 60); }
    g.fillStyle = '#06140c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0a2012'; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);                 // scanlines
    for (const s of splats) { s.life -= dt; g.fillStyle = `rgba(${s.gold ? '255,215,90' : '120,255,150'},${Math.max(0, s.life)})`; g.fillRect(s.x - 4, s.y - 1, 9, 3); g.fillRect(s.x - 1, s.y - 4, 3, 9); }
    splats = splats.filter((s) => s.life > 0);
    for (const b of bugs) {
      if (!over) { b.wob += dt * 9; b.a += Math.sin(b.wob) * dt * 2.2; b.x += Math.cos(b.a) * b.speed * dt; b.y += Math.sin(b.a) * b.speed * dt; }
      const frame = BUG[Math.floor(b.wob) & 1];
      g.fillStyle = b.gold ? '#ffd75a' : '#6fe08a';
      frame.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(Math.round(b.x) - 3 + i, Math.round(b.y) - 2 + j, 1, 1); });
    }
    bugs = bugs.filter((b) => b.x > -14 && b.x < W + 14 && b.y > -14 && b.y < H + 14);
    g.fillStyle = '#9ff0b8'; g.font = '8px monospace'; g.textBaseline = 'top';
    g.textAlign = 'left'; g.fillText(`SCORE ${String(score).padStart(5, '0')}`, 4, 3);
    g.textAlign = 'right'; g.fillText(`${Math.ceil(left)}s`, W - 4, 3);
    if (top) { g.textAlign = 'center'; g.fillStyle = '#3fa37c'; g.fillText(`HI ${top}`, W / 2, 3); }
    if (over) {
      g.fillStyle = 'rgba(6,20,12,.78)'; g.fillRect(0, 40, W, 40);
      g.fillStyle = '#ffd75a'; g.textAlign = 'center'; g.font = '10px monospace'; g.fillText('TIME', W / 2, 46);
      g.fillStyle = '#9ff0b8'; g.font = '8px monospace'; g.fillText(`${score} points`, W / 2, 62);
    }
    raf = requestAnimationFrame(draw);
  }

  async function finish() {
    over = true;
    tune?.stop(1.2); tune = null;
    const me = office.walk?.me;
    try {
      const r = await office.net.api('/api/world/arcade', { method: 'POST', body: { score, name: me?.name || 'Lead' } });
      foot.textContent = r.top ? `NEW HIGH SCORE — rank #${r.rank}` : `rank #${r.rank} · Enter to play again · Esc to walk away`;
      if (r.top) foot.style.color = 'var(--accent)';
    } catch { foot.textContent = 'The cabinet could not save that one. Enter to play again.'; }
  }

  function hit(e) {
    if (over) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let got = false;
    for (let i = bugs.length - 1; i >= 0; i--) {
      const b = bugs[i];
      if (Math.abs(b.x - x) < 6.5 && Math.abs(b.y - y) < 5.5) {
        bugs.splice(i, 1); splats.push({ x: b.x, y: b.y, life: 0.7, gold: b.gold });
        combo++; score += (b.gold ? 250 : 40) + Math.min(60, combo * 5); got = true;
        sound?.play('squash', { rate: b.gold ? 1.5 : 0.9 + Math.min(combo, 12) * 0.035 });      // a streak climbs
        break;
      }
    }
    if (!got) combo = 0;
  }
  function close() { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); box.remove(); tune?.stop(0.4); tune = null; }
  function key(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && over) { e.stopPropagation(); bugs = []; splats = []; score = 0; combo = 0; over = false; t0 = performance.now(); foot.textContent = 'click the bugs · Esc to walk away'; foot.style.color = ''; insertCoin(); }
    else if (e.key.length === 1 || e.key.startsWith('Arrow')) e.stopPropagation();          // the game has the keyboard
  }
  canvas.addEventListener('pointerdown', hit);
  window.addEventListener('keydown', key, true);
  raf = requestAnimationFrame(draw);
  insertCoin();
  return { close };
}
