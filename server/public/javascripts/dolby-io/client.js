import {initUI} from "./ui.js";
import {g_ParticipantWrapperManager} from "../participant-helpers/participant-helper-objects.js";
import {processRemoteParticipantUpdate} from "../threejs/examples/animate-loop.js";
import {RemoteParticipantUpdate, sendVoxeetCommand} from "./dolby-io-support.js";
import {g_ThreeJsCamera} from "../objects/three-js-global-objects.js";
import {g_GlobalState} from "../objects/global-state.js";

const errPrefix = '(client.js) ';

const JolivianNames = [
  'Mike Jolivian',
  'Carol Jolivian',
  'Marcia Jolivian',
  'Jan Jolivian',
  'Cindy Jolivian',
  'Greg Jolivian',
  'Bobby Jolivian',
];

const randomName = JolivianNames[Math.floor(Math.random() * JolivianNames.length)];

/**
 * Make a video node for conference participants using an existing DOM element that
 *  is not in the ThreeJS scene.
 *
 * @param {Object} participant - The participant object.
 * @param {Object} stream - The stream object associated with the participant.
 */
function makeExplicitVideoNode(participant, stream) {
  // Find the explicit video node.
  const idOfExplicitVideoNode = 'video-container-0';

  let videoContainer = document.getElementById(idOfExplicitVideoNode);

  if (!videoContainer)
    throw new Error(errPrefix + `Could not find the explicit video node using ID: ${idOfExplicitVideoNode}.`);

  let videoNode = document.createElement('video');
  videoNode.setAttribute('id', 'video-' + participant.id);
  videoNode.setAttribute('height', 240);
  videoNode.setAttribute('width', 320);

  videoNode.setAttribute('playsinline', true);
  videoNode.muted = true;
  videoNode.setAttribute('autoplay', 'autoplay');

  //let videoContainer = document.createElement('div');

  videoContainer.appendChild(videoNode);
  let nameTextElement = document.createElement('div');
  nameTextElement.setAttribute('class', 'caption');
  nameTextElement.innerText = participant.info.name;
  videoContainer.appendChild(nameTextElement);

  // ROS: Attach the DolbyIO video stream to the video node.
  //  "navigator" is a global object found in the VoxeetSDK
  //  package that provides important WebRTC functionality.
  navigator.attachMediaStream(videoNode, stream);

}

/**
 * Handle the streamAdded event, which occurs when a participant joins the
 *  conference.
 */
VoxeetSDK.conference.on('streamAdded', (participant, stream) => {
  const errPrefix = `(VoxeetSDK.conference.on:streamAdded) `;

  try {
    console.info(`${errPrefix}streamAdded for participant: ${participant.info.name}`);

    if (!g_ParticipantWrapperManager.isExistingParticipant(participant.id)) {
      g_ParticipantWrapperManager.addParticipant(participant, stream);
    }

    // Update the participant status.
    g_ParticipantWrapperManager.updateParticipantStatus(participant, stream);

  } catch(err) {
    // Convert the error to a promise rejection.
    const  errMsg =
      errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
    console.error(`${errPrefix}${errMsg}`);
  }
});

/**
 * Handle the streamUpdated event, which occurs when a participant in
 *  the conference changes their stream status.
 */
VoxeetSDK.conference.on('streamUpdated', (participant, stream) => {
  const errPrefix = `(VoxeetSDK.conference.on:streamUpdated) `;

  try {
    console.info(`${errPrefix}streamUpdated for participant: ${participant.info.name}`);

    // TEMP CODE.
    if (false && stream.getVideoTracks().length > 0) {
      makeExplicitVideoNode(participant, stream);
      return;
    }

    g_ParticipantWrapperManager.updateParticipantStatus(participant, stream);
  } catch(err) {
    // Convert the error to a promise rejection.
    const  errMsg =
        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
    console.error(`${errPrefix}${errMsg}`);
  }
});

/**
 * Handle the streamRemoved event, which occurs when a participant leaves
 *  the conference.
 */
VoxeetSDK.conference.on('streamRemoved', (participant, stream) => {
  const errPrefix = `(VoxeetSDK.conference.on:streamRemoved) `;

  try {
    console.info(`${errPrefix}streamRemoved and video node if present for participant: ${participant.info.name}`);
    g_ParticipantWrapperManager.removeParticipant(participant, stream);
  } catch(err) {
    // Convert the error to a promise rejection.
    const  errMsg =
        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
    console.error(`${errPrefix}${errMsg}`);
  }
});

// ROS: Process command messages.
VoxeetSDK.command.on('received', (participant, message) => {
  try {
    const receivedMessageObj = JSON.parse(message);

    if (receivedMessageObj.typePayload === 'RemoteParticipantUpdate') {
      if (!misc_shared_lib.isNonNullObjectAndNotArray(receivedMessageObj.payloadObj))
      	throw new Error(errPrefix + `The receivedMessageObj.payloadObj is not a valid object.`);

      // Reconstitute the raw RemoteParticipantUpdate object to a full-fledged
      //  RemoteParticipantUpdate object.
      let remoteParticipantUpdateObj = new RemoteParticipantUpdate();
      const rawObj = receivedMessageObj.payloadObj;

      for (const propKey in rawObj) {
        const propValue = rawObj[propKey];
        remoteParticipantUpdateObj[propKey] = propValue;
      }

      // Update the participant's status (e.g. - avatar position, rotation, etc.).
      processRemoteParticipantUpdate(remoteParticipantUpdateObj);
    } else if (receivedMessageObj.typePayload === 'RequestRemoteParticipantStatuses') {
      // Process the status update request from a remote participant.  Broadcast our
      //  current status to the network.
      sendVoxeetCommand(new RemoteParticipantUpdate(g_ThreeJsCamera));
    } else if (receivedMessageObj.typePayload === 'FollowerModeUpdate') {
      // Update our FOLLOWING status in case we are a FOLLOWER.
      g_GlobalState.processFollowerModeUpdate(receivedMessageObj.payloadObj);
    }
  }
  catch(err) {
      const errMsg =
          errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

      console.error(errMsg);
  };
});

/**
 * Initialize the Dolby IO Voxeet SDK.
 *
 * @return {Promise<Boolean>}
 */
const mainVoxeetSDK = async () => {
  const errPrefix = `(mainVoxeetSDK) `;

  // TODO: Put your DolbyIO credentials here!
  VoxeetSDK.initialize('<YOUR DOLBYIO CONSUMER KEY>', 'YOUR DOLBYIO SECRET>');

  try {
    await VoxeetSDK.session.open({ name: randomName });
    await initUI();
    console.info(`${errPrefix}VoxeetSDK initialized`);
    return true;
  } catch (err) {
    const errMsg = misc_shared_lib.conformErrorObjectMsg(err);
    console.error(`${errPrefix}${errMsg}`);
  }
};

export {mainVoxeetSDK, randomName};


