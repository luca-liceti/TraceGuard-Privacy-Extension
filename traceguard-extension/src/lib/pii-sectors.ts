/**
 * =============================================================================
 * PII NECESSITY MODEL - Which Sites Legitimately Need Your Data
 * =============================================================================
 *
 * The UPS (User Privacy Score) should only penalize *avoidable* exposure:
 * entering sensitive data on risky sites, or sites that have no business
 * asking for it. This module decides whether a site's sector legitimately
 * needs the data being entered, so expected use (logging in, 2FA codes,
 * government forms, bank onboarding) is never penalized.
 *
 * TIERS:
 * - Tier 1 sectors (banking, insurance, healthcare, tax, ...) legitimately
 *   collect SSN / government IDs. Any other sector asking for an SSN is a
 *   red flag, even if the site is otherwise safe.
 * - Tier 2+ data (email, phone, address, name) is needed by nearly every
 *   legitimate service, so sector rarely matters for it.
 *
 * SIGNAL STRENGTH:
 * - GOVERNMENT_TLDS / CURATED_DOMAINS are STRONG signals (verified or
 *   structurally safe) -> they may exempt PII entry on any non-blacklisted site.
 * - SECTOR_KEYWORDS are WEAK signals (any domain can contain the word
 *   "insurance") -> they may only exempt entry on safe sites (WSS >= 70),
 *   so a sketchy site posing as an insurer is never exempted by its facade.
 * - The blacklist flag (reputation = 0) ALWAYS overrides every exemption.
 * =============================================================================
 */

export type Sector =
    | 'government'
    | 'banking'
    | 'insurance'
    | 'healthcare'
    | 'tax'
    | 'mortgage'
    | 'investing'
    | 'lending'
    | 'hr'
    | 'education'
    | 'telecom'
    | 'fintech'
    | 'gambling'
    | 'screening';

/**
 * Sectors that legitimately need SSN / government IDs (Tier 1 data).
 * Entering an SSN on any OTHER sector (or an unknown site) is treated as an
 * unnecessary data ask and is penalized even on otherwise-safe sites.
 */
export const TIER1_SECTORS: ReadonlySet<Sector> = new Set<Sector>([
    'government',
    'banking',
    'insurance',
    'healthcare',
    'tax',
    'mortgage',
    'investing',
    'lending',
    'hr',
    'education',
    'telecom',
    'fintech',
    'gambling',
    'screening',
]);

/**
 * Government (and education) top-level domains. These are structurally hard to
 * fake and legally require sensitive data, so PII entry is never penalized.
 * .edu is included because universities legitimately collect SSNs for
 * financial aid.
 */
export const GOVERNMENT_TLDS: readonly string[] = [
    '.gov',      // United States
    '.gov.uk',   // United Kingdom
    '.gouv.fr',  // France
    '.gob.mx',   // Mexico
    '.gob.es',   // Spain
    '.gov.au',   // Australia
    '.gov.cn',   // China
    '.gov.hk',   // Hong Kong
    '.gov.in',   // India
    '.gov.br',   // Brazil
    '.gov.it',   // Italy
    '.govt.nz',  // New Zealand
    '.go.jp',    // Japan
    '.go.kr',    // South Korea
    '.go.th',    // Thailand
    '.mil',      // US military
    '.edu',      // Education (financial aid)
];

/**
 * Verified, well-known consumer platforms that millions of people log into.
 * A STRONG signal: expected-use entry (login, 2FA, checkout) on these domains
 * is never penalized, because the data goes to the real company. This is how
 * we "know the code goes to the right place" - we verified the domain.
 *
 * This list is intentionally a starting point - it should grow over time.
 */
export const TRUSTED_DOMAINS: string[] = [
    'linkedin.com', 'google.com', 'gmail.com', 'youtube.com', 'android.com',
    'amazon.com', 'amazon.co.uk', 'apple.com', 'icloud.com',
    'microsoft.com', 'outlook.com', 'live.com', 'office.com', 'windows.com',
    'facebook.com', 'instagram.com', 'whatsapp.com', 'messenger.com',
    'x.com', 'twitter.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
    'reddit.com', 'discord.com', 'slack.com', 'teams.microsoft.com',
    'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
    'netflix.com', 'spotify.com', 'hulu.com', 'disneyplus.com', 'hbomax.com',
    'twitch.tv', 'ebay.com', 'etsy.com', 'shopify.com', 'walmart.com',
    'target.com', 'bestbuy.com', 'costco.com', 'homedepot.com', 'ikea.com',
    'uber.com', 'lyft.com', 'airbnb.com', 'booking.com', 'expedia.com',
    'tripadvisor.com', 'doordash.com', 'grubhub.com', 'instacart.com',
    'dropbox.com', 'box.com', 'zoom.us', 'webex.com', 'mega.nz',
    'yahoo.com', 'aol.com', 'proton.me', 'protonmail.com', 'protonvpn.com',
    'wordpress.com', 'medium.com', 'substack.com', 'notion.so', 'figma.com',
    'duolingo.com', 'steam.com', 'steampowered.com', 'epicgames.com',
    'roblox.com', 'sony.com', 'nintendo.com', 'ea.com', 'ubisoft.com',
    'wikipedia.org', 'quora.com', 'tumblr.com', 'flickr.com',
    'nike.com', 'adidas.com', 'zalando.com', 'zalando.de', 'asos.com',
    'sephora.com', 'ulta.com', 'samsclub.com', 'lowes.com', 'wayfair.com',
    'kayak.com', 'hotels.com', 'priceline.com', 'southwest.com',
    'delta.com', 'united.com', 'aa.com', 'emirates.com', 'qantas.com',
    'ikea.com', 'tesla.com', 'bmw.com', 'mercedes-benz.com', 'toyota.com',
    'adobe.com', 'canva.com', 'docusign.com', 'hellosign.com',
    'square.com', 'godaddy.com', 'namecheap.com', 'cloudflare.com',
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
    'paylocity.com', 'ultipro.com', 'okta.com', 'auth0.com', 'duosecurity.com',
    'nytimes.com', 'wsj.com', 'cnn.com', 'bbc.co.uk', 'theguardian.com',
    'spotify.com', 'pandora.com', 'soundcloud.com', 'audible.com',
];

/** True if the domain (or a subdomain) is on the verified trusted list. */
export function isTrustedDomain(domain: string): boolean {
    const host = normalizeHost(domain);
    return TRUSTED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
}

/**
 * Verified, well-known domains per sector. STRONG signal: a curated match may
 * exempt expected PII entry on any non-blacklisted site, regardless of WSS.
 *
 * This list is intentionally a starting point - it should grow over time.
 * Order matters: the first matching sector wins.
 */
export const CURATED_DOMAINS: Record<Exclude<Sector, 'government'>, string[]> = {
    banking: [
        'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
        'capitalone.com', 'usbank.com', 'pnc.com', 'td.com', 'hsbc.com',
        'barclays.com', 'natwest.com', 'lloydsbank.co.uk', 'santander.com',
        'ally.com', 'discover.com', 'americanexpress.com', 'amex.com',
        'navyfederal.org', 'citi.com', 'bofa.com', 'usaa.com',
    ],
    insurance: [
        'statefarm.com', 'geico.com', 'progressive.com', 'allstate.com',
        'farmers.com', 'libertymutual.com', 'nationwide.com', 'travelers.com',
        'aetna.com', 'cigna.com', 'unitedhealthcare.com', 'humana.com',
        'bluecross.com', 'anthem.com', 'metlife.com', 'prudential.com',
        'aflac.com', 'thehartford.com', 'esurance.com', 'root.com',
    ],
    healthcare: [
        'mayoclinic.org', 'clevelandclinic.org', 'hopkinsmedicine.org',
        'kaiserpermanente.org', 'cvs.com', 'walgreens.com', 'riteaid.com',
        'teladoc.com', 'onemedical.com', 'mdlive.com', 'bannerhealth.com',
        'providence.org',
    ],
    tax: [
        'turbotax.com', 'hrblock.com', 'taxact.com', 'freetaxusa.com',
        'jacksonhewitt.com', 'efile.com', 'intuit.com',
    ],
    mortgage: [
        'rocketmortgage.com', 'quickenloans.com', 'loandepot.com', 'better.com',
        'pennymac.com', 'mrcooper.com', 'newrez.com', 'freedommortgage.com',
        'guaranteedrate.com',
    ],
    investing: [
        'fidelity.com', 'vanguard.com', 'schwab.com', 'etrade.com',
        'robinhood.com', 'merrill.com', 'tdameritrade.com', 'ibkr.com',
        'webull.com', 'wealthfront.com', 'betterment.com', 'm1finance.com',
    ],
    lending: [
        'sofi.com', 'lendingclub.com', 'prosper.com', 'lightstream.com',
        'upgrade.com', 'affirm.com', 'klarna.com', 'afterpay.com',
        'onemainfinancial.com', 'creditkarma.com', 'experian.com',
        'equifax.com', 'transunion.com',
    ],
    hr: [
        'adp.com', 'workday.com', 'bamboohr.com', 'paychex.com',
        'gusto.com', 'ukg.com', 'greenhouse.io', 'lever.co', 'rippling.com',
        'zenefits.com',
    ],
    education: [
        'salliemae.com', 'nelnet.com', 'navient.com', 'commonapp.org',
        'edfinancial.com', 'greatlakes.org',
    ],
    telecom: [
        'verizon.com', 'att.com', 't-mobile.com', 'spectrum.com',
        'xfinity.com', 'comcast.com', 'centurylink.com', 'frontier.com',
        'vodafone.com', 'ee.co.uk', 'o2.co.uk', 'orange.com', 'kpn.com',
    ],
    fintech: [
        'coinbase.com', 'kraken.com', 'binance.com', 'gemini.com',
        'bitstamp.net', 'crypto.com', 'paypal.com', 'venmo.com', 'cashapp.com',
        'wise.com', 'revolut.com', 'chime.com', 'stripe.com', 'squareup.com',
        'blockfi.com', 'nexo.com', 'ledger.com', 'trezor.io',
    ],
    gambling: [
        'bet365.com', 'draftkings.com', 'fanduel.com', 'betmgm.com',
        'williamhill.com', 'paddypower.com', 'unibet.com', 'betfair.com',
        'pokerstars.com', '888.com', 'caesars.com', 'wynnbet.com',
    ],
    screening: [
        'checkr.com', 'hireright.com', 'sterlingcheck.com',
        'backgroundchecks.com', 'goodhire.com',
    ],
};

/**
 * Weak keyword signals per sector, matched with substring matching against
 * the second-level domain name (e.g. "insureme" matches "insureme.com" and
 * "myinsurancesite.com" matches "insurance"). Only exempts PII entry on
 * safe sites (WSS >= 70), so a sketchy site that merely *looks* like an
 * insurer is never exempted by its facade. Substring matching is fine here
 * because the keywords are distinctive enough that mid-word matches (e.g.
 * "tax" in "taxi") are harmless: the exemption only matters for SSN-grade
 * data on already-safe sites, and the blacklist flag overrides everything.
 */
export const SECTOR_KEYWORDS: Record<Exclude<Sector, 'government'>, string[]> = {
    banking: ['bank', 'banking', 'creditunion', 'checking', 'savings'],
    insurance: ['insurance', 'insure', 'underwriting', 'claims'],
    healthcare: ['health', 'clinic', 'hospital', 'medical', 'pharmacy', 'dental', 'doctor', 'physician', 'telehealth'],
    tax: ['tax', 'taxes', 'accounting', 'accountant', 'cpa', 'bookkeeping'],
    mortgage: ['mortgage', 'title', 'refinance', 'realtor', 'realestate', 'homeloan'],
    investing: ['invest', 'investing', 'broker', 'brokerage', 'retirement', 'trading', 'securities', 'wealth', '401k'],
    lending: ['loan', 'lending', 'financing', 'payday', 'credit'],
    hr: ['job', 'jobs', 'careers', 'recruit', 'recruiting', 'payroll', 'hiring', 'talent', 'benefits'],
    education: ['university', 'college', 'school', 'student', 'tuition', 'campus', 'financialaid', 'fafsa'],
    telecom: ['telecom', 'wireless', 'broadband', 'fiber', 'mobile', 'cellular'],
    fintech: ['crypto', 'bitcoin', 'blockchain', 'exchange', 'wallet', 'coin', 'pay'],
    gambling: ['casino', 'betting', 'sportsbook', 'lottery', 'poker', 'bet', 'gambling'],
    screening: ['backgroundcheck', 'tenant', 'screening'],
};

export interface SiteSectorResult {
    sector: Sector;
    /** 'curated' = verified domain (strong signal), 'keyword' = weak signal. */
    source: 'curated' | 'keyword';
}

/** Normalizes a hostname for matching: lowercase, no protocol/path/port. */
export function normalizeHost(domain: string): string {
    return domain
        .toLowerCase()
        .replace(/^[a-z]+:\/\//, '')
        .split(/[/?#]/)[0]
        .replace(/^www\./, '');
}

/** True if the domain ends with a government/education TLD. */
export function isGovernmentDomain(domain: string): boolean {
    const host = normalizeHost(domain);
    return GOVERNMENT_TLDS.some(tld => host === tld.slice(1) || host.endsWith(tld));
}

/**
 * Detects a site's sector using the curated list first (strong signal), then
 * keyword heuristics on the second-level domain name (weak signal).
 */
export function getSiteSector(domain: string): SiteSectorResult | null {
    const host = normalizeHost(domain);
    const name = host.split('.').slice(-2, -1)[0] || host;

    for (const [sector, domains] of Object.entries(CURATED_DOMAINS) as [Exclude<Sector, 'government'>, string[]][]) {
        if (domains.some(d => host === d || host.endsWith('.' + d))) {
            return { sector, source: 'curated' };
        }
    }

    for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS) as [Exclude<Sector, 'government'>, string[]][]) {
        if (keywords.some(keyword => name.includes(keyword))) {
            return { sector, source: 'keyword' };
        }
    }

    return null;
}

/**
 * Data types that only Tier 1 sectors legitimately collect.
 * Entering these on any other site is an "unnecessary data ask".
 */
export const HIGH_TIER_FIELDS: ReadonlySet<string> = new Set(['ssn']);

/** True if this field type is one only Tier 1 sectors should collect. */
export function isHighTierField(fieldType: string): boolean {
    return HIGH_TIER_FIELDS.has(normalizeFieldType(fieldType));
}

/** Normalizes detector display strings ("credit card") to canonical keys. */
export function normalizeFieldType(fieldType: string): string {
    return fieldType.toLowerCase().replace(/\s+/g, '');
}

/** True if the field is a one-time security code (2FA / OTP). */
export function isSecurityCodeField(fieldType: string): boolean {
    const normalized = normalizeFieldType(fieldType);
    return normalized === 'securitycode' || normalized === 'otp' || normalized === 'verificationcode';
}

/** True if the sector legitimately needs this data type. */
export function sectorNeedsField(sector: Sector, fieldType: string): boolean {
    // Tier 1 data: only Tier 1 sectors need it.
    if (isHighTierField(fieldType)) return TIER1_SECTORS.has(sector);
    // Everything else (email, phone, address, name, password, card) is
    // needed by virtually every legitimate service.
    return true;
}
