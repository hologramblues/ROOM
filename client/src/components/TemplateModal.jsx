import React from 'react';
import { SCRIPT_TEMPLATES } from '../constants/templates';
import { stripHtml } from '../utils/helpers';

export default function TemplateModal({ onSelectTemplate, onClose, darkMode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div
        style={{
          background: darkMode ? '#333333' : 'white',
          borderRadius: 16,
          width: '90%',
          maxWidth: 800,
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: darkMode ? 'white' : 'black', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>Nouveau scénario</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Choisissez une structure ou commencez de zéro</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>&#x2715;</button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {Object.entries(SCRIPT_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => onSelectTemplate(key)}
                style={{
                  padding: 20,
                  background: darkMode ? '#484848' : '#f9fafb',
                  border: `2px solid ${darkMode ? '#555555' : '#e5e7eb'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = darkMode ? '#555555' : '#e5e7eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{template.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: darkMode ? 'white' : 'black', marginBottom: 6 }}>{template.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{template.description}</div>
                {key !== 'empty' && (
                  <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
                    {template.elements.filter(e => e.type === 'scene' && stripHtml(e.content).startsWith('===')).length} sections
                  </div>
                )}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 16, background: darkMode ? '#333333' : '#f3f4f6', borderRadius: 8, border: `1px solid ${darkMode ? '#484848' : '#e5e7eb'}` }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: darkMode ? 'white' : 'black' }}>&#x1F4A1; Conseil</h4>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Les structures sont des guides, pas des règles absolues. Adaptez-les à votre histoire !
              Les scènes marquées === sont des repères de structure que vous pouvez supprimer une fois votre plan établi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
