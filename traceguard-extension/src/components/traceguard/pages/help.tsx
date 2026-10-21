import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BookOpen,
  Database,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MessageSquare,
  Search,
  Shield,
  ShieldCheck,
  Wrench,
  ExternalLink,
  PanelRight,
  Sparkles,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const ISSUE_URL = "https://github.com/luca-liceti/TraceGuard-Privacy-Extension/issues"

export default function HelpPage() {
  const { t } = useTranslation()
  const helpText: Record<string, any> = {
    intro: "Guides to TraceGuard's scores, settings, local data, and optional network features.",
    search: "Search help",
    searchPlaceholder: "Search help, scores, settings, or troubleshooting",
    topics: "Help topics",
    guides: "Guides & FAQs",
    guidesDescription: "Understand scores, detection, settings, and stored data.",
    troubleshootingDescription: "Find steps for common display, data, and model issues.",
    issueDescription: "Open the project's issue tracker in a new tab.",
    learn: "Learn what TraceGuard checks and what its results do and do not mean.",
    practical: "Practical checks for common problems.",
    permissionsDescription: "What the browser permissions are used for.",
    websiteAccess: "Website access",
    websiteAccessDescription: "Page access is used to inspect visible site signals, identify form field types, and observe resources needed for local analysis. TraceGuard does not save the text you enter.",
    tabs: "Tabs and side panel",
    tabsDescription: "Tab access follows the active site and opens the dashboard for setup or when you choose it. The sidePanel permission lets the extension show its side panel when selected.",
    localStorage: "Local storage",
    localStorageDescription: "Storage keeps settings, site analysis, activity records, and score history on this device. Vault data is encrypted after you set a Master Password.",
    optionalRequests: "Optional requests",
    optionalRequestsDescription: "Live Rating Lookup sends a site domain to ToS;DR when enabled. Local AI features send selected facts or, for a requested policy report, visible policy text to Ollama on your device.",
    moreHelp: "Need more help?",
    reportDescription: "Report a reproducible problem or suggest an improvement.",
    searchEmpty: "Try another search term or clear your search.",
    questions: {
      analyze: "What does TraceGuard analyze?",
      dashboard: "What is the difference between the dashboard and the side panel?",
      blocking: "Does TraceGuard block trackers or websites?",
      ups: "What is the Privacy Score (UPS)?",
      wss: "What is a site's safety score (WSS)?",
      scoreChange: "Why did my Privacy Score change?",
      missingRating: "Why is a site's privacy rating missing?",
      trackers: "What does tracker detection show?",
      vault: "What does the Privacy Vault protect?",
      stored: "What is stored on this device?",
      network: "Does TraceGuard send my browsing data to a server?",
      ai: "What is a local AI summary?",
      report: "How is a local policy report different from a rating?",
      blank: "The side panel or popup is blank",
      update: "My Privacy Score is not updating",
      wrong: "A site or tracker result looks wrong",
      liveLookup: "Live Rating Lookup cannot find a rating",
      model: "My local AI model is not available",
      password: "I forgot my Master Password",
    },
    answers: {
      analyze: "TraceGuard checks sites you visit for known trackers, cookies, form fields, browser security signals, and available community privacy-policy ratings. Results are estimates based on the signals available to the extension.",
      dashboard: "The side panel shows your current privacy score and the active site's details. The dashboard shows your history, trends, site rankings, and footprint summary. You can choose whether the extension icon opens the side panel or popup in Settings → Appearance.",
      blocking: "TraceGuard reports detected privacy and safety signals. It does not block trackers, requests, or websites.",
      ups: "The User Privacy Score (UPS) is about personal information you enter, not the safety of one website. It starts at 100, can drop when you enter sensitive data on a risky site, and recovers gradually as older events age.",
      wss: "The Website Safety Score (WSS) summarizes signals found for one site, such as trackers, cookies, form fields, reputation, and available privacy-policy ratings. Higher scores mean fewer risk signals in the checks available; it is not a guarantee that a site is safe.",
      scoreChange: "The score can fall when PII Detection identifies personal information entered on a site with a low safety score. Visiting a site alone does not lower the score. Older events gradually have less effect.",
      missingRating: "Community ratings are available only for services in the bundled ToS;DR data. You can enable Live Rating Lookup in Settings → Privacy to request a current rating by sending that site's domain to ToS;DR.",
      trackers: "TraceGuard matches observed scripts and resources against locally available tracker data. A detection is a signal that a resource is associated with tracking, not proof of what data it collected.",
      pii: "PII means personally identifiable information. Detection checks recognized form fields and can warn when sensitive information is entered on a site with a low safety score. TraceGuard does not read or save the text you type into a field.",
      vault: "Your master password encrypts private logs and other vault data stored by TraceGuard. The encryption key stays in temporary browser session storage while the vault is unlocked. If you forget the password, it cannot be recovered.",
      stored: "TraceGuard stores your settings, site analysis cache, detector logs, score history, and any enabled activity records in browser extension storage. Vault data is encrypted when the vault is set up. You can review, export, or delete stored data in Settings.",
      network: "Most checks run on this device using bundled data. Optional Live Rating Lookup sends a site's domain to ToS;DR. Optional local AI summaries send selected analysis facts to Ollama on your device. A local policy report sends policy-page text and its page address to your Ollama model only after you request it and enable the feature.",
      ai: "When enabled, a summary request sends selected site analysis facts to an Ollama service on your device. Overview summaries use aggregate counts and a limited list of site domains, visits, and scores. They do not send page text or sensitive field types. Ollama must be running and allow the extension origin.",
      report: "A local policy report is an optional, provisional estimate based on visible privacy-policy text sent to your local Ollama model after you request it. The model picks from a fixed list of cases and points at the sentence that supports each one; the score and grade come from those cases. The cases follow the idea of ToS;DR's taxonomy, but the report is generated locally and was not reviewed by ToS;DR. It is not a ToS;DR rating and never changes the site's score.",
      blank: "Reload the extension from the browser's Extensions page, then reopen the panel. If it stays blank, open Settings → About and copy diagnostics to help find the error.",
      update: "The score changes in response to recognized personal information entered on a risky site, and recovers gradually as older events age. Visiting sites alone does not change it. Check that PII Detection is enabled in Settings → Privacy.",
      wrong: "Detection depends on locally bundled lists and the signals visible to the extension. A missing tracker or rating does not prove there is no risk. Check when the site's analysis was last updated, and use Settings → About to copy diagnostics if the issue persists.",
      liveLookup: "Live Rating Lookup is optional and sends the site's domain to ToS;DR. Confirm it is enabled in Settings → Privacy, then retry on a service with a ToS;DR listing. A service without a community rating may still have no result.",
      model: "Start Ollama on this device, confirm the selected model is installed, and allow this extension's origin with OLLAMA_ORIGINS=chrome-extension://*, then restart Ollama. Open Settings → Privacy and use the refresh button beside the model list. For policy reports, use a model sized for the job: qwen3.5:9b is functional from 10 GB of GPU memory, gemma4:12b is better from 12 GB, and gemma4:26b is outstanding from 24 GB. The summary default qwen3.5:0.8b cannot do policy reports.",
      password: "The Master Password cannot be recovered. The reset option on the vault screen deletes the encrypted vault data so you can create a new one. Export anything you still need before resetting, if you can unlock the vault.",
    },      categories: {
      trackers: "Trackers & Personal Information",
      vault: "Privacy Vault & Stored Data",
      ai: "Optional Local AI",
    },
  }

  const [searchQuery, setSearchQuery] = useState("")
  const query = searchQuery.trim().toLocaleLowerCase()

  const faqData = useMemo(() => [
    {
      category: t("Getting Started"),
      icon: BookOpen,
      items: [
        {
          question: t(helpText.questions.analyze),
          answer: t(helpText.answers.analyze)
        },
        {
          question: t(helpText.questions.dashboard),
          answer: t(helpText.answers.dashboard)
        },
        {
          question: t(helpText.questions.blocking),
          answer: t(helpText.answers.blocking)
        }
      ]
    },
    {
      category: t("Privacy Scores"),
      icon: ShieldCheck,
      items: [
        {
          question: t(helpText.questions.ups),
          answer: t(helpText.answers.ups)
        },
        {
          question: t(helpText.questions.wss),
          answer: t(helpText.answers.wss)
        },
        {
          question: t(helpText.questions.scoreChange),
          answer: t(helpText.answers.scoreChange)
        },
        {
          question: t(helpText.questions.missingRating),
          answer: t(helpText.answers.missingRating)
        }
      ]
    },
    {
      category: t(helpText.categories.trackers),
      icon: EyeOff,
      items: [
        {
          question: t(helpText.questions.trackers),
          answer: t(helpText.answers.trackers)
        },
        {
          question: t(helpText.questions.pii),
          answer: t(helpText.answers.pii)
        }
      ]
    },
    {
      category: t(helpText.categories.vault),
      icon: Lock,
      items: [
        {
          question: t(helpText.questions.vault),
          answer: t(helpText.answers.vault)
        },
        {
          question: t(helpText.questions.stored),
          answer: t(helpText.answers.stored)
        },
        {
          question: t(helpText.questions.network),
          answer: t(helpText.answers.network)
        }
      ]
    },
    {
      category: t(helpText.categories.ai),
      icon: Sparkles,
      items: [
        {
          question: t(helpText.questions.ai),
          answer: t(helpText.answers.ai)
        },
        {
          question: t(helpText.questions.report),
          answer: t(helpText.answers.report)
        }
      ]
    }
  ], [t])

  const troubleshootingData = useMemo(() => [
    {
      problem: t(helpText.questions.blank),
      solution: t(helpText.answers.blank)
    },
    {
      problem: t(helpText.questions.update),
      solution: t(helpText.answers.update)
    },
    {
      problem: t(helpText.questions.wrong),
      solution: t(helpText.answers.wrong)
    },
    {
      problem: t(helpText.questions.liveLookup),
      solution: t(helpText.answers.liveLookup)
    },
    {
      problem: t(helpText.questions.model),
      solution: t(helpText.answers.model)
    },
    {
      problem: t(helpText.questions.password),
      solution: t(helpText.answers.password)
    }
  ], [t])

  const filteredFaq = faqData.map(category => ({
    ...category,
    items: category.items.filter(item =>
      `${item.question} ${item.answer} ${category.category}`.toLocaleLowerCase().includes(query)
    )
  })).filter(category => category.items.length > 0)

  const filteredTroubleshooting = troubleshootingData.filter(item =>
    `${item.problem} ${item.solution}`.toLocaleLowerCase().includes(query)
  )

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <section className="rounded-xl border bg-card p-6 md:p-8">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Help & Documentation")}</h1>
          <p className="text-muted-foreground">{t(helpText.intro)}</p>
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t(helpText.search)}
              placeholder={t(helpText.searchPlaceholder)}
              className="pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>
      </section>

      {!query && (
        <section aria-label={t(helpText.topics)} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button type="button" onClick={() => scrollTo("faq-section")} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <FileText className="mb-1 h-6 w-6 text-primary" />
                <CardTitle className="text-base">{t(helpText.guides)}</CardTitle>
                <CardDescription>{t(helpText.guidesDescription)}</CardDescription>
              </CardHeader>
            </Card>
          </button>
          <button type="button" onClick={() => scrollTo("troubleshooting-section")} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <Wrench className="mb-1 h-6 w-6 text-primary" />
                <CardTitle className="text-base">{t("Troubleshooting")}</CardTitle>
                <CardDescription>{t(helpText.troubleshootingDescription)}</CardDescription>
              </CardHeader>
            </Card>
          </button>
          <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <MessageSquare className="mb-1 h-6 w-6 text-primary" />
                <CardTitle className="text-base">{t("Report an Issue")}</CardTitle>
                <CardDescription>{t(helpText.issueDescription)}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        </section>
      )}

      {(filteredFaq.length > 0 || !query) && (
        <section id="faq-section" className="scroll-mt-6 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold"><FileText className="h-5 w-5 text-muted-foreground" />{t(helpText.guides)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(helpText.learn)}</p>
          </div>
          <div className="grid gap-4">
            {filteredFaq.map((category) => {
              const Icon = category.icon
              return (
                <Card key={category.category}>
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-primary" />{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item) => (
                        <AccordionItem key={item.question} value={item.question}>
                          <AccordionTrigger className="text-left font-medium">{item.question}</AccordionTrigger>
                          <AccordionContent className="leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {(filteredTroubleshooting.length > 0 || !query) && (
        <section id="troubleshooting-section" className="scroll-mt-6 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Wrench className="h-5 w-5 text-muted-foreground" />{t("Troubleshooting")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(helpText.practical)}</p>
          </div>
          <Card>
            <CardContent className="px-6 py-2">
              <Accordion type="single" collapsible className="w-full">
                {filteredTroubleshooting.map((item) => (
                  <AccordionItem key={item.problem} value={item.problem}>
                    <AccordionTrigger className="text-left font-medium">{item.problem}</AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">{item.solution}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>
      )}

      {!query && (
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Shield className="h-5 w-5 text-muted-foreground" />{t("Permission Transparency")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(helpText.permissionsDescription)}</p>
          </div>
          <Card>
            <CardContent className="grid gap-6 p-6 md:grid-cols-2">
              <div className="flex gap-3">
                <Eye className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><h3 className="font-medium">{t(helpText.websiteAccess)}</h3><p className="mt-1 text-sm text-muted-foreground">{t(helpText.websiteAccessDescription)}</p></div>
              </div>
              <div className="flex gap-3">
                <PanelRight className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><h3 className="font-medium">{t(helpText.tabs)}</h3><p className="mt-1 text-sm text-muted-foreground">{t(helpText.tabsDescription)}</p></div>
              </div>
              <div className="flex gap-3">
                <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><h3 className="font-medium">{t(helpText.localStorage)}</h3><p className="mt-1 text-sm text-muted-foreground">{t(helpText.localStorageDescription)}</p></div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><h3 className="font-medium">{t(helpText.optionalRequests)}</h3><p className="mt-1 text-sm text-muted-foreground">{t(helpText.optionalRequestsDescription)}</p></div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {!query && (
        <Card className="bg-muted/40">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-muted-foreground" />{t(helpText.moreHelp)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(helpText.reportDescription)}</p>
            </div>
            <Button asChild variant="outline">
              <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{t("Report an Issue")}</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {query && filteredFaq.length === 0 && filteredTroubleshooting.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground" />
            <div><h2 className="font-medium">{t("No results found")}</h2><p className="mt-1 text-sm text-muted-foreground">{t(helpText.searchEmpty)}</p></div>
            <Button variant="outline" onClick={() => setSearchQuery("")}>{t("Clear Search")}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
