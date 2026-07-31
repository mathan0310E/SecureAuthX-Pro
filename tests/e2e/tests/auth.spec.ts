import { expect, test } from '@playwright/test';
import { E2E_USER } from '../global-setup';
import { login } from '../helpers';

export { login };

test('shows the sign-in page and rejects bad credentials', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  const emailInput = page.getByLabel('Email');
  await emailInput.click();
  await emailInput.pressSequentially(E2E_USER.email);
  await page.getByLabel('Password').fill('WrongPassword!123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid email or password. Please try again.')).toBeVisible();
});

test('signs in and lands on the dashboard', async ({ page }) => {
  await login(page, E2E_USER.email, E2E_USER.password);
  await expect(page.getByText(`Welcome, ${E2E_USER.email}`)).toBeVisible();
});

test('signs out and returns to the sign-in page', async ({ page }) => {
  await login(page, E2E_USER.email, E2E_USER.password);
  await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
