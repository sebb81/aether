import { _electron as electron } from '@playwright/test';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { listPackage, extractFile } from '@electron/asar';
import assert from 'node:assert/strict';

const evidence=resolve('docs/recette-j6'),root=resolve('release/AETHER-win32-x64'),executable=join(root,'AETHER.exe'),archive=join(root,'resources/app.asar'),helper=join(root,'resources/app.asar.unpacked/dist/main/capability-worker.cjs'),fixture=resolve('test-results/j6-package-runtime.cjs');
await mkdir(evidence,{recursive:true});await mkdir(resolve('test-results'),{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex'),entries=listPackage(archive).map(p=>p.replaceAll('\\','/'));
assert(entries.includes('/dist/main/capability-worker.cjs'));assert(existsSync(helper));assert.equal(hash(await readFile(helper)),hash(await readFile('dist/main/capability-worker.cjs')));assert.equal(hash(extractFile(archive,join('dist','main','main.cjs'))),hash(await readFile('dist/main/main.cjs')));
assert(!entries.some(p=>/^\/(apps|packages|tests|docs|node_modules|\.aether-test-data)\//.test(p)));
if(process.argv.includes('--integrity-only')){
  const proof={at:new Date().toISOString(),result:'PASS',executable,version:JSON.parse(extractFile(archive,'package.json').toString()).version,mainHash:hash(extractFile(archive,join('dist','main','main.cjs'))),helperHash:hash(await readFile(helper)),bundlesMatchCurrentBuild:true,sourceAndTestsExcluded:true,applicationLaunched:false};
  await writeFile(join(evidence,'post-crash-package-integrity.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));process.exit(0);
}
await build({entryPoints:['apps/desktop/main/evolution-runtime.ts'],outfile:fixture,bundle:true,platform:'node',format:'cjs',target:'node22'});
const profile=join(process.env.APPDATA,'AETHER'),tracked=['ai-settings.json','router-settings.json','voice-settings.json','live-settings.json'];
const before=Object.fromEntries(await Promise.all(tracked.map(async name=>[name,existsSync(join(profile,name))?hash(await readFile(join(profile,name))):null])));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:executable,args:[],env});
const proof={at:new Date().toISOString(),executable,helperHash:hash(await readFile(helper)),codeGeneration:false,capabilityAdoption:false,personalDataExported:false};
try{
  const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();proof.packaged=await app.evaluate(({app})=>({isPackaged:app.isPackaged,version:app.getVersion(),path:app.getAppPath()}));assert.equal(proof.packaged.version,'0.6.0');assert.equal(proof.packaged.isPackaged,true);
  const data=await entity.evaluate(async()=>({presence:await window.aether.getSnapshot(),evolution:await window.aether.getEvolution(),memories:await window.aether.listMemories(''),curiosity:await window.aether.getCuriosity(),voice:await window.aether.getVoice(),live:await window.aether.getLive()}));
  assert.equal(data.voice.microphoneActive,false);assert.equal(data.live.microphoneActive,false);assert.equal(data.evolution.activity,'idle');for(const key of ['forge','mirror','capabilities'])assert.equal(data.presence.features[key],'available');
  await entity.evaluate(()=>window.aether.command('forge'));const panel=app.windows().find(p=>p.url().endsWith('#forge'));assert(panel);await panel.getByRole('heading',{name:'Fabriquer une capacité',exact:true}).waitFor();await panel.screenshot({path:join(evidence,'packaged-forge.png'),fullPage:true});
  proof.runtime=await app.evaluate(async(_electron,input)=>{
    const require=process.getBuiltinModule('node:module').createRequire(input.fixture),{WindowsCapabilityRuntime}=require(input.fixture),runtime=new WindowsCapabilityRuntime(input.workspace,input.helper);
    return runtime.evaluate('exports.run=()=>({summary:"Infrastructure check only",renames:[],data:{sum:2+3,process:typeof process,fetch:typeof fetch}});',{files:[],parameters:{}},new AbortController().signal);
  },{fixture,workspace:join(profile,'evolution','runtime'),helper});assert.deepEqual(proof.runtime.data,{sum:5,process:'undefined',fetch:'undefined'});
  const after=await entity.evaluate(async()=>({memories:await window.aether.listMemories(''),curiosity:await window.aether.getCuriosity(),evolution:await window.aether.getEvolution()}));assert.deepEqual(after.memories,data.memories);for(const interest of data.curiosity.interests)assert(after.curiosity.interests.some(i=>i.id===interest.id&&i.title===interest.title));assert.deepEqual(after.curiosity.settings,data.curiosity.settings);assert.deepEqual(after.evolution.requests,data.evolution.requests);assert.deepEqual(after.evolution.capabilities,data.evolution.capabilities);
  proof.data={existingMemoryCount:data.memories.length,existingInterestCount:data.curiosity.interests.length,memoriesUnchanged:true,interestsPreserved:true,curiositySettingsPreserved:true,forgeRequests:after.evolution.requests.length,installed:after.evolution.capabilities.filter(c=>c.state==='INSTALLED').length};
}finally{await app.close();}
const afterFiles=Object.fromEntries(await Promise.all(tracked.map(async name=>[name,existsSync(join(profile,name))?hash(await readFile(join(profile,name))):null])));assert.deepEqual(afterFiles,before);proof.settingsUnchanged=tracked;proof.result='PASS';await writeFile(join(evidence,'package-evidence.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({result:proof.result,packaged:proof.packaged.version,nativeWasmMxc:true,data:proof.data}));
