// electron/local-server.js — Embedded Express + Socket.io server for ROOMS Desktop
// Fork of server/server.js adapted for SQLite (no MongoDB, no auth, no waitlist, no AI)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Document, HistoryEntry, User } = require('./local-models');
const { authMiddleware, optionalAuthMiddleware, socketAuthMiddleware } = require('./local-auth');

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // ============ HEALTH ============

    app.get('/api/health', async (req, res) => {
      try {
        const docCount = await Document.countDocuments();
        res.json({ status: 'ok', documents: docCount, users: 1, waitlist: 0, aiEnabled: false, desktop: true });
      } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({ status: 'error', error: 'Database unavailable' });
      }
    });

    // ============ HELPER FUNCTIONS ============

    // In desktop mode: access is always granted
    function checkDocumentAccess(doc, user, requiredRole) {
      return true;
    }

    function getRandomColor() {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    // ============ SOCKET RATE LIMITING ============

    const socketRates = new Map(); // socketId -> { count, resetAt }
    const SOCKET_RATE_LIMIT = 100; // events per second
    const SOCKET_RATE_WINDOW = 1000; // 1 second

    function checkSocketRate(socketId) {
      const now = Date.now();
      let entry = socketRates.get(socketId);
      if (!entry || now >= entry.resetAt) {
        entry = { count: 1, resetAt: now + SOCKET_RATE_WINDOW };
        socketRates.set(socketId, entry);
        return true;
      }
      entry.count++;
      return entry.count <= SOCKET_RATE_LIMIT;
    }

    // Cleanup stale rate entries every 60s
    const rateCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of socketRates) {
        if (now >= entry.resetAt) socketRates.delete(id);
      }
    }, 60000);

    server.on('close', () => clearInterval(rateCleanupInterval));

    // ============ INPUT VALIDATION ============

    const VALID_ELEMENT_TYPES = new Set(['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition']);
    const MAX_CONTENT_LENGTH = 50000;

    function validateElement(element) {
      if (!element || typeof element.id !== 'string') return false;
      if (element.type && !VALID_ELEMENT_TYPES.has(element.type)) return false;
      if (element.content !== undefined && (typeof element.content !== 'string' || element.content.length > MAX_CONTENT_LENGTH)) return false;
      return true;
    }

    // ============ DOCUMENT ROUTES ============

    app.post('/api/documents', authMiddleware, async (req, res) => {
      try {
        const shortId = uuidv4().slice(0, 8);
        const doc = await Document.create({
          shortId,
          title: req.body.title || 'SANS TITRE',
          elements: req.body.elements || [{ id: uuidv4(), type: 'scene', content: '' }],
        });
        await HistoryEntry.create({
          documentId: doc.id,
          userName: req.user.name,
          userColor: req.user.color,
          action: 'snapshot',
          data: { title: doc.title, elements: doc.elements },
        });
        console.log('[LOCAL] Created document', shortId, 'with', doc.elements.length, 'elements');
        res.json({ id: doc.shortId, title: doc.title, elementsCount: doc.elements.length });
      } catch (error) {
        console.error('Create doc error:', error);
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Import document
    app.post('/api/documents/import', authMiddleware, async (req, res) => {
      try {
        const { title, elements } = req.body;
        if (!elements || !Array.isArray(elements) || elements.length === 0) {
          return res.status(400).json({ error: 'Elements requis' });
        }
        const shortId = uuidv4().slice(0, 8);
        const doc = await Document.create({ shortId, title: title || 'SANS TITRE', elements });
        await HistoryEntry.create({
          documentId: doc.id,
          userName: req.user.name,
          userColor: req.user.color,
          action: 'snapshot',
          data: { title: doc.title, elements: doc.elements },
        });
        console.log('[LOCAL] Imported document', shortId, 'with', doc.elements.length, 'elements');
        res.json({ id: doc.shortId, title: doc.title, elementsCount: doc.elements.length });
      } catch (error) {
        console.error('Import doc error:', error);
        res.status(500).json({ error: 'Erreur import' });
      }
    });

    // Bulk save
    app.put('/api/documents/:shortId/bulk', optionalAuthMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });

        if (req.body.title) doc.title = req.body.title;
        if (req.body.elements && Array.isArray(req.body.elements)) {
          doc.elements = req.body.elements;
        }
        if (req.body.beatCards !== undefined) doc.beatCards = req.body.beatCards;
        if (req.body.structureBeats !== undefined) doc.structureBeats = req.body.structureBeats;
        if (req.body.sceneSynopsis !== undefined) doc.sceneSynopsis = req.body.sceneSynopsis;
        if (req.body.sceneStatus !== undefined) doc.sceneStatus = req.body.sceneStatus;
        if (req.body.whiteboardElements !== undefined) doc.whiteboardElements = req.body.whiteboardElements;

        await doc.save();

        io.to(req.params.shortId).emit('document-restored', {
          title: doc.title, elements: doc.elements,
          beatCards: doc.beatCards, structureBeats: doc.structureBeats,
          sceneSynopsis: doc.sceneSynopsis, sceneStatus: doc.sceneStatus,
          whiteboardElements: doc.whiteboardElements,
        });

        console.log('[LOCAL] Bulk saved', req.params.shortId, 'with', doc.elements.length, 'elements');
        res.json({ success: true, elementsCount: doc.elements.length });
      } catch (error) {
        console.error('Bulk save error:', error);
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Autosave
    app.put('/api/documents/:shortId/autosave', optionalAuthMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });

        if (req.body.title) doc.title = req.body.title;
        if (req.body.elements && Array.isArray(req.body.elements)) doc.elements = req.body.elements;
        if (req.body.beatCards !== undefined) doc.beatCards = req.body.beatCards;
        if (req.body.structureBeats !== undefined) doc.structureBeats = req.body.structureBeats;
        if (req.body.sceneSynopsis !== undefined) doc.sceneSynopsis = req.body.sceneSynopsis;
        if (req.body.sceneStatus !== undefined) doc.sceneStatus = req.body.sceneStatus;
        if (req.body.whiteboardElements !== undefined) doc.whiteboardElements = req.body.whiteboardElements;

        await doc.save();
        res.json({ success: true, savedAt: new Date().toISOString() });
      } catch (error) {
        console.error('Autosave error:', error);
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Snapshot
    app.post('/api/documents/:shortId/snapshot', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });

        if (req.body.title) doc.title = req.body.title;
        if (req.body.elements && Array.isArray(req.body.elements)) doc.elements = req.body.elements;
        if (req.body.beatCards !== undefined) doc.beatCards = req.body.beatCards;
        if (req.body.structureBeats !== undefined) doc.structureBeats = req.body.structureBeats;
        if (req.body.sceneSynopsis !== undefined) doc.sceneSynopsis = req.body.sceneSynopsis;
        if (req.body.sceneStatus !== undefined) doc.sceneStatus = req.body.sceneStatus;
        if (req.body.whiteboardElements !== undefined) doc.whiteboardElements = req.body.whiteboardElements;

        await doc.save();

        const isAuto = req.body.auto === true;
        await HistoryEntry.create({
          documentId: doc.id,
          userName: req.user.name,
          userColor: req.user.color,
          action: 'snapshot',
          snapshotName: isAuto ? `Auto-save ${new Date().toLocaleString('fr-FR')}` : (req.body.snapshotName || null),
          data: {
            title: doc.title, elements: doc.elements,
            beatCards: doc.beatCards, structureBeats: doc.structureBeats,
            sceneSynopsis: doc.sceneSynopsis, sceneStatus: doc.sceneStatus,
            whiteboardElements: doc.whiteboardElements,
          },
        });

        console.log(isAuto ? '[AUTO-SNAPSHOT]' : '[SNAPSHOT]', 'Created for', req.params.shortId);
        res.json({ success: true, createdAt: new Date().toISOString(), auto: isAuto });
      } catch (error) {
        console.error('Snapshot error:', error);
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // List documents
    app.get('/api/documents', authMiddleware, async (req, res) => {
      try {
        const docs = await Document.find().sort({ updatedAt: -1 }).limit(50);
        const documents = docs.map(d => ({ shortId: d.shortId, title: d.title, updatedAt: d.updatedAt }));
        res.json({ documents });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Document meta (for conflict detection)
    app.get('/api/documents/:shortId/meta', optionalAuthMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        res.json({ updatedAt: doc.updatedAt, title: doc.title });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Get document
    app.get('/api/documents/:shortId', optionalAuthMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        res.json({
          id: doc.shortId,
          title: doc.title,
          elements: doc.elements,
          characters: doc.characters,
          locations: doc.locations,
          comments: doc.comments,
          suggestions: doc.suggestions || [],
          beatCards: doc.beatCards || [],
          structureBeats: doc.structureBeats || [],
          sceneSynopsis: doc.sceneSynopsis || {},
          sceneStatus: doc.sceneStatus || {},
          whiteboardElements: doc.whiteboardElements || [],
          isOwner: true,
          publicAccess: { enabled: false, role: 'viewer' },
        });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Public access settings (no-op in desktop)
    app.put('/api/documents/:shortId/public-access', authMiddleware, async (req, res) => {
      res.json({ publicAccess: { enabled: false, role: 'viewer' } });
    });

    // History
    app.get('/api/documents/:shortId/history', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const history = await HistoryEntry.find({ documentId: doc.id }).sort({ createdAt: -1 }).limit(50);
        res.json({ history });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // Restore
    app.post('/api/documents/:shortId/restore/:historyId', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const entry = await HistoryEntry.findById(req.params.historyId);
        if (!entry || entry.action !== 'snapshot') return res.status(404).json({ error: 'Snapshot non trouve' });

        // Save current state before restoring
        await HistoryEntry.create({
          documentId: doc.id,
          userName: req.user.name,
          userColor: req.user.color,
          action: 'snapshot',
          snapshotName: `Before restore - ${new Date().toLocaleString('fr-FR')}`,
          data: {
            title: doc.title, elements: doc.elements,
            beatCards: doc.beatCards, structureBeats: doc.structureBeats,
            sceneSynopsis: doc.sceneSynopsis, sceneStatus: doc.sceneStatus,
            whiteboardElements: doc.whiteboardElements,
          },
        });

        // Restore
        doc.title = entry.data.title;
        doc.elements = entry.data.elements;
        if (entry.data.beatCards) doc.beatCards = entry.data.beatCards;
        if (entry.data.structureBeats) doc.structureBeats = entry.data.structureBeats;
        if (entry.data.sceneSynopsis) doc.sceneSynopsis = entry.data.sceneSynopsis;
        if (entry.data.sceneStatus) doc.sceneStatus = entry.data.sceneStatus;
        if (entry.data.whiteboardElements) doc.whiteboardElements = entry.data.whiteboardElements;

        await doc.save();

        io.to(req.params.shortId).emit('document-restored', {
          title: doc.title, elements: doc.elements,
          beatCards: doc.beatCards, structureBeats: doc.structureBeats,
          sceneSynopsis: doc.sceneSynopsis, sceneStatus: doc.sceneStatus,
          whiteboardElements: doc.whiteboardElements,
        });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // ============ COMMENT ROUTES ============

    app.post('/api/documents/:shortId/comments', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const comment = {
          id: uuidv4(),
          elementId: req.body.elementId,
          elementIndex: req.body.elementIndex,
          highlight: req.body.highlight || null,
          spans: req.body.spans || null,
          userId: req.user._id,
          userName: req.user.name,
          userColor: req.user.color,
          content: req.body.content,
          createdAt: new Date().toISOString(),
          replies: [],
          resolved: false,
        };
        doc.comments.push(comment);
        await doc.save();
        io.to(req.params.shortId).emit('comment-added', { comment });
        res.json({ comment });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    app.post('/api/documents/:shortId/comments/:commentId/replies', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const comment = doc.comments.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Commentaire non trouve' });
        const reply = {
          id: uuidv4(),
          userId: req.user._id,
          userName: req.user.name,
          userColor: req.user.color,
          content: req.body.content,
          createdAt: new Date().toISOString(),
        };
        comment.replies.push(reply);
        await doc.save();
        io.to(req.params.shortId).emit('comment-reply-added', { commentId: req.params.commentId, reply });
        res.json({ reply });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    app.delete('/api/documents/:shortId/comments/:commentId', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const idx = doc.comments.findIndex(c => c.id === req.params.commentId);
        if (idx === -1) return res.status(404).json({ error: 'Commentaire non trouve' });
        doc.comments.splice(idx, 1);
        await doc.save();
        io.to(req.params.shortId).emit('comment-deleted', { commentId: req.params.commentId });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    app.put('/api/documents/:shortId/comments/:commentId/resolve', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Non trouve' });
        const comment = doc.comments.find(c => c.id === req.params.commentId);
        if (comment) {
          comment.resolved = !comment.resolved;
          await doc.save();
          io.to(req.params.shortId).emit('comment-resolved', { commentId: req.params.commentId, resolved: comment.resolved });
        }
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    app.put('/api/documents/:shortId/comments/:commentId', authMiddleware, async (req, res) => {
      try {
        const doc = await Document.findOne({ shortId: req.params.shortId });
        if (!doc) return res.status(404).json({ error: 'Document non trouve' });
        const comment = doc.comments.find(c => c.id === req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Commentaire non trouve' });
        comment.content = req.body.content;
        comment.editedAt = new Date().toISOString();
        await doc.save();
        io.to(req.params.shortId).emit('comment-updated', { commentId: req.params.commentId, content: req.body.content });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Erreur' });
      }
    });

    // ============ AUTH STUBS (desktop: always return local user) ============

    app.post('/api/auth/login', (req, res) => {
      res.json({
        user: { id: 'local-user', email: 'local@rooms.desktop', name: 'Moi', color: '#4ECDC4' },
        token: 'local',
      });
    });

    app.post('/api/auth/register', (req, res) => {
      res.json({
        user: { id: 'local-user', email: 'local@rooms.desktop', name: 'Moi', color: '#4ECDC4' },
        token: 'local',
      });
    });

    app.get('/api/auth/me', (req, res) => {
      res.json({
        user: { id: 'local-user', email: 'local@rooms.desktop', name: 'Moi', color: '#4ECDC4' },
      });
    });

    // ============ SOCKET.IO ============

    const activeRooms = new Map();
    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
      console.log('[LOCAL] Socket connected:', socket.id);
      let currentDocId = null;

      // In desktop mode, always editor
      const canWrite = () => true;
      const canComment = () => true;

      socket.on('join-document', async ({ docId }) => {
        if (!checkSocketRate(socket.id)) return;
        try {
          if (currentDocId) {
            const room = activeRooms.get(currentDocId);
            if (room) {
              room.delete(socket.id);
              socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) });
            }
            socket.leave(currentDocId);
          }

          const doc = await Document.findOne({ shortId: docId });
          if (!doc) return socket.emit('error', { message: 'Document non trouve' });

          currentDocId = docId;
          socket.join(docId);

          if (!activeRooms.has(docId)) activeRooms.set(docId, new Map());
          const userInfo = {
            id: socket.id,
            name: socket.user?.name || 'Moi',
            color: socket.user?.color || '#4ECDC4',
            role: 'editor',
            cursor: null,
          };
          activeRooms.get(docId).set(socket.id, userInfo);

          socket.emit('document-state', {
            id: doc.shortId,
            title: doc.title,
            elements: doc.elements,
            characters: doc.characters,
            locations: doc.locations,
            comments: doc.comments,
            suggestions: doc.suggestions || [],
            users: Array.from(activeRooms.get(docId).values()),
            role: 'editor',
            collaborators: [{ userId: 'local-user', name: 'Moi', color: '#4ECDC4', role: 'owner' }],
          });

          socket.to(docId).emit('user-joined', { user: userInfo, users: Array.from(activeRooms.get(docId).values()) });
        } catch (error) {
          console.error('Join error:', error);
        }
      });

      socket.on('title-change', async ({ title }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        if (typeof title !== 'string' || title.length > 200) return;
        try {
          const doc = await Document.findOne({ shortId: currentDocId });
          if (!doc) return;
          doc.title = title;
          await doc.save();
          socket.to(currentDocId).emit('title-updated', { title });
        } catch (error) {
          console.error('Title error:', error);
        }
      });

      socket.on('element-change', async ({ index, element }) => {
        if (!currentDocId || !element?.id || !checkSocketRate(socket.id)) return;
        if (!validateElement(element)) return;
        try {
          await Document.updateOne(
            { shortId: currentDocId, 'elements.id': element.id },
            { $set: { 'elements.$': element } }
          );
          socket.to(currentDocId).emit('element-updated', { index, element });
        } catch (error) {
          console.error('Element error:', error);
        }
      });

      socket.on('element-type-change', async ({ index, type, elementId }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        if (type && !VALID_ELEMENT_TYPES.has(type)) return;
        try {
          if (elementId) {
            await Document.updateOne(
              { shortId: currentDocId, 'elements.id': elementId },
              { $set: { 'elements.$.type': type } }
            );
          }
          socket.to(currentDocId).emit('element-type-updated', { index, type, elementId });
        } catch (error) {
          console.error('Type error:', error);
        }
      });

      socket.on('element-insert', async ({ afterIndex, afterElementId, element }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        if (!validateElement(element)) return;
        try {
          if (afterElementId) {
            const doc = await Document.findOne({ shortId: currentDocId });
            if (!doc) return;
            const pos = doc.elements.findIndex(el => el.id === afterElementId);
            const insertPos = pos >= 0 ? pos + 1 : doc.elements.length;
            await Document.updateOne(
              { shortId: currentDocId },
              { $push: { elements: { $each: [element], $position: insertPos } } }
            );
          } else {
            await Document.updateOne(
              { shortId: currentDocId },
              { $push: { elements: { $each: [element], $position: afterIndex + 1 } } }
            );
          }
          socket.to(currentDocId).emit('element-inserted', { afterIndex, afterElementId, element });
        } catch (error) {
          console.error('Insert error:', error);
        }
      });

      socket.on('element-delete', async ({ index, elementId }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        try {
          let targetId = elementId;
          if (!targetId) {
            const doc = await Document.findOne({ shortId: currentDocId });
            if (!doc || doc.elements.length <= 1 || index < 0 || index >= doc.elements.length) return;
            targetId = doc.elements[index]?.id;
          }
          if (!targetId) return;
          await Document.updateOne(
            { shortId: currentDocId },
            { $pull: { elements: { id: targetId } } }
          );
          socket.to(currentDocId).emit('element-deleted', { index, elementId: targetId });
        } catch (error) {
          console.error('Delete error:', error);
        }
      });

      // Comment socket handlers
      socket.on('comment-add', async ({ comment }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        try {
          const newComment = {
            id: comment.id,
            elementId: comment.elementId,
            elementIndex: comment.elementIndex,
            highlight: comment.highlight || null,
            spans: comment.spans || null,
            userId: 'local-user',
            userName: comment.userName || 'Moi',
            userColor: comment.userColor || '#4ECDC4',
            content: comment.content,
            createdAt: new Date().toISOString(),
            replies: [],
            resolved: false,
          };
          await Document.findOneAndUpdate(
            { shortId: currentDocId },
            { $push: { comments: newComment } },
            { new: false }
          );
          socket.to(currentDocId).emit('comment-added', { comment: newComment });
        } catch (error) {
          console.error('Comment add error:', error);
        }
      });

      // Suggestion socket handlers
      socket.on('suggestion-add', async ({ suggestion }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        try {
          const newSuggestion = {
            id: suggestion.id,
            elementId: suggestion.elementId,
            elementIndex: suggestion.elementIndex,
            originalText: suggestion.originalText,
            suggestedText: suggestion.suggestedText,
            startOffset: suggestion.startOffset,
            endOffset: suggestion.endOffset,
            userId: 'local-user',
            userName: suggestion.userName || 'Moi',
            userColor: suggestion.userColor || '#10b981',
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          await Document.findOneAndUpdate(
            { shortId: currentDocId },
            { $push: { suggestions: newSuggestion } },
            { new: false }
          );
          socket.to(currentDocId).emit('suggestion-added', { suggestion: newSuggestion });
        } catch (error) {
          console.error('Suggestion add error:', error);
        }
      });

      socket.on('suggestion-accept', async ({ suggestionId }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        try {
          // Atomically remove suggestion (prevents double-accept race)
          const pullResult = await Document.findOneAndUpdate(
            { shortId: currentDocId, 'suggestions.id': suggestionId },
            { $pull: { suggestions: { id: suggestionId } } },
            { new: false } // return doc BEFORE pull so we can read the suggestion
          );
          if (!pullResult) return;

          const suggestion = pullResult.suggestions?.find(s => s.id === suggestionId);
          if (!suggestion) return; // already removed

          // Apply the text change
          const elementIndex = pullResult.elements.findIndex(el => el.id === suggestion.elementId);
          if (elementIndex !== -1) {
            const element = pullResult.elements[elementIndex];
            const content = element.content || '';

            if (suggestion.startOffset >= 0 && suggestion.endOffset <= content.length &&
                suggestion.startOffset < suggestion.endOffset) {
              const currentSlice = content.substring(suggestion.startOffset, suggestion.endOffset);
              if (currentSlice === suggestion.originalText) {
                const newContent =
                  content.substring(0, suggestion.startOffset) +
                  suggestion.suggestedText +
                  content.substring(suggestion.endOffset);
                await Document.updateOne(
                  { shortId: currentDocId, 'elements.id': suggestion.elementId },
                  { $set: { 'elements.$.content': newContent } }
                );
                const updatedElement = { ...element, content: newContent };
                socket.to(currentDocId).emit('element-updated', { index: elementIndex, element: updatedElement });
              }
            }
          }

          io.to(currentDocId).emit('suggestion-accepted', { suggestionId });
        } catch (error) {
          console.error('Suggestion accept error:', error);
        }
      });

      socket.on('suggestion-reject', async ({ suggestionId }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        try {
          // Atomically remove suggestion
          const result = await Document.findOneAndUpdate(
            { shortId: currentDocId, 'suggestions.id': suggestionId },
            { $pull: { suggestions: { id: suggestionId } } },
            { new: true }
          );
          if (!result) return;

          io.to(currentDocId).emit('suggestion-rejected', { suggestionId });
        } catch (error) {
          console.error('Suggestion reject error:', error);
        }
      });

      // Full sync (undo/redo/drag)
      socket.on('full-sync', async ({ elements }) => {
        if (!currentDocId || !elements || !Array.isArray(elements) || !checkSocketRate(socket.id)) return;
        try {
          const doc = await Document.findOne({ shortId: currentDocId });
          if (!doc) return;
          doc.elements = elements;
          await doc.save();
          socket.to(currentDocId).emit('full-sync-applied', { elements });
        } catch (err) {
          console.error('[FULL-SYNC] Error:', err);
        }
      });

      // Chat
      socket.on('chat-message', ({ docId, message }) => {
        if (!currentDocId || currentDocId !== docId || !checkSocketRate(socket.id)) return;
        if (!message || typeof message.text !== 'string' || message.text.length > 5000) return;
        if (typeof message.userName !== 'string' || message.userName.length > 100) return;
        socket.to(currentDocId).emit('chat-message', message);
      });

      // Cursor
      socket.on('cursor-move', ({ index, position }) => {
        if (!currentDocId || !checkSocketRate(socket.id)) return;
        const room = activeRooms.get(currentDocId);
        if (room) {
          const user = room.get(socket.id);
          if (user) {
            user.cursor = { index, position };
            socket.to(currentDocId).emit('cursor-updated', { userId: socket.id, cursor: { index, position } });
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('[LOCAL] Socket disconnected:', socket.id);
        if (currentDocId) {
          const room = activeRooms.get(currentDocId);
          if (room) {
            room.delete(socket.id);
            if (room.size === 0) activeRooms.delete(currentDocId);
            else socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) });
          }
        }
      });
    });

    // ============ START ON DYNAMIC PORT ============

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[LOCAL] Server running on http://127.0.0.1:${port}`);
      resolve({ server, port, io });
    });

    server.on('error', (err) => {
      console.error('[LOCAL] Server error:', err);
      reject(err);
    });
  });
}

module.exports = { startLocalServer };
