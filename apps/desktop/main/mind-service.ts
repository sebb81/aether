import { dialog } from 'electron';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { SqliteMemoryRepository, parseMemoryWrite } from '@aether/memory';
import { discoverOllama, MindEngine, ModelRouter, OllamaProvider, OpenAIProvider, parseAiInput, parseRouterOverrides, ProviderError } from '@aether/mind';
import type { AiConfiguration, AiConfigurationView, OperationResult, RouterConfiguration, RouterOverrides } from '@aether/shared';
import { AiConfigurationStore, RouterOverridesStore, SafeSecretVault } from './ai-storage';

export class DesktopMindService {
  readonly memory: SqliteMemoryRepository;
  readonly engine: MindEngine;
  readonly router: ModelRouter;
  curiosityContext: () => string = () => 'CURIOSITY indisponible dans cette session.';
  private readonly configurationStore: AiConfigurationStore;
  private readonly vault: SafeSecretVault;
  private configuration: AiConfiguration;
  private readonly routerStore: RouterOverridesStore;
  private profiles: RouterOverrides;
  constructor(folder: string) {
    this.configurationStore = new AiConfigurationStore(join(folder, 'ai-settings.json'));
    this.vault = new SafeSecretVault(join(folder, 'openai-key.encrypted'));
    const loaded = this.configurationStore.load(); this.configuration = loaded.configuration;
    this.routerStore=new RouterOverridesStore(join(folder,'router-settings.json')); this.profiles=this.routerStore.load();
    this.memory = new SqliteMemoryRepository(join(folder, 'memory.sqlite'));
    this.router = new ModelRouter(()=>this.routerView(),async target => {
      const configuration = this.configuration;
      if (target.provider === 'ollama') return new OllamaProvider(target.model, configuration.ollamaUrl);
      if (!configuration.cloudConsent) throw new ProviderError('not-configured', 'L’envoi de messages et de souvenirs pertinents à OpenAI n’est pas autorisé. Activez le consentement cloud dans les réglages.');
      let key: string | null;
      try { key = this.vault.getKey(); }
      catch (error) { throw new ProviderError('not-configured', error instanceof Error ? error.message : 'La clé chiffrée est inaccessible. Vérifiez les réglages.'); }
      if (!key) throw new ProviderError('not-configured', 'Aucune clé OpenAI n’est configurée. Saisissez-la dans les réglages, ou choisissez Ollama local.');
      return new OpenAIProvider(target.model, key);
    });
    this.engine=new MindEngine(()=>this.router.provider('FAST'),this.memory,()=>this.curiosityContext());
    if (loaded.notice || this.routerStore.notice) this.engine.reset(loaded.notice ?? this.routerStore.notice!);
  }
  view(): AiConfigurationView { return { ...this.configuration, keyConfigured: this.vault.hasKey(), secureStorageAvailable: this.vault.available() }; }
  routerView(): RouterConfiguration { return { ...structuredClone(this.profiles),FAST:this.configuration.provider==='disabled'?null:{provider:this.configuration.provider,model:this.configuration.model},cloudConsent:this.configuration.cloudConsent }; }
  saveRouter(value: unknown): OperationResult { const profiles=parseRouterOverrides(value); this.routerStore.save(profiles); this.profiles=profiles; this.engine.reset('Profils IA modifiés. Nouvelle conversation.'); return {ok:true}; }
  saveConfiguration(payload: unknown): OperationResult {
    const input = parseAiInput(payload);
    const encrypted = this.vault.encryptedSnapshot();
    try {
      if (input.apiKey) this.vault.setKey(input.apiKey);
      if (input.removeKey) this.vault.removeKey();
      const next: AiConfiguration = { schemaVersion: 1, provider: input.provider, model: input.model, ollamaUrl: input.ollamaUrl, cloudConsent: input.cloudConsent };
      this.configurationStore.save(next);
      this.configuration = next; this.engine.reset('Configuration IA modifiée. Nouvelle conversation.');
      return { ok: true };
    } catch (error) { if (input.apiKey || input.removeKey) this.vault.restoreEncrypted(encrypted); throw error; }
  }
  async models(baseUrl: string) { return discoverOllama(baseUrl); }
  async writeMemory(payload: unknown): Promise<OperationResult> {
    const input = parseMemoryWrite(payload);
    this.engine.reset('MEMORY a changé : le contexte de conversation a été effacé pour utiliser uniquement les souvenirs actuels.');
    const draft = { content: input.content, category: input.category, origin: input.origin, confidence: input.confidence, source: input.id ? 'correction par l’utilisateur dans MEMORY' : 'ajout par l’utilisateur dans MEMORY' };
    if (input.id) await this.memory.update(input.id, draft); else await this.memory.create(draft);
    return { ok: true };
  }
  async removeMemory(id: string): Promise<OperationResult> {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identifiant de souvenir invalide.');
    this.engine.reset('Modification de MEMORY : le contexte de conversation a été effacé.');
    await this.memory.remove(id);
    this.engine.reset('Souvenir supprimé : le contexte de conversation a été effacé.');
    return { ok: true };
  }
  async exportMemories(): Promise<OperationResult> {
    const result = await dialog.showSaveDialog({ title: 'Exporter MEMORY', defaultPath: 'AETHER-memory.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { ok: true };
    const memories = await this.memory.export();
    writeFileSync(result.filePath, `${JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), memories }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return { ok: true };
  }
  close() { this.engine.reset(); this.memory.close(); }
}
