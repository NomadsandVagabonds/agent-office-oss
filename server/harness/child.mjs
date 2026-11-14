// The Office — harness: the child process behind a driven session.
//
// An agent CLI is started directly (never through a shell), as the leader of
// its own process group, so that ending a session ends everything the agent
// started — its MCP servers, its shells, the dev server it left running — and
// not just the one process we hold a handle to. stderr is kept as a short tail:
// when an agent dies, its last words are usually the explanation.
import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STDERR_TAIL_CHARS = 8192;
const KILL_GRACE_MS = 1500;
const live = new Set();           // every process group we own, for the last-resort sweep on exit
let exitHooked = false;

function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  // If the daemon goes down without stop() having run, do not leave agents
  // working unattended. (A SIGKILLed daemon cannot do even this; ACP agents
  // exit when their stdin closes, which covers most of that case.)
  process.on('exit', () => { for (const handle of live) handle.killNow(); });
}

/* The redaction below is adapted from T3 Code's ACP stderr sanitiser
 * (packages/provider-acp/src/server/stderr.ts, MIT, © 2026 T3 Tools Inc. — see NOTICE):
 * the same idea and patterns, rewritten for plain JavaScript. */
const SECRET_PATTERNS = [
  [/\bBearer\s+[A-Za-z0-9._\-+=/]{8,}/gi, 'Bearer [redacted]'],
  [/\bAuthorization:\s*Basic\s+\S+/gi, 'Authorization: Basic [redacted]'],
  [/\b(x-api-key|api[-_]?key|access[-_]?token|secret)\s*[:=]\s*["']?[A-Za-z0-9._\-+/]{12,}["']?/gi, '$1=[redacted]'],
  [/\b(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{7,}|gh[pousr]_[A-Za-z0-9]{16,}|xox[a-zA-Z]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})\b/g, '[redacted]'],
];

/** Make text from an agent safe to show and store: no home path, no obvious credentials, no control bytes. */
export function redact(text, max = 4000) {
  let out = String(text ?? '').replace(/\u0000/g, '');
  const home = os.homedir();
  if (home && home.length > 1) out = out.split(home).join('~');
  for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
  // eslint-disable-next-line no-control-regex
  out = out.replace(/\x1b\[[0-9;:]*[A-Za-z]/g, '').replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return out.length > max ? out.slice(0, max - 1) + '…' : out;
}

/** The line of stderr most likely to explain a death: the last error-looking one, else the last line. */
export function stderrExcerpt(tail) {
  const lines = redact(tail, STDERR_TAIL_CHARS).split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (!lines.length) return '';
  const errorAt = lines.findLastIndex((l) => /^(?:[a-z]*error|fatal|panic)(?: ?\[[^\]]+\])?:\s*\S/i.test(l));
  return (lines[errorAt === -1 ? lines.length - 1 : errorAt] || '').slice(0, 500);
}

/** Resolve a bare command name against PATH without running anything. */
export function whichSync(command, env = process.env) {
  if (!command) return null;
  if (command.includes(path.sep)) {
    try { fs.accessSync(command, fs.constants.X_OK); return path.resolve(command); } catch { return null; }
  }
  const exts = process.platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      try { fs.accessSync(candidate, fs.constants.X_OK); if (fs.statSync(candidate).isFile()) return candidate; }
      catch { /* keep looking */ }
    }
  }
  return null;
}

/**
 * Start an agent process.
 * @returns {{child:import('child_process').ChildProcess, pid:number|null, stderr:()=>string,
 *            exited:Promise<{code:number|null, signal:string|null, error:string|null}>,
 *            kill:(graceMs?:number)=>Promise<void>, killNow:()=>void}}
 */
export function spawnAgent({ command, args = [], cwd, env }) {
  hookExit();
  const posix = process.platform !== 'win32';
  const child = cp.spawn(command, args, {
    cwd, env, shell: false, windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: posix,              // its own process group, so the whole tree can be signalled
  });
  let tail = '';
  let gone = false;
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk) => {
    tail = (tail + chunk).slice(-STDERR_TAIL_CHARS);
  });
  child.stderr?.on('error', () => {});
  child.stdin?.on('error', () => {});          // EPIPE is reported through the rpc peer

  const signalTree = (signal) => {
    if (gone || !child.pid) return false;
    try {
      if (posix) process.kill(-child.pid, signal); else child.kill(signal);
      return true;
    } catch {
      try { child.kill(signal); return true; } catch { return false; }
    }
  };

  const handle = {
    child,
    pid: child.pid || null,
    stderr: () => tail,
    killNow: () => { signalTree('SIGKILL'); },
    exited: null,
    /** Ask nicely, then insist. Resolves when the process is gone. */
    kill(graceMs = KILL_GRACE_MS) {
      if (gone) return Promise.resolve();
      try { child.stdin?.end(); } catch { /* already closed */ }
      signalTree('SIGTERM');
      const timer = setTimeout(() => signalTree('SIGKILL'), graceMs);
      if (typeof timer.unref === 'function') timer.unref();
      return handle.exited.then(() => { clearTimeout(timer); });
    },
  };
  handle.exited = new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      gone = true;
      live.delete(handle);
      // The leader is gone; anything it left behind in its group goes with it.
      if (posix && child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already empty */ } }
      resolve(result);
    };
    child.once('error', (err) => finish({ code: null, signal: null, error: err?.code === 'ENOENT'
      ? `${command} is not installed (or not on PATH)` : String(err?.message || err) }));
    child.once('exit', (code, signal) => finish({ code, signal, error: null }));
  });
  live.add(handle);
  return handle;
}
