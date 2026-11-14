// The Office — the small things that make it feel looked after: what happens in the office can be heard
// (quietly, and only where you are looking), a chime and a desktop notification tell you when someone needs
// you while you are in another tab, and "while you were away" greets you when you come back. All of it is off
// until you ask (Ctrl-K → Sound / Notify). The sounds themselves live in sound.js; this file decides when.
import { h, ago } from './dom.js';
import { createSound } from './sound.js';

const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createExtras(office, ui) {
  const net = office.net, settings = office.settings;
  const sound = office.sound = createSound(office);

  /* ---- what happens in the office, heard ----------------------------------------------------- */
  // Only "someone needs you" follows you into another tab or onto another floor; the rest is the office
  // itself, and is heard only while you are looking at it.
  const present = () => !document.hidden && !office.stage.view;
  const spot = (id) => office.world?.layout.pois.get(id)?.look || null;
  const whereIs = (id) => (id && id !== 'lead' && office.people?.positionOf(id)) || null;
  const roomOf = (deptId) => { const r = office.world?.layout.rooms.find((room) => room.deptId === deptId)?.rect; return r ? { x: r.x + r.w / 2, z: r.z + r.d / 2 } : null; };
  /** Play it where it happens; a thing with no place makes no sound. */
  const playAt = (name, where, opt) => (where ? sound.play(name, { ...opt, at: where }) : null);
  const seen = {};
  /** True at most once every `ms` for the same key: a crowd arriving is one ding, not twelve. */
  const every = (key, ms) => { const t = performance.now(); if (t - (seen[key] ?? -1e9) < ms) return false; seen[key] = t; return true; };

  let discoUntil = 0, disco = null, bed = null, bedLevel = 0, nextKeys = 0;

  /** The ops console answers a magic word: "Fool." — a beat — "Fine." */
  function hollow() {
    if (!present() || !every('hollow', 5000)) return;
    const at = spot('console');
    sound.play('hollow-fool', { at });
    setTimeout(() => sound.play('hollow-fine', { at }), 1500);
  }

  net.on('fx', (fx) => {
    if (fx.kind === 'disco') { discoUntil = fx.until; ambient(); return; }
    if (!present()) return;
    switch (fx.kind) {
      case 'bell': playAt('bell', spot('bell')); break;
      case 'elevator': {                                       // someone arrives or leaves: a ding, then the doors
        if (!every('lift', 3000)) break;
        const landing = office.world?.layout.spots.landing;
        playAt('lift-ding', landing);
        setTimeout(() => { if (present()) playAt('lift-doors', landing); }, 350);
        break;
      }
      case 'coffee': playAt('coffee', spot('coffee')); break;
      case 'vend': playAt('vend', spot('vending')); break;
      case 'water': playAt('water', spot('tree')); break;
      case 'print': if (fx.jam) playAt('printer-jam', spot('printer')); else playAt('printer', spot('printer')); break;
      case 'duck': playAt('duck', office.duck); break;
      case 'plane': {                                          // a note between two agents is heard where it sets off; one to or from you, right here
        const mine = fx.from === 'lead' || fx.to === 'lead';
        if (mine) sound.play('paper-plane', { volume: 0.7 }); else playAt('paper-plane', whereIs(fx.from) || whereIs(fx.to));
        break;
      }
      case 'confetti': playAt('confetti', whereIs(fx.by) || roomOf(fx.deptId)); break;
      case 'unveil': { const p = office.world?.layout.objects.find((o) => o.type === 'pedestal' && o.index === 0); playAt('confetti', p); break; }
      case 'sticky': if (fx.to !== 'done') playAt('sticky', whereIs(fx.by) || roomOf(fx.deptId)); break;       // a card that reaches Done gets confetti instead
      case 'pet': playAt('purr', office.cat?.pos); break;
      case 'arcade': if (!document.querySelector('#ui .arcade')) playAt('coin', spot('arcade-1')); break;      // someone else's game
    }
  });
  net.on('discovery', (m) => {
    if (!present()) return;
    if (m?.secret?.id === 'magic-word') { hollow(); setTimeout(() => sound.play('discovery'), 2800); } else sound.play('discovery');
  });
  // a discovery is only announced the first time; the console answers out loud every time
  let hooked = net.on('world', () => {
    hooked(); hooked = () => {};
    const used = office.onUsed;
    office.onUsed = (target, result) => { used?.(target, result); if (target?.kind === 'console' && /hollow voice/i.test(result?.text || '')) hollow(); };
  });
  // leaning on the soft corner of the Back Room: the floor gives way
  let falling = false;
  new MutationObserver(() => { const was = falling; falling = document.body.classList.contains('noclip'); if (falling && !was) sound.play('noclip'); })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /** The things that go on rather than happen: disco music while the lights are down, room tone up close, somebody typing. */
  function ambient() {
    const here = sound.enabled && present(), cur = office.rig.cur;
    // disco: the jukebox plays for as long as the mirror ball is down, and fades with it — unless something else has the floor
    const dancing = here && net.now() < discoUntil - 400;
    if (dancing && sound.track === null) disco = sound.music('jukebox-disco', { volume: 0.45, fade: 0.6 });
    else if (!dancing && disco) { disco.stop(1.8); disco = null; }
    // room tone: there once you are in among the desks, gone by the time the building is a model on a table
    const b = office.world?.layout.bounds;
    const inside = !!b && cur.x > b.x0 - 1 && cur.x < b.x1 + 1 && cur.z > b.z0 - 1 && cur.z < b.z1 + 1;
    const level = here && inside ? 0.3 * (1 - smooth(cur.dist, 12, 40)) : 0;
    if (level > 0.01) {
      if (!bed) bed = sound.ambience('office-bed', { volume: level, fade: 1.5 });
      else if (Math.abs(level - bedLevel) > 0.01) bed.volume(level, 1);
      bedLevel = level;
    } else if (bed) { bed.stop(1.2); bed = null; bedLevel = 0; }
    // typing: now and then, from someone nearby who is working
    const now = performance.now();
    if (!here || cur.dist > 15 || now < nextKeys) return;
    const near = [...(office.people?.people.values() || [])].filter((p) => p.atDesk && !p.walking && p.agent.status === 'working' && Math.hypot(p.pos.x - cur.x, p.pos.z - cur.z) < 7);
    nextKeys = now + (near.length ? (1100 + Math.random() * 2600) / Math.sqrt(Math.min(3, near.length)) : 700);
    if (near.length) playAt('typing', near[(Math.random() * near.length) | 0].pos, { rate: 0.9 + Math.random() * 0.25, from: Math.random() * 0.9, length: 0.4 + Math.random() * 0.8 });
  }
  setInterval(ambient, 300);
  document.addEventListener('visibilitychange', ambient);

  /* ---- someone needs you ------------------------------------------------------------ */
  const known = new Set();
  let primed = false;
  net.on('prompts', (prompts) => {
    const pending = (prompts || []).filter((p) => p.status === 'pending' && p.kind !== 'idle');
    const fresh = pending.filter((p) => !known.has(p.id));
    for (const p of pending) known.add(p.id);
    if (!primed) { primed = true; return; }                     // whatever was already waiting when we arrived is not news
    if (!fresh.length) return;
    sound.play('needs-you');
    if (settings.get('notify') === 'on' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const p = fresh[0];
      try {
        const n = new Notification(`${p.agentName} needs you`, { body: String(p.message || '').slice(0, 180), tag: 'office-' + p.agentId });
        n.onclick = () => { window.focus(); ui.focusNeed(p.agentId); n.close(); };
      } catch { /* some browsers only allow this from a service worker */ }
    }
  });
  settings.on((key, value) => {
    if (key === 'sound' && value === 'on') sound.play('needs-you');             // this is what it sounds like
    if (key === 'notify' && value === 'on' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => { if (perm !== 'granted') { settings.set('notify', 'off'); ui.toast('The browser would not allow notifications.'); } });
    }
  });

  /* ---- while you were away ------------------------------------------------------------ */
  const KEEP = new Set(['join', 'leave', 'needs-you', 'task-done', 'discovery', 'creation']);
  async function digest() {
    let last = 0;
    try { last = Number(localStorage.getItem('office.lastSeen') || 0); } catch { last = 0; }
    const stamp = () => { try { localStorage.setItem('office.lastSeen', String(Date.now())); } catch { /* fine */ } };
    setInterval(stamp, 30000); window.addEventListener('pagehide', stamp);
    const now = net.now();
    if (!last || now - last < 10 * 60 * 1000) { stamp(); return; }
    let items = [];
    try { items = (await net.api(`/api/activity?since=${last}&limit=400`)).items || []; } catch { items = []; }
    stamp();
    const worth = items.filter((i) => KEEP.has(i.kind));
    if (worth.length < 2) return;
    const done = worth.filter((i) => i.kind === 'task-done').length, found = worth.filter((i) => i.kind === 'discovery').length;
    const joined = worth.filter((i) => i.kind === 'join').length, made = worth.filter((i) => i.kind === 'creation').length;
    const asked = worth.filter((i) => i.kind === 'needs-you').length;
    const headline = [done && `${done} task${done > 1 ? 's' : ''} finished`, asked && `${asked} question${asked > 1 ? 's' : ''} for you`, joined && `${joined} arrival${joined > 1 ? 's' : ''}`,
      found && `${found} discover${found > 1 ? 'ies' : 'y'}`, made && `${made} new creation${made > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    // what is still waiting on you is in the tray already; this is for what got done
    const lines = worth.filter((i) => i.kind === 'task-done' || i.kind === 'discovery' || i.kind === 'creation').slice(-7).reverse();
    const card = h('div.away.glass',
      h('header', h('b', `While you were away (${ago(last, now)})`), h('span.grow'), h('button.btn.ghost.small', { onclick: () => card.remove() }, '×')),
      headline ? h('div.dim', { style: { margin: '2px 0 8px' } }, headline) : null,
      lines.map((i) => h('div.line', { onclick: i.agentId && net.state.agents.has(i.agentId) ? () => { ui.select(i.agentId); card.remove(); } : null },
        h('span.faint.mono', ago(i.t, now)), h('span.grow', i.text))));
    ui.root.append(card);
    setTimeout(() => card.remove(), 45000);
  }
  let once = net.on('world', () => { once(); once = () => {}; digest(); });

  return { play: sound.play, sound };
}
