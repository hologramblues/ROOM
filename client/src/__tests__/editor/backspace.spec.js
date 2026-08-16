/**
 * AUDIT.md §8.1 — editor typing state machine, cases E12–E14 (Backspace at the
 * start of an element).
 *
 * Under test: `handleScreenplayBackspace` in
 * `extensions/ScreenplayElement.js:185-244`.
 *
 * E13 is `test.skip`-ed: it encodes the Final Draft rule that ROOMS does not
 * implement yet (AUDIT.md finding 4.21). It is written as the *correct*
 * expectation on purpose — un-skipping it is the definition of "4.21 is fixed".
 * See `./README.md`.
 */

import {
  createEditor,
  destroyAllEditors,
  describeDoc,
  elementTexts,
  cursor,
  setCursor,
  pressBackspace,
} from '../../test-utils/screenplayEditor';

// `handleScreenplayBackspace` ships half a dozen `console.log` calls (a debug
// aid left in production code). They would bury the suite output; silence just
// `log`, so a real `console.error`/`warn` still surfaces.
let logSpy;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
  destroyAllEditors();
});

describe('§8.1 E12 — Backspace at the start of an empty element', () => {
  test('E12: the empty Action is removed and the caret lands at the end of the previous element', () => {
    const PREV = 'Marie entre.';
    const editor = createEditor([
      { type: 'action', text: PREV },
      { type: 'action' },
    ]);
    setCursor(editor, 1, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: PREV }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: PREV.length });
  });

  test('E12: the element *before* the caret is never touched', () => {
    const editor = createEditor([
      { type: 'scene', text: 'INT. CAFÉ - JOUR' },
      { type: 'action', text: 'Marie entre.' },
      { type: 'action' },
    ]);
    setCursor(editor, 2, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'scene', text: 'INT. CAFÉ - JOUR' },
      { type: 'action', text: 'Marie entre.' },
    ]);
  });

  test('E12 (previous empty): Backspace removes a stray blank element above the caret', () => {
    const editor = createEditor([
      { type: 'action' },
      { type: 'action', text: 'Bonjour.' },
    ]);
    setCursor(editor, 1, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: 'Bonjour.' }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: 0 });
  });
});

describe('§8.1 E13 — Backspace at the start of a non-empty element', () => {
  // EXPECTED FAIL — AUDIT.md finding 4.21 (MED), spec case §8.1 E13.
  // Today `handleScreenplayBackspace` falls through to the merge branch
  // (ScreenplayElement.js:226-243) and glues "MARIE" onto the previous Action,
  // destroying the character cue. Final Draft demotes the element to Action and
  // keeps the text on its own line; a second Backspace then merges.
  // Un-skip when the Phase 5 fix ("Fix Backspace-at-start-of-non-empty
  // semantics — demote instead of merge", AUDIT.md §7 step 2) lands.
  test.skip('E13: Backspace at the start of a non-empty Character demotes it to Action', () => {
    const editor = createEditor([
      { type: 'action', text: 'Marie entre.' },
      { type: 'character', text: 'MARIE' },
    ]);
    setCursor(editor, 1, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: 'Marie entre.' },
      { type: 'action', text: 'MARIE' },
    ]);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  // EXPECTED FAIL — same family as finding 4.21, for the *empty* case.
  // REFERENCES.md §1.5: "Backspace on an empty element: converts the current
  // element back to Action; if already Action, merges with the previous
  // element." ROOMS deletes the empty element outright instead
  // (ScreenplayElement.js:210-217), so a writer who Tabs to Character, changes
  // their mind and hits Backspace loses the line rather than getting an Action.
  // (The empty-*Action* case in E12 above is unaffected: "merge an empty node
  // into the previous one" and "delete it, caret to the end of the previous"
  // are the same outcome, which is why E12 passes today.)
  // Un-skip together with E13.
  test.skip('E13 (empty): Backspace on an empty Character demotes it to Action instead of deleting it', () => {
    const editor = createEditor([
      { type: 'action', text: 'Marie entre.' },
      { type: 'character' },
    ]);
    setCursor(editor, 1, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: 'Marie entre.' },
      { type: 'action', text: '' },
    ]);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  test('E13 (same type): two adjacent Actions still merge — demotion must not break this', () => {
    const editor = createEditor([
      { type: 'action', text: 'Bonjour' },
      { type: 'action', text: 'Marie' },
    ]);
    setCursor(editor, 1, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: 'BonjourMarie' }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: 'Bonjour'.length });
  });
});

describe('§8.1 E14 — Backspace at the very start of the document', () => {
  test('E14: Backspace in the first element at offset 0 is a no-op', () => {
    const editor = createEditor([
      { type: 'scene', text: 'INT. CAFÉ - JOUR' },
      { type: 'action', text: 'Marie entre.' },
    ]);
    setCursor(editor, 0, 0);
    const before = describeDoc(editor);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual(before);
    expect(cursor(editor)).toEqual({ index: 0, offset: 0 });
  });

  test('E14: Backspace in a document with a single empty element is a no-op', () => {
    const editor = createEditor([{ type: 'action' }]);
    setCursor(editor, 0, 0);

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: '' }]);
  });

  test('E14: the key is swallowed, so the browser cannot navigate back', () => {
    const editor = createEditor([{ type: 'action', text: 'Marie entre.' }]);
    setCursor(editor, 0, 0);

    expect(pressBackspace(editor)).toBe(true);
  });
});

// Not enumerated in AUDIT §8.1. `handleScreenplayBackspace` bails out with
// `false` unless the caret is collapsed at offset 0; if that guard ever
// inverted, ordinary character deletion would break everywhere at once.
describe('§8.1 (supplementary) — Backspace away from the start of an element', () => {
  // Deleting one character with a collapsed caret is done natively by the
  // browser's contenteditable, not by a ProseMirror command — jsdom does not
  // implement that, so the observable behaviour here is the *hand-off*: the
  // screenplay handler must decline the key so the default can run. If the
  // `parentOffset !== 0` guard ever inverted, this returns true and ordinary
  // typing-and-deleting breaks everywhere at once. Real character deletion is
  // an E2E concern (AUDIT §8 Playwright layer).
  test('Backspace mid-text is NOT swallowed by the screenplay handler', () => {
    const editor = createEditor([{ type: 'action', text: 'Hello' }]);
    setCursor(editor, 0, 'end');

    expect(pressBackspace(editor)).toBe(false);
    expect(elementTexts(editor)).toEqual(['Hello']);
  });

  test('Backspace with a selection deletes the selection, not the element', () => {
    const editor = createEditor([{ type: 'action', text: 'Bonjour Marie' }]);
    editor.commands.setTextSelection({ from: 1, to: 1 + 'Bonjour '.length });

    pressBackspace(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: 'Marie' }]);
  });
});
