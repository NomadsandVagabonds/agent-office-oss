// The Office — the interface shell: top bar, selection, toasts, keyboard, and
// the panels that open over the world. Everything here talks to the daemon
// through office.net and to the 3D scene through office.rig / office.people.
import * as THREE from 'three';
import { h, icon, clock } from './dom.js';
import { createLabels } from './labels.js';
import { createPicker } from './pick.js';
import { createNeeds } from './needs.js';
import { createInspector } from './inspector.js';

const EMOJI = { wave: '👋', dance: '💃', bow: '🙇', cheer: '🎉', shrug: '🤷', think: '🤔', facepalm: '🤦', nod: '👍', stretch: '🙆',
  highfive: '🙌', salute: '🫡', spin: '🌀', sleep: '💤', laugh: '😄' };
const SHEETS = {
  comms: { title: 'Comms', icon: 'chat', key: 'c', load: () => import('./comms.js') },
  board: { title: 'Board', icon: 'board', key: 'b', load: () => import('./board.js') },
  binder: { title: 'Binder', icon: 'book', key: 'k', load: () => import('./binder.js') },
  work: { title: 'Terminals', icon: 'term', key: 't', load: () => import('./terminal.js') },
  passport: { title: 'Passport', icon: 'star', key: 'p', load: () => import('./passport.js') },
};

export function createUI(office) {
  const root = document.getElementById('ui');
  if (!document.getElementById('office-ui-css')) {
    document.head.append(h('link', { id: 'office-ui-css', rel: 'stylesheet', href: '/world/ui/ui.css' }));
  }
  const net = office.net;
  const ui = { root, office };

  /* ---- top bar ------------------------------------------------------------------ */
  const tally = h('div.tally');
  const clockEl = h('span.clock');
  const tools = h('div.tools');
  const needBadge = h('span.badge.hidden', '0');
  const brand = h('div.brand', { title: 'Back to the whole office (Space)', onclick: () => ui.overview() }, 'THE OFFICE');
  root.append(h('div.topbar.glass', brand, tally, h('span.grow'), clockEl, tools));
  const sheetButtons = {};
  tools.append(h('button.btn.ghost', { title: 'Next agent waiting on you (N)', onclick: () => ui.nextNeed() }, icon('inbox'), h('span.word', 'Needs you'), needBadge));
  const walkBtn = h('button.btn.ghost', { title: 'Walk the floor yourself (Tab)', onclick: () => office.walk?.toggle() }, icon('pin'), h('span.word', 'Walk'));
  tools.append(walkBtn);
  for (const [name, s] of Object.entries(SHEETS)) {
    sheetButtons[name] = h('button.btn.ghost', { title: `${s.title} (${s.key.toUpperCase()})`, onclick: () => ui.toggleSheet(name) }, icon(s.icon), h('span.word', s.title));
    tools.append(sheetButtons[name]);
  }

  function renderTally() {
    const c = { working: 0, thinking: 0, needs: 0, idle: 0 };
    for (const a of net.state.agents.values()) {
      if (a.status === 'blocked' && a.blockKind !== 'idle') c.needs++;
      else if (a.turn === 'idle' || a.status === 'done' || a.status === 'blocked') c.idle++;
      else if (a.status === 'working') c.working++;
      else c.thinking++;
    }
    const chip = (n, cls, word, title, onclick) => (n ? h('span.chip' + (cls === 'blocked' ? '.hot' : ''), { title, onclick }, h('i.dot.' + cls), String(n), h('span.word', ' ' + word)) : null);
    tally.replaceChildren(...[
      chip(c.needs, 'blocked', c.needs === 1 ? 'needs you' : 'need you', 'Waiting on you — click to visit', () => ui.nextNeed()),
      chip(c.working, 'working', 'working', 'Mid-task', () => ui.cycle((a) => a.status === 'working' && a.turn !== 'idle')),
      chip(c.thinking, 'thinking', 'thinking', 'Thinking', () => ui.cycle((a) => a.status === 'thinking' && a.turn !== 'idle')),
      chip(c.idle, 'idle', 'idle', 'Finished their turn', () => ui.cycle((a) => a.turn === 'idle' || a.status === 'done')),
    ].filter(Boolean));
    if (!net.state.agents.size) tally.append(h('span.chip', 'nobody here yet'));
  }
  ui.setNeedCount = (n) => { needBadge.textContent = String(n); needBadge.classList.toggle('hidden', !n); document.title = n ? `(${n}) The Office` : 'The Office'; };
  function tickClock() {
    const tz = net.state.world?.today?.tzOffsetMin;
    const d = new Date(net.now() + (Number.isFinite(tz) ? tz + new Date().getTimezoneOffset() : 0) * 60000);
    clockEl.textContent = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${clock(d.getTime())}`;
  }
  setInterval(tickClock, 10000);

  /* ---- toasts ------------------------------------------------------------------- */
  const toasts = h('div.toasts');
  root.append(toasts);
  ui.toast = (content, opt = {}) => {
    const el = h('div.toast.glass' + (opt.gold ? '.gold' : ''), content);
    if (opt.onclick) { el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto'; el.onclick = opt.onclick; }
    toasts.prepend(el);
    while (toasts.children.length > 5) toasts.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 650); }, opt.ms || 5200);
    return el;
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
    else if (office.selected) ui.select(null);
  });
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
    const kind = picker.at(e.clientX, e.clientY)?.kind;
    canvas.style.cursor = kind === 'agent' || kind === 'cat' ? 'pointer' : '';
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
  root.append(h('div.hint', h('div', 'drag: move · right-drag: turn · scroll: zoom'), h('div', 'click someone · N: who needs you · Space: whole office')));
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
      if (k === 'e' || k === 'Enter') { e.preventDefault(); office.walk.use(); return; }
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
    } else if (fx.kind === 'announce') ui.toast(h('span', h('b', `${fx.by} in ${fx.channel}: `), fx.text), { ms: 8000 });
  });
  function roomCentre(deptId) {
    const room = office.world?.layout.rooms.find((r) => r.deptId === deptId);
    return room ? { x: room.rect.x + room.rect.w / 2, z: room.rect.z + room.rect.d / 2 } : null;
  }
  net.on('activity', (item) => {
    if (!item?.text || item.kind === 'channel' || item.kind === 'dm') return;      // chatter has its own panel
    const gold = item.kind === 'discovery' || item.kind === 'task-done' || item.kind === 'creation';
    ui.toast(item.text, { gold, onclick: item.agentId && net.state.agents.has(item.agentId) ? () => ui.select(item.agentId) : null });
  });
  renderTally(); tickClock();

  ui.update = (dt) => {
    steer(dt);
    if (office.selected) {
      const p = office.people?.positionOf(office.selected);
      if (p) { ring.position.set(p.x, 0.03, p.z); ring.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.06); }
    }
    labels.update();
  };
  ui.labels = labels; ui.needs = needs; ui.inspector = inspector; ui.picker = picker;
  return ui;
}
