import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectHardware, pullCommand, type HardwareProfile } from '@/lib/ai/hardware';

interface ModelRecommendationProps {
    /** Names of the models Ollama already has, for the "use this model" action. */
    installedModels: readonly string[];
    selectedModel: string;
    onSelect: (model: string) => void;
}

/**
 * Show the model this machine can actually run, next to the model picker.
 *
 * The recommendation is advisory: the picker below still lists every installed
 * model, and the saved choice still wins. This exists so the first setup does
 * not start from the summary default on a machine that can hold much more.
 */
export function ModelRecommendation({ installedModels, selectedModel, onSelect }: ModelRecommendationProps) {
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
    const selected = profile ? selectedModel === profile.model : false;

    return (
        <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-base font-medium">{t("Recommended for this device")}</p>
            </div>
            {profile === null ? (
                <p className="text-sm text-muted-foreground">{t("Checking this device's graphics hardware…")}</p>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground break-words">
                        {profile.gpu
                            ? t("Detected: {{gpu}}{{memory}}", {
                                gpu: profile.gpu,
                                memory: profile.vramGb === null
                                    ? ''
                                    : t(" (about {{size}} GB)", { size: profile.vramGb }),
                            })
                            : t("No graphics hardware was identified on this device.")}
                    </p>
                    <p className="text-sm font-medium">
                        {t("{{model}} · {{size}} download", { model: profile.model, size: profile.sizeGb })}
                    </p>
                    <p className="text-sm text-muted-foreground break-words">{t(profile.note)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-xs">{pullCommand(profile.model)}</code>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyCommand()}
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? t("Copied") : t("Copy command")}
                        </Button>
                        {installed && !selected && (
                            <Button type="button" size="sm" onClick={() => onSelect(profile.model)}>
                                {t("Use this model")}
                            </Button>
                        )}
                        {installed && selected && (
                            <span className="text-xs text-muted-foreground">{t("Currently selected")}</span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
