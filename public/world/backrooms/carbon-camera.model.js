// Local +Z is the roller end facing the operator. Dimensions use the inventory sculptor's units.
export const REAR_SLOT = { y: 2.85, z: 6.16 };
export const SIGHT_CENTER = { y: 10.7, z: 1.54 };
export const CHARGE_WINDOW = { x: -1.76, y: 6.30, z: 5.71, step: .88 };
export const MODE_WINDOW = { x: .37, y: 4.68, z: 6.13 };

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
  const ivory = '#f2e3bd', edge = '#ac997b', seam = '#252c33';
  block(s,0,.37,-.2,10.7,.74,13.1,.22,seam);
  block(s,0,1.03,-.24,10.8,.86,13.05,.22,ivory);
  const bottom = shellRing(10.3,-.65,6.13,1.36,.36);
  const shoulder = shellRing(8.3,1.04,5.60,7.18,.36);
  const rim = shellRing(7.95,1.18,5.45,7.36,.30);
  join(s,bottom,shoulder,ivory); join(s,shoulder,rim,'#fff4d4'); lid(s,rim,ivory);
  // Printed colour separations run over the lid and fold down the operator's left shoulder.
  for (const [i,color] of ['#158d9f','#ed5566','#f6a539'].entries()) {
    const x=-3.88+i*.31, w=.29;
    s.faceQuad([x,7.374,5.38],[x+w,7.374,5.38],[x+w,7.374,2.22],[x,7.374,2.22],color);
    s.faceQuad([x,7.19,5.625],[x+w,7.19,5.625],[x+w,7.37,5.46],[x,7.37,5.46],color);
    s.faceQuad([x,2.02,6.10],[x+w,2.02,6.10],[x+w,7.19,5.625],[x,7.19,5.625],color);
  }
  // Two offset sheets stamped into the lid, beside the thumb release.
  for(const [x,z,color] of [[-1.78,3.76,'#34797c'],[-1.48,4.10,'#384444']]){
    block(s,x,7.385,z-.55,1.15,.03,.13,.01,color);
    block(s,x,7.385,z+.55,1.15,.03,.13,.01,color);
    for(const side of [-1,1])block(s,x+side*.51,7.385,z,.13,.03,1.14,.01,color);
  }

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
  block(s,0,3.47,-6.38,2.62,2.12,.12,.12,'#296269');
  block(s,0,3.47,-6.455,1.90,1.58,.055,.12,'#132634');
  block(s,-.45,3.88,-6.493,.61,.25,.035,.015,'#8bcfc7');
  // A ribbed flash reflector shares the front housing with the square lens.
  block(s,0,5.37,-6.27,3.8,.45,.17,.07,'#555b63');
  for (let i=0;i<7;i++) block(s,(i-3)*.47,5.38,-6.38,.40,.29,.07,.03,i%2?'#d7e6e1':'#eef6ea');

  // Folding wire sight, open right through the centre.
  for (const x of [-3.4,3.4]) {
    block(s,x,7.54,1.54,1.02,.74,.98,.14,seam);
    block(s,x,10.66,1.54,.34,6.05,.35,.055,'#373237');
  }
  for (const y of [7.98,13.57]) block(s,0,y,1.54,6.96,.32,.35,.055,'#373237');
  for (const x of [-3.4,3.4]) {
    block(s,x,13.56,1.73,.74,.18,.07,.03,'#b0b8ae');
    block(s,x,7.6,2.04,.45,.28,.06,.06,'#afae9f');
  }
  for (const x of [-1,1]) {
    block(s,x*1.96,SIGHT_CENTER.y,SIGHT_CENTER.z,2.97,.13,.14,.02,seam);
    block(s,x*.47,SIGHT_CENTER.y,SIGHT_CENTER.z,.12,.92,.16,.02,seam);
  }
  for (const side of [-1,1]) {
    block(s,0,SIGHT_CENTER.y+side*1.67,SIGHT_CENTER.z,.13,2.39,.14,.02,seam);
    block(s,0,SIGHT_CENTER.y+side*.44,SIGHT_CENTER.z,.95,.12,.16,.02,seam);
  }
  block(s,2.48,7.47,3.98,2.85,.25,2.51,.16,seam);
  block(s,2.48,7.77,3.98,2.27,.52,1.96,.16,'#fb563c');
  for(const x of [1.72,2.05,2.38])block(s,x,8.04,4,.09,.05,1.21,.02,'#ff9a6a');
  block(s,-4.97,3.58,2.18,1.18,4.30,2.52,.17,'#302c30');
  block(s,-4.99,4.08,2.18,1.20,.50,2.54,.09,'#aa5747');
  block(s,-4.96,5.70,2.18,1.07,.18,2.35,.06,'#534a48');

  // Real gap in the rear lip, backed with black felt. Only the held model adds a print.
  const {y,z} = REAR_SLOT;
  block(s,0,y,z-.025,8.36,.88,.18,.07,'#1c1b21');
  block(s,0,y+.41,z+.04,8.51,.23,.29,.07,'#b5bab0');
  block(s,0,y-.38,z+.06,8.48,.22,.33,.06,'#514b48');
  for (const x of [-4.08,4.08]) block(s,x,y,z+.05,.33,.82,.28,.07,'#5e564d');
  for (const x of [-3.78,3.78]) block(s,x,y,z+.09,.42,.45,.22,.085,'#39393c');
  for(const x of [-4.4,4.4]){
    block(s,x,1.05,6.30,.32,.30,.06,.06,'#746f65');
    block(s,x,1.05,6.34,.17,.055,.03,.01,'#393a3b');
  }

  const window=MODE_WINDOW;
  s.push().translate(window.x,window.y,window.z).rotateX(-.09);
  block(s,0,0,-.11,6.81,1.98,.22,.18,edge);
  block(s,0,0,0,6.63,1.86,.23,.14,'#243435');
  block(s,0,0,.12,6.34,1.64,.08,.08,'#112023');
  s.pop();

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
