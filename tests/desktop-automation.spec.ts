import { test, expect } from '@playwright/test';
import {
  BASE_URL,
  buildAuthenticatedPayload,
  createTestRun,
  fetchSampleProfile,
  navigateToDesktop,
  setAgentReady,
  acceptChatInvite,
  openFreshDesktop,
  type TestRunPayload,
  type CustomerProfile,
} from './helpers';

function getDeskPath(testInfo: any): string {
  return (testInfo.project.use as any).desktopPath ?? '/desktop';
}

// ────────────────────────────────────────────────────
// 1. API — Test Run Creation
// ────────────────────────────────────────────────────
test('API returns valid runId and desktopUrl', async ({ request }) => {
  const payload = buildAuthenticatedPayload();
  const runData = await createTestRun(request, payload);

  expect(runData.runId).toBeTruthy();
  expect(typeof runData.runId).toBe('string');
  expect(runData.desktopUrl).toContain(runData.runId);
  expect(runData.createdAt).toBeTruthy();
});

// ────────────────────────────────────────────────────
// 2. Desktop Shell — All validation uses a shared run
// ────────────────────────────────────────────────────
test.describe('Desktop Shell & Data Validation', () => {
  test.describe.configure({ mode: 'serial' });

  let payload: TestRunPayload;
  let runId: string;
  let profile: CustomerProfile;
  let deskPath: string;

  test.beforeAll(async ({ request }, testInfo) => {
    deskPath = (testInfo.project.use as any).desktopPath ?? '/desktop';
    payload = buildAuthenticatedPayload();
    const run = await createTestRun(request, payload);
    runId = run.runId;
    profile = await fetchSampleProfile(
      request,
      payload.interactionInformation.customerAccountNumber,
    );
  });

  test('Desktop loads in initial Offline state with workspace locked', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);

    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected');

    // Workspace should be gated before chat is accepted
    await expect(page.locator('[data-testid="workspace-gated"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-gated"]')).toContainText(
      'Workspace Locked',
    );
  });

  test('Setting agent to Ready shows chat invite', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);

    const invite = page.locator('[data-testid="chat-invite"]');
    await expect(invite).toBeVisible();
    await expect(invite).toContainText(payload.interactionInformation.queueName);
    await expect(page.locator('[data-testid="accept-chat-invite"]')).toBeEnabled();
  });

  test('Accepting chat loads transcript and unlocks workspace', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);
    await acceptChatInvite(page);

    for (let i = 0; i < payload.chatTranscript.length; i++) {
      const msg = payload.chatTranscript[i];
      await expect(page.locator(`[data-testid="transcript-sender-${i}"]`)).toHaveText(
        msg.sender,
      );
      await expect(page.locator(`[data-testid="transcript-timestamp-${i}"]`)).toHaveText(
        msg.timestamp,
      );
      await expect(page.locator(`[data-testid="transcript-text-${i}"]`)).toHaveText(
        msg.message,
      );
    }

    await expect(page.locator('.panel-badge')).toContainText(
      `${payload.chatTranscript.length} messages`,
    );

    await expect(page.locator('[data-testid="tab-interaction-information"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-customer-profile"]')).toBeVisible();
    await expect(page.locator('[data-testid="workspace-gated"]')).not.toBeVisible();
  });

  test('Interaction Information matches submitted payload', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);
    await acceptChatInvite(page);

    const info = payload.interactionInformation;
    await expect(page.locator('[data-testid="interaction-id"]')).toHaveText(info.interactionId);
    await expect(page.locator('[data-testid="channel"]')).toHaveText(info.channel);
    await expect(page.locator('[data-testid="auth-status"]')).toHaveText(
      info.authenticationStatus,
    );
    await expect(page.locator('[data-testid="customer-account-number"]')).toHaveText(
      info.customerAccountNumber,
    );
    await expect(page.locator('[data-testid="journey-name"]')).toHaveText(info.journeyName);
    await expect(page.locator('[data-testid="queue-name"]')).toHaveText(info.queueName);
    await expect(page.locator('[data-testid="desktop-status"]')).toHaveText(
      info.agentDesktopStatus,
    );
    await expect(page.locator('[data-testid="start-time"]')).toHaveText(info.startTime);
  });

  test('Customer Profile matches backend fixture', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);
    await acceptChatInvite(page);

    await page.locator('[data-testid="tab-customer-profile"]').click();
    await page.locator('[data-testid="customer-profile"]').waitFor({ timeout: 5000 });

    await expect(page.locator('[data-testid="customer-name"]')).toHaveText(
      profile.customerName,
    );
    await expect(page.locator('[data-testid="customer-tier"]')).toHaveText(
      profile.customerTier,
    );
    await expect(page.locator('[data-testid="account-status"]')).toHaveText(
      profile.accountStatus,
    );
    await expect(page.locator('[data-testid="last-payment-date"]')).toHaveText(
      profile.lastPaymentDate,
    );
    await expect(page.locator('[data-testid="preferred-language"]')).toHaveText(
      profile.preferredLanguage,
    );
  });

  test('Transactions match profile fixture across paginated pages', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);
    await acceptChatInvite(page);

    await page.locator('[data-testid="tab-customer-profile"]').click();
    await page.locator('[data-testid="recent-transactions"]').waitFor({ timeout: 5000 });

    const total = profile.recentTransactions.length;
    const perPage = 10;
    const totalPages = Math.ceil(total / perPage);

    let idx = 0;
    for (let p = 1; p <= totalPages; p++) {
      const rows = await page.locator('.table-row').count();
      const expectedRows = p < totalPages ? perPage : total - perPage * (totalPages - 1);
      expect(rows).toBe(expectedRows);

      for (let r = 0; r < rows; r++) {
        const row = page.locator(`[data-testid="transaction-row-${idx}"]`);
        const cells = await row.locator('span').allTextContents();
        const amount = await row.locator('strong').textContent();
        const exp = profile.recentTransactions[idx];
        expect(cells[0]).toBe(exp.date);
        expect(cells[1]).toBe(exp.description);
        expect(amount).toBe(exp.amount);
        idx++;
      }

      if (p < totalPages) {
        await page.locator('button:has-text("Next")').click();
        await page.waitForTimeout(400);
      }
    }
    expect(idx).toBe(total);
  });

  test('Account history notes match profile fixture', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);
    await setAgentReady(page);
    await acceptChatInvite(page);

    await page.locator('[data-testid="tab-customer-profile"]').click();
    await page.locator('[data-testid="account-history"]').waitFor({ timeout: 5000 });

    for (let i = 0; i < profile.accountHistoryNotes.length; i++) {
      await expect(page.locator(`[data-testid="history-note-${i}"]`)).toHaveText(
        profile.accountHistoryNotes[i],
      );
    }
  });

  test('Agent status dropdown can be toggled between states', async ({ page }) => {
    await navigateToDesktop(page, deskPath, runId);

    const select = page.locator('[data-testid="agent-status-select"]');
    for (const val of ['Not Ready', 'Offline', 'Ready']) {
      await select.selectOption(val);
      await expect(select).toHaveValue(val);
    }
  });
});

// ────────────────────────────────────────────────────
// 3. Live Chat (needs its own run — modifies state)
// ────────────────────────────────────────────────────
test.describe('Live Chat Messaging', () => {
  test('Agent send produces message and customer echo', async ({ request, page }, testInfo) => {
    const deskPath = getDeskPath(testInfo);
    const { payload } = await openFreshDesktop(request, page, deskPath);
    await setAgentReady(page);
    await acceptChatInvite(page);

    const n = payload.chatTranscript.length;
    const sendBtn = page.locator('[data-testid="agent-chat-send"]');
    const input = page.locator('[data-testid="agent-chat-input"]');

    await expect(sendBtn).toBeDisabled();

    const msg = 'Hello, I can assist with your billing concern.';
    await input.fill(msg);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(
      page.locator(`[data-testid="transcript-sender-${n}"]`),
    ).toHaveText('Agent', { timeout: 5000 });
    await expect(
      page.locator(`[data-testid="transcript-text-${n}"]`),
    ).toHaveText(msg);

    await expect(
      page.locator(`[data-testid="transcript-sender-${n + 1}"]`),
    ).toHaveText('Customer', { timeout: 5000 });
    await expect(
      page.locator(`[data-testid="transcript-text-${n + 1}"]`),
    ).toContainText(msg);

    await expect(input).toHaveValue('');
    await expect(sendBtn).toBeDisabled();
  });

  test('Enter key sends message', async ({ request, page }, testInfo) => {
    const deskPath = getDeskPath(testInfo);
    const { payload } = await openFreshDesktop(request, page, deskPath);
    await setAgentReady(page);
    await acceptChatInvite(page);

    const n = payload.chatTranscript.length;
    const input = page.locator('[data-testid="agent-chat-input"]');
    await input.fill('Testing Enter key');
    await input.press('Enter');

    await expect(
      page.locator(`[data-testid="transcript-text-${n}"]`),
    ).toHaveText('Testing Enter key', { timeout: 5000 });
  });
});

// ────────────────────────────────────────────────────
// 4. Bug Detection
// ────────────────────────────────────────────────────
test.describe('Bug Detection', () => {
  test('BUG-001: Chat badge count should keep incrementing beyond 35', async (
    { request, page },
    testInfo,
  ) => {
    test.setTimeout(120_000);
    const deskPath = getDeskPath(testInfo);

    const transcript = Array.from({ length: 15 }, (_, i) => ({
      sender: (i % 2 === 0 ? 'Customer' : 'Bot') as 'Customer' | 'Bot',
      timestamp: `14:${String(i).padStart(2, '0')}:00`,
      message: `Pre-loaded message ${i + 1}`,
    }));

    const { payload } = await openFreshDesktop(request, page, deskPath, {
      chatTranscript: transcript,
    });
    await setAgentReady(page);
    await acceptChatInvite(page);

    const badge = page.locator('.panel-badge');
    await expect(badge).toContainText('15 messages');

    // Send 12 agent messages → 12 agent msgs + ~12 customer echoes ≈ 39 total
    for (let i = 0; i < 12; i++) {
      await page.locator('[data-testid="agent-chat-input"]').fill(`Msg ${i + 1}`);
      await page.locator('[data-testid="agent-chat-send"]').click();
      await page.waitForTimeout(700);
    }

    await page.waitForTimeout(2000);

    const actualCount = await page
      .locator('[data-testid^="transcript-message-"]')
      .count();
    const badgeText = await badge.textContent();
    const badgeNum = parseInt(badgeText!.match(/\d+/)?.[0] ?? '0', 10);

    console.log(`BUG-001: badge="${badgeText}", actual DOM messages=${actualCount}`);

    // Assertion: badge number must equal actual message count.
    // FAILS on /desktop (badge freezes at 35). PASSES on /desktopv2.
    expect(
      badgeNum,
      `Badge displays "${badgeText}" but ${actualCount} messages exist in the DOM. ` +
        `The badge count freezes at 35 while new messages continue to appear.`,
    ).toBe(actualCount);
  });

  test('BUG-002: Transaction amount signs should match description semantics', async ({
    request,
  }) => {
    const profile = await fetchSampleProfile(request, '10012');

    const shouldBeNegative = ['Service Charge', 'AutoPay Debit'];
    const shouldBePositive = ['Payment Received', 'Loyalty Credit', 'Usage Credit'];

    const mismatches: string[] = [];
    for (const txn of profile.recentTransactions) {
      const amt = parseFloat(txn.amount);
      if (shouldBeNegative.includes(txn.description) && amt > 0) {
        mismatches.push(
          `"${txn.description}" on ${txn.date}: amount ${txn.amount} should be negative`,
        );
      }
      if (shouldBePositive.includes(txn.description) && amt < 0) {
        mismatches.push(
          `"${txn.description}" on ${txn.date}: amount ${txn.amount} should be positive`,
        );
      }
    }

    if (mismatches.length > 0) {
      console.log('BUG-002 mismatches:');
      mismatches.forEach((m) => console.log(`  - ${m}`));
    }

    expect(
      mismatches,
      `${mismatches.length} transactions have amount signs inconsistent with their description.\n` +
        mismatches.join('\n'),
    ).toHaveLength(0);
  });
});
