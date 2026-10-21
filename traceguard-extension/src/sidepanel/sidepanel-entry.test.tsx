/**
 * Regression test: the side panel entry script must mount the app into #root
 * without throwing. The entry runs on import, so the test supplies the root
 * element the panel HTML normally provides, then waits for React to render.
 */
import { act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let unmount: (() => void) | undefined;

describe('side panel entry', () => {
    beforeEach(async () => {
        vi.resetModules();
        document.body.innerHTML = '<div id="root"></div>';
        // A vault exists and is unlocked, so the panel renders instead of
        // showing the "open the dashboard to create your vault" placeholder.
        await chrome.storage.local.set({
            cryptoSalt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            validator: 'validator',
        });
        await chrome.storage.session.set({ cryptoKeyHex: 'deadbeef' });
    });

    afterEach(() => {
        // The entry owns its root. Unmount before the environment is torn down,
        // or a pending storage promise schedules React work with no window.
        unmount?.();
        unmount = undefined;
        document.body.innerHTML = '';
    });

    it('mounts the app into the root element', async () => {
        const entry = await import('./main');
        unmount = () => act(() => entry.root?.unmount());
        await waitFor(() => {
            expect(document.getElementById('root')!.childElementCount).toBeGreaterThan(0);
        });
    });
});
