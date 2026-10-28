import { ActivityHandling, GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import type { LiveConversationProvider, LiveProviderEvent, LiveSettings, LiveToolCall, LiveToolDeclaration, LiveToolResult } from '@aether/shared';

// Only this adapter imports Google. No API key, SDK error, URL or audio is logged.
export class GeminiLiveProvider implements LiveConversationProvider {
  readonly id = 'gemini';
  private session: Session | null = null;
  private generation = 0;
  private manualActivity = false;
  constructor(private readonly key: () => string | null, private readonly client: (key: string) => Pick<GoogleGenAI, 'live'> = key => new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } })) {}
  async open(input: { settings: LiveSettings; instructions: string; tools: LiveToolDeclaration[] }, event: (event: LiveProviderEvent) => void, signal: AbortSignal): Promise<void> {
    this.close(); const generation = ++this.generation, key = this.key();
    if (!key || signal.aborted) throw new Error('Gemini Live non configuré ou connexion annulée.');
    const ai = this.client(key);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abort: () => void = () => {};
    const cancellation = new Promise<never>((_resolve, reject) => {
      abort = () => { this.close(); reject(new Error('Connexion LIVE annulée.')); };
      signal.addEventListener('abort', abort, { once: true });
      timeout = setTimeout(() => { this.close(); reject(new Error('Délai de connexion LIVE dépassé.')); }, 15000);
    });
    const connection = ai.live.connect({ model: input.settings.model, config: {
      responseModalities: [Modality.AUDIO], systemInstruction: input.instructions,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: input.settings.voice } } },
      inputAudioTranscription: {}, outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { disabled: !input.settings.automaticResponse }, activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS },
      contextWindowCompression: { slidingWindow: {} },
      tools: [{ functionDeclarations: input.tools.map(tool => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters })) }],
    }, callbacks: {
      onopen: () => { if (generation === this.generation && !signal.aborted) event({type:'transport-open'}); },
      onmessage: (message: LiveServerMessage) => { if (generation === this.generation && !signal.aborted) this.message(message, event); },
      onerror: () => { if (generation === this.generation && !signal.aborted) event({ type: 'error', message: 'Gemini Live a rencontré une erreur de connexion. Le mode LOCAL reste disponible.' }); },
      onclose: close => {
        if (generation !== this.generation || signal.aborted) return;
        const reason = close.reason ?? '';
        const message = /api.?key|authentication|unauthenticated/i.test(reason) ? 'Clé Gemini refusée. Vérifiez la clé et son accès au fournisseur.' : /quota|resource.exhausted/i.test(reason) ? 'Quota Gemini indisponible. Vérifiez le quota du compte.' : /model|not.found/i.test(reason) ? 'Modèle LIVE refusé ou indisponible pour ce compte. Vérifiez son nom dans les réglages.' : 'Session Gemini Live fermée. Vous pouvez reconnecter LIVE ou choisir LOCAL.';
        event({ type: 'closed', reason: message });
      },
    } });
    // A connection resolving after cancellation must never retain an open socket.
    void connection.then(session => { if (generation !== this.generation || signal.aborted) session.close(); }, () => {});
    try {
      const session = await Promise.race([connection, cancellation]);
      if (generation !== this.generation || signal.aborted) { session.close(); throw new Error('Connexion annulée.'); }
      this.session = session;
    } catch { throw new Error('Gemini Live indisponible. Vérifiez clé, modèle, quota et Internet.'); }
    finally { if (timeout) clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  }
  private message(message: LiveServerMessage, event: (event: LiveProviderEvent) => void): void {
    try {
      const content = message.serverContent;
      if (content?.interrupted) event({ type: 'interrupted' });
      for (const part of content?.modelTurn?.parts ?? []) {
        if (content?.interrupted) continue;
        if (part.inlineData?.data) {
          const encoded = part.inlineData.data, mime = part.inlineData.mimeType ?? '';
          if (encoded.length > 700000 || !/^audio\/pcm(?:;rate=24000)?$/.test(mime) || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('Invalid PCM');
          const pcm = Buffer.from(encoded, 'base64');
          if (!pcm.length || pcm.length % 2) throw new Error('Invalid PCM');
          event({ type: 'audio', pcm, rate: 24000 });
        }
      }
      for (const [role, transcript] of [['user', content?.inputTranscription], ['assistant', content?.outputTranscription]] as const) if (transcript?.text) event({ type: 'transcript', role, text: transcript.text.slice(0, 20000), finished: transcript.finished === true });
      if (message.toolCall?.functionCalls) event({ type: 'tool-calls', calls: message.toolCall.functionCalls.map(call => ({ id: call.id ?? '', name: call.name ?? '', args: call.args ?? {} })) });
      if (message.toolCallCancellation?.ids) event({ type: 'tool-cancelled', ids: message.toolCallCancellation.ids });
      if (content?.turnComplete) event({ type: 'turn-complete' });
      if (message.goAway) event({ type: 'closed', reason: 'Gemini demande de fermer cette session. Reconnectez LIVE pour poursuivre une nouvelle session.' });
    } catch { event({ type: 'error', message: 'Réponse Gemini Live invalide. Le flux audio a été arrêté.' }); }
  }
  private requireSession(): Session { if (!this.session) throw new Error('Session LIVE fermée.'); return this.session; }
  sendAudio(pcm: Uint8Array): void {
    if (!pcm.length || pcm.length > 64000 || pcm.length % 2) throw new Error('Trame microphone invalide.');
    this.requireSession().sendRealtimeInput({ audio: { data: Buffer.from(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
  }
  activity(start: boolean): void {
    if (start && !this.manualActivity) { this.requireSession().sendRealtimeInput({ activityStart: {} }); this.manualActivity = true; }
    else if (!start && this.manualActivity) { this.requireSession().sendRealtimeInput({ activityEnd: {} }); this.manualActivity = false; }
  }
  respond(): void { this.activity(false); }
  sendToolResult(call: LiveToolCall, result: LiveToolResult): void { this.requireSession().sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: result }] }); }
  close(): void { this.generation++; const session = this.session; this.session = null; this.manualActivity = false; try { session?.close(); } catch { /* Already disconnected. */ } }
}
