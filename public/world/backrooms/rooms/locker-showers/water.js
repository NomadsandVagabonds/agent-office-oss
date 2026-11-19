// One shallow, reflective sheet for this room, not one render pass per puddle.
// Mirrored-camera/oblique-near-plane method, as documented by Three's Reflector:
// https://threejs.org/docs/#examples/en/objects/Reflector
import * as THREE from 'three';

// Several changing rooms can coexist round a way down. Never reflect a reflection.
let reflecting = false;
const SIZE = 512;
const BIAS = new THREE.Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);

export function showerWater(c, batch, tex) {
  const group = new THREE.Group(), time = {value:0};
  group.name = 'changing-water'; c.add(group);
  c.tick((dt,t) => {time.value=t;});
  c.after.push(() => {
    const geo = c.kit.geometry(batch,c.rt.lights,c.rt.amb,c.rt.lighting);
    if (!geo) return;
    const projection = new THREE.Matrix4(), ready = {value:0};
    const mat = c.kit.surface({map:tex,room:c.rt.u,alpha:.79,wet:.8,
      side:THREE.DoubleSide,flick:geo.userData.flick,banks:geo.userData.banks});
    const target = mat.patchNode ? null : c.kit.own(new THREE.WebGLRenderTarget(SIZE,SIZE,{
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
      generateMipmaps:false,depthBuffer:true,stencilBuffer:false,samples:0,
    }));
    if (target) target.texture.name = 'changing-room-reflection';
    // Avoid Three's extra back-face pass for transparent DoubleSide materials.
    mat.forceSinglePass = true;
    Object.assign(mat.uniforms,{
      uChangingTime:time,uChangingReflection:{value:target?.texture || null},
      uChangingReflectionMatrix:{value:projection},uChangingReflectionReady:ready,
    });
    let disposed=false;
    if (mat.patchNode) {
      let refl = null;
      const rippleOf = ({ T, localPos, f, shared }) => {
        if (shared.changingRipple) return shared.changingRipple;
        const { vec2, sin, cos } = T;
        const p = localPos().xz, t = f('uChangingTime');
        shared.changingLocal = p;
        shared.changingTime = t;
        shared.changingRipple = vec2(
          sin(p.x.mul(13).add(t.mul(.7)).add(sin(p.y.mul(2)))),
          cos(p.y.mul(17).sub(t.mul(.55)).add(cos(p.x.mul(3)))),
        ).mul(.028);
        return shared.changingRipple;
      };
      mat.patchNode({
        init({ T }) {
          refl = T.reflector({ resolutionScale: 0.5, bounces: false });
          refl.target.position.set(0, batch.pos[1], 0);
          refl.target.rotation.x = -Math.PI / 2;
          group.add(refl.target);
          c.kit.own(refl);
          const origUpdate = refl.reflector.updateBefore.bind(refl.reflector);
          refl.reflector.updateBefore = (frame) => {
            if (disposed) return;
            const torch = mat.uniforms.uTorch, camLamp = mat.uniforms.uCameraLamp;
            const tv = torch.value, cv = camLamp.value;
            torch.value = 0; camLamp.value = 0;
            try {
              const res = origUpdate(frame);
              ready.value = refl.reflector.hasOutput ? 1 : 0;
              return res;
            } finally {
              torch.value = tv; camLamp.value = cv;
            }
          };
        },
        uv(ctx) {
          const { vec2 } = ctx.T;
          const r = rippleOf(ctx);
          return ctx.shared.changingLocal.div(1.6).add(r.mul(.13)).add(vec2(ctx.shared.changingTime.mul(.004), 0));
        },
        wetNormal(ctx) {
          const { vec4, normalize, modelViewMatrix, varying } = ctx.T;
          const r = rippleOf(ctx);
          const vx = varying(normalize(modelViewMatrix.mul(vec4(1, 0, 0, 0)).xyz), 'vChX');
          const vz = varying(normalize(modelViewMatrix.mul(vec4(0, 0, 1, 0)).xyz), 'vChZ');
          return normalize(ctx.wn.add(vx.mul(r.x)).add(vz.mul(r.y)));
        },
        color(ctx) {
          const { vec2, vec3, float, sin, pow, max, abs, dot, clamp, mix, normalize, screenUV } = ctx.T;
          const r = rippleOf(ctx);
          const p = ctx.shared.changingLocal, t = ctx.shared.changingTime;
          refl.uvNode = clamp(screenUV.flipX().add(r.mul(.055)), vec2(.001), vec2(.999));
          const valid = ctx.f('uChangingReflectionReady');
          const fresnel = pow(max(float(1).sub(clamp(abs(dot(ctx.normal, normalize(ctx.viewPos.negate()))), 0, 1)), 0), 3);
          const reflectionAmount = mix(.24, .78, fresnel).mul(valid);
          ctx.c.assign(mix(ctx.c.mul(vec3(.79, 1.06, 1.04)), refl.rgb.mul(vec3(.94, 1.0, .98)), reflectionAmount));
          const fineRipple = pow(max(0, sin(p.x.mul(19).add(p.y.mul(13)).sub(t.mul(1.2)))), 36);
          ctx.c.addAssign(ctx.vLit.mul(fineRipple.mul(.025)));
          ctx.alpha.assign(mix(ctx.uAlpha, .96, fresnel.mul(valid)));
        },
      });
    } else {
    mat.vertexShader = `uniform mat4 uChangingReflectionMatrix;
varying vec4 vChangingReflection;
varying vec2 vChangingLocal;
varying vec3 vChangingX;
varying vec3 vChangingZ;
` + mat.vertexShader.replace('void main() {',`void main() {
  vChangingLocal = position.xz;
  vChangingReflection = uChangingReflectionMatrix * modelMatrix * vec4(position,1.0);
  vChangingX = normalize((modelViewMatrix * vec4(1.0,0.0,0.0,0.0)).xyz);
  vChangingZ = normalize((modelViewMatrix * vec4(0.0,0.0,1.0,0.0)).xyz);`);
    mat.fragmentShader = `uniform float uChangingTime;
uniform sampler2D uChangingReflection;
uniform float uChangingReflectionReady;
varying vec4 vChangingReflection;
varying vec2 vChangingLocal;
varying vec3 vChangingX;
varying vec3 vChangingZ;
vec2 changingRipple() {
  return vec2(
    sin(vChangingLocal.x*13.0+uChangingTime*.7+sin(vChangingLocal.y*2.0)),
    cos(vChangingLocal.y*17.0-uChangingTime*.55+cos(vChangingLocal.x*3.0))
  ) * .028;
}
` + mat.fragmentShader
      .replace('texture2D(map, vUv)',
        'texture2D(map, vChangingLocal / 1.6 + changingRipple() * .13 + vec2(uChangingTime*.004,0.0))')
      .replace('vec3 wn = normal;',
        'vec2 ripple = changingRipple(); vec3 wn = normalize(normal + vChangingX*ripple.x + vChangingZ*ripple.y);')
      .replace('gl_FragColor = vec4(c, uAlpha);',`
  vec2 reflectionUv = vChangingReflection.xy / max(vChangingReflection.w,.0001);
  reflectionUv += changingRipple() * .055;
  float valid = uChangingReflectionReady * step(.0001,vChangingReflection.w);
  valid *= step(0.0,reflectionUv.x)*step(reflectionUv.x,1.0)*step(0.0,reflectionUv.y)*step(reflectionUv.y,1.0);
  vec3 reflected = texture2D(uChangingReflection,clamp(reflectionUv,vec2(.001),vec2(.999))).rgb;
  float fresnel = pow(1.0-clamp(abs(dot(normal,normalize(-vView))),0.0,1.0),3.0);
  float reflectionAmount = mix(.24,.78,fresnel)*valid;
  c = mix(c*vec3(.79,1.06,1.04),reflected*vec3(.94,1.0,.98),reflectionAmount);
  float fineRipple = pow(max(0.0,sin(vChangingLocal.x*19.0+vChangingLocal.y*13.0-uChangingTime*1.2)),36.0);
  c += fineRipple*.025*vLit;
  gl_FragColor = vec4(c,mix(uAlpha,.96,fresnel*valid));`);
    }

    const mesh = new THREE.Mesh(geo,mat); mesh.name='changing-water-sheet';
    mesh.renderOrder=4; group.add(mesh);
    const camera = new THREE.PerspectiveCamera(), plane = new THREE.Plane();
    const localPlane = new THREE.Plane(new THREE.Vector3(0,1,0),-batch.pos[1]);
    const viewPlane = new THREE.Plane(), eye = new THREE.Vector3(), forward = new THREE.Vector3(), aim = new THREE.Vector3();
    const clip = new THREE.Vector4(), corner = new THREE.Vector4();
    const viewport = new THREE.Vector4();
    c.kit.own({dispose(){disposed=true;ready.value=0;mesh.onBeforeRender=()=>{};}});

    mesh.onBeforeRender = (renderer,renderScene,view) => {
      if (disposed || reflecting || renderer?.isWebGPURenderer || !view?.isPerspectiveCamera || !renderer?.getRenderTarget) return;
      // The world scene excludes the picture's HUD and held-item overlay. Its
      // parent can translate a whole connected part; use full matrixWorlds.
      const scene = c.world?.scene || renderScene;
      if (!scene) return;
      mesh.updateWorldMatrix(true,false); view.updateWorldMatrix(true,false);
      plane.copy(localPlane).applyMatrix4(mesh.matrixWorld);
      eye.setFromMatrixPosition(view.matrixWorld);
      if (plane.distanceToPoint(eye) <= .015) {ready.value=0;return;}
      camera.position.copy(eye).addScaledVector(plane.normal,-2*plane.distanceToPoint(eye));
      view.getWorldDirection(forward); forward.reflect(plane.normal);
      camera.up.setFromMatrixColumn(view.matrixWorld,1).normalize().reflect(plane.normal);
      camera.lookAt(aim.copy(camera.position).add(forward));
      camera.near=view.near;camera.far=view.far;camera.layers.mask=view.layers.mask;
      camera.updateMatrixWorld(); camera.projectionMatrix.copy(view.projectionMatrix);
      // Reflect an asymmetric camera frustum too (split/offset views).
      const p=camera.projectionMatrix.elements; p[8]*=-1;p[12]*=-1;
      projection.copy(BIAS).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
      viewPlane.copy(plane).applyMatrix4(camera.matrixWorldInverse);
      clip.set(viewPlane.normal.x,viewPlane.normal.y,viewPlane.normal.z,viewPlane.constant);
      corner.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
      const divisor=clip.dot(corner);
      if (Math.abs(divisor)<.00001) {ready.value=0;return;}
      clip.multiplyScalar(2/divisor);
      p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.002;p[14]=clip.w;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      const previousTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0;
      // getViewport() is the canvas's CSS viewport, NOT the active composer's
      // framebuffer viewport. Restoring it here would stretch the water over
      // walls whenever the VHS target and the browser have different sizes.
      renderer.getCurrentViewport(viewport);
      const xr=renderer.xr.enabled,shadows=renderer.shadowMap.autoUpdate;
      const visible=group.visible;
      // These shared lamps are camera-space effects. They would become a
      // second, underwater torch in the reflected view; only room light belongs there.
      const torch=mat.uniforms.uTorch,camLamp=mat.uniforms.uCameraLamp;
      const torchValue=torch.value,camValue=camLamp.value;
      reflecting=true;group.visible=false;ready.value=0;
      try {
        renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;
        torch.value=0;camLamp.value=0;
        renderer.setRenderTarget(target);renderer.state.setScissorTest(false);
        renderer.state.buffers.depth.setMask(true);
        // Clear explicitly: the caller may be a composer with autoClear disabled.
        renderer.clear();renderer.render(scene,camera);ready.value=1;
      } finally {
        torch.value=torchValue;camLamp.value=camValue;
        group.visible=visible;reflecting=false;
        renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadows;
        renderer.setRenderTarget(previousTarget,face,mip);
        // setRenderTarget restores that target's scissor; leave the canvas's
        // logical viewport/scissor settings untouched. A camera can also have
        // its own framebuffer viewport (e.g. a split view).
        renderer.state.viewport(viewport);
      }
    };
  });
  return {group,time};
}
