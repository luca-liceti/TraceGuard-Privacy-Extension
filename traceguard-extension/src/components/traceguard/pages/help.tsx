import React, { useState } from "react"
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
  ExternalLink
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

export default function HelpPage() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // --- FAQ Data ---
  const faqData = [
    {
      category: t("Getting Started"),
      icon: <BookOpen className="w-5 h-5 text-primary" />,
      items: [
        {
          question: t("What is TraceGuard?"),
          answer: t("TraceGuard is a privacy extension that monitors websites for trackers, cookies, and other privacy risks. It assigns a safety score to each site you visit to help you browse more safely.")
        },
        {
          question: t("How does it work?"),
          answer: t("TraceGuard runs entirely in your browser. It inspects the requests made by websites, looking for known trackers and data collection scripts. It never sends your data to external servers.")
        },
        {
          question: t("Do I need to configure anything?"),
          answer: t("No! TraceGuard works out of the box. However, you can customize alert thresholds, privacy settings, and display options in the Settings menu.")
        }
      ]
    },
    {
      category: t("Privacy Scores"),
      icon: <ShieldCheck className="w-5 h-5 text-primary" />,
      items: [
        {
          question: t("What is UPS?"),
          answer: t("UPS stands for User Privacy Score. It represents your overall privacy health across all your browsing sessions. It starts at 100 and decreases when you visit risky sites or enter sensitive information on them.")
        },
        {
          question: t("What is WSS?"),
          answer: t("WSS stands for Website Safety Score. It is a score from 0 to 100 assigned to an individual website based on the trackers, cookies, and permissions it uses.")
        },
        {
          question: t("Why did my score drop?"),
          answer: t("Your UPS drops when you visit websites with low WSS scores, especially if you enter sensitive information (like passwords or credit card numbers) on those sites.")
        }
      ]
    },
    {
      category: t("Trackers & Cookies"),
      icon: <EyeOff className="w-5 h-5 text-primary" />,
      items: [
        {
          question: t("What counts as a tracker?"),
          answer: t("A tracker is a script that collects data about your browsing behavior. TraceGuard identifies known advertising, analytics, and fingerprinting scripts.")
        },
        {
          question: t("What does PII Detection do?"),
          answer: t("PII (Personally Identifiable Information) Detection warns you when you are about to submit sensitive data (like emails, phone numbers, or passwords) on a site that has a low safety score.")
        }
      ]
    },
    {
      category: t("Privacy Vault"),
      icon: <Lock className="w-5 h-5 text-primary" />,
      items: [
        {
          question: t("What is the Privacy Vault / PIN?"),
          answer: t("The Privacy Vault protects your TraceGuard data. Setting a PIN encrypts your logs and settings, ensuring that anyone with access to your computer cannot read your browsing history.")
        },
        {
          question: t("How does Auto-Lock work?"),
          answer: t("Auto-Lock automatically locks your vault after a period of inactivity. You can configure this duration in the Privacy & Security settings.")
        }
      ]
    },
    {
      category: t("Data & Privacy"),
      icon: <Database className="w-5 h-5 text-primary" />,
      items: [
        {
          question: t("Does TraceGuard send data anywhere?"),
          answer: t("Absolutely not. TraceGuard is designed with a strict zero-telemetry policy. All analysis happens locally on your device, and your data never leaves your browser.")
        },
        {
          question: t("What data is stored locally?"),
          answer: t("TraceGuard stores your settings, a log of detected trackers, your UPS history, and cached website safety scores to improve performance.")
        }
      ]
    }
  ]

  // --- Troubleshooting Data ---
  const troubleshootingData = [
    {
      problem: t("Trackers aren't being detected"),
      solution: t("Check that the extension is enabled. Note that some sites may not have trackers, or the page may not have fully loaded yet.")
    },
    {
      problem: t("My Privacy Score isn't updating"),
      solution: t("Your score updates after visiting new sites and interacting with them. Try browsing a few different sites and refreshing the dashboard.")
    },
    {
      problem: t("The extension slowed down my browser"),
      solution: t("You can disable aggressive scanning or adjust other performance-related options in Settings → Privacy & Security.")
    },
    {
      problem: t("A site is being incorrectly flagged"),
      solution: t("If you trust a site that is being flagged, you can add it to your Allowlist in Settings → Domain Lists. This will bypass scanning for that site.")
    },
    {
      problem: t("PII Detection isn't triggering"),
      solution: t("Ensure that PII Detection is enabled in Settings → Privacy & Security. It also only triggers on fields it identifies as sensitive on low-scored sites.")
    },
    {
      problem: t("I forgot my PIN / lost access to the vault"),
      solution: t("Because your data is encrypted, a lost PIN cannot be recovered. You must use 'Delete All Data' in Settings → Data to reset the extension to factory defaults.")
    }
  ]

  // --- Filter logic ---
  const filteredFaq = faqData.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0)

  const filteredTroubleshooting = troubleshootingData.filter(item => 
    item.problem.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.solution.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-12 max-w-5xl">
      {/* ── Section 1: Hero & Search ── */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">{t("Help & Documentation")}</h1>
        <p className="text-lg text-muted-foreground">
          {t("Everything you need to know about TraceGuard")}
        </p>
        <div className="max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder={t("Search for help, features, or troubleshooting...")} 
            className="pl-10 h-12 text-base rounded-full shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* ── Section 2: Quick Navigation Cards ── */}
      {!searchQuery && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
            onClick={() => scrollTo("faq-section")}
          >
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("Getting Started")}</CardTitle>
              <CardDescription>{t("Learn the basics of how TraceGuard protects you.")}</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
            onClick={() => scrollTo("troubleshooting-section")}
          >
            <CardHeader>
              <Wrench className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("Troubleshooting")}</CardTitle>
              <CardDescription>{t("Find solutions to common issues and errors.")}</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
            onClick={() => window.open("https://github.com/luca-liceti/TraceGuard-Privacy-Extension/issues", "_blank")}
          >
            <CardHeader>
              <MessageSquare className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{t("Report an Issue")}</CardTitle>
              <CardDescription>{t("Found a bug? Let us know on our GitHub page.")}</CardDescription>
            </CardHeader>
          </Card>
        </section>
      )}

      {/* ── Section 3: FAQ / How it Works ── */}
      {(filteredFaq.length > 0 || !searchQuery) && (
        <section id="faq-section" className="space-y-6 pt-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" /> {t("Frequently Asked Questions")}
            </h2>
            <p className="text-muted-foreground mt-1">{t("Learn how TraceGuard works and what your scores mean.")}</p>
          </div>
          
          <div className="grid gap-6">
            {filteredFaq.map((category, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {category.icon} {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <Accordion type="single" collapsible className="w-full">
                    {category.items.map((item, itemIdx) => (
                      <AccordionItem key={itemIdx} value={`faq-${idx}-${itemIdx}`}>
                        <AccordionTrigger className="text-left font-medium">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 4: Troubleshooting ── */}
      {(filteredTroubleshooting.length > 0 || !searchQuery) && (
        <section id="troubleshooting-section" className="space-y-6 pt-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="h-6 w-6" /> {t("Troubleshooting")}
            </h2>
            <p className="text-muted-foreground mt-1">{t("Common problems and their solutions.")}</p>
          </div>

          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full px-6">
                {filteredTroubleshooting.map((item, idx) => (
                  <AccordionItem key={idx} value={`troubleshoot-${idx}`}>
                    <AccordionTrigger className="text-left font-medium">
                      {item.problem}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {item.solution}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Section 5: Permission Transparency ── */}
      {!searchQuery && (
        <section className="space-y-6 pt-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" /> {t("Permission Transparency")}
            </h2>
            <p className="text-muted-foreground mt-1">
              {t("TraceGuard requires certain browser permissions to protect you. Here is exactly why we need them:")}
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex gap-4">
                  <Eye className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">{t("Read and change all your data on all websites")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("Required to scan the content of pages you visit to identify trackers, analyze scripts, and detect PII exposure in real-time.")}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <FileText className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">{t("Read your browsing history")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("Required to calculate and update your User Privacy Score (UPS) consistently across your browsing sessions.")}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Database className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">{t("Storage")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("Used to store your settings, activity logs, and score history locally on your device. This data is never sent to external servers.")}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t mt-6">
                <div className="bg-primary/10 p-4 rounded-lg flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-primary-foreground/90">
                    {t("TraceGuard operates entirely on your device. No data leaves your browser. Our code is open source and completely transparent.")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Section 6: Report an Issue Footer ── */}
      {!searchQuery && (
        <section className="pt-12 pb-8">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 text-center sm:text-left">
              <div>
                <h3 className="font-semibold text-lg">{t("Found a bug or have a suggestion?")}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("Help us improve TraceGuard by reporting issues on GitHub.")}
                </p>
              </div>
              <Button 
                onClick={() => window.open("https://github.com/luca-liceti/TraceGuard-Privacy-Extension/issues", "_blank")}
                className="shrink-0"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("Report an Issue")}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
      
      {/* Search empty state */}
      {searchQuery && filteredFaq.length === 0 && filteredTroubleshooting.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium">{t("No results found")}</h3>
          <p className="text-muted-foreground mt-1">
            {t("Try adjusting your search terms or browse the categories below.")}
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => setSearchQuery("")}
          >
            {t("Clear Search")}
          </Button>
        </div>
      )}
    </div>
  )
}
