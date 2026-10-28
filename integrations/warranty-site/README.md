# Formulário de garantia: integração Tray

Fontes do formulário e do transporte para o receptor receiveSiteWarranty. O exemplo público está desativado e aponta para o projeto informado japanflow-erp; demais campos aguardam configuração real. Nenhuma credencial de funcionário pertence ao cliente.

## Gerar o JavaScript

Com as dependências de desenvolvimento da aplicação disponíveis:

```sh
node integrations/warranty-site/build.cjs
```

O arquivo tray/ji-garantia-formulario.js é um bundle rastreável dos fontes em src/. Usa esbuild e Prettier já presentes na árvore de desenvolvimento. Não adicionar frameworks ou dependências ao tema Tray.

O SDK Firebase permanece em imports dinâmicos oficiais, versão 12.18.0, carregados somente após uma tentativa de envio com configuração habilitada. O bundle não contém o SDK inteiro nem credenciais.

## Futura integração no tema, somente após autorização

- Incorporar formulario.html à página de garantia, dentro do layout institucional aprovado.
- Incluir styles/ji-garantia-formulario.css como asset escopado.
- Preparar uma cópia de config-publica.exemplo.js com a configuração pública aprovada e carregá-la antes do bundle, com DOM disponível.
- Manter enabled=false até os gates de ambiente real e autorização de ativação.
- Conferir que scripts, CSS, MIME e política de conteúdo funcionam na prévia do tema DEV 3577359.
- Não presumir que o CMS seja isolado por tema. Não salvar conteúdo global para fazer um teste DEV.
- Não colocar o formulário na homepage como implantação definitiva.

Os textos de garantia aprovados e os canais alternativos não devem ser substituídos por este fragmento.

## Limites

A configuração do bucket pertence ao backend/painel e continua pendente. O visitante não acessa Storage diretamente.
O transporte retém o ID de reenvio somente na memória da aba; recarregar a página pode gerar outra solicitação.
Otimização de fotos preserva a opção pelo original; o servidor não recomprime provas. Assinaturas de arquivos não substituem antivírus.
Consulte docs/warranty-site-integration.md antes de qualquer implantação.
