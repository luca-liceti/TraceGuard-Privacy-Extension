export type PolicyPointClassification = 'blocker' | 'bad' | 'neutral' | 'good'
export type PolicyPointFilter = 'all' | PolicyPointClassification

export interface PolicyPointLike {
    title?: string
    classification?: unknown
}

const CLASSIFICATIONS = new Set<PolicyPointClassification>(['blocker', 'bad', 'neutral', 'good'])

export function normalizePolicyPointClassification(value: unknown): PolicyPointClassification | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim().toLowerCase()
    return CLASSIFICATIONS.has(normalized as PolicyPointClassification)
        ? normalized as PolicyPointClassification
        : null
}

export function filterPolicyPoints<T extends PolicyPointLike>(
    points: readonly T[],
    filter: PolicyPointFilter,
): T[] {
    if (filter === 'all') return [...points]
    return points.filter((point) => normalizePolicyPointClassification(point.classification) === filter)
}
