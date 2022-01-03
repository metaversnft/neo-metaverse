// This module contains the code for the object that manages the THREE.GROUP
//  objects that represent the booths in the scene.

import * as THREE from '../threejs/build/three.module.js';

/**
 * This object manages the THREE.Group objects that represent the booths.
 *
 * @constructor
 */
function BoothManager() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Object} - An object as associative array to hold all the booth GROUP objects. */
    this.aryBoothGroupObjs = {};

    /**
     * This function returns TRUE if the given group ID belongs to
     *  an existing THREE.Group object. FALSE if not.
     *
     * @param {String} boothId - The group ID to check.
     *
     * @return {boolean}
     */
    this.isExistingGroupId = function(boothId   ) {
        const methodName = self.constructor.name + '::' + `isExistingGroupId`;
        const errPrefix = '(' + methodName + ') ';

        return self.aryBoothGroupObjs.hasOwnProperty(boothId);
    }

    this.addBoothGroup = function(boothId, boothGroupObj) {
        const methodName = self.constructor.name + '::' + `addBoothGroup`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(boothId))
            throw new Error(errPrefix + `The boothId parameter is empty.`);
        if (!(boothGroupObj instanceof THREE.Group))
            throw new Error(errPrefix + `The value in the boothGroupObj parameter is not a THREE.Group object.`);

        // No duplicates.
        if (self.isExistingGroupId(boothId))
            throw new Error(errPrefix + `The group ID '${boothGroupObj.id}' already exists.`);

        // Add it.
        self.aryBoothGroupObjs[boothId] = boothGroupObj;
    }
}

/**
 * Create an instance of a booth manager object.
 */
const g_BoothManager = new BoothManager();

export {BoothManager, g_BoothManager};