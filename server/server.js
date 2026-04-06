// Server V9 - Added Beat Board data persistence (beatCards, structureBeats, sceneSynopsis, sceneStatus, whiteboardElements)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { User, Document, HistoryEntry } = require('./models');
const rateLimit = require('express-rate-limit');
const { router: authRouter, authMiddleware, optionalAuthMiddleware, socketAuthMiddleware } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] }, pingTimeout: 10000, pingInterval: 5000 });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/screenplay-collab';
mongoose.connect(MONGODB_URI).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

// ============ WAITLIST SCHEMA ============
const waitlistSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  source: {
    type: String,
    default: 'landing-page'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  notified: {
    type: Boolean,
    default: false
  }
});
const Waitlist = mongoose.model('Waitlist', waitlistSchema);

// Anthropic client (initialized only if API key is present)
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log('Anthropic API initialized');
}

app.use(cors({
  origin: [
    'https://writers-rooms.com',
    'https://www.writers-rooms.com',
    'https://app.writers-rooms.com',
    /\.vercel\.app$/,
    /\.netlify\.app$/,
    /\.railway\.app$/,
    /\.framer\.app$/,
    /\.framercanvas\.com$/,
    /\.framer\.website$/,
    'https://framer.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts, try again later' } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120, message: { error: 'Too many requests, slow down' } });
const aiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 10, message: { error: 'Too many AI requests, try again later' } });

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/ai', aiLimiter);
app.use('/api/', apiLimiter);

app.get('/api/health', async (req, res) => {
  try {
    const docCount = await Document.countDocuments();
    const userCount = await User.countDocuments();
    const waitlistCount = await Waitlist.countDocuments();
    res.json({ status: 'ok', documents: docCount, users: userCount, waitlist: waitlistCount, aiEnabled: !!anthropic });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

// ============ WAITLIST ROUTES ============

// POST /api/waitlist - Add email to waitlist (public)
app.post('/api/waitlist', async (req, res) => {
  try {
    const { email, source } = req.body;
    
    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Check if email already exists
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({ 
        message: 'Already on the list',
        alreadyExists: true 
      });
    }
    
    // Create entry
    const entry = new Waitlist({ 
      email: email.toLowerCase(),
      source: source || 'landing-page'
    });
    await entry.save();
    
    // Log for monitoring
    console.log(`[Waitlist] New signup: ${email}`);
    
    res.status(201).json({ 
      message: 'Successfully added to waitlist',
      alreadyExists: false
    });
    
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/waitlist/count - Public count
app.get('/api/waitlist/count', async (req, res) => {
  try {
    const count = await Waitlist.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/waitlist - Full list (admin protected)
app.get('/api/waitlist', async (req, res) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || !adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entries = await Waitlist.find().sort({ createdAt: -1 });
    res.json({ 
      count: entries.length,
      entries 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/waitlist/export - CSV export (admin protected)
app.get('/api/waitlist/export', async (req, res) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || !adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entries = await Waitlist.find().sort({ createdAt: -1 });
    
    // Generate CSV (with injection protection)
    const sanitizeCsv = (val) => {
      const s = String(val || '');
      // Escape fields that start with formula triggers
      if (/^[=+\-@\t\r]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
      // Quote if contains comma, newline, or double-quote
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = ['email,source,createdAt,notified'];
    entries.forEach(e => {
      csv.push(`${sanitizeCsv(e.email)},${sanitizeCsv(e.source)},${e.createdAt.toISOString()},${e.notified}`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=waitlist.csv');
    res.send(csv.join('\n'));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/waitlist/:email - Remove from waitlist (admin protected)
app.delete('/api/waitlist/:email', async (req, res) => {
  try {
    const adminSecret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || !adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await Waitlist.deleteOne({ email: req.params.email.toLowerCase() });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json({ success: true, deleted: req.params.email });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

function checkDocumentAccess(doc, user, requiredRole) {
  // Check public access first (works even without authentication)
  if (doc.publicAccess && doc.publicAccess.enabled) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    if (h[doc.publicAccess.role] >= h[requiredRole]) return true;
  }

  // All other checks require authentication
  if (!user) return false;

  // Owner always has full access
  if (doc.ownerId.equals(user._id)) return true;

  // Check collaborator role
  const collab = doc.collaborators.find(c => c.userId.equals(user._id));
  if (collab) {
    const h = { viewer: 0, commenter: 1, editor: 2 };
    return h[collab.role] >= h[requiredRole];
  }

  return false;
}

function getRandomColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}

app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    const shortId = uuidv4().slice(0, 8);
    const doc = new Document({ 
      shortId, 
      ownerId: req.user._id, 
      title: req.body.title || 'SANS TITRE',
      elements: req.body.elements || [{ id: uuidv4(), type: 'scene', content: '' }], 
      publicAccess: { enabled: false, role: 'viewer' }
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
      publicAccess: { enabled: false, role: 'viewer' }
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
    
    // Beat Board data
    if (req.body.beatCards !== undefined) {
      doc.beatCards = req.body.beatCards;
      doc.markModified('beatCards');
    }
    if (req.body.structureBeats !== undefined) {
      doc.structureBeats = req.body.structureBeats;
      doc.markModified('structureBeats');
    }
    if (req.body.sceneSynopsis !== undefined) {
      doc.sceneSynopsis = req.body.sceneSynopsis;
      doc.markModified('sceneSynopsis');
    }
    if (req.body.sceneStatus !== undefined) {
      doc.sceneStatus = req.body.sceneStatus;
      doc.markModified('sceneStatus');
    }
    if (req.body.whiteboardElements !== undefined) {
      doc.whiteboardElements = req.body.whiteboardElements;
      doc.markModified('whiteboardElements');
    }
    
    await doc.save();
    
    io.to(req.params.shortId).emit('document-restored', { 
      title: doc.title, 
      elements: doc.elements,
      beatCards: doc.beatCards,
      structureBeats: doc.structureBeats,
      sceneSynopsis: doc.sceneSynopsis,
      sceneStatus: doc.sceneStatus,
      whiteboardElements: doc.whiteboardElements
    });
    
    console.log('Bulk saved document', req.params.shortId, 'with', doc.elements.length, 'elements');
    res.json({ success: true, elementsCount: doc.elements.length });
  } catch (error) { 
    console.error('Bulk save error:', error);
    res.status(500).json({ error: 'Erreur' }); 
  }
});

// Autosave - silent save without history entry or broadcast (for auto-save every 10s)
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
    
    // Beat Board data
    if (req.body.beatCards !== undefined) {
      doc.beatCards = req.body.beatCards;
      doc.markModified('beatCards');
    }
    if (req.body.structureBeats !== undefined) {
      doc.structureBeats = req.body.structureBeats;
      doc.markModified('structureBeats');
    }
    if (req.body.sceneSynopsis !== undefined) {
      doc.sceneSynopsis = req.body.sceneSynopsis;
      doc.markModified('sceneSynopsis');
    }
    if (req.body.sceneStatus !== undefined) {
      doc.sceneStatus = req.body.sceneStatus;
      doc.markModified('sceneStatus');
    }
    if (req.body.whiteboardElements !== undefined) {
      doc.whiteboardElements = req.body.whiteboardElements;
      doc.markModified('whiteboardElements');
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
    
    // Beat Board data
    if (req.body.beatCards !== undefined) {
      doc.beatCards = req.body.beatCards;
      doc.markModified('beatCards');
    }
    if (req.body.structureBeats !== undefined) {
      doc.structureBeats = req.body.structureBeats;
      doc.markModified('structureBeats');
    }
    if (req.body.sceneSynopsis !== undefined) {
      doc.sceneSynopsis = req.body.sceneSynopsis;
      doc.markModified('sceneSynopsis');
    }
    if (req.body.sceneStatus !== undefined) {
      doc.sceneStatus = req.body.sceneStatus;
      doc.markModified('sceneStatus');
    }
    if (req.body.whiteboardElements !== undefined) {
      doc.whiteboardElements = req.body.whiteboardElements;
      doc.markModified('whiteboardElements');
    }
    
    await doc.save();
    
    // Create history entry with Beat Board data
    const isAuto = req.body.auto === true;
    await HistoryEntry.create({ 
      documentId: doc._id, 
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      action: 'snapshot', 
      snapshotName: isAuto ? `Auto-save ${new Date().toLocaleString('fr-FR')}` : (req.body.snapshotName || null),
      data: { 
        title: doc.title, 
        elements: doc.elements,
        beatCards: doc.beatCards,
        structureBeats: doc.structureBeats,
        sceneSynopsis: doc.sceneSynopsis,
        sceneStatus: doc.sceneStatus,
        whiteboardElements: doc.whiteboardElements
      } 
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

// Lightweight meta endpoint for conflict detection (offline mode)
app.get('/api/documents/:shortId/meta', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    res.json({ updatedAt: doc.updatedAt, title: doc.title });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

app.get('/api/documents/:shortId', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    // Auth required. Any authenticated user with the shortId (shared link) can access.
    // They will be auto-added as collaborator when they join via socket.
    res.json({ 
      id: doc.shortId, 
      title: doc.title, 
      elements: doc.elements, 
      characters: doc.characters, 
      locations: doc.locations, 
      comments: doc.comments, 
      suggestions: doc.suggestions || [],
      // Beat Board data
      beatCards: doc.beatCards || [],
      structureBeats: doc.structureBeats || [],
      sceneSynopsis: doc.sceneSynopsis || {},
      sceneStatus: doc.sceneStatus || {},
      whiteboardElements: doc.whiteboardElements || [],
      isOwner: req.user && doc.ownerId.equals(req.user._id), 
      publicAccess: doc.publicAccess 
    });
  } catch (error) { res.status(500).json({ error: 'Erreur' }); }
});

// Update public access settings (owner only)
app.put('/api/documents/:shortId/public-access', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findOne({ shortId: req.params.shortId });
    if (!doc) return res.status(404).json({ error: 'Document non trouve' });
    if (!doc.ownerId.equals(req.user._id)) return res.status(403).json({ error: 'Seul le proprietaire peut modifier l\'acces public' });
    const { enabled, role } = req.body;
    if (typeof enabled === 'boolean') doc.publicAccess.enabled = enabled;
    if (role && ['viewer', 'commenter', 'editor'].includes(role)) doc.publicAccess.role = role;
    await doc.save();
    res.json({ publicAccess: doc.publicAccess });
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
    
    // Save current state before restoring
    await HistoryEntry.create({ 
      documentId: doc._id, 
      userId: req.user._id, 
      userName: req.user.name, 
      userColor: req.user.color, 
      action: 'snapshot', 
      snapshotName: `Before restore - ${new Date().toLocaleString('fr-FR')}`,
      data: { 
        title: doc.title, 
        elements: doc.elements,
        beatCards: doc.beatCards,
        structureBeats: doc.structureBeats,
        sceneSynopsis: doc.sceneSynopsis,
        sceneStatus: doc.sceneStatus,
        whiteboardElements: doc.whiteboardElements
      } 
    });
    
    // Restore document
    doc.title = entry.data.title;
    doc.elements = entry.data.elements;
    
    // Restore Beat Board data if present in snapshot
    if (entry.data.beatCards) doc.beatCards = entry.data.beatCards;
    if (entry.data.structureBeats) doc.structureBeats = entry.data.structureBeats;
    if (entry.data.sceneSynopsis) doc.sceneSynopsis = entry.data.sceneSynopsis;
    if (entry.data.sceneStatus) doc.sceneStatus = entry.data.sceneStatus;
    if (entry.data.whiteboardElements) doc.whiteboardElements = entry.data.whiteboardElements;
    
    await doc.save();
    
    io.to(req.params.shortId).emit('document-restored', { 
      title: doc.title, 
      elements: doc.elements,
      beatCards: doc.beatCards,
      structureBeats: doc.structureBeats,
      sceneSynopsis: doc.sceneSynopsis,
      sceneStatus: doc.sceneStatus,
      whiteboardElements: doc.whiteboardElements
    });
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
      spans: req.body.spans || null,
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
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of socketRates) {
    if (now >= entry.resetAt) socketRates.delete(id);
  }
}, 60000);

// ============ SOCKET INPUT VALIDATION ============
const VALID_ELEMENT_TYPES = new Set(['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition']);
const MAX_CONTENT_LENGTH = 50000;

function validateElement(element) {
  if (!element || typeof element.id !== 'string') return false;
  if (element.type && !VALID_ELEMENT_TYPES.has(element.type)) return false;
  if (element.content !== undefined && (typeof element.content !== 'string' || element.content.length > MAX_CONTENT_LENGTH)) return false;
  return true;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.user ? `(${socket.user.name})` : '(anonymous)');
  let currentDocId = null;

  // Guard: check role from activeRooms (supports public access users)
  const getMyRole = () => {
    if (!currentDocId) return null;
    const room = activeRooms.get(currentDocId);
    if (!room) return null;
    const user = room.get(socket.id);
    return user?.role || null;
  };
  const canWrite = () => {
    const role = getMyRole();
    return role === 'editor';
  };
  const canComment = () => {
    const role = getMyRole();
    return role === 'editor' || role === 'commenter';
  };

  socket.on('join-document', async ({ docId }) => {
    try {
      if (currentDocId) { const room = activeRooms.get(currentDocId); if (room) { room.delete(socket.id); socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) }); } socket.leave(currentDocId); }
      const doc = await Document.findOne({ shortId: docId });
      if (!doc) return socket.emit('error', { message: 'Document non trouve' });
      // Auth always required — no anonymous mode
      if (!socket.user) return socket.emit('error', { message: 'Authentification requise' });
      if (!checkDocumentAccess(doc, socket.user, 'viewer')) return socket.emit('error', { message: 'Acces refuse' });
      let role = 'viewer';
      if (doc.ownerId.equals(socket.user._id)) {
        role = 'editor';
      } else {
        const c = doc.collaborators.find(c => c.userId.equals(socket.user._id));
        if (c) {
          role = c.role;
        } else {
          // New user accessing via shared link — auto-add as editor collaborator
          await Document.updateOne(
            { shortId: docId, 'collaborators.userId': { $ne: socket.user._id } },
            { $push: { collaborators: { userId: socket.user._id, role: 'editor' } } }
          );
          role = 'editor';
          console.log(`[COLLAB] Auto-added ${socket.user.name} as editor to ${docId}`);
        }
      }
      currentDocId = docId; socket.join(docId);
      if (!activeRooms.has(docId)) activeRooms.set(docId, new Map());
      const userInfo = { id: socket.id, name: socket.user.name, color: socket.user.color || getRandomColor(), role, cursor: null };
      activeRooms.get(docId).set(socket.id, userInfo);
      
      // Re-read doc to get fresh collaborators list (includes auto-added user)
      const freshDoc = await Document.findOne({ shortId: docId }).select('collaborators ownerId');
      const docCollaborators = freshDoc?.collaborators || doc.collaborators || [];
      let collaboratorsList = [];
      if (docCollaborators.length > 0) {
        const collabUserIds = docCollaborators.map(c => c.userId);
        const collabUsers = await User.find({ _id: { $in: collabUserIds } }).select('name color');
        collaboratorsList = docCollaborators.map(c => {
          const user = collabUsers.find(u => u._id.equals(c.userId));
          return { userId: c.userId, name: user?.name || 'Inconnu', color: user?.color || '#6b7280', role: c.role };
        });
      }
      // Add owner to collaborators list
      const owner = await User.findById(doc.ownerId).select('name color');
      if (owner) {
        collaboratorsList.unshift({ userId: doc.ownerId, name: owner.name, color: owner.color, role: 'owner' });
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
        collaborators: collaboratorsList,
        docVersion: doc.version || 0
      });
      socket.to(docId).emit('user-joined', { user: userInfo, users: Array.from(activeRooms.get(docId).values()) });
    } catch (error) { console.error('Join error:', error); }
  });

  socket.on('title-change', async ({ title }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id)) return;
    if (typeof title !== 'string' || title.length > 200) return;
    try {
      const doc = await Document.findOneAndUpdate(
        { shortId: currentDocId },
        { $set: { title } },
        { new: false }
      );
      if (!doc) return;
      socket.to(currentDocId).emit('title-updated', { title });
    } catch (error) { console.error('Title error:', error); }
  });

  socket.on('element-change', async ({ index, element, baseVersion }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id)) return;
    try {
      if (!validateElement(element)) return;
      const elementWithVersion = { ...element, v: (baseVersion != null ? baseVersion + 1 : 0) };

      if (baseVersion != null) {
        // Optimistic concurrency: only update if server version matches baseVersion
        const result = await Document.updateOne(
          { shortId: currentDocId, 'elements.id': element.id, 'elements.v': baseVersion },
          { $set: { 'elements.$.content': element.content, 'elements.$.type': element.type, 'elements.$.v': baseVersion + 1 } }
        );
        if (result.modifiedCount > 0) {
          socket.to(currentDocId).emit('element-updated', { index, element: elementWithVersion });
        } else {
          // Version mismatch — concurrent edit detected. Send server state back to sender.
          const doc = await Document.findOne({ shortId: currentDocId }).select('elements');
          if (doc) {
            const serverElement = doc.elements.find(el => el.id === element.id);
            if (serverElement) {
              socket.emit('element-conflict', { elementId: element.id, serverElement: serverElement.toObject() });
            }
          }
        }
      } else {
        // No version sent (legacy client) — fall back to last-write-wins
        const result = await Document.updateOne(
          { shortId: currentDocId, 'elements.id': element.id },
          { $set: { 'elements.$': elementWithVersion } }
        );
        if (result.modifiedCount > 0) {
          socket.to(currentDocId).emit('element-updated', { index, element: elementWithVersion });
        }
      }
    } catch (error) { console.error('Element error:', error); }
  });

  socket.on('element-type-change', async ({ index, type, elementId }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id)) return;
    if (type && !VALID_ELEMENT_TYPES.has(type)) return;
    try {
      // Prefer elementId, fallback to positional index
      const targetId = elementId;
      if (targetId) {
        await Document.updateOne(
          { shortId: currentDocId, 'elements.id': targetId },
          { $set: { 'elements.$.type': type } }
        );
      } else if (index >= 0) {
        await Document.updateOne(
          { shortId: currentDocId, [`elements.${index}`]: { $exists: true } },
          { $set: { [`elements.${index}.type`]: type } }
        );
      } else return;
      socket.to(currentDocId).emit('element-type-updated', { index, type, elementId: targetId });
    } catch (error) { console.error('Type error:', error); }
  });

  socket.on('element-insert', async ({ afterIndex, afterElementId, element }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id)) return;
    if (!validateElement(element)) return;
    try {
      // Ensure element has version field
      const versionedElement = { ...element, v: element.v || 0 };

      // Guard: prevent duplicate insert (idempotency) — check if element ID already exists
      const existing = await Document.findOne({ shortId: currentDocId, 'elements.id': element.id });
      if (existing) return; // Already inserted (concurrent duplicate)

      if (afterElementId) {
        // ID-based insert: find position of afterElementId, insert after it
        // Use findOneAndUpdate to get fresh doc and insert atomically
        const doc = await Document.findOne({ shortId: currentDocId }).select('elements');
        if (!doc) return;
        const pos = doc.elements.findIndex(el => el.id === afterElementId);
        const insertPos = pos >= 0 ? pos + 1 : doc.elements.length;
        await Document.updateOne(
          { shortId: currentDocId },
          { $push: { elements: { $each: [versionedElement], $position: insertPos } }, $inc: { version: 1 } }
        );
      } else {
        // Fallback to index-based
        const insertPos = Math.max(0, afterIndex + 1);
        await Document.updateOne(
          { shortId: currentDocId },
          { $push: { elements: { $each: [versionedElement], $position: insertPos } }, $inc: { version: 1 } }
        );
      }
      socket.to(currentDocId).emit('element-inserted', { afterIndex, afterElementId, element: versionedElement });
    } catch (error) { console.error('Insert error:', error); }
  });

  socket.on('element-delete', async ({ index, elementId }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id)) return;
    try {
      let targetId = elementId;
      if (!targetId) {
        // Fallback: look up by index
        const doc = await Document.findOne({ shortId: currentDocId }).select('elements');
        if (!doc || doc.elements.length <= 1 || index < 0 || index >= doc.elements.length) return;
        targetId = doc.elements[index]?.id;
      }
      if (!targetId) return;
      const result = await Document.updateOne(
        { shortId: currentDocId, 'elements.1': { $exists: true } }, // ensure >1 element
        { $pull: { elements: { id: targetId } }, $inc: { version: 1 } }
      );
      if (result.modifiedCount > 0) {
        socket.to(currentDocId).emit('element-deleted', { index, elementId: targetId });
      }
    } catch (error) { console.error('Delete error:', error); }
  });

  // ============ COMMENT SOCKET HANDLERS ============

  socket.on('comment-add', async ({ comment }) => {
    if (!currentDocId || !canComment() || !checkSocketRate(socket.id)) return;
    try {
      // Check access BEFORE pushing
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc || !checkDocumentAccess(doc, socket.user, 'commenter')) return;

      const newComment = {
        id: comment.id,
        elementId: comment.elementId,
        elementIndex: comment.elementIndex,
        highlight: comment.highlight || null,
        spans: comment.spans || null,
        userId: socket.user?._id,
        userName: comment.userName || socket.user?.name || 'Anonyme',
        userColor: comment.userColor || socket.user?.color || '#6b7280',
        content: comment.content,
        createdAt: new Date(),
        replies: [],
        resolved: false
      };
      await Document.updateOne(
        { shortId: currentDocId },
        { $push: { comments: newComment } }
      );
      socket.to(currentDocId).emit('comment-added', { comment: newComment });
    } catch (error) { console.error('Comment add error:', error); }
  });

  // ============ SUGGESTION SOCKET HANDLERS ============

  socket.on('suggestion-add', async ({ suggestion }) => {
    if (!currentDocId || !canComment() || !checkSocketRate(socket.id)) return;
    try {
      // Check access BEFORE pushing
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
      await Document.updateOne(
        { shortId: currentDocId },
        { $push: { suggestions: newSuggestion } }
      );
      socket.to(currentDocId).emit('suggestion-added', { suggestion: newSuggestion });
      console.log('Suggestion added:', newSuggestion.id);
    } catch (error) { console.error('Suggestion add error:', error); }
  });

  socket.on('suggestion-accept', async ({ suggestionId }) => {
    if (!currentDocId || !canWrite()) return;
    try {
      // First, read the suggestion before removing it
      const docBefore = await Document.findOne(
        { shortId: currentDocId, 'suggestions.id': suggestionId }
      );
      if (!docBefore) return; // suggestion doesn't exist or doc not found
      if (!checkDocumentAccess(docBefore, socket.user, 'editor')) return;

      const suggestion = docBefore.suggestions?.find(s => s.id === suggestionId);
      if (!suggestion) return;

      // Atomically remove the suggestion — only one concurrent caller succeeds
      const pullResult = await Document.updateOne(
        { shortId: currentDocId, 'suggestions.id': suggestionId },
        { $pull: { suggestions: { id: suggestionId } } }
      );
      // If modifiedCount is 0, another user already removed it (double-accept prevented)
      if (!pullResult.modifiedCount) return;

      // Now apply the text change atomically
      const elementIndex = docBefore.elements.findIndex(el => el.id === suggestion.elementId);
      if (elementIndex !== -1) {
        const element = docBefore.elements[elementIndex];
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
            // Broadcast element update
            const updatedElement = { ...element, content: newContent };
            socket.to(currentDocId).emit('element-updated', { index: elementIndex, element: updatedElement });
          } else {
            console.warn('Suggestion accept: originalText mismatch, suggestion removed without applying.');
          }
        } else {
          console.warn('Suggestion accept: offsets out of bounds, suggestion removed without applying.');
        }
      }

      io.to(currentDocId).emit('suggestion-accepted', { suggestionId });
      console.log('Suggestion accepted:', suggestionId);
    } catch (error) { console.error('Suggestion accept error:', error); }
  });

  socket.on('suggestion-reject', async ({ suggestionId }) => {
    if (!currentDocId || !canWrite()) return;
    try {
      const result = await Document.findOneAndUpdate(
        { shortId: currentDocId, 'suggestions.id': suggestionId },
        { $pull: { suggestions: { id: suggestionId } } },
        { new: true }
      );
      if (!result) return;
      if (!checkDocumentAccess(result, socket.user, 'editor')) return;

      io.to(currentDocId).emit('suggestion-rejected', { suggestionId });
      console.log('Suggestion rejected:', suggestionId);
    } catch (error) { console.error('Suggestion reject error:', error); }
  });

  // ============ FULL SYNC (undo/redo/drag/offline push) ============

  socket.on('full-sync', async ({ elements, docVersion }) => {
    if (!currentDocId || !canWrite() || !checkSocketRate(socket.id) || !elements || !Array.isArray(elements)) return;
    try {
      const doc = await Document.findOne({ shortId: currentDocId });
      if (!doc) return;

      // CRITICAL: Reject stale full-sync if client's version is behind server
      // This prevents a tab left open from overwriting newer changes on refresh
      const serverVersion = doc.version || 0;
      if (docVersion != null && docVersion < serverVersion) {
        console.warn(`[FULL-SYNC] REJECTED stale sync from client (client v${docVersion} < server v${serverVersion}) for ${currentDocId}`);
        // Send the current server state back to the stale client
        socket.emit('full-sync-applied', { elements: doc.elements, docVersion: serverVersion });
        return;
      }

      const versionedElements = elements.map(el => ({ ...el, v: el.v || 0 }));
      doc.elements = versionedElements;
      doc.version = serverVersion + 1;
      doc.markModified('elements');
      await doc.save();
      socket.to(currentDocId).emit('full-sync-applied', { elements: versionedElements, docVersion: doc.version });
      console.log('[FULL-SYNC] Applied', elements.length, 'elements to', currentDocId, 'v' + doc.version);
    } catch (err) {
      console.error('[FULL-SYNC] Error:', err);
    }
  });

  // ============ CHAT ============

  socket.on('chat-message', ({ docId, message }) => {
    if (!currentDocId || currentDocId !== docId) return;
    if (!message || typeof message.text !== 'string' || message.text.length > 5000) return;
    if (typeof message.userName !== 'string' || message.userName.length > 100) return;
    // Broadcast to everyone else in the room
    socket.to(currentDocId).emit('chat-message', message);
  });

  // ============ CURSOR & DISCONNECT ============

  socket.on('cursor-move', ({ index, position }) => {
    if (!currentDocId || !checkSocketRate(socket.id)) return;
    const room = activeRooms.get(currentDocId);
    if (room) { const user = room.get(socket.id); if (user) { user.cursor = { index, position }; socket.to(currentDocId).emit('cursor-updated', { userId: socket.id, cursor: { index, position } }); } }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socketRates.delete(socket.id);
    if (currentDocId) {
      const room = activeRooms.get(currentDocId);
      if (room) { room.delete(socket.id); if (room.size === 0) activeRooms.delete(currentDocId); else socket.to(currentDocId).emit('user-left', { id: socket.id, users: Array.from(room.values()) }); }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
