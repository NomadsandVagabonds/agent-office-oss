import cp from 'node:child_process';

// Codex's sandbox can block Node's loopback fetch while still allowing curl to
// localhost. The Office helpers use this tiny transport so agents can talk to
// the daemon reliably from either Claude or Codex shells.
export function requestJson(url, opt = {}) {
  const method = (opt.method || 'GET').toUpperCase();
  const args = ['-s', '-X', method];
  const headers = opt.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  if (opt.body !== undefined) {
    args.push('--data-binary', typeof opt.body === 'string'
      ? opt.body : JSON.stringify(opt.body));
  }
  args.push('-w', '\n%{http_code}', url);
  const out = cp.execFileSync('curl', args, { encoding: 'utf8' });
  const cut = out.lastIndexOf('\n');
  const bodyText = cut >= 0 ? out.slice(0, cut) : out;
  const status = Number(cut >= 0 ? out.slice(cut + 1).trim() : 0) || 0;
  const body = bodyText ? JSON.parse(bodyText) : null;
  if (status >= 400) {
    throw new Error((body && (body.error || body.detail)) || `${status}`);
  }
  return body;
}
