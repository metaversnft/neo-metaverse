// This module contains some helpful code for interacting with the DolbyIO SDK.

import {getLocalUserParticipantId} from "../participant-helpers/participant-helper-objects.js";
import * as THREE from "../threejs/build/three.module.js";
import {g_GlobalState} from "../objects/global-state.js";

/*

The various participant statuses and their meaning, taken from the DolbyIO SDK
documentation:

    https://docs.dolby.io/communications-apis/docs/js-client-sdk-model-participantstatus

CONNECTED
• CONNECTED: = "Connected"

A participant successfully connected to a conference.

CONNECTING
• CONNECTING: = "Connecting"

A participant received the conference invitation and is connecting to a conference.

DECLINE
• DECLINE: = "Decline"

An invited participant declined the conference invitation. Currently, the Web SDK does not offer the decline method, although participants who use Web SDK can receive the Decline status from other application users who use the Android or iOS SDK. The Web SDK does not receive the notification if the invited participant uses the decline method after joining a conference.

ERROR
• ERROR: = "Error"

A peer connection failed, and the participant cannot connect to a conference.

INACTIVE
• INACTIVE: = "Inactive"

A participant did not enable audio, video, or screen-share and, therefore, is not connected to any stream.

KICKED
• KICKED: = "Kicked"

A participant was kicked from the conference.

LEFT
• LEFT: = "Left"

A participant left the conference.

RESERVED
• RESERVED: = "Reserved"

A participant is invited to a conference and waits for an invitation.

WARNING
• WARNING: = "Warning"

A participant experiences a peer connection problem, which may result in the Error or Connected status.
 */

/**
 * This function returns TRUE if the local user is in a conference
 *   AND the conference has been initialized, FALSE otherwise.
 *   The conference is considered initialized when the status
 *   of the conference has changed from 'created' to 'joined'.
 *
 * @return {boolean}
 */
function isLocalUserInConference() {
    return (VoxeetSDK.conference.current && VoxeetSDK.conference.current.status && VoxeetSDK.conference.current.status === 'joined');
}

/**
 * Handy object that has properties for each of the Dolby IO SDK's supported
 *  participant status values.
 *
 * @constructor
 */
function ParticipantStatusesList() {
    const self = this;
    
    this.CONNECTED = 'Connected';
    this.CONNECTING = 'Connecting';
    this.DECLINE = 'Decline';
    this.ERROR = 'Error';
    this.INACTIVE = 'Inactive';
    this.KICKED = 'Kicked';
    this.LEFT = 'Left';
    this.RESERVED = 'Reserved';
    this.WARNING = 'Warning';

    /**
     * Returns true if the given status is a valid status.
     *
     * @param {String} status - The status to check.
     *
     * @returns {boolean} - True if the status is valid, false otherwise.
     */
    this.isValidStatus = function(theStatus) {
        return (theStatus === self.CONNECTED ||
                theStatus === self.CONNECTING ||
                theStatus === self.DECLINE ||
                theStatus === self.ERROR ||
                theStatus === self.INACTIVE ||
                theStatus === self.KICKED ||
                theStatus === self.LEFT ||
                theStatus === self.RESERVED ||
                theStatus === self.WARNING);
    }
};

/**
 * Broadcast an object over the Voxeet message system.  Note, the
 *  the object must have a constructor function.
 *
 * NOTE: We are using Object for the payloadObj parameter type because
 *  we intend to send many different object types in the future.
 *
 * @param {Object} payloadObj - The object to broadcast.
 */
function sendVoxeetCommand(payloadObj) {
    const errPrefix = `(sendVoxeetCommand) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(payloadObj))
        throw new Error(errPrefix + `The payloadObj is not a valid object.`);

    if (!payloadObj.constructor)
        throw new Error(errPrefix + `The payload object does not have a constructor.`);

    if (misc_shared_lib.isEmptySafeString(payloadObj.constructor.name))
        throw new Error(errPrefix + `The payloadObj.constructor.name parameter is empty.`);

    // If we are not in a conference then there is no point in trying to send the command.
    if (!isLocalUserInConference())
        return;

    // Wrap the object in an outer object that carries a "type" field and the
    //  the payload object itself.
    let outerObj = {};

    // Put the object typeof name in the typePayload field.
    outerObj.typePayload = payloadObj.constructor.name;
    // Put the actual object in the payloadObj fie.d
    outerObj.payloadObj = payloadObj;

    VoxeetSDK.command.send(outerObj).catch(
        (err) => {
            const errMsg =
                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
            console.error(err)
        }
    );

}

/**
 * This is the object that we broadcast and receive over the inter-participant
 *  network that tells all the remote participants to send us their avatar
 *  status.  It is used when we joing a conference so we can create avatars
 *  for everyone else in the conference in the right place and orientation.
 *
 * @constructor
 */
function RequestRemoteParticipantStatuses() {
    /** @property {String} - The ID of the participant that is requesting
     *   the update. */
    this.idOfRequestingParticipant = getLocalUserParticipantId();
}



/**
 * Convert the Voxeet SDK map of conference participants to a simple array.
 *
 * @param {boolean} bIncludeLocalUser - If TRUE, then the local user will
 *  be included in the returned array.  If FALSE, then it won't be included.
 *
 * @return {Array<Object>} - Returns a simple array containing the conference
 *  participants.
 */
function dolbyIoParticipantsMapToArray(bIncludeLocalUser=true) {
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
 * This is the object that we broadcast and receive over the inter-participant
 *  network to update the avatar's for remote participants.  Obviously a
 *  the participants that are remote is relative to the local user.
 *
 * @param {THREE.Camera|null} theCamera - If a camera object is provided
 *  to the constructor, then the camera's position and rotation will be
 *  taken from that object and assigned to our properties
 *
 * @constructor
 */
function RemoteParticipantUpdate(theCamera=null) {
    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {String} - The ID of the participant this update object represents. */
    this.participantId = getLocalUserParticipantId();

    /** @property {Object} - Any custom data that the broadcast recipients should
     *   attach to the customDataFromRemote property of the ParticipantWrapper object
     *   that they create to represent us in their copy of the virtual world
     *  should be attached to this property. */
    this.customData = {};

    /** @property {String|null} - Include the roles assigned to the local user if any. */
    this.customData.localUserRoles = g_GlobalState.localUserRoles;

    /** @property {THREE.Vector3} - The updated position of the participant. */
    this.positionUpdate = null;

    /** @property {THREE.Vector3} - The updated rotation of the participant. */
    this.rotationUpdate = null;

    this.assignFromCamera = function(theCamera) {
        if (theCamera !== null) {
            if (!(theCamera instanceof THREE.Camera))
                throw new Error(errPrefix + `The value in the theCamera parameter is not NULL, yet it is not a THREE.Camera object either.`);

            this.positionUpdate = theCamera.position.clone();
            this.rotationUpdate = theCamera.rotation.clone();
        }
    };

    // ----------------------- CONSTRUCTOR CODE -----------------------
    if (theCamera)
        this.assignFromCamera(theCamera);
}

const ParticipantStatuses = new ParticipantStatusesList();

export {dolbyIoParticipantsMapToArray, isLocalUserInConference, ParticipantStatuses, sendVoxeetCommand, RemoteParticipantUpdate, RequestRemoteParticipantStatuses};