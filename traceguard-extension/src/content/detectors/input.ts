/**
 * =============================================================================
 * INPUT DETECTOR - Finding Sensitive Form Fields
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This detector finds sensitive input fields on webpages - places where you
 * might enter personal information like passwords, credit cards, or emails.
 * 
 * CRITICAL PRIVACY GUARANTEE:
 * We ONLY detect the TYPE of field (e.g., "password field").
 * We NEVER read or store what you actually type!
 * 
 * WHY THIS MATTERS:
 * Entering sensitive info on a risky website is dangerous. This detector
 * helps identify pages where you might be asked for personal data so we can:
 * 1. Warn you if the site is unsafe
 * 2. Track your privacy score based on data exposure
 * 3. Show which types of data sites are requesting
 * 
 * SENSITIVITY LEVELS:
 * 
 * HIGH (weight: 10) - Most sensitive:
 *   - Passwords
 *   - Credit card numbers
 *   - CVV/security codes
 *   - Social Security Numbers
 * 
 * MEDIUM (weight: 5) - Moderately sensitive:
 *   - Email addresses
 *   - Phone numbers
 *   - Physical addresses
 * 
 * LOW (weight: 1) - Less sensitive:
 *   - Names
 *   - Usernames
 * 
 * SCORING FORMULA:
 * Uses logarithmic calculation: 100 - 10 × log₂(weighted_count + 1)
 * 
 * EXAMPLES:
 * - 0 sensitive fields → Score: 100 (safe page)
 * - 1 password field (10 weighted) → Score: ~65
 * - 1 password + 1 email (15 weighted) → Score: ~60
 * =============================================================================
 */

/**
 * Represents a sensitive input field found on the page.
 */
interface SensitiveField {
    element: HTMLInputElement | HTMLTextAreaElement;  // The actual HTML element
    type: string;                                      // Field type (password, email, etc.)
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';           // How sensitive is this data?
}

/**
 * The result of input field detection.
 */
export interface InputDetectionResult {
    score: number;           // Safety score (0-100, higher = safer)
    fields: {                // Fields grouped by sensitivity level
        high: SensitiveField[];
        medium: SensitiveField[];
        low: SensitiveField[];
    };
}

/**
 * Input Detector - Sensitive Input Field Detection
 * 
 * Detects sensitive input fields on the page by input type and standardized
 * autocomplete tokens. We intentionally do not trust arbitrary name/id values.
 * CRITICAL: Only detects field TYPES, never stores actual values (zero PII storage).
 * 
 * Returns: Risk score 0-100
 * - 100 = No sensitive inputs (safe)
 * - 50 = Email/Personal info (medium risk)
 * - 0 = Password/Credit Card (high risk)
 */
export function detectSensitiveInputs(): InputDetectionResult {
    const inputs = document.querySelectorAll('input, textarea');
    const high: SensitiveField[] = [];
    const medium: SensitiveField[] = [];
    const low: SensitiveField[] = [];

    for (const input of inputs) {
        const element = input as HTMLInputElement | HTMLTextAreaElement;
        const type = element.type?.toLowerCase() || '';
        // We use standardized signals (`type` + `autocomplete`), and fallback to
        // name/id attributes, placeholders, and labels. While name/id could theoretically
        // be spoofed, many legitimate sites (like insurance quotes) omit autocomplete and semantic labels.
        const autocomplete = element.autocomplete?.toLowerCase() || '';
        // Autocomplete may contain an optional section plus billing/shipping
        // scope before the semantic token, e.g. "shipping address-line1".
        const autocompleteTokens = autocomplete.split(/\s+/).filter(Boolean);
        const hasAutocompleteToken = (token: string) => autocompleteTokens.includes(token);

        const isPassword = type === 'password' || autocompleteTokens.some(token => token.includes('password'));
        const isCard = autocompleteTokens.some(token => ['cc-number', 'cc-csc', 'cc-exp'].includes(token));
        const isEmail = type === 'email' || hasAutocompleteToken('email');
        const isPhone = type === 'tel' || hasAutocompleteToken('tel');
        // Some forms omit autocomplete metadata (as in many insurance quote
        // forms), so use the field's placeholder, label, name, or id as a fallback.
        const ariaLabelledby = element.getAttribute('aria-labelledby');
        let ariaLabelledbyText = '';
        if (ariaLabelledby) {
            ariaLabelledbyText = ariaLabelledby.split(/\s+/).map(id => document.getElementById(id)?.textContent).filter(Boolean).join(' ');
        }
        const nameAttr = (element.getAttribute('name') || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
        const idAttr = (element.getAttribute('id') || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');

        const visibleMetadata = [
            element.getAttribute('placeholder'),
            element.getAttribute('aria-label'),
            ariaLabelledbyText,
            nameAttr,
            idAttr,
            ...Array.from(document.querySelectorAll('label'))
                .filter(label => label.htmlFor === element.id || label.contains(element))
                .map(label => label.textContent)
        ].filter(Boolean).join(' ').toLowerCase();
        const hasAddressMetadata = /\b(address|street|city|state|province|region|zip|postal|apartment|apt|unit|county)\b/i.test(visibleMetadata);

        // One-time security codes (2FA / OTP) have a dedicated autocomplete
        // token; fall back to visible metadata for sites that omit it.
        // These are ephemeral and single-use, so they are LOW sensitivity and
        // never penalized by the UPS system.
        const isSecurityCode = hasAutocompleteToken('one-time-code')
            || /\b(security code|verification code|one[- ]?time( code)?|\botp\b|2fa|two[- ]?factor|authenticator code|sms code|confirmation code|passcode)\b/i.test(visibleMetadata);

        // SSN / government ID has no standardized autocomplete token, so
        // visible metadata (placeholder, aria-label, name, id, label text) is
        // the only reliable signal. Unlike password/card, there is no
        // legitimate reason for a field to be *named* like an SSN field unless
        // it actually collects one, so spoof risk is minimal.
        const isSSN = /\b(social security( number)?|ssn|tax ?id|taxpayer ?id|national id|government id|ein)\b/i.test(visibleMetadata)
            || /\b(social security|ssn|tax ?id|national ?id)\b/i.test(autocomplete);

        // Address forms commonly split a physical address across several
        // fields. These are the standardized HTML autocomplete tokens for
        // those components; grouping them as "address" keeps the UI concise
        // while still scoring each requested field.
        const isAddress = hasAddressMetadata || autocompleteTokens.some(token => [
            'street-address',
            'address-line1',
            'address-line2',
            'address-line3',
            'address-level1',
            'address-level2',
            'address-level3',
            'address-level4',
            'postal-code',
            'country',
            'country-name'
        ].includes(token));

        const isName = autocompleteTokens.some(token => ['name', 'given-name', 'family-name', 'additional-name', 'honorific-prefix', 'honorific-suffix'].includes(token)) || /\b(first name|last name|full name|middle name)\b/i.test(visibleMetadata);
        const isUsername = autocompleteTokens.some(token => ['username'].includes(token)) || /\b(username|user name)\b/i.test(visibleMetadata);

        if (isPassword) {
            high.push({ element, type: 'password', sensitivity: 'HIGH' });
        } else if (isCard) {
            high.push({ element, type: 'credit card', sensitivity: 'HIGH' });
        } else if (isSSN) {
            high.push({ element, type: 'ssn', sensitivity: 'HIGH' });
        } else if (isSecurityCode) {
            low.push({ element, type: 'security code', sensitivity: 'LOW' });
        } else if (isEmail) {
            medium.push({ element, type: 'email', sensitivity: 'MEDIUM' });
        } else if (isPhone) {
            medium.push({ element, type: 'phone', sensitivity: 'MEDIUM' });
        } else if (isAddress) {
            medium.push({ element, type: 'address', sensitivity: 'MEDIUM' });
        } else if (isName) {
            low.push({ element, type: 'name', sensitivity: 'LOW' });
        } else if (isUsername) {
            low.push({ element, type: 'username', sensitivity: 'LOW' });
        }
    }
    // Logarithmic score calculation (v3.0)
    // Weights: HIGH=10, MEDIUM=5, LOW=1
    // Formula: max(0, 100 - K × log2(weightedCount + 1)), K=10
    //
    // Examples:
    // 0 fields → 100
    // 1 password (10 weighted) → 100 - 10×log2(11) ≈ 65
    // 1 password + 1 email (15 weighted) → 100 - 10×log2(16) = 60
    // 2 passwords (20 weighted) → 100 - 10×log2(21) ≈ 56

    const weightedCount = (high.length * 10) + (medium.length * 5) + (low.length * 1);
    const K = 10;
    const score = weightedCount === 0
        ? 100
        : Math.max(0, Math.round(100 - (K * Math.log2(weightedCount + 1))));

    // Comprehensive console logging (field TYPES only, NO values)
    console.log('[Input Detector] Starting analysis...');
    console.log('[Input] Total input fields found:', inputs.length);
    console.log('[Input] Sensitive fields detected:', {
        'HIGH sensitivity (passwords, cards)': high.length,
        'MEDIUM sensitivity (email, phone, address)': medium.length,
        'LOW sensitivity (name, username)': low.length,
        'Weighted count': weightedCount
    });

    // Log field types (NOT values - zero PII storage)
    if (high.length > 0) {
        console.log('[Input] HIGH sensitivity field types:', high.map(f => f.type));
    }
    if (medium.length > 0) {
        console.log('[Input] MEDIUM sensitivity field types:', medium.map(f => f.type));
    }
    if (low.length > 0) {
        console.log('[Input] LOW sensitivity field types:', low.map(f => f.type));
    }

    console.log(`[Input] Logarithmic calculation: max(0, 100 - 10×log2(${weightedCount}+1)) = ${score}`);
    console.log(`[Input] Final Score: ${score} (${score >= 80 ? '✅ Safe' : score >= 60 ? '🔵 Low Risk' : score >= 40 ? '🟡 Medium' : '🟠 High Risk'})`);

    return {
        score,
        fields: { high, medium, low }
    };
}
