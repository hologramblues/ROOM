import { useState, useEffect, useRef } from 'react';
import { stripHtml } from '../utils/helpers';
import { PAGE_FORMATS } from '../constants/elementTypes';

export default function useStats(elements, characters, elementsRef, pageFormat = 'us-letter') {
  // Stats calculation - deferred to avoid blocking Enter key
  const [stats, setStats] = useState({ words: 0, chars: 0, scenes: 0, dialogueWords: 0, actionWords: 0, dialogueRatio: 0, readingTimeMin: 0, screenTimeMin: 0 });
  const statsTimerRef = useRef(null);
  useEffect(() => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    statsTimerRef.current = setTimeout(() => {
      const allText = elementsRef.current.map(el => stripHtml(el.content)).join(' ');
      const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;
      const chars = allText.length;
      const scenes = elementsRef.current.filter(el => el.type === 'scene').length;
      const dialogueWords = elementsRef.current
        .filter(el => el.type === 'dialogue')
        .map(el => stripHtml(el.content).trim().split(/\s+/).length)
        .reduce((a, b) => a + b, 0);
      const actionWords = elementsRef.current
        .filter(el => el.type === 'action')
        .map(el => stripHtml(el.content).trim().split(/\s+/).length)
        .reduce((a, b) => a + b, 0);
      const dialogueRatio = words > 0 ? Math.round((dialogueWords / words) * 100) : 0;
      const readingTimeMin = Math.ceil(words / 200);
      const screenTimeMin = Math.round(words / 150);
      const { totalPages } = computePageInfo(elementsRef.current);
      setStats({ words, chars, scenes, dialogueWords, actionWords, dialogueRatio, readingTimeMin, screenTimeMin, pageCount: totalPages });
    }, 300);
    return () => { if (statsTimerRef.current) clearTimeout(statsTimerRef.current); };
  }, [elements, elementsRef]);

  // Compute page break positions and page numbers for each element
  const computePageInfo = (els) => {
    const pageBreaks = new Set();
    const pageNumbers = {};
    let currentPage = 1;
    let h = 0;
    const getLines = el => {
      // Chars per line from page format preset
      const fmt = PAGE_FORMATS[pageFormat] || PAGE_FORMATS['us-letter'];
      const c = fmt.cpl[el.type] || 60;
      const l = el.content ? Math.ceil(stripHtml(el.content).length / c) : 1;
      // Extra lines for spacing (margin-top in em units)
      const e = { scene: 2, action: 1, character: 1, dialogue: 0, parenthetical: 0, transition: 1 };
      return l + (e[el.type] || 0);
    };
    const pageElements = [];
    els.forEach((el, idx) => {
      const lines = getLines(el);
      const LINES_PER_PAGE = (PAGE_FORMATS[pageFormat] || PAGE_FORMATS['us-letter']).linesPerPage;
      if (h + lines > LINES_PER_PAGE && pageElements.length > 0) {
        let orphanCount = 0;
        const last = pageElements[pageElements.length - 1];
        if (last && last.type === 'scene') orphanCount = 1;
        else if (last && last.type === 'character') orphanCount = 1;
        else if (last && last.type === 'parenthetical' && pageElements.length >= 2 && pageElements[pageElements.length - 2]?.type === 'character') orphanCount = 2;
        const orphanStartIdx = idx - orphanCount;
        currentPage++;
        const breakIdx = orphanCount > 0 ? orphanStartIdx : idx;
        pageBreaks.add(breakIdx);
        h = 0;
        pageElements.length = 0;
        for (let i = breakIdx; i < idx; i++) {
          h += getLines(els[i]);
          pageElements.push(els[i]);
          pageNumbers[i] = currentPage;
        }
      }
      pageElements.push(el);
      pageNumbers[idx] = currentPage;
      h += lines;
    });
    return { pageBreaks, pageNumbers, totalPages: currentPage };
  };

  // Deferred: only used for autocomplete dropdown, not rendering
  const [extractedCharacters, setExtractedCharacters] = useState(() => { const c = new Set(characters); elements.forEach(el => { const t = stripHtml(el.content).trim(); if (el.type === 'character' && t) c.add(t.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); }); return Array.from(c).sort(); });
  const extractedCharsTimerRef = useRef(null);
  useEffect(() => {
    if (extractedCharsTimerRef.current) clearTimeout(extractedCharsTimerRef.current);
    extractedCharsTimerRef.current = setTimeout(() => {
      const c = new Set(characters);
      elementsRef.current.forEach(el => { const t = stripHtml(el.content).trim(); if (el.type === 'character' && t) c.add(t.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase()); });
      setExtractedCharacters(Array.from(c).sort());
    }, 300);
    return () => { if (extractedCharsTimerRef.current) clearTimeout(extractedCharsTimerRef.current); };
  }, [elements, characters, elementsRef]);

  // Outline - deferred to avoid blocking Enter key
  const [outline, setOutline] = useState([]);
  const outlineTimerRef = useRef(null);
  useEffect(() => {
    if (outlineTimerRef.current) clearTimeout(outlineTimerRef.current);
    outlineTimerRef.current = setTimeout(() => {
      const els = elementsRef.current;
      const scenes = [];
      let sceneNumber = 0;
      const sceneIndices = [];
      els.forEach((el, idx) => { if (el.type === 'scene') sceneIndices.push(idx); });
      els.forEach((el, idx) => {
        if (el.type === 'scene') {
          sceneNumber++;
          const sceneIdx = sceneIndices.indexOf(idx);
          const nextSceneIdx = sceneIndices[sceneIdx + 1] || els.length;
          let wordCount = 0;
          const sceneCharacters = new Set();
          for (let i = idx; i < nextSceneIdx; i++) {
            const content = stripHtml(els[i]?.content) || '';
            wordCount += content.trim().split(/\s+/).filter(w => w).length;
            if (els[i]?.type === 'character') sceneCharacters.add(content.toUpperCase());
          }
          scenes.push({ index: idx, number: sceneNumber, content: stripHtml(el.content) || '(sans titre)', id: el.id, wordCount, characters: [...sceneCharacters] });
        }
      });
      setOutline(scenes);
    }, 300);
    return () => { if (outlineTimerRef.current) clearTimeout(outlineTimerRef.current); };
  }, [elements, elementsRef]);

  // Locations and character stats - deferred to avoid blocking Enter key
  const [extractedLocations, setExtractedLocations] = useState([]);
  const [characterStats, setCharacterStats] = useState([]);
  const locsStatsTimerRef = useRef(null);
  useEffect(() => {
    if (locsStatsTimerRef.current) clearTimeout(locsStatsTimerRef.current);
    locsStatsTimerRef.current = setTimeout(() => {
      const els = elementsRef.current;
      // Locations
      const locs = new Set();
      els.forEach(el => {
        const t = stripHtml(el.content);
        if (el.type === 'scene' && t) {
          const match = t.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s*(.+?)(?:\s*-\s*(?:JOUR|NUIT|MATIN|SOIR|AUBE|CRÉPUSCULE|CONTINUOUS|LATER|SAME))?$/i);
          if (match && match[1]) locs.add(match[1].trim().toUpperCase());
        }
      });
      setExtractedLocations(Array.from(locs).sort());
      // Character stats
      const cStats = {};
      let currentScene = 0;
      els.forEach((el, idx) => {
        if (el.type === 'scene') currentScene++;
        if (el.type === 'character' && stripHtml(el.content).trim()) {
          const name = stripHtml(el.content).trim().replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
          if (!cStats[name]) cStats[name] = { name, lines: 0, firstAppearance: currentScene || 1, firstIndex: idx, scenes: new Set() };
          cStats[name].lines++;
          if (currentScene > 0) cStats[name].scenes.add(currentScene);
        }
      });
      Object.values(cStats).forEach(s => { s.sceneCount = s.scenes.size; delete s.scenes; });
      setCharacterStats(Object.values(cStats).sort((a, b) => b.lines - a.lines));
    }, 300);
    return () => { if (locsStatsTimerRef.current) clearTimeout(locsStatsTimerRef.current); };
  }, [elements, elementsRef]);

  return { stats, extractedCharacters, extractedLocations, characterStats, outline, computePageInfo };
}
