/**
 * Protocol Detector - HTTP/HTTPS Check
 * 
 * Detects whether the current page is using secure HTTPS protocol.
 * Returns: 100 (HTTPS - secure) or 0 (HTTP - insecure)
 */
export function detectProtocol(): number {
    const protocol = window.location.protocol;
    const isSecure = protocol === 'https:';
    const score = isSecure ? 100 : 0;

    // Comprehensive console logging
    console.log('[Protocol Detector] Starting analysis...');
    console.log('[Protocol] Detection:', {
        protocol: protocol,
        isSecure: isSecure,
        url: window.location.href
    });
    console.log('[Protocol] Score calculation:', {
        formula: isSecure ? 'HTTPS → 100 (secure)' : 'HTTP → 0 (insecure)',
        score: score
    });
    console.log('[Protocol] Final Score:', score);

    return score;
}
