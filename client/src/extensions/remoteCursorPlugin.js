import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const remoteCursorPluginKey = new PluginKey('remoteCursors');

/**
 * ProseMirror plugin that renders remote user cursors as colored line decorations.
 * @param {React.MutableRefObject} remoteCursorsRef - Ref containing array of { id, name, color, cursor: { index, position } }
 */
export function createRemoteCursorPlugin(remoteCursorsRef) {
  return new Plugin({
    key: remoteCursorPluginKey,
    props: {
      decorations(state) {
        const cursors = remoteCursorsRef.current;
        if (!cursors || cursors.length === 0) return DecorationSet.empty;

        const decorations = [];
        const doc = state.doc;

        cursors.forEach(user => {
          if (!user.cursor || user.cursor.index == null) return;
          const { index, position } = user.cursor;
          if (index < 0 || index >= doc.childCount) return;

          // Calculate absolute position in doc
          let pos = 0;
          for (let i = 0; i < index; i++) {
            pos += doc.child(i).nodeSize;
          }
          const node = doc.child(index);
          const cursorPos = pos + 1 + Math.min(position || 0, node.content.size); // +1 to enter node

          // Create cursor line widget
          const cursorWidget = Decoration.widget(cursorPos, () => {
            const wrapper = document.createElement('span');
            wrapper.className = 'remote-cursor';
            wrapper.style.cssText = `
              position: relative;
              border-left: 2px solid ${user.color || '#3b82f6'};
              margin-left: -1px;
              pointer-events: none;
            `;

            // Name label
            const label = document.createElement('span');
            label.className = 'remote-cursor-label';
            label.textContent = user.name || 'User';
            label.style.cssText = `
              position: absolute;
              bottom: 100%;
              left: -1px;
              background: ${user.color || '#3b82f6'};
              color: white;
              font-size: 10px;
              font-family: -apple-system, sans-serif;
              padding: 1px 4px;
              border-radius: 3px 3px 3px 0;
              white-space: nowrap;
              line-height: 1.3;
              pointer-events: none;
              z-index: 10;
            `;
            wrapper.appendChild(label);

            return wrapper;
          }, { side: 1, key: `cursor-${user.id}` });

          decorations.push(cursorWidget);
        });

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}
