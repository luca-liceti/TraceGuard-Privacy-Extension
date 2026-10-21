/**
 * The closed case list a local policy report may use.
 *
 * This follows the shape Docbot uses for ToS;DR (see CREDITS.md): a fixed set of
 * statements, evidence selected per statement, and a grade derived from the
 * selected statements rather than written by a model. The statements here are
 * our own wording, written for this project, not copied from ToS;DR's Cases.
 *
 * Keeping the list closed is what makes the output comparable between sites and
 * testable. A model that can only choose from these ids cannot invent a new
 * category of finding.
 */

export type CaseClassification = 'good' | 'bad' | 'blocker' | 'neutral';

export interface PolicyCase {
    id: string;
    /** Statement the evidence must support, in plain language. */
    title: string;
    /** Grouping used by the panel, mirroring the idea of ToS;DR topics. */
    topic: string;
    classification: CaseClassification;
}

export const POLICY_CASES: readonly PolicyCase[] = [
    // Data collection
    {
        id: 'sensitive-data',
        title: 'Sensitive categories of personal data are collected',
        topic: 'Data collection',
        classification: 'bad',
    },
    {
        id: 'cross-site-tracking',
        title: 'You are tracked across other websites',
        topic: 'Data collection',
        classification: 'bad',
    },
    {
        id: 'ads-profiling',
        title: 'Your data is used to target advertising',
        topic: 'Data collection',
        classification: 'bad',
    },
    {
        id: 'no-ai-training',
        title: 'Your content is not used to train AI models',
        topic: 'Data collection',
        classification: 'good',
    },

    // Data sharing
    {
        id: 'data-sold',
        title: 'Your personal data is sold',
        topic: 'Data sharing',
        classification: 'blocker',
    },
    {
        id: 'data-shared',
        title: 'Your personal data is shared with third parties',
        topic: 'Data sharing',
        classification: 'bad',
    },
    {
        id: 'third-parties-named',
        title: 'The third parties receiving your data are named',
        topic: 'Data sharing',
        classification: 'good',
    },
    {
        id: 'government-requests',
        title: 'Requests for your data from authorities are disclosed',
        topic: 'Data sharing',
        classification: 'good',
    },

    // Retention and security
    {
        id: 'indefinite-retention',
        title: 'Your data is kept for an unspecified period',
        topic: 'Retention',
        classification: 'bad',
    },
    {
        id: 'retention-stated',
        title: 'Retention periods are stated',
        topic: 'Retention',
        classification: 'good',
    },
    {
        id: 'breach-notice',
        title: 'You are told when a breach affects your data',
        topic: 'Retention',
        classification: 'good',
    },

    // Your rights
    {
        id: 'deletion-right',
        title: 'You can delete your account and your data',
        topic: 'Your rights',
        classification: 'good',
    },
    {
        id: 'access-right',
        title: 'You can access and export your data',
        topic: 'Your rights',
        classification: 'good',
    },
    {
        id: 'arbitration-waiver',
        title: 'You waive the right to a class action or trial',
        topic: 'Your rights',
        classification: 'bad',
    },
    {
        id: 'consent-choice',
        title: 'You can refuse tracking without losing the service',
        topic: 'Your rights',
        classification: 'good',
    },

    // Transparency
    {
        id: 'silent-policy-changes',
        title: 'The policy can change without notice',
        topic: 'Transparency',
        classification: 'bad',
    },
    {
        id: 'plain-language',
        title: 'The policy is written in plain language',
        topic: 'Transparency',
        classification: 'good',
    },
] as const;

const CASE_BY_ID = new Map(POLICY_CASES.map(item => [item.id, item]));

/** Look up a case by id, or undefined when the model invented one. */
export function findCase(id: string): PolicyCase | undefined {
    return CASE_BY_ID.get(id);
}

/** How much a selected case moves the score away from the neutral 50. */
const CASE_WEIGHT: Record<CaseClassification, number> = {
    good: 8,
    bad: -10,
    blocker: -20,
    neutral: 0,
};

/**
 * Derive a 0-100 score from the selected cases.
 *
 * This is a heuristic, not ToS;DR's formula: start at the neutral 50 and move by
 * each case's weight. It is deterministic, so the same cases always produce the
 * same grade, and the grade can be explained line by line in the panel.
 */
export function scoreFromCases(points: readonly { classification: CaseClassification }[]): number {
    const raw = 50 + points.reduce((total, point) => total + CASE_WEIGHT[point.classification], 0);
    return Math.max(0, Math.min(100, raw));
}

/** Same thresholds the ToS;DR grade mapping uses, in reverse. */
export function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'E';
}
