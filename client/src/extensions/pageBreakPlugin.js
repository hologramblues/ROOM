import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { extractElementsFromDoc } from '../utils/helpers';

const pageBreakPluginKey = new PluginKey('pageBreaks');

function createPageBreakPlugin(computePageInfoFn, stripHtmlFn, darkModeRef) {
  return new Plugin({
    key: pageBreakPluginKey,
    props: {
      decorations: (state) => {
        const els = extractElementsFromDoc(state.doc);
        if (els.length === 0) return DecorationSet.empty;
        const { pageBreaks, pageNumbers } = computePageInfoFn(els);
        if (pageBreaks.size === 0) return DecorationSet.empty;
        const decorations = [];
        let nodeIndex = 0;

        const dm = darkModeRef.current;
        const numColor = dm ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

        state.doc.forEach((node, pos) => {
          if (node.type.name === 'screenplayElement' && pageBreaks.has(nodeIndex)) {
            const pageNum = pageNumbers[nodeIndex] || '';
            decorations.push(Decoration.widget(pos, () => {
              const wrapper = document.createElement('div');
              wrapper.className = 'page-break-decoration';
              wrapper.setAttribute('contenteditable', 'false');
              wrapper.style.cssText = `
                margin-left: -38mm; margin-right: -25mm;
                user-select: none; pointer-events: none;
              `;

              const bottomMargin = document.createElement('div');
              bottomMargin.style.cssText = 'height: 15mm;';
              wrapper.appendChild(bottomMargin);

              const gap = document.createElement('div');
              gap.className = 'page-break-gap';
              gap.style.cssText = 'height: 24px;';
              wrapper.appendChild(gap);

              const topMargin = document.createElement('div');
              topMargin.style.cssText = `
                height: 13mm;
                display: flex;
                align-items: flex-start;
                justify-content: flex-end;
              `;
              const num = document.createElement('span');
              num.textContent = pageNum + '.';
              num.style.cssText = `
                font-family: 'Courier Prime', 'Courier New', monospace;
                font-size: 10pt; color: ${numColor};
                margin-top: 4mm; margin-right: 2mm;
              `;
              topMargin.appendChild(num);
              wrapper.appendChild(topMargin);

              return wrapper;
            }, { side: -1, key: 'pb-' + nodeIndex }));
          }
          nodeIndex++;
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export { createPageBreakPlugin, pageBreakPluginKey };
