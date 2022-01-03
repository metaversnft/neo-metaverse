/**
 * (c) 2019, Android Technologies, Inc.
 */
/**
 * This file declares the "global" namespace and some commonly needed constants.
 */

const g_OurClientId = "lc2s28xuuf27wx51z2kxrlbbmj8air";

// Singleton pattern.
const g_Global = new function ()
{
	var self = this;
	
	this.urlDirectChat = '/direct-chat';
	
	// We can not put the URL to the config file that gets the contents
	//	for the g_AppConfig object because that will create a catch-22
	//	situation.  This is because the code that needs this URL calls
	//	getBackendServerBaseUrl() to get the g_AppConfig object for the
	//	back-end URL, but getBackendServerBaseUrl() needs g_AppConfig
	//	to get the base URL.
	//
	this.urlMyConfigJS = '/api-noauth/myconfig';
}();

/*
// Are we running in Node.JS?
if (typeof process !== 'undefined' &&
		process.release.name.search(/node|io.js/) !== -1) {
	// Yes.  Export g_Global.
	module.exports = g_Global;
}
*/

// Use this code on both client and server side.  Are we on the server side?
if (typeof module == 'undefined' || typeof module.exports == 'undefined')
{
	window.g_Global = g_Global;
}
else {
	module.exports = {
		g_Global: g_Global
	}
}