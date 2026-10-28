import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { AetherToolBridge, curiosityProjection, LiveConversationEngine, memoryProjection, parseLiveWrite } from '@aether/live';
import type { CuriositySnapshot, EchoSnapshot, LiveAudioPort, LiveConfirmation, LiveSettings, LiveToolResult, OperationResult, PresenceSnapshot, VoiceSettings } from '@aether/shared';
import type { DesktopMindService } from './mind-service';
import { SafeSecretVault } from './ai-storage';
import { LiveSettingsStore } from './live-storage';
import { GeminiLiveProcessProvider } from './gemini-live-process';
import { PortAudioLiveDuplex } from './live-audio';

const short = (text: string, limit = 500) => text.slice(0, limit);
export class DesktopLiveService {
  readonly engine: LiveConversationEngine;
  readonly store: LiveSettingsStore;
  private readonly vault: SafeSecretVault;
  private settings: LiveSettings;
  private confirmations = new Map<string, { view: LiveConfirmation; argument: string; expires: number }>();
  constructor(root: string, private readonly mind: DesktopMindService, private readonly ports: {
    voiceSettings(): VoiceSettings; presence(): PresenceSnapshot; curiosity(): CuriositySnapshot | null; echo(): EchoSnapshot | null;
    openSpace(): Promise<void>; closeSpace(): void; prepareEcho(): Promise<void>; stopEcho(): Promise<void>;
    removeMemory(id: string): Promise<OperationResult>; changedMemory(): void; confirmation(): Promise<void>;
    prepareForge?(description:string):Promise<void>;
  }, fixtureFolder?: string, audioPort?: LiveAudioPort) {
    this.store = new LiveSettingsStore(join(root, 'live-settings.json')); this.settings = this.store.load();
    this.vault = new SafeSecretVault(join(root, 'gemini-key.encrypted'), 'GEMINI_API_KEY');
    const bridge = new AetherToolBridge({ allowed: () => this.engine?.active() && this.settings.enabled && this.settings.cloudConsent === 'granted', invoke: (name, args, signal) => this.invoke(name, args, signal) });
    this.engine = new LiveConversationEngine(this.settings, {
      provider: () => new GeminiLiveProcessProvider(() => this.vault.getKey()), audio: audioPort ?? new PortAudioLiveDuplex(ports.voiceSettings, fixtureFolder), bridge,
      configured: () => ({ keyConfigured: this.vault.hasKey(), secureStorageAvailable: this.vault.available(), microphoneConsent: ports.voiceSettings().microphoneConsent === 'granted' }),
      transcript: (role, text, model) => this.mind.engine.appendLiveMessage(role, text, model),
    });
    this.engine.events.on('changed', snapshot => { if (snapshot.state === 'idle' || snapshot.state === 'LIVE_ERROR') this.confirmations.clear(); });
    this.mind.liveRoute = () => ({ provider: 'gemini', model: this.settings.model, enabled: this.settings.enabled, cloudConsent: this.settings.cloudConsent === 'granted', keyConfigured: this.vault.hasKey() });
  }
  configuration(): LiveSettings { return structuredClone(this.settings); }
  save(value: unknown): void {
    const input = parseLiveWrite(value), { apiKey, removeKey, ...write } = input;
    const previous = this.vault.encryptedSnapshot();
    try {
      if (apiKey) this.vault.setKey(apiKey); if (removeKey) this.vault.removeKey();
      const next: LiveSettings = { ...write, schemaVersion: 1, provider: 'gemini', cloudConsent: this.settings.cloudConsent };
      this.store.save(next); this.settings = next; this.confirmations.clear(); this.engine.configure(next);
    } catch (error) { if (apiKey || removeKey) this.vault.restoreEncrypted(previous); throw error; }
  }
  consent(decision: 'grant' | 'deny'): void {
    // Revocation stops the network/audio before touching disk, even if saving fails.
    if (decision === 'deny') this.engine.stop();
    const next: LiveSettings = { ...this.settings, cloudConsent: decision === 'grant' ? 'granted' : 'denied' };
    this.settings = next; this.confirmations.clear(); this.engine.configure(next); this.store.save(next);
  }
  private async proposal(tool: LiveConfirmation['tool'], argument: string, signal: AbortSignal): Promise<LiveToolResult> {
    if (this.confirmations.size >= 5) return { status: 'denied', reason: 'Trop de confirmations en attente.' };
    const id = randomUUID();
    const content = tool === 'forget_memory' ? (await this.mind.memory.list()).find(item => item.id === argument)?.content : argument;
    if (!content) return { status: 'error', reason: 'Souvenir inexistant.' };
    if(signal.aborted||!this.engine.active())return {status:'denied'};
    this.confirmations.set(id, { view: { id, tool, content: short(content, 4000) }, argument, expires: Date.now() + 120000 });
    this.engine.pending([...this.confirmations.values()].map(item => item.view)); await this.ports.confirmation();
    return { status: 'confirmation_required', confirmationId: id, instruction: 'La décision doit être donnée par l’utilisateur dans LIVE VOICE. Ne pas annoncer une réussite.' };
  }
  async confirm(id: string, approved: boolean): Promise<OperationResult> {
    const pending = this.confirmations.get(id); this.confirmations.delete(id); this.engine.pending([...this.confirmations.values()].map(item => item.view));
    if (!pending || pending.expires < Date.now() || !this.engine.active() || this.settings.cloudConsent !== 'granted') return { ok: false, error: 'Confirmation expirée ou session arrêtée.' };
    if (!approved) return { ok: true };
    // Both are actual local human actions. Forget must invalidate all provider context.
    if (pending.view.tool === 'forget_memory') { this.engine.stop(); return this.ports.removeMemory(pending.argument); }
    await this.mind.memory.create({ content: pending.argument, category: 'knowledge', origin: 'explicit', confidence: null, source: 'demande explicite confirmée par l’utilisateur dans LIVE VOICE' });
    this.ports.changedMemory(); return { ok: true };
  }
  private async invoke(name: string, args: Record<string, string>, signal: AbortSignal): Promise<LiveToolResult> {
    if (signal.aborted) return { status: 'denied' };
    const c = this.ports.curiosity();
    switch (name) {
      case 'get_entity_status': { const presence = this.ports.presence(), e = this.ports.echo(); return { status: 'ok', state: presence.state, capabilities: presence.features, autonomy: c?.settings.enabled ?? false, echo: e ? { state: e.state, active: e.activeSessionId !== null } : null, curiosity: c ? { state: c.state, interests: c.interests.length } : null }; }
      case 'search_memory': return { status: 'ok', memories: memoryProjection(await this.mind.memory.search(args.query!)), truncated: true };
      case 'remember_explicitly': return this.proposal('remember_explicitly', args.content!,signal);
      case 'forget_memory': return this.proposal('forget_memory', args.id!,signal);
      case 'get_curiosity_summary': return c ? { status: 'ok', ...curiosityProjection(c) } : { status: 'error', reason: 'CURIOSITY indisponible.' };
      case 'get_interest_details': { const i = c?.interests.find(i => i.id === args.id); return i && c ? { status: 'ok', interest: { id: i.id, title: short(i.title, 120), description: short(i.description), status: i.status }, history: c.history.filter(h => h.interestId === i.id).slice(-6).map(h => ({ at: h.createdAt, action: h.action, reason: short(h.reason) })), items: c.items.filter(item => item.interestId === i.id).slice(-8).map(item => ({ kind: item.kind, content: short(item.content, 700), confidence: item.confidence, limits: item.limits ? short(item.limits, 200) : null })), explorations: c.explorations.filter(e => e.interestId === i.id).slice(-4).map(e => ({ status: e.status, reason: short(e.reason), model: e.model, nextQuestion: e.nextQuestion ? short(e.nextQuestion) : null })) } : { status: 'error', reason: 'Intérêt introuvable.' }; }
      case 'open_space': await this.ports.openSpace(); if(signal.aborted){this.ports.closeSpace();return {status:'denied'};} return { status: 'ok', opened: true };
      case 'close_space': this.ports.closeSpace(); return { status: 'ok', closing: true };
      case 'start_echo_guided': await this.ports.prepareEcho(); return { status: 'consent_required', instruction: 'ECHO attend son consentement et le dossier choisi dans son panneau. Aucune observation démarrée.' };
      case 'stop_echo': await this.ports.stopEcho(); return { status: 'ok', stopped: true };
      case 'delegate_deep_reasoning': return { status: 'ok', ...await this.mind.delegateDeepReasoning(args.prompt!, signal) };
      case 'prepare_forge_request': if(!this.ports.prepareForge)return {status:'error',reason:'FORGE indisponible.'};await this.ports.prepareForge(args.description!);return {status:'confirmation_required',instruction:'Demande proposée dans FORGE. L’utilisateur doit préparer puis approuver la spécification avant tout appel Codex. Aucune fabrication lancée.'};
      default: return { status: 'denied' };
    }
  }
  close(): void { this.confirmations.clear(); this.engine.close(); }
}
