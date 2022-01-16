// The object in this module stores the global state of the application and the local user.

import {g_RolesList} from "../roles/user-roles.js";

function GlobalState() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<String>} - The roles assigned to the local user if any. */
    this.localUserRoles = [];

    /** @property {Boolean} - The flog that lets the animate loop
     *  it should immediately exit since we no longer want
     *  animation/rendering to take place. */
    this.isRenderingDisabled = false;

    /** @property {Boolean} - This property helps with custom tracing in Chrome DevTools.
      See the keystroke processing code to see which keystroke
      sets this variable to TRUE.  Then, put a block of code
      in the part of the code that you want to dynamically
      trigger a breakpoint like this:

     if (g_BreakHerePlease)
        // This aids tracing using Chrome DevTools.  See animate-loop.js
        //  for the keystroke that sets this property to TRUE.
        console.info(`${errPrefix}Set DevTools breakpoint here.`);
     */
    this.breakHerePlease = false;

    /** @property {Boolean} - If the local user has been assigned the
     *   FOLLOWER role, this variable turns FOLLOWING mode ON and
     *   OFF. */
    this.isFollowerFollowing = false;

    /** @property {Boolean} - If the local user has been assigned the
     *   LEADER role, this variable helps the LEADER toggle
     *   FOLLOWING by the remote FOLLOWERS on and off.
     */
    this.isFollowingByFollowersDesired = true;

    // ---------------------- CONSTRUCTOR --------------------

    // If the URL query arguments contains a role for the user, assign it
    //  to the property for that.
    const urlArguments = getUrlArguments();

    if ('role' in urlArguments) {
        const theRoleAssigned = urlArguments['role'];
        this.localUserRoles.push(theRoleAssigned);

        // Is it the FOLLOWER role?
        if (theRoleAssigned === g_RolesList.FOLLOWER) {
            // Yes.  Enable following mode.
            this.isFollowerFollowing = true;
        }
    }

    /**
     * Process a FOLLOWER mode update command received from the broadcast system.
     *
     * @param {Object} followerModeUpdateObj - The object containing the
     *   follower mode update command.
     */
    this.processFollowerModeUpdate = function(followerModeUpdateObj) {
        const errPrefix = `(processFollowerModeUpdate) `;

        if (!misc_shared_lib.isNonNullObjectAndNotArray(followerModeUpdateObj))
            throw new Error(errPrefix + `The followerModeUpdateObj is not a valid object.`);

        if (followerModeUpdateObj.status === 'on')
            self.isFollowerFollowing = true;
        else if (followerModeUpdateObj.status === 'off')
            self.isFollowerFollowing = false;
        else
            throw new Error(`${errPrefix} The followerModeUpdateObj.status is missing or does not contain a valid value.`);
    }

    /**
     * This method sets the flog that lets the animate loop
     *  it should immediately exit since we no longer want
     *  animation/rendering to take place.
     */
    this.setRenderDisableFlag = function(){
        const methodName = self.constructor.name + '::' + `setRenderDisableFlag`;
        const errPrefix = '(' + methodName + ') ';

        self.isRenderingDisabled = true;
    }
}

const g_GlobalState = new GlobalState();

export { g_GlobalState };