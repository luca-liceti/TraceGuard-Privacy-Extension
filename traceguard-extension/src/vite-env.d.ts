/**
 * =============================================================================
 * VITE ENVIRONMENT TYPES - TypeScript Declarations
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is a TypeScript "declaration file" (.d.ts). It tells TypeScript about
 * types that exist at runtime but aren't defined in our code. Think of it like
 * teaching TypeScript a new language feature.
 * 
 * WHY WE NEED THIS:
 * Vite has special features (like importing files with ?script suffix) that
 * TypeScript doesn't know about by default. This file teaches TypeScript:
 * 
 * 1. Vite's built-in types (via reference to vite/client)
 * 2. Custom module suffixes (like ?script for content script paths)
 * 
 * THE ?script IMPORT:
 * When we import a file with ?script suffix, Vite gives us the path where
 * that file will be located after building. This is used for:
 * - chrome.scripting.executeScript() needs the built script path
 * - Content script injection in the background service worker
 * 
 * EXAMPLE:
 * import contentScriptPath from './content/index.ts?script';
 * // contentScriptPath = "assets/index.ts-XXXX.js" (the built path)
 * =============================================================================
 */
/// <reference types="vite/client" />

declare module '*?script' {
    const scriptPath: string;
    export default scriptPath;
}
