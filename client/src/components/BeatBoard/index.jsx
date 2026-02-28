import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stripHtml } from '../../utils/helpers';
import BeatBoardToolbar from './BeatBoardToolbar';
import { STRUCTURE_PRESETS } from './BeatBoardToolbar';
import BeatBoardSceneStrip from './BeatBoardSceneStrip';
import BeatBoardGridView from './BeatBoardGridView';
import BeatBoardCanvasView from './BeatBoardCanvasView';
import BeatCardEditModal from './BeatCardEditModal';
import './BeatBoard.css';

const STORAGE_KEY = 'rooms-beatboard-view';

const BeatBoard = React.memo(({
  elements,
  setElements,
  darkMode,
  sceneSynopsis,
  setSceneSynopsis,
  sceneStatus,
  setSceneStatus,
  beatCards,
  setBeatCards,
  structureBeats,
  setStructureBeats,
  whiteboardElements,
  setWhiteboardElements,
  onPushToUndo,
  isActive = false,
  t = (k) => k,
}) => {
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // 'whiteboard' was merged into 'canvas', fall back
      return saved === 'whiteboard' ? 'canvas' : (saved || 'grid');
    } catch { return 'grid'; }
  });
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [editModalCard, setEditModalCard] = useState(null);

  const defaultCardColor = '#ffffff';

  // Persist view mode
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, viewMode); } catch {}
  }, [viewMode]);

  // Initialize beat cards from scenes
  useEffect(() => {
    const scenes = elements.map((el, idx) => ({ ...el, index: idx })).filter(el => el.type === 'scene');

    setBeatCards(prev => {
      const customCards = prev.filter(c => !c.linkedSceneId);
      const sceneCards = scenes.map((scene, sceneIdx) => {
        const existingCard = prev.find(c => c.linkedSceneId === scene.id);
        if (existingCard) {
          return {
            ...existingCard,
            title: stripHtml(scene.content) || 'Nouvelle scene',
            synopsis: sceneSynopsis[scene.id] || existingCard.synopsis || '',
            status: sceneStatus[scene.id] || existingCard.status,
            linkedSceneIndex: scene.index,
          };
        }
        return {
          id: 'beat_' + scene.id,
          linkedSceneId: scene.id,
          linkedSceneIndex: scene.index,
          title: stripHtml(scene.content) || 'Nouvelle scene',
          synopsis: sceneSynopsis[scene.id] || '',
          color: defaultCardColor,
          position: { x: 50 + (sceneIdx % 5) * 260, y: 180 + Math.floor(sceneIdx / 5) * 220 },
          timelineIndex: sceneIdx,
          status: sceneStatus[scene.id] || null,
          isNew: false,
        };
      });
      return [...sceneCards, ...customCards];
    });
  }, [elements, sceneSynopsis, sceneStatus, setBeatCards]);

  // Derived data
  const timelineCards = useMemo(
    () => beatCards.filter(c => c.timelineIndex !== null).sort((a, b) => a.timelineIndex - b.timelineIndex),
    [beatCards]
  );

  const sceneMetrics = useMemo(() => {
    const metrics = [];
    let cumulativePages = 0;

    timelineCards.forEach(card => {
      if (!card.linkedSceneId) {
        metrics.push({ ...card, pages: 0.5, startPage: cumulativePages, startTime: cumulativePages * 60 });
        cumulativePages += 0.5;
        return;
      }
      const sceneIdx = card.linkedSceneIndex;
      let nextSceneIdx = elements.findIndex((el, i) => i > sceneIdx && el.type === 'scene');
      if (nextSceneIdx === -1) nextSceneIdx = elements.length;
      const sceneElements = elements.slice(sceneIdx, nextSceneIdx);
      const estimatedPages = Math.max(0.5, Math.round((sceneElements.length / 8) * 2) / 2);
      metrics.push({ ...card, pages: estimatedPages, startPage: cumulativePages, startTime: cumulativePages * 60 });
      cumulativePages += estimatedPages;
    });

    return { cards: metrics, totalPages: cumulativePages, totalTime: cumulativePages * 60 };
  }, [timelineCards, elements]);

  // Card operations
  const toggleCut = useCallback((cardId) => {
    onPushToUndo?.();
    setBeatCards(prev => {
      const card = prev.find(c => c.id === cardId);
      if (!card) return prev;
      if (card.timelineIndex !== null) {
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c);
      } else {
        const maxIndex = Math.max(-1, ...prev.filter(c => c.timelineIndex !== null).map(c => c.timelineIndex));
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: maxIndex + 1 } : c);
      }
    });
  }, [onPushToUndo, setBeatCards]);

  const deleteCard = useCallback((cardId) => {
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId) setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c));
    else setBeatCards(prev => prev.filter(c => c.id !== cardId));
    setSelectedCards(new Set());
  }, [beatCards, setBeatCards]);

  const updateCard = useCallback((cardId, updates) => {
    setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId && updates.synopsis !== undefined) {
      setSceneSynopsis(prev => ({ ...prev, [card.linkedSceneId]: updates.synopsis }));
    }
    if (card?.linkedSceneId && updates.status !== undefined) {
      setSceneStatus(prev => ({ ...prev, [card.linkedSceneId]: updates.status }));
    }
  }, [beatCards, setBeatCards, setSceneSynopsis, setSceneStatus]);

  const addNewCard = useCallback(() => {
    const newCard = {
      id: 'card_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null,
      title: 'Nouvelle scene', synopsis: '', color: defaultCardColor,
      position: { x: 50 + Math.random() * 200, y: 180 + Math.random() * 200 },
      timelineIndex: null, status: null, isNew: true, type: 'scene',
    };
    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));
    setEditModalCard(newCard);
  }, [setBeatCards]);

  const addNewNote = useCallback(() => {
    const newNote = {
      id: 'note_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null,
      title: '\uD83D\uDCDD Note', synopsis: '', color: '#fbbf24',
      position: { x: 150 + Math.random() * 200, y: 150 + Math.random() * 200 },
      timelineIndex: null, status: null, isNew: true, type: 'note',
    };
    setBeatCards(prev => [...prev, newNote]);
    setSelectedCards(new Set([newNote.id]));
    setEditModalCard(newNote);
  }, [setBeatCards]);

  // Reorder timeline (from scene strip drag)
  const handleReorderTimeline = useCallback((draggedId, draggedIdx, dropIndex) => {
    onPushToUndo?.();
    const orderedIds = sceneMetrics.cards.map(c => c.id);
    const [removed] = orderedIds.splice(draggedIdx, 1);
    const insertIdx = dropIndex > draggedIdx ? dropIndex - 1 : dropIndex;
    orderedIds.splice(insertIdx, 0, removed);

    setBeatCards(prev => prev.map(c => {
      const newIdx = orderedIds.indexOf(c.id);
      return newIdx !== -1 ? { ...c, timelineIndex: newIdx } : c;
    }));

    const newSceneOrder = orderedIds
      .map(id => beatCards.find(c => c.id === id)?.linkedSceneId)
      .filter(Boolean);

    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    let newElements = [];
    const usedSceneIds = new Set();

    newSceneOrder.forEach(sceneId => {
      const sceneIdx = elements.findIndex(el => el.id === sceneId);
      if (sceneIdx === -1) return;
      const scenePos = sceneIndices.indexOf(sceneIdx);
      const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
      newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
      usedSceneIds.add(sceneId);
    });

    elements.filter(el => el.type === 'scene').forEach(scene => {
      if (!usedSceneIds.has(scene.id)) {
        const sceneIdx = elements.findIndex(el => el.id === scene.id);
        const scenePos = sceneIndices.indexOf(sceneIdx);
        const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
        newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
      }
    });

    setElements(newElements);
  }, [sceneMetrics, beatCards, elements, setElements, setBeatCards, onPushToUndo]);

  // Apply structure preset
  const applyStructurePreset = useCallback((presetId) => {
    const preset = STRUCTURE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    onPushToUndo?.();

    const totalPages = sceneMetrics.totalPages || 1;
    const scenes = sceneMetrics.cards.filter(c => c.linkedSceneId);

    const usedSceneIds = new Set();
    const newBeats = preset.beats.map(beat => {
      const targetPage = beat.pct * totalPages;
      // Find the closest scene to targetPage that hasn't been used
      let bestScene = null;
      let bestDist = Infinity;
      for (const scene of scenes) {
        if (usedSceneIds.has(scene.linkedSceneId)) continue;
        const dist = Math.abs(scene.startPage - targetPage);
        if (dist < bestDist) {
          bestDist = dist;
          bestScene = scene;
        }
      }
      // If no unused scene found, pick the closest overall
      if (!bestScene) {
        for (const scene of scenes) {
          const dist = Math.abs(scene.startPage - targetPage);
          if (dist < bestDist) {
            bestDist = dist;
            bestScene = scene;
          }
        }
      }
      if (bestScene) usedSceneIds.add(bestScene.linkedSceneId);
      return {
        id: 'struct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: beat.label,
        startSceneId: bestScene?.linkedSceneId || scenes[0]?.linkedSceneId || null,
        color: beat.color,
      };
    });

    setStructureBeats(newBeats);
  }, [sceneMetrics, onPushToUndo, setStructureBeats]);

  // Clear structure
  const clearStructure = useCallback(() => {
    onPushToUndo?.();
    setStructureBeats([]);
  }, [onPushToUndo, setStructureBeats]);

  // SVG Export
  const handleExportSVG = useCallback(() => {
    const cards = beatCards.filter(c => c.position);
    if (cards.length === 0) return;

    const padding = 50;
    const cardWidth = 220;
    const cardHeight = 160;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(c => {
      minX = Math.min(minX, c.position.x);
      minY = Math.min(minY, c.position.y);
      maxX = Math.max(maxX, c.position.x + cardWidth);
      maxY = Math.max(maxY, c.position.y + cardHeight);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family: system-ui, sans-serif;">`;
    svg += `<rect width="100%" height="100%" fill="${darkMode ? '#2d2d2d' : '#f3f4f6'}"/>`;

    cards.forEach(card => {
      const x = card.position.x + offsetX;
      const y = card.position.y + offsetY;
      const bgColor = card.color === '#ffffff' ? (darkMode ? '#3a3a3a' : 'white') : card.color;
      const textColor = card.color === '#ffffff' ? (darkMode ? 'white' : '#1f2937') : 'white';
      const borderColor = card.color === '#ffffff' ? (darkMode ? '#555' : '#d1d5db') : card.color;

      svg += `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>`;

      if (card.color !== '#ffffff') {
        svg += `<rect x="${x}" y="${y}" width="${cardWidth}" height="6" rx="8" fill="${card.color}"/>`;
      }

      const title = (card.title || '').substring(0, 30) + ((card.title || '').length > 30 ? '...' : '');
      svg += `<text x="${x + 14}" y="${y + 30}" font-size="13" font-weight="600" fill="${textColor}">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;

      if (card.synopsis) {
        const synopsisLines = (card.synopsis || '').substring(0, 120).split(/(.{35})/g).filter(Boolean).slice(0, 4);
        synopsisLines.forEach((line, lineIdx) => {
          svg += `<text x="${x + 14}" y="${y + 50 + lineIdx * 16}" font-size="11" fill="${card.color === '#ffffff' ? '#6b7280' : 'rgba(255,255,255,0.8)'}">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
        });
      }
    });

    svg += '</svg>';

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `beatboard-${new Date().toISOString().slice(0, 10)}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [beatCards, darkMode]);

  return (
    <div className="beat-board">
      {/* Content area — takes remaining space, toolbar stays visible below */}
      <div className="bb-content">
        {/* Scene Strip */}
        <BeatBoardSceneStrip
          sceneMetrics={sceneMetrics}
          structureBeats={structureBeats}
          beatCards={beatCards}
          elements={elements}
          darkMode={darkMode}
          onReorderTimeline={handleReorderTimeline}
          onDoubleClickCard={(card) => setEditModalCard(card)}
          t={t}
        />

        {/* Active View */}
        {viewMode === 'grid' && (
          <BeatBoardGridView
            beatCards={beatCards}
            setBeatCards={setBeatCards}
            sceneMetrics={sceneMetrics}
            structureBeats={structureBeats}
            elements={elements}
            selectedCards={selectedCards}
            setSelectedCards={setSelectedCards}
            onToggleCut={toggleCut}
            onUpdateCard={updateCard}
            onDeleteCard={deleteCard}
            onOpenEditModal={(card) => setEditModalCard(card)}
            onPushToUndo={onPushToUndo}
            darkMode={darkMode}
            t={t}
          />
        )}

        {viewMode === 'canvas' && (
          <BeatBoardCanvasView
            beatCards={beatCards}
            setBeatCards={setBeatCards}
            selectedCards={selectedCards}
            setSelectedCards={setSelectedCards}
            darkMode={darkMode}
            isActive={isActive}
            onPushToUndo={onPushToUndo}
            onOpenEditModal={(card) => setEditModalCard(card)}
            onToggleCut={toggleCut}
            onDeleteCard={deleteCard}
            onUpdateCard={updateCard}
            elements={elements}
            whiteboardElements={whiteboardElements}
            setWhiteboardElements={setWhiteboardElements}
            t={t}
          />
        )}
      </div>

      {/* Footer toolbar */}
      <BeatBoardToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onAddCard={addNewCard}
        onAddNote={addNewNote}
        onExportSVG={handleExportSVG}
        onApplyPreset={applyStructurePreset}
        onClearStructure={clearStructure}
        structureBeats={structureBeats}
        timelineCards={timelineCards}
        beatCards={beatCards}
        totalPages={sceneMetrics.totalPages}
        t={t}
      />

      {/* Edit Modal */}
      {editModalCard && (
        <BeatCardEditModal
          card={editModalCard}
          darkMode={darkMode}
          beatCards={beatCards}
          onUpdateCard={updateCard}
          onToggleCut={toggleCut}
          onClose={() => setEditModalCard(null)}
          setBeatCards={setBeatCards}
          t={t}
        />
      )}
    </div>
  );
});

export default BeatBoard;
