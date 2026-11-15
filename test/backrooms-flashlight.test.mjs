import test from 'node:test';
import assert from 'node:assert/strict';
import { FLASHLIGHT, FLASHLIGHT_POSES, flashlightRay, inFlashlight } from '../public/world/backrooms/flashlight.js';
import { createBlackoutState, stepBlackout } from '../public/world/backrooms/rooms/blackout-bay/rule.js';

const eye={x:0,y:1.1,z:0,yaw:0,pitch:0}, lit={power:1};
const atAngle=degrees=>({x:6*Math.sin(degrees*Math.PI/180),z:-6*Math.cos(degrees*Math.PI/180)});

test('hand and camcorder emitters converge on the sight line and rotate with the player',()=>{
  for (const mounted of [false,true]) for (const yaw of [0,.7,Math.PI/2]) for (const pitch of [-.4,0,.8]) {
    const e={...eye,yaw,pitch,mounted}, {origin:o,direction:d}=flashlightRay(e);
    const aim=[-Math.sin(yaw)*Math.cos(pitch)*4,eye.y+Math.sin(pitch)*4,-Math.cos(yaw)*Math.cos(pitch)*4];
    const distance=Math.hypot(...aim.map((n,i)=>n-o[i]));
    for(let i=0;i<3;i++)assert.ok(Math.abs(o[i]+d[i]*distance-aim[i])<1e-10);
  }
  assert.ok(FLASHLIGHT_POSES.hand.origin[0]>FLASHLIGHT_POSES.mounted.origin[0]);
  for(const pose of Object.values(FLASHLIGHT_POSES))assert.ok(Math.hypot(...pose.origin)<.22,'source stays inside the player collision radius at any pitch');
  // The same lateral world-space displacement misses nearby but enters the
  // widening beam farther away, for both mounting positions.
  for (const mounted of [false,true]) {
    assert.equal(inFlashlight({...eye,mounted},{x:.6,z:-1},{power:1,radius:0}),false);
    assert.equal(inFlashlight({...eye,mounted},{x:.6,z:-6},{power:1,radius:0}),true);
  }
});

test('the bright aiming zone stays inside a narrow feathered light cone',()=>{
  assert.ok(FLASHLIGHT.coreCos>FLASHLIGHT.holdCos&&FLASHLIGHT.holdCos>FLASHLIGHT.edgeCos);
  assert.ok(FLASHLIGHT.edgeCos>=Math.cos(20*Math.PI/180),'the light cannot wash the whole view');
  assert.ok(FLASHLIGHT.holdRange<FLASHLIGHT.range);
  assert.equal(inFlashlight(eye,atAngle(8),lit),true);
  assert.equal(inFlashlight(eye,atAngle(16),lit),false,'faint edge spill is not enough to hold a creature');
  assert.equal(inFlashlight(eye,atAngle(35),lit),false);
});

test('beam-sensitive bodies use pitch, power, occlusion and a continuous silhouette at close range',()=>{
  const target={x:0,z:-3};
  assert.equal(inFlashlight(eye,target),false);
  assert.equal(inFlashlight(eye,target,{power:1,los:false}),false);
  assert.equal(inFlashlight({...eye,pitch:1.2},target,lit),false);
  assert.equal(inFlashlight(eye,{x:0,z:3},lit),false);
  assert.equal(inFlashlight(eye,{x:0,z:-14},lit),false);
  for(const y of [.8,1.1,1.2,1.6])assert.equal(inFlashlight({...eye,y},{x:0,z:-.5},lit),true);
  const raised={x:0,y:2.1,z:-3};
  assert.equal(inFlashlight({...eye,pitch:Math.atan2(2.1,3)},raised,lit),true);
});

test('Blackout Bay uses the same narrow beam and releases a figure when the player aims above it',()=>{
  const sense={dt:.05,inDark:true,hasFlashlight:true,targets:[{x:0,z:-3},{...atAngle(30)}]};
  const forward=stepBlackout(createBlackoutState(2),sense);
  assert.deepEqual(forward.frozen,[true,false]);
  const upward=stepBlackout(forward.state,{...sense,pitch:1.2});
  assert.deepEqual(upward.frozen,[false,false]);
});
