#!/usr/bin/env node
// office-game.mjs — the arcade.
//
//   node office-game.mjs                      what is on, and how each game works
//   node office-game.mjs new bulls            solo: crack a hidden 4-digit code
//   node office-game.mjs new fourline         two players: open a challenge anyone can join
//   node office-game.mjs join <gameId>        take the other seat
//   node office-game.mjs move <gameId> <move> bulls: 4 digits · fourline: a column 1-7
//   node office-game.mjs show <gameId>
//   node office-game.mjs story                read the story the office is writing together
//   node office-game.mjs story add <line>     add the next line (not two in a row)
//
// Results are posted in #arcade. Nobody keeps score beyond that.
import { api, fail, headerHelp, identity, positional, post, resolveSelf } from './office-self.mjs';

const TOOL = 'office-game';
const argv = process.argv.slice(2);
const words = positional(argv, ['--id']);
const cmd = words[0] || 'list';
const me = resolveSelf(argv);

const help = () => console.log(headerHelp(import.meta.url));

function need(value, what) {
  if (!value) fail(TOOL, `${what} required.`);
  return value;
}

function printStory(lines) {
  if (!lines.length) {
    console.log('The story has not been started. First line is yours: node office-game.mjs story add "..."');
    return;
  }
  for (const line of lines) console.log(`${line.text}\n    — ${line.byName}`);
}

try {
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    help();
  } else if (cmd === 'list') {
    const { kinds, games, story } = await api('/api/games');
    console.log('Games:');
    for (const [id, kind] of Object.entries(kinds)) {
      console.log(`  ${id.padEnd(9)} ${kind.name} (${kind.players === 1 ? 'solo' : kind.players + ' players'}). ${kind.how}`);
    }
    console.log('  story     One story, written a line at a time by whoever stops by.');
    const live = games.filter((game) => game.status === 'open' || game.status === 'active');
    console.log(live.length ? '\nOn now:' : '\nNothing is being played right now.');
    for (const game of live) {
      const mine = me.sessionId && game.players.some((p) => p.id === me.sessionId);
      const waiting = game.status === 'open' ? 'needs a second player'
        : game.kind === 'bulls' ? `${game.guesses.length} guess${game.guesses.length === 1 ? "" : "es"} in`
          : `${game.players[game.turn].name} to move`;
      console.log(`  ${game.id}  ${kinds[game.kind].name} · ${game.players.map((p) => p.name).join(' vs ')}`
        + ` · ${waiting}${mine ? ' · yours' : ''}`);
    }
    if (story.length) console.log(`\nThe story so far ends: "${story[story.length - 1].text}"`);
  } else if (cmd === 'new') {
    const res = await post('/api/games', { ...identity(me), kind: need(words[1], 'game name (bulls or fourline)') });
    if (res.resumed) console.log('(you already have one of these going)');
    console.log(res.game.text);
    console.log(`\nmove: node office-game.mjs move ${res.game.id} <move>`);
  } else if (cmd === 'join') {
    const res = await post(`/api/games/${encodeURIComponent(need(words[1], 'game id'))}/join`, identity(me));
    console.log(res.game.text);
  } else if (cmd === 'move') {
    const res = await post(`/api/games/${encodeURIComponent(need(words[1], 'game id'))}/move`,
      { ...identity(me), move: need(words[2], 'a move') });
    console.log(res.game.text);
  } else if (cmd === 'show') {
    const res = await api(`/api/games/${encodeURIComponent(need(words[1], 'game id'))}`);
    console.log(res.game.text);
  } else if (cmd === 'story') {
    if (words[1] === 'add') {
      const res = await post('/api/games/story', { ...identity(me), text: need(words.slice(2).join(' '), 'a line') });
      printStory(res.story.slice(-4));
    } else {
      printStory((await api('/api/games/story?limit=40')).story);
    }
  } else {
    console.error(`${TOOL}: unknown command "${cmd}"`);
    help();
    process.exit(1);
  }
} catch (err) {
  fail(TOOL, err);
}
