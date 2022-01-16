let express = require('express');
let router = express.Router();
let http_status_codes = require('http-status-codes');
// let Web3 = require('web3');
let common_routines = require('../common/common-routines');

/* GET home page. */
router.get('/test', function(req, res, next) {

	try
	{
		/*
		let theWeb3Provider = web3_support.getWeb3Provider();
		let web3 = new Web3(new Web3.providers.HttpProvider(theWeb3Provider));
		
		// Remember, web3.eth.accounts is a function interface, not a property!  Use the accounts
		//  getter "getAccounts()" instead.
		web3.eth.getAccounts(function (error, result)
			{
				if (error)
				{
					throw new
						Error('Unable to request the account listing from the Ethereum network using the provider URL: '
						+ theWeb3Provider);
				}
				else
				{
					// The result is an array of accounts.
					let aryAccounts = result;
				
					if (common_routines.isArrayAndNotEmpty(aryAccounts))
					{
						console.log(aryAccounts);
					}
					else
					{
						console.log("The JSON RPC response to our accounts query was not an array: ");
						console.log(aryAccounts);
						console.log("Is the target Ethereum network running and are you using the correct URL and HTTP/HTTPS protocol? (e.g. - Ganache)");
					}
				}
			});
		*/
		
		res.render('test', { title: 'Express' });
	}
    catch (err)
    {
        console.log('[ERROR: index] Error rendering page -> ' + err.message);
        res.status(http_status_codes.INTERNAL_SERVER_ERROR).send('Error rendering page.');
        return;
    } // try/catch
});

module.exports = router;
