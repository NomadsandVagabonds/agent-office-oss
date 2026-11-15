// The Backrooms — what the camcorder prints over the picture: a blinking REC,
// a tape counter that runs, a date stamp from some other decade — and, under
// the battery, a small picture of each thing of the office's you are carrying
// (a card, a cassette for each tape; nothing until you pick something up). That is
// all. Nothing here tells you where you are or what to press; the one concession
// is a small [E] that appears when there is something in front of you to use.
// Under a finger there are no keys, so there the camcorder has a thumb stick
// and four buttons instead (touch.js), and the [E] is a hand among them.
// Everything lives in one element with class `backrooms` inside #ui, which is
// the one thing the office leaves visible down here.
import { h } from '../ui/dom.js';
import { BATTERY_ENDING } from './battery-ending.js';
import { createThumbs } from './touch.js';

const CSS = `
.backrooms { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 5; color: #f4f1e6;
  font: 700 16px/1.25 "Courier New", ui-monospace, Menlo, Consolas, monospace; user-select: none; -webkit-user-select: none; touch-action: none; }
.backrooms .br-frame { position: absolute; left: var(--px, 0px); top: var(--py, 0px); width: var(--pw, 100%); height: var(--ph, 100%); font-size: calc(var(--ph, 600px) * 0.04); }
.backrooms .br-osd { position: absolute; letter-spacing: .14em; white-space: pre; text-transform: uppercase; opacity: .92; filter: blur(.35px);
  text-shadow: .06em 0 0 rgba(255, 60, 40, .55), -.06em 0 0 rgba(60, 220, 255, .5), 0 0 .5em rgba(255, 255, 255, .35), 0 .08em .1em rgba(0, 0, 0, .8); }
.backrooms .tl { left: 6%; top: 6.5%; } .backrooms .tr { right: 6%; top: 6.5%; text-align: right; }
.backrooms .bl { left: 6%; bottom: 8%; } .backrooms .brr { right: 6%; bottom: 8%; text-align: right; font-size: .8em; }
.backrooms .br-dot { display: inline-block; width: .62em; height: .62em; border-radius: 50%; background: #ff2a1a; margin-right: .4em; box-shadow: 0 0 .5em #ff2a1a; animation: br-blink 1.1s steps(1) infinite; }
.backrooms.is-paused .br-dot, .backrooms.is-paused .br-batt i { animation-play-state: paused; }
.backrooms.is-paused .br-inventory, .backrooms.is-paused .br-leave { visibility: hidden; }
@keyframes br-blink { 0% { opacity: 1; } 55% { opacity: 0; } }
.backrooms .br-batt { display: inline-block; width: 1.5em; height: .7em; border: .1em solid currentColor; vertical-align: -.05em; margin-left: .6em; position: relative; }
.backrooms .br-batt::after { content: ''; position: absolute; right: -.26em; top: .12em; width: .12em; height: .3em; background: currentColor; }
.backrooms .br-batt i { position: absolute; left: .06em; top: .06em; bottom: .06em; width: 28%; background: currentColor; animation: br-blink 1.6s steps(1) infinite; }
.backrooms .br-batt.is-managed i { width:calc(100% - .12em); transform-origin:left; animation:none; }
.backrooms .br-batt.is-managed.is-low i { animation:br-blink 1.6s steps(1) infinite; }
.backrooms .br-battery-warning { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 60;
  display: flex; flex-direction: column; align-items: center; gap: .3em; pointer-events: none;
  color: #f4f1e6; font: 700 clamp(17px, calc(var(--ph, 600px) * .038), 28px)/1 "Courier New", ui-monospace, Menlo, Consolas, monospace;
  text-shadow: .055em 0 rgba(255, 60, 40, .4), -.055em 0 rgba(60, 220, 255, .35), 0 .08em .1em rgba(0, 0, 0, .8); }
.backrooms .br-battery-warning[hidden] { display: none; }
.backrooms .br-battery-glyph { display: block; width: 3.6em; height: 1.7em; overflow: visible;
  filter: drop-shadow(0 2px 1px rgba(0, 0, 0, .7)); animation: br-battery-flash 1s steps(1) infinite; }
.backrooms .br-battery-count { min-width: 2ch; text-align: center; letter-spacing: .08em; font-variant-numeric: tabular-nums; }
.backrooms .br-battery-count[hidden] { display: none; }
@keyframes br-battery-flash { 0%, 100% { opacity: 1; } 55% { opacity: .12; } }
.backrooms.is-paused .br-battery-warning { visibility: hidden; }
.backrooms.is-paused .br-battery-glyph { animation-play-state: paused; }
.backrooms.is-battery-ending .br-battery-glyph { animation: none; }
.backrooms.is-battery-ending .br-frame > :not(.br-battery-warning),
.backrooms.is-battery-ending > :not(.br-frame) { opacity: 0 !important; visibility: hidden;
  transition: opacity .6s linear, visibility 0s .6s; pointer-events: none !important; }
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
@media (prefers-reduced-motion: reduce) { .backrooms .br-dot, .backrooms .br-batt i, .backrooms .br-batt.is-managed.is-low i, .backrooms .br-carry i, .backrooms .br-battery-glyph { animation: none; } }
`;

const pad = (n) => String(n).padStart(2, '0');

/** A stepped camcorder glyph, with one last segment until the tape stops. */
function warningBattery() {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  for (const [name, value] of Object.entries({ class: 'br-battery-glyph', viewBox: '0 0 42 20', 'aria-hidden': 'true', 'shape-rendering': 'crispEdges' })) svg.setAttribute(name, value);
  const outline = document.createElementNS(ns, 'path');
  outline.setAttribute('d', 'M2 0H36V2H38V6H42V14H38V18H36V20H2V18H0V2H2Z M3 3V17H35V3Z');
  outline.setAttribute('fill', 'currentColor'); outline.setAttribute('fill-rule', 'evenodd');
  const fill = document.createElementNS(ns, 'rect');
  for (const [name, value] of Object.entries({ x: 6, y: 6, width: 4, height: 8, fill: 'currentColor' })) fill.setAttribute(name, value);
  svg.append(outline, fill);
  return { svg, fill };
}

export function createHud(level) {
  const root = document.getElementById('ui') || document.body;
  const style = h('style', { id: 'backrooms-css' }, CSS);
  document.head.append(style);
  const mode = h('span', 'PLAY ▶'), dot = h('span.br-dot', { style: { display: 'none' } });
  const counter = h('span', '0:00:00'), stamp = h('div.br-osd.bl'), flags = h('div.br-osd.brr'), held = h('div.br-osd.br-carry');
  const use = h('div.br-use', 'E'), leave = h('div.br-leave', '✕');
  const batteryFill = h('i'), battery = h('span.br-batt', batteryFill);
  const warningGlyph = warningBattery(), warningCount = h('span.br-battery-count', { 'aria-hidden': 'true' });
  const warning = h('div.br-battery-warning', { hidden: true, role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, warningGlyph.svg, warningCount);
  const frame = h('div.br-frame', h('div.br-osd.tl', dot, mode), h('div.br-osd.tr', 'SP  ', counter, battery), held, stamp, flags, use, warning);
  const el = h('div.backrooms', frame, leave);
  root.append(el);

  let st = level.stamp;
  let tape = 0, lastSecond = -1, usable = false, glitch = 0, batterySignature = '', recording = false, paused = false, batteryEnded = false;
  let thumbs = null, picture = null, screen = null;      // what a finger is given to press (touch.js), and what it was last laid out for
  const flagSet = new Set();

  function renderStamp(seconds) {
    const total = st.hour * 3600 + st.minute * 60 + seconds, hh = Math.floor(total / 3600) % 24, mm = Math.floor(total / 60) % 60;
    const scramble = glitch > 0 ? (s) => s.replace(/[0-9]/g, () => '0123456789'[Math.floor(Math.random() * 10)]) : (s) => s;
    stamp.textContent = scramble(`${hh < 12 ? 'AM' : 'PM'} ${(hh % 12) || 12}:${pad(mm)}\n${st.month}. ${pad(st.day)} ${st.year}`);
  }
  renderStamp(0);

  function batteryWarning(seconds) {
    if (batteryEnded) return;
    const show = Number.isFinite(seconds) && seconds > 0 && seconds <= BATTERY_ENDING.warning;
    warning.hidden = !show;
    if (!show) { warning.removeAttribute('aria-label'); warningCount.textContent = ''; return; }
    const left = Math.ceil(seconds), label = `Camera battery low, ${left} ${left === 1 ? 'second' : 'seconds'} remaining`;
    if (warningCount.textContent !== String(left)) warningCount.textContent = String(left);
    if (warning.getAttribute('aria-label') !== label) warning.setAttribute('aria-label', label);
    warningCount.hidden = false; warningGlyph.fill.setAttribute('visibility', 'visible');
  }

  return {
    el, use, leave,
    batteryWarning,
    /** The picture goes first; this empty glyph is the last thing on the tape. */
    batteryEnding({ opacity = 1 } = {}) {
      batteryEnded = true; el.classList.add('is-battery-ending'); warning.hidden = false;
      warningCount.hidden = true; warningGlyph.fill.setAttribute('visibility', 'hidden');
      warning.setAttribute('aria-label', 'Camera battery empty');
      warning.style.opacity = String(Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1);
    },
    /** Sit the overlay on the picture: { x, y, w, h } in CSS pixels; size: the whole screen's { w, h }, for what is drawn beside the picture. */
    layout(p, size) {
      for (const [k, v] of [['--px', p.x], ['--py', p.y], ['--pw', p.w], ['--ph', p.h]]) el.style.setProperty(k, `${v}px`);
      picture = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (size) screen = { w: size.w, h: size.h };
      if (thumbs && screen) thumbs.layout({ ...screen, picture });
    },
    /** Show (or hide) the [E]: there is something here to use. */
    hint(on, label = 'E') { if (!!on !== usable) { usable = !!on; use.classList.toggle('on', usable); thumbs?.set({ usable }); } if (on && use.textContent !== label) use.textContent = label; },
    /** A word in the corner, the way a camcorder notes that its lamp is on. */
    flag(name, on) { if (on) flagSet.add(name); else flagSet.delete(name); flags.textContent = [...flagSet].join('  '); },
    /** The existing camcorder glyph is also the run's remaining battery. */
    battery(snapshot) {
      if (!snapshot) {
        batteryWarning(null);
        if (!batterySignature) return;
        batterySignature = ''; battery.classList.remove('is-managed', 'is-low'); batteryFill.style.transform = '';
        for (const name of ['role', 'aria-label', 'title']) battery.removeAttribute(name);
        return;
      }
      if (snapshot.remaining > BATTERY_ENDING.warning) batteryWarning(null);
      const fraction = Math.max(0, Math.min(1, snapshot.fraction ?? snapshot.remaining / snapshot.capacity));
      const percentage = Math.round(fraction * 100), seconds = Math.max(0, Math.ceil(snapshot.remaining));
      const low = fraction <= .25, signature = `${percentage}:${seconds}:${low}`;
      if (signature === batterySignature) return;
      batterySignature = signature; battery.classList.add('is-managed'); battery.classList.toggle('is-low', low);
      batteryFill.style.transform = `scaleX(${percentage / 100})`;
      const label = `Camera battery ${percentage}%, ${Math.floor(seconds / 60)}:${pad(seconds % 60)} remaining`;
      battery.setAttribute('role', 'img'); battery.setAttribute('aria-label', label); battery.title = label;
    },
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
    /** A finger is what is being used (or a mouse is, again): the thumb stick and its buttons come and go with it. */
    setTouch(on) {
      el.classList.toggle('touch', !!on);
      if (on && !thumbs) { thumbs = createThumbs(el); thumbs.set({ usable }); if (screen && picture) thumbs.layout({ ...screen, picture }); }
    },
    /** What a finger has to press, once a finger has been used: touch.js (null before that). */
    get thumbs() { return thumbs; },
    /** Where the top of the picture goes on this screen, px, or null for the middle (a phone held upright has it at the top: the thumbs are below). */
    pictureTop(size) { return thumbs && el.classList.contains('touch') ? thumbs.pictureTop(size) : null; },
    /** Numbers on the stamp lose their place for a moment. */
    glitch(seconds = 0.6) { glitch = Math.max(glitch, seconds); },
    recording() { recording = true; if (!paused) { mode.textContent = 'REC'; dot.style.display = ''; } },
    setPaused(on) { paused = !!on; el.classList.toggle('is-paused', paused); mode.textContent = paused ? 'PAUSE Ⅱ' : recording ? 'REC' : 'PLAY ▶'; dot.style.display = recording && !paused ? '' : 'none'; },
    update(dt) {
      tape += dt;
      if (glitch > 0) { glitch -= dt; renderStamp(Math.floor(tape)); }
      const sec = Math.floor(tape);
      if (sec !== lastSecond) { lastSecond = sec; counter.textContent = `${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`; renderStamp(sec); }
    },
    remove() { thumbs?.remove(); el.remove(); style.remove(); },
  };
}
