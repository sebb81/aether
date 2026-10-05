import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CuriositySnapshot, type DesktopBridge, type MindSnapshot, type PresenceSnapshot } from '@aether/shared';

const bridge: DesktopBridge = {
  getSnapshot: () => ipcRenderer.invoke(IPC.snapshot),
  command: command => ipcRenderer.invoke(IPC.command, command),
  saveSettings: settings => ipcRenderer.invoke(IPC.settings, settings),
  drag: phase => ipcRenderer.send(IPC.drag, phase),
  onSnapshot: listener => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: PresenceSnapshot) => listener(snapshot);
    ipcRenderer.on(IPC.changed, handler);
    return () => { ipcRenderer.removeListener(IPC.changed, handler); };
  },
  getMind: () => ipcRenderer.invoke(IPC.mindSnapshot),
  onMind: listener => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: MindSnapshot) => listener(snapshot);
    ipcRenderer.on(IPC.mindChanged, handler);
    return () => { ipcRenderer.removeListener(IPC.mindChanged, handler); };
  },
  sendMessage: message => ipcRenderer.invoke(IPC.mindSend, message),
  mindControl: command => ipcRenderer.invoke(IPC.mindControl, command),
  getAiConfiguration: () => ipcRenderer.invoke(IPC.aiConfig),
  saveAiConfiguration: configuration => ipcRenderer.invoke(IPC.aiSave, configuration),
  listOllamaModels: baseUrl => ipcRenderer.invoke(IPC.aiModels, baseUrl),
  listMemories: query => ipcRenderer.invoke(IPC.memoryList, query),
  writeMemory: input => ipcRenderer.invoke(IPC.memoryWrite, input),
  removeMemory: id => ipcRenderer.invoke(IPC.memoryRemove, id),
  exportMemories: () => ipcRenderer.invoke(IPC.memoryExport),
  getModelRouter:()=>ipcRenderer.invoke(IPC.routerGet),
  saveModelRouter:value=>ipcRenderer.invoke(IPC.routerSave,value),
  getCuriosity:()=>ipcRenderer.invoke(IPC.curiosityGet),
  onCuriosity:listener=>{ const handler=(_event:Electron.IpcRendererEvent,snapshot:CuriositySnapshot)=>listener(snapshot); ipcRenderer.on(IPC.curiosityChanged,handler); return ()=>ipcRenderer.removeListener(IPC.curiosityChanged,handler); },
  saveCuriositySettings:value=>ipcRenderer.invoke(IPC.curiositySettings,value),
  curiosityControl:command=>ipcRenderer.invoke(IPC.curiosityControl,command),
  writeInterest:value=>ipcRenderer.invoke(IPC.curiosityInterest,value),
  removeCuriosity:(kind,id)=>ipcRenderer.invoke(IPC.curiosityRemove,kind,id),
  blockDomain:(domain,blocked)=>ipcRenderer.invoke(IPC.curiosityBlock,domain,blocked),
  markCuriosityRead:()=>ipcRenderer.invoke(IPC.curiosityRead),
};
contextBridge.exposeInMainWorld('aether', bridge);
