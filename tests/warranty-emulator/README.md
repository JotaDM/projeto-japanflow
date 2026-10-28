# Testes isolados de garantias

Esta suíte fixa o projeto demo-japanflow-warranty-local e hosts locais. Recusa projeto real, host remoto e credencial de serviço antes de importar Firebase. Usa somente dados fictícios.

## Requisitos e execução

Node 22 ou superior, Java adequado aos emuladores (homologado com Java 21) e dependências desta pasta:

```sh
cd tests/warranty-emulator
npm install --ignore-scripts --no-audit --no-fund
node --test isolation.test.cjs
node run.cjs
```

A primeira execução do Firebase CLI pode baixar os binários oficiais dos emuladores. Nenhum login Firebase é necessário. O runner define o projeto demo e encerra os emuladores após os testes. Cache e configuração ficam em .local/; não versionar ferramentas, logs, caches ou dados fictícios.

A biblioteca de testes 5.0.2 foi escolhida por declarar compatibilidade com Firebase 12. A dependência 6 declarada no package.json raiz exige Firebase 13; este PR não altera as dependências da aplicação para contornar essa inconsistência.

## O que é validado

- Regras reais do repositório para Firestore e Storage emulados.
- Acesso de visitante, funcionário ativo/inativo e usuário sem vínculo.
- Privacidade de anexos e dos recibos de idempotência.
- Adaptador candidato usando Admin SDK real nos emuladores: criação de garantia+tarefa, concorrência e anexo com bytes/SHA-256 idênticos.

O wrapper callable, os parâmetros e a prova de App Check são simulados. A suíte não comprova App Check/reCAPTCHA, IAM, CORS ou serviço hospedado.
