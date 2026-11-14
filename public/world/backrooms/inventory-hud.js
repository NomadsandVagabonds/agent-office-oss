// Six pockets at the edge of the tape. The scene stays visible while a carried
// object is inspected; only the selected pocket and its possible actions expand.
import { h } from '../ui/dom.js';
import { ITEM_DEFS } from './inventory-state.js';

const CSS = `
.backrooms:has(.br-inventory) .br-frame { container:br-inventory-picture / size; }
.backrooms:has(.br-inventory) .br-use { bottom:max(21%,94px); }
@container br-inventory-picture (max-width:600px) {
  .backrooms .br-osd.bl, .backrooms .br-osd.brr { bottom:92px; }
}
.br-inventory { position:absolute; left:var(--px,0px); top:var(--py,0px); width:var(--pw,100%); height:var(--ph,100%); z-index:8; pointer-events:none; container-type:size;
  color:#eee5cd; font:700 12px/1.4 "Courier New",ui-monospace,monospace; letter-spacing:0; text-transform:none; text-shadow:none; filter:none; }
.br-inventory button { font:inherit; color:inherit; cursor:pointer; border-radius:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.br-inventory button:focus-visible { outline:2px solid #fff0bc; outline-offset:3px; }
.br-inventory button:disabled { cursor:default; opacity:.4; }
.br-inv-pack { position:absolute; left:50%; bottom:2.5%; transform:translateX(-50%); width:min(396px,calc(100% - 28px)); pointer-events:auto; }
.br-inv-caption { position:absolute; bottom:calc(100% + 9px); left:50%; transform:translateX(-50%); max-width:100%; white-space:nowrap; font-size:12px; text-align:center; color:#eee5cd;
  text-shadow:1px 2px #171712,-1px -1px #171712,1px -1px #171712,-1px 1px #171712; }
.br-inv-caption:empty { display:none; }
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
.br-inv-combine-note { margin:12px 0 0; color:#e8cf91; font-size:12px; }
.br-inv-combine-note[hidden] { display:none; }
.br-inv-notice { position:absolute; left:50%; bottom:calc(2.5% + 120px); transform:translateX(-50%); width:max-content; max-width:calc(100% - 36px); padding:7px 11px;
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
  .br-inv-detail { grid-template-columns:62px minmax(0,1fr); gap:13px; }
  .br-inv-specimen { width:62px; min-height:72px; }
  .br-inv-specimen .br-inv-icon { width:56px; height:56px; }
  .br-inv-title { font-size:17px; }
  .br-inv-panel-head { margin-bottom:10px; }
  .br-inv-actions { margin-top:12px; }
  .br-inv-action { padding:8px 10px; }
  .br-inv-notice { bottom:calc(2% + 130px); }
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
}
@media (prefers-reduced-motion:reduce) { .br-inv-notice { transition:none; } }
`;

const NS = 'http://www.w3.org/2000/svg';
let instance = 0;

/** Original stepped silhouettes, with the same worn plastics and brass as the vox props. */
function itemIcon(type) {
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
  }
  return svg;
}

const percent = item => Math.max(0, Math.min(100, Math.ceil((item.charge || 0) / (ITEM_DEFS.torch.maxCharge || 180) * 100)));
const nameOf = item => item ? ITEM_DEFS[item.type]?.name || item.type : 'Empty pocket';
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };

export function createInventoryHud({ host, onSelect, onUse, onDrop, onCombine, onOpen } = {}) {
  const id = ++instance;
  const style = h('style', { id:`backrooms-inventory-css-${id}` }, CSS); document.head.append(style);
  const titleId = `br-inventory-title-${id}`;
  const count = h('span.br-inv-eyebrow', 'POCKETS  0 / 6');
  const close = h('button.br-inv-close', { type:'button', 'aria-label':'Close inventory', title:'Close inventory' }, '×');
  const specimen = h('div.br-inv-specimen');
  const title = h('h2.br-inv-title', { id:titleId });
  const description = h('p.br-inv-description'), condition = h('p.br-inv-condition', { role:'status', 'aria-live':'polite', 'aria-atomic':'true' });
  const useLabel = h('span'), dropLabel = h('span', 'Drop');
  const use = h('button.br-inv-action.primary', { type:'button' }, useLabel, h('kbd', { 'aria-hidden':'true' }, 'Q'));
  const drop = h('button.br-inv-action', { type:'button' }, dropLabel, h('kbd', { 'aria-hidden':'true' }, 'G'));
  const combineNote = h('p.br-inv-combine-note', { hidden:true }, 'Choose a flashlight');
  const panel = h('section.br-inv-panel', { hidden:true, 'aria-labelledby':titleId },
    h('div.br-inv-panel-head', count, close),
    h('div.br-inv-detail', specimen, h('div', title, description, condition)),
    h('div.br-inv-actions', use, drop), combineNote);
  const caption = h('div.br-inv-caption');
  const bar = h('div.br-inv-bar', { role:'group', 'aria-label':'Six inventory slots' });
  const noticeEl = h('div.br-inv-notice', { role:'status', 'aria-live':'polite', 'aria-atomic':'true' });
  const el = h('div.br-inventory', { 'aria-label':'Inventory' }, panel, h('div.br-inv-pack', caption, bar), noticeEl);
  (host || document.body).append(el);
  let snapshot = { slots:Array(6).fill(null), selected:0, activeTorch:null, revision:0 };
  let opened = false, combineFrom = null, combineId = null, noticeLeft = 0, previousFocus = null, disposed = false, detailType = null, signature = '';

  const slots = Array.from({ length:6 }, (_, i) => {
    const icon = h('span.br-inv-icon-wrap'), amount = h('span.br-inv-count'), fill = h('i');
    const power = h('span.br-inv-power', { hidden:true, 'aria-hidden':'true' }, fill);
    const button = h('button.br-inv-slot', { type:'button', 'aria-label':`Slot ${i + 1}: empty`, 'aria-pressed':i === 0 ? 'true':'false', dataset:{ slot:i } },
      h('span.br-inv-number', { 'aria-hidden':'true' }, String(i + 1)), icon, amount, power);
    button.addEventListener('click', () => activateSlot(i)); bar.append(button);
    return { button, icon, amount, power, fill, type:null };
  });
  function activateSlot(i) {
    if (disposed) return;
    if (combineFrom !== null) {
      const result = onCombine?.(combineFrom, i);
      if (result?.ok) cancelCombine();
      return;
    }
    onSelect?.(i); setOpen(true);
  }
  function compatible(i) {
    const item = snapshot.slots[i];
    return combineFrom !== null && i !== combineFrom && item?.type === 'torch' && item.charge < (ITEM_DEFS.torch.maxCharge || 180);
  }
  function conditionOf(item) {
    if (item?.type === 'torch') return `${percent(item)}% charge${snapshot.activeTorch === item.id ? ' · on' : ' · off'}`;
    if (item?.type === 'chalk') return `${item.uses} mark${item.uses === 1 ? '' : 's'} left`;
    if (item?.type === 'battery') return 'Restores charge to 100%';
    return '';
  }
  function redraw() {
    const selected = snapshot.slots[snapshot.selected];
    for (let i = 0; i < 6; i++) {
      const item = snapshot.slots[i], slot = slots[i], chosen = i === snapshot.selected;
      slot.button.classList.toggle('is-selected', chosen);
      slot.button.classList.toggle('is-active', !!item && item.id === snapshot.activeTorch);
      slot.button.classList.toggle('is-compatible', compatible(i));
      slot.button.classList.toggle('is-source', i === combineFrom);
      slot.button.classList.toggle('is-muted', combineFrom !== null && i !== combineFrom && !compatible(i));
      slot.button.setAttribute('aria-pressed', chosen ? 'true':'false');
      slot.button.setAttribute('aria-label', `Slot ${i + 1}: ${nameOf(item)}${item ? ', ' + conditionOf(item) : ''}${compatible(i) ? ', fit battery here' : ''}`);
      slot.button.title = `${i + 1} · ${nameOf(item)}${item ? ' · ' + conditionOf(item) : ''}`;
      if (slot.type !== (item?.type || null)) { slot.icon.replaceChildren(...(item ? [itemIcon(item.type)] : [])); slot.type = item?.type || null; }
      text(slot.amount, item?.type === 'chalk' ? String(item.uses) : '');
      slot.power.hidden = item?.type !== 'torch';
      if (item?.type === 'torch') slot.fill.style.transform = `scaleX(${percent(item) / 100})`;
    }
    text(caption, selected ? `${nameOf(selected)}${selected.type === 'torch' ? ' · ' + percent(selected) + '%' : selected.type === 'chalk' ? ' · ' + selected.uses : ''}` : '');
    text(count, `POCKETS  ${snapshot.slots.filter(Boolean).length} / 6`);
    text(title, nameOf(selected));
    text(description, selected ? ITEM_DEFS[selected.type]?.description || '' : 'Pick up an object to carry it here.');
    text(condition, opened && noticeLeft > 0 ? noticeEl.textContent : conditionOf(selected));
    if (detailType !== (selected?.type || null)) { specimen.replaceChildren(...(selected ? [itemIcon(selected.type)] : [])); detailType = selected?.type || null; }
    const label = selected?.type === 'torch' ? snapshot.activeTorch === selected.id ? 'Switch off' : 'Switch on'
      : selected?.type === 'battery' ? 'Fit battery' : selected?.type === 'chalk' ? 'Mark floor' : 'Use';
    text(useLabel, combineFrom !== null ? 'Cancel' : label);
    use.disabled = combineFrom === null && (!selected || (selected.type === 'torch' && selected.charge <= 0));
    drop.disabled = !selected || combineFrom !== null;
    combineNote.hidden = combineFrom === null;
    text(combineNote, combineFrom === null ? '' : snapshot.slots.some((_, i) => compatible(i)) ? 'Choose a flashlight below.' : 'No flashlight needs a battery.');
    if (opened && document.activeElement?.disabled && el.contains(document.activeElement)) slots[snapshot.selected].button.focus();
  }
  function update(next) {
    if (disposed || !next) return;
    snapshot = next;
    if (combineFrom !== null && snapshot.slots[combineFrom]?.id !== combineId) { combineFrom = null; combineId = null; }
    // Charge changes every frame, but screen text and meters only change at
    // whole percentages. Keep the same buttons so keyboard focus never jumps.
    const key = JSON.stringify([snapshot.selected, snapshot.activeTorch, combineFrom, opened,
      snapshot.slots.map(item => item ? [item.id, item.type, item.type === 'torch' ? percent(item) : item.uses] : null)]);
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
        const target = combineFrom !== null ? slots.find((_, i) => compatible(i))?.button : null;
        (target || (!use.disabled ? use : slots[snapshot.selected].button)).focus();
      });
    } else {
      combineFrom = null; combineId = null;
      el.removeAttribute('role'); el.removeAttribute('aria-modal');
      onOpen?.(false); redraw();
      if (previousFocus?.isConnected && !el.contains(previousFocus)) previousFocus.focus?.();
      else document.activeElement?.blur?.();
    }
  }
  function beginCombine(index = snapshot.selected) {
    if (snapshot.slots[index]?.type !== 'battery') return false;
    combineFrom = index; combineId = snapshot.slots[index].id;
    setOpen(true); redraw();
    const target = slots.find((_, i) => compatible(i));
    (target?.button || use).focus(); return true;
  }
  function cancelCombine() { const had = combineFrom !== null; combineFrom = null; combineId = null; redraw(); return had; }
  close.addEventListener('click', () => setOpen(false));
  use.addEventListener('click', () => { if (combineFrom !== null) cancelCombine(); else onUse?.(); });
  drop.addEventListener('click', () => onDrop?.());
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
    if (key === 'q') { if (!e.repeat && !use.disabled) use.click(); return true; }
    if (key === 'g') { if (!e.repeat && !drop.disabled) drop.click(); return true; }
    if ((key === 'arrowleft' || key === 'arrowright') && document.activeElement?.matches('.br-inv-slot')) {
      const index = Number(document.activeElement.dataset.slot), direction = key === 'arrowright' ? 1 : -1;
      slots[(index + direction + 6) % 6].button.focus(); return true;
    }
    return false;
  }
  redraw();
  return {
    el, update, setOpen, toggle:() => setOpen(!opened), get isOpen() { return opened; },
    beginCombine, cancelCombine, get combining() { return combineFrom; }, handleKey,
    notice(message) { if (disposed) return; text(noticeEl, String(message || '')); noticeLeft = message ? 2.8 : 0; noticeEl.classList.toggle('on', noticeLeft > 0); if (opened) redraw(); },
    tick(dt) { if (noticeLeft > 0 && Number.isFinite(dt) && dt > 0) { noticeLeft = Math.max(0, noticeLeft - dt); if (!noticeLeft) { noticeEl.classList.remove('on'); if (opened) redraw(); } } },
    destroy() { if (disposed) return; if (opened) onOpen?.(false); disposed = true; opened = false; el.remove(); style.remove(); },
  };
}
