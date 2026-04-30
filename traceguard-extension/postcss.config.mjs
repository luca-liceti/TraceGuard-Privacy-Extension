/**
 * PostCSS Configuration
 * 
 * This file tells PostCSS how to process CSS files. PostCSS is a tool that
 * transforms CSS using JavaScript plugins. We use two plugins:
 * 
 * 1. tailwindcss - Processes Tailwind CSS classes and generates the final CSS
 * 2. autoprefixer - Automatically adds browser prefixes (like -webkit-) for compatibility
 * 
 * When you run the build, PostCSS reads this config and applies these transformations.
 */
export default {
    plugins: {
        tailwindcss: {},
        autoprefixer: {},
    },
}
