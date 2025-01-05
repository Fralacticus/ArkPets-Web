import { CharacterModel } from './types';

// Singleton
let menu: HTMLElement;

// The canvas id of the character that the menu is currently clicked on
let canvasId: string;

interface MenuItemStyle {
    padding: string;
    cursor: string;
}

interface MenuCallbacks {
    getCharacterResources: () => CharacterModel[];
    onCharacterSelect: (char: CharacterModel) => void;
    getAnimationNames: () => string[];
    onHideCharacter: () => void;
    onPlayAnimation: (animation: string) => void;
}

// TODO: use the character's animation names
const ANIMATION_NAMES = ["Relax", "Interact", "Move", "Sit" , "Sleep"];

export function createContextMenu(
    characterResources: CharacterModel[],
    onCharacterSelect: (canvasId: string, char: CharacterModel) => void,
    onHideCharacter: (canvasId: string) => void,
    onPlayAnimation: (canvasId: string, animation: string) => void
): HTMLElement {
    menu = document.createElement('div');
    menu.id = 'arkpets-menu';
    
    const applyMenuItemStyles = (element: HTMLElement) => {
        element.classList.add('arkpets-menu-item');
    };

    if (characterResources.length > 0) {
        const charactersMenu = document.createElement('div');
        charactersMenu.className = 'arkpets-menu-item';
        charactersMenu.innerHTML = 'Characters ▶';
        
        const charactersList = document.createElement('div');
        charactersList.className = 'arkpets-submenu';
        
        // Apply to character list items
        characterResources.forEach(char => {
            const item = document.createElement('div');
            item.innerHTML = char.name;
            item.classList.add('arkpets-menu-item');
            item.onclick = () => {
                menu.style.display = 'none';
                onCharacterSelect(canvasId, char);
            };
            charactersList.appendChild(item);
        });
        
        charactersMenu.appendChild(charactersList);
        charactersMenu.onmouseover = () => charactersList.style.display = 'block';
        charactersMenu.onmouseout = () => charactersList.style.display = 'none';
        
        applyMenuItemStyles(charactersMenu);
        menu.appendChild(charactersMenu);
    }

    // Create Actions submenu
    const actionsMenu = document.createElement('div');
    actionsMenu.className = 'arkpets-menu-item';
    actionsMenu.innerHTML = 'Actions ▶';
    
    const actionsList = document.createElement('div');
    actionsList.className = 'arkpets-submenu';
    
    // Add animation options
    ANIMATION_NAMES.forEach(animation => {
        const item = document.createElement('div');
        item.innerHTML = animation;
        item.classList.add('arkpets-menu-item');
        item.onclick = () => {
            menu.style.display = 'none';
            onPlayAnimation(canvasId, animation);
        };
        actionsList.appendChild(item);
    });
    
    actionsMenu.appendChild(actionsList);
    actionsMenu.onmouseover = () => actionsList.style.display = 'block';
    actionsMenu.onmouseout = () => actionsList.style.display = 'none';
    
    applyMenuItemStyles(actionsMenu);
    menu.appendChild(actionsMenu);

    // Create About menu item
    const aboutMenu = document.createElement('div');
    aboutMenu.className = 'arkpets-menu-item';
    aboutMenu.innerHTML = 'About';
    aboutMenu.onclick = () => {
        menu.style.display = 'none';
        window.open('https://github.com/fuyufjh/ArkPets-Web/', '_blank');
    };
    applyMenuItemStyles(aboutMenu);

    // Create Hide menu item
    const hideMenu = document.createElement('div');
    hideMenu.className = 'arkpets-menu-item';
    hideMenu.innerHTML = 'Hide';
    hideMenu.onclick = () => {
        menu.style.display = 'none';
        onHideCharacter(canvasId);
    };
    applyMenuItemStyles(hideMenu);
    
    menu.appendChild(hideMenu);
    menu.appendChild(aboutMenu);
    
    document.body.appendChild(menu);

    // Hide the menu when clicking anywhere on the page
    document.addEventListener('click', hideContextMenu);

    return menu;
} 

export function showContextMenu(e: MouseEvent | TouchEvent): void {
    e.preventDefault();

    // Only position-related styles remain inline since they're dynamic
    menu.style.opacity = '0';
    menu.style.display = 'block';
    const { innerWidth, innerHeight } = window;
    const { offsetWidth, offsetHeight } = menu;
    
    const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : (e as MouseEvent).pageY;
    
    menu.style.left = Math.min(pageX, innerWidth - offsetWidth) + 'px';
    menu.style.top = Math.min(pageY, innerHeight - offsetHeight) + 'px';
    menu.style.opacity = '1';

    canvasId = (e.currentTarget as HTMLCanvasElement).id;
}

export function hideContextMenu(): void {
    menu.style.display = 'none';
}
