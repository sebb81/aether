import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_PREFERENCES, parsePreferences } from '@aether/core';
import type { Preferences } from '@aether/shared';

export class PreferencesStore {
  constructor(readonly path: string) {}
  load(): { preferences: Preferences; notice: string | null } {
    if (!existsSync(this.path)) return { preferences: structuredClone(DEFAULT_PREFERENCES), notice: null };
    const contents = readFileSync(this.path, 'utf8');
    try { return { preferences: parsePreferences(JSON.parse(contents)), notice: null }; }
    catch {
      const backup = `${this.path}.invalid-${Date.now()}`;
      renameSync(this.path, backup);
      return { preferences: structuredClone(DEFAULT_PREFERENCES), notice: `Préférences invalides : valeurs par défaut restaurées. L'original est conservé dans ${backup}.` };
    }
  }
  save(preferences: Preferences): void {
    const validated = parsePreferences(preferences);
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      renameSync(temporary, this.path);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
}
