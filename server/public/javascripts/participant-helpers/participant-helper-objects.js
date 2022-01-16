
// This module contains the objects the help manage the participant behavior
//  in Neoland.

// import {addVideoNode, removeVideoNode} from "../video.js";

import * as THREE from '../threejs/build/three.module.js';
import * as POINTERLOCK from "../threejs/examples/pointerlock.js"
import {isLocalUserInConference, RemoteParticipantUpdate} from "../dolby-io/dolby-io-support.js";
import {g_RolesList} from "../roles/user-roles.js";
import {trueDistanceFromObject3D} from "../objects/object-participant-support.js";

// import * as PARTICIPANT_SUPPORT from "../objects/object-participant-support";
// import {SPATIAL_AUDIO_FIELD_WIDTH, SPATIAL_AUDIO_FIELD_HEIGHT} from "../dolby-io/ui.js";
// import {THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD} from "../threejs/examples/pointerlock.js";

const URL_PLACEHOLDER_VIDEO = "/video/NEO-LOGO-FULL-SPIN.mp4";

/* If the distance between the local user and one of the participants whose role
    is marked as leader is less than this distance, then the follower will
    follow the leader. */
const LEADER_ACTIVATION_DISTANCE = 100;

// Object that acts like an associative array that keeps track of all the
//  active video nodes created by this module.
let g_AryVideoNodes = [];

const bVerbose = true;

/**
 * This function wraps the DolbyIO SDK to make it easy to
 *  get the participant ID of the local user, which is defined
 *  as the user sitting in front of the PC running the app.
 *
 * @return {String} - The participant ID of the local user.
 */
function getLocalUserParticipantId() {
    const errPrefix = `(getLocalUserParticipantId) `;

    return VoxeetSDK.session.participant.id;
}

/**
 * This function returns TRUE if the given participant ID is the ID of the local user.
 *
 * @param {String} participantId - The participant ID to check.
 *
 * @return {boolean} - TRUE if the given participant ID is the ID of the local user,
 *  FALSE otherwise.
 */
function isLocalUserParticipantId(participantId) {
    const errPrefix = `(isLocalUserParticipantId) `;

    if (misc_shared_lib.isEmptySafeString(participantId))
        throw new Error(errPrefix + `The participantId parameter is empty.`);
    return participantId === getLocalUserParticipantId();
}
/*
   setInterval(() => {
      let participants = VoxeetSDK.conference.participants;
      for (let participant of participants) {
        VoxeetSDK.conference.isSpeaking(
            VoxeetSDK.conference.participants.get(participant[0]),
            (isSpeaking) => {
              if (isSpeaking) {
                console.log(
                    'The participant',
                    participant[0],
                    'speaking status:',
                    isSpeaking
                );
                // find that participant in the user grid and set their isSpeaking to true
                for (let i = 0; i < g_VideoContainerList.length; i++) {
                  if (g_VideoContainerList[i].participantId === participant[0]) {
                    let cell = document.getElementById(`video-container-${i}`);
                    cell.style.outline = '5px solid lightgreen';
                  }
                }
              } else if (!isSpeaking) {
                for (let i = 0; i < g_VideoContainerList.length; i++) {
                  if (g_VideoContainerList[i].participantId === participant[0]) {
                    let cell = document.getElementById(`video-container-${i}`);
                    cell.style.outline = '0px solid black';
                  }
                }
              }
            }
        );
      }
    }, 500);
  };
  */
/**
 * This object contains the functions that are used to manage the participant
 *  behavior in Neoland.
 *
 *
 * @param {Object} participant - A participant object.
 * @param {Object} stream - The stream object associated with the participant.
 *
 * @constructor
 */
function ParticipantWrapper(participant, stream) {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    // A participant may not have an active video stream (audio-only).
    // if (!misc_shared_lib.isNonNullObjectAndNotArray(stream))
    //	throw new Error(errPrefix + `The stream is not a valid object.`);

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Object} - The DolbyIO participant object received
     *  from a Voxeet SDK generated event. */
    this.participantObj = participant;

    /** @property {String} - The participant ID, hoisted up from the
     *  raw JSON participant object provided by the Voxeet SDK. */
    this.idOfObject = participant.id;

    /** @property {Object} - The Voxeet SDK stream object -  */
    this.streamObj = stream;

    /** @property {Object|null} - The DOM element node that contains the "video"
     *  element assigned for our use.  It may be NULL if the user is not
     *  using their camera (i.e. - they are not streaming video, only
     *  audio).  It is created in _buildThreeJSCube(). */
    this.videoNode = null;

    /** @property {Object|null} - The ThreeJS text object created for the video node. */
    this.videoTexture = null;

    /** @property {Date} - The last time the system detected the user
     *   stopped speaking. */
    this.lastStoppedSpeakingTimestamp = null;

    /** @property {Date} - The last time the system detected the user
     *   started speaking. */
    this.lastStartedSpeakingTimestamp = null;

    /** @property {Date} - The last time the system detected any
     *   significant movement made by the user, whether it is
     *   in their position or rotation. */
    this.lastSignificantMovementTimestamp = null;

    /** @property {boolean} - Indicates if the participant is currently
     *  streaming video. */
    // this.isVideoEnabled = false;

    /** @property {Object|null} - This property keeps a reference to the
     *  the ThreeJS object that is created to represent this participant
     *  in the scene. */
    this.threeJsAvatar = null;

    /** @property {Object} - Any custom data that we received from a
     *   RemoteParticipantUpdate message broadcasted to us will be
     *   attached to the customDataFromRemote property of the ParticipantWrapper object
     *   that they create to represent us in their copy of the virtual world
     *  should be attached to this property. */
    this.customDataFromRemote = {};

    /**
     * This function returns TRUE if the Voxeet SDK participant object
     *  we carry has a video track associated with it, FALSE if not.
     *
     * @return {boolean}
     */
    this.isVideoTrackPresent = function() {
        return (self.streamObj && self.streamObj.getVideoTracks().length > 0);
    }

    /**
     * This function returns TRUE if the participant this object
     *  represents is showing the placeholder video, FALSE if not.
     *
     * @return {boolean}
     */
    this.isPlaceholderVideoShowing = function() {
        return !self.isVideoTrackPresent();
    }

    /**
     * This function returns TRUE if the participant this object
     *  represents has the specified role assigned to them.
     *  Otherwise FALSE is returned.
     *
     * @param {String} role - The role to check for.
     *
     * @return {boolean}
     */
    this.isRoleAssigned = function(role) {
        if (!self.customDataFromRemote.localUserRoles)
            return false;
        return (self.customDataFromRemote.localUserRoles.includes(role));
    }

    /**
     * This function does some basic checks on this object's data
     *  members and throws an exception if any of the checks fail.
     *
     * @param {String} caller - The method calling this function.
     *  Used for error message construction.
     *
     * @private
     */
    this._validate = function(caller) {
        const methodName = self.constructor.name + '->' + `_validate`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(caller))
            throw new Error(errPrefix + `The caller parameter is empty.`);

        if (!misc_shared_lib.isNonNullObjectAndNotArray(self.participantObj))
        	throw new Error(errPrefix + `The self.participantObj is not a valid object.`);

        if (misc_shared_lib.isEmptySafeString(self.idOfObject))
            throw new Error(errPrefix + `The self.idOfObject parameter is empty.`);

        // The participant may not have an active video stream (audio-only).
        // if (!misc_shared_lib.isNonNullObjectAndNotArray(self.streamObj))
        //	throw new Error(errPrefix + `The self.streamObj is not a valid object.`);
    }

    /**
     * This function determines the video source for the participant's
     *  avatar, based on the participant's video streaming status.
     *
     * @private
     */
    this._adjustVideoSource = function() {
        const methodName = self.constructor.name + '::' + `_adjustVideoSource`;
        const errPrefix = '(' + methodName + ') ';

        // We do not show video for the local user, only remote users,
        //  since we are maintaining a first-person view of the scene.
        if (isLocalUserParticipantId(self.participantObj.id))
            return;

        // Code from original addVideoNode() function in the is-speaking example project.
        // videoNode = document.createElement('video');
        // videoNode.setAttribute('id', 'video-' + participant.id);
        // videoNode.setAttribute('height', 240);
        // videoNode.setAttribute('width', 320);
        // videoNode.setAttribute('playsinline', true);
        // videoNode.muted = true;
        // videoNode.setAttribute('autoplay', 'autoplay');

        self._validate(methodName);

        // If the participant has video tracks, that means they are
        //  broadcasting video and we should use the associated video
        //  stream as the source for the DOM video element.  Otherwise,
        //  point that element at the placeholder video we use to
        //  indicate audio-only participants.
        if (self.isVideoTrackPresent()) {
            // Show the participant's video stream.
            console.info(`${errPrefix}Using Dolby video stream for participant:  ${self.participantObj.id}.`);
            navigator.attachMediaStream(self.videoNode, self.streamObj);
        } else {
            // Show the placeholder video.
            console.info(`${errPrefix}Using PLACEHOLDER video stream for participant:  ${self.participantObj.id}.`);
            self.videoNode.src = URL_PLACEHOLDER_VIDEO;

            // Pause the video immediately. We only
            //  play the video when the participant is speaking.
            self.videoNode.pause();
        }
    }

    /**
     * This function should be called when a participant
     *  starts speaking when the local user is in a conference.
     *  It will take the necessary actions to highlight that
     *  change of state, if any are necessary.
     *
     */
    this.notifyStartedSpeaking = function() {
        const methodName = self.constructor.name + '::' + `notifyStartedSpeaking`;
        const errPrefix = '(' + methodName + ') ';

        // If the local user is in a conference, and we are not the
        //  local user, and the participant's avatar is currently
        //  showing the placeholder video, then resume the
        //  placeholder video to show that the participant is
        //  speaking.
        if (isLocalUserInConference() &&
            !getLocalUserParticipantId() !== self.participantObj.id
            && self.isPlaceholderVideoShowing()
        ) {
            // Resume the placeholder video.
            self.videoNode.play();

            // Timestamp the event.
            self.lastStartedSpeakingTimestamp = new Date();
        }
    }

    /**
     * This function is used by the functions that calculate time
     *  deltas in seconds between a current time and one of this
     *  object's Data properties.
     *
     * @param {String} caller - The name of the calling function.
     *  Used strictly for logging purposes.
     * @param {Date} referenceDtProp - A Date value from one of
     *  our Date properties.
     * @param {Date} currentTime - A Date object with the newer
     *  time in it, to compare against the referenceDtProp value.
     *
     * @return {number} - Returns the number of seconds between
     *  the referenceDtProp value and the currentTime value.
     *
     * @private
     */
    this._calcTimeDelta = function(caller, referenceDtProp, currentTime) {
        const methodName = self.constructor.name + '::' + `_calcTimeDelta`;
        const errPrefix_1 = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(caller))
            throw new Error(`${errPrefix_1}The caller parameter is empty.`);

        const errPrefix = `(${methodName}->${caller}) `;

        if (referenceDtProp && !(referenceDtProp instanceof Date))
            throw new Error(errPrefix + `The referenceDtProp parameter is not NULL, yet it is not a Date object either.`);

        if (referenceDtProp === null)
            // Return 0.  The reference data property has not been
            //  initialized yet.
            return 0;

        // If the current time is not provided, use the time
        //  provided by a new Date object.
        const nowTime = currentTime === null ? new Date() : currentTime;
        const seconds = (nowTime.getTime() - referenceDtProp.getTime()) / 1000;

        if (seconds < 0)
            throw new Error(errPrefix + `The current time is older than the reference`);

        return seconds;
    }

    /**
     * Returns the seconds since the last time the participant this
     *  object represents started speaking.
     *
     * @param {Date} currentTime - A Date object with the newer
     *  time in it, to compare against the previous date value.
     *
     * @return {number} - Returns the number of seconds since the
     *  last time the participant this object represents started
     *  speaking.
     */
    this.secondsSinceLastStartedSpeaking = function(currentTime=null) {
        const methodName = self.constructor.name + '::' + `secondsSinceLastStartedSpeaking`;
        const errPrefix = '(' + methodName + ') ';

        return self._calcTimeDelta(methodName, self.lastStartedSpeakingTimestamp, currentTime);
    }

    /**
     * This function should be called when a participant
     *  stops speaking when the local user is in a conference.
     *  It will take the necessary actions to highlight that
     *  change of state, if any.
     *
     */
    this.notifyStoppedSpeaking = function() {
        const methodName = self.constructor.name + '::' + `notifyStoppedSpeaking`;
        const errPrefix = '(' + methodName + ') ';

        // If the local user is in a conference, and we are not the
        //  local user, and the participant's avatar is currently
        //  showing the placeholder video, then pause the
        //  placeholder video to show that the participant is
        //  no longer speaking.
        if (isLocalUserInConference() &&
            !getLocalUserParticipantId() !== self.participantObj.id
            && self.isPlaceholderVideoShowing())
        {
            // pause the placeholder video.
            self.videoNode.pause();

            // Timestamp the event.
            self.lastStoppedSpeakingTimestamp = new Date();
        }
    }

    /**
     * Returns the seconds since the last time the participant this
     *  object represents stopped speaking.
     *
     * @param {Date} currentTime - A Date object with the newer
     *  time in it, to compare against the previous date value.
     *
     * @return {number} - Returns the number of seconds since the
     *  last time the participant this object represents stopped
     *  speaking.
     */
    this.secondsSinceLastStoppedSpeaking = function(currentTime=null) {
        const methodName = self.constructor.name + '::' + `secondsSinceLastStoppedSpeaking`;
        const errPrefix = '(' + methodName + ') ';

        return self._calcTimeDelta(methodName, self.lastStoppedSpeakingTimestamp, currentTime);
    }

    /**
     * This function should be called when a participant
     *  has made any significant change in their
     *  position or their rotation. It will take the necessary
     *  actions to highlight that change of state, if any.
     *
     */
    this.notifyOfSignificantMovement = function() {
        const methodName = self.constructor.name + '::' + `notifyOfSignificantMovement`;
        const errPrefix = '(' + methodName + ') ';

        // Timestamp the event.
        self.lastSignificantMovementTimestamp = new Date();
    }

    /**
     * Returns the seconds since the last time the participant this
     *  object represents made a significant change in their
     *  position or their rotation (i.e. - the last significant
     *  movement).
     *
     * @param {Date} currentTime - A Date object with the newer
     *  time in it, to compare against the previous date value.
     *
     * @return {number} - Returns the number of seconds since the
     *  last time the participant this object represents made
     *  a significant change in their position or their rotation.
     */
    this.secondsSinceLastSignificantMovement = function(currentTime=null) {
        const methodName = self.constructor.name + '::' + `secondsSinceLastSignificantMovement`;
        const errPrefix = '(' + methodName + ') ';

        return self._calcTimeDelta(methodName, self.lastSignificantMovementTimestamp, currentTime);
    }

    /**
     * This function builds the ThreeJS object that will represent the
     *  participant in the scene.  It also handles the creation of the
     *  DOM video element that will be used to display either the
     *  participant's video if their camera on, or our placeholder
     *  video if they are audio-only.  It does not place the object
     *  at any specific position in the scene.
     *
     * @return {THREE.Mesh} - Return a properly assembled ThreeJS
     *  mesh object to use as the user's world avatar.
     *
     * @private
     */
    this._buildThreeJSCube = function() {
        const methodName = self.constructor.name + '::' + `_buildThreeJSCube`;
        const errPrefix = '(' + methodName + ') ';

        // Validate.
        self._validate(methodName);

        // Use the participant ID to build the video node ID.
        const videoNodeId = 'video-' + self.participantObj.id;

        // Create a video element and texture for the video that
        //  will represent this participant.
        self.videoNode = document.createElement('video');

        self.videoNode.setAttribute('id', videoNodeId);
        self.videoNode.setAttribute('height', 240);
        self.videoNode.setAttribute('width', 320);
        self.videoNode.setAttribute('playsinline', true);
        self.videoNode.setAttribute('autoplay', 'autoplay');

        // self.videoNode.muted = true;
        // self.videoNode.autoplay = true;

        // self.videoNode.width = 100;
        // self.videoNode.height = 100;

        // Pause any existing video playback.
        // self.videoNode.pause();

        // Don't loop the video if it is live from the participant.
        self.videoNode.loop = !self.isVideoTrackPresent();

        // Add the video to the global array that tracks all the
        //  video elements.
        g_AryVideoNodes[videoNodeId] = self.videoNode;

        // Create a ThreeJS texture to service the video element.
        self.videoTexture = new THREE.VideoTexture(self.videoNode);

        // TODO: Are these statements still necessary and a good idea?
        self.videoTexture.minFilter = THREE.LinearFilter;
        self.videoTexture.magFilter = THREE.LinearFilter;
        self.videoTexture.format = THREE.RGBFormat;
        self.videoTexture.generateMipmaps = false;

        // Create an array of materials to be used in a cube, one for each side
        let cubeMaterialArray = [];

        // Add the materials that comprise each face of the cube in this order: x+,x-,y+,y-,z+,z-
        //
        // 1) Right face of cube (X+)
        // 2) Left face of cube (X-)
        // 3) Top face of cube (Y+)
        // 4) Bottom face of cube (Y-)
        // 5) Front face of cube (Z+) - This face will show the video stream.
        // 6) Back face of cube (Z-)
        /*
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff3333 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xffff33 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0x33ff33 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { map: videoTexture } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0x8833ff } ) );
        */
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800} ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { map: self.videoTexture } ) );

        const cubeMaterials = new THREE.MeshFaceMaterial( cubeMaterialArray );

        // Cube dimensions.
        const cubeGeometry =
            new THREE.CubeGeometry( 10, 10, 10, 1, 1, 1 );

        // Adjust the video source based on the participant's
        //  video streaming status.
        self._adjustVideoSource();

        // Build the cube from a basic ThreeJS mesh and return it.
        const newThreeJsObj = new THREE.Mesh(cubeGeometry, cubeMaterials);

        // Give other code the ability to detect that this object
        //  is a participant cube.
        newThreeJsObj.userData.neo3DParentObj = self;

        return newThreeJsObj;
    }

    /**
     * This function builds the ThreeJS object that will represent
     *  this participant in the scene and adds it to the scene.
     *
     * @private
     */
    this._createThreeJSAvatar = function() {
        const methodName = self.constructor.name + '::' + `_createThreeJSAvatar`;
        const errPrefix = '(' + methodName + ') ';

        // Validate.
        self._validate(methodName);

        // Build the ThreeJS object that will represent this participant.
        self.threeJsAvatar = self._buildThreeJSCube();

        // Using static colors specified in the mesh creation for now.
        // material.color.setHSL( material.hue, material.saturation, 0.5 );

        // Set the position of the avatar.
        self.threeJsAvatar.position.x = 0;
        self.threeJsAvatar.position.y = 10;
        self.threeJsAvatar.position.z = -30;

        // Set the rotation of the avatar.
        self.threeJsAvatar.rotation.x = 0;
        self.threeJsAvatar.rotation.y = 0;

        self.threeJsAvatar.scale.x = self.threeJsAvatar.scale.y = self.threeJsAvatar.scale.z = 1;

        // Set its "name" property to the participant's ID.
        if (misc_shared_lib.isEmptySafeString(self.participantObj.id))
            throw new Error(`${errPrefix}The participant object has an empty ID.`);

        self.threeJsAvatar.name = self.participantObj.id;

        // Add the avatar to the scene.
        POINTERLOCK.addObjectToObjectsList(self.threeJsAvatar);
    }

    /**
     * This function returns TRUE if this participant wrapper
     *  object represents the local user, otherwise it returns FALSE.
     *
     * @return {Boolean}
     */
    this.isLocalUser = function() {
        return (self.participantObj.id === getLocalUserParticipantId());
    }

    /**
     * Return a string that shows the participant's ID, position, and rotation.
     *
     * @return {string}
     */
    this.toSummaryString = function() {
        const methodName = self.constructor.name + '::' + `toSummaryString`;
        const errPrefix = '(' + methodName + ') ';

        let  str = `[${self.participantObj.id}] - Position: ${self.threeJsAvatar.position.x}, ${self.threeJsAvatar.position.y}, ${self.threeJsAvatar.position.z}`;
        str += `, Rotation: ${self.threeJsAvatar.rotation.x}, ${self.threeJsAvatar.rotation.y}, ${self.threeJsAvatar.rotation.z}`;

        return str;
    }

    /**
     * This function calculates the distance between our participant's
     *  avatar and the avatar of the specified other participant.
     *
     * @param {ParticipantWrapper} otherParticipant - The other wrapper object
     *  for the other participant.
     *
     * @return {number} - The distance between the two participant's avatars.
     */
    this.distanceToOtherParticipantAvatar = function(otherParticipant) {
        const methodName = self.constructor.name + '::' + `distanceToOtherParticipantAvatar`;
        const errPrefix = '(' + methodName + ') ';

        if (!(otherParticipant instanceof ParticipantWrapper))
            throw new Error(errPrefix + `The value in the otherParticipant parameter is not a ParticipantWrapper object.`);

        return Math.abs(
            self.threeJsAvatar.position - otherParticipant.threeJsAvatar.position);
    }

    /**
     * Update our image of a remote participant's avatar to match that of the actual
     *  state of the remote participant's avatar in their ThreeJS scene. (E.g. -
     *  move the avatar to the correct position, rotate it to the correct angle, etc.)
     *
     * @param {RemoteParticipantUpdate} remoteParticipantUpdateObj - The
     *  RemoteParticipantUpdate object received from the conference broadcast
     *  system.
     */
    this.updateAvatar = function(remoteParticipantUpdateObj) {
        const methodName = self.constructor.name + '::' + `remoteParticipantUpdateObj`;
        const errPrefix = '(' + methodName + ') ';

        if (!(remoteParticipantUpdateObj instanceof RemoteParticipantUpdate))
            throw new Error(errPrefix + `The value in the remoteParticipantUpdateObj parameter is not a RemoteParticipantUpdate object.`);

        // --------------------- AVATAR UPDATE ------------------------

        // The rotationUpdate field has the private fields from the original Euler()
        //  angle that was assigned to it.  We need to hoist it up to a new
        //  full-fled Euler() object.
        const eulerObj = new THREE.Euler(remoteParticipantUpdateObj.rotationUpdate._x, remoteParticipantUpdateObj.rotationUpdate._y, remoteParticipantUpdateObj.rotationUpdate._z, remoteParticipantUpdateObj._order);

        self.threeJsAvatar.position.set(remoteParticipantUpdateObj.positionUpdate.x, remoteParticipantUpdateObj.positionUpdate.y, remoteParticipantUpdateObj.positionUpdate.z);
        self.threeJsAvatar.rotation.set(eulerObj.x, eulerObj.y, eulerObj.z);
    }

    /**
     * DEPRECATED: We now update the necessary
     * This method updates the elements that need to change to
     *  reflect the current state of the participant.
     *
     * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
     *  The current list of participant objects in the scene.
     */
    this.updateParticipant_deprecated = function (aryParticipantWrapperObjs) {
        const methodName = self.constructor.name + '::' + `updateParticipant`;
        const errPrefix = '(' + methodName + ') ';

        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        // Are there any participants?
        if (aryParticipantWrapperObjs.length > 0) {
            // STUB.
        }

        // Get the ParticipantWrapper object for the local participant.
        const localParticipantWrapperObj = g_ParticipantWrapperManager.getLocalUserParticipantWrapper();

        // Do not alter the spatial audio position of the local user,
        //  if that is the participant we represent.
        //
        //  The local user is always at the center of the audio scene.
        if (self != localParticipantWrapperObj) {
            // Update our participant's audio stream position spatially
            //  to match the current location of our avatar in relationship
            //  to the listener (local user), after doing
            //  the necessary geometric translations.

            const deltaX = self.threeJsAvatar.position.x - localParticipantWrapperObj.threeJsAvatar.position.x;
            const deltaY = self.threeJsAvatar.position.y - localParticipantWrapperObj.threeJsAvatar.position.y;
            const deltaZ = self.threeJsAvatar.position.z - localParticipantWrapperObj.threeJsAvatar.position.z;

            // We attenuate difference values between each coordinate.
            //
            // Determine the angle between the listener and the remote
            //  participant, from the listener's perspective.  Note,
            //  The ThreeJS angleTo() function always chooses the
            //  smaller angle so sine values should always be positive.
            const angleBetweenParticipants = localParticipantWrapperObj.threeJsAvatar.position.angleTo(self.threeJsAvatar.position);
            const sinAngle = Math.sin(angleBetweenParticipants);

            // The greater the angle between the listener and the remote
            //  participant, the more pronounced the perceived difference
            //  in spatial location should be, so we should attenuate the
            //  difference for that coordinate.  The sine value does that
            //  for us naturally.
            const spatialAudioX = deltaX * sinAngle;
            const spatialAudioY = deltaY * sinAngle;
            const spatialAudioZ = deltaZ * sinAngle;

            const spatialPosition = {
                x: spatialAudioX,
                y: spatialAudioY,
                z: spatialAudioZ,
            };

            // Update the DolbyIO spatial audio environment.
            VoxeetSDK.conference.setSpatialPosition(self.participantObj.id, spatialPosition);
        }

        // TODO: Add code to show when users that do not have their
        //  camera turned are talking, by starting the video used
        //  as the avatar's video "face", and stopping it when they
        //  stop talking.  Use the DolbyIO is-speaking detection
        //  feature to do this.
    }

    /**
     * This function must be called whenever the status of the
     *  participant's stream changes.  It will update the
     *  the assets related to this participant appropriately.
     *
     * NOTE: Currently it is not used because we recreate the
     *  ParticipantWrapper objects whenever the status of the
     *  participant changes in a material way.
     *
     * @param {Object} participant - A participant object.
     * @param {Object} stream - The stream object associated with the participant.
     *
     */
    this.updateParticipantStatus = function(participant, stream) {
        let methodName = self.constructor.name + '::' + `updateParticipantStatus`;
        let errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(participant))
            throw new Error(errPrefix + `The participant is not a valid object.`);

        if (!misc_shared_lib.isNonNullObjectAndNotArray(stream))
            throw new Error(errPrefix + `The stream is not a valid object.`);

        // Replace the participant and stream objects we carry with what
        //  we were just given.
        self.participantObj = participant;
        self.streamObj = stream;

        // Adjust the video source to the participant's current video
        //  streaming status.
        self._adjustVideoSource();
        self.videoTexture.needsupdate = true;
    };

    /**
     * This method should be called when a participant is removed or
     *  has changed status in a way that requires maintenance of the
     *  assets associated with the participant.
     */
    this.cleanUp = function () {
        let methodName = self.constructor.name + '::' + `cleanup`;
        let errPrefix = '(' + methodName + ') ';

        console.info(`${errPrefix}Cleaning up participant ${self.participantObj.id}`);

        // Remove the video node from the DOM and our tracking object.
        self.videoNode.remove();
        delete g_AryVideoNodes[self.videoNode.id];

        // Remove the avatar from the scene.
        const bObjFoundAndRemoved = POINTERLOCK.removeObjFromSceneByUuid(self.threeJsAvatar.uuid);

        if (!bObjFoundAndRemoved)
            throw new Error(errPrefix + `The avatar object was not found in the scene and therefore the removal attempt was ignored for participant ID: ${self.participantObj.id}.`);
        // console.warn(errPrefix + `Not implemented.`);
    }


    // ---------------- CONSTRUCTOR CODE ----------------

    // Build the avatar for this participant and place it in the
    //  the ThreeJS scene.
    self._createThreeJSAvatar();
    self.videoTexture.needsupdate = true;

    // Validate.
    self._validate('constructor');

    /* Temporary test.
    setInterval(function() {
        if (self.videoTexture.needsupdate) {
            //console.warn(`Setting needsupdate to true.`);
            self.videoTexture.needsupdate = true;
        }
    }, 1000);

     */
}

/**
 * This object maintains the list of ParticipantWrapper objects created
 *  for each participant has they join/leave the conference.
 *
 * @constructor
 */
function ParticipantWrapperManager() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<ParticipantWrapper>} - An object acting as an
     *  associative array of ParticipantWrapper objects where the
     *  participant ID is the key and the ParticipantWrapper is the
     *  value. */
    this.aryParticipantWrapperObjs = [];

    /**
     * This function finds a ParticipantWrapper object by its television ID.
     *
     * @param {String} idOfParticipant - The ID to look for.
     *
     * @returns {ParticipantWrapper|null} - The ParticipantWrapper object that
     *  bears the given ID or NULL if none were found.
     */
    this.findParticipantWrapperById = function(idOfParticipant  ) {
        const methodName = self.constructor.name + '::' + `findParticipantWrapperById`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfParticipant))
            throw new Error(errPrefix + `The idOfParticipant parameter is empty.`);

        if (typeof self.aryParticipantWrapperObjs[idOfParticipant] === 'undefined')
            return null;

        return self.aryParticipantWrapperObjs[idOfParticipant];
    }

    /**
     * Finds the first leader in the list of participants that close enough
     *  to us to be within the leader activation distance.
     */
    this.findFirstLeaderNearUs = function(activationDistance=LEADER_ACTIVATION_DISTANCE ) {
        const methodName = self.constructor.name + '::' + `findFirstLeaderNearUs`;
        const errPrefix = '(' + methodName + ') ';

        const localUserId = getLocalUserParticipantId();

        for (let participantId in self.aryParticipantWrapperObjs) {
            const remoteParticipantObj = self.aryParticipantWrapperObjs[participantId];

            // Is it the local user (aka is it "us")?
            if (remoteParticipantObj.isLocalUser())
                // Yes, ignore this object.
                continue;

            // Leader?
            if (remoteParticipantObj.isRoleAssigned(g_RolesList.LEADER)) {
                // Yes. Is the leader within the activation distance?
                const distToLeader =
                    // Use the remote participant object as the first parameter because
                    //  our coordinates are the camera and therefore does not need
                    //  any potential coordinate translations applied to it.
                    trueDistanceFromObject3D(remoteParticipantObj.threeJsAvatar, self.getLocalUserParticipantWrapper().threeJsAvatar.position);

                if (distToLeader <= LEADER_ACTIVATION_DISTANCE) {
                    // Yes.
                    return remoteParticipantObj;
                }
            }
        }

        // No leader found.
        return null;
    }


    /**
     * Find the participant wrapper object for the participant
     *  that is the local user.
     *
     * @return {ParticipantWrapper|null}
     */
    this.getLocalUserParticipantWrapper = function() {
        const methodName = self.constructor.name + '::' + `getLocalUserParticipantWrapper`;
        const errPrefix = '(' + methodName + ') ';

        // Find the ParticipantWrapper object that bears the ID of
        //  the VoxeetSDK session participant, since that is the
        //  local user.
        const localUserId = getLocalUserParticipantId();

        // If we are not in a session, then it might be null.
        if (!localUserId)
            return null;

        // Find it in our collection.
        const localUserObj =
            self.findParticipantWrapperById(localUserId);

        if (!(localUserObj instanceof ParticipantWrapper))
            return null;

        // Return it.
        return localUserObj;
    }

    /**
     * This function finds a ParticipantWrapper object by its
     *  ID.
     *
     * @param {String} idOfParticipant - The ID to look for.
     *
     * @return {Boolean} - TRUE if the object was found, FALSE
     *  otherwise.
     */
    this.isExistingParticipant = function(idOfParticipant) {
        const methodName = self.constructor.name + '::' + `isExistingParticipant`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfParticipant))
            throw new Error(errPrefix + `The idOfParticipant parameter is empty.`);

        return self.aryParticipantWrapperObjs[idOfParticipant] instanceof ParticipantWrapper;
    }

    /**
     * This method should be called from the VoxeetSDK.conference.on('streamAdded')
     *  event handler.  It updates the list of ParticipantWrapper objects
     *  properly and manages the maintenance of the associated DOM
     *  video elements in the ThreeJS scene.
     *
     * @param {Object} participant - A Voxeet SDK participant object.
     * @param {Object|null} stream  - The Voxeet SDK stream object
     *  associated with the participant if the participant is
     *  currently broadcasting video, otherwise NULL.
     *
     * @return {ParticipantWrapper} - Returns the newly created and added
     *  participant object.
     */
    this.addParticipant = function (participant, stream) {
        let methodName = self.constructor.name + '::' + `addParticipant`;
        let errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(participant))
            throw new Error(errPrefix + `The participant is not a valid object.`);

        // A participant object may not have a video stream yet.
        // if (!misc_shared_lib.isNonNullObjectAndNotArray(stream))
        //    throw new Error(errPrefix + `The stream is not a valid object.`);

        // If there is an existing participant object with the same ID, then
        //  throw an error.
        if (self.isExistingParticipant(participant.id))
            throw new Error(errPrefix + `A participant wrapper object already exists for participant ID: ${participant.id}.`);

        // Replace any existing object in the array with the same
        //  participant ID, or create a new one if it does not exist.
        /*
        if (self.aryParticipantWrapperObjs[participant.id] instanceof ParticipantWrapper) {
            // Tell the existing participant object to maintain itself.
            self.aryParticipantWrapperObjs[participant.id].cleanUp()
        }
         */

        // Assign it.
        self.aryParticipantWrapperObjs[participant.id] =
            new ParticipantWrapper(participant, stream);

        return self.aryParticipantWrapperObjs[participant.id];
    }

    /**
     * This method should be called from the VoxeetSDK.conference.on('streamUpdated')
     *  event handler.  If the REMOTE participant's streaming state has
     *  materially changed, this function will recreate the objects associated
     *  with the participant to reflect the new state.  It also
     *  manages the maintenance of the associated DOM
     *  video elements in the ThreeJS scene.
     *
     * @param {Object} participant - A Voxeet SDK participant object.
     * @param {Object} stream  - The Voxeet SDK stream object
     *  associated with the participant.
     */
    this.updateParticipantStatus = function(participant, stream) {
        let methodName = self.constructor.name + '::' + `updateParticipantStatus`;
        let errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(participant))
            throw new Error(errPrefix + `The participant is not a valid object.`);

        if (!misc_shared_lib.isNonNullObjectAndNotArray(stream))
            throw new Error(errPrefix + `The stream is not a valid object.`);

        // If there is no participant with the given ID, then that is an error.
        if (!(self.aryParticipantWrapperObjs[participant.id] instanceof ParticipantWrapper))
            throw new Error(errPrefix + `The participant with ID: ${participant.id} does not exist.`);

        // NOTE: We ALWAYS remove the existing participant object and
        //  graphic elements associated with it.  We had no luck trying
        //  to swap the source of the underlying video node (DOM element).
        //  That is why we completely "recreate the user" when they turn
        //  video streaming on and off.

        // Save the current position and rotation of the avatar.
        // const currentPosition = self.aryParticipantWrapperObjs[participant.id].threeJsAvatar.position;
        // const currentRotation = self.aryParticipantWrapperObjs[participant.id].threeJsAvatar.rotation;

        if (self.aryParticipantWrapperObjs[participant.id] instanceof ParticipantWrapper)
            // Tell the existing participant object to maintain itself.
            self.aryParticipantWrapperObjs[participant.id].cleanUp();

        // Create a new participant object.
        self.aryParticipantWrapperObjs[participant.id] =
           new ParticipantWrapper(participant, stream);

        // NOTE: We are relying on the remote participant to send us a
        //  status update to reposition the recreated avatar properly.


        // Carry over the current position and rotation of the participant.
        // self.aryParticipantWrapperObjs[participant.id].threeJsAvatar.position.set(currentPosition);
        // self.aryParticipantWrapperObjs[participant.id].threeJsAvatar.rotation.set(currentRotation);
    }

    /**
     * This method should be called from the VoxeetSDK.conference.on('streamRemoved')
     *  event handler.  It removes relevant ParticipantWrapper object from  the
     *  list of ParticipantWrapper objects after telling the object to clean up
     *  after itself.
     *
     * @param {Object} participant - A Voxeet SDK participant object.
     * @param {Object} stream  - The Voxeet SDK stream object
     *  associated with the participant.
     */
    this.removeParticipant = function(participant, stream) {
        let methodName = self.constructor.name + '::' + `removeParticipant`;
        let errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(participant))
            throw new Error(errPrefix + `The participant is not a valid object.`);

        if (!misc_shared_lib.isNonNullObjectAndNotArray(stream))
            throw new Error(errPrefix + `The stream is not a valid object.`);

        console.info(`${errPrefix}Removing participant with ID: ${participant.id}`);

        // If there is no participant with the given ID, then that is an error.
        if (!(self.aryParticipantWrapperObjs[participant.id] instanceof ParticipantWrapper))
            throw new Error(errPrefix + `The participant with ID: ${participant.id} does not exist.`);

        // Tell the participant object to clean up after itself.
        self.aryParticipantWrapperObjs[participant.id].cleanUp(participant, stream);

        // Remove the participant object from our collection.
        delete self.aryParticipantWrapperObjs[participant.id];

        console.info(`${errPrefix}Participant with ID successfully removed: ${participant.id}`);
    }

    // Return the current contents of our aryParticipantWrapperObjs object
    //  as a simple array of ParticipantWrapper objects.
    this.getActiveParticipantObjs =  function(){
        const methodName = self.constructor.name + '::' + `getActiveParticipantObjs`;
        const errPrefix = '(' + methodName + ') ';

        let retAryActiveParticipantWrappers = [];

        for (let propKey in self.aryParticipantWrapperObjs) {
            let participantWrapperObj = self.aryParticipantWrapperObjs[propKey];

            retAryActiveParticipantWrappers.push(participantWrapperObj);
        }

        return retAryActiveParticipantWrappers;
    }

    /**
     * Use this function to update the position of the listener (aka
     *  the local user).  This function should be called from the
     *  ThreeJS animate() function using the camera's position and '
     *  rotation.
     *
     * @param {THREE.Vector3} position - The position of the camera.
     * @param {THREE.Vector3} rotation - The rotation of the camera.
     *
     */
    this.updateListenerPosition = function(position, rotation) {
        const methodName = self.constructor.name + '::' + `updateListenerPosition`;
        const errPrefix = '(' + methodName + ') ';

        if (!(position instanceof THREE.Vector3))
            throw new Error(errPrefix + `The value in the position parameter is not a THREE.Vector3 object.`);
        if (!(rotation instanceof THREE.Vector3))
            throw new Error(errPrefix + `The value in the rotation parameter is not a THREE.Vector3 object.`);

        const localUserId = getLocalUserParticipantId();

        if (misc_shared_lib.isEmptySafeString(localUserId))
            throw new Error(errPrefix + `The localUser ID is empty.`);

        const localUserObj = self.findParticipantWrapperById(localUserId);

        if (!misc_shared_lib.isNonNullObjectAndNotArray(localUserObj)) {
            // If the localUserObj is NULL then they have not joined a conference yet,
            //  or they have exited a conference.  Either way, we don't have a
            //  a ThreeJS object for them.
            // console.info(`${errPrefix}The local user is not in a conference currently.`);
            return;
            // throw new Error(errPrefix + `The localUser object is not a valid object.`);
        }

        localUserObj.threeJsAvatar.position.set(position.x, position.y, position.z);
        localUserObj.threeJsAvatar.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    /**
     * Return an of the strings that shows each participant's ID, position, and rotation
     *  for the participants in our collection.
     *
     * @return {Array<String>}
     */
    this.toStringArray = function() {
        const methodName = self.constructor.name + '::' + `toStringArray`;
        const errPrefix = '(' + methodName + ') ';

        let retAry = [];

        // Loop through each participant in our collection.
        for (let propKey in self.aryParticipantWrapperObjs) {
            let participantWrapperObj = self.aryParticipantWrapperObjs[propKey];

            retAry.push(participantWrapperObj.toSummaryString());
        }

        return retAry;
    }
}

/**
 * Create an instance of a ParticipantWrapperManager object.
 */
const g_ParticipantWrapperManager = new ParticipantWrapperManager();

// Return the current contents of the g_AryVideoNodes array as a simple array.
const getActiveVideoNodes = () => {
    let retAryVideoNodes = [];

    for (let propKey in g_AryVideoNodes) {
        let propValue = g_AryVideoNodes[propKey];

        retAryVideoNodes.push(propValue);
    }

    return retAryVideoNodes;
}

export {ParticipantWrapper, ParticipantWrapperManager, g_ParticipantWrapperManager, getActiveVideoNodes, getLocalUserParticipantId, isLocalUserParticipantId}