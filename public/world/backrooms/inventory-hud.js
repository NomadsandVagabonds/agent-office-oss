// Six pockets at the edge of the tape. The scene stays visible while a carried
// object is inspected; only the selected pocket and its possible actions expand.
import { h } from '../ui/dom.js';
import { ITEM_DEFS } from './inventory-state.js';
import { CAMERA_INPUT, FIRE_SECONDS_PER_SHEET, resolveCraftInput, previewCraft } from './crafting.js';

const CSS = `
.backrooms:has(.br-inventory) .br-use { bottom:var(--br-inv-hint-bottom,max(21%,94px)); max-width:calc(100% - 32px); box-sizing:border-box; }
.backrooms:has(.br-inventory) .br-osd.bl, .backrooms:has(.br-inventory) .br-osd.brr { bottom:var(--br-inv-osd-bottom,8%); }
.backrooms:has(.br-inventory.is-open) .br-use { opacity:0; visibility:hidden; pointer-events:none; }
.backrooms:has(.br-inventory.is-open) { touch-action:auto; }
.br-inventory { position:absolute; left:var(--px,0px); top:var(--py,0px); width:var(--pw,100%); height:var(--ph,100%); z-index:8; pointer-events:none; container-type:size;
  color:#eee5cd; font:700 12px/1.4 "Courier New",ui-monospace,monospace; letter-spacing:0; text-transform:none; text-shadow:none; filter:none; }
.br-inventory button { font:inherit; color:inherit; cursor:pointer; border-radius:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.br-inventory button:focus-visible { outline:2px solid #fff0bc; outline-offset:3px; }
.br-inventory button:disabled { cursor:default; opacity:.4; }
.br-inventory [hidden] { display:none!important; }
.br-inv-pack { position:absolute; left:50%; bottom:2.5%; transform:translateX(-50%); width:min(396px,calc(100% - 28px)); pointer-events:auto; }
.br-inv-meta { position:absolute; bottom:calc(100% + 9px); left:4px; right:4px; min-height:17px; display:flex; align-items:center; justify-content:center; gap:12px; }
.br-inv-caption { max-width:100%; white-space:nowrap; font-size:12px; text-align:center; color:#eee5cd;
  text-shadow:1px 2px #171712,-1px -1px #171712,1px -1px #171712,-1px 1px #171712; }
.br-inv-caption:empty { display:none; }
.br-inventory.has-health .br-inv-caption { margin-left:auto; text-align:right; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.br-inv-health { display:flex; gap:3px; flex:none; margin-right:auto; height:15px; }
.br-inv-health[hidden] { display:none; }
.br-inv-heart { display:block; width:18px; height:15px; overflow:visible; }
.br-inv-heart .heart-body { fill:#423e34; stroke:#161610; stroke-width:1.5; stroke-linejoin:miter; }
.br-inv-heart .heart-shine { fill:#625747; }
.br-inv-heart.is-filled .heart-body { fill:#b66b58; }
.br-inv-heart.is-filled .heart-shine { fill:#e3aa86; }
.br-inv-health.is-low .is-filled .heart-body { fill:#d0755d; }
.br-inv-health.is-low .is-filled .heart-shine { fill:#ffe0ae; }
.br-inventory.has-health .br-inv-panel { bottom:calc(2.5% + 111px); max-height:calc(100% - 137px); }
.br-inv-bar { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:4px; padding:5px; background:#1b1a16;
  box-shadow:0 0 0 2px #100f0c,inset 0 2px #8a8066,inset 2px 0 #6a6251,inset -2px 0 #332e25,inset 0 -2px #332e25; }
.br-inv-slot { position:relative; display:grid; place-items:center; min-width:0; aspect-ratio:1; padding:8px 5px 10px; border:2px solid #514b3c; background:#302e27;
  box-shadow:inset 2px 2px #1c1c18,inset -2px -2px #675e4a; }
.br-inv-slot:hover { background:#3c382d; }
.br-inv-slot.is-selected { border-color:#eee0b3; box-shadow:0 0 0 1px #fff0c8,inset 2px 2px #73664b,inset -2px -2px #1b1914; background:#4b4433; z-index:1; }
.br-inv-slot.is-compatible { border-color:#d9be75; background:#484432; }
.br-inv-slot.is-compatible::after { content:'+'; position:absolute; right:3px; top:0; color:#ffe2a1; font-size:15px; }
.br-inv-slot.is-source { border-color:#b3935b; opacity:.65; }
.br-inv-slot.is-muted { opacity:.42; }
.br-inv-number { position:absolute; top:1px; left:4px; color:#b5ab90; font-size:10px; line-height:1.2; text-shadow:1px 1px #151510; }
.br-inv-slot.is-selected .br-inv-number { color:#fff0c5; }
.br-inv-icon { display:block; width:100%; height:auto; max-width:39px; aspect-ratio:1; overflow:visible; }
.br-inv-icon-wrap { width:100%; display:grid; place-items:center; }
.br-inv-count { position:absolute; right:4px; bottom:4px; font-size:10px; line-height:1; color:#f6edcf; text-shadow:1px 1px #161610; }
.br-inv-power { position:absolute; bottom:3px; left:5px; right:5px; height:2px; background:#191b16; }
.br-inv-power i { display:block; height:100%; background:#c3b273; transform-origin:left; }
.br-inv-slot.is-active .br-inv-power i { background:#f8e4a3; }
.br-inv-slot.is-active::before { content:''; position:absolute; right:4px; top:4px; width:4px; height:4px; background:#f8e4a3; box-shadow:0 0 0 1px #5d5335; }
.br-inv-mount { position:absolute; right:4px; bottom:8px; color:#eee0b3; font-size:9px; line-height:1; text-shadow:1px 1px #171712; }
.br-inv-panel { position:absolute; left:50%; bottom:calc(2.5% + 99px); transform:translateX(-50%); width:min(420px,calc(100% - 28px)); box-sizing:border-box; padding:16px;
  background:#26251e; border:2px solid #b1a383; box-shadow:0 0 0 2px #13140f,inset 2px 2px #5d5846,inset -2px -2px #151711; pointer-events:auto; max-height:calc(100% - 125px); overflow:auto; touch-action:pan-y; }
.br-inv-panel[hidden] { display:none; }
.br-inv-panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:13px; padding-bottom:9px; border-bottom:1px solid #544e3d; }
.br-inv-eyebrow { color:#bcb294; font-size:10px; letter-spacing:.16em; }
.br-inv-close { display:grid; place-items:center; width:28px; height:28px; margin:-6px -6px -6px 0; border:0; background:transparent; color:#d8cdb0; font-size:20px!important; line-height:1; }
.br-inv-close:hover { background:#464132; }
.br-inv-detail { display:grid; grid-template-columns:84px minmax(0,1fr); gap:18px; align-items:start; }
.br-inv-specimen { display:grid; place-items:center; width:84px; min-height:90px; background:#1d201a; box-shadow:inset 2px 2px #11140f,inset -2px -2px #494b3b; }
.br-inv-specimen .br-inv-icon { max-width:none; width:70px; height:70px; }
.br-inv-title { margin:0 0 5px; font-size:19px; font-weight:700; line-height:1.1; color:#f3e7c7; }
.br-inv-description { margin:0; color:#c4bda4; font-size:12px; line-height:1.5; font-weight:400; }
.br-inv-condition { min-height:17px; margin:9px 0 0; color:#e8cf91; font-size:11px; }
.br-inv-actions { display:flex; gap:8px; margin-top:17px; }
.br-inv-action { min-height:37px; padding:8px 13px; border:1px solid #8e8267; background:#39382d; box-shadow:inset 1px 1px #605d48,inset -1px -1px #171b14; }
.br-inv-action:hover:enabled { background:#4d4836; }
.br-inv-action.primary { flex:1; color:#211f17; border-color:#dfc88d; background:#d2bc82; box-shadow:inset 1px 1px #f4dfa5,inset -1px -1px #8d794d; }
.br-inv-action.primary:hover:enabled { background:#e4cc8c; }
.br-inv-action kbd { font:inherit; font-size:10px; opacity:.65; margin-left:9px; }
.br-inv-action[hidden] { display:none; }
.br-inv-camera-choice { margin-left:auto; padding:2px 6px; background:none; border:1px solid #746b53; color:#e8cf91!important; font-size:10px!important; }
.br-inv-ingredients { display:grid; grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr); gap:8px; align-items:center; }
.br-inv-plus { color:#9d9275; text-align:center; }
.br-inv-ingredient { position:relative; display:flex; align-items:center; gap:9px; height:48px; min-width:0; padding:5px 9px; text-align:left; border:2px solid #514b3c; background:#1d201a; box-shadow:inset 2px 2px #11140f,inset -2px -2px #494b3b; }
.br-inv-ingredient.is-focused { border-color:#eee0b3; }
.br-inv-ingredient .br-inv-icon { width:30px; height:30px; flex:none; }
.br-inv-ingredient-label { min-width:0; font-size:11px; line-height:1.2; }
.br-inv-ingredient-label strong,.br-inv-ingredient-label small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.br-inv-ingredient-label small { margin-top:2px; color:#bcb294; font-size:9px; font-weight:400; }
.br-inv-ingredient-clear { position:absolute; right:3px; top:1px; color:#a99e80; font-size:10px; }
.br-inv-result { display:flex; gap:8px; align-items:center; min-height:32px; margin-top:9px; }
.br-inv-result-copy { flex:1; min-width:0; }
.br-inv-result-title { display:block; margin:0; color:#f3e7c7; font-size:12px; line-height:14px; }
.br-inv-result-description { margin:2px 0 0; color:#bcb294; font-size:10px; line-height:12px; }
.br-inv-result.is-invalid .br-inv-result-title { color:#d8c6a1; font-size:11px; line-height:14px; font-weight:400; }
.br-inv-paper-count { display:flex; align-items:center; gap:3px; flex:none; }
.br-inv-paper-count button { width:27px; height:28px; padding:0; border:1px solid #7b7057; background:#39382d; font-size:15px; }
.br-inv-paper-count output { min-width:18px; text-align:center; color:#eee0b3; font-size:11px; }
.br-inv-craft-heading { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
.br-inventory.is-combining .br-inv-panel-head { margin-bottom:6px; padding-bottom:4px; }
.br-inventory.is-combining .br-inv-actions { margin-top:8px; }
.br-inv-notice { position:absolute; left:50%; bottom:var(--br-inv-notice-bottom,calc(max(21%,94px) + var(--ph,600px) * .0462 + 12px)); transform:translateX(-50%); width:max-content; max-width:calc(100% - 36px); box-sizing:border-box; padding:7px 11px;
  color:#f4e6c3; background:#25251ce8; border:1px solid #7c735a; text-align:center; font-size:12px; opacity:0; transition:opacity .12s ease; }
.br-inv-notice.on { opacity:1; }
.br-inventory.is-open .br-inv-notice { display:none; }
.br-inventory.is-open .br-inv-caption { visibility:hidden; }
@container (max-width:520px) {
  .br-inv-pack { width:min(330px,calc(100% - 24px)); bottom:2%; }
  .br-inv-bar { padding:4px; gap:3px; }
  .br-inv-slot { padding:7px 4px 9px; }
  .br-inv-icon { max-width:32px; }
  .br-inv-panel { bottom:calc(2% + 79px); padding:12px; max-height:calc(100% - 90px); }
  .br-inventory.has-health .br-inv-panel { bottom:calc(2% + 91px); max-height:calc(100% - 102px); }
  .br-inv-detail { grid-template-columns:62px minmax(0,1fr); gap:13px; }
  .br-inv-specimen { width:62px; min-height:72px; }
  .br-inv-specimen .br-inv-icon { width:56px; height:56px; }
  .br-inv-title { font-size:17px; }
  .br-inv-panel-head { margin-bottom:10px; }
  .br-inv-actions { margin-top:12px; }
  .br-inv-action { padding:8px 10px; }
}
@container (max-height:430px) {
  .br-inv-panel { padding:10px 12px; }
  .br-inv-panel-head { margin-bottom:8px; padding-bottom:5px; }
  .br-inv-description { font-size:11px; line-height:1.35; }
  .br-inv-detail { grid-template-columns:62px minmax(0,1fr); gap:12px; }
  .br-inv-specimen { min-height:65px; width:62px; }
  .br-inv-specimen .br-inv-icon { width:56px; height:56px; }
  .br-inv-title { font-size:17px; }
  .br-inv-condition { margin-top:5px; }
  .br-inv-actions { margin-top:9px; }
  .br-inventory.has-health .br-inv-panel { padding-top:8px; padding-bottom:8px; }
  .br-inventory.has-health .br-inv-panel-head { margin-bottom:4px; }
  .br-inventory.has-health .br-inv-condition { margin-top:3px; }
  .br-inventory.has-health .br-inv-actions { margin-top:7px; }
  .br-inventory.is-combining .br-inv-panel-head { margin-bottom:5px; padding-bottom:3px; }
  .br-inventory.is-combining .br-inv-ingredient { height:42px; padding:4px 7px; gap:7px; }
  .br-inventory.is-combining .br-inv-result { min-height:28px; margin-top:6px; }
  .br-inventory.is-combining .br-inv-actions { margin-top:6px; }
  .br-inventory.is-combining .br-inv-action { min-height:30px; padding:5px 11px; font-size:11px; }
}
@media (prefers-reduced-motion:reduce) { .br-inv-notice { transition:none; } }
`;

const NS = 'http://www.w3.org/2000/svg';
let instance = 0;

/** Original stepped silhouettes, with the same worn plastics and brass as the vox props. */
function itemIcon(type, item) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('class', 'br-inv-icon');
  svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
  const rect = (x, y, w, ht, color) => { const n = document.createElementNS(NS, 'rect'); for (const [k, v] of Object.entries({ x, y, width:w, height:ht, fill:color })) n.setAttribute(k, v); svg.append(n); };
  const poly = (points, color) => { const n = document.createElementNS(NS, 'polygon'); n.setAttribute('points', points); n.setAttribute('fill', color); svg.append(n); };
  if (type === 'torch') {
    poly('3,19 17,5 26,14 12,28', '#181c18');
    poly('6,21 17,10 22,15 11,26', '#71745d');
    poly('7,21 9,23 21,11 19,9', '#9c9b79');
    poly('10,24 12,26 23,15 21,13', '#424c3e');
    poly('14,7 20,1 30,11 24,17', '#b8a375');
    poly('17,6 21,2 29,10 25,14', '#ede2b9');
    poly('20,5 22,3 28,9 26,11', '#f9f0d1');
    poly('14,18 16,16 19,19 17,21', '#403e30');
    rect(7,22,2,2,'#c6b98e');
    if (item?.prepared) { poly('9,19 12,16 18,22 15,25', '#9c9e8b'); poly('10,19 12,17 17,22 15,24', '#d1cfb3'); }
  } else if (type === 'battery') {
    for (const x of [5, 17]) {
      rect(x + 2,2,4,3,'#bdc5b4'); rect(x + 2,2,4,1,'#e9e7ce');
      rect(x,5,9,23,'#222d24'); rect(x + 1,6,7,20,'#73815d');
      rect(x + 1,6,2,20,'#98a07b'); rect(x + 7,6,1,20,'#435440');
      rect(x + 1,5,7,3,'#b2bba5');
      rect(x + 4,11,1,7,'#dfdec0'); rect(x + 2,13,5,2,'#dfdec0');
    }
    rect(5,21,21,6,'#b9b493'); rect(5,21,21,1,'#e0d8b5');
    rect(7,23,17,2,'#777f5d'); rect(5,26,21,2,'#8a8d6f');
  } else if (type === 'chalk') {
    poly('5,24 19,5 26,10 12,29', '#686751');
    poly('6,22 18,5 24,9 12,26', '#d9d5b5');
    poly('8,21 20,5 23,7 11,24', '#f2edcf');
    poly('18,5 20,2 26,6 24,9', '#faf2d2');
    poly('6,22 12,26 11,29 5,25', '#b8b895');
    rect(17,25,2,2,'#c8c4a5'); rect(22,22,1,1,'#ddd8b7');
  } else if (type === 'paper') {
    rect(4,8,23,22,'#918d77'); rect(5,7,23,21,'#b8b19a');
    rect(3,5,23,21,'#d8d1b9'); rect(5,3,23,21,'#ece5ce');
    rect(5,3,2,20,'#f6efd9'); rect(7,23,15,1,'#c4bda5');
    poly('22,17 28,17 28,24 22,24', '#b8b19a');
    poly('22,17 24,17 24,19 26,19 26,21 28,21 28,24 22,24', '#d8d1b9');
    poly('22,17 24,17 24,19 26,19 26,21 28,21 22,23', '#f6efd9');
    rect(9,7,1,12,'#e4ddc5');
  } else if (type === 'scissors') {
    poly('6,2 9,3 18,14 16,18 13,14', '#535e58');
    poly('6,2 8,3 17,14 15,15 12,11', '#c9cfbb');
    poly('26,2 23,3 14,14 16,18 19,14', '#929d98');
    poly('26,2 24,3 15,14 17,15 20,11', '#d8dcc8');
    poly('15,14 17,14 12,21 9,21', '#9e4339');
    poly('15,14 17,14 24,21 21,21', '#9e4339');
    for (const x of [3, 20]) {
      rect(x + 2,19,5,2,'#c06850'); rect(x,21,2,6,'#9e4339');
      rect(x + 7,21,2,6,'#9e4339'); rect(x + 2,27,5,2,'#78372f');
      rect(x,22,1,4,'#c06850'); rect(x + 2,26,5,1,'#b45845');
    }
    rect(14,14,4,4,'#535e58'); rect(15,14,2,2,'#c9cfbb');
  } else if (type === 'snack') {
    rect(7,2,18,4,'#875737'); rect(7,26,18,4,'#875737');
    for (const x of [7, 11, 15, 19, 23]) { rect(x,2,1,4,'#d1a06a'); rect(x,26,1,4,'#d1a06a'); }
    rect(5,6,22,20,'#875737'); rect(6,5,20,21,'#b77c49');
    rect(7,7,2,17,'#d1a06a'); rect(24,9,2,15,'#9a643c');
    rect(10,10,12,12,'#dbd0a5'); rect(11,10,10,1,'#f0dfb2');
    rect(12,13,8,2,'#63654a'); rect(14,17,4,3,'#63654a');
    rect(12,24,9,1,'#d1a06a'); rect(10,6,6,1,'#c89560');
  } else if (type === 'lighter') {
    rect(9,10,15,19,'#343d37'); rect(10,11,12,16,'#7d8871'); rect(11,12,3,14,'#a2aa8a');
    rect(9,6,15,6,'#969c8d'); rect(10,5,7,2,'#d0cfb7'); rect(20,4,4,4,'#414b42');
    rect(11,7,2,2,'#4a5348'); rect(15,7,2,2,'#4a5348'); rect(20,8,3,3,'#ae7251');
    rect(10,27,12,2,'#54604e');
  } else if (type === 'tape') {
    poly('8,4 24,4 24,7 28,7 28,23 24,23 24,27 8,27 8,24 4,24 4,8 8,8', '#71786c');
    poly('8,4 24,4 24,7 27,7 27,20 23,20 23,23 8,23 8,20 5,20 5,8 8,8', '#b7b6a1');
    rect(9,7,14,2,'#d9d4bb'); rect(9,10,14,8,'#555c4d'); rect(11,11,10,6,'#222b23');
    rect(9,18,14,2,'#8b927d'); rect(22,21,6,5,'#9b9e8b'); rect(25,25,4,4,'#c5c2a9');
  } else if (type === 'camera') {
    rect(4,9,20,15,'#464d40'); rect(6,7,12,3,'#8b9279'); rect(6,10,15,11,'#81886d');
    rect(24,11,5,11,'#242e28'); rect(27,12,3,9,'#c5cbb2'); rect(7,12,8,6,'#293e36');
    rect(8,13,6,4,'#7faaa0'); rect(18,12,3,3,'#b58861'); rect(7,23,12,3,'#30392f');
  } else if (type === 'balloon') {
    rect(15,22,1,4,'#c6bba1'); rect(14,26,1,3,'#c6bba1'); rect(15,29,1,2,'#c6bba1');
    poly('11,2 21,2 21,4 24,4 24,7 26,7 26,14 24,14 24,18 21,18 21,20 18,20 18,22 14,22 14,20 11,20 11,18 8,18 8,14 6,14 6,7 8,7 8,4 11,4', '#ad423b');
    poly('23,6 24,6 24,8 26,8 26,14 24,14 24,18 21,18 21,20 18,20 18,22 16,22 16,19 20,19 20,16 23,16', '#87362f');
    rect(10,6,3,5,'#d6755e'); rect(11,5,4,2,'#d6755e'); rect(10,7,1,3,'#dfa086');
    rect(14,22,4,2,'#87362f');
  }
  return svg;
}

const percent = item => Math.max(0, Math.min(100, Math.ceil((item.charge || 0) / (ITEM_DEFS.torch.maxCharge || 180) * 100)));
const quantity = item => Math.max(1, Math.min(ITEM_DEFS.paper?.maxStack || 10, Math.floor(item.quantity || 1)));
const remainingTime = seconds => { const whole = Math.max(0, Math.ceil(seconds || 0)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; };
const nameOf = item => item ? ITEM_DEFS[item.type]?.name || item.type : 'Empty pocket';
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };

function heartIcon() {
  const svg = document.createElementNS(NS, 'svg'), body = document.createElementNS(NS, 'polygon'), shine = document.createElementNS(NS, 'rect');
  svg.setAttribute('viewBox', '-1 -1 12 10'); svg.setAttribute('class', 'br-inv-heart');
  svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
  body.setAttribute('class', 'heart-body'); body.setAttribute('points', '1,0 4,0 4,1 6,1 6,0 9,0 9,1 10,1 10,4 9,4 9,5 8,5 8,6 7,6 7,7 6,7 6,8 4,8 4,7 3,7 3,6 2,6 2,5 1,5 1,4 0,4 0,1 1,1');
  for (const [key, value] of Object.entries({ class:'heart-shine', x:2, y:1, width:2, height:1 })) shine.setAttribute(key, value);
  svg.append(body, shine); return svg;
}

export function createInventoryHud({ host, onSelect, onUse, onDrop, onCraft, onOpen } = {}) {
  const id = ++instance;
  const style = h('style', { id:`backrooms-inventory-css-${id}` }, CSS); document.head.append(style);
  const titleId = `br-inventory-title-${id}`, craftTitleId = `br-inventory-craft-${id}`;
  const count = h('span.br-inv-eyebrow', 'POCKETS  0 / 6');
  const close = h('button.br-inv-close', { type:'button', 'aria-label':'Close inventory', title:'Close inventory' }, '×');
  const specimen = h('div.br-inv-specimen');
  const title = h('h2.br-inv-title', { id:titleId });
  const description = h('p.br-inv-description'), condition = h('p.br-inv-condition', { role:'status', 'aria-live':'polite', 'aria-atomic':'true' });
  const useLabel = h('span'), useKey = h('kbd', { 'aria-hidden':'true' }, 'Q');
  const use = h('button.br-inv-action.primary', { type:'button' }, useLabel, useKey);
  const combine = h('button.br-inv-action', { type:'button' }, 'Combine');
  const drop = h('button.br-inv-action', { type:'button' }, 'Drop', h('kbd', { 'aria-hidden':'true' }, 'G'));
  const detail = h('div.br-inv-detail', specimen, h('div', title, description, condition));
  const inspectActions = h('div.br-inv-actions', use, combine, drop);
  const cameraChoice = h('button.br-inv-camera-choice', { type:'button', hidden:true, 'aria-label':'Add the built-in camcorder to the focused ingredient box' }, 'Camcorder +');
  const ingredients = Array.from({ length:2 }, (_, i) => {
    const icon = h('span'), name = h('strong'), sub = h('small'), clear = h('span.br-inv-ingredient-clear', { 'aria-hidden':'true' }, '×');
    const button = h('button.br-inv-ingredient', { type:'button' }, icon, h('span.br-inv-ingredient-label', name, sub), clear);
    button.addEventListener('click', () => { craftRefs[i] = null; focusedIngredient = i; craftError = ''; redraw(); });
    return { button, icon, name, sub, clear, iconKey:null };
  });
  const resultTitle = h('strong.br-inv-result-title'), resultDescription = h('p.br-inv-result-description');
  const fewer = h('button', { type:'button', 'aria-label':'Burn one fewer sheet' }, '−');
  const more = h('button', { type:'button', 'aria-label':'Burn one more sheet' }, '+');
  const paperAmount = h('output', { 'aria-label':'Sheets to burn' }, '1');
  const paperStepper = h('div.br-inv-paper-count', { role:'group', 'aria-label':'Paper sheets', hidden:true }, fewer, paperAmount, more);
  const result = h('div.br-inv-result', h('div.br-inv-result-copy', { role:'status', 'aria-live':'polite', 'aria-atomic':'true' }, resultTitle, resultDescription), paperStepper);
  const cancel = h('button.br-inv-action', { type:'button' }, 'Cancel');
  const craft = h('button.br-inv-action.primary', { type:'button' }, 'Craft');
  const craftView = h('div.br-inv-crafting', { hidden:true }, h('h2.br-inv-craft-heading', { id:craftTitleId }, 'Combine items'),
    h('div.br-inv-ingredients', ingredients[0].button, h('span.br-inv-plus', { 'aria-hidden':'true' }, '+'), ingredients[1].button),
    result, h('div.br-inv-actions', cancel, craft));
  const panel = h('section.br-inv-panel', { hidden:true, 'aria-labelledby':titleId },
    h('div.br-inv-panel-head', count, cameraChoice, close), detail, inspectActions, craftView);
  const caption = h('div.br-inv-caption');
  const hearts = Array.from({ length:4 }, heartIcon);
  const health = h('div.br-inv-health', { hidden:true, role:'img', 'aria-label':'Health 4 of 4' }, ...hearts);
  const bar = h('div.br-inv-bar', { role:'group', 'aria-label':'Six inventory slots' });
  const noticeEl = h('div.br-inv-notice', { role:'status', 'aria-live':'polite', 'aria-atomic':'true' });
  const meta = h('div.br-inv-meta', health, caption), pack = h('div.br-inv-pack', meta, bar);
  const el = h('div.br-inventory', { 'aria-label':'Inventory' }, panel, pack, noticeEl);
  const owner = host || document.body;
  owner.append(el);
  // createInput lets owned events reach native buttons and scrolling. Keep
  // those events inside this UI once their target's handlers have run.
  const stopBubble = event => event.stopPropagation();
  const ownedEvents = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointercancel', 'pointermove',
    'mousedown', 'mouseup', 'mousemove', 'wheel', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
  for (const type of ownedEvents) el.addEventListener(type, stopBubble);
  let snapshot = { slots:Array(6).fill(null), selected:0, activeTorch:null, revision:0 };
  let opened = false, combineFrom = null, craftRefs = [null, null], focusedIngredient = 1, paperCount = 1, craftError = '';
  let noticeLeft = 0, previousFocus = null, disposed = false, detailType = null, signature = '';
  const prompt = owner.querySelector('.br-use'), stamps = [...owner.querySelectorAll('.br-osd.bl,.br-osd.brr')];
  const offsets = ['--br-inv-hint-bottom', '--br-inv-notice-bottom', '--br-inv-osd-bottom'];
  const previousOffsets = offsets.map(name => [name, owner.style.getPropertyValue(name), owner.style.getPropertyPriority(name)]);

  function layoutOverlays() {
    if (disposed) return;
    const frame = el.getBoundingClientRect(), pockets = pack.getBoundingClientRect(), label = meta.getBoundingClientRect();
    if (!frame.height || !pockets.width) return;
    const gap = 12, metaTop = frame.bottom - label.top;
    const stampRects = stamps.map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    // The stamp can stay in its original corner on a broad picture. When
    // that corner crosses the pockets, reserve a separate band above them.
    const needsStampBand = stampRects.some(rect => rect.left < pockets.right + gap && rect.right > pockets.left - gap);
    const stampBottom = needsStampBand ? Math.max(frame.height * .08, metaTop + gap) : frame.height * .08;
    const stampHeight = Math.max(0, ...stampRects.map(rect => rect.height));
    const hintBottom = Math.max(frame.height * .21, metaTop + gap, needsStampBand ? stampBottom + stampHeight + gap : 0);
    const hintHeight = prompt?.getBoundingClientRect().height || frame.height * .0462;
    // E and feedback share a center line, so feedback always sits above E,
    // even while E is hidden or its label wraps. No threshold can cross them.
    for (const [name, pixels] of [[offsets[0], hintBottom], [offsets[1], hintBottom + hintHeight + gap], [offsets[2], stampBottom]]) {
      const value = `${Math.round(pixels * 100) / 100}px`;
      if (owner.style.getPropertyValue(name) !== value) owner.style.setProperty(name, value);
    }
  }
  const overlayObserver = new ResizeObserver(layoutOverlays);
  for (const node of [el, pack, meta, prompt, ...stamps]) if (node) overlayObserver.observe(node);

  const slots = Array.from({ length:6 }, (_, i) => {
    const icon = h('span.br-inv-icon-wrap'), amount = h('span.br-inv-count'), fill = h('i');
    const mount = h('span.br-inv-mount', { hidden:true, 'aria-hidden':'true' }, 'M');
    const power = h('span.br-inv-power', { hidden:true, 'aria-hidden':'true' }, fill);
    const button = h('button.br-inv-slot', { type:'button', 'aria-label':`Slot ${i + 1}: empty`, 'aria-pressed':i === 0 ? 'true':'false', dataset:{ slot:i } },
      h('span.br-inv-number', { 'aria-hidden':'true' }, String(i + 1)), icon, amount, power, mount);
    button.addEventListener('click', () => activateSlot(i)); bar.append(button);
    return { button, icon, amount, power, fill, mount, type:null };
  });
  function activateSlot(i) {
    if (disposed) return;
    if (combineFrom !== null) {
      if (blocked()) return;
      const item = snapshot.slots[i];
      if (item) chooseIngredient({ slot:i, id:item.id });
      return;
    }
    onSelect?.(i); setOpen(true);
  }
  const blocked = () => !!snapshot.health?.dead || !!snapshot.camera?.depleted;
  const canEat = () => !blocked() && !!snapshot.health && snapshot.health.current > 0 && snapshot.health.current < snapshot.health.max;
  const craftIngredient = item => !!item && ['battery', 'torch', 'paper', 'lighter', 'tape'].includes(item.type);
  const refEquals = (a, b) => !!a && !!b && (a.device ? a.device === b.device : a.slot === b.slot && a.id === b.id);
  const iconKey = item => item ? `${item.type}:${!!item.prepared}` : null;
  const isLit = item => !!item && item.charge > 0 && item.id === snapshot.activeTorch
    && (item.id === snapshot.mountedTorch || item.id === snapshot.slots[snapshot.selected]?.id);
  function chooseIngredient(ref) {
    if (blocked() || combineFrom === null) return;
    const other = 1 - focusedIngredient;
    // Moving the same object between boxes swaps the old contents rather than
    // pretending that one carried object supplies both ingredients.
    if (refEquals(craftRefs[other], ref)) craftRefs[other] = craftRefs[focusedIngredient];
    craftRefs[focusedIngredient] = { ...ref }; craftError = '';
    if (!craftRefs[other]) focusedIngredient = other;
    redraw();
    (craftRefs.every(Boolean) && !craft.disabled ? craft : ingredients[focusedIngredient].button).focus();
  }
  function compatible(i) {
    const item = snapshot.slots[i];
    if (blocked() || combineFrom === null || !item) return false;
    const refs = craftRefs.slice(); refs[focusedIngredient] = { slot:i, id:item.id };
    return previewCraft(snapshot, refs, { paperCount }).ok;
  }
  function conditionOf(item) {
    if (item?.type === 'torch') return `${item.id === snapshot.mountedTorch ? 'Mounted · ' : item.prepared ? 'Tape fitted · ' : ''}${percent(item)}% charge · ${isLit(item) ? 'on' : 'off'}`;
    if (item?.type === 'chalk') return `${item.uses} mark${item.uses === 1 ? '' : 's'} left`;
    if (item?.type === 'battery') return 'Fits flashlight or camera';
    if (item?.type === 'paper') return `${quantity(item)} / ${ITEM_DEFS.paper.maxStack} sheets`;
    if (item?.type === 'snack') return snapshot.health && snapshot.health.current >= snapshot.health.max ? 'Health is full' : `Restores ${ITEM_DEFS.snack.healAmount} health`;
    if (item?.type === 'lighter') return 'Reusable';
    if (item?.type === 'tape') return 'Fits a flashlight';
    return '';
  }
  function redrawCraft() {
    for (let i = 0; i < 2; i++) {
      const box = ingredients[i], resolved = craftRefs[i] && resolveCraftInput(snapshot, craftRefs[i]);
      const item = resolved?.ok ? resolved.type === 'camera' ? { type:'camera' } : resolved.item : null;
      const name = item?.type === 'camera' ? 'Camcorder' : item ? nameOf(item) : `Ingredient ${i + 1}`;
      const sub = item?.type === 'camera' ? `${remainingTime(snapshot.camera.remaining)} left`
        : item?.type === 'paper' ? `${quantity(item)} ${quantity(item) === 1 ? 'sheet' : 'sheets'}`
        : item?.type === 'torch' ? `${percent(item)}%${item.id === snapshot.mountedTorch ? ' · mounted' : item.prepared ? ' · taped' : ''}`
        : item ? 'Click to replace' : 'Choose below';
      if (box.iconKey !== iconKey(item)) { box.icon.replaceChildren(...(item ? [itemIcon(item.type, item)] : [])); box.iconKey = iconKey(item); }
      text(box.name, name); text(box.sub, sub); box.clear.hidden = !item;
      box.button.classList.toggle('is-focused', i === focusedIngredient);
      box.button.setAttribute('aria-pressed', String(i === focusedIngredient));
      box.button.setAttribute('aria-label', `Ingredient ${i + 1}: ${name}${item ? `, ${sub}. Clear and choose a replacement` : '. Choose an item below'}`);
      box.button.disabled = blocked();
    }
    let plan = previewCraft(snapshot, craftRefs, { paperCount });
    if (plan.maxPaper && paperCount > plan.maxPaper) { paperCount = plan.maxPaper; plan = previewCraft(snapshot, craftRefs, { paperCount }); }
    paperStepper.hidden = plan.recipe !== 'paper-fire';
    text(paperAmount, String(paperCount)); paperAmount.setAttribute('aria-label', `${paperCount} ${paperCount === 1 ? 'sheet' : 'sheets'} to burn`);
    fewer.disabled = blocked() || paperCount <= 1; more.disabled = blocked() || paperCount >= (plan.maxPaper || 1);
    const error = craftError || (opened && noticeLeft > 0 ? noticeEl.textContent : '');
    const label = error || (plan.ok ? `${plan.label}${plan.recipe === 'paper-fire' ? ` · ${plan.duration}s` : ''}` : plan.description);
    let explanation = '';
    if (!error && plan.ok) {
      explanation = plan.recipe === 'paper-fire' ? `${FIRE_SECONDS_PER_SHEET}s per sheet · lighter kept`
        : plan.recipe === 'camera-battery' ? `+${remainingTime(plan.seconds)} camcorder power`
        : plan.recipe === 'torch-battery' ? 'Flashlight charge restored'
        : plan.recipe === 'tape-torch' ? 'Tape used · flashlight kept'
        : plan.recipe === 'mount-torch' ? 'Camera light · frees your hand' : plan.description;
    }
    text(resultTitle, label); text(resultDescription, explanation); resultDescription.hidden = !explanation;
    result.classList.toggle('is-invalid', !plan.ok || !!error);
    craft.disabled = blocked() || !plan.ok;
    craft.setAttribute('aria-label', plan.ok ? `Craft: ${plan.label}${plan.recipe === 'paper-fire' ? `, ${paperCount} sheets, ${plan.duration} seconds` : ''}` : 'Craft: choose a valid pair');
    cameraChoice.disabled = blocked() || !snapshot.camera;
  }
  function redraw() {
    const selected = snapshot.slots[snapshot.selected];
    const crafting = combineFrom !== null;
    health.hidden = !snapshot.health; el.classList.toggle('has-health', !!snapshot.health);
    el.classList.toggle('is-combining', crafting);
    detail.hidden = inspectActions.hidden = crafting; craftView.hidden = cameraChoice.hidden = !crafting;
    panel.setAttribute('aria-labelledby', crafting ? craftTitleId : titleId);
    if (snapshot.health) {
      const current = Math.max(0, Math.min(4, snapshot.health.current));
      const label = `Health ${current} of ${snapshot.health.max}`;
      if (health.getAttribute('aria-label') !== label) health.setAttribute('aria-label', label);
      health.classList.toggle('is-low', current === 1);
      hearts.forEach((heart, i) => heart.classList.toggle('is-filled', i < current));
    }
    for (let i = 0; i < 6; i++) {
      const item = snapshot.slots[i], slot = slots[i], chosen = i === snapshot.selected, conditionText = conditionOf(item);
      slot.button.classList.toggle('is-selected', chosen);
      slot.button.classList.toggle('is-active', isLit(item));
      slot.button.classList.toggle('is-compatible', compatible(i));
      const supplied = crafting && craftRefs.some(ref => ref?.slot === i && ref.id === item?.id);
      slot.button.classList.toggle('is-source', supplied);
      slot.button.classList.toggle('is-muted', crafting && !supplied && !compatible(i));
      slot.button.setAttribute('aria-pressed', chosen ? 'true':'false');
      slot.button.setAttribute('aria-label', `Slot ${i + 1}: ${nameOf(item)}${conditionText ? ', ' + conditionText : ''}${compatible(i) ? ', compatible ingredient' : ''}`);
      // The visible caption and inspection panel carry this information;
      // native title popups cannot be kept clear of the world-use prompt.
      if (slot.type !== iconKey(item)) { slot.icon.replaceChildren(...(item ? [itemIcon(item.type, item)] : [])); slot.type = iconKey(item); }
      text(slot.amount, item?.type === 'chalk' ? String(item.uses) : item?.type === 'paper' ? String(quantity(item)) : '');
      slot.power.hidden = item?.type !== 'torch';
      slot.mount.hidden = !item || item.id !== snapshot.mountedTorch;
      if (item?.type === 'torch') slot.fill.style.transform = `scaleX(${percent(item) / 100})`;
    }
    text(caption, selected ? `${nameOf(selected)}${selected.type === 'torch' ? ` · ${percent(selected)}%${selected.id === snapshot.mountedTorch ? ' · mounted' : ''}` : selected.type === 'chalk' ? ' · ' + selected.uses : selected.type === 'paper' ? ' · ' + quantity(selected) + (quantity(selected) === 1 ? ' sheet' : ' sheets') : ''}` : '');
    text(count, crafting ? 'COMBINE' : `POCKETS  ${snapshot.slots.filter(Boolean).length} / 6`);
    text(title, nameOf(selected));
    text(description, selected ? ITEM_DEFS[selected.type]?.description || '' : 'Pick up an object to carry it here.');
    text(condition, opened && noticeLeft > 0 ? noticeEl.textContent : conditionOf(selected));
    if (detailType !== iconKey(selected)) { specimen.replaceChildren(...(selected ? [itemIcon(selected.type, selected)] : [])); detailType = iconKey(selected); }
    const label = selected?.type === 'torch' ? snapshot.activeTorch === selected.id ? 'Switch off' : 'Switch on'
      : selected?.type === 'chalk' ? 'Mark floor' : selected?.type === 'snack' ? 'Eat' : 'Use';
    text(useLabel, label); text(useKey, selected?.type === 'torch' ? 'F' : 'Q');
    use.hidden = ['battery', 'paper', 'lighter', 'tape'].includes(selected?.type);
    use.disabled = blocked() || !selected || ['paper', 'scissors', 'balloon', 'lighter', 'tape', 'battery'].includes(selected.type)
      || (selected.type === 'snack' && !canEat()) || (selected.type === 'torch' && selected.charge <= 0);
    combine.hidden = !craftIngredient(selected); combine.disabled = blocked(); combine.classList.toggle('primary', use.hidden);
    drop.disabled = blocked() || !selected;
    if (crafting) redrawCraft();
    if (opened && document.activeElement?.disabled && el.contains(document.activeElement)) {
      const target = document.activeElement === more && !fewer.disabled ? fewer
        : document.activeElement === fewer && !more.disabled ? more
        : crafting ? ingredients[focusedIngredient].button : slots[snapshot.selected].button;
      (target.disabled ? close : target).focus();
    }
  }
  function update(next) {
    if (disposed || !next) return;
    snapshot = next;
    if (combineFrom !== null) for (let i = 0; i < craftRefs.length; i++) {
      if (!craftRefs[i]) continue;
      const resolved = resolveCraftInput(snapshot, craftRefs[i]);
      if (!resolved.ok) { craftRefs[i] = null; focusedIngredient = i; craftError = resolved.description; }
    }
    // Show whole charge percentages and camera seconds; cooldown ticks do not
    // touch the health label. Keep the same buttons so focus never jumps.
    const key = JSON.stringify([snapshot.selected, snapshot.activeTorch, snapshot.mountedTorch, combineFrom, craftRefs, focusedIngredient, paperCount, craftError, opened,
      snapshot.health ? [snapshot.health.current, snapshot.health.max, snapshot.health.dead] : null,
      snapshot.camera ? [Math.ceil(snapshot.camera.remaining), snapshot.camera.capacity, snapshot.camera.depleted, snapshot.camera.remaining >= snapshot.camera.capacity] : null,
      snapshot.slots.map(item => item ? [item.id, item.type, item.prepared, item.type === 'torch' ? percent(item) : item.type === 'paper' ? quantity(item) : item.uses] : null)]);
    if (key !== signature) { signature = key; redraw(); }
  }
  function setOpen(value) {
    value = !!value;
    if (disposed || value === opened) return;
    opened = value; panel.hidden = !opened; el.classList.toggle('is-open', opened);
    if (opened) {
      noticeLeft = 0; noticeEl.classList.remove('on'); text(noticeEl, '');
      previousFocus = document.activeElement;
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      onOpen?.(true); redraw();
      queueMicrotask(() => {
        if (!opened || disposed) return;
        const target = combineFrom !== null ? ingredients[focusedIngredient].button : null;
        (target || (!use.hidden && !use.disabled ? use : !combine.hidden && !combine.disabled ? combine : slots[snapshot.selected].button)).focus();
      });
    } else {
      resetCraft();
      el.removeAttribute('role'); el.removeAttribute('aria-modal');
      onOpen?.(false); redraw();
      if (previousFocus?.isConnected && !el.contains(previousFocus)) previousFocus.focus?.();
      // BODY and other nonfocusable origins cannot take focus back. Do not
      // leave it on a visible hotbar button, where the next Escape is UI-owned.
      if (el.contains(document.activeElement)) document.activeElement?.blur?.();
    }
  }
  function beginCombine(index = snapshot.selected) {
    const item = snapshot.slots[index];
    if (blocked() || !craftIngredient(item)) return false;
    combineFrom = index; craftRefs = [{ slot:index, id:item.id }, null]; focusedIngredient = 1; paperCount = 1; craftError = '';
    noticeLeft = 0; noticeEl.classList.remove('on'); text(noticeEl, '');
    setOpen(true); redraw();
    ingredients[1].button.focus(); return true;
  }
  function resetCraft() { combineFrom = null; craftRefs = [null, null]; focusedIngredient = 1; paperCount = 1; craftError = ''; }
  function cancelCombine() {
    const had = combineFrom !== null; resetCraft(); redraw();
    if (had && opened) (!combine.hidden && !combine.disabled ? combine : close).focus();
    return had;
  }
  close.addEventListener('click', () => setOpen(false));
  use.addEventListener('click', () => { if (!blocked() && !use.disabled) onUse?.(); });
  combine.addEventListener('click', () => beginCombine());
  drop.addEventListener('click', () => onDrop?.());
  cameraChoice.addEventListener('click', () => chooseIngredient(CAMERA_INPUT));
  cancel.addEventListener('click', cancelCombine);
  fewer.addEventListener('click', () => { if (!fewer.disabled) { paperCount--; craftError = ''; redraw(); } });
  more.addEventListener('click', () => { if (!more.disabled) { paperCount++; craftError = ''; redraw(); } });
  craft.addEventListener('click', () => {
    if (combineFrom === null || blocked() || craft.disabled) return;
    const plan = previewCraft(snapshot, craftRefs, { paperCount });
    if (!plan.ok) { craftError = plan.description; redraw(); return; }
    const outcome = onCraft?.(craftRefs.map(ref => ({ ...ref })), { paperCount });
    if (outcome?.ok) cancelCombine();
    else if (outcome?.description) { craftError = outcome.description; redraw(); }
  });
  function handleKey(e) {
    if (disposed || e.ctrlKey || e.metaKey || e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key === 'i') { if (!e.repeat) setOpen(!opened); return true; }
    if (key === 'escape' && opened) { if (!e.repeat && !cancelCombine()) setOpen(false); return true; }
    if (key === 'tab') {
      if (e.repeat) return true;
      if (!opened) setOpen(true);
      else {
        const focusable = [...el.querySelectorAll('button')].filter(b => !b.disabled && !b.closest('[hidden]'));
        const at = focusable.indexOf(document.activeElement), next = (at + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        focusable[next]?.focus();
      }
      return true;
    }
    if (!opened) return false;
    if (/^[1-6]$/.test(key)) { if (!e.repeat) activateSlot(Number(key) - 1); return true; }
    if (key === 'q') {
      if (!e.repeat && combineFrom === null) {
        if (use.hidden && !combine.hidden) beginCombine(); else if (!use.disabled) use.click();
      }
      return true;
    }
    if (key === 'g') { if (!e.repeat && combineFrom === null && !drop.disabled) drop.click(); return true; }
    if ((key === 'arrowleft' || key === 'arrowright') && document.activeElement?.matches('.br-inv-slot')) {
      const index = Number(document.activeElement.dataset.slot), direction = key === 'arrowright' ? 1 : -1;
      slots[(index + direction + 6) % 6].button.focus(); return true;
    }
    return false;
  }
  redraw();
  layoutOverlays();
  return {
    el, update, setOpen, toggle:() => setOpen(!opened), get isOpen() { return opened; },
    beginCombine, cancelCombine, get combining() { return combineFrom; }, handleKey,
    notice(message) { if (disposed) return; text(noticeEl, String(message || '')); noticeLeft = message ? 2.8 : 0; noticeEl.classList.toggle('on', noticeLeft > 0); if (opened) redraw(); },
    tick(dt) { if (noticeLeft > 0 && Number.isFinite(dt) && dt > 0) { noticeLeft = Math.max(0, noticeLeft - dt); if (!noticeLeft) { noticeEl.classList.remove('on'); if (opened) redraw(); } } },
    destroy() {
      if (disposed) return;
      if (opened) onOpen?.(false);
      disposed = true; opened = false; overlayObserver.disconnect(); el.remove(); style.remove();
      for (const type of ownedEvents) el.removeEventListener(type, stopBubble);
      for (const [name, value, priority] of previousOffsets) {
        if (value) owner.style.setProperty(name, value, priority); else owner.style.removeProperty(name);
      }
    },
  };
}
