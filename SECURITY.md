# Segurança

## Relato de vulnerabilidades

Não abra uma issue pública contendo credenciais, certificados, tokens ou uma prova de conceito ainda explorável. Use o canal privado de segurança do repositório no GitHub para enviar impacto, versão afetada, passos mínimos de reprodução e uma forma de contato.

## Modelo de segredos

O servidor usa transporte local `stdio`. Credenciais Efí entram exclusivamente por variáveis `EFI_*`; flags secretas são rejeitadas. Certificados, tokens e respostas de erro passam por sanitização antes de qualquer conteúdo ser devolvido ao cliente MCP. As três tools que produzem material secreto ficam ocultas até que uma allowlist e o aceite literal `I_UNDERSTAND` sejam configurados no processo.

## Exceção temporária do Hono no pacote npm

O projeto executa somente `StdioServerTransport` e não chama `serve-static`. Mesmo assim, ao instalar o `.tgz`, o npm ignora o override da aplicação e pode resolver `@hono/node-server@1.19.14` pela dependência oficial `@modelcontextprotocol/sdk@1.29.0`.

A única exceção aceita é:

| Campo                    | Valor                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| Advisory                 | `GHSA-frvp-7c67-39w9`                                                |
| Pacote                   | `@hono/node-server`                                                  |
| Severidade máxima        | `moderate`                                                           |
| Caminho permitido        | `mcp-server-efi` → `@modelcontextprotocol/sdk` → `@hono/node-server` |
| Superfície não utilizada | servidor HTTP e `serve-static`                                       |
| Revisão obrigatória      | 2026-10-27 ou assim que o MCP SDK corrigir a faixa                   |

O gate `npm run audit:artifact` instala o pacote em um projeto consumidor, executa a auditoria real com TLS habilitado e valida advisory, severidade, caminho e prazo. Não há `|| true` nem supressão genérica. Novo advisory, mudança de caminho, aumento de severidade, uso de transporte HTTP ou expiração da data bloqueiam a publicação.

A árvore local usa o override `@hono/node-server@2.0.11`, portanto `npm audit --audit-level=low` deve continuar sem ocorrências. A exceção não autoriza afirmar que todo consumidor do `.tgz` terá zero vulnerabilidades.
