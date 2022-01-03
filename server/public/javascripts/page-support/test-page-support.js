// Javascript page support code for the test page view.

let errPrefix = 'test';

// const common_routines = require('../../../common/common-routines');
// const AppObject = require('../app-object').AppObject;
// const youtubeSupport = require('../../../common/youtube-api-support').YouTubeSupport;
let youtubeSupport = YouTubeSupport;

// Last video player state in case an operation needs to restore it after pausing the video, etc.
let g_LastVideoPlayerState = null;

// When the user marks a video location during game play, that value will be put here.
let g_VideoLocationChosen = 0;

// The URL arguments that were passed to this web page.
let g_urlArgs = null;

// IF a track is currently being recorded, this variable will
//  contain its track number.  Otherwise, it should contain NULL.
let g_TrackNumBeingRecorded = null;

/**
 * Navigate to the search for videos page.
 */
function doNavigateToVideoSearchPage()
{

    let errPrefix = `(doNavigateToVideoSearchPage) `;

    let currentUrl = new URL(document.location.href).origin;
    let searchForVideosUrl = new URL('./search-for-videos', currentUrl);

    searchForVideosUrl.searchParams.set(AuxGameConstants.URL_ARG_GAME_ID, global.appObject.gameDetailsObj.id);

    window.location.href = searchForVideosUrl.href;
}

/**
 *
 * This is the generic method that rebuilds an object of a certain type from a plain
 * 	JSON Object returned by the server.
 *
 * @param {Object} response - The object returned by a call to the server.
 * @param {string} operationDesc - A simple description of the operation.  Used for
 * 	logging purposes.
 * @param objOfType - The type name of the object to create.  It must have a parameterless
 * 	constructor.
 * @param {string} propName - The name of the property in the server response object that
 * 	contains the object in plain JSON format.
 * @param {string} validationType - The type of validation to perform on the reconstituted
 * 	object. The default is advanced validation.  See the EnumValidateMeTypes enumeration for details.
 *
 * @return - Returns the object the server gave us as a response.
 **/
function recoverObjectFromServerResponse(response, operationDesc, objOfType, propName, validationType = EnumValidateMeTypes.ADVANCED_VALIDATION) {
    let methodName = 'recoverGameDetailsObjFromServerResponse';
    let errPrefix = '(' + methodName + ') ';

    if (typeof response == 'undefined' || response == null)
        throw new Error(errPrefix + ' The response object is unassigned.');

    if (misc_shared_lib.isEmptySafeString(operationDesc))
        throw new Error(errPrefix + ' The operation description is empty.');

    if (misc_shared_lib.isEmptySafeString(propName))
        throw new Error(errPrefix + ' The property name is empty.');

    // Check for an error response.
    if (response.hasOwnProperty('error') && misc_shared_lib.isTrueOrStrTrue(response.error))
    {
        let errMsg = operationDesc + ' failed, please contact the server administrator.';
        'Invalid response from server during ' + operationDesc + ', please contact the server administrator.'

        throw new Error(errPrefix + errMsg);
    }

    if (!response.hasOwnProperty(propName))
    {
        let errMsg = 'Invalid response from server during ' + operationDesc + ', please contact the server administrator.'
        alert(errMsg);
        throw new Error(errPrefix + errMsg);
    }

    // If the operation succeeded the server will return the update game object.
    let plainJsonObj = response[propName];

    // return reconstitute_lib.reconstituteObjectOfType(methodName, plainJsonObj, objOfType, validationType);

    // Return the plain JSON object.
    return plainJsonObj;
}

/**
 * This method recovers a game details object passed back from the server
 * 	in plain JSON object format, if the API call that generated that response
 * 	returns one.
 *
 * @param {Object} response - The JSON object returned from the server in response
 * 	to an API request on our part.
 * @param {string} operationDesc - The operation type that was attempted.  Used
 * 	for building error messages.
 *
 * @return {Object} - A validated Game Details object or an error message
 * 	will be thrown if a problem occurred.  A suitable error message will be
 * 	shown to the user too in some cases.
 */
function recoverGameDetailsObjFromServerResponse(response, operationDesc)
{
    var errPrefix = '(recoverGameDetailsObjFromServerResponse) ';

    return recoverObjectFromServerResponse(response, operationDesc, GameDetails, GameDetailsConstants.PROP_NAME_GAME_DETAILS_OBJECT);
}

/**
 * Restore the most recently used game details found in the user's cookie
 *  store if any.
 */
function restoreGameDetails()
{
    var strGameDetailsObj = getCookieValue(GameDetailsConstants.PROP_NAME_GAME_DETAILS_OBJECT);

    if (!goog.string.isEmptySafe(strGameDetailsObj) && strGameDetailsObj != "null")
    {
        var bandDonationPercentageSlider = $("input.band-donation-percentage-slider").slider();

        var gameDetailsObj = JSON.parse(strGameDetailsObj);

        // Reload the input fields from the game details object.
        $('#game-title-input').val(gameDetailsObj.titleForGame);
        $('#entry-fee-input').val(gameDetailsObj.entryFee);
        // $('#ethereum-public-address-input').val(gameDetailsObj.gameCreatorEthereumPublicAddress);
        bandDonationPercentageSlider.slider('setValue', gameDetailsObj.bandDonationPercentage);
        // $('#band-donation-percentage-input').val(gameDetailsObj.bandDonationPercentage);
        $('#game-title-input').val(gameDetailsObj.titleForGame);
        $('#chat-room-name-input').val(gameDetailsObj.screenName);
    }
}

/**
 * Initialize the linked video sink slider.
 *
 */
function initializeLinkedVideoSinkSlider() {

    // Create the linked video seek slider.
    const linkedVideoSeekPercentageSlider = $("input.linked-seek-slider").slider();

    // Linked video seek slider.
    $('#linked-seek-slider-input').slider({
        formatter: function(currentSliderValue) {
            // Update attached value label.
            $('#linked-seek-slider-input-label').text(currentSliderValue + '%');

            // Tooltip value for slider.
            return 'Current value: ' + currentSliderValue;
        }
    });

    // Event that fires when a slider stops moving.
    $('#linked-seek-slider-input').on('slideStop', function(ev){
        let currentSliderValue = ev.value;
        let durationSecs = youtubeSupport.youtubePlayer.getDuration();
        let currentVideoId = youtubeSupport.youtubePlayer.videoId;

        let calculatedOffsetInSecs = (currentSliderValue * durationSecs) / 100;

        // Broadcast our new location over PubNub so other players can sync
        //  with us.
        global.appObject.pubnubClient.publishLinkedVideoSeekMessage(currentVideoId, calculatedOffsetInSecs, currentSliderValue);
    });

    // Linked video seek slider.
    $('#linked-2-seek-slider-input').slider({
        formatter: function(currentSliderValue) {
            // Update attached value label.
            $('#linked-2-seek-slider-input-label').text(currentSliderValue + '%');

            // Tooltip value for slider.
            return 'Current value: ' + currentSliderValue;
        }
    });

    // Event that fires when a slider stops moving.
    $('#linked-2-seek-slider-input').on('slideStop', function(ev){
        let currentSliderValue = ev.value;
        let durationSecs = youtubeSupport.youtubePlayer.getDuration();
        let currentVideoId = youtubeSupport.youtubePlayer.videoId;

        let calculatedOffsetInSecs = (currentSliderValue * durationSecs) / 100;

        // Broadcast our new location over PubNub so other players can sync
        //  with us.
        global.appObject.pubnubClient.publishLinkedVideoSeekMessage(currentVideoId, calculatedOffsetInSecs, currentSliderValue);
    });

}

/**
 * This method initialize the form elements for the enter game page.
 */
function initializeEnterGamePage()
{
    var errPrefix = '(initializeEnterGamePage) ';

    global.appObject.setPageTitle('Enter Game');

    if (typeof g_urlArgs == 'undefined' || g_urlArgs ==  null)
        throw new Error(errPrefix + 'The URL arguments parameter is unassigned.');

    // We must have a game ID, which should have been part of the invite link.
    var gameId = null;

    if (g_urlArgs.hasOwnProperty(AuxGameConstants.URL_ARG_GAME_ID))
    {
        gameId = g_urlArgs[AuxGameConstants.URL_ARG_GAME_ID];

        console.log(errPrefix + 'GAMEID: received with invite link -> ' + gameId);
    }

    var userDetailsObj = null;

    if (misc_shared_lib.isEmptySafeString(gameId))
    {
        var errMsg = 'Invalid or missing invite link.  Please contact the game creator for a new one.';
        alert(errMsg);
        throw new Error(errPrefix + errMsg);
    }

    initializeLinkedVideoSinkSlider();

    // The ENTER GAME button.
    $('#ge-enter-game-btn').click(
        function(e)
        {
            // Make sure the app global game details object is valid.
            if (!global.appObject.gameDetailsObj)
                throw new Error(errPrefix + 'The global game details object is unassigned.');

            global.appObject.gameDetailsObj.validateMe(EnumValidateMeTypes.SIMPLE_VALIDATION);

            // Validate the values.
            var videoId = youtubeSupport.youtubePlayer.videoId;

            if (misc_shared_lib.isEmptySafeString(videoId))
            {
                // TODO: Disable the create game button until a video has been selected.
                alert('Please select a video first.');
                return;
            }

            // Need to make sure the video details are available first.
            youtubeSupport.getCurrentVideoDetails_promise(videoId)
                .then(function(videoDetails)
                {
                    // Create a new user object.
                    userDetailsObj = new UserDetails();

                    userDetailsObj.screenName = $('#ge-chat-room-name-input').val();
                    userDetailsObj.gameId = global.appObject.gameDetailsObj.id;
                    userDetailsObj.videoIdSubmitted = youtubeSupport.youtubePlayer.videoId;
                    userDetailsObj.videoTitleSubmitted = videoDetails.title;

                    console.log(
                        errPrefix + 'Calling dPayEntryFee_promise() with the game ID field of the user details object set to -> ' + userDetailsObj.gameId);

                    // Have the user pay the entry fee.
                    return doPayEntryFee_promise(global.appObject.gameDetailsObj, userDetailsObj);
                })
                .then(result => {

                    // The result should be a simple TRUE response.
                    if (typeof result != 'boolean')
                        throw new Error(errPrefix + 'The result object returned after we paid to enter the game is not a boolean value.');

                    if (result !== true)
                        throw new Error(errPrefix + 'doPayEntryFee_promise() did not return TRUE .');

                    // Save the current game details in the cookie store.
                    saveUserDetails(global.appObject.userDetailsObj);

                    // Move on to the next step in the chain.
                    return(true);
                })
                /* Move to doPayEntryFee_promise() method.
                .then(function(result) {
                    // The Ethereum transaction that requests the adding of a new player
                    // 	game has been submitted to the Ethereum network successfully.
                    // 	Create an Ethereum transaction tracking object to track it.
                    //
                    // Now we register a promise to do the necessary post payment
                    // 	confirmation operations with the Ethereum transaction tracker.

                    // Register our Ethereum transaction tracker with the object that manages those.
                    let appEventId =
                        AppEventTracker.addSimpleFuncAsTransToBeTracked(
                            function(ethTransResult) {
                                // The game ID should be in the result field.
                                if (!ethTransResult.ethereumResult)
                                    throw new Error(errPrefix + 'The Ethereum transaction result object is missing the result field.');

                                // Reconstitute the user object from the one passed to us in the auxObj field.
                                if (!ethTransResult.auxObj)
                                    throw new Error(errPrefix + 'The auxObj field in the Ethereum transaction result object is missing the updated user object field.');

                                let updatedUserDetailsObj =
                                    reconstitute_lib.reconstituteUserDetailsObject(ethTransResult.auxObj);

                                if (!updatedUserDetailsObj.isEntryFeePaidAndConfirmed)
                                    throw new Error(errPrefix + 'Received entry payment transaction confirmation, but the user is still not considered as having made a valid entry fee payment.');

                                // TODO: Update the user details object with the one we just received.  Note, this
                                //  may already be happening when the in the PubNub client side code when
                                //  a user update broadcast is sent, if one is being sent.

                                // We don't do much here when we receive confirmation of the Ethereum payment for
                                //  the entry fee because the real work happens in response to the PubNub
                                //  broadcast that tells everyone the current user has paid their entry fee
                                //  and that the payment has been confirmed.
                                console.log(">>>>> Confirmation of our add player request transaction successfully received with result :");
                                console.log(ethTransResult.ethereumResult);

                                // Show the waiting for players quadrant.
                                global.appObject.showFormEntryHostDiv('form-waiting-for-players-host-div');
                                global.appObject.setPageTitle('Waiting for Players');
                            });

                    // Now it's time to wait for the Ethereum network to confirm our
                    //  add player transaction.  The server will notify us
                    //  via a PubNub broadcast when that happens (or it times out).
                    let postParamsObj = {
                        game_id_in_smart_contract: global.appObject.gameDetailsObj.idInSmartContract,
                        user_details_obj: userDetailsObj,
                        app_event_id: appEventId
                    };

                    // Ask the server to start checking for confirmation of our add player call.
                    let xhrRequest = xhrPost_promise('wait-for-entry-fee-confirmation-api', postParamsObj);

                    return xhrRequest;
                })
                .then(function(progressEvent) {
                    // Pull out the result object from the decorated XMLHttpRequest response.
                    let result = progressEvent.currentTarget.response;

                    if (result.error)
                        throw new Error(errPrefix + 'The server returned an error result.');

                    if (!result.game_details_obj)
                        throw new Error(errPrefix + 'Missing game details object from the server result.');
                })
                */
                .finally (function(){
                    // Save the current user details in the cookie store.
                    saveUserDetails(userDetailsObj);
                })
                .catch(function(err)
                {
                    // Validation failed.  Show the user the error message.
                    alert(err.message);
                    return;
                });
        });

    // The SELECT VIDEO button.
    $('#ge-select-video-button').click(
        function (e)
        {
            // Pause the video.
            if (youtubeSupport.youtubePlayer)
            {
                // Save the current video state.
                g_LastVideoPlayerState = youtubeSupport.youtubePlayer.getState();

                // Pause the video in case it is playing.
                youtubeSupport.youtubePlayer.pause();
            }

            // Jump to video search page.
            doNavigateToVideoSearchPage();
        });

    // Show the correct form quadrant content.
    global.appObject.showFormEntryHostDiv('form-guest-entry-host-div');

    // ---------------------------- MAIN BODY -----------------

    // Fire off the request for the game details object from the game server.
    try	{
        // ----------------------------- API: Get game details object ---------------------

        let postParamsObj = { game_id: gameId };

        let gameDetailsObj = null;

        // Ask the server to return the game details object for the game ID we were passed.
        let xhrRequest = xhrPost_promise(urlGetGameDetailApi, postParamsObj);

        xhrRequest
            .then(function(progressEvent) {
                // Pull out the response object from the decorated XMLHttpRequest response.
                let response = progressEvent.currentTarget.response;

                if (checkServerReturnForError(urlPrepareForGamePaymentApi, response))
                    // Reject the promise with the error message.  The operation failed.
                    throw new Error(errPrefix + response.message);

                gameDetailsObj = recoverGameDetailsObjFromServerResponse(response, urlGetGameDetailApi);

                // Validate it with advanced validation.
                gameDetailsObj.validateMe(EnumValidateMeTypes.ADVANCED_VALIDATION);

                // Store the game details object where everyone can find it.
                global.appObject.gameDetailsObj = gameDetailsObj;

                // Update all form elements that show the game details in read-only form.
                global.appObject.updateGameDetailsElements();

                // Show the enter game DIV, hide all others.
                global.appObject.showFormEntryHostDiv('form-guest-entry-host-div');
            })
            .catch(err => {
                // Convert the error to a promise rejection.
                let errMsg =
                    errPrefix + conformErrorObjectMsg(err);

                console.error(errMsg);

                throw new Error(errPrefix + errMsg + ' - promise');
            });
    }
    catch(err) {
        // Convert the error to a promise rejection.
        let errMsg =
            errPrefix + conformErrorObjectMsg(err);

        console.error(errMsg);

        throw new Error(errPrefix + errMsg + ' - try/catch');
    }

    // Hide all elements that belong only to the game creator.
    $('.game-creator').hide();
}

/**
 * This method initialize the form elements for this page..
 *
 */
function initializePage()
{
    let errPrefix = '(initializePage) ';

    initializeLinkedVideoSinkSlider();

    // The SELECT VIDEO button.
    $('#select-video-button').click(
        function (e)
        {
            // Pause the cukrrent video.
            if (youtubeSupport.youtubePlayer)
            {
                // Save the current video state.
                g_LastVideoPlayerState = youtubeSupport.youtubePlayer.getState();

                // Pause the video in case it is playing.
                youtubeSupport.youtubePlayer.pause();
            }

            // Jump to the video search page.
            doNavigateToVideoSearchPage();
        });
}

/**
 * This method is called by the YouTube support object
 *  whenever the video player emits a timeupdate event.
 *  In other words, whenever the video player's current
 *  time location changes.
 *
 * @param {Number} currentSeconds - The current offset
 *  in seconds from the start of the video.
 */
function doTimeUpdateProcessing(currentSeconds)
{
    let errPrefix = '(doTimeUpdateProcessing) ';

    if (currentSeconds < 0)
        throw new Error(errPrefix + 'currentSeconds < 0');

    console.log(`${errPrefix}: Current video location in seconds: ${currentSeconds}.`);

}

/**
 * This function is the on-click handler for the
 *  track avatar DIVs.
 *
 * @param event - The click event object.
 */
function onTrackAvatarClicked(event)
{
    let errPrefix = '(onTrackAvatarClicked) ';

    const divTrackAvatar = event.target;

    if (!divTrackAvatar)
    {
        console.error(`${errPrefix}: The event target is unassigned.`);
        return;
    }

    // Get the track number.
    //
    //  REMEMBER: The HTML "track-number" becomes the property trackNumber!.
    const trackNumber = divTrackAvatar.dataset.trackNumber;

    if (typeof trackNumber === 'undefined')
    {
        console.error(`${errPrefix}: The track number is unassigned.`);
        return;
    }

    // Toggle the track avatar DIVs "selected" class.
    divTrackAvatar.classList.toggle('selected');

    console.log(`${errPrefix}: Track number clicked: ${trackNumber}.`);
}

// ---------------------- DOCUMENT READY FUNCTION ------------------------

// JQuery document ready handler.
$(document).ready(function (){
    // Get the current URL arguments.
    g_urlArgs = getUrlArguments();

    // The copy to clipboard handler for any such buttons.
    $('.copy-to-clipboard').click(
        function(e)
        {
            // Get the ID of the source for text for the clipboard copy operation from
            //  the data attributes of the target.
            let srcTextId = $('#' + e.target.id).data('clipboard-source');

            if (misc_shared_lib.isEmptySafeString(srcTextId))
            {
                console.warn('Could not find a source text element ID for the clipboard copy operation');
                return;
            }

            copyToClipboard(srcTextId);
        });

    // ------------------- PLAYING GAME: Buttons ----------------

    $('#ge-mark-location-button').click(
        function(e){
            // Copy the current video time into the span that shows that value.
            let currentSeconds = youtubeSupport.youtubePlayer.getCurrentTime();
            let strTime = misc_shared_lib.secondsToHoursMinutesSecondsString(currentSeconds);
            $('#marked-video-location-span').text(strTime);

            g_VideoLocationChosen = currentSeconds;
        });

    $('#ge-submit-choice-button').click(
        function(e){
            let videoId = youtubeSupport.youtubePlayer.videoId;

            if (misc_shared_lib.isEmptySafeString(videoId))
                throw new Error('The YouTube player does not have a video ID assigned to it.');

            if (g_VideoLocationChosen < 0)
                throw new Error('The chosen video location is invalid.');

            // Need to make sure the video details are available first.
            youtubeSupport.getCurrentVideoDetails_promise(videoId)
                .then(function(videoDetails)
                {
                    // Change the title.
                    global.appObject.setPageTitle("VIDEO LOCATION CHOICE CONFIRMED!")

                    // Disable the mark location and submit choice buttons until the next
                    //  round of play.
                    disableButton($('.choose-loc'));

                    return doSubmitVideoLocationChoice_promise(videoDetails);
                });
        });

    $('#pick-video-select').change(function()
    {
        // If the video ID selected from the drop-down box does not match the one currently
        //  loaded in the player, publish a load-video message so everybody's players load
        //  this video.
        let afterPartyVideoId = $('#pick-video-select option:selected').val();

        if (!misc_shared_lib.isEmptySafeString(afterPartyVideoId))
        {
            // Broadcast our new video selection over PubNub so other players can sync
            //  with us.
            //
            // CURRENTLY NOT USED.
            // global.appObject.pubnubClient.publishLinkedVideoSeekMessage(afterPartyVideoId, 0, 0);
        }
    });

    // Initialize this page.
    initializePage();

    // Initialize the YouTube player.
    youtubeSupport.initializeYouTubePlayerAPI();

    // Load a video.  The yt-player instance will automatically load
    //  the video when it's ready.
    youtubeSupport.youtubePlayer.load("MqWpjpHKHlo");

    // Subscribe to timeupdate events for the player.
    youtubeSupport.addTimeUpdateListener(doTimeUpdateProcessing);

    // Assign the on-click handler for all the track avatar DIVs.
    $('.track-avatar').click(onTrackAvatarClicked);

    // Add drag-and-drop support.  Tell jQuery which elements
    //  you want to make draggable.
    $(function() {
        // Make all the video containers draggable.
        $( ".video-container" ).draggable(
            {
                // Change the class of an element when it is being dragged.
                start: function(e, ui) {
                    ui.helper.addClass("dragging");
                },
                // Remove that class when it is no longer being dragged.
                stop: function(e, ui) {
                    ui.helper.removeClass("dragging");
                },
                // Call our worker function that records the element
                //  movement during recording.
                drag: function(e, ui) {
                    // "this" pointer contains a reference to the element being dragged.
                    console.log(`Dragging occurred for element ID(${this.id}).  Current position - TOP: ${ui.position.top}, LEFT: ${ui.position.left}`);
                }
            });
        }
    );

    // 		// Load the video and play it.
    // 		youtubeSupport.youtubePlayer.load(gameDetailsObj.videoIdCurrentlyPlaying, true);
});