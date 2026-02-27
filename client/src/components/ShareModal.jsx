import React, { useState } from 'react';
import { IS_DESKTOP } from '../constants/config';
import SyncConfirmModal from './SyncConfirmModal';

export default function ShareModal({
  shareLink, isOwner, publicAccessState, togglePublicAccess, changePublicRole, onClose, darkMode, language,
  // Cloud sync props (desktop)
  cloudShortId, cloudSyncedAt, cloudToken, syncing,
  onPushToCloud, onPullFromCloud, onCloudLogin,
  // Sync confirm state (managed by App)
  showSyncConfirm, setShowSyncConfirm,
}) {
  const [copied, setCopied] = useState(false);
  const t = (k) => {
    const fr = {
      cloudAuthRequired: 'Connectez-vous au cloud pour partager',
      cloudConnection: 'Connexion Cloud',
      publishToCloud: 'Publier en ligne',
      syncInProgress: 'Synchronisation...',
      cloudLinkLabel: 'Lien de partage cloud :',
      pushToCloudBtn: '↑ Envoyer vers le cloud',
      pullFromCloudBtn: '↓ Récupérer du cloud',
      lastSynced: 'Sync',
      pushWarning: 'La version en ligne sera remplacée par votre version locale.',
      pullWarning: 'Votre version locale sera remplacée par la version en ligne.',
      cancel: 'Annuler',
      confirm: 'Confirmer',
    };
    const en = {
      cloudAuthRequired: 'Sign in to cloud to share',
      cloudConnection: 'Cloud Sign In',
      publishToCloud: 'Publish online',
      syncInProgress: 'Syncing...',
      cloudLinkLabel: 'Cloud share link:',
      pushToCloudBtn: '↑ Push to cloud',
      pullFromCloudBtn: '↓ Pull from cloud',
      lastSynced: 'Sync',
      pushWarning: 'The online version will be replaced by your local version.',
      pullWarning: 'Your local version will be replaced by the online version.',
      cancel: 'Cancel',
      confirm: 'Confirm',
    };
    return (language === 'en' ? en[k] : fr[k]) || k;
  };

  const effectiveCloudLink = cloudShortId ? `https://room-production-19a5.up.railway.app/#${cloudShortId}` : null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9999 }} />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: darkMode ? '#2b2b2b' : 'white',
        borderRadius: 12,
        padding: 24,
        width: 440,
        maxWidth: '90vw',
        zIndex: 10000,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: darkMode ? 'white' : '#1a1a1a' }}>
            {language === 'fr' ? 'Partager' : 'Share'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: 18 }}>&times;</button>
        </div>

        {/* DESKTOP MODE — Cloud sync flow */}
        {IS_DESKTOP ? (
          <div>
            {!cloudToken ? (
              /* Not logged in to cloud */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 12 }}>
                  {t('cloudAuthRequired')}
                </p>
                <button
                  onClick={onCloudLogin}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {t('cloudConnection')}
                </button>
              </div>
            ) : !cloudShortId ? (
              /* Logged in but not published */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 12, color: darkMode ? '#d1d5db' : '#374151', marginBottom: 12 }}>
                  {language === 'fr' ? 'Ce document est uniquement local.' : 'This document is local only.'}
                </p>
                <button
                  onClick={onPushToCloud}
                  disabled={syncing}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600,
                    cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1,
                  }}
                >
                  {syncing ? t('syncInProgress') : t('publishToCloud')}
                </button>
              </div>
            ) : (
              /* Published — show link + sync controls */
              <div>
                <p style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 8 }}>
                  {t('cloudLinkLabel')}
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    type="text"
                    readOnly
                    value={effectiveCloudLink}
                    onClick={e => e.target.select()}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a',
                      fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(effectiveCloudLink)}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? (language === 'fr' ? 'Copié !' : 'Copied!') : (language === 'fr' ? 'Copier' : 'Copy')}
                  </button>
                </div>

                {/* Sync buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setShowSyncConfirm('push')}
                    disabled={syncing}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: 12,
                      fontWeight: 600, cursor: syncing ? 'wait' : 'pointer',
                      opacity: syncing ? 0.7 : 1,
                    }}
                  >
                    {syncing ? t('syncInProgress') : t('pushToCloudBtn')}
                  </button>
                  <button
                    onClick={() => setShowSyncConfirm('pull')}
                    disabled={syncing}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: 'transparent',
                      color: darkMode ? '#d1d5db' : '#374151',
                      fontSize: 12, fontWeight: 600,
                      cursor: syncing ? 'wait' : 'pointer',
                      opacity: syncing ? 0.7 : 1,
                    }}
                  >
                    {syncing ? t('syncInProgress') : t('pullFromCloudBtn')}
                  </button>
                </div>

                {cloudSyncedAt && (
                  <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
                    {t('lastSynced')}: {new Date(cloudSyncedAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* WEB MODE — Original flow */
          <div>
            {/* Public access toggle */}
            {isOwner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div
                  onClick={() => togglePublicAccess(!publicAccessState.enabled)}
                  style={{
                    width: 38, height: 20, borderRadius: 10, cursor: 'pointer',
                    background: publicAccessState.enabled ? '#22c55e' : (darkMode ? '#4b5563' : '#d1d5db'),
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                    position: 'absolute', top: 2, left: publicAccessState.enabled ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: darkMode ? '#d1d5db' : '#374151' }}>
                  {language === 'fr' ? 'Lien actif' : 'Link active'}
                </span>
                {publicAccessState.enabled && (
                  <select
                    value={publicAccessState.role}
                    onChange={(e) => changePublicRole(e.target.value)}
                    style={{
                      marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, fontSize: 11,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a', cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="viewer">{language === 'fr' ? 'Lecture seule' : 'View only'}</option>
                    <option value="commenter">{language === 'fr' ? 'Commentaire' : 'Comment'}</option>
                    <option value="editor">{language === 'fr' ? 'Éditeur' : 'Editor'}</option>
                  </select>
                )}
              </div>
            )}

            {publicAccessState.enabled ? (
              <>
                <p style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: 12 }}>
                  {language === 'fr' ? 'Toute personne ayant ce lien peut accéder au document :' : 'Anyone with this link can access the document:'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    onClick={e => e.target.select()}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${darkMode ? '#484848' : '#d1d5db'}`,
                      background: darkMode ? '#1a1a1a' : '#f9fafb',
                      color: darkMode ? '#e0e0e0' : '#1a1a1a',
                      fontSize: 12, fontFamily: 'monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(shareLink)}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? (language === 'fr' ? 'Copié !' : 'Copied!') : (language === 'fr' ? 'Copier' : 'Copy')}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: darkMode ? '#6b7280' : '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                {language === 'fr' ? 'Activez le lien pour partager ce document.' : 'Enable the link to share this document.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sync confirmation modal */}
      {showSyncConfirm && (
        <SyncConfirmModal
          mode={showSyncConfirm}
          cloudSyncedAt={cloudSyncedAt}
          onConfirm={() => {
            if (showSyncConfirm === 'push') onPushToCloud();
            else onPullFromCloud();
            setShowSyncConfirm(null);
          }}
          onCancel={() => setShowSyncConfirm(null)}
          darkMode={darkMode}
          t={t}
        />
      )}
    </>
  );
}
