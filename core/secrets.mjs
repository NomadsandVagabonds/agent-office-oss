// The Office — things worth finding. Pure data, shared by the daemon (which
// records who found what) and the client (which fills the trophy case).
//
// `hint` is what the trophy case shows for something nobody has found yet.
// Keep hints oblique: the fun is in the looking.

export const SECRETS = Object.freeze([
  { id: 'red-book', name: 'The Red Book', icon: '📕',
    blurb: 'One book on the library shelf was a lever all along.',
    hint: 'Not every book in the library is for reading.' },
  { id: 'konami', name: 'Up Up Down Down', icon: '🕹️',
    blurb: 'Knew the code. The office remembered how to dance.',
    hint: 'Old controllers had a famous sequence. Keyboards still do.' },
  { id: 'cat-person', name: 'Cat Person', icon: '🐈',
    blurb: 'Nine pets for nine lives. Kernel approves of you.',
    hint: 'Someone small and furry likes attention. A lot of it.' },
  { id: 'duck', name: 'Rubber Duck Debugging', icon: '🦆',
    blurb: 'Explained the problem to the duck. The duck understood.',
    hint: 'One desk a day gets a visitor who is very good at listening.' },
  { id: 'golden-semicolon', name: 'The Golden Semicolon', icon: '✨',
    blurb: 'One in twenty snacks is not a snack.',
    hint: 'The vending machine is mostly snacks.' },
  { id: 'high-score', name: 'High Score', icon: '👾',
    blurb: 'Put a name at the top of the BUG SQUASH board.',
    hint: 'Somewhere there is a machine that still takes initials.' },
  { id: 'green-thumb', name: 'Green Thumb', icon: '🌱',
    blurb: 'Watered the office tree. It grows with every finished task.',
    hint: 'The tree in the plaza looks thirsty.' },
  { id: 'ding', name: 'Ding Ding Ding', icon: '🛎️',
    blurb: 'Rang the bell three times. Everyone looked.',
    hint: 'Reception has a bell. Once is polite.' },
  { id: 'old-school', name: 'Old School', icon: '🖼️',
    blurb: 'Stepped through the painting into the pixel office.',
    hint: 'There is a painting of how this place used to look.' },
  { id: 'diorama', name: 'Offices All The Way Up', icon: '🔭',
    blurb: 'Zoomed out far enough to see what the office is sitting on.',
    hint: 'Have you tried stepping back? Further.' },
  { id: 'ghost', name: 'Ghost in the Machine', icon: '👻',
    blurb: 'Met the night shift. It was friendly.',
    hint: 'The office is not empty after midnight.' },
  { id: 'hatch', name: 'Under the Closet', icon: '🕳️',
    blurb: 'Found the hatch. It is locked. Something hums below.',
    hint: 'The supply closet has more floor than it needs.' },
  { id: 'caffeine', name: 'Caffeine Overflow', icon: '☕',
    blurb: 'Five cups in a row. The machine needed a moment.',
    hint: 'How much coffee is too much coffee?' },
  { id: 'guest', name: 'Signed the Book', icon: '✒️',
    blurb: 'Left a line in the guestbook.',
    hint: 'Visitors are asked to sign in.' },
  { id: 'paper-jam', name: 'Paper Jam', icon: '🖨️',
    blurb: 'Asked the printer for one page too many.',
    hint: 'The printer has opinions.' },
  { id: 'magic-word', name: 'A Hollow Voice', icon: '🪄',
    blurb: 'Said the magic word at the ops console.',
    hint: 'The ops console understands more than commands.' },
  { id: 'cartographer', name: 'Cartographer', icon: '🗺️',
    blurb: 'Set foot in every room on the floor.',
    hint: 'How much of the floor have you actually walked?' },
  { id: 'curator', name: 'Curator', icon: '🏛️',
    blurb: 'Signed a creation into the legacy.',
    hint: 'The gallery has room for more.' },
  { id: 'night-owl', name: 'Night Owl', icon: '🦉',
    blurb: 'Was at a desk between one and four in the morning.',
    hint: 'Some work only happens when everyone else is asleep.' },
  { id: 'thirteenth', name: 'Thirteenth Floor', icon: '🌒',
    blurb: 'Came in on a Friday the 13th. The elevator noticed.',
    hint: 'Some dates are different.' },
  { id: 'disco', name: 'Night Fever', icon: '🪩',
    blurb: 'Found the jukebox. Chose correctly.',
    hint: 'There is music somewhere you have not been yet.' },
  { id: 'noclip', name: 'Out of Bounds', icon: '🟨',
    blurb: 'Leaned on the wrong corner and fell out of the office.',
    hint: 'One corner of a room you were not meant to find is less solid than it looks.' },
  { id: 'way-out', name: 'You Came Back', icon: '🚪',
    blurb: 'Found the door that leads back to somewhere that makes sense.',
    hint: 'Wherever you end up, there is always one door that is different.' },
  { id: 'air-mail', name: 'Air Mail', icon: '🛩️',
    blurb: 'Found the paper plane that missed its inbox, and read it.',
    hint: 'Not every note lands on a desk. Some go up.' },
  { id: 'headcount', name: 'All Present', icon: '🐐',
    blurb: 'Found the one the clipboard always misses.',
    hint: 'Somewhere below the lobby, a headcount is always one short.' },
  { id: 'green-build', name: 'Green Again', icon: '🔨',
    blurb: 'Went down after hours and fixed every last bug. The build is green again.',
    hint: 'The build breaks at night. Somebody has to go down there with a mallet.' },
]);

const BY_ID = new Map(SECRETS.map((s) => [s.id, s]));
export const secretById = (id) => BY_ID.get(id) || null;

/* ---- the calendar ------------------------------------------------------ */

/**
 * Things that are true about a given day. The office dresses for the date.
 * @param {Date} date  (local time)
 */
export function dayQuirks(date = new Date()) {
  const m = date.getMonth() + 1, d = date.getDate(), dow = date.getDay();
  const quirks = [];
  if (d === 13 && dow === 5) quirks.push('friday-13');
  if (m === 10 && d === 31) quirks.push('halloween');
  if (m === 3 && d === 14) quirks.push('pi-day');
  if (m === 4 && d === 1) quirks.push('april-first');
  if (m === 12 && d >= 15) quirks.push('winter');
  if (m === 1 && d === 1) quirks.push('new-year');
  if (dow === 5) quirks.push('friday');
  // the 256th day of the year
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  if (dayOfYear === 256) quirks.push('programmers-day');
  return quirks;
}

/** A stable pseudo-random weather for a calendar day (same for everyone). */
export function dayWeather(date = new Date()) {
  const seed = date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  const roll = (h >>> 8) % 100;
  const winter = [11, 0, 1].includes(date.getMonth());
  if (roll < 52) return 'clear';
  if (roll < 70) return 'cloudy';
  if (roll < 88) return winter ? 'snow' : 'rain';
  if (roll < 95) return 'fog';
  return winter ? 'snow' : 'storm';
}

const FORTUNES = [
  'It works on my machine is a deployment strategy, technically.',
  'The bug is in the part you are sure about.',
  'Today you will rename a variable and feel powerful.',
  'A stale cache is watching you from the shadows.',
  'You will soon be asked to estimate something unknowable.',
  'There is no cloud. It is just someone else\'s office.',
  'The test you skipped remembers.',
  'Somebody is about to say "quick question".',
  'Your next commit message will be honest.',
  'Read the error. All of it. Even the boring part.',
  'A semicolon you cannot see is about to matter.',
  'The docs were right. This is rare. Savor it.',
  'Off by one. Always check for off by one.',
  'You are one good night\'s sleep away from the answer.',
  'Ship it small. Ship it twice.',
  'An agent in another room is stuck on the thing you just solved.',
];
const SNACKS = ['pretzel bytes', 'a bag of null chips', 'cache-ews', 'a stack of pancake overflows',
  'dark-mode chocolate', 'syntactic sugar cubes', 'a kernel of popcorn', 'gummy pointers',
  'a slightly squashed bug-free brownie', 'race-condition trail mix', 'a can of Regular Expresso'];
const DUCK_WISDOM = [
  'Quack. (What did you expect it to do, and what did it do instead?)',
  'Quack. (When did it last work?)',
  'Quack. (Say the assumption out loud. Yes, that one.)',
  'Quack. (Have you tried reading the line above the error?)',
  'Quack. (Is it plugged in. Is the daemon up. Is it the right branch.)',
  'Quack. (What changed?)',
  'Quack. (Could it be two bugs wearing a trench coat?)',
  'Quack. (Make it smaller until it stops being confusing.)',
  'The duck says nothing. You already know.',
];

export const pickFortune = (n) => FORTUNES[Math.abs(n) % FORTUNES.length];
export const pickSnack = (n) => SNACKS[Math.abs(n) % SNACKS.length];
export const pickDuckWisdom = (n) => DUCK_WISDOM[Math.abs(n) % DUCK_WISDOM.length];
