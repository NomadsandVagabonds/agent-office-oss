// The Office — the interface shell: top bar, selection, toasts, keyboard, and
// the panels that open over the world. Everything here talks to the daemon
// through office.net and to the 3D scene through office.rig / office.people.
import * as THREE from 'three';
import { h, icon, clock } from './dom.js';
import { createLabels } from './labels.js';
import { createPicker } from './pick.js';
import { createNeeds } from './needs.js';
import { createInspector } from './inspector.js';
import { createPalette } from './palette.js';
import { createExtras } from './extras.js';
import { createFuelChip } from './usage.js';

const EMOJI = { wave: '👋', dance: '💃', bow: '🙇', cheer: '🎉', shrug: '🤷', think: '🤔', facepalm: '🤦', nod: '👍', stretch: '🙆',
  highfive: '🙌', salute: '🫡', spin: '🌀', sleep: '💤', laugh: '😄' };
const USE_FX = { coffee: ['coffee', '☕'], vend: ['vending', '🍫'], water: ['tree', '💧'], print: ['printer', '📄'], duck: [null, '🦆'] };
const SHEETS = {
  comms: { title: 'Comms', icon: 'chat', key: 'c', load: () => import('./comms.js') },
  board: { title: 'Board', icon: 'board', key: 'b', load: () => import('./board.js') },
  binder: { title: 'Binder', icon: 'book', key: 'k', load: () => import('./binder.js') },
  work: { title: 'Sessions', icon: 'term', key: 't', load: () => import('./terminal.js') },
  passport: { title: 'Passport', icon: 'star', key: 'p', load: () => import('./passport.js') },
  // no button of its own: the fuel chip in the top bar and the tanks beside the big board open it
  usage: { title: 'What is left', icon: 'eye', key: 'u', hidden: true, load: () => import('./usage.js') },
  // opened from an agent's card, a red thread on the floor, or Ctrl-K
  repos: { title: 'Repos', icon: 'pin', key: 'g', hidden: true, load: () => import('./repos.js') },
};

export function createUI(office) {
  const root = document.getElementById('ui');
  if (!document.getElementById('office-ui-css')) {
    document.head.append(h('link', { id: 'office-ui-css', rel: 'stylesheet', href: '/world/ui/ui.css' }));
  }
  const net = office.net;
  const ui = { root, office };

  /* ---- the edges of the screen ------------------------------------------------------
     Top left: the nameplate and who is in. Top right: two instruments. Bottom centre: a
     dock of seven keys. Bottom right: the in-tray (needs.js). Bottom left: one line of
     what just happened. Everything else is the room. */
  const census = h('div.census');
  const dayEl = h('small'), clockEl = h('span');
  const brand = h('div.nameplate', { title: 'The whole office (Space)', onclick: () => ui.overview() }, 'THE OFFICE');
  root.append(h('div.hud-tl', brand, census));
  root.append(h('div.hud-tr', createFuelChip(office, ui), h('div.lcd', dayEl, clockEl)));
  const dock = h('div.dock.glass');
  root.append(dock);
  const dockKey = (glyph, label, hot, onclick) => {
    const key = h('button.key', { type: 'button', 'aria-label': label, onclick }, icon(glyph), h('kbd', hot), h('span.tip', label));
    dock.append(key);
    return key;
  };
  const sheetButtons = {};
  for (const [name, s] of Object.entries(SHEETS)) {
    if (s.hidden) continue;
    sheetButtons[name] = dockKey(s.icon, s.title, s.key.toUpperCase(), () => ui.toggleSheet(name));
  }
  dock.append(h('span.sep'));
  const walkBtn = dockKey('pin', 'Walk the floor', 'Tab', () => { office.walk?.toggle(); walkBtn.classList.toggle('on', !!office.walk?.active); });
  dockKey('search', 'Find anyone or anything', '/', () => ui.palette.open());

  function renderTally() {
    const c = { working: 0, thinking: 0, needs: 0, idle: 0 };
    for (const a of net.state.agents.values()) {
      if (a.status === 'blocked' && a.blockKind !== 'idle') c.needs++;
      else if (a.turn === 'idle' || a.status === 'done' || a.status === 'blocked') c.idle++;
      else if (a.status === 'working') c.working++;
      else c.thinking++;
    }
    // three numbers, at most: who needs you, who is at work, who has finished
    const n = (count, cls, word, title, onclick) => (count ? h('span.n' + (cls === 'blocked' ? '.hot' : ''), { title, onclick }, h('i.dot.' + cls), h('b', String(count)), h('span.word', word)) : null);
    census.replaceChildren(...[
      n(c.needs, 'blocked', c.needs === 1 ? 'needs you' : 'need you', 'Waiting on you (N)', () => ui.nextNeed()),
      n(c.working + c.thinking, 'working', 'at work', 'Mid-task: click to visit each in turn', () => ui.cycle((a) => (a.status === 'working' || a.status === 'thinking') && a.turn !== 'idle')),
      n(c.idle, 'idle', 'idle', 'Finished their turn: click to visit each in turn', () => ui.cycle((a) => a.turn === 'idle' || a.status === 'done')),
    ].filter(Boolean));
    if (!net.state.agents.size) census.append(h('span', 'nobody in yet'));
  }
  ui.setNeedCount = (n) => { document.title = n ? `(${n}) The Office` : 'The Office'; };
  function tickClock() {
    const tz = net.state.world?.today?.tzOffsetMin;
    const d = new Date(net.now() + (Number.isFinite(tz) ? tz + new Date().getTimezoneOffset() : 0) * 60000);
    dayEl.textContent = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    clockEl.textContent = clock(d.getTime());
  }
  setInterval(tickClock, 10000);

  /* ---- the ticker: one line of what just happened ------------------------------------
     It replaces itself and fades; it never stacks. (ui.toast keeps its name: a lot calls it.) */
  const ticker = h('div.ticker');
  root.append(ticker);
  let tickerTimer = 0;
  ui.toast = (content, opt = {}) => {
    ticker.replaceChildren(...(Array.isArray(content) ? content : [content]).map((c) => (c instanceof Node ? c : document.createTextNode(String(c)))));
    ticker.className = 'ticker on' + (opt.gold ? ' gold' : '');
    ticker.title = ticker.textContent;
    ticker.onclick = opt.onclick || null;
    ticker.style.cursor = opt.onclick ? 'pointer' : 'default';
    clearTimeout(tickerTimer);
    tickerTimer = setTimeout(() => ticker.classList.remove('on'), opt.ms || 5200);
    return ticker;
  };

  /* ---- selection ---------------------------------------------------------------- */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 40), new THREE.MeshBasicMaterial({ color: '#f0b860', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 4;
  office.stage.scene.add(ring);

  const labels = createLabels(office, ui);
  const picker = createPicker(office);
  const inspector = createInspector(office, ui);
  const needs = createNeeds(office, ui);

  ui.select = (id) => {
    office.selected = id && net.state.agents.has(id) ? id : null;
    inspector.show(office.selected, { follow: !office.walk?.active });
    ring.visible = !!office.selected;
    net.send({ type: 'focus', name: 'Lead', focus: office.selected ? { kind: 'agent', id: office.selected } : null });
  };
  ui.focusNeed = (agentId) => { ui.select(agentId); needs.focus(agentId); };
  ui.nextNeed = () => {
    const id = needs.next(office.selected);
    if (id) ui.focusNeed(id); else ui.toast('Nobody is waiting on you.');
  };
  ui.cycle = (test) => {
    const list = [...net.state.agents.values()].filter(test).map((a) => a.id);
    if (!list.length) return;
    ui.select(list[(list.indexOf(office.selected) + 1) % list.length]);
  };
  ui.gotoRoom = (roomId) => {
    const room = office.world?.layout.roomById.get(roomId);
    if (!room) return;
    ui.select(null);
    office.rig.frame(room.rect, {});
  };
  ui.overview = () => { if (office.walk?.active) { office.walk.exit(); walkBtn.classList.remove('on'); } ui.select(null); office.rig.overview(); };

  office.rig.on((e) => {
    if (e.type !== 'click' || e.button !== 0) return;
    const hit = picker.at(e.x, e.y);
    if (hit?.kind === 'agent') ui.select(hit.id);
    else if (hit?.kind === 'cat') petCat();
    else if (hit?.kind === 'thing') ui.useThing(hit.object);
    else if (hit?.kind === 'ghost') office.eggs?.meetGhost();
    else if (hit?.kind === 'duck') office.walk.use({ thing: 'duck', label: 'a rubber duck', kind: 'duck', x: hit.x, z: hit.z });
    else if (office.selected) ui.select(null);
  });
  /** Click a thing (or press E at it): some open a panel, the rest answer in words. */
  ui.useThing = (o) => {
    const poi = o.poi;
    if (!poi) return;
    if (poi.kind === 'board') return ui.openSheet('board', { deptId: o.deptId });
    if (poi.kind === 'bigboard') return ui.openSheet('board');
    if (poi.kind === 'cabinet') return ui.openSheet('binder', { deptId: o.deptId });
    if (poi.kind === 'binder') return ui.openSheet('binder');
    if (poi.kind === 'trophies') return ui.openSheet('passport');
    if (poi.kind === 'pedestal') {
      const c = office.exhibits?.onPedestal(o.index);
      return office.walk.narrate(c ? `“${c.name}” — made by ${c.author}${c.runtime ? ` (${c.runtime})` : ''}.${c.note ? `\n${c.note}` : ''}` : 'An empty pedestal, waiting for someone to make something.');
    }
    if (poi.kind === 'shelf') {
      const items = (net.state.world?.shelves?.[o.deptId] || []).filter(Boolean).map((id) => office.creations[id]?.name || id);
      return office.walk.narrate(items.length ? `The team shelf: ${items.join(', ')}.` : 'The team shelf is empty. Agents fill it with: office place <creation>');
    }
    if (poi.kind === 'seat') return undefined;
    if (poi.kind === 'gauges') return ui.openSheet('usage');
    if (poi.kind === 'arcade') return import('./arcade.js').then((m) => m.playBugSquash({ office, ui }));
    if (poi.kind === 'elevator') return import('../levels/index.js').then((m) => m.callLift(office));      // the floor panel, then a ride
    if (poi.kind === 'vending' && net.state.world?.game) return import('./vending.js').then((m) => m.openVending({ office }));   // its front: what coins buy
    return office.walk.use({ thing: poi.id, label: poi.label, kind: poi.kind, x: o.x, z: o.z });
  };
  async function petCat() {
    try {
      const me = office.walk?.me;
      const r = await net.api('/api/world/lead/use', { method: 'POST', body: { id: me?.id, name: me?.name, thing: 'cat' } });
      if (office.walk?.active && r?.text) office.walk.narrate(r.text);
    } catch { /* the cat is busy */ }
  }
  const canvas = office.stage.renderer.domElement;
  let hoverAt = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || performance.now() - hoverAt < 60) return;
    hoverAt = performance.now();
    const hit = picker.at(e.clientX, e.clientY), kind = hit?.kind;
    office.hovered = kind === 'agent' ? hit.id : null;           // labels.js shows a name for whoever is under the pointer
    canvas.style.cursor = kind && kind !== 'floor' ? 'pointer' : '';
  });
  canvas.addEventListener('dblclick', (e) => {
    const hit = picker.at(e.clientX, e.clientY);
    if (hit?.kind === 'floor' && hit.room && office.rig.cur.dist > 22) ui.gotoRoom(hit.room.id);
    else if (hit?.kind === 'floor') office.rig.flyTo({ x: hit.x, z: hit.z, dist: Math.max(8, office.rig.goal.dist * 0.6) });
  });

  /* ---- sheets: the big panels ---------------------------------------------------- */
  let sheet = null;      // { name, el, api }
  ui.closeSheet = () => {
    if (!sheet) return;
    sheet.api?.close?.();
    sheet.el.remove();
    sheetButtons[sheet.name]?.classList.remove('on');
    sheet = null;
    needs.cover(false);
  };
  ui.openSheet = async (name, arg) => {
    const spec = SHEETS[name];
    if (!spec) return null;
    if (sheet?.name === name) { sheet.api?.show?.(arg); return sheet.api; }
    ui.closeSheet();
    const content = h('div.content');
    const extra = h('div.row.grow');
    const el = h('div.sheet.glass', h('header', icon(spec.icon), h('h2', spec.title), extra,
      h('button.btn.ghost.small', { title: 'Close (Esc)', onclick: () => ui.closeSheet() }, icon('close'))), content);
    root.append(el);
    sheet = { name, el, api: null };
    needs.cover(true);
    sheetButtons[name]?.classList.add('on');
    try {
      const mod = await spec.load();
      if (sheet?.el !== el) return null;                     // closed while loading
      sheet.api = mod.open({ office, ui, content, header: extra, arg });
    } catch (err) {
      console.error(err);
      content.append(h('div.empty', `This panel failed to open: ${err.message}`));
    }
    return sheet?.api || null;
  };
  ui.toggleSheet = (name) => (sheet?.name === name ? ui.closeSheet() : ui.openSheet(name));

  /* ---- keyboard ----------------------------------------------------------------- */
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (e.key === 'Escape') {
      if (typing) document.activeElement.blur();
      else if (sheet) ui.closeSheet();
      else if (office.selected) ui.select(null);
      else if (office.walk?.active) { office.walk.exit(); walkBtn.classList.remove('on'); }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Tab') { e.preventDefault(); if (sheet) ui.closeSheet(); office.walk?.toggle(); walkBtn.classList.toggle('on', !!office.walk?.active); return; }
    if (office.walk?.active) {                                   // on the floor: the keyboard moves you
      if (k === 'e' || k === 'Enter') {
        e.preventDefault();
        const near = office.walk.state.near;
        const o = near && office.world?.layout.objects.find((x) => x.poi?.id === near.thing);
        if (o) ui.useThing(o); else office.walk.use();
        return;
      }
      if (k === ' ') { e.preventDefault(); office.walk.hop(); return; }
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', '=', '+', '-'].includes(k)) { held.add(k); e.preventDefault(); return; }
    }
    if (k === ' ') { e.preventDefault(); ui.overview(); }
    else if (k === 'n') ui.nextNeed();
    else if (k === 'm' && office.selected) { e.preventDefault(); inspector.focusInput(); }
    else if (['w', 'a', 's', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '=', '+', '-'].includes(k)) { held.add(k); e.preventDefault(); }
    else for (const [name, s] of Object.entries(SHEETS)) if (s.key === k) ui.toggleSheet(name);
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => held.clear());

  function steer(dt) {
    const rig = office.rig, g = rig.goal;
    if (office.walk?.steer(held, dt)) {                          // walking: only zoom is left to the camera keys
      if (held.has('=') || held.has('+')) g.dist *= Math.exp(-1.4 * dt);
      if (held.has('-')) g.dist *= Math.exp(1.4 * dt);
      return;
    }
    if (!held.size) return;
    const step = g.dist * 0.9 * dt;
    let fx = 0, fz = 0;
    if (held.has('w') || held.has('ArrowUp')) fz -= 1;
    if (held.has('s') || held.has('ArrowDown')) fz += 1;
    if (held.has('a') || held.has('ArrowLeft')) fx -= 1;
    if (held.has('d') || held.has('ArrowRight')) fx += 1;
    if (fx || fz) {
      const c = Math.cos(g.yaw), s = Math.sin(g.yaw);
      rig.stopFollowing();
      rig.flyTo({ x: g.x + (fx * c + fz * s) * step, z: g.z + (-fx * s + fz * c) * step });
    }
    if (held.has('q')) g.yaw += 1.6 * dt;
    if (held.has('e')) g.yaw -= 1.6 * dt;
    if (held.has('=') || held.has('+')) rig.flyTo({ dist: g.dist * Math.exp(-1.4 * dt) });
    if (held.has('-')) rig.flyTo({ dist: g.dist * Math.exp(1.4 * dt) });
  }

  /* ---- what the daemon tells us ---------------------------------------------------- */
  net.on('snapshot', renderTally);
  net.on('agent', renderTally);
  net.on('remove', renderTally);
  net.on('world', tickClock);
  net.on('fx', (fx) => {
    if (fx.kind === 'say' && fx.id) labels.say(fx.id, fx.text);
    else if (fx.kind === 'emote' && fx.id) { labels.say(fx.id, EMOJI[fx.name] || '✨', 2600, 'emote'); office.people?.emote?.(fx.id, fx.name); }
    else if (fx.kind === 'plane') office.fx?.plane(fx.from, fx.to, () => { if (fx.to && fx.to !== 'lead') labels.say(fx.to, '✉️', 1800, 'emote'); });
    else if (fx.kind === 'confetti') {
      const at = (fx.by && office.people?.positionOf(fx.by)) || roomCentre(fx.deptId);
      if (at) office.fx?.confetti(at.x, at.z);
    } else if (fx.kind === 'elevator') office.fx?.lift();
    else if (fx.kind === 'cat') office.cat?.move(fx);
    else if (fx.kind === 'pet') {
      office.cat?.purr();
      const c = office.cat?.pos;
      if (c) for (let i = 0; i < 3; i++) setTimeout(() => labels.float(c.x, 0.45, c.z, '♥', { color: '#ff7a9a', ms: 1300 }), i * 160);
    } else if (fx.kind === 'bell') {
      const bell = office.world?.layout.objects.find((o) => o.type === 'bell');
      if (bell) labels.float(bell.x, 1.2, bell.z, 'ding!', { color: '#f0d27a', size: 16 });
    } else if (fx.kind === 'sticky' && fx.by) labels.say(fx.by, fx.to === 'done' ? '✅' : '📌', 1600, 'emote');
    else if (fx.kind === 'unveil') {                              // a new creation takes the first pedestal
      const p = office.world?.layout.objects.find((o) => o.type === 'pedestal' && o.index === 0);
      if (p) office.fx?.confetti(p.x, p.z, 40, 1.4);
      const c = office.creations[fx.creationId];
      ui.toast(c ? `New in the gallery: “${c.name}” by ${c.author}` : 'Something new is in the gallery.', { gold: true, onclick: p ? () => office.rig.flyTo({ x: p.x, z: p.z, dist: 7 }) : null });
    } else if (USE_FX[fx.kind]) {                                 // someone made coffee, bought a snack, watered the tree…
      const [poiId, mark] = USE_FX[fx.kind];
      const poi = fx.kind === 'duck' ? office.duck : office.world?.layout.pois.get(poiId)?.look;
      if (poi) labels.float(poi.x, fx.kind === 'water' ? 1.0 : 1.3, poi.z, fx.jam ? '💥' : mark, { size: 22, ms: 1700 });
    } else if (fx.kind === 'announce') ui.toast(h('span', h('b', `${fx.by} in ${fx.channel}: `), fx.text), { ms: 8000 });
  });
  function roomCentre(deptId) {
    const room = office.world?.layout.rooms.find((r) => r.deptId === deptId);
    return room ? { x: room.rect.x + room.rect.w / 2, z: room.rect.z + room.rect.d / 2 } : null;
  }
  // The ticker carries what an orchestrator would want to glance at; chatter, card shuffling and
  // requests have their own places (Comms, the Board, the in-tray).
  const TICKER = new Set(['join', 'leave', 'task-done', 'discovery', 'creation', 'usage', 'overlap', 'review']);
  net.on('activity', (item) => {
    if (!item?.text || !TICKER.has(item.kind)) return;
    const gold = item.kind === 'discovery' || item.kind === 'task-done' || item.kind === 'creation';
    ui.toast(item.text, { gold, onclick: item.kind === 'review' && item.taskId ? () => ui.openSheet('board', { deptId: item.deptId, taskId: item.taskId })
      : item.agentId && net.state.agents.has(item.agentId) ? () => ui.select(item.agentId) : null });
  });
  renderTally(); tickClock();

  /* ---- an empty office: say how people get in ----------------------------------------- */
  let welcome = null;
  function greet() {
    const empty = net.state.connected && office.ready && net.state.agents.size === 0;
    if (!empty) { if (welcome) { welcome.remove(); welcome = null; } return; }
    if (welcome) return;
    const code = (text) => h('code.mono', { style: { display: 'block', padding: '6px 9px', margin: '4px 0 10px', background: 'rgba(0,0,0,.3)', borderRadius: '6px', fontSize: '12px', userSelect: 'all' } }, text);
    welcome = h('div.away.glass', { style: { top: '96px' } },
      h('header', h('b', 'The office is open, and nobody is in yet.'), h('span.grow'), h('button.btn.ghost.small', { onclick: () => { welcome.remove(); welcome = { remove() {} }; } }, '×')),
      h('div.dim', { style: { margin: '4px 0 10px' } }, 'Agents show up here when their sessions report in. Three ways to fill it:'),
      h('div', 'See it alive with a fictional team'), code('npm run simulate'),
      h('div', 'Bring in every Claude Code session automatically'), code('npm run install-hooks && npm run install-inbox'),
      h('div', 'Walk in any other agent (Codex, Gemini CLI, opencode, your own)'), code('node office.mjs join --provider gemini --name "Ada"'),
      h('div.faint', { style: { fontSize: '12px' } }, 'Meanwhile, Tab lets you walk the floor yourself. There are things to find.'));
    root.append(welcome);
  }
  setTimeout(greet, 3500);
  net.on('snapshot', () => setTimeout(greet, 800)); net.on('agent', greet); net.on('remove', () => setTimeout(greet, 1500));

  ui.update = (dt) => {
    steer(dt);
    if (office.selected) {
      const p = office.people?.positionOf(office.selected);
      if (p) { ring.position.set(p.x, 0.03, p.z); ring.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.06); }
    }
    labels.update();
  };
  ui.palette = createPalette(office, ui);
  ui.extras = createExtras(office, ui);
  ui.labels = labels; ui.needs = needs; ui.inspector = inspector; ui.picker = picker;
  // /?level=roof — straight to a floor of the lift (core/levels.mjs)
  if (office.q?.get('level')) import('../levels/index.js').then((m) => m.ride(office, office.q.get('level'), { instant: true })).catch((err) => console.error(err));
  return ui;
}
