/**
 * =============================================================================
 * IN-PAGE TOAST, Lightweight notification rendered in a shadow root
 * =============================================================================
 *
 * The background worker sends SHOW_TOAST messages when it wants to surface a
 * warning on the page (e.g. "Sensitive input detected"). Rendering inside a
 * shadow root keeps the host page's CSS from restyling the toast, and the
 * colors mirror the dashboard theme tokens (light/dark/system) so it looks
 * native in either mode.
 *
 * The toast only displays the domain and field type - never any typed value.
 * =============================================================================
 */

export type ToastVariant = 'info' | 'warning' | 'error';

export interface ToastData {
    title: string;
    message: string;
    variant?: ToastVariant;
}

const HOST_ID = 'traceguard-toast-host';

type ThemeName = 'light' | 'dark';

const PALETTES: Record<ThemeName, { bg: string; fg: string; border: string; accent: string }> = {
    light: {
        bg: 'oklch(1 0 0)',
        fg: 'oklch(0.145 0 0)',
        border: 'oklch(0.922 0 0)',
        accent: 'oklch(0.795 0.184 86.047)', // --warning
    },
    dark: {
        bg: 'oklch(0.205 0 0)',
        fg: 'oklch(0.985 0 0)',
        border: 'oklch(1 0 0 / 10%)',
        accent: 'oklch(0.852 0.199 91.936)', // --warning
    },
};

/** Resolves the active theme the same way the dashboard does. */
async function resolveTheme(): Promise<ThemeName> {
    try {
        const { settings } = await chrome.storage.local.get('settings') as { settings?: { theme?: string } };
        const theme = settings?.theme || 'system';
        if (theme === 'light') return 'light';
        if (theme === 'dark') return 'dark';
    } catch {
        // fall through to OS preference
    }
    try {
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    } catch {
        return 'light';
    }
}

function accentFor(variant: ToastVariant | undefined, p: { accent: string; fg: string }): string {
    switch (variant) {
        case 'error':
            return 'oklch(0.637 0.237 25.331)'; // --destructive
        case 'info':
            return 'oklch(0.546 0.245 262.881)'; // --primary-ish blue
        case 'warning':
        default:
            return p.accent;
    }
}

function buildToast(data: ToastData, theme: ThemeName): HTMLElement {
    const p = PALETTES[theme];
    const accent = accentFor(data.variant, p);

    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; }
        .tg-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            max-width: 360px;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: ${p.bg};
            color: ${p.fg};
            border: 1px solid ${p.border};
            border-left: 4px solid ${accent};
            border-radius: 0.625rem;
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
            padding: 12px 16px;
            animation: tg-fade-in 0.18s ease-out;
        }
        @keyframes tg-fade-in {
            from { transform: translateY(8px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        .tg-title {
            font-size: 13.5px;
            font-weight: 600;
            margin: 0 0 4px;
            line-height: 1.3;
        }
        .tg-message {
            font-size: 12.5px;
            line-height: 1.45;
            margin: 0;
            color: ${p.fg};
            opacity: 0.82;
        }
    `;

    const toast = document.createElement('div');
    toast.className = 'tg-toast';
    toast.setAttribute('role', 'status');

    const title = document.createElement('p');
    title.className = 'tg-title';
    title.textContent = data.title;

    const message = document.createElement('p');
    message.className = 'tg-message';
    message.textContent = data.message;

    toast.append(title, message);
    shadow.append(style, toast);
    return host;
}

/** Shows a toast, replacing any existing one and auto-dismissing after 6s. */
export async function showToast(data: ToastData): Promise<void> {
    hideToast();
    const theme = await resolveTheme();
    const host = buildToast(data, theme);
    document.body.appendChild(host);
    setTimeout(() => {
        host.remove();
    }, 6000);
}

/** Removes the toast if it is visible. */
export function hideToast(): void {
    document.getElementById(HOST_ID)?.remove();
}
