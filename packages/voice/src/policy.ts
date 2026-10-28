import { isShortcut } from '@aether/core';
import type { InputModality, VoiceSettings, VoiceSettingsWrite } from '@aether/shared';

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  schemaVersion: 1, enabled: false, microphoneConsent: 'prompt', microphone: 'default', language: 'fr-FR', shortcut: 'Control+Alt+V',
  sttProvider: 'faster-whisper', ttsProvider: 'windows-speech', ttsEnabled: true, voice: 'Microsoft Hortense Desktop', speed: .95, volume: .65,
  responsePolicy: 'voice-only', diagnostics: false, retainDiagnosticAudio: false, wakeWordEnabled: false, pythonPath: 'python', modelPath: '',
};
export function parseVoiceWrite(input: unknown): VoiceSettingsWrite {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Réglages VOICE invalides.');
  const v = input as Record<string, unknown>;
  const { schemaVersion: _schema, microphoneConsent: _consent, ...defaults } = DEFAULT_VOICE_SETTINGS;
  if (Object.keys(v).some(k => !(k in defaults)) || Object.keys(defaults).some(k => !(k in v))) throw new Error('Champ VOICE manquant ou non autorisé.');
  for (const k of ['enabled', 'ttsEnabled', 'diagnostics', 'retainDiagnosticAudio']) if (typeof v[k] !== 'boolean') throw new Error('Option VOICE invalide.');
  for (const k of ['microphone', 'language', 'shortcut', 'voice', 'pythonPath', 'modelPath']) if (typeof v[k] !== 'string' || (v[k] as string).length > 500 || /[\r\n\0]/.test(v[k] as string)) throw new Error('Texte VOICE invalide.');
  if (!v.microphone || !isShortcut(v.shortcut) || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(String(v.language))) throw new Error('Microphone, langue ou raccourci invalide.');
  if (!['faster-whisper', 'disabled'].includes(String(v.sttProvider)) || !['windows-speech', 'disabled'].includes(String(v.ttsProvider)) || !['always', 'voice-only', 'never'].includes(String(v.responsePolicy))) throw new Error('Fournisseur ou politique VOICE indisponible.');
  if (v.wakeWordEnabled !== false) throw new Error('Wake word non implémenté : aucune écoute de fond autorisée.');
  if (typeof v.speed !== 'number' || !Number.isFinite(v.speed) || v.speed < .6 || v.speed > 1.6 || typeof v.volume !== 'number' || !Number.isFinite(v.volume) || v.volume < 0 || v.volume > 1) throw new Error('Vitesse ou volume invalide.');
  if (v.retainDiagnosticAudio && !v.diagnostics) throw new Error('La conservation d’extraits exige le mode diagnostic explicite.');
  return structuredClone(v) as unknown as VoiceSettingsWrite;
}
export function shouldSpeak(settings: VoiceSettings, source: InputModality): boolean { return settings.enabled && settings.ttsEnabled && settings.responsePolicy !== 'never' && (settings.responsePolicy === 'always' || source === 'voice'); }
export function spokenText(full: string, proposed?: string): string {
  const clean = (s: string) => s.replace(/```[\s\S]*?```/g, '').replace(/https?:\/\/\S+/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#_`>]/g, '').replace(/\s+/g, ' ').trim();
  const text = clean(proposed?.trim() || full);
  if (text.length <= 500) return text;
  const first = text.slice(0, 420), cut = Math.max(first.lastIndexOf('. '), first.lastIndexOf('? '), first.lastIndexOf('! '));
  return `${cut > 50 ? first.slice(0, cut + 1) : first.slice(0, first.lastIndexOf(' ')) + '…'} Les détails sont affichés dans l’échange.`;
}
