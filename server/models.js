const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { 
    type: String, 
    required: true,
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
  },
  color: {
    type: String,
    default: function() {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
  },
});

// Document Element Schema (subdocument)
const elementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition'],
    required: true,
  },
  content: { type: String, default: '' },
}, { _id: false });

// Comment Schema (subdocument)
const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  elementId: { type: String, required: true },
  elementIndex: { type: Number },
  highlight: {
    text: String,
    startOffset: Number,
    endOffset: Number
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userColor: { type: String, required: true },
  content: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  replies: [{
    id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    userColor: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { _id: false });

// Suggestion Schema (subdocument)
const suggestionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  elementId: { type: String, required: true },
  elementIndex: { type: Number, required: true },
  originalText: { type: String, required: true },
  suggestedText: { type: String, required: true },
  startOffset: { type: Number, required: true },
  endOffset: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userColor: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

// History Entry Schema (for version history)
const historyEntrySchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userColor: { type: String, required: true },
  action: { 
    type: String, 
    enum: [
      'title-change',
      'element-change', 
      'element-type-change',
      'element-insert', 
      'element-delete',
      'snapshot',
    ],
    required: true,
  },
  data: {
    oldTitle: String,
    newTitle: String,
    elementIndex: Number,
    elementId: String,
    oldContent: String,
    newContent: String,
    oldType: String,
    newType: String,
    elements: [elementSchema],
    title: String,
  },
  createdAt: { type: Date, default: Date.now },
});

historyEntrySchema.index({ documentId: 1, createdAt: -1 });

// Document Schema
const documentSchema = new mongoose.Schema({
  shortId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true,
  },
  title: { 
    type: String, 
    default: 'SANS TITRE',
  },
  elements: {
    type: [elementSchema],
    default: [{ id: 'initial', type: 'scene', content: '' }],
  },
  characters: {
    type: [String],
    default: [],
  },
  locations: {
    type: [String],
    default: [],
  },
  comments: {
    type: [commentSchema],
    default: [],
  },
  suggestions: {
    type: [suggestionSchema],
    default: [],
  },
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
  },
  collaborators: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['editor', 'viewer', 'commenter'], default: 'editor' },
    addedAt: { type: Date, default: Date.now },
  }],
  publicAccess: {
    enabled: { type: Boolean, default: false },
    role: { type: String, enum: ['editor', 'viewer', 'commenter'], default: 'viewer' },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastSnapshotAt: { type: Date, default: Date.now },
});

documentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model('User', userSchema);
const Document = mongoose.model('Document', documentSchema);
const HistoryEntry = mongoose.model('HistoryEntry', historyEntrySchema);

module.exports = {
  User,
  Document,
  HistoryEntry,
};
