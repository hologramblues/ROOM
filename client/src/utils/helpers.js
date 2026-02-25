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

export { escapeHtml, stripHtml, generateId, buildDocFromElements, extractElementsFromDoc, elementsEqual, getInitials, formatTime, renderWithMentions };
