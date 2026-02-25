import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../constants/config';

export default function useSocketConnection({
  docId, token,
  socketRef, offlineDocIdRef,
  setConnected, setMyId, setMyRole, setUsers,
  setElements, setTitle, setComments, setSuggestions, setCollaborators,
  setChatMessages, setUnreadMessages,
  playChatNotification
}) {
  useEffect(() => {
    if (docId === 'local') return; // Don't connect socket in local mode
    let isStale = false; // Guard against stale updates after cleanup

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;

    socket.on('connect', () => { if (isStale) return; setConnected(true); setMyId(socket.id); if (docId && docId !== 'local') socket.emit('join-document', { docId }); });
    socket.on('disconnect', () => { if (isStale) return; setConnected(false); });
    socket.on('document-state', data => {
      if (isStale) return;
      setUsers(data.users || []);
      if (data.role) setMyRole(data.role);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (data.collaborators && data.collaborators.length > 0) {
        setCollaborators(data.collaborators);
      }
      // Always sync comments and suggestions regardless of offline mode
      if (data.comments) setComments(data.comments);
      // Re-sync document content on reconnect (only if NOT in offline mode)
      if (!offlineDocIdRef.current && data.elements) {
        setElements(data.elements);
        if (data.title) setTitle(data.title);
        console.log('[SYNC] Document re-synced from server on reconnect');
      }
    });
    // Listen for full-sync from other clients (undo/redo/drag)
    socket.on('full-sync-applied', ({ elements: newElements }) => {
      if (!isStale && !offlineDocIdRef.current) {
        setElements(newElements);
        console.log('[SYNC] Full sync received from another client');
      }
    });
    socket.on('title-updated', ({ title }) => { if (!isStale) setTitle(title); });
    socket.on('element-updated', ({ index, element }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // Match by element ID first (reliable), fallback to index
        const matchIdx = element?.id ? u.findIndex(el => el.id === element.id) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = element;
        return u;
      });
    });
    socket.on('element-type-updated', ({ index, type, elementId }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // ID-based matching first, fallback to index
        const matchIdx = elementId ? u.findIndex(el => el.id === elementId) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = { ...u[targetIdx], type };
        return u;
      });
    });
    socket.on('element-inserted', ({ afterIndex, afterElementId, element }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        // ID-based positioning first, fallback to index
        const matchIdx = afterElementId ? u.findIndex(el => el.id === afterElementId) : -1;
        const insertAfter = matchIdx >= 0 ? matchIdx : afterIndex;
        u.splice(insertAfter + 1, 0, element);
        return u;
      });
    });
    socket.on('element-deleted', ({ index, elementId }) => {
      if (isStale) return;
      setElements(p => {
        // ID-based delete first, fallback to index
        if (elementId) return p.filter(el => el.id !== elementId);
        return p.filter((_, i) => i !== index);
      });
    });
    socket.on('user-joined', ({ users }) => { if (!isStale) setUsers(users); });
    socket.on('user-left', ({ users }) => { if (!isStale) setUsers(users); });
    socket.on('cursor-updated', ({ userId, cursor }) => { if (!isStale) setUsers(p => p.map(u => u.id === userId ? { ...u, cursor } : u)); });
    socket.on('document-restored', ({ title, elements }) => { if (!isStale) { setTitle(title); setElements(elements); } });
    socket.on('comment-added', ({ comment }) => { if (!isStale) setComments(p => [...p, comment]); });
    socket.on('comment-reply-added', ({ commentId, reply }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, replies: [...(c.replies || []), reply] } : c)); });
    socket.on('comment-resolved', ({ commentId, resolved }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, resolved } : c)); });
    socket.on('comment-deleted', ({ commentId }) => { if (!isStale) setComments(p => p.filter(c => c.id !== commentId && c._id !== commentId)); });
    socket.on('comment-updated', ({ commentId, content }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, content } : c)); });

    // Suggestion socket listeners
    socket.on('suggestion-added', ({ suggestion }) => { if (!isStale) setSuggestions(p => [...p, suggestion]); });
    socket.on('suggestion-accepted', ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); });
    socket.on('suggestion-rejected', ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); });

    // Chat messages
    socket.on('chat-message', (message) => {
      if (isStale) return;
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
    socket.on('chat-history', (messages) => { if (!isStale) setChatMessages(messages); });

    return () => { isStale = true; socket.disconnect(); };
  }, [docId, token, playChatNotification]); // eslint-disable-line react-hooks/exhaustive-deps
}
