// electron/local-models.js — Mongoose-like API wrapping SQLite (better-sqlite3)
// Supports: findOne, find, create, updateOne, countDocuments, findOneAndUpdate, findById
// Documents are stored with JSON columns parsed/stringified on read/write.

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');

// ============ JSON column names for documents ============
const JSON_COLS = [
  'elements', 'characters', 'locations', 'comments', 'suggestions',
  'beat_cards', 'structure_beats', 'scene_synopsis', 'scene_status', 'whiteboard_elements'
];

// Map camelCase JS fields → snake_case DB columns
const FIELD_MAP = {
  shortId: 'short_id',
  beatCards: 'beat_cards',
  structureBeats: 'structure_beats',
  sceneSynopsis: 'scene_synopsis',
  sceneStatus: 'scene_status',
  whiteboardElements: 'whiteboard_elements',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const REVERSE_FIELD_MAP = {};
for (const [k, v] of Object.entries(FIELD_MAP)) REVERSE_FIELD_MAP[v] = k;

function toDbCol(jsField) { return FIELD_MAP[jsField] || jsField; }
function toJsField(dbCol) { return REVERSE_FIELD_MAP[dbCol] || dbCol; }

// ============ Row ↔ JS Object conversion ============

function rowToDoc(row) {
  if (!row) return null;
  const doc = {};
  for (const [col, val] of Object.entries(row)) {
    const jsKey = toJsField(col);
    if (JSON_COLS.includes(col)) {
      try { doc[jsKey] = JSON.parse(val || '[]'); } catch { doc[jsKey] = col.endsWith('synopsis') || col.endsWith('status') ? {} : []; }
    } else {
      doc[jsKey] = val;
    }
  }
  // Mongoose compatibility: ownerId.equals() → always true for local
  doc.ownerId = {
    equals: () => true,
    toString: () => 'local-user',
  };
  // collaborators (empty in local mode)
  doc.collaborators = [];
  // publicAccess
  doc.publicAccess = { enabled: true, role: 'editor' };
  // markModified is a no-op in SQLite (no dirty tracking needed)
  doc.markModified = () => {};
  // save() — persist current state back to DB
  doc.save = () => {
    const db = getDb();
    const setClauses = [];
    const values = {};
    // Persist all JSON columns + title
    for (const col of JSON_COLS) {
      const jsKey = toJsField(col);
      if (doc[jsKey] !== undefined) {
        setClauses.push(`${col} = @${col}`);
        values[col] = JSON.stringify(doc[jsKey]);
      }
    }
    if (doc.title !== undefined) {
      setClauses.push('title = @title');
      values.title = doc.title;
    }
    setClauses.push("updated_at = datetime('now')");
    values.id = doc.id;
    const sql = `UPDATE documents SET ${setClauses.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(values);
    doc.updatedAt = new Date().toISOString();
    return Promise.resolve(doc);
  };
  return doc;
}

function rowToHistoryEntry(row) {
  if (!row) return null;
  const entry = {};
  for (const [col, val] of Object.entries(row)) {
    const jsKey = toJsField(col);
    if (col === 'data') {
      try { entry.data = JSON.parse(val || '{}'); } catch { entry.data = {}; }
    } else {
      entry[jsKey] = val;
    }
  }
  entry.action = row.action;
  entry.snapshotName = row.snapshot_name;
  entry.userName = row.user_name;
  entry.userColor = row.user_color;
  entry.documentId = row.document_id;
  entry.createdAt = row.created_at;
  return entry;
}

// ============ DocumentModel ============

const DocumentModel = {
  findOne(query) {
    const db = getDb();
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params = {};
    if (query.shortId) { sql += ' AND short_id = @shortId'; params.shortId = query.shortId; }
    if (query.short_id) { sql += ' AND short_id = @short_id'; params.short_id = query.short_id; }
    if (query._id || query.id) { sql += ' AND id = @id'; params.id = query._id || query.id; }

    const row = db.prepare(sql).get(params);
    return Promise.resolve(rowToDoc(row));
  },

  find(query = {}) {
    // Returns a chainable query builder
    return new QueryBuilder('documents', query);
  },

  async create(data) {
    const db = getDb();
    const id = data.id || uuidv4();
    const shortId = data.shortId || data.short_id || uuidv4().slice(0, 8);

    const cols = ['id', 'short_id', 'title'];
    const vals = { id, short_id: shortId, title: data.title || 'SANS TITRE' };

    for (const col of JSON_COLS) {
      const jsKey = toJsField(col);
      cols.push(col);
      vals[col] = JSON.stringify(data[jsKey] !== undefined ? data[jsKey] : (col.endsWith('synopsis') || col.endsWith('status') ? {} : []));
    }

    const placeholders = cols.map(c => `@${c}`).join(', ');
    db.prepare(`INSERT INTO documents (${cols.join(', ')}) VALUES (${placeholders})`).run(vals);

    // Return the created doc
    const row = db.prepare('SELECT * FROM documents WHERE id = @id').get({ id });
    return rowToDoc(row);
  },

  async updateOne(query, update) {
    const db = getDb();

    // Handle Mongoose-style $set with nested paths like 'elements.$'
    if (update.$set) {
      // Load document first
      let doc = null;
      if (query.shortId || query.short_id) {
        const sid = query.shortId || query.short_id;
        const row = db.prepare('SELECT * FROM documents WHERE short_id = @sid').get({ sid });
        doc = rowToDoc(row);
      }
      if (!doc) return { modifiedCount: 0 };

      for (const [path, value] of Object.entries(update.$set)) {
        if (path === 'title') {
          doc.title = value;
        } else if (path.startsWith('elements.$.')) {
          // "elements.$.type" — find element by query['elements.id'] and update field
          const field = path.split('.').pop();
          const targetId = query['elements.id'];
          if (targetId && doc.elements) {
            const el = doc.elements.find(e => e.id === targetId);
            if (el) el[field] = value;
          }
        } else if (path === 'elements.$') {
          // Replace whole element by ID match
          const targetId = query['elements.id'];
          if (targetId && doc.elements) {
            const idx = doc.elements.findIndex(e => e.id === targetId);
            if (idx !== -1) doc.elements[idx] = value;
          }
        } else if (path.match(/^elements\.\d+\.type$/)) {
          // "elements.0.type" — positional update
          const match = path.match(/^elements\.(\d+)\.type$/);
          if (match && doc.elements) {
            const idx = parseInt(match[1], 10);
            if (doc.elements[idx]) doc.elements[idx].type = value;
          }
        } else {
          // Direct field update
          const jsKey = toJsField(path);
          doc[jsKey] = value;
        }
      }

      await doc.save();
      return { modifiedCount: 1 };
    }

    // Handle $push
    if (update.$push) {
      let doc = null;
      if (query.shortId || query.short_id) {
        const sid = query.shortId || query.short_id;
        const row = db.prepare('SELECT * FROM documents WHERE short_id = @sid').get({ sid });
        doc = rowToDoc(row);
      }
      if (!doc) return { modifiedCount: 0 };

      for (const [field, value] of Object.entries(update.$push)) {
        const jsKey = toJsField(field);
        if (!Array.isArray(doc[jsKey])) doc[jsKey] = [];

        if (value.$each) {
          // Insert at position
          const pos = value.$position !== undefined ? value.$position : doc[jsKey].length;
          doc[jsKey].splice(pos, 0, ...value.$each);
        } else {
          doc[jsKey].push(value);
        }
      }

      await doc.save();
      return { modifiedCount: 1 };
    }

    // Handle $pull
    if (update.$pull) {
      let doc = null;
      if (query.shortId || query.short_id) {
        const sid = query.shortId || query.short_id;
        const row = db.prepare('SELECT * FROM documents WHERE short_id = @sid').get({ sid });
        doc = rowToDoc(row);
      }
      if (!doc) return { modifiedCount: 0 };

      for (const [field, condition] of Object.entries(update.$pull)) {
        const jsKey = toJsField(field);
        if (Array.isArray(doc[jsKey])) {
          doc[jsKey] = doc[jsKey].filter(item => {
            for (const [k, v] of Object.entries(condition)) {
              if (item[k] === v) return false;
            }
            return true;
          });
        }
      }

      await doc.save();
      return { modifiedCount: 1 };
    }

    return { modifiedCount: 0 };
  },

  async findOneAndUpdate(query, update, options = {}) {
    const db = getDb();
    let doc = null;

    if (query.shortId || query.short_id) {
      const sid = query.shortId || query.short_id;
      const row = db.prepare('SELECT * FROM documents WHERE short_id = @sid').get({ sid });
      doc = rowToDoc(row);
    }
    if (!doc) return null;

    // Clone for "pre-update" return (options.new: false)
    const prePatch = options.new === false ? { ...doc } : null;

    // Apply $set
    if (update.$set) {
      for (const [path, value] of Object.entries(update.$set)) {
        const jsKey = toJsField(path);
        doc[jsKey] = value;
      }
    }

    // Apply $push
    if (update.$push) {
      for (const [field, value] of Object.entries(update.$push)) {
        const jsKey = toJsField(field);
        if (!Array.isArray(doc[jsKey])) doc[jsKey] = [];
        doc[jsKey].push(value);
      }
    }

    // Apply $pull
    if (update.$pull) {
      for (const [field, condition] of Object.entries(update.$pull)) {
        const jsKey = toJsField(field);
        if (Array.isArray(doc[jsKey])) {
          doc[jsKey] = doc[jsKey].filter(item => {
            for (const [k, v] of Object.entries(condition)) {
              if (item[k] === v) return false;
            }
            return true;
          });
        }
      }
    }

    await doc.save();
    return prePatch || doc;
  },

  async countDocuments(query = {}) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM documents').get();
    return row.count;
  },
};

// ============ HistoryEntryModel ============

const HistoryEntryModel = {
  find(query = {}) {
    return new HistoryQueryBuilder(query);
  },

  async findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM history_entries WHERE id = @id').get({ id });
    return rowToHistoryEntry(row);
  },

  async create(data) {
    const db = getDb();
    const id = uuidv4();

    // Resolve documentId — if it's a doc ID from the doc object
    let documentId = data.documentId;

    db.prepare(`
      INSERT INTO history_entries (id, document_id, user_name, user_color, action, snapshot_name, data, created_at)
      VALUES (@id, @documentId, @userName, @userColor, @action, @snapshotName, @data, datetime('now'))
    `).run({
      id,
      documentId: typeof documentId === 'object' ? documentId.toString() : documentId,
      userName: data.userName || 'Moi',
      userColor: data.userColor || '#4ECDC4',
      action: data.action,
      snapshotName: data.snapshotName || null,
      data: JSON.stringify(data.data || {}),
    });

    return rowToHistoryEntry(db.prepare('SELECT * FROM history_entries WHERE id = @id').get({ id }));
  },
};

// ============ Query Builders (chainable find().sort().limit()) ============

class QueryBuilder {
  constructor(table, query = {}) {
    this._table = table;
    this._query = query;
    this._sort = null;
    this._limit = null;
    this._select = null;
  }

  select(fields) {
    this._select = fields;
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  then(resolve, reject) {
    try {
      const db = getDb();
      let sql = `SELECT * FROM ${this._table} WHERE 1=1`;
      const params = {};

      // For documents, we don't filter by ownerId (local = owns everything)

      // Sort
      if (this._sort) {
        const parts = [];
        for (const [field, dir] of Object.entries(this._sort)) {
          const col = toDbCol(field);
          parts.push(`${col} ${dir === -1 ? 'DESC' : 'ASC'}`);
        }
        sql += ` ORDER BY ${parts.join(', ')}`;
      }

      // Limit
      if (this._limit) {
        sql += ` LIMIT ${this._limit}`;
      }

      const rows = db.prepare(sql).all(params);
      const docs = rows.map(r => rowToDoc(r));
      resolve(docs);
    } catch (err) {
      reject(err);
    }
  }
}

class HistoryQueryBuilder {
  constructor(query = {}) {
    this._query = query;
    this._sort = null;
    this._limit = null;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  then(resolve, reject) {
    try {
      const db = getDb();
      let sql = 'SELECT * FROM history_entries WHERE 1=1';
      const params = {};

      if (this._query.documentId) {
        sql += ' AND document_id = @documentId';
        params.documentId = typeof this._query.documentId === 'object'
          ? this._query.documentId.toString()
          : this._query.documentId;
      }

      // Sort
      if (this._sort) {
        const parts = [];
        for (const [field, dir] of Object.entries(this._sort)) {
          const col = toDbCol(field);
          parts.push(`${col} ${dir === -1 ? 'DESC' : 'ASC'}`);
        }
        sql += ` ORDER BY ${parts.join(', ')}`;
      }

      // Limit
      if (this._limit) {
        sql += ` LIMIT ${this._limit}`;
      }

      const rows = db.prepare(sql).all(params);
      const entries = rows.map(r => rowToHistoryEntry(r));
      resolve(entries);
    } catch (err) {
      reject(err);
    }
  }
}

// ============ Fake User model (local: countDocuments always returns 1) ============

const UserModel = {
  countDocuments: () => Promise.resolve(1),
  find: () => Promise.resolve([]),
  findById: () => Promise.resolve({ _id: 'local-user', name: 'Moi', color: '#4ECDC4' }),
};

module.exports = {
  Document: DocumentModel,
  HistoryEntry: HistoryEntryModel,
  User: UserModel,
};
