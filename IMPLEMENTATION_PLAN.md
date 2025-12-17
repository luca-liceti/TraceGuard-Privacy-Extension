# WXT Migration & Architecture Improvements

## Overview

Migrate TraceGuard from Vite+CRXJS to WXT framework, add Zod type-safe messaging, and improve UI/UX with professional grid layouts.

**Current State:**
- ✅ TypeScript strict mode (already enabled)
- ✅ Tailwind CSS (already installed)
- ✅ shadcn/ui components (already using Radix primitives)
- ❌ Uses Vite + @crxjs/vite-plugin (needs migration to WXT)
- ❌ No Zod for messaging (needs implementation)

---

## User Review Required

> [!IMPORTANT]
> **This is a significant migration.** WXT restructures the entire project directory. The migration will:
> - Create a new WXT project structure
> - Migrate all existing React components
> - Update build configuration
> - Add Zod message schemas

> [!WARNING]
> **Breaking Change:** The project directory structure will change significantly. Recommend creating a backup before proceeding.

---

## Proposed Changes

### Phase 1: WXT Migration

#### Create New WXT Project Structure

WXT uses a different file organization:
```
traceguard-extension/
├── wxt.config.ts           (WXT config - replaces vite.config.ts)
├── entrypoints/
│   ├── background.ts       (service worker)
│   ├── content.ts          (content script)
│   ├── popup/              (popup UI)
│   │   ├── index.html
│   │   └── main.tsx
│   ├── sidepanel/          (side panel UI)
│   │   ├── index.html
│   │   └── main.tsx
│   └── dashboard.html/     (dashboard page)
├── components/             (shared React components)
├── lib/                    (utilities, Zod schemas)
├── assets/                 (icons, static files)
└── public/                 (public assets)
```

#### [NEW] wxt.config.ts
WXT configuration with React and Tailwind support.

#### [MODIFY] package.json
- Remove: `@crxjs/vite-plugin`, `vite-plugin-static-copy`
- Add: `wxt`, `zod`
- Update: scripts to use WXT commands

---

### Phase 2: Zod Type-Safe Messaging

#### [NEW] lib/messages.ts
Zod schemas for all message types:
- `CHECK_REPUTATION`, `CHECK_SAFE_BROWSING`, `CHECK_TOSDR`
- `PAGE_ANALYSIS_RESULT`, `PII_DETECTED`
- `SETTINGS_CHANGED`, `SHOW_TOAST`

#### [MODIFY] entrypoints/background.ts
Use Zod to validate incoming messages.

#### [MODIFY] entrypoints/content.ts
Use Zod to validate outgoing/incoming messages.

---

### Phase 3: UI/UX Grid Improvements

#### [MODIFY] sidepanel/App.tsx
- Apply CSS grid for card layout
- Ensure consistent spacing

#### [MODIFY] Dashboard pages
- Standardize grid layouts across all pages
- Improve navigation consistency

---

## Verification Plan

### Automated Tests
No existing tests found. Recommend adding Vitest after migration:
```bash
npm run test
```

### Manual Verification
After migration, test in browser:
1. Load unpacked extension from `dist/` folder
2. Verify popup opens correctly
3. Verify sidepanel displays scores
4. Verify dashboard navigation works
5. Check console for Zod validation logs

---

## Questions for User

1. **Backup approach**: Should I create a backup folder before migrating, or do you have version control (git)?

2. **Scope preference**: Would you prefer:
   - **Option A**: Full WXT migration (recommended, cleaner architecture)
   - **Option B**: Keep Vite, just add Zod messaging (smaller change)

3. **UI Grid specifics**: Any particular dashboard pages that need priority for grid layout fixes?
