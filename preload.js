/* UNICO — secure bridge between the renderer and the on-disk database.
   contextIsolation + sandbox stay ON; only this small, explicit API is exposed. */
const { contextBridge, ipcRenderer } = require('electron');

// Load the persisted database snapshot synchronously, before any app script
// runs, so the renderer can hydrate localStorage from disk at document-start.
let snapshot = {};
try {
  const s = ipcRenderer.sendSync('db:loadSync');
  if (s && typeof s === 'object') snapshot = s;
} catch (e) { /* running outside Electron / no db yet */ }

contextBridge.exposeInMainWorld('unicoNative', {
  snapshot,
  // Persist the full key→value map of app state to the database file.
  persist: (data) => ipcRenderer.invoke('db:persist', data),
  // Save a portable backup of all data to a user-chosen file.
  backup: (data) => ipcRenderer.invoke('db:backup', data),
  // Restore all data from a user-chosen backup file (returns the data to apply).
  restore: () => ipcRenderer.invoke('db:restore'),
  // Absolute path of the live database file (for display in Settings).
  dbPath: () => ipcRenderer.invoke('db:path'),
  // Render the current page to a real PDF file (Reports → Export PDF).
  // opts: { pageSize?:'A4'|'A3'|'Letter', landscape?:boolean, defaultName?:string }
  // -> { ok:boolean, path?:string, canceled?:boolean, error?:string }
  exportPDF: (opts) => ipcRenderer.invoke('pdf:export', opts || {}),
});
