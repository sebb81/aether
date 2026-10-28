import { EventBus } from '@aether/core';
import type { AudioCaptureProvider, AudioClip, AudioOutputProvider, InputModality, OperationResult, SpeechToTextProvider, TextToSpeechProvider, VoiceDiagnostic, VoiceMetrics, VoiceSettings, VoiceSnapshot } from '@aether/shared';
import { shouldSpeak, spokenText } from './policy';

export interface VoiceDependencies {
  capture: AudioCaptureProvider; stt: () => SpeechToTextProvider; tts: () => TextToSpeechProvider; output: AudioOutputProvider;
  submit: (text: string, source: InputModality) => Promise<OperationResult>;
  answer: () => { full: string; spoken?: string } | null;
  cancelMind: () => void; retain: (clip: AudioClip) => Promise<void>;
}
const metrics = (): VoiceMetrics => ({ captureMs: null, sttMs: null, mindMs: null, ttsMs: null, playbackStartMs: null, firstSoundMs: null, totalMs: null });
export class VoiceEngine {
  readonly events = new EventBus<{ changed: VoiceSnapshot }>();
  private current: VoiceSnapshot;
  private operation: AbortController | null = null;
  private generation = 0;
  private closed = false;
  private started = 0;
  constructor(settings: VoiceSettings, private readonly ports: VoiceDependencies) {
    this.current = { state: 'idle', microphoneActive: false, audioLevel: 0, source: null, error: null, notice: null, transcription: null, fullResponse: null, spokenResponse: null, settings: structuredClone(settings), metrics: null, diagnostics: [], shortcutRegistered: false, wakeWordAvailable: false, cloudActive: false };
  }
  snapshot(): VoiceSnapshot { return structuredClone({ ...this.current, metrics: this.current.settings.diagnostics ? this.current.metrics : null }); }
  busy(): boolean { return this.operation !== null; }
  state() { return this.current.state; }
  private update(patch: Partial<VoiceSnapshot>) { this.current = { ...this.current, ...patch }; if (!this.closed) this.events.emit('changed', this.snapshot()); }
  configure(settings: VoiceSettings) { this.stop(); this.update({ settings: structuredClone(settings), error: null }); }
  registered(value: boolean) { this.update({ shortcutRegistered: value }); }
  diagnostics(value: VoiceDiagnostic[]) { this.update({ diagnostics: value }); }
  private level(value: number, generation: number) { if (generation === this.generation && ['listening', 'speaking'].includes(this.current.state)) this.update({ audioLevel: Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0 }); }
  stop() {
    const cancelMind = this.current.state === 'processing';
    this.generation++; this.operation?.abort(); this.operation = null;
    if (cancelMind) this.ports.cancelMind();
    this.update({ state: 'idle', microphoneActive: false, audioLevel: 0, notice: 'VOICE arrêtée.', error: null });
  }
  finishCapture() { if (this.current.state === 'listening') this.ports.capture.finish(); else if (this.busy()) this.stop(); }
  private valid(generation: number, signal: AbortSignal) { return !this.closed && generation === this.generation && !signal.aborted; }
  private fail(error: unknown, generation: number) { if (generation === this.generation) this.update({ state: 'error', microphoneActive: false, audioLevel: 0, error: error instanceof Error ? error.message : 'VOICE indisponible. Le dialogue écrit reste disponible.' }); }
  async listen(): Promise<OperationResult> {
    if (this.closed || this.busy()) return { ok: false, error: 'VOICE est déjà occupée.' };
    const settings = this.current.settings;
    if (!settings.enabled || settings.microphoneConsent !== 'granted') { const error='Autorisez le microphone et activez VOICE dans son panneau.';this.update({state:'error',error});return {ok:false,error}; }
    if (settings.sttProvider === 'disabled') { const error='Aucun fournisseur STT configuré. Aucune capture démarrée.';this.update({state:'error',error});return {ok:false,error}; }
    const operation = new AbortController(), generation = ++this.generation; this.operation = operation; this.started = Date.now();
    this.update({ state: 'starting', error: null, notice: null, transcription: null, fullResponse: null, spokenResponse: null, metrics: metrics(), source: null });
    try {
      const stt = this.ports.stt();
      if (stt.locality !== 'local') throw new Error('Un fournisseur cloud exige une configuration et un consentement séparés.');
      const captureStarted = Date.now();
      const clip = await this.ports.capture.start(settings, source => { if (this.valid(generation, operation.signal)) this.update({ state: 'listening', microphoneActive: source === 'microphone', source }); }, level => this.level(level, generation), operation.signal);
      if (!this.valid(generation, operation.signal)) return { ok: false, error: 'Prise annulée.' };
      this.update({ state: 'transcribing', microphoneActive: false, audioLevel: 0, metrics: { ...this.current.metrics!, captureMs: Date.now() - captureStarted } });
      if (settings.retainDiagnosticAudio) await this.ports.retain(clip);
      if (!this.valid(generation, operation.signal)) return { ok: false, error: 'Prise annulée.' };
      if (!clip.speechDetected) { this.update({ state: 'idle', notice: 'Aucun signal audio exploitable. Vérifiez le microphone sélectionné et son volume d’entrée.' }); return { ok: true }; }
      const start = Date.now(), recognized = await stt.transcribe(clip, settings.language, operation.signal);
      if (!this.valid(generation, operation.signal)) return { ok: false, error: 'Transcription annulée.' };
      this.update({ metrics: { ...this.current.metrics!, sttMs: Date.now() - start } });
      if (!recognized.text.trim()) { this.update({ state: 'idle', notice: 'Aucune parole reconnue dans la prise. Rapprochez-vous du micro ou choisissez un autre microphone, puis recommencez.' }); return { ok: true }; }
      this.update({ state: 'processing', transcription: recognized.text.trim() });
      const mindStart = Date.now(), result = await this.ports.submit(recognized.text.trim(), 'voice');
      if (!this.valid(generation, operation.signal)) return { ok: false, error: 'Réponse annulée.' };
      this.update({ metrics: { ...this.current.metrics!, mindMs: Date.now() - mindStart } });
      if (!result.ok) throw new Error(result.error);
      await this.speakAnswer('voice', generation, operation.signal);
      return { ok: true };
    } catch (error) { this.fail(error, generation); return { ok: false, error: error instanceof Error ? error.message : 'VOICE indisponible.' }; }
    finally { if (generation === this.generation) { this.operation = null; this.update({ microphoneActive: false, audioLevel: 0, metrics: { ...this.current.metrics!, totalMs: Date.now() - this.started } }); } }
  }
  async afterText(): Promise<void> {
    if (this.closed || !shouldSpeak(this.current.settings, 'text')) return;
    this.stop(); const operation = new AbortController(), generation = ++this.generation; this.operation = operation; this.started = Date.now();
    this.update({ metrics: metrics(), error: null, notice: null });
    try { await this.speakAnswer('text', generation, operation.signal); } catch (error) { this.fail(error, generation); }
    finally { if (generation === this.generation) this.operation = null; }
  }
  private async speakAnswer(source: InputModality, generation: number, signal: AbortSignal) {
    const answer = this.ports.answer(); if (!answer) { this.update({ state: 'idle' }); return; }
    await this.speak(answer,source,generation,signal);
  }
  async preview():Promise<void>{
    this.stop();const operation=new AbortController(),generation=++this.generation;this.operation=operation;this.started=Date.now();
    this.update({metrics:metrics(),error:null,notice:'Essai de la voix locale, sans message envoyé à MIND.'});
    try{await this.speak({full:'Bonjour, je suis ENTITY. Ma voix est prête.'},'voice',generation,operation.signal,true);}catch(error){this.fail(error,generation);}
    finally{if(generation===this.generation)this.operation=null;}
  }
  private async speak(answer:{full:string;spoken?:string},source:InputModality,generation:number,signal:AbortSignal,preview=false){
    const spoken = spokenText(answer.full, answer.spoken);
    this.update({ fullResponse: answer.full, spokenResponse: spoken });
    if ((!preview&&!shouldSpeak(this.current.settings, source)) || !spoken) { this.update({ state: 'idle' }); return; }
    const tts = this.ports.tts(); if (tts.locality !== 'local') throw new Error('Synthèse cloud non autorisée. La réponse écrite reste disponible.');
    this.update({ state: 'synthesizing' }); const start = Date.now();
    const clip = await tts.synthesize(spoken, this.current.settings, signal);
    if (!this.valid(generation, signal)) return;
    this.update({ metrics: { ...this.current.metrics!, ttsMs: Date.now() - start } });
    const playback = Date.now();
    await this.ports.output.play(clip, this.current.settings.volume, () => { if (this.valid(generation, signal)) this.update({ state: 'speaking', metrics: { ...this.current.metrics!, playbackStartMs: Date.now() - playback, firstSoundMs: Date.now() - this.started } }); }, level => this.level(level, generation), signal);
    if (this.valid(generation, signal)) this.update({ state: 'idle', audioLevel: 0 });
  }
  close() { this.stop(); this.closed = true; }
}
