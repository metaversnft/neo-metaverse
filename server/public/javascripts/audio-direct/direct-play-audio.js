// This module uses the browser's HTML5 Audio API to play audio, instead of
//  using Howler.  This is useful for sounds you don't need to position
//  in the ThreeJS scene and want them to be loud and omnipresent.

const bVerbose = true;

// The audio context.
let g_AudioContext = null;

/**
 * This object wraps a sound you want played directly through
 *  HTML5 Audio API.
 *
 * @param {String} urlToSound - The URL to the sound file.
 * @param {String} [idOfSound] - An optional ID for the sound. If not
 *  provided, a random unique ID will be generated.
 * @param {Number} theVolume - The volume of the sound, from 0 to 1.
 * @param {Boolean} bIsLooped - Whether the sound should loop or not.
 * @param {Boolean} bIStoppedWhenDeactivated - Whether the sound should
 *  stop when we our deacvtivate notification function is called.
 *
 * @constructor
 */
function DirectPlayAudio(urlToSound, idOfSound=null, theVolume=1.0, bIsLooped=false, bIStoppedWhenDeactivated=true) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    if (misc_shared_lib.isEmptySafeString(urlToSound))
        throw new Error(errPrefix + `The urlToSound parameter is empty.`);

    if (idOfSound !== null) {
        if (misc_shared_lib.isEmptySafeString(idOfSound))
            throw new Error(errPrefix + `The idOfSound parameter is not NULL, so it can not be an empty string.`);
    }

    if (typeof theVolume !== 'number')
    	throw new Error(errPrefix + `The value in the theVolume parameter is not a number.`);

    if (theVolume < 0.0 || theVolume > 1.0)
    	throw new Error(errPrefix + `The value in the theVolume parameter is not between 0.0 and 1.0.`);

    if (typeof bIsLooped !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsLooped parameter is not boolean.`);

    if (typeof bIStoppedWhenDeactivated !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIStoppedWhenDeactivated parameter is not boolean.`);


    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {String} - The ID for this sound.  If no ID was given
     *   in the constructor, a random, unique ID will be assigned. */
    this.idOfSound = idOfSound === null ? misc_shared_lib.getSimplifiedUuid() : idOfSound;

    /** @property {String} -  The URL to the sound. */
    this.urlToSound = urlToSound;

    /** @property {Number} - The volume to play the sound at. Must be between 0 and 1. */
    this.theVolume = theVolume;

    /** @property {Boolean} - If TRUE, then the sound will loop, if FALSE, the not.  */
    this.isLooped = bIsLooped;

    /** @property {Boolean} - If TRUE, then the sound will be stopped when
     *  our deacvtivate notification function is called.  If FALSE, then the
     *  sound will keep playing. */
    this.isStoppedWhenDeactivated = bIStoppedWhenDeactivated;

    /** @property {Audio} - The HTML5 audio object we wrap. */
    this.audioPlayer = null;

    /** @property {Object} - A gain node to control the volume. */
    // this.gainNode = null;

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
            console.info(errPrefix + `notifyActivated called for sound: ${self.urlToSound}.`);

        // Start playing from the start of the sound,
        //  in case this is a new activation.
        self.audioPlayer.currentTime = 0;
        self.audioPlayer.volume = self.theVolume;
        self.audioPlayer.play();
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
            console.info(errPrefix + `notifyDeactivated called for sound: ${self.urlToSound}.`);

        // If the bIsStoppedWhenDeactivated flag is TRUE, pause the sound.
        if (self.isStoppedWhenDeactivated)
            self.audioPlayer.pause();
    }

    // ---------------------- CONSTRUCTOR CODE -----------------

    // Yes, direct play is desired.  Use the browser
    //  native Audio() object to play the sound.
    this.audioPlayer = new Audio(urlToSound);

    // Create a gain node to manage the volume.
    // this.gainNode = context.createGain();

    // Never auto-play.
    this.audioPlayer.autoplay = false;

    // Currently the volume property does not appear to work.
    //  TODO: Switch to gain node volume management.
    this.audioPlayer.volume = theVolume;
    this.audioPlayer.loop = self.isLooped;
}

/*
function initDirectAudio() {
    const errPrefix = `(initDirectAudio) `;

    // Initialize the audio context.
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    g_AudioContext = new AudioContext()
}
*/

export {DirectPlayAudio}