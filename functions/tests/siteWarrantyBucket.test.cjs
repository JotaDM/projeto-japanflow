const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'siteWarrantyFirebase.cjs'), 'utf8');
test('receptor utiliza exclusivamente o bucket confirmado', () => {
  assert.match(source, /getStorage\(\)\.bucket\(warrantyBucket\)\.file\(path\)/);
  assert.match(source, /warrantyBucket = 'japanflow-erp\.firebasestorage\.app'/);
  assert.doesNotMatch(source, /getStorage\(\)\.bucket\(\)\.file/);
});
test('formulario publico continua bloqueado por padrao', () => {
  assert.match(source, /defineBoolean\('SITE_WARRANTY_ENABLED', \{ default: false \}\)/);
  assert.match(source, /enforceAppCheck: true/);
  assert.match(source, /consumeAppCheckToken: true/);
});
