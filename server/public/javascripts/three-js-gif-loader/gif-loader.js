// Part of the open source GIF loader project for ThreeJS.
//
//  https://github.com/movableink/three-gif-loader

import { FileLoader } from '/javascripts/threejs/src/loaders/FileLoader.js';
import { DefaultLoadingManager } from '/javascripts/threejs/src/loaders/LoadingManager.js';
import GifTexture from './gif-texture.js';
import { GifReader } from '../omggif/omggif.js';

export default class GifLoader {
  constructor(manager) {
    this.manager = manager || DefaultLoadingManager;
    this.crossOrigin = 'anonymous';
  }

  load(url, onLoad, onProgress, onError) {
    const texture = new GifTexture();

    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');

    loader.load(url, (response) => {
      const gifData = new Uint8Array(response);
      const reader = new GifReader(gifData);

      texture.setReader(reader);

      if (onLoad) onLoad(reader);
    }, onProgress, onError);

    return texture;
  }

  setPath(value) {
    this.path = value;
    return this;
  }
}