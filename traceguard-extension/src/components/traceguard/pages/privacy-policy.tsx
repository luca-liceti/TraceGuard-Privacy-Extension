import React from "react"
import { useTranslation } from "react-i18next"
import { ChartNoAxesColumn, LaptopMinimal, ClipboardX, SlidersHorizontal } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function PrivacyPolicyPage() {
  const { t } = useTranslation()

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t("TraceGuard Privacy Policy")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Effective date: August 3, 2026")}
        </p>
      </header>

      <section className="space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>
          {t("TraceGuard analyzes the pages you visit locally in your browser to provide privacy and website-safety scores. It stores analysis results, including domain names, timestamps, detector results, score history, settings, and PII ")}<strong>{t("field types")}</strong>{t(" that you choose to enter. It never reads, stores, or transmits the contents of form fields, passwords, cookie values, or other entered personal data.")}
        </p>

        <p>
          {t("TraceGuard is local-first. It downloads public tracker, cookie-list, and ToS;DR database updates, and automatically refreshes a signed threat feed. Those shared update requests contain no browsing, account, or other user data. Optional Live Rating Lookup can send a site's domain to ToS;DR. Optional local AI summaries send selected analysis facts to Ollama on your device. TraceGuard does not use analytics, telemetry, or advertising SDKs, and does not sell your data. Analysis data is stored locally in Chrome extension storage; sensitive history is encrypted after you unlock the vault.")}
        </p>

        <p>
          {t("Local Policy Reports are off by default. When enabled, viewing an unrated site in the popup or side panel starts a report automatically if no saved report exists and a capable Ollama model is loaded. TraceGuard fetches up to four policy pages without cookies or site credentials; each policy host receives an ordinary request and can observe network metadata, including your IP address. If fetched HTML has no readable policy text, one inactive tab may open briefly as a fallback using your browser session. It may send applicable cookies and appear in history, and is closed after reading. Up to 30,000 characters of policy text and its page address are sent only to Ollama on this device. The report is saved locally for seven days, is provisional, and does not change the site's score. Turning the feature off deletes saved reports.")}
        </p>

        <p>
          {t("You can review, export, or clear locally stored data from TraceGuard Settings. Contact the publisher through the Chrome Web Store listing for privacy questions.")}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-2">
        <Card>
          <CardContent className="flex gap-4 p-4">
            <ChartNoAxesColumn className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="mb-1 font-semibold">{t("Zero Telemetry")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("We don't collect usage statistics, analytics, or behavioral data.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex gap-4 p-4">
            <LaptopMinimal className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="mb-1 font-semibold">{t("Local Processing")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("All tracker detection and score calculations happen directly on your device.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex gap-4 p-4">
            <ClipboardX className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="mb-1 font-semibold">{t("No PII Collection")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("We detect when you type sensitive info to protect you, but we never read or save the actual content.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex gap-4 p-4">
            <SlidersHorizontal className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="mb-1 font-semibold">{t("Your Data, Your Control")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("You can easily review, export, or permanently delete all your stored data from the Settings page at any time.")}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
