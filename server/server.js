const path = require("path");
const createError = require('http-errors');
const express = require("express");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// const logger = require('morgan');

// Using Express session storage for user specific data, especially OAuth related items.
const express_session = require('express-session');
const app = express(); // create express app

// const test = require('./routes/test');
// const neoverse = require('./routes/neoverse');
const index = require('./routes/index');
const metaverse = require('./routes/neoland');
const search_for_videos = require('./routes/search-for-videos');
const search_youtube_api = require('./routes/search-youtube-api');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());

/*
This code will result in a "MIME type not supported error".
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
 */

// This line stops us from receiving the "MIME type not supported error" using the above
//  app.get() code that is now commented out.
// app.use(express.static("public"));

// This line is the version for the above statement for React apps.
//
// This excellent tutorial on converting an NPM React app to an Node.JS Express app for more
//  details.
//
// https://levelup.gitconnected.com/how-to-render-react-app-using-express-server-in-node-js-a428ec4dfe2b
//
// Important note about the following statements from that tutorial.
//
// Note: The order of app.use matters here. We want our React app to be displayed on page load,
//  so the build folder should be loaded first as it will also contain index.html. If we add
//  the public folder first then index.html from server/public folder will be loaded as
//  Express.js reads the file from top to bottom and it stops rendering when it finds the first
//  matching file.
//

// app.use(express.static(path.join(__dirname, "..", "build")));

// This determines what directory the non-Express app, if any,
//  is in that we will server along side our Express app.
// const PATH_TO_NON_EXPRESS_APP = 'is-speaking-app'; // "build" <- Is for the teacher/React sample app.

// Serve up the is-speaking app.
// app.use(express.static(path.join(__dirname, "..", PATH_TO_NON_EXPRESS_APP)));

// ROS: Probably need to comment out this line below
//  and set up some standard Express routes and views.
app.use(express.static("public"));

// Jquery plugins.
app.use(express.static(path.join(__dirname, 'jquery-plugins')));

app.use('/', index);
// app.use('/', neoverse);
app.use('/', metaverse);
// app.use('/', test);
app.use('/', search_for_videos);
app.use('/', search_youtube_api);

// More notes from the tutorial:
//
// Note: So now, when the request comes to the server for any route
//  and route you’re trying to access does not exist on the server-side,
//  we will be sending the index.html file from the build folder so your
//  client-side route (React App) will handle that and will display the client-side route page.
//
/*
NOT USED

app.use((req, res, next) => {
    let resolvedFilename;

    let urlNoArgs = req.url.split("?")[0];

    if (urlNoArgs == '/')
        // resolvedFilename = path.join(__dirname, ".", "build", "index.html");
        resolvedFilename = path.join(__dirname, ".", PATH_TO_NON_EXPRESS_APP, "index.html");
    else
        resolvedFilename = path.join(__dirname, ".", PATH_TO_NON_EXPRESS_APP, urlNoArgs);
    console.warn(`Loading file: ${resolvedFilename}.`);
    res.sendFile(resolvedFilename);
});
*/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// start express server on port 5000
app.listen(5000, () => {
    console.log("server started on port 5000");
});