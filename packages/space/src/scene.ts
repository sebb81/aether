import type {Interest,Point,SpaceData,SpaceSelection} from '@aether/shared';

export const interestStatusLabel={active:'actif',dormant:'en veille',abandoned:'abandonné'} as const;
export const explorationStatusLabel={running:'en cours',succeeded:'réussie',failed:'échouée',cancelled:'annulée',suppressed:'écartée',interrupted:'interrompue'} as const;

export const SPACE_ZONES={memory:{x:-530,y:-30},curiosity:{x:480,y:-80},activity:{x:-275,y:270},capabilities:{x:-200,y:-335},echo:{x:470,y:310}} as const;
export interface InterestNode {interest:Interest;position:Point;radius:number}
export function interestNodes(interests:Interest[]):InterestNode[]{return [...interests].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map((interest,index)=>{const angle=index*2.39996323,radius=Math.sqrt(index)*245;return {interest,position:{x:SPACE_ZONES.curiosity.x+Math.cos(angle)*radius,y:SPACE_ZONES.curiosity.y+Math.sin(angle)*radius},radius:24+interest.level*17};});}
export interface ActivityEntry {id:string;kind:string;title:string;detail:string;at:string;target:SpaceSelection|null;transient:boolean;fresh:boolean}
export function activityEntries(data:SpaceData,since:string|null):ActivityEntry[]{
  const entries:Omit<ActivityEntry,'fresh'>[]=[],journal=data.curiosity;
  for(const item of data.memories){entries.push({id:`memory:${item.id}:created`,kind:'Souvenir',title:'Souvenir conservé',detail:item.content,at:item.createdAt,target:{kind:'memory',id:item.id},transient:false});if(item.updatedAt!==item.createdAt)entries.push({id:`memory:${item.id}:updated`,kind:'Correction',title:'Souvenir corrigé',detail:item.content,at:item.updatedAt,target:{kind:'memory',id:item.id},transient:false});}
  if(journal){
    const title=(id:string|null)=>journal.interests.find(item=>item.id===id)?.title??'Naissance d’une piste';
    for(const item of journal.interests)entries.push({id:`interest:${item.id}`,kind:'Intérêt',title:item.title,detail:item.origin.reason,at:item.createdAt,target:{kind:'interest',id:item.id},transient:false});
    for(const item of journal.explorations)entries.push({id:`exploration:${item.id}`,kind:'Exploration',title:`${title(item.interestId)} · ${explorationStatusLabel[item.status]}`,detail:item.error??item.reason,at:item.completedAt??item.createdAt,target:{kind:'exploration',id:item.id},transient:false});
    for(const item of journal.connections)entries.push({id:`connection:${item.id}`,kind:'Connexion',title:`${title(item.fromId)} ↔ ${title(item.toId)}`,detail:item.description,at:item.createdAt,target:{kind:'connection',id:item.id},transient:false});
    for(const item of journal.items.filter(item=>item.kind==='discovery'))entries.push({id:`discovery:${item.id}`,kind:'Découverte',title:title(item.interestId),detail:item.content,at:item.createdAt,target:{kind:'discovery',id:item.id},transient:false});
  }
  for(const message of data.mind?.messages??[])if(message.role==='assistant')entries.push({id:`conversation:${message.id}`,kind:'Échange de session',title:'Réponse d’ENTITY',detail:message.content,at:message.createdAt,target:null,transient:true});
  return entries.map(item=>({...item,fresh:since===null||Date.parse(item.at)>Date.parse(since)})).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export function existingSelection(selection:SpaceSelection|null,data:SpaceData):SpaceSelection|null {
  if(!selection)return null;
  if(selection.kind==='echo-session')return data.echo?.sessions.some(s=>s.id===selection.id)?selection:null;
  if(selection.kind==='habit')return data.echo?.habits.some(h=>h.id===selection.id)?selection:null;
  const items=selection.kind==='memory'?data.memories:selection.kind==='interest'?data.curiosity?.interests:selection.kind==='connection'?data.curiosity?.connections:selection.kind==='exploration'?data.curiosity?.explorations:data.curiosity?.items.filter(item=>item.kind===selection.kind);
  return items?.some(item=>item.id===selection.id)?selection:null;
}
export function availableCapabilities(data:SpaceData){return [{key:'mind',name:'Conversation',description:'Échanges avec le fournisseur configuré.'},{key:'memory',name:'Mémoire',description:'Souvenirs consultables, corrigibles et supprimables.'},{key:'curiosity',name:'Curiosité',description:'Explorations locales autorisées et journal persistant.'},{key:'portal',name:'Espace intérieur',description:'Navigation dans les objets réels d’AETHER.'}].map(item=>({...item,available:data.presence.features[item.key as keyof typeof data.presence.features]==='available'}));}
