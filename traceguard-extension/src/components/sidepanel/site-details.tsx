import React from "react"
import { useTranslation } from "react-i18next"
import { BadgeCheck, Server, AlertTriangle, CircleCheck, Globe, Activity, Cookie, FileText, Key, XCircle, ThumbsDown, Info, Network, Fingerprint } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"

import { Loader2 } from "lucide-react"
import { PendingLabel } from "@/components/ui/pending"
import { getSafetyConfig, scoreToGrade, SAFETY_CONFIGS } from "@/lib/risk-utils"
import { POLICY_UNRATED_SCORE } from "@/lib/scoring"
import { getGradeTextColor } from "@/lib/theme-utils"
import { SiteRiskData } from "@/lib/types"
import { stoppedCount } from "@/lib/tracker-status"
import { useSettings } from "@/lib/useStorage"
import { preparePrivacyPolicyText } from "@/lib/ai/policy-text"
import { readCachedPolicyReport, saveCachedPolicyReport } from "@/lib/ai/policy-report-cache"
import { SUMMARY_ONLY_MODEL, detectHardware, isPolicyCapableModel } from "@/lib/ai/hardware"
import { ratePrivacyPolicyLocally, type PolicyReportResult } from "@/lib/ai/policy-report"
import { listRunningOllamaModels } from "@/lib/ai/ollama"
import { logEvent } from "@/lib/diagnostics"

// Icon follows the safety bands: Good and above is safe, Fair is a caution,
// Poor and Critical (an unsafe site) is the X. It inherits the score color.
function getWSSIcon(wss: number) {
    if (wss >= 60) return <CircleCheck className="h-5 w-5" />;
    if (wss >= 40) return <AlertTriangle className="h-5 w-5" />;
    return <XCircle className="h-5 w-5" />;
}

const getDetectorInfo = (t: any): Record<string, { icon: React.ComponentType<any>; label: string; description: string; weight: string }> => ({
    reputation: {
        icon: BadgeCheck,
        label: t("Reputation"),
        description: t("Domain trustworthiness"),
        weight: "25%"
    },
    tracking: {
        icon: Activity,
        label: t("Tracking"),
        description: t("Third-party trackers"),
        weight: "25%"
    },
    cookies: {
        icon: Cookie,
        label: t("Cookies"),
        description: t("Tracking cookies"),
        weight: "15%"
    },
    fingerprinting: {
        icon: Fingerprint,
        label: t("Fingerprinting"),
        description: t("Device identification attempts"),
        weight: "15%"
    },
    input: {
        icon: Key,
        label: t("Input Fields"),
        description: t("Sensitive form fields"),
        weight: "10%"
    },
    policy: {
        icon: FileText,
        label: t("Privacy Policy"),
        description: t("ToS;DR rating"),
        weight: "10%"
    }
});

/** Turn a capture failure into something the user can act on. */
function policyCaptureErrorMessage(reason: string | undefined, t: (key: string) => string): string {
    switch (reason) {
        case 'no-candidates':
            return t('No privacy policy link was found on this site. Open the policy page and try again.');
        case 'unreadable':
            return t('The policy page could not be read. It may need a login or interaction, or it may be a PDF.');
        case 'active-site-changed':
            return t('The active tab changed while the policy was being read. Try again.');
        case 'not-enabled':
            return t('Enable local policy reports in Settings first.');
        case 'page-unavailable':
            return t('Open this site in a normal tab, then try again.');
        default:
            return t('The privacy policy could not be found or read.');
    }
}

interface SiteDetailsProps {
    currentSite: SiteRiskData | undefined;
    /**
     * The popup pins the document to a fixed height, so it owns a single scroll
     * region. A fixed-height nested scroll area inside the policy accordion
     * would swallow the wheel and leave the rest of the list unreachable, so the
     * popup renders the points inline instead. The side panel is a real
     * viewport, where a capped list keeps the card compact.
     */
    variant?: 'sidepanel' | 'popup';
}

export function SiteDetails({ currentSite, variant = 'sidepanel' }: SiteDetailsProps) {
    const { t } = useTranslation();
    const settings = useSettings();
    const [policyReport, setPolicyReport] = React.useState<PolicyReportResult | null>(null);
    const [policyReportDomain, setPolicyReportDomain] = React.useState('');
    const [policyReportError, setPolicyReportError] = React.useState<{ domain: string; message: string } | null>(null);
    const [policyReportOperation, setPolicyReportOperation] = React.useState<{ id: number; domain: string; stage: 'reading' | 'analyzing' } | null>(null);
    const policyReportOperationId = React.useRef(0);
    const [recommendedPolicyModel, setRecommendedPolicyModel] = React.useState<string | null>(null);

    // The summary default cannot hold a policy. Detect the machine only when the
    // warning applies, so a correctly configured user pays nothing for it.
    const selectedModel = settings?.localSummaryModel ?? SUMMARY_ONLY_MODEL;
    const needsPolicyCapableModel = !isPolicyCapableModel(selectedModel);
    React.useEffect(() => {
        if (!needsPolicyCapableModel) {
            setRecommendedPolicyModel(null);
            return;
        }
        let active = true;
        void detectHardware().then((profile) => {
            if (active) setRecommendedPolicyModel(profile.model);
        });
        return () => {
            active = false;
        };
    }, [needsPolicyCapableModel]);
    const currentSiteWSS = currentSite?.wss ?? null;

    // ToS;DR points, worst classification first.
    const policyPoints = currentSite?.detectionDetails?.policy?.points ?? [];
    const policyIsRated = currentSite?.detectionDetails?.policy?.source === 'tosdr' && Boolean(currentSite?.detectionDetails?.policy?.grade);
    const currentDomain = currentSite?.domain ?? '';
    const policyDocuments = currentSite?.detectionDetails?.policy?.documents;
    // A report belongs to the site it was made for; switching sites must not
    // show the previous site's grade or points.
    const visiblePolicyReport = policyReport && policyReportDomain === currentDomain ? policyReport : null;
    const policyGrade = currentSite?.detectionDetails?.policy?.grade ?? visiblePolicyReport?.grade;
    const policyReportBusy = policyReportOperation?.domain === currentDomain;
    const policyReportStage = policyReportBusy ? policyReportOperation?.stage : undefined;
    const visiblePolicyReportError = policyReportError?.domain === currentDomain ? policyReportError.message : '';

    const generatePolicyReport = React.useCallback(async () => {
        if (!currentDomain) return;
        const operationId = ++policyReportOperationId.current;
        setPolicyReportOperation({ id: operationId, domain: currentDomain, stage: 'reading' });
        setPolicyReportError((previous) => previous?.domain === currentDomain ? null : previous);
        try {
            const model = selectedModel;
            if (!isPolicyCapableModel(model)) return;
            const runningModels = await listRunningOllamaModels();
            if (!runningModels.includes(model)) {
                throw new Error(t('The selected local model is not loaded in Ollama. Start it on this device, then try again.'));
            }
            // The background fetches static policy HTML first, then uses one
            // inactive tab only when a rendered page is needed as a fallback.
            const page = await chrome.runtime.sendMessage({
                type: 'CAPTURE_PRIVACY_POLICY',
                expectedDomain: currentDomain,
                documents: policyDocuments ?? [],
            }) as { ok?: boolean; url?: string; title?: string; text?: string; reason?: string };
            if (!page?.ok || !page.url || !page.title || !page.text) {
                throw new Error(policyCaptureErrorMessage(page?.reason, t));
            }
            const pageData = { url: page.url, title: page.title, text: page.text };
            const prepared = preparePrivacyPolicyText(pageData);
            if (!prepared.ok) throw new Error(t('The policy page text could not be read safely.'));
            setPolicyReportOperation((current) => current?.id === operationId
                ? { ...current, stage: 'analyzing' }
                : current);
            const report = await ratePrivacyPolicyLocally({ ...pageData, text: prepared.text, model });
            setPolicyReport(report);
            setPolicyReportDomain(currentDomain);
            // A policy rarely changes, so the next visit reads this instead of
            // asking the model again.
            void saveCachedPolicyReport(currentDomain, report);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('The local policy report could not be created.');
            setPolicyReportError({ domain: currentDomain, message });
            logEvent('ui', 'warn', 'policy_report_ui_failed', 'Could not create a local policy report', { error: message });
        } finally {
            setPolicyReportOperation((current) => current?.id === operationId ? null : current);
        }
    }, [currentDomain, policyDocuments, selectedModel, t]);

    // Keep the scores on screen instantly for a site that was analyzed before.
    React.useEffect(() => {
        if (!currentDomain) return;
        let active = true;
        void readCachedPolicyReport(currentDomain).then((cached) => {
            if (!active || !cached) return;
            setPolicyReport(cached);
            setPolicyReportDomain(currentDomain);
        });
        return () => {
            active = false;
        };
    }, [currentDomain]);

    // Analyze a policy the panel has no rating for, without a button. Each site
    // is tried once per session; failures are not retried on every re-render.
    const attemptedDomains = React.useRef(new Set<string>());
    React.useEffect(() => {
        if (!currentDomain || !settings?.enableLocalPolicyReports || !settings.localSummaryModel) return;
        if (policyIsRated || needsPolicyCapableModel) return;
        // One analysis at a time; the site that arrives mid-run waits for it.
        if (policyReportOperation) return;
        if (attemptedDomains.current.has(currentDomain)) return;
        attemptedDomains.current.add(currentDomain);
        let active = true;
        void (async () => {
            const cached = await readCachedPolicyReport(currentDomain);
            if (!active) return;
            if (cached) {
                setPolicyReport(cached);
                setPolicyReportDomain(currentDomain);
                return;
            }
            setPolicyReport(null);
            setPolicyReportDomain('');
            await generatePolicyReport();
        })();
        return () => {
            active = false;
        };
    }, [currentDomain, settings?.enableLocalPolicyReports, policyIsRated, needsPolicyCapableModel, policyReportOperation, generatePolicyReport]);

    if (currentSiteWSS === null || !currentSite) {
        return (
            <Card>
                <CardHeader className="p-4 flex flex-row items-center gap-2 space-y-0">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{t("Website Safety")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <CardDescription>
                        {t("Navigate to a website to see its safety score")}
                    </CardDescription>
                </CardContent>
            </Card>
        );
    }

    const policyPointsList = [...policyPoints]
        .sort((a: any, b: any) => {
            const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 };
            return (order[a.classification] || 5) - (order[b.classification] || 5);
        })
        .map((p: any, idx: number) => {
            let Icon = Info;
            let iconClass = "text-muted-foreground";
            if (p.classification === 'blocker') {
                Icon = XCircle;
                iconClass = SAFETY_CONFIGS.critical.color;
            } else if (p.classification === 'bad') {
                Icon = ThumbsDown;
                iconClass = SAFETY_CONFIGS.poor.color;
            } else if (p.classification === 'good') {
                Icon = CircleCheck;
                iconClass = SAFETY_CONFIGS.excellent.color;
            }
            return (
                <div key={idx} className="flex gap-2 items-start py-1">
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconClass}`} />
                    <span className="text-xs">{p.title}</span>
                </div>
            );
        });

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <CardHeader className="p-4 pb-4 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("Website Safety")}</CardTitle>
                    <Badge className={`${getSafetyConfig(currentSiteWSS).bgColor} ${getSafetyConfig(currentSiteWSS).borderColor} ${getSafetyConfig(currentSiteWSS).color} hover:${getSafetyConfig(currentSiteWSS).bgColor} shadow-none font-medium`}>
                        {t(getSafetyConfig(currentSiteWSS).label)}
                    </Badge>
                </div>
                <div className={`text-3xl font-bold ${getSafetyConfig(currentSiteWSS).color} flex items-center gap-2 mt-1`}>
                    {getWSSIcon(currentSiteWSS)}
                    {currentSiteWSS}
                </div>
                <CardDescription className="text-xs mt-1 min-w-0">
                    <button
                        type="button"
                        aria-label={`${t("View activity log")}: ${currentSite.domain}`}
                        title={t("View activity log")}
                        onClick={() => chrome.tabs.create({
                            url: chrome.runtime.getURL(`src/dashboard/index.html#/overview?viewSite=${encodeURIComponent(currentSite.domain)}`),
                        })}
                        className="block w-fit max-w-full cursor-pointer truncate text-left hover:underline hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    >
                        {currentSite.domain}
                    </button>
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {/* Collapsible Detector Breakdown */}
                <Accordion type="multiple" className="w-full">
                    {Object.entries(currentSite.breakdown)
                        .sort((a, b) => {
                            const order = ['tracking', 'cookies', 'input', 'fingerprinting', 'reputation', 'policy'];
                            return order.indexOf(a[0]) - order.indexOf(b[0]);
                        })
                        .map(([key, score]) => {
                            const info = getDetectorInfo(t)[key];
                            if (!info) return null;
                            const Icon = info.icon;
                            return (
                                <AccordionItem key={key} value={key} className="border-b last:border-b-0">
                                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{info.label}</span>
                                            <span className="text-xs text-muted-foreground ml-auto mr-2">
                                                ({info.weight})
                                            </span>
                                            {key === 'policy' ? (
                                                <span className={`flex items-center gap-1 text-sm font-bold ${getGradeTextColor(policyGrade)}`}>
                                                    {policyReportBusy
                                                        ? <Loader2 aria-label={t('Analyzing the policy')} className="h-3.5 w-3.5 motion-safe:animate-spin" />
                                                        // A missing policy (25) is a red flag and keeps its
                                                        // grade. Only an unrated policy is neutral and shows
                                                        // a dash, so the two cases never look the same.
                                                        : policyGrade ?? (score === POLICY_UNRATED_SCORE ? '—' : scoreToGrade(score))}
                                                    {/* A failed analysis leaves no grade, so say so here where the user can see it without opening the section. */}
                                                    {!policyReportBusy && !policyGrade && visiblePolicyReportError && (
                                                        <AlertTriangle aria-label={t('Policy analysis failed')} className="h-3.5 w-3.5 text-destructive" />
                                                    )}
                                                </span>
                                            ) : (
                                                <span className={`text-sm font-bold ${getSafetyConfig(score).color}`}>
                                                    {scoreToGrade(score)}
                                                </span>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-3 pb-3">
                                        <div className="space-y-2 text-sm">
                                            {/* Detector-specific details */}
                                            <div className="text-muted-foreground bg-muted/30 rounded-sm px-2 py-1.5 space-y-1">
                                                {key === 'reputation' && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span>{t("Status")}</span>
                                                            <span className="font-medium">{score === 100 ? t("Clean") : score === 0 ? t("Blacklisted") : t("Suspicious")}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Checked")}</span>
                                                            <span className="font-medium">{t("Local blacklist")}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {key === 'tracking' && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span>{t("Trackers found")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.tracking?.count ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Known trackers")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.tracking?.known ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Suspicious")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.tracking?.suspicious ?? 0}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {key === 'cookies' && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span>{t("Total cookies")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.cookies?.total ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Tracking")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.cookies?.tracking ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Third-party")}</span>
                                                            <span className="font-medium">{currentSite?.detectionDetails?.cookies?.thirdParty ?? 0}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {key === 'input' && (
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className="shrink-0">{t("Requested PII")}</span>
                                                        <div className="flex flex-wrap justify-end gap-1">
                                                            {currentSite?.detectionDetails?.input?.types && currentSite.detectionDetails.input.types.length > 0 ? (
                                                                currentSite.detectionDetails.input.types.map(type => (
                                                                    <span key={type} className="px-1.5 py-0.5 bg-muted/80 text-[10px] font-medium rounded border border-border/50 capitalize">
                                                                        {t(type)}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="font-medium">{t("None")}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {key === 'fingerprinting' && (
                                                    <>
                                                        <div className="flex justify-between">
                                                            <span>{t("Attempts")}</span>
                                                            <span className="font-medium">{currentSite?.enrichedDetails?.fingerprinting?.summary?.totalAttempts ?? 0}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t("Risk Level")}</span>
                                                            <span className="font-medium capitalize">{currentSite?.enrichedDetails?.fingerprinting?.summary?.riskLevel ?? t("None")}</span>
                                                        </div>
                                                        {currentSite?.enrichedDetails?.fingerprinting?.summary?.techniques && currentSite.enrichedDetails.fingerprinting.summary.techniques.length > 0 && (
                                                            <div className="flex justify-between">
                                                                <span>{t("Techniques")}</span>
                                                                <span className="font-medium text-xs text-right max-w-[150px]">{currentSite.enrichedDetails.fingerprinting.summary.techniques.join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {key === 'policy' && (
                                                    <>
                                                        {currentSite?.detectionDetails?.policy?.source !== 'tosdr' && !settings?.enableLocalPolicyReports && (
                                                            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-sm mb-2">
                                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                                <span className="text-xs leading-tight">
                                                                    {currentSite?.detectionDetails?.policy?.source === 'local'
                                                                        ? t("Privacy policy found, but no ToS;DR rating is available yet.")
                                                                        : t("No privacy policy found. This counts against the site's score.")}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* ToS;DR link */}
                                                        {currentSite?.detectionDetails?.policy?.serviceId
                                                            && (policyIsRated || policyPoints.length > 0) && (
                                                            <div className="flex justify-between items-center">
                                                                <span>{t("View full report")}</span>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-xs px-2 py-0"
                                                                    onClick={() => {
                                                                        chrome.tabs.create({ url: `https://tosdr.org/en/service/${currentSite!.detectionDetails!.policy!.serviceId}` });
                                                                    }}
                                                                >
                                                                    <Globe className="h-3 w-3 mr-1" />
                                                                    {t("ToS;DR")}
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {settings?.enableLocalPolicyReports && !policyIsRated && (
                                                            <div className="space-y-1">
                                                                {needsPolicyCapableModel && (
                                                                    <div className="flex items-start gap-1.5 rounded-sm bg-muted/50 px-2 py-1.5">
                                                                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                                                                        <div className="space-y-1">
                                                                            <p className="text-xs leading-tight">
                                                                                {t('{{model}} writes summaries but cannot hold a whole policy.', { model: selectedModel })}
                                                                                {' '}
                                                                                {recommendedPolicyModel && recommendedPolicyModel !== SUMMARY_ONLY_MODEL
                                                                                    ? t('This device can run {{model}}.', { model: recommendedPolicyModel })
                                                                                    : t('Choose a larger model in Settings.')}
                                                                            </p>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-6 px-2 text-xs"
                                                                                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html#/settings?tab=privacy') })}
                                                                            >
                                                                                {t('Open model settings')}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {!needsPolicyCapableModel && policyReportBusy && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        <PendingLabel
                                                                            label={policyReportStage === 'reading'
                                                                                ? t('Reading this site\'s privacy policy…')
                                                                                : t('Analyzing the policy on this device…')}
                                                                        />
                                                                    </p>
                                                                )}
                                                                {!needsPolicyCapableModel && visiblePolicyReportError && (
                                                                    <p role="alert" className="text-xs text-destructive">
                                                                        {visiblePolicyReportError}{' '}
                                                                        <button
                                                                            type="button"
                                                                            className="underline"
                                                                            onClick={() => {
                                                                                attemptedDomains.current.delete(currentDomain);
                                                                                void generatePolicyReport();
                                                                            }}
                                                                        >
                                                                            {t('Try again')}
                                                                        </button>
                                                                    </p>
                                                                )}
                                                                {visiblePolicyReport && (
                                                                    <div aria-live="polite">
                                                                        {visiblePolicyReport.points.map((point) => {
                                                                            const Icon = point.classification === 'blocker'
                                                                                ? XCircle
                                                                                : point.classification === 'bad'
                                                                                    ? ThumbsDown
                                                                                    : point.classification === 'good'
                                                                                        ? CircleCheck
                                                                                        : Info;
                                                                            const tone = point.classification === 'blocker'
                                                                                ? SAFETY_CONFIGS.critical.color
                                                                                : point.classification === 'bad'
                                                                                    ? SAFETY_CONFIGS.poor.color
                                                                                    : point.classification === 'good'
                                                                                        ? SAFETY_CONFIGS.excellent.color
                                                                                        : 'text-muted-foreground';
                                                                            return (
                                                                                <div key={point.caseId} title={point.quote} className="flex gap-2 items-start py-1">
                                                                                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tone}`} />
                                                                                    <span className="text-xs">{point.title}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <p className="pt-1 text-[10px] text-muted-foreground">
                                                                            {t('No ToS;DR rating. Generated on this device by {{model}} · {{date}}.', {
                                                                                model: visiblePolicyReport.model,
                                                                                date: new Date(visiblePolicyReport.generatedAt).toLocaleDateString(),
                                                                            })}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {policyPoints.length > 0 && (
                                                            variant === 'popup' ? (
                                                                <div className="mt-2 border-t pt-2 border-muted-foreground/20">
                                                                    {policyPointsList}
                                                                </div>
                                                            ) : (
                                                                <ScrollArea className="h-52 mt-2 border-t pt-2 border-muted-foreground/20">
                                                                    {policyPointsList}
                                                                </ScrollArea>
                                                            )
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                </Accordion>

                {/* ── Enriched data compact rows ── */}
                {(() => {
                    const enriched = currentSite?.enrichedDetails
                    if (!enriched) return null
                    return (
                        <div className="border-t divide-y">
                            {/* Security Headers */}
                            {enriched.headers && enriched.headers.items.length > 0 && (
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium break-words">{t("Security Headers")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {enriched.headers.summary.present}/{enriched.headers.summary.present + enriched.headers.summary.missing} {t("present")}
                                        </div>
                                    </div>
                                    <span className={`text-sm shrink-0 ${getGradeTextColor(enriched.headers.summary.grade)}`}>
                                        {enriched.headers.summary.grade}
                                    </span>
                                </div>
                            )}
                            {/* Fingerprinting */}
                            {enriched.fingerprinting && enriched.fingerprinting.summary.totalAttempts > 0 && (
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium break-words">{t("Fingerprinting")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {enriched.fingerprinting.summary.totalAttempts} {t("attempts")} · {enriched.fingerprinting.summary.techniques.join(', ')}
                                        </div>
                                    </div>
                                    <span className={`text-xs font-semibold shrink-0 ${
                                        enriched.fingerprinting.summary.riskLevel === 'high' ? SAFETY_CONFIGS.critical.color :
                                        enriched.fingerprinting.summary.riskLevel === 'medium' ? SAFETY_CONFIGS.fair.color : 'text-muted-foreground'
                                    }`}>
                                        {enriched.fingerprinting.summary.riskLevel}
                                    </span>
                                </div>
                            )}
                            {/* Network Requests */}
                            {enriched.networkRequests && enriched.networkRequests.summary.total > 0 && (
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <Network className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium break-words">{t("Network Requests")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {enriched.networkRequests.summary.thirdParty} {t("third-party")} · {enriched.networkRequests.summary.trackerRequests} {t("trackers")} · {stoppedCount(enriched.networkRequests.summary)} {t("stopped by browser")}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </CardContent>
        </Card>
    );
}
