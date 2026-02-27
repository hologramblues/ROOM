import React, { useState, useRef, useCallback, useMemo } from 'react';
import BeatCard from './BeatCard';

const BeatBoardGridView = ({
  beatCards,
  setBeatCards,
  sceneMetrics,
  structureBeats,
  elements,
  selectedCards,
  setSelectedCards,
  onToggleCut,
  onUpdateCard,
  onDeleteCard,
  onOpenEditModal,
  onPushToUndo,
  darkMode,
  t,
}) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [gridDragId, setGridDragId] = useState(null);
  const [gridDropId, setGridDropId] = useState(null);
  const lastClickRef = useRef({ cardId: null, time: 0 });

  const cardColors = ['#ffffff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // Scene number lookup
  const sceneNumbers = useMemo(() => {
    const map = {};
    let num = 0;
    elements.forEach(el => {
      if (el.type === 'scene') {
        num++;
        map[el.id] = num;
      }
    });
    return map;
  }, [elements]);

  // Group cards by acts (structure beats)
  const actGroups = useMemo(() => {
    const timelineCards = beatCards
      .filter(c => c.timelineIndex !== null)
      .sort((a, b) => a.timelineIndex - b.timelineIndex);
    const uncutCards = beatCards.filter(c => c.timelineIndex === null && c.type !== 'note');
    const notes = beatCards.filter(c => c.type === 'note');

    if (structureBeats.length === 0) {
      // No structure beats — one single group
      const groups = [];
      if (timelineCards.length > 0) {
        groups.push({
          label: t('allScenes') || 'Toutes les scenes',
          cards: timelineCards,
          pages: sceneMetrics.totalPages,
        });
      }
      if (uncutCards.length > 0) {
        groups.push({
          label: t('uncutScenes') || 'Hors montage',
          cards: uncutCards,
          pages: 0,
          isUncut: true,
        });
      }
      if (notes.length > 0) {
        groups.push({
          label: t('notes') || 'Notes',
          cards: notes,
          pages: 0,
          isNotes: true,
        });
      }
      return groups;
    }

    // Sort beats by first scene position
    const sortedBeats = [...structureBeats].sort((a, b) => {
      const aCard = sceneMetrics.cards.find(c => c.linkedSceneId === a.startSceneId);
      const bCard = sceneMetrics.cards.find(c => c.linkedSceneId === b.startSceneId);
      return (aCard?.startPage || 0) - (bCard?.startPage || 0);
    });

    // Assign each timeline card to a beat
    const groups = sortedBeats.map((beat, beatIdx) => {
      const nextBeat = sortedBeats[beatIdx + 1];
      const beatStartCard = sceneMetrics.cards.find(c => c.linkedSceneId === beat.startSceneId);
      const nextBeatStartCard = nextBeat ? sceneMetrics.cards.find(c => c.linkedSceneId === nextBeat.startSceneId) : null;

      const startPage = beatStartCard?.startPage || 0;
      const endPage = nextBeatStartCard?.startPage || sceneMetrics.totalPages;

      const cardsInBeat = timelineCards.filter(card => {
        const metric = sceneMetrics.cards.find(c => c.id === card.id);
        if (!metric) return false;
        return metric.startPage >= startPage && (nextBeatStartCard ? metric.startPage < endPage : true);
      });

      return {
        label: beat.label,
        color: beat.color,
        cards: cardsInBeat,
        pages: endPage - startPage,
      };
    });

    if (uncutCards.length > 0) {
      groups.push({ label: t('uncutScenes') || 'Hors montage', cards: uncutCards, pages: 0, isUncut: true });
    }
    if (notes.length > 0) {
      groups.push({ label: t('notes') || 'Notes', cards: notes, pages: 0, isNotes: true });
    }

    return groups;
  }, [beatCards, structureBeats, sceneMetrics, t]);

  const handleCardMouseDown = useCallback((e, card) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey) {
      setSelectedCards(prev => {
        const newSet = new Set(prev);
        newSet.has(card.id) ? newSet.delete(card.id) : newSet.add(card.id);
        return newSet;
      });
      return;
    }

    if (!selectedCards.has(card.id)) {
      setSelectedCards(new Set([card.id]));
    }

    // Start grid drag
    setGridDragId(card.id);
  }, [selectedCards, setSelectedCards]);

  const handleCardMouseUp = useCallback((card) => {
    if (gridDragId === card.id && !gridDropId) {
      // It was a click, not a drag
      const now = Date.now();
      const last = lastClickRef.current;
      if (last.cardId === card.id && now - last.time < 400) {
        onOpenEditModal(card);
        lastClickRef.current = { cardId: null, time: 0 };
      } else {
        lastClickRef.current = { cardId: card.id, time: now };
      }
    }

    if (gridDragId && gridDropId && gridDragId !== gridDropId) {
      onPushToUndo?.();
      // Reorder: move gridDragId to position of gridDropId
      setBeatCards(prev => {
        const dragIdx = prev.findIndex(c => c.id === gridDragId);
        const dropIdx = prev.findIndex(c => c.id === gridDropId);
        if (dragIdx === -1 || dropIdx === -1) return prev;

        const dragCard = prev[dragIdx];
        const dropCard = prev[dropIdx];

        // Swap timeline indices
        if (dragCard.timelineIndex !== null && dropCard.timelineIndex !== null) {
          return prev.map(c => {
            if (c.id === gridDragId) return { ...c, timelineIndex: dropCard.timelineIndex };
            if (c.id === gridDropId) return { ...c, timelineIndex: dragCard.timelineIndex };
            return c;
          });
        }
        return prev;
      });
    }

    setGridDragId(null);
    setGridDropId(null);
  }, [gridDragId, gridDropId, onOpenEditModal, onPushToUndo, setBeatCards]);

  const handleContextMenu = useCallback((e, card) => {
    e.preventDefault();
    e.stopPropagation();
    if (e._deleteAction) {
      onDeleteCard(card.id);
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, card });
    if (!selectedCards.has(card.id)) {
      setSelectedCards(new Set([card.id]));
    }
  }, [selectedCards, setSelectedCards, onDeleteCard]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="bb-grid" onClick={() => { setSelectedCards(new Set()); closeContextMenu(); }}>
      {actGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="bb-grid__act">
          <div className="bb-grid__act-header">
            <span className="bb-grid__act-title" style={group.color ? { color: group.color } : undefined}>
              {group.label}
            </span>
            <span className="bb-grid__act-stats">
              {group.cards.length} {t('scenes') || 'scenes'}
              {group.pages > 0 && ` \u00B7 ${group.pages.toFixed(0)} pages`}
            </span>
          </div>
          <div className="bb-grid__cards">
            {group.cards.map(card => (
              <div
                key={card.id}
                onMouseEnter={() => gridDragId && gridDragId !== card.id && setGridDropId(card.id)}
                onMouseLeave={() => gridDropId === card.id && setGridDropId(null)}
                onMouseUp={() => handleCardMouseUp(card)}
                className={gridDropId === card.id ? 'bb-card--drop-target' : ''}
              >
                <BeatCard
                  card={card}
                  sceneNum={card.linkedSceneId ? sceneNumbers[card.linkedSceneId] : null}
                  isSelected={selectedCards.has(card.id)}
                  isDragging={gridDragId === card.id}
                  onMouseDown={(e) => handleCardMouseDown(e, card)}
                  onContextMenu={(e) => handleContextMenu(e, card)}
                  onDoubleClick={() => onOpenEditModal(card)}
                  onToggleCut={onToggleCut}
                  onUpdateSynopsis={(id, synopsis) => onUpdateCard(id, { synopsis })}
                  inlineEditing={true}
                />
              </div>
            ))}
            {group.cards.length === 0 && (
              <div style={{ padding: 20, color: 'var(--bb-text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                {group.isUncut ? (t('noUncutScenes') || 'Aucune scene hors montage') : (t('noScenes') || 'Aucune scene')}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="bb-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Colors */}
          <div className="bb-context-menu__colors">
            {cardColors.map(color => (
              <button
                key={color}
                className={`bb-context-menu__color-btn ${contextMenu.card.color === color ? 'bb-context-menu__color-btn--active' : ''}`}
                style={{ background: color === '#ffffff' ? (darkMode ? '#555' : '#e5e7eb') : color }}
                onClick={() => { onUpdateCard(contextMenu.card.id, { color }); closeContextMenu(); }}
              />
            ))}
          </div>
          <div className="bb-context-menu__separator" />

          {/* Status */}
          <button className="bb-context-menu__item" onClick={() => { onUpdateCard(contextMenu.card.id, { status: null }); closeContextMenu(); }}>
            {'\u25CB'} {t('noStatus') || 'Aucun statut'}
          </button>
          <button className="bb-context-menu__item" onClick={() => { onUpdateCard(contextMenu.card.id, { status: 'progress' }); closeContextMenu(); }}>
            {'\u25D0'} {t('inProgress') || 'En cours'}
          </button>
          <button className="bb-context-menu__item" onClick={() => { onUpdateCard(contextMenu.card.id, { status: 'done' }); closeContextMenu(); }}>
            {'\u2713'} {t('done') || 'Termine'}
          </button>
          <button className="bb-context-menu__item" onClick={() => { onUpdateCard(contextMenu.card.id, { status: 'urgent' }); closeContextMenu(); }}>
            {'!'} {t('urgent') || 'Urgent'}
          </button>
          <div className="bb-context-menu__separator" />

          {/* CUT/UNCUT */}
          <button className="bb-context-menu__item" onClick={() => { onToggleCut(contextMenu.card.id); closeContextMenu(); }}>
            {contextMenu.card.timelineIndex !== null ? '\u2702 UNCUT' : '\uD83C\uDFAC CUT'}
          </button>
          <div className="bb-context-menu__separator" />

          {/* Delete */}
          <button className="bb-context-menu__item bb-context-menu__item--danger" onClick={() => { onDeleteCard(contextMenu.card.id); closeContextMenu(); }}>
            {'\u2716'} {t('delete') || 'Supprimer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BeatBoardGridView;
