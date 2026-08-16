/**
 * Headless TipTap harness for the screenplay typing state machine.
 *
 * Why headless: the specs in `src/__tests__/editor/` exercise the *state
 * machine* (`extensions/ScreenplayElement.js` + `constants/elementTypes.js`),
 * not React. Mounting `SingleEditor` would drag in Yjs, a websocket provider,
 * the page-break plugin, the scene-lock plugin and a dozen callbacks — all of
 * which can break for reasons that have nothing to do with Enter/Tab/Backspace.
 * A bare `Editor` isolates the thing under test.
 *
 * What is faithful to production:
 *   - the real `ScreenplayElement` extension (node, schema, commands, keymap);
 *   - the same `StarterKit.configure({...})` options `SingleEditor.jsx` passes
 *     in its non-Yjs branch (`history: !ydoc` → `history: true` here);
 *   - key presses are dispatched as real `keydown` events on the ProseMirror
 *     DOM, so `addKeyboardShortcuts()` and prosemirror-keymap are covered too,
 *     not just the commands they delegate to.
 *
 * What is deliberately NOT included (and why it is safe to omit here):
 *   - `Collaboration` / `CollaborationCaret` — need a Y.Doc and a provider;
 *     collab behaviour is covered by the Playwright layer (AUDIT §8.4).
 *   - `CommentMark` / `SuggestionMark` / `ExternalSpanMark` — marks only; they
 *     cannot influence block-level Enter/Tab/Backspace routing.
 *   - `pageBreakPlugin` / `sceneLockPlugin` — decoration/`filterTransaction`
 *     plugins driven by refs owned by `App.jsx`. With no locked scenes they are
 *     no-ops; they have their own specs (AUDIT §8.10).
 *
 * This file lives OUTSIDE `__tests__/` on purpose: CRA's first `testMatch`
 * pattern (`src/**​/__tests__/**​/*.js`) treats *every* file in a `__tests__`
 * directory as a suite, so a helper placed there would fail with
 * "Your test suite must contain at least one test."
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import ScreenplayElement from '../extensions/ScreenplayElement';

const liveEditors = new Set();

/**
 * Build the ProseMirror JSON for a screenplay document.
 *
 * @param {Array<{type: string, text?: string, id?: string}|[string, string?]>} elements
 */
export function buildDoc(elements) {
  return {
    type: 'doc',
    content: elements.map((raw, i) => {
      const el = Array.isArray(raw) ? { type: raw[0], text: raw[1] } : raw;
      const node = {
        type: 'screenplayElement',
        attrs: {
          elementId: el.id || `el-${i}`,
          elementType: el.type,
        },
      };
      if (el.text) node.content = [{ type: 'text', text: el.text }];
      return node;
    }),
  };
}

/**
 * Create a headless screenplay editor. Registered for teardown by
 * `destroyAllEditors()` — call that from an `afterEach`.
 */
export function createEditor(elements = [{ type: 'action' }]) {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      // Mirrors SingleEditor.jsx's StarterKit.configure() call verbatim.
      StarterKit.configure({
        paragraph: false,
        listItem: false,
        history: true, // SingleEditor passes `!ydoc`; there is no ydoc here.
        hardBreak: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      ScreenplayElement,
    ],
    content: buildDoc(elements),
  });
  liveEditors.add(editor);
  return editor;
}

export function destroyAllEditors() {
  liveEditors.forEach(editor => {
    if (!editor.isDestroyed) editor.destroy();
  });
  liveEditors.clear();
}

// ---------------------------------------------------------------- inspection

/** `[{ type, text }, ...]` — the whole document, in order. */
export function describeDoc(editor) {
  const out = [];
  editor.state.doc.forEach(node => {
    out.push({ type: node.attrs.elementType, text: node.textContent });
  });
  return out;
}

/** Just the element types, in order. Handy for one-line assertions. */
export function elementTypes(editor) {
  return describeDoc(editor).map(el => el.type);
}

/** Just the text content, in order. */
export function elementTexts(editor) {
  return describeDoc(editor).map(el => el.text);
}

/** The `elementId` attribute of each node, in order. */
export function elementIds(editor) {
  const out = [];
  editor.state.doc.forEach(node => out.push(node.attrs.elementId));
  return out;
}

/** Where the caret is, expressed as `{ index, offset }` in document terms. */
export function cursor(editor) {
  const { $from } = editor.state.selection;
  return { index: $from.index(0), offset: $from.parentOffset };
}

// ------------------------------------------------------------------- driving

/** Absolute ProseMirror position of the start of `index`'s *content*. */
function contentStart(editor, index) {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += editor.state.doc.child(i).nodeSize;
  return pos + 1;
}

/**
 * Put the caret inside element `index` at `offset`.
 * `offset` may be the string `'end'`.
 */
export function setCursor(editor, index, offset = 0) {
  const node = editor.state.doc.child(index);
  const resolved = offset === 'end' ? node.content.size : offset;
  editor.commands.setTextSelection(contentStart(editor, index) + resolved);
  return editor;
}

/** Type text at the caret, the way a keystroke would. */
export function typeText(editor, text) {
  editor.view.dispatch(editor.state.tr.insertText(text));
  return editor;
}

/**
 * Dispatch a real `keydown` on the ProseMirror DOM so the extension's
 * `addKeyboardShortcuts()` map is exercised, not just the command behind it.
 *
 * @returns {boolean} whether a handler consumed the key (`preventDefault`).
 */
export function press(editor, key, { shift = false, mod = false, alt = false } = {}) {
  // prosemirror-keymap resolves `Mod-` to Cmd on macOS and Ctrl elsewhere, and
  // builds the lookup name from *every* modifier flag on the event — setting
  // both ctrlKey and metaKey would produce "Meta-Ctrl-5" and match nothing.
  // Mirror its own platform test so `Mod-` bindings resolve identically.
  const isMac = /Mac|iP(hone|[oa]d)/.test(
    (typeof navigator !== 'undefined' && navigator.platform) || ''
  );
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    shiftKey: shift,
    ctrlKey: mod && !isMac,
    metaKey: mod && isMac,
    altKey: alt,
  });
  editor.view.dom.dispatchEvent(event);
  return event.defaultPrevented;
}

export const pressEnter = editor => press(editor, 'Enter');
export const pressTab = editor => press(editor, 'Tab');
export const pressShiftTab = editor => press(editor, 'Tab', { shift: true });
export const pressBackspace = editor => press(editor, 'Backspace');
