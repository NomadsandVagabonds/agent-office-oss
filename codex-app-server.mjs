import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function existingFile(file) {
  try { return !!(file && fs.existsSync(file) && fs.statSync(file).isFile()); }
  catch { return false; }
}

function resolveCodexBinary() {
  const envVar = process.env.CODEX_BIN || '';
  const candidates = [
    envVar,
    '/Applications/Codex.app/Contents/Resources/codex',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existingFile(candidate)) return candidate;
  }
  return 'codex';
}

function normalizeRequest(req, index) {
  return {
    id: Number(req?.id) || (index + 2),
    method: String(req?.method || '').trim(),
    params: req?.params && typeof req.params === 'object' ? req.params : {},
  };
}

function parseJsonLines(chunk, state, onMessage) {
  state.buf += String(chunk || '');
  while (true) {
    const idx = state.buf.indexOf('\n');
    if (idx === -1) break;
    const line = state.buf.slice(0, idx).trim();
    state.buf = state.buf.slice(idx + 1);
    if (!line) continue;
    try { onMessage(JSON.parse(line)); } catch {}
  }
}

export async function codexAppServerRequest({ cwd, requests = [], timeoutMs = 15000 } = {}) {
  const queue = requests.map(normalizeRequest).filter((req) => req.method);
  if (!queue.length) return { ok: false, error: 'no requests' };
  const bin = resolveCodexBinary();
  const workdir = path.resolve(cwd || process.cwd());

  return await new Promise((resolve) => {
    const child = cp.spawn(bin, ['app-server', '--listen', 'stdio://'], {
      cwd: workdir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    const pending = new Set(queue.map((req) => req.id));
    const responses = new Map();
    const notifications = [];
    const stderr = [];
    const stdoutState = { buf: '' };
    const stderrState = { buf: '' };
    let settled = false;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { child.stdin.end(); } catch {}
      try { child.kill('SIGTERM'); } catch {}
      resolve({
        responses,
        notifications,
        stderr: stderr.join('\n').trim(),
        ...result,
      });
    };

    timer = setTimeout(() => {
      finish({ ok: false, error: 'timeout' });
    }, Math.max(1000, Number(timeoutMs) || 15000));

    child.on('error', (error) => {
      finish({ ok: false, error: error?.message || String(error) });
    });

    child.on('close', (code) => {
      if (!settled && pending.size > 0) {
        finish({
          ok: false,
          error: `app-server exited before responding (${code ?? 'unknown'})`,
        });
      }
    });

    child.stdout.on('data', (chunk) => {
      parseJsonLines(chunk, stdoutState, (msg) => {
        if (Object.prototype.hasOwnProperty.call(msg, 'id')) {
          responses.set(msg.id, msg);
          pending.delete(msg.id);
          if (!pending.size) finish({ ok: true });
          return;
        }
        notifications.push(msg);
      });
    });

    child.stderr.on('data', (chunk) => {
      parseJsonLines(chunk, stderrState, () => {});
      stderr.push(String(chunk || '').trim());
    });

    const init = {
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'office-companion', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      },
    };
    try {
      child.stdin.write(JSON.stringify(init) + '\n');
      for (const req of queue) child.stdin.write(JSON.stringify(req) + '\n');
    } catch (error) {
      finish({ ok: false, error: error?.message || String(error) });
    }
  });
}

export async function codexInjectThreadUserMessage({
  cwd,
  threadId,
  text,
  timeoutMs = 15000,
} = {}) {
  const message = String(text || '').trim();
  const id = String(threadId || '').trim();
  if (!id || !message) return { ok: false, error: 'threadId and text required' };
  const res = await codexAppServerRequest({
    cwd,
    timeoutMs,
    requests: [
      {
        method: 'thread/resume',
        params: { threadId: id },
      },
      {
        method: 'thread/inject_items',
        params: {
          threadId: id,
          items: [{
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: message }],
          }],
        },
      },
    ],
  });
  const resume = res.responses?.get(2);
  if (resume?.error) {
    return {
      ok: false,
      error: resume.error.message || 'resume failed',
      responses: res.responses,
      notifications: res.notifications,
      stderr: res.stderr,
    };
  }
  const response = res.responses?.get(3);
  if (!res.ok) return res;
  if (response?.error) {
    return {
      ok: false,
      error: response.error.message || 'inject failed',
      responses: res.responses,
      notifications: res.notifications,
      stderr: res.stderr,
    };
  }
  return res;
}
