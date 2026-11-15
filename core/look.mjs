// The Office — character + desk vocabulary. Pure, shared by the daemon (which
// resolves and validates looks) and the 3D client (which renders them). The
// option lists and the hash are the same ones the 2D pixel office has always
// used, so an agent keeps its face when it steps into three dimensions.

export const GENDER = Object.freeze(['male', 'female']);
export const SPECIES = Object.freeze(['human', 'robot', 'goblin', 'dog', 'cat', 'alien']);
export const SKIN = Object.freeze(['#f3cda8', '#e6b184', '#cd8d5e', '#9c6442', '#dcab8b']);
export const HAIR_COLORS = Object.freeze(['#241608', '#4a2f1a', '#15151c', '#7d5836', '#caa05a', '#9aa0ac']);
export const OUTFIT_COLORS = Object.freeze(['#b5483f', '#3f8a72', '#5a6fa8', '#8a5a8f', '#6f8a4a', '#c9893f',
  '#3f7f9a', '#5a5a66']);
export const HAIR = Object.freeze(['short', 'side', 'long', 'bun', 'mohawk', 'bald', 'cap', 'beanie', 'braids']);
export const OUTFIT = Object.freeze(['tee', 'hoodie', 'suit', 'vest', 'cardigan', 'tunic', 'consul']);
export const ACCESSORY = Object.freeze(['none', 'glasses', 'headphones', 'monocle', 'halo', 'partyhat',
  'crown', 'tophat', 'flower', 'eyepatch', 'shades', 'propeller', 'cowboy', 'hoops', 'goggles']);
export const FACIAL = Object.freeze(['none', 'mustache', 'beard', 'lashes']);
export const PLANTS = Object.freeze(['monstera', 'succulent', 'cactus', 'bonsai', 'terrarium']);
export const DESK_ITEMS = Object.freeze(['mug', 'figdragon', 'figrobot', 'duck', 'books', 'globe', 'stickies',
  'trophy', 'lavalamp', 'rubiks', 'gameboy', 'd20', 'fishbowl', 'newton', 'hourglass',
  'snowglobe', 'candle', 'fan', 'bobblehead', 'magic8', 'catclock', 'donut',
  'ramen', 'plushie', 'floppy', 'cassette', 'crystal', 'skull', 'paperplane',
  'zen', 'toycar', 'discoball', 'pizza', 'banana', 'medal']);

// Weighted pools used only for the *default* roll (the classic 2D weights).
const HAIR_POOL = ['short', 'side', 'long', 'bun', 'mohawk', 'bald', 'cap', 'beanie'];
const OUTFIT_POOL = ['tee', 'hoodie', 'suit', 'vest', 'cardigan'];
const ACC_POOL = ['none', 'none', 'glasses', 'headphones', 'monocle', 'halo', 'partyhat',
  'crown', 'tophat', 'flower', 'eyepatch', 'shades', 'propeller'];
const FACE_POOL = ['none', 'none', 'none', 'mustache', 'beard'];
const HUMAN_FEMALE_HAIR_POOL = ['long', 'long', 'bun', 'braids', 'side', 'short', 'beanie'];
const HUMAN_MALE_HAIR_POOL = ['short', 'short', 'side', 'cap', 'beanie', 'mohawk', 'bald'];
const HUMAN_FEMALE_FACE_POOL = ['none', 'none', 'none', 'lashes'];
const HUMAN_MALE_FACE_POOL = ['none', 'none', 'none', 'mustache', 'beard'];
const HUMAN_FEMALE_OUTFIT_POOL = ['cardigan', 'hoodie', 'tunic', 'vest', 'tee', 'suit'];
const HUMAN_MALE_OUTFIT_POOL = ['tee', 'hoodie', 'suit', 'vest', 'cardigan'];
const HUMAN_FEMALE_OUTFIT_COLORS = ['#8a5a8f', '#b5483f', '#3f8a72', '#5a6fa8', '#c9893f', '#3f7f9a'];
const HUMAN_FEMALE_ACC_POOL = ['none', 'none', 'glasses', 'headphones', 'flower', 'hoops', 'shades', 'halo', 'partyhat', 'crown', 'cowboy'];
const SPECIES_POOL = ['human', 'human', 'human', 'human', 'human', 'human', 'human',
  'robot', 'robot', 'cat', 'dog', 'goblin'];
const FUN_POOL = DESK_ITEMS.filter((id) => id !== 'mug');
// Non-human complexions (fur, plating, goblin green) rolled per species.
const SPECIES_SKIN = {
  robot: ['#8a93a8', '#a7b0bc', '#9aa58f', '#b0a08a'],
  goblin: ['#7fa35a', '#6b9460', '#8fae5e', '#5f8a6a'],
  dog: ['#c99a62', '#a8794a', '#e3c79a', '#8a6a4a', '#d9d2c4'],
  cat: ['#e0a060', '#9a9aa6', '#f1e6d2', '#3a3a44', '#d98a4a'],
  alien: ['#e0a638', '#79c28a', '#7aa9d6', '#b68ad9'],
};

/** FNV-1a, 32-bit — identical to the 2D client's hashId(). */
export function hashId(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const pick = (list, n) => list[n % list.length];

export const isHexColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const isCreationId = (v) => typeof v === 'string' && /^c_[a-z0-9_]{1,48}$/i.test(v);

/**
 * A complete look for `seed`, with any provided `character` fields winning.
 * Deterministic: the same seed always rolls the same character.
 */
/** Canonical starter defaults when toggling a Human between Male (Boy) and Female (Girl). */
export function humanGenderDefaults(gender) {
  return gender === 'female'
    ? { gender: 'female', hair: 'long', facial: 'none', outfit: 'cardigan', outfitColor: '#8a5a8f', accessory: 'none' }
    : { gender: 'male', hair: 'short', facial: 'none', outfit: 'tee', outfitColor: '#3f7f9a', accessory: 'none' };
}

export function resolveLook(seed, character) {
  const h = hashId(seed);
  const c = character && typeof character === 'object' ? character : {};
  const gender = GENDER.includes(c.gender) ? c.gender : pick(GENDER, h >>> 24);
  const species = SPECIES.includes(c.species) ? c.species : pick(SPECIES_POOL, h >>> 21);
  const skinPool = SPECIES_SKIN[species] || SKIN;
  const humanFemale = species === 'human' && gender === 'female';
  const humanMale = species === 'human' && gender === 'male';
  const hairPool = humanFemale ? HUMAN_FEMALE_HAIR_POOL : humanMale ? HUMAN_MALE_HAIR_POOL : HAIR_POOL;
  const facePool = humanFemale ? HUMAN_FEMALE_FACE_POOL : humanMale ? HUMAN_MALE_FACE_POOL : FACE_POOL;
  const outfitPool = humanFemale ? HUMAN_FEMALE_OUTFIT_POOL : humanMale ? HUMAN_MALE_OUTFIT_POOL : OUTFIT_POOL;
  const outfitColorPool = humanFemale ? HUMAN_FEMALE_OUTFIT_COLORS : OUTFIT_COLORS;
  const accPool = humanFemale ? HUMAN_FEMALE_ACC_POOL : ACC_POOL;
  return {
    gender,
    species,
    skin: isHexColor(c.skin) ? c.skin : pick(skinPool, h),
    hair: HAIR.includes(c.hair) ? c.hair : pick(hairPool, h >>> 3),
    hairColor: isHexColor(c.hairColor) ? c.hairColor : pick(HAIR_COLORS, h >>> 6),
    outfit: OUTFIT.includes(c.outfit) ? c.outfit : pick(outfitPool, h >>> 9),
    outfitColor: isHexColor(c.outfitColor) ? c.outfitColor : pick(outfitColorPool, h >>> 12),
    accessory: (ACCESSORY.includes(c.accessory) || isCreationId(c.accessory))
      ? c.accessory : pick(accPool, h >>> 15),
    facial: FACIAL.includes(c.facial) ? c.facial : pick(facePool, h >>> 18),
  };
}

/** Up to five desk items for `seed`, or the provided list if it is usable. */
export function resolveDeskItems(seed, items) {
  const clean = sanitizeDeskItems(items);
  if (clean.length) return clean;
  const h = hashId(seed);
  return [pick(PLANTS, h), 'mug', pick(FUN_POOL, h >>> 4), pick(FUN_POOL, h >>> 11)];
}

export function sanitizeDeskItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    const id = String(item || '').trim();
    if (!id) continue;
    if (PLANTS.includes(id) || DESK_ITEMS.includes(id) || isCreationId(id)) out.push(id);
    if (out.length >= 5) break;
  }
  return out;
}

/**
 * Validate an agent-supplied look patch. Returns `{ look, errors }` where
 * `look` holds only the fields that were valid.
 */
export function sanitizeLookPatch(patch) {
  const look = {};
  const errors = [];
  if (!patch || typeof patch !== 'object') return { look, errors: ['look must be an object'] };
  const enumField = (key, allowed) => {
    if (!(key in patch)) return;
    if (allowed.includes(patch[key])) look[key] = patch[key];
    else errors.push(`${key} must be one of: ${allowed.join(', ')}`);
  };
  const colorField = (key) => {
    if (!(key in patch)) return;
    if (isHexColor(patch[key])) look[key] = patch[key].toLowerCase();
    else errors.push(`${key} must be a #rrggbb color`);
  };
  enumField('gender', GENDER);
  enumField('species', SPECIES);
  enumField('hair', HAIR);
  enumField('outfit', OUTFIT);
  enumField('facial', FACIAL);
  colorField('skin');
  colorField('hairColor');
  colorField('outfitColor');
  if ('accessory' in patch) {
    if (ACCESSORY.includes(patch.accessory) || isCreationId(patch.accessory)) look.accessory = patch.accessory;
    else errors.push(`accessory must be one of: ${ACCESSORY.join(', ')} — or a hat creation id (c_…)`);
  }
  return { look, errors };
}

export const LOOK_OPTIONS = Object.freeze({
  gender: GENDER, species: SPECIES, hair: HAIR, outfit: OUTFIT, accessory: ACCESSORY, facial: FACIAL,
  skin: SKIN, hairColor: HAIR_COLORS, outfitColor: OUTFIT_COLORS,
  plants: PLANTS, deskItems: DESK_ITEMS,
});
