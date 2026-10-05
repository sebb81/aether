import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { explicitMemoryRequest, parseMemoryWrite, SqliteMemoryRepository } from '@aether/memory';
import type { MemoryDraft } from '@aether/shared';

const draft: MemoryDraft = { content: 'Mon projet préféré est Luciole.', category: 'project', origin: 'explicit', confidence: null, source: 'demande utilisateur' };
test('only explicit retention requests create candidates, never ordinary chat or negation', () => {
  assert.equal(explicitMemoryRequest('Mon projet préféré est Luciole.'), null);
  assert.equal(explicitMemoryRequest('Retiens que mon projet préféré est Luciole.'), 'mon projet préféré est Luciole');
  assert.equal(explicitMemoryRequest('Mon projet préféré est Luciole. Retiens-le.'), 'Mon projet préféré est Luciole.');
  assert.equal(explicitMemoryRequest('Je voudrais que tu mémorise que mon projet est Luciole.'), 'mon projet est Luciole');
  assert.equal(explicitMemoryRequest('Retiens-le.', 'Mon projet est Luciole.'), 'Mon projet est Luciole.');
  assert.equal(explicitMemoryRequest('Ne retiens pas mon projet Luciole.'), null);
  assert.equal(explicitMemoryRequest('Ne mémorise jamais mon prénom.'), null);
  assert.equal(explicitMemoryRequest('Retiens-le.'), null);
  assert.equal(explicitMemoryRequest('Retiens que lemonde est mon exemple.'), 'lemonde est mon exemple');
});
test('memory writes reject fake provenance, arbitrary fields and confidence on explicit facts', () => {
  assert.throws(() => parseMemoryWrite({ ...draft }), /autorisé/);
  const { source: _source, ...input } = draft;
  assert.deepEqual(parseMemoryWrite(input), input);
  assert.throws(() => parseMemoryWrite({ ...input, confidence: 1 }), /inventé/);
  assert.throws(() => parseMemoryWrite({ ...input, origin: 'inference', confidence: null }), /hypothèse/);
  assert.throws(() => parseMemoryWrite({ ...input, origin: 'inference', confidence: 1.1 }));
  assert.throws(() => parseMemoryWrite({ ...input, id: '../../data' }));
});
test('SQLite persists metadata, separates hypotheses, corrects the FTS index and deletes durably', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'aether-memory-'));
  const file = join(folder, 'memory.sqlite');
  let memory: SqliteMemoryRepository | undefined;
  try {
    memory = new SqliteMemoryRepository(file);
    const fact = await memory.create(draft);
    assert.equal(fact.status, 'confirmed'); assert.equal(fact.confidence, null);
    assert.equal((await memory.create(draft)).id, fact.id);
    const hypothesis = await memory.create({ ...draft, content: 'L’utilisateur semble aimer les documentaires.', origin: 'inference', confidence: 0.65 });
    assert.equal(hypothesis.status, 'assumed'); assert.equal(hypothesis.confidence, 0.65);
    memory.close(); memory = new SqliteMemoryRepository(file);
    assert.deepEqual((await memory.search('préféré Luciole'))[0], fact);
    const corrected = await memory.update(fact.id, { ...draft, content: 'Mon projet préféré est Hibou-8392.' });
    assert.equal(corrected.createdAt, fact.createdAt); assert.equal(corrected.id, fact.id);
    assert.equal((await memory.search('Luciole')).length, 0);
    assert.equal((await memory.search('Hibou')).length, 1);
    assert.equal((await memory.list('" OR 1=1 -- Hibou')).length, 1);
    await memory.remove(fact.id);
    assert.equal((await memory.search('Hibou')).length, 0);
    await assert.rejects(memory.remove(fact.id), /existe plus/);
    memory.close(); memory = new SqliteMemoryRepository(file);
    assert.deepEqual(await memory.export(), [hypothesis]);
    assert.equal((await readFile(file)).includes(Buffer.from('Hibou-8392')), false);
    const db = new DatabaseSync(file);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM memory_search WHERE id=?').get(fact.id)!.count, 0);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%conversation%'").all(), []);
    db.close();
  } finally { memory?.close(); await rm(folder, { recursive: true, force: true }); }
});
test('a newer SQLite schema is preserved and rejected rather than overwritten', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'aether-schema-'));
  try {
    const file = join(folder, 'memory.sqlite'); const db = new DatabaseSync(file);
    db.exec("CREATE TABLE future(value TEXT); INSERT INTO future VALUES('keep'); PRAGMA user_version=3"); db.close();
    assert.throws(() => new SqliteMemoryRepository(file), /plus récente/);
    const preserved = new DatabaseSync(file);
    assert.equal(preserved.prepare('SELECT value FROM future').get()!.value, 'keep'); preserved.close();
  } finally { await rm(folder, { recursive: true, force: true }); }
});
