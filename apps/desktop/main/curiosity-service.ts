import { join } from 'node:path';
import { CuriosityEngine, CuriosityRepository, isBlocked, sourceSeeds } from '@aether/curiosity';
import type { DesktopMindService } from './mind-service';

export function createCuriosity(folder: string,mind: DesktopMindService,busy: ()=>boolean,allowDialogueSeeds:()=>boolean=()=>true) {
  const repository=new CuriosityRepository(join(folder,'memory.sqlite'));
  const engine=new CuriosityEngine(repository,mind.router,async()=>{
    const messages=allowDialogueSeeds()?mind.engine.snapshot().messages:[];
    const conversation=messages.filter(message=>message.role==='user').slice(-1).map(message=>({key:`conversation:${message.id}`,kind:'conversation' as const,ref:message.id,content:message.content}));
    const suggestions=messages.filter(message=>message.role==='assistant').slice(-1).map(message=>({key:`mind:${message.id}`,kind:'mind' as const,ref:message.id,content:message.content}));
    const memories=(await mind.memory.list()).filter(memory=>!memory.source.startsWith('ECHO:')).slice(0,2).map(memory=>({key:`memory:${memory.id}`,kind:'memory' as const,ref:memory.id,content:memory.content}));
    return [...conversation,...suggestions,...memories,...sourceSeeds(repository.journal())];
  },busy);
  mind.curiosityContext=()=>{
    const journal=engine.snapshot(),latest=journal.explorations.find(item=>item.status==='succeeded');
    const discoveries=latest?journal.items.filter(item=>item.explorationId===latest.id && item.kind==='discovery').map(item=>({content:item.content.slice(0,1200),limits:item.limits?.slice(0,600)})):[];
    return `Statut réel CURIOSITY : ${JSON.stringify({enabled:journal.settings.enabled,state:journal.state,interests:journal.interests.filter(item=>item.status==='active'&&!isBlocked(`${item.title} ${item.description}`,journal.blockedDomains)).slice(0,5).map(item=>({title:item.title,origin:{kind:item.origin.kind,reason:item.origin.reason.slice(0,200)}})),latest:latest?{why:latest.reason.slice(0,600),model:latest.model,nextQuestion:latest.nextQuestion?.slice(0,300),discoveries}:null})}. Tu peux expliquer cette réflexion à la demande, sans la confondre avec une vérification externe.`;
  };
  return engine;
}
