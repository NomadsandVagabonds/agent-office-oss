import { SESSION, FLOW, LINK, cookie, setCookie, json, Problem, randomToken, hash, keyedHash } from './protocol.mjs';

const sessionLife = 60 * 24 * 60 * 60;
export const providers = env => ({ google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: !!(env.RESEND_API_KEY && env.EMAIL_FROM) });
function address(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new Problem(400, 'Enter a valid email address.');
  return email;
}
function sixDigits() {
  // Rejection sampling keeps each of the one million codes equally likely.
  let n;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, '0');
}
export async function sessionUser(request, db, now) {
  const token = cookie(request, SESSION);
  if (!/^[\w-]{43}$/.test(token)) return null;
  return db.prepare('SELECT p.id,p.email FROM sessions s JOIN players p ON p.id=s.player_id WHERE s.digest=? AND s.expires>?')
    .bind(await hash(token), now).first();
}
async function signIn(env, email, subject, now, response = json({ ok: true })) {
  // A Google subject is stable across email renames. Only an authoritative
  // Google address can be linked to an email-code account.
  let player;
  if (subject) {
    player = await env.DB.prepare('UPDATE players SET email=?,last_sign_in=? WHERE google_sub=? RETURNING id,email').bind(email,now,subject).first();
  }
  if (!player) {
    player = await env.DB.prepare(`INSERT INTO players(id,email,google_sub,signup_method,signed_up,last_sign_in) VALUES(?,?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET google_sub=coalesce(players.google_sub,excluded.google_sub),last_sign_in=excluded.last_sign_in
      WHERE excluded.google_sub IS NULL OR players.google_sub IS NULL OR players.google_sub=excluded.google_sub RETURNING id,email`)
      .bind(crypto.randomUUID(), email, subject, subject ? 'google' : 'email', now, now).first();
  }
  if (!player) throw new Problem(409, 'Please sign in with an email code.');
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions(digest,player_id,expires) VALUES(?,?,?)').bind(await hash(token),player.id,now+sessionLife).run();
  response.headers.append('set-cookie', setCookie(SESSION, token, sessionLife));
  return response;
}
export async function signOut(request, env) {
  const token = cookie(request, SESSION);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE digest=?').bind(await hash(token)).run();
  const res = json({ ok: true });
  res.headers.append('set-cookie', setCookie(SESSION,'',0));
  res.headers.append('set-cookie', setCookie(LINK,'',0));
  return res;
}
async function allowSend(db, key, max, expires) {
  const row = await db.prepare(`INSERT INTO send_limits(bucket,count,expires) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count`).bind(key,expires,max).first();
  if (!row) throw new Problem(429, 'Too many code requests. Please try again later.');
}
export async function sendCode(request, env, value, now, transport) {
  const email = address(value);
  const hour = Math.floor(now/3600), day = Math.floor(now/86400);
  const ipBucket = await keyedHash(env.PROFILE_KEY, 'ip/' + hour + '/' + request.headers.get('x-archive-client-ip'));
  await allowSend(env.DB, ipBucket, 10, (hour+1)*3600);
  const code = sixDigits();
  const digest = await keyedHash(env.PROFILE_KEY, 'otp/' + email + '/' + code);
  const fresh = await env.DB.prepare(`INSERT INTO email_challenges(email,digest,issued,remaining,used) VALUES(?,?,?,5,0)
    ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,issued=excluded.issued,remaining=5,used=0
    WHERE issued<=excluded.issued-60 RETURNING issued`).bind(email,digest,now).first();
  if (!fresh) throw new Problem(429, 'Wait a minute before requesting another code.');
  try {
    // Keeps even an unexpectedly busy site within a dedicated free sender's allowance.
    await allowSend(env.DB, 'mail/' + day, 90, (day+1)*86400);
    const res = await transport('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: 'Your BlockRooms sign-in code',
        text: 'Your BlockRooms sign-in code is ' + code + '. Enter it in the tab where you requested it. It expires in ten minutes. If you did not request it, you can ignore this email.' }) });
    if (!res.ok) throw new Problem(503, 'The code could not be delivered. Please try again later.');
    return json({ ok: true });
  } catch (error) {
    await env.DB.prepare('DELETE FROM email_challenges WHERE email=? AND digest=? AND issued=?').bind(email,digest,now).run();
    throw error;
  }
}
export async function verifyCode(request, env, body, now) {
  const email = address(body.email);
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new Problem(400, 'Enter the six-digit code.');
  const digest = await keyedHash(env.PROFILE_KEY, 'otp/' + email + '/' + body.code);
  const result = await env.DB.prepare(`UPDATE email_challenges SET remaining=remaining-1,used=(digest=?)
    WHERE email=? AND remaining>0 AND used=0 AND issued>? RETURNING used`).bind(digest,email,now-600).first();
  if (!result?.used) throw new Problem(400, 'That code is invalid or expired.');
  const link = cookie(request,LINK);
  const pending = link && await env.DB.prepare('DELETE FROM google_links WHERE digest=? AND email=? AND expires>? RETURNING google_sub')
    .bind(await hash(link), email, now).first();
  const res = await signIn(env,email,pending?.google_sub || null,now);
  if (link) res.headers.append('set-cookie',setCookie(LINK,'',0));
  return res;
}
export async function startGoogle(env) {
  const verifier = randomToken();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.SITE_ORIGIN + '/api/archive',
    response_type: 'code', scope: 'openid email', prompt: 'select_account', state: await hash('state/' + verifier),
    code_challenge_method: 'S256', code_challenge: await hash(verifier) });
  const res = json({ url: url.href });
  res.headers.append('set-cookie',setCookie(FLOW,verifier,600));
  return res;
}
export async function finishGoogle(request, env, now, transport) {
  const res = new Response(null, { status: 303, headers: { location: env.SITE_ORIGIN + '/archive?signin=failed', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  res.headers.append('set-cookie',setCookie(FLOW,'',0));
  const params = new URL(request.url).searchParams, verifier = cookie(request,FLOW);
  if (!providers(env).google || !/^[\w-]{43}$/.test(verifier) || params.get('state') !== await hash('state/' + verifier) || !params.get('code')) return res;
  try {
    const tokens = await transport('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
      grant_type: 'authorization_code', code: params.get('code'), code_verifier: verifier, client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: env.SITE_ORIGIN + '/api/archive' }) });
    if (!tokens.ok) return res;
    const { access_token } = await tokens.json();
    if (!access_token) return res;
    // Obtain identity directly from Google with the access token issued to this client.
    const info = await transport('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + access_token } });
    if (!info.ok) return res;
    const identity = await info.json();
    if (!identity.sub || identity.email_verified !== true) return res;
    const email = address(identity.email);
    if (!email.endsWith('@gmail.com') && !identity.hd) {
      const linked = await env.DB.prepare('SELECT id FROM players WHERE google_sub=? AND email=?').bind(identity.sub,email).first();
      if (!linked) {
        if (!providers(env).email) return res;
        const token = randomToken();
        await env.DB.prepare('INSERT INTO google_links(digest,google_sub,email,expires) VALUES(?,?,?,?)')
          .bind(await hash(token),identity.sub,email,now+600).run();
        res.headers.append('set-cookie',setCookie(LINK,token,600));
        res.headers.set('location',env.SITE_ORIGIN + '/archive?signin=email');
        return res;
      }
    }
    await signIn(env,email,identity.sub,now,res);
    res.headers.set('location',env.SITE_ORIGIN + '/archive');
  } catch { /* keep the generic failure redirect, without exposing a code or token */ }
  return res;
}
