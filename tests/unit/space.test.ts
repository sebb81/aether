import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {PortalLifecycle,DEFAULT_SPACE_PREFERENCES,parseSpaceView,parseSpacePreferences,parsePortalSettings,pan,zoomAt,activityEntries,existingSelection,interestNodes,availableCapabilities} from '@aether/space';
import {SpacePreferencesStore,PortalSettingsStore} from '../../apps/desktop/main/space-storage';
import {PresenceModel,DEFAULT_PREFERENCES} from '@aether/core';
import type {CuriositySnapshot,SpaceData} from '@aether/shared';

const journal=JSON.parse(readFileSync('docs/recette-j4/source-j3.json','utf8')).snapshot as CuriositySnapshot;
const presence=new PresenceModel(structuredClone(DEFAULT_PREFERENCES),true,true,true,true).snapshot();
const data:SpaceData={memories:[],curiosity:journal,mind:null,presence};
test('PORTAL reversals ignore stale animation completions and preserve the desktop origin',()=>{
  const portal=new PortalLifecycle(),origin={x:100,y:600},viewport={x:0,y:0,width:1600,height:900};
  assert.equal(portal.open(origin,viewport,false),true);const opening=portal.snapshot();
  assert.equal(portal.open(origin,viewport,false),false);portal.close();const closing=portal.snapshot();
  assert.equal(portal.settle(opening.token),false);assert.equal(portal.snapshot().phase,'closing');
  portal.open(origin,viewport,false);assert.equal(portal.settle(closing.token),false);
  portal.settle(portal.snapshot().token);assert.equal(portal.snapshot().phase,'open');
  portal.close();portal.settle(portal.snapshot().token);assert.equal(portal.snapshot().phase,'closed');assert.deepEqual(portal.snapshot().origin,origin);
  origin.x=500;assert.equal(portal.snapshot().origin.x,100);
});
test('PORTAL reduced motion uses a short transition, and invalid geometry is rejected',()=>{
  const portal=new PortalLifecycle();assert.throws(()=>portal.open({x:NaN,y:0},{x:0,y:0,width:100,height:100},false));
  portal.open({x:80,y:80},{x:0,y:0,width:1200,height:800},true);assert.equal(portal.snapshot().durationMs,90);
  portal.close();assert.equal(portal.snapshot().durationMs,90);portal.reset();assert.equal(portal.snapshot().phase,'closed');
});
test('zoom preserves the world point under the cursor and navigation clamps its range',()=>{
  const camera={x:100,y:-200,zoom:.8},point={x:280,y:300},next=zoomAt(camera,1.5,point);
  assert.equal((point.x-next.x)/next.zoom,(point.x-camera.x)/camera.zoom);
  assert.equal((point.y-next.y)/next.zoom,(point.y-camera.y)/camera.zoom);
  assert.equal(zoomAt(camera,100,point).zoom,2.4);assert.equal(zoomAt(camera,.001,point).zoom,.4);
  assert.deepEqual(pan(camera,{x:9000,y:-9000}),{x:6000,y:-6000,zoom:.8});
});
test('persisted SPACE view rejects nonfinite positions, foreign fields and executable selections',()=>{
  const {schemaVersion,lastVisitedAt,...view}=DEFAULT_SPACE_PREFERENCES;assert.deepEqual(parseSpaceView(view),view);
  for(const value of [{...view,camera:{x:Infinity,y:0,zoom:1}},{...view,camera:{x:0,y:0,zoom:10}},{...view,script:'alert(1)'},{...view,selection:{kind:'url',id:'https://example.com'}}])assert.throws(()=>parseSpaceView(value));
  assert.throws(()=>parseSpacePreferences({...DEFAULT_SPACE_PREFERENCES,lastVisitedAt:'never'}));assert.throws(()=>parsePortalSettings({shortcut:'A'}));
});
test('camera and shortcut persist independently; corrupt navigation is preserved without changing data',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'aether-space-store-'));
  try{const store=new SpacePreferencesStore(join(folder,'space.json')),portal=new PortalSettingsStore(join(folder,'portal.json'));
    const value={...DEFAULT_SPACE_PREFERENCES,camera:{x:110,y:-90,zoom:1.25},lastVisitedAt:new Date().toISOString()};store.save(value);portal.save({shortcut:'Control+Alt+F9'});
    assert.deepEqual(new SpacePreferencesStore(store.path).load(),value);assert.equal(portal.load().shortcut,'Control+Alt+F9');
    await writeFile(store.path,'invalid navigation');assert.deepEqual(store.load(),DEFAULT_SPACE_PREFERENCES);assert.match(store.notice!,/préservée/);assert.equal((await readdir(folder)).some(name=>name.startsWith('space.json.invalid-')),true);assert.equal(portal.load().shortcut,'Control+Alt+F9');
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('SPACE projects original J3 UUIDs and removes orphaned selections without inventing objects',()=>{
  const nodes=interestNodes(journal.interests);assert.equal(nodes.length,journal.interests.length);
  assert.deepEqual(new Set(nodes.map(node=>node.interest.id)),new Set(journal.interests.map(item=>item.id)));
  const edge=journal.connections[0]!;assert.ok(existingSelection({kind:'connection',id:edge.id},data));
  assert.equal(existingSelection({kind:'connection',id:edge.id},{...data,curiosity:{...journal,connections:[]}}),null);
  assert.equal(existingSelection({kind:'question',id:journal.interests[0]!.id},data),null);
});
test('ACTIVITY uses persisted result dates and honors previous visits and deletion',()=>{
  const since=journal.explorations[0]!.createdAt,entries=activityEntries(data,since);
  const attempt=journal.explorations[0]!;assert.equal(entries.find(item=>item.id===`exploration:${attempt.id}`)!.at,attempt.completedAt);
  assert.equal(activityEntries(data,'2099-01-01T00:00:00.000Z').some(item=>item.fresh),false);
  assert.equal(activityEntries({...data,curiosity:{...journal,explorations:[]}},null).some(item=>item.kind==='Exploration'),false);
  assert.equal(entries.some(item=>item.transient),false);
});
test('500 persisted interests have stable finite positions, and PORTAL adds no permissions',()=>{
  const many=Array.from({length:500},(_,index)=>({...journal.interests[0]!,id:String(index).padStart(36,'0')}));
  const start=performance.now(),nodes=interestNodes(many);assert.equal(nodes.length,500);assert.ok(nodes.every(node=>Number.isFinite(node.position.x)&&Number.isFinite(node.position.y)));assert.ok(performance.now()-start<1000);
  assert.equal(new Set(nodes.map(node=>`${node.position.x}:${node.position.y}`)).size,500);
  assert.equal(availableCapabilities(data).every(item=>item.available),true);assert.equal(Object.values(presence.permissions).every(value=>value===false),true);
  assert.equal(new PresenceModel(structuredClone(DEFAULT_PREFERENCES)).snapshot().features.portal,'not-implemented');
});
