// Flood-Mark Hall: an opt-in room study. Geometry, tide and recovery are local
// to this builder; nothing changes the production room deck or player physics.
import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from './kit.js';
import { planFloodMark, floodFloor, floodRefuge, floodPhase, floodExposure } from './flood-mark-layout.js';

export function buildFloodMark(c) {
  const plan = planFloodMark(c.room), { W, D } = plan;
  c.shell({ floor: false, sockets: false });
  const stone = c.kit.tex.custom('flood-stone', 64, 64, (g) => {
    g.fillStyle = '#b8b49d'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#999b88'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64);
    for (let n = 0; n < 180; n++) { g.fillStyle = n % 3 ? '#aba991' : '#c3bfa8'; g.fillRect((n * 37) % 64, (n * 19 + Math.floor(n / 7)) % 64, 1, 1); }
  });
  const floor = c.mapped('flood-stone', stone), algae = lin('#535d43'), side = lin('#737761');
  for (let k = 0; k < plan.cells.length; k++) {
    const b = plan.cells[k], rgb = b.y < -.35 ? [0.46, .53, .40] : b.raised ? WHITE : [.83, .85, .73];
    floor.quad([b.x0, b.y, b.z1], [b.x1, b.y, b.z1], [b.x1, b.y, b.z0], [b.x0, b.y, b.z0], rgb,
      [[b.x0 * 2.5, b.z1 * 2.5], [b.x1 * 2.5, b.z1 * 2.5], [b.x1 * 2.5, b.z0 * 2.5], [b.x0 * 2.5, b.z0 * 2.5]]);
    // Exposed risers only. Rendering and floor sampling share this exact grid.
    const i = k % plan.nx, j = Math.floor(k / plan.nx);
    for (const [di, dj, axis] of [[1, 0, 'x'], [0, 1, 'z']]) {
      if (i + di >= plan.nx || j + dj >= plan.nz) continue;
      const n = plan.cells[k + di + dj * plan.nx];
      if (Math.abs(n.y - b.y) < 1e-8) continue;
      const low = Math.min(n.y, b.y), high = Math.max(n.y, b.y), col = low < -.18 ? algae : side;
      if (axis === 'x') c.flat.box(b.x1 - .005, low, b.z0, b.x1 + .005, high, b.z1, col, { skip: '-y+y' });
      else c.flat.box(b.x0, low, b.z1 - .005, b.x1, high, b.z1 + .005, col, { skip: '-y+y' });
    }
  }
  c.rt.floorY = (x, z) => floodFloor(plan, x, z);
  // The same old wall finish continues below the tide, with a continuous stain
  // that makes the maximum water level legible on every solid vertical surface.
  for (const s of ['left', 'right']) {
    c.wbox(s, 0, D, -.94, .04, 0, .035, algae);
    c.wbox(s, 0, D, .13, .17, .006, .02, lin('#5e6549'));
  }
  const damp = c.kit.tex.custom('flood-damp', 128, 64, g => {
    // Irregular old plaster damage, distinct from the straight present-day
    // tide line. It recurs on both walls rather than decorating the route.
    for (let n = 0; n < 130; n++) {
      const x = (n * 47) % 128, y = (n * 29 + Math.floor(n / 4)) % 64;
      if ((x - 64) ** 2 / 3800 + (y - 32) ** 2 / 650 > 1) continue;
      g.fillStyle = n % 3 ? '#939c7e' : '#7c8a70';
      g.fillRect(x, y, 2 + n % 8, 1 + n % 5);
    }
    for (let n = 0; n < 11; n++) {
      const x = 10 + (n * 23) % 107, y = 17 + (n * 7) % 25;
      g.fillStyle = n % 2 ? '#b3ba97' : '#899676';
      g.fillRect(x, y, 1 + n % 2, 64 - y);
    }
  }, { clamp: true });
  for (const [side, z] of [['left', 3.6], ['right', -3.6]]) c.hang(c.mapped('flood-damp', damp, { cutout: true }), side, z, .9, 3.2, 1.6, null, WHITE, .025);
  for (const p of [{ x: -6.3, z: 5.4 }, { x: 6.3, z: 5.4 }, { x: -6.3, z: -4.8 }, { x: 6.3, z: -4.8 }]) {
    const x = p.x * W / 17.8, z = p.z * D / 23.8;
    c.pillar(x, z, .64, .64);
    c.flat.box(x - .328, -.9, z - .328, x + .328, .14, z + .328, algae);
    c.flat.box(x - .33, .14, z - .33, x + .33, .18, z + .33, lin('#687052'));
    for (let n = 0; n < 3; n++) {
      const off = -.23 + n * .19, top = .48 + n * .24, w = .018 + (n % 2) * .012, mineral = lin(n % 2 ? '#9ca886' : '#b4bb99');
      for (const side of [-1, 1]) {
        c.flat.box(x + off, .19, z + side * .334 - .004, x + off + w, top, z + side * .334 + .004, mineral);
        c.flat.box(x + side * .334 - .004, .19, z + off, x + side * .334 + .004, top, z + off + w, mineral);
      }
    }
  }
  // Recognizable furniture left at the waterline: no jokes, prompts or new props.
  for (const [type, x, z, rot] of [['cabinet', 7.3, -7.5, Math.PI / 2], ['desk', -6.7, -7.6, .08], ['chair', -5.6, -7.3, -.5]]) {
    if (c.hasProp(type) && c.env.catalogue.geo(type)) c.prop(type, x * W / 17.8, z * D / 23.8,
      { y: -.72, rot, shadow: false, tint: [.76, .83, .66] });
  }
  // Short, partial rails are useful depth cues, but never a continuous guide
  // across the hidden path. The dry islands remain visible at high water.
  const iron = lin('#626a5b');
  for (const b of plan.islands) for (const sx of [-1, 1]) {
    const x = b.x + sx * 1.15;
    for (const z of [b.z - .85, b.z + .85]) c.flat.box(x - .028, .18, z - .028, x + .028, .72, z + .028, iron);
    c.flat.box(x - .03, .68, b.z - .88, x + .03, .73, b.z + .88, iron);
    c.solid(x - .03, b.z - .88, x + .03, b.z + .88, { keep: true });
  }
  const waterBatch = new Batch(), wb = plan.waterBounds;
  waterBatch.grid([wb.x0, 0, wb.z0], [0, 0, 1], [1, 0, 0], ticks(wb.z1 - wb.z0, 1, 0), ticks(W, 1, 0), null, lin('#455c4b'));
  const uniforms = { uTime: { value: 0 }, uDim: c.rt.u.dim, uTorch: c.kit.shared.uTorch };
  const water = new THREE.Group();
  c.add(water);
  c.after.push(() => {
    const geometry = c.kit.geometry(waterBatch, c.rt.lights, c.rt.amb);
    const material = c.kit.own(new THREE.ShaderMaterial({
      uniforms, side: THREE.DoubleSide,
      vertexShader: `attribute vec3 aLit; attribute vec3 aAlb; varying vec3 vLit; varying vec3 vAlb; varying vec3 vLocal; varying vec3 vView;
        void main(){vLit=aLit;vAlb=aAlb;vLocal=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vView=mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uTime; uniform float uDim; uniform float uTorch; varying vec3 vLit; varying vec3 vAlb; varying vec3 vLocal; varying vec3 vView;
        void main(){vec2 p=vLocal.xz;float a=sin(p.x*2.1+p.y*.7+uTime*.38);float b=sin(p.y*2.8-p.x*.4-uTime*.27);
          float rip=.88+.055*a+.045*b;vec3 col=vLit*uDim*rip;
          float d=length(vView);float cone=smoothstep(.6,.97,-vView.z/max(d,.001));col+=vAlb*uTorch*cone/(1.0+d*d*.2)*.35;
          vec2 q=mod(p+vec2(a*.06,b*.04),vec2(3.2,4.8));float reflection=pow(max(0.0,1.0-abs(q.x-1.6)/.18),3.0)*smoothstep(.9,1.2,q.y)*(1.0-smoothstep(2.3,2.6,q.y));
          col+=vec3(.14,.15,.105)*reflection*(.52+.18*a)*uDim;gl_FragColor=vec4(col,1.0);}`,
    }));
    water.add(new THREE.Mesh(geometry, material));
  });

  const state = c.rt.floodMark = {
    plan, time: 0, phase: floodPhase(0), checkpoint: { ...plan.docks[0] }, exposure: 0, recoveries: 0,
    setTime(time) { if (Number.isFinite(time)) { this.time = Math.max(0, time); this.phase = floodPhase(this.time); water.position.y = this.phase.water; uniforms.uTime.value = this.time; } },
  };
  state.setTime(0);
  let lastPhase = state.phase.phase, splash = 0;
  const previousLeave = c.rt.onLeave;
  c.rt.onLeave = () => {
    previousLeave?.(); state.exposure = 0; splash = 0; c.rt.footstep = 'step';
    if (c.env.player) { c.env.player.me.slow = 1; c.env.player.me.sinkTo = 0; }
  };
  c.tick((dt, t, me) => {
    if (!me.inside || me.world.frozen) return;
    state.setTime(state.time + dt);
    if (state.phase.phase !== lastPhase) {
      lastPhase = state.phase.phase;
      const at = c.toWorld(0, -D / 2 + 2);
      c.env.play(lastPhase === 'draining' ? 'glug' : 'creak', at.x, at.z, 18);
    }
    const refuge = floodRefuge(plan, me.x, me.z);
    if (refuge) state.checkpoint = { ...refuge };
    const wet = floodExposure(plan, state.phase, me.x, me.z);
    c.rt.footstep = wet.wet ? 'wade' : 'step';
    if (wet.wet) me.world.slow = wet.deep ? .34 : .78;
    state.exposure = wet.deep ? state.exposure + dt : Math.max(0, state.exposure - dt * 3);
    if (state.exposure > .15) {
      me.world.sinkTo = Math.min(.18, state.exposure * .12);
      c.env.interfere(Math.min(.22, state.exposure * .14));
      splash -= dt;
      if (splash <= 0) { const at = c.toWorld(me.x, me.z); c.env.play('wade', at.x, at.z, 5); splash = .4; }
    }
    if (state.exposure > 1.8 && c.env.player) {
      const home = state.checkpoint, at = c.toWorld(home.x, home.z), body = c.env.player.me;
      c.env.player.warp(at.x, at.z);
      body.vx = body.vz = body.drop = body.dropV = body.sink = body.sinkTo = 0;
      body.slow = 1; state.exposure = 0; state.recoveries++;
      c.env.interfere(.42); c.env.play('wade', at.x, at.z, 5);
    }
  });
  return state;
}
