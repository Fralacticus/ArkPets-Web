import { Character } from './character';
import { showContextMenu } from './menu';

import '../styles.css';

const arkpets = {
    Character,
    showContextMenu,
};

(window as any).arkpets = arkpets;