// This file contains code that helps with interacting with the
//	NeoLine Chrome extension.

// NOTE: See the file named buy-ghostmarket-nft for the code
//  that interacts with the NeoLine extension to make Ghostmarket
//  NFT bids.

// The default NEO transaction fee.
const DEFAULT_NEO_TRANSACTION_FEE = 0.0001;

// The asset symbol for NEO GAS tokens, the native
//  currency used by our NEO smart contracts.
const ASSET_SYMBOL_NEO_GAS = 'GAS';

/**
 * A simple class to hold a blockchain account along with a label
 * 	that describes it.
 *
 * @param  {String} accountAddress - The account address.
 * @param {String} accountLabel - A label that describes the account address.
 *
 * @constructor
 */
function AccountLabelAndAddress(accountAddress, accountLabel) {
	const self = this;
	const methodName = self.constructor.name + '::' + `constructor`;
	const errPrefix = '(' + methodName + ') ';

	/** @property {string} - A randomly generated unique ID for this object. */
	this.id = misc_shared_lib.getSimplifiedUuid();
	
	/** @property {Date} - The date/time this object was created. */
	this.dtCreated = Date.now();
	
	if (misc_shared_lib.isEmptySafeString(accountAddress))
		throw new Error(errPrefix + `The accountAddress parameter is empty.`);
	
	if (misc_shared_lib.isEmptySafeString(accountLabel))
		throw new Error(errPrefix + `The accountLabel parameter is empty.`);
	
	/** @property {String} - The account address. */
	this.accountAddress = accountAddress;
	
	/** @property {String} - A label that describes the account address. */
	this.accountLabel = accountLabel;	
}

/**
 * This function converts an integer to BigInteger format by
 * 	multiplying by the BigInteger multiplier and then
 * 	truncated to an integer.
 *
 * @param {Number} theNumber - The number to transform.
 *
 * @return {number} - The number in BigInteger format.
 */
function upsizeToBigInteger(theNumber) {
	let errPrefix = `(upsizeToBigInteger) `;
	
	if (typeof theNumber !== 'number')
		throw new Error(errPrefix + `The value in the theNumber parameter is not number.`);

	return Math.trunc( theNumber * price_shared_lib.BIGINTEGER_MULTIPLIER);
}

/**
 * Convert a price so one that it is denominated in a desired
 * 	smart contract's native currency.
 *
 * @param {Number} assetPrice - The price of the asset.
 * @param {String} assetDenominatedInCurrency - The asset symbol
 * 	for the currency the assetPrice is denominated in.
 * @param {String} smartContractCurrency - The asset symbol
 * 	for the currency used natively by the relevant smart
 * 	contract.
 * @param {Number} sccCurrentPrice - The current price for the
 * 	smart contract currency.
 * @param {String} sccDenominatedInCurrency - The asset symbol
 * 	for the currency the sccCurrentPrice is denominated in.
 * @param {Boolean} bUpsizeToBigInteger - If TRUE, then
 * 	the resulting price will be upsized to BigInteger
 * 	format.  If FALSE, then it won't be upsized.
 *
 * @return {Number} - Returns the BigInteger encoding of the
 * 	given float, denominated in the smart contract
 * 	currency.
 */
function convertFloatToSccCurrency(
		assetPrice,
		assetDenominatedInCurrency,
		smartContractCurrency,
		sccCurrentPrice,
		sccDenominatedInCurrency,
		bUpsizeToBigInteger) {
	let errPrefix = `(convertFloatToBigIntInSccCurrency) `;
	
	const validatedAssetPrice = price_shared_lib.validatePrice(assetPrice, false, false);
	
	if (validatedAssetPrice === null)
		throw new Error(errPrefix + `The asset price is not valid: ${validatedAssetPrice}.`);
		
	if (misc_shared_lib.isEmptySafeString(assetDenominatedInCurrency))
		throw new Error(errPrefix + `The denominatedInCurrency parameter is empty.`);
		
	if (misc_shared_lib.isEmptySafeString(smartContractCurrency))
		throw new Error(errPrefix + `The smartContractCurrency parameter is empty.`);

	const validatedSccPrice = price_shared_lib.validatePrice(sccCurrentPrice, false, false);
	
	if (validatedSccPrice === null)
		throw new Error(errPrefix + `The smart contract currency price is not valid: ${validatedSccPrice}.`);
	if (misc_shared_lib.isEmptySafeString(sccDenominatedInCurrency))
		throw new Error(errPrefix + `The sccDenominatedInCurrency parameter is empty.`);
		
	if (typeof bUpsizeToBigInteger !== 'boolean')
		throw new Error(errPrefix + `The value in the bUpsizeToBigInteger parameter is not boolean.`);
		
	// If the asset symbol and the smart contract currency are not the
	//  same, then we must divide the asset price by the smart contract
	//  currency price first to make sure everything is denominated
	//  in the currency used natively by the relevant smart contract.
	let newAssetPrice = validatedAssetPrice;
		/* This function only works if the smart contract
		 * 	price parameter is denominated in the same currency
		 * 	as the asset price!  (e.g. - If the asset price is
		 * 	Bitcoin denominated in USD, and the smart contract
		 * 	currency is NEO, then the smart contract price
		 * 	parameter must be denominated in USD as well).
		 */
	if (assetDenominatedInCurrency !== smartContractCurrency) {
		// The two prices must be denominated in the same
		//  currency.
		if (assetDenominatedInCurrency !== sccDenominatedInCurrency)
			throw new Error(errPrefix + `The asset price("${assetDenominatedInCurrency}") is not denominated in the same currency as the smart contract currency price("${sccDenominatedInCurrency}").`);
	
		// Renumerate the asset price in the smart contract
		//  price.
		newAssetPrice = newAssetPrice/validatedSccPrice;
	}
	
	// Upsize the value to BigInteger format?
	let retVal;
	
	if (bUpsizeToBigInteger)
		retVal = upsizeToBigInteger(newAssetPrice);
	else
		retVal = newAssetPrice;
		
	return retVal;
}

/**
 * This object provides helper functions for interacting with the NeoLine
 * 	Chrome extension.
 *
 * @constructor
 */
function NeoLineHelper() {
	const self = this;
	let methodName = self.constructor.name + '::' + `constructor`;
	let errPrefix = '(' + methodName + ') ';
	
	/** @property {string} - A randomly generated unique ID for this object. */
	this.id = misc_shared_lib.getSimplifiedUuid();
	
	/** @property {Date} - The date/time this object was created. */
	this.dtCreated = Date.now();
	
	/** @property {Boolean} - If FALSE, then we have not received the ready event
	* 	yet from the NeoLine Chrome extension.  Once we have, this field will
	* 	be set to TRUE. */
	this.isNeoLineReady = false;
	
	// Listen for the event from the NeoLineN3 extension that tells
	//	us it is ready for use.
	window.addEventListener('NEOLine.N3.EVENT.READY', () => {
		console.log(`NEOLineN3 ready event received.`);
		
		// Don't call any NeoLine functions here.  At the time this
		//  was written, you will get the error shown below if you try.
		//	Move any such code out of this event listener with a
		//	setTimeout() operation.
		//
		// Error message:
		//
		//	neoline-n3-test.html:66 Uncaught ReferenceError: Cannot access 'neolineN3' before initialization
		//
		
		// Set the ready flag.  NeoLine is now ready.
		self.isNeoLineReady = true;
	});
	
	/**
	 * This promise asks NeoLine to ask the user to select a public
	 * 	address from their account list.
	 *
	 * @return {Promise<AccountLabelAndAddress>} - The promise resolves
	 *  to a AccountLabelAndAddress object if the operation succeeded,
	 * 	or FALSE if the user cancels the purchase operation, or it
	 * 	rejects if an error occurs.
	 */
	this.pickAddress_promise = function() {
		const methodName = self.constructor.name + '::' + `pickAddress_promise`;
		const errPrefix = '(' + methodName + ') ';
		
		return new Promise(function(resolve, reject) {
			try	{
				const neo3Obj = new window.NEOLineN3.Init();
	
				let pickedAddressAndLabelObj = null;
				
				// >>>>> STEP: Have the use choose the public address they wish to use
				//  for making a payment.
				let operationStep = 'allowing user to select the desired public address';
				console.info(errPrefix + `Executing step: ${operationStep}.`);
				
				neo3Obj.pickAddress()
				.then(result => {
					if (!misc_shared_lib.isNonNullObjectAndNotArray(result))
						throw new Error(errPrefix + `The result of the NeoLine pickAddress() call is not a valid object.`);
						
					if (misc_shared_lib.isEmptySafeString(result.address))
						throw new Error(errPrefix + `The object that is the result of the NeoLine pickAddress() call has an invalid "address" field.`);
						
					if (misc_shared_lib.isEmptySafeString(result.label))
						throw new Error(errPrefix + `The object that is the result of the NeoLine pickAddress() call has an invalid "label" field.`);
						
					pickedAddressAndLabelObj = new AccountLabelAndAddress(result.address, result.label);
					
					// Resolve the promise with the picked address.
					resolve(pickedAddressAndLabelObj);
				})
				.catch(err => {
					console.info(errPrefix + `In error handling block.  Analyzing.`);
					let errMsg = `(No error message set).`;
					
					// If the user cancels a NeoLine request, the NeoLine extension
					//  throws an error of type "CANCELED" (one "L").
					const {type, description, data} = err;
					switch(type) {
						case 'CANCELED':
							console.warn(errPrefix + `The user cancelled the NeoLine request during operation step: ${operationStep}.`);
							alert(`Transaction cancelled.`);
							// Resolve the promise with FALSE.
							resolve(false);
							break;
						case 'NO_PROVIDER':
							errMsg = errPrefix + `NeoLine error reported: Unable to determine a provider for NEO blockchain services.`;
							console.error(errMsg);
							break;
						case 'CONNECTION_REFUSED':
							errMsg = errPrefix + `NeoLine error reported: The NEO RPC endpoint refused to connect.`;
							console.error(errMsg);
							break;
						case 'RPC_ERROR':
							errMsg = errPrefix + `NeoLine error reported: Unable to broadcast the transaction to the NEO blockchain network.`;
							console.error(errMsg);
							break;
						default:
							errMsg = errPrefix + `Unknown or invalid error type reported by the NeoLine extension.`;
							console.error(errMsg);
							console.info(errPrefix + `err object:`);
							console.dir(err, {depth: null, colors: true});
							break;
					}
				});
			}
			catch(err) {
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + conformErrorObjectMsg(err);
				
				reject(errMsg + ' - try/catch');
			}
		});
	}
	
	/**
	 * This promise sends a transaction to the GasToken smart contract on
	 * 	the NEO blockchain using the NeoLine Chrome extension, that will
	 * 	be relayed to the target smart contract when the GAS contract
	 * 	calls the target contract's OnNEP17Payment() method.
	 *
	 * @param {String} targetContractScriptHash - The smart contract that
	 *  is the target of the payment.
	 * @param {Number} amountNeoGas - the amount of NEO GAS to send with the
	 * 	transaction, NOT upsized to BigInteger format.
	 * @param {Array} aryArgs - The array of arguments to poss along with the
	 * 	send transaction call.  These arguments end up in the "data[]" parameter
	 * 	in the smart contract onNEP17Payment() event handler, when the GasToken
	 * 	contract calls that method after successfully processing the payment.
	 * 	It may be empty, but it must be an array.
	 * @param {Number} transactionFee - The amount of NEO GAS to pay as the
	 * 	desired transaction fee (i.e. - processing fee).  Higher amounts
	 * 	result in higher priority for submitted transactions.
	 *
	 * @return {Promise<Boolean>} - The promise resolves to a simple boolean
	 * 	TRUE if the submission of the transaction succeeds, FALSE if the
	 * 	user cancels the purchase operation, or it rejects if there
	 * 	is an error.
	 *
	 * NOTE: Remember to wait for the transaction confirmation event, which
	 * 	occurs asynchronously after submitting a transaction to the blockchain.
	 */
	this.makeNeochexGasPaymentViaNeoLine_promise = function(targetContractScriptHash, amountNeoGas, aryArgs, transactionFee=DEFAULT_NEO_TRANSACTION_FEE) {
		const methodName = self.constructor.name + '::' + `makeNeochexGasPaymentViaNeoLine_promise`;
		const errPrefix = '(' + methodName + ') ';
		
		return new Promise(function(resolve, reject) {
			try	{
				if (!g_NeoLineHelper.isNeoLineReady)
					throw new Error(errPrefix + `The NeoLine Chrome extension is not ready yet.`);
					
				if (typeof amountNeoGas !== 'number')
					throw new Error(errPrefix + `The value in the amountNeoGas parameter is not a number.`);
				if (amountNeoGas < 1)
					throw new Error(errPrefix + `The value in the amountNeoGas parameter is less than one.`);
				if (!Array.isArray(aryArgs))
					throw new Error(errPrefix + `The aryArgs parameter value is not an array.`);

				/*
				// Get the Neochex script hash from the environment.
				const neochexScriptHash = g_GlobalNamespaces.instance.serverConfigVars.neochex_script_hash;
				
				if (misc_shared_lib.isEmptySafeString(neochexScriptHash))
					throw new Error(errPrefix + `The neochexScriptHash server configuration field is empty.`);
					
				const gasTokenScriptHash = g_GlobalNamespaces.instance.serverConfigVars.gastoken_script_hash;
				
				if (misc_shared_lib.isEmptySafeString(gasTokenScriptHash))
					throw new Error(errPrefix + `The gasTokenScriptHash server configuration field is empty.`);
				 */
					
				const neo3Obj = new window.NEOLineN3.Init();
	
				/* TODO: Put this event listener somewhere more sensible.
				window.addEventListener('NEOLine.NEO.EVENT.TRANSACTION_CONFIRMED', (data) => {
					console.log('NEOLineN3 transaction confirmed received.');
					if (g_LastPaymentTxId === data.detail.txid) {
						// Payment confirmed.
						console.log(errPrefix + "Transaction with ID(${data.detail.txid}) has been confirmed.");
					}
				});
				 */
				 
				let theLabelOfPickedAddress = null;
				let thePickedaddress = null;
				let thePickedAddressAsScriptHash = null;
				
				// >>>>> STEP: Have the user choose the public address they wish to use
				//  for making a payment.
				let operationStep = 'allowing user to select the desired public address';
				console.info(errPrefix + `Executing step: ${operationStep}.`);
				
				neo3Obj.pickAddress()
				.then(result => {
					if (!misc_shared_lib.isNonNullObjectAndNotArray(result))
						throw new Error(errPrefix + `The result of the NeoLine pickAddress() call is not a valid object.`);
						
					if (misc_shared_lib.isEmptySafeString(result.address))
						throw new Error(errPrefix + `The object that is the result of the NeoLine pickAddress() call has an invalid "address" field.`);
						
					if (misc_shared_lib.isEmptySafeString(result.label))
						throw new Error(errPrefix + `The object that is the result of the NeoLine pickAddress() call has an invalid "label" field.`);
						
					thePickedaddress = result.address;
					theLabelOfPickedAddress = result.label;
					
					// >>>>> STEP: Convert the picked address to a script hash.
					operationStep = `Converting picked address(${thePickedaddress}) to a script hash`;
					console.info(errPrefix + `Executing step: ${operationStep}.`);
					
					return neo3Obj.AddressToScriptHash({address: thePickedaddress});
				})
				.then(result => {
					// The result should be an object with a single field named "scriptHash".
					if (!misc_shared_lib.isNonNullObjectAndNotArray(result))
						throw new Error(errPrefix + `The result of the AddressToScriptHash() call is not a valid object.`);
					thePickedAddressAsScriptHash = result.scriptHash;
					
					if (misc_shared_lib.isEmptySafeString(thePickedAddressAsScriptHash	))
						throw new Error(errPrefix + `The result of the AddressToScriptHash() call is not a valid string.`);
					
					// >>>>> STEP: Ask NeoLine to execute the desired blockchain transaction.
					operationStep = `Invoking transaction with script hash: ${thePickedAddressAsScriptHash}.`;
					console.info(errPrefix + `Executing step: ${operationStep}.`);
		
					return neo3Obj.invoke({
							scriptHash: gasTokenScriptHash,
							operation: 'transfer',
						args: [
								{
									// From - the user sending the transaction
									"type": "Address",
									"value" : thePickedaddress
								},
								{
									// To - the smart contract that should receive the payment.
									"type": "Hash160",
									"value": targetContractScriptHash
								},
								{
									// Amount - the amount to send with the transaction
									"type": "Integer",
									"value": amountNeoGas.toString()
								},
								{
									// data[] object that the GasToken contract will pass
									//  to our smart contract's onNEP17Payment()
									//	public method.
									"type": "Array",
									"value": aryArgs
								},
							],
							fee: transactionFee.toString(),
							broadcastOverride: false,
							signers: [
								{
									account: thePickedAddressAsScriptHash,
									scopes: 1
								}
							],
						});
					})
					.then(result => {
						console.log('Read invocation result: ' + JSON.stringify(result));
						
					})
					.catch(err => {
						console.info(errPrefix + `In error handling block.  Analyzing.`);
						let errMsg = `(No error message set).`;
						
						// If the user cancels a NeoLine request, the NeoLine extension
						//  throws an error of type "CANCELED" (one "L").
						const {type, description, data} = err;
						switch(type) {
							case 'CANCELED':
								console.warn(errPrefix + `The user cancelled the NeoLine request during operation step: ${operationStep}.`);
								alert(`Transaction cancelled.`);
								// Resolve the promise with FALSE.
								resolve(false);
								break;
							case 'NO_PROVIDER':
								errMsg = errPrefix + `NeoLine error reported: Unable to determine a provider for NEO blockchain services.`;
								console.error(errMsg);
								break;
							case 'CONNECTION_REFUSED':
								errMsg = errPrefix + `NeoLine error reported: The NEO RPC endpoint refused to connect.`;
								console.error(errMsg);
								break;
							case 'RPC_ERROR':
								errMsg = errPrefix + `NeoLine error reported: Unable to broadcast the transaction to the NEO blockchain network.`;
								console.error(errMsg);
								break;
							default:
								errMsg = errPrefix + `Unknown or invalid error type reported by the NeoLine extension.`;
								console.error(errMsg);
								console.info(errPrefix + `err object:`);
								console.dir(err, {depth: null, colors: true});
								break;
						}
					});
			}
			catch(err) {
				// Convert the error to a promise rejection.
				let errMsg =
					errPrefix + conformErrorObjectMsg(err);
				
				reject(errMsg + ' - try/catch');
			}
		});
	}
}

/**
 * Singleton pattern.
 */
const g_NeoLineHelper = new NeoLineHelper();

export {g_NeoLineHelper, DEFAULT_NEO_TRANSACTION_FEE}