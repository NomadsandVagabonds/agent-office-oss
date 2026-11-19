import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorker } from '../tools/blockrooms/profiles/worker.mjs';
import { proxy } from '../api/archive.mjs';
import { SESSION, FLOW } from '../tools/blockrooms/profiles/protocol.mjs';
import { accountConfig } from '../tools/blockrooms/account-config.mjs';
const { DatabaseSync } = await import('node:sqlite').catch(() => ({}));
const check = (name, fn) => test(name, { skip: !DatabaseSync && 'requires Node 22 SQLite' }, fn);

const site = 'https://blockrooms.example', key = 'test-key-with-more-than-32-characters';
function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../tools/blockrooms/profiles/migrations/0001_profiles.sql', import.meta.url),'utf8'));
  t.after(() => sql.close());
  const DB = {
    prepare(statement) { return { bind(...args) { const stmt = sql.prepare(statement); return {
      first: () => stmt.get(...args) || null, run: () => stmt.run(...args),
    }; } }; }, batch: stmts => stmts.map(s => s.run()),
  };
  const env = { DB, PROFILE_KEY: key, SITE_ORIGIN: site, EMAIL_FROM: 'archive@example.invalid',
    RESEND_API_KEY: 'test', GOOGLE_CLIENT_ID: 'local', GOOGLE_CLIENT_SECRET: 'local' };
  const mail = [], calls = [];
  let identity = { sub: 'google-123', email: 'test@gmail.com', email_verified: true };
  let now = 1760012345;
  const worker = createWorker({ clock: () => now, transport: async (url, init) => {
    calls.push(url);
    if (url === 'https://api.resend.com/emails') { mail.push(JSON.parse(init.body)); return Response.json({id:'test'}); }
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({access_token:'google-test'});
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return Response.json(identity);
    throw Error('Unexpected network request');
  } });
  async function call(query, body, cookies = '', extra = {}) {
    const headers = { origin:site, cookie:cookies, 'content-type':'application/json', 'x-vercel-forwarded-for':'192.0.2.3', ...extra };
    const req = new Request(site+'/api/archive'+query,{ method:body === undefined ? 'GET' : 'POST',headers,body:JSON.stringify(body) });
    return proxy(req, {BLOCKROOMS_PROFILE_WORKER:'https://worker.invalid',BLOCKROOMS_PROFILE_KEY:key},
      (url,init) => worker.fetch(new Request(url,init),env));
  }
  const post = (action,body,cookies) => call('?action='+action,body,cookies);
  const latestCode = () => mail.at(-1).text.match(/\b\d{6}\b/)[0];
  async function login(email) {
    assert.equal((await post('email',{email})).status,200);
    const res = await post('verify',{email,code:latestCode()});
    assert.equal(res.status,200);
    const cookies = res.headers.getSetCookie()[0].split(';')[0];
    const { user } = await (await call('?action=session',undefined,cookies)).json();
    return {user,cookies};
  }
  return { login,call,post,latestCode,mail,calls,env,worker,sql, tick:n=>now+=n, identity:v=>identity=v };
}
check('guest access, OTP verification and private revision-checked archives on two devices',async t=>{
  const f=fixture(t), email='alice@example.invalid';
  assert.deepEqual((await (await f.call('?action=session')).json()).user,null);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM players').get().n,0);
  const a=await f.login(email);
  assert.match(a.cookies,new RegExp('^'+SESSION+'='));
  assert.equal((await f.post('verify',{email,code:f.latestCode()})).status,400);
  const input={owner:a.user.id,revision:0,document:{v:1,counts:{a:{runs:1}},name:{value:'Ruby'}}};
  assert.equal((await (await f.post('save',input,a.cookies)).json()).accepted,true);
  f.tick(60);
  const second=await f.login(email);
  assert.notEqual(a.cookies,second.cookies);
  assert.equal(second.user.id,a.user.id);
  assert.deepEqual((await (await f.post('read',{owner:a.user.id},second.cookies)).json()).document,input.document);
  assert.equal((await (await f.post('save',input,second.cookies)).json()).accepted,false);
  const other=await f.login('other@example.invalid');
  for (const cookie of [other.cookies,'']) assert.equal((await f.post('save',input,cookie)).status,401);
  assert.equal((await f.post('read',{owner:a.user.id},other.cookies)).status,401);
  assert.equal((await f.post('save',{...input,document:{v:1,text:'x'.repeat(262144)}},a.cookies)).status,413);
  assert.equal((await f.call('?action=logout',{},a.cookies,{origin:'https://elsewhere.invalid'})).status,403);
  await f.post('logout',{},a.cookies);
  assert.equal((await f.post('read',{owner:a.user.id},a.cookies)).status,401);
  assert.equal((await f.post('read',{owner:a.user.id},second.cookies)).status,200);
  assert.equal(f.sql.prepare('SELECT sum(saved_a_visit) n FROM signups_by_day').get().n,1);
  f.tick(61*86400);
  assert.equal((await f.post('read',{owner:a.user.id},second.cookies)).status,401);
  await f.worker.scheduled(null,f.env);
  assert.equal(f.sql.prepare('SELECT count(*) n FROM sessions').get().n,0);
});
check('codes expire, have a resend cooldown, five attempts, and one concurrent winner',async t=>{
  const f=fixture(t), email='a@example.invalid';
  await f.post('email',{email});
  assert.equal((await f.post('email',{email})).status,429);
  assert.equal(f.mail.length,1);
  const wrong=f.latestCode()==='000000'?'111111':'000000';
  for(let i=0;i<5;i++) assert.equal((await f.post('verify',{email,code:wrong})).status,400);
  assert.equal((await f.post('verify',{email,code:f.latestCode()})).status,400);
  f.tick(60); await f.post('email',{email}); f.tick(600);
  assert.equal((await f.post('verify',{email,code:f.latestCode()})).status,400);
  await f.post('email',{email});
  const results=await Promise.all(Array.from({length:3},()=>f.post('verify',{email,code:f.latestCode()})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400,400]);
});
check('Google callback binds PKCE and browser state; only Google-hosted mailboxes link by email',async t=>{
  const f=fixture(t), a=await f.login('test@gmail.com');
  async function start() {
    const res=await f.post('google',{}), url=new URL((await res.json()).url);
    const cookie=res.headers.getSetCookie()[0].split(';')[0];
    assert.equal(cookie.split('=')[0],FLOW);
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    assert.equal(url.searchParams.get('redirect_uri'),site+'/api/archive');
    return {cookie,query:'?code=google-test&state='+url.searchParams.get('state')};
  }
  const flow=await start();
  assert.match((await f.call(flow.query)).headers.get('location'),/failed/);
  assert.equal(f.calls.includes('https://oauth2.googleapis.com/token'),false);
  const ok=await f.call(flow.query,undefined,flow.cookie);
  assert.equal(ok.headers.get('location'),site+'/archive');
  const session=ok.headers.getSetCookie().find(v=>v.startsWith(SESSION+'='));
  assert.match(session,/HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await (await f.call('?action=session',undefined,session.split(';')[0])).json()).user.id,a.user.id);
  f.identity({sub:'third-party',email:'me@example.invalid',email_verified:true});
  const other=await start(), rejected=await f.call(other.query,undefined,other.cookie);
  assert.match(rejected.headers.get('location'),/signin=email$/);
  const link=rejected.headers.getSetCookie().find(v=>v.startsWith('__Host-br_link=')).split(';')[0];
  assert.equal(rejected.headers.getSetCookie().some(v=>v.startsWith(SESSION+'=')),false);
  await f.post('email',{email:'me@example.invalid'});
  assert.equal((await f.post('verify',{email:'me@example.invalid',code:f.latestCode()},link)).status,200);
  const repeat=await start();
  assert.equal((await f.call(repeat.query,undefined,repeat.cookie)).headers.get('location'),site+'/archive');
});
check('disabled providers, private Worker gate and public build config',async t=>{
  const f=fixture(t); delete f.env.RESEND_API_KEY;
  assert.deepEqual((await (await f.call('?action=session')).json()).providers,{google:true,email:false});
  assert.equal((await f.post('email',{email:'a@example.invalid'})).status,503);
  assert.equal((await f.worker.fetch(new Request(site+'/api/archive?action=session'),f.env)).status,401);
  assert.deepEqual(accountConfig({BLOCKROOMS_ACCOUNTS:'cloudflare',BLOCKROOMS_PROFILE_KEY:key}),{enabled:true,provider:'cloudflare'});
});
