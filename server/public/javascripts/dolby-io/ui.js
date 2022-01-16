// The user interface code from the Dolby IO is-speaking demo.

import * as THREE from '../threejs/build/three.module.js';

import {randomName} from './client.js';
import {getConferenceNameFromURL, setConferenceName, updateConferenceName} from "./utils.js";
import {THREEJS_CANVAS_ID, THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD} from "../../globals/global-constants.js";
import {
    isLocalUserInConference,
    RemoteParticipantUpdate,
    RequestRemoteParticipantStatuses,
    sendVoxeetCommand
} from "./dolby-io-support.js";
import {getLocalUserParticipantId} from "../participant-helpers/participant-helper-objects.js";
import {g_ThreeJsCamera, g_ThreeJsControls} from "../objects/three-js-global-objects.js";
import {restorePage} from '../misc/persistence.js';
import {g_HowlerGlobalObj} from "../sound-effects-support/howler-support.js";

const errPrefix = '(doly-io-ui.js) ';

// Get a reference to the DOM elements that contains the input/output device options select boxes.
const g_AudioInputDevicesList = document.querySelector('#audio-input-devices-select');
const g_AudioOutputDevicesList = document.querySelector('#audio-output-devices-select');
const g_VideoInputDevicesList = document.querySelector('#video-input-devices-select');

// Turn Spatial Audio ON/OFF.
const g_IsSpatialAudioEnabbled = false;

const bVerbose = true;

const DEVICE_SETTINGS_DIV_ID = 'devices-floating-div';

// ROS: Test button.
// const testButton = document.getElementById('test-btn');
// const enterXPosInput = document.getElementById('input-x-pos');

const micButtonPairSelector = $('.mic-btn-div');
const vidcamButtonPairSelector = $('.vidcam-btn-div');

const conferenceNameInput = document.getElementById('alias-input');
const conferenceNameInputPrompt = document.getElementById('btnGroupAddon');

const waitingRoomLoadingDivSelector = $('#waiting-room-div-1');
const waitingRoomReadyDivSelector = $('#waiting-room-div-2');
const threeJsCanvasSelector = $('#' + THREEJS_CANVAS_ID);

const deviceSettingsButton = document.getElementById('device-settings-btn');

// Look for the developer flag that will keep us in a conference
//  even if we exit FPS controls mode.
const urlArgs = getUrlArguments();

const bIsDeveloperMode = urlArgs['dev'] === 'true';

if (bIsDeveloperMode)
  console.warn(`${errPrefix}Developer mode is enabled.`);
else
  console.info(`${errPrefix}Developer mode is NOT enabled.`);

let bDeviceSettingsJustShown = null;

// This flag trucks the muted/unmuted state of the local user.
let bIsLocalUserMuted = false;

// This flags tracks the video streaming state of the user. (video camera ON/OFF).
let bIsLocalUserStreamingVideo = false;

// We use a 100x100 unit field for the spatial audio environment.
const SPATIAL_AUDIO_FIELD_WIDTH = 100;
const SPATIAL_AUDIO_FIELD_HEIGHT = 100;

// This is the name that all spatial audio conferences must have
//  during the DolbyIO spatial audio beta.
const CONFERENCE_NAME_SPATIAL_AUDIO_BETA = "spatial";

// Get the conference name from the URL.
let g_ConferenceName = getConferenceNameFromURL();

if (!g_ConferenceName)
  // No conference name was specified in the URL.  Use the default.
    g_ConferenceName = CONFERENCE_NAME_SPATIAL_AUDIO_BETA;

setConferenceName(CONFERENCE_NAME_SPATIAL_AUDIO_BETA);

/**
 * This function will wait a bit and then send out an unsolicited status
 *  update that tells everyone where the local user is located
 *  in the virtual world and what their orientation is.
 */
function sendDelayedUnsolicitedStatusUpdate() {
    setTimeout(() => {
        // Send an unsolicited participant status update.  All the remote participants
        //  will have recreated our avatar in their virtual world's and need to
        //  update the new avatar's position and rotation.
        sendVoxeetCommand(new RemoteParticipantUpdate(g_ThreeJsCamera));
        console.info(`${errPrefix}Unsolicited remote participant update sent after starting video.`);
    }, 1000);
}

/**
 * Sets the local user's spatial audio position to that given.
 *
 * @param {THREE.Vector3} spatialPosition - The 3D position to set the
 *  local user's spatial audio position to.
 */
function setLocalUserSpatialAudioPosition(spatialPosition) {
    const errPrefix = `(setLocalUserSpatialAudioPosition) `;

    if (!g_IsSpatialAudioEnabbled)
        // Spatial audio is not enabled.
        return;

    if (!(spatialPosition instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the position3D parameter is not a THREE.Vector3 object.`);

    if (bVerbose)
        console.info(`${errPrefix} ${spatialPosition.x}, ${spatialPosition.y}, ${spatialPosition.z}`);

    VoxeetSDK.conference.setSpatialPosition(VoxeetSDK.session.participant, spatialPosition);
}

/**
 * This function returns TRUE if the given input/output device
 *  label indicates that it is a DEFAULT device entry.
 *
 * @param {String} inputOrOutputDeviceObj - The input/output device label
 *  returned by a media enumeration call.
 *
 * @return {boolean}
 */
function isDefaultDevice(inputOrOutputDeviceObj) {
  const errPrefix = `(isDefaultDevice) `;

  if (!misc_shared_lib.isNonNullObjectAndNotArray(inputOrOutputDeviceObj))
  	throw new Error(errPrefix + `The inputOrOutputDeviceObj is not a valid object.`);
  if (misc_shared_lib.isEmptySafeString(inputOrOutputDeviceObj.label))
    throw new Error(errPrefix + `The inputOrOutputDeviceObj.label field is missing or empty.`);
  return inputOrOutputDeviceObj.label.toLowerCase().startsWith('default');
}

/**
 * Wrap a Voxeet function call in a try/catch block so that
 *  we can catch any failures and convert a promise rejection
 *  to a boolean value returned by this promise.
 *
 * @param {String} callName - The name of the Voxeet function being
 *  called by the voxeetSdkCall promise.  It is used solely for
 *  error logging purposes.
 *
 * @return {Promise<Boolean>} - This promise will resolve to the
 *  result of the Voxeet promise if it succeeded .  If the call fails,
 *  then this promise will resolve to FALSE and will log the error to
 *  the console.
 */
function nofailVoxeetSdkCall_promise(callName, voxeetSdkCall) {
  const errPrefix = '(nofailVoxeetSdkCall_promise) ';

  if (misc_shared_lib.isEmptySafeString(callName))
    throw new Error(errPrefix + `The callName parameter is empty.`);

  if (!(voxeetSdkCall instanceof Promise))
    throw new Error(errPrefix + `The value in the voxeetSdkCall parameter is not a Promise object.`);

  return new Promise(function(resolve, reject) {
      try	{
          voxeetSdkCall
          .then(result => {
              // Resolve the promise with the result of the
              //  Voxeet promise.
            resolve(result);
          })
          .catch(err => {
              // Resolve the promise to FALSE while logging the error.
              const errMsg =
                  errPrefix + conformErrorObjectMsg(err);

              resolve(false);
          });
      }
      catch(err) {
        // Convert the error to a promise rejection.
        const errMsg =
            errPrefix + conformErrorObjectMsg(err);

        resolve(false);
      }
  });
}

/**
 * Update the microphone buttons to reflect the current state of the
 *  bIsLocalUserMuted flag.
 */
function updateMicrophoneButtons() {
  // Are we muted?
  if (bIsLocalUserMuted) {
    // Yes.  Change the visible button to the muted icon.
    $('#mic-muted-div').show();
    $('#mic-unmute-div').hide();
  } else {
    // No.  Change the visible button to the unmuted icon.
    $('#mic-muted-div').hide();
    $('#mic-unmute-div').show();
  }
}

/**
 * Update the video camera buttons to reflect the current state of the
 *  bIsLocalUserMuted flag.
 */
function updateVideocameraButtons() {
  // Are we broadcasting video?
  if (bIsLocalUserStreamingVideo) {
    // Yes. Change the visible button to the turn video camera ON button.
    $('#vidcam-on-div').show();
    $('#vidcam-off-div').hide();
  } else {
    // No.  Change the visible button to the turn video camera OFF button..
    $('#vidcam-on-div').hide();
    $('#vidcam-off-div').show();
  }
}

/**
 * Start the audio with out failing, since the usual cause for
 *  failure is that some other part of the code already
 *  started the audio.
 *
 * @return {Promise<Boolean>} - The promise resolves to TRUE
 *  if it the audio is started successfully, FALSE if it not.
 */
function startAudioWithoutFailing_promise() {
	const errPrefix = '(startAudioWithoutFailing_promise) ';

	return new Promise(function(resolve, reject) {
		try	{
          VoxeetSDK.conference.startAudio(VoxeetSDK.session.participant)
			.then(result => {
				console.info(errPrefix + 'Audio successfully started.');
                // Let the caller know that the audio was started successfully.
                resolve(true);
			})
			.catch(err => {
              // Convert the error but don't reject the promise.  We assume that
              //  the reason for the failure is that the audio was already started
              //  for the conference.
              let errMsg =
                  errPrefix + conformErrorObjectMsg(err);

              console.warn(`${errPrefix} Unable to start audio.  Assuming it was already started.  Error details: ${errMsg}.`);
              // Let the caller know that the audio was already started
              //  so we didn't start it with this promise.
              resolve(false);
			});
		}
		catch(err) {
		  // Convert the error to a promise rejection since this is
          // an unexpected error.
		  const errMsg =
		    errPrefix + conformErrorObjectMsg(err);
          reject(errMsg + ' - try/catch');
		}
	});
}

/**
 * Stop the audio with out failing, since the usual cause for
 *  failure is that some other part of the code already
 *  stopped the audio.
 *
 * @return {Promise<Boolean>} - The promise resolves to TRUE
 *  if it the audio is stopped successfully, FALSE if it not.
 */
function stopAudioWithoutFailing_promise() {
  const errPrefix = '(stopAudioWithoutFailing_promise) ';

  return new Promise(function(resolve, reject) {
    try	{
      VoxeetSDK.conference.stopAudio(VoxeetSDK.session.participant)
          .then(result => {
            console.info(errPrefix + 'Audio successfully stopped.');
            // Let the caller know that the audio was stopped successfully.
            resolve(true);
          })
          .catch(err => {
            // Convert the error but don't reject the promise.  We assume that
            //  the reason for the failure is that the audio was already started
            //  for the conference.
            let errMsg =
                errPrefix + conformErrorObjectMsg(err);

            console.warn(`${errPrefix} Unable to start audio.  Assuming it was already started.  Error details: ${errMsg}.`);
            // Let the caller know that the audio was already stopped
            //  so we didn't start it with this promise.
            resolve(false);
          });
    }
    catch(err) {
      // Convert the error to a promise rejection since this is
      // an unexpected error.
      const errMsg =
          errPrefix + conformErrorObjectMsg(err);
      reject(errMsg + ' - try/catch');
    }
  });
}

/**
 * Get the selected audio device ID from the audio input device select box.
 *
 * @returns {String|null} The ID of the selected audio input device. or NULL
 *  if one has not been selected.
 */
const getSelectedAudioInputDevice = () => {

    const errPrefix = '(getSelectedAudioInputDevice) ';
    const  selectedAudioInputDevice = g_AudioInputDevicesList.options[g_AudioInputDevicesList.selectedIndex];

    if (selectedAudioInputDevice) {
        if (bVerbose) {
            console.info(`${errPrefix}Selected audio input device ID: ${selectedAudioInputDevice.value}`);
            console.info(`${errPrefix}Selected audio input device Label: ${selectedAudioInputDevice.label}`);
        }
    } else {
        // A device has not been selected yet.
        console.warn(`${errPrefix}No audio input device selected yet.`);
        return null;
    }

    return selectedAudioInputDevice.value;
};

/**
 * Get the selected audio device ID from the audio output device select box.
 *
 * @returns {String|null} The ID of the selected audio output device. or NULL
 *  if one has not been selected.
 */
const getSelectedAudioOutputDevice = () => {

  const errPrefix = '(getSelectedAudioOutputDevice) ';
  const  selectedAudioOutputDevice = g_AudioOutputDevicesList.options[g_AudioOutputDevicesList.selectedIndex];

  if (selectedAudioOutputDevice) {
      if (bVerbose) {
          console.info(`${errPrefix}Selected audio output device ID: ${selectedAudioOutputDevice.value}`);
          console.info(`${errPrefix}Selected audio output device Label: ${selectedAudioOutputDevice.label}`);
      }
  } else {
    // A device has not been selected yet.
    console.warn(`${errPrefix}No audio output device selected yet.`);
    return null;
  }

  return selectedAudioOutputDevice.value;
};

/**
 * Get the selected video device ID from the video input device select box.
 *
 * @returns {String|null} The ID of the selected video input device. or NULL
 *  if one has not been selected.
 */
const getSelectedVideoInputDevice = () => {

    const errPrefix = '(getSelectedVideoInputDevice) ';
    const  selectedVideoInputDevice = g_VideoInputDevicesList.options[g_VideoInputDevicesList.selectedIndex];

    if (selectedVideoInputDevice) {
        if (bVerbose) {
            console.info(`${errPrefix}Selected video input device ID: ${selectedVideoInputDevice.value}`);
            console.info(`${errPrefix}Selected video input device Label: ${selectedVideoInputDevice.label}`);
        }
    } else {
        // A device has not been selected yet.
        console.warn(`${errPrefix}No video input device selected yet.`);
        return null;
    }

    return selectedVideoInputDevice.value;
};

/**
 * Get the selected video device ID from the video input device select box.
 *
 * @returns {String|null} The ID of the selected video device. or NULL
 *  if one has not been selected.
 *
const getSelectedVideoInputDevice = () => {

  const errPrefix = '(getSelectedVideoInputDevice) ';
  const selectedVideoInputDeviceId = g_VideoInputDevicesList[g_VideoInputDevicesList.selectedIndex].value;

  if (!selectedVideoInputDeviceId) {
    // A device has not been selected yet.
    console.warn(`${errPrefix}No video input device selected yet.`);
    return null;
  }

  // return {  deviceId: selectedVideoInputDeviceId,  label: videoInputDevicesList.options[videoInputDevicesList.selectedIndex].text
  return selectedVideoInputDeviceId;
};
*/

/**
 * Enumerate all the available audio and video devices and don't
 *  resolve the promise until that's done.
 *
 * @return {Promise<Boolean>}
 */
function enumerateAllDevices_promise() {
	let errPrefix = '(enumerateAllDevices_promise) ';

	return new Promise(function(resolve, reject) {
		try	{
          // NOTE: We filter out the "default" device entries since we don't
          //  want the user to be able to select a specific device without
          //  being confused by whatever the default device happens to be
          //  at the moment.

          // Clear the existing select box contents.
          g_AudioInputDevicesList.innerHTML = '';
          g_AudioOutputDevicesList.innerHTML = '';
          g_VideoInputDevicesList.innerHTML = '';

          // Load the Input Audio devices
          VoxeetSDK.mediaDevice.enumerateAudioDevices("input")
          .then(audioInputDevices => {
            const options = audioInputDevices.map(audioInputDevice => {
              if (!isDefaultDevice(audioInputDevice))
                g_AudioInputDevicesList.append(new Option(audioInputDevice.label, audioInputDevice.deviceId));
            });

            // Load the Output Audio devices
            return VoxeetSDK.mediaDevice.enumerateAudioDevices("output");
          })
          .then(audioOutputDevices => {
            const options = audioOutputDevices.map(audioOutputDevice => {
              if (!isDefaultDevice(audioOutputDevice))
                g_AudioOutputDevicesList.append(new Option(audioOutputDevice.label, audioOutputDevice.deviceId));
            });

            // Load the Video devices
            return VoxeetSDK.mediaDevice.enumerateVideoDevices("input");
          })
          .then(videoInputDevices => {
            const options = videoInputDevices.map(videoInputDevice => {
              if (!isDefaultDevice(videoInputDevice))
                g_VideoInputDevicesList.append(new Option(videoInputDevice.label, videoInputDevice.deviceId));
            });

            resolve(true);
          })
          .catch(err => {
              // Convert the error to a promise rejection.
              let errMsg =
                  errPrefix + conformErrorObjectMsg(err);

              reject(errMsg + ' - promise');
          });
		}
		catch(err) {
			// Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);

			reject(errMsg + ' - try/catch');
		}
	});
}

/**
 * Join the conference with the desired name.
 *
 * NOTE: During the spatial audio only the name "spatial" for the conference
 *  name will work, otherwise spatial audio will not work.
 *
 * @param {String} conferenceName - The name of the conference to join.
 */
async function joinConference(conferenceName) {
  const errPrefix = `(joinConference) `;

  if (misc_shared_lib.isEmptySafeString(conferenceName))
    throw new Error(errPrefix + `The conferenceName parameter is empty.`);

    if (!g_IsSpatialAudioEnabbled)
        // Spatial audio is not enabled.
        console.warn(`${errPrefix}The conferenceName parameter is not "spatial".  Has the DolbyIO spatial audio beta ended and is now in production?`);

  // On join button click,
  // 1. Create a conference room with an alias
  // 2. Join the conference with its id
  // 3. Set the UI

  // ROS: Request spatial audio conference.

  // when participant joins conference, event streamAdded is emited to other participants

  // ROS: Original join options.
  // const joinOptions = { alias: conferenceName, params: { dolbyVoice: true }};

  // ROS: Create options with spatial audio.
  const createOptions =
      {
        alias: conferenceName,
        params: {
          dolbyVoice: true,
          // From getting started sample.  Added these on 12/27/2021.
          liveRecording: false,
          rtcpMode: "average", // worst, average, max
          ttl: 0,
          videoCodec: "H264", // H264, VP8
        }
      };

  // ROS: Join options.
  const joinOptions =
      {
        preferRecvMono: false,
        spatialAudio: g_IsSpatialAudioEnabbled
      };

  // ROS: The block below that prepares the audio scene
  // is from this Dolby IO web page:
  //
  // https://docs.dolby.io/communications-apis/docs/guides-integrating-spatial-audio

  // Prepare the spatial audio scene
  // window.innerWidth and window.innerHeight give me the dimensions of the window
  // const scale   = { x: window.innerWidth / 4, y: window.innerHeight / 3, z: 1 };
  // const scale = {x: window.innerWidth / 4, y: window.innerHeight / 3, z: 1};

  // Set the scale to the maximum distance in the ThreeJS scene that
  //  we consider to be the limit of the listener's hearing.
  // const scale = {x: THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD, y: THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD, z: THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD};

  const scale = {s: 10, y: 10, z: 1};

  // All axes treat larger numbers as being further from the
  //  listener except for the X value, which maps to left and
  //  right.
  // const forward = {x: 0, y: -1, z: 0};
  const forward = {x: 0, y: -1, z: 0};
  // const up = {x: 0, y: 0, z: 1};
  const up = {x: 0, y: 0, z: 1};
  // const right = {x: 1, y: 0, z: 0};
  const right = {x: 1, y: 0, z: 0};

  let conferenceObj = null;

  VoxeetSDK.conference.create(createOptions)
      .then((resultConferenceObj) => {
            // ROS: Save the returned conference object for later use.
            conferenceObj = resultConferenceObj;
            return nofailVoxeetSdkCall_promise(
                'VoxeetSDK.conference.join',
                VoxeetSDK.conference.join(resultConferenceObj, joinOptions));
          }
      )
      // RESULT OF CONFERENCE JOIN ATTEMPT.
      .then((joinedRetObj) => {
        console.log(joinedRetObj);

        // Reset the bIsLocalUserMuted flag and sync the microphone buttons.
        bIsLocalUserMuted = false;
        updateMicrophoneButtons();

        // Reset the video streaming flag and sync the video camera buttons.
        bIsLocalUserStreamingVideo = false;
        updateVideocameraButtons();

        // Enumerate the users input and output devices.  This is the
        //  second attempt after the attempt that occurs in the
        //  document ready handler.
        return enumerateAllDevices_promise();
      })
      /*
      .then(() => {
        // Do NOT stop the audio input or the selectAudioInput() call will fail
        //  when it tries to remove the audio track from it localMediaStream
        //  field.

        // Blind stop the audio input stream, in case it is running, so we can set the audio input device.
        return stopAudioWithoutFailing_promise();
      })
      .then((bAudioStopResult) => {
        if (typeof bAudioStopResult !== 'boolean')
          throw new Error(errPrefix + `The value in the bAudioStartResult result is not boolean.`);
       */
      .then(() => {
        // Restore all the device choices from the user's cookies since we
        //  may have just reset them when we enumerated the devices in the
        //  previous THEN block that does that.
        restorePage();

        // console.info(`${errPrefix}startAudioWithoutFailing_promise() returned ${bAudioStopResult}.`);

        // Select the currently selected audio input device.
        const audioInputDeviceId = getSelectedAudioInputDevice();
        return nofailVoxeetSdkCall_promise(
            'VoxeetSDK.mediaDevice.selectAudioInput',
            VoxeetSDK.mediaDevice.selectAudioInput(audioInputDeviceId));
      })
      .then((resultOfSselectAudioInput) => {
          console.info(errPrefix + `resultOfSselectAudioInput object:`);
          console.dir(resultOfSselectAudioInput, {depth: null, colors: true});

        // Now restart the audio input stream.
        return startAudioWithoutFailing_promise();
      })
      .then((bAudioStartResult) => {
        console.info(`${errPrefix}startAudioWithoutFailing_promise() returned ${bAudioStartResult}.`);

        // Select the currently selected audio output device.
        const audioOutputDeviceId = getSelectedAudioOutputDevice();
        return nofailVoxeetSdkCall_promise(
            'VoxeetSDK.mediaDevice.selectAudioOutput',
            VoxeetSDK.mediaDevice.selectAudioOutput(audioOutputDeviceId));
      })
      .then((resultOfSelectAudioOutput) => {
          console.info(errPrefix + `resultOfSelectAudioOutput object:`);
          console.dir(resultOfSelectAudioOutput, {depth: null, colors: true});

        // NOTE: We don't select the video input device until the usr
        //  starts sharing video with the conference.

          if (g_IsSpatialAudioEnabbled) {
              console.warn(`${errPrefix}startAudioWithoutFailing_promise() Spatial audio configuration calls are ENABLED.`);
              // ROS: Set the parameters for the spatial audio environment.
              VoxeetSDK.conference.setSpatialEnvironment(scale, forward, up, right);
          } else {
              console.warn(`${errPrefix}startAudioWithoutFailing_promise() Spatial audio configuration calls are DISABLED.`);
          }

        // Adjust the ThreeJS scene to match the current conference state, especially
        //  in case we need to add avatars for remote participants already in the
        //  conference.
        // updateThreeJsSceneFromConference(joinedRetObj);

        // Ask all the remote participants already in the conference to tell us their
        //  status, including the status of their ThreeJS avatar.
        sendVoxeetCommand(new RequestRemoteParticipantStatuses());

        // handleControlBtnsOnJoinCall();
      })
      .catch(err => {
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(errMsg + ' - promise');
      });
}

/**
 * Leave the current conference.
 */
async function leaveConference() {
  const errPrefix = `(leaveConference) `;

  VoxeetSDK.conference
      .leave()
      .then(() => {
        console.info(`${errPrefix}The conference has been left.`);
      })
      .catch((err) => {
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(errMsg + ' - promise');
      });
}

/**
 * Start streaming video.  (Turn the video camera ON).
 */
function startVideoStreaming() {
  const errPrefix = `(startVideoStreaming) `;

  VoxeetSDK.conference.startVideo(VoxeetSDK.session.participant)
  .then(() => {
    // Select the currently selected video input device.
    // ROS: Get the currently selected video input device.
    const videoInputDevice = getSelectedVideoInputDevice();

    if (videoInputDevice) {
      console.info(`${errPrefix} Selected video input device: ${videoInputDevice}`);
      // ROS: Tell the SDK to use the selected video input device.
      return VoxeetSDK.mediaDevice.selectVideoInput(videoInputDevice, {});
    } else {
      console.warn('No video input device selected.');
      return false;
    }
  })
  .then(() => {
    console.info(`${errPrefix}The video stream has been started.`);

    sendDelayedUnsolicitedStatusUpdate();
  })
  .catch(err => {
    // Convert the error to a promise rejection.
    let errMsg =
        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

    console.error(errMsg + ' - promise');
  });
}

/**
 * Stop streaming video.  (Turn the video camera OFF).
 */
function stopVideoStreaming() {
    const errPrefix = `(stopVideoStreaming) `;

    // Stop streaming video.
    VoxeetSDK.conference.stopVideo(VoxeetSDK.session.participant)
        .then(() => {
            sendDelayedUnsolicitedStatusUpdate();

            console.info(`${errPrefix}The video stream has been stopped.`);
        })
        .catch(err => {
            // Convert the error to a promise rejection.
            let errMsg =
                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

            console.error(errMsg + ' - promise');
        });
}

/**
 * The callback function that gets called by our event listener for
 *  the 'lock' event message the FPS controls lock() call emits.
 */
async function doPostLockProcessing() {
  const errPrefix = `(doPostLockProcessing) `;

  // The FPS controls have been locked.  Hide the waiting room.
  waitingRoomReadyDivSelector.hide();

  // Show the ThreeJS canvas.
  threeJsCanvasSelector.show();

  if (isLocalUserInConference()) {
    // Already in conference.
    console.warn(`${errPrefix}Already in conference.  Ignoring JOIN call.`);
    return;
  }

  // Join the conference.
  await joinConference(g_ConferenceName)
    .catch(err => {
      // Convert the error to a promise rejection.
      const errMsg =
        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
        console.error(errMsg + ' - await');
    });
}

/**
 * The callback function that gets called by our event listener for
 *  the 'lock' event message the FPS controls lock() call emits.
 */
async function doPostUnlockProcessing() {
  const errPrefix = `(doPostUnlockProcessing) `;

  // If we are in developer mode, then don't show the waiting room
  //  and don't leave the conference.
  if (bIsDeveloperMode) {
    console.log(`${errPrefix}Developer mode is enabled.  Not leaving the conference or switching views.`);
    return;
  }

  // The FPS controls have been unlocked.  Show the waiting room.
  waitingRoomReadyDivSelector.show();

  // Hide the ThreeJS canvas.
  threeJsCanvasSelector.hide();

  if (!isLocalUserInConference()) {
    // Not in a conference, ignore the LEAVE call.
    console.warn(`${errPrefix}Not in a conference.  Ignoring LEAVE call.`);
    return;
  }

  // Leave the conference.
  await leaveConference()
  .catch(err => {
    // Convert the error to a promise rejection.
    const errMsg =
      errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

    console.error(errMsg + ' - await');
  });
}

/**
 * Mute or unmute the microphone based on the flag mute/unmute flag status.
 */
function muteOrUnmuteMicrophone() {
    const errPrefix = `(muteOrUnmuteMicrophone) `;

    const localUserParticipantId = getLocalUserParticipantId();

    // Toggle the muted flag.
    bIsLocalUserMuted = !bIsLocalUserMuted;

    // Sync the microphone buttons.
    updateMicrophoneButtons();

    if (bIsLocalUserMuted) {
        VoxeetSDK.conference.stopAudio(localUserParticipantId);
        console.info(`${errPrefix}Microphone has been MUTED.`);
    } else {
        VoxeetSDK.conference.startAudio(localUserParticipantId);
        console.info(`${errPrefix}Microphone has been UNMUTED.`);
    }
}

/**
 * Starts or stops video streaming based on the flag for that..
 */
function startStopVideo() {
    const errPrefix = `(startStopVideo) `;

    // Toggle the video streaming flag.
    bIsLocalUserStreamingVideo = !bIsLocalUserStreamingVideo;

    // Sync the video camera buttons.
    updateVideocameraButtons();

    // In a conference?
    if (isLocalUserInConference()) {
        // Is video streaming desired?
        if (bIsLocalUserStreamingVideo)
            // Start/Stop video streaming based on our flag.
            startVideoStreaming();
        else {
            stopVideoStreaming();
        }
    }
}

/**
 * Initializes the UI.
 */
const initUI = async() => {
  const errPrefix = `(initUI) `;

  try {
    // ROS: When a video tile is clicked on, the participant ID of the
    //  the associated participant is stored in this variable.
    let g_LastSelectedParticipantId = null;

    // ROS: set position of available video container DIVs explicitly
    //  since we are using absolute positioning.
    let lastLeft = 0;
    $('.video-container').each(function (index) {
      // Add a few pixels for a margin.
      let newLeft = index === 0 ? 0 : lastLeft + parseInt($(this).css('width').split('px')[0]) + 50;
      $(this).css('left', `${newLeft}px`);
      lastLeft = newLeft;
    });

    // Extract the conference name from the URL if one is provided and
    //  put that value in the conference name screen element.
    let conferenceUrl = getConferenceNameFromURL();
    setConferenceName(
        conferenceUrl,
        conferenceNameInput,
        conferenceNameInputPrompt
    );

    // As the user types conference name, append alias to url as query string param
    conferenceNameInput.addEventListener('keyup', function (event) {
      updateConferenceName(event);
    });

    /**
     * Event handler for the clicking the DEVICE SETTINGS button.
     */
    deviceSettingsButton.onclick = async function() {
      const errPrefix = `(deviceSettingsButton.onclick) `;

      // Make the Device Settings DIV visible, centered over the
      //  Three.js canvas.  Set the flag that tells other code
      //  the form is being made visible.
      bDeviceSettingsJustShown = true;
      showFloatingFormDiv(DEVICE_SETTINGS_DIV_ID, THREEJS_CANVAS_ID, true);
    }

    /**
     * Event handler for the microphone mute/unmute buttons.
     */
    micButtonPairSelector.click(function() {
      const errPrefix = '(micButton.click) '

      muteOrUnmuteMicrophone(bIsLocalUserMuted);
    });

    /**
     * Event handler for the turn video camera ON/OFF buttons.
     */
    vidcamButtonPairSelector.click(function() {
      const errPrefix = '(vidcamButtonPairSelector.click) '

      startStopVideo();
    });

    /**
     * Event handler for clicks on the the waiting room DIV.
     */
    waitingRoomReadyDivSelector.click((e) => {
      // Enter FPS controls mode.  The event listener that listens for the
      //  'lock' event will call our doLockProcessing() callback function
      //  to do the rest of the work.
      //
      // NOTE: Pressing the ESC key does the same for doUnlockProcessing()
      //  instead of us calling the unlock() function ourselves.
      g_ThreeJsControls.lock();

      // Set the volume to 1.0, to initialize the Howler context and to
      //  set the global volume level.  We have to wait until the user
      //  clicks on the page since the audio context is not allowed
      //  to be created until a user gesture on the page occurs.
      g_HowlerGlobalObj.volume(1.0);
    });

    /**
     * Event handler for clicks on the the three JS canvas.  This is
     *  necessary for when we are in developer mode so we can reenter
     *  FPS controls mode with the canvas showing, since we do not
     *  restore the waiting room when we leave FPS controls mode.
     */
    threeJsCanvasSelector.click((e) => {
      if (!bIsDeveloperMode)
        return; // Not in developer mode.

      // Enter FPS controls mode.
      g_ThreeJsControls.lock();
    });

    // ROS: Onclick handler for video DIVs.
    $('.video-container').click((e) => {
      let errPrefix = `(video-container-on-click) `;

      // There should be only one child and that child's ID
      //  should be 'video-' plus the participant ID.
      if (!e.currentTarget.firstElementChild) {
        console.warn(`${errPrefix}The video container did not contain a child video element.`);
        return;
      }

      let participantId = e.currentTarget.firstElementChild.id.split('video-')[1];

      if (!participantId) {
        console.warn(`${errPrefix}The video tile's ID does not appear to contain a participant ID.`);
        return;
      }

      console.log(`Video container clicked for participant ID: ${participantId}.`);
      $('#selected-participant-label').text(`Selected participant: ${participantId}.`);
      g_LastSelectedParticipantId = participantId;
    });

    // Ask for permission to use the camera and microphone.  We have to
    //  do this before getCameraSelection() or if permission has not
    //  been granted yet, no devices will enumerated, leaving the
    //  input select list empty.
    let constraints = {
      audio: {
        optional: [{sourceId: g_VideoInputDevicesList.value}]
      },
      video: {
        optional: [{sourceId: g_VideoInputDevicesList.value}]
      }
    };

    const now = Date.now();

    const gumResult = await navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
          console.log('Got stream, time diff :', Date.now() - now);
        })
        .catch(function (err) {
          console.log('GUM failed with error, time diff: ', Date.now() - now);
        });

    return true;
  } catch (err) {
    const errMsg =
        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

    console.error(errMsg + ' - try/catch outer');
  }
}

// Hide the device settings DIV if a click occurs outside it.
$(document).click(function() {
  const deviceSettingsDivSelector = $(`#${DEVICE_SETTINGS_DIV_ID}`);

  // Has it just been shown?  We don't want to close it before the
  //  user has had a chance to select a device.
  if (!bDeviceSettingsJustShown) {
    if (!deviceSettingsDivSelector.is(event.target) && !deviceSettingsDivSelector.has(event.target).length)
      hideFloatingFormDiv(DEVICE_SETTINGS_DIV_ID)
  }

  bDeviceSettingsJustShown = false;
});

/**
 * This function should be called when the web page is FULLY loaded.
 */
function callMeWhenPageIsReady() {
    const errPrefix = `(callMeWhenPageIsReady) `;

    // Listen for the 'lock' event message from the controls module.
    g_ThreeJsControls.addEventListener( 'lock', function () {
        // We received the message from the controls object that tells us the
        //  controls have been locked.  This means the player wants to play.

        doPostLockProcessing();
    } );

    // We received the message from the controls object that the
    //  controls have been unlocked.  This means the player wants to stop playing.
    g_ThreeJsControls.addEventListener( 'unlock', function () {
        doPostUnlockProcessing();
    } );

    // Hide the loading world DIV and show the ready DIV.
    waitingRoomLoadingDivSelector.hide();
    waitingRoomReadyDivSelector.show();
}

export {g_IsSpatialAudioEnabbled, g_AudioInputDevicesList, g_AudioOutputDevicesList, g_VideoInputDevicesList, callMeWhenPageIsReady, doPostUnlockProcessing, enumerateAllDevices_promise, initUI, getSelectedAudioInputDevice, getSelectedAudioOutputDevice, getSelectedVideoInputDevice, muteOrUnmuteMicrophone, startStopVideo, setLocalUserSpatialAudioPosition, SPATIAL_AUDIO_FIELD_WIDTH, SPATIAL_AUDIO_FIELD_HEIGHT};
