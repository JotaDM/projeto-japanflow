# JapanFlow 1.6 — Preparação de migração departamental

Os módulos de rastreamentos, envios reversos e garantias já existem. **Não existe origem de dados legados fornecida**, então este pacote NÃO grava registros no Firestore nem realiza migração de produção.

1. Exporte dados do sistema antigo para CSV (sem credenciais nem dados desnecessários).
2. Adeque os cabeçalhos aos modelos CSV nesta pasta. Preserve `legacy_id` único para evitar duplicação ao importar no futuro.
3. Execute `node scripts/audit-departmental-import.mjs arquivo.csv tracking` (ou `reverse`/`warranties`).
4. Revise mapeamento real de status, usuários, datas e IDs antes de qualquer importação.
5. Após aprovar a origem e as regras, implementar uma importação **idempotente, reversível, com dry-run** e testar no emulador antes de produção.

Os CSVs são modelos vazios, não são um contrato definitivo de schema Firestore.
