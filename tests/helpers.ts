import { type APIRequestContext, type Page, expect } from '@playwright/test';

export const BASE_URL =
  process.env.BASE_URL || 'https://takehome-desktop.d.tekvisionflow.com';

export interface InteractionInformation {
  interactionId: string;
  channel: string;
  authenticationStatus: 'Authenticated' | 'Not Authenticated';
  customerAccountNumber: string;
  journeyName: string;
  queueName: string;
  agentDesktopStatus: string;
  startTime: string;
}

export interface ChatMessage {
  sender: 'Customer' | 'Bot' | 'System' | 'Agent';
  timestamp: string;
  message: string;
}

export interface TestRunPayload {
  interactionInformation: InteractionInformation;
  chatTranscript: ChatMessage[];
}

export interface TestRunResponse {
  runId: string;
  desktopUrl: string;
  createdAt: string;
}

export interface CustomerProfile {
  visible: boolean;
  customerName: string;
  accountNumber: string;
  customerTier: string;
  accountStatus: string;
  lastPaymentDate: string;
  preferredLanguage: string;
  recentTransactions: { date: string; description: string; amount: string }[];
  accountHistoryNotes: string[];
}

export function buildAuthenticatedPayload(
  overrides: Partial<TestRunPayload> = {},
): TestRunPayload {
  return {
    interactionInformation: {
      interactionId: 'CHAT-AUTO-001',
      channel: 'Chat',
      authenticationStatus: 'Authenticated',
      customerAccountNumber: '10012',
      journeyName: 'Billing Support',
      queueName: 'Billing Tier 1',
      agentDesktopStatus: 'Connected',
      startTime: '2026-03-11T10:30:00Z',
      ...overrides.interactionInformation,
    },
    chatTranscript: overrides.chatTranscript ?? [
      {
        sender: 'Customer',
        timestamp: '14:31:01',
        message: 'I was charged twice this month.',
      },
      {
        sender: 'Bot',
        timestamp: '14:31:09',
        message: 'I can help with billing issues.',
      },
      {
        sender: 'System',
        timestamp: '14:31:50',
        message: 'Handoff to Billing Tier 1',
      },
    ],
  };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Create a test run with automatic retry on 429 rate-limit responses.
 */
export async function createTestRun(
  request: APIRequestContext,
  payload: TestRunPayload,
): Promise<TestRunResponse> {
  const maxRetries = 5;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await request.post(`${BASE_URL}/api/testrun`, { data: payload });
    if (res.ok()) return res.json();
    if (res.status() === 429 && attempt < maxRetries) {
      const wait = 3000 * Math.pow(2, attempt);
      console.log(
        `Rate-limited (429). Retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})…`,
      );
      await sleep(wait);
      continue;
    }
    throw new Error(`API returned ${res.status()}: ${await res.text()}`);
  }
  throw new Error('Unreachable');
}

export async function fetchSampleProfile(
  request: APIRequestContext,
  accountNumber: string,
): Promise<CustomerProfile> {
  const res = await request.get(
    `${BASE_URL}/sampleprofile/${accountNumber}.json`,
  );
  if (!res.ok()) throw new Error(`Profile fetch failed: ${res.status()}`);
  return res.json();
}

/**
 * Navigate to the desktop and wait for the React shell to render.
 */
export async function navigateToDesktop(
  page: Page,
  deskPath: string,
  runId: string,
) {
  await page.goto(`${BASE_URL}${deskPath}/${runId}`);
  await page.locator('[data-testid="desktop-header"]').waitFor({ timeout: 15000 });
}

/**
 * Handle the initial agent status: the desktop starts in "Offline" state
 * on first load. Set agent to "Ready" so the chat invite can appear.
 */
export async function setAgentReady(page: Page) {
  const select = page.locator('[data-testid="agent-status-select"]');
  await select.selectOption('Ready');
  await expect(page.locator('.panel-badge')).toHaveText('Agent Ready', { timeout: 10000 });
}

/**
 * Wait for the chat invite and click Accept. Waits for the first transcript
 * message to confirm the chat is loaded.
 */
export async function acceptChatInvite(page: Page) {
  const inviteBtn = page.locator('[data-testid="accept-chat-invite"]');
  await inviteBtn.waitFor({ state: 'visible', timeout: 10000 });
  await inviteBtn.click();
  await page.locator('[data-testid="transcript-message-0"]').waitFor({ timeout: 10000 });
}

/**
 * Full flow: create run → navigate → set agent Ready → accept chat.
 */
export async function openFreshDesktop(
  request: APIRequestContext,
  page: Page,
  deskPath: string,
  payloadOverrides: Partial<TestRunPayload> = {},
) {
  const payload = buildAuthenticatedPayload(payloadOverrides);
  const { runId } = await createTestRun(request, payload);
  await navigateToDesktop(page, deskPath, runId);
  return { payload, runId };
}
