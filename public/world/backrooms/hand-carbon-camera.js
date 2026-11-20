import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { INVENTORY_MODELS, carbonGrip } from './inventory-items.js';
import { CHARGE_WINDOW, REAR_SLOT, SIGHT_CENTER } from './carbon-camera.model.js';
import { modeDisplay } from './carbon-display.js';

const UNIT = .0115, SHEET_LENGTH = 6.25;
export function heldCarbonCamera(kit, lights, ambient, photo) {
  const body = new Batch(false);
  INVENTORY_MODELS['carbon-camera'].sculpt(body, UNIT);
  carbonGrip(body, UNIT);
  const mat = kit.surface({ vox: false });
  mat.transparent = true;
  const mesh = new THREE.Mesh(kit.geometry(body, lights, ambient), mat);
  mesh.name = 'held-carbon-camera';
  mesh.renderOrder = 10000;
  const finder = new THREE.Object3D();
  finder.name = 'carbon-wire-centre'; finder.position.set(0,SIGHT_CENTER.y*UNIT,SIGHT_CENTER.z*UNIT); mesh.add(finder);
  const carry = new THREE.Euler(.45, -.46, -.13);
  mesh.rotation.copy(carry);

  const bars = new Batch(false), amber = lin('#ffb33b');
  for (let i = 0; i < 4; i++) {
    const x = (CHARGE_WINDOW.x + .44 + i * CHARGE_WINDOW.step) * UNIT;
    const y = CHARGE_WINDOW.y * UNIT, z = (CHARGE_WINDOW.z + .35) * UNIT;
    bars.quad([x-.32*UNIT,y-.26*UNIT,z],[x+.32*UNIT,y-.26*UNIT,z],
      [x+.32*UNIT,y+.26*UNIT,z-.046*UNIT],[x-.32*UNIT,y+.26*UNIT,z-.046*UNIT], amber);
  }
  const display = new THREE.Mesh(kit.geometry(bars, [], [1.35,1.16,.94]), mat);
  display.renderOrder = 10001; mesh.add(display);
  const led=modeDisplay(kit,UNIT);mesh.add(led.mesh);

  // A rigid sheet slides under the opaque body. Its wheels and wide white margin emerge first.
  const film = new Batch(false), w = 3.66*UNIT, end = SHEET_LENGTH*UNIT;
  film.quad([-w,0,end],[w,0,end],[w,0,0],[-w,0,0]);
  const stock = kit.surface({ map: photo, side: THREE.DoubleSide });
  stock.transparent = true;
  const sheet = new THREE.Mesh(kit.geometry(film, [], [1,1,1]), stock);
  sheet.name = 'carbon-camera-positive';
  sheet.renderOrder = 10002;
  sheet.visible = false;
  mesh.add(sheet);
  let shot = 0, feed = 0;
  return {
    mesh, mat, hold: [.167,-.170,-.46],
    fitBounds: new THREE.Box3(new THREE.Vector3(-.084,0,-.10),new THREE.Vector3(.082,.20,.183)),
    update(dt, at, item, exposure, lift = 0, status, printProgress = 0) {
      display.geometry.setDrawRange(0, Math.min(4, item.charge ?? 0) * 6);
      led.show(status || (item.charge===0?'BATT':exposure?'PASTE':'COPY'));
      if (shot !== exposure) { shot = exposure; feed = 0; }
      feed = Math.min(1, feed + dt / .34);
      sheet.visible = !!exposure;
      if (sheet.visible) {
        const drawn=.20+.80*(1-(1-feed)**2);
        const rewind=THREE.MathUtils.smoothstep(printProgress,.36,.94);
        const progress=drawn*(1-rewind);
        sheet.position.set(0, REAR_SLOT.y*UNIT, REAR_SLOT.z*UNIT - (1-progress)*end);
        // Keep the hidden end inside the housing as the rollers angle the emulsion toward the eye.
        sheet.rotation.x=.17*progress;
        stock.uniforms.uTint.value.copy(mat.uniforms.uTint.value).multiplyScalar(.85).addScalar(.23);
      }
      const pitch = .19;
      mesh.rotation.set(carry.x + (pitch-carry.x)*lift, carry.y*(1-lift), carry.z*(1-lift));
      // Locate the centre of the physical wire aperture on the optical axis at full lift.
      // On a narrow picture the lowered prop is scaled around the pockets. Bring that smaller
      // model up to the eye so its lettering stays legible through the finder as well.
      const eyeY = -mesh.scale.y*(finder.position.y*Math.cos(pitch) - finder.position.z*Math.sin(pitch));
      const sightDepth=Math.max(.18,.40*mesh.scale.y);
      mesh.position.set(at.x*(1-lift), at.y+(eyeY-at.y)*lift, at.z+(-sightDepth-at.z)*lift);
      if (exposure && feed < 1) mesh.position.z += .013*Math.sin(Math.min(1,feed*3)*Math.PI);
    },
  };
}
