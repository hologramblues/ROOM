import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Google Docs-style comment positioning.
 *
 * Instead of pre-computing positions and syncing scroll 1:1, this hook:
 * 1. Listens to the script container's scroll events
 * 2. On each scroll frame, reads the viewport position of each element that has a comment
 * 3. Directly updates comment card transforms via DOM (no React re-render)
 *
 * This gives buttery-smooth scroll sync with zero layout thrashing.
 */
export default function useElementPositions({ showComments, elementsRef, elementsLength, isSafari, scriptContainerRef, commentsSidebarRef }) {
  // We still expose elementPositions for initial render and for the anti-overlap logic
  const [elementPositions, setElementPositions] = useState({});
  const rafRef = useRef(null);

  // Compute positions from DOM — called on scroll and on mount
  const computePositions = useCallback(() => {
    const script = scriptContainerRef.current;
    if (!script) return {};

    const positions = {};
    const scriptRect = script.getBoundingClientRect();
    const scrollTop = script.scrollTop;

    // Only query elements that have comments (they have data-element-id)
    const elementDivs = script.querySelectorAll('[data-element-id]');
    elementDivs.forEach(div => {
      const elId = div.getAttribute('data-element-id');
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        // Position relative to the script container's scroll origin
        const rect = div.getBoundingClientRect();
        positions[index] = rect.top - scriptRect.top + scrollTop;
      }
    });

    return positions;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Direct DOM update of comment card positions on scroll — bypasses React for performance
  const updateCardTransforms = useCallback(() => {
    const script = scriptContainerRef.current;
    const sidebar = commentsSidebarRef?.current;
    if (!script || !sidebar) return;

    const scriptRect = script.getBoundingClientRect();
    const sidebarScrollContainer = sidebar;

    // Get all comment cards in the sidebar
    const cards = sidebarScrollContainer.querySelectorAll('[data-comment-element-index]');
    if (cards.length === 0) return;

    // Build a map of element index -> viewport Y from the script
    const elementViewportY = {};
    const elementDivs = script.querySelectorAll('[data-element-id]');
    elementDivs.forEach(div => {
      const elId = div.getAttribute('data-element-id');
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        elementViewportY[index] = div.getBoundingClientRect().top - scriptRect.top;
      }
    });

    // Position each card relative to the sidebar top, matching the script element's viewport position
    // Anti-overlap: track the bottom of the last card
    let lastBottom = -Infinity;
    const GAP = 12;

    cards.forEach(card => {
      const elemIdx = parseInt(card.getAttribute('data-comment-element-index'), 10);
      const viewportY = elementViewportY[elemIdx];
      if (viewportY == null) return;

      // The ideal position: same Y as the element in the script, relative to sidebar content area
      // sidebarRect.top accounts for the sidebar header
      let idealY = viewportY;

      // Anti-overlap: push down if overlapping with previous card
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

  // Scroll listener — uses rAF for 60fps updates
  useEffect(() => {
    if (!showComments) return;
    const script = scriptContainerRef.current;
    if (!script) return;

    const onScroll = () => {
      if (rafRef.current) return; // Already scheduled
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateCardTransforms();
      });
    };

    // Initial position calculation (for React-based layout)
    const positions = computePositions();
    setElementPositions(positions);

    // Initial DOM transform update after React renders the cards
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateCardTransforms();
      });
    });

    script.addEventListener('scroll', onScroll, { passive: true });

    // Also update on window resize
    const onResize = () => {
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    };
    window.addEventListener('resize', onResize);

    // Periodic refresh for content changes (less frequent)
    const interval = setInterval(() => {
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    }, isSafari ? 3000 : 1500);

    return () => {
      script.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [showComments, elementsLength, isSafari, computePositions, updateCardTransforms]); // eslint-disable-line react-hooks/exhaustive-deps

  return { elementPositions };
}
