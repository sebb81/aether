import { BrowserWindow, ipcMain } from 'electron';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LiveAudioPort, VoiceSettings } from '@aether/shared';
import { LiveAudioError } from '@aether/live';

const CHANNEL = 'aether:live-audio-private';
// Capture and playback belong to the same Chromium audio engine so its WebRTC
// echo canceller receives the actual speaker reference. This window has no keys.
export class ChromiumLiveDuplex implements LiveAudioPort {
  readonly source = 'microphone' as const;
  readonly processing = { driver: 'chromium' as const, echoCancellation: false, playbackBufferMs: 180 };
  private window: BrowserWindow | null = null;
  private cleanup: (() => void) | null = null;
  constructor(private readonly settings: () => VoiceSettings, private readonly allowed: () => boolean, private readonly microphoneName: () => Promise<string | null>, private readonly directory = __dirname) {}
  async start(input: Parameters<LiveAudioPort['start']>[0], output: Parameters<LiveAudioPort['start']>[1], error: Parameters<LiveAudioPort['start']>[2], signal: AbortSignal): Promise<void> {
    this.close();if (signal.aborted || !this.allowed()) throw new Error('Audio LIVE non autorisé.');
    const cfg = this.settings(), microphone = await this.microphoneName();
    if (signal.aborted || !this.allowed()) throw new Error('Audio LIVE annulé.');
    const window = new BrowserWindow({ title: 'AETHER · audio LIVE', width: 1, height: 1, show: false, skipTaskbar: true,
      webPreferences: { preload: resolve(this.directory, 'live-audio-preload.cjs'), partition: 'aether-live-audio', sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
    this.window = window;this.processing.echoCancellation = false;
    const page = resolve(this.directory, '../audio/live-audio.html'), url = pathToFileURL(page).href;
    const owner = () => this.window === window && !window.isDestroyed() && window.webContents.getURL() === url && !signal.aborted && this.allowed();
    const ses = window.webContents.session;
    ses.setPermissionCheckHandler((contents, permission, _origin, details) => contents === window.webContents && owner() && permission === 'media' && details.mediaType === 'audio');
    ses.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === window.webContents && owner() && permission === 'media' && 'mediaTypes' in details && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio'));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.on('page-title-updated', event => event.preventDefault());
    window.webContents.on('will-navigate', event => event.preventDefault());
    let ready = false, rejectStart: (reason: Error) => void = () => {};
    const failure = () => { if (this.window !== window) return;this.close();if (!ready) rejectStart(new Error('Audio LIVE avec annulation d’écho indisponible.'));else error('Audio LIVE indisponible. Vérifiez le microphone et la sortie Windows.'); };
    const abort = () => { rejectStart(new Error('Audio LIVE annulé.'));this.close(); };
    const started = new Promise<void>((ok, no) => {
      rejectStart = no;
      const receive = (event: Electron.IpcMainEvent, value: Record<string, unknown>) => {
        if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !owner()) return;
        if (!value || typeof value !== 'object') { failure();return; }
        if (value.type === 'ready' && value.echoCancellation === true && value.captureSilent === true) { ready = true;this.processing.echoCancellation = true;ok(); }
        else if (value.type === 'input' && ready && value.pcm instanceof Uint8Array && value.pcm.length === 640 && typeof value.level === 'number' && Number.isFinite(value.level) && typeof value.speech === 'boolean') input(value.pcm, value.level, value.speech);
        else if (value.type === 'output' && ready && typeof value.playing === 'boolean' && typeof value.level === 'number' && Number.isFinite(value.level)) output(value.playing, value.level);
        else failure();
      };
      ipcMain.on(CHANNEL, receive);signal.addEventListener('abort', abort, { once: true });
      this.cleanup = () => { ipcMain.removeListener(CHANNEL, receive);signal.removeEventListener('abort', abort); };
    });
    void started.catch(() => {}); // A navigation failure can precede awaiting ready.
    window.on('closed', failure);window.webContents.on('render-process-gone', failure);
    const timeout = setTimeout(failure, 15000);
    try { await window.loadFile(page);if (!owner()) throw new Error('Audio LIVE annulé.');window.webContents.send(CHANNEL, { command: 'start', microphone, volume: cfg.volume, bufferMs: this.processing.playbackBufferMs });await started; }
    catch { failure();throw new LiveAudioError('audio-unavailable'); }
    finally { clearTimeout(timeout); }
  }
  private send(value: object): void { if (!this.window || this.window.isDestroyed()) throw new Error('Audio LIVE arrêté.');this.window.webContents.send(CHANNEL, value); }
  play(pcm: Uint8Array, rate: number): void { if (rate !== 24000 || pcm.length > 512000 || pcm.length % 2) throw new Error('PCM LIVE invalide.');this.send({ command: 'play', pcm }); }
  interrupt(): void { if (this.window) this.send({ command: 'interrupt' }); }
  close(): void { const window = this.window;this.window = null;this.cleanup?.();this.cleanup = null;this.processing.echoCancellation = false;if (window && !window.isDestroyed()) window.destroy(); }
}
