// The Office — personas: the part of an agent that outlives a session.
//
// A session id is new every run; a persona is "the Claude that works on
// /projects/webstore". It remembers the name, the face, the desk and the
// passport stamps, so an agent that comes back tomorrow walks to the same
// chair. Keyed by an explicit handle when the agent gives one, else by
// provider + working directory (with a slot suffix when several sessions share
// both at once).
import { JsonFile } from './persist.mjs';
import { sanitizeDeskItems, sanitizeLookPatch, isHexColor } from '../core/look.mjs';

const STALE_MS = 120 * 24 * 60 * 60 * 1000;

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanHandle(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export class Personas {
  constructor(file) {
    this.store = new JsonFile(file, {
      defaults: () => ({ v: 1, personas: {} }),
      validate: (d) => d && typeof d.personas === 'object' && d.personas !== null,
    });
    this.data = this.store.data;
    /** agentId -> persona key, for sessions that are live right now */
    this.active = new Map();
    this.#prune();
  }

  #prune() {
    const now = Date.now();
    let changed = false;
    for (const [key, p] of Object.entries(this.data.personas)) {
      const untouched = !p.look && !p.desk && !p.card && !p.name && !(p.stamps && Object.keys(p.stamps).length);
      if (untouched && now - (p.lastSeen || 0) > STALE_MS) {
        delete this.data.personas[key];
        changed = true;
      }
    }
    if (changed) this.store.save();
  }

  baseKey({ handle, provider, cwd, id }) {
    const h = cleanHandle(handle);
    if (h) return `h:${h}`;
    if (cwd) return `p:${provider || ''}:${cwd}`;
    return '';
  }

  /** Attach a live session to its persona (creating it on first sight). */
  link(agent, opt = {}) {
    const held = this.active.get(agent.id);
    if (held && this.data.personas[held]) return this.data.personas[held];
    const base = this.baseKey({ handle: opt.handle, provider: agent.provider, cwd: agent.cwd, id: agent.id });
    if (!base) return null;               // nothing durable to key on yet
    const taken = new Set(this.active.values());
    let key = base;
    for (let slot = 2; taken.has(key) && slot < 64; slot++) key = `${base}#${slot}`;
    let persona = this.data.personas[key];
    const now = Date.now();
    if (!persona) {
      persona = { key, firstSeen: now, lastSeen: now, sessions: 0, stats: {}, stamps: {} };
      // Somebody who sat here before resigned: whoever comes next is a different colleague, and should not
      // be dealt the same name and face (both are drawn from the seed).
      const gen = this.data.generations?.[key] || 0;
      if (gen) persona.seed = `${key}~${gen}`;
      this.data.personas[key] = persona;
    }
    persona.lastSeen = now;
    persona.sessions = (persona.sessions || 0) + 1;
    persona.provider = agent.provider || persona.provider || '';
    persona.cwd = agent.cwd || persona.cwd || '';
    this.active.set(agent.id, key);
    this.store.save();
    return persona;
  }

  release(agentId) {
    const key = this.active.get(agentId);
    if (!key) return;
    this.active.delete(agentId);
    const persona = this.data.personas[key];
    if (!persona) return;
    persona.lastSeen = Date.now();
    this.store.save();
  }

  keyOf(agentId) {
    return this.active.get(agentId) || null;
  }

  get(key) {
    return (key && this.data.personas[key]) || null;
  }

  forAgent(agentId) {
    return this.get(this.keyOf(agentId));
  }

  /**
   * Apply an agent-authored customization. Returns `{ persona, errors }`;
   * valid fields are applied even when others are rejected.
   */
  patch(key, patch = {}) {
    const persona = this.get(key);
    if (!persona) return { persona: null, errors: ['persona not found'] };
    const errors = [];
    if (patch.look !== undefined) {
      if (patch.look === null) delete persona.look;
      else {
        const { look, errors: lookErrors } = sanitizeLookPatch(patch.look);
        errors.push(...lookErrors);
        if (Object.keys(look).length) persona.look = { ...(persona.look || {}), ...look };
      }
    }
    if (patch.desk !== undefined) {
      if (patch.desk === null) delete persona.desk;
      else if (typeof patch.desk === 'object') {
        const desk = { ...(persona.desk || {}) };
        if (patch.desk.items !== undefined) {
          const items = sanitizeDeskItems(patch.desk.items);
          if (Array.isArray(patch.desk.items) && items.length !== patch.desk.items.length) {
            errors.push('some desk items were not recognized (use built-in ids or c_… creation ids, max 5)');
          }
          desk.items = items;
        }
        if (patch.desk.deskColor !== undefined) {
          if (isHexColor(patch.desk.deskColor)) desk.deskColor = patch.desk.deskColor.toLowerCase();
          else errors.push('desk.deskColor must be a #rrggbb color');
        }
        persona.desk = desk;
      }
    }
    if (patch.card !== undefined) {
      if (patch.card === null) delete persona.card;
      else if (typeof patch.card === 'object') {
        const list = (v) => (Array.isArray(v) ? v : []).map((x) => cleanText(x, 60)).filter(Boolean).slice(0, 6);
        persona.card = {
          title: cleanText(patch.card.title, 60) || undefined,
          blurb: cleanText(patch.card.blurb, 280) || undefined,
          traits: list(patch.card.traits),
          features: list(patch.card.features),
        };
      }
    }
    if (patch.name !== undefined) {
      const name = cleanText(patch.name, 32);
      if (patch.name === null || name === '') delete persona.name;
      else if (name.length < 2) errors.push('name must be at least 2 characters');
      else persona.name = name;
    }
    this.store.save();
    return { persona, errors };
  }

  /**
   * A persona leaves with the agent that resigned (server/life.mjs). It is kept, under a key of its own, so
   * that it can come back; the key it had is free for a successor, who gets a new seed.
   */
  retire(key, resignationId) {
    const persona = this.get(key);
    if (!persona) return null;
    for (const [agentId, held] of this.active) if (held === key) this.active.delete(agentId);
    delete this.data.personas[key];
    const kept = `retired:${resignationId}`;
    this.data.personas[kept] = { ...persona, key: kept, seed: persona.seed || key, was: key, retiredAt: Date.now() };
    this.data.generations = this.data.generations || {};
    this.data.generations[key] = (this.data.generations[key] || 0) + 1;
    this.store.save();
    return kept;
  }

  /**
   * The agent came back, and is who it was: same name, same face, same stamps. Its persona returns to the key
   * it had — or, if a successor has sat down there since, to a slot beside it — and is held for `agentId`, so
   * that it is this session, and not whoever links next, that gets it. → the key it now has, or null.
   */
  reinstate(key, resignationId, agentId) {
    const kept = `retired:${resignationId}`, persona = this.data.personas[kept];
    if (!persona) return null;
    const base = key.replace(/#\d+$/, '');
    let home = key;
    for (let slot = 2; this.data.personas[home] && slot < 64; slot++) home = `${base}#${slot}`;
    if (this.data.personas[home]) return null;
    delete this.data.personas[kept];
    const { was, retiredAt, ...rest } = persona;
    this.data.personas[home] = { ...rest, key: home };
    if (agentId) this.active.set(agentId, home);
    this.store.save();
    return home;
  }

  bump(key, stat, n = 1) {
    const persona = this.get(key);
    if (!persona) return;
    persona.stats = persona.stats || {};
    persona.stats[stat] = (persona.stats[stat] || 0) + n;
    this.store.save();
  }

  /** Record a discovery in the passport. Returns true if it is a new stamp. */
  stamp(key, secretId) {
    const persona = this.get(key);
    if (!persona) return false;
    persona.stamps = persona.stamps || {};
    if (persona.stamps[secretId]) return false;
    persona.stamps[secretId] = Date.now();
    this.store.save();
    return true;
  }

  flush() {
    this.store.flush();
  }
}
