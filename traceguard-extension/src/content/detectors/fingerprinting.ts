/**
 * =============================================================================
 * FINGERPRINTING DETECTOR, Detects browser fingerprinting attempts
 * =============================================================================
 *
 * DETECTION STRATEGY (content-script / ISOLATED world):
 *
 * Since we cannot wrap page-world APIs from the ISOLATED world, we combine
 * multiple heuristics that can be observed from the DOM:
 *
 * 1. KNOWN FINGERPRINTING SCRIPTS, check external `<script src>` domains
 *    against a curated list of known fingerprinting services.
 * 2. INLINE SCRIPT ANALYSIS, search inline script text for realistic API
 *    call patterns using broad regexes that survive minification.
 * 3. DOM EVIDENCE, look for hidden canvases, off-screen iframes, etc.
 * 4. KNOWN LIBRARY GLOBALS, check for well-known fingerprinting library
 *    markers injected into the DOM (e.g. FingerprintJS result attributes).
 * =============================================================================
 */

export interface RawFingerprintingAttempt {
    technique: 'canvas' | 'webgl' | 'audio' | 'font' | 'navigator' | 'screen' | 'battery' | 'webrtc';
    scriptUrl: string | null;
}

// ---------------------------------------------------------------------------
// 1. Known fingerprinting script domains
// ---------------------------------------------------------------------------
const FINGERPRINT_DOMAINS = new Set([
    'fpjs.io',
    'fpcdn.io',
    'fingerprintjs.com',
    'fp.dev',
    'arkoselabs.com',
    'funcaptcha.com',
    'datadome.co',
    'perimeterx.net',
    'px-cdn.net',
    'px-cloud.net',
    'deviceidentifier.com',
    'impervads.com',
    'imperva.com',
    'incapsula.com',
    'distil.it',
    'distilnetworks.com',
    'iovation.com',
    'threatmetrix.com',
    'shape.com',
    'shapesecurity.com',
    'kasada.io',
    'biocatch.com',
]);

function isKnownFPDomain(hostname: string): boolean {
    for (const fp of FINGERPRINT_DOMAINS) {
        if (hostname === fp || hostname.endsWith('.' + fp)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// 2. Inline-script regex patterns (survive minification / variable renaming)
// ---------------------------------------------------------------------------
// We look for the *API method names* rather than full `obj.method` chains,
// because minifiers rename variables but cannot rename native method names.

const CANVAS_PATTERNS = [
    /\.toDataURL\s*\(/i,
    /\.getImageData\s*\(/i,
    /\.toBlob\s*\(/i,
];

const WEBGL_PATTERNS = [
    /getExtension\s*\(\s*["']WEBGL/i,
    /getSupportedExtensions\s*\(/i,
    /getParameter\s*\(\s*\w+\.(?:VENDOR|RENDERER|VERSION|SHADING_LANGUAGE_VERSION)\b/i,
    /webgl(?:2|)renderingcontext/i,
];

const AUDIO_PATTERNS = [
    /createOscillator\s*\(/i,
    /createAnalyser\s*\(/i,
    /(?:createDynamicsCompressor|DynamicsCompressorNode)\s*\(/i,
    /OfflineAudioContext\s*\(/i,
    /startRendering\s*\(/i,
];

const FONT_PATTERNS = [
    /measureText\s*\(/i,
    // Font enumeration through width probing, detect characteristic loops
    /offsetWidth|offsetHeight/i,
];

const WEBRTC_PATTERNS = [
    /RTCPeerConnection\s*\(/i,
    /createOffer\s*\(/i,
    /createDataChannel\s*\(/i,
];

const NAVIGATOR_PATTERNS = [
    /navigator\s*\.\s*(?:hardwareConcurrency|deviceMemory|platform|cpuClass|oscpu|maxTouchPoints)\b/i,
];

const SCREEN_PATTERNS = [
    /screen\s*\.\s*(?:colorDepth|pixelDepth|availWidth|availHeight)\b/i,
];

const BATTERY_PATTERNS = [
    /getBattery\s*\(/i,
    /BatteryManager\b/i,
];

// A pattern matches if *any* of its regexes match the code block.
interface PatternGroup {
    technique: RawFingerprintingAttempt['technique'];
    patterns: RegExp[];
    /** Some techniques need multiple signals to avoid false positives */
    minMatches?: number;
}

const PATTERN_GROUPS: PatternGroup[] = [
    { technique: 'canvas', patterns: CANVAS_PATTERNS },
    { technique: 'webgl',  patterns: WEBGL_PATTERNS },
    { technique: 'audio',  patterns: AUDIO_PATTERNS, minMatches: 2 },
    { technique: 'font',   patterns: FONT_PATTERNS, minMatches: 2 },
    { technique: 'webrtc', patterns: WEBRTC_PATTERNS, minMatches: 2 },
    { technique: 'navigator', patterns: NAVIGATOR_PATTERNS },
    { technique: 'screen', patterns: SCREEN_PATTERNS },
    { technique: 'battery', patterns: BATTERY_PATTERNS },
];

// ---------------------------------------------------------------------------
// 3. Main detection function
// ---------------------------------------------------------------------------

export function detectFingerprintingAttempts(): RawFingerprintingAttempt[] {
    const attempts: RawFingerprintingAttempt[] = [];
    const seenTechniques = new Set<string>();

    const currentHost = window.location.hostname;

    const add = (technique: RawFingerprintingAttempt['technique'], scriptUrl: string | null) => {
        const key = `${technique}|${scriptUrl || ''}`;
        if (seenTechniques.has(key)) return;
        seenTechniques.add(key);
        attempts.push({ technique, scriptUrl });
    };

    const scripts = document.querySelectorAll('script');

    for (const script of Array.from(scripts)) {
        // --- External scripts: match domain ---------------------------------
        if (script.src) {
            try {
                const url = new URL(script.src, window.location.href);
                if (url.hostname !== currentHost && isKnownFPDomain(url.hostname)) {
                    // Known fingerprinting service, count as canvas+navigator (typical bundle)
                    add('canvas', script.src);
                    add('navigator', script.src);
                }
            } catch { /* skip invalid */ }
            continue; // don't read textContent of external scripts (always empty)
        }

        // --- Inline scripts: regex scan -------------------------------------
        const code = script.textContent;
        if (!code || code.length < 50) continue; // skip trivial scripts

        for (const group of PATTERN_GROUPS) {
            const matchCount = group.patterns.filter(p => p.test(code)).length;
            const threshold = group.minMatches ?? 1;
            if (matchCount >= threshold) {
                add(group.technique, null);
            }
        }
    }

    // --- DOM evidence -------------------------------------------------------
    // Hidden canvases (commonly created by fingerprinting scripts)
    const canvases = document.querySelectorAll('canvas');
    for (const c of Array.from(canvases)) {
        const style = window.getComputedStyle(c);
        const isHidden = style.display === 'none'
            || style.visibility === 'hidden'
            || (c.width <= 1 && c.height <= 1)
            || parseInt(style.left || '0') < -9000
            || parseInt(style.top || '0') < -9000;
        if (isHidden) {
            add('canvas', null);
            break;
        }
    }

    // --- Known library markers (FingerprintJS, etc.) -------------------------
    // FingerprintJS often sets a `data-fpjs` attribute or creates an iframe for worker isolation
    if (document.querySelector('[data-fpjs]') || document.querySelector('iframe[src*="fpjs"]')) {
        add('canvas', null);
        add('navigator', null);
    }

    return attempts;
}
