/**
 * Yjs WebSocket Server for ROOMS
 *
 * Runs alongside Socket.io on the same HTTP server using /yjs path.
 * Uses lib0/y-protocols for correct Yjs sync protocol implementation.
 */
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { MongodbPersistence } = require('y-mongodb-provider');
const { User, Document } = require('./models');

// Access control helper — mirrors checkDocumentAccess in server.js
function checkDocAccess(doc, user, requiredRole = 'viewer') {
  if (!doc) return false;
  // Public access
  if (doc.publicAccess && doc.publicAccess.enabled) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    if (h[doc.publicAccess.role] >= h[requiredRole]) return true;
  }
  if (!user) return false;
  // Owner
  if (doc.ownerId && doc.ownerId.equals(user._id)) return true;
  // Collaborator
  const collab = doc.collaborators && doc.collaborators.find(c => c.userId && c.userId.equals(user._id));
  if (collab) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    return h[collab.role] >= h[requiredRole];
  }
  return false;
}

// Snapshot schema for disaster recovery — separate from main y-mongodb-provider updates
const yjsSnapshotSchema = new mongoose.Schema({
  docName: { type: String, required: true, index: true },
  state: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  fragmentLength: { type: Number, default: 0 },
});
const YjsSnapshot = mongoose.models.YjsSnapshot || mongoose.model('YjsSnapshot', yjsSnapshotSchema);

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const MAX_SNAPSHOTS_PER_DOC = 20;

const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const awarenessProtocol = require('y-protocols/awareness');
const syncProtocol = require('y-protocols/sync');

const messageSync = 0;
const messageAwareness = 1;

function attachYjsServer(httpServer, mongoUri, jwtSecret) {
  const mdb = new MongodbPersistence(mongoUri, {
    collectionName: 'yjs-documents',
    flushSize: 100,
    multipleCollections: false,
  });

  // Shared Y.Doc per document room
  const docs = new Map();
  // Awareness per document
  const awarenessMap = new Map();
  // Connections per room
  const roomConns = new Map();

  // Track dirty flag per doc for snapshot optimization
  const dirtyDocs = new Set();
  // Track snapshot intervals for cleanup
  const snapshotIntervals = new Map();
  // Track last disconnect time per doc for safe cleanup (replaces racey setTimeout)
  const lastDisconnectTime = new Map();
  const ROOM_CLEANUP_GRACE_MS = 60 * 1000; // 60s idle before cleanup
  const SWEEP_INTERVAL_MS = 30 * 1000;      // sweep every 30s

  // Periodic sweep: destroy rooms that have been empty for more than grace period
  setInterval(() => {
    const now = Date.now();
    for (const [docName, lastDisc] of lastDisconnectTime.entries()) {
      const room = roomConns.get(docName);
      // Only destroy if room is still empty and has been idle long enough
      if ((!room || room.size === 0) && now - lastDisc > ROOM_CLEANUP_GRACE_MS) {
        // Final flush to snapshot before destroy
        const d = docs.get(docName);
        if (d && dirtyDocs.has(docName)) {
          try {
            const state = Y.encodeStateAsUpdate(d);
            const fragmentLength = d.getXmlFragment('default').length;
            YjsSnapshot.create({ docName, state: Buffer.from(state), fragmentLength }).catch(() => {});
          } catch (_) {}
        }
        const interval = snapshotIntervals.get(docName);
        if (interval) clearInterval(interval);
        snapshotIntervals.delete(docName);
        if (d) { d.destroy(); docs.delete(docName); }
        awarenessMap.delete(docName);
        roomConns.delete(docName);
        lastDisconnectTime.delete(docName);
        dirtyDocs.delete(docName);
        console.log(`[YJS] Cleaned up idle room "${docName}"`);
      }
    }
  }, SWEEP_INTERVAL_MS);

  async function getYDoc(docName) {
    if (docs.has(docName)) return docs.get(docName);

    const ydoc = new Y.Doc();
    docs.set(docName, ydoc);

    // Load persisted state
    try {
      const persistedDoc = await mdb.getYDoc(docName);
      const state = Y.encodeStateAsUpdate(persistedDoc);
      Y.applyUpdate(ydoc, state);
      persistedDoc.destroy();
      console.log(`[YJS] Loaded doc "${docName}" from MongoDB`);
    } catch (err) {
      console.log(`[YJS] No persisted state for "${docName}" (new doc)`);
    }

    // Persist all future updates
    ydoc.on('update', (update) => {
      dirtyDocs.add(docName);
      mdb.storeUpdate(docName, update).catch(err => {
        console.error(`[YJS] Persist error for "${docName}":`, err.message);
      });
    });

    // Start periodic snapshot (disaster recovery)
    const snapshotInterval = setInterval(async () => {
      if (!dirtyDocs.has(docName)) return;
      dirtyDocs.delete(docName);
      try {
        const state = Y.encodeStateAsUpdate(ydoc);
        const fragmentLength = ydoc.getXmlFragment('default').length;
        await YjsSnapshot.create({ docName, state: Buffer.from(state), fragmentLength });
        // Prune oldest snapshots beyond MAX
        const count = await YjsSnapshot.countDocuments({ docName });
        if (count > MAX_SNAPSHOTS_PER_DOC) {
          const toDelete = count - MAX_SNAPSHOTS_PER_DOC;
          const oldest = await YjsSnapshot.find({ docName }).sort({ createdAt: 1 }).limit(toDelete).select('_id');
          if (oldest.length > 0) {
            await YjsSnapshot.deleteMany({ _id: { $in: oldest.map(s => s._id) } });
          }
        }
        console.log(`[YJS] Snapshot saved for "${docName}" (${fragmentLength} elements, ${state.byteLength} bytes)`);
      } catch (err) {
        console.error(`[YJS] Snapshot error for "${docName}":`, err.message);
      }
    }, SNAPSHOT_INTERVAL_MS);
    snapshotIntervals.set(docName, snapshotInterval);

    return ydoc;
  }

  function getAwareness(docName, ydoc) {
    if (awarenessMap.has(docName)) return awarenessMap.get(docName);
    const awareness = new awarenessProtocol.Awareness(ydoc);
    awarenessMap.set(docName, awareness);

    // When awareness changes, broadcast to all connections in the room
    awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = added.concat(updated, removed);
      const room = roomConns.get(docName);
      if (!room || changedClients.length === 0) return;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      const msg = encoding.toUint8Array(encoder);
      room.forEach(({ ws }) => {
        if (ws.readyState === 1) {
          try { ws.send(msg); } catch (_) {}
        }
      });
    });

    return awareness;
  }

  const wss = new WebSocketServer({ noServer: true });

  // Intercept HTTP upgrade for /yjs paths
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (!url.pathname.startsWith('/yjs/')) return; // Let Socket.io handle other paths

    const docName = url.pathname.replace('/yjs/', '');
    const token = url.searchParams.get('token');

    if (!token || !docName) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      request.userId = decoded.userId;
      request.userName = decoded.name;
      request.userColor = decoded.color;
      request.docName = docName;
    } catch (err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws, request) => {
    const docName = request.docName;
    const userName = request.userName || 'Unknown';
    const userId = request.userId;

    // Write authorization captured once, at connection time (AUDIT 5.3).
    // `false` until the access check below proves the user is an editor, so any
    // early/unexpected frame is treated as read-only.
    let canWrite = false;

    // Document-level access control: fetch user + doc, verify authorization
    try {
      const [user, doc] = await Promise.all([
        User.findById(userId).select('_id name color'),
        Document.findOne({ shortId: docName }).select('ownerId collaborators publicAccess'),
      ]);
      if (!doc) {
        console.warn(`[YJS] ${userName} denied: doc "${docName}" not found`);
        ws.close(1008, 'Document not found');
        return;
      }
      if (!checkDocAccess(doc, user, 'viewer')) {
        console.warn(`[YJS] ${userName} denied: no access to "${docName}"`);
        ws.close(1008, 'Access denied');
        return;
      }
      // viewer/commenter connect read-only; only `editor` may mutate the CRDT.
      canWrite = checkDocAccess(doc, user, 'editor');
      console.log(`[YJS] ${userName} connected to "${docName}" (authorized, ${canWrite ? 'read-write' : 'read-only'})`);
    } catch (err) {
      console.error(`[YJS] Access check failed for ${userName}:`, err.message);
      ws.close(1011, 'Server error');
      return;
    }

    const ydoc = await getYDoc(docName);
    const awareness = getAwareness(docName, ydoc);

    // Track this connection with a unique client ID
    const clientID = ydoc.clientID + Math.floor(Math.random() * 1000000);
    if (!roomConns.has(docName)) roomConns.set(docName, new Map());
    roomConns.get(docName).set(ws, { ws, clientID });
    // Cancel pending cleanup — room has an active connection again
    lastDisconnectTime.delete(docName);

    // --- INITIAL SYNC: Send SyncStep1 to client ---
    {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, ydoc);
      ws.send(encoding.toUint8Array(encoder));
    }

    // --- INITIAL SYNC: Also send SyncStep2 (full state) ---
    {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep2(encoder, ydoc);
      ws.send(encoding.toUint8Array(encoder));
    }

    // --- Send current awareness states ---
    {
      const states = awareness.getStates();
      if (states.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(states.keys()))
        );
        ws.send(encoding.toUint8Array(encoder));
      }
    }

    // --- Handle incoming messages ---
    ws.on('message', (data) => {
      try {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const msgType = decoding.readVarUint(decoder);

        if (msgType === messageSync) {
          // AUDIT 5.3: the connect-time check is not enough — every frame must be
          // authorized. Peek at the sync sub-type on a throwaway decoder so the
          // real decoder stays untouched for the allowed path below.
          if (!canWrite) {
            const peek = decoding.createDecoder(message);
            decoding.readVarUint(peek); // msgType
            const syncType = decoding.readVarUint(peek);
            // SyncStep1 is a read: the client asks for state, the server answers
            // with SyncStep2. SyncStep2 and Update WRITE into the shared Y.Doc,
            // so a read-only connection must not have them applied.
            if (syncType !== syncProtocol.messageYjsSyncStep1) {
              console.warn(`[YJS] Rejected write from read-only connection (${userName} on "${docName}")`);
              return;
            }
          }
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          // readSyncMessage processes the client's message and writes response to encoder
          syncProtocol.readSyncMessage(decoder, encoder, ydoc, null);
          // Send response back to the requesting client
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
        } else if (msgType === messageAwareness) {
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
            ws
          );
          // Awareness broadcasting is handled by the awareness 'update' event listener above
        }
      } catch (err) {
        console.error('[YJS] Message error:', err.message);
      }
    });

    // --- Handle Yjs doc updates: broadcast to other clients ---
    const onUpdate = (update, origin) => {
      // Don't echo updates back to the sender
      if (origin === ws) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const msg = encoding.toUint8Array(encoder);

      const room = roomConns.get(docName);
      if (!room) return;
      room.forEach(({ ws: client }) => {
        if (client !== ws && client.readyState === 1) {
          try { client.send(msg); } catch (_) {}
        }
      });
    };
    ydoc.on('update', onUpdate);

    // --- Disconnect ---
    ws.on('close', () => {
      console.log(`[YJS] ${userName} disconnected from "${docName}"`);
      ydoc.off('update', onUpdate);

      const room = roomConns.get(docName);
      if (room) {
        room.delete(ws);
        // Remove this client from awareness
        awarenessProtocol.removeAwarenessStates(awareness, [clientID], null);

        // Track last-disconnect time for periodic sweep
        if (room.size === 0) {
          lastDisconnectTime.set(docName, Date.now());
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[YJS] WS error for ${userName}:`, err.message);
    });
  });

  console.log('[YJS] WebSocket server attached on /yjs/*');
  return wss;
}

module.exports = attachYjsServer;
