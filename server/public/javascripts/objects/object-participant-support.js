// This module contains code that is used across our objects that interact
//  with participants in a scene.

import {ParticipantWrapper} from "../participant-helpers/participant-helper-objects.js";
import {g_ThreeJsCamera} from "./three-js-global-objects.js";
import {isLocalUserInConference} from "../dolby-io/dolby-io-support.js";

/**
 * This method returns TRUE if the two ThreeJS object given are within
 *  the specified activation distance.
 *
 * @param {Object} threeJsObj_1 - A ThreeJS object in the scene.
 * @param {Object} threeJsObj_2 - Another ThreeJS object in the scene.
 * @param {Number} activationDistance - If the distance between the
 *  two objects is less than or equal to this value, then the objects
 *  are considered to be within the activation distance.
 *
 * @return {boolean} - Return TRUE if the given ThreeJS objects are within
 *  the activation distance, FALSE if not.
 */
const isWithinActivationDistance = (threeJsObj_1, threeJsObj_2, activationDistance) => {
    const methodName = self.constructor.name + '::' + `isWithinActivationDistance`;
    const errPrefix = '(' + methodName + ') ';

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj_1))
        throw new Error(errPrefix + `The threeJsObj_1 is not a valid object.`);

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj_2))
        throw new Error(errPrefix + `The threeJsObj_2 is not a valid object.`);

    if (typeof activationDistance !== 'number')
      throw new Error(errPrefix + `The value in the activationDistance parameter is not a valid number.`);

    if (activationDistance < 0)
        throw new Error(errPrefix + `The activationDistance is negative.`);

    // How far are they from each other?
    let distance =
        Math.abs(threeJsObj_1.position.distanceTo(threeJsObj_2.position));

    // TODO: This will be a problem when we have scenes with multiple floors!
    //
    // Remove the half the height of the first object from the distance
    //  so that tall objects don't complicate the distance calculations.
    distance -= (threeJsObj_1.position.y / 2);
    return distance <= activationDistance;
}

/**
 * Given an array of ParticipantWrapper objects, return TRUE if any
 *  of the participants are within our activation range, FALSE if not..
 *
 * @param {Object} srcThreeJsObj - The object that needs to know
 *  if any participants are within its activation range.
 * @param {Array<ParticipantWrapper>} aryParticipantWrapperObjs -
 *  The current array of participants.  May be empty.
 * @param {Number} activationDistance - If the distance between the
 *  two objects is less than or equal to this value, then the objects
 *  are considered to be within the activation distance.
 *
 * @return {boolean} - Return TRUE if any of the participants
 *  are within our activation range, FALSE if not.
 */
const isAnyParticipantWithinActivationDistance = (srcThreeJsObj, aryParticipantWrapperObjs, activationDistance) => {
    const methodName = self.constructor.name + '::' + `isAnyParticipantWithinActivationDistance`;
    const errPrefix = '(' + methodName + ') ';

    if (!misc_shared_lib.isNonNullObjectAndNotArray(srcThreeJsObj))
    	throw new Error(errPrefix + `The srcThreeJsObj is not a valid object.`);

    // If we are not in a conference, then we only activate if the local user
    //  is within our activation distance.
    if (isLocalUserInConference()) {
        // Use the participant's array.  Note, the local user should
        //  be in the array so we don't check the local user directly.
        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        if (aryParticipantWrapperObjs.length < 1)
            // Nothing to check.  Has to be FALSE.
            return false;

        // Iterate the array of current participants.
        for (let ndx = 0; ndx < aryParticipantWrapperObjs.length; ndx++) {
            const participantWrapperObj = aryParticipantWrapperObjs[ndx];

            if (!(participantWrapperObj instanceof ParticipantWrapper))
                throw new Error(errPrefix + `The value in the participantWrapperObj parameter is not a ParticipantWrapper object.`);

            if (isWithinActivationDistance(srcThreeJsObj, participantWrapperObj.threeJsAvatar, activationDistance))
                return true;
        }
    } else {
        // Use the camera position and rotation as a substitute for the local user's
        //  avatar position and rotation.
        let pseudoAvatar = {};
        pseudoAvatar.position = g_ThreeJsCamera.position.clone();

        if (isWithinActivationDistance(srcThreeJsObj, pseudoAvatar, activationDistance))
            return true;
    }

    return false;
}

export {isWithinActivationDistance, isAnyParticipantWithinActivationDistance};