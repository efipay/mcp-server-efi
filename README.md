# Servidor MCP Efí

Servidor MCP oficial da Efí, executado via `stdio`, que disponibiliza as APIs da
Efí pelo Model Context Protocol (MCP). Os contratos públicos acompanham as
atualizações compatíveis do `sdk-node-apis-efi` 2.x; a documentação Efí é usada
para redigir descrições úteis, sem alterar tipos ou validações do SDK.

Este é o [repositório oficial do projeto](https://github.com/efipay/mcp-server-efi)
e a origem dos pacotes publicados pela Efí.

## Cobertura

O catálogo cobre e registra por padrão os 173 métodos. As três operações que
devolvem certificado, credenciais ou chave privada aparecem na descoberta, mas
sua execução exige opt-in explícito.

| API                 | Endpoints HTTP | Operações locais |
| ------------------- | -------------: | ---------------: |
| Cobranças           |             47 |                0 |
| Pix                 |             78 |                2 |
| Open Finance        |             26 |                0 |
| Pagamento de Contas |              7 |                0 |
| Abertura de Contas  |              7 |                0 |
| Extratos            |              6 |                0 |

Os nomes das tools usam `snake_case`. A entrada mantém o envelope `{ params, body }` apenas com as partes aplicáveis; mutações Open Finance compatíveis também aceitam `idempotency_key`. Quando ela é omitida, o servidor gera uma chave criptograficamente segura e a devolve no sucesso ou erro para permitir uma repetição consciente da mesma operação.

## Requisitos

- Node.js 22 ou superior.
- Client ID e Client Secret de uma aplicação Efí para executar endpoints HTTP.
- Certificado ao executar APIs mTLS.

O servidor pode iniciar, completar o handshake e apresentar seu catálogo sem
credenciais. A configuração necessária é verificada somente quando uma tool
realiza uma operação HTTP; chamadas locais de inspeção e geração de QR Code Pix
continuam disponíveis.

## Credenciais e execução pela CLI

Credenciais são opcionais no startup e não são aceitas em argumentos da linha de comando, pois argumentos
podem aparecer no histórico do shell e na lista de processos. Crie um arquivo
local `.env.efi`, mantenha-o fora do controle de versão e restrinja sua leitura:

```dotenv
EFI_CLIENT_ID=seu_client_id
EFI_CLIENT_SECRET=seu_client_secret
EFI_SANDBOX=true
EFI_CERTIFICATE=/caminho/absoluto/certificado.p12
```

```bash
chmod 600 .env.efi
```

Para executar o pacote com `npx`, carregue o arquivo somente no ambiente do
processo:

```bash
set -a
. ./.env.efi
set +a
npx -y mcp-server-efi --apis=pix,open-finance
```

Sem `--apis`, os seis domínios são habilitados. Os valores aceitos são `cobrancas`, `pix`, `open-finance`, `pagamento-contas`, `abertura-contas` e `extratos`.

## Configuração

Somente opções não secretas possuem flags. Sua precedência é `CLI > EFI_* > variável legada`:

| CLI               | Ambiente `EFI_*`    | Legada          | Padrão |
| ----------------- | ------------------- | --------------- | ------ |
| `--sandbox`       | `EFI_SANDBOX`       | `SANDBOX`       | `true` |
| `--apis`          | `EFI_APIS`          | `APIS`          | todas  |
| `--cert-base64`   | `EFI_CERT_BASE64`   | `CERT_BASE64`   | `true` |
| `--validate-mtls` | `EFI_VALIDATE_MTLS` | `VALIDATE_MTLS` | `true` |
| `--cache`         | `EFI_CACHE`         | `CACHE`         | `true` |
| `-h`, `--help`    | —                   | —               | —      |

Booleanos aceitam `true`, `false`, `1` e `0`.

O mTLS é usado na comunicação com os endpoints que recebem webhooks compatíveis.
A opção `validate-mtls` deve permanecer em `true` para manter essa proteção;
quando definida como `false`, o SDK envia o bypass de validação somente durante a
configuração do webhook. Por segurança, não recomendamos desabilitá-la.

Material de autenticação e valores sensíveis são aceitos exclusivamente pelas seguintes variáveis, sem flags ou aliases sem o prefixo `EFI_`:

| Variável            | Destino no SDK  | Obrigatoriedade                    |
| ------------------- | --------------- | ---------------------------------- |
| `EFI_CLIENT_ID`     | `client_id`     | em chamadas HTTP                   |
| `EFI_CLIENT_SECRET` | `client_secret` | em chamadas HTTP                   |
| `EFI_CERTIFICATE`   | `certificate`   | na chamada de uma API mTLS         |
| `EFI_PEM_KEY`       | `pemKey`        | certificado PEM com chave separada |
| `EFI_PARTNER_TOKEN` | `partner_token` | somente integrações compatíveis    |

Não existe chave global de idempotência: cada uma das 17 mutações Open Finance recebe a chave explícita da chamada ou uma nova chave alfanumérica de 72 caracteres. Valores vazios e CR/LF são rejeitados.

### Saídas sensíveis

Estas tools aparecem em `tools/list`, mas sua execução é bloqueada por padrão:

- `create_account_certificate`
- `get_account_credentials`
- `create_sftp_key`

Para autorizar somente as necessárias, configure simultaneamente:

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
docker pull ghcr.io/efipay/mcp-server-efi:1.0.2

docker run -i --rm \
  --env-file .env.efi \
  --mount type=bind,source=/caminho/absoluto/certificado.p12,target=/run/secrets/efi.p12,readonly \
  --env EFI_CERTIFICATE=/run/secrets/efi.p12 \
  ghcr.io/efipay/mcp-server-efi:1.0.2 \
  --apis=pix,open-finance
```

O bind mount torna o caminho do certificado válido dentro do contêiner; ele deve
ser legível pelo usuário `node`. Como alternativa, grave o certificado em base64
no arquivo de ambiente e use `EFI_CERT_BASE64=true`, sem mount.

## Instalação via Smithery e MCPB

Na [página oficial do servidor no Smithery](https://smithery.ai/servers/efipay/mcp-server-efi),
o servidor é fornecido como MCP Bundle e executado localmente via `stdio`, sem
uma URL pública. O [manifesto MCPB 0.3](manifest.json)
marca credenciais e certificados como configurações sensíveis e os encaminha ao
processo por `EFI_*`, nunca por `args`.

O MCPB aceita configuração vazia e apresenta as 173 tools dos seis domínios.
Credenciais e certificado podem ser adicionados pela interface segura do cliente
antes de executar os endpoints correspondentes.

## Contratos e respostas MCP

- `params`, `body` e respostas usam os schemas Zod 4 exportados pelo SDK oficial.
- Respostas JSON são fornecidas como texto e em `structuredContent.result`.
- Operações sem conteúdo retornam `{ "success": true }`.
- Comprovantes Pix retornam a URI e o identificador em `structuredContent.result`
  e mantêm o conteúdo binário somente no recurso PDF embutido; QR Codes podem
  incluir conteúdo de imagem.
- `pix_qr_code_detail` preserva o JWS obtido pelo mesmo decoder usado no SDK, exige que `jku` tenha a mesma origem do payload acessado e verifica a assinatura com o `kid` do JWKS. Estados `invalid` e `unavailable` são alertas e não autorizam pagamento.
- Falhas de validação ou da Efí retornam `isError: true`, com dados sensíveis sanitizados.
- `stdout` é reservado ao protocolo; mensagens operacionais são escritas em `stderr`.

## Segurança e atualização

- Não são aceitos headers arbitrários nas tools.
- Não registre credenciais, tokens, certificados ou conteúdo PEM em arquivos
  versionados ou logs.
- Mantenha `validate-mtls=true`; o mTLS protege a comunicação dos webhooks
  compatíveis e, por segurança, não recomendamos desabilitá-lo.
- Consulte a [política de segurança](SECURITY.md) para comunicar vulnerabilidades.
- Consulte [MIGRATION.md](MIGRATION.md) antes de migrar de versões 0.x.
