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

export async function login(page: Page, options: { forceCredentials?: boolean } = {}) {
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

  // Os testes comuns reutilizam o estado de autenticação criado no setup.
  // Os testes que verificam login/logout devem forçar o fluxo real.
  if (!options.forceCredentials) {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Verificando sessão/i)).toHaveCount(0, { timeout: 15000 });
    if (!new URL(page.url()).pathname.includes('/login')) {
      await expect(page.locator('#main-content')).toBeAttached({ timeout: 15000 });
      return;
    }
    throw new Error(
      'Sessão QA compartilhada ausente ou inválida. Execute o projeto setup (dependência automática do Playwright).'
    );
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' });

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

  // SPA pode mudar a URL sem disparar evento de carregamento completo.
  // Espera pela rota e pelo conteúdo autenticado, sem `waitUntil: 'load'`.
  try {
    await expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: 25000,
        message: 'Login QA não saiu da rota /login',
      })
      .not.toBe('/login');
    await expect(page.getByText(/Verificando sessão/i)).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('#main-content')).toBeAttached({ timeout: 15000 });
  } catch (error) {
    const location = page.url();
    const screenText = (
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    ).slice(0, 900);
    throw new Error(
      `Falha no login do QA. URL: ${location}. Tela: ${screenText}. Causa: ${String(error)}`
    );
  }
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );

  expect(overflow, 'A página possui overflow horizontal').toBeFalsy();
}

/**
 * Navegação SPA após login: preserva Firebase Auth já inicializado.
 * page.goto() força reload de toda a aplicação e reabre a corrida de
 * restauração de sessão em cada caso de teste. Testes de refresh usam
 * intencionalmente page.reload()/goto próprios.
 */
export async function navigateAuthenticated(page: Page, route: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await expect(page).toHaveURL(route);
  await expect(page.getByText(/Verificando sessão/i)).toHaveCount(0);
  await expect(page.locator('#main-content')).toBeAttached();
}
