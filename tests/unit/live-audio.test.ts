import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_VOICE_SETTINGS } from '@aether/voice';
import { PortAudioLiveDuplex } from '../../apps/desktop/main/live-audio';

const python='C:\\ProgramData\\anaconda3\\python.exe';
const delay=(ms:number)=>new Promise<void>(ok=>setTimeout(ok,ms));
function pcm(rate:number,seconds:number){const value=Buffer.alloc(Math.floor(rate*seconds)*2);for(let i=0;i<value.length/2;i++)value.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*330/rate)*2000),i*2);return value;}
function wav(samples:Buffer){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+samples.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(16000,24);h.writeUInt32LE(32000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(samples.length,40);return Buffer.concat([h,samples]);}
test('LIVE actual Python/PortAudio duplex: fixture capture, PCM output, queue interruption and shutdown without opening a microphone',{skip:process.platform!=='win32'||!existsSync(python),timeout:15000},async()=>{
  const folder=await mkdtemp(join(tmpdir(),'aether-live-native-audio-')),audio=new PortAudioLiveDuplex(()=>({...DEFAULT_VOICE_SETTINGS,pythonPath:python,volume:0}),folder,resolve('apps/desktop/main/live-audio-worker.py')),controller=new AbortController();
  const frames:Uint8Array[]=[],output:boolean[]=[],failures:string[]=[];let speech=false;
  try{
    await writeFile(join(folder,'001.wav'),wav(pcm(16000,.4)));
    await audio.start((frame,_level,detected)=>{frames.push(frame);speech ||= detected;},playing=>output.push(playing),message=>failures.push(message),controller.signal);
    assert.equal(audio.source,'test-fixture');audio.play(pcm(24000,2),24000);
    for(let i=0;i<100&&(!output.includes(true)||!speech);i++)await delay(20);
    assert(output.includes(true),'The actual native output callback must have received PCM.');assert(speech,'The real capture path must detect fixture speech energy.');assert(frames.every(frame=>frame.length<=3200&&frame.length%2===0));
    audio.interrupt();for(let i=0;i<50&&output.at(-1)!==false;i++)await delay(10);assert.equal(output.at(-1),false);assert.deepEqual(failures,[]);
    controller.abort();const count=frames.length;await delay(100);assert.equal(frames.length,count);
  }finally{audio.close();await rm(folder,{recursive:true,force:true});}
});
