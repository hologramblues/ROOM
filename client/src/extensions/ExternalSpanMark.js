import { Mark } from '@tiptap/core';

/**
 * Permissive mark that lets ProseMirror parse <span> elements injected by
 * browser extensions (LanguageTool, Grammarly, etc.) without crashing.
 *
 * Without this, ProseMirror's MutationObserver detects the foreign spans,
 * fails to reconcile them against the schema, and throws.
 *
 * - Low priority so CommentMark / SuggestionMark take precedence.
 * - `excludes: ''` — coexists with every other mark.
 * - `inclusive: false` — typing at edges doesn't extend the mark.
 */
const ExternalSpanMark = Mark.create({
  name: 'externalSpan',
  priority: 50,
  excludes: '',
  inclusive: false,

  parseHTML() {
    return [{
      tag: 'span',
      getAttrs: (el) => {
        // Skip spans that belong to our own marks
        if (el.hasAttribute('data-comment-id')) return false;
        if (el.hasAttribute('data-suggestion-id')) return false;
        if (el.hasAttribute('data-suggestion-display')) return false;
        return {};
      },
    }];
  },

  renderHTML() {
    return ['span', 0];
  },
});

export default ExternalSpanMark;
