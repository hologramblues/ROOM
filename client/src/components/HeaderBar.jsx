import React, { useState } from 'react';
import { FONT_OPTIONS } from '../constants/fonts';
import Logo from './Logo';
import UserAvatar from './UserAvatar';

export default function HeaderBar({
  // State toggles
  showOutline, setShowOutline, showComments, setShowComments,
  showTimer, setShowTimer, focusMode, setFocusMode,
  darkMode, setDarkMode,
  // Document info
  title, docId, lastSaved, loading, importing,
  // Connection
  connected, isFullyConnected, offlineDocId,
  // Users
  users, currentUser, myId, myRole, isOwner,
  // Derived
  totalComments, unreadMessages, canEdit,
  // Translation
  t,
  // Active view
  activeView, setActiveView,
  // Element type selector
  activeIndex, elements, changeType,
  // Search
  showSearch, setShowSearch, showSceneNumbers, setShowSceneNumbers,
  // Menus state (from App: characters panel, font)
  showCharactersPanel, setShowCharactersPanel,
  scriptFont, setScriptFont,
  chatNotificationSound, setChatNotificationSound,
  language, setLanguage,
  token,
  // Callbacks
  emitTitle,
  onNewDoc, onShowDocuments, onShowHistory, onShowShare,
  onShowStats, onShowShortcuts, onShowChat, showChat,
  onShowRenameChar, onShowGoToScene,
  onImportFDX, onCreateSnapshot,
  onExportFDX, onExportPDF, onExportFountain, onExportTXT, onExportMarkdown,
  onLogin, onLogout,
  onCopyLink
}) {
  // Internalized dropdown states
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showImportSubmenu, setShowImportSubmenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [showLanguageSubmenu, setShowLanguageSubmenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  return (
    <div style={{ position: 'sticky', top: 0, background: darkMode ? '#333333' : 'white', borderBottom: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200, gap: 16 }}>

      {/* LEFT ZONE: Logo + Menus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Logo darkMode={darkMode} />

        {/* DOCUMENT MENU */}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowDocMenu(!showDocMenu); setShowToolsMenu(false); setShowImportSubmenu(false); setShowExportSubmenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showDocMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {t('document')} ▾
          </button>
          {showDocMenu && (
            <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'visible', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
              <button onClick={() => { onNewDoc(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                {t('new')}
              </button>
              {token && (
                <button onClick={() => { onShowDocuments(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  {t('myDocuments')}
                </button>
              )}
              {docId && token && (
                <>
                  <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                  <button onClick={() => { onCreateSnapshot(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>{t('snapshot')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘S</span>
                  </button>
                  <button onClick={() => { onShowHistory(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {t('history')}
                  </button>
                </>
              )}

              <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />

              {/* Import Submenu */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => { setShowImportSubmenu(true); setShowExportSubmenu(false); }}
                onMouseLeave={() => setShowImportSubmenu(false)}
              >
                <button style={{ width: '100%', padding: '10px 14px', background: showImportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>{t('import')}</span><span style={{ color: '#6b7280' }}>▸</span>
                </button>
                {showImportSubmenu && (
                  <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={(e) => { e.stopPropagation(); onImportFDX(); setShowDocMenu(false); }} disabled={importing} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      FDX (Final Draft)
                    </button>
                  </div>
                )}
              </div>

              {/* Export Submenu */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => { setShowExportSubmenu(true); setShowImportSubmenu(false); }}
                onMouseLeave={() => setShowExportSubmenu(false)}
              >
                <button style={{ width: '100%', padding: '10px 14px', background: showExportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 8px 8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>{t('export')}</span><span style={{ color: '#6b7280' }}>▸</span>
                </button>
                {showExportSubmenu && (
                  <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { onExportFDX(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      FDX (Final Draft)
                    </button>
                    <button onClick={() => { onExportFountain(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                      Fountain
                    </button>
                    <button onClick={() => { onExportPDF(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      PDF
                    </button>
                    <button onClick={() => { onExportTXT(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      TXT
                    </button>
                    <button onClick={() => { onExportMarkdown(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                      Markdown
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* TOOLS MENU */}
        <div style={{ position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); setShowDocMenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showToolsMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {t('tools')} ▾
          </button>
          {showToolsMenu && (
            <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'visible', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
              <button onClick={() => { setShowSearch(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px 8px 0 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>{t('search')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘F</span>
              </button>
              <button onClick={() => { onShowRenameChar(); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                {t('renameCharacter')}
              </button>
              <button onClick={() => { setShowCharactersPanel(!showCharactersPanel); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showCharactersPanel ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {t('characters')} {showCharactersPanel && '✓'}
              </button>
              <button onClick={() => { onShowStats(); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                {t('statistics')}
              </button>
              <button onClick={() => { onShowGoToScene(); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>{t('goToScene')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘G</span>
              </button>
              <button onClick={() => { setShowSceneNumbers(!showSceneNumbers); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showSceneNumbers ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                {t('sceneNumbers')} {showSceneNumbers && '✓'}
              </button>
              {/* Font selector */}
              {Object.entries(FONT_OPTIONS).map(([key, { label }]) => (
                <button key={key} onClick={() => { setScriptFont(key); localStorage.setItem('rooms-script-font', key); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: scriptFont === key ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                  {label} {scriptFont === key && '✓'}
                </button>
              ))}
              <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
              <button onClick={() => { setChatNotificationSound(!chatNotificationSound); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: chatNotificationSound ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {t('chatNotifications')} {chatNotificationSound && '✓'}
              </button>

              {/* Language Submenu */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setShowLanguageSubmenu(true)}
                onMouseLeave={() => setShowLanguageSubmenu(false)}
              >
                <button style={{ width: '100%', padding: '10px 14px', background: showLanguageSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    {t('language')}
                  </span>
                  <span style={{ color: '#6b7280' }}>▸</span>
                </button>
                {showLanguageSubmenu && (
                  <div style={{ position: 'absolute', left: '100%', top: 0, paddingLeft: 4, zIndex: 501 }}>
                    <div style={{ background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 140, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                      <button onClick={() => { setLanguage('fr'); setShowToolsMenu(false); setShowLanguageSubmenu(false); }} style={{ width: '100%', padding: '10px 14px', background: language === 'fr' ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🇫🇷 Français {language === 'fr' && '✓'}
                      </button>
                      <button onClick={() => { setLanguage('en'); setShowToolsMenu(false); setShowLanguageSubmenu(false); }} style={{ width: '100%', padding: '10px 14px', background: language === 'en' ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                        🇺🇸 English {language === 'en' && '✓'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => { onShowShortcuts(); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 8px 8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>{t('shortcuts')}</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘?</span>
              </button>
            </div>
          )}
        </div>

        {/* VIEW TABS - Script / Beat Board */}
        <div style={{ display: 'flex', marginLeft: 8, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 6, padding: 2 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveView('script'); }}
            style={{
              padding: '5px 12px', border: 'none', borderRadius: 4,
              background: activeView === 'script' ? (darkMode ? '#333333' : 'white') : 'transparent',
              color: activeView === 'script' ? (darkMode ? 'white' : 'black') : '#6b7280',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: activeView === 'script' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Script
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveView('beatboard'); }}
            style={{
              padding: '5px 12px', border: 'none', borderRadius: 4,
              background: activeView === 'beatboard' ? (darkMode ? '#333333' : 'white') : 'transparent',
              color: activeView === 'beatboard' ? (darkMode ? 'white' : 'black') : '#6b7280',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: activeView === 'beatboard' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Beat Board
          </button>
        </div>

        {/* ELEMENT TYPE SELECTOR */}
        {activeView === 'script' && activeIndex !== null && activeIndex >= 0 && elements[activeIndex] && (
          <div style={{ position: 'relative', marginLeft: 8 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowTypeMenu(!showTypeMenu); }}
              style={{
                padding: '5px 10px', border: 'none', borderRadius: 6,
                background: darkMode ? '#484848' : '#e5e7eb',
                color: darkMode ? 'white' : '#333',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {{ scene: 'Scène', action: 'Action', character: 'Personnage', dialogue: 'Dialogue', parenthetical: 'Parenthèse', transition: 'Transition' }[elements[activeIndex].type] || elements[activeIndex].type}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showTypeMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowTypeMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: darkMode ? '#1e1e1e' : 'white', border: `1px solid ${darkMode ? '#555' : '#ddd'}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 1000, minWidth: 150, overflow: 'hidden' }}>
                  {[
                    { type: 'scene', label: 'Scène' },
                    { type: 'action', label: 'Action' },
                    { type: 'character', label: 'Personnage' },
                    { type: 'dialogue', label: 'Dialogue' },
                    { type: 'parenthetical', label: 'Parenthèse' },
                    { type: 'transition', label: 'Transition' },
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); changeType(activeIndex, type); setShowTypeMenu(false); }}
                      style={{
                        width: '100%', padding: '8px 14px', border: 'none',
                        background: elements[activeIndex].type === type ? '#2563eb' : 'transparent',
                        color: elements[activeIndex].type === type ? 'white' : (darkMode ? '#e0e0e0' : '#333'),
                        cursor: 'pointer', fontSize: 12,
                        fontWeight: elements[activeIndex].type === type ? 600 : 400,
                        textAlign: 'left', display: 'block',
                      }}
                      onMouseOver={(e) => { if (elements[activeIndex].type !== type) e.target.style.background = darkMode ? '#333' : '#f3f4f6'; }}
                      onMouseOut={(e) => { if (elements[activeIndex].type !== type) e.target.style.background = 'transparent'; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* CENTER ZONE: Title only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        <div className="header-btn" data-tooltip={title} style={{ position: 'relative' }}>
          <input
            value={title}
            onChange={e => emitTitle(e.target.value)}
            placeholder={t('newDocumentPlaceholder')}
            style={{
              background: 'transparent', border: 'none',
              color: darkMode ? 'white' : 'black',
              fontSize: 14, fontWeight: 600, outline: 'none',
              maxWidth: 250, textOverflow: 'ellipsis', textAlign: 'center'
            }}
          />
        </div>
        {docId && offlineDocId && <span style={{ fontSize: 10, color: '#f59e0b', whiteSpace: 'nowrap' }}>{t('offlineCopyBadge')}</span>}
        {docId && !offlineDocId && lastSaved && <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>✓ {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
        {docId && !isFullyConnected && !offlineDocId && <span style={{ fontSize: 10, color: '#f59e0b', whiteSpace: 'nowrap' }}>⚠ Offline</span>}
        {docId && !canEdit && <span style={{ fontSize: 10, background: '#f59e0b', color: 'black', padding: '2px 6px', borderRadius: 4 }}>{t('reading')}</span>}
        {loading && <span style={{ fontSize: 11, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> {t('loading')}</span>}
        {importing && <span style={{ fontSize: 11, color: '#f59e0b' }}>Import en cours...</span>}
      </div>

      {/* RIGHT ZONE: User/Collab + Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* User & Collaborators */}
        {currentUser ? (
          <>
            <div style={{ position: 'relative' }}>
              <UserAvatar user={{ name: currentUser.name, color: users.find(u => u.name === currentUser.name)?.color || currentUser.color || '#3b82f6' }} isYou={true} />
              <button
                onClick={onLogout}
                style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                title={t('logout')}
              >×</button>
            </div>
            {docId && users.filter(u => u.id !== myId).slice(0, 3).map((u) => (
              <div key={u.id} style={{ marginLeft: -6 }}><UserAvatar user={u} isYou={false} /></div>
            ))}
            {docId && users.length > 4 && <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 2 }}>+{users.length - 4}</span>}
          </>
        ) : (
          <button onClick={onLogin} style={{ padding: '4px 10px', border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>{t('connection')}</button>
        )}

        {docId && (
          <>
            <button
              onClick={onCopyLink}
              className="header-btn"
              data-tooltip={t('invite')}
              style={{ marginLeft: 4, width: 24, height: 24, borderRadius: '50%', border: `1px dashed ${darkMode ? '#555555' : '#d1d5db'}`, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button
              onClick={() => onShowChat()}
              className="header-btn"
              data-tooltip={t('teamChat')}
              style={{ marginLeft: 2, width: 24, height: 24, borderRadius: '50%', border: 'none', background: showChat ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), color: showChat ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {unreadMessages > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
            </button>
          </>
        )}

        <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />

        {/* Document actions */}
        <button
          onClick={onShowDocuments}
          className="header-btn"
          data-tooltip={t('myDocuments')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="header-btn"
          data-tooltip={t('export')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showExportMenu ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showExportMenu ? 'white' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', bottom: 4, right: 4 }}>
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>

        {/* Export dropdown menu */}
        {showExportMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setShowExportMenu(false)}
            />
            <div style={{
              position: 'absolute', top: 50, right: 'auto',
              background: darkMode ? '#333333' : 'white', borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              zIndex: 1000, minWidth: 160, overflow: 'hidden'
            }}>
              <button onClick={() => { onExportFDX(); setShowExportMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Export FDX
              </button>
              <button onClick={() => { onExportPDF(); setShowExportMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Export PDF
              </button>
              <button onClick={() => { onExportFountain(); setShowExportMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                Export Fountain
              </button>
            </div>
          </>
        )}

        <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />

        {/* Quick toggle buttons */}
        <button onClick={() => setShowOutline(!showOutline)} className="header-btn" data-tooltip={`${t('outline')} (⌘O)`}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showOutline ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showOutline ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>

        <button onClick={() => setShowComments(!showComments)} className="header-btn" data-tooltip={t('comments')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showComments ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showComments ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          {totalComments > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#f59e0b', color: 'black', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{totalComments}</span>}
        </button>

        <button onClick={() => setShowTimer(!showTimer)} className="header-btn" data-tooltip={t('writingTimer')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showTimer ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showTimer ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/><path d="M12 2v2"/>
          </svg>
        </button>

        <button onClick={() => setFocusMode(!focusMode)} className="header-btn" data-tooltip={t('focusMode')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: focusMode ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: focusMode ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
          </svg>
        </button>

        <button onClick={() => setDarkMode(!darkMode)} className="header-btn" data-tooltip={darkMode ? t('lightMode') : t('darkModeTooltip')}
          style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
