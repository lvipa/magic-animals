import * as THREE from 'three';
import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import { animalById, type AnimalId } from '../config/animals';
import {
  animateCharacter,
  makeCharacter,
  revealCharacter,
  disposeCharacter,
} from '../characters/models';
import { makeMagic, animateMagic } from '../scenes/magic';
import type { ARProvider, TrackingInfo } from './ARProvider';
import { useRuntime } from '../tracking/runtime';
import { disposeTrackingTensors } from './disposeTracking';
import { imageTargetsUrl } from '../config/arCards';
import { loadAuthoredCharacter } from '../characters/authoredCat';
interface Target {
  root: THREE.Group;
  model: THREE.Group;
  magic: THREE.Group;
  glow: THREE.Mesh;
  post: THREE.Matrix4;
  visible: boolean;
  lostAt: number;
  lastPose: number;
  progress: number;
  action: string;
  loading?: boolean;
}
export class MindARProvider implements ARProvider {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private controller: Controller | null = null;
  private targets = new Map<AnimalId, Target>();
  private ids: AnimalId[] = [];
  private bytes: ArrayBuffer | null = null;
  private found = new Set<(id: AnimalId) => void>();
  private lost = new Set<(id: AnimalId) => void>();
  private tapped = new Set<(id: AnimalId) => void>();
  private tracking: TrackingInfo = { target: null, visible: false };
  private abort = new AbortController();
  private stopped = false;
  private markerTest = false;
  private pixelRatio = 1.5;
  private focusQueued = false;
  private lastValidation = performance.now();
  private markerNormal = new THREE.Vector3();
  private towardCamera = new THREE.Vector3();
  private frameStopped: (() => void) | null = null;
  private resize = () => this.updateSize();
  async initialize(container: HTMLElement, markerTest = false) {
    this.container = container;
    this.markerTest = markerTest;
    useRuntime.getState().update({ camera: 'REQUESTING', ar: 'LOADING', error: '' });
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xfff4e7, 0x819eae, 1.5));
    const light = new THREE.DirectionalLight(0xfff1dd, 2.8);
    light.position.set(-3, 4, 5);
    this.scene.add(light);
    const rim = new THREE.DirectionalLight(0xb2e4f3, 1.7);
    rim.position.set(3, 2, -3);
    this.scene.add(rim);
    this.renderer.domElement.addEventListener('pointerdown', this.onTap);
    window.addEventListener('resize', this.resize);
  }
  async registerTargets(ids: AnimalId[]) {
    this.ids = ids;
    const response = await fetch(imageTargetsUrl, { signal: this.abort.signal });
    if (!response.ok) throw new Error('Compiled image targets unavailable');
    this.bytes = await response.arrayBuffer();
  }
  async start() {
    if (!this.renderer || !this.container || !this.bytes || this.stopped) return;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera requires Safari and a secure HTTPS connection');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 960, max: 1280 },
        height: { ideal: 720, max: 960 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const video = document.createElement('video');
    this.video = video;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.className = 'tracking-video';
    this.container.prepend(video);
    await video.play();
    if (this.stopped) return;
    if (!video.videoWidth)
      await new Promise<void>((resolve) =>
        video.addEventListener('loadedmetadata', () => resolve(), { once: true }),
      );
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    const controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      warmupTolerance: 3,
      missTolerance: 5,
      onUpdate: this.onUpdate,
    });
    this.controller = controller;
    const { dimensions } = controller.addImageTargetsFromBuffer(this.bytes);
    this.ids.forEach((id) => {
      const [width, height] = dimensions[animalById[id].targetIndex];
      const post = new THREE.Matrix4().compose(
        new THREE.Vector3(width / 2, height / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(width, width, width),
      );
      const root = new THREE.Group();
      root.matrixAutoUpdate = false;
      root.visible = false;
      // Allocate each GPU character only when its card is first recognized.
      const model = new THREE.Group();
      root.add(model);
      const magic = makeMagic();
      magic.rotation.x = Math.PI / 2;
      root.add(magic);
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.16, 0.19, 32),
        new THREE.MeshBasicMaterial({
          color: 0xffd878,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      glow.position.z = 0.005;
      glow.visible = false;
      root.add(glow);
      if (this.markerTest) {
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, 0.18),
          new THREE.MeshNormalMaterial(),
        );
        cube.position.z = 0.13;
        root.add(cube, new THREE.AxesHelper(0.45));
      }
      this.scene.add(root);
      this.targets.set(id, {
        root,
        model,
        magic,
        glow,
        post,
        visible: false,
        lostAt: 0,
        lastPose: 0,
        progress: 0,
        action: 'idle',
      });
    });
    this.updateSize();
    controller.dummyRun(video);
    if (this.stopped) return;
    controller.processVideo(video);
    useRuntime.getState().update({
      camera: 'READY',
      ar: 'READY',
      resolution: `${video.videoWidth} × ${video.videoHeight}`,
    });
    let frames = 0,
      last = performance.now();
    this.renderer.setAnimationLoop((time) => {
      frames++;
      if (time - last >= 1000) {
        useRuntime.getState().update({ fps: Math.round((frames * 1000) / (time - last)) });
        frames = 0;
        last = time;
      }
      this.targets.forEach((target) => {
        target.root.visible = target.visible || performance.now() - target.lostAt < 1200;
        if (!target.model.userData.kind || !target.root.visible) return;
        const standing = (target.model.userData.standing as number) ?? 1;
        target.model.rotation.x = THREE.MathUtils.lerp(
          target.model.rotation.x,
          (Math.PI / 2) * standing,
          0.12,
        );
        target.model.userData.headTilt = (-1.12 * target.model.rotation.x) / (Math.PI / 2);
        animateCharacter(target.model, time / 1000, target.action);
        animateMagic(target.magic, time / 1000);
        target.glow.scale.setScalar(1 + Math.sin(time * 0.002) * 0.05);
      });
      this.renderer?.render(this.scene, this.camera);
    });
  }
  private processingFrames = 0;
  private processingLast = performance.now();
  private onUpdate = (data: {
    type: string;
    targetIndex?: number;
    worldMatrix?: number[] | null;
  }) => {
    if (this.stopped) {
      if (data.type === 'processDone') this.frameStopped?.();
      return;
    }
    if (data.type === 'processDone') {
      // Reset only at a frame boundary; restarting processVideo mid-frame creates concurrent loops.
      const now = performance.now();
      this.targets.forEach((target, id) => {
        if (target.visible && now - target.lastPose > 1800) this.markLost(id, target);
      });
      if (
        this.controller &&
        (this.focusQueued || (this.tracking.visible && now - this.lastValidation > 1700))
      ) {
        // Compare ALL targets again. Shared artwork makes forced single-target matching unsafe.
        // Keep a logical anchor across the short warmup; same-ID validation never replays a reaction.
        this.controller.interestedTargetIndex = -1;
        this.controller.trackingStates.forEach((s) => {
          s.isTracking = false;
          s.showing = false;
          s.trackCount = 0;
          s.trackMiss = 0;
          s.trackingMatrix = null;
        });
        this.focusQueued = false;
        this.lastValidation = now;
      }
      this.processingFrames++;
      if (now - this.processingLast >= 1000) {
        useRuntime.getState().update({
          trackingFPS: Math.round((this.processingFrames * 1000) / (now - this.processingLast)),
        });
        this.processingFrames = 0;
        this.processingLast = now;
      }
      return;
    }
    if (data.type !== 'updateMatrix') return;
    const id = this.ids.find((id) => animalById[id].targetIndex === data.targetIndex);
    if (!id) return;
    const target = this.targets.get(id);
    if (!target) return;
    if (data.worldMatrix) {
      if (!target.model.userData.kind && !target.loading) {
        target.loading = true;
        void loadAuthoredCharacter(id).then(() => {
          // A decode may finish after the camera has been closed. Do not
          // allocate a skeleton or attach anything to a retired anchor.
          if (this.stopped || this.targets.get(id) !== target) return;
          const model = makeCharacter(id);
          model.userData.lowDetail = this.pixelRatio <= 1;
          model.userData.standing = target.model.userData.standing;
          model.scale.setScalar(0.34);
          model.rotation.x = Math.PI / 2;
          model.position.set(0, -0.1, 0.02);
          revealCharacter(model, target.progress);
          target.root.remove(target.model);
          target.model = model;
          target.root.add(model);
        });
      }
      this.targets.forEach((other, otherId) => {
        if (otherId !== id && other.visible) this.markLost(otherId, other);
      });
      target.root.matrix.fromArray(data.worldMatrix).multiply(target.post);
      // Stand out from a table card; gently face the viewer when a card is held upright.
      // The anchor remains the measured card pose, with no invented world tracking.
      this.markerNormal.setFromMatrixColumn(target.root.matrix, 2).normalize();
      this.towardCamera.setFromMatrixPosition(target.root.matrix).negate().normalize();
      target.model.userData.standing =
        1 -
        THREE.MathUtils.smoothstep(Math.abs(this.markerNormal.dot(this.towardCamera)), 0.72, 0.98);
      target.lastPose = performance.now();
      this.tracking = { target: id, visible: true };
      useRuntime.getState().update({ target: id, visible: true });
      if (!target.visible) {
        target.visible = true;
        this.found.forEach((fn) => fn(id));
      }
    } else this.markLost(id, target);
  };
  private markLost(id: AnimalId, target: Target) {
    if (!target.visible) return;
    target.visible = false;
    target.lostAt = performance.now();
    if (this.tracking.target === id) {
      this.tracking = { target: id, visible: false };
      useRuntime.getState().update({ target: id, visible: false });
    }
    this.lost.forEach((fn) => fn(id));
  }
  private updateSize() {
    const { container, renderer, controller, video } = this;
    if (!container || !renderer || !controller || !video) return;
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    const videoRatio = video.videoWidth / video.videoHeight,
      containerRatio = width / height;
    const displayHeight = videoRatio > containerRatio ? height : width / videoRatio,
      displayWidth = displayHeight * videoRatio;
    Object.assign(video.style, {
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      top: `${(height - displayHeight) / 2}px`,
      left: `${(width - displayWidth) / 2}px`,
    });
    const projection = controller.getProjectionMatrix();
    this.camera.fov =
      (2 * Math.atan((1 / projection[5]) * (height / displayHeight)) * 180) / Math.PI;
    this.camera.near = projection[14] / (projection[10] - 1);
    this.camera.far = projection[14] / (projection[10] + 1);
    this.camera.aspect = containerRatio;
    this.camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  private onTap = (event: PointerEvent) => {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(
      [...this.targets.values()]
        .filter((t) => t.root.visible && t.progress >= 1)
        .map((t) => t.model),
      true,
    );
    if (!hits.length) return;
    let object: THREE.Object3D | null = hits[0].object;
    while (object && !object.userData.kind) object = object.parent;
    if (object) this.tapped.forEach((fn) => fn(object!.userData.kind as AnimalId));
  };
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.abort.abort();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.renderer?.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    if (this.controller) {
      const controller = this.controller;
      const wasProcessing = controller.processingVideo;
      controller.stopProcessVideo();
      if (wasProcessing) {
        await Promise.race([
          new Promise<void>((resolve) => {
            this.frameStopped = resolve;
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 400)),
        ]);
      }
      controller.dispose();
      controller.worker.terminate();
      disposeTrackingTensors(controller);
      this.controller = null;
      this.frameStopped = null;
    }
    this.targets.forEach((target) => {
      // Authored clones own their rig/materials, but share immutable geometry.
      // Dispose through that contract before releasing the procedural anchor.
      if (target.model.userData.authored) {
        target.root.remove(target.model);
        disposeCharacter(target.model);
      }
      disposeCharacter(target.root);
    });
    this.targets.clear();
    this.renderer?.domElement.removeEventListener('pointerdown', this.onTap);
    this.renderer?.dispose();
    this.video?.remove();
    this.container?.replaceChildren();
    this.bytes = null;
    useRuntime.getState().update({ camera: 'OFF', ar: 'OFF', visible: false, target: null });
  }
  onTargetFound(handler: (id: AnimalId) => void) {
    this.found.add(handler);
    return () => this.found.delete(handler);
  }
  onTargetLost(handler: (id: AnimalId) => void) {
    this.lost.add(handler);
    return () => this.lost.delete(handler);
  }
  onAnimalTap(handler: (id: AnimalId) => void) {
    this.tapped.add(handler);
    return () => this.tapped.delete(handler);
  }
  setAppearance(id: AnimalId, progress: number) {
    const target = this.targets.get(id);
    if (!target) return;
    target.progress = progress;
    if (target.model.userData.kind) revealCharacter(target.model, progress);
    target.magic.visible = progress > 0 && progress < 1;
    target.glow.visible = progress > 0;
  }
  setAction(id: AnimalId, action: string) {
    const target = this.targets.get(id);
    if (target) target.action = action;
  }
  setFocus(id: AnimalId | null) {
    if (!this.controller) return;
    if (!this.tracking.visible || this.tracking.target !== id) this.focusQueued = true;
  }
  setQuality(pixelRatio: number) {
    this.pixelRatio = pixelRatio;
    this.renderer?.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
    const cat = this.targets.get('cat');
    if (cat?.model.userData.kind) {
      cat.model.userData.lowDetail = pixelRatio <= 1;
      revealCharacter(cat.model, cat.progress);
    }
  }
  getTracking() {
    return this.tracking;
  }
  getScene() {
    return this.scene;
  }
}
