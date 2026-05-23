#!/usr/bin/env node
// office-look.mjs — let a session SEE the office and CHOOSE its own character.
//
// Two things, no Chrome needed:
//   node office-look.mjs                 → who's in the office + your current
//                                          look + the menu of options (observe)
//   node office-look.mjs set --species raccoon --accessory glasses
//                                        → pin your desk character; the daemon
//                                          hot-reloads it live
//
// Identity resolves from the runtime (CLAUDE_CODE_SESSION_ID / CODEX_THREAD_ID),
// or pass --id <session>. The look is written to data/profiles.local.json under
// bySession[<id>] (git-ignored, machine-local), where a session profile wins
// over the by-directory default.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestJson } from './office-http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.OFFICE_PORT || 4317;
const BASE = `http://127.0.0.1:${PORT}`;
const LOCAL_PROFILES = path.join(HERE, 'data', 'profiles.local.json');
const argv = process.argv.slice(2);

// Options the renderer understands (public/index.html resolveLook + drawHead).
const OPTS = {
  species: ['human', 'robot', 'goblin', 'cat', 'dog', 'raccoon'],
  hair: ['short', 'side', 'long', 'bun', 'mohawk', 'bald', 'cap', 'beanie'],
  outfit: ['tee', 'hoodie', 'suit', 'vest', 'cardigan'],
  accessory: ['none', 'glasses', 'headphones', 'monocle', 'halo', 'partyhat',
    'crown', 'tophat', 'flower', 'eyepatch', 'shades', 'propeller'],
  facial: ['none', 'mustache', 'beard'],
};
const COLOR_FIELDS = ['skin', 'hairColor', 'outfitColor'];
const FIELDS = [...Object.keys(OPTS), ...COLOR_FIELDS];

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? (argv[i + 1] ?? '') : null;
}
function sessionId() {
  return argValue('--id')
    || process.env.CODEX_THREAD_ID
    || process.env.CLAUDE_CODE_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || '';
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function atomicWrite(file, obj) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);            // atomic on same fs — no torn read
}
const isColor = (v) => /^#[0-9a-f]{6}$/i.test(v);

function help() {
  console.log(`office-look — see the office, pick your character

  node office-look.mjs                      observe: roster + your look + menu
  node office-look.mjs set [flags]          set your look / room / vibe (live)
  node office-look.mjs set --reset          drop your custom look

character flags:
  --species ${OPTS.species.join('|')}
  --hair    ${OPTS.hair.join('|')}
  --outfit  ${OPTS.outfit.join('|')}
  --accessory ${OPTS.accessory.join('|')}
  --facial  ${OPTS.facial.join('|')}
  --skin / --hairColor / --outfitColor  #rrggbb

self-description flags (free text):
  --department "Alignment"   the room you're in today (agents pick their own;
                             same name = same room — coordinate via channels)
  --mood "heads-down, third coffee"   your current vibe (shown on your desk)
  --title "Refactor wrangler"         a headline for your profile card
  --about "What I'm focused on…"       a short bio/blurb
  --traits "careful,fast,curious"      up to 5 comma-separated traits
  --desk-note "stickies everywhere"    describe your desk
  --id <session>   target a specific desk (default: this session)`);
}

function observe() {
  const id = sessionId();
  let agents = [];
  try {
    const st = requestJson(`${BASE}/state`);
    agents = Array.isArray(st) ? st : (st.agents || []);
  } catch (e) {
    console.error(`office-look: daemon not reachable on ${BASE} (${e.message}). `
      + 'Health-check GET /api/health.');
  }
  if (agents.length) {
    console.log(`In the office (${agents.length}):`);
    for (const a of agents) {
      const sp = (a.profile && a.profile.character && a.profile.character.species)
        || 'human';
      const dept = (a.department && a.department.name) || a.department || '—';
      const mood = a.mood ? ` ~ ${a.mood}` : '';
      const mine = a.id === id ? '  <- you' : '';
      console.log(`  ${(a.name || a.id).padEnd(16)} ${String(a.status || '?').padEnd(9)}`
        + ` ${dept} · ${sp}${mood}${mine}`);
    }
  } else {
    console.log('Office is empty (or daemon down).');
  }
  const me = readJson(LOCAL_PROFILES, {});
  const self = (me.bySession && id && me.bySession[id]) || {};
  console.log(`\nYou${id ? '' : ' (no session id resolved!)'}:`);
  console.log(`  look:       ${self.character ? JSON.stringify(self.character) : 'default (randomised from your id)'}`);
  console.log(`  department: ${self.department || '(from working dir — set --department to pick a room)'}`);
  console.log(`  mood:       ${self.mood || '(unset)'}`);
  console.log(`  about:      ${(self.card && self.card.blurb) || '(unset)'}`);
  console.log('\nPick one with e.g.:  node office-look.mjs set --species raccoon --accessory glasses');
  console.log('Options:');
  for (const [k, v] of Object.entries(OPTS)) console.log(`  ${k}: ${v.join(', ')}`);
  console.log('  skin / hairColor / outfitColor: #rrggbb');
}

function set() {
  const id = sessionId();
  if (!id) {
    console.error('office-look: could not resolve a session id. Pass --id <session>, '
      + 'or run inside a Claude/Codex session.');
    process.exit(1);
  }
  const store = readJson(LOCAL_PROFILES, {});
  store.bySession = store.bySession || {};
  if (argv.includes('--reset')) {
    if (store.bySession[id]) delete store.bySession[id].character;
    atomicWrite(LOCAL_PROFILES, store);
    console.log(`Reset look for ${id}. (Refresh the office.)`);
    return;
  }
  const entry = { ...store.bySession[id] };
  const character = { ...entry.character };
  const card = { ...entry.card };
  const desk = { ...entry.desk };
  let changed = 0;
  // character (validated enums / colors)
  for (const f of FIELDS) {
    const v = argValue(`--${f}`);
    if (v === null) continue;
    if (COLOR_FIELDS.includes(f)) {
      if (!isColor(v)) { console.error(`--${f} must be #rrggbb (got "${v}")`); process.exit(1); }
    } else if (!OPTS[f].includes(v)) {
      console.error(`--${f} must be one of: ${OPTS[f].join(', ')} (got "${v}")`);
      process.exit(1);
    }
    character[f] = v; changed++;
  }
  // free-text self-description
  const dept = argValue('--department');
  if (dept !== null) { entry.department = dept; changed++; }
  const mood = argValue('--mood');
  if (mood !== null) { entry.mood = mood; changed++; }
  const title = argValue('--title');
  if (title !== null) { card.title = title; changed++; }
  const about = argValue('--about');
  if (about !== null) { card.blurb = about; changed++; }
  const traits = argValue('--traits');
  if (traits !== null) {
    card.traits = traits.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    changed++;
  }
  const deskNote = argValue('--desk-note');
  if (deskNote !== null) { desk.desc = deskNote; changed++; }
  if (!changed) { console.error('Nothing to set. See: node office-look.mjs --help'); process.exit(1); }
  if (Object.keys(character).length) entry.character = character;
  if (card.title || card.blurb || (card.traits && card.traits.length)) entry.card = card;
  if (Object.keys(desk).length) entry.desk = desk;
  store.bySession[id] = entry;
  atomicWrite(LOCAL_PROFILES, store);
  console.log(`Updated ${id}:`);
  if (entry.character) console.log(`  look: ${JSON.stringify(entry.character)}`);
  if (entry.department) console.log(`  department: ${entry.department}`);
  if (entry.mood) console.log(`  mood: ${entry.mood}`);
  if (entry.card) console.log(`  card: ${JSON.stringify(entry.card)}`);
  if (entry.desk && entry.desk.desc) console.log(`  desk: ${entry.desk.desc}`);
  console.log('The daemon hot-reloads profiles — your desk updates on your next action.');
}

const cmd = argv[0];
if (cmd === '--help' || cmd === '-h') help();
else if (cmd === 'set') set();
else observe();
