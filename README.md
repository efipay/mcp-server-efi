# Servidor MCP Efí

Servidor `stdio` que disponibiliza as APIs da Efí pelo Model Context Protocol (MCP). Os contratos públicos vêm do `sdk-node-apis-efi@2.0.0`; a documentação Efí é usada para redigir descrições úteis, sem alterar tipos ou validações do SDK.

O repositório canônico e a origem dos pacotes publicados é
[`efipay/mcp-server-efi`](https://github.com/efipay/mcp-server-efi). O
espelho `JoaoLucasAl/mcp-server-efi` preserva um histórico independente e recebe o
mesmo código e as mesmas tags, mas nunca executa deploy.

## Cobertura

O catálogo cobre 173 métodos. Por segurança, 170 tools são registradas por padrão; três operações que devolvem certificado, credenciais ou chave privada exigem opt-in explícito.

| API                 | Endpoints HTTP | Operações locais |
| ------------------- | -------------: | ---------------: |
| Cobranças           |             47 |                0 |
| Pix                 |             78 |                2 |
| Open Finance        |             26 |                0 |
| Pagamento de Contas |              7 |                0 |
| Abertura de Contas  |              7 |                0 |
| Extratos            |              6 |                0 |

O inventário SDK → tool → domínio → contexto está em [docs/tool-coverage.md](docs/tool-coverage.md). As decisões de protocolo e sua origem estão em [docs/architecture.md](docs/architecture.md).

Os nomes das tools usam `snake_case`. A entrada mantém o envelope `{ params, body }` apenas com as partes aplicáveis; mutações Open Finance compatíveis também aceitam `idempotency_key`. Quando ela é omitida, o servidor gera uma chave criptograficamente segura e a devolve no sucesso ou erro para permitir uma repetição consciente da mesma operação.

## Requisitos

- Node.js 22 ou superior.
- Client ID e Client Secret de uma aplicação Efí.
- Certificado para APIs mTLS. Somente uma seleção formada exclusivamente por `cobrancas` dispensa certificado.

## Credenciais e execução pela CLI

Credenciais não são aceitas em argumentos da linha de comando, pois argumentos podem aparecer no histórico do shell e na lista de processos. Copie o modelo, preencha-o e mantenha o arquivo fora do controle de versão:

```bash
cp .env.example .env.efi
chmod 600 .env.efi
```

Após compilar o projeto, o Node 22 pode carregar esse arquivo nativamente com
[`--env-file`](https://nodejs.org/download/release/v22.18.0/docs/api/cli.html#--env-fileconfig):

```bash
npm run build
node --env-file=.env.efi dist/src/index.js --apis=pix,open-finance
```

Para executar o pacote com `npx`, exporte o mesmo arquivo para o ambiente do processo:

```bash
set -a
. ./.env.efi
set +a
npx -y mcp-server-efi --apis=pix,open-finance
```

Sem `--apis`, os seis domínios são habilitados. Os valores aceitos são `cobrancas`, `pix`, `open-finance`, `pagamento-contas`, `abertura-contas` e `extratos`.

## Configuração

Somente opções não secretas possuem flags. Sua precedência é `CLI > EFI_* > variável legada`:

| CLI               | Ambiente `EFI_*`    | Legada          | Padrão      |
| ----------------- | ------------------- | --------------- | ----------- |
| `--sandbox`       | `EFI_SANDBOX`       | `SANDBOX`       | obrigatório |
| `--apis`          | `EFI_APIS`          | `APIS`          | todas       |
| `--cert-base64`   | `EFI_CERT_BASE64`   | `CERT_BASE64`   | `true`      |
| `--validate-mtls` | `EFI_VALIDATE_MTLS` | `VALIDATE_MTLS` | `true`      |
| `--cache`         | `EFI_CACHE`         | `CACHE`         | `true`      |
| `-h`, `--help`    | —                   | —               | —           |

Booleanos aceitam `true`, `false`, `1` e `0`.

Material de autenticação e valores sensíveis são aceitos exclusivamente pelas seguintes variáveis, sem flags ou aliases sem o prefixo `EFI_`:

| Variável            | Destino no SDK  | Obrigatoriedade                      |
| ------------------- | --------------- | ------------------------------------ |
| `EFI_CLIENT_ID`     | `client_id`     | sempre                               |
| `EFI_CLIENT_SECRET` | `client_secret` | sempre                               |
| `EFI_CERTIFICATE`   | `certificate`   | quando alguma API mTLS estiver ativa |
| `EFI_PEM_KEY`       | `pemKey`        | certificado PEM com chave separada   |
| `EFI_PARTNER_TOKEN` | `partner_token` | somente integrações compatíveis      |

Não existe chave global de idempotência: cada uma das 17 mutações Open Finance recebe a chave explícita da chamada ou uma nova chave alfanumérica de 72 caracteres. Valores vazios e CR/LF são rejeitados.

### Saídas sensíveis

Estas tools não aparecem em `tools/list` por padrão:

- `create_account_certificate`
- `get_account_credentials`
- `create_sftp_key`

Para habilitar somente as necessárias, configure simultaneamente:

```dotenv
EFI_SENSITIVE_TOOLS=create_account_certificate,get_account_credentials
EFI_ACCEPT_SENSITIVE_OUTPUT_RISK=I_UNDERSTAND
```

Não são aceitos `*`, `all`, aliases, flags de CLI ou confirmação dentro de uma chamada MCP. Uma seleção incompleta, desconhecida ou pertencente a uma API desabilitada impede a inicialização.

### Contenção

O processo rejeita excesso de chamadas imediatamente, sem criar fila nem chamar o SDK. O resultado usa `isError: true`, `rate_limit_exceeded` e `retry_after_ms`.

| Variável                        | Padrão |
| ------------------------------- | -----: |
| `EFI_MAX_CONCURRENCY`           |      4 |
| `EFI_MUTATION_MAX_CONCURRENCY`  |      1 |
| `EFI_READ_RATE_PER_MINUTE`      |     60 |
| `EFI_MUTATION_RATE_PER_MINUTE`  |     10 |
| `EFI_SENSITIVE_RATE_PER_MINUTE` |      1 |

## Configuração de um host MCP

Clientes MCP que iniciam servidores `stdio` normalmente fornecem as credenciais pelo campo `env` do subprocesso. Essa é a orientação da
[especificação de autorização MCP para servidores locais](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization). Ajuste caminhos e valores conforme o cliente:

```json
{
  "mcpServers": {
    "mcp-server-efi": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-efi",
        "--sandbox=true",
        "--apis=pix,open-finance",
        "--cert-base64=false"
      ],
      "env": {
        "EFI_CLIENT_ID": "seu_client_id",
        "EFI_CLIENT_SECRET": "seu_client_secret",
        "EFI_CERTIFICATE": "/caminho/absoluto/certificado.p12"
      }
    }
  }
}
```

Se o host oferecer keychain, cofre ou substituição segura de segredos, prefira esse recurso a valores literais no arquivo de configuração. O exemplo completo do repositório está em [mcp.jsonc](mcp.jsonc).

## Docker

A imagem usa Node 22, build em múltiplos estágios e processo final sem privilégios de
root. NPM, Corepack e Yarn são removidos da camada final depois da instalação: o
runtime contém o executável `node` e as dependências de produção, mas não inclui um
gerenciador de pacotes.

```bash
docker build -t mcp-server-efi:1.0.0 .

docker run -i --rm \
  --env-file .env.efi \
  --mount type=bind,source=/caminho/absoluto/certificado.p12,target=/run/secrets/efi.p12,readonly \
  --env EFI_CERTIFICATE=/run/secrets/efi.p12 \
  mcp-server-efi:1.0.0 \
  --apis=pix,open-finance
```

O bind mount torna o caminho do certificado válido dentro do contêiner; ele deve ser legível pelo usuário `node`. Como alternativa, grave o certificado em base64 no arquivo de ambiente e use `EFI_CERT_BASE64=true`, sem mount. O arquivo `.dockerignore` impede que arquivos `.env` e formatos usuais de certificados sejam enviados no contexto de build.

## Smithery e MCPB

Servidores locais `stdio` podem ser distribuídos pelo Smithery como MCP Bundle,
sem uma URL pública. O [manifesto MCPB 0.3](manifest.json) marca credenciais e
certificados como configurações sensíveis e os encaminha ao processo por `EFI_*`,
nunca por `args`.

O instalador MCPB seleciona somente `cobrancas` por padrão. Por isso ele pode iniciar
sem certificado mTLS; ao acrescentar Pix, Open Finance, Pagamento de Contas, Abertura
de Contas ou Extratos, o certificado volta a ser obrigatório. Esse padrão é
deliberadamente diferente da CLI: sem `--apis` ou `EFI_APIS`, a CLI habilita os seis
domínios.

```bash
npx --yes smithery@1.2.0 auth login
npx --yes smithery@1.2.0 auth whoami
npx --yes smithery@1.2.0 namespace use efipay
npm run mcpb:pack
VERSION="$(node -p "require('./package.json').version")"
npx --yes smithery@1.2.0 mcp publish \
  "./mcp-server-efi-$VERSION.mcpb" \
  -n efipay/mcp-server-efi
```

O mesmo bundle é publicado no Smithery e anexado ao GitHub Release. Nunca informe
a chave do Smithery em `args`, no manifesto ou em arquivo rastreado. Em CI, use
exclusivamente o secret `SMITHERY_API_KEY` do repositório canônico.

## Contratos e respostas MCP

- `params`, `body` e respostas usam os schemas Zod 4 exportados pelo SDK oficial.
- Respostas JSON são fornecidas como texto e em `structuredContent.result`.
- Operações sem conteúdo retornam `{ "success": true }`.
- Comprovantes Pix são expostos como recursos PDF; QR Codes podem incluir conteúdo de imagem.
- `pix_qr_code_detail` preserva o JWS obtido pelo mesmo decoder usado no SDK, exige que `jku` tenha a mesma origem do payload acessado e verifica a assinatura com o `kid` do JWKS. Estados `invalid` e `unavailable` são alertas e não autorizam pagamento.
- Falhas de validação ou da Efí retornam `isError: true`, com dados sensíveis sanitizados.
- `stdout` é reservado ao protocolo; mensagens operacionais são escritas em `stderr`.

Os arquivos em `contexto/` são insumo de desenvolvimento para descrições e rastreabilidade. Eles não são carregados em runtime, publicados como MCP Resources ou usados como fonte de contratos.

## Desenvolvimento e segurança

```bash
npm ci
npm run check
npm run catalog:report
npm pack --dry-run
npm audit --audit-level=low
npm run audit:artifact
```

Para auditar sem reempacotar um arquivo já produzido:

```bash
npm run audit:artifact -- ./mcp-server-efi-1.0.0.tgz
```

Depois que os commits equivalentes existirem nos dois clones limpos, confira a
versão, a lista de arquivos rastreados e o hash da árvore:

```bash
npm run mirror:check -- /caminho/para/o/outro/clone
```

- Não são aceitos headers arbitrários nas tools.
- Não registre credenciais, tokens, certificados ou conteúdo PEM no repositório ou em logs.
- Mantenha `validate-mtls=true`, salvo quando o fluxo Efí aplicável exigir configuração sem validação mTLS.
- A auditoria do pacote consumidor aceita temporariamente apenas o advisory Hono documentado em [SECURITY.md](SECURITY.md); qualquer outro advisory bloqueia a publicação.
- Consulte [MIGRATION.md](MIGRATION.md) antes de migrar de versões 0.x.
- O procedimento de tag e os pré-requisitos dos três canais estão em [docs/releasing.md](docs/releasing.md).
