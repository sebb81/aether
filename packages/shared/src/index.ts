export type Point = { x: number; y: number };
export type Rectangle = Point & { width: number; height: number };
export type EntityState = 'idle' | 'attention' | 'listening' | 'observing' | 'thinking' | 'exploring' | 'suggesting' | 'creating' | 'error';
export type AvailableEntityState = Extract<EntityState, 'idle' | 'attention' | 'thinking' | 'exploring' | 'error'>;

export interface Preferences {
  schemaVersion: 1;
  position: Point | null;
  visible: boolean;
  recallShortcut: string;
  reducedMotion: boolean;
}

export const IPC = {
  snapshot: 'aether:snapshot',
  command: 'aether:command',
  settings: 'aether:settings',
  drag: 'aether:drag',
  changed: 'aether:changed',
  mindSnapshot: 'aether:mind-snapshot',
  mindChanged: 'aether:mind-changed',
  mindSend: 'aether:mind-send',
  mindControl: 'aether:mind-control',
  aiConfig: 'aether:ai-config',
  aiSave: 'aether:ai-save',
  aiModels: 'aether:ai-models',
  memoryList: 'aether:memory-list',
  memoryWrite: 'aether:memory-write',
  memoryRemove: 'aether:memory-remove',
  memoryExport: 'aether:memory-export',
  routerGet: 'aether:router-get', routerSave: 'aether:router-save',
  curiosityGet: 'aether:curiosity-get', curiosityChanged: 'aether:curiosity-changed',
  curiositySettings: 'aether:curiosity-settings', curiosityControl: 'aether:curiosity-control',
  curiosityInterest: 'aether:curiosity-interest', curiosityRemove: 'aether:curiosity-remove',
  curiosityBlock: 'aether:curiosity-block', curiosityRead: 'aether:curiosity-read',
} as const;

export type PresenceCommand = 'interact' | 'hide' | 'recall' | 'settings' | 'menu' | 'portal' | 'quit' | 'dialogue' | 'memory' | 'curiosity' | 'close-dialogue';
export type SettingsPatch = Pick<Preferences, 'recallShortcut' | 'reducedMotion'>;
export type OperationResult = { ok: true } | { ok: false; error: string };
export type Permission = 'microphone' | 'camera' | 'screen.capture' | 'echo.observe' | 'files.read' | 'files.write' | 'network' | 'forge.generate' | 'mirror.execute' | 'capability.adopt';

export interface PresenceSnapshot {
  state: AvailableEntityState;
  preferences: Preferences;
  shortcutRegistered: boolean;
  notice: string | null;
  discoveryPending?: boolean;
  features: Readonly<Record<'presence' | 'mind' | 'echo' | 'curiosity' | 'memory' | 'forge' | 'mirror' | 'portal' | 'capabilities', 'available' | 'not-implemented'>>;
  permissions: Readonly<Record<Permission, boolean>>;
}

export interface DesktopBridge {
  getSnapshot(): Promise<PresenceSnapshot>;
  command(command: PresenceCommand): Promise<OperationResult>;
  saveSettings(settings: SettingsPatch): Promise<OperationResult>;
  drag(phase: 'start' | 'move' | 'end'): void;
  onSnapshot(listener: (snapshot: PresenceSnapshot) => void): () => void;
  getMind(): Promise<MindSnapshot>;
  onMind(listener: (snapshot: MindSnapshot) => void): () => void;
  sendMessage(message: string): Promise<OperationResult>;
  mindControl(command: 'cancel' | 'new-conversation' | 'listening'): Promise<OperationResult>;
  getAiConfiguration(): Promise<AiConfigurationView>;
  saveAiConfiguration(configuration: AiConfigurationInput): Promise<OperationResult>;
  listOllamaModels(baseUrl: string): Promise<{ ok: true; models: string[] } | { ok: false; error: string }>;
  listMemories(query?: string): Promise<DurableMemory[]>;
  writeMemory(input: MemoryWrite): Promise<OperationResult>;
  removeMemory(id: string): Promise<OperationResult>;
  exportMemories(): Promise<OperationResult>;
  getModelRouter(): Promise<RouterConfiguration>;
  saveModelRouter(configuration: RouterOverrides): Promise<OperationResult>;
  getCuriosity(): Promise<CuriositySnapshot>;
  onCuriosity(listener: (snapshot: CuriositySnapshot) => void): () => void;
  saveCuriositySettings(settings: CuriositySettings): Promise<OperationResult>;
  curiosityControl(command: 'explore' | 'cancel'): Promise<OperationResult>;
  writeInterest(input: InterestWrite): Promise<OperationResult>;
  removeCuriosity(kind: CuriosityObjectKind, id: string): Promise<OperationResult>;
  blockDomain(domain: string, blocked: boolean): Promise<OperationResult>;
  markCuriosityRead(): Promise<OperationResult>;
}

export type ModelProfile = 'FAST' | 'DEEP' | 'VISION';
export interface ModelTarget { provider: 'ollama' | 'openai'; model: string }
export interface RouterOverrides { DEEP: ModelTarget | null; VISION: ModelTarget | null }
export interface RouterConfiguration extends RouterOverrides { FAST: ModelTarget | null; cloudConsent: boolean }
export interface ModelRoute { requested: ModelProfile; selected: ModelProfile; provider: string; model: string; fallback: boolean }
export interface RoutedCompletion { text: string; model: string; route: ModelRoute }
export interface ModelRouterPort { complete(profile: ModelProfile, request: Parameters<LlmProvider['complete']>[0], options?: { localOnly?: boolean }): Promise<RoutedCompletion> }

export type InterestStatus = 'active' | 'dormant' | 'abandoned';
export type CuriosityOriginKind = 'autonomous' | 'conversation' | 'memory' | 'mind' | 'interest' | 'connection' | 'exploration' | 'user';
export interface CuriosityOrigin { kind: CuriosityOriginKind; ref: string | null; reason: string }
export interface Interest { id: string; title: string; description: string; createdAt: string; updatedAt: string; level: number; origin: CuriosityOrigin; status: InterestStatus }
export interface InterestHistory { id: string; interestId: string; explorationId: string | null; createdAt: string; action: string; reason: string; previousLevel: number | null; level: number; previousStatus: InterestStatus | null; status: InterestStatus }
export type CuriosityItemKind = 'question' | 'hypothesis' | 'discovery';
export type CuriosityObjectKind = 'interest' | CuriosityItemKind | 'exploration' | 'connection';
export interface CuriosityItem { id: string; interestId: string; explorationId: string; kind: CuriosityItemKind; content: string; createdAt: string; confidence: number | null; limits: string | null; status: 'open' | 'proposed' | 'synthesized' }
export interface CuriosityConnection { id: string; fromId: string; toId: string; explorationId: string; description: string; createdAt: string }
export type ExplorationAction = 'birth' | 'deepen' | 'connect' | 'dormant' | 'abandon' | 'reactivate';
export interface Exploration { id: string; interestId: string | null; targets: string[]; action: ExplorationAction; createdAt: string; completedAt: string | null; status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'suppressed'; reason: string; model: string | null; route: ModelRoute | null; error: string | null; nextQuestion: string | null; unread: boolean }
export interface CuriositySettings { enabled: boolean; maxExplorations: number; maxDurationSeconds: number; minIntervalSeconds: number }
export interface CuriosityJournal { interests: Interest[]; items: CuriosityItem[]; connections: CuriosityConnection[]; explorations: Exploration[]; history: InterestHistory[]; blockedDomains: string[] }
export interface CuriositySnapshot extends CuriosityJournal { settings: CuriositySettings; state: 'disabled' | 'idle' | 'exploring' | 'budget-exhausted' | 'error'; error: string | null; sessionAttempts: number; sessionDurationMs: number; nextAt: string | null; unreadCount: number }
export interface InterestWrite { id?: string; title: string; description: string; level: number; status: InterestStatus }
export interface CuriositySeed { key: string; kind: CuriosityOriginKind; ref: string | null; content: string }

export type MindState = 'idle' | 'listening' | 'thinking' | 'replying' | 'error';
export interface ConversationMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; model: string | null }
export interface MindSnapshot {
  state: MindState;
  messages: readonly ConversationMessage[];
  error: string | null;
  usedMemories: readonly DurableMemory[];
  storedMemory: DurableMemory | null;
  notice: string | null;
}
export interface AiConfiguration {
  schemaVersion: 1;
  provider: 'disabled' | 'openai' | 'ollama';
  model: string;
  ollamaUrl: string;
  cloudConsent: boolean;
}
export interface AiConfigurationView extends AiConfiguration { keyConfigured: boolean; secureStorageAvailable: boolean }
export interface AiConfigurationInput extends Omit<AiConfiguration, 'schemaVersion'> { apiKey?: string; removeKey?: boolean }
export type MemoryCategory = 'profile' | 'preference' | 'project' | 'knowledge' | 'experience';
export type MemoryOrigin = 'explicit' | 'inference';
export interface DurableMemory extends MemoryRecord { category: MemoryCategory; origin: MemoryOrigin; updatedAt: string }
export interface MemoryDraft { content: string; category: MemoryCategory; origin: MemoryOrigin; confidence: number | null; source: string }
export interface MemoryWrite { id?: string; content: string; category: MemoryCategory; origin: MemoryOrigin; confidence: number | null }
// Future voice components can use the same input/output ports, without changing orchestration.
export interface DialogueInputPort { submit(text: string): Promise<OperationResult>; cancel(): void }
export interface DialogueOutputPort { present(snapshot: MindSnapshot): void }

// Sensitive future engines remain contracts only. MIND/MEMORY are implemented in J2.
export interface PermissionGrant {
  id: string;
  permission: Permission;
  scope: readonly string[];
  grantedBy: 'user';
  grantedAt: string;
  expiresAt: string;
}
export interface PermissionAuthority {
  allows(permission: Permission, scope: string, grants: readonly PermissionGrant[]): boolean;
}
export interface LlmProvider {
  id: string;
  complete(request: { messages: readonly { role: 'user' | 'assistant' | 'system'; content: string }[]; signal: AbortSignal; responseFormat?: 'json'; maxOutputTokens?: number }): Promise<{ text: string; model: string }>;
}
export interface MemoryRecord {
  id: string;
  kind: 'session' | 'habit' | 'knowledge' | 'experience';
  content: string;
  source: string;
  scope: string;
  createdAt: string;
  confidence: number | null;
  status: 'assumed' | 'confirmed';
}
export interface MemoryRepository {
  search(query: string): Promise<readonly MemoryRecord[]>;
  save(record: MemoryRecord): Promise<void>;
  remove(id: string): Promise<void>;
  export(): Promise<readonly MemoryRecord[]>;
}
export interface EchoSession {
  start(input: { folder: string; grant: PermissionGrant; signal: AbortSignal }): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
}
export interface CuriosityEngine {
  explore(input: { question: string; allowedSources: readonly string[]; maxRequests: number; grants: readonly PermissionGrant[]; signal: AbortSignal }): Promise<{ result: string; sources: readonly string[]; limitations: readonly string[] }>;
  suspend(): Promise<void>;
}
export interface CapabilityManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
  outputSchema: Readonly<Record<string, unknown>>;
  permissions: readonly Permission[];
  runner: 'isolated-process';
  tests: readonly string[];
  status: 'candidate' | 'validated' | 'disabled';
  artifactPath: string;
}
export interface ForgeService {
  generate(input: { approvedSpecification: string; workspace: string; grant: PermissionGrant; signal: AbortSignal }): Promise<CapabilityManifest>;
}
export interface IsolatedRunner {
  test(input: { manifest: CapabilityManifest; stagedInput: string; grants: readonly PermissionGrant[]; signal: AbortSignal }): Promise<{ passed: boolean; reportPath: string; producedFiles: readonly string[] }>;
}
export interface CapabilityRegistry {
  list(): Promise<readonly CapabilityManifest[]>;
  adopt(manifest: CapabilityManifest, grant: PermissionGrant): Promise<void>;
  disable(id: string, version: string): Promise<void>;
}
export interface PortalHost { open(): Promise<OperationResult>; close(): Promise<void> }
export interface AetherEvents {
  'presence.changed': PresenceSnapshot;
  'portal.requested': { requestedAt: string };
  'permission.revoked': { grantId: string; permission: Permission };
  'capability.adopted': { id: string; version: string };
}
