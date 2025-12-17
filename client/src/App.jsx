import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes } from '@tiptap/core';

// V184 - Title tooltip CSS, auto-add collaborator on join

const SERVER_URL = 'https://room-production-19a5.up.railway.app';

// ============ TIPTAP COMMENT MARK ============
const CommentMark = Mark.create({
  name: 'comment',
  
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) return {};
          return { 'data-comment-id': attributes.commentId };
        },
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      style: 'background-color: rgba(251, 191, 36, 0.4); border-radius: 2px; cursor: pointer;',
    }), 0];
  },
});

// ============ TIPTAP SUGGESTION MARK ============
const SuggestionMark = Mark.create({
  name: 'suggestion',
  
  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => {
          if (!attributes.suggestionId) return {};
          return { 'data-suggestion-id': attributes.suggestionId };
        },
      },
      suggestedText: {
        default: '',
        parseHTML: element => element.getAttribute('data-suggested-text'),
        renderHTML: attributes => {
          return { 'data-suggested-text': attributes.suggestedText || '' };
        },
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    // Return a structure that shows strikethrough original + green suggestion
    return ['span', mergeAttributes({
      'data-suggestion-id': HTMLAttributes['data-suggestion-id'],
      'data-suggested-text': HTMLAttributes['data-suggested-text'],
      style: 'cursor: pointer;',
    }),
      // Wrapper for the two parts
      ['span', { style: 'text-decoration: line-through; color: #dc2626; background: rgba(220, 38, 38, 0.1);' }, 0], // 0 = original content goes here
      ['span', { 
        style: 'color: #16a34a; background: rgba(22, 163, 74, 0.1); margin-left: 2px;',
        contenteditable: 'false',
        'data-suggestion-display': 'true',
      }, HTMLAttributes['data-suggested-text'] || ''],
    ];
  },
});

// Helper to escape HTML entities
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// UUID fallback for browsers that don't support crypto.randomUUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers (Safari, etc.)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

const ELEMENT_TYPES = [
  { id: 'scene', label: 'Séquence', shortcut: '1' },
  { id: 'action', label: 'Action', shortcut: '2' },
  { id: 'character', label: 'Personnage', shortcut: '3' },
  { id: 'dialogue', label: 'Dialogue', shortcut: '4' },
  { id: 'parenthetical', label: 'Didascalie', shortcut: '5' },
  { id: 'transition', label: 'Transition', shortcut: '6' },
];

const TYPE_TO_FDX = { scene: 'Scene Heading', action: 'Action', character: 'Character', dialogue: 'Dialogue', parenthetical: 'Parenthetical', transition: 'Transition' };
const FDX_TO_TYPE = { 'Scene Heading': 'scene', 'Action': 'action', 'Character': 'character', 'Dialogue': 'dialogue', 'Parenthetical': 'parenthetical', 'Transition': 'transition', 'General': 'action' };
const LINES_PER_PAGE = 55;

// ============ AUTH MODAL ============
const AuthModal = ({ onLogin, onClose }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const name = mode === 'register' ? `${firstName} ${lastName}`.trim() : '';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(SERVER_URL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('screenplay-token', data.token);
      localStorage.setItem('screenplay-user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#2b2b2b',
    border: '1px solid #484848',
    borderRadius: 8,
    color: 'white',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: 'calc(100% - 32px)', maxWidth: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid #484848' }}>
        <h2 style={{ color: 'white', fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 600 }}>{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <input 
                type="text" 
                placeholder="Prénom" 
                value={firstName} 
                onChange={e => setFirstName(e.target.value)} 
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required 
              />
              <input 
                type="text" 
                placeholder="Nom" 
                value={lastName} 
                onChange={e => setLastName(e.target.value)} 
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required 
              />
            </div>
          )}
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={{ ...inputStyle, marginBottom: 12 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required 
          />
          <input 
            type="password" 
            placeholder="Mot de passe" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ ...inputStyle, marginBottom: 16 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required 
          />
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</p>}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: '100%', 
              padding: 14, 
              background: '#3b82f6', 
              border: 'none', 
              borderRadius: 8, 
              color: 'white', 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          {mode === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}
          <button 
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} 
            style={{ marginLeft: 8, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
        <button 
          onClick={onClose} 
          style={{ 
            marginTop: 16, 
            width: '100%', 
            padding: 12, 
            background: 'transparent', 
            border: '1px solid #484848', 
            borderRadius: 8, 
            color: '#6b7280', 
            cursor: 'pointer', 
            fontSize: 13 
          }}
        >
          Continuer sans compte
        </button>
      </div>
    </div>
  );
};

// ============ DOCUMENTS LIST ============
const DocumentsList = ({ token, onSelectDoc, onCreateDoc, onClose }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(SERVER_URL + '/api/documents', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setDocs(data.documents || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    if (token) fetchDocs();
  }, [token]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>Mes documents</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <button onClick={onCreateDoc} style={{ width: '100%', padding: 16, background: '#059669', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 24 }}>+ Nouveau document</button>
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement...</p> : docs.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Aucun document</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <button key={doc.shortId} onClick={() => onSelectDoc(doc.shortId)} style={{ padding: 16, background: '#484848', border: 'none', borderRadius: 8, color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background = '#555555'} onMouseOut={e => e.target.style.background = '#484848'}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{doc.title || 'SANS TITRE'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(doc.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ HISTORY PANEL ============
const HistoryPanel = ({ docId, token, currentTitle, onRestore, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/history', { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    if (token && docId) fetchHistory();
  }, [token, docId]);

  const handleRestore = async (entry) => {
    if (!window.confirm('Créer un nouveau document à partir de ce snapshot ?')) return;
    setRestoring(true);
    try {
      // Use snapshotName if available, otherwise generate from date
      let newTitle;
      if (entry.snapshotName) {
        newTitle = entry.snapshotName;
      } else {
        const snapshotDate = new Date(entry.createdAt);
        const dateStr = snapshotDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/[/:]/g, '-').replace(', ', '_');
        newTitle = (entry.data.title || currentTitle || 'SANS TITRE') + '_' + dateStr;
      }
      
      // Create new document with snapshot data
      const res = await fetch(SERVER_URL + '/api/documents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: newTitle, elements: entry.data.elements })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[RESTORE] Created new document:', data.id);
        onClose();
        window.location.hash = data.id;
      } else {
        alert('Erreur lors de la restauration');
      }
    } catch (err) { 
      console.error(err);
      alert('Erreur: ' + err.message);
    }
    setRestoring(false);
  };

  const actionLabels = { 'title-change': '📝 Titre modifié', 'element-change': '✏️ Élément modifié', 'element-type-change': '🔄 Type changé', 'element-insert': '➕ Élément ajouté', 'element-delete': '🗑️ Élément supprimé', 'snapshot': '📸 Snapshot' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>Historique</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        {restoring && <p style={{ color: '#60a5fa', textAlign: 'center', marginBottom: 16 }}>Restauration en cours...</p>}
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement...</p> : history.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Aucun historique</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => {
              // Generate snapshot name from date if not provided
              const getSnapshotDisplayName = () => {
                if (entry.snapshotName) return entry.snapshotName;
                if (entry.action === 'snapshot') {
                  const d = new Date(entry.createdAt);
                  const pad = n => n.toString().padStart(2, '0');
                  return `SNAPSHOT_${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
                }
                return actionLabels[entry.action] || entry.action;
              };
              
              return (
                <div key={entry._id} style={{ padding: 16, background: '#484848', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: entry.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>{entry.userName?.charAt(0).toUpperCase() || '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                      {getSnapshotDisplayName()}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{entry.userName} • {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  {entry.action === 'snapshot' && <button onClick={() => handleRestore(entry)} disabled={restoring} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12, opacity: restoring ? 0.5 : 1 }}>Restaurer</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ INLINE COMMENT (Google Docs style) ============
// Render text with @mentions highlighted
const renderWithMentions = (text, darkMode) => {
  if (!text) return '';
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={i} 
          style={{ 
            color: '#3b82f6', 
            fontWeight: 600,
            background: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            padding: '1px 4px',
            borderRadius: 3
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

const InlineComment = React.memo(({ comment, onReply, onResolve, onDelete, onEdit, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply, darkMode, isSelected, mentionableUsers }) => {
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
  
  // Filter mentions based on search
  const filteredReplyMentions = useMemo(() => {
    if (!mentionableUsers) return [];
    if (!replyMentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u => 
      u.name.toLowerCase().includes(replyMentionSearch.toLowerCase())
    );
  }, [mentionableUsers, replyMentionSearch]);

  // Handle @ detection in reply text
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

  // Insert mention into reply
  const insertReplyMention = (userName) => {
    // Use the stored mention search to find where to insert
    // This is more reliable than relying on cursor position after click
    const atPattern = new RegExp('@' + replyMentionSearch + '$');
    const newText = replyContent.replace(atPattern, '@' + userName + ' ');
    onReplyChange(newText);
    
    setShowReplyMentions(false);
    setReplyMentionSearch('');
    
    // Focus back on textarea
    setTimeout(() => {
      if (replyInputRef.current) {
        replyInputRef.current.focus();
      }
    }, 0);
  };
  
  // Close menu when clicking outside
  useEffect(() => {
    if (showMenu) {
      const handleClick = () => setShowMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  // Compact view when not selected
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
                {comment.replies.length} réponse{comment.replies.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view when selected
  return (
    <div style={{ 
      background: darkMode ? '#484848' : 'white', 
      borderRadius: 8, 
      padding: '12px 14px',
      marginBottom: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`
    }}>
      {/* Header with avatar, name, date, and action icons */}
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
        {/* Action icons - Google Docs style */}
        {canComment && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }}
              title={comment.resolved ? 'Rouvrir' : 'Marquer comme résolu'}
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
              title="Plus d'options"
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
              {/* Dropdown menu */}
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
                    Modifier
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
                    🗑️ Supprimer
                  </button>
                </div>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Comment content - or edit form if editing */}
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
              Annuler
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
      
      {/* Replies */}
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
      
      {/* Reply input - Google Docs style */}
      {canComment && (
        isReplying ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`, position: 'relative' }}>
            <textarea 
              ref={replyInputRef} 
              value={replyContent} 
              onChange={handleReplyChange} 
              placeholder="Répondre... (@mention)" 
              onKeyDown={(e) => {
                // Handle mention navigation
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
            
            {/* Mentions dropdown for reply */}
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
                Répondre
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
                Annuler
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

// ============ COMMENTS SIDEBAR (scrolls with content) ============
const CommentsSidebar = ({ comments, suggestions, elements, activeIndex, selectedCommentIndex, elementPositions, scrollContainerRef, scriptScrollHeight, token, docId, canComment, onClose, darkMode, onNavigateToElement, onAddComment, pendingInlineComment, onSubmitInlineComment, onCancelInlineComment, pendingSuggestion, onSubmitSuggestion, onCancelSuggestion, onAcceptSuggestion, onRejectSuggestion, selectedCommentId, onSelectComment, selectedSuggestionId, onSelectSuggestion, users, collaborators }) => {
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [newCommentFor, setNewCommentFor] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [inlineCommentText, setInlineCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'comments', 'suggestions'
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inlineCommentInputRef = useRef(null);
  const suggestionInputRef = useRef(null);
  const fallbackRef = useRef(null);
  const sidebarRef = scrollContainerRef || fallbackRef; // Use external ref for scroll sync
  const commentRefs = useRef({});
  const prevActiveIndexRef = useRef(activeIndex);

  // Get unique users for mentions (online users + offline collaborators)
  const mentionableUsers = useMemo(() => {
    const allUsers = [];
    const seenNames = new Set();
    
    // Add online users first (with online indicator)
    if (users) {
      users.filter(u => u.name).forEach(u => {
        if (!seenNames.has(u.name.toLowerCase())) {
          seenNames.add(u.name.toLowerCase());
          allUsers.push({ name: u.name, color: u.color, online: true });
        }
      });
    }
    
    // Add offline collaborators
    if (collaborators) {
      collaborators.filter(c => c.name).forEach(c => {
        if (!seenNames.has(c.name.toLowerCase())) {
          seenNames.add(c.name.toLowerCase());
          allUsers.push({ name: c.name, color: c.color || '#6b7280', online: false });
        }
      });
    }
    
    return allUsers;
  }, [users, collaborators]);

  // Filter users based on search
  const filteredMentions = useMemo(() => {
    if (!mentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u => 
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [mentionableUsers, mentionSearch]);

  // Handle @ detection in comment text
  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInlineCommentText(value);
    
    // Check if we're typing after @
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setShowMentions(true);
      setMentionSearch(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  // Insert mention into text
  const insertMention = (userName) => {
    const textarea = inlineCommentInputRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inlineCommentText.slice(0, cursorPos);
    const textAfterCursor = inlineCommentText.slice(cursorPos);
    
    // Find the @ position
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, -atMatch[0].length);
      const newText = beforeAt + '@' + userName + ' ' + textAfterCursor;
      setInlineCommentText(newText);
    }
    
    setShowMentions(false);
    setMentionSearch('');
    textarea.focus();
  };

  // Deselect comment/suggestion when clicking elsewhere in the script (activeIndex changes)
  useEffect(() => {
    if (activeIndex !== prevActiveIndexRef.current) {
      onSelectComment && onSelectComment(null);
      onSelectSuggestion && onSelectSuggestion(null);
      setReplyTo(null);
      prevActiveIndexRef.current = activeIndex;
    }
  }, [activeIndex, onSelectComment, onSelectSuggestion]);

  // Focus on inline comment input when pending comment appears
  const pendingCommentInitRef = useRef(null);
  useEffect(() => {
    if (pendingInlineComment && pendingInlineComment !== pendingCommentInitRef.current) {
      pendingCommentInitRef.current = pendingInlineComment;
      setInlineCommentText('');
      setTimeout(() => {
        inlineCommentInputRef.current?.focus();
      }, 100);
    } else if (!pendingInlineComment) {
      pendingCommentInitRef.current = null;
    }
  }, [pendingInlineComment]);

  // Focus on suggestion input when pending suggestion appears
  const pendingSuggestionInitRef = useRef(null);
  useEffect(() => {
    if (pendingSuggestion && pendingSuggestion !== pendingSuggestionInitRef.current) {
      pendingSuggestionInitRef.current = pendingSuggestion;
      setSuggestionText(pendingSuggestion.originalText || '');
      setTimeout(() => {
        suggestionInputRef.current?.focus();
        suggestionInputRef.current?.select();
      }, 100);
    } else if (!pendingSuggestion) {
      pendingSuggestionInitRef.current = null;
    }
  }, [pendingSuggestion]);

  const addReply = async (commentId) => {
    console.log('addReply called:', commentId, replyContent);
    if (!replyContent.trim()) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: replyContent }) });
      console.log('addReply response:', res.status);
      setReplyTo(null); setReplyContent('');
    } catch (err) { console.error('addReply error:', err); }
  };

  const toggleResolve = async (commentId) => {
    console.log('toggleResolve called:', commentId);
    try { 
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/resolve', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }); 
      console.log('toggleResolve response:', res.status);
    } catch (err) { console.error('toggleResolve error:', err); }
  };

  const deleteComment = async (commentId) => {
    console.log('deleteComment called:', commentId);
    try { 
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); 
      console.log('deleteComment response:', res.status);
    } catch (err) { console.error('deleteComment error:', err); }
  };

  const editComment = async (commentId, newContent) => {
    try { 
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ content: newContent })
      }); 
    } catch (err) { console.error(err); }
  };

  const submitNewComment = async (elementId) => {
    if (!newCommentText.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ elementId, content: newCommentText }) });
      setNewCommentFor(null); setNewCommentText('');
    } catch (err) { console.error(err); }
  };

  // Group comments by element index (in document order)
  const commentsByElementIndex = useMemo(() => {
    const map = {};
    comments.filter(c => !c.resolved).forEach(c => {
      const elementIndex = elements.findIndex(el => el.id === c.elementId);
      if (elementIndex >= 0) {
        if (!map[elementIndex]) map[elementIndex] = [];
        map[elementIndex].push(c);
      }
    });
    return map;
  }, [comments, elements]);

  // Get element indices for suggestions
  const suggestionsByElementIndex = useMemo(() => {
    const map = {};
    if (suggestions) {
      suggestions.filter(s => s.status === 'pending').forEach(s => {
        const idx = s.elementIndex;
        if (idx >= 0) {
          if (!map[idx]) map[idx] = [];
          map[idx].push(s);
        }
      });
    }
    return map;
  }, [suggestions]);

  // Get sorted element indices that have comments OR suggestions
  const sortedIndices = useMemo(() => {
    const commentIndices = Object.keys(commentsByElementIndex).map(Number);
    const suggestionIndices = Object.keys(suggestionsByElementIndex).map(Number);
    const allIndices = [...new Set([...commentIndices, ...suggestionIndices])];
    return allIndices.sort((a, b) => a - b);
  }, [commentsByElementIndex, suggestionsByElementIndex]);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const pendingSuggestions = suggestions ? suggestions.filter(s => s.status === 'pending') : [];
  
  // Track measured heights of each comment card
  const [cardHeights, setCardHeights] = useState({});
  const observersRef = useRef({});
  
  // Measure card height when rendered and observe for changes
  const measureCard = useCallback((idx, element) => {
    // Clean up old observer
    if (observersRef.current[idx]) {
      observersRef.current[idx].disconnect();
      delete observersRef.current[idx];
    }
    
    if (element) {
      // Initial measurement
      const height = element.getBoundingClientRect().height;
      setCardHeights(prev => {
        if (prev[idx] !== height) {
          return { ...prev, [idx]: height };
        }
        return prev;
      });
      
      // Observe for size changes (e.g., when replies are added)
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height + 20; // Add padding
          setCardHeights(prev => {
            if (prev[idx] !== newHeight) {
              return { ...prev, [idx]: newHeight };
            }
            return prev;
          });
        }
      });
      observer.observe(element);
      observersRef.current[idx] = observer;
    }
  }, []);
  
  // Cleanup observers on unmount
  useEffect(() => {
    return () => {
      Object.values(observersRef.current).forEach(obs => obs.disconnect());
    };
  }, []);
  
  // Calculate positions avoiding overlaps using actual measured heights
  // Reset offset if next comment is far away (more than ~2 pages)
  const adjustedPositions = useMemo(() => {
    const positions = {};
    const GAP = 15; // Gap between cards
    const RESET_THRESHOLD = 2000; // ~2 pages - if gap is larger, reset positioning
    let lastBottom = 0;
    
    sortedIndices.forEach(idx => {
      const idealTop = elementPositions[idx] || (idx * 30);
      
      // If this comment is far from the last one, reset the cascade
      // This prevents a few close comments from pushing ALL subsequent comments down
      if (idealTop - lastBottom > RESET_THRESHOLD) {
        lastBottom = 0; // Reset - this comment starts fresh at its ideal position
      }
      
      // Ensure this comment doesn't overlap with previous (within the same group)
      const actualTop = Math.max(idealTop, lastBottom);
      positions[idx] = actualTop;
      
      // Use measured height or estimate
      const cardHeight = cardHeights[idx] || 150;
      lastBottom = actualTop + cardHeight + GAP;
    });
    
    return positions;
  }, [sortedIndices, elementPositions, cardHeights]);

  // Calculate max content height for scroll spacer - must be at least as tall as script
  const maxContentHeight = useMemo(() => {
    let maxBottom = 0;
    sortedIndices.forEach(idx => {
      const top = adjustedPositions[idx] || 0;
      const height = cardHeights[idx] || 150;
      maxBottom = Math.max(maxBottom, top + height + 50);
    });
    // Also consider pending forms
    if (pendingInlineComment) {
      const pendingIdx = pendingInlineComment.elementIndex;
      const pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
      maxBottom = Math.max(maxBottom, pendingTop + 200);
    }
    if (pendingSuggestion) {
      const pendingIdx = pendingSuggestion.elementIndex;
      const pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
      maxBottom = Math.max(maxBottom, pendingTop + 200);
    }
    // Ensure at least as tall as script for 1:1 scroll sync
    return Math.max(maxBottom, scriptScrollHeight || 0);
  }, [sortedIndices, adjustedPositions, cardHeights, pendingInlineComment, pendingSuggestion, elementPositions, scriptScrollHeight]);

  // Navigation functions
  // Get filtered indices based on current filter
  const filteredSortedIndices = useMemo(() => {
    if (filter === 'all') return sortedIndices;
    if (filter === 'comments') {
      return Object.keys(commentsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    if (filter === 'suggestions') {
      return Object.keys(suggestionsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    return sortedIndices;
  }, [filter, sortedIndices, commentsByElementIndex, suggestionsByElementIndex]);

  const navigateToComment = (direction) => {
    if (filteredSortedIndices.length === 0) return;
    
    // Find current position in filteredSortedIndices based on activeIndex
    const currentPos = filteredSortedIndices.findIndex(idx => idx >= activeIndex);
    let targetPos;
    
    if (direction === 'next') {
      targetPos = currentPos === -1 ? 0 : Math.min(currentPos + 1, filteredSortedIndices.length - 1);
    } else {
      targetPos = currentPos <= 0 ? 0 : currentPos - 1;
    }
    
    const targetIdx = filteredSortedIndices[targetPos];
    if (targetIdx !== undefined && onNavigateToElement) {
      onNavigateToElement(targetIdx);
    }
  };

  return (
    <div 
      style={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
        background: darkMode ? '#333333' : '#f8f9fa', 
        overflow: 'hidden'
      }}
      onClick={() => { onSelectComment && onSelectComment(null); onSelectSuggestion && onSelectSuggestion(null); }}
    >
      {/* Header with navigation and filters */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Comment filter button */}
          <button
            onClick={() => setFilter(f => f === 'comments' ? 'all' : 'comments')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: filter === 'comments' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
              border: `1px solid ${filter === 'comments' ? '#1a73e8' : (darkMode ? '#555555' : '#d1d5db')}`,
              borderRadius: 4,
              color: filter === 'comments' ? '#1a73e8' : (darkMode ? 'white' : '#202124'),
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: filter === 'comments' ? 600 : 400
            }}
            title="Filtrer les commentaires"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {unresolvedComments.length}
          </button>
          
          {/* Suggestion filter button */}
          {pendingSuggestions.length > 0 && (
            <button
              onClick={() => setFilter(f => f === 'suggestions' ? 'all' : 'suggestions')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: filter === 'suggestions' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
                border: `1px solid ${filter === 'suggestions' ? '#10b981' : (darkMode ? '#555555' : '#d1d5db')}`,
                borderRadius: 4,
                color: filter === 'suggestions' ? '#10b981' : (darkMode ? 'white' : '#202124'),
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === 'suggestions' ? 600 : 400
              }}
              title="Filtrer les suggestions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              {pendingSuggestions.length}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Navigation arrows */}
          <button 
            onClick={() => navigateToComment('prev')}
            disabled={filteredSortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'), 
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? 'Suggestion précédente' : 'Commentaire précédent'}
          >
            ↑
          </button>
          <button 
            onClick={() => navigateToComment('next')}
            disabled={filteredSortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'), 
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? 'Suggestion suivante' : 'Commentaire suivant'}
          >
            ↓
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 8 }}>✕</button>
        </div>
      </div>
      
      {/* Content area - allow scrolling */}
      <div 
        ref={sidebarRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          position: 'relative',
          padding: '8px 12px'
        }}
      >
        <div>
          
          {/* Pending inline comment form - Google Docs style */}
          {pendingInlineComment && (() => {
            const pendingIdx = pendingInlineComment.elementIndex;
            // Find if there are existing comments for this element
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;
            
            if (existingCommentsForElement) {
              // Position after the existing comment card
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              // No existing comments - position at element level
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }
            
            return (
              <div style={{ 
                position: 'absolute',
                top: pendingTop,
                left: 8,
                right: 8,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Highlighted text banner */}
                <div style={{ 
                  background: 'rgba(251, 191, 36, 0.2)', 
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#fbbf24'}`,
                  fontSize: 12,
                  color: darkMode ? '#fbbf24' : '#92400e',
                  fontStyle: 'italic'
                }}>
                  "{pendingInlineComment.text.slice(0, 60)}{pendingInlineComment.text.length > 60 ? '...' : ''}"
                </div>
                
                <div style={{ padding: 12, position: 'relative' }}>
                  <textarea
                    ref={inlineCommentInputRef}
                    value={inlineCommentText}
                    onChange={handleCommentChange}
                    placeholder="Ajouter un commentaire... (@mention)"
                    onKeyDown={(e) => {
                      // Handle mention navigation
                      if (showMentions && filteredMentions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setMentionIndex(i => Math.max(i - 1, 0));
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          insertMention(filteredMentions[mentionIndex].name);
                          return;
                        }
                        if (e.key === 'Escape') {
                          setShowMentions(false);
                          return;
                        }
                      }
                      
                      if (e.key === 'Enter' && !e.shiftKey && inlineCommentText.trim() && !showMentions) {
                        e.preventDefault();
                        onSubmitInlineComment(inlineCommentText);
                        setInlineCommentText('');
                      }
                      if (e.key === 'Escape' && !showMentions) {
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 10,
                      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 6,
                      fontSize: 13,
                      resize: 'none',
                      minHeight: 60,
                      background: darkMode ? '#333333' : '#f9fafb',
                      color: darkMode ? 'white' : '#484848',
                      boxSizing: 'border-box'
                    }}
                  />
                  
                  {/* Mentions dropdown */}
                  {showMentions && filteredMentions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 12,
                      right: 12,
                      marginBottom: -8,
                      background: darkMode ? '#484848' : 'white',
                      border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: 150,
                      overflow: 'auto',
                      zIndex: 10
                    }}>
                      {filteredMentions.map((user, idx) => (
                        <div
                          key={user.name}
                          onClick={() => insertMention(user.name)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            background: idx === mentionIndex ? (darkMode ? '#555555' : '#f3f4f6') : 'transparent'
                          }}
                          onMouseEnter={() => setMentionIndex(idx)}
                        >
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: user.color || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                            position: 'relative'
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                            {/* Online indicator */}
                            <span style={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: user.online ? '#22c55e' : '#6b7280',
                              border: `2px solid ${darkMode ? '#484848' : 'white'}`
                            }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, color: darkMode ? 'white' : '#484848' }}>
                              {user.name}
                            </span>
                            {!user.online && (
                              <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                                (hors ligne)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        if (inlineCommentText.trim()) {
                          onSubmitInlineComment(inlineCommentText);
                          setInlineCommentText('');
                        }
                      }}
                      disabled={!inlineCommentText.trim()}
                      style={{
                        padding: '8px 16px',
                        background: inlineCommentText.trim() ? '#1a73e8' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: inlineCommentText.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 500
                      }}
                    >
                      Commenter
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Pending suggestion form */}
          {pendingSuggestion && (() => {
            const pendingIdx = pendingSuggestion.elementIndex;
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;
            
            if (existingCommentsForElement) {
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }
            
            return (
              <div style={{ 
                position: 'absolute',
                top: pendingTop,
                left: 8,
                right: 8,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `2px solid #10b981`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#10b981'}`,
                  fontSize: 12,
                  color: '#10b981',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                  Proposer une modification
                </div>
                
                <div style={{ padding: 12 }}>
                  {/* Original text (strikethrough) */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Texte original :</span>
                    <div style={{ 
                      textDecoration: 'line-through', 
                      color: '#ef4444', 
                      fontSize: 13,
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginTop: 4
                    }}>
                      {pendingSuggestion.originalText}
                    </div>
                  </div>
                  
                  {/* Suggested text input */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Remplacer par :</span>
                    <textarea
                      ref={suggestionInputRef}
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder="Tapez votre suggestion..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSubmitSuggestion(suggestionText);
                          setSuggestionText('');
                        }
                        if (e.key === 'Escape') {
                          onCancelSuggestion();
                          setSuggestionText('');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: 10,
                        border: `2px solid #10b981`,
                        borderRadius: 6,
                        fontSize: 13,
                        resize: 'none',
                        minHeight: 50,
                        background: darkMode ? '#333333' : '#f0fdf4',
                        color: darkMode ? '#6ee7b7' : '#166534',
                        boxSizing: 'border-box',
                        marginTop: 4
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelSuggestion();
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        onSubmitSuggestion(suggestionText);
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Suggérer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {sortedIndices.length === 0 && !pendingInlineComment && !pendingSuggestion ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 12 }}>Aucun commentaire ou suggestion</p>
          ) : sortedIndices.length > 0 ? (
            sortedIndices.map((idx, arrayIndex) => {
              const element = elements[idx];
              const elementComments = commentsByElementIndex[idx] || [];
              const topPosition = adjustedPositions[idx] || 0;
              
              return (
                <div 
                  key={idx}
                  data-comment-element-index={idx}
                  ref={(el) => measureCard(idx, el)}
                  style={{ 
                    position: 'absolute',
                    top: topPosition,
                    left: 8,
                    right: 8
                  }}
                >
                  {/* Comments for this element */}
                  {(filter === 'all' || filter === 'comments') && elementComments.map(c => {
                    const cId = String(c.id || c._id);
                    const isThisCommentSelected = String(selectedCommentId) === cId || (selectedCommentIndex === idx && elementComments.length === 1);
                    return (
                      <div 
                        key={cId} 
                        data-comment-id={cId}
                        data-comment-card-id={cId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComment && onSelectComment(isThisCommentSelected ? null : cId);
                          if (!isThisCommentSelected) {
                            onNavigateToElement && onNavigateToElement(idx);
                          }
                        }}
                      >
                        <InlineComment 
                          comment={{...c, id: cId}} 
                          onReply={id => { setReplyTo(replyTo === id ? null : id); setReplyContent(''); }}
                          onResolve={toggleResolve}
                          onDelete={deleteComment}
                          onEdit={editComment}
                          canComment={canComment}
                          isReplying={replyTo === cId}
                          replyContent={replyTo === cId ? replyContent : ''}
                          onReplyChange={setReplyContent}
                          onSubmitReply={addReply}
                          onCancelReply={() => { setReplyTo(null); setReplyContent(''); }}
                          darkMode={darkMode}
                          isSelected={isThisCommentSelected}
                          mentionableUsers={mentionableUsers}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Suggestions for this element */}
                  {(filter === 'all' || filter === 'suggestions') && suggestions && suggestions
                    .filter(s => s.elementIndex === idx && s.status === 'pending')
                    .map(s => {
                      const sId = String(s.id || s._id);
                      const isSelected = String(selectedSuggestionId) === sId;
                      const timeAgo = s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
                      
                      return (
                        <div 
                          key={sId}
                          data-suggestion-id={sId}
                          data-suggestion-card-id={sId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSuggestion && onSelectSuggestion(isSelected ? null : sId);
                            // Navigate to the element in the script
                            if (!isSelected && onNavigateToElement) {
                              onNavigateToElement(s.elementIndex);
                            }
                          }}
                          style={{
                            background: darkMode ? '#333333' : '#f0fdf4',
                            borderRadius: 8,
                            padding: isSelected ? 12 : 10,
                            marginBottom: 6,
                            boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            borderLeft: '3px solid #10b981'
                          }}
                        >
                          {/* Header - always visible */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: '50%', 
                              background: s.userColor || '#10b981', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: 'white', 
                              fontWeight: 'bold', 
                              fontSize: 10,
                              flexShrink: 0
                            }}>
                              {s.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 12 }}>{s.userName}</span>
                                <span style={{ color: '#6b7280', fontSize: 11 }}>{timeAgo}</span>
                              </div>
                              {/* Compact view - one line description */}
                              {!isSelected && (
                                <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#555555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <strong>Remplacer :</strong> <span style={{ fontStyle: 'italic' }}>"{s.originalText.substring(0, 20)}{s.originalText.length > 20 ? '...' : ''}"</span> par <span style={{ fontStyle: 'italic' }}>"{s.suggestedText.substring(0, 20)}{s.suggestedText.length > 20 ? '...' : ''}"</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Expanded view */}
                          {isSelected && (
                            <>
                              <div style={{ fontSize: 13, margin: '12px 0' }}>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>Remplacer :</div>
                                <div style={{ 
                                  textDecoration: 'line-through', 
                                  color: '#dc2626',
                                  marginBottom: 6,
                                  fontSize: 13
                                }}>
                                  "{s.originalText}"
                                </div>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>Par :</div>
                                <div style={{ 
                                  color: '#16a34a',
                                  fontWeight: 500,
                                  fontSize: 13
                                }}>
                                  "{s.suggestedText}"
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRejectSuggestion && onRejectSuggestion(s.id); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'transparent',
                                    border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                                    borderRadius: 4,
                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                    fontSize: 12,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Rejeter
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onAcceptSuggestion && onAcceptSuggestion(s.id); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: 'white',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    fontWeight: 500
                                  }}
                                >
                                  ✓ Accepter
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              );
            })
          ) : null}
          
          {/* Spacer to ensure sidebar can scroll to full document height */}
          <div style={{ height: maxContentHeight, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
};

// ============ CHARACTERS PANEL ============
const CharactersPanel = ({ characterStats, darkMode, onClose, onNavigate }) => {
  return (
    <div style={{ 
      position: 'fixed', 
      right: 0, 
      top: 60, 
      bottom: 0, 
      width: 320, 
      background: darkMode ? '#333333' : 'white', 
      borderLeft: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
      zIndex: 100, 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Personnages</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {characterStats.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucun personnage</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Personnage</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Répliques</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>Scènes</th>
                <th style={{ textAlign: 'center', padding: '8px 4px', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600 }}>1ère app.</th>
              </tr>
            </thead>
            <tbody>
              {characterStats.map((char, idx) => (
                <tr 
                  key={char.name} 
                  onClick={() => onNavigate(char.firstIndex)}
                  style={{ 
                    borderBottom: `1px solid ${darkMode ? '#484848' : '#f3f4f6'}`,
                    cursor: 'pointer',
                    background: idx % 2 === 0 ? 'transparent' : (darkMode ? '#484848' : '#f9fafb')
                  }}
                >
                  <td style={{ padding: '10px 4px', color: darkMode ? 'white' : 'black', fontWeight: 500 }}>{char.name}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#484848' }}>{char.lines}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#484848' }}>{char.sceneCount}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>Sc. {char.firstAppearance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        {characterStats.length} personnage{characterStats.length > 1 ? 's' : ''} • {characterStats.reduce((a, c) => a + c.lines, 0)} répliques
      </div>
    </div>
  );
};

// ============ NOTE EDITOR MODAL ============
const NoteEditorModal = ({ elementId, note, onSave, onPushToComment, onClose, darkMode, canPush, position, onDragStart }) => {
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
      {/* Draggable header */}
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
              Sauvegarder
            </button>
            {note && (
              <button 
                onClick={() => onSave(elementId, '', '')} 
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                Supprimer
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

// ============ STATS PANEL ============
const StatsPanel = ({ stats, elements, onClose, darkMode }) => {
  // Calculate additional stats
  const characters = useMemo(() => {
    const counts = {};
    elements.forEach(el => {
      if (el.type === 'character' && el.content.trim()) {
        const name = el.content.trim().replace(/\s*\(.*?\)\s*/g, '').toUpperCase();
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [elements]);

  const locations = useMemo(() => {
    const counts = { INT: 0, EXT: 0 };
    elements.forEach(el => {
      if (el.type === 'scene' && el.content) {
        if (el.content.match(/^INT[.\s]/i)) counts.INT++;
        else if (el.content.match(/^EXT[.\s]/i)) counts.EXT++;
      }
    });
    return counts;
  }, [elements]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 450, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Statistiques</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {/* Main stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.words}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Mots</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.scenes}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Scènes</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{characters.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Personnages</div>
          </div>
        </div>
        
        {/* Time estimates */}
        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Estimations</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>~{stats.screenTimeMin} min</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Durée à l'écran</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.dialogueRatio}%</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Dialogues</div>
            </div>
          </div>
        </div>
        
        {/* INT/EXT breakdown */}
        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black' }}>📍 Lieux</h4>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.INT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>INT.</span>
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.EXT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>EXT.</span>
            </div>
          </div>
          {(locations.INT + locations.EXT > 0) && (
            <div style={{ marginTop: 10, height: 6, background: darkMode ? '#555555' : '#d1d5db', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(locations.INT / (locations.INT + locations.EXT)) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
            </div>
          )}
        </div>
        
        {/* Top characters */}
        {characters.length > 0 && (
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Top personnages</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {characters.slice(0, 5).map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: darkMode ? 'white' : 'black' }}>{name}</span>
                  <span style={{ color: '#6b7280' }}>{count} répliques</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ GO TO SCENE MODAL ============
const GoToSceneModal = ({ onClose, onGoTo, maxScene, darkMode }) => {
  const [sceneNum, setSceneNum] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleGo = () => {
    const num = parseInt(sceneNum);
    if (num >= 1 && num <= maxScene) {
      onGoTo(num);
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 300, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Aller à la scène</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={maxScene}
            value={sceneNum}
            onChange={e => setSceneNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGo()}
            placeholder={`1 - ${maxScene}`}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 16 }}
          />
          <button onClick={handleGo} style={{ padding: '10px 16px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Go</button>
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#6b7280' }}>{maxScene} scène{maxScene > 1 ? 's' : ''} au total</p>
      </div>
    </div>
  );
};

// ============ WRITING GOALS MODAL ============
const WritingGoalsModal = ({ goal, onUpdate, onClose, currentWords, darkMode }) => {
  const [dailyGoal, setDailyGoal] = useState(goal.daily);
  const progress = Math.min(100, Math.round((goal.todayWords / goal.daily) * 100));

  const handleSave = () => {
    onUpdate({ ...goal, daily: parseInt(dailyGoal) || 1000 });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif d'écriture</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: darkMode ? 'white' : 'black' }}>Aujourd'hui</span>
            <span style={{ fontSize: 14, color: progress >= 100 ? '#22c55e' : '#6b7280' }}>{goal.todayWords} / {goal.daily} mots</span>
          </div>
          <div style={{ height: 8, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#22c55e' : '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: progress >= 100 ? '#22c55e' : '#6b7280', textAlign: 'center' }}>
            {progress >= 100 ? '🎉 Objectif atteint !' : `${progress}% - ${goal.daily - goal.todayWords} mots restants`}
          </p>
        </div>

        {/* Goal setting */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Objectif quotidien (mots)</label>
          <input
            type="number"
            min="100"
            step="100"
            value={dailyGoal}
            onChange={e => setDailyGoal(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 14 }}
          />
        </div>

        {/* Quick presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[500, 1000, 1500, 2000].map(preset => (
            <button
              key={preset}
              onClick={() => setDailyGoal(preset)}
              style={{ flex: 1, padding: '8px', background: dailyGoal == preset ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), border: 'none', borderRadius: 6, color: dailyGoal == preset ? 'white' : (darkMode ? 'white' : 'black'), cursor: 'pointer', fontSize: 12 }}
            >
              {preset}
            </button>
          ))}
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: '12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>
          Enregistrer
        </button>
      </div>
    </div>
  );
};

// ============ SHORTCUTS PANEL ============
const ShortcutsPanel = ({ onClose, darkMode }) => {
  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: '⌘↑', desc: 'Élément précédent' },
      { keys: '⌘↓', desc: 'Élément suivant' },
      { keys: '⌘O', desc: 'Ouvrir/Fermer Outline' },
      { keys: '⌘G', desc: 'Aller à la scène' },
    ]},
    { category: 'Édition', items: [
      { keys: '⌘Z', desc: 'Annuler' },
      { keys: '⌘⇧Z', desc: 'Rétablir' },
      { keys: '⌘S', desc: 'Créer un snapshot' },
      { keys: '⌘D', desc: 'Dupliquer la scène' },
      { keys: '⌘F', desc: 'Rechercher/Remplacer' },
      { keys: '⌘N', desc: 'Ajouter une note' },
      { keys: 'Tab', desc: 'Changer type élément' },
      { keys: 'Backspace', desc: 'Supprimer ligne vide' },
    ]},
    { category: 'Types (⌘+chiffre)', items: [
      { keys: '⌘1', desc: 'Scène' },
      { keys: '⌘2', desc: 'Action' },
      { keys: '⌘3', desc: 'Personnage' },
      { keys: '⌘4', desc: 'Dialogue' },
      { keys: '⌘5', desc: 'Parenthèse' },
      { keys: '⌘6', desc: 'Transition' },
    ]},
    { category: 'Général', items: [
      { keys: 'Escape', desc: 'Fermer panel actif' },
      { keys: '⌘?', desc: 'Raccourcis clavier' },
      { keys: '⌘.', desc: 'Mode focus' },
    ]},
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>Raccourcis clavier</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {shortcuts.map(cat => (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{cat.category}</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {cat.items.map(item => (
                <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: darkMode ? 'white' : 'black' }}>{item.desc}</span>
                  <kbd style={{ 
                    padding: '4px 8px', 
                    background: darkMode ? '#555555' : 'white', 
                    border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`, 
                    borderRadius: 4, 
                    fontSize: 12, 
                    fontFamily: 'monospace',
                    color: darkMode ? '#e5e7eb' : '#484848'
                  }}>{item.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ RENAME CHARACTER MODAL ============
const RenameCharacterModal = ({ characters, onRename, onClose, darkMode }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleRename = () => {
    if (from && to && from !== to) {
      onRename(from, to);
    }
  };

  const charList = [...new Set(characters)].sort();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>Renommer un personnage</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Personnage actuel</label>
          <select 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 28px 10px 12px', 
              background: darkMode ? '#484848' : 'white', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14,
              cursor: 'pointer',
              outline: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${darkMode ? '%239ca3af' : '%236b7280'}' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center'
            }}
          >
            <option value="">Sélectionner...</option>
            {charList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Nouveau nom</label>
          <input 
            type="text"
            value={to} 
            onChange={e => setTo(e.target.value.toUpperCase())}
            placeholder="NOUVEAU NOM"
            style={{ 
              width: '100%', 
              padding: '10px 12px', 
              background: darkMode ? '#484848' : 'white', 
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, borderRadius: 6, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14 }}>
            Annuler
          </button>
          <button 
            onClick={handleRename} 
            disabled={!from || !to || from === to}
            style={{ padding: '10px 20px', background: (!from || !to || from === to) ? '#6b7280' : '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: (!from || !to || from === to) ? 'default' : 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            Renommer
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ ELEMENT STYLES ============
const getElementStyle = (type) => {
  const base = { fontFamily: 'Courier Prime, Courier New, monospace', fontSize: '12pt', lineHeight: '1', outline: 'none', border: 'none', width: '100%', background: 'transparent', resize: 'none', padding: 0, margin: 0, display: 'block', minHeight: '1em' };
  switch (type) {
    case 'scene': return { ...base, textTransform: 'uppercase', fontWeight: 'bold', marginTop: '2.5em', marginBottom: '0.5em' };
    case 'action': return { ...base, marginTop: '1em', marginBottom: 0, lineHeight: '1.1' };
    case 'character': return { ...base, textTransform: 'uppercase', fontWeight: 'bold', marginLeft: '37%', width: '30%', marginTop: '1em', marginBottom: 0 };
    case 'dialogue': return { ...base, marginLeft: '17%', width: '42%', marginTop: 0, marginBottom: 0, lineHeight: '1.1' };
    case 'parenthetical': return { ...base, marginLeft: '27%', width: '25%', fontStyle: 'italic', marginTop: 0, marginBottom: 0 };
    case 'transition': return { ...base, textTransform: 'uppercase', textAlign: 'right', marginTop: '1em' };
    default: return base;
  }
};

const getPlaceholder = (type) => ({ scene: 'INT./EXT. LIEU - JOUR/NUIT', action: "Description de l'action...", character: 'NOM DU PERSONNAGE', dialogue: 'Réplique du personnage...', parenthetical: '(indication de jeu)', transition: 'CUT TO:' }[type] || '');
const getNextType = (t) => ({ scene: 'action', action: 'action', character: 'dialogue', dialogue: 'character', parenthetical: 'dialogue', transition: 'scene' }[t] || 'action');

// ============ REMOTE CURSOR ============
const RemoteCursor = ({ user }) => (
  <div style={{ position: 'absolute', left: -12, top: 0, display: 'flex', alignItems: 'flex-start', pointerEvents: 'none', zIndex: 10 }}>
    <div style={{ width: 3, height: 20, background: user.color || '#888', borderRadius: 2, flexShrink: 0 }} />
    <div style={{ marginLeft: 2, background: user.color || '#888', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap', fontFamily: 'system-ui, sans-serif', fontWeight: 500, lineHeight: '1.2', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{user.name || 'Anonyme'}</div>
  </div>
);

// ============ RENDER CONTENT WITH HIGHLIGHTS ============
// Renders text with visual highlights for comments and suggestions
const renderContentWithHighlights = (content, highlights) => {
  if (!content) return '\u200B';
  if (!highlights || highlights.length === 0) return content;
  
  // Sort highlights by startOffset
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  
  const parts = [];
  let lastEnd = 0;
  
  for (const h of sorted) {
    // Skip invalid highlights
    if (h.startOffset < 0 || h.endOffset > content.length || h.startOffset >= h.endOffset) continue;
    
    // Add text before this highlight
    if (h.startOffset > lastEnd) {
      parts.push(content.slice(lastEnd, h.startOffset));
    }
    
    const highlightedText = content.slice(h.startOffset, h.endOffset);
    
    if (h.type === 'comment') {
      // Yellow background for comments
      parts.push(
        <span 
          key={`comment-${h.id}`}
          data-comment-id={String(h.id || h._id)}
          style={{ 
            backgroundColor: 'rgba(251, 191, 36, 0.4)', 
            borderRadius: 2, 
            cursor: 'pointer' 
          }}
        >
          {highlightedText}
        </span>
      );
    } else if (h.type === 'suggestion') {
      // Strikethrough original + green suggestion text
      parts.push(
        <span 
          key={`suggestion-${h.id}`}
          data-suggestion-id={String(h.id || h._id)}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ 
            textDecoration: 'line-through', 
            color: '#dc2626', 
            background: 'rgba(220, 38, 38, 0.1)' 
          }}>
            {highlightedText}
          </span>
          <span style={{ 
            color: '#16a34a', 
            background: 'rgba(22, 163, 74, 0.1)', 
            marginLeft: 2 
          }}>
            {h.suggestedText || ''}
          </span>
        </span>
      );
    }
    
    lastEnd = h.endOffset;
  }
  
  // Add remaining text
  if (lastEnd < content.length) {
    parts.push(content.slice(lastEnd));
  }
  
  return parts.length > 0 ? parts : content;
};

// ============ SCENE LINE (TIPTAP VERSION) ============
const SceneLine = React.memo(({ element, index, isActive, onUpdate, onFocus, onKeyDown, characters, locations, onSelectCharacter, onSelectLocation, remoteCursors, onCursorMove, canEdit, isLocked, sceneNumber, showSceneNumbers, note, onNoteClick, highlights, onTextSelect, onHighlightClick, onSuggestionClick, initialCursorOffset }) => {
  const containerRef = useRef(null);
  const [showAuto, setShowAuto] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const [autoType, setAutoType] = useState(null);
  const [editorReady, setEditorReady] = useState(false);
  const usersOnLine = remoteCursors.filter(u => u.cursor?.index === index);
  const lastContentRef = useRef(element.content);
  const lastHighlightsRef = useRef(null);
  
  // Build HTML content with comment and suggestion marks applied
  const buildContentWithMarks = useCallback((content, highlightsList) => {
    if (!content) return '<p></p>';
    
    const allHighlights = (highlightsList || []).filter(h => 
      h.type === 'comment' || h.type === 'suggestion'
    );
    
    if (allHighlights.length === 0) return `<p>${escapeHtml(content)}</p>`;
    
    // Sort by startOffset
    const sorted = [...allHighlights].sort((a, b) => a.startOffset - b.startOffset);
    
    let html = '';
    let lastEnd = 0;
    
    for (const h of sorted) {
      if (h.startOffset < 0 || h.endOffset > content.length || h.startOffset >= h.endOffset) continue;
      
      // Skip if overlapping with previous (simple approach)
      if (h.startOffset < lastEnd) continue;
      
      // Text before this highlight
      if (h.startOffset > lastEnd) {
        html += escapeHtml(content.slice(lastEnd, h.startOffset));
      }
      
      const markedText = escapeHtml(content.slice(h.startOffset, h.endOffset));
      
      if (h.type === 'comment') {
        html += `<span data-comment-id="${h.id || h._id}">${markedText}</span>`;
      } else if (h.type === 'suggestion') {
        const suggestedText = escapeHtml(h.suggestedText || '');
        html += `<span data-suggestion-id="${h.id || h._id}" data-suggested-text="${suggestedText}">${markedText}</span>`;
      }
      
      lastEnd = h.endOffset;
    }
    
    // Remaining text
    if (lastEnd < content.length) {
      html += escapeHtml(content.slice(lastEnd));
    }
    
    return `<p>${html}</p>`;
  }, []);
  
  // TipTap editor instance
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR-like errors
    onCreate: () => {
      setEditorReady(true);
    },
    onDestroy: () => {
      setEditorReady(false);
    },
    extensions: [
      StarterKit.configure({
        // Disable block-level elements we don't need
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        // Keep hardBreak for line breaks within elements
        hardBreak: true,
        // Keep paragraph but style it
        paragraph: {
          HTMLAttributes: { style: 'margin: 0; padding: 0;' },
        },
      }),
      CommentMark,
      SuggestionMark,
    ],
    content: buildContentWithMarks(element.content, highlights),
    editable: canEdit && !isLocked,
    
    // Editor props for styling and keyboard handling
    editorProps: {
      attributes: {
        'data-element-id': element.id,
        'data-placeholder': getPlaceholder(element.type),
        style: buildStyleString(element.type, canEdit, isLocked),
      },
      
      // Handle keyboard events
      handleKeyDown: (view, event) => {
        if (!view) return false;
        try {
        // Autocomplete navigation
        if (showAuto && filtered.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setAutoIdx(i => (i + 1) % filtered.length);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setAutoIdx(i => (i - 1 + filtered.length) % filtered.length);
            return true;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (autoType === 'character') onSelectCharacter(index, filtered[autoIdx]);
            else if (autoType === 'location') onSelectLocation(index, filtered[autoIdx]);
            setShowAuto(false);
            return true;
          }
          if (event.key === 'Escape') {
            setShowAuto(false);
            return true;
          }
        }
        
        // Navigation between elements
        const { from, to } = view.state.selection;
        const docSize = view.state.doc.content.size;
        const atStart = from <= 1;
        const atEnd = to >= docSize - 1;
        
        // Arrow up at start -> previous element
        if (event.key === 'ArrowUp' && atStart) {
          event.preventDefault();
          onKeyDown(event, index);
          return true;
        }
        
        // Arrow down at end -> next element
        if (event.key === 'ArrowDown' && atEnd) {
          event.preventDefault();
          onKeyDown(event, index);
          return true;
        }
        
        // Backspace at start -> merge with previous
        if (event.key === 'Backspace' && atStart && from === to) {
          event.preventDefault();
          onKeyDown(event, index);
          return true;
        }
        
        // Enter -> create new element only at end, otherwise line break
        if (event.key === 'Enter' && !event.shiftKey) {
          // Check if cursor is at the end of content
          if (atEnd) {
            event.preventDefault();
            onKeyDown(event, index);
            return true;
          }
          // Otherwise let TipTap handle it (creates line break)
          return false;
        }
        
        // Tab -> cycle element type
        if (event.key === 'Tab') {
          event.preventDefault();
          onKeyDown(event, index);
          return true;
        }
        
        return false;
        } catch (e) {
          return false;
        }
      },
      
      // Handle click on comment and suggestion marks
      handleClick: (view, pos, event) => {
        if (!view) return false;
        try {
          const target = event.target;
          
          // Check for comment click
          const commentEl = target.closest('[data-comment-id]');
          if (commentEl && onHighlightClick) {
            const commentId = commentEl.getAttribute('data-comment-id');
            setTimeout(() => onHighlightClick(commentId), 0);
            return false;
          }
          
          // Check for suggestion click
          const suggestionEl = target.closest('[data-suggestion-id]');
          if (suggestionEl && onSuggestionClick) {
            const suggestionId = suggestionEl.getAttribute('data-suggestion-id');
            setTimeout(() => onSuggestionClick(suggestionId), 0);
            return false;
          }
        } catch (e) {
          // Ignore errors
        }
        return false;
      },
    },
    
    // Sync content changes back to parent
    onUpdate: ({ editor }) => {
      if (!editor || !editor.view) return;
      try {
        const text = editor.getText();
        if (text !== lastContentRef.current) {
          lastContentRef.current = text;
          onUpdate(index, { ...element, content: text });
        }
      } catch (e) {
        // Editor not ready
      }
    },
    
    // Handle text selection for comments/suggestions
    onSelectionUpdate: ({ editor }) => {
      if (!editor || !editor.view || !onTextSelect) return;
      try {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          const selectedText = editor.state.doc.textBetween(from, to);
          if (selectedText.trim()) {
            const rect = containerRef.current?.getBoundingClientRect();
            onTextSelect({
              elementId: element.id,
              elementIndex: index,
              text: selectedText,
              startOffset: from - 1, // -1 because of paragraph wrapper
              endOffset: to - 1,
              rect,
            });
          }
        }
      } catch (e) {
        // Editor not ready
      }
    },
    
    // When editor gets focus, notify parent
    onFocus: ({ editor }) => {
      if (!editor || !editor.view) return;
      try {
        if (!isActive) {
          onFocus(index, null);
        }
      } catch (e) {
        // Editor not ready
      }
    },
  });
  
  // Sync content from parent when it changes externally
  useEffect(() => {
    if (!editorReady || !editor) return;
    try {
      const editorText = editor.getText();
      if (element.content !== editorText && element.content !== lastContentRef.current) {
        lastContentRef.current = element.content;
        editor.commands.setContent(buildContentWithMarks(element.content, highlights), false);
      }
    } catch (e) {
      // Editor not ready yet
    }
  }, [editorReady, editor, element.content, buildContentWithMarks, highlights]);
  
  // Sync highlights when they change (without changing text)
  useEffect(() => {
    if (!editorReady || !editor) return;
    
    // Check if highlights actually changed
    const highlightsJson = JSON.stringify(highlights || []);
    if (highlightsJson === lastHighlightsRef.current) return;
    lastHighlightsRef.current = highlightsJson;
    
    try {
      // Only update if editor is not focused to avoid cursor jump
      if (!editor.isFocused) {
        editor.commands.setContent(buildContentWithMarks(element.content, highlights), false);
      }
    } catch (e) {
      // Editor not ready yet
    }
  }, [editorReady, editor, highlights, element.content, buildContentWithMarks]);
  
  // Focus editor when becoming active
  useEffect(() => {
    if (!editorReady || !editor) return;
    if (isActive) {
      try {
        editor.commands.focus();
        // Place cursor at specific position if provided
        if (initialCursorOffset !== null && initialCursorOffset !== undefined && initialCursorOffset >= 0) {
          const pos = Math.min(initialCursorOffset + 1, editor.state.doc.content.size - 1);
          editor.commands.setTextSelection(pos);
        }
      } catch (e) {
        // Editor not ready yet
      }
    }
  }, [editorReady, editor, isActive, initialCursorOffset]);
  
  // Update editor editable state when lock status changes
  useEffect(() => {
    if (editor && editorReady) {
      const shouldBeEditable = canEdit && !isLocked;
      if (editor.isEditable !== shouldBeEditable) {
        editor.setEditable(shouldBeEditable);
      }
    }
  }, [editor, editorReady, canEdit, isLocked]);
  
  // Autocomplete for characters and locations
  useEffect(() => {
    if (!element.content) {
      setShowAuto(false);
      setFiltered([]);
      return;
    }
    
    if (element.type === 'character' && isActive && element.content.length > 0) {
      const q = element.content.toUpperCase();
      const f = characters.filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
      setFiltered(f);
      setShowAuto(f.length > 0);
      setAutoIdx(0);
      setAutoType('character');
    } else if (element.type === 'scene' && isActive && element.content.length > 4) {
      const match = element.content.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*(.*)$/i);
      if (match && match[2] && match[2].length > 0) {
        const q = match[2].toUpperCase();
        const f = locations.filter(l => l.startsWith(q) && l !== q);
        setFiltered(f);
        setShowAuto(f.length > 0);
        setAutoIdx(0);
        setAutoType('location');
      } else {
        setShowAuto(false);
        setFiltered([]);
      }
    } else {
      setShowAuto(false);
      setFiltered([]);
    }
  }, [element.content, element.type, isActive, characters, locations]);
  
  const hasHighlights = highlights && highlights.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', margin: 0, padding: 0, lineHeight: 0 }}>
      {/* Remote cursors */}
      {usersOnLine.map(u => <RemoteCursor key={u.id} user={u} />)}
      
      {/* Lock icon for locked scenes - only show if not active (active shows label with lock) */}
      {element.type === 'scene' && isLocked && !isActive && (
        <span style={{ position: 'absolute', left: showSceneNumbers ? -55 : -25, top: 4, fontSize: 14, color: '#f59e0b', display: 'flex', alignItems: 'center' }} title="Scène verrouillée"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
      )}
      
      {/* Scene number left */}
      {element.type === 'scene' && showSceneNumbers && sceneNumber && (
        <span style={{ position: 'absolute', left: -35, top: 4, fontSize: '12pt', fontFamily: 'Courier Prime, monospace', color: 'inherit', fontWeight: 'bold' }}>{sceneNumber}</span>
      )}
      
      {/* Scene number right */}
      {element.type === 'scene' && showSceneNumbers && sceneNumber && (
        <span style={{ position: 'absolute', right: -35, top: 4, fontSize: '12pt', fontFamily: 'Courier Prime, monospace', color: 'inherit', fontWeight: 'bold' }}>{sceneNumber}</span>
      )}
      
      {/* Note indicator */}
      {note && (
        <div 
          onClick={() => onNoteClick(element.id)} 
          style={{ position: 'absolute', right: -55, top: 2, width: 20, height: 20, background: note.color || '#fbbf24', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer', boxShadow: '1px 1px 3px rgba(0,0,0,0.2)' }}
          title={note.content}
        >📝</div>
      )}
      
      {/* Element type label when active */}
      {isActive && (
        <span style={{ position: 'absolute', left: showSceneNumbers && element.type === 'scene' ? -145 : -110, top: 2, fontSize: 10, color: isLocked ? '#f59e0b' : '#888', width: 95, textAlign: 'right', lineHeight: '1.2', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          {isLocked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}{ELEMENT_TYPES.find(t => t.id === element.type)?.label}
        </span>
      )}
      
      {/* TipTap Editor */}
      <EditorContent editor={editor} />
      
      {/* Character autocomplete dropdown */}
      {autoType === 'character' && showAuto && (
        <div style={{ position: 'absolute', top: '100%', left: '37%', background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200 }}>
          {filtered.map((s, i) => (
            <div 
              key={s} 
              onClick={() => { onSelectCharacter(index, s); setShowAuto(false); }} 
              style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
      
      {/* Location autocomplete dropdown */}
      {autoType === 'location' && showAuto && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 250 }}>
          {filtered.map((s, i) => (
            <div 
              key={s} 
              onClick={() => { onSelectLocation(index, s); setShowAuto(false); }} 
              style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Helper to build style string for TipTap editor
function buildStyleString(elementType, canEdit, isLocked) {
  const base = getElementStyle(elementType);
  const styles = {
    ...base,
    cursor: canEdit ? 'text' : 'default',
    opacity: canEdit ? 1 : 0.7,
    background: isLocked ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
    whiteSpace: 'pre-wrap',
    minHeight: '1.5em',
    outline: 'none',
  };
  return Object.entries(styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
    .join('; ');
}

// ============ USER AVATAR ============
// ============ LOGO ============
const Logo = ({ darkMode }) => {
  const fill = darkMode ? '#ffffff' : '#1a1a1a';
  
  return (
    <svg width="100" height="24" viewBox="0 0 2134.55 520.95" style={{ display: 'block' }}>
      <path fill={fill} d="M1375.76,13.04c14.32,5.69,98.47,254.68,121.6,283.31l112.97-277.01c12.68-15.14,33.62-6.79,49.07-7.06,14.77-.26,61.04-7.48,69.84,4.19,4.61,6.11,4.53,29.77,0,35.77-7.56,10.03-28.35,4.07-39,7-2.48,1.74-4.08,14.51-4.06,18.12.36,116.57-.27,233.47,2.28,349.92.17,7.55-2,25.19,1.94,30.05,8.36,10.32,39.21-3.45,42,19.99,1.83,15.34,2.74,29.51-14.94,31.13-40.63,3.73-86.87-3-128.13-.06-18.94-.43-19.31-34.78-6.86-42.93,12.01-7.85,36.48,1.36,49.92-6.08,7.39-6.33,2.63-101.8,2.73-118.36.49-83.45,2.33-167.05,1.23-250.66-13.19,7.98-13.96,25.34-19.02,37.96-30.91,76.97-61.27,154.18-93.23,230.77l-6.77,5.23c-15.93-2.46-43.8,8.16-53.36-8.55-33.49-74.92-58.04-156.62-90.59-231.41-1.84-4.22-14.6-30.26-16.06-31.94-6.33-7.28-2.86,7.85-2.88,9.07-.18,18.6-.18,37.28-.16,55.96.13,97.27-.46,195.87.22,293.8,3.38,21.41,40.2,4.36,53.83,14.17,9.72,7,11.8,42.18-4.85,43.06-41.13-3.73-89.99,4.63-130.15-.06-16.31-1.91-14.58-17.49-13-31.09,2.75-23.7,28.65-10.34,40.07-17.94,5.85-3.89,3.99-34.07,4.07-42.1,1-96.01-.45-191.68-1.35-287.58-.14-15.29,2.47-33.08,1.42-48.37-.37-5.42-1.38-19.62-6.14-22-22.31-2.68-40.34,5.01-40.84-24.7-.19-11.67,3.26-22.38,15.95-24.15,20.59-2.87,43.51,1.62,63.87,2.05,12.45.26,24.16-5.16,38.41.5Z"/>
      <path fill={fill} d="M286.43,284.45l.92,5.9c47.59,45.43,70.76,111.58,104.96,167.05,11.99,12.91,51.04-6.02,54.08,19.92,1.37,11.73,1.98,29.17-12.93,31.14-13.1,1.74-54.9,1.6-68.19-.02-4.1-.5-7.16-2.23-10.3-4.7-26.72-43-47.94-89.53-74.28-132.74-23.43-38.45-41.46-71.28-91.25-74.75-8.28-.58-68-1.14-69.21,3.32l.05,157.42c18.59,15.1,62.76-9.63,66.07,24.35,1.45,14.87-.73,25.63-16.9,27.09-48.34,4.38-103.14-3.54-152.19,0-23.33.22-22.68-43.52.05-46.14,10.09-1.16,44.89,4.39,47.07-6.93-1.5-16.78,1.71-33.46,2.14-50,2.7-102.59,2.49-215.61-2.26-317.94-.44-9.5,3.1-18.47-.85-27.11C42.04,52.03,1.1,71.5.18,35.36-.72,0,27.41,12.31,51.24,12.41c59.41.24,121-4.19,180.08-2.22,72.39,2.42,134.97,30.66,151.68,106.52,17.4,78.97-22.23,141.87-96.57,167.75ZM125.75,58.76c-10.19,3-2.48,26.43-7.2,34.81,5.11,42.21-.2,85.7.67,128.03.09,4.43.93,24.44,3.01,25.88,14.28,1.55,28.85.94,43.21.96,20.61.04,43.03,1.35,64,0,68.51-4.44,112.65-55.69,96.36-124.53-8.07-34.09-29-50.66-61.89-60.11-41.81-12.03-94.59-2.54-138.16-5.04Z"/>
      <path fill={fill} d="M801.59,117.09c-61.7-81.87-175.67-94.6-248.04-18.52-76.94,80.88-79.51,229.73-6.23,313.82,61.54,70.63,159.06,80.79,231.75,20.12,2.76.47,23.39,26.93,28.26,31.79,2.89,2.89,10.83,4.74,8.12,10.07-78.51,60.99-194.74,60.7-276.93,6.82C316.78,335.82,429.58-34.34,707.06,2.64c183,24.39,267.14,244.23,176.28,395.68-8.87.18-36.31-60.4-38.87-71.08-4.04-16.85,2.75-31.3,3.84-47.91,3.6-54.63-13.76-118.5-46.73-162.25Z"/>
      <path fill={fill} d="M782.31,122.36c8.65,16.11,20.52,30.26,27.78,47.25,16.02,37.48,8.22,42.96,6.19,79.86-6.42,116.53,79.85,246.8,210.17,220,132.09-27.16,174.18-202.7,122.86-313.08-49.38-106.21-170.67-147.73-261.97-64.07l-36.91-44.74c94.39-71.95,234.86-60.68,317.96,23.73,159.9,162.4,48.1,465.1-191.03,449.03-179.17-12.04-278.99-202.66-213.96-363.92,1.38-3.42,15.5-36.38,18.91-34.06Z"/>
      <path fill={fill} d="M2068.31,30.35c2.2-25.54,32.49-34.92,46.85-14.22,2.04,30.93,1.32,62.24,1.08,93.31-.1,13.19,2.16,28.39-.02,41.81-2.42,14.93-32.56,13.95-40.94,7.17-7.87-6.36-6.13-37.86-9.96-50.04-25.48-81.1-179.82-81.42-200.4,3.57-22.69,93.73,66.31,103.51,131.41,123.42,40.73,12.45,91.94,28.18,116.5,65.5,6.64,10.08,20.91,41.42,21.4,52.78,1.85,43.46-3.98,83.39-34.87,116.75-50.47,54.49-147.74,59.69-213.58,33.53-7.7-3.06-31.22-18.09-36.39-17.69-8.08.63-5.99,13.76-9.25,18.95-7.43,11.85-48.32,11.37-45.81-9.82,1.66-45.85-5.21-91.5.87-137.11,4.28-12.97,34.6-12.78,41.21-2.97,6.02,8.94,6.61,34.58,10.95,47.05,32.88,94.53,221.15,96.18,230.94-16.98,8.16-94.36-133.38-98.22-196.4-127.57-66.84-31.13-91.39-93.92-69.01-163.86,24.44-76.38,112.99-103.54,185.85-90.98,26.12,4.5,46.43,15.64,69.55,27.41Z"/>
    </svg>
  );
};

const UserAvatar = ({ user, isYou }) => {
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.color || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: 'white', border: isYou ? '2px solid #22c55e' : 'none', boxSizing: 'border-box' }} title={user.name}>{getInitials(user.name)}</div>
  );
};

// Script templates
const SCRIPT_TEMPLATES = {
  empty: {
    name: 'Document vide',
    icon: '📄',
    description: 'Commencer de zéro',
    elements: [
      { type: 'scene', content: 'INT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  threeActs: {
    name: 'Structure 3 Actes',
    icon: '🎭',
    description: 'Setup, Confrontation, Résolution',
    elements: [
      { type: 'scene', content: '=== ACTE 1 - SETUP ===' },
      { type: 'action', content: '[Le monde ordinaire du protagoniste. Présentation des personnages et de l\'univers.]' },
      { type: 'scene', content: 'INT. LIEU DE VIE DU HÉROS - JOUR' },
      { type: 'action', content: '[Introduction du protagoniste dans son quotidien]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[L\'incident déclencheur qui bouleverse l\'équilibre]' },
      { type: 'scene', content: '=== ACTE 2 - CONFRONTATION ===' },
      { type: 'action', content: '[Le protagoniste fait face aux obstacles. Montée des enjeux.]' },
      { type: 'scene', content: 'INT./EXT. NOUVEAU MONDE - JOUR' },
      { type: 'action', content: '[Le héros entre dans un nouveau monde / nouvelle situation]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[Tests, alliés, ennemis. Le héros apprend les règles.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[MIDPOINT - Fausse victoire ou fausse défaite]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '[Les enjeux augmentent. Le héros perd tout espoir.]' },
      { type: 'scene', content: '=== ACTE 3 - RÉSOLUTION ===' },
      { type: 'action', content: '[Le climax et la résolution finale.]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR/NUIT' },
      { type: 'action', content: '[Confrontation finale. Le héros utilise tout ce qu\'il a appris.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '[Résolution. Le nouveau monde ordinaire du héros.]' }
    ]
  },
  fiveActs: {
    name: 'Structure 5 Actes',
    icon: '🎪',
    description: 'Shakespeare / Tragédie classique',
    elements: [
      { type: 'scene', content: '=== ACTE 1 - EXPOSITION ===' },
      { type: 'action', content: '[Présentation du monde, des personnages et du conflit latent]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 2 - MONTÉE DE L\'ACTION ===' },
      { type: 'action', content: '[L\'événement déclencheur. Les complications commencent.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 3 - CLIMAX ===' },
      { type: 'action', content: '[Le point de non-retour. La crise atteint son paroxysme.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 4 - CHUTE ===' },
      { type: 'action', content: '[Les conséquences du climax. Tout s\'effondre ou se reconstruit.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== ACTE 5 - DÉNOUEMENT ===' },
      { type: 'action', content: '[La résolution finale. Catharsis.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  herosJourney: {
    name: 'Le Voyage du Héros',
    icon: '🗡️',
    description: 'Joseph Campbell - 12 étapes',
    elements: [
      { type: 'scene', content: '=== 1. LE MONDE ORDINAIRE ===' },
      { type: 'action', content: '[Le héros dans son environnement quotidien avant l\'aventure]' },
      { type: 'scene', content: 'INT. MAISON DU HÉROS - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 2. L\'APPEL DE L\'AVENTURE ===' },
      { type: 'action', content: '[Un problème ou un défi se présente au héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 3. LE REFUS DE L\'APPEL ===' },
      { type: 'action', content: '[Le héros hésite, a peur de l\'inconnu]' },
      { type: 'scene', content: 'INT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 4. LA RENCONTRE AVEC LE MENTOR ===' },
      { type: 'action', content: '[Un guide apparaît pour aider le héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 5. LE PASSAGE DU SEUIL ===' },
      { type: 'action', content: '[Le héros s\'engage dans l\'aventure, quitte le monde ordinaire]' },
      { type: 'scene', content: 'EXT. FRONTIÈRE/SEUIL - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 6. ÉPREUVES, ALLIÉS, ENNEMIS ===' },
      { type: 'action', content: '[Le héros fait face à des tests, rencontre des alliés et des ennemis]' },
      { type: 'scene', content: 'INT./EXT. MONDE SPÉCIAL - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 7. L\'APPROCHE DE LA CAVERNE ===' },
      { type: 'action', content: '[Préparation pour le défi majeur]' },
      { type: 'scene', content: 'INT./EXT. APPROCHE DU DANGER - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 8. L\'ÉPREUVE SUPRÊME ===' },
      { type: 'action', content: '[Le héros affronte sa plus grande peur, mort symbolique]' },
      { type: 'scene', content: 'INT. CAVERNE/LIEU DU DANGER - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 9. LA RÉCOMPENSE ===' },
      { type: 'action', content: '[Le héros s\'empare du trésor/élixir après l\'épreuve]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 10. LE CHEMIN DU RETOUR ===' },
      { type: 'action', content: '[Le héros doit rentrer avec ce qu\'il a gagné]' },
      { type: 'scene', content: 'EXT. CHEMIN DU RETOUR - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 11. LA RÉSURRECTION ===' },
      { type: 'action', content: '[Ultime épreuve, transformation finale du héros]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 12. LE RETOUR AVEC L\'ÉLIXIR ===' },
      { type: 'action', content: '[Le héros revient transformé avec le pouvoir de changer son monde]' },
      { type: 'scene', content: 'INT. MONDE ORDINAIRE - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  saveTheCat: {
    name: 'Save the Cat',
    icon: '🐱',
    description: 'Blake Snyder - 15 beats',
    elements: [
      { type: 'scene', content: '=== 1. IMAGE D\'OUVERTURE (p.1) ===' },
      { type: 'action', content: '[L\'image qui donne le ton. Miroir de l\'image finale.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 2. THÈME ÉNONCÉ (p.5) ===' },
      { type: 'action', content: '[Quelqu\'un dit au héros ce que sera sa leçon de vie]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 3. SET-UP (p.1-10) ===' },
      { type: 'action', content: '[Le monde "avant". Tout ce qui doit être fixé. Les 6 choses qui doivent être améliorées.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 4. CATALYSEUR (p.12) ===' },
      { type: 'action', content: '[L\'événement qui change tout. Télégramme, rencontre, découverte...]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 5. DÉBAT (p.12-25) ===' },
      { type: 'action', content: '[Le héros doute. Dernière chance de refuser l\'aventure.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 6. PASSAGE À L\'ACTE 2 (p.25) ===' },
      { type: 'action', content: '[Le héros choisit d\'agir. Il entre dans un monde inversé.]' },
      { type: 'scene', content: 'INT./EXT. NOUVEAU MONDE - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 7. HISTOIRE B (p.30) ===' },
      { type: 'action', content: '[L\'histoire d\'amour ou l\'histoire du thème. Nouveaux personnages.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 8. FUN AND GAMES (p.30-55) ===' },
      { type: 'action', content: '[La promesse du concept. Ce pourquoi le public est venu.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 9. MIDPOINT (p.55) ===' },
      { type: 'action', content: '[Fausse victoire ou fausse défaite. Les enjeux montent. Horloge activée.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 10. LES MÉCHANTS SE RAPPROCHENT (p.55-75) ===' },
      { type: 'action', content: '[Les forces antagonistes se regroupent. L\'équipe du héros se désagrège.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 11. TOUT EST PERDU (p.75) ===' },
      { type: 'action', content: '[L\'opposé du Midpoint. Mort du mentor. Tout semble fini.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 12. LA NUIT NOIRE DE L\'ÂME (p.75-85) ===' },
      { type: 'action', content: '[Le héros est au plus bas. Moment de réflexion profonde.]' },
      { type: 'scene', content: 'INT. LIEU ISOLÉ - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 13. PASSAGE À L\'ACTE 3 (p.85) ===' },
      { type: 'action', content: '[Eureka! La solution vient de l\'histoire B et du thème.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - AUBE' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 14. FINALE (p.85-110) ===' },
      { type: 'action', content: '[Le héros applique sa leçon. Confrontation finale. Nouveau monde créé.]' },
      { type: 'scene', content: 'INT./EXT. LIEU DU CLIMAX - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== 15. IMAGE FINALE (p.110) ===' },
      { type: 'action', content: '[L\'opposé de l\'image d\'ouverture. Preuve que le changement a eu lieu.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  },
  sequence: {
    name: 'Approche Séquentielle',
    icon: '🎬',
    description: '8 séquences de 12-15 pages',
    elements: [
      { type: 'scene', content: '=== SÉQUENCE 1 - STATUS QUO & INCIDENT (p.1-12) ===' },
      { type: 'action', content: '[Le monde du protagoniste. L\'incident déclencheur arrive à la fin.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 2 - PRÉDICAMENT (p.12-25) ===' },
      { type: 'action', content: '[Le héros réagit à l\'incident. Il formule son but.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 3 - PREMIÈRE TENTATIVE (p.25-37) ===' },
      { type: 'action', content: '[Première vraie tentative pour résoudre le problème.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 4 - PLUS GRAND OBSTACLE (p.37-50) ===' },
      { type: 'action', content: '[Les enjeux augmentent. Échec de la première approche.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 5 - PREMIER CLIMAX (p.50-62) ===' },
      { type: 'action', content: '[Point central. Le héros semble réussir ou échouer spectaculairement.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 6 - NOUVELLES COMPLICATIONS (p.62-75) ===' },
      { type: 'action', content: '[Les conséquences du midpoint créent de nouveaux problèmes.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR/NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 7 - SECOND CLIMAX (p.75-87) ===' },
      { type: 'action', content: '[Tout est perdu. Le héros touche le fond.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - NUIT' },
      { type: 'action', content: '' },
      { type: 'scene', content: '=== SÉQUENCE 8 - RÉSOLUTION (p.87-110) ===' },
      { type: 'action', content: '[Climax final et résolution. Le héros triomphe ou échoue définitivement.]' },
      { type: 'scene', content: 'INT./EXT. LIEU - JOUR' },
      { type: 'action', content: '' }
    ]
  }
};

// ============ MAIN EDITOR ============
export default function ScreenplayEditor() {
  const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: generateId(), type: 'scene', content: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorOffset, setCursorOffset] = useState(null); // For click-to-cursor positioning
  const [characters, setCharacters] = useState([]);
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // { id, elementId, elementIndex, originalText, suggestedText, startOffset, endOffset, userName, userColor, createdAt, status: 'pending'|'accepted'|'rejected' }
  const [textSelection, setTextSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset, rect }
  const [pendingInlineComment, setPendingInlineComment] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [pendingSuggestion, setPendingSuggestion] = useState(null); // { elementId, elementIndex, originalText, startOffset, endOffset }
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('editor');
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(null); // Index of element whose comment was clicked
  const [selectedCommentId, setSelectedCommentId] = useState(null); // ID of selected comment (for expanding)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(null); // ID of selected suggestion (for expanding)
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showOutline, setShowOutline] = useState(false);
  const [showSceneNumbers, setShowSceneNumbers] = useState(false);
  const [notes, setNotes] = useState({}); // { elementId: { content, color } }
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showImportSubmenu, setShowImportSubmenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [lockedScenes, setLockedScenes] = useState(new Set()); // Set of scene element IDs
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRenameChar, setShowRenameChar] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [sceneAssignments, setSceneAssignments] = useState({}); // { sceneId: { userId, userName, userColor } }
  const [assignmentMenu, setAssignmentMenu] = useState(null); // { sceneId, x, y }
  const [collaborators, setCollaborators] = useState([]); // All users who have access to this document
  const [showTimer, setShowTimer] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('chrono'); // 'chrono' or 'sprint'
  const [sprintDuration, setSprintDuration] = useState(25 * 60); // 25 minutes default
  const [sprintTimeLeft, setSprintTimeLeft] = useState(25 * 60);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [sessionStartWords, setSessionStartWords] = useState(0);
  const [sceneStatus, setSceneStatus] = useState({}); // { sceneId: 'draft' | 'review' | 'final' }
  const [outlineFilter, setOutlineFilter] = useState({ status: '', assignee: '' });
  const [showStatusDropdown, setShowStatusDropdown] = useState(false); // Custom dropdown for status filter
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false); // Custom dropdown for assignee filter
  const [outlineChapters, setOutlineChapters] = useState({}); // { sceneId: 'Acte 1' } - chapter before this scene
  const [editingChapter, setEditingChapter] = useState(null); // sceneId being edited
  const [lastSaved, setLastSaved] = useState(null);
  const [lastModifiedBy, setLastModifiedBy] = useState(null); // { userName, timestamp }
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [draggedScene, setDraggedScene] = useState(null);
  const [sceneSynopsis, setSceneSynopsis] = useState({}); // { sceneId: 'synopsis text' }
  const [visibleElementIndex, setVisibleElementIndex] = useState(0); // For scroll sync with comments
  const [elementPositions, setElementPositions] = useState({}); // { elementIndex: topPosition }
  const [scriptScrollHeight, setScriptScrollHeight] = useState(0);
  const [writingGoal, setWritingGoal] = useState(() => {
    const saved = localStorage.getItem('rooms-writing-goal');
    return saved ? JSON.parse(saved) : { daily: 1000, todayWords: 0, lastDate: null };
  });
  const [showGoToScene, setShowGoToScene] = useState(false);
  const [editingSynopsis, setEditingSynopsis] = useState(null);
  const [typewriterSound, setTypewriterSound] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // AI Rewrite states
  const [showAIRewrite, setShowAIRewrite] = useState(false);
  const [aiRewriteSelection, setAiRewriteSelection] = useState(null); // { elementId, elementIndex, text, startOffset, endOffset }
  const [aiRewriteMode, setAiRewriteMode] = useState(null); // 'concis', 'develop', 'reformulate', 'tone', 'custom'
  const [aiRewriteCustomPrompt, setAiRewriteCustomPrompt] = useState('');
  const [aiRewriteResult, setAiRewriteResult] = useState(null);
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiRewriteTone, setAiRewriteTone] = useState('dramatique'); // for tone mode
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chatNotificationSound, setChatNotificationSound] = useState(true);
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 340, y: 80 });
  const [notePosition, setNotePosition] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
  const [timerPosition, setTimerPosition] = useState({ x: window.innerWidth - 260, y: window.innerHeight - 350 });
  const [timerCompact, setTimerCompact] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const [isDraggingTimer, setIsDraggingTimer] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const socketRef = useRef(null);
  const loadedDocRef = useRef(null);
  const scriptContainerRef = useRef(null);
  const outlineSidebarRef = useRef(null);
  const commentsSidebarRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatNotificationSoundRef = useRef(chatNotificationSound);
  
  // Keep ref in sync
  useEffect(() => {
    chatNotificationSoundRef.current = chatNotificationSound;
  }, [chatNotificationSound]);

  // Simple 1:1 scroll sync between Script and Comments (like they're glued together)
  // + Scene-based sync between Script and Outline
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;
    
    let isScrollingComments = false;
    let isScrollingOutline = false;
    let outlineRAF = null;
    let lastTopScene = null;
    
    // Find which scene element is at the top of the script viewport
    const findTopSceneInScript = () => {
      const scriptRect = script.getBoundingClientRect();
      const sceneElements = script.querySelectorAll('[data-element-index]');
      
      for (const el of sceneElements) {
        const idx = parseInt(el.getAttribute('data-element-index'), 10);
        if (isNaN(idx) || elements[idx]?.type !== 'scene') continue;
        
        const rect = el.getBoundingClientRect();
        // Scene is at or near the top of the viewport
        if (rect.top >= scriptRect.top - 50 && rect.top <= scriptRect.top + 150) {
          return idx;
        }
        // First scene that's below the top (we've scrolled past it)
        if (rect.bottom > scriptRect.top + 50) {
          return idx;
        }
      }
      return null;
    };
    
    // Find which scene is at the top of the outline
    const findTopSceneInOutline = () => {
      const outline = outlineSidebarRef.current;
      if (!outline) return null;
      const outlineRect = outline.getBoundingClientRect();
      const sceneElements = outline.querySelectorAll('[data-outline-element-index]');
      
      for (const el of sceneElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= outlineRect.top - 20 && rect.top <= outlineRect.top + 80) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
        if (rect.bottom > outlineRect.top + 20) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
      }
      return null;
    };
    
    // Scroll outline to show a specific scene at top
    const scrollOutlineToScene = (sceneIndex) => {
      const outline = outlineSidebarRef.current;
      if (!outline) return;
      const sceneEl = outline.querySelector(`[data-outline-element-index="${sceneIndex}"]`);
      if (sceneEl) {
        const outlineRect = outline.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = outline.scrollTop + (sceneRect.top - outlineRect.top) - 10;
        outline.scrollTop = Math.max(0, targetScroll);
      }
    };
    
    // Scroll script to show a specific scene at top
    const scrollScriptToScene = (sceneIndex) => {
      const sceneEl = script.querySelector(`[data-element-index="${sceneIndex}"]`);
      if (sceneEl) {
        const scriptRect = script.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = script.scrollTop + (sceneRect.top - scriptRect.top) - 32;
        script.scrollTop = Math.max(0, targetScroll);
      }
    };
    
    const handleScriptScroll = () => {
      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;
      
      // 1:1 sync with comments
      if (!isScrollingComments && comments) {
        isScrollingComments = true;
        comments.scrollTop = script.scrollTop;
        requestAnimationFrame(() => { isScrollingComments = false; });
      }
      
      // Scene-based sync with outline (throttled)
      if (!isScrollingOutline && outline) {
        if (outlineRAF) cancelAnimationFrame(outlineRAF);
        outlineRAF = requestAnimationFrame(() => {
          const topScene = findTopSceneInScript();
          if (topScene !== null && topScene !== lastTopScene) {
            lastTopScene = topScene;
            isScrollingOutline = true;
            scrollOutlineToScene(topScene);
            setTimeout(() => { isScrollingOutline = false; }, 100);
          }
        });
      }
    };
    
    const handleCommentsScroll = () => {
      const comments = commentsSidebarRef.current;
      if (!comments) return;
      
      if (!isScrollingComments) {
        isScrollingComments = true;
        script.scrollTop = comments.scrollTop;
        requestAnimationFrame(() => { isScrollingComments = false; });
      }
    };
    
    const handleOutlineScroll = () => {
      if (isScrollingOutline) return;
      
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      outlineRAF = requestAnimationFrame(() => {
        const topScene = findTopSceneInOutline();
        if (topScene !== null && topScene !== lastTopScene) {
          lastTopScene = topScene;
          isScrollingOutline = true;
          scrollScriptToScene(topScene);
          // Comments will follow via the 1:1 sync (triggered by script scroll)
          setTimeout(() => { isScrollingOutline = false; }, 100);
        }
      });
    };
    
    // Attach listeners
    script.addEventListener('scroll', handleScriptScroll, { passive: true });
    
    // We need to attach outline/comments listeners when they become available
    // Use a MutationObserver or just check periodically
    let commentsListener = null;
    let outlineListener = null;
    
    const attachListeners = () => {
      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;
      
      if (comments && !commentsListener) {
        commentsListener = handleCommentsScroll;
        comments.addEventListener('scroll', commentsListener, { passive: true });
      }
      if (outline && !outlineListener) {
        outlineListener = handleOutlineScroll;
        outline.addEventListener('scroll', outlineListener, { passive: true });
      }
    };
    
    // Initial attach
    attachListeners();
    
    // Re-check after a short delay (in case panels just mounted)
    const attachTimeout = setTimeout(attachListeners, 100);
    const attachTimeout2 = setTimeout(attachListeners, 500);
    
    return () => {
      script.removeEventListener('scroll', handleScriptScroll);
      
      const comments = commentsSidebarRef.current;
      const outline = outlineSidebarRef.current;
      
      if (comments && commentsListener) {
        comments.removeEventListener('scroll', commentsListener);
      }
      if (outline && outlineListener) {
        outline.removeEventListener('scroll', outlineListener);
      }
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      clearTimeout(attachTimeout);
      clearTimeout(attachTimeout2);
    };
  }, [showComments, showOutline, elements]);

  // Track script's scrollHeight for comments sidebar min-height
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;
    
    const updateHeight = () => {
      setScriptScrollHeight(script.scrollHeight);
    };
    
    updateHeight();
    
    // Use ResizeObserver to track content height changes
    const observer = new ResizeObserver(updateHeight);
    observer.observe(script);
    
    return () => observer.disconnect();
  }, [elements.length]);
  
  // Chat notification audio - Web Audio synthesis
  const playChatNotification = useCallback(() => {
    if (!chatNotificationSoundRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      
      // Create pleasant notification chime (two notes)
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.2);
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleHash = () => { 
      const newDocId = window.location.hash.slice(1) || null;
      if (newDocId !== docId) {
        loadedDocRef.current = null;
        setDocId(newDocId);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [docId]);

  // Auto-backup to localStorage every 30 seconds
  useEffect(() => {
    if (!docId || elements.length === 0) return;
    const backupInterval = setInterval(() => {
      const backup = {
        docId,
        title,
        elements,
        timestamp: new Date().toISOString(),
        sceneSynopsis,
        sceneStatus,
        notes
      };
      localStorage.setItem(`rooms-backup-${docId}`, JSON.stringify(backup));
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [docId, title, elements, sceneSynopsis, sceneStatus, notes]);

  // Track last saved state for auto-save comparison
  const lastSavedElementsRef = useRef(null);
  const lastSavedTitleRef = useRef(null);
  
  // Auto-save to cloud every 5 seconds (only if changes detected)
  useEffect(() => {
    if (!docId || !token || elements.length === 0) return;
    
    const autoSaveInterval = setInterval(async () => {
      // Check if there are changes since last save
      const elementsChanged = JSON.stringify(elements) !== JSON.stringify(lastSavedElementsRef.current);
      const titleChanged = title !== lastSavedTitleRef.current;
      
      if (elementsChanged || titleChanged) {
        try {
          const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/autosave', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ title, elements })
          });
          if (res.ok) {
            lastSavedElementsRef.current = JSON.parse(JSON.stringify(elements));
            lastSavedTitleRef.current = title;
            setLastSaved(new Date());
          }
        } catch (err) { 
          console.error('[AUTOSAVE] Error:', err); 
        }
      }
    }, 5000);
    
    return () => clearInterval(autoSaveInterval);
  }, [docId, token, elements, title]);

  // Helper to format snapshot name: "Title - MMDDYY HH:MM"
  const formatSnapshotName = (docTitle, isAuto = false) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const prefix = isAuto ? '[Auto] ' : '';
    return `${prefix}${docTitle} - ${mm}${dd}${yy} ${hh}:${min}`;
  };

  // Auto-snapshot every 15 minutes (only when document is open and has content)
  useEffect(() => {
    if (!docId || !token || elements.length === 0) return;
    
    const autoSnapshotInterval = setInterval(async () => {
      // Only create snapshot if document has meaningful content
      const hasContent = elements.some(el => el.content && el.content.trim().length > 0);
      if (!hasContent) return;
      
      try {
        const snapshotName = formatSnapshotName(title, true);
        const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ title, elements, auto: true, snapshotName })
        });
        if (res.ok) {
          console.log('[AUTO-SNAPSHOT] Created:', snapshotName);
        }
      } catch (err) { 
        console.error('[AUTO-SNAPSHOT] Error:', err); 
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => clearInterval(autoSnapshotInterval);
  }, [docId, token, elements, title]);

  // Track writing goals daily reset
  useEffect(() => {
    const today = new Date().toDateString();
    if (writingGoal.lastDate !== today) {
      setWritingGoal(prev => ({ ...prev, todayWords: 0, lastDate: today }));
    }
  }, [writingGoal.lastDate]);

  // Save writing goal to localStorage
  useEffect(() => {
    localStorage.setItem('rooms-writing-goal', JSON.stringify(writingGoal));
  }, [writingGoal]);

  // Stats calculation - MUST be before useEffects that use it
  const stats = useMemo(() => {
    const allText = elements.map(el => el.content).join(' ');
    const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    const chars = allText.length;
    const scenes = elements.filter(el => el.type === 'scene').length;
    
    // Advanced stats
    const dialogueWords = elements
      .filter(el => el.type === 'dialogue')
      .map(el => el.content.trim().split(/\s+/).length)
      .reduce((a, b) => a + b, 0);
    const actionWords = elements
      .filter(el => el.type === 'action')
      .map(el => el.content.trim().split(/\s+/).length)
      .reduce((a, b) => a + b, 0);
    
    const dialogueRatio = words > 0 ? Math.round((dialogueWords / words) * 100) : 0;
    const readingTimeMin = Math.ceil(words / 200); // ~200 words/min for screenplay
    const screenTimeMin = Math.round(words / 150); // ~1 page/min, ~150 words/page
    
    return { words, chars, scenes, dialogueWords, actionWords, dialogueRatio, readingTimeMin, screenTimeMin };
  }, [elements]);

  // Track word count changes for writing goals
  const prevWordCountRef = useRef(0);
  useEffect(() => {
    if (stats.words > prevWordCountRef.current && prevWordCountRef.current > 0) {
      const wordsAdded = stats.words - prevWordCountRef.current;
      if (wordsAdded > 0 && wordsAdded < 100) { // Sanity check - ignore large jumps (like loading a doc)
        setWritingGoal(prev => ({ ...prev, todayWords: prev.todayWords + wordsAdded }));
      }
    }
    prevWordCountRef.current = stats.words;
  }, [stats.words]);

  // Load document via REST API
  useEffect(() => {
    const loadDocument = async () => {
      if (!docId) {
        setElements([{ id: generateId(), type: 'scene', content: '' }]);
        setTitle('SANS TITRE');
        return;
      }
      if (loadedDocRef.current === docId) return;
      
      setLoading(true);
      try {
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        const res = await fetch(SERVER_URL + '/api/documents/' + docId, { headers });
        if (res.ok) {
          const data = await res.json();
          console.log('[LOAD] Document loaded with', data.elements?.length, 'elements');
          if (data.elements && data.elements.length > 0) {
            setTitle(data.title || 'SANS TITRE');
            setElements(data.elements);
            setCharacters(data.characters || []);
            setComments(data.comments || []);
            setSuggestions(data.suggestions || []);
            loadedDocRef.current = docId;
            if (data.isOwner) setMyRole('editor');
            else if (data.publicAccess?.enabled) setMyRole(data.publicAccess.role || 'viewer');
            else setMyRole('viewer');
          }
        }
      } catch (err) { console.error('[LOAD] Error:', err); }
      // Small delay to let React render elements before hiding overlay
      setTimeout(() => setLoading(false), 100);
    };
    loadDocument();
  }, [docId, token]);

  // Socket connection
  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;
    
    socket.on('connect', () => { setConnected(true); setMyId(socket.id); if (docId) socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('document-state', data => { 
      setUsers(data.users || []); 
      if (data.role) setMyRole(data.role);
      if (data.suggestions) setSuggestions(data.suggestions);
      // Use server collaborators if available, otherwise build from online users
      console.log('Received collaborators:', data.collaborators);
      if (data.collaborators && data.collaborators.length > 0) {
        setCollaborators(data.collaborators);
      }
    });
    socket.on('title-updated', ({ title }) => setTitle(title));
    socket.on('element-updated', ({ index, element }) => setElements(p => { const u = [...p]; if (index >= 0 && index < u.length) u[index] = element; return u; }));
    socket.on('element-type-updated', ({ index, type }) => setElements(p => { const u = [...p]; if (index >= 0 && index < u.length) u[index] = { ...u[index], type }; return u; }));
    socket.on('element-inserted', ({ afterIndex, element }) => setElements(p => { const u = [...p]; u.splice(afterIndex + 1, 0, element); return u; }));
    socket.on('element-deleted', ({ index }) => setElements(p => p.filter((_, i) => i !== index)));
    socket.on('user-joined', ({ users }) => setUsers(users));
    socket.on('user-left', ({ users }) => setUsers(users));
    socket.on('cursor-updated', ({ userId, cursor }) => setUsers(p => p.map(u => u.id === userId ? { ...u, cursor } : u)));
    socket.on('document-restored', ({ title, elements }) => { setTitle(title); setElements(elements); });
    socket.on('comment-added', ({ comment }) => setComments(p => [...p, comment]));
    socket.on('comment-reply-added', ({ commentId, reply }) => setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, replies: [...(c.replies || []), reply] } : c)));
    socket.on('comment-resolved', ({ commentId, resolved }) => setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, resolved } : c)));
    socket.on('comment-deleted', ({ commentId }) => setComments(p => p.filter(c => c.id !== commentId && c._id !== commentId)));
    socket.on('comment-updated', ({ commentId, content }) => setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, content } : c)));
    
    // Suggestion socket listeners
    socket.on('suggestion-added', ({ suggestion }) => setSuggestions(p => [...p, suggestion]));
    socket.on('suggestion-accepted', ({ suggestionId }) => setSuggestions(p => p.filter(s => s.id !== suggestionId)));
    socket.on('suggestion-rejected', ({ suggestionId }) => setSuggestions(p => p.filter(s => s.id !== suggestionId)));
    
    // Chat messages
    socket.on('chat-message', (message) => {
      // Deduplicate - don't add if already exists
      setChatMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Increment unread if chat is closed and message is from someone else
      if (message.senderId !== socket.id) {
        setUnreadMessages(prev => prev + 1);
        playChatNotification();
      }
    });
    socket.on('chat-history', (messages) => setChatMessages(messages));
    
    return () => socket.disconnect();
  }, [docId, token, playChatNotification]);

  const handleLogin = (user, newToken) => { 
    setCurrentUser(user); 
    setToken(newToken); 
    setShowAuthModal(false);
  };
  const handleLogout = () => { 
    localStorage.removeItem('screenplay-token'); 
    localStorage.removeItem('screenplay-user'); 
    setCurrentUser(null); 
    setToken(null); 
    // Return to blank document state
    window.location.hash = '';
    setElements([{ id: Date.now().toString(), type: 'scene', content: '' }]);
    setTitle('Sans titre');
    setComments({});
    setNotes({});
    setChatMessages([]);
    loadedDocRef.current = null;
  };

  // Send chat message
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current || !connected || !docId) return;
    
    const message = {
      id: generateId(),
      senderId: myId,
      senderName: currentUser?.name || 'Anonyme',
      senderColor: users.find(u => u.id === myId)?.color || '#3b82f6',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    socketRef.current.emit('chat-message', { docId, message });
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
  }, [chatInput, connected, docId, myId, currentUser, users]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Clear unread when opening chat
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Save chat history to localStorage
  useEffect(() => {
    if (docId && chatMessages.length > 0) {
      localStorage.setItem(`rooms-chat-${docId}`, JSON.stringify(chatMessages.slice(-100))); // Keep last 100 messages
    }
  }, [chatMessages, docId]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (docId) {
      const saved = localStorage.getItem(`rooms-chat-${docId}`);
      if (saved) {
        try {
          const messages = JSON.parse(saved);
          if (messages.length > 0 && chatMessages.length === 0) {
            setChatMessages(messages);
          }
        } catch (e) {}
      }
    }
  }, [docId]); // eslint-disable-line

  // Apply pending template after document loads
  useEffect(() => {
    const pendingTemplate = localStorage.getItem('pendingTemplate');
    if (pendingTemplate && socketRef.current && elements.length <= 2) {
      const template = SCRIPT_TEMPLATES[pendingTemplate];
      if (template) {
        // Clear the pending template
        localStorage.removeItem('pendingTemplate');
        
        // Apply template elements
        const templateElements = template.elements.map(el => ({
          id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          type: el.type,
          content: el.content
        }));
        
        setElements(templateElements);
        
        // Sync to server
        templateElements.forEach((el, idx) => {
          if (idx === 0) {
            socketRef.current.emit('element-change', { index: 0, element: el });
          } else {
            socketRef.current.emit('element-insert', { afterIndex: idx - 1, element: el });
          }
        });
        
        // Set title based on template
        const newTitle = `Nouveau script - ${template.name}`;
        setTitle(newTitle);
        socketRef.current.emit('title-change', { title: newTitle });
      }
    }
  }, [elements.length]); // eslint-disable-line

  // Clear text selection when clicking elsewhere
  useEffect(() => {
    const handleClick = (e) => {
      if (textSelection && !e.target.closest('.text-selection-popup') && !e.target.closest('textarea')) {
        setTextSelection(null);
      }
    };
    
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [textSelection]);

  // Drag handlers for floating panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingChat) {
        e.preventDefault();
        setChatPosition({
          x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingNote) {
        e.preventDefault();
        setNotePosition({
          x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingTimer) {
        e.preventDefault();
        setTimerPosition({
          x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingNote(false);
      setIsDraggingTimer(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    if (isDraggingChat || isDraggingNote || isDraggingTimer) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingChat, isDraggingNote, isDraggingTimer]);
  
  // Check if any panel is being dragged (for overlay)
  const isDraggingAny = isDraggingChat || isDraggingNote || isDraggingTimer;

  const createNewDocument = async (templateKey = null) => {
    if (!token) { setShowAuthModal(true); return; }
    try {
      const res = await fetch(SERVER_URL + '/api/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      loadedDocRef.current = null;
      
      // If template selected, store it for after the document loads
      if (templateKey && SCRIPT_TEMPLATES[templateKey]) {
        localStorage.setItem('pendingTemplate', templateKey);
      }
      
      window.location.hash = data.id;
      setShowDocsList(false);
      setShowTemplateModal(false);
    } catch (err) { console.error(err); }
  };

  const selectDocument = (id) => { loadedDocRef.current = null; window.location.hash = id; setShowDocsList(false); };

  const navigateToElement = useCallback((index) => {
    setActiveIndex(index);
    setTimeout(() => { const el = document.querySelector(`[data-element-index="${index}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  }, []);

  // Group elements into pages
  const pages = useMemo(() => {
    const result = [];
    let currentPage = { number: 1, elements: [] };
    let h = 0;
    const getLines = el => { 
      const l = el.content ? Math.ceil(el.content.length / 60) : 1; 
      const e = { scene: 2, action: 1, character: 2, dialogue: 0.5, parenthetical: 1, transition: 2 }; 
      return l + (e[el.type] || 0); 
    };
    
    elements.forEach((el, idx) => {
      const lines = getLines(el);
      if (h + lines > LINES_PER_PAGE && currentPage.elements.length > 0) {
        result.push(currentPage);
        currentPage = { number: currentPage.number + 1, elements: [] };
        h = 0;
      }
      currentPage.elements.push({ element: el, index: idx });
      h += lines;
    });
    
    if (currentPage.elements.length > 0) {
      result.push(currentPage);
    }
    
    return result;
  }, [elements]);

  const totalPages = pages.length;
  const extractedCharacters = useMemo(() => { const c = new Set(characters); elements.forEach(el => { if (el.type === 'character' && el.content.trim()) c.add(el.content.trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); }); return Array.from(c).sort(); }, [elements, characters]);
  const remoteCursors = useMemo(() => users.filter(u => u.id !== myId), [users, myId]);
  const canEdit = myRole === 'editor';
  const canComment = myRole === 'editor' || myRole === 'commenter';

  // Check if an element is in a locked scene
  const isElementLocked = useCallback((elementIndex) => {
    // Find which scene this element belongs to
    let currentSceneId = null;
    for (let i = elementIndex; i >= 0; i--) {
      if (elements[i]?.type === 'scene') {
        currentSceneId = elements[i].id;
        break;
      }
    }
    
    // Check if globally locked
    if (currentSceneId && lockedScenes.has(currentSceneId)) {
      return true;
    }
    
    // Check if assigned to another user (user-specific lock)
    if (currentSceneId && sceneAssignments[currentSceneId]) {
      const assignment = sceneAssignments[currentSceneId];
      // If assigned to someone else, it's locked for current user
      if (assignment.userId && assignment.userId !== myId) {
        return true;
      }
    }
    
    return false;
  }, [elements, lockedScenes, sceneAssignments, myId]);

  const totalComments = comments.filter(c => !c.resolved).length;

  // Outline - list of scenes with their index
  const outline = useMemo(() => {
    const scenes = [];
    let sceneNumber = 0;
    
    // First pass: collect scene indices
    const sceneIndices = [];
    elements.forEach((el, idx) => {
      if (el.type === 'scene') {
        sceneIndices.push(idx);
      }
    });
    
    // Second pass: calculate word count and characters for each scene
    elements.forEach((el, idx) => {
      if (el.type === 'scene') {
        sceneNumber++;
        const sceneIdx = sceneIndices.indexOf(idx);
        const nextSceneIdx = sceneIndices[sceneIdx + 1] || elements.length;
        
        // Count words and collect characters in this scene
        let wordCount = 0;
        const sceneCharacters = new Set();
        for (let i = idx; i < nextSceneIdx; i++) {
          const content = elements[i]?.content || '';
          wordCount += content.trim().split(/\s+/).filter(w => w).length;
          if (elements[i]?.type === 'character') {
            sceneCharacters.add(content.toUpperCase());
          }
        }
        
        scenes.push({
          index: idx,
          number: sceneNumber,
          content: el.content || '(sans titre)',
          id: el.id,
          wordCount,
          characters: [...sceneCharacters]
        });
      }
    });
    return scenes;
  }, [elements]);

  // Filtered outline based on filters
  const filteredOutline = useMemo(() => {
    return outline.filter(scene => {
      // Filter by status
      if (outlineFilter.status && sceneStatus[scene.id] !== outlineFilter.status) return false;
      // Filter by assignee
      if (outlineFilter.assignee) {
        const assignment = sceneAssignments[scene.id];
        if (!assignment || assignment.userName !== outlineFilter.assignee) return false;
      }
      return true;
    });
  }, [outline, outlineFilter, sceneStatus, sceneAssignments]);

  // Find current scene based on activeIndex
  const currentSceneNumber = useMemo(() => {
    let lastScene = 0;
    for (let i = 0; i <= activeIndex; i++) {
      if (elements[i]?.type === 'scene') lastScene++;
    }
    return lastScene;
  }, [elements, activeIndex]);

  // Map element ID to scene number (for display in script)
  const sceneNumbersMap = useMemo(() => {
    const map = {};
    let num = 0;
    elements.forEach(el => {
      if (el.type === 'scene') {
        num++;
        map[el.id] = num;
      }
    });
    return map;
  }, [elements]);

  // Extract locations from scene headings
  const extractedLocations = useMemo(() => {
    const locs = new Set();
    elements.forEach(el => {
      if (el.type === 'scene' && el.content) {
        // Extract location: "INT. MAISON - JOUR" -> "MAISON"
        const match = el.content.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)(?:\s*-\s*(?:JOUR|NUIT|MATIN|SOIR|AUBE|CRÉPUSCULE|CONTINUOUS|LATER|SAME))?$/i);
        if (match && match[1]) {
          locs.add(match[1].trim().toUpperCase());
        }
      }
    });
    return Array.from(locs).sort();
  }, [elements]);

  // Character statistics
  const characterStats = useMemo(() => {
    const stats = {};
    let currentScene = 0;
    
    elements.forEach((el, idx) => {
      if (el.type === 'scene') {
        currentScene++;
      }
      if (el.type === 'character' && el.content.trim()) {
        const name = el.content.trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
        if (!stats[name]) {
          stats[name] = { 
            name, 
            lines: 0, 
            firstAppearance: currentScene || 1,
            firstIndex: idx,
            scenes: new Set()
          };
        }
        stats[name].lines++;
        if (currentScene > 0) stats[name].scenes.add(currentScene);
      }
    });
    
    // Convert scenes Set to count
    Object.values(stats).forEach(s => {
      s.sceneCount = s.scenes.size;
      delete s.scenes;
    });
    
    return Object.values(stats).sort((a, b) => b.lines - a.lines);
  }, [elements]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = [];
    const query = searchQuery.toLowerCase();
    elements.forEach((el, idx) => {
      if (el.content.toLowerCase().includes(query)) {
        results.push({ index: idx, element: el });
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, elements]);

  const goToSearchResult = (direction) => {
    if (searchResults.length === 0) return;
    let newIndex = currentSearchIndex + direction;
    if (newIndex < 0) newIndex = searchResults.length - 1;
    if (newIndex >= searchResults.length) newIndex = 0;
    setCurrentSearchIndex(newIndex);
    const result = searchResults[newIndex];
    setActiveIndex(result.index);
    setTimeout(() => {
      const el = document.querySelector(`[data-element-index="${result.index}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const replaceOne = () => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const result = searchResults[currentSearchIndex];
    const el = elements[result.index];
    const newContent = el.content.replace(new RegExp(searchQuery, 'i'), replaceQuery);
    updateElement(result.index, { ...el, content: newContent });
  };

  const replaceAll = () => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const regex = new RegExp(searchQuery, 'gi');
    elements.forEach((el, idx) => {
      if (el.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        const newContent = el.content.replace(regex, replaceQuery);
        updateElement(idx, { ...el, content: newContent });
      }
    });
    setSearchQuery('');
    setShowSearch(false);
  };

  // Navigate to scene from outline
  const navigateToScene = (index) => {
    setActiveIndex(index);
    setTimeout(() => {
      const el = document.querySelector(`[data-element-index="${index}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Navigate to scene by number
  const navigateToSceneByNumber = (sceneNumber) => {
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    if (sceneNumber >= 1 && sceneNumber <= sceneIndices.length) {
      navigateToScene(sceneIndices[sceneNumber - 1]);
    }
  };

  // Create snapshot manually
  const createSnapshot = async () => {
    if (!token || !docId) return;
    try {
      const snapshotName = formatSnapshotName(title, false);
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title, elements, auto: false, snapshotName })
      });
      if (res.ok) {
        console.log('[SNAPSHOT] Created:', snapshotName);
        setLastSaved(new Date());
        // Brief visual feedback
        const btn = document.querySelector('[title="Snapshot (⌘S)"]');
        if (btn) {
          btn.style.background = '#059669';
          setTimeout(() => { btn.style.background = 'transparent'; }, 500);
        }
      }
    } catch (err) { console.error(err); }
  };

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowToolsMenu(false);
      setShowDocMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Writing timer - supports both chrono (count up) and sprint (countdown) modes
  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        if (timerMode === 'chrono') {
          setTimerSeconds(s => s + 1);
        } else {
          // Sprint mode - countdown
          setSprintTimeLeft(t => {
            if (t <= 1) {
              // Sprint finished!
              setTimerRunning(false);
              // Play sound notification
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleB8LZKzW8NJ2KQ5TiMD6zYI+E0R1sbznl0gaMmKe0eOmWyAbJ0+Ax+e+fD8kXqLk9Nhnf0lVhKSsloFzYGJ6mamgejEgI0RtiJuTfl9OUUZ9oL62p4JlPUBakL7NoIVpKnuq1c2RUy4qXIvG7MB3QiQ4WpTK76tiOipGe6/e2aFXMSVCcKPk7MJqPSZAX5XX8NN9QwkqXJjH3pd5MChLkdT+wpqBVzI0');
                audio.play().catch(() => {});
              } catch (e) {}
              // Show alert
              alert('🎉 Sprint terminé ! Bravo !');
              return sprintDuration; // Reset for next sprint
            }
            return t - 1;
          });
          setTimerSeconds(s => s + 1); // Still track total time
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerMode, sprintDuration]);

  // Track session word count
  useEffect(() => {
    if (timerRunning && sessionStartWords === 0) {
      setSessionStartWords(stats.words);
    }
    if (timerRunning) {
      setSessionWordCount(Math.max(0, stats.words - sessionStartWords));
    }
  }, [stats.words, timerRunning, sessionStartWords]);

  const resetTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(false);
    setSessionWordCount(0);
    setSessionStartWords(0);
    setSprintTimeLeft(sprintDuration);
  };

  // Change sprint duration
  const setSprintMinutes = (minutes) => {
    const seconds = minutes * 60;
    setSprintDuration(seconds);
    setSprintTimeLeft(seconds);
  };

  // Track element positions for comments sync (Google Docs style)
  useEffect(() => {
    if (!showComments) return;
    
    // Collect element positions - only update when needed
    const updatePositions = () => {
      const positions = {};
      const elementDivs = document.querySelectorAll('[data-element-index]');
      elementDivs.forEach(div => {
        const index = parseInt(div.getAttribute('data-element-index'), 10);
        if (!isNaN(index)) {
          const rect = div.getBoundingClientRect();
          const containerRect = scriptContainerRef.current?.getBoundingClientRect();
          const containerScrollTop = scriptContainerRef.current?.scrollTop || 0;
          if (containerRect) {
            positions[index] = rect.top - containerRect.top + containerScrollTop;
          } else {
            positions[index] = rect.top + window.scrollY - 60;
          }
        }
      });
      setElementPositions(positions);
    };
    
    // Initial update
    updatePositions();
    
    // Update on resize
    window.addEventListener('resize', updatePositions);
    
    // Update positions less frequently (elements rarely change height)
    const positionInterval = setInterval(updatePositions, 2000);
    
    return () => {
      window.removeEventListener('resize', updatePositions);
      clearInterval(positionInterval);
    };
  }, [showComments, elements.length]);

  // Pre-compute highlights per element (memoized for performance)
  const highlightsByElement = useMemo(() => {
    const map = {};
    
    // Process comments
    comments.forEach(c => {
      if (c.elementId && c.highlight && !c.resolved) {
        if (!map[c.elementId]) map[c.elementId] = [];
        map[c.elementId].push({
          startOffset: c.highlight.startOffset,
          endOffset: c.highlight.endOffset,
          type: 'comment',
          id: String(c.id || c._id),
          userColor: c.userColor
        });
      }
    });
    
    // Process suggestions
    suggestions.forEach(s => {
      if (s.elementId && s.status === 'pending') {
        if (!map[s.elementId]) map[s.elementId] = [];
        map[s.elementId].push({
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          type: 'suggestion',
          id: String(s.id || s._id),
          originalText: s.originalText,
          suggestedText: s.suggestedText,
          userColor: s.userColor
        });
      }
    });
    
    // Sort each element's highlights
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.startOffset - b.startOffset);
    });
    
    return map;
  }, [comments, suggestions]);

  // Get highlight data for an element (now just a lookup)
  const getElementHighlights = useCallback((elementId) => {
    return highlightsByElement[elementId] || [];
  }, [highlightsByElement]);

  // Apply CSS Highlights globally
  useEffect(() => {
    // Check if CSS Highlight API is supported
    if (typeof CSS === 'undefined' || !CSS.highlights) {
      return;
    }
    
    // Clear all existing highlights
    CSS.highlights.delete('comment-highlight');
    CSS.highlights.delete('suggestion-highlight');
    
    const commentRanges = [];
    const suggestionRanges = [];
    
    // Find all elements with highlights
    elements.forEach(element => {
      const highlights = getElementHighlights(element.id);
      if (highlights.length === 0) return;
      
      // Find the DOM element
      const domEl = document.querySelector(`[data-element-id="${element.id}"]`);
      if (!domEl) return;
      
      highlights.forEach(h => {
        try {
          // Find the correct text node and offsets using TreeWalker
          const walker = document.createTreeWalker(domEl, NodeFilter.SHOW_TEXT, null, false);
          let currentOffset = 0;
          let startNode = null, startOffset = 0;
          let endNode = null, endOffset = 0;
          
          let node = walker.nextNode();
          
          while (node) {
            const nodeLength = node.textContent.length;
            
            // Check if start is in this node
            if (!startNode && currentOffset + nodeLength > h.startOffset) {
              startNode = node;
              startOffset = h.startOffset - currentOffset;
            }
            
            // Check if end is in this node
            if (!endNode && currentOffset + nodeLength >= h.endOffset) {
              endNode = node;
              endOffset = h.endOffset - currentOffset;
              break;
            }
            
            currentOffset += nodeLength;
            node = walker.nextNode();
          }
          
          if (startNode && endNode) {
            const range = new Range();
            range.setStart(startNode, Math.min(startOffset, startNode.textContent.length));
            range.setEnd(endNode, Math.min(endOffset, endNode.textContent.length));
            
            if (h.type === 'comment') {
              commentRanges.push(range);
            } else if (h.type === 'suggestion') {
              suggestionRanges.push(range);
            }
          }
        } catch (err) {
          // Silently ignore highlight errors
        }
      });
    });
    
    // Create and register the highlights
    if (commentRanges.length > 0) {
      // eslint-disable-next-line no-undef
      const commentHighlight = new Highlight(...commentRanges);
      CSS.highlights.set('comment-highlight', commentHighlight);
    }
    if (suggestionRanges.length > 0) {
      // eslint-disable-next-line no-undef
      const suggestionHighlight = new Highlight(...suggestionRanges);
      CSS.highlights.set('suggestion-highlight', suggestionHighlight);
    }
    
    // Cleanup function
    return () => {
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        CSS.highlights.delete('comment-highlight');
        CSS.highlights.delete('suggestion-highlight');
      }
    };
  }, [elements, comments, suggestions, activeIndex, getElementHighlights]);

  // Get initials from a name (e.g. "Jeremie Goldstein" -> "JG", "RomainV" -> "RV")
  // Render text content with highlighted comments (legacy fallback)
  const renderTextWithHighlights = (content, elementId) => {
    if (!content) return '';
    
    // Find all highlights for this element (comments)
    const elementHighlights = comments
      .filter(c => c.elementId === elementId && c.highlight && !c.resolved)
      .map(c => ({
        ...c.highlight,
        type: 'comment',
        commentId: c.id,
        userColor: c.userColor
      }));
    
    // Find all suggestions for this element
    const elementSuggestions = suggestions
      .filter(s => s.elementId === elementId && s.status === 'pending')
      .map(s => ({
        startOffset: s.startOffset,
        endOffset: s.endOffset,
        type: 'suggestion',
        suggestionId: s.id,
        originalText: s.originalText,
        suggestedText: s.suggestedText,
        userColor: s.userColor
      }));
    
    // Combine and sort by startOffset
    const allHighlights = [...elementHighlights, ...elementSuggestions]
      .sort((a, b) => a.startOffset - b.startOffset);
    
    if (allHighlights.length === 0) {
      return content;
    }
    
    // Build segments with highlights
    const segments = [];
    let lastIndex = 0;
    
    allHighlights.forEach((highlight) => {
      // Add text before this highlight
      if (highlight.startOffset > lastIndex) {
        segments.push({
          type: 'text',
          content: content.slice(lastIndex, highlight.startOffset)
        });
      }
      
      if (highlight.type === 'comment') {
        // Comment highlight
        segments.push({
          type: 'highlight',
          content: content.slice(highlight.startOffset, highlight.endOffset),
          commentId: highlight.commentId,
          userColor: highlight.userColor
        });
      } else if (highlight.type === 'suggestion') {
        // Suggestion: show original (strikethrough) + suggested (green)
        segments.push({
          type: 'suggestion',
          originalContent: content.slice(highlight.startOffset, highlight.endOffset),
          suggestedContent: highlight.suggestedText,
          suggestionId: highlight.suggestionId,
          userColor: highlight.userColor
        });
      }
      
      lastIndex = highlight.endOffset;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }
    
    return segments.map((seg, idx) => {
      if (seg.type === 'highlight') {
        return (
          <span
            key={idx}
            data-comment-id={seg.commentId}
            style={{
              background: 'rgba(251, 191, 36, 0.4)',
              borderBottom: `2px solid ${seg.userColor || '#f59e0b'}`,
              cursor: 'text',
              borderRadius: 2,
              padding: '0 1px'
            }}
            title="Cliquer pour voir le commentaire"
          >
            {seg.content}
          </span>
        );
      }
      if (seg.type === 'suggestion') {
        return (
          <span key={idx} data-suggestion-id={seg.suggestionId} style={{ cursor: 'pointer' }}>
            <span
              style={{
                textDecoration: 'line-through',
                color: '#dc2626'
              }}
            >
              {seg.originalContent}
            </span>
            <span
              style={{
                color: '#16a34a'
              }}
            >
              {seg.suggestedContent}
            </span>
          </span>
        );
      }
      return <span key={idx}>{seg.content}</span>;
    });
  };

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/[\s]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Single word - take first 2 chars or first letter if uppercase detected
    const match = name.match(/[A-Z]/g);
    if (match && match.length >= 2) {
      return match.slice(0, 2).join('');
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);
  
  // Save to undo stack before changes - MUST be before useEffect that uses undo/redo
  const pushToUndo = useCallback((elementsSnapshot) => {
    setUndoStack(prev => [...prev.slice(-50), elementsSnapshot]); // Keep last 50
    setRedoStack([]); // Clear redo on new action
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, elements]);
    setUndoStack(prev => prev.slice(0, -1));
    setElements(previous);
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: previous });
    }
  }, [undoStack, elements, connected, canEdit]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, elements]);
    setRedoStack(prev => prev.slice(0, -1));
    setElements(next);
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: next });
    }
  }, [redoStack, elements, connected, canEdit]);

  // Duplicate scene function (moved here for proper hoisting)
  const duplicateScene = useCallback((sceneIndex) => {
    pushToUndo(elements);
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const currentScenePos = sceneIndices.indexOf(sceneIndex);
    const nextSceneIndex = currentScenePos < sceneIndices.length - 1 ? sceneIndices[currentScenePos + 1] : elements.length;
    
    // Get all elements in this scene
    const sceneElements = elements.slice(sceneIndex, nextSceneIndex).map(el => ({
      ...el,
      id: generateId()
    }));
    
    // Insert after the scene
    const newElements = [
      ...elements.slice(0, nextSceneIndex),
      ...sceneElements,
      ...elements.slice(nextSceneIndex)
    ];
    
    setElements(newElements);
    setLastSaved(new Date());
    
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: newElements });
    }
  }, [elements, connected, canEdit, pushToUndo]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Cmd+S = Snapshot
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        createSnapshot();
      }
      // Cmd+F = Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Cmd+O = Outline (prevent default open file dialog)
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowOutline(prev => !prev);
      }
      // Cmd+N = Add note to current element (prevent default new window)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && docId) {
        e.preventDefault();
        setShowNoteFor(elements[activeIndex]?.id);
      }
      // Cmd+? or Cmd+/ = Show shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      // Cmd+. = Focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Cmd+Z = Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd+Shift+Z = Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd+G = Go to scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setShowGoToScene(true);
      }
      // Cmd+D = Duplicate current scene
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        // Find the current scene (look backward from activeIndex for a scene element)
        let sceneIdx = activeIndex;
        while (sceneIdx >= 0 && elements[sceneIdx]?.type !== 'scene') {
          sceneIdx--;
        }
        if (sceneIdx >= 0) {
          duplicateScene(sceneIdx);
        }
      }
      // Escape = Close panels (one at a time)
      if (e.key === 'Escape') {
        if (showGoToScene) { setShowGoToScene(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showRenameChar) { setShowRenameChar(false); return; }
        if (showNoteFor) { setShowNoteFor(null); return; }
        if (showSearch) { setShowSearch(false); return; }
        if (showCharactersPanel) { setShowCharactersPanel(false); return; }
        if (showOutline) setShowOutline(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSearch, showOutline, showNoteFor, showCharactersPanel, showShortcuts, showRenameChar, showGoToScene, token, docId, title, elements, activeIndex, undo, redo, duplicateScene]);

  // Typewriter sound effect - placeholder for custom audio files
  // To add real typewriter sounds, place audio files in public folder and update URLs below
  const typewriterAudioRef = useRef({
    key: null,
    enter: null,
    backspace: null,
    initialized: false
  });
  
  const playTypewriterSound = useCallback((type = 'key') => {
    if (!typewriterSound) return;
    
    // Initialize audio elements on first use
    if (!typewriterAudioRef.current.initialized) {
      typewriterAudioRef.current = {
        initialized: true,
        // Replace these URLs with your own typewriter sound files:
        // key: new Audio('/sounds/typewriter-key.mp3'),
        // enter: new Audio('/sounds/typewriter-return.mp3'),
        // backspace: new Audio('/sounds/typewriter-backspace.mp3'),
        key: null,
        enter: null,
        backspace: null
      };
    }
    
    const audio = typewriterAudioRef.current;
    try {
      if (type === 'enter' && audio.enter) {
        audio.enter.currentTime = 0;
        audio.enter.volume = 0.4;
        audio.enter.play().catch(() => {});
      } else if (type === 'backspace' && audio.backspace) {
        audio.backspace.currentTime = 0;
        audio.backspace.volume = 0.3;
        audio.backspace.play().catch(() => {});
      } else if (audio.key) {
        audio.key.currentTime = 0;
        audio.key.volume = 0.3;
        audio.key.play().catch(() => {});
      }
    } catch (e) {}
  }, [typewriterSound]);

  // Typewriter sound on keypress
  useEffect(() => {
    if (!typewriterSound) return;
    const handleKeyPress = (e) => {
      // Different sounds for different keys
      if (e.key === 'Enter') {
        playTypewriterSound('enter');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        playTypewriterSound('backspace');
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        playTypewriterSound('key');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [typewriterSound, playTypewriterSound]);

  const updateElement = useCallback((i, el, skipUndo = false) => { 
    if (!skipUndo) pushToUndo(elements);
    setElements(p => { const u = [...p]; u[i] = el; return u; }); 
    if (socketRef.current && connected && canEdit) socketRef.current.emit('element-change', { index: i, element: el }); 
    setLastSaved(new Date());
    setLastModifiedBy({ userName: currentUser?.name || 'Vous', timestamp: new Date() });
  }, [connected, canEdit, elements, pushToUndo, currentUser]);
  const insertElement = useCallback((after, type) => { 
    pushToUndo(elements);
    const el = { id: generateId(), type, content: '' }; 
    setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; }); 
    setActiveIndex(after + 1); 
    if (socketRef.current && connected && canEdit) socketRef.current.emit('element-insert', { afterIndex: after, element: el }); 
    setLastSaved(new Date());
  }, [connected, canEdit, elements, pushToUndo]);
  const deleteElement = useCallback(i => { 
    if (elements.length === 1) return; 
    pushToUndo(elements);
    setElements(p => p.filter((_, idx) => idx !== i)); 
    setActiveIndex(Math.max(0, i - 1)); 
    if (socketRef.current && connected && canEdit) socketRef.current.emit('element-delete', { index: i }); 
    setLastSaved(new Date());
  }, [elements, connected, canEdit, pushToUndo]);
  const changeType = useCallback((i, t) => { setElements(p => { const u = [...p]; u[i] = { ...u[i], type: t }; return u; }); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-type-change', { index: i, type: t }); }, [connected, canEdit]);
  const handleCursor = useCallback((i, pos) => { if (socketRef.current && connected) socketRef.current.emit('cursor-move', { index: i, position: pos }); }, [connected]);
  const handleSelectChar = useCallback((i, name) => { updateElement(i, { ...elements[i], content: name }); setTimeout(() => insertElement(i, 'dialogue'), 50); }, [elements, updateElement, insertElement]);
  
  const handleSelectLocation = useCallback((i, location) => {
    const el = elements[i];
    const match = el.content.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*/i);
    const prefix = match ? match[1] + ' ' : '';
    updateElement(i, { ...el, content: prefix + location + ' - ' });
  }, [elements, updateElement]);

  // Rename character globally
  const renameCharacter = useCallback((fromName, toName) => {
    if (!fromName || !toName || fromName === toName) return;
    
    const newElements = elements.map(el => {
      if (el.type === 'character' && el.content.trim().toUpperCase() === fromName.toUpperCase()) {
        return { ...el, content: toName };
      }
      return el;
    });
    
    setElements(newElements);
    setShowRenameChar(false);
    
    // Emit changes for each modified element
    if (socketRef.current && connected && canEdit) {
      newElements.forEach((el, i) => {
        if (el !== elements[i]) {
          socketRef.current.emit('element-change', { index: i, element: el });
        }
      });
    }
  }, [elements, connected, canEdit]);

  // Move scene (drag & drop)
  const moveScene = useCallback((fromSceneIndex, toSceneIndex) => {
    if (fromSceneIndex === toSceneIndex) return;
    
    pushToUndo(elements);
    
    // Find all scene start indices
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    
    const fromPos = sceneIndices.indexOf(fromSceneIndex);
    const toPos = sceneIndices.indexOf(toSceneIndex);
    
    if (fromPos === -1 || toPos === -1) return;
    
    // Get range of elements for the scene being moved
    const fromStart = fromSceneIndex;
    const fromEnd = fromPos < sceneIndices.length - 1 ? sceneIndices[fromPos + 1] : elements.length;
    const sceneElements = elements.slice(fromStart, fromEnd);
    
    // Remove the scene elements
    let newElements = [...elements.slice(0, fromStart), ...elements.slice(fromEnd)];
    
    // Recalculate insertion point
    const newSceneIndices = newElements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    const adjustedToPos = toPos > fromPos ? toPos - 1 : toPos;
    const insertAt = adjustedToPos < newSceneIndices.length ? newSceneIndices[adjustedToPos] : newElements.length;
    
    // Insert at new position
    newElements = [...newElements.slice(0, insertAt), ...sceneElements, ...newElements.slice(insertAt)];
    
    setElements(newElements);
    setLastSaved(new Date());
    
    if (socketRef.current && connected && canEdit) {
      socketRef.current.emit('full-sync', { elements: newElements });
    }
  }, [elements, connected, canEdit, pushToUndo]);

  // Notes management
  const updateNote = useCallback((elementId, content, color = '#fef3c7') => {
    if (!content || !content.trim()) {
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } else {
      setNotes(prev => ({ ...prev, [elementId]: { content: content.trim(), color } }));
    }
    setShowNoteFor(null);
  }, []);

  const pushNoteToComment = async (elementId) => {
    const note = notes[elementId];
    if (!note || !token || !docId) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, 
        body: JSON.stringify({ elementId, content: '📝 ' + note.content }) 
      });
      // Remove the note after pushing
      setNotes(prev => { const n = { ...prev }; delete n[elementId]; return n; });
    } catch (err) { console.error(err); }
  };

  // Handle focus with optional cursor offset for click-to-cursor
  const handleFocus = useCallback((index, offset = null) => {
    setActiveIndex(index);
    setCursorOffset(offset);
    // Reset cursor offset after it's been applied
    if (offset !== null) {
      setTimeout(() => setCursorOffset(null), 100);
    }
  }, []);

  const handleKeyDown = useCallback((e, index) => {
    if (!canEdit) return;
    const el = elements[index];
    const target = e.target;
    
    // Helper to check if cursor is at the very start of the element
    const isCursorAtStart = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return true;
      
      const range = selection.getRangeAt(0);
      if (range.startOffset !== 0) return false;
      
      // Check if we're in the first text node
      let node = range.startContainer;
      while (node && node !== target) {
        if (node.previousSibling) return false;
        node = node.parentNode;
      }
      return true;
    };
    
    // Helper to check if cursor is at the very end of the element
    const isCursorAtEnd = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return true;
      
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const offset = range.startOffset;
      
      // If in a text node, check if at end of that node
      if (container.nodeType === Node.TEXT_NODE) {
        if (offset < container.textContent.length) return false;
      }
      
      // Check if there's any content after the cursor position
      let node = container;
      while (node && node !== target) {
        if (node.nextSibling) {
          // Check if next sibling has actual content
          const next = node.nextSibling;
          if (next.nodeType === Node.TEXT_NODE && next.textContent.length > 0) return false;
          if (next.nodeType === Node.ELEMENT_NODE && next.textContent.length > 0) return false;
        }
        node = node.parentNode;
      }
      return true;
    };
    
    // Helper to get cursor position for Enter key handling
    const getCursorPosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return { pos: 0, atStart: true, atEnd: true };
      
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(target);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      const pos = preCaretRange.toString().length;
      
      const text = (target.innerText || '').replace(/\n$/, '');
      return {
        pos,
        atStart: pos === 0,
        atEnd: pos >= text.length,
        textBefore: text.substring(0, pos),
        textAfter: text.substring(pos)
      };
    };
    
    // Enter key handling - allow line breaks in middle, create new element at end
    if (e.key === 'Enter' && !e.shiftKey) {
      const cursor = getCursorPosition();
      
      // If at end of text (or empty), create new element
      if (cursor.atEnd || el.content.trim() === '') {
        e.preventDefault();
        if (el.type === 'parenthetical' && el.content.trim()) {
          let c = el.content.trim();
          if (!c.startsWith('(')) c = '(' + c;
          if (!c.endsWith(')')) c = c + ')';
          updateElement(index, { ...el, content: c });
        }
        insertElement(index, getNextType(el.type));
      }
      // Otherwise, allow default behavior (line break in contenteditable)
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const prev = index > 0 ? elements[index - 1] : null;
      const fromDial = prev && (prev.type === 'dialogue' || prev.type === 'parenthetical');
      // After dialogue: character <-> action <-> scene cycle
      if (el.type === 'action') changeType(index, fromDial ? (e.shiftKey ? 'character' : 'scene') : (e.shiftKey ? 'scene' : 'character'));
      else if (el.type === 'character') changeType(index, fromDial ? (e.shiftKey ? 'scene' : 'action') : (e.shiftKey ? 'action' : 'scene'));
      else if (el.type === 'scene') changeType(index, fromDial ? (e.shiftKey ? 'action' : 'character') : (e.shiftKey ? 'character' : 'action'));
      else if (el.type === 'dialogue' && !e.shiftKey) changeType(index, 'parenthetical');
      else if (el.type === 'parenthetical' && !e.shiftKey) { if (el.content.trim()) { let c = el.content.trim(); if (!c.startsWith('(')) c = '(' + c; if (!c.endsWith(')')) c = c + ')'; updateElement(index, { ...el, content: c }); } changeType(index, 'dialogue'); }
    }
    if (e.key === 'Backspace' && el.content === '' && elements.length > 1) { e.preventDefault(); deleteElement(index); }
    
    // Arrow navigation: let browser handle normal cursor movement within element
    // Only intercept at element boundaries
    if (e.key === 'ArrowDown' && !e.metaKey && !e.ctrlKey) {
      // Only move to next element if truly at the end of content
      if (isCursorAtEnd() && index < elements.length - 1) {
        e.preventDefault();
        handleFocus(index + 1, 0);
      }
      // Otherwise, let browser handle normal line navigation
    }
    
    if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey) {
      // Only move to prev element if truly at the start
      if (isCursorAtStart() && index > 0) {
        e.preventDefault();
        handleFocus(index - 1, elements[index - 1].content.length);
      }
      // Otherwise, let browser handle normal line navigation
    }
    
    // Cmd/Ctrl + Arrow for quick element navigation
    if (e.key === 'ArrowUp' && e.metaKey) { e.preventDefault(); handleFocus(Math.max(0, index - 1), 0); }
    if (e.key === 'ArrowDown' && e.metaKey) { e.preventDefault(); handleFocus(Math.min(elements.length - 1, index + 1), 0); }
    if ((e.metaKey || e.ctrlKey) && ['1','2','3','4','5','6'].includes(e.key)) { e.preventDefault(); changeType(index, ELEMENT_TYPES[parseInt(e.key) - 1].id); }
  }, [elements, insertElement, changeType, deleteElement, updateElement, canEdit, handleFocus]);

  // ============ IMPORT FDX - Creates new document ============
  const importFDX = () => {
    console.log('[IMPORT] importFDX called, token:', !!token);
    if (!token) { setShowAuthModal(true); return; }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fdx,.xml';
    input.style.display = 'none';
    document.body.appendChild(input);
    
    input.onchange = async (e) => {
      console.log('[IMPORT] File selected');
      const file = e.target.files?.[0];
      
      // Clean up input element
      document.body.removeChild(input);
      
      if (!file) {
        console.log('[IMPORT] No file selected');
        return;
      }
      
      setImporting(true);
      console.log('[IMPORT] Starting import of:', file.name);
    
      try {
        const text = await file.text();
        console.log('[IMPORT] File size:', text.length, 'chars');
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'application/xml');
        
        // Check for parse errors
        const parseError = xml.querySelector('parsererror');
        if (parseError) {
          throw new Error('Fichier FDX invalide');
        }
        
        const paragraphs = xml.querySelectorAll('Paragraph');
        console.log('[IMPORT] Found', paragraphs.length, 'paragraphs');
        
        const newElements = [];
        paragraphs.forEach((p, i) => {
          const fdxType = p.getAttribute('Type');
          const type = FDX_TO_TYPE[fdxType] || 'action';
          
          // Get ALL Text nodes and concatenate them
          const textNodes = p.querySelectorAll('Text');
          let content = '';
          textNodes.forEach(t => { content += t.textContent || ''; });
          
          if (content.trim() || newElements.length === 0) {
            const id = generateId();
            newElements.push({ id, type, content: content.trim() });
          }
        });
        
        if (newElements.length === 0) {
          newElements.push({ id: generateId(), type: 'scene', content: '' });
        }
        
        // Get title from filename
        const fileName = file.name.replace(/\.fdx$/i, '').toUpperCase();
        
        console.log('[IMPORT] Creating document with', newElements.length, 'elements, title:', fileName);
        
        // Create document via API
        const res = await fetch(SERVER_URL + '/api/documents/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ title: fileName, elements: newElements })
        });
        
        console.log('[IMPORT] Server response status:', res.status);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[IMPORT] Document created:', data.id, 'with', data.elementsCount, 'elements');
          loadedDocRef.current = null;
          window.location.hash = data.id;
        } else if (res.status === 413) {
          alert('Erreur import: Fichier trop volumineux. Contactez l\'admin pour augmenter la limite serveur.');
        } else {
          try {
            const err = await res.json();
            console.error('[IMPORT] Server error:', err);
            alert('Erreur import: ' + (err.error || 'Erreur serveur'));
          } catch {
            alert('Erreur import: Erreur serveur ' + res.status);
          }
        }
      } catch (err) { 
        console.error('[IMPORT] Error:', err);
        alert('Erreur import: ' + err.message);
      }
      setImporting(false);
    };
    
    // Click must happen synchronously with user action
    input.click();
  };

  // ============ BULK SAVE (for existing doc) ============
  const bulkSave = async () => {
    if (!token || !docId) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title, elements })
      });
      if (res.ok) {
        const data = await res.json();
        alert('Sauvegardé ! ' + data.elementsCount + ' éléments');
      }
    } catch (err) { console.error(err); }
  };

  // AI Rewrite function
  const handleAIRewrite = async (mode, customPrompt = '') => {
    if (!aiRewriteSelection) return;
    
    setAiRewriteLoading(true);
    setAiRewriteResult(null);
    
    const { text } = aiRewriteSelection;
    
    // Build the prompt based on mode
    let systemPrompt = "Tu es un assistant d'écriture de scénario professionnel. Tu aides les scénaristes à améliorer leur texte. Réponds UNIQUEMENT avec le texte réécrit, sans explication ni commentaire.";
    let userPrompt = '';
    
    switch (mode) {
      case 'concis':
        userPrompt = `Réécris ce texte de manière plus concise et directe, en gardant l'essence mais en éliminant les mots superflus :\n\n"${text}"`;
        break;
      case 'develop':
        userPrompt = `Développe et enrichis ce texte avec plus de détails et de nuances, tout en gardant le style scénaristique :\n\n"${text}"`;
        break;
      case 'reformulate':
        userPrompt = `Reformule ce texte différemment tout en gardant exactement le même sens. Propose une formulation alternative :\n\n"${text}"`;
        break;
      case 'tone':
        userPrompt = `Réécris ce texte avec un ton plus ${aiRewriteTone} :\n\n"${text}"`;
        break;
      case 'custom':
        userPrompt = `${customPrompt}\n\nTexte à modifier :\n"${text}"`;
        break;
      default:
        userPrompt = `Améliore ce texte :\n\n"${text}"`;
    }
    
    try {
      const res = await fetch(SERVER_URL + '/api/ai/rewrite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? 'Bearer ' + token : ''
        },
        body: JSON.stringify({ 
          systemPrompt,
          userPrompt,
          originalText: text
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur API');
      }
      
      const data = await res.json();
      setAiRewriteResult(data.rewrittenText);
    } catch (err) {
      console.error('AI Rewrite error:', err);
      setAiRewriteResult('❌ Erreur: ' + err.message);
    } finally {
      setAiRewriteLoading(false);
    }
  };
  
  // Apply AI rewrite to the element
  const applyAIRewrite = () => {
    if (!aiRewriteResult || !aiRewriteSelection) return;
    
    const { elementIndex, startOffset, endOffset } = aiRewriteSelection;
    const element = elements[elementIndex];
    if (!element) return;
    
    // Replace the selected portion with the AI result
    const before = element.content.substring(0, startOffset);
    const after = element.content.substring(endOffset);
    const newContent = before + aiRewriteResult + after;
    
    updateElement(elementIndex, newContent);
    
    // Close the modal
    setShowAIRewrite(false);
    setAiRewriteSelection(null);
    setAiRewriteResult(null);
    setAiRewriteMode(null);
  };

  const exportFDX = () => {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FinalDraft DocumentType="Script" Version="3">\n<Content>\n';
    elements.forEach(el => { xml += '<Paragraph Type="' + (TYPE_TO_FDX[el.type] || 'Action') + '"><Text>' + esc(el.content) + '</Text></Paragraph>\n'; });
    xml += '</Content>\n</FinalDraft>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fdx'; a.click();
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    const styles = `body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 12pt; line-height: 1; margin: 1in; } .scene { text-transform: uppercase; font-weight: bold; margin-top: 2em; } .action { margin-top: 1em; } .character { text-transform: uppercase; font-weight: bold; margin-left: 37%; margin-top: 1em; } .dialogue { margin-left: 17%; width: 42%; } .parenthetical { margin-left: 27%; font-style: italic; } .transition { text-transform: uppercase; text-align: right; margin-top: 1em; } @media print { @page { margin: 1in; } }`;
    let html = `<!DOCTYPE html><html><head><title>${title}</title><style>${styles}</style></head><body>`;
    elements.forEach(el => { html += `<p class="${el.type}">${el.content || '&nbsp;'}</p>`; });
    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const exportFountain = () => {
    let fountain = `Title: ${title}\nCredit: written by\nAuthor: \nDraft date: ${new Date().toLocaleDateString('fr-FR')}\n\n`;
    
    elements.forEach(el => {
      switch (el.type) {
        case 'scene':
          fountain += `\n${el.content.toUpperCase()}\n\n`;
          break;
        case 'action':
          fountain += `${el.content}\n\n`;
          break;
        case 'character':
          fountain += `${el.content.toUpperCase()}\n`;
          break;
        case 'dialogue':
          fountain += `${el.content}\n\n`;
          break;
        case 'parenthetical':
          fountain += `${el.content.startsWith('(') ? el.content : '(' + el.content + ')'}\n`;
          break;
        case 'transition':
          fountain += `\n> ${el.content.toUpperCase()}\n\n`;
          break;
        default:
          fountain += `${el.content}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fountain], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fountain';
    a.click();
  };

  const exportTXT = () => {
    let txt = `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n`;
    
    elements.forEach(el => {
      switch (el.type) {
        case 'scene':
          txt += `\n${el.content.toUpperCase()}\n\n`;
          break;
        case 'action':
          txt += `${el.content}\n\n`;
          break;
        case 'character':
          txt += `\t\t\t${el.content.toUpperCase()}\n`;
          break;
        case 'dialogue':
          txt += `\t\t${el.content}\n\n`;
          break;
        case 'parenthetical':
          txt += `\t\t${el.content.startsWith('(') ? el.content : '(' + el.content + ')'}\n`;
          break;
        case 'transition':
          txt += `\n\t\t\t\t\t${el.content.toUpperCase()}\n\n`;
          break;
        default:
          txt += `${el.content}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.txt';
    a.click();
  };

  const exportMarkdown = () => {
    let md = `# ${title}\n\n`;
    md += `*Exporté le ${new Date().toLocaleDateString('fr-FR')}*\n\n---\n\n`;
    
    let currentScene = 0;
    elements.forEach(el => {
      switch (el.type) {
        case 'scene':
          currentScene++;
          md += `## Scène ${currentScene}: ${el.content}\n\n`;
          break;
        case 'action':
          md += `*${el.content}*\n\n`;
          break;
        case 'character':
          md += `**${el.content.toUpperCase()}**\n`;
          break;
        case 'dialogue':
          md += `> ${el.content}\n\n`;
          break;
        case 'parenthetical':
          md += `*(${el.content.replace(/[()]/g, '')})*\n`;
          break;
        case 'transition':
          md += `\n**${el.content.toUpperCase()}**\n\n---\n\n`;
          break;
        default:
          md += `${el.content}\n\n`;
      }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.md';
    a.click();
  };

  const copyLink = () => { navigator.clipboard.writeText(window.location.origin + '/#' + docId); alert('Lien copié !'); };

  return (
    <div className={focusMode ? 'focus-mode-active' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? '#2b2b2b' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#2b2b2b', transition: 'background 0.3s, color 0.3s', overflow: 'hidden' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />}
      
      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTemplateModal(false)}>
          <div 
            style={{ 
              background: darkMode ? '#333333' : 'white', 
              borderRadius: 16, 
              width: '90%',
              maxWidth: 800,
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Nouveau scénario</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Choisissez une structure ou commencez de zéro</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => createNewDocument(key)}
                    style={{
                      padding: 20,
                      background: darkMode ? '#484848' : '#f9fafb',
                      border: `2px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{template.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: darkMode ? 'white' : 'black', marginBottom: 6 }}>{template.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{template.description}</div>
                    {key !== 'empty' && (
                      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                        {template.elements.filter(e => e.type === 'scene' && e.content.startsWith('===')).length} sections
                      </div>
                    )}
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 24, padding: 16, background: darkMode ? '#333333' : '#f3f4f6', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: darkMode ? 'white' : 'black' }}>💡 Conseil</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  Les structures sont des guides, pas des règles absolues. Adaptez-les à votre histoire ! 
                  Les scènes marquées === sont des repères de structure que vous pouvez supprimer une fois votre plan établi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={() => { setShowDocsList(false); setShowTemplateModal(true); }} onClose={() => setShowDocsList(false)} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} />}
      
      {/* Search Panel */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 70, left: showOutline ? 'calc(50% + 150px)' : '50%', transform: 'translateX(-50%)', background: darkMode ? '#333333' : 'white', borderRadius: 8, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', gap: 8, alignItems: 'center', transition: 'left 0.2s ease' }}>
          <input 
            autoFocus
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Rechercher..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 200 }}
            onKeyDown={e => { if (e.key === 'Enter') goToSearchResult(1); }}
          />
          <input 
            value={replaceQuery} 
            onChange={e => setReplaceQuery(e.target.value)} 
            placeholder="Remplacer..." 
            style={{ padding: '8px 12px', background: darkMode ? '#484848' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 150 }}
          />
          <span style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12, minWidth: 50 }}>
            {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
          </span>
          <button onClick={() => goToSearchResult(-1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▲</button>
          <button onClick={() => goToSearchResult(1)} style={{ padding: '6px 10px', background: darkMode ? '#484848' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▼</button>
          <button onClick={replaceOne} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Remplacer</button>
          <button onClick={replaceAll} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Tout</button>
          <button onClick={() => setShowSearch(false)} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      
      {/* HEADER - 3 zones: Left (menus), Center (doc info + collab), Right (quick toggles) */}
      <div style={{ position: 'sticky', top: 0, background: darkMode ? '#333333' : 'white', borderBottom: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200, gap: 16 }}>
        
        {/* LEFT ZONE: Logo + Menus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Logo darkMode={darkMode} />
          
          {/* DOCUMENT MENU */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowDocMenu(!showDocMenu); setShowToolsMenu(false); setShowImportSubmenu(false); setShowExportSubmenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showDocMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Document ▾
            </button>
            {showDocMenu && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'visible', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { if (!token) { setShowAuthModal(true); } else { setShowTemplateModal(true); } setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  Nouveau
                </button>
                {token && (
                  <button onClick={() => { setShowDocsList(true); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Mes documents
                  </button>
                )}
                {docId && token && (
                  <>
                    <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                    <button onClick={() => { createSnapshot(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Snapshot</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘S</span>
                    </button>
                    <button onClick={() => { setShowHistory(true); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Historique
                    </button>
                    <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                    
                    {/* Import Submenu */}
                    <div 
                      style={{ position: 'relative' }}
                      onMouseEnter={() => { setShowImportSubmenu(true); setShowExportSubmenu(false); }}
                      onMouseLeave={() => setShowImportSubmenu(false)}
                    >
                      <button style={{ width: '100%', padding: '10px 14px', background: showImportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Importer</span><span style={{ color: '#6b7280' }}>▸</span>
                      </button>
                      {showImportSubmenu && (
                        <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                          <button onClick={(e) => { e.stopPropagation(); importFDX(); setShowDocMenu(false); }} disabled={importing} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            FDX (Final Draft)
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Export Submenu */}
                    <div 
                      style={{ position: 'relative' }}
                      onMouseEnter={() => { setShowExportSubmenu(true); setShowImportSubmenu(false); }}
                      onMouseLeave={() => setShowExportSubmenu(false)}
                    >
                      <button style={{ width: '100%', padding: '10px 14px', background: showExportSubmenu ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '0 0 8px 8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Exporter</span><span style={{ color: '#6b7280' }}>▸</span>
                      </button>
                      {showExportSubmenu && (
                        <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 501, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                          <button onClick={() => { exportFDX(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            FDX (Final Draft)
                          </button>
                          <button onClick={() => { exportFountain(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                            Fountain
                          </button>
                          <button onClick={() => { exportPDF(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            PDF
                          </button>
                          <button onClick={() => { exportTXT(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            TXT
                          </button>
                          <button onClick={() => { exportMarkdown(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                            Markdown
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* TOOLS MENU */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); setShowDocMenu(false); }} style={{ padding: '5px 10px', border: 'none', borderRadius: 6, background: showToolsMenu ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent', color: darkMode ? '#e5e7eb' : '#484848', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Outils ▾
            </button>
            {showToolsMenu && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, background: darkMode ? '#333333' : 'white', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { setShowSearch(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Rechercher</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘F</span>
                </button>
                <button onClick={() => { setShowNoteFor(elements[activeIndex]?.id); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Ajouter note</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘N</span>
                </button>
                <button onClick={() => { setShowRenameChar(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  Renommer personnage
                </button>
                <button onClick={() => { setShowCharactersPanel(!showCharactersPanel); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showCharactersPanel ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Personnages {showCharactersPanel && '✓'}
                </button>
                <button onClick={() => { setShowStats(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Statistiques
                </button>
                <button onClick={() => { setShowGoToScene(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Aller à la scène</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘G</span>
                </button>
                <button onClick={() => { setShowSceneNumbers(!showSceneNumbers); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showSceneNumbers ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                  Numéros de scènes {showSceneNumbers && '✓'}
                </button>
                <div style={{ height: 1, background: darkMode ? '#484848' : '#e5e7eb', margin: '4px 0' }} />
                <button onClick={() => { setTypewriterSound(!typewriterSound); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: typewriterSound ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="M18 2l4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/></svg>
                  Son machine à écrire {typewriterSound && '✓'}
                </button>
                <button onClick={() => { setChatNotificationSound(!chatNotificationSound); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: chatNotificationSound ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notifications chat {chatNotificationSound && '✓'}
                </button>
                <button onClick={() => { setShowShortcuts(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>Raccourcis</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘?</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* CENTER ZONE: Title only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center', minWidth: 0 }}>
          <div className="header-btn" data-tooltip={title} style={{ position: 'relative' }}>
            <input 
              value={title} 
              onChange={e => docId ? emitTitle(e.target.value) : setTitle(e.target.value)} 
              placeholder="Nouveau document"
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: darkMode ? 'white' : 'black', 
                fontSize: 14, 
                fontWeight: 600, 
                outline: 'none', 
                maxWidth: 250,
                textOverflow: 'ellipsis',
                textAlign: 'center'
              }} 
            />
          </div>
          {docId && lastSaved && <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>✓ {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
          {docId && !canEdit && <span style={{ fontSize: 10, background: '#f59e0b', color: 'black', padding: '2px 6px', borderRadius: 4 }}>Lecture</span>}
          {loading && <span style={{ fontSize: 11, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> Chargement...</span>}
          {importing && <span style={{ fontSize: 11, color: '#f59e0b' }}>Import en cours...</span>}
        </div>
        
        {/* RIGHT ZONE: User/Collab + Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* User & Collaborators */}
          {currentUser ? (
            <>
              <div style={{ position: 'relative' }}>
                <UserAvatar user={{ name: currentUser.name, color: currentUser.color || '#3b82f6' }} isYou={true} />
                <button 
                  onClick={handleLogout} 
                  style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} 
                  title="Déconnexion"
                >×</button>
              </div>
              {docId && users.filter(u => u.id !== myId).slice(0, 3).map((u) => (
                <div key={u.id} style={{ marginLeft: -6 }}><UserAvatar user={u} isYou={false} /></div>
              ))}
              {docId && users.length > 4 && <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 2 }}>+{users.length - 4}</span>}
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: '4px 10px', border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>Connexion</button>
          )}
          
          {docId && (
            <>
              <button 
                onClick={copyLink} 
                className="header-btn"
                data-tooltip="Inviter (copier le lien)"
                style={{ marginLeft: 4, width: 24, height: 24, borderRadius: '50%', border: `1px dashed ${darkMode ? '#555555' : '#d1d5db'}`, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className="header-btn"
                data-tooltip="Chat d'équipe"
                style={{ marginLeft: 2, width: 24, height: 24, borderRadius: '50%', border: 'none', background: showChat ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), color: showChat ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {unreadMessages > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>}
              </button>
            </>
          )}
          
          <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />
          
          {/* Document actions */}
          <button
            onClick={() => setShowDocsList(true)}
            className="header-btn"
            data-tooltip="Mes documents"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="header-btn"
            data-tooltip="Exporter"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showExportMenu ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showExportMenu ? 'white' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', bottom: 4, right: 4 }}>
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
          
          {/* Export dropdown menu */}
          {showExportMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
                onClick={() => setShowExportMenu(false)} 
              />
              <div style={{
                position: 'absolute',
                top: 50,
                right: 'auto',
                background: darkMode ? '#333333' : 'white',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                zIndex: 1000,
                minWidth: 160,
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => { exportFDX(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Export FDX
                </button>
                <button
                  onClick={() => { exportPDF(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Export PDF
                </button>
                <button
                  onClick={() => { exportFountain(); setShowExportMenu(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c2 4 4 6 4 10a4 4 0 1 1-8 0c0-4 2-6 4-10z"/></svg>
                  Export Fountain
                </button>
              </div>
            </>
          )}
          
          <div style={{ width: 1, height: 20, background: darkMode ? '#484848' : '#d1d5db', margin: '0 6px' }} />
          
          {/* Quick toggle buttons */}
          <button
            onClick={() => setShowOutline(!showOutline)}
            className="header-btn"
            data-tooltip="Outline (⌘O)"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showOutline ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showOutline ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="header-btn"
            data-tooltip="Commentaires"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showComments ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showComments ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {totalComments > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#f59e0b', color: 'black', fontSize: 8, fontWeight: 'bold', padding: '1px 4px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{totalComments}</span>}
          </button>
          
          <button
            onClick={() => setShowTimer(!showTimer)}
            className="header-btn"
            data-tooltip="Timer d'écriture"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: showTimer ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: showTimer ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="13" r="8"/>
              <path d="M12 9v4l2 2"/>
              <path d="M9 2h6"/>
              <path d="M12 2v2"/>
            </svg>
          </button>
          
          <button
            onClick={() => setFocusMode(!focusMode)}
            className="header-btn"
            data-tooltip="Mode focus"
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: focusMode ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), color: focusMode ? 'white' : '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </button>
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="header-btn"
            data-tooltip={darkMode ? 'Mode clair' : 'Mode sombre'}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: darkMode ? '#484848' : '#f3f4f6', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      {/* MAIN CONTENT AREA - Flex layout with sidebars */}
      <div style={{ 
        flex: 1,
        display: 'flex', 
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Loading Overlay */}
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: darkMode ? 'rgba(43, 43, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#60a5fa' : '#3b82f6'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style={{ marginTop: 16, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>
              Chargement du document...
            </p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {/* LEFT SIDEBAR - Outline */}
        {showOutline && (
          <div style={{ 
            width: 300,
            minWidth: 200,
            flexShrink: 1,
            background: darkMode ? '#333333' : 'white', 
            borderRight: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                Outline
              </h3>
              <button onClick={() => setShowOutline(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            
            {/* Filters */}
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', gap: 6 }}>
              {/* Custom Status Dropdown */}
              <div style={{ flex: 1, position: 'relative' }}>
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  style={{ 
                    width: '100%',
                    padding: '6px 10px', 
                    background: outlineFilter.status ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'), 
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 6, 
                    color: darkMode ? '#e5e7eb' : '#484848', 
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {outlineFilter.status === 'progress' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />}
                    {outlineFilter.status === 'done' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />}
                    {outlineFilter.status === 'urgent' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
                    {outlineFilter.status === 'none' && <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />}
                    {outlineFilter.status === 'progress' ? 'En cours' : outlineFilter.status === 'done' ? 'Validé' : outlineFilter.status === 'urgent' ? 'Urgent' : outlineFilter.status === 'none' ? 'Non défini' : 'Statut'}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280"><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
                </button>
                {showStatusDropdown && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowStatusDropdown(false)} />
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0,
                      marginTop: 4,
                      background: darkMode ? '#333333' : 'white', 
                      border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 999,
                      overflow: 'hidden'
                    }}>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: '' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Tous les statuts
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'progress' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        En cours
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'done' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                        Validé
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'urgent' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                        Urgent
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'none' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />
                        Non défini
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* Custom Assignee Dropdown */}
              <div style={{ flex: 1, position: 'relative' }}>
                <button
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  style={{ 
                    width: '100%',
                    padding: '6px 10px', 
                    background: outlineFilter.assignee ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'), 
                    border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                    borderRadius: 6, 
                    color: darkMode ? '#e5e7eb' : '#484848', 
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {outlineFilter.assignee === 'unassigned' ? 'Non assigné' : outlineFilter.assignee || 'Assigné'}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280" style={{ flexShrink: 0 }}><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
                </button>
                {showAssigneeDropdown && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowAssigneeDropdown(false)} />
                    <div style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0,
                      marginTop: 4,
                      background: darkMode ? '#333333' : 'white', 
                      border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 999,
                      overflow: 'hidden',
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: '' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Tous
                      </button>
                      <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: 'unassigned' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 16, height: 16, borderRadius: 3, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>✕</span>
                        Non assigné
                      </button>
                      {(() => {
                        // Merge and sync colors with online users
                        const allUsers = collaborators.map(collab => {
                          const onlineUser = users.find(u => u.name === collab.name);
                          return { ...collab, color: onlineUser?.color || collab.color };
                        });
                        users.forEach(onlineUser => {
                          if (!allUsers.find(c => c.name === onlineUser.name)) {
                            allUsers.push({ name: onlineUser.name, color: onlineUser.color });
                          }
                        });
                        return allUsers;
                      })().map(u => {
                        const onlineUser = users.find(online => online.name === u.name);
                        const displayColor = onlineUser?.color || u.color;
                        return (
                        <button key={u.name} onClick={() => { setOutlineFilter(f => ({ ...f, assignee: u.name })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <span style={{ width: 16, height: 16, borderRadius: 3, background: displayColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 'bold' }}>{getInitials(u.name)}</span>
                          {u.name}
                          {onlineUser && (
                            <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                          )}
                        </button>
                      );})}
                    </div>
                  </>
                )}
              </div>
            </div>
            {(outlineFilter.status || outlineFilter.assignee) && (
              <div style={{ padding: '4px 12px', background: darkMode ? '#484848' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: darkMode ? '#fbbf24' : '#92400e' }}>
                  {filteredOutline.length} scène{filteredOutline.length > 1 ? 's' : ''} filtrée{filteredOutline.length > 1 ? 's' : ''}
                </span>
                <button onClick={() => setOutlineFilter({ status: '', assignee: '' })} style={{ padding: '4px 8px', fontSize: 10, background: '#ef4444', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            <div ref={outlineSidebarRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {filteredOutline.length === 0 ? (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucune scène</p>
              ) : (
                filteredOutline.map((scene, sceneIdx) => (
                  <React.Fragment key={scene.id}>
                  {outlineChapters[scene.id] && (
                    <div 
                      style={{ 
                        padding: '8px 12px', 
                        background: darkMode ? '#4a4a4a' : '#dbeafe', 
                        borderLeft: '3px solid #3b82f6',
                        margin: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: darkMode ? '#93c5fd' : '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>📁 {outlineChapters[scene.id]}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOutlineChapters(prev => { const n = {...prev}; delete n[scene.id]; return n; }); }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: 0 }}
                      >✕</button>
                    </div>
                  )}
                  <div 
                    data-outline-element-index={scene.index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(scene.index);
                      // Scroll the script container to this scene
                      setTimeout(() => {
                        const script = scriptContainerRef.current;
                        const el = document.querySelector(`[data-element-index="${scene.index}"]`);
                        if (script && el) {
                          const scriptRect = script.getBoundingClientRect();
                          const elRect = el.getBoundingClientRect();
                          const targetScroll = script.scrollTop + (elRect.top - scriptRect.top) - 50;
                          script.scrollTop = Math.max(0, targetScroll);
                        }
                      }, 50);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const chapterName = prompt('Nom du chapitre/acte à insérer avant cette scène:', outlineChapters[scene.id] || '');
                      if (chapterName !== null) {
                        if (chapterName.trim()) {
                          setOutlineChapters(prev => ({ ...prev, [scene.id]: chapterName.trim() }));
                        } else {
                          setOutlineChapters(prev => { const n = {...prev}; delete n[scene.id]; return n; });
                        }
                      }
                    }}
                    style={{ 
                      padding: '10px 12px', 
                      cursor: 'pointer', 
                      background: activeIndex === scene.index 
                        ? (darkMode ? '#484848' : '#f3f4f6')
                        : 'transparent',
                      borderBottom: `1px solid ${darkMode ? '#484848' : '#f3f4f6'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span style={{ 
                      fontSize: 10, 
                      color: '#6b7280', 
                      minWidth: 20,
                      textAlign: 'center'
                    }}>{sceneIdx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ 
                        fontSize: 12, 
                        fontWeight: 500, 
                        color: darkMode ? 'white' : 'black',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{scene.content || 'Scène vide'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLockedScenes(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(scene.id)) newSet.delete(scene.id);
                            else newSet.add(scene.id);
                            return newSet;
                          });
                        }}
                        style={{ 
                          background: lockedScenes.has(scene.id) ? 'rgba(239, 68, 68, 0.2)' : 'none', 
                          border: 'none', 
                          color: lockedScenes.has(scene.id) ? '#ef4444' : '#6b7280', 
                          cursor: 'pointer', 
                          fontSize: 11, 
                          padding: '3px 4px',
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={lockedScenes.has(scene.id) ? 'Déverrouiller' : 'Verrouiller'}
                      >
                        {lockedScenes.has(scene.id) ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const statuses = ['', 'progress', 'done', 'urgent'];
                          const currentIdx = statuses.indexOf(sceneStatus[scene.id] || '');
                          setSceneStatus(prev => ({ ...prev, [scene.id]: statuses[(currentIdx + 1) % 4] }));
                        }}
                        style={{ 
                          minWidth: 22,
                          height: 18, 
                          borderRadius: 4, 
                          border: !sceneStatus[scene.id] ? '1px dashed #6b7280' : 'none',
                          background: sceneStatus[scene.id] === 'done' ? '#22c55e' 
                            : sceneStatus[scene.id] === 'progress' ? '#f59e0b' 
                            : sceneStatus[scene.id] === 'urgent' ? '#ef4444'
                            : 'transparent',
                          cursor: 'pointer', 
                          padding: '0 4px',
                          fontSize: 10,
                          fontWeight: 'bold',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={sceneStatus[scene.id] === 'done' ? 'Validé' 
                          : sceneStatus[scene.id] === 'progress' ? 'En cours' 
                          : sceneStatus[scene.id] === 'urgent' ? 'Urgent'
                          : 'Statut'}
                      >
                        {sceneStatus[scene.id] === 'done' ? '✓' 
                          : sceneStatus[scene.id] === 'progress' ? '…' 
                          : sceneStatus[scene.id] === 'urgent' ? '!'
                          : ''}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setAssignmentMenu({
                            sceneId: scene.id,
                            x: rect.left,
                            y: rect.bottom + 4
                          });
                        }}
                        style={{ 
                          minWidth: 22,
                          height: 18, 
                          borderRadius: 4, 
                          border: sceneAssignments[scene.id] ? 'none' : '1px dashed #6b7280', 
                          background: (() => {
                            if (!sceneAssignments[scene.id]) return 'transparent';
                            const assignedName = sceneAssignments[scene.id].userName?.toLowerCase().trim();
                            const onlineUser = users.find(u => u.name?.toLowerCase().trim() === assignedName);
                            return onlineUser?.color || sceneAssignments[scene.id].userColor || '#6b7280';
                          })(), 
                          cursor: 'pointer', 
                          padding: '0 4px',
                          fontSize: 9,
                          fontWeight: 'bold',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="outline-btn"
                        data-tooltip={sceneAssignments[scene.id] ? `Assigné à ${sceneAssignments[scene.id].userName}` : 'Assigner'}
                      >
                        {getInitials(sceneAssignments[scene.id]?.userName) || ''}
                      </button>
                    </div>
                  </div>
                  </React.Fragment>
                ))
              )}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
              <div>{outline.length} scène{outline.length > 1 ? 's' : ''} • Position: {currentSceneNumber}/{outline.length}</div>
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>💡 Clic droit sur une scène = ajouter un chapitre</div>
            </div>
          </div>
        )}
        
        {/* CENTER - Script content */}
        <div 
          ref={scriptContainerRef}
          style={{ 
            flex: 1,
            minWidth: 'fit-content',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex', 
            justifyContent: 'center', 
            padding: 32,
            gap: 20
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {pages.map((page) => (
              <div key={page.number} style={{ position: 'relative' }}>
                {/* Page content */}
                <div style={{ 
                  background: darkMode ? '#3a3a3a' : 'white', 
                  color: darkMode ? '#e0e0e0' : '#111', 
                  width: '210mm', 
                  minHeight: '297mm',
                  padding: '20mm 25mm 25mm 38mm', 
                  boxSizing: 'border-box', 
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.4)',
                  position: 'relative'
                }}>
                  {/* Page number inside, top right */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '12mm', 
                    right: '25mm', 
                    fontSize: '12pt', 
                    fontFamily: 'Courier Prime, Courier New, monospace',
                    color: darkMode ? '#e0e0e0' : '#111'
                  }}>
                    {page.number}.
                  </div>
                  
                  {page.elements.map(({ element, index }) => (
                    <div key={element.id} data-element-index={index}>
                      <SceneLine 
                      element={element} 
                      index={index} 
                      isActive={activeIndex === index} 
                      onUpdate={updateElement} 
                      onFocus={handleFocus} 
                      onKeyDown={handleKeyDown} 
                      characters={extractedCharacters}
                      locations={extractedLocations}
                      onSelectCharacter={handleSelectChar}
                      onSelectLocation={handleSelectLocation}
                      remoteCursors={remoteCursors} 
                      onCursorMove={handleCursor} 
                      canEdit={canEdit && !isElementLocked(index)}
                      isLocked={isElementLocked(index)}
                      sceneNumber={sceneNumbersMap[element.id]}
                      showSceneNumbers={showSceneNumbers}
                      note={notes[element.id]}
                      onNoteClick={(id) => setShowNoteFor(id)}
                      highlights={getElementHighlights(element.id)}
                      initialCursorOffset={activeIndex === index ? cursorOffset : null}
                      onTextSelect={(selection) => {
                        if (canComment) {
                          setTextSelection(selection);
                        }
                      }}
                      onHighlightClick={(commentId) => {
                        setShowComments(true);
                        setSelectedCommentId(commentId);
                        setSelectedSuggestionId(null);
                        // Scroll to the comment card in the sidebar
                        setTimeout(() => {
                          const commentCard = document.querySelector(`[data-comment-card-id="${commentId}"]`);
                          if (commentCard) {
                            commentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 150);
                      }}
                      onSuggestionClick={(suggestionId) => {
                        setShowComments(true);
                        setSelectedSuggestionId(suggestionId);
                        setSelectedCommentId(null);
                        // Scroll to the suggestion card in the sidebar
                        setTimeout(() => {
                          const suggestionCard = document.querySelector(`[data-suggestion-card-id="${suggestionId}"]`);
                          if (suggestionCard) {
                            suggestionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 150);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* RIGHT SIDEBAR - Comments */}
      {showComments && (
        <div style={{ 
          width: 320,
          minWidth: 250,
          flexShrink: 1,
          background: darkMode ? '#333333' : 'white', 
          borderLeft: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <CommentsSidebar 
            comments={comments} 
            suggestions={suggestions}
            elements={elements} 
            activeIndex={activeIndex}
            selectedCommentIndex={selectedCommentIndex}
            selectedCommentId={selectedCommentId}
            onSelectComment={(id) => { setSelectedCommentId(id); if (id) setSelectedSuggestionId(null); }}
            elementPositions={elementPositions}
            scrollContainerRef={commentsSidebarRef}
            scriptScrollHeight={scriptScrollHeight}
            token={token} 
            docId={docId} 
            canComment={canComment}
            onClose={() => { setShowComments(false); setSelectedCommentIndex(null); setSelectedCommentId(null); setSelectedSuggestionId(null); setPendingInlineComment(null); setPendingSuggestion(null); }}
            darkMode={darkMode}
            onNavigateToElement={(idx) => {
              setActiveIndex(idx);
              setSelectedCommentIndex(idx);
              setTimeout(() => {
                const el = document.querySelector(`[data-element-index="${idx}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }}
            pendingInlineComment={pendingInlineComment}
            onSubmitInlineComment={(commentText) => {
              if (pendingInlineComment && commentText.trim()) {
              const newComment = {
                id: 'comment-' + Date.now(),
                elementId: pendingInlineComment.elementId,
                elementIndex: pendingInlineComment.elementIndex,
                highlight: {
                  text: pendingInlineComment.text,
                  startOffset: pendingInlineComment.startOffset,
                  endOffset: pendingInlineComment.endOffset
                },
                content: commentText.trim(),
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                resolved: false,
                replies: []
              };
              
              setComments(prev => [...prev, newComment]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('comment-add', { comment: newComment });
              }
              
              setPendingInlineComment(null);
            }
          }}
          onCancelInlineComment={() => setPendingInlineComment(null)}
          pendingSuggestion={pendingSuggestion}
          onSubmitSuggestion={(suggestedText) => {
            if (pendingSuggestion) {
              const newSuggestion = {
                id: 'suggestion-' + Date.now(),
                elementId: pendingSuggestion.elementId,
                elementIndex: pendingSuggestion.elementIndex,
                originalText: pendingSuggestion.originalText,
                suggestedText: suggestedText,
                startOffset: pendingSuggestion.startOffset,
                endOffset: pendingSuggestion.endOffset,
                userName: currentUser?.name || 'Anonyme',
                userColor: currentUser?.color || '#6b7280',
                createdAt: new Date().toISOString(),
                status: 'pending'
              };
              
              setSuggestions(prev => [...prev, newSuggestion]);
              
              // Sync to server
              if (socketRef.current) {
                socketRef.current.emit('suggestion-add', { suggestion: newSuggestion });
              }
              
              setPendingSuggestion(null);
            }
          }}
          onCancelSuggestion={() => setPendingSuggestion(null)}
          onAcceptSuggestion={(suggestionId) => {
            const suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion) {
              // Apply the suggestion to the element
              const elementIndex = elements.findIndex(el => el.id === suggestion.elementId);
              if (elementIndex !== -1) {
                const element = elements[elementIndex];
                const newContent = 
                  element.content.substring(0, suggestion.startOffset) + 
                  suggestion.suggestedText + 
                  element.content.substring(suggestion.endOffset);
                updateElement(elementIndex, { ...element, content: newContent });
              }
              // Remove the suggestion
              setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
              if (socketRef.current) {
                socketRef.current.emit('suggestion-accept', { suggestionId });
              }
            }
          }}
          onRejectSuggestion={(suggestionId) => {
            setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
            if (socketRef.current) {
              socketRef.current.emit('suggestion-reject', { suggestionId });
            }
          }}
          selectedSuggestionId={selectedSuggestionId}
          onSelectSuggestion={(id) => { setSelectedSuggestionId(id); if (id) setSelectedCommentId(null); }}
          users={users}
          collaborators={collaborators}
        />
        </div>
      )}
      </div>
      
      {/* Characters Panel */}
      {showCharactersPanel && (
        <CharactersPanel 
          characterStats={characterStats}
          darkMode={darkMode}
          onClose={() => setShowCharactersPanel(false)}
          onNavigate={(idx) => {
            setActiveIndex(idx);
            setTimeout(() => {
              const el = document.querySelector(`[data-element-index="${idx}"]`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
        />
      )}
      
      {/* Note Editor Modal - FLOATING */}
      {showNoteFor && (
        <NoteEditorModal
          elementId={showNoteFor}
          note={notes[showNoteFor]}
          onSave={updateNote}
          onPushToComment={pushNoteToComment}
          onClose={() => setShowNoteFor(null)}
          darkMode={darkMode}
          canPush={!!token && !!docId && canComment}
          position={notePosition}
          onDragStart={(e) => {
            e.preventDefault();
            if (e.target.tagName === 'BUTTON') return;
            setIsDraggingNote(true);
            dragOffsetRef.current = { x: e.clientX - notePosition.x, y: e.clientY - notePosition.y };
          }}
        />
      )}
      
      {/* User Assignment Context Menu */}
      {assignmentMenu && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }} 
          onClick={() => setAssignmentMenu(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              position: 'fixed',
              left: assignmentMenu.x,
              top: assignmentMenu.y,
              background: darkMode ? '#333333' : 'white',
              border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              borderRadius: 8,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              minWidth: 180,
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
              Assigner à
            </div>
            {/* Remove assignment option */}
            <button
              onClick={() => {
                setSceneAssignments(prev => {
                  const newAssignments = { ...prev };
                  delete newAssignments[assignmentMenu.sceneId];
                  return newAssignments;
                });
                setAssignmentMenu(null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ width: 24, height: 24, borderRadius: 4, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✕</span>
              <span>Aucun</span>
            </button>
            {/* List all users: collaborators + online users merged */}
            {(() => {
              // Merge collaborators and online users, avoiding duplicates
              // Priority: use online user's color if they're connected (same as header avatars)
              const allUsers = collaborators.map(collab => {
                const onlineUser = users.find(u => u.name === collab.name);
                return {
                  ...collab,
                  color: onlineUser?.color || collab.color // Use online color if available
                };
              });
              users.forEach(onlineUser => {
                if (!allUsers.find(c => c.name === onlineUser.name)) {
                  allUsers.push({ name: onlineUser.name, color: onlineUser.color });
                }
              });
              return allUsers;
            })().map(user => {
              // Get the current color (prioritize online user's color)
              const onlineUser = users.find(u => u.name === user.name);
              const displayColor = onlineUser?.color || user.color;
              return (
              <button
                key={user.name}
                onClick={() => {
                  setSceneAssignments(prev => ({
                    ...prev,
                    [assignmentMenu.sceneId]: {
                      userName: user.name,
                      userColor: displayColor
                    }
                  }));
                  setAssignmentMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                  color: darkMode ? 'white' : 'black',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent'}
              >
                <span style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: 4, 
                  background: displayColor, 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}>
                  {getInitials(user.name)}
                </span>
                <span>{user.name}{user.role === 'owner' ? ' 👑' : ''}</span>
                {onlineUser && (
                  <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} title="En ligne" />
                )}
              </button>
            );})}
          </div>
        </div>
      )}

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <ShortcutsPanel
          onClose={() => setShowShortcuts(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Stats Panel */}
      {showStats && (
        <StatsPanel
          stats={stats}
          elements={elements}
          onClose={() => setShowStats(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Rename Character Modal */}
      {showRenameChar && (
        <RenameCharacterModal
          characters={extractedCharacters}
          onRename={renameCharacter}
          onClose={() => setShowRenameChar(false)}
          darkMode={darkMode}
        />
      )}
      
      {/* Go To Scene Modal */}
      {showGoToScene && (
        <GoToSceneModal
          onClose={() => setShowGoToScene(false)}
          onGoTo={navigateToSceneByNumber}
          maxScene={outline.length}
          darkMode={darkMode}
        />
      )}
      
      {/* Text Selection Toolbar - Google Docs style */}
      {textSelection && canComment && textSelection.rect && (() => {
        // Calculate menu position - show above if near bottom of screen
        const menuHeight = 110; // approx height of menu
        const screenBottom = window.innerHeight;
        const idealTop = textSelection.rect.top || 100;
        const wouldOverflow = idealTop + menuHeight > screenBottom - 20;
        const finalTop = wouldOverflow 
          ? Math.max(20, textSelection.rect.top - menuHeight - 10)  // Position above
          : idealTop;
        
        return (
        <div 
          className="text-selection-popup"
          style={{
            position: 'fixed',
            right: showComments ? 340 : 20,
            top: finalTop,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            zIndex: 1000,
            background: 'white',
            borderRadius: 24,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            padding: 8,
            border: '1px solid #e0e0e0'
          }}
        >
          {/* Suggestion button (pen icon) */}
          <button 
            onClick={() => {
              setPendingSuggestion({
                elementId: textSelection.elementId,
                elementIndex: textSelection.elementIndex,
                originalText: textSelection.text,
                startOffset: textSelection.startOffset,
                endOffset: textSelection.endOffset
              });
              setShowComments(true);
              setTextSelection(null);
            }}
            style={{
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Proposer une modification"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          
          {/* Comment button (plus in speech bubble) */}
          <button 
            onClick={() => {
              setPendingInlineComment({
                elementId: textSelection.elementId,
                elementIndex: textSelection.elementIndex,
                text: textSelection.text,
                startOffset: textSelection.startOffset,
                endOffset: textSelection.endOffset
              });
              setShowComments(true);
              setTextSelection(null);
            }}
            style={{
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Ajouter un commentaire"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </button>
          
          {/* Emoji button (placeholder) */}
          <button 
            style={{
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'not-allowed',
              opacity: 0.4
            }}
            title="Réactions (bientôt)"
            disabled
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          
          {/* AI Rewrite button */}
          <button 
            onClick={() => {
              setAiRewriteSelection({
                elementId: textSelection.elementId,
                elementIndex: textSelection.elementIndex,
                text: textSelection.text,
                startOffset: textSelection.startOffset,
                endOffset: textSelection.endOffset
              });
              setShowAIRewrite(true);
              setAiRewriteMode(null);
              setAiRewriteResult(null);
              setTextSelection(null);
            }}
            style={{
              width: 40,
              height: 40,
              background: 'transparent',
              border: 'none',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f3f4'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Réécrire avec l'IA"
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>IA</span>
          </button>
        </div>
        );
      })()}

      {/* AI Rewrite Modal */}
      {showAIRewrite && aiRewriteSelection && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}
        onClick={(e) => { if (e.target === e.currentTarget) { setShowAIRewrite(false); setAiRewriteSelection(null); setAiRewriteResult(null); setAiRewriteMode(null); } }}
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
                onClick={() => { setShowAIRewrite(false); setAiRewriteSelection(null); setAiRewriteResult(null); setAiRewriteMode(null); }}
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
                  onClick={() => { setAiRewriteMode('concis'); handleAIRewrite('concis'); }}
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
                  onClick={() => { setAiRewriteMode('develop'); handleAIRewrite('develop'); }}
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
                  onClick={() => { setAiRewriteMode('reformulate'); handleAIRewrite('reformulate'); }}
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
                        onClick={() => { setAiRewriteTone(tone); setAiRewriteMode('tone'); handleAIRewrite('tone'); }}
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
                      onKeyDown={e => { if (e.key === 'Enter' && aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); handleAIRewrite('custom', aiRewriteCustomPrompt); } }}
                    />
                    <button 
                      onClick={() => { if (aiRewriteCustomPrompt.trim()) { setAiRewriteMode('custom'); handleAIRewrite('custom', aiRewriteCustomPrompt); } }}
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
                      onClick={applyAIRewrite}
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
                      onClick={() => handleAIRewrite(aiRewriteMode, aiRewriteMode === 'custom' ? aiRewriteCustomPrompt : '')}
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
                      onClick={() => { setAiRewriteResult(null); setAiRewriteMode(null); }}
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
                    onClick={() => { setAiRewriteResult(null); setAiRewriteMode(null); }}
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
      )}

      {/* Drag overlay - prevents blue selection during panel drag */}
      {isDraggingAny && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          zIndex: 150, 
          cursor: 'grabbing',
          background: 'transparent'
        }} />
      )}
      
      {/* Chat Panel - FLOATING */}
      {showChat && (
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
            onMouseDown={(e) => {
              e.preventDefault();
              if (e.target.tagName === 'BUTTON') return;
              setIsDraggingChat(true);
              dragOffsetRef.current = { x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y };
            }}
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
              onClick={() => setShowChat(false)} 
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
      )}
      
      {/* Writing Timer Widget - FLOATING */}
      {showTimer && (
        timerCompact ? (
          /* COMPACT MODE */
          <div style={{
            position: 'fixed',
            left: timerPosition.x,
            top: timerPosition.y,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            zIndex: 200,
            overflow: 'hidden'
          }}>
            <div 
              style={{ 
                padding: '8px 12px', 
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'grab',
                background: darkMode ? '#484848' : '#f3f4f6'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                dragOffsetRef.current = { x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y };
                setIsDraggingTimer(true);
              }}
            >
              {/* Time display */}
              <span style={{ 
                fontSize: 18, 
                fontWeight: 'bold', 
                fontFamily: 'monospace', 
                color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'),
                minWidth: 60
              }}>
                {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
              </span>
              
              {/* Play/Pause */}
              <button 
                onClick={() => setTimerRunning(!timerRunning)}
                style={{ 
                  width: 28, height: 28,
                  background: timerRunning ? '#ef4444' : '#22c55e', 
                  border: 'none', 
                  borderRadius: 6, 
                  color: 'white', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {timerRunning ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>
              
              {/* Reset */}
              <button 
                onClick={resetTimer}
                style={{ 
                  width: 28, height: 28,
                  background: darkMode ? '#555555' : '#e5e7eb', 
                  border: 'none', 
                  borderRadius: 6, 
                  color: darkMode ? 'white' : '#484848', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              </button>
              
              {/* Expand */}
              <button 
                onClick={() => setTimerCompact(false)}
                style={{ 
                  width: 28, height: 28,
                  background: 'transparent', 
                  border: 'none', 
                  color: '#6b7280', 
                  cursor: 'pointer', 
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Agrandir"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
              
              {/* Close */}
              <button 
                onClick={() => setShowTimer(false)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#6b7280', 
                  cursor: 'pointer', 
                  fontSize: 12,
                  marginLeft: -4
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* EXPANDED MODE */
          <div style={{
            position: 'fixed',
            left: timerPosition.x,
            top: timerPosition.y,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            zIndex: 200,
            minWidth: 220,
            overflow: 'hidden'
          }}>
            {/* Timer Header - DRAGGABLE */}
            <div 
              style={{ 
                padding: '10px 16px', 
                borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'grab',
                background: darkMode ? '#484848' : '#f3f4f6'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                dragOffsetRef.current = { x: e.clientX - timerPosition.x, y: e.clientY - timerPosition.y };
                setIsDraggingTimer(true);
              }}
            >
              <span style={{ fontSize: 12, color: darkMode ? 'white' : '#484848', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Timer</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button 
                  onClick={() => setTimerCompact(true)} 
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}
                  title="Réduire"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
                <button onClick={() => setShowTimer(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
            
            <div style={{ padding: 16 }}>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 6, padding: 3 }}>
                <button 
                  onClick={() => { setTimerMode('chrono'); if (!timerRunning) resetTimer(); }}
                  style={{ 
                    flex: 1, 
                    padding: '6px 10px', 
                    background: timerMode === 'chrono' ? (darkMode ? '#333333' : 'white') : 'transparent', 
                    border: 'none', 
                    borderRadius: 4, 
                    color: timerMode === 'chrono' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                    cursor: 'pointer', 
                    fontSize: 11,
                    fontWeight: timerMode === 'chrono' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Chrono
                </button>
                <button 
                  onClick={() => { setTimerMode('sprint'); if (!timerRunning) { resetTimer(); setSprintTimeLeft(sprintDuration); } }}
                  style={{ 
                    flex: 1, 
                    padding: '6px 10px', 
                    background: timerMode === 'sprint' ? (darkMode ? '#333333' : 'white') : 'transparent', 
                    border: 'none', 
                    borderRadius: 4, 
                    color: timerMode === 'sprint' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                    cursor: 'pointer', 
                    fontSize: 11,
                    fontWeight: timerMode === 'sprint' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Sprint
                </button>
              </div>
              
              {/* Timer display */}
              <div style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'), marginBottom: 8 }}>
                {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
              </div>
              
              {/* Sprint duration selector */}
              {timerMode === 'sprint' && !timerRunning && (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
                  {[15, 25, 45, 60].map(mins => (
                    <button 
                      key={mins}
                      onClick={() => setSprintMinutes(mins)}
                      style={{ 
                        padding: '4px 8px', 
                        background: sprintDuration === mins * 60 ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), 
                        border: 'none', 
                        borderRadius: 4, 
                        color: sprintDuration === mins * 60 ? 'white' : (darkMode ? '#d1d5db' : '#484848'), 
                        cursor: 'pointer', 
                        fontSize: 10 
                      }}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
                <button 
                  onClick={() => setTimerRunning(!timerRunning)}
                  style={{ 
                    padding: '8px 16px', 
                    background: timerRunning ? '#ef4444' : '#22c55e', 
                    border: 'none', 
                    borderRadius: 6, 
                    color: 'white', 
                    cursor: 'pointer', 
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {timerRunning ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start</>
                  )}
                </button>
                <button 
                  onClick={resetTimer}
                  style={{ 
                    padding: '8px 12px', 
                    background: darkMode ? '#484848' : '#e5e7eb', 
                    border: 'none', 
                    borderRadius: 6, 
                    color: darkMode ? 'white' : 'black', 
                    cursor: 'pointer', 
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                </button>
              </div>
              <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, fontSize: 12, color: '#6b7280' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Mots cette session</span>
                  <span style={{ color: sessionWordCount > 0 ? '#22c55e' : (darkMode ? 'white' : 'black'), fontWeight: 500 }}>+{sessionWordCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mots/heure</span>
                  <span style={{ color: darkMode ? 'white' : 'black' }}>{timerSeconds > 60 ? Math.round(sessionWordCount / (timerSeconds / 3600)) : '—'}</span>
                </div>
              </div>
              
              {/* Daily Goal Section */}
              <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif du jour</span>
                  <span style={{ fontSize: 11, color: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : (darkMode ? 'white' : '#484848') }}>
                    {writingGoal.todayWords} / {writingGoal.daily}
                  </span>
                </div>
                <div style={{ height: 6, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, Math.round((writingGoal.todayWords / writingGoal.daily) * 100))}%`, 
                    background: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : '#3b82f6', 
                    borderRadius: 3, 
                    transition: 'width 0.3s' 
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[500, 1000, 1500, 2000].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setWritingGoal(g => ({ ...g, daily: preset }))}
                      style={{ 
                        flex: 1, 
                        padding: '4px', 
                        background: writingGoal.daily === preset ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'), 
                        border: 'none', 
                        borderRadius: 4, 
                        color: writingGoal.daily === preset ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'), 
                        cursor: 'pointer', 
                        fontSize: 9 
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}
      
      {/* CSS Highlight API styles for comments and suggestions */}
      <style>{`
        ::highlight(comment-highlight) {
          background-color: rgba(251, 191, 36, 0.4);
          border-radius: 2px;
        }
        ::highlight(suggestion-highlight) {
          background-color: rgba(34, 197, 94, 0.3);
          text-decoration: underline wavy #16a34a;
        }
        
        /* Custom Tooltips */
        .header-btn {
          position: relative;
        }
        .header-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .header-btn::before {
          content: '';
          position: absolute;
          top: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-bottom-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .header-btn:hover::after,
        .header-btn:hover::before {
          opacity: 1;
        }
        .header-btn:hover::after {
          transform: translateX(-50%) translateY(0);
        }
        
        /* Outline tooltips - appear above */
        .outline-btn {
          position: relative;
        }
        .outline-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 8px;
          background: ${darkMode ? '#333333' : '#484848'};
          color: white;
          font-size: 10px;
          font-weight: 500;
          white-space: nowrap;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .outline-btn::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 1px);
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: ${darkMode ? '#333333' : '#484848'};
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 1000;
        }
        .outline-btn:hover::after,
        .outline-btn:hover::before {
          opacity: 1;
        }
      `}</style>
      
      {/* Focus Mode Overlay - dims everything except current element */}
      {focusMode && (
        <style>{`
          .focus-mode-active [data-element-index]:not([data-element-index="${activeIndex}"]) {
            opacity: 0.3 !important;
            transition: opacity 0.3s ease;
          }
          .focus-mode-active [data-element-index="${activeIndex}"] {
            opacity: 1 !important;
          }
        `}</style>
      )}
    </div>
  );
}
