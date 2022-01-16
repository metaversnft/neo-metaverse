// WARNING: This page has been superseded by the NEOLAND page!
// This is the route for the NEOVERSE virtual world page.

let express = require('express');
let router = express.Router();
let http_status_codes = require('http-status-codes');
let common_routines = require('../common/common-routines');

/* GET home page. */
router.get('/neoverse', function(req, res, next) {

	try
	{
		res.render('neoverse', { title: 'Express' });
	}
    catch (err)
    {
        console.log('[ERROR: index] Error rendering page -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error rendering page.');
        return;
    } // try/catch
});

module.exports = router;
