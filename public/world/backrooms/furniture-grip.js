// A hand on ordinary furniture, not a gravity gun. The furniture and the
// player's feet take the same short step; if either cannot fit, neither moves.
import { FURNITURE } from './furniture-motion.js';

const REACH = 1.65;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const edgeDistance = (item, me) => Math.hypot(me.x - clamp(me.x, item.x0, item.x1), me.z - clamp(me.z, item.z0, item.z1));

/** Camcorder ray against the whole furniture silhouette, not individual voxels. */
function hit(item, me) {
  const cp = Math.cos(me.pitch || 0);
  const dir = [-Math.sin(me.yaw) * cp, Math.sin(me.pitch || 0), -Math.cos(me.yaw) * cp];
  const from = [me.x, me.y, me.z], lo = [item.x0, item.y, item.z0], hi = [item.x1, item.top, item.z1];
  let near = 0, far = REACH;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-7) { if (from[i] < lo[i] || from[i] > hi[i]) return null; }
    else {
      let a = (lo[i] - from[i]) / dir[i], b = (hi[i] - from[i]) / dir[i];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return null;
    }
  }
  return { distance: near, x: me.x + dir[0] * near, y: me.y + dir[1] * near, z: me.z + dir[2] * near };
}

export function furnitureTarget(world, me) {
  if (![me.x, me.y, me.z, me.yaw].every(Number.isFinite)) return null;
  let best = null, distance = Infinity;
  for (const item of world.furniture || []) {
    if (!FURNITURE[item.type] || item.away || item.transition || item.group?.visible === false || edgeDistance(item, me) > REACH) continue;
    const at = hit(item, me);
    if (!at || at.distance >= distance) continue;
    const n = Math.max(1, Math.ceil(at.distance / .08));
    let visible = true;
    for (let i = 1; i < n; i++) {
      if (!world.free(me.x + (at.x - me.x) * i / n, me.z + (at.z - me.z) * i / n, .015,
        { tall: true, ghost: true, ignoreCollider: item.collider })) { visible = false; break; }
    }
    if (visible) { best = item; distance = at.distance; }
  }
  return best;
}

export function createFurnitureGrip(world, motion, { sound } = {}) {
  let held = null, target = null, me = null, cooldown = 0, travelled = 0, blocked = false, saved = null, lift = 0;
  const lies = item => !!item?.deployed || !!item?.transition;
  const resetLift = () => { if (held?.group?.position) held.group.position.y -= lift; lift = 0; };
  function followPanel() {
    if (!held?.bridge || lies(held) || held.away || !me) return;
    const reach = Math.min(1.8, Math.max(1.1, Math.hypot(held.x1-held.x0,held.z1-held.z0)/2+.65));
    held.translate(me.x-Math.sin(me.yaw)*reach-held.x,me.z-Math.cos(me.yaw)*reach-held.z);
    held.collider.on=false;resetLift();lift=world.floorY(me.x,me.z)-held.y+.16;
    if(held.group?.position)held.group.position.y+=lift;
  }
  function release(force = true) {
    if(held?.bridge && saved){
      resetLift();
      if(!held.away && !lies(held)){
        const dx=held.x-me.x,dz=held.z-me.z;let placed=false;
        for(const scale of [1,.85,.7]){
          const x=me.x+dx*scale,z=me.z+dz*scale,n=Math.max(1,Math.ceil(Math.hypot(x-me.x,z-me.z)/.08));let clear=true;
          for(let i=1;i<=n;i++)if(!world.free(me.x+(x-me.x)*i/n,me.z+(z-me.z)*i/n,.015,{tall:true,ghost:true,ignoreCollider:held.collider})){clear=false;break;}
          if(clear&&motion.place(held,x,z,{from:world.floorY(me.x,me.z)})){placed=true;break;}
        }
        if(!placed&&!force){blocked=true;followPanel();return false;}
        if(!placed)held.translate(saved.x-held.x,saved.z-held.z);
      }
      const occupied = !lies(held) && ((world.env?.players?.() || [world.env?.player]).some(p=>p?.me&&edgeDistance(held,p.me)<(p.RADIUS||.22)) || (world.bodies||[]).some(b=>b.on!==false&&!b.airborne&&edgeDistance(held,b)<b.r));
      held.carried=false;held.collider.on=!held.away&&!occupied;world.touchFurniture?.(held);
    }
    if (me) delete me.gripSpeed;
    held = null; target = null; saved=null; travelled = 0; blocked = false;return true;
  }

  return {
    get held() { return held; },
    get target() { return target; },
    get blocked() { return blocked; },
    /** An interactive computer still takes E; aim below its tabletop to move the desk itself. */
    action(use) {
      if (held) return held;
      if (!target || !me) return null;
      return !use || (use.furniture === target && hit(target, me)?.y < (target.surfaceY ?? target.top) - .02) ? target : null;
    },
    release,
    update(dt, player, enabled = true) {
      me = player;
      if (!enabled || me.frozen || me.drop > .12 || (held && (held.away || held.transition || !held.bridge && edgeDistance(held, me) > REACH + .35))) { release(); return; }
      followPanel();
      target = held || furnitureTarget(world, me);
      if (held) me.gripSpeed = FURNITURE[held.type].playerSpeed;
      else delete me.gripSpeed;
      cooldown -= dt;
      if (held && travelled > .025 && cooldown <= 0) {
        sound?.play(held.type === 'desk' ? 'furnitureScrape' : 'furnitureRoll', { vol: .7 });
        cooldown = .32; travelled = 0;
      }
    },
    use() {
      if (held) return release(false);
      if (!target || !me) return false;
      held = target; blocked = false; me.vx = me.vz = 0;
      if(held.bridge){saved={x:held.x,z:held.z,on:held.collider.on};if(!lies(held)){held.carried=true;held.collider.on=false;world.touchFurniture?.(held);}followPanel();}
      me.gripSpeed = FURNITURE[held.type].playerSpeed;
      sound?.play('clack', { vol: .25 });
      return true;
    },
    tip() {
      if(!held?.bridge||!me)return {ok:false,reason:'fixed'};
      const result=motion.tip(held,me);
      if(result.ok){sound?.play('furnitureScrape',{vol:.6});release();}
      return result;
    },
    /** Called by player.move for each <=6cm axis step. `step` tests the player's body after the furniture has moved. */
    step(dx, dz, step) {
      if (!held) return step(dx, dz);
      if(held.bridge){const moved=step(dx,dz);if(moved){blocked=false;followPanel();}return moved;}
      const wasOn = held.collider.on;
      const moved = motion.move(held, dx, dz, { ignoreBody: me });
      if (!moved.moved) { blocked = true; return false; }
      if (!step(moved.dx, moved.dz)) {
        // No other world update can run between these synchronous steps. This
        // exact previous position is known safe, so rollback cannot strand it.
        held.translate(-moved.dx, -moved.dz);
        held.collider.on = wasOn;
        if (wasOn === false) world.touchFurniture?.(held);
        blocked = true; return false;
      }
      travelled += Math.hypot(moved.dx, moved.dz); blocked = false;
      return true;
    },
  };
}
