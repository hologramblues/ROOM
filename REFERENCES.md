# ROOMS Reference Dossier
_Reference bar for ROOMS. Every design decision is judged against these._

Research date: 2026-08-12. This dossier consolidates industry-standard formatting (Final Draft), the two mature browser-based collaborative competitors (WriterDuet, Arc Studio Pro), the indie desktop challenger (Fade In), the plain-text/Fountain alternative (Highland Pro), and the collaboration gold standard (Google Docs). Every ROOMS UX decision — element flow, cursor rendering, comment anchoring, offline UX, share flow, export coverage — is scored against these references.

---

## 1. Final Draft — the industry standard

Final Draft 13 (2025) remains the reference implementation every other screenwriting tool is measured against. It defines the on-page look, the .fdx interchange format, and the typing-flow expectations professional writers arrive with muscle memory for.

### 1.1 Page format

- **Paper**: US Letter, **8.5" × 11"** (216 × 279 mm). Non-negotiable for US industry submissions.
- **Margins**:
  - Top: **1.0"** (25.4 mm)
  - Bottom: **1.0"** (25.4 mm) — may vary ±0.25"
  - Left: **1.5"** (38.1 mm) — extra room for three-hole binding
  - Right: **1.0"** (25.4 mm) — may vary ±0.25"
- **Page number**: flush right, 0.5" from top; suppressed on page 1.

> Note for ROOMS: current build targets A4 with 28 mm margins and `LINES_PER_PAGE = 63`. This is fine for European drafting but diverges from the US Letter industry default. See §7 and §8.

### 1.2 Font

- **Courier 12pt** (Courier Final Draft, Courier Prime, or Courier New).
- Fixed metrics: **10 cpi** horizontal (1 char = 1/10"), **6 lpi** vertical (1 line = 1/6").
- Any other font breaks industry format and page-count math.

### 1.3 Element indents (physical LEFT edge of the page)

| Element | Left indent (in) | Left indent (mm) | Right / width | Notes |
|---|---|---|---|---|
| Scene heading | 1.5" | 38.1 mm | to 7.5" | UPPERCASE, e.g. `INT. HOUSE - DAY` |
| Action | 1.5" | 38.1 mm | to 7.5" | Full column width |
| Character name | 3.7" | 94.0 mm | — | UPPERCASE, ~35 chars max |
| Parenthetical | 3.1" | 78.7 mm | to 5.5" | Lowercase, in `()` |
| Dialogue | 2.5" | 63.5 mm | to 6.5" | ~35 chars/line |
| Transition | right-aligned at 7.5" | 190.5 mm | — | UPPERCASE, e.g. `CUT TO:` |

(All widths measured to a right margin at **7.5"** from the left edge = 8.5" − 1.0" right margin.)

### 1.4 Lines per page

- **Typical LINES_PER_PAGE = 55** on US Letter with the margins above (9" of vertical text × 6 lpi = 54; 55 with tight leading).
- Rule-of-thumb: **1 formatted page ≈ 1 minute of screen time**.
- ROOMS uses 63 because A4 (11.69") is taller than Letter (11") and margins are narrower.

### 1.5 Typing flow per element (Final Draft canonical)

**Enter / Return** advances to the next logical element:

| From | Enter → |
|---|---|
| Scene heading | Action |
| Action | Action (blank line = new Action) |
| Character | Dialogue |
| Parenthetical | Dialogue |
| Dialogue | **Character** (the "ping-pong" default — key to fast dialogue exchanges) |
| Transition | Scene heading |

**Tab** cycles by element type:
- In **Dialogue / Parenthetical**: Tab toggles the two (matches current ROOMS spec).
- In other elements: Tab cycles Action → Character → Transition → Scene heading. User option to swap Tab-from-Character between Parenthetical and Character-extension (`(V.O.)`, `(O.S.)`).

**Backspace** on an empty element: converts the current element back to Action; if already Action, merges with the previous element (matches current ROOMS behavior).

### 1.6 SmartType (character/location autocomplete)

Final Draft's SmartType is the muscle-memory feature pros expect. Any professional switching to ROOMS will notice its absence in under two minutes.

- Typing the first letters in a **Character** element suggests matching names from a per-document character list.
- **Tab** accepts the suggestion and advances to the next element (Dialogue).
- **Enter** at end of Dialogue → new Character; once ALICE and BOB have alternated once, Final Draft **auto-fills the alternating name** on Enter — writer types no letters between lines.
- SmartType lists cover: Scene Intros (`INT.`, `EXT.`, `INT./EXT.`), Times of Day (`DAY`, `NIGHT`, `CONTINUOUS`, `LATER`), Locations (built from prior scene headings), Extensions (`(V.O.)`, `(O.S.)`, `(CONT'D)`), Transitions.
- Lists auto-populate from document content and are editable via **Document → SmartType**.

### 1.7 FDX export format

FDX = XML, UTF-8. Canonical skeleton:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<FinalDraft DocumentType="Script" Template="No" Version="6">
  <Content>
    <Paragraph Type="Scene Heading">
      <Text>INT. LIBRARY - DAY</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>A PROGRAMMER types at an old laptop.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>PROGRAMMER</Text>
    </Paragraph>
    <Paragraph Type="Parenthetical">
      <Text>(excited)</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>Eureka!</Text>
    </Paragraph>
    <Paragraph Type="Transition">
      <Text>FADE TO BLACK.</Text>
    </Paragraph>
  </Content>
  <SmartType> ... </SmartType>
  <ElementSettings Type="..."> ... </ElementSettings>
  <TitlePage> ... </TitlePage>
</FinalDraft>
```

- Root: `<FinalDraft DocumentType="Script" Template="No" Version="…">` (Version 1..6+).
- `<Content>` wraps all `<Paragraph>` nodes.
- **Paragraph Type values** (seven canonical types): `Scene Heading`, `Action`, `Character`, `Parenthetical`, `Dialogue`, `Transition`, `General` (used for shots and singletons).
- Paragraph attributes: `Alignment`, `FirstIndent`, `Leading`, `LeftIndent`, `RightIndent`, `SpaceBefore`, `Spacing`, `StartsNewPage`.
- `<Text>` children hold the string; attributes: `Font`, `Size`, `Style` (`Bold`/`Italic`/`Underline`), `Color`, `Background`, `RevisionID`, `AdornmentStyle`.
- Optional siblings of `<Content>`: `<TitlePage>`, `<SmartType>` (character/location/extension lists), `<ElementSettings>` (per-type indent overrides), `<HeaderAndFooter>`, `<Revisions>`.

### 1.8 Sources — Final Draft

- [Final Draft product page](https://www.finaldraft.com) — screenshots at https://www.finaldraft.com/product/final-draft-13/
- [How to Format a Screenplay — Final Draft](https://www.finaldraft.com/learn/how-to-format-a-screenplay/)
- [Standard Screenplay Format — Quote-Unquote Apps](https://blog.quoteunquoteapps.com/standard-screenplay-format-the-writers-guide/)
- [Final Draft Keyboard Shortcuts](https://kb.finaldraft.com/hc/en-us/articles/27977488282644-What-keyboard-shortcuts-can-I-use-in-Final-Draft)
- [What is SmartType — Final Draft KB](https://kb.finaldraft.com/hc/en-us/articles/27750003388948-What-is-SmartType-and-how-do-I-use-it)
- [Change what Enter/Return does — Final Draft KB](https://kb.finaldraft.com/hc/en-us/articles/15575352995348-How-can-I-change-what-the-Enter-Return-key-does)
- [Final Draft 12 Cheat Sheet (PDF)](https://www.belalampert.com/wp-content/uploads/2021/05/Final-Draft-12-Cheat-Sheet.pdf)
- [FDX sample XML — rsdoiel/fdx on GitHub](https://github.com/rsdoiel/fdx/blob/main/testdata/sample-01.fdx)
- [Final Draft file format — Archive Team](http://fileformats.archiveteam.org/wiki/Final_Draft)
- [Investigating Final Draft's XML — libertyseeds.ca](https://libertyseeds.ca/2015/07/21/Investigating-Final-Draft-s-XML-document-format-with-Ruby/)
- [Screenplay Margins — Celtx Blog](https://blog.celtx.com/screenplay-margins-guide/)

---

## 2. Fade In — indie desktop competitor

Fade In (Kent Tessman / Quote-Unquote Apps) is the indie desktop challenger to Final Draft: cheaper, cross-platform (Mac/Win/Linux/iOS/Android), one-time perpetual license. It is the closest thing to a "Final Draft you'd actually enjoy paying for" among traditional WYSIWYG apps.

### 2.1 Divergences from Final Draft

- **Nearly pixel-perfect on-page compatibility** with Final Draft output — same US Letter, same Courier 12pt, same indents. This is the whole pitch: Fade In files render like FD files.
- **Full FDX round-trip**: opens and saves .fdx natively without loss (parenthesized character extensions, revisions, dual-dialogue). Also imports/exports Fountain, Celtx, PDF.
- **Lower cost and perpetual licensing** — Final Draft is subscription-nudging; Fade In is a one-time purchase (~$79). No forced upgrade cycle.
- **Cross-platform native app** — Final Draft's Linux story is nonexistent; Fade In ships Linux binaries.
- **Same SmartType model** as Final Draft (character/location/extension autocomplete) — writers switching between the two experience no muscle-memory disruption.
- **Same seven canonical element types** (Scene, Action, Character, Parenthetical, Dialogue, Transition, General).

### 2.2 Innovations / differentiators

- **Integrated production tools**: index cards view, scene/character/location panels, revision tracking, dual-dialogue, tabbed multi-document editing — all in the same app rather than as add-ons.
- **Screenplay templates** for stage plays, comic books, teleplays, novels — broader than Final Draft's screenplay focus.
- **Native PDF viewer sidebar** to compare drafts side-by-side.
- **No cloud, no telemetry** — a selling point for writers who don't want a subscription tether.

### 2.3 Sources — Fade In

- [Fade In Professional Screenwriting Software](https://www.fadeinpro.com/) — screenshots at https://www.fadeinpro.com/pictures.php
- [Fade In (software) — Wikipedia](https://en.wikipedia.org/wiki/Fade_In_(software))

---

## 3. WriterDuet — web-based collab leader

WriterDuet is the incumbent "Google-Docs-for-scripts" and the most obvious direct competitor to ROOMS. Web-first with Electron desktop and mobile wrappers, mature real-time collab since ~2014, freemium pricing.

### 3.1 Feature list

- Real-time multi-writer collaboration (marquee feature).
- Full offline mode with local-storage cache; auto-sync on reconnect (browser tab must be open).
- **Sync indicator**: green checkmark = fully synced; yellow = saved locally, not on server.
- **Plain-text auto-backups** stored locally; accessible via Help → Locally Saved Backups.
- Outline Mode with inline Sequence/Outline elements and collapse arrows.
- Cards Widget (index-card view grouped by Act/Sequence, click to jump).
- Configurable sidebar — icons drag to reorder.
- Find & Replace with filters (case, whole-word, line type, tags).
- Comments (inline, colored by user, threaded, `@mention`, filter by resolved/user/color, PDF-with-notes export).
- Chat.
- History / version tracking; PDF export supports "Revised Pages Only".
- Broadest export coverage of any competitor (see §7).

### 3.2 UX flows

**Typing flow (default "traditional" behavior, all toggleable in Customize → Edit):**

| From | Enter → | Tab → |
|---|---|---|
| Action | Action | Character |
| Character | Dialogue (with autofill from previously-used names) | — |
| Dialogue | Action (default) or Character (if "traditional" off) | Parenthetical (on blank line) |
| Scene | Action | — |

Cycle roughly: Action → Character → Dialogue → Action.

**Format auto-detection:** typing `int.`/`ext.` (either case) on a blank line auto-converts to Scene Heading. Once in a scene line, autofill suggests prior locations and offers `DAY`, `NIGHT`, `CONTINUOUS`, `LATER`. Character names auto-complete from prior use. All toggleable.

**Sharing:** Project-level sharing widget. Add collaborators by email or invite link. Role assignment per document.

### 3.3 Cursor sharing

- Each collaborator's line position shown as a **line-level color highlight** matching their avatar color. **No floating cursor caret with a name label.**
- Avatars appear in the Project widget showing which document each collaborator is currently viewing.
- Screen/monitor icon next to a user's name when you're actively mirroring their scroll.
- Identification is purely by color — no animated name-labels following the caret (unlike Google Docs / Figma).

### 3.4 Comments

- Inline comments recommended default. Render in commenter's avatar color with name + timestamp.
- Dedicated Comments & Chat widget in sidebar aggregates all comments.
- Filters: unresolved / resolved / removed / by user / by color.
- `@name` tagging with autocomplete from collaborators.
- Threading: replies within a thread; resolve toggles state.
- PDF-with-Notes export (Pro tier) preserves comment colors.

### 3.5 Screenshot URLs

WriterDuet's knowledgebase does not expose canonical screenshot URLs; product screenshots are embedded in the help articles below and on the landing page:

- https://www.writerduet.com (marketing screenshots)
- Individual feature articles in §3.6 each embed UI images.

### 3.6 Sources — WriterDuet

- [Change Line Type / Tab-Enter behavior](https://www.writerduet.com/article/170-change-line-type)
- [Customize Editing Options](https://www.writerduet.com/article/117-customize-editing-options)
- [Scene Headings auto-detect](https://writerduet.helpscoutdocs.com/article/146-scene-headings)
- [Outline Mode](https://www.writerduet.com/article/228-outline-mode)
- [Cards Widget & View](https://www.writerduet.com/article/211-cards-widget-mode)
- [Find and Replace](https://www.writerduet.com/article/68-find-and-replace)
- [Comments](https://www.writerduet.com/article/221-comments)
- [Collaborator Location](https://www.writerduet.com/article/354-collaborator-location)
- [Share Your Project](https://www.writerduet.com/article/149-invite-collaborators-to-a-project)
- [Write Offline](https://www.writerduet.com/article/234-write-offline)
- [Connection & Performance](https://www.writerduet.com/article/244-connection-performance)
- [Export a Document](https://www.writerduet.com/article/261-export-a-document)
- [WriterDuet Review 2026 — The AI Tools Box](https://theaitoolsbox.com/tool/writerduet-review/)

---

## 4. Arc Studio Pro — modern web competitor

Arc Studio Pro is the newer, more design-forward web competitor. Cleaner UI than WriterDuet, strong focus on structure (Beats view) and production workflow (Branch & Merge, Snapshots as colored Revisions). Actively adding features in 2025.

### 4.1 Feature list

- Real-time collaboration with offline fallback.
- Guest sharing (no Arc account required) — a competitive strength over WriterDuet.
- **Scene Navigator** sidebar: each scene = index card with color chip, title, and optional first-line-of-synopsis toggle. Click to jump.
- **Beats view**: dedicated outlining tool for arcs/beats; branch copies possible per beat.
- **Snapshots**: capture document state. Naming a snapshot with a color = a **Revision**. After a White Production Draft snapshot, subsequent changes auto-track as Blue (matches industry White → Blue → Pink → Yellow → Green → Goldenrod cycle).
- **Branch & Merge**: create Branch Copy (private or shared) → edit independently → merge with diff review (Combined or Side-by-Side view, green additions / red deletions, filter by author/type, accept/discard per change). Can branch a single beat via right-click. **No other competitor has this today.**
- **Comment Mode**: switches view; yellow underline on referenced text, full list in a right sidebar.
- Comments: margin bubbles by default, threaded replies, resolve checkmark, edit, `@` mentions with notification. Shortcut `Cmd+Option+M` to create from selection. Sidebar filters by author, tag, mention, resolved state.
- Export: PDF, FDX, Fountain, plain-text (Fountain). Narrower than WriterDuet (see §7).

### 4.2 UX flows

**Typing flow (closer to Final Draft than WriterDuet):**

| From | Enter → | Tab → |
|---|---|---|
| Scene | Action (empty) | Jump from location field to time-of-day |
| Action | Action | Toggle Action ↔ Character (blank) |
| Character | Dialogue | Parenthetical |
| Parenthetical | Dialogue | — |
| Dialogue | **Character** (Final Draft ping-pong default) | Parenthetical |

Script flow from Action can be customized to jump straight to Character.

**Format auto-detection:** typing `int.`, `ext.`, or `i/e.` on an Action line converts it to a Scene Heading in place. Same character/location auto-completion pattern as WriterDuet.

**Sharing / invite flow:**
- Invite by **email** or **shareable link** (`+ Create new link`).
- Three roles: **Can edit** (default), **Admin** (edit + manage collaborators), **Read only**.
- **Guest access supported** — no Arc account required. Big friction reducer.
- Inviting requires a paid subscription; invited collaborator can be free-plan.

### 4.3 Cursor sharing

- Collaborator avatars pinned in the toolbar, each with a colored outline matching their editing color.
- **Green "live" dot** on bottom-right of the avatar when the user is actively editing.
- Cursor caret and text contributions rendered in the user's assigned color.
- No animated name-label float — static avatar roster + colored cursor position.

### 4.4 Screenshot URLs

- https://www.arcstudiopro.com (marketing screenshots)
- Feature screenshots embedded in help articles below.

### 4.5 Sources — Arc Studio Pro

- [Quick Formatting, Shortcuts & Keystrokes Guide](https://help.arcstudiopro.com/guides/quick-formatting-shortcuts-keystrokes-guide)
- [Writing Your First Page](https://help.arcstudiopro.com/guides/writing-your-first-page)
- [Advanced Formatting](https://help.arcstudiopro.com/guides/advanced-formatting)
- [Collaboration & Feedback](https://help.arcstudiopro.com/guides/collaboration-feedback)
- [Comments (sidebar)](https://help.arcstudiopro.com/guides/the-sidebar/comments)
- [How Do I Invite Collaborators](https://help.arcstudiopro.com/how-tos/feedback-and-collaboration/how-do-i-invite-collaborators-to-work-on-my-script)
- [Guest sharing without account](https://help.arcstudiopro.com/how-tos/feedback-and-collaboration/how-do-i-share-my-script-for-feedback-with-somebody-without-an-arc-studio-pro-account)
- [Branch & Merge](https://help.arcstudiopro.com/guides/branch-merge)
- [Draft & Revision Management](https://help.arcstudiopro.com/guides/draft-revision-management)
- [Switching to Arc Studio for Experienced Writers](https://help.arcstudiopro.com/guides/switching-to-arc-studio-for-experienced-screenwriters)
- [Export as Final Draft file](https://help.arcstudiopro.com/all-how-tos/how-do-i-export-my-script-as-a-final-draft-file)
- [Arc Studio Pro Review 2025 — DroidCrunch](https://droidcrunch.com/arc-studio-pro-review/)
- [Hands-on Review: Arc Studio Pro — FilmDaft](https://filmdaft.com/review-arc-studio-screenwriting-software-test/)
- [Arc Studio Pro vs Final Draft — Filmmaker Tools](https://www.filmmaker.tools/arc-studio-pro-vs-final-draft)

---

## 5. Highland — Markdown/Fountain alt

Highland is built by John August, co-creator of the [Fountain](https://en.wikipedia.org/wiki/Fountain_(markup_language)) plain-text format. **Highland Pro** shipped March 4, 2025 as version 3.0 — a near-complete rewrite, cross-platform (Mac + iPad + iPhone), subscription model, 30-day trial.

### 5.1 Positioning

Highland is not a WYSIWYG editor with a Fountain export — it *is* the Fountain workflow. The document on disk is plain text; formatting is inferred from Markdown-like syntax; rendering to "screenplay layout" happens on the fly (or on PDF export). The pitch: fewer decisions per keystroke, zero lock-in, prose-writing velocity, no mouse-reach to change element type.

**Positioning against ROOMS:** Highland is single-writer with iCloud sync. **No real-time collaboration.** This is a structural moat for ROOMS.

### 5.2 The Fountain workflow

- **No element menu, no Tab/Enter dance.** Type syntax; formatting emerges:
  - `INT.` / `EXT.` at line start → Scene heading
  - Line in ALL CAPS → Character cue; following block auto-inferred as Dialogue
  - `(beat)` → Parenthetical
  - `>FADE OUT.<` → centered Transition
  - `[[note]]` → inline note
  - `#` / `##` / `###` → Markdown-style outline headings
- **Plain text on disk.** A `.fountain` file opens in any text editor. No proprietary format.
- **Trade-offs:** you must learn syntax; the visual layout can lag by one line while the parser decides. Not great for beginners; loved by prolific pros.

### 5.3 Highland Pro innovations worth borrowing

- **/Lookup** — slash command opens definitions, rhymes, world-facts inline without leaving the draft.
- **The Shelf** — right-side scratch drawer for snippets, cut lines, notes. Cut dialogue goes here instead of the graveyard.
- **Overview** — bird's-eye zoomed-out layout showing the whole script as colored blocks (by character/scene). Structural pattern recognition.
- **Grammar Highlight** — colors nouns/verbs/adjectives/adverbs across the doc for prose-quality passes.
- **Revision Mode**, **Gender Analysis** (speaking-role balance), **Sprints**, **Goals**, **Cast/Location lists** — all local-first.
- **Notable absence: real-time collab.** iCloud sync only, single writer.

### 5.4 Sources — Highland

- [John August: Introducing Highland Pro](https://johnaugust.com/2025/introducing-highland-pro)
- [Highland Pro official page](https://quoteunquoteapps.com/highland-pro/)
- [Quote-Unquote blog: Highland 2 vs Pro](https://blog.quoteunquoteapps.com/highland-2-highland-pro-what-changed-what-stayed-the-same-and-where-to-get-it/)
- [Fountain spec (Wikipedia)](https://en.wikipedia.org/wiki/Fountain_(markup_language))

---

## 6. Google Docs — real-time collab gold standard

Google Docs is the reference for what collaborative editing *feels* like. Every ROOMS collab detail — cursor rendering, presence, comment anchoring, offline UX, selection sharing — is scored against GDocs.

### 6.1 Collaborative cursor visual + label

- **Caret** is a **2px vertical bar** in the user's assigned color (deterministic per-user hash, ~12 distinct hues, avoiding red/black to not collide with spellcheck/text).
- **Name label** floats **above** the caret as a **small rounded pill** (~2–4 px above), same fill color, white text, ~11px Roboto.
- **Fade behavior:** name pill shows on caret move, then **fades after ~3 seconds of idle**; the colored caret itself remains but stops blinking. Hovering the caret re-shows the pill. On any typing/selection change the pill snaps back to full opacity.

### 6.2 Comment card positioning + scroll sync

- Cards live in a **fixed right rail** (~256 px). Each card is **anchored** to its highlighted range and **scrolls in sync with the document body**.
- **Anti-overlap = force-directed stacking.** When two anchors are close vertically, the lower card is pushed down; when the focused card moves, others shift up/down with a short (~150 ms) transform animation.
- The **active card** gets a subtle left-border color + shadow and sits at its true anchor Y; unfocused cards yield.
- Clicking a highlight in the body scrolls its card into view *and* vice-versa. Resolved comments collapse out of the rail into the history drawer.

### 6.3 Presence indicators

- **Avatar row top-right** in the header. Colored ring matches the user's caret color. Order = most-recently-active first. Overflow collapses into a "+N" chip; click for full list.
- Hovering an avatar shows name + "editing / viewing" + last-active timestamp. **Clicking it jumps and scrolls the viewport to that user's caret.**
- **No "Alice is typing…" banner** — the moving cursor itself is the typing signal (cheaper, less noisy).

### 6.4 Selection sharing (2010)

- Other users' selections render as a **translucent rectangle** (their color, ~30% alpha) over the selected range in your view.
- Critical for "look at this line" moments during co-writing calls.

### 6.5 Reconnection UX

- **Status pill next to the title** replaces the "All changes saved in Drive" cloud icon with a **lightning-bolt "Working offline"** state; tooltip explains local-cache write.
- On reconnect: pill briefly shows **spinner + "Saving…"** then returns to "All changes saved" — **no modal, no dialog**.
- If the socket drops mid-session: a toast on the bottom-left appears: *"Trying to connect…"* — **non-blocking**, keystrokes continue against local state.
- Unresolved conflicts surface as a small inline banner offering "See changes".

### 6.6 Perceived latency

- Local keystrokes echo **instantly** (optimistic OT/CRDT).
- Remote characters appear with **~50–150 ms** delay on healthy connections.
- Google **debounces cursor-position broadcasts at ~50 ms** to cap traffic without visibly lagging the peer caret.
- Concurrent edits on the same paragraph never block — OT rebases both sides. Undo is per-user, not global.

### 6.7 Screenshot / reference URLs

- [How Google Docs shows other people's cursor](https://javascript.plainenglish.io/how-google-docs-shows-other-peoples-cursor-in-real-time-fe0f83cfb4ca) — annotated caret/pill screenshots.
- [Building presence like Figma/Google Docs](https://dev.to/astrodevil/build-real-time-presence-features-like-figma-and-google-docs-in-your-app-in-minutes-1lae) — avatar row references.
- [Design a real-time collab editor](https://www.designgurus.io/blog/design-real-time-editor) — architecture diagrams.

### 6.8 Sources — Google Docs

- [Google Workspace: New save/offline indicator (2020)](https://workspaceupdates.googleblog.com/2020/06/new-save-status-online-offline-google-docs.html)
- [Google Workspace: Collaborative highlighting (2010)](https://workspaceupdates.googleblog.com/2010/09/new-collaborative-highlighting-in.html)

---

## 7. Feature comparison matrix

Legend: ✅ = strong / native, ⚠️ = partial / weak, ❌ = missing, — = not applicable.

| Feature | ROOMS today | WriterDuet | Arc Studio | Final Draft | Fade In | Highland | GDocs |
|---|---|---|---|---|---|---|---|
| **Page format default** | A4 + 28 mm margins | US Letter + 1.5"/1" | US Letter + 1.5"/1" | US Letter + 1.5"/1" (canonical) | US Letter + 1.5"/1" | US Letter (Fountain-rendered) | — |
| **Font** | Courier 12pt | Courier 12pt | Courier 12pt | Courier 12pt (canonical) | Courier 12pt | Courier 12pt (rendered) | — |
| **Lines/page** | 63 (A4) | 55 (Letter) | 55 (Letter) | 55 (Letter) | 55 (Letter) | 55 (Letter) | — |
| **Enter: Dialogue → Character (ping-pong)** | ❌ (Enter from dialogue → new character element per CLAUDE.md — verify) | ⚠️ (default off; toggleable) | ✅ | ✅ | ✅ | — (Fountain) | — |
| **Tab: Dialogue ↔ Parenthetical toggle** | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| **SmartType character autocomplete** | ❌ | ✅ | ✅ | ✅ (canonical) | ✅ | ⚠️ (Fountain-inferred) | — |
| **Auto-detect `INT.`/`EXT.` → Scene** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (native syntax) | — |
| **Time-of-day autocomplete (DAY/NIGHT/…)** | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ | — |
| **FDX import** | ✅ (importFDX.js) | ✅ | ✅ | ✅ (native) | ✅ | ✅ | — |
| **FDX export** | ⚠️ (verify) | ✅ | ✅ | ✅ (native) | ✅ | ✅ | — |
| **Fountain import/export** | ❌ | ✅ / ✅ | ✅ / ✅ | ⚠️ / ⚠️ | ✅ / ✅ | ✅ (native format) | — |
| **PDF export** | ✅ | ✅ (Default / w-Notes / Revised) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Word .docx export** | ❌ | ✅ | Import only | ⚠️ | ⚠️ | ✅ | ✅ |
| **Real-time collaborative editing** | ✅ | ✅ | ✅ | ❌ (single writer) | ❌ | ❌ | ✅ (gold standard) |
| **Cursor caret w/ name label** | ⚠️ (verify) | ❌ (color highlight only) | ⚠️ (colored caret, no label) | — | — | — | ✅ (pill, 3s fade) |
| **Selection sharing (peer highlight)** | ❌ (verify) | ⚠️ | ⚠️ | — | — | — | ✅ |
| **Presence avatar row + click-to-jump** | ⚠️ (avatars yes, jump verify) | ⚠️ (avatar list, no jump) | ✅ (avatar w/ live dot) | — | — | — | ✅ |
| **Comment threads + resolve** | ✅ (useHighlights + CommentsSidebar) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| **`@mention` in comments** | ❌ (verify) | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| **Anchored comment cards w/ scroll sync + anti-overlap** | ⚠️ (sidebar exists; anti-overlap verify) | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ (canonical) |
| **Chat panel** | ✅ (ChatPanel + useChat) | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ (comments only) |
| **Scene outline sidebar** | ✅ (OutlineSidebar) | ✅ (Outline Mode + Cards) | ✅ (Scene Navigator) | ✅ (Beat Board) | ✅ | ✅ (Overview) | — |
| **Index-card / beat board view** | ✅ (BeatBoard w/ Excalidraw) | ✅ (Cards Widget) | ✅ (Beats view) | ✅ | ✅ | ✅ (Overview) | — |
| **Scene locking** | ✅ (sceneLockPlugin) | ❌ | ⚠️ (via Read-only branch) | ⚠️ (revisions) | ⚠️ | ❌ | ⚠️ (suggest mode) |
| **Colored-page revision cycle (White→Blue→Pink…)** | ❌ | ⚠️ | ✅ (Snapshots as Revisions) | ✅ (canonical) | ✅ | ✅ | ❌ |
| **Branch & Merge** | ❌ | ❌ | ✅ (unique) | ❌ | ❌ | ❌ | ⚠️ (via Drive versions) |
| **Guest / no-account link sharing** | ⚠️ (verify) | ⚠️ | ✅ | — | — | — | ✅ |
| **Offline mode + auto-sync** | ✅ (useOfflineMode) | ✅ | ✅ | — | — | ⚠️ (iCloud) | ✅ |
| **"Working offline" status pill (no modal)** | ⚠️ (verify) | ✅ (yellow/green sync indicator) | ⚠️ | — | — | — | ✅ (canonical) |
| **Non-blocking reconnect toast** | ⚠️ (verify) | ⚠️ | ⚠️ | — | — | — | ✅ |
| **Optimistic local echo + ~50ms cursor debounce** | ⚠️ (verify socket layer) | ✅ | ✅ | — | — | — | ✅ |
| **AI rewrite** | ✅ (useAIRewrite) | ⚠️ (limited) | ⚠️ | ❌ | ❌ | ⚠️ (/Lookup) | ⚠️ (Gemini) |
| **Writing goals / sprints** | ✅ (useWritingGoals) | ⚠️ | ❌ | ❌ | ❌ | ✅ (Sprints, Goals) | ❌ |
| **Typewriter sound** | ✅ (useTypewriterSound) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Native desktop app** | ✅ (Electron) | ✅ (Electron) | ⚠️ | ✅ (native) | ✅ (native) | ✅ (native) | ⚠️ (PWA) |

> Rows marked "verify" flag ROOMS features where the exact behavior in the current codebase should be confirmed against this doc during the AUDIT phase.

---

## 8. Critical UX flows ROOMS must match or beat

Each flow below is a moment where a professional evaluating ROOMS against Final Draft, WriterDuet, or Arc Studio will form a snap judgement. Ordered by impact on retention.

### Flow 1 — First-line typing (empty document → first scene heading + first dialogue exchange)

- **Description**: User opens a new document, types `int. cafe - day`, hits Enter, types action, hits Enter to a character name, types dialogue, then a second character responds. This is the muscle-memory test.
- **Success criteria**:
  - Typing `int.` (lowercase) auto-uppercases and locks element to Scene Heading in < 100 ms.
  - Auto-suggest offers `DAY / NIGHT / CONTINUOUS / LATER` after ` - ` in scene heading.
  - Enter from Scene → Action; Enter from Action → next Action; Enter from Character → Dialogue; Enter from Dialogue → **Character** (ping-pong).
  - After two turns, third Enter from Dialogue **auto-fills the alternating character name** — writer types 0 letters between lines.
  - Tab in Dialogue → Parenthetical.
  - Full flow (scene + 3 exchanges) takes < 45 s for a touch-typist.
- **Current ROOMS gap**: no `INT./EXT.` auto-detection, no SmartType character autocomplete, no auto-alternating character on Enter, no time-of-day suggestion. Enter-from-Dialogue behavior needs verification.

### Flow 2 — Two writers editing the same page simultaneously

- **Description**: Alice and Bob open the same doc, both start typing in different paragraphs, then Bob selects a line to "point at" it for Alice.
- **Success criteria**:
  - Alice sees Bob's caret as a **colored vertical bar with a name pill above** it (Google Docs pattern), pill fades after 3 s idle, snaps back on move.
  - Bob's **selection is rendered as a translucent colored rectangle** on Alice's screen (30% alpha).
  - Bob's caret position updates on Alice's screen with **≤ 150 ms** p95 latency on a healthy connection.
  - Local keystrokes on Alice's side echo **instantly** (no server round-trip).
  - Cursor broadcasts throttled to ~50 ms to keep bandwidth flat.
- **Current ROOMS gap**: name-label pill needs verification; selection sharing (translucent peer highlight) appears missing; measured p95 cursor latency unknown.

### Flow 3 — Presence: "where is my collaborator right now?"

- **Description**: Alice wants to see who's in the doc and jump to what Bob is currently editing.
- **Success criteria**:
  - **Avatar row** in the header, ring color = caret color, ordered by most-recently-active.
  - Hovering an avatar shows name + editing/viewing + last-active timestamp.
  - **Clicking an avatar scrolls the viewport to that user's caret** in < 300 ms.
  - Overflow beyond 4–5 avatars collapses to a "+N" chip.
- **Current ROOMS gap**: click-to-jump behavior needs verification against current avatar rendering.

### Flow 4 — Adding a comment on a specific line, with a reply

- **Description**: Alice selects a dialogue line, presses a shortcut, writes a comment, `@mentions` Bob. Bob opens the doc, sees a notification, clicks the comment, jumps to the line, and replies.
- **Success criteria**:
  - Shortcut like `Cmd+Option+M` opens a comment composer anchored to the selection.
  - Comment card appears in a **right rail**, anchored to the line, scrolls in sync with the body.
  - When multiple comments cluster, cards **force-directed anti-overlap** with a ~150 ms transform animation; active card sits at its true Y.
  - `@mention` autocompletes from the collaborator list; triggers a notification / badge on the mentioned user's side.
  - Clicking the highlighted range in the body scrolls the card into view; clicking the card scrolls the body to the anchor.
  - Resolve collapses the card into a history drawer.
- **Current ROOMS gap**: `@mention` autocomplete appears missing; comment-card force-directed anti-overlap in the sidebar needs verification; body↔card scroll sync needs verification.

### Flow 5 — Offline drop and reconnection mid-typing

- **Description**: Alice loses WiFi for 30 s while typing dialogue, then reconnects.
- **Success criteria**:
  - Keystrokes **continue against local state** with no visible pause or blocking modal.
  - Header shows a **"Working offline" pill** (icon + tooltip), not a dialog.
  - Bottom-left toast: *"Trying to connect…"* — non-blocking.
  - On reconnect: pill shows spinner + "Saving…" → resolves to "All changes saved" within 2 s.
  - No lost keystrokes; any concurrent-edit conflicts surface as an inline banner offering "See changes".
- **Current ROOMS gap**: `useOfflineMode` exists but the header pill state and non-blocking toast pattern need verification against the GDocs reference.

### Flow 6 — Sharing a script with a producer who doesn't have an account

- **Description**: Alice wants a producer to view (and optionally comment on) her draft without creating a ROOMS account.
- **Success criteria**:
  - ShareModal offers **"Create shareable link"** with three roles: Read-only / Comment / Edit.
  - Link works for **guest access — no account required** to view or comment.
  - Producer opens the link, sees the doc immediately, can add anonymous or named comments.
  - Link can be revoked or role-changed from ShareModal.
- **Current ROOMS gap**: guest / anonymous access flow needs verification; Arc Studio's frictionless guest-link is the reference.

### Flow 7 — FDX round-trip with a Final Draft user

- **Description**: Alice imports a Final Draft .fdx sent by a producer, edits in ROOMS, exports .fdx, sends back. Producer opens in Final Draft.
- **Success criteria**:
  - Import preserves all seven element types (Scene Heading, Action, Character, Parenthetical, Dialogue, Transition, General), plus revisions, title page, character extensions.
  - Export produces a valid FDX (Version 6+) that opens in Final Draft with **zero formatting drift** — same element types, indents, page breaks within ±1 line.
  - SmartType lists (characters, locations, extensions) are preserved on round-trip.
- **Current ROOMS gap**: import exists (`importFDX.js`); export status and round-trip fidelity need verification; SmartType-list preservation is likely missing since ROOMS has no SmartType.

### Flow 8 — Navigating a 120-page script

- **Description**: Alice needs to jump to scene 47 in a 120-page feature.
- **Success criteria**:
  - **Outline sidebar** shows all scenes with heading + optional first-line-of-synopsis, click to jump in < 300 ms.
  - **Find & Replace** with filters (case, whole-word, element type) — current match highlighted, arrow-navigation between matches.
  - **Beat / cards view** as an alternative visual navigation.
  - Scroll to any scene, no perceptible lag from pagination recalc.
- **Current ROOMS gap**: OutlineSidebar + BeatBoard exist; drag-reorder + locking already implemented. Find & Replace via `useSearch` — verify filter coverage vs WriterDuet.

### Flow 9 — Revisions and colored pages for production

- **Description**: The script goes to production. Alice locks the draft as White, then subsequent changes track as Blue, Pink, Yellow per industry convention. Producer prints "Revised Pages Only".
- **Success criteria**:
  - "Lock as White Production Draft" action available.
  - Subsequent edits auto-track under the next revision color (Blue).
  - Revision marks (asterisks in the margin) render on changed lines.
  - PDF export supports **"Revised Pages Only"** mode.
- **Current ROOMS gap**: no colored-page revision cycle today. Arc Studio's Snapshots-as-Revisions is the reference; ROOMS' `HistoryPanel` covers version-history but not the production revision-color workflow.

### Flow 10 — Branch and merge (aspirational)

- **Description**: Alice wants to try a radically different Act 2 without committing. She branches the doc, rewrites, then merges selectively.
- **Success criteria**:
  - "Create Branch Copy" (private or shared) from any point.
  - Edit independently; branch shows in a sidebar list.
  - Merge diff view (Combined or Side-by-Side, green additions / red deletions, filter by author/type, accept/discard per change).
- **Current ROOMS gap**: not implemented; **unique to Arc Studio Pro** among competitors. High-differentiation feature if ROOMS wants to lead.

---

_End of dossier. Update as products ship new features or as ROOMS closes gaps._
