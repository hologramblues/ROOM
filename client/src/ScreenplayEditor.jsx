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
const InlineComment = React.memo(({ comment, onReply, onResolve, canComment, isReplying, replyContent, onReplyChange, onSubmitReply, onCancelReply, darkMode }) => {
  const replyInputRef = useRef(null);
  useEffect(() => { if (isReplying && replyInputRef.current) replyInputRef.current.focus(); }, [isReplying]);

  return (
    <div style={{ background: darkMode ? '#374151' : '#fef3c7', borderRadius: 6, padding: 10, marginBottom: 8, borderLeft: '3px solid #f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: comment.userColor || '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 9 }}>{comment.userName?.charAt(0).toUpperCase()}</div>
        <span style={{ color: darkMode ? 'white' : '#78350f', fontWeight: 'bold', fontSize: 11 }}>{comment.userName}</span>
        <span style={{ color: '#9ca3af', fontSize: 10 }}>{new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        {comment.resolved && <span style={{ fontSize: 9, background: '#10b981', color: 'white', padding: '1px 4px', borderRadius: 3 }}>Résolu</span>}
      </div>
      <p style={{ color: darkMode ? '#e5e7eb' : '#78350f', margin: '0 0 6px 0', fontSize: 12, lineHeight: 1.4 }}>{comment.content}</p>
      {comment.replies?.map(reply => (
        <div key={reply.id} style={{ marginLeft: 12, paddingLeft: 8, borderLeft: `2px solid ${darkMode ? '#4b5563' : '#fbbf24'}`, marginTop: 6 }}>
          <span style={{ color: darkMode ? '#9ca3af' : '#92400e', fontWeight: 'bold', fontSize: 10 }}>{reply.userName}</span>
          <p style={{ color: darkMode ? '#d1d5db' : '#78350f', margin: '2px 0 0 0', fontSize: 11 }}>{reply.content}</p>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {canComment && <button onClick={() => onReply(comment.id)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 10, padding: 0 }}>Répondre</button>}
        {canComment && <button onClick={() => onResolve(comment.id)} style={{ background: 'none', border: 'none', color: comment.resolved ? '#10b981' : '#6b7280', cursor: 'pointer', fontSize: 10, padding: 0 }}>{comment.resolved ? 'Rouvrir' : 'Résoudre'}</button>}
      </div>
      {isReplying && (
        <div style={{ marginTop: 8 }}>
          <textarea ref={replyInputRef} value={replyContent} onChange={e => onReplyChange(e.target.value)} placeholder="Réponse..." style={{ width: '100%', padding: 6, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#4b5563' : '#fbbf24'}`, borderRadius: 4, color: darkMode ? 'white' : '#78350f', fontSize: 11, resize: 'none', boxSizing: 'border-box' }} rows={2} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={() => onSubmitReply(comment.id)} style={{ padding: '4px 8px', background: '#f59e0b', border: 'none', borderRadius: 3, color: 'white', cursor: 'pointer', fontSize: 10 }}>Envoyer</button>
            <button onClick={onCancelReply} style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#fbbf24'}`, borderRadius: 3, color: darkMode ? '#9ca3af' : '#92400e', cursor: 'pointer', fontSize: 10 }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============ COMMENTS SIDEBAR (scrolls with content) ============
const CommentsSidebar = ({ comments, elements, activeIndex, selectedCommentIndex, elementPositions, scrollTop, token, docId, canComment, onClose, darkMode, onNavigateToElement, onAddComment }) => {
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [newCommentFor, setNewCommentFor] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const sidebarRef = useRef(null);
  const commentRefs = useRef({});

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

  // Get sorted element indices that have comments
  const sortedIndices = useMemo(() => {
    return Object.keys(commentsByElementIndex).map(Number).sort((a, b) => a - b);
  }, [commentsByElementIndex]);

  const unresolvedComments = comments.filter(c => !c.resolved);
  
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
  
  // Track if we just selected a comment (to do one-time scroll)
  const hasScrolledToSelectedRef = useRef(true);
  const prevSelectedRef = useRef(null);
  
  // Scroll to selected comment when clicking the badge (one-time)
  useEffect(() => {
    if (selectedCommentIndex !== null && selectedCommentIndex !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedCommentIndex;
      
      if (adjustedPositions[selectedCommentIndex] !== undefined && sidebarRef.current) {
        hasScrolledToSelectedRef.current = false;
        const targetPosition = adjustedPositions[selectedCommentIndex];
        sidebarRef.current.scrollTo({
          top: Math.max(0, targetPosition - 50),
          behavior: 'smooth'
        });
        // Allow normal sync to resume after a short delay
        setTimeout(() => {
          hasScrolledToSelectedRef.current = true;
        }, 500);
      }
      // If no position found, don't block scroll sync
    } else if (selectedCommentIndex === null) {
      prevSelectedRef.current = null;
      hasScrolledToSelectedRef.current = true;
    }
  }, [selectedCommentIndex, adjustedPositions]);

  // Sync sidebar scroll with main document scroll
  useEffect(() => {
    if (sidebarRef.current && hasScrolledToSelectedRef.current) {
      sidebarRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  // Calculate total height - should match document height so sidebar scrolls all the way
  const totalHeight = useMemo(() => {
    // Get the maximum position from all elements (not just commented ones)
    const allPositions = Object.values(elementPositions);
    if (allPositions.length === 0) return 5000;
    // Use the highest element position + extra space for window height
    return Math.max(...allPositions) + 1500;
  }, [elementPositions]);

  // Navigation functions
  const navigateToComment = (direction) => {
    if (sortedIndices.length === 0) return;
    
    // Find current position in sortedIndices based on activeIndex
    const currentPos = sortedIndices.findIndex(idx => idx >= activeIndex);
    let targetPos;
    
    if (direction === 'next') {
      targetPos = currentPos === -1 ? 0 : Math.min(currentPos + 1, sortedIndices.length - 1);
    } else {
      targetPos = currentPos <= 0 ? 0 : currentPos - 1;
    }
    
    const targetIdx = sortedIndices[targetPos];
    if (targetIdx !== undefined && onNavigateToElement) {
      onNavigateToElement(targetIdx);
    }
  };

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
      {/* Header with navigation */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: darkMode ? 'white' : 'black' }}>💬 Commentaires ({unresolvedComments.length})</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Navigation arrows */}
          <button 
            onClick={() => navigateToComment('prev')}
            disabled={sortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
              borderRadius: 4,
              color: sortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#374151'), 
              cursor: sortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title="Commentaire précédent"
          >
            ↑
          </button>
          <button 
            onClick={() => navigateToComment('next')}
            disabled={sortedIndices.length === 0}
            style={{ 
              background: 'none', 
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
              borderRadius: 4,
              color: sortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#374151'), 
              cursor: sortedIndices.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 14, 
              padding: '4px 8px',
              lineHeight: 1
            }}
            title="Commentaire suivant"
          >
            ↓
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 8 }}>✕</button>
        </div>
      </div>
      
      {/* Add comment section - fixed, doesn't scroll */}
      {canComment && activeIndex !== null && elements[activeIndex] && (
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          background: darkMode ? '#2d3748' : '#f9fafb',
          flexShrink: 0
        }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
            Commenter sur : <span style={{ fontStyle: 'italic', color: darkMode ? '#d1d5db' : '#374151' }}>
              "{elements[activeIndex].content.slice(0, 40)}{elements[activeIndex].content.length > 40 ? '...' : ''}"
            </span>
          </div>
          {newCommentFor === 'header' ? (
            <div>
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                style={{
                  width: '100%',
                  padding: 8,
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: 6,
                  fontSize: 12,
                  resize: 'vertical',
                  minHeight: 60,
                  background: darkMode ? '#1f2937' : 'white',
                  color: darkMode ? 'white' : 'black'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    if (newCommentText.trim() && elements[activeIndex]) {
                      submitNewComment(elements[activeIndex].id);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Ajouter
                </button>
                <button
                  onClick={() => { setNewCommentFor(null); setNewCommentText(''); }}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: '#6b7280',
                    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNewCommentFor('header')}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: darkMode ? '#374151' : 'white',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: 6,
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              + Ajouter un commentaire...
            </button>
          )}
        </div>
      )}
      
      {/* Scrollable area - synced with document */}
      <div 
        ref={sidebarRef}
        style={{ 
          flex: 1, 
          overflow: 'auto',
          position: 'relative'
        }}
        onScroll={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Inner container with same height as document */}
        <div style={{ position: 'relative', height: totalHeight, minHeight: '100%' }}>
          {sortedIndices.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 12 }}>Aucun commentaire</p>
          ) : (
            sortedIndices.map((idx, arrayIndex) => {
              const element = elements[idx];
              const elementComments = commentsByElementIndex[idx];
              const isSelected = idx === selectedCommentIndex;
              const isActive = idx === activeIndex || isSelected;
              const topPosition = adjustedPositions[idx] || 0;
              
              return (
                <div 
                  key={idx}
                  ref={(el) => measureCard(idx, el)}
                  style={{ 
                    position: 'absolute',
                    top: topPosition,
                    left: 8,
                    right: 8,
                    background: isActive ? (darkMode ? '#374151' : '#eff6ff') : (darkMode ? '#2d3748' : '#f9fafb'),
                    borderRadius: 8,
                    padding: 10,
                    border: isActive ? `2px solid ${darkMode ? '#60a5fa' : '#3b82f6'}` : `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {/* Element reference */}
                  <button
                    onClick={() => onNavigateToElement && onNavigateToElement(idx)}
                    style={{ 
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none', 
                      border: 'none', 
                      padding: 0,
                      marginBottom: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 9, color: '#6b7280', display: 'block' }}>
                      {element?.type === 'scene' ? '🎬' : '📝'} Élément {idx + 1}
                    </span>
                    <span style={{ fontSize: 10, color: darkMode ? '#d1d5db' : '#374151', fontStyle: 'italic', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{element?.content.slice(0, 30)}{element?.content.length > 30 ? '...' : ''}"
                    </span>
                  </button>
                  
                  {/* Comments for this element */}
                  {elementComments.map(c => (
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
                      darkMode={darkMode}
                    />
                  ))}
                  
                  {/* Add comment to this element */}
                  {canComment && (
                    newCommentFor === element?.id ? (
                      <div style={{ marginTop: 8, background: darkMode ? '#1f2937' : '#fef3c7', borderRadius: 4, padding: 8 }}>
                        <textarea 
                          autoFocus
                          value={newCommentText} 
                          onChange={e => setNewCommentText(e.target.value)} 
                          placeholder="Votre commentaire..." 
                          style={{ width: '100%', padding: 6, background: darkMode ? '#374151' : 'white', border: `1px solid ${darkMode ? '#4b5563' : '#fbbf24'}`, borderRadius: 4, color: darkMode ? 'white' : '#78350f', fontSize: 11, resize: 'none', boxSizing: 'border-box' }} 
                          rows={2} 
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button onClick={() => submitNewComment(element.id)} style={{ padding: '4px 8px', background: '#f59e0b', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 10 }}>Ajouter</button>
                          <button onClick={() => { setNewCommentFor(null); setNewCommentText(''); }} style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#fbbf24'}`, borderRadius: 4, color: darkMode ? '#9ca3af' : '#92400e', cursor: 'pointer', fontSize: 10 }}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setNewCommentFor(element?.id)} 
                        style={{ marginTop: 6, background: 'transparent', border: 'none', padding: '4px 0', color: '#6b7280', cursor: 'pointer', fontSize: 10, textAlign: 'left' }}
                      >
                        + Répondre
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
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
        background: darkMode ? '#1f2937' : 'white', 
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
          background: darkMode ? '#374151' : '#f3f4f6',
          cursor: 'move',
          userSelect: 'none'
        }}
        onMouseDown={onDragStart}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black' }}>📝 Note personnelle</h3>
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
            border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, 
            borderRadius: 8, 
            color: '#374151', 
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
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 450, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black' }}>📊 Statistiques</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        
        {/* Main stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.words}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Mots</div>
          </div>
          <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.scenes}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Scènes</div>
          </div>
          <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{characters.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Personnages</div>
          </div>
        </div>
        
        {/* Time estimates */}
        <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black' }}>⏱️ Estimations</h4>
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
        <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
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
            <div style={{ marginTop: 10, height: 6, background: darkMode ? '#4b5563' : '#d1d5db', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(locations.INT / (locations.INT + locations.EXT)) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
            </div>
          )}
        </div>
        
        {/* Top characters */}
        {characters.length > 0 && (
          <div style={{ background: darkMode ? '#374151' : '#f3f4f6', padding: 16, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black' }}>👥 Top personnages</h4>
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
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 300, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: darkMode ? 'white' : 'black' }}>🎬 Aller à la scène</h3>
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
            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, background: darkMode ? '#374151' : 'white', color: darkMode ? 'white' : 'black', fontSize: 16 }}
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
      <div style={{ background: darkMode ? '#1f2937' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black' }}>🎯 Objectif d'écriture</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: darkMode ? 'white' : 'black' }}>Aujourd'hui</span>
            <span style={{ fontSize: 14, color: progress >= 100 ? '#22c55e' : '#6b7280' }}>{goal.todayWords} / {goal.daily} mots</span>
          </div>
          <div style={{ height: 8, background: darkMode ? '#374151' : '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
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
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, background: darkMode ? '#374151' : 'white', color: darkMode ? 'white' : 'black', fontSize: 14 }}
          />
        </div>

        {/* Quick presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[500, 1000, 1500, 2000].map(preset => (
            <button
              key={preset}
              onClick={() => setDailyGoal(preset)}
              style={{ flex: 1, padding: '8px', background: dailyGoal == preset ? '#3b82f6' : (darkMode ? '#374151' : '#f3f4f6'), border: 'none', borderRadius: 6, color: dailyGoal == preset ? 'white' : (darkMode ? 'white' : 'black'), cursor: 'pointer', fontSize: 12 }}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
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
      
      {/* Comment indicator - yellow square (clickable to open comments) */}
      {commentCount > 0 && (
        <div 
          onClick={onOpenComments}
          style={{ position: 'absolute', right: note ? -80 : -30, top: 2, width: 18, height: 18, background: '#fbbf24', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer', boxShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}
          title="Voir les commentaires"
        >💬</div>
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
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(null); // Index of element whose comment was clicked
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
  const [focusMode, setFocusMode] = useState(false);
  const [sceneAssignments, setSceneAssignments] = useState({}); // { sceneId: { userId, userName, userColor } }
  const [showTimer, setShowTimer] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState('chrono'); // 'chrono' or 'sprint'
  const [sprintDuration, setSprintDuration] = useState(25 * 60); // 25 minutes default
  const [sprintTimeLeft, setSprintTimeLeft] = useState(25 * 60);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [sessionStartWords, setSessionStartWords] = useState(0);
  const [sceneStatus, setSceneStatus] = useState({}); // { sceneId: 'draft' | 'review' | 'final' }
  const [lastSaved, setLastSaved] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [draggedScene, setDraggedScene] = useState(null);
  const [sceneSynopsis, setSceneSynopsis] = useState({}); // { sceneId: 'synopsis text' }
  const [visibleElementIndex, setVisibleElementIndex] = useState(0); // For scroll sync with comments
  const [elementPositions, setElementPositions] = useState({}); // { elementIndex: topPosition }
  const [documentScrollTop, setDocumentScrollTop] = useState(0);
  const [writingGoal, setWritingGoal] = useState(() => {
    const saved = localStorage.getItem('rooms-writing-goal');
    return saved ? JSON.parse(saved) : { daily: 1000, todayWords: 0, lastDate: null };
  });
  const [showGoToScene, setShowGoToScene] = useState(false);
  const [showWritingGoals, setShowWritingGoals] = useState(false);
  const [editingSynopsis, setEditingSynopsis] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chatPosition, setChatPosition] = useState({ x: window.innerWidth - 340, y: 80 });
  const [notePosition, setNotePosition] = useState({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingNote, setIsDraggingNote] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const socketRef = useRef(null);
  const loadedDocRef = useRef(null);
  const chatEndRef = useRef(null);

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
    
    // Chat messages
    socket.on('chat-message', (message) => {
      setChatMessages(prev => [...prev, message]);
      // Increment unread if chat is closed and message is from someone else
      if (message.senderId !== socket.id) {
        setUnreadMessages(prev => prev + 1);
      }
    });
    socket.on('chat-history', (messages) => setChatMessages(messages));
    
    return () => socket.disconnect();
  }, [docId, token]);

  const handleLogin = (user, newToken) => { setCurrentUser(user); setToken(newToken); setShowAuthModal(false); };
  const handleLogout = () => { localStorage.removeItem('screenplay-token'); localStorage.removeItem('screenplay-user'); setCurrentUser(null); setToken(null); };

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

  // Drag handlers for floating panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingChat) {
        setChatPosition({
          x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
      if (isDraggingNote) {
        setNotePosition({
          x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffsetRef.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffsetRef.current.y))
        });
      }
    };
    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingNote(false);
    };
    if (isDraggingChat || isDraggingNote) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingChat, isDraggingNote]);

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

  // Track element positions and scroll for comments sync (Google Docs style)
  useEffect(() => {
    if (!showComments) return;
    
    // Collect element positions
    const updatePositions = () => {
      const positions = {};
      const elementDivs = document.querySelectorAll('[data-element-index]');
      elementDivs.forEach(div => {
        const index = parseInt(div.getAttribute('data-element-index'), 10);
        if (!isNaN(index)) {
          // Get position relative to document top
          const rect = div.getBoundingClientRect();
          positions[index] = rect.top + window.scrollY - 60; // Adjust for header
        }
      });
      setElementPositions(positions);
    };
    
    // Track scroll position
    const handleScroll = () => {
      setDocumentScrollTop(window.scrollY);
    };
    
    // Initial update
    updatePositions();
    handleScroll();
    
    // Update on scroll and resize
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updatePositions);
    
    // Update positions periodically (elements might change height)
    const positionInterval = setInterval(updatePositions, 1000);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updatePositions);
      clearInterval(positionInterval);
    };
  }, [showComments, elements.length]);

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
      // Escape = Close panels (one at a time)
      if (e.key === 'Escape') {
        if (showGoToScene) { setShowGoToScene(false); return; }
        if (showWritingGoals) { setShowWritingGoals(false); return; }
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
  }, [showSearch, showOutline, showNoteFor, showCharactersPanel, showShortcuts, showRenameChar, showGoToScene, showWritingGoals, token, docId, title, elements, activeIndex, undo, redo]);

  const updateElement = useCallback((i, el, skipUndo = false) => { 
    if (!skipUndo) pushToUndo(elements);
    setElements(p => { const u = [...p]; u[i] = el; return u; }); 
    if (socketRef.current && connected && canEdit) socketRef.current.emit('element-change', { index: i, element: el }); 
    setLastSaved(new Date());
  }, [connected, canEdit, elements, pushToUndo]);
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

  // Duplicate a scene (scene + all elements until next scene)
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
    <div className={focusMode ? 'focus-mode-active' : ''} style={{ minHeight: '100vh', background: darkMode ? '#111827' : '#e5e7eb', color: darkMode ? '#e5e7eb' : '#111827', transition: 'background 0.3s, color 0.3s' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />}
      {showDocsList && token && <DocumentsList token={token} onSelectDoc={selectDocument} onCreateDoc={createNewDocument} onClose={() => setShowDocsList(false)} />}
      {showHistory && token && docId && <HistoryPanel docId={docId} token={token} currentTitle={title} onRestore={() => { loadedDocRef.current = null; window.location.reload(); }} onClose={() => setShowHistory(false)} />}
      
      {/* Search Panel */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 70, left: showOutline ? 'calc(50% + 150px)' : '50%', transform: 'translateX(-50%)', background: darkMode ? '#1f2937' : 'white', borderRadius: 8, padding: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', gap: 8, alignItems: 'center', transition: 'left 0.2s ease' }}>
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
          width: 300, 
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
                  onClick={() => navigateToScene(scene.index)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: currentSceneNumber === scene.number 
                      ? (darkMode ? '#374151' : '#e5e7eb') 
                      : 'transparent',
                    borderRadius: 6,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    cursor: 'pointer',
                    borderLeft: sceneStatus[scene.id] ? `3px solid ${
                      sceneStatus[scene.id] === 'final' ? '#22c55e' : 
                      sceneStatus[scene.id] === 'review' ? '#f59e0b' : '#6b7280'
                    }` : '3px solid transparent',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Scene number */}
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: 9, 
                    fontWeight: 'bold',
                    minWidth: 20,
                    padding: '2px 4px',
                    background: darkMode ? '#4b5563' : '#d1d5db',
                    borderRadius: 3,
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    {scene.number}
                  </span>
                  
                  {/* Scene content */}
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ 
                      fontSize: 11, 
                      lineHeight: 1.3,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: darkMode ? 'white' : 'black'
                    }}>
                      {scene.content}
                    </span>
                    <span style={{ fontSize: 9, color: '#6b7280', display: 'block', marginTop: 1 }}>
                      {scene.wordCount}m • ~{Math.max(1, Math.round(scene.wordCount / 150))}min
                    </span>
                  </div>
                  
                  {/* Action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {/* Lock - RED when locked */}
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
                        borderRadius: 4
                      }}
                      title={lockedScenes.has(scene.id) ? 'Déverrouiller' : 'Verrouiller'}
                    >
                      {lockedScenes.has(scene.id) ? '🔒' : '🔓'}
                    </button>
                    {/* Status */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const statuses = ['', 'draft', 'review', 'final'];
                        const currentIdx = statuses.indexOf(sceneStatus[scene.id] || '');
                        setSceneStatus(prev => ({ ...prev, [scene.id]: statuses[(currentIdx + 1) % 4] }));
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '2px', color: sceneStatus[scene.id] === 'final' ? '#22c55e' : sceneStatus[scene.id] === 'review' ? '#f59e0b' : '#6b7280' }}
                      title="Statut"
                    >
                      {sceneStatus[scene.id] === 'final' ? '✓' : sceneStatus[scene.id] === 'review' ? '◐' : '○'}
                    </button>
                    {/* User Assignment */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Cycle through users (including "none")
                        const allUsers = [null, ...users];
                        const currentAssignment = sceneAssignments[scene.id];
                        const currentIdx = currentAssignment 
                          ? allUsers.findIndex(u => u?.id === currentAssignment.userId)
                          : 0;
                        const nextIdx = (currentIdx + 1) % allUsers.length;
                        const nextUser = allUsers[nextIdx];
                        if (nextUser) {
                          setSceneAssignments(prev => ({ 
                            ...prev, 
                            [scene.id]: { 
                              userId: nextUser.id, 
                              userName: nextUser.name, 
                              userColor: nextUser.color 
                            } 
                          }));
                        } else {
                          setSceneAssignments(prev => {
                            const newAssignments = { ...prev };
                            delete newAssignments[scene.id];
                            return newAssignments;
                          });
                        }
                      }}
                      style={{ 
                        width: 16, 
                        height: 16, 
                        borderRadius: '50%', 
                        border: sceneAssignments[scene.id] ? 'none' : `1px dashed #6b7280`, 
                        background: sceneAssignments[scene.id]?.userColor || 'transparent', 
                        cursor: 'pointer', 
                        padding: 0,
                        fontSize: 8,
                        fontWeight: 'bold',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={sceneAssignments[scene.id] ? `Assigné à ${sceneAssignments[scene.id].userName}` : 'Assigner un utilisateur'}
                    >
                      {sceneAssignments[scene.id]?.userName?.charAt(0).toUpperCase() || ''}
                    </button>
                  </div>
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
      <div style={{ position: 'sticky', top: 0, background: darkMode ? '#1f2937' : 'white', borderBottom: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo darkMode={darkMode} />
          <div style={{ width: 1, height: 24, background: darkMode ? '#374151' : '#d1d5db' }} />
          <input value={title} onChange={e => emitTitle(e.target.value)} disabled={!canEdit} style={{ background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', fontSize: 16, fontWeight: 'bold', outline: 'none', maxWidth: 250 }} />
          <span style={{ color: '#6b7280', fontSize: 12 }}>{totalPages}p • {stats.scenes}sc • {stats.words}m</span>
          <span style={{ fontSize: 10, color: connected ? '#10b981' : '#ef4444' }}>{connected ? '●' : '○'}</span>
          {lastSaved && <span style={{ fontSize: 10, color: '#6b7280' }}>✓ {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
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
            {/* Chat button */}
            {docId && (
              <button
                onClick={() => setShowChat(!showChat)}
                style={{
                  marginLeft: 4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: showChat ? '#3b82f6' : (darkMode ? '#374151' : '#e5e7eb'),
                  color: showChat ? 'white' : '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
                title="Chat d'équipe"
              >
                💬
                {unreadMessages > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: '#ef4444',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 'bold',
                    padding: '2px 5px',
                    borderRadius: 10,
                    minWidth: 16,
                    textAlign: 'center'
                  }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </button>
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
                <button onClick={(e) => { e.stopPropagation(); setShowViewMenu(!showViewMenu); setShowToolsMenu(false); setShowDocMenu(false); setShowImportExport(false); }} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: (showOutline || showCharactersPanel || showSceneNumbers || showComments) ? (darkMode ? '#374151' : '#e5e7eb') : 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12, position: 'relative' }}>
                  Affichage ▾ {totalComments > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#f59e0b', color: 'black', fontSize: 9, padding: '1px 4px', borderRadius: 8 }}>{totalComments}</span>}
                </button>
                {showViewMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 180, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { setShowOutline(!showOutline); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showOutline ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📋 Outline</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘O</span>
                    </button>
                    <button onClick={() => { setShowCharactersPanel(!showCharactersPanel); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showCharactersPanel ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      👥 Personnages
                    </button>
                    <button onClick={() => { setShowComments(!showComments); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showComments ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>💬 Commentaires</span>{totalComments > 0 && <span style={{ background: '#f59e0b', color: 'black', fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>{totalComments}</span>}
                    </button>
                    <button onClick={() => { setShowSceneNumbers(!showSceneNumbers); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showSceneNumbers ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      # Numéros de scènes
                    </button>
                    <button onClick={() => { setDarkMode(!darkMode); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
                    </button>
                    <button onClick={() => { setFocusMode(!focusMode); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: focusMode ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      🎯 Mode focus {focusMode && '✓'}
                    </button>
                    <button onClick={() => { setShowGoToScene(true); setShowViewMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎬 Aller à la scène</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘G</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* TOOLS MENU */}
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowToolsMenu(!showToolsMenu); setShowViewMenu(false); setShowDocMenu(false); setShowImportExport(false); }} style={{ padding: '5px 10px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: 6, background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12, position: 'relative' }}>
                  Outils ▾
                </button>
                {showToolsMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 200, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                    <button onClick={() => { setShowSearch(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🔍 Rechercher</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘F</span>
                    </button>
                    <button onClick={() => { setShowNoteFor(elements[activeIndex]?.id); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📝 Ajouter note</span><span style={{ color: '#6b7280', fontSize: 10 }}>⌘N</span>
                    </button>
                    <button onClick={() => { setShowRenameChar(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      ✏️ Renommer personnage
                    </button>
                    <button onClick={() => { setShowTimer(!showTimer); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: showTimer ? (darkMode ? '#374151' : '#f3f4f6') : 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      ⏱️ Timer d'écriture {showTimer && '✓'}
                    </button>
                    <button onClick={() => { setShowStats(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                      📊 Statistiques
                    </button>
                    <button onClick={() => { setShowWritingGoals(true); setShowToolsMenu(false); }} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 12, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎯 Objectif d'écriture</span>
                      <span style={{ fontSize: 10, color: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : '#6b7280' }}>{Math.round((writingGoal.todayWords / writingGoal.daily) * 100)}%</span>
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
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 180, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
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
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: darkMode ? '#1f2937' : 'white', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, borderRadius: 8, overflow: 'hidden', minWidth: 160, zIndex: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
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
      
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 20, marginLeft: showOutline ? 300 : 0, marginRight: showComments ? 320 : 0, transition: 'margin 0.2s ease' }}>
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
                      onOpenComments={() => { setShowComments(true); setSelectedCommentIndex(index); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Comments Panel (fixed position) */}
      {showComments && (
        <CommentsSidebar 
          comments={comments} 
          elements={elements} 
          activeIndex={activeIndex}
          selectedCommentIndex={selectedCommentIndex}
          elementPositions={elementPositions}
          scrollTop={documentScrollTop}
          token={token} 
          docId={docId} 
          canComment={canComment}
          onClose={() => { setShowComments(false); setSelectedCommentIndex(null); }}
          darkMode={darkMode}
          onNavigateToElement={(idx) => {
            setActiveIndex(idx);
            setSelectedCommentIndex(idx);
            setTimeout(() => {
              const el = document.querySelector(`[data-element-index="${idx}"]`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
        />
      )}
      
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
            if (e.target.tagName === 'BUTTON') return;
            setIsDraggingNote(true);
            dragOffsetRef.current = { x: e.clientX - notePosition.x, y: e.clientY - notePosition.y };
          }}
        />
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
      
      {/* Writing Goals Modal */}
      {showWritingGoals && (
        <WritingGoalsModal
          goal={writingGoal}
          onUpdate={setWritingGoal}
          onClose={() => setShowWritingGoals(false)}
          currentWords={stats.words}
          darkMode={darkMode}
        />
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
            background: darkMode ? '#1f2937' : 'white',
            border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
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
              borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'move',
              background: darkMode ? '#374151' : '#f3f4f6',
              borderRadius: '12px 12px 0 0',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              if (e.target.tagName === 'BUTTON') return;
              setIsDraggingChat(true);
              dragOffsetRef.current = { x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y };
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 14, color: darkMode ? 'white' : 'black' }}>💬 Chat</h3>
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
            borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
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
                  background: darkMode ? '#374151' : '#f3f4f6',
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
                    background: msg.senderId === myId ? '#3b82f6' : (darkMode ? '#374151' : '#f3f4f6'),
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
            borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
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
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                background: darkMode ? '#374151' : 'white',
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
                background: chatInput.trim() ? '#3b82f6' : (darkMode ? '#374151' : '#e5e7eb'),
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
      
      {/* Writing Timer Widget */}
      {showTimer && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          background: darkMode ? '#1f2937' : 'white',
          border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 200,
          minWidth: 220
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>⏱️ Timer</span>
            <button onClick={() => setShowTimer(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: darkMode ? '#374151' : '#e5e7eb', borderRadius: 6, padding: 3 }}>
            <button 
              onClick={() => { setTimerMode('chrono'); if (!timerRunning) resetTimer(); }}
              style={{ 
                flex: 1, 
                padding: '6px 10px', 
                background: timerMode === 'chrono' ? (darkMode ? '#1f2937' : 'white') : 'transparent', 
                border: 'none', 
                borderRadius: 4, 
                color: timerMode === 'chrono' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                cursor: 'pointer', 
                fontSize: 11,
                fontWeight: timerMode === 'chrono' ? 600 : 400
              }}
            >
              ⏱️ Chrono
            </button>
            <button 
              onClick={() => { setTimerMode('sprint'); if (!timerRunning) { resetTimer(); setSprintTimeLeft(sprintDuration); } }}
              style={{ 
                flex: 1, 
                padding: '6px 10px', 
                background: timerMode === 'sprint' ? (darkMode ? '#1f2937' : 'white') : 'transparent', 
                border: 'none', 
                borderRadius: 4, 
                color: timerMode === 'sprint' ? (darkMode ? 'white' : 'black') : '#6b7280', 
                cursor: 'pointer', 
                fontSize: 11,
                fontWeight: timerMode === 'sprint' ? 600 : 400
              }}
            >
              🏃 Sprint
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
                    background: sprintDuration === mins * 60 ? '#3b82f6' : (darkMode ? '#374151' : '#e5e7eb'), 
                    border: 'none', 
                    borderRadius: 4, 
                    color: sprintDuration === mins * 60 ? 'white' : (darkMode ? '#d1d5db' : '#374151'), 
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
                fontWeight: 500
              }}
            >
              {timerRunning ? '⏸ Pause' : '▶ Start'}
            </button>
            <button 
              onClick={resetTimer}
              style={{ 
                padding: '8px 12px', 
                background: darkMode ? '#374151' : '#e5e7eb', 
                border: 'none', 
                borderRadius: 6, 
                color: darkMode ? 'white' : 'black', 
                cursor: 'pointer', 
                fontSize: 13 
              }}
            >
              ↺
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: 12, fontSize: 12, color: '#6b7280' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Mots cette session</span>
              <span style={{ color: sessionWordCount > 0 ? '#22c55e' : (darkMode ? 'white' : 'black'), fontWeight: 500 }}>+{sessionWordCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Mots/heure</span>
              <span style={{ color: darkMode ? 'white' : 'black' }}>{timerSeconds > 60 ? Math.round(sessionWordCount / (timerSeconds / 3600)) : '—'}</span>
            </div>
          </div>
        </div>
      )}
      
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
