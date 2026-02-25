import React from 'react';

export default function ContextActionMenu({
  contextMenuTop, showOutline, showComments,
  canComment, scriptHasFocus, textSelection, selectedRange,
  elements, activeIndex, stripHtml,
  onComment, onSuggest, onAIRewrite, t
}) {
  if (!canComment) return null;
  if (!scriptHasFocus && !textSelection && !selectedRange) return null;
  if (contextMenuTop === null) return null;

  const hasSelection = textSelection && textSelection.text;
  const currentElement = elements[activeIndex];

  // Calculate horizontal position - overlay on script edge
  const scriptWidth = 793;
  const viewportCenter = window.innerWidth / 2;
  const outlineOffset = showOutline ? 175 : 0;
  const commentsOffset = showComments ? 160 : 0;
  const scriptCenter = viewportCenter + outlineOffset - commentsOffset;
  const scriptRightEdge = scriptCenter + (scriptWidth / 2);
  const menuRight = window.innerWidth - scriptRightEdge - 24;

  const clampedTop = Math.max(80, Math.min(window.innerHeight - 120, contextMenuTop));

  return (
    <div
      className="context-action-menu"
      style={{
        position: 'fixed',
        right: Math.max(showComments ? 340 : 20, menuRight),
        top: clampedTop,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        zIndex: 1000,
        background: 'white',
        borderRadius: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        padding: 6,
        border: '1px solid #e0e0e0'
      }}
    >
      {/* Comment button */}
      <button
        onClick={() => onComment({ hasSelection, currentElement })}
        className="floating-action-btn"
        data-tooltip={t('comment')}
        style={{
          width: 36, height: 36, background: 'transparent', border: 'none',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.15s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <line x1="9" y1="11" x2="15" y2="11" />
        </svg>
      </button>

      {/* Suggestion button */}
      <button
        onClick={() => onSuggest({ hasSelection, currentElement })}
        className="floating-action-btn"
        data-tooltip={t('suggest')}
        style={{
          width: 36, height: 36, background: 'transparent', border: 'none',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.15s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {/* AI Rewrite button */}
      <button
        onClick={() => onAIRewrite({ hasSelection, currentElement })}
        className="floating-action-btn"
        data-tooltip={t('rewriteWithAI')}
        style={{
          width: 36, height: 36, background: 'transparent', border: 'none',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.15s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>
    </div>
  );
}
