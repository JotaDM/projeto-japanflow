import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { login } from './helpers';

const authFile = 'qa/.auth/admin.json';

setup('autenticar administrador QA uma vez', async ({ page }) => {
  await login(page, { forceCredentials: true });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await mkdir(dirname(authFile), { recursive: true });
  // Firebase Auth persiste o usuário no IndexedDB (cookies não bastam).
  await page.context().storageState({ path: authFile, indexedDB: true });
});
