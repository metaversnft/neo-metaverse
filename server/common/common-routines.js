const http_status_codes = require('http-status-codes');
const urlParser = require('url');

const path = require('path');
const fsMisc = require('fs');
const uuidV4 = require('uuid/v4');

// Human friendly label for HTTP methods.
const http_methods_enum = require('http-methods-enum');

// Helper function to handle all cases of a variable being essentially empty or
//  not a string.
function isEmptyString(str)
{
    return (typeof str != 'string' || str == null || str.length < 1);
}

/**
 * Helper function to pretty print a Javascript object in a format friendly for logging.
 *
 * @param {Object} obj - The object to pretty print.
 */
function prettyPrintObject(obj)
{
    let errPrefix = '(prettyPrintObject) ';

    if (isUnassignedObject(obj))
        throw new Error(errPrefix + ' The object parameter is unassigned.');

    return JSON.stringify(obj, null, 4);
}

// Help function to handle all cases of a variable being unassigned.
function isUnassignedObject(obj)
{
    return (typeof obj == 'undefined' || obj == null);
}


// Remove all HTTP, HTTPS, or FTP links from a string.
function removeAllLinks(str) {
    if (isEmptyString(str))
        return str;

    return str.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');
}

// Load the files from the given starting directory and
//  return them in an array. If bRecurse is TRUE, then descend into
//  child directories recursively too, otherwise only the contents
//  of the starting directory will be processed.
function readFilesSync(startDir, bRecurse)
{
    var fileSystem = require('fs');
    var pathSystem = require('path');
    var currentDir = startDir;
    var aryFilesFound = new Array();

    fileSystem.readdirSync(currentDir).forEach(
        function( fileName )
        {
            var filePath = pathSystem.join(currentDir, fileName);
            var statDetails = fileSystem.statSync(filePath);

            // Is it a file?
            if (statDetails.isFile())
            {
                // Add the file name to the return array.
                aryFilesFound.push(fileName);
            }
            else
            {
                // Is recursive descent requested?
                if (bRecurse)
                    // Descend.
                    readFilesSync(filePath);
            } // else - if (statDetails.isFile())
        } // function( fileName )
    ); // foreach()

    // Return the list of files we found.
    return aryFilesFound;
} // function readFilesSync(startDir, bRecurse)

function testAlert()
{
    alert("hi");
}

function buildJsonDataFileUri(objectId)
{
    // Object ID is currently the primary file name for the JSON data file.
    var fileName = objectId + ".json";
    return path.join(__dirname, "public/DATA/", fileName);
}

// Build the relative path for a JSON data JSON archive file
//  using the given primary file n ame.
function buildJsonDataZipUri(primaryFilename)
{
    if (primaryFilename == null || primaryFilename.length < 1)
        throw new Error('The primary file name for the ZIP archive file is empty.');

    var fileName = primaryFilename + ".zip";
    var tempDir = getOrCreateTempDir();

    return path.join(__dirname, tempDir, fileName);
}

// Build the relative path to the NHS articles sub-directory.
function buildJsonDataFileUri_articles(articleID)
{
    // Article ID is currently the primary file name for the article JSON data file.
    var fileName = articleID;
    return path.join(__dirname, "articles/nhs_atoz/", fileName);
}

// Return the relative path to the JSON data JSON files.
function getPublicDataDirectory()
{
    return 'public/DATA/';
}

// Return the relative path to our TEMP directory.  If that directory
//  does not exist yet, it will be automatically created.
function getOrCreateTempDir()
{
    var tempDir = "temp";

    if (!fsMisc.existsSync(tempDir))
        // Temp file directory does not exist yet. Create it.
        fsMisc.mkdirSync(tempDir);

    return tempDir;
}

// Load the files from the given starting directory and
//  return them in an array. If bRecurse is TRUE, then descend into
//  child directories recursively too, otherwise only the contents
//  of the starting directory will be processed.
function readFilesSync(startDir, bRecurse)
{
    var fileSystem = require('fs');
    var pathSystem = require('path');
    var currentDir = startDir;
    var aryFilesFound = new Array();

    fileSystem.readdirSync(currentDir).forEach(
        function( fileName )
        {
            var filePath = pathSystem.join(currentDir, fileName);
            var statDetails = fileSystem.statSync(filePath);

            // Is it a file?
            if (statDetails.isFile())
            {
                // Add the file name to the return array.
                aryFilesFound.push(fileName);
            }
            else
            {
                // Is recursive descent requested?
                if (bRecurse)
                    // Descend.
                    readFilesSync(filePath);
            } // else - if (statDetails.isFile())
        } // function( fileName )
    ); // foreach()

    // Return the list of files we found.
    return aryFilesFound;
} // function readFilesSync(startDir, bRecurse)

// This function returns TRUE if the value is an integer, FALSE if it is not
//  including if it is not a number either.
function isInteger(value)
{

    var er = /^-?[0-9]+$/;

    return er.test(value);
}

function buildNameValuePair( name, value )
{
    return name + '=' + value;
}

function truncateString(str, maxLen)
{
    if (str.length > maxLen)
        return str.substring(0, maxLen - 1) + '&hellip;';
    return str;
}

// This method returns TRUE if the current environment variable settings indicate that
//  we are on our local Linux development station.  Otherwise FALSE is returned.
function isDevEnv()
{
    if (typeof process.env.LINUX_DEV == undefined || process.env.LINUX_DEV == null)
        // Not on development Linux station.
        return false;

    // Is the environment variable set to the value TRUE?
    let bIsDevEnv = process.env.LINUX_DEV === 'true';

    return bIsDevEnv;
}


// This function takes a Javascript "associative array" (which
//  actually is just an Object), and returns a string that
//  that has each array element as a properly formed and
//  encoded URL parameter, suitable for a GET request.
//
// IMPORTANT: Since we don't know if there are other URL
//  parameters before this, it is the CALLER's responsibility
//  to prepend a "?" or "&" character as appropriate before
//  appending the URL parameters string to the main URL.
function nvpArrayToUrlParameters(aryNvp)
{
    var emptyResult = "(none)";

    if (typeof aryNvp == 'undefined' || aryNvp == null)
        return emptyResult;

    var strRet = "";

    var aryKeys = Object.keys(aryNvp);

    if (aryKeys.length < 1)
        return emptyResult;

    for (var i = 0; i < aryKeys.length; i++)
    {
        if (i > 0)
            strRet += "&";
        strRet += aryKeys[i] + "=" + encodeURIComponent( aryNvp[aryKeys[i]]);
    }

    return strRet;

}

/**
 * This function returns TRUE if and only if the input parameter is an Object
 *  AND it has at least one property or more.
 *
 * @param obj - The parameter to inspect.
 *
 * @returns {boolean} - See function header.
 */
function isObjectWithoutProperties(obj) {
    if (typeof obj == 'object')
        return (Object.keys(obj).length < 1);

    // Input parameter is not an object, or it is an
    // object that DOES have properties.
    return false;
}

/**
 * Simple function to take an Object and return a string usable for HTTP GET
 *  requests that properly represents the name-value pairs that can be
 *  derived from the Object's properties.
 *
 * NOTE: Passing in an Object with compound or nested properties will
 *   produce unpredictable results!
 *
 * NOTE: A leading "?" or "&" character is NOT prepended to the returned
 *  string.  It is the caller's responsibility to do that.
 *
 * @param {object} obj - An object.
 *
 * @return {string} - A string suitable for use with an HTTP GET request URL.
 */
function objectToUrlArguments(obj)
{
    var retVal = "";

    if (isUnassignedObject(obj))
        return retVal;

    if (isObjectWithoutProperties(obj))
        return retVal;

    var aryKeys = Object.keys(obj);

    for (var ndx = 0; ndx < aryKeys.length; ndx++)
    {
        var key = aryKeys[ndx];

        var value = obj[key];

        if (ndx > 0)
            // Add URL argument delimiter.
            retVal += "&";

        retVal += key.trim() + "=" + value.trim();
    } // for (var ndx = 0; ndx < aryKeys.length; ndx++)

    return retVal;
}

/**
 * This function returns a promise that makes an HTTP request using the given parameters.
 *
 * NOTE: Currently we only know how to handle GET and POST requests.  Specifying any other
 *  method will result in an error being thrown.
 *
 * NOTE: The JSON format flag will be set to TRUE during the request.
 *
 * @param {HttpMethodsEnum} httpMethod - The HTTP method to use.  (e.g. - GET, POST, etc.)
 * @param {string} url - The URL to use in the HTTP request.
 * @param {string} request - A valid Node.JS request object.
 * @param {array} headersToUse - The headers to use while making the request.
 * @param {object} bodyPayload - The payload to put in the body request.
 *
 * @returns {promise} - A promise that executes the desired request.
 */
function makeHttpAsyncRequest_promise(httpMethod, url, request, headersToUse, bodyPayload)
{
    let errPrefix = "(" + arguments.callee.name + ") ";

    if (isEmptyString(url))
        throw new Error(errPrefix + "The URL parameter is empty.");

    if (isUnassignedObject(request))
        throw new Error(errPrefix + "The request object parameter is unassigned.");

    if (isUnassignedObject(headersToUse))
        throw new Error(errPrefix + "The object containing the headers to use is unassigned..");

    if (isUnassignedObject(bodyPayload))
        throw new Error(errPrefix + "The request body payload object parameter is unassigned.");

    if (httpMethod == http_methods_enum.default.GET)
    {
        // Return a promise that makes an asynchronous GET request.

        // Convert the Angelina payload object to a GET request suitable string
        //  of URL arguments.
        let fullUrl = url + "?" + objectToUrlArguments(bodyPayload);

        console.info(errPrefix + "Making HTTP GET request using the following URL: " + fullUrl);

        return request.getAsync(fullUrl,
            {
                json: true,
                headers: headersToUse,
                body: bodyPayload
            });
    }
    else if (httpMethod == http_methods_enum.default.POST)
    {
        console.info(errPrefix + "Making an HTTP POST request using the following URL: " + url);

        // Return a promise that makes an asynchronous POST request.
        return request.postAsync(url,
            {
                json: true,
                headers: headersToUse,
                body: bodyPayload
            });

    }
    else
    {
        // We only know how to handle HTTP GET and POST requests, for now.
        throw new Error(
            errPrefix
            + "The HTTP method is neither GET or POST.  We only know how to handle those two methods now.  Method requested: "
            + httpMethod.toString());
    }
}

/**
 * Consolidated handling of a promise rejection.  This function will print a log message
 *  using the given caller and log message parameters, and then call the given reject
 *  function with the desired object given in the objResponse parameter.
 *
 *  NOTE: The "resolve" function is not currently used, but might be later if we
 *   create code that converts a reject attempt to a resolve attempt, based on
 *   some advanced recovery strategy we might create later.
 *
 * @param {string} caller - An informational message indicating who is calling myRejectPromise.
 * @param {string} logMessage - An informational message that indicates the reason for the
 * @param {object} objResponse - The object that will be embedded in the error object
 *  we will pass to the reject function.  The embedded field name will be: response_object.
 * @param {function} resolve - The promise's resolve function.
 * @param {function} reject - The promise's reject function.
 *
 */
function myRejectPromise(caller, logMessage, objResponse, funcResolve, funcReject)
{
    console.warn(
        caller + " -> rejected the promise with the message:"
        + logMessage);

    // Reject the promise if we have a valid reject function.
    if (isUnassignedObject(funcReject))
        // No recursive errors.  Just log the fact we don't have a valid rejection function.
        console.warn("Invalid rejection function parameter given.  The Promise can not be rejected!");
    else
    {
        var errMsg = caller + logMessage;
        var err = new Error(errMsg);
        err.response_object = objResponse;

        console.error("[Promise Rejection] " + errMsg);

        // Call the given rejection function with our error object.
        funcReject(err);
    }
}

/**
 * Simple function to unbackslash quotes that have been backslashed, like when ChatSript
 *  returns a JSON object in string format.
 *
 * @param {string} str - The string to unbackslash.
 *
 * @returns {string} The string the backslash character removed from backslashed quotes.
 */
function unbackslashQuotes(str)
{
    if (isEmptyString(str))
        return str;

    return str.replace(/\\"/g, '"');
}

/**
 * This function returns if the given object is an array, FALSE if not.
 *
 * @param obj - The object to inspect.
 *
 * @returns {boolean} Returns TRUE if the object is an array, FALSE in all other cases.
 */
function isArray(obj)
{
    if (typeof obj == 'undefined' || obj == null)
        return false;

    return (Object.prototype.toString.call(obj) == '[object Array]');
}

/**
 *   Gets the user ID from the cookie store for those apps that create a
 *   an anonymous user ID on the client side.  Throws an error if not found.
 *
 *   @param {Object} req - A valid Express request object.
 *
 *   @return {string}
 */
function getUserIdOrError(req)
{
    // If we don't have a user ID then something is very wrong.
    //
    // Parse the cookies found in the request header.
    if (typeof req.cookies.uuid == 'undefined' || req.cookies.uuid.length < 1)
        throw new Error('Missing user ID.');

    return req.cookies.uuid;
}

/**
 * Use this function in apps/routes that require a user ID but are content
 *  with having one created on the client side automatically for a user.
 *
 * @param {Object} req - A valid Express request object.
 * @param {Object} res - A valid Express result object.
 *
 */
function checkCookiesForClientSideUserId(req, res) {
    // Make sure a UUID exists for this user in the cookie store.
    //  If not, create one and store it.
    //
    // Parse the cookies found in the request header.
    var userID = req.cookies.uuid;

    // Got a UUID?
    if (typeof userID == 'undefined' || userID.length < 1)
        // No, create one and set it.
        res.cookie('uuid', uuidV4());
}

/**
 * The Express request body object does not inherit from Object.prototype.  Therefore,
 * 	the "hasOwnProperty" function is not defined for it.  This function uses the
 * 	Object.prototype hasOwnProperty function to do the same thing.
 *
 * @param {Object} req - A valid Express request object.
 * @param {string} propName - The property name to check for.
 *
 * @return {boolean} - Returns TRUE if the request body object has the given property
 * 	name, FALSE if not.
 */
function hasOwnProperty_request_body(req, propName) {
    let errPrefix = '(hasOwnProperty_request_body) ';

    if (!req)
        throw new Error(errPrefix + 'The Express request object is unassigned.');

    if (!Object.prototype.hasOwnProperty.call(req, "body"))
        throw new Error(errPrefix + 'The Express request object does not have a "body" property.');

    if (typeof propName != 'string' || propName.length < 1)
        throw new Error(errPrefix + 'The propName parameter is empty.');

    return Object.prototype.hasOwnProperty.call(req.body, propName);
}

/**
 * This helper function transfers all the properties found in the given auxiliary
 * 	object to the destination object.
 *
 * @param {Object} objAuxArgs - The auxiliary arguments object.
 * @param {Object} destObj - The destination object.
 *
 * @return {Object} - The destination object is returned with the properties belonging
 * 	to the auxiliary object transferred to it.
 *
 * NOTE: The auxiliary object must NOT any of the property names reserved for use
 * 	by a standard error object. (See the body of this function for a list of these
 * 	property names).
 */
function transferAuxObjPropsToObj(objAuxArgs, destObj) {
    let errPrefix = '(transferAuxObjPropsToObj) ';

    if (!objAuxArgs || typeof objAuxArgs != 'object')
        throw new Error(errPrefix + 'The auxiliary object is unassigned or is not of type "object".');
    if (!destObj || typeof destObj != 'object')
        throw new Error(errPrefix + 'The destination object is unassigned or is not of type "object".');

    // Add the properties of the auxiliary arguments object to the return object.
    for (let propKey in objAuxArgs) {
        // Auxiliary objects MUST NOT contain either an "is_error" property or a "message" property.
        if (propKey == 'is_error')
            throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "is_error".');
        if (propKey == 'is_error_shown_to_user')
            throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "is_error_shown_to_user".');
        if (propKey == 'message')
            throw new Error(errPrefix + 'Auxiliary objects MUST NOT contain property named "message".');

        destObj[propKey] = objAuxArgs[propKey];
    }

    return destObj;
}

/**
 * Returns the value of the desired environment variable or throws an error if
 *  there is no environment variable with the given name.
 *
 * @param {string} envVarName - The name of the desired environment variable.
 * @param {boolean} bTrimIt - If TRUE, the environment variable value will be
 *  trimmed before being returned.  Otherwise it won't be.
 *
 * @return {string} - The value of the environment variable with the given name.
 */
function getEnvironmentVarOrError(envVarName, bTrimIt = true) {
    let errPrefix = '(getEnvironmentVarOrError) ';

    // let envVarValue = process.env[envVarName];
    let envVarValue = getEnvironmentVariableByName(envVarName);

    if (typeof envVarValue === 'undefined' || envVarValue == null)
        throw new Error(
            errPrefix
            + 'There is no environment variable with the name: '
            + envVarName
            + ', or this is dev and there was no DEV_ equivalent.');

    if (isEmptyString(envVarValue))
        throw new Error(errPrefix + 'The following environment variable is empty: ' + envVarName);

    if (bTrimIt)
        envVarValue = envVarValue.trim();

    return envVarValue;
}

/**
 * Simple helper function that returns a JSON object that indicates an error occurred
 *  in a conformed format.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {String} theErrorMessage - An error message to return with the object.
 * @param {boolean} [isErrorShownToUser] - Set this to TRUE if you want the error message
 * 	to be shown to the user if this error is something the user can or needs to handle.
 * 	Set it to FALSE if not.  If not given, the default of FALSE will be used (i.e. - not
 * 	shown to the user).
 * @param {Number} [httpStatusCode] - The HTTP error code to send back.  If one
 *  is not provided, an HTTP OK will be returned.
 * @param {Object} [objAuxArgs] - An optional object containing extra data to be returned to the client.
 *
 * NOTE: The response returned carries an HTTP OK status code.
 */
function returnStandardErrorObj(req, res, theErrorMessage, isErrorShownToUser, httpStatusCode, objAuxArgs)
{
    let errPrefix = '(returnStandardErrorObj) ';

    if (typeof req == 'undefined' || req == null)
        throw new Error(errPrefix + 'The request object is unassigned.');

    if (typeof res == 'undefined' || res == null)
        throw new Error(errPrefix + 'The response object is unassigned.');

    if (!theErrorMessage || theErrorMessage.length < 1)
        throw new Error(errPrefix + 'The error message is empty.');

    if (typeof httpStatusCode == 'undefined' || httpStatusCode == null)
        httpStatusCode = http_status_codes.OK;

    // If we have been given a value for the isErrorShownToUser parameter, it must be boolean and
    //  the HTTP status code to return parameter must be an HTTP OK.
    if (isErrorShownToUser) {
        if (typeof isErrorShownToUser != 'boolean')
            throw new Error(errPrefix + 'An isErrorShownToUser parameter has been provided but it is not of type "boolean".');

        // If we are showing an error to the user, then we should ONLY return an HTTP status code of
        //  of HTTP OK, otherwise the client will think it's a catastrophic error.
        if (httpStatusCode != http_status_codes.OK)
            throw new Error(errPrefix + 'The isErrorShownToUser flag is set to TRUE, but the HTTP status code to return is not that of HTTP OK.');
    }
    else {
        // The default value is FALSE.
        isErrorShownToUser = false;
    }

    const errorObj = {
        is_error: true,
        is_error_shown_to_user: isErrorShownToUser,
        message: theErrorMessage
    }

    // If we have an auxiliary object, transfer it's properties to the JSON object we are returning.
    if (objAuxArgs)
        transferAuxObjPropsToObj(objAuxArgs, errorObj);

    res.status(httpStatusCode).send(errorObj);
}

/**
 * Simple helper function that returns a JSON object that indicates successfulConfirmation
 *  in a conformed format.
 *
 * @param {Object} req - An Express request object.
 * @param {Object} res - An Express response object.
 * @param {String} theMessage - A simple message to return with the object.
 * @param {Object|null} [objAuxArgs] - An optional object containing extra data to be
 * 	returned to the client.
 */
function returnStandardSuccessJsonObj(req, res, theMessage, objAuxArgs) {
    let errPrefix = '(returnStandardSuccessJsonObj) ';

    if (typeof req == 'undefined' || req == null)
        throw new Error(errPrefix + 'The request object is unassigned.');

    if (typeof res == 'undefined' || res == null)
        throw new Error(errPrefix + 'The response object is unassigned.');

    if (!theMessage || theMessage.length < 1)
        throw new Error(errPrefix + 'The message is empty.');

    let bHaveAuxObj = false;

    // If we have a value for the auxiliary object parameter, make sure it an object or NULL.
    if (typeof objAuxArgs !== 'undefined' && objAuxArgs != null) {
        if (typeof objAuxArgs != 'object')
            throw new Error(errPrefix + ' The auxiliary object parameter is not undefined or NULL, but does not contain a value of type "object" either.');

        bHaveAuxObj = true;
    }

    var retJsonObj = {
        is_error: false,
        is_error_shown_to_user: false,
        message: theMessage,
    }

    // If we have an auxiliary object, transfer it's properties to the JSON object we are returning.
    if (bHaveAuxObj)
        transferAuxObjPropsToObj(objAuxArgs, retJsonObj);

    res.status(http_status_codes.OK).send(retJsonObj);
}

/**
 * This function returns TRUE if the string is considered "empty" in any way or invalid.
 * 	Otherwise FALSE is returned indicating it's a valid non-empty string.
 * @param str
 */
function isEmptyOrInvalidString(str) {
    let bIsInvalid =
        (typeof str == 'undefined'
            || str == null
            || typeof str !== 'string'
            || str.length < 1);

    return bIsInvalid
}

/**
 * This function splits a word by spaces and then returns all the words in the
 *  sentence in an array, after trimming each word.  Empty words are not
 *  added to the result array.
 *
 * @param {string} str - The string to split.
 * @param {string} [strDelim] - The string to use as the delimiter for splitting
 * 	the target string.  If not specified, then a SPACE character will be used
 * 	as the delimiter
 *
 * @return {Array<string>} - Returns an array of strings created by splitting
 * 	the string using the given delimiter and trimming each element along
 * 	the way.
 */
function splitAndTrimString(str, strDelim=' ')
{
    let errPrefix = '(splitAndTrimString) ';

    let bIsInvalidString = isEmptyOrInvalidString(str);

    if (bIsInvalidString)
        throw new Error(errPrefix + 'The str parameter is empty.');

    let aryRetStrings = new Array();

    if (isEmptyOrInvalidString(strDelim))
        throw new Error(errPrefix + 'The delimiter string is empty or invalid.');

    str.split(strDelim).map(
        function(word)
        {
            if (!isEmptyOrInvalidString(word))
                aryRetStrings.push(word.trim());
        });

    return aryRetStrings;
}

/**
 * Parses a comma delimited list of name=value pairs into an associative array
 * 	where the array key is the name field and the array value for that key is
 * 	the value field.
 *
 * WARNING!: This function does not know how to handle quoted value fields!
 *
 * @param {string} strNameValuePairList - comma delimited list of name=value
 * 	pairs in string format.
 */
function nameValuePairListToAssociativeArray(strNameValuePairList) {
    let errPrefix = '(nameValuePairListToAssociativeArray) ';

    if (isEmptyOrInvalidString(strNameValuePairList))
        throw new Error(errPrefix + 'The strNameValuePairList parameter is empty or invalid');

    let retArray = new Array();

    let aryElements = splitAndTrimString(strNameValuePairList, ',');

    for (let ndx = 0; ndx < aryElements.length; ndx++) {
        let aryNameValue = splitAndTrimString(aryElements[ndx], '=');

        if (aryNameValue.length != 2)
            throw new Error(errPrefix + 'Invalid name=value pair format: ' + aryElements[ndx]);

        retArray[aryNameValue[0]] = aryNameValue[1];
    }

    return retArray;
}

/**
 * We need dummy objects for the Express request and response objects since this
 * 	method is called from app.js and not from a request, and some of the code
 * 	we call requires these objects.  We create a "locals" property for the
 * 	response object since the code that uses the Express objects expects that
 * 	property to be there, like it would if these object had been created
 * 	by a request.
 *
 * @constructor
 */
function DummyExpressReqResObject() {
    const self = this;
    let methodName = self.constructor.name + '::' + 'constructor';
    let errPrefix = '(' + methodName + ') ';

    this.dummyExpressReq = new Object();
    this.dummyExpressRes = new Object();

    this.dummyExpressRes.locals = new Object();
}

/**
 * This function gets the value of the environment variable
 * 	with the given name.  However, if there is an environment
 * 	variable that has the same name but prefixed with the
 * 	DEV_ extension, AND we are in development, the value
 * 	of that variable will be returned instead.
 *
 * @param {string} envVarName - The name of the desired
 * 	environment variable.
 *
 * @return {string} - Return the current value of the
 * 	desired environment variable.
 */
function getEnvironmentVariableByName(envVarName) {
    let errPrefix = '(getEnvironmentVariableByName) ';

    // Do we have a DEV_ equivalent?
    let devEnvVarName = 'DEV_' + envVarName;

    if (isDevEnv() && process.env[devEnvVarName])
        return process.env[devEnvVarName];
    else
        return process.env[envVarName];
}

/**
 * Convert a value in milliseconds in to HH:MM:SS.mmm
 *
 * @param {number} milliseconds - The milliseconds in milliseconds
 *
 * @return {string} - The milliseconds value portrayed in
 * 	HH:MM:SS.mmm format.
 */
function millisecondsToFriendlyTimeFormat(milliseconds) {
    let remainingMilliseconds = parseInt((milliseconds % 1000) / 100)
        , seconds = parseInt((milliseconds / 1000) % 60)
        , minutes = parseInt((milliseconds / (1000*60)) % 60)
        , hours = parseInt((milliseconds / (1000*60*60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + remainingMilliseconds;
}

/**
 * Format the string value with all contiguous spaces replaced with a single
 *	space, converted to lowercase, and if desired padded with spaces
 *	to a fixed length, and if desired, trimmed.
 *
 * @param {string} strValue - A valid key name.
 * @param {boolean} [bTrimIt] - If TRUE, the resulting value will be trimmed,
 * 	otherwise it won't be.
 * @param {number|null} [ maxLen ] - Optional parameter.  If provided,
 * 	this is the maximum length allowed for the value and also is used
 * 	to force the length of the return value to value given by padding it
 * 	at the end with spaces.  If omitted, the padding and length check
 * 	operations will be omitted.
 *
 * @return {string} - The properly formatted string value that can be
 * 	used properly in an DynamoDB index.
 */
function formatStrValueAsDynamoDbKey(strValue, bTrimIt = true, maxLen = null) {
    let errPrefix = '(formatStrValueAsDynamoDbKey) ';

    if (isEmptyOrInvalidString(strValue))
        throw new Error(errPrefix + 'The strValue parameter is empty.');

    if (typeof bTrimIt !== 'boolean')
        throw new Error(errPrefix + 'The bTrimIt parameter is not boolean.');

    // If the maxLen parameter is not NULL, then it must be a number.
    if (maxLen !== null && typeof maxLen !== 'number')
        throw new Error(errPrefix + 'The maxLen parameter is not NULL, but is not a number either.');

    if (maxLen !== null) {
        // Validate the length of the string.
        if (strValue.length >= maxLen)
            throw new Error(errPrefix + 'The strValue parameter is too long.');
    }

    let keyValue =
        strValue
            .replace(/ +/g, ' ')
            .toLowerCase();

    if (maxLen !== null)
        keyValue = keyValue.padEnd(maxLen);

    if (bTrimIt)
        keyValue = keyValue.trim();

    return keyValue;
}

/**
 * This function pulls out the desired field from a POST request, with deep property
 * 	chain inspection along the way.  The field must not be empty either.
 *
 * 	@param {Object} req - A valid Express request object.
 * 	@param {string} fieldName - The field name to extract.
 * 	@poram {number} maxLen - The maximum length the field can be.
 * 		The default maximum length is 1024 characters.
 */
function getFieldFromPostData(req, fieldName, maxLen = 1024) {
    let errPrefix = 'getFieldFromPostData';

    if (!req)
        throw new Error(errPrefix + 'The Express request object is unassigned.');

    if (!hasOwnProperty_request_body(req, fieldName))
        throw new Error(errPrefix + 'The Express request object body property does not contain a field named: ' + fieldName);

    let fieldValue = req.body[fieldName].trim();

    if (fieldValue.length < 1)
        throw new Error(errPrefix + 'The ' + fieldName + ' field is empty.');

    if (fieldValue.length > 1024)
        throw new Error(errPrefix + 'The ' + fieldName + ' field is too long.');

    return formatStrValueAsDynamoDbKey(fieldValue);
}



// Common code shared by other Javascript source files in this project.
module.exports =
    {
        buildJsonDataFileUri: buildJsonDataFileUri,
        buildJsonDataFileUri_articles: buildJsonDataFileUri_articles,
        buildJsonDataZipUri: buildJsonDataZipUri,
        buildNameValuePair: buildNameValuePair,
        checkCookiesForClientSideUserId: checkCookiesForClientSideUserId,
        DummyExpressReqResObject: DummyExpressReqResObject,
        formatStrValueAsDynamoDbKey: formatStrValueAsDynamoDbKey,
        getEnvironmentVariableByName: getEnvironmentVariableByName,
        getEnvironmentVarOrError: getEnvironmentVarOrError,
        getPublicDataDirectory: getPublicDataDirectory,
        getOrCreateTempDir: getOrCreateTempDir,
        getUserIdOrError: getUserIdOrError,
        nvpArrayToUrlParameters: nvpArrayToUrlParameters,
        readFilesSync: readFilesSync,
        hasOwnProperty_request_body: hasOwnProperty_request_body,
        isInteger: isInteger,
        getFieldFromPostData: getFieldFromPostData,
        getUserIdOrError: getUserIdOrError,

        truncateString: truncateString,
        isDevEnv: isDevEnv,

        removeAllLinks: removeAllLinks,
        isEmptyString: isEmptyString,
        isUnassignedObject: isUnassignedObject,
        //endPromiseChainWithThisPromise: endPromiseChainWithThisPromise,
        //endPromiseChainNow: endPromiseChainNow,
        isObjectWithoutProperties: isObjectWithoutProperties,
        isArray: isArray,
        makeHttpAsyncRequest_promise: makeHttpAsyncRequest_promise,
        millisecondsToFriendlyTimeFormat: millisecondsToFriendlyTimeFormat,
        myRejectPromise: myRejectPromise,
        // noopIt: noopIt,
        objectToUrlArguments: objectToUrlArguments,
        transferAuxObjPropsToObj: transferAuxObjPropsToObj,
        unbackslashQuotes: unbackslashQuotes,

        nameValuePairListToAssociativeArray: nameValuePairListToAssociativeArray,
        splitAndTrimString: splitAndTrimString,
        returnStandardErrorObj: returnStandardErrorObj,
        returnStandardSuccessJsonObj: returnStandardSuccessJsonObj,
        isEmptyOrInvalidString: isEmptyOrInvalidString
    };


