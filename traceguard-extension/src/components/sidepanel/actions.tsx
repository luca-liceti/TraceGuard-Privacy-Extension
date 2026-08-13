import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { LayoutGrid } from "lucide-react"

export function Actions() {
    const { t } = useTranslation();
    
    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
        window.close();
    };

    return (
        <div className="mt-4 pt-3 border-t">
            <Button onClick={openDashboard} className="w-full" variant="outline" size="sm">
                <LayoutGrid className="h-4 w-4" />
                {t("Open Dashboard")}
            </Button>
        </div>
    );
}
