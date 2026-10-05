import type { Preferences, SettingsPatch } from '@aether/shared';

export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  schemaVersion: 1, position: null, visible: true,
  recallShortcut: 'Control+Alt+Space', reducedMotion: false,
});

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function isShortcut(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false;
  const parts = value.split('+');
  const key = parts.pop();
  return Boolean(key && /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/.test(key)
    && parts.length > 0 && new Set(parts).size === parts.length
    && parts.every(part => ['Control', 'CommandOrControl', 'Alt', 'Shift', 'Super'].includes(part))
    && parts.some(part => part !== 'Shift')
    && !(parts.includes('Control') && parts.includes('CommandOrControl')));
}
export function parseSettings(value: unknown): SettingsPatch {
  if (!isObject(value) || Object.keys(value).some(key => !['recallShortcut', 'reducedMotion'].includes(key))
    || !isShortcut(value.recallShortcut) || typeof value.reducedMotion !== 'boolean') {
    throw new Error('Réglages invalides : utilisez Ctrl, Alt ou Windows et une touche (lettre, chiffre, F1–F24 ou Espace).');
  }
  return { recallShortcut: value.recallShortcut, reducedMotion: value.reducedMotion };
}
export function parsePreferences(value: unknown): Preferences {
  if (!isObject(value) || value.schemaVersion !== 1 || typeof value.visible !== 'boolean') throw new Error('Format de préférences invalide ou version non prise en charge.');
  const settings = parseSettings({ recallShortcut: value.recallShortcut, reducedMotion: value.reducedMotion });
  const position = value.position;
  if (position !== null && (!isObject(position) || !Number.isSafeInteger(position.x) || !Number.isSafeInteger(position.y))) throw new Error('Position enregistrée invalide.');
  return { schemaVersion: 1, visible: value.visible, position: position === null ? null : { x: position.x as number, y: position.y as number }, ...settings };
}
