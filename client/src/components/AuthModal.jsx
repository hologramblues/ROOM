import React, { useState } from 'react';
import { SERVER_URL } from '../constants/config';

const AuthModal = ({ onLogin, onClose, t = (k) => k, targetServer }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const authUrl = targetServer || SERVER_URL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const name = mode === 'register' ? `${firstName} ${lastName}`.trim() : '';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(authUrl + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      if (!targetServer) {
        localStorage.setItem('screenplay-token', data.token);
        localStorage.setItem('screenplay-user', JSON.stringify(data.user));
      }
      onLogin(data.user, data.token);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#2b2b2b',
    border: '1px solid #484848',
    borderRadius: 8,
    color: 'white',
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#333333', borderRadius: 12, padding: 32, width: 'calc(100% - 32px)', maxWidth: 380, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid #484848' }}>
        <h2 style={{ color: 'white', fontSize: 22, marginBottom: 24, textAlign: 'center', fontWeight: 600 }}>
          {targetServer ? (t('cloudConnection') || 'Cloud') : (mode === 'login' ? t('connection') : t('registration'))}
        </h2>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <input
                type="text"
                placeholder={t('name')}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required
              />
              <input
                type="text"
                placeholder={t('name')}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#484848'}
                required
              />
            </div>
          )}
          <input
            type="email"
            placeholder={t('email')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required
          />
          <input
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16 }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#484848'}
            required
          />
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 14,
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? t('loading') : mode === 'login' ? t('signIn') : t('register')}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          {mode === 'login' ? t('noAccount') : t('alreadyAccount')}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ marginLeft: 8, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            {mode === 'login' ? t('createOne') : t('signIn')}
          </button>
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: 12,
            background: 'transparent',
            border: '1px solid #484848',
            borderRadius: 8,
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
