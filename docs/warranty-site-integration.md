# Garantias recebidas pelo site

Solicitações do formulário entram diretamente em warranty_claims e aparecem na aba Garantias existente, com requested_by=site exibido como Site. Não é criada outra aba ou um usuário fictício.

## Configuração e estado inicial

O receptor receiveSiteWarranty permanece desativado por padrão (SITE_WARRANTY_ENABLED=false).
A configuração pública do formulário também tem enabled=false.

Projeto informado pelo responsável: japanflow-erp. O nome do bucket será informado posteriormente. O código do receptor usa o bucket default do Admin SDK; é obrigatório conferir que coincide com o destino utilizado pelo painel. Não inferir o destino pelo alias default do CLI.

Parâmetros:

- SITE_WARRANTY_APP_ID: App ID web público que pode chamar o receptor.
- SITE_WARRANTY_MAX_DAILY: limite de novas solicitações por dia UTC, padrão 50, a revisar antes da ativação.
- SITE_WARRANTY_ENABLED: habilitação do recebimento.

A região é southamerica-east1 no cliente e no receptor. App Check é obrigatório, com tokens de uso limitado. A identidade da função precisa das permissões adequadas de verificação e de acesso aos destinos confirmados.

## Dados e integridade

- Pedido do site, recebimento, contato, instalação, veículo e observações ficam em campos próprios. Não são inventados data da venda, nota fiscal, fornecedor ou marca.
- Garantia e tarefa são criadas juntas na transação final. A atribuição emp-12 preserva a criação manual atual; confirmar que continua adequada antes de ativar.
- Reenvio com o mesmo requestId e conteúdo retorna o mesmo protocolo. Conteúdo diferente com o mesmo ID é recusado.
- Uploads são privados, sem tokens de download permanentes. Podem restar arquivos de uma tentativa interrompida: não apagar automaticamente sem política aprovada.
- Até cinco anexos e 10 MiB no total. Tipo declarado e assinatura inicial são comparados; isso não é análise antimalware.
- Não há recusa automática por idade da peça ou por falta de anexos.

## Verificações locais

```sh
node --test functions/tests/siteWarranty.test.cjs
npx tsc -p tsconfig.app.json --noEmit
npx vitest run src/components/__tests__/WarrantySiteDetails.test.tsx
npx vite build
node integrations/warranty-site/build.cjs
```

Usar os executáveis locais já instalados; não permitir que npx instale ferramentas ausentes sem aprovação. A suíte separada tests/warranty-emulator documenta os testes de regras e transações.

## Sequência de liberação, ainda não autorizada

1. Revisar o diff sobre feat/1.4-A-chat e a revisão efetivamente implantada.
2. Confirmar projeto, bucket, aplicativo público, App Check, permissões e destinatário da tarefa.
3. Autorizar separadamente implantação do receptor/regras/UI, mantendo o recebimento desligado. Não implantar funções não relacionadas.
4. Autorizar a integração do formulário no tema DEV e provar que o CMS global não é alterado.
5. Autorizar teste restrito com dados fictícios: recebimento, Solicitante Site, anexo privado, recusa anônima, reenvio, falha de rede, teclado e responsividade.
6. Somente após revisão e autorização específica, liberar ao público.

A implantação não está autorizada por este PR. Nenhum arquivo de ambiente, token ou conta de serviço deve ser enviado pela conversa ou incluído na configuração pública.

## Interrupção e reversão

Desabilitar cliente e receptor por ação autorizada e preservar os canais alternativos.
Reverter somente os hunks desta integração, considerando alterações posteriores. Não restaurar um index.js ou arquivo de regras antigo sobre código mais recente.
Não apagar garantias, tarefas, recibos ou anexos como rollback; manter a proteção dos recibos.
A revisão local ensaiou aplicação e reversão com comparação binária, sem alterar repositórios reais. Preservar finais de linha e atributos do repositório.

## Limitações

App Check real, IAM, CORS, bucket hospedado e compatibilidade final com o runtime Tray continuam pendentes.
O teste React usa DOM simulado e leitura de arquivo mockada; a autorização e os bytes foram testados separadamente no Storage emulado.
Os locks da aplicação têm inconsistências preexistentes. A homologação local fixou as versões diretas do lock público em cópia isolada; essa árvore não é prova das dependências usadas em produção.
