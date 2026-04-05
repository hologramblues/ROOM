// ============ FINAL DRAFT TYPING FLOW ============
// Enter: what element type is created after the current one
const SP_NEXT_TYPE = {
  scene: 'action',           // Scene Heading → Action
  action: 'action',          // Action → Action
  character: 'dialogue',     // Character → Dialogue
  dialogue: 'action',        // Dialogue → Action (Tab to get Character)
  parenthetical: 'dialogue', // Parenthetical → Dialogue
  transition: 'action',      // Transition → Action (was 'scene' — FD creates Action)
};

// Enter on empty element: convert to this type, or null = create new action below
const SP_EMPTY_ENTER = (t) => (t === 'action' ? null : 'action');

// Tab forward cycling (Final Draft standard)
// In Dialogue/Parenthetical: Tab toggles between them (handled in ScreenplayElement.js)
// For all others: this is the cycle
const SP_TAB_FWD = {
  scene: 'action',           // Scene → Action
  action: 'character',       // Action → Character
  character: 'dialogue',     // Character → Dialogue (was 'parenthetical')
  parenthetical: 'dialogue', // Parenthetical → Dialogue (toggle)
  dialogue: 'parenthetical', // Dialogue → Parenthetical (toggle)
  transition: 'scene',       // Transition → Scene
};

// Shift-Tab reverse cycling
const SP_TAB_REV = {
  scene: 'transition',
  transition: 'dialogue',
  dialogue: 'parenthetical', // toggle
  parenthetical: 'dialogue', // toggle
  character: 'action',
  action: 'scene',
};

const ELEMENT_TYPES = [
  { id: 'scene', label: 'Séquence', shortcut: '1' },
  { id: 'action', label: 'Action', shortcut: '2' },
  { id: 'character', label: 'Personnage', shortcut: '3' },
  { id: 'dialogue', label: 'Dialogue', shortcut: '4' },
  { id: 'parenthetical', label: 'Didascalie', shortcut: '5' },
  { id: 'transition', label: 'Transition', shortcut: '6' },
];

const TYPE_TO_FDX = { scene: 'Scene Heading', action: 'Action', character: 'Character', dialogue: 'Dialogue', parenthetical: 'Parenthetical', transition: 'Transition' };
const FDX_TO_TYPE = { 'Scene Heading': 'scene', 'Action': 'action', 'Character': 'character', 'Dialogue': 'dialogue', 'Parenthetical': 'parenthetical', 'Transition': 'transition', 'General': 'action' };

// Page format presets
const PAGE_FORMATS = {
  'us-letter': {
    label: 'US Letter',
    width: '215.9mm',
    height: '279.4mm',
    padding: '25.4mm 25.4mm 25.4mm 38.1mm', // 1" top/bottom/right, 1.5" left
    linesPerPage: 55,
    contentWidthMm: 152.4, // 215.9 - 38.1 - 25.4
    // Chars per line (Courier 12pt, 1 char ≈ 2.54mm)
    cpl: { scene: 60, action: 60, character: 38, dialogue: 37, parenthetical: 25, transition: 60 },
  },
  'a4': {
    label: 'A4',
    width: '210mm',
    height: '297mm',
    padding: '20mm 25mm 25mm 38mm',
    linesPerPage: 63,
    contentWidthMm: 147, // 210 - 38 - 25
    cpl: { scene: 58, action: 58, character: 36, dialogue: 36, parenthetical: 24, transition: 58 },
  },
};

export { SP_NEXT_TYPE, SP_EMPTY_ENTER, SP_TAB_FWD, SP_TAB_REV, ELEMENT_TYPES, TYPE_TO_FDX, FDX_TO_TYPE, PAGE_FORMATS };
