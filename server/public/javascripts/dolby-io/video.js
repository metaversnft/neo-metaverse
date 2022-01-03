import * as THREE from '/javascripts/threejs/build/three.module.js';

// Track which participant is in which video container
let g_VideoContainerList = [
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
  { participantId: undefined },
];

const addVideoNode = (participant, stream) => {
  let videoNode = document.getElementById('video-' + participant.id);

  // if a video node does not exist for a participant with this id, make a <video> element
  if (!videoNode) {
    videoNode = document.createElement('video');
    videoNode.setAttribute('id', 'video-' + participant.id);
    videoNode.setAttribute('height', 240);
    videoNode.setAttribute('width', 320);
    videoNode.setAttribute('playsinline', true);
    videoNode.muted = true;
    videoNode.setAttribute('autoplay', 'autoplay');

    /*
    // if participant id is not present in the video container list,
    // insert participant id into list and update DOM
    for (let i = 0; i < g_VideoContainerList.length; i++) {
      if (!g_VideoContainerList[i].participantId) {
        g_VideoContainerList[i].participantId = participant.id;
        // ROS: This is where the video stream is attached to a
        //  video container on the screen.
        let videoContainer = document.getElementById('video-container-' + i);
        videoContainer.appendChild(videoNode);
        let nameTextElement = document.createElement('div');
        nameTextElement.setAttribute('class', 'caption');
        nameTextElement.innerText = participant.info.name;
        videoContainer.appendChild(nameTextElement);
        break;
      }
    }
     */

  }

  // Make a box in the scene.


  // Add the video node to the ThreeJS scene.
  const texture = new THREE.VideoTexture(videoNode);
  const material1 = new THREE.MeshBasicMaterial( { map: texture } );
  const mesh1 = new THREE.Mesh( geometry1, material1 );
  mesh1.rotation.y = - Math.PI / 2;
  // Add the mesh to the scene.
  scene.add( mesh1 );

  // ROS: This is where the Dolby SDK attaches the video stream to the video node.
  navigator.attachMediaStream(videoNode, stream);
};

const removeVideoNode = (participant) => {
  let videoNode = document.getElementById('video-' + participant.id);
  if (videoNode) {
    videoNode.srcObject = null; // Prevent memory leak in Chrome
    let caption = videoNode.parentNode.children[1];
    caption.remove();
    // remove leaving participant's video node from the DOM
    videoNode.parentNode.removeChild(videoNode);
    for (let i = 0; i < g_VideoContainerList.length; i++) {
      // remove particpant from container list when they leave
      if (g_VideoContainerList[i].participantId === participant.id) {
        g_VideoContainerList[i].participantId = undefined;
      }
    }
  }
};

export { addVideoNode, removeVideoNode };