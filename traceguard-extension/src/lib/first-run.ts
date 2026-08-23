/**
 * =============================================================================
 * FIRST-RUN REDIRECT
 * =============================================================================
 *
 * On a fresh install the vault (master password) hasn't been created yet.
 * Instead of squeezing the account-creation form into a small surface (the
 * 360px popup or the side panel), the extension opens the full dashboard tab,
 * which shows the "Secure Your Vault" page, so the user creates their account
 * there.
 *
 * Both the popup and the side panel share this check: they are the two
 * surfaces that open when the user clicks the toolbar icon.
 * =============================================================================
 */

/**
 * Checks whether the vault exists (same check AuthProvider uses: no
 * `cryptoSalt`/`validator` in storage means no vault yet). When it does not
 * exist, opens the dashboard tab hosting the account-creation page.
 *
 * @returns true when the user was redirected (first run, no vault yet).
 */
export async function redirectToDashboardIfFirstRun(): Promise<boolean> {
    const local = await chrome.storage.local.get(['cryptoSalt', 'validator']);
    if (local.cryptoSalt && local.validator) return false;
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    return true;
}
