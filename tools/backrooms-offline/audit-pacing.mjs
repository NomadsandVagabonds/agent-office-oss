// Read-only pacing audit. Counts and rectangle areas are proxies, not play time.
// Run with --details to include each sampled visit in the JSON output.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generate, roomPath } from '../../public/world/backrooms/gen.js';
let revision = null;
try { revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Exported source may have no Git metadata. */ }
const ordinary = r => r.kind === 'plain' || r.kind === 'start';
const pct = n => Math.round(n * 10000) / 100;
function summary(values) {
 const a=values.slice().sort((x,y)=>x-y), n=a.length;
 return {min:a[0],median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,max:a[n-1],mean:a.reduce((s,x)=>s+x,0)/n};
}
function routes(level, hatches) {
 const start=level.start.room, exit=level.exit.room;
 const next = id => [...level.rooms[id].doors.map(d=>({to:d.to,type:'door'})), ...(hatches?(level.rooms[id].dress||[]).filter(d=>d.type==='floordoor').map(d=>({to:d.to,type:'hatch'})):[])];
 const dist=new Map([[start,0]]), prev=new Map(), q=[start];
 for(let i=0;i<q.length;i++)for(const edge of next(q[i]))if(!dist.has(edge.to)){dist.set(edge.to,dist.get(q[i])+1);prev.set(edge.to,{from:q[i],type:edge.type});q.push(edge.to)}
 if(!dist.has(exit))throw Error('No route for '+level.seed);
 const path=[],edges=[];for(let at=exit;;){path.push(at);if(at===start)break;const p=prev.get(at);edges.push(p.type);at=p.from}path.reverse();edges.reverse();
 const denominator=path.filter(id=>level.rooms[id].kind!=='exit').length;
 const count=path.filter(id=>level.rooms[id].kind==='special').length;
 // Min/max special-room exposure among ALL equally short routes.
 const mins=new Map([[start,level.rooms[start].kind==='special'?1:0]]),maxs=new Map(mins);
 for(const from of q)for(const edge of next(from))if(dist.get(edge.to)===dist.get(from)+1){const k=level.rooms[edge.to].kind==='special'?1:0;mins.set(edge.to,Math.min(mins.get(edge.to)??Infinity,mins.get(from)+k));maxs.set(edge.to,Math.max(maxs.get(edge.to)??-Infinity,maxs.get(from)+k))}
 return {path,pathKinds:path.map(id=>level.rooms[id].arch||level.rooms[id].kind),transitions:edges.length,hatchesUsed:edges.filter(e=>e==='hatch').length,specialCount:count,denominator,specialFraction:count/denominator,tiedShortestSpecialMin:mins.get(exit),tiedShortestSpecialMax:maxs.get(exit)};
}
const rows=[], failures=[];
for(let i=0;i<200;i++){
 const seed=i*7919+13;let level;try{level=generate(seed)}catch(e){failures.push({seed,message:e.message});continue}
 const rooms=level.rooms.filter(r=>r.kind!=='exit'), normal=rooms.filter(ordinary);
 const totalArea=rooms.reduce((s,r)=>s+r.W*r.D,0), ordinaryArea=normal.reduce((s,r)=>s+r.W*r.D,0);
 const door=routes(level,false),hatch=routes(level,true);
 if(JSON.stringify(door.path)!==JSON.stringify(roomPath(level,level.start.room,level.exit.room)))throw Error('Door BFS differs from exported roomPath');
 rows.push({seed,roomsExcludingExit:rooms.length,ordinaryRooms:normal.length,specialRooms:rooms.filter(r=>r.kind==='special').length,ordinaryRoomFraction:normal.length/rooms.length,ordinaryArea,totalArea,ordinaryAreaFraction:ordinaryArea/totalArea,hatchEdges:rooms.reduce((s,r)=>s+(r.dress||[]).filter(d=>d.type==='floordoor').length,0),door,hatch,freightIncluded:rooms.some(r=>r.arch==='freight')});
}
const metric=fn=>Object.fromEntries(Object.entries(summary(rows.map(fn))).map(([k,v])=>[k,pct(v)]));
const results = {
 revision,
 sample:{requested:200,successful:rows.length,seedFormula:'i * 7919 + 13; i = 0..199',options:{},forcedOnly:false,forcedCount:false,failures},
 definitions:{ordinary:'kind plain or start; exit omitted from every fraction denominator',floorArea:'sum W * D of room interior rectangles; not furniture-adjusted or vertical surface area',route:'minimum number of room transitions; start included, exit excluded from fraction denominator; one BFS path, existing doorway order breaks ties',hatch:'adds directed room.dress floordoor.to edges, each costs one transition; no other runtime teleports'},
 metricsPercent:{ordinaryRoomFraction:metric(r=>r.ordinaryRoomFraction),ordinaryFloorAreaFraction:metric(r=>r.ordinaryAreaFraction),shortestDoorRouteSpecialFraction:metric(r=>r.door.specialFraction),shortestDoorPlusHatchRouteSpecialFraction:metric(r=>r.hatch.specialFraction)},
 counts:{roomsExcludingExit:summary(rows.map(r=>r.roomsExcludingExit)),ordinaryRooms:summary(rows.map(r=>r.ordinaryRooms)),specialRooms:summary(rows.map(r=>r.specialRooms)),doorTransitions:summary(rows.map(r=>r.door.transitions)),hatchTransitions:summary(rows.map(r=>r.hatch.transitions)),hatchEdges:summary(rows.map(r=>r.hatchEdges)),ordinaryCountBelow60pct:rows.filter(r=>r.ordinaryRoomFraction<.6).length,ordinaryCount60to80pct:rows.filter(r=>r.ordinaryRoomFraction>=.6&&r.ordinaryRoomFraction<=.8).length,ordinaryCountAbove80pct:rows.filter(r=>r.ordinaryRoomFraction>.8).length,hatchesShortenRoute:rows.filter(r=>r.hatch.transitions<r.door.transitions).length,selectedShortestRouteUsesHatch:rows.filter(r=>r.hatch.hatchesUsed>0).length,doorShortestTiesDifferInSpecialCount:rows.filter(r=>r.door.tiedShortestSpecialMin!==r.door.tiedShortestSpecialMax).length,hatchShortestTiesDifferInSpecialCount:rows.filter(r=>r.hatch.tiedShortestSpecialMin!==r.hatch.tiedShortestSpecialMax).length,freightIncluded:rows.filter(r=>r.freightIncluded).length},
 shortestTieEnvelopePercent:{doorMin:metric(r=>r.door.tiedShortestSpecialMin/r.door.denominator),doorMax:metric(r=>r.door.tiedShortestSpecialMax/r.door.denominator),hatchMin:metric(r=>r.hatch.tiedShortestSpecialMin/r.hatch.denominator),hatchMax:metric(r=>r.hatch.tiedShortestSpecialMax/r.hatch.denominator)}
};
console.log(JSON.stringify(process.argv.includes('--details') ? { summary: results, rows } : results, null, 2));
if (failures.length) process.exitCode = 1;
