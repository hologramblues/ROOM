// electron/preload.js — Secure bridge between renderer (React) and main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Flag for React to detect desktop mode
  isDesktop: true,

  // Get the dynamic port the local server is running on
  getServerPort: () => ipcRenderer.invoke('get-server-port'),

  // Get the local user info
  getLocalUser: () => ipcRenderer.invoke('get-local-user'),

  // Set window title (e.g. "ROOMS — Mon Scénario")
  setTitle: (title) => ipcRenderer.send('set-title', title),

  // Menu action listener (new-document, open-documents, save-snapshot, export-*)
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => callback(action));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('menu-action');
  },

  // Show native save dialog for exports
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Write file to disk (for exports)
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),

  // Cloud auth (secure credential storage)
  cloudAuth: {
    save: ({ token, user }) => ipcRenderer.invoke('cloud-auth-save', { token, user }),
    get: () => ipcRenderer.invoke('cloud-auth-get'),
    clear: () => ipcRenderer.invoke('cloud-auth-clear'),
  },
});
