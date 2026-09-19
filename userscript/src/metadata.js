export const metadata = `// ==UserScript==
// @name         surver-injector
// @namespace    https://github.com/123wwwa/survev-injector
// @version      0.1
// @description  Loads patched Survev client modules with the original server settings and sprite atlases.
// @author       fissure
// @license      GPL3
// @match        http://localhost/*
// @match        https://localhost/*
// @match        https://survev.io/*
// @icon         https://www.google.com/s2/favicons?domain=survev.io
// @run-at       document-end
// @upstream-webRequest
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      self
// @connect      cdn.jsdelivr.net
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.0.3/pixi.min.js
// @homepageURL  https://github.com/123wwwa/survev-injector
// @supportURL   https://github.com/123wwwa/survev-injector/issues
// ==/UserScript==
`;
