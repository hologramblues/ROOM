import React, { useState } from 'react';

const WritingGoalsModal = ({ goal, onUpdate, onClose, currentWords, darkMode }) => {
  const [dailyGoal, setDailyGoal] = useState(goal.daily);
  const progress = Math.min(100, Math.round((goal.todayWords / goal.daily) * 100));

  const handleSave = () => {
    onUpdate({ ...goal, daily: parseInt(dailyGoal) || 1000 });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }} onClick={onClose}>
      <div style={{ background: darkMode ? '#333333' : 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>Objectif d'écriture</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: darkMode ? 'white' : 'black' }}>Aujourd'hui</span>
            <span style={{ fontSize: 14, color: progress >= 100 ? '#22c55e' : '#6b7280' }}>{goal.todayWords} / {goal.daily} mots</span>
          </div>
          <div style={{ height: 8, background: darkMode ? '#484848' : '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#22c55e' : '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: progress >= 100 ? '#22c55e' : '#6b7280', textAlign: 'center' }}>
            {progress >= 100 ? '🎉 Objectif atteint !' : `${progress}% - ${goal.daily - goal.todayWords} mots restants`}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#6b7280' }}>Objectif quotidien (mots)</label>
          <input
            type="number"
            min="100"
            step="100"
            value={dailyGoal}
            onChange={e => setDailyGoal(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: `1px solid ${darkMode ? '#555555' : '#d1d5db'}`, background: darkMode ? '#484848' : 'white', color: darkMode ? 'white' : 'black', fontSize: 14 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[500, 1000, 1500, 2000].map(preset => (
            <button
              key={preset}
              onClick={() => setDailyGoal(preset)}
              style={{ flex: 1, padding: '8px', background: Number(dailyGoal) === preset ? '#3b82f6' : (darkMode ? '#484848' : '#f3f4f6'), border: 'none', borderRadius: 6, color: Number(dailyGoal) === preset ? 'white' : (darkMode ? 'white' : 'black'), cursor: 'pointer', fontSize: 12 }}
            >
              {preset}
            </button>
          ))}
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: '12px', background: '#22c55e', border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>
          Enregistrer
        </button>
      </div>
    </div>
  );
};

export default WritingGoalsModal;
