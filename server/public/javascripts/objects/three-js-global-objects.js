// The global objects from POINTERLOCK were moved here so they
//  can be safely imported without creating circular references
//  between modules.

let g_ThreeJsCamera, g_ThreeJsScene, g_ThreeJsRenderer, g_ThreeJsControls, g_ThreeJsRaycaster;

let g_ThreeJsObjects = [];

// The following "assign" functions are there so external modules
//  can sidestep Javascripts immutable exported module variables
//  mandate and make assignments to the global ThreeJS variables
//  we contain.
function assignThreeJsCamera(camera) {
  g_ThreeJsCamera = camera;
}

function assignThreeJsObjects(objects) {
  g_ThreeJsObjects = objects;
}

function assignThreeJsScene(scene) {
  g_ThreeJsScene = scene;
}

function assignThreeJsRenderer(renderer) {
  g_ThreeJsRenderer = renderer;
}

function assignThreeJsControls(controls) {
  g_ThreeJsControls = controls;
}

function assignThreeJsRaycaster(raycaster) {
  g_ThreeJsRaycaster = raycaster;
}

export {
    g_ThreeJsCamera,
    g_ThreeJsControls,
    g_ThreeJsObjects,
    g_ThreeJsRaycaster,
    g_ThreeJsRenderer,
    g_ThreeJsScene,
    assignThreeJsCamera,
    assignThreeJsControls,
    // assignThreeJsObjects,
    assignThreeJsRaycaster,
    assignThreeJsRenderer,
    assignThreeJsScene
};

