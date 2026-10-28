import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_LIVE_SETTINGS, parseLiveWrite } from '@aether/live';
import type { LiveSettings } from '@aether/shared';

export class LiveSettingsStore {
  notice: string | null = null;
  constructor(private readonly path: string) {}
  load(): LiveSettings {
    if (!existsSync(this.path)) return structuredClone(DEFAULT_LIVE_SETTINGS);
    try {
      const value = JSON.parse(readFileSync(this.path, 'utf8')) as LiveSettings;
      const { schemaVersion, provider, cloudConsent, ...write } = value;
      if (schemaVersion !== 1 || provider !== 'gemini' || !['prompt','granted','denied'].includes(cloudConsent) || 'apiKey' in write || 'removeKey' in write) throw new Error('Invalid settings');
      return { ...parseLiveWrite(write), schemaVersion: 1, provider, cloudConsent };
    } catch {
      renameSync(this.path, this.path + '.invalid-' + Date.now());
      this.notice = 'Réglages LIVE invalides conservés. Le cloud reste désactivé et son consentement doit être renouvelé.';
      return structuredClone(DEFAULT_LIVE_SETTINGS);
    }
  }
  save(settings: LiveSettings): void {
    const { schemaVersion, provider, cloudConsent, ...write } = settings;
    const { apiKey: _key, removeKey: _remove, ...validated } = parseLiveWrite(write);
    if (schemaVersion !== 1 || provider !== 'gemini' || !['prompt','granted','denied'].includes(cloudConsent)) throw new Error('Réglages LIVE invalides.');
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = this.path + '.tmp';
    writeFileSync(temporary, JSON.stringify({ ...validated, schemaVersion, provider, cloudConsent }, null, 2) + '\n', { mode: 0o600 }); renameSync(temporary, this.path);
  }
}
