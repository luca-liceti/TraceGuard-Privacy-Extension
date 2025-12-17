interface SensitiveField {
    element: HTMLInputElement | HTMLTextAreaElement;
    type: string;
    sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface InputDetectionResult {
    score: number;
    fields: {
        high: SensitiveField[];
        medium: SensitiveField[];
        low: SensitiveField[];
    };
}

/**
 * Input Detector - Sensitive Input Field Detection
 * 
 * Detects sensitive input fields on the page by type and name.
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
        const name = element.name?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';

        // HIGH sensitivity: password, credit card, SSN
        if (type === 'password' ||
            name.includes('password') ||
            name.includes('card') ||
            name.includes('cc') ||
            name.includes('cvv') ||
            name.includes('ssn') ||
            id.includes('card') ||
            id.includes('password')) {
            high.push({ element, type: type || 'text', sensitivity: 'HIGH' });
        }
        // MEDIUM sensitivity: email, phone, address
        else if (type === 'email' ||
            type === 'tel' ||
            name.includes('email') ||
            name.includes('phone') ||
            name.includes('tel') ||
            name.includes('address') ||
            id.includes('email') ||
            id.includes('phone')) {
            medium.push({ element, type: type || 'text', sensitivity: 'MEDIUM' });
        }
        // LOW sensitivity: name, username
        else if (name.includes('name') ||
            name.includes('user') ||
            id.includes('name') ||
            id.includes('user')) {
            low.push({ element, type: type || 'text', sensitivity: 'LOW' });
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
        'MEDIUM sensitivity (email, phone)': medium.length,
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
