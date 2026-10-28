// Supervised recipe only. The user authorizes/starts every microphone take in the UI.
// Evidence contains requested transcripts/state transitions; never raw audio.
import {_electron} from 'playwright';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createInterface} from 'node:readline';
const executable=resolve('release/AETHER-win32-x64/AETHER.exe');
const proofPath=process.argv.includes('--micro-diagnostic')?'docs/recette-voice/micro-human.json':'docs/recette-voice/human.json';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.AETHER_TEST_PROFILE;delete env.AETHER_TEST_VOICE_FIXTURES;
const proof={startedAt:new Date().toISOString(),source:'Actual user microphone; native PortAudio capture, faster-whisper, Ollama and Windows TTS. No audio retained.',sessions:[],runs:[],restarts:0};
let application,entity,run=null,lastState=null;
let observing=true;
const observationDeadline=setTimeout(()=>{observing=false;console.log(JSON.stringify({diagnosticFinished:true,reason:'Ten-minute observation limit; microphone remains controlled only by the user.'}));},10*60*1000);
observationDeadline.unref();
await mkdir('docs/recette-voice',{recursive:true});
async function save(){await writeFile(proofPath,JSON.stringify(proof,null,2)+'\n');}
async function launch(){
  application=await _electron.launch({executablePath:executable,env});entity=await application.firstWindow();await entity.locator('.entity-stage').waitFor();
  proof.sessions.push({runtime:await application.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion()})),startup:await entity.evaluate(()=>window.aether.getVoice())});
  await entity.exposeFunction('humanVoiceEvent',async value=>{
    if(!observing)return;
    if(value.state==='starting'&&lastState!=='starting'){run={startedAt:new Date().toISOString(),states:[],microphoneWasActive:false,peak:0,speakingObserved:false};proof.runs.push(run);}
    if(run){run.peak=Math.max(run.peak,value.audioLevel);run.microphoneWasActive||=value.microphoneActive;run.speakingObserved||=value.state==='speaking';if(value.state!==lastState)run.states.push({state:value.state,at:new Date().toISOString(),microphoneActive:value.microphoneActive});
      if(value.state==='idle'||value.state==='error'){Object.assign(run,{endedAt:new Date().toISOString(),transcription:value.transcription,fullResponse:value.fullResponse,spokenResponse:value.spokenResponse,metrics:value.metrics,error:value.error,notice:value.notice,source:value.source});await save();if(lastState!==value.state)console.log(JSON.stringify({completed:proof.runs.length,run}));}
    }
    lastState=value.state;
    if(value.microphoneActive&&value.state==='listening'&&run&&!run.listeningScreenshot){run.listeningScreenshot=true;await entity.screenshot({path:'docs/recette-voice/human-listening.png',omitBackground:true}).catch(()=>{});}
  });
  await entity.evaluate(()=>window.aether.onVoice(value=>{void window.humanVoiceEvent(value);}));
  await entity.evaluate(()=>window.aether.command('voice'));console.log(JSON.stringify({ready:true,phase:proof.restarts+1,executable,microphoneStarted:false}));await save();
}
await launch();
const input=createInterface({input:process.stdin});
for await(const command of input){
  if(command.trim()==='restart'){await application.close();proof.restarts++;lastState=null;run=null;await launch();}
  if(command.trim()==='snapshot'){proof.lastMind=await entity.evaluate(()=>window.aether.getMind());proof.lastVoice=await entity.evaluate(()=>window.aether.getVoice());proof.lastEcho=await entity.evaluate(()=>window.aether.getEcho());proof.lastPortal=await entity.evaluate(()=>window.aether.getPortal());const files=await readdir(join(process.env.APPDATA,'AETHER'),{recursive:true});proof.audioFiles=files.filter(name=>/\.(wav|mp3|webm|flac|ogg)$/i.test(String(name)));await save();console.log(JSON.stringify({snapshot:true,runs:proof.runs.length,voice:proof.lastVoice.state,microphoneActive:proof.lastVoice.microphoneActive,audioFiles:proof.audioFiles}));}
  if(command.trim()==='quit'){observing=false;clearTimeout(observationDeadline);await application.close();proof.finishedAt=new Date().toISOString();await save();break;}
}
