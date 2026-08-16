import { ShieldUser, Flame, Lock, OctagonAlert } from "lucide-react"
import { useAppState, useSettings, useCurrentSite } from "@/lib/useStorage"
import { useAuth } from "@/components/traceguard/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Toaster } from "@/components/ui/sonner"

import { SAFETY_CONFIGS } from "@/lib/risk-utils"
import { ScoreRing } from "@/components/sidepanel/score-ring"
import { SiteDetails } from "@/components/sidepanel/site-details"
import { Actions } from "@/components/sidepanel/actions"

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
            <OctagonAlert className="h-4 w-4" />
        </div>
    );
}

function App() {
    const { t } = useTranslation();
    const state = useAppState();
    const settings = useSettings();
    const currentSite = useCurrentSite();
    useEffect(() => {        // Removed redundant siteCache listener because the background script correctly updates 
        // state.currentSite on analysis completion, and useAppState() already triggers re-renders.
    }, []);

    if (!state) {
        return <div className="p-4 text-foreground bg-background">{t("Loading TraceGuard...")}</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 flex flex-col">
                <Toaster />
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                        <ShieldUser className="size-6 text-foreground shrink-0" />
                        <span className="truncate font-semibold text-lg text-foreground">
                            TraceGuard
                        </span>
                    </div>
                    
                    <HeaderAuthStatus t={t} />
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                    <ScoreRing ups={state.ups} />
                    <SiteDetails currentSite={currentSite} />

                    {/* Safe Streak */}
                    <Card>
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-medium">{t("Safe Streak")}</CardTitle>
                            <Flame className={`h-4 w-4 ${SAFETY_CONFIGS.poor.color}`} />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold">{state.safeVisitStreak}</div>
                            <CardDescription className="text-xs">{t("Consecutive safe sites")}</CardDescription>
                        </CardContent>
                    </Card>
                </div>
                <Actions />
            </div>
    )
}

export default App
