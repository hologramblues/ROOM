const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  color: {
    type: String,
    default: function() {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
      return colors[Math.floor(Math.random() * colors.length)];
    }
  },
  createdAt: { type: Date, default: Date.now },
});

const elementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition'], required: true },
  content: { type: String, default: '' },
}, { _id: false });

const commentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  elementId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userColor: { type: String, required: true },
  content: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  replies: [{
    id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userColor: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { _id: false });

const historyEntrySchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, required: true },
  userColor: { type: String, required: true },
  action: { type: String, enum: ['title-change', 'element-change', 'element-type-change', 'element-insert', 'element-delete', 'snapshot'], required: true },
  data: {
    oldTitle: String, newTitle: String,
    elementIndex: Number, elementId: String,
    oldContent: String, newContent: String,
    oldType: String, newType: String,
    elements: [elementSchema], title: String,
  },
  createdAt: { type: Date, default: Date.now },
});
historyEntrySchema.index({ documentId: 1, createdAt: -1 });

const documentSchema = new mongoose.Schema({
  shortId: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'SANS TITRE' },
  elements: { type: [elementSchema], default: [{ id: 'initial', type: 'scene', content: '' }] },
  characters: { type: [String], default: [] },
  locations: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
documentSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });

module.exports = {
  User: mongoose.model('User', userSchema),
  Document: mongoose.model('Document', documentSchema),
  HistoryEntry: mongoose.model('HistoryEntry', historyEntrySchema),
};
