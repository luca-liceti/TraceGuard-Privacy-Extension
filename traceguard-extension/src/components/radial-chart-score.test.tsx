/**
 * The privacy score is the headline number of the app, and it is drawn inside an
 * SVG. Without an accessible label a screen reader gets nothing from it, so the
 * chart container must expose the score as an image role with a label.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RadialChartScore } from './radial-chart-score';

describe('privacy score ring', () => {
    it('exposes the score as a labelled image', () => {
        render(<RadialChartScore />);
        const chart = screen.getByRole('img');
        expect(chart.getAttribute('aria-label')).toMatch(/Privacy Score: \d+\/100/);
    });
});
