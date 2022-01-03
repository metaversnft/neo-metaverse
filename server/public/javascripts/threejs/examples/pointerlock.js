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
    g_ThreeJsRaycaster,
    g_ThreeJsCamera,
    g_ThreeJsScene,
    g_ThreeJsRenderer,
    g_ThreeJsControls,
    assignThreeJsCamera, assignThreeJsScene, assignThreeJsControls, assignThreeJsRaycaster, assignThreeJsRenderer
} from "../../objects/three-js-global-objects.js";
import {g_AryBooths} from "../../booths/world-content.js";
import * as THREEJSSUPPORT from "../../threejs-support/threejs-support-code.js";
import {
    cardinalDirectionToRotation,
    getBoundingBoxOfThreeJsObject,
    rotateCardinalDirFromBaseDir, WORLD_AXIS_Y
} from "../../threejs-support/threejs-support-code.js";
import {g_BoothManager} from "../../booths/booth-manager.js";

const bVerbose = true;

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
    console.info(`${errPrefix}Setting position of sound belonging to object(${theLabel}) to:  `);
    console.info(errPrefix + `position object:`);
    console.dir(position, {depth: null, colors: true});

    console.info(`${errPrefix}Setting orientation of sound belonging to picture display(${theLabel}) to:   `);
    console.info(errPrefix + `orientation:`);
    console.dir(orientation, {depth: null, colors: true});
}

const g_ThreeJsObjects = [];

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
 * @param {String} idOfPictureDisplay - The ID of the picture display.
 * @param {String} srcUrlPicture - The URL of the picture to display.
 * @param {THREE.Vector3} position3D - The XYZ position of the picture display.
 * @param {THREE.Vector3} rotationEuler3D - The Euler angle in XYZ rotation
 *  precedence, that gives the orientation of the picture display. (i.e. -
 *  the direction it should point to.)
 * @param {String} surfaceName - The name of the surface that
 *  determines the direction the picture display will point to.
 *  E.g. - 'neg_x' will make the picture display face left.
 * @param {Number} widthOfPicture - The width of the surface that
 *  will show the picture.  The height will be automatically adjusted
 *  to keep a 4:3 aspect ratio.
 * @param {String} [srcUrlSound] - The URL of the sound to play. Optional.
 * @param {Boolean} bIsLooped - Whether the sound is looped. Optional.
 * @param {Boolean} bIsStoppedWhenDeactivated - Whether the sound is stopped
 *  when the picture display is deactivated. Optional.
 *
 * @returns {PictureDisplay} - Returns the PictureDisplay object that was created.
 */
function buildSimplePictureWithSound(
    idOfPictureDisplay,
    srcUrlPicture,
    position3D,
    rotationEuler3D,
    surfaceName,
    widthOfPicture,
    srcUrlSound=null, bIsLooped=false, bIsStoppedWhenDeactivated=true) {
    const errPrefix = `(buildSimplePictureWithSound) `;

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
    if (typeof widthOfPicture !== 'number')
    	throw new Error(errPrefix + `The value in the widthOfPicture parameter is not a number.`);
    if (widthOfPicture < 0)
        throw new Error(errPrefix + `The value in the widthOfPicture parameter is negative: ${widthOfPicture}.`);
    if (widthOfPicture === 0)
        throw new Error(errPrefix + `The value in the widthOfPicture parameter is zero.`);

    if (srcUrlSound && typeof srcUrlSound !== 'string')
        throw new Error(errPrefix + `The value in the srcUrlSound parameter is not NULL, yet it is not a string either.`);
    if (typeof bIsLooped !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsLooped parameter is not boolean.`);
    if (typeof bIsStoppedWhenDeactivated !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsStoppedWhenDeactivated parameter is not boolean.`);

    // const rotation = surfaceNameToRotation(surfaceName);

    // Create a cube assets pre-object that tells the picture display class
    //  how to build the picture display.
    const pictureDisplayContents = new CubeAssetsColorsOrUrls();

    // Just put a picture on the negative Z face of the cube.
    pictureDisplayContents.neg_z = srcUrlPicture;

    // Derive the height of the picture display from the width
    //  using a 4:3 aspect ratio.
    const heightFromWidth_4_3 = widthOfPicture * 3 / 4;

    // Adjust the Y value so that we don't end up with half the
    //  picture under the floor.
    const adjY = position3D.y + heightFromWidth_4_3 / 2;
    position3D.y += adjY;

    // ---------------------------- SOUND ----------------------------

    // The sound URL is optional.
    let soundToPlay = null;
    let funcActivateSound = null;
    let funcDeactivateSound = null;

    const newPictureDisplayObj = g_PictureDisplayManager.addPictureDisplay(
        idOfPictureDisplay,
        pictureDisplayContents,
        position3D,
        rotationEuler3D,
        new THREE.Vector3(widthOfPicture, heightFromWidth_4_3, 1));

    // Do we have a sound URL?
    if (!misc_shared_lib.isEmptySafeString(srcUrlSound)) {
        // Build a Howler object that will be tied to the picture display's
        //  ThreeJS avatar.
        soundToPlay = g_SoundPlayedByHowlerManager.addHowlerSound(srcUrlSound, newPictureDisplayObj.threeJsAvatar, idOfPictureDisplay, bIsLooped, bIsStoppedWhenDeactivated);

        // Use it's activate and deactivate functions as the picture display's
        //  activate and deactivate functions.
        newPictureDisplayObj.funcActivate = soundToPlay.notifyActivated;
        newPictureDisplayObj.funcDeactivate = soundToPlay.notifyDeactivated;
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
    addObjectToScene(box);
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
    addObjectToScene(box);
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
 * @param {Object} boothObj - The booth object.
 * @param {String} url - The URL to adjust.
 *
 * @return {string} - Returns a URL based off of the
 *  based directory made from the booth's ID.
 */
function resolveBoothUrl(boothObj, url) {
    const errPrefix = `(resolveBoothUrl) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(boothObj))
    	throw new Error(errPrefix + `The boothObj is not a valid object.`);

    if (misc_shared_lib.isEmptySafeString(boothObj.id))
        throw new Error(errPrefix + `The boothObj.id field is empty.`);

    if (misc_shared_lib.isEmptySafeString(url))
        throw new Error(errPrefix + `The url parameter is empty.`);

    const boothIdFormatted = boothObj.id.trim().toLowerCase();

    // Adjust for URLs that start with a backslahs.
    const url_2 = url.startsWith(`/`) ? url.substring(1) : url;

    // The URL is adorned to create the following format:
    //
    //   '/javascripts/booths/{booth_id}/{relative URL in booth JSON}'
    return `/javascripts/booths/${boothIdFormatted}/${url_2}`;
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

    // Create the walls by creating a picture display object for each wall.
    //
    // >>>>> OBJECT: Back wall 1
    const backWallObj_1 = buildSimplePictureWithSound(
        `${boothJsonObj.id}-back-wall-1`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.back_1.url),
        new THREE.Vector3(
            boothJsonObj.walls.back_1.x,
            boothJsonObj.walls.back_1.y,
            boothJsonObj.walls.back_1.z),
        // Before adjustment, the back wall faces south.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('south'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.back_1.size,
        null
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(backWallObj_1.threeJsAvatar);

    // Get the bounding boxes for back wall 1.
    const backWallOneBoundingBox_1 = getBoundingBoxOfThreeJsObject(backWallObj_1.threeJsAvatar, true);

    // Calculate the position of back wall 1's right edge.
    const backWallOneRightEdgeX = backWallOneBoundingBox_1.max.x;

    // >>>>> OBJECT: Back wall 2.  Positioned to the right of the back wall 1.
    const backWallObj_2 = buildSimplePictureWithSound(
        `${boothJsonObj.id}-back-wall-2`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.back_2.url),
        new THREE.Vector3(
            // Position it at the right edge of back wall 1 and compensate
            //  for the center of the back wall 1.
            backWallOneRightEdgeX + (boothJsonObj.walls.back_2.size / 2),
            boothJsonObj.walls.back_2.y,
            boothJsonObj.walls.back_2.z),
        // Before adjustment, the back wall faces south.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('south'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.back_2.size,
        null
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(backWallObj_2.threeJsAvatar);

    // Get the bounding boxes for back wall 2.
    const backWallTwoBoundingBox = getBoundingBoxOfThreeJsObject(backWallObj_2.threeJsAvatar, true);

    // Calculate the position of back wall 2's right edge.
    const backWallTwoRightEdgeX = backWallTwoBoundingBox.max.x;

    // >>>>> OBJECT: Side_1 wall - face NORTH initially.
    const sideWallOneObj = buildSimplePictureWithSound(
        `${boothJsonObj.id}-side-wall-1`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.side_1.url),
        // Position the first side wall at the left edge of the first
        //  back wall, which is the same as the origin X of the booth.
        //  Adjust for the center of side wall 1.
        new THREE.Vector3(
            // backWallTwoRightEdgeX + (boothJsonObj.walls.back_2.size / 2),
            boothOriginX - (boothJsonObj.walls.back_2.size / 4),
            boothOriginY,
            boothOriginZ - (boothJsonObj.walls.side_1.size / 4)),
        // Before adjustment, side wall 1 faces west.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('west'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.side_1.size,
        null
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(sideWallOneObj.threeJsAvatar);

    // >>>>> OBJECT: Side_2 wall - initially faces NORTH before adjustment.
    const sideWallTwoObj = buildSimplePictureWithSound(
        `${boothJsonObj.id}-side-wall-2`,
        resolveBoothUrl(boothJsonObj, boothJsonObj.walls.side_2.url),
        // Position the second side wall at the maximum X for back wall 2
        //  and apply the same adjustments.
        new THREE.Vector3(
            backWallTwoRightEdgeX,
            boothOriginY,
            boothOriginZ - (boothJsonObj.walls.side_1.size / 4),
        ),
        // Before adjustment, side wall 2 faces east.
        THREEJSSUPPORT.cardinalDirectionToEuler3D('east'),
        // Paint the picture on the surface that faces the default cardinal direction.
        THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
        boothJsonObj.walls.side_2.size,
        null
    );

    // Add it's avatar object to the booth group object.
    boothGroupObj.add(sideWallTwoObj.threeJsAvatar);

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

        if ('sound' in picture) {
            if (misc_shared_lib.isEmptySafeString(picture.sound.url))
                throw new Error(`${errPrefix}The picture at index(${pictureNum}) has an empty sound URL.`);

            urlToSound = picture.sound.url.trim();
            if ('is_looped' in picture.sound)
                isSoundLooped = picture.sound.is_looped.trim().toLowerCase() === 'true';
        }

        // Create a picture display object for each picture.
        const pictureObj = buildSimplePictureWithSound(
            picture.id,
            resolveBoothUrl(boothJsonObj, picture.url),
            // The picture must be offset the booth's origin.
            new THREE.Vector3(
                boothOriginX + picture.location.x,
                boothOriginY + picture.location.y,
                boothOriginZ + picture.location.z),
            // The picture initially faces the orientation specified in the JSON
            //  file.
            THREEJSSUPPORT.cardinalDirectionToEulerAngle(picture.facing),
            // Paint the picture on the surface that faces the default cardinal direction.
            THREEJSSUPPORT.extendedCardinalDirToSurfaceName(THREEJSSUPPORT.DEFAULT_CARDINAL_DIRECTION),
            picture.size,
            urlToSound,
            isSoundLooped
        );

        // Add it's avatar object to the booth group object.
        boothGroupObj.add(pictureObj.threeJsAvatar);

        pictureNum++;
    });

    // -------------------- END  : PICTURES ------------

    // -------------------- BEGIN: VIDEOS ------------

    // Process all the videos in the booth.
    let videoNum = 0
    boothJsonObj.videos.forEach(video => {
        if (misc_shared_lib.isEmptySafeString(video.id))
            throw new Error(`${errPrefix}The video at index(${videoNum}) has an empty ID.`);

        // Make sure the television display ID is unique.
        if (g_TelevisionDisplayManager.isExistingTelevisionId(video.id))
            throw new Error(`${errPrefix}The video at index(${videoNum}) has a duplicate ID: ${video.id}.`);

        // Create a television display object for each video.
        const videoObj = buildSimpleTelevision(
            video.id,
            resolveBoothUrl(boothJsonObj, video.url),
            // The video must be offset the booth's origin.
            new THREE.Vector3(
                boothOriginX + video.location.x,
                boothOriginY + video.location.y,
                boothOriginZ + video.location.z),
            // The video initially faces the orientation specified in the JSON
            //  file.
            THREEJSSUPPORT.cardinalDirectionToEulerAngle(video.facing),
            video.size
        );

        // Add it's avatar object to the booth group object.
        boothGroupObj.add(videoObj.threeJsAvatar);

        if (bVerbose)
            console.log(`${errPrefix}Television display created and added to scene for: ${video.id}`);

        videoNum++;
    });

    // -------------------- END  : VIDEOS ------------

    // Rotate the booth to face the PRIMARY_FACING direction.
    // console.warn(`${errPrefix}BOOTH ROTATION IS DISABLED!`);
    boothGroupObj.rotateOnAxis(WORLD_AXIS_Y, baseRotationAngle)

    // Add the booth to the scene.
    g_ThreeJsScene.add(boothGroupObj);
}

/**
 * Convert the content in the global booths definitions array
 *  into world content.
 */
function jsonWorldContentToScene() {
    const errPrefix = `(jsonWorldContentToScene) `;

    if (!g_AryBooths)
        throw new Error(errPrefix + `The global booths array is missing.`);

    // Process each booth.
    g_AryBooths.forEach(boothObj => {
        // Process each booth's content.
        buildOneBooth(boothObj);
    });
}

/**
 * Initialize the g_ThreeJsScene.
 */
/*
function initializeThreeJS_original() {
    const errPrefix = `(initializeThreeJS) `;

    g_ThreeJsCamera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 );
    g_ThreeJsCamera.position.y = 10;

    g_ThreeJsScene = new THREE.Scene();
    g_ThreeJsScene.background = new THREE.Color( 0xffffff );
    g_ThreeJsScene.fog = new THREE.Fog( 0xffffff, 0, 750 );

    const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 0.75 );
    light.position.set( 0.5, 1, 0.75 );
    g_ThreeJsScene.add( light );

    g_ThreeJsControls = new PointerLockControls( g_ThreeJsCamera, document.body );

    // Find the canvas for our ThreeJS g_ThreeJsScene.
    const threeJsCanvas = getThreeJsCanvasElement();
    jqThreeJsCanvas = $('#' + threeJsCanvas.id);

    // Find the row in the outer table where the instructions DIV lives.
    const instructionsRow = document.getElementById( INSTRUCTIONS_ROW_ID );
    if (!instructionsRow) {
        console.error(`${errPrefix} Unable to find the table row for the instructions DIV using ID: ${instructionsRow.id}.`);
        return;
    }

    // Find the place where we should put the instructions text.
    const instructionsDiv  = document.getElementById( INSTRUCTIONS_DIV_ID);
    if (!instructionsDiv) {
        console.error(`${errPrefix} Unable to find the instructions DIV using ID: ${instructionsDiv.id}.`);
        return;
    }
    const jqInstructions = $(`#${instructionsDiv.id}`);

    // If the user clicks on the instructions DIV (not table row), start playing and lock
    // the controls to the canvas window.
    instructionsDiv.addEventListener( 'click', function () {
        g_ThreeJsControls.lock();
    } );

    // Listen for the 'lock' event message from the controls module.
    g_ThreeJsControls.addEventListener( 'lock', function () {
        // We received the message from the controls object that tells us the
        //  controls have been locked.  This means the player wants to play.

        // Hide the outer table.
        $('#' + OUTER_TABLE_ID).hide();

        // Show the canvas.
        $('#' + THREEJS_CANVAS_ID).show();
    } );

    // We received the message from the controls object that the
    //  controls have been locked.  This means the player wants to play.
    g_ThreeJsControls.addEventListener( 'unlock', function () {
        // We received the message from the controls object that tells us the
        //  controls have been locked.  This means the player wants to stop playing.

        // Show the outer table.
        $('#' + OUTER_TABLE_ID).show();

        // Hide the canvas.
        $('#' + THREEJS_CANVAS_ID).hide();
    } );

    g_ThreeJsScene.add( g_ThreeJsControls.getObject() );

    // ROS: Keypress handlers.  The system does not move a certain number
    //  of units per keypress.  Instead, it applies a constant velocity
    //  as long as the key is held down.  The direction of the movement
    //  is determined by the key pressed.
    const onKeyDown = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;

            // ROS: Create a new box whenever the 'B' key is pressed.
            case 'KeyB':
                makeBoxInScene_original();
                break;
            case 'Space':
                if (canJump === true)
                    velocity.y += 350;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );

    g_ThreeJsRaycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );

    // floor

    let floorGeometry = new THREE.PlaneGeometry( 2000, 2000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );

    // vertex displacement
    let position = floorGeometry.attributes.position;

    for ( let i = 0, l = position.count; i < l; i ++ ) {
        vertex.fromBufferAttribute( position, i );

        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;

        position.setXYZ( i, vertex.x, vertex.y, vertex.z );
    }

    floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = floorGeometry.attributes.position;
    const colorsFloor = [];

    // Create the color pattern on the floor.
    for ( let i = 0, l = position.count; i < l; i ++ ) {
        color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75 );
        colorsFloor.push( color.r, color.g, color.b );
    }

    floorGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsFloor, 3 ) );

    const floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );

    const floor = new THREE.Mesh( floorGeometry, floorMaterial );

    // Add the floor to the g_ThreeJsScene.
    g_ThreeJsScene.add( floor );

    // objects

    // ROS: Made g_BoxGeometry a global variable so that it can be used
    //  on demand when a new conference participant is added.
    // const g_BoxGeometry = new THREE.BoxGeometry( 20, 20, 20 ).toNonIndexed();

    position = g_BoxGeometry.attributes.position;
    const colorsBox = [];

    // This puts the colors on the automatically generated boxes.
    for ( let i = 0, l = position.count; i < l; i ++ ) {
        color.setHSL( Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75 );
        colorsBox.push( color.r, color.g, color.b );
    }

    // Set the box color.
    g_BoxGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colorsBox, 3 ) );

    for (let i = 0; i < g_NumBoxesToAutoCreate; i ++ )
        makeBoxInScene_original(g_BoxGeometry);

    // Create the renderer.
    g_ThreeJsRenderer = new THREE.WebGLRenderer( { antialias: true } );
    g_ThreeJsRenderer.setPixelRatio( window.devicePixelRatio );
    // document.body.appendChild( renderer.domElement );
    threeJsCanvas.appendChild(g_ThreeJsRenderer.domElement);
    setRendererSize();

    // Watch for the resizing of the canvas.
    window.addEventListener( 'resize', onWindowResize );
}
*/

function initializeThreeJS() {
    const errPrefix = `(initializeThreeJS) `;

    assignThreeJsCamera(new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 ));
    g_ThreeJsCamera.position.y = 10;

    assignThreeJsScene( new THREE.Scene());
    g_ThreeJsScene.background = new THREE.Color( 0xffffff );
    g_ThreeJsScene.fog = new THREE.Fog( 0xffffff, 0, 750 );

    const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 0.75 );
    light.position.set( 0.5, 1, 0.75 );
    g_ThreeJsScene.add( light );

    assignThreeJsControls(new PointerLockControls( g_ThreeJsCamera, document.body ));

    // Find the canvas for our ThreeJS g_ThreeJsScene.
    const threeJsCanvas = getThreeJsCanvasElement();
    jqThreeJsCanvas = $('#' + threeJsCanvas.id);

    // Find the row in the outer table where the instructions DIV lives.
    /*
    const instructionsRow = document.getElementById( INSTRUCTIONS_ROW_ID );
    if (!instructionsRow) {
        console.error(`${errPrefix} Unable to find the table row for the instructions DIV using ID: ${instructionsRow.id}.`);
        return;
    }

    // Find the place where we should put the instructions text.
    const instructionsDiv  = document.getElementById( INSTRUCTIONS_DIV_ID);
    if (!instructionsDiv) {
        console.error(`${errPrefix} Unable to find the instructions DIV using ID: ${instructionsDiv.id}.`);
        return;
    }
    const jqInstructions = $(`#${instructionsDiv.id}`);

    // If the user clicks on the instructions DIV (not table row), start playing and lock
    // the controls to the canvas window.
    instructionsDiv.addEventListener( 'click', function () {
        g_ThreeJsControls.lock();
    } );
     */


    g_ThreeJsScene.add( g_ThreeJsControls.getObject() );

    assignThreeJsRaycaster(new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 ));

    // BASIC WORLD OBJECTS
    // LIGHT
    //let light = new THREE.PointLight(0xffffff);
    //light.position.set(100,250,100);
    //g_ThreeJsScene.add(light);

    // FLOOR
    // server/public/images/three-js-simple/checkerboard.jpg
    let floorTexture = new THREE.ImageUtils.loadTexture( '/images/three-js-simple/checkerboard.jpg' );
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 10, 10 );
    let floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
    let floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    let floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.5;
    floor.rotation.x = Math.PI / 2;
    g_ThreeJsScene.add(floor);

    // SKYBOX
    let skyBoxGeometry = new THREE.CubeGeometry( 10000, 10000, 10000 );
    let skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0x9999ff, side: THREE.BackSide } );
    let skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
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

    // TODO: NEED FLOOR!

    // Add the floor to the g_ThreeJsScene.
    g_ThreeJsScene.add( floor );

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
        addObjectToScene(televisionObj.threeJsAvatar);

        // Add a picture display to the scene that plays a bell when you approach it
        //  and doesn't stop until you leave.
        const pictureObj = buildSimplePictureWithSound(
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
        addObjectToScene(pictureObj.threeJsAvatar);
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

    setRendererSize();
}

/**
 * Add a non-environment object to the g_ThreeJsScene.  These are objects
 *  that are dynamically created and need to have intersection
 *  checks done on them, unlike objects such as the floor,
 *  the lights, etc.
 *
 *  NOTE: If the object is a child of a group, it will NOT be added to the
 *   scene!  Otherwise it will be double-added
 *   when the group object is added to the scene!
 *
 * @param {Object} newObject - The object to add to the g_ThreeJsScene.
 *
 */
function addObjectToScene(newObj) {
    const errPrefix = `(addObjectToScene) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(newObj))
    	throw new Error(errPrefix + `The newObj parameter does not contain a valid object.`);

    if (newObj.parent && newObj.parent.isGroup) {
        // The object is a child of a group.  Don't add it to the scene.
        return;
    }

    g_ThreeJsScene.add(newObj);
    g_ThreeJsObjects.push(newObj);
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

// Start the g_ThreeJsScene.
initializeThreeJS();

// The animate call has been moved to the document ready handler of the web page.
// animate();

// Hide the playground.
jqThreeJsCanvas.hide();

export {
    addObjectToScene,
    dumpPositionAndOrientation,
    makeBoxInScene_original,
    removeObjFromSceneByUuid,
    g_ThreeJsObjects};

// , g_ThreeJsCamera, g_ThreeJsScene, g_ThreeJsRenderer, g_ThreeJsControls, g_ThreeJsRaycaster, g_ThreeJsObjects };