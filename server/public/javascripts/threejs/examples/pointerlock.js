// The main script for the ThreeJS pointerlock example.

// <script type="module">

import * as THREE from '../build/three.module.js';

// import {INSTRUCTIONS_ROW_ID, INSTRUCTIONS_DIV_ID} from "../../page-support/neoland-page-support.js";
import {THREEJS_CANVAS_ID, THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD} from "../../../globals/global-constants.js";

import {PointerLockControls} from "./jsm/controls/PointerLockControls.js";
import {g_TelevisionDisplayManager} from "../../objects/television.js";
import {
    g_SoundPlayedByHowlerManager,
    threeJsRotationToHowlerVector3
} from "../../sound-effects-support/howler-support.js";
import {
    CubeAssetsColorsOrUrls,
    PictureDisplayManager,
    PictureDisplay,
    g_PictureDisplayManager
} from "../../objects/picture-display.js";
import {
    // g_ThreeJsRaycaster,
    g_AnimationMixers,
    g_ClipActions,
    g_ThreeJsCamera,
    g_ThreeJsObjects,
    g_ThreeJsScene,
    g_ThreeJsRenderer,
    g_ThreeJsControls,
    assignThreeJsCamera,
    assignThreeJsScene,
    assignThreeJsControls,
    assignThreeJsRaycaster,
    assignThreeJsRenderer,
} from "../../objects/three-js-global-objects.js";
import {g_AryBooths} from "../../booths/world-content.js";
import * as THREEJSSUPPORT from "../../threejs-support/threejs-support-code.js";
import {
    cardinalDirectionToRotation, Dimensions2D,
    getBoundingBoxOfThreeJsObject,
    rotateCardinalDirFromBaseDir, vec3ToString, WORLD_AXIS_Y
} from "../../threejs-support/threejs-support-code.js";
import {g_BoothManager} from "../../booths/booth-manager.js";
import {DirectPlayAudio} from "../../audio-direct/direct-play-audio.js";
import {GLTFLoader} from "./jsm/loaders/GLTFLoader.js";
import {DRACOLoader} from "./jsm/loaders/DRACOLoader.js";
import { EXRLoader } from './jsm/loaders/EXRLoader.js';
import {RGBELoader} from "./jsm/loaders/RGBELoader.js";
import {g_GlobalState} from "../../objects/global-state.js";

// import { ThreeJsReflector } from "../../threejs-support/threejs-reflector-as-module.js";

const bVerbose = true;

const SERVER_BASE_URL = "/javascripts/booths";
// const S3_BASE_URL = 'https://neo3d-live.s3.amazonaws.com/booths-1/public/booths';
const S3_BASE_URL = 'https://d2gu5htr6mst1o.cloudfront.net/booths-1/public/booths';

let theGroundMirror;

// Other needed objects to build the scene.
let g_PmremGenerator = null;

// These are the available HDRI images.  The first one
//  will be the initial one.
const g_AryHdriImageFilenames = [
    "shanghai_bund_1k.hdr",
    "blue_lagoon_night_1k.hdr",
    "christmas_photo_studio_04_1k.hdr",
    "courtyard_night_1k.hdr",
    "hansaplatz_1k.hdr",
    "moonless_golf_1k.hdr",
    "pond_bridge_night_1k.hdr",
    "preller_drive_1k.hdr",
    "royal_esplanade_4k.hdr",
    "solitude_night_1k.hdr",
    "studio_small_03_1k.hdr"
]

/**
 * Dump the position and orientation given to the console.
 *
 * @param {String} theLabel - A helpful label to identify the
 *  entity whose position and orientation are being reported.
 * @param {THREE.Vector3} position - The position to show.
 * @param {THREE.Vector3} orientation - The orientation used.
 */
function dumpPositionAndOrientation(theLabel, position, orientation) {
    const errPrefix = `(dumpPositionAndOrientation) `;

    if (misc_shared_lib.isEmptySafeString(theLabel))
        throw new Error(errPrefix + `The theLabel parameter is empty.`);
    if (!(position instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the position parameter is not a THREE.Vector3 object.`);
    if (!(orientation instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the orientation parameter is not a THREE.Vector3 object.`);

    // TODO: Diagnostic code.
    const positionStr = vec3ToString(position);
    console.info(`${errPrefix}Setting position of sound belonging to object(${theLabel}) to: ${positionStr}.`);

    const orientationStr = vec3ToString(orientation);
    console.info(`${errPrefix}Setting orientation of sound belonging to picture display(${theLabel}) to ${orientationStr}.`);
}

// const vertex = new THREE.Vector3();
// const color = new THREE.Color();

// The geometry of a box.
// ROS: toNonIndexed is not in CubeGeometry in r124, which is what we are currenly using.
// const g_BoxGeometry = new THREE.BoxGeometry( 20, 20, 20 ).toNonIndexed();

// Keep a reference to the ThreeJS canvas element.
let jqThreeJsCanvas = null;

/**
 * Build a television display using the most common parameters.
 *  It does NOT add the object to the scene.
 *
 * NOTE: The position Y value will be adjusted so that the
 *   Y value in the position vector will behave as expected,
 *   automatically adjusted upwards by half the height of
 *   the television.
 *
 * NOTE: The height of the television will be automatically
 *  calculated based on the width using a 4:3 aspect ratio.
 *
 * @param {String} televisionId - The ID to assign to the television.
 * @param {String} videoUrl - The URL for the video to play on the television.
 * @param {THREE.Vector3} position - The position of the television
 *  in the scene.
 * @param {THREE.Vector3} rotation - The television will be rotated
 *  to face this direction given in this Euler angle.
 * @param {Number} widthOfTelevision - The width of the television
 *  display object.  The height of the television display object
 *  will be calculated from width using a 4:3 aspect ratio.  The
 *  thin "sides" will be 1 unit wide.
 *
 * @returns {TelevisionDisplay} - The TelevisionDisplay object that
 *  was created with the given parameters.
 */
function buildSimpleTelevision(idOfTelevisionDisplay, videoUrl, position, rotation, widthOfTelevision,) {
    const errPrefix = `(buildSimpleTelevision) `;

    // Adjust the Y position of the television display so that it is
    //  not half-way below the ground.
    const dimensions = new THREE.Vector3(widthOfTelevision, widthOfTelevision * (3/4), 1);

    position.y += dimensions.y / 2;

    // Let the addTelevision method validate the rest of the parameters.
    return g_TelevisionDisplayManager.addTelevision(
        idOfTelevisionDisplay,
        videoUrl,
        position,
        rotation,
        dimensions);
}

/**
 * This build function makes build a picture display with an optional
 *  sound object.  It does NOT add the object to the scene.
 *
 * IMPORTANT: The size of the cube created for this picture display
 *  object will be automatically adjusted to maintain a 4:3 aspect ratio
 *  for the side that shows the picture!
 *
 * @param {Object|null} boothJsonObj - The JSON booth object for the booth this picture
 *  belongs to.  May be NULL if the object is not inside a booth.
 * @param {String} idOfPictureDisplay - The ID of the picture display.
 * @param {String} srcUrlPicture - The URL of the picture to display.
 * @param {THREE.Vector3} position3D - The XYZ position of the picture display.
 * @param {THREE.Vector3} rotationEuler3D - The Euler angle in XYZ rotation
 *  precedence, that gives the orientation of the picture display. (i.e. -
 *  the direction it should point to.)
 * @param {String} surfaceName - The name of the surface that
 *  determines the direction the picture display will point to.
 *  E.g. - 'neg_x' will make the picture display face left.
 * @param {Number|Dimensions2D} widthOfPictureOrDim2D - The width of the
 *  surface that will show the picture OR a Dimensions2D object.  IF
 *  it is not a Dimensions2D object, then The height will be automatically
 *  for the picture will be automatically calculated in accordance
 *  with a 4:3 aspect ratio.
 * @param {Boolean} bAutoAdjustY - If TRUE, the Y position of the
 *  picture display will be adjusted so that it is not half-way
 *  below the ground.  If FALSE, it will be left alone.
 * @param {String} [srcUrlSound] - The URL of the sound to play. Optional.
 * @param {Boolean} bIsLooped - Whether the sound is looped. Optional.
 * @param {Boolean} bIsStoppedWhenDeactivated - Whether the sound is stopped
 *  when the picture display is deactivated. Optional.
 * @param {Boolean} bIsDirectPlay - If TRUE, then the sound will be played
 *  directly via the browser Audio() object..  If FALSE, then the sound will
 *  be played via Howler.  Direct play is useful when you want a sound to
 *  be really loud and present, and you don't care about audio positioning.
 * @param {String} [urlToPortal] - If provided, then when the user approaches
 * the picture, the browser will load teh URL given.
 *
 * @returns {PictureDisplay} - Returns the PictureDisplay object that was created.
 */
function buildSimplePictureWithSound(
    boothJsonObj,
    idOfPictureDisplay,
    srcUrlPicture,
    position3D,
    rotationEuler3D,
    surfaceName,
    widthOfPictureOrDim2D,
    bAutoAdjustY=true,
    srcUrlSound=null, bIsLooped=false, bIsStoppedWhenDeactivated=true, bIsDirectPlay=false,
    urlToPortal) {
    const errPrefix = `(buildSimplePictureWithSound) `;

    if (boothJsonObj !== null) {
        if (!misc_shared_lib.isNonNullObjectAndNotArray(boothJsonObj))
            throw new Error(errPrefix + `The value in the boothGroupObj parameter is not NULL, yet it is not of type OBJECT either.`);
    }

    if (misc_shared_lib.isEmptySafeString(idOfPictureDisplay))
        throw new Error(errPrefix + `The idOfPictureDisplay parameter is empty.`);

    // The picture URL is mandatory.
    if (misc_shared_lib.isEmptySafeString(srcUrlPicture))
        throw new Error(errPrefix + `The srcUrlPicture parameter is empty.`);

    if (!(position3D instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the position parameter is not a THREE.Vector3 object.`);
    if (!(rotationEuler3D instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the rotationEuler3D parameter is not a THREE.Vector3 object.`);

    if (!THREEJSSUPPORT.isValidSurfaceName(surfaceName))
        throw new Error(errPrefix + `The surfaceName parameter is not a valid surface name: ${surfaceName}.`);
    if (typeof widthOfPictureOrDim2D == 'number') {
        // throw new Error(errPrefix + `The value in the widthOfPicture parameter is not a number.`);
        if (widthOfPictureOrDim2D < 0)
            throw new Error(errPrefix + `The value in the widthOfPicture parameter is negative: ${widthOfPictureOrDim2D}.`);
        if (widthOfPictureOrDim2D === 0)
            throw new Error(errPrefix + `The value in the widthOfPicture parameter is zero.`);
    } else {
        // If the width is not a number, then it must be a Dimensions2D object.
        //  That object validated the width and height values it contains
        //  in its constructor.
        if (!(widthOfPictureOrDim2D instanceof Dimensions2D))
            throw new Error(errPrefix + `The widthOfPicture parameter is not a number or a Dimensions2D object.`);
    }

    if (typeof bAutoAdjustY !== 'boolean')
        throw new Error(errPrefix + `The value in the bAutoAdjustY parameter is not Boolean.`);

    if (srcUrlSound && typeof srcUrlSound !== 'string')
        throw new Error(errPrefix + `The value in the srcUrlSound parameter is not NULL, yet it is not a string either.`);
    if (typeof bIsLooped !== 'boolean')
        throw new Error(errPrefix + `The value in the bIsLooped parameter is not boolean.`);
    if (typeof bIsStoppedWhenDeactivated !== 'boolean')
        throw new Error(errPrefix + `The value in the bIsStoppedWhenDeactivated parameter is not boolean.`);
    if (typeof bIsDirectPlay !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsDirectPlay parameter is not boolean.`);

    if (urlToPortal) {
        if (misc_shared_lib.isEmptySafeString(urlToPortal))
            throw new Error(errPrefix + `The urlToPortal parameter is empty.`);
    }

    // const rotation = surfaceNameToRotation(surfaceName);

    // Create a cube assets pre-object that tells the picture display class
    //  how to build the picture display.
    const pictureDisplayContents = new CubeAssetsColorsOrUrls();

    // Just put a picture on the negative Z face of the cube.
    pictureDisplayContents.neg_z = srcUrlPicture;

    // If the widthOfPictureOrDim2D value is not a Dimensions2D
    //  object, then it contains the desired width.  Otherwise use
    //  the width value from the Dimensions2D object.
    const widthOfPicture =
        widthOfPictureOrDim2D instanceof Dimensions2D ? widthOfPictureOrDim2D.width : widthOfPictureOrDim2D ;

    // If the widthOfPictureOrDim2D value is not a Dimensions2D
    //  object, then derive the height of the picture display
    //  from the widthOfPictureOrDim2D value using a 4:3 aspect
    //  ratio.  Otherwise use the height value from the
    //  Dimensions2D object.
    const heightOfPicture =
        widthOfPictureOrDim2D instanceof Dimensions2D ? widthOfPictureOrDim2D.height : widthOfPictureOrDim2D * 3 / 4;

    // Auto-adjust the Y value?
    if (bAutoAdjustY) {
        // Adjust the Y value so that we don't end up with half the
        //  picture under the floor.
        const adjY = position3D.y + heightOfPicture / 2;
        position3D.y += adjY;
    }

    // ---------------------------- SOUND ----------------------------

    // The sound URL is optional.
    let soundToPlayObj = null;
    let directSoundPlayObj = null;

    const newPictureDisplayObj = g_PictureDisplayManager.addPictureDisplay(
        idOfPictureDisplay,
        pictureDisplayContents,
        position3D,
        rotationEuler3D,
        new THREE.Vector3(widthOfPicture, heightOfPicture, 1));

    // TODO: Adjust code so we can have BOTH a sound and a portal URL.
    //  Right now it's one or the other.

    // Do we have a portal URL?
    if (urlToPortal) {
        // Tell the browser to load the new URL.
        newPictureDisplayObj.funcActivate = () => {
            // Set the flag that tells the animation loop to stop rendering,
            //  to make the portal transition look seamless.
            g_GlobalState.setRenderDisableFlag();
            console.info(`${errPrefix}Portaling to URL: ${urlToPortal}.`)
            window.location.replace(urlToPortal);
        }
    }
    // Do we have a sound URL?
    else if (!misc_shared_lib.isEmptySafeString(srcUrlSound)) {
        //  If we are in a booth, then resolve the sound
        //  URL against the booth path.  Otherwise, just use what was given
        //  to us.
        const useSoundUrl = boothJsonObj === null ? srcUrlSound : resolveBoothUrl(boothJsonObj, srcUrlSound);

        // Direct play desired?
        if (bIsDirectPlay) {
            // Yes, direct play is desired.  Use the browser
            //  native Audio() object to play the sound.
            directSoundPlayObj = new DirectPlayAudio(useSoundUrl);

            // Use it's activate and deactivate functions as the picture display's
            //  activate and deactivate functions.
            newPictureDisplayObj.funcActivate = directSoundPlayObj.notifyActivated;
            newPictureDisplayObj.funcDeactivate = directSoundPlayObj.notifyDeactivated;
        } else {
            // No, direct play not desired.  Use Howler to play
            //  the sound.  Build a Howler object that will be tied
            //  to the picture display's ThreeJS avatar.
            soundToPlayObj = g_SoundPlayedByHowlerManager.addHowlerSound(useSoundUrl, newPictureDisplayObj.threeJsAvatar, idOfPictureDisplay, bIsLooped, bIsStoppedWhenDeactivated);

            // Use it's activate and deactivate functions as the picture display's
            //  activate and deactivate functions.
            newPictureDisplayObj.funcActivate = soundToPlayObj.notifyActivated;
            newPictureDisplayObj.funcDeactivate = soundToPlayObj.notifyDeactivated;
        }
    }

    return newPictureDisplayObj;
}

/**
 * Create one box and add it to the g_ThreeJsScene.
 */
function makeBoxInScene() {
    const boxMaterial = new THREE.MeshPhongMaterial({specular: 0xffffff, flatShading: true, vertexColors: true});

    // ROS: Set the color.
    boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75);

    // ROS: Make the box from a ThreeJS mesh.
    const box = new THREE.Mesh(g_BoxGeometry, boxMaterial);

    // ROS: Set the position.
    box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
    box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
    box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

    // ROS: Add the box to the scene and to the objects array.
    addObjectToObjectsList(box);
}

/**
 * Original function to create one box and add it to the g_ThreeJsScene.
 */
function makeBoxInScene_original() {
    const boxMaterial = new THREE.MeshPhongMaterial({specular: 0xffffff, flatShading: true, vertexColors: true});

    // ROS: Set the color.
    boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75);

    // ROS: Make the box from a ThreeJS mesh.
    const box = new THREE.Mesh(g_BoxGeometry, boxMaterial);

    // ROS: Set the position.
    box.position.x = Math.floor(Math.random() * 20 - 10) * 20;
    box.position.y = Math.floor(Math.random() * 20) * 20 + 10;
    box.position.z = Math.floor(Math.random() * 20 - 10) * 20;

    // ROS: Add the box to the scene and to the objects array.
    addObjectToObjectsList(box);
}

// The number of random boxes to automatically add to the g_ThreeJsScene.
const g_NumBoxesToAutoCreate = 0;

/**
 * Find the DOM element that we use for the ThreeJS canvas, or throw an error if it can't be found.
 *
 * @return {HTMLElement}
 */
function getThreeJsCanvasElement() {
    const errPrefix = `(getElementById) `;

    const elementId = THREEJS_CANVAS_ID;
    const canvasElement = document.getElementById(elementId);

    if (!canvasElement)
        throw new Error(errPrefix + `Unable to find the ThreeJS canvas element using element ID: ${elementId}.`);

    return canvasElement;
}

/**
 * Set the size of the renderer to the size of the ThreeJS canvas.
 */
function setRendererSize() {
    const canvasElement = getThreeJsCanvasElement();
    // renderer.setSize(canvasElement.offsetWidth, canvasElement.offsetHeight);
    g_ThreeJsRenderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Give a booth object, adjust a URL found inside it's
 *  JSON data so that is relative to a base directory
 *  that includes the booth's ID.
 *
 * @param {Object} boothJsonObj - The raw JSON booth object.
 * @param {String} url - The URL to adjust.
 *
 * @return {string} - Returns a URL based off of the
 *  based directory made from the booth's ID.
 */
function resolveBoothUrl(boothJsonObj, url) {
    const errPrefix = `(resolveBoothUrl) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(boothJsonObj))
        throw new Error(errPrefix + `The boothJsonObj is not a valid object.`);

    if (misc_shared_lib.isEmptySafeString(boothJsonObj.id))
        throw new Error(errPrefix + `The boothObj.id field is empty.`);

    if (misc_shared_lib.isEmptySafeString(url))
        throw new Error(errPrefix + `The url parameter is empty.`);

    let boothIdFormatted = boothJsonObj.id.trim().toLowerCase();

    // If an alias field was provided, use that instead of the booth
    //  ID as the project root dir.
    if (boothJsonObj.alias) {
        boothIdFormatted = boothJsonObj.alias.trim().toLowerCase();
    }

    // Adjust for URLs that start with a backslashes.
    const url_2 = url.startsWith(`/`) ? url.substring(1) : url;

    // TODO: The open source version should not have the S3 bucket usage.

    // TODO: Find out why images being on S3 are not working.
    // Only videos and HDRI files are on S3.  Images end up rendering as missing.
    if (url_2.endsWith('.mp4') || url_2.endsWith('.hdr'))
        return `${S3_BASE_URL}/${boothIdFormatted}/${url_2}`;
    else
        return `${SERVER_BASE_URL}/${boothIdFormatted}/${url_2}`;
}

/**
 * Process one booth definition in JSON object format into the
 *  required ThreeJS scene objects using a ThreeJS object
 *  group to make rotating the booth and its children
 *  easier.
 *
 * @param {Object} boothJsonObj - A valid booth definition in JSON object format.
 */
function buildOneBooth(boothJsonObj) {
    const errPrefix = `(buildOneBooth) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(boothJsonObj))
        throw new Error(errPrefix + `The boothObj is not a valid object.`);

    if (misc_shared_lib.isEmptySafeString(boothJsonObj.id))
        throw new Error(errPrefix + `The booth object is missing an ID field or it is empty.`);

    // No duplicate booth IDs.
    if (g_BoothManager.isExistingGroupId(boothJsonObj.id))
        throw new Error(errPrefix + `A booth with the given ID already exists: ${boothJsonObj.id}.`);

    // This is the Euler angle as a THREE.Vector3 object for the default facing direction.
    const north3D = THREEJSSUPPORT.cardinalDirectionToEulerAngle(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION);

    // Determine the rotation angle necessary to rotate the booth to face the
    //  PRIMARY_FACING direction.
    const baseRotationAngle = THREEJSSUPPORT.cardinalDirectionToRotation(boothJsonObj.primary_facing);

    // Create a THREE.Group object to hold the booth and its children.
    const boothGroupObj = new THREE.Group();

    // Add it to the list of booth group objects.
    g_BoothManager.addBoothGroup(boothJsonObj.id, boothGroupObj);

    // Extract the XYZ coordinates of the booth's position.
    const boothOriginX = boothJsonObj.primary_location.x;
    const boothOriginY = boothJsonObj.primary_location.y;
    const boothOriginZ = boothJsonObj.primary_location.z;

    // -------------------- BEGIN: WALLS ------------

    if (boothJsonObj.walls.back.length < 1)
        throw new Error(`${errPrefix}The booth object has no back walls.`);

    // Calculate in advance the entire length of the booth's aggregate back wall.
    let sumBackWallsLength = 0;

    boothJsonObj.walls.back.forEach(jsonBackWallObj => {
        sumBackWallsLength += jsonBackWallObj.size;
    });

    // Process the back walls array first so we know the total length
    //  of the back of the booth.
    let numBackWalls = 0;

    const firstBackWallJsonObj = boothJsonObj.walls.back[0];
    const lastBackWallJsonObj = boothJsonObj.walls.back[boothJsonObj.walls.back - 1];

    // Adjust the back wall's position to be relative to the booth's
    //  center.
    //
    // First, determine where the far left edge of the booth will be in the X direction.
    // const farLeftEdgeX = boothOriginX - (sumBackWallsLength / 2);
    const farLeftEdgeX = -(sumBackWallsLength / 2);
    let backWallX = farLeftEdgeX;

    // Compensate for the first wall's center.
    backWallX += (firstBackWallJsonObj.size / 2);

    let firstBackWallX = 0;
    let lastBackWallSize = 0;
    // let previousBackWallBoundingBox = null;
    // let currentBackWallOneBoundingBox = null;

    let firstBackWallObj = null;
    let lastBackWallObj = null;

    boothJsonObj.walls.back.forEach(jsonBackWallObj => {
        numBackWalls++;

        // Create the wall by creating a picture display object for each wall.
        const backWallObj = buildSimplePictureWithSound(
            boothJsonObj,
            `${boothJsonObj.id}-back-wall-${numBackWalls}`,
            resolveBoothUrl(boothJsonObj, jsonBackWallObj.url),
            new THREE.Vector3(
                backWallX,
                jsonBackWallObj.y,
                jsonBackWallObj.z),
            // Before adjustment, the back wall faces north.
            THREEJSSUPPORT.cardinalDirectionToEuler3D('north'),
            // Paint the picture on the surface that faces the default cardinal direction.
            THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
            jsonBackWallObj.size
        );

        // Add it's avatar object to the booth group object.
        boothGroupObj.add(backWallObj.threeJsAvatar);

        // Add it to the list of world objects.
        addObjectToObjectsList(backWallObj.threeJsAvatar);

        // If we have a banner image, add it at the top of the booth and
        //  centered.
        if (boothJsonObj.banner_image && boothJsonObj.banner_image.url) {
            // Derive a good height (Y value) for the banner's picture display from the wall size
            //  using a 4:3 aspect ratio.
            // const heightFromWidth_4_3 = jsonBackWallObj.size * 3 / 4;

            const bannerZ = -( Math.trunc(0.9 * boothJsonObj.walls.side_1.size));

            const bannerObj = buildSimplePictureWithSound(
                boothJsonObj,
                `${boothJsonObj.id}-banner-${numBackWalls}`,
                resolveBoothUrl(boothJsonObj, boothJsonObj.banner_image.url),
                new THREE.Vector3(
                    backWallX,
                    // TODO: Derive the banner Y coordinate algorithmically.
                    16,
                    bannerZ),
                // Before adjustment, the back wall faces north.
                THREEJSSUPPORT.cardinalDirectionToEuler3D('north'),
                // Paint the picture on the surface that faces the default cardinal direction.
                THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
                30
            );

            // Add the object to the group.
            boothGroupObj.add(bannerObj.threeJsAvatar);

            // Add it to the list of world objects.
            addObjectToObjectsList(bannerObj.threeJsAvatar);
        }

        if (numBackWalls === 1) {
            firstBackWallX = backWallX;
        }

        // Calculate the next back wall's X coordinate by adding the length of the
        //  current back wall to the current sum.
        backWallX += jsonBackWallObj.size;

        console.info(`${errPrefix}[back wall #${numBackWalls}] Back wall X: ${backWallX}`);

        lastBackWallSize = jsonBackWallObj.size;
        firstBackWallObj = backWallObj;
        lastBackWallObj = backWallObj;
    });

    // We must have a first and a last back wall.
    if (!firstBackWallObj)
        throw new Error(`${errPrefix}The first back wall object is null.`);
    if (!lastBackWallObj)
        throw new Error(`${errPrefix}The last back wall object is null.`);

    // Get the bounding box for the first back wall.
    // const backWallOneBoundingBox_1 = getBoundingBoxOfThreeJsObject(firstBackWallObj.threeJsAvatar, true);

    // Calculate the position of back that wall's right edge.
    // const backWallOneRightEdgeX = backWallOneBoundingBox_1.max.x;

    // Get the bounding box for the first back wall.
    const firstBackWallBoundingBox = getBoundingBoxOfThreeJsObject(firstBackWallObj.threeJsAvatar, true);

    // Get the bounding box for the last back wall.
    const lastBackWallBoundingBox = getBoundingBoxOfThreeJsObject(lastBackWallObj.threeJsAvatar, true);

    // Calculate the position of the last back wall's right edge.
    // const lastBackWallRightEdgeX = lastBackWallBoundingBox.max.x;

    const sideWallsZ = -(1/2 * boothJsonObj.walls.side_1.size);

    // >>>>> OBJECT: Side_1 wall - faces NORTH initially.
    const sideWallOneObj = buildSimplePictureWithSound(
        boothJsonObj,
        `${boothJsonObj.id}-side-wall-1`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.side_1.url),
        // Position the first side wall at the left edge of the first
        //  back wall, which is the same as the origin X of the booth.
        //  Adjust for the center of side wall 1.
        new THREE.Vector3(
            farLeftEdgeX,
            boothOriginY,
            sideWallsZ), // boothOriginZ - (boothJsonObj.walls.side_1.size / 4)),
        // Before adjustment, side wall 1 faces west.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('west'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.side_1.size
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(sideWallOneObj.threeJsAvatar);

    // Add it to the list of world objects.
    addObjectToObjectsList(sideWallOneObj.threeJsAvatar);


    // >>>>> OBJECT: Side_2 wall - initially faces NORTH before adjustment.
    const sideWallTwoObj = buildSimplePictureWithSound(
        boothJsonObj,
        `${boothJsonObj.id}-side-wall-2`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.side_2.url),
        // Position the second side wall at the maximum X for the last back wall
        //  and apply the same adjustments.
        new THREE.Vector3(
            backWallX - (lastBackWallSize / 2),
            boothOriginY,
            sideWallsZ // boothOriginZ - (boothJsonObj.walls.side_1.size / 4),
        ),
        // Before adjustment, side wall 2 faces east.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('east'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.side_2.size
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(sideWallTwoObj.threeJsAvatar);

    // Add it to the list of world objects.
    addObjectToObjectsList(sideWallTwoObj.threeJsAvatar);

    // -------------------- END  : WALLS ------------

    // -------------------- BEGIN: PICTURES ------------

    // Process all the pictures in the booth.
    let pictureNum = 0
    boothJsonObj.pictures.forEach(picture => {
        if (misc_shared_lib.isEmptySafeString(picture.id))
            throw new Error(`${errPrefix}The picture at index(${pictureNum}) has an empty ID.`);

        // Make sure the picture ID is unique.
        if (g_PictureDisplayManager.isExistingPictureDisplayId(picture.id))
            throw new Error(`${errPrefix}The picture at index(${pictureNum}) has a duplicate ID: ${picture.id}.`);

        let urlToSound = null;
        let isSoundLooped = false;
        let isDirectPlay = false;
        let isStoppedWhenDeactivated = false;

        if ('sound' in picture) {
            if (misc_shared_lib.isEmptySafeString(picture.sound.url))
                throw new Error(`${errPrefix}The picture at index(${pictureNum}) has an empty sound URL.`);

            urlToSound = picture.sound.url.trim();

            // Set flags specified for the sound in the JSON file.
            if ('is_looped' in picture.sound)
                isSoundLooped = picture.sound.is_looped;
            if ('direct_play' in picture.sound)
                isDirectPlay = picture.sound.direct_play;
            if ('stop_when_deactivated' in picture.sound)
                isStoppedWhenDeactivated = picture.sound.stop_when_deactivated;
        }

        // Create a picture display object for each picture.
        const pictureObj = buildSimplePictureWithSound(
            boothJsonObj,
            picture.id,
            resolveBoothUrl(boothJsonObj, picture.url),
            // The picture must be offset the booth's far left edge.
            new THREE.Vector3(
                farLeftEdgeX + picture.location.x,
                boothOriginY + picture.location.y,
                picture.location.z),
            // The picture initially faces the orientation specified in the JSON
            //  file.
            THREEJSSUPPORT.cardinalDirectionToEuler3D(picture.facing),
            // Paint the picture on the surface that faces the default cardinal direction.
            THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
            picture.size,
            true,
            urlToSound,
            isSoundLooped,
            isStoppedWhenDeactivated,
            isDirectPlay,
            picture.url_for_portal
        );

        // Add it's avatar object to the booth group object.
        boothGroupObj.add(pictureObj.threeJsAvatar);

        // Add it to the list of world objects.
        addObjectToObjectsList(pictureObj.threeJsAvatar);

        pictureNum++;
    });

    // -------------------- END  : PICTURES ------------

    // -------------------- BEGIN: VIDEOS ------------

    // Process all the videos in the booth.
    let videoNum = 0

    if (true) {
        boothJsonObj.videos.forEach(video => {
            if (misc_shared_lib.isEmptySafeString(video.id))
                throw new Error(`${errPrefix}The video at index(${videoNum}) has an empty ID.`);

            // Make sure the television display ID is unique.
            if (g_TelevisionDisplayManager.isExistingTelevisionId(video.id))
                throw new Error(`${errPrefix}The video at index(${videoNum}) has a duplicate ID: ${video.id}.`);

            const videoY = boothOriginY + video.location.y;

            // Create a television display object for each video.
            const videoObj = buildSimpleTelevision(
                video.id,
                resolveBoothUrl(boothJsonObj, video.url),
                // The video must be offset the booth's far left edge.
                new THREE.Vector3(
                    farLeftEdgeX + video.location.x,
                    videoY,
                    video.location.z),
                // The video initially faces the orientation specified in the JSON
                //  file.
                // THREEJSSUPPORT.cardinalDirectionToEulerAngle(video.facing),
                THREEJSSUPPORT.cardinalDirectionToEuler3D(video.facing),
                video.size
            );

            // Add it's avatar object to the booth group object.
            boothGroupObj.add(videoObj.threeJsAvatar);

            // Add it to the list of world objects.
            addObjectToObjectsList(videoObj.threeJsAvatar);

            // Is there a video card_url?
            if (video.card_url) {
                const resolvedVideoCardUrl = resolveBoothUrl(boothJsonObj, video.card_url);
                console.info(`${errPrefix}Building video card.  Video card_url: ${resolvedVideoCardUrl}`);

                if (resolvedVideoCardUrl.indexOf('chico') >= 0) {
                    console.info(`${errPrefix}Building video card for jonathan.`);
                }

                const boundingBox = getBoundingBoxOfThreeJsObject(videoObj.threeJsAvatar);
                // Make the video card width the same as the video.
                const cardWidth = video.size;
                // Make the video card height 1/4 the size of the video.
                const cardHeight = Math.trunc(video.size / 4);
                // Position it right above the video player.
                const cardY = boundingBox.max.y + Math.trunc(cardHeight / 2);

                // Build a picture display for the video poster.
                const cardObj = buildSimplePictureWithSound(
                    boothJsonObj,
                    `${video.id}-card`,
                    resolvedVideoCardUrl,
                    // The card must be offset video's height.
                    new THREE.Vector3(
                        farLeftEdgeX + video.location.x,
                        cardY,
                        video.location.z),
                    // The card faces the same direction as the video it describes.
                    THREEJSSUPPORT.cardinalDirectionToEuler3D(video.facing),
                    // Paint the picture on the surface that faces the default cardinal direction.
                    THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
                    new Dimensions2D(cardWidth, cardHeight),
                    false
                );

                // Add it's avatar object to the booth group object.
                boothGroupObj.add(cardObj.threeJsAvatar);

                // Add it to the list of world objects.
                addObjectToObjectsList(cardObj.threeJsAvatar);
            }

            if (bVerbose)
                console.log(`${errPrefix}Television display created and added to scene for: ${video.id}`);

            videoNum++;
        });
    }

    // -------------------- END  : VIDEOS ------------


    // Move the group to the new location.
    // boothGroupObj.position.set(adjX, boothOriginY, adjZ);

    // Adjust the booth origin X to so that it takes into account the
    //  center of the booth.
    // const adjBoothOriginX = boothOriginX - (sumBackWallsLength / 2);

    // Orient it as per the PRIMARY_FACING direction.
    boothGroupObj.rotateY(baseRotationAngle);

    // Adjust the X and Z so that we are in the center.
    let adjX = boothGroupObj.position.x;
    let adjY = boothGroupObj.position.y;
    let adjZ = boothGroupObj.position.z;

    const halfBackWallsLen = sumBackWallsLength / 2;

    const cardinalDirLower = boothJsonObj.primary_facing.toLowerCase();
    if (cardinalDirLower === 'north') {
        // Nothing to do, coordinates are already correct.
    } else if (cardinalDirLower === 'south') {
        // Flip the sign on the X coordinate due to the rotation
        //  we just made..
        adjX = -adjX;
    } else if (cardinalDirLower === 'east') {
        // This centers the booth around the world origin(0,0,0).
        adjZ += halfBackWallsLen;
        // This moves the booth to the specified booth origin.
    } else if (cardinalDirLower === 'west') {
        // This centers the booth around the world origin(0,0,0).
        adjZ -= halfBackWallsLen;
    } else {
        throw new Error(`${errPrefix}The primary_facing direction is invalid: ${cardinalDirLower}`);
    }

    boothGroupObj.position.set(boothOriginX, boothOriginY, boothOriginZ);

    // boothGroupObj.position.set(adjX, adjY, adjZ);

    // The booth should now be centered around the world origin (0, 0, 0).
    //  Now move it to where the booth origin dictates it should be.

    // This will not work for groups because the axis is wrong for a group.
    // boothGroupObj.rotateOnAxis(WORLD_AXIS_Y, baseRotationAngle)

    // Instead, rotate the group "manually" by adjusting it's rotation
    //  around the y axis.
    // boothGroupObj.rotation.y += baseRotationAngle;

    // boothGroupObj.position.set(adjBoothOriginX, boothOriginY, boothOriginZ);


    // Add the booth to the scene.
    g_ThreeJsScene.add(boothGroupObj);

    // boothGroupObj.position.set(1000, boothOriginY, 1000);
}

/**
 * Convert the content in the global booths definitions array
 *  into world content.
 */
function jsonWorldContentToScene() {
    const errPrefix = `(jsonWorldContentToScene) `;

    // console.warn(`${errPrefix}Converting JSON world content to scene: DISABLED.`);
    // return;

    if (!g_AryBooths)
        throw new Error(errPrefix + `The global booths array is missing.`);

    // Process each booth.
    g_AryBooths.forEach(boothObj => {
        // Process each booth's content.
        console.info(`${errPrefix}Processing booth: ${boothObj.display_name}`);
        buildOneBooth(boothObj);
    });
}

/**
 * Prepare the scene for HDRI usage.  Load all the HDRI
 *  images we use.  Only the image name that is specified in the
 */
function prepareHdri() {
    const params = {
        exposure: 2.0
    };

    g_ThreeJsRenderer.toneMapping = THREE.ReinhardToneMapping;
    g_ThreeJsRenderer.toneMappingExposure = params.exposure;
    g_ThreeJsRenderer.outputEncoding = THREE.sRGBEncoding;

    new EXRLoader()
        .load( 'hdri/royal_esplanade_4k.exr', function ( texture, textureData ) {

            // memorial.exr is NPOT

            //console.log( textureData );
            //console.log( texture );

            // EXRLoader sets these default settings
            //texture.generateMipmaps = false;
            //texture.minFilter = LinearFilter;
            //texture.magFilter = LinearFilter;

            const material = new THREE.MeshBasicMaterial( { map: texture } );
            const quad = new THREE.PlaneGeometry( 1.5 * textureData.width / textureData.height, 1.5 );
            const mesh = new THREE.Mesh( quad, material );
            mesh.position.set(0,0,0);
            g_ThreeJsScene.add( mesh );

            // Add the GLTF model.
            testGltf();

            // render();
        } );
}

function initializeThreeJS() {
    const errPrefix = `(initializeThreeJS) `;

    // Look for the URL element that determines the world
    //  name.  The default is "neo-prime"

    let worldToLoad = 'neo-prime';

    const urlArguments = getUrlArguments();

    if ('world' in urlArguments) {
        worldToLoad = urlArguments['world'];
    }

    if (worldToLoad === 'nft-showcase')
        initializeNftShowcase();
    else
        initializeNeoPrime();

}

/**
 * Load an HDRI image.
 *
 * @param {String} hdriImageFilenameOnly - The primary file name of the HDRI image
 *  to load.
 *
 * @param bVisible
 */
function loadOneHdriImage(hdriImageFilenameOnly, bVisible=false) {
    const errPrefix = `(hdriImageFilenameOnly) `;

    if (misc_shared_lib.isEmptySafeString(hdriImageFilenameOnly))
        throw new Error(errPrefix + `The hdriImageFilenameOnly parameter is empty.`);
    if (typeof bVisible !== 'boolean')
    	throw new Error(errPrefix + `The value in the bVisible parameter is not boolean.`);


    const fullUrlToHdri = `${S3_BASE_URL}/somnium-wave/hdri/${hdriImageFilenameOnly}`;

    console.warn(`${errPrefix}Loading HDR file from S3 using the URL: ${fullUrlToHdri}.`);

    /*
    new RGBELoader()
        .load( fullUrlToHdri, function ( texture ) {
            texture.mapping = THREE.EquirectangularReflectionMapping;

            g_ThreeJsScene.background = texture;
            g_ThreeJsScene.environment = texture;

            console.info(`${errPrefix}HDRI image successfully loaded.`);
        } );
     */

    new RGBELoader()
        // .setDataType( THREE.UnsignedByteType )
        /*
        From the ThreeJS Discourse forum

        With this version of three.js you load your HDR
        textures as RGBE encoded RGBA8 textures which
        only allows nearest texture filtering. I suggest
        you use .setDataType( THREE.HalfFloatType ) which
        enables linear texture filtering.
         */
        .setDataType( THREE.HalfFloatType )
        .load( fullUrlToHdri, ( texture ) => {

            const envMap = g_PmremGenerator.fromEquirectangular( texture ).texture;

            g_ThreeJsScene.background = envMap;
            g_ThreeJsScene.environment = envMap;

            texture.dispose();
            g_PmremGenerator.dispose();
        } );
}


/**
 * Initialize the NFT showcase world.
 */
function initializeNftShowcase() {
    const errPrefix = `(function initializeNftShowcase) `;

    assignThreeJsRenderer(new THREE.WebGLRenderer( { antialias: true }) );
    g_ThreeJsRenderer.setPixelRatio( window.devicePixelRatio );
    g_ThreeJsRenderer.setSize( window.innerWidth, window.innerHeight );
    g_ThreeJsRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    g_ThreeJsRenderer.toneMappingExposure = 1;
    g_ThreeJsRenderer.outputEncoding = THREE.sRGBEncoding;

    assignThreeJsCamera(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000));
    g_ThreeJsCamera.position.y = 10;

    assignThreeJsScene(new THREE.Scene());
    g_ThreeJsScene.background = new THREE.Color(0xffffff);
    g_ThreeJsScene.fog = new THREE.Fog(0xffffff, 0, 750);

    assignThreeJsControls(new PointerLockControls(g_ThreeJsCamera, document.body));

    // Find the canvas for our ThreeJS g_ThreeJsScene.
    const threeJsCanvas = getThreeJsCanvasElement();
    jqThreeJsCanvas = $('#' + threeJsCanvas.id);

    g_ThreeJsScene.add(g_ThreeJsControls.getObject());

    assignThreeJsRaycaster(new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10));

    // LIGHT
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    g_ThreeJsScene.add(light);

    // Create the renderer.
    assignThreeJsRenderer(new THREE.WebGLRenderer( { antialias: true }) );
    g_ThreeJsRenderer.setPixelRatio( window.devicePixelRatio );
    // document.body.appendChild( renderer.domElement );
    threeJsCanvas.appendChild(g_ThreeJsRenderer.domElement);
    setRendererSize();

    // Create elements needed for HDRI image usage.
    g_PmremGenerator = new THREE.PMREMGenerator(g_ThreeJsRenderer);
    g_PmremGenerator.compileEquirectangularShader();

    // Watch for the resizing of the canvas.
    window.addEventListener( 'resize', onWindowResize );

    // Also listen for F11 fullscreen.
    document.addEventListener('fullscreenchange', (event) => {
        // document.fullscreenElement will point to the element that
        // is in fullscreen mode if there is one. If there isn't one,
        // the value of the property is null.
        if (document.fullscreenElement) {
            console.info(`${errPrefix}Element: ${document.fullscreenElement.id} entered full-screen mode.`);
        } else {
            console.info('${errPrefix}Leaving full-screen mode.');
        }

        // In either case, call the window resize function.
        onWindowResize();
    });

    // HDRI files are served from S3.
    // const theLoader = new RGBELoader();


    // Load the initial HDR image.
    loadOneHdriImage(g_AryHdriImageFilenames[0], true);

    /*
    // Load all the HDRI files we use in the scene.
    aryHdriImages.forEach((hdriImageFilenameOnly) => {
        bVisible = bFirst;
        loadOneHdriImage(hdriImageFilenameOnly, bVisible);
        bFirst = false;
    });

     */

    // Load the 3D model.
    testGltf();

    /*
        new RGBELoader()
        // .setPath( 'textures/equirectangular/' )
        .setPath( 'hdri/' )
        // .load( 'royal_esplanade_1k.hdr', function ( texture ) {
        .load( 'royal_esplanade_4k.hdr', function ( texture ) {
            texture.mapping = THREE.EquirectangularReflectionMapping;

            g_ThreeJsScene.background = texture;
            g_ThreeJsScene.environment = texture;

            console.info(`${errPrefix}HDRI image successfully loaded.`);

            testGltf();

        } );

     */
}

function initializeNeoPrime() {
    const errPrefix = `(initializeNeoPrime) `;

    assignThreeJsCamera(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000));
    g_ThreeJsCamera.position.y = 10;

    assignThreeJsScene(new THREE.Scene());
    g_ThreeJsScene.background = new THREE.Color(0xffffff);
    g_ThreeJsScene.fog = new THREE.Fog(0xffffff, 0, 750);

    assignThreeJsControls(new PointerLockControls(g_ThreeJsCamera, document.body));

    // Find the canvas for our ThreeJS g_ThreeJsScene.
    const threeJsCanvas = getThreeJsCanvasElement();
    jqThreeJsCanvas = $('#' + threeJsCanvas.id);

    g_ThreeJsScene.add(g_ThreeJsControls.getObject());

    assignThreeJsRaycaster(new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10));

    // BASIC WORLD OBJECTS
    // LIGHT
    let light = new THREE.PointLight(0xffffff);
    light.position.set(100, 250, 100);
    g_ThreeJsScene.add(light);

    // FLOOR
    // server/public/images/three-js-simple/checkerboard.jpg
    let floorTexture = new THREE.ImageUtils.loadTexture('/images/three-js-simple/checkerboard.jpg');
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(15, 15);
    let floorMaterial = new THREE.MeshBasicMaterial({map: floorTexture, side: THREE.DoubleSide});
    let floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    let floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.5;
    floor.position.z = -350; // -450;
    floor.rotation.x = Math.PI / 2;
    g_ThreeJsScene.add(floor);

    // SKYBOX
    let skyBoxGeometry = new THREE.CubeGeometry(10000, 10000, 10000);
    // let skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0x9999ff, side: THREE.BackSide } );
    let skyBoxMaterial = new THREE.MeshBasicMaterial({color: 0x00CC00, side: THREE.BackSide});
    let skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
    g_ThreeJsScene.add(skyBox);

    ////////////
    // CUSTOM //
    ////////////

    // Add a sphere to the scene.

    if (false) {
        let geometry = new THREE.SphereGeometry(30, 32, 16);
        let material = new THREE.MeshLambertMaterial({color: 0x000088});
        let mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 40, 0);
        g_ThreeJsScene.add(mesh);
    }

    // Mirror test.
    // addCircularMirror(new THREE.Vector3(-15, 0.5, -249), new THREE.Vector3(- Math.PI / 2, Math.PI / 2, 0));
    // addCircularMirror(new THREE.Vector3( 60, 0.5, -249), new THREE.Vector3(- Math.PI / 2, -Math.PI / 2, 0));

    // -------------------- BEGIN: ROS: Custom World Objects ------------

    if (false) {
        // Add a television to the scene.
        const televisionObj = buildSimpleTelevision(
            'TEST-TV',
            '/javascripts/booths/to-the-moon-universe/videos/TOTHEMOON-UNIVERSE-THE-ARRIVAL.mp4',
            new THREE.Vector3(108, 2, -100),
            THREEJSSUPPORT.surfaceNameToRotation('neg_x'),
            50);

        // Add it to the scene.
        addObjectToObjectsList(televisionObj.threeJsAvatar);

        // Add a picture display to the scene that plays a bell when you approach it
        //  and doesn't stop until you leave.
        const pictureObj = buildSimplePictureWithSound(
            null,
            'picture-with-looping-bell-1',
            // '/images/three-js-simple/dawnmountain-zpos.png',
            '/images/world/browserify.png',
            // Position.
            new THREE.Vector3(-100, 0, -40),
            THREEJSSUPPORT.surfaceNameToRotation('pos_z'),
            'pos_z',
            30,
            '/audio/test/NEED-NEW-TEST-AUDIO-FILE.wav', true, true);
        // '/audio/sound-fx/sprite.mp3', true, true);
        // '/sounds/sfx/mono-bell-right.wav', true, true);

        // Add it to the scene.
        addObjectToObjectsList(pictureObj.threeJsAvatar);
    }

    // Integrate the content in the JSON booth files into the ThreeJS scene.
    jsonWorldContentToScene();

    // -------------------- END  : ROS: Custom World Objects ------------

    // Create the renderer.
    assignThreeJsRenderer(new THREE.WebGLRenderer( { antialias: true }) );
    g_ThreeJsRenderer.setPixelRatio( window.devicePixelRatio );
    // document.body.appendChild( renderer.domElement );
    threeJsCanvas.appendChild(g_ThreeJsRenderer.domElement);
    setRendererSize();

    // Watch for the resizing of the canvas.
    window.addEventListener( 'resize', onWindowResize );
}

/**
 * Adjust the scene if the window is resized.
 */
function onWindowResize() {
    g_ThreeJsCamera.aspect = window.innerWidth / window.innerHeight;
    g_ThreeJsCamera.updateProjectionMatrix();

    if (theGroundMirror) {
        // Resize the mirror.
        theGroundMirror.getRenderTarget().setSize(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio
        );
    }

    setRendererSize();
}

/**
 * Add a non-environment object to the g_ThreeJsScene.  These are objects
 *  that are dynamically created and need to have intersection
 *  checks done on them, unlike objects such as the floor,
 *  the lights, etc.
 *
 *  NOTE: If the object is a child of a group, it will NOT be added to the
 *   scene!  Otherwise it will be double-added when the group object is added
 *   to the scene!
 *
 * @param {Object} newObject - The object to add to the g_ThreeJsScene.
 *
 */
function addObjectToObjectsList(newObj) {
    const errPrefix = `(addObjectToScene) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(newObj))
        throw new Error(errPrefix + `The newObj parameter does not contain a valid object.`);

    // Always add the object to the objects array so that raycasting operations
    //  work.
    g_ThreeJsObjects.push(newObj);

    const bIsChildOfGroup = (newObj.parent && newObj.parent.isGroup);

    if (!bIsChildOfGroup)
        g_ThreeJsScene.add(newObj);
}

/**
 * Finds a ThreeJS object in the scene by its "uuid" property.
 * @param {String} theUuid - The uuid of the object to find.
 *
 * @return {null|*|Object3D|Object3D} - Returns NULL if the
 *  object is not found, otherwise the object is returned.
 */
function findObjInSceneByUuid(theUuid) {
    const errPrefix = `(findObjInSceneByUuid) `;

    if (misc_shared_lib.isEmptySafeString(theUuid))
        throw new Error(errPrefix + `The theUuid parameter is empty.`);

    const retObj = g_ThreeJsScene.getObjectByProperty('uuid', theUuid);

    // Conform "undefined" to NULL.
    if (typeof retObj === 'undefined')
        return null;

    return retObj;
}

/**
 * Removes a ThreeJS object from the scene using its "uuid" property
 *  to locate it.
 *
 * @param {String} theUuid - The uuid of the object to remove.
 *
 * @return {Boolean} - Returns TRUE if the object was found and
 *  removed, otherwise FALSE.
 */
function removeObjFromSceneByUuid(theUuid) {
    const errPrefix = `(removeObjFromSceneByUuid) `;

    if (misc_shared_lib.isEmptySafeString(theUuid))
        throw new Error(errPrefix + `The theUuid parameter is empty.`);

    const objToRemove = findObjInSceneByUuid(theUuid);

    if (!objToRemove)
        return false;

    // Remove the object from the scene after disposing of the
    //  resources attached to it.
    objToRemove.geometry.dispose();

    for (let propKey in objToRemove.material) {
        const propValue = objToRemove.material[propKey];

        propValue.dispose();
    }

    g_ThreeJsScene.remove(objToRemove);

    return true;
}

/**
 * Add a mirror to the scene.
 *
 * @param {Number} theWidth - The width of the mirror.
 */
function addCircularMirror(position3D, rotation3D,  theRadius=20, numSegments=128) {
    let geometry, material;

    geometry = new THREE.CircleGeometry( theRadius, numSegments );
    theGroundMirror = new THREE.Reflector( geometry, {
        clipBias: 0.003,
        textureWidth: window.innerWidth * window.devicePixelRatio,
        textureHeight: window.innerHeight * window.devicePixelRatio,
        color: 0x777777
    } );

    theGroundMirror.position.x = position3D.x;
    theGroundMirror.position.y = position3D.y;
    theGroundMirror.position.z = position3D.z;
    theGroundMirror.rotateX( rotation3D.x );
    theGroundMirror.rotateY( rotation3D.y );
    theGroundMirror.rotateZ( rotation3D.z );

    g_ThreeJsScene.add( theGroundMirror );
}

// Start the g_ThreeJsScene.
initializeThreeJS();


// Hide the playground.
// jqThreeJsCanvas.hide();
function testGltf() {
    const errPrefix = `(testGltf) `;

    // prepareHdri();

    const loader = new GLTFLoader();

    // Optional: Provide a DRACOLoader instance to decode compressed mesh data
    const dracoLoader = new DRACOLoader();

    // const urlToModel = '/models/gltf/somniumwave/somniumwave-test-1.glb';
    const urlToModel ='/models/gltf/somniumwave/T15.gltf';

    dracoLoader.setDecoderPath( '/examples/js/libs/draco/' );
    loader.setDRACOLoader( dracoLoader );

    // Load a glTF resource
    loader.load(
        // resource URL
        urlToModel,
        // called when the resource is loaded
        function ( gltf ) {
            const errPrefix = `(testGltf::load) `;

            let mixer = new THREE.AnimationMixer( gltf.scene );
            let action = mixer.clipAction( gltf.animations[ 0 ] );

            // Resize and center.
            let mroot = gltf.scene;
            let bbox = new THREE.Box3().setFromObject(mroot);
            let cent = bbox.getCenter(new THREE.Vector3());
            let size = bbox.getSize(new THREE.Vector3());

            //Rescale the object to normalized space
            let maxAxis = Math.max(size.x, size.y, size.z);
            // mroot.scale.multiplyScalar(1.0 / maxAxis);
            mroot.scale.multiplyScalar(40.0 / maxAxis);
            bbox.setFromObject(mroot);
            bbox.getCenter(cent);
            bbox.getSize(size);
            //Reposition to 0,halfY,0

            mroot.position.copy(cent).multiplyScalar(-1);
            mroot.position.y += (size.y * 0.5);
            mroot.position.y += 1;
            mroot.position.z = -30;

            // gltf.animations; // Array<THREE.AnimationClip>
            // gltf.scene; // THREE.Group
            // gltf.scenes; // Array<THREE.Group>
            // gltf.cameras; // Array<THREE.Camera>
            // gltf.asset; // Object

            // Start the model animation.
            action.play();

            // Add the animation mixer and clip action to our collections.
            g_AnimationMixers[urlToModel] = mixer;
            g_ClipActions[urlToModel] = action;

            g_ThreeJsScene.add( gltf.scene );

            console.info(`${errPrefix}Test GLTF model added to scene: ${urlToModel}.`);
        },
        // called while loading is progressing
        function ( xhr ) {
            const errPrefix = `(testGltf::processing) `;

            const pctLoaded = xhr.loaded / xhr.total * 100;

            console.info(`${errPrefix}Test GLTF model(${urlToModel}), percent loaded: ${pctLoaded}%.`);
        },
        // called when loading has errors
        function ( error ) {
            const errPrefix = `(testGltf::error) `;

            console.error( `${errPrefix}Error loading model: ${urlToModel}`);
            console.info(errPrefix + `error object:`);
            console.dir(error, {depth: null, colors: true});
        }
    );
}

export {
    addObjectToObjectsList,
    dumpPositionAndOrientation,
    g_AryHdriImageFilenames,
    initializeThreeJS,
    loadOneHdriImage,
    makeBoxInScene_original,
    removeObjFromSceneByUuid,
    testGltf
    };

// , g_ThreeJsCamera, g_ThreeJsScene, g_ThreeJsRenderer, g_ThreeJsControls, g_ThreeJsRaycaster, g_ThreeJsObjects };