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
  const [gridDropIdx, setGridDropIdx] = useState(null); // index in the flat card list, not card id
  const [gridZoom, setGridZoom] = useState(1);
  const lastClickRef = useRef({ cardId: null, time: 0 });
  const gridRef = useRef(null);

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

  // Flat ordered list of timeline cards (for insert-between logic)
  const orderedTimelineCards = useMemo(
    () => beatCards.filter(c => c.timelineIndex !== null).sort((a, b) => a.timelineIndex - b.timelineIndex),
    [beatCards]
  );

  // Group cards by acts (structure beats)
  const actGroups = useMemo(() => {
    const timelineCards = orderedTimelineCards;
    const uncutCards = beatCards.filter(c => c.timelineIndex === null && c.type !== 'note');
    const notes = beatCards.filter(c => c.type === 'note');

    if (structureBeats.length === 0) {
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

    const sortedBeats = [...structureBeats].sort((a, b) => {
      const aCard = sceneMetrics.cards.find(c => c.linkedSceneId === a.startSceneId);
      const bCard = sceneMetrics.cards.find(c => c.linkedSceneId === b.startSceneId);
      return (aCard?.startPage || 0) - (bCard?.startPage || 0);
    });

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
  }, [beatCards, orderedTimelineCards, structureBeats, sceneMetrics, t]);

  // Build a flat index map: card id -> position in the ordered timeline
  const cardTimelineIndex = useMemo(() => {
    const map = {};
    orderedTimelineCards.forEach((c, i) => { map[c.id] = i; });
    return map;
  }, [orderedTimelineCards]);

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

    setGridDragId(card.id);
  }, [selectedCards, setSelectedCards]);

  // Determine drop position based on mouse position relative to card center
  const handleCardMouseEnter = useCallback((e, card) => {
    if (!gridDragId || gridDragId === card.id) return;
    const dragTimeIdx = cardTimelineIndex[gridDragId];
    const dropTimeIdx = cardTimelineIndex[card.id];
    if (dragTimeIdx === undefined || dropTimeIdx === undefined) return;
    // Insert before this card's position
    setGridDropIdx(dropTimeIdx);
  }, [gridDragId, cardTimelineIndex]);

  const handleCardMouseUp = useCallback((card) => {
    if (gridDragId === card.id && gridDropIdx === null) {
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

    if (gridDragId && gridDropIdx !== null) {
      const dragTimeIdx = cardTimelineIndex[gridDragId];
      if (dragTimeIdx !== undefined && dragTimeIdx !== gridDropIdx && dragTimeIdx !== gridDropIdx - 1) {
        onPushToUndo?.();
        // Insert-between: remove dragged card, insert at drop position
        const ids = orderedTimelineCards.map(c => c.id);
        const [removed] = ids.splice(dragTimeIdx, 1);
        const insertAt = gridDropIdx > dragTimeIdx ? gridDropIdx - 1 : gridDropIdx;
        ids.splice(insertAt, 0, removed);

        setBeatCards(prev => prev.map(c => {
          const newIdx = ids.indexOf(c.id);
          return newIdx !== -1 ? { ...c, timelineIndex: newIdx } : c;
        }));
      }
    }

    setGridDragId(null);
    setGridDropIdx(null);
  }, [gridDragId, gridDropIdx, cardTimelineIndex, orderedTimelineCards, onOpenEditModal, onPushToUndo, setBeatCards]);

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

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setGridZoom(z => Math.min(2, Math.max(0.4, z - e.deltaY * 0.002)));
    }
  }, []);

  // Attach wheel with passive:false for zoom
  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const colWidth = Math.round(280 * gridZoom);

  return (
    <div
      ref={gridRef}
      className="bb-grid"
      onClick={() => { setSelectedCards(new Set()); closeContextMenu(); }}
      onMouseUp={() => { setGridDragId(null); setGridDropIdx(null); }}
    >
      {/* Zoom controls overlay */}
      <div className="bb-grid__zoom-overlay">
        <button
          className="bb-canvas__zoom-btn"
          onClick={(e) => { e.stopPropagation(); setGridZoom(z => Math.max(0.4, z - 0.1)); }}
        >{'\u2212'}</button>
        <span style={{ fontSize: 11, color: 'var(--bb-text-secondary)', minWidth: 36, textAlign: 'center' }}>{Math.round(gridZoom * 100)}%</span>
        <button
          className="bb-canvas__zoom-btn"
          onClick={(e) => { e.stopPropagation(); setGridZoom(z => Math.min(2, z + 0.1)); }}
        >+</button>
        <button
          onClick={(e) => { e.stopPropagation(); setGridZoom(1); }}
          style={{ padding: '2px 8px', borderRadius: 4, background: 'var(--bb-card-bg)', border: '1px solid var(--bb-card-border)', color: 'var(--bb-text-secondary)', cursor: 'pointer', fontSize: 10 }}
        >Reset</button>
      </div>

      {actGroups.length === 0 && (
        <div className="bb-grid__hint">
          {t('addStructureHint') || 'Ajoutez une structure pour organiser les colonnes'}
        </div>
      )}

      {actGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="bb-grid__act" style={{ flex: `0 0 ${colWidth}px`, minWidth: colWidth }}>
          <div className="bb-grid__act-header">
            <span className="bb-grid__act-title" style={group.color ? { color: group.color } : undefined}>
              {group.label}
            </span>
            <span className="bb-grid__act-stats">
              {group.cards.length} {t('scenes') || 'scenes'}
              {group.pages > 0 && ` \u00B7 ${group.pages.toFixed(0)}p`}
            </span>
          </div>
          <div className="bb-grid__cards">
            {group.cards.map((card) => {
              const timeIdx = cardTimelineIndex[card.id];
              const showDropBefore = gridDragId && gridDropIdx === timeIdx && cardTimelineIndex[gridDragId] !== timeIdx && cardTimelineIndex[gridDragId] !== timeIdx - 1;

              return (
                <React.Fragment key={card.id}>
                  {showDropBefore && (
                    <div className="bb-grid__drop-placeholder" style={{ minHeight: 120 * gridZoom }} />
                  )}
                  <div
                    onMouseEnter={(e) => handleCardMouseEnter(e, card)}
                    onMouseLeave={() => gridDropIdx !== null && setGridDropIdx(null)}
                    onMouseUp={() => handleCardMouseUp(card)}
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
                      style={{ fontSize: `${gridZoom * 100}%` }}
                    />
                  </div>
                </React.Fragment>
              );
            })}
            {group.cards.length === 0 && (
              <div style={{ padding: 20, color: 'var(--bb-text-muted)', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }}>
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

          <button className="bb-context-menu__item" onClick={() => { onToggleCut(contextMenu.card.id); closeContextMenu(); }}>
            {contextMenu.card.timelineIndex !== null ? '\u2702 UNCUT' : '\uD83C\uDFAC CUT'}
          </button>
          <div className="bb-context-menu__separator" />

          <button className="bb-context-menu__item bb-context-menu__item--danger" onClick={() => { onDeleteCard(contextMenu.card.id); closeContextMenu(); }}>
            {'\u2716'} {t('delete') || 'Supprimer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BeatBoardGridView;
