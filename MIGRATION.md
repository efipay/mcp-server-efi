# Migração para 1.0.0

A versão 1.0.0 assume quebra de compatibilidade com as tools 0.x.

## Alterações obrigatórias

1. Atualize o host para Node.js 22 ou use a imagem `ghcr.io/efipay/mcp-server-efi:1.0.0`.
2. Use os nomes `snake_case` apresentados por `tools/list` e o envelope `{ params, body, idempotency_key? }` conforme o schema de cada tool.
3. Remova `EFI_IDEMPOTENCY_KEY`. Informe `idempotency_key` na chamada quando precisar reutilizar uma chave; caso contrário, leia a chave gerada na resposta.
4. Se utilizava certificado, credenciais de conta simplificada ou chave SFTP retornados ao modelo, habilite somente as tools necessárias com `EFI_SENSITIVE_TOOLS` e `EFI_ACCEPT_SENSITIVE_OUTPUT_RISK=I_UNDERSTAND`.
5. Revise automações que esperavam 173 tools por padrão: agora `tools/list` apresenta 170, ou 173 com o opt-in integral.
6. Trate `verification.signature_status` de `pix_qr_code_detail`. Apenas `verified` confirma a assinatura; `invalid` e `unavailable` são alertas.
7. Para Smithery, substitua o antigo `smithery.yaml` pelo bundle produzido com `npm run mcpb:pack`; servidores locais `stdio` não exigem URL pública.

As credenciais continuam exclusivamente em `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERTIFICATE`, `EFI_PEM_KEY` e `EFI_PARTNER_TOKEN`.
