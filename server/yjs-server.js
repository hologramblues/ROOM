/**
 * Yjs WebSocket Server for ROOMS
 *
 * Runs alongside Socket.io on the same HTTP server using a separate path (/yjs).
 * Handles CRDT document sync, awareness (cursors), and MongoDB persistence.
 */
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { MongodbPersistence } = require('y-mongodb-provider');
const { User } = require('./models');

// Encoding utilities for Yjs WebSocket protocol
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const awarenessProtocol = require('y-protocols/awareness');
const syncProtocol = require('y-protocols/sync');

const messageSync = 0;
const messageAwareness = 1;

/**
 * Attach a Yjs WebSocket server to an existing HTTP server.
 * @param {http.Server} httpServer
 * @param {string} mongoUri - MongoDB connection URI
 * @param {string} jwtSecret - JWT secret for auth
 */
function attachYjsServer(httpServer, mongoUri, jwtSecret) {
  // MongoDB persistence for Yjs documents
  const mdb = new MongodbPersistence(mongoUri, {
    collectionName: 'yjs-documents',
    flushSize: 100,
    multipleCollections: false,
  });

  // In-memory Yjs documents (shared across all connections to the same room)
  const docs = new Map();
  // Track connections per room for cleanup
  const roomConnections = new Map();

  async function getYDoc(docName) {
    if (docs.has(docName)) return docs.get(docName);

    const ydoc = new Y.Doc();
    docs.set(docName, ydoc);

    // Load persisted state from MongoDB
    try {
      const persistedDoc = await mdb.getYDoc(docName);
      const persistedState = Y.encodeStateAsUpdate(persistedDoc);
      Y.applyUpdate(ydoc, persistedState);
      persistedDoc.destroy();
      console.log(`[YJS] Loaded doc ${docName} from MongoDB`);
    } catch (err) {
      console.warn(`[YJS] No persisted state for ${docName}:`, err.message);
    }

    // Persist future updates to MongoDB
    ydoc.on('update', (update, origin) => {
      // Don't persist updates that came from MongoDB (would cause loop)
      if (origin !== 'mongodb') {
        mdb.storeUpdate(docName, update).catch(err => {
          console.error(`[YJS] Failed to persist update for ${docName}:`, err.message);
        });
      }
    });

    return ydoc;
  }

  // Awareness instance per document (tracks cursors, user info)
  const awarenessMap = new Map();

  function getAwareness(docName, ydoc) {
    if (awarenessMap.has(docName)) return awarenessMap.get(docName);
    const awareness = new awarenessProtocol.Awareness(ydoc);
    awarenessMap.set(docName, awareness);
    return awareness;
  }

  // WebSocket server on /yjs path
  const wss = new WebSocketServer({ noServer: true });

  // Intercept HTTP upgrade for /yjs paths
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // Only handle /yjs/* paths — let Socket.io handle /socket.io/
    if (!url.pathname.startsWith('/yjs/')) return;

    // Extract doc ID and auth token
    const docName = url.pathname.replace('/yjs/', '');
    const token = url.searchParams.get('token');

    if (!token || !docName) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify JWT
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

  // Handle Yjs WebSocket connections
  wss.on('connection', async (ws, request) => {
    const docName = request.docName;
    const userName = request.userName || 'Unknown';
    const userColor = request.userColor || '#3b82f6';

    console.log(`[YJS] ${userName} connected to doc ${docName}`);

    const ydoc = await getYDoc(docName);
    const awareness = getAwareness(docName, ydoc);

    // Track this connection in the room
    if (!roomConnections.has(docName)) roomConnections.set(docName, new Set());
    roomConnections.get(docName).add(ws);

    // Send initial sync state
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, ydoc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness state
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder2 = encoding.createEncoder();
      encoding.writeVarUint(encoder2, messageAwareness);
      encoding.writeVarUint8Array(encoder2,
        awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
      );
      ws.send(encoding.toUint8Array(encoder2));
    }

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === messageSync) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, ydoc, null);
          const reply = encoding.toUint8Array(encoder);
          if (encoding.length(encoder) > 1) {
            ws.send(reply);
          }
          // Broadcast sync to other clients in the same room
          const update = encoding.toUint8Array(encoder);
          broadcastToRoom(docName, ws, message);
        } else if (messageType === messageAwareness) {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
          // Broadcast awareness to other clients
          broadcastToRoom(docName, ws, message);
        }
      } catch (err) {
        console.error('[YJS] Message error:', err.message);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      console.log(`[YJS] ${userName} disconnected from doc ${docName}`);
      const room = roomConnections.get(docName);
      if (room) {
        room.delete(ws);
        // Remove awareness state for this client
        awarenessProtocol.removeAwarenessStates(awareness, [ydoc.clientID], null);
        // Clean up empty rooms after delay
        if (room.size === 0) {
          setTimeout(() => {
            if (room.size === 0) {
              roomConnections.delete(docName);
              docs.delete(docName);
              awarenessMap.delete(docName);
              console.log(`[YJS] Cleaned up empty room ${docName}`);
            }
          }, 30000);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[YJS] WebSocket error for ${userName}:`, err.message);
    });
  });

  function broadcastToRoom(docName, sender, message) {
    const room = roomConnections.get(docName);
    if (!room) return;
    room.forEach(client => {
      if (client !== sender && client.readyState === 1) { // WebSocket.OPEN
        try { client.send(message); } catch (_) {}
      }
    });
  }

  console.log('[YJS] Yjs WebSocket server attached on /yjs/*');
  return wss;
}

module.exports = attachYjsServer;
