# TraceGuard v2: The Rebirth Blueprint

**Project Path:** `/home/luca/Documents/Github Projects/TraceGuard-Privacy-Extension/traceguard-extension`

We are rebuilding TraceGuard from the ground up. This is not just a fresh coat of paint; we are auditing the very mechanisms that power the extension, keeping the brilliant concepts that work, and rewriting the flawed architectures that limit its potential.

---

## 🔬 Core Mechanism & Algorithm Rebirth

### 1. The New Scoring Philosophy (WSS)
The rigid 6-point static system is being updated to a 5-point static system. We are **removing the Protocol (HTTPS)** check, as modern browsers enforce this by default. 
The new static weights will be redistributed proportionally across the remaining 5 detectors:
- **Reputation (30%)**: Is this domain on any blacklists or malware databases?
- **Tracking (30%)**: Heavily penalizes malicious/fingerprinting trackers over standard analytics.
- **Cookies (20%)**: Are there third-party tracking or advertising cookies?
- **Inputs (15%)**: Are there sensitive fields like passwords or credit cards?
- **Policy (5%)**: What does the privacy policy say (according to ToS;DR)?

### 2. Algorithmic Upgrades
- **Habit-Based Healing**: The User Privacy Score (UPS) will *not* heal over time. It requires active "good habits" (visiting safe sites) to recover from a PII penalty.
- **Asymmetric Reputation Caching**: "Safe" domains will be cached for 7 days to optimize API calls, while "Dangerous" domains will only be cached for 24 hours to allow for remediation.
- **Zero-Day Suspicion**: Brand new domains (registered recently) will be treated with suspicion and their Reputation score capped at 70, preventing phishing domains from getting a perfect 100 default score.
- **Tracker Severity**: The algorithm will differentiate between tracker types, applying massive penalties to malicious fingerprinting scripts and lighter penalties to standard analytics.

---

## ⚙️ The New Architectural Mechanics

### 1. Data Retention & The Infinite Log Engine
We are replacing the naive 100-item array slice with a robust Time-Series Logging Engine.
- **Data Tiers**: Users can configure retention in Settings: `0 Days (Incognito)`, `30 Days (Standard)`, or `Max Memory (Infinite)`.
- **Chunking Algorithm**: The background script will store logs in monthly chunks (e.g., `history_2026_07`).
- **Aggregation**: For Dashboard Line Charts, the background script will aggregate raw visits into daily statistics.

### 2. The Notification Inbox System
- We will implement a structured Notification Queue with `isRead` flags, managed in the Top Nav Inbox Dropdown.

---

## 🎨 UI/UX Rebirth (The Shadcn "Nova" Aesthetic)

We are building a **1-to-1 visual replica of the hero components featured on the main page of ui.shadcn.com**. 

### Visual Language
- **Style**: Shadcn "Nova" (Sharp, precise, technical).
- **Theme**: Pure "Neutral" grayscale (Black/White/Zinc).
- **Typography**: Geist font (geist-sans/mono) strictly adhering to 400/500 weights.
- **Icons**: Lucide React.
- **Shield Logo**: Converted to strict black/white monochrome.

### Information Architecture

#### 1. The Global Command Menu (`Cmd+K`)
- A centralized search modal that pops up and heavily blurs the background.

#### 2. The Popup (Micro View)
- Header: Monochrome TraceGuard logo on left, Theme Toggle on right.
- Body: Massive WSS score, immediate 3-line breakdown, and an "Open Dashboard" button.

#### 3. The Dashboard (Macro View)
- **Layout**: Left-hand Sidebar for primary tabs (Overview, Activity, Settings).
- **Top Nav**: Global Command Trigger, Notification Inbox.
- **Charts**: Pie/Donut (percentages), Line Graphs (time), Bar Graphs (comparisons).
- **Data Table**: A robust table with pagination for the activity log.

---

## 🚀 Execution Phasing

### Phase 1: Engine Rebuild
- Rip out the 100-item truncation logic and rewrite the core Algorithms (5-point system, severity scaling, zero-day handling).
- Implement the chunked Data Retention engine (0-30-Max) and Daily Aggregator in the background script.

### Phase 2: UI Foundation
- Nuke the current UI folder.
- Initialize Shadcn with the Nova/Neutral style, install Geist, and configure Tailwind.

### Phase 3: Assembly
- Build the Popup widget and Dashboard shell.
- Integrate the Data Table and Recharts components, wiring them directly into the new data engine.
