import { Character } from './character';
import { CharacterModel } from './types';

function positionElement(element: HTMLElement, x: number, y: number, parentRect?: DOMRect): void {
    const { innerWidth, innerHeight } = window;
    const { offsetWidth, offsetHeight } = element;
    
    // Calculate position, ensuring the element stays within the window
    let left = x;
    const top = Math.min(y, innerHeight - offsetHeight - 1);

    // For submenus, check if there's space on the right side
    if (parentRect) {
        // If not enough space on the right, show on the left side
        if (x + offsetWidth > innerWidth - 1) {
            left = parentRect.left - offsetWidth;
        }
    } else {
        // For main menu, just ensure it's within bounds
        left = Math.min(x, innerWidth - offsetWidth - 1);
    }
    
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
}

function createCharactersSubmenu(character: Character, models: CharacterModel[]): HTMLElement {
    const charactersList = document.createElement('div');
    charactersList.className = 'arkpets-submenu';
    
    models.forEach(char => {
        const item = document.createElement('div');
        item.innerHTML = char.name;
        item.classList.add('arkpets-menu-item');
        item.onclick = () => {
            removeMenu();
            character.loadCharacterModel(char);
        };
        charactersList.appendChild(item);
    });

    return charactersList;
}

function createActionsSubmenu(character: Character): HTMLElement {
    const actionsList = document.createElement('div');
    actionsList.className = 'arkpets-submenu';
    
    character.getAnimationNames().forEach(animation => {
        const item = document.createElement('div');
        item.innerHTML = animation;
        item.classList.add('arkpets-menu-item');
        item.onclick = () => {
            removeMenu();
            character.playAnimation(animation);
        };
        actionsList.appendChild(item);
    });

    return actionsList;
}

export function showContextMenu(e: MouseEvent | TouchEvent, character: Character, models?: CharacterModel[]): void {
    e.preventDefault();
    
    // Remove existing menu if it exists
    if (document.getElementById('arkpets-menu')) {
        removeMenu();
    }

    const menu = document.createElement('div');
    menu.id = 'arkpets-menu';
    
    const applyMenuItemStyles = (element: HTMLElement) => {
        element.classList.add('arkpets-menu-item');
    };

    // Add Characters submenu if there are characters
    if (models && models.length > 0) {
        const charactersMenu = document.createElement('div');
        charactersMenu.className = 'arkpets-menu-item';
        charactersMenu.innerHTML = 'Characters ▶';
        
        let charactersList: HTMLElement | null = null;
        charactersMenu.onmouseover = () => {
            if (!charactersList) {
                charactersList = createCharactersSubmenu(character, models);
                charactersMenu.appendChild(charactersList);
                // Position submenu relative to its parent
                const rect = charactersMenu.getBoundingClientRect();
                positionElement(charactersList, rect.right, rect.top, rect);
            }
            charactersList.style.display = 'block';
        };
        charactersMenu.onmouseout = () => {
            if (charactersList) {
                charactersList.style.display = 'none';
            }
        };
        
        applyMenuItemStyles(charactersMenu);
        menu.appendChild(charactersMenu);
    }

    // Create Actions menu item
    const actionsMenu = document.createElement('div');
    actionsMenu.className = 'arkpets-menu-item';
    actionsMenu.innerHTML = 'Actions ▶';
    
    let actionsList: HTMLElement | null = null;
    actionsMenu.onmouseover = () => {
        if (!actionsList) {
            actionsList = createActionsSubmenu(character);
            actionsMenu.appendChild(actionsList);
            // Position submenu relative to its parent
            const rect = actionsMenu.getBoundingClientRect();
            positionElement(actionsList, rect.right, rect.top, rect);
        }
        actionsList.style.display = 'block';
    };
    actionsMenu.onmouseout = () => {
        if (actionsList) {
            actionsList.style.display = 'none';
        }
    };
    
    applyMenuItemStyles(actionsMenu);
    menu.appendChild(actionsMenu);

    // Add Hide menu item
    const hideMenu = document.createElement('div');
    hideMenu.className = 'arkpets-menu-item';
    hideMenu.innerHTML = 'Hide';
    hideMenu.onclick = () => {
        removeMenu();
        character.fadeOut().then(() => {
            character.destroy();
        });
    };
    applyMenuItemStyles(hideMenu);
    
    // Add About menu item
    const aboutMenu = document.createElement('div');
    aboutMenu.className = 'arkpets-menu-item';
    aboutMenu.innerHTML = 'About';
    aboutMenu.onclick = () => {
        removeMenu();
        window.open('https://github.com/fuyufjh/ArkPets-Web/', '_blank');
    };
    applyMenuItemStyles(aboutMenu);
    
    menu.appendChild(hideMenu);
    menu.appendChild(aboutMenu);
    
    // Position the main menu at click/touch position
    const pageX = 'touches' in e ? e.touches[0].pageX : (e as MouseEvent).pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : (e as MouseEvent).pageY;
    
    document.body.appendChild(menu);
    positionElement(menu, pageX, pageY);

    // Remove menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node)) {
            removeMenu();
            document.removeEventListener('click', handleClickOutside);
        }
    };
    
    // Delay adding the click listener to prevent immediate removal
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 0);
}

function removeMenu(): void {
    const menu = document.getElementById('arkpets-menu');
    if (menu) {
        menu.remove();
    }
}
