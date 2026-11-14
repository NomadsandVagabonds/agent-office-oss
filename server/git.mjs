// The Office — reading git, carefully.
//
// The office looks at the repositories its agents work in so it can say who
// is on which branch and which files two of them are both changing. It only
// ever *reads*: rev-parse, status, diff --name-only, worktree list. (The one
// writer, `addWorktree`, is at the bottom and is only reachable from a
// loopback-only endpoint that a person or agent calls on purpose.)
//
// Every call has a timeout, never takes git's optional locks (so it cannot
// make an agent's own `git commit` wait), never prompts, and never throws:
// a directory that is not a repository, a missing git binary and a slow disk
// all come back as "nothing to say".
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_OUT = 4 * 1024 * 1024;
// fsmonitor and friends are programs named by a repository's own config; a
// reader has no business starting them.
const SAFE = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false'];

function env() {
  return { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', GIT_PAGER: 'cat' };
}

/** Run git in `cwd`. Resolves { ok, out, code } — never rejects. */
export function git(cwd, args, opt = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    try {
      execFile('git', [...(opt.raw ? [] : SAFE), '-C', cwd, ...args],
        { timeout: opt.timeout ?? 4000, maxBuffer: MAX_OUT, env: env(), windowsHide: true },
        (err, stdout) => {
          if (err) return finish({ ok: false, out: String(stdout || ''), code: err.code ?? 1, timedOut: !!err.killed });
          finish({ ok: true, out: String(stdout || ''), code: 0 });
        });
    } catch {
      finish({ ok: false, out: '', code: 127 });
    }
  });
}

let hasGit = null;
/** Is there a git to ask? Checked once. */
export async function gitAvailable() {
  if (hasGit === null) {
    hasGit = await new Promise((resolve) => {
      try { execFile('git', ['--version'], { timeout: 3000 }, (err) => resolve(!err)); }
      catch { resolve(false); }
    });
  }
  return hasGit;
}

const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };

/**
 * Which checkout is this directory in?
 * → { root, gitDir, commonDir, linked } (linked = a `git worktree add` checkout), or null.
 */
export async function locate(cwd) {
  if (!cwd || typeof cwd !== 'string' || !path.isAbsolute(cwd)) return null;
  let stat = null;
  try { stat = fs.statSync(cwd); } catch { return null; }
  if (!stat.isDirectory()) return null;
  const r = await git(cwd, ['rev-parse', '--show-toplevel', '--absolute-git-dir', '--git-common-dir']);
  if (!r.ok) return null;
  const [top, gitDir, common] = r.out.split('\n').map((s) => s.trim());
  if (!top || !gitDir || !common) return null;
  const root = real(top);
  const commonDir = real(path.resolve(cwd, common));
  const dir = real(gitDir);
  return { root, gitDir: dir, commonDir, linked: dir !== commonDir };
}

/** One changed path from `git status`: M modified · A added · D deleted · R renamed · U unmerged · ? untracked. */
function entryState(xy) {
  if (xy.includes('U') || xy === 'AA' || xy === 'DD') return 'U';
  if (xy.includes('R') || xy.includes('C')) return 'R';
  if (xy.includes('A')) return 'A';
  if (xy.includes('D')) return 'D';
  return 'M';
}

/** Parse `git status --porcelain=v2 --branch -z`. Exported for the tests. */
export function parseStatus(out, limit = 400) {
  const info = { branch: null, detached: false, oid: null, upstream: null, ahead: 0, behind: 0,
    files: [], total: 0, truncated: false };
  const push = (p, state) => {
    info.total += 1;
    if (info.files.length < limit) info.files.push({ path: p, state }); else info.truncated = true;
  };
  const tokens = out.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    if (tok.startsWith('# ')) {
      // Without -z these are separate lines; with it they are NUL-terminated like everything else.
      for (const line of tok.split('\n')) {
        const m = /^# branch\.(\S+) (.*)$/.exec(line);
        if (!m) continue;
        if (m[1] === 'oid') info.oid = m[2] === '(initial)' ? null : m[2];
        else if (m[1] === 'head') { info.detached = m[2] === '(detached)'; info.branch = info.detached ? null : m[2]; }
        else if (m[1] === 'upstream') info.upstream = m[2];
        else if (m[1] === 'ab') {
          const ab = /^\+(\d+) -(\d+)$/.exec(m[2]);
          if (ab) { info.ahead = Number(ab[1]); info.behind = Number(ab[2]); }
        }
      }
      continue;
    }
    const kind = tok[0];
    if (kind === '1') {
      const parts = tok.split(' ');
      push(parts.slice(8).join(' '), entryState(parts[1]));
    } else if (kind === '2') {
      const parts = tok.split(' ');
      push(parts.slice(9).join(' '), 'R');
      i += 1;                                   // the next token is the path it was renamed from
    } else if (kind === 'u') {
      const parts = tok.split(' ');
      push(parts.slice(10).join(' '), 'U');
    } else if (kind === '?') {
      const p = tok.slice(2);
      if (!p.endsWith('/')) push(p, '?');        // a whole untracked directory is not "a file someone is editing"
    }
  }
  return info;
}

/** Branch, upstream distance and changed files of the checkout at `root`. */
export async function status(root, opt = {}) {
  const r = await git(root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=normal'],
    { timeout: opt.timeout ?? 6000 });
  if (!r.ok) return null;
  return parseStatus(r.out, opt.limit);
}

/** Paths changed on `head` since it forked from `other` (committed changes only). */
export async function changedSinceFork(root, other, head) {
  if (!other || !head || other === head) return [];
  const r = await git(root, ['diff', '--name-only', '-z', '--no-renames', `${other}...${head}`], { timeout: 6000 });
  if (!r.ok) return [];
  return r.out.split('\0').filter(Boolean);
}

/**
 * The branch this repository treats as its trunk: what origin's HEAD points at
 * if there is one, else a local `main` or `master`. → "origin/main" | "main" | null
 */
export async function trunk(root) {
  const r = await git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (r.ok && r.out.trim()) return r.out.trim();
  for (const name of ['main', 'master']) {
    const v = await git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);
    if (v.ok) return name;
  }
  return null;
}

/** How many commits `head` has that `base` does not. → number | null */
export async function commitsAhead(root, base, head = 'HEAD') {
  if (!base) return null;
  const r = await git(root, ['rev-list', '--count', `${base}..${head}`]);
  const n = r.ok ? Number(r.out.trim()) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** The commit a name points at, in full. → string | null */
export async function resolveCommit(root, name = 'HEAD') {
  const r = await git(root, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`]);
  return r.ok && r.out.trim() ? r.out.trim() : null;
}

/** Every checkout of the repository that `root` belongs to. */
export async function worktrees(root) {
  const r = await git(root, ['worktree', 'list', '--porcelain']);
  if (!r.ok) return [];
  const list = [];
  let cur = null;
  for (const line of r.out.split('\n')) {
    if (line.startsWith('worktree ')) { cur = { root: real(line.slice(9)), branch: null, oid: null, detached: false, bare: false }; list.push(cur); }
    else if (!cur) continue;
    else if (line.startsWith('HEAD ')) cur.oid = line.slice(5);
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '');
    else if (line === 'detached') cur.detached = true;
    else if (line === 'bare') cur.bare = true;
  }
  return list.filter((w) => !w.bare);
}

/* ---- the one writer ------------------------------------------------------ */

const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,80}$/;
/** A branch or worktree name we are willing to hand to git: no options, no "..", no odd characters. */
export function safeRefName(name) {
  const s = String(name || '').trim();
  if (!NAME_OK.test(s) || s.includes('..') || s.includes('//') || s.endsWith('/') || s.endsWith('.lock') || s.endsWith('.')) return null;
  return s;
}

/**
 * `git worktree add -b <branch> <dir> <base>` — a second checkout of the same
 * repository on its own new branch, so two agents stop sharing files.
 * Refuses to reuse a directory or a branch. → { ok, dir, branch, error? }
 */
export async function addWorktree(root, { dir, branch, base = 'HEAD' }) {
  const b = safeRefName(branch);
  if (!b) return { ok: false, error: 'branch name must be letters, digits, ".", "_", "-" or "/"' };
  if (base !== 'HEAD' && !safeRefName(base)) return { ok: false, error: 'base must be a branch, tag or commit name' };
  if (!path.isAbsolute(dir)) return { ok: false, error: 'directory must be absolute' };
  if (fs.existsSync(dir)) return { ok: false, error: `${dir} already exists` };
  const exists = await git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]);
  if (exists.ok) return { ok: false, error: `branch ${b} already exists` };
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const r = await git(root, ['worktree', 'add', '-b', b, dir, base], { timeout: 30000 });
  if (!r.ok) return { ok: false, error: 'git worktree add failed' + (r.timedOut ? ' (timed out)' : '') };
  return { ok: true, dir: real(dir), branch: b };
}
