// Scouting: a list of cameras, one a second, for --still. Not a shot for the cut.
//   SCOUT='[{"x":0,"z":0,"dist":20,"yaw":0,"pitch":0.8}]' SCOUT_URL='/?shot=1&hour=13' rig/film shots/scout.mjs --fps 3 --still 0.67,1.67
const cams = JSON.parse(process.env.SCOUT || '[]');
export default {
  name: process.env.SCOUT_NAME || 'scout',
  base: process.env.SCOUT_BASE || 'http://localhost:4410',
  url: process.env.SCOUT_URL || '/?shot=1&hour=13',
  size: [1920, 1080], fps: 3, seconds: cams.length,
  arg: { cams, ui: process.env.SCOUT_UI !== '0' },
  setup(arg) { document.getElementById('boot')?.remove(); if (!arg.ui) document.getElementById('ui').style.display = 'none'; },
  tick(t, i, arg) { const c = arg.cams[Math.min(arg.cams.length - 1, Math.floor(t))]; if (c) office.rig.flyTo(c, { instant: true }); },
};
