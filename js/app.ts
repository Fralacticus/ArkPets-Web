import spine from '../libs/spine-webgl.js';
import webgl = spine.webgl;

// Core variables
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let shader: webgl.Shader;
let batcher: webgl.PolygonBatcher;
let mvp = new webgl.Matrix4();
let assetManager: webgl.AssetManager;
let skeletonRenderer: webgl.SkeletonRenderer;
let lastFrameTime: number;

interface Character {
    skeleton: spine.Skeleton;
    state: spine.AnimationState;
    bounds: {
        offset: spine.Vector2;
        size: spine.Vector2;
    };
    currentAction: Action;
}

type Direction = "left" | "right";

interface Action {
    animation: string;
    direction: Direction;
}

let character: Character;

const ANIMATION_NAMES = ["Relax", "Interact", "Move", "Sit" , "Sleep"];
const ANIMATION_MARKOV = [
    [0.5, 0.1, 0.2, 0.1, 0.1],
    [1.0, 0.0, 0.0, 0.0, 0.0],
    [0.3, 0.0, 0.7, 0.0, 0.0],
    [0.5, 0.0, 0.0, 0.5, 0.0],
    [0.3, 0.0, 0.0, 0.0, 0.7],
]

function init(): void {
    // Setup canvas and WebGL context
    canvas = document.getElementById("canvas") as HTMLCanvasElement;

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

    // Create WebGL objects
    shader = webgl.Shader.newTwoColoredTextured(gl);
    batcher = new webgl.PolygonBatcher(gl);
    skeletonRenderer = new webgl.SkeletonRenderer(new webgl.ManagedWebGLRenderingContext(gl));
    assetManager = new webgl.AssetManager(gl);

    // Load assets
    assetManager.loadBinary("assets/models/4058_pepe/build_char_4058_pepe.skel");
    assetManager.loadTextureAtlas("assets/models/4058_pepe/build_char_4058_pepe.atlas");

    requestAnimationFrame(load);
}

function load(): void {
    if (assetManager.isLoadingComplete()) {
        character = loadCharacter();
        lastFrameTime = Date.now() / 1000;
        
        resize();

        requestAnimationFrame(render);
    } else {
        requestAnimationFrame(load);
    }
}

function loadCharacter(): Character {
    const atlas = assetManager.get("assets/models/4058_pepe/build_char_4058_pepe.atlas");
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);

    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(assetManager.get("assets/models/4058_pepe/build_char_4058_pepe.skel"));
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

    return {
        skeleton,
        state: animationState,
        bounds,
        currentAction: {
            animation: "Relax",
            direction: "right",
        },
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

function render(): void {
    const now = Date.now() / 1000;
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const state = character.state;
    const skeleton = character.skeleton;
    
    // Set the scale based on direction
    skeleton.scaleX = character.currentAction.direction === "left" ? -1 : 1;
    
    // Move the canvas when "Move" animation is playing
    if (character.currentAction.animation === "Move") {
        const moveSpeed = 100; // pixels per second
        const movement = moveSpeed * delta;
        if (character.currentAction.direction === "left") {
            canvas.style.left = (parseFloat(canvas.style.left || "0") - movement) + "px";
            // Turn around when reaching left edge
            if (parseFloat(canvas.style.left) <= 0) {
                canvas.style.left = "0px";
                character.currentAction.direction = "right";
            }
        } else {
            canvas.style.left = (parseFloat(canvas.style.left || "0") + movement) + "px";
            // Turn around when reaching right edge
            if (parseFloat(canvas.style.left) + canvas.width >= window.innerWidth) {
                character.currentAction.direction = "left";
            }
        }
    }
    
    state.update(delta);
    state.apply(skeleton);
    skeleton.updateWorldTransform();

    shader.bind();
    shader.setUniformi(webgl.Shader.SAMPLER, 0);
    shader.setUniform4x4f(webgl.Shader.MVP_MATRIX, mvp.values);

    batcher.begin(shader);
    skeletonRenderer.premultipliedAlpha = false;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();

    shader.unbind();

    requestAnimationFrame(render);
}

function resize(): void {
    // Get the minimum required width and height based on character bounds
    const minWidth = character.bounds.size.x * 2;
    const minHeight = character.bounds.size.y * 1.2;

    // Set canvas size to the larger of window size or minimum required size
    canvas.width = minWidth;
    canvas.height = minHeight;
    
    // Center the character in the canvas
    mvp.ortho2d(0, 0, canvas.width, canvas.height);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Position the skeleton at the center of the canvas
    character.skeleton.x = canvas.width / 2;
    character.skeleton.y = 0;
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

window.addEventListener('load', init); 