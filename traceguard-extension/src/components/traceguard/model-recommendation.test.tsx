import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HardwareProfile } from '@/lib/ai/hardware';
import '@/lib/i18n';

const mocks = vi.hoisted(() => ({
    detect: vi.fn(),
    writeText: vi.fn(),
}));

vi.mock('@/lib/ai/hardware', async () => {
    const actual = await vi.importActual<typeof import('@/lib/ai/hardware')>('@/lib/ai/hardware');
    return { ...actual, detectHardware: mocks.detect };
});

import { ModelRecommendation } from './model-recommendation';

const profile: HardwareProfile = {
    gpu: 'NVIDIA GeForce RTX 4070',
    kind: 'discrete',
    vramGb: 12,
    tier: 'better',
    model: 'gemma4:12b',
    sizeGb: '8.0 GB',
    note: 'Handles all three jobs with more headroom for long policies than the 9B model.',
};

beforeEach(() => {
    mocks.detect.mockReset();
    mocks.writeText.mockReset();
    mocks.detect.mockResolvedValue(profile);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mocks.writeText },
        configurable: true,
    });
});

describe('ModelRecommendation', () => {
    it('shows the detected card and the model it can run', async () => {
        render(<ModelRecommendation installedModels={[]} selectedModel="qwen3.5:0.8b" onSelect={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('gemma4:12b · 8.0 GB download')).toBeInTheDocument());
        expect(screen.getByText('Detected: NVIDIA GeForce RTX 4070 (about 12 GB)')).toBeInTheDocument();
        expect(screen.getByText(profile.note)).toBeInTheDocument();
    });

    it('copies the pull command instead of trying to install anything', async () => {
        mocks.writeText.mockResolvedValue(undefined);
        render(<ModelRecommendation installedModels={[]} selectedModel="qwen3.5:0.8b" onSelect={vi.fn()} />);

        await waitFor(() => expect(screen.getByText('ollama pull gemma4:12b')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));

        await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith('ollama pull gemma4:12b'));
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    it('offers the recommended model once it is installed', async () => {
        const onSelect = vi.fn();
        render(<ModelRecommendation installedModels={['gemma4:12b', 'qwen3.5:0.8b']} selectedModel="qwen3.5:0.8b" onSelect={onSelect} />);

        const select = await screen.findByRole('button', { name: 'Use this model' });
        fireEvent.click(select);
        expect(onSelect).toHaveBeenCalledWith('gemma4:12b');
    });

    it('does not offer a select action for the model already in use', async () => {
        render(<ModelRecommendation installedModels={['gemma4:12b']} selectedModel="gemma4:12b" onSelect={vi.fn()} />);

        expect(await screen.findByText('Currently selected')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Use this model' })).not.toBeInTheDocument();
    });
});
