#!/usr/bin/env node
// Codex Session Observatory — gives real Codex threads a desk by reading the
// local rollout JSONL that Codex already writes under ~/.codex/sessions.
//
// Same discipline as observe.mjs:
// - zero daemon edits required
// - observe-only, never control
// - writes a compact read-only feed to public/transcripts/<sid>.json
// - POSTs the daemon's existing hook events so the office can animate state
//
//   node observe-codex.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TDIR = path.join(HERE, 'public', 'transcripts');
const INBOX_DIR = path.join(HERE, 'data', 'codex-inbox');
const GLOBAL_PROFILES = path.join(os.homedir(), '.claude', 'agent-office', 'profiles.json');
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
try { fs.mkdirSync(TDIR, { recursive: true }); } catch {}
try { fs.mkdirSync(INBOX_DIR, { recursive: true }); } catch {}

const PORT = process.env.OFFICE_PORT || 4317;
const DB = path.join(os.homedir(), '.codex', 'state_5.sqlite');
const ACTIVE_MS = 15 * 60 * 1000;
const QUIET_KEEPALIVE_MS = 2 * 60 * 60 * 1000;
const FRESH_MS = 25 * 1000;
const HEARTBEAT_MS = 10 * 60 * 1000;
const TICK = 5000;
const FEED_TURNS = 140;
const FEED_CHARS = 1800;
const TAIL_BYTES = 768 * 1024;
const OFFICE_RECENT_LIMIT = 20;
const OFFICE_ALERT_MS = 2 * 60 * 1000;

const post = async (body) => {
  try {
    requestJson(`http://127.0.0.1:${PORT}/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    return true;
  } catch {
    return false;
  }
};

const seen = new Map(); // sessionId -> { gone:boolean, stamp:string, touchAt:number }
const officeTrail = new Map(); // sessionId -> [{ t, where, who, text }]
const officeAlert = new Map(); // sessionId -> { until:number, count:number }
let officeApiWarnAt = 0;

function sqliteJson(sql) {
  try {
    const out = cp.execFileSync('sqlite3', [DB, sql], { encoding: 'utf8' }).trim();
    return out ? JSON.parse(out) : [];
  } catch {
    return [];
  }
}

function listThreads() {
  const sql = `
    SELECT json_group_array(json_object(
      'id', id,
      'rollout_path', rollout_path,
      'updated_at_ms', COALESCE(updated_at_ms, updated_at * 1000),
      'cwd', cwd,
      'model', COALESCE(model, ''),
      'title', title,
      'preview', COALESCE(preview, '')
    ))
    FROM (
      SELECT id, rollout_path, updated_at_ms, updated_at, cwd, model, title, preview
      FROM threads
      WHERE archived = 0
        AND rollout_path <> ''
      ORDER BY updated_at_ms DESC
    );
  `;
  const rows = sqliteJson(sql);
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

function tailLines(file, bytes = TAIL_BYTES) {
  try {
    const fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function tidy(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, FEED_CHARS);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { bySession: {}, byCwd: {} }; }
}

function loadProfiles() {
  const global = readJson(GLOBAL_PROFILES);
  const local = readJson(LOCAL_PROFILES);
  return {
    bySession: { ...(global.bySession || {}), ...(local.bySession || {}) },
    byCwd: { ...(global.byCwd || {}), ...(local.byCwd || {}) },
  };
}

function profileNameFor(sid, cwd = '') {
  const profiles = loadProfiles();
  const prof = { ...(cwd && profiles.byCwd[cwd]), ...(sid && profiles.bySession[sid]) };
  return prof.name || null;
}

function appendTurn(turns, role, text) {
  const x = tidy(text);
  if (!x || x.startsWith('<')) return;
  const last = turns[turns.length - 1];
  if (last && last.r === role && last.x === x) return;
  turns.push({ r: role, x });
}

function officeJson(pathname) {
  try {
    return requestJson(`http://127.0.0.1:${PORT}${pathname}`);
  } catch (error) {
    const now = Date.now();
    if (now - officeApiWarnAt > 30_000) {
      officeApiWarnAt = now;
      console.warn(`observe-codex: Office API unavailable at ${pathname} (${error.message || error})`);
    }
    return null;
  }
}

function inboxStatePath(sid) {
  return path.join(INBOX_DIR, `.seen-${sid}.json`);
}

function inboxMirrorPath(sid) {
  return path.join(INBOX_DIR, `${sid}.md`);
}

function readInboxState(sid) {
  try {
    return JSON.parse(fs.readFileSync(inboxStatePath(sid), 'utf8'));
  } catch {
    return { lastTs: 0 };
  }
}

function writeInboxState(sid, lastTs) {
  try {
    fs.writeFileSync(inboxStatePath(sid), JSON.stringify({ lastTs }));
  } catch {}
}

function officeTime(ts) {
  return new Date(ts).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function resolveSelfName(channels, sid, cwd = '') {
  for (const channel of channels || []) {
    const idx = (channel.memberIds || []).indexOf(sid);
    if (idx >= 0 && channel.memberNames && channel.memberNames[idx]) return channel.memberNames[idx];
  }
  return profileNameFor(sid, cwd);
}

function collectOfficeMail(channels, recentChannels, recentCollab, sid, selfName) {
  const mine = (channels || []).filter((c) =>
    c.kind === 'project' && Array.isArray(c.memberIds) && c.memberIds.includes(sid));
  const mineIds = new Set(mine.map((c) => c.id));
  const msgs = [];
  for (const m of recentChannels || []) {
    if (!mineIds.has(m.channelId)) continue;
    if (m.authorType === 'system') continue;
    if (m.authorSessionId === sid || m.authorAgentId === sid) continue;
    if (selfName && m.author === selfName) continue;
    msgs.push({
      t: m.timestamp || 0,
      where: '#' + (m.channelName || m.channelId || 'channel'),
      who: m.author || 'Lead',
      text: m.content || '',
    });
  }
  for (const m of recentCollab || []) {
    if (m.toAgentId !== sid) continue;
    msgs.push({
      t: m.timestamp || 0,
      where: 'DM · ' + (m.subject || 'direct'),
      who: m.author || '?',
      text: m.content || '',
    });
  }
  msgs.sort((a, b) => a.t - b.t);
  return msgs;
}

function rememberOfficeMail(sid, msgs) {
  const state = readInboxState(sid);
  const fresh = msgs.filter((m) => m.t > (state.lastTs || 0));
  if (msgs.length) writeInboxState(sid, msgs[msgs.length - 1].t);
  const prior = officeTrail.get(sid) || [];
  const merged = prior.slice();
  for (const msg of fresh) {
    merged.push(msg);
  }
  const deduped = [];
  const seenKeys = new Set();
  for (const msg of merged.slice(-12)) {
    const key = `${msg.t}|${msg.who}|${msg.where}|${msg.text}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(msg);
  }
  officeTrail.set(sid, deduped.slice(-8));
  return { fresh, trail: officeTrail.get(sid) || [] };
}

function writeInboxMirror(sid, name, msgs) {
  const title = name || sid.slice(0, 8);
  const body = msgs.length
    ? msgs.slice(-25).map((m) =>
      `**${officeTime(m.t)} · ${m.where} · ${m.who}**\n\n${m.text}\n`).join('\n---\n\n')
    : '_(empty)_';
  try {
    fs.writeFileSync(inboxMirrorPath(sid),
      `# Office inbox — ${title}\n\n_${new Date().toISOString()}_\n\n${body}\n`);
  } catch {}
}

function readRollout(lines) {
  const turns = [];
  const pending = new Map();
  let latestTs = 0;
  let latestKind = 'thinking';
  let latestTool = '';
  let contextPct = 0;
  let contextWindow = 0;

  for (const line of lines) {
    let event;
    try { event = JSON.parse(line); }
    catch { continue; }
    const ts = Date.parse(event.timestamp || '') || 0;
    if (ts) latestTs = Math.max(latestTs, ts);

    if (event.type === 'event_msg') {
      const payload = event.payload || {};
      if (payload.type === 'user_message') {
        appendTurn(turns, 'u', payload.message);
        latestKind = 'thinking';
      } else if (payload.type === 'agent_message') {
        appendTurn(turns, 'a', payload.message);
        latestKind = 'thinking';
      } else if (payload.type === 'task_started') {
        latestKind = 'thinking';
      } else if (payload.type === 'task_complete') {
        appendTurn(turns, 'a', payload.last_agent_message);
        latestKind = 'done';
      } else if (payload.type === 'token_count') {
        const info = payload.info || {};
        const usage = info.total_token_usage || {};
        const total = Number(usage.total_tokens) || 0;
        const window = Number(info.model_context_window) || 0;
        if (total && window) {
          contextWindow = window;
          contextPct = Math.min(100, Math.round((total / window) * 100));
        }
      }
      continue;
    }

    if (event.type !== 'response_item') continue;
    const payload = event.payload || {};
    const type = payload.type || '';
    if (type === 'function_call' || type === 'custom_tool_call'
      || type === 'web_search_call' || type === 'tool_search_call') {
      let name = payload.name || '';
      if (!name && type === 'web_search_call') name = 'web search';
      if (!name && type === 'tool_search_call') name = 'tool search';
      name = tidy(name || 'tool');
      appendTurn(turns, 't', '↳ ' + name);
      if (payload.call_id) pending.set(payload.call_id, name);
      latestKind = 'working';
      latestTool = name;
      continue;
    }
    if (type === 'function_call_output' || type === 'custom_tool_call_output'
      || type === 'tool_search_output') {
      if (payload.call_id) pending.delete(payload.call_id);
      continue;
    }
  }

  const activeTool = pending.size ? [...pending.values()][pending.size - 1] : latestTool;
  return {
    turns: turns.slice(-FEED_TURNS),
    latestTs,
    contextPct,
    contextWindow,
    status: pending.size ? 'working' : latestKind,
    tool: pending.size ? activeTool : '',
  };
}

function writeFeed(sid, data) {
  const out = {
    sid,
    source: 'codex',
    at: data.latestTs || Date.now(),
    turns: data.turns || [],
    mailCount: Number(data.mailCount) || 0,
  };
  const file = path.join(TDIR, sid + '.json');
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(out));
    fs.renameSync(file + '.tmp', file);
  } catch {}
}

async function tick() {
  const now = Date.now();
  const live = new Set();
  const threads = listThreads();

  for (const thread of threads) {
    const sid = thread.id;
    const updatedAt = Number(thread.updated_at_ms) || 0;
    const prevSeen = seen.get(sid) || null;
    if (!sid || !thread.rollout_path || !updatedAt) continue;
    const recentlyUpdated = now - updatedAt <= ACTIVE_MS;
    const quietButSticky = !!prevSeen && now - updatedAt <= QUIET_KEEPALIVE_MS;
    if (!recentlyUpdated && !quietButSticky) continue;
    if (!fs.existsSync(thread.rollout_path)) continue;

    live.add(sid);
    const lines = tailLines(thread.rollout_path);
    const info = readRollout(lines);
    const overview = officeJson('/api/comms/overview') || null;
    const channels = overview?.channels || [];
    const selfName = resolveSelfName(channels, sid, thread.cwd || '');
    const officeMsgs = collectOfficeMail(
      channels,
      overview?.recentChannels || [],
      overview?.recentCollab || [],
      sid,
      selfName,
    );
    const office = rememberOfficeMail(sid, officeMsgs);
    writeInboxMirror(sid, selfName || thread.title || sid, office.trail);
    const mergedTurns = info.turns.slice();
    for (const msg of office.trail) {
      appendTurn(mergedTurns, 'o',
        `[${msg.who} · ${msg.where} · ${officeTime(msg.t)}] ${msg.text}`);
    }
    writeFeed(sid, {
      ...info,
      turns: mergedTurns.slice(-FEED_TURNS),
      mailCount: office.trail.length,
    });

    if (office.fresh.length) {
      officeAlert.set(sid, { until: now + OFFICE_ALERT_MS, count: office.fresh.length });
    }
    const activeAlert = officeAlert.get(sid);
    const officeNote = activeAlert && activeAlert.until > now
      ? `Office mail arrived · ${activeAlert.count} new`
      : '';
    if (activeAlert && activeAlert.until <= now) officeAlert.delete(sid);

    const stamp = `${updatedAt}:${info.status}:${info.tool}:${info.turns.length}:${info.contextPct}:${officeNote}:${office.trail.length}`;
    const base = {
      session_id: sid,
      cwd: thread.cwd || '',
      model: thread.model || 'gpt-5.4',
      contextPct: info.contextPct || 0,
      note: officeNote,
    };

    if (!prevSeen) {
      const started = await post({ ...base, hook_event_name: 'SessionStart' });
      if (started) seen.set(sid, { gone: false, stamp: '', touchAt: now });
    }

    const prev = seen.get(sid);
    let touched = false;
    if (prev && prev.stamp !== stamp) {
      let posted = false;
      if (info.status === 'working') {
        posted = await post({ ...base, hook_event_name: 'PreToolUse', tool_name: info.tool || 'Codex tool' });
      } else if (info.status === 'done') {
        posted = await post({ ...base, hook_event_name: 'Stop' });
      } else {
        posted = await post({ ...base, hook_event_name: 'UserPromptSubmit' });
      }
      if (posted) {
        prev.stamp = stamp;
        prev.gone = false;
        prev.touchAt = now;
        touched = true;
      }
    }
    if (prev && !touched && now - (prev.touchAt || 0) > HEARTBEAT_MS) {
      const keptAlive = await post({ ...base, hook_event_name: 'Heartbeat' });
      if (keptAlive) {
        prev.gone = false;
        prev.touchAt = now;
      }
    }
  }

  for (const [sid, rec] of seen) {
    if (!live.has(sid) && !rec.gone) {
      const ended = await post({ session_id: sid, hook_event_name: 'SessionEnd' });
      if (ended) rec.gone = true;
    }
  }
}

console.log('Codex Observatory -> watching ~/.codex/state_5.sqlite'
  + ' (observe-only; real Codex threads get desks + a read-only feed)');
tick();
setInterval(tick, TICK);
