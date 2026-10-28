import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventBus } from '@aether/core';
import type { CapabilityInput, CapabilityManifest, CapabilityOutput, CodeGenerationProvider, EvolutionSnapshot, ForgeOrigin, ForgeRequest, ForgeSpecification, InstalledCapability, OperationResult } from '@aether/shared';
import { parseOutput, parseSpecification, parseTests, textValue, validatePlan } from './policy';
import { EvolutionStore, digest } from './store';
import { ISOLATION, Mirror } from './mirror';
import { CapabilityRegistry } from './registry';

export class ForgeEngine {
  readonly registry:CapabilityRegistry;
  readonly events = new EventBus<{ changed: EvolutionSnapshot }>();
  private activity: EvolutionSnapshot['activity'] = 'idle';
  private operation: AbortController | null = null;
  private activeRequestId: string | null = null;
  private error: string | null = null;
  private suggestedDescription: string | null = null;
  constructor(readonly store: EvolutionStore, private provider: CodeGenerationProvider, readonly mirror: Mirror) {this.registry=new CapabilityRegistry(store);}
  snapshot(): EvolutionSnapshot { return { ...this.store.snapshot(), activity: this.activity, activeRequestId: this.activeRequestId, error: this.error, isolation: ISOLATION, suggestedDescription:this.suggestedDescription }; }
  suggest(description:string){this.suggestedDescription=textValue(description,4000);this.publish();}
  publish() { this.events.emit('changed', this.snapshot()); }
  create(specification: ForgeSpecification, origin: ForgeOrigin): ForgeRequest {
    const spec = parseSpecification(specification), now = new Date().toISOString();
    if (!['USER', 'ECHO', 'CURIOSITY', 'MIND'].includes(origin.kind)) throw new Error('Origine FORGE invalide.');
    const request: ForgeRequest = { id: randomUUID(), specification: spec, origin: structuredClone(origin), createdAt: now, updatedAt: now, status: 'DRAFT', approvedAt: null, attempts: [], questions: [], manifest: null };
    this.store.add(request); this.publish(); return structuredClone(request);
  }
  revise(id: string, specification: ForgeSpecification) {
    if (this.operation) throw new Error('Arrêtez l’opération avant de modifier la spécification.');
    const request = this.store.request(id); request.specification = parseSpecification(specification); request.status = 'DRAFT'; request.approvedAt = null; request.manifest = null; request.updatedAt = new Date().toISOString(); this.store.save(); this.publish();
  }
  reject(id: string, confirmed: boolean) { this.confirm(confirmed); if (this.operation) throw new Error('Arrêtez la fabrication avant de la refuser.'); const request = this.store.request(id); request.status = 'REJECTED'; request.approvedAt = null; request.updatedAt = new Date().toISOString(); this.store.save(); this.publish(); }
  private confirm(confirmed: boolean) { if (confirmed !== true) throw new Error('Confirmation humaine explicite requise.'); }
  stop() { this.operation?.abort(); }
  busy() { return this.operation !== null; }
  async generate(id: string, confirmed: boolean): Promise<OperationResult> {
    this.confirm(confirmed); if (this.operation) throw new Error('Une opération FORGE/MIRROR est déjà active.');
    const request = this.store.request(id); if (!['DRAFT', 'FAILED', 'CANCELLED', 'READY'].includes(request.status)) throw new Error('Cette fabrication ne peut pas démarrer dans cet état.');
    const specification = parseSpecification(request.specification), number = request.attempts.length + 1;
    const workspace = this.store.artifact(id, number), operation = new AbortController(); this.operation = operation; this.activeRequestId = id; this.activity = 'BUILDING'; this.error = null;
    const previousAttempt=request.attempts.at(-1);const previousError = previousAttempt?.report?JSON.stringify(previousAttempt.report.checks.filter(c=>!c.passed)).slice(0,8000):previousAttempt?.error ?? null, now = new Date().toISOString();
    request.status = 'GENERATING'; request.approvedAt = now; request.updatedAt = now; request.manifest = null;
    const attempt = { number, startedAt: now, endedAt: null, status: 'GENERATING' as const, events: [], report: null, error: null, provider: null };
    request.attempts.push(attempt);
    const current = request.attempts.at(-1)!;
    const progress = (phase: string, detail: string) => { if (operation.signal.aborted) return; current.events.push({ at: new Date().toISOString(), phase: phase.slice(0, 80), detail: detail.slice(0, 1000) }); if (current.events.length > 300) current.events.shift(); this.store.save(); this.publish(); };
    const deadline = setTimeout(() => operation.abort(), 300000);
    try {
      writeFileSync(join(workspace, 'specification.json'), JSON.stringify({ specification, origin: request.origin }, null, 2));
      progress('specification', 'Spécification approuvée ; espace de fabrication créé.');
      const generated = await this.provider.generate({ specification, workspace, attempt: number, previousError, signal: operation.signal, progress });
      if (operation.signal.aborted) throw new Error('Génération arrêtée.');
      this.store.capabilityId(generated.id, generated.version); const source = textValue(generated.source, 100000), tests = parseTests(generated.tests); current.provider = textValue(generated.provider, 200);
      writeFileSync(join(workspace, 'capability.js'), source); writeFileSync(join(workspace, 'tests.json'), JSON.stringify(tests, null, 2));
      progress('files', 'Code et tests reçus de Codex et enregistrés. Dépendances externes : aucune.');
      this.activity = 'TESTING'; current.status = 'TESTING'; request.status = 'TESTING'; this.publish();
      const report = await this.mirror.test(source, specification, tests, operation.signal, progress); current.report = report; writeFileSync(join(workspace, 'mirror-report.json'), JSON.stringify(report, null, 2));
      if (operation.signal.aborted) throw new Error('MIRROR arrêté.');
      if (!report.passed) throw new Error('MIRROR refuse le prototype : consultez les tests échoués avant une nouvelle tentative.');
      const manifest: CapabilityManifest = { schemaVersion: 1, id: generated.id, name: textValue(generated.name, 160), version: generated.version, description: textValue(generated.description), inputs: specification.inputs, outputs: specification.outputs, permissions: specification.permissions, entryPoint: 'capability.js', compatibility: { apiVersion: 1, runtime: 'quickjs-wasm', platform: 'win32' }, provenance: { createdBy: 'FORGE', forgeRequestId: id, attempt: number, origin: request.origin, createdAt: new Date().toISOString(), provider: current.provider }, validation: { status: 'tested', digest: report.digest, report } };
      request.manifest = manifest; request.status = 'READY'; current.status = 'READY'; writeFileSync(join(workspace, 'manifest.json'), JSON.stringify(manifest, null, 2)); progress('ready', 'Tests MIRROR réussis. Prototype prêt à essayer et à accepter.'); return { ok: true };
    } catch (error) {
      const failure = operation.signal.aborted ? 'Opération arrêtée ; aucun résultat tardif adopté.' : error instanceof Error ? error.message : 'Fabrication échouée.';
      current.status = operation.signal.aborted ? 'CANCELLED' : 'FAILED'; request.status = current.status; current.error = failure; this.error = failure; return { ok: false, error: failure };
    } finally { clearTimeout(deadline); current.endedAt = new Date().toISOString(); request.updatedAt = current.endedAt; this.operation = null; this.activeRequestId = null; this.activity = 'idle'; this.store.save(); this.publish(); }
  }
  install(id: string, confirmed: boolean) {
    this.confirm(confirmed); if (this.operation) throw new Error('Attendez la fin de MIRROR.');
    const request = this.store.request(id), manifest = request.manifest;
    if (request.status !== 'READY' || !manifest || !request.attempts.at(-1)?.report?.passed) throw new Error('Prototype non validé par MIRROR.');
    const source = this.source(manifest, false), directory = this.store.installed(manifest.id, manifest.version), existing = this.store.capabilities().filter(c => c.manifest.id === manifest.id);
    if (existing.some(c => c.manifest.version === manifest.version)) throw new Error('Cette version existe déjà. Générez une nouvelle version.');
    writeFileSync(join(directory, 'capability.js'), source, { flag: 'wx' }); writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const previous = existing.find(c => c.state === 'INSTALLED'); for (const c of existing) if (c.state === 'INSTALLED') c.state = 'DISABLED';
    this.registry.add({ manifest: structuredClone(manifest), state: 'INSTALLED', installedAt: new Date().toISOString(), lastUsedAt: null, previousVersion: previous?.manifest.version ?? null, grantedPermissions: [...manifest.permissions] });
    request.status = 'INSTALLED'; request.updatedAt = new Date().toISOString(); this.store.save(); this.publish();
  }
  source(manifest: CapabilityManifest, installed: boolean) {
    const folder = installed ? this.store.installed(manifest.id, manifest.version) : this.store.artifact(manifest.provenance.forgeRequestId, manifest.provenance.attempt);
    const source = readFileSync(join(folder, 'capability.js'), 'utf8');
    if (digest(source) !== manifest.validation.digest || !manifest.validation.report.passed || manifest.validation.report.digest !== manifest.validation.digest) throw new Error('Artefact modifié depuis MIRROR : exécution/installation refusée.'); return source;
  }
  capability(id: string): InstalledCapability {
    return this.registry.active(id);
  }
  lifecycle(action: 'disable' | 'enable' | 'remove' | 'rollback', id: string, confirmed: boolean) {
    this.confirm(confirmed); if (this.operation) throw new Error('Arrêtez l’opération avant de modifier les capacités.');
    const versions = this.store.capabilities().filter(c => c.manifest.id === id), current = versions.find(c => c.state === 'INSTALLED') ?? versions.filter(c => c.state === 'DISABLED').at(-1);
    if (!current) throw new Error('Capacité introuvable.');
    if (action === 'rollback') { const previous = versions.find(c => c.manifest.version === current.previousVersion && c.state !== 'REMOVED'); if (!previous) throw new Error('Aucune version précédente disponible.'); this.source(previous.manifest, true); current.state = 'DISABLED'; previous.state = 'INSTALLED'; }
    else if (action === 'remove') { for (const v of versions) v.state = 'REMOVED'; }
    else if (action === 'disable') current.state = 'DISABLED';
    else { this.source(current.manifest, true); for (const v of versions) if (v.state === 'INSTALLED') v.state = 'DISABLED'; current.state = 'INSTALLED'; }
    this.store.save(); this.publish();
  }
  async run(id: string, input: CapabilityInput): Promise<CapabilityOutput> {
    if (this.operation) throw new Error('Une opération est déjà active.');
    const prototype=/^[a-f0-9-]{36}$/.test(id)?this.store.request(id):null;
    if(prototype&&(prototype.status!=='READY'||!prototype.manifest))throw new Error('Prototype non validé par MIRROR.');
    const capability=prototype?null:this.capability(id),manifest=prototype?.manifest??capability!.manifest,granted=capability?.grantedPermissions??manifest.permissions;
    const operation = new AbortController(); this.operation = operation; this.activity = 'RUNNING'; this.publish();
    try { const output = parseOutput(await this.mirror.runtime.evaluate(this.source(manifest, !prototype), input, operation.signal)); if (operation.signal.aborted) throw new Error('Exécution arrêtée.'); validatePlan(input, output, granted); if(capability)capability.lastUsedAt = new Date().toISOString(); this.store.save(); return output; }
    finally { this.operation = null; this.activity = 'idle'; this.publish(); }
  }
}
