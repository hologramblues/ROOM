// electron/menu.js — Native menu for ROOMS Desktop
const { Menu, app } = require('electron');

function createMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'À propos de ROOMS' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Masquer ROOMS' },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Tout afficher' },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter ROOMS' },
      ]
    }] : []),

    // File menu
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouveau document',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-action', 'new-document'),
        },
        {
          label: 'Mes documents',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-action', 'open-documents'),
        },
        { type: 'separator' },
        {
          label: 'Sauvegarder (Snapshot)',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-action', 'save-snapshot'),
        },
        { type: 'separator' },
        {
          label: 'Importer',
          submenu: [
            {
              label: 'Fountain (.fountain)',
              click: () => mainWindow.webContents.send('menu-action', 'import-fountain'),
            },
            {
              label: 'Final Draft (.fdx)',
              click: () => mainWindow.webContents.send('menu-action', 'import-fdx'),
            },
          ],
        },
        {
          label: 'Exporter',
          submenu: [
            {
              label: 'PDF',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => mainWindow.webContents.send('menu-action', 'export-pdf'),
            },
            {
              label: 'Final Draft (.fdx)',
              click: () => mainWindow.webContents.send('menu-action', 'export-fdx'),
            },
            {
              label: 'Fountain (.fountain)',
              click: () => mainWindow.webContents.send('menu-action', 'export-fountain'),
            },
            {
              label: 'Texte brut (.txt)',
              click: () => mainWindow.webContents.send('menu-action', 'export-txt'),
            },
          ],
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit', label: 'Quitter' }]),
      ],
    },

    // Edit menu
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },

    // View menu
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Forcer le rechargement' },
        { role: 'toggleDevTools', label: 'Outils développeur' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Taille réelle' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },

    // Window menu
    {
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize', label: 'Réduire' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front', label: 'Tout ramener au premier plan' },
        ] : [
          { role: 'close', label: 'Fermer' },
        ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createMenu };
