// The Office — harness: what a turn changed.
//
// A transcript records what an agent said it did. This module records what
// happened to the files: for a session whose folder is inside a git repository
// it takes a snapshot of the working tree before each turn and another after
// it, and answers "what did turn n change?" by comparing the two.
//
// It uses git, and it writes nothing into the repository. That is the rule
// everything here is built around: someone who never asked for snapshots can
// list their `.git` — every path, size and time — before a session and after
// it, and find no difference. So:
//
//   - the objects of a snapshot go to an object directory of the office's own,
//     under its data directory, one per repository (GIT_OBJECT_DIRECTORY). It
//     holds every object a snapshot needs, not only the new ones. The
//     repository's objects are never borrowed as "alternates": git updates the
//     time of an object it is asked to write and already has, wherever it finds
//     it, so borrowing would have the first snapshot touch the owner's packs;
//   - the index is a file of the office's own, one per session
//     (GIT_INDEX_FILE). The owner's index is not read either: reading a split
//     index is enough to change the time of its shared half;
//   - no ref is written into the repository, and none is needed: `git
//     write-tree` names a tree, and the office keeps the names in its own record;
//   - no program the repository's config names is started: hooks are pointed at
//     nowhere (`git add` would otherwise run post-index-change), the file-system
//     monitor is off, content filters are switched off (git-lfs's "clean" writes
//     into `.git/lfs`), and a diff never runs an external driver or a text
//     converter. Files are snapshotted as they are on disk;
//   - a repository inside the folder — a submodule, a clone, another worktree —
//     is left out, whole. To record one as git would, git runs `git status`
//     inside it, with that repository's own config and filters;
//   - the office's own data directory is left out as well, wherever it is: its
//     files are no part of anybody's turn, and a snapshot that took in the
//     directory it is stored in would store its own objects again, every time.
//
//   GIT_OBJECT_DIRECTORY=<ours> GIT_INDEX_FILE=<ours> git add -A --ignore-errors   our index := the working tree
//   GIT_OBJECT_DIRECTORY=<ours> GIT_INDEX_FILE=<ours> git write-tree               → the id of a tree
//   git --git-dir=<ours> diff-tree <tree> <tree>                                   what differs between two
//
// `add -A` is what puts untracked files in a snapshot and leaves ignored ones
// out. The index is kept for the session's life, so after the first snapshot
// git's stat check finds what changed without reading every file again.
//
// The price of touching nothing is the first snapshot of a repository: every
// file that is not ignored is read and stored once (compressed) on the office's
// side. After that, snapshots — of this session and of later ones in the same
// repository — store only what is new. A snapshot is never allowed to become
// expensive without saying so: its git calls share one time budget and are
// stopped when it runs out, their output is bounded, and before anything is
// stored the files are counted and weighed against a budget. Over budget, the
// snapshot is skipped with the reason, and the turn goes ahead without it.
// What the office keeps for one repository is counted too, as the disk counts
// it, and has a cap: at it nothing more is stored there, and the sessions in
// that repository are told that their turns are no longer recorded.
//
// A snapshot says what the working tree looked like, not who wrote it. Edits a
// person or another agent makes in the same checkout while a turn runs, and
// files a `git checkout` or `git pull` replaces, show up as that turn's changes
// (a moved HEAD is reported beside them).
//
// The outline — a private index, tree snapshots, diffs between them, a turn
// that waits a bounded moment for the snapshot before it — is T3 Code's
// checkpointing (apps/server/src/checkpointing/ and the capture in
// apps/server/src/vcs/GitVcsDriver.ts; MIT, © 2026 T3 Tools Inc. — see NOTICE).
// T3 keeps its snapshots as hidden refs and objects inside the user's
// repository; that is the one part we do not take. The code is ours, and where
// it follows T3's reasoning closely the comment beside it says so.
import cp from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonFile } from '../persist.mjs';
import { gitAvailable, locate } from '../git.mjs';
import { redact } from './child.mjs';
import { line } from './normalize.mjs';

const SESSION_ID = /^d_[a-f0-9]{12}$/;
const STORE_KEY = /^[a-f0-9]{16}$/;
const OID = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const POSIX = process.platform !== 'win32';

const LIST_BYTES = 8 * 1024 * 1024;      // a list of names from git: candidates for a snapshot, the files of a diff
const ERR_CHARS = 2000;                  // of git's stderr; its first line says why it refused
const KILL_GRACE_MS = 600;
const QUERY_MS = 10_000;                 // a question about snapshots already taken
const FILES_LISTED = 500;                // files of one turn in an answer
const ENTRY_FILES = 20;                  // …and in its transcript entry
const SUMMARIES_KEPT = 300;
const STAT_AT_ONCE = 32;
const SLOW_IN_A_ROW = 2;
const GRACE_SECONDS = 3600;              // objects younger than this are never cleaned away: a snapshot may be using them
const KEEP = 'refs/office/keep';         // in the office's own directory, and only while it tidies up there
const SIZE_FRESH_MS = 30_000;            // how long a count of what is kept is believed
const TIDY_EVERY = 25;                   // a running session past its cap on turns: tidy up after every so many more
const RETIDY_MS = 60_000;                // a tidying that did not bring a directory under its cap is not tried again sooner

/** The office's name for a repository: its object directory is kept under this. */
export const repoKey = (commonDir) => crypto.createHash('sha256').update(String(commonDir)).digest('hex').slice(0, 16);

/* ---- running git -------------------------------------------------------------- */

// The way server/git.mjs runs git — an argument array, never a shell; no
// optional locks, no prompt, no pager, fsmonitor off, a timeout and a bound on
// every call, and never a rejection. A reader needs no more. Taking snapshots
// also needs an index and an object directory of its own, something on stdin,
// git's reason when it refuses, and output that is cut at a bound instead of
// failing — so the runner is here, with the same flags and environment, plus:
//   core.hooksPath          nowhere: no hook of the repository's runs for us
//   safe.bareRepository     a folder that merely looks like a bare repository is not opened (its config could name programs)
const SAFE = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false',
  '-c', `core.hooksPath=${os.devNull}`, '-c', 'safe.bareRepository=explicit'];
// For calls that write our private index. The first two follow T3 Code's capture: written as a split index,
// a scratch index puts a shared index file into the repository and can expire the one the owner's real index
// still depends on. The rest keep what is in a snapshot equal to what is on disk: no sparse-checkout rules, no
// "assume unchanged" set behind our back (core.ignoreStat), no refusal over line endings (core.safecrlf).
const PRIVATE_INDEX = ['-c', 'core.splitIndex=false', '-c', 'splitIndex.sharedIndexExpire=never',
  '-c', 'core.untrackedCache=false', '-c', 'core.sparseCheckout=false', '-c', 'index.sparse=false',
  '-c', 'core.ignoreStat=false', '-c', 'core.safecrlf=false', '-c', 'advice.addEmbeddedRepo=false'];
// A daemon started from inside a git hook inherits these; they would point our git at somebody else's
// repository, index or objects. (T3 Code clears the same ones before every git it runs.)
const INHERITED = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_EXTERNAL_DIFF', 'GIT_DIFF_OPTS'];

function gitEnv({ index, store, patterns } = {}) {
  const env = { ...process.env };
  for (const name of INHERITED) delete env[name];
  Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', GIT_PAGER: 'cat' });
  // Literal pathspecs: a path we pass after "--" is that path, never a pattern and never "magic".
  // (`patterns` is asked for by `check-ignore`, which refuses to run this way, and by a call that names
  // folders to leave out — as `:(top,exclude,literal)<folder>`, which is magic that says "no pattern" itself.)
  if (!patterns) env.GIT_LITERAL_PATHSPECS = '1';
  if (index) env.GIT_INDEX_FILE = index;
  // Where objects are written and looked for — and, with no alternates, the only place.
  if (store) env.GIT_OBJECT_DIRECTORY = path.join(store, 'objects');
  return env;
}

// A content filter is a program named by config and chosen by a file's attributes. An empty command and
// "not required" is how git is told to leave such a file as it is.
const filterOff = (driver) => ['-c', `filter.${driver}.clean=`, '-c', `filter.${driver}.smudge=`,
  '-c', `filter.${driver}.process=`, '-c', `filter.${driver}.required=false`];

/**
 * Run git. Resolves { ok, code, out, err, timedOut, truncated } and never rejects.
 * @param {string|null} cwd   where to run it (`-C`); null when the arguments name the repository themselves
 * @param {string[]} args
 * @param {{index?:string, store?:string, filtersOff?:string[], input?:string, timeout?:number, maxOut?:number,
 *          patterns?:boolean, track?:Set<object>}} [opt]
 */
export function runGit(cwd, args, opt = {}) {
  return new Promise((resolve) => {
    const maxOut = opt.maxOut ?? LIST_BYTES;
    const chunks = [];
    let size = 0, err = '', timedOut = false, truncated = false, settled = false, child = null, timer = null;
    const done = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      opt.track?.delete(child);
      resolve({ ok: code === 0 && !timedOut && !truncated, code: Number.isInteger(code) ? code : 1,
        out: Buffer.concat(chunks, size).toString('utf8'), err, timedOut, truncated });
    };
    try {
      const argv = [...SAFE, ...(opt.index ? PRIVATE_INDEX : []), ...(opt.filtersOff || []).flatMap(filterOff),
        ...(cwd ? ['-C', cwd] : []), ...args];
      child = cp.spawn('git', argv, {
        env: gitEnv(opt), windowsHide: true, shell: false,
        detached: POSIX,                      // its own process group: whatever it started is stopped with it
        stdio: [opt.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      });
    } catch { done(127); return; }
    opt.track?.add(child);
    const signal = (name) => {
      try { if (POSIX && child.pid) process.kill(-child.pid, name); else child.kill(name); }
      catch { try { child.kill(name); } catch { /* already gone */ } }
    };
    // Ask, then insist — like the agent processes in child.mjs.
    child.stop = () => { signal('SIGTERM'); const t = setTimeout(() => signal('SIGKILL'), KILL_GRACE_MS); t.unref?.(); };
    timer = setTimeout(() => { timedOut = true; child.stop(); }, Math.max(1, opt.timeout ?? QUERY_MS));
    child.stdout.on('data', (chunk) => {
      if (truncated) return;
      if (size + chunk.length > maxOut) {
        chunks.push(chunk.subarray(0, maxOut - size));
        size = maxOut;
        truncated = true;                     // we have all we will keep; git need not go on
        child.stop();
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
    });
    child.stderr.on('data', (chunk) => { if (err.length < ERR_CHARS) err = (err + chunk.toString('utf8')).slice(0, ERR_CHARS); });
    child.on('error', () => done(127));
    child.on('close', (code) => done(code));
    if (opt.input !== undefined) {
      child.stdin.on('error', () => {});      // git may exit before reading it all; its exit code says so
      child.stdin.end(opt.input);
    }
  });
}

/* ---- reading git's answers ------------------------------------------------------ */

const STATUS = Object.freeze({ A: 'added', C: 'added', D: 'deleted', M: 'modified', R: 'renamed', T: 'modified' });

/**
 * Read `git diff-tree -r -z -M --raw --numstat`: first every changed path with
 * what happened to it (`:<mode> <mode> <id> <id> <letter>` NUL path NUL, and for
 * a rename the old path then the new), then the same paths with lines added and
 * removed ("-" for a binary file). NUL-separated, so a name with spaces,
 * newlines or quotes is just a name. The reading of a rename's numstat record
 * (an empty path, then old and new) follows T3 Code's checkpointing/Diffs.ts.
 * @returns {{path:string, status:string, from?:string, additions:number, deletions:number, binary:boolean}[]}
 */
export function parseChanges(out, { cut = false } = {}) {
  const tokens = String(out).split('\0');
  if (cut) tokens.pop();                      // output that was cut short ends in a piece of something
  const files = [];
  const byPath = new Map();
  let i = 0;
  for (; i < tokens.length; i++) {
    const head = /^:\d{6} \d{6} [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/.exec(tokens[i]);
    if (!head) break;
    const moved = head[1] === 'R' || head[1] === 'C';
    const from = moved ? tokens[++i] : undefined;
    const name = tokens[++i];
    if (name === undefined || (moved && from === undefined)) break;
    const file = { path: name, status: STATUS[head[1]] || 'modified', ...(head[1] === 'R' ? { from } : {}),
      additions: 0, deletions: 0, binary: false };
    files.push(file);
    byPath.set(name, file);
  }
  for (; i < tokens.length; i++) {
    const stat = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(tokens[i]);
    if (!stat) continue;
    let name = stat[3];
    if (name === '') { name = tokens[i + 2]; i += 2; }
    const file = byPath.get(name);
    if (!file) continue;
    if (stat[1] === '-') file.binary = true;
    else { file.additions = Number(stat[1]); file.deletions = Number(stat[2]); }
  }
  return files;
}

/** " 3 files changed, 5 insertions(+), 2 deletions(-)" → { count, additions, deletions } | null */
export function parseShortstat(out) {
  const m = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/.exec(String(out));
  return m ? { count: Number(m[1]), additions: Number(m[2] || 0), deletions: Number(m[3] || 0) } : null;
}

const namesOf = (r) => (r && (r.ok || r.truncated) ? r.out.split('\0').filter(Boolean) : []);
const oidOf = (r) => (r?.ok && OID.test(r.out.trim()) ? r.out.trim() : '');
const say = (n) => n.toLocaleString('en-US');
function size(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} bytes`;
}
/** Why git refused, in its own first words. */
function why(r) {
  if (r.timedOut) return 'it took too long';
  if (r.code === 127) return 'git could not be started';
  const first = String(r.err || '').split('\n').map((s) => s.trim()).filter(Boolean)[0] || `git exited with status ${r.code}`;
  return line(first.replace(/^(?:fatal|error): /, ''), 240);
}
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
/** Is `inner` the folder `outer`, or somewhere inside it? */
const contains = (outer, inner) => { const at = path.relative(outer, inner); return at === '' || (at !== '..' && !at.startsWith(`..${path.sep}`) && !path.isAbsolute(at)); };
const wait = (ms) => new Promise((resolve) => { const t = setTimeout(resolve, ms); t.unref?.(); });
/** What is kept of a snapshot: the tree it is, where HEAD was, when, and how long it took. */
const kept = (snap) => ({ tree: snap.tree, ...(snap.head ? { head: snap.head } : {}), at: snap.at, ms: snap.ms,
  ...(snap.partial ? { partial: snap.partial } : {}) });

/* ---- the store ------------------------------------------------------------------ */

const NOTHING = Object.freeze({ files: Object.freeze([]), count: 0, additions: 0, deletions: 0, truncated: false });
const SWITCHED_OFF = 'this office is not recording what turns change (it was started with OFFICE_CHECKPOINTS=0 or OFFICE_GIT=0)';
const NO_RECORD = 'the office has no snapshots of this session';

/**
 * @param {{settings:object, dir:string, file:string, own?:string[], log?:{warn:Function}, changed?:()=>void, graceSeconds?:number}} init
 *   settings  cfg.harness.checkpoints
 *   dir       the harness's folder under the data directory: a session's index lives in it while the session
 *             does, and `checkpoints/<repository key>/` under it is the object directory for one repository
 *   file      which sessions have snapshots, of which folder, and the tree of each
 *   own       folders that hold the office's own files (its data directory): never part of any snapshot
 *   changed   called when it becomes known whether a session is being recorded
 */
export function createCheckpoints({ settings, dir, file, own: officeFolders = [path.dirname(file), dir], log = console, changed = () => {},
  graceSeconds = GRACE_SECONDS }) {
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, sessions: {} }), debounceMs: 200,
    validate: (d) => d && typeof d.sessions === 'object' && d.sessions !== null && !Array.isArray(d.sessions),
  });
  const stores = path.join(dir, 'checkpoints');
  const storeOf = (key) => path.join(stores, key);
  const live = new Map();               // session id → what a session needs while it lives in this process
  const running = new Set();            // every git we have started and not yet seen end
  const summaries = new Map();          // "<key>:<tree>:<tree>" → what differs; trees never change, so neither does this
  const sizes = new Map();              // repository key → { bytes, objects, at }: what the office keeps for it, as last counted
  const toldKept = new Set();           // repositories whose size has been told to a session since this office started
  const tidying = new Map();            // repository key → the tidying under way there (one at a time)
  const made = new Map();               // repository key → how many times its object directory was made since this office started
  const moves = new Map();              // repository key → how many times something was stored there or removed: a count taken across one is not kept
  const fullAt = new Map();             // repository key → when a tidying last left it over its cap
  /** Something was stored in a repository's directory, or removed from it: what was counted before no longer holds. */
  const touched = (key) => { moves.set(key, (moves.get(key) || 0) + 1); sizes.delete(key); };
  const git = (cwd, args, opt = {}) => runGit(cwd, args, { timeout: QUERY_MS, ...opt, track: running });
  // Questions about snapshots are asked of the office's own directory and of nothing else: they are
  // answered the same whether the repository has moved on, been rewritten, or is gone.
  const ours = (rec, args, opt) => git(null, [`--git-dir=${storeOf(rec.key)}`, ...args], opt);
  const recordOf = (id) => store.data.sessions[id] || null;

  /** One thing at a time per session, in the order asked; a failure is logged and the queue goes on. */
  function enqueue(st, job) {
    const run = st.chain.then(job).catch((err) => { log.warn(`[checkpoints] ${st.id}: ${err?.stack || err}`); return undefined; });
    st.chain = run;
    return run;
  }

  /* ---- is this folder in a repository? ------------------------------------------- */

  function refuse(st, reason, { quiet = false } = {}) {
    st.off = reason;
    if (!quiet) st.note('n:changes', `What turns change in this folder is not being recorded: ${reason}.`);
  }

  async function place(st) {
    if (!settings.enabled) return refuse(st, SWITCHED_OFF, { quiet: true });       // how the office was started needs no announcing to every session
    if (!(await gitAvailable())) return refuse(st, 'git is not installed here');
    const where = await locate(st.cwd);
    if (!where) return refuse(st, `${line(st.cwd, 300)} is not inside a git repository`);
    // A folder the repository ignores is one git never looks into: every turn would seem to change nothing.
    // Asked by the ignore rules alone (--no-index): the owner's index is not ours to open.
    const below = path.relative(where.root, real(st.cwd));
    if (below && !below.startsWith('..') && !path.isAbsolute(below)) {
      // "./" keeps a folder whose name begins with ":" from being read as pathspec magic.
      const ignored = await git(where.root, ['check-ignore', '-q', '--no-index', '--', `./${below.split(path.sep).join('/')}`], { timeout: 4000, patterns: true });
      if (ignored.code === 0) return refuse(st, 'this folder is ignored by the git repository it is in, so git does not look at it');
    }
    // The office's own files are no part of anybody's turn, and a snapshot that took in the directory it is
    // stored in would store its own objects again, every time. Where the office keeps its files inside this
    // checkout, they are left out by name; a checkout that *is* where the office keeps them is not recorded.
    const keepOut = [], here = real(st.cwd);
    for (const folder of officeFolders.map(real)) {
      const at = path.relative(where.root, folder);
      const within = at !== '' && at !== '..' && !at.startsWith(`..${path.sep}`) && !path.isAbsolute(at);
      // Left out, the folder this session works in would have every turn seem to change nothing.
      if (within ? contains(folder, here) : (at === '' || contains(real(dir), where.root))) return refuse(st, 'it is where the office keeps its own files');
      if (within) keepOut.push(at.split(path.sep).join('/'));
    }
    const format = await git(where.root, ['rev-parse', '--show-object-format'], { timeout: 4000 });
    st.root = where.root;
    st.keepOut = [...new Set(keepOut)];
    st.key = repoKey(where.commonDir);
    st.sha256 = format.ok && format.out.trim() === 'sha256';
    store.data.sessions[st.id] = { root: where.root, repo: where.commonDir, key: st.key, at: Date.now(), turns: [] };
    store.save();
    return undefined;
  }

  /** Stop taking snapshots for this session, and say why once. What was recorded stays readable. */
  function switchOff(st, reason) {
    st.off = reason;
    const rec = recordOf(st.id);
    if (rec && (st.warm || rec.turns.length)) {
      rec.off = reason;
      st.note('n:changes:off', `File changes are no longer being recorded for this session: ${reason}.`);
    } else {
      // It never had a snapshot: there is nothing to read, and the notice says the folder is not recorded at all.
      delete store.data.sessions[st.id];
      st.note('n:changes', `What turns change in this folder is not being recorded: ${reason}.`);
    }
    store.save();
    changed();
    return { skip: reason, code: 'off' };
  }

  /* ---- a snapshot ------------------------------------------------------------------ */

  /**
   * The office's object directory for this repository: a bare repository with nothing in it but objects.
   * → null, or git's refusal. Each time it has to be made is counted: whatever an index believed was in it is not.
   */
  async function room(st) {
    const at = storeOf(st.key);
    if (fs.existsSync(path.join(at, 'HEAD')) && fs.existsSync(path.join(at, 'objects'))) return null;
    fs.mkdirSync(stores, { recursive: true });
    const init = await git(null, ['init', '-q', '--bare', '--template=', ...(st.sha256 ? ['--object-format=sha256'] : []), at]);
    if (!init.ok) return init;
    made.set(st.key, (made.get(st.key) || 0) + 1);
    return null;
  }

  /** How much the named files weigh on disk, stopping once it is plainly too much. */
  async function weigh(root, names, limit) {
    let bytes = 0, next = 0, largest = null;
    const worker = async () => {
      while (next < names.length && bytes <= limit) {
        const name = names[next++];
        try {
          const info = await fs.promises.lstat(path.join(root, name));
          if (!info.isFile()) continue;
          bytes += info.size;
          if (!largest || info.size > largest.size) largest = { name, size: info.size };
        } catch { /* gone again, or deleted: it weighs nothing */ }
      }
    };
    await Promise.all(Array.from({ length: Math.min(STAT_AT_ONCE, names.length) }, worker));
    return { bytes, largest };
  }

  /**
   * Files that are committed and also ignored (added with `git add -f`) are still files a turn can
   * change, and `add -A` into a new index would pass them by. Which they are is read from the commit and
   * the ignore rules — not from the owner's index.
   */
  async function ignoredButTracked(st, head, timeout) {
    const tracked = await git(st.root, ['ls-tree', '-r', '-z', '--name-only', head], { timeout });
    if (!tracked.ok || !tracked.out) return [];
    const asked = tracked.out.split('\0').filter(Boolean).map((name) => `./${name}`).join('\0') + '\0';
    const ignored = await git(st.root, ['check-ignore', '--no-index', '-z', '--stdin'], { input: asked, patterns: true, timeout });
    return ignored.out.split('\0').filter(Boolean).map((name) => name.replace(/^\.\//, ''));
  }

  /**
   * Make our index equal to the working tree and write it as a tree.
   * → { tree, head, at, ms, partial? }, or { skip: reason, code } when no snapshot was taken.
   */
  async function capture(st) {
    if (st.off) return { skip: st.off, code: 'off' };
    const began = Date.now();
    let until = began + settings.timeoutMs, aside = 0;       // `aside`: time that was not the snapshot's (see the cap, below)
    const left = () => Math.max(1, until - Date.now());
    let first = !st.warm;                  // nothing of this tree is in our index yet: every file is new to it
    const failed = (what, r) => (r.timedOut
      // Asked again it would only take as long again: what makes later snapshots quick is a finished one.
      ? switchOff(st, `${first ? 'a first snapshot of it' : 'a snapshot of this folder'} took longer than ${say(settings.timeoutMs)} ms (OFFICE_CHECKPOINTS_TIMEOUT_MS)`)
      : { skip: `git could not ${what}: ${why(r)}`, code: 'git' });
    const taken = (tree, head, partial) => {
      const ms = Date.now() - began;
      // The first snapshot reads every file and may be slow once. A second slow one in a row means the
      // folder is too big to look over while a turn waits.
      st.slow = ms - aside > settings.holdMs ? st.slow + 1 : 0;
      if (st.slow >= SLOW_IN_A_ROW) {
        switchOff(st, `${SLOW_IN_A_ROW} snapshots in a row took longer than a turn waits (${say(settings.holdMs)} ms; OFFICE_CHECKPOINTS_HOLD_MS)`);
      }
      return { tree, head, at: began, ms, ...(partial ? { partial } : {}) };
    };
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.rmSync(`${st.index}.lock`, { force: true });           // left behind by a git we had to stop
      const unmade = await room(st);
      if (unmade) return failed('make room for snapshots', unmade);
      // The directory was made anew since our index was filled — somebody removed it, to have the disk back
      // perhaps. Nothing the index believes is stored there is: this snapshot starts over, like a first one.
      if (st.warm && st.madeAt !== (made.get(st.key) || 0)) { st.warm = false; st.tree = ''; st.written = false; first = true; }
      // Two things are asked of the repository itself, and only read: where HEAD points (told beside a
      // turn's changes when it moved), and which content filters its config names (so they can be switched off).
      const [headRun, named] = await Promise.all([
        git(st.root, ['rev-parse', '--verify', '--quiet', 'HEAD'], { timeout: left() }),
        git(st.root, ['config', '-z', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], { timeout: left() }),
      ]);
      const head = oidOf(headRun);
      const drivers = [...new Set(named.out.split('\0').map((name) => /^filter\.(.+)\.[a-z]+$/i.exec(name.trim())?.[1]).filter(Boolean))];
      if (drivers.some((driver) => /[=\n\0]/.test(driver))) {
        return switchOff(st, 'its git config names a content filter the office cannot switch off, and no program of the repository\'s is run for a snapshot');
      }
      const mine = (extra = {}) => ({ index: st.index, store: storeOf(st.key), filtersOff: drivers, timeout: left(), ...extra });
      if (first) fs.rmSync(st.index, { force: true });

      // The office's own files, where they are kept inside this checkout, are named to git as left out.
      const apart = st.keepOut.map((folder) => `:(top,exclude,literal)${folder}`);
      const rest = apart.length ? ['--', '.', ...apart] : [];
      const notOurs = (name) => !st.keepOut.some((folder) => name === folder || name.startsWith(`${folder}/`));
      // What a snapshot would take in: files our index has never seen and — once it has seen the tree —
      // files whose stat data no longer matches. Counted and weighed before anything is stored.
      const [fresh, stale, tracked] = await Promise.all([
        git(st.root, ['ls-files', '-z', '--others', '--exclude-standard', ...rest], mine({ patterns: apart.length > 0 })),
        first ? null : git(st.root, ['diff-files', '-z', '--name-only', '--ignore-submodules=all', ...rest], mine({ patterns: apart.length > 0 })),
        first && head ? ignoredButTracked(st, head, left()) : [],
      ]);
      for (const r of [fresh, stale]) if (r && !r.ok && !r.truncated) return failed('look at the folder', r);
      const extra = tracked.filter(notOurs);
      const names = [...namesOf(fresh), ...namesOf(stale), ...extra];
      const uncounted = fresh.truncated || !!stale?.truncated;
      if (first) {
        // The whole tree, once. A folder too big for that is not recorded at all, rather than asked again at every turn.
        if (uncounted || names.length > settings.maxTreeFiles) {
          return switchOff(st, `it has ${uncounted ? 'more than ' : ''}${say(names.length)} files that are not ignored, and the office takes snapshots of folders `
            + `with up to ${say(settings.maxTreeFiles)} (OFFICE_CHECKPOINTS_MAX_TREE_FILES)`);
        }
        const all = await weigh(st.root, names, settings.maxTreeBytes);
        if (all.bytes > settings.maxTreeBytes) {
          return switchOff(st, `its files that are not ignored come to more than ${size(settings.maxTreeBytes)}, and the office takes snapshots of folders `
            + 'up to that size (OFFICE_CHECKPOINTS_MAX_TREE_BYTES)');
        }
      } else {
        if (uncounted || names.length > settings.maxFiles) {
          return { skip: `${uncounted ? 'more than ' : ''}${say(names.length)} new or changed files is more than one snapshot takes in `
            + `(${say(settings.maxFiles)}; OFFICE_CHECKPOINTS_MAX_FILES)`, code: 'files' };
        }
        if (st.written && !names.length) return taken(st.tree, head);       // nothing moved since the last one
        const weight = await weigh(st.root, names, settings.maxBytes);
        if (weight.bytes > settings.maxBytes) {
          return { skip: `its new and changed files come to more than ${size(settings.maxBytes)} (OFFICE_CHECKPOINTS_MAX_BYTES)`
            + (weight.largest ? `; the largest seen is ${redact(weight.largest.name, 200)}, ${size(weight.largest.size)}` : ''), code: 'bytes' };
        }
      }
      // Something would be stored now. Not if the office already keeps as much for this repository as it
      // may: then this session's snapshots end here. (Clearing out first can take a while; that is not
      // the snapshot being slow, and does not count against it.)
      const paused = Date.now();
      const over = await full(st);
      aside = Date.now() - paused;
      until += aside;
      if (over) return switchOff(st, over);
      // A repository inside the folder shows in that list as a name ending in "/" (git does not look
      // inside it to list files). It is kept out of the snapshot by name, so that git never has reason to.
      const inner = names.filter((name) => name.endsWith('/')).map((name) => `:(top,exclude,literal)${name.slice(0, -1)}`);
      // --ignore-errors: one unreadable file costs that file and not the snapshot. Git then exits 1 and has said which.
      const added = await git(st.root, ['add', '-A', '--ignore-errors', '--', '.', ...inner, ...apart], mine({ patterns: inner.length + apart.length > 0 }));
      if (added.timedOut || (!added.ok && added.code !== 1)) return failed('read the working tree', added);
      if (extra.length) await git(st.root, ['update-index', '--add', '--remove', '-z', '--stdin'], mine({ input: extra.join('\0') + '\0' }));
      if (/adding embedded git repository/.test(added.err)) {
        // One was made between the listing and the reading. It is taken out again before anything looks at it.
        const staged = await git(st.root, ['ls-files', '-z', '--stage'], mine());
        const links = namesOf(staged).filter((entry) => entry.startsWith('160000 ')).map((entry) => entry.slice(entry.indexOf('\t') + 1));
        if (links.length) await git(st.root, ['update-index', '--force-remove', '-z', '--stdin'], mine({ input: links.join('\0') + '\0' }));
      }
      st.warm = true;
      st.madeAt = made.get(st.key) || 0;
      // The index has moved on from the tree last written. (That tree is still named in `st.tree` meanwhile:
      // most of what the index holds is in it, and a tidying must not take those objects for unneeded.)
      st.written = false;
      const written = await git(st.root, ['write-tree'], mine());
      const tree = oidOf(written);
      if (!tree) {
        // An object the index counts on is not there (lost, or cleared away): the next snapshot starts over.
        if (!written.timedOut) st.warm = false;
        return failed('write the snapshot', written);
      }
      st.tree = tree;
      st.written = true;
      touched(st.key);                      // more may be kept now than when it was last counted
      recount(st).catch(() => {});          // not waited for: no turn should stand behind a count
      return taken(tree, head, added.code === 1 ? why(added) : '');
    } catch (err) {
      return { skip: `the snapshot failed: ${line(err?.message || String(err), 200)}`, code: 'git' };
    }
  }

  /**
   * A snapshot in the session's queue. Whoever asks while one is still waiting or
   * running is given that one — unless they need one that begins from now.
   */
  function shoot(st, fresh = false) {
    if (st.flying && !fresh) return st.flying;
    const job = enqueue(st, () => capture(st));
    st.flying = job;
    job.then(() => { if (st.flying === job) st.flying = null; });
    return job;
  }

  /** Why a turn has no record is said in its transcript once per kind of reason, not at every turn. */
  function tell(st, turn, code) {
    if (!turn.skipped || !code || code === 'off' || st.told.has(code)) return;
    st.told.add(code);
    st.note(`n:changes:${code}`, `No record of what turn ${turn.n} changed: ${turn.skipped}.`, { turn: turn.n });
  }

  /* ---- keeping house: all of it among the office's own files --------------------------- */

  /**
   * How much of the disk the office's directory for one repository takes, as git
   * counts it there (`count-objects`: the space its files occupy, which for many
   * small files is a good deal more than their lengths added up). It is someone's
   * disk, so it is counted rather than guessed.
   * → { bytes, objects }, or null when it cannot be counted.
   */
  async function measure(key) {
    const at = storeOf(key), move = moves.get(key) || 0;
    let kept = { bytes: 0, objects: 0 };                     // no directory, nothing kept
    if (fs.existsSync(path.join(at, 'objects'))) {
      const counted = await git(null, [`--git-dir=${at}`, 'count-objects', '-v']);
      if (!counted.ok) { sizes.delete(key); return null; }
      const n = (name) => Number(new RegExp(`^${name}: (\\d+)$`, 'm').exec(counted.out)?.[1] || 0);
      kept = { bytes: (n('size') + n('size-pack') + n('size-garbage')) * 1024, objects: n('count') + n('in-pack') };
    }
    // A count during which something was stored or removed is an answer, but not one to remember.
    if ((moves.get(key) || 0) === move) sizes.set(key, { ...kept, at: Date.now() });
    return kept;
  }

  /** The last count if nothing has been stored or removed since and it is recent, else a new one. */
  async function stored(key) {
    const known = sizes.get(key);
    if (known && Date.now() - known.at < SIZE_FRESH_MS) return { bytes: known.bytes, objects: known.objects };
    return measure(key);
  }

  /**
   * A snapshot has stored something: what the office keeps for this repository is
   * counted again (the next snapshot's look at the cap reads that count). If it
   * has become a lot, the session that took the snapshot is told — once per
   * repository for as long as this office runs, in a sentence: that there is a
   * copy, how big, and where.
   */
  async function recount(st) {
    if (toldKept.has(st.key) && !settings.maxStoreBytes) return;     // nothing left to say, and no cap to watch
    const kept = await measure(st.key);
    if (!kept || kept.bytes <= settings.noticeBytes || toldKept.has(st.key)) return;
    toldKept.add(st.key);
    const said = st.note('n:changes:kept', `To tell what turns change, the office keeps its own copy of this folder's files: ${size(kept.bytes)} so far, in ${line(storeOf(st.key), 300)}.`);
    if (said === false) toldKept.delete(st.key);          // its session had ended: the next one to add to it is told instead
  }

  /**
   * The cap on what the office keeps for one repository, looked at before a
   * snapshot stores anything. Over it, what no kept turn needs is cleared out
   * first: that may be all that is in the way. Still over, this session's
   * snapshots end — and so do those of each other session in that repository,
   * when it next has something to store. Nothing on record is given up to make
   * room, and what is on record stays readable.
   * → '' to go on, or why not, as the rest of a sentence.
   */
  async function full(st) {
    const cap = settings.maxStoreBytes;
    if (!cap) return '';
    let kept = sizes.get(st.key) || await measure(st.key);
    if (kept && kept.bytes > cap && Date.now() - (fullAt.get(st.key) || 0) > RETIDY_MS) {
      await sweep(st.key);
      kept = await measure(st.key);
      if (kept && kept.bytes > cap) fullAt.set(st.key, Date.now());
    }
    if (!kept || kept.bytes <= cap) { fullAt.delete(st.key); return ''; }
    return `the office already keeps ${size(kept.bytes)} for this repository, in ${line(storeOf(st.key), 300)}, and keeps no more than ${size(cap)} `
      + '(OFFICE_CHECKPOINTS_MAX_STORE_BYTES); what it has recorded stays readable';
  }

  /**
   * Let go of what no kept snapshot needs in one repository's object directory —
   * the whole directory once no session uses it. Objects younger than an hour are
   * left alone: a snapshot being taken right now may be made of them.
   */
  function sweep(key) {
    const next = (tidying.get(key) || Promise.resolve()).then(() => tidy(key))
      .catch((err) => { log.warn(`[checkpoints] could not tidy ${storeOf(key)}: ${err?.message || err}`); });
    tidying.set(key, next);
    return next;
  }

  async function tidy(key) {
    if (!STORE_KEY.test(String(key))) return;
    const at = storeOf(key);
    const users = Object.values(store.data.sessions).filter((rec) => rec.key === key);
    const here = [...live.values()].filter((st) => st.key === key);
    if (!users.length && !here.length) {
      await fs.promises.rm(at, { recursive: true, force: true });
      touched(key);
      return;
    }
    if (!fs.existsSync(path.join(at, 'objects'))) return;
    const needed = new Set();
    for (const rec of users) for (const turn of rec.turns) for (const snap of [turn.start, turn.end]) if (snap?.tree) needed.add(snap.tree);
    for (const st of here) if (st.tree) needed.add(st.tree);            // what a live session's index is made of
    // Every command here is given the office's own directory and no other.
    const own = (args, opt = {}) => git(null, [`--git-dir=${at}`, ...args], { timeout: 3 * QUERY_MS, ...opt });
    const failed = (what, r) => { log.warn(`[checkpoints] could not tidy ${at}: git could not ${what} (${why(r)}); nothing was removed`); };
    // There can be tens of thousands of trees to keep — every turn of every session on record — and a
    // command line has room for far fewer. So they are named to git as one tree that lists them, held by
    // one ref in the office's own directory for as long as the pruning takes. The ref is the only one the
    // office ever writes, it is never in the repository, and it is gone again a moment later.
    await own(['update-ref', '-d', KEEP]);                              // left by a tidying that was cut short
    let list = '';                                                      // the tree that lists them, once made
    if (needed.size) {
      const known = await own(['cat-file', '--batch-check'], { input: [...needed].join('\n') + '\n', maxOut: Math.max(LIST_BYTES, needed.size * 128) });
      if (!known.ok) { failed('look up the trees to keep', known); return; }
      // A tree on record whose objects are no longer there cannot be kept, and must not stop the rest.
      // The first is listed under a name no snapshot's tree can hold (git never takes a `.git` in), so the
      // list is no snapshot's tree either: it is ours alone, and can be removed by name when it has served.
      const listing = known.out.split('\n').map((row) => /^([0-9a-f]+) tree \d+$/.exec(row)?.[1]).filter(Boolean)
        .map((tree, i) => `040000 tree ${tree}\t${i ? `t${i}` : '.git'}\n`).join('');
      if (listing) {
        const listed = await own(['mktree'], { input: listing });
        list = oidOf(listed);
        if (!list) { failed('list the trees to keep', listed); return; }
        const held = await own(['update-ref', '--no-deref', KEEP, list]);
        if (!held.ok) { failed('hold on to the trees to keep', held); return; }
      }
    }
    const pruned = await own(['prune', `--expire=${graceSeconds > 0 ? `${graceSeconds}.seconds.ago` : 'now'}`]);
    await own(['update-ref', '-d', KEEP]);
    // The list itself would otherwise lie there until a tidying an hour from now: one more object each time.
    if (list) await fs.promises.rm(path.join(at, 'objects', list.slice(0, 2), list.slice(2)), { force: true }).catch(() => {});
    if (!pruned.ok) failed('clear out what is no longer needed', pruned);
    touched(key);
  }

  /* ---- a session's life -------------------------------------------------------------- */

  /**
   * A session has been created. Finds out whether its folder can be recorded and
   * takes a first snapshot at leisure, so the first turn does not pay for it.
   * @param {{id:string, cwd:string, note?:(key:string, text:string, extra?:object)=>(boolean|void)}} session
   *   `note` writes a notice into the session's record; false from it means nobody could be told any more
   * @returns {Promise<boolean>} whether this session's changes are being recorded
   */
  function open({ id, cwd, note }) {
    if (!SESSION_ID.test(String(id)) || live.has(id)) return Promise.resolve(false);
    const st = { id, cwd, note: typeof note === 'function' ? note : () => {}, root: '', key: '', sha256: false, keepOut: [],
      index: path.join(dir, `${id}.index`), off: '', placed: false, warm: false, tree: '', flying: null, slow: 0,
      written: false, madeAt: 0, told: new Set(), holds: new Set(), closed: false, trimmed: 0, untidy: false, chain: null };
    live.set(id, st);
    st.chain = place(st)
      .catch((err) => { refuse(st, `the office could not look at the folder (${line(err?.message || String(err), 160)})`); })
      .then(() => { st.placed = true; changed(); });
    const placed = st.chain.then(() => !st.off);
    shoot(st);
    return placed;
  }

  /**
   * A turn is about to be sent. Returns a promise the turn should wait for — it
   * settles when the working tree has been snapshotted or the wait is up,
   * whichever is first, and never rejects — or null when there is nothing to wait for.
   * (T3 Code does the same: "the provider turn waits on the baseline", within a budget.)
   */
  function turnStarted(id, n) {
    const st = live.get(id);
    if (!st || st.closed || (st.placed && st.off)) return null;
    const at = Date.now();
    let late = false, release;
    const hold = new Promise((resolve) => { release = resolve; });
    const timer = setTimeout(() => { late = true; release(); }, settings.holdMs);
    timer.unref?.();
    st.holds.add(release);
    const free = () => { clearTimeout(timer); st.holds.delete(release); release(); };
    const snapshot = shoot(st);
    enqueue(st, async () => {
      const snap = await snapshot;
      const inTime = !late;                    // decided while the agent is still waiting
      const rec = recordOf(id);
      if (!rec || !snap) { free(); return; }
      const turn = { n, at };
      rec.turns.push(turn);
      let code = snap.code;
      if (snap.skip) turn.skipped = snap.skip;
      else if (!inTime) {
        // Taken while the agent may already have been writing: not a "before" of anything.
        code = 'late';
        turn.skipped = `the snapshot before it was not ready when the turn began (it took ${say(snap.ms)} ms; a turn waits ${say(settings.holdMs)} ms: OFFICE_CHECKPOINTS_HOLD_MS)`;
      } else turn.start = kept(snap);
      if (rec.turns.length > settings.maxTurns) {
        // Turns past the cap are let go, and every so often what only they needed is cleared out (not waited for).
        st.trimmed += rec.turns.length - settings.maxTurns;
        rec.turns.splice(0, rec.turns.length - settings.maxTurns);
        if (st.trimmed >= TIDY_EVERY) { st.trimmed = 0; st.untidy = false; sweep(st.key); } else st.untidy = true;
      }
      store.save();
      free();                                  // the agent may go: where it starts from is on record
      tell(st, turn, code);
    }).then(free);                             // …and may go whatever became of the bookkeeping
    return hold;
  }

  /**
   * A turn has ended: snapshot the tree again and say what differs.
   * → the turn's `changes` transcript entry, or null when nothing changed or there is nothing to compare.
   */
  function turnEnded(id, n) {
    const st = live.get(id);
    if (!st || (st.placed && !recordOf(id))) return Promise.resolve(null);
    const snapshot = shoot(st, true);          // one begun before the turn ended cannot say how it ended
    return enqueue(st, async () => {
      const snap = await snapshot;
      const rec = recordOf(id);
      const turn = rec?.turns.find((t) => t.n === n);
      if (!turn || !snap) return null;
      return settle(st, rec, turn, snap);
    }).then((entry) => entry || null);
  }

  async function settle(st, rec, turn, snap) {
    if (snap.skip) {
      if (!turn.skipped) { turn.skipped = snap.skip; tell(st, turn, snap.code); }
      store.save();
      return null;
    }
    turn.end = kept(snap);
    store.save();
    if (!turn.start) return null;
    const sum = await summary(rec, turn.start.tree, turn.end.tree);
    if (sum.error || !sum.count) return null;
    const listed = sum.files.slice(0, ENTRY_FILES);
    return {
      turn: turn.n,
      // Paths pass the redactor like every other path in a transcript; the exact names are in the `changes` answer.
      files: listed.map((f) => ({ path: redact(f.path, 1024), status: f.status, ...(f.from ? { from: redact(f.from, 1024) } : {}),
        additions: f.additions, deletions: f.deletions, ...(f.binary ? { binary: true } : {}) })),
      more: sum.count - listed.length, additions: sum.additions, deletions: sum.deletions,
    };
  }

  /** The session has ended: let go of anything waiting, close what is open, and remove its index. */
  function close(id) {
    const st = live.get(id);
    if (!st || st.closed) return st ? st.chain : Promise.resolve();
    st.closed = true;
    for (const release of [...st.holds]) release();
    return enqueue(st, async () => {
      const rec = recordOf(id);
      const unended = rec ? rec.turns.filter((t) => !t.end && !t.skipped) : [];
      if (unended.length) {
        // A turn that never reported its end (the session died first) still gets one: the tree as it is now.
        const snap = await capture(st);
        for (const turn of unended) await settle(st, rec, turn, snap);
      }
      for (const suffix of ['', '.lock']) { try { fs.rmSync(st.index + suffix, { force: true }); } catch { /* not there */ } }
      live.delete(id);
      store.save();
      if (st.untidy) await sweep(st.key);      // turns past the cap were let go while it ran: their objects can go too
    });
  }

  /** The session's record has been pruned: its snapshots go with it — files of the office's own, nothing else. */
  async function forget(id) {
    if (!SESSION_ID.test(String(id))) return false;
    if (live.has(id)) await close(id);
    for (const suffix of ['', '.lock']) { try { fs.rmSync(path.join(dir, `${id}.index${suffix}`), { force: true }); } catch { /* not there */ } }
    const rec = store.data.sessions[id];
    if (!rec) return true;
    delete store.data.sessions[id];
    store.save();
    await sweep(rec.key);
    return true;
  }

  /**
   * At start: records of sessions the office no longer lists are dropped, a turn
   * the last run never saw end says so, no private index survives the process
   * that kept it warm, and an object directory no session uses any more is removed.
   * @param {Set<string>} known  ids of the sessions the harness still has a record of
   */
  function reconcile(known) {
    for (const [id, rec] of Object.entries(store.data.sessions)) {
      if (!known.has(id) || !STORE_KEY.test(String(rec?.key)) || !Array.isArray(rec.turns)) { delete store.data.sessions[id]; continue; }
      for (const turn of rec.turns) if (!turn.end && !turn.skipped) turn.skipped = 'the office stopped before this turn ended';
    }
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/^d_[a-f0-9]{12}\.index(?:\.lock)?$/.test(name)) fs.rmSync(path.join(dir, name), { force: true });
      }
    } catch { /* no such folder yet */ }
    const used = new Set(Object.values(store.data.sessions).map((rec) => rec.key));
    try {
      for (const name of fs.readdirSync(stores)) {
        if (STORE_KEY.test(name) && !used.has(name)) fs.rm(path.join(stores, name), { recursive: true, force: true }, () => {});
      }
    } catch { /* none yet */ }
    store.save();
  }

  /* ---- questions ------------------------------------------------------------------------ */

  /** What differs between two trees. Cached: a tree never changes. */
  async function summary(rec, from, to) {
    if (from === to) return NOTHING;
    const key = `${rec.key}:${from}:${to}`;
    const known = summaries.get(key);
    if (known) return known;
    const compare = ['diff-tree', '-r', '-M', '--no-ext-diff', '--no-textconv'];
    const r = await ours(rec, [...compare, '-z', '--raw', '--numstat', from, to]);
    if (!r.ok && !r.truncated) return { error: why(r) };
    const all = parseChanges(r.out, { cut: r.truncated });
    let count = all.length, additions = 0, deletions = 0;
    for (const f of all) { additions += f.additions; deletions += f.deletions; }
    if (r.truncated) {
      // The list was too long to read whole; the totals are one short line.
      const totals = parseShortstat((await ours(rec, [...compare, '--shortstat', from, to])).out);
      if (totals) ({ count, additions, deletions } = totals);
    }
    const result = Object.freeze({ files: Object.freeze(all.slice(0, FILES_LISTED).map((f) => Object.freeze(f))),
      count, additions, deletions, truncated: r.truncated || all.length > FILES_LISTED });
    if (summaries.size >= SUMMARIES_KEPT) summaries.delete(summaries.keys().next().value);
    summaries.set(key, result);
    return result;
  }

  async function view(rec, turn) {
    const base = { turn: turn.n, at: turn.at };
    const none = { files: [], count: 0, additions: 0, deletions: 0, truncated: false };
    if (!turn.start || !turn.end) {
      if (turn.skipped) return { ...base, ...none, skipped: turn.skipped };
      // Still running: there is a before and no after yet.
      return { ...base, ...none, pending: true, ...(turn.start ? { trees: { start: turn.start.tree } } : {}) };
    }
    const sum = await summary(rec, turn.start.tree, turn.end.tree);
    // The office's own files are all a snapshot is made of; if they are gone, say so for this turn and go on.
    if (sum.error) return { ...base, ...none, skipped: `its snapshots can no longer be read (${sum.error})` };
    const partial = turn.end.partial || turn.start.partial;
    return { ...base, files: sum.files, count: sum.count, additions: sum.additions, deletions: sum.deletions, truncated: sum.truncated,
      trees: { start: turn.start.tree, end: turn.end.tree },
      // HEAD moved while the turn ran — a commit, a checkout, a pull: some of these files may be git's doing.
      ...((turn.start.head || '') !== (turn.end.head || '') ? { head: { from: turn.start.head || null, to: turn.end.head || null } } : {}),
      ...(partial ? { partial } : {}) };
  }

  /** Let a session's queue empty before answering about it, so an answer includes the turn that has just ended. */
  async function caughtUp(id) {
    const st = live.get(id);
    if (st) await Promise.race([st.chain, wait(QUERY_MS)]);
  }

  /**
   * What each turn of a session changed.
   * @param {string} id  a session id the office issued
   * @param {{turn?:number|string}} [opt]  one turn only
   */
  async function changes(id, opt = {}) {
    await caughtUp(id);
    const rec = recordOf(id);
    const total = { turns: 0, files: 0, additions: 0, deletions: 0 };
    if (!rec) return { sessionId: id, recorded: false, reason: live.get(id)?.off || NO_RECORD, turns: [], total };
    let wanted = null;
    if (opt.turn !== undefined && opt.turn !== null && opt.turn !== '') {
      wanted = Number(opt.turn);
      if (!Number.isInteger(wanted) || wanted < 1) return { error: 'turn must be a turn number (1, 2, …)', status: 400 };
      if (!rec.turns.some((t) => t.n === wanted)) {
        return { error: `there is no record of turn ${wanted} (the last ${say(settings.maxTurns)} turns of a session are kept)`, status: 404 };
      }
    }
    const turns = [];
    const paths = new Set();
    for (const turn of rec.turns) {
      if (wanted !== null && turn.n !== wanted) continue;
      const v = await view(rec, turn);
      turns.push(v);
      if (!v.count) continue;
      total.turns += 1;
      total.additions += v.additions;
      total.deletions += v.deletions;
      for (const f of v.files) paths.add(f.path);
      // Beyond the files listed we cannot tell which are the same file again; count them as they come.
      total.files += v.count - v.files.length;
    }
    total.files += paths.size;
    // Where the office keeps this repository's snapshots, and how much of the disk that takes (left out when it cannot be counted).
    const kept = await stored(rec.key);
    return { sessionId: id, recorded: true, root: rec.root, store: storeOf(rec.key), ...(kept ? { stored: kept } : {}), turns, total,
      keeps: settings.maxTurns, ...(rec.off ? { off: rec.off } : {}) };
  }

  /**
   * The unified diff of one turn (`turn`), or from the start of one turn to the
   * end of a later one (`from`, `to`); of one path when `path` is given.
   * @param {string} id
   * @param {{turn?:number|string, from?:number|string, to?:number|string, path?:string, context?:number|string}} [opt]
   */
  async function diff(id, opt = {}) {
    await caughtUp(id);
    const rec = recordOf(id);
    if (!rec) return { error: `no record of what this session's turns changed: ${live.get(id)?.off || NO_RECORD}`, status: 404 };
    const given = (v) => v !== undefined && v !== null && v !== '';
    const single = given(opt.turn);
    if (!single && !(given(opt.from) && given(opt.to))) return { error: 'say which turn: ?turn=n, or ?from=a&to=b (start of a to end of b)', status: 400 };
    const a = Number(single ? opt.turn : opt.from), b = Number(single ? opt.turn : opt.to);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a) return { error: 'turns are numbers, and from must not come after to', status: 400 };
    let context = 3;
    if (given(opt.context)) {
      context = Number(opt.context);
      if (!Number.isInteger(context) || context < 0 || context > 100) return { error: 'context is a number of lines from 0 to 100', status: 400 };
    }
    const first = rec.turns.find((t) => t.n === a), last = rec.turns.find((t) => t.n === b);
    for (const [n, turn, side] of [[a, first, 'start'], [b, last, 'end']]) {
      if (!turn) return { error: `there is no record of turn ${n} (the last ${say(settings.maxTurns)} turns of a session are kept)`, status: 404 };
      if (!turn[side]) {
        return { error: turn.skipped ? `turn ${n} has no snapshot of its ${side}: ${turn.skipped}` : `turn ${n} is still running: it has no end to compare with yet`,
          status: 409 };
      }
    }
    const from = first.start.tree, to = last.end.tree;
    const answer = { sessionId: id, ...(single ? { turn: a } : {}), from: a, to: b, context };
    let only = [];
    if (given(opt.path)) {
      const wanted = String(opt.path);
      // A path is a place under the repository's root, as the `changes` answer spells it. It goes to git
      // after "--" and is matched literally, so it can never be read as an option or as a pattern.
      if (wanted.length > 4096 || wanted.includes('\0') || path.posix.isAbsolute(wanted) || /^[A-Za-z]:[\\/]/.test(wanted)
        || wanted.split('/').includes('..')) return { error: 'path must be a path inside the repository, as the changes list gives it', status: 400 };
      answer.path = wanted;
      // A rename is one file with two names; ask for both so git shows it as one change (T3 Code does the same).
      const sum = await summary(rec, from, to);
      const moved = sum.files?.find((f) => f.path === wanted && f.from);
      only = ['--', ...(moved ? [moved.from] : []), wanted];
    }
    if (from === to) return { ...answer, diff: '', truncated: false };
    const r = await ours(rec, ['-c', 'diff.suppressBlankEmpty=false', 'diff-tree', '-r', '-p', '-M', '--no-ext-diff', '--no-textconv',
      '--no-color', '--src-prefix=a/', '--dst-prefix=b/', `-U${context}`, from, to, ...only], { maxOut: settings.diffBytes });
    if (!r.ok && !r.truncated) return { error: `the snapshots of ${a === b ? `turn ${a}` : `turns ${a} to ${b}`} can no longer be read (${why(r)})`, status: 410 };
    let text = r.out;
    if (r.truncated) {
      // Cut at a line: half a line (or half a character) is worse than one line fewer.
      const end = text.lastIndexOf('\n');
      text = end >= 0 ? text.slice(0, end + 1) : text.replace(/�+$/, '');
    }
    return { ...answer, diff: text, truncated: r.truncated };
  }

  /* ---- for the harness --------------------------------------------------------------------- */

  /** Wait until everything asked of a session's snapshots so far has been done — a tidying it set off included. */
  function settled(id) {
    const st = live.get(id);
    return st ? st.chain.then(() => tidying.get(st.key)).then(() => undefined) : Promise.resolve();
  }

  async function stop() {
    const chains = [...live.keys()].map((id) => close(id));
    // Snapshots in flight are short; give them a moment, then stop whatever git is still running.
    await Promise.race([Promise.allSettled(chains), wait(Math.min(settings.timeoutMs, 4000))]);
    for (const child of running) { try { child.stop(); } catch { /* gone */ } }
    store.flush();
  }

  return {
    open, turnStarted, turnEnded, close, forget, reconcile, changes, diff, settled, stop,
    /** Is there a record to read for this session (live or finished)? */
    recorded: (id) => !!recordOf(id),
    /** For a live session: is it being recorded, and if not, why. */
    state: (id) => { const st = live.get(id); return st ? { placed: st.placed, recording: st.placed && !st.off, reason: st.off } : null; },
    /** Where the office keeps the objects of a session's snapshots (a directory of its own), or null. */
    storeOf: (id) => { const rec = recordOf(id); return rec ? storeOf(rec.key) : null; },
  };
}
