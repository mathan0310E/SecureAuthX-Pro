import type { Page } from '@playwright/test';

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  // pressSequentially (not fill) to avoid WebKit's password-manager
  // overlay clearing the value of autofill-aware fields.
  const emailInput = page.getByLabel('Email');
  await emailInput.click();
  await emailInput.pressSequentially(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}
