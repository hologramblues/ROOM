# ROOMS — Collaborative Screenplay Editor

## Quick Reference

```bash
# Build client (MUST use craco, not react-scripts — roughjs/excalidraw need craco config)
cd client && npx craco build

# Dev mode
cd client && npx craco start

# Electron desktop
npm run electron:dev

# Note: npm/npx path on this machine is /usr/local/bin/npm (not in default PATH)
```

## Architecture

```
ROOMS/
  client/                   # React 19 SPA (CRA + Craco)
    src/
      App.jsx               # ~12,600 lines — monolithic main component (see section below)
      App.css               # Screenplay element styles, editor styles
      index.css             # Global styles
    craco.config.js         # Webpack overrides for roughjs/excalidraw
    package.json            # Key deps: react 19, @tiptap/*, @excalidraw/excalidraw, socket.io-client

  server/                   # Production server (V9)
    server.js               # Express + Socket.io + Mongoose (~1,076 lines)
    models.js               # MongoDB schemas (User, Document, HistoryEntry)
    auth.js                 # JWT auth middleware

  electron/                 # Desktop app variant
    main.js                 # Electron entry point
    local-server.js         # Embedded Socket.io server (uses better-sqlite3 instead of MongoDB)
    local-models.js         # SQLite-backed models
    database.js             # SQLite initialization
    menu.js                 # Native menu
    preload.js              # IPC bridge

  server.js                 # Legacy V8 server (DEPRECATED — use server/server.js)
```

## App.jsx Structure (~12,600 lines)

This is a single monolithic file. Key sections in order:

| Lines | Section |
|-------|---------|
| 1-20 | Imports (React, TipTap, ProseMirror, Excalidraw) |
| 22-540 | Desktop detection, translations (FR/EN) |
| 541-613 | TipTap marks: `CommentMark`, `SuggestionMark` |
| 615-892 | `ScreenplayElement` node (TipTap): attributes, renderHTML, commands (`splitScreenplayElement`, `cycleType`, `setScreenplayType`, `handleScreenplayBackspace`) |
| 894-935 | Helper functions: `buildDocFromElements`, `extractElementsFromDoc`, `elementsEqual` |
| 937-1007 | `createPageBreakPlugin` — ProseMirror plugin for page break decorations |
| 1009-1070 | `createSceneLockPlugin` — ProseMirror plugin blocking edits in locked scenes |
| 1072-1126 | Constants: element type maps, `LINES_PER_PAGE = 63` |
| 1128-3600 | Auth modal, chat sidebar, history panel, share panel, comments sidebar, other UI components |
| 3616-4100 | **`SingleEditor`** — React.memo TipTap editor component |
| 4100-5200 | BeatBoard component (Excalidraw-based scene cards + timeline) |
| 5200-6350 | More UI components |
| 6350-6500 | **Main `App` component** — state declarations (~150 state variables + refs) |
| 6500-9300 | Effects, socket handlers, callbacks, computed values |
| 9300-9550 | Page background useEffect, desktop IPC, landing page |
| 9550-10340 | Header bar, menus (Document, Tools), dropdowns |
| 10340-11170 | Main content area: outline sidebar, script editor, comments sidebar |
| 11170-11500 | Floating action box, context menus |
| 11500-12600 | Modals (stats, timer, shortcuts, templates, go-to-scene, etc.) |

## Key Patterns

### Refs mirror state
State variables that are read in intervals, timers, or socket handlers have a corresponding ref to avoid stale closures:
```js
const [elements, setElements] = useState([]);
const elementsRef = useRef(elements);
elementsRef.current = elements; // sync on every render
```
Refs are synced at lines ~6350-6400. Always use refs in `setInterval`, `setTimeout`, and socket event handlers.

### Functional state updaters
Use `setState(prev => ...)` pattern to avoid depending on stale state:
```js
setUndoStack(prev => [...prev, snapshot]);
```

### isStale flag for socket cleanup
When switching documents, socket handlers from the old document might still fire. The `isStale` flag prevents them from applying:
```js
useEffect(() => {
  let isStale = false;
  socket.on('event', data => { if (isStale) return; /* ... */ });
  return () => { isStale = true; };
}, [docId]);
```

### Single TipTap editor (V272)
The entire screenplay is one ProseMirror document with `screenplayElement` nodes. Each node has `elementType` (scene/action/character/dialogue/parenthetical/transition) and `elementId` attributes. Page breaks are decorations, not real nodes.

## Page Rendering

### Page break calculation
`computePageInfo()` at line ~7526 estimates where page breaks should occur:
- `LINES_PER_PAGE = 63` (calibrated for A4: 297mm - 28mm margins = 269mm content)
- `getLines()` uses **type-specific chars-per-line**: scene/action=58, dialogue=34, parenthetical=24, character=20
- Accounts for `line-height: 1.1` on action/dialogue elements
- Orphan protection: scene headings and character names don't strand at page bottom

### Page backgrounds
`useEffect` at line ~9243 creates per-page white rectangles:
- Uses `offsetTop` chain (NOT `getBoundingClientRect`) for zoom-agnostic positioning
- `MutationObserver` + `ResizeObserver` keep backgrounds in sync
- Watches `style` attribute changes to catch zoom updates
- Each page = absolute-positioned div with background + box-shadow inside a `page-bg-container`

### CSS zoom
The script wrapper uses `zoom: scriptZoom` (0.5 to 2.0). Important: all position calculations inside the wrapper must use the internal coordinate system (offsetTop), not viewport coordinates (getBoundingClientRect), to avoid precision issues.

## Screenplay Element CSS (App.css)

```css
/* Base: 12pt Courier, line-height: 1 */
/* Scene:        100% width, margin-top: 2em, margin-bottom: 0.5em, bold, uppercase */
/* Action:       100% width, margin-top: 1em, line-height: 1.1 */
/* Character:    35% width, margin-left: 33%, margin-top: 1em, uppercase */
/* Dialogue:     58% width, margin-left: 17%, line-height: 1.1 */
/* Parenthetical: 42% width, margin-left: 25%, italic */
/* Transition:   100% width, margin-top: 1em, right-aligned, uppercase */
```

## Tab Behavior (Final Draft)
- In dialogue/parenthetical: Tab toggles between dialogue and parenthetical only
- Other types: Tab cycles through the full ring (scene > action > character > parenthetical > dialogue > transition)
- Enter from dialogue: creates new character element
- Enter on empty element: converts to action (or deletes if already action)

## Scene Locking
- `lockedScenes` state = `Set<elementId>` of locked scene heading IDs
- Lock toggled in outline sidebar
- Enforced via `createSceneLockPlugin` (`filterTransaction`) — blocks any transaction touching nodes in a locked scene
- Visual feedback: locked elements get `opacity: 0.55` via decorations

## Zoom Footer
- Full-width bar at bottom, same style as header (`#333333` dark / `white` light)
- Slider right-aligned, range 50%-200%
- Persisted to `localStorage` key `rooms-script-zoom`
- Only visible in script view (hidden in beat board)

## Known Issues (Server — Not Yet Fixed)
- Race conditions on socket write handlers (findOne -> modify -> save pattern)
- Suggestion accept can corrupt content
- Health endpoint missing try/catch
- CSV injection possible in exports
- Documents created with public editor access by default
- Socket auth allows unauthenticated connections
- 100MB `maxHttpBufferSize` in index.js
- No rate limiting
- Hardcoded JWT fallback secret in auth.js

## Version History (Milestones)
- **V272 Stable** (current) — Single TipTap editor, accurate A4 pagination, scene locking, zoom slider, per-page backgrounds
- **V271** — Multi-wrapper page rendering (replaced by V272 single-wrapper approach)
- **V237** — CSS content-visibility smooth scroll, multi-editor approach (replaced by V272)
- **V2** — FDX import, history, comments, PDF export, document list
- **V1** — Initial collaborative editor
