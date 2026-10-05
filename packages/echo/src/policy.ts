import { realpathSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute, parse, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { EchoEvent, EchoExclusions, EchoObservationSession, EchoVariation, EchoDecision } from '@aether/shared';

export const DEFAULT_EXCLUSIONS: EchoExclusions = { folders: [], processes: ['1password.exe','keepass.exe','keepassxc.exe','bitwarden.exe','outlook.exe','chrome.exe','msedge.exe','firefox.exe'], windows: ['banque','password','mot de passe','confidentiel','inprivate','private browsing'] };
export function within(root: string, path: string): boolean { const rel=relative(root,path); return rel==='' || (!rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`) && rel!=='..' && !isAbsolute(rel)); }
export function excluded(path: string, exclusions: EchoExclusions): boolean { return exclusions.folders.some(folder=>within(folder,path)); }
export function validateRoot(path: string, forbidden: readonly string[]=[]): string {
  if(typeof path!=='string'||path.length>500||!isAbsolute(path)||/^\\\\/.test(path))throw new Error('Choisissez un dossier local, avec un chemin absolu.');
  const info=lstatSync(path); if(!info.isDirectory()||info.isSymbolicLink())throw new Error('Les liens et jonctions ne sont pas autorisés.');
  const root=realpathSync.native(path),home=homedir();
  if(root===parse(root).root || within(root,home) || forbidden.some(folder=>within(root,folder)||within(folder,root)))throw new Error('Ce périmètre est trop large ou contient des données sensibles. Choisissez un dossier de test dédié.');
  // Reject symbolic ancestors as well as a symbolic root.
  for(let cursor=resolve(path);cursor!==parse(cursor).root;cursor=resolve(cursor,'..'))if(lstatSync(cursor).isSymbolicLink())throw new Error('Les liens et jonctions ne sont pas autorisés.');
  return root;
}
export function parseExclusions(value: unknown): EchoExclusions {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Exclusions invalides.');
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!['folders','processes','windows'].includes(k)))throw new Error('Champ d’exclusion inconnu.');
  const list=(key:string,max:number)=>{const a=v[key];if(!Array.isArray(a)||a.length>50||a.some(x=>typeof x!=='string'||!x.trim()||x.length>max||/[\r\n\0]/.test(x)))throw new Error('Liste d’exclusions invalide.');return [...new Set((a as string[]).map(x=>x.trim()))];};
  const folders=list('folders',500).map(x=>{if(!isAbsolute(x)||/^\\\\/.test(x))throw new Error('Chemin exclu invalide.');return resolve(x);});
  return {folders,processes:list('processes',100).map(x=>x.toLowerCase()),windows:list('windows',100).map(x=>x.toLowerCase())};
}
export function signature(events: readonly EchoEvent[]): string[] {
  const token=(path:string)=>/\d{4}[-_]\d{2}[-_]\d{2}/.test(basename(path))?'dated':/\d/.test(basename(path))?'numbered':'named';
  return [...new Set(events.map(e=>`${e.kind}:${e.nodeKind}:${e.nodeKind==='file'?extname(e.path).toLowerCase():''}:${token(e.path)}`))].sort();
}
export function similarity(a: readonly string[],b: readonly string[]): number { const union=new Set([...a,...b]);return union.size?a.filter(x=>b.includes(x)).length/union.size:0; }
export function signatureHash(tokens: readonly string[]): string {return createHash('sha256').update(JSON.stringify([...tokens].sort())).digest('hex');}
export function measuredVariations(previous:EchoObservationSession,current:EchoObservationSession,decision:EchoDecision):EchoVariation[]{
  const variations:EchoVariation[]=[];
  const dates=(events:EchoEvent[])=>[...new Set(events.flatMap(e=>[...(e.path.match(/\d{4}[-_]\d{2}[-_]\d{2}/g)??[])]))].sort();
  const before=dates(previous.events),after=dates(current.events);
  const add=(description:string,evidenceIds:string[])=>variations.push({sessionId:current.id,comparedSessionId:previous.id,description,evidenceIds,decision});
  if(JSON.stringify(before)!==JSON.stringify(after))add(`Dates dans les noms : ${before.join(', ')||'aucune'} → ${after.join(', ')||'aucune'}.`,current.events.filter(e=>/\d{4}[-_]\d{2}[-_]\d{2}/.test(e.path)).map(e=>e.id));
  const counts=(events:EchoEvent[])=>{const map=new Map<string,number>();for(const e of events){const key=`${e.kind} / ${e.nodeKind} / ${extname(e.path).toLowerCase()||'sans extension'}`;map.set(key,(map.get(key)??0)+1);}return map;};
  const a=counts(previous.events),b=counts(current.events);
  for(const [key,count] of b){const old=a.get(key)??0;if(count!==old)add(`Nombre d’événements ${key} : ${old} → ${count}.`,current.events.filter(e=>`${e.kind} / ${e.nodeKind} / ${extname(e.path).toLowerCase()||'sans extension'}`===key).map(e=>e.id));}
  return variations;
}
