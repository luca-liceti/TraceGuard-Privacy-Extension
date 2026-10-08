import { ShieldUser, Lock } from "lucide-react"
import { useAppState, useCurrentSite } from "@/lib/useStorage"
import { useAuth } from "@/components/traceguard/auth-provider"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { Toaster } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

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

interface AppProps {
    /**
     * The browser clamps an action popup to 800x600, and `min-h-screen` (100vh)
     * inside a popup is measured against the popup itself - so the content can
     * grow past the clamp and push the footer off screen. The popup therefore
     * needs a definite height with its own scroll region. The side panel is a
     * real viewport, where `min-h-screen` behaves as intended.
     */
    variant?: 'sidepanel' | 'popup';
}

function App({ variant = 'sidepanel' }: AppProps) {
    const { t } = useTranslation();
    const state = useAppState();
    const currentSite = useCurrentSite();
    const isPopup = variant === 'popup';

    if (!state) {
        return <div className="p-4 text-foreground bg-background">{t("Loading TraceGuard...")}</div>;
    }

    return (
        <div className={cn(
            "bg-background text-foreground p-4 flex flex-col",
            isPopup ? "h-full overflow-hidden" : "min-h-screen"
        )}>
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

                <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
                    <ScoreRing ups={state.ups} />
                    <SiteDetails currentSite={currentSite} variant={isPopup ? 'popup' : 'sidepanel'} />
                </div>
                <Actions />
            </div>
    )
}

export default App
