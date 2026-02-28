import React from 'react';

const BeatBoardToolbar = ({
  viewMode,
  setViewMode,
  timelineSyncMode,
  setTimelineSyncMode,
  hasTimelineChanges,
  setHasTimelineChanges,
  onAddCard,
  onAddNote,
  onApplyToScript,
  onExportSVG,
  timelineCards,
  beatCards,
  totalPages,
  t,
}) => {
  const cutCount = timelineCards.length;

  return (
    <div className="bb-toolbar">
      {/* View switcher */}
      <div className="bb-toolbar__view-switcher">
        <button
          className={`bb-toolbar__view-btn ${viewMode === 'grid' ? 'bb-toolbar__view-btn--active' : ''}`}
          onClick={() => setViewMode('grid')}
        >
          {t('gridView') || 'Grille'}
        </button>
        <button
          className={`bb-toolbar__view-btn ${viewMode === 'canvas' ? 'bb-toolbar__view-btn--active' : ''}`}
          onClick={() => setViewMode('canvas')}
        >
          {t('canvasView') || 'Canvas'}
        </button>
      </div>

      {/* Add buttons */}
      <button className="bb-toolbar__add-btn" onClick={onAddCard}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> {t('card') || 'Carte'}
      </button>
      <button
        className="bb-toolbar__add-btn"
        onClick={onAddNote}
        style={{ background: 'var(--bb-bg)', color: 'var(--bb-text-primary)', border: '1px solid var(--bb-card-border)' }}
      >
        {'\uD83D\uDCDD'} {t('note') || 'Note'}
      </button>

      {/* Live/Staging toggle */}
      <div className="bb-toolbar__mode-toggle">
        <button
          className={`bb-toolbar__mode-btn ${timelineSyncMode === 'live' ? 'bb-toolbar__mode-btn--live' : ''}`}
          onClick={() => { setTimelineSyncMode('live'); setHasTimelineChanges(false); }}
          title={t('liveMode') || 'Synchronisation automatique avec le script'}
        >
          Live
        </button>
        <button
          className={`bb-toolbar__mode-btn ${timelineSyncMode === 'staging' ? 'bb-toolbar__mode-btn--staging' : ''}`}
          onClick={() => setTimelineSyncMode('staging')}
          title={t('stagingMode') || 'Mode brouillon'}
        >
          {t('draft') || 'Brouillon'}
        </button>
      </div>

      {/* Apply button (staging mode with changes) */}
      {timelineSyncMode === 'staging' && hasTimelineChanges && (
        <button className="bb-toolbar__apply-btn" onClick={onApplyToScript}>
          {'\u2713'} {t('applyToScript') || 'Appliquer au script'}
        </button>
      )}

      {/* Stats */}
      <div className="bb-toolbar__stats">
        <span>{cutCount} {t('scenes') || 'scenes'}</span>
        <span style={{ color: 'var(--bb-text-muted)' }}>{'\u00B7'}</span>
        <span>{totalPages.toFixed(0)}p</span>
        <span style={{ color: 'var(--bb-text-muted)' }}>{'\u00B7'}</span>
        <span>{cutCount} CUT</span>
      </div>

      {/* Actions */}
      <div className="bb-toolbar__actions">
        {timelineCards.filter(c => c.linkedSceneId).length > 0 && timelineSyncMode === 'live' && (
          <button
            onClick={onApplyToScript}
            style={{ padding: '4px 10px', background: '#22c55e', border: 'none', borderRadius: 4, color: 'white', fontSize: 10, fontWeight: 500, cursor: 'pointer' }}
          >
            {t('applyToScript') || 'Appliquer'}
          </button>
        )}
        <button
          onClick={onExportSVG}
          style={{ padding: '4px 8px', background: 'var(--bb-bg)', border: '1px solid var(--bb-card-border)', borderRadius: 4, color: 'var(--bb-text-secondary)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          title={t('exportSVG') || 'Exporter en SVG'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          SVG
        </button>
      </div>
    </div>
  );
};

export default BeatBoardToolbar;
