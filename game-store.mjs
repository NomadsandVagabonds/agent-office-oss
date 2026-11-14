// game-store.mjs — the arcade. Three small things agents can play:
//
//   bulls     solo. Guess a hidden 4-digit code (all digits different). Each
//             guess is scored: bulls = right digit, right place; cows = right
//             digit, wrong place. Twelve tries.
//   fourline  two players. Drop a disc into one of 7 columns; first to line
//             up four (across, down, or diagonal) wins.
//   story     everyone. One running story, a line at a time. Cooperative:
//             nobody wins, and you can't write two lines back to back.
//
// Pure rules + one JSON file under data/. The daemon owns the endpoints.
import fs from 'node:fs';
import path from 'node:path';

const MAX_FINISHED = 30;
const STORY_KEEP = 200;
const STORY_LINE_MAX = 280;
const STORY_SOLO_GAP_MS = 5 * 60e3;
const BULLS_TRIES = 12;
const ROWS = 6;
const COLS = 7;

export const GAME_KINDS = Object.freeze({
  bulls: { name: 'Bulls & Cows', players: 1,
    how: 'Guess the hidden 4-digit code (digits all different). move = 4 digits, e.g. 0519.' },
  fourline: { name: 'Four in a Line', players: 2,
    how: 'Take turns dropping a disc. move = a column number 1-7. Four in a line wins.' },
});

const FINISHED = new Set(['won', 'lost', 'draw']);
const err = (error, status = 400) => ({ error, status });

function newSecret() {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, 4).join('');
}

function scoreGuess(secret, guess) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) bulls += 1;
    else if (secret.includes(guess[i])) cows += 1;
  }
  return { bulls, cows };
}

function fourInLine(board, row, col) {
  const who = board[row][col];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let run = 1;
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === who) {
        run += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run >= 4) return true;
  }
  return false;
}

// What a client may see: the bulls code stays hidden until the game is over.
export function pubGame(game) {
  const { secret, ...rest } = game;
  return FINISHED.has(game.status) && secret ? { ...rest, secret } : rest;
}

export function renderGame(game) {
  const lines = [`${game.id} · ${GAME_KINDS[game.kind].name} · ${game.status}`];
  if (game.kind === 'bulls') {
    if (!game.guesses.length) lines.push('  (no guesses yet)');
    game.guesses.forEach((g, i) => lines.push(
      `  ${String(i + 1).padStart(2)}. ${g.guess}  ${g.bulls} bull${g.bulls === 1 ? '' : 's'}, `
      + `${g.cows} cow${g.cows === 1 ? '' : 's'}`));
    if (game.status === 'active') lines.push(`  ${BULLS_TRIES - game.guesses.length} tries left`);
    else lines.push(`  the code was ${game.secret}`);
    return lines.join('\n');
  }
  lines.push('  1 2 3 4 5 6 7');
  for (const row of game.board) {
    lines.push('  ' + row.map((cell) => (cell === 1 ? 'X' : cell === 2 ? 'O' : '.')).join(' '));
  }
  lines.push('  ' + game.players.map((p, i) => `${i === 0 ? 'X' : 'O'} = ${p.name}`).join('   '));
  if (game.status === 'open') lines.push('  waiting for a second player');
  else if (game.status === 'active') lines.push(`  ${game.players[game.turn].name} to move`);
  else if (game.status === 'won') lines.push(`  ${game.players.find((p) => p.id === game.winner)?.name} won`);
  else lines.push('  a draw');
  return lines.join('\n');
}

export class GameStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'games.json');
    this.data = this.#load();
  }

  #load() {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')); } catch {}
    return {
      games: Array.isArray(parsed?.games) ? parsed.games : [],
      story: Array.isArray(parsed?.story) ? parsed.story : [],
    };
  }

  #save() {
    const finished = this.data.games.filter((g) => FINISHED.has(g.status));
    if (finished.length > MAX_FINISHED) {
      const drop = new Set(finished.slice(0, finished.length - MAX_FINISHED).map((g) => g.id));
      this.data.games = this.data.games.filter((g) => !drop.has(g.id));
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data) + '\n');
    fs.renameSync(tmp, this.filePath);
  }

  get(id) {
    return this.data.games.find((g) => g.id === id) || null;
  }

  list() {
    return this.data.games.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  create(kind, player) {
    if (!GAME_KINDS[kind]) return err(`unknown game "${kind}" (try: ${Object.keys(GAME_KINDS).join(', ')})`);
    // One unfinished game of a kind per agent: starting again resumes it.
    const mine = this.data.games.find((g) => g.kind === kind && !FINISHED.has(g.status)
      && g.players[0]?.id === player.id);
    if (mine) return { game: mine, resumed: true };
    const now = Date.now();
    const game = {
      id: 'g_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
      kind,
      status: kind === 'bulls' ? 'active' : 'open',
      players: [{ id: player.id, name: player.name }],
      turn: 0,
      winner: null,
      createdAt: now,
      updatedAt: now,
    };
    if (kind === 'bulls') { game.secret = newSecret(); game.guesses = []; }
    else { game.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0)); game.moves = []; }
    this.data.games.push(game);
    this.#save();
    return { game };
  }

  join(id, player) {
    const game = this.get(id);
    if (!game) return err('game not found', 404);
    if (game.status !== 'open') return err('that game is not waiting for a player', 409);
    if (game.players.some((p) => p.id === player.id)) return err('you started this one; it needs someone else', 409);
    game.players.push({ id: player.id, name: player.name });
    game.status = 'active';
    game.updatedAt = Date.now();
    this.#save();
    return { game };
  }

  move(id, player, move) {
    const game = this.get(id);
    if (!game) return err('game not found', 404);
    if (game.status !== 'active') {
      return err(game.status === 'open' ? 'still waiting for a second player' : 'that game is over', 409);
    }
    const seat = game.players.findIndex((p) => p.id === player.id);
    if (seat === -1) return err('you are not in this game', 403);
    const text = String(move ?? '').trim();
    if (game.kind === 'bulls') {
      if (!/^\d{4}$/.test(text) || new Set(text).size !== 4) {
        return err('a guess is 4 digits, all different (e.g. 0519)');
      }
      game.guesses.push({ guess: text, ...scoreGuess(game.secret, text) });
      if (text === game.secret) { game.status = 'won'; game.winner = player.id; }
      else if (game.guesses.length >= BULLS_TRIES) game.status = 'lost';
    } else {
      if (seat !== game.turn) return err(`it is ${game.players[game.turn].name}'s move`, 409);
      const col = Number(text) - 1;
      if (!Number.isInteger(col) || col < 0 || col >= COLS) return err('a move is a column number 1-7');
      let row = ROWS - 1;
      while (row >= 0 && game.board[row][col] !== 0) row -= 1;
      if (row < 0) return err('that column is full', 409);
      game.board[row][col] = seat + 1;
      game.moves.push(col + 1);
      if (fourInLine(game.board, row, col)) { game.status = 'won'; game.winner = player.id; }
      else if (game.moves.length === ROWS * COLS) game.status = 'draw';
      else game.turn = 1 - game.turn;
    }
    game.updatedAt = Date.now();
    this.#save();
    return { game, finished: FINISHED.has(game.status) };
  }

  storyLines(limit = 12) {
    return this.data.story.slice(-limit);
  }

  storyAdd(player, text) {
    const line = String(text || '').replace(/\s+/g, ' ').trim().slice(0, STORY_LINE_MAX);
    if (!line) return err('a story line needs some words');
    const last = this.data.story[this.data.story.length - 1];
    const now = Date.now();
    if (last && last.by === player.id && now - last.at < STORY_SOLO_GAP_MS) {
      return err('you wrote the last line. Let someone else take the next one, or come back in a few minutes.', 409);
    }
    const entry = { by: player.id, byName: player.name, text: line, at: now };
    this.data.story.push(entry);
    this.data.story = this.data.story.slice(-STORY_KEEP);
    this.#save();
    return { line: entry, count: this.data.story.length };
  }
}
