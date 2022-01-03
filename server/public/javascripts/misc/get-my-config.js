// This module contains code that gets the configuration information we need from the server.

// The global app configuration will be stored here once it
//  has been retrieved from the server.
let  g_AppConfig = null;

/**
 * This function gets the current app configuration from our server.
 */
function getMyConfig_promise() {

    let errPrefix = '(getMyConfig_promise) ';

    let postParamsObj_myconfig_js = {
    }

    // Get some configuration information from our server.
    xhrPost_promise(g_Global.urlMyConfigJS, postParamsObj_myconfig_js)
        .then(progressEvent => {
            // Save the configuration information where others can find it.
            g_AppConfig = progressEvent.target.response;
            return null;
        })
        .catch(err => {
            // Show the error.
            let errMsg =
                errPrefix + conformErrorObjectMsg(err);
            errMsg += ' - promise';

            console.error(errMsg);
        });
}