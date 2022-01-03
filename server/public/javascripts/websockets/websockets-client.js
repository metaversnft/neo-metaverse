/**
 * This file contains code for executing websockets activity on the client side (i.e. - in the browser).
 *
 * Copyright 2020, Android Technologies, Inc.  All rights reserved.
 */

// The URL to our websocket server.
const URL_WEBSOCKET_SERVER = 'ws://localhost:7701';

/**
 * This object creates and manages a client side websocket instance.
 *
 *  @param {Function} funcOnMessage - The callback to be called when a message is received.
 *
 * @constructor
 */
function WebSocketClient(funcOnMessage) {
	const self = this;
	let methodName = self.constructor.name + '::' + `constructor`;
	let errPrefix = '(' + methodName + ') ';
	
	if (typeof funcOnMessage !== 'function')
		throw new Error(errPrefix + `The value in the funcOnMessage parameter is not Function.`);
	
	/** @property {string} - A randomly generated unique ID for this object. */
	this.id = misc_shared_lib.getSimplifiedUuid();
	
	/** @property {Date} - The date/time this object was created. */
	this.dtCreated = Date.now();
	
	/** @property {Function} - The callback to be called when a message is received. */
	this.funcOnMessage = funcOnMessage;

	/** @property {Object} - The websocket for client side usage. */
	this.webSocketClient = null;
	
	/** @property {Boolean} - If TRUE, then we are currently connected to the
	 * 	 WebSockets server.  If FALSE, then we are not.  */
	this.isConnected = false;
	
	/** @property {Boolean} - If TRUE, then we are currently trying to RECONNECT to the
	 * 	 WebSockets server.  If FALSE, then we are not.  */
	this.isRetryConnectionInProgress = false;
	
	/**
	 * I a retry connection attempt is triggered, the timeout object
	 * 	for that process will be stored here.
	 */
	this.reconnectTimerObj = null;
	
	// -------------------- BEGIN: EVENT HANDLERS ------------
	
	/**
	 * Connect to the WebSockets server and establish our event handlers.
	 *
	 * @return {Promise<void>}
	 */
	this.connectToServer = async function() {
		let errPrefix = `(connectToServer) `;
		
		try {
			// IMPORTANT!: If the connection attempt fails because
			//  the WebSocket server is not available, the onError
			//  event WILL fire with a CloseEvent "err" object, BUT
			//  the onClose event will NOT fire!
			self.webSocketClient = await new WebSocket(URL_WEBSOCKET_SERVER)
			
			// Assign the event handlers.
			self.webSocketClient.onopen = self.onOpen;
			self.webSocketClient.onmessage = self.onMessage;
			self.webSocketClient.onclose = self.onClose;
			self.webSocketClient.onclose = self.onError;
		}
		catch(err) {
		    // Catch and log the error to the console.
		    let errMsg =
		        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			console.error(errMsg);
		};
		
	}
	
	// EVENT: ERROR
	this.onError = async function(err) {
		let methodName = self.constructor.name + '::' + `onError`;
		let errPrefix = '(' + methodName + ') ';
		
		// Is the "err" object a CloseEvent object?
		self.isConnected = false;
		console.info(errPrefix, 'Connection lost to the websocket server.');
		
		if (err instanceof CloseEvent) {
			// Yes.  Then our connection attempt failed.
			
			// An error occurred during the connection.
			if (self.isRetryConnectionInProgress) {
				console.warn(errPrefix, 'Retry connection attempt failed.  Still waiting for server to come alive. ');
				
				// Clear the retry connection in progress flag or we won't try to
				//  connect again.
				self.isRetryConnectionInProgress = false;
			}
			else {
				// Start the retry interval to attempt to reconnect
				//  at a late time.
				console.warn(errPrefix, 'Connection attempt failed.  Starting reconnect interval.');
				
				// Start a timer to reconnect to the WebSockets server.
				self.startReconnectInterval(methodName);
			}
		} else {
			let errMsg =
				errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
			
			console.error(errPrefix + `err object:`);
			console.dir(err, {depth: null, colors: true});
			
			console.error(errPrefix, `Giving up.  Not attempting to reconnect to the WebSockets server.`);
		}
	};
	
	
	// EVENT: OPEN
	this.onOpen = async function() {
		let methodName = self.constructor.name + '::' + `onOpen`;
		let errPrefix = '(' + methodName + ') ';
		
		// Set the appropriate flags and kill any existing reconnect
		//  interval objects.
		self.isConnected = true;
		self.isRetryConnectionInProgress = false;
		await self.clearReconnectInterval();
		
		console.info(errPrefix, 'Successfully connected to the websocket server.');
	};
	
	// EVENT: CLOSE
	//
	// IMPORTANT: See the note about the onError and onClose events
	//  in the connectToServer() method!
	this.onClose = async function() {
		let methodName = self.constructor.name + '::' + `onClose`;
		let errPrefix = '(' + methodName + ') ';
		
		self.isConnected = false;
		console.info(errPrefix, 'Connection lost to the websocket server.  Attempting to reconnect..');
		
		// Start a timer to reconnect to the WebSockets server.
		self.startReconnectInterval(methodName);
	};
	
	// EVENT: MESSAGE
	this.onMessage = async function(event) {
		const eventDataObj = JSON.parse(event.data);
		// messages.forEach(addMessage);
		
		console.info(errPrefix, `Message received.`)
		console.info(errPrefix + `event.data object:`);
		console.dir(event.data, {depth: null, colors: true});
		
		// Call the designated callback handler with the received data.
		self.funcOnMessage(eventDataObj);
	};
	
	this.clearReconnectInterval = async function() {
		let errPrefix = `(clearReconnectInterval) `;
		
		if (self.reconnectTimerObj) {
			clearInterval(self.reconnectTimerObj);
			self.reconnectTimerObj = null;
		}
	}
	
	// -------------------- END  : EVENT HANDLERS ------------
	
	/**
	 * Send a JSON plain object to the websockets server.
	 *
	 * @param {Object} payloadObj - The object to send.
	 */
	this.sendToServer = function(payloadObj) {
		let methodName = self.constructor.name + '::' + `sendToServer`;
		let errPrefix = '(' + methodName + ') ';
		
		try {
			if (!misc_shared_lib.isNonNullObjectAndNotArray(payloadObj))
				throw new Error(errPrefix + `The payloadObj is not a valid object.`);
				
			// Make sure we are connected.
			if (!self.isConnected)
				throw new Error(errPrefix + `We are not currently connected to the webSockets server.  Ignoring send request.`);
				
			let strPayloadObj = JSON.stringify(payloadObj);
			
			console.info(errPrefix, `Sending websockets payload to server:`);
			console.info(errPrefix, strPayloadObj);
			self.webSocketClient.send(strPayloadObj);
		}
		catch(err) {
		    // Print the error to the console.
		    let errMsg =
		        errPrefix + misc_shared_lib.conformErrorObjectMsg(err);
		    
		    console.error(errMsg)
		}
	}
	
	/**
	 * This is the function called by the auto-reconnect timer.
	 */
	this.reconnect = async function() {
		let methodName = self.constructor.name + '::' + `reconnect`;
		let errPrefix = '(' + methodName + ') ';
		
		// Do not make duplicate reconnection attempts.
		if (self.isConnected) {
			console.warn(errPrefix, `Ignoring WebSockets reconnection request because we are already connected.`);
			
			// Clear the interval.
			await self.clearReconnectInterval();
		}
		else if (self.isRetryConnectionInProgress) {
			console.warn(errPrefix, `Ignoring duplicate WebSockets reconnection request since one is already in progress already in progress.`);
		}
		else {
			// Set the flag that tells us not to try and
			//  execute the reconnect process multiple times
			//  because an existing one is in progress.
			self.isRetryConnectionInProgress = true;

			console.warn(errPrefix, `Attempting to reconnect to the WebSockets server.`);
			await self.connectToServer();
		}
	}
	
	/**
	 * This function starts the reconnect interval.
	 *
 	 * @param {String} callerName - The function that
 	 *  called us.
	 */
	this.startReconnectInterval = function(callerName) {
		let methodName = self.constructor.name + '::' + `startReconnectInterval`;
		let errPrefix = '(' + methodName + ') ';
		
		if (misc_shared_lib.isEmptySafeString(callerName))
			throw new Error(errPrefix + `The callerName parameter is empty.`);
			
		console.info(errPrefix, `Starting reconnect interval at the request of: ${callerName}.`);
		self.reconnectTimerObj = setInterval(self.reconnect, 1000);
	}
}