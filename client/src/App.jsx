import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import './App.css';
import '@excalidraw/excalidraw/index.css';

// Constants
import { IS_DESKTOP, SERVER_URL, CLOUD_URL, ENABLE_BEATBOARD } from './constants/config';
import { PAGE_FORMATS } from './constants/elementTypes';
import { translations } from './constants/translations';
import { SCRIPT_TEMPLATES } from './constants/templates';
import { getFontFamily } from './constants/fonts';

// Utilities
import { stripHtml, generateId } from './utils/helpers';
import importFDX from './utils/importFDX';

// Hooks
import useTimer from './hooks/useTimer';
import useTypewriterSound from './hooks/useTypewriterSound';
import useStats from './hooks/useStats';
import useWritingGoals from './hooks/useWritingGoals';
import useSearch from './hooks/useSearch';
import useUndoRedo from './hooks/useUndoRedo';
import useChat from './hooks/useChat';
import useOfflineMode from './hooks/useOfflineMode';
import useAutoSave, { formatSnapshotName } from './hooks/useAutoSave';
import useDocumentLoader from './hooks/useDocumentLoader';
import useSocketConnection from './hooks/useSocketConnection';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useExportHandlers from './hooks/useExportHandlers';
import useAIRewrite from './hooks/useAIRewrite';
import useMultiBlockClipboard from './hooks/useMultiBlockClipboard';
import useScrollSync from './hooks/useScrollSync';
import useHighlights from './hooks/useHighlights';
import useElementPositions from './hooks/useElementPositions';
import usePageBackgrounds from './hooks/usePageBackgrounds';
import useDragSelect from './hooks/useDragSelect';
import useCloudSync from './hooks/useCloudSync';
import useYjsProvider from './hooks/useYjsProvider';

// Components — always visible or core to editing (static imports)
import CommentsSidebar from './components/CommentsSidebar';
import CharactersPanel from './components/CharactersPanel';
import SingleEditor from './components/SingleEditor';
import BeatBoard from './components/BeatBoard/index';
import WritingTimerWidget from './components/WritingTimerWidget';
import ChatPanel from './components/ChatPanel';
import OutlineSidebar from './components/OutlineSidebar';
import HeaderBar from './components/HeaderBar';
import ContextActionMenu from './components/ContextActionMenu';
import LandingPage from './components/LandingPage';

// Components — lazy-loaded modals (behind boolean guards, never needed on initial render)
const AuthModal = lazy(() => import('./components/AuthModal'));
const DocumentsList = lazy(() => import('./components/DocumentsList'));
const HistoryPanel = lazy(() => import('./components/HistoryPanel'));
const StatsPanel = lazy(() => import('./components/StatsPanel'));
const GoToSceneModal = lazy(() => import('./components/GoToSceneModal'));
const ShortcutsPanel = lazy(() => import('./components/ShortcutsPanel'));
const RenameCharacterModal = lazy(() => import('./components/RenameCharacterModal'));
const NoteEditorModal = lazy(() => import('./components/NoteEditorModal'));
const AIRewriteModal = lazy(() => import('./components/AIRewriteModal'));
const ShareModal = lazy(() => import('./components/ShareModal'));
const TemplateModal = lazy(() => import('./components/TemplateModal'));

// ============ MAIN EDITOR ============
export default function ScreenplayEditor() {
  const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: generateId(), type: 'scene', content: '' }]);
  const [beatCards, setBeatCards] = useState([]); // Beat Board cards - shared with Outline
  const [whiteboardElements, setWhiteboardElements] = useState([]); // Excalidraw whiteboard elements
  const [activeIndex, setActiveIndex] = useState(0);
  // V272: cursorOffset supprimé (curseur géré par TipTap)
  const [characters, setCharacters] = useState([]);
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // { id, elementId, elementIndex, originalText, suggestedText, startOffset, endOffset, userName, userColor, createdAt, status: 'pending'|'accepted'|'rejected' }
  const [textSelection, setTextSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset, rect }
  const [pendingInlineComment, setPendingInlineComment] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [pendingSuggestion, setPendingSuggestion] = useState(null); // { elementId, elementIndex, originalText, startOffset, endOffset }
  const [scriptHasFocus, setScriptHasFocus] = useState(false); // Track if script area has focus
  const [contextMenuTop, setContextMenuTop] = useState(null); // Fixed Y position for context menu
  const [selectedRange, setSelectedRange] = useState(null); // { start: number, end: number }
  const copiedBlocksRef = useRef(null); // stores blocks from multi-block copy for reliable internal paste
  const [isDragSelecting, setIsDragSelecting] = useState(false); // mouse drag selection in progress
  const dragStartIndexRef = useRef(null); // starting block index for drag selection for multi-block selection
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('editor');
  const [isOwner, setIsOwner] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudToken, setCloudToken] = useState(null);
  const [showCloudAuthModal, setShowCloudAuthModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publicAccessState, setPublicAccessState] = useState({ enabled: false, role: 'editor' });
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(null); // Index of element whose comment was clicked
  const [selectedCommentId, setSelectedCommentId] = useState(null); // ID of selected comment (for expanding)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(null); // ID of selected suggestion (for expanding)
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [scriptFont, setScriptFont] = useState(() => localStorage.getItem('rooms-script-font') || 'courier-prime');
  const [pageFormat, setPageFormat] = useState(() => localStorage.getItem('rooms-page-format') || 'us-letter');
  const [scriptZoom, setScriptZoom] = useState(() => {
    const saved = localStorage.getItem('rooms-script-zoom');
    return saved ? parseFloat(saved) : 1;
  });
  const [language, setLanguage] = useState(() => localStorage.getItem('rooms-language') || 'fr');
  
  // Translation function
  const t = useCallback((key) => {
    return translations[language]?.[key] || translations['fr']?.[key] || key;
  }, [language]);
  
  // Save language preference
  useEffect(() => {
    localStorage.setItem('rooms-language', language);
  }, [language]);

  // ============ DESKTOP MODE: auto-login + dynamic SERVER_URL ============
  const [desktopReady, setDesktopReady] = useState(!IS_DESKTOP); // web = ready immediately
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let cancelled = false;
    (async () => {
      try {
        const port = await window.electronAPI.getServerPort();
        SERVER_URL = `http://127.0.0.1:${port}`;
        const localUser = await window.electronAPI.getLocalUser();
        if (!cancelled) {
          setToken('local');
          setCurrentUser({ id: localUser._id, name: localUser.name, email: localUser.email, color: localUser.color });
          setMyRole('editor');
          setIsOwner(true);
          setDesktopReady(true);
          console.log('[DESKTOP] Ready — server at', SERVER_URL);
          // Load persisted cloud credentials
          try {
            const creds = await window.electronAPI.cloudAuth.get();
            if (creds && creds.token && creds.user) {
              setCloudToken(creds.token);
              setCloudUser(creds.user);
              console.log('[DESKTOP] Cloud credentials loaded for', creds.user.name);
            }
          } catch (credErr) {
            console.warn('[DESKTOP] Could not load cloud credentials:', credErr.message);
          }
        }
      } catch (err) {
        console.error('[DESKTOP] Init failed:', err);
        if (!cancelled) setDesktopReady(true); // fallback: show UI anyway
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop menu actions — ref populated later (after function definitions)
  const desktopMenuRef = useRef({});
  
  const [showOutline, setShowOutline] = useState(false);
  const [showSceneNumbers, setShowSceneNumbers] = useState(false);
  const [notes, setNotes] = useState({}); // { elementId: { content, color } }
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [lockedScenes, setLockedScenes] = useState(new Set()); // Set of scene element IDs
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRenameChar, setShowRenameChar] = useState(false);
  // renameFrom/renameTo removed — unused
  const [focusMode, setFocusMode] = useState(false);
  const [sceneAssignments, setSceneAssignments] = useState({}); // { sceneId: { userId, userName, userColor } }
  const [collaborators, setCollaborators] = useState([]); // All users who have access to this document
  const [showTimer, setShowTimer] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [sceneStatus, setSceneStatus] = useState({}); // { sceneId: 'draft' | 'review' | 'final' }
  const [outlineFilter, setOutlineFilter] = useState({ status: '', assignee: '' });
  const [structureBeats, setStructureBeats] = useState([]); // { id, label, startSceneId, color } - unified structure for timeline and outline
  // editingChapter removed — unused
  const [lastSaved, setLastSaved] = useState(null);
  const [, setLastModifiedBy] = useState(null); // { userName, timestamp }
  // draggedScene removed — unused
  const [sceneSynopsis, setSceneSynopsis] = useState({}); // { sceneId: 'synopsis text' }
  // visibleElementIndex removed — unused
  const [scriptScrollHeight, setScriptScrollHeight] = useState(0);
  const [showGoToScene, setShowGoToScene] = useState(false);
  // editingSynopsis removed — unused
  // Typewriter sound hook
  // eslint-disable-next-line no-unused-vars
  const { typewriterSound, setTypewriterSound } = useTypewriterSound();
  const [showChat, setShowChat] = useState(false);
  const [activeView, setActiveView] = useState('script'); // 'script' | 'beatboard'
  
  // AI Rewrite states
  const [showAIRewrite, setShowAIRewrite] = useState(false);
  const [aiRewriteSelection, setAiRewriteSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [aiRewriteMode, setAiRewriteMode] = useState(null); // 'concis', 'develop', 'reformulate', 'tone', 'custom'
  const [aiRewriteCustomPrompt, setAiRewriteCustomPrompt] = useState('');
  const [aiRewriteResult, setAiRewriteResult] = useState(null);
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiRewriteTone, setAiRewriteTone] = useState('dramatique'); // for tone mode
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 340, y: 80 });
  const [notePosition, setNotePosition] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
  const [timerPosition, setTimerPosition] = useState({ x: window.innerWidth - 260, y: window.innerHeight - 350 });
  const [timerCompact, setTimerCompact] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const socketRef = useRef(null);
  // Legacy sync refs removed — Yjs handles all document sync
  const loadedDocRef = useRef(null);
  const scriptContainerRef = useRef(null);
  const pageWrapperRef = useRef(null);
  const pageBgTimerRef = useRef(null);
  const outlineSidebarRef = useRef(null);
  const commentsSidebarRef = useRef(null);

  useEffect(() => {
    const handleHash = () => { 
      const newDocId = window.location.hash.slice(1) || null;
      if (newDocId !== docId) {
        loadedDocRef.current = null;
         // Reset — don't emit until new doc loaded
        
        setDocId(newDocId);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [docId]);

  // No anonymous mode — auth is always required.
  // If user clicks a shared link without being logged in, show auth modal immediately.
  const pendingDocIdRef = useRef(null);
  useEffect(() => {
    if (docId && docId !== 'local' && !token) {
      pendingDocIdRef.current = docId;
      setShowAuthModal(true);
    }
  }, [docId, token]);

  const elementsRef = useRef(elements);
  const titleRef = useRef(title);
  const beatCardsRef = useRef(beatCards);
  const structureBeatsRef = useRef(structureBeats);
  const sceneSynopsisRef = useRef(sceneSynopsis);
  const sceneStatusRef = useRef(sceneStatus);
  const whiteboardElementsRef = useRef(whiteboardElements);
  const notesRef = useRef(notes);

  // Keep refs in sync
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  
  useEffect(() => {
    beatCardsRef.current = beatCards;
  }, [beatCards]);
  
  useEffect(() => {
    structureBeatsRef.current = structureBeats;
  }, [structureBeats]);
  
  useEffect(() => {
    sceneSynopsisRef.current = sceneSynopsis;
  }, [sceneSynopsis]);
  
  useEffect(() => {
    sceneStatusRef.current = sceneStatus;
  }, [sceneStatus]);
  
  useEffect(() => {
    whiteboardElementsRef.current = whiteboardElements;
  }, [whiteboardElements]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useScrollSync({ scriptContainerRef, outlineSidebarRef, commentsSidebarRef, elementsRef, showComments, showOutline, setScriptScrollHeight });

  // Stats hook (stats, outline, characters, locations, pageInfo)
  const { stats, extractedCharacters, extractedLocations, characterStats, outline, computePageInfo } = useStats(elements, characters, elementsRef, pageFormat);

  // Timer hook (chrono + sprint modes)
  const {
    timerSeconds, timerRunning, setTimerRunning, timerMode, setTimerMode,
    sprintDuration, sprintTimeLeft, setSprintTimeLeft,
    sessionWordCount, resetTimer, setSprintMinutes
  } = useTimer(stats.words);

  // Writing goals hook
  const { writingGoal, setWritingGoal } = useWritingGoals(stats.words);

  // Chat hook
  const {
    chatMessages, setChatMessages, chatInput, setChatInput,
    unreadMessages, setUnreadMessages,
    chatNotificationSound, setChatNotificationSound,
    sendChatMessage, playChatNotification, chatEndRef
  } = useChat({ socketRef, connected, docId, myId, currentUser, users, showChat });

  // Offline mode hook
  const {
    isFullyConnected, offlineDocId, offlineDocIdRef,
    showConflictModal, setShowConflictModal,
    activateOfflineMode, pushOfflineChanges, discardOfflineCopy
  } = useOfflineMode({
    docId, token, connected, socketRef, elementsRef, titleRef, lastSaved,
    setElements, setTitle, setLastSaved, loadedDocRef
  });

  // Cloud sync hook (desktop only) — must be before hooks that use effectiveDocId
  const {
    cloudShortId, cloudSyncedAt, editingMode, syncing,
    loadCloudMeta, pushToCloud, pullFromCloud,
    switchToCloud, switchToLocal, resetCloudSync,
  } = useCloudSync({ cloudToken, cloudUser, setShowCloudAuthModal });

  // Load cloud meta when document changes (desktop)
  useEffect(() => {
    if (IS_DESKTOP && docId) {
      loadCloudMeta(docId);
    } else {
      resetCloudSync();
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============ CLOUD MODE: Dynamic routing for hooks ============
  // When in cloud editing mode (desktop), redirect hooks to the cloud server
  const effectiveServerUrl = (IS_DESKTOP && editingMode === 'cloud') ? CLOUD_URL : undefined;
  const effectiveToken = (IS_DESKTOP && editingMode === 'cloud') ? cloudToken : token;
  const effectiveDocId = (IS_DESKTOP && editingMode === 'cloud') ? cloudShortId : docId;

  // Auto-save hook (backup, cloud save, snapshots)
  useAutoSave({
    docId: effectiveDocId, token: effectiveToken, offlineDocId,
    elementsRef, titleRef, beatCardsRef, structureBeatsRef,
    sceneSynopsisRef, sceneStatusRef, whiteboardElementsRef, notesRef,
    setLastSaved,
    serverUrl: effectiveServerUrl,
  });

  // Document loader hook
  useDocumentLoader({
    docId: effectiveDocId, token: effectiveToken, loadedDocRef,
    setElements, setTitle, setCharacters, setComments, setSuggestions,
    setBeatCards, setStructureBeats, setSceneSynopsis, setSceneStatus,
    setWhiteboardElements, setIsOwner, setMyRole, setPublicAccessState,
    setLoading, setToken,
    serverUrl: effectiveServerUrl,
  });

  // Socket connection hook — handles chat, comments, suggestions, presence (NOT document sync)
  useSocketConnection({
    docId: effectiveDocId, token: effectiveToken,
    socketRef, offlineDocIdRef,
    setConnected, setMyId, setMyRole, setUsers,
    setElements, setTitle, setComments, setSuggestions, setCollaborators,
    setChatMessages, setUnreadMessages,
    playChatNotification,
    serverUrl: effectiveServerUrl,
  });

  // Yjs CRDT provider — handles all document content sync
  const { ydoc, provider } = useYjsProvider({
    docId: effectiveDocId,
    token: effectiveToken,
    serverUrl: effectiveServerUrl,
    currentUser,
    elementsRef,
  });

  const [showSyncConfirm, setShowSyncConfirm] = useState(null); // 'push' | 'pull' | null

  const handlePushToCloud = useCallback(async () => {
    const result = await pushToCloud(docId, { elementsRef, titleRef, beatCardsRef, structureBeatsRef, sceneSynopsisRef, sceneStatusRef, whiteboardElementsRef });
    if (result) {
      console.log('[APP] Pushed to cloud successfully:', result);
    }
  }, [docId, pushToCloud]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePullFromCloud = useCallback(async () => {
    const cloudData = await pullFromCloud(docId);
    if (cloudData) {
      // Apply cloud data to local state
      if (cloudData.title) setTitle(cloudData.title);
      if (cloudData.elements) setElements(cloudData.elements);
      if (cloudData.beatCards) setBeatCards(cloudData.beatCards);
      if (cloudData.structureBeats) setStructureBeats(cloudData.structureBeats);
      if (cloudData.sceneSynopsis) setSceneSynopsis(cloudData.sceneSynopsis);
      if (cloudData.sceneStatus) setSceneStatus(cloudData.sceneStatus);
      if (cloudData.whiteboardElements) setWhiteboardElements(cloudData.whiteboardElements);
      if (cloudData.comments) setComments(cloudData.comments);
      if (cloudData.suggestions) setSuggestions(cloudData.suggestions);
      console.log('[APP] Pulled from cloud successfully');
    }
  }, [docId, pullFromCloud]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleEditingMode = useCallback(async () => {
    if (editingMode === 'local') {
      const cloudData = await switchToCloud();
      if (cloudData) {
        if (cloudData.title) setTitle(cloudData.title);
        if (cloudData.elements) setElements(cloudData.elements);
        if (cloudData.beatCards) setBeatCards(cloudData.beatCards);
        if (cloudData.structureBeats) setStructureBeats(cloudData.structureBeats);
        if (cloudData.sceneSynopsis) setSceneSynopsis(cloudData.sceneSynopsis);
        if (cloudData.sceneStatus) setSceneStatus(cloudData.sceneStatus);
        if (cloudData.whiteboardElements) setWhiteboardElements(cloudData.whiteboardElements);
        if (cloudData.comments) setComments(cloudData.comments);
        if (cloudData.suggestions) setSuggestions(cloudData.suggestions);
        // Force document loader + socket to reconnect via docId change
        loadedDocRef.current = null;
      }
    } else {
      switchToLocal();
      // Force reload from local server
      loadedDocRef.current = null;
      // Re-trigger document loader by setting a new ref state
    }
  }, [editingMode, switchToCloud, switchToLocal]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (user, newToken) => {
    setCurrentUser(user);
    setToken(newToken);
    setShowAuthModal(false);
    // Force document reload after login
    loadedDocRef.current = null;
    
    
    // Restore pending document if user opened a shared link before logging in
    if (pendingDocIdRef.current) {
      const pending = pendingDocIdRef.current;
      pendingDocIdRef.current = null;
      if (pending !== docId) {
        setDocId(pending);
      }
      window.location.hash = pending;
    }
  };
  const handleCloudLogin = useCallback(async (user, newToken) => {
    setCloudUser(user);
    setCloudToken(newToken);
    setShowCloudAuthModal(false);
    if (IS_DESKTOP && window.electronAPI?.cloudAuth) {
      try { await window.electronAPI.cloudAuth.save({ token: newToken, user }); } catch (e) { /* silent */ }
    }
  }, []);

  const handleCloudLogout = useCallback(async () => {
    setCloudUser(null);
    setCloudToken(null);
    if (IS_DESKTOP && window.electronAPI?.cloudAuth) {
      try { await window.electronAPI.cloudAuth.clear(); } catch (e) { /* silent */ }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('screenplay-token'); 
    localStorage.removeItem('screenplay-user'); 
    setCurrentUser(null); 
    setToken(null); 
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Return to landing page
    window.location.hash = '';
    window.location.reload();
  };


  // Apply pending template after document loads
  const templateAppliedRef = useRef(false);
  useEffect(() => {
    if (templateAppliedRef.current) return; // Only apply once
    const pendingTemplate = localStorage.getItem('pendingTemplate');
    if (pendingTemplate && socketRef.current && connected && elements.length <= 2) {
      const template = SCRIPT_TEMPLATES[pendingTemplate];
      if (template) {
        templateAppliedRef.current = true;
        // Clear the pending template
        localStorage.removeItem('pendingTemplate');

        // Apply template elements using generateId for proper UUIDs
        const templateElements = template.elements.map(el => ({
          id: generateId(),
          type: el.type,
          content: el.content
        }));

        setElements(templateElements);
        

        
        // Set title based on template
        const newTitle = `Nouveau script - ${template.name}`;
        setTitle(newTitle);
        socketRef.current.emit('title-change', { title: newTitle });
      }
    }
  }, [elements.length]); // eslint-disable-line

  // Clear text selection and script focus when clicking elsewhere
  useEffect(() => {
    const handleClick = (e) => {
      // Clear text selection
      if (textSelection && !e.target.closest('.context-action-menu') && !e.target.closest('textarea')) {
        setTextSelection(null);
      }
      // Check if click is outside script area
      if (!e.target.closest('.script-page') && !e.target.closest('.context-action-menu') && !e.target.closest('.comments-sidebar')) {
        setScriptHasFocus(false);
      }
    };
    
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [textSelection]);

  // Drag handlers for floating panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingChat) {
        e.preventDefault();
        setChatPosition({
          x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingNote) {
        e.preventDefault();
        setNotePosition({
          x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingTimer) {
        e.preventDefault();
        setTimerPosition({
          x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingNote(false);
      setIsDraggingTimer(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    if (isDraggingChat || isDraggingNote || isDraggingTimer) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingChat, isDraggingNote, isDraggingTimer]);
  
  // Check if any panel is being dragged (for overlay)
  const isDraggingAny = isDraggingChat || isDraggingNote || isDraggingTimer;

  const createNewDocument = async (templateKey = null) => {
    if (!token) { setShowAuthModal(true); return; }
    try {
      const res = await fetch(SERVER_URL + '/api/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      loadedDocRef.current = null;
      
      // If template selected, store it for after the document loads
      if (templateKey && SCRIPT_TEMPLATES[templateKey]) {
        localStorage.setItem('pendingTemplate', templateKey);
      }
      
      window.location.hash = data.id;
      setShowDocsList(false);
      setShowTemplateModal(false);
    } catch (err) { console.error(err); }
  };

  const selectDocument = (id) => { loadedDocRef.current = null; window.location.hash = id; setShowDocsList(false); };

  // remoteCursors removed — Yjs CollaborationCursor handles this
  const canEdit = myRole === 'editor';
  const canEditNow = (isFullyConnected || !!offlineDocId || docId === 'local') && canEdit;
  const canComment = myRole === 'editor' || myRole === 'commenter';

  // V272: lockedElementsMap supprimé (à réimplémenter dans SingleEditor)

  const totalComments = comments.filter(c => !c.resolved).length;

  // Filtered outline based on filters
  const filteredOutline = useMemo(() => {
    return outline.filter(scene => {
      // Filter by status
      if (outlineFilter.status && sceneStatus[scene.id] !== outlineFilter.status) return false;
      // Filter by assignee
      if (outlineFilter.assignee) {
        const assignment = sceneAssignments[scene.id];
        if (!assignment || assignment.userName !== outlineFilter.assignee) return false;
      }
      return true;
    });
  }, [outline, outlineFilter, sceneStatus, sceneAssignments]);

  // Find current scene based on activeIndex
  const currentSceneNumber = useMemo(() => {
    let lastScene = 0;
    for (let i = 0; i <= activeIndex; i++) {
      if (elements[i]?.type === 'scene') lastScene++;
    }
    return lastScene;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]); // Only recalc when cursor moves, not on every keystroke

  // V272: sceneNumbersMap supprimé (numéros de scènes à réimplémenter via décorations ProseMirror)

  // Create snapshot manually (uses refs for stable callback)
  const createSnapshot = useCallback(async () => {
    if (!token || !docId) return;
    try {
      const curTitle = titleRef.current;
      const snapshotName = formatSnapshotName(curTitle, false);
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          title: curTitle,
          elements: elementsRef.current,
          auto: false,
          snapshotName,
          // Beat Board data
          beatCards: beatCardsRef.current,
          structureBeats: structureBeatsRef.current,
          sceneSynopsis: sceneSynopsisRef.current,
          sceneStatus: sceneStatusRef.current,
          whiteboardElements: whiteboardElementsRef.current
        })
      });
      if (res.ok) {
        console.log('[SNAPSHOT] Created:', snapshotName, '(incl. Beat Board data)');
        setLastSaved(new Date());
        // Brief visual feedback
        const btn = document.querySelector('[title="Snapshot (⌘S)"]');
        if (btn) {
          btn.style.background = '#059669';
          setTimeout(() => { btn.style.background = 'transparent'; }, 500);
        }
      }
    } catch (err) { console.error(err); }
  }, [token, docId]);

  // Detect Safari browser for performance optimizations
  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  const { elementPositions } = useElementPositions({ showComments, elementsRef, elementsLength: elements.length, isSafari, scriptContainerRef, commentsSidebarRef });

  // Pre-compute highlights per element (memoized for performance)
  const { highlightsByElement } = useHighlights({ comments, suggestions, pendingInlineComment, currentUser });

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);

  // Undo/redo hook
  const { pushToUndo, undo, redo } = useUndoRedo({
    elementsRef, beatCardsRef, structureBeatsRef, sceneSynopsisRef, sceneStatusRef,
    setElements, setBeatCards, setStructureBeats, setSceneSynopsis, setSceneStatus,
    socketRef
  });

  // Duplicate scene function (moved here for proper hoisting)
  const duplicateScene = useCallback((sceneIndex) => {
    pushToUndo();
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const currentScenePos = sceneIndices.indexOf(sceneIndex);
    const nextSceneIndex = currentScenePos < sceneIndices.length - 1 ? sceneIndices[currentScenePos + 1] : elements.length;
    
    // Get all elements in this scene
    const sceneElements = elements.slice(sceneIndex, nextSceneIndex).map(el => ({
      ...el,
      id: generateId()
    }));
    
    // Insert after the scene
    const newElements = [
      ...elements.slice(0, nextSceneIndex),
      ...sceneElements,
      ...elements.slice(nextSceneIndex)
    ];

    setElements(newElements);
    setLastSaved(new Date());

    if (socketRef.current && connected && canEdit) {
      
    }
  }, [elements, connected, canEdit, pushToUndo]);

  const updateElement = useCallback((i, el, skipUndo = false) => {
    if (!canEditNow) return;
    if (!skipUndo) pushToUndo();
    setElements(p => {
      const u = [...p]; u[i] = el;

      return u;
    });
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
  }, [canEditNow, pushToUndo, currentUser]);

  // Search hook (search/replace, scene navigation)
  const {
    showSearch, setShowSearch, searchQuery, setSearchQuery,
    replaceQuery, setReplaceQuery, searchResults, currentSearchIndex,
    goToSearchResult, replaceOne, replaceAll, navigateToSceneByNumber
  } = useSearch(elements, elementsRef, updateElement, setActiveIndex);

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    showSearch, setShowSearch, showOutline, setShowOutline,
    showNoteFor, setShowNoteFor, showCharactersPanel, setShowCharactersPanel,
    showShortcuts, setShowShortcuts, showRenameChar, setShowRenameChar,
    showGoToScene, setShowGoToScene, activeView, setActiveView,
    focusMode, setFocusMode, docId, elements, activeIndex,
    createSnapshot, undo, redo, duplicateScene
  });

  // Export handlers hook
  const { exportFDX, exportPDF, exportFountain, exportTXT, exportMarkdown } = useExportHandlers({ elementsRef, titleRef });

  const insertElement = useCallback((after, type) => {
    if (!canEditNow) return;
    pushToUndo();
    const el = { id: generateId(), type, content: '' };
    setElements(p => {
      const u = [...p]; u.splice(after + 1, 0, el);

      return u;
    });
    setActiveIndex(after + 1);
    setLastSaved(new Date());
  }, [canEditNow, pushToUndo]);
  // eslint-disable-next-line no-unused-vars
  const deleteElement = useCallback(i => {
    if (!canEditNow) return;
    if (elementsRef.current.length === 1) return;
    pushToUndo();
    setElements(p => p.filter((_, idx) => idx !== i));
    setActiveIndex(Math.max(0, i - 1));
    setLastSaved(new Date());
  }, [canEditNow, pushToUndo]);
  const changeType = useCallback((i, t) => { if (!canEditNow) return; setElements(p => { const u = [...p]; u[i] = { ...u[i], type: t }; return u; }); }, [canEditNow]);
  // Yjs handles all document sync — this callback just extracts elements for stats/outline/export
  const handleElementsExtracted = useCallback((newElements) => {
    if (!newElements || newElements.length === 0) return;
    setElements(newElements);
    setLastSaved(new Date());
  }, []);

  const handleSelectChar = useCallback((i, name) => { updateElement(i, { ...elements[i], content: name }); setTimeout(() => insertElement(i, 'dialogue'), 50); }, [elements, updateElement, insertElement]);
  
  const handleSelectLocation = useCallback((i, location) => {
    const el = elements[i];
    const plain = stripHtml(el.content);
    const match = plain.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i);
    const prefix = match ? match[1] + ' ' : '';
    updateElement(i, { ...el, content: prefix + location + ' - ' });
  }, [elements, updateElement]);

  // Rename character globally
  const renameCharacter = useCallback((fromName, toName) => {
    if (!fromName || !toName || fromName === toName) return;

    const newElements = elements.map(el => {
      if (el.type === 'character' && stripHtml(el.content).trim().toUpperCase() === fromName.toUpperCase()) {
        return { ...el, content: toName };
      }
      return el;
    });
    
    setElements(newElements);
    setShowRenameChar(false);
    
    // Emit changes for each modified element
    if (socketRef.current && connected && canEdit) {
      newElements.forEach((el, i) => {
        if (el !== elements[i]) {
        }
      });
    }
  }, [elements, connected, canEdit]);

  // Move scene (drag & drop)
  // eslint-disable-next-line no-unused-vars
  const moveScene = useCallback((fromSceneIndex, toSceneIndex) => {
    if (fromSceneIndex === toSceneIndex) return;
    
    pushToUndo();
    
    // Find all scene start indices
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    
    const fromPos = sceneIndices.indexOf(fromSceneIndex);
    const toPos = sceneIndices.indexOf(toSceneIndex);
    
    if (fromPos === -1 || toPos === -1) return;
    
    // Get range of elements for the scene being moved
    const fromStart = fromSceneIndex;
    const fromEnd = fromPos < sceneIndices.length - 1 ? sceneIndices[fromPos + 1] : elements.length;
    const sceneElements = elements.slice(fromStart, fromEnd);
    
    // Remove the scene elements
    let newElements = [...elements.slice(0, fromStart), ...elements.slice(fromEnd)];
    
    // Recalculate insertion point
    const newSceneIndices = newElements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const adjustedToPos = toPos > fromPos ? toPos - 1 : toPos;
    const insertAt = adjustedToPos < newSceneIndices.length ? newSceneIndices[adjustedToPos] : newElements.length;
    
    // Insert at new position
    newElements = [...newElements.slice(0, insertAt), ...sceneElements, ...newElements.slice(insertAt)];

    setElements(newElements);
    setLastSaved(new Date());

    if (socketRef.current && connected && canEdit) {
      
    }
  }, [elements, connected, canEdit, pushToUndo]);

  // Notes management
  const updateNote = useCallback((elementId, content, color = '#fef3c7') => {
    if (!content || !content.trim()) {
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } else {
      setNotes(prev => ({ ...prev, [elementId]: { content: content.trim(), color } }));
    }
    setShowNoteFor(null);
  }, []);

  const pushNoteToComment = async (elementId) => {
    const note = notes[elementId];
    if (!note || !token || !docId) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, 
        body: JSON.stringify({ elementId, content: '📝 ' + note.content }) 
      });
      // Remove the note after pushing
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } catch (err) { console.error(err); }
  };

  // V272: handleFocus supprimé (curseur géré par TipTap single editor)

  // V272: handleNoteClick supprimé (SceneLine legacy)
  
  const handleTextSelectCb = useCallback((selection) => {
    if (canComment) {
      setTextSelection(selection);
      if (selection && selection.rect) {
        setContextMenuTop(selection.rect.top);
      }
    }
  }, [canComment]);
  
  const handleHighlightClick = useCallback((commentId) => {
    setShowComments(true);
    setSelectedCommentId(commentId);
    setSelectedSuggestionId(null);
    setTimeout(() => {
      const commentCard = document.querySelector(`[data-comment-card-id="${commentId}"]`);
      if (commentCard) {
        commentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }, []);
  
  const handleSuggestionClickCb = useCallback((suggestionId) => {
    setShowComments(true);
    setSelectedSuggestionId(suggestionId);
    setSelectedCommentId(null);
    setTimeout(() => {
      const suggestionCard = document.querySelector(`[data-suggestion-card-id="${suggestionId}"]`);
      if (suggestionCard) {
        suggestionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }, []);

  // V272: handleKeyDown supprimé — keyboard shortcuts gérés nativement par ScreenplayElement node

  // Multi-block clipboard hook
  useMultiBlockClipboard({
    selectedRange, setSelectedRange, elementsRef, canEditNow,
    pushToUndo, setElements, setActiveIndex,
    copiedBlocksRef, socketRef, connected, canEdit, offlineDocIdRef
  });

  useDragSelect({ elementsRef, dragStartIndexRef, isDragSelecting, setIsDragSelecting, selectedRange, setSelectedRange, copiedBlocksRef });

  // Outline sidebar scene reorder (DnD drop handler)
  const handleOutlineDrop = (draggedSceneObj, targetSceneObj, dropBefore) => {
    pushToUndo();
    const els = elementsRef.current;
    const sceneIndices = els.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);

    const draggedScenePos = sceneIndices.indexOf(draggedSceneObj.index);
    const draggedStart = draggedSceneObj.index;
    const draggedEnd = draggedScenePos < sceneIndices.length - 1
      ? sceneIndices[draggedScenePos + 1]
      : els.length;
    const draggedElements = els.slice(draggedStart, draggedEnd);

    let newElements = [...els];
    newElements.splice(draggedStart, draggedElements.length);

    const newSceneIndices = newElements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const targetSceneInNew = newElements.findIndex(el => el.id === targetSceneObj.id);
    const targetScenePosInNew = newSceneIndices.indexOf(targetSceneInNew);

    let insertPos;
    if (dropBefore) {
      insertPos = targetSceneInNew;
    } else {
      insertPos = targetScenePosInNew < newSceneIndices.length - 1
        ? newSceneIndices[targetScenePosInNew + 1]
        : newElements.length;
    }

    newElements.splice(insertPos, 0, ...draggedElements);
    setElements(newElements);

    const newSceneOrder = newElements.filter(el => el.type === 'scene').map(el => el.id);
    setBeatCards(prev => {
      const cardsInTimeline = prev.filter(c => c.timelineIndex !== null && c.linkedSceneId);
      if (cardsInTimeline.length === 0) return prev;
      const sortedCards = [...cardsInTimeline].sort((a, b) => {
        const aPos = newSceneOrder.indexOf(a.linkedSceneId);
        const bPos = newSceneOrder.indexOf(b.linkedSceneId);
        return aPos - bPos;
      });
      const newIndexMap = {};
      sortedCards.forEach((card, idx) => { newIndexMap[card.id] = idx; });
      return prev.map(c => newIndexMap[c.id] !== undefined ? { ...c, timelineIndex: newIndexMap[c.id] } : c);
    });

    if (socketRef.current && connected && canEdit) {
      
    }
  };

  // AI Rewrite hook
  const { handleAIRewrite, applyAIRewrite } = useAIRewrite({
    token, aiRewriteSelection, aiRewriteTone, elementsRef,
    setAiRewriteResult, setAiRewriteLoading,
    setShowAIRewrite, setAiRewriteSelection, setAiRewriteMode,
    updateElement
  });

  const shareLink = window.location.origin + '/#' + docId;

  const openShareModal = async () => {
    setShowShareModal(true);
    // Auto-enable public access when sharing (owner only)
    if (isOwner && !publicAccessState.enabled) {
      try {
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ enabled: true, role: publicAccessState.role }),
        });
        if (res.ok) {
          const data = await res.json();
          setPublicAccessState(data.publicAccess);
        }
      } catch (err) { /* silent */ }
    }
  };

  const togglePublicAccess = async (enabled) => {
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublicAccessState(data.publicAccess);
      }
    } catch (err) { /* silent */ }
  };

  const changePublicRole = async (role) => {
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/public-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublicAccessState(data.publicAccess);
      }
    } catch (err) { /* silent */ }
  };

  const copyLink = () => { openShareModal(); };

  // ============ DESKTOP: bind menu handlers + sync title ============
  desktopMenuRef.current = { createNewDocument, createSnapshot, exportPDF, exportFDX, exportFountain, setShowDocsList };
  useEffect(() => {
    if (!IS_DESKTOP) return;
    const cleanup = window.electronAPI.onMenuAction((action) => {
      const h = desktopMenuRef.current;
      switch (action) {
        case 'new-document': h.createNewDocument?.(); break;
        case 'open-documents': h.setShowDocsList?.(true); break;
        case 'save-snapshot': h.createSnapshot?.(); break;
        case 'export-pdf': h.exportPDF?.(); break;
        case 'export-fdx': h.exportFDX?.(); break;
        case 'export-fountain': h.exportFountain?.(); break;
        default: break;
      }
    });
    return cleanup;
  }); // intentionally no deps — ref always has latest handlers
  // Sync window title
  useEffect(() => {
    if (IS_DESKTOP && title) window.electronAPI.setTitle(title);
  }, [title]);

  usePageBackgrounds({ darkMode, pageWrapperRef, pageBgTimerRef });

  // Desktop: wait until port/user are ready before showing UI
  if (IS_DESKTOP && !desktopReady) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', color: 'white', fontSize: 18 }}>Chargement...</div>;
  }

  // Show landing page if not logged in (no token)
  if (!token && (!docId || docId === '')) {
    return <LandingPage language={language} setLanguage={setLanguage} t={t} setTitle={setTitle} setShowAuthModal={setShowAuthModal} showAuthModal={showAuthModal} handleLogin={handleLogin} />;
  }

  return (
    <div className={`${darkMode ? 'theme-dark' : 'theme-light'}${focusMode ? ' focus-mode-active' : ''}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#2b2b2b' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#2b2b2b', transition: 'background 0.3s, color 0.3s', overflow: 'hidden' }}>
      <Suspense fallback={null}>
        {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
        {showCloudAuthModal && <AuthModal targetServer={CLOUD_URL} onLogin={handleCloudLogin} onClose={() => setShowCloudAuthModal(false)} t={t} />}
        {showTemplateModal && <TemplateModal onSelectTemplate={createNewDocument} onClose={() => setShowTemplateModal(false)} darkMode={darkMode} />}
        {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={() => { setShowDocsList(false); setShowTemplateModal(true); }} onClose={() => setShowDocsList(false)} t={t} />}
        {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} t={t} />}
      </Suspense>
      
      {/* Search Panel */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 70, left: showOutline ? 'calc(50% + 150px)' : '50%', transform: 'translateX(-50%)', background: darkMode ? '#333333' : 'white', borderRadius: 8, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', gap: 8, alignItems: 'center', transition: 'left 0.2s ease' }}>
          <input 
            autoFocus
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Rechercher..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 200 }}
            onKeyDown={e => { if (e.key === 'Enter') goToSearchResult(1); }}
          />
          <input 
            value={replaceQuery} 
            onChange={e => setReplaceQuery(e.target.value)} 
            placeholder="Remplacer..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 150 }}
          />
          <span style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12, minWidth: 50 }}>
            {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
          </span>
          <button onClick={() => goToSearchResult(-1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▲</button>
          <button onClick={() => goToSearchResult(1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▼</button>
          <button onClick={replaceOne} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Remplacer</button>
          <button onClick={replaceAll} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Tout</button>
          <button onClick={() => setShowSearch(false)} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      
      <HeaderBar
        showOutline={showOutline} setShowOutline={setShowOutline}
        showComments={showComments} setShowComments={setShowComments}
        showTimer={showTimer} setShowTimer={setShowTimer}
        focusMode={focusMode} setFocusMode={setFocusMode}
        darkMode={darkMode} setDarkMode={setDarkMode}
        title={title} docId={docId} lastSaved={lastSaved} loading={loading} importing={importing}
        connected={connected} isFullyConnected={isFullyConnected} offlineDocId={offlineDocId}
        users={users} currentUser={currentUser} myId={myId} myRole={myRole} isOwner={isOwner}
        totalComments={totalComments} unreadMessages={unreadMessages} canEdit={canEdit}
        t={t}
        activeView={activeView} setActiveView={setActiveView}
        activeIndex={activeIndex} elements={elements} changeType={changeType}
        showSearch={showSearch} setShowSearch={setShowSearch}
        showSceneNumbers={showSceneNumbers} setShowSceneNumbers={setShowSceneNumbers}
        showCharactersPanel={showCharactersPanel} setShowCharactersPanel={setShowCharactersPanel}
        scriptFont={scriptFont} setScriptFont={setScriptFont}
        pageFormat={pageFormat} setPageFormat={setPageFormat}
        chatNotificationSound={chatNotificationSound} setChatNotificationSound={setChatNotificationSound}
        language={language} setLanguage={setLanguage}
        token={token}
        emitTitle={(val) => docId ? emitTitle(val) : setTitle(val)}
        onNewDoc={() => { if (!token) { setShowAuthModal(true); } else { setShowTemplateModal(true); } }}
        onShowDocuments={() => setShowDocsList(true)}
        onShowHistory={() => setShowHistory(true)}
        onShowShare={() => setShowShareModal(true)}
        onShowStats={() => setShowStats(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowChat={() => setShowChat(!showChat)} showChat={showChat}
        onShowRenameChar={() => setShowRenameChar(true)}
        onShowGoToScene={() => setShowGoToScene(true)}
        onImportFDX={() => importFDX({ token, setShowAuthModal, setImporting, loadedDocRef })} onCreateSnapshot={createSnapshot}
        onExportFDX={exportFDX} onExportPDF={exportPDF}
        onExportFountain={exportFountain} onExportTXT={exportTXT} onExportMarkdown={exportMarkdown}
        onLogin={() => setShowAuthModal(true)} onLogout={handleLogout}
        onCopyLink={copyLink}
        editingMode={editingMode} cloudShortId={cloudShortId} cloudSyncedAt={cloudSyncedAt}
        onToggleEditingMode={handleToggleEditingMode}
        cloudUser={cloudUser} onCloudLogin={() => setShowCloudAuthModal(true)} onCloudLogout={handleCloudLogout}
      />
      
      {/* OFFLINE BANNER */}
      {docId && docId !== 'local' && !isFullyConnected && !offlineDocId && (
        <div style={{
          background: darkMode ? '#92400e' : '#fef3c7',
          color: darkMode ? '#fef3c7' : '#92400e',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#78350f' : '#fde68a'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{t('offlineBanner')}</span>
          <button
            onClick={activateOfflineMode}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: darkMode ? '#f59e0b' : '#92400e',
              color: darkMode ? '#1a1a1a' : 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('offlineWorkCopy')}
          </button>
        </div>
      )}

      {/* OFFLINE MODE BANNER */}
      {offlineDocId && !isFullyConnected && (
        <div style={{
          background: darkMode ? '#1e3a5f' : '#dbeafe',
          color: darkMode ? '#93c5fd' : '#1e40af',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#1e3a5f' : '#93c5fd'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
          <span>{t('offlineMode')}</span>
        </div>
      )}

      {/* CONNECTION RESTORED BANNER (offline mode + back online) */}
      {offlineDocId && isFullyConnected && (
        <div style={{
          background: darkMode ? '#064e3b' : '#d1fae5',
          color: darkMode ? '#6ee7b7' : '#065f46',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 500,
          borderBottom: `1px solid ${darkMode ? '#065f46' : '#6ee7b7'}`,
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{t('connectionRestored')}</span>
          <button
            onClick={() => pushOfflineChanges(false)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: darkMode ? '#10b981' : '#065f46',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('pushChanges')}
          </button>
          <button
            onClick={discardOfflineCopy}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: `1px solid ${darkMode ? '#6ee7b7' : '#065f46'}`,
              background: 'transparent',
              color: darkMode ? '#6ee7b7' : '#065f46',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('discardOffline')}
          </button>
        </div>
      )}

      {/* CONFLICT MODAL */}
      {showConflictModal && (
        <>
          <div onClick={() => setShowConflictModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: darkMode ? '#2b2b2b' : 'white',
            borderRadius: 12,
            padding: 24,
            width: 420,
            maxWidth: '90vw',
            zIndex: 10000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 16, fontWeight: 700, color: darkMode ? 'white' : '#1a1a1a' }}>{t('conflictTitle')}</span>
            </div>
            <p style={{ fontSize: 13, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              {t('conflictMessage')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Only show overwrite if doc is NOT shared with others */}
              {collaborators.length <= 1 && (
                <button onClick={() => pushOfflineChanges(true)} style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#ef4444', color: 'white', fontSize: 13, fontWeight: 600,
                }}>{t('conflictOverwrite')}</button>
              )}
              <button onClick={discardOfflineCopy} style={{
                padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: darkMode ? '#484848' : '#f3f4f6', color: darkMode ? 'white' : '#1a1a1a', fontSize: 13, fontWeight: 600,
              }}>{t('conflictKeepOnline')}</button>
              <button onClick={() => { window.open(window.location.href, '_blank'); setShowConflictModal(false); }} style={{
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, cursor: 'pointer',
                background: darkMode ? '#3b82f6' : '#2563eb', color: 'white', fontSize: 13, fontWeight: 600,
              }}>{t('conflictCompare')}</button>
            </div>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        {showShareModal && <ShareModal shareLink={shareLink} isOwner={isOwner} publicAccessState={publicAccessState} togglePublicAccess={togglePublicAccess} changePublicRole={changePublicRole} onClose={() => { setShowShareModal(false); setShowSyncConfirm(null); }} darkMode={darkMode} language={language} cloudShortId={cloudShortId} cloudToken={cloudToken} cloudSyncedAt={cloudSyncedAt} syncing={syncing} onPushToCloud={handlePushToCloud} onPullFromCloud={handlePullFromCloud} onCloudLogin={() => { setShowShareModal(false); setShowCloudAuthModal(true); }} showSyncConfirm={showSyncConfirm} setShowSyncConfirm={setShowSyncConfirm} />}
      </Suspense>

      {/* MAIN CONTENT AREA - Flex layout with sidebars */}
      <div style={{
        flex: 1,
        minHeight: 0, /* Prevent flex overflow — allows footer to stay visible */
        display: activeView === 'script' ? 'flex' : 'none',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: darkMode ? 'rgba(43, 43, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#60a5fa' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style={{ marginTop: 16, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>
              {t('loadingDocument')}
            </p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {/* LEFT SIDEBAR - Outline */}
        {showOutline && (
          <OutlineSidebar
            outline={outline}
            filteredOutline={filteredOutline}
            currentSceneNumber={currentSceneNumber}
            outlineFilter={outlineFilter}
            setOutlineFilter={setOutlineFilter}
            beatCards={beatCards}
            structureBeats={structureBeats}
            setStructureBeats={setStructureBeats}
            sceneStatus={sceneStatus}
            setSceneStatus={setSceneStatus}
            sceneAssignments={sceneAssignments}
            setSceneAssignments={setSceneAssignments}
            lockedScenes={lockedScenes}
            setLockedScenes={setLockedScenes}
            users={users}
            collaborators={collaborators}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            scriptContainerRef={scriptContainerRef}
            outlineSidebarRef={outlineSidebarRef}
            onDrop={handleOutlineDrop}
            onClose={() => setShowOutline(false)}
            darkMode={darkMode}
            t={t}
          />
        )}

        {/* CENTER - Script content */}
        <div
          ref={scriptContainerRef}
          className="script-container"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            display: 'flex',
            justifyContent: 'center',
            padding: 32,
            gap: 20,
            background: darkMode ? '#2a2a2a' : '#e0e0e0',
            ...(isDragSelecting ? { userSelect: 'none', WebkitUserSelect: 'none', cursor: 'default' } : {}),
          }}
        >
          {/* V272: Single TipTap Editor for entire document */}
          <div ref={pageWrapperRef} className="screenplay-editor-wrapper" style={{
            /* No background/boxShadow here — per-page backgrounds are created
               dynamically as absolute-positioned divs (see page-bg useEffect) */
            color: darkMode ? '#e0e0e0' : '#111',
            width: (PAGE_FORMATS[pageFormat] || PAGE_FORMATS['us-letter']).width,
            minHeight: (PAGE_FORMATS[pageFormat] || PAGE_FORMATS['us-letter']).height,
            padding: (PAGE_FORMATS[pageFormat] || PAGE_FORMATS['us-letter']).padding,
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 0, /* creates stacking context so z-index:-1 backgrounds work */
            zoom: scriptZoom,
            fontFamily: getFontFamily(scriptFont),
            fontSize: '12pt',
            lineHeight: '1',
          }}>
            <SingleEditor
              ydoc={ydoc}
              provider={provider}
              currentUser={currentUser}
              elements={elements}
              canEdit={canEditNow}
              scriptFont={scriptFont}
              darkMode={darkMode}
              characters={extractedCharacters}
              locations={extractedLocations}
              onSelectCharacter={handleSelectChar}
              onSelectLocation={handleSelectLocation}
              onTextSelect={handleTextSelectCb}
              onHighlightClick={handleHighlightClick}
              onSuggestionClick={handleSuggestionClickCb}
              onEditorFocus={() => setScriptHasFocus(true)}
              onActiveElementChange={setActiveIndex}
              onElementsExtracted={handleElementsExtracted}
              computePageInfoFn={computePageInfo}
              highlightsByElement={highlightsByElement}
              lockedScenes={lockedScenes}
              t={t}
            />
          </div>

      </div>

      {/* RIGHT SIDEBAR - Comments */}
      {showComments && (
        <div style={{ 
          width: 320,
          minWidth: 250,
          flexShrink: 1,
          background: darkMode ? '#333333' : 'white', 
          borderLeft: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <CommentsSidebar 
            comments={comments} 
            suggestions={suggestions}
            elements={elements} 
            activeIndex={activeIndex}
            selectedCommentIndex={selectedCommentIndex}
            selectedCommentId={selectedCommentId}
            onSelectComment={(id) => { setSelectedCommentId(id); if (id) setSelectedSuggestionId(null); }}
            elementPositions={elementPositions}
            scrollContainerRef={commentsSidebarRef}
            scriptContainerRef={scriptContainerRef}
            scriptScrollHeight={scriptScrollHeight}
            token={token} 
            docId={docId} 
            canComment={canComment}
            onClose={() => { setShowComments(false); setSelectedCommentIndex(null); setSelectedCommentId(null); setSelectedSuggestionId(null); setPendingInlineComment(null); setPendingSuggestion(null); }}
            darkMode={darkMode}
            t={t}
            onNavigateToElement={(idx) => {
              setActiveIndex(idx);
              setSelectedCommentIndex(idx);
              setTimeout(() => {
                const elId = elementsRef.current[idx]?.id;
                const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }}
            pendingInlineComment={pendingInlineComment}
            onSubmitInlineComment={(commentText) => {
              if (pendingInlineComment && commentText.trim()) {
              const newComment = {
                id: 'comment-' + Date.now(),
                elementId: pendingInlineComment.elementId,
                elementIndex: pendingInlineComment.elementIndex,
                highlight: {
                  text: pendingInlineComment.text,
                  startOffset: pendingInlineComment.startOffset,
                  endOffset: pendingInlineComment.endOffset
                },
                spans: pendingInlineComment.spans || null,
                content: commentText.trim(),
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                resolved: false,
                replies: []
              };
              
              setComments(prev => [...prev, newComment]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('comment-add', { comment: newComment });
              }
              
              setPendingInlineComment(null);
            }
          }}
          onCancelInlineComment={() => setPendingInlineComment(null)}
          pendingSuggestion={pendingSuggestion}
          onSubmitSuggestion={(suggestedText) => {
            if (pendingSuggestion) {
              const newSuggestion = {
                id: 'suggestion-' + Date.now(),
                elementId: pendingSuggestion.elementId,
                elementIndex: pendingSuggestion.elementIndex,
                originalText: pendingSuggestion.originalText,
                suggestedText: suggestedText,
                startOffset: pendingSuggestion.startOffset,
                endOffset: pendingSuggestion.endOffset,
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                status: 'pending'
              };
              
              setSuggestions(prev => [...prev, newSuggestion]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('suggestion-add', { suggestion: newSuggestion });
              }
              
              setPendingSuggestion(null);
            }
          }}
          onCancelSuggestion={() => setPendingSuggestion(null)}
          onAcceptSuggestion={(suggestionId) => {
            const suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion) {
              // Apply the suggestion to the element
              const elementIndex = elements.findIndex(el => el.id === suggestion.elementId);
              if (elementIndex !== -1) {
                const element = elements[elementIndex];
                const plain = stripHtml(element.content);
                const newContent =
                  plain.substring(0, suggestion.startOffset) +
                  suggestion.suggestedText +
                  plain.substring(suggestion.endOffset);
                updateElement(elementIndex, { ...element, content: newContent });
              }
              // Remove the suggestion
              setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
              if (socketRef.current) {
                socketRef.current.emit('suggestion-accept', { suggestionId });
              }
            }
          }}
          onRejectSuggestion={(suggestionId) => {
            setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
            if (socketRef.current) {
              socketRef.current.emit('suggestion-reject', { suggestionId });
            }
          }}
          selectedSuggestionId={selectedSuggestionId}
          onSelectSuggestion={(id) => { setSelectedSuggestionId(id); if (id) setSelectedCommentId(null); }}
          users={users}
          collaborators={collaborators}
        />
        </div>
      )}
      </div>

      {/* FOOTER — Page count (left) + Zoom slider (right), like Final Draft */}
      {activeView === 'script' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, padding: '4px 16px',
          background: darkMode ? '#333333' : 'white',
          borderTop: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
          fontSize: 12, color: darkMode ? '#aaa' : '#666',
          flexShrink: 0, height: 28,
        }}>
          {/* Page count — left side */}
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {stats.pageCount || 1} {stats.pageCount === 1 ? 'page' : 'pages'}
          </span>
          {/* Zoom — right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { const z = Math.max(0.5, Math.round((scriptZoom - 0.1) * 10) / 10); setScriptZoom(z); localStorage.setItem('rooms-script-zoom', String(z)); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: '0 4px', lineHeight: 1 }}
            title="Zoom out"
          >−</button>
          <input
            type="range" min="0.5" max="2" step="0.05"
            value={scriptZoom}
            onChange={e => { const z = parseFloat(e.target.value); setScriptZoom(z); localStorage.setItem('rooms-script-zoom', String(z)); }}
            style={{ width: 100, cursor: 'pointer', accentColor: darkMode ? '#888' : '#555' }}
          />
          <button
            onClick={() => { const z = Math.min(2, Math.round((scriptZoom + 0.1) * 10) / 10); setScriptZoom(z); localStorage.setItem('rooms-script-zoom', String(z)); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: '0 4px', lineHeight: 1 }}
            title="Zoom in"
          >+</button>
          <span style={{ minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(scriptZoom * 100)}%
          </span>
          </div>
        </div>
      )}

      {/* Beat Board - Only mounted when feature is enabled */}
      {ENABLE_BEATBOARD && (
      <div style={{ flex: 1, display: activeView === 'beatboard' ? 'flex' : 'none', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <BeatBoard
          elements={elements}
          setElements={setElements}
          darkMode={darkMode}
          sceneSynopsis={sceneSynopsis}
          setSceneSynopsis={setSceneSynopsis}
          sceneStatus={sceneStatus}
          setSceneStatus={setSceneStatus}
          beatCards={beatCards}
          setBeatCards={setBeatCards}
          structureBeats={structureBeats}
          setStructureBeats={setStructureBeats}
          whiteboardElements={whiteboardElements}
          setWhiteboardElements={setWhiteboardElements}
          onPushToUndo={pushToUndo}
          isActive={activeView === 'beatboard'}
          t={t}
        />
      </div>
      )}
      
      {/* Characters Panel */}
      {showCharactersPanel && (
        <CharactersPanel 
          characterStats={characterStats}
          darkMode={darkMode}
          onClose={() => setShowCharactersPanel(false)}
          onNavigate={(idx) => {
            setActiveIndex(idx);
            setTimeout(() => {
              const elId = elementsRef.current[idx]?.id;
              const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
        />
      )}
      
      <Suspense fallback={null}>
      {/* Note Editor Modal - FLOATING */}
      {showNoteFor && (
        <NoteEditorModal
          elementId={showNoteFor}
          note={notes[showNoteFor]}
          onSave={updateNote}
          onPushToComment={pushNoteToComment}
          onClose={() => setShowNoteFor(null)}
          darkMode={darkMode}
          canPush={!!token && !!docId && canComment}
          position={notePosition}
          t={t}
          onDragStart={(e) => {
            e.preventDefault();
            if (e.target.tagName === 'BUTTON') return;
            setIsDraggingNote(true);
            dragOffsetRef.current = { x: e.clientX - notePosition.x, y: e.clientY - notePosition.y };
          }}
        />
      )}
      

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <ShortcutsPanel
          onClose={() => setShowShortcuts(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          stats={stats}
          elements={elements}
          onClose={() => setShowStats(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Rename Character Modal */}
      {showRenameChar && (
        <RenameCharacterModal
          characters={extractedCharacters}
          onRename={renameCharacter}
          onClose={() => setShowRenameChar(false)}
          darkMode={darkMode}
          t={t}
        />
      )}
      
      {/* Go To Scene Modal */}
      {showGoToScene && (
        <GoToSceneModal
          onClose={() => setShowGoToScene(false)}
          onGoTo={navigateToSceneByNumber}
          maxScene={outline.length}
          darkMode={darkMode}
        />
      )}
      
      {/* Context Action Menu */}
      <ContextActionMenu
        contextMenuTop={contextMenuTop}
        showOutline={showOutline} showComments={showComments}
        canComment={canComment}
        scriptHasFocus={scriptHasFocus} textSelection={textSelection} selectedRange={selectedRange}
        elements={elements} activeIndex={activeIndex} stripHtml={stripHtml}
        t={t}
        onComment={({ hasSelection, currentElement }) => {
          if (selectedRange) {
            const { start, end } = selectedRange;
            const spans = [];
            let fullText = '';
            for (let i = start; i <= end; i++) {
              const el = elements[i];
              if (!el) continue;
              const plain = stripHtml(el.content);
              spans.push({ elementId: el.id, elementIndex: i, startOffset: 0, endOffset: plain.length });
              if (fullText) fullText += '\n';
              fullText += plain;
            }
            setPendingInlineComment({ elementId: elements[start]?.id, elementIndex: start, text: fullText, startOffset: 0, endOffset: stripHtml(elements[start]?.content).length || 0, spans });
            setSelectedRange(null);
          } else if (hasSelection) {
            setPendingInlineComment({ elementId: textSelection.elementId, elementIndex: textSelection.elementIndex, text: textSelection.text, startOffset: textSelection.startOffset, endOffset: textSelection.endOffset });
          } else {
            setPendingInlineComment({ elementId: currentElement?.id, elementIndex: activeIndex, text: stripHtml(currentElement?.content) || '', startOffset: 0, endOffset: stripHtml(currentElement?.content).length || 0 });
          }
          setShowComments(true);
          setTextSelection(null);
        }}
        onSuggest={({ hasSelection, currentElement }) => {
          if (hasSelection) {
            setPendingSuggestion({ elementId: textSelection.elementId, elementIndex: textSelection.elementIndex, originalText: textSelection.text, startOffset: textSelection.startOffset, endOffset: textSelection.endOffset });
          } else {
            setPendingSuggestion({ elementId: currentElement?.id, elementIndex: activeIndex, originalText: stripHtml(currentElement?.content) || '', startOffset: 0, endOffset: stripHtml(currentElement?.content).length || 0 });
          }
          setShowComments(true);
          setTextSelection(null);
        }}
        onAIRewrite={({ hasSelection, currentElement }) => {
          if (hasSelection) {
            setAiRewriteSelection({ elementId: textSelection.elementId, elementIndex: textSelection.elementIndex, text: textSelection.text, startOffset: textSelection.startOffset, endOffset: textSelection.endOffset });
          } else {
            setAiRewriteSelection({ elementId: currentElement?.id, elementIndex: activeIndex, text: stripHtml(currentElement?.content) || '', startOffset: 0, endOffset: stripHtml(currentElement?.content).length || 0 });
          }
          setShowAIRewrite(true);
          setAiRewriteMode(null);
          setAiRewriteResult(null);
          setTextSelection(null);
        }}
      />

      {/* AI Rewrite Modal */}
      {showAIRewrite && aiRewriteSelection && (
        <AIRewriteModal
          aiRewriteSelection={aiRewriteSelection} aiRewriteResult={aiRewriteResult} aiRewriteLoading={aiRewriteLoading}
          aiRewriteTone={aiRewriteTone} setAiRewriteTone={setAiRewriteTone}
          aiRewriteCustomPrompt={aiRewriteCustomPrompt} setAiRewriteCustomPrompt={setAiRewriteCustomPrompt}
          aiRewriteMode={aiRewriteMode} setAiRewriteMode={setAiRewriteMode}
          onRewrite={handleAIRewrite} onApply={() => applyAIRewrite(aiRewriteResult)}
          onClose={() => { setShowAIRewrite(false); setAiRewriteSelection(null); setAiRewriteResult(null); setAiRewriteMode(null); }}
          onResetResult={() => { setAiRewriteResult(null); setAiRewriteMode(null); }}
          darkMode={darkMode}
        />
      )}
      </Suspense>

      {/* Drag overlay - prevents blue selection during panel drag */}
      {isDraggingAny && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 150, 
          cursor: 'grabbing',
          background: 'transparent'
        }} />
      )}
      
      {/* Chat Panel - FLOATING */}
      {showChat && (
        <ChatPanel
          chatPosition={chatPosition}
          onMouseDown={(e) => { e.preventDefault(); if (e.target.tagName === 'BUTTON') return; setIsDraggingChat(true); dragOffsetRef.current = { x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y }; }}
          onClose={() => setShowChat(false)}
          chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput}
          sendChatMessage={sendChatMessage} chatEndRef={chatEndRef}
          users={users} myId={myId} darkMode={darkMode}
        />
      )}
      
      {/* Writing Timer Widget - FLOATING */}
      {showTimer && (
        <WritingTimerWidget
          timerPosition={timerPosition} timerCompact={timerCompact} setTimerCompact={setTimerCompact}
          timerSeconds={timerSeconds} timerRunning={timerRunning} setTimerRunning={setTimerRunning}
          timerMode={timerMode} setTimerMode={setTimerMode}
          sprintDuration={sprintDuration} sprintTimeLeft={sprintTimeLeft} setSprintTimeLeft={setSprintTimeLeft}
          sessionWordCount={sessionWordCount} resetTimer={resetTimer} setSprintMinutes={setSprintMinutes}
          writingGoal={writingGoal} setWritingGoal={setWritingGoal}
          onMouseDown={(e) => { e.preventDefault(); dragOffsetRef.current = { x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y }; setIsDraggingTimer(true); }}
          onClose={() => setShowTimer(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Focus Mode Overlay - dims everything except current element */}
      {focusMode && (
        <style>{`
          .focus-mode-active [data-element-id]:not([data-element-id="${elements[activeIndex]?.id}"]) {
            opacity: 0.3 !important;
            transition: opacity 0.3s ease;
          }
          .focus-mode-active [data-element-id="${elements[activeIndex]?.id}"] {
            opacity: 1 !important;
          }
        `}</style>
      )}
    </div>
  );
}
