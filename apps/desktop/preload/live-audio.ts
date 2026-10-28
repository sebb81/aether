import { contextBridge, ipcRenderer } from 'electron';
const channel = 'aether:live-audio-private';
contextBridge.exposeInMainWorld('liveAudio', {
  send: (value: object) => ipcRenderer.send(channel, value),
  listen: (callback: (value: unknown) => void) => { const handler = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);ipcRenderer.on(channel, handler);return () => ipcRenderer.removeListener(channel, handler); },
});
