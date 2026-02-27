import React from 'react';

function ChatPanel({
  chatPosition, onMouseDown, onClose,
  chatMessages, chatInput, setChatInput, sendChatMessage, chatEndRef,
  users, myId, darkMode
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: chatPosition.x,
        top: chatPosition.y,
        width: 320,
        height: 450,
        background: darkMode ? '#333333' : 'white',
        border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        resize: 'both',
        overflow: 'hidden'
      }}
    >
      {/* Chat Header - DRAGGABLE */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'move',
          background: darkMode ? '#484848' : '#f3f4f6',
          borderRadius: '12px 12px 0 0',
          userSelect: 'none'
        }}
        onMouseDown={onMouseDown}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Chat
          </h3>
          <span style={{ fontSize: 10, color: '#6b7280' }}>{users.length} connecté{users.length > 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}
        >✕</button>
      </div>

      {/* Online Users */}
      <div style={{
        padding: '6px 12px',
        borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {users.map(user => (
          <div
            key={user.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
              background: darkMode ? '#484848' : '#f3f4f6',
              borderRadius: 10,
              fontSize: 10,
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: user.color || '#22c55e' }} />
            <span style={{ color: darkMode ? 'white' : 'black' }}>
              {user.name}{user.id === myId ? ' (vous)' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {chatMessages.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 30, fontSize: 12 }}>
            Aucun message.<br/>Commencez la conversation !
          </p>
        ) : (
          chatMessages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.senderId === myId ? 'flex-end' : 'flex-start'
              }}
            >
              {msg.senderId !== myId && (
                <span style={{ fontSize: 9, color: msg.senderColor || '#6b7280', marginBottom: 1, fontWeight: 'bold' }}>
                  {msg.senderName}
                </span>
              )}
              <div style={{
                background: msg.senderId === myId ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'),
                color: msg.senderId === myId ? 'white' : (darkMode ? 'white' : 'black'),
                padding: '6px 10px',
                borderRadius: 10,
                maxWidth: '85%',
                fontSize: 12,
                lineHeight: 1.3,
                wordBreak: 'break-word'
              }}>
                {msg.content}
              </div>
              <span style={{ fontSize: 8, color: '#6b7280', marginTop: 1 }}>
                {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 10,
        borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
        display: 'flex',
        gap: 6,
        flexShrink: 0
      }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
          placeholder="Message..."
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 16,
            border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
            background: darkMode ? '#484848' : 'white',
            color: darkMode ? 'white' : 'black',
            fontSize: 12,
            outline: 'none'
          }}
        />
        <button
          onClick={sendChatMessage}
          disabled={!chatInput.trim()}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: 'none',
            background: chatInput.trim() ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'),
            color: chatInput.trim() ? 'white' : '#9ca3af',
            cursor: chatInput.trim() ? 'pointer' : 'default',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default React.memo(ChatPanel);
