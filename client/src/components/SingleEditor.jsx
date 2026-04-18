import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import CommentMark from '../extensions/CommentMark';
import SuggestionMark from '../extensions/SuggestionMark';
import ExternalSpanMark from '../extensions/ExternalSpanMark';
import ScreenplayElement from '../extensions/ScreenplayElement';
import { createPageBreakPlugin } from '../extensions/pageBreakPlugin';
import { createSceneLockPlugin } from '../extensions/sceneLockPlugin';
import { extractElementsFromDoc, buildDocFromElements, stripHtml } from '../utils/helpers';
import { getFontFamily } from '../constants/fonts';

// ============ SCREENPLAY EDITOR (Yjs Collaborative V3) ============
const SingleEditor = React.memo(({
  ydoc,
  provider,
  yjsSynced,
  currentUser,
  elements,
  canEdit,
  scriptFont,
  darkMode,
  characters,
  locations,
  onSelectCharacter,
  onSelectLocation,
  onTextSelect,
  onHighlightClick,
  onSuggestionClick,
  onEditorFocus,
  onActiveElementChange,
  onElementsExtracted,
  computePageInfoFn,
  highlightsByElement,
  lockedScenes,
  t = (k) => k,
}) => {
  const isApplyingMarksRef = useRef(false);
  const extractTimeoutRef = useRef(null);
  const marksTimeoutRef = useRef(null);
  const darkModeRef = useRef(darkMode);
  darkModeRef.current = darkMode;
  const lockedScenesRef = useRef(lockedScenes);
  lockedScenesRef.current = lockedScenes;
  const [autoState, setAutoState] = useState({ show: false, items: [], idx: -1, type: null, nodePos: null, userNavigated: false });

  // Page break plugin
  const PageBreakExtension = useMemo(() => {
    const plugin = createPageBreakPlugin(computePageInfoFn, stripHtml, darkModeRef);
    return Extension.create({
      name: 'pageBreakHelper',
      addProseMirrorPlugins() { return [plugin]; },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene lock plugin
  const SceneLockExtension = useMemo(() => {
    const plugin = createSceneLockPlugin(lockedScenesRef);
    return Extension.create({
      name: 'sceneLockHelper',
      addProseMirrorPlugins() { return [plugin]; },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        listItem: false,
        history: !ydoc, // Use built-in history only when Yjs is not available
        hardBreak: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      ScreenplayElement,
      CommentMark,
      SuggestionMark,
      ExternalSpanMark,
      PageBreakExtension,
      SceneLockExtension,
      // Yjs collaboration — syncs editor content via CRDT
      ...(ydoc ? [
        Collaboration.configure({ document: ydoc }),
      ] : []),
      // Remote cursors — only enabled once provider is fully synced to avoid cursor-plugin crash
      ...(provider && yjsSynced ? [
        CollaborationCursor.configure({
          provider: provider,
          user: {
            name: currentUser?.name || 'User',
            color: currentUser?.color || '#3b82f6',
          },
        }),
      ] : []),
    ],
    // When Yjs is not available, load content from elements prop
    ...(ydoc ? {} : { content: buildDocFromElements(elements) }),
    editable: canEdit,

    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
      handleClick: (view, pos, event) => {
        if (!view) return false;
        try {
          const target = event.target;
          const commentEl = target.closest('[data-comment-id]');
          if (commentEl && onHighlightClick) {
            const commentId = commentEl.getAttribute('data-comment-id');
            setTimeout(() => onHighlightClick(commentId), 0);
            return false;
          }
          const suggestionEl = target.closest('[data-suggestion-id]');
          if (suggestionEl && onSuggestionClick) {
            const suggestionId = suggestionEl.getAttribute('data-suggestion-id');
            setTimeout(() => onSuggestionClick(suggestionId), 0);
            return false;
          }
        } catch (_) {}
        return false;
      },
    },

    // onUpdate: extract elements for stats/outline/export (debounced, read-only)
    onUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      if (isApplyingMarksRef.current) return;
      if (extractTimeoutRef.current) clearTimeout(extractTimeoutRef.current);
      extractTimeoutRef.current = setTimeout(() => {
        if (!editor || editor.isDestroyed) return;
        const newElements = extractElementsFromDoc(editor.state.doc);
        if (onElementsExtracted) onElementsExtracted(newElements);
      }, 150);
    },

    onSelectionUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      try {
        const { $from, from, to } = editor.state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return;

        const elemIdx = $from.index(0);
        if (onActiveElementChange) onActiveElementChange(elemIdx);

        // Text selection → comment/suggestion creation
        if (from !== to && onTextSelect) {
          const selectedText = editor.state.doc.textBetween(from, to);
          if (selectedText.trim()) {
            const nodeStart = $from.before();
            const coords = editor.view.coordsAtPos(from);
            onTextSelect({
              elementId: node.attrs.elementId,
              elementIndex: elemIdx,
              text: selectedText,
              startOffset: from - nodeStart - 1,
              endOffset: to - nodeStart - 1,
              rect: { top: coords.top, left: coords.left, bottom: coords.bottom, right: coords.right },
            });
          }
        }

        // Autocomplete for character names and locations
        const currentType = node.attrs.elementType;
        const text = node.textContent;

        if (currentType === 'character') {
          let cyclingSuggestion = null;
          if (text.length === 0) {
            const doc = editor.state.doc;
            const currentIndex = elemIdx;
            const recentChars = [];
            for (let i = currentIndex - 1; i >= 0; i--) {
              const el = doc.child(i);
              const elType = el.attrs.elementType;
              if (elType === 'scene') break;
              if (elType === 'character' && el.textContent.trim()) {
                const name = el.textContent.trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
                if (recentChars.length === 0 || recentChars[recentChars.length - 1] !== name) {
                  recentChars.push(name);
                }
                if (recentChars.length >= 2) break;
              }
            }
            if (recentChars.length >= 2) {
              cyclingSuggestion = recentChars[1];
            }
          }

          if (text.length > 0) {
            const q = text.toUpperCase();
            const f = (characters || []).filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
            if (f.length > 0) {
              const coords = editor.view.coordsAtPos(from);
              setAutoState({ show: true, items: f, idx: -1, type: 'character', coords, userNavigated: false });
            } else {
              setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
            }
          } else if (cyclingSuggestion) {
            const coords = editor.view.coordsAtPos(from);
            const fullName = (characters || []).find(c => c.toUpperCase() === cyclingSuggestion) || cyclingSuggestion;
            setAutoState({ show: true, items: [fullName], idx: -1, type: 'character', coords, userNavigated: false });
          } else {
            setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
          }
        } else if (currentType === 'scene' && text.length > 4) {
          const match = text.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*(.*)$/i);
          if (match && match[2] && match[2].length > 0) {
            const q = match[2].toUpperCase();
            const f = (locations || []).filter(l => l.startsWith(q) && l !== q);
            if (f.length > 0) {
              const coords = editor.view.coordsAtPos(from);
              setAutoState({ show: true, items: f, idx: -1, type: 'location', coords, userNavigated: false });
            } else {
              setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
            }
          } else {
            setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
          }
        } else {
          setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
        }
      } catch (_) {}
    },

    onFocus: () => {
      if (onEditorFocus) onEditorFocus();
    },

    onBlur: () => {
      setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
    },
  }, [ydoc, yjsSynced]); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-create editor when ydoc changes OR when Yjs becomes synced (to attach CollaborationCursor)
  // Re-create editor only when ydoc changes (new document)

  // Update editable state
  useEffect(() => {
    if (editor) {
      const shouldBeEditable = !!canEdit;
      if (editor.isEditable !== shouldBeEditable) {
        editor.setEditable(shouldBeEditable);
      }
    }
  }, [editor, canEdit]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (extractTimeoutRef.current) clearTimeout(extractTimeoutRef.current);
      if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);
    };
  }, []);

  // Apply comment/suggestion marks
  useEffect(() => {
    if (!editor || !highlightsByElement) return;
    if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);
    marksTimeoutRef.current = setTimeout(() => {
      if (!editor || !editor.view || editor.isDestroyed) return;
      try {
        isApplyingMarksRef.current = true;
        const { tr } = editor.state;
        const schema = editor.state.schema;
        const commentMarkType = schema.marks.comment;
        const suggestionMarkType = schema.marks.suggestion;
        if (!commentMarkType && !suggestionMarkType) {
          isApplyingMarksRef.current = false;
          return;
        }

        // Remove all existing comment/suggestion marks
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const nodeStart = pos + 1;
          const nodeEnd = pos + node.nodeSize - 1;
          if (commentMarkType) tr.removeMark(nodeStart, nodeEnd, commentMarkType);
          if (suggestionMarkType) tr.removeMark(nodeStart, nodeEnd, suggestionMarkType);
        });

        // Apply marks
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const elementId = node.attrs.elementId;
          const highlights = highlightsByElement[elementId];
          if (!highlights || highlights.length === 0) return;
          const nodeStart = pos + 1;
          const textLength = node.textContent.length;

          highlights.forEach(h => {
            const start = Math.max(0, Math.min(h.startOffset, textLength));
            const end = Math.max(start, Math.min(h.endOffset, textLength));
            if (start >= end) return;
            const from = nodeStart + start;
            const to = nodeStart + end;
            if (h.type === 'comment' && commentMarkType) {
              tr.addMark(from, to, commentMarkType.create({ commentId: h.id }));
            } else if (h.type === 'suggestion' && suggestionMarkType) {
              tr.addMark(from, to, suggestionMarkType.create({
                suggestionId: h.id,
                suggestedText: h.suggestedText || ''
              }));
            }
          });
        });

        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      } catch (err) {
        console.warn('[Marks] Error applying highlight marks:', err.message);
      } finally {
        requestAnimationFrame(() => { isApplyingMarksRef.current = false; });
      }
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, highlightsByElement]);

  // Handle autocomplete selection
  const handleAutoSelect = useCallback((item) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name !== 'screenplayElement') return;
    const nodeStart = $from.before();

    if (autoState.type === 'character') {
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(item, nodeStart + 1);
      const endPos = nodeStart + 1 + item.length;
      tr.setSelection(editor.state.selection.constructor.near(tr.doc.resolve(endPos)));
      editor.view.dispatch(tr);
      requestAnimationFrame(() => {
        if (editor && !editor.isDestroyed) {
          editor.commands.splitScreenplayElement();
        }
      });
    } else if (autoState.type === 'location') {
      const text = node.textContent;
      const match = text.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i);
      const prefix = match ? match[1] + ' ' : '';
      const replacement = prefix + item + ' - ';
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(replacement, nodeStart + 1);
      editor.view.dispatch(tr);
    }
    setAutoState(prev => ({ ...prev, show: false }));
  }, [editor, autoState.type]);

  // Autocomplete keyboard navigation
  useEffect(() => {
    if (!editor || !autoState.show) return;
    const handleKeyDown = (event) => {
      if (!autoState.show || autoState.items.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setAutoState(prev => ({ ...prev, idx: prev.idx < prev.items.length - 1 ? prev.idx + 1 : 0, userNavigated: true }));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setAutoState(prev => ({ ...prev, idx: prev.idx > 0 ? prev.idx - 1 : prev.items.length - 1, userNavigated: true }));
      } else if (event.key === 'Tab' && autoState.userNavigated && autoState.idx >= 0) {
        event.preventDefault();
        event.stopPropagation();
        handleAutoSelect(autoState.items[autoState.idx]);
      } else if (event.key === 'Enter') {
        if (autoState.userNavigated && autoState.idx >= 0) {
          event.preventDefault();
          event.stopPropagation();
          handleAutoSelect(autoState.items[autoState.idx]);
        } else {
          setAutoState(prev => ({ ...prev, show: false }));
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setAutoState(prev => ({ ...prev, show: false }));
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [editor, autoState, handleAutoSelect]);

  return (
    <div style={{ position: 'relative' }}>
      <EditorContent editor={editor} />

      {/* Character autocomplete dropdown */}
      {autoState.show && autoState.type === 'character' && autoState.coords && (
        <div style={{
          position: 'fixed',
          top: (autoState.coords.bottom || 0) + 28,
          left: (autoState.coords.left || 0) - 40,
          background: darkMode ? '#1e1e1e' : '#ffffff',
          border: `1px solid ${darkMode ? '#555' : '#d1d5db'}`,
          borderRadius: 6, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200,
          boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {autoState.items.map((s, i) => (
            <div key={s} onMouseDown={(e) => { e.preventDefault(); handleAutoSelect(s); }}
              onMouseEnter={() => setAutoState(prev => ({ ...prev, idx: i, userNavigated: true }))}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: (i === autoState.idx && autoState.idx >= 0) ? (darkMode ? '#3a3a3a' : '#e5e7eb') : (darkMode ? '#1e1e1e' : '#ffffff'),
                color: darkMode ? '#e0e0e0' : '#111', fontFamily: getFontFamily(scriptFont), fontSize: '12pt',
              }}>
              {s}
            </div>
          ))}
        </div>
      )}

      {/* Location autocomplete dropdown */}
      {autoState.show && autoState.type === 'location' && autoState.coords && (
        <div style={{
          position: 'fixed',
          top: (autoState.coords.bottom || 0) + 28,
          left: (autoState.coords.left || 0) - 40,
          background: darkMode ? '#1e1e1e' : '#ffffff',
          border: `1px solid ${darkMode ? '#555' : '#d1d5db'}`,
          borderRadius: 6, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 250,
          boxShadow: darkMode ? '0 4px 16px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {autoState.items.map((s, i) => (
            <div key={s} onMouseDown={(e) => { e.preventDefault(); handleAutoSelect(s); }}
              onMouseEnter={() => setAutoState(prev => ({ ...prev, idx: i, userNavigated: true }))}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: (i === autoState.idx && autoState.idx >= 0) ? (darkMode ? '#3a3a3a' : '#e5e7eb') : (darkMode ? '#1e1e1e' : '#ffffff'),
                color: darkMode ? '#e0e0e0' : '#111', fontFamily: getFontFamily(scriptFont), fontSize: '12pt',
              }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default SingleEditor;
