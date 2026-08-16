# ROOMS — E2E layer (Playwright)

Browser-driven specs. This is the only layer that can cover **multi-tab
collaboration**, since those scenarios need two real browser contexts sharing one
Yjs WebSocket server — something jsdom cannot simulate.

## One-time setup: install browsers

`npm install` here does **not** download browser binaries (each is ~150 MB). Run
this once before un-skipping any spec:

```bash
cd e2e
npm install
npm run install:browsers   # playwright install chromium
```

> On the current dev machine a Playwright browser cache already exists at
> `~/Library/Caches/ms-playwright`, so this may complete instantly or be a no-op.
> On a fresh machine or in CI it is a real download.

## Running

```bash
cd e2e
npm test          # headless
npm run test:ui   # interactive UI mode
npm run report    # open the last HTML report
```

The single spec in `smoke.spec.js` is `test.skip`, so `npm test` currently
reports `1 skipped` and exits 0 without needing browsers at all.

## Running the app under test

`webServer` is **commented out** in `playwright.config.js` on purpose: booting
`server/server.js` requires MongoDB (it connects at module scope, and the Yjs
persistence provider needs it too). Enabling it would break `playwright test` on
any machine without a database — even for skipped specs.

Until a database fixture exists, start the stack by hand:

```bash
cd server && npm start           # :3001
cd client && npx craco start     # :3000
```

Then point the suite at it (defaults to `http://localhost:3000`):

```bash
E2E_BASE_URL=http://localhost:3000 npm test
```

## What belongs here

From `AUDIT.md` §8 — the specs that require real browsers:

| Group | Specs |
|-------|-------|
| §8.4 Collab, 2-tab | C1, C2, C3, C4, C7 |
| §8.5 Offline / reconnect | O1–O4 |
| §8.6 Cross-document state leak | C5, C6 |
| §8.3 Collab undo | E21 |
| §8.9 Format | F4 (PDF page count) |
| §8.11 Comments + suggestions | CO1, CO2, CO4, CO5 |

Everything else belongs in the faster client or server layers — see
[`../TESTING.md`](../TESTING.md).
