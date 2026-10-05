import {_electron} from 'playwright';
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {listPackage} from '@electron/asar';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DatabaseSync} from 'node:sqlite';

const executable=resolve('release/AETHER-win32-x64/AETHER.exe'),profile=join(process.env.APPDATA,'AETHER');
const files=listPackage(resolve('release/AETHER-win32-x64/resources/app.asar'));
assert(files.includes('\\dist\\main\\main.cjs'));assert(!files.some(path=>/^\\(node_modules|tests|apps|docs|packages)(\\|$)/.test(path)));
const helperPath=resolve('release/AETHER-win32-x64/resources/app.asar.unpacked/dist/main/echo-context.ps1');
assert.deepEqual([...(await readFile(helperPath)).subarray(0,3)],[239,187,191]);
const run=promisify(execFile);
const echoFolder=await mkdtemp(join(resolve('test-results'),'packaged-echo-'));
const native=action=>run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('tests/e2e/echo-explorer.ps1'),'-Action',action,'-Folder',echoFolder],{windowsHide:true,timeout:20000});
const preferencesBefore=JSON.parse(await readFile(join(profile,'preferences.json'),'utf8'));
function database(){const db=new DatabaseSync(join(profile,'memory.sqlite'),{readOnly:true});try{return {memories:db.prepare('SELECT id,content FROM memories ORDER BY id').all(),interests:db.prepare('SELECT id,title FROM curiosity_interests ORDER BY id').all(),attempts:Number(db.prepare('SELECT COUNT(*) AS n FROM curiosity_explorations').get().n),settings:JSON.parse(db.prepare('SELECT content FROM curiosity_settings WHERE id=1').get().content)};}finally{db.close();}}
const before=database(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.AETHER_TEST_PROFILE;delete env.OPENAI_API_KEY;
const application=await _electron.launch({executablePath:executable,env});
try{
  const page=await application.firstWindow();await page.getByRole('button',{name:'ENTITY — cliquer ou déplacer'}).waitFor();
  const runtime=await application.evaluate(({app,BrowserWindow})=>({packaged:app.isPackaged,version:app.getVersion(),appPath:app.getAppPath(),visible:BrowserWindow.getAllWindows()[0].isVisible()}));assert(runtime.packaged);assert.equal(runtime.version,'0.5.0');
  const echoAtStartup=await page.evaluate(()=>window.aether.getEcho());assert.equal(echoAtStartup.enabled,false);assert.equal(echoAtStartup.state,'off');assert.equal(echoAtStartup.sessions.length,0);
  const snapshot=await page.evaluate(()=>window.aether.getSnapshot());for(const key of ['presence','mind','memory','curiosity','portal','echo'])assert.equal(snapshot.features[key],'available');assert(Object.values(snapshot.permissions).every(value=>value===false));assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.deepEqual(snapshot.preferences.position,preferencesBefore.position);
  const router=await page.evaluate(()=>window.aether.getModelRouter());assert.deepEqual(router.FAST,{provider:'ollama',model:'qwen3.5:9b'});assert.deepEqual(router.DEEP,{provider:'ollama',model:'qwen3.5:9b'});
  const portalSettings=await page.evaluate(()=>window.aether.getPortalSettings());assert(portalSettings.registered);
  // Respect the existing opt-in. Never disable it or import test interests into this profile.
  const deadline=Date.now()+125000;while((await page.evaluate(()=>window.aether.getCuriosity())).state==='exploring'){assert(Date.now()<deadline,'Existing autonomous call did not finish');await page.waitForTimeout(300);}
  await page.evaluate(()=>window.aether.command('settings'));const settings=application.windows().find(window=>window.url().endsWith('#settings'));assert(settings);await settings.getByRole('heading',{name:'ENTITY, sur votre bureau'}).waitFor();
  const configuration=await settings.evaluate(()=>window.aether.getAiConfiguration());assert.equal('apiKey' in configuration,false);assert.equal(configuration.provider,'ollama');assert.equal(configuration.cloudConsent,false);
  await page.evaluate(()=>window.aether.command('dialogue'));const dialogue=application.windows().find(window=>window.url().endsWith('#dialogue'));assert(dialogue);await dialogue.getByRole('textbox',{name:'Message à ENTITY'}).waitFor();
  const result=await dialogue.evaluate(()=>window.aether.sendMessage('Comment t’appelles-tu ?'));assert.equal(result.ok,true);const answer=(await dialogue.evaluate(()=>window.aether.getMind())).messages.at(-1);assert.equal(answer.role,'assistant');assert.match(answer.content,/ENTITY/i);assert.equal(answer.model,'qwen3.5:9b');
  await page.evaluate(()=>window.aether.command('close-dialogue'));
  await page.evaluate(()=>window.aether.command('echo'));const echo=application.windows().find(window=>window.url().endsWith('#echo'));assert(echo);await echo.getByRole('heading',{name:'Regarde comment je fais.'}).waitFor();
  // Exercise the packaged, unpacked helper with real foreground perception and an empty session.
  // Only the actual native picker's initial directory is set; its result is never fabricated.
  await application.evaluate(({dialog},root)=>{const original=dialog.showOpenDialog.bind(dialog);dialog.showOpenDialog=(owner,options)=>original(owner,{...options,defaultPath:root});},echoFolder);
  await echo.getByRole('button',{name:'Préparer une session ECHO'}).click();const choosing=echo.getByRole('button',{name:'Choisir le dossier de test'}).click();await echo.waitForTimeout(500);await native('picker');await choosing;
  await echo.getByRole('checkbox',{name:/J’autorise/}).check();await echo.getByRole('button',{name:'Démarrer l’observation'}).click();await native('open');await echo.waitForFunction(async()=>(await window.aether.getEcho()).context?.allowed===true,{},{timeout:15000});
  const echoContext=await echo.evaluate(()=>window.aether.getEcho());assert.equal(echoContext.sessions.length,1);assert.equal(echoContext.sessions[0].events.length,0);assert.equal(echoContext.context.application,'explorer.exe');assert.equal(echoContext.context.folder,echoFolder);
  await echo.getByRole('button',{name:'Arrêter et comprendre'}).click();await echo.waitForFunction(async()=>(await window.aether.getEcho()).state==='ready');await echo.getByRole('button',{name:'Supprimer cette session',exact:true}).click();await echo.getByRole('button',{name:'Confirmer la suppression de session'}).click();await echo.getByRole('button',{name:'Désactiver complètement ECHO'}).click();
  const echoAfter=await echo.evaluate(()=>window.aether.getEcho());assert.equal(echoAfter.state,'off');assert.equal(echoAfter.sessions.length,0);assert.equal(echoAfter.habits.length,0);assert.equal(echoAfter.opportunities.length,0);await native('close');
  const originalBounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.getTitle()==='AETHER · ENTITY').getBounds());
  await page.evaluate(()=>window.aether.command('portal'));const space=application.windows().find(window=>window.url().endsWith('#space'));assert(space);await space.locator('.portal-shell[data-portal-phase="open"]').waitFor();const actual=await space.evaluate(()=>window.aether.getSpace());
  for(const item of before.interests)assert(actual.data.curiosity.interests.some(value=>value.id===item.id&&value.title===item.title));assert.deepEqual(actual.data.curiosity.settings,before.settings);assert.deepEqual(actual.data.memories.map(item=>({id:item.id,content:item.content})).sort((a,b)=>a.id.localeCompare(b.id)),before.memories);
  await space.screenshot({path:'docs/recette-j5/paquet-space.png'});await settings.screenshot({path:'docs/recette-j5/paquet-reglages.png',fullPage:true});const spaceClosed=space.waitForEvent('close');await space.getByRole('button',{name:/Revenir au bureau/}).click();await spaceClosed;
  await page.waitForFunction(async()=>(await window.aether.getPortal()).phase==='closed');const returnedBounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.getTitle()==='AETHER · ENTITY').getBounds());assert.equal(returnedBounds.x,originalBounds.x);assert.equal(returnedBounds.y,originalBounds.y);assert(!application.windows().some(window=>window.url().endsWith('#space')));
  const after=database();assert.deepEqual(after.memories,before.memories);for(const item of before.interests)assert(after.interests.some(value=>value.id===item.id&&value.title===item.title));assert.deepEqual(after.settings,before.settings);
  const evidence={result:'PASS',checkedAt:new Date().toISOString(),executable,runtime,configuration,router,portalSettings,answer,originalBounds,returnedBounds,spaceDestroyed:true,profileIntegrity:{previousInterestIds:before.interests.map(item=>item.id),interestsBefore:before.interests.length,interestsAfter:after.interests.length,attemptsBefore:before.attempts,attemptsAfter:after.attempts,memoriesBefore:before.memories.length,memoriesAfter:after.memories.length,autonomyEnabledBefore:before.settings.enabled,autonomyEnabledAfter:after.settings.enabled,noTestImport:true},echoAtStartup,packagedHelper:{path:helperPath,context:echoContext.context,emptySessionDeleted:true,finalState:echoAfter.state},packagedEntries:files.length};
  await writeFile('docs/recette-j5/paquet-verifie.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await application.close();await native('close').catch(()=>{});await rm(echoFolder,{recursive:true,force:true});}
