import React, { useState } from 'react';

const NoteEditorModal = ({ elementId, note, onSave, onPushToComment, onClose, darkMode, canPush, position, onDragStart, t = (k) => k }) => {
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || '#fef3c7');
  const colors = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#f3e8ff'];

  return (
    <div
      style={{
        position: 'fixed',
        left: position?.x || '50%',
        top: position?.y || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        background: darkMode ? '#333333' : 'white',
        borderRadius: 12,
        width: 380,
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        zIndex: 500,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: darkMode ? '#484848' : '#f3f4f6',
          cursor: 'move',
          userSelect: 'none'
        }}
        onMouseDown={onDragStart}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Note personnelle</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Votre note (visible uniquement par vous)..."
          style={{
            width: '100%',
            padding: 12,
            background: color,
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 8,
            color: '#484848',
            fontSize: 14,
            resize: 'none',
            boxSizing: 'border-box',
            minHeight: 100
          }}
          rows={4}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: c,
                border: color === c ? '2px solid #2563eb' : '1px solid #d1d5db',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onSave(elementId, content, color)}
              style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              {t('save')}
            </button>
            {note && (
              <button
                onClick={() => onSave(elementId, '', '')}
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                {t('delete')}
              </button>
            )}
          </div>
          {note && canPush && (
            <button
              onClick={() => onPushToComment(elementId)}
              style={{ padding: '8px 12px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              💬 Publier
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
