import OpenAI from 'openai';
import type { LlmProvider } from '@aether/shared';
import { localOllamaUrl } from './configuration';

export class ProviderError extends Error {
  constructor(readonly code: 'not-configured' | 'authentication' | 'unavailable' | 'timeout' | 'cancelled' | 'empty-response', message: string) { super(message); this.name = 'ProviderError'; }
}
export function providerFailure(error: unknown, signal?: AbortSignal): ProviderError {
  if (signal?.aborted) return new ProviderError('cancelled', 'La demande a été annulée.');
  if (error instanceof ProviderError) return error;
  const status = error instanceof OpenAI.APIError ? error.status : undefined;
  if (status === 401 || status === 403) return new ProviderError('authentication', 'OpenAI refuse cet accès. Vérifiez votre clé et l’accès au modèle dans les réglages.');
  if (status === 404) return new ProviderError('unavailable', 'Ce modèle OpenAI n’est pas disponible pour cette configuration.');
  if (status === 429) return new ProviderError('unavailable', 'OpenAI a refusé la demande : quota ou limite de requêtes atteint.');
  if (error instanceof Error && /timeout|timedout/i.test(error.name)) return new ProviderError('timeout', 'Le fournisseur n’a pas répondu dans le délai prévu. Réessayez ou annulez la demande.');
  return new ProviderError('unavailable', 'Le fournisseur IA est indisponible. Vérifiez le service, le modèle et votre connexion.');
}
export class OpenAIProvider implements LlmProvider {
  readonly id = 'openai';
  private readonly client: OpenAI;
  constructor(private readonly model: string, apiKey: string, transport?: typeof fetch) {
    this.client = new OpenAI({ apiKey, timeout: 90000, maxRetries: 0, ...(transport ? { fetch: transport } : {}) });
  }
  async complete(request: Parameters<LlmProvider['complete']>[0]) {
    try {
      const response = await this.client.responses.create({ model: this.model, store: false, input: request.messages.map(message => ({ role: message.role, content: message.content })), max_output_tokens: request.maxOutputTokens ?? 1024 }, { signal: request.signal });
      const text = response.output_text?.trim();
      if (!text) throw new ProviderError('empty-response', 'Le modèle n’a renvoyé aucun texte utilisable. Aucune réponse n’a été inventée.');
      return { text, model: response.model };
    } catch (error) { throw providerFailure(error, request.signal); }
  }
}
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';
  private readonly baseUrl: string;
  constructor(private readonly model: string, baseUrl: string, private readonly transport: typeof fetch = fetch) { this.baseUrl = localOllamaUrl(baseUrl); }
  async complete(request: Parameters<LlmProvider['complete']>[0]) {
    const timeout = AbortSignal.timeout(120000);
    const signal = AbortSignal.any([request.signal, timeout]);
    try {
      const response = await this.transport(`${this.baseUrl}/api/chat`, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, messages: request.messages, stream: false, think: false, ...(request.responseFormat === 'json' ? { format: 'json' } : {}), options: { num_predict: request.maxOutputTokens ?? 384, num_ctx: 4096, temperature: 0.2 }, keep_alive: '5m' }), signal });
      if (!response.ok) throw new ProviderError('unavailable', response.status === 404 ? 'Le modèle Ollama sélectionné est absent. Choisissez un modèle installé dans les réglages.' : `Ollama a refusé la demande (HTTP ${response.status}). Vérifiez le service local.`);
      const body = await response.json() as { model?: string; message?: { content?: string }; error?: string };
      if (body.error) throw new ProviderError('unavailable', 'Ollama signale une erreur de génération. Vérifiez le modèle et les ressources disponibles.');
      const text = body.message?.content?.trim();
      if (!text) throw new ProviderError('empty-response', 'Ollama n’a renvoyé aucun texte utilisable. Aucune réponse n’a été inventée.');
      return { text, model: body.model ?? this.model };
    } catch (error) {
      if (timeout.aborted && !request.signal.aborted) throw new ProviderError('timeout', 'Ollama n’a pas répondu en deux minutes. Vous pouvez réessayer ou choisir un modèle plus léger.');
      throw providerFailure(error, request.signal);
    }
  }
}
export async function discoverOllama(baseUrl: string): Promise<string[]> {
  const url = localOllamaUrl(baseUrl);
  try {
    const response = await fetch(`${url}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Unavailable');
    const body = await response.json() as { models?: { name: string; capabilities?: string[] }[] };
    return (body.models ?? []).filter(model => !model.capabilities || model.capabilities.includes('completion')).map(model => model.name).filter(name => /^[a-zA-Z0-9_./:-]{1,120}$/.test(name)).slice(0, 64);
  } catch { throw new ProviderError('unavailable', 'Ollama est inaccessible à cette adresse locale. Démarrez Ollama puis recherchez à nouveau les modèles.'); }
}
