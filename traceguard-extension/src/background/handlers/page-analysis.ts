/**
 * Page analysis handler, extracted from background/index.ts.
 *
 * The body is unchanged from the worker version. Only the worker-scoped
 * helpers it cannot import without a cycle (the vault key, notifications and
 * per-domain score lookup) arrive through PageAnalysisDeps. This keeps the
 * handler testable on its own and stops background/index.ts from growing.
 */
import { z } from 'zod';
import { storage, readBuffer, writeBuffer } from '../../lib/storage';
import { captureError, logEvent } from '../../lib/diagnostics';
import { calculateWSS, calculateTrackingScore, explainWSS, type WssContext } from '../../lib/scoring';
import { SiteRiskData, EnrichedDetectionDetails, FingerprintingDetail, DetectorLogEntry } from '../../lib/types';
import { checkReputation } from '../services/reputation';
import { readSiteEntry, writeSiteCacheEntry } from '../../lib/site-cache';
import { slimSiteData } from '../../lib/site-sync';
import { isStoppedBeforeLoading } from '../../lib/tracker-status';
import { isLocalUrl } from '../../lib/utils';
import { lookupTrackerDomain } from '../services/database-loader';
import { getAndClearNetworkData } from '../services/network-monitor';
import { enrichCookies } from '../services/cookie-enricher';
import { enrichTrackers } from '../services/tracker-enricher';
import { analyzeHeaders, computeHeaderGrade } from '../services/header-analyzer';
import { updateTabBadge } from '../badge-icon';

export interface PageAnalysisDeps {
    getCryptoKey: () => Promise<CryptoKey | null>;
    createNotification: (
        notification: Parameters<typeof storage.addNotification>[0],
        key?: CryptoKey | null,
    ) => Promise<void>;
    resolveSiteScore: (
        domain: string,
        key: CryptoKey | null,
    ) => Promise<{ wss: number; reputation: number | undefined }>;
}

const PageAnalysisSchema = z.object({
    url: z.string(),
    isInitialLoad: z.boolean().optional(),
    scores: z.record(z.string(), z.number()),
    detectionDetails: z.record(z.string(), z.any()).optional(),
    rawForEnrichment: z.object({
        cookies:        z.array(z.any()).max(500).optional(),
        trackers:       z.array(z.any()).max(500).optional(),
        fingerprinting: z.array(z.any()).max(200).optional(),
    }).optional()
}).passthrough();

// The PII path stores what it receives and repeats some of it in notifications,
// so the fields the content script contributes are validated the same way as a
// page analysis payload.

export async function handlePageAnalysis(message: any, sender: chrome.runtime.MessageSender, deps: PageAnalysisDeps) {
    const parsed = PageAnalysisSchema.safeParse(message);
    if (!parsed.success) {
        logEvent('content', 'warn', 'page_analysis_invalid', 'Rejected a malformed page analysis payload', { issues: parsed.error.issues.map(issue => issue.path.join('.')).join(', ') });
        return;
    }
    const validMessage = parsed.data;

    if (!validMessage.url || isLocalUrl(validMessage.url)) {
        logEvent('content', 'warn', 'page_analysis_local_url', 'Page analysis skipped for a missing or local URL');
        return;
    }
    message = validMessage;

    // A genuine navigation (the content script's initial analysis of a
    // document load) is scoreable. Mutation-triggered re-analyses of the same
    // page (isInitialLoad === false) must not re-apply penalties or duplicate
    // history, logs, counters, or notifications.
    const isNewNavigation = message.isInitialLoad !== false;

    // Transport is not a detector score, but a plain-HTTP page cannot read as
    // safe no matter how clean its detectors are (see MAX_WSS_WITHOUT_HTTPS).
    const scoreContext: WssContext = { secure: new URL(message.url).protocol === 'https:' };

    // Honor the master on/off toggle, ignore analysis while paused.
    const preSettings = await storage.getSettings();
    if (!preSettings.enabled) return;

    // Step 1: Check the website's reputation (is it on any blacklists?)
    const reputationResult = await checkReputation(message.url);
    const reputationScore = typeof reputationResult === 'number' ? reputationResult : reputationResult.score;
    const reputationChecks = typeof reputationResult === 'number' ? [] : reputationResult.checks;

    // Combine all the individual detector scores into one object (tracking may
    // be corrected later from the bundled databases, so it stays a `const` with
    // mutable fields rather than being reassigned).
    const finalScores = { ...message.scores, reputation: reputationScore };

    if (!message.detectionDetails) {
        message.detectionDetails = {};
    }
    message.detectionDetails.reputation = {
        // Name the worst case. A score of 0 means the domain matched a threat
        // list, which is materially different from a merely low score.
        status: reputationScore === 0 ? 'Blacklisted' : reputationScore === 100 ? 'Clean' : 'Suspicious',
        checks: reputationChecks
    };

    // Step 2: Calculate the Website Safety Score (WSS)
    // This combines all 6 detector scores with different weights
    let wss = calculateWSS(finalScores, scoreContext);

    // Extract just the domain name from the full URL
    // For example: "https://www.example.com/page" becomes "www.example.com"
    const domain = new URL(message.url).hostname;
    // Retrieve network data for this tab
    const tabId = sender.tab?.id;
    let networkData = null;
    if (tabId) {
        networkData = await getAndClearNetworkData(tabId);
    }

    // Build enriched data if raw data is provided
    let enrichedDetails: EnrichedDetectionDetails | undefined = undefined;
    if (message.rawForEnrichment) {
        const cookies = await enrichCookies(message.url, message.rawForEnrichment.cookies, networkData?.setCookies || []);
        const trackers = await enrichTrackers(message.url, message.rawForEnrichment.trackers, networkData?.requests || {});
        const headers = analyzeHeaders(networkData?.responseHeaders || []);
        
        const fpRaw = message.rawForEnrichment.fingerprinting || [];
        const fingerprintingItems: FingerprintingDetail[] = await Promise.all(fpRaw.map(async (f: any) => {
            let org = null;
            if (f.scriptUrl) {
                try {
                    const radar = await lookupTrackerDomain(new URL(f.scriptUrl).hostname);
                    org = radar?.owner || radar?.displayName || null;
                } catch (e) {
                    logEvent('enrich', 'warn', 'fingerprint_lookup_failed', 'Tracker lookup for a fingerprint script failed', { error: String(e) });
                }
            }
            return {
                technique: f.technique,
                detected: true,
                scriptDomain: f.scriptUrl ? new URL(f.scriptUrl).hostname : null,
                organization: org,
                description: `Detected ${f.technique} fingerprinting attempt`,
                risk: 'medium'
            };
        }));
        
        enrichedDetails = {
            cookies: {
                items: cookies.slice(0, 100), // cap stored detail; summary keeps full totals
                summary: {
                    total: cookies.length,
                    active: cookies.filter(c => c.status === 'active').length,
                    blockedByBrowser: cookies.filter(c => isStoppedBeforeLoading(c.status)).length,
                    byCategory: cookies.reduce((acc, c) => { acc[c.category] = (acc[c.category] || 0) + 1; return acc; }, {} as Record<string, number>)
                }
            },
            trackers: {
                items: trackers.slice(0, 200), // cap stored detail; summary keeps full totals
                summary: {
                    total: trackers.length,
                    active: trackers.filter(t => t.status === 'active').length,
                    blockedByBrowser: trackers.filter(t => isStoppedBeforeLoading(t.status)).length,
                    byCategory: trackers.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {} as Record<string, number>)
                }
            },
            networkRequests: {
                items: (networkData ? Object.values(networkData.requests) : []).slice(0, 200), // cap stored detail
                summary: {
                    total: networkData ? Object.keys(networkData.requests).length : 0,
                    thirdParty: networkData ? Object.values(networkData.requests).filter(r => r.isThirdParty).length : 0,
                    blockedByBrowser: networkData ? Object.values(networkData.requests).filter(r => isStoppedBeforeLoading(r.status)).length : 0,
                    trackerRequests: networkData ? Object.values(networkData.requests).filter(r => r.isTracker).length : 0
                }
            },
            headers: {
                items: headers,
                summary: (() => {
                    const { score, grade } = computeHeaderGrade(headers);
                    return {
                        score,
                        present: headers.filter(h => h.present).length,
                        missing: headers.filter(h => !h.present).length,
                        grade
                    };
                })()
            },
            fingerprinting: {
                items: fingerprintingItems.slice(0, 100), // cap stored detail
                summary: {
                    totalAttempts: fpRaw.length,
                    techniques: fpRaw.map((f: any) => f.technique),
                    riskLevel: fpRaw.length > 0 ? 'medium' : 'none'
                }
            },
            capturedAt: Date.now()
        };
    }

    // The bundled tracker databases (Tracker Radar / EasyPrivacy / Disconnect)
    // are the authoritative tracker list. When enrichment ran, replace the
    // content script's small hardcoded-list score with a score derived from the
    // actual tracked domains, then recompute WSS against that correction.
    if (enrichedDetails) {
        const uniqueTrackers = new Set(enrichedDetails.trackers.items.map(t => t.domain));
        finalScores.tracking = calculateTrackingScore(uniqueTrackers.size);
        wss = calculateWSS(finalScores, scoreContext);
    }

    // Step 3: Create a data object with all the site's information
    const siteData: SiteRiskData = {
        domain,                                    // The website's domain name
        wss,                                       // Website Safety Score (0-100, higher = safer)
        breakdown: finalScores,                    // Individual scores for each detector
        lastAnalyzed: Date.now(),                  // When we analyzed it (timestamp)
        detectionDetails: message.detectionDetails,// Detailed info about what was detected
        enrichedDetails                            // NEW: Rich per-item analysis
    };

    // Step 4: Save this site's data to the cache
    const key = await deps.getCryptoKey();
    // Only this domain's shard is read. The old code decrypted and rewrote the
    // entire cache on every navigation.
    let existingSite: SiteRiskData | undefined;
    if (key) {
        existingSite = await readSiteEntry(domain, key);
    } else {
        const buffered = (await readBuffer<Record<string, SiteRiskData>>('bufferedSiteCache')) || {};
        existingSite = buffered[domain];
    }

    // Determine if this is a unique domain visit today
    const now = Date.now();
    let isUniqueDomain = false;
    if (!existingSite || !existingSite.lastVisit) {
        isUniqueDomain = true;
    } else {
        const lastVisitDate = new Date(existingSite.lastVisit).toDateString();
        const todayDate = new Date(now).toDateString();
        if (lastVisitDate !== todayDate) {
            isUniqueDomain = true;
        }
    }

    // Add visit tracking to the site data. Count one visit per genuine
    // navigation; SPA re-analyses of the same page must not inflate the count.
    const visitCount = (existingSite?.visitCount || 0) + (isNewNavigation ? 1 : 0);
    siteData.visitCount = visitCount;
    siteData.lastVisit = now;  // Current time in milliseconds

    // Save the updated site data. One shard is encrypted and written; the rest
    // of the cache is not touched. The daily cleanup alarm enforces the total cap.
    if (key) {
        const written = await writeSiteCacheEntry(siteData, key);
        if (!written) {
            captureError('storage', new Error('siteCache shard could not be written'), 'site_cache_write_failed');
        }
    } else {
        const buffered = (await readBuffer<Record<string, SiteRiskData>>('bufferedSiteCache')) || {};
        buffered[domain] = siteData;
        await writeBuffer('bufferedSiteCache', buffered);
    }

    // Step 5: Update the user's privacy state

    // Check if the tab that sent this analysis is the currently active tab
    let isActiveTab = true;
    if (sender.tab?.id) {
        try {
            const currentTab = await chrome.tabs.get(sender.tab.id);
            isActiveTab = currentTab.active;
        } catch {
            // Tab might be closed
            isActiveTab = false;
        }
    }

    // The User Privacy Score is derived from the handover record, not from
    // visits (see lib/ups.ts). Visiting a site never moves it: only a handover
    // does, in finalizePIIDetection. So nothing here scores the navigation.

    // Save the updated state
    // Count enriched trackers detected on this visit (both loaded and stopped)
    const newTrackersCount = enrichedDetails ? enrichedDetails.trackers.items.length : 0;
    
    // Only update currentSite if the analysis is from the active tab.
    // Persist only the non-sensitive fields to plaintext state, the full
    // analysis lives (encrypted) in siteCache. The reducer form recomputes
    // counters from the freshest state inside the serialized write chain so
    // concurrent tab analyses can never lose an increment.
    await storage.updateState((current) => ({
        sitesAnalyzed: current.sitesAnalyzed + (isUniqueDomain ? 1 : 0),           // Increment the counter only for unique sites today
        trackersDetected: (current.trackersDetected || 0) + (isNewNavigation ? newTrackersCount : 0), // Accumulate once per genuine navigation
        ...(isActiveTab ? { currentSite: slimSiteData(siteData) } : {}),
    }));

    // Update the toolbar badge for this tab now that the final WSS is known.
    if (tabId !== undefined) {
        await updateTabBadge(tabId, wss);
    }

    // Step 6: Prepare the detector journal for this visit. The journal holds
    // real detector events only; the UPS is derived from handovers elsewhere.
    const detectorLogsToWrite: Array<Omit<DetectorLogEntry, 'id' | 'timestamp'>> = [];

    // Step 7: Log detailed information from each detector
    // This creates activity logs that show up in the "Activity Logs" page

    // Prefer the enriched tracker list (from the bundled databases) when it is
    // available; otherwise fall back to the content script's hardcoded-list
    // detection details.
    const enrichedTrackerDomains = enrichedDetails
        ? Array.from(new Set(enrichedDetails.trackers.items.map(t => t.domain)))
        : null;
    const trackingDetails = enrichedTrackerDomains
        ? {
            trackerCount: enrichedTrackerDomains.length,
            knownTrackers: enrichedTrackerDomains,
            suspiciousTrackers: [],
          }
        : (message.detectionDetails?.tracking
            ? {
                trackerCount: message.detectionDetails.tracking.count || 0,
                knownTrackers: Array.isArray(message.detectionDetails.tracking.known)
                    ? message.detectionDetails.tracking.known
                    : new Array(message.detectionDetails.tracking.known || 0).fill('unknown'),
                suspiciousTrackers: Array.isArray(message.detectionDetails.tracking.suspicious)
                    ? message.detectionDetails.tracking.suspicious
                    : new Array(message.detectionDetails.tracking.suspicious || 0).fill('unknown')
              }
            : { trackerCount: 0, knownTrackers: [], suspiciousTrackers: [] });
    const trackingMessage = trackingDetails.trackerCount === 0
        ? 'No third-party trackers detected'
        : `${trackingDetails.trackerCount} trackers detected (${trackingDetails.knownTrackers.length} known)`;

    // Create human-readable messages for each detector
    const detectorMessages = {
        reputation: reputationScore === 100 ? 'Not on any known threat list' : reputationScore === 0 ? 'Domain blacklisted!' : `Domain reputation score: ${reputationScore}`,
        tracking: trackingMessage,
        cookies: finalScores.cookies >= 80 ? 'No tracking cookies detected' : `Tracking cookies detected (safety: ${finalScores.cookies})`,
        inputs: finalScores.input >= 80 ? 'No sensitive input fields' : `Sensitive input fields detected (safety: ${finalScores.input})`,
        policy: finalScores.policy >= 80 ? 'Good privacy policy' : finalScores.policy <= 25 ? 'No privacy policy found' : `Privacy policy concerns (safety: ${finalScores.policy})`
    };

    // Log each detector's findings to storage (6 logs total, one for each detector)

    // REPUTATION: Is this domain known to be dangerous?
    detectorLogsToWrite.push({
        detector: 'reputation',
        domain,
        score: reputationScore,
        details: { isBlacklisted: reputationScore === 0, status: reputationScore === 100 ? 'Clean' : reputationScore === 0 ? 'Blacklisted' : 'Suspicious' },
        message: detectorMessages.reputation
    });

    // TRACKING: How many third-party trackers are on this page?
    detectorLogsToWrite.push({
        detector: 'tracking',
        domain,
        score: finalScores.tracking,
        details: {
            trackerCount: trackingDetails.trackerCount,
            knownTrackers: trackingDetails.knownTrackers,
            suspiciousTrackers: trackingDetails.suspiciousTrackers
        },
        message: detectorMessages.tracking
    });

    // COOKIES: Are there tracking or third-party cookies?
    detectorLogsToWrite.push({
        detector: 'cookies',
        domain,
        score: finalScores.cookies,
        details: message.detectionDetails?.cookies || {},
        message: detectorMessages.cookies
    });

    // INPUTS: Are there sensitive input fields (password, credit card, etc.)?
    detectorLogsToWrite.push({
        detector: 'inputs',
        domain,
        score: finalScores.input,
        details: message.detectionDetails?.input || {},
        message: detectorMessages.inputs
    });

    // POLICY: What's the privacy policy rating (from ToS;DR)?
    detectorLogsToWrite.push({
        detector: 'policy',
        domain,
        score: finalScores.policy,
        details: message.detectionDetails?.policy || {},
        message: detectorMessages.policy
    });

    // Single batched write: avoids six read-decrypt-encrypt-write cycles of the
    // full (up to 1,000-entry) detector log array per page visit. Only write
    // once per genuine navigation so SPA re-analyses don't spam the journal.
    if (isNewNavigation && detectorLogsToWrite.length > 0) {
        await storage.addDetectorLogs(detectorLogsToWrite, key);
    }

    // Step 8: Create notifications for risky sites
    const settings = await storage.getSettings();
    const threshold = settings.wssThreshold || 60;  // User's custom safety threshold

    // Check if this site is dangerous enough to warn the user
    // WSS is a safety score: lower = more dangerous

    // Notify on each genuine navigation, SPA re-analyses must not spam alerts.
    if (isNewNavigation && wss <= 20) {
        // CRITICAL RISK: Score is 20 or below - this site is very dangerous!
        await deps.createNotification({
            type: 'high_risk_site',
            title: 'Critical Risk Site!',
            titleKey: 'Critical Risk Site!',
            message: `${domain} has been flagged as a critical risk with a safety score of ${wss}`,
            messageKey: '{{domain}} has been flagged as a critical risk with a safety score of {{wss}}',
            params: { domain, wss },
            domain,
            severity: 'critical',
            actionUrl: `/overview?viewSite=${encodeURIComponent(domain)}`
        });
    } else if (isNewNavigation && wss < threshold) {
        // WARNING: Site falls below the user's personal safety threshold
        await deps.createNotification({
            type: 'high_risk_site',
            title: 'High Risk Site Detected',
            titleKey: 'High Risk Site Detected',
            message: `${domain} falls below your safety threshold (Score: ${wss})`,
            messageKey: '{{domain}} falls below your safety threshold (Score: {{wss}})',
            params: { domain, wss },
            domain,
            severity: 'warning',
            actionUrl: `/overview?viewSite=${encodeURIComponent(domain)}`
        });
    }

    // Verbose scoring summary. The 1.4.3 cleanup deleted the console.log that
    // printed this, which left the final WSS and its detector breakdown
    // unobservable. Developer mode is now the only place to read them without
    // attaching a debugger. Note that a 100 here can mean a clean page or a
    // detector that threw and fell back to a neutral score.
    const explanation = explainWSS(finalScores, scoreContext);
    logEvent('scoring', 'debug', 'page_analysis_complete', `${domain} scored ${wss}`, {
        host: domain,
        wss,
        isNewNavigation,
        detectorScores: {
            reputation: finalScores.reputation,
            tracking: finalScores.tracking,
            cookies: finalScores.cookies,
            fingerprinting: finalScores.fingerprinting,
            input: finalScores.input,
            policy: finalScores.policy,
        },
        // The audit trail: which weights were applied (policy's weight is
        // redistributed when ToS;DR had no rating) and what each detector
        // actually contributed to the total.
        policyFallback: explanation.policyFallback,
        caps: explanation.caps,
        weights: explanation.weights,
        contributions: Object.fromEntries(
            Object.entries(explanation.contributions).map(([key, value]) => [key, Math.round(value * 10) / 10])
        ),
    });

}

// =============================================================================
// PII DETECTION HANDLER  
// Processes personal information detection events
// =============================================================================
