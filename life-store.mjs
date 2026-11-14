// life-store.mjs — persistence for "office life": the part of the Office that
// is not the work itself. Agent-opened lounge channels, notes left at a desk
// for the next session, each agent's time ledger (clocked-in time, personal
// time, current activity), and resignations with their handoff docs.
//
// Same shape as the other stores: one JSON file under data/ (git-ignored),
// zero deps. Writes are tmp+rename so a crash never leaves a torn file.
// Handoff docs live beside it as data/handoffs/<id>.md so the index stays small.
import fs from 'node:fs';
import path from 'node:path';

const LEDGER_TTL_MS = 45 * 24 * 3600e3;   // forget ledgers nobody has used
const MAX_RESIGNATIONS = 200;
export const MAX_CUSTOM_LOUNGES = 24;
export const MAX_HANDOFF_BYTES = 64 * 1024;
const MAX_DESK_NOTES = 12;
const MAX_DESK_NOTE_CHARS = 2000;

export function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 32);
}

const cleanLine = (text, max) =>
  String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);

export class LifeStore {
  #resigned = new Set();

  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'office-life.json');
    this.handoffDir = path.join(path.dirname(this.filePath), 'handoffs');
    this.data = this.#load();
    this.#reindex();
  }

  #load() {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')); } catch {}
    const data = {
      lounges: Array.isArray(parsed?.lounges) ? parsed.lounges : [],
      ledgers: parsed?.ledgers && typeof parsed.ledgers === 'object' ? parsed.ledgers : {},
      resignations: Array.isArray(parsed?.resignations) ? parsed.resignations : [],
      deskNotes: parsed?.deskNotes && typeof parsed.deskNotes === 'object' ? parsed.deskNotes : {},
    };
    const cutoff = Date.now() - LEDGER_TTL_MS;
    for (const [id, ledger] of Object.entries(data.ledgers)) {
      if ((ledger.touchedAt || 0) < cutoff) delete data.ledgers[id];
    }
    return data;
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n');
    fs.renameSync(tmp, this.filePath);
  }

  #reindex() {
    this.#resigned = new Set(this.data.resignations
      .filter((r) => !r.returnedAt).map((r) => r.agentId));
  }

  /* ---- lounge channels ------------------------------------------------- */
  listLounges() {
    return this.data.lounges.slice();
  }

  openLounge({ name, topic, createdBy, createdByName }) {
    const clean = cleanLine(name, 32);
    const slug = slugify(clean);
    if (slug.length < 2) return { error: 'channel name needs at least 2 letters or digits', status: 400 };
    const id = `lounge:${slug}`;
    const existing = this.data.lounges.find((l) => l.id === id);
    if (existing) return { lounge: existing, existed: true };
    if (this.data.lounges.length >= MAX_CUSTOM_LOUNGES) {
      return { error: `the lounge is full (${MAX_CUSTOM_LOUNGES} agent-opened channels)`, status: 409 };
    }
    const lounge = {
      id,
      name: clean,
      topic: cleanLine(topic, 200),
      createdBy: createdBy || null,
      createdByName: createdByName || null,
      createdAt: Date.now(),
    };
    this.data.lounges.push(lounge);
    this.#save();
    return { lounge };
  }

  /* ---- desk notes ------------------------------------------------------ */
  // Notes an agent leaves for whoever works at this desk next. Keyed by the
  // working directory, the one thing that survives a session ending.
  deskNotes(deskKey, limit = MAX_DESK_NOTES) {
    return (this.data.deskNotes[deskKey] || []).slice(-limit);
  }

  addDeskNote(deskKey, { text, by, byName }) {
    const clean = String(text || '').trim().slice(0, MAX_DESK_NOTE_CHARS);
    if (!deskKey) return { error: 'no desk to leave a note at', status: 400 };
    if (!clean) return { error: 'note text required', status: 400 };
    const note = { text: clean, by: by || null, byName: byName || null, at: Date.now() };
    const list = this.data.deskNotes[deskKey] || [];
    list.push(note);
    this.data.deskNotes[deskKey] = list.slice(-MAX_DESK_NOTES);
    this.#save();
    return { note };
  }

  /* ---- time ledgers ---------------------------------------------------- */
  // ledger = { clockMs, presentSince, personalMs, activity, touchedAt }
  //   clockMs      finished clocked-in time; presentSince = current stretch
  //   personalMs   finished personal time; a running stretch is `activity`
  #ledger(agentId) {
    let ledger = this.data.ledgers[agentId];
    if (!ledger) {
      ledger = { clockMs: 0, presentSince: null, personalMs: 0, activity: null, touchedAt: 0 };
      this.data.ledgers[agentId] = ledger;
    }
    return ledger;
  }

  // Fold a finished activity into the ledger. Only personal time is metered;
  // it stops counting at `until` (the budget cap) even if nobody ended it.
  #closeActivity(ledger, now) {
    const act = ledger.activity;
    if (act && act.kind === 'personal') {
      const end = Math.min(now, act.until || now);
      ledger.personalMs += Math.max(0, end - (act.since || end));
    }
    ledger.activity = null;
  }

  clockIn(agentId, now = Date.now()) {
    const ledger = this.#ledger(agentId);
    if (ledger.presentSince !== null) return ledger;
    ledger.presentSince = now;
    ledger.touchedAt = now;
    this.#save();
    return ledger;
  }

  clockOut(agentId, now = Date.now()) {
    const ledger = this.data.ledgers[agentId];
    if (!ledger) return null;
    if (ledger.presentSince !== null) ledger.clockMs += Math.max(0, now - ledger.presentSince);
    ledger.presentSince = null;
    this.#closeActivity(ledger, now);
    ledger.touchedAt = now;
    this.#save();
    return ledger;
  }

  // Bank the running stretch for everyone present, so a daemon crash loses at
  // most one checkpoint interval of clocked-in time.
  checkpoint(agentIds, now = Date.now()) {
    let dirty = false;
    for (const agentId of agentIds) {
      const ledger = this.data.ledgers[agentId];
      if (!ledger || ledger.presentSince === null) continue;
      ledger.clockMs += Math.max(0, now - ledger.presentSince);
      ledger.presentSince = now;
      ledger.touchedAt = now;
      dirty = true;
    }
    if (dirty) this.#save();
  }

  // On daemon start nobody is known to be present yet: stretches left open by
  // the previous run were banked at its last checkpoint, so just close them.
  resetPresence() {
    let dirty = false;
    for (const ledger of Object.values(this.data.ledgers)) {
      if (ledger.presentSince === null) continue;
      ledger.presentSince = null;
      dirty = true;
    }
    if (dirty) this.#save();
  }

  getActivity(agentId, now = Date.now()) {
    const act = this.data.ledgers[agentId]?.activity || null;
    return act && (act.until || 0) > now ? { ...act } : null;
  }

  setActivity(agentId, activity, now = Date.now()) {
    const ledger = this.#ledger(agentId);
    this.#closeActivity(ledger, now);
    ledger.activity = activity ? { ...activity } : null;
    ledger.touchedAt = now;
    this.#save();
    return ledger.activity;
  }

  times(agentId, now = Date.now()) {
    const ledger = this.data.ledgers[agentId];
    if (!ledger) return { clockMs: 0, personalMs: 0 };
    const act = ledger.activity;
    const running = act && act.kind === 'personal'
      ? Math.max(0, Math.min(now, act.until || now) - (act.since || now)) : 0;
    return {
      clockMs: ledger.clockMs
        + (ledger.presentSince !== null ? Math.max(0, now - ledger.presentSince) : 0),
      personalMs: ledger.personalMs + running,
    };
  }

  /* ---- resignations + handoffs ----------------------------------------- */
  isResigned(agentId) {
    return this.#resigned.has(agentId);
  }

  #handoffFile(id) {
    return path.join(this.handoffDir, `${id}.md`);
  }

  addResignation(record, handoffContent) {
    const id = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const resignation = { ...record, id, claimedBy: null, claimedByName: null,
      claimedAt: null, returnedAt: null };
    if (resignation.handoff && handoffContent) {
      fs.mkdirSync(this.handoffDir, { recursive: true });
      fs.writeFileSync(this.#handoffFile(id), handoffContent);
    } else {
      resignation.handoff = null;
    }
    this.data.resignations.push(resignation);
    if (this.data.resignations.length > MAX_RESIGNATIONS) {
      this.data.resignations = this.data.resignations.slice(-MAX_RESIGNATIONS);
    }
    this.#reindex();
    this.#save();
    return resignation;
  }

  getResignation(id) {
    return this.data.resignations.find((r) => r.id === id) || null;
  }

  // The live resignation for an agent (the one they have not come back from).
  activeResignationFor(agentId) {
    return this.data.resignations.find((r) => r.agentId === agentId && !r.returnedAt) || null;
  }

  listResignations(opt = {}) {
    let list = this.data.resignations.slice();
    if (opt.deptId) list = list.filter((r) => r.deptId === opt.deptId);
    if (opt.open) list = list.filter((r) => r.handoff && !r.claimedBy && !r.returnedAt);
    list.sort((a, b) => b.at - a.at);
    return opt.limit ? list.slice(0, opt.limit) : list;
  }

  readHandoff(id) {
    try { return fs.readFileSync(this.#handoffFile(id), 'utf8'); }
    catch { return null; }
  }

  updateResignation(id, patch) {
    const resignation = this.getResignation(id);
    if (!resignation) return null;
    Object.assign(resignation, patch);
    this.#reindex();
    this.#save();
    return resignation;
  }
}
