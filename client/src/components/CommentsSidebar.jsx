import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { SERVER_URL } from '../constants/config';
import InlineComment from './InlineComment';

const CommentsSidebar = ({ comments, suggestions, elements, activeIndex, selectedCommentIndex, elementPositions, scrollContainerRef, scriptScrollHeight, token, docId, canComment, onClose, darkMode, t = (k) => k, onNavigateToElement, onAddComment, pendingInlineComment, onSubmitInlineComment, onCancelInlineComment, pendingSuggestion, onSubmitSuggestion, onCancelSuggestion, onAcceptSuggestion, onRejectSuggestion, selectedCommentId, onSelectComment, selectedSuggestionId, onSelectSuggestion, users, collaborators }) => {
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [, setNewCommentFor] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [inlineCommentText, setInlineCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'comments', 'suggestions'
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inlineCommentInputRef = useRef(null);
  const suggestionInputRef = useRef(null);
  const fallbackRef = useRef(null);
  const sidebarRef = scrollContainerRef || fallbackRef; // Use external ref for scroll sync
  // eslint-disable-next-line no-unused-vars
  const commentRefs = useRef({});
  const prevActiveIndexRef = useRef(activeIndex);

  // Get unique users for mentions (online users + offline collaborators)
  const mentionableUsers = useMemo(() => {
    const allUsers = [];
    const seenNames = new Set();

    // Add online users first (with online indicator)
    if (users) {
      users.filter(u => u.name).forEach(u => {
        if (!seenNames.has(u.name.toLowerCase())) {
          seenNames.add(u.name.toLowerCase());
          allUsers.push({ name: u.name, color: u.color, online: true });
        }
      });
    }

    // Add offline collaborators
    if (collaborators) {
      collaborators.filter(c => c.name).forEach(c => {
        if (!seenNames.has(c.name.toLowerCase())) {
          seenNames.add(c.name.toLowerCase());
          allUsers.push({ name: c.name, color: c.color || '#6b7280', online: false });
        }
      });
    }

    return allUsers;
  }, [users, collaborators]);

  // Filter users based on search
  const filteredMentions = useMemo(() => {
    if (!mentionSearch) return mentionableUsers;
    return mentionableUsers.filter(u =>
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [mentionableUsers, mentionSearch]);

  // Handle @ detection in comment text
  const handleCommentChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInlineCommentText(value);

    // Check if we're typing after @
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionSearch(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  // Insert mention into text
  const insertMention = (userName) => {
    const textarea = inlineCommentInputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inlineCommentText.slice(0, cursorPos);
    const textAfterCursor = inlineCommentText.slice(cursorPos);

    // Find the @ position
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, -atMatch[0].length);
      const newText = beforeAt + '@' + userName + ' ' + textAfterCursor;
      setInlineCommentText(newText);
    }

    setShowMentions(false);
    setMentionSearch('');
    textarea.focus();
  };

  // Deselect comment/suggestion when clicking elsewhere in the script (activeIndex changes)
  useEffect(() => {
    if (activeIndex !== prevActiveIndexRef.current) {
      onSelectComment && onSelectComment(null);
      onSelectSuggestion && onSelectSuggestion(null);
      setReplyTo(null);
      prevActiveIndexRef.current = activeIndex;
    }
  }, [activeIndex, onSelectComment, onSelectSuggestion]);

  // Focus on inline comment input when pending comment appears
  const pendingCommentInitRef = useRef(null);
  useEffect(() => {
    if (pendingInlineComment && pendingInlineComment !== pendingCommentInitRef.current) {
      pendingCommentInitRef.current = pendingInlineComment;
      setInlineCommentText('');
      setTimeout(() => {
        inlineCommentInputRef.current?.focus();
      }, 100);
    } else if (!pendingInlineComment) {
      pendingCommentInitRef.current = null;
    }
  }, [pendingInlineComment]);

  // Focus on suggestion input when pending suggestion appears
  const pendingSuggestionInitRef = useRef(null);
  useEffect(() => {
    if (pendingSuggestion && pendingSuggestion !== pendingSuggestionInitRef.current) {
      pendingSuggestionInitRef.current = pendingSuggestion;
      setSuggestionText(pendingSuggestion.originalText || '');
      setTimeout(() => {
        suggestionInputRef.current?.focus();
        suggestionInputRef.current?.select();
      }, 100);
    } else if (!pendingSuggestion) {
      pendingSuggestionInitRef.current = null;
    }
  }, [pendingSuggestion]);

  const addReply = async (commentId) => {
    console.log('addReply called:', commentId, replyContent);
    if (!replyContent.trim()) return;
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/replies', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ content: replyContent }) });
      console.log('addReply response:', res.status);
      setReplyTo(null); setReplyContent('');
    } catch (err) { console.error('addReply error:', err); }
  };

  const toggleResolve = async (commentId) => {
    console.log('toggleResolve called:', commentId);
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId + '/resolve', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
      console.log('toggleResolve response:', res.status);
    } catch (err) { console.error('toggleResolve error:', err); }
  };

  const deleteComment = async (commentId) => {
    console.log('deleteComment called:', commentId);
    try {
      const res = await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      console.log('deleteComment response:', res.status);
    } catch (err) { console.error('deleteComment error:', err); }
  };

  const editComment = async (commentId, newContent) => {
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments/' + commentId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ content: newContent })
      });
    } catch (err) { console.error(err); }
  };

  // eslint-disable-next-line no-unused-vars
  const submitNewComment = async (elementId) => {
    if (!newCommentText.trim()) return;
    try {
      await fetch(SERVER_URL + '/api/documents/' + docId + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ elementId, content: newCommentText }) });
      setNewCommentFor(null); setNewCommentText('');
    } catch (err) { console.error(err); }
  };

  // Group comments by element index (in document order)
  const commentsByElementIndex = useMemo(() => {
    const map = {};
    comments.filter(c => !c.resolved).forEach(c => {
      const elementIndex = elements.findIndex(el => el.id === c.elementId);
      if (elementIndex >= 0) {
        if (!map[elementIndex]) map[elementIndex] = [];
        map[elementIndex].push(c);
      }
    });
    return map;
  }, [comments, elements]);

  // Get element indices for suggestions - use elementId like comments for consistency when scenes are reordered
  const suggestionsByElementIndex = useMemo(() => {
    const map = {};
    if (suggestions) {
      suggestions.filter(s => s.status === 'pending').forEach(s => {
        // Use elementId to find current index (like comments), not stored elementIndex
        const idx = elements.findIndex(el => el.id === s.elementId);
        if (idx >= 0) {
          if (!map[idx]) map[idx] = [];
          map[idx].push(s);
        }
      });
    }
    return map;
  }, [suggestions, elements]);

  // Get sorted element indices that have comments OR suggestions
  const sortedIndices = useMemo(() => {
    const commentIndices = Object.keys(commentsByElementIndex).map(Number);
    const suggestionIndices = Object.keys(suggestionsByElementIndex).map(Number);
    const allIndices = [...new Set([...commentIndices, ...suggestionIndices])];
    return allIndices.sort((a, b) => a - b);
  }, [commentsByElementIndex, suggestionsByElementIndex]);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const pendingSuggestions = suggestions ? suggestions.filter(s => s.status === 'pending') : [];

  // Detect Safari for performance optimizations
  const isSafariBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  // Track measured heights of each comment card
  const [cardHeights, setCardHeights] = useState({});
  const observersRef = useRef({});

  // Measure card height when rendered and observe for changes
  // On Safari: skip ResizeObserver entirely, use estimated heights
  const measureCard = useCallback((idx, element) => {
    // Clean up old observer
    if (observersRef.current[idx]) {
      observersRef.current[idx].disconnect();
      delete observersRef.current[idx];
    }

    if (element) {
      // Initial measurement
      const height = element.getBoundingClientRect().height;
      setCardHeights(prev => {
        if (prev[idx] !== height) {
          return { ...prev, [idx]: height };
        }
        return prev;
      });

      // On Safari, skip ResizeObserver to avoid performance issues
      if (isSafariBrowser) {
        return;
      }

      // Observe for size changes (e.g., when replies are added) - Chrome/Firefox only
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newHeight = entry.contentRect.height + 20; // Add padding
          setCardHeights(prev => {
            if (prev[idx] !== newHeight) {
              return { ...prev, [idx]: newHeight };
            }
            return prev;
          });
        }
      });
      observer.observe(element);
      observersRef.current[idx] = observer;
    }
  }, [isSafariBrowser]);

  // Cleanup observers on unmount
  useEffect(() => {
    const observers = observersRef.current;
    return () => {
      Object.values(observers).forEach(obs => obs.disconnect());
    };
  }, []);

  // Calculate positions avoiding overlaps using actual measured heights
  // Reset offset if next comment is far away (more than ~2 pages)
  const adjustedPositions = useMemo(() => {
    const positions = {};
    const GAP = 15; // Gap between cards
    const RESET_THRESHOLD = 2000; // ~2 pages - if gap is larger, reset positioning
    let lastBottom = 0;

    sortedIndices.forEach(idx => {
      const idealTop = elementPositions[idx] || (idx * 30);

      // If this comment is far from the last one, reset the cascade
      // This prevents a few close comments from pushing ALL subsequent comments down
      if (idealTop - lastBottom > RESET_THRESHOLD) {
        lastBottom = 0; // Reset - this comment starts fresh at its ideal position
      }

      // Ensure this comment doesn't overlap with previous (within the same group)
      const actualTop = Math.max(idealTop, lastBottom);
      positions[idx] = actualTop;

      // Use measured height or estimate
      const cardHeight = cardHeights[idx] || 150;
      lastBottom = actualTop + cardHeight + GAP;
    });

    return positions;
  }, [sortedIndices, elementPositions, cardHeights]);

  // maxContentHeight removed — scroll sync now handled by useElementPositions rAF transforms

  // Navigation functions
  // Get filtered indices based on current filter
  const filteredSortedIndices = useMemo(() => {
    if (filter === 'all') return sortedIndices;
    if (filter === 'comments') {
      return Object.keys(commentsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    if (filter === 'suggestions') {
      return Object.keys(suggestionsByElementIndex).map(Number).sort((a, b) => a - b);
    }
    return sortedIndices;
  }, [filter, sortedIndices, commentsByElementIndex, suggestionsByElementIndex]);

  const navigateToComment = (direction) => {
    if (filteredSortedIndices.length === 0) return;

    // Find current position in filteredSortedIndices based on activeIndex
    const currentPos = filteredSortedIndices.findIndex(idx => idx >= activeIndex);
    let targetPos;

    if (direction === 'next') {
      targetPos = currentPos === -1 ? 0 : Math.min(currentPos + 1, filteredSortedIndices.length - 1);
    } else {
      targetPos = currentPos <= 0 ? 0 : currentPos - 1;
    }

    const targetIdx = filteredSortedIndices[targetPos];
    if (targetIdx !== undefined && onNavigateToElement) {
      onNavigateToElement(targetIdx);
    }
  };

  return (
    <div
      className="comments-sidebar"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: darkMode ? '#333333' : '#f8f9fa',
        overflow: 'hidden'
      }}
      onClick={() => { onSelectComment && onSelectComment(null); onSelectSuggestion && onSelectSuggestion(null); }}
    >
      {/* Header with navigation and filters */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Comment filter button */}
          <button
            onClick={() => setFilter(f => f === 'comments' ? 'all' : 'comments')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: filter === 'comments' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
              border: `1px solid ${filter === 'comments' ? '#1a73e8' : (darkMode ? '#555555' : '#d1d5db')}`,
              borderRadius: 4,
              color: filter === 'comments' ? '#1a73e8' : (darkMode ? 'white' : '#202124'),
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: filter === 'comments' ? 600 : 400
            }}
            title={t('filterComments')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {unresolvedComments.length}
          </button>

          {/* Suggestion filter button */}
          {pendingSuggestions.length > 0 && (
            <button
              onClick={() => setFilter(f => f === 'suggestions' ? 'all' : 'suggestions')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: filter === 'suggestions' || filter === 'all' ? (darkMode ? '#484848' : '#e5e7eb') : 'transparent',
                border: `1px solid ${filter === 'suggestions' ? '#10b981' : (darkMode ? '#555555' : '#d1d5db')}`,
                borderRadius: 4,
                color: filter === 'suggestions' ? '#10b981' : (darkMode ? 'white' : '#202124'),
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === 'suggestions' ? 600 : 400
              }}
              title={t('filterSuggestions')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
              {pendingSuggestions.length}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Navigation arrows */}
          <button
            onClick={() => navigateToComment('prev')}
            disabled={filteredSortedIndices.length === 0}
            style={{
              background: 'none',
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'),
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? t('previousSuggestion') : t('previousComment')}
          >
            ↑
          </button>
          <button
            onClick={() => navigateToComment('next')}
            disabled={filteredSortedIndices.length === 0}
            style={{
              background: 'none',
              border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
              borderRadius: 4,
              color: filteredSortedIndices.length === 0 ? '#6b7280' : (darkMode ? '#d1d5db' : '#484848'),
              cursor: filteredSortedIndices.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              padding: '4px 8px',
              lineHeight: 1
            }}
            title={filter === 'suggestions' ? t('nextSuggestion') : t('nextComment')}
          >
            ↓
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 8 }}>✕</button>
        </div>
      </div>

      {/* Content area - allow scrolling */}
      <div
        ref={sidebarRef}
        className="comments-sidebar-scroll-container"
        style={{
          flex: 1,
          overflow: 'clip', /* Clip without creating scroll container — cards positioned by transforms */
          position: 'relative',
          padding: '0 12px'
        }}
      >
        <div>

          {/* Pending inline comment form - Google Docs style */}
          {pendingInlineComment && (() => {
            const pendingIdx = pendingInlineComment.elementIndex;
            // Find if there are existing comments for this element
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;

            if (existingCommentsForElement) {
              // Position after the existing comment card
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              // No existing comments - position at element level
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }

            return (
              <div data-comment-element-index={pendingIdx} style={{
                position: 'absolute',
                top: 0,
                left: 8,
                right: 8,
                transform: `translateY(${pendingTop}px)`,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Highlighted text banner */}
                <div style={{
                  background: 'rgba(251, 191, 36, 0.2)',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#fbbf24'}`,
                  fontSize: 12,
                  color: darkMode ? '#fbbf24' : '#92400e',
                  fontStyle: 'italic'
                }}>
                  "{pendingInlineComment.text.slice(0, 60)}{pendingInlineComment.text.length > 60 ? '...' : ''}"
                </div>

                <div style={{ padding: 12, position: 'relative' }}>
                  <textarea
                    ref={inlineCommentInputRef}
                    value={inlineCommentText}
                    onChange={handleCommentChange}
                    placeholder="Ajouter un commentaire... (@mention)"
                    onKeyDown={(e) => {
                      // Handle mention navigation
                      if (showMentions && filteredMentions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setMentionIndex(i => Math.max(i - 1, 0));
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          insertMention(filteredMentions[mentionIndex].name);
                          return;
                        }
                        if (e.key === 'Escape') {
                          setShowMentions(false);
                          return;
                        }
                      }

                      if (e.key === 'Enter' && !e.shiftKey && inlineCommentText.trim() && !showMentions) {
                        e.preventDefault();
                        e.stopPropagation();
                        onSubmitInlineComment(inlineCommentText);
                        setInlineCommentText('');
                      }
                      if (e.key === 'Escape' && !showMentions) {
                        e.stopPropagation();
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: 10,
                      border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                      borderRadius: 6,
                      fontSize: 13,
                      resize: 'none',
                      minHeight: 60,
                      background: darkMode ? '#333333' : '#f9fafb',
                      color: darkMode ? 'white' : '#484848',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Mentions dropdown */}
                  {showMentions && filteredMentions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 12,
                      right: 12,
                      marginBottom: -8,
                      background: darkMode ? '#484848' : 'white',
                      border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: 150,
                      overflow: 'auto',
                      zIndex: 10
                    }}>
                      {filteredMentions.map((user, idx) => (
                        <div
                          key={user.name}
                          onClick={() => insertMention(user.name)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            background: idx === mentionIndex ? (darkMode ? '#555555' : '#f3f4f6') : 'transparent'
                          }}
                          onMouseEnter={() => setMentionIndex(idx)}
                        >
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: user.color || '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 'bold',
                            position: 'relative'
                          }}>
                            {user.name.charAt(0).toUpperCase()}
                            {/* Online indicator */}
                            <span style={{
                              position: 'absolute',
                              bottom: -1,
                              right: -1,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: user.online ? '#22c55e' : '#6b7280',
                              border: `2px solid ${darkMode ? '#484848' : 'white'}`
                            }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, color: darkMode ? 'white' : '#484848' }}>
                              {user.name}
                            </span>
                            {!user.online && (
                              <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                                (hors ligne)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelInlineComment();
                        setInlineCommentText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => {
                        if (inlineCommentText.trim()) {
                          onSubmitInlineComment(inlineCommentText);
                          setInlineCommentText('');
                        }
                      }}
                      disabled={!inlineCommentText.trim()}
                      style={{
                        padding: '8px 16px',
                        background: inlineCommentText.trim() ? '#1a73e8' : '#d1d5db',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: inlineCommentText.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 500
                      }}
                    >
                      Commenter
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pending suggestion form */}
          {pendingSuggestion && (() => {
            const pendingIdx = pendingSuggestion.elementIndex;
            const existingCommentsForElement = sortedIndices.includes(pendingIdx);
            let pendingTop;

            if (existingCommentsForElement) {
              const cardTop = adjustedPositions[pendingIdx] || elementPositions[pendingIdx] || (pendingIdx * 30);
              const cardHeight = cardHeights[pendingIdx] || 100;
              pendingTop = cardTop + cardHeight + 10;
            } else {
              pendingTop = elementPositions[pendingIdx] || (pendingIdx * 30);
            }

            return (
              <div data-comment-element-index={pendingIdx} style={{
                position: 'absolute',
                top: 0,
                left: 8,
                right: 8,
                transform: `translateY(${pendingTop}px)`,
                background: darkMode ? '#484848' : 'white',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                border: `2px solid #10b981`,
                zIndex: 10,
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${darkMode ? '#555555' : '#10b981'}`,
                  fontSize: 12,
                  color: '#10b981',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                  Proposer une modification
                </div>

                <div style={{ padding: 12 }}>
                  {/* Original text (strikethrough) */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Texte original :</span>
                    <div style={{
                      textDecoration: 'line-through',
                      color: '#ef4444',
                      fontSize: 13,
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginTop: 4
                    }}>
                      {pendingSuggestion.originalText}
                    </div>
                  </div>

                  {/* Suggested text input */}
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{t('replaceBy')}</span>
                    <textarea
                      ref={suggestionInputRef}
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder={t('typeSuggestion')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSubmitSuggestion(suggestionText);
                          setSuggestionText('');
                        }
                        if (e.key === 'Escape') {
                          onCancelSuggestion();
                          setSuggestionText('');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: 10,
                        border: `2px solid #10b981`,
                        borderRadius: 6,
                        fontSize: 13,
                        resize: 'none',
                        minHeight: 50,
                        background: darkMode ? '#333333' : '#f0fdf4',
                        color: darkMode ? '#6ee7b7' : '#166534',
                        boxSizing: 'border-box',
                        marginTop: 4
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        onCancelSuggestion();
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'transparent',
                        color: darkMode ? '#9ca3af' : '#5f6368',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      onClick={() => {
                        onSubmitSuggestion(suggestionText);
                        setSuggestionText('');
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      Suggérer
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {sortedIndices.length === 0 && !pendingInlineComment && !pendingSuggestion ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 12 }}>{t('noCommentsOrSuggestions')}</p>
          ) : sortedIndices.length > 0 ? (
            sortedIndices.map((idx, arrayIndex) => {
              const elementComments = commentsByElementIndex[idx] || [];
              const topPosition = adjustedPositions[idx] || 0;

              return (
                <div
                  key={idx}
                  data-comment-element-index={idx}
                  ref={(el) => measureCard(idx, el)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 8,
                    right: 8,
                    transform: `translateY(${topPosition}px)`
                  }}
                >
                  {/* Comments for this element */}
                  {(filter === 'all' || filter === 'comments') && elementComments.map(c => {
                    const cId = String(c.id || c._id);
                    const isThisCommentSelected = String(selectedCommentId) === cId || (selectedCommentIndex === idx && elementComments.length === 1);
                    return (
                      <div
                        key={cId}
                        data-comment-id={cId}
                        data-comment-card-id={cId}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComment && onSelectComment(isThisCommentSelected ? null : cId);
                          if (!isThisCommentSelected) {
                            onNavigateToElement && onNavigateToElement(idx);
                          }
                        }}
                      >
                        <InlineComment
                          comment={{...c, id: cId}}
                          onReply={id => { setReplyTo(replyTo === id ? null : id); setReplyContent(''); }}
                          onResolve={toggleResolve}
                          onDelete={deleteComment}
                          onEdit={editComment}
                          canComment={canComment}
                          isReplying={replyTo === cId}
                          replyContent={replyTo === cId ? replyContent : ''}
                          onReplyChange={setReplyContent}
                          onSubmitReply={addReply}
                          onCancelReply={() => { setReplyTo(null); setReplyContent(''); }}
                          darkMode={darkMode}
                          isSelected={isThisCommentSelected}
                          mentionableUsers={mentionableUsers}
                          t={t}
                        />
                      </div>
                    );
                  })}

                  {/* Suggestions for this element */}
                  {(filter === 'all' || filter === 'suggestions') && suggestions && suggestions
                    .filter(s => s.elementIndex === idx && s.status === 'pending')
                    .map(s => {
                      const sId = String(s.id || s._id);
                      const isSelected = String(selectedSuggestionId) === sId;
                      const timeAgo = s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';

                      return (
                        <div
                          key={sId}
                          data-suggestion-id={sId}
                          data-suggestion-card-id={sId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSuggestion && onSelectSuggestion(isSelected ? null : sId);
                            // Navigate to the element in the script
                            if (!isSelected && onNavigateToElement) {
                              onNavigateToElement(s.elementIndex);
                            }
                          }}
                          style={{
                            background: darkMode ? '#333333' : '#f0fdf4',
                            borderRadius: 8,
                            padding: isSelected ? 12 : 10,
                            marginBottom: 6,
                            boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            borderLeft: '3px solid #10b981'
                          }}
                        >
                          {/* Header - always visible */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: s.userColor || '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: 10,
                              flexShrink: 0
                            }}>
                              {s.userName?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: darkMode ? 'white' : '#333333', fontWeight: 600, fontSize: 12 }}>{s.userName}</span>
                                <span style={{ color: '#6b7280', fontSize: 11 }}>{timeAgo}</span>
                              </div>
                              {/* Compact view - one line description */}
                              {!isSelected && (
                                <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#555555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <strong>{t('replaceLabel')}</strong> <span style={{ fontStyle: 'italic' }}>"{s.originalText.substring(0, 20)}{s.originalText.length > 20 ? '...' : ''}"</span> {t('by')} <span style={{ fontStyle: 'italic' }}>"{s.suggestedText.substring(0, 20)}{s.suggestedText.length > 20 ? '...' : ''}"</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded view */}
                          {isSelected && (
                            <>
                              <div style={{ fontSize: 13, margin: '12px 0' }}>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{t('replaceLabel')}</div>
                                <div style={{
                                  textDecoration: 'line-through',
                                  color: '#dc2626',
                                  marginBottom: 6,
                                  fontSize: 13
                                }}>
                                  "{s.originalText}"
                                </div>
                                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>Par :</div>
                                <div style={{
                                  color: '#16a34a',
                                  fontWeight: 500,
                                  fontSize: 13
                                }}>
                                  "{s.suggestedText}"
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRejectSuggestion && onRejectSuggestion(sId); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'transparent',
                                    border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`,
                                    borderRadius: 4,
                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                    fontSize: 12,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {t('reject')}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onAcceptSuggestion && onAcceptSuggestion(sId); }}
                                  style={{
                                    padding: '6px 12px',
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: 'white',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    fontWeight: 500
                                  }}
                                >
                                  ✓ {t('accept')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              );
            })
          ) : null}

          {/* Spacer removed — comment positions are now managed by useElementPositions rAF transforms */}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CommentsSidebar);
