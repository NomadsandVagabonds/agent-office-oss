// A · After Hours: a first-person containment run through the office.
// The kit owns the visit; pure rules own movement, combat, encounters and checkpoints.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { createGame, step, respawn, objective, interactable, PLAYER, LEVEL } from '/core/afterhours-game.mjs';
import { crowbar, gloveHand, headcrabBody, headcrabLeg, HEADCRAB } from './afterhours-props.js';
import { buildEnvironment } from './afterhours-scene.js';

const clamp = (x, low, high) => Math.max(low, Math.min(high, x));

export async function enter(office) {
  const w = createWorld(office, {
    id: 'afterhours', arrive: false, background: '#111c23', bounds: LEVEL.bounds, start: LEVEL.start,
    camera: { first: true, fov: 76, height: 1.55, minPitch: -1.3, maxPitch: 1.3 },
    fog: { color: '#111c23', near: 19, far: 48 }, shadows: 14,
    grade: { tilt: 0, bloom: 0.23, glow: 0.95 },
  });
  const { camera, scene, root } = w;
  camera.near = 0.05; camera.far = 90; camera.updateProjectionMatrix();
  w.light({ sky: '#a7aacb', ground: '#69513d', hemi: 1.2, sun: '#b0bad2', power: 0.65, dir: [-0.6, 1, 0.4] });
  w.bed('office-bed', { volume: 0.1 });
  let game = createGame(), yaw = game.yaw, pitch = 0.05;
  let paused = false, closing = false, locked = false, lockDenied = false, lockPending = false;
  let attackHeld = false, attackPulse = false, drag = null, escapeGuardUntil = 0;
  let hitUntil = 0, hurtUntil = 0, lastStatus = '', stepDistance = 0;
  const held = new Set(), creatures = new Map(), particles = [];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const environment = buildEnvironment(w, office);
  // Mission interactions live on the wrist terminal; the shared lift hint would
  // otherwise advertise a different E action while this controller owns the key.
  root.querySelector('.usehint')?.style.setProperty('display', 'none');

  const crosshair = document.createElement('div');
  crosshair.setAttribute('aria-hidden', 'true');
  Object.assign(crosshair.style, { position: 'absolute', top: '50%', left: '50%', width: '4px', height: '4px',
    borderRadius: '50%', background: '#e6e2d2', boxShadow: '0 0 0 1px #15202a', transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: '0.75' });
  root.appendChild(crosshair);

  // The crowbar and wrist terminal are physical objects in the camera's scene.
  const hand = new THREE.Group(); camera.add(hand);
  const tool = w.vox(crowbar, 0, 0, 'S', { cast: false, receive: false }); hand.add(tool); tool.scale.setScalar(0.76);
  const glove = w.vox(gloveHand, 0, 0, 'S', { cast: false, receive: false }); hand.add(glove); glove.scale.setScalar(0.74);
  const wrist = new THREE.Group(); camera.add(wrist); wrist.position.set(-0.4, -0.36, -0.66); wrist.rotation.set(-0.1, 0.16, 0.06); wrist.scale.setScalar(.74);
  const casing = w.box(-0.18, -0.09, -0.025, 0.18, 0.09, 0.025, '#293d43', { cast: false }); wrist.add(casing); casing.position.set(0, 0, 0);
  const vitals = w.screen(0.33, 0.16, (g, W, H) => {
    g.fillStyle = '#102027'; g.fillRect(0, 0, W, H);
    g.fillStyle = game.health <= 40 ? '#ffb85b' : '#b5e4cf';
    g.fillRect(W * .07, H * .19, W * .075, H * .07); g.fillRect(W * .095, H * .14, W * .025, H * .17);
    g.font = `bold ${H * .36}px monospace`; g.fillText(String(game.health).padStart(3, '0'), W * .19, H * .38);
    for (let i = 0; i < 10; i++) { g.fillStyle = game.health > i * 10 ? '#a4d7c1' : '#294047'; g.fillRect(W * (.07 + i * .087), H * .46, W * .066, H * .08); }
    // Equipment indicators replace mission prose: fuse, power, extraction.
    const near = interactable(game), icon = (x, lit, nearby, draw) => {
      g.save(); g.translate(W * x, H * .75); g.scale(H * .18, H * .18);
      g.strokeStyle = g.fillStyle = lit ? '#b5e4cf' : nearby ? '#e4c078' : '#527078'; g.lineWidth = .13; draw(); g.restore();
    };
    icon(.19, game.hasFuse, near?.kind === 'fuse', () => { g.strokeRect(-.4, -.55, .8, 1.1); g.fillRect(-.4, -.7, .8, .18); g.fillRect(-.4, .52, .8, .18); });
    icon(.48, game.power, near?.kind === 'panel', () => { g.beginPath(); g.moveTo(.12, -.7); g.lineTo(-.42, .08); g.lineTo(.02, .08); g.lineTo(-.12, .7); g.lineTo(.45, -.13); g.lineTo(0, -.13); g.closePath(); g.fill(); });
    icon(.78, game.stage === 'won', game.power, () => { g.strokeRect(-.4, -.6, .8, 1.2); g.fillRect(.16, -.02, .12, .12); });
    if (paused || game.stage !== 'playing') {
      g.fillStyle = '#e4d6ae'; g.font = `${H * .22}px monospace`;
      g.fillText(game.stage === 'dead' ? 'R ↻' : game.stage === 'won' ? 'E ↗' : 'Ⅱ', W * .67, H * .34);
    }
  }, { ppm: 1000, gain: 0.9 });
  wrist.add(vitals.mesh); vitals.mesh.position.set(0, 0, 0.027);
  const lamp = new THREE.SpotLight('#e5e3c8', 10, 17, Math.PI / 6.5, 0.65, 1.2);
  lamp.position.set(0.12, -0.08, -0.05); camera.add(lamp);
  const lightTarget = new THREE.Object3D(); lightTarget.position.set(0, -0.15, -10); camera.add(lightTarget); lamp.target = lightTarget;

  const chipGeo = w.own(new THREE.BoxGeometry(0.07, 0.07, 0.07));
  const chipMats = ['#b5a57b', '#716044', '#c7c1a1'].map(color => w.own(new THREE.MeshLambertMaterial({ color })));
  function burst(event) {
    for (let i = 0; i < (event.killed ? 8 : 3); i++) {
      const m = new THREE.Mesh(chipGeo, chipMats[i % chipMats.length]);
      m.position.set(event.x || 0, (event.y || 0) + 0.25, event.z || 0); scene.add(m);
      const a = i * 2.39996; particles.push({ m, vx: Math.sin(a) * 1.5, vz: Math.cos(a) * 1.5, vy: 1.2 + (i % 3) * 0.35, life: 0.55 });
    }
  }
  const scarGeo = w.own(new THREE.BoxGeometry(.12, .018, .026));
  const scarMat = w.own(new THREE.MeshLambertMaterial({ color: '#614837' }));
  function creature(enemy) {
    const node = new THREE.Group(); scene.add(node);
    const body = w.vox(headcrabBody, 0, 0, 'S'); node.add(body);
    const legs = HEADCRAB.joints.map(j => {
      const joint = new THREE.Group(); node.add(joint); joint.position.set(...j.position);
      const limb = w.vox(() => headcrabLeg({ side: j.side, front: j.front }), 0, 0, 'S'); joint.add(limb);
      return { joint, side: j.side, front: j.front };
    });
    const scar = new THREE.Group(); body.add(scar);
    for (const [x, z, angle] of [[-.04, -.035, -.45], [.035, -.01, .55]]) {
      const chip = new THREE.Mesh(scarGeo, scarMat); chip.position.set(x, .444, z); chip.rotation.y = angle; scar.add(chip);
    }
    const result = { node, body, legs, scar }; creatures.set(enemy.id, result); return result;
  }

  const modal = () => !!root.querySelector('.liftpanel, .arcade, [data-modal]');
  const clearInput = () => { held.clear(); attackHeld = false; attackPulse = false; drag = null; };
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
  function releasePointer() { if (document.pointerLockElement === root) document.exitPointerLock?.(); }
  function leave() { if (closing) return; closing = true; clearInput(); releasePointer(); w.leave('esc'); }
  function keyDown(e) {
    if (office.level !== w || typing(e) || e.metaKey || e.ctrlKey || e.altKey || modal()) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') {
      if (locked || performance.now() < escapeGuardUntil) {
        e.preventDefault(); e.stopImmediatePropagation(); paused = true; clearInput(); escapeGuardUntil = performance.now() + 350; releasePointer(); return;
      }
      return; // the shared kit's second Escape returns to the lobby
    }
    if (!['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift',' ','e','f','p','r'].includes(k)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (k === 'p' && !e.repeat) { paused = !paused; clearInput(); if (paused) releasePointer(); return; }
    if (k === 'r' && !e.repeat) { game = respawn(game); yaw = game.yaw; pitch = 0.05; paused = false; clearInput(); return; }
    if (k === 'e' && game.stage === 'won' && !e.repeat) { leave(); return; }
    held.add(k);
  }
  function keyUp(e) { held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); }
  function blur() { if (!closing && office.level === w) paused = true; clearInput(); }
  function lockChange() {
    const hadLock = locked; locked = document.pointerLockElement === root; lockPending = false;
    clearInput();
    if (locked) paused = false;
    else if (hadLock && !closing) { paused = true; escapeGuardUntil = performance.now() + 350; }
  }
  function lockError() { lockDenied = true; lockPending = false; locked = false; }
  function interactiveTarget(e) { return e.target?.closest?.('button,a,input,textarea,select,.liftpanel,.arcade,[data-modal]'); }
  function pointerDown(e) {
    if (office.level !== w || e.button !== 0 || interactiveTarget(e) || modal()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (game.stage === 'dead' || game.stage === 'won') return;
    paused = false;
    if (locked) { attackHeld = true; return; }
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    if (!lockDenied && !lockPending && root.requestPointerLock) {
      lockPending = true;
      try { const requested = root.requestPointerLock(); requested?.catch(lockError); } catch { lockError(); }
    }
    // Mouse lock can take effect before its change event. Pointer capture is
    // only for fallback dragging and is invalid once the mouse is locked.
    if (!document.pointerLockElement) {
      try { root.setPointerCapture?.(e.pointerId); } catch { /* lock won the race */ }
    }
  }
  function pointerMove(e) {
    if (office.level !== w || paused || modal()) return;
    // Cancelling pointerdown suppresses compatibility mouse events during a
    // drag. Pointer lock supplies mouse deltas; fallback drags use PointerEvent.
    if (locked ? e.type !== 'mousemove' : e.type !== 'pointermove') return;
    let dx = 0, dy = 0;
    if (locked) { dx = e.movementX || 0; dy = e.movementY || 0; }
    else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); }
    else return;
    yaw -= dx * 0.0026; pitch = clamp(pitch + dy * 0.0023, -1.3, 1.3);
    e.stopImmediatePropagation();
  }
  function pointerUp(e) {
    if (e.button !== 0) return;
    if (!locked && drag?.moved < 5 && !lockPending) attackPulse = true;
    attackHeld = false; drag = null;
    if (!interactiveTarget(e)) e.stopImmediatePropagation();
  }
  function suppressWheel(e) { if (!interactiveTarget(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
  window.addEventListener('keydown', keyDown, true); window.addEventListener('keyup', keyUp, true); window.addEventListener('blur', blur);
  document.addEventListener('pointerlockchange', lockChange); document.addEventListener('pointerlockerror', lockError);
  document.addEventListener('mousemove', pointerMove, true);
  document.addEventListener('pointermove', pointerMove, true);
  root.addEventListener('pointerdown', pointerDown, true); root.addEventListener('pointerup', pointerUp, true);
  root.addEventListener('pointercancel', clearInput, true); root.addEventListener('wheel', suppressWheel, { capture: true, passive: false });
  w.own({ dispose() {
    closing = true; clearInput(); releasePointer();
    window.removeEventListener('keydown', keyDown, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', blur);
    document.removeEventListener('pointerlockchange', lockChange); document.removeEventListener('pointerlockerror', lockError); document.removeEventListener('mousemove', pointerMove, true);
    document.removeEventListener('pointermove', pointerMove, true);
  } });

  const result = w.run();
  const stop = office.stage.onFrame((dt) => {
    if (office.level !== w || closing) return;
    const blocked = modal();
    if (blocked && locked) { clearInput(); releasePointer(); }
    const active = !paused && !document.hidden && document.hasFocus() && !blocked;
    const previous = game, beforeX = game.x, beforeZ = game.z;
    if (active) game = step(game, {
      forward: Number(held.has('w') || held.has('ArrowUp')) - Number(held.has('s') || held.has('ArrowDown')),
      strafe: Number(held.has('d')) - Number(held.has('a')),
      yaw, pitch, jump: held.has(' '), attack: attackHeld || attackPulse || held.has('f'), interact: held.has('e'), sprint: held.has('Shift'),
    }, dt);
    if (active) {
      if (held.has('ArrowLeft')) yaw += dt * 1.7;
      if (held.has('ArrowRight')) yaw -= dt * 1.7;
      for (const event of game !== previous ? game.events : []) {
        if (event.type === 'hit') { hitUntil = game.time + 0.14; burst(event); w.sfx(event.killed ? 'squash' : 'sticky', { volume: event.killed ? .28 : .24 }); }
        else if (event.type === 'hurt') { hurtUntil = game.time + 0.28; w.sfx('sticky', { volume: 0.4 }); }
        else if (event.type === 'windup') w.sfx('printer-jam', { volume: 0.1 });
        else if (event.type === 'swing') w.sfx('sticky', { volume: 0.1 });
        else if (event.type === 'pickup' || event.type === 'checkpoint') w.sfx('coin', { volume: 0.25 });
        else if (event.type === 'power' || event.type === 'win') w.sfx('lift-ding', { volume: 0.35 });
      }
    }
    attackPulse = false;
    stepDistance += Math.hypot(game.x - beforeX, game.z - beforeZ);
    w.me.x = game.x; w.me.z = game.z; w.avatar.root.visible = false;
    const bob = reducedMotion || !game.grounded ? 0 : Math.sin(stepDistance * 7) * 0.012;
    camera.position.set(game.x, game.y + (PLAYER.eye || 1.55) + bob, game.z);
    camera.rotation.set(-pitch, yaw, 0, 'YXZ');
    const aspect = office.stage.size.w / office.stage.size.h;
    if (camera.aspect !== aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }

    const progress = game.swing ? clamp(game.swing.age / PLAYER.swingDuration, 0, 1) : 1;
    const strike = game.swing ? progress < 0.283 ? Math.sin(progress / 0.283 * Math.PI / 2) : Math.cos((progress - 0.283) / 0.717 * Math.PI / 2) : 0;
    hand.position.set(0.34 - strike * 0.4, -0.44 + strike * 0.12 + bob, -0.61 - strike * 0.11);
    hand.rotation.set(-0.18 - strike * 1.35, 0.28 - strike * 0.4, -0.22 - strike * 0.55);
    hand.visible = game.stage !== 'dead';
    crosshair.style.background = game.time < hitUntil ? '#ffd59b' : '#e6e2d2';
    crosshair.style.transform = `translate(-50%,-50%) scale(${game.time < hitUntil ? 2 : 1})`;
    crosshair.style.visibility = paused || game.stage !== 'playing' ? 'hidden' : 'visible';
    wrist.rotation.z = !reducedMotion && game.stage === 'playing' && game.time < hurtUntil ? Math.sin(game.time * 40) * 0.025 : 0.06;
    for (const enemy of game.enemies) {
      const c = creatures.get(enemy.id) || creature(enemy); c.node.visible = enemy.state !== 'dead';
      if (!c.node.visible) continue;
      c.node.position.set(enemy.x, enemy.y, enemy.z); c.node.rotation.y = enemy.heading || 0;
      const windup = enemy.state === 'windup', recoiling = enemy.state === 'knockback', airborne = enemy.state === 'leap';
      c.scar.visible = enemy.health === 1;
      c.body.position.y = windup ? -0.11 : 0; c.body.rotation.x = recoiling ? -.48 : airborne ? -0.2 : windup ? 0.12 : 0;
      c.body.rotation.z = recoiling ? Math.sin(game.time * 24) * .09 : 0;
      for (const leg of c.legs) {
        leg.joint.rotation.z = leg.side * (windup ? 0.42 : recoiling ? -.62 : airborne ? -0.38 : Math.sin(game.time * 13.2 + (leg.front ? 0 : Math.PI)) * 0.13);
        leg.joint.rotation.x = recoiling ? (leg.front ? -.9 : -.25) : airborne ? (leg.front ? -0.65 : 0.5) : 0;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; if (active) { p.life -= dt; p.vy -= 8 * dt; p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y = Math.max(0.035, p.m.position.y + p.vy * dt); }
      p.m.scale.setScalar(Math.max(0, p.life / 0.55)); if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); }
    }
    const status = `${game.health}:${game.stage}:${game.hasFuse}:${game.power}:${game.kills}:${paused}:${interactable(game)?.label}`;
    if (status !== lastStatus) { lastStatus = status; vitals.redraw(); }
    environment.update(game, paused, locked ? 'mouse' : lockDenied ? 'drag' : 'click');
  });
  w.own({ dispose: stop });
  w.fps = {
    get state() { return structuredClone(game); }, get paused() { return paused; }, get controls() { return { locked, lockDenied, yaw, pitch }; },
    get objective() { return objective(game); }, get nearby() { return interactable(game); }, map: LEVEL,
  };
  return result;
}
