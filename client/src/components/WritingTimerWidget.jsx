import React from 'react';
import { formatTime } from '../utils/helpers';

function WritingTimerWidget({
  timerPosition, timerCompact, setTimerCompact,
  timerSeconds, timerRunning, setTimerRunning, timerMode, setTimerMode,
  sprintDuration, sprintTimeLeft, setSprintTimeLeft,
  sessionWordCount, resetTimer, setSprintMinutes,
  writingGoal, setWritingGoal,
  onMouseDown, onClose,
  darkMode
}) {
  return timerCompact ? (
    /* COMPACT MODE */
    <div style={{
      position: 'fixed',
      left: timerPosition.x,
      top: timerPosition.y,
      background: darkMode ? '#333333' : 'white',
      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      zIndex: 200,
      overflow: 'hidden'
    }}>
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'grab',
          background: darkMode ? '#484848' : '#f3f4f6'
        }}
        onMouseDown={onMouseDown}
      >
        {/* Time display */}
        <span style={{
          fontSize: 18,
          fontWeight: 'bold',
          fontFamily: 'monospace',
          color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'),
          minWidth: 60
        }}>
          {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
        </span>

        {/* Play/Pause */}
        <button
          onClick={() => setTimerRunning(!timerRunning)}
          style={{
            width: 28, height: 28,
            background: timerRunning ? '#ef4444' : '#22c55e',
            border: 'none',
            borderRadius: 6,
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {timerRunning ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={resetTimer}
          style={{
            width: 28, height: 28,
            background: darkMode ? '#555555' : '#e5e7eb',
            border: 'none',
            borderRadius: 6,
            color: darkMode ? 'white' : '#484848',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>

        {/* Expand */}
        <button
          onClick={() => setTimerCompact(false)}
          style={{
            width: 28, height: 28,
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Agrandir"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 12,
            marginLeft: -4
          }}
        >
          ✕
        </button>
      </div>
    </div>
  ) : (
    /* EXPANDED MODE */
    <div style={{
      position: 'fixed',
      left: timerPosition.x,
      top: timerPosition.y,
      background: darkMode ? '#333333' : 'white',
      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
      borderRadius: 12,
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      zIndex: 200,
      minWidth: 220,
      overflow: 'hidden'
    }}>
      {/* Timer Header - DRAGGABLE */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'grab',
          background: darkMode ? '#484848' : '#f3f4f6'
        }}
        onMouseDown={onMouseDown}
      >
        <span style={{ fontSize: 12, color: darkMode ? 'white' : '#484848', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Timer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setTimerCompact(true)}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}
            title="Réduire"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 6, padding: 3 }}>
          <button
            onClick={() => { setTimerMode('chrono'); if (!timerRunning) resetTimer(); }}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: timerMode === 'chrono' ? (darkMode ? '#333333' : 'white') : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: timerMode === 'chrono' ? (darkMode ? 'white' : 'black') : '#6b7280',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: timerMode === 'chrono' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Chrono
          </button>
          <button
            onClick={() => { setTimerMode('sprint'); if (!timerRunning) { resetTimer(); setSprintTimeLeft(sprintDuration); } }}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: timerMode === 'sprint' ? (darkMode ? '#333333' : 'white') : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: timerMode === 'sprint' ? (darkMode ? 'white' : 'black') : '#6b7280',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: timerMode === 'sprint' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Sprint
          </button>
        </div>

        {/* Timer display */}
        <div style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', color: timerMode === 'sprint' && sprintTimeLeft < 60 ? '#ef4444' : (darkMode ? 'white' : 'black'), marginBottom: 8 }}>
          {timerMode === 'chrono' ? formatTime(timerSeconds) : formatTime(sprintTimeLeft)}
        </div>

        {/* Sprint duration selector */}
        {timerMode === 'sprint' && !timerRunning && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
            {[15, 25, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => setSprintMinutes(mins)}
                style={{
                  padding: '4px 8px',
                  background: sprintDuration === mins * 60 ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'),
                  border: 'none',
                  borderRadius: 4,
                  color: sprintDuration === mins * 60 ? 'white' : (darkMode ? '#d1d5db' : '#484848'),
                  cursor: 'pointer',
                  fontSize: 10
                }}
              >
                {mins}m
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          <button
            onClick={() => setTimerRunning(!timerRunning)}
            style={{
              padding: '8px 16px',
              background: timerRunning ? '#ef4444' : '#22c55e',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {timerRunning ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start</>
            )}
          </button>
          <button
            onClick={resetTimer}
            style={{
              padding: '8px 12px',
              background: darkMode ? '#484848' : '#e5e7eb',
              border: 'none',
              borderRadius: 6,
              color: darkMode ? 'white' : 'black',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          </button>
        </div>
        <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, fontSize: 12, color: '#6b7280' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Mots cette session</span>
            <span style={{ color: sessionWordCount > 0 ? '#22c55e' : (darkMode ? 'white' : 'black'), fontWeight: 500 }}>+{sessionWordCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mots/heure</span>
            <span style={{ color: darkMode ? 'white' : 'black' }}>{timerSeconds > 60 ? Math.round(sessionWordCount / (timerSeconds / 3600)) : '—'}</span>
          </div>
        </div>

        {/* Daily Goal Section */}
        <div style={{ borderTop: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`, paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif du jour</span>
            <span style={{ fontSize: 11, color: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : (darkMode ? 'white' : '#484848') }}>
              {writingGoal.todayWords} / {writingGoal.daily}
            </span>
          </div>
          <div style={{ height: 6, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round((writingGoal.todayWords / writingGoal.daily) * 100))}%`,
              background: writingGoal.todayWords >= writingGoal.daily ? '#22c55e' : '#3b82f6',
              borderRadius: 3,
              transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[500, 1000, 1500, 2000].map(preset => (
              <button
                key={preset}
                onClick={() => setWritingGoal(g => ({ ...g, daily: preset }))}
                style={{
                  flex: 1,
                  padding: '4px',
                  background: writingGoal.daily === preset ? '#3b82f6' : (darkMode ? '#484848' : '#e5e7eb'),
                  border: 'none',
                  borderRadius: 4,
                  color: writingGoal.daily === preset ? 'white' : (darkMode ? '#9ca3af' : '#6b7280'),
                  cursor: 'pointer',
                  fontSize: 9
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(WritingTimerWidget);
