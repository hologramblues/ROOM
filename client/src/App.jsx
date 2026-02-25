import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import '@excalidraw/excalidraw/index.css';

// Constants
import { IS_DESKTOP, SERVER_URL } from './constants/config';
import { translations } from './constants/translations';
import { FDX_TO_TYPE } from './constants/elementTypes';
import { SCRIPT_TEMPLATES } from './constants/templates';
import { getFontFamily } from './constants/fonts';

// Utilities
import { stripHtml, generateId } from './utils/helpers';

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

// Components
import AuthModal from './components/AuthModal';
import DocumentsList from './components/DocumentsList';
import HistoryPanel from './components/HistoryPanel';
import CommentsSidebar from './components/CommentsSidebar';
import CharactersPanel from './components/CharactersPanel';
import NoteEditorModal from './components/NoteEditorModal';
import StatsPanel from './components/StatsPanel';
import GoToSceneModal from './components/GoToSceneModal';
import ShortcutsPanel from './components/ShortcutsPanel';
import RenameCharacterModal from './components/RenameCharacterModal';
import SingleEditor from './components/SingleEditor';
import BeatBoard from './components/BeatBoard';
import WritingTimerWidget from './components/WritingTimerWidget';
import ChatPanel from './components/ChatPanel';
import AIRewriteModal from './components/AIRewriteModal';
import OutlineSidebar from './components/OutlineSidebar';
import HeaderBar from './components/HeaderBar';
import ContextActionMenu from './components/ContextActionMenu';
import Logo from './components/Logo';

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
  const [elementPositions, setElementPositions] = useState({}); // { elementIndex: topPosition }
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
  const loadedDocRef = useRef(null);
  const scriptContainerRef = useRef(null);
  const pageWrapperRef = useRef(null);
  const pageBgTimerRef = useRef(null);
  const outlineSidebarRef = useRef(null);
  const commentsSidebarRef = useRef(null);

  // Simple 1:1 scroll sync between Script and Comments (like they're glued together)
  // + Scene-based sync between Script and Outline
  // Scroll sync for script <-> comments <-> outline (works on all browsers including Safari)
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;

    const isSafariSync = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Use a timestamp-based lock instead of RAF flag to prevent scroll loops on Safari
    // Safari fires scroll events asynchronously, so RAF-based flags can miss the loop
    let scrollSource = null; // 'script' | 'comments' | 'outline' | null
    let lockTimeout = null;
    const LOCK_MS = isSafariSync ? 60 : 0; // Safari needs a brief lock window

    const acquireLock = (source) => {
      if (scrollSource && scrollSource !== source) return false;
      scrollSource = source;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => { scrollSource = null; }, LOCK_MS);
      return true;
    };

    let outlineRAF = null;
    let lastTopScene = null;

    const findTopSceneInScript = () => {
      const scriptRect = script.getBoundingClientRect();
      const sceneElements = script.querySelectorAll('[data-element-id]');

      for (const el of sceneElements) {
        const elId = el.getAttribute('data-element-id');
        const idx = elementsRef.current.findIndex(e => e.id === elId);
        if (idx === -1 || elementsRef.current[idx]?.type !== 'scene') continue;

        const rect = el.getBoundingClientRect();
        if (rect.top >= scriptRect.top - 50 && rect.top <= scriptRect.top + 150) {
          return idx;
        }
        if (rect.bottom > scriptRect.top + 50) {
          return idx;
        }
      }
      return null;
    };

    const findTopSceneInOutline = () => {
      const outline = outlineSidebarRef.current;
      if (!outline) return null;
      const outlineRect = outline.getBoundingClientRect();
      const sceneElements = outline.querySelectorAll('[data-outline-element-index]');

      for (const el of sceneElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= outlineRect.top - 20 && rect.top <= outlineRect.top + 80) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
        if (rect.bottom > outlineRect.top + 20) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
      }
      return null;
    };

    const scrollOutlineToScene = (sceneIndex) => {
      const outline = outlineSidebarRef.current;
      if (!outline) return;
      const sceneEl = outline.querySelector(`[data-outline-element-index="${sceneIndex}"]`);
      if (sceneEl) {
        const outlineRect = outline.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = outline.scrollTop + (sceneRect.top - outlineRect.top) - 10;
        outline.scrollTop = Math.max(0, targetScroll);
      }
    };

    const scrollScriptToScene = (sceneIndex) => {
      const sceneId = elementsRef.current[sceneIndex]?.id;
      const sceneEl = sceneId ? script.querySelector(`[data-element-id="${sceneId}"]`) : null;
      if (sceneEl) {
        const scriptRect = script.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = script.scrollTop + (sceneRect.top - scriptRect.top) - 32;
        script.scrollTop = Math.max(0, targetScroll);
      }
    };

    const handleScriptScroll = () => {
      if (!acquireLock('script')) return;

      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;

      // 1:1 sync with comments
      if (comments) {
        comments.scrollTop = script.scrollTop;
      }

      // Scene-based sync with outline (throttled)
      if (outline) {
        if (outlineRAF) cancelAnimationFrame(outlineRAF);
        outlineRAF = requestAnimationFrame(() => {
          const topScene = findTopSceneInScript();
          if (topScene !== null && topScene !== lastTopScene) {
            lastTopScene = topScene;
            scrollOutlineToScene(topScene);
          }
        });
      }
    };

    const handleCommentsScroll = () => {
      if (!acquireLock('comments')) return;
      script.scrollTop = commentsSidebarRef.current.scrollTop;
    };

    const handleOutlineScroll = () => {
      if (!acquireLock('outline')) return;

      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      outlineRAF = requestAnimationFrame(() => {
        const topScene = findTopSceneInOutline();
        if (topScene !== null && topScene !== lastTopScene) {
          lastTopScene = topScene;
          scrollScriptToScene(topScene);
        }
      });
    };

    // Attach listeners
    script.addEventListener('scroll', handleScriptScroll, { passive: true });

    let commentsListener = null;
    let outlineListener = null;

    const attachListeners = () => {
      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;

      if (comments && !commentsListener) {
        commentsListener = handleCommentsScroll;
        comments.addEventListener('scroll', commentsListener, { passive: true });
      }
      if (outline && !outlineListener) {
        outlineListener = handleOutlineScroll;
        outline.addEventListener('scroll', outlineListener, { passive: true });
      }
    };

    attachListeners();
    const attachTimeout = setTimeout(attachListeners, 100);
    const attachTimeout2 = setTimeout(attachListeners, 500);

    const commentsEl = commentsSidebarRef.current;
    const outlineEl = outlineSidebarRef.current;

    return () => {
      script.removeEventListener('scroll', handleScriptScroll);
      if (commentsEl && commentsListener) {
        commentsEl.removeEventListener('scroll', commentsListener);
      }
      if (outlineEl && outlineListener) {
        outlineEl.removeEventListener('scroll', outlineListener);
      }
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      if (lockTimeout) clearTimeout(lockTimeout);
      clearTimeout(attachTimeout);
      clearTimeout(attachTimeout2);
    };
  }, [showComments, showOutline]);

  // Track script's scrollHeight for comments sidebar min-height
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;
    
    // Detect Safari
    const safariDetected = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let throttleTimeout = null;
    
    const updateHeight = () => {
      // Throttle on Safari
      if (safariDetected) {
        if (throttleTimeout) return;
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          setScriptScrollHeight(script.scrollHeight);
        }, 500);
      } else {
        setScriptScrollHeight(script.scrollHeight);
      }
    };
    
    updateHeight();
    
    // On Safari, use interval instead of ResizeObserver (much less CPU)
    if (safariDetected) {
      const interval = setInterval(() => {
        setScriptScrollHeight(script.scrollHeight);
      }, 2000);
      return () => {
        clearInterval(interval);
        if (throttleTimeout) clearTimeout(throttleTimeout);
      };
    }
    
    // Use ResizeObserver on Chrome/Firefox
    const observer = new ResizeObserver(updateHeight);
    observer.observe(script);
    
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ResizeObserver auto-detects size changes, no need to reconnect on elements.length
  
  useEffect(() => {
    const handleHash = () => { 
      const newDocId = window.location.hash.slice(1) || null;
      if (newDocId !== docId) {
        loadedDocRef.current = null;
        setDocId(newDocId);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [docId]);

  // If trying to access a document without being logged in, show auth modal
  // but KEEP the docId/hash so it loads after login
  const pendingDocIdRef = useRef(null);
  useEffect(() => {
    if (docId && docId !== 'local' && !token) {
      pendingDocIdRef.current = docId;
      setShowAuthModal(true);
      // Don't let loadDocument run without auth — it would fail with 403
      // and potentially set stale state. The loadDocument effect checks token too.
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

  // Stats hook (stats, outline, characters, locations, pageInfo)
  const { stats, extractedCharacters, extractedLocations, characterStats, outline, computePageInfo } = useStats(elements, characters, elementsRef);

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

  // Auto-save hook (backup, cloud save, snapshots)
  useAutoSave({
    docId, token, offlineDocId,
    elementsRef, titleRef, beatCardsRef, structureBeatsRef,
    sceneSynopsisRef, sceneStatusRef, whiteboardElementsRef, notesRef,
    setLastSaved
  });

  // Document loader hook
  useDocumentLoader({
    docId, token, loadedDocRef,
    setElements, setTitle, setCharacters, setComments, setSuggestions,
    setBeatCards, setStructureBeats, setSceneSynopsis, setSceneStatus,
    setWhiteboardElements, setIsOwner, setMyRole, setPublicAccessState,
    setLoading
  });

  // Socket connection hook
  useSocketConnection({
    docId, token,
    socketRef, offlineDocIdRef,
    setConnected, setMyId, setMyRole, setUsers,
    setElements, setTitle, setComments, setSuggestions, setCollaborators,
    setChatMessages, setUnreadMessages,
    playChatNotification
  });

  const handleLogin = (user, newToken) => {
    setCurrentUser(user);
    setToken(newToken);
    setShowAuthModal(false);
    // Always force document reload after login (new auth may grant different access)
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
  useEffect(() => {
    const pendingTemplate = localStorage.getItem('pendingTemplate');
    if (pendingTemplate && socketRef.current && elements.length <= 2) {
      const template = SCRIPT_TEMPLATES[pendingTemplate];
      if (template) {
        // Clear the pending template
        localStorage.removeItem('pendingTemplate');
        
        // Apply template elements
        const templateElements = template.elements.map(el => ({
          id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          type: el.type,
          content: el.content
        }));
        
        setElements(templateElements);
        
        // Sync to server
        templateElements.forEach((el, idx) => {
          if (idx === 0) {
            socketRef.current.emit('element-change', { index: 0, element: el });
          } else {
            socketRef.current.emit('element-insert', { afterIndex: idx - 1, afterElementId: templateElements[idx - 1]?.id, element: el });
          }
        });
        
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

  const remoteCursors = useMemo(() => users.filter(u => u.id !== myId), [users, myId]);
  const canEdit = myRole === 'editor';
  const canEditNow = (isFullyConnected || !!offlineDocId) && canEdit;
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

  // Track element positions for comments sync (Google Docs style)
  // On Safari, update much less frequently to avoid jank
  const positionsUpdateTimeoutRef = useRef(null);
  useEffect(() => {
    if (!showComments) return;
    
    // Collect element positions - only update when needed
    const updatePositions = () => {
      if (positionsUpdateTimeoutRef.current) return; // Throttle
      
      positionsUpdateTimeoutRef.current = setTimeout(() => {
        positionsUpdateTimeoutRef.current = null;
        requestAnimationFrame(() => {
          const positions = {};
          const elementDivs = document.querySelectorAll('[data-element-id]');
          elementDivs.forEach(div => {
            const elId = div.getAttribute('data-element-id');
            const index = elementsRef.current.findIndex(e => e.id === elId);
            if (index !== -1) {
              const rect = div.getBoundingClientRect();
              const containerRect = scriptContainerRef.current?.getBoundingClientRect();
              const containerScrollTop = scriptContainerRef.current?.scrollTop || 0;
              if (containerRect) {
                positions[index] = rect.top - containerRect.top + containerScrollTop;
              } else {
                positions[index] = rect.top + window.scrollY - 60;
              }
            }
          });
          setElementPositions(positions);
        });
      }, isSafari ? 500 : 100); // Much longer throttle on Safari
    };
    
    // Initial update (delayed on Safari)
    setTimeout(updatePositions, isSafari ? 300 : 0);
    
    // Update on resize (heavily throttled)
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePositions, isSafari ? 500 : 100);
    };
    window.addEventListener('resize', handleResize);
    
    // Update positions very infrequently on Safari
    const positionInterval = setInterval(updatePositions, isSafari ? 5000 : 2000);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(positionInterval);
      clearTimeout(resizeTimeout);
      if (positionsUpdateTimeoutRef.current) {
        clearTimeout(positionsUpdateTimeoutRef.current);
      }
    };
  }, [showComments, elements.length, isSafari]);

  // Pre-compute highlights per element (memoized for performance)
  const highlightsByElement = useMemo(() => {
    const map = {};

    // Process comments (supports multi-element spans)
    comments.forEach(c => {
      if (c.resolved) return;
      const commentId = String(c.id || c._id);
      if (c.spans && c.spans.length > 0) {
        // Multi-element comment: add a highlight entry for each spanned element
        c.spans.forEach(span => {
          if (!span.elementId) return;
          if (!map[span.elementId]) map[span.elementId] = [];
          map[span.elementId].push({
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            type: 'comment',
            id: commentId,
            userColor: c.userColor
          });
        });
      } else if (c.elementId && c.highlight) {
        // Single-element comment (backward compat)
        if (!map[c.elementId]) map[c.elementId] = [];
        map[c.elementId].push({
          startOffset: c.highlight.startOffset,
          endOffset: c.highlight.endOffset,
          type: 'comment',
          id: commentId,
          userColor: c.userColor
        });
      }
    });

    // Process suggestions
    suggestions.forEach(s => {
      if (s.elementId && s.status === 'pending') {
        if (!map[s.elementId]) map[s.elementId] = [];
        map[s.elementId].push({
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          type: 'suggestion',
          id: String(s.id || s._id),
          originalText: s.originalText,
          suggestedText: s.suggestedText,
          userColor: s.userColor
        });
      }
    });

    // Show pending comment highlight immediately (before comment is submitted)
    if (pendingInlineComment && pendingInlineComment.elementId) {
      if (pendingInlineComment.spans && pendingInlineComment.spans.length > 0) {
        pendingInlineComment.spans.forEach(span => {
          if (!span.elementId) return;
          if (!map[span.elementId]) map[span.elementId] = [];
          map[span.elementId].push({
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            type: 'comment',
            id: 'pending-comment',
            userColor: currentUser?.color || '#f59e0b'
          });
        });
      } else {
        if (!map[pendingInlineComment.elementId]) map[pendingInlineComment.elementId] = [];
        map[pendingInlineComment.elementId].push({
          startOffset: pendingInlineComment.startOffset,
          endOffset: pendingInlineComment.endOffset,
          type: 'comment',
          id: 'pending-comment',
          userColor: currentUser?.color || '#f59e0b'
        });
      }
    }

    // Sort each element's highlights
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.startOffset - b.startOffset);
    });

    return map;
  }, [comments, suggestions, pendingInlineComment, currentUser]);

  // Get highlight data for an element (now just a lookup)
  // eslint-disable-next-line no-unused-vars
  const getElementHighlights = useCallback((elementId) => {
    return highlightsByElement[elementId] || [];
  }, [highlightsByElement]);

  // V272: CSS Highlight API replaced by TipTap marks (applied in SingleEditor)
  // Clean up any leftover CSS highlights
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete('comment-highlight');
      CSS.highlights.delete('suggestion-highlight');
    }
  }, []);

  // Get initials from a name (e.g. "Jeremie Goldstein" -> "JG", "RomainV" -> "RV")
  // Render text content with highlighted comments (legacy fallback)
  // eslint-disable-next-line no-unused-vars
  const renderTextWithHighlights = (content, elementId) => {
    if (!content) return '';
    
    // Find all highlights for this element (comments)
    const elementHighlights = comments
      .filter(c => c.elementId === elementId && c.highlight && !c.resolved)
      .map(c => ({
        ...c.highlight,
        type: 'comment',
        commentId: c.id,
        userColor: c.userColor
      }));
    
    // Find all suggestions for this element
    const elementSuggestions = suggestions
      .filter(s => s.elementId === elementId && s.status === 'pending')
      .map(s => ({
        startOffset: s.startOffset,
        endOffset: s.endOffset,
        type: 'suggestion',
        suggestionId: s.id,
        originalText: s.originalText,
        suggestedText: s.suggestedText,
        userColor: s.userColor
      }));
    
    // Combine and sort by startOffset
    const allHighlights = [...elementHighlights, ...elementSuggestions]
      .sort((a, b) => a.startOffset - b.startOffset);
    
    if (allHighlights.length === 0) {
      return content;
    }
    
    // Build segments with highlights
    const segments = [];
    let lastIndex = 0;
    
    allHighlights.forEach((highlight) => {
      // Add text before this highlight
      if (highlight.startOffset > lastIndex) {
        segments.push({
          type: 'text',
          content: content.slice(lastIndex, highlight.startOffset)
        });
      }
      
      if (highlight.type === 'comment') {
        // Comment highlight
        segments.push({
          type: 'highlight',
          content: content.slice(highlight.startOffset, highlight.endOffset),
          commentId: highlight.commentId,
          userColor: highlight.userColor
        });
      } else if (highlight.type === 'suggestion') {
        // Suggestion: show original (strikethrough) + suggested (green)
        // Use stored originalText instead of slicing content (which may have changed)
        segments.push({
          type: 'suggestion',
          originalContent: highlight.originalText || content.slice(highlight.startOffset, highlight.endOffset),
          suggestedContent: highlight.suggestedText,
          suggestionId: highlight.suggestionId,
          userColor: highlight.userColor
        });
      }
      
      lastIndex = highlight.endOffset;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }
    
    return segments.map((seg, idx) => {
      if (seg.type === 'highlight') {
        return (
          <span
            key={idx}
            data-comment-id={seg.commentId}
            style={{
              background: 'rgba(251, 191, 36, 0.4)',
              borderBottom: `2px solid ${seg.userColor || '#f59e0b'}`,
              cursor: 'text',
              borderRadius: 2,
              padding: '0 1px'
            }}
            title="Cliquer pour voir le commentaire"
          >
            {seg.content}
          </span>
        );
      }
      if (seg.type === 'suggestion') {
        return (
          <span key={idx} data-suggestion-id={seg.suggestionId} style={{ cursor: 'pointer' }}>
            <span
              style={{
                textDecoration: 'line-through',
                color: '#dc2626'
              }}
            >
              {seg.originalContent}
            </span>
            <span
              style={{
                color: '#16a34a'
              }}
            >
              {seg.suggestedContent}
            </span>
          </span>
        );
      }
      return <span key={idx}>{seg.content}</span>;
    });
  };

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
      socketRef.current.emit('full-sync', { elements: newElements });
    }
  }, [elements, connected, canEdit, pushToUndo]);

  const updateElement = useCallback((i, el, skipUndo = false) => {
    if (!canEditNow) return;
    if (!skipUndo) pushToUndo();
    setElements(p => { const u = [...p]; u[i] = el; return u; });
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-change', { index: i, element: el });
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
  }, [connected, canEdit, canEditNow, pushToUndo, currentUser, offlineDocIdRef]);

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
    setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; });
    setActiveIndex(after + 1);
    const afterElementId = elementsRef.current[after]?.id;
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-insert', { afterIndex: after, afterElementId, element: el });
    setLastSaved(new Date());
  }, [connected, canEdit, canEditNow, pushToUndo, offlineDocIdRef]);
  // eslint-disable-next-line no-unused-vars
  const deleteElement = useCallback(i => {
    if (!canEditNow) return;
    if (elementsRef.current.length === 1) return;
    pushToUndo();
    const elementId = elementsRef.current[i]?.id;
    setElements(p => p.filter((_, idx) => idx !== i));
    setActiveIndex(Math.max(0, i - 1));
    if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-delete', { index: i, elementId });
    setLastSaved(new Date());
  }, [connected, canEdit, canEditNow, pushToUndo, offlineDocIdRef]);
  const changeType = useCallback((i, t) => { if (!canEditNow) return; const elementId = elementsRef.current[i]?.id; setElements(p => { const u = [...p]; u[i] = { ...u[i], type: t }; return u; }); if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) socketRef.current.emit('element-type-change', { index: i, type: t, elementId }); }, [connected, canEdit, canEditNow, offlineDocIdRef]);
  // V272: handleCursor supprimé (curseurs distants à réimplémenter via décorations ProseMirror)

  // V272: Single editor → elements change callback (replaces individual CRUD for typing)
  const fullSyncTimeoutRef = useRef(null);
  const handleElementsChange = useCallback((newElements) => {
    if (!newElements || newElements.length === 0) return;
    setElements(newElements);
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
    // Debounced full-sync to server
    if (fullSyncTimeoutRef.current) clearTimeout(fullSyncTimeoutRef.current);
    fullSyncTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && connected && canEdit && !offlineDocIdRef.current) {
        socketRef.current.emit('full-sync', { elements: elementsRef.current });
      }
    }, 500);
  }, [connected, canEdit, currentUser, offlineDocIdRef]);

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
          socketRef.current.emit('element-change', { index: i, element: el });
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
      socketRef.current.emit('full-sync', { elements: newElements });
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

  // ============ DRAG-SELECT across blocks ============
  useEffect(() => {
    const getElementIndexFromPoint = (x, y) => {
      // Walk up from elementFromPoint to find [data-element-id]
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        const wrapper = el.closest('[data-element-id]');
        if (wrapper) {
          const elId = wrapper.getAttribute('data-element-id');
          return elementsRef.current.findIndex(e => e.id === elId);
        }
      }
      return null;
    };

    const handleMouseMove = (e) => {
      if (dragStartIndexRef.current === null) return;
      // Only start drag-select if mouse has moved enough (prevent accidental drags on normal clicks)
      if (!isDragSelecting) {
        // We need at least to move to a different block to start selection
        const hoverIdx = getElementIndexFromPoint(e.clientX, e.clientY);
        if (hoverIdx === null || hoverIdx === dragStartIndexRef.current) return;
        // Start drag selection
        setIsDragSelecting(true);
      }
      const hoverIdx = getElementIndexFromPoint(e.clientX, e.clientY);
      if (hoverIdx !== null && hoverIdx !== dragStartIndexRef.current) {
        const start = Math.min(dragStartIndexRef.current, hoverIdx);
        const end = Math.max(dragStartIndexRef.current, hoverIdx);
        setSelectedRange({ start, end });
        // Prevent text selection in individual editors while dragging
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      if (isDragSelecting) {
        setIsDragSelecting(false);
      }
      dragStartIndexRef.current = null;
    };

    // Clear copiedBlocksRef when user does a normal copy (not multi-block)
    const handleNativeCopy = () => {
      if (!selectedRange) {
        copiedBlocksRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('copy', handleNativeCopy);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('copy', handleNativeCopy);
    };
  }, [isDragSelecting, selectedRange]);

  // ============ IMPORT FDX - Creates new document ============
  const importFDX = () => {
    console.log('[IMPORT] importFDX called, token:', !!token);
    if (!token) { setShowAuthModal(true); return; }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fdx,.xml';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = async (e) => {
      console.log('[IMPORT] File selected');
      const file = e.target.files?.[0];
      
      // Clean up input element
      document.body.removeChild(input);
      
      if (!file) {
        console.log('[IMPORT] No file selected');
        return;
      }
      
      setImporting(true);
      console.log('[IMPORT] Starting import of:', file.name);
    
      try {
        const text = await file.text();
        console.log('[IMPORT] File size:', text.length, 'chars');
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        
        // Check for parse errors
        const parseError = xml.querySelector('parsererror');
        if (parseError) {
          throw new Error('Fichier FDX invalide');
        }
        
        const paragraphs = xml.querySelectorAll('Paragraph');
        console.log('[IMPORT] Found', paragraphs.length, 'paragraphs');
        
        const newElements = [];
        paragraphs.forEach((p, i) => {
          const fdxType = p.getAttribute('Type');
          const type = FDX_TO_TYPE[fdxType] || 'action';
          
          // Get ALL Text nodes and concatenate them
          const textNodes = p.querySelectorAll('Text');
          let content = '';
          textNodes.forEach(t => { content += t.textContent || ''; });
          
          if (content.trim() || newElements.length === 0) {
            const id = generateId();
            newElements.push({ id, type, content: content.trim() });
          }
        });
        
        if (newElements.length === 0) {
          newElements.push({ id: generateId(), type: 'scene', content: '' });
        }
        
        // Get title from filename
        const fileName = file.name.replace(/\.fdx$/i, '').toUpperCase();
        
        console.log('[IMPORT] Creating document with', newElements.length, 'elements, title:', fileName);
        
        // Create document via API
        const res = await fetch(SERVER_URL + '/api/documents/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ title: fileName, elements: newElements })
        });
        
        console.log('[IMPORT] Server response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[IMPORT] Document created:', data.id, 'with', data.elementsCount, 'elements');
          loadedDocRef.current = null;
          window.location.hash = data.id;
        } else if (res.status === 413) {
          alert('Erreur import: Fichier trop volumineux. Contactez l\'admin pour augmenter la limite serveur.');
        } else {
          try {
            const err = await res.json();
            console.error('[IMPORT] Server error:', err);
            alert('Erreur import: ' + (err.error || 'Erreur serveur'));
          } catch {
            alert('Erreur import: Erreur serveur ' + res.status);
          }
        }
      } catch (err) { 
        console.error('[IMPORT] Error:', err);
        alert('Erreur import: ' + err.message);
      }
      setImporting(false);
    };
    
    // Click must happen synchronously with user action
    input.click();
  };

  // ============ BULK SAVE (for existing doc) ============
  // eslint-disable-next-line no-unused-vars
  const bulkSave = async () => {
    if (!token || !docId) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title, elements })
      });
      if (res.ok) {
        const data = await res.json();
        alert('Sauvegardé ! ' + data.elementsCount + ' éléments');
      }
    } catch (err) { console.error(err); }
  };

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
      socketRef.current.emit('full-sync', { elements: newElements });
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

  // ---- Page backgrounds: create separate white rectangles behind content ----
  // This replaces the single wrapper background with per-page backgrounds,
  // giving each page its own floating rectangle + shadow (like Final Draft / V271).
  useEffect(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) return;
    const bgColor = darkMode ? '#3a3a3a' : 'white';
    const shadow = darkMode ? '0 2px 16px rgba(0,0,0,0.5)' : '0 2px 16px rgba(0,0,0,0.15)';

    // Get element's internal top offset relative to a specific ancestor,
    // walking the offsetParent chain. This is zoom-agnostic.
    function internalTop(el, ancestor) {
      let top = 0;
      let cur = el;
      while (cur && cur !== ancestor) {
        top += cur.offsetTop;
        cur = cur.offsetParent;
      }
      return top;
    }

    function updatePageBgs() {
      if (!pageWrapperRef.current) return;
      const w = pageWrapperRef.current;
      const gaps = w.querySelectorAll('.page-break-gap');
      // scrollHeight is in the element's internal coordinate system (unaffected by CSS zoom)
      const wHeight = w.scrollHeight;
      const rects = [];
      let prevBottom = 0;
      gaps.forEach(g => {
        // offsetTop chain gives internal (pre-zoom) coordinates — no division needed
        const gTop = internalTop(g, w);
        const gBottom = gTop + g.offsetHeight;
        if (gTop > prevBottom) rects.push({ top: prevBottom, h: gTop - prevBottom });
        prevBottom = gBottom;
      });
      if (wHeight > prevBottom) rects.push({ top: prevBottom, h: wHeight - prevBottom });

      let c = w.querySelector('.page-bg-container');
      if (!c) {
        c = document.createElement('div');
        c.className = 'page-bg-container';
        c.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:-1;';
        w.insertBefore(c, w.firstChild);
      }
      while (c.children.length > rects.length) c.removeChild(c.lastChild);
      rects.forEach((r, i) => {
        let d = c.children[i];
        if (!d) { d = document.createElement('div'); c.appendChild(d); }
        d.style.cssText = `position:absolute;top:${r.top}px;left:0;right:0;height:${r.h}px;background:${bgColor};box-shadow:${shadow};border-radius:2px;pointer-events:none;`;
      });
    }

    // Double rAF to ensure ProseMirror decorations have rendered
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        updatePageBgs();
      });
    });

    // Also watch for DOM mutations (content edits that change page breaks)
    const observer = new MutationObserver(() => {
      clearTimeout(pageBgTimerRef.current);
      pageBgTimerRef.current = setTimeout(updatePageBgs, 80);
    });
    observer.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

    // Watch for resize
    const resizeObs = new ResizeObserver(() => {
      clearTimeout(pageBgTimerRef.current);
      pageBgTimerRef.current = setTimeout(updatePageBgs, 80);
    });
    resizeObs.observe(wrapper);

    return () => {
      cancelled = true;
      observer.disconnect();
      resizeObs.disconnect();
      clearTimeout(pageBgTimerRef.current);
      // Clean up bg container
      const bg = wrapper.querySelector('.page-bg-container');
      if (bg) bg.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode]);

  // Desktop: wait until port/user are ready before showing UI
  if (IS_DESKTOP && !desktopReady) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', color: 'white', fontSize: 18 }}>Chargement...</div>;
  }

  // Show landing page if not logged in (no token)
  if (!token && (!docId || docId === '' || docId === 'local')) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#1a1a1a',
        color: 'white',
        position: 'relative'
      }}>
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #484848',
            borderRadius: 6,
            color: '#9ca3af',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          {language === 'fr' ? '🇫🇷 FR' : '🇺🇸 EN'}
        </button>
        
        <div style={{ 
          textAlign: 'center',
          maxWidth: 400,
          padding: 40
        }}>
          {/* Logo centered */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <Logo darkMode={true} />
          </div>
          
          <p style={{ 
            fontSize: 14, 
            color: '#6b7280', 
            marginBottom: 48,
            lineHeight: 1.6
          }}>
            {t('tagline')}
          </p>
          
          {/* Connexion button */}
          <button 
            onClick={() => setShowAuthModal(true)}
            style={{ 
              width: '100%',
              padding: '16px 24px', 
              background: '#3b82f6', 
              border: 'none', 
              borderRadius: 10, 
              color: 'white', 
              fontSize: 16, 
              fontWeight: 600, 
              cursor: 'pointer',
              marginBottom: 12,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
            onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
          >
            {t('login')}
          </button>
          
          {/* Continue without account */}
          <button 
            onClick={() => {
              // Set a flag to show editor without account
              setTitle(t('untitled'));
              window.location.hash = 'local';
            }}
            style={{ 
              width: '100%',
              padding: '14px 24px', 
              background: 'transparent', 
              border: '1px solid #484848', 
              borderRadius: 10, 
              color: '#9ca3af', 
              fontSize: 14, 
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#484848'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            {t('continueWithoutAccount')}
          </button>
          
          <p style={{ 
            marginTop: 32, 
            fontSize: 12, 
            color: '#6b7280' 
          }}>
            {t('noAccountWarning')}
          </p>
        </div>
        
        {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
      </div>
    );
  }

  return (
    <div className={focusMode ? 'focus-mode-active' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#2b2b2b' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#2b2b2b', transition: 'background 0.3s, color 0.3s', overflow: 'hidden' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
      
      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTemplateModal(false)}>
          <div 
            style={{ 
              background: darkMode ? '#333333' : 'white', 
              borderRadius: 16, 
              width: '90%',
              maxWidth: 800,
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Nouveau scénario</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Choisissez une structure ou commencez de zéro</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => createNewDocument(key)}
                    style={{
                      padding: 20,
                      background: darkMode ? '#484848' : '#f9fafb',
                      border: `2px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{template.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: darkMode ? 'white' : 'black', marginBottom: 6 }}>{template.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{template.description}</div>
                    {key !== 'empty' && (
                      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                        {template.elements.filter(e => e.type === 'scene' && stripHtml(e.content).startsWith('===')).length} sections
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 24, padding: 16, background: darkMode ? '#333333' : '#f3f4f6', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: darkMode ? 'white' : 'black' }}>💡 Conseil</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  Les structures sont des guides, pas des règles absolues. Adaptez-les à votre histoire ! 
                  Les scènes marquées === sont des repères de structure que vous pouvez supprimer une fois votre plan établi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={() => { setShowDocsList(false); setShowTemplateModal(true); }} onClose={() => setShowDocsList(false)} t={t} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} t={t} />}
      
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
        onImportFDX={importFDX} onCreateSnapshot={createSnapshot}
        onExportFDX={exportFDX} onExportPDF={exportPDF}
        onExportFountain={exportFountain} onExportTXT={exportTXT} onExportMarkdown={exportMarkdown}
        onLogin={() => setShowAuthModal(true)} onLogout={handleLogout}
        onCopyLink={copyLink}
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

      {/* SHARE LINK MODAL */}
      {showShareModal && (
        <>
          <div onClick={() => setShowShareModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999 }} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: darkMode ? '#2b2b2b' : 'white',
            borderRadius: 12,
            padding: 24,
            width: 440,
            maxWidth: '90vw',
            zIndex: 10000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? 'white' : '#1a1a1a' }}>{t('invite')}</span>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 18 }}>&times;</button>
            </div>
            {/* Public access toggle */}
            {isOwner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div
                  onClick={() => togglePublicAccess(!publicAccessState.enabled)}
                  style={{
                    width: 38, height: 20, borderRadius: 10, cursor: 'pointer',
                    background: publicAccessState.enabled ? '#22c55e' : (darkMode ? '#4b5563' : '#d1d5db'),
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2, left: publicAccessState.enabled ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: darkMode ? '#d1d5db' : '#374151' }}>
                  {language === 'fr' ? 'Lien actif' : 'Link active'}
                </span>
                {publicAccessState.enabled && (
                  <select
                    value={publicAccessState.role}
                    onChange={(e) => changePublicRole(e.target.value)}
                    style={{
                      marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="viewer">{language === 'fr' ? 'Lecture seule' : 'View only'}</option>
                    <option value="commenter">{language === 'fr' ? 'Commentaire' : 'Comment'}</option>
                    <option value="editor">{language === 'fr' ? 'Éditeur' : 'Editor'}</option>
                  </select>
                )}
              </div>
            )}

            {publicAccessState.enabled ? (
              <>
                <p style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 12 }}>
                  {language === 'fr' ? 'Toute personne ayant ce lien peut accéder au document :' : 'Anyone with this link can access the document:'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    onClick={e => e.target.select()}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a',
                      fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      const btn = document.getElementById('share-copy-btn');
                      if (btn) { btn.textContent = language === 'fr' ? 'Copié !' : 'Copied!'; setTimeout(() => { btn.textContent = language === 'fr' ? 'Copier' : 'Copy'; }, 2000); }
                    }}
                    id="share-copy-btn"
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {language === 'fr' ? 'Copier' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: darkMode ? '#6b7280' : '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                {language === 'fr' ? 'Activez le lien pour partager ce document.' : 'Enable the link to share this document.'}
              </p>
            )}
          </div>
        </>
      )}

      {/* MAIN CONTENT AREA - Flex layout with sidebars */}
      <div style={{ 
        flex: 1,
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
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm 25mm 25mm 38mm',
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 0, /* creates stacking context so z-index:-1 backgrounds work */
            zoom: scriptZoom,
            fontFamily: getFontFamily(scriptFont),
            fontSize: '12pt',
            lineHeight: '1',
          }}>
            <SingleEditor
              elements={elements}
              onElementsChange={handleElementsChange}
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
              remoteCursors={remoteCursors}
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

      {/* FOOTER — Zoom slider, full-width bar matching header */}
      {activeView === 'script' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 8, padding: '4px 16px',
          background: darkMode ? '#333333' : 'white',
          borderTop: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
          fontSize: 12, color: darkMode ? '#aaa' : '#666',
          flexShrink: 0, height: 28,
        }}>
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
      )}

      {/* Beat Board - Always mounted, hidden when not active */}
      <div style={{ flex: 1, display: activeView === 'beatboard' ? 'flex' : 'none', flexDirection: 'column' }}>
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
      
      {/* CSS Highlight API styles for comments and suggestions */}
      <style>{`
        ::highlight(comment-highlight) {
          background-color: rgba(251, 191, 36, 0.4);
          border-radius: 2px;
        }
        ::highlight(suggestion-highlight) {
          background-color: rgba(34, 197, 94, 0.3);
          text-decoration: underline wavy #16a34a;
        }
        
        /* Reduce paint complexity on Safari */
        @supports (-webkit-touch-callout: none) {
          .comments-sidebar-card {
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
            contain: layout style paint;
          }
          
          /* Force GPU compositing for smooth scrolling */
          .comments-sidebar-scroll-container {
            -webkit-overflow-scrolling: touch;
            transform: translateZ(0);
          }
          
          /* Reduce repaints during scroll */
          .script-container {
            -webkit-overflow-scrolling: touch;
            transform: translateZ(0);
          }
          
          /* Disable animations on Safari for better perf */
          * {
            scroll-behavior: auto !important;
          }
        }
        
        /* Custom Tooltips */
        .header-btn {
          position: relative;
        }
        .header-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .header-btn::before {
          content: '';
          position: absolute;
          top: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-bottom-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .header-btn:hover::after,
        .header-btn:hover::before {
          opacity: 1;
        }
        .header-btn:hover::after {
          transform: translateX(-50%) translateY(0);
        }
        
        /* Outline tooltips - appear above */
        .outline-btn {
          position: relative;
        }
        .outline-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 8px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 10px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .outline-btn::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 1px);
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .outline-btn:hover::after,
        .outline-btn:hover::before {
          opacity: 1;
        }
        
        /* Floating action buttons tooltips (Google Docs style - appears on LEFT) */
        .floating-action-btn {
          position: relative;
        }
        .floating-action-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          right: calc(100% + 8px);
          top: 50%;
          transform: translateY(-50%);
          padding: 6px 10px;
          background: #202124;
          color: white;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1001;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .floating-action-btn::before {
          content: '';
          position: absolute;
          right: calc(100% + 2px);
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-left-color: #202124;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1001;
        }
        .floating-action-btn:hover::after,
        .floating-action-btn:hover::before {
          opacity: 1;
        }
      `}</style>
      
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
