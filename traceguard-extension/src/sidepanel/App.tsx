import { ThemeProvider } from "@/components/theme-provider"
import { ShieldCheck, AlertTriangle, CheckCircle, LayoutDashboard } from "lucide-react"
import { useAppState, useSettings } from "@/lib/useStorage"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { storage } from "@/lib/storage"
import { SiteRiskData } from "@/lib/types"

function App() {
    const state = useAppState();
    const settings = useSettings();

    // Refresh state when active tab changes
    useEffect(() => {
        const handleTabActivated = async (activeInfo: { tabId: number; windowId: number }) => {
            try {
                // Get the active tab
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (!tab.url) return;

                // Skip chrome:// and other internal URLs
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
                    return;
                }

                // Extract domain from URL
                let domain: string;
                try {
                    domain = new URL(tab.url).hostname;
                } catch {
                    return;
                }

                // Check if we have cached data for this domain
                const result = await chrome.storage.local.get('siteCache');
                const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                const siteData = siteCache[domain];

                if (siteData) {
                    // Update current site in state
                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: siteData
                    });
                } else {
                    // No cached data, clear current site
                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: undefined
                    });
                }
            } catch (error) {
                console.error('Error refreshing state on tab change:', error);
            }
        };

        // Listen for tab activation
        chrome.tabs.onActivated.addListener(handleTabActivated);

        // Also listen for tab updates (when URL changes in same tab)
        const handleTabUpdated = async (_tabId: number, changeInfo: { status?: string }, tab: chrome.tabs.Tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.active) {
                // Skip chrome:// and other internal URLs
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
                    return;
                }

                // Extract domain from URL
                let domain: string;
                try {
                    domain = new URL(tab.url).hostname;
                } catch {
                    return;
                }

                // Check if we have cached data for this domain
                const result = await chrome.storage.local.get('siteCache');
                const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                const siteData = siteCache[domain];

                if (siteData) {
                    // Update current site in state
                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: siteData
                    });
                } else {
                    // No cached data, clear current site
                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: undefined
                    });
                }
            }
        };

        chrome.tabs.onUpdated.addListener(handleTabUpdated);

        // Also check the current active tab on mount
        chrome.tabs.query({ active: true, currentWindow: true }).then(async (tabs) => {
            if (tabs[0]?.url) {
                const tab = tabs[0];
                if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
                    return;
                }

                let domain: string;
                try {
                    domain = new URL(tab.url).hostname;
                } catch {
                    return;
                }

                const result = await chrome.storage.local.get('siteCache');
                const siteCache: Record<string, SiteRiskData> = (result.siteCache || {}) as Record<string, SiteRiskData>;
                const siteData = siteCache[domain];

                if (siteData) {
                    const currentState = await storage.getState();
                    await storage.updateState({
                        ...currentState,
                        currentSite: siteData
                    });
                }
            }
        });

        return () => {
            chrome.tabs.onActivated.removeListener(handleTabActivated);
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
        };
    }, []);

    // Debug logging for state
    useEffect(() => {
        console.log('App State:', state);
    }, [state]);

    if (!state) {
        console.log('State is null, showing loading...');
        return <div className="p-4 text-foreground bg-background">Loading TraceGuard...</div>;
    }


    const currentSiteWRS = state.currentSite?.wrs ?? null;

    // Determine color based on WRS (standard: 0 = dangerous, 100 = safe)
    const getWRSColor = (wrs: number) => {
        if (wrs >= 80) return "text-green-500";
        if (wrs >= 50) return "text-yellow-500";
        return "text-red-500";
    };

    const getWRSIcon = (wrs: number) => {
        if (wrs >= 80) return <CheckCircle className="h-6 w-6" />;
        if (wrs >= 50) return <AlertTriangle className="h-6 w-6" />;
        return <AlertTriangle className="h-6 w-6" />;
    };

    // UPS color function (same logic as WRS - 0 = dangerous, 100 = safe)
    const getUPSColor = (ups: number) => {
        if (ups >= 80) return "text-green-500";
        if (ups >= 50) return "text-yellow-500";
        return "text-red-500";
    };

    const openDashboard = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/dashboard/index.html')
        });
        // Close the sidepanel after opening dashboard
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
                <div className="flex items-center gap-2 mb-6">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    <h1 className="text-xl font-bold">TraceGuard</h1>
                </div>

                <div className="space-y-4 flex-1">
                    {/* User Privacy Score */}
                    <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                        <h3 className="font-semibold mb-2 text-sm">Privacy Score (UPS)</h3>
                        <div className={`text-3xl font-bold ${getUPSColor(state.ups)}`}>{state.ups}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Sites analyzed: {state.sitesAnalyzed}
                        </p>
                    </div>

                    {/* Current Site Risk Score */}
                    {currentSiteWRS !== null && state.currentSite ? (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <h3 className="font-semibold mb-2 text-sm">Current Site (WRS)</h3>
                            <div className={`text-3xl font-bold ${getWRSColor(currentSiteWRS)} flex items-center gap-2`}>
                                {getWRSIcon(currentSiteWRS)}
                                {currentSiteWRS}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {state.currentSite.domain}
                            </p>

                            {/* Breakdown */}
                            <div className="mt-3 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Protocol:</span>
                                    <span>{state.currentSite.breakdown.protocol}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reputation:</span>
                                    <span>{state.currentSite.breakdown.reputation}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tracking:</span>
                                    <span>{state.currentSite.breakdown.tracking}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cookies:</span>
                                    <span>{state.currentSite.breakdown.cookies}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Input:</span>
                                    <span>{state.currentSite.breakdown.input}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Policy:</span>
                                    <span>{state.currentSite.breakdown.policy}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                            <h3 className="font-semibold mb-2 text-sm">Current Site</h3>
                            <p className="text-sm text-muted-foreground">No site analyzed yet</p>
                        </div>
                    )}

                    {/* Trackers Detected */}
                    <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                        <h3 className="font-semibold mb-2 text-sm">Trackers Detected</h3>
                        <div className="text-3xl font-bold">{state.trackersBlocked}</div>
                    </div>
                </div>

                {/* Dashboard Button at Bottom */}
                <div className="mt-6 pt-4 border-t border-border">
                    <Button
                        onClick={openDashboard}
                        className="w-full"
                        variant="outline"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Open Dashboard
                    </Button>
                </div>
            </div>
        </ThemeProvider>
    )
}

export default App
