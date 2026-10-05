import { watch, readdirSync, lstatSync, realpathSync, type FSWatcher } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EchoContext, EchoEvent, EchoExclusions } from '@aether/shared';
import { excluded, within } from './policy';

interface Entry { key:string; path:string; nodeKind:'file'|'directory'; size:number; modified:number }
export interface ContextSource { current(): EchoContext; start(root:string,exclusions:EchoExclusions,changed:(context:EchoContext)=>void,error:(error:Error)=>void): void; close(): void }
export interface ObserverPort { start(root:string,sessionId:string,exclusions:EchoExclusions,emit:(events:EchoEvent[])=>void,context:(value:EchoContext)=>void,error:(error:Error)=>void): void; close():void }
export class FileObserver implements ObserverPort {
  private watcher:FSWatcher|null=null;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private baseline=new Map<string,Entry>();
  private tainted=false;
  private closed=true;
  private rootKey:string|null=null;
  constructor(private source:ContextSource){}
  start(root:string,sessionId:string,exclusions:EchoExclusions,emit:(events:EchoEvent[])=>void,context:(value:EchoContext)=>void,onError:(error:Error)=>void): void {
    this.close();this.closed=false;this.baseline=this.scan(root,exclusions);this.tainted=false;
    this.source.start(root,exclusions,c=>{if(this.closed)return;context(c);},error=>{if(!this.closed){this.close();onError(error);}});
    this.watcher=watch(root,{recursive:true},(_kind,filename)=>{
      if(this.closed || !filename)return;
      const path=resolve(root,filename.toString());
      if(!within(root,path)||excluded(path,exclusions))return;
      const c=this.source.current();
      if(!c.allowed){this.tainted=true;return;}
      if(this.timer)clearTimeout(this.timer);
      this.timer=setTimeout(()=>{
        this.timer=undefined;if(this.closed)return;
        try {
          const next=this.scan(root,exclusions);
          // Unknown/off-context changes cannot be replayed when Explorer returns.
          if(this.tainted){this.baseline=next;this.tainted=false;return;}
          const events=diffEntries(this.baseline,next).map(e=>({...e,id:randomUUID(),sessionId,at:new Date().toISOString(),source:'filesystem' as const,application:'explorer.exe' as const,windowTitle:c.windowTitle??'',contextFolder:c.folder??root}));
          this.baseline=next;if(events.length)emit(events);
        }catch(error){this.close();onError(error instanceof Error?error:new Error(String(error)));}
      },180);
    });
    this.watcher.on('error',error=>{this.close();onError(error);});
  }
  private scan(root:string,exclusions:EchoExclusions): Map<string,Entry> {
    const rootInfo=lstatSync(root),actualRoot=realpathSync.native(root);
    if(rootInfo.isSymbolicLink()||!within(root,actualRoot)||!within(actualRoot,root))throw new Error('Le dossier autorisé a changé ou est devenu un lien. Observation arrêtée.');
    const rootKey=`${rootInfo.dev}:${rootInfo.ino}:${rootInfo.birthtimeMs}`;
    if(this.rootKey!==null&&this.rootKey!==rootKey)throw new Error('Le dossier autorisé a été remplacé. Nouveau consentement nécessaire.');
    this.rootKey=rootKey;
    const result=new Map<string,Entry>();
    const walk=(folder:string,depth:number)=>{
      if(depth>20)throw new Error('Le dossier dépasse la profondeur autorisée (20).');
      for(const item of readdirSync(folder,{withFileTypes:true})){
        const path=join(folder,item.name);if(excluded(path,exclusions)||item.isSymbolicLink())continue;
        const info=lstatSync(path);if(info.isSymbolicLink()||!within(root,realpathSync.native(path)))continue;
        if(!info.isFile()&&!info.isDirectory())continue;
        if(result.size>=5000)throw new Error('Le dossier dépasse 5 000 entrées. Choisissez un dossier de test plus petit.');
        const rel=relative(root,path),nodeKind=info.isDirectory()?'directory':'file';
        result.set(rel,{key:`${info.dev}:${info.ino}:${info.birthtimeMs}`,path:rel,nodeKind,size:info.size,modified:info.mtimeMs});
        if(info.isDirectory())walk(path,depth+1);
      }
    };walk(root,0);return result;
  }
  close(){this.closed=true;if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.watcher?.close();this.watcher=null;this.source.close();this.baseline.clear();this.rootKey=null;}
}
export function diffEntries(before:Map<string,Entry>,after:Map<string,Entry>): Pick<EchoEvent,'kind'|'path'|'previousPath'|'nodeKind'|'size'>[] {
  const out:Pick<EchoEvent,'kind'|'path'|'previousPath'|'nodeKind'|'size'>[]=[],remaining=new Map(after),movedDirs:{from:string;to:string}[]=[];
  const identity=new Map([...after.values()].map(e=>[e.key,e]));
  for(const old of [...before.values()].sort((a,b)=>a.path.length-b.path.length)){
    const next=identity.get(old.key);
    if(!next){out.push({kind:'deleted',path:old.path,previousPath:null,nodeKind:old.nodeKind,size:old.size});continue;}
    remaining.delete(next.path);
    if(next.path!==old.path){
      if(movedDirs.some(d=>within(d.from,old.path)&&relative(d.from,old.path)===relative(d.to,next.path)))continue;
      const kind=resolve(old.path,'..')===resolve(next.path,'..')?'renamed':'moved';
      out.push({kind,path:next.path,previousPath:old.path,nodeKind:old.nodeKind,size:next.size});
      if(old.nodeKind==='directory')movedDirs.push({from:old.path,to:next.path});
    }else if(old.nodeKind==='file'&&(old.size!==next.size||old.modified!==next.modified))out.push({kind:'modified',path:next.path,previousPath:null,nodeKind:next.nodeKind,size:next.size});
  }
  for(const next of remaining.values())out.push({kind:'created',path:next.path,previousPath:null,nodeKind:next.nodeKind,size:next.size});
  return out;
}
