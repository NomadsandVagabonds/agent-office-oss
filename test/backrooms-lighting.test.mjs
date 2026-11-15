import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { generate, toWorld } from '../public/world/backrooms/gen.js';
import { LIGHTING, planLighting, planFloorLighting, panelBank, bankLevels, bankWeights, localLightScale } from '../public/world/backrooms/lighting.js';

// Use the actual shader/bake/world code and the vendored Three, without WebGL.
const three = new URL('../public/vendor/three.module.min.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  return s === 'three' ? {url:${JSON.stringify(three)},shortCircuit:true} : next(s,c);
}`), import.meta.url);
const { lamp, bake, lightAt, createKit } = await import('../public/world/backrooms/kit.js');
const { buildWorld } = await import('../public/world/backrooms/world.js');
const fixture = { id: 1, kind: 'plain', W: 12, D: 6, light: { mode: 'normal' },
  panels: [-4, -2, 2, 4].map(x => ({ x, z: 0, state: 'on' })) };

test('a complete outage retains only a faint silhouette while working banks keep their original bounce',()=>{
  const plan=planLighting(fixture,7,'travel');
  const lights=fixture.panels.map(p=>({...p,bank:panelBank(plan,p)}));
  for(const x of [-4,0,4]) {
    assert.ok(Math.abs(localLightScale(plan,lights,[1,1,1,1],x,0)-1)<1e-12);
    const dark=localLightScale(plan,lights,[0,0,0,0].map(()=>LIGHTING.blackout),x,0);
    assert.ok(dark>0 && dark<.014,'no more than 1.4% of ambient light survives all banks failing');
  }
  assert.ok(LIGHTING.gainMax<=1.3,'camera exposure cannot restore night vision');
});

test('passing outages advance in order, recover, and have a long quiet interval', () => {
  const p = {...planLighting(fixture,7,'travel'),offset:0};
  assert.equal(p.bankCount,4);
  assert.deepEqual(bankLevels(p,1),[LIGHTING.blackout,1,1,1]);
  assert.deepEqual(bankLevels(p,2.5),[LIGHTING.blackout,LIGHTING.blackout,1,1]);
  assert.deepEqual(bankLevels(p,5),[LIGHTING.blackout,LIGHTING.blackout,LIGHTING.blackout,LIGHTING.blackout]);
  assert.deepEqual(bankLevels(p,20),[1,1,1,1]);
  assert.ok(p.period>=64);
  near(bankLevels(p,7.5+p.period),bankLevels(p,7.5));
  assert.deepEqual(bankLevels(p,5,1,true),[.6,.6,.6,.6]);
  assert.deepEqual(bankLevels(p,5,.02),[1,1,1,1]);
  // Mirroring the assignment changes the travel direction, without changing
  // the order of dimming in the baked bank uniforms.
  for(const panel of fixture.panels) assert.equal(panelBank(p,panel)+panelBank({...p,reverse:!p.reverse},panel),3);
  assert.equal(planLighting({...fixture,panels:fixture.panels.slice(0,2)},7,'travel'),null);
  const cue={...p,cue:{start:50,hold:true,reverse:true}};
  assert.deepEqual(bankLevels(cue,49),[1,1,1,1]);
  assert.deepEqual(bankLevels(cue,51),[1,1,1,LIGHTING.blackout]);
  assert.deepEqual(bankLevels(cue,500),[LIGHTING.blackout,LIGHTING.blackout,LIGHTING.blackout,LIGHTING.blackout]);
});

test('emergency lighting is rare and capped; pools keep very few ceiling tubes alive', () => {
  const level={seed:'emergency-distribution',rooms:Array.from({length:2000},(_,id)=>({...fixture,id}))};
  const individual=level.rooms.map(r=>planLighting(r,level.seed,true));
  const red=individual.filter(p=>p?.kind==='emergency').length;
  assert.ok(red>5 && red<40, `${red}/2000 emergency rooms`);
  assert.equal(planFloorLighting(level,true).filter(p=>p?.kind==='emergency').length,1);
  const p=planLighting(fixture,7,'islands');
  assert.equal(fixture.panels.filter(panel=>panelBank(p,panel)===0).length,1);
  assert.deepEqual(bankLevels(p,0),bankLevels(p,800));
  const emergency={...planLighting(fixture,7,'emergency'),offset:0};
  near(bankLevels(emergency,1.3),[LIGHTING.blackout,LIGHTING.blackout,1]);
  near(bankLevels(emergency,3),[LIGHTING.blackout,LIGHTING.blackout,.08]);
  assert.deepEqual(bankLevels(emergency,3,1,true),[LIGHTING.blackout,LIGHTING.blackout,.55]);
  assert.deepEqual(bankLevels(emergency,3,3),[1,1,0]);
});

test('lighting is opt-in, deterministic and leaves the generated layout untouched', () => {
  const floor = generate('bank-study'), before = JSON.stringify(floor);
  for (const room of floor.rooms) {
    assert.equal(planLighting(room, floor.seed), null);
    assert.deepEqual(planLighting(room, floor.seed, true), planLighting(room, floor.seed, true));
  }
  assert.equal(JSON.stringify(floor), before);
  for (const patch of [{kind:'special'}, {kind:'start'}, {kind:'exit'}, {crawl:true}, {light:{mode:'dark'}}, {light:{mode:'one'}}]) {
    assert.equal(planLighting({...fixture,...patch}, 7, 'failing'), null);
  }
});

test('most eligible rooms retain their steady lighting; every ceiling bank has tubes', () => {
  let affected = 0;
  for (let id = 0; id < 1000; id++) {
    const room = {...fixture,id}, plan = planLighting(room, 'distribution', true);
    if (!plan) continue;
    affected++;
    assert.deepEqual([...new Set(room.panels.map(p => panelBank(plan,p)))].sort(), Array.from({length:plan.ceilingBanks},(_,i)=>i));
  }
  assert.ok(affected > 250 && affected < 350, `${affected}/1000 affected`);
});

test('a failing bank has a long dark dwell and slow recovery, independent of sampling rate', () => {
  const plan = {...planLighting(fixture,7,'failing'),offset:0,period:40};
  assert.deepEqual(bankLevels(plan,5), [1,LIGHTING.blackout]);
  assert.deepEqual(bankLevels(plan,20), [1,1]);
  assert.deepEqual(bankLevels(plan,45), bankLevels(plan,5));
  assert.ok(bankLevels(plan,11)[1] > 0.1 && bankLevels(plan,11)[1] < 0.7);
  for (const fps of [30,60,144]) {
    let last = 1;
    for (let i=0; i<fps*40; i++) {
      const [steady,k] = bankLevels(plan,i/fps);
      assert.equal(steady,1);
      assert.ok(k >= LIGHTING.blackout-1e-8 && k <= 1);
      assert.ok(Math.abs(k-last) < 0.15);
      last=k;
    }
  }
  assert.deepEqual(bankLevels(plan,5,0.02), [1,1], 'encounter blackout owns the ceiling');
  assert.deepEqual(bankLevels(plan,5,3), [1,1], 'encounter flash owns the ceiling');
  assert.deepEqual(bankLevels(plan,5,1), [1,LIGHTING.blackout], 'normal service resumes its cycle');
});

const lights = [lamp(-4,2.6,0,[1,.8,.5],{bank:0}),lamp(4,2.6,0,[1,.8,.5],{bank:1})];
const amb = [.2,.18,.14], lighting = {ambientShare:.92};
const probe = (x,glow=false) => ({verts:1,pos:[x,1,0],nor:[0,1,0],alb:[.8,.7,.6],ao:[.75],sf:[0,Number(glow)],vox:glow});
const near = (a,b,epsilon=1e-6) => a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<epsilon, `${v} != ${b[i]}`));

test('all banks on reconstruct the original bake, including albedo and ambient occlusion', () => {
  for (const x of [-5,0,5]) {
    const original = bake(probe(x),lights,amb), split = bake(probe(x),lights,amb,lighting);
    near([...original.lit], [...split.lit].map((v,c)=>v+split.banks[0][c]+split.banks[1][c]));
  }
  assert.equal(bake(probe(0),lights,amb).banks,null, 'no extra arrays when disabled');
});

test('dark pockets follow the failed side; light probes and exposure agree', () => {
  const runtime = {lighting,banks:[1,.015]};
  const left = lightAt(lights,amb,-4,1,0,0,1,0,runtime);
  const right = lightAt(lights,amb,4,1,0,0,1,0,runtime);
  assert.ok(left[0] > right[0]*4);
  assert.ok(bankWeights(lights,-4,0)[0] > .98);
  assert.ok(localLightScale(lighting,lights,[1,.015],-4,0) > .9);
  assert.ok(localLightScale(lighting,lights,[1,.015],4,0) < .12);
  near(lightAt(lights,amb,0,1,0), lightAt(lights,amb,0,1,0,0,1,0,{lighting,banks:[1,1]}));
});

test('moving objects see actual flicker strength; emissive voxels stay independent', () => {
  const flick = [lamp(0,2,0,[1,1,1],{flick:true})];
  const dark = lightAt(flick,[0,0,0],0,0,0,0,1,0,{flick:0});
  assert.deepEqual(dark,[0,0,0]);
  assert.ok(lightAt(flick,[0,0,0],0,0,0)[0] > .1);
  const glow = bake(probe(0,true),lights,amb,lighting);
  assert.ok(glow.lit[0] > 1);
  assert.deepEqual([...glow.banks[0],...glow.banks[1]],[0,0,0,0,0,0]);
});

test('three/four bank bakes reconstruct light; red backup never owns ambient bounce', () => {
  for(const count of [3,4]) {
    const plan={ambientShare:.92,bankCount:count,ceilingBanks:count===3?2:4};
    const sources=Array.from({length:count},(_,bank)=>lamp(-3+bank*2,2,0,bank===2?[2,.05,.02]:[1,1,1],{bank}));
    const original=bake(probe(0),sources,amb), split=bake(probe(0),sources,amb,plan);
    near([...original.lit],[...split.lit].map((v,c)=>v+split.banks.reduce((sum,b)=>sum+b[c],0)));
    if(count===3) {
      assert.equal(bankWeights(sources,1,0,3,2)[2],0);
      const backup=lightAt(sources,amb,1,1,0,0,1,0,{lighting:plan,banks:[0,0,1]});
      assert.ok(backup[0]>backup[1]*10,'near the backup lamp the light is red');
    }
  }
});

test('emergency world builds colored fixtures and honors live steady-light settings', async t => {
  const previous=globalThis.document;
  const ctx=new Proxy({}, {get:(_,k)=>k==='measureText'?()=>({width:20}):k.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
  globalThis.document={createElement:()=>({getContext:()=>ctx})}; t.after(()=>{globalThis.document=previous;});
  let steady=false;
  const kit=createKit(), floor=generate(7,{count:0});
  const world=await buildWorld(kit,floor,{lighting:'emergency',steadyLighting:()=>steady,builders:{plain:c=>c.shell()}});
  t.after(()=>{world.dispose();kit.dispose();});
  const rt=world.rooms.find(r=>r.lighting);
  assert.ok(rt.lights.some(l=>l.bank===2 && l.r>l.g*10));
  assert.ok(rt.bankPanels.some(m=>m.userData.bank===2));
  rt.group.traverse(o=>{if(o.geometry?.userData.banks){
    assert.equal(o.material.defines.BANKS,3);
    assert.equal(o.material.uniforms.uMoreBanks,rt.u.moreBanks);
    assert.ok(o.geometry.attributes.aBank2);
  }});
  rt.lighting.offset=0; world.updateLighting(1.3); near(rt.lightLevels,[LIGHTING.blackout,LIGHTING.blackout,1]);
  steady=true; world.updateLighting(1.3); near(rt.lightLevels,[LIGHTING.blackout,LIGHTING.blackout,.55]);
  world.updateLighting(20); near(rt.lightLevels,[LIGHTING.blackout,LIGHTING.blackout,.55]);
  world.setLights(rt,.02); assert.deepEqual(rt.lightLevels,[1,1,0]);
  world.setLights(rt,1); near(rt.lightLevels,[LIGHTING.blackout,LIGHTING.blackout,.55]);
});

test('real world meshes, visible tubes, probes and encounter overrides share bank uniforms', async (t) => {
  const previous = globalThis.document;
  const ctx = new Proxy({}, {get:(_,k)=>k === 'measureText' ? () => ({width:20}) : k.startsWith('create') ? () => ({addColorStop(){}}) : () => {},set:()=>true});
  globalThis.document = {createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{globalThis.document=previous;});
  const kit = createKit(), floor = generate(7,{count:0});
  const world = await buildWorld(kit,floor,{lighting:'dim',builders:{plain:c=>c.shell()}});
  t.after(()=>{world.dispose();kit.dispose();});
  const rt = world.rooms.find(r=>r.lighting);
  assert.ok(rt);
  assert.equal(rt.bankPanels.length,2);
  const before = [];
  rt.group.traverse(o=>{if(o.geometry?.userData.banks){
    assert.equal(o.material.uniforms.uBanks,rt.u.banks);
    assert.ok(o.geometry.attributes.aBank0 && o.geometry.attributes.aBank1);
    const normals=o.geometry.attributes.normal;
    assert.equal(normals.count,o.geometry.attributes.position.count);
    assert.equal(normals.normalized,true);
    assert.ok(normals.array instanceof Int8Array);
    for(let i=0;i<normals.count;i++)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<.015);
    assert.equal(o.material.uniforms.uTorchOrigin,kit.shared.uTorchOrigin);
    assert.equal(o.material.uniforms.uTorchDirection,kit.shared.uTorchDirection);
    before.push(o.geometry);
  }});
  assert.ok(before.length>0);
  let ticks = 0;
  rt.ticks.push(()=>{ticks++;});
  rt.lighting.kind='failing'; rt.lighting.offset=0; rt.lighting.period=40;
  rt.group.visible=false;
  world.updateLighting(5);
  assert.deepEqual(rt.u.banks.value,[1,LIGHTING.blackout]);
  world.updateLighting(20);
  assert.deepEqual(rt.u.banks.value,[1,1]);
  assert.equal(ticks,0,'lighting on the part below does not run its hazards');
  assert.equal(world.current(),null,'lighting alone never enters a room');
  rt.lighting.kind='dim';
  const pos = toWorld(rt.def,0,0), me={...pos,yaw:0};
  world.update(1/60,5,me);
  const lit = world.lightAt(pos.x,pos.z);
  world.setLights(rt,.02);
  assert.deepEqual(rt.u.banks.value,[1,1]);
  assert.ok(world.lightAt(pos.x,pos.z)[0] < lit[0]);
  world.setLights(rt,1);
  assert.deepEqual(rt.u.banks.value,[.78,LIGHTING.blackout]);
  near(world.lightAt(pos.x,pos.z),lit);
  for (const mesh of rt.bankPanels) near(mesh.material.color.toArray(),mesh.userData.on.toArray().map(v=>v*rt.u.banks.value[mesh.userData.bank]));
  assert.ok(before.every(g=>g.attributes.aBank0.array.length>0));
  assert.equal(world.startLightingCue(rt),false,'ambient dim rooms are not secretly converted after baking');
  rt.lighting.kind='travel';
  world.updateLighting(50);
  assert.equal(world.startLightingCue(rt,{from:'high',hold:true}),true);
  world.updateLighting(100);
  assert.deepEqual(rt.lightLevels,[LIGHTING.blackout,LIGHTING.blackout]);
  world.clearLightingCue(rt);
  world.updateLighting(100);
  assert.deepEqual(rt.lightLevels,[1,1],'clearing the held cue restores the seeded cycle');
});
