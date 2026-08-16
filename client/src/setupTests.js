// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom as shipped with jest-environment-jsdom 27 (CRA 5) exposes no global
// `crypto`, so production code that legitimately calls `crypto.randomUUID()` —
// e.g. `extensions/ScreenplayElement.js` when it mints an elementId — throws
// `ReferenceError: crypto is not defined` in tests only. Every browser ROOMS
// targets has it. Bridge the gap in the test environment rather than weakening
// the production code.
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line global-require
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto;
}
