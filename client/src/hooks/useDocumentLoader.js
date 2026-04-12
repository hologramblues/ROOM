import { useEffect } from 'react';
import { SERVER_URL } from '../constants/config';
import { generateId } from '../utils/helpers';

export default function useDocumentLoader({
  docId, token, loadedDocRef,
  setElements, setTitle, setCharacters, setComments, setSuggestions,
  setBeatCards, setStructureBeats, setSceneSynopsis, setSceneStatus,
  setWhiteboardElements, setIsOwner, setMyRole, setPublicAccessState,
  setLoading, setToken,
  serverUrl,
}) {
  // Load document via REST API
  useEffect(() => {
    const effectiveUrl = serverUrl || SERVER_URL;

    const loadDocument = async () => {
      if (!docId || docId === 'local') {
        setElements([{ id: generateId(), type: 'scene', content: '' }]);
        setTitle('SANS TITRE');
        return;
      }
      if (loadedDocRef.current === docId) return;
      // Auth required — wait for login (effect re-triggers when token changes)
      if (!token) return;

      setLoading(true);
      try {
        const headers = { Authorization: 'Bearer ' + token };
        const res = await fetch(effectiveUrl + '/api/documents/' + docId, { headers });

        // Clear expired/invalid token on 401
        if (res.status === 401) {
          console.warn('[LOAD] Token expired or invalid — clearing');
          localStorage.removeItem('screenplay-token');
          if (setToken) setToken(null);
          setLoading(false);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          console.log('[LOAD] Document loaded with', data.elements?.length, 'elements');
          if (data.elements && data.elements.length > 0) {
            setTitle(data.title || 'SANS TITRE');
            setElements(data.elements);
            setCharacters(data.characters || []);
            setComments(data.comments || []);
            setSuggestions(data.suggestions || []);

            // Load Beat Board data from server if available
            if (data.beatCards) {
              console.log('[LOAD] Beat Board data found:', data.beatCards.length, 'cards');
              setBeatCards(data.beatCards);
            }
            if (data.structureBeats) {
              console.log('[LOAD] Structure beats found:', data.structureBeats.length, 'beats');
              setStructureBeats(data.structureBeats);
            }
            if (data.sceneSynopsis) {
              setSceneSynopsis(data.sceneSynopsis);
            }
            if (data.sceneStatus) {
              setSceneStatus(data.sceneStatus);
            }
            if (data.whiteboardElements) {
              console.log('[LOAD] Whiteboard elements found:', data.whiteboardElements.length, 'elements');
              setWhiteboardElements(data.whiteboardElements);
            }

            // If no Beat Board data from server, try local backup
            if (!data.beatCards && !data.structureBeats) {
              try {
                const backupStr = localStorage.getItem(`rooms-backup-${docId}`);
                if (backupStr) {
                  const backup = JSON.parse(backupStr);
                  if (backup.beatCards && backup.beatCards.length > 0) {
                    console.log('[LOAD] Restoring Beat Board from local backup:', backup.beatCards.length, 'cards');
                    setBeatCards(backup.beatCards);
                  }
                  if (backup.structureBeats && backup.structureBeats.length > 0) {
                    console.log('[LOAD] Restoring structure beats from local backup:', backup.structureBeats.length, 'beats');
                    setStructureBeats(backup.structureBeats);
                  }
                  if (backup.sceneSynopsis) {
                    setSceneSynopsis(backup.sceneSynopsis);
                  }
                  if (backup.sceneStatus) {
                    setSceneStatus(backup.sceneStatus);
                  }
                  if (backup.whiteboardElements && backup.whiteboardElements.length > 0) {
                    console.log('[LOAD] Restoring whiteboard from local backup:', backup.whiteboardElements.length, 'elements');
                    setWhiteboardElements(backup.whiteboardElements);
                  }
                }
              } catch (backupErr) {
                console.error('[LOAD] Error loading local backup:', backupErr);
              }
            }

            loadedDocRef.current = docId;
            // Mark document as loaded so emissions are allowed
            // Set baseline for diff system
            setIsOwner(!!data.isOwner);
            if (data.publicAccess) setPublicAccessState(data.publicAccess);
            // Use role from server (accounts for owner, collaborator, or auto-add)
            setMyRole(data.role || (data.isOwner ? 'editor' : 'viewer'));
          }
        }
      } catch (err) { console.error('[LOAD] Error:', err); }
      // Small delay to let React render elements before hiding overlay
      setTimeout(() => setLoading(false), 100);
    };
    loadDocument();
  }, [docId, token, serverUrl]); // eslint-disable-line react-hooks/exhaustive-deps
}
