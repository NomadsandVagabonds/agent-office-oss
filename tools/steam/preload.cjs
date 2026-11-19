// The shell's side of the page, in the preload's own world (the page cannot reach Node or Electron through it).
// Two things only, for the spike: a frame-rate counter laid over the window (F3 hides it), and a read-only
// `window.blockroomsShell` saying the page is in the shell, for contract C1 to grow from later.
const { contextBridge, ipcRenderer } = require('electron');
const config = ipcRenderer.sendSync('shell:config') || {};

contextBridge.exposeInMainWorld('blockroomsShell', Object.freeze({ kind: 'steam', spike: true, versions: Object.freeze({ electron: process.versions.electron, chrome: process.versions.chrome }) }));

window.addEventListener('DOMContentLoaded', () => {
  const box = document.createElement('div');
  box.id = 'shell-fps';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;top:6px;right:8px;z-index:2147483647;pointer-events:none;font:12px/1.2 ui-monospace,Menlo,Consolas,monospace;color:#9f9;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:3px';
  box.hidden = config.fps === false;
  document.documentElement.append(box);
  // frames counted over half a second, and the longest single frame in it (a hitch shows there before it shows in the mean)
  let frames = 0, from = performance.now(), last = from, worst = 0;
  const tick = (now) => {
    frames++; worst = Math.max(worst, now - last); last = now;
    if (now - from >= 500) {
      const fps = (frames * 1000) / (now - from);
      box.textContent = `${fps.toFixed(0)} fps · worst ${worst.toFixed(0)} ms`;
      box.dataset.fps = fps.toFixed(1); box.dataset.worst = worst.toFixed(1);
      frames = 0; from = now; worst = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener('keydown', (e) => { if (e.key === 'F3') box.hidden = !box.hidden; }, true);
});
