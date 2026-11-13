// The Office — the small things that make it feel looked after: a chime when
// someone needs you, a desktop notification when you are in another tab, and
// "while you were away" when you come back. All of it is off until you ask
// (Ctrl-K → Sound / Notify), and none of it needs a file: the sounds are
// synthesised.
import { h, ago } from './dom.js';

export function createExtras(office, ui) {
  const net = office.net, settings = office.settings;

  /* ---- sound: a tiny synth ---------------------------------------------------- */
  let ctx = null, master = null;
  function audio() {
    if (settings.get('sound') !== 'on') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  /** One soft note. type: sine/triangle/square; slide: glide to this frequency. */
  function note(freq, at = 0, len = 0.18, type = 'sine', vol = 1, slide = 0) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + len);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + len + 0.03);
  }
  const SOUNDS = {
    needs: () => { note(660, 0, 0.16, 'triangle', 0.9); note(880, 0.13, 0.3, 'triangle', 0.9); },          // "excuse me"
    bell: () => { note(1568, 0, 0.9, 'sine', 0.8); note(3136, 0, 0.5, 'sine', 0.25); },
    lift: () => { note(988, 0, 0.5, 'sine', 0.5); note(784, 0.32, 0.7, 'sine', 0.5); },
    plane: () => note(900, 0, 0.3, 'sine', 0.22, 300),
    done: () => { [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.07, 0.22, 'triangle', 0.6)); },
    found: () => { [659, 784, 988, 1319, 1568].forEach((f, i) => note(f, i * 0.09, 0.4, 'sine', 0.6)); },
    purr: () => { for (let i = 0; i < 9; i++) note(52 + (i % 2) * 6, i * 0.07, 0.07, 'square', 0.25); },
    coin: () => { note(988, 0, 0.08, 'square', 0.3); note(1319, 0.08, 0.3, 'square', 0.3); },
    disco: () => { [220, 277, 330, 277, 220, 277, 330, 440].forEach((f, i) => note(f, i * 0.16, 0.14, 'square', 0.22)); },
  };
  const play = (name) => { try { SOUNDS[name]?.(); } catch { /* audio is a nicety */ } };

  net.on('fx', (fx) => {
    if (fx.kind === 'bell') play('bell');
    else if (fx.kind === 'elevator' && fx.dir === 'in') play('lift');
    else if (fx.kind === 'plane') play('plane');
    else if (fx.kind === 'confetti') play('done');
    else if (fx.kind === 'pet') play('purr');
    else if (fx.kind === 'vend' || fx.kind === 'arcade') play('coin');
    else if (fx.kind === 'disco') play('disco');
  });
  net.on('discovery', () => play('found'));

  /* ---- someone needs you ------------------------------------------------------------ */
  const known = new Set();
  let primed = false;
  net.on('prompts', (prompts) => {
    const pending = (prompts || []).filter((p) => p.status === 'pending' && p.kind !== 'idle');
    const fresh = pending.filter((p) => !known.has(p.id));
    for (const p of pending) known.add(p.id);
    if (!primed) { primed = true; return; }                     // whatever was already waiting when we arrived is not news
    if (!fresh.length) return;
    play('needs');
    if (settings.get('notify') === 'on' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const p = fresh[0];
      try {
        const n = new Notification(`${p.agentName} needs you`, { body: String(p.message || '').slice(0, 180), tag: 'office-' + p.agentId });
        n.onclick = () => { window.focus(); ui.focusNeed(p.agentId); n.close(); };
      } catch { /* some browsers only allow this from a service worker */ }
    }
  });
  settings.on((key, value) => {
    if (key === 'sound' && value === 'on') { audio(); play('needs'); }
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

  return { play };
}
