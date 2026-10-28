import { createWarrantyTransport } from './transporte.mjs';
// Keep disabled until source review, local/emulator tests and explicit deployment approval.
const disabled = Object.freeze({ enabled: false });
const config = globalThis.JI_WARRANTY_CONFIG || disabled;
const root = document.querySelector('.ji-warranty-request');
if (root) {
  let operation;
  root.jiSendWarranty = async (...args) => {
    if (!config.enabled || !config.firebasePublicConfig?.appId || !config.recaptchaSiteKey) {
      throw new Error(
        'Formulário ainda não ativado. Fale com a equipe pelos canais de atendimento.'
      );
    }
    if (!operation)
      operation = (async () => {
        // Pinned to the Firebase dependency declared in the reviewed repository.
        const [appSDK, checkSDK, functionSDK] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js'),
          import('https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js'),
        ]);
        const app = appSDK.initializeApp(config.firebasePublicConfig, 'ji-warranty-public');
        checkSDK.initializeAppCheck(app, {
          provider: new checkSDK.ReCaptchaV3Provider(config.recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
        const callable = functionSDK.httpsCallable(
          functionSDK.getFunctions(app, 'southamerica-east1'),
          'receiveSiteWarranty',
          { limitedUseAppCheckTokens: true, timeout: 120000 }
        );
        return createWarrantyTransport(callable);
      })().catch((error) => {
        operation = undefined;
        throw error;
      });
    return (await operation)(...args);
  };
}
