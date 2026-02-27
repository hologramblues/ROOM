import React, { useState, useRef, useCallback } from 'react';

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

  // Build blocks grouped by structure beats
  const sortedBeats = [...structureBeats].sort((a, b) => {
    const aCard = timelineCards.find(c => c.linkedSceneId === a.startSceneId);
    const bCard = timelineCards.find(c => c.linkedSceneId === b.startSceneId);
    return (aCard?.startPage || 0) - (bCard?.startPage || 0);
  });

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

  return (
    <div className={`bb-scene-strip ${collapsed ? 'bb-scene-strip--collapsed' : ''}`}>
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
          ) : (
            timelineCards.map((card, idx) => {
              const fullCard = beatCards.find(c => c.id === card.id);
              const isWhite = card.color === '#ffffff';
              const blockBg = isWhite ? (darkMode ? '#555' : '#d1d5db') : card.color;
              const textColor = isWhite ? (darkMode ? 'white' : '#374151') : 'white';
              const isDragging = dragId === card.id;
              const draggedIdx = dragId ? timelineCards.findIndex(c => c.id === dragId) : -1;
              const showDropBefore = dropIndex === idx && dragId && draggedIdx !== idx && draggedIdx !== idx - 1;
              const showDropAfter = dropIndex === idx + 1 && dragId && draggedIdx !== idx && draggedIdx !== idx + 1;
              const blockWidth = Math.max(40, (card.pages || 0.5) * 60);

              // Check if a structure divider should appear before this card
              let dividerBeat = null;
              if (sortedBeats.length > 0) {
                const beat = sortedBeats.find(b => b.startSceneId === card.linkedSceneId);
                if (beat && idx > 0) dividerBeat = beat;
                if (beat && idx === 0) dividerBeat = beat; // Show label for first beat too
              }

              return (
                <React.Fragment key={card.id}>
                  {/* Structure divider */}
                  {dividerBeat && (
                    <>
                      {idx > 0 && <div className="bb-scene-strip__divider" />}
                      <span className="bb-scene-strip__divider-label">{dividerBeat.label}</span>
                    </>
                  )}

                  {/* Drop indicator before */}
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

                  {/* Drop indicator after */}
                  {showDropAfter && <div className="bb-scene-strip__drop-indicator" />}
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default BeatBoardSceneStrip;
