// The Backrooms — what somebody wrote under a drawing. Pure.
//
// Earlier visitors drew what they met, on a wall, by hand, and wrote down
// what they had worked out about it: the hard way, in a hurry, and not to
// the end. The drawings are how anybody learns a creature's rule before it
// costs them. They are honest: a drawing is only ever of something that is
// in this visit (plan.js says who; gen.js places it; traces.js draws it).
//
// The words are a frightened person's, never the cast deck's own line
// (cast.js `rule`): a test holds them apart. Each creature has a few
// versions; every one of them stops before it has finished.
export const WARNINGS = Object.freeze({
  pirate: [
    ['THE ONE IN THE HAT', 'ONLY MOVES WHEN YOU', 'ARE NOT LOOKING. SO'],
    ['HAT MAN: IF HE CANT', 'SEE YOU HE DOESNT', 'KNOW WHERE YOU'],
    ['DONT STAND NEXT TO', 'HIM. EVEN IF YOU ARE', 'WATCHING. HE'],
    ['HE WONT GO PAST A', 'FIRE. I LIT PAPER IN', 'THE DOORWAY AND HE'],
  ],
  shadow: [
    ['WAIT UNTIL IT GOES', 'WHITE. THEN LOOK AWAY.', 'I LOOKED BACK AND'],
    ['A GLANCE DOES NOTHING.', 'WHITE MEANS THE FUSE', 'IS ALREADY'],
  ],
  moth: [
    ['THE MOTH IS ALRIGHT.', 'IT WAITS AT A LIGHT.', 'I THINK IT IS GOING'],
    ['FOLLOW THE MOTH??', 'EVERY LIGHT IT PICKS', 'IS NEARER THE'],
    ['DONT LIGHT A FIRE', 'NEAR THE MOTH. IT', 'WENT STRAIGHT INTO'],
  ],
  'other-door': [
    ['ONE OF THE DOORS IS', 'NOT A DOOR. IT SHAKES', 'A BIT. DONT TOUCH'],
    ['WATCH A DOOR BEFORE', 'YOU TRY IT. IF IT', 'TWITCHES GO ROUND AND'],
    ['IT OPENED BLACK AND', 'SOMETHING HAD MY ARM.', 'I ONLY STOOD THERE A'],
  ],
  porter: [
    ['MIND HIS BUCKET.', 'IF YOU KNOCK IT OVER', 'PUT IT BACK OR HE'],
    ['THE MAN WITH THE MOP', 'IS FINE UNLESS YOU', 'KICK THE'],
  ],
  toner: [
    ['BLACK DRIPS FROM UP', 'TOP = KEEP LOW OR', 'DONT MOVE WHILE IT', 'CLICKS. IF YOU RUN IT'],
    ['FOUR LEGS ON THE', 'CEILING. SHUT THE', 'FIRE DOORS ON IT.', 'IT CANNOT OPEN'],
    ['IT WEAVES SIDE TO', 'SIDE AND CRAWLS IN', 'THE HOLES. TWO BITES', 'AND IT MELTED INTO'],
    ['DONT GO BACK PAST', 'THE BLACK PUDDLE. I', 'CAME BACK LATER AND', 'THREE MORE WERE ON'],
  ],
  // the residents of rooms (deck2.js `resident`)
  'trunk-line': [
    ['DONT WALK UNDER THE', 'CABLES. GO ROUND.', 'IT DROPPED ON'],
    ['THE WIRES ARE ALIVE', 'SHUT THE DOOR ON IT', 'IT CANT WORK THE'],
  ],
  'plenum-toner': [
    ['DONT PUT YOUR WEIGHT', 'ON THE STAINED TILES.', 'I WENT THROUGH ONE AND'],
    ['SOMETHING IS UP IN THE', 'CEILING WITH YOU. KEEP', 'STILL WHEN IT STOPS'],
  ],
  'retention-clerk': [
    ['SHE WANTS PAPER.', 'ANY PAPER. GIVE HER', 'SOME OR SHE PUTS'],
    ['IF YOU HEAR WHISTLING', 'HAVE A SHEET READY', 'I DIDNT AND MY ARM'],
  ],
  'fun-committee': [
    ['TAKE A RED BALLOON IN', 'WITH YOU. THEY THINK', 'YOU ARE ONE OF'],
    ['NO BALLOON = THEY ALL', 'TURN ROUND. I RAN.', 'THE HATS ARE'],
  ],
  'stand-ins': [
    ['KEEP THE TORCH ON', 'IT. IT ONLY MOVES', 'WHEN THE LIGHT IS'],
    ['NOT WITHOUT A LIGHT.', 'IT GOES RED AND THEN', 'YOU ARE BACK AT'],
  ],
  lamplighter: [
    ['THE LIGHTS WENT OUT', 'ONE AT A TIME. MY', 'TORCH HELD IT BUT'],
    ['KEEP THE BEAM ON IT', 'AS YOU GO PAST. DONT', 'TURN TO SEE THE'],
  ],
  'mecha-warden': [
    ['THE RED BUTTON ON', 'THE BIG MACHINE STOPS', 'THEM. I GOT AS FAR AS'],
    ['TURN A CAMERA ROUND', 'AND THEY ALL GO AND', 'LOOK AT IT. THEN YOU'],
    ['THE EMPTY CAGE IS', 'FOR YOU. THE ONES IN', 'WIGS PUT YOU IN'],
  ],
  'floor-warden': [
    ['WALK. DO NOT RUN.', 'HE ONLY MINDS IF YOU', 'RUN. THE SCISSORS'],
    ['IF HE CHASES KEEP', 'GOING. HE CANT KEEP', 'IT UP. HE FALLS ON'],
  ],
  'efficiency-partners': [
    ['THE TWO IN SUITS ARE', 'HARMLESS. THEY GAVE', 'ME A PINK'],
    ['TAKE THE PINK FORM.', 'THE SHREDDER LADY', 'WILL HAVE IT IF'],
  ],
});
/** Somebody we have no drawing lessons for yet: they saw it, and that is all they got down. */
const UNKNOWN = [['SAW SOMETHING IN', 'HERE. DID NOT STAY', 'TO FIND OUT WHAT IT']];

/** The words under a drawing of creature `id`: one of its versions, by the seed. → lines */
export function warningFor(id, R) { return R.pick(WARNINGS[id] || UNKNOWN).slice(); }
