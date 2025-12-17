/**
 * Protocol Detector - HTTP/HTTPS Check with Mixed Content Detection
 * 
 * Detects whether the current page is using secure HTTPS protocol
 * and checks for mixed content (HTTPS page loading HTTP resources).
 * 
 * Returns:
 * - 100: Pure HTTPS (secure, no mixed content)
 * - 60: HTTPS with mixed content (partially secure)
 * - 0: HTTP (insecure)
 */

interface MixedContentResult {
    hasMixedContent: boolean;
    insecureResources: string[];
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
