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
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/screenplay-collab';
mongoose.connect(MONGODB_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);

app.get('/api/health', async (req, res) => {
  const docCount = await Document.countDocuments();
  const userCount = await User.countDocuments();
  res.json({ status: 'ok', documents: docCount, users: userCount });
});

function checkDocumentAccess(doc, user, requiredRole) {
  if (doc.publicAccess.enabled) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    if (h[doc.publicAccess.role] >= h[requiredRole]) return true;
  }
  if (!user) return false;
  if (doc.ownerId.equals(user._id)) return true;
  const collab = doc.collaborators.find(c => c.userId.equals(user._id));
  if (collab) { const h = { viewer: 0, commenter: 1, editor: 2 }; return h[collab.role] >= h[requiredRole]; }
  return false;
}

function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}

app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    const shortId = uuidv4().slice(0, 8);
    const doc = new Document({ shortId, ownerId: req.user._id, elements: [{ id: uuidv4(), type: 'scene', content: '' }], publicAccess: { enabled: true, role: 'editor' } });
    await doc.save();
    await HistoryEntry.create({ documentId: doc._id, userId: req.user._id, userName: req.user.name, userColor: req.user.color, action: 'snapshot', data: { title: doc.title, elements: doc.elements } });
    res.json({ id: doc.shortId, url: '/doc/' + doc.shortId });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ $or: [{ ownerId: req.user._id }, { 'collaborators.userId': req.user._id }] }).select('shortId title updatedAt').sort({ updatedAt: -1 }).limit(50);
    res.json({ documents: docs });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.get('/api/documents/:shortId', optionalAuthMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    if (!checkDocumentAccess(doc, req.user, 'viewer')) return res.status(403).json({ error: 'Acces refuse' });
    res.json({ id: doc.shortId, title: doc.title, elements: doc.elements, characters: doc.characters, locations: doc.locations, comments: doc.comments, isOwner: req.user && doc.ownerId.equals(req.user._id), publicAccess: doc.publicAccess });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.get('/api/documents/:shortId/history', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'viewer')) return res.status(403).json({ error: 'Acces refuse' });
    const history = await HistoryEntry.find({ documentId: doc._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ history });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.post('/api/documents/:shortId/restore/:historyId', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'editor')) return res.status(403).json({ error: 'Acces refuse' });
    const entry = await HistoryEntry.findById(req.params.historyId);
    if (!entry || entry.action !== 'snapshot') return res.status(404).json({ error: 'Snapshot non trouve' });
    await HistoryEntry.create({ documentId: doc._id, userId: req.user._id, userName: req.user.name, userColor: req.user.color, action: 'snapshot', data: { title: doc.title, elements: doc.elements } });
    doc.title = entry.data.title; doc.elements = entry.data.elements; await doc.save();
    io.to(req.params.shortId).emit('document-restored', { title: doc.title, elements: doc.elements });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

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

app.put('/api/documents/:shortId/comments/:commentId/resolve', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Non trouve' });
    const comment = doc.comments.find(c => c.id === req.params.commentId);
    if (comment) { comment.resolved = !comment.resolved; await doc.save(); io.to(req.params.shortId).emit('comment-resolved', { commentId: req.params.commentId, resolved: comment.resolved }); }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

const activeRooms = new Map();
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentDocId = null;

  socket.on('join-document', async ({ docId }) => {
    try {
      if (currentDocId) { const room = activeRooms.get(currentDocId); if (room) { room.delete(socket.id); socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) }); } socket.leave(currentDocId); }
      const doc = await Document.findOne({ shortId: docId });
      if (!doc) return socket.emit('error', { message: 'Document non trouve' });
      if (!checkDocumentAccess(doc, socket.user, 'viewer')) return socket.emit('error', { message: 'Acces refuse' });
      let role = 'viewer';
      if (socket.user) { if (doc.ownerId.equals(socket.user._id)) role = 'editor'; else { const c = doc.collaborators.find(c => c.userId.equals(socket.user._id)); if (c) role = c.role; } }
      if (doc.publicAccess.enabled && doc.publicAccess.role === 'editor') role = 'editor';
      
      // Add user to collaborators if authenticated and not already in list
      if (socket.user && !doc.collaborators.find(c => c.userId.equals(socket.user._id)) && !doc.ownerId.equals(socket.user._id)) {
        doc.collaborators.push({ userId: socket.user._id, role: role });
        doc.markModified('collaborators');
        await doc.save();
        console.log('Added collaborator:', socket.user.name);
      }
      
      // Build full collaborators list (owner + collaborators) for client
      const owner = await User.findById(doc.ownerId).select('name color');
      const allCollaborators = [];
      if (owner) {
        allCollaborators.push({ name: owner.name, color: owner.color || '#3b82f6', isOwner: true });
      }
      for (const collab of doc.collaborators) {
        try {
          const user = await User.findById(collab.userId).select('name color');
          if (user && !allCollaborators.find(c => c.name === user.name)) {
            allCollaborators.push({ name: user.name, color: user.color || '#6b7280' });
          }
        } catch (e) { console.error('Error fetching collaborator:', e); }
      }
      console.log('Sending collaborators:', allCollaborators);
      
      currentDocId = docId; socket.join(docId);
      if (!activeRooms.has(docId)) activeRooms.set(docId, new Map());
      
      const userName = socket.user?.name || 'Anonyme-' + socket.id.slice(0,4);
      const userKey = socket.user?._id?.toString() || socket.id; // Use real user ID if logged in
      
      // Check if user already connected (another tab)
      const existingUser = Array.from(activeRooms.get(docId).values()).find(u => u.odName === userName);
      
      const userInfo = { 
        id: socket.id, 
        odName: userName, // odName = original user identifier
        name: userName, 
        color: socket.user?.color || getRandomColor(), 
        role, 
        cursor: null,
        sockets: existingUser ? [...(existingUser.sockets || [existingUser.id]), socket.id] : [socket.id]
      };
      
      // Remove old entry for same user if exists
      for (const [key, val] of activeRooms.get(docId).entries()) {
        if (val.odName === userName) {
          activeRooms.get(docId).delete(key);
        }
      }
      
      activeRooms.get(docId).set(userKey, userInfo);
      
      // Build unique users list (no duplicates)
      const uniqueUsers = Array.from(activeRooms.get(docId).values());
      
      socket.emit('document-state', { id: doc.shortId, title: doc.title, elements: doc.elements, characters: doc.characters, locations: doc.locations, comments: doc.comments, users: uniqueUsers, role, collaborators: allCollaborators });
      socket.to(docId).emit('user-joined', { user: userInfo, users: uniqueUsers });
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
    if (room) { const user = room.get(socket.id); if (user) { user.cursor = { index, position }; socket.to(currentDocId).emit('cursor-updated', { userId: socket.id, cursor: { index, position } }); } }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentDocId) {
      const room = activeRooms.get(currentDocId);
      if (room) {
        // Find user by socket.id in their sockets array
        for (const [key, user] of room.entries()) {
          if (user.sockets && user.sockets.includes(socket.id)) {
            // Remove this socket from user's sockets
            user.sockets = user.sockets.filter(s => s !== socket.id);
            // If no more sockets, remove user entirely
            if (user.sockets.length === 0) {
              room.delete(key);
            }
            break;
          } else if (user.id === socket.id) {
            // Fallback for old format
            room.delete(key);
            break;
          }
        }
        if (room.size === 0) {
          activeRooms.delete(currentDocId);
        } else {
          socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
