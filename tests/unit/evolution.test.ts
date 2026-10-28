import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { EvolutionStore, ForgeEngine, Mirror, FileBroker, parseSpecification, parseOutput, safeRelative, validatePlan } from '@aether/evolution';
import { WindowsCapabilityRuntime } from '../../apps/desktop/main/evolution-runtime';
import { DesktopEvolutionService } from '../../apps/desktop/main/evolution-service';
import type { CapabilityInput, CapabilityOutput, CapabilityRuntime, CodeGenerationProvider, ForgeSpecification } from '@aether/shared';

const input: CapabilityInput = { files: [{ path: 'a.wav', size: 3, modifiedAt: '2026-10-15T00:00:00.000Z' }], parameters: {} };
const output: CapabilityOutput = { summary: 'Un renommage', renames: [{ from: 'a.wav', to: 'audio/a.wav' }], data: null };
const specification: ForgeSpecification = { title: 'Test contrôlé', objective: 'Classer les fichiers WAV', description: 'Une capacité de test, générateur double limité aux unitaires.', inputs: ['Métadonnées'], outputs: ['Plan'], constraints: ['Sans réseau'], permissions: ['filesystem.read', 'filesystem.write'], dependencies: [], successCriteria: ['Classement WAV'], acceptanceTests: [{ name: 'WAV', input, expected: output }] };
const source = 'exports.run = input => ({summary:"Un renommage",renames:input.files.map(f=>({from:f.path,to:"audio/"+f.path})),data:null});';
const fakeRuntime: CapabilityRuntime = { evaluate: async (_source, _input, _signal, compile) => compile ? null : structuredClone(output) };
const provider: CodeGenerationProvider = { generate: async () => ({ id: 'test-files', name: 'Classement', version: '1.0.0', description: 'Contrôlé', source, tests: specification.acceptanceTests, provider: 'Unit test double' }) };
function fixture(runtime = fakeRuntime, generation = provider) { const folder = mkdtempSync(join(tmpdir(), 'aether-evolution-')), store = new EvolutionStore(folder), engine = new ForgeEngine(store, generation, new Mirror(runtime)); return { folder, store, engine, dispose: () => rmSync(folder, { recursive: true, force: true }) }; }

test('J6 specifications reject vagueness, unknown fields, external dependencies and permission escalation', () => {
  assert.deepEqual(parseSpecification(specification), specification);
  for (const value of [{ ...specification, permissions: ['network'] }, { ...specification, permissions: ['process.execution'] }, { ...specification, dependencies: ['untrusted'] }, { ...specification, successCriteria: [] }, { ...specification, acceptanceTests: [] }, { ...specification, approved: true }]) assert.throws(() => parseSpecification(value));
  assert.throws(()=>parseSpecification({...specification,acceptanceTests:[{...specification.acceptanceTests[0]!,input:{files:[],parameters:{}}}]}),/incohérent/);
  assert.throws(()=>parseSpecification({...specification,acceptanceTests:[{name:'Horodatage absent',input:{...input,files:[{...input.files[0],modifiedAt:''}]},expected:output}]}),/Test 1 \(Horodatage absent\) invalide : Métadonnées invalides/);
});
test('J6 paths and output plans reject traversal, Windows devices, collisions and ungranted writes', () => {
  for (const path of ['../secret', 'C:/private', '/root', 'a/../b', 'NUL.txt', 'a:stream', 'a./x']) assert.throws(() => safeRelative(path));
  assert.throws(() => parseOutput({ ...output, execute: 'shell' })); assert.throws(() => validatePlan(input, output, ['filesystem.read']));
  for (const renames of [[{ from: 'a.wav', to: 'a.wav' }], [{ from: 'unknown', to: 'b.wav' }], [{ from: 'a.wav', to: 'b.wav' }, { from: 'a.wav', to: 'c.wav' }]]) assert.throws(() => validatePlan(input, { ...output, renames }, specification.permissions));
});
test('J6 refusal and missing confirmation never call generation; installation requires MIRROR success', async () => {
  let calls = 0; const f = fixture(fakeRuntime, { generate: async arg => { calls++; return provider.generate(arg); } });
  try { const request = f.engine.create(specification, { kind: 'USER', ref: null, reason: 'Test' }); await assert.rejects(f.engine.generate(request.id, false), /Confirmation/); assert.throws(() => f.engine.install(request.id, true), /MIRROR/); f.engine.reject(request.id, true); await assert.rejects(f.engine.generate(request.id, true)); assert.equal(calls, 0); } finally { f.dispose(); }
});
test('J6 genuine lifecycle gates source hashes, persists installed versions and removes active availability', async () => {
  const f = fixture(); try {
    const request = f.engine.create(specification, { kind: 'ECHO', ref: 'controlled-origin', reason: 'Habitude de recette' }); assert.equal((await f.engine.generate(request.id, true)).ok, true); assert.equal(f.engine.snapshot().requests[0]!.status, 'READY');
    assert.throws(() => f.engine.install(request.id, false)); f.engine.install(request.id, true);
    const restored = new ForgeEngine(new EvolutionStore(f.folder), provider, new Mirror(fakeRuntime)); assert.equal(restored.capability('test-files').manifest.provenance.origin.kind, 'ECHO');
    assert.deepEqual(await restored.run('test-files', input), output); restored.lifecycle('disable', 'test-files', true); assert.throws(() => restored.capability('test-files')); restored.lifecycle('enable', 'test-files', true);
    const artifact = join(f.store.installed('test-files', '1.0.0'), 'capability.js'); writeFileSync(artifact, source + '// tampered'); await assert.rejects(restored.run('test-files', input), /modifié/);
    restored.lifecycle('remove', 'test-files', true); assert.throws(() => restored.capability('test-files')); assert(existsSync(artifact));
  } finally { f.dispose(); }
});
test('J6 generation errors, compile failures and failed tests remain visible without installation', async () => {
  for (const scenario of ['generation', 'compile', 'test']) { const runtime: CapabilityRuntime = { evaluate: async (_s, _i, _a, compile) => { if (scenario === 'compile') throw new Error('syntax error'); return compile ? null : { ...output, summary: 'wrong' }; } }; const f = fixture(runtime, scenario === 'generation' ? { generate: async () => { throw new Error('Provider unavailable'); } } : provider);
    try { const request = f.engine.create(specification, { kind: 'USER', ref: null, reason: 'Test' }); assert.equal((await f.engine.generate(request.id, true)).ok, false); assert.equal(f.engine.snapshot().requests[0]!.status, 'FAILED'); assert.equal(f.engine.snapshot().capabilities.length, 0); assert.throws(() => f.engine.install(request.id, true)); } finally { f.dispose(); }
  }
});
test('J6 cancellation discards late generated output and records the interrupted attempt', async () => {
  let complete!: (value: Awaited<ReturnType<CodeGenerationProvider['generate']>>) => void;
  const f = fixture(fakeRuntime, { generate: () => new Promise(resolve => { complete = resolve; }) });
  try { const r = f.engine.create(specification, { kind: 'CURIOSITY', ref: 'interest', reason: 'Test' }); const pending = f.engine.generate(r.id, true); f.engine.stop(); complete(await provider.generate({} as never)); assert.equal((await pending).ok, false); assert.equal(f.engine.snapshot().requests[0]!.status, 'CANCELLED'); assert.equal(f.engine.snapshot().capabilities.length, 0); } finally { f.dispose(); }
});

test('J6 a reviewed prototype can be regenerated explicitly, preserving specification and attempt history without installation', async()=>{
  const f=fixture();try{const r=f.engine.create(specification,{kind:'USER',ref:null,reason:'Test'});await f.engine.generate(r.id,true);await assert.rejects(f.engine.generate(r.id,false),/Confirmation/);assert.equal((await f.engine.generate(r.id,true)).ok,true);const current=f.store.request(r.id);assert.equal(current.attempts.length,2);assert.equal(current.attempts[0]!.status,'READY');assert.deepEqual(current.specification,specification);assert.equal(current.manifest!.provenance.attempt,2);assert.equal(f.engine.registry.list().length,0);}finally{f.dispose();}
});
test('J6 version model retains previous artifact and supports rollback without deleting user files', async () => {
  let version = '1.0.0'; const f = fixture(fakeRuntime, { generate: async arg => ({ ...await provider.generate(arg), version }) });
  try { for (version of ['1.0.0', '1.1.0']) { const r = f.engine.create(specification, { kind: 'USER', ref: null, reason: 'Test' }); await f.engine.generate(r.id, true); f.engine.install(r.id, true); } assert.equal(f.engine.capability('test-files').previousVersion, '1.0.0'); f.engine.lifecycle('rollback', 'test-files', true); assert.equal(f.engine.capability('test-files').manifest.version, '1.0.0'); } finally { f.dispose(); }
});
test('J6 tampered prototypes cannot be installed and interrupted work recovers without a ready capability',async()=>{
  const f=fixture();try{const r=f.engine.create(specification,{kind:'USER',ref:null,reason:'Test'});await f.engine.generate(r.id,true);writeFileSync(join(f.store.artifact(r.id,1),'capability.js'),source+'// changed');assert.throws(()=>f.engine.install(r.id,true),/modifié/);assert.equal(f.engine.registry.list().length,0);const request=f.store.request(r.id);request.status='TESTING';request.attempts[0]!.status='TESTING';request.attempts[0]!.endedAt=null;f.store.save();const recovered=new EvolutionStore(f.folder).request(r.id);assert.equal(recovered.status,'CANCELLED');assert.equal(recovered.attempts[0]!.status,'CANCELLED');}finally{f.dispose();}
});
test('J6 file broker really tests on copies, requires a second confirmation and rejects stale previews', async () => {
  const testRoot=resolve('.aether-test-data');mkdirSync(testRoot,{recursive:true});const root = mkdtempSync(join(testRoot, 'aether-broker-')), folder = join(root, 'files'), data = join(root, 'data'); mkdirSync(folder); writeFileSync(join(folder, 'a.wav'), 'abc'); const broker = new FileBroker(data, []);
  try { const preview = await broker.preview('test-files', '1.0.0', folder, {}, async () => output, specification.permissions); assert.equal(readFileSync(join(folder, 'a.wav'), 'utf8'), 'abc'); assert.equal(readFileSync(join(data, preview.id, 'copies', 'audio', 'a.wav'), 'utf8'), 'abc'); await assert.rejects(broker.apply(preview.id, false, () => true)); writeFileSync(join(folder, 'a.wav'), 'changed'); await assert.rejects(broker.apply(preview.id, true, () => true), /changé/);
    const current = await broker.preview('test-files', '1.0.0', folder, {}, async () => output, specification.permissions); await broker.apply(current.id, true, () => true); assert.equal(existsSync(join(folder, 'a.wav')), false); assert.equal(readFileSync(join(folder, 'audio', 'a.wav'), 'utf8'), 'changed'); await assert.rejects(broker.apply(current.id, true, () => true));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('J6 file emergency stop invalidates a pending write without changing originals',async()=>{
  const testRoot=resolve('.aether-test-data');mkdirSync(testRoot,{recursive:true});const root=mkdtempSync(join(testRoot,'broker-stop-')),folder=join(root,'files');mkdirSync(folder);writeFileSync(join(folder,'a.wav'),'abc');const broker=new FileBroker(join(root,'copies'),[]);
  try{const p=await broker.preview('test-files','1.0.0',folder,{},async()=>output,specification.permissions);const pending=broker.apply(p.id,true,()=>true);broker.invalidate();await assert.rejects(pending,/arrêtée/);assert.equal(readFileSync(join(folder,'a.wav'),'utf8'),'abc');assert.equal(existsSync(join(folder,'audio','a.wav')),false);}finally{rmSync(root,{recursive:true,force:true});}
});
test('J6 ECHO and CURIOSITY retain actual source identifiers and cannot start generation through a proposal',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'evolution-sources-'));let calls=0;
  const mind={router:{complete:async()=>{calls++;return {text:JSON.stringify({questions:[],specification})};}}} as unknown as import('../../apps/desktop/main/mind-service').DesktopMindService;
  const echo={opportunities:[{id:'opportunity',habitId:'habit',description:'Repeated controlled test habit'}],habits:[{id:'habit',state:'confirmed',occurrences:2,name:'Test habit',description:'Controlled test',procedure:[],provenance:{sessionIds:['session-one','session-two']}}]} as unknown as import('@aether/shared').EchoSnapshot;
  const curiosity={interests:[{id:'interest'}]} as unknown as import('@aether/shared').CuriositySnapshot;
  try{const service=new DesktopEvolutionService(folder,mind,{echo:()=>echo,curiosity:()=>curiosity},[]);await assert.rejects(service.prepare('Build',{kind:'ECHO',ref:'unknown'}));assert.equal(calls,0);const request=await service.prepare('Explicitly prepare this habit',{kind:'ECHO',ref:'opportunity'});assert.equal(request.origin.ref,'opportunity');assert.equal(request.origin.kind,'ECHO');assert.equal(request.status,'DRAFT');assert.equal(request.attempts.length,0);
    service.engine.store.proposals().push({id:'proposal',interestId:'interest',title:'Test proposal',description:'Controlled experiment',status:'PROPOSED',createdAt:new Date().toISOString(),forgeRequestId:null});service.engine.store.save();const proposed=await service.prepare('Accept and specify',{kind:'CURIOSITY',ref:'proposal'});assert.equal(proposed.origin.ref,'proposal');assert.equal(proposed.status,'DRAFT');assert.equal(service.engine.store.proposals()[0]!.forgeRequestId,proposed.id);await assert.rejects(service.engine.generate(proposed.id,false));assert.equal(service.engine.snapshot().capabilities.length,0);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('J6 native MXC/QuickJS really executes code, denies host APIs and interrupts loops', { timeout: 120000 }, async () => {
  const folder = mkdtempSync(join(tmpdir(), 'aether-mxc-')), runtime = new WindowsCapabilityRuntime(folder, resolve('dist/main/capability-worker.cjs')), signal = new AbortController().signal;
  try { assert.deepEqual(await runtime.evaluate(source, input, signal), output);
    for (const expression of ['process.env', 'require("node:fs").readFileSync("C:/Windows/win.ini")', 'fetch("https://example.com")', 'globalThis.constructor.constructor("return process")()']) await assert.rejects(runtime.evaluate(`exports.run=()=>${expression};`, input, signal));
    await assert.rejects(runtime.evaluate('exports.run=()=>{while(true){}}', input, signal), /interrupt|Timeout/);
    await assert.rejects(runtime.evaluate('exports.run=(', input, signal), /Compilation/);
    const controller = new AbortController(); const running = runtime.evaluate('exports.run=()=>{while(true){}}', input, controller.signal); setTimeout(() => controller.abort(), 100); await assert.rejects(running, /arrêté/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
