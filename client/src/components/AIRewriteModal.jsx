import React from 'react';

export default function AIRewriteModal({
  aiRewriteSelection, aiRewriteResult, aiRewriteLoading,
  aiRewriteTone, setAiRewriteTone,
  aiRewriteCustomPrompt, setAiRewriteCustomPrompt,
  aiRewriteMode, setAiRewriteMode,
  onRewrite, onApply, onClose, onResetResult,
  darkMode
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: darkMode ? '#333333' : 'white',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : '#333333', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6b7280', fontWeight: 700 }}>IA</span> Réécrire avec l'IA
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer' }}
          >✕</button>
        </div>

        {/* Original text */}
        <div style={{
          background: darkMode ? '#484848' : '#f3f4f6',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: darkMode ? '#d1d5db' : '#555555',
          fontStyle: 'italic',
          borderLeft: '3px solid #3b82f6'
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#3b82f6', marginBottom: 6, fontWeight: 600 }}>Texte sélectionné</div>
          "{aiRewriteSelection.text}"
        </div>

        {/* Mode selection - only show if no result yet */}
        {!aiRewriteResult && !aiRewriteLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>Que voulez-vous faire ?</div>

            <button
              onClick={() => { setAiRewriteMode('concis'); onRewrite('concis'); }}
              style={{
                padding: '12px 16px',
                background: darkMode ? '#484848' : '#f9fafb',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                borderRadius: 8,
                color: darkMode ? 'white' : '#333333',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
            >
              <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span> <strong>Plus concis</strong>
              <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Raccourcir et aller à l'essentiel</div>
            </button>

            <button
              onClick={() => { setAiRewriteMode('develop'); onRewrite('develop'); }}
              style={{
                padding: '12px 16px',
                background: darkMode ? '#484848' : '#f9fafb',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                borderRadius: 8,
                color: darkMode ? 'white' : '#333333',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
            >
              <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span> <strong>Développer</strong>
              <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Enrichir avec plus de détails</div>
            </button>

            <button
              onClick={() => { setAiRewriteMode('reformulate'); onRewrite('reformulate'); }}
              style={{
                padding: '12px 16px',
                background: darkMode ? '#484848' : '#f9fafb',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                borderRadius: 8,
                color: darkMode ? 'white' : '#333333',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 14,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#484848' : '#f9fafb'; e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb'; }}
            >
              <span style={{ marginRight: 8, display: 'inline-flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span> <strong>Reformuler</strong>
              <div style={{ fontSize: 11, color: darkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>Dire la même chose autrement</div>
            </button>

            {/* Tone selector */}
            <div style={{
              padding: '12px 16px',
              background: darkMode ? '#484848' : '#f9fafb',
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ marginRight: 8 }}>🎭</span> <strong style={{ color: darkMode ? 'white' : '#333333', fontSize: 14 }}>Changer le ton</strong>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['dramatique', 'comique', 'poétique', 'tendu', 'mélancolique', 'cynique'].map(tone => (
                  <button
                    key={tone}
                    onClick={() => { setAiRewriteTone(tone); setAiRewriteMode('tone'); onRewrite('tone'); }}
                    style={{
                      padding: '6px 12px',
                      background: darkMode ? '#333333' : 'white',
                      border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`,
                      borderRadius: 16,
                      color: darkMode ? '#d1d5db' : '#555555',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = darkMode ? '#333333' : 'white'; e.currentTarget.style.color = darkMode ? '#d1d5db' : '#555555'; e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#d1d5db'; }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div style={{
              padding: '12px 16px',
              background: darkMode ? '#484848' : '#f9fafb',
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ marginRight: 8 }}>✍️</span> <strong style={{ color: darkMode ? 'white' : '#333333', fontSize: 14 }}>Instruction libre</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={aiRewriteCustomPrompt}
                  onChange={e => setAiRewriteCustomPrompt(e.target.value)}
                  placeholder="Ex: Rends ce dialogue plus naturel..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: darkMode ? '#333333' : 'white',
                    border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`,
                    borderRadius: 6,
                    color: darkMode ? 'white' : '#333333',
                    fontSize: 13
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); onRewrite('custom', aiRewriteCustomPrompt); } }}
                />
                <button
                  onClick={() => { if (aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); onRewrite('custom', aiRewriteCustomPrompt); } }}
                  disabled={!aiRewriteCustomPrompt.trim()}
                  style={{
                    padding: '8px 16px',
                    background: aiRewriteCustomPrompt.trim() ? '#3b82f6' : (darkMode ? '#555555' : '#e5e7eb'),
                    border: 'none',
                    borderRadius: 6,
                    color: aiRewriteCustomPrompt.trim() ? 'white' : (darkMode ? '#9ca3af' : '#9ca3af'),
                    cursor: aiRewriteCustomPrompt.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {aiRewriteLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid transparent',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>L'IA réfléchit...</div>
          </div>
        )}

        {/* Result */}
        {aiRewriteResult && !aiRewriteLoading && (
          <div>
            <div style={{
              background: aiRewriteResult.startsWith('❌') ? (darkMode ? '#7f1d1d' : '#fef2f2') : (darkMode ? '#4a4a4a' : '#eff6ff'),
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              borderLeft: `3px solid ${aiRewriteResult.startsWith('❌') ? '#ef4444' : '#3b82f6'}`
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: aiRewriteResult.startsWith('❌') ? '#ef4444' : '#3b82f6', marginBottom: 8, fontWeight: 600 }}>
                {aiRewriteResult.startsWith('❌') ? 'Erreur' : 'Proposition de l\'IA'}
              </div>
              <div style={{
                color: darkMode ? 'white' : '#333333',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}>
                {aiRewriteResult}
              </div>
            </div>

            {/* Actions */}
            {!aiRewriteResult.startsWith('❌') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onApply}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  ✓ Appliquer
                </button>
                <button
                  onClick={() => onRewrite(aiRewriteMode, aiRewriteMode === 'custom' ? aiRewriteCustomPrompt : '')}
                  style={{
                    padding: '12px 16px',
                    background: darkMode ? '#484848' : '#f3f4f6',
                    border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                    borderRadius: 8,
                    color: darkMode ? 'white' : '#333333',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  🔄 Régénérer
                </button>
                <button
                  onClick={onResetResult}
                  style={{
                    padding: '12px 16px',
                    background: 'transparent',
                    border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                    borderRadius: 8,
                    color: darkMode ? '#9ca3af' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  ← Retour
                </button>
              </div>
            )}

            {aiRewriteResult.startsWith('❌') && (
              <button
                onClick={() => { setAiRewriteMode(null); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: darkMode ? '#484848' : '#f3f4f6',
                  border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                  borderRadius: 8,
                  color: darkMode ? 'white' : '#333333',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                ← Réessayer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
