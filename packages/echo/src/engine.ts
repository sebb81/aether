import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { EventBus } from '@aether/core';
import type { EchoContext, EchoEvent, EchoFolderChoice, EchoInterpreterPort, EchoSnapshot, EchoStartInput, EchoValidation } from '@aether/shared';
import { EchoRepository } from './repository';
import type { ObserverPort } from './observer';
import { excluded, parseExclusions, validateRoot, within } from './policy';

export class EchoEngine {
  readonly events=new EventBus<{changed:EchoSnapshot}>();
  private enabled=false;
  private state:EchoSnapshot['state']='off';
  private active:string|null=null;
  private context:EchoContext|null=null;
  private error:string|null=null;
  private grant:{token:string;folder:string;expiresAt:string}|null=null;
  private epoch=0;
  private analysis:AbortController|null=null;
  private deadline:ReturnType<typeof setTimeout>|undefined;
  private closed=false;
  constructor(readonly repository:EchoRepository,private observer:ObserverPort,private interpreter:EchoInterpreterPort,private forbidden:readonly string[]=[]){}
  snapshot():EchoSnapshot{return {enabled:this.enabled,state:this.state,activeSessionId:this.active,context:this.context,error:this.error,sessions:this.repository.sessions(),habits:this.repository.habits(),opportunities:this.repository.opportunities(),exclusions:this.repository.exclusions()};}
  isBusy(){return ['observing','paused','analysing'].includes(this.state);}
  runtimeState(){return this.state;}
  isObserving(){return this.state==='observing';}
  choose(folder:string):EchoFolderChoice {this.grant={token:randomUUID(),folder:validateRoot(folder,this.forbidden),expiresAt:new Date(Date.now()+120000).toISOString()};return {...this.grant};}
  enable(){if(this.closed||this.isBusy())throw new Error('Terminez la session ECHO avant de préparer un nouveau consentement.');this.enabled=true;this.state='ready';this.error=null;this.publish();}
  start(input:EchoStartInput):void {
    if(this.closed||!this.enabled||this.isBusy())throw new Error('Activez ECHO et terminez la session précédente.');
    if(!input||Object.keys(input).some(k=>!['token','consent'].includes(k))||input.consent!==true||!this.grant||input.token!==this.grant.token||Date.now()>Date.parse(this.grant.expiresAt))throw new Error('Un nouveau choix de dossier et un consentement explicite sont nécessaires.');
    const root=validateRoot(this.grant.folder,this.forbidden);if(excluded(root,this.repository.exclusions()))throw new Error('Ce dossier est exclu.');
    this.grant=null;this.epoch++;this.error=null;const session=this.repository.create(root);this.active=session.id;this.state='observing';
    try{this.startObserver();this.deadline=setTimeout(()=>{void this.stop();},15*60*1000);this.publish();}catch(error){this.fail(error);throw error;}
  }
  private startObserver(){if(!this.active)return;const session=this.repository.session(this.active),id=session.id,epoch=this.epoch;
    this.observer.start(session.resources[0]!,id,this.repository.exclusions(),events=>{if(this.epoch!==epoch||this.state!=='observing')return;try{this.repository.append(id,events.filter(e=>this.allowedEvent(e,session.resources[0]!)));this.publish();}catch(error){this.fail(error);}},context=>{if(this.epoch===epoch&&this.state==='observing'){this.context=context;this.publish();}},error=>{if(this.epoch===epoch)this.fail(error);});
  }
  private allowedEvent(e:EchoEvent,root:string):boolean {const ex=this.repository.exclusions();return e.application==='explorer.exe'&&!ex.processes.includes(e.application)&&!ex.windows.some(w=>e.windowTitle.toLowerCase().includes(w))&&within(root,e.contextFolder)&&!excluded(e.contextFolder,ex)&&within(root,resolve(root,e.path))&&!excluded(resolve(root,e.path),ex)&&(!e.previousPath||(within(root,resolve(root,e.previousPath))&&!excluded(resolve(root,e.previousPath),ex)));}
  pause(){if(this.state!=='observing'||!this.active)throw new Error('Aucune observation à suspendre.');this.epoch++;this.observer.close();this.context=null;this.state='paused';this.repository.status(this.active,'paused');this.publish();}
  resume(){if(this.state!=='paused'||!this.active)throw new Error('Aucune session en pause.');this.repository.status(this.active,'observing');this.state='observing';try{this.startObserver();this.publish();}catch(error){this.fail(error);throw error;}}
  async stop():Promise<void>{
    if(!['observing','paused'].includes(this.state)||!this.active)throw new Error('Aucune observation à arrêter.');
    const id=this.active;this.observer.close();this.context=null;if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.state='analysing';this.repository.status(id,'analysing');this.publish();
    const session=this.repository.session(id),events=session.events.filter(e=>this.allowedEvent(e,session.resources[0]!));
    if(!events.length){this.repository.status(id,'completed');this.active=null;this.state=this.enabled?'ready':'off';this.publish();return;}
    const abort=new AbortController(),epoch=++this.epoch;this.analysis=abort;
    try{const result=await this.interpreter.interpret(events,this.repository.habits().filter(h=>h.state==='confirmed'),abort.signal);if(this.closed||epoch!==this.epoch||abort.signal.aborted)return;
      if(events.some(e=>!this.allowedEvent(e,session.resources[0]!)))throw new Error('Les exclusions ont changé. Interprétation retirée.');
      this.repository.propose(id,result);this.state=this.enabled?'ready':'off';this.active=null;this.error=null;
    }catch(error){if(epoch!==this.epoch||this.closed)return;this.fail(error);}finally{if(epoch===this.epoch){this.analysis=null;this.publish();}}
  }
  cancelAnalysis(){this.cancel('Interprétation annulée.');this.publish();}
  disable(){this.cancel('ECHO désactivé par l’utilisateur.');this.enabled=false;this.state='off';this.grant=null;this.context=null;this.error=null;this.publish();}
  private cancel(reason:string){this.epoch++;this.analysis?.abort();this.analysis=null;this.observer.close();if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;if(this.active)this.repository.status(this.active,'interrupted',reason);this.active=null;this.context=null;this.state=this.enabled?'ready':'off';}
  private fail(error:unknown){const message=error instanceof Error?error.message:String(error);this.epoch++;this.analysis?.abort();this.analysis=null;this.observer.close();if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;if(this.active)this.repository.status(this.active,'failed',message);this.active=null;this.context=null;this.error=message;this.state='error';this.publish();}
  validate(input:EchoValidation){const hypothesis=this.repository.sessions().flatMap(s=>s.hypotheses).find(h=>h.id===input?.hypothesisId);if(!hypothesis)throw new Error('Hypothèse introuvable.');const session=this.repository.session(hypothesis.sessionId);if(session.events.some(e=>!this.allowedEvent(e,session.resources[0]!)))throw new Error('Cette hypothèse utilise désormais une zone exclue.');this.repository.validate(input);this.publish();}
  removeSession(id:string){this.cancel('Session supprimée.');this.repository.removeSession(id);this.publish();}
  removeMemory(id:string){this.cancel('MEMORY modifiée.');const removed=this.repository.removeHabitForMemory(id);this.publish();return removed;}
  configure(value:unknown){const exclusions=parseExclusions(value);this.cancel('Exclusions modifiées. Nouveau consentement nécessaire.');this.grant=null;this.repository.setExclusions(exclusions);this.repository.withdrawExcluded(s=>s.events.some(e=>!this.allowedEvent(e,s.resources[0]!))||excluded(s.resources[0]!,exclusions));this.publish();}
  publish(){if(!this.closed)this.events.emit('changed',this.snapshot());}
  close(){if(this.closed)return;this.cancel('Application fermée.');this.closed=true;this.repository.close();}
}
