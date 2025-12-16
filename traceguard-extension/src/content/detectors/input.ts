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

    // Score calculation
    // 100 = No sensitive inputs (Low Risk)
    // 50 = Email/Personal info (Medium Risk)
    // 0 = Password/Credit Card (High Risk)
    let score = 100;
    let riskLevel = 'none';

    if (high.length > 0) {
        score = 0;
        riskLevel = 'high';
    } else if (medium.length > 0) {
        score = 50;
        riskLevel = 'medium';
    }

    // Comprehensive console logging (field TYPES only, NO values)
    console.log('[Input Detector] Starting analysis...');
    console.log('[Input] Total input fields found:', inputs.length);
    console.log('[Input] Sensitive fields detected:', {
        'HIGH sensitivity (passwords, credit cards)': high.length,
        'MEDIUM sensitivity (email, phone, address)': medium.length,
        'LOW sensitivity (name, username)': low.length
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

    console.log('[Input] Risk assessment:', {
        riskLevel: riskLevel,
        formula: high.length > 0
            ? 'HIGH sensitivity fields present → 0 (high risk)'
            : medium.length > 0
                ? 'MEDIUM sensitivity fields present → 50 (medium risk)'
                : 'No sensitive fields → 100 (safe)',
        score: score
    });
    console.log('[Input] Final Score:', score);

    return {
        score,
        fields: { high, medium, low }
    };
}


