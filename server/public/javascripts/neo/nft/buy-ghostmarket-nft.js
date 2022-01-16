// This module contains the code to purchase an NFT from the Ghostmarket trading
//  contract.

import {DEFAULT_NEO_TRANSACTION_FEE, g_NeoLineHelper} from "../neoline-helpers.js";
import {base58Decode} from "../../base-format/base-x.js";
import {BigNumber} from "../../../javascripts/bignumber/bignumber.js";
import {g_GhostMarketApiHelper} from "../../ghostmarket/ghostmarket-api-helper.js";

/**
 * This function checks to see if the given string is a hexstring.
 *  Note, an empty string IS considered a hexstring.
 */
function isHex(str) {
    try {
        return hexRegex.test(str);
    }
    catch (err) {
        return false;
    }
}

/**
 * Throws an error if input is not hexstring.
 */
function ensureHex(str) {
    if (!isHex(str)) {
        throw new Error(`Expected a hexstring but got ${str}`);
    }
}

/**
 * Reverses a HEX string, treating 2 chars as a byte.
 *
 * @example
 * reverseHex('abcdef') = 'efcdab'
 */
function reverseHex(hex) {
    ensureHex(hex);
    let out = "";
    for (let i = hex.length - 2; i >= 0; i -= 2) {
        out += hex.substr(i, 2);
    }
    return out;
}

/**
 * Convert an N3 address to a script hash.  Neoline has its
 *  own version of this method.
 *
 * @param {String} address - The N3 address to convert.
 *
 * @return {*}
 */
function getScriptHashFromAddress (address) {
    const errPrefix = `(getScriptHashFromAddress) `;


    if (misc_shared_lib.isEmptySafeString(address))
        throw new Error(errPrefix + `The address parameter is empty.`);

    const decodedBase58 = base58Decode.decode(address);

    const hash = ab2hexstring(decodedBase58);

    return reverseHex(hash.substr(2, 40))
}

/**
 * Converts a number to a hex string that is compatible with NEO
 *  N3 BigInteger as ByteArray/string format.
 *
 * @param {Number} num - The number to convert to a BigInteger
 *  formatted byte string (ByteArray).
 *
 * @return {string}
 */
function numberToByteString (num) {
    const errPrefix = `(numberToByteString) `;

    const bnFromObj = BigNumber.from(num);
    const hexStrFromBn = bnFromObj.toHexString();

    const h = hexStrFromBn.substr(2);
    let hex = h.length % 2 ? '0' + h : h;
    const fc = hex.charAt(0);

    if ((fc > '7' && fc <= '9') || (fc >= 'a' && fc <= 'f')) {
        hex = '00' + hex;
    }

    const temp1 = hex.match(/.{1,2}/g);

    if (!temp1)
        throw new Error(`${errPrefix}The hex.match() operation resulted in a NULL result.`);

    return btoa(
        temp1
        .reverse()
        .map((v) => String.fromCharCode(parseInt(v, 16)))
        .join('')
    );
}


/*
 * JSON objects needed to make an invoke call against the Ghostmarket trading
 *  contract.
 */

// Important constants.
const NEO_N3_GAS_CONTRACT_MAINNET = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
const NEO_N3_GAS_CONTRACT_TESTNET = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
const GHOSTMARKET_TRADING_CONTRACT_MAINNET = '0xcc638d55d99fc81295daccbaf722b84f179fb9c4';
const GHOSTMARKET_TRADING_CONTRACT_TESTNET = '0x590635eaf2364ba03dade7ed9a54efa20d72eba9';
const METHOD_BID_TOKEN = 'bidToken';

/**
 * This singleton object helps facilitate NFT related operations.
 *
 * @constructor
 */
function NftManagerForGhostmarket() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /**
     * Build the custom data arguments for an invoke call to the wallet.
     *
     * @param {String} buyerN3ScriptHash - The N3 address of the buyer
     *  in script hash format.  The buyer is the current user, using
     *  this dApp to bid on a Ghostmarket NFT..
     * @param {Number} auctionId - The ID of the auction to place a
     *  bid against.
     * @param priceNFTFormatted - The price of the NFT in the auction,
     *  already in BigInteger format.  This value can be taken from
     *  the auction_id field received from a call to the GhostMarket
     *  API. Property path: nft.auction.contract_auction_id
     * @param {Boolean} [bIsTestnet] - If TRUE, then the arguments will
     *  be built for a TestNet transaction.  Otherwise FALSE is used.
     *
     * @return {Object|null} - Returns a fully assembled custom data object
     *  that contains the parameters to make a Ghostmarket bidToken
     *  invoke call using the user's wallet, if the build operation
     *  was successful.  Otherwise NULL is returned.
     */
    this.buildArgsForGhostmarketBid = function(buyerN3ScriptHash, auctionId, priceNFTFormatted, bIsTestnet=true) {
        const methodName = self.constructor.name + '::' + `buildArgsForGhostmarketBid`;
        const errPrefix = '(' + methodName + ') ';

        try {
            if (misc_shared_lib.isEmptySafeString(buyerN3ScriptHash))
                throw new Error(errPrefix + `The buyerN3ScriptHash parameter is empty.`);
            if (typeof auctionId !== 'number')
                throw new Error(errPrefix + `The value in the auctionId parameter is not a number.`);
            if (auctionId <= 0)
                throw new Error(errPrefix + `Invalid auction ID, less than or equal to zero: ${auctionId}.`);
            if (misc_shared_lib.isEmptySafeString(priceNFTFormatted))
                throw new Error(errPrefix + `The priceNFTFormatted parameter is empty.`);
            if (typeof bIsTestnet !== 'boolean')
                throw new Error(errPrefix + `The value in the bIsTestnet parameter is not boolean.`);

            const auctionIdAsByteString = numberToByteString(auctionId);


            // Create the arguments array needed to call the bidToken method
            //   on the Ghostmarket trading contract.  Remember, there is no
            //   "buy" call.  When an NFT is actually transferred depends on the
            //   the auction type: Dutch / classic / reserve / fixed price.
            let allowedContracts = [];

            // The NEO N3 GAS contract and the Ghostmarket trading contract
            //  must be in the allowed contracts list.
            if (bIsTestnet) {
                allowedContracts.push(GHOSTMARKET_TRADING_CONTRACT_TESTNET);
                allowedContracts.push(NEO_N3_GAS_CONTRACT_TESTNET);
            } else {
                allowedContracts.push(GHOSTMARKET_TRADING_CONTRACT_MAINNET);
                allowedContracts.push(NEO_N3_GAS_CONTRACT_MAINNET);
            }

            // If you want the equivalent of a "buy it now" auction, so that
            //  the bidToken results in an immediate sale/transfer, then use
            //  a "fixed price" auction.
            const argsBidToken =
                [
                    {
                        type: 'Hash160', // UInt160 from
                        // value: getScriptHashFromAddress(buyerN3Address)
                        value: buyerN3ScriptHash
                    },
                    {
                        type: 'ByteArray', // ByteString auctionId
                        value: auctionIdAsByteString
                    },
                    {
                        type: 'Integer', // BigInteger price
                        value: priceNFTFormatted
                    }
                ];

            const signers = [
                {
                    // account: getScriptHashFromAddress(buyerN3Address),
                    account: buyerN3ScriptHash,
                    // Grant necessary permissions to the NEO N3 GAS
                    //  contract and the Ghostmarket trading contract
                    //  to facilitate the transaction, via the correct
                    //  scopes field value.  The Ghostmarket trading
                    //  contract will effect the transfer of the
                    //  buyer's GAS tokens to the itself by interacting
                    //  directly with the NEO N3 GAS contract.
                    scopes: 16,
                    allowedContracts
                }
            ]

            const invokeParams = {
                scriptHash: bIsTestnet ? GHOSTMARKET_TRADING_CONTRACT_TESTNET : GHOSTMARKET_TRADING_CONTRACT_MAINNET,
                operation: METHOD_BID_TOKEN,
                args: argsBidToken,
                signers
            }

            return invokeParams;
        }
        catch(err) {
            const errMsg =
                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

            console.error(`${errPrefix}${errMsg}.`);
            return null;
        }
    }

    /**
     * Given the name of an NFT creator and an auction ID, see if the
     *  NFT is still available.
     *
     * @param {String} creatorName - The name of the NFT author.
     * @param {Number} idOfAuction - The ID of the desired auction
     *  for the desired NFT.
     *
     *
     *  @returns - This promise resolves to TRUE if the auction is
     *   still valid, or FALSE if it is not.
     */
    this.isNftAvailable_promise = function (creatorName, idOfAuction, bTestNet=false) {
        const methodName = self.constructor.name + '::' + `isNftAvailable_promise`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(creatorName))
            throw new Error(errPrefix + `The creatorName parameter is empty.`);
        if (typeof idOfAuction !== 'number')
            throw new Error(errPrefix + `The value in the idOFAuction parameter is not a number.`);
        if (idOfAuction < 0)
            throw new Error(errPrefix + `The idOfAuction parameter is negative: ${idOfAuction}.`);
        if (typeof bTestNet !== 'boolean')
            throw new Error(errPrefix + `The value in the bTestNet parameter is not boolean.`);

    	return new Promise(function(resolve, reject) {
    		try	{


    			// Get the auction details.  If we get a NULL
                //  response, the NFT associated with the auction
                //  is no longer available.
                g_GhostMarketApiHelper.getAuctionDetails_promise(creatorName, idOfAuction, bTestNet)
    			.then(result => {
                    const bIsAvailable = (typeof result === 'object');
                    resolve(result);
    			})
    			.catch(err => {
    				// Convert the error to a promise rejection.
    				let errMsg =
    					errPrefix + conformErrorObjectMsg(err);

    				reject(errMsg + ' - promise');
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
     * This promise makes a bid on the Ghostmarket auction whose
     *  ID is passed in, via an invoke request sent to the Neoline
     *  wallet (Chrome extension).
     *
     * @param {Number} auctionId - The auction ID of the auction that
     *  is being bid on.
     * @param priceNFTFormatted - The price of the NFT in the auction,
     *  already in BigInteger format.  This value can be taken from
     *  the auction_id field received from a call to the GhostMarket
     *  API. Property path: nft.auction.contract_auction_id
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
    this.bidOnNftViaNeoline_promise = function( auctionId, priceNFTFormatted, transactionFee=DEFAULT_NEO_TRANSACTION_FEE) {
        const methodName = self.constructor.name + '::' + `bidOnNftViaNeoline_promise`;
        const errPrefix = '(' + methodName + ') ';

        // This variable tells the error block if an error that
        //  was thrown came from us or the Neoline extension.
        let bIsNeolineError = false;

        return new Promise(function(resolve, reject) {
            try	{
                if (!g_NeoLineHelper.isNeoLineReady)
                    throw new Error(errPrefix + `The NeoLine Chrome extension is not ready yet.`);

                if (typeof auctionId !== 'number')
                    throw new Error(errPrefix + `The value in the auctionId parameter is not a number.`);
                if (auctionId < 1)
                    throw new Error(errPrefix + `The value in the auctionId parameter is less than one.`);

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

                bIsNeolineError = true;
                neo3Obj.pickAddress()
                    .then(result => {
                        bIsNeolineError = false;

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

                        bIsNeolineError = true;
                        return neo3Obj.AddressToScriptHash({address: thePickedaddress});
                    })
                    .then(result => {
                        bIsNeolineError = false;

                        // The result should be an object with a single field named "scriptHash".
                        if (!misc_shared_lib.isNonNullObjectAndNotArray(result))
                            throw new Error(errPrefix + `The result of the AddressToScriptHash() call is not a valid object.`);
                        thePickedAddressAsScriptHash = result.scriptHash;

                        if (misc_shared_lib.isEmptySafeString(thePickedAddressAsScriptHash	))
                            throw new Error(errPrefix + `The result of the AddressToScriptHash() call is not a valid string.`);

                        // >>>>> STEP: Ask NeoLine to execute the desired blockchain transaction.

                        // Build the invoke parameters for the transaction.
                        const invokeParams = self.buildArgsForGhostmarketBid(thePickedAddressAsScriptHash, auctionId, priceNFTFormatted)

                        if (!invokeParams)
                            throw new Error(errPrefix + `The operation to build the inovke parameters failed.`);

                        operationStep = `Invoking transaction with script hash made from the user's N3 address: ${thePickedAddressAsScriptHash}.`;
                        console.info(errPrefix + `Executing step: ${operationStep}.`);

                        bIsNeolineError = true;
                        return neo3Obj.invoke(invokeParams);
                    })
                    .then(result => {
                        bIsNeolineError = false;

                        const resultStr = JSON.stringify(result);
                        console.info(`${errPrefix}Result of the Neoline invoke call: ${resultStr}.`);
                        // Resolve the promise with TRUE to let the caller know that the transaction was successful.
                        resolve(true);
                    })
                    .catch(err => {
                        console.info(`${errPrefix}In error handling block.  Analyzing.`);
                        let errMsg = `(No error message set).`;

                        // Did the error come from us?
                        if (!bIsNeolineError) {
                            // Yes.  Standard error reporting.
                            // Convert the error to a promise rejection.
                            errMsg =
                                errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

                            reject(errMsg + ' - promise');
                            return;
                        }

                        // Neoline throws a tuple isntead of a single
                        //  error object. Interpret the error into something
                        //  more detailed.
                        //
                        // Note: If the user cancels a NeoLine request, the NeoLine extension
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
     * This function facilitates the purchase of an in-world NFT from
     *  the Ghostmarket trading contract.
     */
    this.purchaseNFt = function() {
        const methodName = self.constructor.name + '::' + `purchaseNFt`;
        const errPrefix = '(' + methodName + ') ';

        // For now, make a test call against the Ghostmarket API.  This
        //  call gets SomniumWave's collection across all NFTs.
        const testGhostmarketApiUrl = 'https://api.ghostmarket.io/api/v1/assets?order_by=mint_date&order_direction=asc&offset=0&limit=50&with_total=0&fiat_currency=USD&auction_state=all&auction_started=all&creator=SOMNIUMWAVE&grouping=0&only_verified=0&price_similar=0&price_similar_delta=0&light_mode=0';

        alert('The purchase of NFTs is not yet implemented.');
    }
}

const g_NftManagerForGhostmarket = new NftManagerForGhostmarket();

export {
    g_NftManagerForGhostmarket
};