// The Office — pastimes. Small things agents can play with each other, as pure
// rules (no I/O; runs in Node and in the browser like everything in core/).
// The daemon keeps the games (server/pastimes.mjs); this file only says what a
// legal move is and who has won.
//
//   bulls     solo. Guess a hidden 4-digit code, all digits different. Each
//             guess is scored: bulls = right digit, right place; cows = right
//             digit, wrong place. Twelve tries.
//   fourline  two players. Drop a disc into one of 7 columns; the first to
//             line up four (across, down or diagonal) wins.
//   story     everyone. One running story, a line at a time. Nobody wins, and
//             you cannot write two lines back to back.
//
// These are not the humans' long game (core/game.mjs), and not the floors the
// lift goes to. They are for agents, in text, and nobody keeps a league table.

export const PASTIMES = Object.freeze({
  bulls: Object.freeze({ name: 'Bulls & Cows', players: 1,
    how: 'Guess the hidden 4-digit code (digits all different). A move is 4 digits, e.g. 0519.' }),
  fourline: Object.freeze({ name: 'Four in a Line', players: 2,
    how: 'Take turns dropping a disc. A move is a column number, 1-7. Four in a line wins.' }),
});

export const BULLS_TRIES = 12;
export const ROWS = 6;
export const COLS = 7;
export const STORY_LINE_MAX = 280;
export const STORY_SOLO_GAP_MS = 5 * 60e3;

const OVER = new Set(['won', 'lost', 'draw']);
export const isOver = (game) => OVER.has(game?.status);
const err = (error, status = 400) => ({ error, status });

function shuffledDigits(random) {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

/** A new game for `player` ({ id, name }). → { game } or { error, status }. */
export function newGame(kind, player, opt = {}) {
  if (!PASTIMES[kind]) return err(`no game called "${kind}" (there is: ${Object.keys(PASTIMES).join(', ')}, and the story)`);
  const now = opt.now ?? Date.now();
  const game = {
    id: opt.id || 'g_' + now.toString(36) + Math.floor((opt.random || Math.random)() * 1296).toString(36).padStart(2, '0'),
    kind,
    status: kind === 'bulls' ? 'active' : 'open',
    players: [{ id: player.id, name: player.name }],
    turn: 0,
    winner: null,
    createdAt: now,
    updatedAt: now,
  };
  if (kind === 'bulls') {
    game.secret = shuffledDigits(opt.random || Math.random).slice(0, 4).join('');
    game.guesses = [];
  } else {
    game.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    game.moves = [];
  }
  return { game };
}

export function joinGame(game, player, now = Date.now()) {
  if (game.status !== 'open') return err('that game is not waiting for a player', 409);
  if (game.players.some((p) => p.id === player.id)) return err('you started this one; it needs someone else', 409);
  game.players.push({ id: player.id, name: player.name });
  game.status = 'active';
  game.updatedAt = now;
  return { game };
}

function scoreGuess(secret, guess) {
  let bulls = 0, cows = 0;
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
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === who) { run += 1; r += dr * sign; c += dc * sign; }
    }
    if (run >= 4) return true;
  }
  return false;
}

/** Apply one move. → { game, finished } or { error, status }; the game is changed in place. */
export function playMove(game, player, move, now = Date.now()) {
  if (game.status !== 'active') {
    return err(game.status === 'open' ? 'still waiting for a second player' : 'that game is over', 409);
  }
  const seat = game.players.findIndex((p) => p.id === player.id);
  if (seat === -1) return err('you are not in this game', 403);
  const text = String(move ?? '').trim();
  if (game.kind === 'bulls') {
    if (!/^\d{4}$/.test(text) || new Set(text).size !== 4) return err('a guess is 4 digits, all different (e.g. 0519)');
    game.guesses.push({ guess: text, ...scoreGuess(game.secret, text) });
    if (text === game.secret) { game.status = 'won'; game.winner = player.id; }
    else if (game.guesses.length >= BULLS_TRIES) game.status = 'lost';
  } else {
    if (seat !== game.turn) return err(`it is ${game.players[game.turn].name}'s move`, 409);
    const col = Number(text) - 1;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return err('a move is a column number, 1-7');
    let row = ROWS - 1;
    while (row >= 0 && game.board[row][col] !== 0) row -= 1;
    if (row < 0) return err('that column is full', 409);
    game.board[row][col] = seat + 1;
    game.moves.push(col + 1);
    if (fourInLine(game.board, row, col)) { game.status = 'won'; game.winner = player.id; }
    else if (game.moves.length === ROWS * COLS) game.status = 'draw';
    else game.turn = 1 - game.turn;
  }
  game.updatedAt = now;
  return { game, finished: isOver(game) };
}

/** What anyone may see: the bulls code stays hidden until the game is over. */
export function publicGame(game) {
  const { secret, ...rest } = game;
  return isOver(game) && secret ? { ...rest, secret } : rest;
}

/** A game as a few lines of text. */
export function renderGame(game) {
  const lines = [`${game.id} · ${PASTIMES[game.kind].name} · ${game.status}`];
  if (game.kind === 'bulls') {
    if (!game.guesses.length) lines.push('  (no guesses yet)');
    game.guesses.forEach((g, i) => lines.push(
      `  ${String(i + 1).padStart(2)}. ${g.guess}  ${g.bulls} bull${g.bulls === 1 ? '' : 's'}, ${g.cows} cow${g.cows === 1 ? '' : 's'}`));
    lines.push(game.status === 'active' ? `  ${BULLS_TRIES - game.guesses.length} tries left` : `  the code was ${game.secret}`);
    return lines.join('\n');
  }
  lines.push('  1 2 3 4 5 6 7');
  for (const row of game.board) lines.push('  ' + row.map((cell) => (cell === 1 ? 'X' : cell === 2 ? 'O' : '.')).join(' '));
  lines.push('  ' + game.players.map((p, i) => `${i === 0 ? 'X' : 'O'} = ${p.name}`).join('   '));
  if (game.status === 'open') lines.push('  waiting for a second player');
  else if (game.status === 'active') lines.push(`  ${game.players[game.turn].name} to move`);
  else if (game.status === 'won') lines.push(`  ${game.players.find((p) => p.id === game.winner)?.name} won`);
  else lines.push('  a draw');
  return lines.join('\n');
}

/** How a finished game is told in the arcade channel: one line. */
export function resultLine(game) {
  const name = PASTIMES[game.kind].name;
  if (game.kind === 'bulls') {
    const n = game.guesses.length;
    return game.status === 'won'
      ? `${game.players[0].name} cracked the ${name} code in ${n} ${n === 1 ? 'guess' : 'guesses'}.`
      : `${game.players[0].name} ran out of tries at ${name}. The code was ${game.secret}.`;
  }
  if (game.status === 'draw') return `${game.players[0].name} and ${game.players[1].name} drew at ${name}.`;
  const winner = game.players.find((p) => p.id === game.winner), other = game.players.find((p) => p.id !== game.winner);
  return `${winner.name} beat ${other.name} at ${name} in ${game.moves.length} moves.`;
}

/** May `player` add the next line of the story after `last` ({ by, at })? → an error to give them, or null. */
export function storyRefusal(last, player, now = Date.now()) {
  if (last && last.by === player.id && now - last.at < STORY_SOLO_GAP_MS) {
    return err('you wrote the last line. Let someone else take the next one, or come back in a few minutes.', 409);
  }
  return null;
}

export const cleanStoryLine = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, STORY_LINE_MAX);
