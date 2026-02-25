const FONT_OPTIONS = {
  'courier-prime': { family: "'Courier Prime', 'Courier New', monospace", label: 'Courier Prime' },
  'courier-new': { family: "'Courier New', Courier, monospace", label: 'Courier New' },
  'courier': { family: "Courier, 'Courier New', monospace", label: 'Courier' },
};
const getFontFamily = (key) => FONT_OPTIONS[key]?.family || FONT_OPTIONS['courier-prime'].family;

export { FONT_OPTIONS, getFontFamily };
