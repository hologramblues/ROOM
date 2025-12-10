import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://room-production-19a5.up.railway.app';

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

const USER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF4500'];

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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer' }}>×</button>
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
const HistoryPanel = ({ docId, token, onRestore, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleRestore = async (historyId) => {
    if (!window.confirm('Restaurer cette version ? La version actuelle sera sauvegardée.')) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/restore/' + historyId, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) { onRestore(); onClose(); }
    } catch (err) { console.error(err); }
  };

  const actionLabels = { 'title-change': '📝 Titre modifié', 'element-change': '✏️ Élément modifié', 'element-type-change': '🔄 Type changé', 'element-insert': '➕ Élément ajouté', 'element-delete': '🗑️ Élément supprimé', 'snapshot': '📸 Snapshot' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1f2937', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ color: 'white', fontSize: 24, margin: 0 }}>Historique</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 24, cursor: 'pointer' }}>×</button>
        </div>
        {loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement...</p> : history.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Aucun historique</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(entry => (
              <div key={entry._id} style={{ padding: 16, background: '#374151', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: entry.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>{entry.userName?.charAt(0).toUpperCase() || '?'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>{actionLabels[entry.action] || entry.action}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{entry.userName} • {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {entry.action === 'snapshot' && <button onClick={() => handleRestore(entry._id)} style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12 }}>Restaurer</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ COMMENT ITEM (separate component to fix re-render issue) ============
const CommentItem = React.memo(({ comment, onReply, onResolve, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply, onNavigate }) => {
  const replyInputRef = useRef(null);
  
  useEffect(() => {
    if (isReplying && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [isReplying]);

  return (
    <div style={{ padding: 12, background: '#374151', borderRadius: 8, marginBottom: 8, cursor: 'pointer' }} onClick={() => onNavigate(comment.elementId)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: comment.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 10 }}>{comment.userName?.charAt(0).toUpperCase()}</div>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{comment.userName}</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>{new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
      </div>
      <p style={{ color: '#e5e7eb', margin: '0 0 8px 0', fontSize: 13 }}>{comment.content}</p>
      {comment.replies?.map(reply => (
        <div key={reply.id} style={{ marginLeft: 16, paddingLeft: 12, borderLeft: '2px solid #4b5563', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#9ca3af', fontWeight: 'bold', fontSize: 12 }}>{reply.userName}</span>
          </div>
          <p style={{ color: '#d1d5db', margin: 0, fontSize: 12 }}>{reply.content}</p>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
        {canComment && <button onClick={(e) => { e.stopPropagation(); onReply(comment.id); }} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12 }}>Répondre</button>}
        {canComment && <button onClick={(e) => { e.stopPropagation(); onResolve(comment.id); }} style={{ background: 'none', border: 'none', color: comment.resolved ? '#10b981' : '#9ca3af', cursor: 'pointer', fontSize: 12 }}>{comment.resolved ? '↩️ Rouvrir' : '✓ Résoudre'}</button>}
      </div>
      {isReplying && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <textarea 
            ref={replyInputRef}
            value={replyContent} 
            onChange={e => onReplyChange(e.target.value)} 
            placeholder="Votre réponse..." 
            style={{ width: '100%', padding: 8, background: '#1f2937', border: '1px solid #4b5563', borderRadius: 6, color: 'white', fontSize: 12, resize: 'none', boxSizing: 'border-box' }} 
            rows={2} 
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => onSubmitReply(comment.id)} style={{ padding: '6px 12px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Envoyer</button>
            <button onClick={onCancelReply} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #4b5563', borderRadius: 4, color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============ COMMENTS PANEL ============
const CommentsPanel = ({ comments, elements, activeIndex, token, docId, onClose, canComment, onNavigateToElement }) => {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  const activeElementId = elements[activeIndex]?.id;
  const elementComments = comments.filter(c => c.elementId === activeElementId);
  const otherComments = comments.filter(c => c.elementId !== activeElementId && !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  const addComment = async () => {
    if (!newComment.trim() || !activeElementId) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ elementId: activeElementId, content: newComment }) });
      setNewComment('');
    } catch (err) { console.error(err); }
  };

  const addReply = async (commentId) => {
    if (!replyContent.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: replyContent }) });
      setReplyTo(null);
      setReplyContent('');
    } catch (err) { console.error(err); }
  };

  const toggleResolve = async (commentId) => {
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/resolve', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
    } catch (err) { console.error(err); }
  };

  const handleNavigate = (elementId) => {
    const index = elements.findIndex(el => el.id === elementId);
    if (index !== -1) {
      onNavigateToElement(index);
    }
  };

  const handleReply = (commentId) => {
    setReplyTo(replyTo === commentId ? null : commentId);
    setReplyContent('');
  };

  const handleCancelReply = () => {
    setReplyTo(null);
    setReplyContent('');
  };

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 340, background: '#1f2937', borderLeft: '1px solid #374151', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ color: 'white', margin: 0, fontSize: 16 }}>💬 Commentaires</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeElementId && canComment && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Commenter l'élément sélectionné :</div>
            <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ajouter un commentaire..." style={{ width: '100%', padding: 10, background: '#374151', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, resize: 'none', boxSizing: 'border-box' }} rows={3} />
            <button onClick={addComment} disabled={!newComment.trim()} style={{ marginTop: 8, padding: '8px 16px', background: newComment.trim() ? '#2563eb' : '#4b5563', border: 'none', borderRadius: 6, color: 'white', cursor: newComment.trim() ? 'pointer' : 'default', fontSize: 13 }}>Commenter</button>
          </div>
        )}
        {elementComments.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>Sur cet élément ({elementComments.length})</div>
            {elementComments.map(c => (
              <CommentItem 
                key={c.id} 
                comment={c} 
                onReply={handleReply}
                onResolve={toggleResolve}
                canComment={canComment}
                isReplying={replyTo === c.id}
                replyContent={replyTo === c.id ? replyContent : ''}
                onReplyChange={setReplyContent}
                onSubmitReply={addReply}
                onCancelReply={handleCancelReply}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
        {otherComments.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Autres commentaires ({otherComments.length})</div>
            {otherComments.map(c => (
              <CommentItem 
                key={c.id} 
                comment={c} 
                onReply={handleReply}
                onResolve={toggleResolve}
                canComment={canComment}
                isReplying={replyTo === c.id}
                replyContent={replyTo === c.id ? replyContent : ''}
                onReplyChange={setReplyContent}
                onSubmitReply={addReply}
                onCancelReply={handleCancelReply}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
        {resolvedComments.length > 0 && (
          <div>
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>Résolus ({resolvedComments.length})</div>
            {resolvedComments.map(c => (
              <CommentItem 
                key={c.id} 
                comment={c} 
                onReply={handleReply}
                onResolve={toggleResolve}
                canComment={canComment}
                isReplying={replyTo === c.id}
                replyContent={replyTo === c.id ? replyContent : ''}
                onReplyChange={setReplyContent}
                onSubmitReply={addReply}
                onCancelReply={handleCancelReply}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
        {comments.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>Aucun commentaire.<br/>Sélectionnez un élément pour commenter.</p>
        )}
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

const getPlaceholder = (type) => {
  const p = { scene: 'INT./EXT. LIEU - JOUR/NUIT', action: "Description de l'action...", character: 'NOM DU PERSONNAGE', dialogue: 'Réplique du personnage...', parenthetical: '(indication de jeu)', transition: 'CUT TO:' };
  return p[type] || '';
};

const getNextType = (t) => ({ scene: 'action', action: 'action', character: 'dialogue', dialogue: 'character', parenthetical: 'dialogue', transition: 'scene' }[t] || 'action');

// ============ SCENE LINE ============
const SceneLine = React.forwardRef(({ element, index, isActive, onUpdate, onFocus, onKeyDown, characters, onSelectCharacter, remoteCursors, onCursorMove, commentCount, canEdit }, ref) => {
  const textareaRef = useRef(null);
  const [showAuto, setShowAuto] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const usersOnLine = remoteCursors.filter(u => u.cursor?.index === index);

  // Expose scrollIntoView via ref
  React.useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

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
      {/* Curseurs distants - FIXED */}
      {usersOnLine.map(u => (
        <div key={u.id} style={{ position: 'absolute', left: -8, top: 0, bottom: 0, display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ width: 3, height: '100%', background: u.color, borderRadius: 2 }} />
          <div style={{ 
            marginLeft: 4,
            marginTop: -2,
            background: u.color, 
            color: 'white', 
            fontSize: 9, 
            padding: '1px 4px', 
            borderRadius: 3, 
            whiteSpace: 'nowrap', 
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
            maxWidth: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{u.name}</div>
        </div>
      ))}
      {/* Badge commentaires */}
      {commentCount > 0 && <div style={{ position: 'absolute', right: -30, top: 0, background: '#f59e0b', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontFamily: 'sans-serif' }}>{commentCount}</div>}
      {/* Label type */}
      {isActive && <span style={{ position: 'absolute', left: -110, top: 0, fontSize: 10, color: '#888', width: 100, textAlign: 'right', lineHeight: '1.2', fontFamily: 'sans-serif' }}>{ELEMENT_TYPES.find(t => t.id === element.type)?.label}</span>}
      <textarea ref={textareaRef} value={element.content} placeholder={isActive ? getPlaceholder(element.type) : ''} onChange={e => canEdit && onUpdate(index, { ...element, content: e.target.value })} onFocus={() => onFocus(index)} onKeyDown={handleKey} onSelect={e => onCursorMove(index, e.target.selectionStart)} style={{ ...getElementStyle(element.type), cursor: canEdit ? 'text' : 'default', opacity: canEdit ? 1 : 0.9 }} rows={1} readOnly={!canEdit} />
      {element.type === 'character' && showAuto && <div style={{ position: 'absolute', top: '100%', left: '37%', background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200 }}>{filtered.map((s, i) => <div key={s} onClick={() => { onSelectCharacter(index, s); setShowAuto(false); }} style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}>{s}</div>)}</div>}
    </div>
  );
});

// ============ PAGE BREAK ============
const PageBreak = ({ pageNumber }) => <div style={{ position: 'relative', borderTop: '1px dashed #ccc', marginTop: 20, marginBottom: 20 }}><span style={{ position: 'absolute', right: -60, top: -10, background: '#f5f5f5', padding: '2px 8px', fontSize: 10, color: '#666' }}>{pageNumber}</span></div>;

// ============ USER AVATAR ============
const UserAvatar = ({ user, isYou }) => <div style={{ width: 32, height: 32, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 'bold', color: 'white', border: isYou ? '3px solid white' : 'none', boxSizing: 'border-box' }} title={user.name}>{user.name?.charAt(0).toUpperCase()}</div>;

// ============ MAIN EDITOR ============
export default function ScreenplayEditor() {
  const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: crypto.randomUUID(), type: 'scene', content: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [comments, setComments] = useState([]);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('viewer');
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const socketRef = useRef(null);
  const elementRefs = useRef({});

  // Hash change listener
  useEffect(() => {
    const handleHash = () => setDocId(window.location.hash.slice(1) || null);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Socket connection
  useEffect(() => {
    const socket = io(SERVER_URL, { 
  transports: ['websocket', 'polling'], 
  auth: { token },
  timeout: 60000,
  reconnectionAttempts: 5,
  maxHttpBufferSize: 1e8
});    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setMyId(socket.id); if (docId) socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('document-state', data => { setTitle(data.title); setElements(data.elements); setCharacters(data.characters || []); setComments(data.comments || []); setUsers(data.users || []); setMyRole(data.role || 'viewer'); });
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
    socket.on('full-sync', ({ title, elements }) => { setTitle(title); setElements(elements); });
    return () => socket.disconnect();
  }, [docId, token]);

  const handleLogin = (user, newToken) => { setCurrentUser(user); setToken(newToken); setShowAuthModal(false); };
  const handleLogout = () => { localStorage.removeItem('screenplay-token'); localStorage.removeItem('screenplay-user'); setCurrentUser(null); setToken(null); };

  const createNewDocument = async () => {
    if (!token) { setShowAuthModal(true); return; }
    try {
      const res = await fetch(SERVER_URL + '/api/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setDocId(data.id);
      window.location.hash = data.id;
      setShowDocsList(false);
      if (socketRef.current) socketRef.current.emit('join-document', { docId: data.id });
    } catch (err) { console.error(err); }
  };

  const selectDocument = (id) => {
    setDocId(id);
    window.location.hash = id;
    setShowDocsList(false);
    if (socketRef.current?.connected) socketRef.current.emit('join-document', { docId: id });
  };

  // Navigate to element (for comments)
  const navigateToElement = useCallback((index) => {
    setActiveIndex(index);
    // Scroll to element
    setTimeout(() => {
      const el = document.querySelector(`[data-element-index="${index}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, []);

  // Page breaks
  const pageBreaks = useMemo(() => {
    const breaks = []; let h = 0; let p = 1;
    const getLines = el => { const l = el.content ? Math.ceil(el.content.length / 60) : 1; const e = { scene: 2, action: 1, character: 2, dialogue: 0.5, parenthetical: 1, transition: 2 }; return l + (e[el.type] || 0); };
    elements.forEach((el, idx) => { h += getLines(el); if (h >= LINES_PER_PAGE) { p++; breaks.push({ afterIndex: idx, pageNumber: p }); h = getLines(el); } });
    return breaks;
  }, [elements]);

  const totalPages = pageBreaks.length + 1;
  const extractedCharacters = useMemo(() => { const c = new Set(characters); elements.forEach(el => { if (el.type === 'character' && el.content.trim()) c.add(el.content.trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); }); return Array.from(c).sort(); }, [elements, characters]);
  const remoteCursors = useMemo(() => users.filter(u => u.id !== myId), [users, myId]);
  const canEdit = myRole === 'editor';
  const canComment = myRole === 'editor' || myRole === 'commenter';
  const commentCounts = useMemo(() => { const counts = {}; comments.filter(c => !c.resolved).forEach(c => { counts[c.elementId] = (counts[c.elementId] || 0) + 1; }); return counts; }, [comments]);
  const totalComments = comments.filter(c => !c.resolved).length;

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);
  const updateElement = useCallback((i, el) => { setElements(p => { const u = [...p]; u[i] = el; return u; }); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-change', { index: i, element: el }); }, [connected, canEdit]);
  const insertElement = useCallback((after, type) => { const el = { id: crypto.randomUUID(), type, content: '' }; setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; }); setActiveIndex(after + 1); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-insert', { afterIndex: after, element: el }); }, [connected, canEdit]);
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

  const elementsWithBreaks = useMemo(() => { const r = []; const m = new Map(pageBreaks.map(b => [b.afterIndex, b.pageNumber])); elements.forEach((el, i) => { r.push({ type: 'element', element: el, index: i }); if (m.has(i)) r.push({ type: 'pageBreak', pageNumber: m.get(i) }); }); return r; }, [elements, pageBreaks]);

  // ============ IMPORT FDX ============
  const importFDX = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fdx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const paragraphs = xml.querySelectorAll('Paragraph');
      const newElements = [];
      paragraphs.forEach(p => {
        const type = FDX_TO_TYPE[p.getAttribute('Type')] || 'action';
        const textNode = p.querySelector('Text');
        const content = textNode ? textNode.textContent : '';
        if (content.trim() || newElements.length === 0) {
          newElements.push({ id: crypto.randomUUID(), type, content: content.trim() });
        }
      });
      if (newElements.length > 0) {
        setElements(newElements);
        newElements.forEach((el, i) => {
          if (socketRef.current && connected && canEdit) {
            if (i === 0) socketRef.current.emit('element-change', { index: 0, element: el });
            else socketRef.current.emit('element-insert', { afterIndex: i - 1, element: el });
          }
        });
      }
    };
    input.click();
  };

  // ============ EXPORT FDX ============
  const exportFDX = () => {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FinalDraft DocumentType="Script" Version="3">\n<Content>\n';
    elements.forEach(el => { xml += '<Paragraph Type="' + (TYPE_TO_FDX[el.type] || 'Action') + '"><Text>' + esc(el.content) + '</Text></Paragraph>\n'; });
    xml += '</Content>\n</FinalDraft>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fdx'; a.click();
  };

  // ============ EXPORT PDF ============
  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    const styles = `
      body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 12pt; line-height: 1; margin: 1in; }
      .scene { text-transform: uppercase; font-weight: bold; margin-top: 2em; }
      .action { margin-top: 1em; }
      .character { text-transform: uppercase; font-weight: bold; margin-left: 37%; margin-top: 1em; }
      .dialogue { margin-left: 17%; width: 42%; }
      .parenthetical { margin-left: 27%; font-style: italic; }
      .transition { text-transform: uppercase; text-align: right; margin-top: 1em; }
      @media print { @page { margin: 1in; } }
    `;
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
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} onRestore={() => socketRef.current?.emit('join-document', { docId })} onClose={() => setShowHistory(false)} />}
      {showComments && <CommentsPanel comments={comments} elements={elements} activeIndex={activeIndex} token={token} docId={docId} onClose={() => setShowComments(false)} canComment={canComment} onNavigateToElement={navigateToElement} />}
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, background: '#1f2937', borderBottom: '1px solid #374151', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input value={title} onChange={e => emitTitle(e.target.value)} disabled={!canEdit} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 18, fontWeight: 'bold', outline: 'none', maxWidth: 300 }} />
          <span style={{ color: '#6b7280', fontSize: 14 }}>{totalPages} page{totalPages > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: connected ? '#10b981' : '#ef4444' }}>{connected ? '● En ligne' : '● Hors ligne'}</span>
          {!canEdit && <span style={{ fontSize: 12, background: '#f59e0b', color: 'black', padding: '2px 8px', borderRadius: 4 }}>Lecture seule</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Users */}
          <div style={{ display: 'flex', gap: -8 }}>{users.slice(0, 5).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -8 : 0 }}><UserAvatar user={u} isYou={u.id === myId} /></div>)}{users.length > 5 && <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 8 }}>+{users.length - 5}</span>}</div>
          
          {/* Auth */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#9ca3af' }}>{currentUser.name}</span>
              <button onClick={handleLogout} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Déconnexion</button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>Connexion</button>
          )}
          
          {/* Documents button */}
          {token && <button onClick={() => setShowDocsList(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>📁</button>}
          
          {/* New / Share */}
          {!docId ? (
            <button onClick={createNewDocument} style={{ padding: '6px 16px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>+ Nouveau</button>
          ) : (
            <button onClick={copyLink} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>🔗</button>
          )}
          
          {/* History */}
          {token && docId && <button onClick={() => setShowHistory(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>📜</button>}
          
          {/* Comments */}
          <button onClick={() => setShowComments(!showComments)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: showComments ? '#374151' : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13, position: 'relative' }}>
            💬 {totalComments > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: '#f59e0b', color: 'black', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{totalComments}</span>}
          </button>
          
          {/* Help */}
          <button onClick={() => setShowHelp(!showHelp)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: showHelp ? '#374151' : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>?</button>
          
          {/* Import */}
          <button onClick={importFDX} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>📥</button>
          
          {/* Export */}
          <button onClick={exportFDX} style={{ padding: '6px 12px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>FDX</button>
          <button onClick={exportPDF} style={{ padding: '6px 12px', background: '#7c3aed', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 }}>PDF</button>
        </div>
      </div>
      
      {/* HELP BAR */}
      {showHelp && <div style={{ background: '#1f2937', borderBottom: '1px solid #374151', padding: '12px 24px', fontSize: 12, color: '#9ca3af' }}>Entrée → Nouvelle ligne | Tab → Changer type | ⌘1-6 → Types directs | ⌘↑/↓ → Navigation | Backspace sur ligne vide → Supprimer</div>}
      
      {/* EDITOR */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32, paddingRight: showComments ? 372 : 32 }}>
        <div style={{ background: 'white', color: '#111', width: '210mm', minHeight: '297mm', padding: '25mm 25mm 25mm 38mm', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          <div style={{ position: 'relative' }}><span style={{ position: 'absolute', right: -50, top: 0, background: '#f5f5f5', padding: '2px 8px', fontSize: 10, color: '#666' }}>1</span></div>
          {elementsWithBreaks.map((item, idx) => item.type === 'pageBreak' ? <PageBreak key={'b' + idx} pageNumber={item.pageNumber} /> : (
            <div key={item.element.id} data-element-index={item.index}>
              <SceneLine 
                element={item.element} 
                index={item.index} 
                isActive={activeIndex === item.index} 
                onUpdate={updateElement} 
                onFocus={setActiveIndex} 
                onKeyDown={handleKeyDown} 
                characters={extractedCharacters} 
                onSelectCharacter={handleSelectChar} 
                remoteCursors={remoteCursors} 
                onCursorMove={handleCursor} 
                commentCount={commentCounts[item.element.id] || 0} 
                canEdit={canEdit} 
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
