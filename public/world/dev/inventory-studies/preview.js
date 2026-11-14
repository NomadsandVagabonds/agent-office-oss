// Archived visual comparison. The normal game now uses the camcorder style.
// This page keeps the original base beneath its three study skins.
import { REFERENCE_CSS } from './reference-style.js';
const frame = document.querySelector('iframe'), q = new URLSearchParams(location.search);
const variants = new Set(['office', 'paper', 'viewfinder']), modes = new Set(['inspect', 'craft', 'pockets']);
let theme = variants.has(q.get('theme')) ? q.get('theme') : 'office';
let mode = modes.has(q.get('mode')) ? q.get('mode') : 'inspect';
const descriptions = {
  office: 'An enamel equipment tray, brass keys, label tape, and the Office’s own pixel lettering.',
  paper: 'A found-property file: manila stock, a photocopied specimen, blue ink and stamped controls.',
  viewfinder: 'Everything stays on the tape: camera-menu type, selection brackets, and much more of the room.',
};
let game, inv, doc, observer, paintPending = false;
const frameWindow = () => frame.contentWindow;
function updateToolbar() {
  for (const b of document.querySelectorAll('[data-theme]')) b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  document.getElementById('direction').textContent = descriptions[theme];
  const url = new URL(location.href); url.searchParams.set('theme', theme); url.searchParams.set('mode', mode); history.replaceState(null, '', url);
}
function refreshObjects() {
  if (!inv) return;
  if (!paintPending) {
    paintPending = true;
    frameWindow().requestAnimationFrame(() => {
      paintPending = false;
      game.env.kit.shared.uTorch.value = inv.torchPower() * 1.5;
      game.hud.flag('LIGHT', inv.torchPower() > 0);
      frameWindow().__stage.view?.render(0);
    });
  }
}
function setTheme(value) {
  if (!variants.has(value)) return;
  theme = value; if (inv) inv.view.el.dataset.study = theme; updateToolbar();
}
function setMode(value) {
  if (!modes.has(value)) return;
  mode = value; updateToolbar(); if (!inv) return;
  // Reset only this study's sample supplies, so each direction is comparable.
  inv.close(); inv.model.clear();
  for (const item of [{id:'study-flashlight',type:'torch',charge:54},{id:'study-paper',type:'paper',quantity:10},
    {id:'study-lighter',type:'lighter'},{id:'study-tape',type:'tape'},{id:'study-battery',type:'battery'}]) inv.give(item);
  inv.select(0); inv.view.tick(5);
  if (mode === 'inspect') inv.view.setOpen(true);
  if (mode === 'craft') {
    inv.select(1); inv.view.beginCombine(1); doc.querySelectorAll('.br-inv-slot')[2].click();
    const plus = doc.querySelectorAll('.br-inv-paper-count button')[1]; plus.click(); plus.click();
  }
  inv.update(0, true); refreshObjects();
}
for (const b of document.querySelectorAll('[data-theme]')) b.onclick = () => setTheme(b.dataset.theme);
for (const b of document.querySelectorAll('[data-mode]')) b.onclick = () => setMode(b.dataset.mode);
updateToolbar();
frame.addEventListener('load', async () => {
  const win = frameWindow(); doc = frame.contentDocument;
  try {
    for (let i = 0; i < 300; i++) {
      if (win.__backrooms?.state === 'play') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    game = win.__backrooms; if (game?.state !== 'play') throw Error('Room did not finish loading');
    // Stop the stage clock only in this comparison page. Native UI actions still
    // use the actual inventory controller; the normal dev game is unaffected.
    win.__stage.stop(); inv = game.inventory;
    doc.querySelector('style[id^="backrooms-inventory-css-"]').textContent = REFERENCE_CSS;
    win.addEventListener('resize', () => {
      win.__stage.resize(); win.__stage.view?.render(0);
    });
    const style = doc.createElement('style');
    style.textContent = `@font-face{font-family:'Pixelify Sans';src:url('/vendor/fonts/pixelify-sans-400.woff2')}@font-face{font-family:'Pixelify Sans';src:url('/vendor/fonts/pixelify-sans-600.woff2');font-weight:600}@font-face{font-family:'IBM Plex Sans';src:url('/vendor/fonts/ibm-plex-sans-400.woff2')}@font-face{font-family:'IBM Plex Sans';src:url('/vendor/fonts/ibm-plex-sans-600.woff2');font-weight:600}@font-face{font-family:'IBM Plex Mono';src:url('/vendor/fonts/ibm-plex-mono-400.woff2')}@font-face{font-family:'IBM Plex Mono';src:url('/vendor/fonts/ibm-plex-mono-600.woff2');font-weight:600} #dev{display:none}.br-inv-icon{object-fit:contain;image-rendering:pixelated}.br-inv-notice{pointer-events:none}@media(max-width:520px){.backrooms:has(.br-inventory[data-study].is-open) .br-osd.bl{visibility:hidden}}`;
    // The historical skins predate the single layered heart. Let their ink
    // colors carry through without painting an opaque heart over its layers.
    style.textContent += `
      .br-inventory[data-study] .br-inv-health .br-inv-heart { width:22px; height:17px; }
      .br-inventory[data-study] .br-inv-health .br-inv-heart .heart-body { fill:none; stroke:currentColor; stroke-width:1; stroke-opacity:.65; }
      .br-inventory[data-study] .br-inv-health.is-low { color:#de746b; }
    `;
    doc.head.append(style);
    await Promise.all([...variants].map(name => new Promise((resolve, reject) => {
      const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = `/world/dev/inventory-studies/${name}.css`;
      link.onload = resolve; link.onerror = reject; doc.head.append(link);
    })));
    // View the same quiet room; the picture remains deliberately unremarkable.
    game.goto(4, .04, 1.44, 0, -.05); game.player.update(0); inv.update(0, true);
    win.__stage.view.render(.016);
    setTheme(theme); setMode(mode); await doc.fonts.ready;
    observer = new win.MutationObserver(refreshObjects);
    observer.observe(inv.view.el, { childList:true, subtree:true });
    document.querySelector('.loading').hidden = true;
    window.__study = { setTheme, setMode, get game(){return game}, get inventory(){return inv}, get theme(){return theme}, get mode(){return mode} };
    document.title = 'Three inventory studies — ready';
  } catch (err) {
    document.querySelector('.loading').textContent = 'Preview could not load. Refresh to try again.'; console.error(err);
  }
});
window.addEventListener('pagehide', () => observer?.disconnect(), {once:true});
