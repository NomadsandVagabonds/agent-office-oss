// The Office — the wire. One WebSocket to the daemon, a small store of what it
// has told us, and plain events for the rest of the client to listen to.
// Reconnects by itself; everything the daemon sends on connect is a full
// picture, so a reconnect simply replaces what we knew.
import { EV } from '/core/contract.mjs';

export function createNet() {
  const handlers = new Map();
  const state = {
    connected: false, everConnected: false,
    agents: new Map(),            // id → Session
    prompts: [],                  // pending "needs you" requests
    tasks: new Map(),             // deptId → Task[]
    world: null,                  // WorldSnapshot
    places: new Map(),            // agent id → Placement
    overview: null, board: [], collab: [], activity: [],
    usage: null,                  // how much each provider has left (UsageSnapshot)
    server: null,
    skew: 0,                      // server clock − ours, ms
  };
  let ws = null, retry = 0, pingTimer = null;

  const emit = (type, ...args) => { for (const fn of handlers.get(type) || []) { try { fn(...args); } catch (err) { console.error(`[net] ${type} handler`, err); } } };
  const on = (type, fn) => { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); return () => handlers.get(type).delete(fn); };

  function receive(m) {
    switch (m.type) {
      case EV.SNAPSHOT:
        state.agents = new Map((m.agents || []).map((a) => [a.id, a]));
        state.prompts = m.prompts || [];
        state.board = m.boardRecent || []; state.collab = m.collabRecent || [];
        state.overview = m.commsOverview || null; state.server = m.server || null;
        emit('snapshot', state);
        emit('prompts', state.prompts);
        break;
      case EV.UPDATE: {
        const prev = state.agents.get(m.agent.id) || null;
        state.agents.set(m.agent.id, m.agent);
        emit('agent', m.agent, prev);
        break;
      }
      case EV.REMOVE: {
        const prev = state.agents.get(m.id) || null;
        state.agents.delete(m.id); state.places.delete(m.id);
        emit('remove', m.id, prev);
        break;
      }
      case EV.PROMPTS: state.prompts = m.prompts || []; emit('prompts', state.prompts); break;
      case EV.TASKS: state.tasks.set(m.deptId, m.tasks || []); emit('tasks', m.deptId, m.tasks || []); break;
      case EV.BBS: state.board = m.posts || []; emit('board', state.board); break;
      case EV.COLLAB: state.collab = m.posts || []; emit('collab', state.collab); break;
      case EV.COMMS_OVERVIEW: state.overview = m.overview; emit('overview', m.overview); break;
      case EV.WORLD:
        state.world = m.world;
        state.skew = (m.world.serverTime || Date.now()) - Date.now();
        state.places = new Map((m.world.places || []).map((p) => [p.id, p]));
        emit('world', m.world);
        break;
      case EV.WORLD_AGENT: state.places.set(m.id, m.place); emit('place', m.id, m.place); break;
      case EV.WORLD_FX: emit('fx', m.fx); break;
      case EV.WORLD_OBJECT: emit('object', m.object); break;
      case EV.DISCOVERY: emit('discovery', m); break;
      case EV.ACTIVITY: state.activity.push(m.item); if (state.activity.length > 200) state.activity.shift(); emit('activity', m.item); break;
      case EV.SUBAGENT: emit('subagent', m); break;
      case EV.RUNTIMES: emit('runtimes', m.runtimes); break;
      case EV.USAGE: state.usage = m.usage; emit('usage', m.usage); break;
      default: emit(m.type, m);
    }
  }

  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => {
      retry = 0; state.connected = true; state.everConnected = true; emit('status', true);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ type: 'ping' }), 25000);
    };
    ws.onclose = () => {
      if (state.connected) { state.connected = false; emit('status', false); }
      clearInterval(pingTimer);
      setTimeout(connect, Math.min(5000, 400 * ++retry));
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.type) receive(m); };
  }
  const send = (message) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(message)); };

  /** Call the daemon's HTTP API. Resolves to the parsed body; throws on HTTP errors. */
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
    return data;
  }

  return { state, on, connect, send, api, now: () => Date.now() + state.skew };
}
