// This module contains routines to persist page elements so that they can be restored
//  when the page is reloaded, and in other conditions.

// The class name we use for any DOM elements we want to
//  persist to the cookie store.
const CLASS_NAME_PERSISTENT_FIELD = 'persistent-field';


/**
 * Given an array of DOM element IDs, set the cookie store
 *  from the the associated page element current text values.
 *
 * @param {Array<string>} aryFieldElementIDs - An array of field DOM element IDs.
 */
function saveFields(aryFieldElementIDs) {
    let errPrefix = `(saveFields) `;

    if (!Array.isArray(aryFieldElementIDs))
        throw new Error(errPrefix + `The aryFieldElementIDs parameter value is not an array.`);

    if (aryFieldElementIDs.length < 1)
        // throw new Error(errPrefix + `The array of field element IDs is empty.`);
        return; // Nothing to save.

    for (let ndx = 0; ndx < aryFieldElementIDs.length; ndx++) {
        let cookieId = aryFieldElementIDs[ndx];

        if (misc_shared_lib.isEmptySafeString(cookieId))
            throw new Error(errPrefix + `The cookieId value at array ndx(${ndx}) is empty.`);

        const jqDomElement = $(`#${cookieId}`);

        const tagName = jqDomElement.prop('tagName').toLowerCase();

        let currentVal = '(not set)';

        if (tagName ==='select') {
            // Options box.  Get the selected option value.
            currentVal = jqDomElement.find(":selected").text();
        } else {
            currentVal = $(`#${cookieId}`).val();
        }

        setCookieValue(cookieId, currentVal);
    }
}

/**
 * Given an array of DOM element IDs, restore the associated
 *  page element text values from the cookie store.
 *
 * @param {Array<string>} aryFieldElementIDs - An array of field DOM element IDs.
 */
function restoreFields(aryFieldElementIDs) {
    let errPrefix = `(restoreFields) `;

    if (!Array.isArray(aryFieldElementIDs))
        throw new Error(errPrefix + `The aryFieldElementIDs parameter value is not an array.`);

    if (aryFieldElementIDs.length < 1)
        // throw new Error(errPrefix + `The array of field element IDs is empty.`);
        return; // Nothing to restore.

    for (let ndx = 0; ndx < aryFieldElementIDs.length; ndx++) {
        let cookieId = aryFieldElementIDs[ndx];

        if (misc_shared_lib.isEmptySafeString(cookieId))
            throw new Error(errPrefix + `The cookieId value at array ndx(${ndx}) is empty.`);

        let cookieVal = getCookieValue(cookieId);

        console.info(errPrefix, `CookieId("${cookieId}"): ${cookieVal}`);

        // Set the element's text value to the cookie value.
        if (!misc_shared_lib.isEmptySafeString(cookieVal)) {
            // The HTML5 input element for the files list must be
            //  handled differently.
            let jqDomElement = $(`#${cookieId}`).get()[0];

            let bIsHtml5FileInputElement = (jqDomElement.type == 'file' && jqDomElement.tagName == 'INPUT');

            if (bIsHtml5FileInputElement)
                // Push the file into the HTML5 file input control's file collection.
                jqDomElement.files[0] = cookieVal;
            else if (jqDomElement.tagName == 'SELECT') {
                if (!misc_shared_lib.setSelectedIndexByValue(jqDomElement, cookieVal))
                    console.error(errPrefix, `Could not set the selected index for the select element with ID "${cookieId}".`);
            }
            else
                // Fallback is just to se the "val" property of the
                //  element.
                $(`#${cookieId}`).val(cookieVal);
        }
    }
}

/**
 * This function builds an array of all the DOM elements
 *  that have the 'persistent-field' class name.
 */
function getPersistentFieldIDs() {
    let errPrefix = `(getPersistentFieldIDs) `;

    let listPersistentFieldIds = $(`.${CLASS_NAME_PERSISTENT_FIELD}`).map(function() {
        return this.id;
    }).get();

    return listPersistentFieldIds;
}

/**
 * Restore certain fields to the enhanced chat page from the cookie store.
 * 	We use the element ID as the cookie ID.
 */
function restorePage() {
    restoreFields(getPersistentFieldIDs());
}

/**
 * Save certain fields to the enhanced chat page from the cookie store.
 * 	We use the element ID as the cookie ID.
 *
 * NOTE: We should call this function any time any of the text element
 *  fields on the page are changed.  Use the class 'persistent-field'
 *  for any text elements that should be saved to the cookie store
 *  when their value is changed.
 */
function savePage() {
    saveFields(getPersistentFieldIDs());
}

export {
    // getPersistentFieldIDs,
    restoreFields,
    restorePage,
    saveFields,
    savePage
};