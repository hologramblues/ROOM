import { useMemo, useEffect } from 'react';

/**
 * Pre-computes highlight data per element for comments and suggestions.
 * Returns a map of elementId -> array of highlight entries, used by SingleEditor
 * to render TipTap marks (CommentMark / SuggestionMark).
 *
 * Also cleans up any leftover CSS Highlight API entries (V272 migration).
 */
export default function useHighlights({ comments, suggestions, pendingInlineComment, currentUser }) {
  // Pre-compute highlights per element (memoized for performance)
  const highlightsByElement = useMemo(() => {
    const map = {};

    // Process comments (supports multi-element spans)
    comments.forEach(c => {
      if (c.resolved) return;
      const commentId = String(c.id || c._id);
      if (c.spans && c.spans.length > 0) {
        // Multi-element comment: add a highlight entry for each spanned element
        c.spans.forEach(span => {
          if (!span.elementId) return;
          if (!map[span.elementId]) map[span.elementId] = [];
          map[span.elementId].push({
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            type: 'comment',
            id: commentId,
            userColor: c.userColor
          });
        });
      } else if (c.elementId && c.highlight) {
        // Single-element comment (backward compat)
        if (!map[c.elementId]) map[c.elementId] = [];
        map[c.elementId].push({
          startOffset: c.highlight.startOffset,
          endOffset: c.highlight.endOffset,
          type: 'comment',
          id: commentId,
          userColor: c.userColor
        });
      }
    });

    // Process suggestions
    suggestions.forEach(s => {
      if (s.elementId && s.status === 'pending') {
        if (!map[s.elementId]) map[s.elementId] = [];
        map[s.elementId].push({
          startOffset: s.startOffset,
          endOffset: s.endOffset,
          type: 'suggestion',
          id: String(s.id || s._id),
          originalText: s.originalText,
          suggestedText: s.suggestedText,
          userColor: s.userColor
        });
      }
    });

    // Show pending comment highlight immediately (before comment is submitted)
    if (pendingInlineComment && pendingInlineComment.elementId) {
      if (pendingInlineComment.spans && pendingInlineComment.spans.length > 0) {
        pendingInlineComment.spans.forEach(span => {
          if (!span.elementId) return;
          if (!map[span.elementId]) map[span.elementId] = [];
          map[span.elementId].push({
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            type: 'comment',
            id: 'pending-comment',
            userColor: currentUser?.color || '#f59e0b'
          });
        });
      } else {
        if (!map[pendingInlineComment.elementId]) map[pendingInlineComment.elementId] = [];
        map[pendingInlineComment.elementId].push({
          startOffset: pendingInlineComment.startOffset,
          endOffset: pendingInlineComment.endOffset,
          type: 'comment',
          id: 'pending-comment',
          userColor: currentUser?.color || '#f59e0b'
        });
      }
    }

    // Sort each element's highlights
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.startOffset - b.startOffset);
    });

    return map;
  }, [comments, suggestions, pendingInlineComment, currentUser]);

  // V272: CSS Highlight API replaced by TipTap marks (applied in SingleEditor)
  // Clean up any leftover CSS highlights
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete('comment-highlight');
      CSS.highlights.delete('suggestion-highlight');
    }
  }, []);

  return { highlightsByElement };
}
