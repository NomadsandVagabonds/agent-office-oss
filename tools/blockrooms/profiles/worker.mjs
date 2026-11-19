import { json, Problem, MAX_SAVE, nowSeconds, readJson, hash } from './protocol.mjs';
import { providers, sessionUser, signOut, sendCode, verifyCode, startGoogle, finishGoogle } from './auth.mjs';

async function profile(db, userId, body, write, now) {
  if (write) {
    const doc = body.document;
    if (!doc || doc.v !== 1 || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Problem(400, 'Invalid archive.');
    const payload = JSON.stringify(doc);
    if (new TextEncoder().encode(payload).length > MAX_SAVE) throw new Problem(413, 'Archive too large.');
    const updated = await db.prepare(`UPDATE players SET document=?,revision=revision+1,last_save=? WHERE id=? AND revision=? RETURNING revision`)
      .bind(payload,now,userId,body.revision).first();
    if (updated) return json({ accepted: true, revision: updated.revision, document: doc });
  }
  const current = await db.prepare('SELECT document,revision FROM players WHERE id=?').bind(userId).first();
  return json({ accepted: false, document: JSON.parse(current.document), revision: current.revision });
}
export function createWorker({ transport = fetch, clock = nowSeconds } = {}) {
  return { async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname !== '/api/archive') return json({error:'Unknown endpoint.'},404);
      if (!env.DB || !env.SITE_ORIGIN || (env.PROFILE_KEY || '').length < 32) return json({error:'Cloud saves are offline.'},503);
      if (await hash(request.headers.get('authorization') || '') !== await hash('Bearer '+env.PROFILE_KEY)) return json({error:'Unauthorized.'},401);
      const now = clock(), action = url.searchParams.get('action');
      if (request.method === 'GET' && !action) return await finishGoogle(request,env,now,transport);
      if (request.method === 'GET' && action === 'session') return json({ user: await sessionUser(request,env.DB,now), providers: providers(env) });
      if (request.method !== 'POST') return json({error:'Method unavailable.'},405);
      const body = await readJson(request, action === 'save' ? MAX_SAVE + 1024 : 2048);
      switch (action) {
        case 'google': if (providers(env).google) return await startGoogle(env); break;
        case 'email': if (providers(env).email) return await sendCode(request,env,body.email,now,transport); break;
        case 'verify': if (providers(env).email) return await verifyCode(request,env,body,now); break;
        case 'logout': return await signOut(request,env);
        case 'read': case 'save': {
          const user = await sessionUser(request,env.DB,now);
          if (!user || user.id !== body.owner) throw new Problem(401,'Sign in again to sync.');
          return await profile(env.DB,user.id,body,action === 'save',now);
        }
        default: throw new Problem(404,'Unknown action.');
      }
      throw new Problem(503,'This sign-in method is offline.');
    } catch (error) {
      return json({error: error instanceof Problem ? error.message : 'Cloud saves are offline.'},error instanceof Problem ? error.status : 503);
    }
  }, async scheduled(_event, env) {
    const now = clock();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires<=?').bind(now),
      env.DB.prepare('DELETE FROM google_links WHERE expires<=?').bind(now),
      env.DB.prepare('DELETE FROM email_challenges WHERE issued<=?').bind(now-600),
      env.DB.prepare('DELETE FROM send_limits WHERE expires<=?').bind(now),
    ]);
  } };
}
export default createWorker();
