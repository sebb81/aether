import type { OperationResult } from './index';

export type VoiceState = 'idle' | 'starting' | 'listening' | 'transcribing' | 'processing' | 'synthesizing' | 'speaking' | 'error';
export type InputModality = 'text' | 'voice';
export type SpeechPolicy = 'always' | 'voice-only' | 'never';
export interface VoiceSettings {
  schemaVersion: 1;
  enabled: boolean;
  microphoneConsent: 'prompt' | 'granted' | 'denied';
  microphone: string;
  language: string;
  shortcut: string;
  sttProvider: 'faster-whisper' | 'disabled';
  ttsProvider: 'windows-speech' | 'disabled';
  ttsEnabled: boolean;
  voice: string;
  speed: number;
  volume: number;
  responsePolicy: SpeechPolicy;
  diagnostics: boolean;
  retainDiagnosticAudio: boolean;
  wakeWordEnabled: false;
  pythonPath: string;
  modelPath: string;
}
export type VoiceSettingsWrite = Omit<VoiceSettings, 'schemaVersion' | 'microphoneConsent'>;
export interface AudioClip { wav: Uint8Array; durationMs: number; speechDetected: boolean; source: 'microphone' | 'test-fixture' | 'synthesis' }
export interface SpeechToTextProvider {
  readonly id: string;
  readonly locality: 'local' | 'cloud';
  transcribe(clip: AudioClip, language: string, signal: AbortSignal): Promise<{ text: string; language: string }>;
}
export interface TextToSpeechProvider {
  readonly id: string;
  readonly locality: 'local' | 'cloud';
  synthesize(text: string, settings: Pick<VoiceSettings, 'voice' | 'speed' | 'language'>, signal: AbortSignal): Promise<AudioClip>;
}
export interface AudioCaptureProvider {
  start(settings: VoiceSettings, onStarted: (source: AudioClip['source']) => void, onLevel: (level: number) => void, signal: AbortSignal): Promise<AudioClip>;
  finish(): void;
}
export interface AudioOutputProvider {
  play(clip: AudioClip, volume: number, onStarted: () => void, onLevel: (level: number) => void, signal: AbortSignal): Promise<void>;
}
export interface WakeWordProvider { readonly locality: 'local'; start(word: string, detected: () => void, signal: AbortSignal): Promise<void> }
export interface VocalBargeInProvider { start(interrupted: () => void, signal: AbortSignal): Promise<void> }
export interface VoiceDevice { id: string; name: string; host: string; default: boolean }
export interface InstalledVoice { id: string; name: string; language: string }
export interface VoiceInventory { microphones: VoiceDevice[]; voices: InstalledVoice[]; sttAvailable: boolean; ttsAvailable: boolean; model: string; runtime: string; errors: string[] }
export interface VoiceMetrics { captureMs: number | null; sttMs: number | null; mindMs: number | null; ttsMs: number | null; playbackStartMs: number | null; firstSoundMs: number | null; totalMs: number | null }
export interface VoiceDiagnostic { id: string; createdAt: string; expiresAt: string; bytes: number }
export interface VoiceSnapshot {
  state: VoiceState;
  microphoneActive: boolean;
  audioLevel: number;
  source: AudioClip['source'] | null;
  error: string | null;
  notice: string | null;
  transcription: string | null;
  fullResponse: string | null;
  spokenResponse: string | null;
  settings: VoiceSettings;
  metrics: VoiceMetrics | null;
  diagnostics: VoiceDiagnostic[];
  shortcutRegistered: boolean;
  wakeWordAvailable: false;
  cloudActive: false;
}
export interface VoiceBridge {
  getVoice(): Promise<VoiceSnapshot>;
  onVoice(listener: (snapshot: VoiceSnapshot) => void): () => void;
  getVoiceInventory(): Promise<VoiceInventory>;
  saveVoiceSettings(settings: VoiceSettingsWrite): Promise<OperationResult>;
  voiceConsent(decision: 'grant' | 'deny'): Promise<OperationResult>;
  voiceControl(command: 'toggle' | 'local' | 'stop' | 'test-voice' | 'clear-diagnostics'): Promise<OperationResult>;
  chooseVoiceResource(kind: 'python' | 'model'): Promise<{ path: string | null }>;
}
