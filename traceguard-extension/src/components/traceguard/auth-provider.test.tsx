import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from './auth-provider';

describe('AuthProvider auto-lock', () => {
    beforeEach(async () => {
        // Vault is already set up and unlocked.
        await chrome.storage.local.set({
            cryptoSalt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            validator: 'validator',
        });
        await chrome.storage.session.set({ cryptoKeyHex: 'deadbeef' });
    });

    it('re-locks the UI when the session key is removed (auto-lock)', async () => {
        render(
            <AuthProvider>
                <div>dashboard-content</div>
            </AuthProvider>
        );

        // Unlocked: children are rendered.
        await waitFor(() => expect(screen.getByText('dashboard-content')).toBeTruthy());

        // Simulate the background worker's auto-lock: it removes the key from
        // session storage. This must trigger a re-check and show the lock screen.
        await chrome.storage.session.remove('cryptoKeyHex');

        await waitFor(() => expect(screen.getByText('Vault Locked')).toBeTruthy());
    });
});
