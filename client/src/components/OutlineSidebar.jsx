import React, { useState } from 'react';
import { getInitials, stripHtml } from '../utils/helpers';

function OutlineSidebar({
  outline, filteredOutline, currentSceneNumber,
  outlineFilter, setOutlineFilter,
  beatCards, structureBeats, setStructureBeats,
  sceneStatus, setSceneStatus,
  sceneAssignments, setSceneAssignments,
  lockedScenes, setLockedScenes,
  users, collaborators,
  activeIndex, setActiveIndex,
  scriptContainerRef, outlineSidebarRef,
  onDrop, onClose,
  darkMode, t
}) {
  // Internal state (not used elsewhere in App.jsx)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assignmentMenu, setAssignmentMenu] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  return (
    <>
    <div style={{
      width: 300,
      minWidth: 200,
      flexShrink: 1,
      background: darkMode ? '#333333' : 'white',
      borderRight: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          Outline
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, display: 'flex', gap: 6 }}>
        {/* Custom Status Dropdown */}
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: outlineFilter.status ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'),
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
              borderRadius: 6,
              color: darkMode ? '#e5e7eb' : '#484848',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {outlineFilter.status === 'progress' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />}
              {outlineFilter.status === 'done' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />}
              {outlineFilter.status === 'urgent' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />}
              {outlineFilter.status === 'none' && <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />}
              {outlineFilter.status === 'progress' ? t('inProgress') : outlineFilter.status === 'done' ? t('validated') : outlineFilter.status === 'urgent' ? t('urgent') : outlineFilter.status === 'none' ? t('notDefined') : t('status')}
            </span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280"><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
          </button>
          {showStatusDropdown && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowStatusDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: darkMode ? '#333333' : 'white',
                border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 999,
                overflow: 'hidden'
              }}>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, status: '' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {t('allStatuses')}
                </button>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'progress' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                  {t('inProgress')}
                </button>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'done' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  {t('validated')}
                </button>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'urgent' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  {t('urgent')}
                </button>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, status: 'none' })); setShowStatusDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid #6b7280', background: 'transparent' }} />
                  {t('notDefined')}
                </button>
              </div>
            </>
          )}
        </div>
        {/* Custom Assignee Dropdown */}
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: outlineFilter.assignee ? (darkMode ? '#4a4a4a' : '#dbeafe') : (darkMode ? '#484848' : '#f3f4f6'),
              border: `1px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
              borderRadius: 6,
              color: darkMode ? '#e5e7eb' : '#484848',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {outlineFilter.assignee === 'unassigned' ? t('unassigned') : outlineFilter.assignee || t('assigned')}
            </span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="#6b7280" style={{ flexShrink: 0 }}><path d="M3 4.5L6 8l3-3.5H3z"/></svg>
          </button>
          {showAssigneeDropdown && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowAssigneeDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: darkMode ? '#333333' : 'white',
                border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 999,
                overflow: 'hidden',
                maxHeight: 200,
                overflowY: 'auto'
              }}>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: '' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {t('allAssignees')}
                </button>
                <button onClick={() => { setOutlineFilter(f => ({ ...f, assignee: 'unassigned' })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 16, height: 16, borderRadius: 3, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>✕</span>
                  {t('unassigned')}
                </button>
                {(() => {
                  const allUsers = collaborators.map(collab => {
                    const onlineUser = users.find(u => u.name === collab.name);
                    return { ...collab, color: onlineUser?.color || collab.color };
                  });
                  users.forEach(onlineUser => {
                    if (!allUsers.find(c => c.name === onlineUser.name)) {
                      allUsers.push({ name: onlineUser.name, color: onlineUser.color });
                    }
                  });
                  return allUsers;
                })().map(u => {
                  const onlineUser = users.find(online => online.name === u.name);
                  const displayColor = onlineUser?.color || u.color;
                  return (
                  <button key={u.name} onClick={() => { setOutlineFilter(f => ({ ...f, assignee: u.name })); setShowAssigneeDropdown(false); }} style={{ width: '100%', padding: '8px 10px', background: 'transparent', border: 'none', color: darkMode ? '#e5e7eb' : '#484848', fontSize: 11, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: displayColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 'bold' }}>{getInitials(u.name)}</span>
                    {u.name}
                    {onlineUser && (
                      <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    )}
                  </button>
                );})}
              </div>
            </>
          )}
        </div>
      </div>
      {(outlineFilter.status || outlineFilter.assignee) && (
        <div style={{ padding: '4px 12px', background: darkMode ? '#484848' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: darkMode ? '#fbbf24' : '#92400e' }}>
            {filteredOutline.length} scène{filteredOutline.length > 1 ? 's' : ''} filtrée{filteredOutline.length > 1 ? 's' : ''}
          </span>
          <button onClick={() => setOutlineFilter({ status: '', assignee: '' })} style={{ padding: '4px 8px', fontSize: 10, background: '#ef4444', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
      <div ref={outlineSidebarRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filteredOutline.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: 20, fontSize: 13 }}>Aucune scène</p>
        ) : (
          filteredOutline.map((scene, sceneIdx) => {
            const linkedCard = beatCards.find(c => c.linkedSceneId === scene.id);
            const cardColor = linkedCard?.color && linkedCard.color !== '#ffffff' ? linkedCard.color : null;
            const chapterBeat = structureBeats.find(b => b.startSceneId === scene.id);

            return (
            <React.Fragment key={scene.id}>
            {chapterBeat && (
              <div
                style={{
                  padding: '8px 12px',
                  background: chapterBeat.color || (darkMode ? '#4a4a4a' : '#dbeafe'),
                  borderLeft: `3px solid ${chapterBeat.color || '#3b82f6'}`,
                  margin: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: chapterBeat.color ? 'white' : (darkMode ? '#93c5fd' : '#1e40af'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>📁 {chapterBeat.label}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setStructureBeats(prev => prev.filter(b => b.id !== chapterBeat.id)); }}
                  style={{ background: 'none', border: 'none', color: chapterBeat.color ? 'rgba(255,255,255,0.7)' : '#6b7280', cursor: 'pointer', fontSize: 12, padding: 0 }}
                >✕</button>
              </div>
            )}
            <div
              data-outline-element-index={scene.index}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragIndex(sceneIdx);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragIndex !== null && dragIndex !== sceneIdx) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  const dropBefore = e.clientY < midY;
                  setDropTarget({ index: sceneIdx, position: dropBefore ? 'before' : 'after' });
                }
              }}
              onDragLeave={() => {
                setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex === null || !dropTarget) return;

                const targetIdx = dropTarget.index;
                const dropBefore = dropTarget.position === 'before';

                if (dragIndex === targetIdx) { setDragIndex(null); setDropTarget(null); return; }
                if (dropBefore && dragIndex === targetIdx - 1) { setDragIndex(null); setDropTarget(null); return; }
                if (!dropBefore && dragIndex === targetIdx + 1) { setDragIndex(null); setDropTarget(null); return; }

                const draggedSceneObj = filteredOutline[dragIndex];
                const targetSceneObj = filteredOutline[targetIdx];

                if (draggedSceneObj && targetSceneObj) {
                  onDrop(draggedSceneObj, targetSceneObj, dropBefore);
                }

                setDragIndex(null);
                setDropTarget(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(scene.index);
                setTimeout(() => {
                  const script = scriptContainerRef.current;
                  const el = document.querySelector(`[data-element-id="${scene.id}"]`);
                  if (script && el) {
                    const scriptRect = script.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    const targetScroll = script.scrollTop + (elRect.top - scriptRect.top) - 50;
                    script.scrollTop = Math.max(0, targetScroll);
                  }
                }, 50);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const existingBeat = structureBeats.find(b => b.startSceneId === scene.id);
                const chapterName = prompt('Nom du chapitre/acte à insérer avant cette scène:', existingBeat?.label || '');
                if (chapterName !== null) {
                  if (chapterName.trim()) {
                    if (existingBeat) {
                      setStructureBeats(prev => prev.map(b => b.id === existingBeat.id ? { ...b, label: chapterName.trim() } : b));
                    } else {
                      setStructureBeats(prev => [...prev, { id: 'struct_' + Date.now(), label: chapterName.trim(), startSceneId: scene.id, color: null }]);
                    }
                  } else if (existingBeat) {
                    setStructureBeats(prev => prev.filter(b => b.id !== existingBeat.id));
                  }
                }
              }}
              style={{
                padding: '10px 12px',
                paddingLeft: cardColor ? 0 : 12,
                cursor: dragIndex !== null ? 'grabbing' : 'grab',
                background: activeIndex === scene.index
                    ? (darkMode ? '#484848' : '#f3f4f6')
                    : 'transparent',
                borderBottom: `1px solid ${darkMode ? '#484848' : '#f3f4f6'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                opacity: dragIndex === sceneIdx ? 0.5 : 1,
                position: 'relative'
              }}
            >
              {/* Drop indicator line - before */}
              {dropTarget?.index === sceneIdx && dropTarget?.position === 'before' && (
                <div style={{
                  position: 'absolute',
                  top: -1,
                  left: 8,
                  right: 8,
                  height: 2,
                  background: '#3b82f6',
                  borderRadius: 1,
                  boxShadow: '0 0 4px #3b82f6'
                }} />
              )}
              {/* Drop indicator line - after */}
              {dropTarget?.index === sceneIdx && dropTarget?.position === 'after' && (
                <div style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 8,
                  right: 8,
                  height: 2,
                  background: '#3b82f6',
                  borderRadius: 1,
                  boxShadow: '0 0 4px #3b82f6'
                }} />
              )}
              <span style={{
                fontSize: 10,
                color: cardColor ? 'white' : '#6b7280',
                minWidth: cardColor ? 32 : 28,
                textAlign: 'center',
                padding: '4px 0',
                marginRight: 8,
                background: cardColor || 'transparent',
                borderRadius: cardColor ? '0' : 0,
                fontWeight: cardColor ? 600 : 400
              }}>{sceneIdx + 1}</span>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: darkMode ? 'white' : 'black',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{stripHtml(scene.content) || 'Scène vide'}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockedScenes(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(scene.id)) newSet.delete(scene.id);
                      else newSet.add(scene.id);
                      return newSet;
                    });
                  }}
                  style={{
                    background: lockedScenes.has(scene.id) ? 'rgba(239, 68, 68, 0.2)' : 'none',
                    border: 'none',
                    color: lockedScenes.has(scene.id) ? '#ef4444' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '3px 4px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="outline-btn"
                  data-tooltip={lockedScenes.has(scene.id) ? t('unlockScene') : t('lockScene')}
                >
                  {lockedScenes.has(scene.id) ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const statuses = ['', 'progress', 'done', 'urgent'];
                    const currentIdx = statuses.indexOf(sceneStatus[scene.id] || '');
                    setSceneStatus(prev => ({ ...prev, [scene.id]: statuses[(currentIdx + 1) % 4] }));
                  }}
                  style={{
                    minWidth: 22,
                    height: 18,
                    borderRadius: 4,
                    border: !sceneStatus[scene.id] ? '1px dashed #6b7280' : 'none',
                    background: sceneStatus[scene.id] === 'done' ? '#22c55e'
                      : sceneStatus[scene.id] === 'progress' ? '#f59e0b'
                      : sceneStatus[scene.id] === 'urgent' ? '#ef4444'
                      : 'transparent',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="outline-btn"
                  data-tooltip={sceneStatus[scene.id] === 'done' ? t('validated')
                    : sceneStatus[scene.id] === 'progress' ? t('inProgress')
                    : sceneStatus[scene.id] === 'urgent' ? t('urgent')
                    : t('status')}
                >
                  {sceneStatus[scene.id] === 'done' ? '✓'
                    : sceneStatus[scene.id] === 'progress' ? '…'
                    : sceneStatus[scene.id] === 'urgent' ? '!'
                    : ''}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setAssignmentMenu({
                      sceneId: scene.id,
                      x: rect.left,
                      y: rect.bottom + 4
                    });
                  }}
                  style={{
                    minWidth: 22,
                    height: 18,
                    borderRadius: 4,
                    border: sceneAssignments[scene.id] ? 'none' : '1px dashed #6b7280',
                    background: (() => {
                      if (!sceneAssignments[scene.id]) return 'transparent';
                      const assignedName = sceneAssignments[scene.id].userName?.toLowerCase().trim();
                      const onlineUser = users.find(u => u.name?.toLowerCase().trim() === assignedName);
                      return onlineUser?.color || sceneAssignments[scene.id].userColor || '#6b7280';
                    })(),
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: 9,
                    fontWeight: 'bold',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="outline-btn"
                  data-tooltip={sceneAssignments[scene.id] ? `${t('assigned')} ${sceneAssignments[scene.id].userName}` : t('assignTo')}
                >
                  {getInitials(sceneAssignments[scene.id]?.userName) || ''}
                </button>
              </div>
            </div>
            </React.Fragment>
          )})
        )}
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
        <div>{outline.length} {outline.length > 1 ? t('scenes') : t('sceneCount')} • {t('position')}: {currentSceneNumber}/{outline.length}</div>
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{t('rightClickHint')}</div>
      </div>
    </div>

    {/* User Assignment Context Menu */}
    {assignmentMenu && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
        onClick={() => setAssignmentMenu(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: assignmentMenu.x,
            top: assignmentMenu.y,
            background: darkMode ? '#333333' : 'white',
            border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
            borderRadius: 8,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            minWidth: 180,
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
            Assigner à
          </div>
          <button
            onClick={() => {
              setSceneAssignments(prev => {
                const newAssignments = { ...prev };
                delete newAssignments[assignmentMenu.sceneId];
                return newAssignments;
              });
              setAssignmentMenu(null);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
              color: '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: 24, height: 24, borderRadius: 4, border: '1px dashed #6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✕</span>
            <span>Aucun</span>
          </button>
          {(() => {
            const allUsers = collaborators.map(collab => {
              const onlineUser = users.find(u => u.name === collab.name);
              return {
                ...collab,
                color: onlineUser?.color || collab.color
              };
            });
            users.forEach(onlineUser => {
              if (!allUsers.find(c => c.name === onlineUser.name)) {
                allUsers.push({ name: onlineUser.name, color: onlineUser.color });
              }
            });
            return allUsers;
          })().map(user => {
            const onlineUser = users.find(u => u.name === user.name);
            const displayColor = onlineUser?.color || user.color;
            return (
            <button
              key={user.name}
              onClick={() => {
                setSceneAssignments(prev => ({
                  ...prev,
                  [assignmentMenu.sceneId]: {
                    userName: user.name,
                    userColor: displayColor
                  }
                }));
                setAssignmentMenu(null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
                color: darkMode ? 'white' : 'black',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#484848' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = sceneAssignments[assignmentMenu.sceneId]?.userName === user.name ? (darkMode ? '#484848' : '#f3f4f6') : 'transparent'}
            >
              <span style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: displayColor,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 'bold'
              }}>
                {getInitials(user.name)}
              </span>
              <span>{user.name}{user.role === 'owner' ? ' 👑' : ''}</span>
              {onlineUser && (
                <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} title={t('online')} />
              )}
            </button>
          );})}
        </div>
      </div>
    )}
    </>
  );
}

export default React.memo(OutlineSidebar);
