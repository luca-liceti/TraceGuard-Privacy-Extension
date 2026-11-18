import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/toast';
import { buildWeeklyDigest, WEEKLY_DIGEST_WINDOW_MS } from '@/lib/digest';
import { captureError, logEvent } from '@/lib/diagnostics';
import { storage } from '@/lib/storage';
import { usePiiEvents, useSettings, useSiteCache } from '@/lib/useStorage';

/** Local timestamp of the last digest the user was shown. */
const WEEKLY_DIGEST_KEY = 'weeklyDigestAt';

/** Your Footprint, which opens with the digest section at the top. */
const DIGEST_ROUTE = '/exposure';

/**
 * Shows one in-app summary per week. The timestamp is checked before the site
 * cache is mounted, so a normal dashboard visit does not decrypt every shard
 * just to discover that the digest is not due. This is a toast, not a system
 * notification, and it can be turned off in Settings.
 *
 * The digest is also written to the notification list, so it stays readable
 * after the toast disappears, and both entry points open the digest page.
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
    const navigate = useNavigate();
    const { siteCache, isLoading: siteCacheLoading } = useSiteCache();
    const { piiEvents, isLoading: piiLoading } = usePiiEvents();
    const shown = useRef(false);
    const openDigest = useCallback(() => navigate(DIGEST_ROUTE), [navigate]);

    useEffect(() => {
        if (siteCacheLoading || piiLoading || shown.current) return;
        shown.current = true;

        const now = Date.now();
        const digest = buildWeeklyDigest({ piiEvents, siteCache, now, threshold });
        if (!digest.hasActivity) return;

        // Each count is spelled out in its own singular or plural form. A
        // shared "{{count}} sites" key rendered "1 sites" for a quiet week, and
        // a toast is the worst place to read a grammatical error.
        const parts: string[] = [];
        if (digest.handovers > 0) {
            const entries = digest.handovers === 1
                ? t('{{count}} personal-info entry', { count: digest.handovers })
                : t('{{count}} personal-info entries', { count: digest.handovers });
            const sites = digest.handoverSites === 1
                ? t('{{count}} site', { count: digest.handoverSites })
                : t('{{count}} sites', { count: digest.handoverSites });
            parts.push(t('{{entries}} on {{sites}}', { entries, sites }));
        }
        if (digest.lowScoreSites > 0) {
            parts.push(digest.lowScoreSites === 1
                ? t('{{count}} site below {{threshold}}', { count: digest.lowScoreSites, threshold })
                : t('{{count}} sites below {{threshold}}', { count: digest.lowScoreSites, threshold }));
        }
        if (digest.trackerOrganizations.length > 0) {
            const trackers = digest.trackerOrganizations.length;
            parts.push(trackers === 1
                ? t('{{count}} tracker company seen', { count: trackers })
                : t('{{count}} tracker companies seen', { count: trackers }));
        }
        if (parts.length === 0) {
            parts.push(digest.analyzedSites === 1
                ? t('{{count}} site analyzed', { count: digest.analyzedSites })
                : t('{{count}} sites analyzed', { count: digest.analyzedSites }));
        }

        const summary = `${parts.join('. ')}.`;

        // Record before showing so a re-render cannot duplicate the toast. If the
        // write fails, still show the digest; the worst case is one repeat next
        // week, which is better than silently dropping the summary.
        void chrome.storage.local
            .set({ [WEEKLY_DIGEST_KEY]: now })
            .catch((error) => {
                logEvent('ui', 'warn', 'weekly_digest_state_write_failed', error instanceof Error ? error.message : String(error));
            });

        // The notification is the record: it survives the toast, and its action
        // opens the same digest page.
        void storage
            .addNotification({
                type: 'weekly_digest',
                title: t('Your weekly privacy digest'),
                titleKey: 'Your weekly privacy digest',
                message: summary,
                severity: 'info',
                actionUrl: DIGEST_ROUTE,
            })
            .catch((error) => {
                captureError('ui', error, 'weekly_digest_notification_failed');
            });

        toast.add({
            type: 'info',
            title: t('Your weekly privacy digest'),
            description: summary,
            // A digest is worth more than the default five seconds, but it still
            // leaves on its own: the notification list keeps the record. The
            // toast body is the whole control, so a second button would only
            // repeat what clicking the toast already does.
            timeout: 10000,
            data: { onActivate: openDigest },
        });
    }, [siteCache, piiEvents, siteCacheLoading, piiLoading, threshold, t, openDigest]);

    return null;
}
