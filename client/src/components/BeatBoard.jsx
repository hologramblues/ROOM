import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { stripHtml } from '../utils/helpers';

const Excalidraw = lazy(() => import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw })));

// ============ BEAT BOARD COMPONENT ============
const BeatBoard = React.memo(({
  elements,
  setElements,
  darkMode,
  sceneSynopsis,
  setSceneSynopsis,
  sceneStatus,
  setSceneStatus,
  beatCards,
  setBeatCards,
  structureBeats,
  setStructureBeats,
  whiteboardElements,
  setWhiteboardElements,
  onPushToUndo,
  isActive = false,
  t = (k) => k
}) => {
  const [selectedCards, setSelectedCards] = useState(new Set()); // Multi-select support
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOverTimeline, setIsOverTimeline] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [timelineZoom, setTimelineZoom] = useState(1);
  // timelineMode removed — always 'blocks' now
  const [hoveredBlock, setHoveredBlock] = useState(null); // { id, rect } or null
  const [editModalCard, setEditModalCard] = useState(null); // Card being edited in modal
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // For space+drag panning like Excalidraw
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pendingDrag, setPendingDrag] = useState(null); // For delayed drag start
  const [whiteboardEnabled, setWhiteboardEnabled] = useState(false); // Whiteboard overlay toggle
  const [whiteboardKey, setWhiteboardKey] = useState(0); // Key to force remount Excalidraw with current zoom/pan
  // convertMenuPos removed — unused
  const [selectedExcalidrawId, setSelectedExcalidrawId] = useState(null); // Selected excalidraw element for conversion
  const [timelineDragId, setTimelineDragId] = useState(null); // Card ID being dragged in timeline
  const [timelineDropIndex, setTimelineDropIndex] = useState(null); // Drop position index in timeline (between blocks)
  const [timelineSyncMode, setTimelineSyncMode] = useState('live'); // 'live' = sync with script, 'staging' = isolated changes
  const [hasTimelineChanges, setHasTimelineChanges] = useState(false); // Track if staging has uncommitted changes
  const lastClickRef = useRef({ cardId: null, time: 0 }); // For manual double-click detection
  const dragOriginalPosRef = useRef(null); // Store original position during drag
  const dragFromTimelineRef = useRef(false); // Track if drag started from timeline
  const dragSelectedPositionsRef = useRef(null); // Store all selected cards positions for multi-drag
  const excalidrawRef = useRef(null); // Excalidraw API ref
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const timelineScrollRef = useRef(null); // For synchronized horizontal scroll

  const defaultCardColor = '#ffffff'; // White default for all cards
  const cardColors = ['#ffffff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // Initialize beat cards from scenes
  useEffect(() => {
    const scenes = elements.map((el, idx) => ({ ...el, index: idx })).filter(el => el.type === 'scene');

    setBeatCards(prev => {
      const customCards = prev.filter(c => !c.linkedSceneId);
      const sceneCards = scenes.map((scene, sceneIdx) => {
        const existingCard = prev.find(c => c.linkedSceneId === scene.id);
        if (existingCard) {
          return { ...existingCard, title: stripHtml(scene.content) || 'Nouvelle scène', synopsis: sceneSynopsis[scene.id] || existingCard.synopsis || '', status: sceneStatus[scene.id] || existingCard.status, linkedSceneIndex: scene.index };
        }
        return {
          id: 'beat_' + scene.id,
          linkedSceneId: scene.id,
          linkedSceneIndex: scene.index,
          title: stripHtml(scene.content) || 'Nouvelle scène',
          synopsis: sceneSynopsis[scene.id] || '',
          color: defaultCardColor,
          position: { x: 50 + (sceneIdx % 5) * 220, y: 180 + Math.floor(sceneIdx / 5) * 160 },
          timelineIndex: sceneIdx,
          status: sceneStatus[scene.id] || null,
          isNew: false,
        };
      });
      return [...sceneCards, ...customCards];
    });
  }, [elements, sceneSynopsis, sceneStatus, setBeatCards]);

  const timelineCards = useMemo(() => beatCards.filter(c => c.timelineIndex !== null).sort((a, b) => a.timelineIndex - b.timelineIndex), [beatCards]);
  // Canvas shows ALL cards (they all live here, timeline is just a "cut" view)
  const canvasCards = useMemo(() => beatCards, [beatCards]);

  // Toggle cut/uncut status
  const toggleCut = (cardId) => {
    onPushToUndo?.(); // Save state before modification
    setBeatCards(prev => {
      const card = prev.find(c => c.id === cardId);
      if (!card) return prev;

      if (card.timelineIndex !== null) {
        // Currently CUT -> make UNCUT
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c);
      } else {
        // Currently UNCUT -> make CUT (add to end of timeline)
        const maxIndex = Math.max(-1, ...prev.filter(c => c.timelineIndex !== null).map(c => c.timelineIndex));
        return prev.map(c => c.id === cardId ? { ...c, timelineIndex: maxIndex + 1 } : c);
      }
    });
  };

  // Calculate scene durations (estimated pages and time)
  const sceneMetrics = useMemo(() => {
    const metrics = [];
    let cumulativePages = 0;

    timelineCards.forEach(card => {
      if (!card.linkedSceneId) {
        // Custom card - estimate 0.5 page
        metrics.push({ ...card, pages: 0.5, startPage: cumulativePages, startTime: cumulativePages * 60 });
        cumulativePages += 0.5;
        return;
      }

      // Find scene elements count to estimate length
      const sceneIdx = card.linkedSceneIndex;
      let nextSceneIdx = elements.findIndex((el, i) => i > sceneIdx && el.type === 'scene');
      if (nextSceneIdx === -1) nextSceneIdx = elements.length;

      const sceneElements = elements.slice(sceneIdx, nextSceneIdx);
      // Rough estimate: ~8 elements per page average
      const estimatedPages = Math.max(0.5, Math.round((sceneElements.length / 8) * 2) / 2);

      metrics.push({
        ...card,
        pages: estimatedPages,
        startPage: cumulativePages,
        startTime: cumulativePages * 60 // 1 page = 1 minute = 60 seconds
      });
      cumulativePages += estimatedPages;
    });

    return { cards: metrics, totalPages: cumulativePages, totalTime: cumulativePages * 60 };
  }, [timelineCards, elements]);

  const handleDragStart = (e, card, fromTimeline = false) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    const rect = e.currentTarget.getBoundingClientRect();

    // Multi-select with Shift key
    if (e.shiftKey) {
      setSelectedCards(prev => {
        const newSet = new Set(prev);
        if (newSet.has(card.id)) {
          newSet.delete(card.id);
        } else {
          newSet.add(card.id);
        }
        return newSet;
      });
      return; // Don't start drag on shift-click
    }

    // Determine which cards will be dragged
    // If clicking on unselected card, only drag this one
    // If clicking on selected card, drag all selected cards
    const willDragCards = selectedCards.has(card.id)
      ? beatCards.filter(c => selectedCards.has(c.id))
      : [card];

    // If clicking on unselected card, select only this one
    if (!selectedCards.has(card.id)) {
      setSelectedCards(new Set([card.id]));
    }

    // Store pending drag info - actual drag starts on mouse move
    setPendingDrag({
      card,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      time: Date.now(),
      originalPosition: { ...card.position }, // Store original position to restore after timeline drop
      fromTimeline, // Track if dragging from timeline
      // Store only the cards that will actually be dragged
      selectedPositions: new Map(willDragCards.map(c => [c.id, { ...c.position }]))
    });
  };

  // Throttle ref for drag move
  const dragMoveRAF = useRef(null);

  const handleDragMove = useCallback((e) => {
    // Check if we should start dragging (mouse moved enough from start)
    if (pendingDrag && !draggedCard) {
      const dx = Math.abs(e.clientX - pendingDrag.startX);
      const dy = Math.abs(e.clientY - pendingDrag.startY);
      if (dx > 5 || dy > 5) {
        // Start actual drag - store original position and fromTimeline
        dragOriginalPosRef.current = pendingDrag.originalPosition;
        dragFromTimelineRef.current = pendingDrag.fromTimeline;
        dragSelectedPositionsRef.current = pendingDrag.selectedPositions;
        setDraggedCard(pendingDrag.card);
        setDragOffset({ x: pendingDrag.offsetX, y: pendingDrag.offsetY });
        setPendingDrag(null);
        // Reset double-click detection since we're dragging
        lastClickRef.current = { cardId: null, time: 0 };
      }
      return;
    }

    if (!draggedCard || !canvasRef.current) return;

    // Throttle position updates with RAF for smooth 60fps
    if (dragMoveRAF.current) return;

    dragMoveRAF.current = requestAnimationFrame(() => {
      dragMoveRAF.current = null;

      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const timelineRect = timelineRef.current?.getBoundingClientRect();

      // Only highlight timeline when cursor is actually over the timeline zone
      const isOverTimelineZone = timelineRect &&
        e.clientY >= timelineRect.top &&
        e.clientY <= timelineRect.bottom;
      setIsOverTimeline(isOverTimelineZone);

      // Only update position if dragging from canvas (not from timeline)
      if (!dragFromTimelineRef.current) {
        // New coordinate system: screenPos = (cardPos + scroll) * zoom
        // Inverse: cardPos = (screenPos / zoom) - scroll
        const screenX = e.clientX - canvasRect.left - dragOffset.x;
        const screenY = e.clientY - canvasRect.top - dragOffset.y;
        const newX = (screenX / canvasZoom) - pan.x;
        const newY = (screenY / canvasZoom) - pan.y;

        // Calculate delta from original position
        const originalPos = dragOriginalPosRef.current;
        const deltaX = newX - originalPos.x;
        const deltaY = newY - originalPos.y;

        // Move all selected cards together
        const selectedPositions = dragSelectedPositionsRef.current;
        setBeatCards(prev => prev.map(c => {
          if (selectedPositions && selectedPositions.has(c.id)) {
            const origPos = selectedPositions.get(c.id);
            return { ...c, position: { x: origPos.x + deltaX, y: origPos.y + deltaY } };
          }
          return c;
        }));
      }
    });
  }, [draggedCard, dragOffset, pan, canvasZoom, pendingDrag, setBeatCards]);

  const handleDragEnd = useCallback((e) => {
    // Cancel any pending RAF
    if (dragMoveRAF.current) {
      cancelAnimationFrame(dragMoveRAF.current);
      dragMoveRAF.current = null;
    }

    // Handle click/double-click when no actual drag happened
    if (pendingDrag) {
      const card = pendingDrag.card;
      const now = Date.now();
      const lastClick = lastClickRef.current;

      // Check for double-click (same card, within 400ms)
      if (lastClick.cardId === card.id && now - lastClick.time < 400) {
        // Double-click detected - open modal
        setEditModalCard(card);
        lastClickRef.current = { cardId: null, time: 0 };
      } else {
        // Single click - store for potential double-click
        lastClickRef.current = { cardId: card.id, time: now };
      }

      setPendingDrag(null);
      return;
    }

    if (!draggedCard || !canvasRef.current) return;
    const timelineRect = timelineRef.current?.getBoundingClientRect();

    // Check if dropped specifically on the timeline zone
    const isDroppedOnTimeline = timelineRect &&
      e.clientY >= timelineRect.top &&
      e.clientY <= timelineRect.bottom;

    const fromTimeline = dragFromTimelineRef.current;
    const originalPos = dragOriginalPosRef.current;

    if (isDroppedOnTimeline) {
      // Save state before modification for undo
      onPushToUndo?.();

      // Add to timeline (or reorder if already in timeline)
      const x = e.clientX - timelineRect.left;
      const newIndex = Math.max(0, Math.floor((x - 60) / 200));

      setBeatCards(prev => {
        // Always restore original position when dropping on timeline
        let cards = prev.map(c => c.id === draggedCard.id ? { ...c, timelineIndex: -999, position: originalPos || c.position } : c);
        const inTimeline = cards.filter(c => c.timelineIndex !== null && c.timelineIndex !== -999).sort((a, b) => a.timelineIndex - b.timelineIndex);
        inTimeline.splice(Math.min(newIndex, inTimeline.length), 0, cards.find(c => c.id === draggedCard.id));
        return cards.map(c => {
          const tlIdx = inTimeline.findIndex(tc => tc.id === c.id);
          return tlIdx >= 0 ? { ...c, timelineIndex: tlIdx } : c;
        });
      });
    } else if (fromTimeline) {
      // Save state before modification for undo
      onPushToUndo?.();

      // Dragged FROM timeline and dropped OUTSIDE -> UNCUT (remove from timeline)
      // Keep original position (don't change canvas position)
      setBeatCards(prev => prev.map(c => c.id === draggedCard.id ? { ...c, timelineIndex: null, position: originalPos || c.position } : c));
    }
    // If dragged from canvas and dropped on canvas, position was already updated during drag

    setDraggedCard(null);
    setIsOverTimeline(false);
    dragOriginalPosRef.current = null;
    dragFromTimelineRef.current = false;
    dragSelectedPositionsRef.current = null;
  }, [draggedCard, pendingDrag, onPushToUndo, setBeatCards]);

  useEffect(() => {
    if (draggedCard || pendingDrag) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => { window.removeEventListener('mousemove', handleDragMove); window.removeEventListener('mouseup', handleDragEnd); };
    }
  }, [draggedCard, pendingDrag, handleDragMove, handleDragEnd]);

  // Navigation handlers - Excalidraw style
  // Pan with Space + drag
  const handlePanStart = useCallback((e) => {
    if (isSpacePressed && (e.target === canvasRef.current || e.target.classList.contains('beat-canvas-bg'))) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [isSpacePressed, pan]);

  const handlePanMove = useCallback((e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => setIsPanning(false), []);

  // Wheel/pinch handler - must use addEventListener with passive:false to prevent browser zoom
  useEffect(() => {
    if (!isActive || whiteboardEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastWheelTime = 0;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Throttle to max 60fps
      const now = Date.now();
      if (now - lastWheelTime < 16) return;
      lastWheelTime = now;

      // Pinch zoom detection: ctrlKey is set by trackpad pinch, or small deltaY without deltaX
      const isPinch = e.ctrlKey || (Math.abs(e.deltaY) < 50 && Math.abs(e.deltaX) < 10);

      if (isPinch) {
        // Zoom - Excalidraw style with smooth factor
        const zoomFactor = 1 - e.deltaY * 0.01;
        setCanvasZoom(z => Math.min(3, Math.max(0.2, z * zoomFactor)));
      } else {
        // Pan - direct 1:1 movement like Excalidraw (no zoom division)
        setPan(p => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY
        }));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [isActive, whiteboardEnabled]);

  // Space key listener for pan mode - only when BeatBoard is active
  useEffect(() => {
    if (!isActive) {
      // Reset state when leaving BeatBoard
      setIsSpacePressed(false);
      setIsPanning(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
          !document.activeElement?.isContentEditable) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive]);

  const addNewCard = () => {
    // Position in visible area: screenPos = (cardPos + scroll) * zoom
    // So cardPos = screenPos / zoom - scroll
    // Place at screen position (100, 200)
    const newCard = { id: 'card_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null, title: 'Nouvelle scène', synopsis: '', color: defaultCardColor, position: { x: 100 / canvasZoom - pan.x, y: 200 / canvasZoom - pan.y }, timelineIndex: null, status: null, isNew: true, type: 'scene' };
    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));
    setEditModalCard(newCard);
  };

  // Convert an Excalidraw element to a Beat Board card
  const convertExcalidrawToCard = (elementId, cardType = 'scene') => {
    const api = excalidrawRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Get text content if it's a text element or has bound text
    let title = cardType === 'note' ? '📝 Note' : 'Nouvelle scène';
    let synopsis = '';

    if (element.type === 'text') {
      title = element.text.split('\n')[0].substring(0, 50) || title;
      synopsis = element.text.split('\n').slice(1).join('\n') || '';
    } else {
      // Check for bound text elements
      const boundText = elements.find(el => el.containerId === element.id && el.type === 'text');
      if (boundText) {
        title = boundText.text.split('\n')[0].substring(0, 50) || title;
        synopsis = boundText.text.split('\n').slice(1).join('\n') || '';
      }
    }

    // Create card at the element's position (Excalidraw coordinates = card coordinates now)
    const newCard = {
      id: (cardType === 'note' ? 'note_' : 'card_') + Date.now(),
      linkedSceneId: null,
      linkedSceneIndex: null,
      title,
      synopsis,
      color: cardType === 'note' ? '#fbbf24' : defaultCardColor,
      position: {
        x: element.x,
        y: element.y
      },
      timelineIndex: null,
      status: null,
      isNew: true,
      type: cardType
    };

    setBeatCards(prev => [...prev, newCard]);
    setSelectedCards(new Set([newCard.id]));
    setEditModalCard(newCard);

    // Remove the converted element from Excalidraw
    api.updateScene({
      elements: elements.filter(el => el.id !== elementId && el.containerId !== elementId)
    });

    // convertMenuPos removed
    setSelectedExcalidrawId(null);
  };

  // Handle Excalidraw element selection for conversion AND sync zoom/pan
  const handleExcalidrawChange = (elements, appState) => {
    setWhiteboardElements(elements);

    // Sync zoom and pan from Excalidraw to cards canvas
    if (appState.zoom?.value !== undefined) {
      const newZoom = appState.zoom.value;
      if (Math.abs(newZoom - canvasZoom) > 0.01) {
        setCanvasZoom(newZoom);
      }
    }
    if (appState.scrollX !== undefined && appState.scrollY !== undefined) {
      const newPanX = appState.scrollX;
      const newPanY = appState.scrollY;
      if (Math.abs(newPanX - pan.x) > 1 || Math.abs(newPanY - pan.y) > 1) {
        setPan({ x: newPanX, y: newPanY });
      }
    }

    // Check if a single element is selected
    const selectedIds = Object.keys(appState.selectedElementIds || {});
    if (selectedIds.length === 1) {
      const selectedElement = elements.find(el => el.id === selectedIds[0]);
      if (selectedElement && (selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse' || selectedElement.type === 'text')) {
        // Show convert menu near the element
        setSelectedExcalidrawId(selectedIds[0]);
      } else {
        setSelectedExcalidrawId(null);
        // convertMenuPos removed
      }
    } else {
      setSelectedExcalidrawId(null);
      // convertMenuPos removed
    }
  };

  const deleteCard = (cardId) => {
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId) setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, timelineIndex: null } : c));
    else setBeatCards(prev => prev.filter(c => c.id !== cardId));
    setSelectedCards(new Set());
  };

  const updateCard = (cardId, updates) => {
    setBeatCards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    const card = beatCards.find(c => c.id === cardId);
    if (card?.linkedSceneId && updates.synopsis !== undefined) setSceneSynopsis(prev => ({ ...prev, [card.linkedSceneId]: updates.synopsis }));
  };

  const applyTimelineOrder = () => {
    const linkedCards = timelineCards.filter(c => c.linkedSceneId);
    if (linkedCards.length === 0) return;

    setElements(prev => {
      const newElements = [];
      const processedScenes = new Set();

      linkedCards.forEach(card => {
        const sceneIdx = card.linkedSceneIndex;
        if (processedScenes.has(sceneIdx)) return;
        processedScenes.add(sceneIdx);

        // Find scene and all elements until next scene
        let endIdx = prev.findIndex((el, i) => i > sceneIdx && el.type === 'scene');
        if (endIdx === -1) endIdx = prev.length;

        for (let i = sceneIdx; i < endIdx; i++) {
          newElements.push(prev[i]);
        }
      });

      // Add any remaining scenes not in timeline
      prev.forEach((el, idx) => {
        if (el.type === 'scene' && !processedScenes.has(idx)) {
          let endIdx = prev.findIndex((e, i) => i > idx && e.type === 'scene');
          if (endIdx === -1) endIdx = prev.length;
          for (let i = idx; i < endIdx; i++) {
            if (!newElements.includes(prev[i])) newElements.push(prev[i]);
          }
        }
      });

      return newElements.length > 0 ? newElements : prev;
    });
  };

  const BeatCard = ({ card, inTimeline = false, excalidrawMode = false, zoom = 1, scroll = { x: 0, y: 0 } }) => {
    const isSelected = selectedCards.has(card.id);
    const isDragging = draggedCard?.id === card.id;
    const isCut = card.timelineIndex !== null;
    const isNote = card.type === 'note';
    const isWhiteCard = card.color === '#ffffff';

    // Calculate position to match Excalidraw coordinate system
    // Excalidraw renders elements at: screenPos = (elementPos + scroll) * zoom
    const cardWidth = inTimeline ? 160 : 200;
    const cardMinHeight = inTimeline ? 70 : 120;

    // Transform card position to screen position (matching Excalidraw)
    const screenX = inTimeline ? 'auto' : (card.position.x + scroll.x) * zoom;
    const screenY = inTimeline ? 'auto' : (card.position.y + scroll.y) * zoom;
    const scaledWidth = inTimeline ? cardWidth : cardWidth * zoom;
    const scaledMinHeight = inTimeline ? cardMinHeight : cardMinHeight * zoom;
    const scaledFontTitle = inTimeline ? 11 : 11 * zoom;
    const scaledFontSynopsis = inTimeline ? 10 : 10 * zoom;
    const scaledPadding = inTimeline ? '6px 8px' : `${10 * zoom}px ${12 * zoom}px`;

    // Post-it style for notes (solid background color)
    const noteColors = {
      '#3b82f6': { bg: '#dbeafe', darkBg: '#1e3a5f', text: '#1e40af', darkText: '#93c5fd' },
      '#22c55e': { bg: '#dcfce7', darkBg: '#14532d', text: '#166534', darkText: '#86efac' },
      '#ef4444': { bg: '#fee2e2', darkBg: '#7f1d1d', text: '#991b1b', darkText: '#fca5a5' },
      '#f97316': { bg: '#ffedd5', darkBg: '#7c2d12', text: '#9a3412', darkText: '#fdba74' },
      '#8b5cf6': { bg: '#ede9fe', darkBg: '#4c1d95', text: '#5b21b6', darkText: '#c4b5fd' },
      '#ec4899': { bg: '#fce7f3', darkBg: '#831843', text: '#9d174d', darkText: '#f9a8d4' },
      '#06b6d4': { bg: '#cffafe', darkBg: '#164e63', text: '#0e7490', darkText: '#67e8f9' },
      '#fbbf24': { bg: '#fef3c7', darkBg: '#78350f', text: '#92400e', darkText: '#fcd34d' },
    };
    const noteStyle = isNote ? (noteColors[card.color] || { bg: '#fef3c7', darkBg: '#78350f', text: '#92400e', darkText: '#fcd34d' }) : null;

    // Color bar or left border for white cards
    const leftBorderWidth = inTimeline ? 4 : 4 * zoom;

    return (
      <div
        onMouseDown={(e) => handleDragStart(e, card, inTimeline)}
        style={{
          position: inTimeline ? 'relative' : 'absolute',
          left: screenX,
          top: screenY,
          width: scaledWidth,
          minHeight: scaledMinHeight,
          pointerEvents: 'auto', // Always clickable, even when parent has pointerEvents: none
          background: isNote
            ? (darkMode ? noteStyle?.darkBg : noteStyle?.bg) || '#fef3c7'
            : (darkMode ? '#3a3a3a' : 'white'),
          borderRadius: isNote ? 4 * zoom : 8 * zoom,
          borderLeft: !isNote && isWhiteCard ? `${leftBorderWidth}px solid ${darkMode ? '#6b7280' : '#d1d5db'}` : 'none',
          boxShadow: isSelected
            ? `0 0 0 ${2 * zoom}px ${isWhiteCard ? '#3b82f6' : card.color}, 0 ${8 * zoom}px ${24 * zoom}px rgba(0,0,0,0.2)`
            : (isNote ? `${2 * zoom}px ${2 * zoom}px ${8 * zoom}px rgba(0,0,0,0.15)` : `0 ${2 * zoom}px ${8 * zoom}px rgba(0,0,0,0.15)`),
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.8 : (!inTimeline && !isCut && !isNote ? 0.7 : 1),
          transform: isDragging ? 'scale(1.02) rotate(2deg)' : (isNote && !inTimeline ? 'rotate(-1deg)' : 'scale(1)'),
          transition: isDragging ? 'none' : 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
          overflow: 'hidden',
          zIndex: isDragging ? 1000 : (isSelected ? 10 : 1),
          flexShrink: 0,
          userSelect: 'none',
          border: !inTimeline && !isCut && !isNote ? `${2 * zoom}px dashed ${darkMode ? '#555' : '#ccc'}` : 'none',
        }}
      >
        {/* Color bar only for scenes with a color (not white, not notes) */}
        {!isNote && !isWhiteCard && <div style={{ height: inTimeline ? 4 : 6 * zoom, background: card.color, borderRadius: `${8 * zoom}px ${8 * zoom}px 0 0` }} />}
        <div style={{ padding: scaledPadding, display: 'flex', flexDirection: 'column', height: inTimeline ? 'auto' : (isWhiteCard ? '100%' : `calc(100% - ${6 * zoom}px)`) }}>
          {/* Title */}
          <div style={{
            fontSize: scaledFontTitle,
            fontWeight: 600,
            color: isNote ? (darkMode ? noteStyle?.darkText : noteStyle?.text) || '#92400e' : (darkMode ? 'white' : '#1a1a1a'),
            marginBottom: 4 * zoom,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: inTimeline ? 2 : 2,
            WebkitBoxOrient: 'vertical',
          }}>{card.title}</div>

          {/* Synopsis - only on canvas */}
          {!inTimeline && (
            <div style={{
              fontSize: scaledFontSynopsis,
              color: isNote ? (darkMode ? noteStyle?.darkText : noteStyle?.text) || '#92400e' : (darkMode ? '#9ca3af' : '#6b7280'),
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              flex: 1,
              marginBottom: 8 * zoom,
            }}>{card.synopsis || (isNote ? 'Double-clic pour éditer' : 'Double-clic pour ajouter un résumé')}</div>
          )}

          {/* Footer with controls - only on canvas */}
          {!inTimeline && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 6 * zoom,
              borderTop: `1px solid ${isNote ? (darkMode ? '#ffffff20' : '#00000015') : (darkMode ? '#484848' : '#e5e7eb')}`,
              marginTop: 'auto'
            }}>
              {/* Left: Status badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 * zoom }}>
                {card.status && <span style={{ fontSize: 9 * zoom, padding: `${2 * zoom}px ${6 * zoom}px`, borderRadius: 4 * zoom, background: card.status === 'done' ? '#22c55e' : card.status === 'progress' ? '#3b82f6' : '#ef4444', color: 'white' }}>{card.status === 'done' ? '✓' : card.status === 'progress' ? '◐' : '!'}</span>}
                {isNote && <span style={{ fontSize: 9 * zoom }}>📝</span>}
                {card.linkedSceneId && <span style={{ fontSize: 10 * zoom, color: '#6b7280' }}>🔗</span>}
              </div>

              {/* Center: CUT/UNCUT badge - not for notes */}
              {!isNote && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCut(card.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={isCut ? 'Dans le montage (clic pour retirer)' : 'Hors montage (clic pour ajouter)'}
                  style={{
                    padding: `${2 * zoom}px ${6 * zoom}px`,
                    fontSize: 8 * zoom,
                    fontWeight: 600,
                    borderRadius: 3 * zoom,
                    border: 'none',
                    cursor: 'pointer',
                    background: isCut ? '#22c55e' : (darkMode ? '#555' : '#e5e7eb'),
                    color: isCut ? 'white' : '#6b7280',
                  }}
                >
                  {isCut ? '🎬 CUT' : 'UNCUT'}
                </button>
              )}

              {/* Right: Color picker (only when selected) */}
              {isSelected && (
                <div style={{ display: 'flex', gap: 2 * zoom }}>
                  {cardColors.slice(0, 4).map(color => (
                    <button key={color} onClick={(e) => { e.stopPropagation(); updateCard(card.id, { color }); }} onMouseDown={(e) => e.stopPropagation()} style={{ width: 12 * zoom, height: 12 * zoom, borderRadius: 3 * zoom, background: color, border: card.color === color ? `${2 * zoom}px solid white` : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline footer - simplified */}
          {inTimeline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
              {card.status && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: card.status === 'done' ? '#22c55e' : card.status === 'progress' ? '#3b82f6' : '#ef4444', color: 'white' }}>{card.status === 'done' ? '✓' : card.status === 'progress' ? '◐' : '!'}</span>}
              {card.linkedSceneId && <span style={{ fontSize: 10, color: '#6b7280' }}>🔗</span>}
            </div>
          )}
        </div>
        {isSelected && !inTimeline && <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: isNote ? 4 * zoom : 8 * zoom, right: 8 * zoom, width: 18 * zoom, height: 18 * zoom, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 11 * zoom, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: darkMode ? '#1a1a1a' : '#f0f0f0', overflow: 'hidden' }}>
      {/* Timeline zone with Structure row - Video editor style */}
      <div ref={timelineRef} style={{ background: isOverTimeline ? (darkMode ? '#2a4a2a' : '#dcfce7') : (darkMode ? '#252525' : '#fafafa'), borderBottom: `2px solid ${isOverTimeline ? '#22c55e' : (darkMode ? '#484848' : '#e5e7eb')}`, display: 'flex', flexDirection: 'column', transition: 'background 0.2s' }}>
        {/* Timeline header - minimal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>TIMELINE</span>

          {/* Mode toggle: Live / Staging */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: darkMode ? '#333' : '#e5e7eb', borderRadius: 4, padding: 2 }}>
            <button
              onClick={() => { setTimelineSyncMode('live'); setHasTimelineChanges(false); }}
              style={{
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 500,
                background: timelineSyncMode === 'live' ? '#3b82f6' : 'transparent',
                color: timelineSyncMode === 'live' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
              title="Synchronisation automatique avec le script"
            >
              Live
            </button>
            <button
              onClick={() => setTimelineSyncMode('staging')}
              style={{
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 500,
                background: timelineSyncMode === 'staging' ? '#f59e0b' : 'transparent',
                color: timelineSyncMode === 'staging' ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
              title="Mode brouillon - les changements ne sont pas appliqués au script"
            >
              Brouillon
            </button>
          </div>

          {/* Commit button - only in staging mode with changes */}
          {timelineSyncMode === 'staging' && hasTimelineChanges && (
            <button
              onClick={() => {
                onPushToUndo?.();

                // Get the current timeline order of scene IDs
                const timelineOrder = beatCards
                  .filter(c => c.timelineIndex !== null)
                  .sort((a, b) => a.timelineIndex - b.timelineIndex)
                  .map(c => c.linkedSceneId)
                  .filter(Boolean);

                // Reorder elements to match timeline
                const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);

                // Build new elements array
                let newElements = [];
                let usedSceneIds = new Set();

                timelineOrder.forEach(sceneId => {
                  const sceneIdx = elements.findIndex(el => el.id === sceneId);
                  if (sceneIdx === -1) return;

                  const scenePos = sceneIndices.indexOf(sceneIdx);
                  const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;

                  newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                  usedSceneIds.add(sceneId);
                });

                // Add any scenes not in timeline at the end
                elements.filter(el => el.type === 'scene').forEach(scene => {
                  if (!usedSceneIds.has(scene.id)) {
                    const sceneIdx = elements.findIndex(el => el.id === scene.id);
                    const scenePos = sceneIndices.indexOf(sceneIdx);
                    const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                    newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                  }
                });

                setElements(newElements);
                setHasTimelineChanges(false);
              }}
              style={{
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 600,
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                animation: 'pulse 2s infinite'
              }}
              title="Appliquer l'ordre de la timeline au script"
            >
              ✓ Appliquer au script
            </button>
          )}

          {timelineSyncMode === 'staging' && !hasTimelineChanges && (
            <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>
              Réorganisez les blocs puis appliquez
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Zoom slider - calculated based on card count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg>
            <input
              type="range"
              min="0.15"
              max={Math.max(1.5, Math.min(3, 30 / Math.max(1, timelineCards.length)))}
              step="0.01"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
              style={{ width: 80, height: 3, cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>
          </div>
        </div>

        {/* Timeline content with fixed labels and scrollable content */}
        <div
          style={{ display: 'flex', flex: 1 }}
        >
          {/* Fixed labels column */}
          <div style={{ width: 50, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
            <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#1f1f1f' : '#f8f9fa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>STRUCT</div>
            {sceneMetrics.totalPages > 0 && (
              <>
                <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#2a2a2a' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>TIME</div>
                <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6b7280', background: darkMode ? '#252525' : '#fafafa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}` }}>PAGE</div>
              </>
            )}
            <div style={{ flex: 1, minHeight: 40 }} />
          </div>

          {/* Scrollable content area - all rows scroll together */}
          <div ref={timelineScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'visible', display: 'flex', flexDirection: 'column' }}>
            {/* Structure row */}
            <div style={{ display: 'flex', height: 28, background: darkMode ? '#1f1f1f' : '#f8f9fa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, minWidth: 'fit-content', position: 'relative' }}>
              {(() => {
                const totalWidth = Math.max(300, sceneMetrics.totalPages * 60 * timelineZoom);

                if (structureBeats.length === 0) {
                  return (
                    <div
                      style={{ width: totalWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 10, fontStyle: 'italic', cursor: 'pointer' }}
                      onClick={() => {
                        // Create first beat starting at first scene
                        const firstScene = elements.find(el => el.type === 'scene');
                        const label = prompt('Nom du premier bloc (ex: Acte 1)');
                        if (label && firstScene) setStructureBeats([{ id: 'struct_' + Date.now(), label, startSceneId: firstScene.id, color: null }]);
                      }}
                    >
                      Cliquez pour ajouter une structure
                    </div>
                  );
                }

                // Sort beats by their scene position
                const sortedBeats = [...structureBeats].sort((a, b) => {
                  const aCard = sceneMetrics.cards.find(c => c.linkedSceneId === a.startSceneId);
                  const bCard = sceneMetrics.cards.find(c => c.linkedSceneId === b.startSceneId);
                  return (aCard?.startPage || 0) - (bCard?.startPage || 0);
                });

                return (
                  <div style={{ display: 'flex', width: totalWidth, position: 'relative' }}>
                    {sortedBeats.map((beat, idx) => {
                      // Find the start position of this beat
                      const startCard = sceneMetrics.cards.find(c => c.linkedSceneId === beat.startSceneId);
                      const startPage = startCard?.startPage || 0;

                      // Find the end position (start of next beat or end of timeline)
                      const nextBeat = sortedBeats[idx + 1];
                      let endPage = sceneMetrics.totalPages;
                      if (nextBeat) {
                        const nextCard = sceneMetrics.cards.find(c => c.linkedSceneId === nextBeat.startSceneId);
                        endPage = nextCard?.startPage || sceneMetrics.totalPages;
                      }

                      const left = startPage * 60 * timelineZoom;
                      const width = Math.max(40, (endPage - startPage) * 60 * timelineZoom);

                      return (
                        <div
                          key={beat.id}
                          style={{
                            position: 'absolute',
                            left,
                            width,
                            height: '100%',
                            background: beat.color || (darkMode ? '#2a2a2a' : '#e5e7eb'),
                            borderRight: `1px solid ${darkMode ? '#1a1a1a' : 'white'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 600,
                            color: beat.color ? 'white' : (darkMode ? '#d1d5db' : '#374151'),
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            padding: '0 4px',
                          }}
                          onClick={() => {
                            const newLabel = prompt('Nouveau nom:', beat.label);
                            if (newLabel !== null) setStructureBeats(prev => prev.map(b => b.id === beat.id ? { ...b, label: newLabel } : b));
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (window.confirm(`Supprimer "${beat.label}" ?`)) {
                              setStructureBeats(prev => prev.filter(b => b.id !== beat.id));
                            }
                          }}
                        >
                          {beat.label}
                        </div>
                      );
                    })}
                    {/* Add new beat button at end */}
                    <div
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: '#6b7280',
                        cursor: 'pointer',
                        zIndex: 5,
                        background: darkMode ? '#2a2a2a' : '#e5e7eb',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find a scene that doesn't have a beat yet
                        const scenes = elements.filter(el => el.type === 'scene');
                        const usedSceneIds = new Set(structureBeats.map(b => b.startSceneId));
                        const availableScenes = scenes.filter(s => !usedSceneIds.has(s.id));

                        if (availableScenes.length === 0) {
                          alert('Toutes les scènes ont déjà un bloc de structure');
                          return;
                        }

                        const label = prompt('Nom du nouveau bloc:');
                        if (label) {
                          // Add at middle available scene
                          const midScene = availableScenes[Math.floor(availableScenes.length / 2)];
                          setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label, startSceneId: midScene.id, color: null }]);
                        }
                      }}
                      title="Ajouter un bloc"
                    >
                      +
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Time and Page rulers */}
            {sceneMetrics.totalPages > 0 && (
              <>
                <div style={{ display: 'flex', height: 16, background: darkMode ? '#2a2a2a' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, fontSize: 9, color: '#6b7280' }}>
                  {Array.from({ length: Math.ceil(sceneMetrics.totalTime / 60) + 1 }, (_, i) => (
                    <div key={i} style={{ width: 60 * timelineZoom, flexShrink: 0, borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#d1d5db'}`, paddingLeft: 4, display: 'flex', alignItems: 'center' }}>
                      {String(Math.floor(i / 60)).padStart(2, '0')}:{String(i % 60).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', height: 14, background: darkMode ? '#252525' : '#fafafa', borderBottom: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, fontSize: 9, color: '#6b7280' }}>
                  {Array.from({ length: Math.ceil(sceneMetrics.totalPages) + 1 }, (_, i) => (
                    <div key={i} style={{ width: 60 * timelineZoom, flexShrink: 0, borderRight: `1px solid ${darkMode ? '#3a3a3a' : '#e5e7eb'}`, paddingLeft: 4, display: 'flex', alignItems: 'center' }}>
                      p.{i + 1}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Blocks row */}
            <div
              style={{ display: 'flex', height: 40, position: 'relative', minWidth: 'fit-content', overflow: 'visible' }}
              onMouseMove={(e) => {
                if (!timelineDragId) return;
                // Find which block we're over
                const blocks = e.currentTarget.querySelectorAll('[data-timeline-block]');
                let foundDropIndex = null;
                blocks.forEach((block, idx) => {
                  const rect = block.getBoundingClientRect();
                  if (e.clientX >= rect.left && e.clientX <= rect.right) {
                    const midX = rect.left + rect.width / 2;
                    foundDropIndex = e.clientX < midX ? idx : idx + 1;
                  }
                });
                // If past the last block
                if (foundDropIndex === null && blocks.length > 0) {
                  const lastRect = blocks[blocks.length - 1].getBoundingClientRect();
                  if (e.clientX > lastRect.right) {
                    foundDropIndex = blocks.length;
                  } else if (e.clientX < blocks[0].getBoundingClientRect().left) {
                    foundDropIndex = 0;
                  }
                }
                if (foundDropIndex !== null && foundDropIndex !== timelineDropIndex) {
                  setTimelineDropIndex(foundDropIndex);
                }
              }}
              onMouseUp={() => {
                if (timelineDragId && timelineDropIndex !== null) {
                  // Reorder cards in timeline
                  const draggedIdx = sceneMetrics.cards.findIndex(c => c.id === timelineDragId);
                  if (draggedIdx !== -1 && draggedIdx !== timelineDropIndex && draggedIdx !== timelineDropIndex - 1) {
                    // Save state before modification for undo
                    onPushToUndo?.();

                    const orderedIds = sceneMetrics.cards.map(c => c.id);
                    const [draggedId] = orderedIds.splice(draggedIdx, 1);
                    const insertIdx = timelineDropIndex > draggedIdx ? timelineDropIndex - 1 : timelineDropIndex;
                    orderedIds.splice(insertIdx, 0, draggedId);

                    setBeatCards(prev => prev.map(c => {
                      const newIdx = orderedIds.indexOf(c.id);
                      if (newIdx !== -1) {
                        return { ...c, timelineIndex: newIdx };
                      }
                      return c;
                    }));

                    // In live mode, also reorder the script
                    if (timelineSyncMode === 'live') {
                      // Get the new order of scene IDs from timeline
                      const newSceneOrder = orderedIds
                        .map(id => beatCards.find(c => c.id === id)?.linkedSceneId)
                        .filter(Boolean);

                      // Reorder elements to match timeline
                      const sceneElements = elements.filter(el => el.type === 'scene');
                      const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);

                      // Build new elements array
                      let newElements = [];
                      let usedSceneIds = new Set();

                      newSceneOrder.forEach(sceneId => {
                        const sceneEl = elements.find(el => el.id === sceneId);
                        if (!sceneEl) return;

                        const sceneIdx = elements.findIndex(el => el.id === sceneId);
                        const scenePos = sceneIndices.indexOf(sceneIdx);
                        const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;

                        // Add this scene and all its elements
                        newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                        usedSceneIds.add(sceneId);
                      });

                      // Add any scenes not in timeline at the end
                      sceneElements.forEach(scene => {
                        if (!usedSceneIds.has(scene.id)) {
                          const sceneIdx = elements.findIndex(el => el.id === scene.id);
                          const scenePos = sceneIndices.indexOf(sceneIdx);
                          const nextSceneIdx = scenePos < sceneIndices.length - 1 ? sceneIndices[scenePos + 1] : elements.length;
                          newElements.push(...elements.slice(sceneIdx, nextSceneIdx));
                        }
                      });

                      setElements(newElements);
                    } else {
                      // Staging mode - mark as having changes
                      setHasTimelineChanges(true);
                    }
                  }
                }
                setTimelineDragId(null);
                setTimelineDropIndex(null);
              }}
              onMouseLeave={() => {
                if (timelineDragId) {
                  setTimelineDragId(null);
                  setTimelineDropIndex(null);
                }
              }}
            >
              {timelineCards.length === 0 ? (
                <div style={{ flex: 1, minWidth: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 11, border: `2px dashed ${darkMode ? '#484848' : '#d1d5db'}`, borderRadius: 6, margin: 4 }}>
                  Glissez des cartes ici pour construire votre timeline
                </div>
              ) : (
                sceneMetrics.cards.map((card, idx) => {
                  const blockWidth = Math.max(20, card.pages * 60 * timelineZoom);
                  const fullCard = beatCards.find(c => c.id === card.id);
                  const isWhite = card.color === '#ffffff';
                  const blockBg = isWhite ? (darkMode ? '#555' : '#e5e7eb') : card.color;
                  const textColor = isWhite ? (darkMode ? 'white' : '#374151') : 'white';
                  const isDragging = timelineDragId === card.id;
                  const draggedIdx = timelineDragId ? sceneMetrics.cards.findIndex(c => c.id === timelineDragId) : -1;
                  const showDropBefore = timelineDropIndex === idx && timelineDragId && draggedIdx !== idx && draggedIdx !== idx - 1;
                  const showDropAfter = timelineDropIndex === idx + 1 && timelineDragId && draggedIdx !== idx && draggedIdx !== idx + 1;

                  return (
                    <React.Fragment key={card.id}>
                      {/* Drop indicator - before this block */}
                      {showDropBefore && (
                        <div style={{
                          width: 4,
                          height: '100%',
                          background: '#3b82f6',
                          borderRadius: 2,
                          boxShadow: '0 0 8px #3b82f6, 0 0 16px #3b82f6',
                          flexShrink: 0,
                          zIndex: 20
                        }} />
                      )}
                      <div
                        data-timeline-block={card.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTimelineDragId(card.id);
                          setTimelineDropIndex(null);
                        }}
                        onMouseEnter={(e) => {
                          if (!timelineDragId) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredBlock({ id: card.id, rect, card: { ...card, synopsis: fullCard?.synopsis || card.synopsis } });
                          }
                        }}
                        onMouseLeave={() => {
                          if (!timelineDragId) setHoveredBlock(null);
                        }}
                        onDoubleClick={() => setEditModalCard(fullCard || card)}
                        style={{
                          width: blockWidth,
                          height: '100%',
                          background: isDragging ? '#3b82f6' : blockBg,
                          borderRight: `1px solid ${darkMode ? '#1a1a1a' : 'white'}`,
                          cursor: timelineDragId ? 'grabbing' : 'grab',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'visible',
                          opacity: isDragging ? 0.6 : (selectedCards.has(card.id) ? 1 : 0.85),
                          boxShadow: isDragging
                            ? '0 0 12px rgba(59, 130, 246, 0.8)'
                            : (selectedCards.has(card.id) ? `inset 0 0 0 2px ${isWhite ? '#3b82f6' : 'white'}` : 'none'),
                          flexShrink: 0,
                          transition: 'opacity 0.15s, box-shadow 0.15s',
                          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        {blockWidth > 60 && (
                          <span style={{ fontSize: 9, color: isDragging ? 'white' : textColor, textShadow: isWhite && !isDragging ? 'none' : '0 1px 2px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px', maxWidth: '100%' }}>
                            {card.title.replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '').substring(0, 20)}
                          </span>
                        )}
                      </div>
                      {/* Drop indicator - after this block */}
                      {showDropAfter && (
                        <div style={{
                          width: 4,
                          height: '100%',
                          background: '#3b82f6',
                          borderRadius: 2,
                          boxShadow: '0 0 8px #3b82f6, 0 0 16px #3b82f6',
                          flexShrink: 0,
                          zIndex: 20,
                          marginLeft: -2
                        }} />
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          {/* Add structure button */}
          <button
            onClick={() => {
              const label = prompt('Nom du nouveau bloc (ex: Acte 1, Élément déclencheur...)');
              if (label) setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label, flex: 1, color: null }]);
            }}
            style={{ width: 28, flexShrink: 0, background: darkMode ? '#333' : '#e5e7eb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6b7280' }}
            title="Ajouter un bloc de structure"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas zone */}
      <div ref={canvasRef} className="beat-canvas-bg" onMouseDown={!whiteboardEnabled ? handlePanStart : undefined} onMouseMove={!whiteboardEnabled ? handlePanMove : undefined} onMouseUp={!whiteboardEnabled ? handlePanEnd : undefined} onMouseLeave={!whiteboardEnabled ? handlePanEnd : undefined} onClick={!whiteboardEnabled ? () => setSelectedCards(new Set()) : undefined} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : (isSpacePressed ? 'grab' : 'default'), touchAction: 'none', backgroundImage: darkMode ? 'radial-gradient(circle, #484848 1px, transparent 1px)' : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`, backgroundPosition: `${pan.x * canvasZoom}px ${pan.y * canvasZoom}px` }}>
        {/* Beat cards layer - ABOVE Excalidraw so cards remain interactive */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: whiteboardEnabled ? 60 : 1, overflow: 'hidden' }}>
          {canvasCards.map(card => (
            <BeatCard
              key={card.id}
              card={card}
              inTimeline={false}
              excalidrawMode={whiteboardEnabled}
              zoom={canvasZoom}
              scroll={{ x: pan.x, y: pan.y }}
            />
          ))}
        </div>

        {/* Excalidraw whiteboard overlay - transparent background to see cards */}
        {whiteboardEnabled && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, width: '100%', height: '100%' }}>
            <style>{`
              .excalidraw, .excalidraw.theme--dark, .excalidraw.theme--light {
                --color-surface-primary-container: transparent !important;
                background: transparent !important;
              }
              .excalidraw .App-menu, .excalidraw .layer-ui__wrapper {
                background: transparent !important;
              }
              .excalidraw canvas {
                background: transparent !important;
              }
              /* Hide side elements with visibility to keep layout balanced for centering */
              .excalidraw .layer-ui__wrapper__top-right,
              .excalidraw .layer-ui__wrapper__top-left {
                visibility: hidden !important;
                pointer-events: none !important;
              }
              /* Completely hide footer elements */
              .excalidraw .layer-ui__wrapper__footer-right,
              .excalidraw .layer-ui__wrapper__footer-left,
              .excalidraw .layer-ui__wrapper__footer-center {
                display: none !important;
              }
            `}</style>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✏️</div>
                  <div>Chargement du whiteboard...</div>
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
                  canvasActions: {
                    loadScene: false,
                    export: { saveFileToDisk: false },
                    saveAsImage: false,
                    changeViewBackgroundColor: false,
                  },
                  tools: {
                    image: false,
                  }
                }}
              />
            </Suspense>

            {/* Convert to card menu - appears when a shape is selected */}
            {selectedExcalidrawId && (
              <div style={{
                position: 'absolute',
                top: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                background: darkMode ? '#2a2a2a' : 'white',
                border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
              }}>
                <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', marginRight: 4 }}>Convertir en :</span>
                <button
                  onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'scene')}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  🎬 Scène
                </button>
                <button
                  onClick={() => convertExcalidrawToCard(selectedExcalidrawId, 'note')}
                  style={{
                    padding: '6px 12px',
                    background: '#fbbf24',
                    border: 'none',
                    borderRadius: 6,
                    color: '#92400e',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  📝 Note
                </button>
              </div>
            )}

            {/* Whiteboard instructions */}
            <div style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 10,
              color: '#6b7280',
              maxWidth: 280,
            }}>
              💡 Dessinez librement • Sélectionnez une forme pour la convertir en carte • iPad + Apple Pencil supporté
            </div>
          </div>
        )}

        {canvasCards.length === 0 && timelineCards.length > 0 && !whiteboardEnabled && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Toutes vos scènes sont dans la timeline</div>
            <div style={{ fontSize: 12 }}>Cliquez sur "+ Carte" pour ajouter des idées</div>
          </div>
        )}

        {/* Canvas controls overlay - moves down when whiteboard is enabled to not hide Excalidraw menu */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: 100 }}>
          <button onClick={addNewCard} style={{ padding: '7px 12px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', height: 32 }}>
            <span style={{ fontSize: 14 }}>+</span> Carte
          </button>
          <button onClick={() => {
            const newNote = { id: 'note_' + Date.now(), linkedSceneId: null, linkedSceneIndex: null, title: '📝 Note', synopsis: '', color: '#fbbf24', position: { x: 150 / canvasZoom - pan.x, y: 150 / canvasZoom - pan.y }, timelineIndex: null, status: null, isNew: true, type: 'note' };
            setBeatCards(prev => [...prev, newNote]);
            setSelectedCards(new Set([newNote.id]));
            setEditModalCard(newNote);
          }} style={{ padding: '7px 12px', background: darkMode ? 'rgba(85,85,85,0.95)' : 'rgba(254,243,199,0.98)', border: 'none', borderRadius: 6, color: darkMode ? '#fbbf24' : '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', height: 32 }}>
            📝 Note
          </button>
          <button
            onClick={() => {
              if (!whiteboardEnabled) setWhiteboardKey(k => k + 1);
              setWhiteboardEnabled(!whiteboardEnabled);
            }}
            style={{
              padding: '7px 12px',
              height: 32,
              background: whiteboardEnabled ? '#8b5cf6' : (darkMode ? 'rgba(58,58,58,0.95)' : 'rgba(255,255,255,0.98)'),
              border: whiteboardEnabled ? 'none' : `1px solid ${darkMode ? '#555' : '#d1d5db'}`,
              borderRadius: 6,
              color: whiteboardEnabled ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'),
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            title="Activer le whiteboard pour dessiner"
          >
            ✏️ {whiteboardEnabled ? 'Dessin ON' : 'Dessiner'}
          </button>
        </div>

        {/* Stats and apply button - Top right - moves down when whiteboard is enabled */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, zIndex: 100 }}>
          <div style={{ background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.95)', padding: '6px 10px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>{timelineCards.length} CUT</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{beatCards.filter(c => c.timelineIndex === null).length} UNCUT</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>•</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{sceneMetrics.totalPages.toFixed(1)}p</span>
          </div>
          {timelineCards.filter(c => c.linkedSceneId).length > 0 && (
            <button
              onClick={applyTimelineOrder}
              style={{ padding: '6px 12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              Appliquer au script
            </button>
          )}
        </div>

        {/* Canvas zoom controls - Bottom right overlay - Hidden when whiteboard is active (use Excalidraw's controls) */}
        {!whiteboardEnabled && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, background: darkMode ? 'rgba(51,51,51,0.9)' : 'rgba(255,255,255,0.9)', padding: '6px 8px', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>
            <button onClick={() => setCanvasZoom(z => Math.max(0.3, z - 0.1))} style={{ width: 24, height: 24, borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 36, textAlign: 'center' }}>{Math.round(canvasZoom * 100)}%</span>
            <button onClick={() => setCanvasZoom(z => Math.min(2, z + 0.1))} style={{ width: 24, height: 24, borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: darkMode ? 'white' : 'black', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <button onClick={() => { setCanvasZoom(1); setPan({ x: 0, y: 0 }); }} style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10 }}>Reset</button>
            <button
              onClick={() => {
                // Generate SVG export of the beat board
                const cards = beatCards.filter(c => c.position);
                if (cards.length === 0) {
                  alert('Aucune carte à exporter');
                  return;
                }

                // Calculate bounds
                const padding = 50;
                const cardWidth = 160;
                const cardHeight = 100;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                cards.forEach(c => {
                  minX = Math.min(minX, c.position.x);
                  minY = Math.min(minY, c.position.y);
                  maxX = Math.max(maxX, c.position.x + cardWidth);
                  maxY = Math.max(maxY, c.position.y + cardHeight);
                });

                const width = maxX - minX + padding * 2;
                const height = maxY - minY + padding * 2;
                const offsetX = -minX + padding;
                const offsetY = -minY + padding;

                // Build SVG
                let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family: system-ui, sans-serif;">`;
                svg += `<rect width="100%" height="100%" fill="${darkMode ? '#2d2d2d' : '#f3f4f6'}"/>`;

                // Draw cards
                cards.forEach((card, idx) => {
                  const x = card.position.x + offsetX;
                  const y = card.position.y + offsetY;
                  const bgColor = card.color === '#ffffff' ? (darkMode ? '#3a3a3a' : 'white') : card.color;
                  const textColor = card.color === '#ffffff' ? (darkMode ? 'white' : '#1f2937') : 'white';
                  const borderColor = card.color === '#ffffff' ? (darkMode ? '#555' : '#d1d5db') : card.color;

                  svg += `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>`;

                  // Scene number badge
                  if (card.linkedSceneId) {
                    const sceneNum = elements.filter(el => el.type === 'scene').findIndex(el => el.id === card.linkedSceneId) + 1;
                    svg += `<circle cx="${x + 12}" cy="${y + 12}" r="10" fill="${darkMode ? '#484848' : '#e5e7eb'}"/>`;
                    svg += `<text x="${x + 12}" y="${y + 16}" text-anchor="middle" font-size="9" fill="${darkMode ? 'white' : '#374151'}">${sceneNum}</text>`;
                  }

                  // Title
                  const title = (card.title || '').substring(0, 25) + ((card.title || '').length > 25 ? '...' : '');
                  svg += `<text x="${x + 10}" y="${y + 35}" font-size="11" font-weight="600" fill="${textColor}">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;

                  // Synopsis
                  if (card.synopsis) {
                    const synopsisLines = (card.synopsis || '').substring(0, 80).split(/(.{30})/g).filter(Boolean).slice(0, 2);
                    synopsisLines.forEach((line, lineIdx) => {
                      svg += `<text x="${x + 10}" y="${y + 52 + lineIdx * 12}" font-size="9" fill="${card.color === '#ffffff' ? '#6b7280' : 'rgba(255,255,255,0.8)'}">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
                    });
                  }
                });

                svg += '</svg>';

                // Download
                const blob = new Blob([svg], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `beatboard-${new Date().toISOString().slice(0,10)}.svg`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              }}
              style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4, background: darkMode ? '#484848' : '#e5e7eb', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}
              title="Exporter en SVG"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              SVG
            </button>
          </div>
        )}
      </div>

      {/* Hover preview for timeline blocks - rendered outside timeline to avoid overflow issues */}
      {hoveredBlock && hoveredBlock.card && (
        <div
          style={{
            position: 'fixed',
            left: hoveredBlock.rect.left + hoveredBlock.rect.width / 2 - 90, // center it (180/2 = 90)
            top: hoveredBlock.rect.bottom + 8,
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div style={{
            width: 180,
            minHeight: 100,
            background: hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#3a3a3a' : 'white') : hoveredBlock.card.color,
            border: hoveredBlock.card.color === '#ffffff' ? `1px solid ${darkMode ? '#555' : '#d1d5db'}` : 'none',
            borderRadius: 8,
            padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            borderLeft: hoveredBlock.card.color === '#ffffff' ? `4px solid ${darkMode ? '#6b7280' : '#9ca3af'}` : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: hoveredBlock.card.color === '#ffffff' ? (darkMode ? 'white' : '#1f2937') : 'white', marginBottom: 6, lineHeight: 1.3 }}>{hoveredBlock.card.title}</div>
            {hoveredBlock.card.synopsis && <div style={{ fontSize: 10, color: hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#9ca3af' : '#6b7280') : 'rgba(255,255,255,0.85)', marginBottom: 6, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{hoveredBlock.card.synopsis}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: hoveredBlock.card.color === '#ffffff' ? '#9ca3af' : 'rgba(255,255,255,0.7)', borderTop: `1px solid ${hoveredBlock.card.color === '#ffffff' ? (darkMode ? '#555' : '#e5e7eb') : 'rgba(255,255,255,0.2)'}`, paddingTop: 6, marginTop: 4 }}>
              <span>{(hoveredBlock.card.pages || 1).toFixed(1)} pages</span>
              <span>•</span>
              <span>{Math.floor(hoveredBlock.card.pages || 1)}:{String(Math.round(((hoveredBlock.card.pages || 1) % 1) * 60)).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {editModalCard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setEditModalCard(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: darkMode ? '#2a2a2a' : 'white',
              borderRadius: 12,
              width: 400,
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header with color bar */}
            <div style={{ height: 8, background: editModalCard.color }} />
            <div style={{ padding: 20 }}>
              {/* Scene title (read-only for linked scenes) */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                  {editModalCard.linkedSceneId ? 'Scène (liée au script)' : 'Titre'}
                </label>
                {editModalCard.linkedSceneId ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: darkMode ? 'white' : 'black', padding: '8px 12px', background: darkMode ? '#1a1a1a' : '#f3f4f6', borderRadius: 6 }}>
                      {editModalCard.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                      Le titre vient du script. Modifiez-le dans l'éditeur de script.
                    </div>
                  </>
                ) : (
                  <input
                    value={editModalCard.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setEditModalCard(prev => ({ ...prev, title: newTitle }));
                      updateCard(editModalCard.id, { title: newTitle });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 14,
                      fontWeight: 600,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      borderRadius: 6,
                      background: darkMode ? '#1a1a1a' : 'white',
                      color: darkMode ? 'white' : 'black',
                      outline: 'none'
                    }}
                  />
                )}
              </div>

              {/* Synopsis - main editable field */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                  Résumé de la scène
                </label>
                <textarea
                  autoFocus
                  value={editModalCard.synopsis || ''}
                  onChange={(e) => {
                    const newSynopsis = e.target.value;
                    setEditModalCard(prev => ({ ...prev, synopsis: newSynopsis }));
                    updateCard(editModalCard.id, { synopsis: newSynopsis });
                  }}
                  placeholder="Décrivez cette scène en une phrase..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                    borderRadius: 6,
                    background: darkMode ? '#1a1a1a' : 'white',
                    color: darkMode ? 'white' : 'black',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: 80,
                    lineHeight: 1.5
                  }}
                />
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  Ce résumé reste dans le Beat Board uniquement
                </div>
              </div>

              {/* CUT/UNCUT toggle */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Montage</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      const newIndex = editModalCard.timelineIndex === null
                        ? Math.max(-1, ...beatCards.filter(c => c.timelineIndex !== null).map(c => c.timelineIndex)) + 1
                        : null;
                      setEditModalCard(prev => ({ ...prev, timelineIndex: newIndex }));
                      if (newIndex !== null) {
                        setBeatCards(prev => {
                          const maxIdx = Math.max(-1, ...prev.filter(c => c.timelineIndex !== null && c.id !== editModalCard.id).map(c => c.timelineIndex));
                          return prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: maxIdx + 1 } : c);
                        });
                      } else {
                        setBeatCards(prev => prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: null } : c));
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: editModalCard.timelineIndex !== null ? '2px solid #22c55e' : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: editModalCard.timelineIndex !== null ? '#22c55e20' : 'transparent',
                      color: darkMode ? 'white' : 'black',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <span>🎬</span> CUT {editModalCard.timelineIndex !== null && '✓'}
                  </button>
                  <button
                    onClick={() => {
                      setEditModalCard(prev => ({ ...prev, timelineIndex: null }));
                      setBeatCards(prev => prev.map(c => c.id === editModalCard.id ? { ...c, timelineIndex: null } : c));
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 6,
                      border: editModalCard.timelineIndex === null ? `2px solid ${darkMode ? '#555' : '#9ca3af'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: editModalCard.timelineIndex === null ? (darkMode ? '#55555530' : '#9ca3af20') : 'transparent',
                      color: darkMode ? 'white' : 'black',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    UNCUT {editModalCard.timelineIndex === null && '✓'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  {editModalCard.timelineIndex !== null ? 'Cette scène fait partie du montage final' : 'Cette scène est hors montage (mais reste dans le canvas)'}
                </div>
              </div>

              {/* Color picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Couleur</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {cardColors.map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        setEditModalCard(prev => ({ ...prev, color }));
                        updateCard(editModalCard.id, { color });
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: color,
                        border: editModalCard.color === color ? '3px solid white' : 'none',
                        boxShadow: editModalCard.color === color ? `0 0 0 2px ${color}` : 'none',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Statut</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: null, label: 'Aucun', icon: '○' },
                    { value: 'progress', label: 'En cours', icon: '◐', bg: '#3b82f6' },
                    { value: 'done', label: 'Terminé', icon: '✓', bg: '#22c55e' },
                    { value: 'urgent', label: 'Urgent', icon: '!', bg: '#ef4444' }
                  ].map(status => (
                    <button
                      key={status.value || 'none'}
                      onClick={() => {
                        setEditModalCard(prev => ({ ...prev, status: status.value }));
                        updateCard(editModalCard.id, { status: status.value });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: editModalCard.status === status.value ? `2px solid ${status.bg || '#6b7280'}` : `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                        background: editModalCard.status === status.value ? (status.bg ? `${status.bg}20` : 'transparent') : 'transparent',
                        color: darkMode ? 'white' : 'black',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span style={{ color: status.bg || '#6b7280' }}>{status.icon}</span>
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setEditModalCard(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#3b82f6',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default BeatBoard;
