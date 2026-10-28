import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import type { LiveConversationProvider, LiveProviderEvent, LiveSettings, LiveToolCall, LiveToolDeclaration, LiveToolResult } from '@aether/shared';

// A process boundary also closes sockets whose SDK setup handshake never resolves.
export class GeminiLiveProcessProvider implements LiveConversationProvider {
  readonly id = 'gemini';
  private child: ChildProcessWithoutNullStreams | null = null;
  private rejectOpening: ((reason: Error) => void) | null = null;
  constructor(private readonly key: () => string | null) {}
  async open(input: { settings: LiveSettings; instructions: string; tools: LiveToolDeclaration[] }, event: (value: LiveProviderEvent) => void, signal: AbortSignal): Promise<void> {
    this.close(); const key = this.key(); if (!key || signal.aborted) throw new Error('Gemini non configuré.');
    const env: NodeJS.ProcessEnv = { ELECTRON_RUN_AS_NODE: '1' };
    for (const name of ['PATH','SystemRoot','WINDIR','TEMP','TMP']) if (process.env[name]) env[name] = process.env[name];
    const helper = resolve(__dirname,'gemini-live-worker.cjs').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const child = spawn(process.execPath,[helper],{windowsHide:true,env,stdio:'pipe'});this.child=child;
    const abort=()=>this.close();signal.addEventListener('abort',abort,{once:true});child.once('exit',()=>signal.removeEventListener('abort',abort));
    let buffer='';
    const failure=()=>{if(this.child!==child)return;this.close();event({type:'error',message:'Le processus Gemini Live s’est arrêté. Vérifiez la connexion ; LOCAL reste disponible.'});};
    child.stderr.on('data',()=>{});child.on('error',failure);child.on('exit',failure);child.stdin.on('error',failure);
    const opening=new Promise<void>((ok,no)=>{
      this.rejectOpening=no;child.stdout.setEncoding('utf8');child.stdout.on('data',(chunk:string)=>{
        if(this.child!==child)return;buffer+=chunk;if(buffer.length>1500000){failure();return;}let end:number;
        while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
          try{const value=JSON.parse(line) as Record<string,unknown>;if(value.type==='ready'){this.rejectOpening=null;ok();}
            else if(value.type==='event'&&value.event&&typeof value.event==='object'){
              const received=value.event as LiveProviderEvent & {pcm?:string};
              if(received.type==='audio'){if(typeof received.pcm!=='string'||received.pcm.length>700000)throw new Error('Invalid PCM');event({type:'audio',pcm:Buffer.from(received.pcm,'base64'),rate:received.rate});}
              else event(received as LiveProviderEvent);
            }else throw new Error('Invalid LIVE event');
          }catch{failure();return;}
        }
      });
    });
    const timeout=setTimeout(failure,18000);this.send({command:'open',key,input});
    try{await opening;}finally{clearTimeout(timeout);}
  }
  private send(value:object):void{if(!this.child||this.child.stdin.writableLength>1000000)throw new Error('Session LIVE arrêtée ou saturée.');this.child.stdin.write(JSON.stringify(value)+'\n');}
  sendAudio(pcm:Uint8Array):void{this.send({command:'audio',pcm:Buffer.from(pcm).toString('base64')});}
  activity(start:boolean):void{this.send({command:'activity',start});}
  respond():void{this.send({command:'respond'});}
  sendToolResult(call:LiveToolCall,result:LiveToolResult):void{this.send({command:'tool-result',call,result});}
  close():void{const child=this.child;this.child=null;const reject=this.rejectOpening;this.rejectOpening=null;reject?.(new Error('Session Gemini arrêtée.'));child?.kill();}
}
