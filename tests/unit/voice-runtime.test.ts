import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_VOICE_SETTINGS } from '@aether/voice';
import { VoiceSettingsStore } from '../../apps/desktop/main/voice-storage';
import { audioWorkerExitError, resolveVoicePython } from '../../apps/desktop/main/voice-runtime';

test('Explorer launch skips the Store alias and persists the installed Python without changing microphone consent', () => {
  const root = mkdtempSync(join(tmpdir(), 'aether-voice-explorer-'));
  try {
    const aliases = join(root, 'Microsoft', 'WindowsApps'), distribution = join(root, 'programdata', 'anaconda3');
    mkdirSync(aliases, { recursive: true }); mkdirSync(distribution, { recursive: true });
    writeFileSync(join(aliases, 'python.exe'), 'Store alias');
    const installed = join(distribution, 'python.exe'); writeFileSync(installed, 'test runtime');
    const env = { Path: aliases, PROGRAMDATA: join(root, 'programdata') };
    assert.equal(resolveVoicePython('python', env), installed);
    const path = join(root, 'voice-settings.json');
    const settings = { ...DEFAULT_VOICE_SETTINGS, enabled: true, microphoneConsent: 'granted' as const };
    writeFileSync(path, JSON.stringify(settings));
    const store = new VoiceSettingsStore(path, python => resolveVoicePython(python, env));
    assert.deepEqual(store.load(), { ...settings, pythonPath: installed });
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { ...settings, pythonPath: installed });
    assert.equal(store.load().pythonPath, installed);
    const firstUse = new VoiceSettingsStore(join(root, 'new-settings.json'), python => resolveVoicePython(python, env)).load();
    assert.equal(firstUse.pythonPath, installed); assert.equal(firstUse.enabled, false); assert.equal(firstUse.microphoneConsent, 'prompt');
    writeFileSync(path, JSON.stringify(settings)); mkdirSync(path + '.tmp');
    assert.throws(() => store.load());
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), settings);
    assert(!readdirSync(root).some(name => name.includes('.invalid-')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Python resolution preserves an explicitly selected runtime and reports an unavailable alias', () => {
  const custom = join(tmpdir(), 'user-selected-runtime', 'python.exe');
  assert.equal(resolveVoicePython(custom, {}), custom);
  assert.equal(resolveVoicePython('python', {}), 'python');
  assert.match(audioWorkerExitError(9009, null).message, /alias.*python\.exe/);
  assert.match(audioWorkerExitError(1, null).message, /code 1/);
});
