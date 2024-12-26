import spine from '../libs/spine-webgl.js';
import webgl = spine.webgl;
import outlineFragmentShader from '../shaders/OutlineFragment.glsl';
import outlineVertexShader from '../shaders/OutlineVertex.glsl';
import { createContextMenu, hideContextMenu, showContextMenu } from './menu';
import { CharacterResource } from './types';

// Core variables
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let shader: webgl.Shader;
let batcher: webgl.PolygonBatcher;
let mvp = new webgl.Matrix4();
let assetManager: webgl.AssetManager;
let skeletonRenderer: webgl.SkeletonRenderer;
let lastFrameTime: number;
let framebuffer: WebGLFramebuffer;
let framebufferTexture: WebGLTexture;
let outlineShader: WebGLProgram;
let quadBuffer: WebGLBuffer;

// Dragging
let isMouseOver = false;
let isDragging = false;
let dragStartRelativeX = 0;
let dragStartRelativeY = 0;
let lastDragEvent: MouseEvent | null = null;

const MOVING_SPEED = 30; // pixels per second

// Physicsal motion
let velocity = { x: 0, y: 0 };
const GRAVITY = 1000; // pixels per second squared
const DRAG = 0.98; // air resistance
const MAX_VELOCITY = 1000; // maximum velocity in pixels per second
const MIN_VELOCITY = 5; // threshold for stopping
const BOUNCE_DAMPING = 0.7; // energy loss on bounce

const RESOURCE_PATH = "/assets/models/";

// Supersampling is necessary for high-res display
const SUPERSAMPLE_FACTOR = 2;

const CHARACTER_RESOURCES: CharacterResource[] = [
    {
        name: "佩佩",
        skeleton: "4058_pepe/build_char_4058_pepe.skel",
        atlas: "4058_pepe/build_char_4058_pepe.atlas",
        texture: "4058_pepe/build_char_4058_pepe.png",
    },
    {
        name: "荒芜拉普兰德",
        skeleton: "1038_whitw2/build_char_1038_whitw2.skel", 
        atlas: "1038_whitw2/build_char_1038_whitw2.atlas",
        texture: "1038_whitw2/build_char_1038_whitw2.png",
    },
];

let characterResource: CharacterResource = CHARACTER_RESOURCES[0];

interface Character {
    skeleton: spine.Skeleton;
    state: spine.AnimationState;
    currentAction: Action;
}

type Direction = "left" | "right";

interface Action {
    animation: string;
    direction: Direction;
}

let character: Character;

let position: {
    x: number;
    y: number;
} = {
    x: 0,
    y: 1e9
};

const ANIMATION_NAMES = ["Relax", "Interact", "Move", "Sit" , "Sleep"];
const ANIMATION_MARKOV = [
    [0.5, 0.0, 0.25, 0.15, 0.1],
    [1.0, 0.0, 0.0, 0.0, 0.0],
    [0.3, 0.0, 0.7, 0.0, 0.0],
    [0.5, 0.0, 0.0, 0.5, 0.0],
    [0.3, 0.0, 0.0, 0.0, 0.7],
]

function setCharacterResource(char: CharacterResource) {
    characterResource = char;
    assetManager.removeAll();
    assetManager.loadBinary(char.skeleton);
    assetManager.loadTextureAtlas(char.atlas);
    requestAnimationFrame(load);
}

function hideCharacter(): void {
    if (canvas) {
        // Fade out animation
        let opacity = 1;
        const fadeInterval = setInterval(() => {
            opacity -= 0.1;
            canvas.style.opacity = opacity.toString();
            
            if (opacity <= 0) {
                clearInterval(fadeInterval);
                canvas.style.display = 'none';
            }
        }, 30);
    }
}

type DragEvent = MouseEvent | TouchEvent;

function init(): void {
    // Setup canvas and WebGL context
    canvas = document.getElementById("arkpets-canvas") as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    
    gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false
    }) as WebGLRenderingContext;

    if (!gl) {
        alert('WebGL is unavailable.');
        return;
    }

    // Set up blending for non-premultiplied alpha
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Initialize framebuffer for 2-pass rendering
    initFramebuffer();

    // Create WebGL objects
    shader = webgl.Shader.newTwoColoredTextured(gl);
    batcher = new webgl.PolygonBatcher(gl);
    skeletonRenderer = new webgl.SkeletonRenderer(new webgl.ManagedWebGLRenderingContext(gl));
    assetManager = new webgl.AssetManager(gl, RESOURCE_PATH);

    // Load assets for initial character
    setCharacterResource(CHARACTER_RESOURCES[0]);

    // Add click event listener to canvas
    canvas.addEventListener('click', handleCanvasClick);

    const contextMenu = createContextMenu(
        CHARACTER_RESOURCES,
        setCharacterResource,
        hideCharacter
    );

    // Handle desktop right click
    canvas.addEventListener('contextmenu', showContextMenu);
    
    // Hide menu when clicking outside
    document.addEventListener('click', hideContextMenu);

    // Mouse events for detecting mouse-over effect
    document.addEventListener('mousemove', handleMouseMove);

    // Mouse events for dragging
    canvas.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events for dragging
    canvas.addEventListener('touchstart', handleDragStart);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('touchend', handleDragEnd);

    window.addEventListener('resize', (e) => {
        if (canvas) {
            // Constrain to window bounds
            const maxLeft = window.innerWidth - canvas.offsetWidth;
            position.x = Math.max(0, Math.min(maxLeft, position.x));
        }
    });
}

function initFramebuffer(): void {
    // Create and bind framebuffer
    framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    // Create and bind texture
    framebufferTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Attach texture to framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, framebufferTexture, 0);

    // Create quad buffer for second pass
    quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  // Bottom left
         1, -1,  // Bottom right
        -1,  1,  // Top left
         1,  1   // Top right
    ]), gl.STATIC_DRAW);

    // Create and compile outline shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, outlineVertexShader);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, outlineFragmentShader);
    gl.compileShader(fragmentShader);

    // Add error checking for vertex shader compilation
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
    }

    // Add error checking for fragment shader compilation
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
    }

    // Create and link program
    outlineShader = gl.createProgram()!;
    gl.attachShader(outlineShader, vertexShader);
    gl.attachShader(outlineShader, fragmentShader);
    gl.linkProgram(outlineShader);

    // Add error checking for program linking
    if (!gl.getProgramParameter(outlineShader, gl.LINK_STATUS)) {
        console.error('Program linking failed:', gl.getProgramInfoLog(outlineShader));
    }
}

function load(): void {
    if (assetManager.isLoadingComplete()) {
        character = loadCharacter(characterResource, 0.3 * 0.75 * SUPERSAMPLE_FACTOR);
        lastFrameTime = Date.now() / 1000;
        
        requestAnimationFrame(render);
    } else {
        console.log("Loading assets of character", characterResource.name, "progress", assetManager.getLoaded(), "/", assetManager.getToLoad());
        requestAnimationFrame(load);
    }
}

function loadCharacter(resource: CharacterResource, scale: number = 1.0): Character {    
    const atlas = assetManager.get(resource.atlas);
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);

    skeletonBinary.scale = scale;
    const skeletonData = skeletonBinary.readSkeletonData(assetManager.get(resource.skeleton));
    const skeleton = new spine.Skeleton(skeletonData);
    const bounds = calculateSetupPoseBounds(skeleton);

    const animationStateData = new spine.AnimationStateData(skeleton.data);

    // Animation transitions
    ANIMATION_NAMES.forEach(fromAnim => {
        ANIMATION_NAMES.forEach(toAnim => {
            if (fromAnim !== toAnim) {
                animationStateData.setMix(fromAnim, toAnim, 0.3);
            }
        });
    });

    const animationState = new spine.AnimationState(animationStateData);
    animationState.setAnimation(0, "Relax", true);

    // Listen for animation completion
    class AnimationStateAdapter extends spine.AnimationStateAdapter {
        complete(entry: spine.TrackEntry): void {
            const action = nextAction(character.currentAction);
            character.currentAction = action;
            console.log("Play action", action)
            animationState.setAnimation(0, action.animation, true);
        }
    }
    animationState.addListener(new AnimationStateAdapter());

    // Get the minimum required width and height based on character bounds
    const minWidth = bounds.size.x * 2;
    const minHeight = bounds.size.y * 1.2;
    
    // Set canvas display size
    canvas.style.width = minWidth / SUPERSAMPLE_FACTOR + "px";
    canvas.style.height = minHeight / SUPERSAMPLE_FACTOR + "px";
    
    // Set canvas internal resolution
    canvas.width = minWidth;
    canvas.height = minHeight;
    
    // Update the projection matrix to match the new resolution
    mvp.ortho2d(0, 0, canvas.width, canvas.height);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Scale up the skeleton position to match the higher resolution
    skeleton.x = canvas.width / 2;
    skeleton.y = 0;

    // Update framebuffer texture size
    gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    return {
        skeleton,
        state: animationState,
        currentAction: {
            animation: "Relax",
            direction: "right",
        }
    };
}

function calculateSetupPoseBounds(skeleton: spine.Skeleton) {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new spine.Vector2();
    const size = new spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
}

// Mouse position (client, no transform, no supersampling)
let currentMousePos = { x: 0, y: 0 };

function handleMouseMove(event: MouseEvent): void {
    currentMousePos.x = event.clientX;
    currentMousePos.y = event.clientY;
}

function render(): void {
    const now = Date.now() / 1000;
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    // Apply physics when not dragging
    if (!isDragging) {
        // Apply gravity
        velocity.y += GRAVITY * delta;
        
        // Apply drag
        velocity.x *= DRAG;
        velocity.y *= DRAG;
        if (Math.abs(velocity.x) < MIN_VELOCITY) {
            velocity.x = 0;
        }
        if (Math.abs(velocity.y) < MIN_VELOCITY) {
            velocity.y = 0;
        }
        
        // Clamp velocities
        velocity.x = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.x));
        velocity.y = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity.y));
        
        // Update position
        position.x += velocity.x * delta;
        position.y += velocity.y * delta;
        
        // Window bounds collision
        const maxX = window.innerWidth - canvas.offsetWidth;
        const maxY = window.innerHeight - canvas.offsetHeight;
        
        // Bounce off walls
        if (position.x < 0) {
            position.x = 0;
            velocity.x = -velocity.x * BOUNCE_DAMPING;
        } else if (position.x > maxX) {
            position.x = maxX;
            velocity.x = -velocity.x * BOUNCE_DAMPING;
        }
        
        // Bounce off floor/ceiling
        if (position.y < 0) {
            position.y = 0;
            velocity.y = 0;
        } else if (position.y > maxY) {
            position.y = maxY;
            velocity.y = 0;
        }
    }

    // Move the canvas when "Move" animation is playing
    if (character.currentAction.animation === "Move" && !isDragging) {
        const movement = MOVING_SPEED * delta;
        if (character.currentAction.direction === "left") {
            position.x = Math.max(0, position.x - movement);
            // Turn around when reaching left edge
            if (position.x <= 0) {
                position.x = 0;
                character.currentAction.direction = "right";
            }
        } else {
            position.x = position.x + movement;
            // Turn around when reaching right edge
            if (position.x >= window.innerWidth - canvas.width) {
                position.x = window.innerWidth - canvas.width;
                character.currentAction.direction = "left";
            }
        }
    }

    // Update canvas position to `position`
    canvas.style.left = position.x + "px";
    canvas.style.top = position.y + "px";

    // 1st pass - render Spine character to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    character.skeleton.scaleX = character.currentAction.direction === "left" ? -1 : 1;

    character.state.update(delta);
    character.state.apply(character.skeleton);
    character.skeleton.updateWorldTransform();

    shader.bind();
    shader.setUniformi(webgl.Shader.SAMPLER, 0);
    shader.setUniform4x4f(webgl.Shader.MVP_MATRIX, mvp.values);

    batcher.begin(shader);
    skeletonRenderer.premultipliedAlpha = false;
    skeletonRenderer.draw(batcher, character.skeleton);
    batcher.end();

    shader.unbind();

    // Read pixels before 2nd pass to determine if mouse is over character
    const canvasRect = canvas.getBoundingClientRect();
    let pixelX = (currentMousePos.x - canvasRect.x) * SUPERSAMPLE_FACTOR;
    let pixelY = canvas.height - (currentMousePos.y - canvasRect.y) * SUPERSAMPLE_FACTOR;
    let pixelColor = new Uint8Array(4);
    gl.readPixels(
        pixelX, 
        pixelY, 
        1, 1, 
        gl.RGBA, 
        gl.UNSIGNED_BYTE, 
        pixelColor
    );
    isMouseOver = pixelColor[0] !== 0 || pixelColor[1] !== 0 || pixelColor[2] !== 0 || isDragging;
    if (isMouseOver) {
        canvas.style.pointerEvents = 'auto';
    } else {
        // Disable any mouse interaction so that the webpage content can be selected
        canvas.style.pointerEvents = 'none';
    }

    // 2nd pass - render to screen with outline effect
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(outlineShader);

    // Set uniforms
    const uTexture = gl.getUniformLocation(outlineShader, "u_texture");
    const uOutlineColor = gl.getUniformLocation(outlineShader, "u_outlineColor");
    const uOutlineWidth = gl.getUniformLocation(outlineShader, "u_outlineWidth");
    const uTextureSize = gl.getUniformLocation(outlineShader, "u_textureSize");
    const uAlpha = gl.getUniformLocation(outlineShader, "u_alpha");

    gl.uniform1i(uTexture, 0); // Use texture unit 0 for spine character
    gl.uniform4f(uOutlineColor, 1.0, 1.0, 0.0, 1.0); // yellow
    gl.uniform1f(uOutlineWidth, isMouseOver ? 2.0 : 0.0); // Show outline when mouse is over
    gl.uniform2i(uTextureSize, canvas.width, canvas.height);
    gl.uniform1f(uAlpha, 1.0);

    // Bind framebuffer texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);

    // Draw quad to canvas
    const aPosition = gl.getAttribLocation(outlineShader, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
}

function randomPick(probabilities: number[]): number {
    let random = Math.random();
    let cumulativeProb = 0;
    for (let i = 0; i < probabilities.length; i++) {
        cumulativeProb += probabilities[i];
        if (random <= cumulativeProb) {
            return i;
        }
    }
    throw new Error("Invalid probabilities: " + probabilities);
}

function turnDirection(current: Direction): Direction {
    return current === "left" ? "right" : "left";
}

function nextAction(current: Action): Action {
    const animeIndex = ANIMATION_NAMES.indexOf(current.animation);
    const nextIndexProb = ANIMATION_MARKOV[animeIndex];
    const nextAnimIndex = randomPick(nextIndexProb);
    const nextAnim = ANIMATION_NAMES[nextAnimIndex];

    let nextDirection = current.direction;
    if (current.animation === "Relax" && nextAnim === "Move") {
        nextDirection = Math.random() < 0.4 ? turnDirection(current.direction) : current.direction;
    }
    return {
        animation: nextAnim,
        direction: nextDirection
    };
}

function handleCanvasClick(): void {
    if (character && character.state) {
        character.currentAction = {
            animation: "Interact",
            direction: character.currentAction.direction
        };
        character.state.setAnimation(0, "Interact", false);
        console.log("Play action", character.currentAction);
    }
}


function handleDragStart(e: DragEvent): void {
    if ((e as MouseEvent).button === undefined || (e as MouseEvent).button === 0) {
        isDragging = true;
        
        // Get coordinates regardless of event type
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        dragStartRelativeX = clientX - position.x;
        dragStartRelativeY = clientY - position.y;
        
        // Pause any current animation
        if (character && character.state) {
            character.state.setAnimation(0, "Relax", true);
            character.currentAction = {
                animation: "Relax",
                direction: character.currentAction.direction
            };
        }
    }
}

function handleDrag(e: DragEvent): void {
    if (isDragging) {
        // Get coordinates regardless of event type
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        
        const oldX = position.x;
        const oldY = position.y;
        
        // Update position
        const newX = clientX - dragStartRelativeX;
        const newY = clientY - dragStartRelativeY;
        
        // Calculate velocity based on time between events
        if (lastDragEvent) {
            const dt = (e.timeStamp - lastDragEvent.timeStamp) / 1000;
            if (dt > 0) {
                velocity.x = (newX - oldX) / dt;
                velocity.y = (newY - oldY) / dt;
            }
        }
        
        // Update position
        position.x = newX;
        position.y = newY;
        
        // Update canvas position
        canvas.style.left = position.x + 'px';
        canvas.style.top = position.y + 'px';
        
        lastDragEvent = e as MouseEvent;
        
        // Prevent scrolling on mobile
        if ('touches' in e) {
            e.preventDefault();
        }
    }
}

function handleDragEnd(): void {
    isDragging = false;
    lastDragEvent = null;
}

window.addEventListener('load', init); 