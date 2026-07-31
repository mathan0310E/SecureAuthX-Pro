import { expect, test } from '@playwright/test';
import { E2E_USER } from '../global-setup';
import { login } from '../helpers';

const ADMIN_EMAIL = 'admin@secureauthx.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'change-me-admin-password-123';

test('redirects non-admin users away from the admin dashboard', async ({ page }) => {
  await login(page, E2E_USER.email, E2E_USER.password);
  await page.goto('/admin');
  await page.waitForURL('**/dashboard');
  await expect(page.getByText(`Welcome, ${E2E_USER.email}`)).toBeVisible();
});

test('renders admin analytics and lists users', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();

  // Stat cards
  await expect(page.getByText('Total users')).toBeVisible();
  await expect(page.getByText('MFA enabled')).toBeVisible();
  await expect(page.getByText('Audit log entries (24h)')).toBeVisible();
  await expect(page.getByText('Active sessions')).toBeVisible();

  // Users table contains both the admin and the seeded e2e user.
  const usersTable = page.locator('table');
  await expect(usersTable.getByText(ADMIN_EMAIL)).toBeVisible();
  await expect(usersTable.getByText(E2E_USER.email)).toBeVisible();

  // Search narrows results to the e2e user.
  await page.getByPlaceholder('Search by email...').fill('e2e.user');
  await expect(usersTable.getByText(E2E_USER.email)).toBeVisible();
  await expect(usersTable.getByText(ADMIN_EMAIL)).toHaveCount(0);
});
