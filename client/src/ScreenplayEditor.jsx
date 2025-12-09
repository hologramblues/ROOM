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
const LINES_PER_PAGE = 55;

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#1f2937', borderRadius: 8, padding: 24, width: '100%', maxWidth: 400 }}>
        <h2 style={{ color: 'white', fontSize: 20, marginBottom: 16 }}>{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && <input type="text" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, background: '#374151', border: 'none', borderRadius: 4, color: 'white' }} required />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, background: '#374151', border: 'none', borderRadius: 4, color: 'white' }} required />
          <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, background: '#374151', border: 'none', borderRadius: 4, color: 'white' }} required />
          {error && <p style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 10, background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer' }}>{loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        </form>
        <p style={{ marginTop: 16, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          {mode === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginLeft: 8, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}>{mode === 'login' ? "S'inscrire" : 'Se connecter'}</button>
        </p>
        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 10, background: 'transparent', border: '1px solid #4b5563', borderRadius: 4, color: '#9ca3af', cursor: 'pointer' }}>Continuer sans compte</button>
      </div>
    </div>
  );
};

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

const SceneLine = ({ element, index, isActive, onUpdate, onFocus, onKeyDown, characters, onSelectCharacter, remoteCursors, onCursorMove }) => {
  const ref = useRef(null);
  const [showAuto, setShowAuto] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const usersOnLine = remoteCursors.filter(u => u.cursor?.index === index);

  useEffect(() => { if (isActive && ref.current) ref.current.focus(); }, [isActive]);
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px'; } }, [element.content]);
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
      {usersOnLine.map(u => <div key={u.id} style={{ position: 'absolute', left: -12, top: 0, width: 4, height: '100%', background: u.color, borderRadius: 2 }}><div style={{ position: 'absolute', left: 8, top: -2, background: u.color, color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>{u.name}</div></div>)}
      {isActive && <span style={{ position: 'absolute', left: -100, top: 0, fontSize: 10, color: '#888', width: 90, textAlign: 'right', lineHeight: '1.2' }}>{ELEMENT_TYPES.find(t => t.id === element.type)?.label}</span>}
      <textarea ref={ref} value={element.content} placeholder={isActive ? getPlaceholder(element.type) : ''} onChange={e => onUpdate(index, { ...element, content: e.target.value })} onFocus={() => onFocus(index)} onKeyDown={handleKey} onSelect={e => onCursorMove(index, e.target.selectionStart)} style={getElementStyle(element.type)} rows={1} />
      {element.type === 'character' && showAuto && <div style={{ position: 'absolute', top: '100%', left: '37%', background: '#2d2d2d', border: '1px solid #444', borderRadius: 4, maxHeight: 150, overflowY: 'auto', zIndex: 1000, minWidth: 200 }}>{filtered.map((s, i) => <div key={s} onClick={() => { onSelectCharacter(index, s); setShowAuto(false); }} style={{ padding: '8px 12px', cursor: 'pointer', background: i === autoIdx ? '#4a4a4a' : 'transparent', color: '#e0e0e0', fontFamily: 'Courier Prime, monospace', fontSize: '12pt' }}>{s}</div>)}</div>}
    </div>
  );
};

const PageBreak = ({ pageNumber }) => <div style={{ position: 'relative', borderTop: '1px dashed #ccc', marginTop: 20, marginBottom: 20 }}><span style={{ position: 'absolute', right: -60, top: -10, background: '#f5f5f5', padding: '2px 8px', fontSize: 10, color: '#666' }}>{pageNumber}</span></div>;

const UserAvatar = ({ user, isYou }) => <div style={{ width: 28, height: 28, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: 'white', border: isYou ? '2px solid white' : 'none' }} title={user.name}>{user.name.charAt(0).toUpperCase()}</div>;

export default function ScreenplayEditor() {
const getDocId = () => { const hash = window.location.hash; return hash.startsWith('#') ? hash.slice(1) : null; };
  const [docId, setDocId] = useState(getDocId);
useEffect(() => {
  const handleHash = () => setDocId(window.location.hash.slice(1) || null);
  window.addEventListener('hashchange', handleHash);
  return () => window.removeEventListener('hashchange', handleHash);
}, []);
  const [title, setTitle] = useState('SANS TITRE');
  const [elements, setElements] = useState([{ id: crypto.randomUUID(), type: 'scene', content: '' }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myRole, setMyRole] = useState('viewer');
  const [currentUser, setCurrentUser] = useState(() => { const s = localStorage.getItem('screenplay-user'); return s ? JSON.parse(s) : null; });
  const [token, setToken] = useState(() => localStorage.getItem('screenplay-token'));
  const [showAuthModal, setShowAuthModal] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setMyId(socket.id); if (docId) socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('document-state', data => { setTitle(data.title); setElements(data.elements); setCharacters(data.characters || []); setUsers(data.users || []); setMyRole(data.role || 'viewer'); });
    socket.on('title-updated', ({ title }) => setTitle(title));
    socket.on('element-updated', ({ index, element }) => setElements(p => { const u = [...p]; if (index >= 0 && index < u.length) u[index] = element; return u; }));
    socket.on('element-type-updated', ({ index, type }) => setElements(p => { const u = [...p]; if (index >= 0 && index < u.length) u[index] = { ...u[index], type }; return u; }));
    socket.on('element-inserted', ({ afterIndex, element }) => setElements(p => { const u = [...p]; u.splice(afterIndex + 1, 0, element); return u; }));
    socket.on('element-deleted', ({ index }) => setElements(p => p.filter((_, i) => i !== index)));
    socket.on('user-joined', ({ users }) => setUsers(users));
    socket.on('user-left', ({ users }) => setUsers(users));
    socket.on('cursor-updated', ({ userId, cursor }) => setUsers(p => p.map(u => u.id === userId ? { ...u, cursor } : u)));
    socket.on('document-restored', ({ title, elements }) => { setTitle(title); setElements(elements); });
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
      if (socketRef.current) socketRef.current.emit('join-document', { docId: data.id });
    } catch (err) { console.error(err); }
  };

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

  const exportFDX = () => {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FinalDraft DocumentType="Script" Version="3">\n<Content>\n';
    elements.forEach(el => { xml += '<Paragraph Type="' + (TYPE_TO_FDX[el.type] || 'Action') + '"><Text>' + esc(el.content) + '</Text></Paragraph>\n'; });
    xml += '</Content>\n</FinalDraft>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fdx'; a.click();
  };

 const copyLink = () => { navigator.clipboard.writeText(window.location.origin + '/#' + docId); alert('Lien copié !'); };

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#e5e7eb' }}>
      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />}
      <div style={{ position: 'sticky', top: 0, background: '#1f2937', borderBottom: '1px solid #374151', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input value={title} onChange={e => emitTitle(e.target.value)} disabled={!canEdit} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 18, fontWeight: 'bold', outline: 'none' }} />
          <span style={{ color: '#6b7280', fontSize: 14 }}>{totalPages} page{totalPages > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: connected ? '#10b981' : '#ef4444' }}>{connected ? '● En ligne' : '● Hors ligne'}</span>
          {!canEdit && <span style={{ fontSize: 12, color: '#f59e0b' }}>Lecture seule</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>{users.map(u => <UserAvatar key={u.id} user={u} isYou={u.id === myId} />)}</div>
          {currentUser ? <><span style={{ fontSize: 14, color: '#9ca3af' }}>{currentUser.name}</span><button onClick={handleLogout} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Déconnexion</button></> : <button onClick={() => setShowAuthModal(true)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 4, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>Connexion</button>}
          {!docId ? <button onClick={createNewDocument} style={{ padding: '6px 16px', background: '#059669', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer' }}>Nouveau</button> : <button onClick={copyLink} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 4, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>Partager</button>}
          <button onClick={() => setShowHelp(!showHelp)} style={{ padding: '6px 12px', border: '1px solid #4b5563', borderRadius: 4, background: showHelp ? '#374151' : 'transparent', color: '#9ca3af', cursor: 'pointer' }}>?</button>
          <button onClick={exportFDX} style={{ padding: '6px 16px', background: '#2563eb', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer' }}>Exporter FDX</button>
        </div>
      </div>
      {showHelp && <div style={{ background: '#1f2937', borderBottom: '1px solid #374151', padding: '16px 24px', fontSize: 12, color: '#6b7280' }}>Entrée → Nouvelle ligne | Tab → Changer type | ⌘1-6 → Types | ⌘↑/↓ → Navigation</div>}
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: 'white', color: '#111', width: '210mm', minHeight: '297mm', padding: '25mm 25mm 25mm 38mm', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          <div style={{ position: 'relative' }}><span style={{ position: 'absolute', right: -50, top: 0, background: '#f5f5f5', padding: '2px 8px', fontSize: 10, color: '#666' }}>1</span></div>
          {elementsWithBreaks.map((item, idx) => item.type === 'pageBreak' ? <PageBreak key={'b' + idx} pageNumber={item.pageNumber} /> : <SceneLine key={item.element.id} element={item.element} index={item.index} isActive={activeIndex === item.index} onUpdate={updateElement} onFocus={setActiveIndex} onKeyDown={handleKeyDown} characters={extractedCharacters} onSelectCharacter={handleSelectChar} remoteCursors={remoteCursors} onCursorMove={handleCursor} />)}
        </div>
      </div>
    </div>
  );
}
