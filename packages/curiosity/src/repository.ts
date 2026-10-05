import { createHash, randomUUID } from 'node:crypto';
import { openLocalDatabase } from '@aether/memory';
import type { CuriosityConnection, CuriosityItem, CuriosityJournal, CuriosityObjectKind, CuriosityOrigin, CuriositySettings, Exploration, ExplorationAction, Interest, InterestHistory, InterestWrite, ModelRoute } from '@aether/shared';
import { DEFAULT_CURIOSITY_SETTINGS, normalized, parseCuriositySettings, parseInterestWrite, uuid, type ExplorationResult } from './policy';

type Row = Record<string, unknown>;
const hashTitle = (title: string) => createHash('sha256').update(normalized(title)).digest('hex');
function interest(row: Row): Interest { return { id: String(row.id), title: String(row.title), description: String(row.description), createdAt: String(row.created_at), updatedAt: String(row.updated_at), level: Number(row.level), origin: JSON.parse(String(row.origin)), status: row.status as Interest['status'] }; }
function exploration(row: Row): Exploration { return { id: String(row.id), interestId: row.interest_id as string | null, targets: JSON.parse(String(row.targets)), action: row.action as ExplorationAction, createdAt: String(row.created_at), completedAt: row.completed_at as string | null, status: row.status as Exploration['status'], reason: String(row.reason), model: row.model as string | null, route: row.route ? JSON.parse(String(row.route)) : null, error: row.error as string | null, nextQuestion: row.next_question as string | null, unread: Boolean(row.unread) }; }
export class CuriosityRepository {
  private readonly db;
  constructor(path: string) { this.db = openLocalDatabase(path); }
  recoverInterrupted() { this.db.prepare("UPDATE curiosity_explorations SET status='interrupted',completed_at=?,error='Application arrêtée avant la fin de la génération.' WHERE status='running'").run(new Date().toISOString()); }
  settings(): CuriositySettings { const row = this.db.prepare('SELECT content FROM curiosity_settings WHERE id=1').get(); return row ? parseCuriositySettings(JSON.parse(String(row.content))) : structuredClone(DEFAULT_CURIOSITY_SETTINGS); }
  saveSettings(value: CuriositySettings) { const settings = parseCuriositySettings(value); this.db.prepare('INSERT INTO curiosity_settings(id,content) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content').run(JSON.stringify(settings)); }
  journal(): CuriosityJournal {
    return {
      interests: this.db.prepare('SELECT * FROM curiosity_interests ORDER BY level DESC,created_at,id').all().map(interest),
      explorations: this.db.prepare('SELECT * FROM curiosity_explorations ORDER BY created_at DESC,id DESC').all().map(exploration),
      items: this.db.prepare('SELECT * FROM curiosity_items ORDER BY created_at DESC,id DESC').all().map((row): CuriosityItem => ({ id: String(row.id), interestId: String(row.interest_id), explorationId: String(row.exploration_id), kind: row.kind as CuriosityItem['kind'], content: String(row.content), createdAt: String(row.created_at), confidence: row.confidence === null ? null : Number(row.confidence), limits: row.limits as string | null, status: row.status as CuriosityItem['status'] })),
      connections: this.db.prepare('SELECT * FROM curiosity_connections ORDER BY created_at DESC').all().map((row): CuriosityConnection => ({ id: String(row.id), fromId: String(row.from_id), toId: String(row.to_id), explorationId: String(row.exploration_id), description: String(row.description), createdAt: String(row.created_at) })),
      history: this.db.prepare('SELECT * FROM curiosity_history ORDER BY created_at DESC,id DESC').all().map((row): InterestHistory => ({ id: String(row.id), interestId: String(row.interest_id), explorationId: row.exploration_id as string | null, createdAt: String(row.created_at), action: String(row.action), reason: String(row.reason), previousLevel: row.previous_level === null ? null : Number(row.previous_level), level: Number(row.level), previousStatus: row.previous_status as InterestHistory['previousStatus'], status: row.status as Interest['status'] })),
      blockedDomains: this.db.prepare('SELECT domain FROM curiosity_blocks ORDER BY domain').all().map(row => String(row.domain)),
    };
  }
  private history(value: Interest, previous: Interest | null, action: string, reason: string, explorationId: string | null) {
    this.db.prepare('INSERT INTO curiosity_history VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), value.id, explorationId, new Date().toISOString(), action, reason, previous?.level ?? null, value.level, previous?.status ?? null, value.status);
  }
  private insertInterest(input: InterestWrite, origin: CuriosityOrigin, explorationId: string | null): Interest {
    if (Number(this.db.prepare('SELECT COUNT(*) AS total FROM curiosity_interests').get()!.total) >= 500) throw new Error('Le journal contient déjà 500 intérêts. Supprimez une piste avant d’en ajouter.');
    const now = new Date().toISOString(); const value: Interest = { ...input, id: randomUUID(), createdAt: now, updatedAt: now, origin };
    this.db.prepare('INSERT INTO curiosity_interests VALUES(?,?,?,?,?,?,?,?)').run(value.id, value.title, value.description, now, now, value.level, JSON.stringify(origin), value.status);
    this.history(value, null, 'birth', origin.reason, explorationId); return value;
  }
  writeInterest(payload: InterestWrite): Interest {
    const input = parseInterestWrite(payload); this.db.exec('BEGIN IMMEDIATE');
    try {
      let value: Interest;
      if (input.id) {
        const row = this.db.prepare('SELECT * FROM curiosity_interests WHERE id=?').get(input.id);
        if (!row) throw new Error('Cet intérêt n’existe plus.');
        const previous = interest(row); value = { ...previous, ...input, updatedAt: new Date().toISOString() };
        this.db.prepare('UPDATE curiosity_interests SET title=?,description=?,level=?,status=?,updated_at=? WHERE id=?').run(value.title,value.description,value.level,value.status,value.updatedAt,value.id);
        this.history(value,previous,'user-edit','Priorité ou statut modifié par l’utilisateur.',null);
      } else {
        this.db.prepare('DELETE FROM curiosity_forgotten WHERE title_hash=?').run(hashTitle(input.title));
        value = this.insertInterest(input,{ kind:'user',ref:null,reason:'Piste proposée volontairement dans le journal.' },null);
      }
      this.db.exec('COMMIT'); return value;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  begin(action: ExplorationAction, targets: string[], reason: string): Exploration {
    const value: Exploration = { id: randomUUID(), interestId: targets[0] ?? null, targets, action, createdAt: new Date().toISOString(), completedAt: null, status:'running', reason, model:null, route:null, error:null, nextQuestion:null, unread:false };
    this.db.prepare('INSERT INTO curiosity_explorations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.id,value.interestId,JSON.stringify(targets),value.action,value.createdAt,null,value.status,reason,null,null,null,null,0); return value;
  }
  finish(id: string, status: Exploration['status'], error: string | null) { this.db.prepare('UPDATE curiosity_explorations SET status=?,completed_at=?,error=? WHERE id=? AND status=\'running\'').run(status,new Date().toISOString(),error,id); }
  commit(id: string, result: ExplorationResult, targets: string[], origin: CuriosityOrigin, model: string, route: ModelRoute) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const attempt = this.db.prepare("SELECT * FROM curiosity_explorations WHERE id=? AND status='running'").get(id);
      if (!attempt) throw new Error('Cette exploration a été annulée ou supprimée.');
      const existing = targets.map(target => { const row = this.db.prepare('SELECT * FROM curiosity_interests WHERE id=?').get(target); if (!row) throw new Error('Une piste n’existe plus.'); return interest(row); });
      let created: Interest | null = null;
      if (result.newInterest) {
        if (this.db.prepare('SELECT 1 FROM curiosity_forgotten WHERE title_hash=?').get(hashTitle(result.newInterest.title))) throw new Error('Le modèle a proposé une piste précédemment supprimée. Aucun nouvel intérêt conservé.');
        if (this.journal().interests.some(item => normalized(item.title) === normalized(result.newInterest!.title))) throw new Error('Le modèle a proposé un intérêt déjà présent.');
        created = this.insertInterest({ title: result.newInterest.title, description: result.newInterest.description, level: 0.55, status:'active' },origin,id);
      }
      const primary = existing[0] ?? created;
      if (!primary) throw new Error('La naissance d’un intérêt doit produire un véritable sujet.');
      if (this.db.prepare("SELECT 1 FROM curiosity_items WHERE interest_id=? AND kind='question' AND lower(content)=lower(?)").get(primary.id,result.question)) throw new Error('Le modèle a répété une question existante. Aucun progrès conservé.');
      for (const previous of existing) {
        const status = result.decision === 'dormant' ? 'dormant' : result.decision === 'abandon' ? 'abandoned' : result.decision === 'reactivate' ? 'active' : previous.status;
        const level = Math.max(0,Math.min(1,Math.round((previous.level + result.levelDelta)*100)/100));
        const value = { ...previous,status,level,updatedAt:new Date().toISOString() };
        this.db.prepare('UPDATE curiosity_interests SET level=?,status=?,updated_at=? WHERE id=?').run(level,status,value.updatedAt,value.id);
        this.history(value,previous,result.decision,result.why,id);
      }
      const now = new Date().toISOString();
      for (const kind of ['question','hypothesis','discovery'] as const) this.db.prepare('INSERT INTO curiosity_items VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),primary.id,id,kind,result[kind],now,kind==='hypothesis'?result.confidence:null,kind==='discovery'?`${result.limits}\nSynthèse du modèle local, sans vérification externe ni expérience exécutée.`:null,kind==='question'?'open':kind==='hypothesis'?'proposed':'synthesized');
      if (result.decision === 'connect') {
        if (existing.length !== 2 || !result.connection) throw new Error('Connexion incomplète : deux intérêts et une relation sont nécessaires.');
        const [from,to] = existing.map(item => item.id).sort();
        this.db.prepare('INSERT INTO curiosity_connections VALUES(?,?,?,?,?,?)').run(randomUUID(),from!,to!,id,result.connection,now);
      }
      this.db.prepare('UPDATE curiosity_explorations SET interest_id=?,action=?,status=\'succeeded\',completed_at=?,reason=?,model=?,route=?,next_question=?,unread=1 WHERE id=?').run(primary.id,result.decision,now,result.why,model,JSON.stringify(route),result.nextQuestion,id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  markRead() { this.db.exec('UPDATE curiosity_explorations SET unread=0'); }
  setBlocked(domain: string, blocked: boolean) { const key = normalized(domain); if (key.length < 3 || key.length > 100) throw new Error('Domaine à exclure invalide (3 à 100 caractères).'); if (blocked) this.db.prepare('INSERT OR IGNORE INTO curiosity_blocks VALUES(?)').run(key); else this.db.prepare('DELETE FROM curiosity_blocks WHERE domain=?').run(key); }
  remove(kind: CuriosityObjectKind, id: string) {
    uuid(id);
    const tables = { interest:'curiosity_interests',exploration:'curiosity_explorations',question:'curiosity_items',hypothesis:'curiosity_items',discovery:'curiosity_items',connection:'curiosity_connections' } as const;
    if (!Object.hasOwn(tables,kind)) throw new Error('Objet de curiosité invalide.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const predicate = ['question','hypothesis','discovery'].includes(kind) ? ' AND kind=?' : '';
      const params = predicate ? [id,kind] : [id];
      if(!this.db.prepare(`SELECT 1 FROM ${tables[kind]} WHERE id=?${predicate}`).get(...params)) throw new Error('Cet objet n’existe plus.');
      const journal=this.journal(),refs=new Set([id]),interests=new Set(kind==='interest'?[id]:[]),explorations=new Set(kind==='exploration'?[id]:[]);
      let changed=true;
      while(changed) {
        changed=false;
        for(const item of journal.interests) if(item.origin.ref && ['interest','exploration','connection'].includes(item.origin.kind) && refs.has(item.origin.ref) && !interests.has(item.id)) {interests.add(item.id);refs.add(item.id);changed=true;}
        for(const item of journal.explorations) if((item.interestId && interests.has(item.interestId) || item.targets.some(target=>interests.has(target))) && !explorations.has(item.id)) {explorations.add(item.id);refs.add(item.id);changed=true;}
        for(const item of journal.connections) if((interests.has(item.fromId)||interests.has(item.toId)||explorations.has(item.explorationId)) && !refs.has(item.id)) {refs.add(item.id);changed=true;}
      }
      if (kind === 'interest') {
        const row = this.db.prepare('SELECT title FROM curiosity_interests WHERE id=?').get(id);
        if (!row) throw new Error('Cet intérêt n’existe plus.');
        this.db.prepare('INSERT OR IGNORE INTO curiosity_forgotten VALUES(?)').run(hashTitle(String(row.title)));
      }
      // Purge provenance descendants as well as SQL foreign-key dependents. Only the requested row is deleted below.
      for(const value of journal.interests) if(interests.has(value.id) && value.id!==id) {this.db.prepare('INSERT OR IGNORE INTO curiosity_forgotten VALUES(?)').run(hashTitle(value.title));this.db.prepare('DELETE FROM curiosity_interests WHERE id=?').run(value.id);}
      for(const explorationId of explorations) if(explorationId!==id) this.db.prepare('DELETE FROM curiosity_explorations WHERE id=?').run(explorationId);
      this.db.prepare(`DELETE FROM ${tables[kind]} WHERE id=?${predicate}`).run(...params);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.db.exec('VACUUM');
  }
  removeMemoryOrigins(id: string) { for (const value of this.journal().interests) if (value.origin.kind==='memory' && value.origin.ref===id && this.db.prepare('SELECT 1 FROM curiosity_interests WHERE id=?').get(value.id)) this.remove('interest',value.id); }
  close() { this.db.close(); }
}
