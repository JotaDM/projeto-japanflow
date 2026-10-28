'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineBoolean, defineInt, defineString } = require('firebase-functions/params');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { randomUUID } = require('node:crypto');
const { IntakeError, createIntake } = require('./siteWarranty.cjs');

// Recebimento permanece desativado ate homologacao restrita.
const enabled = defineBoolean('SITE_WARRANTY_ENABLED', { default: false });
const dailyLimit = defineInt('SITE_WARRANTY_MAX_DAILY', { default: 50 });
// App ID do aplicativo WEB criado no Firebase para o formulario da Tray.
// Nao e o ID da loja, do tema Tray, nem o projectId do Firebase.
const publicApp = defineString('SITE_WARRANTY_APP_ID', { default: '' });

// Bucket confirmado no Firebase Storage do JapanFlow ERP.
const warrantyBucket = 'japanflow-erp.firebasestorage.app';

exports.receiveSiteWarranty = onCall(
  {
    region: 'southamerica-east1',
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    maxInstances: 2,
    concurrency: 4,
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: ['https://www.japanimports.com.br', 'https://japanimports.com.br'],
  },
  async (request) => {
    if (!enabled.value()) {
      throw new HttpsError(
        'unavailable',
        'Recebimento temporariamente indisponível. Fale com a equipe.'
      );
    }

    // O token App Check precisa ser do aplicativo Web dedicado ao site.
    // Tokens ja consumidos sao rejeitados (protecao contra replay).
    const allowedAppId = publicApp.value().trim();
    if (!allowedAppId || request.app?.appId !== allowedAppId || request.app?.alreadyConsumed) {
      throw new HttpsError('permission-denied', 'Verificação da solicitação necessária.');
    }

    const db = getFirestore();
    const receiptRef = (id) => db.doc('site_warranty_receipts/' + id);

    const intake = createIntake({
      timestamp: () => Timestamp.now(),
      reserve: async (data) =>
        db.runTransaction(async (tx) => {
          const ref = receiptRef(data.requestId);
          const snap = await tx.get(ref);
          const previous = snap.data();

          if (previous && previous.fingerprint !== data.fingerprint) {
            throw new IntakeError(
              'already-exists',
              'Identificador já utilizado. Inicie uma nova solicitação.'
            );
          }
          if (previous?.state === 'complete') {
            return { done: true, protocol: previous.protocol };
          }

          const now = Date.now();
          if (typeof previous?.lease_until === 'number' && previous.lease_until > now) {
            throw new IntakeError(
              'aborted',
              'Solicitação em processamento. Aguarde antes de tentar novamente.'
            );
          }

          const quota = receiptRef('quota-' + new Date().toISOString().slice(0, 10));
          const daily = await tx.get(quota);
          const count = daily.data()?.count ?? 0;
          if (!previous && count >= dailyLimit.value()) {
            throw new IntakeError(
              'resource-exhausted',
              'Recebimento temporariamente indisponível. Fale com a equipe.'
            );
          }

          const owner = randomUUID();
          if (!previous) tx.set(quota, { count: count + 1 });
          tx.set(ref, {
            fingerprint: data.fingerprint,
            state: 'receiving',
            owner,
            lease_until: now + 180000,
            updated_at: Timestamp.now(),
          });
          return { done: false, owner };
        }),

      saveFile: async (path, file) => {
        const object = getStorage().bucket(warrantyBucket).file(path);
        try {
          await object.save(file.bytes, {
            resumable: false,
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
              contentType: file.type,
              cacheControl: 'private, no-store',
              contentDisposition: 'attachment',
              metadata: { sha256: file.sha256, source: 'site-warranty' },
            },
          });
        } catch (error) {
          if (Number(error?.code) !== 412) throw error;
          // Reutilizacao segura: nunca aceitar arquivo preexistente diferente.
          const [meta] = await object.getMetadata();
          if (
            meta.metadata?.sha256 !== file.sha256 ||
            Number(meta.size) !== file.size ||
            meta.contentType !== file.type
          ) {
            throw error;
          }
        }
      },

      complete: async (data, owner, content) =>
        db.runTransaction(async (tx) => {
          const ref = receiptRef(data.requestId);
          const snap = await tx.get(ref);
          if (snap.data()?.owner !== owner || snap.data()?.state !== 'receiving') {
            throw new IntakeError('aborted', 'Solicitação em processamento. Aguarde.');
          }

          // Garantia e tarefa sao criadas na mesma transacao.
          tx.create(db.doc('warranty_claims/site_' + data.requestId), content.claim);
          tx.create(db.doc('tasks/warranty_site_' + data.requestId), content.task);
          tx.set(ref, {
            fingerprint: data.fingerprint,
            state: 'complete',
            protocol: content.protocol,
            updated_at: Timestamp.now(),
          });
        }),
    });

    try {
      return await intake(request.data);
    } catch (error) {
      if (error instanceof IntakeError) {
        throw new HttpsError(error.code, error.message);
      }
      // Nao expor payload, anexos nem erros internos na resposta.
      throw new HttpsError(
        'internal',
        'Não foi possível confirmar o recebimento. Tente novamente sem alterar os dados.'
      );
    }
  }
);