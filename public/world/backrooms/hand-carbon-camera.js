import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { INVENTORY_MODELS, carbonGrip } from './inventory-items.js';
import { CHARGE_WINDOW, REAR_SLOT } from './carbon-camera.model.js';

const UNIT = .0145, SHEET_LENGTH = 6.25;
export function heldCarbonCamera(kit, lights, ambient, photo) {
  const body = new Batch(false);
  INVENTORY_MODELS['carbon-camera'].sculpt(body, UNIT);
  carbonGrip(body, UNIT);
  const mat = kit.surface({ vox: false });
  mat.transparent = true;
  const mesh = new THREE.Mesh(kit.geometry(body, lights, ambient), mat);
  mesh.name = 'held-carbon-camera';
  mesh.renderOrder = 10000;
  mesh.rotation.set(.25, -.19, -.035);

  const bars = new Batch(false), amber = lin('#ffb33b');
  for (let i = 0; i < 4; i++) {
    const x = (CHARGE_WINDOW.x + .44 + i * CHARGE_WINDOW.step) * UNIT;
    const y = CHARGE_WINDOW.y * UNIT, z = (CHARGE_WINDOW.z + .35) * UNIT;
    bars.quad([x-.32*UNIT,y-.26*UNIT,z],[x+.32*UNIT,y-.26*UNIT,z],
      [x+.32*UNIT,y+.26*UNIT,z-.046*UNIT],[x-.32*UNIT,y+.26*UNIT,z-.046*UNIT], amber);
  }
  const display = new THREE.Mesh(kit.geometry(bars, [], [1.35,1.16,.94]), mat);
  display.renderOrder = 10001; mesh.add(display);

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
    mesh, mat, hold: [.166,-.132,-.50],
    fitBounds: new THREE.Box3(new THREE.Vector3(-.084,0,-.10),new THREE.Vector3(.082,.20,.183)),
    update(dt, at, item, exposure) {
      display.geometry.setDrawRange(0, Math.min(4, item.charge ?? 0) * 6);
      if (shot !== exposure) { shot = exposure; feed = 0; }
      feed = Math.min(1, feed + dt / .53);
      sheet.visible = !!exposure;
      if (sheet.visible) {
        const progress = feed * feed * (3 - 2 * feed);
        sheet.position.set(0, REAR_SLOT.y*UNIT, REAR_SLOT.z*UNIT - (1-progress)*end);
        stock.uniforms.uTint.value.copy(mat.uniforms.uTint.value);
      }
      mesh.position.copy(at);
      if (exposure && feed < 1) mesh.position.z += .013*Math.sin(Math.min(1,feed*3)*Math.PI);
    },
  };
}
