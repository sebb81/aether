import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CuriosityEngine,CuriosityRepository,isBlocked,parseCuriositySettings,parseExplorationResult,selectExploration,type ExplorationResult } from '@aether/curiosity';
import { SqliteMemoryRepository } from '@aether/memory';
import { DEFAULT_PREFERENCES,PresenceModel } from '@aether/core';
import type { ModelRouterPort,RoutedCompletion } from '@aether/shared';

function result(decision:ExplorationResult['decision']='birth',question='Comment comparer des motifs temporels ?'):ExplorationResult {return {decision,why:'Cette piste permet de comparer des structures nouvelles.',question,hypothesis:'Une structure peut produire des motifs répétables.',confidence:.6,discovery:'Une relation conceptuelle entre périodicité et motifs.',limits:'Réflexion locale sans expérience.',nextQuestion:'Comment mesurer la diversité de ces motifs ?',newInterest:decision==='birth'?{title:'Structures temporelles',description:'Étudier des motifs répétables dans des structures.',originKey:null}:null,connection:decision==='connect'?'Une relation nouvelle entre structures et acoustique.':null,levelDelta:.1};}
function router(output:()=>ExplorationResult):ModelRouterPort {return {complete:async(profile,request,options)=>{assert.equal(profile,'DEEP');assert.equal(options?.localOnly,true);assert.equal(request.responseFormat,'json');return {text:JSON.stringify(output()),model:'unit-test-only',route:{requested:profile,selected:'DEEP',provider:'ollama',model:'unit-test-only',fallback:false}};}};}
const settings={enabled:true,maxExplorations:5,maxDurationSeconds:120,minIntervalSeconds:1};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('v1 SQLite migration preserves existing memories and adds durable curiosity objects/history',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'aether-migrate-'));const file=join(folder,'memory.sqlite');
  let engine:CuriosityEngine|undefined;
  try {
    const db=new DatabaseSync(file);const id=randomUUID(),now=new Date().toISOString();
    db.exec("CREATE TABLE memories(id TEXT PRIMARY KEY,content TEXT NOT NULL,category TEXT NOT NULL,origin TEXT NOT NULL,confidence REAL,source TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE VIRTUAL TABLE memory_search USING fts5(id UNINDEXED,content,tokenize='unicode61 remove_diacritics 2');PRAGMA user_version=1;");
    db.prepare('INSERT INTO memories VALUES(?,?,?,?,?,?,?,?)').run(id,'Un souvenir J2 conservé.','knowledge','explicit',null,'user',now,now);db.prepare('INSERT INTO memory_search VALUES(?,?)').run(id,'Un souvenir J2 conservé.');db.close();
    const memories=new SqliteMemoryRepository(file);assert.equal((await memories.list())[0]!.id,id);memories.close();
    engine=new CuriosityEngine(new CuriosityRepository(file),router(()=>result()));engine.configure({...settings,maxExplorations:1});assert.equal((await engine.explore()).ok,true);
    const before=engine.snapshot();engine.close();engine=undefined;
    const reopened=new CuriosityRepository(file);const after=reopened.journal();assert.deepEqual(after.interests,before.interests);assert.deepEqual(after.items,before.items);assert.deepEqual(after.history,before.history);assert.equal(reopened.settings().enabled,true);reopened.close();
    const preserved=new SqliteMemoryRepository(file);assert.equal((await preserved.list())[0]!.content,'Un souvenir J2 conservé.');preserved.close();
  }finally{engine?.close();await rm(folder,{recursive:true,force:true});}
});
test('continuity creates a different question on the same interest, then persists a genuine connection',async()=>{
  let clock=Date.now(),step=0;const repo=new CuriosityRepository(':memory:');
  const engine=new CuriosityEngine(repo,router(()=>result(step===0?'birth':step===1?'deepen':'connect',`Question spécifique numéro ${step++} ?`)),async()=>[],()=>false,()=>clock);
  try{engine.configure(settings);await engine.explore();const initial=engine.snapshot().interests[0]!;clock+=1001;await engine.explore();
    assert.equal(engine.snapshot().interests.length,1);assert.equal(engine.snapshot().items.filter(item=>item.kind==='question'&&item.interestId===initial.id).length,2);assert.equal(engine.snapshot().interests[0]!.level,.65);
    const second=repo.writeInterest({title:'Acoustique granulaire',description:'Explorer des sons discrets.',level:.5,status:'active'});clock+=1001;assert.equal((await engine.explore()).ok,true);
    const edge=engine.snapshot().connections[0]!;assert.deepEqual(new Set([edge.fromId,edge.toId]),new Set([initial.id,second.id]));assert.equal(selectExploration(engine.snapshot()).action,'deepen');
  }finally{engine.close();}
});
test('selection excludes blocked/abandoned tracks and allows dormant interests to be reactivated',()=>{
  const repo=new CuriosityRepository(':memory:');try{const track=repo.writeInterest({title:'Robotique douce',description:'Une piste de matériaux.',level:.7,status:'dormant'});
    assert.equal(selectExploration(repo.journal()).action,'reactivate');repo.writeInterest({status:'abandoned',id:track.id,title:track.title,description:track.description,level:track.level});
    assert.equal(selectExploration(repo.journal()).action,'birth');repo.writeInterest({id:track.id,title:track.title,description:track.description,level:.2,status:'active'});repo.setBlocked('ROBOTIQUE',true);assert.equal(selectExploration(repo.journal()).action,'birth');assert.equal(isBlocked('Róbótique douce',['robotique']),true);
  }finally{repo.close();}
});
test('count and interval budgets cannot be bypassed by manual exploration or off/on toggles',async()=>{
  let clock=Date.now();const engine=new CuriosityEngine(new CuriosityRepository(':memory:'),router(()=>result()),async()=>[],()=>false,()=>clock);
  try{engine.configure({...settings,maxExplorations:1});await engine.explore();assert.equal(engine.snapshot().state,'budget-exhausted');assert.equal((await engine.explore()).ok,false);engine.configure({...settings,maxExplorations:1,enabled:false});engine.configure({...settings,maxExplorations:1});clock+=10000;assert.equal((await engine.explore()).ok,false);assert.equal(engine.snapshot().explorations.length,1);
  }finally{engine.close();}
  clock=Date.now();const second=new CuriosityEngine(new CuriosityRepository(':memory:'),router(()=>result()),async()=>[],()=>false,()=>clock);
  try{second.configure(settings);await second.explore();assert.match((await second.explore() as {error:string}).error,/intervalle/);assert.equal(second.snapshot().sessionAttempts,1);}finally{second.close();}
});
test('disabled mode creates no exploration; disable cancels in-flight work and discards late output',async()=>{
  let release!:(value:RoutedCompletion)=>void,signal:AbortSignal|undefined;
  const engine=new CuriosityEngine(new CuriosityRepository(':memory:'),{complete:async(_profile,request)=>{signal=request.signal;return new Promise(resolve=>{release=resolve;});}});
  try{assert.equal((await engine.explore()).ok,false);assert.equal(engine.snapshot().explorations.length,0);engine.configure(settings);const pending=engine.explore();await turn();assert.equal(engine.snapshot().state,'exploring');engine.configure({...settings,enabled:false});assert.equal(signal?.aborted,true);
    release({text:JSON.stringify(result()),model:'late',route:{requested:'DEEP',selected:'DEEP',model:'late',provider:'ollama',fallback:false}});assert.equal((await pending).ok,false);assert.equal(engine.snapshot().interests.length,0);assert.equal(engine.snapshot().explorations[0]!.status,'cancelled');assert.equal(engine.snapshot().state,'disabled');assert.equal((await engine.explore()).ok,false);assert.equal(engine.snapshot().explorations.length,1);
  }finally{engine.close();}
});
test('duration budget actually aborts a pending model call',async()=>{
  const engine=new CuriosityEngine(new CuriosityRepository(':memory:'),{complete:async(_profile,request)=>new Promise((_resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}))});
  try{engine.configure({...settings,maxDurationSeconds:1});const response=await engine.explore();assert.equal(response.ok,false);assert.match(engine.snapshot().error!,/Durée maximale/);assert.equal(engine.snapshot().state,'budget-exhausted');assert.equal(engine.snapshot().explorations[0]!.status,'cancelled');}finally{engine.close();}
});
test('domain exclusion discards forbidden output without storing its contents',async()=>{
  const repo=new CuriosityRepository(':memory:');repo.setBlocked('robotique',true);
  const engine=new CuriosityEngine(repo,router(()=>({...result(),discovery:'Une exploration de robotique interdite.'})));
  try{engine.configure(settings);assert.equal((await engine.explore()).ok,false);assert.equal(engine.snapshot().interests.length,0);assert.equal(engine.snapshot().items.length,0);assert.equal(engine.snapshot().explorations[0]!.status,'suppressed');assert.equal(JSON.stringify(engine.snapshot().explorations).includes('robotique'),false);}finally{engine.close();}
});
test('removing an interest purges linked questions, discoveries, connections and exploration provenance',async()=>{
  let clock=Date.now(),step=0;const repo=new CuriosityRepository(':memory:');const memoryId=randomUUID();
  const engine=new CuriosityEngine(repo,router(()=>{const value=result(step===0?'birth':'deepen',`Question distincte ${step++} ?`);value.newInterest={title:step===1?'Structures temporelles':'Structures enfant',description:'Piste issue de la précédente.',originKey:step===1?'memory-seed':null};return value;}),async()=>[{key:'memory-seed',kind:'memory',ref:memoryId,content:'Une information locale.'}],()=>false,()=>clock);
  try{engine.configure(settings);assert.equal((await engine.explore()).ok,true);clock+=1001;assert.equal((await engine.explore()).ok,true);assert.equal(engine.snapshot().interests.length,2);engine.cancel();repo.removeMemoryOrigins(memoryId);assert.equal(repo.journal().interests.length,0);assert.equal(repo.journal().items.length,0);assert.equal(repo.journal().explorations.length,0);assert.equal(repo.journal().history.length,0);}finally{engine.close();}
});
test('pending exploration cannot restore a deleted interest after cancellation',async()=>{
  const repo=new CuriosityRepository(':memory:');const track=repo.writeInterest({title:'Piste supprimable',description:'Une piste de test.',level:.5,status:'active'});let release!:(value:RoutedCompletion)=>void;
  const engine=new CuriosityEngine(repo,{complete:async()=>new Promise(resolve=>{release=resolve;})});
  try{engine.configure(settings);const pending=engine.explore();await turn();engine.cancel();repo.remove('interest',track.id);release({text:JSON.stringify(result('deepen')),model:'late',route:{requested:'DEEP',selected:'DEEP',model:'late',provider:'ollama',fallback:false}});await pending;assert.equal(repo.journal().interests.length,0);assert.equal(repo.journal().explorations.length,0);}finally{engine.close();}
});
test('interrupted attempts recover as interrupted and model JSON must be complete and valid',()=>{
  const repo=new CuriosityRepository(':memory:');repo.begin('birth',[],'tentative');const engine=new CuriosityEngine(repo,router(()=>result()));
  try{assert.equal(engine.snapshot().explorations[0]!.status,'interrupted');assert.throws(()=>parseExplorationResult('not json'),/JSON/);assert.throws(()=>parseExplorationResult(JSON.stringify({...result(),confidence:1.5})),/Confiance/);assert.throws(()=>parseCuriositySettings({...settings,minIntervalSeconds:0}));}finally{engine.close();}
});
test('PRESENCE exploring is available only with CURIOSITY and discovery signals reflect explicit pending state',()=>{
  const old=new PresenceModel(structuredClone(DEFAULT_PREFERENCES),true,true);assert.throws(()=>old.setState('exploring'),/non implémenté/);
  const current=new PresenceModel(structuredClone(DEFAULT_PREFERENCES),true,true,true);current.setState('exploring');assert.equal(current.snapshot().state,'exploring');current.setDiscoveryPending(true);assert.equal(current.snapshot().discoveryPending,true);assert.equal(current.snapshot().features.curiosity,'available');current.setDiscoveryPending(false);assert.equal(current.snapshot().discoveryPending,false);
});

test('interest priority can decrease and dormant/reactivated/abandoned decisions remain in history',async()=>{
  let clock=Date.now(),step=0;
  const repo=new CuriosityRepository(':memory:');const track=repo.writeInterest({title:'Piste évolutive',description:'Comprendre une structure.',level:.7,status:'active'});
  const decisions=['dormant','reactivate','abandon'] as const;
  const engine=new CuriosityEngine(repo,router(()=>({...result(decisions[step],`Nouvelle question ${step++} ?`),levelDelta:-.1})),async()=>[],()=>false,()=>clock);
  try {
    engine.configure(settings);
    for(const status of ['dormant','active','abandoned'] as const) {assert.equal((await engine.explore()).ok,true);assert.equal(repo.journal().interests[0]!.status,status);clock+=1001;}
    assert.equal(repo.journal().interests[0]!.level,.4);assert.deepEqual(repo.journal().history.filter(item=>item.interestId===track.id).map(item=>item.action).sort(),['abandon','birth','dormant','reactivate']);
    assert.equal(selectExploration(repo.journal()).action,'birth');
  }finally{engine.close();}
});

test('human activity postpones autonomous work without consuming any exploration budget',async()=>{
  const engine=new CuriosityEngine(new CuriosityRepository(':memory:'),router(()=>{throw new Error('provider must not run');}),async()=>[],()=>true);
  try{engine.configure(settings);assert.equal((await engine.explore()).ok,false);assert.equal(engine.snapshot().sessionAttempts,0);assert.equal(engine.snapshot().explorations.length,0);}finally{engine.close();}
});

test('individual questions, discoveries and explorations can be deleted without leaving linked items',async()=>{
  let clock=Date.now(),step=0;const repo=new CuriosityRepository(':memory:');
  const engine=new CuriosityEngine(repo,router(()=>result(step===0?'birth':'deepen',`Question de suppression ${step++} ?`)),async()=>[],()=>false,()=>clock);
  try{
    engine.configure(settings);assert.equal((await engine.explore()).ok,true);clock+=1001;assert.equal((await engine.explore()).ok,true);
    engine.cancel();const question=repo.journal().items.find(item=>item.kind==='question')!,discovery=repo.journal().items.find(item=>item.kind==='discovery')!;
    repo.remove('question',question.id);assert.equal(repo.journal().items.some(item=>item.id===question.id),false);
    repo.remove('discovery',discovery.id);assert.equal(repo.journal().items.some(item=>item.id===discovery.id),false);
    const attempt=repo.journal().explorations[0]!;repo.remove('exploration',attempt.id);assert.equal(repo.journal().explorations.some(item=>item.id===attempt.id),false);assert.equal(repo.journal().items.some(item=>item.explorationId===attempt.id),false);assert.equal(repo.journal().interests.length,1);
    assert.throws(()=>repo.remove('discovery',randomUUID()),/n’existe plus/);
  }finally{engine.close();}
});
