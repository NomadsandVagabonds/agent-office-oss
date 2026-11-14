// The Office — harness: a secret per driven session.
//
// When the office starts an agent it hands that agent's office tools (the
// injected MCP server) a random token, and remembers only its hash, tied to the
// session. A request that carries the token is that session speaking — not
// "someone who knows its name". The token is revoked when the session ends and
// is never written to disk.
//
// What this is and is not, today: on a loopback-only office every local
// process is already trusted as the operator, so the token is not a wall. It
// is attribution — the office knows which agent is delegating, how deep in a
// chain it is, and it can refuse things agents must never do (answer a
// permission request, lift the pause) to anyone who presents one. See
// docs/HARNESS.md for what a networked office would need on top of this.
import crypto from 'node:crypto';

export const SESSION_HEADER = 'x-office-session';

const hash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export function createCredentials() {
  const byHash = new Map();          // sha256(token) → { sessionId, agentId, issuedAt }

  return {
    issue({ sessionId, agentId }) {
      const token = crypto.randomBytes(32).toString('base64url');
      byHash.set(hash(token), { sessionId, agentId, issuedAt: Date.now() });
      return token;
    },
    /** Who is calling, if they presented a live session token. A hash lookup, so timing says nothing. */
    resolve(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
      return byHash.get(hash(token)) || null;
    },
    revoke(sessionId) {
      for (const [key, scope] of byHash) if (scope.sessionId === sessionId) byHash.delete(key);
    },
    size: () => byHash.size,
  };
}
