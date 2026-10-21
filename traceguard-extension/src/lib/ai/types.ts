/** A single verified fact supplied to the local summarizer. */
export interface SummaryFact {
    label: string;
    value: string;
}

/** Bounded input: the model may only restate these facts. */
export interface SummaryRequest {
    subject: 'site' | 'log';
    subjectName: string;
    facts: SummaryFact[];
}

export interface SummaryResult {
    text: string;
    model: string;
    generatedAt: number;
}

export type FactViolation =
    | { kind: 'number'; token: string }
    | { kind: 'domain'; token: string }
    | { kind: 'name'; token: string }
    | { kind: 'claim'; token: string }
    | { kind: 'empty'; token: string }
    | { kind: 'too-long'; token: string };

export type FactGuardResult =
    | { ok: true; text: string }
    | { ok: false; violations: FactViolation[] };
