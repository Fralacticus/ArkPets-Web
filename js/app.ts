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
    premultipliedAlpha: boolean;
}

let character: Character;

function init(): void {
    // Setup canvas and WebGL context
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl = canvas.getContext("webgl", { alpha: false }) as WebGLRenderingContext;
    
    if (!gl) {
        alert('WebGL is unavailable.');
        return;
    }

    // Create WebGL objects
    shader = webgl.Shader.newTwoColoredTextured(gl);
    batcher = new webgl.PolygonBatcher(gl);
    mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
    skeletonRenderer = new webgl.SkeletonRenderer(gl as any);
    assetManager = new webgl.AssetManager(gl);

    // Load assets
    assetManager.loadBinary("assets/models/4058_pepe/build_char_4058_pepe.skel");
    assetManager.loadTextureAtlas("assets/models/4058_pepe/build_char_4058_pepe.atlas");
    
    requestAnimationFrame(load);
}

function load(): void {
    if (assetManager.isLoadingComplete()) {
        character = loadCharacter("Sit", false);
        lastFrameTime = Date.now() / 1000;
        requestAnimationFrame(render);
    } else {
        requestAnimationFrame(load);
    }
}

function loadCharacter(initialAnimation: string, premultipliedAlpha: boolean): Character {
    const atlas = assetManager.get("assets/models/4058_pepe/build_char_4058_pepe.atlas");
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new spine.SkeletonBinary(atlasLoader);
    
    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(assetManager.get("assets/models/4058_pepe/build_char_4058_pepe.skel"));
    const skeleton = new spine.Skeleton(skeletonData);
    const bounds = calculateSetupPoseBounds(skeleton);

    const animationStateData = new spine.AnimationStateData(skeleton.data);
    const animationState = new spine.AnimationState(animationStateData);
    animationState.setAnimation(0, initialAnimation, true);

    return { 
        skeleton, 
        state: animationState, 
        bounds, 
        premultipliedAlpha 
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

    gl.clearColor(0.3, 0.3, 0.3, 1);
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
    skeletonRenderer.premultipliedAlpha = character.premultipliedAlpha;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();

    shader.unbind();

    requestAnimationFrame(render);
}

function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width != w || canvas.height != h) {
        canvas.width = w;
        canvas.height = h;
    }

    // Keep original scale (1:1 pixel ratio)
    const bounds = character.bounds;
    
    // Center the character in the canvas
    mvp.ortho2d(0, 0, canvas.width, canvas.height);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Position the skeleton at the center of the canvas
    character.skeleton.x = canvas.width / 2;
    character.skeleton.y = 0;
}

window.addEventListener('load', init); 