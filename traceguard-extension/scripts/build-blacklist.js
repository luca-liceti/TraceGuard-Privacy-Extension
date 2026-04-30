/**
 * =============================================================================
 * BUILD BLACKLIST SCRIPT - Generate Malware Domain List
 * =============================================================================
 * 
 * WHAT THIS SCRIPT DOES:
 * This Node.js script generates the blacklist.json file that contains a list
 * of known dangerous domain names. The extension uses this list to warn users
 * when they visit potentially harmful websites.
 * 
 * HOW TO RUN:
 * node scripts/build-blacklist.js
 * 
 * WHAT IT CREATES:
 * - src/assets/blacklist.json containing:
 *   - version: Semantic version of the blacklist
 *   - updated: ISO timestamp of when the list was generated
 *   - domains: Array of known dangerous domain names
 * 
 * FUTURE IMPROVEMENTS:
 * In a production system, this script would:
 * - Fetch from EasyList to get known tracking domains
 * - Fetch from PhishTank API to get known phishing sites
 * - Fetch from URLhaus to get known malware-hosting domains
 * - Combine and deduplicate the lists
 * 
 * Currently uses a small placeholder list for MVP demonstration.
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../src/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'blacklist.json');

// Ensure assets directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple placeholder blacklist for MVP
// In a real scenario, we would fetch from EasyList/PhishTank
const initialBlacklist = {
    version: "1.0.0",
    updated: new Date().toISOString(),
    domains: [
        "example-malware.com",
        "tracking-site.org",
        "phishing-test.net"
    ]
};

console.log('Building blacklist...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(initialBlacklist, null, 2));
console.log(`Blacklist written to ${OUTPUT_FILE}`);
