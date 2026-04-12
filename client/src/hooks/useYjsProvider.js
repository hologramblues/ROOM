import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Creates and manages a Yjs document + WebSocket provider per document.
 * Handles fallback migration: if Yjs doc is empty after sync, populates
 * from REST-loaded elements.
 */
export default function useYjsProvider({ docId, token, serverUrl, currentUser, elementsRef }) {
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [synced, setSynced] = useState(false);
  const providerRef = useRef(null);

  useEffect(() => {
    if (!docId || docId === 'local' || !token) {
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      return;
    }

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

    wsProvider.on('synced', (isSynced) => {
      console.log('[YJS] Synced:', isSynced, 'for doc:', docId);
      setSynced(true);

      // Fallback migration: if Yjs doc is empty, populate from REST-loaded elements
      const fragment = doc.getXmlFragment('default');
      if (fragment.length === 0 && elementsRef?.current?.length > 0) {
        console.log('[YJS] Empty Y.Doc — migrating', elementsRef.current.length, 'elements from REST');
        doc.transact(() => {
          elementsRef.current.forEach(el => {
            const xmlEl = new Y.XmlElement('screenplayElement');
            xmlEl.setAttribute('elementId', el.id);
            xmlEl.setAttribute('elementType', el.type || 'action');
            if (el.content) {
              xmlEl.insert(0, [new Y.XmlText(el.content)]);
            }
            fragment.push([xmlEl]);
          });
        });
        console.log('[YJS] Migration complete — fragment now has', fragment.length, 'elements');
      }
    });

    wsProvider.on('status', ({ status }) => {
      console.log('[YJS] Status:', status);
    });

    setYdoc(doc);
    setProvider(wsProvider);

    return () => {
      console.log('[YJS] Cleanup for:', docId);
      providerRef.current = null;
      wsProvider.disconnect();
      wsProvider.destroy();
      doc.destroy();
      setYdoc(null);
      setProvider(null);
      setSynced(false);
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

  return { ydoc, provider, synced };
}
