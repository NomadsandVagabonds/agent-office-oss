// Backup lamps are real fixtures with a separate red bake contribution.
// Place after furnishing, without drawing from the room's random stream.
import { lin, WHITE } from './kit.js';

export function emergencyFixtures(c) {
  const bank = c.rt.lighting?.emergencyBank;
  if (bank == null) return;
  const red = lin('#ff4930'), metal = lin('#55564d');
  const lens = c.shining(`panel-bank-${bank}`, c.kit.tex.white(), 3, red);
  let count = 0;
  for (const side of ['back', 'front', 'left', 'right']) {
    const spans = c.spans(side, .4, 2.25).filter(([a,b]) => b-a >= .6).sort((a,b) => (b[1]-b[0])-(a[1]-a[0]));
    if (!spans.length) continue;
    const at = (spans[0][0]+spans[0][1])/2, p = c.wallAt(side, at, .06);
    const y = Math.min(c.ceilAt(p.x,p.z)-.28, c.floorAt(p.x,p.z)+2.2);
    const dx = Math.abs(p.U[0])*.23 + Math.abs(p.n[0])*.06;
    const dz = Math.abs(p.U[2])*.23 + Math.abs(p.n[2])*.06;
    c.flat.box(p.x-dx,y-.15,p.z-dz,p.x+dx,y+.15,p.z+dz,metal);
    c.hang(lens,side,at,y,.34,.16,null,WHITE,.125);
    // The two dark ribs keep the small lens legible even when it blooms.
    for (const offset of [-.07,.07]) c.hang(c.flat,side,at+offset,y,.018,.19,null,metal,.13);
    c.light(p.x+p.n[0]*.22,y,p.z+p.n[2]*.22,red,3.8,
      {bank,k:5,far:8,wrap:.75,axis:p.n,floor:.35});
    if (++count === 2) break;
  }
  if (count) return;
  // Unusual wall openings can leave nowhere to hang one. Use a ceiling puck
  // over an existing live panel instead of silently making a black room.
  const p = c.room.panels.find(p => p.state !== 'dead'), y = c.ceilAt(p.x,p.z)-.07;
  c.flat.box(p.x-.24,y-.02,p.z-.16,p.x+.24,y+.04,p.z+.16,metal);
  c.lay(lens,p.x,p.z,.34,.2,0,null,WHITE,y-.025,true);
  c.light(p.x,y-.12,p.z,red,4,{bank,k:5,far:8,wrap:.75});
}
