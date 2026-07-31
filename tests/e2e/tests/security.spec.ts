import { expect, test } from '@playwright/test';
import { E2E_USER } from '../global-setup';
import { login } from '../helpers';

test('renders the security activity dashboard with audit log entries', async ({ page }) => {
  await login(page, E2E_USER.email, E2E_USER.password);

  await page.goto('/security/activity');
  await expect(
    page.getByRole('heading', { name: /Security activity/i })
  ).toBeVisible();

  // Audit log tab should be active by default and contain entries.
  const auditTab = page.getByRole('button', { name: /Audit log/i });
  await expect(auditTab).toBeVisible();
  await expect(page.locator('main ul li').first()).toBeVisible();

  // Switching to security events renders that feed too.
  await page.getByRole('button', { name: 'Security events' }).click();
  await expect(page.getByRole('heading', { name: 'Security events' })).toBeVisible();
});
