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

import { getSafetyConfig, scoreToGrade, SAFETY_CONFIGS } from "@/lib/risk-utils"
import { getGradeTextColor } from "@/lib/theme-utils"
import { SiteRiskData } from "@/lib/types"
import { stoppedCount } from "@/lib/tracker-status"
import { useSettings } from "@/lib/useStorage"
import { preparePrivacyPolicyText } from "@/lib/ai/policy-text"
import { SUMMARY_ONLY_MODEL, detectHardware } from "@/lib/ai/hardware"
import { ratePrivacyPolicyLocally, type PolicyReportResult } from "@/lib/ai/policy-report"
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
    const [policyReportError, setPolicyReportError] = React.useState('');
    const [policyReportBusy, setPolicyReportBusy] = React.useState(false);
    // Reading a policy can take a few seconds per candidate, so the panel says
    // which half of the work is running instead of showing one vague spinner.
    const [policyReportStage, setPolicyReportStage] = React.useState<'idle' | 'reading' | 'analyzing'>('idle');
    const [recommendedPolicyModel, setRecommendedPolicyModel] = React.useState<string | null>(null);

    // The summary default cannot hold a policy. Detect the machine only when the
    // warning applies, so a correctly configured user pays nothing for it.
    const selectedModel = settings?.localSummaryModel ?? SUMMARY_ONLY_MODEL;
    const needsPolicyCapableModel = selectedModel.trim() === SUMMARY_ONLY_MODEL;
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

    // ToS;DR points, worst classification first.
    const policyPoints = currentSite.detectionDetails?.policy?.points ?? [];
    const policyIsRated = currentSite.detectionDetails?.policy?.source === 'tosdr' && Boolean(currentSite.detectionDetails?.policy?.grade);
    const generatePolicyReport = async () => {
        setPolicyReportBusy(true);
        setPolicyReportStage('reading');
        setPolicyReportError('');
        setPolicyReport(null);
        setPolicyReportDomain('');
        try {
            // The background finds the policy, reads it in a background tab, and
            // hands back the text. Navigation is not the user's job any more.
            const page = await chrome.runtime.sendMessage({
                type: 'CAPTURE_PRIVACY_POLICY',
                expectedDomain: currentSite.domain,
                documents: currentSite.detectionDetails?.policy?.documents ?? [],
            }) as { ok?: boolean; url?: string; title?: string; text?: string; reason?: string };
            if (!page?.ok || !page.url || !page.title || !page.text) {
                throw new Error(policyCaptureErrorMessage(page?.reason, t));
            }
            const pageData = { url: page.url, title: page.title, text: page.text };
            const prepared = preparePrivacyPolicyText(pageData);
            if (!prepared.ok) throw new Error(t('The policy page text could not be read safely.'));
            setPolicyReportStage('analyzing');
            const report = await ratePrivacyPolicyLocally({ ...pageData, text: prepared.text, model: settings?.localSummaryModel ?? 'qwen3.5:0.8b' });
            setPolicyReport(report);
            setPolicyReportDomain(currentSite.domain);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('The local policy report could not be created.');
            setPolicyReportError(message);
            logEvent('ui', 'warn', 'policy_report_ui_failed', 'Could not create a local policy report', { error: message });
        } finally {
            setPolicyReportBusy(false);
            setPolicyReportStage('idle');
        }
    };
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
                <CardDescription className="text-xs mt-1 truncate">
                    {currentSite.domain}
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
                                                <span className={`text-sm font-bold ${getGradeTextColor(currentSite?.detectionDetails?.policy?.grade)}`}>
                                                    {currentSite?.detectionDetails?.policy?.grade || '—'}
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
                                                        {currentSite?.detectionDetails?.policy?.source !== 'tosdr' && (
                                                            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-sm mb-2">
                                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                                <span className="text-xs leading-tight">
                                                                    {currentSite?.detectionDetails?.policy?.source === 'local'
                                                                        ? t("Privacy policy found, but no ToS;DR rating available.")
                                                                        : t("No privacy policy found and no ToS;DR rating available.")}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* ToS;DR link */}
                                                        {currentSite?.detectionDetails?.policy?.serviceId && (
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
                                                            <div className="mt-2 space-y-2 border-t pt-2">
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
                                                                <p className="text-xs text-muted-foreground">{t('This optional report finds this site\'s privacy policy, reads it in a background tab, and sends the text to your local model. Its estimate is provisional and does not change the site score.')}</p>
                                                                <Button variant="outline" size="sm" onClick={generatePolicyReport} disabled={policyReportBusy}>
                                                                    {policyReportStage === 'reading'
                                                                        ? t('Finding and reading the policy…')
                                                                        : policyReportStage === 'analyzing'
                                                                            ? t('Analyzing policy…')
                                                                            : t('Analyze policy with local model')}
                                                                </Button>
                                                                {policyReportError && <p role="alert" className="text-xs text-destructive">{policyReportError}</p>}
                                                                {policyReport && policyReportDomain === currentSite.domain && (
                                                                    <div className="rounded-md bg-muted/40 p-2 space-y-2 text-xs" aria-live="polite">
                                                                        <p><strong>{t('Provisional estimate, not a ToS;DR grade')}:</strong> {policyReport.score}/100 · {t('grade')} {policyReport.grade}</p>
                                                                        <p>{policyReport.summary}</p>
                                                                        {policyReport.points.length > 0 && (
                                                                            <div className="space-y-1">
                                                                                <strong>{t('Cases the policy supports')}:</strong>
                                                                                <ul className="space-y-1">
                                                                                    {policyReport.points.map((point) => {
                                                                                        const Icon = point.classification === 'blocker'
                                                                                            ? XCircle
                                                                                            : point.classification === 'bad'
                                                                                                ? ThumbsDown
                                                                                                : point.classification === 'good'
                                                                                                    ? CircleCheck
                                                                                                    : Info;
                                                                                        const tone = point.classification === 'blocker'
                                                                                            ? 'text-destructive'
                                                                                            : point.classification === 'bad'
                                                                                                ? 'text-warning'
                                                                                                : point.classification === 'good'
                                                                                                    ? 'text-emerald-600'
                                                                                                    : 'text-muted-foreground';
                                                                                        return (
                                                                                            <li key={point.caseId} className="flex gap-1.5 items-start">
                                                                                                <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tone}`} />
                                                                                                <div className="min-w-0">
                                                                                                    <span className="font-medium">{point.title}</span>
                                                                                                    <span className="block text-muted-foreground break-words">“{point.quote}”</span>
                                                                                                </div>
                                                                                            </li>
                                                                                        );
                                                                                    })}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-muted-foreground">{t('The cases follow the idea of ToS;DR\'s taxonomy; this report is generated locally and was not reviewed by ToS;DR.')}</p>
                                                                        <p className="text-muted-foreground">{t('Model: {{model}} · {{time}}', { model: policyReport.model, time: new Date(policyReport.generatedAt).toLocaleTimeString() })}</p>
                                                                        <p className="text-muted-foreground">{policyReport.promptVersion}</p>
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
