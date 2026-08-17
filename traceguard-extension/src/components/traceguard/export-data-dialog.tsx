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

import { exportAllData } from "@/lib/export"

export function ExportDataDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const { t } = useTranslation()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [exporting, setExporting] = useState(false)

    const reset = () => {
        setPassword("")
        setConfirmPassword("")
        setError("")
    }

    const handleExport = async () => {
        setError("")
        if (password.length > 0 && password.length < 8) {
            setError(t("The export password must be at least 8 characters."))
            return
        }
        if (password !== confirmPassword) {
            setError(t("Passwords do not match"))
            return
        }
        setExporting(true)
        try {
            await exportAllData(password.length > 0 ? password : null)
            onOpenChange(false)
            reset()
            toast.add({
                type: "success",
                title: t("Data Exported"),
                description: t("Your data has been exported."),
            })
        } catch (e) {
            console.error(e)
            toast.add({
                type: "error",
                title: t("Export Failed"),
                description: t("Could not export data. Please try again."),
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
                        {t("Export a JSON backup of all your data (optionally password-protected)")}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="export-password">{t("Encryption password (optional)")}</Label>
                        <Input
                            id="export-password"
                            type="password"
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("Leave blank to export without encryption")}
                        />
                    </div>

                    {password.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {t("Warning: without a password, this export contains your unencrypted browsing analysis in plaintext.")}
                        </p>
                    )}

                    {password.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="export-password-confirm">{t("Confirm password")}</Label>
                            <Input
                                id="export-password-confirm"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}
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
                    <Button onClick={handleExport} disabled={exporting}>
                        {t("Export")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
