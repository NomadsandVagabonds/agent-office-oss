import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { generate } from '../public/world/backrooms/gen.js';
import { floorOf, planVisit } from '../public/world/backrooms/plan.js';
import { toLocal,toWorld } from '../public/world/backrooms/frame.js';
import { mazePlan,MAZE,TOWER } from '../public/world/backrooms/rooms/dive-tower/plan.js';

test('the deck places both halves of the encounter, with a direct link and a separate onward door',()=>{
  for(let seed=0; seed<40; seed++){
    const include=[{only:MAZE},{only:TOWER},{only:[MAZE,TOWER]},{hand:[MAZE],rooms:22}][seed%4];
    const level=generate(seed,{theme:'waterpark',...include});
    const maze=level.rooms.filter(r=>r.arch===MAZE),tower=level.rooms.filter(r=>r.arch===TOWER);
    assert.equal(maze.length,1);
    assert.equal(tower.length,1);
    const out=maze[0].doors.find(d=>d.side==='back');
    const entry=tower[0].doors.find(d=>d.side==='front');
    assert.equal(out.link,entry.link);
    assert.equal(out.to,tower[0].id);
    assert.equal(entry.to,maze[0].id);
    assert.equal(out.sill+entry.sill,0);
    assert.equal(entry.c,0);
    assert.ok(tower[0].doors.some(d=>d.side==='back'&&d.to!==maze[0].id));
  }
  for(let seed=0; seed<10; seed++){
    const visit=planVisit(seed,{themes:['waterpark','waterpark'],depths:2});
    let towers=0;
    for(let i=0;i<2;i++){
      const level=floorOf(visit,i);
      assert.equal(level.picked.includes(MAZE),level.picked.includes(TOWER));
      towers+=Number(level.picked.includes(TOWER));
    }
    assert.ok(towers<=1);
  }
});

const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){
 if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};
 if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
 return next(s,c);
}`)}`,import.meta.url);

async function diveFixture(t){
  const draw=new Proxy({},{get:(_,k)=>k==='measureText'?s=>({width:String(s).length*6})
    : /Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
  const old=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>draw})};
  t.after(()=>{globalThis.document=old;});
  const [{createKit},{buildWorld,loadCatalogue},{createPlayer},THREE,{BUILDERS},mazeBuilder,towerBuilder,{buildSmilingClimber}]=await Promise.all([
    import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),
    import('../public/world/backrooms/player.js'),import('../public/vendor/three.module.min.js'),
    import('../public/world/backrooms/rooms.js'),import('../public/world/backrooms/rooms/smiler-maze.js'),
    import('../public/world/backrooms/rooms/dive-tower.js'),
    import('../public/world/backrooms/rooms/cubicle-grid/rig.js'),
  ]);
  const level=generate('diving-traverse',{theme:'waterpark',hand:[MAZE],only:[TOWER],rooms:23,pursuer:false});
  const maze=level.rooms.find(r=>r.arch===MAZE),tower=level.rooms.find(r=>r.arch===TOWER);
  const kit=createKit(),sounds=[],hurt=[],met=[],escaped=[];
  const env={kit,level,catalogue:await loadCatalogue(kit),hatches:new Map(),coopStrict:true,
    builders:{...BUILDERS,[MAZE]:mazeBuilder.build,[TOWER]:towerBuilder.build},
    play(name){sounds.push(name);},interfere(){},health:{damage(n){hurt.push(n);return {ok:true};}},
    run:{met(name){met.push(name);},survived(name){escaped.push(name);}}};
  const world=await buildWorld(kit,level,env);
  t.after(()=>{world.dispose();kit.dispose();});
  const input={keys:new Set(),dx:0,dy:0,stick:{x:0,y:0}};
  const camera=new THREE.PerspectiveCamera();
  const player=env.player=createPlayer(world,camera,{...toWorld(maze,0,maze.D/2-.75),yaw:maze.rot*Math.PI/2},input);
  const chase=world.rooms[maze.id].smilerChase,towerRuntime=world.rooms[tower.id];
  let time=0;
  function tick(current=player){
    current.update(1/60);
    current.me.slow=1;
    world.update(1/60,time+=1/60,current.me);
  }
  function walk(room,x,z){
    const goal=toWorld(room,x,z);
    const distance=()=>Math.hypot(goal.x-player.me.x,goal.z-player.me.z);
    input.keys.add('w');
    for(let i=0;i<1200&&distance()>.09;i++){
      player.me.yaw=Math.atan2(player.me.x-goal.x,player.me.z-goal.z);tick();
    }
    input.keys.clear();player.me.vx=0;player.me.vz=0;
    assert.ok(distance()<.12,`walk to ${room.arch??room.kind} ${x},${z}, at ${JSON.stringify(toLocal(room,player.me.x,player.me.z))}`);
  }
  return {world,env,level,maze,tower,kit,sounds,hurt,met,escaped,THREE,createPlayer,buildSmilingClimber,
    player,input,camera,chase,towerRuntime,tick,walk};
}

test('a player can run the maze, chain the hops, plunge once and walk out while the same horde stops above the pool',async t=>{
  const {world,env,level,maze,tower,kit,sounds,hurt,met,escaped,THREE,createPlayer,buildSmilingClimber,
    player,input,camera,chase,towerRuntime,tick,walk}=await diveFixture(t);
  const swim=chase.pack[0].rig, office=buildSmilingClimber(kit,0);
  assert.deepEqual(swim.head.children[0].geometry.attributes.aAlb.array,
    office.head.children[0].geometry.attributes.aAlb.array,'the same Smiling Office Worker face');
  assert.notDeepEqual(swim.bodyGroup.children[0].geometry.attributes.aAlb.array,
    office.bodyGroup.children[0].geometry.attributes.aAlb.array,'the costumes use separate geometry');
  assert.equal(towerRuntime.diving.chase,chase);
  assert.equal(towerRuntime.flat,false,'the authored stairs pass the ordinary doorway reachability proof');
  for(const [x,z] of mazePlan(maze).route.slice(0,-1))walk(maze,x,z);
  assert.ok(chase.started);
  walk(tower,0,tower.D/2-.75);

  const {plan,getRide}=towerRuntime.diving;
  assert.ok(plan.platforms.at(-1).y-plan.water>=12,'the high dive is at least twelve metres above water');
  assert.ok(plan.water-plan.bottom>2.8,'the catching basin is deep enough to dive into');
  for(const [i,hop] of plan.flights.entries()){
    const offset=i===0?1.36:0; // a clearly off-centre approach to the first lip
    if(i===0)walk(tower,offset,hop.from.nose+.75);
    player.me.yaw=tower.rot*Math.PI/2;
    input.keys.add('w');
    for(let n=0;n<230&&!getRide(player.me);n++)tick();
    input.keys.clear();
    assert.equal(getRide(player.me)?.hop,hop,'walking over the marked lip begins the expected jump');
    let lowest=Infinity;
    for(let n=0;n<180&&getRide(player.me);n++){tick();lowest=Math.min(lowest,camera.position.y-tower.y);}
    assert.equal(getRide(player.me),undefined);
    const at=toLocal(tower,player.me.x,player.me.z);
    assert.ok(Math.hypot(at.x-hop.x,at.z-hop.z)<1e-7,'landing is centred on the board or pool');
    if(hop.plunge){
      assert.ok(lowest<plan.water-.8,'the dive goes well below the waterline');
      assert.ok(camera.position.y-tower.y>plan.water,'the swimmer returns above water');
    }
  }
  assert.deepEqual(met,['towel-return']);
  assert.deepEqual(escaped,['towel-return']);
  assert.equal(sounds.filter(s=>s==='towerSplash').length,1);
  assert.equal(hurt.length,0,'a steady walk and the marked jumps are enough to escape');

  for(let n=0;n<1400;n++)tick();
  const reached=chase.pack.filter(a=>world.roomAt(a.group.position.x,a.group.position.z)?.id===tower.id);
  assert.equal(reached.length,chase.pack.length,'the same pack comes through the real doorway');
  const last=plan.platforms.at(-1);
  for(const a of reached){
    assert.ok(Math.abs(a.group.position.y-(tower.y+last.y))<.02);
    assert.ok(toLocal(tower,a.group.position.x,a.group.position.z).z>=last.nose);
  }
  walk(tower,0,-4.48);
  walk(tower,0,-8.45);
  walk(tower,-8.17,-8.45);
  walk(tower,-8.17,-11.45);
  walk(tower,0,-11.45);
  walk(tower,0,-tower.D/2+.38);
  const onward=level.rooms[tower.doors.find(d=>d.side==='back').to];
  const entry=onward.doors.find(d=>d.to===tower.id);
  const mouth=tower.doors.find(d=>d.side==='back');
  assert.equal(entry.link,mouth.link);
  walk(tower,0,-tower.D/2-.55);
  assert.equal(world.roomAt(player.me.x,player.me.z).id,onward.id);

  // A second visitor caught at the last ledge takes a hit from the actual
  // pack. Nearby Smilers share the same per-visitor attack window.
  const waiting=env.player=createPlayer(world,new THREE.PerspectiveCamera(),
    {...toWorld(tower,last.x,last.nose+.42),yaw:tower.rot*Math.PI/2},
    {keys:new Set(),dx:0,dy:0,stick:{x:0,y:0}});
  for(let n=0;n<35;n++)tick(waiting);
  assert.deepEqual(hurt,[1]);
});

test('the pack closes on a stopped visitor and turns back when they retreat off the route',async t=>{
  const {world,maze,player,chase,hurt,walk,tick}=await diveFixture(t);
  walk(maze,4.60,5.41);
  walk(maze,4.60,4.42);
  for(let i=0;i<72;i++)tick();
  const leader=chase.pack[1];
  const before=toLocal(maze,leader.x,leader.z);
  assert.ok(leader.group.visible && before.x>1,'the leader has entered the bay');

  walk(maze,4.56,6.74);
  for(let i=0;i<180;i++)tick();
  const after=toLocal(maze,leader.x,leader.z);
  assert.ok(after.z>before.z+.5,'the same leader reverses toward the retreating visitor');
  assert.ok(hurt.length>0,'standing still within reach gets the visitor hit');
  const toVisitor=Math.atan2(player.me.x-leader.x,player.me.z-leader.z);
  assert.ok(Math.cos(toVisitor-leader.group.rotation.y)>.7,'the leader faces the visitor, including off the authored route');
  assert.ok(chase.pack.every(actor=>world.free(actor.x,actor.z,actor.r,{ghost:true})),
    'the pack stays clear of the maze walls and furniture');
});
