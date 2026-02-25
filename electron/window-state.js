// electron/window-state.js — Persist window size and position across sessions
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STATE_FILE = 'window-state.json';

const DEFAULT_STATE = {
  width: 1280,
  height: 800,
  x: undefined,
  y: undefined,
  isMaximized: false,
};

function getStatePath() {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function loadWindowState() {
  try {
    const filePath = getStatePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return { ...DEFAULT_STATE, ...data };
    }
  } catch (err) {
    console.warn('[WindowState] Failed to load:', err.message);
  }
  return { ...DEFAULT_STATE };
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
    };
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[WindowState] Failed to save:', err.message);
  }
}

function trackWindowState(win) {
  // Debounce saves on resize/move
  let saveTimeout = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveWindowState(win), 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);
  win.on('close', () => saveWindowState(win));
}

module.exports = { loadWindowState, saveWindowState, trackWindowState };
