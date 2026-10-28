// Explicit provider recipe: known synthetic audio, never opens a microphone.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createInterface} from 'node:readline';

export const phrases=["Comment t'appelles-tu ?","Retiens que mon animal préféré est le wombat.","Quel est mon animal préféré ?","Ouvre ton espace.","Regarde comment je fais.","Aether, qu'est-ce qui t'intéresse en ce moment ?"];
export async function syntheticAudio(text){
  return new Promise((resolveAudio,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('dist/main/voice-speech.ps1'),'-Operation','synthesize'],{windowsHide:true});
    let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',v=>output+=v);child.stderr.on('data',()=>{});child.on('error',reject);
    child.on('exit',code=>{try{const result=JSON.parse(output);if(code||result.error)throw new Error(result.error??'TTS failed');resolveAudio(Buffer.from(result.wav,'base64'));}catch(error){reject(error);}});
    child.stdin.end(JSON.stringify({text,voice:'Microsoft Hortense Desktop',speed:1,language:'fr-FR'}),'utf8');
  });
}
export async function modelPath(){const base=join(homedir(),'.cache/huggingface/hub/models--Systran--faster-whisper-medium/snapshots');return join(base,(await readdir(base))[0]);}
if(process.argv[1]?.endsWith('voice-local.mjs')){
  const child=spawn('python',['-u',resolve('dist/main/voice-worker.py')],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});
  const lines=createInterface({input:child.stdout});let next;let errors='';child.stderr.on('data',v=>errors+=v);lines.on('line',line=>next?.(JSON.parse(line)));
  child.on('error',error=>{throw error;});
  const request=input=>new Promise((ok,no)=>{next=v=>{if(v.type==='result')ok(v);else if(v.type==='error')no(new Error(v.message));};child.stdin.write(JSON.stringify({id:'recipe',...input})+'\n');});
  const evidence=[];
  try{const probe=await request({op:'probe'});console.log(JSON.stringify({runtime:probe.runtime,microphones:probe.microphones}));
    for(const text of phrases){const wav=await syntheticAudio(text),start=Date.now();const result=await request({op:'transcribe',wav:wav.toString('base64'),modelPath:await modelPath(),language:'fr-FR'});const entry={input:text,transcription:result.text,sttMs:Date.now()-start,bytes:wav.length,source:'Windows TTS synthesis; no microphone'};evidence.push(entry);console.log(JSON.stringify(entry));}
    await mkdir('docs/recette-voice',{recursive:true});await writeFile('docs/recette-voice/providers.json',JSON.stringify({date:new Date().toISOString(),runtime:probe.runtime,entries:evidence},null,2)+'\n');
  }catch(error){console.error(String(error),errors.slice(-1500));process.exitCode=1;}finally{child.kill();lines.close();}
}
