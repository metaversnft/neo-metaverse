// This module contains code to manage the "televisions" in the ThreeJS scene.
//  These are the flat-screen televisions that are displayed in the scene.

import * as THREE from '../threejs/build/three.module.js';
import * as POINTERLOCK from "../threejs/examples/pointerlock.js";
import * as PARTICIPANT_SUPPORT from "./object-participant-support.js";
import {ParticipantWrapper, ParticipantWrapperManager, g_ParticipantWrapperManager, isLocalUserParticipantId, getLocalUserParticipantId} from "../participant-helpers/participant-helper-objects.js";
import {g_ThreeJsCamera} from "./three-js-global-objects.js";

// Object that acts like an associative array that keeps track of all the
//  active video nodes created by this module.
let g_AryVideoNodesForTelevisions = [];

// This is the distance in ThreeJS world units that an object must be from a television
//  before we consider it within the television's activation range.
const MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION = 40;

/**
 * This is the object that stores the details for one of the television
 *  objects we put in the scene.
 *
 * @param {String} televisionId - The ID to assign to the television.
 * @param {String} videoUrl - The URL for the video to play on the television.
 * @param {THREE.Vector3} position - The position of the television
 *  in the scene.
 * @param {THREE.Vector3} rotation - The television will be rotated
 *  to face this direction given in this Euler angle.
 * @param {THREE.Vector3} dimensions - The width, height, and depth
 *  of the television in the scene, in ThreeJS world units.
 * @param {Boolean} bIsLooped - Whether or not the video shown on
 *  the television should loop.
 *
 * @constructor
 */
function TelevisionDisplay(televisionId, videoUrl, position, rotation, dimensions, bIsLooped=false, bIsAutoPlay=false) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    if (misc_shared_lib.isEmptySafeString(televisionId))
        throw new Error(errPrefix + `The televisionId parameter is empty.`);

    if (misc_shared_lib.isEmptySafeString(videoUrl))
        throw new Error(errPrefix + `The videoUrl parameter is empty.`);

    if (!(position instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the position parameter is not a THREE.Vector3 object.`);

    if (!(rotation instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the rotation parameter is not a THREE.Vector3 object.`);

    if (!(dimensions instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the dimensions parameter is not a THREE.Vector3 object.`);

    if (typeof bIsLooped !== 'boolean')
        throw new Error(errPrefix + `The value in the bIsLooped parameter is not a boolean.`);

    if (typeof bIsAutoPlay !== 'boolean')
        throw new Error(errPrefix + `The value in the bIsAutoPlay parameter is not a boolean.`);

    /** @property {String} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {String} - The ID to assign to this television. */
    this.televisionId = televisionId;

    /** @property {Object|null} - The DOM element node that contains the "video"
     *  element assigned for our use.  It may be NULL if the user is not
     *  using their camera (i.e. - they are not streaming video, only
     *  audio).  It is created in _buildThreeJSCube(). */
    this.videoNode = null;

    /** @property {String} - The URL for the video to be shown on the
     *   television. */
    this.videoUrl = videoUrl;

    /** @property {Boolean} - If TRUE the video will be started
     *  immediately.  If FALSE, then it won't. */
    this.isAutoPlay = bIsAutoPlay;

    /** @property {Boolean} - If TRUE, then the video shown in the
     *  television should be looped, otherwise don't. */
    this.isLooped = bIsLooped;

    /** @property {THREE.Vector3} - The width, height, and depth
     *   of the cube that represents the television stored in the
     *   X, Y, and Z fields of a THREE.Vector3 object. */
    this.dimensions = dimensions;

    /** @property {THREE.Vector3} - The position where this
     *  object should be placed in the ThreeJS scene. */
    this.position = position;

    /** @property {THREE.Vector3} - The television will be rotated
     *  to face this direction given in this Euler angle. */
    this.rotation = rotation;

    /** @property {Object|null} - The ThreeJS text object created for the
     *   video node that supports the television. */
    this.videoTexture = null;

    /** @property {Object|null} - This property keeps a reference to the
     *  the ThreeJS object that is created to represent this television
     *  in the scene. */
    this.threeJsAvatar = null;

    /** @property {Boolean} - If the currently selected video input device is invalid,
     *   then when we attempt a video command it will fail.  We then set this
     *   flag to FALSE so that all subsequent video commands are ignored.  This
     *   prevents a blizzard of exceptions from occurring from failing future
     *   video commands over and over. */
    this.isVideoNodeUsable = true;

    /** @property {Boolean} - This variable tracks if we have already
     *   reported or not that the video input device does not have a valid
     *   video stream.  That we can output an error message a single time
     *   when we detect this condition, instead of repeatedly logging the
     *   same error message. */
    // this._isVideoNodeProblemReported = false;

    /**
     * This function executes a video command in an intelligent way.
     *  Always use this function to execute video commands instead of
     *  calling the methods belonging to the video node aggregate directly.
     *
     * @param {String} videoCmd - The video command to execute.
     *
     * @returns {Boolean} - Returns TRUE if the video command was executed,
     *  FALSE if we detected a video input device without a valid stream
     *  and therefore the command was not executed and the isVideoNodeUsable
     *  flag was set to FALSE.
     */
    this.executeVideoCommand = async function (videoCmd) {
        const methodName = self.constructor.name + '::' + `executeVideoCommand`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(videoCmd))
            throw new Error(errPrefix + `The videoCmd parameter is empty.`);

        // Is the video node usable?
        if (!self.isVideoNodeUsable) {
            // Ignore the command.  Don't log it because it will be logged
            //  over and over again.
            return self.isVideoNodeUsable;
        }

        try {
            if (!self.videoNode)
                throw new Error(errPrefix + `The videoNode is unassigned.`);
            if (!(videoCmd in self.videoNode))
                throw new Error(`${errPrefix}Invalid video command: ${videoCmd}.`);
            if (typeof self.videoNode[videoCmd] !== 'function')
                throw new Error(`${errPrefix}The video command is a property of the video node, not a function: ${videoCmd}.`);

            // Execute the video command.
            const funcExecVideoCmd = self.videoNode[videoCmd]();
            const cmdResult = await funcExecVideoCmd

                /*
                Catch block doesn't seem to work, at least now with 'play'
                  command. Get the error:  "Cannot read properties of undefined" (reading 'catch')
                  Find out why this is.
            .catch(err => {
                // Convert the error to a promise rejection.
                let errMsg =
                    errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

                console.error(errMsg + ' - await');

                // Set the isVideoNodeUsable flag to FALSE.
                self.isVideoNodeUsable = false;
            });
            */

            return true; // Successfully executed the video command.
        } catch(err) {
            const errMsg =
                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

            console.error(errMsg + ' - try/catch');

            // Save the current value of the isVideoNodeUsable flag.
            // self._previousIsVideoNodeUsable = self.isVideoNodeUsable;

            // Set the isVideoNodeUsable flag to FALSE.
            self.isVideoNodeUsable = false;
        };
    }

    /**
     * This function builds the ThreeJS object that will represent the
     *  television in the scene.  It also handles the creation of the
     *  DOM video element that will be used to display the
     *  video assigned to the television.
     *
     * @param {THREE.Vector3} dimensions - The width, height, and depth
     *  of the television in the scene, in ThreeJS world units.
     *
     * @return {THREE.Mesh} - Return a properly assembled ThreeJS
     *  mesh object to use as the for the television.
     *
     * @private
     */
    this._buildThreeJSCube = function (dimensions) {
        const methodName = self.constructor.name + '::' + `_buildThreeJSCube`;
        const errPrefix = '(' + methodName + ') ';

        if (!(dimensions instanceof THREE.Vector3))
            throw new Error(errPrefix + `The value in the dimensions parameter is not a THREE.Vector3 object.`);

        // Use the television ID to build the video node ID.
        const videoNodeId = 'television-' + self.televisionId;

        // Create a video element and texture for the video that
        //  will represent this television.
        self.videoNode = document.createElement('video');

        self.videoNode.setAttribute('id', videoNodeId);
        self.videoNode.setAttribute('height', 240);
        self.videoNode.setAttribute('width', 320);
        self.videoNode.setAttribute('playsinline', true);

        if (self.isAutoPlay)
            self.videoNode.setAttribute('autoplay', 'autoplay');

        self.videoNode.loop = self.isLooped;

        // Add the video to the global array that tracks all the
        //  video elements for the televisions.
        g_AryVideoNodesForTelevisions[videoNodeId] = self.videoNode;

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
        // 1) Left face of cube (X-)
        // 2) Right face of cube (X+)
        // 3) Bottom face of cube (Y-)
        // 4) Top face of cube (Y+)
        // 5) Front face of cube (Z-), the default direction aka "north" aka Euler angle 0,0,0.
        // 6) Front face of cube (Z+) - This face will show the video stream.
        /*
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff3333 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xff8800 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0xffff33 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0x33ff33 } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { map: videoTexture } ) );
        cubeMaterialArray.push( new THREE.MeshBasicMaterial( { color: 0x8833ff } ) );
        */
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({color: 0xff8800}));
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({color: 0xff8800}));
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({color: 0xff8800}));
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({color: 0xff8800}));
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({map: self.videoTexture}));
        cubeMaterialArray.push(new THREE.MeshBasicMaterial({color: 0xff8800}));

        const cubeMaterials = new THREE.MeshFaceMaterial(cubeMaterialArray);

        // Cube dimensions.
        const cubeGeometry =
            new THREE.CubeGeometry(dimensions.x, dimensions.y, dimensions.z, 1, 1, 1);

        // Set the video source to that given to us at construction time.

        self.videoNode.src = self.videoUrl;
        // TODO: TEST.
        // self.videoNode.src = 'https://www.youtube.com/embed/HIbAz29L-FA?modestbranding=1&playsinline=0&showinfo=0&enablejsapi=1&origin=https%3A%2F%2Flocalhost%3A5000&widgetid=1';

        // Make sure we set the CORS value to "anonymous" or we will
        //  get a CORS error: "DOMException: The element has no supported sources".
        self.videoNode.crossOrigin = 'anonymous';

        // Auto-start the video if requested.
        if (self.isAutoPlay)
            self.executeVideoCommand('play')

        // Build the cube from a basic ThreeJS mesh and return it.
        return new THREE.Mesh(cubeGeometry, cubeMaterials);
    }

    /**
     * This function builds the ThreeJS object that will represent
     *  this television in the scene.  It does NOT add the object
     *  to the scene.
     *
     * @private
     */
    this._createThreeJSAvatar = function () {
        const methodName = self.constructor.name + '::' + `_createThreeJSAvatar`;
        const errPrefix = '(' + methodName + ') ';

        // Build the ThreeJS object that will represent this television.
        self.threeJsAvatar = self._buildThreeJSCube(dimensions);

        // Set the position of the avatar.
        self.threeJsAvatar.position.set(self.position.x, self.position.y, self.position.z);

        // Set the rotation of the avatar.
        self.threeJsAvatar.rotation.set(self.rotation.x, self.rotation.y, self.rotation.z);

        self.threeJsAvatar.scale.x = self.threeJsAvatar.scale.y = self.threeJsAvatar.scale.z = 1;

        // Set its "name" property to the television's ID.
        self.threeJsAvatar.name = self.televisionId;
    }

    /**
     * This method should be called when a television is removed
     *  from the scene.
     */
    this.cleanUp = function () {
        let methodName = self.constructor.name + '::' + `cleanup`;
        let errPrefix = '(' + methodName + ') ';

        console.info(`${errPrefix}Cleaning up television ${self.televisionId}`);

        self.executeVideoCommand('pause');

        // Remove the video node from the DOM and our tracking object.
        self.videoNode.remove();
        delete g_AryVideoNodesForTelevisions[self.videoNode.id];

        // Remove the television from the scene.
        const bObjFoundAndRemoved = POINTERLOCK.removeObjFromSceneByUuid(self.threeJsAvatar.uuid);

        if (!bObjFoundAndRemoved)
            throw new Error(errPrefix + `The avatar object was not found in the scene and therefore the removal attempt was ignored for participant ID: ${self.participantObj.id}.`);
    }

    /**
     * This method updates the state of a television based on the current
     *  scene context.
     *
     * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
     *  The current list of participant objects in the scene.
     */
    this.updateTelevision = function (aryParticipantWrapperObjs) {
        const methodName = self.constructor.name + '::' + `updateTelevision`;
        const errPrefix = '(' + methodName + ') ';

        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        // Update the state of the television based on the current world conditions.
        //
        // NOTE: We set the video volume to zero for other users because
        //  all object volumes are relative to the local user.  The
        //  other participants will have their own volume levels.  However,
        //  we DO activate upon ANY participant entering our activation
        //  zone so that the local user gets to see objects activated
        //  by the actions of other participants, while retaining
        //  the correct relative volumes for the local user (and
        //  therefore for each local user on their own individual
        //  PCs).

        //Are any of the participant's within our "activation" distance?
        if (PARTICIPANT_SUPPORT.isAnyParticipantWithinActivationDistance(
            self.threeJsAvatar,
            aryParticipantWrapperObjs,
            MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION)) {
            // Yes, someone is near us.  Is the video playing?
            if (!self.videoNode.is_playing)
                // No.  Start playing the video.
                self.executeVideoCommand('play');
        } else {
            // No, we are "alone". Is the video playing?
            if (self.videoNode.is_playing) {
                // Yes.  Pause the video.
                self.executeVideoCommand('pause');
                // console.warn(`${errPrefix}The video has NOT been paused.`);
            }
        }

        // Update our video volume based on the distance the local
        //  participant is from the television.

        let newVolume = 0;

        // We use the camera position to determine the distance to the television
        //  since all volumes are relative to the local user.
        // Yes.  What is their distance from the television?
        let distanceFromTelevision = self.threeJsAvatar.position.distanceTo(g_ThreeJsCamera.position);

        // TODO: This will be a problem when we have scenes with multiple floors!
        //
        // Remove the half the height of the first object from the distance
        //  so that tall objects don't complicate the distance calculations.
        distanceFromTelevision -= (self.threeJsAvatar.position.y / 2);

        if (distanceFromTelevision > MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION)
            // Set our video volume to 0.  They are too far away.
            newVolume = 0;
        else {
            // Set our video volume based on the local user's distance from the television
            //  so that the further they are from us, the lower the volume.
            newVolume =
                (1 - (distanceFromTelevision / MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION));
        }

        self.videoNode.volume = newVolume;

        /*
        // Get the ParticipantWrapper object for the local participant.
        const localParticipantWrapperObj = g_ParticipantWrapperManager.getLocalUserParticipantWrapper();

        // Is this the local user?  We only want to set our volume if it is because
        //  all volumes are relative to the local user.
        if (localParticipantWrapperObj) {
            // Yes.  What is their distance from the television?
            let distanceFromTelevision = self.threeJsAvatar.position.distanceTo(localParticipantWrapperObj.threeJsAvatar.position);

            // TODO: This will be a problem when we have scenes with multiple floors!
            //
            // Remove the half the height of the first object from the distance
            //  so that tall objects don't complicate the distance calculations.
            distanceFromTelevision -= (self.threeJsAvatar.position.y / 2);

            if (distanceFromTelevision > MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION)
                // Set our video volume to 0.  They are too far away.
                newVolume = 0;
            else {
                // Set our video volume based on the local user's distance from the television
                //  so that the further they are from us, the lower the volume.
                newVolume =
                    (1 - (distanceFromTelevision / MAX_DISTANCE_FROM_TELEVISION_FOR_ACTIVATION));
            }
        } else {
            // No, remote user.  Set our video volume to 0.
            newVolume = 0;
        }

        self.videoNode.volume = newVolume;
         */
    }

    // Build the avatar for this object and place it in the
    //  the ThreeJS scene.
    self._createThreeJSAvatar();
    self.videoTexture.needsupdate = true;
}

/**
 * This object maintains the list of TelevisionDisplay objects created
 *  for each television has they join/leave the conference.
 *
 * @constructor
 */
function TelevisionDisplayManager() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<TelevisionDisplay>} - An object acting as an
     *  associative array of TelevisionDisplay objects where the
     *  television ID is the key and the TelevisionDisplay is the
     *  value. */
    this.aryTelevisionDisplayObjs = [];

    /**
     * Return our collection of television display objects stored
     *  as properties belonging to an object as a simple array,
     *  for convenient iteration.
     */
    this.toArray = function() {
        const methodName = self.constructor.name + '::' + `toArray`;
        const errPrefix = '(' + methodName + ') ';

        let retAryTelevisionDisplayObjs = [];

        for (let propKey in self.aryTelevisionDisplayObjs) {
            const televisionDisplayObj = self.aryTelevisionDisplayObjs[propKey];

            retAryTelevisionDisplayObjs.push(televisionDisplayObj);
        }

        return retAryTelevisionDisplayObjs;
    }

    /**
     * This function finds a TelevisionDisplay object by its television ID.
     *
     * @param {String} idOfTelevision - The ID to look for.
     *
     * @returns {TelevisionDisplay|null} - The TelevisionDisplay object that
     *  bears the given ID or NULL if none were found.
     */
    this.findTelevisionById = function(idOfTelevision) {
        const methodName = self.constructor.name + '::' + `findTelevisionById`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfTelevision))
            throw new Error(errPrefix + `The idOfTelevision parameter is empty.`);

        if (typeof self.aryTelevisionDisplayObjs[idOfTelevision] === 'undefined')
            return null;

        return self.aryTelevisionDisplayObjs[idOfTelevision];
    }

    /**
     * Returns TRUE if we have a TelevisionDisplay object for the given
     *  television ID in our collection, FALSE if not.
     *
     * @param {String} idOfTelevision - The ID to look for.
     *
     * @return {boolean}
     */
    this.isExistingTelevisionId = function(idOfTelevision) {
        const methodName = self.constructor.name + '::' + `isExistingTelevisionId   `;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfTelevision))
            throw new Error(errPrefix + `The idOfTelevision parameter is empty.`);

        return (self.findTelevisionById(idOfTelevision) !== null);
    }

    /**
     * Builds a new television object and adds it to the collection.
     *  It does NOT add it to the ThreeJS scene.
     *
     * @param {String} televisionId - The ID to assign to the television.
     * @param {String} videoUrl - The URL for the video to play on the television.
     * @param {THREE.Vector3} position - The position of the television
     *  in the scene.
     * @param {THREE.Vector3} rotation - The television will be rotated
     *  to face this direction given in this Euler angle.
     * @param {THREE.Vector3} dimensions - The width, height, and depth
     *  of the television in the scene, in ThreeJS world units.
     * @param {Boolean} bIsLooped - Whether or not the video shown on
     *  the television should loop.
     *
     * @returns {TelevisionDisplay} - The TelevisionDisplay object that
     *  was created with the given parameters.
     */
    this.addTelevision = function (televisionId, videoUrl, position, rotation, dimensions, bIsLooped=false, bIsAutoPlay=false) {
        let methodName = self.constructor.name + '::' + `addTelevision`;
        let errPrefix = '(' + methodName + ') ';

        // Do not allow televisions with the same ID.
        if (self.isExistingTelevisionId(televisionId))
            throw new Error(errPrefix + `A television with the ID: ${televisionId} already exists.`);

        // Let the TelevisionDisplay object validate the parameters.
        const newTelevisionDisplayObj = new TelevisionDisplay(televisionId, videoUrl, position, rotation, dimensions, bIsLooped, bIsAutoPlay);

        // Assign it.
        self.aryTelevisionDisplayObjs[newTelevisionDisplayObj.televisionId] = newTelevisionDisplayObj;

        return newTelevisionDisplayObj;
    }

    /**
     * This method removes the TelevisionDisplay object with the
     *  given ID from our collection of TelevisionDisplay object.
     *
     * @param {String} idOfTelevision - The ID for the television that
     *  should be removed.
     */
    this.removeTelevision = function(idOfTelevision) {
        let methodName = self.constructor.name + '::' + `removeTelevision`;
        let errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfTelevision))
            throw new Error(errPrefix + `The idOfTelevision parameter is empty.`);

        console.info(`${errPrefix}Removing television with ID: ${idOfTelevision}`);

        // If there is no television with the given ID, then that is an error.
        const televisionObj = self.findTelevisionById(idOfTelevision);

        if (!televisionObj)
            throw new Error(errPrefix + `There is no television with ID: ${idOfTelevision}.`);

        // Tell the television object to clean up after itself.
        televisionObj.cleanUp();

        // Remove the object from our collection.
        delete self.aryTelevisionDisplayObjs[idOfTelevision];
    }

    /**
     * This method updates the state of all the televisions based on the current
     *  scene context.
     *
     * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
     *  The current list of participant objects in the scene.
     */
    this.updateTelevisions = function (aryParticipantWrapperObjs) {
        const methodName = self.constructor.name + '::' + `updateTelevisions`;
        const errPrefix = '(' + methodName + ') ';

        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        // Call the update function of each television.
        // TODO: OPTIMIZE - away the repetitive toArray() calls.
        self.toArray().forEach(televisionObj => {
            televisionObj.updateTelevision(aryParticipantWrapperObjs);
        });
    }
}

// Return the current contents of the g_AryVideoNodes array as a simple array.
const getActiveTelevisionVideoNodes = () => {
    let retAryVideoNodes = [];

    for (let propKey in g_AryVideoNodesForTelevisions) {
        let propValue = g_AryVideoNodesForTelevisions[propKey];

        retAryVideoNodes.push(propValue);
    }

    return retAryVideoNodes;
}

/**
 * Create an instance of a TelevisionDisplayManager object.
 */
const g_TelevisionDisplayManager = new TelevisionDisplayManager();


export {TelevisionDisplay, TelevisionDisplayManager, getActiveTelevisionVideoNodes, g_TelevisionDisplayManager}