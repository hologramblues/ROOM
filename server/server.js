// Server V2 - Added autosave and snapshot endpoints
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { User, Document, HistoryEntry } = require('./models');
const { router: authRouter, authMiddleware, optionalAuthMiddleware, socketAuthMiddleware } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/screenplay-collab';
mongoose.connect(MONGODB_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

// Anthropic client (initialized only if API key is present)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log('Anthropic API initialized');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/auth', authRouter);

app.get('/api/health', async (req, res) => {
  const docCount = await Document.countDocuments();
  const userCount = await User.countDocuments();
  res.json({ status: 'ok', documents: docCount, users: userCount, aiEnabled: !!anthropic });
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
  // Couleurs très distinctes pour les utilisateurs
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Couleur déterministe basée sur le nom/id de l'utilisateur
function getUserColor(identifier) {
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#14b8a6', '#f97316', '#6366f1', '#a855f7'];
  let hash = 0;
  const str = String(identifier);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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
    
    io.to(req.params.shortId).emit('document-restored', { title: doc.title, elements: doc.elements });
    
    console.log('Bulk saved document', req.params.shortId, 'with', doc.elements.length, 'elements');
    res.json({ success: true, elementsCount: doc.elements.length });
  } catch (error) { 
    console.error('Bulk save error:', error);
    res.status(500).json({ error: 'Erreur' }); 
  }
});

// Autosave - silent save without history entry or broadcast (for auto-save every 5s)
app.put('/api/documents/:shortId/autosave', optionalAuthMiddleware, async (req, res) => {
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
    
    // No broadcast, no history entry - just silent save
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (error) { 
    console.error('Autosave error:', error);
    res.status(500).json({ error: 'Erreur' }); 
  }
});

// Create snapshot - explicit history entry (for manual saves and auto-snapshots every 15min)
app.post('/api/documents/:shortId/snapshot', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    if (!checkDocumentAccess(doc, req.user, 'editor')) return res.status(403).json({ error: 'Acces refuse' });
    
    // Update document with latest data if provided
    if (req.body.title) doc.title = req.body.title;
    if (req.body.elements && Array.isArray(req.body.elements)) {
      doc.elements = req.body.elements;
      doc.markModified('elements');
    }
    await doc.save();
    
    // Create history entry
    const isAuto = req.body.auto === true;
    await HistoryEntry.create({ 
      documentId: doc._id, 
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      action: 'snapshot', 
      snapshotName: isAuto ? `Auto-save ${new Date().toLocaleString('fr-FR')}` : (req.body.snapshotName || null),
      data: { title: doc.title, elements: doc.elements } 
    });
    
    console.log(isAuto ? '[AUTO-SNAPSHOT]' : '[SNAPSHOT]', 'Created for', req.params.shortId);
    res.json({ success: true, createdAt: new Date().toISOString(), auto: isAuto });
  } catch (error) { 
    console.error('Snapshot error:', error);
    res.status(500).json({ error: 'Erreur' }); 
  }
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
    res.json({ 
      id: doc.shortId, 
      title: doc.title, 
      elements: doc.elements, 
      characters: doc.characters, 
      locations: doc.locations, 
      comments: doc.comments, 
      suggestions: doc.suggestions || [],
      isOwner: req.user && doc.ownerId.equals(req.user._id), 
      publicAccess: doc.publicAccess 
    });
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

// ============ AI REWRITE ROUTE ============

app.post('/api/ai/rewrite', optionalAuthMiddleware, async (req, res) => {
  try {
    const { systemPrompt, userPrompt, originalText } = req.body;
    
    if (!userPrompt || !originalText) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }
    
    if (!anthropic) {
      return res.status(503).json({ error: 'Service IA non configuré. Contactez l\'administrateur.' });
    }
    
    console.log('AI Rewrite request:', { originalText: originalText.substring(0, 50) + '...', userPromptLength: userPrompt.length });
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt || "Tu es un assistant d'écriture de scénario professionnel.",
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });
    
    // Extract text from response
    const rewrittenText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();
    
    // Clean up any quotes that might wrap the response
    const cleanedText = rewrittenText
      .replace(/^["«]|["»]$/g, '')
      .trim();
    
    console.log('AI Rewrite success:', { resultLength: cleanedText.length, usage: message.usage });
    
    res.json({ 
      rewrittenText: cleanedText,
      usage: message.usage
    });
    
  } catch (error) {
    console.error('AI Rewrite error:', error);
    
    if (error.status === 401) {
      return res.status(500).json({ error: 'Clé API invalide' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Limite de requêtes atteinte. Réessayez dans quelques minutes.' });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'Requête invalide: ' + (error.message || 'erreur inconnue') });
    }
    
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ============ COMMENT ROUTES ============

app.post('/api/documents/:shortId/comments', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'commenter')) return res.status(403).json({ error: 'Acces refuse' });
    const comment = { 
      id: uuidv4(), 
      elementId: req.body.elementId, 
      elementIndex: req.body.elementIndex,
      highlight: req.body.highlight || null,
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      content: req.body.content, 
      createdAt: new Date(), 
      replies: [],
      resolved: false
    };
    doc.comments.push(comment); await doc.save();
    io.to(req.params.shortId).emit('comment-added', { comment });
    res.json({ comment });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.post('/api/documents/:shortId/comments/:commentId/replies', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'commenter')) return res.status(403).json({ error: 'Acces refuse' });
    const comment = doc.comments.find(c => c.id === req.params.commentId || c._id?.toString() === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire non trouve' });
    const reply = { 
      id: uuidv4(), 
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      content: req.body.content, 
      createdAt: new Date() 
    };
    comment.replies.push(reply); 
    await doc.save();
    io.to(req.params.shortId).emit('comment-reply-added', { commentId: req.params.commentId, reply });
    res.json({ reply });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Erreur' }); }
});

app.delete('/api/documents/:shortId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'editor')) return res.status(403).json({ error: 'Acces refuse' });
    const commentIndex = doc.comments.findIndex(c => c.id === req.params.commentId || c._id?.toString() === req.params.commentId);
    if (commentIndex === -1) return res.status(404).json({ error: 'Commentaire non trouve' });
    doc.comments.splice(commentIndex, 1);
    await doc.save();
    io.to(req.params.shortId).emit('comment-deleted', { commentId: req.params.commentId });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Erreur' }); }
});

// IMPORTANT: /resolve route MUST come BEFORE the generic PUT /comments/:commentId route
app.put('/api/documents/:shortId/comments/:commentId/resolve', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Non trouve' });
    const comment = doc.comments.find(c => c.id === req.params.commentId || c._id?.toString() === req.params.commentId);
    if (comment) { 
      comment.resolved = !comment.resolved; 
      await doc.save(); 
      io.to(req.params.shortId).emit('comment-resolved', { commentId: req.params.commentId, resolved: comment.resolved }); 
    }
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Erreur' }); }
});

app.put('/api/documents/:shortId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc || !checkDocumentAccess(doc, req.user, 'commenter')) return res.status(403).json({ error: 'Acces refuse' });
    const comment = doc.comments.find(c => c.id === req.params.commentId || c._id?.toString() === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire non trouve' });
    comment.content = req.body.content;
    comment.editedAt = new Date();
    await doc.save();
    io.to(req.params.shortId).emit('comment-updated', { commentId: req.params.commentId, content: req.body.content });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Erreur' }); }
});

// ============ SOCKET.IO ============

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
      currentDocId = docId; socket.join(docId);
      if (!activeRooms.has(docId)) activeRooms.set(docId, new Map());
      const userInfo = { id: socket.id, name: socket.user?.name || 'Anonyme-' + socket.id.slice(0,4), color: getUserColor(socket.user?._id?.toString() || socket.user?.name || socket.id), role, cursor: null };
      activeRooms.get(docId).set(socket.id, userInfo);
      
      // Get collaborators with their user info
      let collaboratorsList = [];
      if (doc.collaborators && doc.collaborators.length > 0) {
        const collabUserIds = doc.collaborators.map(c => c.userId);
        const collabUsers = await User.find({ _id: { $in: collabUserIds } }).select('name color');
        collaboratorsList = doc.collaborators.map(c => {
          const user = collabUsers.find(u => u._id.equals(c.userId));
          return { userId: c.userId, name: user?.name || 'Inconnu', color: getUserColor(c.userId.toString()), role: c.role };
        });
      }
      // Add owner to collaborators list
      const owner = await User.findById(doc.ownerId).select('name color');
      if (owner) {
        collaboratorsList.unshift({ userId: doc.ownerId, name: owner.name, color: getUserColor(doc.ownerId.toString()), role: 'owner' });
      }
      
      socket.emit('document-state', { 
        id: doc.shortId, 
        title: doc.title, 
        elements: doc.elements, 
        characters: doc.characters, 
        locations: doc.locations, 
        comments: doc.comments, 
        suggestions: doc.suggestions || [],
        users: Array.from(activeRooms.get(docId).values()), 
        role,
        collaborators: collaboratorsList
      });
      socket.to(docId).emit('user-joined', { user: userInfo, users: Array.from(activeRooms.get(docId).values()) });
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

  // ============ COMMENT SOCKET HANDLERS ============

  socket.on('comment-add', async ({ comment }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'commenter')) return;
      const newComment = {
        id: comment.id,
        elementId: comment.elementId,
        elementIndex: comment.elementIndex,
        highlight: comment.highlight || null,
        userId: socket.user?._id,
        userName: comment.userName || socket.user?.name || 'Anonyme',
        userColor: comment.userColor || socket.user?.color || '#6b7280',
        content: comment.content,
        createdAt: new Date(),
        replies: [],
        resolved: false
      };
      doc.comments.push(newComment);
      await doc.save();
      socket.to(currentDocId).emit('comment-added', { comment: newComment });
    } catch (error) { console.error('Comment add error:', error); }
  });

  // ============ SUGGESTION SOCKET HANDLERS ============

  socket.on('suggestion-add', async ({ suggestion }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'commenter')) return;
      
      const newSuggestion = {
        id: suggestion.id,
        elementId: suggestion.elementId,
        elementIndex: suggestion.elementIndex,
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        startOffset: suggestion.startOffset,
        endOffset: suggestion.endOffset,
        userId: socket.user?._id,
        userName: suggestion.userName || socket.user?.name || 'Anonyme',
        userColor: suggestion.userColor || socket.user?.color || '#10b981',
        status: 'pending',
        createdAt: new Date()
      };
      
      if (!doc.suggestions) doc.suggestions = [];
      doc.suggestions.push(newSuggestion);
      doc.markModified('suggestions');
      await doc.save();
      
      socket.to(currentDocId).emit('suggestion-added', { suggestion: newSuggestion });
      console.log('Suggestion added:', newSuggestion.id);
    } catch (error) { console.error('Suggestion add error:', error); }
  });

  socket.on('suggestion-accept', async ({ suggestionId }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      
      const suggestionIndex = doc.suggestions?.findIndex(s => s.id === suggestionId);
      if (suggestionIndex !== -1 && suggestionIndex !== undefined) {
        const suggestion = doc.suggestions[suggestionIndex];
        
        // Apply the suggestion to the element
        const elementIndex = doc.elements.findIndex(el => el.id === suggestion.elementId);
        if (elementIndex !== -1) {
          const element = doc.elements[elementIndex];
          const newContent = 
            element.content.substring(0, suggestion.startOffset) + 
            suggestion.suggestedText + 
            element.content.substring(suggestion.endOffset);
          doc.elements[elementIndex].content = newContent;
          doc.markModified('elements');
          
          // Broadcast element update
          socket.to(currentDocId).emit('element-updated', { index: elementIndex, element: doc.elements[elementIndex] });
        }
        
        // Remove the suggestion
        doc.suggestions.splice(suggestionIndex, 1);
        doc.markModified('suggestions');
        await doc.save();
        
        // Broadcast suggestion acceptance
        io.to(currentDocId).emit('suggestion-accepted', { suggestionId });
        console.log('Suggestion accepted:', suggestionId);
      }
    } catch (error) { console.error('Suggestion accept error:', error); }
  });

  socket.on('suggestion-reject', async ({ suggestionId }) => {
    if (!currentDocId) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'editor')) return;
      
      const suggestionIndex = doc.suggestions?.findIndex(s => s.id === suggestionId);
      if (suggestionIndex !== -1 && suggestionIndex !== undefined) {
        doc.suggestions.splice(suggestionIndex, 1);
        doc.markModified('suggestions');
        await doc.save();
        
        io.to(currentDocId).emit('suggestion-rejected', { suggestionId });
        console.log('Suggestion rejected:', suggestionId);
      }
    } catch (error) { console.error('Suggestion reject error:', error); }
  });

  // ============ CHAT ============
  
  // Store for chat messages per document (in-memory, resets on server restart)
  if (!global.chatHistory) global.chatHistory = new Map();
  
  socket.on('chat-message', ({ docId, message }) => {
    if (!currentDocId || currentDocId !== docId) return;
    
    // Store message in history
    if (!global.chatHistory.has(docId)) {
      global.chatHistory.set(docId, []);
    }
    const history = global.chatHistory.get(docId);
    history.push(message);
    // Keep only last 100 messages
    if (history.length > 100) history.shift();
    
    // Broadcast to all OTHER users in the room (not sender - they already added it locally)
    socket.to(currentDocId).emit('chat-message', message);
    console.log('Chat message:', message.senderName, '->', message.content.substring(0, 50));
  });

  // ============ CURSOR & DISCONNECT ============

  socket.on('cursor-move', ({ index, position }) => {
    if (!currentDocId) return;
    const room = activeRooms.get(currentDocId);
    if (room) { const user = room.get(socket.id); if (user) { user.cursor = { index, position }; socket.to(currentDocId).emit('cursor-updated', { userId: socket.id, cursor: { index, position } }); } }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentDocId) {
      const room = activeRooms.get(currentDocId);
      if (room) { room.delete(socket.id); if (room.size === 0) activeRooms.delete(currentDocId); else socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) }); }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
