import React from "react"
import { useTranslation } from "react-i18next"
import { ShieldUser, AlertTriangle, CircleCheck, Globe, Activity, Cookie, FileText, Key, OctagonAlert, XCircle, ThumbsDown, Info, Network, Fingerprint } from "lucide-react"
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
import { SiteRiskData } from "@/lib/types"

function getWSSIcon(wss: number) {
    if (wss >= 60) return <CircleCheck className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
}

function getGradeColor(grade: string): string {
    switch (grade?.toUpperCase()) {
        case "A": return `${SAFETY_CONFIGS.excellent.color} font-bold`;
        case "B": return `${SAFETY_CONFIGS.good.color} font-bold`;
        case "C": return `${SAFETY_CONFIGS.fair.color} font-bold`;
        case "D": return `${SAFETY_CONFIGS.poor.color} font-bold`;
        case "E": return `${SAFETY_CONFIGS.critical.color} font-bold`;
        default: return "text-muted-foreground";
    }
}

const getDetectorInfo = (t: any): Record<string, { icon: React.ComponentType<any>; label: string; description: string; weight: string }> => ({
    reputation: {
        icon: ShieldUser,
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

interface SiteDetailsProps {
    currentSite: SiteRiskData | undefined;
}

export function SiteDetails({ currentSite }: SiteDetailsProps) {
    const { t } = useTranslation();
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

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <CardHeader className="p-4 pb-4 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("Website Safety")}</CardTitle>
                    <Badge className={`${getSafetyConfig(currentSiteWSS).bgColor} ${getSafetyConfig(currentSiteWSS).color} hover:${getSafetyConfig(currentSiteWSS).bgColor} border-transparent shadow-none font-medium`}>
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
                                                <span className={`text-sm font-bold ${getGradeColor(currentSite?.detectionDetails?.policy?.grade || '')}`}>
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
                                                        {currentSite?.detectionDetails?.policy?.points && currentSite.detectionDetails.policy.points.length > 0 && (
                                                            <ScrollArea className="h-52 mt-2 border-t pt-2 border-muted-foreground/20">
                                                                {[...currentSite.detectionDetails.policy.points].sort((a: any, b: any) => {
                                                                    const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 };
                                                                    return (order[a.classification] || 5) - (order[b.classification] || 5);
                                                                }).map((p: any, idx: number) => {
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
                                                                })}
                                                            </ScrollArea>
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
                                    <ShieldUser className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium">{t("Security Headers")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {enriched.headers.summary.present}/{enriched.headers.summary.present + enriched.headers.summary.missing} {t("present")}
                                        </div>
                                    </div>
                                    <span className={`text-sm shrink-0 ${getGradeColor(enriched.headers.summary.grade)}`}>
                                        {enriched.headers.summary.grade}
                                    </span>
                                </div>
                            )}
                            {/* Fingerprinting */}
                            {enriched.fingerprinting && enriched.fingerprinting.summary.totalAttempts > 0 && (
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium">{t("Fingerprinting")}</div>
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
                                        <div className="text-xs font-medium">{t("Network Requests")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {enriched.networkRequests.summary.thirdParty} {t("third-party")} · {enriched.networkRequests.summary.trackerRequests} {t("trackers")} · {enriched.networkRequests.summary.blocked} {t("blocked")}
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
