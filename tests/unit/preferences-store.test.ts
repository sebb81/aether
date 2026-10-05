import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PREFERENCES } from '@aether/core';
import { PreferencesStore } from '../../apps/desktop/main/preferences-store';

test('persists position, visibility, shortcut and reduced motion across store instances', () => {
  const folder = mkdtempSync(join(tmpdir(), 'aether-store-'));
  try {
    const file = join(folder, 'nested', 'preferences.json'); const store = new PreferencesStore(file);
    assert.deepEqual(store.load(), { preferences: DEFAULT_PREFERENCES, notice: null });
    const preferences = { ...DEFAULT_PREFERENCES, position: { x: -1200, y: 88 }, visible: false, reducedMotion: true, recallShortcut: 'Alt+F12' };
    store.save(preferences); assert.deepEqual(new PreferencesStore(file).load().preferences, preferences);
    store.save({ ...preferences, visible: true }); assert.equal(new PreferencesStore(file).load().preferences.visible, true);
    assert.deepEqual(readdirSync(join(folder, 'nested')), ['preferences.json']);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('preserves a corrupt original and reports recovery explicitly', () => {
  const folder = mkdtempSync(join(tmpdir(), 'aether-corrupt-'));
  try {
    const file = join(folder, 'preferences.json'); writeFileSync(file, '{broken');
    const store = new PreferencesStore(file); const result = store.load();
    assert.deepEqual(result.preferences, DEFAULT_PREFERENCES); assert.match(result.notice!, /conservé/);
    const backup = readdirSync(folder).find(name => name.includes('.invalid-'))!;
    assert.equal(readFileSync(join(folder, backup), 'utf8'), '{broken');
    store.save(result.preferences); assert.equal(store.load().notice, null);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('a rejected save cannot overwrite valid preferences', () => {
  const folder = mkdtempSync(join(tmpdir(), 'aether-save-'));
  try {
    const file = join(folder, 'preferences.json'); const store = new PreferencesStore(file); store.save(structuredClone(DEFAULT_PREFERENCES));
    assert.throws(() => store.save({ ...DEFAULT_PREFERENCES, recallShortcut: 'Space' }));
    assert.deepEqual(store.load().preferences, DEFAULT_PREFERENCES);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
