const IS_DESKTOP = !!(window.electronAPI?.isDesktop);
let SERVER_URL = 'https://room-production-19a5.up.railway.app';
const CLOUD_URL = 'https://room-production-19a5.up.railway.app';

// Feature flags
const ENABLE_BEATBOARD = false; // Disabled: focus on text editor stability first

export { IS_DESKTOP, SERVER_URL, CLOUD_URL, ENABLE_BEATBOARD };
