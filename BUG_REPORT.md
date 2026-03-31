# Bug Report

## BUG-001: Chat message count badge stops incrementing after 35 messages

**Severity:** Medium  
**Component:** Chat Interaction Window — badge counter  
**Affected Version:** `/desktop` (v1)  
**Fixed In:** `/desktopv2` (v2)

### Description

The message count badge in the chat panel heading stops updating after reaching 35, even though new messages continue to appear in the chat stream. The badge text freezes at "35 messages" while the actual DOM contains additional messages.

### Steps to Reproduce

1. Create a test run via `POST /api/testrun` with 15 pre-loaded transcript messages.
2. Open `/desktop/{runId}` and set agent status to **Ready**.
3. Accept the chat invite — badge shows "15 messages".
4. Send 12 agent messages through the chat composer. Each send produces an agent message and a customer echo (2 new messages per send).
5. Observe the badge text after the total crosses 35.

### Expected Result

The badge should display the actual message count (e.g., "39 messages" after 15 + 24 new messages).

### Actual Result

The badge freezes at "35 messages" while the chat stream contains 39+ visible messages.

### Verification

Running the automation against `/desktopv2` shows the badge correctly updating to "39 messages", confirming the fix.

---

## BUG-002: Transaction amount signs inconsistent with description semantics

**Severity:** Low  
**Component:** Customer Profile — Recent Transactions (backend fixture data)  
**Affected Version:** Both `/desktop` (v1) and `/desktopv2` (v2)

### Description

Several transaction amounts in the sample profile fixtures have signs (positive/negative) that contradict the transaction description. For example, a "Payment Received" entry shows a negative amount, while a "Service Charge" shows a positive amount. In a real billing system, payments received add to the balance (positive) and charges reduce it (negative).

### Affected Transactions (account 10012)

| Date | Description | Amount | Expected Sign |
|------|-------------|--------|---------------|
| 2026-03-08 | Loyalty Credit | -40.05 | Positive (credit adds to balance) |
| 2026-03-03 | Usage Credit | -76.80 | Positive (credit adds to balance) |
| 2026-03-02 | Payment Received | -84.15 | Positive (incoming payment) |
| 2026-03-01 | Service Charge | +91.50 | Negative (charge deducts from balance) |
| 2026-02-28 | Loyalty Credit | -18.00 | Positive (credit adds to balance) |
| 2026-02-26 | AutoPay Debit | +32.70 | Negative (debit deducts from balance) |
| 2026-02-22 | Payment Received | -62.10 | Positive (incoming payment) |

### Steps to Reproduce

1. Fetch the sample profile: `GET /sampleprofile/10012.json`.
2. Review the `recentTransactions` array.
3. Compare each transaction's `amount` sign against its `description` semantics.

### Expected Result

- "Payment Received", "Loyalty Credit", "Usage Credit" → positive amounts (credits)
- "Service Charge", "AutoPay Debit" → negative amounts (debits)

### Actual Result

The sign appears to follow a rotating pattern unrelated to the description, resulting in 7 out of 23 transactions having logically inverted signs.

### Note

This is a backend fixture data issue, not a frontend rendering bug. The desktop correctly displays whatever the profile API returns. Including this as it would be a data integrity concern in a production system.

---

## Summary

| Bug | Status on v1 | Status on v2 | Type |
|-----|-------------|-------------|------|
| BUG-001: Badge count freezes at 35 | **Open** | **Fixed** | Frontend rendering bug |
| BUG-002: Transaction amount sign mismatch | **Open** | **Open** | Backend fixture data issue |
