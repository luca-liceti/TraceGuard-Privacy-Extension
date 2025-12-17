# TraceGuard Dashboard UI/UX Refactor Plan

> **Created**: December 16, 2025  
> **Status**: Planning Phase  
> **Last Updated**: December 16, 2025

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope of Changes](#scope-of-changes)
3. [New Features](#new-features)
4. [Page-by-Page Specifications](#page-by-page-specifications)
5. [Component Specifications](#component-specifications)
6. [Implementation Order](#implementation-order)
7. [File Changes Required](#file-changes-required)
8. [Testing Checklist](#testing-checklist)

---

## 📊 Executive Summary

### Goals
- Create a new **Overview** landing page with highlight tiles linking to detail pages
- Implement a **functional notification system** (storage + UI dropdown)
- Add **global search** for pages and content
- **Redesign Settings** page with horizontal tabs (remove internal sidebar)
- **Remove Privacy Mode toggle** from top-nav entirely
- Add placeholder **Integrations** page for post-MVP
- Maintain consistency with **neutral shadcn theme** (OKLCH colors)

### Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Overview tile click behavior | Navigate to detail page | Most intuitive, matches standard dashboard patterns |
| Settings layout | Horizontal tabs | Removes visual conflict with main sidebar |
| Notification system | Real-time events | Instant feedback for high-risk sites, PII detection |
| Search scope | Pages + content | Comprehensive search across sites, logs, settings |
| Privacy Mode toggle | Remove entirely | Reduces clutter, feature can be added post-MVP if needed |

---

## 🔄 Scope of Changes

### Pages to Create (New)
| Page | Route | Description |
|------|-------|-------------|
| Overview | `/overview` (new default) | Landing page with highlight tiles |
| Integrations | `/integrations` | Placeholder for post-MVP integrations |

### Pages to Modify
| Page | Changes |
|------|---------|
| Settings | Replace sidebar with horizontal tabs |
| Website Safety | Add summary banner, tabbed filtering |
| Sites Analyzed | Combine stats, add quick actions |
| Trackers | Replace pie chart with progress bars |
| Activity Logs | Compact stats, timeline view option |
| Whitelist/Blacklist | Tabbed interface, collapsible info |

### Pages to Keep (Minor Tweaks Only)
| Page | Changes |
|------|---------|
| Privacy Score | Add "This Week vs Last Week" comparison |

### Components to Create
| Component | Location | Description |
|-----------|----------|-------------|
| NotificationDropdown | `components/traceguard/notifications.tsx` | Dropdown for top-nav |
| SearchCommand | `components/traceguard/search-command.tsx` | Global search dialog |
| OverviewTile | `components/traceguard/overview-tile.tsx` | Clickable metric card |
| SettingsTabs | Used in Settings page | Horizontal tab navigation |

### Components to Modify
| Component | Changes |
|-----------|---------|
| TopNav | Remove Privacy Mode, add functional notifications, add search |
| Sidebar | Rename "Dashboard" to "Overview", add Integrations link |
| Layout | No changes needed |

---

## ✨ New Features

### 1. Notification System

#### Storage Schema Addition
```typescript
// Add to types.ts
export interface NotificationEvent {
    id: string;
    timestamp: number;
    type: 'high_risk_site' | 'pii_detected' | 'tracker_alert' | 'daily_summary' | 'info';
    title: string;
    message: string;
    domain?: string;
    severity: 'critical' | 'warning' | 'info';
    read: boolean;
    actionUrl?: string; // Route to navigate on click
}

// Add to StorageSchema
notifications?: NotificationEvent[];
```

#### Storage Helper Methods
```typescript
// Add to storage.ts
addNotification: async (notification: Omit<NotificationEvent, 'id' | 'timestamp' | 'read'>): Promise<void>
getUnreadCount: async (): Promise<number>
markAsRead: async (id: string): Promise<void>
markAllAsRead: async (): Promise<void>
getNotifications: async (limit?: number): Promise<NotificationEvent[]>
clearNotifications: async (): Promise<void>
```

#### Notification Triggers (Background Script)
| Trigger | Notification Type | Severity |
|---------|------------------|----------|
| Site with WRS ≥ 80 visited | `high_risk_site` | critical |
| Site with WRS ≥ 60 visited | `high_risk_site` | warning |
| Sensitive PII detected (HIGH) | `pii_detected` | critical |
| PII detected (MEDIUM) | `pii_detected` | warning |
| High tracking site | `tracker_alert` | warning |

### 2. Global Search

#### Search Scope
| Category | Searchable Content |
|----------|-------------------|
| Pages | Overview, Privacy Score, Website Safety, etc. |
| Sites | Domain names from siteCache |
| Logs | Domain names from detectorLogs |
| Settings | Setting labels and descriptions |

#### Implementation
- Use shadcn `Command` component (already exists in UI)
- Trigger with `Ctrl+K` / `Cmd+K` keyboard shortcut
- Show in a dialog/modal overlay
- Group results by category

### 3. Integrations Page (Placeholder)

#### Purpose
Placeholder page for post-MVP extension integrations (password managers, VPNs, etc.)

#### Content
- Header with title and description
- "Coming Soon" message with illustration
- List of planned integrations (placeholder items)
- Optional: Email signup for notifications

---

## 📄 Page-by-Page Specifications

### Overview Page (NEW - Landing Page)

#### Route
- Change default route from `/dashboard` to `/overview`
- Redirect `/` → `/overview`
- Keep `/dashboard` as alias for backward compatibility

#### Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  Overview                                                           │
│  Your privacy and security at a glance                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🛡️ Privacy Score - Hero Card (Full Width)                   │    │
│  │     Score: 85/100  |  Status: GOOD  |  Trend: ▲ +5 pts     │    │
│  │     "Your privacy is well protected"                        │    │
│  │                                         [View Details →]    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 🌐 Website     │  │ 📊 Sites       │  │ 🎯 Trackers    │        │
│  │    Safety      │  │    Analyzed    │  │                │        │
│  │   15 avg WRS   │  │    156 total   │  │   47 detected  │        │
│  │   3 high risk  │  │ [View →]       │  │   8 high-track │        │
│  │ [View →]       │  └────────────────┘  │ [View →]       │        │
│  └────────────────┘                      └────────────────┘        │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ 📝 Activity    │  │ 📋 Whitelist   │  │ 🔗 Integrations│        │
│  │    Logs        │  │   /Blacklist   │  │                │        │
│  │   12 today     │  │   5 trusted    │  │   Coming Soon  │        │
│  │   3 high-risk  │  │   2 blocked    │  │                │        │
│  │ [View →]       │  │ [View →]       │  │ [View →]       │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔔 Recent Notifications                                     │    │
│  │ ─────────────────────────────────────────────────────────── │    │
│  │ 🔴 High-risk site: suspicious-site.com          · 2 min ago │    │
│  │ 🟡 PII detected: Email on form.com              · 1 hr ago  │    │
│  │ 🟢 Daily summary: 12 sites analyzed             · 3 hrs ago │    │
│  │                                            [View All →]     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

#### Tile Specifications
Each tile should:
1. Have a **colored left border** indicating status:
   - `border-l-green-500` for good/low risk
   - `border-l-yellow-500` for warning/medium
   - `border-l-red-500` for critical/high risk
   - `border-l-primary` for neutral/informational

2. Be **fully clickable** (entire card navigates)

3. Show:
   - Icon + Title
   - Primary metric (large)
   - Secondary context (small)
   - Subtle "View →" affordance

#### Component Props
```typescript
interface OverviewTileProps {
    title: string;
    icon: LucideIcon;
    value: string | number;
    subtitle: string;
    href: string;
    status?: 'success' | 'warning' | 'danger' | 'neutral';
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: string;
    };
}
```

---

### Settings Page (Redesign)

#### Layout Change
**Before**: Internal sidebar + content area  
**After**: Horizontal tabs + full-width content

#### Tab Structure
| Tab | Content |
|-----|---------|
| General | Display Mode + Appearance (combined) |
| Notifications | Notification Level |
| Privacy | PII Detection, Tracker Blocking, WRS Threshold |
| Data | Data Retention + Clear Data (combined) |
| About | Extension Information |

#### Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  Settings                                                           │
│  Configure your TraceGuard preferences                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┬──────────────┬─────────┬────────┬─────────┐           │
│  │ General │ Notifications │ Privacy │  Data  │  About  │           │
│  └─────────┴──────────────┴─────────┴────────┴─────────┘           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │  Display Mode                                                 │   │
│  │  ───────────────────────────────────────────────────────────  │   │
│  │  Extension Display                              [Dropdown ▼]  │   │
│  │  Choose how TraceGuard opens                                  │   │
│  │                                                               │   │
│  │  Theme                                                        │   │
│  │  ───────────────────────────────────────────────────────────  │   │
│  │  Color Theme                                    [Dropdown ▼]  │   │
│  │  Choose your preferred appearance                             │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   [Reset to Defaults]  [Save Changes]         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

#### Setting Row Pattern
```tsx
<div className="flex items-center justify-between py-4 border-b last:border-0">
    <div className="space-y-0.5">
        <Label>Setting Name</Label>
        <p className="text-sm text-muted-foreground">Description text</p>
    </div>
    <ControlElement />
</div>
```

---

### Integrations Page (NEW - Placeholder)

#### Route
`/integrations`

#### Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  Integrations                                                       │
│  Connect TraceGuard with your favorite tools                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                               │   │
│  │                      🔗                                       │   │
│  │                                                               │   │
│  │              Coming Soon                                      │   │
│  │                                                               │   │
│  │    We're working on exciting integrations to enhance          │   │
│  │    your privacy protection experience.                        │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Planned Integrations                                          │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │                                                               │   │
│  │  🔐 Password Managers          [Coming Soon]                  │   │
│  │     1Password, Bitwarden, LastPass                           │   │
│  │                                                               │   │
│  │  🛡️ VPN Services                [Coming Soon]                  │   │
│  │     NordVPN, ExpressVPN, ProtonVPN                           │   │
│  │                                                               │   │
│  │  📧 Email Aliases               [Coming Soon]                  │   │
│  │     SimpleLogin, Firefox Relay                               │   │
│  │                                                               │   │
│  │  🔒 Browser Security            [Coming Soon]                  │   │
│  │     uBlock Origin, Privacy Badger                            │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Specifications

### NotificationDropdown

#### Location
`src/components/traceguard/notifications.tsx`

#### Props
```typescript
interface NotificationDropdownProps {
    // Uses internal state from storage
}
```

#### Features
- Shows unread count badge
- Dropdown with recent notifications
- Mark individual/all as read
- Click notification to navigate to relevant page
- "View All" link to full notifications view (optional future page)

#### UI
```tsx
<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-2">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 ...">
                    {unreadCount}
                </Badge>
            )}
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between">
            Notifications
            <Button variant="ghost" size="sm">Mark all read</Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map(notification => (
            <DropdownMenuItem key={notification.id}>
                {/* Notification item */}
            </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>View all notifications</DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
```

---

### SearchCommand

#### Location
`src/components/traceguard/search-command.tsx`

#### Implementation
Uses shadcn `Command` component in a `Dialog`.

#### Features
- Keyboard shortcut: `Ctrl+K` / `Cmd+K`
- Search categories:
  - Pages (quick navigation)
  - Sites (from siteCache)
  - Activity (from detectorLogs)
- Real-time filtering
- Navigate on selection

#### UI
```tsx
<CommandDialog open={open} onOpenChange={setOpen}>
    <CommandInput placeholder="Search pages, sites, logs..." />
    <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
            <CommandItem>Overview</CommandItem>
            <CommandItem>Privacy Score</CommandItem>
            ...
        </CommandGroup>
        <CommandGroup heading="Sites">
            {/* Filtered sites */}
        </CommandGroup>
    </CommandList>
</CommandDialog>
```

---

### OverviewTile

#### Location
`src/components/traceguard/overview-tile.tsx`

#### Props
```typescript
interface OverviewTileProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string | number;
    subtitle: string;
    href: string;
    status?: 'success' | 'warning' | 'danger' | 'neutral';
    trend?: {
        direction: 'up' | 'down' | 'stable';
        value: string;
    };
}
```

#### Implementation
```tsx
export function OverviewTile({ title, icon: Icon, value, subtitle, href, status = 'neutral', trend }: OverviewTileProps) {
    const statusColors = {
        success: 'border-l-green-500',
        warning: 'border-l-yellow-500',
        danger: 'border-l-red-500',
        neutral: 'border-l-primary'
    };

    return (
        <Link to={href}>
            <Card className={`border-l-4 ${statusColors[status]} hover:bg-accent transition-colors cursor-pointer`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{value}</div>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                    {trend && (
                        <div className="flex items-center gap-1 mt-1">
                            {trend.direction === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                            {trend.direction === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                            <span className="text-xs text-muted-foreground">{trend.value}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
```

---

## 📋 Implementation Order

### Phase 1: Foundation (High Priority)
| # | Task | Files Affected |
|---|------|----------------|
| 1.1 | Add notification types to `types.ts` | `src/lib/types.ts` |
| 1.2 | Add notification storage methods to `storage.ts` | `src/lib/storage.ts` |
| 1.3 | Create `useNotifications` hook | `src/lib/useStorage.ts` |
| 1.4 | Update background script to create notifications | `src/background/index.ts` |

### Phase 2: New Components
| # | Task | Files Affected |
|---|------|----------------|
| 2.1 | Create `OverviewTile` component | `src/components/traceguard/overview-tile.tsx` |
| 2.2 | Create `NotificationDropdown` component | `src/components/traceguard/notifications.tsx` |
| 2.3 | Create `SearchCommand` component | `src/components/traceguard/search-command.tsx` |

### Phase 3: New Pages
| # | Task | Files Affected |
|---|------|----------------|
| 3.1 | Create Overview page | `src/components/traceguard/pages/overview.tsx` |
| 3.2 | Create Integrations page | `src/components/traceguard/pages/integrations.tsx` |
| 3.3 | Update routes in App.tsx | `src/dashboard/App.tsx` |

### Phase 4: Component Updates
| # | Task | Files Affected |
|---|------|----------------|
| 4.1 | Update TopNav (remove Privacy Mode, add notifications, search) | `src/components/traceguard/top-nav.tsx` |
| 4.2 | Update Sidebar (rename Dashboard → Overview, add Integrations) | `src/components/traceguard/sidebar.tsx` |

### Phase 5: Page Redesigns
| # | Task | Files Affected |
|---|------|----------------|
| 5.1 | Redesign Settings page (horizontal tabs) | `src/components/traceguard/pages/settings.tsx` |
| 5.2 | Refine Privacy Score page (minor tweaks) | `src/components/traceguard/pages/privacy-score.tsx` |
| 5.3 | Redesign Website Safety page | `src/components/traceguard/pages/website-safety.tsx` |
| 5.4 | Redesign Sites Analyzed page | `src/components/traceguard/pages/sites-analyzed.tsx` |
| 5.5 | Redesign Trackers page | `src/components/traceguard/pages/trackers.tsx` |
| 5.6 | Redesign Activity Logs page | `src/components/traceguard/pages/activity-logs.tsx` |
| 5.7 | Redesign Whitelist/Blacklist page | `src/components/traceguard/pages/whitelist-blacklist.tsx` |

### Phase 6: Cleanup
| # | Task | Files Affected |
|---|------|----------------|
| 6.1 | Remove old `content.tsx` (replaced by Overview) | `src/components/traceguard/content.tsx` |
| 6.2 | Final testing and polish | All pages |

---

## 📁 File Changes Required

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/traceguard/overview-tile.tsx` | Reusable tile component for Overview |
| `src/components/traceguard/notifications.tsx` | Notification dropdown component |
| `src/components/traceguard/search-command.tsx` | Global search dialog |
| `src/components/traceguard/pages/overview.tsx` | New Overview landing page |
| `src/components/traceguard/pages/integrations.tsx` | Placeholder Integrations page |

### Files to Modify
| File | Changes |
|------|---------|
| `src/lib/types.ts` | Add `NotificationEvent` interface, update `StorageSchema` |
| `src/lib/storage.ts` | Add notification storage methods |
| `src/lib/useStorage.ts` | Add `useNotifications` hook |
| `src/background/index.ts` | Trigger notifications on events |
| `src/dashboard/App.tsx` | Update routes, add Overview and Integrations |
| `src/components/traceguard/top-nav.tsx` | Remove Privacy Mode, add notifications + search |
| `src/components/traceguard/sidebar.tsx` | Update menu items |
| `src/components/traceguard/pages/settings.tsx` | Complete redesign with tabs |
| Other page files | Various improvements |

### Files to Delete (Optional)
| File | Reason |
|------|--------|
| `src/components/traceguard/content.tsx` | Replaced by `overview.tsx` |

---

## ✅ Testing Checklist

### Functionality Tests
- [ ] Notifications appear when visiting high-risk sites
- [ ] Notifications appear on PII detection
- [ ] Notification badge updates in real-time
- [ ] Search finds pages correctly
- [ ] Search finds sites from siteCache
- [ ] All Overview tiles navigate to correct pages
- [ ] Settings tabs work correctly
- [ ] Settings save/reset functions work
- [ ] All routing works (including redirects)

### Visual Tests
- [ ] Light theme consistency across all pages
- [ ] Dark theme consistency across all pages
- [ ] Responsive layout on mobile
- [ ] Responsive layout on tablet
- [ ] All cards have consistent styling
- [ ] All buttons have correct hover states
- [ ] Loading states display correctly
- [ ] Empty states display correctly

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Search shortcut (Ctrl+K) works
- [ ] Focus states visible
- [ ] Color contrast sufficient

---

## 📝 Notes

### Design Principles
1. **Consistency**: All tiles, cards, and buttons follow same patterns
2. **Clarity**: Clear hierarchy, obvious CTAs
3. **Efficiency**: Minimize clicks to reach information
4. **Responsiveness**: Works on all screen sizes

### Theme Colors (Reference)
- Primary: `--primary` (neutral dark/light)
- Success: `text-green-500`
- Warning: `text-yellow-500`
- Danger: `text-red-500`
- Info: `text-blue-500`
- Muted: `text-muted-foreground`

### Border Patterns
```tsx
// Status borders
<Card className="border-l-4 border-l-green-500">  // Success
<Card className="border-l-4 border-l-yellow-500"> // Warning
<Card className="border-l-4 border-l-red-500">    // Danger
<Card className="border-l-4 border-l-primary">    // Neutral
```
