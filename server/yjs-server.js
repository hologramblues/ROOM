/**
 * Yjs WebSocket Server for ROOMS
 *
 * Runs alongside Socket.io on the same HTTP server using /yjs path.
 * Uses lib0/y-protocols for correct Yjs sync protocol implementation.
 */
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { MongodbPersistence } = require('y-mongodb-provider');

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
      mdb.storeUpdate(docName, update).catch(err => {
        console.error(`[YJS] Persist error for "${docName}":`, err.message);
      });
    });

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
    console.log(`[YJS] ${userName} connected to "${docName}"`);

    const ydoc = await getYDoc(docName);
    const awareness = getAwareness(docName, ydoc);

    // Track this connection with a unique client ID
    const clientID = ydoc.clientID + Math.floor(Math.random() * 1000000);
    if (!roomConns.has(docName)) roomConns.set(docName, new Map());
    roomConns.get(docName).set(ws, { ws, clientID });

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

        // Clean up empty rooms after 30s
        if (room.size === 0) {
          setTimeout(() => {
            const r = roomConns.get(docName);
            if (!r || r.size === 0) {
              roomConns.delete(docName);
              const d = docs.get(docName);
              if (d) { d.destroy(); docs.delete(docName); }
              awarenessMap.delete(docName);
              console.log(`[YJS] Cleaned up room "${docName}"`);
            }
          }, 30000);
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
