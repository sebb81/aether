import { createInterface } from 'node:readline';
import { GeminiLiveProvider } from './gemini-live-provider';
import type { LiveConversationProvider, LiveProviderEvent, LiveToolCall, LiveToolResult } from '@aether/shared';

// stdout is exclusively bounded NDJSON. No SDK error/URL or credentials reach logs.
console.warn=()=>{};console.error=()=>{};console.log=()=>{};
const controller=new AbortController();let key:string|null=null;
const provider=new GeminiLiveProvider(()=>key);
function emit(value:object){if(process.stdout.writableLength>2000000){shutdown();return;}process.stdout.write(JSON.stringify(value)+'\n');}
function event(value:LiveProviderEvent){emit({type:'event',event:value.type==='audio'?{...value,pcm:Buffer.from(value.pcm).toString('base64')}:value});}
function shutdown(){controller.abort();provider.close();key=null;process.exit(0);}
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
  if(line.length>1000000){shutdown();return;}
  try{
    const value=JSON.parse(line) as Record<string,unknown>;
    if(value.command==='open'){
      if(key||typeof value.key!=='string')throw new Error('Invalid open');key=value.key;
      void provider.open(value.input as Parameters<LiveConversationProvider['open']>[0],event,controller.signal).then(()=>emit({type:'ready'}),()=>{event({type:'error',message:'Connexion Gemini impossible. Vérifiez clé, modèle, quota et Internet.'});shutdown();});
    }else if(value.command==='audio'&&typeof value.pcm==='string')provider.sendAudio(Buffer.from(value.pcm,'base64'));
    else if(value.command==='activity'&&typeof value.start==='boolean')provider.activity(value.start);
    else if(value.command==='respond')provider.respond();
    else if(value.command==='tool-result')provider.sendToolResult(value.call as LiveToolCall,value.result as LiveToolResult);
    else throw new Error('Invalid command');
  }catch{event({type:'error',message:'Flux Gemini Live interrompu.'});shutdown();}
});
lines.on('close',shutdown);process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);process.stdout.on('error',shutdown);
