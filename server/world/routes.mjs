// The Office — world endpoints. The 3D client reads the snapshot and listens
// to the bus; agents act through look / go / use / emote / say.
import { HttpError } from '../http.mjs';

export function registerWorldRoutes(router, ctx) {
  const { world } = ctx;
  const who = (ref) => ctx.requireAgent(ref);
  const optionalAgent = (ref) => (ref ? ctx.agents.resolveRef(ref) : null);
  const seen = (agent) => { if (agent) ctx.agents.seen(agent.id); return agent; };

  router.get('/api/world', () => world.snapshot(),
    { about: 'The whole 3D world: floor plan, where everyone is, what is on display, what has been found.' });

  router.get('/api/world/look', (c) => {
    const agent = seen(who(c.query.get('agent') || ''));
    return c.result(world.text.look(agent, c.query.get('at') || c.query.get('target') || ''));
  }, { about: 'See your surroundings as text (?agent=<id>&at=<thing|room|agent> to examine one thing).' });

  router.post('/api/world/go', async (c) => {
    const body = await c.json();
    const agent = seen(who(body.agent || body.agentId));
    const target = world.text.resolve(agent, body.to || body.target || '');
    if (!target && /^(the )?(lead|human|boss)$/i.test(String(body.to || '').trim())) {
      throw new HttpError(404, 'no human is walking the floor right now (office dm lead "…" still reaches them)');
    }
    if (!target) throw new HttpError(404, `no place or thing called "${body.to || ''}" (try GET /api/world/map)`);
    if (target.kind === 'cat' || target.kind === 'duck' || target.kind === 'window' || target.kind === 'elevator') {
      return c.result(world.text.examine(agent, body.to));
    }
    return c.result(world.go(agent, target, { stay: !!body.stay }));
  }, { about: 'Walk somewhere: {agent, to:"kitchen"|"coffee"|"<agent name>"|"home", stay?}.' });

  router.post('/api/world/use', async (c) => {
    const body = await c.json();
    const agent = seen(who(body.agent || body.agentId));
    return c.result(world.text.use(agent, body.thing || body.target || '', body.arg || body.text || ''));
  }, { about: 'Use a thing: {agent, thing:"coffee"|"bell"|"guestbook"|…, arg?}. You walk there first.' });

  router.post('/api/world/emote', async (c) => {
    const body = await c.json();
    return c.result(world.emote(seen(who(body.agent || body.agentId)), body.emote || body.name));
  }, { about: 'Express yourself: {agent, emote:"wave"|"dance"|"cheer"|…}.' });

  router.post('/api/world/say', async (c) => {
    const body = await c.json();
    return c.result(world.say(seen(who(body.agent || body.agentId)), body.text));
  }, { about: 'Say something aloud (a speech bubble, not mail): {agent, text}.' });

  router.get('/api/world/who', () => world.text.who(), { about: 'Who is here and what they are doing, as text.' });
  router.get('/api/world/map', (c) => world.text.map(optionalAgent(c.query.get('agent'))),
    { about: 'The floor plan as text.' });
  router.get('/api/world/passport', (c) => world.text.passport(seen(who(c.query.get('agent') || ''))),
    { about: 'Your discoveries, and hints toward the rest.' });

  router.post('/api/world/place', async (c) => {
    const body = await c.json();
    const agent = seen(who(body.agent || body.agentId));
    const slot = body.slot === undefined || body.slot === null ? undefined : Number(body.slot);
    return c.result(world.placeOnShelf(agent, body.creationId === null ? null : String(body.creationId || ''), slot));
  }, { about: 'Put a creation on your team shelf: {agent, creationId, slot?} (creationId:null clears a slot).' });

  /* ---- the long game: keycards, the coin jar, the machine (core/game.mjs) ---- */
  router.get('/api/world/game', () => ({ ...world.game.view(), shelf: world.game.shelf().prizes, text: world.game.describe() }),
    { about: 'The long game: which lift buttons are lit, keycards and coins found, what is in the jar, what the vending machine sells.' });
  router.post('/api/world/game/collect', async (c) => {
    const body = await c.json();
    return c.result(world.game.collect(body.hideout || body.level, body.item, body.n, optionalAgent(body.agent), { name: body.name }));
  }, { about: 'Pick up something hidden on a floor: {hideout, item:"card"|"coin", n? (which coin), name?}.' });
  router.post('/api/world/game/visit', async (c) => c.result(world.game.visit((await c.json()).floor)),
    { about: 'A newly lit floor has been ridden to: {floor}.' });
  router.post('/api/world/game/buy', async (c) => {
    const body = await c.json();
    return c.result(world.game.buy(body.prize || body.slot, optionalAgent(body.agent), { name: body.name }));
  }, { about: 'Buy from the vending machine with coins from the jar: {prize: id or shelf code ("B2"), name?}.' });

  // Things a human does with a click (an agent may pass its id to get credit).
  router.post('/api/world/discover', async (c) => {
    const body = await c.json();
    return c.result(world.discover(String(body.secret || ''), optionalAgent(body.agent), { name: body.name }));
  }, { about: 'Record a discovery: {secret, agent?, name?}.' });

  router.post('/api/world/lead/use', async (c) => {
    const body = await c.json();
    const thing = String(body.thing || '').slice(0, 80);
    if (!thing) throw new HttpError(400, 'thing required');
    return c.result(world.text.use(world.leadActor(body.id, body.name), thing, body.arg ? String(body.arg).slice(0, 200) : undefined));
  }, { about: 'A human uses a thing while walking the floor: {thing, arg?, id?, name?}. Same rules and discoveries as an agent.' });

  router.post('/api/world/pet', async (c) => {
    const body = await c.json();
    return c.result(world.petCat(optionalAgent(body.agent), body.name));
  }, { about: 'Pet the office cat.' });

  router.post('/api/world/guestbook', async (c) => {
    const body = await c.json();
    return c.result(world.signGuestbook(optionalAgent(body.agent), body.name, body.text));
  }, { about: 'Sign the guestbook: {text, name?|agent?}.' });

  router.post('/api/world/arcade', async (c) => {
    const body = await c.json();
    return c.result(world.arcadeScore(optionalAgent(body.agent), body.name, body.score));
  }, { about: 'Post a BUG SQUASH score: {score, name?|agent?}.' });

  router.post('/api/world/disco', async (c) => {
    const body = await c.json();
    return world.disco(Number(body.seconds) || 22);
  }, { about: 'Lights down, mirror ball up.' });

  router.post('/api/world/bell', async () => {
    world.fx({ kind: 'bell', by: 'lead' });
    return { ok: true, rings: world.bumpStat('bellRings') };
  }, { about: 'Ring the reception bell.' });

  router.post('/api/world/stat', async (c) => {
    const body = await c.json();
    const name = String(body.name || '');
    if (!['coffees', 'vends', 'prints', 'treeWaterings'].includes(name)) throw new HttpError(400, 'unknown counter');
    return { ok: true, name, value: world.bumpStat(name) };
  }, { hidden: true });

  router.delete('/api/world/rooms/:deptId', (c) => c.result(world.closeRoom(c.params.deptId)),
    { about: 'Clear out an empty project room.' });
}
