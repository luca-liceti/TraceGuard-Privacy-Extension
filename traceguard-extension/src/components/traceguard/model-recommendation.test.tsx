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
        render(<ModelRecommendation installedModels={[]} />);

        await waitFor(() => expect(screen.getByText('gemma4:12b')).toBeInTheDocument());
        expect(screen.getByText('8.0 GB download')).toBeInTheDocument();
        expect(screen.getByText('Detected: NVIDIA GeForce RTX 4070 (about 12 GB)')).toBeInTheDocument();
        expect(screen.getByText(profile.note)).toBeInTheDocument();
    });

    it('copies the pull command instead of trying to install anything', async () => {
        mocks.writeText.mockResolvedValue(undefined);
        render(<ModelRecommendation installedModels={[]} />);

        await waitFor(() => expect(screen.getByText('ollama pull gemma4:12b')).toBeInTheDocument());
        const copyButton = screen.getByRole('button', { name: 'Copy install command' });
        expect(copyButton).toHaveTextContent('');
        fireEvent.click(copyButton);

        await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith('ollama pull gemma4:12b'));
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    it('shows when the recommended model is installed for selection in the picker', async () => {
        render(<ModelRecommendation installedModels={['gemma4:12b']} />);

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Installed in Ollama. Select it in the model list.'));
        expect(screen.queryByRole('button', { name: 'Use this model' })).not.toBeInTheDocument();
    });
});
