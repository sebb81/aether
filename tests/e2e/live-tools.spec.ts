import { test, expect, _electron as electron } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { LiveProviderEvent, LiveToolCall, LiveToolResult, LiveSnapshot } from '@aether/shared';
import type { DesktopLiveService } from '../../apps/desktop/main/live-service';
import type { DesktopMindService } from '../../apps/desktop/main/mind-service';
import { importJ3Receipt } from './space-fixture';

interface Harness { live:DesktopLiveService; mind:DesktopMindService; emit(event:LiveProviderEvent):void; results:LiveToolResult[] }
test('LIVE Tool Bridge actual AETHER services: minimized SQLite data, native SPACE/ECHO, human memory confirmation and Qwen DEEP',async()=>{
  test.setTimeout(180000);const profile=await mkdtemp(join(tmpdir(),'aether-live-tools-')),folder=resolve('test-results/live-tools'),fixture=join(folder,'services.cjs');await mkdir(folder,{recursive:true});importJ3Receipt(profile);
  await build({entryPoints:['tests/e2e/live-services-fixture.ts'],outfile:fixture,bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron']});
  const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.GEMINI_API_KEY;delete env.OPENAI_API_KEY;
  const app=await electron.launch({args:[resolve('.')],env:env as Record<string,string>});const proof:Record<string,unknown>={date:new Date().toISOString(),liveProvider:'Automated test double only. All AETHER services, SQLite, native windows and Ollama DEEP are real. No Gemini success claimed.'};
  try{
    const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();const state=await entity.evaluate(async()=>({presence:await window.aether.getSnapshot(),curiosity:await window.aether.getCuriosity(),echo:await window.aether.getEcho(),voice:await window.aether.getVoice()}));
    await app.evaluate(async({BrowserWindow},input)=>{
      const require=process.getBuiltinModule('node:module').createRequire(input.fixture);
      const modules=require(input.fixture) as {DesktopMindService:typeof import('../../apps/desktop/main/mind-service').DesktopMindService;DesktopLiveService:typeof import('../../apps/desktop/main/live-service').DesktopLiveService};
      const mind=new modules.DesktopMindService(input.profile);mind.saveConfiguration({provider:'ollama',model:'qwen3.5:9b',ollamaUrl:'http://127.0.0.1:11434',cloudConsent:false});mind.saveRouter({DEEP:{provider:'ollama',model:'qwen3.5:9b'},VISION:null});
      const entity=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='AETHER · ENTITY')!;
      const command=async(name:string)=>{const result=await entity.webContents.executeJavaScript(`window.aether.command(${JSON.stringify(name)})`) as {ok:boolean};if(!result.ok)throw new Error('Native command failed');};
      const live=new modules.DesktopLiveService(input.profile,mind,{voiceSettings:()=>({...input.state.voice.settings,microphoneConsent:'granted'}),presence:()=>input.state.presence,curiosity:()=>input.state.curiosity,echo:()=>input.state.echo,openSpace:()=>command('portal'),closeSpace:()=>{void entity.webContents.executeJavaScript('window.aether.command("recall")');},prepareEcho:()=>command('echo'),stopEcho:async()=>{},removeMemory:id=>mind.removeMemory(id),changedMemory:()=>{},confirmation:()=>command('live')});
      const {schemaVersion:_schema,provider:_provider,cloudConsent:_consent,...settings}=live.configuration();live.save({...settings,enabled:true,diagnostics:'detailed'});live.consent('grant');
      const testState:Harness={live,mind,emit:()=>{},results:[]};
      // Dependency injection here is confined to this isolated automation harness.
      const ports=(live.engine as unknown as {ports:{provider:()=>unknown;audio:unknown;configured:()=>unknown}}).ports;
      ports.provider=()=>({id:'automated-test-double',open:async(_input:unknown,event:(value:LiveProviderEvent)=>void)=>{testState.emit=event;},sendAudio:()=>{},activity:()=>{},respond:()=>{},close:()=>{},sendToolResult:(_call:unknown,result:LiveToolResult)=>testState.results.push(result)});
      ports.audio={source:'test-fixture',start:async()=>{},play:()=>{},interrupt:()=>{},close:()=>{}};ports.configured=()=>({keyConfigured:true,secureStorageAvailable:true,microphoneConsent:true});
      (globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness=testState;await live.engine.start();
    },{profile,fixture,state});
    let sequence=0;
    async function call(name:string,args:Record<string,string>={}){const id='fixture-'+(++sequence),before=await app.evaluate(()=>((globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.results.length));await app.evaluate((_electron,call)=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.emit({type:'tool-calls',calls:[call]}),{id,name,args} satisfies LiveToolCall);await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.results.length),{timeout:125000}).toBeGreaterThan(before);return app.evaluate(()=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.results.at(-1)!);}
    proof.status=await call('get_entity_status');
    const curiosity=await call('get_curiosity_summary');expect(curiosity.status).toBe('ok');expect(JSON.stringify(curiosity)).not.toContain('blockedDomains');proof.curiosity=curiosity;
    const interests=curiosity.interests as {id:string;title:string}[];const causal=interests.find(i=>i.title==='Causalité structurelle')!;expect(causal).toBeTruthy();proof.interest=await call('get_interest_details',{id:causal.id});
    const proposed=await call('remember_explicitly',{content:'Le projet fictif de recette du pont LIVE se nomme Luciole-Bridge-56.'});expect(proposed.status).toBe('confirmation_required');expect((await entity.evaluate(()=>window.aether.listMemories('Luciole-Bridge-56'))).length).toBe(0);
    await app.evaluate((_electron,id)=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.live.confirm(id,true),String(proposed.confirmationId));
    const memory=await call('search_memory',{query:'Luciole-Bridge-56'});expect(memory.status).toBe('ok');const records=memory.memories as {id:string;content:string}[];expect(records[0]?.content).toContain('Luciole-Bridge-56');expect(JSON.stringify(memory)).not.toContain('source');proof.memory=memory;
    proof.space=await call('open_space');await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#space'))).toBe(true);proof.closeSpace=await call('close_space');await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#space'))).toBe(false);
    proof.echo=await call('start_echo_guided');expect((proof.echo as LiveToolResult).status).toBe('consent_required');expect((await entity.evaluate(()=>window.aether.getEcho())).activeSessionId).toBeNull();
    const started=Date.now();const deep=await call('delegate_deep_reasoning',{prompt:'Propose deux hypothèses testables pour relier acoustique des résonateurs et causalité structurelle. Distingue prédictions et limites, en français.'});expect(deep.status).toBe('ok');expect(deep.route).toMatchObject({requested:'DEEP',selected:'DEEP',provider:'ollama',model:'qwen3.5:9b',fallback:false});expect(String(deep.text).length).toBeGreaterThan(20);proof.deep={...deep,observedMs:Date.now()-started};
    const forgotten=await call('forget_memory',{id:records[0]!.id});expect(forgotten.status).toBe('confirmation_required');expect((await entity.evaluate(()=>window.aether.listMemories('Luciole-Bridge-56'))).length).toBe(1);
    expect((await app.evaluate((_electron,id)=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.live.confirm(id,true),String(forgotten.confirmationId))).ok).toBe(true);expect((await entity.evaluate(()=>window.aether.listMemories('Luciole-Bridge-56'))).length).toBe(0);
    const ended=await app.evaluate(()=>(globalThis as unknown as {aetherLiveHarness:Harness}).aetherLiveHarness.live.engine.snapshot()) as LiveSnapshot;expect(ended.sessionId).toBeNull();proof.forget={humanConfirmation:true,removed:true,sessionClosed:true};proof.audit=ended.audit;
    await writeFile(join(folder,'tool-evidence.json'),JSON.stringify(proof,null,2)+'\n');
  }finally{await app.evaluate(()=>{const h=(globalThis as unknown as {aetherLiveHarness?:Harness}).aetherLiveHarness;h?.live.close();h?.mind.close();}).catch(()=>{});await app.close();await rm(profile,{recursive:true,force:true});}
});
