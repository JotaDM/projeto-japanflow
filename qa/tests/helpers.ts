/// <reference types="node" />

import process from 'node:process';
import { Buffer } from 'node:buffer';
import { expect, Page, TestInfo } from '@playwright/test';

type Issue = { kind: string; message: string };

function isBenignAbortedRequest(url: string, errorText?: string | null) {
  const aborted = (errorText || '').includes('ERR_ABORTED');

  if (
    aborted &&
    /\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel(?:\?|$)/.test(url) &&
    /^http:\/\/127\.0\.0\.1:8085\//.test(url)
  ) {
    return true;
  }

  if (aborted && /favicon|apple-touch-icon/i.test(url)) {
    return true;
  }

  return false;
}

export function watchRuntime(page: Page) {
  const issues: Issue[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      issues.push({ kind: 'console', message: msg.text() });
    }
  });

  page.on('pageerror', (error) => {
    issues.push({ kind: 'pageerror', message: error.message });
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText || '';

    if (isBenignAbortedRequest(url, errorText)) return;

    issues.push({
      kind: 'requestfailed',
      message: `${request.method()} ${url} — ${errorText || 'falhou'}`,
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 500) {
      issues.push({
        kind: 'http',
        message: `${response.status()} ${response.request().method()} ${response.url()}`,
      });
    }
  });

  return issues;
}

export async function assertNoRuntimeIssues(issues: Issue[], testInfo: TestInfo) {
  if (!issues.length) return;

  const report = issues
    .map((issue, index) => `${index + 1}. [${issue.kind}] ${issue.message}`)
    .join('\n');

  await testInfo.attach('runtime-issues.txt', {
    body: Buffer.from(report, 'utf-8'),
    contentType: 'text/plain',
  });

  expect(issues, report).toEqual([]);
}

export async function login(page: Page) {
  const user = process.env.QA_ADMIN_USER;
  const password = process.env.QA_ADMIN_PASSWORD;

  if (!user || !password) {
    throw new Error('Defina QA_ADMIN_USER e QA_ADMIN_PASSWORD antes de executar o QA.');
  }

  // QA usa Auth/Firestore emuladores. A API web externa não está emulada.
  // Simulamos SOMENTE a leitura do flag de troca de senha para o usuário seed QA.
  // Os fluxos reais de redefinição de senha exigem testes de integração próprios.
  await page.route('**/account/password-reset-status', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mustChangePassword: false }),
    });
  });

  // QA: a API administrativa de histórico não roda nos emuladores.
  // Simula apenas uma página vazia do histórico, sem acessar produção.
  await page.route('**/admin/chat-history*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [],
        cursor: null,
      }),
    });
  });

  await page.goto('/login');

  const userInput = page
    .getByPlaceholder(/Seu usuário/i)
    .or(page.getByLabel(/usuário/i))
    .first();

  const passwordInput = page.getByPlaceholder(/senha/i).or(page.getByLabel(/senha/i)).first();

  await expect(userInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await userInput.fill(user);
  await passwordInput.fill(password);

  await page
    .getByRole('button', { name: /entrar|acessar|login/i })
    .first()
    .click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });

  await page.waitForTimeout(5700);
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );

  expect(overflow, 'A página possui overflow horizontal').toBeFalsy();
}
