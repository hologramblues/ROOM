import { useEffect } from 'react';
import { ENABLE_BEATBOARD } from '../constants/config';

export default function useKeyboardShortcuts({
  showSearch, setShowSearch, showOutline, setShowOutline,
  showNoteFor, setShowNoteFor, showCharactersPanel, setShowCharactersPanel,
  showShortcuts, setShowShortcuts, showRenameChar, setShowRenameChar,
  showGoToScene, setShowGoToScene, activeView, setActiveView,
  focusMode, setFocusMode, docId, elements, activeIndex,
  createSnapshot, undo, redo, duplicateScene
}) {
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInEditor = activeEl && (
        activeEl.isContentEditable ||
        activeEl.closest('[contenteditable="true"]') ||
        activeEl.closest('.ProseMirror')
      );
      const isInTextInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA'
      );

      // When inside any text input, let ALL keys pass through natively
      if (isInTextInput) {
        if (!((e.metaKey || e.ctrlKey) && e.key === 's')) return;
      }

      // When inside an editor, let standard text editing shortcuts pass through to TipTap
      if (isInEditor && (e.metaKey || e.ctrlKey)) {
        const k = e.key.toLowerCase();
        if (k === 'b' || k === 'i' || k === 'u' || k === 'z') return;
      }

      // Cmd+S = Snapshot
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        createSnapshot();
      }
      // Cmd+F = Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Cmd+O = Outline
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowOutline(prev => !prev);
      }
      // Cmd+N = Add note to current element
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && docId) {
        e.preventDefault();
        setShowNoteFor(elements[activeIndex]?.id);
      }
      // Cmd+? or Cmd+/ = Show shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      // Cmd+. = Focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Cmd+Z = Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z = Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd+G = Go to scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setShowGoToScene(true);
      }
      // Cmd+D = Duplicate current scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        let sceneIdx = activeIndex;
        while (sceneIdx >= 0 && elements[sceneIdx]?.type !== 'scene') {
          sceneIdx--;
        }
        if (sceneIdx >= 0) {
          duplicateScene(sceneIdx);
        }
      }
      // Cmd+B = Toggle Beat Board view (when enabled)
      if (ENABLE_BEATBOARD && (e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setActiveView(v => v === 'script' ? 'beatboard' : 'script');
      }
      // B alone = Open Beat Board (only if not in input/textarea, when enabled)
      if (ENABLE_BEATBOARD && e.key === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl2 = document.activeElement;
        const isInInput = activeEl2 && (
          activeEl2.tagName === 'INPUT' ||
          activeEl2.tagName === 'TEXTAREA' ||
          activeEl2.isContentEditable ||
          activeEl2.closest('[contenteditable="true"]')
        );
        if (!isInInput && activeView === 'script') {
          e.preventDefault();
          setActiveView('beatboard');
        }
      }
      // Escape = Close panels (one at a time) - Beat Board first
      if (e.key === 'Escape') {
        if (activeView === 'beatboard') { setActiveView('script'); return; }
        if (showGoToScene) { setShowGoToScene(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showRenameChar) { setShowRenameChar(false); return; }
        if (showNoteFor) { setShowNoteFor(null); return; }
        if (showSearch) { setShowSearch(false); return; }
        if (showCharactersPanel) { setShowCharactersPanel(false); return; }
        if (showOutline) setShowOutline(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [showSearch, setShowSearch, showOutline, setShowOutline, showNoteFor, setShowNoteFor,
      showCharactersPanel, setShowCharactersPanel, showShortcuts, setShowShortcuts,
      showRenameChar, setShowRenameChar, showGoToScene, setShowGoToScene,
      activeView, setActiveView, focusMode, setFocusMode, docId, elements, activeIndex,
      createSnapshot, undo, redo, duplicateScene]);
}
