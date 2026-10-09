/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-21063972'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "version.json",
    "revision": "1e25b30e828ebfc7c12ba0d6ffe07524"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "bcc8aacb22ddc67934360476b40bc5e5"
  }, {
    "url": "pwa-512x512.png",
    "revision": "32514e4a47e8f91495cd39a8d8041d50"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0d57d16687b76e5413fff52b43f5b4fd"
  }, {
    "url": "index.html",
    "revision": "0c54d190a6dc6ae0c4ce96a9c8147f30"
  }, {
    "url": "icon.svg",
    "revision": "3d77452e03f5f43c553694e73fe25096"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ca1d8e9ee4b57e22c82532c8ee586cd2"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-niYBaD88.css",
    "revision": null
  }, {
    "url": "assets/index-B2tuoexf.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ca1d8e9ee4b57e22c82532c8ee586cd2"
  }, {
    "url": "icon.svg",
    "revision": "3d77452e03f5f43c553694e73fe25096"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0d57d16687b76e5413fff52b43f5b4fd"
  }, {
    "url": "pwa-512x512.png",
    "revision": "32514e4a47e8f91495cd39a8d8041d50"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "bcc8aacb22ddc67934360476b40bc5e5"
  }, {
    "url": "version.json",
    "revision": "afa5e378bc184064f646eee4d5afb812"
  }, {
    "url": "manifest.webmanifest",
    "revision": "1679bef07d514cc6857c8ae842bb7e50"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(({
    request
  }) => request.mode === "navigate", new workbox.NetworkFirst({
    "cacheName": "app-navigation-cache",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/version\.json$/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
