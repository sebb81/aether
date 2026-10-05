import type { AiConfiguration, AiConfigurationInput } from '@aether/shared';

export const DEFAULT_AI_CONFIGURATION: Readonly<AiConfiguration> = Object.freeze({ schemaVersion: 1, provider: 'disabled', model: '', ollamaUrl: 'http://127.0.0.1:11434', cloudConsent: false });
export function localOllamaUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200) throw new Error('Adresse Ollama invalide.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Adresse Ollama invalide.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['', '/'].includes(url.pathname) || url.username || url.password || url.search || url.hash) throw new Error('Ollama doit utiliser une adresse HTTP locale (127.0.0.1, localhost ou ::1), sans identifiant ni chemin.');
  return url.origin;
}
export function parseAiConfiguration(value: unknown): AiConfiguration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Configuration IA invalide.');
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1 || !['disabled', 'openai', 'ollama'].includes(String(input.provider)) || typeof input.model !== 'string' || (input.model && !/^[a-zA-Z0-9_./:-]{1,120}$/.test(input.model)) || typeof input.cloudConsent !== 'boolean') throw new Error('Fournisseur ou modèle invalide.');
  if (input.provider !== 'disabled' && !input.model) throw new Error('Choisissez un modèle avant d’activer le fournisseur.');
  return { schemaVersion: 1, provider: input.provider as AiConfiguration['provider'], model: input.model, cloudConsent: input.cloudConsent, ollamaUrl: localOllamaUrl(input.ollamaUrl) };
}
export function parseAiInput(value: unknown): AiConfigurationInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Configuration IA invalide.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['provider', 'model', 'ollamaUrl', 'cloudConsent', 'apiKey', 'removeKey'].includes(key))) throw new Error('Champ de configuration IA non autorisé.');
  const { schemaVersion: _version, ...configuration } = parseAiConfiguration({ ...input, schemaVersion: 1 });
  if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 500 || /\s/.test(input.apiKey))) throw new Error('Clé API invalide.');
  if (input.removeKey !== undefined && typeof input.removeKey !== 'boolean') throw new Error('Commande de suppression de clé invalide.');
  if (input.apiKey && input.removeKey) throw new Error('Ajout et suppression de clé ne peuvent pas être demandés simultanément.');
  return { ...configuration, ...(input.apiKey ? { apiKey: input.apiKey as string } : {}), ...(input.removeKey !== undefined ? { removeKey: input.removeKey as boolean } : {}) };
}
