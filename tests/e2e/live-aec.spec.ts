import { test, expect, _electron as electron } from '@playwright/test';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const key=join(process.env.APPDATA??'', 'AETHER','gemini-key.encrypted');
function speech():Promise<Buffer>{return new Promise((ok,no)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('dist/main/voice-speech.ps1'),'-Operation','synthesize'],{windowsHide:true});let text='';child.stdout.setEncoding('utf8');child.stdout.on('data',v=>text+=v);child.stderr.on('data',()=>{});child.on('error',no);child.on('exit',()=>{try{ok(Buffer.from(JSON.parse(text).wav,'base64'));}catch{no(new Error('Fixture speech failed'));}});child.stdin.end(JSON.stringify({text:'Bonjour Aether. Dis une phrase de bienvenue, puis compte doucement de un à cinq.',voice:'Microsoft Hortense Desktop',language:'fr-FR',speed:1}));});}
function padWav(wav:Buffer){const result=Buffer.concat([wav,Buffer.alloc(16000*2*35)]);result.writeUInt32LE(result.length-8,4);for(let i=12;i<wav.length-8;){const size=wav.readUInt32LE(i+4);if(wav.toString('ascii',i,i+4)==='data'){result.writeUInt32LE(size+16000*2*35,i+4);break;}i+=8+size+(size%2);}return result;}

test('LIVE Chromium AEC: real audio contexts, private media permission and continuous buffered native playback',async()=>{
  test.setTimeout(45000);
  const root=await mkdtemp(join(tmpdir(),'aether-aec-')),profile=join(root,'profile'),fixture=join(root,'services.cjs');await mkdir(profile);
  await build({entryPoints:[resolve('tests/e2e/live-services-fixture.ts')],outfile:fixture,bundle:true,platform:'node',format:'cjs',external:['electron']});
  const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
  const packaged=process.env.AETHER_AEC_PACKAGED==='1';
  const app=await electron.launch({...(packaged?{executablePath:resolve('release/AETHER-win32-x64/AETHER.exe')}:{ }),args:['--use-fake-device-for-media-stream',...(packaged?[]:[resolve('.')])],env:env as Record<string,string>});
  try{
    const page=await app.firstWindow();await page.locator('.entity-stage').waitFor();
    const setup=await app.evaluate(async(_electron,input)=>{
      const require=process.getBuiltinModule('node:module').createRequire(input.fixture);
      const {ChromiumLiveDuplex}=require(input.fixture);
      const audio=new ChromiumLiveDuplex(()=>({microphone:'default',volume:0}),()=>true,async()=>null,input.directory),control=new AbortController();
      const record={frames:0,playing:[] as boolean[],errors:[] as string[]};
      Object.assign(globalThis,{aecAudio:audio,aecControl:control,aecRecord:record});
      await audio.start(()=>record.frames++, (playing:boolean)=>{if(record.playing.at(-1)!==playing)record.playing.push(playing);},(message:string)=>record.errors.push(message),control.signal);
      return {processing:audio.processing};
    },{fixture,directory:resolve(packaged?'release/AETHER-win32-x64/resources/app.asar/dist/main':'dist/main')});expect(setup.processing.echoCancellation).toBe(true);
    const captureRouting=await app.evaluate(async({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='AETHER · audio LIVE')!.webContents.executeJavaScript('window.liveAudioMetadata.capture'));
    expect(captureRouting).toEqual({sink:'none',monitorGain:0,sampleRate:16000});
    // Twenty packets with network timing variation fit into the 180ms playout buffer.
    await app.evaluate(async()=>{const target=globalThis as unknown as {aecAudio:{play(pcm:Uint8Array,rate:number):void}};for(let n=0;n<20;n++){const pcm=Buffer.alloc(2400);for(let i=0;i<1200;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.09)*2000),i*2);target.aecAudio.play(pcm,24000);await new Promise(ok=>setTimeout(ok,n%4===0?65:35));}});
    await page.waitForTimeout(1100);
    const timeline=await app.evaluate(async({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='AETHER · audio LIVE')!.webContents.executeJavaScript('window.liveAudioMetadata'));
    await mkdir('docs/recette-live',{recursive:true});await writeFile('docs/recette-live/aec-playback-timing.json',JSON.stringify(timeline,null,2)+'\n');
    await expect.poll(()=>app.evaluate(()=>{const r=(globalThis as unknown as {aecRecord:{playing:boolean[]}}).aecRecord;return r.playing;})).toEqual([true,false]);
    const camera=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='AETHER · audio LIVE')!;return w.webContents.executeJavaScript("navigator.mediaDevices.getUserMedia({video:true}).then(s=>{s.getTracks().forEach(t=>t.stop());return 'allowed';}).catch(()=> 'denied')");});expect(camera).toBe('denied');
    const result=await app.evaluate(()=>{const t=globalThis as unknown as {aecRecord:{frames:number;errors:string[]};aecControl:AbortController};t.aecControl.abort();return t.aecRecord;});expect(result.frames).toBeGreaterThan(0);expect(result.errors).toEqual([]);
    await mkdir('docs/recette-live',{recursive:true});await writeFile('docs/recette-live/'+(packaged?'aec-packaged-evidence.json':'aec-native-evidence.json'),JSON.stringify({date:new Date().toISOString(),packaged,source:'Chromium fake media device only; no physical microphone. Actual AudioContexts and native output.',...setup,captureRouting,...result,cameraDenied:true},null,2)+'\n');
  }finally{await app.close();await rm(root,{recursive:true,force:true});}
});

test('LIVE actual Gemini with Chromium AEC and virtual speech: complete audio answer without false interruption',async()=>{
  test.setTimeout(120000);
  test.skip(!process.env.GEMINI_API_KEY&&!existsSync(key),'No Gemini key');
  const root=await mkdtemp(join(tmpdir(),'aether-aec-gemini-')),profile=join(root,'profile'),wav=join(root,'speech.wav');await mkdir(profile);await writeFile(wav,padWav(await speech()));
  if(!process.env.GEMINI_API_KEY){await copyFile(key,join(profile,'gemini-key.encrypted'));const localState=JSON.parse(await readFile(join(process.env.APPDATA!,'AETHER','Local State'),'utf8'));await writeFile(join(profile,'Local State'),JSON.stringify({os_crypt:localState.os_crypt}));}
  const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({args:['--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+wav,resolve('.')],env:env as Record<string,string>});
  try{
    const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();await entity.evaluate(()=>window.aether.command('voice'));const voice=app.windows().find(w=>w.url().endsWith('#voice'))!;
    // The user's running application already owns Control+Alt+V.
    await voice.getByLabel('Raccourci VOICE',{exact:true}).press('Control+Alt+Shift+F11');
    await voice.getByRole('button',{name:'Autoriser le microphone',exact:true}).click();
    await expect.poll(async()=>(await entity.evaluate(()=>window.aether.getVoice())).settings.microphoneConsent).toBe('granted');
    await entity.evaluate(()=>window.aether.command('live'));const panel=app.windows().find(w=>w.url().endsWith('#live'))!;await panel.getByLabel('Activer Gemini Live',{exact:true}).check();await panel.getByLabel('Niveau de diagnostic',{exact:true}).selectOption('detailed');await panel.getByRole('button',{name:'Enregistrer LIVE',exact:true}).click();await panel.getByLabel('J’autorise explicitement l’audio et les données nécessaires des outils vers Gemini',{exact:true}).check();await panel.getByRole('button',{name:'Autoriser Gemini Live',exact:true}).click();
    await expect.poll(async()=>(await panel.evaluate(()=>window.aether.getLive())).settings.cloudConsent).toBe('granted');
    const start=await panel.evaluate(()=>window.aether.liveControl('start'));expect(start.ok,JSON.stringify(start)).toBe(true);
    const states:string[]=[];await panel.exposeFunction('aecState',(state:string)=>{if(states.at(-1)!==state)states.push(state);});await panel.evaluate(()=>window.aether.onLive(value=>{void (window as unknown as {aecState(state:string):void}).aecState(value.state);}));
    await expect.poll(async()=>(await entity.evaluate(()=>window.aether.getMind())).messages.some(m=>m.role==='assistant'&&m.modality==='live'),{timeout:90000}).toBe(true);
    await expect.poll(async()=>(await panel.evaluate(()=>window.aether.getLive())).state,{timeout:30000}).toBe('LIVE_LISTENING');
    const final=await panel.evaluate(()=>window.aether.getLive());expect(final.audioProcessing?.echoCancellation).toBe(true);expect(final.metrics.some(m=>m.kind==='first-audio')).toBe(true);expect(final.metrics.filter(m=>m.kind==='interruption')).toHaveLength(0);expect(states).toContain('LIVE_SPEAKING');
    await mkdir('docs/recette-live',{recursive:true});await writeFile('docs/recette-live/aec-gemini-evidence.json',JSON.stringify({date:new Date().toISOString(),source:'Actual Gemini, encrypted key in isolated profile, virtual synthesized microphone, Chromium AEC and native output. Human speaker feedback remains to validate.',states,processing:final.audioProcessing,metrics:final.metrics,audit:final.audit},null,2)+'\n');
    await panel.evaluate(()=>window.aether.liveControl('stop'));
  }finally{await app.close();await rm(root,{recursive:true,force:true});}
});
