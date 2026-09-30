import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'.deployment/incoming-milo/milo-animation-study-WIP.glb');
const model=await readFile(source);
const sha=createHash('sha256').update(model).digest('hex');
const modelName=`milo-animation-${sha.slice(0,12)}.glb`;
const output=path.join(root,'public/review/milo-incoming');
await mkdir(output,{recursive:true});
const lines=JSON.parse(await readFile(path.join(root,'scripts/audio-lines.json'),'utf8'));
const speech={step:.02,method:'PCM RMS envelope; jaw timing approximation, not phoneme visemes',clips:{}};
for(const move of ['idle','happy','wave','jump','run','sleep','roar']){
 const cue=`character-cat-${move}`;const wav=await readFile(path.join(root,'public/audio/characters',`${cue}.wav`));
 if(wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')throw Error('Invalid WAV '+cue);
 let format,data;
 for(let offset=12;offset+8<=wav.length;){const name=wav.toString('ascii',offset,offset+4);const size=wav.readUInt32LE(offset+4);const chunk=wav.subarray(offset+8,offset+8+size);if(name==='fmt ')format=chunk;if(name==='data')data=chunk;offset+=8+size+(size%2);}
 if(!format||!data||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt16LE(14)!==16)throw Error('Expected mono PCM16 '+cue);
 const rate=format.readUInt32LE(4);const count=data.length/2;const block=Math.round(rate*speech.step);const rms=[];
 for(let offset=0;offset<count;offset+=block){let sum=0;const end=Math.min(count,offset+block);for(let i=offset;i<end;i++){const value=data.readInt16LE(i*2)/32768;sum+=value*value;}rms.push(Math.sqrt(sum/(end-offset)));}
 const sorted=[...rms].sort((a,b)=>a-b);const peak=sorted[Math.floor(sorted.length*.92)]||1;
 const raw=rms.map(v=>v<peak*.09?0:Math.min(1,v/peak));
 const envelope=raw.map((v,i)=>Number(((raw[Math.max(0,i-1)]+2*v+raw[Math.min(raw.length-1,i+1)])/4).toFixed(3)));
 speech.clips[move]={file:`${cue}.mp3`,text:lines[cue].text,duration:count/rate,wavSha256:createHash('sha256').update(wav).digest('hex'),envelope};
}
const speechBytes=Buffer.from(JSON.stringify(speech));
const speechName=`cat-speech-${createHash('sha256').update(speechBytes).digest('hex').slice(0,12)}.json`;
const result=await build({entryPoints:[path.join(root,'scripts/milo-study-viewer/viewer.js')],bundle:true,format:'esm',minify:true,write:false,define:{__MILO_STUDY_MODEL__:JSON.stringify(`./${modelName}`),__MILO_SPEECH_ASSET__:JSON.stringify(`./${speechName}`)}});
const bundle=result.outputFiles[0].contents;
const bundleName=`viewer-${createHash('sha256').update(bundle).digest('hex').slice(0,12)}.js`;
await copyFile(source,path.join(output,modelName));
await writeFile(path.join(output,bundleName),bundle);
await writeFile(path.join(output,speechName),speechBytes);
const template=await readFile(path.join(root,'scripts/milo-study-viewer/index.html'),'utf8');
await writeFile(path.join(output,'index.html'),template.replace('__BUNDLE__',bundleName));
await writeFile(path.join(output,'publish-manifest.json'),JSON.stringify({modelSha256:sha,files:[modelName,bundleName,speechName,'index.html']},null,2)+'\n');
console.log(JSON.stringify({output,modelName,bundleName,modelBytes:model.length}));
