'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const core = require('../siteWarranty.cjs');
const { normalize, records, createIntake } = core;
const base = () => ({
  requestId: '00000000-0000-4000-8000-000000000001',
  name: 'Cliente fictício',
  order: '#0012',
  channel: 'E-mail',
  contact: 'teste@example.com',
  product: 'Peça de teste',
  received: '2020-01-02',
  installed: 'Não',
  vehicle: '',
  problem: 'Problema fictício para teste',
  notes: '',
  files: [],
});
const png = {
  name: 'teste.png',
  type: 'image/png',
  base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUTkAAAAASUVORK5CYII=',
};
test('mapping: Site, correct status, no invented sale date, invoice or brand', () => {
  const d = normalize(base());
  const r = records(d, [], 123, Date.now());
  assert.equal(r.claim.requested_by, 'site');
  assert.equal(r.claim.status, 'pendente');
  assert.equal(r.claim.site_order, '#0012');
  assert.equal(r.claim.sale_date, '');
  assert.equal(r.claim.invoice_number, '');
  assert.equal(r.claim.product_brand, '');
  assert.equal(r.task.assignee_id, 'emp-12');
  assert.equal(r.task.created_by, 'Site');
  assert.equal(r.task.warranty_id, 'site_' + d.requestId);
});
for (const [label, patch] of [
  ['missing receipt', { received: '' }],
  ['missing installation', { installed: '' }],
  ['future date', { received: '2999-01-01' }],
  ['impossible date', { received: '2020-02-31' }],
  ['invalid order', { order: '#12345' }],
  ['invalid email', { contact: 'invalid' }],
  ['invalid channel', { channel: 'sms' }],
  ['missing name', { name: '' }],
  ['short problem', { problem: 'x' }],
  ['oversized text', { notes: 'x'.repeat(1501) }],
  ['spoofed author', { requested_by: 'admin' }],
  ['spoofed status', { status: 'aprovada' }],
  ['invalid ID', { requestId: '../foo' }],
  ['too many files', { files: Array(6).fill(png) }],
  ['wrong media type', { files: [{ ...png, type: 'application/pdf' }] }],
  [
    'script disguised as image',
    { files: [{ ...png, base64: Buffer.from('<script>alert(1)</script>').toString('base64') }] },
  ],
  ['invalid base64', { files: [{ ...png, base64: '%%%=' }] }],
  ['unsafe filename', { files: [{ ...png, name: '../test.png' }] }],
])
  test('rejects ' + label, () =>
    assert.throws(() => normalize({ ...base(), ...patch }), { code: 'invalid-argument' })
  );
test('optional order and no evidence do not prevent request', () =>
  assert.equal(normalize({ ...base(), order: '', files: [] }).files.length, 0));
test('approved HEIC and MOV containers are retained without recompression', () => {
  for (const [brand, type, name] of [
    ['heic', 'image/heic', 'x.heic'],
    ['qt  ', 'video/quicktime', 'x.mov'],
  ]) {
    const bytes = Buffer.from('\x00\x00\x00\x18ftyp' + brand + '\x00\x00\x00\x00', 'binary');
    const file = { name, type, base64: bytes.toString('base64') };
    assert.equal(normalize({ ...base(), files: [file] }).files[0].type, type);
  }
});
test('WhatsApp validation', () =>
  assert.equal(
    normalize({ ...base(), channel: 'WhatsApp', contact: '(12) 99999-0000' }).fields.channel,
    'WhatsApp'
  ));
test('PNG signature and digest; total byte limit', () => {
  const d = normalize({ ...base(), files: [png] });
  assert.equal(d.files[0].sha256.length, 64);
  const big = Buffer.alloc(core.MAX_BYTES + 1);
  Buffer.from([255, 216, 255]).copy(big);
  assert.throws(() =>
    normalize({
      ...base(),
      files: [{ name: 'x.jpg', type: 'image/jpeg', base64: big.toString('base64') }],
    })
  );
});
test('uncertain upload never reports success', async () => {
  let done = false;
  const intake = createIntake({
    reserve: async () => ({ owner: 'a' }),
    saveFile: async () => {
      throw Error('offline');
    },
    complete: async () => {
      done = true;
    },
  });
  await assert.rejects(intake({ ...base(), files: [png] }));
  assert.equal(done, false);
});
function firebaseHarness({ enabled = true, appId = 'public-app', limit = 50 } = {}) {
  const docs = new Map(),
    objects = new Map();
  let clock = Date.now(),
    failFile = false,
    failComplete = false;
  let tail = Promise.resolve();
  let definition;
  const db = {
    doc: (p) => ({ path: p }),
    runTransaction: (callback) => {
      const job = tail.then(async () => {
        const writes = [];
        const tx = {
          get: async (ref) => ({ data: () => docs.get(ref.path), exists: docs.has(ref.path) }),
          set: (ref, data) => writes.push({ ref, data }),
          create: (ref, data) => {
            if (docs.has(ref.path)) throw Error('already exists');
            writes.push({ ref, data });
          },
        };
        const result = await callback(tx);
        if (failComplete && writes.some((w) => w.ref.path.startsWith('warranty_claims/')))
          throw Error('commit failed');
        for (const w of writes) docs.set(w.ref.path, w.data);
        return result;
      });
      tail = job.catch(() => {});
      return job;
    },
  };
  const storage = {
    bucket: () => ({
      file: (p) => ({
        save: async (bytes, opts) => {
          if (failFile) throw Error('file unavailable');
          if (objects.has(p)) {
            const e = new Error('precondition');
            e.code = 412;
            throw e;
          }
          objects.set(p, {
            bytes,
            metadata: opts.metadata.metadata,
            size: bytes.length,
            contentType: opts.metadata.contentType,
            opts,
          });
        },
        getMetadata: async () => [objects.get(p)],
      }),
    }),
  };
  const FakeDate = class extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
  const exports = {};
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const modules = {
    'firebase-functions/v2/https': {
      onCall: (opts, fn) => {
        definition = opts;
        return fn;
      },
      HttpsError,
    },
    'firebase-functions/params': {
      defineBoolean: () => ({ value: () => enabled }),
      defineInt: () => ({ value: () => limit }),
      defineString: () => ({ value: () => appId }),
    },
    'firebase-admin/firestore': { getFirestore: () => db, Timestamp: { now: () => clock } },
    'firebase-admin/storage': { getStorage: () => storage },
    'node:crypto': require('node:crypto'),
    './siteWarranty.cjs': core,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../siteWarrantyFirebase.cjs'), 'utf8'), {
    exports,
    require: (id) => {
      if (!modules[id]) throw Error('unexpected module');
      return modules[id];
    },
    Date: FakeDate,
  });
  return {
    docs,
    objects,
    definition,
    send: (input = base(), app = { appId: 'public-app' }) =>
      exports.receiveSiteWarranty({ data: input, app }),
    advance: () => {
      clock += 180001;
    },
    failFile: (v) => {
      failFile = v;
    },
    failComplete: (v) => {
      failComplete = v;
    },
  };
}
test('adapter enforces App Check, limited-use tokens and restricted origin', () => {
  const h = firebaseHarness();
  assert.equal(h.definition.enforceAppCheck, true);
  assert.equal(h.definition.consumeAppCheckToken, true);
  assert.equal(h.definition.cors.length, 2);
});
test('disabled receiver does not write', async () => {
  const h = firebaseHarness({ enabled: false });
  await assert.rejects(h.send(), { code: 'unavailable' });
  assert.equal(h.docs.size, 0);
});
for (const app of [undefined, { appId: 'foreign' }, { appId: 'public-app', alreadyConsumed: true }])
  test('rejects missing, foreign or replayed app proof ' + JSON.stringify(app), async () => {
    const h = firebaseHarness();
    const supplied = app === undefined ? null : app;
    await assert.rejects(h.send(base(), supplied), { code: 'permission-denied' });
    assert.equal(h.docs.size, 0);
  });
test('direct claim and task are committed once, retry returns same protocol', async () => {
  const h = firebaseHarness();
  const a = await h.send({ ...base(), files: [png] });
  const b = await h.send({ ...base(), files: [png] });
  assert.equal(a.protocol, b.protocol);
  assert.equal(h.objects.size, 1);
  assert.equal([...h.docs.keys()].filter((k) => k.startsWith('warranty_claims/')).length, 1);
  assert.equal([...h.docs.keys()].filter((k) => k.startsWith('tasks/')).length, 1);
  const object = [...h.objects.values()][0];
  assert.equal(object.opts.preconditionOpts.ifGenerationMatch, 0);
  assert.equal(object.opts.metadata.cacheControl, 'private, no-store');
  assert.equal(object.opts.metadata.metadata.firebaseStorageDownloadTokens, undefined);
  assert.deepEqual(Object.keys(a).sort(), ['protocol', 'received']);
});
test('same ID with modified payload is rejected', async () => {
  const h = firebaseHarness();
  await h.send();
  await assert.rejects(h.send({ ...base(), problem: 'Outro problema fictício' }), {
    code: 'already-exists',
  });
});
test('failed atomic commit cannot leave a claim without a task; safe retry', async () => {
  const h = firebaseHarness();
  h.failComplete(true);
  await assert.rejects(h.send({ ...base(), files: [png] }), { code: 'internal' });
  assert.equal(
    [...h.docs.keys()].some((k) => k.startsWith('warranty_claims/')),
    false
  );
  h.failComplete(false);
  h.advance();
  await h.send({ ...base(), files: [png] });
  assert.equal(h.objects.size, 1);
  assert.equal([...h.docs.keys()].filter((k) => k.startsWith('tasks/')).length, 1);
});
test('failed file upload never creates a claim; retry after lease', async () => {
  const h = firebaseHarness();
  h.failFile(true);
  await assert.rejects(h.send({ ...base(), files: [png] }));
  assert.equal(
    [...h.docs.keys()].some((k) => k.startsWith('warranty_claims/')),
    false
  );
  h.failFile(false);
  h.advance();
  await h.send({ ...base(), files: [png] });
  assert.equal([...h.docs.keys()].filter((k) => k.startsWith('warranty_claims/')).length, 1);
});
test('simultaneous requests are protected by lease and create exactly one claim', async () => {
  const h = firebaseHarness();
  const results = await Promise.allSettled([h.send(), h.send()]);
  assert.ok(results.some((r) => r.status === 'fulfilled'));
  assert.equal([...h.docs.keys()].filter((k) => k.startsWith('warranty_claims/')).length, 1);
});
test('daily guard blocks new requests but preserves completed retry', async () => {
  const h = firebaseHarness({ limit: 1 });
  await h.send();
  await assert.rejects(h.send({ ...base(), requestId: '00000000-0000-4000-8000-000000000002' }), {
    code: 'resource-exhausted',
  });
  assert.equal((await h.send()).received, true);
});
test('customer transport keeps retry ID, prevents double send and sends no fake success', async () => {
  const { createWarrantyTransport } = await import(
    pathToFileURL(path.join(__dirname, '../../integrations/warranty-site/src/transporte.mjs'))
  );
  const calls = [];
  let fail = true;
  const send = createWarrantyTransport(async (payload) => {
    calls.push(payload);
    if (fail) throw Error('uncertain');
    return { data: { received: true, protocol: 'JI-TESTE' } };
  });
  const fields = { ...base() };
  delete fields.requestId;
  delete fields.files;
  await assert.rejects(send(fields));
  fail = false;
  await send(fields);
  await send(fields);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].requestId, calls[1].requestId);
  await send({ ...fields, notes: 'Alteração fictícia' });
  assert.notEqual(calls[1].requestId, calls[2].requestId);
  let resolve, started;
  const ready = new Promise((r) => {
    started = r;
  });
  const slow = createWarrantyTransport(
    () =>
      new Promise((r) => {
        resolve = r;
        started();
      })
  );
  const first = slow(fields);
  await ready;
  await assert.rejects(slow(fields));
  resolve({ data: { received: true, protocol: 'JI-TESTE' } });
  await first;
  const invalid = createWarrantyTransport(async () => ({ data: { received: false } }));
  await assert.rejects(invalid(fields));
});
