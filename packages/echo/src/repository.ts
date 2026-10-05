import { randomUUID, createHash } from 'node:crypto';
import { extname } from 'node:path';
import { openLocalDatabase } from '@aether/memory';
import type { AutomationOpportunity, EchoEvent, EchoExclusions, EchoHypothesis, EchoInterpretation, EchoObservationSession, EchoValidation, Habit, ModelRoute } from '@aether/shared';
import { DEFAULT_EXCLUSIONS, parseExclusions, signature, signatureHash, similarity, measuredVariations } from './policy';
type Row=Record<string,unknown>;
const decode=<T>(row:Row):T=>JSON.parse(String(row.content)) as T;
const interpretationHash=(sig:string[],description:string)=>createHash('sha256').update(signatureHash(sig)+description.trim().toLowerCase()).digest('hex');
export class EchoRepository {
  private db;
  constructor(path:string){this.db=openLocalDatabase(path);this.db.prepare("UPDATE echo_sessions SET status='interrupted', ended_at=?, error='Observation interrompue par la fermeture. Aucun consentement renouvelé.' WHERE status IN ('observing','paused','analysing')").run(new Date().toISOString());}
  exclusions():EchoExclusions {const row=this.db.prepare('SELECT content FROM echo_settings WHERE id=1').get();return row?parseExclusions(decode(row)):structuredClone(DEFAULT_EXCLUSIONS);}
  setExclusions(value:EchoExclusions){this.db.prepare('INSERT INTO echo_settings(id,content) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content').run(JSON.stringify(parseExclusions(value)));}
  sessions():EchoObservationSession[]{return this.db.prepare('SELECT * FROM echo_sessions ORDER BY started_at DESC,id').all().map(row=>this.sessionRow(row));}
  session(id:string){const row=this.db.prepare('SELECT * FROM echo_sessions WHERE id=?').get(id);if(!row)throw new Error('Cette session n’existe plus.');return this.sessionRow(row);}
  private sessionRow(row:Row):EchoObservationSession{
    const id=String(row.id),start=String(row.started_at),end=row.ended_at?String(row.ended_at):null;
    return {id,startedAt:start,endedAt:end,durationMs:Math.max(0,(end?Date.parse(end):Date.now())-Date.parse(start)),applications:['explorer.exe'],resources:[String(row.root)],status:row.status as EchoObservationSession['status'],summary:row.summary?String(row.summary):null,error:row.error?String(row.error):null,events:this.db.prepare('SELECT content FROM echo_events WHERE session_id=? ORDER BY rowid').all(id).map(r=>decode<EchoEvent>(r)),hypotheses:this.db.prepare('SELECT content FROM echo_hypotheses WHERE session_id=? ORDER BY rowid').all(id).map(r=>decode<EchoHypothesis>(r))};
  }
  habits():Habit[]{return this.db.prepare('SELECT content,memory_id FROM echo_habits ORDER BY rowid DESC').all().map(row=>({...decode<Habit>(row),memoryId:row.memory_id?String(row.memory_id):null}));}
  opportunities():AutomationOpportunity[]{return this.db.prepare('SELECT content FROM echo_opportunities ORDER BY rowid DESC').all().map(r=>decode<AutomationOpportunity>(r));}
  create(root:string):EchoObservationSession{
    if(this.sessions().length>=200)throw new Error('La limite de 200 sessions est atteinte. Supprimez des sessions avant de continuer.');
    const id=randomUUID();this.db.prepare("INSERT INTO echo_sessions(id,started_at,status,root) VALUES(?,?,'observing',?)").run(id,new Date().toISOString(),root);return this.session(id);
  }
  append(id:string,events:EchoEvent[]){const session=this.session(id);if(session.status!=='observing')return;if(session.events.length+events.length>600)throw new Error('Limite de 600 événements atteinte. Observation arrêtée.');this.transaction(()=>{const stmt=this.db.prepare('INSERT INTO echo_events(id,session_id,content) VALUES(?,?,?)');for(const e of events)stmt.run(e.id,id,JSON.stringify(e));});}
  status(id:string,status:EchoObservationSession['status'],error:string|null=null){this.db.prepare('UPDATE echo_sessions SET status=?,error=?,ended_at=CASE WHEN ? IN (\'observing\',\'paused\') THEN ended_at ELSE COALESCE(ended_at,?) END WHERE id=?').run(status,error,status,new Date().toISOString(),id);}
  propose(sessionId:string,result:{interpretation:EchoInterpretation;model:string;route:ModelRoute}):EchoHypothesis|null{
    const session=this.session(sessionId),sig=signature(session.events),p=result.interpretation;
    if(this.db.prepare('SELECT 1 FROM echo_invalidations WHERE signature IN (?,?)').get(signatureHash(sig),interpretationHash(sig,p.description))){this.db.prepare("UPDATE echo_sessions SET status='completed',summary='Interprétation invalidée auparavant : aucune nouvelle habitude proposée.' WHERE id=?").run(sessionId);return null;}
    const candidates=this.habits().filter(h=>h.state!=='rejected' && h.provenance.sessionIds.some(id=>this.session(id).resources[0]===session.resources[0])).map(h=>({h,score:similarity(sig,h.signature)})).filter(x=>x.score>=0.6).sort((a,b)=>b.score-a.score);
    const matched=candidates.find(x=>x.h.id===p.matchedHabitId)?.h??candidates[0]?.h;
    const habitId=matched?.id??randomUUID(),hypothesis:EchoHypothesis={id:randomUUID(),sessionId,habitId,createdAt:new Date().toISOString(),interpretation:p,decision:'pending',correction:null,model:result.model,route:result.route,invalidated:false};
    this.transaction(()=>{
      if(!matched){const habit:Habit={id:habitId,name:p.name,description:p.description,context:p.context,applications:['explorer.exe'],triggers:p.triggers,procedure:p.procedure,firstObservedAt:session.startedAt,lastObservedAt:session.startedAt,occurrences:1,confidence:p.confidence,state:'hypothesis',provenance:{engine:'ECHO',sessionIds:[sessionId]},memoryId:null,variations:[],signature:sig};this.saveHabit(habit);}
      this.db.prepare('INSERT INTO echo_hypotheses(id,session_id,habit_id,content) VALUES(?,?,?,?)').run(hypothesis.id,sessionId,habitId,JSON.stringify(hypothesis));
      this.db.prepare("UPDATE echo_sessions SET status='completed',summary=? WHERE id=?").run(p.summary,sessionId);this.rebuild(habitId);
    });return hypothesis;
  }
  validate(input:EchoValidation):void{
    if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['hypothesisId','decision','correction'].includes(k))||typeof input.hypothesisId!=='string'||!['yes','no','partial','correct'].includes(input.decision))throw new Error('Validation ECHO invalide.');
    const row=this.db.prepare('SELECT content FROM echo_hypotheses WHERE id=?').get(input.hypothesisId);if(!row)throw new Error('Cette hypothèse n’existe plus.');
    const h=decode<EchoHypothesis>(row);if(h.decision!=='pending'&&h.decision!=='partial'&&!(input.decision==='correct'&&(h.decision==='yes'||h.decision==='corrected')))throw new Error('Cette interprétation possède déjà une décision.');
    if(input.decision==='correct'&&(typeof input.correction!=='string'||input.correction.trim().length<10||input.correction.length>1200))throw new Error('Précisez votre méthode réelle (10 à 1 200 caractères).');
    const session=this.session(h.sessionId),sig=signature(session.events);
    this.transaction(()=>{
      h.decision=input.decision==='correct'?'corrected':input.decision;h.correction=input.decision==='correct'?input.correction!.trim():null;h.invalidated=input.decision==='no'||input.decision==='correct';
      if(input.decision==='no'||input.decision==='correct')this.invalidate(input.decision==='no'?signatureHash(sig):interpretationHash(sig,h.interpretation.description),'Interprétation refusée ou corrigée par l’utilisateur.');
      this.db.prepare('UPDATE echo_hypotheses SET content=? WHERE id=?').run(JSON.stringify(h),h.id);
      // A rejected original remains in the journal with its decision, never as the approved description.
      if(h.invalidated)this.db.prepare('UPDATE echo_sessions SET summary=? WHERE id=?').run(input.decision==='correct'?`Correction utilisateur : ${h.correction}`:'Interprétation refusée par l’utilisateur.',h.sessionId);
      this.rebuild(h.habitId);
    });
  }
  private rebuild(id:string):void {
    const existing=this.habits().find(h=>h.id===id);if(!existing)return;
    const observations=this.db.prepare('SELECT content FROM echo_hypotheses WHERE habit_id=? ORDER BY rowid').all(id).map(r=>decode<EchoHypothesis>(r));
    const valid=observations.filter(h=>h.decision!=='no'),approved=valid.filter(h=>h.decision==='yes'||h.decision==='corrected');
    if(!observations.length){this.dropMemory(existing.memoryId);this.db.prepare('DELETE FROM echo_habits WHERE id=?').run(id);return;}
    const base=approved.at(-1)??valid[0]??observations[0]!,p=base.interpretation;
    const sessions=valid.map(h=>this.session(h.sessionId)),dates=sessions.map(s=>s.startedAt).sort(),tokens=signature(sessions.flatMap(s=>s.events));
    const sourceSession=this.session(base.sessionId),sourceEvents=sourceSession.events;
    // A correction approves the user's intention, not the original model's other guesses.
    const correctedProcedure=p.procedure.map(step=>{const observed=sourceEvents.filter(e=>step.evidenceIds.includes(e.id)&&e.kind===step.action);return {action:step.action,description:observed.map(e=>`${e.kind} : ${e.previousPath?`${e.previousPath} → `:''}${e.path}`).join(' ; ').slice(0,400),evidenceIds:observed.map(e=>e.id)};}).filter(step=>step.evidenceIds.length);
    const habit:Habit={...existing,name:base.correction?base.correction.split(/[.!?]/)[0]!.slice(0,120):p.name,description:base.correction??p.description,context:base.correction?`Explorer · ${sourceSession.resources[0]}`:p.context,triggers:base.correction?[...new Set(sourceEvents.map(e=>e.nodeKind==='directory'?'Dossier':`Fichier ${extname(e.path)||'sans extension'}`))]:p.triggers,procedure:base.correction?correctedProcedure:p.procedure,firstObservedAt:dates[0]??existing.firstObservedAt,lastObservedAt:dates.at(-1)??existing.lastObservedAt,occurrences:new Set(sessions.map(s=>s.id)).size,confidence:valid.length?valid.reduce((n,h)=>n+h.interpretation.confidence,0)/valid.length:0,state:approved.length?'confirmed':valid.length?'hypothesis':'rejected',provenance:{engine:'ECHO',sessionIds:[...new Set(sessions.map(s=>s.id))]},variations:valid.slice(1).flatMap(h=>measuredVariations(this.session(valid[0]!.sessionId),this.session(h.sessionId),h.decision)),signature:tokens.length?tokens:existing.signature};
    if(approved.length){
      if(!habit.memoryId&&Number(this.db.prepare('SELECT COUNT(*) AS n FROM memories').get()!.n)>=1000)throw new Error('MEMORY contient déjà 1 000 souvenirs.');
      habit.memoryId??=randomUUID();const content=`Habitude confirmée : ${habit.name}. ${habit.description}\nContexte : ${habit.context}\nProcédure observée : ${habit.procedure.map(s=>s.description).join(' ; ')}`.slice(0,4000),now=new Date().toISOString();
      this.db.prepare("INSERT INTO memories(id,content,category,origin,confidence,source,created_at,updated_at) VALUES(?,?,'experience','explicit',NULL,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").run(habit.memoryId,content,`ECHO:${id}`,habit.firstObservedAt,now);
      this.db.prepare('DELETE FROM memory_search WHERE id=?').run(habit.memoryId);this.db.prepare('INSERT INTO memory_search(id,content) VALUES(?,?)').run(habit.memoryId,content);
    }else{this.dropMemory(habit.memoryId);habit.memoryId=null;}
    this.saveHabit(habit);
    this.db.prepare('DELETE FROM echo_opportunities WHERE habit_id=?').run(id);
    if(habit.state==='confirmed'&&habit.occurrences>=2){const opportunity:AutomationOpportunity={id:randomUUID(),habitId:id,createdAt:new Date().toISOString(),description:'Cette procédure semble répétitive. Une aide pourrait être étudiée lors du jalon FORGE, après une nouvelle autorisation.',status:'proposed',executionAllowed:false};this.db.prepare('INSERT INTO echo_opportunities(id,habit_id,content) VALUES(?,?,?)').run(opportunity.id,id,JSON.stringify(opportunity));}
  }
  removeSession(id:string):void {const session=this.session(id),ids=[...new Set(session.hypotheses.map(h=>h.habitId))];this.transaction(()=>{for(const h of session.hypotheses)this.invalidate(interpretationHash(signature(session.events),h.interpretation.description),'Session supprimée.');this.db.prepare('DELETE FROM echo_sessions WHERE id=?').run(id);for(const habitId of ids)this.rebuild(habitId);});this.compact();}
  removeHabitForMemory(memoryId:string):boolean {const habit=this.habits().find(h=>h.memoryId===memoryId);if(!habit)return false;this.transaction(()=>{this.invalidate(signatureHash(habit.signature),'Habitude supprimée de MEMORY.');this.dropMemory(memoryId);for(const id of habit.provenance.sessionIds)this.db.prepare("UPDATE echo_sessions SET summary='Habitude supprimée de MEMORY.' WHERE id=?").run(id);this.db.prepare('DELETE FROM echo_habits WHERE id=?').run(habit.id);});this.compact();return true;}
  withdrawExcluded(predicate:(session:EchoObservationSession)=>boolean):void{const ids=this.sessions().filter(predicate).map(s=>s.id);for(const id of ids)this.removeSession(id);}
  private dropMemory(id:string|null){if(!id)return;this.db.prepare('DELETE FROM memory_search WHERE id=?').run(id);this.db.prepare('DELETE FROM memories WHERE id=?').run(id);}
  private saveHabit(habit:Habit){this.db.prepare('INSERT INTO echo_habits(id,content,memory_id) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,memory_id=excluded.memory_id').run(habit.id,JSON.stringify(habit),habit.memoryId);}
  private invalidate(hash:string,reason:string){this.db.prepare('INSERT INTO echo_invalidations(signature,reason) VALUES(?,?) ON CONFLICT(signature) DO NOTHING').run(hash,reason);}
  private transaction(action:()=>void){this.db.exec('BEGIN IMMEDIATE');try{action();this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}}
  private compact(){this.db.prepare("INSERT INTO memory_search(memory_search) VALUES('optimize')").run();this.db.exec('VACUUM');}
  close(){this.db.close();}
}
