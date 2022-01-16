// The global objects from POINTERLOCK were moved here so they
//  can be safely imported without creating circular references
//  between modules.
import * as THREE from '../threejs/build/three.module.js';
import {ParticipantWrapper} from "../participant-helpers/participant-helper-objects.js";
import {PointerLockControls} from "../threejs/examples/jsm/controls/PointerLockControls.js";

// There will be one animation mixer for ever GLTF and perhaps
//  other 3D models we loaded.
let g_AnimationMixers = {};

// Each action we play will be added here too.
let g_ClipActions = {};

let g_ThreeJsCamera, g_ThreeJsScene, g_ThreeJsRenderer, g_ThreeJsControls, g_ThreeJsRaycaster;

// A ThreeJS clock.
let g_ThreeJsClock = new THREE.Clock();

// The animate loop will update this list of ThreeJS objects.  The objects
//  contained are all the ThreeJS avatar objects for each current participant.
let g_ThreeJsAvatarObjectsInScene = [];

// The animate loop will update this list of Participant objects.  The objects
//  contained are all the ThreeJS avatar objects for each participant.
let g_ParticipantWrapperObjsInScene = [];

// The list of all objects in the scene.
let g_ThreeJsObjects = [];

// The animate loop will store the objects the user (the camera) is currently
//  looking at in this variable.
// let g_UserIsLookingAtObjects = [];

// The animate loop will store a reference to the local user's participant object
//  in this variable.
let g_LocalUserParticipantWrapperObj = null;

/**
 * Clear the participant wrapper objects in scene array.
 */
function clearParticipantWrapperObjsInScene() {
  g_ParticipantWrapperObjsInScene = [];
}

/**
 * Clear the ThreeJS avatar objects in scene array.
 */
function clearThreeJsAvatarObjectsInScene() {
  g_ThreeJsAvatarObjectsInScene = [];
}

// The following "assign" functions are there so external modules
//  can sidestep Javascripts immutable exported module variables
//  mandate and make assignments to the global ThreeJS variables
//  we contain.
function assignThreeJsCamera(camera) {
    const errPrefix = `(assignThreeJsCamera) `;

    if (!(camera instanceof THREE.Camera))
        throw new Error(errPrefix + `The value in the camera parameter is not a THREE.Camera object.`);

    g_ThreeJsCamera = camera;
}

function assignThreeJsObjects(objects) {
    const errPrefix = `(assignThreeJsObjects) `;

    if (!Array.isArray(objects))
    	throw new Error(errPrefix + `The objects parameter value is not an array.`);

    g_ThreeJsObjects = objects;
}

function assignThreeJsScene(scene) {
    const errPrefix = `(assignThreeJsScene) `;

    if (!(scene instanceof THREE.Scene))
        throw new Error(errPrefix + `The value in the scene parameter is not a THREE.Scene object.`);

    g_ThreeJsScene = scene;
}

function assignThreeJsRenderer(renderer) {
    const errPrefix = `(assignThreeJsRenderer) `;

    if (!(renderer instanceof THREE.WebGLRenderer))
        throw new Error(errPrefix + `The value in the renderer parameter is not a THREE.WebGLRenderer object.`);

    g_ThreeJsRenderer = renderer;
}

function assignThreeJsControls(controls) {
    const errPrefix = `(assignThreeJsControls) `;

    if (!(controls instanceof PointerLockControls))
        throw new Error(errPrefix + `The value in the controls parameter is not a THREE.PointerLockControls object.`);

    g_ThreeJsControls = controls;
}

function assignThreeJsRaycaster(raycaster) {
    const errPrefix = `(assignThreeJsRaycaster) `;

    if (!(raycaster instanceof THREE.Raycaster))
        throw new Error(errPrefix + `The value in the raycaster parameter is not a THREE.Raycaster object.`);

    g_ThreeJsRaycaster = raycaster;
}

function assignLocalUserParticipantWrapperObj(localUserParticipantWrapperObj) {
    const errPrefix = `(assignLocalUserParticipantWrapperObj) `;

    if (localUserParticipantWrapperObj !== null && !(localUserParticipantWrapperObj instanceof ParticipantWrapper))
        throw new Error(errPrefix + `The value in the localUserParticipantWrapperObj parameter is not NULL yet it is not a ParticipantWrapper object either.`);

    g_LocalUserParticipantWrapperObj = localUserParticipantWrapperObj;
}

export {
    g_AnimationMixers,
    g_ClipActions,
    g_LocalUserParticipantWrapperObj,
    g_ThreeJsCamera,
    g_ThreeJsClock,
    g_ThreeJsControls,
    g_ThreeJsObjects,
    g_ParticipantWrapperObjsInScene,
    g_ThreeJsAvatarObjectsInScene,
    g_ThreeJsRaycaster,
    g_ThreeJsRenderer,
    g_ThreeJsScene,
    // g_UserIsLookingAtObjects,
    assignLocalUserParticipantWrapperObj,
    clearParticipantWrapperObjsInScene,
    clearThreeJsAvatarObjectsInScene,
    assignThreeJsCamera,
    assignThreeJsControls,
    // assignThreeJsObjects,
    assignThreeJsRaycaster,
    assignThreeJsRenderer,
    assignThreeJsScene
};


