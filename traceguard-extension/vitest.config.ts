/**
 * =============================================================================
 * VITEST CONFIGURATION - Test Runner Setup
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * Vitest is our test runner - it runs all the automated tests to make sure
 * our code works correctly. This config tells Vitest how to run those tests.
 * 
 * KEY SETTINGS:
 * - Uses React plugin for testing React components
 * - Uses happy-dom as the browser environment (faster than jsdom)
 * - Runs setup.ts before each test file (mocks Chrome APIs)
 * - Only runs files ending in .test.ts or .spec.ts
 * 
 * COVERAGE:
 * - Uses v8 for code coverage (shows which lines of code are tested)
 * - Focuses on lib/ and detectors/ folders (core logic)
 * - Generates text, JSON, and HTML reports
 * 
 * TO RUN TESTS: npm run test
 * TO SEE COVERAGE: npm run test:coverage
 * =============================================================================
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/lib/**/*.ts', 'src/content/detectors/**/*.ts'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
