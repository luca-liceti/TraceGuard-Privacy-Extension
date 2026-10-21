import { useTranslation } from "react-i18next"

/** Keeps the pre-React HTML placeholder and React loading states visually consistent. */
export function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="startup-loading" role="status">
      {t("Loading TraceGuard...")}
    </div>
  )
}
