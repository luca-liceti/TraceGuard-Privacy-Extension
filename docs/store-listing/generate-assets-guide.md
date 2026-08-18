# Generate Chrome Web Store Promotional Assets

This guide provides the scripts and instructions needed to generate 3D isometric promotional assets for the Chrome Web Store. The generated images will have a dark grayish gradient background, use the `Inter` font (consistent with TraceGuard), and tilt the dashboard/sidebar images for a floating layer effect.

## Prerequisites

You'll need Node.js installed. We will use `puppeteer` to take perfect, high-resolution screenshots of an HTML layout.

## Setup Instructions

1. **Create a temporary directory** anywhere on your system (e.g., `store-assets-generator`).
2. **Initialize a Node project and install Puppeteer**:
   ```bash
   mkdir store-assets-generator
   cd store-assets-generator
   npm init -y
   npm install puppeteer
   ```
3. **Copy the existing images** into this folder (or update the file paths in the HTML to point to your `docs/screenshots/` folder).
   For the script to work flawlessly out of the box, create an `assets` folder inside the generator directory and put these files inside:
   - `assets/traceguard-logo-and-title.png`
   - `assets/dashboard-preview.png`
   - `assets/sidebar-preview.png`

## The Code

Create two files in your `store-assets-generator` directory: `index.html` and `generate.js`.

### 1. `index.html`

This file handles the layout, fonts (`Inter`), dark grayish gradient, and CSS 3D transforms.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <title>Store Asset Generator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            /* Dark grayish gradient */
            background: linear-gradient(135deg, #2a2a2e 0%, #111112 100%);
            font-family: 'Inter', sans-serif;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            perspective: 2000px; /* Crucial for 3D depth */
        }

        .scene {
            display: none;
            width: 100%;
            height: 100%;
            position: relative;
        }
        
        .scene.active {
            display: flex;
        }

        /* ----- Scene 1: Logo ----- */
        #scene-logo {
            align-items: center;
            justify-content: center;
        }
        #scene-logo img {
            width: 60%;
            max-width: 800px;
            filter: drop-shadow(0 20px 40px rgba(0,0,0,0.5));
        }

        /* ----- Scene 2: Dashboard ----- */
        #scene-dashboard {
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        
        #scene-dashboard .text-container {
            position: absolute;
            top: 15%;
            text-align: center;
            z-index: 10;
        }

        .heading {
            font-size: 64px;
            font-weight: 800;
            letter-spacing: -1px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }

        .image-wrapper {
            margin-top: 80px;
            transform: rotateX(25deg) rotateZ(-15deg) rotateY(-5deg) scale(0.85);
            transform-style: preserve-3d;
            box-shadow: 
                -20px 20px 60px rgba(0,0,0,0.8),
                0 0 0 1px rgba(255,255,255,0.1);
            border-radius: 12px;
            overflow: hidden;
        }

        .image-wrapper img {
            display: block;
            width: 1200px; /* Base width for scaling */
            border-radius: 12px;
        }

        /* ----- Scene 3: Sidebar ----- */
        #scene-sidebar {
            align-items: center;
            justify-content: space-around;
            padding: 0 100px;
        }
        
        #scene-sidebar .text-container {
            max-width: 500px;
            text-align: left;
        }

        #scene-sidebar .heading {
            font-size: 56px;
            line-height: 1.2;
        }

        #scene-sidebar .image-wrapper {
            transform: rotateX(15deg) rotateY(-25deg) rotateZ(5deg) scale(0.9);
            margin-top: 0;
            width: 380px;
        }
        
        #scene-sidebar .image-wrapper img {
            width: 100%;
        }

    </style>
</head>
<body>

    <!-- Scene 1: Logo -->
    <div id="scene-logo" class="scene">
        <img src="assets/traceguard-logo-and-title.png" alt="TraceGuard Logo">
    </div>

    <!-- Scene 2: Dashboard -->
    <div id="scene-dashboard" class="scene">
        <div class="text-container">
            <h1 class="heading">Take Back Your Privacy.</h1>
        </div>
        <div class="image-wrapper">
            <img src="assets/dashboard-preview.png" alt="TraceGuard Dashboard">
        </div>
    </div>

    <!-- Scene 3: Sidebar -->
    <div id="scene-sidebar" class="scene">
        <div class="text-container">
            <h1 class="heading">Monitor Tracking in Real-Time.</h1>
        </div>
        <div class="image-wrapper">
            <img src="assets/sidebar-preview.png" alt="TraceGuard Sidebar">
        </div>
    </div>

    <script>
        // Use URL search params to switch active scene. e.g. index.html?scene=dashboard
        const params = new URLSearchParams(window.location.search);
        const sceneName = params.get('scene') || 'logo';
        const sceneEl = document.getElementById('scene-' + sceneName);
        if (sceneEl) {
            sceneEl.classList.add('active');
        }
    </script>
</body>
</html>
```

### 2. `generate.js`

This script uses Puppeteer to load `index.html` with different parameters, resize the viewport to standard Chrome Web Store dimensions, and capture the screenshots.

```javascript
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Convert absolute path of index.html to file:// URL
    const fileUrl = `file://${path.join(__dirname, 'index.html')}`;

    // Define the scenes and dimensions to capture
    const captures = [
        { name: '01-logo-screenshot', scene: 'logo', width: 1280, height: 800 },
        { name: '02-dashboard-screenshot', scene: 'dashboard', width: 1280, height: 800 },
        { name: '03-sidebar-screenshot', scene: 'sidebar', width: 1280, height: 800 },
        
        // Small Promo
        { name: '04-small-promo', scene: 'logo', width: 440, height: 280 },
        
        // Marquee Promo
        { name: '05-marquee-promo', scene: 'dashboard', width: 1400, height: 560 }
    ];

    console.log('Generating Store Assets...');

    for (const cap of captures) {
        await page.setViewport({ width: cap.width, height: cap.height, deviceScaleFactor: 2 }); // Scale factor 2 for retina crispness
        
        // Navigate to the scene
        await page.goto(`${fileUrl}?scene=${cap.scene}`, { waitUntil: 'networkidle0' });
        
        // Wait a moment for fonts/CSS to fully render
        await new Promise(r => setTimeout(r, 500));

        const outputPath = path.join(outputDir, `${cap.name}.png`);
        
        await page.screenshot({ path: outputPath });
        console.log(`✅ Saved ${cap.name}.png (${cap.width}x${cap.height})`);
    }

    await browser.close();
    console.log('🎉 All assets generated successfully in the /output folder.');
})();
```

## Running the Generator

Once you have `index.html`, `generate.js`, and your `assets/` folder in place, simply run:

```bash
node generate.js
```

The script will output 5 images directly to the `/output` folder, perfectly sized and ready for upload to the Chrome Web Store Developer Dashboard.
