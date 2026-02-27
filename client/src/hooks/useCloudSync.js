import { useState, useCallback, useRef } from 'react';
import { IS_DESKTOP, SERVER_URL, CLOUD_URL } from '../constants/config';

export default function useCloudSync({ cloudToken, cloudUser, setShowCloudAuthModal }) {
  const [cloudShortId, setCloudShortId] = useState(null);
  const [cloudSyncedAt, setCloudSyncedAt] = useState(null);
  const [editingMode, setEditingMode] = useState('local'); // 'local' | 'cloud'
  const [syncing, setSyncing] = useState(false);
  const cloudShortIdRef = useRef(null);

  // Keep ref in sync
  cloudShortIdRef.current = cloudShortId;

  // Reset all cloud state (e.g. when switching documents)
  const resetCloudSync = useCallback(() => {
    setCloudShortId(null);
    setCloudSyncedAt(null);
    setEditingMode('local');
  }, []);

  // Load cloud meta from local server
  const loadCloudMeta = useCallback(async (localDocId) => {
    if (!IS_DESKTOP || !localDocId) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + localDocId + '/cloud-meta');
      if (res.ok) {
        const data = await res.json();
        setCloudShortId(data.cloudShortId || null);
        setCloudSyncedAt(data.cloudSyncedAt || null);
      }
    } catch (err) {
      console.error('[CLOUD-SYNC] Failed to load cloud meta:', err);
    }
  }, []);

  // Save cloud meta to local server
  const saveCloudMeta = useCallback(async (localDocId, cloudId, syncedAt) => {
    try {
      await fetch(SERVER_URL + '/api/documents/' + localDocId + '/cloud-meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudShortId: cloudId, cloudSyncedAt: syncedAt }),
      });
    } catch (err) {
      console.error('[CLOUD-SYNC] Failed to save cloud meta:', err);
    }
  }, []);

  // Push local document to cloud
  // Called as pushToCloud(localDocId, { elementsRef, titleRef, ... })
  const pushToCloud = useCallback(async (localDocId, refs) => {
    if (!IS_DESKTOP) return null;
    if (!cloudToken) {
      setShowCloudAuthModal?.(true);
      return null;
    }

    setSyncing(true);
    try {
      const elements = refs.elementsRef.current;
      const title = refs.titleRef.current;
      const beatCards = refs.beatCardsRef.current;
      const structureBeats = refs.structureBeatsRef.current;
      const sceneSynopsis = refs.sceneSynopsisRef.current;
      const sceneStatus = refs.sceneStatusRef.current;
      const whiteboardElements = refs.whiteboardElementsRef.current;

      const currentCloudId = cloudShortIdRef.current;
      let resultCloudId = currentCloudId;

      if (currentCloudId) {
        // Update existing cloud document
        const res = await fetch(CLOUD_URL + '/api/documents/' + currentCloudId + '/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cloudToken },
          body: JSON.stringify({ title, elements, beatCards, structureBeats, sceneSynopsis, sceneStatus, whiteboardElements }),
        });
        if (!res.ok) throw new Error('Cloud bulk save failed: ' + res.status);
        console.log('[CLOUD-SYNC] Updated cloud document', currentCloudId);
      } else {
        // Create new cloud document
        const createRes = await fetch(CLOUD_URL + '/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cloudToken },
          body: JSON.stringify({ title, elements }),
        });
        if (!createRes.ok) throw new Error('Cloud create failed: ' + createRes.status);
        const createData = await createRes.json();
        resultCloudId = createData.id;

        // Push beat data via bulk save
        await fetch(CLOUD_URL + '/api/documents/' + resultCloudId + '/bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cloudToken },
          body: JSON.stringify({ beatCards, structureBeats, sceneSynopsis, sceneStatus, whiteboardElements }),
        });

        // Enable public access for sharing
        await fetch(CLOUD_URL + '/api/documents/' + resultCloudId + '/public-access', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cloudToken },
          body: JSON.stringify({ enabled: true, role: 'editor' }),
        });

        console.log('[CLOUD-SYNC] Created cloud document', resultCloudId);
      }

      // Save mapping locally
      const syncedAt = new Date().toISOString();
      await saveCloudMeta(localDocId, resultCloudId, syncedAt);
      setCloudShortId(resultCloudId);
      setCloudSyncedAt(syncedAt);

      return resultCloudId;
    } catch (err) {
      console.error('[CLOUD-SYNC] Push failed:', err);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [cloudToken, saveCloudMeta, setShowCloudAuthModal]);

  // Pull cloud document to local
  const pullFromCloud = useCallback(async (localDocId) => {
    if (!IS_DESKTOP || !cloudToken || !cloudShortIdRef.current) return null;

    setSyncing(true);
    try {
      // Fetch cloud document
      const res = await fetch(CLOUD_URL + '/api/documents/' + cloudShortIdRef.current, {
        headers: { Authorization: 'Bearer ' + cloudToken },
      });
      if (!res.ok) throw new Error('Cloud fetch failed: ' + res.status);
      const cloudDoc = await res.json();

      // Overwrite local document
      await fetch(SERVER_URL + '/api/documents/' + localDocId + '/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cloudDoc.title,
          elements: cloudDoc.elements,
          beatCards: cloudDoc.beatCards,
          structureBeats: cloudDoc.structureBeats,
          sceneSynopsis: cloudDoc.sceneSynopsis,
          sceneStatus: cloudDoc.sceneStatus,
          whiteboardElements: cloudDoc.whiteboardElements,
        }),
      });

      // Update sync timestamp
      const syncedAt = new Date().toISOString();
      await saveCloudMeta(localDocId, cloudShortIdRef.current, syncedAt);
      setCloudSyncedAt(syncedAt);

      console.log('[CLOUD-SYNC] Pulled from cloud', cloudShortIdRef.current);
      return cloudDoc;
    } catch (err) {
      console.error('[CLOUD-SYNC] Pull failed:', err);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [cloudToken, saveCloudMeta]);

  // Switch to cloud editing mode (returns cloudShortId for routing)
  const switchToCloud = useCallback(async () => {
    if (!cloudToken || !cloudShortIdRef.current) return null;
    setEditingMode('cloud');
    return cloudShortIdRef.current;
  }, [cloudToken]);

  // Switch back to local editing mode
  const switchToLocal = useCallback(() => {
    setEditingMode('local');
  }, []);

  return {
    cloudShortId,
    cloudSyncedAt,
    editingMode,
    syncing,
    loadCloudMeta,
    pushToCloud,
    pullFromCloud,
    switchToCloud,
    switchToLocal,
    resetCloudSync,
  };
}
