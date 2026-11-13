// The Office — the curtain: the moment of dark between two floors. One
// element over everything, faded in and out by whoever is changing the scene
// (the lift in index.js and ride.js, a level's kit when you leave it), so the
// screen never shows one place's last frame as the next place's first.

let el = null;
function node() {
  if (!el) {
    el = document.createElement('div');
    el.className = 'level-curtain';
    // styled here, not in ui.css: it has to work even when the interface is switched off (?ui=0)
    Object.assign(el.style, { position: 'fixed', inset: '0', background: '#0b0910', opacity: '0', pointerEvents: 'none', zIndex: '30' });
    document.body.append(el);
  }
  return el;
}

function fade(opacity, ms) {
  const n = node();
  n.style.transition = ms > 0 ? `opacity ${ms}ms ease` : 'none';
  n.style.pointerEvents = opacity ? 'auto' : 'none';
  void n.offsetWidth;                       // let the browser see the starting point
  n.style.opacity = String(opacity);
  return new Promise((resolve) => setTimeout(resolve, ms > 0 ? ms + 30 : 0));
}

export const curtain = {
  /** Fade to black; resolves once nothing can be seen. */
  close: (ms = 260) => fade(1, ms),
  /** Fade back in. */
  open: (ms = 340) => fade(0, ms),
  get closed() { return !!el && el.style.opacity === '1'; },
};
