// electron/cloud-auth.js — Secure cloud credential storage via Electron safeStorage
const { safeStorage } = require('electron');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const CRED_FILE = 'cloud-credentials.enc';
const PLAIN_FILE = 'cloud-credentials.json';

function getCredPath() {
  const userDataPath = app.getPath('userData');
  const canEncrypt = safeStorage.isEncryptionAvailable();
  return path.join(userDataPath, canEncrypt ? CRED_FILE : PLAIN_FILE);
}

function saveCloudCredentials(token, user) {
  const data = JSON.stringify({ token, user });
  const filePath = getCredPath();
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(data);
    fs.writeFileSync(filePath, encrypted);
  } else {
    fs.writeFileSync(filePath, data, 'utf-8');
  }
}

function getCloudCredentials() {
  const canEncrypt = safeStorage.isEncryptionAvailable();
  const filePath = path.join(app.getPath('userData'), canEncrypt ? CRED_FILE : PLAIN_FILE);
  if (!fs.existsSync(filePath)) return null;
  try {
    if (canEncrypt) {
      const encrypted = fs.readFileSync(filePath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    } else {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[CLOUD-AUTH] Failed to read credentials:', err.message);
    return null;
  }
}

function clearCloudCredentials() {
  const userDataPath = app.getPath('userData');
  for (const file of [CRED_FILE, PLAIN_FILE]) {
    const filePath = path.join(userDataPath, file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

module.exports = { saveCloudCredentials, getCloudCredentials, clearCloudCredentials };
