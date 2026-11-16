import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`,import.meta.url);
const [{createKit},{buildWorld,loadCatalogue},{generate},{DECK},{toWorld,wallPoint},{createPlayer},THREE,{createDenizens}]=await Promise.all([
 import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),import('../public/world/backrooms/gen.js'),import('../public/world/backrooms/gen.js'),import('../public/world/backrooms/frame.js'),import('../public/world/backrooms/player.js'),import('../public/vendor/three.module.min.js'),import('../public/world/backrooms/denizens.js')]);
const draw=new Proxy({}, {get:(_,k)=>k==='measureText'?s=>({width:String(s).length*6}):/Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
const oldDocument=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>draw})};test.after(()=>{globalThis.document=oldDocument;});
const ids=['hanging-changing','bellmouth-baths','slide-maze','return-pool','wave-pool','lazy-river','deep-end','whirlpool-flume','kiddie-lagoon','locker-showers'];
async function fixture(id,rot=0,generated=false){
 const {build}=await import(`../public/world/backrooms/rooms/${id}.js`),defn=DECK.find(a=>a.id===id), kit=createKit(),g=generate('waterpark-integration',{themes:['waterpark']});
 const W=defn.w[rot%2],D=defn.d[rot%2],H=defn.h[rot%2];
 let def={...g.rooms[0],id:0,kind:'special',arch:id,rot,cx:0,cz:0,x:-(rot%2?D:W)/2-.1,z:-(rot%2?W:D)/2-.1,w:(rot%2?D:W)+.2,d:(rot%2?W:D)+.2,W,D,H,y:1.7,shape:null,panels:[],wins:[],params:{},
  doors:['front',...defn.ports].map(side=>({side,c:0,w:1.4,h:2.05,sill:0,to:0}))};
 let level={...g,theme:'waterpark',rooms:[def],links:[],windows:[],start:{room:0,x:0,z:0},exit:{...g.exit,way:'wall'}};
 const builders={...(await import('../public/world/backrooms/rooms.js')).BUILDERS,[id]:build};
 if(generated){
  level=generate('17',{theme:'waterpark',only:[id]});def=level.rooms.find(r=>r.arch===id);assert.ok(def);
  for(const r of level.rooms){const a=DECK.find(a=>a.id===r.arch);if(a?.module&&!builders[r.arch])builders[r.arch]=(await import(new URL(a.module,new URL('../public/world/backrooms/',import.meta.url)))).build;}
 }
 const hits=[],env={kit,catalogue:await loadCatalogue(kit),level,hatches:new Map(),barricadesEnabled:true,hold(on){if(this.player)this.player.me.frozen=on;},play(){},interfere(){},sees:()=>true,hear:()=>({vol:1,pan:0}),health:{damage:n=>{hits.push(n);return {ok:true,dead:false};}},camera:{drain:()=>({ok:true})},hud:{flag(){},glitch(){}},run:{met(){},survived(){}},builders};
 createDenizens(env);const warnings=[],warn=console.warn;console.warn=(...a)=>warnings.push(a.map(v=>v?.stack || v).join(' '));let world;
 try {world=await buildWorld(kit,level,env);}finally{console.warn=warn;}
 env.world=world;const start=toWorld(def,0,def.D/2-1);const camera=new THREE.PerspectiveCamera(),input={keys:new Set(),dx:0,dy:0,stick:{x:0,y:0}},player=createPlayer(world,camera,{...start,yaw:def.rot*Math.PI/2},input);env.player=player;world.enter(world.rooms.find(r=>r.id===def.id));
 let time=0; const tick=(n=1)=>{for(let i=0;i<n;i++){player.update(1/60);player.me.slow=1;player.me.sinkTo=0;time+=1/60;world.update(1/60,time,player.me);env.denizens.update(1/60,time);}};
 return {world,kit,env,player,input,def,hits,tick,warnings,dispose(){env.denizens.dispose?.();world.dispose();kit.dispose();}};
}
for(const id of ids)for(const rot of [0,1])test(`${id}: actual builder, runtime and doorways (${rot})`,async t=>{
 const f=await fixture(id,rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);
 const rt=f.world.rooms[0];assert.ok(!rt.flat);
 // A room can be navigable with broken render attributes (e.g. a CSS string
 // passed where linear RGB is expected). Catch that independently of nav.
 rt.group.traverse(node=>{
  for(const [name,attr] of Object.entries(node.geometry?.attributes || {}))
   assert.ok(attr.array.every(Number.isFinite),`${id}: finite ${name}`);
 });
 const {ITEMS}=await import('../public/world/backrooms/cast.js');for(const item of rt.left || [])assert.ok(ITEMS.includes(item.type),`supported supply: ${item.type}`);assert.ok(rt.ticks.length>0);
 const nav=f.world.walkable(rt),seen=nav.flood([f.def.doors[0]]);
 for(const dr of f.def.doors)assert.ok(seen[nav.key(wallPoint(f.def,dr.side,dr.c,.5))],`${dr.side} reachable`);
 f.tick(90);assert.ok(Number.isFinite(f.player.me.y));
 if(rt.basin){const b=rt.basin.bounds,at=toWorld(f.def,(b.x0+b.x1)/2,b.z1-.5);f.player.warp(at.x,at.z);f.tick(90);f.input.keys.add('c');f.tick(90);f.input.keys.clear();f.tick(90);assert.ok(Number.isFinite(f.player.me.y));}
});

async function walkTo(f,x,z){
 const p=toWorld(f.def,x,z);f.input.keys.add('w');
 for(let i=0;i<1000&&Math.hypot(f.player.me.x-p.x,f.player.me.z-p.z)>.12;i++){
  f.player.me.yaw=Math.atan2(p.x-f.player.me.x,p.z-f.player.me.z)+Math.PI;f.tick();
 }
 f.input.keys.clear();f.player.me.vx=0;f.player.me.vz=0;
 assert.ok(Math.hypot(f.player.me.x-p.x,f.player.me.z-p.z)<.16,`reached ${x},${z}; at ${JSON.stringify(f.player.me)}`);
}
for(const rot of [0,1,2,3])test(`Hanging Changing: dry loop, wet shortcuts and real crouching (${rot})`,async t=>{
 const f=await fixture('hanging-changing',rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);
 const rt=f.world.rooms[0],p=rt.changing.plan;
 // From either bank, a ray from the lower tread must hit the visible riser.
 // Finite vertices alone did not catch inward faces that looked like holes.
 f.world.scene.updateMatrixWorld(true);
 for(const side of [-1,1]) {
  const z=p.slabs[0].z+side*1.5,at=toWorld(f.def,-2,z),out=toWorld(f.def,-2,z+side);
  const ray=new THREE.Raycaster(new THREE.Vector3(at.x,f.def.y-.08,at.z),new THREE.Vector3(out.x-at.x,0,out.z-at.z).normalize(),.001,.3);
  assert.ok(ray.intersectObject(rt.group,true).length,'channel riser faces its lower tread');
 }
 // The long route is walkable without a jump, crouch key, item or encounter.
 for(const [x,z] of [[0,10],[8,10],[8,5],[-8,5],[-8,-2],[8,-2],[8,-10],[0,-10],[0,-12]]) {
  await walkTo(f,x,z);assert.ok(f.player.me.duck<.05,'dry route remains standing height');
 }
 // Retrace the first bay by its other route: these are actual loops, not a
 // one-way teleport. All three short passages lower and then release the head.
 const a=toWorld(f.def,-2,9);f.player.warp(a.x,a.z);f.tick(30);
 for(const [i,approach] of [[[ -2,9 ]],[[ -2,2.2 ],[2,2.2]],[[2,-2],[-5,-2],[-5,-5],[-3,-5]]].entries()) {
  for(const [x,z] of approach)await walkTo(f,x,z);
  const s=p.slabs[i];await walkTo(f,s.slot,s.z);f.tick(45);
  assert.ok(f.player.me.duck>.4&&f.player.me.sink>.4,`automatically crouches under visible lid: ${JSON.stringify(f.player.me)}; head=${f.world.headroom(f.player.me.x,f.player.me.z)}`);
  assert.ok(f.player.me.y-f.def.y<.85,'camera clears the underside');
  assert.ok(Math.abs(f.world.floorY(f.player.me.x,f.player.me.z)-(f.def.y-.48))<.001);
  const height=f.world.floorY(f.player.me.x,f.player.me.z);
  const remote=toWorld(f.def,8,10);f.world.floorY(remote.x,remote.z);
  assert.equal(f.world.floorY(f.player.me.x,f.player.me.z),height,'another player querying dry ground cannot change this floor');
  await walkTo(f,s.slot,s.z-2.1);f.tick(60);
  assert.ok(f.player.me.duck<.05&&f.player.me.sink<.05,'stands up after the low passage');
  assert.ok(Math.abs(f.world.floorY(f.player.me.x,f.player.me.z)-f.def.y)<.001,'climbs out using the visible shallow steps');
  const blocked=toWorld(f.def,s.slot+2,s.z);
  assert.equal(f.world.free(blocked.x,blocked.z,.22),false,'narrow slots are solid');
  const liftedX=s.liftSide>0?s.x1-1.2:s.x0+1.2;
  const lifted=toWorld(f.def,liftedX,s.z);
  assert.ok(f.world.free(lifted.x,lifted.z,.22)&&f.world.headroom(lifted.x,lifted.z)>2,'raised slab ends are real standing-height routes');
 }
 // Complete a loop around the first repeated bench island from both sides.
 const loop=toWorld(f.def,-1,5);f.player.warp(loop.x,loop.z);f.tick(20);
 for(const q of [[5,5],[5,2.4],[-1,2.4],[-1,5]])await walkTo(f,...q);
 assert.ok(!rt.flat);assert.equal(f.hits.length,0,'quiet connector has no concealed damage');
});
test('Hanging Changing: towel cart carries and releases through the standard grip',async t=>{
 const f=await fixture('hanging-changing');t.after(()=>f.dispose());
 const [{createFurnitureMotion},{createFurnitureGrip}]=await Promise.all([import('../public/world/backrooms/furniture-motion.js'),import('../public/world/backrooms/furniture-grip.js')]);
 const cart=f.world.rooms[0].changing.cart,motion=createFurnitureMotion(f.world),grip=createFurnitureGrip(f.world,motion);
 assert.equal(cart.type,'trolley');assert.ok(f.world.furniture.includes(cart));
 const pos=toWorld(f.def,8.2,12.2);f.player.warp(pos.x,pos.z,0);f.player.me.pitch=-.42;f.tick(1);
 f.player.on('move',(dx,dz,step)=>grip.step(dx,dz,step));grip.update(0,f.player.me);
 assert.equal(grip.target,cart);assert.ok(grip.use());assert.equal(cart.collider.on,false);
 const before=f.player.me.z;f.input.keys.add('w');
 for(let i=0;i<60;i++){grip.update(1/60,f.player.me);f.tick();}
 f.input.keys.clear();assert.ok(before-f.player.me.z>.7&&before-f.player.me.z<1);
 assert.ok(Math.hypot(cart.x-f.player.me.x,cart.z-f.player.me.z)<1.8);
 assert.ok(grip.use());assert.equal(cart.collider.on,true);
 assert.equal(f.world.free(cart.x,cart.z,.22),false,'released cart becomes a barricade');
});
for(const rot of [0,1,2,3])test(`Bellmouth: both gallery directions, buttress and basin recovery (${rot})`,async t=>{
 const f=await fixture('bellmouth-baths',rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);
 const rt=f.world.rooms[0],p=rt.bellmouth.plan;
 await walkTo(f,0,p.rz*.9);
 for(let i=1;i<=24;i++){const a=i*Math.PI/24;await walkTo(f,Math.sin(a)*p.rx*.9,Math.cos(a)*p.rz*.9);}
 assert.ok(!rt.flat,'navigation never flattens the bowl');
 await walkTo(f,0,-p.rz*.38);f.tick(30);
 assert.ok(f.player.me.y-f.def.y<-.9,'the camera is physically down in the basin');
 await walkTo(f,0,p.rz*.38);await walkTo(f,0,p.rz*.9);
 assert.ok(f.player.me.y-f.def.y>1,'near stairs recover to entry elevation');
 for(let i=1;i<=24;i++){const a=-i*Math.PI/24;await walkTo(f,Math.sin(a)*p.rx*.9,Math.cos(a)*p.rz*.9);}
 await walkTo(f,0,-p.rz*.38);await walkTo(f,0,-p.rz*.9);
 assert.ok(f.player.me.y-f.def.y>1,'far stairs also recover');
 await walkTo(f,0,-f.def.D/2+.6);
 assert.ok(f.world.free(f.player.me.x,f.player.me.z,.22));
});
for(const rot of [0,1,2,3])test(`Flume Knot: walk both mouths, ride down, walk the sump and escape (${rot})`,async t=>{
 const f=await fixture('slide-maze',rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);
 for(const d of f.env.denizens.all())d.gone=true; // isolate route geometry; attacks have their own rules tests
 const rt=f.world.rooms[0],b=rt.flumeMaze.bounds;
 await walkTo(f,-3,b.bz1+1.8);await walkTo(f,-3,1.25);
 assert.ok(f.player.me.duck>.2,'tube entrance automatically ducks');
 assert.equal(rt.basin.swimmer.inWater,false,'walking in a tube is not swimming in the basin underneath');
 for(const [x,z] of [[-3,-1.35],[0,-1.35],[0,-3.95],[3,-3.95],[3,b.bz0-1.5]])await walkTo(f,x,z);
 assert.ok(Math.abs(f.world.floorY(f.player.me.x,f.player.me.z)-f.def.y)<.02,'walked down the far steps');
 const start=toWorld(f.def,4.65,b.bz1+2.6);f.player.warp(start.x,start.z);f.tick(15);
 await walkTo(f,4.65,b.bz1+.4);
 const plunge=rt.uses.find(u=>u.label.includes('plunge'));assert.ok(plunge.when());plunge.use();
 for(let i=0;i<1000&&rt.sliding();i++)f.tick();
 assert.equal(rt.sliding(),false,'ride completes');assert.equal(rt.flumeMaze.lower,true,'lands in lower hall');f.tick(45);
 assert.ok(f.player.me.y-f.def.y<0,'camera really is below the upper gallery');
 const floor=f.world.floorY(f.player.me.x,f.player.me.z);f.world.floorY(...Object.values(toWorld(f.def,0,f.def.D/2-1)));assert.equal(f.world.floorY(f.player.me.x,f.player.me.z),floor,'remote floor queries cannot switch the player layer');
 await walkTo(f,-.85,b.bz0+.65);
 const hatch=rt.uses.find(u=>u.label.includes('sump discharge'));assert.ok(hatch.when());hatch.use();f.tick(30);
 assert.equal(rt.flumeMaze.lower,false);assert.ok(f.player.me.y-f.def.y>.8,'sump hatch releases on dry gallery');
 assert.ok(f.world.free(f.player.me.x,f.player.me.z,.22));
});

test('Diving well: dive under the partition, surface and reach the far deck',async t=>{
 const f=await fixture('deep-end');t.after(()=>f.dispose());const rt=f.world.rooms[0];
 const b=rt.basin.bounds;
 await walkTo(f,0,b.z1+.3);await walkTo(f,0,1.1);f.tick(90);
 assert.ok(f.player.me.y-f.def.y>-.1,'floats at surface');
 f.input.keys.add('c');f.tick(90);
 assert.ok(rt.basin.swimmer.submerged,'C submerges');
 assert.ok(f.player.me.y-f.def.y<-.78,'clears underside of drywall');
 await walkTo(f,1.1,-1.1);f.input.keys.delete('c');f.input.keys.add(' ');f.tick(120);f.input.keys.clear();
 assert.equal(rt.basin.swimmer.submerged,false,'Space surfaces');
 await walkTo(f,0,b.z0-.45);f.tick(60);
 assert.ok(f.player.me.y-f.def.y>.9,'climbs out onto far deck');
});

test('Drain Spa: a last-floor drain is not offered; an interrupted ride releases controls',async t=>{
 const f=await fixture('whirlpool-flume');t.after(()=>f.dispose());const rt=f.world.rooms[0];
 const drain=rt.uses.find(u=>u.label==='enter the drain');
 assert.equal(drain.when(),false,'no fake way down on final floor');
 f.env.level.exit.way='chute';f.env.descend=()=>true;
 assert.ok(drain.when());drain.use();f.tick(20);
 assert.ok(f.player.me.frozen);rt.onLeave();
 assert.equal(f.player.me.frozen,false);const y=f.player.me.y;
 f.input.keys.add('w');f.tick(30);f.input.keys.clear();
 assert.ok(Number.isFinite(f.player.me.y));assert.notEqual(f.player.me.y,y,'camera no longer owned by the drain');
});


test('Flume Knot: a generated floor keeps the rider in the room through boarding and landing',async t=>{
 const f=await fixture('slide-maze',0,true);t.after(()=>f.dispose());
 assert.deepEqual(f.warnings,[],'no generated room needed navigation repair');
 for(const d of f.env.denizens.all())d.gone=true;
 const rt=f.world.rooms.find(r=>r.id===f.def.id),b=rt.flumeMaze.bounds;
 const start=toWorld(f.def,4.65,b.bz1+2.6);f.player.warp(start.x,start.z);f.tick(15);
 await walkTo(f,4.65,b.bz1+.4);rt.uses.find(u=>u.label.includes('plunge')).use();
 for(let i=0;i<1000&&rt.sliding();i++){f.tick();assert.equal(f.world.current(),rt,'slide does not leave its generated room');}
 assert.equal(rt.flumeMaze.lower,true);f.tick(45);
 assert.ok(f.player.me.y-f.def.y<0);await walkTo(f,-.85,b.bz0+.65);
 rt.uses.find(u=>u.label.includes('sump discharge')).use();f.tick(30);
 assert.equal(rt.flumeMaze.lower,false);assert.ok(f.player.me.y-f.def.y>.8);
});

for(const id of ids.filter(id=>id!=='slide-maze'))test(`${id}: builds in a complete generated waterpark floor`,async t=>{
 const f=await fixture(id,0,true);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);
 assert.ok(f.world.rooms.every(rt=>!rt.flat),'all generated rooms retain their authored geometry');f.tick(90);
 assert.equal(f.world.current()?.id,f.def.id);assert.ok(Number.isFinite(f.player.me.y));
});

test('Flume Knot: the abyss slide on the last floor returns to the dry gallery',async t=>{
 const f=await fixture('slide-maze');t.after(()=>f.dispose());for(const d of f.env.denizens.all())d.gone=true;
 const rt=f.world.rooms[0];rt.uses.find(u=>u.label.includes('plunge')).use();
 for(let i=0;i<1000&&rt.sliding();i++)f.tick();
 assert.ok(rt.flumeMaze.lower);const abyss=rt.uses.find(u=>u.label.includes('lower level'));assert.ok(abyss.when());abyss.use();
 for(let i=0;i<1000&&rt.sliding();i++)f.tick();f.tick(30);
 assert.equal(rt.sliding(),false);assert.equal(rt.flumeMaze.lower,false);assert.equal(f.player.me.frozen,false);
 assert.ok(f.player.me.y-f.def.y>.8);assert.ok(f.world.free(f.player.me.x,f.player.me.z,.22));
});
