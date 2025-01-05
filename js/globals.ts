import { Character } from './character';
import { showContextMenu } from './menu';
import type { CharacterModel } from './types';

// Export everything from a single entry point
export {
    Character,
    showContextMenu,
    CharacterModel,
};

// For UMD bundle
const arkpets = {
    Character,
    showContextMenu,
};

export default arkpets;