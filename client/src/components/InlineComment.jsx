import React, { useState, useRef, useEffect, useMemo } from 'react';
import { renderWithMentions } from '../utils/helpers';

const InlineComment = React.memo(({ comment, onReply, onResolve, onDelete, onEdit, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply, darkMode, isSelected, mentionableUsers, t = (k) => k }) => {
  const replyInputRef = useRef(null);
  const editInputRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReplyMentions, setShowReplyMentions] = useState(false);
  const [replyMentionSearch, setReplyMentionSearch] = useState('');
  const [replyMentionIndex, setReplyMentionIndex] = useState(0);

  useEffect(() => { if (isReplying && replyInputRef.current) replyInputRef.current.focus(); }, [isReplying]);
  useEffect(() => { if (isEditing && editInputRef.current) editInputRef.current.focus(); }, [isEditing]);

  const filteredReplyMentions = useMemo(() => {
    if (!mentionableUsers) return [];
    if (!replyMentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u =>
      u.name.toLowerCase().includes(replyMentionSearch.toLowerCase())
    );
  }, [mentionableUsers, replyMentionSearch]);

  const handleReplyChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    onReplyChange(value);

    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowReplyMentions(true);
      setReplyMentionSearch(atMatch[1]);
      setReplyMentionIndex(0);
    } else {
      setShowReplyMentions(false);
      setReplyMentionSearch('');
    }
  };

  const insertReplyMention = (userName) => {
    const atPattern = new RegExp('@' + replyMentionSearch + '$');
    const newText = replyContent.replace(atPattern, '@' + userName + ' ');
    onReplyChange(newText);

    setShowReplyMentions(false);
    setReplyMentionSearch('');

    setTimeout(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
      }
    }, 0);
  };

  useEffect(() => {
    if (showMenu) {
      const handleClick = () => setShowMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  if (!isSelected) {
    return (
      <div style={{
        background: darkMode ? '#2d3748' : 'white',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        cursor: 'pointer'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: comment.userColor || '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 12,
            flexShrink: 0
          }}>
            {comment.userName?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 13 }}>{comment.userName}</span>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>
                {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              {comment.resolved && <span style={{ fontSize: 9, background: '#10b981', color: 'white', padding: '1px 6px', borderRadius: 10 }}>✓</span>}
            </div>
            <p style={{
              color: darkMode ? '#e5e7eb' : '#484848',
              margin: 0,
              fontSize: 13,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {renderWithMentions(comment.content, darkMode)}
            </p>
            {comment.replies?.length > 0 && (
              <span style={{ color: '#6b7280', fontSize: 11, marginTop: 4, display: 'block' }}>
                {comment.replies.length} {comment.replies.length > 1 ? t('replies') : t('replyCount')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: darkMode ? '#484848' : 'white',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: comment.userColor || '#666',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 13,
          flexShrink: 0
        }}>
          {comment.userName?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 13 }}>{comment.userName}</span>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {' '}
              {new Date(comment.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {comment.resolved && <span style={{ fontSize: 10, color: '#10b981', marginTop: 2, display: 'block' }}>Résolu</span>}
        </div>
        {canComment && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}
              title={comment.resolved ? t('reopen') : t('markResolved')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: comment.resolved ? '#10b981' : (darkMode ? '#555555' : '#f3f4f6'),
                color: comment.resolved ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!comment.resolved) {
                  e.currentTarget.style.background = '#10b981';
                  e.currentTarget.style.color = 'white';
                } else {
                  e.currentTarget.style.background = '#059669';
                }
              }}
              onMouseLeave={(e) => {
                if (!comment.resolved) {
                  e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6';
                  e.currentTarget.style.color = darkMode ? '#9ca3af' : '#6b7280';
                } else {
                  e.currentTarget.style.background = '#10b981';
                }
              }}
            >
              ✓
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              title={t('moreOptions')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: darkMode ? '#555555' : '#f3f4f6',
                color: darkMode ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                position: 'relative'
              }}
            >
              ⋮
              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: darkMode ? '#484848' : 'white',
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    minWidth: 140,
                    overflow: 'hidden'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setIsEditing(true);
                      setEditText(comment.content);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: darkMode ? '#e5e7eb' : '#484848',
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                    </svg>
                    {t('edit')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete && onDelete(comment.id);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#ef4444',
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? '#555555' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    🗑️ {t('delete')}
                  </button>
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div style={{ marginBottom: 10 }}>
          <textarea
            ref={editInputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && editText.trim()) {
                e.preventDefault();
                onEdit && onEdit(comment.id, editText);
                setIsEditing(false);
              }
              if (e.key === 'Escape') {
                setIsEditing(false);
                setEditText(comment.content);
              }
            }}
            style={{
              width: '100%',
              padding: 10,
              border: `2px solid #1a73e8`,
              borderRadius: 6,
              fontSize: 13,
              resize: 'none',
              minHeight: 60,
              background: darkMode ? '#333333' : 'white',
              color: darkMode ? 'white' : '#484848',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditText(comment.content);
              }}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: darkMode ? '#9ca3af' : '#5f6368',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => {
                if (editText.trim()) {
                  onEdit && onEdit(comment.id, editText);
                  setIsEditing(false);
                }
              }}
              disabled={!editText.trim()}
              style={{
                padding: '6px 14px',
                background: editText.trim() ? '#1a73e8' : '#d1d5db',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                cursor: editText.trim() ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: 500
              }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <p style={{
          color: darkMode ? '#e5e7eb' : '#484848',
          margin: '0 0 10px 0',
          fontSize: 13,
          lineHeight: 1.5
        }}>
          {renderWithMentions(comment.content, darkMode)}
        </p>
      )}

      {comment.replies?.map(reply => (
        <div key={reply.id} style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: reply.userColor || '#888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: 10,
              flexShrink: 0
            }}>
              {reply.userName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 12 }}>{reply.userName}</span>
                <span style={{ color: '#9ca3af', fontSize: 10 }}>
                  {new Date(reply.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p style={{ color: darkMode ? '#d1d5db' : '#484848', margin: '2px 0 0 0', fontSize: 12, lineHeight: 1.4 }}>{renderWithMentions(reply.content, darkMode)}</p>
            </div>
          </div>
        </div>
      ))}

      {canComment && (
        isReplying ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`, position: 'relative' }}>
            <textarea
              ref={replyInputRef}
              value={replyContent}
              onChange={handleReplyChange}
              placeholder={`${t('reply')}... (@mention)`}
              onKeyDown={(e) => {
                if (showReplyMentions && filteredReplyMentions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setReplyMentionIndex(i => Math.min(i + 1, filteredReplyMentions.length - 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setReplyMentionIndex(i => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertReplyMention(filteredReplyMentions[replyMentionIndex].name);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowReplyMentions(false);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey && replyContent.trim() && !showReplyMentions) {
                  e.preventDefault();
                  onSubmitReply(comment.id);
                }
                if (e.key === 'Escape' && !showReplyMentions) {
                  onCancelReply();
                }
              }}
              style={{
                width: '100%',
                padding: 10,
                background: darkMode ? '#333333' : '#f9fafb',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                borderRadius: 6,
                color: darkMode ? 'white' : '#484848',
                fontSize: 12,
                resize: 'none',
                boxSizing: 'border-box'
              }}
              rows={2}
            />

            {showReplyMentions && filteredReplyMentions.length > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: 4,
                  background: darkMode ? '#484848' : 'white',
                  border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: 120,
                  overflow: 'auto',
                  zIndex: 10
                }}>
                {filteredReplyMentions.map((user, idx) => (
                  <div
                    key={user.name}
                    onClick={(e) => { e.stopPropagation(); insertReplyMention(user.name); }}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      background: idx === replyMentionIndex ? (darkMode ? '#555555' : '#f3f4f6') : 'transparent'
                    }}
                    onMouseEnter={() => setReplyMentionIndex(idx)}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: user.color || '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 'bold',
                      position: 'relative'
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                      <span style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: user.online ? '#22c55e' : '#6b7280',
                        border: `1px solid ${darkMode ? '#484848' : 'white'}`
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: darkMode ? 'white' : '#484848' }}>
                      {user.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={() => onSubmitReply(comment.id)}
                disabled={!replyContent.trim()}
                style={{
                  padding: '6px 14px',
                  background: replyContent.trim() ? '#1a73e8' : '#d1d5db',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: replyContent.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {t('reply')}
              </button>
              <button
                onClick={onCancelReply}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  color: darkMode ? '#9ca3af' : '#5f6368',
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={(e) => { e.stopPropagation(); onReply(comment.id); }}
            style={{
              marginTop: 12,
              padding: '10px 12px',
              background: darkMode ? '#333333' : '#f9fafb',
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
              borderRadius: 20,
              color: '#9ca3af',
              fontSize: 12,
              cursor: 'text'
            }}
          >
            Répondez ou ajoutez d'autres personnes avec @
          </div>
        )
      )}
    </div>
  );
});

export default InlineComment;
