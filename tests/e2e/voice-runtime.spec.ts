import { test, expect, _electron as electron } from '@playwright/test';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { DEFAULT_VOICE_SETTINGS } from '@aether/voice';
import type { VoiceSnapshot } from '@aether/shared';
import { localModelPath } from '../../apps/desktop/main/voice-providers';

test('VOICE starts with the Windows Explorer PATH and upgrades the ambiguous Python setting without opening a microphone', async () => {
  test.setTimeout(120000);
  const profile = await mkdtemp(join(tmpdir(), 'aether-voice-runtime-'));
  const native = promisify(execFile);
  const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await native(powershell, ['-NoProfile', '-NonInteractive', '-Command', "[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')"], { windowsHide: true });
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && !/^(PATH|CONDA.*|_.*CONDA.*|ELECTRON_RUN_AS_NODE|OPENAI_API_KEY|AETHER_TEST_.*|AETHER_RENDERER_URL)$/i.test(key)) env[key] = value;
  }
  env.Path = stdout.trim(); env.AETHER_TEST_PROFILE = profile;
  const before = { ...DEFAULT_VOICE_SETTINGS, pythonPath: 'python', modelPath: localModelPath() };
  await writeFile(join(profile, 'voice-settings.json'), JSON.stringify(before));
  const application = await electron.launch({ args: [resolve('.')], env });
  try {
    const entity = await application.firstWindow();
    await entity.locator('.entity-stage').waitFor();
    const snapshot = await entity.evaluate(() => window.aether.getVoice());
    expect(isAbsolute(snapshot.settings.pythonPath)).toBe(true);
    expect(snapshot.settings.microphoneConsent).toBe('prompt'); expect(snapshot.settings.enabled).toBe(false); expect(snapshot.microphoneActive).toBe(false);
    expect(JSON.parse(await readFile(join(profile, 'voice-settings.json'), 'utf8'))).toEqual({ ...before, pythonPath: snapshot.settings.pythonPath });
    await entity.evaluate(() => window.aether.command('voice'));
    await expect.poll(() => application.windows().some(page => page.url().endsWith('#voice'))).toBe(true);
    const panel = application.windows().find(page => page.url().endsWith('#voice'))!;
    await panel.locator('.voice-page').waitFor();
    const inventory = await panel.evaluate(() => window.aether.getVoiceInventory());
    expect(inventory.errors).toEqual([]); expect(inventory.sttAvailable).toBe(true); expect(inventory.ttsAvailable).toBe(true); expect(inventory.microphones.length).toBeGreaterThan(0);
    expect(inventory.runtime.toLowerCase()).toBe(snapshot.settings.pythonPath.toLowerCase());
    const states: VoiceSnapshot[] = [];
    await entity.exposeFunction('voiceRuntimeEvent', (value: VoiceSnapshot) => states.push(value));
    await entity.evaluate(() => window.aether.onVoice(value => { void (window as unknown as { voiceRuntimeEvent: (value: VoiceSnapshot) => void }).voiceRuntimeEvent(value); }));
    await panel.evaluate(() => window.aether.voiceControl('test-voice'));
    try {
      await expect.poll(async () => {
        const current = await entity.evaluate(() => window.aether.getVoice());
        if (current.state === 'error') throw new Error(current.error ?? 'VOICE error');
        return states.some(value => value.state === 'speaking');
      }, { timeout: 30000 }).toBe(true);
    } catch (error) {
      console.log(JSON.stringify({ previewFailure: await entity.evaluate(() => window.aether.getVoice()), states: states.map(value => ({ state: value.state, error: value.error, notice: value.notice })) }));
      throw error;
    }
    await expect.poll(async () => (await entity.evaluate(() => window.aether.getVoice())).state, { timeout: 15000 }).toBe('idle');
    expect(states.every(value => !value.microphoneActive)).toBe(true);
    const audioFiles = (await readdir(profile, { recursive: true })).filter(name => /\.(wav|mp3|webm|ogg|flac)$/i.test(String(name)));
    expect(audioFiles).toEqual([]);
    await mkdir('test-results/voice-runtime', { recursive: true });
    await writeFile('test-results/voice-runtime/evidence.json', JSON.stringify({ checkedAt: new Date().toISOString(), result: 'PASS', launch: 'Registered Windows PATH, no activated Conda environment', before, after: snapshot.settings, inventory, actualNativePlayback: states.some(value => value.state === 'speaking'), microphoneOpened: states.some(value => value.microphoneActive), audioFiles }, null, 2) + '\n');
  } finally { await application.close(); await rm(profile, { recursive: true, force: true }); }
});

test('quiet speech reaches actual Whisper and a silent take displays its cause', async () => {
  test.setTimeout(180000);
  const profile = await mkdtemp(join(tmpdir(), 'aether-quiet-profile-'));
  const fixtures = await mkdtemp(join(tmpdir(), 'aether-quiet-fixtures-'));
  const settings = { ...DEFAULT_VOICE_SETTINGS, enabled: true, microphoneConsent: 'granted', diagnostics: true, modelPath: localModelPath() };
  await writeFile(join(profile, 'voice-settings.json'), JSON.stringify(settings));
  await writeFile(join(profile, 'ai-settings.json'), JSON.stringify({ schemaVersion: 1, provider: 'ollama', model: 'qwen3.5:9b', ollamaUrl: 'http://127.0.0.1:11434', cloudConsent: false }));
  const wav = await new Promise<Buffer>((ok, no) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve('dist/main/voice-speech.ps1'), '-Operation', 'synthesize'], { windowsHide: true });
    let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', data => output += data); child.stderr.on('data', () => {}); child.on('error', no);
    child.on('exit', code => { try { const result = JSON.parse(output); if (code || result.error) throw new Error(result.error ?? 'TTS failed'); ok(Buffer.from(result.wav, 'base64')); } catch (error) { no(error); } });
    child.stdin.end(JSON.stringify({ text: "Comment t'appelles-tu ?", voice: 'Microsoft Hortense Desktop', language: 'fr-FR', speed: 1 }));
  });
  let dataOffset = 12;
  while (wav.toString('ascii', dataOffset, dataOffset + 4) !== 'data') dataOffset += 8 + wav.readUInt32LE(dataOffset + 4) + (wav.readUInt32LE(dataOffset + 4) % 2);
  const start = dataOffset + 8, end = start + wav.readUInt32LE(dataOffset + 4);
  let peak = 0;
  for (let i = start; i < end; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
  for (let i = start; i < end; i += 2) wav.writeInt16LE(Math.round(wav.readInt16LE(i) * 32 / peak), i);
  await writeFile(join(fixtures, '01.wav'), wav);
  const env: NodeJS.ProcessEnv = { ...process.env, AETHER_TEST_PROFILE: profile, AETHER_TEST_VOICE_FIXTURES: fixtures }; delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({ args: [resolve('.')], env: env as Record<string, string> });
  try {
    const entity = await application.firstWindow(); await entity.locator('.entity-stage').waitFor();
    await entity.evaluate(() => window.aether.command('dialogue'));
    await expect.poll(() => application.windows().some(page => page.url().endsWith('#dialogue'))).toBe(true);
    const dialogue = application.windows().find(page => page.url().endsWith('#dialogue'))!;
    await dialogue.locator('.dialogue-page').waitFor();
    await entity.evaluate(() => window.aether.voiceControl('toggle'));
    await expect.poll(async () => {
      const value = await entity.evaluate(() => window.aether.getVoice());
      return value.state === 'error' ? value.error : value.state === 'idle' && value.source === 'test-fixture' ? Boolean(value.transcription) || value.notice : false;
    }, { timeout: 130000 }).toBe(true);
    const quiet = await entity.evaluate(() => window.aether.getVoice());
    expect(quiet.transcription).toMatch(/appelles/i); expect(quiet.fullResponse).toMatch(/ENTITY/); expect(quiet.metrics!.firstSoundMs).not.toBeNull(); expect(quiet.microphoneActive).toBe(false);
    const messageCount = (await entity.evaluate(() => window.aether.getMind())).messages.length;
    wav.fill(0, start, end); await writeFile(join(fixtures, '01.wav'), wav);
    await entity.evaluate(() => window.aether.voiceControl('toggle'));
    await expect(dialogue.getByRole('status').filter({ hasText: 'Aucune parole reconnue dans la prise' })).toBeVisible({ timeout: 15000 });
    const silence = await entity.evaluate(() => window.aether.getVoice());
    expect(silence.state).toBe('idle'); expect(silence.error).toBeNull(); expect(silence.transcription).toBeNull(); expect((await entity.evaluate(() => window.aether.getMind())).messages.length).toBe(messageCount);
    await mkdir('test-results/voice-runtime', { recursive: true });
    await dialogue.screenshot({ path: 'test-results/voice-runtime/silence-visible.png' });
    await writeFile('test-results/voice-runtime/quiet-speech.json', JSON.stringify({ checkedAt: new Date().toISOString(), result: 'PASS', source: 'Windows TTS attenuated to peak 32/32768; controlled fixture, no microphone', peak: 32 / 32768, previousSttGate: .002, quiet, silence, silenceNoticeVisible: true, noMindMessageForSilence: true }, null, 2) + '\n');
  } finally { await application.close(); await rm(profile, { recursive: true, force: true }); await rm(fixtures, { recursive: true, force: true }); }
});
