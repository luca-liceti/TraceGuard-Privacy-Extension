/**
 * The privacy score is the headline number of the app, and it is drawn inside an
 * SVG. Without an accessible label a screen reader gets nothing from it, so the
 * chart container must expose the score as an image role with a label.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RadialChartScore } from './radial-chart-score';
import { getScoreColor } from '@/lib/risk-utils';

vi.mock('@/lib/useStorage', () => ({
    useAppState: () => ({ ups: 100 }),
    useScoreHistory: () => [{ timestamp: Date.now(), ups: 100 }],
    useActivityLogs: () => [],
}));

vi.mock('recharts', async (importOriginal) => {
    const React = await import('react');
    const actual = await importOriginal<typeof import('recharts')>();
    return {
        ...actual,
        Label: ({ content }: { content: (props: { viewBox: { cx: number; cy: number } }) => React.ReactNode }) => content({ viewBox: { cx: 100, cy: 100 } }),
        PolarAngleAxis: () => null,
        PolarGrid: () => null,
        PolarRadiusAxis: ({ children }: { children: React.ReactNode }) => React.createElement('g', null, children),
        RadialBar: () => null,
        RadialBarChart: ({ children }: { children: React.ReactNode }) => React.createElement('svg', null, children),
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    };
});

describe('privacy score ring', () => {
    it('exposes the score as a labelled image', () => {
        render(<RadialChartScore />);
        const chart = screen.getByRole('img');
        expect(chart.getAttribute('aria-label')).toMatch(/Privacy Score: \d+\/100/);
    });

    it('colors the SVG score text using the same score band as the side panel', async () => {
        render(<RadialChartScore />);
        const scoreText = await screen.findByText('100');

        expect(scoreText).toHaveClass('fill-current', getScoreColor(100));
    });
});
