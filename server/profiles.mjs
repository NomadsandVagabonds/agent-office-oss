// The Office — human-authored profiles (hot-reloaded) and department routing.
//
// Two sources, merged:
//   1. ~/.claude/agent-office/profiles.json   (global / personal)
//   2. <data>/profiles.local.json             (repo-local / portable — wins)
// Shape: { bySession:{<id>:profile}, byCwd:{"/abs":profile}, departments:[…] }
// profile = { name?, task?, character?, desk?:{items,deskColor}, card? }
import fs from 'node:fs';
import crypto from 'node:crypto';

const EMPTY = Object.freeze({ bySession: {}, byCwd: {}, departments: [] });

const ADJ = ['Quiet', 'Brisk', 'Amber', 'Velvet', 'Iron', 'Pewter', 'Saffron', 'Cobalt',
  'Hollow', 'Drift', 'Ember', 'Slate', 'Marble', 'Russet', 'Onyx', 'Ivory'];
const CRIT = ['Heron', 'Marten', 'Civet', 'Lynx', 'Vireo', 'Tapir', 'Shrike', 'Caracal',
  'Fennec', 'Quokka', 'Saiga', 'Margay', 'Genet', 'Serval', 'Numbat', 'Pika'];

/** Deterministic two-word codename for any id. */
export function codename(id) {
  const h = crypto.createHash('md5').update(String(id)).digest();
  return `${ADJ[h[0] % ADJ.length]} ${CRIT[h[1] % CRIT.length]}`;
}

export function prettyName(s) {
  return String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function readProfileFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

export class Profiles {
  constructor(cfg) {
    this.files = [cfg.profilesFile, cfg.localProfilesFile];
    this.cache = { key: '', at: 0, data: EMPTY };
  }

  load() {
    const now = Date.now();
    // stat() on every hook event is wasteful; once a second is plenty.
    if (now - this.cache.at < 1000) return this.cache.data;
    try {
      const key = this.files.map((file) => {
        try { return `${file}:${fs.statSync(file).mtimeMs}`; }
        catch { return `${file}:0`; }
      }).join('|');
      if (key !== this.cache.key) {
        const [global, local] = this.files.map(readProfileFile);
        this.cache = { key, at: now, data: {
          bySession: { ...(global.bySession || {}), ...(local.bySession || {}) },
          byCwd: { ...(global.byCwd || {}), ...(local.byCwd || {}) },
          departments: [...(local.departments || []), ...(global.departments || [])],
        } };
      } else {
        this.cache.at = now;
      }
    } catch {
      this.cache = { key: '', at: now, data: EMPTY };
    }
    return this.cache.data;
  }

  /** Session-level settings win over cwd-level ones. */
  resolve(id, cwd) {
    const p = this.load();
    return { ...(cwd && p.byCwd[cwd]), ...p.bySession[id] };
  }

  /** cwd → department. Config `departments[].match` wins; else the basename. */
  department(cwd) {
    const { departments } = this.load();
    if (cwd) {
      for (const d of departments) {
        if ((d.match || []).some((m) => cwd.includes(m))) {
          return { id: d.id, name: d.name || prettyName(d.id),
            color: d.color || null, icon: d.icon || null, auto: false };
        }
      }
    }
    const base = (cwd || 'desk').replace(/\/+$/, '').split('/').pop() || 'desk';
    return { id: base, name: prettyName(base), color: null, icon: null, auto: true };
  }
}
