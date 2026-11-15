import test from 'node:test';import assert from 'node:assert/strict';import {createSceneSender} from '../public/world/coop/scene-wire.js';
test('reliable scene stream sends resources once, screen revisions once, and resets between floors',()=>{
 const send=createSceneSender(),s={depth:0,scene:{added:[{id:3}],geometries:[{id:4}],materials:[],textures:[],canvases:[{id:0,version:1,data:'pixels'}],parents:[[3,0]]}};
 assert.equal(send(s).scene.canvases.length,1);assert.equal(send(s).scene.added.length,0);assert.equal(send(s).scene.canvases.length,0);
 s.scene.canvases[0].version=2;assert.equal(send(s).scene.canvases.length,1);assert.equal(s.scene.added.length,1,'does not mutate the authoritative snapshot');
 assert.deepEqual(send(s).scene.parents,[[3,0]]);assert.equal(send({...s,depth:1}).scene.added.length,1);
});
