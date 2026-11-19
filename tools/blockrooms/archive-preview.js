import * as THREE from 'three';
import { Avatar } from './world/avatar/rig.js';

// Photograph the game rig once per change of appearance, without an animation loop.
export function characterPreview() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(360, 472, false);
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(30, 360 / 472, 0.05, 30);
  scene.add(new THREE.HemisphereLight(0xfff4d6, 0x666959, 2.2));
  const light = new THREE.DirectionalLight(0xffedd2, 2.5);
  light.position.set(-3, 5, 5);
  scene.add(light);
  const photo = document.createElement('canvas');
  photo.width = 360;
  photo.height = 472;
  return {
    take(look) {
      const avatar = new Avatar(look, { seed: 'blockrooms-player' });
      avatar.root.rotation.y = -0.24;
      scene.add(avatar.root);
      try {
        const box = new THREE.Box3().setFromObject(avatar.root),
          center = box.getCenter(new THREE.Vector3()),
          size = box.getSize(new THREE.Vector3());
        const distance = (Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(Math.PI / 12))) * 1.1;
        camera.position.set(center.x, center.y + distance * 0.06, center.z + distance + size.z / 2);
        camera.lookAt(center);
        renderer.render(scene, camera);
        const ctx = photo.getContext('2d');
        ctx.clearRect(0, 0, photo.width, photo.height);
        ctx.drawImage(renderer.domElement, 0, 0);
        return photo;
      } finally {
        scene.remove(avatar.root);
        avatar.dispose();
      }
    },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
