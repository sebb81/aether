import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Runs the production audio renderer in Chromium's OfflineAudioContext. Capture
// is inert and all real device permissions and network requests are denied.
let app: ElectronApplication, page: Page, root: string, renderer: string;
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'aether-offline-playback-'));
  renderer = process.env.AETHER_TEST_PLAYBACK_SCRIPT
    ? await readFile(resolve(process.env.AETHER_TEST_PLAYBACK_SCRIPT), 'utf8')
    : (await build({ entryPoints: [resolve('apps/desktop/audio/live-audio.ts')], bundle: true, platform: 'browser', format: 'iife', write: false })).outputFiles[0]!.text;
  const main = join(root, 'main.cjs');
  await writeFile(join(root, 'index.html'), '<!doctype html><meta charset="UTF-8"><title>Offline audio test</title>');
  await writeFile(main, `const {app,BrowserWindow}=require('electron');
    app.setPath('userData',${JSON.stringify(join(root, 'profile'))});
    app.whenReady().then(()=>{const w=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
      w.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
      w.webContents.session.setPermissionCheckHandler(()=>false);
      w.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_d,cb)=>cb({cancel:true}));
      w.loadFile(${JSON.stringify(join(root, 'index.html'))});});`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: [main], env: env as Record<string, string> });
  page = await app.firstWindow();
});
test.afterAll(async () => { await app?.close(); if (root) await rm(root, { recursive: true, force: true }); });

interface Scenario { chunks: number; constant?: boolean; interruptAt?: number; lateAt?: number }
async function startRenderer(mode: 'offline' | 'realtime' = 'offline') {
  await page.goto(pathToFileURL(join(root, 'index.html')).href);
  await page.evaluate(mode => {
    const w = window as unknown as Record<string, any>;
    const NativeAudioContext = window.AudioContext;
    const silent = { gain: { value: 0 }, connect() { return this; } };
    const capture = { sinkId: { type: 'none' }, sampleRate: 16000, audioWorklet: { addModule: async () => {} }, resume: async () => {}, close: async () => {}, createGain: () => silent, createMediaStreamSource: () => silent };
    w.AudioContext = function(options: AudioContextOptions & { sinkId?: object }) {
      if (options?.sinkId) return capture;
      if (mode === 'realtime') {
        w.playbackContext = new NativeAudioContext({ ...options, sinkId: { type: 'none' } } as AudioContextOptions);
        return w.playbackContext;
      }
      const rate = options?.sampleRate ?? 48000;
      const offline = new OfflineAudioContext(1, rate * 2, rate);
      w.offlineResume = offline.resume.bind(offline);
      // start() resumes normal contexts, before any offline render has begun.
      offline.resume = async () => {}; w.offline = offline; return offline;
    };
    w.AudioWorkletNode = function() { return { port: {}, connect: () => silent }; };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [], getAudioTracks: () => [{ getSettings: () => ({ echoCancellation: true }) }] }) } });
    w.audioEvents = [];
    w.liveAudio = { send(value: object) { w.audioEvents.push(value); }, listen(callback: unknown) { w.audioCommand = callback; } };
  }, mode);
  await page.evaluate(code => { (0, eval)(code); }, renderer);
  await page.evaluate(() => (window as any).audioCommand({ command: 'start', volume: 1 }));
  await page.waitForFunction(() => (window as any).audioEvents.some((v: any) => v.type === 'ready'));
}
async function render(scenario: Scenario) {
  await startRenderer();
  return page.evaluate(async input => {
    const w = window as any, offline: OfflineAudioContext = w.offline;
    const pcm = new Int16Array(input.lateAt ? 1200 : 12000);
    for (let i = 0; i < pcm.length; i++) pcm[i] = input.constant ? 19660 : Math.round(Math.sin(i * 2 * Math.PI * 997 / 24000 + .7) * 22000);
    const size = pcm.length / input.chunks;
    for (let i = 0; i < pcm.length; i += size) w.audioCommand({ command: 'play', pcm: new Uint8Array(pcm.slice(i, i + size).buffer) });
    const suspendAt = input.interruptAt ?? input.lateAt;
    let actionAt: number | null = null;
    const suspended = suspendAt === undefined ? null : offline.suspend(suspendAt).then(async () => {
      actionAt = offline.currentTime;
      if (input.interruptAt !== undefined) w.audioCommand({ command: 'interrupt' });
      else w.audioCommand({ command: 'play', pcm: new Uint8Array(pcm.buffer) });
      await w.offlineResume();
    });
    const rendered = await offline.startRendering(); await suspended;
    return { rate: offline.sampleRate, samples: Array.from(rendered.getChannelData(0)), actionAt, events: w.audioEvents, metadata: w.liveAudioMetadata };
  }, scenario);
}

test('LIVE PCM packet boundaries preserve a continuous waveform', async () => {
  const fragmented = await render({ chunks: 10 }), whole = await render({ chunks: 1 });
  let error = 0;
  for (let i = 0; i < fragmented.samples.length; i++) error = Math.max(error, Math.abs(fragmented.samples[i]! - whole.samples[i]!));
  await test.info().attach('waveform-measurement', { body: JSON.stringify({ rate: fragmented.rate, maxPacketizationError: error }), contentType: 'application/json' });
  expect(error, 'Packetization must not introduce independent resampling at each join').toBeLessThan(1 / 32768);
  expect(fragmented.rate).toBe(24000);
  expect(fragmented.events.some((v: any) => v.type === 'error')).toBe(false);
});

test('LIVE interruption fades active audio and discards queued fragments', async () => {
  const result = await render({ chunks: 10, constant: true, interruptAt: .32 });
  let jump = 0;
  for (let i = Math.round(.19 * result.rate); i < Math.round(.5 * result.rate); i++) jump = Math.max(jump, Math.abs(result.samples[i]! - result.samples[i - 1]!));
  await test.info().attach('interruption-measurement', { body: JSON.stringify({ rate: result.rate, actionAt: result.actionAt, maxSampleStep: jump }), contentType: 'application/json' });
  expect(jump, 'An interrupted nonzero waveform must not be cut abruptly').toBeLessThan(.01);
  expect(Math.max(...result.samples.slice(Math.ceil((result.actionAt! + .012) * result.rate)))).toBe(0);
  expect(result.samples[Math.round(.25 * result.rate)]).toBeGreaterThan(.59);
});

test('LIVE drained buffers fade to silence and a late fragment starts smoothly', async () => {
  const result = await render({ chunks: 1, constant: true, lateAt: .30 });
  let jump = 0;
  for (let i = 1; i < result.samples.length; i++) jump = Math.max(jump, Math.abs(result.samples[i]! - result.samples[i - 1]!));
  await test.info().attach('underrun-measurement', { body: JSON.stringify({ rate: result.rate, maxSampleStep: jump, schedule: result.metadata.scheduled }), contentType: 'application/json' });
  expect(jump, 'Both ends of a network underrun must avoid a full-amplitude step').toBeLessThan(.01);
  expect(result.metadata.scheduled).toHaveLength(2);
  expect(result.metadata.scheduled[1].start - result.metadata.scheduled[1].received).toBeCloseTo(.18, 5);
  expect(result.samples[Math.round(.21 * result.rate)]).toBeGreaterThan(.59);
  expect(result.samples[Math.round(.35 * result.rate)]).toBe(0);
  expect(result.samples[Math.round(.51 * result.rate)]).toBeGreaterThan(.59);
});

test('LIVE late arrival during release never jumps back to full gain', async () => {
  const result = await render({ chunks: 1, constant: true, lateAt: .227 });
  let jump = 0;
  for (let i = 1; i < result.samples.length; i++) jump = Math.max(jump, Math.abs(result.samples[i]! - result.samples[i - 1]!));
  expect(jump).toBeLessThan(.01);
  expect(result.metadata.scheduled[1].start - result.metadata.scheduled[0].end).toBeCloseTo(.18, 5);
});

test('LIVE interruption during an attack or a release preserves its current gain', async () => {
  for (const interruptAt of [.181, .677]) {
    const result = await render({ chunks: 1, constant: true, interruptAt });
    let jump = 0;
    for (let i = 1; i < result.samples.length; i++) jump = Math.max(jump, Math.abs(result.samples[i]! - result.samples[i - 1]!));
    expect(jump).toBeLessThan(.01);
    expect(result.samples.slice(Math.ceil((result.actionAt! + .012) * result.rate)).every(v => v === 0)).toBe(true);
  }
});

test('LIVE real Chromium context keeps jittered playback continuous on a silent sink', async () => {
  await startRenderer('realtime');
  const context = await page.evaluate(() => ({ rate: (window as any).playbackContext.sampleRate, sink: (window as any).playbackContext.sinkId?.type }));
  expect(context).toEqual({ rate: 24000, sink: 'none' });
  await page.evaluate(async () => {
    for (let n = 0; n < 20; n++) {
      const pcm = new Int16Array(1200);
      for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin((n * 1200 + i) * .09) * 2000);
      (window as any).audioCommand({ command: 'play', pcm: new Uint8Array(pcm.buffer) });
      await new Promise(ok => setTimeout(ok, n % 4 === 0 ? 65 : 35));
    }
  });
  await expect.poll(() => page.evaluate(() => (window as any).audioEvents.filter((v: any) => v.type === 'output').map((v: any) => v.playing))).toEqual([true, false]);
  const result = await page.evaluate(() => ({ events: (window as any).audioEvents, metadata: (window as any).liveAudioMetadata }));
  expect(result.events.some((v: any) => v.type === 'error')).toBe(false);
  for (let i = 1; i < result.metadata.scheduled.length; i++) expect(result.metadata.scheduled[i].start).toBeCloseTo(result.metadata.scheduled[i - 1].end, 8);
  await test.info().attach('realtime-silent-context', { body: JSON.stringify({ context, metadata: result.metadata }), contentType: 'application/json' });
  await page.evaluate(() => (window as any).audioCommand({ command: 'stop' }));
});
