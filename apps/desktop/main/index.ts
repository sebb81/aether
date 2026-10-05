import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clampPosition, DRAG_THRESHOLD, ENTITY_SIZE, isEntityHit, parseSettings, PresenceModel, ShortcutManager } from '@aether/core';
import { IPC, type MindSnapshot, type OperationResult, type Point, type Preferences, type PresenceCommand } from '@aether/shared';
import { PreferencesStore } from './preferences-store';
import { DesktopMindService } from './mind-service';
import { createCuriosity } from './curiosity-service';
import type { CuriosityEngine } from '@aether/curiosity';
import type { CuriosityObjectKind, CuriositySnapshot } from '@aether/shared';
import {existingSelection,parsePortalSettings,parseSpaceView,PortalLifecycle} from '@aether/space';
import type {PortalSettings,SpaceData,SpacePreferences,SpaceSnapshot} from '@aether/shared';
import {PortalSettingsStore,SpacePreferencesStore} from './space-storage';
import {createEcho} from './echo-service';
import type {EchoEngine} from '@aether/echo';
import type {EchoSnapshot} from '@aether/shared';

app.setName('AETHER');
// Tests use a profile isolated from the user's preferences. Production ignores overrides.
const testProfile = !app.isPackaged && process.env.AETHER_TEST_PROFILE;
if (testProfile) app.setPath('userData', resolve(testProfile));
else app.setPath('userData', join(app.getPath('appData'), 'AETHER'));

const hasLock = app.requestSingleInstanceLock();
let entity: BrowserWindow;
let settings: BrowserWindow | null = null;
let dialogue: BrowserWindow | null = null;
let memoryWindow: BrowserWindow | null = null;
let curiosityWindow: BrowserWindow | null = null;
let curiosity: CuriosityEngine | null = null;
let echo:EchoEngine|null=null;
let echoWindow:BrowserWindow|null=null;
let spaceWindow:BrowserWindow|null=null;
const portal=new PortalLifecycle();
let portalTimer:ReturnType<typeof setTimeout>|undefined;
let singleClickTimer:ReturnType<typeof setTimeout>|undefined;
let portalShortcuts:ShortcutManager;
let portalSettings:PortalSettings;
let portalStore:PortalSettingsStore;
let spaceStore:SpacePreferencesStore;
let spacePreferences:SpacePreferences;
let spaceSince:string|null=null;
let mindService: DesktopMindService | null = null;
let tray: Tray | null = null;
let model: PresenceModel;
let store: PreferencesStore;
let shortcuts: ShortcutManager;
let quitting = false;
let hitTimer: ReturnType<typeof setInterval> | undefined;
let attentionTimer: ReturnType<typeof setTimeout> | undefined;
let ignoreMouse = true;
let drag: { origin: Point; cursor: Point; moved: boolean; lastUpdate: number } | null = null;
let dragWatchdog: ReturnType<typeof setTimeout> | undefined;

const rendererFile = resolve(__dirname, '../renderer/index.html');
const rendererURL = (() => {
  if (app.isPackaged || !process.env.AETHER_RENDERER_URL) return null;
  const url = new URL(process.env.AETHER_RENDERER_URL);
  if (url.origin !== 'http://127.0.0.1:5177' || url.pathname !== '/') throw new Error('Le rendu de développement doit être http://127.0.0.1:5177.');
  return url.origin;
})();
const baseURL = rendererURL ?? pathToFileURL(rendererFile).href;
const approvedURLs = new Set(['entity', 'settings', 'dialogue', 'memory', 'curiosity','space','echo'].flatMap(view => [`${baseURL}#${view}`, ...(rendererURL ? [`${baseURL}/#${view}`] : [])]));
function workAreas() {
  const primary = screen.getPrimaryDisplay();
  return [primary, ...screen.getAllDisplays().filter(display => display.id !== primary.id)].map(display => display.workArea);
}
function persist(next: Preferences) { store.save(next); model.setPreferences(next); }
function report(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[AETHER]', message);
  if (model) model.setNotice(message);
  refreshTray();
  return { ok: false, error: message } as const;
}
function guardPersistence(action: () => void): void { try { action(); } catch (error) { report(error); } }
function secureWindow(window: BrowserWindow) {
  window.on('page-title-updated', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting && !window.isDestroyed() && details.reason!=='clean-exit') {
      report(new Error(`Le rendu s'est arrêté (${details.reason}). Rappelez ENTITY depuis le tray pour le recharger.`));
      // A secondary renderer must not disable ENTITY's native hit testing.
      if(window===entity)stopHitTesting();
      if(window===echoWindow)echo?.disable();
    }
  });
}
async function load(window: BrowserWindow, view: 'entity' | 'settings' | 'dialogue' | 'memory' | 'curiosity'|'space'|'echo') {
  if (rendererURL) await window.loadURL(`${rendererURL}/#${view}`);
  else await window.loadFile(rendererFile, { hash: view });
}
function setIgnored(ignored: boolean) {
  if (!entity || entity.isDestroyed() || ignored === ignoreMouse) return;
  ignoreMouse = ignored;
  entity.setIgnoreMouseEvents(ignored, { forward: true });
}
function updateHitTesting() {
  if (!entity || entity.isDestroyed() || !entity.isVisible()) return;
  setIgnored(drag === null && !isEntityHit(screen.getCursorScreenPoint(), entity.getBounds()));
}
function startHitTesting() {
  stopHitTesting(); updateHitTesting();
  hitTimer = setInterval(updateHitTesting, 30);
}
function stopHitTesting() { if (hitTimer) clearInterval(hitTimer); hitTimer = undefined; }
function attention() {
  if (attentionTimer) clearTimeout(attentionTimer);
  if (mindService?.engine.snapshot().state !== 'thinking' && !curiosity?.isExploring() && !echo?.isBusy()) model.setState('attention');
  attentionTimer = setTimeout(() => { if (mindService?.engine.snapshot().state !== 'thinking' && !curiosity?.isExploring() && !echo?.isBusy()) model.setState('idle'); attentionTimer = undefined; }, 1400);
}
function rememberPosition() {
  if (!entity || entity.isDestroyed()) return;
  const { x, y } = entity.getBounds();
  persist({ ...model.snapshot().preferences, position: { x, y } });
}
function reposition() {
  if (!entity || entity.isDestroyed()) return;
  const { x, y } = entity.getBounds();
  const point = clampPosition({ x, y }, workAreas());
  entity.setBounds({ ...point, width: ENTITY_SIZE, height: ENTITY_SIZE }); guardPersistence(rememberPosition); updateHitTesting();
  positionDialogue();
}
function recall() {
  if (!entity || entity.isDestroyed()) return;
  if(portal.snapshot().phase!=='closed'){guardPersistence(()=>persist({...model.snapshot().preferences,visible:true}));closePortal();return;}
  if (entity.webContents.isCrashed()) void load(entity, 'entity').catch(report);
  reposition(); entity.showInactive(); startHitTesting(); attention();
  guardPersistence(() => persist({ ...model.snapshot().preferences, visible: true }));
  refreshTray();
}
function hide() {
  if(portal.snapshot().phase!=='closed')closePortal();
  closeDialogue();
  finishDrag(false); entity.hide(); stopHitTesting();
  if (attentionTimer) clearTimeout(attentionTimer);
  model.setState('idle');
  guardPersistence(() => persist({ ...model.snapshot().preferences, visible: false }));
  refreshTray();
}
function refreshTray() {
  if (!tray || !model) return;
  tray.setToolTip(`AETHER · ENTITY ${entity.isVisible() ? 'présente' : 'masquée'}${model.snapshot().notice ? ' · Vérifiez les réglages' : ''}`);
  tray.setContextMenu(buildMenu());
}
function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'AETHER · ENTITY', enabled: false },
    ...(model.snapshot().notice ? [{ label: 'Attention : vérifier les réglages…', click: () => { void openSettings().catch(report); } }] : []),
    { type: 'separator' },
    { label: 'Rappeler ENTITY', click: recall },
    { label: 'Masquer ENTITY', enabled: entity.isVisible(), click: hide },
    { label: 'Replacer sur l’écran principal', click: () => {
      const point = clampPosition(null, workAreas()); entity.setBounds({ ...point, width: ENTITY_SIZE, height: ENTITY_SIZE }); recall();
    } },
    { type: 'separator' },
    { label: 'Parler à ENTITY…', click: () => { void openDialogue().catch(report); } },
    { label: 'MEMORY…', click: () => { void openMemory().catch(report); } },
    { label: 'CURIOSITY · journal…', click: () => { void openCuriosity().catch(report); } },
    { label: 'Réglages…', click: () => { void openSettings().catch(report); } },
    {label:portal.snapshot().phase==='closed'?'Entrer dans AETHER…':'Revenir au bureau',click:()=>{void togglePortal().catch(report);}},
    { label: 'ECHO · Regarde comment je fais…', click: () => {void openEcho().catch(report);} },
    { label: 'Arrêter ECHO immédiatement', enabled:echo?.isBusy()??false, click:()=>{if(echo?.isObserving()||echo?.runtimeState()==='paused')void echo.stop().catch(report);else echo?.cancelAnalysis();} },
    { label: 'FORGE / MIRROR · non implémentés', enabled: false },
    { type: 'separator' },
    { label: 'Quitter AETHER', click: () => app.quit() },
  ]);
}
async function openSettings() {
  if (settings && !settings.isDestroyed()) { settings.show(); settings.focus(); return; }
  settings = new BrowserWindow({
    title: 'AETHER — Réglages', width: 660, height: 810, minWidth: 580, minHeight: 640,
    show: false, backgroundColor: '#111b22', autoHideMenuBar: true,
    icon: resolve(__dirname, '../assets/icon.png'),
    webPreferences: { preload: resolve(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  secureWindow(settings); settings.setMenu(null);
  settings.on('closed', () => { settings = null; });
  settings.once('ready-to-show', () => { settings?.show(); });
  await load(settings, 'settings');
}
function requireMind(): DesktopMindService {
  if (!mindService) throw new Error('MIND / MEMORY est indisponible. Consultez les réglages ; aucune réponse ne sera simulée.');
  return mindService;
}
function positionDialogue() {
  if (!dialogue || dialogue.isDestroyed()) return;
  const origin = spaceWindow?.isVisible()?{x:spaceWindow.getBounds().x+spaceWindow.getBounds().width/2-80,y:spaceWindow.getBounds().y+spaceWindow.getBounds().height/2-80}:entity.getBounds(), area = screen.getDisplayMatching({...origin,width:160,height:160}).workArea;
  const width = Math.min(420, area.width), height = Math.min(490, area.height);
  const desiredX = origin.x - width - 10 >= area.x ? origin.x - width - 10 : origin.x + ENTITY_SIZE + 10;
  dialogue.setBounds({ x: Math.max(area.x, Math.min(desiredX, area.x + area.width - width)), y: Math.max(area.y, Math.min(origin.y + 80 - height, area.y + area.height - height)), width, height });
}
function closeDialogue() {
  if(singleClickTimer)clearTimeout(singleClickTimer);singleClickTimer=undefined;
  if (mindService?.engine.snapshot().state === 'thinking') mindService.engine.cancel();
  else mindService?.engine.setState('idle');
  dialogue?.close();
}
async function openDialogue() {
  requireMind();
  curiosity?.invalidate('Priorité au dialogue humain.');
  if (dialogue && !dialogue.isDestroyed()) { positionDialogue(); dialogue.show(); dialogue.focus(); return; }
  dialogue = new BrowserWindow({ title: 'ENTITY — Échange', width: 420, height: 490, frame: false, resizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, show: false, backgroundColor: '#111b22',
    webPreferences: { preload: resolve(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } });
  secureWindow(dialogue); positionDialogue();
  dialogue.on('closed', () => { dialogue = null; if (mindService?.engine.snapshot().state === 'thinking') mindService.engine.cancel(); else mindService?.engine.setState('idle'); });
  dialogue.once('ready-to-show', () => { dialogue?.show(); dialogue?.focus(); });
  mindService?.engine.listening();
  await load(dialogue, 'dialogue');
}
async function openMemory() {
  requireMind();
  if (memoryWindow && !memoryWindow.isDestroyed()) { memoryWindow.show(); memoryWindow.focus(); return; }
  memoryWindow = new BrowserWindow({ title: 'AETHER — MEMORY', width: 700, height: 760, minWidth: 560, minHeight: 580, show: false, autoHideMenuBar: true, backgroundColor: '#111b22', icon: resolve(__dirname, '../assets/icon.png'),
    webPreferences: { preload: resolve(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } });
  secureWindow(memoryWindow); memoryWindow.setMenu(null);
  memoryWindow.on('closed', () => { memoryWindow = null; });
  memoryWindow.once('ready-to-show', () => { memoryWindow?.show(); });
  await load(memoryWindow, 'memory');
}
function reflectMind(snapshot: MindSnapshot) {
  if(quitting)return;
  if (attentionTimer) clearTimeout(attentionTimer);
  const state = snapshot.state === 'thinking' || echo?.runtimeState()==='analysing' ? 'thinking' : echo?.isObserving()?'observing':curiosity?.isExploring() ? 'exploring' : snapshot.state === 'error' ? 'error' : snapshot.state === 'idle' ? 'idle' : 'attention';
  model.setState(state);
  if (state === 'attention' || state === 'error') attentionTimer = setTimeout(() => { if (mindService?.engine.snapshot().state !== 'thinking' && !curiosity?.isExploring() && !echo?.isBusy()) model.setState('idle'); }, 1800);
  for (const window of [entity, dialogue, settings, memoryWindow,curiosityWindow,spaceWindow,echoWindow]) if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC.mindChanged, snapshot);
}
function requireCuriosity() { if (!curiosity) throw new Error('CURIOSITY est indisponible. La présence et le dialogue restent accessibles.'); return curiosity; }
function requireEcho(){if(!echo)throw new Error('ECHO est indisponible. Les autres moteurs restent accessibles.');return echo;}
async function openEcho(){
  requireEcho();if(echoWindow&&!echoWindow.isDestroyed()){echoWindow.show();echoWindow.focus();return;}
  echoWindow=new BrowserWindow({title:'AETHER — ECHO',width:980,height:820,minWidth:760,minHeight:620,show:false,autoHideMenuBar:true,backgroundColor:'#111b22',icon:resolve(__dirname,'../assets/icon.png'),webPreferences:{preload:resolve(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,spellcheck:false}});
  secureWindow(echoWindow);echoWindow.setMenu(null);
  // Closing the control panel terminates perception rather than leaving a hidden observer.
  echoWindow.on('close',()=>{if(!quitting)echo?.disable();});
  echoWindow.on('closed',()=>{echoWindow=null;});echoWindow.once('ready-to-show',()=>echoWindow?.show());await load(echoWindow,'echo');
}
function reflectEcho(snapshot:EchoSnapshot){
  if(quitting)return;model.setEchoActive(snapshot.state==='observing');
  if(snapshot.state==='observing')model.setState('observing');else if(snapshot.state==='analysing')model.setState('thinking');else reflectMind(requireMind().engine.snapshot());
  for(const window of [entity,dialogue,settings,memoryWindow,curiosityWindow,spaceWindow,echoWindow])if(window&&!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send(IPC.echoChanged,snapshot);
  refreshTray();publishSpace();
}
async function openCuriosity() {
  requireCuriosity();
  if (curiosityWindow && !curiosityWindow.isDestroyed()) { curiosityWindow.show(); curiosityWindow.focus(); return; }
  curiosityWindow=new BrowserWindow({title:'AETHER — CURIOSITY',width:860,height:800,minWidth:640,minHeight:580,show:false,autoHideMenuBar:true,backgroundColor:'#111b22',icon:resolve(__dirname,'../assets/icon.png'),webPreferences:{preload:resolve(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,spellcheck:false}});
  secureWindow(curiosityWindow); curiosityWindow.setMenu(null);
  curiosityWindow.on('closed',()=>{curiosityWindow=null;}); curiosityWindow.once('ready-to-show',()=>{curiosityWindow?.show();});
  await load(curiosityWindow,'curiosity');
}
function reflectCuriosity(snapshot: CuriositySnapshot) {
  if (quitting) return;
  model.setDiscoveryPending(snapshot.unreadCount>0);
  if (attentionTimer) clearTimeout(attentionTimer);
  const mind= mindService?.engine.snapshot();
  model.setState(mind?.state==='thinking'||echo?.runtimeState()==='analysing'?'thinking':echo?.isObserving()?'observing':snapshot.state==='exploring'?'exploring':mind?.state==='error'?'error':'idle');
  for (const window of [entity,dialogue,settings,memoryWindow,curiosityWindow,spaceWindow,echoWindow]) if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC.curiosityChanged,snapshot);
  publishSpace();
}
function publishSpace(){if(spaceWindow&&!spaceWindow.isDestroyed())spaceWindow.webContents.send(IPC.spaceChanged);}
async function spaceData():Promise<SpaceData>{return {memories:mindService?await mindService.memory.list():[],curiosity:curiosity?.snapshot()??null,mind:mindService?.engine.snapshot()??null,presence:model.snapshot(),echo:echo?.snapshot()??null};}
function armPortalTimer(){if(portalTimer)clearTimeout(portalTimer);const current=portal.snapshot();if(current.phase==='opening'||current.phase==='closing')portalTimer=setTimeout(()=>portal.settle(current.token),current.durationMs+250);}
function restoreDesktop(){if(quitting)return;reposition();if(model.snapshot().preferences.visible){entity.showInactive();startHitTesting();}refreshTray();}
async function openPortal(){
  if(singleClickTimer)clearTimeout(singleClickTimer);singleClickTimer=undefined;finishDrag(false);closeDialogue();
  if(spaceWindow&&!spaceWindow.isDestroyed()){if(portal.snapshot().phase==='closing'){const current=portal.snapshot();portal.open(current.origin,current.viewport,model.snapshot().preferences.reducedMotion);armPortalTimer();}spaceWindow.show();spaceWindow.focus();return;}
  const bounds=entity.getBounds(),area=screen.getDisplayMatching(bounds).workArea;
  spaceSince=spacePreferences.lastVisitedAt;
  if(!model.snapshot().preferences.visible)guardPersistence(()=>persist({...model.snapshot().preferences,visible:true}));
  spaceWindow=new BrowserWindow({title:'AETHER · SPACE',...area,frame:false,thickFrame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,maximizable:false,fullscreenable:false,show:false,autoHideMenuBar:true,alwaysOnTop:true,webPreferences:{preload:resolve(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,spellcheck:false}});
  const currentWindow=spaceWindow;secureWindow(currentWindow);currentWindow.setMenu(null);
  currentWindow.on('close',event=>{if(!quitting&&portal.snapshot().phase!=='closed'){event.preventDefault();closePortal();}});
  currentWindow.on('closed',()=>{if(spaceWindow===currentWindow)spaceWindow=null;if(portal.snapshot().phase!=='closed')portal.reset();restoreDesktop();});
  portal.open({x:bounds.x+80-area.x,y:bounds.y+80-area.y},area,model.snapshot().preferences.reducedMotion);
  try{
    await load(currentWindow,'space');if(currentWindow.isDestroyed())return;
    currentWindow.show();currentWindow.focus();entity.hide();stopHitTesting();
    const visited={...spacePreferences,lastVisitedAt:new Date().toISOString()};spaceStore.save(visited);spacePreferences=visited;armPortalTimer();refreshTray();
  }catch(error){if(currentWindow.isDestroyed()||spaceWindow!==currentWindow)return;currentWindow.destroy();throw error;}
}
function closePortal(){
  closeDialogue();
  if(!spaceWindow||spaceWindow.isDestroyed()){portal.reset();return;}
  if(!spaceWindow.isVisible()){spaceWindow.destroy();portal.reset();return;}
  portal.close();armPortalTimer();
}
async function togglePortal(){if(portal.snapshot().phase==='closed'||portal.snapshot().phase==='closing')await openPortal();else closePortal();}
function mutateCuriosity(action: (engine: CuriosityEngine)=>void): OperationResult {
  const engine=requireCuriosity(); engine.cancel('Journal modifié par l’utilisateur.'); requireMind().engine.reset('Le journal de curiosité a changé. Nouvelle conversation.');
  try { action(engine); return {ok:true}; } finally { engine.invalidate('Journal mis à jour.'); }
}
function finishDrag(reactToClick = true) {
  if (!drag) return;
  const moved = drag.moved; drag = null;
  if (dragWatchdog) clearTimeout(dragWatchdog);
  if (moved) { reposition(); }
  else if (reactToClick) { attention(); if(singleClickTimer)clearTimeout(singleClickTimer);singleClickTimer=setTimeout(()=>{singleClickTimer=undefined;void openDialogue().catch(report);},320); }
  updateHitTesting();
}
function resetDragWatchdog() {
  if (dragWatchdog) clearTimeout(dragWatchdog);
  dragWatchdog = setTimeout(() => finishDrag(false), 15000);
}
function handleDrag(phase: unknown) {
  if (!entity.isVisible()) return;
  if (phase === 'start') {
    const cursor = screen.getCursorScreenPoint();
    if (!isEntityHit(cursor, entity.getBounds()) || drag) return;
    const { x, y } = entity.getBounds();
    drag = { origin: { x, y }, cursor, moved: false, lastUpdate: 0 };
    setIgnored(false); resetDragWatchdog();
  } else if (phase === 'move' && drag) {
    const now = Date.now(); if (now - drag.lastUpdate < 12) return;
    drag.lastUpdate = now;
    const cursor = screen.getCursorScreenPoint();
    const dx = cursor.x - drag.cursor.x, dy = cursor.y - drag.cursor.y;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) entity.setBounds({ x: Math.round(drag.origin.x + dx), y: Math.round(drag.origin.y + dy), width: ENTITY_SIZE, height: ENTITY_SIZE });
    resetDragWatchdog();
  } else if (phase === 'end') finishDrag();
}
function authorize(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent, entityOnly = false) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || ![entity, settings, dialogue, memoryWindow,curiosityWindow,spaceWindow,echoWindow].includes(window) || (entityOnly && window !== entity)
    || event.senderFrame !== event.sender.mainFrame || !approvedURLs.has(event.senderFrame.url)) throw new Error('Origine IPC non autorisée.');
}
const COMMANDS: readonly PresenceCommand[] = ['interact', 'hide', 'recall', 'settings', 'menu', 'portal', 'quit', 'dialogue', 'memory', 'curiosity', 'close-dialogue','echo'];
function setupIPC() {
  ipcMain.handle(IPC.snapshot, event => { authorize(event); return model.snapshot(); });
  ipcMain.handle(IPC.command, async (event, command: unknown): Promise<OperationResult> => {
    authorize(event);
    try {
      if (typeof command !== 'string' || !COMMANDS.includes(command as PresenceCommand)) throw new Error('Commande inconnue.');
      switch (command) {
        case 'interact': attention(); await openDialogue(); break;
        case 'hide': hide(); break;
        case 'recall': recall(); break;
        case 'settings': await openSettings(); break;
        case 'dialogue': await openDialogue(); break;
        case 'memory': await openMemory(); break;
        case 'curiosity': await openCuriosity(); break;
        case 'echo': await openEcho(); break;
        case 'close-dialogue': closeDialogue(); break;
        case 'menu': buildMenu().popup({ window: entity }); break;
        case 'portal': await openPortal(); break;
        case 'quit': setImmediate(() => app.quit()); break;
      }
      return { ok: true };
    } catch (error) { return report(error); }
  });
  ipcMain.handle(IPC.settings, (event, payload: unknown): OperationResult => {
    authorize(event);
    if (BrowserWindow.fromWebContents(event.sender) !== settings) return report(new Error('Les réglages se modifient depuis leur fenêtre dédiée.'));
    let transaction: ReturnType<ShortcutManager['prepare']> | undefined;
    try {
      const patch = parseSettings(payload);
      transaction = shortcuts.prepare(patch.recallShortcut);
      store.save({ ...model.snapshot().preferences, ...patch });
      transaction.commit();
      model.setShortcutRegistered(shortcuts.registered);
      model.setPreferences({ ...model.snapshot().preferences, ...patch }); model.setNotice(null);
      refreshTray(); return { ok: true };
    } catch (error) { transaction?.rollback(); return report(error); }
  });
  ipcMain.on(IPC.drag, (event, phase: unknown) => {
    try { authorize(event, true); if (!['start', 'move', 'end'].includes(String(phase))) throw new Error('Phase de déplacement invalide.'); handleDrag(phase); }
    catch (error) { report(error); }
  });
  ipcMain.handle(IPC.mindSnapshot, event => { authorize(event); return requireMind().engine.snapshot(); });
  ipcMain.handle(IPC.mindSend, async (event, message: unknown) => {
    authorize(event);
    if (BrowserWindow.fromWebContents(event.sender) !== dialogue) return report(new Error('Les messages se saisissent dans l’échange avec ENTITY.'));
    if (typeof message !== 'string') return report(new Error('Message invalide.'));
    if(/^regarde comment je fais[.!?\s]*$/i.test(message.trim())){await openEcho();return {ok:true};}
    curiosity?.invalidate('Message utilisateur : priorité au dialogue.');
    return requireMind().engine.submit(message);
  });
  ipcMain.handle(IPC.mindControl, (event, command: unknown) => {
    authorize(event);
    const mind = requireMind().engine;
    if (command === 'cancel') mind.cancel();
    else if (command === 'new-conversation') mind.reset('Nouvelle conversation. Seuls les souvenirs durables restent disponibles.');
    else if (command === 'listening') { mind.listening(); attention(); }
    else return report(new Error('Commande MIND inconnue.'));
    return { ok: true };
  });
  ipcMain.handle(IPC.aiConfig, event => { authorize(event); return requireMind().view(); });
  ipcMain.handle(IPC.aiSave, (event, payload: unknown) => {
    authorize(event);
    if (BrowserWindow.fromWebContents(event.sender) !== settings) return report(new Error('La configuration IA se modifie dans les réglages.'));
    try { curiosity?.invalidate('Configuration IA modifiée.'); const result = requireMind().saveConfiguration(payload); const view = requireMind().view(); model.setCloudAllowed(view.cloudConsent && [requireMind().routerView().FAST,requireMind().routerView().DEEP].some(target=>target?.provider==='openai')); return result; }
    catch (error) { return report(error); }
  });
  ipcMain.handle(IPC.aiModels, async (event, url: unknown) => {
    authorize(event);
    if (BrowserWindow.fromWebContents(event.sender) !== settings || typeof url !== 'string') return report(new Error('Adresse ou fenêtre de configuration invalide.'));
    try { return { ok: true, models: await requireMind().models(url) }; } catch (error) { return report(error); }
  });
  ipcMain.handle(IPC.memoryList, async (event, query: unknown) => {
    authorize(event);
    if (query !== undefined && (typeof query !== 'string' || query.length > 300)) throw new Error('Recherche MEMORY invalide.');
    return requireMind().memory.list(query as string | undefined);
  });
  ipcMain.handle(IPC.memoryWrite, async (event, payload: unknown) => {
    authorize(event);
    if (![memoryWindow,spaceWindow].includes(BrowserWindow.fromWebContents(event.sender))) return report(new Error('Les souvenirs se modifient dans MEMORY ou SPACE.'));
    try { const id=(payload as {id?:unknown})?.id;if(typeof id==='string'&&echo?.snapshot().habits.some(h=>h.memoryId===id))throw new Error('Corrigez cette habitude dans ECHO pour préserver sa provenance.');curiosity?.cancel('MEMORY modifiée.'); const result=await requireMind().writeMemory(payload); if(typeof id==='string') curiosity?.repository.removeMemoryOrigins(id); curiosity?.invalidate('MEMORY mise à jour.');publishSpace(); return result; } catch (error) { curiosity?.start(); return report(error); }
  });
  ipcMain.handle(IPC.memoryRemove, async (event, id: unknown) => {
    authorize(event);
    if (![memoryWindow,spaceWindow].includes(BrowserWindow.fromWebContents(event.sender)) || typeof id !== 'string') return report(new Error('Suppression MEMORY non autorisée.'));
    try { curiosity?.cancel('Souvenir supprimé.');requireMind().engine.reset('Souvenir supprimé.');const result=echo?.removeMemory(id)?{ok:true} as const:await requireMind().removeMemory(id); curiosity?.repository.removeMemoryOrigins(id); curiosity?.invalidate('Souvenir et pistes issues de celui-ci retirés.');publishSpace(); return result; } catch (error) { curiosity?.start(); return report(error); }
  });
  ipcMain.handle(IPC.memoryExport, async event => {
    authorize(event);
    if (![memoryWindow,spaceWindow].includes(BrowserWindow.fromWebContents(event.sender))) return report(new Error('L’export se lance depuis MEMORY ou SPACE.'));
    try { return await requireMind().exportMemories(); } catch (error) { return report(error); }
  });
  ipcMain.handle(IPC.routerGet,event=>{authorize(event);return requireMind().routerView();});
  ipcMain.handle(IPC.routerSave,(event,payload:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==settings)return report(new Error('Les profils se configurent dans les réglages.'));try{curiosity?.invalidate('Profils IA modifiés.');return requireMind().saveRouter(payload);}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityGet,event=>{authorize(event);return requireCuriosity().snapshot();});
  ipcMain.handle(IPC.curiositySettings,(event,payload:unknown)=>{authorize(event);if(![settings,curiosityWindow].includes(BrowserWindow.fromWebContents(event.sender)))return report(new Error('Le budget se configure dans CURIOSITY ou les réglages.'));try{requireCuriosity().configure(payload as Parameters<CuriosityEngine['configure']>[0]);return {ok:true};}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityControl,async(event,command:unknown)=>{authorize(event);try{if(command==='cancel'){requireCuriosity().invalidate('Exploration interrompue par l’utilisateur.');return {ok:true};}if(command!=='explore'||BrowserWindow.fromWebContents(event.sender)!==curiosityWindow)throw new Error('Commande CURIOSITY invalide.');return await requireCuriosity().explore();}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityInterest,(event,payload:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==curiosityWindow)return report(new Error('Les intérêts se modifient dans leur journal.'));try{return mutateCuriosity(engine=>{engine.repository.writeInterest(payload as Parameters<CuriosityEngine['repository']['writeInterest']>[0]);});}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityRemove,(event,kind:unknown,id:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==curiosityWindow || typeof kind!=='string'||typeof id!=='string')return report(new Error('Suppression CURIOSITY non autorisée.'));try{return mutateCuriosity(engine=>engine.repository.remove(kind as CuriosityObjectKind,id));}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityBlock,(event,domain:unknown,blocked:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==curiosityWindow||typeof domain!=='string'||typeof blocked!=='boolean')return report(new Error('Règle de domaine invalide.'));try{return mutateCuriosity(engine=>engine.repository.setBlocked(domain,blocked));}catch(error){return report(error);}});
  ipcMain.handle(IPC.curiosityRead,event=>{authorize(event);const engine=requireCuriosity();engine.repository.markRead();engine.publish();return {ok:true};});
  ipcMain.handle(IPC.portalGet,event=>{authorize(event);return portal.snapshot();});
  ipcMain.handle(IPC.portalControl,(event,command:unknown,token:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==spaceWindow)return report(new Error('PORTAL se contrôle depuis SPACE.'));try{if(command==='close')closePortal();else if(command==='settle'&&typeof token==='number'&&Number.isInteger(token))portal.settle(token);else throw new Error('Transition PORTAL invalide.');return {ok:true};}catch(error){return report(error);}});
  ipcMain.handle(IPC.portalSettingsGet,event=>{authorize(event);return {...portalSettings,registered:portalShortcuts.registered};});
  ipcMain.handle(IPC.portalSettingsSave,(event,payload:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==settings)return report(new Error('Le raccourci PORTAL se modifie dans les réglages.'));let transaction:ReturnType<ShortcutManager['prepare']>|undefined;try{const next=parsePortalSettings(payload);transaction=portalShortcuts.prepare(next.shortcut);portalStore.save(next);transaction.commit();portalSettings=next;return {ok:true};}catch(error){transaction?.rollback();return report(error);}});
  ipcMain.handle(IPC.spaceGet,async(event):Promise<SpaceSnapshot>=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==spaceWindow)throw new Error('Les données spatiales se consultent depuis SPACE.');const data=await spaceData();return {data,preferences:{...structuredClone(spacePreferences),selection:existingSelection(spacePreferences.selection,data)},since:spaceSince,portal:portal.snapshot()};});
  ipcMain.handle(IPC.spaceSave,async(event,payload:unknown)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==spaceWindow)return report(new Error('Navigation SPACE non autorisée.'));try{const view=parseSpaceView(payload),data=await spaceData(),next={...spacePreferences,...view,selection:existingSelection(view.selection,data)};spaceStore.save(next);spacePreferences=next;return {ok:true};}catch(error){return report(error);}});
  const echoOwner=(event:Electron.IpcMainInvokeEvent)=>{authorize(event);if(BrowserWindow.fromWebContents(event.sender)!==echoWindow)throw new Error('Le consentement et les commandes ECHO se donnent dans son panneau.');};
  ipcMain.handle(IPC.echoGet,event=>{authorize(event);return requireEcho().snapshot();});
  ipcMain.handle(IPC.echoChoose,async(event,purpose:unknown)=>{echoOwner(event);if(!['session','exclusion'].includes(String(purpose)))throw new Error('Choix de dossier invalide.');const result=await dialog.showOpenDialog(echoWindow!,{title:purpose==='session'?'Dossier de test autorisé pour cette session':'Dossier à exclure d’ECHO',properties:['openDirectory','dontAddToRecent']});if(result.canceled||!result.filePaths[0])return null;if(purpose==='session')return requireEcho().choose(result.filePaths[0]);return {token:'',folder:resolve(result.filePaths[0]),expiresAt:''};});
  ipcMain.handle(IPC.echoStart,(event,input:unknown)=>{echoOwner(event);try{curiosity?.cancel('Session ECHO : priorité à la démonstration humaine.');requireEcho().start(input as Parameters<EchoEngine['start']>[0]);return {ok:true};}catch(error){curiosity?.start();return report(error);}});
  ipcMain.handle(IPC.echoControl,async(event,command:unknown)=>{echoOwner(event);try{const engine=requireEcho();if(command==='enable')engine.enable();else if(command==='stop')await engine.stop();else if(command==='pause')engine.pause();else if(command==='resume')engine.resume();else if(command==='disable')engine.disable();else if(command==='cancel-analysis')engine.cancelAnalysis();else throw new Error('Commande ECHO invalide.');if(!engine.isBusy())curiosity?.start();return {ok:true};}catch(error){return report(error);}});
  ipcMain.handle(IPC.echoValidate,(event,input:unknown)=>{echoOwner(event);try{requireMind().engine.reset('Validation ECHO : seules les habitudes confirmées sont utilisées.');requireEcho().validate(input as Parameters<EchoEngine['validate']>[0]);return {ok:true};}catch(error){return report(error);}});
  ipcMain.handle(IPC.echoRemove,(event,id:unknown)=>{echoOwner(event);try{if(typeof id!=='string')throw new Error('Session invalide.');requireMind().engine.reset('Session ECHO supprimée, contexte effacé.');requireEcho().removeSession(id);curiosity?.start();return {ok:true};}catch(error){return report(error);}});
  ipcMain.handle(IPC.echoExclusions,(event,input:unknown)=>{echoOwner(event);try{requireMind().engine.reset('Exclusions ECHO modifiées, contexte effacé.');requireEcho().configure(input);curiosity?.start();return {ok:true};}catch(error){return report(error);}});
}
async function bootstrap() {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  // Renderer network access stays blocked. Providers use Node fetch in main after explicit configuration.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => {
    const origin = new URL(details.url).origin.replace(/^ws:/, 'http:');
    callback({ cancel: !rendererURL || origin !== rendererURL });
  });
  store = new PreferencesStore(join(app.getPath('userData'), 'preferences.json'));
  const loaded = store.load();
  let mindFailure: string | null = null;
  try { mindService = new DesktopMindService(app.getPath('userData')); }
  catch { mindFailure = 'MIND / MEMORY n’a pas pu démarrer. Les données existantes sont conservées et PRESENCE reste disponible. Vérifiez memory.sqlite et les droits du dossier AETHER.'; }
  if(mindService){try{echo=createEcho(app.getPath('userData'),mindService);}catch{mindFailure='ECHO n’a pas pu démarrer. La perception reste désactivée.';}}
  if(mindService) { try { curiosity=createCuriosity(app.getPath('userData'),mindService,()=>mindService!.engine.snapshot().state==='thinking'||Boolean(dialogue?.isVisible())||Boolean(echo?.isBusy()),()=>!echo?.repository.habits().some(h=>h.state==='confirmed')); } catch { mindFailure='CURIOSITY n’a pas pu démarrer. PRESENCE, MIND et MEMORY sont conservés.'; } }
  model = new PresenceModel(loaded.preferences, mindService !== null, mindService !== null,curiosity!==null,true,echo!==null);
  spaceStore=new SpacePreferencesStore(join(app.getPath('userData'),'space-state.json'));spacePreferences=spaceStore.load();
  portalStore=new PortalSettingsStore(join(app.getPath('userData'),'portal-settings.json'));portalSettings=portalStore.load();
  if(spaceStore.notice||portalStore.notice)model.setNotice(spaceStore.notice??portalStore.notice);
  if (mindFailure) model.setNotice(mindFailure);
  if (mindService) { const view = mindService.view(); model.setCloudAllowed(view.provider === 'openai' && view.cloudConsent); }
  if (loaded.notice) model.setNotice(loaded.notice);
  const point = clampPosition(loaded.preferences.position, workAreas());
  entity = new BrowserWindow({
    title: 'AETHER · ENTITY', x: point.x, y: point.y, width: ENTITY_SIZE, height: ENTITY_SIZE,
    minWidth: 1, minHeight: 1,
    frame: false, thickFrame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, show: false,
    webPreferences: { preload: resolve(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  secureWindow(entity);
  entity.setIgnoreMouseEvents(true, { forward: true });
  entity.on('blur', () => finishDrag(false));
  entity.on('close', event => { if (!quitting) { event.preventDefault(); hide(); } });
  model.events.on('presence.changed', snapshot => {
    for (const window of [entity, settings, dialogue, memoryWindow,curiosityWindow,spaceWindow,echoWindow]) if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(IPC.changed, snapshot);
  });
  mindService?.engine.events.on('changed', reflectMind);
  curiosity?.events.on('changed',reflectCuriosity);
  echo?.events.on('changed',reflectEcho);
  portal.events.on('changed',snapshot=>{
    if(quitting)return;
    for(const window of [entity,settings,spaceWindow])if(window&&!window.isDestroyed())window.webContents.send(IPC.portalChanged,snapshot);
    if(snapshot.phase==='open')spaceWindow?.setAlwaysOnTop(false);
    if(snapshot.phase==='closed'){if(portalTimer)clearTimeout(portalTimer);portalTimer=undefined;if(spaceWindow&&!spaceWindow.isDestroyed())spaceWindow.destroy();restoreDesktop();}
  });
  setupIPC();
  shortcuts = new ShortcutManager(globalShortcut, recall);
  try { shortcuts.prepare(loaded.preferences.recallShortcut).commit(); model.setShortcutRegistered(true); }
  catch (error) { report(error); }
  portalShortcuts=new ShortcutManager(globalShortcut,()=>{void togglePortal().catch(report);});
  try{portalShortcuts.prepare(portalSettings.shortcut).commit();}catch(error){report(error);}
  const trayIcon = nativeImage.createFromPath(resolve(__dirname, '../assets/tray.png'));
  if (trayIcon.isEmpty()) throw new Error('Icône de notification introuvable.');
  tray = new Tray(trayIcon);
  tray.on('click', recall); tray.on('double-click', recall);
  refreshTray();
  await load(entity, 'entity');
  guardPersistence(() => persist({ ...loaded.preferences, position: point }));
  if (loaded.preferences.visible) { entity.showInactive(); startHitTesting(); }
  refreshTray();
  screen.on('display-removed', () => { finishDrag(false); if(spaceWindow)closePortal();reposition(); });
  screen.on('display-metrics-changed', () => { finishDrag(false); if(spaceWindow)closePortal();reposition(); });
  if (model.snapshot().notice) await openSettings();
  if(curiosity) {reflectCuriosity(curiosity.snapshot());curiosity.start();}
}

if (!hasLock) app.quit();
else {
  app.on('second-instance', () => { if (model) recall(); });
  app.on('activate', () => { if (model) recall(); });
  app.on('window-all-closed', () => { /* Tray lifecycle, explicit quit only. */ });
  app.on('before-quit', () => {
    quitting = true; finishDrag(false); stopHitTesting();
    if(portalTimer)clearTimeout(portalTimer);if(singleClickTimer)clearTimeout(singleClickTimer);
    if (attentionTimer) clearTimeout(attentionTimer);
    if (model && store) guardPersistence(rememberPosition);
    echo?.close();curiosity?.close(); mindService?.close();
    shortcuts?.dispose();portalShortcuts?.dispose(); tray?.destroy(); tray = null;
  });
  void bootstrap().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AETHER startup]', message); dialog.showErrorBox('AETHER — démarrage impossible', message); app.quit();
  });
}
