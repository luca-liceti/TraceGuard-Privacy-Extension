import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { saveCachedPolicyReport } from './ai/policy-report-cache'
import type { PolicyReportResult } from './ai/policy-report'
import { useLocalPolicyGrades } from './useStorage'

const report: PolicyReportResult = {
    status: 'provisional',
    score: 16,
    grade: 'E',
    summary: '',
    evidence: [],
    points: [],
    model: 'qwen3.5:4b',
    promptVersion: 'policy-report-v4',
    generatedAt: 1_700_000_000_000,
}

describe('useLocalPolicyGrades', () => {
    it('lists the grades this device generated, and picks up a new report', async () => {
        await saveCachedPolicyReport('example.com', report)

        const { result } = renderHook(() => useLocalPolicyGrades())
        await waitFor(() => expect(result.current).toEqual({ 'example.com': 'E' }))

        // The dashboard stays open while a report finishes in the side panel.
        await act(async () => {
            await saveCachedPolicyReport('other.example', { ...report, grade: 'B' })
        })

        await waitFor(() =>
            expect(result.current).toEqual({ 'example.com': 'E', 'other.example': 'B' })
        )
    })
})
