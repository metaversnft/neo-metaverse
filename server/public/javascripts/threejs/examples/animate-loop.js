// The animateLoop loop was moved to a separate module to break circular dependencies between
//  pointerlock.js and the ThreeJS objects we create.

import {
    g_ParticipantWrapperManager,
    getLocalUserParticipantId
} from "../../participant-helpers/participant-helper-objects.js";
import {g_TelevisionDisplayManager, TelevisionDisplay} from "../../objects/television.js";
import {g_PictureDisplayManager} from "../../objects/picture-display.js";

import * as POINTERLOCK from "./pointerlock.js";
import {makeBoxInScene_original, testGltf} from "./pointerlock.js";
import {
    g_AnimationMixers,
    g_ClipActions,
    g_LocalUserParticipantWrapperObj,
    g_ThreeJsCamera,
    g_ThreeJsClock,
    g_ThreeJsObjects,
    g_ThreeJsScene,
    g_ThreeJsRenderer,
    g_ThreeJsControls,
    g_ParticipantWrapperObjsInScene,
    g_ThreeJsAvatarObjectsInScene,
    assignLocalUserParticipantWrapperObj,
    clearParticipantWrapperObjsInScene,
    clearThreeJsAvatarObjectsInScene,
} from "../../objects/three-js-global-objects.js";

import * as THREE from '../build/three.module.js';
import {
    g_SoundPlayedByHowlerManager,
    setListenerPositionAndOrientation
} from "../../sound-effects-support/howler-support.js";
import {
    dolbyIoParticipantsMapToArray,
    isLocalUserInConference,
    ParticipantStatuses,
    RemoteParticipantUpdate,
    sendVoxeetCommand
} from "../../dolby-io/dolby-io-support.js";
import {
    doPostUnlockProcessing,
    g_IsSpatialAudioEnabbled,
    muteOrUnmuteMicrophone,
    setLocalUserSpatialAudioPosition,
    startStopVideo
} from "../../dolby-io/ui.js";
import {g_GlobalState} from "../../objects/global-state.js";
import {g_RolesList} from "../../roles/user-roles.js";
import {
    getNeo3DParentObj,
    isOwnedByParticipantWrapper,
    isOwnedByPictureDisplay,
    isOwnedByTelevisionDisplay
} from "../../objects/object-detectors.js";
import {
    raycasterDetailsToString,
    setRaycasterOriginToTargetObj,
    vec3ToString
} from "../../threejs-support/threejs-support-code.js";
import {trueDistanceFromObject3D} from "../../objects/object-participant-support.js";
import {g_NftManagerForGhostmarket} from "../../neo/nft/buy-ghostmarket-nft.js";
import {
    g_GhostMarketApiHelper,
    testGhostMarketAssetCall_promise,
    testNftBid_async
} from "../../ghostmarket/ghostmarket-api-helper.js";
import {flashBuyButton} from "../../page-support/neoland-page-support.js";
import {g_NeoLineHelper} from "../../neo/neoline-helpers.js";

const errPrefix = '(animate-loop) ';

// TODO: Create a better away to set the NFT auction ID on Ghostmarket
//  than the current technique of passing it as a GET argument.
const urlArgs = getUrlArguments();

let currentNftAuctionIdStr = urlArgs['auction_id'];
let currentNftAuctionId = null;

try {
    if (!misc_shared_lib.isEmptySafeString(currentNftAuctionIdStr)) {
        currentNftAuctionId = parseInt(currentNftAuctionIdStr);
        console.info(`${errPrefix}Current NFT auction ID is: ${currentNftAuctionId}`);
    }
}
catch(err) {
        console.warn(`${errPrefix} Did not find an auction ID in the URL query arguments.`);
}


// This variable helps doing custom tracing in Chrome DevTools.
//  See the keystroke processing code to see which keystroke
//  sets this variable to TRUE.  Then, put a block of code
//  in the part of the code that you want to dynamically
//  trigger a breakpoint like this:
/*
    if (g_BreakHerePlease)
        // This aids tracing using Chrome DevTools.  See pointerlock.js
        //  for the keystroke that sets g_BreakHerePlease to TRUE.
        console.info(`${errPrefix}Set DevTools breakpoint here.`);
 */
let g_BreakHerePlease = false;

// This constant controls how long we wait before making an update
//  call to the DolbyIO spatial audio API with the local user's
//  current position.
const SPATIAL_AUDIO_UPDATE_INTERVAL_MS = 1000;

// This is how long we will wait in seconds before logging the local user
//  automatically out of a conference if they have not spoken
//  or made a significant movement.
const AUTO_LOGOUT_DELAY_SECONDS = 60 * 10; // 10 minutes.

// This controls the speed at which a follower will pursue
//  the leader each animation frame.
const FOLLOWER_LERP_ALPHA = 0.01;

// When we are this close or closer to the leader we will stop
//  following the leader.
const FOLLOWER_COMFORT_ZONE_DISTANCE = 20;

const bVerbose = false;

// Controls lerp mode, used mostly for testing FOLLOWER mode.
let bLerp = true;

// Reuse these variables to save on new object creations.
let vecCameraWorldDirBefore = new THREE.Vector3();
let vecCameraWorldDir = new THREE.Vector3();
let vecCameraWorldPos = new THREE.Vector3();
let vecLeaderWorldPos = new THREE.Vector3();
let vecToLookAtPos = new THREE.Vector3();
let vecObjWorldPos = new THREE.Vector3();


// These are the variables that support the movement system.
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

// For raycasting operations.
let ourRaycaster = new THREE.Raycaster();

// This variable tracks the time between animateLoop() calls.
let prevTime = performance.now();

// This variable tracks the time between DolbyIO spatial audio API
//  updates, to help with throttling the update calls so we don't
//  overload the API and get a 400 error.
let lastSpatialAudioUpdateTime = performance.now();

// The animation loop will keep this updated so that
//  we always have quick access to our DolbyIO
//  participant ID for the local user.
let g_LocalUserParticipantId = null;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

let bWasLoggedOutAlready = false;

const g_Raycaster = new THREE.Raycaster();
const g_Mouse = new THREE.Vector2();

/**
 * Simple object that is send across the broadcast system
 *  when a LEADER wants the FOLLOWERS to start/resume
 *  FOLLOWING or stop FOLLOWING.
 *
 * @param {String} statusOnOff - 'on' to start/resume
 *  following, 'off' to stop following.
 *
 * @constructor
 */
function FollowerModeUpdate(statusOnOff) {
    if (misc_shared_lib.isEmptySafeString(statusOnOff))
        throw new Error(errPrefix + `The status parameter is empty.`);

    if (!['on', 'off'].includes(statusOnOff))
        throw new Error(errPrefix + `The statusOnOff parameter is invalid: ${statusOnOff}.`);

    /** @property {String} - 'on' to start/resume following, 'off' to stop followinwg */
    this.status = statusOnOff;
}

/**
 * This function is called when the mouse moves.  It keeps
 *  track of the current mouse coordinates to facilitate
 *  ray tracing operations.
 *
 * @param {Object} event - The mouse event object.
 */
function onMouseMoveForAnimateLoop( event ) {

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    g_Mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    g_Mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

/**
 * Update the diagnostics panel with important information about the
 *  system.
 *
 * @param {String} g_LocalUserParticipantId - The current local user
 *   participant ID.
 */
function updateDiagnosticsPanel(currentLocalUserParticipantId) {
    const errPrefix = `(updateDiagnosticsPanel) `;

    if (!misc_shared_lib.isEmptySafeString(currentLocalUserParticipantId)) {
        $('#sfx-diagnostics').html(`<p><b>Local user participant ID:</b>${currentLocalUserParticipantId}</p>`);
    }

}

/**
 * Reset all the keys, in case one of them has gotten "stuck".
 */
const resetKeys = function() {
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    canJump = false;
};

// ROS: Keypress handlers taken from pointerlock.js.  The
//  system does not move a certain number
//  of units per keypress.  Instead, it applies a constant velocity
//  as long as the key is held down.  The direction of the movement
//  is determined by the key pressed.
const onKeyDown = async function ( event ) {
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

        case 'KeyB':
            // Purchase an NFT.
            // g_NftManagerForGhostmarket.purchaseNFt();

            // TODO: Testing some Ghostmarket API calls for now.
            // testGhostMarketAssetCall_promise();

            // Do they have Neoline installed?
            if (g_NeoLineHelper.isNeoLineReady) {
                flashBuyButton();
                testNftBid_async(currentNftAuctionId);
            } else {
                alert(`You need to have the Neoline extension installed to buy NFTs.`);
                return;
            }
            break;

        case 'KeyG':
            // Set/Unset the flag that assists with custom tracing in Chrome DevTools.
            g_GlobalState.breakHerePlease = !g_GlobalState.breakHerePlease;
            break;

        case 'KeyF':
            // Toggle the FOLLOW mode state tracker variable.
            g_GlobalState.isFollowingByFollowersDesired = !g_GlobalState.isFollowingByFollowersDesired;

            if (g_GlobalState.isFollowingByFollowersDesired) {
                // Tell all followers to start/resume following the leader.
                sendVoxeetCommand(new FollowerModeUpdate('on'));

                console.info(`${errPrefix}Following mode STARTED/RESUMED.`);
            } else {
                // Tell all followers to stop following the leader.
                sendVoxeetCommand(new FollowerModeUpdate('off'));

                console.info(`${errPrefix}Following mode STOPPED.`);
            }
            break;
        case 'KeyI':
            // Dump all the objects the camera is looking at.
            // Set the direction of the picking ray from the position and orientation of the
            //  participant's avatar object to the target object.
            ourRaycaster.setFromCamera(g_Mouse, g_ThreeJsCamera);
            // setRaycasterOriginToTargetObj(ourRaycaster, theParticipantWrapperObj.threeJsAvatar, targThreeJsObj);

            if (g_GlobalState.breakHerePlease) {
                const raycasterDetailsStr = raycasterDetailsToString(ourRaycaster);
                console.info(`${errPrefix}Raycaster details - ${raycasterDetailsStr}`);
            }

            // Is the participant looking at the target object with no objects in between?  If there
            //  are no objects in between the participant and the target object, then the participant
            //  should be the first element of the intersection array.
            const aryObjectsLookedAt = ourRaycaster.intersectObjects(g_ThreeJsObjects, true);

            console.info(`================ BEGIN: RAYCAST RESULTS  =====================`);

            if (aryObjectsLookedAt && aryObjectsLookedAt.length > 0) {
                aryObjectsLookedAt.forEach((objLookedAt) => {
                    const neo3DObj = getNeo3DParentObj(objLookedAt.object);

                    const instanceTypeOrName = neo3DObj.constructor.name ? neo3DObj.constructor.name : neo3DObj.name;
                    const idOfObject = neo3DObj.idOfObject ? neo3DObj.idOfObject : '(idOfObject field not found)';

                    if (neo3DObj)
                        console.info(`${errPrefix}Camera is looking at object type([${instanceTypeOrName}]) with ID: ${idOfObject}.`);
                });

            } else {
                console.warn(`${errPrefix}No objects looked at.`);
            }
            console.info(`================  END: RAYCAST RESULTS  =====================`);
            break;
        case 'KeyL':
            // Toggle Lerp ON/OFF for those participants that are in FOLLOWER mode.
            bLerp = !bLerp;
            break;
        // ROS: Mute/unmute the microphone.
        case 'KeyM':
            muteOrUnmuteMicrophone();
            break
        // ROS: Reset the camera to the default position.
        case 'KeyR':
            g_ThreeJsCamera.position.set( 0, 0, 0 );
            g_ThreeJsCamera.rotation.set( 0, 0, 0 );
            resetKeys();
            break;
        // ROS: Teleport to the desired location..
        case 'KeyT':
            /* NEO SMART ECONOMY BOOTH
            g_ThreeJsCamera.position.set( 5, 10, -508 );
            g_ThreeJsCamera.rotation.set( 0, 0.02, 0 );

            Position: 38.49198297771283, 10, -390.08445300270375, Rotation: -2.2594967712047125, 1.5060172599284252, 2.260527223390817
             */
            // ToTheMoon Universe booth.
            // g_ThreeJsCamera.position.set( 29, 10, -390 );
            // g_ThreeJsCamera.rotation.set( -2.26, 1.5, 2.26 );

            // g_ThreeJsCamera.position.set( -54.75938473118033, 10, -173.9651652641706 );
            // g_ThreeJsCamera.rotation.set( 0.22549999999999978, 1.5555401367686108e-16, -3.179106723449991e-17 );

            // intersectObjects() returns nothing.
            // g_ThreeJsCamera.position.set( -48.30455964483913, 10, -476.24551909713205 );
            // g_ThreeJsCamera.rotation.set( 0.029262175218430882, 0.13394331749361335, -0.003908859427330066 );

            // NEO Devcon 2019 video in the NNT booth.
            // g_ThreeJsCamera.position.set( -55.4473819455961, 10, -172.15814801798007 );
            // g_ThreeJsCamera.rotation.set( 0.1945015170629249, 0.003924577329778429, -0.0007731079169285207 );

            // Left mirror.
            // g_ThreeJsCamera.position.set( 29.64845034603772, 10, -244.6419912367911 );
            // g_ThreeJsCamera.rotation.set( -0.8477796280201201, 1.5514576478510764, 0.8476868517594434 );

            // Da Hong Fei picture.
            // g_ThreeJsCamera.position.set( -3.2643052282827476, 10.000000000000004, -553.6757047623339 );
            // g_ThreeJsCamera.rotation.set( 0.12300219176933852, 0.0059546696549833905, -0.0007361492409785167 );

            // NFT Showcase.
            // g_ThreeJsCamera.position.set( 990.7345301597753, 10, -234.8214395796359 );
            // g_ThreeJsCamera.rotation.set( -2.8971618123947107, 1.3479923364318556, 2.902974280432254 );

            // testGltf();

            // Test getting the details for a specific NFT auction.
            const auctionDetailsObj = await g_GhostMarketApiHelper.getAuctionDetails_promise('somniumwave', 136, true)
            .catch(err => {
                // Convert the error to a promise rejection.
                let errMsg =
                    errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

               console.error(errMsg + ' - promise');
            });

            console.info(errPrefix + `auctionDetailsObj object:`);
            console.dir(auctionDetailsObj, {depth: null, colors: true});

            break;
        // ROS: Turn the camera ON and OFF.
        case 'KeyV':
            startStopVideo();
            break
        case 'KeyX':
            // Update the display of the current listener position and
            //  orientation and the sound effect(s) belonging to
            //  certain objects in the world.  In this case,
            //  'picture-with-looping-bell-1'
            const idOfDesiredAsset = 'picture-with-looping-bell-1';
            const aryAttachedSoundObjs = g_SoundPlayedByHowlerManager.findSoundsBelongingToThreeJsObjId(idOfDesiredAsset);

            const howlListenerPosition = g_SoundPlayedByHowlerManager.getHowlListenerPosition3D();
            const howlListenerOrientation = g_SoundPlayedByHowlerManager.getHowlListenerOrientation3D();

            console.warn(`${errPrefix}[HOWL LISTENER] - position: ${howlListenerPosition.x}, ${howlListenerPosition.y}, ${howlListenerPosition.z} - orientation: ${howlListenerOrientation.x}, ${howlListenerOrientation.y}, ${howlListenerOrientation.z}`);
            
            // Create the statements for a Teleport command using the camera..
            console.info(`g_ThreeJsCamera.position.set( ${g_ThreeJsCamera.position.x}, ${g_ThreeJsCamera.position.y}, ${g_ThreeJsCamera.position.z} );`);
            console.info(`g_ThreeJsCamera.rotation.set( ${g_ThreeJsCamera.rotation.x}, ${g_ThreeJsCamera.rotation.y}, ${g_ThreeJsCamera.rotation.z} );`);

            // Show the camera world direction.
            vecCameraWorldDir = g_ThreeJsCamera.getWorldDirection( vecCameraWorldDir );
            const vecCameraWorldDirStr = vec3ToString( vecCameraWorldDir );

            console.info(`${errPrefix}Camera world direction: ${vecCameraWorldDirStr}.`);

            if (aryAttachedSoundObjs.length > 0) {
                aryAttachedSoundObjs.forEach((soundPlayByHowlObj) => {
                    const thePos = soundPlayByHowlObj.getPosition3D();
                    const theOrientation = soundPlayByHowlObj.getOrientation3D();
                    console.warn(`${errPrefix}[${idOfDesiredAsset}] - position: ${thePos.x}, ${thePos.y}, ${thePos.z} - Howl3D orientation: ${theOrientation.x}, ${theOrientation.y}, ${theOrientation.z}`);
                });
            } else {
                console.warn(`${errPrefix}Unable to find the picture-with-looping-bell-1 sound.`);
            }

            // Now show the position and orientation of each remote participant.
            const aryParticipantStatus = g_ParticipantWrapperManager.toStringArray();

            aryParticipantStatus.forEach((participantStatus) => {
                console.info(participantStatus);
            });

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

// These variables track the last camera position and rotation.
let lastCameraPosition = new THREE.Vector3();
let lastCameraRotation = new THREE.Vector3();

// The code related to moving the camera positionally,
//  not rotationally, seems to have a "settling in"
//  period or jitter.  For camera's position change
//  to be considered significant, the change must be
//  greater than this threshold in at least one
//  dimension.
//
// NOTE: This phenomenon is not present in the rotation.
const MIN_SIGNIFICANT_COORDINATE_CHANGE = 0.01;

/**
 * Helper function to make the code that detects only significant changes in
 *  the camera's position easier to read.
 *
 * @param {Number} oldCoordinate - The old coordinate value.
 * @param {Number} newCoordinate - The new coordinate value.
 *
 * @return {boolean} - Returns TRUE if the change is significant,
 *  FALSE otherwise.
 */
function isSignificantCoordinateChange(oldCoordinate, newCoordinate) {
    return Math.abs(newCoordinate - oldCoordinate) > MIN_SIGNIFICANT_COORDINATE_CHANGE;
}

/**
 * This variable is used to track the current state of the camera in the
 *  world and to detect changes in the camera's position and rotation
 *  and perhaps other details that may require various actions to
 *  be taken.  For example, updating the other participants in the
 *  conference as to the current camera position and rotation in the
 *  virtual world.
 *
 * @constructor
 */
function CameraStateTracker() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {THREE.Vector3} - The camera position at some point in time. */
    this.cameraPosition = new THREE.Vector3();

    /** @property {THREE.Vector3} - The camera rotation at some point in time. */
    this.cameraRotation = new THREE.Vector3();

    /**
     * This function is called whenever the camera's position or rotation changes
     *  in a significant way.
     *
     * @param {THREE.Camera} theCamera - The ThreeJS camera object.
     *
     * @return {boolean} - Returns TRUE if the camera's position or rotation
     *  has changed in a significant way, FALSE otherwise.
     */
    this.updateState = function(theCamera) {
        const methodName = self.constructor.name + '::' + `updateState`;
        const errPrefix = '(' + methodName + ') ';

        if (!(theCamera instanceof THREE.Camera))
            throw new Error(errPrefix + `The value in the theCamera parameter is not a THREE.Camera object.`);

        let bChangeDetected = false;

        // Check to see if the camera position has changed and
        //  if so, update the camera position we carry, but only
        //  if the change is significant and not just jitter
        //  or due to hysteresis in the system.
        if (isSignificantCoordinateChange(theCamera.position.x, self.cameraPosition.x) ||
            isSignificantCoordinateChange(theCamera.position.y, self.cameraPosition.y) ||
            isSignificantCoordinateChange(theCamera.position.z, self.cameraPosition.z)) {
            self.cameraPosition.copy(theCamera.position);
            bChangeDetected = true;
        }

        // Check to see if the camera rotation has changed and
        //  if so, update the camera rotation we carry.
        if (theCamera.rotation.x !== self.cameraRotation.x ||
            theCamera.rotation.y !== self.cameraRotation.y ||
            theCamera.rotation.z !== self.cameraRotation.z) {
            self.cameraRotation.copy(theCamera.rotation);
            bChangeDetected = true;
        }

        // TODO: Remove this when we know this code works.
        /*
        if (bChangeDetected) {
            console.info(`${errPrefix}Camera change detected.`);
            console.info(`${errPrefix}Camera position: ${self.cameraPosition.x}, ${self.cameraPosition.y}, ${self.cameraPosition.z}`);
            console.info(`${errPrefix}Camera rotation: ${self.cameraRotation.x}, ${self.cameraRotation.y}, ${self.cameraRotation.z}`);
        }
        */

        // Let the caller know if we detected a change in the camera state.
        return bChangeDetected;
    }
}

/**
 * Process an update notification object from a remote participant.
 *
 * @param {RemoteParticipantUpdate} remoteParticipantUpdateObj - The
 *  remote update notification object for a remote participant
 *  received from the conference broadcast system.
 *
 */
function processRemoteParticipantUpdate(remoteParticipantUpdateObj) {
    const errPrefix = `(processRemoteParticipantUpdate) `;

    if (!(remoteParticipantUpdateObj instanceof RemoteParticipantUpdate))
        throw new Error(errPrefix + `The value in the remoteParticipantUpdateObj parameter is not a RemoteParticipantUpdate object.`);

    // Find the participant with the matching participant ID.
    let remoteParticipantObj = g_ParticipantWrapperManager.findParticipantWrapperById(remoteParticipantUpdateObj.participantId);

    if (!remoteParticipantObj) {
        // We don't have a participant with the matching ID.
        //  Create a new participant object by adding one now.

        // Get the list of participants in the conference  from the Voxeet SD.
        const mapParticipants = VoxeetSDK.conference.participants;

        // Find the VoxeetSDK object with the matching participant ID.
        const voxeetSDKParticipantObj = mapParticipants.get(remoteParticipantUpdateObj.participantId);

        // If the VoxeetSDK object is not found then this is an error or they
        //  left the conference.  Either way, print a warning message and exit.
        if (!voxeetSDKParticipantObj) {
            console.warn(`${errPrefix}No VoxeetSDK participant object found with ID: ${remoteParticipantUpdateObj.participantId}`);
            return;
        }

        let theVideoStream = null;

        // Get a reference to the video stream if one exists for this participant.
        if (voxeetSDKParticipantObj.streams && voxeetSDKParticipantObj.streams > 0)
            // TODO: Ask Dolby IO when the user might have more than one stream.
            //  For now, just take the first one.
            theVideoStream = voxeetSDKParticipantObj.streams[0];

        // Add a new participant object for this remote participant.
        remoteParticipantObj = g_ParticipantWrapperManager.addParticipant(voxeetSDKParticipantObj, theVideoStream);
    }

    // Change the remote participant's avatar to match the position and
    //  rotation of the remote participant's camera in the ThreeJS scene.
    remoteParticipantObj.updateAvatar(remoteParticipantUpdateObj);

    // Carry over any custom data from the remote participant.
    remoteParticipantObj.customDataFromRemote = remoteParticipantUpdateObj.customData;
}

/**
 * DEPRECATED:  See the RequestRemoteParticipantStatuses() object.
 *
 * Adjust the ThreeJS scene to match the state of the DolbyIO conference.
 *  This method should be called from the then-block attached to the
 *  VoxeetSDK.conference.join() call, so that the the ThreeJS world is
 *  updated properly when the user successfully joins a conference.
 *
 * @param {Object} joinedRetObj - This is the object returned by the
 *  VoxeetSDK.conference.join() call if the join was successful.
 *
 *
function updateThreeJsSceneFromConference(joinedRetObj) {
    const errPrefix = `(updateThreeJsSceneFromConference) `;

    try {
        // Add avatars for  all the participants found in the
        //  conference participants list that are not currently
        //  in the ThreeJS scene.

        // Get the list of participants in the conference but do not
        //  include the local user, since we don't create an avatar
        //  for the local user.
        const aryParticipants = dolbyIoParticipantsMapToArray(false);

        aryParticipants.forEach(participantObj => {
            // If a participant is in the conference their "status" field
            //  will be set to "Connected".  The other status we have seen
            //  so far is "Left", for those participants that have left the
            //  conference.
            //
            //  TODO: NOTE - If you refresh the page, you get a NEW
            //  participant ID from the VoxeetSD so if you rejoin the conference,
            //  you will be treated as a new participant.  We will need our own
            //  persistent ID to over come this deficit.

            if (participantObj.status === ParticipantStatuses.CONNECTED) {
                // Is the participant already in the ThreeJS scene?
                if (g_ParticipantWrapperManager.isExistingParticipant(participantObj.id)) {
                    // Existing participant.  Ignore them.
                } else {
                    // Add an avatar to the ThreeJS scene for them.
                    console.info(`${errPrefix}Creating avatar for remote participant already in the conference: ${participantObj.info.name}`);

                    // TODO: What if there is more than one stream in the streams[] array?
                    const theVideoStream = participantObj.streams.length > 0 ? participantObj.streams[0] : null;
                    g_ParticipantWrapperManager.addParticipant(participantObj, theVideoStream); // stream);
                }
            }
        });
    } catch (err) {
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(errMsg);
    };
}
*/

// -------------------------------- ANIMATION LOOP --------------------------------

// Track the state of the camera.
let g_CameraStateTracker = new CameraStateTracker();

// Array used to create start/stop speaking events from the is-speaking interval below.
let g_AryParticipantsSpeakingStatuses = [];

// Create a loop to track, which participants are currently speakign.
const isSpeakingIntervalErrorPrefix = `(isSpeakingInterval) `;
setInterval(() => {
    if (!isLocalUserInConference())
        return; // Not in a conference.

    let participants = VoxeetSDK.conference.participants;
    for (let participant of participants) {
        VoxeetSDK.conference.isSpeaking(
            VoxeetSDK.conference.participants.get(participant[0]),
            (isSpeaking) => {
                const participantRef = participant[0];
                let previousIsSpeakingStatus = g_AryParticipantsSpeakingStatuses[participantRef];
                const participantWrapperObj = g_ParticipantWrapperManager.findParticipantWrapperById(participantRef);

                if (isSpeaking) {

                    // Convert uninitialized slots in the g_AryParticipantsSpeakingStatuses object as
                    //  array to FALSE.
                    if (!previousIsSpeakingStatus)
                        previousIsSpeakingStatus = false;

                    // Just started speaking?
                    if (!previousIsSpeakingStatus) {
                        // Yes.  Log the occurrence.
                        console.info(`${isSpeakingIntervalErrorPrefix}Participant ${participantRef} STARTED speaking.`);

                        // Notify the participant's wrapper object that they just started speaking.
                        if (participantWrapperObj)
                            participantWrapperObj.notifyStartedSpeaking();
                    }
                } else {
                    // Just stopped speaking?
                    if (previousIsSpeakingStatus) {
                        // Yes.  Log the occurrence.
                        console.info(`${isSpeakingIntervalErrorPrefix}Participant ${participantRef} STOPPED speaking.`);

                        // Notify the participant's wrapper object that they just started speaking.
                        if (participantWrapperObj)
                            participantWrapperObj.notifyStoppedSpeaking();
                    }
                }

                g_AryParticipantsSpeakingStatuses[participantRef] = isSpeaking;
            }
        );
    }
}, 500);

/**
 * Facilitate the animation playing of any GLTF animations we loaded.
 */
function doGltfAnimations() {
    const errPrefix = `(doGltfAnimations) `;

    for (let animMixerId in g_AnimationMixers) {
        const mixer = g_AnimationMixers[animMixerId];

        mixer.update( g_ThreeJsClock.getDelta() );
    }
}



/**
 * Animate the g_ThreeJsScene.
 */
async function animateLoop() {
    const errPrefix = `(animateLoop) `;

    try {
        // Is the flag set that stops rendering?
        if (g_GlobalState.setRenderDisableFlag())
            // Yes, just exit.
            return;

        requestAnimationFrame(animateLoop);

        const currentAnimLoopTime = new Date();

        // Keep the local user participant ID variable updated.
        const currentId = getLocalUserParticipantId();

        // Keep the local user participant object variable updated.
        assignLocalUserParticipantWrapperObj(g_ParticipantWrapperManager.getLocalUserParticipantWrapper());

        // If it has changed, show it in the diagnostics panel.
        if (currentId !== g_LocalUserParticipantId) {
            g_LocalUserParticipantId = currentId;
            updateDiagnosticsPanel(g_LocalUserParticipantId);
        }

        // Keep the list of participant wrapper objects in the scene
        //  and the list of ThreeJS avatar objects that belong to each
        //  participant in the scene updated.  Clear the current contents
        //  first.
        clearThreeJsAvatarObjectsInScene();
        clearParticipantWrapperObjsInScene();

        if (isLocalUserInConference()) {
            // Convert the Voxeet participants array to an array of ThreeJS objects.
            const aryParticipants = dolbyIoParticipantsMapToArray();

            aryParticipants.forEach((participant) => {
                // Find our participant wrapper object for this Voxeet participant.
                const participantWrapperObj = g_ParticipantWrapperManager.findParticipantWrapperById(participant.id);

                if (participantWrapperObj) {
                    // Add it.
                    g_ParticipantWrapperObjsInScene.push(participantWrapperObj);
                    g_ThreeJsAvatarObjectsInScene.push(g_LocalUserParticipantWrapperObj.threeJsAvatar)
                }
            });
        }

        const currentTime = performance.now();

        // Keep any GLTF animations running.
        doGltfAnimations();

        // ----------------- LOCAL USER ROLE BEHAVIORS -----------------


        // >>>>> ROLE: FOLLOWER

        // If the local user is a follower, then look for a leader near to us.
        if (g_GlobalState.localUserRoles.includes(g_RolesList.FOLLOWER)) {

            // Is FOLLOWING mode on?
            if (g_GlobalState.isFollowerFollowing) {
                // We are a follower and we are following.  Is there a leader near us?
                const leaderParticipantWrapperObj =
                    g_ParticipantWrapperManager.findFirstLeaderNearUs();

                if (leaderParticipantWrapperObj) {
                    vecCameraWorldDirBefore = g_ThreeJsCamera.getWorldDirection(vecCameraWorldDirBefore);

                    if (bVerbose) {
                        const vecCameraWorldDirAfterStr = vec3ToString(vecCameraWorldDirBefore);
                        console.info(`${errPrefix}vecCameraWorldDirBefore: ${vecCameraWorldDirAfterStr}`);
                    }

                    // Look at the leader.
                    g_ThreeJsCamera.lookAt(leaderParticipantWrapperObj.threeJsAvatar.position);

                    // Move towards the leader along the direction we are now looking in (at
                    //  the leader).
                    vecCameraWorldDir = g_ThreeJsCamera.getWorldDirection(vecCameraWorldDir);
                    vecCameraWorldPos = g_ThreeJsCamera.getWorldPosition(vecCameraWorldPos);

                    vecLeaderWorldPos = leaderParticipantWrapperObj.threeJsAvatar.getWorldPosition(vecLeaderWorldPos);

                    if (bVerbose) {
                        const vecCameraWorldDirAfterStr = vec3ToString(vecCameraWorldDir);
                        console.info(`${errPrefix}vecCameraWorldDir(after)): ${vecCameraWorldDirAfterStr}`);
                    }

                    if (bLerp) {
                        // Stop Lerping when we are at a comfortable distance from the leader.
                        const trueDistance3D = trueDistanceFromObject3D(leaderParticipantWrapperObj.threeJsAvatar, vecCameraWorldPos);

                        if (bVerbose)
                            console.info(`${errPrefix}trueDistance3D between leader and follower: ${trueDistance3D}`);

                        if (trueDistance3D > FOLLOWER_COMFORT_ZONE_DISTANCE) {
                            // Not close enough to the leader.  Lerp to the leader.

                            // DISABLED: Acts like a force field that keeps the FOLLOWER at the
                            //  LEADER activation distance from the leader!
                            // g_ThreeJsCamera.position.lerp(vecCameraWorldDir, FOLLOWER_LERP_ALPHA)
                            g_ThreeJsCamera.position.lerp(vecLeaderWorldPos, FOLLOWER_LERP_ALPHA);
                        }
                    }
                }
            } else {
                // We are a follower and we are currently not in FOLLOW mode.
                //  Look for the closest television display that is playing
                //  a video and look at it.
                const closestTvPlayingVideo = g_TelevisionDisplayManager.findClosestTelevisionToLocalUser(true);

                if (closestTvPlayingVideo) {
                    // Look at the closest television display that is playing a video.
                    vecObjWorldPos = closestTvPlayingVideo.threeJsAvatar.getWorldPosition(vecObjWorldPos);

                    // TODO: Need to flip the Z axis, not sure why.
                    vecToLookAtPos = new THREE.Vector3(
                        vecObjWorldPos.x,
                        vecObjWorldPos.y,
                        -1 * vecObjWorldPos.z);
                    g_ThreeJsCamera.lookAt(vecObjWorldPos);
                }
            }
        }


        // ----------------- FPS CONTROLS MOVEMENT CALCULATIONS -----------------
        if (g_ThreeJsControls.isLocked === true) {
            // g_ThreeJsRaycaster.ray.origin.copy(g_ThreeJsControls.getObject().position);
            // g_ThreeJsRaycaster.ray.origin.y -= 10;

            // Update the picking ray from the mouse and camera.
            g_Raycaster.setFromCamera(g_Mouse, g_ThreeJsCamera);

            // ROS: This appears to be part of a check to allow jumping or
            //  not.  See the raycast intersection code below involving onObject.
            let userIsLookingAtObjects = g_Raycaster.intersectObjects(g_ThreeJsObjects, false);

            /*
            if (g_GlobalState.breakHerePlease && userIsLookingAtObjects.length > 0) {
                console.info(`${errPrefix}Set a breakpoint here.`);

                if (isOwnedByTelevisionDisplay(userIsLookingAtObjects[0].object)) {
                    console.info(`${errPrefix}The first intersection object is owned by a television display.`);
                }
            }
            */

            const onObject = userIsLookingAtObjects.length > 0;

            const delta = (currentTime - prevTime) / 1000;

            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;

            velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize(); // this ensures consistent movements in all directions

            if (moveForward || moveBackward)
                velocity.z -= direction.z * 400.0 * delta;
            if (moveLeft || moveRight)
                velocity.x -= direction.x * 400.0 * delta;

            if (onObject === true) {
                // ROS: This appears to be part of a check to allow jumping or
                //  not.  See the raycast intersection code above involving
                //  onObject.
                velocity.y = Math.max(0, velocity.y);
                canJump = true;

                if (g_BreakHerePlease)
                    // This aids tracing using Chrome DevTools.  See pointerlock.js
                    //  for the keystroke that sets g_BreakHerePlease to TRUE.
                    console.info(`${errPrefix}Set DevTools breakpoint here.`);
            }

            g_ThreeJsControls.moveRight(-velocity.x * delta);
            g_ThreeJsControls.moveForward(-velocity.z * delta);

            g_ThreeJsControls.getObject().position.y += (velocity.y * delta); // new behavior

            if (g_ThreeJsControls.getObject().position.y < 10) {
                velocity.y = 0;
                g_ThreeJsControls.getObject().position.y = 10;

                canJump = true;
            }
        }

        prevTime = currentTime;

        // Update our smart world objects.
        const aryActiveParticipants = g_ParticipantWrapperManager.getActiveParticipantObjs();

        // Tell all the television objects to update themselves given
        //  the current world and conference context.
        g_TelevisionDisplayManager.updateTelevisions(aryActiveParticipants);
        // Tell all the picture display objects to update themselves given
        //  the current world and conference context.
        g_PictureDisplayManager.updatePictureDisplays(aryActiveParticipants);

        // We update the Dolby spatial audio API with the listener's position,
        //  via the listener's avatar.  Therefore, we set the position of
        //  the avatar to the camera's position.

        // For some reason, the rotation is not a THREE.Vector3 object
        //  but it does have a .x, .y, and .z properties.  Make a THREE.Vector3
        //  out of it.
        const cameraRotVec3 = new THREE.Vector3(
            g_ThreeJsCamera.rotation.x,
            g_ThreeJsCamera.rotation.y,
            g_ThreeJsCamera.rotation.z
        );

        // Update our spatial position in the DolbyIO conference soundscape.
        g_ParticipantWrapperManager.updateListenerPosition(g_ThreeJsCamera.position, cameraRotVec3);

        // Update our spatial position in the Howler soundscape.
        setListenerPositionAndOrientation(g_ThreeJsCamera.position, g_ThreeJsCamera);

        // TODO: Remove this debug code.
        const howlListenerPosition = g_SoundPlayedByHowlerManager.getHowlListenerPosition3D();
        const howlListenerOrientation = g_SoundPlayedByHowlerManager.getHowlListenerOrientation3D();


        // Tell all the participant wrapper objects to update themselves.
        // STUB.

        // Are we in a conference?
        if (isLocalUserInConference()) {
            // If the local user has not made a significant movement within the auto-logout time
            //  window, then log them out of the conference automatically.  We don't check the
            //  time that has elapsed since they last spoke too because they may have left the
            //  room with their microphone on.
            const secondsSinceLastSignificantMovement = g_LocalUserParticipantWrapperObj.secondsSinceLastSignificantMovement(currentAnimLoopTime);

            if (bVerbose) {
                // console.log(`${errPrefix} secondsSinceLastSignificantMovement: ${secondsSinceLastSignificantMovement}`);
            }

            // Don't show the alert box more than once.
            if (!bWasLoggedOutAlready && secondsSinceLastSignificantMovement > AUTO_LOGOUT_DELAY_SECONDS) {
                bWasLoggedOutAlready = true;
                // Log the user out of the conference.
                console.warn(`${errPrefix}Auto-logout: the local user has not spoken or moved for over {AUTO_LOGOUT_DELAY_SECONDS} seconds.`);
                alert('You have been logged out of the conference due to inactivity.  Please reload the page if you wish to rejoin the conference.');
                await doPostUnlockProcessing();
            }


            // Check for changes in the camera that would require updating the
            //  other virtual world's that belong to the other participants.
            if (g_CameraStateTracker.updateState(g_ThreeJsCamera)) {
                // Our camera position or rotation has changed in a significant
                //  manner.  Notify the other participants so they can update their
                //  virtual worlds accordingly.
                sendVoxeetCommand(new RemoteParticipantUpdate(g_ThreeJsCamera));

                // Notify the participant wrapper object that the user is still moving..
                g_LocalUserParticipantWrapperObj.notifyOfSignificantMovement();

                /*
                if (deltaLastSpatialAudioUpdateTime > SPATIAL_AUDIO_UPDATE_INTERVAL_MS) {
                    // --------------------- SPATIAL AUDIO UPDATE ------------------------


                    // TODO: Assuming a 100 x 100 pixel landscape mapped to a
                    //  4 meter x 3 meter audio space.
                    const spatialPosition = new THREE.Vector3(
                        50, // g_ThreeJsCamera.position.x,
                        50, // g_ThreeJsCamera.position.y,
                        1, // g_ThreeJsCamera.position.z
                    );

                    // Yes. Tell the DolbyIO spatial audio API to update the soundscape with
                    //  the listener's new position.
                    setLocalUserSpatialAudioPosition(spatialPosition);

                    lastSpatialAudioUpdateTime = currentTime;
                }
                 */
            }

            // ------------------------ UPDATE SPATIAL AUDIO POSITIONS ------------------------

            // Update the sound field if it is time to do so.
            // Have we waited long enough between DolbyIO spatial audio API updates?
            const deltaLastSpatialAudioUpdateTime =
                currentTime - lastSpatialAudioUpdateTime;

            if (g_IsSpatialAudioEnabbled && deltaLastSpatialAudioUpdateTime > SPATIAL_AUDIO_UPDATE_INTERVAL_MS) {
                // Update the local user's position.
                const spatialPosition = new THREE.Vector3(
                    50, // g_ThreeJsCamera.position.x,
                    50, // g_ThreeJsCamera.position.y,
                    1, // g_ThreeJsCamera.position.z
                );

                // Yes. Tell the DolbyIO spatial audio API to update the soundscape with
                //  the listener's new position.
                // setLocalUserSpatialAudioPosition(spatialPosition);

                // Now update all the remote participants that are still connected.
                [...VoxeetSDK.conference.participants].map((val) => {
                    const voxeetParticipant = val[1];

                    // Only process connected participants.
                    if (voxeetParticipant.status === ParticipantStatuses.CONNECTED) {
                        // Find the participant wrapper object for this participant.
                        const participantWrapperObj = g_ParticipantWrapperManager.findParticipantWrapperById(voxeetParticipant.id);

                        if (participantWrapperObj) {

                            // Set the participant position to the middle of their ThreeJS avatar, but
                            //  make the coordinates relative to the local user's position (the camera).
                            const relX = participantWrapperObj.threeJsAvatar.position.x - g_ThreeJsCamera.position.x;
                            const relY = participantWrapperObj.threeJsAvatar.position.y - g_ThreeJsCamera.position.y;
                            const relZ = participantWrapperObj.threeJsAvatar.position.z - g_ThreeJsCamera.position.z;

                            VoxeetSDK.conference.setSpatialPosition(voxeetParticipant, {
                                x: relX,
                                y: relZ,
                                z: 0
                            });

                            if (bVerbose)
                                console.info(`[${voxeetParticipant.id}] Spatial position updated to ${relX}, ${relY}, ${relZ}`);
                        } else {
                            console.warn(`${errPrefix}Could not find a participant wrapper object for participant ID: ${voxeetParticipant.id}.`);
                        }
                    }
                });

                lastSpatialAudioUpdateTime = currentTime;
            }
        }

        g_ThreeJsRenderer.render(g_ThreeJsScene, g_ThreeJsCamera);
    } catch (err) {
        const errMsg = errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
        console.error(errMsg);
    }
}

// Add our mouse movement listener.
window.addEventListener( 'mousemove', onMouseMoveForAnimateLoop, false );

export {animateLoop, processRemoteParticipantUpdate};