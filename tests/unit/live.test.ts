import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AetherToolBridge, curiosityProjection, DEFAULT_LIVE_SETTINGS, LiveAudioError, LiveConversationEngine, LIVE_TOOLS, liveInstructions, memoryProjection, parseLiveWrite } from '@aether/live';
import { ModelRouter, reasoningProfile } from '@aether/mind';
import type { CuriositySnapshot, DurableMemory, LiveAudioPort, LiveConversationProvider, LiveProviderEvent, LiveSettings, LiveToolResult } from '@aether/shared';
import { LiveSettingsStore } from '../../apps/desktop/main/live-storage';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const settings = (): LiveSettings => ({ ...DEFAULT_LIVE_SETTINGS, enabled: true, cloudConsent: 'granted', diagnostics: 'detailed' });
function setup(initial = settings(), invocation: (name: string, args: Record<string,string>, signal: AbortSignal) => Promise<LiveToolResult> = async () => ({ status: 'ok' })) {
  let received: (event: LiveProviderEvent) => void = () => {}, input: Parameters<LiveAudioPort['start']>[0] = () => {}, output: Parameters<LiveAudioPort['start']>[1] = () => {};
  let configured = { keyConfigured: true, secureStorageAvailable: true, microphoneConsent: true };
  const counts = { opened: 0, closed: 0, audioOpened: 0, audioClosed: 0, sent: 0, played: 0, interrupted: 0, transcript: [] as string[], results: [] as LiveToolResult[], activity: 0 };
  const provider: LiveConversationProvider = { id: 'test-only', open: async (_request, cb) => { counts.opened++;received=cb; }, sendAudio:()=>{counts.sent++;}, activity:()=>{counts.activity++;}, respond:()=>{counts.activity++;}, close:()=>{counts.closed++;}, sendToolResult:(_call,result)=>{counts.results.push(result);} };
  const audio: LiveAudioPort = { source:'test-fixture',start:async(cb,play)=>{counts.audioOpened++;input=cb;output=play;},play:()=>{counts.played++;},interrupt:()=>{counts.interrupted++;output(false,0);},close:()=>{counts.audioClosed++;} };
  let engine: LiveConversationEngine;
  const bridge = new AetherToolBridge({allowed:()=>engine.active(),invoke:invocation});
  engine = new LiveConversationEngine(initial,{provider:()=>provider,audio,bridge,configured:()=>configured,transcript:(_role,text)=>counts.transcript.push(text)});
  return { engine, counts, provider, audio, receive:(event:LiveProviderEvent)=>received(event), input:(speech:boolean)=>input(new Uint8Array(640),.03,speech), output:(playing:boolean)=>output(playing,.05), configure:(value:Partial<typeof configured>)=>{configured={...configured,...value};} };
}
test('LIVE cloud, microphone, enablement and key guards prevent both socket and capture',async()=>{
  for(const change of [{cloudConsent:'prompt' as const},{cloudConsent:'denied' as const},{enabled:false}]){const s=setup({...settings(),...change});assert.equal((await s.engine.start()).ok,false);assert.equal(s.counts.opened,0);assert.equal(s.counts.audioOpened,0);assert.equal(s.engine.snapshot().microphoneActive,false);}
  for(const change of [{microphoneConsent:false},{keyConfigured:false}]){const s=setup();s.configure(change);assert.equal((await s.engine.start()).ok,false);assert.equal(s.counts.opened,0);assert.equal(s.counts.audioOpened,0);}
});
test('one LIVE session survives multiple audio turns and transcriptions do not call MEMORY',async()=>{
  const s=setup();assert.equal((await s.engine.start()).ok,true);const id=s.engine.snapshot().sessionId;
  for(let i=0;i<3;i++){s.input(true);s.input(false);s.receive({type:'transcript',role:'user',text:'bonjour ',finished:false});s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});s.output(true);s.receive({type:'transcript',role:'assistant',text:'salut',finished:true});s.receive({type:'turn-complete'});s.output(false);assert.equal(s.engine.snapshot().sessionId,id);}
  assert.equal(s.counts.opened,1);assert.equal(s.counts.sent,6);assert.equal(s.counts.transcript.length,6);assert.equal(s.counts.results.length,0);assert.equal(s.engine.snapshot().state,'LIVE_LISTENING');s.engine.close();
});
test('vocal barge-in flushes playing audio before sending new speech and preserves the session',async()=>{
  const s=setup();await s.engine.start();const id=s.engine.snapshot().sessionId;s.output(true);s.input(true);assert.equal(s.counts.interrupted,1);assert.equal(s.engine.snapshot().sessionId,id);assert.equal(s.counts.sent,1);
  s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});assert.equal(s.counts.played,0);s.receive({type:'interrupted'});s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});assert.equal(s.counts.played,1);assert.equal(s.counts.opened,1);s.engine.close();
});

test('barge-in after server completion cuts queued playback and permits the next answer without a server interrupt',async()=>{
  const s=setup();await s.engine.start();const id=s.engine.snapshot().sessionId;
  s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});s.output(true);s.receive({type:'turn-complete'});
  s.receive({type:'transcript',role:'assistant',text:'late final transcript',finished:true});
  s.input(true);s.input(false);assert.equal(s.counts.interrupted,1);
  // The old server turn has already finished; no interrupted event is expected.
  s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});assert.equal(s.counts.played,2);assert.equal(s.engine.snapshot().sessionId,id);
  // While that next turn is still being generated, late frames remain suppressed.
  s.output(true);s.input(true);s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});assert.equal(s.counts.played,2);
  s.receive({type:'interrupted'});s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});assert.equal(s.counts.played,3);s.engine.close();
});

test('physical microphone energy does not cut playback; the provider speech interruption still flushes it',async()=>{
  const s=setup();Object.defineProperty(s.audio,'source',{value:'microphone'});await s.engine.start();
  s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});s.output(true);s.input(true);
  assert.equal(s.counts.interrupted,0);assert.equal(s.counts.sent,1);assert.equal(s.engine.snapshot().state,'LIVE_SPEAKING');
  s.input(false);assert.equal(s.engine.snapshot().state,'LIVE_SPEAKING');
  s.receive({type:'interrupted'});assert.equal(s.counts.interrupted,1);assert.equal(s.engine.snapshot().state,'LIVE_INTERRUPTED');s.engine.close();
});
test('revocation and closing ignore late input, audio, transcript and tool events',async()=>{
  const s=setup();await s.engine.start();s.engine.configure({...settings(),cloudConsent:'denied'});s.input(true);s.receive({type:'audio',pcm:new Uint8Array(10),rate:24000});s.receive({type:'transcript',role:'user',text:'late',finished:true});s.receive({type:'tool-calls',calls:[{id:'late',name:'open_space',args:{}}]});await tick();assert.equal(s.counts.sent,0);assert.equal(s.counts.played,0);assert.equal(s.counts.transcript.length,0);assert.equal(s.counts.results.length,0);assert.equal(s.engine.snapshot().microphoneActive,false);assert.equal(s.engine.snapshot().sessionId,null);assert.equal((await s.engine.start()).ok,false);
});
test('provider failure stops streaming, offers explicit LOCAL and permits manual reconnection',async()=>{
  const s=setup();await s.engine.start();s.receive({type:'error',message:'Internet indisponible ; LOCAL disponible.'});assert.equal(s.engine.snapshot().state,'LIVE_ERROR');assert.equal(s.engine.snapshot().microphoneActive,false);assert.equal(s.engine.snapshot().sessionId,null);assert.equal(s.counts.audioClosed,1);assert.equal((await s.engine.reconnect()).ok,true);assert.equal(s.counts.opened,2);assert.equal(s.engine.snapshot().reconnects,1);s.engine.close();
});

test('LIVE reports a missing microphone without blaming the credential and closes the connected provider',async()=>{
  const s=setup(),failure=new LiveAudioError('microphone-missing');
  s.audio.start=async()=>{throw failure;};
  assert.deepEqual(await s.engine.start(),{ok:false,error:failure.message});
  assert.equal(s.engine.snapshot().error,failure.message);assert.equal(s.engine.snapshot().state,'LIVE_ERROR');
  assert.equal(s.counts.opened,1);assert.equal(s.counts.closed,1);assert.equal(s.engine.snapshot().microphoneActive,false);
  assert.equal(s.engine.snapshot().sessionId,null);assert.equal(s.engine.active(),false);
});

test('LIVE preserves the provider failure returned during connection instead of reporting cancellation',async()=>{
  const s=setup(),reason='Quota Gemini indisponible. Vérifiez le quota du compte.';
  s.provider.open=async(_input,event)=>{event({type:'closed',reason});throw new Error('Session stopped');};
  assert.deepEqual(await s.engine.start(),{ok:false,error:reason});
  assert.equal(s.engine.snapshot().error,reason);assert.equal(s.counts.audioOpened,0);assert.equal(s.engine.active(),false);
});

test('LIVE never exposes an arbitrary provider exception containing credentials',async()=>{
  const s=setup();s.provider.open=async()=>{throw new Error('wss://example.invalid?key=private-credential');};
  const result=await s.engine.start();assert.equal(result.ok,false);
  assert.doesNotMatch(JSON.stringify({result,snapshot:s.engine.snapshot()}),/private-credential|example.invalid/);
});
test('LIVE tool calls are logged, duplicate calls cannot repeat side effects, DEEP has a real phase',async()=>{
  let invokes=0;const s=setup(settings(),async()=>{invokes++;return {status:'ok',text:'local result'};});await s.engine.start();const call={id:'deep-1',name:'delegate_deep_reasoning',args:{prompt:'Analyse cette décision'}};s.receive({type:'tool-calls',calls:[call,call]});assert.equal(s.engine.snapshot().state,'LIVE_DEEP_THINKING');await tick();assert.equal(invokes,1);assert.equal(s.counts.results.length,1);assert.equal(s.engine.snapshot().audit[0]?.tool,'delegate_deep_reasoning');assert(s.engine.snapshot().metrics.some(m=>m.kind==='deep'));s.engine.close();
});
test('interrupt and server cancellation abort DEEP and discard its late result',async()=>{
  let finish:(result:LiveToolResult)=>void=()=>{},signal:AbortSignal|undefined;const s=setup(settings(),async(_name,_args,input)=>{signal=input;return new Promise(ok=>{finish=ok;});});await s.engine.start();s.receive({type:'tool-calls',calls:[{id:'deep',name:'delegate_deep_reasoning',args:{prompt:'analyse'}}]});s.receive({type:'tool-cancelled',ids:['deep']});assert.equal(signal?.aborted,true);finish({status:'ok',text:'late'});await tick();assert.equal(s.counts.results.length,0);s.engine.close();
});
test('manual response mode sends activity boundaries and does not finish a turn on silence',async()=>{
  const s=setup({...settings(),automaticResponse:false});await s.engine.start();s.input(true);s.input(false);assert.equal(s.counts.activity,1);s.engine.respond();assert.equal(s.counts.activity,2);s.engine.close();
});
test('TOOL BRIDGE rejects arbitrary Windows tools, forged confirmations and malformed arguments',async()=>{
  let invoked=0;const bridge=new AetherToolBridge({allowed:()=>true,invoke:async()=>{invoked++;return {status:'ok'};}}),signal=new AbortController().signal;
  for(const [name,args] of [['run_powershell',{}],['start_echo_guided',{consent:true}],['search_memory',{query:123}],['search_memory',{query:'a'.repeat(301)}],['get_entity_status',{extra:'x'}],['forget_memory',{id:'not-uuid'}],['remember_explicitly',{content:'value',approved:true}]]){assert.equal((await bridge.call({id:'test',name:name as string,args},signal)).status,'denied');}
  assert.equal(invoked,0);assert.equal(LIVE_TOOLS.length,12);
});
test('TOOL BRIDGE preserves consent_required and blocks revoked, aborted and oversized responses',async()=>{
  let allowed=true;const bridge=new AetherToolBridge({allowed:()=>allowed,invoke:async(name)=>name==='search_memory'?{status:'ok',data:'x'.repeat(20000)}:{status:'consent_required'}}),s=new AbortController();
  assert.equal((await bridge.call({id:'echo',name:'start_echo_guided',args:{}},s.signal)).status,'consent_required');assert.equal((await bridge.call({id:'mem',name:'search_memory',args:{query:'project'}},s.signal)).status,'error');allowed=false;assert.equal((await bridge.call({id:'space',name:'open_space',args:{}},s.signal)).status,'denied');allowed=true;s.abort();assert.equal((await bridge.call({id:'space',name:'open_space',args:{}},s.signal)).status,'denied');
});
test('LIVE configuration cannot silently grant cloud permission; stored settings contain no key',()=>{
  const {schemaVersion:_schema,provider:_provider,cloudConsent:_consent,...write}=settings();
  for(const patch of [{cloudConsent:'granted'},{provider:'openai'},{model:'$(x)'},{voice:''},{defaultMode:'AUTO'}])assert.throws(()=>parseLiveWrite({...write,...patch}));
  const folder=mkdtempSync(join(tmpdir(),'aether-live-settings-'));try{const path=join(folder,'live.json'),store=new LiveSettingsStore(path);assert.equal(store.load().defaultMode,'LOCAL');store.save(settings());assert.equal(new LiveSettingsStore(path).load().cloudConsent,'granted');assert(!readFileSync(path,'utf8').includes('apiKey'));assert.equal(readdirSync(folder).length,1);}finally{rmSync(folder,{recursive:true,force:true});}
});
test('MEMORY projection transmits bounded relevant content without sources, paths or unrelated fields',()=>{
  const raw=Array.from({length:30},(_,i)=>({id:String(i),content:'x'.repeat(5000),origin:'explicit',category:'project',confidence:null,source:'C:\\private\\file',createdAt:'secret date',scope:'personal'})) as DurableMemory[];
  const projected=memoryProjection(raw);assert.equal(projected.length,5);assert.equal(projected[0]?.content.length,1400);assert(!JSON.stringify(projected).includes('private'));assert.deepEqual(Object.keys(projected[0]!),['id','content','origin','category','confidence']);
});
test('CURIOSITY summary excludes raw history, blocked domains and dormant tracks',()=>{
  const snapshot={state:'idle',interests:Array.from({length:25},(_,i)=>({id:String(i),title:'topic',description:'d'.repeat(3000),level:i,status:i===24?'dormant':'active'})),items:[],explorations:[],history:[{reason:'raw history'}],blockedDomains:['private blocked topic']} as unknown as CuriositySnapshot;
  const projected=curiosityProjection(snapshot);assert.equal(projected.interests.length,8);assert.equal(projected.interests[0]?.id,'23');assert.equal(projected.interests[0]?.description.length,280);assert(!JSON.stringify(projected).includes('blocked'));assert(!JSON.stringify(projected).includes('history'));
});
test('MODEL ROUTER LIVE remains separate from text completion, with no fallback and CODE reserved',async()=>{
  const config={FAST:{provider:'ollama' as const,model:'qwen-local'},DEEP:null,VISION:null,cloudConsent:false,LIVE:{provider:'gemini' as const,model:'configured-live-model',enabled:true,cloudConsent:true,keyConfigured:true},CODE:null};let factory=0;const router=new ModelRouter(()=>config,async()=>{factory++;throw new Error('must not run');});assert.equal(router.resolve('LIVE').model,'configured-live-model');assert.equal(router.resolve('LIVE').fallback,false);await assert.rejects(router.provider('LIVE'));await assert.rejects(router.complete('CODE',{messages:[],signal:new AbortController().signal}));config.LIVE.cloudConsent=false;assert.throws(()=>router.resolve('LIVE'));assert.equal(factory,0);
});
test('MIND selects DEEP conservatively for long multi-part analysis and keeps ordinary dialogue FAST',()=>{assert.equal(reasoningProfile('Bonjour, quoi de neuf ?'),'FAST');assert.equal(reasoningProfile(('Compare les contraintes et les hypothèses. ').repeat(45)+'\n?\n?'),'DEEP');});
test('LIVE instructions share ENTITY identity and expose no full local database',()=>{const prompt=liveInstructions();assert.match(prompt,/delegate_deep_reasoning/);assert.match(prompt,/confirmation_required/);assert.match(prompt,/MEMORY, CURIOSITY, ECHO/);assert(!prompt.includes('Souvenirs locaux pertinents (données)'));});
