import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';

const Excalidraw = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw })));

const statusColors = { done: '#22c55e', progress: '#3b82f6', urgent: '#ef4444' };
const statusIcons = { done: '\u2713', progress: '\u25D0', urgent: '!' };

const BeatBoardCanvasView = ({
  beatCards,
  setBeatCards,
  selectedCards,
  setSelectedCards,
  darkMode,
  isActive,
  onPushToUndo,
  onOpenEditModal,
  onToggleCut,
  onDeleteCard,
  onUpdateCard,
  elements,
  // Whiteboard (drawing) props
  whiteboardElements,
  setWhiteboardElements,
  t,
}) => {
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pendingDrag, setPendingDrag] = useState(null);
  // Drawing (Excalidraw) state
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [whiteboardKey, setWhiteboardKey] = useState(0);
  const [selectedExcalidrawId, setSelectedExcalidrawId] = useState(null);

  const canvasRef = useRef(null);
  const lastClickRef = useRef({ cardId: null, time: 0 });
  const dragOriginalPosRef = useRef(null);
  const dragSelectedPositionsRef = useRef(null);
  const dragMoveRAF = useRef(null);
  const excalidrawRef = useRef(null);

  const cardWidth = 240;
  const cardMinHeight = 180;
  const defaultCardColor = '#ffffff';

  // Wheel handler — only when drawing is NOT active (Excalidraw handles its own)
  useEffect(() => {
    if (!isActive || drawingEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastWheelTime = 0;
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastWheelTime < 16) return;
      lastWheelTime = now;

      if (e.ctrlKey || (Math.abs(e.deltaY) < 50 && Math.abs(e.deltaX) < 10)) {
        setCanvasZoom(z => Math.min(3, Math.max(0.2, z * (1 - e.deltaY * 0.01))));
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [isActive, drawingEnabled]);

  // Space key for pan mode
  useEffect(() => {
    if (!isActive || drawingEnabled) { setIsSpacePressed(false); setIsPanning(false); return; }
    const down = (e) => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const up = (e) => {
      if (e.code === 'Space') { setIsSpacePressed(false); setIsPanning(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [isActive, drawingEnabled]);

  // Pan handlers
  const handlePanStart = useCallback((e) => {
    if (drawingEnabled) return;
    if (isSpacePressed && (e.target === canvasRef.current || e.target.classList.contains('bb-canvas__bg'))) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [isSpacePressed, pan, drawingEnabled]);

  const handlePanMove = useCallback((e) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => setIsPanning(false), []);

  // Card drag
  const handleDragStart = useCallback((e, card) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();

    if (e.shiftKey) {
      setSelectedCards(prev => {
        const s = new Set(prev);
        s.has(card.id) ? s.delete(card.id) : s.add(card.id);
        return s;
      });
      return;
    }

    const willDragCards = selectedCards.has(card.id)
      ? beatCards.filter(c => selectedCards.has(c.id))
      : [card];

    if (!selectedCards.has(card.id)) setSelectedCards(new Set([card.id]));

    setPendingDrag({
      card, startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      originalPosition: { ...card.position },
      selectedPositions: new Map(willDragCards.map(c => [c.id, { ...c.position }])),
    });
  }, [selectedCards, beatCards, setSelectedCards]);

  const handleDragMove = useCallback((e) => {
    if (pendingDrag && !draggedCard) {
      if (Math.abs(e.clientX - pendingDrag.startX) > 5 || Math.abs(e.clientY - pendingDrag.startY) > 5) {
        dragOriginalPosRef.current = pendingDrag.originalPosition;
        dragSelectedPositionsRef.current = pendingDrag.selectedPositions;
        setDraggedCard(pendingDrag.card);
        setDragOffset({ x: pendingDrag.offsetX, y: pendingDrag.offsetY });
        setPendingDrag(null);
        lastClickRef.current = { cardId: null, time: 0 };
      }
      return;
    }
    if (!draggedCard || !canvasRef.current) return;
    if (dragMoveRAF.current) return;

    dragMoveRAF.current = requestAnimationFrame(() => {
      dragMoveRAF.current = null;
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const screenX = e.clientX - canvasRect.left - dragOffset.x;
      const screenY = e.clientY - canvasRect.top - dragOffset.y;
      const newX = (screenX / canvasZoom) - pan.x;
      const newY = (screenY / canvasZoom) - pan.y;
      const originalPos = dragOriginalPosRef.current;
      const deltaX = newX - originalPos.x;
      const deltaY = newY - originalPos.y;
      const selectedPositions = dragSelectedPositionsRef.current;

      setBeatCards(prev => prev.map(c => {
        if (selectedPositions?.has(c.id)) {
          const origPos = selectedPositions.get(c.id);
          return { ...c, position: { x: origPos.x + deltaX, y: origPos.y + deltaY } };
        }
        return c;
      }));
    });
  }, [draggedCard, dragOffset, pan, canvasZoom, pendingDrag, setBeatCards]);

  const handleDragEnd = useCallback(() => {
    if (dragMoveRAF.current) { cancelAnimationFrame(dragMoveRAF.current); dragMoveRAF.current = null; }

    if (pendingDrag) {
      const card = pendingDrag.card;
      const now = Date.now();
      const last = lastClickRef.current;
      if (last.cardId === card.id && now - last.time < 400) {
        onOpenEditModal(card);
        lastClickRef.current = { cardId: null, time: 0 };
      } else {
        lastClickRef.current = { cardId: card.id, time: now };
      }
      setPendingDrag(null);
      return;
    }

    setDraggedCard(null);
    dragOriginalPosRef.current = null;
    dragSelectedPositionsRef.current = null;
  }, [pendingDrag, onOpenEditModal]);

  useEffect(() => {
    if (draggedCard || pendingDrag) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => { window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd); };
    }
  }, [draggedCard, pendingDrag, handleDragMove, handleDragEnd]);

  // Scene numbers
  const sceneNumbers = useMemo(() => {
    const map = {};
    let num = 0;
    elements.forEach(el => { if (el.type === 'scene') { num++; map[el.id] = num; } });
    return map;
  }, [elements]);

  // Excalidraw handlers
  const handleExcalidrawChange = useCallback((elems, appState) => {
    setWhiteboardElements(elems);

    // Sync zoom/pan from Excalidraw
    if (appState.zoom?.value !== undefined) {
      const newZoom = appState.zoom.value;
      if (Math.abs(newZoom - canvasZoom) > 0.01) setCanvasZoom(newZoom);
    }
    if (appState.scrollX !== undefined && appState.scrollY !== undefined) {
      if (Math.abs(appState.scrollX - pan.x) > 1 || Math.abs(appState.scrollY - pan.y) > 1) {
        setPan({ x: appState.scrollX, y: appState.scrollY });
      }
    }

    const selectedIds = Object.keys(appState.selectedElementIds || {});
    if (selectedIds.length === 1) {
      const sel = elems.find(el => el.id === selectedIds[0]);
      if (sel && ['rectangle', 'ellipse', 'text'].includes(sel.type)) {
        setSelectedExcalidrawId(selectedIds[0]);
      } else {
        setSelectedExcalidrawId(null);
      }
    } else {
      setSelectedExcalidrawId(null);
    }
  }, [setWhiteboardElements, canvasZoom, pan]);

  const convertExcalidrawToCard = useCallback((elementId, cardType = 'scene') => {
    const api = excalidrawRef.current;
    if (!api) return;

    const elems = api.getSceneElements();
    const element = elems.find(el => el.id === elementId);
    if (!element) return;

    let title = cardType === 'note' ? '\uD83D\uDCDD Note' : 'Nouvelle scene';
    let synopsis = '';

    if (element.type === 'text') {
      title = element.text.split('\n')[0].substring(0, 50) || title;
      synopsis = element.text.split('\n').slice(1).join('\n') || '';
    } else {
      const boundText = elems.find(el => el.containerId === element.id && el.type === 'text');
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
    onOpenEditModal(newCard);

    api.updateScene({
      elements: elems.filter(el => el.id !== elementId && el.containerId !== elementId)
    });
    setSelectedExcalidrawId(null);
  }, [setBeatCards, setSelectedCards, onOpenEditModal]);

  const toggleDrawing = useCallback(() => {
    if (!drawingEnabled) setWhiteboardKey(k => k + 1);
    setDrawingEnabled(prev => !prev);
  }, [drawingEnabled]);

  return (
    <div
      ref={canvasRef}
      className="bb-canvas"
      onMouseDown={!drawingEnabled ? handlePanStart : undefined}
      onMouseMove={!drawingEnabled ? handlePanMove : undefined}
      onMouseUp={!drawingEnabled ? handlePanEnd : undefined}
      onMouseLeave={!drawingEnabled ? handlePanEnd : undefined}
      onClick={!drawingEnabled ? () => setSelectedCards(new Set()) : undefined}
      style={{
        cursor: isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'default'),
        backgroundImage: darkMode ? 'radial-gradient(circle, #484848 1px, transparent 1px)' : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`,
        backgroundPosition: `${pan.x * canvasZoom}px ${pan.y * canvasZoom}px`,
      }}
    >
      {/* Cards layer — above Excalidraw so cards remain interactive */}
      <div className="bb-canvas__cards" style={{ zIndex: drawingEnabled ? 60 : 1 }}>
        {beatCards.map(card => {
          const isCut = card.timelineIndex !== null;
          const isNote = card.type === 'note';
          const hasColor = card.color && card.color !== '#ffffff';
          const isSelected = selectedCards.has(card.id);
          const isDragging = draggedCard?.id === card.id;
          const screenX = (card.position.x + pan.x) * canvasZoom;
          const screenY = (card.position.y + pan.y) * canvasZoom;
          const scaledWidth = cardWidth * canvasZoom;
          const scaledMinHeight = cardMinHeight * canvasZoom;
          const scaledFont = 12 * canvasZoom;
          const scaledPadding = 10 * canvasZoom;

          return (
            <div
              key={card.id}
              className="bb-canvas__card"
              style={{
                left: screenX, top: screenY,
                width: scaledWidth, minHeight: scaledMinHeight,
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => handleDragStart(e, card)}
            >
              <div style={{
                background: darkMode ? 'var(--bb-card-bg)' : 'white',
                borderRadius: 8 * canvasZoom,
                border: !isCut && !isNote ? `${2 * canvasZoom}px dashed ${darkMode ? '#555' : '#ccc'}` : `1px solid var(--bb-card-border)`,
                boxShadow: isSelected ? `0 0 0 ${2 * canvasZoom}px var(--bb-accent), 0 4px 12px rgba(0,0,0,0.15)` : 'var(--bb-card-shadow)',
                opacity: isDragging ? 0.7 : (!isCut && !isNote ? 0.6 : 1),
                transform: isDragging ? 'scale(1.02) rotate(1deg)' : 'none',
                transition: isDragging ? 'none' : 'transform 0.15s, box-shadow 0.15s',
                cursor: isDragging ? 'grabbing' : 'grab',
                overflow: 'hidden',
                zIndex: isDragging ? 1000 : (isSelected ? 10 : 1),
                userSelect: 'none',
                minHeight: scaledMinHeight,
              }}>
                {hasColor && <div style={{ height: 6 * canvasZoom, background: card.color }} />}
                <div style={{ padding: `${scaledPadding}px ${scaledPadding * 1.2}px`, display: 'flex', flexDirection: 'column', gap: 4 * canvasZoom }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10 * canvasZoom, color: 'var(--bb-text-muted)' }}>
                      {isNote ? '\uD83D\uDCDD' : card.linkedSceneId ? `#${sceneNumbers[card.linkedSceneId] || ''}` : ''}
                    </span>
                    {card.status && (
                      <span style={{ fontSize: 9 * canvasZoom, padding: `${2 * canvasZoom}px ${6 * canvasZoom}px`, borderRadius: 4 * canvasZoom, background: statusColors[card.status], color: 'white' }}>
                        {statusIcons[card.status]}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13 * canvasZoom, fontWeight: 600, color: 'var(--bb-text-primary)', lineHeight: 1.3 }}>{card.title}</div>
                  <div style={{ fontSize: scaledFont * 0.9, color: 'var(--bb-text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                    {card.synopsis || 'Double-clic pour editer'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 * canvasZoom, borderTop: '1px solid var(--bb-divider)', marginTop: 'auto' }}>
                    {card.linkedSceneId && <span style={{ fontSize: 10 * canvasZoom, color: 'var(--bb-text-muted)' }}>{'\uD83D\uDD17'}</span>}
                    {!isNote && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleCut(card.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          padding: `${2 * canvasZoom}px ${6 * canvasZoom}px`, fontSize: 8 * canvasZoom, fontWeight: 600, borderRadius: 3 * canvasZoom, border: 'none', cursor: 'pointer',
                          background: isCut ? '#22c55e' : (darkMode ? '#555' : '#e5e7eb'),
                          color: isCut ? 'white' : '#6b7280',
                        }}
                      >
                        {isCut ? '\uD83C\uDFAC CUT' : 'UNCUT'}
                      </button>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCard(card.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 8 * canvasZoom, right: 8 * canvasZoom, width: 18 * canvasZoom, height: 18 * canvasZoom, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 11 * canvasZoom, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {'\u00D7'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Excalidraw drawing overlay */}
      {drawingEnabled && (
        <div className="bb-whiteboard" style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--bb-text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u270F\uFE0F'}</div>
                <div>{t('loadingWhiteboard') || 'Chargement du whiteboard...'}</div>
              </div>
            </div>
          }>
            <Excalidraw
              key={whiteboardKey}
              excalidrawAPI={(api) => { excalidrawRef.current = api; }}
              initialData={{
                elements: whiteboardElements,
                appState: {
                  viewBackgroundColor: 'transparent',
                  theme: darkMode ? 'dark' : 'light',
                  gridSize: null,
                  zenModeEnabled: false,
                  viewModeEnabled: false,
                  scrollX: pan.x,
                  scrollY: pan.y,
                  zoom: { value: canvasZoom },
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
        </div>
      )}

      {/* Drawing toggle button — top left */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 100 }}>
        <button
          onClick={toggleDrawing}
          style={{
            padding: '7px 12px', height: 32, borderRadius: 6,
            background: drawingEnabled ? '#8b5cf6' : (darkMode ? 'rgba(58,58,58,0.95)' : 'rgba(255,255,255,0.98)'),
            border: drawingEnabled ? 'none' : `1px solid ${darkMode ? '#555' : '#d1d5db'}`,
            color: drawingEnabled ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'),
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {'\u270F\uFE0F'} {drawingEnabled ? (t('drawingOn') || 'Dessin ON') : (t('draw') || 'Dessiner')}
        </button>
      </div>

      {/* Zoom controls — bottom right, hidden when drawing (Excalidraw has its own) */}
      {!drawingEnabled && (
        <div className="bb-canvas__zoom-controls">
          <button className="bb-canvas__zoom-btn" onClick={() => setCanvasZoom(z => Math.max(0.3, z - 0.1))}>{'\u2212'}</button>
          <span className="bb-canvas__zoom-label">{Math.round(canvasZoom * 100)}%</span>
          <button className="bb-canvas__zoom-btn" onClick={() => setCanvasZoom(z => Math.min(2, z + 0.1))}>+</button>
          <button className="bb-canvas__zoom-btn" onClick={() => { setCanvasZoom(1); setPan({ x: 0, y: 0 }); }} style={{ fontSize: 10, width: 'auto', padding: '0 6px' }}>Reset</button>
        </div>
      )}

      {/* Drawing instructions */}
      {drawingEnabled && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)',
          padding: '8px 12px', borderRadius: 6, fontSize: 10, color: 'var(--bb-text-secondary)',
          maxWidth: 280, zIndex: 100,
        }}>
          {t('whiteboardInstructions') || 'Dessinez librement \u2022 Selectionnez une forme pour la convertir en carte'}
        </div>
      )}
    </div>
  );
};

export default BeatBoardCanvasView;
