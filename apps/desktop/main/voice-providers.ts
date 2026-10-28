import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { AudioCaptureProvider, AudioClip, AudioOutputProvider, InstalledVoice, SpeechToTextProvider, TextToSpeechProvider, VoiceDevice, VoiceInventory, VoiceSettings } from '@aether/shared';
import { audioWorkerExitError, resolveVoicePython } from './voice-runtime';

const helper = (name: string) => resolve(__dirname, name).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
const aborted = () => new Error('Opération vocale interrompue.');
const decode = (value: unknown): Uint8Array => {
  if (typeof value !== 'string' || value.length > 3_400_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Audio du fournisseur invalide.');
  const wav = Buffer.from(value, 'base64');
  if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Format audio du fournisseur invalide.');
  return wav;
};
export function localModelPath(): string {
  const hub = join(homedir(), '.cache', 'huggingface', 'hub');
  for (const model of ['medium', 'small', 'base']) {
    const snapshots = join(hub, `models--Systran--faster-whisper-${model}`, 'snapshots');
    if (existsSync(snapshots)) for (const entry of readdirSync(snapshots)) {
      const folder = join(snapshots, entry);
      if (['model.bin', 'config.json', 'tokenizer.json'].every(name => existsSync(join(folder, name)))) return folder;
    }
  }
  return '';
}
interface Pending {
  id: string; op: string; resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void;
  event: (type: string, value: Record<string, unknown>) => void; dispose: () => void;
}
export class LocalAudioWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending: Pending | null = null;
  private path = '';
  private buffer = '';
  private ensure(python: string) {
    python = resolveVoicePython(python);
    if (this.child && this.path === python) return;
    this.close(); this.path = python;
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'USERPROFILE', 'PROGRAMDATA']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', OMP_NUM_THREADS: '8' });
    const child = spawn(python || 'python', ['-u', helper('voice-worker.py')], { windowsHide: true, env, stdio: 'pipe' }); this.child = child; this.buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (this.child !== child) return;
      this.buffer += chunk;
      if (this.buffer.length > 4_000_000) { this.close(new Error('Réponse audio trop longue.')); return; }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        try {
          const value = JSON.parse(line) as Record<string, unknown>, pending = this.pending;
          if (!pending || value.id !== pending.id) continue;
          if (value.type === 'result') { this.pending = null; pending.dispose(); pending.resolve(value); }
          else if (value.type === 'error') { this.pending = null; pending.dispose(); pending.reject(new Error(typeof value.message === 'string' ? value.message : 'Fournisseur audio indisponible.')); }
          else if (value.type === 'started' || value.type === 'level') pending.event(value.type, value);
          else throw new Error('Invalid audio event');
        } catch { this.close(new Error('Le fournisseur audio a envoyé une réponse invalide.')); return; }
      }
    });
    // Runtime diagnostics may contain paths; never publish stderr or record raw audio.
    child.stderr.on('data', () => {});
    child.stdin.on('error',()=>{if(this.child===child)this.close(new Error('Le fournisseur audio local ne répond plus. Réessayez.'));});
    child.on('error', () => { if (this.child === child) this.close(new Error('Python audio indisponible. Choisissez son exécutable et vérifiez les dépendances VOICE.')); });
    child.on('exit', (code, signal) => { if (this.child === child) this.close(audioWorkerExitError(code, signal)); });
  }
  request(python: string, op: string, input: Record<string, unknown>, signal: AbortSignal, event: Pending['event'] = () => {}, timeoutMs = 120000): Promise<Record<string, unknown>> {
    if (signal.aborted) return Promise.reject(aborted());
    if (this.pending) return Promise.reject(new Error('Le fournisseur audio est déjà occupé.'));
    this.ensure(python);
    return new Promise((resolveRequest, reject) => {
      const id = randomUUID(), abort = () => this.close(aborted());
      const timeout = setTimeout(() => this.close(new Error('Délai audio dépassé. AETHER peut reprendre une nouvelle prise.')), timeoutMs);
      this.pending = { id, op, resolve: resolveRequest, reject, event, dispose: () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); } };
      signal.addEventListener('abort', abort, { once: true });
      this.child!.stdin.write(JSON.stringify({ id, op, ...input }) + '\n', 'utf8');
    });
  }
  finish() { if (this.pending?.op === 'capture') this.child?.stdin.write(JSON.stringify({ id: this.pending.id, op: 'finish' }) + '\n'); }
  close(error: Error = aborted()) {
    const child = this.child; this.child = null; const pending = this.pending; this.pending = null; this.buffer = '';
    if (pending) { pending.dispose(); pending.reject(error); } child?.kill();
  }
}
export class PortAudioCapture implements AudioCaptureProvider {
  constructor(private worker: LocalAudioWorker) {}
  async start(settings: VoiceSettings, onStarted: (source: AudioClip['source']) => void, onLevel: (level: number) => void, signal: AbortSignal): Promise<AudioClip> {
    const result = await this.worker.request(settings.pythonPath, 'capture', { microphone: settings.microphone }, signal, (type, value) => { if (type === 'started') onStarted('microphone'); else if (type === 'level') onLevel(Number(value.level)); }, 70000);
    return { wav: decode(result.wav), durationMs: Number(result.durationMs), speechDetected: result.speechDetected === true, source: 'microphone' };
  }
  finish() { this.worker.finish(); }
}
export class FasterWhisperProvider implements SpeechToTextProvider {
  readonly id = 'faster-whisper'; readonly locality = 'local';
  constructor(private worker: LocalAudioWorker, private settings: () => VoiceSettings) {}
  async transcribe(clip: AudioClip, language: string, signal: AbortSignal) {
    const settings = this.settings();
    const result = await this.worker.request(settings.pythonPath, 'transcribe', { modelPath: settings.modelPath, language, wav: Buffer.from(clip.wav).toString('base64') }, signal);
    if (typeof result.text !== 'string' || result.text.length > 4000 || typeof result.language !== 'string') throw new Error('Transcription locale invalide.');
    return { text: result.text, language: result.language };
  }
}
export class PortAudioOutput implements AudioOutputProvider {
  constructor(private worker: LocalAudioWorker, private settings: () => VoiceSettings) {}
  async play(clip: AudioClip, volume: number, onStarted: () => void, onLevel: (level: number) => void, signal: AbortSignal): Promise<void> {
    await this.worker.request(this.settings().pythonPath, 'play', { wav: Buffer.from(clip.wav).toString('base64'), volume }, signal, (type, value) => { if (type === 'started') onStarted(); else if (type === 'level') onLevel(Number(value.level)); }, 70000);
  }
}
async function speech(operation: 'voices' | 'synthesize', input: unknown, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (signal.aborted) throw aborted();
  return new Promise((resolveSpeech, reject) => {
    const executable = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper('voice-speech.ps1'), '-Operation', operation], { windowsHide: true });
    child.stdin.on('error',()=>{});
    let output = ''; const abort = () => { child.kill(); reject(aborted()); };
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Synthèse locale trop lente. Le texte reste disponible.')); }, 45000);
    signal.addEventListener('abort', abort, { once: true }); child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { output += chunk; if (output.length > 3_400_000) abort(); }); child.stderr.on('data', () => {});
    child.on('error', () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); reject(new Error('TTS Windows indisponible. Le texte reste disponible.')); });
    child.on('exit', code => {
      clearTimeout(timeout); signal.removeEventListener('abort', abort);
      try { const value = JSON.parse(output) as Record<string, unknown>; if (code !== 0 || value.error) throw new Error(typeof value.error === 'string' ? value.error : 'TTS Windows indisponible.'); resolveSpeech(value); }
      catch (error) { reject(error instanceof Error ? error : new Error('Réponse TTS invalide.')); }
    });
    child.stdin.end(input === null ? '' : JSON.stringify(input), 'utf8');
  });
}
export class WindowsSpeechProvider implements TextToSpeechProvider {
  readonly id = 'windows-speech'; readonly locality = 'local';
  async synthesize(text: string, settings: Pick<VoiceSettings, 'voice' | 'speed' | 'language'>, signal: AbortSignal): Promise<AudioClip> {
    const result = await speech('synthesize', { text, ...settings }, signal), wav = decode(result.wav);
    return { wav, durationMs: 0, speechDetected: true, source: 'synthesis' };
  }
}
export async function inventory(worker: LocalAudioWorker, settings: VoiceSettings): Promise<VoiceInventory> {
  const signal = AbortSignal.timeout(15000), errors: string[] = [];
  const results = await Promise.allSettled([worker.request(settings.pythonPath, 'probe', {}, signal, () => {}, 15000), speech('voices', null, signal)]);
  const audio = results[0]!, voices = results[1]!;
  if (audio.status === 'rejected') errors.push(String(audio.reason)); if (voices.status === 'rejected') errors.push(String(voices.reason));
  return { microphones: audio.status === 'fulfilled' ? audio.value.microphones as VoiceDevice[] : [], voices: voices.status === 'fulfilled' ? voices.value.voices as InstalledVoice[] : [], sttAvailable: audio.status === 'fulfilled' && Boolean(settings.modelPath) && existsSync(join(settings.modelPath, 'model.bin')), ttsAvailable: voices.status === 'fulfilled' && (voices.value.voices as InstalledVoice[]).length > 0, model: settings.modelPath, runtime: audio.status === 'fulfilled' ? String(audio.value.runtime) : settings.pythonPath, errors };
}
// The fixture is only selected by the desktop bootstrap in an unpackaged isolated test profile.
export class FixtureCapture implements AudioCaptureProvider {
  private finishRequest: (() => void) | null = null;
  constructor(private folder: string) {}
  async start(_settings: VoiceSettings, started: (source: AudioClip['source']) => void, _level: (level: number) => void, signal: AbortSignal): Promise<AudioClip> {
    const files = readdirSync(this.folder).filter(name => /^\d+\.wav$/.test(name)).sort(); if (!files.length) throw new Error('Audio de recette absent.');
    const wav = readFileSync(join(this.folder, files[0]!));
    // Files stay as auditable fixtures; the request index is maintained by the test.
    started('test-fixture'); await new Promise<void>((resolveFixture, reject) => { const timer = setTimeout(resolveFixture, 400); this.finishRequest = resolveFixture; signal.addEventListener('abort', () => { clearTimeout(timer); reject(aborted()); }, { once: true }); });
    return { wav, durationMs: 400, speechDetected: true, source: 'test-fixture' };
  }
  finish() { this.finishRequest?.(); }
}
