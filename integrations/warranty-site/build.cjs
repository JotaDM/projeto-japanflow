'use strict';
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const prettier = require('prettier');

(async () => {
  const output = path.join(__dirname, 'tray/ji-garantia-formulario.js');
  const result = await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: ['src/entrada.mjs'],
    outfile: output,
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    external: ['https://*'],
    write: false,
    logLevel: 'silent',
  });
  const configuration = (await prettier.resolveConfig(output)) || {};
  const source = await prettier.format(result.outputFiles[0].text, {
    ...configuration,
    filepath: output,
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, source, 'utf8');
  console.log('Bundle Tray gerado; nenhum upload ou ativação.');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
