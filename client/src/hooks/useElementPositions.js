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

  // Compute positions for React-based initial layout (adjustedPositions in CommentsSidebar)
  const computePositions = useCallback(() => {
    const script = scriptContainerRef.current;
    if (!script) return {};

    const positions = {};
    const scriptRect = script.getBoundingClientRect();
    const scrollTop = script.scrollTop;

    const elementDivs = script.querySelectorAll('[data-element-id]');
    elementDivs.forEach(div => {
      const elId = div.getAttribute('data-element-id');
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        positions[index] = rect_topRelative(div, scriptRect, scrollTop);
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
    const sidebarRect = sidebar.getBoundingClientRect();

    // Offset between script viewport top and sidebar content area top
    // This ensures cards align with their script elements
    const yOffset = scriptRect.top - sidebarRect.top;

    // Get all comment cards in the sidebar
    const cards = sidebar.querySelectorAll('[data-comment-element-index]');
    if (cards.length === 0) return;

    // Build a map of element index -> viewport Y relative to script container
    const elementViewportY = {};
    const elementDivs = script.querySelectorAll('[data-element-id]');
    elementDivs.forEach(div => {
      const elId = div.getAttribute('data-element-id');
      const index = elementsRef.current.findIndex(e => e.id === elId);
      if (index !== -1) {
        // Position relative to script container viewport (not document)
        elementViewportY[index] = div.getBoundingClientRect().top - scriptRect.top;
      }
    });

    // Sort cards by element index so anti-overlap works top-to-bottom
    const sortedCards = Array.from(cards).sort((a, b) => {
      return parseInt(a.getAttribute('data-comment-element-index'), 10) -
             parseInt(b.getAttribute('data-comment-element-index'), 10);
    });

    // Position each card, applying the yOffset so it aligns with the script element
    let lastBottom = -Infinity;
    const GAP = 12;

    sortedCards.forEach(card => {
      const elemIdx = parseInt(card.getAttribute('data-comment-element-index'), 10);
      const viewportY = elementViewportY[elemIdx];

      if (viewportY == null) {
        // Element not in viewport — hide card
        card.style.visibility = 'hidden';
        return;
      }

      // Ideal Y = element's viewport position + offset to convert from script coords to sidebar coords
      let idealY = viewportY + yOffset;

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
      card.style.visibility = 'visible';

      lastBottom = idealY + cardHeight;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll listener — uses rAF for 60fps updates
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

    // Initial position calculation
    const positions = computePositions();
    setElementPositions(positions);

    // Initial DOM transform update after React renders the cards
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateCardTransforms();
      });
    });

    script.addEventListener('scroll', onScroll, { passive: true });

    const onResize = () => {
      const positions = computePositions();
      setElementPositions(positions);
      requestAnimationFrame(() => updateCardTransforms());
    };
    window.addEventListener('resize', onResize);

    // Periodic refresh for content changes
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

// Helper: element top relative to script container scroll origin
function rect_topRelative(div, scriptRect, scrollTop) {
  return div.getBoundingClientRect().top - scriptRect.top + scrollTop;
}
