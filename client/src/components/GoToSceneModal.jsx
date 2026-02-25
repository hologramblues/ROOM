import React, { useState, useRef, useEffect } from 'react';

const GoToSceneModal = ({ onClose, onGoTo, maxScene, darkMode }) => {
  const [sceneNum, setSceneNum] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleGo = () => {
    const num = parseInt(sceneNum);
    if (num >= 1 && num <= maxScene) {
      onGoTo(num);
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 300, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Aller à la scène</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="number"
            min="1"
            max={maxScene}
            value={sceneNum}
            onChange={e => setSceneNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGo()}
            placeholder={`1 - ${maxScene}`}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 16 }}
          />
          <button onClick={handleGo} style={{ padding: '10px 16px', background: '#3b82f6', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Go</button>
        </div>
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#6b7280' }}>{maxScene} scène{maxScene > 1 ? 's' : ''} au total</p>
      </div>
    </div>
  );
};

export default GoToSceneModal;
