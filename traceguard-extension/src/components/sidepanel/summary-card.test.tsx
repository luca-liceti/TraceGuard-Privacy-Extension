import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SummaryRequest } from '@/lib/ai/types';
import i18n from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
    settings: { enableLocalSummaries: false, localSummaryModel: 'qwen3.5:0.8b' },
    summarize: vi.fn(),
}));

vi.mock('@/lib/useStorage', () => ({ useSettings: () => mocks.settings }));
vi.mock('@/lib/diagnostics', () => ({ logEvent: vi.fn() }));
vi.mock('@/lib/ai/ollama', () => ({ summarizeWithOllama: mocks.summarize }));

import { SummaryCard } from './summary-card';

const request: SummaryRequest = {
    subject: 'site',
    subjectName: 'example.com',
    facts: [{ label: 'Website Safety Score', value: '72 out of 100' }],
};

beforeEach(() => {
    mocks.settings.enableLocalSummaries = false;
    mocks.summarize.mockReset();
});

describe('SummaryCard', () => {
    it('is not rendered when the setting is off', () => {
        render(<SummaryCard request={request} />);
        expect(screen.queryByText('On-device summary')).not.toBeInTheDocument();
    });

    it('shows a checked summary after an explicit click when enabled', async () => {
        mocks.settings.enableLocalSummaries = true;
        mocks.summarize.mockResolvedValue({ text: 'The site has a score of 72 out of 100.', model: 'qwen3.5:0.8b', generatedAt: 1000 });
        render(<SummaryCard request={request} />);

        expect(screen.getByText('Uses stored findings and browsing patterns. Checks for invented details. Runs only through Ollama on this device. Form entries mean typing began, not that data was submitted.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Create summary' }));
        await waitFor(() => expect(screen.getByText('The site has a score of 72 out of 100.')).toBeInTheDocument());
        expect(mocks.summarize).toHaveBeenCalledWith(request, 'qwen3.5:0.8b');
        expect(screen.getByText(i18n.t('Model: {{model}} · {{time}}', { model: 'qwen3.5:0.8b', time: new Date(1000).toLocaleTimeString() }))).toBeInTheDocument();
    });

    it('shows the provider error and does not display failed output', async () => {
        mocks.settings.enableLocalSummaries = true;
        mocks.summarize.mockRejectedValue(new Error('The generated summary was discarded.'));
        render(<SummaryCard request={request} />);

        fireEvent.click(screen.getByRole('button', { name: 'Create summary' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('The generated summary was discarded.');
    });
});
