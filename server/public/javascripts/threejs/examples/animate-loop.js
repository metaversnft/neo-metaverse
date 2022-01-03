// The animateLoop loop was moved to a separate module to break circular dependencies between
//  pointerlock.js and the ThreeJS objects we create.

import {
    g_ParticipantWrapperManager,
    getLocalUserParticipantId
} from "../../participant-helpers/participant-helper-objects.js";
import {g_TelevisionDisplayManager} from "../../objects/television.js";
import {g_PictureDisplayManager} from "../../objects/picture-display.js";

import * as POINTERLOCK from "./pointerlock.js";
import {makeBoxInScene_original} from "./pointerlock.js";
import {g_ThreeJsRaycaster, g_ThreeJsCamera, g_ThreeJsObjects, g_ThreeJsScene, g_ThreeJsRenderer, g_ThreeJsControls} from "../../objects/three-js-global-objects.js";

import * as THREE from '../build/three.module.js';
import {
    g_SoundPlayedByHowlerManager,
    setListenerPositionAndOrientation
} from "../../sound-effects-support/howler-support.js";
import {
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

// This constant controls how long we wait before making an update
//  call to the DolbyIO spatial audio API with the local user's
//  current position.
const SPATIAL_AUDIO_UPDATE_INTERVAL_MS = 1000;

// This is how long we will wait in seconds before logging the local user
//  automatically out of a conference if they have not spoken
//  or made a significant movement.
const AUTO_LOGOUT_DELAY_SECONDS = 60 * 10; // 10 minutes.

const bVerbose = true;

// These are the variables that support the movement system.
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

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

const errPrefix = '(animate-loop) ';

let bWasLoggedOutAlready = false;

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
            
            if (aryAttachedSoundObjs.length > 0) {
                aryAttachedSoundObjs.forEach((soundPlayByHowlObj) => {
                    const thePos = soundPlayByHowlObj.getPosition3D();
                    const theOrientation = soundPlayByHowlObj.getOrientation3D();
                    console.warn(`${errPrefix}[${idOfDesiredAsset}] - position: ${thePos.x}, ${thePos.y}, ${thePos.z} - orientation: ${theOrientation.x}, ${theOrientation.y}, ${theOrientation.z}`);
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
        // ROS: Turn the camera ON and OFF.
        case 'KeyV':
            startStopVideo();
            break
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
}

/**
 * Convert the Voxeet SDK map of conference participants to a simple array.
 *
 * @param {boolean} bIncludeLocalUser - If TRUE, then the local user,
 *  otherwise don't.
 *
 * @return {Array<Object>} - Returns a simple array containing the conference
 *  participants.
 */
function dolbyIoParticipantsMapToArray(bIncludeLocalUser=false) {
    const errPrefix = `(dolbyIoParticipantsMapToArray) `;

    if (typeof bIncludeLocalUser !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIncludeLocalUser parameter is not boolean.`);

    let retArray = [];

    const mapParticipants = VoxeetSDK.conference.participants;

    for (let participantKey of mapParticipants) {
        let participantObj = VoxeetSDK.conference.participants.get(participantKey[0]);

        if (!bIncludeLocalUser && g_LocalUserParticipantId === participantObj.id)
            // Ignore the local user.
            continue;

        retArray.push(participantObj);
    }

    return retArray;
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
 * Animate the g_ThreeJsScene.
 */
async function animateLoop() {
    const errPrefix = `(animateLoop) `;

    try {
        requestAnimationFrame(animateLoop);

        const currentAnimLoopTime = new Date();

        // Keep the local user participant ID variable updated.
        const currentId = getLocalUserParticipantId();

        const localUserParticipantWrapperObj = g_ParticipantWrapperManager.getLocalUserParticipantWrapper();

        // If it has changed, show it in the diagnostics panel.
        if (currentId !== g_LocalUserParticipantId) {
            g_LocalUserParticipantId = currentId;
            updateDiagnosticsPanel(g_LocalUserParticipantId);
        }

        const currentTime = performance.now();

        if (g_ThreeJsControls.isLocked === true) {
            g_ThreeJsRaycaster.ray.origin.copy(g_ThreeJsControls.getObject().position);
            g_ThreeJsRaycaster.ray.origin.y -= 10;

            const intersections = g_ThreeJsRaycaster.intersectObjects(g_ThreeJsObjects, false);

            const onObject = intersections.length > 0;

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

                velocity.y = Math.max(0, velocity.y);
                canJump = true;
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

        // Tell all the participant wrapper objects to update themselves.
        // STUB.

        // Are we in a conference?
        if (isLocalUserInConference()) {
            // If the local user has not made a significant movement within the auto-logout time
            //  window, then log them out of the conference automatically.  We don't check the
            //  time that has elapsed since they last spoke too because they may have left the
            //  room with their microphone on.
            const secondsSinceLastSignificantMovement = localUserParticipantWrapperObj.secondsSinceLastSignificantMovement(currentAnimLoopTime);

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
                localUserParticipantWrapperObj.notifyOfSignificantMovement();

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

export {animateLoop, processRemoteParticipantUpdate};