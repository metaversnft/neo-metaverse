// Some utilities used by various code in this app.

// Update conference name in url as user types
const updateConferenceName = (event) => {
  let queryStringParams = new URLSearchParams(window.location.search);
  queryStringParams.set('alias', event.target.value);
  if (window.history.replaceState) {
    let url =
      window.location.protocol +
      '//' +
      window.location.host +
      window.location.pathname +
      '?' +
      queryStringParams.toString();

    window.history.replaceState(
      {
        path: url,
      },
      '',
      url
    );
  }
};

/**
 * Extract the conference name from the page URL if it exists.
 *
 * @return {string|boolean} - Returns the conference name if it is
 *   found in the URL, otherwise returns false.
 */
const getConferenceNameFromURL = () => {
  let query = window.location.search.substring(1);
  let params = query.split('&');
  for (let i = 0; i < params.length; i++) {
    let pair = params[i].split('=');
    if (pair[0] == 'alias') {
      return pair[1];
    }
  }
  return false;
};

const setConferenceName = (
  conferenceUrl,
  conferenceNameInput,
  conferenceNameInputPrompt
) => {
  // ROS: We aren't using the conference name form elements.
  return;

  // if there is already a conference name in the url (ie joining with a join link),
  // disable the conference name input form
  if (!conferenceUrl) {
    return;
  } else {
    conferenceNameInput.value = conferenceUrl;
    conferenceNameInput.disabled = true;
    conferenceNameInput.style.backgroundColor = 'lightgrey';
    conferenceNameInput.style.borderColor = 'lightgrey';
    conferenceNameInputPrompt.innerText = 'Will join conference:';
  }
};

/*
const getSelectedVideoInputDevice = () => {
  let videoInputDevice = document.getElementById('video-input-device');
  return videoInputDevice.options[videoInputDevice.selectedIndex].value;
};
*/

export {getConferenceNameFromURL, setConferenceName, updateConferenceName};