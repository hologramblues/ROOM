import { Node, mergeAttributes } from '@tiptap/core';
import { SP_NEXT_TYPE, SP_EMPTY_ENTER, SP_TAB_FWD, SP_TAB_REV } from '../constants/elementTypes';

const ScreenplayElement = Node.create({
  name: 'screenplayElement',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      elementId: {
        default: null,
        parseHTML: el => el.getAttribute('data-element-id'),
        renderHTML: attrs => ({ 'data-element-id': attrs.elementId }),
      },
      elementType: {
        default: 'action',
        parseHTML: el => el.getAttribute('data-element-type') || 'action',
        renderHTML: attrs => ({ 'data-element-type': attrs.elementType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-screenplay-element]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-element-type'] || 'action';
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-screenplay-element': 'true',
      class: `screenplay-${type}`,
    }), 0];
  },

  addCommands() {
    return {
      splitScreenplayElement: () => ({ tr, state, dispatch, editor }) => {
        const { $from, from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;

        const currentType = node.attrs.elementType;
        const atStart = $from.parentOffset === 0;
        const atEnd = $from.parentOffset >= node.content.size;
        const isEmpty = node.content.size === 0;
        const nodeStart = $from.before();

        // Auto-close parenthetical
        if (currentType === 'parenthetical' && !isEmpty) {
          const text = node.textContent;
          let fixed = text;
          if (!fixed.startsWith('(')) fixed = '(' + fixed;
          if (!fixed.endsWith(')')) fixed = fixed + ')';
          if (fixed !== text) {
            tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
            tr.insertText(fixed, nodeStart + 1);
          }
        }

        if (isEmpty) {
          const target = SP_EMPTY_ENTER(currentType);
          if (target) {
            tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: target });
            if (dispatch) dispatch(tr);
            return true;
          } else {
            // Empty action: create a new empty action below (like a line break)
            const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
            const insertPos = nodeStart + node.nodeSize;
            const newNode = state.schema.nodes.screenplayElement.create(
              { elementId: newId, elementType: 'action' },
              null
            );
            tr.insert(insertPos, newNode);
            tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1)));
            if (dispatch) dispatch(tr);
            return true;
          }
        }

        if (atEnd) {
          const nextType = SP_NEXT_TYPE[currentType] || 'action';
          const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          const insertPos = nodeStart + node.nodeSize;
          const newNode = state.schema.nodes.screenplayElement.create(
            { elementId: newId, elementType: nextType },
            null
          );
          tr.insert(insertPos, newNode);
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(insertPos + 1)));
          if (dispatch) dispatch(tr);
          return true;
        }

        if (atStart) {
          const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          const newNode = state.schema.nodes.screenplayElement.create(
            { elementId: newId, elementType: currentType },
            null
          );
          tr.insert(nodeStart, newNode);
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nodeStart + newNode.nodeSize + 1)));
          if (dispatch) dispatch(tr);
          return true;
        }

        // Mid-block split
        const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        tr.split(from, 1, [{ type: state.schema.nodes.screenplayElement, attrs: { elementId: newId, elementType: currentType } }]);
        if (dispatch) dispatch(tr);
        return true;
      },

      cycleType: (reverse) => ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;

        const currentType = node.attrs.elementType;
        const nodeStart = $from.before();

        // Determine target type
        let newType;
        if (currentType === 'dialogue' || currentType === 'parenthetical') {
          // Toggle between dialogue and parenthetical (Final Draft behavior)
          newType = currentType === 'dialogue' ? 'parenthetical' : 'dialogue';
        } else {
          const cycle = reverse ? SP_TAB_REV : SP_TAB_FWD;
          newType = cycle[currentType] || 'action';
        }

        // When LEAVING parenthetical: auto-close parentheses
        if (currentType === 'parenthetical' && newType !== 'parenthetical' && node.content.size > 0) {
          const text = node.textContent;
          let fixed = text;
          if (!fixed.startsWith('(')) fixed = '(' + fixed;
          if (!fixed.endsWith(')')) fixed = fixed + ')';
          if (fixed !== text) {
            tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
            tr.insertText(fixed, nodeStart + 1);
          }
        }

        // When ENTERING parenthetical: add () if empty, or wrap existing text
        if (newType === 'parenthetical' && currentType !== 'parenthetical') {
          if (node.content.size === 0) {
            // Empty element → insert "()" and place cursor between them
            tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: newType });
            tr.insertText('()', nodeStart + 1);
            // Place cursor between the parentheses
            tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nodeStart + 2)));
            if (dispatch) dispatch(tr);
            return true;
          } else {
            const text = node.textContent;
            if (!text.startsWith('(') || !text.endsWith(')')) {
              let fixed = text;
              if (!fixed.startsWith('(')) fixed = '(' + fixed;
              if (!fixed.endsWith(')')) fixed = fixed + ')';
              tr.delete(nodeStart + 1, nodeStart + 1 + node.content.size);
              tr.insertText(fixed, nodeStart + 1);
            }
          }
        }

        tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: newType });
        if (dispatch) dispatch(tr);
        return true;
      },

      setScreenplayType: (type) => ({ tr, state, dispatch }) => {
        const { $from } = state.selection;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;
        const nodeStart = $from.before();
        tr.setNodeMarkup(nodeStart, null, { ...node.attrs, elementType: type });
        if (dispatch) dispatch(tr);
        return true;
      },

      handleScreenplayBackspace: () => ({ tr, state, dispatch, editor }) => {
        const { $from, empty } = state.selection;
        if (!empty) return false;
        const node = $from.parent;
        if (node.type.name !== 'screenplayElement') return false;
        if ($from.parentOffset !== 0) return false;

        const nodeStart = $from.before();
        const $nodePos = state.doc.resolve(nodeStart);
        const indexInDoc = $nodePos.index($nodePos.depth);

        console.log('[Backspace] At start of element', indexInDoc, '| type:', node.attrs.elementType, '| content:', JSON.stringify(node.textContent), '| contentSize:', node.content.size);

        if (indexInDoc === 0) {
          console.log('[Backspace] First element, cannot merge backward');
          return true;
        }

        const prevNode = state.doc.child(indexInDoc - 1);
        const prevStart = nodeStart - prevNode.nodeSize;
        const currentIsEmpty = node.content.size === 0;
        const prevIsEmpty = prevNode.content.size === 0;

        console.log('[Backspace] prev type:', prevNode.attrs.elementType, '| prevContent:', JSON.stringify(prevNode.textContent), '| currentEmpty:', currentIsEmpty, '| prevEmpty:', prevIsEmpty);

        if (currentIsEmpty && state.doc.childCount > 1) {
          console.log('[Backspace] Deleting empty current node');
          tr.delete(nodeStart, nodeStart + node.nodeSize);
          const targetPos = prevStart + 1 + prevNode.content.size;
          tr.setSelection(state.selection.constructor.near(tr.doc.resolve(Math.min(targetPos, tr.doc.content.size))));
          if (dispatch) dispatch(tr);
          return true;
        }

        if (prevIsEmpty) {
          console.log('[Backspace] Deleting empty previous node');
          tr.delete(prevStart, prevStart + prevNode.nodeSize);
          if (dispatch) dispatch(tr);
          return true;
        }

        console.log('[Backspace] Merging two content nodes. prevStart:', prevStart, 'nodeStart:', nodeStart, 'prevContentSize:', prevNode.content.size, 'curContentSize:', node.content.size);

        const prevContentEnd = prevStart + 1 + prevNode.content.size;
        const currentContent = node.content;

        tr.delete(nodeStart, nodeStart + node.nodeSize);
        console.log('[Backspace] After delete, doc size:', tr.doc.content.size);

        if (currentContent.size > 0) {
          tr.insert(prevContentEnd, currentContent);
          console.log('[Backspace] Inserted content at', prevContentEnd, ', doc size now:', tr.doc.content.size);
        }

        const cursorPos = Math.min(prevContentEnd, tr.doc.content.size);
        tr.setSelection(state.selection.constructor.near(tr.doc.resolve(cursorPos)));
        console.log('[Backspace] Cursor set at', cursorPos);
        if (dispatch) dispatch(tr);
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Enter': () => this.editor.commands.splitScreenplayElement(),
      'Tab': () => this.editor.commands.cycleType(false),
      'Shift-Tab': () => this.editor.commands.cycleType(true),
      'Backspace': () => this.editor.commands.handleScreenplayBackspace(),
      'Mod-1': () => this.editor.commands.setScreenplayType('scene'),
      'Mod-2': () => this.editor.commands.setScreenplayType('action'),
      'Mod-3': () => this.editor.commands.setScreenplayType('character'),
      'Mod-4': () => this.editor.commands.setScreenplayType('dialogue'),
      'Mod-5': () => this.editor.commands.setScreenplayType('parenthetical'),
      'Mod-6': () => this.editor.commands.setScreenplayType('transition'),
    };
  },
});

export default ScreenplayElement;
