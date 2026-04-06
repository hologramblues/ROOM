import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../constants/config';

export default function useSocketConnection({
  docId, token,
  socketRef, offlineDocIdRef,
  setConnected, setMyId, setMyRole, setUsers,
  setElements, setTitle, setComments, setSuggestions, setCollaborators,
  setChatMessages, setUnreadMessages,
  playChatNotification,
  serverUrl,
  elementVersionsRef, // Map<elementId, version> for optimistic concurrency
  documentLoadedRef, // Set true once document-state received — gates emissions
  docVersionRef, // Server doc version — for stale full-sync rejection
}) {
  // Stabilize callback ref to avoid reconnecting when callback identity changes
  const playChatNotificationRef = useRef(playChatNotification);
  useEffect(() => { playChatNotificationRef.current = playChatNotification; });

  useEffect(() => {
    if (docId === 'local') return; // Don't connect socket in local mode
    let isStale = false; // Guard against stale updates after cleanup

    const effectiveUrl = serverUrl || SERVER_URL;
    const socket = io(effectiveUrl, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;

    // ============ CONNECTION ============
    const onConnect = () => { if (isStale) return; setConnected(true); setMyId(socket.id); if (docId && docId !== 'local') socket.emit('join-document', { docId }); };
    const onDisconnect = () => { if (isStale) return; setConnected(false); };

    // ============ DOCUMENT STATE ============
    const onDocumentState = (data) => {
      if (isStale) return;
      setUsers(data.users || []);
      if (data.role) setMyRole(data.role);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (data.collaborators && data.collaborators.length > 0) {
        setCollaborators(data.collaborators);
      }
      if (data.comments) setComments(data.comments);
      if (!offlineDocIdRef.current && data.elements) {
        setElements(data.elements);
        if (data.title) setTitle(data.title);
        if (elementVersionsRef) {
          const vMap = new Map();
          data.elements.forEach(el => vMap.set(el.id, el.v || 0));
          elementVersionsRef.current = vMap;
        }
        // Mark document as loaded — emissions are now safe
        if (documentLoadedRef) documentLoadedRef.current = true;
        if (docVersionRef && data.docVersion != null) docVersionRef.current = data.docVersion;
        console.log('[SYNC] Document re-synced from server v' + (data.docVersion || 0));
      }
    };

    // ============ FULL SYNC ============
    const onFullSyncApplied = ({ elements: newElements, docVersion }) => {
      if (!isStale && !offlineDocIdRef.current) {
        setElements(newElements);
        if (elementVersionsRef) {
          const vMap = new Map();
          newElements.forEach(el => vMap.set(el.id, el.v || 0));
          elementVersionsRef.current = vMap;
        }
        if (docVersionRef && docVersion != null) docVersionRef.current = docVersion;
        console.log('[SYNC] Full sync received v' + (docVersion || '?'));
      }
    };

    // ============ ELEMENT UPDATES ============
    const onTitleUpdated = ({ title }) => { if (!isStale) setTitle(title); };

    const onElementUpdated = ({ index, element }) => {
      if (isStale) return;
      if (elementVersionsRef && element?.id) {
        elementVersionsRef.current.set(element.id, element.v || 0);
      }
      setElements(p => {
        const u = [...p];
        const matchIdx = element?.id ? u.findIndex(el => el.id === element.id) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = element;
        return u;
      });
    };

    const onElementConflict = ({ elementId, serverElement }) => {
      if (isStale) return;
      console.warn('[CONFLICT] Element', elementId, '— accepting server version');
      if (elementVersionsRef && serverElement) {
        elementVersionsRef.current.set(elementId, serverElement.v || 0);
      }
      setElements(p => {
        const u = [...p];
        const idx = u.findIndex(el => el.id === elementId);
        if (idx >= 0) u[idx] = serverElement;
        return u;
      });
    };

    const onElementTypeUpdated = ({ index, type, elementId }) => {
      if (isStale) return;
      setElements(p => {
        const u = [...p];
        const matchIdx = elementId ? u.findIndex(el => el.id === elementId) : -1;
        const targetIdx = matchIdx >= 0 ? matchIdx : index;
        if (targetIdx >= 0 && targetIdx < u.length) u[targetIdx] = { ...u[targetIdx], type };
        return u;
      });
    };

    const onElementInserted = ({ afterIndex, afterElementId, element }) => {
      if (isStale) return;
      if (elementVersionsRef && element?.id) {
        elementVersionsRef.current.set(element.id, element.v || 0);
      }
      setElements(p => {
        const u = [...p];
        const matchIdx = afterElementId ? u.findIndex(el => el.id === afterElementId) : -1;
        const insertAfter = matchIdx >= 0 ? matchIdx : afterIndex;
        u.splice(insertAfter + 1, 0, element);
        return u;
      });
    };

    const onElementDeleted = ({ index, elementId }) => {
      if (isStale) return;
      if (elementVersionsRef && elementId) {
        elementVersionsRef.current.delete(elementId);
      }
      setElements(p => {
        if (elementId) return p.filter(el => el.id !== elementId);
        return p.filter((_, i) => i !== index);
      });
    };

    // ============ USERS ============
    const onUserJoined = ({ users }) => { if (!isStale) setUsers(users); };
    const onUserLeft = ({ users }) => { if (!isStale) setUsers(users); };
    const onCursorUpdated = ({ userId, cursor }) => { if (!isStale) setUsers(p => p.map(u => u.id === userId ? { ...u, cursor } : u)); };
    const onDocumentRestored = ({ title, elements }) => { if (!isStale) { setTitle(title); setElements(elements); } };

    // ============ COMMENTS ============
    const onCommentAdded = ({ comment }) => { if (!isStale) setComments(p => [...p, comment]); };
    const onCommentReplyAdded = ({ commentId, reply }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, replies: [...(c.replies || []), reply] } : c)); };
    const onCommentResolved = ({ commentId, resolved }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, resolved } : c)); };
    const onCommentDeleted = ({ commentId }) => { if (!isStale) setComments(p => p.filter(c => c.id !== commentId && c._id !== commentId)); };
    const onCommentUpdated = ({ commentId, content }) => { if (!isStale) setComments(p => p.map(c => (c.id === commentId || c._id === commentId) ? { ...c, content } : c)); };

    // ============ SUGGESTIONS ============
    const onSuggestionAdded = ({ suggestion }) => { if (!isStale) setSuggestions(p => [...p, suggestion]); };
    const onSuggestionAccepted = ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); };
    const onSuggestionRejected = ({ suggestionId }) => { if (!isStale) setSuggestions(p => p.filter(s => s.id !== suggestionId)); };

    // ============ CHAT ============
    const onChatMessage = (message) => {
      if (isStale) return;
      setChatMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.senderId !== socket.id) {
        setUnreadMessages(prev => prev + 1);
        playChatNotificationRef.current?.();
      }
    };
    const onChatHistory = (messages) => { if (!isStale) setChatMessages(messages); };

    // ============ REGISTER ALL LISTENERS ============
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('document-state', onDocumentState);
    socket.on('full-sync-applied', onFullSyncApplied);
    socket.on('title-updated', onTitleUpdated);
    socket.on('element-updated', onElementUpdated);
    socket.on('element-conflict', onElementConflict);
    socket.on('element-type-updated', onElementTypeUpdated);
    socket.on('element-inserted', onElementInserted);
    socket.on('element-deleted', onElementDeleted);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('cursor-updated', onCursorUpdated);
    socket.on('document-restored', onDocumentRestored);
    socket.on('comment-added', onCommentAdded);
    socket.on('comment-reply-added', onCommentReplyAdded);
    socket.on('comment-resolved', onCommentResolved);
    socket.on('comment-deleted', onCommentDeleted);
    socket.on('comment-updated', onCommentUpdated);
    socket.on('suggestion-added', onSuggestionAdded);
    socket.on('suggestion-accepted', onSuggestionAccepted);
    socket.on('suggestion-rejected', onSuggestionRejected);
    socket.on('chat-message', onChatMessage);
    socket.on('chat-history', onChatHistory);

    // ============ CLEANUP: Deregister ALL listeners + disconnect ============
    return () => {
      isStale = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('document-state', onDocumentState);
      socket.off('full-sync-applied', onFullSyncApplied);
      socket.off('title-updated', onTitleUpdated);
      socket.off('element-updated', onElementUpdated);
      socket.off('element-conflict', onElementConflict);
      socket.off('element-type-updated', onElementTypeUpdated);
      socket.off('element-inserted', onElementInserted);
      socket.off('element-deleted', onElementDeleted);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('cursor-updated', onCursorUpdated);
      socket.off('document-restored', onDocumentRestored);
      socket.off('comment-added', onCommentAdded);
      socket.off('comment-reply-added', onCommentReplyAdded);
      socket.off('comment-resolved', onCommentResolved);
      socket.off('comment-deleted', onCommentDeleted);
      socket.off('comment-updated', onCommentUpdated);
      socket.off('suggestion-added', onSuggestionAdded);
      socket.off('suggestion-accepted', onSuggestionAccepted);
      socket.off('suggestion-rejected', onSuggestionRejected);
      socket.off('chat-message', onChatMessage);
      socket.off('chat-history', onChatHistory);
      socket.disconnect();
    };
  }, [docId, token, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: playChatNotification removed from deps (uses ref) to prevent socket reconnection on callback identity change
}
