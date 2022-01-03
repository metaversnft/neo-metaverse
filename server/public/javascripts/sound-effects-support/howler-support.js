// Some routines to support our use of the Howler.js library.

import {g_AudioSprites} from './audio-sprites-support.js';
import * as THREE from '../threejs/build/three.module.js';
import {dumpPositionAndOrientation} from "../threejs/examples/pointerlock.js";
import {g_ThreeJsCamera} from "../objects/three-js-global-objects.js";
import {getCenterOfThreeJsObject, getSimpleWidthOfThreeJsObject} from "../threejs-support/threejs-support-code.js";

// Create a global howler object for AUDIOSPRITE based sound effects playing.
// const g_HowlAudioSpritesObj = new Howl(g_AudioSprites);

// The global Howler object controls the listener's position and orientation
//  amongst other things and must be an object of type HowlerGlobal, not Howl.

// DO NOT CREATE A NEW HOWLERGLOBAL OBJECT!  IT WILL HAVE A NULL
//  CONTEXT AND SPATIAL OPERATIONS WILL FAIL!  INSTEAD, USE THE GLOBAL
//  SINGLETON "HOWLER" OBJECT PROVIDED BY "howler.core.js"
// const g_HowlerGlobalObj = new HowlerGlobal();

const g_HowlerGlobalObj = Howler;

// Verbose messages or not.
const bVerbose = true;

//
/**
 * Convert Euler angle, like that of the rotation property belonging to the
 *  ThreeJS camera, to Howler orientation.  For now we are ignoring
 //  the X and Z axes in the Euler angle and just using the Y axis
 //  value (YAW) which in ThreeJS is in radians.  Howler uses radians for its
 //  cos and sin calculations so we take the sin and cos of the camera Y axis
 //  value and that is the only axis we use.

 * @param {THREE.Vector3} euler - The euler angle to convert to Howler orientation.
 *
 * @return {THREE.Vector3} - Return a new THREE.Vector3 object with the
 *  converted values that work for the Howler orientation
 */
function threeJsEulerToHowlerVector3_old(euler) {
    const errPrefix = `(threeJsEulerToHowlerVector3) `;

    if (!(euler instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the euler parameter is not a THREE.Vector3 object.`);

    // Convert a THREE.Euler object to a Howler.js vector3 object.
    return new THREE.Vector3(Math.cos(euler.y), 0, Math.sin(euler.y));
}

/**
 * Take a ThreeJS object and convert it to a Howler orientation vector.
 *
 * @param {Object} threeJsObj - A ThreeJS object in the scene.
 *
 * @return {THREE.Vector3} - Return a new THREE.Vector3 object with the
 *  converted values that work for the Howler orientation
 */
function threeJsRotationToHowlerVector3(threeJsObj) {
    const errPrefix = `(threeJsRotationToHowlerVector3) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj))
    	throw new Error(errPrefix + `The threeJsObj is not a valid object.`);

    if (typeof threeJsObj.getWorldDirection !== 'function')
    	throw new Error(errPrefix + `The threeJsObj does not have a getWorldDirection property or it is not a function.`);

    // Avoid "new" as much as possible to avoid memory leaks or overhead.
    //  Instead, recycle the same vector.
    let vecToReceiveWorldDir = new THREE.Vector3();

    // Convert a ThreeJS object's world direction to an angle around the Y-axis,
    //  as required by our use of Howler.js.
    g_ThreeJsCamera.getWorldDirection(vecToReceiveWorldDir);
    const theta = Math.atan2(vecToReceiveWorldDir.x, vecToReceiveWorldDir.z);

    if (false) {
        console.info(`${errPrefix}Theta angle for listener is: ${theta}`);
    }

    return new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
}

/**
 * Given a position and orientation, set the listener position and orientation
 *  to those values.
 *
 * @param {THREE.Vector3} listenerPosition - The position of the listener.
 * @param {THREE.Vector3} listenerObj - The listener object, usually the ThreeJS camera.
 */
function setListenerPositionAndOrientation(listenerPosition, listenerObj) {
    const errPrefix = `(setListenerPositionAndOrientation) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(listenerObj))
    	throw new Error(errPrefix + `The listenerObj is not a valid object.`);

    if (!(listenerPosition instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the listenerPosition parameter is not a THREE.Vector3 object.`);

    // g_HowlerGlobalObj.pos(listenerPosition.x, listenerPosition.y, listenerPosition.z);

    // The Howler 3D sample always sets the Z value to -0.5.
    g_HowlerGlobalObj.pos(listenerPosition.x, listenerPosition.y, listenerPosition.z);

    const howlerOrientation = threeJsRotationToHowlerVector3(listenerObj);

    // The orientation is a vector that points in the direction the listener is facing.
    //  The last 3 parameters are the up direction, which is the direction that the
    //  the listener's "head" is pointing.  "0, 1, 0" means the listener's head is
    //  pointing straight up.
    // g_HowlerGlobalObj.orientation(howlerOrientation.x, howlerOrientation.y, howlerOrientation.z, 0, 1, 0);

    // TODO: Why is it we need to flip the angle to make things sound right?
    g_HowlerGlobalObj.orientation(howlerOrientation.z, howlerOrientation.y, howlerOrientation.x, 0, 1, 0);

    // dumpPositionAndOrientation('listener', listenerPosition, howlerOrientation);
}

/**
 * This object handles the details of playing a URL based
 *  sound effect using the Howler.js library.
 *
 * @param {String} srcUrl - The URL to the sound that should
 * 	be played/managed by this object.
 * @param {Object} threeJsObj - The ThreeJS object wa are
 *  tied to.  For now, all sounds are tied to an object in the
 *  ThreeJS scene.
 * @param {String} idOfThreeJsParentObj - The ID of the PARENT object the
 *  ThreeJS object is owned by.
 * @param {Boolean} bIsLooped - Whether or not the sound effect
 *    should be looped.
 * @param {Boolean} bIsStoppedWhenDeactivated - If TRUE, the sound
 *  is stopped when the object associated with the sound
 *  (e.g. - a picture display) notifies us to deactivate.
 *
 * @constructor
 */
function SoundPlayedByHowler(srcUrl, threeJsObj, idOfThreeJsParentObj, bIsLooped=false, bIsStoppedWhenDeactivated=true) {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    if (misc_shared_lib.isEmptySafeString(srcUrl))
        throw new Error(errPrefix + `The srcUrl parameter is empty.`);

    if (!misc_shared_lib.isNonNullObjectAndNotArray(threeJsObj))
        throw new Error(errPrefix + `The threeJsObj parameter is not assigned.`);

    // We need getWorldDirection() method to translate the
    //  orientation of the ThreeJS object, which is in
    //  Euler angles, to an angle value that can be used
    //  by Howler.js.
    if (typeof threeJsObj.getWorldDirection !== 'function')
        throw new Error(errPrefix + `The threeJsObj parameter does not have a getWorldDirection() method.`);

    if (misc_shared_lib.isEmptySafeString(idOfThreeJsParentObj))
        throw new Error(errPrefix + `The idOfThreeJsParentObj parameter is empty.`);

    if (typeof bIsLooped !== 'boolean')
        throw new Error(errPrefix + `The bIsLooped parameter is not a boolean.`);
    if (typeof bIsStoppedWhenDeactivated !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsStoppedWhenDeactivated parameter is not boolean.`);

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Boolean} - If TRUE, then the sound will loop
     *  continuously when it plays, if FALSE, then it will be
     *  played one time and then stop. */
    this.bIsLooped = bIsLooped;

    /** @property {Boolean} - If TRUE, when our notifyDeactivate()
     *  function is called we will stop playing the sound.  If FALSE,
     *  we will let it continue playing. */
    this.bIsStoppedWhenDeactivated = bIsStoppedWhenDeactivated;

    /** @property {Boolean} - State machine steps can check this flag to see
     * 		if one of the audio sprites are currently playing.
     *
     * 	@private	*/
    this.isSoundPlaying = false;

    /** @property {Object}  If we are attached to a
     *  ThreeJS object, then the value in this parameter should be
     *  the object.  If not, it should be NULL. */
    this._threeJsObj = threeJsObj;

    /** @property {Howl} - The Howl object that will contain the audio
     * 	needed for this tutorial.
     *
     * 	@private	*/
    this._howlObj3D = null;

    /** @property {Number|null} - The ID returned to us from the last play() call.
     *   If NULL, then the sound has stopped playing.
     *
     * 	@private	*/
    this._idFromLastPlay = null;

    /** @property {THREE.Vector3} - The current position of the sound.
    *
    * 	@private	*/
    this._position3D = new THREE.Vector3();

    /** @property {THREE.Vector3} - The current orientation of the sound
     *  in ThreeJS Euler angle format, XYZ rotation order.
     *
     * 	@private	*/
    this._orientation3D = new THREE.Vector3();

    /** @property {String} - The URL to the sound that should
     * 	be played/managed by this object.
    *
    * 	@private	*/
    this._srcUrl = srcUrl;

    /** @property {String} - The ID of the ThreeJS object that
     *  that is the parent of the ThreeJS object we are tied to.
     *
     * 	@private	*/
    this._idOfThreeJsParentObj = idOfThreeJsParentObj;

    /** @property {Number} - The current volume set for the sound,
     *   when it is playing */
    // TODO: Change the initial value to 0.0 when everything is working.
    this._volume3D = 0;

    // Set the Howl object's looping property to match outs.
    // this.howlObj.loop = this.bIsLooped;

    /**
     * This is the event handler that will be called when the main audio sprite
     * 	for a step finishes playing.
     */
    this.onSoundPlayFinished = function() {
        const methodName = self.constructor.name + '::' + `onSoundPlayFinished`;
        const errPrefix = '(' + methodName + ') ';

        // TODO: Remove this.
        console.info(errPrefix + `Howl sound finished playing: ${self._srcUrl}.`);

        // Clear the is-playing flag.
        self.isSoundPlaying = false;

        // Clear the sound ID field.
        self._idFromLastPlay = null;
    };

    /**
     * This is the event handler that will be called when the sound plays.
     */
    this.onSoundPlaying = function() {
        const methodName = self.constructor.name + '::' + `onSoundPlaying`;
        const errPrefix = '(' + methodName + ') ';

        // Set the is-playing flag.
        self.isSoundPlaying = true;

        // IMPORTANT!!: The Howler library has some quirks that if not
        //  paid attention to, will really make things difficult.  One
        //  of the biggest is that you don't get a sound ID until
        //  the "play()" method is called, so you can't set any
        //  sound properties like, position, orientation volume, etc. until
        //  the sound starts playing.  Therefore, you have to do that
        //  setup work HERE in this event handler, which fires when the
        //  audio actually starts playing.

        // Do the sound setup now.
        console.info(`${errPrefix}Initializing sound properties now that sound playback has begun for sound: ${self._srcUrl}.`);

        // Set the position from the ThreeJS object we are tied to.
        self._setPosition3D();
        // Do the same for the orientation.
        self._setOrientationFromThreeJsObj();

        // From the Howler.js 3D example:
        //
        //   Tweak the attributes to get the desired effect.
        /*
        self._howlObj3D.pannerAttr({
            panningModel: 'HRTF',
            refDistance: 0.8,
            rolloffFactor: 2.5,
            distanceModel: 'exponential'
        }, self._idFromLastPlay);

         */
        self._howlObj3D.pannerAttr({
            panningModel: 'HRTF',
            refDistance: 0.8,
            rolloffFactor: 1.0, //  2.5, ROS: 2.5 is too high in our virtual world.  Sound cuts out immediately when panner is turned on, even for objects close to the listener.
            distanceModel: 'exponential'
        }, self._idFromLastPlay);
    }

    /**
     * This is the event handler that will be called when the sound is paused.
     */
    this.onSoundPaused = function() {
        const methodName = self.constructor.name + '::' + `onSoundPaused`;
        const errPrefix = '(' + methodName + ') ';

        if (bVerbose)
            console.info(errPrefix + `Howl sound paused: ${self._srcUrl}.`);

        // Set the is-playing flag.
        self.isSoundPlaying = false;
    }

    /**
     * Start playing the sound we are managing.
     */
    this.playSound3D = function(idOfThreeJsObj=srcUrl) {
        const methodName = self.constructor.name + '::' + `playSound3D`;
        const errPrefix = '(' + methodName + ') ';

        if (idOfThreeJsObj) {
            if (misc_shared_lib.isEmptySafeString(idOfThreeJsObj))
                throw new Error(errPrefix + `The idOfThreeJsObj parameter is not null, yet it is empty.`);
        }

        if (bVerbose)
            console.info(errPrefix + `Howl sound playback begins: ${self._srcUrl}.`);

        // Save the ID returned from the play() call for later use.
        self._idFromLastPlay = self._howlObj3D.play();

        // self.setVolume3D(self._volume3D);

        // Diagnostics.
        dumpPositionAndOrientation(idOfThreeJsObj, self._position3D, self._orientation3D);
    }

    /**
     * Stop playing the sound we are managing.
     */
    this.stopSound3D = function() {
        const methodName = self.constructor.name + '::' + `stopSound3D`;
        const errPrefix = '(' + methodName + ') ';

        if (bVerbose)
            console.info(errPrefix + `Stopping Howl sound: ${self._srcUrl}.`);


        // Save the ID returned from the play() call for later use.
        self._howlObj3D.stop();
    }

    /**
     * Set the volume of the sound we are managing.
     */
    this.setVolume3D = function(newVolume3D) {
        const methodName = self.constructor.name + '::' + `setVolume3D`;
        const errPrefix = '(' + methodName + ') ';

        if (newVolume3D < 0.0 || newVolume3D > 1.0) {
            console.error(errPrefix + `Invalid volume value, must be between 0 and 1: ${newVolume3D}`);
            return;
        }

        if (bVerbose)
            console.info(errPrefix + `Setting Howl sound volume: ${self._srcUrl}.`);

        // Always update our image of the volume.
        self._volume3D = newVolume3D;

        // Do not pass on calls to the Howl object if we are not
        //  actively playing since we are not sure about the persistence
        //  of the IDs returned by play() call between sound
        //  play events.
        if (self._idFromLastPlay)
            // Set the volume.
            self._howlObj3D.volume(self._volume3D, self._idFromLastPlay);
    }

    /**
     * This function is called by the object that this sound is
     *  associated with it is activated.
     *
     *  @param {Object|null} [notifierObj] - The object that is notifying
     *   us. This is optional.
     */
    this.notifyActivated = function(notifierObj) {
        const methodName = self.constructor.name + '::' + `notifyActivated`;
        const errPrefix = '(' + methodName + ') ';

        if (bVerbose)
            console.info(errPrefix + `notifyActivated called for sound: ${self._srcUrl}.`);

        // Start playing the sound.  Save the ID given to us by
        //  the play() command so we can reference the underlying
        //  sound object later.
        self.playSound3D()
    }

    /**
     * This function is called by the object that this sound is
     *  associated with it is deactivated.
     *
     *  @param {Object|null} [notifierObj] - The object that is notifying
     *   us. This is optional.
     */
    this.notifyDeactivated = function(notifierObj) {
        const methodName = self.constructor.name + '::' + `notifyDeactivated`;
        const errPrefix = '(' + methodName + ') ';

        if (bVerbose)
            console.info(errPrefix + `notifyDeactivated called for sound: ${self._srcUrl}.`);

        // If the bIsStoppedWhenDeactivated flag is set, stop the sound.
        if (self.bIsStoppedWhenDeactivated)
            self._howlObj3D.stop();
    }

    /**
     * Update the position of the sound object.
     *
     * @param {THREE.Vector3} position3D - The new position of the sound.
     *
     * @private
     */
    this._setPosition3D = function() {
        const methodName = self.constructor.name + '::' + `setPosition3D`;
        const errPrefix = '(' + methodName + ') ';

        // Update our image of the position and the Howl object we manage.
        self._position3D = self._threeJsObj.position;

        // Set the coordinates so that the sound is positioned at the
        //  center of the object.  Get the center of the ThreeJS object
        //  we are tied to.
        const center = getCenterOfThreeJsObject(self._threeJsObj);

        // TODO: Find out what the root cause of the spatial anomalies
        //  and then update the code below.
        //
        // The above calculation using the center of the ThreeJS object
        //  didn't work.  The listener/sound-source relationship
        //  acts as if the ThreeJS object off by half it's width.
        //  Use that value to offset the sound position.
        // const halfWidth = getSimpleWidthOfThreeJsObject(self._threeJsObj) / 2.0;
        // const adjustX = center.x + halfWidth;

        self._howlObj3D.pos(center.x, center.y, center.z, self._idFromLastPlay);
        // self._howlObj3D.pos(adjustX, center.y, center.z, self._idFromLastPlay);
    }

    /**
     * Update the orientation of the sound object using the current
     *  world direction of the ThreeJS object we are tied to.
     *
     * @private
     */
    this._setOrientationFromThreeJsObj = function() {
        const methodName = self.constructor.name + '::' + `_setOrientationFromThreeJsObj`;
        const errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(self._threeJsObj))
        	throw new Error(errPrefix + `The threeJsObj is not a valid object.`);

        // Convert the object's ThreeJS Euler angle to a Howler compatible
        //  angle, based on only the Y-axis (YAW).
        const howlerOrientation = threeJsRotationToHowlerVector3(self._threeJsObj);

        // Update our image of the orientation and the Howl object we manage.
        self._orientation3D = howlerOrientation;
        self._howlObj3D.orientation(self._orientation3D.x, self._orientation3D.y, self._orientation3D.z, self._idFromLastPlay);
    }

    /**
     * Get the ACTUAL position of the Howl sound we are managing.
     *
     * @return {*}
     */
    this.getPosition3D = function() {
        const thePosition = self._howlObj3D.getPositionBySoundId(self._idFromLastPlay);

        if (thePosition)
            return new THREE.Vector3(thePosition[0], thePosition[1], thePosition[2]);
        else
            // Our position has not been set yet.
            return new THREE.Vector3(0, 0, 0);
    }

    /**
     * Get the ACTUAL orientation of the Howl sound we are managing.
     *
     * @return {*}
     */
    this.getOrientation3D = function() {
        const theOrientation = self._howlObj3D.getOrientationBySoundId(self._idFromLastPlay);

        if (theOrientation)
            return new THREE.Vector3(theOrientation[0], theOrientation[1], theOrientation[2]);
        else
            // Our orientation has not been set yet.
            return new THREE.Vector3(0, 0, 0);
    }

    // ----------------- CONSTRUCTOR ------------

    this._howlObj3D =
        new Howl({src: srcUrl, loop: this.bIsLooped});

    // Event handlers for Howl events.
    this._howlObj3D.on('end', this.onSoundPlayFinished);
    this._howlObj3D.on('pause', this.onSoundPaused);
    this._howlObj3D.on('play', this.onSoundPlaying);

    /*
    setInterval(() => {
        console.warn(`${errPrefix}is-playing status for sound: ${self._srcUrl} is: ${self._howlObj3D.playing()}`);
    }, 1000)
     */
}


/**
 * This object manages a collection of SoundPlayedByHowler objects.
 *
 * @constructor
 */
function SoundPlayedByHowlerManager() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<SoundPlayedByHowler>} - An object acting as an
     *  associative array of SoundPlayedByHowler objects where the
     *  Sound ID is the key and the SoundPlayedByHowler is the
     *  value. */
    this.arySoundPlayedByHowlerObjs = [];

    /** @property {Array<SoundPlayedByHowler>} - An object acting as an
     *  associative array of SoundPlayedByHowler objects where the
     *  Sound ID is the key and the SoundPlayedByHowler is the
     *  value. */
    this.arySoundPlayedByHowlerObjs = [];

    /**
     * Return our collection of Sound display objects stored
     *  as properties belonging to an object as a simple array,
     *  for convenient iteration.
     */
    this.toArray = function () {
        const methodName = self.constructor.name + '::' + `toArray`;
        const errPrefix = '(' + methodName + ') ';

        let retArySoundPlayedByHowlerObjs = [];

        for (let propKey in self.arySoundPlayedByHowlerObjs) {
            const SoundPlayedByHowlerObj = self.arySoundPlayedByHowlerObjs[propKey];

            retArySoundPlayedByHowlerObjs.push(SoundPlayedByHowlerObj);
        }

        return retArySoundPlayedByHowlerObjs;
    }

    /**
     * This function finds a SoundPlayedByHowler object by its Sound ID.
     *
     * @param {String} idOfSound - The ID to look for.
     *
     * @returns {SoundPlayedByHowler|null} - The SoundPlayedByHowler object that
     *  bears the given ID or NULL if none were found.
     */
    this.findSoundById = function (idOfSound) {
        const methodName = self.constructor.name + '::' + `findSoundById`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfSound))
            throw new Error(errPrefix + `The idOfSound parameter is empty.`);

        if (typeof self.arySoundPlayedByHowlerObjs[idOfSound] === 'undefined')
            return null;

        return self.arySoundPlayedByHowlerObjs[idOfSound];
    }

    /**
     * Find ALL the sounds attached to a particular ThreeJS object.
     *
     * TODO: WARNING, this function does a linear search of the
     *  array of SoundPlayedByHowler objects.  It should be
     *  optimized later.  Use it sparingly!
     *
     * @param {String} idOfThreeJsParentObj - The ID of the PARENT object the
     *  ThreeJS object is owned by.
     *
     * @returns {Array<SoundPlayedByHowler>} - An array of SoundPlayedByHowler
     *  that are tied to the ThreeJS object whose ID was given.
     */
    this.findSoundsBelongingToThreeJsObjId = function(idOfThreeJsParentObj) {
        const methodName = self.constructor.name + '::' + `findSoundsBelongingToThreeJsObjId`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfThreeJsParentObj))
            throw new Error(errPrefix + `The idOfThreeJsParentObj parameter is empty.`);

        let retAry = [];

        // Iterate the SoundPlayedByHowler objects in our collection.
        for (let sndPlayByHowlId in self.arySoundPlayedByHowlerObjs) {
            const sndPlayByHowlObj = self.arySoundPlayedByHowlerObjs[sndPlayByHowlId];

            if (sndPlayByHowlObj._idOfThreeJsParentObj === idOfThreeJsParentObj) {
                retAry.push(sndPlayByHowlObj);
            }
        }

        return retAry;
    }

    /**
     * Returns TRUE if we have a SoundPlayedByHowler object for the given
     *  Sound ID in our collection, FALSE if not.
     *
     * @param {String} idOfSound - The ID to look for.
     *
     * @return {boolean}
     */
    this.isExistingSoundId = function (idOfSound) {
        const methodName = self.constructor.name + '::' + `isExistingSoundId   `;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfSound))
            throw new Error(errPrefix + `The idOfSound parameter is empty.`);

        return (self.findSoundById(idOfSound) !== null);
    }

    /**
     * Add a new Sound to the sound collection..
     *
     * @param {String} srcUrl - The URL to the sound that should
     * 	be played/managed by this new object.
     * @param {Object|null} threeJsObj - If we are attached to a
     *  ThreeJS object, then the value in this parameter should be
     *  the object.  If not, it should be NULL.
     * @param {String|null} idOfThreeJsParentObj - If we are attached to
     *  a ThreeJS object, then this is the ID of the PARENT object the
     *  ThreeJS object is owned by.  If not, it should be NULL.
     * @param {Boolean} bIsLooped - Whether or not the sound effect
     *    should be looped.
     * @param {Boolean} bIsStoppedWhenDeactivated - If TRUE, the sound
     *  is stopped when the object associated with the sound
     *  (e.g. - a picture display) notifies us to deactivate.
     *
     * @return {SoundPlayedByHowler} - The new SoundPlayedByHowler object
     *  created using the given parameters.
     */
    this.addHowlerSound = function (srcUrl, threeJsObj=null, idOfThreeJsParentObj=null, bIsLooped=false, bIsStoppedWhenDeactivated=true) {
        let methodName = self.constructor.name + '::' + `addHowlerSound`;
        let errPrefix = '(' + methodName + ') ';

        // Do not allow Sounds with the same ID.
        if (self.isExistingSoundId(srcUrl))
            throw new Error(errPrefix + `A Sound with the ID(URL): ${srcUrl} already exists.`);

        // Let the SoundPlayedByHowler object validate the parameters.
        const newSoundPlayedByHowlerObj = new SoundPlayedByHowler(srcUrl, threeJsObj, idOfThreeJsParentObj, bIsLooped, bIsStoppedWhenDeactivated);

        // Assign it.
        self.arySoundPlayedByHowlerObjs[srcUrl] = newSoundPlayedByHowlerObj;

        return newSoundPlayedByHowlerObj;
    }

    /**
     * Get the ACTUAL position of the global Howler object since that is the
     *  Howler listener position.
     *
     * @return {*}
     */
    this.getHowlListenerPosition3D = function() {
        const thePosition = Howler.pos();

        if (thePosition)
            return new THREE.Vector3(thePosition[0], thePosition[1], thePosition[2]);
        else
            // The listener position has not been set yet.
            return new THREE.Vector3(0, 0, 0);
    }

    /**
     * Get the ACTUAL orientation of the global Howler object since that is the
     *  Howler listener orientation.
     *
     * @return {*}
     */
    this.getHowlListenerOrientation3D = function() {
        const theOrientation = Howler.orientation();

        if (theOrientation)
            return new THREE.Vector3(theOrientation[0], theOrientation[1], theOrientation[2]);
        else
            // Our orientation has not been set yet.
            return new THREE.Vector3(0, 0, 0);
    }
}

/**
 * Global event handler for when global AUDIOSPRITE sounds finish playing.
 */
function globalOnSoundPlayFinished() {
    const errPrefix = `(globalOnSoundPlayFinished) `;

    console.info(errPrefix + `Global sound finished event fired.`);
}

/**
 * Play a sound effect that resides in an audiosprites fle.
 *
 * @param {String} audioSpriteName - The audio sprite name
 *  that should be played.
 *
function playAudioSprite(audioSpriteName) {
    const errPrefix = `(playAudioSprite) `;

    if (misc_shared_lib.isEmptySafeString(audioSpriteName))
        throw new Error(errPrefix + `The soundEffectName parameter is empty.`);

    // Start the sound.
    g_HowlAudioSpritesObj.play(audioSpriteName);
}
*/

/**
 * Stop all sound effects.
 *
 *
function stopAllSoundEffects() {
    const errPrefix = `(stopAllSoundEffects) `;

    // Start the sound.
    g_HowlAudioSpritesObj.stop();
}
*/

/*
// Assign our global on-finished event for when sounds stop.
g_HowlAudioSpritesObj.on('end', globalOnSoundPlayFinished);
*/

/**
 * Create an instance of a SoundPlayedByHowlerManager object.
 */
const g_SoundPlayedByHowlerManager = new SoundPlayedByHowlerManager();

export {
    g_HowlerGlobalObj,
    // g_HowlAudioSpritesObj,
    g_SoundPlayedByHowlerManager,
    threeJsRotationToHowlerVector3,
    globalOnSoundPlayFinished,
    // playAudioSprite,
    setListenerPositionAndOrientation,
    SoundPlayedByHowler,
    SoundPlayedByHowlerManager
    // stopAllSoundEffects};
};
