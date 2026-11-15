// Six pockets at the edge of the tape. The scene stays visible while a carried
// object is inspected; only the selected pocket and its possible actions expand.
import { h } from '../ui/dom.js';
import { ITEM_DEFS } from './inventory-state.js';
import { CAMERA_INPUT, FIRE_SECONDS_PER_SHEET, resolveCraftInput, previewCraft } from './crafting.js';

import { INVENTORY_CSS as CSS } from './inventory-style.js';
import { createInventoryIcons } from './inventory-icons.js';

const NS = 'http://www.w3.org/2000/svg';
let instance = 0;

/** Original stepped silhouettes, with the same worn plastics and brass as the vox props. */
function fallbackItemIcon(type, item) {
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
  } else if (type === 'pink-slip') {
    rect(6,5,21,24,'#8c5266'); rect(5,4,21,24,'#e7a3b4'); rect(5,4,2,24,'#f3bccb');
    rect(8,7,15,3,'#4a2f3a'); for (const y of [13, 16, 19]) rect(8,y,13,1,'#b8697f');
    rect(16,22,8,4,'#b8697f'); rect(17,23,6,2,'#e7a3b4');
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

function heartIcon(id) {
  const svg = document.createElementNS(NS, 'svg'), body = document.createElementNS(NS, 'polygon');
  svg.setAttribute('viewBox', '-1 -1 22 18'); svg.setAttribute('class', 'br-inv-heart');
  svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
  body.setAttribute('class', 'heart-body'); body.setAttribute('points', '2,0 8,0 8,2 12,2 12,0 18,0 18,2 20,2 20,8 18,8 18,10 16,10 16,12 14,12 14,14 12,14 12,16 8,16 8,14 6,14 6,12 4,12 4,10 2,10 2,8 0,8 0,2 2,2');
  const defs = document.createElementNS(NS, 'defs'), clip = document.createElementNS(NS, 'clipPath'), shape = body.cloneNode();
  shape.removeAttribute('class');
  clip.id = `br-health-shape-${id}`; clip.append(shape); defs.append(clip); svg.append(defs);
  // One layer per health point, filled from the bottom. The narrow gaps stay
  // visible even at full health, so the four-point scale needs no extra text.
  const layers = Array.from({ length:4 }, (_, i) => {
    const layer = document.createElementNS(NS, 'rect');
    for (const [key, value] of Object.entries({ class:'heart-layer', x:0, y:(3 - i) * 4 + .4, width:20, height:3.2, fill:'currentColor', 'clip-path':`url(#${clip.id})` })) layer.setAttribute(key, value);
    svg.append(layer); return layer;
  });
  svg.append(body); return { svg, layers };
}

export function createInventoryHud({ host, onSelect, onUse, onDrop, onCraft, onOpen } = {}) {
  const id = ++instance, icons = createInventoryIcons();
  const itemIcon = (type, item) => icons.icon(type, item) || fallbackItemIcon(type, item);
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
  const heart = heartIcon(id);
  const health = h('div.br-inv-health', { hidden:true, role:'img', 'aria-label':'Health 4 of 4' }, heart.svg);
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
    if (item?.type === 'scissors') return `${item.uses} snip${item.uses === 1 ? '' : 's'} left`;
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
      health.classList.toggle('is-low', current > 0 && current <= 2);
      heart.layers.forEach((layer, i) => layer.setAttribute('visibility', i < current ? 'visible' : 'hidden'));
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
      text(slot.amount, item?.type === 'chalk' || item?.type === 'scissors' ? String(item.uses) : item?.type === 'paper' ? String(quantity(item)) : '');
      slot.power.hidden = item?.type !== 'torch';
      slot.mount.hidden = !item || item.id !== snapshot.mountedTorch;
      if (item?.type === 'torch') slot.fill.style.transform = `scaleX(${percent(item) / 100})`;
    }
    text(caption, selected ? `${nameOf(selected)}${selected.type === 'torch' ? ` · ${percent(selected)}%${selected.id === snapshot.mountedTorch ? ' · mounted' : ''}` : selected.type === 'chalk' || selected.type === 'scissors' ? ' · ' + selected.uses : selected.type === 'paper' ? ' · ' + quantity(selected) + (quantity(selected) === 1 ? ' sheet' : ' sheets') : ''}` : '');
    text(count, crafting ? 'COMBINE' : `POCKETS  ${snapshot.slots.filter(Boolean).length} / 6`);
    text(title, nameOf(selected));
    text(description, selected ? ITEM_DEFS[selected.type]?.description || '' : 'Pick up an object to carry it here.');
    text(condition, opened && noticeLeft > 0 ? noticeEl.textContent : conditionOf(selected));
    if (detailType !== iconKey(selected)) { specimen.replaceChildren(...(selected ? [itemIcon(selected.type, selected)] : [])); detailType = iconKey(selected); }
    const label = selected?.type === 'torch' ? snapshot.activeTorch === selected.id ? 'Switch off' : 'Switch on'
      : selected?.type === 'chalk' ? 'Mark floor' : selected?.type === 'scissors' ? 'Snip' : selected?.type === 'snack' ? 'Eat' : 'Use';
    text(useLabel, label);
    // F prefers the mounted light; Q always acts on this inspected item.
    text(useKey, selected?.type === 'torch' && (!snapshot.mountedTorch || snapshot.mountedTorch === selected.id) ? 'F' : 'Q');
    use.hidden = ['battery', 'paper', 'lighter', 'tape'].includes(selected?.type);
    use.disabled = blocked() || !selected || ['paper', 'pink-slip', 'balloon', 'lighter', 'tape', 'battery'].includes(selected.type)
      || (selected.type === 'snack' && !canEat()) || (selected.type === 'torch' && selected.charge <= 0) || (selected.type === 'scissors' && selected.uses <= 0);
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
      disposed = true; opened = false; overlayObserver.disconnect(); icons.dispose(); el.remove(); style.remove();
      for (const type of ownedEvents) el.removeEventListener(type, stopBubble);
      for (const [name, value, priority] of previousOffsets) {
        if (value) owner.style.setProperty(name, value, priority); else owner.style.removeProperty(name);
      }
    },
  };
}
