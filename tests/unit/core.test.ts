import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPosition, DEFAULT_PREFERENCES, DENIED_PERMISSIONS, ENTITY_SIZE, EventBus, isEntityHit, isShortcut, parsePreferences, parseSettings, PresenceModel, ShortcutManager } from '@aether/core';

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const left = { x: -1280, y: 100, width: 1280, height: 984 };
test('restores coordinates on a secondary display with a negative origin', () => {
  assert.deepEqual(clampPosition({ x: -1100, y: 230 }, [primary, left]), { x: -1100, y: 230 });
});
test('recovers a removed display and keeps the entire entity inside the work area', () => {
  assert.deepEqual(clampPosition({ x: -1100, y: -900 }, [primary]), { x: 0, y: 0 });
  assert.deepEqual(clampPosition({ x: 5000, y: 6000 }, [primary]), { x: 1920 - ENTITY_SIZE, y: 1040 - ENTITY_SIZE });
  assert.deepEqual(clampPosition(null, [primary]), { x: 1720, y: 840 });
});
test('uses the nearest work area across monitor gaps and mixed sizes', () => {
  const right = { x: 2200, y: -400, width: 1280, height: 900 };
  assert.deepEqual(clampPosition({ x: 2150, y: -300 }, [primary, right]), { x: 2200, y: -300 });
  assert.deepEqual(clampPosition({ x: 0, y: 0 }, [{ x: 0, y: 0, width: 100, height: 90 }]), { x: 0, y: 0 });
  assert.throws(() => clampPosition(null, []), /écran/);
});
test('only the central entity surface captures input, transparent margins pass through', () => {
  const bounds = { x: -200, y: 50, width: ENTITY_SIZE, height: ENTITY_SIZE };
  assert.equal(isEntityHit({ x: -120, y: 130 }, bounds), true);
  assert.equal(isEntityHit({ x: -120, y: 179 }, bounds), true);
  assert.equal(isEntityHit({ x: -120, y: 180 }, bounds), false);
  assert.equal(isEntityHit({ x: -190, y: 60 }, bounds), false);
  assert.equal(isEntityHit({ x: 800, y: 130 }, bounds), false);
});
test('validates shortcut modifiers and rejects bare, conflicting and arbitrary input', () => {
  for (const value of ['Control+Alt+Space', 'Super+Shift+F24', 'CommandOrControl+A']) assert.equal(isShortcut(value), true);
  for (const value of ['Space', 'Shift+A', 'Alt+Alt+A', 'Control+CommandOrControl+A', 'Control+Escape', 'Control+F25', 'Alt+../../foo', 'Control+Alt+']) assert.equal(isShortcut(value), false);
});
test('rejects malformed settings and position data instead of silently coercing', () => {
  assert.throws(() => parseSettings({ recallShortcut: 'Control+A', reducedMotion: 'false' }));
  assert.throws(() => parseSettings({ recallShortcut: 'Control+A', reducedMotion: true, command: 'execute' }));
  assert.throws(() => parsePreferences({ ...DEFAULT_PREFERENCES, position: { x: Infinity, y: 2 } }));
  assert.throws(() => parsePreferences({ ...DEFAULT_PREFERENCES, schemaVersion: 2 }));
  assert.deepEqual(parsePreferences(DEFAULT_PREFERENCES), DEFAULT_PREFERENCES);
});
test('all sensitive permissions and future modules are unavailable', () => {
  const model = new PresenceModel(structuredClone(DEFAULT_PREFERENCES));
  assert.deepEqual(model.snapshot().permissions, DENIED_PERMISSIONS);
  assert.ok(Object.values(model.snapshot().permissions).every(value => value === false));
  for (const [key, status] of Object.entries(model.snapshot().features)) assert.equal(status, key === 'presence' ? 'available' : 'not-implemented');
  for (const state of ['listening', 'observing', 'thinking', 'suggesting', 'creating'] as const) assert.throws(() => model.setState(state), /non implémenté/);
  model.setState('attention'); assert.equal(model.snapshot().state, 'attention');
});
test('snapshots cannot mutate model preferences, event listeners unsubscribe', () => {
  const model = new PresenceModel(structuredClone(DEFAULT_PREFERENCES));
  let events = 0;
  const unsubscribe = model.events.on('presence.changed', () => events++);
  model.snapshot().preferences.recallShortcut = 'Alt+B';
  assert.equal(model.snapshot().preferences.recallShortcut, 'Control+Alt+Space');
  model.setState('attention'); unsubscribe(); model.setState('idle'); assert.equal(events, 1);
  const bus = new EventBus<{ value: number }>(); let received = 0;
  bus.on('value', value => received = value); bus.emit('value', 42); assert.equal(received, 42);
});
test('shortcut conflicts and storage rollback keep the previous recall shortcut live', () => {
  const registered = new Map<string, () => void>(); const occupied = new Set(['Alt+B']); let recalled = 0;
  const manager = new ShortcutManager({ register: (key, fn) => { if (occupied.has(key)) return false; registered.set(key, fn); return true; }, unregister: key => { registered.delete(key); } }, () => recalled++);
  manager.prepare('Control+Alt+Space').commit();
  assert.throws(() => manager.prepare('Alt+B'), /déjà utilisé/);
  assert.ok(registered.has('Control+Alt+Space'));
  const transaction = manager.prepare('Alt+C'); transaction.rollback();
  assert.ok(registered.has('Control+Alt+Space')); assert.equal(registered.has('Alt+C'), false);
  const next = manager.prepare('Alt+D'); next.commit(); next.commit();
  assert.equal(registered.has('Control+Alt+Space'), false); registered.get('Alt+D')!(); assert.equal(recalled, 1);
  manager.dispose(); assert.equal(registered.size, 0);
});
