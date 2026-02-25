import { useCallback } from 'react';
import { stripHtml } from '../utils/helpers';
import { TYPE_TO_FDX } from '../constants/elementTypes';

export default function useExportHandlers({ elementsRef, titleRef }) {
  const exportFDX = useCallback(() => {
    const elements = elementsRef.current;
    const title = titleRef.current;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<FinalDraft DocumentType="Script" Version="3">\n<Content>\n';
    elements.forEach(el => { xml += '<Paragraph Type="' + (TYPE_TO_FDX[el.type] || 'Action') + '"><Text>' + esc(stripHtml(el.content)) + '</Text></Paragraph>\n'; });
    xml += '</Content>\n</FinalDraft>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' })); a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fdx'; a.click();
  }, [elementsRef, titleRef]);

  const exportPDF = useCallback(() => {
    const elements = elementsRef.current;
    const title = titleRef.current;
    const printWindow = window.open('', '_blank');
    const styles = `body { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 12pt; line-height: 1; margin: 1in; } .scene { text-transform: uppercase; font-weight: bold; margin-top: 2em; } .action { margin-top: 1em; } .character { text-transform: uppercase; font-weight: bold; margin-left: 37%; margin-top: 1em; } .dialogue { margin-left: 17%; width: 42%; } .parenthetical { margin-left: 27%; font-style: italic; } .transition { text-transform: uppercase; text-align: right; margin-top: 1em; } @media print { @page { margin: 1in; } }`;
    let html = `<!DOCTYPE html><html><head><title>${title}</title><style>${styles}</style></head><body>`;
    elements.forEach(el => { html += `<p class="${el.type}">${el.content || '&nbsp;'}</p>`; });
    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }, [elementsRef, titleRef]);

  const exportFountain = useCallback(() => {
    const elements = elementsRef.current;
    const title = titleRef.current;
    let fountain = `Title: ${title}\nCredit: written by\nAuthor: \nDraft date: ${new Date().toLocaleDateString('fr-FR')}\n\n`;

    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          fountain += `\n${t.toUpperCase()}\n\n`;
          break;
        case 'action':
          fountain += `${t}\n\n`;
          break;
        case 'character':
          fountain += `${t.toUpperCase()}\n`;
          break;
        case 'dialogue':
          fountain += `${t}\n\n`;
          break;
        case 'parenthetical':
          fountain += `${t.startsWith('(') ? t : '(' + t + ')'}\n`;
          break;
        case 'transition':
          fountain += `\n> ${t.toUpperCase()}\n\n`;
          break;
        default:
          fountain += `${t}\n\n`;
      }
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([fountain], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.fountain';
    a.click();
  }, [elementsRef, titleRef]);

  const exportTXT = useCallback(() => {
    const elements = elementsRef.current;
    const title = titleRef.current;
    let txt = `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n`;

    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          txt += `\n${t.toUpperCase()}\n\n`;
          break;
        case 'action':
          txt += `${t}\n\n`;
          break;
        case 'character':
          txt += `\t\t\t${t.toUpperCase()}\n`;
          break;
        case 'dialogue':
          txt += `\t\t${t}\n\n`;
          break;
        case 'parenthetical':
          txt += `\t\t${t.startsWith('(') ? t : '(' + t + ')'}\n`;
          break;
        case 'transition':
          txt += `\n\t\t\t\t\t${t.toUpperCase()}\n\n`;
          break;
        default:
          txt += `${t}\n\n`;
      }
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.txt';
    a.click();
  }, [elementsRef, titleRef]);

  const exportMarkdown = useCallback(() => {
    const elements = elementsRef.current;
    const title = titleRef.current;
    let md = `# ${title}\n\n`;
    md += `*Exporté le ${new Date().toLocaleDateString('fr-FR')}*\n\n---\n\n`;

    let currentScene = 0;
    elements.forEach(el => {
      const t = stripHtml(el.content);
      switch (el.type) {
        case 'scene':
          currentScene++;
          md += `## Scène ${currentScene}: ${t}\n\n`;
          break;
        case 'action':
          md += `*${t}*\n\n`;
          break;
        case 'character':
          md += `**${t.toUpperCase()}**\n`;
          break;
        case 'dialogue':
          md += `> ${t}\n\n`;
          break;
        case 'parenthetical':
          md += `*(${t.replace(/[()]/g, '')})*\n`;
          break;
        case 'transition':
          md += `\n**${t.toUpperCase()}**\n\n---\n\n`;
          break;
        default:
          md += `${t}\n\n`;
      }
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = title.toLowerCase().replace(/\s+/g, '-') + '.md';
    a.click();
  }, [elementsRef, titleRef]);

  return { exportFDX, exportPDF, exportFountain, exportTXT, exportMarkdown };
}
