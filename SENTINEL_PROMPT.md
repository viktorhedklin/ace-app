# ACE Sentinel — Base44 App Builder Prompt

Copy everything below the line into Base44's app builder:

---

Build an app called **ACE Sentinel** — an autonomous KB scanner and quality assurance tool for a Bybit customer support AI called ACE.

## What this app does

ACE Sentinel scans Bybit's public help center, announcements, and blog pages. It extracts policy updates, new articles, and changed information. It then outputs structured JSON that gets imported into ACE's local Knowledge Base. The goal: keep ACE's knowledge fresh without manual research.

## Design & Theme

- Dark theme: background `#0a0f1a`, cards `#111827`, borders `#1e293b`
- Accent color: `#facc15` (yellow-400) for buttons, highlights, active states
- Secondary accent: `#22d3ee` (cyan-400) for scan status and diff indicators
- Font: system sans-serif, monospace for JSON output
- Minimal, professional, dashboard-style layout
- No emojis in UI chrome (icons only). Clean and functional.

## Pages / Sections

### 1. Dashboard (Home)

Show:
- Last scan timestamp
- Total KB entries in current snapshot
- Number of updates found in last scan
- Quick action buttons: "Full Scan", "Quick Scan", "Export Updates"
- Status cards for each source (EU Help Center, Global Help Center, EU Announcements, Global Announcements, Blog)

### 2. Scanner

This is the core feature. Two modes:

**Auto Scan (primary):**
- User clicks "Full Scan" or "Quick Scan"
- App fetches content from the Bybit source URLs listed below
- If URL fetching is not available: show a textarea where user can paste the page content manually, with the URL displayed as a label so they know which page to copy from
- Sends fetched/pasted content to Claude API for analysis
- Claude extracts: new articles, policy changes, updated procedures, new error codes, deprecated info
- Results shown as a diff list: NEW (green), UPDATED (yellow), OUTDATED (red), UNCHANGED (gray)

**Manual Paste:**
- Textarea where user pastes any Bybit article or announcement text
- Claude analyzes and extracts KB entries
- Good for one-off articles or internal SOPs

**Source URLs to scan:**

```
EU Help Center:
- https://www.bybit.eu/en-EU/help-center
- https://www.bybit.eu/en-EU/help-center/article/Individual-KYC-FAQ
- https://www.bybit.eu/en-EU/help-center/article/SEPA-Guide
- https://www.bybit.eu/en-EU/help-center/article/EU-Travel-Rule
- https://www.bybit.eu/en-EU/help-center/article/Bybit-Card-EU
- https://www.bybit.eu/en-EU/help-center/article/EU-Product-Restrictions
- https://www.bybit.eu/en-EU/help-center/article/EU-Stablecoin-Policy
- https://www.bybit.eu/en-EU/help-center/article/EU-Complaint-Procedure
- https://www.bybit.eu/en-EU/help-center/article/EU-EDD-Process
- https://www.bybit.eu/en-EU/help-center/article/EU-Account-Migration
- https://www.bybit.eu/en-EU/help-center/article/EU-Derivatives-Restrictions
- https://www.bybit.eu/en-EU/help-center/article/MiCA-Disclosures

Global Help Center:
- https://www.bybit.com/en/help-center
- https://www.bybit.com/en/help-center/article/Individual-KYC-FAQ
- https://www.bybit.com/en/help-center/article/How-to-Complete-Individual-KYC-Verification
- https://www.bybit.com/en/help-center/article/Common-Reasons-and-Solutions-for-KYC-Verification-Failures
- https://www.bybit.com/en/help-center/article/How-to-Complete-Enhanced-Due-Diligence-EDD-Verification
- https://www.bybit.com/en/help-center/article/FAQ-Account-Settings
- https://www.bybit.com/en/help-center/article/How-to-Recover-Your-Google-Authenticator-Code
- https://www.bybit.com/en/help-center/article/Common-Reasons-for-Unsuccessful-Withdrawal-Request-Submissions
- https://www.bybit.com/en/help-center/article/FAQ-Assets-Pending-in-Compliance-Reviews
- https://www.bybit.com/en/help-center/article/How-Recover-Missing-Deposit-Self-Service
- https://www.bybit.com/en/help-center/article/FAQ-Fiat-Transaction-Error-or-Risk-Warning
- https://www.bybit.com/en/help-center/article/FAQ-Fiat-Deposit
- https://www.bybit.com/en/help-center/article/How-to-Submit-an-Appeal-for-Your-P2P-Order
- https://www.bybit.com/en/help-center/article/How-to-Avoid-Crypto-P2P-Scams
- https://www.bybit.com/en/help-center/article/Withdrawal-Limits
- https://www.bybit.com/en/help-center/article/Trading-Fee-Structure
- https://www.bybit.com/en/help-center/article/UTA-FAQ
- https://www.bybit.com/en/help-center/article/Copy-Trading-FAQ

Announcements:
- https://announcements.bybit.com/en/
- https://announcements.bybit.eu/en-EU/

Blog:
- https://www.bybit.com/en/blog
```

### 3. Current KB Snapshot

- User uploads their current ACE knowledge JSON (exported from ACE Settings)
- App parses and displays all entries in a table: title, content preview, active status
- This snapshot is used as the baseline for diff comparison during scans
- Store the snapshot in app state/local storage so user doesn't re-upload every time

### 4. Results & Export

After a scan completes:
- Show all findings in a checklist UI
- Each finding has: category tag (NEW/UPDATED/OUTDATED), title, content preview, source URL
- User can check/uncheck which findings to include in the export
- "Select All New", "Select All Updated", "Deselect Outdated" quick filters
- **Export button** generates JSON in this exact format:

```json
{
  "exportedAt": "2026-04-08T14:30:00.000Z",
  "type": "ace_knowledge_backup",
  "source": "ACE Sentinel",
  "scanSources": ["eu-help-center", "global-help-center", "announcements"],
  "count": 5,
  "entries": [
    {
      "id": 1712345678901,
      "title": "EU SEPA Processing Update — April 2026",
      "content": "SEPA Instant now supported by 85% of EU banks. Standard SEPA processing reduced to 1-2 business days for most transfers. Name matching rules unchanged — must exactly match KYC name.",
      "active": true
    }
  ]
}
```

This JSON format is critical — ACE's KnowledgeManager imports exactly this schema.

### 5. Settings

- Claude API key input (stored in app, used for analysis calls)
- Model selector: default `claude-sonnet-4-6` (cost-efficient for scanning), option for `claude-opus-4-6` (deep analysis)
- Scan depth: Quick (announcements only) vs Full (all sources)
- Auto-scan schedule: manual only, daily, weekly (if Base44 supports scheduled tasks)

## Claude API Integration

Use the Anthropic Messages API. Every scan sends extracted page content to Claude with this system prompt:

```
You are ACE Sentinel — a knowledge extraction engine for a Bybit customer support AI called ACE.

Your job: analyze Bybit help center articles, announcements, and blog posts. Extract actionable knowledge that a live-chat support agent needs during their shift.

EXTRACTION RULES:
1. Extract FACTS, not fluff. Skip marketing language, promotional content, and generic statements.
2. Focus on: policy rules, limits, thresholds, procedures, escalation paths, error codes, regional restrictions, new features, deprecated features, changed processes.
3. For each extracted item, write the content as a direct, concise instruction — as if briefing an agent before their shift.
4. Tag each item with a category: KYC, Account, Crypto, Fiat, P2P, Card, Trading, Compliance, Security, General.
5. Tag platform: "eu", "global", or "both".
6. If an article mentions specific limits, thresholds, or SLAs — extract the EXACT numbers.
7. If an article describes a self-service flow — extract the exact navigation path (e.g., "Profile > Settings > Identity Verification").
8. For announcements: extract effective date, what changed, and who is affected.
9. For EU content: always flag MiCA/regulatory implications explicitly.
10. Do NOT extract information that is obvious or common knowledge (e.g., "Bybit is a crypto exchange").

OUTPUT FORMAT — respond with JSON only:
[
  {
    "title": "Short descriptive title (under 60 chars)",
    "content": "The extracted knowledge — concise, factual, actionable. Include specific numbers, dates, paths, and rules. Max 300 chars.",
    "category": "KYC|Account|Crypto|Fiat|P2P|Card|Trading|Compliance|Security|General",
    "platform": "eu|global|both",
    "sourceUrl": "the URL this was extracted from",
    "changeType": "new|updated|unchanged",
    "confidence": "high|medium|low"
  }
]

If comparing against an existing KB snapshot, also identify entries that appear OUTDATED (information in the existing KB contradicts what the current article says). For outdated entries, set changeType to "outdated" and explain what changed in the content field.

Only output the JSON array. No markdown, no explanation, no preamble.
```

When comparing against an existing KB snapshot, append this to the user message:

```
EXISTING KB SNAPSHOT (compare against this — flag outdated entries):
{snapshot JSON here}
```

## Additional Features

**Scan Progress:**
- Show a progress bar or step indicator during scanning
- List each URL being processed with a checkmark when done
- Show "Analyzing with Claude..." spinner during API calls

**Diff Viewer:**
- Side-by-side comparison: OLD (from snapshot) vs NEW (from scan)
- Highlight changed text in yellow
- Red strikethrough for removed/outdated info
- Green highlight for new additions

**History:**
- Keep a log of past scans: timestamp, sources scanned, findings count
- User can revisit past scan results

**Copy JSON:**
- In addition to file download, add a "Copy to Clipboard" button for the export JSON
- Some users prefer paste over drag-and-drop

## Technical Notes

- If the app cannot fetch URLs directly (CORS or platform limitation), gracefully fall back to the manual paste mode. Show the URL as a clickable link and a textarea labeled "Paste page content here". Process each URL one at a time.
- Claude API calls should use `max_tokens: 4096` for analysis responses.
- Handle API errors gracefully — show the error message and allow retry.
- Store the API key securely — never display it in plain text after saving.
- The app processes ONLY public Bybit web pages. No customer data, no PII, no internal documents ever pass through this app.

## Summary

ACE Sentinel is a standalone scanning tool. It reads public Bybit pages, extracts knowledge updates using Claude, and outputs JSON that imports into ACE's Knowledge Base via drag-and-drop. It keeps ACE's brain fresh without manual research. The agent presses "Scan", waits 30 seconds, downloads the JSON, drops it into ACE Settings. Done.

---

# PHASE 2: Publish KB Endpoint (add this to Sentinel)

Copy this into Base44 to add a **Publish KB** feature to ACE Sentinel:

---

Add a new feature to ACE Sentinel called **Publish KB**.

## What it does

After a scan is completed and the user has selected which findings to keep, there should be a **"Publish KB"** button alongside the existing Export button. When clicked:

1. Save the current approved KB entries (the ones checked in the Results page) to a persistent storage/database in the app.
2. Expose this data at a **public API endpoint** (or a public page that returns raw JSON) at a predictable URL — something like: `/api/kb/latest` or `/published-kb`
3. This URL always returns the LATEST published KB in this exact JSON format:

```json
{
  "publishedAt": "2026-04-08T14:30:00.000Z",
  "source": "ACE Sentinel",
  "count": 12,
  "entries": [
    {
      "id": 1712345678901,
      "title": "Entry title",
      "content": "Entry content — concise, factual, actionable.",
      "active": true
    }
  ]
}
```

4. Each time "Publish KB" is clicked, it OVERWRITES the previous published data (only one version live at a time — the latest).
5. The published KB URL should be shown in the UI after publishing, with a "Copy URL" button so the user can paste it into ACE's Settings.

## UI additions

- **Results page**: Add a yellow "Publish KB" button next to the existing Export button. Icon: Globe or Upload.
- **After publishing**: Show a success banner with the published URL and a copy button.
- **Dashboard**: Show "Published KB" status card — last published timestamp, entry count, and the live URL.
- **Settings page**: Show the published KB URL (read-only) so the user always knows where ACE should point.

## How ACE uses this

ACE (the local app) has a "Remote Sync URL" field in its Knowledge Base settings. The user pastes the Sentinel published KB URL there ONCE. After that:
- Every time ACE loads, it fetches that URL and merges new/updated entries automatically
- The user can also click "Sync Now" in ACE to pull the latest manually
- Zero manual file transfer needed — Sentinel publishes, ACE pulls. Fully autonomous.

## Technical notes

- The published KB endpoint must return JSON with `Content-Type: application/json`
- Must include CORS headers: `Access-Control-Allow-Origin: *` (ACE runs on localhost or any domain)
- The endpoint should be GET-only, no authentication needed (the data is public Bybit knowledge, zero PII)
- If Base44 doesn't support custom API endpoints, create a dedicated page that renders ONLY the raw JSON (no HTML wrapper) — ACE can fetch this just as well
- Store the published KB in Base44's database/storage so it persists between app sessions
