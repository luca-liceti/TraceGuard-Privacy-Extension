import { ThemeProvider } from "@/components/theme-provider"
import { ShieldCheck, AlertTriangle, CheckCircle, LayoutDashboard, Globe, Shield, Flame, Activity, Cookie, FileText, Key, Lock } from "lucide-react"
import { useAppState, useSettings } from "@/lib/useStorage"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import { SiteRiskData, CrossSiteExposure } from "@/lib/types"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"

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

function getWSSLabel(wss: number): string {
    if (wss >= 80) return "Safe";
    if (wss >= 60) return "Low Risk";
    if (wss >= 40) return "Medium";
    if (wss >= 20) return "High Risk";
    return "Critical";
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

// Detector info for display
const detectorInfo: Record<string, { icon: React.ComponentType<any>; label: string; description: string; weight: string }> = {
    protocol: {
        icon: Lock,
        label: "Protocol",
        description: "HTTPS/HTTP security",
        weight: "25%"
    },
    reputation: {
        icon: Shield,
        label: "Reputation",
        description: "Domain trustworthiness",
        weight: "25%"
    },
    tracking: {
        icon: Activity,
        label: "Tracking",
        description: "Third-party trackers",
        weight: "20%"
    },
    cookies: {
        icon: Cookie,
        label: "Cookies",
        description: "Tracking cookies",
        weight: "15%"
    },
    input: {
        icon: Key,
        label: "Input Fields",
        description: "Sensitive form fields",
        weight: "10%"
    },
    policy: {
        icon: FileText,
        label: "Privacy Policy",
        description: "ToS;DR rating",
        weight: "5%"
    }
};

function App() {
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
        return <div className="p-4 text-foreground bg-background">Loading TraceGuard...</div>;
    }

    const currentSiteWSS = state.currentSite?.wss ?? null;
    const exposureCount = Object.keys(crossSiteExposure).length;

    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
        window.close();
    };

    return (
        <ThemeProvider
            key={settings?.theme || "system"}
            attribute="class"
            defaultTheme={settings?.theme || "system"}
            enableSystem={true}
            disableTransitionOnChange
        >
            <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                    <h1 className="text-lg font-bold">TraceGuard</h1>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                    {/* User Privacy Score */}
                    <div className="p-3 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Privacy Score</span>
                            <span className="text-sm text-muted-foreground">{state.sitesAnalyzed} sites</span>
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
                                    <span className="text-sm font-medium text-muted-foreground">Website Safety</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getWSSBgColor(currentSiteWSS)} text-white`}>
                                        {getWSSLabel(currentSiteWSS)}
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
                                    const info = detectorInfo[key];
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
                                                        {key === 'protocol' && (
                                                            <div className="flex justify-between">
                                                                <span>Connection</span>
                                                                <span className="font-medium">{score === 100 ? 'HTTPS (Secure)' : 'HTTP (Insecure)'}</span>
                                                            </div>
                                                        )}
                                                        {key === 'reputation' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>Status</span>
                                                                    <span className="font-medium">{score === 100 ? 'Clean' : score === 0 ? 'Blacklisted' : 'Suspicious'}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Checked</span>
                                                                    <span className="font-medium">Blacklist + URLhaus</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'tracking' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>Trackers found</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.count ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Known trackers</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.known ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Suspicious</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.tracking?.suspicious ?? 0}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'cookies' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>Total cookies</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.total ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Tracking</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.tracking ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Third-party</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.cookies?.thirdParty ?? 0}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {key === 'input' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>Input fields</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.input?.total ?? 0}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Sensitive (HIGH)</span>
                                                                    <span className="font-medium">{state.currentSite?.detectionDetails?.input?.sensitive ?? 0}</span>
                                                                </div>
                                                                {state.currentSite?.detectionDetails?.input?.types && state.currentSite.detectionDetails.input.types.length > 0 && (
                                                                    <div className="flex justify-between">
                                                                        <span>Types</span>
                                                                        <span className="font-medium text-xs">{state.currentSite.detectionDetails.input.types.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {key === 'policy' && (
                                                            <>
                                                                <div className="flex justify-between">
                                                                    <span>ToS;DR Grade</span>
                                                                    <span className="font-medium">
                                                                        {state.currentSite?.detectionDetails?.policy?.grade || 'Not rated'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Source</span>
                                                                    <span className="font-medium capitalize">
                                                                        {state.currentSite?.detectionDetails?.policy?.source === 'tosdr' ? 'ToS;DR API' : 'Local detection'}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </div>
                    ) : (
                        <div className="p-3 rounded-lg border bg-card shadow-sm">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Website Safety</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Navigate to a website to see its safety score
                            </p>
                        </div>
                    )}

                    {/* Data Exposure Summary */}
                    {exposureCount > 0 && (
                        <div className="p-3 rounded-lg border bg-card shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Data Exposure</span>
                                <span className="text-xs text-muted-foreground">{exposureCount} PII types</span>
                            </div>
                            <div className="mt-2 space-y-1">
                                {Object.entries(crossSiteExposure).slice(0, 3).map(([type, sites]) => (
                                    <div key={type} className="flex items-center justify-between text-xs">
                                        <span className="capitalize text-muted-foreground">{type}</span>
                                        <span className="font-medium">{sites.length} sites</span>
                                    </div>
                                ))}
                                {exposureCount > 3 && (
                                    <div className="text-xs text-muted-foreground text-center pt-1">
                                        +{exposureCount - 3} more...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Safe Streak */}
                    <div className="p-3 rounded-lg border bg-card shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Safe Streak</span>
                            <Flame className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="text-2xl font-bold mt-1">{state.safeVisitStreak}</div>
                        <p className="text-xs text-muted-foreground">Consecutive safe sites</p>
                    </div>
                </div>

                {/* Dashboard Button */}
                <div className="mt-4 pt-3 border-t">
                    <Button onClick={openDashboard} className="w-full" variant="outline" size="sm">
                        <LayoutDashboard className="h-4 w-4" />
                        Open Dashboard
                    </Button>
                </div>
            </div>
        </ThemeProvider>
    )
}

export default App
