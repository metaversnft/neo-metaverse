// This module contains helpful functions to detect our options
//  that are attached to the userData property of various ThreeJS
//  Object3D objects.

/**
 * IMPORTANT!!:  Remember to update getNeo3DParentObj() if new specialized
 *  object types are added.
 */

import * as THREE from '../threejs/build/three.module.js';

import {TelevisionDisplay} from "./television.js";
import {PictureDisplay} from "./picture-display.js";
import {ParticipantWrapper} from "../participant-helpers/participant-helper-objects.js";

/**
 * This function gets the property value of the Neo3DParentObj
 *  property with deep property chain inspection
 *
 * @param {THREE.Object3D} threeJsObj - A ThreeJS Object3D object.
 *
 * @return {Object|null} - Returns the value of the Neo3DParentObj
 *  if the given Object3D has a property named 'Neo3DParentObj'.
 *  Otherwise, returns null.
 */
function getNeo3DParentObj(threeJsObj) {
    const errPrefix = `(getNeo3DParentObj) `;

    if (!(threeJsObj instanceof THREE.Object3D))
        return null;

    if (!threeJsObj.userData)
        return null;

    if (!threeJsObj.userData.neo3DParentObj)
        return null;

    return threeJsObj.userData.neo3DParentObj;
}

/**
 * This function returns TRUE if the given object belongs to
 *  television display object, FALSE if not.
 *
 * @param {THREE.Object3D} threeJsObj - A ThreeJS Object3D object.
 *
 * @return {boolean}
 */
function isOwnedByTelevisionDisplay(threeJsObj) {
    const neo3DParentObj = getNeo3DParentObj(threeJsObj);

    if (neo3DParentObj)
        return (neo3DParentObj instanceof TelevisionDisplay);
    return false;
}

/**
 * This function returns TRUE if the given object belongs to
 *  picture display object, FALSE if not.
 *
 * @param {THREE.Object3D} threeJsObj - A ThreeJS Object3D object.
 *
 * @return {boolean}
 */
function isOwnedByPictureDisplay(threeJsObj) {
    const neo3DParentObj = getNeo3DParentObj(threeJsObj);

    if (neo3DParentObj)
        return (neo3DParentObj instanceof PictureDisplay);
    return false;
}

/**
 * This function returns TRUE if the given object belongs to
 *  participant wrapper object, FALSE if not.
 *
 * @param {THREE.Object3D} threeJsObj - A ThreeJS Object3D object.
 *
 * @return {boolean}
 */
function isOwnedByParticipantWrapper(threeJsObj) {
    const neo3DParentObj = getNeo3DParentObj(threeJsObj);

    if (neo3DParentObj)
        return (neo3DParentObj instanceof ParticipantWrapper);
    return false;
}

/**
 *
 * @param neo3DObjectType
 * @return {string}
 *
function neo3DObjectTypeToString(neo3DObjectType) {

    switch (neo3DObjectType) {
        case neo3DObjectType instanceof TelevisionDisplay:
            return "TelevisionDisplay";
        case neo3DObjectType instanceof PictureDisplay:
            return "PictureDisplay";
        case neo3DObjectType instanceof ParticipantWrapper:
            return "ParticipantWrapper";
        default:
            return "Unknown neo3D object type";
    }
}
*/

export {getNeo3DParentObj, isOwnedByParticipantWrapper, isOwnedByPictureDisplay, isOwnedByTelevisionDisplay};