import { safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_AI_CONFIGURATION, parseAiConfiguration, parseRouterOverrides } from '@aether/mind';
import type { AiConfiguration, RouterOverrides } from '@aether/shared';

function writeAtomic(path: string, contents: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try { writeFileSync(temporary, contents, { mode: 0o600 }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
export class AiConfigurationStore {
  constructor(readonly path: string) {}
  load(): { configuration: AiConfiguration; notice: string | null } {
    if (!existsSync(this.path)) return { configuration: structuredClone(DEFAULT_AI_CONFIGURATION), notice: null };
    const content = readFileSync(this.path, 'utf8');
    try { return { configuration: parseAiConfiguration(JSON.parse(content)), notice: null }; }
    catch {
      renameSync(this.path, `${this.path}.invalid-${Date.now()}`);
      return { configuration: structuredClone(DEFAULT_AI_CONFIGURATION), notice: 'La configuration IA était invalide. Son original a été conservé et MIND est désactivé jusqu’à reconfiguration.' };
    }
  }
  save(configuration: AiConfiguration) { writeAtomic(this.path, `${JSON.stringify(parseAiConfiguration(configuration), null, 2)}\n`); }
}
export class SafeSecretVault {
  constructor(private readonly path: string) {}
  available(): boolean { return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'); }
  hasKey(): boolean { return existsSync(this.path) || Boolean(process.env.OPENAI_API_KEY?.trim()); }
  getKey(): string | null {
    if (!existsSync(this.path)) return process.env.OPENAI_API_KEY?.trim() || null;
    if (!this.available()) throw new Error('Le stockage sécurisé du système est indisponible. Aucune clé ne sera lue ou stockée en clair.');
    try { return safeStorage.decryptString(readFileSync(this.path)); }
    catch { throw new Error('La clé chiffrée ne peut pas être lue dans cette session Windows. Ressaisissez-la dans les réglages.'); }
  }
  setKey(key: string) {
    if (!this.available()) throw new Error('Le stockage sécurisé du système est indisponible. Aucun secret ne sera stocké en clair.');
    try { writeAtomic(this.path, safeStorage.encryptString(key)); }
    catch { throw new Error('La clé n’a pas pu être enregistrée dans le stockage chiffré.'); }
  }
  removeKey() {
    if (existsSync(this.path)) unlinkSync(this.path);
    else if (process.env.OPENAI_API_KEY) throw new Error('Cette clé provient de OPENAI_API_KEY. Retirez cette variable dans votre environnement pour la supprimer.');
  }
  encryptedSnapshot(): Buffer | null { return existsSync(this.path) ? readFileSync(this.path) : null; }
  restoreEncrypted(snapshot: Buffer | null) { if (snapshot) writeAtomic(this.path, snapshot); else if (existsSync(this.path)) unlinkSync(this.path); }
}
export class RouterOverridesStore {
  notice: string|null=null;
  constructor(private readonly path: string) {}
  load(): RouterOverrides {
    if (!existsSync(this.path)) return { DEEP:null,VISION:null };
    try { const input=JSON.parse(readFileSync(this.path,'utf8')); if (input.schemaVersion!==1) throw new Error('schema'); return parseRouterOverrides(input.profiles); }
    catch { renameSync(this.path,`${this.path}.invalid-${Date.now()}`); this.notice='Configuration MODEL ROUTER invalide préservée. DEEP reprend FAST ; vérifiez les profils dans les réglages.'; return {DEEP:null,VISION:null}; }
  }
  save(value: RouterOverrides) { writeAtomic(this.path,`${JSON.stringify({schemaVersion:1,profiles:parseRouterOverrides(value)},null,2)}\n`); }
}
