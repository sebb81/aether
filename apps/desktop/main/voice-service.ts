import { join, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { VoiceEngine, parseVoiceWrite } from '@aether/voice';
import type { InputModality, OperationResult, VoiceSettings } from '@aether/shared';
import { FasterWhisperProvider, FixtureCapture, inventory, LocalAudioWorker, PortAudioCapture, PortAudioOutput, WindowsSpeechProvider } from './voice-providers';
import { VoiceDiagnosticStore, VoiceSettingsStore } from './voice-storage';
import type { DesktopMindService } from './mind-service';
import { resolveVoicePython } from './voice-runtime';

export class DesktopVoiceService {
  readonly engine: VoiceEngine;
  readonly worker = new LocalAudioWorker();
  readonly store: VoiceSettingsStore;
  readonly diagnostic: VoiceDiagnosticStore;
  private settings: VoiceSettings;
  private cleanup: ReturnType<typeof setInterval>;
  constructor(root: string, mind: DesktopMindService, submit: (text: string, source: InputModality) => Promise<OperationResult>, fixtureFolder?: string) {
    this.store = new VoiceSettingsStore(join(root, 'voice-settings.json')); this.settings = this.store.load();
    this.diagnostic = new VoiceDiagnosticStore(root);
    if (!this.settings.retainDiagnosticAudio) this.diagnostic.clear();
    this.engine = new VoiceEngine(this.settings, {
      capture: fixtureFolder ? new FixtureCapture(fixtureFolder) : new PortAudioCapture(this.worker),
      stt: () => {
        if (!this.settings.modelPath || !isAbsolute(this.settings.modelPath) || !['model.bin', 'config.json', 'tokenizer.json'].every(name => existsSync(join(this.settings.modelPath, name)))) throw new Error('Aucun modèle STT local complet. Choisissez le dossier Whisper dans VOICE ; aucune capture démarrée.');
        return new FasterWhisperProvider(this.worker, () => this.settings);
      },
      tts: () => { if (this.settings.ttsProvider === 'disabled') throw new Error('Aucun fournisseur TTS configuré. La réponse de MIND reste disponible en texte.'); return new WindowsSpeechProvider(); },
      output: new PortAudioOutput(this.worker, () => this.settings), submit,
      answer: () => { const answer = mind.engine.snapshot().messages.at(-1); return answer?.role === 'assistant' ? { full: answer.content, ...(answer.spokenResponse ? { spoken: answer.spokenResponse } : {}) } : null; },
      cancelMind: () => mind.engine.cancel(), retain: async clip => { if (this.settings.retainDiagnosticAudio) { this.diagnostic.retain(clip); this.engine.diagnostics(this.diagnostic.list()); } },
    });
    this.engine.diagnostics(this.diagnostic.list());
    this.cleanup = setInterval(() => {try{this.engine.diagnostics(this.diagnostic.list());}catch{this.engine.stop();}}, 60000);
  }
  configuration() { return structuredClone(this.settings); }
  save(input: unknown) {
    const write = parseVoiceWrite(input);
    write.pythonPath = resolveVoicePython(write.pythonPath);
    const next = { ...write, schemaVersion: 1 as const, microphoneConsent: this.settings.microphoneConsent };
    this.store.save(next); this.settings = next; this.engine.configure(next); this.worker.close();
    if (!next.retainDiagnosticAudio) this.diagnostic.clear(); this.engine.diagnostics(this.diagnostic.list());
  }
  consent(decision: 'grant' | 'deny') {
    const next = { ...this.settings, microphoneConsent: decision === 'grant' ? 'granted' as const : 'denied' as const, enabled: decision === 'grant' ? true : this.settings.enabled };
    this.store.save(next); this.settings = next; this.engine.configure(next); this.worker.close();
  }
  async inventory() { const probe=new LocalAudioWorker();try{return await inventory(probe,this.settings);}finally{probe.close();} }
  clearDiagnostics() { this.diagnostic.clear(); this.engine.diagnostics([]); }
  close() { clearInterval(this.cleanup); this.engine.close(); this.worker.close(); }
}
