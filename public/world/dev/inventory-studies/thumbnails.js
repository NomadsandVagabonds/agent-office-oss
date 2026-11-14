// Native Office voxel props, rendered once for the inventory design studies.
import * as THREE from 'three';
import { voxObject } from '../../vox/material.js';
import { INVENTORY_MODELS } from '../../backrooms/inventory-items.js';
import { Vox, M } from '../../vox/vox.js';

function camera() {
  const v = new Vox(), plastic = M('#444c43',2), edge = M('#72786b',1), black = M('#1f2926',1);
  v.rbox(-6,1,-6,6,9,8,1,plastic);v.box(-5,2,7,5,8,9,edge);
  v.rbox(-4,2,-11,4,8,-6,1,black);v.box(-3,3,-12,3,7,-11,M('#8b998e',0));
  v.box(-2,9,-2,3,11,7,black);v.box(-8,4,-2,-6,7,6,edge);v.box(-8,5,-1,-7,6,5,M('#c5c8ac',0));return v;
}
export function renderItemThumbnails() {
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});
  renderer.setSize(144,144);renderer.setClearColor(0x000000,0);renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffedc7','#73765c',2));
  const key = new THREE.DirectionalLight('#fff0cd',3);key.position.set(-3,6,-4);scene.add(key);
  const cameraView = new THREE.OrthographicCamera(-.5,.5,.5,-.5,.01,20), images = {};
  for (const [type, model] of Object.entries({...INVENTORY_MODELS,camera})) {
    const mesh = voxObject(model,{lod:false});mesh.rotation.y=.15;scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh), center=box.getCenter(new THREE.Vector3());
    const size=box.getSize(new THREE.Vector3()), extent=Math.max(size.x,size.y,size.z)*.82;
    cameraView.left=cameraView.bottom=-extent;cameraView.right=cameraView.top=extent;cameraView.updateProjectionMatrix();
    cameraView.position.copy(center).add(new THREE.Vector3(2,3,-3));cameraView.lookAt(center);
    cameraView.updateMatrixWorld();
    // Frame the projected prop, rather than leaving padding based on its
    // longest world axis. A torch and a flat paper stack should read equally.
    let projected = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x,y,z).project(cameraView);
      projected = Math.max(projected, Math.abs(p.x), Math.abs(p.y));
    }
    const fit = extent * projected / .85;
    cameraView.left=cameraView.bottom=-fit;cameraView.right=cameraView.top=fit;cameraView.updateProjectionMatrix();
    renderer.render(scene,cameraView);images[type]=renderer.domElement.toDataURL('image/png');scene.remove(mesh);
    mesh.traverse(o=>o.geometry?.dispose());
  }
  renderer.dispose();renderer.forceContextLoss();return images;
}
