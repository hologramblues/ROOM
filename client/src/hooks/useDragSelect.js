import { useEffect } from 'react';

/**
 * Handles mouse-drag selection across multiple screenplay blocks.
 * When the user mouse-drags from one block to another, this creates a selectedRange
 * that enables multi-block copy/cut/delete operations.
 *
 * Also clears copiedBlocksRef on normal (non-multi-block) copy events.
 */
export default function useDragSelect({
  elementsRef,
  dragStartIndexRef,
  isDragSelecting,
  setIsDragSelecting,
  selectedRange,
  setSelectedRange,
  copiedBlocksRef,
}) {
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
  }, [isDragSelecting, selectedRange]); // eslint-disable-line react-hooks/exhaustive-deps
}
