// electron/main.js — ROOMS Desktop main process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDatabase } = require('./database');
const { startLocalServer } = require('./local-server');
const { createMenu } = require('./menu');
const { loadWindowState, trackWindowState } = require('./window-state');
const { LOCAL_USER } = require('./local-auth');

// Keep references to prevent garbage collection
let mainWindow = null;
let serverPort = null;

const isDev = !!process.env.ELECTRON_DEV;

async function createWindow() {
  // ---- Step 1: Initialize SQLite ----
  console.log('[MAIN] Initializing database...');
  initDatabase();

  // ---- Step 2: Start embedded server ----
  console.log('[MAIN] Starting local server...');
  const { port } = await startLocalServer();
  serverPort = port;
  console.log(`[MAIN] Local server ready on port ${port}`);

  // ---- Step 3: Create BrowserWindow ----
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,
    title: 'ROOMS',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#111827',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 native module in preload context
    },
    show: false, // show when ready to prevent flash
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Track window state for persistence
  trackWindowState(mainWindow);

  // ---- Step 4: Load the app ----
  if (isDev) {
    // Development: load from CRA dev server
    console.log('[MAIN] Loading dev server at http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Production: load from built client files
    const indexPath = path.join(__dirname, '..', 'client', 'build', 'index.html');
    console.log('[MAIN] Loading build from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Show window when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ---- Step 5: Inject Courier Prime fonts (offline) ----
  mainWindow.webContents.on('did-finish-load', () => {
    const fontsDir = path.join(__dirname, 'fonts');
    if (fs.existsSync(fontsDir)) {
      const fontFiles = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf'));
      if (fontFiles.length > 0) {
        const fontFaces = fontFiles.map(file => {
          const fontPath = path.join(fontsDir, file).replace(/\\/g, '/');
          const isItalic = file.toLowerCase().includes('italic');
          const isBold = file.toLowerCase().includes('bold');
          const weight = isBold ? '700' : '400';
          const style = isItalic ? 'italic' : 'normal';
          return `@font-face { font-family: 'Courier Prime'; src: url('file://${fontPath}') format('truetype'); font-weight: ${weight}; font-style: ${style}; font-display: swap; }`;
        }).join('\n');
        mainWindow.webContents.insertCSS(fontFaces);
        console.log('[MAIN] Injected', fontFiles.length, 'Courier Prime font faces');
      }
    }
  });

  // ---- Step 6: Create native menu ----
  createMenu(mainWindow);

  // ---- Step 7: Open DevTools in dev ----
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============ IPC Handlers ============

ipcMain.handle('get-server-port', () => serverPort);

ipcMain.handle('get-local-user', () => LOCAL_USER);

ipcMain.on('set-title', (event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title ? `ROOMS — ${title}` : 'ROOMS');
  }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ============ App lifecycle ============

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Graceful shutdown: flush SQLite before quit
app.on('before-quit', () => {
  console.log('[MAIN] Shutting down...');
  closeDatabase();
});
