# Editor non-regression specs — AUDIT.md §8.1 (E1–E14)

The typing state machine: what element you get when you press Enter, Tab,
Shift-Tab or Backspace, where the caret lands, and what happens to the text on
the way. This is the safety net for `extensions/ScreenplayElement.js` and
`constants/elementTypes.js`.

```bash
cd client && npm run test:ci                       # whole client suite
cd client && npx craco test --watchAll=false \
  --testPathPattern='__tests__/editor'             # just these four files
```

Current status: **59 specs — 53 pass, 6 skipped.** Runtime ~0.6 s.

| File | AUDIT cases | Specs | Passing | Skipped |
|------|-------------|-------|---------|---------|
| `typing.spec.js` | E1–E7 (typing, Enter) | 19 | 18 | 1 |
| `tab-cycle.spec.js` | E8–E10 (Tab / Shift-Tab) | 20 | 19 | 1 |
| `parens.spec.js` | E11 (auto-parentheses) | 9 | 7 | 2 |
| `backspace.spec.js` | E12–E14 (Backspace) | 11 | 9 | 2 |
| **Total** | | **59** | **53** | **6** |

## How to read these specs

Every spec asserts **correct Final Draft behaviour**, sourced from `AUDIT.md`
§8.1, `REFERENCES.md` §1.5–§1.6 and `CLAUDE.md`. Where ROOMS does not implement
that behaviour yet, the spec is written correctly anyway and marked
`test.skip` — so **un-skipping a spec is the definition of "that bug is
fixed"**. No spec in this directory encodes today's known-wrong behaviour as an
expectation; doing so would cement the bug.

Tests are driven through a headless TipTap `Editor`
(`src/test-utils/screenplayEditor.js`) rather than a mounted `SingleEditor`.
Key presses are dispatched as real `keydown` events on the ProseMirror DOM, so
`addKeyboardShortcuts()` and prosemirror-keymap are exercised too — not just
the commands behind them. The harness header documents exactly which production
extensions are omitted and why.

## The 6 skipped specs

| # | Spec | Source | Why it fails today |
|---|------|--------|--------------------|
| 1 | `typing.spec.js` → *E5: Enter at the end of a Dialogue inserts a Character* | **AUDIT.md §8.1 E5**, REFERENCES.md §1.5 and the matrix at REFERENCES.md:411 | `SP_NEXT_TYPE.dialogue === 'action'` (`constants/elementTypes.js:9`), so Enter from Dialogue yields an Action. Final Draft's default is the Dialogue → Character "ping-pong". **`CLAUDE.md` and the shipped code disagree on this today** — CLAUDE.md documents the ping-pong, `elementTypes.js` implements Action. |
| 2 | `backspace.spec.js` → *E13: Backspace at the start of a non-empty Character demotes it to Action* | **AUDIT.md finding 4.21 (MED)**, spec case §8.1 E13, fix listed as §7 step 2 | The handler falls through to the merge branch (`ScreenplayElement.js:226-243`) and glues `MARIE` onto the previous Action, destroying the character cue. |
| 3 | `backspace.spec.js` → *E13 (empty): Backspace on an empty Character demotes it to Action* | Same family as **finding 4.21**; REFERENCES.md §1.5 ("Backspace on an empty element converts it back to Action") | ROOMS deletes the empty element outright (`ScreenplayElement.js:210-217`). The empty-**Action** case (E12) is unaffected — "merge into previous" and "delete, caret to end of previous" are the same outcome there, which is why E12 passes. Un-skip together with #2. |
| 4 | `parens.spec.js` → *Enter at the end of a Parenthetical typed with no parentheses balances it and opens one Dialogue* | **NEW — no AUDIT finding.** Found by this spec. | `splitScreenplayElement` auto-closes the parenthetical by rewriting the node's content (`ScreenplayElement.js:51-62`), then computes the insert position from the **pre-transaction** `node.nodeSize` (`:88`). The position is stale by however many characters the auto-close added, so when *both* parentheses were missing it lands inside the text and ProseMirror splits the node. Typing `souriant` + Enter yields `(souriant` / `(dialogue "")` / `)` — a stray `)` element, i.e. silent document corruption on the main path this feature exists for. Cases missing only one parenthesis survive by luck. Fix: map the position through the transaction, `tr.mapping.map(nodeStart + node.nodeSize)`. |
| 5 | `parens.spec.js` → *E11: Mod-5 on an empty element also inserts `()`* | **NEW**, but it is what **AUDIT.md §8.1 E11** literally asks for | `setScreenplayType` (`ScreenplayElement.js:175-183`), the command behind `Mod-1`…`Mod-6`, only calls `setNodeMarkup`. So `Mod-5` makes a Parenthetical with no parentheses while `Tab` into the same empty element makes `()`. Two routes, two results. |
| 6 | `tab-cycle.spec.js` → *Tab away from a Dialogue and back leaves the dialogue text unchanged* | **NEW — needs a product decision before un-skipping** | Dialogue → Parenthetical wraps the text in parentheses (`:158-167`); Parenthetical → Dialogue does not unwrap it (`:137-146` only *adds* missing parens). A stray double-Tab rewrites `Bonjour.` as `(Bonjour.)` in the dialogue. Bounded to one pair — a third toggle finds it already balanced — but it is still silent mutation from a navigation key. Neither AUDIT.md nor REFERENCES.md says what Final Draft does when a Parenthetical is retyped as Dialogue, so **do not un-skip this without deciding the intended behaviour.** |

## One deliberate divergence from AUDIT.md's wording

`AUDIT.md` §8.1 **E6** says Enter on an empty Action deletes the node. That is
not Final Draft: an empty Action *is* a blank line, and Return on it produces
another blank line — REFERENCES.md §1.5, "Action | Action (blank line = new
Action)". Deleting it would make blank lines impossible to create. ROOMS
already implements the Final Draft rule (`ScreenplayElement.js:71-82`), so
`typing.spec.js` asserts that and the spec **passes**. AUDIT.md E6 and
CLAUDE.md's "or deletes if already action" both describe an implementation that
no longer exists. Flagged here rather than silently followed.

## Test-environment changes this suite required

Neither affects the production build; both are test-only.

- **`client/craco.config.js`** grew a `jest.configure` block adding two
  `moduleNameMapper` entries. CRA 5 pins Jest 27, whose resolver predates the
  package.json `exports` field: `@tiptap/pm/<sub>` and
  `@tiptap/core/jsx-runtime` have no `main`, so Jest fell back to directory
  resolution and loaded untranspiled ESM/TS out of `node_modules`
  (`SyntaxError: Unexpected token 'export'`). The mappings point those
  specifiers at the CJS builds the `exports` map would have chosen. Webpack
  resolves `exports` natively and ignores all of this.
- **`client/src/setupTests.js`** polyfills `globalThis.crypto` from Node's
  `crypto.webcrypto`. jsdom under jest-environment-jsdom 27 exposes no global
  `crypto`, so `ScreenplayElement.js`'s legitimate `crypto.randomUUID()` call
  threw `ReferenceError: crypto is not defined` in tests only. Bridged in the
  test environment rather than weakening production code.

## Not covered here

- **§8.2 E15–E18** (autocomplete, caret placement under CSS `zoom`) — needs the
  React component and layout; separate specs.
- **§8.3 E19–E21** (undo/redo) — separate specs; E21 is Playwright.
- Native single-character deletion with a collapsed caret, which the browser's
  contenteditable performs rather than a ProseMirror command. jsdom does not
  implement it, so `backspace.spec.js` asserts the hand-off instead (the
  handler must *decline* the key). Real deletion belongs in the E2E layer.
