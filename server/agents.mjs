// The Office — session registry. Turns hook events (and self-reports from any
// runtime) into live agent state, and projects each agent to the public
// `Session` shape in core/contract.mjs.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { classifyBlock, normalizeProvider } from '../core/contract.mjs';
import { resolveLook, resolveDeskItems } from '../core/look.mjs';
import { codename } from './profiles.mjs';

const DESKS = 12;
const SETTLE_MS = 1400;        // working/done eases back to "thinking" after this
const LEAVE_MS = 1100;         // 'leaving' is visible this long before 'remove'
const TRANSCRIPT_EVERY_MS = 3000;
const SUBAGENT_TOOLS = new Set(['Task', 'Agent']);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function modelWindow(model = '') {
  const m = model.toLowerCase();
  if (m.includes('1m') || m.includes('[1m]')) return 1_000_000;
  return 200_000;
}

// Pull model + context usage from the tail of a Claude Code transcript JSONL.
function readTranscriptStats(transcriptPath) {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const { size } = fs.fstatSync(fd);
      const len = Math.min(size, 96 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      const lines = buf.toString('utf8').split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        let o;
        try { o = JSON.parse(lines[i]); } catch { continue; }
        const msg = o.message || o;
        const u = msg && msg.usage;
        if (msg && msg.model && u) {
          const used = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0)
            + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);
          return {
            model: msg.model,
            contextPct: Math.min(100, Math.round((used / modelWindow(msg.model)) * 100)),
            tokens: used,
          };
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch { /* transcript not readable yet — fine */ }
  return null;
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function createAgents(ctx) {
  const { cfg, bus, profiles, personas, runtimeView } = ctx;
  /** session id -> agent */
  const agents = new Map();
  const deskTaken = new Array(DESKS).fill(null);

  function assignDesk(id) {
    let i = deskTaken.indexOf(null);
    if (i === -1) i = Math.floor(Math.random() * DESKS);   // fallback: double up
    deskTaken[i] = id;
    return i;
  }
  function freeDesk(id) {
    const i = deskTaken.indexOf(id);
    if (i !== -1) deskTaken[i] = null;
  }

  // Public projection — never serialize internal fields (timers are circular).
  function pub(a) {
    const runtime = runtimeView.summaryForAgent(a);
    return {
      id: a.id, short: a.short, name: a.name, model: a.model,
      contextPct: a.contextPct, status: a.status, tool: a.tool,
      cwd: a.cwd, desk: a.desk, since: a.since, note: a.note,
      runtimeSessionId: a.runtimeSessionId || runtime.sessionId || null,
      provider: runtime.provider || a.provider || null,
      runtime,
      profile: a.profile || null, department: a.department || null,
      task: a.task || '',
      // additive facets (the 2D classic client ignores these)
      turn: a.turn || 'active',
      blockKind: a.status === 'blocked' ? (a.blockKind || 'question') : null,
      persona: a.persona || null,
      subagents: a.subagents || 0,
      toolCount: a.toolCount || 0,
      joinedAt: a.joinedAt,
      lastSeen: a.lastSeen,
      selfReported: !!a.selfReported,
    };
  }

  function refreshIdentity(a) {
    const prof = profiles.resolve(a.id, a.cwd);
    a.department = profiles.department(a.cwd);
    a.task = prof.task || a.selfTask || '';
    const persona = personas.link(a, { handle: a.handle });
    const seed = persona ? persona.key : a.id;
    a.persona = persona ? persona.key : null;
    a.name = prof.name || persona?.name || a.selfName || codename(seed);
    const character = resolveLook(seed, { ...(persona?.look || {}), ...(prof.character || {}) });
    const desk = { ...(persona?.desk || {}), ...(prof.desk || {}) };
    desk.items = resolveDeskItems(seed, prof.desk?.items?.length ? prof.desk.items : persona?.desk?.items);
    a.profile = { character, desk, card: prof.card || persona?.card || null };
  }

  function touch(id, patch = {}, opt = {}) {
    let a = agents.get(id);
    const now = Date.now();
    const isNew = !a;
    if (!a) {
      a = {
        id,
        short: id.slice(0, 8),
        name: codename(id),
        model: '',
        provider: '',
        contextPct: 0,
        status: 'arriving',
        turn: 'idle',
        tool: '',
        cwd: '',
        desk: assignDesk(id),
        since: now,
        joinedAt: now,
        subagents: 0,
        toolCount: 0,
      };
      agents.set(id, a);
    }
    const prevStatus = a.status;
    const nextStatus = hasOwn(patch, 'status') && patch.status ? patch.status : a.status;
    const statusChanged = !!(nextStatus && nextStatus !== a.status);
    Object.assign(a, patch, { lastSeen: now });
    if (!a.since || statusChanged) a.since = now;
    refreshIdentity(a);
    bus.broadcast({ type: 'update', agent: pub(a) });
    if (isNew) bus.local({ type: 'agent:join', agent: a, restored: !!opt.restored });
    if (statusChanged) bus.local({ type: 'agent:status', agent: a, from: prevStatus, to: a.status });
    return a;
  }

  /* ---- surviving a daemon restart -------------------------------------- */
  // Sessions outlive the daemon. Without this, a restart (or a watchdog
  // respawn) would empty the office until each session happened to speak.

  function exportState() {
    return [...agents.values()].filter((a) => !a._leaving).map((a) => ({
      id: a.id, cwd: a.cwd, model: a.model, provider: a.provider, handle: a.handle || null,
      selfName: a.selfName || null, selfTask: a.selfTask || null, selfReported: !!a.selfReported,
      status: a.status, turn: a.turn, blockKind: a.blockKind || null, note: a.note || '',
      contextPct: a.contextPct || 0, runtimeSessionId: a.runtimeSessionId || null,
      toolCount: a.toolCount || 0, joinedAt: a.joinedAt, since: a.since, lastSeen: a.lastSeen,
    }));
  }

  function restore(records) {
    const now = Date.now();
    let count = 0;
    for (const r of Array.isArray(records) ? records : []) {
      if (!r || typeof r.id !== 'string' || agents.has(r.id)) continue;
      if (now - (r.lastSeen || 0) > cfg.staleAgentMs) continue;      // long gone
      // Transient states do not survive: whatever it was doing, it is now "there".
      const status = r.status === 'blocked' ? 'blocked' : 'thinking';
      const a = touch(r.id, {
        cwd: r.cwd || '', model: r.model || '', provider: r.provider || '',
        handle: r.handle || undefined, selfName: r.selfName || undefined, selfTask: r.selfTask || undefined,
        selfReported: !!r.selfReported, status, turn: r.turn === 'active' ? 'active' : 'idle',
        blockKind: r.blockKind || null, note: r.note || '', contextPct: r.contextPct || 0,
        runtimeSessionId: r.runtimeSessionId || null, toolCount: r.toolCount || 0,
      }, { restored: true });
      a.joinedAt = r.joinedAt || a.joinedAt;
      a.since = r.since || a.since;
      a.lastSeen = r.lastSeen || a.lastSeen;
      count += 1;
    }
    return count;
  }

  /** Re-resolve identity (profile/persona changed) and tell everyone. */
  function refresh(id) {
    const a = agents.get(id);
    if (!a) return null;
    refreshIdentity(a);
    bus.broadcast({ type: 'update', agent: pub(a) });
    return a;
  }

  /** Any sign of life keeps a self-reporting agent from being swept. */
  function seen(id) {
    const a = agents.get(id);
    if (a) a.lastSeen = Date.now();
    return a || null;
  }

  function scheduleSettle(id) {
    const a = agents.get(id);
    if (!a) return;
    clearTimeout(a._settle);
    a._settle = setTimeout(() => {
      const cur = agents.get(id);
      if (cur && (cur.status === 'working' || cur.status === 'done')) {
        const from = cur.status;
        cur.status = 'thinking';
        cur.since = Date.now();
        bus.broadcast({ type: 'update', agent: pub(cur) });
        bus.local({ type: 'agent:status', agent: cur, from, to: 'thinking' });
      }
    }, SETTLE_MS);
    if (typeof a._settle.unref === 'function') a._settle.unref();
  }

  function remove(id) {
    const a = agents.get(id);
    if (!a || a._leaving) return;
    a._leaving = true;
    clearTimeout(a._settle);
    const from = a.status;
    a.status = 'leaving';
    a.since = Date.now();
    bus.local({ type: 'agent:leave', agent: a });
    bus.broadcast({ type: 'update', agent: pub(a) });
    bus.local({ type: 'agent:status', agent: a, from, to: 'leaving' });
    const t = setTimeout(() => {
      freeDesk(id);
      agents.delete(id);
      personas.release(id);
      bus.broadcast({ type: 'remove', id });
    }, LEAVE_MS);
    if (typeof t.unref === 'function') t.unref();
  }

  function resolveRef(ref) {
    if (!ref) return null;
    if (agents.has(ref)) return agents.get(ref);
    const needle = String(ref).trim().toLowerCase();
    if (!needle) return null;
    const all = [...agents.values()];
    const exact = all.filter((a) =>
      [a.id, a.short, a.name, a.handle].some((value) => (value || '').toLowerCase() === needle));
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    // Forgiving, but only when unambiguous: "amber" → "Amber Lynx".
    const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const n = squash(needle);
    if (n.length < 3) return null;
    const loose = all.filter((a) => squash(a.name) === n || squash(a.name).startsWith(n)
      || (a.id.length > 8 && a.id.toLowerCase().startsWith(needle)));
    return loose.length === 1 ? loose[0] : null;
  }

  // Hook event → state. Claude Code posts these natively; every other runtime
  // posts the same vocabulary through the office helpers.
  function handleHook(ev) {
    const id = ev.session_id || ev.sessionId;
    if (!id || typeof id !== 'string') return null;
    const name = ev.hook_event_name || ev.event;
    const known = agents.get(id);
    const base = {};
    if (ev.cwd) base.cwd = String(ev.cwd);
    if (ev.model) base.model = cleanText(ev.model, 80);
    if (ev.provider) base.provider = normalizeProvider(ev.provider);
    else if (!known?.provider && ev.transcript_path) base.provider = 'claude';
    if (ev.handle) base.handle = cleanText(ev.handle, 40);
    if (typeof ev.contextPct === 'number') base.contextPct = Math.max(0, Math.min(100, ev.contextPct));
    if (hasOwn(ev, 'note')) base.note = cleanText(ev.note, 400);
    if (hasOwn(ev, 'runtime_session_id') || hasOwn(ev, 'runtimeSessionId')) {
      const runtimeSessionId = ev.runtime_session_id ?? ev.runtimeSessionId ?? '';
      base.runtimeSessionId = runtimeSessionId ? String(runtimeSessionId) : null;
    }
    if (ev.transcript_path) {
      const now = Date.now();
      if (!known || now - (known._statsAt || 0) > TRANSCRIPT_EVERY_MS) {
        const st = readTranscriptStats(ev.transcript_path);
        if (st) { base.model = st.model; base.contextPct = st.contextPct; }
        base._statsAt = now;
      }
    }
    bus.local({ type: 'hook', name, id, ev });

    switch (name) {
      case 'SessionStart': {
        touch(id, { ...base, status: 'arriving', tool: '', turn: 'idle' });
        const t = setTimeout(() => {
          if (agents.get(id)?.status === 'arriving') touch(id, { status: 'thinking' });
        }, 1500);
        if (typeof t.unref === 'function') t.unref();
        break;
      }
      case 'UserPromptSubmit':
        // Tell listeners first so "the human replied" wins over the generic
        // "agent resumed" resolution that the status change would trigger.
        bus.local({ type: 'agent:prompted', id });
        touch(id, { ...base, status: 'thinking', tool: '', turn: 'active', subagents: 0, blockKind: null });
        break;
      case 'PreToolUse': {
        const tool = cleanText(ev.tool_name, 60);
        const cur = agents.get(id);
        touch(id, {
          ...base, status: 'working', tool, turn: 'active', blockKind: null,
          toolCount: (cur?.toolCount || 0) + 1,
          subagents: (cur?.subagents || 0) + (SUBAGENT_TOOLS.has(tool) ? 1 : 0),
        });
        scheduleSettle(id);
        break;
      }
      case 'PostToolUse':
        touch(id, { ...base, status: 'working', tool: cleanText(ev.tool_name, 60), turn: 'active', blockKind: null });
        scheduleSettle(id);
        break;
      case 'Notification': {
        const message = cleanText(ev.message, 600) || 'needs you';
        const blockKind = classifyBlock(message);
        touch(id, { ...base, status: 'blocked', tool: '', note: message, blockKind,
          turn: blockKind === 'idle' ? 'idle' : (agents.get(id)?.turn || 'active') });
        bus.local({ type: 'agent:blocked', id, message: cleanText(ev.message, 600) || 'needs input', kind: blockKind });
        break;
      }
      case 'Stop':
        touch(id, { ...base, status: 'done', tool: '', turn: 'idle', subagents: 0 });
        scheduleSettle(id);
        break;
      case 'SubagentStop': {
        const a = agents.get(id);
        if (a) {
          a.subagents = Math.max(0, (a.subagents || 0) - 1);
          a.lastSeen = Date.now();
          bus.broadcast({ type: 'subagent', id, name: a.name });
          bus.broadcast({ type: 'update', agent: pub(a) });
        }
        break;
      }
      case 'SessionEnd':
        bus.local({ type: 'agent:ended', id });
        remove(id);
        break;
      default:
        touch(id, base);
    }
    return agents.get(id) || null;
  }

  /**
   * The front door for any runtime that is not Claude Code: announce yourself,
   * get a desk. Idempotent — joining again just refreshes your details.
   */
  function join(body = {}) {
    const requested = cleanText(body.id || body.sessionId || body.session_id, 80);
    const id = requested || `a_${crypto.randomBytes(6).toString('hex')}`;
    const existed = agents.has(id);
    const patch = {
      selfReported: true,
      provider: normalizeProvider(body.provider) || agents.get(id)?.provider || 'custom',
    };
    if (body.cwd) patch.cwd = String(body.cwd);
    if (body.model) patch.model = cleanText(body.model, 80);
    if (body.handle) patch.handle = cleanText(body.handle, 40);
    if (body.name) patch.selfName = cleanText(body.name, 32);
    if (body.task) patch.selfTask = cleanText(body.task, 140);
    if (hasOwn(body, 'runtimeSessionId')) patch.runtimeSessionId = body.runtimeSessionId || null;
    if (!existed) { patch.status = 'arriving'; patch.turn = 'idle'; }
    const a = touch(id, patch);
    if (!existed) {
      const t = setTimeout(() => {
        if (agents.get(id)?.status === 'arriving') touch(id, { status: 'thinking' });
      }, 1500);
      if (typeof t.unref === 'function') t.unref();
    }
    return { agent: a, created: !existed };
  }

  function sweep() {
    const now = Date.now();
    for (const [id, a] of agents) {
      if (now - (a.lastSeen || 0) > cfg.staleAgentMs) {
        bus.local({ type: 'agent:ended', id, stale: true });
        remove(id);
      }
    }
  }

  const isPresent = (agent) => !!agent && agent.status !== 'leaving';

  return {
    map: agents,
    get: (id) => agents.get(id) || null,
    list: () => [...agents.values()],
    listPublic: () => [...agents.values()].map(pub),
    pub, touch, refresh, seen, remove, resolveRef, handleHook, join, sweep, isPresent,
    exportState, restore,
  };
}
