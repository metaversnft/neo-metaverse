// Some constants shared by many of the modules in this app.
// If a remote participant is further away in the ThreeJS scene than
//  this distance, in ThreeJS world units, they they are considered
//  too far away to be heard.
const THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD = 60;

// The DIV ID for the ThreeJS canvas.
const THREEJS_CANVAS_ID = 'threejs-canvas-div';

// The DIV ID for the outer table.
const OUTER_TABLE_ID = 'outer-table';

export {THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD, THREEJS_CANVAS_ID, OUTER_TABLE_ID};