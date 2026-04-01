import { useState, useEffect, useRef, useCallback } from 'react';
import { SERVER_URL } from '../constants/config';

export default function useOfflineMode({
  docId, token, connected, socketRef, elementsRef, titleRef, lastSaved,
  setElements, setTitle, setLastSaved, loadedDocRef, lastEmittedRef
}) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineDocId, setOfflineDocId] = useState(null);
  const [offlineSnapshot, setOfflineSnapshot] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [conflictServerUpdatedAt, setConflictServerUpdatedAt] = useState(null);
  const offlineDocIdRef = useRef(null);

  useEffect(() => {
    offlineDocIdRef.current = offlineDocId;
  }, [offlineDocId]);

  const isFullyConnected = isOnline && connected;

  // Browser online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Restore offline session from localStorage on mount
  useEffect(() => {
    if (!docId) return;
    const saved = localStorage.getItem(`rooms-offline-${docId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.docId === docId && data.elements) {
          setOfflineDocId(docId);
          setOfflineSnapshot(data);
          setElements(data.elements);
          setTitle(data.title || 'SANS TITRE');
        }
      } catch (e) { console.error('[OFFLINE] Error restoring offline session:', e); }
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save offline copy to localStorage every 5 seconds when in offline mode
  useEffect(() => {
    if (!offlineDocId) return;
    const interval = setInterval(() => {
      const data = {
        docId: offlineDocId,
        title: titleRef.current,
        elements: elementsRef.current,
        timestamp: new Date().toISOString(),
        serverUpdatedAt: offlineSnapshot?.serverUpdatedAt || null,
      };
      localStorage.setItem(`rooms-offline-${offlineDocId}`, JSON.stringify(data));
    }, 5000);
    return () => clearInterval(interval);
  }, [offlineDocId, offlineSnapshot, titleRef, elementsRef]);

  // Activate offline mode
  const activateOfflineMode = useCallback(() => {
    const snapshot = {
      docId, title: titleRef.current, elements: elementsRef.current,
      timestamp: new Date().toISOString(),
      serverUpdatedAt: lastSaved ? lastSaved.toISOString() : new Date().toISOString(),
    };
    localStorage.setItem(`rooms-offline-${docId}`, JSON.stringify(snapshot));
    setOfflineSnapshot(snapshot);
    setOfflineDocId(docId);
  }, [docId, lastSaved, titleRef, elementsRef]);

  // Push offline changes to server
  const pushOfflineChanges = useCallback(async (force = false) => {
    if (!offlineDocId || !token) return;
    try {
      const metaRes = await fetch(SERVER_URL + '/api/documents/' + offlineDocId + '/meta', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!metaRes.ok) throw new Error('Failed to fetch document meta');
      const meta = await metaRes.json();

      const snapshotTime = offlineSnapshot?.serverUpdatedAt ? new Date(offlineSnapshot.serverUpdatedAt).getTime() : 0;
      const serverTime = new Date(meta.updatedAt).getTime();
      const hasConflict = serverTime > snapshotTime + 5000;

      if (hasConflict && !force) {
        setConflictServerUpdatedAt(meta.updatedAt);
        setShowConflictModal(true);
        return;
      }

      const res = await fetch(SERVER_URL + '/api/documents/' + offlineDocId + '/autosave', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: titleRef.current, elements: elementsRef.current }),
      });
      if (!res.ok) throw new Error('Push failed');

      if (socketRef.current && connected) {
        socketRef.current.emit('full-sync', { elements: elementsRef.current });
        if (lastEmittedRef) lastEmittedRef.current = elementsRef.current;
      }

      localStorage.removeItem(`rooms-offline-${offlineDocId}`);
      setOfflineDocId(null);
      setOfflineSnapshot(null);
      setShowConflictModal(false);
      setLastSaved(new Date());
      console.log('[OFFLINE] Changes pushed successfully');
    } catch (err) {
      console.error('[OFFLINE] Push error:', err);
    }
  }, [offlineDocId, offlineSnapshot, token, connected, socketRef, titleRef, elementsRef, setLastSaved, lastEmittedRef]);

  // Discard offline copy
  const discardOfflineCopy = useCallback(() => {
    if (!offlineDocId) return;
    localStorage.removeItem(`rooms-offline-${offlineDocId}`);
    setOfflineDocId(null);
    setOfflineSnapshot(null);
    setShowConflictModal(false);
    loadedDocRef.current = null;
  }, [offlineDocId, loadedDocRef]);

  return {
    isOnline, isFullyConnected, offlineDocId, offlineDocIdRef,
    offlineSnapshot, showConflictModal, setShowConflictModal,
    activateOfflineMode, pushOfflineChanges, discardOfflineCopy
  };
}
