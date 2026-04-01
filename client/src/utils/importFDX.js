import { SERVER_URL } from '../constants/config';
import { FDX_TO_TYPE } from '../constants/elementTypes';
import { generateId } from './helpers';

/**
 * Opens a file picker for .fdx/.xml files, parses the FDX content,
 * and creates a new document on the server with the imported elements.
 */
export default function importFDX({ token, setShowAuthModal, setImporting, loadedDocRef }) {
  console.log('[IMPORT] importFDX called, token:', !!token);
  if (!token) { setShowAuthModal(true); return; }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.fdx,.xml';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = async (e) => {
    console.log('[IMPORT] File selected');
    const file = e.target.files?.[0];

    // Clean up input element
    document.body.removeChild(input);

    if (!file) {
      console.log('[IMPORT] No file selected');
      return;
    }

    setImporting(true);
    console.log('[IMPORT] Starting import of:', file.name);

    try {
      const text = await file.text();
      console.log('[IMPORT] File size:', text.length, 'chars');

      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      // Check for parse errors
      const parseError = xml.querySelector('parsererror');
      if (parseError) {
        throw new Error('Fichier FDX invalide');
      }

      const paragraphs = xml.querySelectorAll('Paragraph');
      console.log('[IMPORT] Found', paragraphs.length, 'paragraphs');

      const newElements = [];
      paragraphs.forEach((p) => {
        const fdxType = p.getAttribute('Type');
        const type = FDX_TO_TYPE[fdxType] || 'action';

        // Get ALL Text nodes and concatenate them
        const textNodes = p.querySelectorAll('Text');
        let content = '';
        textNodes.forEach(t => { content += t.textContent || ''; });

        if (content.trim() || newElements.length === 0) {
          const id = generateId();
          newElements.push({ id, type, content: content.trim(), v: 0 });
        }
      });

      if (newElements.length === 0) {
        newElements.push({ id: generateId(), type: 'scene', content: '', v: 0 });
      }

      // Get title from filename
      const fileName = file.name.replace(/\.fdx$/i, '').toUpperCase();

      console.log('[IMPORT] Creating document with', newElements.length, 'elements, title:', fileName);

      // Create document via API
      const res = await fetch(SERVER_URL + '/api/documents/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title: fileName, elements: newElements })
      });

      console.log('[IMPORT] Server response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('[IMPORT] Document created:', data.id, 'with', data.elementsCount, 'elements');
        loadedDocRef.current = null;
        window.location.hash = data.id;
      } else if (res.status === 401) {
        console.error('[IMPORT] Auth error — token expired or invalid');
        setShowAuthModal(true);
      } else if (res.status === 413) {
        alert('Erreur import: Fichier trop volumineux. Contactez l\'admin pour augmenter la limite serveur.');
      } else {
        try {
          const err = await res.json();
          console.error('[IMPORT] Server error:', err);
          alert('Erreur import: ' + (err.error || 'Erreur serveur'));
        } catch {
          alert('Erreur import: Erreur serveur ' + res.status);
        }
      }
    } catch (err) {
      console.error('[IMPORT] Error:', err);
      alert('Erreur import: ' + err.message);
    }
    setImporting(false);
  };

  // Click must happen synchronously with user action
  input.click();
}
