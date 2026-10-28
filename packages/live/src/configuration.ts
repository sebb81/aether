import type { LiveSettings, LiveSettingsWrite } from '@aether/shared';

// The model name lives only here. Availability is checked by the real provider, never simulated.
export const DEFAULT_LIVE_SETTINGS: Readonly<LiveSettings> = Object.freeze({ schemaVersion: 1, provider: 'gemini', model: 'gemini-3.8-live', voice: 'Kore', cloudConsent: 'prompt', enabled: false, defaultMode: 'LOCAL', showTranscription: true, automaticResponse: true, diagnostics: 'off' });
export function parseLiveWrite(value: unknown): LiveSettingsWrite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Réglages LIVE invalides.');
  const v = value as Record<string, unknown>;
  const fields = ['enabled','model','voice','defaultMode','showTranscription','automaticResponse','diagnostics','apiKey','removeKey'];
  if (Object.keys(v).some(k => !fields.includes(k)) || typeof v.enabled !== 'boolean' || typeof v.showTranscription !== 'boolean' || typeof v.automaticResponse !== 'boolean' || typeof v.model !== 'string' || !/^[\w./:-]{1,120}$/.test(v.model) || typeof v.voice !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(v.voice) || !['LOCAL','LIVE','ASK'].includes(String(v.defaultMode)) || !['off','basic','detailed'].includes(String(v.diagnostics))) throw new Error('Fournisseur, modèle ou réglages LIVE invalides.');
  if (v.apiKey !== undefined && (typeof v.apiKey !== 'string' || v.apiKey.length < 10 || v.apiKey.length > 500 || /\s/.test(v.apiKey))) throw new Error('Clé Gemini invalide.');
  if (v.removeKey !== undefined && typeof v.removeKey !== 'boolean' || v.apiKey && v.removeKey) throw new Error('Modification de clé invalide.');
  return { enabled: v.enabled, model: v.model, voice: v.voice, defaultMode: v.defaultMode as LiveSettings['defaultMode'], showTranscription: v.showTranscription, automaticResponse: v.automaticResponse, diagnostics: v.diagnostics as LiveSettings['diagnostics'], ...(v.apiKey ? { apiKey: v.apiKey as string } : {}), ...(v.removeKey !== undefined ? { removeKey: v.removeKey as boolean } : {}) };
}
