import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit }, { buildWorld }, { generate, toWorld }, { createPlayer }, { createHandView }, THREE] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/world.js'), import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/player.js'), import('../public/world/backrooms/hand.js'), import('../public/vendor/three.module.min.js'),
]);
const previousDocument = globalThis.document;
const draw = new Proxy({}, { get: (_, k) => k === 'measureText' ? s => ({ width: String(s).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => draw }) };
test.after(() => { globalThis.document = previousDocument; });

for (const rot of [0, 1, 2, 3]) test(`runtime clearance: crawl openings and auto-duck survive bridge support, rotation ${rot}`, async t => {
  const kit = createKit(), generated = generate('crawl-runtime');
  const def = { ...generated.rooms[0], id: 0, kind: 'plain', rot, cx: 0, cz: 0, x: -6.1, z: -6.1, w: 12.2, d: 12.2, W: 12, D: 12, y: 1.7, H: 3,
    shape: null, panels: [], wins: [], doors: [{ side: 'front', c: 0, w: 2, h: .72, sill: 0 }], lows: [{ x0: -1, x1: 1, z0: -.25, z1: .25, h: .72 }] };
  const level = { ...generated, rooms: [def], links: [], windows: [], start: { room: 0, x: 0, z: 0 } };
  const world = await buildWorld(kit, level, { catalogue: { has: () => false }, level, builders: { plain() {} } });
  t.after(() => { world.dispose(); kit.dispose(); });
  const at = (x,z) => toWorld(def,x,z), head = (x,z) => { const p=at(x,z);return world.headroom(p.x,p.z); };
  assert.ok(Math.abs(head(0,5.9)-.72)<1e-6, 'low doorway'); assert.ok(Math.abs(head(0,0)-.72)<1e-6, 'interior wall hole');
  assert.ok(Math.abs(head(3,0)-3)<1e-6, 'ordinary room stays full height');
  const rt = world.rooms[0]; rt.floorY = () => 0; rt.headY = () => 3;
  assert.ok(Math.abs(head(0,0)-.72)<1e-6, 'custom floor/head functions also respect wall holes');
  for (const direction of [1,-1]) {
    const start = at(0,direction*1.1), camera = new THREE.PerspectiveCamera();
    const input = { keys:new Set(['w']), dx:0,dy:0,stick:{x:0,y:0} };
    const player = createPlayer(world,camera,{...start,yaw:rot*Math.PI/2+(direction<0?Math.PI:0)},input);
    let ducked=false, crossed=false;
    for(let i=0;i<150;i++) { player.update(1/60); const p=player.me; const distance=Math.hypot(p.x,p.z);
      if(distance<.23){ducked ||= p.crouching; assert.ok(camera.position.y<def.y+.72, 'camera stays below the opening');}
      if((p.x-start.x)**2+(p.z-start.z)**2>2.5)crossed=true;
    }
    assert.ok(ducked,'automatic crouch without C'); assert.ok(crossed,'can crawl through from either side');
    assert.ok(player.me.sink<.1,'stands up after leaving the gap');
  }
});

test('balloon has a visible FPS model, with a grip, phone framing and wall-safe depth', t => {
  const kit=createKit(), camera=new THREE.PerspectiveCamera(65,16/9,.01,100); camera.updateProjectionMatrix();
  let selected={type:'balloon'};
  const env={kit, vhs:{picture:{w:1280,h:720}}, inventory:{held:()=>selected},player:{me:{x:0,z:0,speed:0}},world:{scene:new THREE.Group(),lightAt:()=>[.5,.5,.5]}};
  const view=createHandView(env,camera);t.after(()=>{view.dispose();kit.dispose();});view.update(.1,true);
  const group=env.world.scene.children[0], mesh=group.children[0];
  assert.ok(group.visible&&mesh.visible&&mesh.geometry.attributes.position.count>0);
  assert.equal(mesh.renderOrder,10000);assert.equal(mesh.material.transparent,true);
  const calls=[];mesh.onBeforeRender({state:{buffers:{depth:{setMask:v=>calls.push(v)}}},clearDepth:()=>calls.push('clear')});
  assert.deepEqual(calls,[true,'clear']);
  for(const [w,h] of [[1280,720],[390,844]]) {
    env.vhs.picture={w,h};camera.aspect=w/h;camera.updateProjectionMatrix();view.update(.1,true);group.updateMatrixWorld(true);
    const pos=mesh.geometry.attributes.position,p=new THREE.Vector3();let inPicture=0,red=0;
    const color=mesh.geometry.attributes.aAlb;
    for(let i=0;i<pos.count;i++) { if(color.getX(i)<=color.getY(i)*1.6)continue;red++;
      p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).project(camera);
      if(p.x>-.95&&p.x<.95&&p.y>-.75&&p.y<.75)inPicture++;
    }
    assert.ok(red>0&&inPicture/red>.95,`${w}px: balloon body is framed visibly`);
  }
  selected=null;view.update(.1,true);assert.equal(group.visible,false);
});

for (const partySize of [1,2]) test(`party leaves ${partySize} distinct, reachable balloon pickup(s)`, async t => {
  const { build } = await import('../public/world/backrooms/rooms/mandatory-fun.js');
  const kit=createKit(), generated=generate('party-balloons');
  const def={...generated.rooms[0],id:0,kind:'plain',rot:0,cx:0,cz:0,x:-8.1,z:-8.1,w:16.2,d:16.2,W:16,D:16,y:0,H:4,shape:null,panels:[],wins:[],doors:[]};
  const level={...generated,rooms:[def],links:[],windows:[],start:{room:0,x:0,z:6}};
  const world=await buildWorld(kit,level,{catalogue:{has:()=>false,geo:()=>null},level,partySize,builders:{plain(c){build({...c,params:{greeterSide:1,occasion:'A PARTY'}});}}});
  t.after(()=>{world.dispose();kit.dispose();});
  assert.equal(typeof world.rooms[0].partyState,'function','room completed building');
  const balloons=world.rooms[0].left.filter(i=>i.type==='balloon');assert.equal(balloons.length,partySize);
  assert.equal(new Set(balloons.map(i=>`${i.x},${i.z}`)).size,partySize);
  for(const i of balloons){const p=toWorld(def,i.x,i.z);assert.ok(world.free(p.x,p.z,.22));assert.ok(i.z>5.7,'in entrance area');}
});

for (const rot of [0,1,2,3]) test(`party dressing keeps a small room's doors and dance floor open, rotation ${rot}`, async t => {
  const { build } = await import('../public/world/backrooms/rooms/mandatory-fun.js');
  const { wallPoint } = await import('../public/world/backrooms/frame.js');
  const kit=createKit(), generated=generate('party-clearance');
  const def={...generated.rooms[0],id:0,kind:'plain',rot,cx:0,cz:0,x:-4.6,z:-4.6,w:9.2,d:9.2,W:9,D:9,y:0,H:2.6,shape:null,panels:[],wins:[],
    doors:['front','left','right'].map(side=>({side,c:0,w:1.3,h:2.05,sill:0,to:0}))};
  const level={...generated,rooms:[def],links:[],windows:[],start:{room:0,x:0,z:3}};
  const world=await buildWorld(kit,level,{catalogue:{has:()=>false,geo:()=>null},level,partySize:2,
    builders:{plain(c){build({...c,params:{greeterSide:rot%2?1:-1}});}}});
  t.after(()=>{world.dispose();kit.dispose();});
  const rt=world.rooms[0], scenery=rt.partyDressing;
  assert.ok(scenery.some(p=>p.kind==='buffet'),'small rooms still get the centerpiece');
  assert.ok(scenery.filter(p=>p.kind.startsWith('supplies:')).length>=2,'supply heaps fit around the edges');
  for(const {foot} of scenery) {
    assert.ok(foot.x0>=-4.5 && foot.x1<=4.5 && foot.z0>=-4.5 && foot.z1<=4.5,'props stay inside the walls');
    assert.ok(foot.top<def.H,'voxel decorations fit below the ceiling');
  }
  assert.ok(!rt.flat && rt.colliders.every(c=>c.on!==false),'no reachability repair has made furniture intangible');
  const walk=world.walkable(rt), reachable=walk.flood([def.doors[0]]);
  for(const dr of def.doors) assert.ok(reachable[walk.key(wallPoint(def,dr.side,dr.c,.5))],'every doorway remains reachable');
  for(let x=-1.6;x<=1.6;x+=.4)for(let z=-1.6;z<=1.6;z+=.4)assert.ok(walk.free(x,z),'middle of the floor stays open for the horde');
});

test('showing the balloon never teleports the committee, and the new circle stays put', async t => {
  const { build } = await import('../public/world/backrooms/rooms/mandatory-fun.js');
  const { PARTY } = await import('../public/world/backrooms/rooms/mandatory-fun/rule.js');
  const kit = createKit(), generated = generate('party-continuity');
  const def = { ...generated.rooms[0], id:0, kind:'plain', rot:0, cx:0, cz:0, x:-8.1, z:-8.1, w:16.2, d:16.2, W:16, D:16, y:0, H:4, shape:null, panels:[], wins:[], doors:[] };
  const level = { ...generated, rooms:[def], links:[], windows:[], start:{room:0,x:0,z:6} };
  let held = null;
  const world = await buildWorld(kit, level, { catalogue:{has:()=>false,geo:()=>null}, level,
    inventory:{held:()=>held}, health:{damage:()=>({ok:false})}, play(){}, interfere(){}, sees:()=>false,
    builders:{plain(c){build({...c,params:{greeterSide:1,occasion:'A PARTY'}});}} });
  t.after(()=>{world.dispose();kit.dispose();});
  const rt=world.rooms[0], me={id:'a',x:0,z:5,inside:true}, dt=1/60;
  let time=0, previous=rt.partyState().members;
  const step = frames => {
    for(let i=0;i<frames;i++) {
      for(const tick of rt.ticks)tick(dt,time+=dt,me);
      const next=rt.partyState().members;
      next.forEach((m,i)=>assert.ok(Math.hypot(m.x-previous[i].x,m.z-previous[i].z)<=PARTY.swarmSpeed*dt+1e-6,'rendered body moves at walking speed, even at state changes'));
      previous=next;
    }
  };
  step(150); assert.equal(rt.partyState().mode,'swarming');
  held={type:'balloon'}; step(1); assert.equal(rt.partyState().mode,'gathering');
  step(340); assert.equal(rt.partyState().mode,'released');
  const circle=rt.partyState().members;step(120);assert.deepEqual(rt.partyState().members,circle,'no return to spawn while holder is here');
  held=null;step(80);assert.equal(rt.partyState().mode,'swarming');
  held={type:'balloon'};step(340);assert.equal(rt.partyState().mode,'released','can settle into another circle');
  me.id='b';me.x=2.5;step(1);assert.equal(rt.partyState().mode,'gathering','a second visitor is welcomed without resetting positions');
  me.inside=false;step(120);assert.equal(rt.partyState().mode,'idle','walk back only once visitor leaves');
});

test('the real committee deals contact damage, respects shared grace, and stops hitting a balloon holder', async t => {
  const { build } = await import('../public/world/backrooms/rooms/mandatory-fun.js');
  const { createSurvival } = await import('../public/world/backrooms/survival.js');
  const kit=createKit(), generated=generate('party-damage');
  const def={...generated.rooms[0],id:0,kind:'plain',rot:0,cx:0,cz:0,x:-8.1,z:-8.1,w:16.2,d:16.2,W:16,D:16,y:0,H:4,shape:null,panels:[],wins:[],doors:[]};
  const level={...generated,rooms:[def],links:[],windows:[],start:{room:0,x:0,z:5}};
  let held=null, time=0; const hits=[], endings=[];
  const env={catalogue:{has:()=>false,geo:()=>null},level,inventory:{held:()=>held},play(){},interfere(){},sees:()=>false,
    sound:{play(){}},hud:{glitch(){},battery(){}},red:k=>hits.push({time,k}),
    builders:{plain(c){build({...c,params:{greeterSide:1,occasion:'A PARTY'}});}}};
  const survival=createSurvival(env,{canAct:()=>true,onEnd:why=>endings.push(why),difficulty:()=> 'easy'});
  env.health=survival.health;
  const world=await buildWorld(kit,level,env);t.after(()=>{world.dispose();kit.dispose();survival.dispose();});
  const rt=world.rooms[0], me={id:'local',x:0,z:5,inside:true}, dt=1/60;
  const step=()=>{time+=dt;survival.update(dt,true);for(const tick of rt.ticks)tick(dt,time,me);};
  for(let i=0;i<360&&!hits.length;i++)step();
  assert.equal(survival.health.read().current,3,'the pursuing NPCs remove a heart without a debug button');
  assert.equal(hits.length,1);assert.ok(hits[0].time<6);
  // Other creatures share this same visit-owned health gate, not one gate per attacker.
  for(let i=0;i<5;i++)assert.equal(env.health.damage(1).reason,'invulnerable');
  for(let i=0;i<60;i++)step();
  assert.equal(survival.health.read().current,3,'a surrounding horde cannot stack hits inside the grace window');
  held={type:'balloon'};for(let i=0;i<450;i++)step();
  assert.equal(survival.health.read().current,3,'holding the balloon prevents contact damage throughout the dance and release');
  held=null;for(let i=0;i<300&&hits.length<2;i++)step();
  assert.equal(survival.health.read().current,2,'putting it away makes the next approach dangerous again');
  assert.equal(hits.length,2);assert.ok(hits[1].time-hits[0].time>=1.25);
  assert.deepEqual(endings,[]);
});

for(const variant of ['greeter','circle'])test(`committee ${variant} reaches forward to grab and chomps only during pursuit`,async t=>{
  const {buildCommitteeMember}=await import('../public/world/backrooms/rooms/mandatory-fun/rig.js');
  const kit=createKit(),rig=buildCommitteeMember(kit,variant,0);t.after(()=>kit.dispose());
  rig.aimHead(0,0,'partying');const relaxed=rig.arms.map(a=>a.rotation.clone()),closed=rig.jaw.position.y;
  rig.aimHead(0,.1,'swarming');
  for(const arm of rig.arms){
    const hand=new THREE.Vector3(0,-.45,0).applyEuler(arm.rotation);
    assert.ok(hand.z>.4,'hands reach ahead of shoulders');assert.ok(Math.abs(hand.x)<.1,'not a sideways T-pose');
  }
  const positions=[];for(let i=0;i<20;i++){rig.aimHead(0,i*.05,'swarming');positions.push(rig.jaw.position.y);}
  assert.ok(Math.max(...positions)-Math.min(...positions)>.04,'lower jaw opens and shuts');
  rig.aimHead(0,1,'partying');assert.equal(rig.jaw.position.y,closed);
  rig.arms.forEach((a,i)=>assert.deepEqual(a.rotation.toArray(),relaxed[i].toArray()));
});
