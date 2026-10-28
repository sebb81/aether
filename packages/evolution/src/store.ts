import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { EvolutionSnapshot, ForgeRequest, InstalledCapability, ExperimentProposal } from '@aether/shared';
import { parseSpecification } from './policy';

export const digest = (source: string) => createHash('sha256').update(source).digest('hex');
interface State { schemaVersion: 1; requests: ForgeRequest[]; capabilities: InstalledCapability[]; proposals: ExperimentProposal[] }
export class EvolutionStore {
  private state: State;
  readonly root: string;
  constructor(folder: string) {
    this.root = resolve(folder, 'evolution'); mkdirSync(this.root, { recursive: true, mode: 0o700 });
    if(lstatSync(this.root).isSymbolicLink()||realpathSync(this.root).toLowerCase()!==this.root.toLowerCase())throw new Error('Stockage EVOLUTION redirigé refusé.');
    const path = join(this.root, 'registry.json');
    this.state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as State : { schemaVersion: 1, requests: [], capabilities: [], proposals: [] };
    if (this.state.schemaVersion !== 1 || !Array.isArray(this.state.requests) || !Array.isArray(this.state.capabilities) || !Array.isArray(this.state.proposals)) throw new Error('Registre EVOLUTION invalide : conservé, aucune capacité chargée.');
    for (const request of this.state.requests) {
      this.requestId(request.id); parseSpecification(request.specification);
      if (['GENERATING', 'TESTING'].includes(request.status)) { request.status = 'CANCELLED'; const attempt = request.attempts.at(-1); if (attempt && !attempt.endedAt) { attempt.status = 'CANCELLED'; attempt.error = 'Interrompu lors de la fermeture précédente.'; attempt.endedAt = new Date().toISOString(); } }
    }
    for (const capability of this.state.capabilities) { this.capabilityId(capability.manifest.id, capability.manifest.version); if (capability.manifest.schemaVersion !== 1 || capability.manifest.compatibility?.runtime !== 'quickjs-wasm') throw new Error('Manifeste incompatible dans le registre.'); }
    this.save();
  }
  snapshot(): Pick<EvolutionSnapshot, 'requests' | 'capabilities' | 'proposals'> { return structuredClone(this.state); }
  requestId(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identifiant FORGE invalide.'); }
  capabilityId(id: string, version: string) { if (!/^[a-z][a-z0-9-]{2,60}$/.test(id) || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) throw new Error('Identité/version de capacité invalide.'); }
  request(id: string) { this.requestId(id); const value = this.state.requests.find(r => r.id === id); if (!value) throw new Error('Fabrication introuvable.'); return value; }
  capabilities() { return this.state.capabilities; }
  proposals() { return this.state.proposals; }
  add(request: ForgeRequest) { if (this.state.requests.length >= 200) throw new Error('Limite de 200 fabrications atteinte.'); this.state.requests.unshift(request); this.save(); }
  save() { const path = join(this.root, 'registry.json'), temp = path + '.' + randomUUID() + '.tmp'; writeFileSync(temp, JSON.stringify(this.state, null, 2) + '\n', { mode: 0o600 }); renameSync(temp, path); }
  artifact(id: string, attempt: number) { this.requestId(id); if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 10) throw new Error('Tentative invalide.'); return this.directory(join('forge', id, 'attempt-' + attempt)); }
  installed(id: string, version: string) { this.capabilityId(id, version); return this.directory(join('installed', id, version)); }
  private directory(path: string) {
    const target = resolve(this.root, path); const rel = relative(this.root, target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Chemin hors EVOLUTION.');
    let cursor = this.root; for (const part of rel.split(/[\\/]/)) { cursor = join(cursor, part); if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error('Lien/jonction interdit dans EVOLUTION.'); }
    mkdirSync(target, { recursive: true, mode: 0o700 });
    if (realpathSync(target).toLowerCase() !== target.toLowerCase()) throw new Error('Stockage redirigé refusé.');
    return target;
  }
}
