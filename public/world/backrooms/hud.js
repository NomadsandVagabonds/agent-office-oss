// The Backrooms — what the camcorder prints over the picture: a blinking REC,
// a tape counter that runs, a date stamp from some other decade — plus the
// level's own voice (captions), the "press E" hint, and the help line.
// Everything lives in one element with class `backrooms` inside #ui, which is
// the one thing the office leaves visible while you are down here.
import { h } from '../ui/dom.js';

const CSS = `
.backrooms { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; color: #f4f1e6;
  font: 700 16px/1.25 "Courier New", ui-monospace, Menlo, Consolas, monospace; user-select: none; -webkit-user-select: none; }
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
.backrooms .br-caption { position: absolute; left: 50%; bottom: 17%; transform: translateX(-50%); max-width: 78%; padding: .45em .9em; text-align: center;
  font: 500 calc(var(--ph, 600px) * 0.028)/1.45 ui-monospace, Menlo, Consolas, monospace; color: #f7f2df; background: rgba(8, 8, 6, .62); border-radius: .25em;
  opacity: 0; transition: opacity .35s ease; text-shadow: 0 1px 2px #000; }
.backrooms .br-caption.on { opacity: 1; }
.backrooms .br-use { position: absolute; left: 50%; bottom: 29%; transform: translateX(-50%); padding: .3em .8em; white-space: nowrap;
  font: 600 calc(var(--ph, 600px) * 0.026)/1.3 ui-monospace, Menlo, Consolas, monospace; color: #fff7cf; background: rgba(8, 8, 6, .5); border: 1px solid rgba(255, 247, 207, .45); border-radius: .25em;
  opacity: 0; transition: opacity .15s ease; }
.backrooms .br-use.on { opacity: 1; }
.backrooms .br-use b { display: inline-block; min-width: 1.3em; margin-right: .5em; padding: 0 .3em; text-align: center; color: #15140f; background: #fff7cf; border-radius: .2em; }
.backrooms .br-help { position: absolute; left: 50%; top: 15%; transform: translateX(-50%); white-space: pre; text-align: center;
  font: 500 calc(var(--ph, 600px) * 0.022)/1.6 ui-monospace, Menlo, Consolas, monospace; color: #efe9d2; opacity: 0; transition: opacity .8s ease; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
.backrooms .br-help.on { opacity: .9; }
.backrooms .br-big { position: absolute; left: 0; right: 0; top: 42%; text-align: center; font-size: 1.5em; letter-spacing: .3em; opacity: 0; transition: opacity .25s; }
.backrooms .br-big.on { opacity: .95; }
.backrooms .br-leave { position: absolute; right: 12px; top: 10px; pointer-events: auto; cursor: pointer; padding: 4px 10px; border-radius: 6px; font: 500 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
  color: #bdb7a4; background: rgba(20, 20, 16, .55); border: 1px solid rgba(255, 255, 255, .14); opacity: .55; }
.backrooms .br-leave:hover { opacity: 1; color: #fff; }
.backrooms.clean .br-osd, .backrooms.clean .br-big { display: none; }
.backrooms.locked .br-leave { display: none; }
@media (prefers-reduced-motion: reduce) { .backrooms .br-dot, .backrooms .br-batt i { animation: none; } }
`;

const pad = (n) => String(n).padStart(2, '0');

export function createHud(level, opt = {}) {
  const root = document.getElementById('ui') || document.body;
  const style = h('style', { id: 'backrooms-css' }, CSS);
  document.head.append(style);
  const mode = h('span', 'PLAY ▶'), dot = h('span.br-dot', { style: { display: 'none' } });
  const counter = h('span', '0:00:00'), stamp = h('div.br-osd.bl'), flags = h('div.br-osd.brr');
  const caption = h('div.br-caption'), use = h('div.br-use'), help = h('div.br-help'), big = h('div.br-big.br-osd');
  const leave = h('div.br-leave', { onclick: () => opt.onLeave?.() }, 'leave ✕');
  const frame = h('div.br-frame',
    h('div.br-osd.tl', dot, mode), h('div.br-osd.tr', 'SP  ', counter, h('span.br-batt', h('i'))),
    stamp, flags, big, help, use, caption);
  const el = h('div.backrooms', frame, leave);
  root.append(el);

  const st = level.stamp;
  let tape = 0, captionTimer = 0, helpTimer = 0, lastSecond = -1, usingLabel = null, glitch = 0;
  const flagSet = new Set();

  function renderStamp(seconds) {
    const total = st.hour * 3600 + st.minute * 60 + seconds, hh = Math.floor(total / 3600) % 24, mm = Math.floor(total / 60) % 60;
    const scramble = glitch > 0 ? (s) => s.replace(/[0-9]/g, () => '0123456789'[Math.floor(Math.random() * 10)]) : (s) => s;
    stamp.textContent = scramble(`${hh < 12 ? 'AM' : 'PM'} ${(hh % 12) || 12}:${pad(mm)}\n${st.month}. ${pad(st.day)} ${st.year}`);
  }
  renderStamp(0);

  return {
    el,
    /** Sit the overlay on the picture: { x, y, w, h } in CSS pixels. */
    layout(p) { for (const [k, v] of [['--px', p.x], ['--py', p.y], ['--pw', p.w], ['--ph', p.h]]) el.style.setProperty(k, `${v}px`); },
    /** The level speaks. One line at a time; a new one replaces the old. */
    say(text, o = {}) {
      if (!text) { caption.classList.remove('on'); return; }
      caption.textContent = text; caption.classList.add('on');
      captionTimer = o.hold ? Infinity : (o.ms || Math.min(11000, 2600 + text.length * 62)) / 1000;
    },
    /** What E would do right now (or null). */
    hint(label) {
      if (label === usingLabel) return;
      usingLabel = label;
      if (label) use.replaceChildren(h('b', 'E'), label);
      use.classList.toggle('on', !!label);
    },
    help(lines, seconds = 9) { help.replaceChildren(...[].concat(lines).map((l) => h('div', l))); help.classList.add('on'); helpTimer = seconds; },
    /** A word across the middle of the picture, the way a VCR says PAUSE. */
    banner(text) { big.textContent = text || ''; big.classList.toggle('on', !!text); },
    flag(name, on) { if (on) flagSet.add(name); else flagSet.delete(name); flags.textContent = [...flagSet].join('  '); },
    setClean(on) { el.classList.toggle('clean', !!on); },
    setLocked(on) { el.classList.toggle('locked', !!on); },
    /** Numbers on the stamp lose their place for a moment. */
    glitch(seconds = 0.6) { glitch = Math.max(glitch, seconds); },
    recording() { mode.textContent = 'REC'; dot.style.display = ''; },
    update(dt) {
      tape += dt;
      if (glitch > 0) { glitch -= dt; renderStamp(Math.floor(tape)); }
      const sec = Math.floor(tape);
      if (sec !== lastSecond) { lastSecond = sec; counter.textContent = `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`; renderStamp(sec); }
      if (captionTimer !== Infinity && captionTimer > 0) { captionTimer -= dt; if (captionTimer <= 0) caption.classList.remove('on'); }
      if (helpTimer > 0) { helpTimer -= dt; if (helpTimer <= 0) help.classList.remove('on'); }
    },
    remove() { el.remove(); style.remove(); },
  };
}
