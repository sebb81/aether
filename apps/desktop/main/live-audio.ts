import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import type { LiveAudioPort, VoiceSettings } from '@aether/shared';
import { resolveVoicePython } from './voice-runtime';

export class PortAudioLiveDuplex implements LiveAudioPort {
  readonly source: 'microphone' | 'test-fixture';
  private child: ChildProcessWithoutNullStreams | null = null;
  private rejectStart: ((error: Error) => void) | null = null;
  constructor(private readonly settings: () => VoiceSettings, private readonly fixtureFolder?: string, private readonly helperPath?: string) { this.source = fixtureFolder ? 'test-fixture' : 'microphone'; }
  async start(onInput: Parameters<LiveAudioPort['start']>[0], onOutput: Parameters<LiveAudioPort['start']>[1], onError: Parameters<LiveAudioPort['start']>[2], signal: AbortSignal): Promise<void> {
    this.close(); if (signal.aborted) throw new Error('Audio annulé.');
    const cfg = this.settings(), env: NodeJS.ProcessEnv = {};
    for (const name of ['PATH','SystemRoot','WINDIR','APPDATA','LOCALAPPDATA','TEMP','TMP','USERPROFILE','PROGRAMDATA']) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' });
    const helper = (this.helperPath ?? resolve(__dirname, 'live-audio-worker.py')).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const child = spawn(resolveVoicePython(cfg.pythonPath), ['-u', helper], { windowsHide: true, env, stdio: 'pipe' }); this.child = child;
    const abort = () => this.close(); signal.addEventListener('abort', abort, { once: true });
    child.once('exit', () => signal.removeEventListener('abort', abort));
    let buffer = '', ready = false;
    const failure = () => { if (this.child !== child) return; this.close(); onError('Le flux audio LIVE local a échoué. Vérifiez Python, le microphone et la sortie Windows.'); };
    child.stderr.on('data', () => {}); child.on('error', failure); child.on('exit', failure); child.stdin.on('error', failure);
    const started = new Promise<void>((ok, no) => {
      this.rejectStart = no;
      child.stdout.setEncoding('utf8'); child.stdout.on('data', (chunk: string) => {
        if (this.child !== child) return;
        buffer += chunk; if (buffer.length > 200000) { failure(); return; }
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try {
            const v = JSON.parse(line) as Record<string, unknown>;
            if (v.type === 'ready') { ready = true; this.rejectStart = null; ok(); }
            else if (v.type === 'input' && ready && typeof v.pcm === 'string' && v.pcm.length < 10000 && typeof v.level === 'number' && Number.isFinite(v.level) && typeof v.speech === 'boolean') onInput(Buffer.from(v.pcm, 'base64'), v.level, v.speech);
            else if (v.type === 'output' && typeof v.playing === 'boolean' && typeof v.level === 'number') onOutput(v.playing, v.level);
            else throw new Error('Invalid audio event');
          } catch { failure(); return; }
        }
      });
    });
    const timeout = setTimeout(failure, 10000);
    child.stdin.write(JSON.stringify({ command: 'start', microphone: cfg.microphone, volume: cfg.volume, ...(this.fixtureFolder ? { fixtureFolder: this.fixtureFolder } : {}) }) + '\n');
    try { await started; } finally { clearTimeout(timeout); }
  }
  private send(value: object): void {
    if (!this.child || this.child.stdin.writableLength > 1500000) throw new Error('Flux audio arrêté ou file de lecture saturée.');
    this.child.stdin.write(JSON.stringify(value) + '\n');
  }
  play(pcm: Uint8Array, rate: number): void { if (rate !== 24000 || pcm.length > 512000) throw new Error('Format PCM LIVE invalide.'); this.send({ command: 'play', pcm: Buffer.from(pcm).toString('base64') }); }
  interrupt(): void { if (this.child) this.send({ command: 'interrupt' }); }
  close(): void { const child = this.child; this.child = null; const reject = this.rejectStart; this.rejectStart = null; reject?.(new Error('Audio LIVE arrêté.')); child?.kill(); }
}
