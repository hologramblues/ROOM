import React from 'react';

const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const stripHtml = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
};

function buildDocFromElements(els) {
  if (!els || els.length === 0) {
    return { type: 'doc', content: [{ type: 'screenplayElement', attrs: { elementId: generateId(), elementType: 'action' } }] };
  }
  return {
    type: 'doc',
    content: els.map(el => ({
      type: 'screenplayElement',
      attrs: { elementId: el.id, elementType: el.type || 'action' },
      content: el.content && stripHtml(el.content).length > 0
        ? [{ type: 'text', text: stripHtml(el.content) }]
        : [],
    })),
  };
}

function extractElementsFromDoc(doc) {
  const result = [];
  doc.forEach(node => {
    if (node.type.name === 'screenplayElement') {
      result.push({
        id: node.attrs.elementId || generateId(),
        type: node.attrs.elementType || 'action',
        content: node.textContent || '',
      });
    }
  });
  return result;
}

function elementsEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].type !== b[i].type || a[i].content !== b[i].content) return false;
  }
  return true;
}

const getInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/[\s]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const match = name.match(/[A-Z]/g);
  if (match && match.length >= 2) {
    return match.slice(0, 2).join('');
  }
  return name.slice(0, 2).toUpperCase();
};

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const renderWithMentions = (text, darkMode) => {
  if (!text) return '';
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={i}
          style={{
            color: '#3b82f6',
            fontWeight: 600,
            background: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            padding: '1px 4px',
            borderRadius: 3
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

/**
 * Compute granular diffs between two element arrays.
 * Returns { updates, inserts, deletes } using element IDs for reliable matching.
 *
 * @param {Array} oldEls - Previous elements array
 * @param {Array} newEls - New elements array
 * @returns {{ updates: Array, inserts: Array, deletes: Array }}
 */
function computeElementDiffs(oldEls, newEls) {
  const updates = [];
  const inserts = [];
  const deletes = [];

  if (!oldEls || !newEls) return { updates, inserts, deletes };

  // Build lookup maps by ID
  const oldMap = new Map();
  oldEls.forEach((el, i) => oldMap.set(el.id, { el, index: i }));

  const newMap = new Map();
  newEls.forEach((el, i) => newMap.set(el.id, { el, index: i }));

  // Detect updates and inserts by walking newEls
  for (let i = 0; i < newEls.length; i++) {
    const el = newEls[i];
    const old = oldMap.get(el.id);
    if (old) {
      // Element exists in both — check if content or type changed
      if (old.el.content !== el.content || old.el.type !== el.type) {
        updates.push({ index: i, element: el });
      }
    } else {
      // New element — find the preceding element ID for afterElementId
      const afterElementId = i > 0 ? newEls[i - 1].id : null;
      inserts.push({ afterIndex: i - 1, afterElementId, element: el });
    }
  }

  // Detect deletes by walking oldEls
  for (let i = 0; i < oldEls.length; i++) {
    const el = oldEls[i];
    if (!newMap.has(el.id)) {
      deletes.push({ index: i, elementId: el.id });
    }
  }

  return { updates, inserts, deletes };
}

export { escapeHtml, stripHtml, generateId, buildDocFromElements, extractElementsFromDoc, elementsEqual, computeElementDiffs, getInitials, formatTime, renderWithMentions };
