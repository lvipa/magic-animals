/** Standalone art review for the unapproved Milo study. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const clipButtons = [...document.querySelectorAll('[data-clip]')];
const angleButtons = [...document.querySelectorAll('[data-angle]')];
const toggle = document.querySelector('#toggle');
const scrub = document.querySelector('#scrub');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#718189');
scene.add(new THREE.HemisphereLight('#ffffff', '#586171', 2));
for (const [color, intensity, position] of [
  ['#fff1e0', 3.2, [-3, 5, 6]],
  ['#cedfff', 1.5, [3, 2, 3]],
  ['#efe0ff', 1.0, [2, 4, -4]],
]) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(...position);
  scene.add(light);
}
const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
camera.position.set(0, 0.2, 4.4);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enablePan = false;
orbit.minDistance = 2.5;
orbit.maxDistance = 8;
orbit.target.set(0, 0, 0);
orbit.update();

function resize() {
  const width = Math.max(stage.clientWidth, 1);
  const height = Math.max(stage.clientHeight, 1);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let mixer;
let clips;
let activeClip;
let activeAction;
let playing = false;
let dragging = false;
const clock = new THREE.Clock();

function chooseClip(name) {
  if (!mixer) return;
  mixer.stopAllAction();
  activeClip = clips.find(clip => clip.name === name);
  activeAction = mixer.clipAction(activeClip).reset().play();
  mixer.setTime(0);
  scrub.value = '0';
  playing = true;
  toggle.textContent = 'Пауза';
  clipButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.clip === name)));
}
clipButtons.forEach(button => button.addEventListener('click', () => chooseClip(button.dataset.clip)));
toggle.addEventListener('click', () => {
  if (!mixer) return;
  playing = !playing;
  toggle.textContent = playing ? 'Пауза' : 'Продолжить';
});
scrub.addEventListener('pointerdown', () => { dragging = true; });
for (const event of ['pointerup', 'pointercancel', 'change']) {
  scrub.addEventListener(event, () => { dragging = false; });
}
scrub.addEventListener('input', () => {
  if (!mixer || !activeClip) return;
  playing = false;
  toggle.textContent = 'Продолжить';
  mixer.setTime(activeClip.duration * Number(scrub.value) / 1000);
});
angleButtons.forEach(button => button.addEventListener('click', () => {
  const radians = Number(button.dataset.angle) * Math.PI / 180;
  camera.position.set(Math.sin(radians) * 4.4, .2, Math.cos(radians) * 4.4);
  orbit.update();
}));

async function load() {
  try {
    const response = await fetch('./milo-hybrid-motion-WIP.glb');
    if (!response.ok) throw new Error(`GLB HTTP ${response.status}`);
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    const size = box.getSize(new THREE.Vector3());
    if (box.isEmpty() || !Number.isFinite(size.length()) || !size.length()) {
      throw new Error('GLB does not contain a visible model');
    }
    const scale = 1.8 / Math.max(size.x, size.y, size.z);
    const root = new THREE.Group();
    root.scale.setScalar(scale);
    root.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-scale));
    root.add(gltf.scene);
    scene.add(root);
    mixer = new THREE.AnimationMixer(gltf.scene);
    clips = gltf.animations;
    if (!clips.length) throw new Error('GLB has no animation clips');
    chooseClip('Wave_WIP');
    status.textContent = 'Черновик загружен. Поверните модель мышью или пальцем.';
    window.__miloReview = {
      clips: clips.map(clip => clip.name),
      skinned: gltf.scene.getObjectsByProperty('type', 'SkinnedMesh').length,
    };
  } catch (error) {
    status.textContent = `Не удалось открыть черновик: ${error.message}`;
    window.__miloReviewError = String(error);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .1);
  if (mixer && playing) mixer.update(delta);
  if (activeAction && !dragging && playing) {
    scrub.value = String(Math.round(1000 * activeAction.time / activeClip.duration));
  }
  orbit.update();
  renderer.render(scene, camera);
}
animate();
load();
