import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoopAudio} from '../public/world/coop/audio.js';

test('replayed snapshots sound once, use each listener position, and cannot leak old-floor events',()=>{
 const heard=[],audio=createCoopAudio(()=>({play:(name,o)=>heard.push({name,...o}),stopMascot(){},setMains(){}}));
 const players=[{id:'a',health:4,x:0,z:0,yaw:0},{id:'b',health:4,x:6,z:0,yaw:0}];
 const snapshot={depth:0,players,sounds:[{seq:1,name:'step',x:3,z:0,reach:10},{seq:2,name:'hurt',to:'b'},{seq:3,name:'step',x:30,z:0,reach:10}]};
 audio.floor({hum:50},0);audio.update(snapshot,'a');audio.update(snapshot,'a');
 assert.equal(heard.length,1);assert.equal(heard[0].pan,1);assert.equal(heard[0].vol,.7);
 audio.floor({hum:60},1);audio.update(snapshot,'a');assert.equal(heard.length,1);
 audio.update({...snapshot,depth:1},'b');assert.equal(heard.length,3);assert.equal(heard[1].pan,-1);assert.equal(heard[2].name,'hurt');
});
