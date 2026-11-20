import { chairVox } from '../../backrooms/workstation.model.js';
import { CLOTH } from './misprint.js';

// Develop the study's actual chair voxels onto one small piece of instant film.
// The projection is cached by the floor kit and does not need another WebGL camera or render pass.
export function chairPositive(kit) {
  return kit.tex.custom('carbon-camera:teal-chair', 128, 128, g => {
    g.fillStyle = '#efe8d8'; g.fillRect(0,0,128,128);
    g.fillStyle = '#bcb4a5'; g.fillRect(7,7,114,104);
    const vox = chairVox({ colour: CLOTH }), visible = [];
    vox.each((x,y,z,ink) => {
      const top = !vox.has(x,y+1,z), front = !vox.has(x,y,z+1), side = !vox.has(x+1,y,z);
      if (top || front || side) visible.push({ x,y,z,ink, shade: top ? 1.16 : front ? 1.01 : .78 });
    });
    visible.sort((a,b) => (a.x-b.x)*.40 + (a.y-b.y)*.24 + a.z-b.z);
    function draw(ghost) {
      for (const {x,y,z,ink,shade} of visible) {
        const u = Math.round(65 + .99*x - .42*z), v = Math.round(92 - .98*y + .24*z + .11*x);
        if (!ghost) {
          const channel = shift => Math.min(255, Math.round(((ink >>> shift) & 255)*shade+12));
          g.fillStyle = 'rgb('+channel(16)+','+channel(8)+','+channel(0)+')';
        }
        g.fillRect(u + (ghost ? 3 : 0),v,2,2);
      }
    }
    g.fillStyle = '#ab608a'; draw(true); draw(false);
  }, { clamp: true });
}
