import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Google Docs-style comment positioning.
 *
 * On each scroll frame, reads the viewport position of each element that has a comment
 * and directly updates comment card transforms via DOM (no React re-render).
 * Cards are aligned so they sit at the same visual height as their anchored element.
 */
export default function useElementPositions({ showComments, elementsRef, elementsLength, isSafari, scriptContainerRef, commentsSidebarRef }) {
  const [elementPositions, setElementPositions] = useState({});
  const rafRef = useRef(null);
  // Cache element-id -> DOM node for fast lookup (rebuilt on content changes)
  const elementDomCacheRef = useRef(new Map());

  // Rebuild DOM cache when element count changes
  const rebuildDomCache = useCallback(() => {
    const script = scriptContainerRef.current;
    if (!script) return;
    const cache = new Map();
    const divs = script.querySelectorAll('[data-element-id]');
    divs.forEach(div => {
      cache.set(div.getAttribute('data-element-id'), div);
    });
    elementDomCacheRef.current = cache;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute positions for React-based initial layout
  const computePositions = useCallback(() => {
    const script = scriptContainerRef.current;
    if (!script) return {};
    const positions = {};
    const scriptRect = script.getBoundingClientRect();
    const scrollTop = script.scrollTop;
    elementDomCacheRef.current.forEach((div, elId) => {
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        positions[index] = div.getBoundingClientRect().top - scriptRect.top + scrollTop;
      }
    });
    return positions;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct DOM update of comment card positions on scroll
  const updateCardTransforms = useCallback(() => {
    const script = scriptContainerRef.current;
    const sidebar = commentsSidebarRef?.current;
    if (!script || !sidebar) return;

    const scriptRect = script.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const yOffset = scriptRect.top - sidebarRect.top;

    const cards = sidebar.querySelectorAll('[data-comment-element-index]');
    if (cards.length === 0) return;

    // Only look up DOM positions for elements that have comment cards (not ALL elements)
    const neededIndices = new Set();
    cards.forEach(card => neededIndices.add(parseInt(card.getAttribute('data-comment-element-index'), 10)));

    const elementViewportY = {};
    neededIndices.forEach(index => {
      const el = elementsRef.current[index];
      if (!el) return;
      const div = elementDomCacheRef.current.get(el.id);
      if (div) {
        elementViewportY[index] = div.getBoundingClientRect().top - scriptRect.top;
      }
    });

    // Sort cards top-to-bottom for anti-overlap
    const sortedCards = Array.from(cards).sort((a, b) =>
      parseInt(a.getAttribute('data-comment-element-index'), 10) -
      parseInt(b.getAttribute('data-comment-element-index'), 10)
    );

    let lastBottom = -Infinity;
    const GAP = 12;

    sortedCards.forEach(card => {
      const elemIdx = parseInt(card.getAttribute('data-comment-element-index'), 10);
      const viewportY = elementViewportY[elemIdx];

      if (viewportY == null) {
        card.style.visibility = 'hidden';
        return;
      }

      let idealY = viewportY + yOffset;

      const cardHeight = card.offsetHeight || 120;
      if (idealY < lastBottom + GAP) {
        idealY = lastBottom + GAP;
      }

      card.style.transform = `translateY(${idealY}px)`;
      card.style.position = 'absolute';
      card.style.top = '0';
      card.style.left = '0';
      card.style.right = '0';
      card.style.visibility = 'visible';

      lastBottom = idealY + cardHeight;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showComments) return;
    const script = scriptContainerRef.current;
    if (!script) return;

    // Build initial DOM cache
    rebuildDomCache();

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateCardTransforms();
      });
    };

    // Initial positions
    const positions = computePositions();
    setElementPositions(positions);

    // Wait for React to render cards, then position them
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateCardTransforms());
    });

    script.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => {
      rebuildDomCache();
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    };
    window.addEventListener('resize', onResize);

    // Periodic refresh for content changes (rebuild DOM cache + reposition)
    const interval = setInterval(() => {
      rebuildDomCache();
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    }, isSafari ? 3000 : 2000);

    return () => {
      script.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [showComments, elementsLength, isSafari, computePositions, updateCardTransforms, rebuildDomCache]); // eslint-disable-line react-hooks/exhaustive-deps

  return { elementPositions };
}
