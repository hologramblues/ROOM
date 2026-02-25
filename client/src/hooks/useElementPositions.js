import { useEffect, useRef, useState } from 'react';

/**
 * Tracks DOM positions of screenplay elements for comments sidebar alignment.
 * Returns a map of { elementIndex: topPosition } used by CommentsSidebar
 * to position comment cards next to their corresponding elements (Google Docs style).
 *
 * Safari-aware: uses longer throttles and less frequent intervals to avoid jank.
 */
export default function useElementPositions({ showComments, elementsRef, elementsLength, isSafari, scriptContainerRef }) {
  const [elementPositions, setElementPositions] = useState({});
  const positionsUpdateTimeoutRef = useRef(null);

  useEffect(() => {
    if (!showComments) return;

    // Collect element positions - only update when needed
    const updatePositions = () => {
      if (positionsUpdateTimeoutRef.current) return; // Throttle

      positionsUpdateTimeoutRef.current = setTimeout(() => {
        positionsUpdateTimeoutRef.current = null;
        requestAnimationFrame(() => {
          const positions = {};
          const elementDivs = document.querySelectorAll('[data-element-id]');
          elementDivs.forEach(div => {
            const elId = div.getAttribute('data-element-id');
            const index = elementsRef.current.findIndex(e => e.id === elId);
            if (index !== -1) {
              const rect = div.getBoundingClientRect();
              const containerRect = scriptContainerRef.current?.getBoundingClientRect();
              const containerScrollTop = scriptContainerRef.current?.scrollTop || 0;
              if (containerRect) {
                positions[index] = rect.top - containerRect.top + containerScrollTop;
              } else {
                positions[index] = rect.top + window.scrollY - 60;
              }
            }
          });
          setElementPositions(positions);
        });
      }, isSafari ? 500 : 100); // Much longer throttle on Safari
    };

    // Initial update (delayed on Safari)
    setTimeout(updatePositions, isSafari ? 300 : 0);

    // Update on resize (heavily throttled)
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePositions, isSafari ? 500 : 100);
    };
    window.addEventListener('resize', handleResize);

    // Update positions very infrequently on Safari
    const positionInterval = setInterval(updatePositions, isSafari ? 5000 : 2000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(positionInterval);
      clearTimeout(resizeTimeout);
      if (positionsUpdateTimeoutRef.current) {
        clearTimeout(positionsUpdateTimeoutRef.current);
      }
    };
  }, [showComments, elementsLength, isSafari]); // eslint-disable-line react-hooks/exhaustive-deps

  return { elementPositions };
}
