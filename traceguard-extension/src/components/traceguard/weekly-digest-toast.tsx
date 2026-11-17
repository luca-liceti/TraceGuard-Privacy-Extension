import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/toast';
import { buildWeeklyDigest, WEEKLY_DIGEST_WINDOW_MS } from '@/lib/digest';
import { logEvent } from '@/lib/diagnostics';
import { usePiiEvents, useSettings, useSiteCache } from '@/lib/useStorage';

/** Local timestamp of the last digest the user was shown. */
const WEEKLY_DIGEST_KEY = 'weeklyDigestAt';

/**
 * Shows one in-app summary per week. The timestamp is checked before the site
 * cache is mounted, so a normal dashboard visit does not decrypt every shard
 * just to discover that the digest is not due. This is a toast, not a system
 * notification, and it can be turned off in Settings.
 */
export function WeeklyDigestToast() {
    const settings = useSettings();
    const [due, setDue] = useState(false);

    useEffect(() => {
        // Missing on older installs means the default (on), not off.
        if (settings?.weeklyDigest === false) {
            setDue(false);
            return;
        }

        let active = true;
        chrome.storage.local
            .get(WEEKLY_DIGEST_KEY)
            .then((stored) => {
                if (!active) return;
                const lastShownAt = Number(stored[WEEKLY_DIGEST_KEY]) || 0;
                setDue(Date.now() - lastShownAt >= WEEKLY_DIGEST_WINDOW_MS);
            })
            .catch((error) => {
                logEvent('ui', 'warn', 'weekly_digest_state_read_failed', error instanceof Error ? error.message : String(error));
                if (active) setDue(false);
            });

        return () => {
            active = false;
        };
    }, [settings?.weeklyDigest]);

    if (!settings || settings.weeklyDigest === false || !due) return null;

    return <WeeklyDigestContent threshold={settings.wssThreshold ?? 60} />;
}

function WeeklyDigestContent({ threshold }: { threshold: number }) {
    const { t } = useTranslation();
    const { siteCache, isLoading: siteCacheLoading } = useSiteCache();
    const { piiEvents, isLoading: piiLoading } = usePiiEvents();
    const shown = useRef(false);

    useEffect(() => {
        if (siteCacheLoading || piiLoading || shown.current) return;
        shown.current = true;

        const now = Date.now();
        const digest = buildWeeklyDigest({ piiEvents, siteCache, now, threshold });
        if (!digest.hasActivity) return;

        const parts: string[] = [];
        if (digest.handovers > 0) {
            parts.push(t('{{count}} personal-info entries on {{sites}} sites', {
                count: digest.handovers,
                sites: digest.handoverSites,
            }));
        }
        if (digest.lowScoreSites > 0) {
            parts.push(t('{{count}} sites below {{threshold}}', {
                count: digest.lowScoreSites,
                threshold,
            }));
        }
        if (digest.trackerOrganizations.length > 0) {
            parts.push(t('{{count}} tracker companies seen', {
                count: digest.trackerOrganizations.length,
            }));
        }
        if (parts.length === 0) {
            parts.push(t('{{count}} sites analyzed', { count: digest.analyzedSites }));
        }

        const description = `${parts.join('. ')}. ${t('Open Footprint to see who holds what.')}`;

        // Record before showing so a re-render cannot duplicate the toast. If the
        // write fails, still show the digest; the worst case is one repeat next
        // week, which is better than silently dropping the summary.
        void chrome.storage.local
            .set({ [WEEKLY_DIGEST_KEY]: now })
            .catch((error) => {
                logEvent('ui', 'warn', 'weekly_digest_state_write_failed', error instanceof Error ? error.message : String(error));
            });

        toast.add({
            type: 'info',
            title: t('Your weekly privacy digest'),
            description,
        });
    }, [siteCache, piiEvents, siteCacheLoading, piiLoading, threshold, t]);

    return null;
}
