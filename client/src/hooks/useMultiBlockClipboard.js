import { useEffect } from 'react';
import { stripHtml, generateId } from '../utils/helpers';

export default function useMultiBlockClipboard({
  selectedRange, setSelectedRange, elementsRef, canEditNow,
  pushToUndo, setElements, setActiveIndex,
  copiedBlocksRef, socketRef, connected, canEdit, offlineDocIdRef
}) {
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!selectedRange) return;
      const { start, end } = selectedRange;
      const isMeta = e.metaKey || e.ctrlKey;

      // Escape: clear selection
      if (e.key === 'Escape') {
        setSelectedRange(null);
        return;
      }

      // Don't intercept keys when focus is in an input/textarea
      const focusedEl = document.activeElement;
      if (focusedEl && (focusedEl.tagName === 'INPUT' || focusedEl.tagName === 'TEXTAREA' || (focusedEl.isContentEditable && !focusedEl.closest('.script-editor-container')))) {
        return;
      }

      // Cmd+C or Cmd+X: copy selected blocks to clipboard
      if (isMeta && (e.key === 'c' || e.key === 'x')) {
        e.preventDefault();
        e.stopPropagation();
        const selected = elementsRef.current.slice(start, end + 1);
        copiedBlocksRef.current = JSON.parse(JSON.stringify(selected));
        const plainText = selected.map(el => {
          const text = stripHtml(el.content) || '';
          switch (el.type) {
            case 'scene': return '\n' + text.toUpperCase() + '\n';
            case 'character': return '\n                         ' + text.toUpperCase();
            case 'parenthetical': return '                    ' + text;
            case 'dialogue': return '               ' + text;
            case 'transition': return '\n' + text.toUpperCase() + '\n';
            default: return '\n' + text;
          }
        }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        try {
          navigator.clipboard.writeText(plainText);
        } catch (err) {
          // silent fail
        }

        if (e.key === 'x' && canEditNow) {
          pushToUndo();
          setElements(prev => {
            const newEls = prev.filter((_, i) => i < start || i > end);
            return newEls.length === 0 ? [{ id: generateId(), type: 'action', content: '' }] : newEls;
          });
          setActiveIndex(Math.min(start, elementsRef.current.length - 1));
          setSelectedRange(null);
        }
        return;
      }

      // Cmd+V: paste blocks
      if (isMeta && e.key === 'v' && canEditNow) {
        e.preventDefault();
        e.stopPropagation();

        const doInsert = (newBlocks) => {
          if (!newBlocks || newBlocks.length === 0) return;
          pushToUndo();
          setElements(prev => {
            const insertAt = end + 1;
            const newEls = [...prev];
            newEls.splice(insertAt, 0, ...newBlocks);
            return newEls;
          });
          setSelectedRange(null);
          setActiveIndex(end + 1);
        };

        if (copiedBlocksRef.current) {
          const newBlocks = copiedBlocksRef.current.map(b => ({ ...b, id: generateId() }));
          doInsert(newBlocks);
          return;
        }

        navigator.clipboard.readText().then(text => {
          if (!text) return;
          const lines = text.split('\n').filter(l => l.trim());
          const newBlocks = lines.map(line => ({ id: generateId(), type: 'action', content: line }));
          doInsert(newBlocks);
        }).catch(() => {});
        return;
      }

      // Backspace/Delete: delete selected blocks
      if ((e.key === 'Backspace' || e.key === 'Delete') && canEditNow) {
        e.preventDefault();
        e.stopPropagation();
        pushToUndo();
        setElements(prev => {
          const newEls = prev.filter((_, i) => i < start || i > end);
          return newEls.length === 0 ? [{ id: generateId(), type: 'action', content: '' }] : newEls;
        });
        setActiveIndex(Math.min(start, elementsRef.current.length - 1));
        setSelectedRange(null);
        return;
      }
    };

    if (selectedRange) {
      window.addEventListener('keydown', handleGlobalKeyDown, true);
    }
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [selectedRange, canEdit, canEditNow, connected, pushToUndo, setSelectedRange, elementsRef, copiedBlocksRef, socketRef, offlineDocIdRef, setElements, setActiveIndex]);
}
