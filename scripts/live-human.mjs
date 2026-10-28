// Supervised recipe: only the user can grant consent and start the microphone.
// Record metadata only, never keys, transcripts, tool payloads or raw audio.
import {_electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';

const executable=resolve('release/AETHER-win32-x64/AETHER.exe');
const env={...process.env};
for(const name of ['ELECTRON_RUN_AS_NODE','AETHER_TEST_PROFILE','AETHER_TEST_LIVE_FIXTURES','AETHER_TEST_VOICE_FIXTURES'])delete env[name];
const application=await _electron.launch({executablePath:executable,env});
const entity=await application.firstWindow();await entity.locator('.entity-stage').waitFor();
const proof={startedAt:new Date().toISOString(),runtime:await application.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion()})),source:'Supervised personal application. Human audio quality and recipe acceptance require user validation.',states:[],metrics:[],audit:[],physicalMicrophoneObserved:false};
await mkdir('docs/recette-live',{recursive:true});
const save=()=>writeFile('docs/recette-live/human-session.json',JSON.stringify(proof,null,2)+'\n');
let previous='',writes=Promise.resolve(),observing=true;
const deadline=setTimeout(()=>{observing=false;console.log(JSON.stringify({observationFinished:true,applicationStillOpen:true}));},10*60*1000);deadline.unref();
await entity.exposeFunction('humanLiveMetadata',value=>{
  if(!observing)return;
  proof.physicalMicrophoneObserved||=value.microphoneActive&&value.source==='microphone';
  proof.metrics=value.metrics;proof.audit=value.audit;proof.last={state:value.state,sessionId:value.sessionId,keyConfigured:value.keyConfigured,microphoneActive:value.microphoneActive,source:value.source,audioProcessing:value.audioProcessing};
  const signature=JSON.stringify(proof.last);
  if(signature!==previous){previous=signature;proof.states.push({...proof.last,at:new Date().toISOString()});console.log(signature);writes=writes.then(save);}
});
await entity.evaluate(()=>window.aether.onLive(value=>{void window.humanLiveMetadata({state:value.state,sessionId:value.sessionId,keyConfigured:value.keyConfigured,microphoneActive:value.microphoneActive,source:value.source,metrics:value.metrics,audit:value.audit,audioProcessing:value.audioProcessing});}));
await entity.evaluate(()=>window.aether.command('live'));
const initial=await entity.evaluate(()=>window.aether.getLive());
proof.startup={state:initial.state,keyConfigured:initial.keyConfigured,microphoneActive:initial.microphoneActive,defaultMode:initial.settings.defaultMode,cloudConsent:initial.settings.cloudConsent};
await save();console.log(JSON.stringify({ready:true,executable,version:proof.runtime.version,keyConfigured:initial.keyConfigured,microphoneStarted:false}));
const input=createInterface({input:process.stdin});
for await(const command of input){
  if(command.trim()==='status'){const value=await entity.evaluate(()=>window.aether.getLive());console.log(JSON.stringify({state:value.state,keyConfigured:value.keyConfigured,microphoneActive:value.microphoneActive,source:value.source,sessionId:value.sessionId}));}
  if(command.trim()==='open-voice')await entity.evaluate(()=>window.aether.command('voice'));
  if(command.trim()==='quit'){observing=false;clearTimeout(deadline);await application.close();await writes;proof.finishedAt=new Date().toISOString();await save();break;}
}
