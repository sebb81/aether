import type { OperationResult } from './index';

export type CapabilityPermission = 'filesystem.read' | 'filesystem.write' | 'network' | 'clipboard' | 'microphone' | 'notifications' | 'process.execution';
export type CapabilityState = 'DRAFT' | 'TESTING' | 'READY' | 'INSTALLED' | 'DISABLED' | 'FAILED' | 'REMOVED';
export interface ForgeOrigin { kind: 'USER' | 'ECHO' | 'CURIOSITY' | 'MIND'; ref: string | null; reason: string }
export interface CapabilityFile { path: string; size: number; modifiedAt: string }
export interface CapabilityInput { files: CapabilityFile[]; parameters: Record<string, unknown> }
export interface AetherCapabilityAPI { schemaVersion: 1; mode: 'preview'; permissions: readonly never[] }
export interface CapabilityOutput { summary: string; renames: { from: string; to: string }[]; data: unknown }
export interface CapabilityTest { name: string; input: CapabilityInput; expected: CapabilityOutput }
export interface ForgeSpecification {
  title: string; objective: string; description: string; inputs: string[]; outputs: string[];
  constraints: string[]; permissions: CapabilityPermission[]; dependencies: string[];
  successCriteria: string[]; acceptanceTests: CapabilityTest[];
}
export interface ForgeEvent { at: string; phase: string; detail: string }
export interface MirrorCheck { name: string; passed: boolean; detail: string; durationMs: number }
export interface MirrorReport { at: string; passed: boolean; digest: string; checks: MirrorCheck[]; isolation: string; durationMs: number }
export interface ForgeAttempt { number: number; startedAt: string; endedAt: string | null; status: 'GENERATING' | 'TESTING' | 'READY' | 'FAILED' | 'CANCELLED'; events: ForgeEvent[]; report: MirrorReport | null; error: string | null; provider: string | null }
export interface ForgeRequest {
  id: string; specification: ForgeSpecification; origin: ForgeOrigin; createdAt: string; updatedAt: string;
  status: 'DRAFT' | 'GENERATING' | 'TESTING' | 'READY' | 'FAILED' | 'REJECTED' | 'CANCELLED' | 'INSTALLED';
  approvedAt: string | null; attempts: ForgeAttempt[]; questions: string[]; manifest: CapabilityManifest | null;
}
export interface CapabilityManifest {
  schemaVersion: 1; id: string; name: string; version: string; description: string;
  inputs: string[]; outputs: string[]; permissions: CapabilityPermission[];
  entryPoint: 'capability.js'; compatibility: { apiVersion: 1; runtime: 'quickjs-wasm'; platform: 'win32' };
  provenance: { createdBy: 'FORGE'; forgeRequestId: string; attempt: number; origin: ForgeOrigin; createdAt: string; provider: string };
  validation: { status: 'tested'; digest: string; report: MirrorReport };
}
export interface InstalledCapability { manifest: CapabilityManifest; state: CapabilityState; installedAt: string; lastUsedAt: string | null; previousVersion: string | null; grantedPermissions: CapabilityPermission[] }
export interface ExperimentProposal { id: string; interestId: string; title: string; description: string; createdAt: string; status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED'; forgeRequestId: string | null }
export interface EvolutionSnapshot {
  activity: 'idle' | 'BUILDING' | 'TESTING' | 'RUNNING'; activeRequestId: string | null;
  requests: ForgeRequest[]; capabilities: InstalledCapability[]; proposals: ExperimentProposal[];
  error: string | null; isolation: string;
  suggestedDescription: string | null;
}
export interface CapabilityPreview { id: string; capabilityId: string; version: string; folder: string; expiresAt: string; output: CapabilityOutput; files: CapabilityFile[]; applied: boolean }
export interface CodeGenerationResult { id: string; name: string; version: string; description: string; source: string; tests: CapabilityTest[]; provider: string }
export interface CodeGenerationProvider { generate(input: { specification: ForgeSpecification; workspace: string; attempt: number; previousError: string | null; signal: AbortSignal; progress: (phase: string, detail: string) => void }): Promise<CodeGenerationResult> }
export interface CapabilityRuntime { evaluate(source: string, input: CapabilityInput, signal: AbortSignal, compileOnly?: boolean): Promise<CapabilityOutput | null> }
export type EvolutionAction = 'generate' | 'reject' | 'retest' | 'install' | 'disable' | 'enable' | 'remove' | 'rollback' | 'reject-proposal';
export interface EvolutionBridge {
  getEvolution(): Promise<EvolutionSnapshot>; onEvolution(listener: (value: EvolutionSnapshot) => void): () => void;
  prepareForge(input: { description: string; origin?: { kind: 'ECHO' | 'CURIOSITY'; ref: string } }): Promise<OperationResult>;
  saveForgeSpecification(id: string, specification: ForgeSpecification): Promise<OperationResult>;
  evolutionAction(action: EvolutionAction, id: string, confirmed: boolean): Promise<OperationResult>;
  stopEvolution(): Promise<OperationResult>;
  previewCapability(id: string, parameters: Record<string, unknown>): Promise<CapabilityPreview | { error: string } | null>;
  applyCapability(previewId: string, confirmed: boolean): Promise<OperationResult>;
  proposeExperiment(interestId: string): Promise<OperationResult>;
}
