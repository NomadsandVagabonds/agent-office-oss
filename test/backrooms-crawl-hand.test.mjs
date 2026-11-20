import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createHash } from 'node:crypto';
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

test('Carbon Camera stocks every prop and pickup, with four distinct prints for furniture and pocket items', async () => {
  const [{stockIds,readStock},{editionNames,developEdition},{drawPositive},{PROPS},{ICON_MODELS}] = await Promise.all([
    import('../public/world/dev/chair-copy/stock.js'), import('../public/world/dev/chair-copy/editions.js'),
    import('../public/world/dev/chair-copy/positive.js'), import('../public/world/props/index.js'), import('../public/world/backrooms/inventory-items.js'),
  ]);
  for (const id of [...Object.keys(PROPS), ...Object.keys(ICON_MODELS), 'coin', 'keycard', 'file-two', 'file-three', 'file-four', 'file-tall', 'file-lateral']) {
    assert.ok(stockIds.includes(id), id);
  }
  function photograph(stock) {
    let digest;
    drawPositive({
      createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}),
      putImageData: image => { digest=createHash('sha256').update(image.data).digest('hex'); },
    }, stock);
    return digest;
  }
  for (const id of ['desk','file-four','chair','scissors','battery','paper']) {
    const stock=readStock(id);
    assert.equal(new Set(editionNames(stock)).size,4);
    const prints=[stock, ...[0,1,2,3].map(index=>developEdition(stock,index))];
    assert.equal(new Set(prints.map(photograph)).size,5,id);
    assert.equal(photograph(stock),photograph(readStock(id)),'developing twins preserves the original '+id);
    if(id==='file-four')assert.ok(prints[2].bounds.y1>stock.bounds.y1,'extra compartment increases physical height');
  }
});

test('a Carbon Camera first print leaves every source triangle in place; only a consumed original dissolves', async () => {
  const {createTransfer}=await import('../public/world/dev/chair-copy/transfer.js');
  const {readStock}=await import('../public/world/dev/chair-copy/stock.js');
  const scene=new THREE.Scene(), geometry=new THREE.BoxGeometry(1,1,1), body=new THREE.Mesh(geometry);
  body.position.set(2,0,-1);
  scene.add(body);
  const stock=readStock('chair'), rig=createTransfer(scene,body,0,geometry,stock,stock);
  const source={x:2,y:0,z:-1,turn:0}, landing={x:3,y:0,z:1};
  rig.start(source,landing);
  for(const time of [0,.25,.40,.55,.75,1]){
    rig.at(time);
    assert.equal(body.visible,true);
    assert.equal(body.geometry,geometry);
    assert.equal(geometry.drawRange.count,Infinity);
  }
  rig.start(source,landing,0,true);
  const departing=scene.children.find(m=>m!==body&&m.visible&&m.geometry?.drawRange.count===geometry.index.count);
  assert.ok(departing);
  assert.deepEqual(departing.matrix.elements,body.matrixWorld.elements);
  rig.at(.2);
  assert.ok(departing.geometry.drawRange.count>0&&departing.geometry.drawRange.count<geometry.index.count);
  rig.at(.65);
  assert.equal(departing.geometry.drawRange.count,0);
  rig.stop();
  rig.start(source,landing);
  assert.equal(departing.visible,false);
  rig.dispose();
  assert.deepEqual(scene.children,[body]);
});

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

test('the Carbon Camera pickup has no film and the scanned print feeds toward the holder', async t => {
  const kit=createKit(), camera=new THREE.PerspectiveCamera(62,4/3,.06,170);
  const {buildItemProp}=await import('../public/world/backrooms/hand.js');
  const pickup=buildItemProp(kit,'carbon-camera');
  assert.equal(pickup.getObjectByName('carbon-camera-positive'),undefined);
  let shot=0;
  const env={kit, vhs:{picture:{w:1280,h:720}}, inventory:{held:()=>({type:'carbon-camera',id:'cc',charge:3})},
    carbonCopy:{exposure:id=>id==='cc'&&shot},player:{me:{x:0,z:0,speed:0}},world:{scene:new THREE.Group(),lightAt:()=>[.7,.7,.7]}};
  const view=createHandView(env,camera);
  t.after(()=>{view.dispose();kit.dispose();});
  view.update(.016,true);
  const film=env.world.scene.getObjectByName('carbon-camera-positive');
  const led=env.world.scene.getObjectByName('carbon-mode-led');
  assert.equal(led.userData.word,'COPY');
  assert.equal(film.visible,false);
  shot=1;view.update(.016,true);
  assert.equal(led.userData.word,'PASTE');
  assert.equal(film.visible,true);
  const start=film.position.z;
  view.update(.6,true);
  assert.ok(film.position.z>start+.045);
  env.carbonCopy.status='LOCK';view.update(.016,true);assert.equal(led.userData.word,'LOCK');
  env.carbonCopy.status='DONE';view.update(.016,true);assert.equal(led.userData.word,'DONE');
  shot=0;view.update(.016,true);
  assert.equal(film.visible,false);
});

test('the raised optical finder stays centred at both picture sizes, including while walking', t => {
  const kit=createKit(), camera=new THREE.PerspectiveCamera(62,4/3,.06,170);
  const mode={lift:0,exposure:()=>0,sighted:()=>{}};
  const env={kit,carbonCopy:mode,vhs:{picture:{w:1280,h:800}},inventory:{held:()=>({type:'carbon-camera',id:'cam',charge:4})},
    player:{me:{x:0,z:0,speed:2.5}},world:{scene:new THREE.Group(),lightAt:()=>[1,1,1]}};
  const view=createHandView(env,camera);t.after(()=>{view.dispose();kit.dispose();});
  for(const [w,h] of [[1280,800],[390,844]]){
    env.vhs.picture={w,h};camera.aspect=w/h;camera.updateProjectionMatrix();
    camera.position.set(2,1.1,-3);camera.rotation.set(-.3,.7,.015,'YXZ');camera.updateMatrixWorld();
    const centre=()=>env.world.scene.getObjectByName('carbon-wire-centre').getWorldPosition(new THREE.Vector3()).project(camera);
    mode.lift=0;view.update(.1,true);assert.ok(centre().x>.15);
    mode.lift=1;view.update(.1,true);const p=centre();
    assert.ok(Math.abs(p.x)<1e-6&&Math.abs(p.y)<1e-6);
  }
});

test('everything that can be held is drawn over the room, so that a wall close to the visitor never hides it', async t => {
  const { INVENTORY_MODELS } = await import('../public/world/backrooms/inventory-items.js');
  const kit=createKit(), camera=new THREE.PerspectiveCamera(62,16/9,.06,170); camera.updateProjectionMatrix();
  t.after(()=>kit.dispose());
  assert.ok(Object.keys(INVENTORY_MODELS).length>=8, 'there are things to hold');
  for (const kind of Object.keys(INVENTORY_MODELS)) {
    const env={kit, vhs:{picture:{w:1280,h:720}}, inventory:{held:()=>({type:kind,lit:false,charge:10})},player:{me:{x:0,z:0,speed:0}},world:{scene:new THREE.Group(),lightAt:()=>[.5,.5,.5]}};
    const view=createHandView(env,camera); view.update(.1,true);
    const group=env.world.scene.children[0], mesh=group.children[0];
    assert.ok(group.visible&&mesh.visible&&mesh.geometry.attributes.position.count>0, `${kind}: held in the hand`);
    assert.equal(mesh.renderOrder,10000,`${kind}: drawn last`); assert.equal(mesh.material.transparent,true,`${kind}: after the room`);
    const calls=[]; mesh.onBeforeRender({state:{buffers:{depth:{setMask:v=>calls.push(v)}}},clearDepth:()=>calls.push('clear')});
    assert.deepEqual(calls,[true,'clear'],`${kind}: the room's depth is discarded before it is drawn`);
    view.dispose();
  }
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
