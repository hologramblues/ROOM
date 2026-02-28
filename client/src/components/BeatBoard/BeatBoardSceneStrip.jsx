import React, { useState, useRef, useCallback, useMemo } from 'react';

const BeatBoardSceneStrip = ({
  sceneMetrics,
  structureBeats,
  beatCards,
  elements,
  darkMode,
  onReorderTimeline,
  onDoubleClickCard,
  t,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const scrollRef = useRef(null);

  const timelineCards = sceneMetrics.cards;

  // Sort structure beats by their position in the timeline
  const sortedBeats = useMemo(() =>
    [...structureBeats].sort((a, b) => {
      const aCard = timelineCards.find(c => c.linkedSceneId === a.startSceneId);
      const bCard = timelineCards.find(c => c.linkedSceneId === b.startSceneId);
      return (aCard?.startPage || 0) - (bCard?.startPage || 0);
    }), [structureBeats, timelineCards]);

  // Group cards by structure beats for bracket rendering
  const groups = useMemo(() => {
    if (sortedBeats.length === 0 || timelineCards.length === 0) return null;

    const beatStartIndices = sortedBeats
      .map(beat => ({
        beat,
        startIdx: timelineCards.findIndex(c => c.linkedSceneId === beat.startSceneId),
      }))
      .filter(item => item.startIdx !== -1)
      .sort((a, b) => a.startIdx - b.startIdx);

    if (beatStartIndices.length === 0) return null;

    const result = [];

    // Cards before first beat (ungrouped)
    if (beatStartIndices[0].startIdx > 0) {
      result.push({
        beat: null,
        cards: timelineCards.slice(0, beatStartIndices[0].startIdx),
      });
    }

    // Each beat range
    beatStartIndices.forEach((item, i) => {
      const endIdx = i < beatStartIndices.length - 1
        ? beatStartIndices[i + 1].startIdx
        : timelineCards.length;
      result.push({
        beat: item.beat,
        cards: timelineCards.slice(item.startIdx, endIdx),
      });
    });

    return result;
  }, [sortedBeats, timelineCards]);

  const handleMouseDown = useCallback((e, cardId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragId(cardId);
    setDropIndex(null);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragId || !scrollRef.current) return;
    const blocks = scrollRef.current.querySelectorAll('[data-strip-block]');
    let foundIndex = null;
    blocks.forEach((block, idx) => {
      const rect = block.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        foundIndex = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
      }
    });
    if (foundIndex === null && blocks.length > 0) {
      const lastRect = blocks[blocks.length - 1].getBoundingClientRect();
      if (e.clientX > lastRect.right) foundIndex = blocks.length;
      else if (e.clientX < blocks[0].getBoundingClientRect().left) foundIndex = 0;
    }
    if (foundIndex !== null) setDropIndex(foundIndex);
  }, [dragId]);

  const handleMouseUp = useCallback(() => {
    if (dragId && dropIndex !== null) {
      const draggedIdx = timelineCards.findIndex(c => c.id === dragId);
      if (draggedIdx !== -1 && draggedIdx !== dropIndex && draggedIdx !== dropIndex - 1) {
        onReorderTimeline(dragId, draggedIdx, dropIndex);
      }
    }
    setDragId(null);
    setDropIndex(null);
  }, [dragId, dropIndex, timelineCards, onReorderTimeline]);

  // Render a single scene block (shared between flat and grouped layouts)
  const renderBlock = (card, globalIdx) => {
    const fullCard = beatCards.find(c => c.id === card.id);
    const isWhite = card.color === '#ffffff';
    const blockBg = isWhite ? (darkMode ? '#555' : '#d1d5db') : card.color;
    const textColor = isWhite ? (darkMode ? 'white' : '#374151') : 'white';
    const isDragging = dragId === card.id;
    const draggedIdx = dragId ? timelineCards.findIndex(c => c.id === dragId) : -1;
    const showDropBefore = dropIndex === globalIdx && dragId && draggedIdx !== globalIdx && draggedIdx !== globalIdx - 1;
    const showDropAfter = dropIndex === globalIdx + 1 && dragId && draggedIdx !== globalIdx && draggedIdx !== globalIdx + 1;
    const blockWidth = Math.max(40, (card.pages || 0.5) * 60);

    return (
      <React.Fragment key={card.id}>
        {showDropBefore && <div className="bb-scene-strip__drop-indicator" />}
        <div
          data-strip-block={card.id}
          className={`bb-scene-strip__block ${isDragging ? 'bb-scene-strip__block--dragging' : ''}`}
          style={{
            width: blockWidth,
            background: isDragging ? 'var(--bb-accent)' : blockBg,
            color: isDragging ? 'white' : textColor,
            textShadow: isWhite && !isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.3)',
          }}
          onMouseDown={(e) => handleMouseDown(e, card.id)}
          onDoubleClick={() => onDoubleClickCard(fullCard || card)}
          title={card.title}
        >
          {blockWidth > 50 ? card.title.replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '').substring(0, 15) : ''}
        </div>
        {showDropAfter && <div className="bb-scene-strip__drop-indicator" />}
      </React.Fragment>
    );
  };

  const hasGroups = !!groups;

  return (
    <div className={`bb-scene-strip ${collapsed ? 'bb-scene-strip--collapsed' : ''} ${hasGroups ? 'bb-scene-strip--has-brackets' : ''}`}>
      <button
        className="bb-scene-strip__toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? (t('showStrip') || 'Afficher la bande') : (t('hideStrip') || 'Masquer la bande')}
      >
        {collapsed ? '\u25B2' : '\u25BC'}
      </button>

      {!collapsed && (
        <div
          ref={scrollRef}
          className="bb-scene-strip__scroll"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setDragId(null); setDropIndex(null); }}
        >
          {timelineCards.length === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--bb-text-muted)', fontStyle: 'italic', padding: '0 8px' }}>
              {t('emptyTimeline') || 'Aucune scene dans le montage'}
            </span>
          ) : hasGroups ? (
            /* Grouped layout with brackets above scene blocks */
            (() => {
              let globalIdx = 0;
              return groups.map((group, gIdx) => (
                <div key={gIdx} className="bb-scene-strip__group">
                  {group.beat && (
                    <div
                      className="bb-scene-strip__bracket"
                      style={{
                        borderColor: group.beat.color || 'var(--bb-accent)',
                        color: group.beat.color || 'var(--bb-accent)',
                      }}
                    >
                      {group.beat.label}
                    </div>
                  )}
                  <div className="bb-scene-strip__group-blocks">
                    {group.cards.map((card) => {
                      const idx = globalIdx++;
                      return renderBlock(card, idx);
                    })}
                  </div>
                </div>
              ));
            })()
          ) : (
            /* Flat layout — no structure beats */
            timelineCards.map((card, idx) => renderBlock(card, idx))
          )}
        </div>
      )}
    </div>
  );
};

export default BeatBoardSceneStrip;
