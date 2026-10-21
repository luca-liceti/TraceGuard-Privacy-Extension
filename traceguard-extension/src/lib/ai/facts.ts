import type { PIIDetectionEvent, SiteRiskData } from '../types';
import { MAX_FACT_LABEL_CHARS, MAX_FACT_VALUE_CHARS } from './limits';
import type { SummaryFact, SummaryRequest } from './types';

const DETECTORS = ['tracking', 'cookies', 'fingerprinting', 'input', 'reputation', 'policy'] as const;
type Detector = typeof DETECTORS[number];

/**
 * Keep a fact inside the summarizer's limits. The builders below stay under
 * them by construction; this is the last-resort bound so a single long value
 * (a very long domain, for example) can never make the whole request fail.
 * A cut value ends with an ellipsis so it does not read as a complete finding.
 */
function boundedFact(fact: SummaryFact): SummaryFact {
    return {
        label: fact.label.length > MAX_FACT_LABEL_CHARS
            ? `${fact.label.slice(0, MAX_FACT_LABEL_CHARS - 1)}…`
            : fact.label,
        value: fact.value.length > MAX_FACT_VALUE_CHARS
            ? `${fact.value.slice(0, MAX_FACT_VALUE_CHARS - 1)}…`
            : fact.value,
    };
}

function safeCount(value: unknown, max = 1_000_000_000): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) return undefined;
    return Math.round(value);
}

function safeDomain(value: unknown): string {
    return typeof value === 'string'
        && value.length <= 253
        && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value)
        && !value.includes('..')
        ? value.toLowerCase()
        : 'unknown site';
}

function safeGrade(value: unknown): string | undefined {
    return typeof value === 'string' && /^[A-F]$/.test(value) ? value : undefined;
}

function safetyBand(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'critical';
}

function scoreOf(site: SiteRiskData, detector: Detector): number | undefined {
    const value = detector === 'fingerprinting' ? site.breakdown?.fingerprinting : site.breakdown?.[detector];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
        ? Math.round(value)
        : undefined;
}

function safeFinding(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value
        .replace(/https?:\/\/\S+/gi, '[link omitted]')
        // Drop control characters without a regex range, which the lint rule
        // rejects even when the range is written with escapes.
        .split('')
        .map(char => {
            const code = char.charCodeAt(0);
            return code < 0x20 || code === 0x7f ? ' ' : char;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    return text ? text.slice(0, 110) : undefined;
}

function topCategories(value: unknown, limit = 3): string {
    if (!value || typeof value !== 'object') return '';
    return Object.entries(value as Record<string, unknown>)
        .flatMap(([category, count]) => {
            const safe = safeCount(count, 1_000_000);
            return safe !== undefined && /^[a-z-]{2,24}$/i.test(category) && safe > 0
                ? [{ category: category.toLowerCase(), count: safe }]
                : [];
        })
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
        .slice(0, limit)
        .map(item => `${item.category} ${item.count}`)
        .join(', ');
}

function policyEvidence(site: SiteRiskData): string[] {
    const points = site.detectionDetails?.policy?.points ?? [];
    return points
        .filter(point => ['blocker', 'bad'].includes(point.classification?.toLowerCase()))
        .map(point => safeFinding(point.title))
        .filter((title): title is string => Boolean(title))
        .slice(0, 3);
}

function weakDetectors(site: SiteRiskData): string {
    return DETECTORS
        .map(detector => ({ detector, score: scoreOf(site, detector) }))
        .filter((item): item is { detector: Detector; score: number } => item.score !== undefined && item.score < 60)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(item => `${item.detector} ${safetyBand(item.score)} (${item.score}/100)`)
        .join(', ') || 'none below 60/100';
}

function siteAuditFacts(site: SiteRiskData): SummaryFact[] {
    const facts: SummaryFact[] = [];
    const details = site.detectionDetails;
    const enriched = site.enrichedDetails;

    for (const detector of DETECTORS) {
        const score = scoreOf(site, detector);
        if (score !== undefined) {
            facts.push({
                label: `Detector score: ${detector} (lower means more concern)`,
                value: `${score}/100 (${safetyBand(score)})`,
            });
        }
    }

    const trackers = safeCount(enriched?.trackers?.summary?.total ?? details?.tracking?.count, 1_000_000);
    const known = safeCount(details?.tracking?.known, 1_000_000);
    const suspicious = safeCount(details?.tracking?.suspicious, 1_000_000);
    const trackerCategories = topCategories(enriched?.trackers?.summary?.byCategory);
    if (trackers !== undefined || trackerCategories) {
        const parts = trackers === undefined ? [] : [`${trackers} observed`];
        if (known !== undefined) parts.push(`${known} matched to known trackers`);
        if (suspicious !== undefined) parts.push(`${suspicious} suspicious or unclassified`);
        if (trackerCategories) parts.push(`categories: ${trackerCategories}`);
        facts.push({ label: 'Tracker evidence (observed requests, not proof of data use)', value: parts.join('; ') });
    }

    const cookieCount = safeCount(enriched?.cookies?.summary?.total ?? details?.cookies?.total, 1_000_000);
    const trackingCookies = safeCount(details?.cookies?.tracking, 1_000_000);
    const thirdPartyCookies = safeCount(details?.cookies?.thirdParty, 1_000_000);
    const cookieCategories = topCategories(enriched?.cookies?.summary?.byCategory);
    if (cookieCount !== undefined || trackingCookies !== undefined || thirdPartyCookies !== undefined || cookieCategories) {
        const parts = cookieCount === undefined ? [] : [`${cookieCount} observed`];
        if (trackingCookies !== undefined) parts.push(`${trackingCookies} classified as tracking`);
        if (thirdPartyCookies !== undefined) parts.push(`${thirdPartyCookies} third-party`);
        if (cookieCategories) parts.push(`categories: ${cookieCategories}`);
        facts.push({ label: 'Cookie evidence (counts do not show what a site did with cookies)', value: parts.join('; ') });
    }

    const fingerprinting = enriched?.fingerprinting?.summary;
    const techniques = (fingerprinting?.techniques ?? [])
        .filter((technique): technique is string => typeof technique === 'string' && /^[a-z-]{2,24}$/i.test(technique))
        .slice(0, 6);
    if (fingerprinting && safeCount(fingerprinting.totalAttempts, 1_000_000) !== undefined) {
        const attempts = safeCount(fingerprinting.totalAttempts, 1_000_000)!;
        facts.push({
            label: 'Fingerprinting evidence (an attempt does not prove identification)',
            value: `${attempts} attempts; ${fingerprinting.riskLevel} risk${techniques.length ? `; techniques: ${techniques.join(', ')}` : ''}`,
        });
    }

    const headers = enriched?.headers?.summary;
    const missingHeaders = enriched?.headers?.items
        ?.filter(header => !header.present)
        .map(header => safeFinding(header.header))
        .filter((name): name is string => Boolean(name))
        .slice(0, 3) ?? [];
    const missingHeaderCount = safeCount(headers?.missing, 100);
    const headerGrade = safeGrade(headers?.grade);
    if (headers && (missingHeaderCount !== undefined || headerGrade)) {
        facts.push({
            label: 'Security-header evidence (missing defense is not proof of an attack)',
            value: [headerGrade ? `grade ${headerGrade}` : '', missingHeaderCount === undefined ? '' : `${missingHeaderCount} missing`, missingHeaders.length ? `including ${missingHeaders.join(', ')}` : '']
                .filter(Boolean).join('; '),
        });
    }

    const policyGrade = safeGrade(details?.policy?.grade);
    if (policyGrade) facts.push({ label: 'ToS;DR policy grade', value: policyGrade });
    policyEvidence(site).forEach((title, index) => {
        facts.push({ label: `Recorded adverse ToS;DR finding ${index + 1}`, value: title });
    });
    return facts;
}

function siteAudit(site: SiteRiskData, maxLength: number = MAX_FACT_VALUE_CHARS): string {
    const details = site.detectionDetails;
    const enriched = site.enrichedDetails;
    const trackerCount = safeCount(enriched?.trackers?.summary?.total ?? details?.tracking?.count, 1_000_000);
    const trackerCategories = topCategories(enriched?.trackers?.summary?.byCategory, 2);
    const cookieCount = safeCount(enriched?.cookies?.summary?.total ?? details?.cookies?.total, 1_000_000);
    const trackingCookies = safeCount(details?.cookies?.tracking, 1_000_000);
    const thirdPartyCookies = safeCount(details?.cookies?.thirdParty, 1_000_000);
    const fingerprinting = enriched?.fingerprinting?.summary;
    const techniques = (fingerprinting?.techniques ?? [])
        .filter((technique): technique is string => typeof technique === 'string' && /^[a-z-]{2,24}$/i.test(technique))
        .slice(0, 3);
    const missingHeaders = enriched?.headers?.items
        ?.filter(header => !header.present)
        .map(header => safeFinding(header.header))
        .filter((name): name is string => Boolean(name))
        .slice(0, 2) ?? [];
    const parts = [
        trackerCount === undefined ? '' : `trackers ${trackerCount}${trackerCategories ? ` (${trackerCategories})` : ''}`,
        cookieCount === undefined ? '' : `cookies ${cookieCount}${trackingCookies === undefined ? '' : `, ${trackingCookies} tracking`}${thirdPartyCookies === undefined ? '' : `, ${thirdPartyCookies} third-party`}`,
        fingerprinting && fingerprinting.totalAttempts > 0
            ? `fingerprinting ${fingerprinting.totalAttempts} attempts${techniques.length ? ` (${techniques.join(', ')})` : ''}`
            : '',
        missingHeaders.length ? `missing headers: ${missingHeaders.join(', ')}` : '',
        ...policyEvidence(site).slice(0, 1).map(title => `adverse policy point: ${title}`),
    ].filter(Boolean);
    // Keep only complete findings within the per-site input budget, rather than
    // cutting a finding in half and hiding its source or meaning.
    const included: string[] = [];
    for (const part of parts) {
        const candidate = [...included, part].join('; ');
        if (candidate.length <= maxLength) included.push(part);
    }
    if (included.length > 0) return included.join('; ');
    return parts.length === 0
        ? 'No detailed tracker, cookie, fingerprinting, header, or policy finding was recorded.'
        : 'Detailed findings were left out to fit the local request limit.';
}

/** Build an allow-listed audit input from stored findings, never raw URLs or form types. */
export function buildSiteSummaryRequest(site: SiteRiskData): SummaryRequest {
    const domain = safeDomain(site.domain);
    const siteScore = safeCount(site.wss, 100);
    return {
        subject: 'site',
        subjectName: domain,
        facts: [
            { label: 'Site', value: domain },
            siteScore === undefined ? null : { label: 'Website Safety Score (higher is safer)', value: `${siteScore}/100 (${safetyBand(siteScore)})` },
            ...siteAuditFacts(site),
        ].filter((item): item is SummaryFact => Boolean(item)).map(boundedFact),
    };
}

/**
 * Build a bounded audit of analyzed sites and recorded data handovers. It sends
 * no PII field types, event-level details, tracker URLs, or page text.
 */
export function buildLogSummaryRequest(
    siteCache: Record<string, SiteRiskData>,
    handovers: readonly PIIDetectionEvent[] = [],
): SummaryRequest | null {
    const sites = Object.values(siteCache).filter((site): site is SiteRiskData => Boolean(site && typeof site === 'object'));
    if (sites.length === 0) return null;

    const scoredSites = sites.flatMap(site => {
        const wss = safeCount(site.wss, 100);
        return wss === undefined ? [] : [{ site, wss }];
    });
    const detectorBands = DETECTORS.map(detector => {
        const scores = sites.map(site => scoreOf(site, detector)).filter((score): score is number => score !== undefined);
        const below60 = scores.filter(score => score < 60).length;
        const strong = scores.filter(score => score >= 80).length;
        return {
            label: `Cross-site ${detector} audit (${scores.length} sites scored)`,
            value: `${below60} below 60/100; ${strong} at least 80/100`,
        };
    });
    const bandCounts = ['critical', 'poor', 'fair', 'good', 'excellent']
        .map(band => `${scoredSites.filter(site => safetyBand(site.wss) === band).length} ${band}`)
        .join(', ');
    const worstSites = [...scoredSites]
        .sort((a, b) => a.wss - b.wss || a.site.domain.localeCompare(b.site.domain))
        .slice(0, 5);
    const bestSites = [...scoredSites]
        .sort((a, b) => b.wss - a.wss || a.site.domain.localeCompare(b.site.domain))
        .slice(0, 3);

    const validHandovers = handovers.filter(event => Number.isFinite(event.siteWSS) && event.siteWSS >= 0 && event.siteWSS <= 100);
    const negativeImpacts = validHandovers
        .map(event => event.scoreImpact)
        .filter((impact): impact is number => typeof impact === 'number' && Number.isFinite(impact) && impact < 0);
    const totalPointsLost = Math.round(negativeImpacts.reduce((sum, impact) => sum + Math.abs(impact), 0));
    const below60 = validHandovers.filter(event => event.siteWSS < 60).length;
    const atLeast80 = validHandovers.filter(event => event.siteWSS >= 80).length;
    const averageHandoverScore = validHandovers.length
        ? Math.round(validHandovers.reduce((sum, event) => sum + event.siteWSS, 0) / validHandovers.length)
        : undefined;
    const entriesBySite = new Map<string, { count: number; scoreTotal: number; pointsLost: number }>();
    for (const event of validHandovers) {
        const domain = safeDomain(event.site);
        const entry = entriesBySite.get(domain) ?? { count: 0, scoreTotal: 0, pointsLost: 0 };
        entry.count += 1;
        entry.scoreTotal += event.siteWSS;
        if (typeof event.scoreImpact === 'number' && Number.isFinite(event.scoreImpact) && event.scoreImpact < 0) {
            entry.pointsLost += Math.abs(event.scoreImpact);
        }
        entriesBySite.set(domain, entry);
    }
    const handoverSites = [...entriesBySite.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .slice(0, 5);

    const facts: SummaryFact[] = [
        { label: 'Distinct analyzed sites', value: String(sites.length) },
        { label: 'Site safety-score distribution', value: bandCounts },
        { label: 'Recorded personal-info form entries (not proof of submission; field names and values excluded)', value: String(validHandovers.length) },
        { label: 'Recorded entries on sites below 60/100 safety', value: String(below60) },
        { label: 'Recorded entries on sites at least 80/100 safety', value: String(atLeast80) },
        { label: 'Privacy-score points deducted by recorded entries', value: String(totalPointsLost) },
        ...handoverSites.map(([domain, entry]) => ({
            label: 'Recorded form-entry pattern (not proof of submission)',
            value: `${domain}: ${entry.count} entries on pages averaging ${Math.round(entry.scoreTotal / entry.count)}/100 safety; ${Math.round(entry.pointsLost)} score points deducted`,
        })),
        ...(averageHandoverScore === undefined ? [] : [{ label: 'Average site safety score when recorded data was handed over', value: `${averageHandoverScore}/100` }]),
        ...detectorBands,
        ...worstSites.map((item, index) => {
            const domain = safeDomain(item.site.domain);
            const prefix = `${domain}: ${item.wss}/100 (${safetyBand(item.wss)}); `;
            return {
                label: `Lowest-scoring analyzed site ${index + 1} (sampled evidence, not a complete audit)`,
                // The domain and score share the fact with the audit, so the
                // audit only gets what is left of the value limit after them.
                value: `${prefix}${siteAudit(item.site, MAX_FACT_VALUE_CHARS - prefix.length)}`,
            };
        }),
        ...bestSites.map((item, index) => ({
            label: `Highest-scoring analyzed site ${index + 1} (score is not proof of privacy)`,
            value: `${safeDomain(item.site.domain)}: ${item.wss}/100 (${safetyBand(item.wss)}); weakest recorded signals: ${weakDetectors(item.site)}`,
        })),
    ];

    return { subject: 'log', subjectName: 'your recorded browsing and personal-info form entries', facts: facts.map(boundedFact) };
}
