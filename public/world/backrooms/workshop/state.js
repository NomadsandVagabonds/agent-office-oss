// The Backrooms — per-visit workshop state (WeakMap-keyed on `env` so visits never leak state).
// Tracks carried Almond Water (Object 1) and renders a wordless picture-only carton silhouette
// on the camcorder OSD, matching hud.js's exact `.br-osd` aesthetic without touching `.br-carry`.

const VISITS = new WeakMap();

const BADGE_CSS = `
.backrooms .br-workshop-carry { right: 6%; top: calc(6.5% + 2.95em); line-height: 0; letter-spacing: 0;
  filter: blur(.35px) drop-shadow(0 .08em .1em rgba(0, 0, 0, .8)); }
.backrooms .br-almond { display: inline-block; position: relative; width: .58em; height: .88em;
  border: .1em solid currentColor; border-radius: .08em; box-sizing: border-box; animation: br-blink .22s steps(1) 4; }
.backrooms .br-almond::before { content: ''; position: absolute; left: .1em; right: .1em; top: -.22em; height: .14em;
  background: currentColor; border-radius: .05em .05em 0 0; }
.backrooms .br-almond::after { content: ''; position: absolute; left: .08em; right: .08em; top: .22em; height: .24em;
  background: currentColor; opacity: .85; }
@media (prefers-reduced-motion: reduce) { .backrooms .br-almond { animation: none; } }
`;

export function getWorkshop(env) {
  if (VISITS.has(env)) return VISITS.get(env);

  let almond = false;
  let holder = null;

  function syncHud() {
    const frame = env.hud?.el?.querySelector?.('.br-frame');
    const styleEl = typeof document !== 'undefined' ? document.getElementById('backrooms-css') : null;
    if (styleEl && !styleEl.textContent.includes('.br-almond')) styleEl.textContent += BADGE_CSS;
    if (!frame) return;
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'br-osd br-workshop-carry';
      frame.appendChild(holder);
    }
    const icon = holder.querySelector('.br-almond');
    if (almond && !icon) {
      const i = document.createElement('i');
      i.className = 'br-almond';
      holder.appendChild(i);
    } else if (!almond && icon) {
      icon.remove();
    }
  }

  const state = {
    get almond() { return almond; },
    setAlmond(on) {
      almond = !!on;
      syncHud();
    },
    takeAlmond(c, x, z) {
      if (almond) return false;
      almond = true;
      syncHud();
      const w = c.toWorld(x, z);
      c.env.play('clack', w.x, w.z, 4);
      c.env.play('glug', w.x, w.z, 4);
      return true;
    },
    spendAlmond(c, x, z, sound = 'glug') {
      if (!almond) return false;
      almond = false;
      syncHud();
      if (sound && c) {
        const w = c.toWorld(x, z);
        c.env.play(sound, w.x, w.z, 5);
      }
      return true;
    },
  };

  VISITS.set(env, state);
  return state;
}
