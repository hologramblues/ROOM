import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Google Docs-style comment positioning.
 * Cards are positioned via direct DOM transforms synced to script scroll at 60fps.
 */
export default function useElementPositions({ showComments, elementsRef, elementsLength, isSafari, scriptContainerRef, commentsSidebarRef }) {
  const [elementPositions, setElementPositions] = useState({});
  const rafRef = useRef(null);

  // Compute positions for React-based initial layout (adjustedPositions)
  const computePositions = useCallback(() => {
    const script = scriptContainerRef.current;
    if (!script) return {};
    const positions = {};
    const scriptRect = script.getBoundingClientRect();
    const scrollTop = script.scrollTop;
    const divs = script.querySelectorAll('[data-element-id]');
    divs.forEach(div => {
      const elId = div.getAttribute('data-element-id');
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        positions[index] = div.getBoundingClientRect().top - scriptRect.top + scrollTop;
      }
    });
    return positions;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct DOM update of comment card positions on scroll — 60fps, no React
  const updateCardTransforms = useCallback(() => {
    const script = scriptContainerRef.current;
    const sidebar = commentsSidebarRef?.current;
    if (!script || !sidebar) return;

    const scriptRect = script.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const yOffset = scriptRect.top - sidebarRect.top;

    const cards = sidebar.querySelectorAll('[data-comment-element-index]');
    if (cards.length === 0) return;

    // Collect needed element indices from cards
    const neededIndices = new Set();
    cards.forEach(card => neededIndices.add(parseInt(card.getAttribute('data-comment-element-index'), 10)));

    // Look up viewport Y for each needed element — direct DOM query (fast for small set)
    const elementViewportY = {};
    neededIndices.forEach(index => {
      const el = elementsRef.current[index];
      if (!el) return;
      // Direct querySelector by element ID — precise and avoids stale cache
      const div = script.querySelector(`[data-element-id="${el.id}"]`);
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
        // Element not found — keep card at current position, don't hide
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

      lastBottom = idealY + cardHeight;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showComments) return;
    const script = scriptContainerRef.current;
    if (!script) return;

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

    // Wait for cards to render, then position them
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateCardTransforms());
    });

    script.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => {
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    };
    window.addEventListener('resize', onResize);

    // Periodic refresh for content changes (reposition cards)
    const interval = setInterval(() => {
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
  }, [showComments, elementsLength, isSafari, computePositions, updateCardTransforms]); // eslint-disable-line react-hooks/exhaustive-deps

  return { elementPositions };
}
