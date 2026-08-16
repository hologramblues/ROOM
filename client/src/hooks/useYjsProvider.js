import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { SERVER_URL } from '../constants/config';

/**
 * Creates and manages a Yjs document + WebSocket provider per document.
 * Migration from REST elements to Yjs is done in SingleEditor via
 * editor.commands.setContent() — which guarantees schema compatibility
 * with the TipTap extensions (ScreenplayElement, etc).
 */
export default function useYjsProvider({ docId, token, serverUrl, currentUser, elementsRef, loaderPromiseRef }) {
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [synced, setSynced] = useState(false);
  const syncedRef = useRef(false); // Stable ref — avoids re-renders cascading
  const authoritativeRef = useRef(false); // True once Yjs is the single source of truth
  const providerRef = useRef(null);

  useEffect(() => {
    if (!docId || docId === 'local' || !token) {
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      syncedRef.current = false;
      authoritativeRef.current = false;
      return;
    }

    // Robust WebSocket URL construction — works with path-based SERVER_URL too
    const baseUrl = serverUrl || SERVER_URL;
    let wsUrl;
    try {
      const u = new URL(baseUrl);
      const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProtocol}//${u.host}`;
    } catch (_) {
      wsUrl = baseUrl.replace(/^http/, 'ws');
    }

    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider(
      wsUrl + '/yjs',
      docId,
      doc,
      {
        params: { token },
        connect: true,
        maxBackoffTime: 10000,
      }
    );

    wsProvider.on('connection-error', (err) => {
      console.error('[YJS-HOOK] Connection error:', err);
    });
    wsProvider.on('connection-close', (evt) => {
      console.warn('[YJS-HOOK] Connection closed:', evt?.code, evt?.reason);
    });
    providerRef.current = wsProvider;

    if (currentUser) {
      wsProvider.awareness.setLocalStateField('user', {
        name: currentUser.name || 'User',
        color: currentUser.color || '#3b82f6',
      });
    }

    wsProvider.on('synced', async (isSynced) => {
      if (!isSynced) return;

      // Wait for REST loader (with 5s safety timeout) before marking synced,
      // so SingleEditor can decide migration based on both sources.
      if (loaderPromiseRef?.current) {
        try {
          await Promise.race([
            loaderPromiseRef.current,
            new Promise(resolve => setTimeout(resolve, 5000)),
          ]);
        } catch (_) {}
      }

      authoritativeRef.current = true;
      syncedRef.current = true;
      setSynced(true);
      // Migration (if needed) is now handled by SingleEditor via editor.commands.setContent
    });

    setYdoc(doc);
    setProvider(wsProvider);

    return () => {
      // Destroy BEFORE nulling the ref, otherwise we have a brief window where
      // the ref is null but the provider still exists
      try { wsProvider.disconnect(); } catch (_) {}
      try { wsProvider.destroy(); } catch (_) {}
      try { doc.destroy(); } catch (_) {}
      providerRef.current = null;
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      syncedRef.current = false;
      authoritativeRef.current = false;
    };
  }, [docId, token, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update awareness when user changes
  useEffect(() => {
    if (providerRef.current && currentUser) {
      providerRef.current.awareness.setLocalStateField('user', {
        name: currentUser.name || 'User',
        color: currentUser.color || '#3b82f6',
      });
    }
  }, [currentUser?.name, currentUser?.color]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ydoc, provider, synced, syncedRef, authoritativeRef };
}
