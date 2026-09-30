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
const setPose=(name,time=0,play=false)=>{stopSpeech();mixer.stopAllAction();active=gltf.animations.find(a=>a.name===name);if(active){mixer.clipAction(active).reset().play();mixer.setTime(time);}playing=play;fit();};
const clock=new THREE.Clock();
const facialMeshes=meshes.filter(o=>o.mesh.morphTargetDictionary);
const setMouth=value=>{for(const {mesh}of facialMeshes){const index=mesh.morphTargetDictionary.mouthOpen;if(index!==undefined)mesh.morphTargetInfluences[index]=value;}};
let soundEnabled=false,speechOwnsMouth=false,speechCue=null,speechRequest=0,mouthEnvelope=0;
let voiceContext,voiceGain,voiceSource,voiceStartedAt=0,voiceDuration=0,speechPlaying=false,speechEnded=false,speechError=null;
const voiceBuffers=new Map();
const soundButton=document.querySelector('#sound-toggle');const spokenLine=document.querySelector('#spoken-line');
const speechData=typeof __MILO_SPEECH_ASSET__==='string'?await fetch(__MILO_SPEECH_ASSET__).then(r=>{if(!r.ok)throw Error('Voice envelope unavailable');return r.json();}).catch(()=>null):null;
const getVoiceContext=()=>{if(!voiceContext){const AudioContext=window.AudioContext||window.webkitAudioContext;voiceContext=new AudioContext();voiceGain=voiceContext.createGain();voiceGain.gain.value=.75;voiceGain.connect(voiceContext.destination);}return voiceContext;};
const voiceTime=()=>speechPlaying?Math.max(0,Math.min(voiceDuration,voiceContext.currentTime-voiceStartedAt)):speechEnded?voiceDuration:0;
const stopSpeech=()=>{speechRequest++;if(voiceSource){voiceSource.stop();voiceSource=null;}speechPlaying=false;speechEnded=false;speechOwnsMouth=false;speechCue=null;mouthEnvelope=0;setMouth(0);if(spokenLine)spokenLine.hidden=true;};
const playSpeech=async name=>{
 const cue=speechData?.clips[name.replace('_WIP','').toLowerCase()];if(!soundEnabled||!cue)return;
 const request=++speechRequest;speechCue=cue;speechOwnsMouth=true;speechError=null;
 if(spokenLine){spokenLine.hidden=false;spokenLine.textContent=cue.text;}
 try{
  const context=getVoiceContext();await context.resume();
  if(!voiceBuffers.has(cue.file)){const url=new URL('../../audio/characters/'+cue.file,location.href).href;voiceBuffers.set(cue.file,fetch(url).then(r=>{if(!r.ok)throw Error('Voice unavailable');return r.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).catch(error=>{voiceBuffers.delete(cue.file);throw error;}));}
  const buffer=await voiceBuffers.get(cue.file);if(request!==speechRequest||!soundEnabled)return;
  voiceSource=context.createBufferSource();voiceSource.buffer=buffer;voiceSource.connect(voiceGain);voiceStartedAt=context.currentTime;voiceDuration=buffer.duration;speechPlaying=true;speechEnded=false;
  voiceSource.onended=()=>{if(request!==speechRequest)return;voiceSource=null;speechPlaying=false;speechEnded=true;mouthEnvelope=0;setMouth(0);};
  voiceSource.start();
 }catch(error){if(request!==speechRequest)return;speechOwnsMouth=false;speechError=String(error);document.querySelector('#status').textContent='Звук не запустился. Нажмите движение ещё раз.';}
};
if(soundButton){soundButton.disabled=!speechData;soundButton.addEventListener('click',()=>{soundEnabled=!soundEnabled;soundButton.setAttribute('aria-pressed',String(soundEnabled));soundButton.textContent=soundEnabled?'Выключить озвучку':'Включить озвучку';if(!soundEnabled)stopSpeech();else getVoiceContext().resume().catch(error=>{speechError=String(error);});});}
const speechState=()=>({enabled:soundEnabled,paused:!speechPlaying,ended:speechEnded,time:voiceTime(),duration:voiceDuration,contextState:voiceContext?.state||null,contextTime:voiceContext?.currentTime||0,startedAt:voiceStartedAt,error:speechError,text:speechCue?.text||null,mouth:mouthEnvelope});
window.addEventListener('pagehide',stopSpeech);
// Pick a jaw landmark from the exported morph, then measure its actual skinned
// position. Review checks use this to catch an empty or disconnected control.
const jawMesh=facialMeshes.find(({mesh})=>mesh.material.map&&mesh.morphTargetDictionary.mouthOpen!==undefined)?.mesh;
let jawVertex=0;
if(jawMesh){const deltas=jawMesh.geometry.morphAttributes.position[jawMesh.morphTargetDictionary.mouthOpen];let largest=0;for(let i=0;i<deltas.count;i++){const length=new THREE.Vector3().fromBufferAttribute(deltas,i).lengthSq();if(length>largest){largest=length;jawVertex=i;}}}
const jawPosition=()=>{if(!jawMesh)return null;root.updateMatrixWorld(true);return jawMesh.getVertexPosition(jawVertex,new THREE.Vector3()).applyMatrix4(jawMesh.matrixWorld).toArray();};
const eyeRest=new Map();gltf.scene.traverse(o=>{if(o.isBone&&o.name.startsWith('eye_'))eyeRest.set(o,o.quaternion.clone());});
const setFace=(blink=0,smile=0,gaze=0,mouth=0)=>{
 for(const {mesh} of facialMeshes)for(const [name,index]of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[index]=name.startsWith('blink_')?blink:name==='smile'?smile:name==='mouthOpen'?mouth:0;
 for(const [bone,rest]of eyeRest)bone.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),gaze*.08));
};
document.querySelectorAll('[data-face]').forEach(b=>{b.disabled=!['face','motion'].includes(version);b.onclick=()=>{setPose('');const name=b.dataset.face;setFace(name==='closed'?1:0,name==='smile'?1:0,name==='left'?-1:name==='right'?1:0,name==='mouth'?1:name==='mouth-half'?.5:0);};});
const focusFace=()=>{orbit.target.copy(root.localToWorld(new THREE.Vector3(0,.52,.44)));viewDistance=2;setAngle(viewAngle);};
document.querySelector('#face-detail')?.addEventListener('click',focusFace);
document.querySelectorAll('[data-clip]').forEach(b=>{b.disabled=!gltf.animations.some(a=>a.name===b.dataset.clip);b.onclick=()=>{setPose(b.dataset.clip,0,true);playSpeech(b.dataset.clip);};});
document.querySelector('#rest').onclick=()=>{setPose('');gltf.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});setFace(0,0,0);};
renderer.setAnimationLoop(()=>{const dt=clock.getDelta();if(playing)mixer.update(dt);if(speechOwnsMouth){let value=0;if(speechCue&&speechPlaying){const position=voiceTime()/speechData.step;const index=Math.floor(position);const fraction=position-index;value=((speechCue.envelope[index]||0)*(1-fraction)+(speechCue.envelope[index+1]||0)*fraction)*.8;}mouthEnvelope+=(value-mouthEnvelope)*(1-Math.exp(-dt*28));setMouth(mouthEnvelope);}orbit.update();renderer.render(scene,camera);});
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>setAngle(Number(b.dataset.angle)));
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
window.__incomingMilo={setMode,setAngle,setPose,setFace,focusFace,fit,frameBounds,jawPosition,speechState,size:size.toArray(),meshes:meshes.length,clips:gltf.animations.map(a=>a.name),skinned:meshes.filter(o=>o.mesh.isSkinnedMesh).length,morphs:facialMeshes.flatMap(o=>Object.keys(o.mesh.morphTargetDictionary)),sample:()=>({points:meshes.map(({mesh})=>{const v=new THREE.Vector3();mesh.getVertexPosition(0,v);return v.toArray();}),weights:facialMeshes.map(({mesh})=>mesh.morphTargetInfluences.slice()),morphValues:facialMeshes.flatMap(({mesh})=>Object.entries(mesh.morphTargetDictionary).map(([name,index])=>({name,value:mesh.morphTargetInfluences[index]}))),root:gltf.scene.getObjectByName('root')?.position.toArray(),bones:meshes[0].mesh.skeleton.bones.map(b=>({name:b.name,rotation:b.quaternion.toArray()}))})};
fit();
document.querySelector('#status').textContent=version==='motion'?'7 пробных движений · раскрытие рта и мимика · веки ещё в работе':version==='face'?'Глаза, веки, раскрытие рта и улыбка · проба мимики':version==='cleaned'?'Проба сглаженной шерсти · Wave и Run · мимики пока нет':isRig?'Проба скелета · Wave и Run · мимики пока нет':'Текстуры встроены · скелета и анимаций пока нет';
}catch(e){window.__incomingMiloError=String(e);document.querySelector('#status').textContent=String(e);}
