import { MAX_SUMMARY_CHARS } from './limits';
import type { FactGuardResult, FactViolation, SummaryRequest } from './types';

const DOMAIN_PATTERN = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const NUMBER_PATTERN = /(?<![\p{L}\p{N}])\d+(?:[,.]\d+)?%?(?![\p{L}\p{N}])/gu;
const CAPITALIZED_WORD_PATTERN = /\b[A-Z][a-z]{2,}\b/g;
const COMMON_SENTENCE_WORDS = new Set([
    'a', 'about', 'after', 'all', 'an', 'and', 'are', 'at', 'but', 'by', 'could', 'has', 'have',
    'in', 'is', 'it', 'may', 'more', 'no', 'not', 'of', 'on', 'or', 'score', 'site', 'the', 'this',
    'to', 'was', 'were', 'with', 'your', 'you', 'user',
]);

function tokens(pattern: RegExp, text: string): string[] {
    return [...text.matchAll(pattern)].map(match => match[0]);
}

function comparableNumber(value: string): string {
    return value.replace(/[,.]/g, '').replace(/%$/, '');
}

/**
 * Capitalized words that begin a sentence or a formatted line. They are
 * capitalized by grammar or by markdown, so they are prose rather than named
 * entities. Every line counts, because a model may break its audit into
 * paragraphs, headings, or bullet points.
 */
function sentenceInitialWords(text: string): Set<string> {
    const starts = new Set<string>();
    for (const line of text.split('\n')) {
        // Strip list numbers, bullets, quotes, and heading markers before the
        // first word, so "1. Privacy" and "**Privacy" both read as prose.
        const unformatted = line.replace(/^[^\p{L}]+/u, '');
        const first = unformatted.match(/^(\p{Lu}[\p{Ll}]{2,})/u);
        if (first) starts.add(first[1].toLowerCase());
        // Cover a later sentence in the same line, including one that ends with
        // a quote or a closing bracket before the space.
        for (const match of line.matchAll(/[.!?][)"'\u201d\u2019\]]*\s+(\p{Lu}[\p{Ll}]{2,})/gu)) {
            starts.add(match[1].toLowerCase());
        }
    }
    return starts;
}

/**
 * Compare domains without the leading `www.`. Dropping that prefix names the
 * same site and asserts nothing new, so a fact recorded as `www.bbc.co.uk`
 * should accept a summary that says `bbc.co.uk`.
 */
function comparableDomain(value: string): string {
    return value.toLowerCase().replace(/^www\./, '');
}

/**
 * A small, deliberately conservative guard. It discards a whole answer if it
 * invents a number, a domain, a capitalized named entity, or is too long to
 * inspect. The language model never gets to override this check.
 */
export function validateSummary(text: string, request: SummaryRequest): FactGuardResult {
    const cleaned = text.trim();
    if (!cleaned) return { ok: false, violations: [{ kind: 'empty', token: 'empty summary' }] };
    if (cleaned.length > MAX_SUMMARY_CHARS) return { ok: false, violations: [{ kind: 'too-long', token: `${cleaned.length} characters` }] };

    const source = request.facts.map(item => `${item.label}: ${item.value}`).join('\n');
    const violations: FactViolation[] = [];
    // A numbered list marker ("1." or "2)") is formatting, not a numeric
    // claim, so it is removed before the checks that read values.
    const inspected = cleaned.replace(/^[ \t]*\d{1,3}[.)][ \t]+/gm, '');

    const allowedNumbers = new Set(tokens(NUMBER_PATTERN, source).map(comparableNumber));
    // A domain label can carry digits, such as `site101.example`. When a
    // summary shortens that site to "101", it is naming a supplied fact, not
    // inventing a value, so the label's digit runs count as allowed.
    for (const domain of tokens(DOMAIN_PATTERN, source)) {
        for (const digits of domain.match(/\d+/g) ?? []) allowedNumbers.add(comparableNumber(digits));
    }
    for (const number of tokens(NUMBER_PATTERN, inspected)) {
        if (!allowedNumbers.has(comparableNumber(number))) violations.push({ kind: 'number', token: number });
    }

    const allowedDomains = new Set(tokens(DOMAIN_PATTERN, source).map(comparableDomain));
    for (const domain of tokens(DOMAIN_PATTERN, inspected)) {
        if (!allowedDomains.has(comparableDomain(domain))) violations.push({ kind: 'domain', token: domain });
    }

    const allowedWords = new Set(source.toLowerCase().match(/[\p{L}]+/gu) ?? []);
    const sentenceStarts = sentenceInitialWords(inspected);
    if (request.subject === 'log') {
        const siteCount = request.facts.find(item => item.label === 'Distinct analyzed sites' || item.label.startsWith('Sites analyzed'))?.value;
        const visitCount = request.facts.find(item => item.label.startsWith('Visits counted'))?.value;
        const listedSiteCount = request.facts.find(item => item.label.startsWith('Sites listed below'))?.value;
        const analyzedSites = siteCount ? Number(siteCount) : Number.NaN;
        const totalVisits = visitCount ? Number(visitCount) : Number.NaN;
        const listedSites = listedSiteCount ? Number(listedSiteCount) : Number.NaN;
        const hasPerSiteSample = request.facts.some(item => item.label.startsWith('Lowest-scoring analyzed site'));
        const hasHandoverCounts = request.facts.some(item => item.label.startsWith('Recorded personal-info form entries'));
        const hasSiteScores = request.facts.some(item => item.label === 'Site safety-score distribution');
        const hasSampledScores = request.facts.some(item => item.label.startsWith('Lowest-scoring analyzed site'))
            || request.facts.some(item => item.label.startsWith('Highest-scoring analyzed site'));
        const handoverCount = Number(request.facts.find(item => item.label.startsWith('Recorded personal-info form entries'))?.value);
        const handoversOnSaferSites = Number(request.facts.find(item => item.label.startsWith('Recorded entries on sites at least 80'))?.value);
        const handoverPattern = request.facts.some(item => item.label === 'Recorded form-entry pattern (not proof of submission)');
        const siteCountClaim = /\b(?:visited|visits?\s+(?:across|to|at))\s+(?:a\s+total\s+of\s+)?(\d+)\s+sites?\b/gi;
        const visitAsSiteCount = [...cleaned.matchAll(siteCountClaim)].some(match =>
            Number(match[1]) === totalVisits || Number(match[1]) === analyzedSites);
        // Only a count can be mistaken for a site count. A disclaimer such as
        // "no personal-info form entries were recorded on any site" mentions
        // both words without presenting one as the other, so it must pass.
        const entryWord = '(?:entries|handovers|form\\s+entries)';
        const siteWord = '(?:sites?|websites?)';
        const entryCountClaims = [
            new RegExp(`\\b${entryWord}\\b[^.?!]{0,40}\\b(\\d+)\\s+${siteWord}\\b`, 'gi'),
            new RegExp(`\\b(\\d+)\\s+${siteWord}\\b[^.?!]{0,40}\\b${entryWord}\\b`, 'gi'),
        ];
        const entryAsSiteCount = entryCountClaims.some(pattern =>
            [...cleaned.matchAll(pattern)].some(match =>
                Number.isFinite(handoverCount) && Number(match[1]) === handoverCount));
        if (visitAsSiteCount || entryAsSiteCount) {
            violations.push({ kind: 'claim', token: 'visit or form-entry count described as a site count' });
        }
        if (hasSiteScores && /\b(?:best|safest|most\s+private)\s+(?:site|websites?)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'high safety score described as proof of privacy' });
        }
        if (hasHandoverCounts && /\b(?:never|none|no\s+personal\s+info)\b[^.?!]{0,50}\b(?:entered|typed|shared|submitted)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'absence of recorded form entries described as proof nothing was entered' });
        }
        if (hasPerSiteSample && /\b(?:all|every)\s+(?:of\s+the\s+)?(?:analyzed\s+)?sites?\b/i.test(cleaned)
            && /\b(?:weakest|lowest|worst|concern|score)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'sampled site evidence generalized to all analyzed sites' });
        }
        if (hasSampledScores && /\b(?:range|ranged)\b/i.test(cleaned)
            && /\b\d+\s*(?:to|[-–])\s*\d+\b/.test(cleaned)
            && !/\b(?:sample|listed|shown)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'sampled score range described without sample qualification' });
        }

        // "Form entries mean typing began, not that data was submitted" is the
        // correct disclaimer, so only an affirmative claim is a violation.
        const outcomeWord = /\b(?:submitted|received|sent|shared|gave|provided)\b/i;
        const negatedOutcome = /\b(?:not|never|no|none|neither|without|didn't|did not|doesn't|does not|isn't|is not)\b[^.?!]{0,25}\b(?:submitted|received|sent|shared|gave|provided)\b/i;
        if (Number.isFinite(handoverCount) && handoverCount > 0 && outcomeWord.test(cleaned) && !negatedOutcome.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'form entry described as submitted or received' });
        }
        // Praise must sit in the same sentence as the form-entry words, so an
        // unrelated "good score" cannot be read as praise for entering data.
        const praiseNearEntry = /\b(?:good|careful|responsible|safe)\b[^.?!]{0,40}\b(?:handed|typed|entered|form|personal\s+info)\b|\b(?:handed|typed|entered|form|personal\s+info)\b[^.?!]{0,40}\b(?:good|careful|responsible|safe)\b/i;
        if (Number.isFinite(handoversOnSaferSites) && handoversOnSaferSites > 0 && praiseNearEntry.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'praise for personal-info entries on higher-scoring sites' });
        }
        const comprehensiveHandoverClaim = /\b(?:most|all|every)\s+(?:of\s+)?(?:your\s+)?(?:entries|handovers)\b/i.test(cleaned)
            || /\b(?:most|all|every)\s+(?:of\s+)?(?:your\s+)?sites?\b[^.?!]{0,60}\b(?:form\s+entries|handovers|entered|typed)\b/i.test(cleaned);
        if (handoverPattern && comprehensiveHandoverClaim && !/\b(?:listed|sample|recorded)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'site-level handover sample described as comprehensive' });
        }

        if (Number.isFinite(listedSites) && Number.isFinite(analyzedSites) && listedSites < analyzedSites
            && /\b(?:least\s+(?:frequent|visited)|fewest\s+visits?)\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'top-ranked sites described as the least visited overall' });
        }

        if (Number.isFinite(listedSites) && Number.isFinite(analyzedSites) && listedSites < analyzedSites
            && /\b(?:all|every)\s+(?:of\s+the\s+)?sites?\b/i.test(cleaned)
            && /\b(?:score|safety)\b/i.test(cleaned)
            && /\brange\b/i.test(cleaned)) {
            violations.push({ kind: 'claim', token: 'score range generalized beyond listed sites' });
        }
    }

    for (const name of tokens(CAPITALIZED_WORD_PATTERN, inspected)) {
        const lower = name.toLowerCase();
        // Sentence-initial capitalization and words in the supplied labels are ordinary prose.
        if (sentenceStarts.has(lower) || allowedWords.has(lower) || COMMON_SENTENCE_WORDS.has(lower)) continue;
        violations.push({ kind: 'name', token: name });
    }

    return violations.length > 0 ? { ok: false, violations } : { ok: true, text: cleaned };
}
