import { useEffect, useRef } from 'react';
import { SERVER_URL } from '../constants/config';
import { stripHtml } from '../utils/helpers';

// Helper to format snapshot name: "TITLE - DD/MM/YY HH:MM" or "TITLE - DD/MM/YY HH:MM - AS" for autosave
export const formatSnapshotName = (docTitle, isAuto = false) => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const suffix = isAuto ? ' - AS' : '';
  return `${docTitle || 'SANS TITRE'} - ${dd}/${mm}/${yy} ${hh}:${min}${suffix}`;
};

export default function useAutoSave({
  docId, token, offlineDocId,
  elementsRef, titleRef, beatCardsRef, structureBeatsRef,
  sceneSynopsisRef, sceneStatusRef, whiteboardElementsRef, notesRef,
  setLastSaved,
  serverUrl,
  yjsSyncedRef, // Set true when Yjs has synced — autosave waits for this
}) {
  const effectiveUrl = serverUrl || SERVER_URL;
  // Track last saved state for auto-save comparison
  const lastSavedElementsRef = useRef(null);
  const lastSavedTitleRef = useRef(null);
  const lastSavedBeatDataRef = useRef(null);
  // Track last signature + timestamp for stable-debounce (3s quiet before save)
  const lastSignatureRef = useRef('');
  const lastSignatureChangeAtRef = useRef(0);

  // Auto-backup to localStorage every 30 seconds
  // Uses refs to avoid resetting the 30s interval on every keystroke
  useEffect(() => {
    if (!docId) return;
    const backupInterval = setInterval(() => {
      const currentElements = elementsRef.current;
      if (!currentElements || currentElements.length === 0) return;
      const backup = {
        docId,
        title: titleRef.current,
        elements: currentElements,
        timestamp: new Date().toISOString(),
        sceneSynopsis: sceneSynopsisRef.current,
        sceneStatus: sceneStatusRef.current,
        notes: notesRef.current,
        // Beat Board data
        beatCards: beatCardsRef.current,
        structureBeats: structureBeatsRef.current,
        whiteboardElements: whiteboardElementsRef.current,
      };
      localStorage.setItem(`rooms-backup-${docId}`, JSON.stringify(backup));
    }, 30000);
    return () => clearInterval(backupInterval);
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to cloud every 10 seconds (only if changes detected, skip in offline mode)
  useEffect(() => {
    if (!docId || !token || offlineDocId) return;

    const autoSaveInterval = setInterval(async () => {
      const currentElements = elementsRef.current;
      const currentTitle = titleRef.current;
      const currentBeatCards = beatCardsRef.current;
      const currentStructureBeats = structureBeatsRef.current;
      const currentSceneSynopsis = sceneSynopsisRef.current;
      const currentSceneStatus = sceneStatusRef.current;
      const currentWhiteboardElements = whiteboardElementsRef.current;

      if (!currentElements || currentElements.length === 0) return;
      // Don't autosave if document appears empty (only 1 element with no content)
      // This prevents overwriting real content after a failed load
      const hasRealContent = currentElements.length > 1 ||
        currentElements.some(el => el.content && stripHtml(el.content).trim().length > 0);
      if (!hasRealContent) return;

      // SAFETY: Don't POST to MongoDB autosave until Yjs has synced AND content is stable.
      // Prevents races where stale React state overwrites Yjs-persisted doc on reload.
      if (yjsSyncedRef && !yjsSyncedRef.current) return;
      const signature = currentElements.length + ':' + currentElements.reduce((a, el) => a + (el.content?.length || 0), 0);
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        lastSignatureChangeAtRef.current = Date.now();
        return; // content just changed — wait for stability
      }
      if (Date.now() - lastSignatureChangeAtRef.current < 3000) return; // <3s quiet, wait

      // Build beat data object for comparison
      const currentBeatData = {
        beatCards: currentBeatCards,
        structureBeats: currentStructureBeats,
        sceneSynopsis: currentSceneSynopsis,
        sceneStatus: currentSceneStatus,
        whiteboardElements: currentWhiteboardElements
      };

      // Check if there are changes since last save
      const elementsChanged = JSON.stringify(currentElements) !== JSON.stringify(lastSavedElementsRef.current);
      const titleChanged = currentTitle !== lastSavedTitleRef.current;
      const beatDataChanged = JSON.stringify(currentBeatData) !== JSON.stringify(lastSavedBeatDataRef.current);

      if (elementsChanged || titleChanged || beatDataChanged) {
        try {
          const res = await fetch(effectiveUrl + '/api/documents/' + docId + '/autosave', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              title: currentTitle,
              elements: currentElements,
              // Beat Board data
              beatCards: currentBeatCards,
              structureBeats: currentStructureBeats,
              sceneSynopsis: currentSceneSynopsis,
              sceneStatus: currentSceneStatus,
              whiteboardElements: currentWhiteboardElements
            })
          });
          if (res.ok) {
            lastSavedElementsRef.current = JSON.parse(JSON.stringify(currentElements));
            lastSavedTitleRef.current = currentTitle;
            lastSavedBeatDataRef.current = JSON.parse(JSON.stringify(currentBeatData));
            setLastSaved(new Date());
            console.log('[AUTOSAVE] Saved at', new Date().toLocaleTimeString(), '(incl. Beat Board data)');
          } else {
            console.error('[AUTOSAVE] Server error:', res.status);
          }
        } catch (err) {
          console.error('[AUTOSAVE] Error:', err);
        }
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [docId, token, offlineDocId, effectiveUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-snapshot every 15 minutes (only when document is open and has content)
  // Uses refs to avoid resetting the 15-min interval on every keystroke
  useEffect(() => {
    if (!docId || !token) return;

    const autoSnapshotInterval = setInterval(async () => {
      const currentElements = elementsRef.current;
      if (!currentElements || currentElements.length === 0) return;

      // Only create snapshot if document has meaningful content
      const hasContent = currentElements.some(el => el.content && stripHtml(el.content).trim().length > 0);
      if (!hasContent) return;

      try {
        const currentTitle = titleRef.current;
        const snapshotName = formatSnapshotName(currentTitle, true);
        const res = await fetch(effectiveUrl + '/api/documents/' + docId + '/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            title: currentTitle,
            elements: currentElements,
            auto: true,
            snapshotName,
            // Beat Board data
            beatCards: beatCardsRef.current,
            structureBeats: structureBeatsRef.current,
            sceneSynopsis: sceneSynopsisRef.current,
            sceneStatus: sceneStatusRef.current,
            whiteboardElements: whiteboardElementsRef.current
          })
        });
        if (res.ok) {
          console.log('[AUTO-SNAPSHOT] Created:', snapshotName);
        }
      } catch (err) {
        console.error('[AUTO-SNAPSHOT] Error:', err);
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(autoSnapshotInterval);
  }, [docId, token, effectiveUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lastSavedElementsRef, lastSavedTitleRef, lastSavedBeatDataRef };
}
