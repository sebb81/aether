import type { OperationResult } from './index';

export type LiveState = 'idle' | 'LIVE_CONNECTING' | 'LIVE_LISTENING' | 'LIVE_THINKING' | 'LIVE_DEEP_THINKING' | 'LIVE_SPEAKING' | 'LIVE_INTERRUPTED' | 'LIVE_ERROR';
export interface LiveSettings {
  schemaVersion: 1; enabled: boolean; provider: 'gemini'; model: string; voice: string;
  cloudConsent: 'prompt' | 'granted' | 'denied'; defaultMode: 'LOCAL' | 'LIVE' | 'ASK';
  showTranscription: boolean; automaticResponse: boolean; diagnostics: 'off' | 'basic' | 'detailed';
}
export type LiveSettingsWrite = Omit<LiveSettings, 'schemaVersion' | 'cloudConsent' | 'provider'> & { apiKey?: string; removeKey?: boolean };
export interface LiveToolCall { id: string; name: string; args: unknown }
export interface LiveToolDeclaration { name: string; description: string; parameters: { type: 'object'; properties: Record<string, { type: 'string'; description: string }>; required: string[]; additionalProperties: false } }
export interface LiveToolResult { status: 'ok' | 'consent_required' | 'confirmation_required' | 'denied' | 'error'; [key: string]: unknown }
export interface LiveMetric { kind: 'connection' | 'transport-open' | 'first-audio' | 'tool' | 'deep' | 'interruption' | 'reconnection-error'; durationMs: number; tool?: string; success: boolean; at: string }
export interface LiveAudit { id: string; tool: string; status: string; durationMs: number; at: string }
export interface LiveConfirmation { id: string; tool: 'remember_explicitly' | 'forget_memory'; content: string }
export interface LiveSnapshot {
  audioProcessing?: { driver: 'chromium'; echoCancellation: boolean; playbackBufferMs: number };
  source: 'microphone' | 'test-fixture' | null;
  state: LiveState; sessionId: string | null; microphoneActive: boolean; audioLevel: number; error: string | null;
  settings: LiveSettings; keyConfigured: boolean; secureStorageAvailable: boolean;
  metrics: LiveMetric[]; audit: LiveAudit[]; pending: LiveConfirmation[]; reconnects: number;
}
export type LiveProviderEvent =
  | { type: 'transport-open' }
  | { type: 'audio'; pcm: Uint8Array; rate: number }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; finished: boolean }
  | { type: 'interrupted' | 'turn-complete' }
  | { type: 'tool-calls'; calls: LiveToolCall[] }
  | { type: 'tool-cancelled'; ids: string[] }
  | { type: 'error'; message: string } | { type: 'closed'; reason: string };
export interface LiveConversationProvider {
  readonly id: string;
  open(input: { settings: LiveSettings; instructions: string; tools: LiveToolDeclaration[] }, event: (event: LiveProviderEvent) => void, signal: AbortSignal): Promise<void>;
  sendAudio(pcm: Uint8Array): void;
  activity(start: boolean): void;
  respond(): void;
  sendToolResult(call: LiveToolCall, result: LiveToolResult): void;
  close(): void;
}
export interface LiveAudioPort {
  readonly processing?: LiveSnapshot['audioProcessing'];
  readonly source?: 'microphone' | 'test-fixture';
  start(onInput: (pcm: Uint8Array, level: number, speech: boolean) => void, onOutput: (playing: boolean, level: number) => void, onError: (message: string) => void, signal: AbortSignal): Promise<void>;
  play(pcm: Uint8Array, rate: number): void;
  interrupt(): void;
  close(): void;
}
export interface LiveBridge {
  getLive(): Promise<LiveSnapshot>;
  onLive(listener: (snapshot: LiveSnapshot) => void): () => void;
  saveLiveSettings(input: LiveSettingsWrite): Promise<OperationResult>;
  liveConsent(decision: 'grant' | 'deny'): Promise<OperationResult>;
  liveControl(command: 'start' | 'stop' | 'reconnect' | 'respond'): Promise<OperationResult>;
  liveConfirm(id: string, approved: boolean): Promise<OperationResult>;
}
