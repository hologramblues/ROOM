import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import { SERVER_URL } from '../constants/config';
import { buildDocFromElements, stripHtml } from '../utils/helpers';

/**
 * Creates and manages a Yjs document + WebSocket provider per document.
 * Fallback migration: if Yjs doc is empty after sync, populates
 * from REST-loaded elements using the TipTap-compatible format.
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
    providerRef.current = wsProvider;

    if (currentUser) {
      wsProvider.awareness.setLocalStateField('user', {
        name: currentUser.name || 'User',
        color: currentUser.color || '#3b82f6',
      });
    }

    wsProvider.on('synced', async (isSynced) => {
      if (!isSynced) return;

      // Wait for REST loader to complete (with 5s safety timeout)
      // Prevents race: REST could still be fetching when Yjs syncs, AND guards
      // against the loader never resolving (e.g. failed fetch not caught).
      if (loaderPromiseRef?.current) {
        try {
          await Promise.race([
            loaderPromiseRef.current,
            new Promise(resolve => setTimeout(resolve, 5000)),
          ]);
        } catch (_) {}
      }

      const fragment = doc.getXmlFragment('default');
      const fragmentHasContent = fragment.length > 0;
      const hasRestElements = elementsRef?.current?.length > 0;

      console.log('[YJS] Synced for', docId, '— fragment.length=', fragment.length, 'rest.length=', elementsRef?.current?.length || 0);

      if (!fragmentHasContent && hasRestElements) {
        // Migration path: Yjs empty, REST has content — build a proper TipTap-compatible Y.Doc
        const elements = elementsRef.current;
        const tiptapJSON = buildDocFromElements(elements.map(el => ({
          ...el,
          content: stripHtml(el.content || ''), // plain text only for migration
        })));

        try {
          const tempDoc = prosemirrorJSONToYDoc(tiptapJSON, 'default');
          const update = Y.encodeStateAsUpdate(tempDoc);
          Y.applyUpdate(doc, update, 'migration');
          tempDoc.destroy();
          console.log('[YJS] Migration complete —', elements.length, 'elements → Y.Doc with', fragment.length, 'nodes');
        } catch (err) {
          console.error('[YJS] Migration failed:', err);
        }
      } else if (fragmentHasContent) {
        console.log('[YJS] Y.Doc authoritative — REST content ignored');
      }

      // Mark authoritative AFTER migration decision is made
      authoritativeRef.current = true;
      syncedRef.current = true;
      setSynced(true);
    });

    wsProvider.on('status', ({ status }) => {
      console.log('[YJS] Status:', status);
    });

    setYdoc(doc);
    setProvider(wsProvider);

    return () => {
      console.log('[YJS] Cleanup for:', docId);
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
