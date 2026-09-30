import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.argv[2]||'http://127.0.0.1:8093/public/review/milo-incoming/';
const output='.test-artifacts/milo-incoming';await mkdir(output,{recursive:true});
// Exercise the normal graphics/audio path. Forcing SwiftShader on this
// Windows host can stall the audio clock even while AudioContext is running.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl']});
const errors=[];const clips=['Idle','Happy','Wave','Jump','Run','Sleep','Roar'];
let page;
try{
 page=await browser.newPage({viewport:{width:1100,height:1250}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__incomingMilo||window.__incomingMiloError,null,{timeout:60000});
 const info=await page.evaluate(()=>({clips:window.__incomingMilo?.clips,skinned:window.__incomingMilo?.skinned,morphs:window.__incomingMilo?.morphs,error:window.__incomingMiloError}));
 if(info.error||info.skinned!==9||!info.morphs.includes('mouthOpen')||clips.some(n=>!info.clips.includes(n+'_WIP')))throw Error(JSON.stringify(info));
 const results=[];
 for(const name of clips){
  const samples=[];
  for(const t of [0,name==='Idle'?1.5:name==='Run'?.2:name==='Sleep'?2:.73]){
   await page.evaluate(([n,t])=>window.__incomingMilo.setPose(n+'_WIP',t),[name,t]);await page.waitForTimeout(100);
   samples.push(await page.evaluate(()=>window.__incomingMilo.sample()));
  }
  if(JSON.stringify(samples[0].bones)===JSON.stringify(samples[1].bones))throw Error(name+' has no bone motion');
  if(!samples.flatMap(s=>s.points.flat()).every(Number.isFinite))throw Error(name+' has invalid deformation');
  if(name==='Jump'&&samples[1].root[1]-samples[0].root[1]<.2)throw Error('Jump does not rise vertically');
  if(name==='Sleep'&&!samples[1].weights.flat().some(v=>v>.95))throw Error('Sleep eyelids did not close');
  if(name==='Roar'&&!samples[1].morphValues.some(v=>v.name==='mouthOpen'&&v.value>.8))throw Error('Roar has no mouth opening');
  results.push({name,root:samples[1].root,facialWeights:samples[1].weights});
  for(const angle of [0,45,90]){
   await page.evaluate(a=>window.__incomingMilo.setAngle(a),angle);await page.waitForTimeout(100);
   const bounds=await page.evaluate(()=>window.__incomingMilo.frameBounds());
   if(bounds.maxX>1||bounds.maxY>1)throw Error(name+' cropped at '+angle+': '+JSON.stringify(bounds));
   await page.locator('canvas').screenshot({path:`${output}/${name}-${angle}.png`});
  }
 }
 await page.getByRole('button',{name:'Исходная стойка',exact:true}).click();
 await page.getByRole('button',{name:'Спереди',exact:true}).click();await page.waitForTimeout(100);
 await page.locator('canvas').screenshot({path:`${output}/neutral.png`});
 const jawPositions=[];
 for(const mouth of [0,.5,1]){
  await page.evaluate(m=>window.__incomingMilo.setFace(0,0,0,m),mouth);await page.waitForTimeout(100);
  jawPositions.push(await page.evaluate(()=>window.__incomingMilo.jawPosition()));
  for(const angle of [0,45,90]){
   await page.evaluate(a=>{window.__incomingMilo.setAngle(a);window.__incomingMilo.focusFace();},angle);await page.waitForTimeout(100);
   await page.locator('canvas').screenshot({path:`${output}/mouth-${mouth}-${angle}.png`});
  }
 }
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 if(jawPositions.some(p=>!p)||distance(jawPositions[0],jawPositions[2])<.035)throw Error('Jaw geometry does not open');
 if(distance(jawPositions[0],jawPositions[1])>=distance(jawPositions[0],jawPositions[2]))throw Error('Half-open mouth is not intermediate');
 await page.getByRole('button',{name:'Обычный взгляд',exact:true}).click();await page.waitForTimeout(100);
 if(distance(jawPositions[0],await page.evaluate(()=>window.__incomingMilo.jawPosition()))>1e-6)throw Error('Mouth does not return to neutral');
 const neutral=await page.evaluate(()=>window.__incomingMilo.sample());
 await page.getByRole('button',{name:'Взгляд влево',exact:true}).click();await page.waitForTimeout(100);
 const gaze=await page.evaluate(()=>window.__incomingMilo.sample());
 if(JSON.stringify(neutral.bones.filter(b=>b.name.startsWith('eye_')))===JSON.stringify(gaze.bones.filter(b=>b.name.startsWith('eye_'))))throw Error('Eye controls did not change gaze');
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,null,{timeout:5000});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
 await page.getByRole('button',{name:'Happy · радуется',exact:true}).click();await page.waitForTimeout(250);
 await page.screenshot({path:`${output}/mobile.png`,fullPage:true});
 for(const [name,time]of [['Jump',.73],['Sleep',2]]){
  await page.evaluate(([n,t])=>window.__incomingMilo.setPose(n+'_WIP',t),[name,time]);await page.waitForTimeout(100);
  const bounds=await page.evaluate(()=>window.__incomingMilo.frameBounds());
  if(bounds.maxX>1||bounds.maxY>1)throw Error(name+' cropped on mobile: '+JSON.stringify(bounds));
 }
 await page.getByRole('button',{name:'Включить озвучку',exact:true}).click();
 await page.getByRole('button',{name:'Wave · машет',exact:true}).click();
 await page.waitForFunction(()=>{const state=window.__incomingMilo.speechState();return !state.paused&&state.time>.05&&state.mouth>.02;},null,{timeout:30000});
 const voice=await page.evaluate(()=>window.__incomingMilo.speechState());
 if(voice.error||!voice.text.includes('Wave!'))throw Error('Voice playback failed: '+JSON.stringify(voice));
 await page.getByRole('button',{name:'Открыть рот',exact:true}).click();
 if(!(await page.evaluate(()=>window.__incomingMilo.speechState().paused)))throw Error('Face control did not stop previous voice');
 await page.getByRole('button',{name:'Выключить озвучку',exact:true}).click();
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${output}/results.json`,JSON.stringify({url,info,results,voice,errors},null,2));
 console.log(JSON.stringify({url,clips:results.length,skinned:info.skinned,jumpVertical:true,sleepMorph:true,mouthOpens:true,mouthReturnsToNeutral:true,voicePlayback:true,voiceMouthTiming:true,mobileOverflow:false,errors}));
}catch(error){console.error(error.stack||String(error));if(page)console.error('Speech state:',await page.evaluate(()=>window.__incomingMilo?.speechState()).catch(()=>null));process.exitCode=1;}finally{await browser.close();process.exit(process.exitCode||0);}
