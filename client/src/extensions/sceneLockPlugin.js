import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const sceneLockPluginKey = new PluginKey('sceneLock');

function createSceneLockPlugin(lockedScenesRef) {
  function buildSceneMap(doc) {
    const sceneForIndex = [];
    let currentSceneId = null;
    doc.forEach((node, _offset, index) => {
      if (node.type.name === 'screenplayElement' && node.attrs.elementType === 'scene') {
        currentSceneId = node.attrs.elementId;
      }
      sceneForIndex[index] = currentSceneId;
    });
    return sceneForIndex;
  }

  return new Plugin({
    key: sceneLockPluginKey,
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      const locked = lockedScenesRef.current;
      if (!locked || locked.size === 0) return true;

      const sceneForIndex = buildSceneMap(state.doc);

      for (let i = 0; i < tr.steps.length; i++) {
        const step = tr.steps[i];
        const map = step.getMap();
        let blocked = false;
        map.forEach((oldStart, oldEnd) => {
          if (blocked) return;
          state.doc.forEach((node, offset, index) => {
            if (blocked) return;
            const nodeEnd = offset + node.nodeSize;
            if (oldStart < nodeEnd && oldEnd > offset) {
              const sceneId = sceneForIndex[index];
              if (sceneId && locked.has(sceneId)) {
                blocked = true;
              }
            }
          });
        });
        if (blocked) return false;
      }
      return true;
    },
    props: {
      decorations(state) {
        const locked = lockedScenesRef.current;
        if (!locked || locked.size === 0) return DecorationSet.empty;
        const sceneForIndex = buildSceneMap(state.doc);
        const decorations = [];
        state.doc.forEach((node, offset, index) => {
          const sceneId = sceneForIndex[index];
          if (sceneId && locked.has(sceneId)) {
            decorations.push(Decoration.node(offset, offset + node.nodeSize, { class: 'locked-scene-element', style: 'opacity: 0.55; pointer-events: auto;' }));
          }
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export { createSceneLockPlugin, sceneLockPluginKey };
