import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectHardware, pullCommand, type HardwareProfile } from '@/lib/ai/hardware';
import { PendingLabel } from '@/components/ui/pending';

interface ModelRecommendationProps {
    /** Names of the models Ollama already has, for the status message. */
    installedModels: readonly string[];
}

/**
 * Show the model this machine can actually run, next to the model picker.
 *
 * The recommendation is advisory. The model picker owns selection, while this
 * card explains what the device can run and how to install it.
 */
export function ModelRecommendation({ installedModels }: ModelRecommendationProps) {
    const { t } = useTranslation();
    const [profile, setProfile] = useState<HardwareProfile | null>(null);
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<number | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        void detectHardware().then((result) => {
            if (mounted.current) setProfile(result);
        });
        return () => {
            mounted.current = false;
            if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
        };
    }, []);

    const copyCommand = async () => {
        if (!profile) return;
        try {
            await navigator.clipboard.writeText(pullCommand(profile.model));
            setCopied(true);
            if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can be refused; the command stays visible to copy by hand.
        }
    };

    const installed = profile ? installedModels.includes(profile.model) : false;

    return (
        <section aria-label={t("Recommended for this device")} className="space-y-3 rounded-lg border p-4">
            <div className="min-w-0 space-y-1">
                <h4 className="text-base font-medium">{t("Recommended for this device")}</h4>
                {profile === null ? (
                    <p className="text-sm text-muted-foreground">
                        <PendingLabel label={t("Checking this device's graphics hardware…")} />
                    </p>
                ) : (
                    <p className="break-words text-sm text-muted-foreground">
                        {profile.gpu
                            ? t("Detected: {{gpu}}{{memory}}", {
                                gpu: profile.gpu,
                                memory: profile.vramGb === null
                                    ? ''
                                    : t(" (about {{size}} GB)", { size: profile.vramGb }),
                            })
                            : t("No graphics hardware was identified on this device.")}
                    </p>
                )}
            </div>
            {profile && (
                <>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="text-sm font-medium">{profile.model}</p>
                        <span className="text-xs text-muted-foreground">
                            {t("{{size}} download", { size: profile.sizeGb })}
                        </span>
                    </div>
                    <p className="break-words text-sm text-muted-foreground">{t(profile.note)}</p>
                    <div className="flex min-w-0 items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs">{pullCommand(profile.model)}</code>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={copied ? t("Copied") : t("Copy install command")}
                            title={copied ? t("Copied") : t("Copy install command")}
                            onClick={() => void copyCommand()}
                        >
                            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                        </Button>
                    </div>
                    {installed && (
                        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            {t("Installed in Ollama. Select it in the model list.")}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
