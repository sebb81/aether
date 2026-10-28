import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_VOICE_SETTINGS, parseVoiceWrite } from '@aether/voice';
import type { AudioClip, VoiceDiagnostic, VoiceSettings } from '@aether/shared';
import { localModelPath } from './voice-providers';
import { resolveVoicePython } from './voice-runtime';

export class VoiceSettingsStore {
  notice: string | null = null;
  constructor(private path: string, private resolvePython: (configured: string) => string = resolveVoicePython) {}
  load(): VoiceSettings {
    if (!existsSync(this.path)) return { ...structuredClone(DEFAULT_VOICE_SETTINGS), pythonPath: this.resolvePython(DEFAULT_VOICE_SETTINGS.pythonPath), modelPath: localModelPath() };
    let settings: VoiceSettings;
    try {
      const value = JSON.parse(readFileSync(this.path, 'utf8')) as VoiceSettings;
      if (value.schemaVersion !== 1 || !['prompt', 'granted', 'denied'].includes(value.microphoneConsent)) throw new Error('Schema');
      const { schemaVersion: _schema, microphoneConsent, ...write } = value;
      settings = { ...parseVoiceWrite(write), schemaVersion: 1, microphoneConsent };
    } catch {
      renameSync(this.path, `${this.path}.invalid-${Date.now()}`);
      this.notice = 'Réglages VOICE invalides conservés. Le microphone reste désactivé ; choisissez de nouveau vos réglages.';
      return { ...structuredClone(DEFAULT_VOICE_SETTINGS), pythonPath: this.resolvePython(DEFAULT_VOICE_SETTINGS.pythonPath), modelPath: localModelPath() };
    }
    const pythonPath = this.resolvePython(settings.pythonPath);
    if (pythonPath !== settings.pythonPath) { settings.pythonPath = pythonPath; this.save(settings); }
    return settings;
  }
  save(settings: VoiceSettings) {
    const { schemaVersion: _schema, microphoneConsent, ...write } = settings;
    const data = { ...parseVoiceWrite(write), schemaVersion: 1, microphoneConsent };
    const temporary = this.path + '.tmp'; writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 }); renameSync(temporary, this.path);
  }
}
export class VoiceDiagnosticStore {
  private readonly folder: string;
  constructor(root: string) { this.folder = join(root, 'voice-diagnostics'); }
  list(): VoiceDiagnostic[] {
    if (!existsSync(this.folder)) return [];
    if (lstatSync(this.folder).isSymbolicLink()) throw new Error('Dossier diagnostic VOICE invalide.');
    const records: VoiceDiagnostic[] = [];
    for (const name of readdirSync(this.folder)) {
      if (!/^[a-f0-9-]{36}\.wav$/.test(name)) continue;
      const path = join(this.folder, name), info = lstatSync(path);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      const expires = info.mtimeMs + 10 * 60 * 1000;
      if (expires < Date.now()) { unlinkSync(path); continue; }
      records.push({ id: name.slice(0, -4), createdAt: new Date(info.mtimeMs).toISOString(), expiresAt: new Date(expires).toISOString(), bytes: info.size });
    }
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  retain(clip: AudioClip) {
    if (clip.wav.length > 2_500_000) throw new Error('Extrait diagnostic trop long.');
    mkdirSync(this.folder, { recursive: true });
    if (lstatSync(this.folder).isSymbolicLink()) throw new Error('Dossier diagnostic VOICE invalide.');
    const records = this.list();
    while (records.length >= 5) unlinkSync(join(this.folder, records.shift()!.id + '.wav'));
    writeFileSync(join(this.folder, randomUUID() + '.wav'), clip.wav, { mode: 0o600 });
  }
  clear() { for (const record of this.list()) unlinkSync(join(this.folder, record.id + '.wav')); }
}
