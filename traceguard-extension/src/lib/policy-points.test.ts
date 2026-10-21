import { describe, expect, it } from 'vitest'
import { filterPolicyPoints, normalizePolicyPointClassification } from './policy-points'

describe('policy point filters', () => {
    const points = [
        { title: 'No redress', classification: 'blocker' },
        { title: 'Shares data', classification: 'bad' },
        { title: 'Unclear retention', classification: 'neutral' },
        { title: 'Offers deletion', classification: 'good' },
        { title: 'Legacy rating', classification: ' BAD ' },
        { title: 'Unknown rating', classification: 'mixed' },
    ]

    it('filters every supported class and all points', () => {
        expect(filterPolicyPoints(points, 'blocker').map(point => point.title)).toEqual(['No redress'])
        expect(filterPolicyPoints(points, 'bad').map(point => point.title)).toEqual(['Shares data', 'Legacy rating'])
        expect(filterPolicyPoints(points, 'neutral').map(point => point.title)).toEqual(['Unclear retention'])
        expect(filterPolicyPoints(points, 'good').map(point => point.title)).toEqual(['Offers deletion'])
        expect(filterPolicyPoints(points, 'all')).toEqual(points)
    })

    it('rejects unknown classifications instead of matching them to a visible filter', () => {
        expect(normalizePolicyPointClassification(' mixed ')).toBeNull()
        expect(normalizePolicyPointClassification(undefined)).toBeNull()
        expect(filterPolicyPoints(points, 'bad')).not.toContain(points[5])
    })
})
