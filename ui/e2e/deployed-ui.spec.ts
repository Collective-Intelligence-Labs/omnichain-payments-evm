import { test, expect } from '@playwright/test';

test.describe('OmniChain Payments - Deployed UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('OmniChain Payments');
  });

  test('header displays branding', async ({ page }) => {
    await expect(page.locator('.logo-title')).toHaveText('OmniChain Payments');
    await expect(page.locator('.logo-subtitle')).toHaveText(
      'Gas-Efficient Batch Token Transfers',
    );
  });

  test('connect wallet button is visible', async ({ page }) => {
    const connectButtons = page.locator('.btn-primary').filter({
      hasText: 'Connect Wallet',
    });
    await expect(connectButtons.first()).toBeVisible();
  });

  test('how it works section shows 3 steps', async ({ page }) => {
    const cardTitle = page.locator('.how-card .card-title');
    await expect(cardTitle).toHaveText(/How It Works/);

    const steps = page.locator('.step');
    await expect(steps).toHaveCount(3);

    await expect(page.locator('.step-title').nth(0)).toContainText(
      'Connect Wallet',
    );
    await expect(page.locator('.step-title').nth(1)).toContainText(
      'Build Batch',
    );
    await expect(page.locator('.step-title').nth(2)).toContainText(
      'Sign & Submit',
    );
  });

  test('feature badges are displayed', async ({ page }) => {
    const features = page.locator('.feature');
    await expect(features).toHaveCount(4);

    await expect(features.nth(0)).toContainText('Gas Efficient');
    await expect(features.nth(1)).toContainText('Permit-Based');
    await expect(features.nth(2)).toContainText('Batch Processing');
    await expect(features.nth(3)).toContainText('Multi-Chain');
  });

  test('network & contracts card is visible with correct labels', async ({
    page,
  }) => {
    const cardTitle = page.locator('.info-card .card-title');
    await expect(cardTitle).toHaveText(/Network & Contracts/);

    await expect(page.locator('.info-label').nth(0)).toHaveText('Network');
    await expect(page.locator('.info-label').nth(1)).toHaveText('ETH Balance');
    await expect(page.locator('.info-label').nth(2)).toHaveText(
      'Token Balance',
    );

    await expect(
      page.locator('label.input-label').nth(0),
    ).toHaveText('Processor Address');
    await expect(
      page.locator('label.input-label').nth(1),
    ).toHaveText('Token Address');
  });

  test('connect prompt is shown when wallet is not connected', async ({
    page,
  }) => {
    const prompt = page.locator('.connect-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt.locator('h3')).toHaveText('Connect Your Wallet');
    await expect(prompt).toContainText(
      'Connect your MetaMask wallet to start creating batch token transfers with EIP-2612 permits.',
    );
  });

  test('transaction history shows empty state', async ({ page }) => {
    const historyTitle = page.locator('.history-card .card-title');
    await expect(historyTitle).toHaveText(/Transaction History/);

    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText(
      'No transactions yet',
    );
    await expect(page.locator('.empty-state')).toContainText(
      'Your batch transfers will appear here',
    );
  });

  test('footer is displayed', async ({ page }) => {
    const footer = page.locator('.footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(
      'OmniChain Payments — Gas-Efficient Batch Token Transfers via EIP-2612 Permits',
    );
  });
});
