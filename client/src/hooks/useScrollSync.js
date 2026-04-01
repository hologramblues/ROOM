import { useEffect } from 'react';

/**
 * Scroll sync between Script and Outline sidebar.
 * - Script <-> Outline: Scene-based sync (scrolling script highlights matching scene in outline)
 * - Outline -> Script: scrolling outline jumps to that scene in script
 *
 * NOTE: Script <-> Comments sync is handled by useElementPositions (rAF-based DOM transforms).
 * The old 1:1 pixel sync between script and comments has been removed — it caused lag and
 * desync when comment positions didn't match script content height.
 */
export default function useScrollSync({
  scriptContainerRef,
  outlineSidebarRef,
  commentsSidebarRef, // kept for API compat but no longer used for scroll sync
  elementsRef,
  showComments,
  showOutline,
  setScriptScrollHeight,
}) {
  // Scroll sync for script <-> outline
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;

    let outlineRAF = null;
    let lastTopScene = null;
    let scrollSource = null;
    let lockTimeout = null;
    const isSafariSync = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const LOCK_MS = isSafariSync ? 60 : 0;

    const acquireLock = (source) => {
      if (scrollSource && scrollSource !== source) return false;
      scrollSource = source;
      if (lockTimeout) clearTimeout(lockTimeout);
      lockTimeout = setTimeout(() => { scrollSource = null; }, LOCK_MS);
      return true;
    };

    const findTopSceneInScript = () => {
      const scriptRect = script.getBoundingClientRect();
      const sceneElements = script.querySelectorAll('[data-element-id]');

      for (const el of sceneElements) {
        const elId = el.getAttribute('data-element-id');
        const idx = elementsRef.current.findIndex(e => e.id === elId);
        if (idx === -1 || elementsRef.current[idx]?.type !== 'scene') continue;

        const rect = el.getBoundingClientRect();
        if (rect.top >= scriptRect.top - 50 && rect.top <= scriptRect.top + 150) {
          return idx;
        }
        if (rect.bottom > scriptRect.top + 50) {
          return idx;
        }
      }
      return null;
    };

    const findTopSceneInOutline = () => {
      const outline = outlineSidebarRef.current;
      if (!outline) return null;
      const outlineRect = outline.getBoundingClientRect();
      const sceneElements = outline.querySelectorAll('[data-outline-element-index]');

      for (const el of sceneElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= outlineRect.top - 20 && rect.top <= outlineRect.top + 80) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
        if (rect.bottom > outlineRect.top + 20) {
          return parseInt(el.getAttribute('data-outline-element-index'), 10);
        }
      }
      return null;
    };

    const scrollOutlineToScene = (sceneIndex) => {
      const outline = outlineSidebarRef.current;
      if (!outline) return;
      const sceneEl = outline.querySelector(`[data-outline-element-index="${sceneIndex}"]`);
      if (sceneEl) {
        const outlineRect = outline.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = outline.scrollTop + (sceneRect.top - outlineRect.top) - 10;
        outline.scrollTop = Math.max(0, targetScroll);
      }
    };

    const scrollScriptToScene = (sceneIndex) => {
      const sceneId = elementsRef.current[sceneIndex]?.id;
      const sceneEl = sceneId ? script.querySelector(`[data-element-id="${sceneId}"]`) : null;
      if (sceneEl) {
        const scriptRect = script.getBoundingClientRect();
        const sceneRect = sceneEl.getBoundingClientRect();
        const targetScroll = script.scrollTop + (sceneRect.top - scriptRect.top) - 32;
        script.scrollTop = Math.max(0, targetScroll);
      }
    };

    const handleScriptScroll = () => {
      if (!acquireLock('script')) return;
      const outline = outlineSidebarRef.current;
      if (outline) {
        if (outlineRAF) cancelAnimationFrame(outlineRAF);
        outlineRAF = requestAnimationFrame(() => {
          const topScene = findTopSceneInScript();
          if (topScene !== null && topScene !== lastTopScene) {
            lastTopScene = topScene;
            scrollOutlineToScene(topScene);
          }
        });
      }
    };

    const handleOutlineScroll = () => {
      if (!acquireLock('outline')) return;
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      outlineRAF = requestAnimationFrame(() => {
        const topScene = findTopSceneInOutline();
        if (topScene !== null && topScene !== lastTopScene) {
          lastTopScene = topScene;
          scrollScriptToScene(topScene);
        }
      });
    };

    // Attach listeners
    script.addEventListener('scroll', handleScriptScroll, { passive: true });

    let outlineListener = null;
    const attachListeners = () => {
      const outline = outlineSidebarRef.current;
      if (outline && !outlineListener) {
        outlineListener = handleOutlineScroll;
        outline.addEventListener('scroll', outlineListener, { passive: true });
      }
    };

    attachListeners();
    const attachTimeout = setTimeout(attachListeners, 100);
    const attachTimeout2 = setTimeout(attachListeners, 500);

    const outlineEl = outlineSidebarRef.current;

    return () => {
      script.removeEventListener('scroll', handleScriptScroll);
      if (outlineEl && outlineListener) {
        outlineEl.removeEventListener('scroll', outlineListener);
      }
      if (outlineRAF) cancelAnimationFrame(outlineRAF);
      if (lockTimeout) clearTimeout(lockTimeout);
      clearTimeout(attachTimeout);
      clearTimeout(attachTimeout2);
    };
  }, [showComments, showOutline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track script's scrollHeight for comments sidebar min-height
  useEffect(() => {
    const script = scriptContainerRef.current;
    if (!script) return;

    const safariDetected = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let throttleTimeout = null;

    const updateHeight = () => {
      if (safariDetected) {
        if (throttleTimeout) return;
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          setScriptScrollHeight(script.scrollHeight);
        }, 500);
      } else {
        setScriptScrollHeight(script.scrollHeight);
      }
    };

    updateHeight();

    if (safariDetected) {
      const interval = setInterval(() => {
        setScriptScrollHeight(script.scrollHeight);
      }, 2000);
      return () => {
        clearInterval(interval);
        if (throttleTimeout) clearTimeout(throttleTimeout);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(script);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
