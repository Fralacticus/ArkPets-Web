import { CharacterResource } from './types';

// Singleton
let menu: HTMLElement;

// The canvas id of the character that the menu is currently clicked on
let canvasId: string;

interface MenuItemStyle {
    padding: string;
    cursor: string;
}

export function createContextMenu(
    characterResources: CharacterResource[],
    onCharacterSelect: (canvasId: string, char: CharacterResource) => void,
    onHideCharacter: (canvasId: string) => void
): HTMLElement {
    menu = document.createElement('div');
    
    menu.id = 'arkpets-menu';
    menu.style.display = 'none';
    menu.style.position = 'fixed';
    menu.style.zIndex = '1000';
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #ccc';
    menu.style.padding = '5px 0';
    menu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
    menu.style.fontSize = '14px';
    
    const applyMenuItemStyles = (element: HTMLElement) => {
        // Add hover styles to menu items
        const menuItemStyle: MenuItemStyle = {
            padding: '5px 20px',
            cursor: 'pointer',
        };
        Object.assign(element.style, menuItemStyle);
        const originalMouseover = element.onmouseover;
        const originalMouseout = element.onmouseout;
        element.onmouseover = (e) => {
            element.style.backgroundColor = '#f0f0f0';
            if (originalMouseover) originalMouseover.call(element, e);
        };
        element.onmouseout = (e) => {
            element.style.backgroundColor = 'white';
            if (originalMouseout) originalMouseout.call(element, e);
        };
    };
    

    if (characterResources.length > 0) {
        // Create Characters submenu if provided
        const charactersMenu = document.createElement('div');
        charactersMenu.className = 'arkpets-menu-item';
        charactersMenu.innerHTML = 'Characters ▶';
        charactersMenu.style.padding = '5px 20px';
        charactersMenu.style.cursor = 'pointer';
        
        const charactersList = document.createElement('div');
        charactersList.className = 'submenu';
        charactersList.style.display = 'none';
        charactersList.style.position = 'absolute';
        charactersList.style.left = '100%';
        charactersList.style.top = '0';
        charactersList.style.backgroundColor = 'white';
        charactersList.style.border = '1px solid #ccc';
        charactersList.style.padding = '5px 0';
        charactersList.style.minWidth = '150px';
        
        // Apply to character list items
        characterResources.forEach(char => {
            const item = document.createElement('div');
            item.innerHTML = char.name;
            applyMenuItemStyles(item);
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

    // Create About menu item
    const aboutMenu = document.createElement('div');
    aboutMenu.className = 'arkpets-menu-item';
    aboutMenu.innerHTML = 'About';
    aboutMenu.style.padding = '5px 20px';
    aboutMenu.style.cursor = 'pointer';
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

    // Temporarily make menu visible but transparent to measure dimensions
    menu.style.opacity = '0';
    menu.style.display = 'block';
    const { innerWidth, innerHeight } = window;
    const { offsetWidth, offsetHeight } = menu;
    
    // Get coordinates based on event type
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
