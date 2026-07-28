/**
 * =============================================================================
 * SIDEPANEL APP - The Main Extension Interface
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This is the React component that creates the sidepanel/popup you see when
 * you click the TraceGuard icon. It shows your privacy scores and website
 * analysis results.
 * 
 * WHAT IT DISPLAYS:
 * 1. Privacy Score (UPS) - Your personal privacy score (0-100)
 * 2. Website Safety (WSS) - Current site's safety score with breakdown
 * 3. Detector Details - Expandable section showing each detector's findings
 * 4. Data Exposure - Which sites know your email, phone, etc.
 * 5. Safe Streak - Consecutive safe sites visited
 * 6. Dashboard Button - Opens the full dashboard for more details
 * 
 * COLOR CODING (same for UPS and WSS):
 * - Green (80-100): Safe / Excellent
 * - Blue (60-79): Low Risk / Good
 * - Yellow (40-59): Medium / Fair
 * - Orange (20-39): High Risk / Poor
 * - Red (0-19): Critical / Dangerous
 * 
 * HOW IT WORKS:
 * 1. Loads saved state from chrome.storage
 * 2. Listens for tab changes to update the current site's data
 * 3. When siteCache changes, automatically updates the display
 * 4. Uses React hooks to keep the UI in sync with data
 * 
 * REACT CONCEPTS USED:
 * - useState: Stores component state (like crossSiteExposure)
 * - useEffect: Runs code when component mounts or data changes
 * - Custom hooks (useAppState, useSettings): Load data from storage
 * =============================================================================
 */

import { ShieldCheck, AlertTriangle, CheckCircle, LayoutDashboard, Globe, Shield, Flame, Activity, Cookie, FileText, Key, Lock, ShieldAlert, XCircle, ThumbsDown, Info, ExternalLink, Network, Fingerprint } from "lucide-react"
import { useAppState, useSettings } from "@/lib/useStorage"
import { useAuth } from "@/components/traceguard/auth-provider"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Toaster } from "@/components/ui/sonner"
import { storage } from "@/lib/storage"
import { SiteRiskData, CrossSiteExposure } from "@/lib/types"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"

// =============================================================================
// HELPER FUNCTIONS
// These functions determine colors and labels based on scores
// =============================================================================

// WSS Color based on score (higher = safer)
function getWSSColor(wss: number): string {
    if (wss >= 80) return "text-green-500";
    if (wss >= 60) return "text-blue-500";
    if (wss >= 40) return "text-yellow-500";
    if (wss >= 20) return "text-orange-500";
    return "text-red-500";
}

function getWSSBgColor(wss: number): string {
    if (wss >= 80) return "bg-green-500";
    if (wss >= 60) return "bg-blue-500";
    if (wss >= 40) return "bg-yellow-500";
    if (wss >= 20) return "bg-orange-500";
    return "bg-red-500";
}

function getWSSLabel(wss: number, t: any): string {
    if (wss >= 80) return t("Safe");
    if (wss >= 60) return t("Low Risk");
    if (wss >= 40) return t("Medium");
    if (wss >= 20) return t("High Risk");
    return t("Critical");
}

function getWSSIcon(wss: number) {
    if (wss >= 60) return <CheckCircle className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
}

// UPS color (same logic)
function getUPSColor(ups: number): string {
    if (ups >= 80) return "text-green-500";
    if (ups >= 60) return "text-blue-500";
    if (ups >= 40) return "text-yellow-500";
    return "text-red-500";
}

function getGradeColor(grade: string): string {
    switch (grade?.toUpperCase()) {
        case "A": return "text-green-500 font-bold";
        case "B": return "text-blue-500 font-bold";
        case "C": return "text-yellow-500 font-bold";
        case "D": return "text-orange-500 font-bold";
        case "E": return "text-red-500 font-bold";
        default: return "text-muted-foreground";
    }
}

const getDetectorInfo = (t: any): Record<string, { icon: React.ComponentType<any>; label: string; description: string; weight: string }> => ({
    reputation: {
        icon: Shield,
        label: t("Reputation"),
        description: t("Domain trustworthiness"),
        weight: "30%"
    },
    tracking: {
        icon: Activity,
        label: t("Tracking"),
        description: t("Third-party trackers"),
        weight: "30%"
    },
    cookies: {
        icon: Cookie,
        label: t("Cookies"),
        description: t("Tracking cookies"),
        weight: "20%"
    },
    input: {
        icon: Key,
        label: t("Input Fields"),
        description: t("Sensitive form fields"),
        weight: "15%"
    },
    policy: {
        icon: FileText,
        label: t("Privacy Policy"),
        description: t("ToS;DR rating"),
        weight: "5%"
    }
});
 
 /**
  * Small helper component for the header lock status
  */
 function HeaderAuthStatus({ t }: { t: any }) {
     const { authState, lock } = useAuth();
 
     if (authState === "unlocked") {
         return (
             <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                 onClick={() => lock()}
                 title={t("Lock Vault")}
             >
                 <Lock className="h-4 w-4" />
             </Button>
         );
     }
 
     return (
         <div className="flex items-center justify-center h-8 w-8 text-destructive animate-pulse" title={t("Vault Locked")}>
             <ShieldAlert className="h-4 w-4" />
         </div>
     );
 }
 

function App() {
    const { t } = useTranslation();
    const state = useAppState();
    const settings = useSettings();
    const [crossSiteExposure, setCrossSiteExposure] = useState<CrossSiteExposure>({});

    // Load cross-site exposure
    useEffect(() => {
        const loadExposure = async () => {
            const exposure = await storage.getAllExposure();
            setCrossSiteExposure(exposure);
        };
        loadExposure();

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.crossSiteExposure) loadExposure();

            // Auto-update when siteCache changes (new analysis data available)
            if (changes.siteCache) {
                chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
                    if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('chrome-extension://')) {
                        try {
                            const domain = new URL(tabs[0].url).hostname;
                            const newCache = changes.siteCache.newValue as Record<string, SiteRiskData>;
                            const siteData = newCache?.[domain];

                            if (siteData) {
                                console.log('[Sidepanel] Auto-updating with new analysis data for:', domain);
                                const currentState = await storage.getState();
                                await storage.updateState({ ...currentState, currentSite: siteData });
                            }
                        } catch (e) { /* ignore */ }
                    }
                });
            }
        };
        chrome.storage.local.onChanged.addListener(listener);
        return () => chrome.storage.local.onChanged.removeListener(listener);
    }, []);

    // Refresh state when active tab changes
    useEffect(() => {
        const handleTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) return;

                const domain = new URL(tab.url).hostname;
                const result = await chrome.storage.local.get('siteCache');
                const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                const siteData = siteCache[domain];

                const currentState = await storage.getState();
                await storage.updateState({
                    ...currentState,
                    currentSite: siteData || undefined
                });
            } catch (error) {
                console.error('Error refreshing state on tab change:', error);
            }
        };

        const handleTabUpdated = async (_tabId: number, changeInfo: { status?: string }, tab: chrome.tabs.Tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.active) {
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) return;

                try {
                    const domain = new URL(tab.url).hostname;
                    const result = await chrome.storage.local.get('siteCache');
                    const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                    const siteData = siteCache[domain];

                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: siteData || undefined
                    });
                } catch (error) {
                    console.error('Error on tab update:', error);
                }
            }
        };

        chrome.tabs.onActivated.addListener(handleTabActivated);
        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        // Check current tab on mount
        chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
            if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('chrome-extension://')) {
                try {
                    const domain = new URL(tabs[0].url).hostname;
                    const result = await chrome.storage.local.get('siteCache');
                    const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                    const siteData = siteCache[domain];

                    if (siteData) {
                        const currentState = await storage.getState();
                        await storage.updateState({ ...currentState, currentSite: siteData });
                    }
                } catch (error) { /* ignore */ }
            }
        });

        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
    }, []);

    if (!state) {
        return <div className="p-4 text-foreground bg-background">{t("Loading TraceGuard...")}</div>;
    }

    const currentSiteWSS = state.currentSite?.wss ?? null;
    const exposureCount = Object.keys(crossSiteExposure).length;

    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
        window.close();
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
                <Toaster />
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-7 w-7 text-primary" />
                        <h1 className="text-lg font-bold">TraceGuard</h1>
                    </div>
                    
                    <HeaderAuthStatus t={t} />
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                    {/* User Privacy Score */}
                    <div className="p-3 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">{t("Privacy Score")}</span>
                            <span className="text-sm text-muted-foreground">{state.sitesAnalyzed} {t("sites")}</span>
                        </div>
                        <div className={`text-3xl font-bold ${getUPSColor(state.ups)} mt-1`}>
                            {state.ups}
                        </div>
                        <Progress value={state.ups} className="h-1.5 mt-2" />
                    </div>

                    {/* Website Safety Score with Collapsible Breakdown */}
                    {currentSiteWSS !== null && state.currentSite ? (
                        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="p-3 border-b">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">{t("Website Safety")}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getWSSBgColor(currentSiteWSS)} text-white`}>
                                        {getWSSLabel(currentSiteWSS, t)}
                                    </span>
                                </div>
                                <div className={`text-3xl font-bold ${getWSSColor(currentSiteWSS)} flex items-center gap-2 mt-1`}>
                                    {getWSSIcon(currentSiteWSS)}
                                    {currentSiteWSS}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                    {state.currentSite.domain}
                                </p>
                            </div>
                            {/* Collapsible Detector Breakdown */}
                            <Accordion type="multiple" className="w-full">
                                {Object.entries(state.currentSite.breakdown).map(([key, score]) => {
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
                                                    <span className={`text-sm font-semibold ${getWSSColor(score)}`}>
                                                        {score}
                                                    </span>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-3 pb-3">
                                                <div className="space-y-2 text-sm">
                                                    {/* Progress bar */}
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={score} className="h-1.5 flex-1" />
                                                    </div>
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
                                                                    <span className="font-medium">{t("Blacklist + URLhaus")}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'tracking' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Trackers found")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.count ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Known trackers")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.known ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Suspicious")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.suspicious ?? 0}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'cookies' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Total cookies")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.total ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Tracking")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.tracking ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Third-party")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.thirdParty ?? 0}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'input' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Input fields")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.input?.total ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t("Sensitive (HIGH)")}</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.input?.sensitive ?? 0}</span>
                                                                </div>
                                                                {state.currentSite?.detectionDetails?.input?.types && state.currentSite.detectionDetails.input.types.length > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span>{t("Types")}</span>
                                                                        <span className="font-medium text-xs">{state.currentSite.detectionDetails.input.types.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {key === 'policy' && (
                                                            <>
                                                                <div className="flex justify-between items-center">
                                                                    <span>{t("ToS;DR Grade")}</span>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`font-medium ${getGradeColor(state.currentSite?.detectionDetails?.policy?.grade || '')}`}>
                                                                            {state.currentSite?.detectionDetails?.policy?.grade || t("Not rated")}
                                                                        </span>
                                                                        {state.currentSite?.detectionDetails?.policy?.serviceId && (
                                                                            <Button 
                                                                                variant="outline" 
                                                                                size="sm" 
                                                                                className="h-6 text-xs px-2 py-0"
                                                                                onClick={() => {
                                                                                    chrome.tabs.create({ url: `https://tosdr.org/en/service/${state.currentSite!.detectionDetails!.policy!.serviceId}` });
                                                                                }}
                                                                            >
                                                                                <Globe className="h-3 w-3 mr-1" />
                                                                                {t("ToS;DR")}
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span>{t("Source")}</span>
                                                                    <span className="font-medium capitalize">
                                                                        {state.currentSite?.detectionDetails?.policy?.source === 'tosdr' ? t("ToS;DR API") : t("Local detection")}
                                                                    </span>
                                                                </div>
                                                                {state.currentSite?.detectionDetails?.policy?.points && state.currentSite.detectionDetails.policy.points.length > 0 && (
                                                                    <ScrollArea className="h-[200px] mt-2 border-t pt-2 border-muted-foreground/20">
                                                                        {[...state.currentSite.detectionDetails.policy.points].sort((a: any, b: any) => {
                                                                            const order: Record<string, number> = { blocker: 1, bad: 2, neutral: 3, good: 4 };
                                                                            return (order[a.classification] || 5) - (order[b.classification] || 5);
                                                                        }).map((p: any, idx: number) => {
                                                                            let Icon = Info;
                                                                            let iconClass = "text-muted-foreground";
                                                                            if (p.classification === 'blocker') {
                                                                                Icon = XCircle;
                                                                                iconClass = "text-red-600 dark:text-red-400";
                                                                            } else if (p.classification === 'bad') {
                                                                                Icon = ThumbsDown;
                                                                                iconClass = "text-orange-500 dark:text-orange-400";
                                                                            } else if (p.classification === 'good') {
                                                                                Icon = CheckCircle;
                                                                                iconClass = "text-green-600 dark:text-green-400";
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
                                    const enriched = state.currentSite?.enrichedDetails
                                    if (!enriched) return null
                                    return (
                                        <div className="border-t divide-y">
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
                                                        enriched.fingerprinting.summary.riskLevel === 'high' ? 'text-red-500' :
                                                        enriched.fingerprinting.summary.riskLevel === 'medium' ? 'text-yellow-500' : 'text-muted-foreground'
                                                    }`}>
                                                        {enriched.fingerprinting.summary.riskLevel}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Security Headers */}
                                            {enriched.headers && enriched.headers.items.length > 0 && (
                                                <div className="px-3 py-2 flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium">{t("Security Headers")}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {enriched.headers.summary.present}/{enriched.headers.summary.present + enriched.headers.summary.missing} {t("present")}
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-bold shrink-0 ${
                                                        enriched.headers.summary.grade === 'A' ? 'text-green-500' :
                                                        enriched.headers.summary.grade === 'B' ? 'text-blue-500' :
                                                        enriched.headers.summary.grade === 'C' ? 'text-yellow-500' :
                                                        enriched.headers.summary.grade === 'D' ? 'text-orange-500' : 'text-red-500'
                                                    }`}>
                                                        {enriched.headers.summary.grade}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                        </div>
                    ) : (
                        <div className="p-3 rounded-lg border bg-card shadow-sm">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{t("Website Safety")}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                {t("Navigate to a website to see its safety score")}
                            </p>
                        </div>
                    )}

                    {/* Data Exposure Summary */}
                    {exposureCount > 0 && (
                        <div className="p-3 rounded-lg border bg-card shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{t("Data Exposure")}</span>
                                <span className="text-xs text-muted-foreground">{exposureCount} {t("PII types")}</span>
                            </div>
                            <div className="mt-2 space-y-1">
                                {Object.entries(crossSiteExposure).slice(0, 3).map(([type, sites]) => (
                                    <div key={type} className="flex items-center justify-between text-xs">
                                        <span className="capitalize text-muted-foreground">{t(type)}</span>
                                        <span className="font-medium">{sites.length} {t("sites")}</span>
                                    </div>
                                ))}
                                {exposureCount > 3 && (
                                    <div className="text-xs text-muted-foreground text-center pt-1">
                                        +{exposureCount - 3} {t("more...")}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Safe Streak */}
                    <div className="p-3 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{t("Safe Streak")}</span>
                            <Flame className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="text-2xl font-bold mt-1">{state.safeVisitStreak}</div>
                        <p className="text-xs text-muted-foreground">{t("Consecutive safe sites")}</p>
                    </div>
                </div>
                {/* Dashboard Button */}
                <div className="mt-4 pt-3 border-t">
                    <Button onClick={openDashboard} className="w-full" variant="outline" size="sm">
                        <LayoutDashboard className="h-4 w-4" />
                        {t("Open Dashboard")}
                    </Button>
                </div>
            </div>
    )
}

export default App
