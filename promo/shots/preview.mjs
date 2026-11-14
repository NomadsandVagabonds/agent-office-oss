// Preview a tape from one fixed (or follow) camera, small and at a low frame rate — to check what happened before lighting it properly.
//   TAPE=tapes/01-arrive.json CAM='{"x":-6,"z":-5,"dist":26,"yaw":0.2,"pitch":0.7}' FOLLOW=Ada rig/film shots/preview.mjs --size 960x540 --fps 10 --seconds 20
const cam = JSON.parse(process.env.CAM || '{"x":0,"z":0,"dist":40,"yaw":0,"pitch":0.8}');
export default {
  name: process.env.NAME || 'preview',
  base: process.env.BASE || 'http://localhost:4410',
  url: process.env.URL || '/?shot=1&hour=13',
  tape: process.env.TAPE ? '../' + process.env.TAPE : undefined, tapeStart: Number(process.env.START || 0),
  size: [960, 540], fps: 10, seconds: 20,
  arg: { cam, follow: process.env.FOLLOW || '' },
  setup(arg) {
    document.getElementById('boot')?.remove();
    office.rig.flyTo(arg.cam, { instant: true });
  },
  tick(t, i, arg) {
    if (arg.follow) {
      const a = [...office.net.state.agents.values()].find((x) => x.name === arg.follow);
      const p = a && office.people.positionOf(a.id);
      if (p) { office.rig.flyTo({ ...arg.cam, x: p.x, z: p.z }, { instant: true }); return; }
    }
    office.rig.flyTo(arg.cam, { instant: true });
  },
};
