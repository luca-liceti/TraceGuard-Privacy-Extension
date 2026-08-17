#!/usr/bin/env node
/**
 * =============================================================================
 * BUILD-DATABASES.JS, Privacy Knowledge Base Builder
 * =============================================================================
 *
 * WHAT THIS DOES:
 * Fetches 4 open-source privacy databases at BUILD TIME and processes them into
 * optimized JSON assets the extension bundles locally. Users never make network
 * calls to look up tracker/cookie info, everything is offline.
 *
 * DATABASES:
 * 1. DuckDuckGo Tracker Radar  → tracker-radar.json
 *    Maps 5000+ domains to parent companies, categories, fingerprinting risk
 *
 * 2. Open Cookie Database       → cookie-database.json
 *    Maps 2000+ cookie names to organizations, purposes, retention periods
 *
 * 3. EasyPrivacy                → easyprivacy-domains.json
 *    Domain-level privacy filter rules (tracker domains only, no cosmetic rules)
 *
 * 4. Disconnect Services        → disconnect-services.json
 *    Categorized tracker services: Advertising, Analytics, Social, Fingerprinting
 *
 * RUN:
 *   node scripts/build-databases.js
 *
 * OUTPUT:
 *   src/assets/tracker-radar.json
 *   src/assets/cookie-database.json
 *   src/assets/easyprivacy-domains.json
 *   src/assets/disconnect-services.json
 * =============================================================================
 */

const { mkdirSync, existsSync } = require('fs');
const { writeFile } = require('fs/promises');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const ASSETS_DIR = join(ROOT, 'src', 'assets');

// Ensure assets directory exists
if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });

const log = (msg) => console.log(`[build-databases] ${msg}`);
const err = (msg) => console.error(`[build-databases] ERROR: ${msg}`);

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------
async function fetchText(url) {
    log(`Fetching: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

async function fetchJson(url) {
    log(`Fetching JSON: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
}

// ---------------------------------------------------------------------------
// 1. DuckDuckGo Tracker Radar
//    Repo: https://github.com/nicedoc/tracker-radar
//    We fetch the entities list and the domain → entity mapping.
// ---------------------------------------------------------------------------
async function buildTrackerRadar() {
    log('--- Building DuckDuckGo Tracker Radar ---');

    // Fetch entities (company names, display names)
    const entitiesUrl = 'https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/entity_map.json';
    // Fetch the top-level domain summary (maps domain → entity name + category)
    const domainsUrl = 'https://raw.githubusercontent.com/duckduckgo/tracker-radar/main/build-data/generated/domain_summary.json';

    let entities = {};
    let domains = {};

    try {
        entities = await fetchJson(entitiesUrl);
    } catch (e) {
        err(`Failed to fetch Tracker Radar entities: ${e.message}`);
        // Fallback: continue with empty entities (curated list still has coverage)
        entities = {};
    }

    try {
        domains = await fetchJson(domainsUrl);
    } catch (e) {
        // Domain list is critical, without it the extension cannot detect trackers.
        // Rethrow so the build fails rather than shipping an empty database.
        throw new Error(`Failed to fetch Tracker Radar domains (critical): ${e.message}`);
    }

    // Build optimized lookup: { [domain]: { owner, displayName, category, prevalence, fingerprinting } }
    const output = {};

    for (const [domain, data] of Object.entries(domains)) {
        const entityName = data.owner?.name || data.ownerName || null;
        const entityData = entityName ? entities[entityName] : null;

        output[domain] = {
            owner: entityName,
            displayName: entityData?.displayName || entityName,
            category: data.categories?.[0] || null,
            prevalence: data.prevalence || 0,
            fingerprinting: data.fingerprinting || 0,
        };
    }

    // Curated fallback for the most common trackers (always included)
    const CURATED_TRACKERS = {
        'google-analytics.com': { owner: 'Google LLC', displayName: 'Google', category: 'Analytics', prevalence: 0.85, fingerprinting: 0 },
        'googletagmanager.com': { owner: 'Google LLC', displayName: 'Google', category: 'Analytics', prevalence: 0.75, fingerprinting: 0 },
        'doubleclick.net': { owner: 'Google LLC', displayName: 'Google Ads', category: 'Advertising', prevalence: 0.7, fingerprinting: 1 },
        'googlesyndication.com': { owner: 'Google LLC', displayName: 'Google Ads', category: 'Advertising', prevalence: 0.6, fingerprinting: 0 },
        'facebook.com': { owner: 'Meta Platforms, Inc.', displayName: 'Facebook', category: 'Social', prevalence: 0.55, fingerprinting: 2 },
        'facebook.net': { owner: 'Meta Platforms, Inc.', displayName: 'Facebook Pixel', category: 'Advertising', prevalence: 0.45, fingerprinting: 1 },
        'connect.facebook.net': { owner: 'Meta Platforms, Inc.', displayName: 'Facebook Pixel', category: 'Advertising', prevalence: 0.45, fingerprinting: 1 },
        'twitter.com': { owner: 'X Corp.', displayName: 'X (Twitter)', category: 'Social', prevalence: 0.3, fingerprinting: 1 },
        'analytics.twitter.com': { owner: 'X Corp.', displayName: 'X Analytics', category: 'Analytics', prevalence: 0.25, fingerprinting: 0 },
        'linkedin.com': { owner: 'LinkedIn Corporation', displayName: 'LinkedIn', category: 'Social', prevalence: 0.3, fingerprinting: 1 },
        'snap.com': { owner: 'Snap Inc.', displayName: 'Snapchat', category: 'Social', prevalence: 0.15, fingerprinting: 0 },
        'hotjar.com': { owner: 'Hotjar Ltd.', displayName: 'Hotjar', category: 'Analytics', prevalence: 0.2, fingerprinting: 2 },
        'mixpanel.com': { owner: 'Mixpanel, Inc.', displayName: 'Mixpanel', category: 'Analytics', prevalence: 0.1, fingerprinting: 0 },
        'segment.com': { owner: 'Twilio Inc.', displayName: 'Segment', category: 'Analytics', prevalence: 0.15, fingerprinting: 0 },
        'cdn.segment.com': { owner: 'Twilio Inc.', displayName: 'Segment', category: 'Analytics', prevalence: 0.12, fingerprinting: 0 },
        'amplitude.com': { owner: 'Amplitude, Inc.', displayName: 'Amplitude', category: 'Analytics', prevalence: 0.08, fingerprinting: 0 },
        'criteo.com': { owner: 'Criteo SA', displayName: 'Criteo', category: 'Advertising', prevalence: 0.25, fingerprinting: 1 },
        'criteo.net': { owner: 'Criteo SA', displayName: 'Criteo', category: 'Advertising', prevalence: 0.2, fingerprinting: 1 },
        'taboola.com': { owner: 'Taboola, Inc.', displayName: 'Taboola', category: 'Advertising', prevalence: 0.2, fingerprinting: 0 },
        'outbrain.com': { owner: 'Outbrain Inc.', displayName: 'Outbrain', category: 'Advertising', prevalence: 0.15, fingerprinting: 0 },
        'rubiconproject.com': { owner: 'Magnite, Inc.', displayName: 'Rubicon Project', category: 'Advertising', prevalence: 0.2, fingerprinting: 0 },
        'pubmatic.com': { owner: 'PubMatic, Inc.', displayName: 'PubMatic', category: 'Advertising', prevalence: 0.2, fingerprinting: 0 },
        'openx.com': { owner: 'OpenX Technologies, Inc.', displayName: 'OpenX', category: 'Advertising', prevalence: 0.15, fingerprinting: 0 },
        'casalemedia.com': { owner: 'Index Exchange Inc.', displayName: 'Index Exchange', category: 'Advertising', prevalence: 0.15, fingerprinting: 0 },
        'scorecardresearch.com': { owner: 'Comscore, Inc.', displayName: 'Comscore', category: 'Analytics', prevalence: 0.3, fingerprinting: 1 },
        'quantserve.com': { owner: 'Quantcast Corporation', displayName: 'Quantcast', category: 'Analytics', prevalence: 0.2, fingerprinting: 1 },
        'heapanalytics.com': { owner: 'Heap Inc.', displayName: 'Heap', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'fullstory.com': { owner: 'FullStory, Inc.', displayName: 'FullStory', category: 'Analytics', prevalence: 0.05, fingerprinting: 2 },
        'logrocket.com': { owner: 'LogRocket, Inc.', displayName: 'LogRocket', category: 'Analytics', prevalence: 0.03, fingerprinting: 1 },
        'intercom.io': { owner: 'Intercom, Inc.', displayName: 'Intercom', category: 'Marketing', prevalence: 0.1, fingerprinting: 0 },
        'widget.intercom.io': { owner: 'Intercom, Inc.', displayName: 'Intercom', category: 'Marketing', prevalence: 0.1, fingerprinting: 0 },
        'marketo.com': { owner: 'Adobe Inc.', displayName: 'Marketo', category: 'Marketing', prevalence: 0.08, fingerprinting: 0 },
        'mktoresp.com': { owner: 'Adobe Inc.', displayName: 'Marketo', category: 'Marketing', prevalence: 0.06, fingerprinting: 0 },
        'adroll.com': { owner: 'NextRoll, Inc.', displayName: 'AdRoll', category: 'Advertising', prevalence: 0.1, fingerprinting: 1 },
        'clarity.ms': { owner: 'Microsoft Corporation', displayName: 'Microsoft Clarity', category: 'Analytics', prevalence: 0.1, fingerprinting: 1 },
        'bing.com': { owner: 'Microsoft Corporation', displayName: 'Bing Ads', category: 'Advertising', prevalence: 0.25, fingerprinting: 0 },
        'bat.bing.com': { owner: 'Microsoft Corporation', displayName: 'Bing Ads', category: 'Advertising', prevalence: 0.2, fingerprinting: 0 },
        'amazon-adsystem.com': { owner: 'Amazon.com, Inc.', displayName: 'Amazon Ads', category: 'Advertising', prevalence: 0.3, fingerprinting: 0 },
        'fls-na.amazon.com': { owner: 'Amazon.com, Inc.', displayName: 'Amazon Ads', category: 'Advertising', prevalence: 0.15, fingerprinting: 0 },
        'chartbeat.com': { owner: 'Chartbeat, Inc.', displayName: 'Chartbeat', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'parsely.com': { owner: 'Automattic Inc.', displayName: 'Parse.ly', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'optimizely.com': { owner: 'Optimizely, Inc.', displayName: 'Optimizely', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'vwo.com': { owner: 'Wingify Software Pvt. Ltd.', displayName: 'VWO', category: 'Analytics', prevalence: 0.03, fingerprinting: 0 },
        'sentry.io': { owner: 'Functional Software, Inc.', displayName: 'Sentry', category: 'Analytics', prevalence: 0.15, fingerprinting: 0 },
        'datadog-browser-agent.com': { owner: 'Datadog, Inc.', displayName: 'Datadog', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'newrelic.com': { owner: 'New Relic, Inc.', displayName: 'New Relic', category: 'Analytics', prevalence: 0.05, fingerprinting: 0 },
        'nr-data.net': { owner: 'New Relic, Inc.', displayName: 'New Relic', category: 'Analytics', prevalence: 0.04, fingerprinting: 0 },
        'stripe.com': { owner: 'Stripe, Inc.', displayName: 'Stripe', category: 'Functional', prevalence: 0.15, fingerprinting: 2 },
        'js.stripe.com': { owner: 'Stripe, Inc.', displayName: 'Stripe', category: 'Functional', prevalence: 0.15, fingerprinting: 2 },
        'cloudflare.com': { owner: 'Cloudflare, Inc.', displayName: 'Cloudflare', category: 'CDN', prevalence: 0.8, fingerprinting: 1 },
        'cloudflareinsights.com': { owner: 'Cloudflare, Inc.', displayName: 'Cloudflare Web Analytics', category: 'Analytics', prevalence: 0.1, fingerprinting: 0 },
        'pinterest.com': { owner: 'Pinterest, Inc.', displayName: 'Pinterest', category: 'Social', prevalence: 0.1, fingerprinting: 0 },
        'ct.pinterest.com': { owner: 'Pinterest, Inc.', displayName: 'Pinterest Tag', category: 'Advertising', prevalence: 0.08, fingerprinting: 0 },
        'tiktok.com': { owner: 'ByteDance Ltd.', displayName: 'TikTok', category: 'Social', prevalence: 0.1, fingerprinting: 2 },
        'analytics.tiktok.com': { owner: 'ByteDance Ltd.', displayName: 'TikTok Pixel', category: 'Advertising', prevalence: 0.08, fingerprinting: 1 },
    };

    // Merge curated data (curated takes priority for known entries)
    for (const [domain, data] of Object.entries(CURATED_TRACKERS)) {
        if (!output[domain] || !output[domain].owner) {
            output[domain] = data;
        }
    }

    const totalDomains = Object.keys(output).length;
    await writeFile(join(ASSETS_DIR, 'tracker-radar.json'), JSON.stringify(output));
    log(`✅ Tracker Radar: ${totalDomains} domains → tracker-radar.json`);
}

// ---------------------------------------------------------------------------
// 2. Open Cookie Database
//    Repo: https://github.com/jkwakman/Open-Cookie-Database
//    CSV with cookie name, platform, category, description, retention, controller
// ---------------------------------------------------------------------------
async function buildCookieDatabase() {
    log('--- Building Open Cookie Database ---');

    const csvUrl = 'https://raw.githubusercontent.com/jkwakman/Open-Cookie-Database/master/open-cookie-database.csv';

    let csvText = '';
    try {
        csvText = await fetchText(csvUrl);
    } catch (e) {
        // Cookie database is critical, without it cookie classification is broken.
        // Rethrow so the build fails rather than shipping an empty database.
        throw new Error(`Failed to fetch Open Cookie Database (critical): ${e.message}`);
    }

    // Parse CSV (handle quoted fields)
    function parseCSV(text) {
        const lines = text.split('\n');
        const headers = parseCSVLine(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = parseCSVLine(lines[i]);
            if (values.length < headers.length) continue;
            const row = {};
            headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
            rows.push(row);
        }
        return rows;
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    const rows = parseCSV(csvText);

    // Build two lookup structures:
    // 1. exact: { [cookieName]: CookieDBEntry } for exact name matches
    // 2. wildcards: [{ pattern, regex, entry }] for wildcard patterns
    const exact = {};
    const wildcards = [];

    // Map CSV category strings to our internal categories
    const CATEGORY_MAP = {
        'Analytics': 'analytics',
        'Performance': 'analytics',
        'Marketing': 'marketing',
        'Advertising': 'marketing',
        'Targeting': 'marketing',
        'Functional': 'functional',
        'Preferences': 'functional',
        'Necessary': 'necessary',
        'Required': 'necessary',
        'Security': 'necessary',
        'Unclassified': 'unclassified',
        'Social Media': 'marketing',
    };

    for (const row of rows) {
        const cookieName = row['Cookie / Data Header'] || row['Cookie'] || row['Name'] || '';
        if (!cookieName) continue;

        const isWildcard = row['Wildcard'] === '1' || cookieName.includes('*') || cookieName.includes('%');
        const rawCategory = row['Category'] || 'Unclassified';
        const category = CATEGORY_MAP[rawCategory] || 'unclassified';

        const entry = {
            platform: row['Platform'] || null,
            category,
            description: row['Description'] || null,
            retentionPeriod: row['Retention period'] || row['Retention'] || null,
            dataController: row['Data Controller'] || row['Controller'] || null,
            privacyUrl: row['User Privacy & GDPR'] || row['Privacy URL'] || null,
        };

        if (isWildcard) {
            // Convert wildcard pattern to regex: * → .*, ? → .
            const cleanPattern = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
            wildcards.push({
                pattern: cookieName,
                regex: `^${cleanPattern}$`,
                entry,
            });
        } else {
            // Exact match, use lowercased name as key for case-insensitive lookup
            exact[cookieName.toLowerCase()] = entry;
        }
    }

    // Add curated entries for the most important cookies not in the DB
    const CURATED_COOKIES = {
        '_ga': { platform: 'Google Analytics', category: 'analytics', description: 'Registers a unique ID to generate statistical data on how the visitor uses the website.', retentionPeriod: '2 years', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        '_gid': { platform: 'Google Analytics', category: 'analytics', description: 'Registers a unique ID to generate statistical data on how the visitor uses the website. Expires after 24 hours.', retentionPeriod: '1 day', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        '_gat': { platform: 'Google Analytics', category: 'analytics', description: 'Used by Google Analytics to throttle request rate.', retentionPeriod: '1 minute', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        '_fbp': { platform: 'Facebook Pixel', category: 'marketing', description: 'Used by Facebook to deliver a series of advertisement products such as real time bidding from third party advertisers.', retentionPeriod: '3 months', dataController: 'Meta Platforms, Inc.', privacyUrl: 'https://www.facebook.com/privacy/policy/' },
        '_fbc': { platform: 'Facebook Pixel', category: 'marketing', description: 'Used by Facebook to store click IDs from ads for conversion measurement.', retentionPeriod: '3 months', dataController: 'Meta Platforms, Inc.', privacyUrl: 'https://www.facebook.com/privacy/policy/' },
        'fr': { platform: 'Facebook', category: 'marketing', description: 'Used by Facebook to deliver a series of advertisement products such as real time bidding from third party advertisers.', retentionPeriod: '3 months', dataController: 'Meta Platforms, Inc.', privacyUrl: 'https://www.facebook.com/privacy/policy/' },
        'ide': { platform: 'Google DoubleClick', category: 'marketing', description: 'Used by Google DoubleClick to register and report the website user\'s actions after viewing or clicking one of the advertiser\'s ads.', retentionPeriod: '1 year', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        '__gads': { platform: 'Google Ads', category: 'marketing', description: 'Used to register what ads have been displayed to the user. Used to measure effectiveness of ads.', retentionPeriod: '1 year', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        'muid': { platform: 'Microsoft Bing', category: 'marketing', description: 'Used by Microsoft Bing Ads to identify a unique web browser. Cookie enables ad targeting and is linked to a unique user ID.', retentionPeriod: '1 year', dataController: 'Microsoft Corporation', privacyUrl: 'https://privacy.microsoft.com' },
        '_clck': { platform: 'Microsoft Clarity', category: 'analytics', description: 'Used by Microsoft Clarity to track user interactions on the website for analytics.', retentionPeriod: '1 year', dataController: 'Microsoft Corporation', privacyUrl: 'https://privacy.microsoft.com' },
        '_clsk': { platform: 'Microsoft Clarity', category: 'analytics', description: 'Used by Microsoft Clarity to store and consolidate page views of a user\'s single session.', retentionPeriod: '1 day', dataController: 'Microsoft Corporation', privacyUrl: 'https://privacy.microsoft.com' },
        '_hjid': { platform: 'Hotjar', category: 'analytics', description: 'Sets a unique ID for the session. This allows the website to obtain data on visitor behavior for statistical purposes.', retentionPeriod: '1 year', dataController: 'Hotjar Ltd.', privacyUrl: 'https://www.hotjar.com/legal/policies/privacy/' },
        'bcookie': { platform: 'LinkedIn', category: 'marketing', description: 'Used by LinkedIn to track visitors on multiple websites, in order to present relevant advertisement based on the visitor\'s preferences.', retentionPeriod: '2 years', dataController: 'LinkedIn Corporation', privacyUrl: 'https://www.linkedin.com/legal/privacy-policy' },
        'lidc': { platform: 'LinkedIn', category: 'functional', description: 'Used by LinkedIn for routing purposes; facilitates data center selection.', retentionPeriod: '1 day', dataController: 'LinkedIn Corporation', privacyUrl: 'https://www.linkedin.com/legal/privacy-policy' },
        'usermatchhistory': { platform: 'LinkedIn', category: 'marketing', description: 'Used to track visitors across multiple websites, in order to present relevant advertisement based on visitor preferences.', retentionPeriod: '1 month', dataController: 'LinkedIn Corporation', privacyUrl: 'https://www.linkedin.com/legal/privacy-policy' },
        'ysc': { platform: 'YouTube', category: 'functional', description: 'Registers a unique ID to keep statistics of what videos from YouTube the user has seen.', retentionPeriod: 'Session', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        'visitor_info1_live': { platform: 'YouTube', category: 'functional', description: 'Tries to estimate the user\'s bandwidth on pages with integrated YouTube videos.', retentionPeriod: '6 months', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        'nid': { platform: 'Google', category: 'functional', description: 'Registers a unique ID that identifies a returning user\'s device. The ID is used for targeted ads.', retentionPeriod: '6 months', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        'consent': { platform: 'Google', category: 'necessary', description: 'Used to detect if the visitor has accepted the marketing category in the cookie banner.', retentionPeriod: '2 years', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' },
        '__cf_bm': { platform: 'Cloudflare', category: 'necessary', description: 'Used to identify and distinguish bots from human visitors. Part of Cloudflare\'s Bot Management solution.', retentionPeriod: '30 minutes', dataController: 'Cloudflare, Inc.', privacyUrl: 'https://www.cloudflare.com/privacypolicy/' },
        '_hjsession': { platform: 'Hotjar', category: 'analytics', description: 'Contains current session data. Holds cookie for the duration of the browser session.', retentionPeriod: '30 minutes', dataController: 'Hotjar Ltd.', privacyUrl: 'https://www.hotjar.com/legal/policies/privacy/' },
        'mp_': { platform: 'Mixpanel', category: 'analytics', description: 'Used by Mixpanel to track events and user behavior for analytics.', retentionPeriod: '1 year', dataController: 'Mixpanel, Inc.', privacyUrl: 'https://mixpanel.com/legal/privacy-policy/' },
        'ajs_': { platform: 'Segment', category: 'analytics', description: 'Used by Segment.io to track visitors across web pages.', retentionPeriod: '1 year', dataController: 'Twilio Inc.', privacyUrl: 'https://www.twilio.com/legal/privacy' },
        '_mkto_trk': { platform: 'Marketo', category: 'marketing', description: 'This cookie is set by Marketo. This allows the website to track visitor behavior for marketing purposes.', retentionPeriod: '2 years', dataController: 'Adobe Inc.', privacyUrl: 'https://www.adobe.com/privacy.html' },
        '__qca': { platform: 'Quantcast', category: 'marketing', description: 'Collects data on visitor behaviour from multiple websites, in order to present more relevant advertisements.', retentionPeriod: '1 year', dataController: 'Quantcast Corporation', privacyUrl: 'https://www.quantcast.com/privacy/' },
        'intercom-': { platform: 'Intercom', category: 'functional', description: 'Used by Intercom to identify the visitor and link to a user account for live chat support.', retentionPeriod: '9 months', dataController: 'Intercom, Inc.', privacyUrl: 'https://www.intercom.com/legal/privacy' },
    };

    for (const [name, entry] of Object.entries(CURATED_COOKIES)) {
        if (!exact[name.toLowerCase()]) {
            exact[name.toLowerCase()] = entry;
        }
    }

    // Curated wildcard patterns
    const CURATED_WILDCARDS = [
        { pattern: '_ga_*', regex: '^_ga_.*$', entry: { platform: 'Google Analytics 4', category: 'analytics', description: 'Used by Google Analytics 4 to persist session state.', retentionPeriod: '2 years', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' } },
        { pattern: '__utm*', regex: '^__utm.*$', entry: { platform: 'Google Analytics (Legacy)', category: 'analytics', description: 'Used by Google Analytics (Urchin) to track visitor source, session information, and campaign data.', retentionPeriod: '2 years', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' } },
        { pattern: '_hjAbsoluteSessionInProgress*', regex: '^_hjAbsoluteSessionInProgress.*$', entry: { platform: 'Hotjar', category: 'analytics', description: 'Used by Hotjar to detect the first pageview session of a user.', retentionPeriod: '30 minutes', dataController: 'Hotjar Ltd.', privacyUrl: 'https://www.hotjar.com/legal/policies/privacy/' } },
        { pattern: '__stripe_*', regex: '^__stripe_.*$', entry: { platform: 'Stripe', category: 'necessary', description: 'Used by Stripe for fraud prevention and to remember device trust state.', retentionPeriod: '1 year', dataController: 'Stripe, Inc.', privacyUrl: 'https://stripe.com/privacy' } },
        { pattern: '_dc_gtm_*', regex: '^_dc_gtm_.*$', entry: { platform: 'Google Tag Manager', category: 'analytics', description: 'Used by Google Tag Manager to control the loading of a Google Analytics tag.', retentionPeriod: '1 minute', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' } },
        { pattern: 'visitor_info1_live*', regex: '^visitor_info1_live.*$', entry: { platform: 'YouTube', category: 'functional', description: 'Used by YouTube to store user preferences and bandwidth information.', retentionPeriod: '6 months', dataController: 'Google LLC', privacyUrl: 'https://policies.google.com/privacy' } },
    ];

    for (const wc of CURATED_WILDCARDS) {
        if (!wildcards.find(w => w.pattern === wc.pattern)) {
            wildcards.push(wc);
        }
    }

    const output = { exact, wildcards };
    await writeFile(join(ASSETS_DIR, 'cookie-database.json'), JSON.stringify(output));
    log(`✅ Cookie Database: ${Object.keys(exact).length} exact + ${wildcards.length} wildcard entries → cookie-database.json`);
}

// ---------------------------------------------------------------------------
// 3. EasyPrivacy
//    Extract only domain-level rules (network filters, not cosmetic)
// ---------------------------------------------------------------------------
async function buildEasyPrivacy() {
    log('--- Building EasyPrivacy Domain List ---');

    const url = 'https://easylist.to/easylist/easyprivacy.txt';
    let text = '';
    try {
        text = await fetchText(url);
    } catch (e) {
        // EasyPrivacy is critical, without it tracker domain detection is crippled.
        // Rethrow so the build fails rather than shipping an empty list.
        throw new Error(`Failed to fetch EasyPrivacy (critical): ${e.message}`);
    }

    const domains = new Set();
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments, cosmetic rules, exceptions, and options-only rules
        if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[') ||
            trimmed.startsWith('##') || trimmed.startsWith('#@#') ||
            trimmed.startsWith('@@') || trimmed.includes('##')) continue;

        // Extract domain from rules like: ||doubleclick.net^
        const domainMatch = trimmed.match(/^\|\|([a-zA-Z0-9.-]+)\^/);
        if (domainMatch) {
            const domain = domainMatch[1].toLowerCase();
            // Skip very short or obviously invalid
            if (domain.length > 3 && domain.includes('.')) {
                domains.add(domain);
            }
        }
    }

    const output = [...domains];
    await writeFile(join(ASSETS_DIR, 'easyprivacy-domains.json'), JSON.stringify(output));
    log(`✅ EasyPrivacy: ${output.length} tracker domains → easyprivacy-domains.json`);
}

// ---------------------------------------------------------------------------
// 4. Disconnect Services
//    Categorized tracker services: Advertising, Analytics, Social, Content, etc.
// ---------------------------------------------------------------------------
async function buildDisconnectServices() {
    log('--- Building Disconnect Services ---');

    const url = 'https://raw.githubusercontent.com/nicedoc/tracking-protection-lists/main/services.json';
    let data = null;
    try {
        data = await fetchJson(url);
    } catch (e) {
        // Try alternate source before failing
        try {
            const alt = 'https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/master/services.json';
            data = await fetchJson(alt);
        } catch (e2) {
            // Disconnect services are critical, without them tracker categorization is broken.
            // Rethrow so the build fails rather than shipping an empty database.
            throw new Error(`Failed to fetch Disconnect services from both sources (critical): ${e2.message}`);
        }
    }

    // Build flat lookup: { [domain]: { category, entityName } }
    const output = {};

    const categories = data?.categories || {};
    for (const [category, entities] of Object.entries(categories)) {
        for (const entity of entities) {
            for (const [entityName, domains] of Object.entries(entity)) {
                for (const domainList of Object.values(domains)) {
                    const domainArr = Array.isArray(domainList) ? domainList : [domainList];
                    for (const domain of domainArr) {
                        if (typeof domain === 'string') {
                            output[domain.toLowerCase()] = { category, entityName };
                        }
                    }
                }
            }
        }
    }

    await writeFile(join(ASSETS_DIR, 'disconnect-services.json'), JSON.stringify(output));
    log(`✅ Disconnect: ${Object.keys(output).length} domains → disconnect-services.json`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    log('Starting database build...');
    const start = Date.now();

    // Use Promise.all (NOT allSettled) so any failure causes the entire build to exit 1.
    // This prevents deploying an extension with empty/broken privacy databases.
    await Promise.all([
        buildTrackerRadar(),
        buildCookieDatabase(),
        buildEasyPrivacy(),
        buildDisconnectServices(),
    ]);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`\n✅ All databases built in ${elapsed}s`);
    log(`Output: ${ASSETS_DIR}`);
}

main().catch(e => { err(e.message); process.exit(1); });
