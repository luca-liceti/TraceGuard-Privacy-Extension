const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../src/assets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tosdr-data.json');

// Ensure assets directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Check if we should skip rebuilding to avoid API strain
if (fs.existsSync(OUTPUT_FILE) && !process.env.FORCE_TOSDR_BUILD) {
    const stats = fs.statSync(OUTPUT_FILE);
    const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    
    // Only rebuild if older than 7 days, unless forced
    if (ageDays < 7) {
        console.log(`Local ToS;DR database is fresh (${Math.round(ageDays * 10) / 10} days old).`);
        console.log('Skipping fetch to prevent API strain.');
        console.log('To force rebuild, run: FORCE_TOSDR_BUILD=1 npm run build:tosdr (or delete src/assets/tosdr-data.json)');
        process.exit(0);
    }
}

// A list of popular domains to fetch for our local database.
// In a full production scenario, this script would iterate through the paginated
// ToS;DR API to dump the entire database. For this extension, we'll seed it
// with top domains to demonstrate 100% local scanning.
const topDomains = [
    'google.com', 'facebook.com', 'amazon.com', 'apple.com', 'microsoft.com',
    'twitter.com', 'instagram.com', 'linkedin.com', 'netflix.com', 'reddit.com',
    'wikipedia.org', 'yahoo.com', 'duckduckgo.com', 'github.com', 'tiktok.com',
    'twitch.tv', 'zoom.us', 'spotify.com', 'pinterest.com', 'tumblr.com',
    'whatsapp.com', 'telegram.org', 'slack.com', 'discord.com', 'nytimes.com',
    'cnn.com', 'bbc.co.uk', 'foxnews.com', 'ebay.com', 'craigslist.org',
    'imdb.com', 'espn.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com',
    'paypal.com', 'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com',
    'zillow.com', 'yelp.com', 'tripadvisor.com', 'booking.com', 'airbnb.com',
    'uber.com', 'lyft.com', 'doordash.com', 'instacart.com', 'grubhub.com',
    'hulu.com', 'disneyplus.com', 'hbo.com', 'paramountplus.com', 'peacocktv.com',
    'adobe.com', 'salesforce.com', 'intuit.com', 'zoom.us', 'webex.com',
    'dropbox.com', 'box.com', 'docusign.com', 'canva.com', 'figma.com',
    'weather.com', 'accuweather.com', 'wunderground.com', 'npr.org', 'reuters.com',
    'wsj.com', 'usatoday.com', 'bloomberg.com', 'cnbc.com', 'forbes.com',
    'businessinsider.com', 'theverge.com', 'wired.com', 'techcrunch.com', 'cnet.com',
    'stackoverflow.com', 'quora.com', 'medium.com', 'vimeo.com', 'soundcloud.com',
    'patreon.com', 'kickstarter.com', 'indiegogo.com', 'gofundme.com', 'eventbrite.com',
    'ticketmaster.com', 'livenation.com', 'stubhub.com', 'seatgeek.com', 'vividseats.com'
    // Add more domains as needed up to 500
];

/**
 * Convert ToS;DR grade to risk score (standard: 0 = dangerous, 100 = safe)
 */
function gradeToScore(grade) {
    if (!grade) return 0;
    const gradeMap = {
        'A': 100, 'B': 80, 'C': 60, 'D': 40, 'E': 20
    };
    return gradeMap[grade.toUpperCase()] || 0;
}

function fetchJson(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Timeout after ${timeoutMs}ms for ${url}`));
        });
    });
}

async function buildDatabase() {
    console.log('Building local ToS;DR database...');
    const db = {};

    for (const domain of topDomains) {
        try {
            console.log(`Fetching data for ${domain}...`);
            // Fetch basic service info
            const searchData = await fetchJson(`https://api.tosdr.org/search/v4/?query=${domain}`);
            const services = searchData.parameters?.services || searchData.services;
            
            if (services && services.length > 0) {
                const service = services[0];
                
                let grade = undefined;
                if (service.rating) {
                    if (typeof service.rating === 'object') {
                        grade = service.rating.letter || service.rating.human;
                    } else if (typeof service.rating === 'string') {
                        grade = service.rating;
                    }
                }
                
                const score = gradeToScore(grade);
                
                // Fetch details for points
                let points = [];
                let documents = [];
                try {
                    const detailsData = await fetchJson(`https://api.tosdr.org/service/v2/?id=${service.id}`);
                    if (detailsData.parameters?.points) {
                        points = detailsData.parameters.points.map(p => ({
                            title: p.title,
                            classification: p.case?.classification || 'neutral'
                        }));
                    }
                } catch (e) {
                    console.warn(`  Warning: Failed to fetch points for ${domain}`);
                }

                db[domain] = {
                    found: true,
                    grade,
                    score,
                    source: 'tosdr-local',
                    serviceName: service.name,
                    serviceId: service.id,
                    points,
                    documents,
                    lastUpdated: Date.now() // Support for Stale-While-Revalidate pattern
                };
            }
            
            // Add a small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
        } catch (error) {
            console.error(`Error fetching ${domain}:`, error.message);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2));
    console.log(`Successfully wrote ${Object.keys(db).length} records to ${OUTPUT_FILE}`);
}

buildDatabase().catch(e => { console.error(e); process.exit(1); });

