import React, { useMemo } from 'react';
import { stripHtml } from '../utils/helpers';

const StatsPanel = ({ stats, elements, onClose, darkMode }) => {
  const characters = useMemo(() => {
    const counts = {};
    elements.forEach(el => {
      const t = stripHtml(el.content).trim();
      if (el.type === 'character' && t) {
        const name = t.replace(/\s*\(.*?\)\s*/g, '').toUpperCase();
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [elements]);

  const locations = useMemo(() => {
    const counts = { INT: 0, EXT: 0 };
    elements.forEach(el => {
      const t = stripHtml(el.content);
      if (el.type === 'scene' && t) {
        if (t.match(/^INT[.\s]/i)) counts.INT++;
        else if (t.match(/^EXT[.\s]/i)) counts.EXT++;
      }
    });
    return counts;
  }, [elements]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 450, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Statistiques</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.words}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Mots</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.scenes}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Scènes</div>
          </div>
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{characters.length}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Personnages</div>
          </div>
        </div>

        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Estimations</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>~{stats.screenTimeMin} min</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Durée à l'écran</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{stats.dialogueRatio}%</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Dialogues</div>
            </div>
          </div>
        </div>

        <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black' }}>📍 Lieux</h4>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.INT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>INT.</span>
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>{locations.EXT}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>EXT.</span>
            </div>
          </div>
          {(locations.INT + locations.EXT > 0) && (
            <div style={{ marginTop: 10, height: 6, background: darkMode ? '#555555' : '#d1d5db', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(locations.INT / (locations.INT + locations.EXT)) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
            </div>
          )}
        </div>

        {characters.length > 0 && (
          <div style={{ background: darkMode ? '#484848' : '#f3f4f6', padding: 16, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Top personnages</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {characters.slice(0, 5).map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: darkMode ? 'white' : 'black' }}>{name}</span>
                  <span style={{ color: '#6b7280' }}>{count} répliques</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
