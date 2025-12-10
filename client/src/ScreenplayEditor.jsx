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
      <div style={{ background: '#1f2937', borderRadius: 12, padding: 32, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
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
                <div key={entry._id} style={{ padding: 16, background: '#374151', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
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
const CommentsSidebar = ({ comments, elements, activeIndex, token, docId, canComment, onClose }) => {
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
    <div style={{ width: 300, flexShrink: 0, background: '#1f2937', borderRadius: 8, marginLeft: 20, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 150px)', position: 'sticky', top: 80 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'white' }}>💬 Commentaires</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
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
      background: darkMode ? '#1f2937' : 'white', 
      borderLeft: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, 
      zIndex: 100, 
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black' }}>👥 Personnages</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {characterStats.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucun personnage</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
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
                    borderBottom: `1px solid ${darkMode ? '#374151' : '#f3f4f6'}`,
                    cursor: 'pointer',
                    background: idx % 2 === 0 ? 'transparent' : (darkMode ? '#374151' : '#f9fafb')
                  }}
                >
                  <td style={{ padding: '10px 4px', color: darkMode ? 'white' : 'black', fontWeight: 500 }}>{char.name}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#374151' }}>{char.lines}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#d1d5db' : '#374151' }}>{char.sceneCount}</td>
                  <td style={{ padding: '10px 4px', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>Sc. {char.firstAppearance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
        {characterStats.length} personnage{characterStats.length > 1 ? 's' : ''} • {characterStats.reduce((a, c) => a + c.lines, 0)} répliques
      </div>
    </div>
  );
};

// ============ NOTE EDITOR MODAL ============
const NoteEditorModal = ({ elementId, note, onSave, onPushToComment, onClose, darkMode, canPush }) => {
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || '#fef3c7');
  const colors = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#f3e8ff'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black' }}>📝 Note personnelle</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        <textarea 
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Votre note (visible uniquement par vous)..."
          style={{ 
            width: '100%', 
            padding: 12, 
            background: color, 
            border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, 
            borderRadius: 8, 
            color: '#374151', 
            fontSize: 14, 
            resize: 'none', 
            boxSizing: 'border-box',
            minHeight: 120
          }}
          rows={5}
        />
        
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => setColor(c)}
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 6, 
                background: c, 
                border: color === c ? '2px solid #2563eb' : '1px solid #d1d5db',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => onSave(elementId, content, color)} 
              style={{ padding: '10px 20px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
            >
              Sauvegarder
            </button>
            {note && (
              <button 
                onClick={() => onSave(elementId, '', '')} 
                style={{ padding: '10px 20px', background: '#ef4444', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 14 }}
              >
                Supprimer
              </button>
            )}
          </div>
          {note && canPush && (
            <button 
              onClick={() => onPushToComment(elementId)} 
              style={{ padding: '10px 16px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              💬 Publier en commentaire
            </button>
          )}
        </div>
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
    ]},
    { category: 'Édition', items: [
      { keys: '⌘S', desc: 'Créer un snapshot' },
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
    ]},
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black' }}>⌨️ Raccourcis clavier</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {shortcuts.map(cat => (
          <div key={cat.category} style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{cat.category}</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {cat.items.map(item => (
                <div key={item.keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: darkMode ? '#374151' : '#f3f4f6', borderRadius: 6 }}>
                  <span style={{ fontSize: 13, color: darkMode ? 'white' : 'black' }}>{item.desc}</span>
                  <kbd style={{ 
                    padding: '4px 8px', 
                    background: darkMode ? '#4b5563' : 'white', 
                    border: `1px solid ${darkMode ? '#6b7280' : '#d1d5db'}`, 
                    borderRadius: 4, 
                    fontSize: 12, 
                    fontFamily: 'monospace',
                    color: darkMode ? '#e5e7eb' : '#374151'
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black' }}>✏️ Renommer un personnage</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Personnage actuel</label>
          <select 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 12px', 
              background: darkMode ? '#374151' : 'white', 
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14 
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
              background: darkMode ? '#374151' : 'white', 
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
              borderRadius: 6, 
              color: darkMode ? 'white' : 'black', 
              fontSize: 14,
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14 }}>
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

// ============ SCENE LINE ============
const SceneLine = React.memo(({ element, index, isActive, onUpdate, onFocus, onKeyDown, characters, locations, onSelectCharacter, onSelectLocation, remoteCursors, onCursorMove, commentCount, canEdit, isLocked, sceneNumber, showSceneNumbers, note, onNoteClick, onOpenComments }) => {
  const textareaRef = useRef(null);
  const [showAuto, setShowAuto] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const [autoType, setAutoType] = useState(null); // 'character' or 'location'
  const usersOnLine = remoteCursors.filter(u => u.cursor?.index === index);

  useEffect(() => { if (isActive && textareaRef.current) textareaRef.current.focus(); }, [isActive]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; } }, [element.content]);
  
  // Character autocomplete
  useEffect(() => {
    if (element.type === 'character' && isActive && element.content.length > 0) {
      const q = element.content.toUpperCase();
      const f = characters.filter(c => c.toUpperCase().startsWith(q) && c.toUpperCase() !== q);
      setFiltered(f); setShowAuto(f.length > 0); setAutoIdx(0); setAutoType('character');
    } else if (element.type === 'scene' && isActive && element.content.length > 4) {
      // Location autocomplete after INT. or EXT.
      const match = element.content.match(/^(INT\.|EXT\.|INT\/EXT\.?)\s*(.*)$/i);
      if (match && match[2] && match[2].length > 0) {
        const q = match[2].toUpperCase();
        const f = locations.filter(l => l.startsWith(q) && l !== q);
        setFiltered(f); setShowAuto(f.length > 0); setAutoIdx(0); setAutoType('location');
      } else { setShowAuto(false); setFiltered([]); }
    } else { setShowAuto(false); setFiltered([]); }
  }, [element.content, element.type, isActive, characters, locations]);

  const handleKey = (e) => {
    if (showAuto && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAutoIdx(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAutoIdx(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        if (autoType === 'character') {
          onSelectCharacter(index, filtered[autoIdx]); 
        } else if (autoType === 'location') {
          onSelectLocation(index, filtered[autoIdx]);
        }
        setShowAuto(false); 
        return; 
      }
      if (e.key === 'Escape') { setShowAuto(false); return; }
    }
    onKeyDown(e, index);
  };

  return (
    <div style={{ position: 'relative', margin: 0, padding: 0, lineHeight: 0 }}>
      {usersOnLine.map(u => <RemoteCursor key={u.id} user={u} />)}
      
      {/* Lock indicator for scene heading */}
      {element.type === 'scene' && isLocked && (
        <span style={{ position: 'absolute', left: showSceneNumbers ? -65 : -30, top: 4, fontSize: 14, color: '#f59e0b' }} title="Scène verrouillée">🔒</span>
      )}
      
      {/* Scene number (left side) */}
      {element.type === 'scene' && showSceneNumbers && sceneNumber && (
        <span style={{ position: 'absolute', left: -35, top: 4, fontSize: '12pt', fontFamily: 'Courier Prime, monospace', color: '#111', fontWeight: 'bold' }}>{sceneNumber}</span>
      )}
      
      {/* Scene number (right side) */}
      {element.type === 'scene' && showSceneNumbers && sceneNumber && (
        <span style={{ position: 'absolute', right: -35, top: 4, fontSize: '12pt', fontFamily: 'Courier Prime, monospace', color: '#111', fontWeight: 'bold' }}>{sceneNumber}</span>
      )}
      
      {/* Note indicator */}
      {note && (
        <div 
          onClick={() => onNoteClick(element.id)} 
          style={{ position: 'absolute', right: -55, top: 2, width: 20, height: 20, background: note.color || '#fbbf24', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer', boxShadow: '1px 1px 3px rgba(0,0,0,0.2)' }}
          title={note.content}
        >📝</div>
      )}
      
      {/* Comment badge - clickable to open comments */}
      {commentCount > 0 && (
        <div 
          onClick={onOpenComments}
          style={{ position: 'absolute', right: note ? -80 : -30, top: 2, width: 18, height: 18, background: '#fbbf24', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#78350f', boxShadow: '1px 1px 2px rgba(0,0,0,0.2)', cursor: 'pointer' }}
          title="Voir les commentaires"
        >{commentCount}</div>
      )}
      
      {/* Type label */}
      {isActive && <span style={{ position: 'absolute', left: showSceneNumbers && element.type === 'scene' ? -145 : -110, top: 2, fontSize: 10, color: isLocked ? '#f59e0b' : '#888', width: 95, textAlign: 'right', lineHeight: '1.2', fontFamily: 'system-ui, sans-serif' }}>{isLocked ? '🔒 ' : ''}{ELEMENT_TYPES.find(t => t.id === element.type)?.label}</span>}
      
      <textarea ref={textareaRef} value={element.content} placeholder={isActive ? getPlaceholder(element.type) : ''} onChange={e => canEdit && onUpdate(index, { ...element, content: e.target.value })} onFocus={() => onFocus(index)} onKeyDown={handleKey} onSelect={e => onCursorMove(index, e.target.selectionStart)} style={{ ...getElementStyle(element.type), cursor: canEdit ? 'text' : 'default', opacity: canEdit ? 1 : 0.7, background: isLocked ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }} rows={1} readOnly={!canEdit} />
      
      {/* Character autocomplete */}
      {autoType === 'character' && showAuto && <div style={{ position: 'absolute', top: '100%', left: '37%', background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200 }}>{filtered.map((s, i) => <div key={s} onClick={() => { onSelectCharacter(index, s); setShowAuto(false); }} style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}>{s}</div>)}</div>}
      
      {/* Location autocomplete */}
      {autoType === 'location' && showAuto && <div style={{ position: 'absolute', top: '100%', left: 0, background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 250 }}>{filtered.map((s, i) => <div key={s} onClick={() => { onSelectLocation(index, s); setShowAuto(false); }} style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}>{s}</div>)}</div>}
    </div>
  );
});

// ============ USER AVATAR ============
// ============ LOGO ============
const Logo = ({ darkMode, large = false }) => {
  const color = darkMode ? '#ffffff' : '#1a1a1a';
  const bg = darkMode ? '#1f2937' : '#ffffff';
  const h = large ? 50 : 26;
  const scale = large ? 1 : 0.52;
  
  return (
    <svg width={180 * scale} height={h} viewBox="0 0 180 50" style={{ display: 'block' }}>
      <defs>
        <clipPath id="clipFirst">
          <rect x="0" y="0" width="68" height="50"/>
        </clipPath>
        <clipPath id="clipSecond">
          <rect x="68" y="0" width="50" height="50"/>
        </clipPath>
      </defs>
      
      {/* R - serif style */}
      <text x="0" y="40" fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif" fontSize="44" fontWeight="400" fill={color}>R</text>
      
      {/* Interlocking OO */}
      <g>
        {/* Background O (second one, behind) */}
        <ellipse cx="82" cy="25" rx="16" ry="20" fill="none" stroke={color} strokeWidth="4"/>
        {/* Masking rectangle to hide part of second O */}
        <rect x="62" y="5" width="10" height="40" fill={bg}/>
        {/* Front O (first one) */}
        <ellipse cx="62" cy="25" rx="16" ry="20" fill="none" stroke={color} strokeWidth="4"/>
        {/* Redraw visible part of second O in front */}
        <path d="M 72 6 A 16 20 0 0 1 72 44" fill="none" stroke={color} strokeWidth="4"/>
      </g>
      
      {/* M - serif style */}
      <text x="100" y="40" fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif" fontSize="44" fontWeight="400" fill={color}>M</text>
      
      {/* S - serif style */}
      <text x="147" y="40" fontFamily="'Playfair Display', Georgia, 'Times New Roman', serif" fontSize="44" fontWeight="400" fill={color}>S</text>
    </svg>
  );
};

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
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [lockedScenes, setLockedScenes] = useState(new Set()); // Set of scene element IDs
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRenameChar, setShowRenameChar] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
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
    return currentSceneId && lockedScenes.has(currentSceneId);
  }, [elements, lockedScenes]);
  const commentCounts = useMemo(() => { const counts = {}; comments.filter(c => !c.resolved).forEach(c => { counts[c.elementId] = (counts[c.elementId] || 0) + 1; }); return counts; }, [comments]);
  const totalComments = comments.filter(c => !c.resolved).length;

  // Stats calculation
  const stats = useMemo(() => {
    const allText = elements.map(el => el.content).join(' ');
    const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
    const chars = allText.length;
    const scenes = elements.filter(el => el.type === 'scene').length;
    return { words, chars, scenes };
  }, [elements]);

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
    
    // Second pass: calculate word count for each scene
    elements.forEach((el, idx) => {
      if (el.type === 'scene') {
        sceneNumber++;
        const sceneIdx = sceneIndices.indexOf(idx);
        const nextSceneIdx = sceneIndices[sceneIdx + 1] || elements.length;
        
        // Count words in this scene's content
        let wordCount = 0;
        for (let i = idx; i < nextSceneIdx; i++) {
          const content = elements[i]?.content || '';
          wordCount += content.trim().split(/\s+/).filter(w => w).length;
        }
        
        scenes.push({
          index: idx,
          number: sceneNumber,
          content: el.content || '(sans titre)',
          id: el.id,
          wordCount
        });
      }
    });
    return scenes;
  }, [elements]);

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

  // Create snapshot manually
  const createSnapshot = async () => {
    if (!token || !docId) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title, elements })
      });
      if (res.ok) {
        console.log('[SNAPSHOT] Created');
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
      setShowViewMenu(false);
      setShowToolsMenu(false);
      setShowDocMenu(false);
      setShowImportExport(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
      // Escape = Close panels (one at a time)
      if (e.key === 'Escape') {
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
  }, [showSearch, showOutline, showNoteFor, showCharactersPanel, showShortcuts, showRenameChar, token, docId, title, elements, activeIndex]);

  const emitTitle = useCallback(t => { setTitle(t); if (socketRef.current && connected && canEdit) socketRef.current.emit('title-change', { title: t }); }, [connected, canEdit]);
  const updateElement = useCallback((i, el) => { setElements(p => { const u = [...p]; u[i] = el; return u; }); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-change', { index: i, element: el }); }, [connected, canEdit]);
  const insertElement = useCallback((after, type) => { const el = { id: generateId(), type, content: '' }; setElements(p => { const u = [...p]; u.splice(after + 1, 0, el); return u; }); setActiveIndex(after + 1); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-insert', { afterIndex: after, element: el }); }, [connected, canEdit]);
  const deleteElement = useCallback(i => { if (elements.length === 1) return; setElements(p => p.filter((_, idx) => idx !== i)); setActiveIndex(Math.max(0, i - 1)); if (socketRef.current && connected && canEdit) socketRef.current.emit('element-delete', { index: i }); }, [elements.length, connected, canEdit]);
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

  const copyLink = () => { navigator.clipboard.writeText(window.location.origin + '/#' + docId); alert('Lien copié !'); };

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#111827' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#111827', transition: 'background 0.3s, color 0.3s' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={createNewDocument} onClose={() => setShowDocsList(false)} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} />}
      
      {/* Search Panel */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 70, left: showOutline ? 'calc(50% + 140px)' : '50%', transform: 'translateX(-50%)', background: darkMode ? '#1f2937' : 'white', borderRadius: 8, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', gap: 8, alignItems: 'center', transition: 'left 0.2s ease' }}>
          <input 
            autoFocus
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Rechercher..." 
            style={{ padding: '8px 12px', background: darkMode ? '#374151' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 200 }}
            onKeyDown={e => { if (e.key === 'Enter') goToSearchResult(1); }}
          />
          <input 
            value={replaceQuery} 
            onChange={e => setReplaceQuery(e.target.value)} 
            placeholder="Remplacer..." 
            style={{ padding: '8px 12px', background: darkMode ? '#374151' : '#f3f4f6', border: 'none', borderRadius: 6, color: darkMode ? 'white' : 'black', fontSize: 14, width: 150 }}
          />
          <span style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12, minWidth: 50 }}>
            {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
          </span>
          <button onClick={() => goToSearchResult(-1)} style={{ padding: '6px 10px', background: darkMode ? '#374151' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▲</button>
          <button onClick={() => goToSearchResult(1)} style={{ padding: '6px 10px', background: darkMode ? '#374151' : '#e5e7eb', border: 'none', borderRadius: 4, color: darkMode ? 'white' : 'black', cursor: 'pointer' }}>▼</button>
          <button onClick={replaceOne} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Remplacer</button>
          <button onClick={replaceAll} disabled={searchResults.length === 0} style={{ padding: '6px 10px', background: '#7c3aed', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 12 }}>Tout</button>
          <button onClick={() => setShowSearch(false)} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Outline Panel */}
      {showOutline && (
        <div style={{ 
          position: 'fixed', 
          left: 0, 
          top: 60, 
          bottom: 0, 
          width: 280, 
          background: darkMode ? '#1f2937' : 'white', 
          borderRight: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, 
          zIndex: 100, 
          display: 'flex', 
          flexDirection: 'column',
          boxShadow: '4px 0 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black' }}>📋 Outline</h3>
            <button onClick={() => setShowOutline(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {outline.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucune scène</p>
            ) : (
              outline.map(scene => (
                <div
                  key={scene.id}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: currentSceneNumber === scene.number ? (darkMode ? '#374151' : '#e5e7eb') : 'transparent',
                    borderRadius: 6,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                  }}
                >
                  <button
                    onClick={() => navigateToScene(scene.index)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      color: darkMode ? 'white' : 'black',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8
                    }}
                  >
                    <span style={{ 
                      color: '#6b7280', 
                      fontSize: 10, 
                      fontWeight: 'bold',
                      minWidth: 22,
                      padding: '2px 4px',
                      background: darkMode ? '#4b5563' : '#d1d5db',
                      borderRadius: 4,
                      textAlign: 'center'
                    }}>
                      {scene.number}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        fontSize: 11, 
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {scene.content}
                      </span>
                      <span style={{ fontSize: 10, color: '#6b7280', display: 'block', marginTop: 2 }}>
                        {scene.wordCount} mots
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLockedScenes(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(scene.id)) {
                          newSet.delete(scene.id);
                        } else {
                          newSet.add(scene.id);
                        }
                        return newSet;
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: lockedScenes.has(scene.id) ? '#f59e0b' : '#6b7280',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '2px 4px',
                      opacity: lockedScenes.has(scene.id) ? 1 : 0.5
                    }}
                    title={lockedScenes.has(scene.id) ? 'Déverrouiller la scène' : 'Verrouiller la scène'}
                  >
                    {lockedScenes.has(scene.id) ? '🔒' : '🔓'}
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            {outline.length} scène{outline.length > 1 ? 's' : ''} • Position: {currentSceneNumber}/{outline.length}
          </div>
        </div>
      )}
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, background: darkMode ? '#1f2937' : 'white', borderBottom: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo darkMode={darkMode} />
          <div style={{ width: 1, height: 24, background: darkMode ? '#374151' : '#d1d5db' }} />
          <input value={title} onChange={e => emitTitle(e.target.value)} disabled={!canEdit} style={{ background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', fontSize: 16, fontWeight: 'bold', outline: 'none', maxWidth: 250 }} />
          <span style={{ color: '#6b7280', fontSize: 12 }}>{totalPages}p • {stats.scenes}sc • {stats.words}m</span>
          <span style={{ fontSize: 10, color: connected ? '#10b981' : '#ef4444' }}>{connected ? '●' : '○'}</span>
          {!canEdit && <span style={{ fontSize: 11, background: '#f59e0b', color: 'black', padding: '2px 6px', borderRadius: 4 }}>Lecture</span>}
          {(loading || importing) && <span style={{ fontSize: 11, color: '#60a5fa' }}>...</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: -8, marginRight: 4 }}>
            {users.slice(0, 5).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -8 : 0 }}><UserAvatar user={u} isYou={u.id === myId} /></div>)}
            {users.length > 5 && <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 4 }}>+{users.length - 5}</span>}
            {docId && (
              <button 
                onClick={copyLink} 
                style={{ 
                  marginLeft: 4, 
                  width: 28, 
                  height: 28, 
                  borderRadius: '50%', 
                  border: `2px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                  background: 'transparent', 
                  color: '#9ca3af', 
                  cursor: 'pointer', 
                  fontSize: 16, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }} 
                title="Inviter un collaborateur (copier le lien)"
              >+</button>
            )}
          </div>
          
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{currentUser.name}</span>
              <button onClick={handleLogout} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>Connexion</button>
          )}
          
          {token && <button onClick={() => setShowDocsList(true)} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }} title="Mes documents">📁</button>}
          
          {!docId ? (
            <button onClick={createNewDocument} style={{ padding: '5px 12px', background: '#059669', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>+ Nouveau</button>
          ) : (
            <>
              {/* VIEW MENU */}
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowViewMenu(!showViewMenu); setShowToolsMenu(false); setShowDocMenu(false); setShowImportExport(false); }} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: (showOutline || showCharactersPanel || showSceneNumbers) ? (darkMode ? '#374151' : '#e5e7eb') : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                  Affichage ▾
                </button>
                {showViewMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 180, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { setShowOutline(!showOutline); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showOutline ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📋 Outline</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘O</span>
                    </button>
                    <button onClick={() => { setShowCharactersPanel(!showCharactersPanel); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showCharactersPanel ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      👥 Personnages
                    </button>
                    <button onClick={() => { setShowSceneNumbers(!showSceneNumbers); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showSceneNumbers ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      # Numéros de scènes
                    </button>
                    <button onClick={() => { setDarkMode(!darkMode); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
                    </button>
                  </div>
                )}
              </div>
              
              {/* TOOLS MENU */}
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); setShowViewMenu(false); setShowDocMenu(false); setShowImportExport(false); }} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: showComments ? (darkMode ? '#374151' : '#e5e7eb') : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12, position: 'relative' }}>
                  Outils ▾ {totalComments > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#f59e0b', color: 'black', fontSize: 9, padding: '1px 4px', borderRadius: 8 }}>{totalComments}</span>}
                </button>
                {showToolsMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 200, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { setShowSearch(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🔍 Rechercher</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘F</span>
                    </button>
                    <button onClick={() => { setShowNoteFor(elements[activeIndex]?.id); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📝 Ajouter note</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘N</span>
                    </button>
                    <button onClick={() => { setShowRenameChar(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      ✏️ Renommer personnage
                    </button>
                    <button onClick={() => { setShowComments(!showComments); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showComments ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>💬 Commentaires</span>{totalComments > 0 && <span style={{ background: '#f59e0b', color: 'black', fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>{totalComments}</span>}
                    </button>
                    <button onClick={() => { setShowShortcuts(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>⌨️ Raccourcis</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘?</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* DOCUMENT MENU - only for logged in users */}
              {token && (
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowDocMenu(!showDocMenu); setShowViewMenu(false); setShowToolsMenu(false); setShowImportExport(false); }} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}>
                  Document ▾
                </button>
                {showDocMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 180, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { createSnapshot(); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>💾 Snapshot</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘S</span>
                    </button>
                    <button onClick={() => { setShowHistory(true); setShowDocMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📜 Historique
                    </button>
                  </div>
                )}
              </div>
              )}
              
              {/* IMPORT/EXPORT MENU */}
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowImportExport(!showImportExport); setShowViewMenu(false); setShowToolsMenu(false); setShowDocMenu(false); }} style={{ padding: '5px 10px', background: '#2563eb', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontSize: 12 }}>
                  Import/Export ▾
                </button>
                {showImportExport && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { importFDX(); setShowImportExport(false); }} disabled={importing || !token} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: !token ? '#6b7280' : (darkMode ? 'white' : 'black'), cursor: !token ? 'default' : 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📥 Importer FDX
                    </button>
                    <button onClick={() => { exportFDX(); setShowImportExport(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📤 Exporter FDX
                    </button>
                    <button onClick={() => { exportFountain(); setShowImportExport(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📝 Exporter Fountain
                    </button>
                    <button onClick={() => { exportPDF(); setShowImportExport(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📄 Exporter PDF
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 20, marginLeft: showOutline ? 280 : 0, transition: 'margin-left 0.2s ease' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {pages.map((page) => (
            <div key={page.number} style={{ position: 'relative' }}>
              {/* Page content */}
              <div style={{ 
                background: 'white', 
                color: '#111', 
                width: '210mm', 
                minHeight: '297mm',
                padding: '20mm 25mm 25mm 38mm', 
                boxSizing: 'border-box', 
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                flexShrink: 0,
                position: 'relative'
              }}>
                {/* Page number inside, top right */}
                <div style={{ 
                  position: 'absolute', 
                  top: '12mm', 
                  right: '25mm', 
                  fontSize: '12pt', 
                  fontFamily: 'Courier Prime, Courier New, monospace',
                  color: '#111'
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
                      onFocus={setActiveIndex} 
                      onKeyDown={handleKeyDown} 
                      characters={extractedCharacters}
                      locations={extractedLocations}
                      onSelectCharacter={handleSelectChar}
                      onSelectLocation={handleSelectLocation}
                      remoteCursors={remoteCursors} 
                      onCursorMove={handleCursor} 
                      commentCount={commentCounts[element.id] || 0} 
                      canEdit={canEdit && !isElementLocked(index)}
                      isLocked={isElementLocked(index)}
                      sceneNumber={sceneNumbersMap[element.id]}
                      showSceneNumbers={showSceneNumbers}
                      note={notes[element.id]}
                      onNoteClick={(id) => setShowNoteFor(id)}
                      onOpenComments={() => setShowComments(true)}
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
            onClose={() => setShowComments(false)}
          />
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
      
      {/* Note Editor Modal */}
      {showNoteFor && (
        <NoteEditorModal
          elementId={showNoteFor}
          note={notes[showNoteFor]}
          onSave={updateNote}
          onPushToComment={pushNoteToComment}
          onClose={() => setShowNoteFor(null)}
          darkMode={darkMode}
          canPush={!!token && !!docId && canComment}
        />
      )}
      
      {/* Shortcuts Panel */}
      {showShortcuts && (
        <ShortcutsPanel
          onClose={() => setShowShortcuts(false)}
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
    </div>
  );
}
