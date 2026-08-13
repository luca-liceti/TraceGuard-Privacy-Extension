import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const openMock = vi.fn();
Object.defineProperty(window, 'open', {
    value: openMock
});

function ProblemChild() {
    throw new Error('Test crash');
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div>Safe child</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Safe child')).toBeDefined();
    });

    it('renders the fallback UI on error', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeDefined();
        expect(screen.getByText('Test crash')).toBeDefined();
        
        consoleSpy.mockRestore();
    });

    it('opens GitHub issue URL on button click', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );

        const githubButton = screen.getByText('Report Issue on GitHub');
        fireEvent.click(githubButton);

        expect(openMock).toHaveBeenCalled();
        const url = openMock.mock.calls[0][0] as string;
        expect(url).toContain('github.com/luca-liceti/TraceGuard-Privacy-Extension/issues/new');
        expect(url).toContain('Test%20crash');

        consoleSpy.mockRestore();
    });
});
