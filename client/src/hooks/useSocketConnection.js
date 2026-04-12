import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../constants/config';

/**
 * Socket.io connection for non-document events:
 * - Chat messages
 * - Comments & suggestions
 * - User presence (who's online)
 * - Title changes
 * - Document restore notifications
 *
 * NOTE: Document content sync is handled by Yjs (useYjsProvider).
 */
export default function useSocketConnection({
  docId, token,
  socketRef, offlineDocIdRef,
  setConnected, setMyId, setMyRole, setUsers,
  setElements, setTitle, setComments, setSuggestions, setCollaborators,
  setChatMessages, setUnreadMessages,
  playChatNotification,
  serverUrl,
}) {
  const playChatNotificationRef = useRef(playChatNotification);
  useEffect(() => { playChatNotificationRef.current = playChatNotification; });

  useEffect(() => {
    if (docId === 'local') return;
    let isStale = false;

    const effectiveUrl = serverUrl || SERVER_URL;
    const socket = io(effectiveUrl, { transports: ['websocket', 'polling'], auth: { token }, reconnectionAttempts: 10, timeout: 30000 });
    socketRef.current = socket;

    // ============ CONNECTION ============
    const onConnect = () => { if (isStale) return; setConnected(true); setMyId(socket.id); if (docId && docId !== 'local') socket.emit('join-document', { docId }); };
    const onDisconnect = () => { if (isStale) return; setConnected(false); };

    // ============ DOCUMENT STATE (metadata only — content via Yjs) ============
    const onDocumentState = (data) => {
      if (isStale) return;
      setUsers(data.users || []);
      if (data.role) setMyRole(data.role);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (data.collaborators && data.collaborators.length > 0) {
        setCollaborators(data.collaborators);
      }
      if (data.comments) setComments(data.comments);
      // Title sync via socket (Yjs only syncs document content)
      if (!offlineDocIdRef.current && data.title) {
        setTitle(data.title);
      }
      console.log('[SOCKET] Document metadata synced');
    };

    // ============ TITLE ============
    const onTitleUpdated = ({ title }) => { if (!isStale) setTitle(title); };

    // ============ USERS ============
    const onUserJoined = ({ users }) => { if (!isStale) setUsers(users); };
    const onUserLeft = ({ users }) => { if (!isStale) setUsers(users); };
    const onDocumentRestored = ({ title }) => { if (!isStale && title) setTitle(title); };

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
    socket.on('title-updated', onTitleUpdated);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
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

    // ============ CLEANUP ============
    return () => {
      isStale = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('document-state', onDocumentState);
      socket.off('title-updated', onTitleUpdated);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
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
}
