import React from 'react';
import AuthModal from './AuthModal';
import Logo from './Logo';

export default function LandingPage({ language, setLanguage, t, setTitle, setShowAuthModal, showAuthModal, handleLogin }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a1a',
      color: 'white',
      position: 'relative'
    }}>
      {/* Language toggle */}
      <button
        onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          padding: '8px 12px',
          background: 'transparent',
          border: '1px solid #484848',
          borderRadius: 6,
          color: '#9ca3af',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        {language === 'fr' ? '\u{1F1EB}\u{1F1F7} FR' : '\u{1F1FA}\u{1F1F8} EN'}
      </button>

      <div style={{
        textAlign: 'center',
        maxWidth: 400,
        padding: 40
      }}>
        {/* Logo centered */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <Logo darkMode={true} />
        </div>

        <p style={{
          fontSize: 14,
          color: '#6b7280',
          marginBottom: 48,
          lineHeight: 1.6
        }}>
          {t('tagline')}
        </p>

        {/* Connexion button */}
        <button
          onClick={() => setShowAuthModal(true)}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: 10,
            color: 'white',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 12,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
          onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
        >
          {t('login')}
        </button>

        {/* Continue without account */}
        <button
          onClick={() => {
            setTitle(t('untitled'));
            window.location.hash = 'local';
          }}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: 'transparent',
            border: '1px solid #484848',
            borderRadius: 10,
            color: '#9ca3af',
            fontSize: 14,
            cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#484848'; e.currentTarget.style.color = '#9ca3af'; }}
        >
          {t('continueWithoutAccount')}
        </button>

        <p style={{
          marginTop: 32,
          fontSize: 12,
          color: '#6b7280'
        }}>
          {t('noAccountWarning')}
        </p>
      </div>

      {showAuthModal && <AuthModal onLogin={handleLogin} onClose={() => setShowAuthModal(false)} t={t} />}
    </div>
  );
}
