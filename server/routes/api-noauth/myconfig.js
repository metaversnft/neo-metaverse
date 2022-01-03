// This route produces the CLIENT SIDE Javascript file "myconfig.js", which is requested
//  by other files and is expected to contain various settings the app
//  needs to fulfill its operations.
const express = require('express');
const router = express.Router();

const http_status_codes = require('http-status-codes');

// Lodash utility library.  Load the full build.
const _ = require('lodash');

const common_routines = require('../../common/common_routines');
const pubnub_server_side = require('../../common/pubnub-support-server-side.js');
const ConstantsDB = require('../../aws/dynamodb/dyno-quizzes/constants-db');

// '../common/pubnub-support-server-side');

// We keep this route out of the JWT/OAuth paths because we directly include
//  it into some of our extension's web pages with a SCRIPT tag.  Therefore,
//  the request does not carry any of the authentication headers.
router.post('/api-noauth/myconfig', function(req, res, next) {
    try
    {
    	let errPrefix = "(myconfig) ";
    	let retJsonObj = {};
    	
 		// We need the real user ID at this time.
 		retJsonObj.is_request_user_share = false;
 		
 		// Change the base request URL for the client side code
 		//  depending on the current configuration environment:
 		//	 development or not.
 		retJsonObj.base_url_for_xhr_send = common_routines.getEnvironmentVariableByName('BASE_URL_FOR_XHR_SEND');
 		
        // Just return the object.
        res.status(http_status_codes.OK).send(retJsonObj);
	}
    catch (err)
    {
        console.log('[ERROR: myconfig.js] Error during request -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('An error occurred while processing the request for /js/myconfig.js.');
        return;
    } // try/catch
});

module.exports = router;
