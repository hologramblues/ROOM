// TipTap Prototype - Test suggestions and comments marks
// This is a standalone test component to validate the approach

import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes } from '@tiptap/core';

// ============ CUSTOM MARK: COMMENT HIGHLIGHT ============
const CommentMark = Mark.create({
  name: 'comment',
  
  addAttributes() {
    return {
      commentId: {
        default: null,
      },
      color: {
        default: '#fbbf24',
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-comment-id': HTMLAttributes.commentId,
        style: `background-color: rgba(251, 191, 36, 0.4); border-radius: 2px; cursor: pointer;`,
      }),
      0,
    ];
  },
});

// ============ CUSTOM MARK: SUGGESTION ============
// This mark shows: strikethrough original + green suggestion text
const SuggestionMark = Mark.create({
  name: 'suggestion',
  
  // Don't allow other marks inside suggestions
  inclusive: false,
  
  addAttributes() {
    return {
      suggestionId: {
        default: null,
      },
      suggestedText: {
        default: '',
      },
      color: {
        default: '#16a34a',
      },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    // We render the original text with strikethrough
    // and append the suggestion after it
    return [
      'span',
      mergeAttributes({
        'data-suggestion-id': HTMLAttributes.suggestionId,
        'data-suggested-text': HTMLAttributes.suggestedText,
        style: 'cursor: pointer;',
        class: 'suggestion-mark',
      }),
      [
        'span',
        { style: 'text-decoration: line-through; color: #dc2626; background: rgba(220, 38, 38, 0.1);' },
        0, // This is where the original (marked) content goes
      ],
      [
        'span',
        { 
          style: 'color: #16a34a; background: rgba(22, 163, 74, 0.1); margin-left: 2px;',
          contenteditable: 'false',
        },
        HTMLAttributes.suggestedText || '',
      ],
    ];
  },
});

// ============ SUGGESTIONS LIST COMPONENT ============
const SuggestionsList = ({ editor, onAccept, onReject }) => {
  const [suggestions, setSuggestions] = useState([]);
  
  useEffect(() => {
    if (!editor) return;
    
    const updateSuggestions = () => {
      const found = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.isText) {
          const mark = node.marks.find(m => m.type.name === 'suggestion');
          if (mark) {
            found.push({
              id: mark.attrs.suggestionId,
              originalText: node.text,
              suggestedText: mark.attrs.suggestedText,
              from: pos,
              to: pos + node.nodeSize,
            });
          }
        }
      });
      setSuggestions(found);
    };
    
    updateSuggestions();
    editor.on('update', updateSuggestions);
    editor.on('selectionUpdate', updateSuggestions);
    return () => {
      editor.off('update', updateSuggestions);
      editor.off('selectionUpdate', updateSuggestions);
    };
  }, [editor]);
  
  if (suggestions.length === 0) {
    return <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Aucune suggestion active. Sélectionnez du texte et cliquez "Ajouter Suggestion".</p>;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {suggestions.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'white', borderRadius: 4, border: '1px solid #e5e7eb' }}>
          <span style={{ flex: 1 }}>
            <span style={{ textDecoration: 'line-through', color: '#dc2626' }}>{s.originalText}</span>
            {' → '}
            <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{s.suggestedText}</span>
          </span>
          <button 
            onClick={() => onAccept(s.id)}
            style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            ✅ Accepter
          </button>
          <button 
            onClick={() => onReject(s.id)}
            style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            ❌ Rejeter
          </button>
        </div>
      ))}
    </div>
  );
};

// ============ COMMENTS LIST COMPONENT ============
const CommentsList = ({ editor, onRemove }) => {
  const [comments, setComments] = useState([]);
  
  useEffect(() => {
    if (!editor) return;
    
    const updateComments = () => {
      const found = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.isText) {
          const mark = node.marks.find(m => m.type.name === 'comment');
          if (mark) {
            found.push({
              id: mark.attrs.commentId,
              text: node.text,
              from: pos,
              to: pos + node.nodeSize,
            });
          }
        }
      });
      setComments(found);
    };
    
    updateComments();
    editor.on('update', updateComments);
    return () => editor.off('update', updateComments);
  }, [editor]);
  
  if (comments.length === 0) {
    return <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Aucun commentaire. Sélectionnez du texte et cliquez "Ajouter Commentaire".</p>;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {comments.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'white', borderRadius: 4, border: '1px solid #fbbf24' }}>
          <span style={{ flex: 1, background: 'rgba(251, 191, 36, 0.3)', padding: '2px 6px', borderRadius: 2 }}>
            {c.text}
          </span>
          <button 
            onClick={() => onRemove(c.id)}
            style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            🗑️ Retirer
          </button>
        </div>
      ))}
    </div>
  );
};

// ============ TIPTAP EDITOR COMPONENT ============
const TipTapPrototype = () => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            style: 'font-family: "Courier Prime", monospace; font-size: 12pt; line-height: 1.5; margin: 0;',
          },
        },
      }),
      CommentMark,
      SuggestionMark,
    ],
    content: `
      <p>Voici une ligne de dialogue avec un mot commenté et une suggestion.</p>
      <p>Cette ligne contient du texte normal sans annotations.</p>
      <p>Une autre ligne pour tester le comportement de l'éditeur.</p>
    `,
    editorProps: {
      attributes: {
        style: 'outline: none; padding: 20px; min-height: 200px; font-family: "Courier Prime", monospace;',
      },
    },
  });

  // Add a comment to selected text
  const addComment = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) {
      alert('Sélectionnez du texte d\'abord');
      return;
    }
    
    const commentId = 'comment-' + Date.now();
    editor.chain().focus().setMark('comment', { commentId }).run();
  }, [editor]);

  // Add a suggestion to selected text
  const addSuggestion = useCallback(() => {
    if (!editor) return;
    
    const { from, to } = editor.state.selection;
    if (from === to) {
      alert('Sélectionnez du texte d\'abord');
      return;
    }
    
    const selectedText = editor.state.doc.textBetween(from, to);
    const suggestedText = prompt('Texte suggéré pour remplacer "' + selectedText + '":', selectedText);
    
    if (suggestedText !== null && suggestedText !== selectedText) {
      const suggestionId = 'suggestion-' + Date.now();
      editor.chain().focus().setMark('suggestion', { suggestionId, suggestedText }).run();
    }
  }, [editor]);

  // Accept a suggestion (replace original with suggested text)
  const acceptSuggestion = useCallback((suggestionId) => {
    if (!editor) return;
    
    // Find the suggestion mark in the document
    const { doc } = editor.state;
    let suggestionPos = null;
    let suggestionMark = null;
    let nodeSize = 0;
    
    doc.descendants((node, pos) => {
      if (node.isText) {
        const mark = node.marks.find(m => m.type.name === 'suggestion' && m.attrs.suggestionId === suggestionId);
        if (mark) {
          suggestionPos = pos;
          nodeSize = node.nodeSize;
          suggestionMark = mark;
          return false;
        }
      }
    });
    
    if (suggestionPos !== null && suggestionMark) {
      const suggestedText = suggestionMark.attrs.suggestedText;
      const from = suggestionPos;
      const to = suggestionPos + nodeSize;
      
      console.log('Accepting suggestion:', { from, to, suggestedText, nodeSize });
      
      // Create transaction
      const tr = editor.state.tr;
      
      // First remove the mark
      tr.removeMark(from, to, editor.state.schema.marks.suggestion);
      
      // Then delete the old text and insert new text (without any marks)
      tr.delete(from, to);
      tr.insertText(suggestedText, from);
      
      // Dispatch
      editor.view.dispatch(tr);
    }
  }, [editor]);

  // Reject a suggestion (remove the mark, keep original text)
  const rejectSuggestion = useCallback((suggestionId) => {
    if (!editor) return;
    
    const { doc } = editor.state;
    let suggestionPos = null;
    
    doc.descendants((node, pos) => {
      if (node.isText) {
        const mark = node.marks.find(m => m.type.name === 'suggestion' && m.attrs.suggestionId === suggestionId);
        if (mark) {
          suggestionPos = { from: pos, to: pos + node.nodeSize };
          return false;
        }
      }
    });
    
    if (suggestionPos) {
      editor.chain()
        .focus()
        .setTextSelection(suggestionPos)
        .unsetMark('suggestion')
        .run();
    }
  }, [editor]);

  // Remove a comment
  const removeComment = useCallback((commentId) => {
    if (!editor) return;
    
    const { doc } = editor.state;
    let commentPos = null;
    
    doc.descendants((node, pos) => {
      if (node.isText) {
        const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.commentId === commentId);
        if (mark) {
          commentPos = { from: pos, to: pos + node.nodeSize };
          return false;
        }
      }
    });
    
    if (commentPos) {
      editor.chain()
        .focus()
        .setTextSelection(commentPos)
        .unsetMark('comment')
        .run();
    }
  }, [editor]);

  // Get current content as HTML
  const getHTML = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const json = editor.getJSON();
    console.log('=== HTML ===');
    console.log(html);
    console.log('=== JSON ===');
    console.log(JSON.stringify(json, null, 2));
    alert('Contenu logué dans la console (F12)');
  }, [editor]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'system-ui', padding: '0 20px' }}>
      <h1 style={{ marginBottom: 20 }}>TipTap Prototype - Comments & Suggestions <span style={{ fontSize: 14, color: '#666', fontWeight: 'normal' }}>v4</span></h1>
      
      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        gap: 10, 
        marginBottom: 20, 
        padding: 10, 
        background: '#f3f4f6', 
        borderRadius: 8,
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={addComment}
          style={{ padding: '8px 16px', background: '#fbbf24', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
        >
          💬 Ajouter Commentaire
        </button>
        <button 
          onClick={addSuggestion}
          style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
        >
          ✏️ Ajouter Suggestion
        </button>
        <button 
          onClick={getHTML}
          style={{ padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          📋 Log HTML/JSON
        </button>
      </div>
      
      {/* Editor */}
      <div style={{ 
        border: '2px solid #e5e7eb', 
        borderRadius: 8, 
        background: 'white',
        minHeight: 200,
        marginBottom: 20
      }}>
        <EditorContent editor={editor} />
      </div>
      
      {/* Instructions */}
      <div style={{ padding: 15, background: '#f0fdf4', borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Instructions :</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Sélectionnez du texte dans l'éditeur</li>
          <li>Cliquez sur "Ajouter Commentaire" pour un highlight jaune</li>
          <li>Cliquez sur "Ajouter Suggestion" pour créer une suggestion (texte barré + nouveau texte)</li>
          <li>Utilisez les listes ci-dessous pour accepter/rejeter</li>
        </ol>
      </div>
      
      {/* Comments list */}
      <div style={{ marginBottom: 20, padding: 15, background: '#fffbeb', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>💬 Commentaires :</h3>
        <CommentsList editor={editor} onRemove={removeComment} />
      </div>
      
      {/* Suggestions list */}
      <div style={{ padding: 15, background: '#fef3c7', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>✏️ Suggestions :</h3>
        <SuggestionsList editor={editor} onAccept={acceptSuggestion} onReject={rejectSuggestion} />
      </div>
    </div>
  );
};

export default TipTapPrototype;
