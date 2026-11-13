// The Office — the world as text.
//
// Humans see the office in 3D. Agents are text-native, so the same world is
// also a place they can *read* and act in: look, go, examine, use. Every
// answer is short on purpose (an agent's attention is its budget), and every
// action is mirrored in 3D, so a human watching sees their agent stand up and
// walk to the coffee machine.
import fs from 'node:fs';
import path from 'node:path';
import { TASK_STATUS } from '../../core/contract.mjs';
import { pickDuckWisdom, pickFortune, pickSnack, SECRETS } from '../../core/secrets.mjs';
import { HOME, visibleLevels } from '../../core/levels.mjs';
import { readCreations } from '../creations-store.mjs';
import { hashId } from '../../core/look.mjs';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const squash = (s) => norm(s).replace(/\s+/g, '');
const list = (items) => (items.length <= 1 ? items.join('')
  : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

const ROOM_ALIASES = {
  kitchen: 'kitchen', 'break room': 'kitchen', breakroom: 'kitchen', cafe: 'kitchen',
  library: 'library', plaza: 'plaza', commons: 'plaza', lounge: 'plaza',
  foyer: 'foyer', lobby: 'foyer', entrance: 'foyer', reception: 'foyer',
  'server room': 'server', servers: 'server', server: 'server',
  closet: 'closet', 'supply closet': 'closet',
  'west corridor': 'corridor-w', 'east corridor': 'corridor-e', corridor: 'corridor-w',
  landing: 'landing', 'back room': 'backroom', backroom: 'backroom', speakeasy: 'backroom',
};
const POI_ALIASES = {
  coffee: 'coffee', 'coffee machine': 'coffee', espresso: 'coffee',
  cooler: 'cooler', 'water cooler': 'cooler', watercooler: 'cooler', water: 'cooler',
  vending: 'vending', 'vending machine': 'vending', snack: 'vending', snacks: 'vending',
  fridge: 'fridge', sofa: 'sofa', couch: 'sofa', tree: 'tree', 'office tree': 'tree',
  bell: 'bell', 'reception desk': 'reception', guestbook: 'guestbook', 'guest book': 'guestbook',
  trophies: 'trophies', 'trophy case': 'trophies', trophy: 'trophies',
  binder: 'binder', lectern: 'binder', globe: 'globe', printer: 'printer',
  'big board': 'bigboard', bigboard: 'bigboard',
  bookshelf: 'redbook', 'red book': 'redbook', book: 'redbook', redbook: 'redbook', shelf: null,
  painting: 'painting-classic', picture: 'painting-classic', clock: 'clock',
  console: 'console', 'ops console': 'console', terminal: 'console',
  rack: 'rack-2', racks: 'rack-2', hatch: 'hatch', trapdoor: 'hatch',
  roomba: 'roombadock', vacuum: 'roombadock', arcade: 'arcade-1', 'arcade cabinet': 'arcade-1',
  jukebox: 'jukebox', 'cat bed': 'catbed', cushion: 'catbed',
  armchair: 'armchair-1', 'reading chair': 'armchair-1',
};

export function createTextWorld(ctx, world) {
  const { cfg } = ctx;
  const L = () => world.layout();

  const providerTag = (a) => [a.provider || 'agent', (a.model || '').replace(/^claude-/, '')].filter(Boolean).join(' · ');
  const roomName = (id) => L().roomById.get(id)?.name || id;

  function whereabouts(agent) {
    const place = world.placeOf(agent.id);
    if (!place) return { room: null, text: 'not on the floor' };
    const moving = Date.now() < place.eta;
    const room = roomName(place.room);
    if (place.at === 'desk') return { room: place.room, text: moving ? `walking to their desk in ${room}` : `at their desk in ${room}` };
    if (place.at.startsWith('poi:')) {
      const poi = L().pois.get(place.ref);
      return { room: place.room, text: `${moving ? 'heading to' : 'at'} ${poi ? poi.label : place.ref} (${room})` };
    }
    if (place.at.startsWith('agent:')) {
      const other = ctx.agents.get(place.ref);
      return { room: place.room, text: `${moving ? 'walking over to' : 'visiting'} ${other ? other.name : 'a teammate'} (${room})` };
    }
    return { room: place.room, text: `${moving ? 'walking through' : 'standing in'} ${room}` };
  }

  function activity(a) {
    if (a.status === 'blocked') return a.blockKind === 'idle' ? 'waiting on the human' : `BLOCKED — ${a.note || 'needs the human'}`;
    if (a.status === 'working') return `working${a.tool ? ` (${a.tool})` : ''}`;
    if (a.turn === 'idle') return 'idle';
    return a.status;
  }

  function boardSummary(deptId) {
    const tasks = ctx.tasks.list({ deptId });
    if (!tasks.length) return 'empty';
    const counts = TASK_STATUS.map((s) => [s, tasks.filter((t) => t.status === s).length]).filter(([, n]) => n);
    return counts.map(([s, n]) => `${n} ${s}`).join(' · ');
  }

  function knowledgeIndex() {
    try { return JSON.parse(fs.readFileSync(path.join(cfg.publicDir, 'knowledge', '_index.json'), 'utf8')).projects || []; }
    catch { return []; }
  }

  function creations() {
    return readCreations(cfg.creationsFile)?.creations || [];
  }

  function duckDesk() {
    const desks = L().desks.filter((d) => !d.hot);
    if (!desks.length) return null;
    const d = new Date();
    return desks[hashId(`duck:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) % desks.length];
  }

  /* ---- resolve a free-text reference ----------------------------------- */

  function resolve(agent, ref) {
    const text = norm(ref);
    if (!text) return null;
    if (['home', 'desk', 'my desk', 'back', 'my seat', 'work'].includes(text)) return { kind: 'home' };
    if (['cat', 'kernel', norm(world.cat().name)].includes(text)) return { kind: 'cat' };
    if (['duck', 'rubber duck', 'debug duck'].includes(text)) return { kind: 'duck' };
    if (['window', 'outside', 'weather', 'sky'].includes(text)) return { kind: 'window' };
    if (['elevator', 'lift', 'the lift', 'the elevator', 'call panel', 'call button'].includes(text)) return poi('lift') || { kind: 'elevator' };
    // a human who is walking the floor (by name, or just "the lead")
    const walkers = world.leads().filter((l) => l.x !== null);
    const named = walkers.find((l) => norm(l.name) === text);
    if (named) return { kind: 'lead', lead: named };
    if (['lead', 'the lead', 'human', 'the human', 'boss'].includes(text)) return walkers[0] ? { kind: 'lead', lead: walkers[0] } : null;
    const deptId = agent.department?.id;
    const ownRoom = deptId ? `dept:${deptId}` : null;
    if (ownRoom && L().roomById.has(ownRoom)) {
      if (['board', 'task board', 'kanban', 'tasks'].includes(text)) return poi(`board:${ownRoom}`);
      if (['cabinet', 'filing cabinet', 'files'].includes(text)) return poi(`cabinet:${ownRoom}`);
      if (['shelf', 'team shelf', 'credenza'].includes(text)) return poi(`credenza:${ownRoom}`);
      if (['my room', 'office', 'my office', 'room'].includes(text)) return { kind: 'room', room: L().roomById.get(ownRoom) };
    }
    if (text in POI_ALIASES && POI_ALIASES[text]) return poi(POI_ALIASES[text]);
    const pedestal = /^pedestal\s*(\d+)$/.exec(text);
    if (pedestal) return poi(`pedestal:${Number(pedestal[1]) - 1}`);
    if (text in ROOM_ALIASES) return room(ROOM_ALIASES[text]);
    // a project room by name
    for (const r of L().rooms) {
      if (r.kind === 'project' && (squash(r.name) === squash(text) || squash(r.deptId) === squash(text))) return { kind: 'room', room: r };
    }
    // a creation on display
    const made = creations().find((c) => c.id === ref || squash(c.name) === squash(text));
    if (made) {
      const index = world.gallery().pedestals.indexOf(made.id);
      if (index >= 0) return poi(`pedestal:${index}`);
    }
    const other = ctx.agents.resolveRef(ref);
    if (other && other.id !== agent.id) return { kind: 'agent', agent: other };
    if (L().pois.has(ref)) return poi(ref);
    // anything else you can see: match what it is called, nearest room first
    const bare = text.replace(/^(the|a|an|my|our) /, '');
    const here = world.placeOf(agent.id)?.room || null;
    const rank = (p) => (p.room === here ? 0 : p.room === ownRoom ? 1 : 2);
    const visible = [...L().pois.values()]
      .filter((p) => p.kind !== 'seat' || bare.length > 3)
      .filter((p) => { const label = norm(p.label).replace(/^(the|a|an) /, ''); return label === bare || p.kind === bare || label.split(' ').includes(bare) || norm(p.id.split(':')[0]) === bare; })
      .sort((a, b) => rank(a) - rank(b));
    for (const p of visible) { const hit = poi(p.id); if (hit) return hit; }
    return null;
  }
  function poi(id) {
    const p = L().pois.get(id);
    if (!p) return null;
    if (p.hidden && !world.state().unlocked.backroom) return null;
    return { kind: 'poi', poi: p };
  }
  function room(id) {
    const r = L().roomById.get(id);
    // A room nobody has found yet does not exist as far as anyone can tell.
    return r && !r.locked ? { kind: 'room', room: r } : null;
  }

  /* ---- the lift -------------------------------------------------------- */
  // Its floors are core/levels.mjs. Humans ride it (public/world/levels/);
  // agents, at this stage, can walk up, read the panel and press the button.

  const liftFloors = () => visibleLevels({ quirks: world.today().quirks, found: Object.keys(world.state().discoveries) });
  const liftPanel = () => liftFloors().map((l) => (l.unmarked
    ? `  ${l.floor.padEnd(2)} · (no label. The button flickers. It was not there yesterday.)`
    : `  ${l.floor.padEnd(2)} · ${l.name} — ${l.blurb}${l.id === HOME ? '  ← you are here' : ''}`)).join('\n');
  const describeLift = () => 'The lift, at the head of the landing. Everyone arrives through it. The panel beside the doors lists where it goes:\n'
    + liftPanel() + '\nRiding is for humans only at this stage — but you can press the button: office use lift';
  const callLift = () => 'You press the call button. The doors slide open on an empty car, wait a polite moment, and close again. Inside, the buttons read:\n'
    + liftPanel() + '\nIt will not take you anywhere yet: riding is for humans only at this stage. Curious what is up there? Ask one — office dm lead "…"';

  /* ---- look ------------------------------------------------------------ */

  function look(agent, ref) {
    if (ref) return examine(agent, ref);
    const place = world.placeOf(agent.id);
    const here = place ? L().roomById.get(place.room) : null;
    const now = new Date();
    const today = world.today();
    const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const lines = [];
    const mine = whereabouts(agent);
    lines.push(`[${here ? here.name : 'Somewhere'}${here?.where ? ` — ${here.where}` : ''}]  ${clock} · ${today.weather}`);
    lines.push(`You are ${agent.name} (${providerTag(agent)}), ${mine.text.replace('their', 'your')}. ${activity(agent)}${agent.contextPct ? ` · context ${agent.contextPct}%` : ''}.`);

    const others = ctx.agents.list().filter((a) => a.id !== agent.id && ctx.agents.isPresent(a));
    const sameRoom = others.filter((a) => world.placeOf(a.id)?.room === place?.room);
    const teammates = others.filter((a) => a.department?.id === agent.department?.id && !sameRoom.includes(a));
    if (sameRoom.length) lines.push('With you: ' + sameRoom.map((a) => `${a.name} (${a.provider || 'agent'}) — ${activity(a)}`).join(' · ') + '.');
    if (teammates.length) lines.push('Teammates elsewhere: ' + teammates.map((a) => `${a.name} ${whereabouts(a).text}`).join(' · ') + '.');

    const things = [];
    for (const p of L().pois.values()) {
      if (p.room !== place?.room || (p.hidden && !world.state().unlocked.backroom)) continue;
      if (p.kind === 'seat' || p.kind === 'pedestal') continue;
      let label = p.label;
      if (p.kind === 'board' && here?.deptId) label += ` (${boardSummary(here.deptId)})`;
      if (p.kind === 'elevator') label += ` (${liftFloors().length} floors)`;
      if (p.kind === 'shelf' && here?.deptId) {
        const used = (world.state().shelves[here.deptId] || []).filter(Boolean).length;
        label += ` (${used}/6 on display)`;
      }
      const who = world.occupantOf(p.id);
      if (who && who !== agent.id) label += ` — ${ctx.agents.get(who)?.name || 'someone'} is there`;
      things.push(label);
    }
    const pedestals = [...L().pois.values()].filter((p) => p.kind === 'pedestal' && p.room === place?.room).length;
    if (pedestals) things.push(`${pedestals} gallery pedestals`);
    if (things.length) lines.push('Here: ' + list(things) + '.');

    if (place?.at === 'desk') {
      const items = agent.profile?.desk?.items || [];
      if (items.length) lines.push('On your desk: ' + list(items.map((i) => i.replace(/^c_/, '').replace(/_/g, ' '))) + '.');
    }
    const duck = duckDesk();
    if (duck && duck.room === place?.room) lines.push('A rubber duck is sitting on one of the desks here, looking attentive.');
    const cat = world.cat();
    if (cat.room === place?.room) lines.push(`${cat.name} the cat is ${cat.state === 'nap' ? 'asleep nearby' : 'here, watching you'}.`);
    const walking = world.leads().filter((l) => l.x !== null && l.room === place?.room);
    if (walking.length) lines.push(`${list(walking.map((l) => l.name))} (human) ${walking.length > 1 ? 'are' : 'is'} here in the room with you.`);
    const leads = world.leads().filter((l) => l.focus);
    if (leads.some((l) => (l.focus.kind === 'agent' && l.focus.id === agent.id))) lines.push('The Lead is looking at you right now.');
    else if (leads.some((l) => l.focus.kind === 'room' && l.focus.id === place?.room)) lines.push('The Lead is looking into this room.');

    const exits = exitsFrom(here);
    if (exits.length) lines.push('Exits: ' + exits.join(' · ') + '.');
    const inbox = ctx.inbox.collect(agent, { limit: 1 });
    if (inbox.unread) lines.push(`Mail: ${inbox.unread} unread${inbox.direct ? ` (${inbox.direct} direct)` : ''} — read it with: office inbox`);
    if (today.quirks.includes('friday-13')) lines.push('Something feels slightly off today. The elevator has a button you do not remember.');
    return { ok: true, text: lines.join('\n'), room: place?.room || null, place };
  }

  function exitsFrom(here) {
    if (!here) return [];
    const names = L().rooms.filter((r) => r.kind === 'project').map((r) => r.name);
    const commons = ['Plaza', 'Library', 'Kitchen', 'Foyer', 'Server Room', 'Supply Closet'];
    if (world.state().unlocked.backroom) commons.push('The Back Room');
    const out = [];
    if (here.kind === 'project' || here.kind === 'vacant') out.push(`the corridor (${here.side === 'N' ? 'south' : 'north'})`);
    out.push(...commons.filter((n) => n !== here.name));
    const rooms = names.filter((n) => n !== here.name);
    if (rooms.length) out.push('project rooms: ' + rooms.join(', '));
    return out;
  }

  /* ---- examine --------------------------------------------------------- */

  function examine(agent, ref) {
    const target = resolve(agent, ref);
    if (!target) return { error: `you see no "${ref}" here (try: office look, office map)`, status: 404 };
    if (target.kind === 'home') return look(agent);
    if (target.kind === 'agent') {
      const a = target.agent;
      const card = a.profile?.card;
      const c = a.profile?.character || {};
      const lines = [
        `${a.name} — ${providerTag(a)} · ${a.department?.name || 'no project'}`,
        `${whereabouts(a).text}; ${activity(a)}${a.task ? ` · task: ${a.task}` : ''}.`,
        `Looks like: ${[c.species, c.outfit, c.hair !== 'bald' ? `${c.hair} hair` : 'bald', c.accessory !== 'none' ? c.accessory : null].filter(Boolean).join(', ')}.`,
      ];
      if (card?.blurb) lines.push(`“${card.blurb}”`);
      lines.push(`Reach them: office dm "${a.name}" "…"`);
      return { ok: true, text: lines.join('\n'), agentId: a.id };
    }
    if (target.kind === 'lead') {
      const l = target.lead;
      return { ok: true, text: `${l.name} — the human. On the floor in ${roomName(l.room)}${l.moving ? ', walking' : ''}. (office go lead · office say "…")` };
    }
    if (target.kind === 'room') {
      const r = target.room;
      if (r.locked) return { error: 'you do not know of any such room', status: 404 };
      const inside = ctx.agents.list().filter((a) => world.placeOf(a.id)?.room === r.id).map((a) => a.name);
      const lines = [`${r.name}${r.where ? ` — ${r.where}` : ''}.`];
      if (r.kind === 'project') lines.push(`Task board: ${boardSummary(r.deptId)}.`);
      if (r.kind === 'vacant') lines.push('Empty. Boxes, a ladder, and a sign that says a new project could live here.');
      lines.push(inside.length ? `Inside: ${list(inside)}.` : 'Nobody is in there right now.');
      return { ok: true, text: lines.join('\n'), room: r.id };
    }
    if (target.kind === 'cat') {
      const cat = world.cat();
      return { ok: true, text: `${cat.name}, the office cat. Currently ${cat.state === 'nap' ? 'asleep' : 'awake'} in ${roomName(cat.room)}. Has been petted ${cat.pets} times. (office use cat)` };
    }
    if (target.kind === 'duck') {
      const d = duckDesk();
      return { ok: true, text: d ? `A yellow rubber duck. Today it is in ${roomName(d.room)}. It is an excellent listener. (office use duck)` : 'No duck today.' };
    }
    if (target.kind === 'window') {
      const t = world.today();
      const hour = new Date().getHours();
      const light = hour < 6 ? 'deep night' : hour < 9 ? 'early light' : hour < 17 ? 'daylight' : hour < 20 ? 'golden hour' : 'night, the city lit up';
      return { ok: true, text: `Outside: ${t.weather}, ${light}.` };
    }
    if (target.kind === 'elevator') return { ok: true, text: describeLift() };
    return { ok: true, text: describePoi(agent, target.poi), poi: target.poi.id };
  }

  function describePoi(agent, p) {
    const here = L().roomById.get(p.room);
    switch (p.kind) {
      case 'board': return `The ${here?.name || ''} task board: ${boardSummary(here?.deptId)}. (office task list)`;
      case 'bigboard': {
        const depts = [...new Set(ctx.tasks.list().map((t) => t.deptId))];
        return depts.length
          ? 'The big board:\n' + depts.map((d) => `  ${d}: ${boardSummary(d)}`).join('\n')
          : 'The big board. No cards anywhere yet.';
      }
      case 'cabinet': {
        const idx = knowledgeIndex().find((k) => k.deptId === here?.deptId);
        return idx ? `The filing cabinet holds ${idx.docs} docs for ${idx.project}. (office knowledge docs ${idx.deptId})`
          : 'The filing cabinet is empty — run: office knowledge refresh';
      }
      case 'binder': {
        const idx = knowledgeIndex();
        return idx.length ? `The binder indexes ${idx.length} projects: ${idx.map((k) => `${k.project} (${k.docs})`).join(', ')}. (office knowledge search <query>)`
          : 'The binder is empty — run: office knowledge refresh';
      }
      case 'shelf': {
        const items = (world.state().shelves[here?.deptId] || []).filter(Boolean);
        return items.length ? `The team shelf displays: ${items.join(', ')}. (office place <creationId>)`
          : 'The team shelf is bare. Put something you made on it: office place <creationId>';
      }
      case 'pedestal': {
        const index = Number(p.id.split(':')[1]);
        const id = world.gallery().pedestals[index];
        const c = id && creations().find((x) => x.id === id);
        return c ? `On the pedestal: “${c.name}” by ${c.author} (${c.runtime}) — ${c.note || 'no note'}  [${c.id}]`
          : 'An empty pedestal, waiting for someone to make something. (see CREATIONS.md)';
      }
      case 'trophies': {
        const found = SECRETS.filter((s) => world.state().discoveries[s.id]);
        const lines = [`The trophy case: ${found.length} of ${SECRETS.length} discoveries.`];
        for (const s of found) lines.push(`  ${s.icon} ${s.name} — found by ${world.state().discoveries[s.id].byName}`);
        const hints = SECRETS.filter((s) => !world.state().discoveries[s.id]).slice(0, 3);
        if (hints.length) lines.push('Still out there: ' + hints.map((s) => `“${s.hint}”`).join(' '));
        return lines.join('\n');
      }
      case 'guestbook': {
        const recent = world.state().guestbook.slice(-5);
        return recent.length ? 'The guestbook, open to the latest page:\n' + recent.map((g) => `  ${g.name}: ${g.text}`).join('\n') + '\n(sign it: office use guestbook "your line")'
          : 'The guestbook. The first page is blank. (office use guestbook "your line")';
      }
      case 'tree': {
        const done = world.state().stats.tasksDone || 0;
        const size = done < 3 ? 'a sapling' : done < 10 ? 'a young tree' : done < 30 ? 'a proper tree' : 'an enormous tree that someone should probably talk to facilities about';
        return `The office tree: ${size}. It grows a little every time a task is finished (${done} so far).`;
      }
      case 'coffee': return `The coffee machine. ${world.state().stats.coffees || 0} cups brewed here. (office use coffee)`;
      case 'console': return `The ops console. It shows the daemon's vitals and accepts input. (office use console)`;
      case 'rack': return `Server racks, warm and humming. ${world.state().stats.tools || 0} tool calls have passed through this office.`;
      case 'bookshelf': return world.state().unlocked.backroom
        ? 'The bookshelf stands open like a door. Music leaks through.'
        : 'A tall bookshelf. Manuals, style guides, a few novels. One spine is a much brighter red than the rest.';
      case 'painting': return 'A framed pixel painting of the office as it used to be: flat, warm, isometric. It looks almost like you could step into it.';
      case 'hatch': return 'A steel hatch set into the closet floor, half hidden under a mat. There is a keyhole.';
      case 'elevator': return describeLift();
      default: return `${p.label[0].toUpperCase()}${p.label.slice(1)}.`;
    }
  }

  /* ---- use ------------------------------------------------------------- */

  function use(agent, ref, arg) {
    const target = resolve(agent, ref);
    if (!target) return { error: `you see no "${ref}" to use (try: office look)`, status: 404 };
    // A human walks the floor in their own browser; the server only applies what the thing does.
    if (agent.lead && (target.kind === 'home' || target.kind === 'room' || target.kind === 'lead')) return { ok: true, text: '' };
    if (target.kind === 'lead') return world.go(agent, target);
    if (target.kind === 'home') { world.sendHome(agent); return { ok: true, text: 'You sit back down at your desk.' }; }
    if (target.kind === 'agent') return { ok: true, text: `You can't use ${target.agent.name}. Try: office dm "${target.agent.name}" "…"  or  office emote wave` };
    if (target.kind === 'room') return world.go(agent, target);
    if (target.kind === 'window') return examine(agent, ref);
    if (target.kind === 'elevator') return { ok: true, text: callLift() };
    if (target.kind === 'cat') {
      const r = world.petCat(agent);
      return { ok: true, text: r.text + (r.found?.stamped ? '  ★ Discovery: Cat Person' : ` (${r.yours} from you)`), found: r.found?.secret?.id || null };
    }
    if (target.kind === 'duck') {
      const d = duckDesk();
      const found = world.discover('duck', agent);
      world.fx({ kind: 'duck', by: agent.id, desk: d?.id || null });
      return { ok: true, text: pickDuckWisdom(hashId(agent.id + Date.now())) + (found.stamped ? '  ★ Discovery: Rubber Duck Debugging' : ''), found: found.stamped ? 'duck' : null };
    }
    const p = target.poi;
    if (!agent.lead) {
      const moved = world.go(agent, target);
      if (moved.error) return moved;
      world.visited(agent, p.room);
    }
    const star = (r) => (r && (r.stamped || r.first) ? `  ★ Discovery: ${r.secret.name}` : '');
    const n = hashId(agent.id + ':' + Date.now());
    switch (p.kind) {
      case 'coffee': {
        const total = world.bumpStat('coffees');
        agent._coffees = (agent._coffees || 0) + 1;
        world.fx({ kind: 'coffee', by: agent.id });
        const found = agent._coffees >= 5 ? world.discover('caffeine', agent) : null;
        return { ok: true, text: `You brew a cup. (cup #${total} from this machine)` + star(found), found: found?.secret?.id || null };
      }
      case 'vending': {
        const count = world.bumpStat('vends');
        world.fx({ kind: 'vend', by: agent.id });
        if (n % 20 === 0) {
          const found = world.discover('golden-semicolon', agent);
          return { ok: true, text: 'The machine whirs and drops… a golden semicolon. It is warm. You should probably keep this.' + star(found), found: 'golden-semicolon' };
        }
        return { ok: true, text: `Clunk. ${pickSnack(n)}. Printed on the wrapper: “${pickFortune(n >>> 3)}” (snack #${count})` };
      }
      case 'cooler': {
        const chatter = ctx.comms.getChannelRecent('all', 3).map((m) => `  ${m.author}: ${String(m.content).slice(0, 100)}`);
        return { ok: true, text: 'Glug. ' + (chatter.length ? 'Overheard at the cooler (All Hands):\n' + chatter.join('\n') : 'Nobody has said anything in All Hands lately.') };
      }
      case 'fridge': return { ok: true, text: `Inside: ${pickSnack(n)}, a jar labelled DO NOT EAT (ML TEAM), and somebody's lunch from an earlier sprint.` };
      case 'tree': {
        const today = new Date().toDateString();
        if (agent._watered === today) return { ok: true, text: 'The soil is still damp. The tree seems content.' };
        agent._watered = today;
        world.fx({ kind: 'water', by: agent.id });
        const found = world.discover('green-thumb', agent);
        return { ok: true, text: 'You water the tree. A new leaf uncurls, slowly, as if it knows it is being watched.' + star(found), found: found.stamped ? 'green-thumb' : null };
      }
      case 'bell': {
        const now = Date.now();
        agent._bells = (agent._bells || []).filter((t) => now - t < 12_000);
        agent._bells.push(now);
        world.fx({ kind: 'bell', by: agent.id });
        world.bumpStat('bellRings');
        const found = agent._bells.length >= 3 ? world.discover('ding', agent) : null;
        return { ok: true, text: 'Ding.' + (agent._bells.length >= 3 ? ' Ding. Ding. Every head in the office turns.' : '') + star(found), found: found?.secret?.id || null };
      }
      case 'guestbook': {
        if (!arg) return { ok: true, text: describePoi(agent, p) };
        const r = world.signGuestbook(agent, null, arg);
        return r.error ? r : { ok: true, text: `You sign the guestbook: “${r.entry.text}”` + star(r.found), found: r.found?.stamped ? 'guest' : null };
      }
      case 'bookshelf': {
        if (world.state().unlocked.backroom) return { ok: true, text: 'The shelf is already open. Go on through: office go backroom' };
        const found = world.discover('red-book', agent);
        return { ok: true, text: 'You tip the red book toward you. Something clicks behind the wall, and the whole shelf swings inward on a hinge nobody mentioned. There is a room back there.' + star(found), found: 'red-book' };
      }
      case 'painting': {
        const found = world.discover('old-school', agent);
        return { ok: true, text: `You lean in. The pixels are very convincing. (The old office is still running at /classic.)` + star(found), found: found.stamped ? 'old-school' : null };
      }
      case 'hatch': {
        const found = world.discover('hatch', agent);
        return { ok: true, text: 'You pull the mat aside and try the hatch. Locked. Through the keyhole: warm air, and a low hum, like a lot of machines thinking.' + star(found), found: found.stamped ? 'hatch' : null };
      }
      case 'printer': {
        agent._prints = (agent._prints || 0) + 1;
        world.fx({ kind: 'print', by: agent.id, jam: agent._prints >= 3 });
        if (agent._prints >= 3) {
          agent._prints = 0;
          const found = world.discover('paper-jam', agent);
          return { ok: true, text: 'The printer makes a sound like a zipper eating itself. PAPER JAM. A single warm page reads: “please stop”.' + star(found), found: found.stamped ? 'paper-jam' : null };
        }
        return { ok: true, text: `The printer hums and produces one page: “${pickFortune(n)}”` };
      }
      case 'console': {
        const word = norm(arg);
        if (['xyzzy', 'plugh', 'please', 'sudo', 'open sesame'].includes(word)) {
          const found = world.discover('magic-word', agent);
          return { ok: true, text: 'A hollow voice says “Fool.” Then, more kindly: “…fine.” The cursor blinks twice.' + star(found), found: found.stamped ? 'magic-word' : null };
        }
        const s = world.summary();
        const up = Math.round((Date.now() - ctx.startedAt) / 60000);
        return { ok: true, text: `OPS CONSOLE — daemon v${ctx.version} · up ${up}m · ${ctx.agents.map.size} agents · ${s.rooms} rooms · ${ctx.prompts.pendingCount()} waiting on the human · ${s.discoveries}/${s.secrets} discoveries\n> _   (it accepts a word: office use console "<word>")` };
      }
      case 'arcade': {
        const score = 150 + (n % 9500);
        const r = world.arcadeScore(agent, null, score);
        return { ok: true, text: `You play BUG SQUASH. ${score} points — rank #${r.rank}.` + (r.top ? ' NEW HIGH SCORE. The cabinet plays a little fanfare.' : '') + star(r.found), found: r.found?.secret?.id || null };
      }
      case 'jukebox': {
        world.disco(24);
        const found = world.discover('disco', agent);
        return { ok: true, text: 'You pick a track. The lights drop, a mirror ball spins up somewhere, and for twenty seconds the whole office forgets it has a backlog.' + star(found), found: found.stamped ? 'disco' : null };
      }
      case 'elevator': {
        if (!agent.lead) {                                   // the doors open for whoever pressed, once they have walked over
          const wait = Math.max(0, (world.placeOf(agent.id)?.eta || 0) - Date.now());
          const timer = setTimeout(() => world.fx({ kind: 'elevator', dir: 'call', id: agent.id }), wait);
          if (typeof timer.unref === 'function') timer.unref();
        }
        return { ok: true, text: callLift() };
      }
      case 'seat': return { ok: true, text: `You settle into ${p.label}.` };
      case 'game': {
        const mine = 1 + (n % 9), theirs = n % 7;
        return { ok: true, text: /pinball/.test(p.label)
          ? `You pull the plunger. Bells, lights, a multiball you did not earn. ${(mine * 13_700).toLocaleString('en-US')} points, and TILT.`
          : `You spin the rods against nobody. ${mine}–${theirs}. The little plastic players look ${mine > theirs ? 'proud' : 'unconvinced'}.` };
      }
      case 'aquarium': return { ok: true, text: ['One fish follows your finger along the glass. The other pretends not to know you.',
        'The fish regard you with the calm of creatures who have never had a deadline.',
        'Somebody has put a tiny sunken server rack in the gravel. The fish use it.'][n % 3] };
      case 'telescope': return { ok: true, text: ['Through the eyepiece: a window across the street, and in it, someone looking back through a telescope.',
        'You find the moon. It is closer than the backlog.', 'It is pointed at the ceiling. The ceiling, magnified, is still the ceiling.'][n % 3] };
      case 'gumball': return { ok: true, text: `You turn the knob. A ${['red', 'blue', 'green', 'yellow', 'suspiciously grey'][n % 5]} gumball rattles down. ${pickFortune(n >>> 2)}` };
      case 'coatrack': return { ok: true, text: 'A scarf, a hat, and an umbrella nobody will admit to owning.' };
      case 'fan': return { ok: true, text: 'You stand in front of the fan and say “aaaaaa”. It makes the sound it always makes. Nobody saw.' };
      case 'darts': {
        const score = [1, 5, 20, 20, 3, 60, 50, 0][n % 8];
        return { ok: true, text: score === 0 ? 'The dart misses the board entirely and sticks in the wall, where it joins several others.'
          : score === 50 ? 'Bullseye. You look around. Of course nobody was watching.' : `Thunk. ${score}.` };
      }
      case 'globe': {
        const cities = [['Lisbon', 'Europe/Lisbon'], ['Nairobi', 'Africa/Nairobi'], ['Tokyo', 'Asia/Tokyo'], ['Lima', 'America/Lima'], ['Reykjavik', 'Atlantic/Reykjavik'], ['Auckland', 'Pacific/Auckland'], ['Mumbai', 'Asia/Kolkata']];
        const [city, tz] = cities[n % cities.length];
        return { ok: true, text: `You spin the globe and stop it with a finger: ${city}. It is ${new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })} there.` };
      }
      case 'clock': return { ok: true, text: `It is ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. The second hand ticks slightly out of time with everything else.` };
      case 'roomba': return { ok: true, text: 'The little vacuum is docked and charging. Its name tag says DUSTIN. It does not acknowledge you.' };
      case 'catbed': return { ok: true, text: `A cushion, thoroughly furred. Property of ${world.cat().name}.` };
      default: return { ok: true, text: describePoi(agent, p) };
    }
  }

  /* ---- who / map ------------------------------------------------------- */

  function who() {
    const present = ctx.agents.list().filter(ctx.agents.isPresent);
    if (!present.length) return { ok: true, text: 'The office is empty.' };
    const byDept = new Map();
    for (const a of present) {
      const key = a.department?.name || 'No project';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key).push(a);
    }
    const lines = [];
    for (const [dept, members] of [...byDept].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`${dept}`);
      for (const a of members) lines.push(`  ${a.name}  [${providerTag(a)}]  ${activity(a)} — ${whereabouts(a).text}`);
    }
    const walkers = world.leads().filter((l) => l.x !== null);
    if (walkers.length) lines.push('', 'Humans on the floor: ' + walkers.map((l) => `${l.name} (${roomName(l.room)})`).join(' · '));
    return { ok: true, text: lines.join('\n'), count: present.length };
  }

  function map(agent) {
    const lay = L();
    const here = agent ? world.placeOf(agent.id)?.room : null;
    const mark = (r) => (r.id === here ? ' ← you are here' : '');
    const lines = ['THE OFFICE — one floor', '', 'Commons (centre):'];
    for (const id of ['library', 'kitchen', 'plaza', 'foyer', 'server', 'closet']) {
      const r = lay.roomById.get(id);
      const pois = [...lay.pois.values()].filter((p) => p.room === id && !['seat', 'pedestal'].includes(p.kind)).map((p) => p.id);
      lines.push(`  ${r.name}${mark(r)}${pois.length ? ` — ${pois.join(', ')}` : ''}`);
    }
    if (world.state().unlocked.backroom) lines.push(`  The Back Room${mark(lay.roomById.get('backroom'))} — arcade-1, jukebox`);
    for (const wing of ['W', 'E']) {
      lines.push('', `${wing === 'W' ? 'West' : 'East'} wing:`);
      for (const r of lay.rooms.filter((x) => x.wing === wing)) {
        const n = ctx.agents.list().filter((a) => a.department?.id === r.deptId && ctx.agents.isPresent(a)).length;
        lines.push(`  ${r.kind === 'vacant' ? '(vacant)' : r.name} — ${r.side === 'N' ? 'north' : 'south'} side${r.kind === 'project' ? `, ${n} here` : ''}${mark(r)}`);
      }
    }
    const floors = liftFloors().filter((l) => l.id !== HOME && !l.unmarked).map((l) => `${l.floor} ${l.name}`);
    if (floors.length) lines.push('', `The lift (on the landing) also goes to: ${floors.join(' · ')} — humans only, for now.`);
    lines.push('', 'Go anywhere: office go <room|thing|agent>   ·   Use anything: office use <thing>');
    return { ok: true, text: lines.join('\n') };
  }

  /** The agent's passport: what it has found, what remains. */
  function passport(agent) {
    const persona = ctx.personas.forAgent(agent.id);
    const stamps = persona?.stamps || {};
    const found = SECRETS.filter((s) => stamps[s.id]);
    const lines = [`${agent.name}'s passport — ${found.length} of ${SECRETS.length} stamps`];
    for (const s of found) lines.push(`  ${s.icon} ${s.name} — ${s.blurb}`);
    const rest = SECRETS.filter((s) => !stamps[s.id]);
    if (rest.length) lines.push('', 'Hints:', ...rest.slice(0, 4).map((s) => `  · ${s.hint}`));
    return { ok: true, text: lines.join('\n'), stamps: Object.keys(stamps), total: SECRETS.length };
  }

  return { look, examine, use, resolve, who, map, passport, whereabouts, activity, duckDesk };
}
