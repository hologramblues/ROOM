/**
 * AUDIT.md §8.1 — editor typing state machine, cases E8–E10 (Tab / Shift-Tab).
 *
 * Under test: `cycleType` in `extensions/ScreenplayElement.js`, driven by
 * `SP_TAB_FWD` / `SP_TAB_REV` in `constants/elementTypes.js`, plus the Final
 * Draft rule that Tab inside Dialogue/Parenthetical toggles *only* those two
 * (CLAUDE.md "Tab Behavior (Final Draft)", REFERENCES.md §1.5).
 */

import {
  createEditor,
  destroyAllEditors,
  elementTypes,
  elementTexts,
  setCursor,
  pressTab,
  pressShiftTab,
} from '../../test-utils/screenplayEditor';

afterEach(destroyAllEditors);

describe('§8.1 E8 — Tab out of an Action', () => {
  test('E8: Tab in an Action cycles the type to Character and leaves the text alone', () => {
    const editor = createEditor([{ type: 'action', text: 'MARIE' }]);
    setCursor(editor, 0, 'end');

    const handled = pressTab(editor);

    expect(handled).toBe(true);
    expect(elementTypes(editor)).toEqual(['character']);
    expect(elementTexts(editor)).toEqual(['MARIE']);
  });

  test('E8: Tab only retypes the element the caret is in', () => {
    const editor = createEditor([
      { type: 'scene', text: 'INT. CAFÉ - JOUR' },
      { type: 'action', text: 'Marie entre.' },
      { type: 'action', text: 'Jean sort.' },
    ]);
    setCursor(editor, 1, 0);

    pressTab(editor);

    expect(elementTypes(editor)).toEqual(['scene', 'character', 'action']);
  });
});

describe('§8.1 E9–E10 — Dialogue ↔ Parenthetical toggle', () => {
  test('E9: Tab in a Dialogue toggles the type to Parenthetical', () => {
    const editor = createEditor([
      { type: 'character', text: 'MARIE' },
      { type: 'dialogue', text: 'Bonjour.' },
    ]);
    setCursor(editor, 1, 'end');

    pressTab(editor);

    expect(elementTypes(editor)).toEqual(['character', 'parenthetical']);
  });

  test('E9: Tab in a Parenthetical toggles the type back to Dialogue', () => {
    const editor = createEditor([{ type: 'parenthetical', text: '(souriant)' }]);
    setCursor(editor, 0, 'end');

    pressTab(editor);

    expect(elementTypes(editor)).toEqual(['dialogue']);
  });

  test('E10: Shift-Tab in a Parenthetical toggles the type back to Dialogue', () => {
    const editor = createEditor([{ type: 'parenthetical', text: '(souriant)' }]);
    setCursor(editor, 0, 'end');

    const handled = pressShiftTab(editor);

    expect(handled).toBe(true);
    expect(elementTypes(editor)).toEqual(['dialogue']);
  });

  test('E10: Shift-Tab in a Dialogue also stays inside the pair (never escapes to Character)', () => {
    const editor = createEditor([{ type: 'dialogue', text: 'Bonjour.' }]);
    setCursor(editor, 0, 'end');

    pressShiftTab(editor);

    expect(elementTypes(editor)).toEqual(['parenthetical']);
  });

  test('E9/E10: repeated Tab never leaves the Dialogue/Parenthetical pair', () => {
    const editor = createEditor([{ type: 'dialogue', text: 'Bonjour.' }]);
    setCursor(editor, 0, 'end');

    const seen = [];
    for (let i = 0; i < 6; i += 1) {
      pressTab(editor);
      seen.push(elementTypes(editor)[0]);
    }

    expect(seen).toEqual([
      'parenthetical', 'dialogue', 'parenthetical',
      'dialogue', 'parenthetical', 'dialogue',
    ]);
  });

  // EXPECTED FAIL — NOT an existing AUDIT finding; observed while writing these
  // specs. Toggling Dialogue → Parenthetical wraps the text in parentheses
  // (ScreenplayElement.js:158-167), but toggling back to Dialogue does not
  // unwrap it (the `currentType === 'parenthetical'` branch at :137-146 only
  // *adds* missing parens). So a stray double-Tab permanently rewrites
  // "Bonjour." as "(Bonjour.)" in the dialogue. The damage is bounded to one
  // pair — a third toggle finds the text already balanced — but it is still
  // silent data mutation from a navigation key.
  // Needs a product decision before it is un-skipped: neither AUDIT.md nor
  // REFERENCES.md states what Final Draft does when a Parenthetical is retyped
  // as Dialogue.
  test.skip('Tab away from a Dialogue and back leaves the dialogue text unchanged', () => {
    const editor = createEditor([{ type: 'dialogue', text: 'Bonjour.' }]);
    setCursor(editor, 0, 'end');

    pressTab(editor);       // → parenthetical, text becomes "(Bonjour.)"
    pressTab(editor);       // → dialogue again

    expect(elementTypes(editor)).toEqual(['dialogue']);
    expect(elementTexts(editor)).toEqual(['Bonjour.']);
  });
});

// Not enumerated in AUDIT §8.1, but E8–E10 only pin three of the twelve
// transitions. These lock down the rest of SP_TAB_FWD / SP_TAB_REV so a typo in
// the tables is caught by the suite rather than by a writer mid-scene.
describe('§8.1 (supplementary) — the full Tab rings', () => {
  test.each([
    ['scene', 'action'],
    ['action', 'character'],
    ['character', 'parenthetical'],
    ['parenthetical', 'dialogue'],
    ['dialogue', 'parenthetical'],
    ['transition', 'scene'],
  ])('Tab forward: %s → %s (SP_TAB_FWD)', (from, to) => {
    const editor = createEditor([{ type: from }]);
    setCursor(editor, 0, 0);

    pressTab(editor);

    expect(elementTypes(editor)).toEqual([to]);
  });

  test.each([
    ['scene', 'transition'],
    ['transition', 'dialogue'],
    ['dialogue', 'parenthetical'],
    ['parenthetical', 'dialogue'],
    ['character', 'action'],
    ['action', 'scene'],
  ])('Shift-Tab: %s → %s (SP_TAB_REV)', (from, to) => {
    const editor = createEditor([{ type: from }]);
    setCursor(editor, 0, 0);

    pressShiftTab(editor);

    expect(elementTypes(editor)).toEqual([to]);
  });
});
