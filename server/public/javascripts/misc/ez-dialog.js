// This file contains code for executing dialog sessions
//  using a floating popup DIV.

// HTML element class name for CANCEL buttons.
const HTML_CLASS_NAME_CANCEL_BUTTON = "cancel-button";

// HTML element class name for OK buttons.
const HTML_CLASS_NAME_OK_BUTTON = "ok-button";

// Starting z-index for our popups.
const BASE_POPUP_Z_INDEX = 100;

// Div ID for the script block that contains the Handlebars template
//  for a default EZDialog HTML implementation.
const g_DefaultEzDialogTemplateDivId = 'default-ez-dialog-template';
const g_DefaultEzDialogTemplateDivId_selector = '#' + g_DefaultEzDialogTemplateDivId;

// Div ID for the DIV inside the Handlebars template for
//  the default EZDialog HTML implementation that holds
//  the bespoke HTML content.
// const g_DefaultEzDialogBespokeHtmlDivId = 'default-ez-dialog-bespoke-html-div';
// const g_DefaultEzDialogBespokeHtmlDivId_selector = '#' + g_DefaultEzDialogBespokeHtmlDivId;

// Default title for CANCEL buttons.
const DEFAULT_CANCEL_BUTTON_TITLE = 'CANCEL';

// Default title for OK buttons.
const DEFAULT_OK_BUTTON_TITLE = 'OK';

// A reference to the active easy dialog object will
//	will be placed here.
let g_ActiveEzDialogObj = null;

// A Handlebars object to build the default EZDialog HTML.
let g_DefaultEZDialogHtmlTemplate_handlebars = null;

// This variable keeps track of overlapping popups.
let g_CurrentPopupDepth = 0;

/**
 * This object holds the details for a dialog session
 *  that has an	OK and a a CANCEL button and uses a
 *  uses a floating popup DIV to facilitate the
 *  dialog session.  It is meant to be called from
 *  a Promise.
 *
 *  NOTE: After building an object like this,  call
 *  	the object's doDialogSession_promise() method
 *  	to execute the dialog session.
 *
 * @param {Object} relevantElementIdsObj - An object
 * 	containing the DOM element IDs needed by this
 * 	object to render the dialog.
 * @param {String} idOfOverlappedElem - The HTML element ID of the
 *  element the dialog should be positioned over.
 * @param {String} dialogTitle - The title to display at the top of
 * 	the dialog.
 * @param {String} htmlText - The HTML content to display in the body
 * 	of the floating popup DIV.
 * @param {Function} funcValidate - The function that should be
 * 	called when the OK button is clicked.  It should validate the
 * 	content the user entered, if any, and return TRUE if the content
 * 	validates properly, or a string containing an error message to
 * 	be shown the user if it did not.
 * @param {Boolean} bShowCancelButton - If TRUE, the CANCEL
 * 	button will be visible, otherwise it won't.
 * @param {String} [defaultCancelButtonTitle] - If the consumer of
 * 	this object did not provide the HTML for the CANCEL/OK
 * 	buttons, then we will provide a default implementation.
 * 	In that case, if this variable has a valid string
 * 	value, it will be used as the title for the
 * 	default CANCEL button implementation.
 * @param {String} [defaultOkButtonTitle] - If the consumer of
 * 	this object did not provide the HTML for the CANCEL/OK
 * 	buttons, then we will provide a default implementation.
 * 	In that case, if this variable has a valid string
 * 	value, it will be used as the title for the
 * 	default OK button implementation.
 * @param {Number} [dialogWidth] - The width in pixels
 * 	for the dialog form.  If NULL, then it will be
 * 	set to the default.
 * @param {Number} [dialogHeight] - The height in pixels
 * 	for the dialog form.  If NULL, then it will be
 * 	set to the default.
 */
function EZDialog(
		relevantElementIdsObj,
		idOfOverlappedElem,
		dialogTitle,
		htmlText,
		funcValidate,
		bShowCancelButton=true,
		defaultCancelButtonTitle=null,
		defaultOkButtonTitle=null,
		dialogWidth=null,
		dialogHeight=null) {
	const self = this;
	let methodName = self.constructor.name + '::' + `constructor`;
	let errPrefix = '(' + methodName + ') ';
	
	if (!misc_shared_lib.isNonNullObjectAndNotArray(relevantElementIdsObj))
		throw new Error(errPrefix + `The relevantElementIdsObj is not a valid object.`);
		
	// Validate all the IDs.
	for (let propKey in relevantElementIdsObj)
	{
		const propValue = relevantElementIdsObj[propKey];
		const jQuerySelector = misc_shared_lib.makeJQuerySelectorFromId(propValue);
		
		if (!misc_shared_lib.isValidJQuerySelector(jQuerySelector))
			throw new Error(errPrefix + `Invalid popup element ID: ${propValue}.`);
	}
	
	const jQuerySelectorForOverlappedElem = '#' + idOfOverlappedElem;
	
	const bIsOverlappedElemIdValid =
		misc_shared_lib.isValidJQuerySelector(jQuerySelectorForOverlappedElem);
	
	if (!bIsOverlappedElemIdValid)
		throw new Error(errPrefix + `Unable to find an HTML element with ID: ${idOfOverlappedElem}.  Does the overlaaped element exist?`);
	
	if (misc_shared_lib.isEmptySafeString(dialogTitle))
		throw new Error(errPrefix + `The dialogTitle parameter is empty.`);
		
	if (misc_shared_lib.isEmptySafeString(htmlText))
		throw new Error(errPrefix + `The funcHtmlBuilder parameter is empty.`);
		
	if (typeof funcValidate !== 'function')
		throw new Error(errPrefix + `The value in the funcValidate parameter is not a function.`);
		
	if (typeof bShowCancelButton !== 'boolean')
		throw new Error(errPrefix + `The value in the bShowCancelButton parameter is not boolean.`);
		
	if (defaultCancelButtonTitle !== null) {
		if (typeof defaultCancelButtonTitle !== 'string')
			throw new Error(errPrefix + `The value in the defaultCancelButtonTitle parameter is not NULL, yet it is not a string either.`);
		
		if (misc_shared_lib.isEmptySafeString(defaultCancelButtonTitle))
			throw new Error(errPrefix + `The defaultCancelButtonTitle parameter is not NULL and therefore should not be an empty string.`);
	}
	
	if (defaultOkButtonTitle !== null) {
		if (typeof defaultOkButtonTitle !== 'string')
			throw new Error(errPrefix + `The value in the defaultOkButtonTitle parameter is not NULL, yet it is not a string either.`);
		
		if (misc_shared_lib.isEmptySafeString(defaultOkButtonTitle))
			throw new Error(errPrefix + `The defaultOkButtonTitle parameter is not NULL and therefore should not be an empty string.`);
	}
		
	if (dialogWidth !== null) {
		if (typeof dialogWidth !== 'number')
			throw new Error(errPrefix + `The value in the dialogWidth parameter is not NULL, yet it is not a number either.`);
		
		if (dialogWidth <= 1)
			throw new Error(errPrefix + `The dialog width is less than 1.`);
	}
	
	if (dialogHeight !== null) {
		if (typeof dialogHeight !== 'number')
			throw new Error(errPrefix + `The value in the dialogHeight parameter is not NULL, yet it is not a number either.`);
		
		if (dialogHeight <= 1)
			throw new Error(errPrefix + `The dialog height is less than 1.`);
	}
	
	// If the Handlebars template for the default HTML implementation
	//  has not been compiled yet, do so now.
	if (!g_DefaultEZDialogHtmlTemplate_handlebars) {
		console.info(errPrefix + `Compiling the Handlebars template for the default HTML implementation using jQuery selector: ${g_DefaultEzDialogTemplateDivId_selector}.`);
		
		if (!misc_shared_lib.isValidJQuerySelector(g_DefaultEzDialogTemplateDivId_selector))
			throw new Error(errPrefix + `Invalid jQuery selector for the default HTML handlebars template: ${g_DefaultEzDialogTemplateDivId_selector}.`);
		
		// Compile the handlebars templates we use for later use.
		g_DefaultEZDialogHtmlTemplate_handlebars = Handlebars.compile($(g_DefaultEzDialogTemplateDivId_selector).html())
	}
		
	/** @property {string} - A randomly generated unique ID for this object. */
	this.id = misc_shared_lib.getSimplifiedUuid();
	
	/** @property {Date} - The date/time this object was created. */
	this.dtCreated = Date.now();
	
	/** @property {Object} relevantElementIdsObj - An object
	 * 	containing the DOM element IDs needed by this
 	 * 	object to render the dialog. */
	this.relevantElementIdsObj = relevantElementIdsObj;
	/** @property {String} idOfPopupDiv - The HTML element ID that the
	 * 	dialog session should be positioned over. */
	this.idOfOverlappedElem = idOfOverlappedElem;
	/** @property {String} idOfPopupDiv - A jQuery selector that
	 * 	selects the HTML element ID that the dialog should be
	 * 	positioned over. */
	this.jQuerySelectorForOverlappedElem = jQuerySelectorForOverlappedElem;
	/** @property {String} - The title to display at the
 	 * 	top of the dialog.
 	 */
	this.dialogTitle = dialogTitle;
	
	/** @property {null|String} - The title to display on a
	 * 	 on the CANCEL button, if one is created during
	 * 	 the dialog session because no buttons were provided
	 * 	 by the given HTML.
	 */
	this.defaultCancelButtonTitle = defaultCancelButtonTitle;
	/** @property {null|String} - The title to display on a
	 * 	 on the OK button, if one is created during
	 * 	 the dialog session because no buttons were provided
	 * 	 by the given HTML.
	 */
	this.defaultOkButtonTitle = defaultOkButtonTitle;
	
	/** @property {String} - The width in pixels for the dialog form.
	 *  If NULL, then it will be set to the default.
	 */
	this.dialogWidth = dialogWidth;
	/** @property {String} - The height in pixels for the dialog form.
	 *  If NULL, then it will be set to the default.
	 */
	this.dialogHeight = dialogHeight;
	/** @property {Function} - The function that build the HTML
	 * 	content to display in the body of the floating popup DIV. */
	this.htmlText = htmlText;
	/** @property {Function} - The function that will be called when
	 * 	the OK button is clicked that validates the dialog session data. */
	this.funcValidate = funcValidate;
	/** @property {Function} - The "resolve" function for we use to
	 * 	to exit the promise we create to wait for the user's
	 * 	response to the dialog.  This field will be filled in
	 * 	by our doDialogSession_promise() method when it is called.
 	 */
	this.funcResolve = null;
	/** @property {Function} - The "reject" function for we use to
	 * 	to handle errors that might occur in the context of the
	 * 	promise we create to wait for the user's response to the dialog.
	 * 	This field will be filled in by our doDialogSession_promise()
	 * 	method when it is called.
	 */
	this.funcReject = null;
	/** @property {Boolean} - If TRUE, the CANCEL button will be
	 * 	visible.  If FALSE, then not.  */
	this.bShowCancelButton = bShowCancelButton;
	
	/**
	 * Given an element ID, validate it as being an active
	 * 	element in the current DOM tree.
	 *
 	 * @param {String} elemId - An element ID.
	 * @param {Boolean} bReturnASelector - If TRUE, then
	 * 	a jQuery selector that represents the given
	 * 	element will be returned.  If FALSE, then the
	 * 	element ID will be returned unmodified.
	 *
	 * @return {String}
	 *
	 * @private
	 */
	this._validateElemId = function(elemId, bReturnASelector) {
		let methodName = self.constructor.name + '::' + `_validateElemId`;
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(elemId))
			throw new Error(errPrefix + `The elemId parameter is empty.`);
		if (typeof bReturnASelector !== 'boolean')
			throw new Error(errPrefix + `The value in the bReturnASelector parameter is not boolean.`);

		const jQuerySelector = misc_shared_lib.makeJQuerySelectorFromId(elemId);
		
		if (!misc_shared_lib.isValidJQuerySelector(jQuerySelector))
			throw new Error(errPrefix + `Invalid element ID: ${elemId}.`);

		if (bReturnASelector)
			return misc_shared_lib.makeJQuerySelectorFromId(elemId);
		else
			return elemId;
	}
	
	/**
	 * A simple helper function to get the element ID for the DIV
	 * 	that is intended to host the floating popup that wll
	 * 	house a dialog session.
	 *
 	 * @param {Boolean} bReturnASelector - If TRUE, then
 	 * 	a selector will be returned.  If FALSE, then just
 	 * 	the element ID will be returned.
 	 *
	 * @return {String} - The desired element ID is returned
	 * 	or a jQuery selector that represents it, depending
	 * 	on the value of the bReturnASelector parameter.
	 * 	
	 * @private
	 */
	this._getHostDivIdOrSelector = function(bReturnASelector) {
		let methodName = self.constructor.name + '::' + `_getHostDivIdOrSelector`;
		let errPrefix = '(' + methodName + ') ';
		
		return self._validateElemId(self.relevantElementIdsObj.host_div_id, bReturnASelector);
	}
	
	/**
	 * A simple helper function to get the element ID for the
	 * 	element that should house the popup title.
	 *
 	 * @param {Boolean} bReturnASelector - If TRUE, then
 	 * 	a selector will be returned.  If FALSE, then just
 	 * 	the element ID will be returned.
 	 *
	 * @return {String} - The desired element ID is returned
	 * 	or a jQuery selector that represents it, depending
	 * 	on the value of the bReturnASelector parameter.
	 * 	
	 * @private
	 */
	this._getTitleElemIdOrSelector = function(bReturnASelector) {
		let methodName = self.constructor.name + '::' + `_getTitleElemIdOrSelector`;
		let errPrefix = '(' + methodName + ') ';
		
		return self._validateElemId(self.relevantElementIdsObj.title_elem_id, bReturnASelector);
	}
	
	/**
	 * A simple helper function to get the element ID for the DIV
	 * 	that is the BODY DIV for the floating popup that wll
	 * 	house a dialog session.
	 *
 	 * @param {Boolean} bReturnASelector - If TRUE, then
 	 * 	a selector will be returned.  If FALSE, then just
 	 * 	the element ID will be returned.
 	 *
	 * @return {String} - The desired element ID is returned
	 * 	or a jQuery selector that represents it, depending
	 * 	on the value of the bReturnASelector parameter.
	 * 	
	 * @private
	 */
	this._getBodyDivIdOrSelector = function(bReturnASelector) {
		let methodName = self.constructor.name + '::' + `_getBodyDivIdOrSelector`;
		let errPrefix = '(' + methodName + ') ';
		
		return self._validateElemId(self.relevantElementIdsObj.body_div_id, bReturnASelector);
	}
	
	/**
	 * This function will be attached to the CANCEL button in the
	 * 	dialog form.
	 */
	this.funcCancelButton = function() {
		try {
			const methodName = self.constructor.name + '::' + `funcCancelButton`;
			const errPrefix = '(' + methodName + ') ';
			
			// Clean-up before exiting the dialog session.
			self._doExitDialogCode();
			
			// Call the "resolve" function with a FALSE result after hiding
			//  the floating DIV form.
			console.log(`${errPrefix} The user cancelled the dialog session.`);
			
			hideDiv(self._getHostDivIdOrSelector(true));
			
			// Resolve the promise that is waiting for this user response.
			self.funcResolve(false);
		}
		catch(err) {
			// Unexpected error.  Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			self.funcReject(errMsg + ' - try/catch');
		}
	}
	
	/**
	 * This function will be attached to the OK button in the
	 * 	dialog form.
	 */
	this.funcOkButton = function() {
		let methodName = self.constructor.name + '::' + `funcOkButton`;
		let errPrefix = '(' + methodName + ') ';
		
		try {
			// Call the validation function.
			let dlgResult = self.funcValidate();
			
			if (dlgResult === true){
				// Clean-up before exiting the dialog session.
				self._doExitDialogCode();
			
				// Dialog session accepted by the user.  Call the resolve
				//	function with a TRUE result after hiding the floating
				//	popup form.
				console.log(`${errPrefix} The user accepted the dialog session.`);
				hideDiv(self._getHostDivIdOrSelector(true));
				
				// Resolve the promise that is waiting for this user response.
				self.funcResolve(true);
			} else {
				// We should have an error message in string form.
				if (typeof dlgResult !== 'string')
					throw new Error(errPrefix + `The value returned by the validation function was not TRUE, but it is not a string either.  Expected an error message in string format.`);
				// Show the error message to the user and leave the floating popup
				// 	DIV visible.
				alert(dlgResult);
				
				// We do NOT resolve the promise that is waiting for a user
				//  response because we want to allow the user to correct their
				//  mistake and continue.
			}
		}
		catch(err) {
			// Unexpected error.  Convert the error to a promise rejection.
			let errMsg =
				errPrefix + conformErrorObjectMsg(err);
			
			self.funcReject(errMsg + ' - try/catch');
		}
	}
	
	/**
	 * Our keyup event handler that processes keystrokes for
	 * 	this dialog session.
	 *
	 * @param {Object} event - The event object.
	 */
	this.keyupEventHandler = function(event) {
		const methodName = self.constructor.name + '::' + `keyupEventHandler`;
		const errPrefix = '(' + methodName + ') ';
		
		if (event.key === "Escape") {
			// Do not process the keystroke if it is meant for a popup
			//  that might be overlaying us (i.e. - at a greater poup
			//	depth than us).
			
			if (!self._isOurPopupDepth()) {
				console.info(errPrefix + `User pressed the ESC key but we are not at current popup depth.  Ignoring keystroke.`);
				return;
			}
			
			// Treat this like a CANCEL button press.
			console.info(errPrefix + `User pressed the ESC key.  Cancelling the dialog session.`);
			self.funcCancelButton();
		}
	}
	
	/**
	 * Install our keyup event handler.
	 *
	 * @private
	 */
	this._addKeyEventHandler = function() {
		const methodName = self.constructor.name + '::' + `_addKeyEventHandler`;
		const errPrefix = '(' + methodName + ') ';
		
		$(document).on('keyup', self.keyupEventHandler);
	}
	
	/**
	 * Remove our keyup event handler.
	 *
	 * @private
	 */
	this._removeKeyEventHandler = function() {
		let methodName = self.constructor.name + '::' + `_removeKeyEventHandler`;
		let errPrefix = '(' + methodName + ') ';
		
		$(document).off('keyup', self.keyupEventHandler);
	}
	
	/**
	 * This cleanu pfunction MUST be called from any code
	 * 	pathway that exits the dialog session.
	 *
 	 * @private
	 */
	this._doExitDialogCode = function() {
		let methodName = self.constructor.name + '::' + `_doExitDialogCode`;
		let errPrefix = '(' + methodName + ') ';
		
		// Remove our keyup handler.
		self._removeKeyEventHandler();
		
		// Decrement the popup depth.
		g_CurrentPopupDepth--;
	}
	
	/**
	 * This function returns TRUE if we are executing at the
	 * 	current popup depth or FALSE if not.
	 *
	 * @private
	 */
	this._isOurPopupDepth = function() {
		let methodName = self.constructor.name + '::' + `_isOurPopupDepth`;
		let errPrefix = '(' + methodName + ') ';
		
		try {
			// Get our z-index.
			let currentZIndex = $(self._getHostDivIdOrSelector(true)).css('z-index');
			
			if (typeof currentZIndex === 'string')
				currentZIndex = parseInt(currentZIndex);
			
			// Is it the current (most deeply nested) popup depth?
			return currentZIndex === BASE_POPUP_Z_INDEX + g_CurrentPopupDepth;
		} catch(err) {
		    // Convert the error to a promise rejection.
		    const errMsg =
		        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
		    
		    console.error(errMsg);
		}
	}
	
	/**
	 * This promise waits executes the dialog session and then
	 * 	for the user to click the CANCEL or OK button in one
	 * 	of our dialog sessions.
	 *
	 * @return {Promise<Boolean>} - The promise resolves to
	 * 	FALSE if the user clicks the CANCEL button or TRUE
	 * 	if they click the OK button.
	 */
	this.doDialogSession_promise = function() {
		let methodName = self.constructor.name + '::' + `doDialogSession_promise`;
		let errPrefix = '(' + methodName + ') ';
		
		return new Promise(function(resolve, reject) {
			try	{
				// Add our keyup event handler.
				self._addKeyEventHandler();
				
				// Increment the popup depth.
				g_CurrentPopupDepth++;
			
				const floatingDivSelector = self._getHostDivIdOrSelector(true);
				
				// Put our resolve and reject functions into the
				//  object level fields for those.
				self.funcResolve = resolve;
				self.funcReject = reject;
				
				// Assign the title to the popup DIV.
				$(self._getTitleElemIdOrSelector(true)).html(self.dialogTitle);
				
				// Assign the HTML content to the body element in the floating popup DIV.
				//  This puts the given HTML into the DOM tree.
				$(self._getBodyDivIdOrSelector(true)).html(self.htmlText);
				
				// If we have a non-NULL dialog width, set the dialog
				//  DIV to that width.
				if (self.dialogWidth)
					$(floatingDivSelector).width(self.dialogWidth);
				
				// If we have a non-NULL dialog height, set the dialog
				//  DIV to that height.
				if (self.dialogHeight)
					$(floatingDivSelector).height(self.dialogHeight);
					
				// Make sure the CANCEL button HTML element exists in the
				//	children of the floating DIV. It should carry the
				//	"cancel-button" class.
				//
				// Build a jQuery selector to search for the CANCEL button
				//  class name in the children of floating popup DIV.
				let cancelButtonSelector =
					misc_shared_lib.getChildOfJQuerySelector(floatingDivSelector, '.' + HTML_CLASS_NAME_CANCEL_BUTTON, false);
					
				// Build a jQuery selector to search for the OK button
				//  class name in the children of floating popup DIV.
				let okButtonSelector =
					misc_shared_lib.getChildOfJQuerySelector(floatingDivSelector, '.' + HTML_CLASS_NAME_OK_BUTTON, false);
					
				// If both buttons are missing, we provide HTML for a pair
				// 	of default button implementations.  If only one is missing,
				//  that's an error.  If both are there, we don't have to do
				//  anything.
				if (cancelButtonSelector && okButtonSelector) {
					// CONTEXT: HTML block HAS both buttons.
					// All good.  Continue.
				}
				else if (!(cancelButtonSelector && okButtonSelector)) {
					// CONTEXT: HTML block has NO buttons.  We provide the
					//  the default implementation.
					
					// Both buttons are missing.  Provide the default implementation.
					
					// Assign the default dialog template to the designated
					//  DIV for that in the floating popup DIV.  Build an
					//  object to provide the data values to that template.
					const templateDataObj =
						{
							cancelButtonTitle:
								self.defaultCancelButtonTitle ? self.defaultCancelButtonTitle : DEFAULT_CANCEL_BUTTON_TITLE, 
							okButtonTitle:
								self.defaultOkButtonTitle ? self.defaultOkButtonTitle : DEFAULT_OK_BUTTON_TITLE,
							bespokeHtml:
								self.htmlText
						}
						
					const theHtml = g_DefaultEZDialogHtmlTemplate_handlebars(templateDataObj);
					
					// Assign the generated HTML to the BODY element in the popup DIV.
					// $(g_DefaultEzDialogBespokeHtmlDivId_selector).html(theHtml);
					$(self._getBodyDivIdOrSelector(true)).html(theHtml);

					// Update the jQuery selectors for the buttons, now that
					//  we have inserted the HTML for the dynamically created
					//  buttons into the DOM tree.
					cancelButtonSelector =
						misc_shared_lib.getChildOfJQuerySelector(floatingDivSelector, '.' + HTML_CLASS_NAME_CANCEL_BUTTON, false);
					
					// Build a jQuery selector to search for the OK button
					//  class name in the children of floating popup DIV.
					okButtonSelector =
						misc_shared_lib.getChildOfJQuerySelector(floatingDivSelector, '.' + HTML_CLASS_NAME_OK_BUTTON, false);
				} else {
					// CONTEXT: HTML block has ONE button, not the other.
					// 	This is an error.
					if (!cancelButtonSelector)
						throw new Error(errPrefix + `The floating DIV HTML content is missing a CANCEL button.`);
					if (!okButtonSelector)
						throw new Error(errPrefix + `The floating DIV HTML content is missing an OK button.`);
				}
				
				// Attach our click handler to that button.
				$(cancelButtonSelector).click(self.funcCancelButton);
				
				// Attach our click handler to that button.
				$(okButtonSelector).click(self.funcOkButton);
				
				// Hide the CANCEL button if desired.
				if (self.bShowCancelButton)
					$(cancelButtonSelector).show();
				else
					$(cancelButtonSelector).hide();

				// Show the floating popup DIV to the user to
				//	start the dialog session and then wait for
				//  one of our click handlers to end the promise.
				showDiv(self._getHostDivIdOrSelector(true));
				
				setPositionOfDomElementOverElement(self._getHostDivIdOrSelector(false), self.idOfOverlappedElem, true);
				
				// Adjust the popups z-index based on the current popup
				//  nesting depth so we don't "underlay" an existing
				//  popup, like when a dialog session pops up a
				//  help text screen.
				// const currentZIndex = $(floatingDivSelector).css('z-index');
				const newZIndex = BASE_POPUP_Z_INDEX + g_CurrentPopupDepth;
				
				console.info(errPrefix + `Adjusting z-index for nested popup.  Using z-index: ${newZIndex}`);
				$(floatingDivSelector).css('z-index', newZIndex);
				
				// NOTE: The clean-up call is in the CANCEL and OK
				//  button handlers.
			}
			catch(err) {
				// Clean-up before exiting.
				self._doExitDialogCode();
				
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + conformErrorObjectMsg(err);
				
				reject(errMsg + ' - try/catch');
			}
		});
	}
}

