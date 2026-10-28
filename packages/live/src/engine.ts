import { randomUUID } from 'node:crypto';
import { EventBus } from '@aether/core';
import type { LiveAudioPort, LiveConversationProvider, LiveMetric, LiveProviderEvent, LiveSettings, LiveSnapshot, LiveToolCall, LiveToolResult, OperationResult } from '@aether/shared';
import { AetherToolBridge, LIVE_TOOLS } from './tools';
import { liveInstructions } from './instructions';
import { LiveAudioError } from './errors';

export class LiveConversationEngine {
  readonly events = new EventBus<{ changed: LiveSnapshot }>();
  private current: LiveSnapshot;
  private operation: AbortController | null = null;
  private provider: LiveConversationProvider | null = null;
  private generation = 0;
  private calls = new Map<string, AbortController>();
  private seenCalls = new Set<string>();
  private transcripts = { user: '', assistant: '' };
  private speech = false;
  private speaking = false;
  private suppressed = false;
  private serverTurnComplete = false;
  private speechEndedAt: number | null = null;
  private measuredResponse = false;
  constructor(settings: LiveSettings, private readonly ports: {
    provider(): LiveConversationProvider; audio: LiveAudioPort; bridge: AetherToolBridge;
    configured(): { keyConfigured: boolean; secureStorageAvailable: boolean; microphoneConsent: boolean };
    transcript(role: 'user' | 'assistant', text: string, model: string): void;
  }) { this.current = { state: 'idle', sessionId: null, source: null, microphoneActive: false, audioLevel: 0, error: null, settings, ...this.ports.configured(), metrics: [], audit: [], pending: [], reconnects: 0 }; }
  snapshot(): LiveSnapshot { const { microphoneConsent: _consent, ...configuration } = this.ports.configured(); return structuredClone({ ...this.current, ...configuration, ...(this.ports.audio.processing ? { audioProcessing: this.ports.audio.processing } : {}) }); }
  active(): boolean { return this.operation !== null; }
  configure(settings: LiveSettings): void { this.stop(); this.update({ settings }); }
  pending(value: LiveSnapshot['pending']): void { this.update({ pending: value }); }
  private update(patch: Partial<LiveSnapshot>): void { this.current = { ...this.current, ...patch }; this.events.emit('changed', this.snapshot()); }
  private metric(kind: LiveMetric['kind'], started: number, success = true, tool?: string): void {
    if (this.current.settings.diagnostics === 'off') return;
    this.update({ metrics: [...this.current.metrics, { kind, durationMs: Math.max(0, performance.now() - started), success, at: new Date().toISOString(), ...(tool ? { tool } : {}) }].slice(-100) });
  }
  async start(reconnect = false): Promise<OperationResult> {
    if (this.active()) return { ok: false, error: 'Une session LIVE est déjà ouverte.' };
    const cfg = this.current.settings, configured = this.ports.configured();
    if (!cfg.enabled || cfg.cloudConsent !== 'granted' || !configured.microphoneConsent || !configured.keyConfigured) {
      const error = !cfg.enabled ? 'Activez Gemini Live dans les réglages.' : cfg.cloudConsent !== 'granted' ? 'Le consentement cloud Gemini est requis.' : !configured.microphoneConsent ? 'Le consentement microphone doit être donné dans VOICE.' : 'Gemini Live non configuré : ajoutez la clé dans les réglages ou GEMINI_API_KEY.';
      this.update({ state: 'LIVE_ERROR', error }); return { ok: false, error };
    }
    const operation = new AbortController(), generation = ++this.generation, started = performance.now();
    this.operation = operation; this.suppressed = false; this.serverTurnComplete = false; this.speech = false; this.speaking = false; this.speechEndedAt = null; this.measuredResponse = false; this.seenCalls.clear(); this.transcripts = { user: '', assistant: '' };
    this.update({ state: 'LIVE_CONNECTING', error: null, sessionId: randomUUID(), reconnects: this.current.reconnects + Number(reconnect) });
    try {
      this.provider = this.ports.provider();
      await this.provider.open({ settings: cfg, instructions: liveInstructions(), tools: LIVE_TOOLS }, event => { if (generation === this.generation && !operation.signal.aborted) this.receive(event, generation); }, operation.signal);
      if (generation !== this.generation || operation.signal.aborted) return { ok: false, error: this.current.error ?? 'Connexion LIVE annulée.' };
      this.metric('connection', started);
      await this.ports.audio.start((pcm, level, speech) => {
        if (generation !== this.generation || operation.signal.aborted || this.current.settings.cloudConsent !== 'granted') return;
        try {
          if (speech && !this.speech) {
            // Physical input energy is not proof of a new utterance. Use Gemini's
            // speech interruption event after AEC; fixtures can assert exact timing.
            if (this.speaking && this.ports.audio.source === 'test-fixture') this.interrupt();
            if (!cfg.automaticResponse) this.provider?.activity(true);
            if (!this.speaking) this.update({ state: 'LIVE_LISTENING' });
          }
          if (!speech && this.speech) { this.speechEndedAt = performance.now(); this.measuredResponse = false; if (!this.speaking) this.update({ state: 'LIVE_THINKING' }); }
          this.speech = speech; this.update({ audioLevel: Math.max(0, Math.min(1, level)) }); this.provider?.sendAudio(pcm);
        } catch { this.fail('Le flux Gemini est indisponible. Vous pouvez reprendre en mode LOCAL.'); }
      }, (playing, level) => {
        if (generation !== this.generation || operation.signal.aborted) return;
        this.speaking = playing;
        if (playing && !this.suppressed) this.update({ state: 'LIVE_SPEAKING', audioLevel: level });
        else if (!playing && this.current.state === 'LIVE_SPEAKING') this.update({ state: 'LIVE_LISTENING', audioLevel: 0 });
      }, message => { if (generation === this.generation) this.fail(message); }, operation.signal);
      if (generation !== this.generation || operation.signal.aborted) return { ok: false, error: this.current.error ?? 'Session LIVE annulée.' };
      const source = this.ports.audio.source ?? 'microphone';
      this.update({ source, microphoneActive: source === 'microphone', state: 'LIVE_LISTENING' }); return { ok: true };
    } catch (error) {
      if (generation !== this.generation || operation.signal.aborted) return { ok: false, error: this.current.error ?? 'Session LIVE annulée.' };
      if (reconnect) this.metric('reconnection-error', started, false);
      this.fail(error instanceof LiveAudioError ? error.message : 'Connexion ou audio Gemini indisponible. Vérifiez la clé, le modèle, Internet et le périphérique audio. Le mode LOCAL reste disponible.');
      return { ok: false, error: this.current.error! };
    }
  }
  private receive(event: LiveProviderEvent, generation: number): void {
    try {
      if (event.type === 'transport-open') this.metric('transport-open',performance.now());
      else if (event.type === 'audio') {
        if (this.suppressed) return;
        this.serverTurnComplete = false;
        if (!this.measuredResponse && this.speechEndedAt !== null) { this.metric('first-audio', this.speechEndedAt); this.measuredResponse = true; }
        this.flush('user'); this.ports.audio.play(event.pcm, event.rate);
      } else if (event.type === 'transcript') {
        this.transcripts[event.role] = (this.transcripts[event.role] + event.text).slice(0, 20000);
        if (event.finished) this.flush(event.role);
      } else if (event.type === 'interrupted') { if (!this.suppressed) this.interrupt(); this.suppressed = false; this.flush('assistant'); }
      else if (event.type === 'turn-complete') { this.flush('user'); this.flush('assistant'); this.serverTurnComplete = true; this.suppressed = false; if (!this.speaking) this.update({ state: 'LIVE_LISTENING' }); }
      else if (event.type === 'tool-calls') { this.serverTurnComplete = false; this.flush('user'); for (const call of event.calls) void this.tool(call, generation); }
      else if (event.type === 'tool-cancelled') { for (const id of event.ids) this.calls.get(id)?.abort(); }
      else if (event.type === 'error' || event.type === 'closed') this.fail(event.type === 'error' ? event.message : event.reason);
    } catch { this.fail('Réponse LIVE invalide ou sortie audio indisponible. Le mode LOCAL reste disponible.'); }
  }
  private async tool(call: LiveToolCall, generation: number): Promise<void> {
    if (this.seenCalls.has(call.id)) return; // Never replay mutations after a duplicate server event.
    if (this.seenCalls.size >= 500 || this.calls.size >= 8) { this.fail('Limite d’appels LIVE atteinte. Ouvrez une nouvelle session.'); return; }
    this.seenCalls.add(call.id);
    const operation = new AbortController(), parent = this.operation;
    if (!parent) return;
    const abort = () => operation.abort(); parent.signal.addEventListener('abort', abort, { once: true });
    this.calls.set(call.id, operation); const started = performance.now(), deep = call.name === 'delegate_deep_reasoning';
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; operation.abort(); }, deep ? 120000 : 20000);
    let cancel: () => void = () => {};
    const cancellation = new Promise<never>((_ok, no) => { cancel = () => no(new Error('Appel LIVE annulé.')); operation.signal.addEventListener('abort', cancel, { once:true }); });
    this.update({ state: deep ? 'LIVE_DEEP_THINKING' : 'LIVE_THINKING' });
    try {
      const result: LiveToolResult = await Promise.race([this.ports.bridge.call(call, operation.signal), cancellation]);
      if (generation !== this.generation || operation.signal.aborted) return;
      this.update({ audit: [...this.current.audit, { id: call.id, tool: call.name.slice(0, 80), status: result.status, durationMs: performance.now() - started, at: new Date().toISOString() }].slice(-100) });
      this.metric('tool', started, result.status !== 'error' && result.status !== 'denied', call.name);
      if (deep) this.metric('deep', started, result.status === 'ok', call.name);
      this.provider?.sendToolResult(call, result);
    } catch {
      if (generation === this.generation && timedOut) {
        this.metric('tool',started,false,call.name); if(deep)this.metric('deep',started,false,call.name);
        this.update({audit:[...this.current.audit,{id:call.id,tool:call.name.slice(0,80),status:'timeout',durationMs:performance.now()-started,at:new Date().toISOString()}].slice(-100)});
        try { this.provider?.sendToolResult(call,{status:'error',reason:'Délai de la fonction AETHER dépassé. Aucun résultat inventé.'}); } catch { this.fail('Connexion LIVE interrompue.'); }
      } else if (generation === this.generation && !operation.signal.aborted) this.fail('L’échange d’outils Gemini est interrompu.');
    }
    finally {
      clearTimeout(timeout); operation.signal.removeEventListener('abort',cancel); parent.signal.removeEventListener('abort', abort); this.calls.delete(call.id);
      if (generation === this.generation && this.active() && !this.calls.size && !this.speaking) this.update({ state: 'LIVE_LISTENING' });
    }
  }
  private flush(role: 'user' | 'assistant'): void { const text = this.transcripts[role].trim(); this.transcripts[role] = ''; if (text) this.ports.transcript(role, text, this.current.settings.model); }
  interrupt(): void { const started = performance.now(); this.suppressed = !this.serverTurnComplete; this.ports.audio.interrupt(); this.speaking = false; for (const call of this.calls.values()) call.abort(); this.update({ state: 'LIVE_INTERRUPTED', audioLevel: 0 }); this.metric('interruption', started); }
  respond(): void { if (this.active() && !this.current.settings.automaticResponse) this.provider?.respond(); }
  async reconnect(): Promise<OperationResult> { this.stop(); return this.start(true); }
  private fail(message: string): void { this.stop(); this.update({ state: 'LIVE_ERROR', error: message }); }
  stop(): void {
    this.generation++; this.operation?.abort(); this.operation = null;
    this.provider?.close(); this.provider = null; this.ports.audio.close();
    for (const call of this.calls.values()) call.abort(); this.calls.clear(); this.speaking = false; this.transcripts = { user: '', assistant: '' };
    this.update({ state: 'idle', sessionId: null, source: null, microphoneActive: false, audioLevel: 0, error: null, pending: [] });
  }
  close(): void { this.stop(); }
}
