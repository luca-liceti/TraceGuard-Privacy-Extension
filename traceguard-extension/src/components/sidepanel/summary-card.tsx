import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PendingLabel } from '@/components/ui/pending'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSettings } from '@/lib/useStorage'
import { logEvent } from '@/lib/diagnostics'
import { summarizeWithOllama, type OllamaSummaryError } from '@/lib/ai/ollama'
import type { SummaryRequest, SummaryResult } from '@/lib/ai/types'

export function SummaryCard({ request }: { request: SummaryRequest | null }) {
    const { t } = useTranslation()
    const settings = useSettings()
    const [summary, setSummary] = useState<SummaryResult | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [summaryKey, setSummaryKey] = useState('')
    const currentKey = request ? JSON.stringify(request.facts) : ''

    if (!settings?.enableLocalSummaries || !request) return null

    const generate = async () => {
        setBusy(true)
        setError('')
        try {
            const result = await summarizeWithOllama(request, settings.localSummaryModel ?? '')
            setSummary(result)
            setSummaryKey(currentKey)
        } catch (caught) {
            const message = (caught as OllamaSummaryError).message || t('The local summary could not be created.')
            setError(message)
            logEvent('ui', 'warn', 'ai_summary_ui_failed', 'The summary card could not produce a checked summary', {
                subject: request.subject,
                error: message,
            })
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card className="mb-3 border-primary/20">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">{t('On-device summary')}</CardTitle>
                <CardDescription className="text-xs">
                    {t('Uses stored findings and browsing patterns. Checks for invented details. Runs only through Ollama on this device. Form entries mean typing began, not that data was submitted.')}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
                {summary && summaryKey === currentKey && (
                    <div className="rounded-md bg-muted/40 p-3 text-sm" aria-live="polite">
                        <p>{summary.text}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t('Model: {{model}} · {{time}}', {
                                model: summary.model,
                                time: new Date(summary.generatedAt).toLocaleTimeString(),
                            })}
                        </p>
                    </div>
                )}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
                    {busy
                        ? <PendingLabel label={t('Creating summary…')} />
                        : summary && summaryKey === currentKey ? t('Refresh summary') : t('Create summary')}
                </Button>
            </CardContent>
        </Card>
    )
}
