// This module contains objects and code to interact with the Ghostmarket API.

// 'https://api.ghostmarket.io/api/v1/assets?order_by=mint_date&order_direction=asc&offset=0&limit=50&with_total=0&fiat_currency=USD&auction_state=all&auction_started=all&creator=SOMNIUMWAVE&grouping=0&only_verified=0&price_similar=0&price_similar_delta=0&light_mode=0';

// The base URL for all cals to version 1 of the MAIN Ghostmarket API.
//  This URL will only return assets that were minted on the MAIN
//  network for the target blockchain, NOT the TEST network.
import {g_NftManagerForGhostmarket} from "../neo/nft/buy-ghostmarket-nft.js";

const GHOSTMARKET_API_BASE_URL_V1_MAIN = 'https://api.ghostmarket.io/api/v1';
const GHOSTMARKET_API_BASE_URL_V1_TEST = 'https://api3.ghostmarket.io:7061/api/v1';

const bVerbose = true;

/**
 * This object helps build a Ghostmarket API call that retrieves assets
 *  (NFTs) from the Ghostmarket inventory.
 *  
 * @constructor
 */
function GmGetAssetCallBuilder() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    // TODO: Create property help for these fields.
    // The relevant fields to a Ghostmarket API call with their default values.
    //  NOTE: Any fields with a NULL value should be omitted from the API
    //   request call!
    this.urlArguments = {
        'order_by': 'mint_date',
        'order_direction': 'asc',
        'offset': 0,
        'limit': 50,
        'with_total': 0,
        'fiat_currency': 'USD',
        'auction_state': 'all',
        // Do not use ALL.  That filters out auctions that have not started
        //  or never start like fixed_price auctions.
        'auction_started': null,
        'creator': null,
        'grouping': 0,
        'only_verified': 0,
        'price_similar': 0,
        'price_similar_delta': 0,
        'light_mode': 0
    };

    /**
     * This method builds the URL for a Ghostmarket API call that retrieves
     *  a list of NFTs that match the search criteria implied by our
     *  current URL argument properties.
     *
     * @param {Boolean} bTestNet - If TRUE, the call will be made
     *  against the Ghostmarket API that returns auctions from
     *  the host blockchain TEST network or MAIN network.  If
     *  FALSE, it will ONLY return inventory from the host
     *  blockchain's MAIN network.  Set this to FALSE when
     *  going to production since the MAIN API URL is
     *  more reliable.
     *
     * @return {string}
     */
    this.buildRequestUrl = function(bTestNet=false) {
        const methodName = self.constructor.name + '::' + `buildRequestUrl`;
        const errPrefix = '(' + methodName + ') ';

        if (typeof bTestNet !== 'boolean')
        	throw new Error(errPrefix + `The value in the bTestNet parameter is not boolean.`);

        const useBaseUrl = (bTestNet) ? GHOSTMARKET_API_BASE_URL_V1_TEST : GHOSTMARKET_API_BASE_URL_V1_MAIN;
        let retUrl = `${useBaseUrl}/assets`;

        let bFirst = true;

        //  Build the URL. Exclude any URL argument properties that have NULL values.
        for (let propKey in self.urlArguments) {
            const propValue = self.urlArguments[propKey];

            const prefixChar = bFirst ? '?' : '&';
            bFirst = false;

            // Is it non-NULL?
            if (propValue !== null) {
                // Yes.  Add the property value to the API call we are building.
                retUrl += `${prefixChar}${propKey}=${propValue}`;
            }
        }

        // We only want NEO N3 auctions/assets.
        const chainName = bTestNet ? 'n3t' : 'n3';
        retUrl += `&chain=${chainName}`;

        return retUrl;
    }
}

/**
 * Client side test of the Ghostmarket API that retrieves a
 *  list of NFTs (assets).
 *
 * @return {Promise<Object>} - A promise that resolves to an object
 *  that contains the search results of the Ghostmarket API call
 *  that retrieves assets.
 */
function testGhostMarketAssetCall_promise() {
	let errPrefix = '(testGhostMarketAssetCall_promise) ';

	return new Promise(function(resolve, reject) {
		try	{
            // Get SomniumWave's NFTs from the Ghostmarket inventory.

            const assetRequestBuilerObj = new GmGetAssetCallBuilder();
            assetRequestBuilerObj.url_arg_creator = 'SOMNIUMWAVE';

            // TRUE means use the Ghostmarket TEST API, which will return
            //  search results for inventory/NFTs minted on EITHER the
            //  host blockchain MAIN or TEST network.
            const assetRequestUrl = assetRequestBuilerObj.buildRequestUrl(true);

            if (bVerbose) {
                console.log(`${errPrefix}Requesting assets from Ghostmarket using URL: ${assetRequestUrl}`);
            }

			xhrGet_promise(assetRequestUrl)
			.then(result => {
                console.info(`${errPrefix}result of Ghostmarket API assets retrieval test: ${result}`);
				console.info(errPrefix + `result object:`);
				console.dir(result, {depth: null, colors: true});

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
 * Test bidding on a TestNet minted NFT on Ghostmarket.
 *
 * @param {Number} idOfAuction - The desired auction ID to bid on.
 *
 * @return {Promise<void>}
 */
async function testNftBid_async(idOfAuction) {
    const errPrefix = `(testNftBig_async) `;

    if (typeof idOfAuction !== 'number')
    	throw new Error(errPrefix + `The value in the idOfAuction parameter is not a number.`);

    if (idOfAuction < 0)
        throw new Error(errPrefix + `The idOfAuction parameter is negative: ${idOfAuction}.`);

    // const bIsAvailable = await g_NftManagerForGhostmarket.isNftAvailable_promise('somniumwave', 141, true)
    const orderObj = await g_GhostMarketApiHelper.getAuctionDetails_promise('somniumwave', idOfAuction, true)
    .catch(err => {
        // Convert the error to a promise rejection.
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(`${errPrefix}${errMsg}`);
    });

    if (!orderObj) {
        alert('Sorry!  That NFT has been sold.');
        return;
    }

    const result = await g_NftManagerForGhostmarket.bidOnNftViaNeoline_promise(idOfAuction, orderObj.price)
    .catch(err => {
        // Convert the error to a promise rejection.
        let errMsg =
            errPrefix + misc_shared_lib.conformErrorObjectMsg(err);

        console.error(`${errPrefix}${errMsg}`);
    });

    console.info(errPrefix + `Ghostmarket auction bid, result object:`);
    console.dir(result, {depth: null, colors: true});
}

/**
 * This object provides methods to interact with the Ghostmarket API.
 *
 * @constructor
 */
function GhostmarketApiHelper() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /**
     * This function returns the embedded assets array if the given
     *  progressEvent object contains a valid Ghostmarket search
     *  results listing.  Otherwise it returns NULL  It does
     *  a deep property path inspection.
     *
     * @param {Object} progressEvent - A progressEvent object received
     *  from an AJAX request to the Ghostmarket asset search API.
     *
     * @returns {Array<Object>|null} - If a valid Ghostmarket asset
     *  search results object is found in the progressEvent object,
     *  it is returned.  Otherwise NULL is returned.
     */
    this.extractAssetsArray = function(progressEvent) {
        const methodName = self.constructor.name + '::' + `extractAssetsArray`;
        const errPrefix = '(' + methodName + ') ';

        if (!misc_shared_lib.isNonNullObjectAndNotArray(progressEvent))
        	return null;

        if (!('currentTarget' in progressEvent))
            return null;
        if (!('response' in progressEvent.currentTarget))
            return null;
        if (!('assets' in progressEvent.currentTarget.response))
            return null;
        if (!Array.isArray(progressEvent.currentTarget.response.assets))
        	return null;

        return progressEvent.currentTarget.response.assets;
    }

    /**
     * Get the NFT collection for a particular creator.
     *
     * @param {String} creatorName - The creator whose NFT
     *  collection we want to query.
     *
     * @param {Boolean} bTestNet - If TRUE, the call will be made
     *  against the Ghostmarket API that returns auctions from
     *  the host blockchain TEST network or MAIN network.  If
     *  FALSE, it will ONLY return inventory from the host
     *  blockchain's MAIN network.  Set this to FALSE when
     *  going to production since the MAIN API URL is
     *  more reliable.
     *
     * @return {Promise<Object>} - A promise that resolves to an object
     *  that contains the search results of the Ghostmarket API call
     *  that retrieves assets.
     */
    this.getNftCollection_promise = function(creatorName, bTestNet=false) {
        let errPrefix = '(getNftCollection_promise) ';

        if (misc_shared_lib.isEmptySafeString(creatorName))
            throw new Error(errPrefix + `The creatorName parameter is empty.`);
        if (typeof bTestNet !== 'boolean')
            throw new Error(errPrefix + `The value in the bTestNet parameter is not boolean.`);

        return new Promise(function(resolve, reject) {
            try	{
                // Get SomniumWave's NFTs from the Ghostmarket inventory.

                const assetRequestBuilerObj = new GmGetAssetCallBuilder();
                assetRequestBuilerObj.urlArguments.creator = creatorName;

                // TRUE means use the Ghostmarket TEST API, which will return
                //  search results for inventory/NFTs minted on EITHER the
                //  host blockchain MAIN or TEST network.
                const assetRequestUrl = assetRequestBuilerObj.buildRequestUrl(bTestNet);

                if (bVerbose) {
                    console.log(`${errPrefix}Requesting assets from Ghostmarket using URL: ${assetRequestUrl}`);
                }

                xhrGet_promise(assetRequestUrl)
                    .then(result => {
                        console.info(`${errPrefix}result of Ghostmarket API assets retrieval test: ${result}`);
                        console.info(errPrefix + `result object:`);
                        console.dir(result, {depth: null, colors: true});

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
     * Get the details for a specific auction.
     *
     * @param {String} creatorName - The creator whose NFT
     *  collection we want to query.
     * @param {Number} idOfAuction - The ID of the desired auction.
     * @param {Boolean} bTestNet - If TRUE, the call will be made
     *  against the Ghostmarket API that returns auctions from
     *  the host blockchain TEST network or MAIN network.  If
     *  FALSE, it will ONLY return inventory from the host
     *  blockchain's MAIN network.  Set this to FALSE when
     *  going to production since the MAIN API URL is
     *  more reliable.
     *
     * @return {Promise<Object>} - A promise that resolves to an object
     *  that contains the auction object associated with the given auction
     *  ID or NULL if the auction information is not available.
     */
    this.getAuctionDetails_promise = function(creatorName, idOfAuction, bTestNet=false) {
        let errPrefix = '(testGhostMarketAssetCall_promise) ';

        if (misc_shared_lib.isEmptySafeString(creatorName))
            throw new Error(errPrefix + `The creatorName parameter is empty.`);
        if (typeof idOfAuction !== 'number')
        	throw new Error(errPrefix + `The value in the idOFAuction parameter is not a number.`);
        if (idOfAuction < 0)
            throw new Error(errPrefix + `The idOfAuction parameter is negative: ${idOfAuction}.`);
        if (typeof bTestNet !== 'boolean')
            throw new Error(errPrefix + `The value in the bTestNet parameter is not boolean.`);

        // TODO: See if there is a way to get just one auction details object
        //  from the Ghostmarket API.
        return new Promise(function(resolve, reject) {
            try	{
                self.getNftCollection_promise(creatorName, bTestNet)
                .then(result => {
                    // Validate the progress event object and extract the
                    //  embedded Ghostmarket assets search results object.
                    const aryAssetObjs = self.extractAssetsArray(result)

                    // Find the desired auction.
                    let bFoundIt = false;
                    let foundAuctionObj = null;
                    let orderNum = 0;

                    for (let assetObj of aryAssetObjs) {
                        if (bVerbose) {
                            console.info('-----------------------');
                        }

                        // Reset the ordinal order number tracker.
                        orderNum = 0;

                        // Show the item name.
                        if (bVerbose) {
                            console.info(`${errPrefix}Auction Asset name: ${assetObj.nft.nft_metadata.name}.`);
                            console.info(`${errPrefix}Auction asset description: ${assetObj.nft.collection.description}.`);
                            console.info(`${errPrefix}Auction metedata description: ${assetObj. nft.nft_metadata.description}.`)
                        }

                        // Any auctions?
                        if (assetObj.orders && assetObj.orders.length > 0) {
                            // Find the desired auction.
                            for (let orderObj of assetObj.orders) {
                                if (bVerbose) {
                                    console.info(`${errPrefix}Showing details of order[${orderNum}].`);
                                    console.dir(orderObj, {depth: null, colors: true});
                                    console.info(`Auction ID: ${orderObj.contract_auction_id}.`);
                                }

                                if (bVerbose) {
                                    console.info(`${errPrefix}Comparing contract_auction_id(${orderObj.contract_auction_id}) to idOfAuction: ${idOfAuction}.`);
                                }

                                if (orderObj.contract_auction_id === idOfAuction.toString()) {
                                    bFoundIt = true;
                                    foundAuctionObj = orderObj;
                                    break;
                                }
                                orderNum++;
                            }

                        }

                        if (bFoundIt)
                            break;
                    }

                    resolve(foundAuctionObj);
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
}

const g_GhostMarketApiHelper = new GhostmarketApiHelper();

export {g_GhostMarketApiHelper, testGhostMarketAssetCall_promise, testNftBid_async}