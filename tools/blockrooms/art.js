// BlockRooms — the home page's pictures. A page from 1998 is mostly small
// pictures that move, and this one's are all its own: drawn here, a character
// a pixel, and set moving by the page (nothing is fetched, and nothing was
// taken from anybody else's page).
//
//   <i data-sprite="battery" data-fx="spin" data-scale="4"></i>
//
// mount() turns each of those into a small canvas. `fx` is how it moves:
//   spin    turns about its upright, the way everything on a home page did
//   bob     up and down          sway   leans one way, then the other
//   pulse   bigger, smaller      blink  there, not there
//   shake   as if it were ringing
//   turn    round and round, in steps
// A sprite with more than one frame steps through them as well. Whoever has
// asked their machine for less movement gets the first frame, standing still.

const PAL = {
  k: '#111111', K: '#33363c', g: '#777b80', G: '#b8bcc0', w: '#ffffff',
  y: '#ffd83a', Y: '#b99a2a', l: '#fff6c4', o: '#ff8a1f', r: '#e0241b', R: '#8a1410',
  b: '#2a52be', B: '#14245e', c: '#4fd6e8', v: '#8a5ad6', p: '#f4a8c0', P: '#c04a80',
  n: '#7a4a2a', N: '#4a2a14', t: '#d9b98a', T: '#a57d4c', s: '#f1c9a0',
  e: '#5fae4a', E: '#2a6b2a', m: '#c9c4a6',
  h: '#b4756a', H: '#8f5148', f: '#c48a7d', F: '#5e3540',
  S: '#cfa07a', u: '#e6d896', U: '#8f7d34', d: '#526478', D: '#222730',
  M: '#3a3526', q: '#ffc8d8', z: '#6dff7a', Z: '#123d1c', V: '#56327a', x: '#b8aa8e',
};

/** name → { fps?, frames: [[rows…], …] }. '.' is nothing. */
export const SPRITES = {
  // Directory miniatures follow the in-game silhouettes: Mother's open-topped
  // flesh tube, the Lines' six poles, ink-black toners, and the grinning clerks.
  mother: { fps: 2, frames: [0, 1].map(f => [
    '......HHHH......', '.....HllllH.....', '.....HlkklH.....', '.....HllllH.....',
    f ? '..hh..HffH......' : '......HffH..hh..',
    f ? '...hh.HhfH......' : '......HfhH.hh...',
    '....hhHfhHhh....', '.....HHhhHH.....', '......HffH......',
    '......HhhH......', '......HFhH......', '......HffH......',
    '......HhhH......', '......HfhH......', '.....HHhhHH.....', '.....HH..HH.....',
  ]) },
  lines: { fps: 1.5, frames: [0, 1].map(f => [
    '.n.....n.....n..', 'nnn...nnn...nnn.', '.n.....n.....n..', '.n.....n.....n..',
    '.n..HHHHHH...n..', '.n.HhfhFhfH..n..', '.n.HfhHhfhH..n..', '.n..HHHHHH...n..',
    '.n...n...n...n..', '.n..nnn.nnn..n..', '.n...n...n...n..',
    f ? '..n..n...n..n...' : '.n...n...n...n..',
    f ? '..n..n...n..n...' : '.n...n...n...n..',
    '.n...n...n...n..', '.n...n...n...n..', 'nn..nn...nn..nn.',
  ]) },
  waste_toner: { fps: 3, frames: [0, 1].map(f => [
    '..k.........k...', '..kk..k.k..kk...', '...k..kkk..k....', '...kkkkkkkkk....',
    '..kkKKkkKKkkk...', '.kkkKkkkkKkkkk..', 'kk.kkkkkkkkk.kk.',
    f ? '.k.kkkDkkkkk.k..' : '.k.kkkkkkkkk.k..',
    '.k..kkkkkkk..k..', 'kk...k.k.k...kk.', 'k....k...k....k.',
    '.....k...k......',
  ]) },
  // The big ones met further down: three shirts on eight arms and not a head between them; nine pairs of hips in a
  // row with the front of it stood up on end; somebody too tall, bent double; and somebody senior, carried.
  head_count: { fps: 2.5, frames: [0, 1].map((f) => {
    const arms = [0, 2, 5, 7, 8, 10, 13, 15];
    const arm = (y) => Array.from({ length: 16 }, (_, x) => { const i = arms.indexOf(x); return i < 0 ? '.' : y < 3 ? 's' : i % 2 === f ? '.' : 't'; }).join('');
    return ['..kk...kk...kk..', '.wkkw.wkkw.wkkw.', '.wwrwwwwrwwwwrw.', 'wwwrwwwwrwwwwrww', 'wwwwwwwwwwwwwwww', 'GwwwGGwwwwGGwwwG', arm(0), arm(1), arm(2), arm(3)];
  }) },
  standing_meeting: { fps: 4, frames: [0, 1].map(f => [
    '..DD............', '.DhhD...........', '.DfhD...........', '.DhfD...........', '..DhD...........',
    '..DDDDDDDDDDDDD.', '..DdDdDdDdDdDdD.', '..d.r.d.d.r.d.d.',
    f ? '.d..d..d.d..d.d.' : '..d.d.d.d.d.d.d.',
    f ? '.kk.kk.kkkk.kkk.' : '.kk.kkkk.kk.kkk.',
  ]) },
  intern: { fps: 1.5, frames: [0, 1].map(f => [
    '....wwww....', '..wwwwwwww..', '.www....www.', '.dd....wwww.', '.dd....s..s.', '.dd....sKKs.', '.dd....stts.',
    f ? '.dd....swws.' : '.dd....skks.',
    '.dd....sNNs.', '.dd....s..s.', '.dd....s..s.', '.dd....s..s.', '.dd....s..s.', '.dd....s..s.', '.dd...ts..st', 'kkk.........',
  ]) },
  carried_interest: { fps: 3, frames: [0, 1].map(f => [
    '......ssss......', '......skks......', '.....DDssDD.....', '...DDDDwrwDDDD..', '..DDDDDwrwDDDDD.', '.DDDDDDDrDDDDDDD',
    '.DDDDDDDDDDDDDDD', '.DDDDDDDDDDDDDD.', '..DDDDDDDDDDDD..',
    f ? '.hh.hh.hh.hh.hh.' : '..hh.hh.hh.hh.hh',
    f ? '.H.H..H.H..H.H..' : '..H.H..H.H..H.H.',
  ]) },
  pit_clerk: { fps: 1.5, frames: [0, 1].map(f => [
    '.....nnnnnn.....', '....nnttttnn....', '....ntwttwtn....', '....ntkttktn....',
    '....tttttttt....', '....tkkkkkkt....', '.....twwwt......', '......tttt......',
    '..tt.dddddd.tt..', '..ttdddlldddtt..', '....dddllldd....', '....dddddddd....',
    f ? '....dd....dd....' : '.....dd..dd.....', '.....dd..dd.....', '....kkk..kkk....',
  ]) },
  battery: { frames: [[
    '...kkk...', '..kGGGk..', '.kkkkkkk.', '.kyyyyyk.', '.kyykyyk.', '.kykkkyk.', '.kyykyyk.', '.kyyyyyk.',
    '.kkkkkkk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kKKKKKk.', '.kkkkkkk.',
  ]] },
  camcorder: { fps: 1.6, frames: ['r', 'K'].map((lamp) => [
    '..........kkkk..', '.........kGGGGk.', 'kkk..kkkkkkkkkkk', 'kcckkGGGGGGGGGGk', 'kcwckGggggggggGk', `kcwckGgkkkkg${lamp}gGk`,
    'kcckkGgkkkkgggGk', 'kkk..kGggggggGGk', '.....kGGGGGGGGGk', '.....kkkkkkkkkkk',
  ]) },
  tape: { fps: 3, frames: ['w', 'K'].map((hub) => [
    'kkkkkkkkkkkkkkkk', 'kKKKKKKKKKKKKKKk', 'kKwwwwwwwwwwwwKk', 'kKwkkkwwwwkkkwKk', `kKwk${hub}kwwwwk${hub}kwKk`, 'kKwkkkwwwwkkkwKk',
    'kKwwwwwwwwwwwwKk', 'kKKKKKKKKKKKKKKk', 'kKKkkkkkkkkkkKKk', 'kkkkkkkkkkkkkkkk',
  ]) },
  keycard: { frames: [[
    'kkkkkkkkkkkkkk', 'kbbbbbbbbbbbbk', 'kbbbbbbbbbbbbk', 'kwwwwwwwwwwwwk', 'kwkkwwGGGGGGwk', 'kwkkwwwwwwwwwk', 'kwkkwwGGGGwwwk', 'kwwwwwwwwwwwwk', 'kkkkkkkkkkkkkk',
  ]] },
  heart: { frames: [['.rr...rr.', 'rprr.rrrr', 'rprrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....']] },
  pirate: { fps: 0.7, frames: ['w', 'k'].map((eye) => [
    '....kkkkkk....', '...kkkkkkkk...', '..kkkwkwkkkk..', '.kkkkwwwkkkkk.', 'kkkkkkkkkkkkkk', '..eeeeeeeeee..', `e.eekkkeee${eye}ee.e`,
    `eeeekkkeee${eye}keee`, '.eeeeeeeeeeee.', '..eeeEEeeeee..', '..eewwwwwwee..', '..eekwkwkwee..', '...eeeeeeee...', '....eeeeee....',
  ]) },
  standee: { frames: [[
    '...TTTT...', '..TttttT..', '..TttttT..', '..TttttT..', '...TttT...', '.TTTttTTT.', 'TttttttttT', 'TtTttttTtT', 'TtTttttTtT', 'TtTttttTtT',
    '.T.TttT.T.', '...TttT...', '...TttT...', '...TtTtT..', '...Tt.TtT.', '...Tt..Tt.', '..TTt..TtT', '..TTT..TTT',
  ]] },
  cooler: { fps: 1.2, frames: [['.kcwcccK.', '.kccccwK.', '.kcccccK.', '.kcwcccK.'], ['.kcccccK.', '.kcwcccK.', '.kccccwK.', '.kcccccK.']].map((water) => [
    '..kkkkk..', '.kcccccK.', ...water, '..kkkkk..', '.kGGGGGk.', '.kGwGrGk.', '.kGGGGGk.', '.kGGGGGk.', '.kGGGGGk.', '.kGGGGGk.', '.kkkkkkk.', '.k.....k.',
  ]) },
  torch: { frames: [['kkkkkkkkkkk.....', 'kyyyyyyyyKKkk...', 'kyyyyyyyyKKGGk..', 'kyyyyyyyyKKlGk..', 'kyyyyyyyyKKkk...', 'kkkkkkkkkkk.....']] },
  moth: { fps: 7, frames: [[
    '.nn.......nn.', 'nttn..k..nttn', 'nttttnknttttn', '.nttttkttttn.', '..nnttkttnn..', '..nttnkntn...', '..ntn.k.ntn..', '..nn..k..nn..',
  ], [
    '...n..k..n...', '..ntn.k.ntn..', '..nttnknttn..', '..nttnknttn..', '...ntnkntn...', '...ntnkntn...', '....n.k.n....', '......k......',
  ]] },
  digger: { fps: 2, frames: [0, 2].map((lift) => {
    const body = ['....yyyy......', '...yyyyyy.....', '...ssssss.....', '...skssks.....', '...ssssss.....', '....bbbb......', '...bbbbbb.....', '..sbbbbbbs....',
      '..s.bbbb.s....', '..s.bbbb..s...', '....b..b......', '....b..b......', '....b..b......', '...kk..kk.....'];
    const spade = ['g', 'g', 'g', 'g', 'g', 'g', 'g', 'ggg', 'ggg'];
    return body.map((row, y) => { const part = spade[y - (5 - lift)]; return part ? row.slice(0, 11) + (part.length === 3 ? part : `.${part}.`) : row; });
  }) },
  cone: { frames: [[
    '....yy....', '....yy....', '...yyyy...', '...ykky...', '..yykkyy..', '..yykkyy..', '.yyykkyyy.', '.yyyyyyyy.', '.yyykkyyy.', 'yyyyyyyyyy', 'yy......yy', 'yy......yy',
  ]] },
  plant: { frames: [[
    '..e..e..e..', '.eEe.e.eEe.', '..eEeeeEe..', 'e..eEEEe..e', '.ee.eEe.ee.', '..eeeEeee..', '....eEe....', '....nnn....', '....nnn....', '...ooooo...', '...ooooo...', '....ooo....',
  ]] },
  cog: { frames: [[
    '.....kkk.....', '..kk.kGk.kk..', '.kGGkkGkkGGk.', '.kGGGGGGGGGk.', '..kGGkkkGGk..', 'kkkGk...kGkkk', 'kGGGk...kGGGk', 'kkkGk...kGkkk',
    '..kGGkkkGGk..', '.kGGGGGGGGGk.', '.kGGkkGkkGGk.', '..kk.kGk.kk..', '.....kkk.....',
  ]] },
  gpu: { fps: 9, frames: [['kGkGk', 'kkGkk', 'kGkGk'], ['kkGkk', 'kGGGk', 'kkGkk']].map((fan) => [
    'kkkkkkkkkkkkkkkkkk', 'kEEEEEEEEEEEEEEEEk', 'kEkkkkkEEEkkkkkEEk', `kE${fan[0]}EEE${fan[0]}Eyk`, `kE${fan[1]}EEE${fan[1]}Eyk`, `kE${fan[2]}EEE${fan[2]}Eyk`,
    'kEkkkkkEEEkkkkkEEk', 'kEEEEEEEEEEEEEEEEk', 'kkyykyykyykyykkkkk',
  ]) },
  balloon: { frames: [[
    '..rrrr..', '.rrrrrr.', 'rrpprrrr', 'rrprrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '...R....', '...k....', '....k...', '...k....', '..k.....', '...k....',
  ]] },
  phone: { frames: [['.kkkkkkkkkkk.', 'kKKKKKKKKKKKk', 'kKk.......kKk', '.kk.kkkkk.kk.', '...kGGGGGk...', '..kGkGkGkGk..', '..kGGGGGGGk..', '..kGkGkGkGk..', '..kkkkkkkkk..']] },
  envelope: { frames: [[
    'kkkkkkkkkkkkk', 'kwkwwwwwwwkwk', 'kwwkwwwwwkwwk', 'kwwwkwwwkwwwk', 'kwwwwkwkwwwwk', 'kwwwwwkwwwwwk', 'kwwwwwwwwwwwk', 'kwwwwwwwwwwwk', 'kkkkkkkkkkkkk',
  ]] },
  arrow: { frames: [['..rrr..', '..rrr..', '..rrr..', '..rrr..', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']] },
  floppy: { frames: [[
    'kkkkkkkkkkk.', 'kbbGGGGGkbbk', 'kbbGGGkGkbbk', 'kbbGGGkGkbbk', 'kbbGGGGGkbbk', 'kbbbbbbbbbbk', 'kbwwwwwwwwbk', 'kbwkkkkkkwbk', 'kbwwwwwwwwbk', 'kbwkkkkwwwbk', 'kbwwwwwwwwbk', 'kkkkkkkkkkkk',
  ]] },
  chalk: { frames: [['.........kkk', '.......kkwwk', '.....kkwwwGk', '...kkwwwGkk.', '.kkwwwGkk...', 'kwwwGkk.....', 'kGGkk.......', 'kkk.........']] },
  shoe: { frames: [['....nnnn....', '...nNNNNn...', '...nNNNNn...', '..nnNNNNnn..', 'nnnNNNNNNNnn', 'nNNNNNNNNNNn', 'kkkkkkkkkkkk']] },
  tube: { fps: 5, frames: ['l', 'l', 'l', 'Y', 'l', 'm'].map((c) => ['kkkkkkkkkkkkkkkkkk', `k${c.repeat(16)}k`, `k${c.repeat(16)}k`, 'kkkkkkkkkkkkkkkkkk']) },
  door: { frames: [['kkkkkkkkkk', 'kNNNNNNNNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnynNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kNnnnnnnNk', 'kkkkkkkkkk']] },
  snack: { frames: [['kkkkkkkkkkkk', 'koooooooooyk', 'koowwowwooyk', 'kooowwwoooyk', 'koowwowwooyk', 'koooooooooyk', 'kkkkkkkkkkkk']] },
  star: { frames: [['....y....', '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '.yyy.yyy.', '.yy...yy.', 'y.......y']] },
  pinkslip: { fps: 2.5, frames: [0, 1].map((curl) => [
    'kkkkkkkkkkkk.', 'kqqqqqqqqqqqk', 'kqRRRRRRRRRqk', 'kqqqqqqqqqqqk', 'kqPPPPPPPPPqk', 'kqqqqqqqqqqqk', 'kqPPPPPPPqqqk',
    'kqqqqqqqqqqqk', 'kqPPPPPPPPqqk', 'kqqqqqqqqqqqk', 'kqPPPPPqqrrqk', 'kqqqqqqqqrrqk',
    curl ? 'kqqqqqqqqkkkk' : 'kqqqqqqqqqqqk', curl ? 'kkkkkkkkkk...' : 'kqqqqqqqqqqkk', curl ? '.............' : 'kkkkkkkkkkkk.',
  ]) },
  buzz_hr: { fps: 6, frames: [0, 1, 2, 3, 4, 5, 6, 7].map((f) => {
    const L = f === 3 ? 'Y' : f === 6 ? 'm' : f % 2 ? 'w' : 'l';
    const R = f === 1 ? 'Y' : f === 5 ? 'u' : 'l';
    const rTube = R.repeat(22) + (f === 2 || f === 5 ? 'cywc' : R.repeat(4)) + R.repeat(10);
    const tube = `kGGk${L.repeat(36)}kKKk${rTube}kGGk`;
    const dripA = f % 4, dripB = (f + 2) % 4;
    const row = (dA, dB, spark) => {
      const a = Array(84).fill('.');
      if (dA) a[22] = 'M';
      a[40] = 'M'; a[41] = 'M'; if (dB) a[42] = 'M';
      if (spark && (f === 2 || f === 5)) { a[65] = 'y'; a[67] = 'c'; }
      return a.join('');
    };
    return [
      'K'.repeat(84), tube, tube, 'kGGk' + 'K'.repeat(36) + 'kMMk' + 'K'.repeat(36) + 'kGGk', tube,
      'k'.repeat(40) + 'MMMM' + 'k'.repeat(40),
      row(dripA >= 1, dripB >= 1, true), row(dripA >= 2, dripB >= 2, false),
    ];
  }) },
  ceiling_carl: { fps: 3.5, frames: [[-1, 0], [0, 0], [1, 0], [0, 0], [1, 1], [0, 0]].map(([sway, twitch]) => {
    const put = (w, segs) => {
      const a = Array(w).fill('.');
      for (const [x, s] of segs) for (let i = 0; i < s.length; i++) if (s[i] !== '.' && x + i >= 0 && x + i < w) a[x + i] = s[i];
      return a.join('');
    };
    const lx = 2 + sway, rx = 19 + sway, hx = 6 + twitch;
    return [
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'kmmmmmmMMMMMMMMMMmmmmmmk',
      '...mmmmMMMMMMMMMMmmmm...',
      '....mmmmuuuuuuuummmm....',
      '.....mmmddddddddmmm.....',
      '....dddddwddddwddddd....',
      '...ddddddwddddwdddddd...',
      '...ddddddddoodddddddd...',
      '...ddddddddwwdddddddd...',
      '..dddddddddwwddddddddd..',
      put(24, [[lx, 'ddd'], [5, 'ddddddddddddd'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 2, 'ssssssss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 1, 'sskwkwkwss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 1, 'sskkkkkkss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 1, 'sssSssSsss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx, 'sskkksswwwss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx, 'sskkksswkrss'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 1, 'ssNNNssNNN'], [rx, 'ddd']]),
      put(24, [[lx, 'ddd'], [hx + 1, 'ssssssssss'], [rx, 'ddd']]),
      put(24, [[lx, 'sss'], [hx + 1, 'NNNNNNNNNN'], [rx, 'sss']]),
      put(24, [[lx, 'sss'], [hx + 2, 'NNnNNnNN'], [rx, 'sss']]),
      put(24, [[lx, 'sss'], [hx + 3, 'N..N..N'], [rx, 'sss']]),
      put(24, [[lx, 'sss'], [rx, 'sss']]),
      put(24, [[lx, 'sSs'], [rx, 'sSs']]),
      put(24, [[lx, 'R.R'], [rx, 'R.R']]),
      put(24, [[lx, 'R.R'], [rx, 'R.R']]),
    ];
  }) },
  wall_cat: { fps: 4.5, frames: [0, 1, 2, 1, 0, 3, 4, 4, 3].map((pose) => {
    // pose 0..2: droopy idle sway; pose 3: mid-lunge; pose 4: full 1.5x horizontal grab toward the door!
    const grid = Array.from({ length: 22 }, () => Array(28).fill('.'));
    const wr = (x, y, s) => { for (let i = 0; i < s.length; i++) if (s[i] !== '.' && y >= 0 && y < 22 && x + i >= 0 && x + i < 28) grid[y][x + i] = s[i]; };
    for (let y = 0; y < 22; y++) wr(24, y, y % 2 ? 'uUYU' : 'UuYU');
    for (let y = 5; y < 18; y++) wr(21, y, 'uuu');
    // cat head & crooked specs
    wr(12, 1, '.tT....tR.');
    wr(11, 2, '.tttT..ttRt');
    wr(11, 3, 'ttttttttttt');
    wr(10, 4, 'ttNNNNtNNNNt');
    wr(10, 5, 'ttNwktNNNNwt');
    wr(10, 6, 'ttNNNNtNwktT');
    wr(10, 7, 'ttttttNNNNtt');
    wr(11, 8, pose >= 3 ? 'tttkkkkkktt' : 'tttukkkutt.');
    wr(11, 9, pose >= 3 ? 'ttkwRwRwktt' : 'ttttwRwtttt');
    // olive cardigan + badge emerging from yellow blister
    wr(13, 10, 'eeeeeeeeeU');
    wr(13, 11, 'eeeooweeeU');
    wr(14, 12, 'eewwweeeU');
    wr(14, 13, 'eeeeeeeeU');
    wr(15, 14, 'eeeeeeeU');
    wr(16, 15, 'eeeeeeU');
    if (pose < 3) {
      const dy = pose === 1 ? 1 : 0, dx = pose === 2 ? -1 : 0;
      for (let i = 0; i < 6; i++) { wr(10 + dx, 11 + i + dy, 'ee'); wr(15 + dx, 12 + i + dy, 'EE'); }
      wr(9 + dx, 17 + dy, 'ttt'); wr(14 + dx, 18 + dy, 'ttt');
      wr(9 + dx, 18 + dy, 'R.R'); wr(14 + dx, 19 + dy, 'R.R');
    } else if (pose === 3) {
      wr(5, 10, 'eeeeeeee'); wr(6, 13, 'EEEEEEEE');
      wr(3, 10, 'ttt'); wr(4, 13, 'ttt');
      wr(2, 9, 'R'); wr(2, 11, 'R'); wr(3, 13, 'R'); wr(3, 14, 'R');
    } else {
      wr(2, 9, 'eeeeeeeeeee'); wr(2, 10, 'eeeeeeeeeee');
      wr(3, 13, 'EEEEEEEEEEE'); wr(3, 14, 'EEEEEEEEEEE');
      wr(0, 8, 'Rtt'); wr(0, 9, '.tt'); wr(0, 10, 'Rtt');
      wr(1, 12, 'Rtt'); wr(1, 13, '.tt'); wr(1, 14, 'Rtt');
    }
    return grid.map((r) => r.join(''));
  }) },
  warden: { fps: 6, frames: [0, 1, 2, 1].map((f) => {
    const legs = f === 0 ? ['..BB..BB................', '.BB....BB...............', '.kk....kk...............']
      : f === 2 ? ['...BBBB.................', '..BB..BB................', '..kk..kk................']
      : ['...BBBB.................', '...BB.BB................', '...kk.kk................'];
    const scis = f === 0 ? [
      '..................GGww..', '................GGww....', '..oooooooo..rrGGww......', '..oyyyyyyo.rrkGww.......',
      '..oooooooo..rrkGGww.....', '....BBBB......rr.GGww...', '....BBBB...........GGww.',
    ] : f === 2 ? [
      '........................', '......................y.', '..oooooooo..rr..........', '..oyyyyyyo.rrkGGGGGGGGww',
      '..oooooooo..rrGGGGGGGGww', '....BBBB....rr........y.', '....BBBB................',
    ] : [
      '........................', '.................GGGww..', '..oooooooo..rr.GGGww....', '..oyyyyyyo.rrkGGww......',
      '..oooooooo..rrkGGGww....', '....BBBB....rr...GGGww..', '....BBBB................',
    ];
    return [
      '...BBBBBB...............', '..BBBBByBB..............', '..kkkkkkkk..............', '...ssssss...............',
      '...skssks...............', '...sskkss...............', '..oooooooo..............', '..oyyyyyyo..............',
      ...scis, ...legs,
    ];
  }) },
  granny_shred: { fps: 4, frames: [0, 1, 2, 3].map((f) => {
    const p = f % 2 ? 'kw' : 'wk';
    const slipTop = 13 + f;
    const grid = [
      '.......GGGGGG.........',
      '......GGGGGGGG........',
      '......ggssssgg........',
      '.....ssssssssss.......',
      `....sYYYYssYYYYs......`,
      `....sY${p}YssY${p}Ys......`,
      '....sYYYYssYYYYs......',
      '....ssNNNNssNNNNs.....',
      `....ssN${p}NssNwkNs.....`,
      '.....sNNNNssNNNNs.....',
      '....sKKKKssKKKKss.....',
      '....sKwkKssKr.Kss.....',
      '.....sskwkwkwkss......',
      '...vvvvssssssvvvv.....',
      '..vvvvvvssssvvvvvv....',
      '..vvvss......ssvvv....',
      '..vvv..........vvv....',
      '......................',
      '......................',
      '..kkkkkkkkkkkkkkkkkk..',
      '.kKGkGkGkGkGkGkGkGKk..',
      '.kKKKKKKKKKKKKKKKKzk..',
      `.kKKKKqqKPPKqqKKKK${f % 2 ? 'y' : 'r'}k..`,
      '.kKKKKPPKqqKPPKKKKKk..',
      '.kkkkkkkkkkkkkkkkkkk..',
    ].map((r) => r.split(''));
    const wr = (x, y, s) => { if (y < 19) for (let i = 0; i < s.length; i++) grid[y][x + i] = s[i]; };
    wr(7, slipTop, 'qqqqqqqq');
    wr(7, slipTop + 1, 'qRRRRRRq');
    wr(7, slipTop + 2, 'qPPPPPPq');
    wr(7, slipTop + 3, 'qqqqqqqq');
    if (f % 2) { grid[18][6] = 'y'; grid[18][15] = 'z'; }
    return grid.map((r) => r.join(''));
  }) },
  jensen_slip: { fps: 4, frames: [0, 1, 2, 1].map((f) => {
    const dy = f === 1 ? 0 : 1, hi = f === 2 ? 'y' : 'k';
    const base = [
      '..kkkkkkkk..............',
      '.kkkkkkkkkk.............',
      '.kksssssskk.............',
      '..skwskwsk..............',
      '..ssssssss..............',
      '..skwwwwks..............',
      '..ssssssss..............',
      '.DDDKwrKDDD.............',
      'DDDDKwrKDDDDss..........',
      'DDDDKwrKDDDDss..........',
      'DDDDKwrKDDDD............',
      'DDDDKwwKDDDD............',
      '.DDDDDDDDDD.............',
      '..DDD..DDD..............',
      '..DDD..DDD..............',
      '..kkk..kkk..............',
      '........................',
      '........................',
    ].map((r) => r.split(''));
    const slip = [
      `${hi.repeat(10)}`,
      `${hi}qqqqqqqq${hi}`,
      `${hi}qRRRRRRq${hi}`,
      `${hi}qqqqqqqq${hi}`,
      `${hi}qPPPPPPq${hi}`,
      `${hi}qqqqqqqq${hi}`,
      `${hi}qPPPPqqq${hi}`,
      `${hi}qqqqqrrq${hi}`,
      `${hi.repeat(10)}`,
    ];
    slip.forEach((row, i) => { for (let x = 0; x < row.length; x++) base[4 + dy + i][13 + x] = row[x]; });
    return base.map((r) => r.join(''));
  }) },
  fun_duo: { fps: 3.5, frames: [0, 1, 2, 1].map((f) => {
    const dx = f === 0 ? 0 : f === 2 ? 1 : 0, by = f % 2;
    const grid = Array.from({ length: 20 }, () => Array(28).fill('.'));
    const wr = (x, y, s) => { for (let i = 0; i < s.length; i++) if (s[i] !== '.') grid[y][x + i] = s[i]; };
    const fig = (ox, hat, shirt) => {
      wr(ox + 3, 1, 'y'); wr(ox + 2, 2, hat.repeat(3)); wr(ox + 1, 3, hat.repeat(5));
      wr(ox + 1, 4, 'sssss'); wr(ox, 5, 'swkwks'); wr(ox + 1, 6, 'sssss'); wr(ox, 7, 'skwwwks'); wr(ox + 1, 8, 'sssss');
      wr(ox, 9, shirt.repeat(7)); wr(ox - 1, 10, `s${shirt.repeat(7)}s`); wr(ox, 11, shirt.repeat(7)); wr(ox, 12, shirt.repeat(7));
      wr(ox + 1, 13, 'KK.KK'); wr(ox + 1, 14, 'KK.KK'); wr(ox + 1, 15, 'kk.kk');
    };
    fig(2 + dx, 'c', 'b');
    fig(18 - dx, 'P', 'e');
    // red balloon bobbing between them
    const bx = 11;
    ['..rrrr..', '.rrpprr.', '.rrrrrr.', '.rrrrrr.', '..rrrr..', '...rr...', '...k....', '....k...', '...k....', '..k.....'].forEach((r, i) => wr(bx, 1 + by + i, r));
    return grid.map((r) => r.join(''));
  }) },
  tetris_cube: { fps: 3, frames: [0, 2, 3, 3, 1].map((drop, fi) => {
    const grid = Array.from({ length: 22 }, () => Array(20).fill('.'));
    const wr = (x, y, s) => { for (let i = 0; i < s.length; i++) if (s[i] !== '.' && y >= 0 && y < 22) grid[y][x + i] = s[i]; };
    // bottom row of stacked cubicles
    for (let y = 15; y < 21; y++) { wr(1, y, y === 15 ? 'GGGGGGGGGG' : 'kxxTxxTxxk'); wr(11, y, y === 15 ? 'GGGGGGGG' : 'kddKddKk'); }
    wr(1, 21, 'kkkkkkkkkk'); wr(11, 21, 'kkkkkkkk');
    // middle offset cubicle + sideways green CRT monitor!
    for (let y = 10; y < 15; y++) wr(3, y, y === 10 ? 'GGGGGGGGGG' : 'kuuYuuYuuk');
    wr(13, 10, 'mmmmmm'); wr(13, 11, 'mZZZZm'); wr(13, 12, 'mZzzZm'); wr(13, 13, 'mZZZZm'); wr(13, 14, 'mmmmmm');
    // falling top cubicle module + tiny caution cone
    wr(5, drop, '..yy..'); wr(5, drop + 1, '.yyyy.');
    wr(4, drop + 2, 'GGGGGGGG');
    for (let y = 3; y <= 6; y++) wr(4, drop + y, 'kxxTxxTk');
    if (fi === 3) { wr(2, 9, 'y'); wr(13, 8, 'y'); }
    return grid.map((r) => r.join(''));
  }) },
  robot_oil: { fps: 3, frames: [0, 1, 2, 1].map((f) => {
    const ex = 5 + f * 2, ant = f % 2 ? 'r' : 'y';
    const eye = Array(8).fill('k'); eye[ex - 5] = 'y'; eye[ex - 4] = 'z';
    return [
      `........${ant}.........`,
      '........g.........',
      '....kkkkkkkkkk....',
      '...kGGGGGGGGGGk...',
      '...kGkkkkkkkkGk...',
      `...kG${eye.join('')}Gk...`,
      `...kG${eye.join('')}Gk...`,
      `...kGGGGGGkGGGk...`,
      `...kGGGGGG${f >= 1 ? 'k' : 'G'}GGGk...`,
      `....kkkkkk${f === 2 ? 'k' : 'G'}kkk....`,
      '..kkddddddddddkk..',
      '.kdddddoowddddddk.',
      '.kdddddwwwddddddk.',
      '..kddddddddddddk..',
      '...MMMMMMMMMMMM...',
      '.MMMMDDDDDDDDMMMM.',
      'MMMMDDDDDDDDDDMMMM',
      '.MMMMMMMMMMMMMMMM.',
    ];
  }) },
  mascot: { fps: 1.8, frames: [0, 0, 0, 1].map((alt) => [
    '.....NNNNNN...........',
    '...NNYYYYYYNN.........',
    '..NNNNNNNNNNNN........',
    '....eeeeeeee..........',
    alt ? '...ekwkeewww..........' : '...ewwweekwe..........',
    alt ? '...eeeeeeeee..........' : '...ewkeeeeee..........',
    alt ? '...ekwwwwwwke.........' : '....ekkwwwke..........',
    '....kkkkkkkk..........',
    '..ccYYYYvYYYccr.......',
    '.cccYYYvvYYYYcr.......',
    '.ee.YYvvYYYY.eebbbbb..',
    '....YvvYYYYY...bwwwb..',
    '....kkYYYYkk...bwkwb..',
    '....YYYYYYYY...bbbbb..',
    '.....KK..KK...........',
    '.....NN..NN...........',
    '....NNN..NNN..........',
    '...gggggggggg.........',
    '..KKKKKKKKKKKK........',
  ]) },
  porter: { fps: 3, frames: [0, 1, 2, 1].map((f) => {
    const mx = 11 + f;
    const grid = [
      '....KKKKKK............',
      '...KKKKKKKKK..........',
      '....tttttt............',
      '....tSttSt............',
      '....tTttTt............',
      '....ttTttt............',
      '.....t.T..............',
      '...nnnnnnnn...........',
      '..nnnnnnnnnn..........',
      '..nnnnnnnnnnt.........',
      '..nnnnnnnnnn..........',
      '...nnnnnnnn...........',
      '...nnnnnnnn...........',
      '....KK..KK.....yyyyy..',
      '....KK..KK.....yYYYy..',
      '....kk..kk.....yyyyy..',
      '...............yyyyy..',
      '...............YYYYY..',
      '......................',
    ].map((r) => r.split(''));
    for (let i = 0; i < 7; i++) grid[9 + i][mx] = 'T';
    const hx = mx - 2;
    for (let dx = 0; dx < 5; dx++) {
      grid[16][hx + dx] = dx % 2 ? 'n' : 'N';
      grid[17][hx + dx] = dx % 2 ? 'N' : 'M';
    }
    return grid.map((r) => r.join(''));
  }) },
  shadow: { fps: 3.5, frames: [0, 1, 2, 1, 3].map((f) => {
    const bg = f === 3 ? 'w' : 'K', eye = f === 3 ? 'w' : 'k';
    const st = f === 0 ? [4, 14] : f === 1 ? [13, 5] : f === 2 ? [4, 9] : [-1, -1];
    const grid = [
      '..nnnnnnnnnnnnnn..',
      `.nn${bg}${bg}${bg}kkkk${bg}${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}k${eye}kk${eye}k${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}${bg}kkkk${bg}${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}${bg}${bg}kk${bg}${bg}${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}kkkkkkkk${bg}${bg}nn.`,
      `.nn${bg}kk${bg}kkkk${bg}kk${bg}nn.`,
      `.nn${bg}k${bg}${bg}kkkk${bg}${bg}k${bg}nn.`,
      `.nn${bg}k${bg}${bg}kkkk${bg}${bg}k${bg}nn.`,
      `.nn${bg}k${bg}${bg}${bg}kk${bg}${bg}${bg}k${bg}nn.`,
      `.nn${bg}k${bg}${bg}${bg}kk${bg}${bg}${bg}k${bg}nn.`,
      `.nn${bg}k${bg}${bg}kkkk${bg}${bg}k${bg}nn.`,
      `.nn${bg}k${bg}${bg}k${bg}${bg}k${bg}${bg}k${bg}nn.`,
      `.nn${bg}${bg}${bg}${bg}k${bg}${bg}k${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}${bg}${bg}k${bg}${bg}k${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}${bg}${bg}k${bg}${bg}k${bg}${bg}${bg}${bg}nn.`,
      `.nn${bg}${bg}${bg}kk${bg}${bg}kk${bg}${bg}${bg}nn.`,
      '..kkkkkkkkkkkkkk..',
    ].map((r) => r.split(''));
    if (st[0] >= 0) { grid[st[1]][st[0]] = 'g'; grid[st[1] + 1][17 - st[0]] = 'w'; }
    return grid.map((r) => r.join(''));
  }) },
  trunk_line: { fps: 4, frames: [0, 1, 2, 1].map((f) => {
    const led = f % 2 ? 'r' : 'y', claw = f === 2 ? 'w' : 'G';
    return [
      '.....kkkkkk.........',
      '...kkbbbbbbkk.......',
      '...kKKKKKKKKk.......',
      '....kkkkkkkk........',
      `..kkkkK${led}gkkkkk......`,
      '.kkb..kkkk..bkk.....',
      `${claw}k....kbbk....k${claw}....`,
      `${claw}.${claw}...kkkk...${claw}.${claw}....`,
      '.....kbbbbk.........',
      '......kkkk..........',
      '.....kKyyKk.........',
      '......kkkk..........',
      '.....kk..kk.........',
      '....kb....bk........',
      '....kk....kk........',
      '...kb......bk.......',
      '...kk......kk.......',
      '..GGG......GGG......',
    ];
  }) },
  stand_in: { fps: 2.8, frames: [0, 1, 0, 2].map((f) => {
    const lit = f !== 2, f1 = lit ? 'm' : 'K', eye = lit ? 'w' : 'g', beam = lit ? 'u' : 'K', tip = lit ? 'y' : 'Y';
    return [
      'kkkkkkkkkkkkkkkkkkkkkk',
      'kkkkkkkkkkkkKKKKkkkkkk',
      `kkkkkkkkkkkK${f1}${f1}${f1}${f1}Kkkkkk`,
      `kkkkkkkkkkk${f1}${eye}k${f1}k${f1}kkkkk`,
      `kkkkkkkkkkk${f1}${eye}r${f1}k${f1}kkkkk`,
      `kkkkkkkkkkkK${f1}kk${f1}Kkkkkk`,
      `kkkkkkkkkkkk${f1}kk${f1}kkkkkk`,
      `kkkkkkkkkkDDDDDDDDkkkk`,
      `kkkkkkkkkDD${beam}${beam}DDDDDDkkk`,
      `kkkkkkk${beam}${beam}${beam}${beam}DDDDDDDDkkk`,
      `kkkkk${beam}${beam}${beam}${beam}${beam}DDDDDDDDkkkk`,
      `kkk${beam}${beam}${beam}${beam}${beam}kkDDDDDDkkkkkk`,
      `kk${tip}${tip}${beam}${beam}kkkkkDDkDDkkkkkk`,
      `kkyykkkkkkkDDkDDkkkkkk`,
      'kkkkkkkkkkkDDkDDkkkkkk',
      'kkkkkkkkkkkkk.kkkkkkkk',
      'kkkkkkkkkkkkkkkkkkkkkk',
    ];
  }) },
  speaker: { fps: 2.2, frames: [0, 0, 1, 2].map((f) => {
    const dark = f === 2;
    if (dark) {
      return [
        'kkkkkkkkkkkkkkkkkkkkkk',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'kkkkkkkkksssskkkkkkkkk',
        'kkkkkkkkskwwkskkkkkkkk',
        'kkkkkkkkskkkkskkkkkkkk',
        'kkkkkkkkksssskkkkkkkkk',
        'kkkkkkkDDDDDDDDkkkkkkk',
        'kkkkkkkDDDDRDDDkkkkkkk',
        'kkkkkkkDDDDDDDDkkkkkkk',
        'kkkkkkkDDDDDDDDkkkkkkk',
        'kkkkkkkkDD..DDkkkkkkkk',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'kkkkkkkkkkkkkkkkkkkkkk',
        'kkkkkkkkkkkkkkkkkkkkkk',
      ];
    }
    return [
      'kkkkkkkkkkkkkkkkkkkkkk',
      'kwwwwwwwwwwwwwwwwwwwwk',
      'kwKKKKwwwwwwwwwwwwwwwk',
      'kwKKKKwKKKwwwwwwwwwwwk',
      'kwKKKKwKKKwKKwwwwwwwwk',
      'kwKKKKwKKKwKKwrrrrwwwk',
      'kwwwwwwwwwwsswwrrrrwwk',
      'kkkkkkkkkkskkskwrrrrwk',
      '..........ssss........',
      '.........DDDDDD..g....',
      '.........DDDDRD..g....',
      '........NNNNNNNN.g....',
      '........NnnnnnnN.g....',
      '........NNNNNNNNgg....',
    ];
  }) },
  mecha_guard: { fps: 2.8, frames: [-1, 0, 1, 0].map((dx) => {
    const eyes = Array(8).fill('K');
    eyes[1 + (dx > 0 ? 1 : 0)] = 'r'; eyes[2 + (dx > 0 ? 1 : 0)] = 'o';
    eyes[5 + (dx < 0 ? -1 : 0)] = 'r'; eyes[6 + (dx < 0 ? -1 : 0)] = 'o';
    return [
      '...nnnnnnnn.......',
      '..nnnnnnnnnn......',
      '..nnnggggggnn.....',
      `..ng${eyes.join('')}gn....`,
      '..nggKKKKKKggn....',
      '...nnnnnnnnnn.....',
      '....nnnGGnnn......',
      '.....nnnnnn.......',
      '..KKKKKKKKKKKK....',
      '.KKggggggggggKK...',
      '.KggwwggggggggK...',
      '.KgggggYYgggggK...',
      '.KKggggggggggKK...',
      '...KKKKKKKKKK.....',
      '...ggg....ggg.....',
      '...gYg....gYg.....',
      '..KKKK....KKKK....',
      '..kkkk....kkkk....',
    ];
  }) },
};

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Draw one frame of a sprite into a 2D context at (0, 0), one unit a pixel. */
export function paint(g, name, frame = 0) {
  const s = SPRITES[name]; if (!s) return { w: 0, h: 0 };
  const rows = s.frames[frame % s.frames.length];
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) { const c = PAL[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
  return sizeOf(name);
}
export function sizeOf(name) {
  const s = SPRITES[name]; if (!s) return { w: 0, h: 0 };
  return { w: Math.max(...s.frames.flatMap((f) => f.map((r) => r.length))), h: Math.max(...s.frames.map((f) => f.length)) };
}

const live = new Set();
let ticking = false, seen = null;

function draw(it, t) {
  const { g, name, fx, w, h, pad } = it, s = SPRITES[name], frames = s.frames.length;
  const frame = frames > 1 ? Math.floor(t * (s.fps || 2) + it.phase * frames) % frames : 0;
  const k = t * it.speed + it.phase * 6.283;
  const key = fx === 'spin' ? Math.round(Math.cos(k * 2.2) * 8) : fx === 'blink' ? Math.floor(k * 1.3) % 2 : fx === 'pulse' ? Math.round(Math.sin(k * 3) * 3) : fx === 'bob' ? Math.round(Math.sin(k * 2.4) * pad)
    : fx === 'sway' ? Math.round(Math.sin(k * 2) * 6) : fx === 'shake' ? Math.floor(k * 9) % 4 : fx === 'turn' ? Math.floor(k * 2.5) % 16 : 0;
  if (frame === it.frame && key === it.key) return;
  it.frame = frame; it.key = key;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w + pad * 2, h + pad * 2);
  g.translate(pad + w / 2, pad + h / 2);
  if (fx === 'spin') g.scale(key / 8 || 0.06, 1);
  else if (fx === 'pulse') g.scale(1 + key * 0.04, 1 + key * 0.04);
  else if (fx === 'bob') g.translate(0, key);
  else if (fx === 'sway') g.rotate(key * 0.03);
  else if (fx === 'shake') g.translate([0, 1, 0, -1][key], [0, -1, 0, 0][key]);
  else if (fx === 'turn') g.rotate((key / 16) * 6.283);
  else if (fx === 'blink' && key) g.globalAlpha = 0;
  g.translate(-w / 2, -h / 2);
  paint(g, name, frame);
  g.globalAlpha = 1;
}

function tick(ms) {
  const t = ms / 1000;
  for (const it of live) if (it.on) draw(it, t);
  if (live.size) requestAnimationFrame(tick); else ticking = false;
}

/**
 * Turn every [data-sprite] under `root` into its picture. Safe to call again after adding more.
 * data-sprite: which · data-fx: how it moves · data-scale: screen pixels to a pixel (default 3) · data-speed: default 1
 */
export function mount(root = document) {
  const quiet = still();
  if (!seen && typeof IntersectionObserver === 'function') seen = new IntersectionObserver((list) => { for (const e of list) if (e.target.__sprite) e.target.__sprite.on = e.isIntersecting; }, { rootMargin: '120px' });
  for (const el of root.querySelectorAll('[data-sprite]:not([data-mounted])')) {
    const name = el.dataset.sprite; if (!SPRITES[name]) continue;
    el.dataset.mounted = '1';
    const { w, h } = sizeOf(name), scale = Number(el.dataset.scale) || 3, fx = el.dataset.fx || '', pad = fx === 'bob' || fx === 'shake' ? 2 : fx === 'sway' || fx === 'turn' || fx === 'pulse' ? 3 : 0;
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2; canvas.height = h + pad * 2;
    canvas.style.width = `${(w + pad * 2) * scale}px`; canvas.style.height = `${(h + pad * 2) * scale}px`;
    canvas.className = 'sprite'; canvas.setAttribute('aria-hidden', 'true');
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
    el.append(canvas);
    const it = { g, name, fx: quiet ? '' : fx, w, h, pad, frame: -1, key: NaN, on: true, speed: Number(el.dataset.speed) || 1, phase: (el.dataset.phase !== undefined ? Number(el.dataset.phase) : Math.random()) };
    draw(it, 0);
    if (quiet || (!fx && SPRITES[name].frames.length < 2)) continue;
    canvas.__sprite = it; live.add(it); seen?.observe(canvas);
  }
  if (live.size && !ticking) { ticking = true; requestAnimationFrame(tick); }
}

/* ---- the name, in blocks ------------------------------------------------------------------------- */

const FONT = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
};

/**
 * BLOCK over ROOMS, each pixel of each letter a block with a top and a side. One block of it is never quite where it
 * should be. → stop()
 */
export function drawLogo(canvas, lines = ['BLOCK', 'ROOMS']) {
  const cell = 14, deep = 6, gap = 1, rowGap = 2;
  const cols = Math.max(...lines.map((l) => l.length * 5 + (l.length - 1) * gap)), rows = lines.length * 7 + (lines.length - 1) * rowGap;
  canvas.width = cols * cell + deep + 4; canvas.height = rows * cell + deep + 4;
  const g = canvas.getContext('2d');
  const cells = [];
  lines.forEach((line, li) => [...line].forEach((ch, ci) => (FONT[ch] || []).forEach((row, y) => [...row].forEach((on, x) => { if (on === '#') cells.push({ x: ci * (5 + gap) + x, y: li * (7 + rowGap) + y, line: li }); }))));
  // (drawn from the back: right to left along a row would hide the sides, so top rows first, left to right)
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  const INK = [['#ffd83a', '#fff6a8', '#b99a2a'], ['#f2e7ab', '#fffbe0', '#9c7f24']];
  const odd = cells[Math.floor(cells.length * 0.71)];
  function block(c, dx = 0, dy = 0, alpha = 1) {
    const x = 2 + c.x * cell + dx, y = 2 + deep + c.y * cell + dy, [front, top, side] = INK[c.line % 2];
    g.globalAlpha = alpha;
    g.fillStyle = '#2a1f06'; g.fillRect(x - 1, y - 1, cell + 2, cell + 2);
    g.fillStyle = top; g.beginPath(); g.moveTo(x, y); g.lineTo(x + deep, y - deep); g.lineTo(x + cell + deep, y - deep); g.lineTo(x + cell, y); g.fill();
    g.fillStyle = side; g.beginPath(); g.moveTo(x + cell, y); g.lineTo(x + cell + deep, y - deep); g.lineTo(x + cell + deep, y + cell - deep); g.lineTo(x + cell, y + cell); g.fill();
    g.fillStyle = front; g.fillRect(x, y, cell, cell);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, cell, 2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + cell - 2, cell, 2);
    g.globalAlpha = 1;
  }
  function frame(t) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    const k = Math.floor(t * 2) % 9;                                    // (most of the time it is in its place)
    for (const c of cells) if (c !== odd) block(c);
    if (k < 6) block(odd); else if (k === 6) block(odd, 5, -4, 0.75); else if (k === 7) block(odd, -3, 3, 0.5);
  }
  frame(0);
  if (still()) return () => {};
  let on = true;
  const loop = (ms) => { if (!on) return; frame(ms / 1000); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return () => { on = false; };
}

/** A square of dark with the tubes of somebody else's ceiling a long way under it: the background of the top of the page. → a data: address */
export function voidTile(size = 240, seed = 7) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#050507'; g.fillRect(0, 0, size, size);
  let n = seed >>> 0; const rand = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  for (let y = 6; y < size; y += 24) for (let x = 4; x < size; x += 20) {
    if (rand() < 0.42) continue;
    const k = 0.25 + rand() * 0.75, warm = rand();
    g.fillStyle = `rgba(${255}, ${Math.round(226 + warm * 20)}, ${Math.round(150 + warm * 60)}, ${(k * 0.55).toFixed(2)})`;
    g.fillRect(x, y, 8, 3);
    g.fillStyle = `rgba(255, 236, 170, ${(k * 0.12).toFixed(2)})`; g.fillRect(x - 2, y - 2, 12, 7);
  }
  return c.toDataURL('image/png');
}
