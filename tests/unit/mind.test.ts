import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MindEngine, ProviderError, OllamaProvider, OpenAIProvider, localOllamaUrl, parseAiInput } from '@aether/mind';
import { SqliteMemoryRepository } from '@aether/memory';
import { DEFAULT_PREFERENCES, PresenceModel } from '@aether/core';
import type { LlmProvider } from '@aether/shared';

// Test doubles are confined to tests. Application factories expose only real providers.
function testProvider(complete: LlmProvider['complete']): LlmProvider { return { id: 'unit-test', complete }; }
const success: LlmProvider['complete'] = async () => ({ text: 'Réponse de test', model: 'test-model' });
test('MIND drives real lifecycle events and retains only explicitly requested user content', async () => {
  const memory = new SqliteMemoryRepository(':memory:');
  const requests: Parameters<LlmProvider['complete']>[0][] = [];
  const engine = new MindEngine(async () => testProvider(async request => { requests.push(request); return success(request); }), memory);
  const states: string[] = []; engine.events.on('changed', snapshot => states.push(snapshot.state));
  try {
    engine.listening(); assert.equal(engine.snapshot().state, 'listening');
    assert.deepEqual(await engine.submit('Mon projet est Luciole.'), { ok: true });
    assert.equal((await memory.list()).length, 0);
    assert.deepEqual(await engine.submit('Retiens-le.'), { ok: true });
    const stored = (await memory.list())[0]!;
    assert.equal(stored.content, 'Mon projet est Luciole.'); assert.equal(stored.origin, 'explicit');
    assert.match(stored.source, /demande explicite.*message/);
    assert.match(requests.at(-1)!.messages[0]!.content, /ENTITY/);
    assert.match(requests.at(-1)!.messages[0]!.content, /Souvenir effectivement enregistré/);
    assert(states.includes('thinking')); assert.equal(states.at(-1), 'replying');
    engine.snapshot().messages[0]!.content = 'tampered'; assert.notEqual(engine.snapshot().messages[0]!.content, 'tampered');
    engine.reset(); assert.equal(engine.snapshot().messages.length, 0); assert.equal((await memory.list()).length, 1);
    await engine.submit('Quel est mon projet ?'); assert.equal(engine.snapshot().usedMemories[0]!.id, stored.id);
  } finally { memory.close(); }
});
test('provider failures and missing configuration never fabricate an assistant response or stored receipt', async () => {
  const memory = new SqliteMemoryRepository(':memory:');
  try {
    const engine = new MindEngine(async () => { throw new ProviderError('not-configured', 'Aucune IA configurée.'); }, memory);
    assert.equal((await engine.submit('Retiens que mon projet est Luciole.')).ok, false);
    assert.equal(engine.snapshot().state, 'error'); assert.equal(engine.snapshot().messages.length, 1);
    assert.equal((await memory.list()).length, 0); assert.equal(engine.snapshot().storedMemory, null);
    const empty = new MindEngine(async () => testProvider(async () => ({ text: ' ', model: 'empty' })), memory);
    assert.equal((await empty.submit('Bonjour')).ok, false); assert.match(empty.snapshot().error!, /aucun texte/);
    assert.equal(empty.snapshot().messages.filter(item => item.role === 'assistant').length, 0);
  } finally { memory.close(); }
});
test('context reset cancels pending generations, blocks duplicates and prevents deleted memory returning late', async () => {
  const memory = new SqliteMemoryRepository(':memory:');
  let resolveAnswer!: (value: { text: string; model: string }) => void;
  let signal: AbortSignal | undefined;
  const engine = new MindEngine(async () => testProvider(request => { signal = request.signal; return new Promise(resolve => { resolveAnswer = resolve; }); }), memory);
  try {
    const stored = await memory.create({ content: 'Mon projet est Luciole.', category: 'project', origin: 'explicit', confidence: null, source: 'utilisateur' });
    const pending = engine.submit('Quel est mon projet ?');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(engine.snapshot().state, 'thinking');
    assert.equal((await engine.submit('Autre demande')).ok, false);
    engine.reset('Suppression'); await memory.remove(stored.id);
    assert.equal(signal?.aborted, true);
    resolveAnswer({ text: 'Luciole', model: 'late' }); assert.equal((await pending).ok, false);
    assert.equal(engine.snapshot().messages.length, 0); assert.equal(engine.snapshot().usedMemories.length, 0);
    assert.equal((await memory.search('projet')).length, 0);
  } finally { memory.close(); }
});
test('memory failures surface as storage failures and do not call the model', async () => {
  let calls = 0;
  const engine = new MindEngine(async () => testProvider(async request => { calls++; return success(request); }), { search: async () => { throw new Error('disk'); }, create: async () => { throw new Error('disk'); } });
  await engine.submit('Retiens que mon projet est Luciole.'); assert.match(engine.snapshot().error!, /MEMORY.*enregistrer/);
  await engine.submit('Quel projet ?'); assert.match(engine.snapshot().error!, /MEMORY.*consulter/);
  assert.equal(calls, 0);
});
test('transient history stays bounded and cancellation returns to idle', async () => {
  const memory = new SqliteMemoryRepository(':memory:');
  const engine = new MindEngine(async () => testProvider(success), memory);
  try { for (let i = 0; i < 10; i++) await engine.submit(`Message numéro ${i}`);
    assert.equal(engine.snapshot().messages.length, 12); assert.equal((await memory.list()).length, 0);
    engine.cancel(); assert.equal(engine.snapshot().state, 'idle');
  } finally { memory.close(); }
});
test('J2 opts into visual thinking and error while future states stay unavailable', () => {
  const model = new PresenceModel(structuredClone(DEFAULT_PREFERENCES), true, true);
  model.setState('thinking'); assert.equal(model.snapshot().state, 'thinking');
  model.setState('error'); assert.equal(model.snapshot().features.memory, 'available');
  assert.throws(() => model.setState('observing'), /non implémenté/);
  model.setCloudAllowed(true); assert.equal(model.snapshot().permissions.network, true);
  model.setCloudAllowed(false); assert.equal(model.snapshot().permissions.network, false);
});
test('provider configuration refuses remote Ollama, URL credentials, arbitrary commands and unknown providers', () => {
  assert.equal(localOllamaUrl('http://localhost:11434/'), 'http://localhost:11434');
  for (const url of ['https://localhost', 'http://example.com', 'http://127.0.0.1@evil.test', 'http://127.0.0.1/api', 'http://localhost?key=secret']) assert.throws(() => localOllamaUrl(url));
  const input = { provider: 'ollama', model: 'llama3.1:8b', ollamaUrl: 'http://127.0.0.1:11434', cloudConsent: false };
  assert.deepEqual(parseAiInput(input), input);
  assert.throws(() => parseAiInput({ ...input, command: 'run' }));
  assert.throws(() => parseAiInput({ ...input, model: '' }));
  assert.throws(() => parseAiInput({ ...input, apiKey: 'value', removeKey: true }));
});
test('Ollama adapter sends the real chat protocol and exposes empty, missing-model and abort errors', async () => {
  let sent: Record<string, unknown> | undefined;
  const transport: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init!.body)); return Response.json({ model: 'local-test', message: { content: 'Bonjour' } }); };
  const request = { messages: [{ role: 'user' as const, content: 'Bonjour' }], signal: new AbortController().signal };
  assert.deepEqual(await new OllamaProvider('local-test', 'http://localhost:11434', transport).complete(request), { text: 'Bonjour', model: 'local-test' });
  assert.equal(sent!.stream, false); assert.equal(sent!.model, 'local-test');
  await assert.rejects(new OllamaProvider('absent', 'http://localhost:11434', async () => new Response('', { status: 404 })).complete(request), /absent/);
  await assert.rejects(new OllamaProvider('empty', 'http://localhost:11434', async () => Response.json({ message: { content: '' } })).complete(request), /aucun texte/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(new OllamaProvider('test', 'http://localhost:11434', async () => { throw new DOMException('aborted', 'AbortError'); }).complete({ ...request, signal: aborted.signal }), /annulée/);
});
test('OpenAI adapter uses Responses with store:false and sanitizes provider errors without fallback', async () => {
  let sent: Record<string, unknown> | undefined;
  const transport: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init!.body)); return Response.json({ id: 'resp_test', object: 'response', model: 'test', output: [{ type: 'message', id: 'msg_test', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'Bonjour', annotations: [] }] }] }); };
  const request = { messages: [{ role: 'user' as const, content: 'Bonjour' }], signal: new AbortController().signal };
  const response = await new OpenAIProvider('test', 'test-key-unit-only', transport).complete(request);
  assert.equal(response.text, 'Bonjour'); assert.equal(sent!.store, false);
  assert.equal(JSON.stringify(sent).includes('test-key-unit-only'), false);
  const unauthorized: typeof fetch = async () => Response.json({ error: { message: 'raw-key-and-private-body', type: 'invalid_request_error' } }, { status: 401 });
  await assert.rejects(new OpenAIProvider('test', 'test-key-unit-only', unauthorized).complete(request), error => error instanceof ProviderError && /Vérifiez votre clé/.test(error.message) && !error.message.includes('raw-key'));
});
