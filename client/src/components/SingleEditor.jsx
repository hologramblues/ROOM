import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CommentMark from '../extensions/CommentMark';
import SuggestionMark from '../extensions/SuggestionMark';
import ScreenplayElement from '../extensions/ScreenplayElement';
import { createPageBreakPlugin } from '../extensions/pageBreakPlugin';
import { createSceneLockPlugin } from '../extensions/sceneLockPlugin';
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
      PageBreakExtension,
      SceneLockExtension,
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

        // Notify parent of active element index
        let elemIdx = 0;
        editor.state.doc.forEach((child, offset, index) => {
          if (offset <= $from.pos && offset + child.nodeSize > $from.pos) {
            elemIdx = index;
          }
        });
        if (onActiveElementChange) onActiveElementChange(elemIdx);

        // Text selection → comment/suggestion creation
        if (from !== to && onTextSelect) {
          const selectedText = editor.state.doc.textBetween(from, to);
          if (selectedText.trim()) {
            const nodeStart = $from.before();
            const coords = editor.view.coordsAtPos(from);
            // Compute element index by walking the doc
            let elemIdx = 0;
            editor.state.doc.forEach((child, offset, index) => {
              if (offset <= $from.pos && offset + child.nodeSize > $from.pos) {
                elemIdx = index;
              }
            });
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
            let currentIndex = -1;
            doc.forEach((child, offset, index) => {
              if (offset <= $from.pos && offset + child.nodeSize > $from.pos) {
                currentIndex = index;
              }
            });
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
  useEffect(() => {
    if (!editor || isEditorOriginRef.current) return;
    const currentEls = extractElementsFromDoc(editor.state.doc);
    if (elementsEqual(currentEls, elements)) return;

    // Check if only element types changed (not content) — apply type changes without full setContent
    if (editor.isFocused && currentEls.length === elements.length) {
      // Check if only types differ (content is the same)
      let onlyTypeDiff = true;
      const typeChanges = [];
      for (let i = 0; i < elements.length; i++) {
        if (currentEls[i].content !== elements[i].content || currentEls[i].id !== elements[i].id) {
          onlyTypeDiff = false;
          break;
        }
        if (currentEls[i].type !== elements[i].type) {
          typeChanges.push({ index: i, type: elements[i].type });
        }
      }
      if (onlyTypeDiff && typeChanges.length > 0) {
        // Apply type changes via setNodeMarkup (preserves cursor & content)
        const { tr } = editor.state;
        typeChanges.forEach(({ index, type }) => {
          const child = editor.state.doc.child(index);
          let pos = 0;
          for (let j = 0; j < index; j++) pos += editor.state.doc.child(j).nodeSize;
          tr.setNodeMarkup(pos, null, { ...child.attrs, elementType: type });
        });
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
        lastElementsRef.current = elements;
        return;
      }
      if (onlyTypeDiff) return; // No type changes either, skip
      // Content changed while typing with same length — skip to avoid disrupting input
      return;
    }
    // Not focused or structure changed — full content replace
    // Save cursor
    const savedPos = editor.state.selection.from;
    editor.commands.setContent(buildDocFromElements(elements), false);
    // Restore cursor position
    try {
      const maxPos = editor.state.doc.content.size - 1;
      editor.commands.setTextSelection(Math.min(savedPos, maxPos));
    } catch (_) {}
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
  }, [editor, highlightsByElement, elements]);

  // Handle autocomplete selection
  const handleAutoSelect = useCallback((item) => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const node = $from.parent;
    if (node.type.name !== 'screenplayElement') return;
    const nodeStart = $from.before();

    if (autoState.type === 'character') {
      // Replace entire node content with selected character name
      const tr = editor.state.tr;
      if (node.content.size > 0) {
        tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
      }
      tr.insertText(item, nodeStart + 1);
      editor.view.dispatch(tr);
      // Then insert a dialogue element after
      setTimeout(() => {
        editor.commands.splitScreenplayElement();
      }, 10);
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
      } else if (event.key === 'Enter') {
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
