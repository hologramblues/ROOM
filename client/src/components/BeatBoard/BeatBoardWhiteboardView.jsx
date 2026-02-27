import React, { useState, useRef, lazy, Suspense } from 'react';

const Excalidraw = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw })));

const BeatBoardWhiteboardView = ({
  whiteboardElements,
  setWhiteboardElements,
  beatCards,
  setBeatCards,
  selectedCards,
  setSelectedCards,
  darkMode,
  t,
}) => {
  const [selectedExcalidrawId, setSelectedExcalidrawId] = useState(null);
  const excalidrawRef = useRef(null);

  const defaultCardColor = '#ffffff';

  const handleExcalidrawChange = (elements, appState) => {
    setWhiteboardElements(elements);

    const selectedIds = Object.keys(appState.selectedElementIds || {});
    if (selectedIds.length === 1) {
      const selectedElement = elements.find(el => el.id === selectedIds[0]);
      if (selectedElement && ['rectangle', 'ellipse', 'text'].includes(selectedElement.type)) {
        setSelectedExcalidrawId(selectedIds[0]);
      } else {
        setSelectedExcalidrawId(null);
      }
    } else {
      setSelectedExcalidrawId(null);
    }
  };

  const convertExcalidrawToCard = (elementId, cardType = 'scene') => {
    const api = excalidrawRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    let title = cardType === 'note' ? '\uD83D\uDCDD Note' : 'Nouvelle scene';
    let synopsis = '';

    if (element.type === 'text') {
      title = element.text.split('\n')[0].substring(0, 50) || title;
      synopsis = element.text.split('\n').slice(1).join('\n') || '';
    } else {
      const boundText = elements.find(el => el.containerId === element.id && el.type === 'text');
      if (boundText) {
        title = boundText.text.split('\n')[0].substring(0, 50) || title;
        synopsis = boundText.text.split('\n').slice(1).join('\n') || '';
      }
    }

    const newCard = {
      id: (cardType === 'note' ? 'note_' : 'card_') + Date.now(),
      linkedSceneId: null, linkedSceneIndex: null,
      title, synopsis,
      color: cardType === 'note' ? '#fbbf24' : defaultCardColor,
      position: { x: element.x, y: element.y },
      timelineIndex: null, status: null, isNew: true, type: cardType,
    };

    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));

    api.updateScene({
      elements: elements.filter(el => el.id !== elementId && el.containerId !== elementId)
    });
    setSelectedExcalidrawId(null);
  };

  return (
    <div className="bb-whiteboard" style={{ backgroundImage: darkMode ? 'radial-gradient(circle, #484848 1px, transparent 1px)' : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--bb-text-secondary)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u270F\uFE0F'}</div>
            <div>{t('loadingWhiteboard') || 'Chargement du whiteboard...'}</div>
          </div>
        </div>
      }>
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawRef.current = api; }}
          initialData={{
            elements: whiteboardElements,
            appState: {
              viewBackgroundColor: 'transparent',
              theme: darkMode ? 'dark' : 'light',
              gridSize: null,
              zenModeEnabled: false,
              viewModeEnabled: false,
            }
          }}
          onChange={handleExcalidrawChange}
          theme={darkMode ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: { loadScene: false, export: { saveFileToDisk: false }, saveAsImage: false, changeViewBackgroundColor: false },
            tools: { image: false },
          }}
        />
      </Suspense>

      {/* Convert to card menu */}
      {selectedExcalidrawId && (
        <div className="bb-whiteboard__convert-menu">
          <span className="bb-whiteboard__convert-label">{t('convertTo') || 'Convertir en :'}</span>
          <button className="bb-whiteboard__convert-btn bb-whiteboard__convert-btn--scene" onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'scene')}>
            {'\uD83C\uDFAC'} {t('scene') || 'Scene'}
          </button>
          <button className="bb-whiteboard__convert-btn bb-whiteboard__convert-btn--note" onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'note')}>
            {'\uD83D\uDCDD'} Note
          </button>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)',
        padding: '8px 12px', borderRadius: 6, fontSize: 10, color: 'var(--bb-text-secondary)',
        maxWidth: 280, zIndex: 10,
      }}>
        {t('whiteboardInstructions') || 'Dessinez librement \u2022 Selectionnez une forme pour la convertir en carte'}
      </div>
    </div>
  );
};

export default BeatBoardWhiteboardView;
