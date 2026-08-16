/**
 * AUDIT.md §8.1 — editor typing state machine, case E11 (parenthetical
 * auto-parentheses).
 *
 * "Empty Parenthetical created → auto-inserts `()` with the cursor between."
 * Under test: the two parenthesis branches of `cycleType` and the auto-close
 * in `splitScreenplayElement` (`extensions/ScreenplayElement.js:50-62,
 * 136-168`).
 */

import {
  createEditor,
  destroyAllEditors,
  describeDoc,
  elementTypes,
  elementTexts,
  cursor,
  setCursor,
  typeText,
  press,
  pressTab,
  pressEnter,
} from '../../test-utils/screenplayEditor';

afterEach(destroyAllEditors);

describe('§8.1 E11 — a newly created empty Parenthetical gets its parentheses', () => {
  test('E11: Tab from an empty Character inserts "()" with the caret between them', () => {
    const editor = createEditor([
      { type: 'action', text: 'Marie entre.' },
      { type: 'character' },
    ]);
    setCursor(editor, 1, 0);

    pressTab(editor);

    expect(elementTypes(editor)).toEqual(['action', 'parenthetical']);
    expect(elementTexts(editor)[1]).toBe('()');
    expect(cursor(editor)).toEqual({ index: 1, offset: 1 });
  });

  test('E11: Tab from an empty Dialogue does the same', () => {
    const editor = createEditor([{ type: 'dialogue' }]);
    setCursor(editor, 0, 0);

    pressTab(editor);

    expect(describeDoc(editor)).toEqual([{ type: 'parenthetical', text: '()' }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: 1 });
  });

  test('E11: what the writer types next lands inside the parentheses', () => {
    const editor = createEditor([{ type: 'dialogue' }]);
    setCursor(editor, 0, 0);

    pressTab(editor);
    typeText(editor, 'souriant');

    expect(elementTexts(editor)).toEqual(['(souriant)']);
    expect(cursor(editor)).toEqual({ index: 0, offset: '(souriant'.length });
  });

  // EXPECTED FAIL — NOT an existing AUDIT finding; observed while writing these
  // specs, but it is exactly what AUDIT.md §8.1 E11 asks for ("Empty
  // Parenthetical created → auto-inserts ()"). `setScreenplayType`
  // (ScreenplayElement.js:175-183) is the command behind the Mod-1..Mod-6
  // shortcuts and it only calls `setNodeMarkup` — so Mod-5 produces a
  // parenthetical with no parentheses, while Tab into the same empty element
  // produces "()". Two routes to the same element, two different results.
  // Un-skip once `setScreenplayType` shares `cycleType`'s parenthesis handling.
  test.skip('E11: Mod-5 on an empty element also inserts "()" with the caret between', () => {
    const editor = createEditor([{ type: 'dialogue' }]);
    setCursor(editor, 0, 0);

    press(editor, '5', { mod: true });

    expect(describeDoc(editor)).toEqual([{ type: 'parenthetical', text: '()' }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: 1 });
  });
});

describe('§8.1 E11 — an unbalanced Parenthetical is closed when the writer leaves it', () => {
  test.each([
    ['(souriant', '(souriant)'],
    ['souriant)', '(souriant)'],
    ['(souriant)', '(souriant)'],
  ])('Enter at the end of a Parenthetical typed as "%s" balances it to "%s" and opens a Dialogue', (typed, expected) => {
    const editor = createEditor([
      { type: 'character', text: 'MARIE' },
      { type: 'parenthetical', text: typed },
    ]);
    setCursor(editor, 1, 'end');

    pressEnter(editor);

    // The full shape matters, not just the text: the auto-close rewrites the
    // node's content *and* the same transaction inserts the Dialogue, so a bad
    // insert position shows up as an extra element rather than as wrong text.
    expect(describeDoc(editor)).toEqual([
      { type: 'character', text: 'MARIE' },
      { type: 'parenthetical', text: expected },
      { type: 'dialogue', text: '' },
    ]);
    expect(cursor(editor)).toEqual({ index: 2, offset: 0 });
  });

  // EXPECTED FAIL — NOT an existing AUDIT finding; found by this spec.
  // `splitScreenplayElement` auto-closes the parenthetical by rewriting the
  // node's content (ScreenplayElement.js:51-62) and then computes where to put
  // the new Dialogue with `insertPos = nodeStart + node.nodeSize`
  // (ScreenplayElement.js:88) — but `node` is the *pre-transaction* node, so
  // `nodeSize` is stale by exactly the number of characters the auto-close
  // added. When only one parenthesis was missing the position happens to land
  // on the content end and survives; when the writer typed **no parentheses at
  // all** it lands two positions short, inside the text, and ProseMirror splits
  // the node to fit a block there.
  //
  // Actual result today for "souriant":
  //   MARIE / (parenthetical "(souriant") / (dialogue "") / (parenthetical ")")
  // — a stray ")" element after the dialogue, i.e. silent document corruption
  // on the *main* path this feature exists for (the writer who never types
  // parentheses because the editor promises to add them).
  //
  // Fix is to map the position through the transaction, e.g.
  //   const insertPos = tr.mapping.map(nodeStart + node.nodeSize);
  // Un-skip once that lands.
  test.skip('Enter at the end of a Parenthetical typed with no parentheses balances it and opens one Dialogue', () => {
    const editor = createEditor([
      { type: 'character', text: 'MARIE' },
      { type: 'parenthetical', text: 'souriant' },
    ]);
    setCursor(editor, 1, 'end');

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'character', text: 'MARIE' },
      { type: 'parenthetical', text: '(souriant)' },
      { type: 'dialogue', text: '' },
    ]);
    expect(cursor(editor)).toEqual({ index: 2, offset: 0 });
  });

  test('An already-balanced Parenthetical is left byte-for-byte alone', () => {
    const editor = createEditor([{ type: 'parenthetical', text: '(souriant)' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(elementTexts(editor)[0]).toBe('(souriant)');
  });
});
