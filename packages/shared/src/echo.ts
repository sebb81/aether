import type { ModelRoute, OperationResult } from './index';

export type EchoEventKind = 'created' | 'renamed' | 'moved' | 'modified' | 'deleted';
export interface EchoEvent { id: string; sessionId: string; at: string; kind: EchoEventKind; path: string; previousPath: string | null; nodeKind: 'file' | 'directory'; size: number; source: 'filesystem'; application: 'explorer.exe'; windowTitle: string; contextFolder: string }
export interface EchoStep { action: EchoEventKind; description: string; evidenceIds: string[] }
export interface EchoInterpretation { summary: string; name: string; description: string; context: string; triggers: string[]; procedure: EchoStep[]; evidenceIds: string[]; confidence: number; matchedHabitId: string | null; variations: string[] }
export type EchoDecision = 'pending' | 'yes' | 'no' | 'partial' | 'corrected';
export interface EchoHypothesis { id: string; sessionId: string; habitId: string; createdAt: string; interpretation: EchoInterpretation; decision: EchoDecision; correction: string | null; model: string; route: ModelRoute; invalidated: boolean }
export interface EchoObservationSession { id: string; startedAt: string; endedAt: string | null; durationMs: number; applications: string[]; resources: string[]; status: 'observing' | 'paused' | 'analysing' | 'completed' | 'failed' | 'interrupted'; summary: string | null; error: string | null; events: EchoEvent[]; hypotheses: EchoHypothesis[] }
export interface EchoVariation { sessionId: string; comparedSessionId: string; description: string; evidenceIds: string[]; decision: EchoDecision }
export interface Habit { id: string; name: string; description: string; context: string; applications: string[]; triggers: string[]; procedure: EchoStep[]; firstObservedAt: string; lastObservedAt: string; occurrences: number; confidence: number; state: 'hypothesis' | 'confirmed' | 'rejected' | 'dormant'; provenance: { engine: 'ECHO'; sessionIds: string[] }; memoryId: string | null; variations: EchoVariation[]; signature: string[] }
export interface AutomationOpportunity { id: string; habitId: string; createdAt: string; description: string; status: 'proposed'; executionAllowed: false }
export interface EchoExclusions { folders: string[]; processes: string[]; windows: string[] }
export interface EchoContext { allowed: boolean; application: string | null; folder: string | null; windowTitle: string | null; reason: string }
export interface EchoSnapshot { enabled: boolean; state: 'off' | 'ready' | 'observing' | 'paused' | 'analysing' | 'error'; activeSessionId: string | null; context: EchoContext | null; sessions: EchoObservationSession[]; habits: Habit[]; opportunities: AutomationOpportunity[]; exclusions: EchoExclusions; error: string | null }
export interface EchoFolderChoice { token: string; folder: string; expiresAt: string }
export interface EchoStartInput { token: string; consent: true }
export interface EchoValidation { hypothesisId: string; decision: Exclude<EchoDecision, 'pending' | 'corrected'> | 'correct'; correction?: string }
export interface EchoBridge { getEcho(): Promise<EchoSnapshot>; onEcho(listener: (snapshot: EchoSnapshot) => void): () => void; chooseEchoFolder(purpose: 'session' | 'exclusion'): Promise<EchoFolderChoice | null>; startEcho(input: EchoStartInput): Promise<OperationResult>; echoControl(command: 'enable' | 'stop' | 'pause' | 'resume' | 'disable' | 'cancel-analysis'): Promise<OperationResult>; validateEcho(input: EchoValidation): Promise<OperationResult>; removeEchoSession(id: string): Promise<OperationResult>; saveEchoExclusions(input: EchoExclusions): Promise<OperationResult> }
export interface EchoInterpreterPort { interpret(events: EchoEvent[], candidates: Habit[], signal: AbortSignal): Promise<{ interpretation: EchoInterpretation; model: string; route: ModelRoute }> }
