# Agent Desktop Automation Tests

UI automation for the mock agent desktop at `https://takehome-desktop.d.tekvisionflow.com`, built with **Playwright** (TypeScript).

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npx playwright install chromium
```

## Running Tests

### Against `/desktop` (v1 — contains known bugs)

```bash
npm test
# or explicitly:
npm run test:v1
```

### Against `/desktopv2` (bug fixes applied)

```bash
npm run test:v2
```

### Run both versions

```bash
npm run test:all
```

### View HTML report

```bash
npm run report
```

## Test Summary Report

### Features Tested

1. **API Test Run Creation** — Submits a deterministic payload to `POST /api/testrun` and validates the response contains a `runId`, `desktopUrl`, and `createdAt` timestamp. **Result: PASS**

2. **Initial Desktop State & Agent Status Handling** — Verifies the desktop loads with connection status "Connected" and workspace panels locked. The agent starts in Offline status; automation sets agent to "Ready", which triggers the chat invite to appear with the correct queue name. **Result: PASS**

3. **Chat Invite Acceptance & Transcript Validation** — Accepts the incoming chat, then verifies every transcript message (sender, timestamp, text) matches the payload that was submitted to the API. Confirms the message count badge reflects the correct number and workspace panels unlock. **Result: PASS**

4. **Interaction Information Validation** — Compares all 8 fields (Interaction ID, Channel, Authentication Status, Account Number, Journey Name, Queue Name, Desktop Status, Start Time) rendered in the UI against the submitted payload. **Result: PASS**

5. **Customer Profile Validation** — Switches to the Customer Profile tab and compares name, tier, account status, last payment date, and preferred language against the `/sampleprofile/10012.json` fixture loaded by the backend. **Result: PASS**

6. **Transaction Data Validation (Paginated)** — Walks through all 3 pages of paginated transactions (23 total) and asserts every row's date, description, and amount matches the profile fixture. **Result: PASS**

7. **Account History Notes** — Verifies each account history note matches the profile fixture. **Result: PASS**

8. **Live Chat Simulation** — Types a message in the chat composer, sends it via button click and via Enter key, and validates: (a) the agent message appears with correct text, (b) a customer echo response arrives containing the sent text, (c) the input clears and Send button disables after sending. **Result: PASS**

### Bugs Found

| Bug | Description | v1 (`/desktop`) | v2 (`/desktopv2`) |
|-----|-------------|-----------------|-------------------|
| **BUG-001** | Chat badge count freezes at 35 messages while new messages continue appearing | **FAIL** — badge stuck at "35 messages" with 39 actual | **PASS** — fixed, shows "39 messages" |
| **BUG-002** | Transaction amount signs contradict description semantics (e.g., "Payment Received" with negative amount) | **FAIL** — 7 of 23 transactions have inverted signs | **FAIL** — backend fixture data not fixed |

See [BUG_REPORT.md](BUG_REPORT.md) for detailed reproduction steps, expected vs actual results, and affected transactions.

---

## What the Tests Cover

| # | Test | Description |
|---|------|-------------|
| 1 | API test run creation | POSTs a payload to `/api/testrun` and validates the response (runId, desktopUrl, createdAt) |
| 2 | Initial desktop state | Verifies the desktop loads with connection status "Connected" and workspace locked |
| 3 | Agent status → Ready | Sets the agent status dropdown to "Ready" and confirms the chat invite appears |
| 4 | Chat acceptance | Accepts the invite and verifies every transcript message (sender, timestamp, text) matches the submitted payload |
| 5 | Interaction Information | Validates all fields (ID, channel, auth status, account number, journey, queue, desktop status, start time) against the payload |
| 6 | Customer Profile | Switches to the Customer Profile tab and compares name, tier, status, last payment, and language against the `/sampleprofile/{account}.json` fixture |
| 7 | Transactions (paginated) | Walks through all paginated pages and asserts every transaction row (date, description, amount) matches the fixture |
| 8 | Account history notes | Verifies each history note matches the fixture |
| 9 | Agent status toggle | Cycles the dropdown through Not Ready → Offline → Ready and confirms each value sticks |
| 10 | Live chat send | Types a message, clicks Send, and verifies the agent message and auto-generated customer echo appear. Also checks that the input clears and Send disables after sending |
| 11 | Enter key send | Verifies pressing Enter in the chat input submits the message |
| 12 | **BUG-001** — Badge count freeze | Sends messages past 35 total and asserts the badge number equals the actual DOM message count (fails on v1, passes on v2) |
| 13 | **BUG-002** — Transaction amount signs | Checks that amounts like "Payment Received" are positive and "Service Charge" are negative (fails on both v1 and v2 — backend fixture issue) |

## Expected Results

| Version | Core Tests (1-11) | BUG-001 | BUG-002 |
|---------|-------------------|---------|---------|
| `/desktop` (v1) | 11 pass | FAIL (badge stuck at 35) | FAIL (7 mismatched signs) |
| `/desktopv2` (v2) | 12 pass (BUG-001 fixed) | PASS | FAIL (backend data not fixed) |

## Project Structure

```
├── playwright.config.ts    # Two projects: desktop-v1 and desktop-v2
├── package.json
├── tests/
│   ├── helpers.ts          # API client, payload builder, page navigation helpers
│   └── desktop-automation.spec.ts  # All test cases
├── BUG_REPORT.md           # Detailed bug reports with repro steps
└── README.md
```

## Design Decisions

- **Deterministic runs**: each test (or test group) creates its own test run via the API so results are repeatable and independent.
- **Rate-limit handling**: the API helper automatically retries 429 responses with exponential backoff.
- **Agent status flow**: the automation explicitly sets the agent to "Ready" before attempting to accept the chat invite, mirroring what a real agent would do on login.
- **Shared runs for read-only tests**: the "Desktop Shell & Data Validation" suite uses a single shared run to reduce API calls and avoid rate limiting, while tests that modify state (live chat, bug detection) each create a fresh run.
- **Dual-project config**: Playwright projects make it trivial to re-run the same suite against `/desktopv2` to confirm bug fixes.
