/** Standalone art review for the unapproved Milo study. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const clipButtons = [...document.querySelectorAll('[data-clip]')];
const angleButtons = [...document.querySelectorAll('[data-angle]')];
const modelButtons = [...document.querySelectorAll('[data-model]')];
const versions = {
  original: { file: 'milo-hybrid-motion-WIP.glb', label: 'Исходная проба' },
  garment: { file: 'milo-garment-deformation-WIP.glb', label: 'Проба нового рукава' },
};
const modelBytes = new Map();
async function getModelBytes(file) {
  if (!modelBytes.has(file)) {
    const pending = fetch(`./${file}?review=4`, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`GLB HTTP ${response.status}`);
      return response.arrayBuffer();
    }).catch(error => { modelBytes.delete(file); throw error; });
    modelBytes.set(file, pending);
  }
  return modelBytes.get(file);
}
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
let modelRoot;
let modelScene;
let loading = false;
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

function disposeModel(root) {
  const textures = new Set();
  const materials = new Set();
  root.traverse(object => {
    object.geometry?.dispose();
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
}

async function load(version = 'garment') {
  if (loading) return;
  loading = true;
  modelButtons.forEach(button => { button.disabled = true; });
  const previous = { name: activeClip?.name || 'Wave_WIP',
    fraction: activeAction && activeClip ? activeAction.time / activeClip.duration : 0,
    playing: modelRoot ? playing : true };
  status.textContent = 'Загружаю выбранную пробу…';
  try {
    const bytes = await getModelBytes(versions[version].file);
    status.textContent = 'Модель скачана. Открываю…';
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
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
    if (!gltf.animations.some(clip => clip.name === previous.name)) {
      disposeModel(root);
      throw new Error('GLB is missing the selected animation');
    }
    if (modelRoot) {
      mixer.stopAllAction();
      mixer.uncacheRoot(modelScene);
      scene.remove(modelRoot);
      disposeModel(modelRoot);
    }
    scene.add(root);
    modelRoot = root;
    modelScene = gltf.scene;
    mixer = new THREE.AnimationMixer(gltf.scene);
    clips = gltf.animations;
    if (!clips.length) throw new Error('GLB has no animation clips');
    chooseClip(previous.name);
    mixer.setTime(previous.fraction * activeClip.duration);
    scrub.value = String(Math.round(previous.fraction * 1000));
    playing = previous.playing;
    toggle.textContent = playing ? 'Пауза' : 'Продолжить';
    modelButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.model === version)));
    status.textContent = `${versions[version].label}. Оба варианта ещё требуют художественной работы.`;
    delete window.__miloReviewError;
    window.__miloReview = {
      version,
      clips: clips.map(clip => clip.name),
      skinned: gltf.scene.getObjectsByProperty('type', 'SkinnedMesh').length,
    };
  } catch (error) {
    status.textContent = `Не удалось открыть черновик: ${error.message}`;
    window.__miloReviewError = String(error);
  } finally {
    loading = false;
    modelButtons.forEach(button => { button.disabled = false; });
  }
}
modelButtons.forEach(button => button.addEventListener('click', () => load(button.dataset.model)));

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .1);
  if (loading) return;
  if (mixer && playing) mixer.update(delta);
  if (activeAction && !dragging && playing) {
    scrub.value = String(Math.round(1000 * activeAction.time / activeClip.duration));
  }
  orbit.update();
  renderer.render(scene, camera);
}
animate();
load();
