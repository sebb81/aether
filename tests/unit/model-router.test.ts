import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRouter,parseRouterOverrides } from '@aether/mind';
import type { ModelTarget,RouterConfiguration } from '@aether/shared';

function setup(configuration:RouterConfiguration) {
  const selected:ModelTarget[]=[];
  const router=new ModelRouter(()=>configuration,async target=>{selected.push(target);return {id:target.provider,complete:async()=>({text:'test only',model:target.model})};});
  return {router,selected};
}
const config:RouterConfiguration={FAST:{provider:'ollama',model:'fast-test'},DEEP:{provider:'ollama',model:'deep-test'},VISION:null,cloudConsent:false};
const request={messages:[{role:'user' as const,content:'test'}],signal:new AbortController().signal};
test('MODEL ROUTER selects FAST and DEEP explicitly and records the route',async()=>{
  const {router,selected}=setup(structuredClone(config));
  const fast=await router.complete('FAST',request),deep=await router.complete('DEEP',request,{localOnly:true});
  assert.equal(fast.model,'fast-test');assert.equal(fast.route.selected,'FAST');assert.equal(deep.model,'deep-test');assert.equal(deep.route.fallback,false);
  assert.deepEqual(selected,[config.FAST,config.DEEP]);
});
test('DEEP falls back to FAST only when no DEEP target is configured; missing providers are explicit',async()=>{
  const configuration={...config,DEEP:null};const {router}=setup(configuration);
  const response=await router.complete('DEEP',request);assert.equal(response.model,'fast-test');assert.equal(response.route.fallback,true);
  configuration.FAST=null;await assert.rejects(router.complete('DEEP',request),/Aucune IA/);
});
test('router rejects unauthorized cloud before constructing a provider, including DEEP fallback',async()=>{
  for(const configuration of [{...config,FAST:{provider:'openai' as const,model:'cloud'},DEEP:null},{...config,DEEP:{provider:'openai' as const,model:'cloud'}}]) {
    const {router,selected}=setup(configuration);await assert.rejects(router.complete('DEEP',request),/n’est pas autorisé/);assert.equal(selected.length,0);
  }
});
test('local-only CURIOSITY never uses even a consented cloud target, and VISION remains inert',async()=>{
  const {router,selected}=setup({...config,DEEP:{provider:'openai',model:'cloud'},cloudConsent:true});
  await assert.rejects(router.complete('DEEP',request,{localOnly:true}),/profil local/);assert.equal(selected.length,0);
  await assert.rejects(router.complete('VISION',request),/réservé/);assert.equal(selected.length,0);
});
test('profile settings reject arbitrary fields, executable model strings and unsupported providers',()=>{
  assert.deepEqual(parseRouterOverrides({DEEP:config.DEEP,VISION:null}),{DEEP:config.DEEP,VISION:null});
  for(const payload of [{DEEP:{provider:'ollama',model:'x; execute'},VISION:null},{DEEP:{provider:'shell',model:'x'},VISION:null},{DEEP:null,VISION:null,cloudConsent:true}])assert.throws(()=>parseRouterOverrides(payload));
});
