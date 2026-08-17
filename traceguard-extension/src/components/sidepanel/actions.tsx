import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Bug, LayoutGrid } from "lucide-react"
import { openIssues } from "@/lib/support"

export function Actions() {
    const { t } = useTranslation();
    
    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
        window.close();
    };

    return (
        <div className="mt-4 pt-3 border-t space-y-2">
            <Button onClick={openDashboard} className="w-full" variant="outline" size="sm">
                <LayoutGrid className="h-4 w-4" />
                {t("Open Dashboard")}
            </Button>
            <Button onClick={openIssues} className="w-full" variant="ghost" size="sm">
                <Bug className="h-4 w-4" />
                {t("Report an Issue")}
            </Button>
        </div>
    );
}
