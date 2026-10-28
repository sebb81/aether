import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GoogleGenAI, LiveConnectParameters, Session } from '@google/genai';
import { GeminiLiveProvider } from '../../apps/desktop/main/gemini-live-provider';
import { DEFAULT_LIVE_SETTINGS, LIVE_TOOLS } from '@aether/live';
import type { LiveProviderEvent } from '@aether/shared';

function mockSdk() {
  let request:LiveConnectParameters|undefined;
  const sent:unknown[]=[],events:LiveProviderEvent[]=[];let closes=0;
  const session={sendRealtimeInput:(v:unknown)=>sent.push(v),sendToolResponse:(v:unknown)=>sent.push(v),close:()=>{closes++;}} as unknown as Session;
  const provider=new GeminiLiveProvider(()=> 'test-key-never-real',()=>({live:{connect:async(input:LiveConnectParameters)=>{request=input;return session;}}} as unknown as Pick<GoogleGenAI,'live'>));
  return {provider,events,sent,session,request:()=>request!,closed:()=>closes,emit:(value:unknown)=>request!.callbacks!.onmessage!(value as Parameters<NonNullable<NonNullable<LiveConnectParameters['callbacks']>['onmessage']>>[0])};
}
const input={settings:{...DEFAULT_LIVE_SETTINGS},instructions:'test identity',tools:LIVE_TOOLS};
test('Gemini adapter configures native audio, both transcripts, closed function declarations and VAD',async()=>{
  const s=mockSdk();await s.provider.open(input,event=>s.events.push(event),new AbortController().signal);const request=s.request();assert.equal(request.model,DEFAULT_LIVE_SETTINGS.model);assert.deepEqual(request.config?.responseModalities,['AUDIO']);assert.deepEqual(request.config?.inputAudioTranscription,{});assert.deepEqual(request.config?.outputAudioTranscription,{});assert.deepEqual(request.config?.realtimeInputConfig?.automaticActivityDetection,{disabled:false});assert.equal(JSON.stringify(request).includes('test-key-never-real'),false);
  s.provider.sendAudio(new Uint8Array([1,2,3,4]));assert.deepEqual(s.sent[0],{audio:{data:'AQIDBA==',mimeType:'audio/pcm;rate=16000'}});s.provider.sendToolResult({id:'real-id',name:'get_entity_status',args:{}},{status:'ok',state:'idle'});assert.deepEqual(s.sent[1],{functionResponses:[{id:'real-id',name:'get_entity_status',response:{status:'ok',state:'idle'}}]});s.provider.close();assert.equal(s.closed(),1);
});
test('Gemini adapter processes every content part alongside transcripts, calls and turn completion',async()=>{
  const s=mockSdk();await s.provider.open(input,event=>s.events.push(event),new AbortController().signal);
  s.emit({serverContent:{modelTurn:{parts:[{inlineData:{data:'AQIDBA==',mimeType:'audio/pcm;rate=24000'}},{inlineData:{data:'BQYHCA==',mimeType:'audio/pcm;rate=24000'}}]},inputTranscription:{text:'bonjour',finished:true},outputTranscription:{text:'salut',finished:true},turnComplete:true},toolCall:{functionCalls:[{id:'call',name:'open_space',args:{}}]},toolCallCancellation:{ids:['previous']}});
  assert.deepEqual(s.events.map(e=>e.type),['audio','audio','transcript','transcript','tool-calls','tool-cancelled','turn-complete']);s.provider.close();
});
test('server interruption drops obsolete inline audio and malformed PCM fails safely',async()=>{
  const s=mockSdk();await s.provider.open(input,event=>s.events.push(event),new AbortController().signal);s.emit({serverContent:{interrupted:true,modelTurn:{parts:[{inlineData:{data:'AQIDBA==',mimeType:'audio/pcm;rate=24000'}}]}}});assert.deepEqual(s.events.map(e=>e.type),['interrupted']);s.emit({serverContent:{modelTurn:{parts:[{inlineData:{data:'secret-untrusted',mimeType:'video/mp4'}}]}}});assert.equal(s.events.at(-1)?.type,'error');assert(!JSON.stringify(s.events).includes('secret-untrusted'));s.provider.close();
});
test('adapter refuses missing key and closes a socket that resolves after cancellation',async()=>{
  const noKey=new GeminiLiveProvider(()=>null);await assert.rejects(noKey.open(input,()=>{},new AbortController().signal),/non configuré/);
  let finish:(v:Session)=>void=()=>{},closed=0;const controller=new AbortController();
  const provider=new GeminiLiveProvider(()=> 'unit-key',()=>({live:{connect:()=>new Promise<Session>(ok=>{finish=ok;})}} as unknown as Pick<GoogleGenAI,'live'>));
  const opening=provider.open(input,()=>{},controller.signal);controller.abort();await assert.rejects(opening);finish({close:()=>{closed++;}} as unknown as Session);await new Promise<void>(ok=>setImmediate(ok));assert.equal(closed,1);
});
