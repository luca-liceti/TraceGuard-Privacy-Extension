import React from "react"
import { useTranslation } from "react-i18next"
import { Shield, Lock, EyeOff, Database } from "lucide-react"

export default function PrivacyPolicyPage() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-12 max-w-4xl">
      <section className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">{t("TraceGuard Privacy Policy")}</h1>
        <p className="text-sm text-muted-foreground border-b pb-4">
          {t("Effective date: August 3, 2026")}
        </p>
        
        <div className="space-y-6 text-base leading-relaxed text-muted-foreground">
          <p>
            {t("TraceGuard analyzes the pages you visit locally in your browser to provide privacy and website-safety scores. It stores analysis results, including domain names, timestamps, detector results, score history, settings, and PII ")}<strong>{t("field types")}</strong>{t(" that you choose to enter. It never reads, stores, or transmits the contents of form fields, passwords, cookie values, or other entered personal data.")}
          </p>
          
          <p>
            {t("TraceGuard is 100% local during browsing. On the update schedule selected in Settings, it downloads public tracker, cookie-list, and ToS;DR database updates from their published sources (raw.githubusercontent.com and easylist.to). Those update requests contain no browsing, account, or other user data. It does not use analytics, telemetry, advertising SDKs, or sell or share personal data. Analysis data is stored locally in Chrome extension storage; sensitive history is encrypted after the user unlocks the vault.")}
          </p>
          
          <p>
            {t("You can review, export, or clear locally stored data from TraceGuard Settings. Contact the publisher through the Chrome Web Store listing for privacy questions.")}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t">
        <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
          <Shield className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">{t("Zero Telemetry")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("We don't collect usage statistics, analytics, or behavioral data.")}
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
          <Lock className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">{t("Local Processing")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("All tracker detection and score calculations happen directly on your device.")}
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
          <EyeOff className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">{t("No PII Collection")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("We detect when you type sensitive info to protect you, but we never read or save the actual content.")}
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
          <Database className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">{t("Your Data, Your Control")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("You can easily review, export, or permanently delete all your stored data from the Settings page at any time.")}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
