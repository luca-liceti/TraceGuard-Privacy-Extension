/**
 * =============================================================================
 * PROTOCOL DETECTOR - Checking for Secure Connections (HTTPS)
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This detector checks if you're connecting to the website securely.
 * It's like checking if the door to a building has a lock or not!
 * 
 * HTTPS vs HTTP - WHAT'S THE DIFFERENCE?
 * - HTTP = "HyperText Transfer Protocol" - data is sent in plain text
 *   Anyone on the network can read what you're sending! (like a postcard)
 * 
 * - HTTPS = "HTTP Secure" - data is encrypted
 *   Only you and the website can read it (like a sealed letter)
 * 
 * WHAT IS "MIXED CONTENT"?
 * Even if a page uses HTTPS, it might load some resources over HTTP.
 * For example: An HTTPS page loading images from HTTP sources.
 * This is dangerous because those resources aren't encrypted!
 * 
 * SCORING:
 * - 100 = Pure HTTPS (fully secure, no mixed content) ✅
 * - 60 = HTTPS with mixed content (partially secure) ⚠️
 * - 0 = HTTP (completely insecure) 🔴
 * 
 * RESOURCES CHECKED FOR MIXED CONTENT:
 * - Scripts (.js files)
 * - Images
 * - Iframes (embedded pages)
 * - Stylesheets (.css files)
 * - Video and audio files
 * =============================================================================
 */

/**
 * Result of the mixed content check.
 */
interface MixedContentResult {
    hasMixedContent: boolean;    // Were insecure resources found?
    insecureResources: string[]; // List of HTTP resources on this HTTPS page
}

/**
 * Check for mixed content on HTTPS pages
 * Mixed content = HTTPS page loading HTTP resources
 */
function detectMixedContent(): MixedContentResult {
    const insecureResources: string[] = [];

    // Only check on HTTPS pages
    if (window.location.protocol !== 'https:') {
        return { hasMixedContent: false, insecureResources: [] };
    }

    // Check script sources
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
        if (script.src && script.src.startsWith('http://')) {
            insecureResources.push(`script: ${script.src}`);
        }
    }

    // Check image sources
    const images = document.getElementsByTagName('img');
    for (const img of images) {
        if (img.src && img.src.startsWith('http://')) {
            insecureResources.push(`image: ${img.src}`);
        }
    }

    // Check iframe sources  
    const iframes = document.getElementsByTagName('iframe');
    for (const iframe of iframes) {
        if (iframe.src && iframe.src.startsWith('http://')) {
            insecureResources.push(`iframe: ${iframe.src}`);
        }
    }

    // Check link hrefs (stylesheets)
    const links = document.getElementsByTagName('link');
    for (const link of links) {
        if (link.href && link.href.startsWith('http://') && link.rel === 'stylesheet') {
            insecureResources.push(`stylesheet: ${link.href}`);
        }
    }

    // Check video/audio sources
    const mediaElements = document.querySelectorAll('video source, audio source');
    for (const source of mediaElements) {
        const src = source.getAttribute('src');
        if (src && src.startsWith('http://')) {
            insecureResources.push(`media: ${src}`);
        }
    }

    // Check video/audio direct src
    const videos = document.getElementsByTagName('video');
    for (const video of videos) {
        if (video.src && video.src.startsWith('http://')) {
            insecureResources.push(`video: ${video.src}`);
        }
    }

    const audios = document.getElementsByTagName('audio');
    for (const audio of audios) {
        if (audio.src && audio.src.startsWith('http://')) {
            insecureResources.push(`audio: ${audio.src}`);
        }
    }

    return {
        hasMixedContent: insecureResources.length > 0,
        insecureResources
    };
}

export function detectProtocol(): number {
    const protocol = window.location.protocol;
    const isSecure = protocol === 'https:';

    let score: number;
    let statusMessage: string;

    if (!isSecure) {
        // HTTP - completely insecure
        score = 0;
        statusMessage = 'HTTP → 0 (insecure)';
    } else {
        // HTTPS - check for mixed content
        const mixedContentResult = detectMixedContent();

        if (mixedContentResult.hasMixedContent) {
            score = 60;
            statusMessage = `HTTPS with mixed content → 60 (partially secure)`;
            console.log('[Protocol] Mixed content detected:', mixedContentResult.insecureResources.slice(0, 5));
            if (mixedContentResult.insecureResources.length > 5) {
                console.log(`[Protocol] ... and ${mixedContentResult.insecureResources.length - 5} more insecure resources`);
            }
        } else {
            score = 100;
            statusMessage = 'HTTPS (pure) → 100 (secure)';
        }
    }

    // Comprehensive console logging
    console.log('[Protocol Detector] Starting analysis...');
    console.log('[Protocol] Detection:', {
        protocol: protocol,
        isSecure: isSecure,
        url: window.location.href
    });
    console.log('[Protocol] Score calculation:', {
        formula: statusMessage,
        score: score
    });
    console.log('[Protocol] Final Score:', score);

    return score;
}
