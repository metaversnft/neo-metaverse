// Page support for the Neoland page.

// IMPORTANT!: The initialization and set up of the ThreeJS scene is POINTERLOCK.JS!

import {mainVoxeetSDK} from '../dolby-io/client.js';
import {animateLoop} from '../threejs/examples/animate-loop.js';
import {g_AudioSprites} from "../sound-effects-support/audio-sprites-support.js";
import {isLocalUserInConference} from "../dolby-io/dolby-io-support.js";
import {
    g_AudioInputDevicesList,
    g_AudioOutputDevicesList,
    g_VideoInputDevicesList,
    enumerateAllDevices_promise,
    getSelectedAudioInputDevice,
    getSelectedAudioOutputDevice,
    getSelectedVideoInputDevice,
    callMeWhenPageIsReady
} from "../dolby-io/ui.js";
import {restorePage, savePage} from '../misc/persistence.js';
import {initializeThreeJS} from "../threejs/examples/pointerlock.js";
import {isStringAUrl} from "../objects/picture-display.js";

// The ID of the Three.js canvas DIV.
const CANVAS_DIV_ID = 'canvas-div';

// The ID of the row in the outer table that contains the control panel.
const CONTROL_PANEL_ROW_ID = 'control-panel-row';

// The ID of the row in the outer table that contains the ThreeJS canvas.
const THREEJS_CANVAS_ROW_ID = 'threejs-canvas-div';

// The ID of the row in the outer table that contains the ThreeJS stats.
const INSTRUCTIONS_ROW_ID = 'instructions-div';

// The ID of the DIV that we will put the instructions in.
const INSTRUCTIONS_DIV_ID = 'instructions-div';

// The ImprovScene object for the scene.
let g_ImprovSceneObj = null;

// The active host names.
let g_ActiveHostNamesList = null;

// Spinner instance, instantiated in on-ready handler.
let g_Spinner = null;

// Element ID for the DIV that holds the spinner animation.
const ELEMENT_ID_DIV_SPINNER = 'spinner-div'

// Element ID for the retrieval time DIV.
const ELEMENT_ID_DIV_RETRIEVAL_TIME = 'retrieval-time-div';

// The class name we use for any DOM elements we want to
//  persist to the cookie store.
const CLASS_NAME_PERSISTENT_FIELD = 'persistent-field';

// Web sockets support.
// Create a WebSocketClient instance for our use.
const g_WebSocketClient = new WebSocketClient(processReceivedWebSocketMessage);

// Create a global howler object for sound effects playing.
// Moved to howler-support.
// let g_HowlerGlobalObj = new Howl(g_AudioSprites);

// This variable is set to TRUE when the scene is completely ready.
let g_IsSceneReady = false;

// This variable controls the idle gaze control feature.  If TRUE
//  then that feature is enabled, otherwise it is not.
let g_IsIdleGazeControlEnabled = true;

let errPrefix = '(neoland-page-support.js) ';

// ------------ BEGIN: From ThreeJS tutorial -----------------

// MAIN


// Global event handler for when global sounds finish playing.
function globalOnSoundPlayFinished_event() {
    let errPrefix = `(globalOnSoundPlayFinished_event) `;

    console.log(`${errPrefix}Sound finished playing.`);
}

/**
 * Play a sound effect.
 *
 * @param {String} audioSpriteName - The audio sprite name
 *  that should be played.
 */
function playSoundEffect(audioSpriteName) {
    let errPrefix = `(soundEffectName) `;

    if (misc_shared_lib.isEmptySafeString(audioSpriteName))
        throw new Error(errPrefix + `The soundEffectName parameter is empty.`);

    // Start the sound.
    g_HowlerObj.play(audioSpriteName);
}

/**
 * Stop all sound effects.
 *
 */
function stopSoundEffects() {
    let errPrefix = `(stopSoundEffects) `;

    // Start the sound.
    g_HowlerObj.stop();
}

/**
 * This is the function that will be called whenever we receive
 *  a WebSockets message from our server.
 *
 * @param {Object} eventdataObj - The message object received.
 */
function processReceivedWebSocketMessage(eventdataObj) {
    let errPrefix = `(processReceivedWebSocketMessage) `;

    try {

        if (typeof eventdataObj == 'object' && eventdataObj.type) {

            if (eventdataObj.type == 'welcome') {
                console.info(errPrefix, `Welcome message received: ${eventdataObj.message}.`);
                return;
            }
            else if (eventdataObj.type == 'remote_command') {
                // -------------------- BEGIN: Process remote commands. ------------

                if (eventdataObj.command == 'play_skit')
                {
                    let commandText = eventdataObj.name.trim();

                    if (misc_shared_lib.isEmptySafeString(commandText))
                        throw new Error(errPrefix + `Received remote request to play a skit, but the "name" field is empty.`);

                    console.info(errPrefix, `(remote command request) Playing skit: ${commandText}.`);

                    // STUB - Put call to take action on the received message here.
                } else {
                    throw new Error(errPrefix + `Unknown remote command: ${eventdataObj.command}`);
                }

                // -------------------- END  : Process remote commands. ------------
            }
            else {
                throw new Error(errPrefix + `Unknown object type: ${eventdataObj.type}`);
                return;
            }
        } else {
            throw new Error(errPrefix + `Received an invalid event data object. Either it is not an object or it is missing the "type" field.`);
        }
    }
    catch(err) {
        // Just ignore the request, but do print an error message to the console.
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(errMsg);
    };
}

let g_FlashBuyButtonInterval = null;
const FLASH_BUY_BUTTON_DURATION_MS = 3000;
const FLASH_BUY_BUTTON_INTERVAL_MS = 250;
const jqOriginalBuyButtonSelector = $('#original-buy-button-div');
const jqAlternateBuyButtonSelector = $('#alternate-buy-button-div');


/**
 * Flashes the BUY button when the user makes an NFT purchase.
 */
function flashBuyButton() {
    const errPrefix = `(flashBuyButton) `;

    function showOriginalBuyButton() {
        jqOriginalBuyButtonSelector.show();
        jqAlternateBuyButtonSelector.hide();
    }

    function showAlternateBuyButton() {
        jqOriginalBuyButtonSelector.hide();
        jqAlternateBuyButtonSelector.show();
    }

    let elapsedMs = 0;
    let bToggle = false;

    g_FlashBuyButtonInterval = setInterval(() => {

        if (bToggle) {
            // Show the BUY button with the alternate color scheme.
            showAlternateBuyButton();
        } else {
            // Show the original BUY button.
            showOriginalBuyButton();
        }

        bToggle = !bToggle;
        elapsedMs += FLASH_BUY_BUTTON_INTERVAL_MS;

        // Have we flashed long enough?
        if (elapsedMs > FLASH_BUY_BUTTON_DURATION_MS) {
            // Yes.  Stop flashing and restore the original BUY button.
            clearInterval(g_FlashBuyButtonInterval);
            g_FlashBuyButtonInterval = null;
            showOriginalBuyButton();
        }
    }, FLASH_BUY_BUTTON_INTERVAL_MS);

}

/**
 * Start the ThreeJS scene.
 */
function startWorld() {
    // TODO: Remove this.
    // isStringAUrl('https://neo3d-live.s3.amazonaws.com/booths-1/public/booths/neo-news-today/images/da-hongfei-neo-interview-w-chico-crypto-neotalk-devcon.png');

    // WARNING:  Attempting to initialize the ThreeJS scene here instead of
    //  in pointerlock.js leads to pictures not being displayed, despite
    //  being loaded!
    // Initialize the g_ThreeJsScene.
    // initializeThreeJS();

    console.info(`${errPrefix} Starting the ThreeJS animation loop.`);

    animateLoop();

    // Tell the UI module the world is now ready to be entered.
    callMeWhenPageIsReady();
}

// -------------------- DOCUMENT READY HANDLER ---------------------
$(document).ready(async function () {
    let errPrefix = '(neoland-lab-page-support.js::document_ready) ';

    try {
        // First attempt to enumerate devices. Note, we may not get
        //  good results in this call context if we have not received
        //  permission for the audio and video devices we want.  On
        //  most browsers, the enumerate calls will not receive any
        //  devices until the user has granted permission.
        await enumerateAllDevices_promise()
        .catch(err => {
            // Convert the error to a promise rejection.
            const errMsg =
                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

            console.error(errMsg + ' - promise');
        });

        // Restore any persistent fields.
        restorePage();

        // Onchange event handler for the audio input device selection list.
        g_AudioInputDevicesList.addEventListener('change', function(evt) {
            // Are we in a conference?  We can't update the DolbyIO SDK if we
            //  are not.
            if (isLocalUserInConference()) {
                // Update the DolbyIO SDK with the new device selection.
                const audioInputDeviceId = getSelectedAudioInputDevice();
                VoxeetSDK.mediaDevice.selectAudioInput(audioInputDeviceId);
            }

            // Save the user's choice to their cookie store either way.
            savePage();
        })

        // Onchange event handler for the audio output device selection list.
        g_AudioOutputDevicesList.addEventListener('change', function(evt) {
            // Are we in a conference?  We can't update the DolbyIO SDK if we
            //  are not.
            if (isLocalUserInConference()) {
                // Update the DolbyIO SDK with the new device selection.
                const audioOutputDeviceId = getSelectedAudioOutputDevice();
                VoxeetSDK.mediaDevice.selectAudioOutput(audioOutputDeviceId);
            }

            // Save the user's choice to their cookie store either way.
            savePage();
        })

        // Onchange event handler for the video input device selection list.
        g_VideoInputDevicesList.addEventListener('change', function(evt) {
            // Are we in a conference?  We can't update the DolbyIO SDK if we
            //  are not.
            if (isLocalUserInConference()) {
                // Update the DolbyIO SDK with the new device selection.
                const videoInputDeviceId = getSelectedVideoInputDevice();
                VoxeetSDK.mediaDevice.selectVideoInput(videoInputDeviceId);
            }

            // Save the user's choice to their cookie store either way.
            savePage();
        });

        // Onchange event handler for the audio input device selection list.
        // TODO: Get rid of this event handler when done debugging!
        // $('#start-world').click(function() {
        //  startWorld();
        // });

        // Initialize the DolbyIO Voxeet SDK.
        mainVoxeetSDK()
        .then(result => {
            if (result !== true)
                throw new Error(errPrefix + `The main VoxeetSDK() function did not return true.`);
            console.info(`${errPrefix} Dolby IO SDK initialized.`);

            startWorld();

            return true;
        });
    } catch (err) {
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(errPrefix + errMsg + ' - try/catch outer');
    }
});

export {flashBuyButton, INSTRUCTIONS_ROW_ID, INSTRUCTIONS_DIV_ID};