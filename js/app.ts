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
}

let character: Character;

const ANIMATION_NAMES = ["Relax", "Interact", "Move", "Sit" /*, "Sleep" */];

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
            const nextAnim = nextRandomAnimation(entry.animation.name);
            animationState.setAnimation(0, nextAnim, true);
        }
    }
    animationState.addListener(new AnimationStateAdapter());

    return {
        skeleton,
        state: animationState,
        bounds,
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

    resize();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const state = character.state;
    const skeleton = character.skeleton;
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
    const minWidth = character.bounds.size.x * 1.5;
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

function nextRandomAnimation(current?: string): string {
    const availableAnimations = current 
        ? ANIMATION_NAMES.filter(name => name !== current)
        : ANIMATION_NAMES;
    const randomIndex = Math.floor(Math.random() * availableAnimations.length);
    return availableAnimations[randomIndex];
}

window.addEventListener('load', init); 