/**
 * AUDIT.md §8.1 — editor typing state machine, cases E1–E7 (typing + Enter).
 *
 * Under test: `extensions/ScreenplayElement.js` (`splitScreenplayElement`, the
 * `Enter` binding) driven through `constants/elementTypes.js`
 * (`SP_NEXT_TYPE`, `SP_EMPTY_ENTER`).
 *
 * Every spec here asserts *correct* Final Draft behaviour. Where ROOMS does not
 * implement it yet the spec is `test.skip`-ed with the AUDIT finding number, so
 * that un-skipping is the definition of "fixed". Nothing in this file encodes a
 * known-wrong behaviour as an expectation. See `./README.md`.
 */

import {
  createEditor,
  destroyAllEditors,
  describeDoc,
  elementTypes,
  elementTexts,
  elementIds,
  cursor,
  setCursor,
  typeText,
  pressEnter,
} from '../../test-utils/screenplayEditor';

afterEach(destroyAllEditors);

describe('§8.1 E1 — typing into an element', () => {
  test('E1: typing "Hello" in the first empty Action keeps the type and leaves the caret at the end', () => {
    const editor = createEditor([{ type: 'action' }]);
    setCursor(editor, 0, 0);

    typeText(editor, 'Hello');

    expect(describeDoc(editor)).toEqual([{ type: 'action', text: 'Hello' }]);
    expect(cursor(editor)).toEqual({ index: 0, offset: 5 });
  });

  test('E1 (accents): typing preserves non-ASCII characters used by the FR locale', () => {
    const editor = createEditor([{ type: 'action' }]);
    setCursor(editor, 0, 0);

    typeText(editor, 'Marie entre dans le café.');

    expect(elementTexts(editor)).toEqual(['Marie entre dans le café.']);
    expect(cursor(editor)).toEqual({ index: 0, offset: 'Marie entre dans le café.'.length });
  });
});

describe('§8.1 E2–E5 — Enter at the end of a non-empty element', () => {
  test('E2: Enter at the end of an Action inserts a new empty Action below, caret inside it', () => {
    const TEXT = 'Marie entre dans le café.';
    const editor = createEditor([{ type: 'action', text: TEXT }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: TEXT },
      { type: 'action', text: '' },
    ]);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  test('E2 (identity): the inserted element gets its own non-null elementId', () => {
    const editor = createEditor([{ type: 'action', text: 'Marie entre.', id: 'first' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    const ids = elementIds(editor);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe('first');
    expect(ids[1]).toBeTruthy();
    expect(ids[1]).not.toBe(ids[0]);
  });

  test('E3: Enter at the end of a Scene heading inserts an Action (SP_NEXT_TYPE.scene)', () => {
    const editor = createEditor([{ type: 'scene', text: 'INT. CAFÉ - JOUR' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(elementTypes(editor)).toEqual(['scene', 'action']);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  test('E4: Enter at the end of a Character inserts a Dialogue (SP_NEXT_TYPE.character)', () => {
    const editor = createEditor([{ type: 'character', text: 'MARIE' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(elementTypes(editor)).toEqual(['character', 'dialogue']);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  // EXPECTED FAIL — AUDIT.md §8.1 E5. ROOMS ships `SP_NEXT_TYPE.dialogue =
  // 'action'` (constants/elementTypes.js:9), so Enter from Dialogue yields an
  // Action. Final Draft's default is the "ping-pong": Dialogue → Character,
  // which is what makes fast dialogue exchanges typeable — see REFERENCES.md
  // §1.5 ("Dialogue | **Character** (the 'ping-pong' default)"), §1.6 and the
  // feature matrix at REFERENCES.md:411, which flags ROOMS as ❌ here.
  // CLAUDE.md ("Enter from dialogue: creates new character element") documents
  // the Final Draft rule, not the shipped code — the two disagree today.
  // Un-skip when the ping-pong lands.
  test.skip('E5: Enter at the end of a Dialogue inserts a Character (Final Draft ping-pong)', () => {
    const editor = createEditor([
      { type: 'character', text: 'MARIE' },
      { type: 'dialogue', text: 'Bonjour.' },
    ]);
    setCursor(editor, 1, 'end');

    pressEnter(editor);

    expect(elementTypes(editor)).toEqual(['character', 'dialogue', 'character']);
    expect(cursor(editor)).toEqual({ index: 2, offset: 0 });
  });

  test('E5 (Transition): Enter at the end of a Transition inserts a Scene heading', () => {
    const editor = createEditor([{ type: 'transition', text: 'CUT TO:' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(elementTypes(editor)).toEqual(['transition', 'scene']);
  });

  test('E5 (Parenthetical): Enter at the end of a Parenthetical inserts a Dialogue', () => {
    const editor = createEditor([{ type: 'parenthetical', text: '(souriant)' }]);
    setCursor(editor, 0, 'end');

    pressEnter(editor);

    expect(elementTypes(editor)).toEqual(['parenthetical', 'dialogue']);
  });
});

describe('§8.1 E6–E7 — Enter on an empty element', () => {
  // NOTE — divergence from AUDIT.md's wording, resolved in favour of Final Draft.
  // AUDIT.md §8.1 E6 says the empty Action "is deleted (or leaves if only
  // node)". That is not Final Draft: an empty Action line is a *blank line*,
  // and Return on it produces another blank line — REFERENCES.md §1.5,
  // "Action | Action (blank line = new Action)". Deleting the node would make
  // blank lines impossible to create. ROOMS already implements the Final Draft
  // rule (ScreenplayElement.js:71-82), so this spec asserts that, not E6's
  // literal phrasing. AUDIT.md E6 and CLAUDE.md's "or deletes if already
  // action" both describe an implementation that no longer exists.
  test('E6: Enter on an empty Action adds another empty Action below (blank line), caret moves into it', () => {
    const editor = createEditor([
      { type: 'action', text: 'Marie entre.' },
      { type: 'action' },
    ]);
    setCursor(editor, 1, 0);

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: 'Marie entre.' },
      { type: 'action', text: '' },
      { type: 'action', text: '' },
    ]);
    expect(cursor(editor)).toEqual({ index: 2, offset: 0 });
  });

  test('E6 (only node): Enter on the sole empty Action never empties the document', () => {
    const editor = createEditor([{ type: 'action' }]);
    setCursor(editor, 0, 0);

    pressEnter(editor);

    expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(1);
    expect(elementTypes(editor).every(t => t === 'action')).toBe(true);
  });

  test('E7: Enter on an empty Character converts it to an Action in place', () => {
    const editor = createEditor([
      { type: 'action', text: 'Marie entre.' },
      { type: 'character', id: 'kept' },
    ]);
    setCursor(editor, 1, 0);

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: 'Marie entre.' },
      { type: 'action', text: '' },
    ]);
    // Converted in place — no new node, so the id must survive.
    expect(elementIds(editor)).toEqual(['el-0', 'kept']);
  });

  test.each(['scene', 'character', 'dialogue', 'parenthetical', 'transition'])(
    'E7 (all types): Enter on an empty %s converts it to Action (SP_EMPTY_ENTER)',
    type => {
      const editor = createEditor([
        { type: 'action', text: 'Marie entre.' },
        { type },
      ]);
      setCursor(editor, 1, 0);

      pressEnter(editor);

      expect(elementTypes(editor)).toEqual(['action', 'action']);
    }
  );
});

// Not enumerated in AUDIT §8.1, but these are the two remaining branches of
// `splitScreenplayElement`. Without them a regression in `tr.split` or in the
// at-start insert would go unnoticed by the whole suite.
describe('§8.1 (supplementary) — Enter in the middle and at the start of a node', () => {
  test('Enter mid-text splits into two elements of the same type', () => {
    const editor = createEditor([{ type: 'action', text: 'Marie entre. Jean sort.' }]);
    setCursor(editor, 0, 'Marie entre. '.length);

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'action', text: 'Marie entre. ' },
      { type: 'action', text: 'Jean sort.' },
    ]);
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });

  test('Enter at the start of a non-empty element pushes an empty element above it', () => {
    const editor = createEditor([{ type: 'dialogue', text: 'Bonjour.' }]);
    setCursor(editor, 0, 0);

    pressEnter(editor);

    expect(describeDoc(editor)).toEqual([
      { type: 'dialogue', text: '' },
      { type: 'dialogue', text: 'Bonjour.' },
    ]);
    // The caret stays with the text the writer already typed.
    expect(cursor(editor)).toEqual({ index: 1, offset: 0 });
  });
});
