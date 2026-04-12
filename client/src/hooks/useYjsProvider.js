import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Creates and manages a Yjs document + WebSocket provider per document.
 * The provider syncs the Y.Doc to the server via WebSocket on /yjs/<docId>.
 * Awareness state (cursor position, user info) is shared automatically.
 */
export default function useYjsProvider({ docId, token, serverUrl, currentUser }) {
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [synced, setSynced] = useState(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!docId || docId === 'local' || !token) {
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      return;
    }

    // Derive WebSocket URL from server URL
    const wsUrl = serverUrl
      ? serverUrl.replace(/^http/, 'ws')
      : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider(
      wsUrl + '/yjs',
      docId,
      doc,
      {
        params: { token },
        connect: true,
        // Reconnect automatically
        maxBackoffTime: 10000,
      }
    );

    // Set user awareness (name, color for cursors)
    if (currentUser) {
      wsProvider.awareness.setLocalStateField('user', {
        name: currentUser.name || 'User',
        color: currentUser.color || '#3b82f6',
      });
    }

    wsProvider.on('synced', () => {
      console.log('[YJS] Document synced:', docId);
      setSynced(true);
    });

    wsProvider.on('status', ({ status }) => {
      console.log('[YJS] Provider status:', status);
    });

    setYdoc(doc);
    setProvider(wsProvider);

    cleanupRef.current = () => {
      wsProvider.disconnect();
      wsProvider.destroy();
      doc.destroy();
    };

    return () => {
      console.log('[YJS] Cleaning up provider for:', docId);
      wsProvider.disconnect();
      wsProvider.destroy();
      doc.destroy();
      setYdoc(null);
      setProvider(null);
      setSynced(false);
    };
  }, [docId, token, serverUrl, currentUser?.name, currentUser?.color]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ydoc, provider, synced };
}
