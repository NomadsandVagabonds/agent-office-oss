// Local +Z is the roller end facing the operator. Dimensions use the inventory sculptor's units.
export const REAR_SLOT = { y: 2.85, z: 6.16 };
export const SIGHT_CENTER = { y: 10.7, z: 1.54 };
export const CHARGE_WINDOW = { x: -1.76, y: 6.30, z: 5.71, step: .88 };

function block(s, x, y, z, w, h, d, bevel, color) {
  s.push().translate(x, y, z).bevelBox(w, h, d, bevel, color, { seg: 1 }).pop();
}

// Eight clipped corners around each horizontal section keep the moulding angular in silhouette.
function shellRing(w, front, rear, y, cut) {
  const x = w / 2, c = cut;
  return [[x-c,y,front],[-x+c,y,front],[-x,y,front+c],[-x,y,rear-c],
    [-x+c,y,rear],[x-c,y,rear],[x,y,rear-c],[x,y,front+c]];
}
function join(s, bottom, top, color) {
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    s.faceQuad(bottom[i], bottom[j], top[j], top[i], color);
  }
}
function lid(s, ring, color) {
  for (let i = 1; i < ring.length - 1; i++) s.faceTri(ring[0], ring[i], ring[i+1], color);
}

export function sculptCarbonCamera(s) {
  const ivory = '#e5cf9f', edge = '#bdaa84', seam = '#302d30';
  block(s,0,.37,-.2,10.7,.74,13.1,.22,seam);
  block(s,0,1.03,-.24,10.8,.86,13.05,.22,ivory);
  const bottom = shellRing(10.3,-.65,6.13,1.36,.36);
  const shoulder = shellRing(8.3,1.04,5.60,7.18,.36);
  const rim = shellRing(7.95,1.18,5.45,7.36,.30);
  join(s,bottom,shoulder,ivory); join(s,shoulder,rim,'#f1dfb7'); lid(s,rim,ivory);

  // An accordion, each valley tapering into the next ridge. The lens looks down -Z.
  const fold = (z,w,h) => shellRing(w,-h/2,h/2,z,.32).map(([x,depth,side])=>[x,3.48+side,depth]);
  let last = fold(.95,8.42,6.05);
  for (let i=0;i<5;i++) {
    const z=.95-i*1.25, w=8.42-i*.65, h=6.05-i*.54;
    const valley=fold(z-.76,w-.88,h-.75), ridge=fold(z-1.25,w-.65,h-.54);
    join(s,last,valley,'#3e3840'); join(s,valley,ridge,'#26242b'); last=ridge;
  }
  block(s,0,3.47,-5.69,5.60,4.63,1.10,.28,'#efdcaf');
  block(s,0,3.47,-6.27,3.65,3.04,.16,.12,'#27272b');
  block(s,0,3.47,-6.38,2.43,2.02,.12,.12,'#333a43');
  block(s,-.45,3.88,-6.455,.51,.22,.035,.015,'#839592');

  // Folding wire sight, open right through the centre.
  for (const x of [-3.4,3.4]) {
    block(s,x,7.54,1.54,1.02,.74,.98,.14,seam);
    block(s,x,10.66,1.54,.34,6.05,.35,.055,'#373237');
  }
  for (const y of [7.98,13.57]) block(s,0,y,1.54,6.96,.32,.35,.055,'#373237');
  for (const x of [-1,1]) {
    block(s,x*1.96,SIGHT_CENTER.y,SIGHT_CENTER.z,2.97,.13,.14,.02,seam);
    block(s,x*.47,SIGHT_CENTER.y,SIGHT_CENTER.z,.12,.92,.16,.02,seam);
  }
  for (const side of [-1,1]) {
    block(s,0,SIGHT_CENTER.y+side*1.67,SIGHT_CENTER.z,.13,2.39,.14,.02,seam);
    block(s,0,SIGHT_CENTER.y+side*.44,SIGHT_CENTER.z,.95,.12,.16,.02,seam);
  }
  block(s,2.48,7.47,3.98,2.82,.25,2.42,.12,edge);
  block(s,2.48,7.73,3.98,2.24,.45,1.91,.14,'#e65a42');
  block(s,-4.97,3.58,2.18,1.18,4.30,2.52,.17,'#302c30');
  block(s,-4.99,4.08,2.18,1.20,.50,2.54,.09,'#aa5747');
  block(s,-4.96,5.70,2.18,1.07,.18,2.35,.06,'#534a48');

  // Real gap in the rear lip, backed with black felt. Only the held model adds a print.
  const {y,z} = REAR_SLOT;
  block(s,0,y,z-.025,8.36,.88,.18,.07,'#1c1b21');
  block(s,0,y+.41,z+.04,8.51,.23,.29,.07,'#807465');
  block(s,0,y-.38,z+.06,8.48,.22,.33,.06,'#514b48');
  for (const x of [-4.08,4.08]) block(s,x,y,z+.05,.33,.82,.28,.07,'#5e564d');

  s.push().translate(0,CHARGE_WINDOW.y,CHARGE_WINDOW.z).rotateX(-.089);
  block(s,0,0,.04,4.22,1.14,.19,.12,'#bba985');
  block(s,0,0,.15,4.00,.96,.16,.09,seam);
  for (let i=0;i<4;i++) block(s,-1.32+i*.88,0,.24,.72,.64,.065,.035,'#473d31');
  s.pop();
}

export function sculptCarbonGrip(s) {
  const skin='#da9b75', joint='#c58664';
  s.tube([[5.4,4.3,2.6],[5.45,4.25,4.35],[5.60,3.55,5.4]],1.15,6,skin,{sy:.84});
  for (let i=0;i<3;i++) {
    const z=1.54+i*1.05;
    s.tube([[5.45,4.42,z],[5.54,2.72,z],[5.10,1.57,z]],.47,6,i%2?joint:skin);
  }
  s.tube([[5.42,4.8,4.45],[5.05,6.20,4.50],[4.25,7.22,4.33],[3.10,7.83,4.14]],t=>.67-.15*t,6,skin);
  s.tube([[5.55,3.5,5.05],[6.4,2.1,6.82],[7.22,1.45,8.05]],1.1,6,joint);
  s.push().translate(7.65,.76,8.62).rotateZ(.45).rotateX(.62);
  block(s,0,0,0,3.45,3.20,2.94,.25,'#8b94a4');
  block(s,0,-1.72,3.76,4.02,4.48,7.98,.38,'#596781');
  s.tube([[0,-2.5,6.4],[2.5,-5.2,12.3],[5.8,-8.6,19.5]],t=>2.12+t*.72,8,'#596781');
  s.pop();
}
