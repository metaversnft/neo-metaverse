// This module contains code that is used across our objects that interact
//  with participants in a scene.

import * as THREE from '../threejs/build/three.module.js';

import {ParticipantWrapper} from "../participant-helpers/participant-helper-objects.js";
// import {g_LocalUserParticipantWrapperObj, g_ThreeJsCamera, g_ThreeJsObjects} from "./three-js-global-objects.js";
import {isLocalUserInConference} from "../dolby-io/dolby-io-support.js";
// import {g_GlobalState} from "./global-state.js";
// import {isOwnedByTelevisionDisplay} from "./object-detectors.js";
import {setRaycasterOriginToTargetObj} from "../threejs-support/threejs-support-code.js";
import {g_ThreeJsCamera, g_ThreeJsObjects} from "./three-js-global-objects.js";


// Reuse these variables to save on memory when using
//  the trueDistance function.
let vecThreeJsObjWorldPos = new THREE.Vector3();
let ourRaycaster = new THREE.Raycaster();
let pseudoAvatar = {};


/**
 * IMPORTANT: The position property in Objects that are
 *  within a group and other similar complex contexts
 *  does not reflect the TRUE world position of the object,
 *  especially for objects in a group that has been moved or
 *  rotated!  Always use this function to get the true distance
 *  between objects in a ThreeJS scene.
 *
 * @param {Object} threeJsObj - A ThreeJS object in the scene.
 * @param {THREE.Vector3} vec3D - The vector to compare to the
 *  ThreeJS object's position property.
 *
 * @return {number} - Returns the true world distance between
 *  the ThreeJS object and the vector.
 */
const trueDistanceFromObject3D = (threeJsObj, vec3D) => {
    const errPrefix = `(trueDistanceFromObject3D) `;

    // Make sure an attempt to pass a position property for the
    //  threeJsObj parameter is not made.
    if (threeJsObj instanceof THREE.Vector3)
        throw new Error(`${errPrefix}The threeJsObj parameter is a THREE.Vector3.  It must be a ThreeJS object in the scene.`);

    if (!(vec3D instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the vec3D parameter is not a THREE.Vector3 object.`);

    // Convert the ThreeJS object's position to world positions.
    vecThreeJsObjWorldPos = threeJsObj.getWorldPosition(vecThreeJsObjWorldPos);

    // Now compute the distance between the two vectors.
    return Math.abs(vecThreeJsObjWorldPos.distanceTo(vec3D));
};

/**
 * This private function validates the common parameters
 *  between some of the functions in this module.  If
 *  any of them are invalid, an error is thrown.
 *
 * @param {String} caller - The name of the calling function.
 * @param {Object} srcThreeJsObj - The source object.
 * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
 *  The current array of participants.  May be empty but it must
 *  be an array.
 * @param {Number} activationDistance - If the distance between the
 *  two objects is less than or equal to this value, then the objects
 *  are considered to be within the activation distance.
 */
function validateCommonParameters(caller, srcThreeJsObj, aryParticipantWrapperObjs, activationDistance) {
    const errPrefix_start = `(validateCommonParameters) `;

    if (misc_shared_lib.isEmptySafeString(caller))
        throw new Error(`${errPrefix_start}The caller parameter is empty.`);

    const errPrefix = `(${caller}) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(srcThreeJsObj))
        throw new Error(`${errPrefix}The srcThreeJsObj is not a valid object.`);
    if (!Array.isArray(aryParticipantWrapperObjs))
        throw new Error(`${errPrefix}The aryParticipantWrapperObjs parameter value is not an array.`);
    if (typeof activationDistance !== 'number')
        throw new Error(`${errPrefix}The value in the activationDistance parameter is not a number.`);
    if (activationDistance <= 0)
        throw new Error(`${errPrefix}The value in the activationDistance parameter is negative or zero:${activationDistance}.`);
}

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
    const errPrefix = `(isWithinActivationDistance) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj_1))
        throw new Error(`${errPrefix}The threeJsObj_1 is not a valid object.`);

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj_2))
        throw new Error(`${errPrefix}The threeJsObj_2 is not a valid object.`);

    if (typeof activationDistance !== 'number')
      throw new Error(`${errPrefix}The value in the activationDistance parameter is not a number.`);
    if (activationDistance <= 0)
        throw new Error(`${errPrefix}The activationDistance is negative or zero: ${activationDistance}.`);

    // How far are they from each other?
    let distance =
        // Math.abs(threeJsObj_1.position.distanceTo(threeJsObj_2.position));
        trueDistanceFromObject3D(threeJsObj_1, threeJsObj_2.position);

    // TODO: This will be a problem when we have scenes with multiple floors!
    //
    // Remove the half the height of the first object from the distance
    //  so that tall objects don't complicate the distance calculations.
    distance -= (Math.abs(threeJsObj_1.position.y) / 2);
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
function isAnyParticipantWithinActivationDistance(srcThreeJsObj, aryParticipantWrapperObjs, activationDistance) {
    const methodName = 'isAnyParticipantWithinActivationDistance';
    const errPrefix = `(${methodName}) `;

    validateCommonParameters(methodName, srcThreeJsObj, aryParticipantWrapperObjs, activationDistance);

    // If we are not in a conference, then we only activate if the local user
    //  is within our activation distance.
    if (isLocalUserInConference()) {
        // Use the participant's array.  Note, the local user should
        //  be in the array so we don't check the local user directly.
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

/**
 * Given an array of ParticipantWrapper objects, Return the
 *  participant wrapper object of the closest participant that
 *  is within the activation distance AND is looking at the target
 *  object, or NULL if none of the participants meet that criteria OR if
 *  the local user is not in a conference.
 *
 * @param {THREE.Object3D} targThreeJsObj - The object that needs to know
 *  if any participants are looking at it.
 * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
 *  The current array of participants.  May be empty but it must
 *  be an array.
 * @param {Number} activationDistance - If the distance between the
 *  two objects is less than or equal to this value, then the objects
 *  are considered to be within the activation distance.
 *
 * @return {ParticipantWrapper}
 */
function getClosestParticipantLookingAtUs(targThreeJsObj, aryParticipantWrapperObjs, activationDistance) {
    const methodName = 'getClosestParticipantLookingAtUs';
    const errPrefix = `(${methodName}) `;

    // This function returns TRUE if the given participant wrapper object's
    //  avatar is looking at the given targThreeJsObj, with no other objects
    //  in the way.  Otherwise it returns NULL.
    function isParticipantLookingAtSrcObj(theParticipantWrapperObj) {
        // Set the direction of the picking ray from the position and orientation of the
        //  participant's avatar object to the target object.
        setRaycasterOriginToTargetObj(ourRaycaster, theParticipantWrapperObj.threeJsAvatar, targThreeJsObj);

        // Is the participant looking at the target object with no objects in between?  If there
        //  are no objects in between the participant and the target object, then the participant
        //  should be the first element of the intersection array.
        const aryObjectsLookedAt = ourRaycaster.intersectObjects(g_ThreeJsObjects, true);

        if (aryObjectsLookedAt && aryObjectsLookedAt.length > 0 && aryObjectsLookedAt[0].object === targThreeJsObj )
            return theParticipantWrapperObj;
    }

    // If we are not in a conference, then just leave.  There are no
    //  participant wrapper objects to evaluate.
    if (!isLocalUserInConference())
        return null;

    validateCommonParameters(methodName, targThreeJsObj, aryParticipantWrapperObjs, activationDistance);

    // Use the participant's array.  Note, the local user should
    //  be in the array so we don't check the local user directly.
    if (aryParticipantWrapperObjs.length < 1)
        // Nothing to check.  Has to be FALSE.
        return null;

    // Iterate the array of current participants.
    for (let ndx = 0; ndx < aryParticipantWrapperObjs.length; ndx++) {
        const participantWrapperObj = aryParticipantWrapperObjs[ndx];

        if (!(participantWrapperObj instanceof ParticipantWrapper))
            throw new Error(errPrefix + `The value in the participantWrapperObj parameter is not a ParticipantWrapper object.`);

        if (isWithinActivationDistance(targThreeJsObj, participantWrapperObj.threeJsAvatar, activationDistance)) {
            const retParticipantWrapperObj = isParticipantLookingAtSrcObj(participantWrapperObj);

            if (retParticipantWrapperObj)
                return participantWrapperObj;
        }
    }

    return null;
}

/**
 * Ths function returns TRUE if the camera is within the activation distance
 *  of the given srcThreeJsObj and it is looking at the given srcThreeJsObj.
 *
 * @param {Object} targThreeJsObj - The object that we want to know if the camera
 *  is looking at or not.
 * @param {Number} activationDistance - If the distance between the
 *  two objects is less than or equal to this value, then the objects
 *  are considered to be within the activation distance.
 *
 * @return {boolean}
 */
function isCameraLookingAtTargetObj(targThreeJsObj, activationDistance) {
    const errPrefix = `(isCameraLookingAtTargetObj) `;

    if (!(targThreeJsObj instanceof THREE.Object3D))
        throw new Error(errPrefix + `The value in the targThreeJsObj parameter is not a THREE.Object3D object.`);
    if (typeof activationDistance !== 'number')
        throw new Error(`${errPrefix}The value in the activationDistance parameter is not a number.`);
    if (activationDistance <= 0)
        throw new Error(`${errPrefix}The value in the activationDistance parameter is negative or zero:${activationDistance}.`);

    // Set the direction of the picking ray from the position and orientation of the
    //  camera to the target object.
    setRaycasterOriginToTargetObj(ourRaycaster, g_ThreeJsCamera, targThreeJsObj);

    // Is the camera looking at the source object with no objects in between?  If there
    //  are no objects in between the camera and the target object, then the target object
    //  should be the first element of the intersection array.
    const aryObjectsLookedAt = ourRaycaster.intersectObjects(g_ThreeJsObjects, true);

    if (aryObjectsLookedAt && aryObjectsLookedAt.length > 0 && aryObjectsLookedAt[0].object === targThreeJsObj )
        return true;
    else
        return false;
}

export {getClosestParticipantLookingAtUs, isCameraLookingAtTargetObj, isWithinActivationDistance, isAnyParticipantWithinActivationDistance, trueDistanceFromObject3D};