import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync,readFileSync,utimesSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {VoiceEngine,DEFAULT_VOICE_SETTINGS,parseVoiceWrite,shouldSpeak,spokenText,type VoiceDependencies} from '@aether/voice';
import {MindEngine,parseMindReply} from '@aether/mind';
import {SqliteMemoryRepository} from '@aether/memory';
import {PresenceModel,DEFAULT_PREFERENCES} from '@aether/core';
import {VoiceSettingsStore,VoiceDiagnosticStore} from '../../apps/desktop/main/voice-storage';
import {resolveVoicePython} from '../../apps/desktop/main/voice-runtime';
import type {AudioClip,VoiceSettings} from '@aether/shared';

const clip:AudioClip={wav:new Uint8Array(44),durationMs:1000,speechDetected:true,source:'microphone'};
const cfg:VoiceSettings={...DEFAULT_VOICE_SETTINGS,enabled:true,microphoneConsent:'granted',diagnostics:true};
function setup(overrides:Partial<VoiceDependencies>={},settings:VoiceSettings=cfg){
  const called={capture:0,stt:0,submit:0,tts:0,output:0,retained:0,cancelled:0};
  const ports:VoiceDependencies={capture:{start:async(_settings,started,level)=>{called.capture++;started('microphone');level(.25);return clip;},finish:()=>{}},stt:()=>({id:'test-stt',locality:'local',transcribe:async()=>{called.stt++;return {text:'Comment t’appelles-tu ?',language:'fr'};}}),tts:()=>({id:'test-tts',locality:'local',synthesize:async()=>{called.tts++;return {...clip,source:'synthesis'};}}),output:{play:async(_clip,_volume,started,level)=>{called.output++;started();level(.2);}},submit:async(_text,source)=>{assert.equal(source,'voice');called.submit++;return {ok:true};},answer:()=>({full:'Je suis ENTITY. Voici une réponse détaillée.',spoken:'Je suis ENTITY.'}),cancelMind:()=>{called.cancelled++;},retain:async()=>{called.retained++;},...overrides};
  return {engine:new VoiceEngine(settings,ports),called,ports};
}
test('VOICE crosses real lifecycle boundaries and uses the common submit port once',async()=>{
  const {engine,called}=setup();const states:string[]=[];engine.events.on('changed',v=>states.push(v.state));
  assert.deepEqual(await engine.listen(),{ok:true});assert.equal(called.submit,1);assert.equal(called.tts,1);assert.equal(called.retained,0);
  for(const state of ['starting','listening','transcribing','processing','synthesizing','speaking','idle'])assert(states.includes(state));
  assert.equal(engine.snapshot().microphoneActive,false);assert.equal(engine.snapshot().audioLevel,0);assert.equal(engine.snapshot().spokenResponse,'Je suis ENTITY.');assert.equal(engine.snapshot().metrics!.totalMs!==null,true);
});
test('denied, prompt, disabled VOICE and absent STT never open the microphone',async()=>{
  for(const settings of [{...cfg,microphoneConsent:'denied' as const},{...cfg,microphoneConsent:'prompt' as const},{...cfg,enabled:false},{...cfg,sttProvider:'disabled' as const}]){
    const {engine,called}=setup({},settings);assert.equal((await engine.listen()).ok,false);assert.equal(called.capture,0);assert.equal(called.submit,0);assert.equal(engine.snapshot().state,'error');assert.equal(engine.snapshot().microphoneActive,false);
  }
});
test('provider factories and cloud guards fail before capture, without fabricating a message',async()=>{
  for(const stt of [()=>{throw new Error('model missing');},()=>({id:'cloud',locality:'cloud' as const,transcribe:async()=>({text:'',language:'fr'})})]){
    const {engine,called}=setup({stt});assert.equal((await engine.listen()).ok,false);assert.equal(called.capture,0);assert.equal(called.submit,0);assert.equal(engine.snapshot().microphoneActive,false);
  }
});
test('missing/busy microphone and STT failures leave a recoverable error',async()=>{
  const failure=async()=>{throw new Error('microphone occupé');};const {engine,called}=setup({capture:{start:failure,finish:()=>{}}});
  assert.equal((await engine.listen()).ok,false);assert.match(engine.snapshot().error!,/occupé/);assert.equal(called.submit,0);
  engine.configure(cfg);assert.equal(engine.snapshot().state,'idle');
  const stt=setup({stt:()=>({id:'error',locality:'local',transcribe:failure})});assert.equal((await stt.engine.listen()).ok,false);assert.equal(stt.engine.snapshot().microphoneActive,false);assert.equal(stt.called.submit,0);
});
test('silence and empty transcripts do not invoke MIND',async()=>{
  const silence=setup({capture:{start:async()=>({...clip,speechDetected:false}),finish:()=>{}}});assert.equal((await silence.engine.listen()).ok,true);assert.equal(silence.called.stt,0);assert.equal(silence.called.submit,0);
  const empty=setup({stt:()=>({id:'empty',locality:'local',transcribe:async()=>({text:'  ',language:'fr'})})});assert.equal((await empty.engine.listen()).ok,true);assert.equal(empty.called.submit,0);assert.equal(empty.engine.snapshot().state,'idle');
});
test('cancellation rejects overlapping takes and ignores late capture/amplitude events',async()=>{
  let end!:(c:AudioClip)=>void,level!:(v:number)=>void,started!:()=>void;let signal:AbortSignal|undefined;
  const {engine,called}=setup({capture:{start:(_cfg,onStarted,onLevel,inputSignal)=>{signal=inputSignal;level=onLevel;started=()=>onStarted('microphone');return new Promise(resolve=>{end=resolve;});},finish:()=>{}}});
  const pending=engine.listen();started();assert.equal(engine.snapshot().microphoneActive,true);assert.equal((await engine.listen()).ok,false);
  engine.stop();assert.equal(signal!.aborted,true);level(1);started();end(clip);assert.equal((await pending).ok,false);assert.equal(engine.snapshot().state,'idle');assert.equal(engine.snapshot().microphoneActive,false);assert.equal(engine.snapshot().audioLevel,0);assert.equal(called.submit,0);
});
test('manual playback interruption aborts output and late levels cannot restore speaking',async()=>{
  let finish!:()=>void,signal:AbortSignal|undefined,level!:(n:number)=>void;
  const {engine}=setup({output:{play:async(_clip,_volume,started,onLevel,s)=>{signal=s;level=onLevel;started();await new Promise<void>(resolve=>{finish=resolve;});}}});
  const pending=engine.listen();while(engine.state()!=='speaking')await new Promise(resolve=>setImmediate(resolve));
  engine.stop();assert.equal(signal!.aborted,true);level(1);finish();await pending;assert.equal(engine.snapshot().state,'idle');assert.equal(engine.snapshot().audioLevel,0);
});
test('interrupting processing cancels the shared MIND and discards its late answer',async()=>{
  let complete!:(v:{ok:true})=>void;const {engine,called}=setup({submit:()=>new Promise(resolve=>{complete=resolve;})});const pending=engine.listen();while(engine.state()!=='processing')await new Promise(resolve=>setImmediate(resolve));engine.stop();complete({ok:true});await pending;assert.equal(called.cancelled,1);assert.equal(called.tts,0);
});
test('TTS failure preserves the actual full response; MIND failure produces no oral answer',async()=>{
  const tts=setup({tts:()=>{throw new Error('TTS absent');}});assert.equal((await tts.engine.listen()).ok,false);assert.match(tts.engine.snapshot().fullResponse!,/ENTITY/);assert.equal(tts.called.output,0);
  const mind=setup({submit:async()=>({ok:false,error:'MIND indisponible'})});assert.equal((await mind.engine.listen()).ok,false);assert.equal(mind.called.tts,0);assert.equal(mind.engine.snapshot().fullResponse,null);
});
test('output policies distinguish typed/voice messages and never duplicate the brain',async()=>{
  for(const policy of ['always','voice-only','never'] as const){assert.equal(shouldSpeak({...cfg,responsePolicy:policy},'text'),policy==='always');assert.equal(shouldSpeak({...cfg,responsePolicy:policy},'voice'),policy!=='never');const {engine,called}=setup({},{...cfg,responsePolicy:policy});await engine.afterText();assert.equal(called.tts,policy==='always'?1:0);assert.equal(called.submit,0);await engine.listen();assert.equal(called.tts,policy==='always'?2:policy==='voice-only'?1:0);}
  assert.equal(shouldSpeak({...cfg,ttsEnabled:false},'voice'),false);
});
test('audio retention is opt-in and diagnostic metrics are hidden by default',async()=>{
  const off=setup({},{...cfg,diagnostics:false});await off.engine.listen();assert.equal(off.called.retained,0);assert.equal(off.engine.snapshot().metrics,null);
  const on=setup({},{...cfg,retainDiagnosticAudio:true});await on.engine.listen();assert.equal(on.called.retained,1);
});
test('VOICE settings reject permission escalation, cloud/wake providers and invalid ranges',()=>{
  const {schemaVersion:_,microphoneConsent:__,...write}=cfg;assert.deepEqual(parseVoiceWrite(write),write);
  for(const input of [{...write,microphoneConsent:'granted'},{...write,wakeWordEnabled:true},{...write,sttProvider:'cloud'},{...write,speed:NaN},{...write,volume:2},{...write,diagnostics:false,retainDiagnosticAudio:true}])assert.throws(()=>parseVoiceWrite(input));
  assert(spokenText('x '.repeat(500)).length<500);assert.equal(spokenText('Longue réponse','**Bonjour**'),'Bonjour');
});
test('settings persist consent and defaults, corrupt files stay inspectable and do not grant access',()=>{
  const root=mkdtempSync(join(tmpdir(),'aether-voice-settings-'));try{const path=join(root,'voice-settings.json'),store=new VoiceSettingsStore(path);const defaults=store.load();assert.equal(defaults.enabled,false);assert.equal(defaults.microphoneConsent,'prompt');store.save(cfg);assert.deepEqual(new VoiceSettingsStore(path).load(),{...cfg,pythonPath:resolveVoicePython(cfg.pythonPath)});writeFileSync(path,'broken');assert.equal(store.load().microphoneConsent,'prompt');assert(store.notice);assert(readdirSync(root).some(n=>n.includes('.invalid-')));}finally{rmSync(root,{recursive:true,force:true});}
});
test('audio store creates no files by default, limits opt-in clips and expires/deletes only its own files',()=>{
  const root=mkdtempSync(join(tmpdir(),'aether-voice-audio-'));try{const store=new VoiceDiagnosticStore(root);assert.deepEqual(store.list(),[]);store.clear();assert.deepEqual(readdirSync(root),[]);for(let i=0;i<7;i++)store.retain(clip);assert.equal(store.list().length,5);const old=store.list()[0]!;utimesSync(join(root,'voice-diagnostics',old.id+'.wav'),new Date(0),new Date(0));assert.equal(store.list().length,4);const foreign=join(root,'voice-diagnostics','keep.txt');writeFileSync(foreign,'keep');store.clear();assert.equal(store.list().length,0);assert.equal(readFileSync(foreign,'utf8'),'keep');}finally{rmSync(root,{recursive:true,force:true});}
});
test('PRESENCE exposes real capture permission independently from ECHO and drops levels on stop',()=>{
  const model=new PresenceModel(DEFAULT_PREFERENCES,true,true,false,false,true,true);model.setEchoActive(true);model.setVoiceActivity(true,.4);model.setState('listening');assert.equal(model.snapshot().permissions.microphone,true);assert.equal(model.snapshot().echoActive,true);model.setVoiceActivity(false,0);model.setState('speaking');assert.equal(model.snapshot().permissions.microphone,false);assert.equal(model.snapshot().permissions['echo.observe'],true);
});
test('MIND structured replies allow only closed capabilities and both modalities share memory/history',async()=>{
  assert.throws(()=>parseMindReply(JSON.stringify({fullResponse:'x',spokenResponse:'x',action:'windows.execute'})));assert.throws(()=>parseMindReply('{"fullResponse":"x"}'));
  const memory=new SqliteMemoryRepository(':memory:');const actions:string[]=[];const requests:string[]=[];
  const mind=new MindEngine(async()=>({id:'test',complete:async req=>{requests.push(JSON.stringify(req.messages));return {text:JSON.stringify({fullResponse:'Je t’ouvre mon espace.',spokenResponse:'Voici mon espace.',action:'portal.open'}),model:'test'};}}),memory);
  mind.enableInteraction(async action=>{actions.push(action);assert.equal(mind.snapshot().state,'replying');return {ok:true};});
  try{await mind.submit('Retiens que mon animal préféré est le wombat.','voice');await mind.submit('Ouvre ton espace.','text');assert.equal((await memory.list()).length,1);assert.deepEqual(mind.snapshot().messages.filter(m=>m.role==='user').map(m=>m.modality),['voice','text']);assert.equal(mind.snapshot().messages.at(-1)!.spokenResponse,'Voici mon espace.');assert.equal(actions.length,2);assert.match(requests[1]!,/wombat/);}finally{memory.close();}
});
test('failed navigation publishes no fabricated success and invalid JSON executes no action',async()=>{
  const memory=new SqliteMemoryRepository(':memory:');let actions=0;const mind=new MindEngine(async()=>({id:'test',complete:async()=>({text:JSON.stringify({fullResponse:'Ouvert',spokenResponse:'Ouvert',action:'portal.open'}),model:'test'})}),memory);mind.enableInteraction(async()=>{actions++;return {ok:false,error:'Navigation indisponible'};});try{assert.equal((await mind.submit('Ouvre')).ok,false);assert.equal(actions,1);assert.equal(mind.snapshot().messages.filter(m=>m.role==='assistant').length,0);}finally{memory.close();}
});
