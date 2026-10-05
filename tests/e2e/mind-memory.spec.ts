import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

async function launch(profile: string) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (typeof value === 'string') env[key] = value;
  delete env.ELECTRON_RUN_AS_NODE; delete env.OPENAI_API_KEY;
  env.AETHER_TEST_PROFILE = profile;
  const application = await electron.launch({ args: [resolve('.')], env });
  const entity = await application.firstWindow();
  await expect(entity.getByRole('button', { name: 'ENTITY — cliquer ou déplacer' })).toBeVisible();
  expect((await entity.evaluate(() => window.aether.getSnapshot())).features.mind).toBe('available');
  return { application, entity };
}
async function view(application: ElectronApplication, entity: Page, name: 'settings' | 'dialogue' | 'memory') {
  expect((await entity.evaluate(command => window.aether.command(command), name)).ok).toBe(true);
  await expect.poll(() => application.windows().some(page => page.url().endsWith(`#${name}`))).toBe(true);
  const page = application.windows().find(page => page.url().endsWith(`#${name}`))!;
  if (name === 'dialogue') await expect(page.getByRole('textbox', { name: 'Message à ENTITY' })).toBeVisible();
  if (name === 'settings') await expect(page.getByLabel('Fournisseur', { exact: true })).toBeVisible();
  if (name === 'memory') await expect(page.getByRole('heading', { name: 'Ce qu’ENTITY retient' })).toBeVisible();
  return page;
}
async function configureLocal(settings: Page, url = 'http://127.0.0.1:11434') {
  await settings.getByLabel('Fournisseur', { exact: true }).selectOption('ollama');
  await settings.getByLabel('Adresse locale Ollama').fill(url);
  await settings.getByLabel('Modèle', { exact: true }).fill('llama3.1:8b');
  await settings.getByRole('button', { name: 'Enregistrer l’IA', exact: true }).click();
  await expect(settings.getByRole('status').filter({ hasText: 'Configuration IA enregistrée.' })).toBeVisible();
}
async function send(dialogue: Page, text: string) {
  await dialogue.getByRole('textbox', { name: 'Message à ENTITY' }).fill(text);
  await dialogue.getByRole('button', { name: 'Envoyer', exact: true }).click();
}
async function answer(dialogue: Page) {
  await expect.poll(async () => {
    const snapshot = await dialogue.evaluate(() => window.aether.getMind());
    return snapshot.messages.at(-1)?.role;
  }, { timeout: 125000, intervals: [200, 500, 1000] }).toBe('assistant');
  const snapshot = await dialogue.evaluate(() => window.aether.getMind());
  expect(snapshot.error).toBeNull();
  return snapshot.messages.at(-1)!;
}
async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test('J2 A–E: actual Ollama dialogue, durable restart, visible thinking, UI correction/deletion and real errors', async () => {
  test.setTimeout(300000);
  const profile = await mkdtemp(join(tmpdir(), 'aether-j2-real-'));
  const marker = `Luciole-${randomBytes(3).toString('hex')}`;
  const evidence: Record<string, unknown> = { provider: 'ollama', model: 'llama3.1:8b', marker, startedAt: new Date().toISOString() };
  let application: ElectronApplication | undefined;
  try {
    let launched = await launch(profile); application = launched.application; let entity = launched.entity;
    let settings = await view(application, entity, 'settings');
    let dialogue = await view(application, entity, 'dialogue');
    // E: a real disabled configuration surfaces an error, without a synthetic answer.
    await send(dialogue, 'Comment t’appelles-tu ?');
    await expect(dialogue.getByRole('alert')).toContainText('Aucune IA n’est configurée');
    expect((await dialogue.evaluate(() => window.aether.getMind())).messages.filter(item => item.role === 'assistant')).toHaveLength(0);
    evidence.E_unconfigured = await dialogue.getByRole('alert').innerText();
    await configureLocal(settings);
    await settings.getByRole('button', { name: 'Rechercher les modèles installés' }).click();
    await expect(settings.getByRole('status').filter({ hasText: 'modèles installés trouvés' })).toBeVisible();
    expect(await settings.locator('#installed-models option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toContain('llama3.1:8b');
    await settings.screenshot({ path: 'test-results/j2-settings.png', fullPage: true });
    // A + D: capture the real pending state before the provider completes.
    await send(dialogue, 'Comment t’appelles-tu ?');
    await expect(entity.locator('.entity-stage')).toHaveAttribute('data-state', 'thinking');
    await expect(dialogue.getByRole('status')).toContainText('Le modèle prépare sa réponse');
    await entity.screenshot({ path: 'test-results/j2-thinking.png', omitBackground: true });
    await dialogue.screenshot({ path: 'test-results/j2-dialogue-thinking.png' });
    evidence.D_thinking = true;
    const identity = await answer(dialogue);
    expect(identity.content).toMatch(/ENTITY/i); expect(identity.model).toBe('llama3.1:8b');
    evidence.A_identity = identity;
    // Ordinary dialogue is ephemeral; only an explicit request writes SQLite.
    expect(await entity.evaluate(() => window.aether.listMemories())).toHaveLength(0);
    await send(dialogue, `Retiens que le nom de mon projet de démonstration est ${marker}.`);
    const retention = await answer(dialogue);
    await expect(dialogue.locator('.memory-receipt')).toContainText(marker);
    const memories = await entity.evaluate(() => window.aether.listMemories());
    expect(memories).toHaveLength(1); expect(memories[0]!.origin).toBe('explicit'); expect(memories[0]!.confidence).toBeNull();
    evidence.B_retention = { response: retention, memory: memories[0] };
    await application.close(); application = undefined;
    launched = await launch(profile); application = launched.application; entity = launched.entity;
    expect((await entity.evaluate(() => window.aether.getAiConfiguration())).provider).toBe('ollama');
    expect((await entity.evaluate(() => window.aether.getMind())).messages).toHaveLength(0);
    dialogue = await view(application, entity, 'dialogue');
    await send(dialogue, 'Quel est le nom de mon projet de démonstration ?');
    const recalled = await answer(dialogue);
    expect(recalled.content.toLowerCase()).toContain(marker.toLowerCase());
    expect((await dialogue.evaluate(() => window.aether.getMind())).usedMemories[0]!.id).toBe(memories[0]!.id);
    evidence.B_afterRestart = recalled;
    await dialogue.screenshot({ path: 'test-results/j2-dialogue-recalled.png' });
    // C: inspect and actually delete in the MEMORY UI. No stale conversation remains.
    const memory = await view(application, entity, 'memory');
    await expect(memory.locator('.memory-item')).toHaveCount(1);
    await expect(memory.locator('.origin-badge')).toHaveText('Donné explicitement');
    await expect(memory.locator('.memory-source').first()).toContainText('demande explicite');
    await memory.screenshot({ path: 'test-results/j2-memory.png', fullPage: true });
    await memory.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await memory.getByRole('button', { name: 'Confirmer la suppression' }).click();
    await expect(memory.locator('.memory-item')).toHaveCount(0);
    expect((await entity.evaluate(() => window.aether.getMind())).messages).toHaveLength(0);
    expect(await entity.evaluate(() => window.aether.listMemories())).toHaveLength(0);
    await send(dialogue, 'Quel est le nom de mon projet de démonstration ?');
    const forgotten = await answer(dialogue);
    expect(forgotten.content.toLowerCase()).not.toContain(marker.toLowerCase());
    expect(forgotten.content).toMatch(/(?:ne .*(?:sais|connais|souviens)|pas|aucun|ignor|inconn|disponible|renseign)/i);
    expect((await dialogue.evaluate(() => window.aether.getMind())).usedMemories).toHaveLength(0);
    evidence.C_afterDeletion = forgotten;
    // Editing and hypothesis distinction operate on the same durable database.
    await memory.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await memory.getByLabel('Contenu', { exact: true }).fill('L’utilisateur semble aimer les documentaires.');
    await memory.getByLabel('Nature', { exact: true }).selectOption('inference');
    await memory.getByLabel('Confiance de l’hypothèse', { exact: false }).fill('0.65');
    await memory.getByRole('button', { name: 'Enregistrer le souvenir' }).click();
    await expect(memory.locator('.origin-badge')).toHaveText('Hypothèse · confiance 0.65');
    await memory.getByRole('button', { name: 'Corriger', exact: true }).click();
    await memory.getByLabel('Contenu', { exact: true }).fill('L’utilisateur aime les documentaires, déclaration corrigée.');
    await memory.getByLabel('Nature', { exact: true }).selectOption('explicit');
    await memory.getByRole('button', { name: 'Enregistrer le souvenir' }).click();
    await expect(memory.locator('.origin-badge')).toHaveText('Donné explicitement');
    await expect(memory.locator('.memory-content')).toContainText('déclaration corrigée');
    expect((await entity.evaluate(() => window.aether.getMind())).messages).toHaveLength(0);
    await memory.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await memory.getByRole('button', { name: 'Confirmer la suppression' }).click();
    await expect(memory.locator('.memory-item')).toHaveCount(0);
    // E: a closed loopback port causes an actual connection error, never a fallback answer.
    settings = await view(application, entity, 'settings');
    await configureLocal(settings, `http://127.0.0.1:${await unusedPort()}`);
    await send(dialogue, 'Es-tu disponible ?');
    await expect(dialogue.getByRole('alert')).toContainText('indisponible');
    const failed = await dialogue.evaluate(() => window.aether.getMind());
    expect(failed.messages.filter(item => item.role === 'assistant')).toHaveLength(0);
    evidence.E_unavailable = failed.error;
    await dialogue.screenshot({ path: 'test-results/j2-error.png' });
    await configureLocal(settings);
    // Escape closes the small contextual window, preserving the desktop entity.
    await dialogue.getByRole('textbox', { name: 'Message à ENTITY' }).focus();
    await dialogue.keyboard.press('Escape').catch(error => { if (!dialogue.isClosed()) throw error; });
    await expect.poll(() => application!.windows().some(page => page.url().endsWith('#dialogue'))).toBe(false);
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.isVisible())).toBe(true);
    evidence.completedAt = new Date().toISOString();
    await writeFile('test-results/j2-real-evidence.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ A: identity.content, B: recalled.content, C: forgotten.content, D: true, E: [evidence.E_unconfigured, evidence.E_unavailable] }));
  } finally { await application?.close(); await rm(profile, { recursive: true, force: true }); }
});

test('Windows secret encryption, renderer isolation, restart and key removal use the real safeStorage vault', async () => {
  test.skip(process.platform !== 'win32');
  const profile = await mkdtemp(join(tmpdir(), 'aether-vault-test-'));
  const testKey = 'unit-test-placeholder-never-sent-to-a-provider';
  let application: ElectronApplication | undefined;
  try {
    let launched = await launch(profile); application = launched.application;
    let settings = await view(application, launched.entity, 'settings');
    expect((await settings.evaluate(() => window.aether.getAiConfiguration())).secureStorageAvailable).toBe(true);
    await settings.getByLabel('Fournisseur', { exact: true }).selectOption('openai');
    await settings.getByLabel('Clé API OpenAI').fill(testKey);
    await settings.getByRole('button', { name: 'Enregistrer l’IA', exact: true }).click();
    await expect(settings.getByRole('status').filter({ hasText: 'Configuration IA enregistrée.' })).toBeVisible();
    await expect(settings.getByLabel('Clé API OpenAI')).toHaveValue('');
    const configuration = await settings.evaluate(() => window.aether.getAiConfiguration());
    expect(configuration.keyConfigured).toBe(true); expect(configuration.cloudConsent).toBe(false);
    expect(JSON.stringify(configuration)).not.toContain(testKey); expect('apiKey' in configuration).toBe(false);
    const encrypted = await readFile(join(profile, 'openai-key.encrypted'));
    expect(encrypted.includes(Buffer.from(testKey))).toBe(false);
    expect(await application.evaluate(({ safeStorage }, { bytes, expected }) => safeStorage.decryptString(Buffer.from(bytes)) === expected, { bytes: [...encrypted], expected: testKey })).toBe(true);
    expect(await readFile(join(profile, 'ai-settings.json'), 'utf8')).not.toContain(testKey);
    // No cloud consent means no provider request, even with a configured placeholder key.
    const dialogue = await view(application, launched.entity, 'dialogue');
    await send(dialogue, 'Bonjour'); await expect(dialogue.getByRole('alert')).toContainText('n’est pas autorisé');
    expect((await dialogue.evaluate(() => window.aether.getMind())).messages.filter(item => item.role === 'assistant')).toHaveLength(0);
    await application.close(); application = undefined;
    launched = await launch(profile); application = launched.application; settings = await view(application, launched.entity, 'settings');
    expect((await settings.evaluate(() => window.aether.getAiConfiguration())).keyConfigured).toBe(true);
    await settings.getByRole('button', { name: 'Supprimer la clé configurée' }).click();
    await expect.poll(async () => (await settings.evaluate(() => window.aether.getAiConfiguration())).keyConfigured).toBe(false);
    await expect(settings.getByLabel('Clé API OpenAI')).toHaveValue('');
    await expect.poll(async () => { try { await readFile(join(profile, 'openai-key.encrypted')); return true; } catch { return false; } }).toBe(false);
  } finally { await application?.close(); await rm(profile, { recursive: true, force: true }); }
});
