const SP_NEXT_TYPE = { scene: 'action', action: 'action', character: 'dialogue', dialogue: 'character', parenthetical: 'dialogue', transition: 'scene' };
const SP_EMPTY_ENTER = (t) => (t === 'action' ? null : 'action');
const SP_TAB_FWD = { scene: 'action', action: 'character', character: 'parenthetical', parenthetical: 'dialogue', dialogue: 'transition', transition: 'scene' };
const SP_TAB_REV = { scene: 'transition', transition: 'dialogue', dialogue: 'parenthetical', parenthetical: 'character', character: 'action', action: 'scene' };

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
const LINES_PER_PAGE = 63; // A4 content area: 297mm - 13mm top margin - 15mm bottom margin = 269mm ÷ 4.23mm/line ≈ 63

export { SP_NEXT_TYPE, SP_EMPTY_ENTER, SP_TAB_FWD, SP_TAB_REV, ELEMENT_TYPES, TYPE_TO_FDX, FDX_TO_TYPE, LINES_PER_PAGE };
