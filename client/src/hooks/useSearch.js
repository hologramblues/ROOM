import { useState, useEffect, useCallback } from 'react';
import { stripHtml } from '../utils/helpers';

export default function useSearch(elements, elementsRef, updateElement, setActiveIndex) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = [];
    const query = searchQuery.toLowerCase();
    elements.forEach((el, idx) => {
      if (stripHtml(el.content).toLowerCase().includes(query)) {
        results.push({ index: idx, element: el });
      }
    });
    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, elements]);

  const goToSearchResult = useCallback((direction) => {
    if (searchResults.length === 0) return;
    let newIndex = currentSearchIndex + direction;
    if (newIndex < 0) newIndex = searchResults.length - 1;
    if (newIndex >= searchResults.length) newIndex = 0;
    setCurrentSearchIndex(newIndex);
    const result = searchResults[newIndex];
    setActiveIndex(result.index);
    setTimeout(() => {
      const elId = elementsRef.current[result.index]?.id;
      const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [searchResults, currentSearchIndex, elementsRef, setActiveIndex]);

  const replaceOne = useCallback(() => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const result = searchResults[currentSearchIndex];
    const el = elements[result.index];
    const plain = stripHtml(el.content);
    const newContent = plain.replace(new RegExp(searchQuery, 'i'), replaceQuery);
    updateElement(result.index, { ...el, content: newContent });
  }, [searchResults, currentSearchIndex, replaceQuery, searchQuery, elements, updateElement]);

  const replaceAll = useCallback(() => {
    if (searchResults.length === 0 || !replaceQuery) return;
    const regex = new RegExp(searchQuery, 'gi');
    elements.forEach((el, idx) => {
      const plain = stripHtml(el.content);
      if (plain.toLowerCase().includes(searchQuery.toLowerCase())) {
        const newContent = plain.replace(regex, replaceQuery);
        updateElement(idx, { ...el, content: newContent });
      }
    });
    setSearchQuery('');
    setShowSearch(false);
  }, [searchResults, replaceQuery, searchQuery, elements, updateElement]);

  // Navigate to scene from outline
  const navigateToScene = useCallback((index) => {
    setActiveIndex(index);
    setTimeout(() => {
      const elId = elementsRef.current[index]?.id;
      const el = elId ? document.querySelector(`[data-element-id="${elId}"]`) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [elementsRef, setActiveIndex]);

  // Navigate to scene by number
  const navigateToSceneByNumber = useCallback((sceneNumber) => {
    const sceneIndices = elements.map((el, i) => el.type === 'scene' ? i : -1).filter(i => i >= 0);
    if (sceneNumber >= 1 && sceneNumber <= sceneIndices.length) {
      navigateToScene(sceneIndices[sceneNumber - 1]);
    }
  }, [elements, navigateToScene]);

  return {
    showSearch, setShowSearch, searchQuery, setSearchQuery,
    replaceQuery, setReplaceQuery, searchResults, currentSearchIndex,
    goToSearchResult, replaceOne, replaceAll, navigateToScene, navigateToSceneByNumber
  };
}
