import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import type { Preferences } from '@aether/shared';

const run = promisify(execFile);
async function input(action: string, x = 0, y = 0, shortcut = 'Control+Alt+Space') {
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('tests/e2e/win32-input.ps1'), '-Action', action, '-X', String(x), '-Y', String(y), '-Shortcut', shortcut], { windowsHide: true });
}
async function launch(profile: string) {
  const env: Record<string, string> = { AETHER_TEST_PROFILE: profile };
  for (const [key, value] of Object.entries(process.env)) if (typeof value === 'string') env[key] = value;
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({ args: [resolve('.')], env });
}
async function entityPage(application: ElectronApplication): Promise<Page> {
  const page = await application.firstWindow();
  await expect(page.getByRole('button', { name: 'ENTITY — cliquer ou déplacer' })).toBeVisible();
  return page;
}
async function getEntityBounds(application: ElectronApplication) {
  return application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.getBounds());
}
async function setLogicalCursor(application: ElectronApplication, x: number, y: number) {
  const physical = await application.evaluate(({ screen }, point) => screen.dipToScreenPoint(point), { x, y });
  await input('move', physical.x, physical.y);
}

test('real desktop presence: transparency, clicks, drag, settings, recall, security and restart', async () => {
  test.skip(process.platform !== 'win32', 'Recette Windows native.');
  const profile = await mkdtemp(join(tmpdir(), 'aether-e2e-'));
  let application: ElectronApplication | undefined;
  try {
    application = await launch(profile); const page = await entityPage(application);
    await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(true);
    const initial = await getEntityBounds(application);
    // Windows may round the outer rectangle at fractional DPI; the rendered stage stays 160 DIP.
    expect(initial.width).toBeGreaterThanOrEqual(160); expect(initial.width).toBeLessThanOrEqual(164);
    expect(initial.height).toBeGreaterThanOrEqual(160); expect(initial.height).toBeLessThanOrEqual(164);
    expect(await page.locator('.entity-stage').boundingBox()).toMatchObject({ width: 160, height: 160 });
    expect(await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      return { resizable: window.isResizable(), top: window.isAlwaysOnTop() };
    })).toMatchObject({ resizable: false, top: true });
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    const alpha = await application.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage();
      const size = image.getSize(), bitmap = image.toBitmap();
      return { corner: bitmap[3], center: bitmap[(Math.floor(size.height / 2) * size.width + Math.floor(size.width / 2)) * 4 + 3] };
    });
    expect(alpha.corner).toBe(0); expect(alpha.center).toBeGreaterThan(200);
    expect(await page.evaluate(() => ({ require: typeof (window as unknown as { require: unknown }).require, process: typeof (window as unknown as { process: unknown }).process }))).toEqual({ require: 'undefined', process: 'undefined' });
    const snapshot = await page.evaluate(() => window.aether.getSnapshot());
    expect(Object.values(snapshot.permissions).every(value => value === false)).toBe(true);
    expect(snapshot.features.mind).toBe('available'); expect(snapshot.features.memory).toBe('available'); expect(snapshot.shortcutRegistered).toBe(true);
    await page.screenshot({ path: 'test-results/entity.png', omitBackground: true });

    // Place a real native window below ENTITY. A corner click must reach it.
    await application.evaluate(async ({ BrowserWindow }, bounds) => {
      const target = new BrowserWindow({ title: 'AETHER test click target', x: bounds.x, y: bounds.y, width: 160, height: 160, frame: false, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
      await target.loadURL('data:text/html,<body style="margin:0;background:%23283941"><button style="width:160px;height:160px" onclick="document.title=\'clicked-through\'">target</button></body>');
      // Keep the fixture above unrelated desktop windows, with ENTITY still above the fixture.
      target.setAlwaysOnTop(true);
      target.show();
      BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.moveTop();
    }, initial);
    await setLogicalCursor(application, initial.x + 8, initial.y + 8); await input('click');
    const cursor = await application.evaluate(({ screen }) => screen.getCursorScreenPoint());
    expect(Math.abs(cursor.x - initial.x - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(cursor.y - initial.y - 8)).toBeLessThanOrEqual(1);
    await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.webContents.getTitle() === 'clicked-through'))).toBe(true);

    // The corner click activates the fixture; restore ENTITY above it before testing the central hit surface.
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.moveTop());
    await setLogicalCursor(application, initial.x + 80, initial.y + 80); await input('click');
    await expect(page.locator('.entity-stage')).toHaveAttribute('data-state', 'attention');
    await page.evaluate(() => window.aether.command('close-dialogue'));
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window.getTitle().includes('test click target') || window.webContents.getTitle() === 'clicked-through').forEach(window => window.destroy()));
    await expect(page.locator('.entity-stage')).toHaveAttribute('data-state', 'idle');
    await setLogicalCursor(application, initial.x + 80, initial.y + 80);
    const dragTarget=await application.evaluate(({screen},point)=>screen.dipToScreenPoint(point),{x:initial.x+10,y:initial.y+30});
    await input('drag',dragTarget.x,dragTarget.y);
    await expect.poll(async () => (await getEntityBounds(application!)).x).toBe(initial.x - 70);
    const dragged = await getEntityBounds(application);
    await expect.poll(async () => JSON.parse(await readFile(join(profile, 'preferences.json'), 'utf8')).position).toEqual({ x: dragged.x, y: dragged.y });

    await page.evaluate(() => window.aether.command('settings'));
    await expect.poll(() => application!.windows().length).toBe(2);
    const settings = application.windows().find(window => window !== page)!;
    await expect(settings.getByRole('heading', { name: 'ENTITY, sur votre bureau' })).toBeVisible();
    await settings.locator('#recall-shortcut').focus(); await settings.keyboard.press('Control+Alt+F10');
    await settings.getByRole('checkbox', { name: 'Réduire les animations' }).check();
    await settings.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(settings.getByRole('status').filter({ hasText: 'Réglages enregistrés.' })).toHaveText('Réglages enregistrés.');
    await expect(page.locator('.entity-stage')).toHaveClass(/reduce-motion/);
    await settings.screenshot({ path: 'test-results/settings.png', fullPage: true });
    // An actual OS registration conflict must leave the previous shortcut and file intact.
    expect(await application.evaluate(({ globalShortcut }) => globalShortcut.register('Control+Alt+F11', () => {}))).toBe(true);
    const conflicted = await settings.evaluate(() => window.aether.saveSettings({ recallShortcut: 'Control+Alt+F11', reducedMotion: false }));
    expect(conflicted).toMatchObject({ ok: false, error: expect.stringContaining('déjà utilisé') });
    expect((await settings.evaluate(() => window.aether.getSnapshot())).preferences.recallShortcut).toBe('Control+Alt+F10');
    await application.evaluate(({ globalShortcut }) => globalShortcut.unregister('Control+Alt+F11'));
    const unauthorized = await application.evaluate(async ({ app, BrowserWindow }) => {
      const probe = new BrowserWindow({ show: false, webPreferences: { preload: `${app.getAppPath()}/dist/main/preload.cjs`, sandbox: true, contextIsolation: true, nodeIntegration: false } });
      try {
        await probe.loadURL('data:text/html,<title>untrusted IPC probe</title>');
        return await probe.webContents.executeJavaScript("window.aether.getSnapshot().then(() => 'accepted', () => 'denied')");
      } finally { probe.destroy(); }
    });
    expect(unauthorized).toBe('denied');
    await settings.getByRole('button', { name: 'Masquer', exact: true }).click();
    await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.isVisible())).toBe(false);
    await input('shortcut', 0, 0, 'Control+Alt+F10');
    await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.getTitle() === 'AETHER · ENTITY')!.isVisible())).toBe(true);
    for (let index = 0; index < 6; index++) await page.evaluate(() => window.aether.command('recall'));
    const recalledBounds = await getEntityBounds(application);
    expect(recalledBounds.width).toBeLessThanOrEqual(164); expect(recalledBounds.height).toBeLessThanOrEqual(164);
    const portal = await page.evaluate(() => window.aether.command('portal')); expect(portal.ok).toBe(true);
    await expect.poll(() => application!.windows().some(window => window.url().endsWith('#space'))).toBe(true);
    const space = application.windows().find(window => window.url().endsWith('#space'))!;
    await expect(space.locator('.portal-shell')).toHaveAttribute('data-portal-phase', 'open');
    await space.evaluate(() => window.aether.portalControl('close'));
    await expect.poll(() => application!.windows().some(window => window.url().endsWith('#space'))).toBe(false);
    expect(await getEntityBounds(application)).toMatchObject({ x: recalledBounds.x, y: recalledBounds.y });
    const invalid = await settings.evaluate(() => window.aether.saveSettings({ recallShortcut: 'Space', reducedMotion: true })); expect(invalid.ok).toBe(false);
    expect(await page.evaluate(async () => { try { await navigator.mediaDevices.getUserMedia({ audio: true }); return 'granted'; } catch { return 'denied'; } })).toBe('denied');
    const popup = await page.evaluate(() => window.open('https://example.com')); expect(popup).toBeNull();
    const beforeRestart = await page.evaluate(() => window.aether.getSnapshot());
    await application.close(); application = undefined;
    const persisted = JSON.parse(await readFile(join(profile, 'preferences.json'), 'utf8')) as Preferences;
    expect(persisted.recallShortcut).toBe('Control+Alt+F10'); expect(persisted.reducedMotion).toBe(true);
    application = await launch(profile); const restarted = await entityPage(application);
    const after = await restarted.evaluate(() => window.aether.getSnapshot());
    expect(after.preferences).toEqual(beforeRestart.preferences);
    expect(await getEntityBounds(application)).toMatchObject({ x: dragged.x, y: dragged.y });
    await restarted.evaluate(() => window.aether.command('hide')); await application.close(); application = undefined;
    application = await launch(profile); const hidden = await entityPage(application);
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(false);
    await input('shortcut', 0, 0, 'Control+Alt+F10');
    await expect.poll(() => application!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible())).toBe(true);
    expect((await hidden.evaluate(() => window.aether.getSnapshot())).preferences.visible).toBe(true);
  } finally {
    await input('up').catch(() => {});
    await application?.close(); await rm(profile, { recursive: true, force: true });
  }
});
