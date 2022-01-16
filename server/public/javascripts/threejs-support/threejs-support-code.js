// This module contains code to support other ThreeJS code in our app.

/*
IMPORTANT!!! - When your rotation (camera) is 0, 0, 0, you are pointing in the NEGATIVE Z direction!
 */


import * as THREE from "../threejs/build/three.module.js";
import {g_GlobalState} from "../objects/global-state.js";
import {g_ThreeJsCamera} from "../objects/three-js-global-objects.js";

// The array of valid cube surface name, one for each side of the cube.
const aryCubeSurfaceNames = ['neg_x', 'pos_x', 'neg_y', 'pos_y', 'neg_z', 'pos_z'];

// Reuse these vectors for calculations to avoid creating new objects.
let vecThreeJsObjWorldDir = new THREE.Vector3();
let vecThreeJsObjWorldPos = new THREE.Vector3();
let farVec3 = new THREE.Vector3()

// Create an associative array that maps a surface name to the
//  corresponding THREE.Vector3 object that would point an
//  object with that rotation in the direction of the surface.
let arySurfaceNameToRotation = [];

let bVerbose = true;

arySurfaceNameToRotation['neg_x'] = new THREE.Vector3(0, -Math.PI/2, 0);
arySurfaceNameToRotation['pos_x'] = new THREE.Vector3(0, Math.PI, 0);
arySurfaceNameToRotation['neg_y'] = new THREE.Vector3(-Math.PI/2, 0, 0);
arySurfaceNameToRotation['pos_y'] = new THREE.Vector3(Math.PI/2, 0, 0);
arySurfaceNameToRotation['neg_z'] = new THREE.Vector3(0, 0, 0);
arySurfaceNameToRotation['pos_z'] = new THREE.Vector3(0, Math.PI, 0);

// The cardinal direction to surface name xref array.  Note,
//  UP and DOWN are added since the classic cardinal directions
//  do not include them and we wanted entries for the
//  'neg_y' and 'pos_y' surfaces.
const xrefCardinalDirToSurfaceName = {
    // ['north', 'west', 'south', 'east'];
    north: 'neg_z',
    west: 'pos_x',
    south: 'pos_z',
    east: 'neg_x',
    down: 'neg_y',
    up: 'pos_y'
}

/**
 * Simple object to hold a width and a height field.
 *
 * @param {Number} width - A valid widht.
 * @param {Number} height - A valid height.
 */
function Dimensions2D(width, height) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    if (!misc_shared_lib.isZeroOrPositiveNumber(height))
    	throw new Error(errPrefix + `The value in the width parameter is not a number: ${width}.`);
    if (!misc_shared_lib.isZeroOrPositiveNumber(height))
        throw new Error(errPrefix + `The value in the width parameter is not a number: ${width}.`);

    /** @property {Number} - A valid width. */
    this.width = width;

    /** @property {Number} - A valid height. */
    this.height = height;
}


/**
 * Given a cardinal direction, returns the corresponding THREE.js rotation.
 *
 * @param {String} cardinalDirection - The cardinal direction to
 *  convert.
 *
 * @return {THREE.Vector3} - Return a THREE.Vector3 object with the
 *  with the 3 rotations that describe the resulting orientation.
 */
function cardinalDirectionToEulerAngle(cardinalDirection) {
    const errPrefix = `(cardinalDirectionToEulerAngle) `;

    if (misc_shared_lib.isEmptySafeString(cardinalDirection))
        throw new Error(errPrefix + `The cardinalDirection parameter is empty.`);

    // Translate the cardinal direction to an euler angle by
    //  translating it to the cube surface name it corresponds to
    //  and then calling surfaceNameToRotation() with that value.
    switch (cardinalDirection.toLowerCase()) {
        case "north":
            return surfaceNameToRotation('neg_z');
        case "south":
            return surfaceNameToRotation('pos_z');
        case "east":
            return surfaceNameToRotation('neg_x');
        case "west":
            return surfaceNameToRotation('pos_x');
        default:
            throw new Error("Invalid cardinal direction: " + cardinalDirection);
    }
}

/**
 * Given a cardinal direction, returns the corresponding THREE.js rotation.
 *
 * @param {String} ceilingOrFloor - Either "ceiling" or "floor"
 *  depending on which orientation is desired.
 *
 * @return {THREE.Vector3} - Return a THREE.Vector3 object with the
 *  with the 3 rotations that describe the resulting orientation.
 */
function ceilingOrFloorToEulerAngle(ceilingOrFloor) {
    const errPrefix = `(ceilingOrFloorToEulerAngle) `;

    if (misc_shared_lib.isEmptySafeString(ceilingOrFloor))
        throw new Error(errPrefix + `The ceilingOrFloor parameter is empty.`);

    // Translate the ceiling or floor to an euler angle by
    //  translating it to the cube surface name it corresponds to
    //  and then calling surfaceNameToRotation() with that value.
    switch (ceilingOrFloor.toLowerCase()) {
        case "ceiling":
            return surfaceNameToRotation('pos_y');
        case "floor":
            return surfaceNameToRotation('neg_y');
        default:
            throw new Error("Invalid ceiling or floor: " + ceilingOrFloor);
    }
}

// The default orientation in cardinal direction format.
const DEFAULT_CARDINAL_DIRECTION = "north";

// The 3 primary axes of the WORLD coordinate system expressed
//  in the form of THREE.Vector3 objects.
const WORLD_AXIS_X = new THREE.Vector3(1, 0, 0);
const WORLD_AXIS_Y = new THREE.Vector3(0, 1, 0);
const WORLD_AXIS_Z = new THREE.Vector3(0, 0, 1);

// The 4 cardinal directions where NORTH is considered the
//  default direction and the next three are in the order
//  that would be achieved by rotation 90 degrees clockwise
//  around the default NORTH direction.
const g_AryCardinalDirections =  ['north', 'west', 'south', 'east'];

// The angles in radians that correspond to each cardinal direction.
// const g_AryCardinalAnglesInRadians = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
// ThreeJS seems to rotate things counter-clockwise, so we need to flip the
//  the sign of the angles.
const g_AryCardinalAnglesInRadians = [0, -Math.PI / 2, -Math.PI, Math.PI / 2];

/**
 * This object contains the details necessary to perform a specific rotation
 *  around the desired axis.
 *
 * @param {THREE.Vector3} axisToRotateAround - A vector representing the axis
 *  to rotate around in 3D coordinates.
 * @param {Number} angleToRotateInRadians - The angle to rotate the abject about
 *  in radians.
 * @param {Boolean} [bIsWorldAxisRotation] - If TRUE then the axis given
 *  for the rotation is in world coordinates.  If FALSE then the axis
 *  given is coordinates local to the object.  The default is TRUE.
 *
 * @constructor
 */
function RotationDetails(axisToRotateAround, angleToRotateInRadians, bIsWorldAxisRotation=true) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    // Validate parameters.
    if (!(axisToRotateAround instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the axisToRotateAround parameter is not a THREE.Vector3 object.`);

    if (typeof angleToRotateInRadians !== 'number')
    	throw new Error(errPrefix + `The value in the angleToRotateInRadians parameter is not a number.`);

    if (typeof bIsWorldAxisRotation !== 'boolean')
        throw new Error(errPrefix + `The value in the bIsWorldAxisRotation parameter is not boolean.`);

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Number} - The angle to rotate the object about in radians. */
    this.angleToRotateInRadians = angleToRotateInRadians;

    /** @property {THREE.Vector3} - The axis to rotate the object around,
     *   expressed in 3D coordinates. */
    this.axisToRotateAround = axisToRotateAround;

    /** @property {Boolean} - If TRUE, the rotation should be done around
     *   the provided world axis.  If FALSE, then the rotation should be done
     *   around an axis local to the target object that is being rotated. */
    this.isWorldAxisRotation = bIsWorldAxisRotation;

    /**
     * This function will apply the rotation defined by this object to the
     *  provided THREE.Object3D object.
     *
     * @param {Object} targetObj - The object to rotate.
     */
    this.applyRotation = function(targetObj) {
        const methodName = self.constructor.name + '::' + `applyRotation`;
        const errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(targetObj))
        	throw new Error(errPrefix + `The targetObj is not a valid object.`);

        if (self.isWorldAxisRotation) {
            if ('rotateOnWorldAxis' in targetObj) {
                targetObj.rotateOnWorldAxis(self.axisToRotateAround, self.angleToRotateInRadians);
            }
            else {
                throw new Error(errPrefix + `The targetObj does not have a rotateOnWorldAxis method.`);
            }
        } else {
            if ('rotateOnAxis' in targetObj) {
                targetObj.rotateOnAxis(self.axisToRotateAround, self.angleToRotateInRadians);
            }
            else {
                throw new Error(errPrefix + `The targetObj does not have a rotateOnAxis method.`);
            }
        }
    };
}

/**
 * Given a ThreeJS mesh (object), compute it's bounding box
 *  and return it.
 *
 * @param {Object} threeJsMesh - A ThreeJS mesh (object).
 * @param {Boolean} [bIsWorldCoordinates] - If TRUE, the
 *  returned bounding box takes into the transforms
 *  applied to the mesh and its children.  If FALSE,
 *  then it the bounding box is the original bounding
 *  box of the mesh before ay transforms were applied.
 *
 * @return {THREE.Box3} - A ThreeJS bounding box object.
 */
function getBoundingBoxOfThreeJsObject(threeJsMesh, bIncludeRotations=true) {
    const errPrefix = `(getBoundingBoxOfThreeJsObject) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsMesh))
        throw new Error(errPrefix + `The threeJsMesh is not a valid object.`);

    if (typeof bIncludeRotations !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIncludeRotations parameter is not boolean.`);


    if (bIncludeRotations) {
        // ------------------- TRANSFORM ADJUSTED BOUNDING BOX -------------------

        // The computeBoundingBox() method does not take into account the
        //  rotations of the object.  This code computes the bounding box
        //  by taking into account the object's alignment in the world
        //  against world axes and also takes into account the object's
        //  children and their transforms too.
        return new THREE.Box3().setFromObject(threeJsMesh);
    } else {
        // ------------------- MESH LOCAL BOUNDING BOX -------------------

        // Compute the size of the bounding box of the mesh, before any
        //  tranforms are applied, like rotations.
        const geometry = threeJsMesh.geometry;
        geometry.computeBoundingBox();

        return geometry.boundingBox;
    }
}

/**
 * Given a ThreeJS mesh (object), compute it's bounding box
 *  and return it.
 *
 * @param {Object} threeJsMesh - A ThreeJS mesh (object).
 *
 * @return {Object} - A ThreeJS bounding box object.
 */
function getRotatedBoundingBoxOfThreeJsObject(threeJsMesh, rotationEuler3D) {
    const errPrefix = `(getRotatedBoundingBoxOfThreeJsObject) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsMesh))
        throw new Error(errPrefix + `The threeJsMesh is not a valid object.`);

    // Compute the size of the bounding box of the mesh.
    const geometry = threeJsMesh.geometry;
    geometry.computeBoundingBox();

    return geometry.boundingBox;
}

/**
 * Given a ThreeJS mesh (object), compute the center of the mesh
 *  and return it as a THREE.Vector3.
 *
 * @param {Object} threeJsMesh - A ThreeJS mesh (object).
 *
 * @return {Vector3} - Return the center of the mesh as
 *  a THREE.Vector3 object.
 */
function getCenterOfThreeJsObject(threeJsMesh) {
    const errPrefix = `(getCenterOfThreeJsObject) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsMesh))
        throw new Error(errPrefix + `The threeJsMesh is not a valid object.`);

    // Compute the size of the bounding box of the mesh.
    const geometry = threeJsMesh.geometry;
    geometry.computeBoundingBox();

    let centerOfMesh = new THREE.Vector3();
    geometry.boundingBox.getCenter( centerOfMesh );

    // Convert the coordinates from the mesh's local coordinate system
    // to the world coordinate system.
    threeJsMesh.localToWorld( centerOfMesh );
    return centerOfMesh;
}

/**
 * Given a ThreeJS mesh (object), compute the width of the object
 *  in the X direction.
 *
 * @param {Object} threeJsMesh - A ThreeJS mesh (object).
 *
 * @return {Number} - Return width of the object by
 *  taking the difference between the mesh's maximum and
 *  minimum X coordinates.
 */
function getSimpleWidthOfThreeJsObject(threeJsMesh) {
    const errPrefix = `(getSimpleWidthOfThreeJsObject) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsMesh))
        throw new Error(errPrefix + `The threeJsMesh is not a valid object.`);

    // Compute the size of the bounding box of the mesh.
    const geometry = threeJsMesh.geometry;
    geometry.computeBoundingBox();

    return geometry.boundingBox.max.x - geometry.boundingBox.min.x;
}

/**
 * Given an EXTENDED cardinal direction return TRUE if the
 *  direction is a valid cardinal direction, FALSE otherwise.
 *
 * @param {String} extCardinalDir - An extended cardinal
 *  direction, which include 'up' and 'down' besides the
 *  classic 4 cardinal directions.
 *
 * @return {boolean}
 */
function isValidCardinalDirectionExt(extCardinalDir) {
    return (extCardinalDir in xrefCardinalDirToSurfaceName);
}

/**
 * Given an EXTENDED  cardinal direction return the corresponding
 *  surface name for the surface that faces the given direction,
 *  if it were on a cube in the default orientation.
 *
 * @param {String} extCardinalDir - An extended cardinal
 *  direction, which include 'up' and 'down' besides the
 *  classic 4 cardinal directions.
 *
 * @return {String}
 */
function extendedCardinalDirToSurfaceName(extCardinalDir) {
    const errPrefix = `(extendedCardinalDirToSurfaceName) `;

    if (!isValidCardinalDirectionExt(extCardinalDir))
        throw new Error(errPrefix + `The extCardinalDir parameter does not contain a valid cardinal direction.`);

    return xrefCardinalDirToSurfaceName[extCardinalDir];
}


/**
 * Returns TRUE if the given surface name equals the
 *  name of one of the six surfaces of the cube. FALSE
 *  if not.
 *
 * @param {String} surfaceName - The name of the surface to check.
 *
 * @returns {boolean} - TRUE if the given surface name equals the
 *  name of one of the six surfaces of the cube. FALSE
 *  if not.
 *
 * @return {boolean}
 */
function isValidSurfaceName (surfaceName) {
    const errPrefix = `(isValidSurfaceName) `;

    if (misc_shared_lib.isEmptySafeString(surfaceName))
        throw new Error(errPrefix + `The surfaceName parameter is empty.`);
    return aryCubeSurfaceNames.includes(surfaceName);
};

/**
 * Convert a surface name to the rotation that would point
 *  an object with that rotation in the direction of the
 *  surface.  E.g. - neg_x would return a vector that points
 *  an object with that rotation in the negative X direction
 *  with Y and Z components of 0.
 *
 * @param {String} surfaceName - A valid cube surface name.
 *
 * @return {THREE.Vector3} - A vector that contains the
 *  3 rotation values that would point an object to face
 *  in the direction of the given surface name on a cube
 *  oriented in the origin position and rotation.
 */
function surfaceNameToRotation(surfaceName) {
    const errPrefix = `(surfaceNameToRotation) `;

    if (misc_shared_lib.isEmptySafeString(surfaceName))
        throw new Error(errPrefix + `The surfaceName parameter is empty.`);

    if (!isValidSurfaceName(surfaceName))
        throw new Error(errPrefix + `The surfaceName parameter is not a valid surface name: ${surfaceName}.`);

    return arySurfaceNameToRotation[surfaceName];
}

/**
 * Given a surface name, return the surface name on a cube of
 *  default orientation that corresponds to the face on the
 *  cube that is facing in the direction of the given surface.
 *
 * @param {String} cardinalDirection - A valid cardinal direction.
 *
 * @return {String} - Returns name of the surface that
 *  corresponds to the face on the cube that is facing
 *  in that direction if it were in the default orientation.
 */
function cardinalDirectionToSurfaceName(cardinalDirection) {
    const errPrefix = `(cardinalDirectionToSurfaceName) `;

    if (misc_shared_lib.isEmptySafeString(cardinalDirection))
        throw new Error(errPrefix + `The cardinalDirection parameter is empty.`);

    if (!isValidCardinalDirection(cardinalDirection))
        throw new Error(errPrefix + `The cardinalDirection parameter is not a valid cardinal direction: ${cardinalDirection}.`);

    return cardinalDirectionToSurfaceName[cardinalDirection];
}

/**
 * This function validates the given cardinal direction.
 *
 * @param cardinalDir
 * @return {boolean}
 */
function isValidCardinalDirection(cardinalDir) {
    return g_AryCardinalDirections.includes(cardinalDir.toLowerCase());
}

/**
 * This function returns the number of rotations it would take,
 *  mod 4 since there are 4 cardinal directions, to get
 *  from one cardinal direction to the other.
 *
 * @param {String} cardinalDir1 - The first cardinal direction.
 * @param {String} cardinalDir2 - The second cardinal direction.
 *
 * @return {number} - Returns the number of rotations it would take
 *  to get from the first cardinal direction to the other,
 *  wrapping around if necessary.  If wrapping around was
 *  necessary, then the number of rotations is negative.
 */
function diffCardinalDir(cardinalDir1, cardinalDir2) {
    const errPrefix = `(diffCardinalDir) `;

    if (!isValidCardinalDirection(cardinalDir1))
        throw new Error(errPrefix + `The first cardinal direction is not valid: ${cardinalDir1}.`);
    if (!isValidCardinalDirection(cardinalDir2))
        throw new Error(errPrefix + `The second cardinal direction is not valid: ${cardinalDir2}.`);

    const cardinalDir1Index = g_AryCardinalDirections.indexOf(cardinalDir1.toLowerCase());
    const cardinalDir2Index = g_AryCardinalDirections.indexOf(cardinalDir2.toLowerCase());

    return cardinalDir1Index - cardinalDir2Index;
}

/**
 * This function returns the cardinal direction that results from
 *  rotating the dependent cardinal direction the number of
 *  rotations the base cardinal direction is from the default
 *  cardinal direction, which is NORTH.
 *
 * @param {String} baseCardinalDir - The base cardinal direction.
 * @param {String} dependentCardinalDir - The dependent cardinal direction.
 *
 * @return {string} - Returns the cardinal direction that results from
 *  from synchronizing the dependent cardinal direction to the
 *  base cardinal direction, based on the base cardinal direction's
 *  relationship to due NORTH.
 */
function rotateCardinalDirFromBaseDir(baseCardinalDir, dependentCardinalDir) {

    // Determine the number of rotations to get from the
    // base cardinal direction to the dependent cardinal
    // direction.  This value will always be positive since
    //  NORTH is the 0th element in the cardinal directions
    //  array.
    const numBaseRotations = diffCardinalDir(DEFAULT_CARDINAL_DIRECTION, baseCardinalDir);

    // Rotate the base cardinal direction by the same amount so it
    //  is in "sync" with the base cardinal direction.
    const indexOfDependentDir = g_AryCardinalDirections.indexOf(dependentCardinalDir.toLowerCase());

    if (numBaseRotations + indexOfDependentDir >= g_AryCardinalDirections.length)
        // Wrap around.
        return g_AryCardinalDirections[(numBaseRotations + indexOfDependentDir) - g_AryCardinalDirections.length];
    else
        return g_AryCardinalDirections[numBaseRotations + indexOfDependentDir];
}

/**
 * Gives the angle necessary to rotate a vector facing in the
 *  default cardinal direction to face in the given cardinal
 *  direction.  The angle given is one that rotates around
 *  the World Y axis (yaw).
 *
 * @param {String} cardinalDir - The cardinal direction to get the angle for.
 *
 * @return {Number} - Returns the angle in radians that corresponds to the
 *  given cardinal direction.
 */
function cardinalDirectionToRotation(cardinalDir) {
    const errPrefix = `(cardinalDirectionToRotation) `;

    if (!isValidCardinalDirection(cardinalDir))
        throw new Error(errPrefix + `The cardinal direction is not valid: ${cardinalDir}.`);

    const ndxOfCardinalDir =  g_AryCardinalDirections.indexOf(cardinalDir.toLowerCase());

    return g_AryCardinalAnglesInRadians[ndxOfCardinalDir];
}

/**
 * Given a desired cardinal direction, determine the angle necessary
 *  to rotate a vector around the Y axis to make it face in that
 *  direction, and then wrap it in a Euler angle stored in
 *  THREE.Vector3 format.
 *
 * @param {String} cardinalDir - The desired cardinal direction.
 *
 * @return {Vector3} - Returns a Euler angle stored in THREE.Vector3 format
 *  that would rotate an object facing in the default cardinal direction
 *  and make it face the desired cardinal direction.
 */
function cardinalDirectionToEuler3D(cardinalDir) {
    const errPrefix = `(cardinalDirectionToEuler3D) `;

    if (!isValidCardinalDirection(cardinalDir))
        throw new Error(errPrefix + `The cardinal direction is not valid: ${cardinalDir}.`);

    const angleOfRotationInRadians = cardinalDirectionToRotation(cardinalDir);

    return new THREE.Vector3(0, angleOfRotationInRadians, 0);
}

/**
 * Set up the picking ray of a raycaster to start at a desired object and then
 *  extend in the direction of a target object.
 *
 * @param {THREE.Raycaster} theRaycaster - A Three.js raycaster object.
 * @param {THREE.Object3D} originObj - The object to start the ray at.
 * @param {THREE.Object3D} targetObj - The object to extend the ray to.
 *
 * @param {Boolean} bStopAtDestObj - If TRUE, the raycaster will stop at the
 *  target object.  If FALSE, the raycaster will continue to extend into
 *  infinity.
 */
function setRaycasterOriginToTargetObj(theRaycaster, originObj, targetObj, bStopAtDestObj=true  ) {
    const errPrefix = `(setRaycasterOriginToTargetObj) `;

    if (!(theRaycaster instanceof THREE.Raycaster))
        throw new Error(errPrefix + `The value in the theRaycaster parameter is not a THREE.Raycaster object.`);

    if (!(originObj instanceof THREE.Object3D))
        throw new Error(errPrefix + `The value in the originObj parameter is not a THREE.Object3D object.`);

    if (!(targetObj instanceof THREE.Object3D))
        throw new Error(errPrefix + `The value in the targetObj parameter is not a THREE.Object3D object.`);

    // This only creates a vector that points from the originObj to the targetObj,
    //  with no regard to what direction the origin object is facing (i.e. -
    //  it's current rotation.
    // Create a direction that points from the origin object to the target object.
    // theDirection.subVectors(targetObj.position, originObj.position).normalize()

    /*
    if ( g_ThreeJsCamera && g_ThreeJsCamera.isPerspectiveCamera ) {
        //     g_Mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        //     g_Mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        let pseudoMouse = {};

        pseudoMouse.x = originObj.position.x;
        pseudoMouse.y = originObj.position.y;

        theRaycaster.ray.origin.setFromMatrixPosition( g_ThreeJsCamera.matrixWorld );
        theRaycaster.ray.direction.set( pseudoMouse.x, pseudoMouse.y, 0.5 ).unproject( g_ThreeJsCamera ).sub( theRaycaster.ray.origin ).normalize();
        theRaycaster.camera = g_ThreeJsCamera;

    } else if ( g_ThreeJsCamera && g_ThreeJsCamera.isOrthographicCamera ) {

        // set origin in plane of g_ThreeJsCamera
        theRaycaster.ray.origin.set( pseudoMouse.x, pseudoMouse.y, ( g_ThreeJsCamera.near + g_ThreeJsCamera.far ) / ( g_ThreeJsCamera.near - g_ThreeJsCamera.far ) ).unproject( g_ThreeJsCamera );
        theRaycaster.ray.direction.set( 0, 0, - 1 ).transformDirection( g_ThreeJsCamera.matrixWorld );
        theRaycaster.camera = g_ThreeJsCamera;

    } else {
        console.error(`${errPrefix}THREE.Raycaster: Unsupported g_ThreeJsCamera type: ${g_ThreeJsCamera.type}.`);
    }
    */

    // Convert the ThreeJS object's position to world positions.
    vecThreeJsObjWorldPos = originObj.getWorldPosition(vecThreeJsObjWorldPos);

    // Get the origin object's current direction (i.e. - in what direction
    //  it is facing).
    vecThreeJsObjWorldDir = originObj.getWorldDirection(vecThreeJsObjWorldDir);

    // TODO: Find out why all the axes appears to be flipped and then
    //  remove this code.
    vecThreeJsObjWorldDir.x *= -1;
    vecThreeJsObjWorldDir.y *= -1;
    vecThreeJsObjWorldDir.z *= -1;

    // Set the picking ray at the origin object's position, and extend it
    //  in the direction of the target object.
    theRaycaster.set(vecThreeJsObjWorldPos, vecThreeJsObjWorldDir);

    if (g_GlobalState.breakHerePlease) {
        const raycasterDetailsStr = raycasterDetailsToString(theRaycaster);
        console.info(`${errPrefix}Raycaster details - ${raycasterDetailsStr}`);
    }

    // Is an infinite ray desired?
    /*
    if (bStopAtDestObj)
        // No.  Stop the ray at the target object.
        theRaycaster.far = farVec3.subVectors(targetObj.position, originObj.position).length();
     */
}

/**
 * Returns a string that shows the XYZ coordinates of a THREE.Vector3 object.
 *
 * @param {THREE.Vector3} vec3 - The THREE.Vector3 object to show.
 *
 * @return {string}
 */
function vec3ToString(vec3) {
    const errPrefix = `(vec3ToString) `;

    if (!(vec3 instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the vec3 parameter is not a THREE.Vector3 object.`);

    return `(x: ${vec3.x}, y: ${vec3.y}, z: ${vec3.z})`;
}

/**
 * Returns a string that shows the XYZ coordinates and direction
 *  of a THREE.Raycaster object.
 *
 * @param {THREE.Raycaster} theRaycaster - The THREE.Raycaster object to show.
 *
 * @return {string}
 */
function raycasterDetailsToString(theRaycaster) {
    const errPrefix = `(raycasterDetailsToString) `;

    if (!(theRaycaster instanceof THREE.Raycaster))
        throw new Error(errPrefix + `The value in the theRaycaster parameter is not a THREE.Raycaster object.`);

    const raycastOriginStr = vec3ToString(theRaycaster.ray.origin);
    const raycastDirectionStr = vec3ToString(theRaycaster.ray.direction);

    return `Raycaster: origin: ${raycastOriginStr}, direction: ${raycastDirectionStr}, far: ${theRaycaster.far}`;
}

export {
    cardinalDirectionToEuler3D,
    cardinalDirectionToRotation,
    cardinalDirectionToEulerAngle,
    ceilingOrFloorToEulerAngle,
    Dimensions2D,
    DEFAULT_CARDINAL_DIRECTION,
    extendedCardinalDirToSurfaceName,
    getBoundingBoxOfThreeJsObject,
    getCenterOfThreeJsObject,
    getSimpleWidthOfThreeJsObject,
    isValidSurfaceName,
    RotationDetails,
    raycasterDetailsToString,
    rotateCardinalDirFromBaseDir,
    setRaycasterOriginToTargetObj,
    surfaceNameToRotation,
    vec3ToString,
    WORLD_AXIS_X, WORLD_AXIS_Y, WORLD_AXIS_Z};