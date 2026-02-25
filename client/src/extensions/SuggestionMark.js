import { Mark, mergeAttributes } from '@tiptap/core';

const SuggestionMark = Mark.create({
  name: 'suggestion',

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => {
          if (!attributes.suggestionId) return {};
          return { 'data-suggestion-id': attributes.suggestionId };
        },
      },
      suggestedText: {
        default: '',
        parseHTML: element => element.getAttribute('data-suggested-text'),
        renderHTML: attributes => {
          return { 'data-suggested-text': attributes.suggestedText || '' };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-suggestion-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({
      'data-suggestion-id': HTMLAttributes['data-suggestion-id'],
      'data-suggested-text': HTMLAttributes['data-suggested-text'],
      style: 'cursor: pointer;',
    }),
      ['span', { style: 'text-decoration: line-through; color: #dc2626; background: rgba(220, 38, 38, 0.1);' }, 0],
      ['span', {
        style: 'color: #16a34a; background: rgba(22, 163, 74, 0.1); margin-left: 2px;',
        contenteditable: 'false',
        'data-suggestion-display': 'true',
      }, HTMLAttributes['data-suggested-text'] || ''],
    ];
  },
});

export default SuggestionMark;
