# Local AI Privacy Analysis Integration

This plan outlines the architecture and steps required to integrate a local, on-device AI model into the TraceGuard Chrome extension. The primary goal is to automatically find, review, and score website Privacy Policies and Terms of Service (TOS) in the background, without requiring the user to manually trigger the analysis.

## User Review Required

> [!IMPORTANT]
> **AI Engine Selection:** We have two main paths for the AI engine. 
> 1. **Chrome's Built-in AI (Prompt API / Gemini Nano):** Built directly into modern Chrome. **It executes 100% locally and offline on the user's device.** Zero data is sent to external servers, perfectly aligning with TraceGuard's privacy-first design. It has zero download size for our extension, is incredibly fast, and very battery-friendly. **Highly Recommended as the primary engine.**
> 2. **Transformers.js (WebGPU):** A fallback for users on older Chrome versions or other Chromium browsers (Brave, Edge) that may not have Gemini Nano enabled. Requires downloading a ~1.5GB model (like Gemma 2B) to the browser. It also runs 100% locally.
> 
> *Recommendation:* Start by building the entire feature using **Chrome's Built-in AI (Prompt API)** since it is stable, native, and guarantees total on-device privacy. If we find it too restrictive, we can easily pivot to Transformers.js running in the Dashboard tab.

## Open Questions

> [!TIP]
> Please review and provide your thoughts on the following:

1. **Dashboard Tab Requirement:** If we use Transformers.js, are you 100% okay with the AI *only* analyzing new websites when the TraceGuard dashboard tab is open? (If we use Chrome's Built-in AI, it can run in the background anytime).
2. **Notification Fatigue:** If the AI finds a "Terrible" privacy policy in the background, how aggressive should we be? Should we inject a red warning banner on the website itself, or just update the extension badge (the little icon in the top right)?
3. **Caching:** If the AI scores `facebook.com` as an "F", should we save that score forever, or re-evaluate it every X months to see if their policy changed?

---

## Proposed Architecture & Implementation Steps

### 1. The "Auto-Finder" (Content Script)
This script runs silently on every website the user visits.
*   **Action:** Inject a lightweight script (`content.js`) that scans the DOM for `<a>` tags containing text like "Privacy Policy", "Terms", "TOS", or "Legal".
*   **Action:** If found, silently fetch the HTML of that specific link using the `fetch()` API.
*   **Action:** Parse the HTML to extract only the readable text (stripping out navbars, footers, and scripts) using a library like Readability.js or custom DOM parsing.
*   **Action:** Send the extracted text via `chrome.runtime.sendMessage` to the Background Service Worker.

### 2. The AI Engine (Service Worker / Dashboard)
This is the brain that processes the text.
*   **Action:** Add detection for `window.ai` (Chrome Prompt API).
*   **Action:** Construct the strict Prompt: *"Analyze this privacy policy. Grade it 1-100. Return exactly this JSON format: `{"score": number, "good": ["..."], "bad": ["..."], "terrible": ["..."]}`"*
*   **Action:** If the text is too long (some policies are massive), implement a chunking system to only send the most relevant sections (data sharing, retention, third-party sales) to the AI to prevent context-window overflow.
*   **Action:** Execute the prompt against the local AI model.

### 3. Data Storage (`chrome.storage.local`)
*   **Action:** Save the JSON result keyed by the website's root domain (e.g., `amazon.com: { score: 45, good: [...], ... }`).
*   **Action:** Add a timestamp to the entry so we know when it was last evaluated.

### 4. UI / UX Updates
*   **Popup UI (`popup.html`):** Update the popup to show the current site's AI Score immediately when clicked. If the score is pending, show a "Scanning..." skeleton loader.
*   **Dashboard UI:** Create a new "Site Ratings" or "TOS;DR" section in the dashboard where the user can view a history of all sites they've visited and their respective AI breakdowns. Use Shadcn components for clean, actionable lists.
*   **Extension Badge:** Dynamically change the extension icon's badge text/color based on the score (e.g., Red for < 40, Green for > 80).

---

## Verification Plan

### Automated/Unit Testing
*   Write mock HTML pages simulating various privacy policy layouts (e.g., standard links, hidden footer links, links within iframes).
*   Verify the Auto-Finder script successfully identifies and extracts text from these mocks.
*   Verify the AI Prompt consistently returns valid JSON (LLMs sometimes output conversational text before the JSON, which breaks parsing).

### Manual Verification
*   Visit 10 diverse websites (e.g., Reddit, a local news site, a Shopify store, Google).
*   Verify the extension silently grabs the policy, the AI processes it without crashing the browser tab, and the UI updates correctly with the TOS;DR format.
*   Verify resource usage (CPU/RAM spike during the few seconds of inference).
