import { spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { EchoEngine, EchoRepository, FileObserver, type ContextSource } from '@aether/echo';
import { EchoInterpreter } from '@aether/mind';
import type { EchoContext, EchoExclusions } from '@aether/shared';
import type { DesktopMindService } from './mind-service';

export class ExplorerContext implements ContextSource {
  private child:ChildProcess|null=null;
  private value:EchoContext={allowed:false,application:null,folder:null,windowTitle:null,reason:'Contexte Explorer en attente.'};
  private lastAt=0;
  private timeout:ReturnType<typeof setTimeout>|undefined;
  current(){if(Date.now()-this.lastAt>1500)return {allowed:false,application:null,folder:null,windowTitle:null,reason:'Contexte Explorer expiré.'};return this.value;}
  start(root:string,exclusions:EchoExclusions,changed:(value:EchoContext)=>void,error:(error:Error)=>void){
    this.close();if(process.platform!=='win32')throw new Error('L’observation Explorer exige Windows.');
    const scope=Buffer.from(JSON.stringify({root,exclusions}),'utf8').toString('base64');
    const executable=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const helper=resolve(__dirname,'echo-context.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-EncodedScope',scope,'-ParentProcessId',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']});this.child=child;
    let buffer='',stderr='',last='';
    this.timeout=setTimeout(()=>{if(this.child===child&&!this.lastAt){this.close();error(new Error('Le contexte Explorer ne répond pas. ECHO a arrêté l’observation.'));}},10000);
    child.stdout!.setEncoding('utf8');child.stderr!.setEncoding('utf8');
    child.stderr!.on('data',(chunk:string)=>{stderr=(stderr+chunk).slice(-2000);});
    child.stdout!.on('data',(chunk:string)=>{if(this.child!==child)return;buffer+=chunk;if(buffer.length>16000){this.close();error(new Error('Réponse du contexte Explorer trop longue.'));return;}
      let end:number;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);try{const v=JSON.parse(line) as EchoContext;if(typeof v.allowed!=='boolean'||typeof v.reason!=='string')throw new Error('Invalid');this.value=v;this.lastAt=Date.now();if(line!==last){last=line;changed(v);}}catch{this.close();error(new Error('Le contexte Explorer est invalide.'));return;}}
    });
    child.on('error',()=>{if(this.child===child){this.close();error(new Error('Impossible de démarrer le contexte Explorer.'));}});
    child.on('exit',()=>{if(this.child===child){this.close();error(new Error(`Le contexte Explorer s’est arrêté${stderr?'. Vérifiez PowerShell Windows et la politique locale.':'.'}`));}});
  }
  close(){if(this.timeout)clearTimeout(this.timeout);this.timeout=undefined;const child=this.child;this.child=null;child?.kill();this.lastAt=0;this.value={allowed:false,application:null,folder:null,windowTitle:null,reason:'Observation arrêtée.'};}
}
export function createEcho(folder:string,mind:DesktopMindService){
  const engine=new EchoEngine(new EchoRepository(join(folder,'memory.sqlite')),new FileObserver(new ExplorerContext()),new EchoInterpreter(mind.router),[folder,join(process.env.SystemRoot??'C:\\Windows'),join(process.env.APPDATA??folder),join(process.env.LOCALAPPDATA??folder)]);
  mind.habitContext=()=>{const habits=engine.repository.habits().filter(h=>h.state==='confirmed').slice(0,5);return `Habitudes réellement confirmées par l’utilisateur (ECHO), uniquement consultables, aucune exécution ni exploration : ${JSON.stringify(habits.map(h=>({id:h.id,name:h.name,description:h.description,occurrences:h.occurrences,procedure:h.procedure.map(s=>s.description)})))}. Les hypothèses ECHO non confirmées ne sont pas des souvenirs.`;};
  return engine;
}
