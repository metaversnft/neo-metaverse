// Home page.

let express = require('express');
let router = express.Router();
let http_status_codes = require('http-status-codes');
let common_routines = require('../common/common-routines');

/* GET home page. */
router.get('/', function(req, res, next) {

    try
    {
        res.render('index', { title: 'NEO3D LIVE' });
    }
    catch (err)
    {
        console.log('[ERROR: index] Error rendering page -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error rendering page.');
        return;
    } // try/catch
});

module.exports = router;