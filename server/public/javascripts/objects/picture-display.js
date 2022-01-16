// This module contains the code for the picture display objects.  These objects display a picture on each surface of the cube built to represent the object.

import * as THREE from '../threejs/build/three.module.js';
import * as POINTERLOCK from "../threejs/examples/pointerlock.js"
//import * as PARTICIPANT_SUPPORT from "../objects/object-picture display-support";
//import {SPATIAL_AUDIO_FIELD_WIDTH, SPATIAL_AUDIO_FIELD_HEIGHT} from "../dolby-io/ui.js";
//import {THREEJS_WORLD_AUDIO_DISTANCE_THRESHOLD} from "../threejs/examples/pointerlock.js";
//import {g_ParticipantWrapperManager} from "../participant-helpers/participant-helper-objects";
import * as PARTICIPANT_SUPPORT from "./object-participant-support.js";
import {g_ThreeJsCamera} from "./three-js-global-objects.js";
//import {TelevisionDisplay} from "./television";
import GifLoader from '../three-js-gif-loader/gif-loader.js';
import * as THREEJSSUPPORT from "../threejs-support/threejs-support-code.js";
import {trueDistanceFromObject3D} from "./object-participant-support.js";


// Regex to check valid URL
//
// Full URL with protocol prefix.
// const regexIsUrl_1  = new RegExp("((http|https)://)(www.)?[a-zA-Z0-9@:%._\\+~#?&//=]{2,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%._\\+~#?&//=]*)");

// Local URL, no protocol prefix.
// const regexIsUrl_2  = new RegExp("(.|..)*(\\/[a-zA-Z0-9\\-\\_]+)+\\.(png|jpg)");

// This is the distance in ThreeJS world units that an object must be from a picture display
//  before we consider it within the picture display's activation range.
const MAX_DISTANCE_FROM_PICTURE_DISPLAY_FOR_ACTIVATION = 1;

const bVerbose = true;

/**
 * Check if a string is a URL or not.
 *
 * @param {String} srcUrl - The string to check.
 *
 * @return {boolean} - Returns TRUE if the string is a URL,
 *  FALSE if not.
 */
function isStringAUrl(srcUrl) {
    const errPrefix = `(isStringAUrl) `;

    if (misc_shared_lib.isEmptySafeString(srcUrl))
        throw new Error(errPrefix + `The srcUrl parameter is empty.`);

    console.info(`${errPrefix} Checking if the string is a URL: ${srcUrl}.`);

    const srcUrlLowerCase = srcUrl.toLowerCase();

    // WARNING!  These regular expressions were disabled because they
    //  hung not only the browser when testing certain URLs, but also
    //  locked up the DevTools debugger.  The first one worked
    //  but the second one locked up.  That is why we switched to a
    //  simple extension test.
    //
    // return regexIsUrl_1.test(srcUrl) || regexIsUrl_2.test(srcUrl);

    if (srcUrlLowerCase.endsWith(".png") || srcUrlLowerCase.endsWith(".jpg"))
        return true;
    else
        return false;
}

/**
 * Converts a surface name to the correct width and height
 *  values that should be used from an XYZ dimensions vector
 *  to stretch an image to the correct size for that surface.
 *
 * @param {String} surfaceName - A valid cube surface name.
 * @param {THREE.Vector3} dimensions - The XYZ dimensions of the object.
 *
 * @return {{width: *, height: *}} - Returns an object with the
 *  width and height values that should be used to stretch an
 *  image for the specified surface name.
 */
function surfaceNameToWidthHeight(surfaceName, dimensions) {
    if (!THREEJSSUPPORT.isValidSurfaceName(surfaceName))
        throw new Error(errPrefix + `The surface name is not valid: ${surfaceName}.`);

    let widthForCalcs = null;
    let heightForCalcs = null;

    // Determine which dimension pair to use for the stretch.
    if (surfaceName === 'neg_x' || surfaceName === 'pos_x') {
        // Z-Y plane. (Thin sides of picture display.)
        widthForCalcs = dimensions.z;
        heightForCalcs = dimensions.y;
    } else if (surfaceName === 'neg_y' || surfaceName === 'pos_y') {
        // X-Z plane. (Thin top and bottom of picture display.)
        widthForCalcs = dimensions.x;
        heightForCalcs = dimensions.z;
    } else if (surfaceName === 'neg_z' || surfaceName === 'pos_z') {
        // X-Y plane.
        widthForCalcs = dimensions.x;
        heightForCalcs = dimensions.y;
    } else {
        throw new Error(errPrefix + `Don't know how to handle surface name: ${surfaceName}.`);
    }

    if (heightForCalcs <= 0 || widthForCalcs <= 0)
        throw new Error(errPrefix + `Invalid width and height found before doing image stretching operation: ${widthForCalcs} x ${heightForCalcs}.`);

    return { width: widthForCalcs, height: heightForCalcs };
}

/**
 * Given an array of extended cube materials, detect any surfaces that
 *  are bearing images and stretch the images to fit the size of the
 *  surface.
 *
 * WARNING: You must call this function AFTER the images have been
 *  loaded for the cube!  Otherwise the texture image field will
 *  be NULL!
 *
 * @param {Object} theTexture - A ThreeJS texture object.
 */
function stretchImageToFitSurface(theTexture, widthHeightObj) {
    const errPrefix = `(stretchImageToFitSurface) `;

    if (!misc_shared_lib.isNonNullObjectAndNotArray(theTexture))
    	throw new Error(errPrefix + `The theTexture is not a valid object.`);
    if (!misc_shared_lib.isNonNullObjectAndNotArray(widthHeightObj))
    	throw new Error(errPrefix + `The widthHeightObj is not a valid object.`);

    // console.warn(`${errPrefix}The stretchImageToFitSurface function is not yet implemented.`);
    // return;

    // Stretch the image to fit the surface.
    theTexture.matrixAutoUpdate = false;

    // const aspectRatio = window.innerWidth / window.innerHeight;
    if (!widthHeightObj.width || widthHeightObj.width <= 0 || !widthHeightObj.height || widthHeightObj.height <= 0)
        throw new Error(errPrefix + `The widthHeightObj.width is not valid.`);
    const aspectRatio = widthHeightObj.width / widthHeightObj.height;
    const imageAspect = theTexture.image.width / theTexture.image.height;

    if (aspectRatio < imageAspect)
        theTexture.matrix.setUvTransform(0, 0, aspectRatio / imageAspect, 1, 0, 0.5, 0.5);
    else
        theTexture.matrix.setUvTransform(0, 0, 1, imageAspect / aspectRatio, 0, 0.5, 0.5);
}

/**
 * Load a GIF file using the given URL and build a material
 *  from the texture that is created from it.
 *
 * @param {String} urlToGif - The URL to the GIF file.
 *
 * @return {MeshBasicMaterial}
 */
function createMaterialFromGif(urlToGif) {
    const errPrefix = `(createMaterialFromGif) `;

    if (misc_shared_lib.isEmptySafeString(urlToGif))
        throw new Error(errPrefix + `The urlToGif parameter is empty.`);

    if (!urlToGif.toLowerCase().endsWith('.gif'))
        throw new Error(errPrefix + `The urlToGif parameter is not a gif file: ${urlToGif}.`);

    const loader = new GifLoader();

    // load a image resource
    const texture = loader.load(
        // resource URL
        urlToGif,

        // onLoad callback
        function (reader) {
            // The GifLoader documentation says that we probably don't
            //  need to set onLoad, as it is handled for you. However,
            // if you want to manipulate the reader, you can do so here:
            console.info(`${errPrefix}Number of GIF frames read: ${ reader.numFrames()}.`);
        },

        // onProgress callback
        function (xhr) {
            console.info(`${errPrefix}${(xhr.loaded / xhr.total * 100)}% loaded for GIF file: ${urlToGif}.`);
        },

        // onError callback
        function (err) {
            console.error(`${errPrefix}Error loading GIF file: ${urlToGif}.`);
            console.info(errPrefix + `err object:`);
            console.dir(err, {depth: null, colors: true});
        }
    );

    // Build a MeshBasicMaterial from the text and return it.
    const retMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });

    return retMaterial;
}

/**
 * Given a URL to an image, build a ThreeJS texture from it.
 *
 * @param {String} srcUrl - A URL to an image.
 * @param {Boolean} bIsRepeated - Whether or not the texture should be repeated.
 * @param {Object} theTexture - A ThreeJS texture object.
 *
 * @return {MeshBasicMaterial} - Returns a ThreeJS MeshBasicMaterial object
 *  built from the image at the given URL.
 */
function createMaterialFromImage(srcUrl, bIsRepeated=false) {
    const errPrefix = `(createMaterialFromImage) `;

    if (misc_shared_lib.isEmptySafeString(srcUrl))
        throw new Error(errPrefix + `The srcUrl parameter is empty.`);
    // Make sure an attempt to load a GIF file is not made with
    //  this function.
    if (srcUrl.toLowerCase().endsWith('.gif'))
        throw new Error(errPrefix + `The srcUrl parameter is a GIF file: ${srcUrl}.`);

    if (typeof bIsRepeated !== 'boolean')
    	throw new Error(errPrefix + `The value in the bIsRepeated parameter is not boolean.`);

    const threeJsMaterial = new THREE.MeshBasicMaterial();

    if (bVerbose) {
        console.info(`${errPrefix}Loading image: ${srcUrl}.`);
    }

    const loader = new THREE.TextureLoader().load(
        // resource URL
        srcUrl,
        // This function fires when the resource is loaded.
        function ( theTexture ) {
            // If the image is to be repeated, set the wrap
            //  properties to THREE.RepeatWrapping, otherwise
            //  use the default wrapping which is THREE.ClampToEdgeWrapping.
            theTexture.wrapS = bIsRepeated ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
            theTexture.wrapT = bIsRepeated ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

            // Assign the texture value to the material map when the texture is loaded.
            threeJsMaterial.map = theTexture;

            if (bVerbose)
                console.info(`${errPrefix}Resource LOADED: ${srcUrl}.`);
        },
        // This function will be called as the download of an
        //  image progresses.
        function ( xhr ) {
            if (bVerbose) {
                const pctLoaded = xhr.loaded / xhr.total * 100;

                console.info(`${errPrefix}${pctLoaded}}% loaded.  Resource: ${srcUrl}.`);
            }
        },
        // This function will be called in the event of an error.
        function ( xhr ) {
            console.error( `${errPrefix} Download failed for resource: ${srcUrl}.`);
        }
    );

    // Return the threeJsMaterial we created the desired image.
    return threeJsMaterial;
}

/**
 * This object contains 6 properties, one for each surface of a cube.
 *  Each property contains either a color value or an image URL.
 *  Set the properties that you want to have non-black colors or
 *  an image.  This object is passed to the PictureDisplay() constructor
 *  to help it build the cube that represents the picture display.
 *
 * @constructor
 */
function CubeAssetsColorsOrUrls() {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    // See aryCubeSurfaceNames to understand these properties.
    /*
    this.neg_x = 0x000000;
    this.pos_x = 0x000000;
    this.neg_y = 0x000000;
    this.pos_y = 0x000000;
    this.neg_z = 0x000000;
    this.pos_z = 0x000000;
    
     */
    this.neg_x = 'mediumspringgreen';
    this.pos_x = 'mediumspringgreen';
    this.neg_y = 'mediumspringgreen';
    this.pos_y = 'mediumspringgreen';
    this.neg_z = 'mediumspringgreen';
    this.pos_z = 'mediumspringgreen';
}

/**
 * Helper object to track attributes related to various materials
 *  that are created when constructing a mesh.
 *
 * @constructor
 */
function ExtendedMaterial(){
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {String} - The surface name this material is intended for. */
    this.surfaceName = null;

    /** @property {Object} - The ThreeJS object that is the material. */
    this.materialContent = null;

    /** @property {Boolean} - If TRUE, then the material is an image,
     *  if not, then FALSE */
    this.isImage = false;
}

/**
 * Helper object to extract the ThreeJS material content from a
 *  an array of ExtendedMaterial objects.
 *
 * @param {Array<ExtendedMaterial>} aryExtendedMaterials - An array of
 *  ExtendedMaterial objects.
 *
 * @return {Array<Object>} - An array of ThreeJS material objects.
 */
function extendedMaterialsToThreeJsMaterials(aryExtendedMaterials) {
    const errPrefix = `(extendedMaterialsToThreeJsMaterials) `;

    if (!Array.isArray(aryExtendedMaterials))
    	throw new Error(errPrefix + `The aryExtendedMaterials parameter value is not an array.`);
    if (aryExtendedMaterials.length < 0)
    	throw new Error(errPrefix + `The aryExtendedMaterials parameter value is an empty array.`);

    const aryThreeJsMaterials = [];

    // We must use the surface name properties instead of iterating the
    //  the extended material array with a for loop because the
    // Mesh() constructor expects the materials to be in
    // -x, +x, -y, +y, -z, +z order.
    /*
    aryExtendedMaterials.forEach(function(extendedMaterial) {
        if (extendedMaterial.isImage) {
            aryThreeJsMaterials.push(extendedMaterial.materialContent);
        } else {
            aryThreeJsMaterials.push(new THREE.MeshBasicMaterial({
                color: extendedMaterial.materialContent
            }));
        }
    });
    */

    aryExtendedMaterials.forEach(function(extendedMaterial) {
        aryThreeJsMaterials.push(extendedMaterial.materialContent);
    });

    return aryThreeJsMaterials;
}

/**
 * Helper object to contain the materials created for a cube.
 *
 * @param {CubeAssetsColorsOrUrls} cubeAssetsColorsOrUrls - A CubeAssetsColorsOrUrls
 *  to initialize this object.
 *
 * @constructor
 */
function CubeMaterials(cubeAssetsOrUrlObjs, dimensions) {
    const self = this;
    const methodName = self.constructor.name + '::' + `constructor`;
    const errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    if (!(cubeAssetsOrUrlObjs instanceof CubeAssetsColorsOrUrls))
        throw new Error(errPrefix + `The value in the cubeAssetsOrUrlObjs parameter is not a CubeAssetsColorsOrUrls object.`);

    if (!(dimensions instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the dimensions parameter is not a THREE.Vector3 object.`);

    /** @property {THREE.Vector3} - The XYZ dimension for the cube we are
     *   helping to build. */
    this.dimensions = dimensions;

    // These properties represent the surfaces of the cube,
    //  one pair for each axis (XYZ).  The will be filled in
    //  or changed by the PictureDisplay() object as needed.
    //  Each property will contain an extended material object.
    this.neg_x = null;
    this.pos_x = null;
    this.neg_y = null;
    this.pos_y = null;
    this.neg_z = null;
    this.pos_z = null;

    /**
     * Assign the given color value or image URL to the desired
     *  surface.  Create either a THREE.COLOR() or THREE.MeshBasicMaterial()
     *  object as needed.
     *
     * @param {String} surfaceName - The name of the surface to assign the asset to.
     * @param {String|Number} numberOrStringVal - Either a color value in numeric
     *  form, or in string form, or a URL.
     */
    this.assignAsset = function(surfaceName, numberOrStringVal) {
        const methodName = self.constructor.name + '::' + `assignAsset`;

        if (!THREEJSSUPPORT.isValidSurfaceName(surfaceName))
            throw new Error(errPrefix + `The surfaceName parameter is not a valid surface name.`);

        if (misc_shared_lib.isEmptySafeString(numberOrStringVal))
            throw new Error(errPrefix + `The newAsset parameter is empty.`);

        // If there is an existing asset, then remove it.
        if (self[surfaceName] && self[surfaceName].materialContent !== null) {
            // Is it a ThreeJS object or any other object that has a dispose method?
            if (typeof self[surfaceName].materialContent.dispose !== undefined)
                // Yes. Call its dispose method.
                self[surfaceName].materialContent.dispose();
        }

        // Assign the new asset to the surface.
        self[surfaceName] = new ExtendedMaterial();
        self[surfaceName].surfaceName = surfaceName;

        // Is it a URL?
        if (isStringAUrl(numberOrStringVal)) {
            // Yes, it is a URL.  Create a new material from the URL
            //  and assign it to the surface.

            console.info(`${errPrefix} - Creating a new THREE.MeshBasicMaterial() object from the URL: ${numberOrStringVal}.`);

            let theMaterial = null;

            // Is it a GIF URL?
            if (numberOrStringVal.toLowerCase().endsWith('.gif'))
                // Yes, use the GIF loader.
                theMaterial = createMaterialFromGif(numberOrStringVal);
            else
                // No, use the regular image loader.
                theMaterial = createMaterialFromImage(numberOrStringVal);

            if (!theMaterial)
                throw new Error(errPrefix + `Unable to find a suitable image loader for URL: ${numberOrStringVal}.`);

            self[surfaceName].materialContent = theMaterial;
            self[surfaceName].isImage = true;
        }
        else {
            // No, it is not a URL.  Assume it is a color value
            //  and assign a color to the surface.

            // Is it a number or a string?
            if (typeof numberOrStringVal === 'number' || typeof numberOrStringVal === 'string') {
                // Yes.  Assume it is a color value.
                self[surfaceName].materialContent = new THREE.MeshBasicMaterial( {color: new THREE.Color(numberOrStringVal) } );
            }
            else {
                // No, it is not a number or a string.  For now that
                //  is an error.
                throw new Error(errPrefix + `The new asset value is not a number or a string.`);
            }
        }
    };

    /**
     * Initialize this object from a CubeAssetsColorsOrUrls object.
     *
     * @param {CubeAssetsColorsOrUrls} cubeAssetIdsOrUrls - A
     *  CubeAssetsColorsOrUrls that contains the color values
     *  and/or image URLs to use for the cube surfaces.
     */
    this.initializeFromObj = function(cubeAssetIdsOrUrlsObj ) {
        const methodName = self.constructor.name + '::' + `initializeFromObj`;
        const errPrefix = '(' + methodName + ') ';

        if (!(cubeAssetIdsOrUrlsObj instanceof CubeAssetsColorsOrUrls))
            throw new Error(errPrefix + `The value in the cubeAssetIdsOrUrls parameter is not a CubeAssetsColorsOrUrls object.`);

        for (let surfaceName in cubeAssetIdsOrUrlsObj) {
            // Ignore non-surface name properties.
            if (THREEJSSUPPORT.isValidSurfaceName(surfaceName)) {
                const colorOrImageUrl = cubeAssetIdsOrUrlsObj[surfaceName];
                self.assignAsset(surfaceName, colorOrImageUrl);
            }
        }
    }

    /**
     * Use this function when creating the cube.
     *
     * @return {Array<ExtendedMaterial>} -
     *  Returns a MeshFaceMaterial object made from the contents of this object.
     *  The returned object can be used to construct a cube.
     */
    this.toCubeMaterialsExtendedArray = function() {
        const methodName = self.constructor.name + '::' + `toCubeMaterialsExtendedArray`;
        const errPrefix = '(' + methodName + ') ';

        let aryCubeMaterialsExt = [];

        /*
        for (let propKey in self) {
            // Is it one of our cube surface properties?
            if (THREEJSSUPPORT.isValidSurfaceName(propKey)) {
                const threeJsMaterialExtended = self[propKey];

                // The assignAsset() method will interpolate the string
                //  or number we found in the property's value to the
                //  correct color or image material object.
                aryCubeMaterialsExt.push(threeJsMaterialExtended);
            }
        }

         */

        // Push the materials in the order they are expected
        //  by a cube object.
        /*
        aryCubeMaterialsExt.push(self.neg_x);
        aryCubeMaterialsExt.push(self.pos_x);
        aryCubeMaterialsExt.push(self.neg_y);
        aryCubeMaterialsExt.push(self.pos_y);
        aryCubeMaterialsExt.push(self.neg_z);
        aryCubeMaterialsExt.push(self.pos_z);
         */
        aryCubeMaterialsExt.push(self.pos_x);
        aryCubeMaterialsExt.push(self.neg_x);
        aryCubeMaterialsExt.push(self.pos_y);
        aryCubeMaterialsExt.push(self.neg_y);
        aryCubeMaterialsExt.push(self.pos_z);
        aryCubeMaterialsExt.push(self.neg_z);

        return new THREE.MeshFaceMaterial( aryCubeMaterialsExt );
    }

    // ---------------------- CONSTRUCTOR CODE ----------------
    // Initialize this object using the given CubeAssetsColorsOrUrls object.
    this.initializeFromObj(cubeAssetsOrUrlObjs);
}

/**
 * This object contains the functions that are used to manage the picture display
 *  behavior in Neoland.
 *
 * @param {String} pictureDisplayId - A unique but human friendly name to assign to the ID.
 * @param {CubeAssetsColorsOrUrls} cubeAssetsOrUrlObjs - A CubeAssetsColorsOrUrls
 *  object that contains the asset identifiers used to build the faces of the cube.
 * @param {THREE.Vector3} position - The position of the picture display
 *  in the scene.
 * @param {THREE.Vector3} rotation - The object will be rotated
 *  to face this direction given in this Euler angle.
 * @param {THREE.Vector3} dimensions - The width, height, and depth
 *  of the picture display in the scene, in ThreeJS world units.
 * @param {Function|null} funcActivate - The function that will be called
 *   when any participant comes enter our activation zone.
 * @param {Function|null} funcDeactivate - The function that will be called
 *   when all participant have left our activation zone.
 * @param {Number} activationDistance - If a participant comes within this distance
 *   from the picture display object, the activation function will be
 *   called.  Once all participants have moved outside this distance,
 *   the deactivation function will be called.
 *
 * @constructor
 */
function PictureDisplay(pictureDisplayId, cubeAssetsOrUrlObjs,  position, rotation, dimensions, funcActivate=null, funcDeactivate=null, activationDistance=MAX_DISTANCE_FROM_PICTURE_DISPLAY_FOR_ACTIVATION) {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    // Validate parameters.
    if (misc_shared_lib.isEmptySafeString(pictureDisplayId))
        throw new Error(errPrefix + `The pictureDisplayId parameter is empty.`);
    if (!(cubeAssetsOrUrlObjs instanceof CubeAssetsColorsOrUrls))
        throw new Error(errPrefix + `The value in the cubeSurfWithAssetsObj parameter is not a CubeAssetsColorsOrUrls object.`);

    if (typeof activationDistance !== 'number')
    	throw new Error(errPrefix + `The value in the activationDistance parameter is not a number.`);
    if (activationDistance < 0)
    	throw new Error(errPrefix + `The value in the activationDistance parameter is less than zero.`);

    if (!(position instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the position parameter is not a THREE.Vector3 object.`);

    if (!(rotation instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the rotation parameter is not a THREE.Vector3 object.`);

    if (!(dimensions instanceof THREE.Vector3))
        throw new Error(errPrefix + `The value in the dimensions parameter is not a THREE.Vector3 object.`);

    if (funcActivate && typeof funcActivate !== 'function')
    	throw new Error(errPrefix + `The value in the funcActivate parameter is not NULL, yet it is not a function either.`);
    if (funcDeactivate && typeof funcDeactivate !== 'function')
        throw new Error(errPrefix + `The value in the funcDeactivate parameter is not NULL, yet it is not a function either.`);


    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {String} - A unique but human friendly name to assign to the ID. */
    this.idOfObject = pictureDisplayId;

    /** @property {Object|null} - This property keeps a reference to the
     *  the ThreeJS object that is created to represent this picture display
     *  in the scene. */
    this.threeJsAvatar = null;

    /** @property {Number} - If a participant comes within this distance
     *   from the picture display object, the activation function will be
     *   called.  Once all participants have moved outside this distance,
     *   the deactivation function will be called. */
    this.activationDistance = activationDistance;

    /** @property {THREE.Vector3} - The width, height, and depth
     *   of the cube that represents the television stored in the
     *   X, Y, and Z fields of a THREE.Vector3 object. */
    this.dimensions = dimensions;

    /** @property {THREE.Vector3} - The position where this
     *  object should be placed in the ThreeJS scene */
    this.position = position;

    /** @property {THREE.Vector3} - The object will be rotated
     *  to face this direction given in this Euler angle. */
    this.rotation = rotation;

    /** @property {Function|null} - The function that will be called
     *   when any participant comes enter our activation zone. */
    this.funcActivate = funcActivate;

    /** @property {Function|null} - The function that will be called
     *   when all participant have left our activation zone. */
    this.funcDeactivate = funcDeactivate;

    /** @property {Boolean} - If TRUE, then at least one participant
     *   is within our activation zone.  FALSE if not */
    this.isActive = false;

    /** @property {CubeMaterials} - The CubeMaterials object that contains
     *   the materials used to build the cube for this picture display.
     *   Initialize it using the give CubeAssetsColorsOrUrls object. */
    this.cubeMaterials = new CubeMaterials(cubeAssetsOrUrlObjs, self.dimensions);

    /** @property {Array<ExtendedMaterial>} - This array will be filled in
     *   when the cube color or URLs object is processed into the
     *   the actual cube content. */
    this.aryCubeMaterialsExt = null;

    /**
     * This function builds the ThreeJS object that will represent the
     *  picture display in the scene.
     *
     * @return {THREE.Mesh} - Returns a properly assembled ThreeJS
     *  mesh object to use as the user's world avatar.
     *
     * @private
     */
    this._buildThreeJSCube = function() {
        const methodName = self.constructor.name + '::' + `_buildThreeJSCube`;
        const errPrefix = '(' + methodName + ') ';

        // Create an array of materials for the cube using the
        //  CubeMaterials object.
        self.aryCubeMaterialsExt = self.cubeMaterials.toCubeMaterialsExtendedArray();

        // Cube dimensions.
        const cubeGeometry =
            new THREE.CubeGeometry(self.dimensions.x, self.dimensions.y, self.dimensions.z, 1, 1, 1);


        // Build the cube from the MeshFaceMaterial and CubeGeometry
        //   objects we built and return it.
        const newThreeJsObj = new THREE.Mesh( cubeGeometry,  extendedMaterialsToThreeJsMaterials(self.aryCubeMaterialsExt));

        // Give other code the ability to detect that this object
        //  is a picture display.
        newThreeJsObj.userData.neo3DParentObj = self;

        return newThreeJsObj;
    }

    /**
     * This function builds the ThreeJS object that will represent
     *  this picture display in the scene.  It does NOT
     *  add the object to the scene.
     *
     * @private
     */
    this._createThreeJSAvatar = function() {
        const methodName = self.constructor.name + '::' + `_createThreeJSAvatar`;
        const errPrefix = '(' + methodName + ') ';

        // Build the ThreeJS object that will represent this picture display.
        self.threeJsAvatar = self._buildThreeJSCube();

        // Default position for the avatar.
        self.threeJsAvatar.position.x = self.position.x;
        self.threeJsAvatar.position.y = self.position.y;
        self.threeJsAvatar.position.z = self.position.z;

        // Set the threeJsAvatar (mesh) rotation so that it faces in
        //  the direction given in the orientation parameter.
        self.threeJsAvatar.rotation.set(self.rotation.x, self.rotation.y, self.rotation.z);

        self.threeJsAvatar.scale.x = self.threeJsAvatar.scale.y = self.threeJsAvatar.scale.z = 1;

        // Set its "name" property to our ID.
        self.threeJsAvatar.name = self.idOfObject;
    }

    /**
     * This method updates the state of a picture display based on the current
     *  scene context.
     *
     * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
     *  The current list of participant objects in the scene.
     */
    this.updatePictureDisplay = function (aryParticipantWrapperObjs) {
        const methodName = self.constructor.name + '::' + `updatePictureDisplay`;
        const errPrefix = '(' + methodName + ') ';

        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        // TODO: Debug code.  Show the distance from the local user
        //  to this picture display.  The camera *is" the local user
        //  as far as we concerned, at least when it comes to the
        //  camera's position and orientation.
        if (false) {
            let distance =
                // Math.abs(self.threeJsAvatar.position.distanceTo(g_ThreeJsCamera.position));
                trueDistanceFromObject3D(self.threeJsAvatar.position, g_ThreeJsCamera.position);

            console.info(`${errPrefix}Distance from local user to picture display(${self.idOfObject}) is: ${distance}`);
        }

        // Update the state of the picture display based on the current world conditions
        //  and fire any functions triggered by the current world state.
        // if (self.idOfObject.indexOf('hongfei') > 0) {
        //     console.info(`${errPrefix}Updating picture display(${self.idOfObject})`);
        // }

        // Are any of the participant's within our "activation" distance?
        if (PARTICIPANT_SUPPORT.isAnyParticipantWithinActivationDistance(
            self.threeJsAvatar,
            aryParticipantWrapperObjs,
            self.activationDistance)) {
            // Yes, someone is near us.  Are we already activated?
            if (!self.isActive) {
                // No, we are not activated.  Call the activate function
                //  if we have one, and set the activated flag.
                if (self.funcActivate)
                    self.funcActivate(self);
                self.isActive = true;
            }
        } else {
            // No, we are "alone". Were we active?
            if (self.isActive) {
                // Yes.  Call the funcDeactivate function and clear the flag.
                if (self.funcDeactivate)
                    self.funcDeactivate(self);
                self.isActive = false;
            }
        }
    }

    /**
     * This method should be called when a picture display is removed or
     *  has changed status in a way that requires maintenance of the
     *  assets associated with the picture display.
     */
    this.cleanUp = function () {
        let methodName = self.constructor.name + '::' + `cleanup`;
        let errPrefix = '(' + methodName + ') ';

        console.info(`${errPrefix}Cleaning up picture display ${self.participantObj.id}`);

        // Remove the avatar from the scene.
        const bObjFoundAndRemoved = POINTERLOCK.removeObjFromSceneByUuid(self.threeJsAvatar.uuid);

        if (!bObjFoundAndRemoved)
            throw new Error(errPrefix + `The avatar object was not found in the scene and therefore the removal attempt was ignored for picture display ID: ${self.participantObj.id}.`);
    }


    // ---------------- CONSTRUCTOR CODE ----------------

    // Build the avatar for this picture display and place it in the
    //  the ThreeJS scene.
    // Build the avatar for this object and place it in the
    //  the ThreeJS scene.
    self._createThreeJSAvatar();
}

/**
 * This object maintains the list of PictureDisplay objects created
 *  for each picture display has they join/leave the conference.
 *
 * @constructor
 */
function PictureDisplayManager() {
    const self = this;
    let methodName = self.constructor.name + '::' + `constructor`;
    let errPrefix = '(' + methodName + ') ';

    /** @property {string} - A randomly generated unique ID for this object. */
    this.id = misc_shared_lib.getSimplifiedUuid();

    /** @property {Date} - The date/time this object was created. */
    this.dtCreated = Date.now();

    /** @property {Array<PictureDisplay>} - An object acting as an
     *  associative array of PictureDisplay objects where the
     *  picture display ID is the key and the PictureDisplay is the
     *  value. */
    this.aryPictureDisplayObjs = [];

    /**
     * Returns TRUE if we have a PictureDisplayDisplay object for the given
     *  picture display ID in our collection, FALSE if not.
     *
     * @param {String} idOfPictureDisplay - The ID to look for.
     *
     * @return {boolean}
     */
    this.isExistingPictureDisplayId = function(idOfPictureDisplay) {
        const methodName = self.constructor.name + '::' + `isExistingPictureDisplayId   `;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfPictureDisplay))
            throw new Error(errPrefix + `The idOfPictureDisplay parameter is empty.`);

        return (self.findPictureDisplayById(idOfPictureDisplay) !== null);
    }

    /**
     * Return our collection of picture display objects stored
     *  as properties belonging to an object as a simple array,
     *  for convenient iteration.
     */
    this.toArray = function() {
        const methodName = self.constructor.name + '::' + `toArray`;
        const errPrefix = '(' + methodName + ') ';

        let retAryPictureDisplayObjs = [];

        for (let propKey in self.aryPictureDisplayObjs) {
            const pictureDisplayObj = self.aryPictureDisplayObjs[propKey];

            retAryPictureDisplayObjs.push(pictureDisplayObj);
        }

        return retAryPictureDisplayObjs;
    }

    /**
     * Add a new picture display to the scene.
     *
     * @param {String} pictureDisplayId - A unique but human friendly name to assign to the ID.
     * @param {CubeAssetsColorsOrUrls} cubeAssetsOrUrlObjs - A CubeAssetsColorsOrUrls
     *  object that contains the asset identifiers used to build the faces of the cube.
     * @param {THREE.Vector3} position - The position of the television
     *  in the scene.
     * @param {THREE.Vector3} rotation - The picture display will be rotated
     *  to face this direction given in this Euler angle.
     * @param {THREE.Vector3} dimensions - The width, height, and depth
     *  of the television in the scene, in ThreeJS world units.
     * @param {Function|null} funcActivate - The function that will be called
     *   when any participant comes enter our activation zone.
     * @param {Function|null} funcDeactivate - The function that will be called
     *   when all participant have left our activation zone.
     * @param {Number} activationDistance - If a participant comes within this distance
     *   from the picture display object, the activation function will be
     *   called.  Once all participants have moved outside this distance,
     *   the deactivation function will be called.
     *
     * @return {PictureDisplay} - returns the PictureDisplay object that was
     *  created using the given input parameters.
     */
    this.addPictureDisplay = function (pictureDisplayId, cubeAssetsOrUrlObjs, position, rotation, dimensions, funcActivate=null, funcDeactivate=null, activationDistance=MAX_DISTANCE_FROM_PICTURE_DISPLAY_FOR_ACTIVATION) {
        let methodName = self.constructor.name + '::' + `addPictureDisplay`;
        let errPrefix = '(' + methodName + ') ';

        // Do not allow picture displays with the same ID.
        if (self.isExistingPictureDisplayId(pictureDisplayId))
            throw new Error(errPrefix + `A picture display with the ID: ${pictureDisplayId} already exists.`);

        // Let the PictureDisplay object validate the parameters.
        const newPictureDisplayObj =
            new PictureDisplay(pictureDisplayId, cubeAssetsOrUrlObjs, position, rotation, dimensions, funcActivate, funcDeactivate, activationDistance);

        // Assign it.
        self.aryPictureDisplayObjs[newPictureDisplayObj.idOfObject] = newPictureDisplayObj;

        return newPictureDisplayObj;
    }

    /**
     * This method removes the picture display object with the given ID
     *  from our collection of Picture displayDisplay object.
     *
     * @param {String} idOfPictureDisplay - The ID for the picture display that
     *  should be removed.
     */
    this.removePictureDisplay = function(idOfPictureDisplay) {
        let methodName = self.constructor.name + '::' + `removePictureDisplay`;
        let errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfPictureDisplay))
            throw new Error(errPrefix + `The idOfPictureDisplay parameter is empty.`);

        console.info(`${errPrefix}Removing picture display with ID: ${idOfPictureDisplay}`);

        // If there is no picture display with the given ID, then that is an error.
        const pictureDisplayObj = self.findPictureDisplayById(idOfPictureDisplay);

        if (!pictureDisplayObj)
            throw new Error(errPrefix + `There is no picture display with ID: ${idOfPictureDisplay}.`);

        // Tell the picture display object to clean up after itself.
        pictureDisplayObj.cleanUp();

        // Remove the object from our collection.
        delete self.aryPictureDisplayObjs[idOfPictureDisplay];
    }

    /**
     * This function finds a PictureDisplay object by its ID.
     *
     * @param {String} idOfPictureDisplay - The ID to look for.
     *
     * @returns {PictureDisplay|null} - The PictureDisplay object that
     *  bears the given ID or NULL if none were found.
     */
    this.findPictureDisplayById = function (idOfPictureDisplay) {
        const methodName = self.constructor.name + '::' + `findPictureDisplayById`;
        const errPrefix = '(' + methodName + ') ';

        if (misc_shared_lib.isEmptySafeString(idOfPictureDisplay))
            throw new Error(errPrefix + `The idOfParticipant parameter is empty.`);

        if (typeof self.aryPictureDisplayObjs[idOfPictureDisplay] === 'undefined')
            return null;

        return self.aryPictureDisplayObjs[idOfPictureDisplay];
    }

    /**
     * This method updates the state of all the pictureDisplays based on the current
     *  scene context.
     *
     * @param {Array<PartcipantWrapper>} aryParticipantWrapperObjs -
     *  The current list of participant objects in the scene.
     */
    this.updatePictureDisplays = function (aryParticipantWrapperObjs) {
        const methodName = self.constructor.name + '::' + `updatePictureDisplays`;
        const errPrefix = '(' + methodName + ') ';

        if (!Array.isArray(aryParticipantWrapperObjs))
            throw new Error(errPrefix + `The aryParticipantWrapperObjs parameter value is not an array.`);

        // Call the update function of each picture display.
        // TODO: OPTIMIZE - away the repetitive toArray() calls.
        self.toArray().forEach(pictureDisplayObj => {
            pictureDisplayObj.updatePictureDisplay(aryParticipantWrapperObjs);
        });
    }
}

/**
 * Create an instance of a PictureDisplayManager object.
 */
const g_PictureDisplayManager = new PictureDisplayManager();

export {CubeAssetsColorsOrUrls, isStringAUrl, PictureDisplay, PictureDisplayManager, g_PictureDisplayManager}