// This file contains code to show the various simple help screens
//	that exist in this dApp.

// NOTE: Remember to call initializeHelpSystem() where appropriate
//  in the document ready handler.

const DEFAULT_DIALOG_BOX_WIDTH = 750;
const DEFAULT_DIALOG_BOX_HEIGHT = 750;

const DEFAULT_HELP_BOX_WIDTH = 400;
const DEFAULT_HELP_BOX_HEIGHT = 400;

// The various salient element IDs are different between normal
//  and help text popups.  These view elements can be found
//	in show-help.jade
const g_AryPopupElements = {
	"normal":
		{
			host_div_id: "floating-popup-div",
			title_elem_id: "floating-popup-title-h2",
			body_div_id: "floating-popup-body-div"
		},
	"help":
		{
			host_div_id: "help-popup-div",
			title_elem_id: "help-popup-title-h2",
			body_div_id: "help-popup-body-div"
		}
}

// Important element IDs and selectors.
const g_AryHandlebarsScriptSourceIds = [
	'payments-payouts-and-terms-mini-template',
	'pick-address-from-neoline-template',
	'pick-address-from-neoline-cancelled-template',
	'strike-price-auto-adjustment-for-offers-template'
];

// This array will hold the various Handlebars templates we use for help text.
let g_AryHandlebarsTemplates = [];

/**
 * Given a SCRIPT block element ID, compile its contents into
 *  a Handlebars template function, accessible by the source
 *  DIV name.
 *
 * @param {String} scriptSourceId - The element ID for the
 * 	SCRIPT block that contains the source HTML for the
 * 	template.
 */
function compileHandleBarsTemplate(scriptSourceId) {
	const errPrefix = `(compileHandleBarsTemplate) `;
	
	if (misc_shared_lib.isEmptySafeString(scriptSourceId))
		throw new Error(errPrefix + `The scriptSourceId parameter is empty.`);
		
	const jQuerySelector = '#' + scriptSourceId;
	
	if (!misc_shared_lib.isValidJQuerySelector(jQuerySelector))
		throw new Error(errPrefix + `The following DIV ID could not be found in the DOM element tree: ${scriptSourceId}.`);
		
	g_AryHandlebarsTemplates[scriptSourceId] =
			Handlebars.compile($(jQuerySelector).html())
}

/**
 * Show one of our help text popups using the EZDialog system.
 *
 * @param {String} helpId - The ID of the desired help text.
 * @param {Object} [handlebarsDataObj] - The requisite data
 * 	object to service the Handlebars template.
 * @param {Number} width - The width to use for the
 * 	dialog box.
 * @param {Number} height - The height to use for the
 * 	dialog box.
 *
 * @return {Promise<Boolean>} - Resolves to TRUE when finished.
 */
function showSimpleHelp_promise(helpId, handlebarsDataObj, width, height) {
	const methodName = `showSimpleHelp_promise`;
	const errPrefix = `(${methodName}) `;
	
	return new Promise(function(resolve, reject) {
		try	{
			if (misc_shared_lib.isEmptySafeString(helpId))
				throw new Error(errPrefix + `The helpId parameter is empty.`);
				
			// Known help text ID?
			if (typeof g_AryHandlebarsTemplates[helpId] === 'undefined')
				throw new Error(errPrefix + `Unknown help text ID: ${helpId}.`);
				
			if (!misc_shared_lib.isNonNullObjectAndNotArray(handlebarsDataObj))
				throw new Error(errPrefix + `The handlebarsDataObj is not a valid object.`);
				
			// Validate the desired dialog window dimensions.
			misc_shared_lib.validateWidthAndHeight(methodName, width, height);
				
			const helpTextHtml =
				g_AryHandlebarsTemplates[helpId](handlebarsDataObj);
			
			// Now build and execute the help dialog.
			const helpDialogObj =
				new EZDialog(
					g_AryPopupElements.help,
					'mainDiv',
					'Help',
					helpTextHtml,
					() => {
						// There is nothing to validate.
						return true;
					},
					false, // No need for the CANCEL button.
					null,
					null,
					width,
					height
				);
				
			// Execute the dialog.
			helpDialogObj.doDialogSession_promise()
			.then(result => {
				console.info(errPrefix + `The result of the helpDialogObj.doDialogSession_promise() call:`);
				console.dir(result, {depth: null, colors: true});
				
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
 * Show one of our help text popups using the EZDialog system.
 * 	This call exists solely so we can include calls to the
 * 	help system directly in the HTML found in the various
 * 	Handlebars script blocks we use for our help screens.
 *
 * @param {String} helpId - The ID of the desired help text.
 * @param {Object} [handlebarsDataObj] - The requisite data
 * 	object to service the Handlebars template.
 * @param {Number|null} [width] - The width to use for the
 * 	dialog box.  Leave empty if to use the default width.
 * @param {Number|null} [height] - The height to use for the
 * 	dialog box.  Leave empty if to use the default height.
 * 	
 * @return {Promise<Boolean>} - Resolves to TRUE when finished.
 */
async function showSimpleHelp(helpId, handlebarsDataObj={}, width=null, height=null) {
	const methodName = `showSimpleHelp`;
	const errPrefix = `(${methodName}) `;
	
	if (misc_shared_lib.isEmptySafeString(helpId))
		throw new Error(errPrefix + `The helpId parameter is empty.`);
		
	// Known help text ID?
	if (typeof g_AryHandlebarsTemplates[helpId] === 'undefined')
		throw new Error(errPrefix + `Unknown help text ID: ${helpId}.`);

	// Use default dimensions if the caller did not provide those values.
	if (width === null) 
		width = DEFAULT_HELP_BOX_WIDTH
	
	if (height === null)
		height = DEFAULT_HELP_BOX_HEIGHT;
	
	// Validate the desired dialog window dimensions.
	misc_shared_lib.validateWidthAndHeight(methodName, width, height);
	
	let result = null;
	result = await showSimpleHelp_promise(helpId, handlebarsDataObj, width, height)
	.catch(err => {
	    const errMsg =
	        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
	    
	    console.error(errMsg);
	});
	
	return result;
}

/**
 * Initialize the help system.
 */
function initializeHelpSystem() {
	let errPrefix = `(initializeHelpSystem) `;
	
	for (let ndx = 0; ndx < g_AryHandlebarsScriptSourceIds.length; ndx++) {
		const strScriptSourceId = g_AryHandlebarsScriptSourceIds[ndx];
		
		if (misc_shared_lib.isEmptySafeString(strScriptSourceId))
			throw new Error(errPrefix + `The element at index(${ndx}) has an invalid script source ID.`);
		
		// Compile the Handlebars template.
		compileHandleBarsTemplate(strScriptSourceId);
	}
}

