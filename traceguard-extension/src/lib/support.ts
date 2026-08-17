// Centralized public support links.
// Keep these in one place so every "report an issue" entry point across the
// extension (popup, side panel, dashboard) points at the same destination.

export const ISSUES_URL =
  "https://github.com/luca-liceti/TraceGuard-Privacy-Extension/issues";

export function openIssues() {
  window.open(ISSUES_URL, "_blank");
}
