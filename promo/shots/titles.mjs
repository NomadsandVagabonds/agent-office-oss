// The cards: type on black, animated in titles/titles.html and filmed like everything else.
//   node rig/capture.mjs shots/titles.mjs --shot titleMain          (no 3D here: an ordinary headless browser will do)
const BEAT = 3.4425 / 4;
// another name, without editing the page: TITLE_NAME="…" TITLE_VER="" TITLE_LINE="…" node rig/capture.mjs shots/titles.mjs --shot titleMain
const named = ['name', 'ver', 'line'].filter((k) => process.env[`TITLE_${k.toUpperCase()}`] !== undefined)
  .map((k) => `&${k}=${encodeURIComponent(process.env[`TITLE_${k.toUpperCase()}`])}`).join('');
const card = (name, seconds, extra = '') => ({
  base: 'http://localhost:4410', url: `/__promo/titles.html?card=${name}&beat=${BEAT}${extra}`, html: '../titles/titles.html',
  ready: 'window.__ready === true', settle: 0.2, afterSetup: 0,
  size: [1920, 1080], fps: 30, seconds,
  setup() { window.__start(); },
});
export const shots = {
  titleMain: card('title', 4, named),
  titleUi: card('ui', 3),
  titleEggs: card('eggs', 3),
  // the same lockup with nothing behind it, to lay over the office at night
  titleEnd: card('end', 6, '&bare=1' + named),
};
