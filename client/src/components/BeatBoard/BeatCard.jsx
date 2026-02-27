import React, { useState, useRef, useEffect } from 'react';

const statusColors = { done: '#22c55e', progress: '#3b82f6', urgent: '#ef4444' };
const statusIcons = { done: '\u2713', progress: '\u25D0', urgent: '!' };

const BeatCard = React.memo(({
  card,
  sceneNum,
  isSelected,
  isDragging,
  onMouseDown,
  onContextMenu,
  onDoubleClick,
  onToggleCut,
  onUpdateSynopsis,
  inlineEditing = false,
  style,
}) => {
  const isCut = card.timelineIndex !== null;
  const isNote = card.type === 'note';
  const hasColor = card.color && card.color !== '#ffffff';

  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [synopsisValue, setSynopsisValue] = useState(card.synopsis || '');
  const textareaRef = useRef(null);

  useEffect(() => { setSynopsisValue(card.synopsis || ''); }, [card.synopsis]);

  useEffect(() => {
    if (editingSynopsis && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editingSynopsis]);

  const handleSynopsisDoubleClick = (e) => {
    if (!inlineEditing) return;
    e.stopPropagation();
    setEditingSynopsis(true);
  };

  const handleSynopsisBlur = () => {
    setEditingSynopsis(false);
    if (synopsisValue !== (card.synopsis || '')) {
      onUpdateSynopsis?.(card.id, synopsisValue);
    }
  };

  const handleSynopsisKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSynopsisValue(card.synopsis || '');
      setEditingSynopsis(false);
    }
  };

  return (
    <div
      className={[
        'bb-card',
        isSelected && 'bb-card--selected',
        isDragging && 'bb-card--dragging',
        !isCut && !isNote && 'bb-card--uncut',
      ].filter(Boolean).join(' ')}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onDoubleClick={editingSynopsis ? undefined : onDoubleClick}
      style={style}
    >
      {/* Color bar */}
      {hasColor && (
        <div className="bb-card__color-bar" style={{ background: card.color }} />
      )}

      <div className="bb-card__body">
        {/* Header: scene number + status */}
        <div className="bb-card__header">
          <span className="bb-card__scene-num">
            {isNote ? '\uD83D\uDCDD' : sceneNum ? `Scene #${sceneNum}` : ''}
          </span>
          <div className="bb-card__status">
            {card.status && (
              <span
                className="bb-card__status-badge"
                style={{ background: statusColors[card.status] }}
              >
                {statusIcons[card.status]}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="bb-card__title">{card.title}</div>

        {/* Synopsis */}
        {editingSynopsis ? (
          <textarea
            ref={textareaRef}
            className="bb-card__synopsis-input"
            value={synopsisValue}
            onChange={(e) => setSynopsisValue(e.target.value)}
            onBlur={handleSynopsisBlur}
            onKeyDown={handleSynopsisKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="bb-card__synopsis"
            onDoubleClick={handleSynopsisDoubleClick}
          >
            {card.synopsis || (isNote ? 'Double-clic pour editer' : 'Double-clic pour ajouter un resume')}
          </div>
        )}

        {/* Footer */}
        <div className="bb-card__footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {card.linkedSceneId && <span className="bb-card__linked-icon">\uD83D\uDD17</span>}
          </div>

          {!isNote && (
            <button
              className={`bb-card__cut-badge ${isCut ? 'bb-card__cut-badge--cut' : 'bb-card__cut-badge--uncut'}`}
              onClick={(e) => { e.stopPropagation(); onToggleCut?.(card.id); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isCut ? '\uD83C\uDFAC CUT' : 'UNCUT'}
            </button>
          )}

          <div />
        </div>
      </div>

      {/* Delete button */}
      <button
        className="bb-card__delete-btn"
        onClick={(e) => { e.stopPropagation(); onContextMenu?.({ ...e, _deleteAction: true }); }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        \u00D7
      </button>
    </div>
  );
});

export default BeatCard;
