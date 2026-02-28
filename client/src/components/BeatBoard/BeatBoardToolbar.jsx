import React, { useState, useRef, useEffect } from 'react';

const STRUCTURE_PRESETS = [
  {
    id: '3acts',
    beats: [
      { label: 'Acte I', pct: 0, color: '#3b82f6' },
      { label: 'Acte II', pct: 0.25, color: '#f59e0b' },
      { label: 'Acte III', pct: 0.75, color: '#ef4444' },
    ],
  },
  {
    id: '4acts',
    beats: [
      { label: 'Acte I', pct: 0, color: '#3b82f6' },
      { label: 'Acte II', pct: 0.25, color: '#22c55e' },
      { label: 'Acte III', pct: 0.5, color: '#f59e0b' },
      { label: 'Acte IV', pct: 0.75, color: '#ef4444' },
    ],
  },
  {
    id: '5acts',
    beats: [
      { label: 'Exposition', pct: 0, color: '#3b82f6' },
      { label: 'Action montante', pct: 0.2, color: '#22c55e' },
      { label: 'Climax', pct: 0.4, color: '#f59e0b' },
      { label: 'Action descendante', pct: 0.6, color: '#ef4444' },
      { label: 'Dénouement', pct: 0.8, color: '#8b5cf6' },
    ],
  },
  {
    id: 'savethecat',
    beats: [
      { label: 'Opening Image', pct: 0, color: '#3b82f6' },
      { label: 'Theme Stated', pct: 0.05, color: '#3b82f6' },
      { label: 'Set-Up', pct: 0.08, color: '#3b82f6' },
      { label: 'Catalyst', pct: 0.10, color: '#3b82f6' },
      { label: 'Debate', pct: 0.12, color: '#3b82f6' },
      { label: 'Break into Two', pct: 0.25, color: '#f59e0b' },
      { label: 'B Story', pct: 0.28, color: '#f59e0b' },
      { label: 'Fun & Games', pct: 0.30, color: '#f59e0b' },
      { label: 'Midpoint', pct: 0.50, color: '#f59e0b' },
      { label: 'Bad Guys Close In', pct: 0.55, color: '#f59e0b' },
      { label: 'All Is Lost', pct: 0.62, color: '#f59e0b' },
      { label: 'Dark Night of the Soul', pct: 0.65, color: '#ef4444' },
      { label: 'Break into Three', pct: 0.75, color: '#ef4444' },
      { label: 'Finale', pct: 0.80, color: '#ef4444' },
      { label: 'Final Image', pct: 0.95, color: '#ef4444' },
    ],
  },
  {
    id: 'herosjourney',
    beats: [
      { label: 'Monde ordinaire', pct: 0, color: '#3b82f6' },
      { label: "Appel de l'aventure", pct: 0.08, color: '#3b82f6' },
      { label: 'Refus de l\'appel', pct: 0.12, color: '#22c55e' },
      { label: 'Rencontre du mentor', pct: 0.17, color: '#22c55e' },
      { label: 'Passage du seuil', pct: 0.25, color: '#f59e0b' },
      { label: 'Épreuves, alliés, ennemis', pct: 0.35, color: '#f59e0b' },
      { label: 'Approche du cœur', pct: 0.50, color: '#ef4444' },
      { label: 'Épreuve suprême', pct: 0.58, color: '#ef4444' },
      { label: 'Récompense', pct: 0.67, color: '#8b5cf6' },
      { label: 'Chemin du retour', pct: 0.75, color: '#8b5cf6' },
      { label: 'Résurrection', pct: 0.85, color: '#8b5cf6' },
      { label: "Retour avec l'élixir", pct: 0.92, color: '#8b5cf6' },
    ],
  },
  {
    id: '8sequences',
    beats: [
      { label: 'Séquence 1', pct: 0, color: '#3b82f6' },
      { label: 'Séquence 2', pct: 0.125, color: '#22c55e' },
      { label: 'Séquence 3', pct: 0.25, color: '#f59e0b' },
      { label: 'Séquence 4', pct: 0.375, color: '#ef4444' },
      { label: 'Séquence 5', pct: 0.5, color: '#3b82f6' },
      { label: 'Séquence 6', pct: 0.625, color: '#22c55e' },
      { label: 'Séquence 7', pct: 0.75, color: '#f59e0b' },
      { label: 'Séquence 8', pct: 0.875, color: '#ef4444' },
    ],
  },
];

export { STRUCTURE_PRESETS };

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
  onApplyPreset,
  onClearStructure,
  structureBeats,
  timelineCards,
  beatCards,
  totalPages,
  t,
}) => {
  const cutCount = timelineCards.length;
  const [structMenuOpen, setStructMenuOpen] = useState(false);
  const structMenuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    if (!structMenuOpen) return;
    const handleClick = (e) => {
      if (structMenuRef.current && !structMenuRef.current.contains(e.target)) {
        setStructMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [structMenuOpen]);

  const presetNames = {
    '3acts': { fr: '3 Actes (Classique)', en: '3 Acts (Classic)' },
    '4acts': { fr: '4 Actes (TV)', en: '4 Acts (TV)' },
    '5acts': { fr: '5 Actes (Shakespeare)', en: '5 Acts (Shakespeare)' },
    'savethecat': { fr: 'Save the Cat (Blake Snyder)', en: 'Save the Cat (Blake Snyder)' },
    'herosjourney': { fr: 'Le Voyage du Héros', en: "The Hero's Journey" },
    '8sequences': { fr: '8 Séquences', en: '8 Sequences' },
  };
  const presetDescs = {
    '3acts': { fr: 'Setup, Confrontation, Résolution', en: 'Setup, Confrontation, Resolution' },
    '4acts': { fr: 'Actes I-IV (format TV)', en: 'Acts I-IV (TV format)' },
    '5acts': { fr: 'Exposition → Dénouement', en: 'Exposition → Denouement' },
    'savethecat': { fr: '15 beats (Opening Image → Final Image)', en: '15 beats (Opening Image → Final Image)' },
    'herosjourney': { fr: '12 étapes (Campbell)', en: '12 stages (Campbell)' },
    '8sequences': { fr: 'Séquences 1-8 (12.5% chaque)', en: 'Sequences 1-8 (12.5% each)' },
  };

  const lang = t('gridView') === 'Grid' ? 'en' : 'fr';

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

      {/* Structure presets */}
      <div ref={structMenuRef} style={{ position: 'relative' }}>
        <button
          className="bb-toolbar__add-btn"
          onClick={() => setStructMenuOpen(v => !v)}
          style={{
            background: structureBeats.length > 0 ? 'var(--bb-accent)' : 'var(--bb-bg)',
            color: structureBeats.length > 0 ? 'white' : 'var(--bb-text-primary)',
            border: structureBeats.length > 0 ? 'none' : '1px solid var(--bb-card-border)',
          }}
        >
          {t('structure') || 'Structure'}
          <span style={{ fontSize: 8, marginLeft: 4 }}>{structMenuOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {structMenuOpen && (
          <div className="bb-structure-menu">
            {STRUCTURE_PRESETS.map(preset => (
              <button
                key={preset.id}
                className="bb-structure-menu__item"
                onClick={() => { onApplyPreset(preset.id); setStructMenuOpen(false); }}
              >
                <span className="bb-structure-menu__item-name">
                  {presetNames[preset.id]?.[lang] || preset.id}
                </span>
                <span className="bb-structure-menu__item-desc">
                  {presetDescs[preset.id]?.[lang] || ''}
                </span>
                <span className="bb-structure-menu__item-dots">
                  {preset.beats.map((b, i) => (
                    <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                  ))}
                </span>
              </button>
            ))}
            {structureBeats.length > 0 && (
              <>
                <div className="bb-context-menu__separator" />
                <button
                  className="bb-structure-menu__item bb-structure-menu__item--danger"
                  onClick={() => { onClearStructure(); setStructMenuOpen(false); }}
                >
                  {t('clearStructure') || 'Supprimer la structure'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
