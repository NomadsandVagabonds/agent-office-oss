import * as THREE from 'three';
import { Avatar } from './world/avatar/rig.js';
export function characterPreview(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0); host.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .05, 30);
  scene.add(new THREE.HemisphereLight(0xfff4d6, 0x41523d, 2.3));
  const light = new THREE.DirectionalLight(0xffedd2, 2); light.position.set(-3, 5, 5); scene.add(light);
  let avatar;
  const draw = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h || !avatar) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const box = new THREE.Box3().setFromObject(avatar.root), center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()), distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(Math.PI * 32 / 360)) * 1.2;
    camera.position.set(center.x + distance * .2, center.y + distance * .08, center.z + distance); camera.lookAt(center); camera.updateProjectionMatrix(); renderer.render(scene, camera);
  };
  const resize = new ResizeObserver(draw); resize.observe(host);
  return { show(look) { if (avatar) { scene.remove(avatar.root); avatar.dispose(); } avatar = new Avatar(look, { seed: 'blockrooms-player' }); avatar.root.rotation.y = -.18; scene.add(avatar.root); draw(); },
    dispose() { resize.disconnect(); avatar?.dispose(); renderer.dispose(); } };
}
