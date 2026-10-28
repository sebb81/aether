import {_electron} from 'playwright';
import assert from 'node:assert/strict';
import {listPackage,extractFile} from '@electron/asar';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const folder=resolve('docs/recette-live'),root=resolve('release/AETHER-win32-x64'),executable=join(root,'AETHER.exe'),resources=join(root,'resources'),profile=join(process.env.APPDATA,'AETHER');
await mkdir(folder,{recursive:true});
const archive=listPackage(join(resources,'app.asar')).map(path=>path.replaceAll('\\','/'));
const compiledHashes={};
for(const name of ['main/main.cjs','main/preload.cjs','main/live-audio-preload.cjs','audio/live-audio.html','audio/live-audio.js','audio/capture-worklet.js']){
  const path=join('dist',...name.split('/'));
  const actual=createHash('sha256').update(extractFile(join(resources,'app.asar'),path)).digest('hex');
  assert.equal(actual,createHash('sha256').update(await readFile(path)).digest('hex'),name);compiledHashes[name]=actual;
}
const helpers=['voice-worker.py','live-audio-worker.py','gemini-live-worker.cjs','voice-speech.ps1','echo-context.ps1'];
for(const helper of helpers){assert(archive.includes('/dist/main/'+helper),helper);const actual=join(resources,'app.asar.unpacked','dist','main',helper);assert(existsSync(actual),helper);assert.equal(createHash('sha256').update(await readFile(actual)).digest('hex'),createHash('sha256').update(await readFile(join('dist','main',helper))).digest('hex'),helper);}
const hash=async path=>existsSync(path)?createHash('sha256').update(await readFile(path)).digest('hex'):null;
const tracked=['preferences.json','ai-settings.json','router-settings.json','voice-settings.json','live-settings.json'];
const before=Object.fromEntries(await Promise.all(tracked.map(async name=>[name,await hash(join(profile,name))])));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const application=await _electron.launch({executablePath:executable,args:[],env});
const proof={date:new Date().toISOString(),executable,helpers,compiledHashes,archiveEntries:archive.length};
try{
  const page=await application.firstWindow();await page.locator('.entity-stage').waitFor();
  const runtime=await application.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),pid:process.pid}));assert.equal(runtime.packaged,true);assert.equal(runtime.version,'0.5.6');proof.runtime=runtime;
  const live=await page.evaluate(()=>window.aether.getLive()),voice=await page.evaluate(()=>window.aether.getVoice());assert.equal(live.microphoneActive,false);assert.equal(live.sessionId,null);assert.equal(voice.microphoneActive,false);proof.startup={liveState:live.state,liveConsent:live.settings.cloudConsent,keyConfigured:live.keyConfigured,defaultMode:live.settings.defaultMode,localState:voice.state,microphoneActive:false};
  const priorMemories=await page.evaluate(()=>window.aether.listMemories(''));const priorCuriosity=await page.evaluate(()=>window.aether.getCuriosity());
  const memoryDigest=createHash('sha256').update(JSON.stringify(priorMemories)).digest('hex');
  const interestDigest=createHash('sha256').update(JSON.stringify(priorCuriosity.interests)).digest('hex');
  await page.evaluate(()=>window.aether.command('live'));const panel=application.windows().find(window=>window.url().endsWith('#live'));assert(panel);await panel.locator('.live-page').waitFor();await panel.screenshot({path:join(folder,'packaged-live-settings.png'),fullPage:true});await page.screenshot({path:join(folder,'packaged-entity.png')});
  assert.equal(createHash('sha256').update(JSON.stringify(await page.evaluate(()=>window.aether.listMemories('')))).digest('hex'),memoryDigest);assert.equal(createHash('sha256').update(JSON.stringify((await page.evaluate(()=>window.aether.getCuriosity())).interests)).digest('hex'),interestDigest);proof.data={memories:priorMemories.length,interests:priorCuriosity.interests.length,memoryDigest,interestDigest,unchangedDuringCheck:true};
  // Exercise the packaged SDK worker with an invalid test credential only.
  const transport=await new Promise((ok,no)=>{
    const child=spawn(executable,[join(resources,'app.asar.unpacked','dist','main','gemini-live-worker.cjs')],{windowsHide:true,stdio:'pipe',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});let buffer='',opened=false,rejected=false;const timeout=setTimeout(()=>{child.kill();no(new Error('Packaged SDK worker timeout'));},12000);
    child.stderr.on('data',()=>{});child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const value=JSON.parse(line);if(value.event?.type==='transport-open')opened=true;if(['closed','error'].includes(value.event?.type)){rejected=true;child.kill();}}catch{child.kill();}}});child.on('error',no);child.on('exit',()=>{clearTimeout(timeout);if(!opened||!rejected)no(new Error('Packaged SDK transport was not verified'));else ok({realWebSocketOpened:true,invalidCredentialRejected:true,noCapture:true});});
    child.stdin.write(JSON.stringify({command:'open',key:'invalid-aether-recipe-credential',input:{settings:live.settings,instructions:'Technical validation with fictitious data only.',tools:[]}})+'\n');
  });proof.packagedTransport=transport;
}finally{await application.close();}
const after=Object.fromEntries(await Promise.all(tracked.map(async name=>[name,await hash(join(profile,name))])));assert.deepEqual(after,before);proof.settingsUnchanged=true;
await writeFile(join(folder,'package-evidence.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
