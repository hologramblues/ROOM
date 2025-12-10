const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { User, Document, HistoryEntry } = require('./models');
const { router: authRouter, authMiddleware, optionalAuthMiddleware, socketAuthMiddleware } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/screenplay-collab';
mongoose.connect(MONGODB_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/auth', authRouter);

app.get('/api/health', async (req, res) => {
  const docCount = await Document.countDocuments();
  const userCount = await User.countDocuments();
  res.json({ status: 'ok', documents: docCount, users: userCount });
});

function checkDocumentAccess(doc, user, requiredRole) {
  if (doc.publicAccess && doc.publicAccess.enabled) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    if (h[doc.publicAccess.role] >= h[requiredRole]) return true;
  }
  if (!user) return false;
  const ownerId = doc.ownerId._id ? doc.ownerId._id : doc.ownerId;
  if (ownerId.toString() === user._id.toString()) return true;
  const collab = doc.collaborators && doc.collaborators.find(c => c.userId && c.userId.toString() === user._id.toString());
  if (collab) { const h = { viewer: 0, commenter: 1, editor: 2 }; return h[collab.role] >= h[requiredRole]; }
  return false;
}

function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1', '#FF69B4', '#32CD32'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Create new document
app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    const shortId = uuidv4().slice(0, 8);
    const doc = new Document({ 
      shortId, 
      ownerId: req.user._id, 
      title: req.body.title || 'SANS TITRE',
      elements: req.body.elements || [{ id: uuidv4(), type: 'scene', content: '' }], 
      publicAccess: { enabled: true, role: 'editor' } 
    });
    await doc.save();
    await HistoryEntry.create({ documentId: doc._id, userId: req.user._id, userName: req.user.name, userColor: req.user.color, action: 'snapshot', data: { title: doc.title, elements: doc.elements } });
    console.log('Created document', shortId, 'with', doc.elements.length, 'elements');
    res.json({ id: doc.shortId, title: doc.title, elementsCount: doc.elements.length });
  } catch (error) { console.error('Create doc error:', error); res.status(500).json({ error: 'Erreur' }); }
});

// Import document (create with title and elements)
app.post('/api/documents/import', authMiddleware, async (req, res) => {
  try {
    const { title, elements } = req.body;
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Elements requis' });
    }
    
    const shortId = uuidv4().slice(0, 8);
    const doc = new Document({ 
      shortId, 
      ownerId: req.user._id, 
      title: title || 'SANS TITRE',
      elements: elements,
      publicAccess: { enabled: true, role: 'editor' } 
    });
    await doc.save();
    await HistoryEntry.create({ 
      documentId: doc._id, 
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      action: 'snapshot', 
      data: { title: doc.title, elements: doc.elements } 
    });
    
    console.log('Imported document', shortId, 'with', doc.elements.length, 'elements');
    res.json({ id: doc.shortId, title: doc.title, elementsCount: doc.elements.length });
  } catch (error) { 
    console.error('Import doc error:', error); 
    res.status(500).json({ error: 'Erreur import' }); 
  }
});

// Bulk save (update existing document)
app.put('/api/documents/:shortId/bulk', optionalAuthMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    if (!checkDocumentAccess(doc, req.user, 'editor')) return res.status(403).json({ error: 'Acces refuse' });
    
    if (req.body.title) doc.title = req.body.title;
    if (req.body.elements && Array.isArray(req.body.elements)) {
      doc.elements = req.body.elements;
      doc.markModified('elements');
    }
    await doc.save();
    
    // Notify all connected clients
    io.to(req.params.shortId).emit('document-restored', { title: doc.title, elements: doc.elements });
    
    console.log('Bulk saved document', req.params.shortId, 'with', doc.elements.length, 'elements');
    res.json({ success: true, elementsCount: doc.elements.length });
  } catch (error) { 
    console.error('Bulk save error:', error);
    res.status(500).json({ error: 'Erreur' }); 
  }
});

// Get user's documents
app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ $or: [{ ownerId: req.user._id }, { 'collaborators.userId': req.user._id }] }).select('shortId title updatedAt').sort({ updatedAt: -1 }).limit(50).lean();
    res.json({ documents: docs });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Get single document
app.get('/api/documents/:shortId', optionalAuthMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId }).lean();
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    if (!checkDocumentAccess(doc, req.user, 'viewer')) return res.status(403).json({ error: 'Acces refuse' });
    console.log('Fetched document', req.params.shortId, 'with', doc.elements?.length, 'elements');
    res.json({ 
      id: doc.shortId, 
      title: doc.title, 
      elements: doc.elements, 
      characters: doc.characters, 
      locations: doc.locations, 
      comments: doc.comments, 
      isOwner: req.user && doc.ownerId.toString() === req.user._id.toString(), 
      publicAccess: doc.publicAccess 
    });
  } catch (error) { console.error('Get doc error:', error); res.status(500).json({ error: 'Erreur' }); }
});

// Get document history
app.get('/api/documents/:shortId/history', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId }).lean();
    if (!doc || !checkDocumentAccess(doc, req.user, 'viewer')) return res.status(403).json({ error: 'Acces refuse' });
    const history = await HistoryEntry.find({ documentId: doc._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json({ history });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Restore from history
app.post('/api/documents/:shortId/restore/:historyId', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'editor')) return res.status(403).json({ error: 'Acces refuse' });
    const entry = await HistoryEntry.findById(req.params.historyId).lean();
    if (!entry || entry.action !== 'snapshot') return res.status(404).json({ error: 'Snapshot non trouve' });
    await HistoryEntry.create({ documentId: doc._id, userId: req.user._id, userName: req.user.name, userColor: req.user.color, action: 'snapshot', data: { title: doc.title, elements: doc.elements } });
    doc.title = entry.data.title; doc.elements = entry.data.elements; await doc.save();
    io.to(req.params.shortId).emit('document-restored', { title: doc.title, elements: doc.elements });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Add comment
app.post('/api/documents/:shortId/comments', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'commenter')) return res.status(403).json({ error: 'Acces refuse' });
    const comment = { id: uuidv4(), elementId: req.body.elementId, userId: req.user._id, userName: req.user.name, userColor: req.user.color, content: req.body.content, createdAt: new Date(), replies: [] };
    doc.comments.push(comment); await doc.save();
    io.to(req.params.shortId).emit('comment-added', { comment });
    res.json({ comment });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Add reply to comment
app.post('/api/documents/:shortId/comments/:commentId/replies', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'commenter')) return res.status(403).json({ error: 'Acces refuse' });
    const comment = doc.comments.find(c => c.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire non trouve' });
    const reply = { id: uuidv4(), userId: req.user._id, userName: req.user.name, userColor: req.user.color, content: req.body.content, createdAt: new Date() };
    comment.replies.push(reply); await doc.save();
    io.to(req.params.shortId).emit('comment-reply-added', { commentId: req.params.commentId, reply });
    res.json({ reply });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Toggle comment resolved
app.put('/api/documents/:shortId/comments/:commentId/resolve', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Non trouve' });
    const comment = doc.comments.find(c => c.id === req.params.commentId);
    if (comment) { comment.resolved = !comment.resolved; await doc.save(); io.to(req.params.shortId).emit('comment-resolved', { commentId: req.params.commentId, resolved: comment.resolved }); }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Socket.io
const activeRooms = new Map();
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentDocId = null;

  socket.on('join-document', async ({ docId }) => {
    try {
      if (currentDocId) { 
        const room = activeRooms.get(currentDocId); 
        if (room) { 
          room.delete(socket.id); 
          socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) }); 
        } 
        socket.leave(currentDocId); 
      }
      
      const doc = await Document.findOne({ shortId: docId }).lean();
      if (!doc) return socket.emit('error', { message: 'Document non trouve' });
      if (!checkDocumentAccess(doc, socket.user, 'viewer')) return socket.emit('error', { message: 'Acces refuse' });
      
      // Add user as collaborator if not already (so doc appears in their list)
      if (socket.user) {
        const ownerId = doc.ownerId._id ? doc.ownerId._id.toString() : doc.ownerId.toString();
        const isOwner = ownerId === socket.user._id.toString();
        const isCollab = doc.collaborators?.find(c => c.userId?.toString() === socket.user._id.toString());
        if (!isOwner && !isCollab) {
          const collabRole = doc.publicAccess?.role || 'viewer';
          await Document.updateOne(
            { shortId: docId },
            { $push: { collaborators: { userId: socket.user._id, role: collabRole } } }
          );
          console.log('Added', socket.user.name, 'as collaborator with role', collabRole);
        }
      }
      
      let role = 'viewer';
      if (socket.user) { 
        const ownerId = doc.ownerId._id ? doc.ownerId._id.toString() : doc.ownerId.toString();
        if (ownerId === socket.user._id.toString()) role = 'editor'; 
        else { 
          const c = doc.collaborators && doc.collaborators.find(c => c.userId && c.userId.toString() === socket.user._id.toString()); 
          if (c) role = c.role; 
        } 
      }
      if (doc.publicAccess && doc.publicAccess.enabled && doc.publicAccess.role === 'editor') role = 'editor';
      
      currentDocId = docId; 
      socket.join(docId);
      
      if (!activeRooms.has(docId)) activeRooms.set(docId, new Map());
      const userInfo = { id: socket.id, name: socket.user?.name || 'Anonyme-' + socket.id.slice(0,4), color: socket.user?.color || getRandomColor(), role, cursor: null };
      activeRooms.get(docId).set(socket.id, userInfo);
      
      // Send only users and role, document is loaded via REST API
      socket.emit('document-state', { 
        id: doc.shortId, 
        users: Array.from(activeRooms.get(docId).values()), 
        role 
      });
      
      socket.to(docId).emit('user-joined', { user: userInfo, users: Array.from(activeRooms.get(docId).values()) });
      console.log(userInfo.name, 'joined document', docId);
    } catch (error) { console.error('Join error:', error); }
  });

  socket.on('title-change', async ({ title }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      doc.title = title; await doc.save();
      socket.to(currentDocId).emit('title-updated', { title });
    } catch (error) { console.error('Title error:', error); }
  });

  socket.on('element-change', async ({ index, element }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      if (index >= 0 && index < doc.elements.length) {
        doc.elements[index] = element; doc.markModified('elements'); await doc.save();
        socket.to(currentDocId).emit('element-updated', { index, element });
      }
    } catch (error) { console.error('Element error:', error); }
  });

  socket.on('element-type-change', async ({ index, type }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      if (index >= 0 && index < doc.elements.length) {
        doc.elements[index].type = type; doc.markModified('elements'); await doc.save();
        socket.to(currentDocId).emit('element-type-updated', { index, type });
      }
    } catch (error) { console.error('Type error:', error); }
  });

  socket.on('element-insert', async ({ afterIndex, element }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      doc.elements.splice(afterIndex + 1, 0, element); doc.markModified('elements'); await doc.save();
      socket.to(currentDocId).emit('element-inserted', { afterIndex, element });
    } catch (error) { console.error('Insert error:', error); }
  });

  socket.on('element-delete', async ({ index }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      if (doc.elements.length > 1) {
        doc.elements.splice(index, 1); doc.markModified('elements'); await doc.save();
        socket.to(currentDocId).emit('element-deleted', { index });
      }
    } catch (error) { console.error('Delete error:', error); }
  });

  socket.on('cursor-move', ({ index, position }) => {
    if (!currentDocId) return;
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
    console.log('User disconnected:', socket.id);
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
