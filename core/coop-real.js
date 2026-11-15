// Transport guard for the trusted-browser real-room authority. It is not an
// anti-cheat server: the private host owns the simulation, including health.
export function validRealSnapshot(s, ids) {
 const finite = n => Number.isFinite(n) && Math.abs(n) < 1e6;
 if (!s || s.real !== true || !['play', 'dead', 'escaped','descending'].includes(s.phase) || !finite(s.time)) return false;
 if (!Array.isArray(s.players) || s.players.length !== ids.length
  || !s.players.every(p => p && ids.includes(p.id)
   && [p.x,p.z,p.yaw,p.pitch,p.health,p.battery].every(finite)
   && (p.y === undefined || finite(p.y)) && p.health >= 0 && p.health <= 4 && p.battery >= 0 && p.battery <= 400
   && Array.isArray(p.bag) && p.bag.length <= 6 && p.bag.every(id => typeof id === 'string'))
  || new Set(s.players.map(p => p.id)).size !== ids.length) return false;
 if (!Array.isArray(s.items) || s.items.length > 100 || !s.items.every(i => i && typeof i.id === 'string' && i.id.length < 80
  && ['battery','snack'].includes(i.type) && [i.x,i.z].every(finite)
  && (i.owner === null || i.owner === 'used' || ids.includes(i.owner)))) return false;
 if (!Number.isInteger(s.nodeCount) || s.nodeCount < 1 || s.nodeCount >= 50000) return false;
 if(s.depth!==undefined&&(!Number.isInteger(s.depth)||!Number.isInteger(s.depths)||s.depth<0||s.depths<1||s.depths>8||s.depth>=s.depths))return false;
 const rows = (data, size) => Array.isArray(data) && data.length <= s.nodeCount
  && data.every(row => Array.isArray(row) && row.length === size && row.every(finite)
   && Number.isInteger(row[0]) && row[0] >= 0 && row[0] < s.nodeCount);
 return rows(s.nodes, 12) && (s.tints === undefined || rows(s.tints, 4)) && (s.opacity === undefined || rows(s.opacity, 2))
  && (s.links === undefined || Array.isArray(s.links) && s.links.length < 1000 && s.links.every(v => typeof v === 'boolean'))
  && (s.solids === undefined || Array.isArray(s.solids) && s.solids.length < 1000 && s.solids.every(a => Array.isArray(a) && a.length < 5000 && a.every(v => typeof v === 'boolean')))
  && (s.lights === undefined || Array.isArray(s.lights) && s.lights.length < 1000 && s.lights.every(finite));
}
