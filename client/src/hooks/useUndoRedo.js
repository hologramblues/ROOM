import { useState, useCallback } from 'react';

export default function useUndoRedo({
  elementsRef, beatCardsRef, structureBeatsRef, sceneSynopsisRef, sceneStatusRef,
  setElements, setBeatCards, setStructureBeats, setSceneSynopsis, setSceneStatus,
  socketRef, lastEmittedRef, docVersionRef
}) {
  const [, setUndoStack] = useState([]);
  const [, setRedoStack] = useState([]);

  // Save to undo stack before changes - saves complete state snapshot
  // Uses refs to avoid recreating on every keystroke (prevents cascade re-renders)
  const pushToUndo = useCallback((snapshot = null) => {
    const currentSnapshot = snapshot || {
      elements: elementsRef.current,
      beatCards: beatCardsRef.current,
      structureBeats: structureBeatsRef.current,
      sceneSynopsis: sceneSynopsisRef.current,
      sceneStatus: sceneStatusRef.current
    };
    setUndoStack(prev => [...prev.slice(-30), currentSnapshot]); // Keep last 30
    setRedoStack([]); // Clear redo on new action
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];

      // Save current state to redo stack
      const currentSnapshot = {
        elements: elementsRef.current,
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current
      };
      setRedoStack(r => [...r, currentSnapshot]);

      // Restore previous state - handle both old format (just elements array) and new format (full snapshot)
      if (Array.isArray(previous)) {
        setElements(previous);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: previous, docVersion: docVersionRef?.current });
          if (lastEmittedRef) lastEmittedRef.current = previous;
        }
      } else {
        if (previous.elements) setElements(previous.elements);
        if (previous.beatCards) setBeatCards(previous.beatCards);
        if (previous.structureBeats) setStructureBeats(previous.structureBeats);
        if (previous.sceneSynopsis) setSceneSynopsis(previous.sceneSynopsis);
        if (previous.sceneStatus) setSceneStatus(previous.sceneStatus);
        const els = previous.elements || elementsRef.current;
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: els, docVersion: docVersionRef?.current });
          if (lastEmittedRef) lastEmittedRef.current = els;
        }
      }

      return prev.slice(0, -1);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];

      // Save current state to undo stack
      const currentSnapshot = {
        elements: elementsRef.current,
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current
      };
      setUndoStack(u => [...u, currentSnapshot]);

      // Restore next state - handle both old format and new format
      if (Array.isArray(next)) {
        setElements(next);
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: next, docVersion: docVersionRef?.current });
          if (lastEmittedRef) lastEmittedRef.current = next;
        }
      } else {
        if (next.elements) setElements(next.elements);
        if (next.beatCards) setBeatCards(next.beatCards);
        if (next.structureBeats) setStructureBeats(next.structureBeats);
        if (next.sceneSynopsis) setSceneSynopsis(next.sceneSynopsis);
        if (next.sceneStatus) setSceneStatus(next.sceneStatus);
        const els = next.elements || elementsRef.current;
        if (socketRef.current) {
          socketRef.current.emit('full-sync', { elements: els, docVersion: docVersionRef?.current });
          if (lastEmittedRef) lastEmittedRef.current = els;
        }
      }

      return prev.slice(0, -1);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { pushToUndo, undo, redo };
}
