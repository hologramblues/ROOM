import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CommentMark from '../extensions/CommentMark';
import SuggestionMark from '../extensions/SuggestionMark';
import ExternalSpanMark from '../extensions/ExternalSpanMark';
import ScreenplayElement from '../extensions/ScreenplayElement';
import { createPageBreakPlugin } from '../extensions/pageBreakPlugin';
import { createSceneLockPlugin } from '../extensions/sceneLockPlugin';
import { createRemoteCursorPlugin } from '../extensions/remoteCursorPlugin';
import { buildDocFromElements, extractElementsFromDoc, elementsEqual, stripHtml } from '../utils/helpers';
import { getFontFamily } from '../constants/fonts';

// ============ SCREENPLAY EDITOR (Single TipTap V272) ============
const SingleEditor = React.memo(({
  elements,
  onElementsChange,
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
  remoteCursors,
  onCursorMove,
  computePageInfoFn,
  highlightsByElement,
  lockedScenes,
  t = (k) => k,
}) => {
  const isEditorOriginRef = useRef(false);
  const isApplyingMarksRef = useRef(false);
  const lastElementsRef = useRef(elements);
  const syncTimeoutRef = useRef(null);
  const marksTimeoutRef = useRef(null);
  const darkModeRef = useRef(darkMode);
  darkModeRef.current = darkMode;
  const lockedScenesRef = useRef(lockedScenes);
  lockedScenesRef.current = lockedScenes;
  const remoteCursorsRef = useRef(remoteCursors);
  remoteCursorsRef.current = remoteCursors;
  const [autoState, setAutoState] = useState({ show: false, items: [], idx: 0, type: null, nodePos: null });

  // Create page break extension that wraps ProseMirror plugin
  // Uses darkModeRef so the plugin always reads current darkMode value
  const PageBreakExtension = useMemo(() => {
    const plugin = createPageBreakPlugin(computePageInfoFn, stripHtml, darkModeRef);
    return Extension.create({
      name: 'pageBreakHelper',
      addProseMirrorPlugins() { return [plugin]; },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene lock extension — blocks edits on elements in locked scenes
  const SceneLockExtension = useMemo(() => {
    const plugin = createSceneLockPlugin(lockedScenesRef);
    return Extension.create({
      name: 'sceneLockHelper',
      addProseMirrorPlugins() { return [plugin]; },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remote cursors extension — shows other users' cursor positions
  const RemoteCursorExtension = useMemo(() => {
    const plugin = createRemoteCursorPlugin(remoteCursorsRef);
    return Extension.create({
      name: 'remoteCursorHelper',
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
        history: true,
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
      RemoteCursorExtension,
    ],
    content: buildDocFromElements(elements),
    editable: canEdit,

    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
      // Handle click on comment/suggestion marks
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

    onUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      // Skip state sync when we're just applying highlight marks
      if (isApplyingMarksRef.current) return;
      try {
        isEditorOriginRef.current = true;
        const newElements = extractElementsFromDoc(editor.state.doc);
        // Debounce the elements state update
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          if (!elementsEqual(newElements, lastElementsRef.current)) {
            lastElementsRef.current = newElements;
            onElementsChange(newElements);
          }
          // Reset flag after state propagation
          requestAnimationFrame(() => { isEditorOriginRef.current = false; });
        }, 100);
      } catch (_) {}
    },

    onSelectionUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      try {
        const { $from, from, to } = editor.state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return;

        // Compute element index ONCE using ProseMirror's resolved position (O(1), no doc walk)
        const elemIdx = $from.index(0);

        if (onActiveElementChange) onActiveElementChange(elemIdx);

        // Emit cursor position for remote users
        if (onCursorMove) {
          const offsetInElement = from - $from.before() - 1;
          onCursorMove(elemIdx, Math.max(0, offsetInElement));
        }

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
          // Find the cycling character (Final Draft style: suggest the character
          // who spoke before the last one in this scene, for ping-pong dialogue)
          let cyclingSuggestion = null;
          if (text.length === 0) {
            const doc = editor.state.doc;
            const currentIndex = elemIdx; // Already computed above via $from.index(0)
            // Scan backward through elements to find scene characters
            const recentChars = [];
            for (let i = currentIndex - 1; i >= 0; i--) {
              const el = doc.child(i);
              const elType = el.attrs.elementType;
              if (elType === 'scene') break; // Stop at scene boundary
              if (elType === 'character' && el.textContent.trim()) {
                const name = el.textContent.trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
                if (recentChars.length === 0 || recentChars[recentChars.length - 1] !== name) {
                  recentChars.push(name);
                }
                if (recentChars.length >= 2) break;
              }
            }
            // recentChars[0] = last speaker, recentChars[1] = the one before
            if (recentChars.length >= 2) {
              cyclingSuggestion = recentChars[1];
            }
          }

          if (text.length > 0) {
            const q = text.toUpperCase();
            const f = (characters || []).filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
            if (f.length > 0) {
              const coords = editor.view.coordsAtPos(from);
              setAutoState({ show: true, items: f, idx: 0, type: 'character', coords });
            } else {
              setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
            }
          } else if (cyclingSuggestion) {
            // Show cycling suggestion for empty character element
            const coords = editor.view.coordsAtPos(from);
            // Find the full name from characters list (preserve original casing)
            const fullName = (characters || []).find(c => c.toUpperCase() === cyclingSuggestion) || cyclingSuggestion;
            setAutoState({ show: true, items: [fullName], idx: 0, type: 'character', coords });
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
              setAutoState({ show: true, items: f, idx: 0, type: 'location', coords });
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
      // Clear autocomplete on blur
      setAutoState(prev => prev.show ? { ...prev, show: false } : prev);
    },
  });

  // Sync external changes (socket, import, undo) into the editor
  // V272-fix: Surgical per-element updates instead of full setContent
  // This preserves the local cursor and allows remote changes to appear while user is typing
  useEffect(() => {
    if (!editor || isEditorOriginRef.current) return;
    const currentEls = extractElementsFromDoc(editor.state.doc);
    if (elementsEqual(currentEls, elements)) return;

    // Determine which element the local cursor is in (to avoid disrupting active typing)
    let cursorElementIndex = -1;
    if (editor.isFocused) {
      try {
        const { $from } = editor.state.selection;
        editor.state.doc.forEach((child, offset, index) => {
          if (offset <= $from.pos && offset + child.nodeSize > $from.pos) {
            cursorElementIndex = index;
          }
        });
      } catch (_) {}
    }

    // Build ID maps for current editor state
    const currentMap = new Map();
    currentEls.forEach((el, i) => currentMap.set(el.id, { el, index: i }));
    const newMap = new Map();
    elements.forEach((el, i) => newMap.set(el.id, { el, index: i }));

    // Detect if structure changed (different IDs or different order)
    const structureChanged = currentEls.length !== elements.length ||
      currentEls.some((el, i) => el.id !== elements[i].id);

    if (!structureChanged) {
      // Same structure — apply surgical per-element updates via a single transaction
      const { tr } = editor.state;
      let changed = false;

      for (let i = 0; i < elements.length; i++) {
        const cur = currentEls[i];
        const next = elements[i];
        if (cur.type === next.type && cur.content === next.content) continue;

        // Skip the element the user is actively typing in
        if (i === cursorElementIndex) continue;

        // Calculate position of this node in the doc
        let pos = 0;
        for (let j = 0; j < i; j++) pos += editor.state.doc.child(j).nodeSize;
        const node = editor.state.doc.child(i);

        // Apply type change
        if (cur.type !== next.type) {
          tr.setNodeMarkup(pos, null, { ...node.attrs, elementType: next.type });
          changed = true;
        }

        // Apply content change
        if (cur.content !== next.content) {
          const nodeStart = pos + 1; // +1 to enter the node
          const nodeEnd = pos + node.nodeSize - 1; // -1 to stay inside
          // Replace node content
          if (next.content) {
            tr.replaceWith(nodeStart, nodeEnd, editor.state.schema.text(next.content));
          } else {
            tr.delete(nodeStart, nodeEnd);
          }
          changed = true;
        }
      }

      if (changed) {
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      }
    } else {
      // Structure changed (insert/delete/reorder) — full content replace required
      const savedPos = editor.state.selection.from;
      editor.commands.setContent(buildDocFromElements(elements), false);
      try {
        const maxPos = editor.state.doc.content.size - 1;
        editor.commands.setTextSelection(Math.min(savedPos, Math.max(0, maxPos)));
      } catch (_) {}
    }

    lastElementsRef.current = elements;
  }, [elements, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      const shouldBeEditable = !!canEdit;
      if (editor.isEditable !== shouldBeEditable) {
        editor.setEditable(shouldBeEditable);
      }
    }
  }, [editor, canEdit]);

  // Force decoration update when remote cursors change (coalesced via rAF)
  const cursorRafRef = useRef(null);
  useEffect(() => {
    if (!editor || !editor.view) return;
    if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current);
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      if (!editor || editor.isDestroyed) return;
      try {
        const { tr } = editor.state;
        tr.setMeta('remoteCursorsUpdate', true);
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      } catch (_) {}
    });
    return () => { if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current); };
  }, [editor, remoteCursors]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);
    };
  }, []);

  // Apply comment/suggestion marks to editor content (creates real <span> elements for clicks + Safari)
  // Deps include elements so marks are reapplied after content changes (doc switch, socket sync)
  useEffect(() => {
    if (!editor || !highlightsByElement) return;

    if (marksTimeoutRef.current) clearTimeout(marksTimeoutRef.current);

    // Delay to ensure editor content is synced first (sync effect runs on same render)
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

        // First, remove all existing comment/suggestion marks
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const nodeStart = pos + 1; // +1 to skip into node content
          const nodeEnd = pos + node.nodeSize - 1;
          if (commentMarkType) {
            tr.removeMark(nodeStart, nodeEnd, commentMarkType);
          }
          if (suggestionMarkType) {
            tr.removeMark(nodeStart, nodeEnd, suggestionMarkType);
          }
        });

        // Then apply marks for each element with highlights
        editor.state.doc.forEach((node, pos) => {
          if (node.type.name !== 'screenplayElement') return;
          const elementId = node.attrs.elementId;
          const highlights = highlightsByElement[elementId];
          if (!highlights || highlights.length === 0) return;

          const nodeStart = pos + 1; // +1 to skip into node content
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

        // Dispatch without adding to undo history
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
      } catch (err) {
        console.warn('[Marks] Error applying highlight marks:', err.message);
      } finally {
        // Reset flag after DOM updates settle
        requestAnimationFrame(() => {
          isApplyingMarksRef.current = false;
        });
      }
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, highlightsByElement]); // No 'elements' dep — marks only reapply when comments/suggestions change, not on every keystroke

  // Handle autocomplete selection
  const handleAutoSelect = useCallback((item) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name !== 'screenplayElement') return;
    const nodeStart = $from.before();

    if (autoState.type === 'character') {
      // Replace entire node content with selected character name
      // Then create a dialogue element below — all in one transaction chain
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(item, nodeStart + 1);
      // Move cursor to end of inserted text so splitScreenplayElement detects "atEnd"
      const endPos = nodeStart + 1 + item.length;
      tr.setSelection(editor.state.selection.constructor.near(tr.doc.resolve(endPos)));
      editor.view.dispatch(tr);

      // Use requestAnimationFrame to ensure the transaction is fully applied before splitting
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
        setAutoState(prev => ({ ...prev, idx: (prev.idx + 1) % prev.items.length }));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setAutoState(prev => ({ ...prev, idx: (prev.idx - 1 + prev.items.length) % prev.items.length }));
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        handleAutoSelect(autoState.items[autoState.idx]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setAutoState(prev => ({ ...prev, show: false }));
      }
    };

    // Use capture phase to intercept before TipTap
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
          top: (autoState.coords.bottom || 0) + 4,
          left: (autoState.coords.left || 0),
          background: '#1e1e1e',
          border: '1px solid #555',
          borderRadius: 6,
          maxHeight: 150,
          overflowY: 'auto',
          zIndex: 1000,
          minWidth: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          {autoState.items.map((s, i) => (
            <div
              key={s}
              onClick={() => handleAutoSelect(s)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === autoState.idx ? '#3a3a3a' : '#1e1e1e',
                color: '#e0e0e0',
                fontFamily: getFontFamily(scriptFont),
                fontSize: '12pt',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}

      {/* Location autocomplete dropdown */}
      {autoState.show && autoState.type === 'location' && autoState.coords && (
        <div style={{
          position: 'fixed',
          top: (autoState.coords.bottom || 0) + 4,
          left: (autoState.coords.left || 0),
          background: '#1e1e1e',
          border: '1px solid #555',
          borderRadius: 6,
          maxHeight: 150,
          overflowY: 'auto',
          zIndex: 1000,
          minWidth: 250,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          {autoState.items.map((s, i) => (
            <div
              key={s}
              onClick={() => handleAutoSelect(s)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: i === autoState.idx ? '#3a3a3a' : '#1e1e1e',
                color: '#e0e0e0',
                fontFamily: getFontFamily(scriptFont),
                fontSize: '12pt',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default SingleEditor;
