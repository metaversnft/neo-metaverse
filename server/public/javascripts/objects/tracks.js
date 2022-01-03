// This module contains objects that are involved with track recording and playback.


// This variable will be TRUE when spatial mixing (recording) is
//  in progress, FALSE otherwise.
var g_IsSpatialMixingActive = false;

// One data point in 3D space.
function Point3D(x=0, y = 0, z = 0) {
    this.x = x;
    this.x = y;
    this.z = z;
}

// This object holds the data for a single point in the session.
//  (i.e. - at one point in time in the time line).
function TrackDataPoint() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Number} - The location of this point in time, in seconds. */
    this.timestampSecs = 0;

    /** @property {Point3D} - The location of the track source
     *   in 3D space at this point in time. */
    this.xyz = new Point3D();

    /**
     * Validate the contents of this object.
     */
    this.validateMe = function() {
        if (typeof self.timestampSecs !== 'number')
            throw new Error(errPrefix + `The value in the timestampSecs field is not number.`);
        if (self.timestampSecs < 0)
            throw new Error(errPrefix + `The value in the timestampSecs field is less than zero.`);
        if (!(self.xyz instanceof Point3D))
            throw new Error(errPrefix + `The value in the self.xyz parameter is not a Point3D object.`);
    }
}

/**
 * This object holds the track data for one track across all time in a session.
 *
 * @constructor
 */
function TrackData() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<TrackData>>} - Associative array
     *  of TrackData objects where the key is a timestamp in seconds
     *  and the value is a TrackDataPoint object. */
    this.aryTrackData = [];

    /**
     * Add a new track data point, using the object's timestamp as
     *  the key.  Overwrite any existing object at that timestamp.
     *
     * @param {TrackDataPoint} trackDataPoint - The TrackDataPoint
     *  object to add.
     *
     * @return {TrackDataPoint|null} - Returns the old TrackDataPoint
     *  object that was located at the object's timestamp, before
     *  we stored the new one, or NULL if there was none.
     */
    this.addToTrack = function(timestampSecs, trackDataPoint) {
        let methodName = self.constructor.name + '::' + `addToTrack`;
        let errPrefix = '(' + methodName + ') ';

        if (!(trackDataPoint instanceof TrackDataPoint))
            throw new Error(errPrefix + 'trackDataPoint is not a TrackDataPoint object.');
        trackDataPoint.validateMe();

        // Store it.  Overwrite any existing value.
        let oldObj = self.aryTrackData[trackDataPoint.timestampSecs];

        self.aryTrackData[trackDataPoint.timestampSecs] = trackDataPoint;

        if (oldObj)
            return oldObj;
        else
            return null;
    };

    /**
     * Remove a track data point from the track data
     *  at the given timestamp.
     *
     * @param {Number} timestampSecs - The timestamp in seconds
     *  where the track data point is located in the track.
     *  If there is no element at that timestamp, then
     *  nothing is done.
     *
     * @return {TrackDataPoint|null} - Returns the old TrackDataPoint
     *  object that was located at the given timestamp, before
     *  we removed it, or NULL if there was none.
     */
    this.removeFromTrack = function(timestampSecs) {
        let methodName = self.constructor.name + '::' + `removeFromTrack`;
        let errPrefix = '(' + methodName + ') ';

        if (typeof timestampSecs !== 'number')
            throw new Error(errPrefix + 'timestampSecs is not a number.');
        if (timestampSecs < 0)
            throw new Error(errPrefix + 'timestampSecs is negative.');

        let existingObj = self.aryTrackData[timestampSecs];

        if (existingObj) {
            // Remove the existing object.
            if (self.aryTrackData[timestampSecs])
                delete self.aryTrackData[timestampSecs];
        }
        else
            return null;
    };

    /**
     * Get the track data point at the given timestamp.
     *
     * @param {Number} timestampSecs - The timestamp in seconds
     *  for the desired TrackData object.
     *
     * @return {TrackData|null} - Returns the TrackData object
     *  at the given timestamp, or NULL if there is none.
     */
    this.findInTrack = function(timestampSecs) {
        let methodName = self.constructor.name + '::' + `find`;
        let errPrefix = '(' + methodName + ') ';

        if (typeof timestampSecs !== 'number')
            throw new Error(errPrefix + 'timestampSecs is not a number.');
        if (timestampSecs < 0)
            throw new Error(errPrefix + 'timestampSecs is negative.');

        let existingObj = self.aryTrackData[timestampSecs];

        if (existingObj)
            return existingObj;
        else
            return null;
    };
}

/**
 * This object holds the track data for ALL tracks.
 *
 * @constructor
 */
function TrackDataManager() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<TrackData>} - An associative array of tracks.
     *  The key is the track number and the value is a TrackData
     *  object. */
    this.aryTracks = [];

    /**
     * Add a TrackDataPoint object to the desired track.
     *
     * @param {Number} trackNum - The desired track number.
     * @param {TrackDataPoint} trackDataPoint - A valid
     *  TrackDataPoint object.
     *
     * @return {TrackDataPoint|null} - Returns the old TrackDataPoint
     *  object that was located at the object's timestamp, before
     *  we stored the new one, or NULL if there was none.
     */
    this.addToTrack = function(trackNum, trackDataPoint) {
        let methodName = self.constructor.name + '::' + `addToTrack`;
        let errPrefix = '(' + methodName + ') ';

        // If we don't have a TrackData object for this track number,
        //  yet, then create one.
        if (!self.aryTracks[trackNum])
            self.aryTracks[trackNum] = new TrackData();

        return self.aryTracks[trackNum].addToTrack(trackDataPoint);
    }

    /**
     * Remove a TrackDataPoint object from the desired track.
     *
     * @param {Number} trackNum - The desired track number.
     * @param {TrackDataPoint} trackDataPoint - A valid
     *  TrackDataPoint object.
     *
     * @return {TrackDataPoint|null} - Returns the old TrackDataPoint
     *  object that was located at the object's timestamp, before
     *  we removed it, or NULL if there was none.
     */
    this.removeFromTrack = function(trackNum, trackDataPoint) {
        let methodName = self.constructor.name + '::' + `removeFromTrack`;
        let errPrefix = '(' + methodName + ') ';

        // If we don't have a TrackData object for this track number,
        //  yet, ignore the call.
        let retObj = null;

        if (self.aryTracks[trackNum])
            retObj = self.aryTracks[trackNum].removeFromTrack(trackDataPoint);

        return retObj;
    }

    /**
     * Find a TrackDataPoint object at the given timestamp
     *  in the given track number.
     *
     * @param {Number} trackNum - The desired track number.
     * @param {Number} timestampSecs - The desired track location
     *  in seconds.
     *
     * @return {TrackDataPoint|null} - Returns the TrackDataPoint
     *  object that exists at the given timestamp, or NULL if
     *  there is none.
     */
    this.findInTrack = function(trackNum, timestampSecs) {
        let methodName = self.constructor.name + '::' + `findInTrack`;
        let errPrefix = '(' + methodName + ') ';

        // If we don't have a TrackData object for this track number,
        //  yet, return NULL.
        if (!self.aryTracks[trackNum])
            return null;

        return self.aryTracks[trackNum].findInTrack(timestampSecs);
    }
}