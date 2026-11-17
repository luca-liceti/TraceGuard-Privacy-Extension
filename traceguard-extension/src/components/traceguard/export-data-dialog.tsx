"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "@/components/ui/toast"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { exportAllData } from "@/lib/export"
import { captureError } from "@/lib/diagnostics"
import { verifyVaultPassword } from "@/lib/vault-password"

export function ExportDataDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const { t } = useTranslation()
    const [encrypt, setEncrypt] = useState(true)
    const [vaultPassword, setVaultPassword] = useState("")
    const [error, setError] = useState("")
    const [exporting, setExporting] = useState(false)

    const reset = () => {
        setEncrypt(true)
        setVaultPassword("")
        setError("")
    }

    const handleExport = async () => {
        setError("")
        if (!vaultPassword) {
            setError(t("Enter your vault password to confirm the export."))
            return
        }

        setExporting(true)
        try {
            // Verify the password the vault already knows, rather than accepting
            // a separate password that proves nothing about who is exporting.
            const verification = await verifyVaultPassword(vaultPassword)
            if (!verification.ok) {
                setError(verification.reason === "not-set-up"
                    ? t("Vault not set up.")
                    : t("Incorrect vault password."))
                return
            }

            await exportAllData(encrypt ? vaultPassword : null, verification.key)
            onOpenChange(false)
            reset()
            toast.add({
                type: "success",
                title: t("Data Exported"),
                description: encrypt
                    ? t("Your data has been exported and can be restored with your vault password.")
                    : t("Your data has been exported in plaintext."),
            })
        } catch (e) {
            captureError('dashboard', e, 'export_failed')
            const message = e instanceof Error ? e.message : t("Could not export data. Please try again.")
            setError(message)
            toast.add({
                type: "error",
                title: t("Export Failed"),
                description: message,
                priority: "high",
            })
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset()
                onOpenChange(next)
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("Export Data")}</DialogTitle>
                    <DialogDescription>
                        {t("Export a JSON backup of all your data. It is encrypted with your vault password by default.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                        <div className="min-w-0 space-y-0.5">
                            <Label htmlFor="export-encrypt" className="text-sm font-medium">
                                {t("Encrypt backup")}
                            </Label>
                            <p className="break-words text-sm text-muted-foreground">
                                {t("Recommended. The file cannot be read without your vault password.")}
                            </p>
                        </div>
                        <Switch
                            id="export-encrypt"
                            checked={encrypt}
                            onCheckedChange={(checked) => {
                                setEncrypt(checked)
                                setError("")
                            }}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="export-vault-password">{t("Vault password")}</Label>
                        <Input
                            id="export-vault-password"
                            type="password"
                            autoComplete="current-password"
                            autoFocus
                            value={vaultPassword}
                            onChange={(e) => {
                                setVaultPassword(e.target.value)
                                setError("")
                            }}
                            placeholder={t("Enter your vault password")}
                        />
                        <p className="break-words text-sm text-muted-foreground">
                            {encrypt
                                ? t("The backup is encrypted with this password.")
                                : t("Required to confirm. A plaintext backup is not encrypted.")}
                        </p>
                    </div>

                    {!encrypt && (
                        <p className="break-words rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                            {t("Without encryption, this file contains your browsing analysis in plaintext. Anyone who opens it can read it.")}
                        </p>
                    )}

                    {error && <p className="break-words text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false)
                            reset()
                        }}
                    >
                        {t("Cancel")}
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={exporting}
                        variant={encrypt ? "default" : "outline"}
                    >
                        {encrypt ? t("Export") : t("Export unencrypted")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
