/**
 * =============================================================================
 * PII CONFIRMATION CARD - \"Is this website safe?\" popup
 * =============================================================================
 *
 * When the background worker penalizes PII entry on an *outlier* site (risky
 * WSS, unnecessary data ask, not blacklisted), it asks the user to vouch for
 * the site: a small card in the top-right corner of the page asks whether the
 * site is safe and offers to add it to the allow list.
 *
 * If the user confirms, the domain is added to their whitelist via the
 * background worker, which exempts future PII entries there.
 *
 * PRIVACY: The card only displays the domain and field type - no typed values.
 *
 * The card is rendered in a shadow root so page CSS cannot affect it.
 * =============================================================================
 */

export interface PIIConfirmData {
    domain: string;
    fieldType: string;
    reason: 'risky' | 'unnecessary' | string;
    message: string;
    siteWSS: number;
}

const HOST_ID = 'traceguard-pii-confirm-host';

function buildCard(data: PIIConfirmData): HTMLElement {
    const host = document.createElement('div');
    host.id = HOST_ID;

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            all: initial;
        }
        .tg-card {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2147483647;
            width: 320px;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e2e;
            color: #e2e8f0;
            border: 1px solid #f59e0b;
            border-radius: 12px;
            padding: 14px 16px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
        }
        .tg-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
        }
        .tg-title {
            font-size: 14px;
            font-weight: 600;
            color: #fbbf24;
            margin: 0 0 6px;
            line-height: 1.3;
        }
        .tg-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 4px;
        }
        .tg-close:hover {
            color: #e2e8f0;
            background: rgba(255, 255, 255, 0.08);
        }
        .tg-body {
            font-size: 13px;
            line-height: 1.45;
            color: #cbd5e1;
            margin: 0 0 12px;
        }
        .tg-domain {
            font-weight: 600;
            color: #f8fafc;
            word-break: break-all;
        }
        .tg-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .tg-btn {
            font-size: 12.5px;
            font-weight: 500;
            border: none;
            border-radius: 8px;
            padding: 7px 12px;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        .tg-btn:hover { opacity: 0.88; }
        .tg-btn-primary {
            background: #f59e0b;
            color: #1e1e2e;
        }
        .tg-btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #e2e8f0;
        }
        .tg-note {
            font-size: 11.5px;
            color: #94a3b8;
            margin: 8px 0 0;
            line-height: 1.4;
        }
    `;

    const card = document.createElement('div');
    card.className = 'tg-card';

    const header = document.createElement('div');
    header.className = 'tg-header';

    const title = document.createElement('p');
    title.className = 'tg-title';
    title.textContent = '⚠️ Is this website safe?';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tg-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss');

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('p');
    body.className = 'tg-body';
    body.innerHTML = '';
    body.append(
        'TraceGuard detected personal info (',
        document.createTextNode(data.fieldType),
        ') on ',
        (() => { const s = document.createElement('span'); s.className = 'tg-domain'; s.textContent = data.domain; return s; })(),
        ' and this site doesn\u2019t meet our security checks. Make sure it\u2019s the real site before entering anything.'
    );

    const actions = document.createElement('div');
    actions.className = 'tg-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'tg-btn tg-btn-primary';
    confirmBtn.textContent = 'It\u2019s safe - add to allow list';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'tg-btn tg-btn-secondary';
    dismissBtn.textContent = 'Not sure';

    actions.appendChild(confirmBtn);
    actions.appendChild(dismissBtn);

    const note = document.createElement('p');
    note.className = 'tg-note';
    note.textContent = 'Adding a site to your allow list stops future penalties here. Check the address bar carefully - lookalike domains are a common trick.';

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
    card.appendChild(note);

    shadow.appendChild(style);
    shadow.appendChild(card);

    // --- Wire up the actions -------------------------------------------------

    const remove = () => {
        host.remove();
    };

    closeBtn.addEventListener('click', remove);
    dismissBtn.addEventListener('click', remove);

    confirmBtn.addEventListener('click', () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Adding\u2026';
        chrome.runtime.sendMessage({
            type: 'ADD_TO_ALLOWLIST',
            domain: data.domain,
        }).then(() => {
            confirmBtn.textContent = '✓ Added';
            note.textContent = `${data.domain} was added to your allow list. TraceGuard won't penalize personal info here anymore.`;
            // Keep the confirmation visible briefly, then dismiss.
            setTimeout(remove, 2000);
        }).catch(() => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'It\u2019s safe - add to allow list';
            note.textContent = 'Could not update the allow list. Please try again.';
        });
    });

    return host;
}

/** Shows the confirmation card, replacing any existing one. */
export function showPIIConfirmCard(data: PIIConfirmData): void {
    hidePIIConfirmCard();
    document.body.appendChild(buildCard(data));
}

/** Removes the confirmation card if it's visible. */
export function hidePIIConfirmCard(): void {
    document.getElementById(HOST_ID)?.remove();
}
