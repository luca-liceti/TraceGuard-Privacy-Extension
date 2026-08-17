/**
 * =============================================================================
 * VITE CONFIGURATION - Build Tool Setup for TraceGuard
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Vite is our build tool - it bundles all our TypeScript, React, and CSS files
 * into a format that the browser can run. This config tells Vite how to do that.
 * 
 * KEY SETTINGS:
 * - Uses React plugin for JSX/TSX support
 * - Uses crx plugin to build as a Chrome extension (from manifest.json)
 * - Copies static assets (like phishlist.json and the privacy databases) to the output folder
 * - Sets up path aliases (@ = src folder) for cleaner imports
 * 
 * BUILD OUTPUTS:
 * - Dashboard: The full privacy dashboard UI
 * - Popup: The small popup when you click the extension icon
 * - Background: The service worker that runs in the background
 * - Content scripts: Code injected into web pages
 * 
 * TO BUILD: Run `npm run build` - output goes to the /dist folder
 * TO DEV: Run `npm run dev` - starts a dev server with hot reload
 * =============================================================================
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'
import rawManifest from './manifest.json'
import pkg from './package.json'

// package.json is the single source of truth for the version. Inject it into
// the manifest at build time so the packaged extension always matches.
const manifest = { ...rawManifest, version: pkg.version }

export default defineConfig({
  base: './',
  plugins: [
    react(),
    crx({ manifest }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/phishlist.json',
          dest: 'assets'
        },
        {
          src: 'src/assets/tracker-radar.json',
          dest: 'assets'
        },
        {
          src: 'src/assets/cookie-database.json',
          dest: 'assets'
        },
        {
          src: 'src/assets/easyprivacy-domains.json',
          dest: 'assets'
        },
        {
          src: 'src/assets/disconnect-services.json',
          dest: 'assets'
        },
        {
          src: 'src/assets/tosdr-data.json',
          dest: 'assets'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        dashboard: 'src/dashboard/index.html',
        popup: 'src/popup/index.html',
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
