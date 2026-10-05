import { test, expect, _electron as electron } from '@playwright/test';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('development server renders styled ENTITY through the sandboxed preload', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'aether-dev-test-'));
  const server = await createServer();
  await server.listen();
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (typeof value === 'string') env[key] = value;
  delete env.ELECTRON_RUN_AS_NODE;
  env.AETHER_TEST_PROFILE = profile; env.AETHER_RENDERER_URL = 'http://127.0.0.1:5177';
  const application = await electron.launch({ args: [resolve('.')], env });
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole('button', { name: 'ENTITY — cliquer ou déplacer' })).toBeVisible();
    expect(await page.locator('.entity-target').boundingBox()).toMatchObject({ x: 31, y: 31, width: 98, height: 98 });
    const preferences = await page.evaluate(() => window.aether.getSnapshot());
    expect(preferences.features.presence).toBe('available');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  } finally { await application.close(); await server.close(); await rm(profile, { recursive: true, force: true }); }
});
