// This module contains a handy object that lists the use roles we currently implement.

/**
 * Handy object that has properties for each of the Dolby IO SDK's supported
 *  participant status values.
 *
 * @constructor
 */
function RolesList() {
    const self = this;

    this.FOLLOWER = 'follower';
    this.LEADER = 'leader';

    /**
     * Returns true if the given role is a valid role.
     *
     * @param {String} status - The role to check.
     *
     * @returns {boolean} - TRUE if the role is valid, FALSE otherwise.
     */
    this.isValidStatus = function(theUserRole) {
        return (theUserRole === self.FOLLOWER ||
            theUserRole === self.LEADER);
    }
}

const g_RolesList = new RolesList();

export {g_RolesList}
