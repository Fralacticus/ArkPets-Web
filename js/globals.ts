import { Character } from './character';
import { createContextMenu, hideContextMenu, showContextMenu } from './menu';

const arkpets = {
    Character,
    createContextMenu,
    hideContextMenu,
    showContextMenu,
};

(window as any).arkpets = arkpets;