import React from 'react';

export default function SyncConfirmModal({ mode, cloudSyncedAt, onConfirm, onCancel, darkMode, t }) {
  const isPush = mode === 'push';

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: darkMode ? '#2b2b2b' : 'white', borderRadius: 12, padding: 24,
        width: 380, maxWidth: '90vw', zIndex: 10002,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
      }}>
        <h3 style={{ color: darkMode ? 'white' : '#1a1a1a', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          {isPush ? t('pushToCloudBtn') : t('pullFromCloudBtn')}
        </h3>
        <p style={{ color: darkMode ? '#d1d5db' : '#374151', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          {isPush ? t('pushWarning') : t('pullWarning')}
        </p>
        {cloudSyncedAt && (
          <p style={{ color: '#6b7280', fontSize: 11, marginBottom: 16 }}>
            {t('lastSynced')}: {new Date(cloudSyncedAt).toLocaleString('fr-FR')}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
              background: 'transparent', color: darkMode ? '#d1d5db' : '#374151',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: isPush ? '#3b82f6' : '#ef4444', color: 'white',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </>
  );
}
