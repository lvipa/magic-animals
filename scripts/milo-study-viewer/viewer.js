import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const stage = document.querySelector('#stage');
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
stage.appendChild(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color('#9d9690');
scene.add(new THREE.HemisphereLight('#ffffff','#57545c',2));
for(const [color,power,pos] of [['#fff1e0',2.7,[-3,5,6]],['#e2ebff',1.3,[3,3,2]],['#ffffff',1,[2,3,-4]]]){
 const light=new THREE.DirectionalLight(color,power);light.position.set(...pos);scene.add(light);
}
const camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,.1,4.7);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enablePan=false;orbit.minDistance=2;orbit.maxDistance=30;
const resize=()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();window.__incomingMilo?.fit();};
new ResizeObserver(resize).observe(stage);resize();
const clay=new THREE.MeshStandardMaterial({color:'#d6c1a4',roughness:.8});
const wire=new THREE.MeshBasicMaterial({color:'#364a53',wireframe:true});
try{
const version=new URLSearchParams(location.search).get('model')||'motion';const isRig=['rig','cleaned','face','motion'].includes(version);
const asset=typeof __MILO_STUDY_MODEL__==='string'?__MILO_STUDY_MODEL__:version==='motion'?'./milo-animation-study-WIP.glb':version==='face'?'./milo-face-controls-WIP.glb':version==='cleaned'?'./milo-cleaned-rig-WIP.glb':isRig?'./milo-body-rig-WIP.glb':'./source.glb';
const gltf=await new GLTFLoader().loadAsync(asset);
gltf.scene.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(gltf.scene);const size=box.getSize(new THREE.Vector3());
const scale=2.1/Math.max(size.x,size.y,size.z);const root=new THREE.Group();root.scale.setScalar(scale);
root.position.copy(box.getCenter(new THREE.Vector3()).multiplyScalar(-scale));root.add(gltf.scene);scene.add(root);
const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push({mesh:o,material:o.material});});
const setMode=mode=>{meshes.forEach(o=>o.mesh.material=mode==='clay'?clay:mode==='wire'?wire:o.material);};
let viewAngle=0,viewDistance=4.7;
const setAngle=degrees=>{viewAngle=degrees;const a=degrees*Math.PI/180;camera.position.copy(orbit.target).add(new THREE.Vector3(Math.sin(a)*viewDistance,.05,Math.cos(a)*viewDistance));orbit.update();};
const mixer=new THREE.AnimationMixer(gltf.scene);let playing=false,active;
// Frame the full motion envelope, including jump height and the sleeping pose.
const envelopes=new Map();
root.updateMatrixWorld(true);const restBounds=new THREE.Box3().setFromObject(root,true);
for(const clip of gltf.animations){
 const bounds=new THREE.Box3();mixer.clipAction(clip).reset().play();
 for(const portion of [0,.25,.5,.75,.99]){mixer.setTime(clip.duration*portion);root.updateMatrixWorld(true);bounds.expandByObject(root,true);}
 envelopes.set(clip.name,bounds);mixer.stopAllAction();
}
const fit=()=>{const bounds=envelopes.get(active?.name)||restBounds;const dimensions=bounds.getSize(new THREE.Vector3());orbit.target.copy(bounds.getCenter(new THREE.Vector3()));const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));viewDistance=Math.max(dimensions.y,Math.hypot(dimensions.x,dimensions.z)/camera.aspect)*1.14/(2*tangent)+.5*Math.max(dimensions.x,dimensions.z);setAngle(viewAngle);};
const frameBounds=()=>{root.updateMatrixWorld(true);camera.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root,true);const corners=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));return{maxX:Math.max(...corners.map(p=>Math.abs(p.x))),maxY:Math.max(...corners.map(p=>Math.abs(p.y)))};};
const setPose=(name,time=0,play=false)=>{mixer.stopAllAction();active=gltf.animations.find(a=>a.name===name);if(active){mixer.clipAction(active).reset().play();mixer.setTime(time);}playing=play;fit();};
const clock=new THREE.Clock();
const facialMeshes=meshes.filter(o=>o.mesh.morphTargetDictionary);
const eyeRest=new Map();gltf.scene.traverse(o=>{if(o.isBone&&o.name.startsWith('eye_'))eyeRest.set(o,o.quaternion.clone());});
const setFace=(blink=0,smile=0,gaze=0)=>{
 for(const {mesh} of facialMeshes)for(const [name,index]of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[index]=name.startsWith('blink_')?blink:name==='smile'?smile:0;
 for(const [bone,rest]of eyeRest)bone.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),gaze*.08));
};
document.querySelectorAll('[data-face]').forEach(b=>{b.disabled=!['face','motion'].includes(version);b.onclick=()=>{setPose('');const name=b.dataset.face;setFace(name==='closed'?1:0,name==='smile'?1:0,name==='left'?-1:name==='right'?1:0);};});
document.querySelectorAll('[data-clip]').forEach(b=>{b.disabled=!gltf.animations.some(a=>a.name===b.dataset.clip);b.onclick=()=>setPose(b.dataset.clip,0,true);});
document.querySelector('#rest').onclick=()=>{setPose('');gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});setFace(0,0,0);};
renderer.setAnimationLoop(()=>{const dt=clock.getDelta();if(playing)mixer.update(dt);orbit.update();renderer.render(scene,camera);});
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>setAngle(Number(b.dataset.angle)));
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
window.__incomingMilo={setMode,setAngle,setPose,setFace,fit,frameBounds,size:size.toArray(),meshes:meshes.length,clips:gltf.animations.map(a=>a.name),skinned:meshes.filter(o=>o.mesh.isSkinnedMesh).length,morphs:facialMeshes.flatMap(o=>Object.keys(o.mesh.morphTargetDictionary)),sample:()=>({points:meshes.map(({mesh})=>{const v=new THREE.Vector3();mesh.getVertexPosition(0,v);return v.toArray();}),weights:facialMeshes.map(({mesh})=>mesh.morphTargetInfluences.slice()),root:gltf.scene.getObjectByName('root')?.position.toArray(),bones:meshes[0].mesh.skeleton.bones.map(b=>({name:b.name,rotation:b.quaternion.toArray()}))})};
fit();
document.querySelector('#status').textContent=version==='motion'?'7 пробных движений · веки требуют сглаживания · раскрытие рта ещё в работе':version==='face'?'Глаза, веки и улыбка · проба мимики':version==='cleaned'?'Проба сглаженной шерсти · Wave и Run · мимики пока нет':isRig?'Проба скелета · Wave и Run · мимики пока нет':'Текстуры встроены · скелета и анимаций пока нет';
}catch(e){window.__incomingMiloError=String(e);document.querySelector('#status').textContent=String(e);}
