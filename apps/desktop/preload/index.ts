import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CuriositySnapshot, type DesktopBridge, type MindSnapshot, type PresenceSnapshot,type PortalSnapshot } from '@aether/shared';

const bridge: DesktopBridge = {
  getEvolution:()=>ipcRenderer.invoke(IPC.evolutionGet),
  onEvolution:listener=>{const handler=(_event:Electron.IpcRendererEvent,value:import('@aether/shared').EvolutionSnapshot)=>listener(value);ipcRenderer.on(IPC.evolutionChanged,handler);return ()=>ipcRenderer.removeListener(IPC.evolutionChanged,handler);},
  prepareForge:input=>ipcRenderer.invoke(IPC.forgePrepare,input),saveForgeSpecification:(id,spec)=>ipcRenderer.invoke(IPC.forgeSave,id,spec),evolutionAction:(action,id,confirmed)=>ipcRenderer.invoke(IPC.evolutionAction,action,id,confirmed),stopEvolution:()=>ipcRenderer.invoke(IPC.evolutionStop),previewCapability:(id,parameters)=>ipcRenderer.invoke(IPC.capabilityPreview,id,parameters),applyCapability:(id,confirmed)=>ipcRenderer.invoke(IPC.capabilityApply,id,confirmed),proposeExperiment:id=>ipcRenderer.invoke(IPC.experimentPropose,id),
  getLive: () => ipcRenderer.invoke(IPC.liveGet),
  onLive: listener => { const handler = (_event: Electron.IpcRendererEvent, value: import('@aether/shared').LiveSnapshot) => listener(value); ipcRenderer.on(IPC.liveChanged, handler); return () => ipcRenderer.removeListener(IPC.liveChanged, handler); },
  saveLiveSettings: input => ipcRenderer.invoke(IPC.liveSave, input), liveConsent: decision => ipcRenderer.invoke(IPC.liveConsent, decision), liveControl: command => ipcRenderer.invoke(IPC.liveControl, command), liveConfirm: (id, approved) => ipcRenderer.invoke(IPC.liveConfirm, id, approved),
  getVoice:()=>ipcRenderer.invoke(IPC.voiceGet),
  onVoice:listener=>{const handler=(_event:Electron.IpcRendererEvent,value:import('@aether/shared').VoiceSnapshot)=>listener(value);ipcRenderer.on(IPC.voiceChanged,handler);return ()=>ipcRenderer.removeListener(IPC.voiceChanged,handler);},
  getVoiceInventory:()=>ipcRenderer.invoke(IPC.voiceInventory),saveVoiceSettings:input=>ipcRenderer.invoke(IPC.voiceSave,input),voiceConsent:decision=>ipcRenderer.invoke(IPC.voiceConsent,decision),voiceControl:command=>ipcRenderer.invoke(IPC.voiceControl,command),chooseVoiceResource:kind=>ipcRenderer.invoke(IPC.voiceResource,kind),
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
  getPortal:()=>ipcRenderer.invoke(IPC.portalGet),
  onPortal:listener=>{const handler=(_event:Electron.IpcRendererEvent,value:PortalSnapshot)=>listener(value);ipcRenderer.on(IPC.portalChanged,handler);return ()=>ipcRenderer.removeListener(IPC.portalChanged,handler);},
  portalControl:(command,token)=>ipcRenderer.invoke(IPC.portalControl,command,token),
  getPortalSettings:()=>ipcRenderer.invoke(IPC.portalSettingsGet),savePortalSettings:value=>ipcRenderer.invoke(IPC.portalSettingsSave,value),
  getSpace:()=>ipcRenderer.invoke(IPC.spaceGet),saveSpace:value=>ipcRenderer.invoke(IPC.spaceSave,value),
  onSpaceChanged:listener=>{const handler=()=>listener();ipcRenderer.on(IPC.spaceChanged,handler);return ()=>ipcRenderer.removeListener(IPC.spaceChanged,handler);},
  getEcho:()=>ipcRenderer.invoke(IPC.echoGet),
  onEcho:listener=>{const handler=(_event:Electron.IpcRendererEvent,value:import('@aether/shared').EchoSnapshot)=>listener(value);ipcRenderer.on(IPC.echoChanged,handler);return ()=>ipcRenderer.removeListener(IPC.echoChanged,handler);},
  chooseEchoFolder:purpose=>ipcRenderer.invoke(IPC.echoChoose,purpose),startEcho:input=>ipcRenderer.invoke(IPC.echoStart,input),echoControl:command=>ipcRenderer.invoke(IPC.echoControl,command),validateEcho:input=>ipcRenderer.invoke(IPC.echoValidate,input),removeEchoSession:id=>ipcRenderer.invoke(IPC.echoRemove,id),saveEchoExclusions:input=>ipcRenderer.invoke(IPC.echoExclusions,input),
};
contextBridge.exposeInMainWorld('aether', bridge);
