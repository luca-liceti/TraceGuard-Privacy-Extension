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
