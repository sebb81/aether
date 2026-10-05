import type { LlmProvider, ModelProfile, ModelRoute, ModelRouterPort, ModelTarget, RouterConfiguration, RouterOverrides } from '@aether/shared';
import { ProviderError } from './providers';

export function parseRouterOverrides(value: unknown): RouterOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Profils IA invalides.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['DEEP', 'VISION'].includes(key))) throw new Error('Profil IA non autorisé. FAST se configure dans MIND.');
  function target(value: unknown): ModelTarget | null {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Cible du profil invalide.');
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some(key => !['provider', 'model'].includes(key)) || !['ollama', 'openai'].includes(String(data.provider)) || typeof data.model !== 'string' || !/^[a-zA-Z0-9_./:-]{1,120}$/.test(data.model)) throw new Error('Fournisseur ou modèle du profil invalide.');
    return { provider: data.provider as ModelTarget['provider'], model: data.model };
  }
  return { DEEP: target(input.DEEP), VISION: target(input.VISION) };
}

export class ModelRouter implements ModelRouterPort {
  constructor(private readonly configuration: () => RouterConfiguration, private readonly factory: (target: ModelTarget) => Promise<LlmProvider>) {}
  resolve(profile: ModelProfile, options: { localOnly?: boolean } = {}): ModelRoute {
    if (!['FAST', 'DEEP', 'VISION'].includes(profile)) throw new ProviderError('not-configured', 'Profil de capacité inconnu.');
    if (profile === 'VISION') throw new ProviderError('not-configured', 'VISION est réservé aux futures capacités d’ECHO, non implémentées.');
    const configuration = this.configuration();
    const selected = profile === 'DEEP' && configuration.DEEP ? 'DEEP' : 'FAST';
    const target = configuration[selected];
    if (!target) throw new ProviderError('not-configured', 'Aucune IA n’est configurée. Choisissez un fournisseur et un modèle dans les réglages.');
    if (target.provider === 'openai' && !configuration.cloudConsent) throw new ProviderError('not-configured', 'L’envoi de messages et de souvenirs pertinents à OpenAI n’est pas autorisé. Activez le consentement cloud dans les réglages.');
    if (options.localOnly && target.provider !== 'ollama') throw new ProviderError('not-configured', 'CURIOSITY exige un profil local au jalon 3. Choisissez Ollama pour DEEP ou FAST. Aucun basculement cloud n’a eu lieu.');
    return { requested: profile, selected, provider: target.provider, model: target.model, fallback: selected !== profile };
  }
  async provider(profile: ModelProfile, options: { localOnly?: boolean } = {}): Promise<LlmProvider> {
    const route = this.resolve(profile, options);
    return this.factory({ provider: route.provider as ModelTarget['provider'], model: route.model });
  }
  async complete(profile: ModelProfile, request: Parameters<LlmProvider['complete']>[0], options: { localOnly?: boolean } = {}) {
    const route = this.resolve(profile, options);
    const provider = await this.factory({ provider: route.provider as ModelTarget['provider'], model: route.model });
    const answer = await provider.complete(request);
    return { ...answer, route };
  }
}
