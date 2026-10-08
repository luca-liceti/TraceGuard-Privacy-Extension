/**
 * The dashboard layout must render its children on the first render. It used to
 * return null until a `mounted` flag flipped, which only added a blank frame
 * (there is no server render to guard against in this Vite app).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Layout from './layout';
import { AuthProvider } from './auth-provider';

describe('dashboard layout', () => {
    beforeEach(async () => {
        // Vault set up and unlocked, so AuthProvider renders its children.
        await chrome.storage.local.set({
            cryptoSalt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            validator: 'validator',
        });
        await chrome.storage.session.set({ cryptoKeyHex: 'deadbeef' });
    });

    it('renders its children', async () => {
        render(
            <MemoryRouter>
                <AuthProvider>
                    <Layout>
                        <div>page-content</div>
                    </Layout>
                </AuthProvider>
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByText('page-content')).toBeTruthy());
    });
});
