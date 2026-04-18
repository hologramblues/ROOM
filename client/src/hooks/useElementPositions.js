import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Google Docs-style comment positioning.
 *
 * Strategy: the sidebar is a scroll container with a spacer matching the script height.
 * Its scrollTop is synced to the script's scrollTop on every frame.
 * Cards are positioned with position:absolute + transform:translateY based on
 * their element's position in the document (not viewport), so they naturally
 * scroll with the sidebar.
 */
export default function useElementPositions({ showComments, elementsRef, elementsLength, isSafari, scriptContainerRef, commentsSidebarRef }) {
  const [elementPositions, setElementPositions] = useState({});
  const rafRef = useRef(null);

  // Compute positions relative to script scroll origin (for React initial layout)
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

  // Sync sidebar scrollTop with script + update card positions
  const updateCardTransforms = useCallback(() => {
    const script = scriptContainerRef.current;
    const sidebar = commentsSidebarRef?.current;
    if (!script || !sidebar) return;

    // 1. Sync sidebar scroll with script scroll
    sidebar.scrollTop = script.scrollTop;

    // 2. Update spacer height to match script
    const spacer = sidebar.querySelector('[data-comments-spacer]');
    if (spacer) {
      spacer.style.height = script.scrollHeight + 'px';
    }

    // 3. Position cards at their element's document position (absolute, not viewport)
    const cards = sidebar.querySelectorAll('[data-comment-element-index]');
    if (cards.length === 0) return;

    const scriptRect = script.getBoundingClientRect();
    const scrollTop = script.scrollTop;

    // Collect needed indices
    const neededIndices = new Set();
    cards.forEach(card => neededIndices.add(parseInt(card.getAttribute('data-comment-element-index'), 10)));

    // Get document-position (scroll origin relative) for each needed element
    const elementDocY = {};
    neededIndices.forEach(index => {
      const el = elementsRef.current[index];
      if (!el) return;
      const div = script.querySelector(`[data-element-id="${el.id}"]`);
      if (div) {
        elementDocY[index] = div.getBoundingClientRect().top - scriptRect.top + scrollTop;
      }
    });

    // Sort cards top-to-bottom
    const sortedCards = Array.from(cards).sort((a, b) =>
      parseInt(a.getAttribute('data-comment-element-index'), 10) -
      parseInt(b.getAttribute('data-comment-element-index'), 10)
    );

    let lastBottom = -Infinity;
    const GAP = 12;

    sortedCards.forEach(card => {
      const elemIdx = parseInt(card.getAttribute('data-comment-element-index'), 10);
      const docY = elementDocY[elemIdx];
      if (docY == null) return;

      let idealY = docY;
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

    // Initial
    const positions = computePositions();
    setElementPositions(positions);
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

    // Triggered update: debounced via rAF, fires on any DOM/size change
    let updateScheduled = false;
    const scheduleUpdate = () => {
      if (updateScheduled) return;
      updateScheduled = true;
      requestAnimationFrame(() => {
        updateScheduled = false;
        const positions = computePositions();
        setElementPositions(positions);
        updateCardTransforms();
      });
    };

    // Watch for DOM changes (element adds/removes, attribute changes)
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(script, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-element-id', 'data-element-type'],
    });

    // Watch for size changes (zoom, font swap, responsive layout)
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(script);

    // Safety-net interval: only fires every 10s (vs 2-3s before) to catch anything missed
    const safetyInterval = setInterval(scheduleUpdate, 10000);

    return () => {
      script.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      clearInterval(safetyInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [showComments, elementsLength, isSafari, computePositions, updateCardTransforms]); // eslint-disable-line react-hooks/exhaustive-deps

  return { elementPositions };
}
