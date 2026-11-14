// The Backrooms — what the camcorder prints over the picture: a blinking REC,
// a tape counter that runs, a date stamp from some other decade — and, under
// the battery, a small picture of each thing of the office's you are carrying
// (a card, a cassette for each tape; nothing until you pick something up). That is
// all. Nothing here tells you where you are or what to press; the one concession
// is a small [E] that appears when there is something in front of you to use
// (and, on a touch screen, a faint ✕, because there is no Esc). Everything
// lives in one element with class `backrooms` inside #ui, which is the one
// thing the office leaves visible down here.
import { h } from '../ui/dom.js';

const CSS = `
.backrooms { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; color: #f4f1e6;
  font: 700 16px/1.25 "Courier New", ui-monospace, Menlo, Consolas, monospace; user-select: none; -webkit-user-select: none; touch-action: none; }
.backrooms .br-frame { position: absolute; left: var(--px, 0px); top: var(--py, 0px); width: var(--pw, 100%); height: var(--ph, 100%); font-size: calc(var(--ph, 600px) * 0.04); }
.backrooms .br-osd { position: absolute; letter-spacing: .14em; white-space: pre; text-transform: uppercase; opacity: .92; filter: blur(.35px);
  text-shadow: .06em 0 0 rgba(255, 60, 40, .55), -.06em 0 0 rgba(60, 220, 255, .5), 0 0 .5em rgba(255, 255, 255, .35), 0 .08em .1em rgba(0, 0, 0, .8); }
.backrooms .tl { left: 6%; top: 6.5%; } .backrooms .tr { right: 6%; top: 6.5%; text-align: right; }
.backrooms .bl { left: 6%; bottom: 8%; } .backrooms .brr { right: 6%; bottom: 8%; text-align: right; font-size: .8em; }
.backrooms .br-dot { display: inline-block; width: .62em; height: .62em; border-radius: 50%; background: #ff2a1a; margin-right: .4em; box-shadow: 0 0 .5em #ff2a1a; animation: br-blink 1.1s steps(1) infinite; }
@keyframes br-blink { 0% { opacity: 1; } 55% { opacity: 0; } }
.backrooms .br-batt { display: inline-block; width: 1.5em; height: .7em; border: .1em solid currentColor; vertical-align: -.05em; margin-left: .6em; position: relative; }
.backrooms .br-batt::after { content: ''; position: absolute; right: -.26em; top: .12em; width: .12em; height: .3em; background: currentColor; }
.backrooms .br-batt i { position: absolute; left: .06em; top: .06em; bottom: .06em; width: 28%; background: currentColor; animation: br-blink 1.6s steps(1) infinite; }
.backrooms .br-carry { right: 6%; top: calc(6.5% + 1.75em); line-height: 0; letter-spacing: 0; filter: blur(.35px) drop-shadow(0 .08em .1em rgba(0, 0, 0, .8)); }
.backrooms .br-carry i { display: inline-block; box-sizing: border-box; vertical-align: middle; margin-left: .34em; animation: br-blink .22s steps(1) 4; }
.backrooms .br-tape { width: 1.16em; height: .7em; border: .1em solid currentColor; border-radius: .08em;
  background: radial-gradient(circle at 30% 58%, currentColor .11em, transparent .13em), radial-gradient(circle at 70% 58%, currentColor .11em, transparent .13em), linear-gradient(currentColor, currentColor) 50% 14% / 70% .1em no-repeat; }
.backrooms .br-card { position: relative; width: .64em; height: .92em; border: .1em solid currentColor; border-radius: .1em; }
.backrooms .br-card::before { content: ''; position: absolute; left: 0; right: 0; top: .1em; height: .2em; background: currentColor; }
.backrooms .br-use { position: absolute; left: 50%; bottom: 21%; transform: translateX(-50%); min-width: 1.5em; padding: .12em .4em; text-align: center; pointer-events: auto; cursor: pointer;
  font: 700 calc(var(--ph, 600px) * 0.03)/1.3 ui-monospace, Menlo, Consolas, monospace; color: #15140f; background: #fff7cf; border-radius: .22em; box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), 0 .1em .5em rgba(0, 0, 0, .5);
  opacity: 0; visibility: hidden; transition: opacity .15s ease; }
.backrooms .br-use.on { opacity: .9; visibility: visible; }
.backrooms .br-leave { position: absolute; right: 10px; top: 8px; width: 34px; height: 34px; display: none; place-items: center; pointer-events: auto; font: 400 18px/1 ui-monospace, Menlo, Consolas, monospace; color: #fff; opacity: .28; }
.backrooms.touch .br-leave { display: grid; }
.backrooms.clean .br-osd { display: none; }
@media (prefers-reduced-motion: reduce) { .backrooms .br-dot, .backrooms .br-batt i, .backrooms .br-carry i { animation: none; } }
`;

const pad = (n) => String(n).padStart(2, '0');

export function createHud(level) {
  const root = document.getElementById('ui') || document.body;
  const style = h('style', { id: 'backrooms-css' }, CSS);
  document.head.append(style);
  const mode = h('span', 'PLAY ▶'), dot = h('span.br-dot', { style: { display: 'none' } });
  const counter = h('span', '0:00:00'), stamp = h('div.br-osd.bl'), flags = h('div.br-osd.brr'), held = h('div.br-osd.br-carry');
  const use = h('div.br-use', 'E'), leave = h('div.br-leave', '✕');
  const frame = h('div.br-frame', h('div.br-osd.tl', dot, mode), h('div.br-osd.tr', 'SP  ', counter, h('span.br-batt', h('i'))), held, stamp, flags, use);
  const el = h('div.backrooms', frame, leave);
  root.append(el);

  let st = level.stamp;
  let tape = 0, lastSecond = -1, usable = false, glitch = 0;
  const flagSet = new Set();

  function renderStamp(seconds) {
    const total = st.hour * 3600 + st.minute * 60 + seconds, hh = Math.floor(total / 3600) % 24, mm = Math.floor(total / 60) % 60;
    const scramble = glitch > 0 ? (s) => s.replace(/[0-9]/g, () => '0123456789'[Math.floor(Math.random() * 10)]) : (s) => s;
    stamp.textContent = scramble(`${hh < 12 ? 'AM' : 'PM'} ${(hh % 12) || 12}:${pad(mm)}\n${st.month}. ${pad(st.day)} ${st.year}`);
  }
  renderStamp(0);

  return {
    el, use, leave,
    /** Sit the overlay on the picture: { x, y, w, h } in CSS pixels. */
    layout(p) { for (const [k, v] of [['--px', p.x], ['--py', p.y], ['--pw', p.w], ['--ph', p.h]]) el.style.setProperty(k, `${v}px`); },
    /** Show (or hide) the [E]: there is something here to use. */
    hint(on) { if (!!on !== usable) { usable = !!on; use.classList.toggle('on', usable); } },
    /** A word in the corner, the way a camcorder notes that its lamp is on. */
    flag(name, on) { if (on) flagSet.add(name); else flagSet.delete(name); flags.textContent = [...flagSet].join('  '); },
    /** What you are carrying, under the battery: a card, a cassette for each tape (the office calls them coins). Pictures only; nothing is ever written. */
    carry({ card = false, coins = 0 } = {}) {
      const has = held.querySelector('.br-card');
      if (!card && has) has.remove();
      if (card && !has) held.prepend(h('i.br-card'));
      for (let n = held.querySelectorAll('.br-tape').length; n > coins; n--) held.lastElementChild.remove();
      while (held.children.length < (card ? 1 : 0) + coins) held.append(h('i.br-tape'));
    },
    /** The date in the corner belongs to the floor you are on; it loses its place for a moment when that changes. */
    setStamp(stamp) { if (!stamp) return; st = stamp; glitch = Math.max(glitch, 0.9); lastSecond = -1; },
    setClean(on) { el.classList.toggle('clean', !!on); },
    setTouch(on) { el.classList.toggle('touch', !!on); },
    /** Numbers on the stamp lose their place for a moment. */
    glitch(seconds = 0.6) { glitch = Math.max(glitch, seconds); },
    recording() { mode.textContent = 'REC'; dot.style.display = ''; },
    update(dt) {
      tape += dt;
      if (glitch > 0) { glitch -= dt; renderStamp(Math.floor(tape)); }
      const sec = Math.floor(tape);
      if (sec !== lastSecond) { lastSecond = sec; counter.textContent = `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`; renderStamp(sec); }
    },
    remove() { el.remove(); style.remove(); },
  };
}
