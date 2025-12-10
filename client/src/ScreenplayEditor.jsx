import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://room-production-19a5.up.railway.app';

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
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(SERVER_URL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      localStorage.setItem('screenplay-token', data.token);
      localStorage.setItem('screenplay-user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1f2937', borderRadius: 12, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: 'white', fontSize: 24, marginBottom: 24, textAlign: 'center' }}>{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && <input type="text" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 16, background: '#374151', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, boxSizing: 'border-box' }} required />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 16, background: '#374151', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, boxSizing: 'border-box' }} required />
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 16, background: '#374151', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, boxSizing: 'border-box' }} required />
          {error && <p style={{ color: '#f87171', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, background: '#2563eb', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>{loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          {mode === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginLeft: 8, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>{mode === 'login' ? "S'inscrire" : 'Se connecter'}</button>
        </p>
        <button onClick={onClose} style={{ marginTop: 20, width: '100%', padding: 12, background: 'transparent', border: '1px solid #4b5563', borderRadius: 8, color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>Continuer sans compte</button>
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
      <div style={{ background: '#1f2937', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>Mes documents</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <button onClick={onCreateDoc} style={{ width: '100%', padding: 16, background: '#059669', border: 'none', borderRadius: 8, color: 'white', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 24 }}>+ Nouveau document</button>
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement...</p> : docs.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Aucun document</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <button key={doc.shortId} onClick={() => onSelectDoc(doc.shortId)} style={{ padding: 16, background: '#374151', border: 'none', borderRadius: 8, color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.background = '#4b5563'} onMouseOut={e => e.target.style.background = '#374151'}>
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
      // Format date from snapshot
      const snapshotDate = new Date(entry.createdAt);
      const dateStr = snapshotDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/[/:]/g, '-').replace(', ', '_');
      const newTitle = (entry.data.title || currentTitle || 'SANS TITRE') + '_' + dateStr;
      
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
      <div style={{ background: '#1f2937', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>Historique</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        {restoring && <p style={{ color: '#60a5fa', textAlign: 'center', marginBottom: 16 }}>Restauration en cours...</p>}
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement...</p> : history.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Aucun historique</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => (
              <div key={entry._id} style={{ padding: 16, background: '#374151', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: entry.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>{entry.userName?.charAt(0).toUpperCase() || '?'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>{actionLabels[entry.action] || entry.action}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{entry.userName} • {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {entry.action === 'snapshot' && <button onClick={() => handleRestore(entry)} disabled={restoring} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12, opacity: restoring ? 0.5 : 1 }}>Restaurer</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ INLINE COMMENT (post-it style next to element) ============
const InlineComment = React.memo(({ comment, onReply, onResolve, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply }) => {
  const replyInputRef = useRef(null);
  useEffect(() => { if (isReplying && replyInputRef.current) replyInputRef.current.focus(); }, [isReplying]);

  return (
    <div style={{ background: '#fef3c7', borderRadius: 4, padding: 10, marginBottom: 8, boxShadow: '2px 2px 4px rgba(0,0,0,0.1)', borderLeft: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: comment.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 9 }}>{comment.userName?.charAt(0).toUpperCase()}</div>
        <span style={{ color: '#78350f', fontWeight: 'bold', fontSize: 11 }}>{comment.userName}</span>
        <span style={{ color: '#92400e', fontSize: 10 }}>{new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        {comment.resolved && <span style={{ fontSize: 9, background: '#10b981', color: 'white', padding: '1px 4px', borderRadius: 3 }}>Résolu</span>}
      </div>
      <p style={{ color: '#78350f', margin: '0 0 6px 0', fontSize: 12, lineHeight: 1.3 }}>{comment.content}</p>
      {comment.replies?.map(reply => (
        <div key={reply.id} style={{ marginLeft: 12, paddingLeft: 8, borderLeft: '2px solid #fbbf24', marginTop: 6 }}>
          <span style={{ color: '#92400e', fontWeight: 'bold', fontSize: 10 }}>{reply.userName}</span>
          <p style={{ color: '#78350f', margin: '2px 0 0 0', fontSize: 11 }}>{reply.content}</p>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {canComment && <button onClick={() => onReply(comment.id)} style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: 10, padding: 0 }}>Répondre</button>}
        {canComment && <button onClick={() => onResolve(comment.id)} style={{ background: 'none', border: 'none', color: comment.resolved ? '#10b981' : '#92400e', cursor: 'pointer', fontSize: 10, padding: 0 }}>{comment.resolved ? 'Rouvrir' : 'Résoudre'}</button>}
      </div>
      {isReplying && (
        <div style={{ marginTop: 6 }}>
          <textarea ref={replyInputRef} value={replyContent} onChange={e => onReplyChange(e.target.value)} placeholder="Réponse..." style={{ width: '100%', padding: 6, background: 'white', border: '1px solid #fbbf24', borderRadius: 4, color: '#78350f', fontSize: 11, resize: 'none', boxSizing: 'border-box' }} rows={2} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={() => onSubmitReply(comment.id)} style={{ padding: '4px 8px', background: '#f59e0b', border: 'none', borderRadius: 3, color: 'white', cursor: 'pointer', fontSize: 10 }}>Envoyer</button>
            <button onClick={onCancelReply} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #fbbf24', borderRadius: 3, color: '#92400e', cursor: 'pointer', fontSize: 10 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============ COMMENTS SIDEBAR (scrolls with content) ============
const CommentsSidebar = ({ comments, elements, activeIndex, token, docId, canComment, onAddComment }) => {
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [newCommentFor, setNewCommentFor] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  const addReply = async (commentId) => {
    if (!replyContent.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: replyContent }) });
      setReplyTo(null); setReplyContent('');
    } catch (err) { console.error(err); }
  };

  const toggleResolve = async (commentId) => {
    try { await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/resolve', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }); } catch (err) { console.error(err); }
  };

  const submitNewComment = async (elementId) => {
    if (!newCommentText.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ elementId, content: newCommentText }) });
      setNewCommentFor(null); setNewCommentText('');
    } catch (err) { console.error(err); }
  };

  // Group comments by element
  const commentsByElement = useMemo(() => {
    const map = {};
    comments.forEach(c => {
      if (!map[c.elementId]) map[c.elementId] = [];
      map[c.elementId].push(c);
    });
    return map;
  }, [comments]);

  return (
    <div style={{ width: 280, flexShrink: 0, paddingLeft: 20 }}>
      {elements.map((el, idx) => {
        const elComments = commentsByElement[el.id] || [];
        const isActive = activeIndex === idx;
        const showAddButton = isActive && canComment && !newCommentFor;
        
        return (
          <div key={el.id} style={{ minHeight: 30, marginBottom: 8, paddingTop: idx === 0 ? 0 : 4 }}>
            {elComments.filter(c => !c.resolved).map(c => (
              <InlineComment 
                key={c.id} 
                comment={c} 
                onReply={id => { setReplyTo(replyTo === id ? null : id); setReplyContent(''); }}
                onResolve={toggleResolve}
                canComment={canComment}
                isReplying={replyTo === c.id}
                replyContent={replyTo === c.id ? replyContent : ''}
                onReplyChange={setReplyContent}
                onSubmitReply={addReply}
                onCancelReply={() => { setReplyTo(null); setReplyContent(''); }}
              />
            ))}
            {showAddButton && (
              <button 
                onClick={() => setNewCommentFor(el.id)} 
                style={{ background: '#fef3c7', border: '1px dashed #fbbf24', borderRadius: 4, padding: '6px 10px', color: '#92400e', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                + Commenter
              </button>
            )}
            {newCommentFor === el.id && (
              <div style={{ background: '#fef3c7', borderRadius: 4, padding: 10, boxShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                <textarea 
                  autoFocus
                  value={newCommentText} 
                  onChange={e => setNewCommentText(e.target.value)} 
                  placeholder="Votre commentaire..." 
                  style={{ width: '100%', padding: 6, background: 'white', border: '1px solid #fbbf24', borderRadius: 4, color: '#78350f', fontSize: 11, resize: 'none', boxSizing: 'border-box' }} 
                  rows={3} 
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => submitNewComment(el.id)} style={{ padding: '6px 12px', background: '#f59e0b', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 11 }}>Ajouter</button>
                  <button onClick={() => { setNewCommentFor(null); setNewCommentText(''); }} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #fbbf24', borderRadius: 4, color: '#92400e', cursor: 'pointer', fontSize: 11 }}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
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

// ============ SCENE LINE ============
const SceneLine = React.memo(({ element, index, isActive, onUpdate, onFocus, onKeyDown, characters, onSelectCharacter, remoteCursors, onCursorMove, commentCount, canEdit }) => {
  const textareaRef = useRef(null);
  const [showAuto, setShowAuto] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const usersOnLine = remoteCursors.filter(u => u.cursor?.index === index);

  useEffect(() => { if (isActive && textareaRef.current) textareaRef.current.focus(); }, [isActive]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; } }, [element.content]);
  useEffect(() => {
    if (element.type === 'character' && isActive && element.content.length > 0) {
      const q = element.content.toUpperCase();
      const f = characters.filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
      setFiltered(f); setShowAuto(f.length > 0); setAutoIdx(0);
    } else { setShowAuto(false); setFiltered([]); }
  }, [element.content, element.type, isActive, characters]);

  const handleKey = (e) => {
    if (showAuto && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAutoIdx(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAutoIdx(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSelectCharacter(index, filtered[autoIdx]); setShowAuto(false); return; }
      if (e.key === 'Escape') { setShowAuto(false); return; }
    }
    onKeyDown(e, index);
  };

  return (
    <div style={{ position: 'relative', margin: 0, padding: 0, lineHeight: 0 }}>
      {usersOnLine.map(u => <RemoteCursor key={u.id} user={u} />)}
      {commentCount > 0 && <div style={{ position: 'absolute', right: -30, top: 2, width: 18, height: 18, background: '#fbbf24', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#78350f', boxShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>{commentCount}</div>}
      {isActive && <span style={{ position: 'absolute', left: -110, top: 2, fontSize: 10, color: '#888', width: 95, textAlign: 'right', lineHeight: '1.2', fontFamily: 'system-ui, sans-serif' }}>{ELEMENT_TYPES.find(t => t.id === element.type)?.label}</span>}
      <textarea ref={textareaRef} value={element.content} placeholder={isActive ? getPlaceholder(element.type) : ''} onChange={e => canEdit && onUpdate(index, { ...element, content: e.target.value })} onFocus={() => onFocus(index)} onKeyDown={handleKey} onSelect={e => onCursorMove(index, e.target.selectionStart)} style={{ ...getElementStyle(element.type), cursor: canEdit ? 'text' : 'default', opacity: canEdit ? 1 : 0.9 }} rows={1} readOnly={!canEdit} />
      {element.type === 'character' && showAuto && <div style={{ position: 'absolute', top: '100%', left: '37%', background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200 }}>{filtered.map((s, i) => <div key={s} onClick={() => { onSelectCharacter(index, s); setShowAuto(false); }} style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}>{s}</div>)}</div>}
    </div>
  );
});

// ============ USER AVATAR ============
const UserAvatar = ({ user, isYou }) => <div style={{ width: 32, height: 32, borderRadius: '50%', background: user.color || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 'bold', color: 'white', border: isYou ? '3px solid white' : 'none', boxSizing: 'border-box' }} title={user.name}>{user.name?.charAt(0).toUpperCase() || '?'}</div>;

// ============ MAIN EDITOR ============
export default function ScreenplayEditor() {
  const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: generateId(), type: 'scene', content: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [comments, setComments] = useState([]);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('editor');
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const socketRef = useRef(null);
  const loadedDocRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowImportExport(false);
    if (showImportExport) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showImportExport]);

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
            loadedDocRef.current = docId;
            if (data.isOwner) setMyRole('editor');
            else if (data.publicAccess?.enabled) setMyRole(data.publicAccess.role || 'viewer');
            else setMyRole('viewer');
          }
        }
      } catch (err) { console.error('[LOAD] Error:', err); }
      setLoading(false);
    };
    loadDocument();
  }, [docId, token]);

  // Socket connection
  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;
    
    socket.on('connect', () => { setConnected(true); setMyId(socket.id); if (docId) socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('document-state', data => { setUsers(data.users || []); if (data.role) setMyRole(data.role); });
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
    socket.on('comment-reply-added', ({ commentId, reply }) => setComments(p => p.map(c => c.id === commentId ? { ...c, replies: [...(c.replies || []), reply] } : c)));
    socket.on('comment-resolved', ({ commentId, resolved }) => setComments(p => p.map(c => c.id === commentId ? { ...c, resolved } : c)));
    
    return () => socket.disconnect();
  }, [docId, token]);

  const handleLogin = (user, newToken) => { setCurrentUser(user); setToken(newToken); setShowAuthModal(false); };
  const handleLogout = () => { localStorage.removeItem('screenplay-token'); localStorage.removeItem('screenplay-user'); setCurrentUser(null); setToken(null); };

  const createNewDocument = async () => {
    if (!token) { setShowAuthModal(true); return; }
    try {
      const res = await fetch(SERVER_URL + '/api/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      loadedDocRef.current = null;
      window.location.hash = data.id;
      setShowDocsList(false);
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
  const commentCounts = useMemo(() => { const counts = {}; comments.filter(c => !c.resolved).forEach(c => { counts[c.elementId] = (counts[c.elementId] || 0) + 1; }); return counts; }, [comments]);
  const totalComments = comments.filter(c => !c.resolved).length;

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);
  const updateElement = useCallback((i, el) => { setElements(p => { const u = [...p]; u[i] = el; return u; }); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-change', { index: i, element: el }); }, [connected, canEdit]);
  const insertElement = useCallback((after, type) => { const el = { id: generateId(), type, content: '' }; setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; }); setActiveIndex(after + 1); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-insert', { afterIndex: after, element: el }); }, [connected, canEdit]);
  const deleteElement = useCallback(i => { if (elements.length === 1) return; setElements(p => p.filter((_, idx) => idx !== i)); setActiveIndex(Math.max(0, i - 1)); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-delete', { index: i }); }, [elements.length, connected, canEdit]);
  const changeType = useCallback((i, t) => { setElements(p => { const u = [...p]; u[i] = { ...u[i], type: t }; return u; }); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-type-change', { index: i, type: t }); }, [connected, canEdit]);
  const handleCursor = useCallback((i, pos) => { if (socketRef.current && connected) socketRef.current.emit('cursor-move', { index: i, position: pos }); }, [connected]);
  const handleSelectChar = useCallback((i, name) => { updateElement(i, { ...elements[i], content: name }); setTimeout(() => insertElement(i, 'dialogue'), 50); }, [elements, updateElement, insertElement]);

  const handleKeyDown = useCallback((e, index) => {
    if (!canEdit) return;
    const el = elements[index];
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (el.type === 'parenthetical' && el.content.trim()) { let c = el.content.trim(); if (!c.startsWith('(')) c = '(' + c; if (!c.endsWith(')')) c = c + ')'; updateElement(index, { ...el, content: c }); } insertElement(index, getNextType(el.type)); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const prev = index > 0 ? elements[index - 1] : null;
      const fromDial = prev && (prev.type === 'dialogue' || prev.type === 'parenthetical');
      if (el.type === 'action') changeType(index, e.shiftKey ? 'scene' : 'character');
      else if (el.type === 'character') changeType(index, fromDial ? (e.shiftKey ? 'scene' : 'action') : (e.shiftKey ? 'action' : 'scene'));
      else if (el.type === 'scene') changeType(index, fromDial ? (e.shiftKey ? 'action' : 'character') : (e.shiftKey ? 'character' : 'action'));
      else if (el.type === 'dialogue' && !e.shiftKey) changeType(index, 'parenthetical');
      else if (el.type === 'parenthetical' && !e.shiftKey) { if (el.content.trim()) { let c = el.content.trim(); if (!c.startsWith('(')) c = '(' + c; if (!c.endsWith(')')) c = c + ')'; updateElement(index, { ...el, content: c }); } changeType(index, 'dialogue'); }
    }
    if (e.key === 'Backspace' && el.content === '' && elements.length > 1) { e.preventDefault(); deleteElement(index); }
    if (e.key === 'ArrowUp' && e.metaKey) { e.preventDefault(); setActiveIndex(Math.max(0, index - 1)); }
    if (e.key === 'ArrowDown' && e.metaKey) { e.preventDefault(); setActiveIndex(Math.min(elements.length - 1, index + 1)); }
    if ((e.metaKey || e.ctrlKey) && ['1','2','3','4','5','6'].includes(e.key)) { e.preventDefault(); changeType(index, ELEMENT_TYPES[parseInt(e.key) - 1].id); }
  }, [elements, insertElement, changeType, deleteElement, updateElement, canEdit]);

  // ============ IMPORT FDX - Creates new document ============
  const importFDX = async () => {
    if (!token) { setShowAuthModal(true); return; }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fdx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
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
        } else {
          const err = await res.json();
          console.error('[IMPORT] Server error:', err);
          alert('Erreur import: ' + (err.error || 'Erreur serveur'));
        }
      } catch (err) { 
        console.error('[IMPORT] Error:', err);
        alert('Erreur import: ' + err.message);
      }
      setImporting(false);
    };
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

  const copyLink = () => { navigator.clipboard.writeText(window.location.origin + '/#' + docId); alert('Lien copié !'); };

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#e5e7eb' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={createNewDocument} onClose={() => setShowDocsList(false)} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} />}
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, background: '#1f2937', borderBottom: '1px solid #374151', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input value={title} onChange={e => emitTitle(e.target.value)} disabled={!canEdit} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 18, fontWeight: 'bold', outline: 'none', maxWidth: 300 }} />
          <span style={{ color: '#6b7280', fontSize: 14 }}>{totalPages} page{totalPages > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: connected ? '#10b981' : '#ef4444' }}>{connected ? '● En ligne' : '● Hors ligne'}</span>
          {!canEdit && <span style={{ fontSize: 12, background: '#f59e0b', color: 'black', padding: '2px 8px', borderRadius: 4 }}>Lecture seule</span>}
          {(loading || importing) && <span style={{ fontSize: 12, color: '#60a5fa' }}>{importing ? 'Import...' : 'Chargement...'}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: -8 }}>{users.slice(0, 5).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -8 : 0 }}><UserAvatar user={u} isYou={u.id === myId} /></div>)}{users.length > 5 && <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>+{users.length - 5}</span>}</div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#9ca3af' }}>{currentUser.name}</span>
              <button onClick={handleLogout} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Déconnexion</button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>Connexion</button>
          )}
          {token && <button onClick={() => setShowDocsList(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }} title="Mes documents">📁</button>}
          {!docId ? (
            <button onClick={createNewDocument} style={{ padding: '6px 16px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>+ Nouveau</button>
          ) : (
            <>
              <button onClick={copyLink} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }} title="Copier le lien">🔗</button>
              {token && <button onClick={bulkSave} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }} title="Forcer la sauvegarde">💾</button>}
            </>
          )}
          {token && docId && <button onClick={() => setShowHistory(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }} title="Historique">📜</button>}
          <button onClick={() => setShowComments(!showComments)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: showComments ? '#374151' : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13, position: 'relative' }} title="Commentaires">
            💬 {totalComments > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#f59e0b', color: 'black', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{totalComments}</span>}
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowImportExport(!showImportExport); }} style={{ padding: '6px 12px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>
              Import/Export ▾
            </button>
            {showImportExport && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                <button onClick={() => { importFDX(); setShowImportExport(false); }} disabled={importing || !token} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #374151', color: !token ? '#6b7280' : 'white', cursor: !token ? 'default' : 'pointer', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📥 Importer FDX
                </button>
                <button onClick={() => { exportFDX(); setShowImportExport(false); }} disabled={!docId} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid #374151', color: !docId ? '#6b7280' : 'white', cursor: !docId ? 'default' : 'pointer', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📤 Exporter FDX
                </button>
                <button onClick={() => { exportPDF(); setShowImportExport(false); }} disabled={!docId} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', color: !docId ? '#6b7280' : 'white', cursor: !docId ? 'default' : 'pointer', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📄 Exporter PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {pages.map((page) => (
            <div key={page.number} style={{ position: 'relative' }}>
              {/* Page number left */}
              <span style={{ position: 'absolute', left: -40, top: 20, fontSize: 12, color: '#666', fontFamily: 'Courier Prime, monospace' }}>{page.number}</span>
              {/* Page number right */}
              <span style={{ position: 'absolute', right: -40, top: 20, fontSize: 12, color: '#666', fontFamily: 'Courier Prime, monospace' }}>{page.number}</span>
              
              {/* Page content */}
              <div style={{ 
                background: 'white', 
                color: '#111', 
                width: '210mm', 
                minHeight: '297mm',
                padding: '25mm 25mm 25mm 38mm', 
                boxSizing: 'border-box', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                flexShrink: 0 
              }}>
                {page.elements.map(({ element, index }) => (
                  <div key={element.id} data-element-index={index}>
                    <SceneLine 
                      element={element} 
                      index={index} 
                      isActive={activeIndex === index} 
                      onUpdate={updateElement} 
                      onFocus={setActiveIndex} 
                      onKeyDown={handleKeyDown} 
                      characters={extractedCharacters} 
                      onSelectCharacter={handleSelectChar} 
                      remoteCursors={remoteCursors} 
                      onCursorMove={handleCursor} 
                      commentCount={commentCounts[element.id] || 0} 
                      canEdit={canEdit} 
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {showComments && (
          <CommentsSidebar 
            comments={comments} 
            elements={elements} 
            activeIndex={activeIndex} 
            token={token} 
            docId={docId} 
            canComment={canComment} 
          />
        )}
      </div>
    </div>
  );
}
