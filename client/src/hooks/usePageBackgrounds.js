import { useEffect } from 'react';

/**
 * Creates per-page white/dark rectangles behind the screenplay content,
 * giving each page its own floating rectangle + shadow (like Final Draft / V271).
 *
 * Uses offsetTop chain (NOT getBoundingClientRect) for zoom-agnostic positioning.
 * MutationObserver + ResizeObserver keep backgrounds in sync with content changes.
 */
export default function usePageBackgrounds({ darkMode, pageWrapperRef, pageBgTimerRef }) {
  useEffect(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) return;
    const bgColor = darkMode ? '#3a3a3a' : 'white';
    const shadow = darkMode ? '0 2px 16px rgba(0,0,0,0.5)' : '0 2px 16px rgba(0,0,0,0.15)';

    // Get element's internal top offset relative to a specific ancestor,
    // walking the offsetParent chain. This is zoom-agnostic.
    function internalTop(el, ancestor) {
      let top = 0;
      let cur = el;
      while (cur && cur !== ancestor) {
        top += cur.offsetTop;
        cur = cur.offsetParent;
      }
      return top;
    }

    function updatePageBgs() {
      if (!pageWrapperRef.current) return;
      const w = pageWrapperRef.current;
      const gaps = w.querySelectorAll('.page-break-gap');
      // scrollHeight is in the element's internal coordinate system (unaffected by CSS zoom)
      const wHeight = w.scrollHeight;
      const rects = [];
      let prevBottom = 0;
      gaps.forEach(g => {
        // offsetTop chain gives internal (pre-zoom) coordinates — no division needed
        const gTop = internalTop(g, w);
        const gBottom = gTop + g.offsetHeight;
        if (gTop > prevBottom) rects.push({ top: prevBottom, h: gTop - prevBottom });
        prevBottom = gBottom;
      });
      if (wHeight > prevBottom) rects.push({ top: prevBottom, h: wHeight - prevBottom });

      let c = w.querySelector('.page-bg-container');
      if (!c) {
        c = document.createElement('div');
        c.className = 'page-bg-container';
        c.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:-1;';
        w.insertBefore(c, w.firstChild);
      }
      while (c.children.length > rects.length) c.removeChild(c.lastChild);
      rects.forEach((r, i) => {
        let d = c.children[i];
        if (!d) { d = document.createElement('div'); c.appendChild(d); }
        d.style.cssText = `position:absolute;top:${r.top}px;left:0;right:0;height:${r.h}px;background:${bgColor};box-shadow:${shadow};border-radius:2px;pointer-events:none;`;
      });
    }

    // Double rAF to ensure ProseMirror decorations have rendered
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        updatePageBgs();
      });
    });

    // Also watch for DOM mutations (content edits that change page breaks)
    const observer = new MutationObserver(() => {
      clearTimeout(pageBgTimerRef.current);
      pageBgTimerRef.current = setTimeout(updatePageBgs, 80);
    });
    observer.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

    // Watch for resize
    const resizeObs = new ResizeObserver(() => {
      clearTimeout(pageBgTimerRef.current);
      pageBgTimerRef.current = setTimeout(updatePageBgs, 80);
    });
    resizeObs.observe(wrapper);

    return () => {
      cancelled = true;
      observer.disconnect();
      resizeObs.disconnect();
      clearTimeout(pageBgTimerRef.current);
      // Clean up bg container
      const bg = wrapper.querySelector('.page-bg-container');
      if (bg) bg.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode]);
}
