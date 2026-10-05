import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { DurableMemory, MemoryDraft, MemoryRecord, MemoryRepository } from '@aether/shared';
import { validateMemoryDraft } from './policy';
import { openLocalDatabase } from './database';

const STOP_WORDS = new Set('de du des le la les un une et est es en dans pour par avec que qui quoi quel quelle quelles quels mon ma mes ton ta tes son sa ses ce cette ces c quoi moi toi tu je nous vous il elle ils elles me te se a au aux sur ne pas sais rappelle souviens information preference prefere dis retrouver connais'.split(' '));
function searchTerms(query: string): string[] {
  return [...new Set(query.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter(word => !STOP_WORDS.has(word)).slice(0, 20);
}
type Row = Record<string, string | number | bigint | null | Uint8Array>;
function record(row: Row): DurableMemory {
  return { id: String(row.id), content: String(row.content), kind: row.category === 'experience' ? 'experience' : 'knowledge', category: row.category as DurableMemory['category'], source: String(row.source), scope: 'personal', createdAt: String(row.created_at), updatedAt: String(row.updated_at), confidence: row.confidence === null ? null : Number(row.confidence), status: row.origin === 'explicit' ? 'confirmed' : 'assumed', origin: row.origin as DurableMemory['origin'] };
}
export class SqliteMemoryRepository implements MemoryRepository {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = openLocalDatabase(path);
  }
  async list(query = ''): Promise<DurableMemory[]> {
    if (!query.trim()) return this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC, id ASC').all().map(row => record(row));
    const terms = searchTerms(query);
    if (!terms.length) return [];
    const match = terms.map(term => `"${term}"*`).join(' OR ');
    return this.db.prepare('SELECT m.* FROM memories m JOIN memory_search s ON m.id=s.id WHERE memory_search MATCH ? ORDER BY bm25(memory_search), m.updated_at DESC').all(match).map(row => record(row));
  }
  async search(query: string): Promise<DurableMemory[]> {
    const terms = searchTerms(query);
    if (!terms.length) return (await this.list()).slice(0, 6);
    return (await this.list(query)).slice(0, 6);
  }
  async create(draft: MemoryDraft): Promise<DurableMemory> {
    const value = validateMemoryDraft(draft);
    const duplicate = this.db.prepare('SELECT * FROM memories WHERE content=? AND origin=?').get(value.content, value.origin);
    if (duplicate) return record(duplicate);
    if (Number(this.db.prepare('SELECT COUNT(*) AS total FROM memories').get()!.total) >= 1000) throw new Error('MEMORY contient déjà 1 000 souvenirs. Supprimez ou exportez certains souvenirs avant d’en ajouter.');
    const now = new Date().toISOString();
    const memory: DurableMemory = { ...value, id: randomUUID(), kind: value.category === 'experience' ? 'experience' : 'knowledge', scope: 'personal', createdAt: now, updatedAt: now, status: value.origin === 'explicit' ? 'confirmed' : 'assumed' };
    await this.save(memory); return memory;
  }
  async update(id: string, draft: MemoryDraft): Promise<DurableMemory> {
    const existing = this.db.prepare('SELECT * FROM memories WHERE id=?').get(id);
    if (!existing) throw new Error('Ce souvenir n’existe plus.');
    const value = validateMemoryDraft(draft);
    const updated: DurableMemory = { ...record(existing), ...value, kind: value.category === 'experience' ? 'experience' : 'knowledge', updatedAt: new Date().toISOString(), status: value.origin === 'explicit' ? 'confirmed' : 'assumed' };
    await this.save(updated); return updated;
  }
  async save(memory: MemoryRecord): Promise<void> {
    const durable = memory as DurableMemory;
    const value = validateMemoryDraft(durable);
    if (!/^[a-f0-9-]{36}$/.test(memory.id) || !Number.isFinite(Date.parse(memory.createdAt))) throw new Error('Identifiant ou date du souvenir invalide.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO memories(id,content,category,origin,confidence,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,category=excluded.category,origin=excluded.origin,confidence=excluded.confidence,source=excluded.source,updated_at=excluded.updated_at')
        .run(memory.id, value.content, value.category, value.origin, value.confidence, value.source, memory.createdAt, durable.updatedAt);
      this.db.prepare('DELETE FROM memory_search WHERE id=?').run(memory.id);
      this.db.prepare('INSERT INTO memory_search(id,content) VALUES(?,?)').run(memory.id, value.content);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async remove(id: string): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM memory_search WHERE id=?').run(id);
      const result = this.db.prepare('DELETE FROM memories WHERE id=?').run(id);
      if (!result.changes) throw new Error('Ce souvenir n’existe plus.');
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    // Compact the FTS index and reclaim deleted content; no durable conversation log exists.
    this.db.prepare("INSERT INTO memory_search(memory_search) VALUES('optimize')").run();
    this.db.exec('VACUUM');
  }
  async export(): Promise<DurableMemory[]> { return this.list(); }
  close(): void { this.db.close(); }
}
