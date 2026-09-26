import { ShieldUser, Lock } from "lucide-react"
import { useAppState, useCurrentSite } from "@/lib/useStorage"
import { useAuth } from "@/components/traceguard/auth-provider"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { Toaster } from "@/components/ui/toast"

import { ScoreRing } from "@/components/sidepanel/score-ring"
import { SiteDetails } from "@/components/sidepanel/site-details"
import { Actions } from "@/components/sidepanel/actions"

/**
 * Small helper component for the header lock status. Children only render
 * while the vault is unlocked (AuthProvider shows the full-screen lock form
 * otherwise), so this is always the lock action.
 */
function HeaderAuthStatus({ t }: { t: any }) {
    const { lock } = useAuth();

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

function App() {
    const { t } = useTranslation();
    const state = useAppState();
    const currentSite = useCurrentSite();

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
                </div>
                <Actions />
            </div>
    )
}

export default App
