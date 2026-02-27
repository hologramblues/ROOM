import React, { useState, useEffect } from 'react';

const cardColors = ['#ffffff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const statuses = [
  { value: null, label: 'Aucun', icon: '\u25CB' },
  { value: 'progress', label: 'En cours', icon: '\u25D0', bg: '#3b82f6' },
  { value: 'done', label: 'Termine', icon: '\u2713', bg: '#22c55e' },
  { value: 'urgent', label: 'Urgent', icon: '!', bg: '#ef4444' },
];

const BeatCardEditModal = ({
  card,
  darkMode,
  beatCards,
  onUpdateCard,
  onToggleCut,
  onClose,
  setBeatCards,
  t,
}) => {
  const [localCard, setLocalCard] = useState(card);

  useEffect(() => { setLocalCard(card); }, [card]);

  if (!card) return null;

  const update = (updates) => {
    setLocalCard(prev => ({ ...prev, ...updates }));
    onUpdateCard(card.id, updates);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: darkMode ? '#2a2a2a' : 'white', borderRadius: 12, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
      >
        <div style={{ height: 8, background: localCard.color }} />
        <div style={{ padding: 20 }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
              {localCard.linkedSceneId ? (t('sceneLinked') || 'Scene (liee au script)') : (t('title') || 'Titre')}
            </label>
            {localCard.linkedSceneId ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? 'white' : 'black', padding: '8px 12px', background: darkMode ? '#1a1a1a' : '#f3f4f6', borderRadius: 6 }}>
                  {localCard.title}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  {t('titleFromScript') || 'Le titre vient du script. Modifiez-le dans l\'editeur de script.'}
                </div>
              </>
            ) : (
              <input
                value={localCard.title}
                onChange={(e) => update({ title: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, fontWeight: 600, border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 6, background: darkMode ? '#1a1a1a' : 'white', color: darkMode ? 'white' : 'black', outline: 'none', boxSizing: 'border-box' }}
              />
            )}
          </div>

          {/* Synopsis */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
              {t('sceneSummary') || 'Resume de la scene'}
            </label>
            <textarea
              autoFocus
              value={localCard.synopsis || ''}
              onChange={(e) => update({ synopsis: e.target.value })}
              placeholder={t('synopsisPlaceholder') || 'Decrivez cette scene en une phrase...'}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 6, background: darkMode ? '#1a1a1a' : 'white', color: darkMode ? 'white' : 'black', outline: 'none', resize: 'vertical', minHeight: 80, lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          </div>

          {/* CUT/UNCUT */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>{t('montage') || 'Montage'}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (localCard.timelineIndex === null) {
                    const maxIdx = Math.max(-1, ...beatCards.filter(c => c.timelineIndex !== null && c.id !== card.id).map(c => c.timelineIndex));
                    const newIndex = maxIdx + 1;
                    setLocalCard(prev => ({ ...prev, timelineIndex: newIndex }));
                    setBeatCards(prev => prev.map(c => c.id === card.id ? { ...c, timelineIndex: Math.max(-1, ...prev.filter(cc => cc.timelineIndex !== null && cc.id !== card.id).map(cc => cc.timelineIndex)) + 1 } : c));
                  }
                }}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 6,
                  border: localCard.timelineIndex !== null ? '2px solid #22c55e' : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                  background: localCard.timelineIndex !== null ? '#22c55e20' : 'transparent',
                  color: darkMode ? 'white' : 'black', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span>\uD83C\uDFAC</span> CUT {localCard.timelineIndex !== null && '\u2713'}
              </button>
              <button
                onClick={() => {
                  setLocalCard(prev => ({ ...prev, timelineIndex: null }));
                  setBeatCards(prev => prev.map(c => c.id === card.id ? { ...c, timelineIndex: null } : c));
                }}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 6,
                  border: localCard.timelineIndex === null ? `2px solid ${darkMode ? '#555' : '#9ca3af'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                  background: localCard.timelineIndex === null ? (darkMode ? '#55555530' : '#9ca3af20') : 'transparent',
                  color: darkMode ? 'white' : 'black', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                UNCUT {localCard.timelineIndex === null && '\u2713'}
              </button>
            </div>
          </div>

          {/* Color picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>{t('color') || 'Couleur'}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {cardColors.map(color => (
                <button
                  key={color}
                  onClick={() => update({ color })}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: color,
                    border: localCard.color === color ? '3px solid white' : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                    boxShadow: localCard.color === color ? `0 0 0 2px ${color === '#ffffff' ? '#3b82f6' : color}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>{t('status') || 'Statut'}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {statuses.map(status => (
                <button
                  key={status.value || 'none'}
                  onClick={() => update({ status: status.value })}
                  style={{
                    padding: '6px 12px', borderRadius: 6,
                    border: localCard.status === status.value ? `2px solid ${status.bg || '#6b7280'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                    background: localCard.status === status.value ? (status.bg ? `${status.bg}20` : 'transparent') : 'transparent',
                    color: darkMode ? 'white' : 'black', fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ color: status.bg || '#6b7280' }}>{status.icon}</span>
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Close */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              {t('close') || 'Fermer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeatCardEditModal;
