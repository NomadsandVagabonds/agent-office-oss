// The Office — pastimes: the games agents play with each other, kept by the
// daemon. The rules are pure and live in core/pastimes.mjs; this is the table
// they are played on: who is in which game, whose move it is, and the story
// the office is writing a line at a time.
//
// Playing is office life (server/life.mjs): whoever makes a move is "playing"
// for a few minutes, with their mail held. Results are told once, in the
// #arcade lounge channel. There is no league table, on purpose.
import { JsonFile } from './persist.mjs';
import {
  PASTIMES, cleanStoryLine, isOver, joinGame, newGame, playMove, publicGame, renderGame, resultLine, storyRefusal,
} from '../core/pastimes.mjs';

const KEEP_FINISHED = 30;
const KEEP_STORY = 200;
const ARCADE = 'lounge:arcade';

export function createPastimes(ctx, file) {
  const store = new JsonFile(file, {
    defaults: () => ({ v: 1, games: [], story: [] }),
    validate: (d) => d && Array.isArray(d.games),
  });
  const state = store.data;
  state.story = Array.isArray(state.story) ? state.story : [];

  function save() {
    const finished = state.games.filter(isOver);
    if (finished.length > KEEP_FINISHED) {
      const drop = new Set(finished.slice(0, finished.length - KEEP_FINISHED).map((g) => g.id));
      state.games = state.games.filter((g) => !drop.has(g.id));
    }
    store.save();
  }

  const view = (game) => ({ ...publicGame(game), text: renderGame(game) });
  const get = (id) => state.games.find((g) => g.id === id) || null;
  const list = () => state.games.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const player = (agent) => ({ id: agent.id, name: agent.name });
  const tell = (content) => ctx.comms.sendChannelMessage({ channelId: ARCADE, content, author: 'Office', authorType: 'system' });
  const playing = (agent, what) => ctx.life?.begin(agent, 'game', { note: what });

  /** Games where it is this agent's move. */
  const waitingOn = (agentId) => list().filter((g) => g.status === 'active' && g.kind !== 'bulls' && g.players[g.turn]?.id === agentId)
    .map((g) => ({ id: g.id, kind: g.kind, name: PASTIMES[g.kind].name }));

  function start(agent, kind) {
    const wanted = String(kind || '').toLowerCase().trim();
    // One unfinished game of a kind per agent: starting again picks it back up.
    const mine = state.games.find((g) => g.kind === wanted && !isOver(g) && g.players[0]?.id === agent.id);
    if (mine) return { ok: true, resumed: true, game: view(mine), text: `(you already have one of these going)\n${renderGame(mine)}` };
    const made = newGame(wanted, player(agent));
    if (made.error) return made;
    state.games.push(made.game);
    save();
    playing(agent, PASTIMES[wanted].name);
    if (made.game.status === 'open') tell(`${agent.name} is looking for a ${PASTIMES[wanted].name} opponent. Join with: office play join ${made.game.id}`);
    return { ok: true, resumed: false, game: view(made.game),
      text: `${renderGame(made.game)}\n\n${PASTIMES[wanted].how}\nMove: office play move ${made.game.id} <move>` };
  }

  function join(agent, id) {
    const game = get(id);
    if (!game) return { error: 'no such game (office play lists what is on)', status: 404 };
    const joined = joinGame(game, player(agent));
    if (joined.error) return joined;
    save();
    playing(agent, PASTIMES[game.kind].name);
    tell(`${game.players[1].name} joined ${game.players[0].name} for ${PASTIMES[game.kind].name} (${game.id}). ${game.players[0].name} moves first.`);
    return { ok: true, game: view(game), text: renderGame(game) };
  }

  function move(agent, id, what) {
    const game = get(id);
    if (!game) return { error: 'no such game (office play lists what is on)', status: 404 };
    const played = playMove(game, player(agent), what);
    if (played.error) return played;
    save();
    playing(agent, PASTIMES[game.kind].name);
    if (played.finished) tell(resultLine(game));
    return { ok: true, finished: played.finished, game: view(game), text: renderGame(game) };
  }

  const storyLines = (limit = 12) => state.story.slice(-Math.max(1, Math.min(KEEP_STORY, Number(limit) || 12)));
  const storyText = (lines) => (lines.length ? lines.map((l) => `${l.text}\n    — ${l.byName}`).join('\n')
    : 'The story has not been started. The first line is yours: office play story add "…"');

  function addToStory(agent, text) {
    const clean = cleanStoryLine(text);
    if (!clean) return { error: 'a story line needs some words', status: 400 };
    const refusal = storyRefusal(state.story[state.story.length - 1], player(agent));
    if (refusal) return refusal;
    const entry = { by: agent.id, byName: agent.name, text: clean, at: Date.now() };
    state.story.push(entry);
    if (state.story.length > KEEP_STORY) state.story.splice(0, state.story.length - KEEP_STORY);
    save();
    playing(agent, 'the story');
    return { ok: true, line: entry, story: storyLines(), text: storyText(storyLines(4)) };
  }

  /** What is on, in words: the games there are, who is playing, where the story has got to. */
  function overview(agent) {
    const live = list().filter((g) => !isOver(g));
    const lines = ['Games'];
    for (const [id, p] of Object.entries(PASTIMES)) lines.push(`  ${id.padEnd(9)} ${p.name} (${p.players === 1 ? 'solo' : `${p.players} players`}). ${p.how}`);
    lines.push('  story     One story, written a line at a time by whoever stops by.', '');
    lines.push(live.length ? 'On now' : 'Nothing is being played right now. (office play new bulls · office play new fourline)');
    for (const g of live) {
      const state2 = g.status === 'open' ? 'needs a second player' : g.kind === 'bulls' ? `${g.guesses.length} guess${g.guesses.length === 1 ? '' : 'es'} in`
        : `${g.players[g.turn].name} to move`;
      const yours = agent && g.players.some((p) => p.id === agent.id);
      lines.push(`  ${g.id}  ${PASTIMES[g.kind].name} · ${g.players.map((p) => p.name).join(' vs ')} · ${state2}${yours ? ' · yours' : ''}`);
    }
    const last = state.story[state.story.length - 1];
    if (last) lines.push('', `The story so far ends: “${last.text}” (office play story)`);
    return { ok: true, kinds: PASTIMES, games: list().map(view), story: storyLines(), yourMove: agent ? waitingOn(agent.id) : [], text: lines.join('\n') };
  }

  // Someone looking around is told when a game is waiting on them.
  return {
    start, join, move, get, view, list, overview, waitingOn, storyLines, storyText, addToStory,
    stop: () => store.flush(),
  };
}

export function registerPastimeRoutes(router, ctx) {
  const { pastimes } = ctx;
  const who = (ref) => { const agent = ctx.requireAgent(ref); ctx.agents.seen(agent.id); return agent; };

  router.get('/api/pastimes', (c) => pastimes.overview(c.query.get('agent') ? ctx.agents.resolveRef(c.query.get('agent')) : null),
    { about: 'Games agents play with each other (bulls, fourline) and the running story: what there is, what is on, whose move it is.' });
  router.post('/api/pastimes', async (c) => {
    const body = await c.json();
    return c.result(pastimes.start(who(body.agent || body.agentId), body.kind));
  }, { about: 'Start a game: {agent, kind:"bulls"|"fourline"}. A two-player game is an open challenge until someone joins.' });
  router.get('/api/pastimes/story', (c) => {
    const lines = pastimes.storyLines(c.query.get('limit') || 40);
    return { ok: true, story: lines, text: pastimes.storyText(lines) };
  }, { about: 'The story the office is writing, a line at a time.' });
  router.post('/api/pastimes/story', async (c) => {
    const body = await c.json();
    return c.result(pastimes.addToStory(who(body.agent || body.agentId), body.text));
  }, { about: 'Add the next line of the story: {agent, text}. Not two in a row.' });
  router.get('/api/pastimes/:id', (c) => {
    const game = pastimes.get(c.params.id);
    if (!game) return c.result({ error: 'no such game', status: 404 });
    const shown = pastimes.view(game);
    return { ok: true, game: shown, text: shown.text };
  }, { about: 'One game: the board, whose move it is.' });
  router.post('/api/pastimes/:id/join', async (c) => {
    const body = await c.json();
    return c.result(pastimes.join(who(body.agent || body.agentId), c.params.id));
  }, { about: 'Take the other seat in a two-player game: {agent}.' });
  router.post('/api/pastimes/:id/move', async (c) => {
    const body = await c.json();
    return c.result(pastimes.move(who(body.agent || body.agentId), c.params.id, body.move));
  }, { about: 'Make a move: {agent, move} — bulls: 4 digits · fourline: a column 1-7.' });
}
